import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkVideoTools, createVideoRecorder, recordingDirectory } from '../src/game-video-recorder.mjs';

const archive = process.argv[2];
const maxLevel = Number(process.argv[3] || 1);
const startLevel = Number(process.argv[4] || 1);
const record = process.argv.includes('--record');
const repairLayouts = process.argv.includes('--repair-layouts');
const humanPace = process.argv.includes('--human-pace');
const slowBall = process.argv.includes('--slow-ball');
const nativeTiktok = process.argv.includes('--native-tiktok');
const videoDirIndex = process.argv.indexOf('--video-dir');
const videoDirectory = videoDirIndex >= 0 ? process.argv[videoDirIndex + 1] : recordingDirectory(path.join(archive || '.', 'scripts'));
if (!archive || !Number.isInteger(maxLevel) || !Number.isInteger(startLevel) || startLevel < 1 || maxLevel < startLevel) {
  throw new Error('Usage: node scripts/maze-runner.mjs <archive> [max-level] [start-level]');
}
const internal = path.resolve(archive, 'scripts/internal');
const { plan } = await import(pathToFileURL(path.join(internal, 'strategy.mjs')).href);
const { snapshot } = await import(pathToFileURL(path.join(internal, 'adapter.mjs')).href);
const game = await import(pathToFileURL(path.join(internal, 'game.mjs')).href);
const { openGame } = game;
const logDirectory = path.join(archive, 'scripts', 'logs');
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const resultFile = path.join(logDirectory, `play-${runStamp}.jsonl`);
function humanDelay(level, moveIndex) {
  let seed = (Math.imul(level, 0x9e3779b1) ^ Math.imul(moveIndex + 1, 0x85ebca6b)) >>> 0;
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x7feb352d) >>> 0;
  seed ^= seed >>> 15;
  seed >>>= 0;
  if (moveIndex === 0) return 750 + seed % 351;
  return 240 + seed % 261 + (seed % 11 === 0 ? 280 + (seed >>> 8) % 221 : 0);
}
await mkdir(logDirectory, { recursive: true });
if (record) await checkVideoTools();

const { page, close } = await openGame({ record, repairLayouts });
let recorder;
let stop = false;
process.on('SIGINT', () => { stop = true; });
process.on('SIGTERM', () => { stop = true; });
try {
  const missingLayout = await page.evaluate(lastLevel => {
    const layouts = window.c3_runtimeInterface._GetLocalRuntime()._layoutManager;
    for (let level = 1; level <= lastLevel; level++) {
      if (!layouts.GetLayoutByName(`L${level}`)) return level;
    }
    return null;
  }, maxLevel);
  if (missingLayout) throw new Error(`Archive has no native L${missingLayout} layout; requested through L${maxLevel}`);
  await page.evaluate(() => {
    window.__mazeWins = [];
    setInterval(() => {
      const r = window.c3_runtimeInterface?._GetLocalRuntime?.();
      const layout = r?._layoutManager?._mainRunningLayout?.GetName?.();
      if (!/^L\d+$/i.test(layout || '') || window.__mazeWins.some(x => x.layout === layout)) return;
      const vars = Object.fromEntries(r._eventSheetManager._allGlobalVars.map(x => [x.GetName(), x.GetValue()]));
      if (vars.WIN === 1 && vars.CUBE_START > 0 && vars.CUBE_END === vars.CUBE_START) {
        window.__mazeWins.push({ layout, level: vars.LEVELS, painted: vars.CUBE_END, total: vars.CUBE_START, at: Date.now() });
      }
    }, 50);
  });
  if (startLevel > 1) {
    await page.evaluate(level => {
      const runtime = window.c3_runtimeInterface._GetLocalRuntime();
      const layouts = runtime._layoutManager;
      const target = layouts.GetLayoutByName(`L${level}`);
      if (!target) throw new Error(`No native layout L${level}`);
      const levelVar = runtime._eventSheetManager._allGlobalVars.find(x => x.GetName() === 'LEVELS');
      levelVar.SetValue(level);
      layouts.ChangeMainLayout(target);
    }, startLevel);
    await page.waitForFunction(level => window.c3_runtimeInterface?._GetLocalRuntime?.()?._layoutManager?._mainRunningLayout?.GetName?.() === `L${level}`, startLevel, { timeout: 10_000 });
  }
  if (record) {
    recorder = await createVideoRecorder(page, { directory: videoDirectory, fps: 60, captureEveryFrame: true });
  }
  let completed = 0;
  for (let level = startLevel; level <= maxLevel && !stop; level++) {
    await page.waitForFunction(expected => {
      const r = window.c3_runtimeInterface?._GetLocalRuntime?.();
      const layout = r?._layoutManager?._mainRunningLayout?.GetName?.();
      const vars = Object.fromEntries(r?._eventSheetManager?._allGlobalVars?.map(x => [x.GetName(), x.GetValue()]) || []);
      return layout === `L${expected}` && vars.LEVELS === expected && vars.WIN === 0;
    }, level, { timeout: 12_000 });
    const before = await snapshot(page);
    console.log('LEVEL', level, before.layout, 'cubes', before.cubes.length, 'ball', before.ball, 'vars', {LEVELS:before.variables.LEVELS,CUBE_END:before.variables.CUBE_END});
    let route;
    try { route = plan(before); }
    catch (error) {
      await page.screenshot({ path: path.join(logDirectory, `failed-level-${level}.png`) });
      await writeFile(path.join(logDirectory, `failed-level-${level}.json`), JSON.stringify(before, null, 2));
      const geometry = await page.evaluate(() => {
        const classes = window.c3_runtimeInterface?._GetLocalRuntime?.()?._objectClassesByName;
        const shapes = classes?.get('3dshape')?.GetInstances?.().filter(item => item._IsSolidEnabled?.()) || [];
        const solidCells = new Set(shapes.map(item => `${item.GetWorldInfo().GetX()},${item.GetWorldInfo().GetY()}`));
        const cubes = classes?.get('cube')?.GetInstances?.() || [];
        return {
          solidShapes: shapes.length,
          cubesInsideSolid: cubes.filter(item => solidCells.has(`${item.GetWorldInfo().GetX()},${item.GetWorldInfo().GetY()}`))
            .map(item => ({ x: item.GetWorldInfo().GetX(), y: item.GetWorldInfo().GetY(), frame: item._sdkInst?._currentFrameIndex }))
        };
      }).catch(() => null);
      if (geometry) await writeFile(path.join(logDirectory, `failed-level-${level}-geometry.json`), JSON.stringify(geometry, null, 2));
      throw error;
    }
    let decisionDelay = 0;
    let speedOptions = null;
    if (nativeTiktok) {
      speedOptions = { gravityScale: 0.2, maxFallSpeed: 900 };
      decisionDelay = '140–260ms';
    }
    const ballSpeed = nativeTiktok || slowBall ? await game.configureBallSpeed?.(page, speedOptions || undefined) : null;
    if ((nativeTiktok || slowBall) && !ballSpeed) throw new Error(`Ball speed control is unavailable for level ${level}`);
    if (nativeTiktok) console.log('NATIVE SPEED', level, { ...ballSpeed, decisionDelay });
    console.log('PLAN', route.moves.map(x => x.key.replace('Arrow', '')).join(' '), 'states', route.explored);
    if (recorder) {
      await recorder.prepare(level);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      console.log('RECORD START', level, await recorder.start(level));
      if (nativeTiktok) await page.waitForTimeout(450);
    }
    const executedMoves = [];
    const decisionPauses = [];
    let idleInputs = 0;
    while (executedMoves.length < 500 && !stop) {
      if (await page.evaluate(expected => window.__mazeWins.some(x => x.level === expected && x.layout === `L${expected}`), level)) break;
      if (humanPace || nativeTiktok) {
        const delay = nativeTiktok ? 140 + humanDelay(level, executedMoves.length) % 121 : humanDelay(level, executedMoves.length);
        await page.waitForTimeout(delay);
        decisionPauses.push(delay);
      }
      const state = await snapshot(page);
      const won = await page.evaluate(expected => window.__mazeWins.find(x => x.level === expected && x.layout === `L${expected}`) || null, level);
      if (won) break;
      if (state.layout !== `L${level}`) throw new Error(`Level ${level} changed to ${state.layout} without recorded win`);
      if (!route.moves.length) route = plan(state);
      const move = route.moves.shift();
      if (!move) throw new Error(`No remaining moves for level ${level}`);
      await page.evaluate(() => { window.__ballWait = null; });
      await page.keyboard.press(move.key);
      await page.waitForFunction(({ x, y }) => {
        const r = window.c3_runtimeInterface?._GetLocalRuntime?.();
        const b = r?._objectClassesByName?.get('ball')?.GetInstances?.()[0];
        if (!b) return true;
        const bx = b.GetWorldInfo().GetX(), by = b.GetWorldInfo().GetY(), now = performance.now();
        if (Math.abs(bx - x) < 1 && Math.abs(by - y) < 1) return true;
        const last = window.__ballWait;
        if (!last || Math.abs(last.x - bx) > 0.1 || Math.abs(last.y - by) > 0.1) {
          window.__ballWait = { x: bx, y: by, since: now };
          return false;
        }
        return now - last.since > 250;
      }, move.end, { timeout: nativeTiktok ? 15_000 : 3000 }).catch(() => {});
      await page.waitForTimeout(100);
      const current = await snapshot(page);
      executedMoves.push(move.key);
      console.log('MOVE', executedMoves.length, move.key, current.ball, current.variables.CUBE_END, current.variables.WIN, current.layout);
      if (await page.evaluate(expected => window.__mazeWins.some(x => x.level === expected && x.layout === `L${expected}`), level)) break;
      const arrived = !current.ball || (Math.abs(current.ball.x - move.end.x) < 1 && Math.abs(current.ball.y - move.end.y) < 1);
      if (!arrived) {
        const changed = current.ball && (Math.abs(current.ball.x - state.ball.x) > 1 || Math.abs(current.ball.y - state.ball.y) > 1 || current.variables.CUBE_END > state.variables.CUBE_END);
        idleInputs = changed ? 0 : idleInputs + 1;
        console.log('REPLAN', level, 'expected', move.end, 'actual', current.ball, 'idle', idleInputs);
        if (idleInputs >= 3) {
          await page.screenshot({ path: path.join(logDirectory, `failed-level-${level}-move-${executedMoves.length}.png`) });
          await writeFile(path.join(logDirectory, `failed-level-${level}-move-${executedMoves.length}.json`), JSON.stringify({ expected: move, actual: current }, null, 2));
          throw new Error(`No progress after 3 inputs on level ${level}`);
        }
        route = changed ? plan(current) : { moves: [move, ...route.moves] };
      } else {
        idleInputs = 0;
      }
    }
    if (stop) break;
    if (executedMoves.length >= 500) throw new Error(`Move limit reached on level ${level}`);
    const win = await page.evaluate(expected => window.__mazeWins.find(x => x.level === expected && x.layout === `L${expected}`) || null, level);
    if (!win) throw new Error(`Level ${level} did not reach native win state`);
    if (recorder) await page.waitForTimeout(120);
    const video = recorder ? await recorder.finish() : null;
    console.log('RESULT', level, win.layout, win.painted, '/', win.total, 'WIN 1');
    await appendFile(resultFile, JSON.stringify({ level, layout: win.layout, cubes: win.total, painted: win.painted, win: 1, repairedLayout: repairLayouts && game.repairedLevels?.includes(level) || false, pace: nativeTiktok ? 'natural-v2' : humanPace ? 'human-v1' : 'fast', ballSpeed, decisionPauses, moves: executedMoves, video, finishedAt: new Date().toISOString() }) + '\n');
    completed++;
    if (level < maxLevel) {
      await page.waitForFunction(nextLevel => {
        const r = window.c3_runtimeInterface?._GetLocalRuntime?.();
        const next = r?._layoutManager?._mainRunningLayout?.GetName?.();
        return next === `L${nextLevel}`;
      }, level + 1, { timeout: 15_000 }).catch(async error => {
        const current = await snapshot(page);
        await page.screenshot({ path: path.join(logDirectory, `failed-next-${level}.png`) });
        await writeFile(path.join(logDirectory, `failed-next-${level}.json`), JSON.stringify(current, null, 2));
        throw error;
      });
    }
  }
  await writeFile(path.join(logDirectory, 'latest-success.json'), JSON.stringify({ archive, startLevel, maxLevel, resultFile, completed, stopped: stop, videoDirectory: record ? videoDirectory : null, finishedAt: new Date().toISOString() }, null, 2));
  console.log(stop ? 'STOPPED' : 'SUCCESS', completed, resultFile);
} finally {
  if (recorder?.active) await recorder.finish({ partial: true });
  await close();
}

