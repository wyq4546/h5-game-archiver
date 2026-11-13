import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeCapturedGame } from '../src/source-analysis.mjs';

const tilo = 'download/Tilo-20261011-024029/game/tilo.game-files.crazygames.com/tilo/5';
const maze = 'download/Color-Maze-Puzzle-20260923-044000/game/html5.gamedistribution.com/rvvASMiM/8c3b1e9c2ab840028f4cbdeccf1df7ab';

async function fixture(t, source = tilo, runtime = 'c2runtime.js') {
  const tmp = path.resolve('.tmp');
  await mkdir(tmp, { recursive: true });
  const root = await mkdtemp(path.join(tmp, 'construct-analysis-'));
  t.after(async () => {
    assert.equal(path.dirname(root), tmp);
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  await mkdir(path.join(root, 'game/native.example/scripts'), { recursive: true });
  await copyFile(path.join(source, runtime), path.join(root, 'game/native.example', runtime));
  const data = runtime === 'c2runtime.js' ? 'data.js' : 'data.json';
  await copyFile(path.join(source, data), path.join(root, 'game/native.example', data));
  return { root, manifest: { gameUrl: 'https://native.example/index.html' } };
}

function blocks(events) {
  return events.flatMap(event => [event, ...blocks(event.children || [])]);
}

// These expectations come from the shipped Tilo model and its loader, not from a simulated game.
test('Construct analysis decodes the shipped Tilo object, layout and event tables', async t => {
  const { root, manifest } = await fixture(t);
  const report = await analyzeCapturedGame(root, manifest);
  assert.equal(report.construct?.status, 'decoded');
  assert.equal(report.construct.format, 'construct2-export');
  assert.equal(report.construct.counts.objectTypes, 212);
  assert.equal(report.construct.counts.layouts, 48);
  assert.equal(report.construct.counts.numericLayouts, 41);
  assert.equal(report.construct.counts.conditions, 235);
  assert.equal(report.construct.counts.actions, 357);
  const model = JSON.parse(await readFile(path.join(root, 'analysis/construct/project.json'), 'utf8'));
  assert.equal(model.objects[42].name, 'Player');
  assert.equal(model.objects[205].name, 'Enemies');
  assert.equal(model.objects[205].members.length, 28);
  const gameplay = blocks(model.eventSheets.find(s => s.name === 'Gameplay').events);
  const jump = gameplay.find(e => e.conditions?.some(c => c.method.endsWith('.OnCollision') && c.parameters[0]?.object?.index === 122));
  assert.equal(jump.conditions[0].object.name, 'Player');
  assert.equal(jump.actions[0].method, 'cr.behaviors.Platform.prototype.acts.SetJumpStrength');
  assert.equal(jump.actions[0].parameters[0].text, '1250');
  assert.equal(jump.actions[1].method, 'cr.behaviors.Platform.prototype.acts.SimulateControl');
  assert.match(jump.sourcePath, /^\/project\/6\/0\/1\//);
  assert.deepEqual(jump.raw[6][0][9][0], [4, 122]);
  const firstPlayer = model.layouts.find(l => l.name === '1').layers.flatMap(l => l.instances).find(i => i.object.index === 42);
  assert.equal(firstPlayer.world.x, -87);
  assert.equal(firstPlayer.behaviors.find(b => b.name === 'Platform').properties[3], 650);
  const readable = await readFile(path.join(root, 'analysis/construct/events.md'), 'utf8');
  assert.match(readable, /Player\.Platform\.SetJumpStrength\(1250\)/);
  assert.doesNotMatch(report.limitations, /Unity|IL2CPP/);
  assert.doesNotMatch(await readFile(path.join(root, 'analysis/README.md'), 'utf8'), /il2cpp\/dump\.cs|bot\/runtime\.mjs/);
});

test('missing Construct project data is partial rather than a completed decompilation', async t => {
  const { root, manifest } = await fixture(t);
  await rm(path.join(root, 'game/native.example/data.js'));
  const report = await analyzeCapturedGame(root, manifest);
  assert.equal(report.construct?.status, 'partial');
  assert.ok(report.construct.warnings.some(w => /data\.js|项目数据/.test(w.message)));
});

test('unknown expression opcodes preserve the original data and prevent a decoded status', async t => {
  const { root, manifest } = await fixture(t);
  const dataPath = path.join(root, 'game/native.example/data.js');
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  data.project[6][0][1].push([0, 0, false, null, 123456, 999, [], [[42, 94, 'Platform', 654321, 0, null, [[0, [999, 'unrecognised']]]]]]);
  await writeFile(dataPath, JSON.stringify(data));
  const report = await analyzeCapturedGame(root, manifest);
  assert.equal(report.construct?.status, 'partial');
  assert.ok(report.construct.warnings.some(w => w.kind === 'expression' && w.raw[0] === 999));
  const model = JSON.parse(await readFile(path.join(root, 'analysis/construct/project.json'), 'utf8'));
  assert.deepEqual(model.eventSheets[0].events.at(-1).actions[0].parameters[0].raw, [0, [999, 'unrecognised']]);
});

test('Construct 3 uses its own layout offsets and retains compiled expression functions', async t => {
  const { root, manifest } = await fixture(t, maze, 'scripts/c3runtime.js');
  const report = await analyzeCapturedGame(root, manifest);
  assert.equal(report.construct?.format, 'construct3-export');
  const model = JSON.parse(await readFile(path.join(root, 'analysis/construct/project.json'), 'utf8'));
  assert.equal(model.layouts[0].name, 'loading');
  assert.equal(model.layouts[0].eventSheet, 'e-loading');
  assert.equal(model.layouts[0].layers[0].name, 'logo');
  assert.equal(model.layouts[0].layers[0].instances[0].object.name, 'logo');
  assert.ok(model.expressionFunctions.some(f => f.source.includes('640')));
  assert.ok(report.construct.counts.conditions > 0);
});

test('an unrecognised event sheet shape produces a partial report instead of crashing analysis', async t => {
  const { root, manifest } = await fixture(t);
  const dataPath = path.join(root, 'game/native.example/data.js');
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  data.project[6][0][1] = { incompatible: 'event model' };
  await writeFile(dataPath, JSON.stringify(data));
  const report = await analyzeCapturedGame(root, manifest);
  assert.equal(report.construct?.status, 'partial');
  assert.ok(report.construct.warnings.some(w => w.kind === 'schema'));
});

test('C3 split reference and expression files stay paired with their native release', async t => {
  const source='download/Brick-Breaker-Chipi-Chipi-Chapa-Cat-And-Bara-Bere-20261025-013824/game/app-286727.games.s3.yandex.net/286727/8f5pjjlskybibjmr22jh1u16p2yr52b3_brotli';
  const {root,manifest}=await fixture(t,source,'scripts/c3runtime.js');
  await copyFile(path.join(source,'scripts/objRefTable.js'),path.join(root,'game/native.example/scripts/objRefTable.js'));
  // A different release must not supply an expression table for this project.
  await mkdir(path.join(root,'game/unrelated.example/scripts'),{recursive:true});
  await writeFile(path.join(root,'game/unrelated.example/scripts/c3runtime.js'),'self.C3_ExpressionFuncs = [()=>"WRONG_RELEASE"];');
  const report=await analyzeCapturedGame(root,manifest);
  assert.equal(report.construct.status,'decoded');
  assert.equal(report.construct.counts.layouts,43);
  assert.equal(report.construct.warnings.length,0);
  const model=JSON.parse(await readFile(path.join(root,'analysis/construct/project.json'),'utf8'));
  assert.ok(model.expressionFunctions.length>100);
  assert.ok(model.expressionFunctions.every(f=>!f.source?.includes('WRONG_RELEASE')));
  assert.ok(model.sources.some(s=>s.file.endsWith('/scripts/c3runtime.js')));
  assert.ok(model.sources.some(s=>s.file.endsWith('/scripts/objRefTable.js')));
});

test('Construct table extraction never invokes the publisher reference-table function', async t => {
  const { root, manifest } = await fixture(t);
  const runtime = path.join(root, 'game/native.example/c2runtime.js');
  const code = await readFile(runtime, 'utf8');
  await writeFile(runtime, code.replace('cr.getObjectRefTable = function () {', 'cr.getObjectRefTable = function () { throw new Error("publisher code was executed");'));
  const report = await analyzeCapturedGame(root, manifest);
  assert.equal(report.construct?.status, 'decoded');
  assert.equal(report.construct.counts.objectReferences, 156);
});
