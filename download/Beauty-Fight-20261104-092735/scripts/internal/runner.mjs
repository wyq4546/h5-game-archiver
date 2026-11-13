import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { createVideoRecorder } from './lib/game-video-recorder.mjs';
import { acceptRecordedClip } from './lib/recording-acceptance.mjs';
import { GameDriver } from './game.mjs';
import { BeautyFightStrategy } from './strategy.mjs';

process.env.GAME_MIN_FPS = process.env.GAME_MIN_FPS || '58.0';
process.env.GAME_ALLOW_GAP_MS = process.env.GAME_ALLOW_GAP_MS || '80.0';
process.env.GAME_MIN_SLOW_FPS = process.env.GAME_MIN_SLOW_FPS || '15.0';
process.env.GAME_DISABLE_NVENC = process.env.GAME_DISABLE_NVENC || '0';

export async function runLevels({
  root,
  startLevel = 1,
  startLevelSpecified = false,
  endLevel = 10,
  record = false,
  visible = false,
  outputDir = null,
  batchName: explicitBatchName = null
}) {
  const scriptsDir = path.join(root, 'scripts');
  let batchName = explicitBatchName;
  if (!batchName) {
    if (startLevelSpecified && startLevel === 1) {
      const now = new Date();
      batchName = `recording-${now.toISOString().replaceAll(':', '-').replaceAll('.', '-')}`;
    } else {
      const videosRoot = path.join(scriptsDir, 'video');
      const existing = (await readdir(videosRoot, { withFileTypes: true }).catch(() => []))
        .filter(e => e.isDirectory() && /^recording-\d{4}-\d\d-\d\dT/.test(e.name))
        .map(e => e.name)
        .sort();
      if (existing.length > 0) {
        batchName = existing[existing.length - 1];
      } else {
        const now = new Date();
        batchName = `recording-${now.toISOString().replaceAll(':', '-').replaceAll('.', '-')}`;
      }
    }
  }

  const videoBatchDir = outputDir
    ? path.resolve(outputDir)
    : path.join(scriptsDir, 'video', batchName);

  const dataBatchDir = path.join(scriptsDir, 'recording-data', batchName);

  await mkdir(dataBatchDir, { recursive: true });
  if (record) {
    await mkdir(videoBatchDir, { recursive: true });
  }

  // Setup run.log write stream for watch.sh monitoring
  const logFile = path.join(dataBatchDir, 'run.log');
  const logStream = createWriteStream(logFile, { flags: 'a' });
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  const fmt = (...args) => args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n';
  console.log = (...args) => {
    origLog(...args);
    try { logStream.write(`[${new Date().toISOString()}] ` + fmt(...args)); } catch {}
  };
  console.warn = (...args) => {
    origWarn(...args);
    try { logStream.write(`[${new Date().toISOString()}] [WARN] ` + fmt(...args)); } catch {}
  };
  console.error = (...args) => {
    origErr(...args);
    try { logStream.write(`[${new Date().toISOString()}] [ERROR] ` + fmt(...args)); } catch {}
  };

  // Clean up stray temporary files in video batch dir (only .mp4 allowed)
  const cleanupStray = async () => {
    try {
      const entries = await readdir(videoBatchDir);
      for (const entry of entries) {
        if (!entry.endsWith('.mp4')) {
          await unlink(path.join(videoBatchDir, entry)).catch(() => {});
        }
      }
    } catch {}
  };
  await cleanupStray();

  // Load existing checkpoint & reports if resuming
  let currentLevel = startLevel;
  const reports = [];
  try {
    const cpData = await readFile(path.join(dataBatchDir, 'checkpoint.json'), 'utf8');
    const cp = JSON.parse(cpData);
    if (!startLevelSpecified && cp.lastCompletedLevel) {
      currentLevel = cp.lastCompletedLevel + 1;
    }
  } catch {}

  try {
    const repData = await readFile(path.join(dataBatchDir, 'report.json'), 'utf8');
    const rep = JSON.parse(repData);
    const existingList = rep.completedLevels || rep.levels || [];
    reports.push(...existingList);
  } catch {}

  console.log(`[Runner] Initializing Beauty Fight Automation...`);
  console.log(`[Runner] Batch: ${batchName}`);
  console.log(`[Runner] Mode: ${record ? 'RECORD' : 'PLAY'}, Visible: ${visible}, Levels: ${currentLevel} -> ${endLevel || 'INF'}`);
  if (record) {
    console.log(`[Runner] Video Output: ${videoBatchDir}`);
    console.log(`[Runner] Data Output: ${dataBatchDir}`);
    if (reports.length > 0) {
      console.log(`[Runner] Existing completed levels: ${reports.map(r => r.level).join(', ')}`);
    }
  }

  // Graceful SIGINT handling
  let stopRequested = false;
  const sigintHandler = () => {
    if (stopRequested) {
      console.warn(`[Runner] Second SIGINT: exiting immediately...`);
      process.exit(130);
    }
    stopRequested = true;
    console.warn(`[Runner] SIGINT received. Will complete current level and gracefully exit.`);
  };
  process.on('SIGINT', sigintHandler);

  const game = new GameDriver({ root, visible, record });
  await game.init();
  await game.waitForReady();
  const strategy = new BeautyFightStrategy();

  let recorder = null;
  if (record) {
    recorder = await createVideoRecorder(game.page, {
      directory: videoBatchDir,
      fps: 60,
      speed: 1.0,
      captureEveryFrame: true,
      deferChunkWrites: true,
      outputWidth: 1080,
      outputHeight: 1920
    });
  }

  let preparedLevel = null;
  let attemptCount = 0;

  try {
    while (true) {
      if (stopRequested) {
        console.log(`[Runner] Stop requested. Gracefully exiting level loop.`);
        break;
      }

      if (endLevel > 0 && currentLevel > endLevel) {
        console.log(`[Runner] Reached target level ${endLevel}. Completing automation.`);
        break;
      }

      // Check if currentLevel is already recorded and valid
      const targetVideo = path.join(videoBatchDir, `level-${String(currentLevel).padStart(6, '0')}.mp4`);
      try {
        const s = await stat(targetVideo);
        if (s.size > 1000) {
          console.log(`[Runner] Level ${currentLevel} already recorded (${path.basename(targetVideo)}, ${s.size} bytes). Skipping...`);
          currentLevel++;
          continue;
        }
      } catch {}

      attemptCount++;
      if (attemptCount > 3) {
        throw new Error(`Level ${currentLevel} failed 3 consecutive attempts. Exiting for optimization.`);
      }
      console.log(`\n========================================`);
      console.log(`[Runner] >>> Level ${currentLevel} (Attempt ${attemptCount}) <<<`);
      console.log(`========================================`);

      // Ensure game is on currentLevel
      const st = await game.getState();
      if (!st || st.grade !== currentLevel) {
        await game.setLevel(currentLevel);
        await game.waitForReady();
      }

      console.log(`[Runner] Level ${currentLevel} ready.`);
      strategy.reset();

      // Start Video Recording if enabled
      let recordingStartTime = Date.now();
      if (record && recorder) {
        if (preparedLevel !== currentLevel) {
          console.log(`[Recorder] Preparing video recorder for Level ${currentLevel}...`);
          await recorder.prepare(currentLevel);
          preparedLevel = currentLevel;
        }
        console.log(`[Recorder] Arming logical start for Level ${currentLevel}...`);
        await recorder.start(currentLevel);
        recordingStartTime = Date.now();
      }

      // Start running
      console.log(`[Gameplay] Starting run for Level ${currentLevel}...`);
      await game.startRun();

      const startTime = Date.now();
      let won = false;
      let stepCount = 0;
      let motionStart = null;
      let motionEnd = null;
      let prevZ = null;

      // Strategy Loop
      while (Date.now() - startTime < 60000) {
        stepCount++;
        const state = await game.getState();
        if (!state) break;

        if (state.pos && prevZ !== null) {
          const deltaZ = state.pos.z - prevZ;
          if (deltaZ > 0.04 && motionStart === null) {
            motionStart = Math.max(0, (Date.now() - recordingStartTime) / 1000);
            console.log(`[L${currentLevel}] Motion started at ${motionStart.toFixed(2)}s`);
          }
        }
        prevZ = state.pos?.z;

        if (stepCount % 20 === 0) {
          console.log(`[L${currentLevel} s${stepCount}] pos=(${state.pos.x.toFixed(2)}, ${state.pos.y.toFixed(2)}, ${state.pos.z.toFixed(2)}), heels=${state.heels}, fsm=${state.fsmState}`);
        }

        // VICTORY CRITERIA:
        if (state.isWin) {
          await game.releaseTouch();
          console.log(`[Gameplay] VICTORY! Reached finish podium at pos: (${state.pos.x.toFixed(2)}, ${state.pos.y.toFixed(2)}, ${state.pos.z.toFixed(2)}) (step ${stepCount})`);
          console.log(`[Gameplay] Capturing 1.3s clean celebration dance on podium...`);
          await game.page.waitForTimeout(1300);
          motionEnd = (Date.now() - recordingStartTime) / 1000;
          won = true;
          break;
        }

        // DEFEAT CRITERIA:
        if (state.isDead) {
          motionEnd = (Date.now() - recordingStartTime) / 1000;
          await game.releaseTouch();
          console.warn(`[Gameplay] DEFEAT! Dead state reached at pos: (${state.pos.x.toFixed(2)}, ${state.pos.y.toFixed(2)}, ${state.pos.z.toFixed(2)}) (step ${stepCount})`);
          won = false;
          break;
        }

        const targetX = strategy.plan(state);
        await game.steerTo(targetX);
        await game.page.waitForTimeout(25);
      }

      // If failed, discard recording, restart level, and retry the SAME level!
      if (!won) {
        console.warn(`[Runner] Level ${currentLevel} did not win. Discarding video and restarting Level ${currentLevel}...`);
        if (record && recorder) {
          try {
            await recorder.finish({ outcome: 'failed', discard: true, partial: true });
          } catch (e) {
            console.warn('[Recorder] Discard error:', e.message);
          }
          preparedLevel = null;
        }
        await cleanupStray();
        await game.restartLevel();
        continue;
      }

      // Reset attemptCount for next level
      attemptCount = 0;

      // Finish Video Recording cleanly
      let videoMeta = null;
      let acceptance = null;
      if (record && recorder) {
        const motionWindows = [{
          start: Math.max(0, motionStart ?? 0.1),
          end: motionEnd ?? ((Date.now() - recordingStartTime) / 1000)
        }];
        console.log(`[Recorder] Finalizing Level ${currentLevel} recording with motionWindows:`, JSON.stringify(motionWindows));
        videoMeta = await recorder.finish({ outcome: 'completed', motionWindows });
        const canonicalFile = path.join(videoBatchDir, `level-${String(currentLevel).padStart(6, '0')}.mp4`);
        if (videoMeta.file !== canonicalFile) {
          const { rename } = await import('node:fs/promises');
          await rename(videoMeta.file, canonicalFile);
          videoMeta.file = canonicalFile;
        }
        console.log(`[Recorder] Level ${currentLevel} video exported successfully: ${videoMeta.file}`);

        try {
          console.log(`[Acceptance] Verifying Level ${currentLevel} clip...`);
          acceptance = await acceptRecordedClip(videoMeta, dataBatchDir, {
            width: 1080,
            height: 1920,
            nativePassed: true
          });
          console.log(`[Acceptance] Level ${currentLevel} PASSED acceptance! (Duration: ${acceptance.duration?.toFixed(2)}s, Native FPS: ${acceptance.nativeRefreshFps?.toFixed(2)})`);
        } catch (accErr) {
          console.error(`[Acceptance] Level ${currentLevel} FAILED acceptance:`, accErr.message);
          throw accErr;
        }
      }

      const levelRecord = {
        level: currentLevel,
        durationMs: Date.now() - startTime,
        videoMeta,
        acceptance,
        timestamp: new Date().toISOString()
      };

      const existingIdx = reports.findIndex(r => r.level === currentLevel);
      if (existingIdx >= 0) {
        reports[existingIdx] = levelRecord;
      } else {
        reports.push(levelRecord);
      }
      reports.sort((a, b) => a.level - b.level);

      if (record) {
        await writeFile(
          path.join(dataBatchDir, 'checkpoint.json'),
          JSON.stringify({ lastCompletedLevel: currentLevel, timestamp: new Date().toISOString() }, null, 2)
        );
        await writeFile(
          path.join(dataBatchDir, 'report.json'),
          JSON.stringify({ batchName, completedLevels: reports, levels: reports }, null, 2)
        );
      }
      await cleanupStray();

      // If reached endLevel, break
      if (endLevel > 0 && currentLevel >= endLevel) {
        console.log(`[Runner] Target level ${endLevel} completed!`);
        break;
      }

      // Next Level Transition
      const targetNextLevel = currentLevel + 1;

      // Pre-warm video recorder for next level during transition
      if (record && recorder && (endLevel <= 0 || targetNextLevel <= endLevel)) {
        console.log(`[Recorder] Pre-warming video recorder for Level ${targetNextLevel}...`);
        await recorder.prepare(targetNextLevel);
        preparedLevel = targetNextLevel;
        console.log(`[Recorder] Level ${targetNextLevel} pre-warm complete!`);
      }

      console.log(`[Transition] Advancing to Level ${targetNextLevel}...`);
      await game.advanceLevel();
      await game.waitForReady();

      currentLevel = targetNextLevel;
    }
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    if (record) {
      await writeFile(
        path.join(dataBatchDir, 'report.json'),
        JSON.stringify({
          batchName,
          status: 'finished',
          startLevel,
          endLevel,
          totalCompleted: reports.length,
          completedLevels: reports,
          levels: reports
        }, null, 2)
      );
    }
    await game.close();
    console.log(`[Runner] Closed game session.`);
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
    try { logStream.end(); } catch {}
  }

  return { batchName, reports };
}
