import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkVideoTools, createVideoRecorder, recordingDirectory } from '../src/game-video-recorder.mjs';

const archive = process.argv[2] || 'download/Maze-Paint-3D-20260923-044500';
const maxLevel = Number(process.argv[3] || 1);
const startLevel = Number(process.argv[4] || 1);
const record = process.argv.includes('--record');
const nativeTiktok = process.argv.includes('--native-tiktok');
const videoDirIndex = process.argv.indexOf('--video-dir');
const videoDirectory = videoDirIndex >= 0 ? process.argv[videoDirIndex + 1] : recordingDirectory(path.join(archive, 'scripts'));
if (!Number.isInteger(maxLevel) || !Number.isInteger(startLevel) || startLevel < 1 || maxLevel < startLevel) throw new Error('Invalid level range');
if (record) await checkVideoTools();
const internal = path.resolve(archive, 'scripts/internal');
const { plan } = await import(pathToFileURL(path.join(internal, 'strategy.mjs')).href);
const { snapshot, hideVictoryText, hideTutorialOverlay } = await import(pathToFileURL(path.join(internal, 'adapter.mjs')).href);
const { openGame } = await import(pathToFileURL(path.join(internal, 'game.mjs')).href);
const logDirectory = path.join(archive, 'scripts/logs');
await mkdir(logDirectory, { recursive: true });
const resultFile = path.join(logDirectory, `play-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);

const { page, close } = await openGame({ record, root: archive });
let recorder;
let stop = false;
process.on('SIGINT', () => { stop = true; });
process.on('SIGTERM', () => { stop = true; });
try {
  if (record) {
    console.log('VICTORY TEXT HIDDEN', await hideVictoryText(page));
    if (nativeTiktok) console.log('TUTORIAL OVERLAY HIDDEN', await hideTutorialOverlay(page));
    recorder = await createVideoRecorder(page, { directory: videoDirectory, fps: 60, captureEveryFrame: true });
  }
  let completed = 0;
  let recorded = 0;
  for (let level = 1; level <= maxLevel && !stop; level++) {
    let state = await snapshot(page);
    if (!state || state.level !== level) throw new Error(`Expected level ${level}, got ${state?.level}`);
    let playerSpeed = null;
    let decisionDelay = 0;
    if (nativeTiktok) {
      const route = plan(state).moves;
      const cells = route.reduce((sum, move, index) => {
        const prior = index ? route[index - 1].end : state.player;
        return sum + Math.abs(move.end.x - prior.x) + Math.abs(move.end.y - prior.y);
      }, 0);
      playerSpeed = Math.max(3, Math.min(20, cells / 3));
      decisionDelay = 180;
      await page.evaluate(speed => {
        const b = window.__mazeBridge;
        const controller = b.findObjects('PlayerController', 'Assembly-CSharp').find(b.activeComponent);
        if (!controller) throw new Error('PlayerController missing');
        b.writeFloat(controller + b.field('PlayerController', 'playerSpeed'), speed);
      }, playerSpeed);
      console.log('NATIVE SPEED', level, { cells, moves: route.length, playerSpeed, decisionDelay });
    }
    console.log('LEVEL', level, 'free', state.total, 'painted', state.painted, 'player', state.player);
    if (recorder && level >= startLevel) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      console.log('RECORD START', level, await recorder.start(level));
      if (nativeTiktok) await page.waitForTimeout(450);
    }
    const inputs = [];
    while (state && !state.win && inputs.length < 400 && !stop) {
      const route = plan(state);
      const move = route.moves[0];
      if (!move) throw new Error(`No next move at level ${level}`);
      const prior = state.player;
      if (nativeTiktok) await page.waitForTimeout(decisionDelay);
      await page.keyboard.press(move.key);
      await page.waitForFunction(({ x, y }) => {
        const b = window.__mazeBridge, p = b.findObjects('Player', 'Assembly-CSharp').find(b.activeComponent), c = b.findObjects('PlayerController', 'Assembly-CSharp').find(b.activeComponent);
        if (!p || !c) return false;
        const tile = b.readPointer(p + b.field('Player', '_currentTile'));
        return tile && !b.invoke('PlayerController$$get_IsMoving', c) && (b.invoke('Tile$$get_X', tile) !== x || b.invoke('Tile$$get_Y', tile) !== y);
      }, prior, { timeout: nativeTiktok ? 30_000 : 7000 }).catch(() => {});
      await page.waitForTimeout(200);
      state = await snapshot(page);
      inputs.push(move.key);
      console.log('MOVE', inputs.length, move.key, state?.player, state?.painted, '/', state?.total, 'win', state?.win);
      if (!state || (state.player.x === prior.x && state.player.y === prior.y && !state.win)) {
        if (inputs.length >= 3 && inputs.slice(-3).every(x => x === move.key)) throw new Error(`No movement after 3 ${move.key} inputs`);
      }
    }
    if (stop) break;
    if (!state?.win) throw new Error(`Level ${level} did not win after ${inputs.length} inputs`);
    if (recorder?.active) await page.waitForTimeout(120);
    const video = recorder?.active ? await recorder.finish() : null;
    console.log('RESULT', level, state.painted, '/', state.total, 'WIN');
    await appendFile(resultFile, JSON.stringify({ level, painted: state.painted, total: state.total, inputs, playerSpeed, decisionDelay, pace: nativeTiktok ? 'natural-v2' : 'fast', video, finishedAt: new Date().toISOString() }) + '\n');
    completed++;
    if (video) recorded++;
    if (level < maxLevel) {
      await page.waitForTimeout(900);
      await page.mouse.click(225, 670);
      await page.waitForFunction(previous => {
        const b = window.__mazeBridge;
        const world = b.findObjects('WorldManager', 'Assembly-CSharp').find(b.activeComponent);
        return world && b.invoke('WorldManager$$get_CurrentLevelNumHuman', world) > previous;
      }, level, { timeout: 15_000 });
      if (record) await hideVictoryText(page);
    }
  }
  await writeFile(path.join(logDirectory, 'latest-success.json'), JSON.stringify({ completed, recorded, startLevel, resultFile, stopped: stop, videoDirectory: record ? videoDirectory : null, finishedAt: new Date().toISOString() }, null, 2));
} finally {
  if (recorder?.active) await recorder.finish({ partial: true });
  await close();
}

