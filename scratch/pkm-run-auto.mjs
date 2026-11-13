// 逐关原生自动化：纯物理游玩或逐关录像。
//
//   node scripts/internal/run-auto.mjs --play --end 10
//   node scripts/internal/run-auto.mjs --record --end 10
//   node scripts/internal/run-auto.mjs --record --start-level 6 --end 10
//
// 重要：本作的关卡进度由平台侧（GamePush player）保存，离线新会话一定从第 1 关开始，
// 因此每个批次都是「单会话从头连打」；--start-level 之前的关卡只预热跑过、不录像。
// 某关没能通过时直接中止批次（保住已验收成片），不会重开页面假装续关——那样会录错关。
//
// 输出的视频固定落在 scripts/video/recording-<UTC>/level-00000N.mp4，
// 报告、日志、断点、源码快照固定落在 scripts/recording-data/<同名批次>/。
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createReplayServer } from './replay.mjs';
import { openGame } from './game.mjs';
import { prepareLevel, playLevel, RESULT_VIEWS } from './runner.mjs';
import { createVideoRecorder, checkVideoTools, recordingDirectory } from './game-video-recorder.mjs';
import { installNativeRecordingMotion, readNativeRecordingMotion } from './recording-runtime.mjs';
import { acceptRecordedClip } from './recording-acceptance.mjs';

const scripts = fileURLToPath(new URL('../', import.meta.url));
const root = path.dirname(scripts);
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};

const record = args.includes('--record');
const startLevel = Number(option('--start-level', 1));
const endLevel = Number(option('--end', 10));
const maxAttempts = Number(option('--attempts', 3));
if (!Number.isSafeInteger(startLevel) || startLevel < 1) throw Error('--start-level 必须为正整数');
if (!Number.isSafeInteger(endLevel) || endLevel < 0) throw Error('--end 必须为非负整数（0 表示无限）');
if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw Error('--attempts 必须为正整数');

const batch = option('--batch', record ? path.basename(recordingDirectory(scripts)) : `play-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`);
if (!/^(recording|play)-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z$/.test(batch)) throw Error('批次目录命名不合法: ' + batch);
const videoDirectory = path.join(scripts, 'video', batch);
const dataDirectory = path.join(scripts, 'recording-data', batch);
await fs.mkdir(dataDirectory, { recursive: true });
if (record) await fs.mkdir(videoDirectory, { recursive: true });

const logStream = await fs.open(path.join(dataDirectory, 'run.log'), 'a');
const writeLog = line => logStream.write(line + '\n');
for (const method of ['log', 'warn', 'error']) {
  const original = console[method].bind(console);
  console[method] = (...values) => {
    original(...values);
    writeLog(new Date().toISOString() + ' ' + values.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '));
  };
}
const log = (...values) => console.log(values.join(' '));

const readJson = async (file, fallback) => fs.readFile(file, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return fallback;
  throw error;
});
const atomicWrite = async (file, value) => {
  const temporary = file + '.writing';
  await fs.writeFile(temporary, JSON.stringify(value, null, 2));
  await fs.rename(temporary, file);
};

const reportFile = path.join(dataDirectory, 'report.json');
const checkpointFile = path.join(dataDirectory, 'checkpoint.json');
let report = await readJson(reportFile, {
  batch,
  game: 'Feed Pocket Monsters in Palworld',
  createdAt: new Date().toISOString(),
  recordVideo: record,
  startLevel,
  endLevel,
  levels: [],
  failures: [],
});
report.startLevel = startLevel;
report.endLevel = endLevel;
report.recordVideo = record;
// 断点只用于记录「已经录到第几关」，不用于跨会话续关：离线新会话一定从第 1 关开始。
let checkpoint = await readJson(checkpointFile, { nextLevel: startLevel, storageState: null });

const saveReport = () => atomicWrite(reportFile, { ...report, updatedAt: new Date().toISOString() });
const saveCheckpoint = () => atomicWrite(checkpointFile, checkpoint);

if (record) {
  await checkVideoTools();
  await fs.mkdir(path.join(dataDirectory, 'source'), { recursive: true });
  for (const name of ['game.mjs', 'steer.mjs', 'runner.mjs', 'run-auto.mjs', 'storage.mjs']) {
    await fs.writeFile(path.join(dataDirectory, 'source', name), await fs.readFile(path.join(scripts, 'internal', name)));
  }
  for (const name of ['bot-context.json', 'build-bot-context.mjs']) {
    await fs.writeFile(path.join(dataDirectory, 'source', name), await fs.readFile(path.join(scripts, 'internal', name)));
  }
}
const automationRevision = {
  revision: 'fpm-native-v2',
  steerSha256: createHash('sha256').update(await fs.readFile(path.join(scripts, 'internal', 'steer.mjs'))).digest('hex'),
  runnerSha256: createHash('sha256').update(await fs.readFile(path.join(scripts, 'internal', 'runner.mjs'))).digest('hex'),
};

let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
  log('收到中断信号：当前关结束后停止');
});

// Unity 的 IDBFS 存档目录名是「源」的哈希，源里含端口；端口一变存档键就对不上。
// 因此回放服务必须绑固定端口，断点续录才能读到同一份存档。
const replayPort = Number(option('--port', 49260));
if (!Number.isSafeInteger(replayPort) || replayPort < 1024) throw Error('--port 必须为 >=1024 的整数');
const replay = await createReplayServer(root, { port: replayPort }).catch(error => {
  throw Error(`回放服务无法绑定端口 ${replayPort}（可能上一批次还在运行）：${error.message}`);
});
let game = null;
let recorder = null;

// 新关卡就绪：角色在起点、终点存在、结算窗没有挂出。
async function waitForFreshLevel(timeoutMs = 40000) {
  const began = Date.now();
  while (Date.now() - began < timeoutMs) {
    const state = await game.state().catch(() => null);
    if (state && state.finish && state.z < 1.2) {
      const ui = await game.ui().catch(() => null);
      if (ui && !ui.panels.CompleteScreenView && !ui.panels.TryAgainView) return state;
    }
    await game.page.waitForTimeout(250);
  }
  throw Error('等待新关卡就绪超时');
}

// 结算面板 → 下一关：先让转盘转完，再用真实点击走 "no, thanks"。
// 结算 → 下一关。结算链路上可能有多个弹窗（转盘、宝箱、升级报价、广告确认），
// 它们的按钮位置并不统一，因此按一组候选点轮着点，并把当前可见面板写进日志。
const ADVANCE_TAPS = [[540, 1680], [540, 1600], [540, 1760], [540, 1240], [948, 240], [540, 900]];

// 死亡后点「重试」重开同一关：TryAgainView 出现时游戏仍在当前关，不会串关。
async function retrySameLevel(timeoutMs = 40000) {
  await game.page.waitForTimeout(1200);
  const began = Date.now();
  let round = 0;
  while (Date.now() - began < timeoutMs) {
    const point = ADVANCE_TAPS[round % ADVANCE_TAPS.length];
    await game.tap(point[0], point[1]);
    await game.page.waitForTimeout(900);
    const ui = await game.ui().catch(() => null);
    const state = await game.state().catch(() => null);
    if (ui && state && !ui.panels.TryAgainView && !ui.panels.CompleteScreenView && state.z < 1.5 && state.finish) {
      await game.page.waitForTimeout(700);
      return true;
    }
    round += 1;
  }
  return false;
}

async function advanceToNextLevel(previousZone, timeoutMs = 75000) {
  await game.page.waitForTimeout(2200);
  const began = Date.now();
  let round = 0;
  let lastPanels = '';
  while (Date.now() - began < timeoutMs) {
    const point = ADVANCE_TAPS[round % ADVANCE_TAPS.length];
    await game.tap(point[0], point[1]);
    await game.page.evaluate(() => {
      const g = window.__g;
      if (!g) return;
      for (const popup of g.find('ChestsPopup')) {
        if (g.isActive(popup)) {
          const nextBtn = g.bridge.readPointer(popup + 0x30);
          if (nextBtn) {
            try { g.bridge.invoke('UnityEngine.UI.Button$$Press', nextBtn); } catch {}
          }
        }
      }
    }).catch(() => {});
    await game.page.waitForTimeout(900);
    const ui = await game.ui().catch(() => null);
    const state = await game.state().catch(() => null);
    if (ui && state && !ui.panels.CompleteScreenView && !ui.panels.TryAgainView && state.z < 1.5 && state.finish) {
      log(`  → 进入下一关（z=${state.z} 终点=${state.finish}）`);
      await game.page.waitForTimeout(800);
      return true;
    }
    if (ui) {
      const panels = Object.entries(ui.panels).filter(([, up]) => up).map(([name]) => name).join(',') || '（无）';
      if (panels !== lastPanels) {
        lastPanels = panels;
        log(`  结算界面面板：${panels}`);
      }
    }
    round += 1;
    void previousZone;
  }
  return false;
}

try {
  game = await openGame(replay, checkpoint.storageState ?? null, {});
  if (record) await game.page.evaluate(installNativeRecordingMotion, { source: '() => window.__g.pose()' });

  // 本作的关卡进度归平台侧（GamePush player），离线存档搬不动关号：
  // 新会话一定从第 1 关开始。因此每一批次都从第 1 关开打，--start-level 之前的关卡
  // 只做「预热跑过」（不录像），到指定关卡才开始录。
  let level = 1;
  const limit = endLevel > 0 ? endLevel : Infinity;
  // 成片已成立但推进下一关失败、或某关未通过时置位：此时游戏还停在结算面板，
  // 继续录下一关会串关，只能中止。
  let aborted = false;
  while (level <= limit && !stopping && !aborted) {
    const recording = record && level >= startLevel;
    let accepted = false;
    let attempts = 0;
    for (let attempt = 1; attempt <= maxAttempts && !accepted && !stopping; attempt += 1) {
      attempts = attempt;
      let video = null;
      let cleared = false;
      let result = null;
      try {
        const fresh = await waitForFreshLevel();
        const clean = await game.dismissIntro();

        const isBonus = (await game.page.evaluate(() => {
          const g = window.__g;
          for (const c of g.find('LevelTypeController')) {
            if (g.isActive(c) && g.bridge.readInt(c + 16) === 1) return true;
          }
          return false;
        })) || false;

        if (isBonus) {
          log(`  🎁 检测到奖励关卡（跳过录制，物理通关快速推进）`);
          await game.page.waitForTimeout(800);
          await game.dismissIntro();
          const prepared = await prepareLevel(game, { log, level });
          let bonusZone = prepared.scan.finish;
          try {
            const bonusResult = await playLevel(game, prepared, { log, level });
            bonusZone = bonusResult.state?.finish ?? prepared.scan.finish;
          } catch (e) {
            log(`  奖励关通关提示：${e.message}，直接推进下一关`);
          }
          await game.page.waitForTimeout(1000);
          await advanceToNextLevel(bonusZone);
          attempt = 0;
          continue;
        }

        log(`=== 第 ${level} 关 ${recording ? '（录制）' : record ? '（预热）' : '（游玩）'} ===`);
        log(`  关卡就绪 游戏内关号=${fresh.level} z=${fresh.z} 终点=${fresh.finish} 力量=${fresh.strength}`);
        if (fresh.level !== level) log(`  ⚠️ 游戏内关号 ${fresh.level} 与计划关号 ${level} 不一致`);
        log(`  开场教学层已关闭=${clean}`);
        // 录制时结算窗的绘制在整个关卡里保持屏蔽，只留回调；纯游玩不需要动它。
        if (recording) {
          const hidden = await game.hideResults(RESULT_VIEWS);
          log(`  预先屏蔽结算窗网格 ${hidden} 个`);
        }

        const prepared = await prepareLevel(game, { log, level });

        let media = null;
        if (recording) {
          recorder = await createVideoRecorder(game.page, {
            directory: videoDirectory,
            fps: 60,
            captureEveryFrame: true,
            deferChunkWrites: true,
            encoderWarmupMs: 1800,
            outputWidth: 1080,
            outputHeight: 1920,
          });
          const info = await recorder.prepare(level);
          if (info.width !== 1080 || info.height !== 1920) throw Error('录制画布不是 1080×1920：' + JSON.stringify(info));
          if (!(info.audioTracks >= 1)) throw Error('录制没有拿到原生音频轨：' + JSON.stringify(info));
          media = await recorder.start(level);
          log(`  录制已就位 trimHead=${media.trimHeadSeconds.toFixed(2)}s 音频轨=${info.audioTracks}`);
        }

        result = await playLevel(game, prepared, { log, level });
        const zone = result.state?.finish ?? prepared.scan.finish;
        // 结算窗前再留 1 秒庆典画面，然后用 trimTail 把那 1 秒连同结算窗一起切掉。
        await game.page.waitForTimeout(1000);

        if (recording) {
          const motion = await readNativeRecordingMotion(game.page, { logicalStartedAt: media.logicalStartedAt });
          video = await recorder.finish({ outcome: result.ok ? 'completed' : 'failed', trimTailSeconds: 1.0, motionWindows: motion.motionWindows });
          video.nativeMotionSamples = motion.nativeMotionSamples;
          if (result.ok) video.acceptance = await acceptRecordedClip(video, dataDirectory, { width: 1080, height: 1920, nativePassed: true });
          recorder = null;
        }

        const entry = {
          level,
          gameLevel: fresh.level,
          attempt,
          ok: result.ok,
          ended: result.ended,
          finish: zone,
          strength: result.state?.strength ?? null,
          obstacles: prepared.scan.obstacles.length,
          rewards: prepared.scan.foods.length,
          video,
          automation: automationRevision,
          at: new Date().toISOString(),
        };
        const existing = report.levels.find(item => item.level === level);
        if (!recording && existing?.video) {
          entry.video = existing.video;
          entry.strength = existing.strength;
        }
        report.levels = report.levels.filter(item => item.level !== level);
        report.levels.push(entry);
        report.levels.sort((a, b) => a.level - b.level);
        accepted = result.ok;
        cleared = result.ok;
        await saveReport();

        if (!accepted) throw Error('原生未通关：' + result.ended);
        log(`  ✅ 第 ${level} 关${recording ? ` 成片 ${path.basename(video.file)} 刷新 ${video.averageRefreshFps.toFixed(2)} FPS` : ''}`);

        // 成片已经通过验收并落盘：后面推进下一关的失败不能再回头删掉它。
        if (recording) await game.showResults();
        const advanced = await advanceToNextLevel(zone);
        if (!advanced && level < limit) throw Error('结算面板没有推进到下一关');
        checkpoint = { nextLevel: level + 1, storageState: await game.context.storageState() };
        await saveCheckpoint();
      } catch (error) {
        console.error(`  ❌ 第 ${level} 关第 ${attempt} 次尝试失败${cleared ? '（成片已成立，仅推进下一关失败）' : ''}：${error.message}`);
        report.failures.push({ level, attempt, error: error.stack || String(error), at: new Date().toISOString() });
        await saveReport();
        await fs.mkdir(path.join(scripts, '.tmp'), { recursive: true });
        await game.page.screenshot({ path: path.join(scripts, '.tmp', `failure-${level}-${attempt}.png`) }).catch(() => {});
        if (!cleared && video?.file) await fs.rm(video.file, { force: true }).catch(() => {});
        if (recorder?.active) await recorder.discard().catch(() => {});
        recorder = null;
        // 死亡（TryAgainView）不是串关：点重试会重开同一关，可以安全地再试一次。
        if (result?.ended === 'died') {
          const retried = await retrySameLevel();
          log(retried ? '  已重开本关，继续下一次尝试' : '  重开本关失败');
          if (retried) continue;
        }
        const stillAtStart = await game.state().then(s => s && s.z < 1.5 && s.finish).catch(() => false);
        if (stillAtStart && attempt < maxAttempts) {
          log('  游戏仍停留在本关起点，重试本关');
          await game.page.waitForTimeout(600);
          continue;
        }
        // 绝不靠重开页面重来：本作的关卡进度归平台侧，离线新会话必然回到第 1 关，
        // 那样会把第 1 关的画面当成第 N 关交付。这里直接中止批次，保住已验收的成片。
        report.status = 'failed';
        aborted = true;
        break;
      }
    }
    if (!accepted) {
      log(`第 ${level} 关共 ${attempts} 次尝试仍未通过，保留断点退出`);
      report.status = 'failed';
      break;
    }
    level += 1;
  }
  if (report.status !== 'failed') report.status = stopping ? 'stopped' : 'completed';
  report.completedLevels = report.levels.filter(item => item.ok).length;
  report.videoDirectory = record ? videoDirectory : null;
  report.dataDirectory = dataDirectory;
  report.finishedAt = new Date().toISOString();
  await saveReport();
  log(`批次结束：${batch}，完成 ${report.completedLevels} 关`);
} catch (error) {
  report.status = 'failed';
  report.error = String(error.stack || error);
  report.finishedAt = new Date().toISOString();
  await saveReport().catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  if (recorder?.active) await recorder.discard().catch(() => {});
  await game?.browser.close().catch(() => {});
  replay.server.closeAllConnections();
  await new Promise(resolve => replay.server.close(resolve));
  await logStream.close();
}
