import { spawn } from 'node:child_process';
import { readdir, stat, readFile, writeFile, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../', import.meta.url));

let ALL_GAMES = [];
try {
  const jsonPath = path.join(rootDir, 'scripts', 'scheduled-games.json');
  const jsonRaw = JSON.parse(await readFile(jsonPath, 'utf8'));
  ALL_GAMES = jsonRaw.map(g => ({
    ...g,
    cwd: path.isAbsolute(g.cwdRel || g.cwd) ? (g.cwdRel || g.cwd) : path.join(rootDir, g.cwdRel || g.cwd)
  }));
} catch (err) {
  console.error('Failed to load scheduled-games.json:', err.message);
  process.exit(1);
}

// 通道 2 优先级策略：
// 优先执行带完整 60 FPS 录制管线的精品游戏（与通道 1 严格分道）：
const priorityIds = [
  'Build-A-Queen-Christmas-Beauty-20260930-200244',
  'Snake-Run-Race-20260929-231315',
  'Join-Blob-Clash-20260929-164518',
  'Merge-Rush-2048-20260927-113252',
  'Pencil-Rush-20261003-153217',
  'Tap-To-Color-Painting-Book-20261002-182432',
  'Battery-Run-3D-20260910-051700'
];

const channel1EarlyIds = [
  'Man-Runner-2048-20261003-095019',
  'Count-Masters-20260928-175220',
  'Noodle-Stack-Runner-20261001-010716',
  'Draw-Path-To-Home-20261002-232839',
  'Bubble-Shooter-Classic-Pop-20261001-142030'
];

const priorityGames = priorityIds.map(id => ALL_GAMES.find(g => g.id === id)).filter(Boolean);
const otherGamesReverse = [...ALL_GAMES].reverse().filter(g => !priorityIds.includes(g.id) && !channel1EarlyIds.includes(g.id));
const CHANNEL2_GAMES = [...priorityGames, ...otherGamesReverse];

/**
 * 校验 MP4 文件合法性（文件存在、大于 1MB、且包含 ISO MP4 'ftyp' 魔数头）
 */
async function isValidMp4File(filePath, minSize = 1024 * 1024) {
  try {
    const st = await stat(filePath);
    if (st.size < minSize) return false;
    const fh = await open(filePath, 'r');
    const buf = Buffer.alloc(16);
    await fh.read(buf, 0, 16, 0);
    await fh.close();
    return buf.toString('latin1', 4, 8) === 'ftyp';
  } catch {
    return false;
  }
}

/**
 * 统计指定游戏在各自目录下实际已录制完成且有效的唯一关卡集合
 */
async function getRecordedLevels(game) {
  const levelSet = new Set();
  const cVideoBase = path.isAbsolute(game.checkBatchDir) ? game.checkBatchDir : path.resolve(game.cwd, game.checkBatchDir);

  async function walk(dir) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          await walk(full);
        } else if (ent.isFile() && ent.name.endsWith('.mp4') && !ent.name.startsWith('.')) {
          if (await isValidMp4File(full)) {
            const m = ent.name.match(/level-0*(\d+)/i);
            if (m) levelSet.add(Number(m[1]));
          }
        }
      }
    } catch {}
  }

  await walk(cVideoBase);
  return levelSet;
}

/**
 * 查找可用的最新断点批次与关卡存档
 */
async function findLatestBatchWithCheckpoint(game) {
  const videoBase = path.isAbsolute(game.checkBatchDir) ? game.checkBatchDir : path.resolve(game.cwd, game.checkBatchDir);
  try {
    const entries = await readdir(videoBase, { withFileTypes: true });
    const batches = entries.filter(e => e.isDirectory() && e.name.startsWith('recording-')).map(e => e.name).sort().reverse();

    for (const batch of batches) {
      const videoBatch = path.join(videoBase, batch);
      const scriptsDir = path.resolve(videoBase, '..');
      const dataBatch = path.join(scriptsDir, 'recording-data', batch);
      const checkpointFile = path.join(dataBatch, 'checkpoint.json');
      const checkpointsDir = path.join(dataBatch, 'checkpoints');

      try {
        let cp = {};
        let cpRaw = '';
        try {
          cpRaw = await readFile(checkpointFile, 'utf8');
          cp = JSON.parse(cpRaw);
        } catch {
          try {
            const cpFiles = (await readdir(checkpointsDir)).filter(f => f.endsWith('.json')).sort().reverse();
            for (const cf of cpFiles) {
              try {
                const inner = JSON.parse(await readFile(path.join(checkpointsDir, cf), 'utf8'));
                if (inner && inner.level) {
                  cp = inner;
                  await writeFile(checkpointFile, JSON.stringify(cp, null, 2) + '\n');
                  break;
                }
              } catch {}
            }
          } catch {}
        }

        let level = cp.level || Number(cp['Noodle-Stack-Runner__maxLevel']) || Number(cp.DEV_BuildAQueen_levelindex) || Number(cp.DEV__maxLevel) || Number(cp._maxLevel);
        if (!level && cp) {
          for (const k of Object.keys(cp)) {
            if (k.includes('WebData') && typeof cp[k] === 'string') {
              try {
                const parsed = JSON.parse(cp[k]);
                const inner = typeof parsed.value === 'string' ? JSON.parse(parsed.value) : parsed.value;
                const bLevel = inner?.base_data?.userInfo?.level;
                if (bLevel) { level = Number(bLevel) + 1; break; }
              } catch {}
            }
          }
        }

        if (level && level > 1 && level <= game.targetLevels) {
          return { batchName: batch, videoBatch, checkpoint: { ...cp, level } };
        }
      } catch {}
    }
  } catch {}
  return null;
}

/**
 * 互锁检查：检测通道 1 是否正在运行该游戏
 */
async function isChannel1ActiveOnGame(game) {
  const cVideoBase = path.isAbsolute(game.checkBatchDir) ? game.checkBatchDir : path.resolve(game.cwd, game.checkBatchDir);
  try {
    let recentActive = false;
    async function scan(dir) {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          await scan(full);
        } else if (ent.isFile() && (ent.name.endsWith('.mp4') || ent.name.endsWith('.webm'))) {
          const st = await stat(full);
          if (Date.now() - st.mtimeMs < 15000) {
            recentActive = true;
          }
        }
      }
    }
    await scan(cVideoBase);
    return recentActive;
  } catch {
    return false;
  }
}

function runCommand(cmd, args, cwd, game) {
  return new Promise((resolve, reject) => {
    console.log(`\n============================================================`);
    console.log(`[通道 2 启动录制] ${cmd} ${args.join(' ')}`);
    console.log(`[工作目录] ${cwd}`);
    console.log(`[成片目标目录] ${path.resolve(game.cwd, game.checkBatchDir)}`);
    console.log(`============================================================\n`);

    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, PAGER: 'cat' },
    });

    child.on('error', err => {
      reject(err);
    });

    child.on('close', async code => {
      await new Promise(r => setTimeout(r, 3000));
      resolve(code);
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        H5 游戏全量 1-100 关自动化录制总调度器 (通道 2)   ║');
  console.log('║   视频原生保存在各游戏目录下 + 严格校验 + 双通道防冲突   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let pass = 1;
  while (true) {
    let allFinished = true;
    console.log(`\n================== [通道 2] 调度巡检 (轮次 ${pass}) ==================\n`);

    for (let i = 0; i < CHANNEL2_GAMES.length; i++) {
      const game = CHANNEL2_GAMES[i];

      // 1. 检查各游戏目录下已录制并校验通过的关卡数
      const recordedLevels = await getRecordedLevels(game);
      const existingCount = recordedLevels.size;

      console.log(`[通道 2: ${i + 1}/${CHANNEL2_GAMES.length}] 检查 ${game.name} ... 已完成关卡: ${existingCount}/${game.targetLevels}`);

      if (existingCount >= game.targetLevels) {
        console.log(`   --> 已达成目标关卡数 (${existingCount}/${game.targetLevels})，100% 录制完成，跳过。\n`);
        continue;
      }

      // 2. 双通道互锁检查：若通道 1 正在该游戏录制，通道 2 避让
      if (await isChannel1ActiveOnGame(game)) {
        console.log(`   --> 通道 1 目前正活跃占用此游戏，通道 2 自动避让。\n`);
        continue;
      }

      allFinished = false;

      // 3. 参数构造（支持断点续录）
      const scriptEntry = game.args[0];
      let runArgs = [...game.args];

      const resumeInfo = await findLatestBatchWithCheckpoint(game);
      if (resumeInfo && existingCount > 0) {
        const relBatch = path.relative(game.cwd, resumeInfo.videoBatch);
        console.log(`   --> 发现可用断点: 第 ${resumeInfo.checkpoint.level} 关 (${resumeInfo.batchName})，启用 --resume 续录`);

        runArgs = [scriptEntry, '--resume', relBatch];
        if (game.args.includes('--record')) runArgs.push('--record');
        if (game.args.includes('--speed')) {
          const sIdx = game.args.indexOf('--speed');
          runArgs.push('--speed', game.args[sIdx + 1]);
        }
        if (game.args.includes('--levels')) {
          runArgs.push('--levels', String(game.targetLevels));
        } else {
          runArgs.push('--end', String(game.targetLevels));
        }
      } else if (existingCount > 0 && existingCount < game.targetLevels) {
        const nextLevel = existingCount + 1;
        console.log(`   --> 已有成片 ${existingCount} 关，自适应配置 --start-level ${nextLevel}`);
        if (runArgs.includes('--start-level')) {
          const idx = runArgs.indexOf('--start-level');
          runArgs[idx + 1] = String(nextLevel);
        } else {
          runArgs.push('--start-level', String(nextLevel));
        }
      }

      // 4. 执行录制
      const code = await runCommand('node', runArgs, game.cwd, game);
      if (code !== 0) {
        console.error(`\n[通道 2 提示] ${game.name} 本轮录制退出，退出码 ${code}。`);
      } else {
        console.log(`\n[通道 2 成功] ${game.name} 录制批次完成！`);
      }

      // 5. 录制结束后结算
      const afterLevels = await getRecordedLevels(game);
      console.log(`\n------------------------------------------------------------`);
      console.log(`[通道 2 录制结算] ${game.name}: 当前已累计有效录制 ${afterLevels.size} / ${game.targetLevels} 关`);
      if (afterLevels.size >= game.targetLevels) {
        console.log(`[通道 2 全量达成] ${game.name} 全部 ${game.targetLevels} 关已完整录制完毕！视频妥善保存在游戏各自目录下。`);
      }
      console.log(`------------------------------------------------------------\n`);
    }

    if (allFinished) {
      console.log('\n[通道 2] 所有分配任务 100% 达成！');
      break;
    }
    pass++;
  }
}

main().catch(err => {
  console.error('通道 2 调度器异常终止:', err);
  process.exit(1);
});
