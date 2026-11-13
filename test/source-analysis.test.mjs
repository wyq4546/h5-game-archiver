import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync,deflateSync } from 'node:zlib';
import {inlineGameBuilds} from '../src/inline-builds.mjs';
import {PNG} from 'pngjs';
import { detectEngine, inspectCapturedRuntime, classifySourceFile } from '../src/source-analysis.mjs';

test('compressed single HTML Pixi game is complete without separate JS requests; corrupt payload and SDK mentions are not', async t=>{
 const code='var PIXI=function(){return {}}();var renderer=canvas.getContext("webgl");function Game(options){PIXI.autoDetectRenderer(options)}var App=new Game({Engine:"Pixi"});';
 const png=PNG.sync.write(new PNG({width:1,height:1}));
 const document=payload=>'<img src="data:image/png;base64,'+png.toString('base64')+'"><script>Settings='+JSON.stringify({'game-code-pako':payload})+'</script>';
 const html=document(deflateSync(code).toString('latin1'));
 assert.equal(inlineGameBuilds(html)[0].code,code);
 const root=await archiveFixture(t,{'game/native.example/index.html':html});
 const manifest={gameUrl:'https://native.example/index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'}};
 const result=await inspectCapturedRuntime(root,manifest);
 assert.equal(result.engine,'PixiJS');assert.equal(result.coreReady,true);assert.deepEqual(result.coreFiles,['game/native.example/index.html']);
 await writeFile(path.join(root,'game/native.example/index.html'),document('not a zlib stream'));
 assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
 await writeFile(path.join(root,'game/native.example/index.html'),document(deflateSync('var PIXI=function(){return {}}();').toString('latin1')));
 assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
 assert.equal(inlineGameBuilds('<script>globalThis.shouldNotRun=true;</script>').length,0);
});

test('generic Emscripten validates declared WASM and package rather than requiring Unity or Fancade files', async t => {
  const loader = 'var wasmBinaryFile="index.wasm";instantiateAsync();var REMOTE_PACKAGE_BASE="index.data";loadPackage({files:[{filename:"/assets/level.json",start:0,end:2}],remote_package_size:2});';
  const root = await archiveFixture(t, {
    'game/native.example/index.html':'<script src="index.js"></script>',
    'game/native.example/index.js':loader,
    'game/native.example/index.wasm':Buffer.from([0,97,115,109,1,0,0,0]),
    'game/native.example/index.data':'{}'
  });
  const manifest={gameUrl:'https://native.example/index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'}};
  const result=await inspectCapturedRuntime(root,manifest);
  assert.equal(result.engine,'Emscripten');
  assert.equal(result.coreReady,true);
  assert.equal(result.coreFiles.length,3);
  await writeFile(path.join(root,'game/native.example/index.data'),'truncated');
  assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
  await writeFile(path.join(root,'game/native.example/index.data'),'{}');
  await writeFile(path.join(root,'game/native.example/index.wasm'),Buffer.from([0,97,115,109,255,0,0,0]));
  assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
  await rm(path.join(root,'game/native.example/index.wasm'));
  assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
});

test('SDK parent documents are site wrappers rather than game source files', () => {
  const manifest = { gameUrl: 'https://game.example/build/index.html', finalUrl: 'https://playhop.com/zh/app/454453', sourceUrl: 'https://playhop.com/zh/app/454453', platform: { mode: 'iframe' } };
  assert.equal(classifySourceFile('game/playhop.com/portal.js', manifest), 'site-wrapper');
  assert.equal(classifySourceFile('game/game.example/build/main.js', manifest), 'game');
});

test('advertising scripts stay noise even if runtime detection listed them as core files',()=>{
 const file='game/fundingchoicesmessages.google.com/ad/Index.js';
 assert.equal(classifySourceFile(file,{runtimeInspection:{coreFiles:[file]},gameUrl:'https://fundingchoicesmessages.google.com/index.html'}),'noise');
});

async function archiveFixture(t, files) {
  const temporaryRoot = path.resolve('.tmp');
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(path.join(temporaryRoot, 'runtime-inspection-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), temporaryRoot);
    await rm(root, { recursive: true, force: true });
  });
  for (const [relative, body] of Object.entries(files)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  return root;
}

test('native game inspection excludes a captured portal engine runtime and compatibility catalog', async t => {
  const root = await archiveFixture(t, {
    'game/native.example/index.html': '<script src="custom.js"></script>',
    'game/native.example/custom.js': 'drawCustomGame();',
    'game/portal.example/scripts/c3runtime.js': '// Generated by Construct',
    'game/builds.portal.example/catalog.js': 'const sdk="Construct3CrazySDK-v3.js";',
  });
  const manifest = {gameUrl:'https://native.example/index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'}};
  await mkdir(path.join(root,'archive'));
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify(manifest));
  assert.match((await inspectCapturedRuntime(root,manifest)).engine, /^Unknown/);
  assert.match((await inspectCapturedRuntime(root)).engine, /^Unknown/);
});

test('native inspection retains an explicitly loaded runtime on an external CDN', async t => {
  const root = await archiveFixture(t, {
    'game/native.example/index.html': '<script src="https://cdn.example/cocos2d-js.js"></script><script src="main.123.js"></script>',
    'game/native.example/main.123.js': 'cc.game.run();',
    'game/cdn.example/cocos2d-js.js': 'var cc={};',
    'game/portal.example/scripts/c3runtime.js': '// Generated by Construct',
  });
  const runtime = await inspectCapturedRuntime(root,{gameUrl:'https://native.example/index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'}});
  assert.equal(runtime.engine,'Cocos Creator');
  assert.equal(runtime.coreReady,true);
  assert.ok(runtime.coreFiles.includes('game/cdn.example/cocos2d-js.js'));
});

test('legacy archives naming a CrazyGames SDK shell retain their actual external publisher build',async t=>{
  const root=await archiveFixture(t,{
    'game/games.crazygames.com/index.html':'<script src="sdk.js"></script>',
    'game/external.example/game-v1.508.js':'cc.game.run();',
    'game/external.example/cocoslib-3_17_2.js':'var cc={};',
  });
  assert.equal((await inspectCapturedRuntime(root,{gameUrl:'https://games.crazygames.com/index.html',sourceUrl:'https://www.crazygames.com/game/old',platform:{mode:'direct'}})).coreReady,true);
});

test('OpenFL Lime XHR releases require the embedded application and every declared valid pack', async t => {
  const entry = 'game/native.example/build/kajam22b.js';
  const pack = 'game/native.example/build/lib/default-version.pak';
  const second = 'game/native.example/build/lib/levels.pak';
  const bytes = Buffer.concat([Buffer.from('lime-asset-pack'),gzipSync(Buffer.from('packed game assets'))]);
  const root = await archiveFixture(t, {
    'game/native.example/build/index.html': 'lime.embed("kajam22b","openfl-content",640,360,{});',
    [entry]: 'lime.$scripts.kajam22b=function(){};var stage="openfl.display.Stage";const manifest={"libraryArgs":["lib/default.pak","gzip"],"libraryType":"lime.utils.PackedAssetLibrary"};',
    [pack]: bytes,
    'game/portal.example/catalog.js': 'const sdk="Construct3CrazySDK-v3.js";',
  });
  const manifest={gameUrl:'https://native.example/build/index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'},resources:[{saved:true,url:'https://native.example/build/lib/default.pak?1234',path:pack}]};
  const runtime=await inspectCapturedRuntime(root,manifest);
  assert.equal(runtime.engine,'OpenFL / Lime');
  assert.equal(runtime.coreReady,true);
  assert.ok(runtime.coreFiles.includes(entry));
  assert.ok(runtime.coreFiles.includes(pack));
  await writeFile(path.join(root,entry),'lime.$scripts.kajam22b=function(){};var stage="openfl.display.Stage";const a={"libraryArgs":["lib/default.pak","gzip"]};const b={"libraryArgs":["lib/levels.pak","gzip"]};');
  assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
  await writeFile(path.join(root,second),bytes);
  assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,true);
  await writeFile(path.join(root,pack),bytes.subarray(0,bytes.length-4));
  assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
  await writeFile(path.join(root,pack),bytes);
  await writeFile(path.join(root,entry),'lime.$scripts.otherApp=function(){};var stage="openfl.display.Stage";');
  assert.equal((await inspectCapturedRuntime(root,manifest)).coreReady,false);
});

const sdkCompatibilityText = 'var EngineType = { CocosCreator: "CocosCreator", LayaAir: "LayaAir" }; // cocos2d-js compatibility';

test('hashed Three.js modules require a nonempty game entry importing their runtime', async t => {
  const root = await archiveFixture(t, {
    'game/example/build/assets/three-runtime.js':'export class WebGLRenderer {}',
    'game/example/build/assets/index-game.js':'import {WebGLRenderer} from "./three-runtime.js";new WebGLRenderer();',
    'game/example/build/assets/pixi-ui.js':'export class Application {}',
  });
  const runtime=await inspectCapturedRuntime(root);
  assert.equal(runtime.engine,'Three.js');
  assert.equal(runtime.coreReady,true);
  assert.ok(runtime.coreFiles.includes('game/example/build/assets/index-game.js'));
  await writeFile(path.join(root,'game/example/build/assets/index-game.js'),'');
  assert.equal((await inspectCapturedRuntime(root)).coreReady,false);
});

test('a game importing Three.js is identified by its renderer rather than its Pixi UI library',async t=>{
  const root=await archiveFixture(t,{
    'game/native.example/assets/three-render.js':'export class WebGLRenderer {}',
    'game/native.example/assets/index-game.js':'import {WebGLRenderer} from "./three-render.js";import {Text} from "./pixi-ui.js";new WebGLRenderer();',
    'game/native.example/assets/pixi-ui.js':'const point="[pixi.js/math:Point]";const hook="__PIXI_RENDERER_INIT__";export class Text{}',
  });
  assert.equal((await inspectCapturedRuntime(root)).engine,'Three.js');
});

test('scoping retains all assets from an observed game CDN, including resources captured before iframe discovery',async t=>{
  const loader='game/files.example/Build/game.loader.js';
  const root=await archiveFixture(t,{
    'game/native.example/index.html':'<script>createUnityInstance();</script>',
    [loader]:'function createUnityInstance(){}',
    'game/files.example/Build/game.wasm':Buffer.from([0,97,115,109,1,0,0,0]),
    'game/portal.example/scripts/c3runtime.js':'// Generated by Construct',
  });
  const runtime=await inspectCapturedRuntime(root,{gameUrl:'https://native.example/index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'},resources:[{path:'game/files.example/Build/game.wasm',url:'https://files.example/Build/game.wasm',saved:true,gameResource:true}]});
  assert.equal(runtime.engine,'Unity WebGL');
  assert.equal(runtime.coreReady,true);
  assert.ok(runtime.coreFiles.includes(loader));
});

test('numbered Laya entries are actual game entries instead of borrowing a portal main.js',async t=>{
  const root=await archiveFixture(t,{
    'game/native.example/index.html':'<script src="index2.js"></script>',
    'game/native.example/index2.js':'loadLib("libs/laya.core.js");loadLib("js/bundle2.js");',
    'game/native.example/js/bundle2.js':'Laya3D.init();',
    'game/native.example/libs/laya.core.js':'var Laya={};',
    'game/portal.example/main.js':'runPortal();',
  });
  const runtime=await inspectCapturedRuntime(root,{gameUrl:'https://native.example/index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'}});
  assert.equal(runtime.engine,'LayaAir 3D');
  assert.equal(runtime.coreReady,true);
  assert.ok(runtime.coreFiles.includes('game/native.example/js/bundle2.js'));
  assert.ok(!runtime.coreFiles.includes('game/portal.example/main.js'));
});

test('generic WASM and data filenames do not establish Unity', () => {
  const detection = detectEngine([
    {relative:'game/example/webapp/index.wasm'}, {relative:'game/example/webapp/index.data'}
  ], 'var Module = {}; function loadPackage() {}');
  assert.match(detection.engine, /^Unknown/);
});

test('split PixiJS release builds require the declared WebGL renderer module', async t => {
  const root = await archiveFixture(t, {
    'game/play.example/assets/index-game.js': 'const point="[pixi.js/math:Point x=0 y=0]"; import("./WebGLRenderer-render.js");',
    'game/play.example/assets/WebGLRenderer-render.js': 'export class WebGLRenderer { createContext(canvas) { return canvas.getContext("webgl2"); } }',
    'game/portal.example/sdk.js': '// Generated by Construct compatibility',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'PixiJS');
  assert.equal(runtime.coreReady, true);
  assert.ok(runtime.coreFiles.includes('game/play.example/assets/index-game.js'));
  assert.ok(runtime.coreFiles.includes('game/play.example/assets/WebGLRenderer-render.js'));
  await rm(path.join(root,'game/play.example/assets/WebGLRenderer-render.js'));
  assert.equal((await inspectCapturedRuntime(root)).coreReady, false);
});

test('Fancade Emscripten builds require their own runtime, WASM and data instead of a Unity loader', async t => {
  const root = await archiveFixture(t, {
    'game/example/build/webapp/fancade.css':'#canvas {width:100%}',
    'game/example/build/webapp/source_min.js':'var Module={};',
    'game/example/build/webapp/index.js':'function loadPackage() {}',
    'game/example/build/webapp/index.wasm':Buffer.from([0,97,115,109,1,0,0,0]),
    'game/example/build/webapp/index.data':Buffer.from([1,2,3]),
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'Fancade / Emscripten');
  assert.equal(runtime.coreReady, true);
  assert.ok(runtime.coreFiles.includes('game/example/build/webapp/source_min.js'));
  await writeFile(path.join(root,'game/example/build/webapp/index.data'), Buffer.alloc(0));
  assert.equal((await inspectCapturedRuntime(root)).coreReady, false);
});

test('PlayCanvas stable builds with Ammo physics require the engine and game bootstrap', async t => {
  const root = await archiveFixture(t, {
    'game/example/pencil/playcanvas-stable.min.js': 'var pc={};',
    'game/example/pencil/__start__.js': 'bootstrap();',
    'game/example/pencil/__game-scripts.js': 'business();',
    'game/example/pencil/files/ammo.wasm.wasm': 'physics',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'PlayCanvas');
  assert.equal(runtime.coreReady, true);
  assert.ok(runtime.coreFiles.some(name => name.endsWith('__game-scripts.js')));
  const incomplete = await archiveFixture(t, { 'game/example/playcanvas-stable.min.js': 'var pc={};' });
  assert.equal((await inspectCapturedRuntime(incomplete)).coreReady, false);
});

test('obfuscated Laya libs/min builds are not misidentified by shared SDK Cocos references', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/coffee/index.js': 'loadLib("libs/min/laya.core.min.js"); loadLib("libs/min/laya.d3.min.js"); loadLib("js/bundle.js");',
    'game/cdn.example.com/coffee/libs/min/laya.core.min.js': 'var _0x1234 = {};',
    'game/cdn.example.com/coffee/libs/min/laya.d3.min.js': 'var _0x5678 = {};',
    'game/cdn.example.com/coffee/js/bundle.js': 'var _0x9012 = {};',
    'game/cdn.example.com/coffee/GA.js': sdkCompatibilityText,
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'LayaAir 3D');
  assert.equal(runtime.coreReady, true);
  assert.ok(runtime.coreFiles.includes('game/cdn.example.com/coffee/libs/min/laya.core.min.js'));
  assert.ok(runtime.coreFiles.includes('game/cdn.example.com/coffee/js/bundle.js'));
});

test('Laya libs/min recognition still requires a game entry before core readiness', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/coffee/libs/min/laya.core.min.js': 'var _0x1234 = {};',
    'game/cdn.example.com/coffee/libs/min/laya.d3.min.js': 'var _0x5678 = {};',
    'game/cdn.example.com/coffee/GA.js': sdkCompatibilityText,
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'LayaAir 3D');
  assert.equal(runtime.coreReady, false);
});

test('existing unminified Laya runtime paths remain recognized', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/game/libs/laya.core.js': 'var _0x1234 = {};',
    'game/cdn.example.com/game/libs/laya.d3.js': 'var _0x5678 = {};',
    'game/cdn.example.com/game/js/bundle.js': 'var _0x9012 = {};',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'LayaAir 3D');
  assert.equal(runtime.coreReady, true);
});

test('actual Cocos runtime and entry remain recognized', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/bubble/cocos2d-js-min.js': 'var cc = {};',
    'game/cdn.example.com/bubble/application.js': 'var CocosCreator = {};',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'Cocos Creator');
  assert.equal(runtime.coreReady, true);
});

test('versioned Cocos Creator entries such as main.351cd.js are recognized', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/animal/13/index.html': '<script src="main.351cd.js"></script>',
    'game/cdn.example.com/animal/13/cocos2d-js-min.d2799.js': 'var cc = {};',
    'game/cdn.example.com/animal/13/main.351cd.js': 'window.boot = function () { cc.game.run(); };',
    'game/cdn.example.com/animal/13/assets/main/index.a9410.js': 'window.__require = function () {};',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'Cocos Creator');
  assert.equal(runtime.coreReady, true);
  assert.ok(runtime.coreFiles.includes('game/cdn.example.com/animal/13/main.351cd.js'));
  assert.ok(runtime.coreFiles.includes('game/cdn.example.com/animal/13/assets/main/index.a9410.js'));
});

test('versioned Cocos runtime cannot borrow a portal entry on another host', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/animal/cocos2d-js-min.d2799.js': 'var cc = {};',
    'game/portal.example.com/main.351cd.js': 'window.portal = {};',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.coreReady, false);
  assert.deepEqual(runtime.coreFiles, ['game/cdn.example.com/animal/cocos2d-js-min.d2799.js']);
});

test('SDK text naming other runtime files cannot override installed Cocos files', () => {
  const detection = detectEngine([
    {relative:'game/cdn.example.com/bubble/cocos2d-js-min.js'},
    {relative:'game/cdn.example.com/bubble/application.js'},
  ], 'var CocosCreator = {}; // Supports libs/laya.core.js, libs/laya.d3.js and Phaser.Game');
  assert.equal(detection.engine, 'Cocos Creator');
});

test('SDK engine catalogs without runtime files leave the engine unknown', () => {
  const detection = detectEngine([
    {relative:'game/sdk.example.com/gameSDK/YYGGames.js'},
  ], 'var CocosCreator = {}; // cocos2d-js, libs/laya.core.js, libs/laya.d3.js, phaser.min.js');
  assert.equal(detection.engine, 'Unknown / insufficient runtime assets');
});

test('Construct SDK integration filenames alone do not establish a Construct game',()=>{
  assert.match(detectEngine([{relative:'game/builds.portal.example/catalog.js'}],'const supported="Construct3CrazySDK-v3.js";').engine,/^Unknown/);
});

for (const [engine, paths] of [
  ['Unity WebGL', ['Build/game.loader.js', 'Build/game.wasm', 'Build/game.data']],
  ['Construct', ['scripts/c3runtime.js']],
  ['PlayCanvas', ['playcanvas.min.js']],
  ['Phaser', ['phaser.min.js']],
]) {
  test(`installed ${engine} files outrank unrelated SDK API compatibility text`, () => {
    const detection = detectEngine(paths.map(relative => ({relative:`game/cdn.example.com/game/${relative}`})),
      'var CocosCreator = {}; // cc.director, Laya.Scene3D and Phaser.Game compatibility');
    assert.equal(detection.engine, engine);
  });
}

test('modern Construct 3 builds with c3main.js and Generated by Construct are recognized and coreReady', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/chicken/scripts/c3main.js': '// Generated by Construct\n// Visit: https://www.construct.net\nvar c3 = {};',
    'game/cdn.example.com/chicken/scripts/main.js': 'runMain();',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'Construct');
  assert.equal(runtime.coreReady, true);
  assert.ok(runtime.coreFiles.includes('game/cdn.example.com/chicken/scripts/c3main.js'));
});

test('two Cocos entry scripts without a runtime are still incomplete', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/bubble/index.js': 'var CocosCreator = {}; cc.director;',
    'game/cdn.example.com/bubble/application.js': 'var application = {};',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'Cocos Creator');
  assert.equal(runtime.coreReady, false);
});

test('multiple Cocos runtime files without a game entry are still incomplete', async t => {
  const root = await archiveFixture(t, {
    'game/cdn.example.com/bubble/cocos2d-js-min.js': 'var cc = {};',
    'game/cdn.example.com/bubble/cocos-js.js': 'var CocosCreator = {};',
  });
  const runtime = await inspectCapturedRuntime(root);
  assert.equal(runtime.engine, 'Cocos Creator');
  assert.equal(runtime.coreReady, false);
});
