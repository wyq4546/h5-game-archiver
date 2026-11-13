import fs from 'node:fs';
import path from 'node:path';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createVideoRecorder } from '../../../../src/game-video-recorder.mjs';
import { acceptRecordedClip } from '../../../../src/recording-acceptance.mjs';
import { GameDriver } from './game.mjs';
import { TrackStrategy } from './strategy.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pad = n => String(n).padStart(6, '0');

export async function runLevels({
  root,
  startLevel = 1,
  endLevel = 10,
  record = true,
  visible = false,
  batch = null,
  winTailMs = 1200,
  deadlineMs = 95000,
  attempts = 4,
}) {
  const scriptsDir = path.join(root, 'scripts');
  const batchName = batch || `recording-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`;
  const videoDir = path.join(scriptsDir, 'video', batchName);
  const dataDir = path.join(scriptsDir, 'recording-data', batchName);

  // 全局指南 §3「执行前检查」：成片目录必须位于本游戏 scripts/video/ 内。
  const videoRoot = path.resolve(path.join(scriptsDir, 'video'));
  if (!path.resolve(videoDir).startsWith(videoRoot + path.sep)) {
    throw new Error(`成片目录越界：${videoDir}`);
  }

  await mkdir(videoDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  const logPath = path.join(dataDir, 'run.log');
  const log = (...parts) => {
    const line = `[${new Date().toISOString()}] ${parts.join(' ')}`;
    console.log(line);
    fs.appendFileSync(logPath, line + '\n', 'utf8');
  };

  // 断点续录：沿用同名批次的 report.json，已录过的关卡不再重录。
  const reportPath = path.join(dataDir, 'report.json');
  const checkpointPath = path.join(dataDir, 'checkpoint.json');
  let reports = [];
  if (batch) {
    try {
      const old = JSON.parse(await readFile(reportPath, 'utf8'));
      reports = Array.isArray(old.levels) ? old.levels : (old.completedLevels || []);
      log(`[批次] 复用 ${batchName}，已有 ${reports.length} 关记录`);
    } catch { /* 新批次 */ }
  }
  const completed = new Set(reports.filter(r => r.acceptance?.passed).map(r => r.level));
  const targetEnd = endLevel;
  let firstNeeded = startLevel;
  while (firstNeeded <= targetEnd && completed.has(firstNeeded)) firstNeeded += 1;

  log(`[批次] ${batchName}｜模式 ${record ? 'RECORD' : 'PLAY'}｜目标 ${startLevel}-${targetEnd}｜本轮从 ${firstNeeded} 开始`);
  log(`[批次] 成片目录 ${videoDir}`);
  log(`[批次] 数据目录 ${dataDir}`);

  const game = new GameDriver({ root, visible, record });
  await game.init();
  const suppression = await game.installVisualSuppression();
  log(`[画面] 渲染抑制已安装：${JSON.stringify(suppression)}`);
  const strategy = new TrackStrategy();

  const recorder = record
    ? await createVideoRecorder(game.page, {
        directory: videoDir,
        fps: 60,
        speed: 1.0,
        captureEveryFrame: true,
        deferChunkWrites: true,
        encoderWarmupMs: 1800,
        outputWidth: 1080,
        outputHeight: 1920,
      })
    : null;

  // 只读快照：赛道实体签名（证明切关后确实换了地图）
  const trackSignature = async () => {
    const { hazards, items } = await game.getTrackEntities();
    const zs = [...hazards, ...items].map(p => p[2]).filter(Number.isFinite).sort((a, b) => a - b);
    return { hazards: hazards.length, items: items.length, minZ: zs[0] ?? null, maxZ: zs.at(-1) ?? null };
  };

  const waitStartReady = async (label, timeoutMs = 30000) => {
    const began = Date.now();
    while (Date.now() - began < timeoutMs) {
      const ui = await game.getUIState().catch(() => null);
      const p = await game.getPlayerState().catch(() => null);
      if (ui?.ttsActive && !ui.isLoading && p && Math.abs(p[2]) < 5) return { ui, p };
      await sleep(200);
    }
    throw new Error(`${label}：起跑界面等待超时`);
  };

  const dumpStuck = async (level, p, ents, outcome, extra) => {
    try {
      const nearby = ents.hazards.filter(h => Math.hypot(h[0] - p[0], h[2] - p[2]) < 30)
        .map(h => h.map(v => Math.round(v * 100) / 100));
      const file = path.join(dataDir, `stuck-L${level}.json`);
      await writeFile(file, JSON.stringify({
        level, player: p, nearbyHazards: nearby,
        allHazards: ents.hazards.map(h => h.map(v => Math.round(v * 100) / 100)),
        allItems: ents.items.map(v => v.map(n => Math.round(n * 100) / 100)),
        hazardCount: ents.hazards.length, itemCount: ents.items.length, outcome, extra,
        at: new Date().toISOString(),
      }, null, 2));
      await game.page.screenshot({ path: path.join(dataDir, `stuck-L${level}.png`) });
      log(`  L${level} 卡死诊断 ${file}`);
    } catch (e) { log(`  L${level} 卡死诊断失败 ${e.message}`); }
  };

  const playOneLevel = async (level, { recordStart = null, failBaseline = false, winBaseline = false } = {}) => {
    strategy.reset();
    await game.releaseTouch();
    await game.tapStart();
    const began = Date.now();
    let hadSprint = false;
    let podium = false;
    let prev = null;
    let motionStart = null;
    let motionEnd = null;
    let maxZ = 0;
    let lastNote = 0;
    let steps = 0;
    let progressPos = null;
    let progressAt = Date.now();
    let stuckReason = null;
    let loose = false;
    let lastEnts = { hazards: [], items: [] };
    let lastOutcome = null;
    let lastTarget = null;

    while (Date.now() - began < deadlineMs) {
      steps += 1;
      const p = await game.getPlayerState();
      const sprint = await game.getSprintButtonActive();
      const ents = await game.getTrackEntities();
      const now = Date.now();
      lastEnts = ents;

      if (p) {
        maxZ = Math.max(maxZ, p[2]);
        if (prev && Math.hypot(p[0] - prev[0], p[2] - prev[2]) > 0.04 && motionStart === null) {
          motionStart = recordStart === null ? null : Math.max(0, (now - recordStart) / 1000);
        }
        prev = p;
        // 转弯关必须按世界平面位移判断卡死（第 2 关 z 冻结而 x 持续变化）。
        if (!progressPos) progressPos = { x: p[0], z: p[2] };
        if (Math.hypot(p[0] - progressPos.x, p[2] - progressPos.z) > 1.2) {
          progressPos = { x: p[0], z: p[2] };
          progressAt = now;
        } else if (now - progressAt > 12000 && !sprint) {
          stuckReason = `世界平面 12s 无位移 world=(${p[0].toFixed(1)},${p[2].toFixed(1)}) localX=${p[3]?.toFixed(2)}`;
        }
        if (now - lastNote > 1000) {
          lastNote = now;
          log(`  L${level} world=(${p[0].toFixed(1)},${p[1].toFixed(1)},${p[2].toFixed(1)}) localX=${p[3]?.toFixed(2)} 目标车道=${lastTarget} sprint=${sprint} 危险${ents.hazards.length} 收集${ents.items.length}`);
        }
      }

      // 每 15 步读一次结局文本，避免给录制主循环增加逐帧开销。
      if (steps % 15 === 0) {
        const outcome = await game.getOutcome().catch(() => null);
        lastOutcome = outcome;
        if (outcome?.failedText && !failBaseline) {
          loose = true;
          stuckReason = `原生失败面板（Ты проиграл!）world=(${p?.[0]?.toFixed(1)},${p?.[2]?.toFixed(1)}) texts=${JSON.stringify(outcome.texts.slice(0, 8))}`;
        } else if (outcome?.win && !winBaseline) {
          podium = true;
          motionEnd = recordStart === null ? null : (now - recordStart) / 1000;
          await game.releaseTouch();
          log(`  L${level} 原生 WIN world=(${p?.[0]?.toFixed(1)},${p?.[2]?.toFixed(1)}) 用时 ${((now - began) / 1000).toFixed(1)}s steps=${steps}`);
          break;
        }
      }

      if (loose || stuckReason) {
        await dumpStuck(level, p ?? [0, 0, 0, 0], lastEnts, lastOutcome, { stuckReason, loose, lastTarget, touchX: game.currentTouchX, touching: game.touching });
        break;
      }

      if (sprint) {
        hadSprint = true;
        await game.releaseTouch();
        await game.tapSprint();
        continue;
      }
      // SprintButton 在登顶领奖台那一刻失活；第 1 关实测 z=149.15、y=3.29，
      // 第 2 关 z≈67（转弯后世界 z 冻结），所以同时接受原生 WIN 文本。
      if ((hadSprint && !sprint) || (p && p[2] >= 145 && p[1] > 2)) {
        podium = true;
        motionEnd = recordStart === null ? null : (now - recordStart) / 1000;
        await game.releaseTouch();
        log(`  L${level} 登顶领奖台 world=(${p?.[0]?.toFixed(1)},${p?.[2]?.toFixed(1)}) 用时 ${((now - began) / 1000).toFixed(1)}s steps=${steps}`);
        break;
      }

      if (p) {
        const action = strategy.evaluate(p, ents.hazards, ents.items);
        if (action.phase === 'RUN') {
          lastTarget = action.targetLateral;
          await game.steerToLane(action.targetLateral);
        }
      }
      await sleep(30);
    }
    await game.releaseTouch();
    return { podium, motionStart, motionEnd, maxZ, elapsedMs: Date.now() - began, steps, stuckReason, loose };
  };

  const removeLevelArtifacts = async level => {
    const prefix = `level-${pad(level)}`;
    for (const f of await readdir(videoDir).catch(() => [])) {
      if (f.startsWith(prefix) || f.startsWith(`.${prefix}`)) {
        await rm(path.join(videoDir, f), { recursive: true, force: true });
        log(`  L${level} 清理未完成片段 ${f}`);
      }
    }
  };

  const persist = async extra => {
    const body = {
      batchName,
      createdAt: reports[0]?.timestamp || new Date().toISOString(),
      startLevel,
      endLevel: targetEnd,
      record,
      totalCompleted: reports.length,
      levels: reports,
      ...extra,
    };
    await writeFile(reportPath, JSON.stringify(body, null, 2));
    await writeFile(checkpointPath, JSON.stringify({
      nextLevel: Math.min(targetEnd + 1, (reports.at(-1)?.level ?? startLevel - 1) + 1),
      updatedAt: new Date().toISOString(),
    }, null, 2));
  };

  let currentLevel = 1;
  let failed = null;

  try {
    // 起跑界面（第 1 关）。若 --batch 续录或 --start-level > 1，先用纯原生游玩快进。
    await waitStartReady('L1');

    while (currentLevel <= targetEnd) {
      // 本作关卡进度在 Unity 静态内存中，不随 localStorage 跳关；因此无论
      // --start-level / --batch 续录，都必须用纯原生游玩把 1..N-1 关实跑过去。
      const needsRecord = record && currentLevel >= firstNeeded && !completed.has(currentLevel);
      let succeeded = false;
      let lastReason = '';

      for (let attempt = 1; attempt <= attempts; attempt++) {
        const ready = await waitStartReady(`L${currentLevel}`);
        const sig = await trackSignature();
        log(`[开始] 第${currentLevel}关 ${needsRecord ? '录制' : '纯游玩快进'}（第 ${attempt}/${attempts} 次）｜关卡文本=${JSON.stringify(ready.ui.texts.slice(0, 6))}｜赛道=${JSON.stringify(sig)}`);

        let runStart = null;
        if (needsRecord) {
          await recorder.prepare(currentLevel);
          const warm = await game.warmupRendering(24);
          log(`  L${currentLevel} GPU 全量预热 ${JSON.stringify(warm)}`);
          await game.waitFrames(2);
          await recorder.start(currentLevel);   // logicalStart 必须早于第一次原生输入
          runStart = Date.now();
        } else {
          runStart = Date.now();
        }

        const baselineOutcome = await game.getOutcome().catch(() => null);
        const played = await playOneLevel(currentLevel, {
          recordStart: needsRecord ? runStart : null,
          failBaseline: Boolean(baselineOutcome?.failedText),
          winBaseline: Boolean(baselineOutcome?.win),
        });
        if (!played.podium) {
          if (needsRecord) await recorder.discard().catch(() => {});
          await removeLevelArtifacts(currentLevel);
          lastReason = played.stuckReason || `超时未到领奖台 maxZ=${played.maxZ.toFixed(1)} steps=${played.steps}`;
          log(`  L${currentLevel} 第${attempt}次未通关：${lastReason}`);
          if (attempt < attempts) {
            // 失败面板的「ПОВТОРИТЬ」与胜利面板的「ДАЛЬШЕ」是同一个屏幕位置
            // (541,1247)；这里用原生触摸重开本关，不写任何内存状态。
            await sleep(300);
            await game.tapNextLevel();
            await sleep(900);
            continue;
          }
          throw new Error(`第${currentLevel}关 ${attempts} 次尝试均未通关：${lastReason}`);
        }

        if (needsRecord) {
          // 1.2s 纯净通关演出；结算窗由逐帧抑制挡住，业务回调保持可用。
          await sleep(winTailMs);
          const motionStart = played.motionStart ?? 0.1;
          const motionEnd = played.motionEnd ?? (Date.now() - runStart) / 1000 - winTailMs / 1000;
          const motionWindows = [{ start: Math.max(0, motionStart), end: Math.max(motionStart + 0.1, motionEnd) }];
          const videoMeta = await recorder.finish({ outcome: 'completed', motionWindows });
          log(`  L${currentLevel} 成片 ${path.basename(videoMeta.file)} 刷新 ${videoMeta.averageRefreshFps?.toFixed(2)}FPS 编码 ${videoMeta.encodedContinuity?.averageEncodedFps?.toFixed(2)}FPS 开头maxGap ${videoMeta.encodedOpening?.maxGapMs?.toFixed(1)}ms`);
          let acceptance;
          try {
            acceptance = await acceptRecordedClip(videoMeta, dataDir, { width: 1080, height: 1920, nativePassed: true });
            log(`  L${currentLevel} 验收通过：${acceptance.duration?.toFixed(2)}s 刷新 ${acceptance.nativeRefreshFps?.toFixed(2)}FPS 编码 ${acceptance.nativeEncodedFps?.toFixed(2)}FPS 音量 ${acceptance.meanDb}dB`);
          } catch (error) {
            await removeLevelArtifacts(currentLevel);
            throw new Error(`第${currentLevel}关成片验收失败：${error.message}`);
          }
          reports = reports.filter(r => r.level !== currentLevel);
          reports.push({
            level: currentLevel,
            durationMs: played.elapsedMs,
            attempt,
            track: await trackSignature().catch(() => null),
            videoMeta,
            video: videoMeta,
            acceptance,
            timestamp: new Date().toISOString(),
          });
          reports.sort((a, b) => a.level - b.level);
          await persist();
        } else {
          // 不录制时也要等结算窗的「ДАЛЬШЕ」可用（实测通关后 ~400ms 才完全激活）。
          await sleep(winTailMs);
          log(`  L${currentLevel} 纯游玩通过（快进，不录制）`);
        }
        succeeded = true;
        break;
      }
      if (!succeeded) throw new Error(`第${currentLevel}关未成功：${lastReason}`);
      if (currentLevel >= targetEnd) break;

      // ── 原生切关：结算窗的「ДАЛЬШЕ」按钮（CanvasGroup.alpha=0 不影响 raycast）──
      await sleep(400);
      let nextReady = false;
      let taps = 0;
      for (let retry = 0; retry < 8 && !nextReady; retry++) {
        if (retry === 0 || retry === 3 || retry === 6) {
          taps += 1;
          await game.tapNextLevel();
        }
        const began = Date.now();
        while (Date.now() - began < 3000) {
          const p = await game.getPlayerState().catch(() => null);
          const ui = await game.getUIState().catch(() => null);
          if (p && Math.abs(p[2]) < 3 && ui?.ttsActive) { nextReady = true; break; }
          await sleep(250);
        }
      }
      if (!nextReady) throw new Error(`第${currentLevel}关点击「ДАЛЬШЕ」后未回到起跑界面（共点 ${taps} 次）`);
      log(`[切关] 第${currentLevel}关 → 第${currentLevel + 1}关（原生按钮 ${taps} 次）`);
      currentLevel += 1;
    }
  } catch (error) {
    failed = error;
    log(`[异常] ${error.message}`);
  } finally {
    const stats = await game.stopVisualSuppression().catch(() => null);
    log(`[画面] 渲染抑制统计 ${JSON.stringify(stats)}`);
    await persist({ status: failed ? 'failed' : 'finished', error: failed?.message ?? null }).catch(() => {});
    if (recorder?.active) {
      try { await recorder.discard(); } catch { /* 已由 discard 处理 */ }
    }
    await game.close();
    log('[批次] 浏览器与回放服务已关闭');
  }

  if (failed) throw failed;
  return { batchName, videoDir, dataDir, reports };
}
