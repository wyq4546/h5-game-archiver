import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { completeArchiveAssets } from '../src/asset-completer.mjs';
import { resourcePath } from '../src/utils.mjs';
import { deflateRawSync } from 'node:zlib';
import { fairyguiAssets, yygBinJsonEntries, yygBinScript } from '../src/fairygui-assets.mjs';
import { assessCompleteness } from '../src/capture.mjs';
import { createCipheriv } from 'node:crypto';

test('Vite root asset URLs include lazily used tutorial textures', async t => {
  const requests=[],server=http.createServer((req,res)=>{
    requests.push(req.url);
    if(req.url==='/assets/bounce_block-B9slGW3u.webp'){res.setHeader('content-type','image/webp');res.end(Buffer.from('RIFFtutorial-texture'));}
    else{res.statusCode=404;res.end('missing');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'h5-vite-assets-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  await mkdir(path.join(root,'game'),{recursive:true});
  const source='const textures={"../../../assets/bounce_block.webp":"/assets/bounce_block-B9slGW3u.webp"};';
  await writeFile(path.join(root,'game','index.js'),source);
  const manifest={gameUrl:origin+'/index.html',resources:[{url:origin+'/assets/index.js',path:'game/index.js',saved:true,bytes:source.length,type:'script',contentType:'application/javascript'}]};
  await completeArchiveAssets(root,manifest);
  assert.equal(manifest.resources.find(r=>r.url===origin+'/assets/bounce_block-B9slGW3u.webp')?.saved,true);
  assert.ok(requests.includes('/assets/bounce_block-B9slGW3u.webp'));
});

test('OpenFL progress loaders complete XHR entry scripts and declared packs, reusing captured cache-busted URLs', async t => {
  const requests=[],server=http.createServer((req,res)=>{
    requests.push(req.url);
    if(req.url==='/game/application.js'){res.setHeader('content-type','application/javascript');res.end('const manifest={"libraryArgs":["lib/default.pak","gzip"],"libraryType":"lime.utils.PackedAssetLibrary"};throw Error("never execute game");');}
    else if(req.url.startsWith('/game/lib/default.pak')){res.setHeader('content-type','application/octet-stream');res.end('lime-asset-pack:contents');}
    else {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const temp=path.resolve('.tmp');await mkdir(temp,{recursive:true});const root=await mkdtemp(path.join(temp,'openfl-completion-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(root),temp);await rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}/game/`;
  await writeFile(path.join(root,'index.html'),'var __filesToLoad={"./application.js":{total:123}};__loadWithProgress(__filesToLoad);lime.embed("application","openfl-content",640,360,{});');
  const manifest={gameUrl:base+'index.html',resources:[{url:base+'index.html',method:'GET',saved:true,status:200,path:'index.html'}]};
  const first=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(first.failedAssets,0);
  assert.ok(manifest.resources.find(r=>r.url===base+'application.js')?.saved);
  assert.ok(manifest.resources.find(r=>r.url===base+'lib/default.pak')?.saved);
  requests.length=0;
  const pack=manifest.resources.find(r=>r.url===base+'lib/default.pak');pack.url+='?1234';
  const second=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(second.failedAssets,0);
  assert.deepEqual(requests,[]);
  assert.equal(manifest.resources.filter(r=>r.url.includes('default.pak')).length,1);
});

test('HTML module entries complete their static and dynamic sibling imports without execution', async t => {
  const requests=[],server=http.createServer((req,res)=>{
    requests.push(req.url);
    if(req.url==='/game/assets/main.js'){res.setHeader('content-type','application/javascript');res.end('import {value} from "./required.js"; import("./later.js"); throw new Error("never execute publisher code");');}
    else if(req.url==='/game/assets/required.js'){res.setHeader('content-type','application/javascript');res.end('export const value=42;');}
    else if(req.url==='/game/assets/later.js'){res.setHeader('content-type','application/javascript');res.end('export const later=true;');}
    else {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const temporaryRoot=path.resolve('.tmp');await mkdir(temporaryRoot,{recursive:true});
  const root=await mkdtemp(path.join(temporaryRoot,'module-completion-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(root),temporaryRoot);await rm(root,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`,entry=origin+'/game/index.html';
  await writeFile(path.join(root,'index.html'),'<!-- <script src="vconsole.js"></script> --><script type="module" src="assets/main.js"></script>');
  const manifest={gameUrl:entry,resources:[{url:entry,method:'GET',saved:true,status:200,path:'index.html',contentType:'text/html'}]};
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  assert.deepEqual(requests.sort(),['/game/assets/later.js','/game/assets/main.js','/game/assets/required.js']);
  assert.equal(manifest.resources.filter(r=>r.saved).length,4);
});

test('YYG 2.0.2 script packages reveal late FairyGUI dependencies without executing scripts', async t => {
  const script=`(function(_0xaa,_0xbb){const _0xcc=_0x1234,_0xdd=_0xaa();while(!![]){try{const _0xee=parseInt(_0xcc(0x10));if(_0xee===_0xbb)break;else _0xdd.push(_0xdd.shift());}catch(_0xff){_0xdd.push(_0xdd.shift());}}}(_0xabcd,0x1));
    UIPackage.addPackage(_0x1234(0x11)+_0x1234(0x12)+_0x1234(0x13));throw Error("must never execute publisher code");
    function _0x1234(_0xa,_0xb){const _0xc=_0xabcd();return _0x1234=function(_0xd,_0xe){_0xd=_0xd-0x10;let _0xf=_0xc[_0xd];return _0xf;},_0x1234(_0xa,_0xb);}
    function _0xabcd(){const _0xc=['1','res/atlas/','fgui/Resul','t'];_0xabcd=function(){return _0xc;};return _0xabcd();}`;
  const cipher=createCipheriv('aes-128-cbc',Buffer.from('53D8DBC5DIK3436A'),Buffer.from('KI5JL2SKE9883365'));
  const body=Buffer.from(Buffer.concat([cipher.update(script),cipher.final()]).toString('base64'));
  const utf=value=>{const b=Buffer.from(value),size=Buffer.alloc(2);size.writeUInt16LE(b.length);return Buffer.concat([size,b]);};
  const len=Buffer.alloc(4);len.writeInt32LE(body.length);
  const packet=Buffer.concat([Buffer.from([233,3]),utf('YYGGames'),utf('2.0.2'),Buffer.alloc(13),len,body]);
  assert.equal(yygBinScript(packet),script);
  assert.throws(()=>yygBinScript(packet.subarray(0,packet.length-1)),/Truncated YYG script package/);
  const requests=[],server=http.createServer((req,res)=>{requests.push(req.url);res.end('package');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await mkdir(path.resolve('.tmp'),{recursive:true});const root=await mkdtemp(path.resolve('.tmp/yyg-script-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  await writeFile(path.join(root,'script.bin'),packet);
  const base=`http://127.0.0.1:${server.address().port}/game/`,manifest={gameUrl:base+'index.html',resources:[{url:base+'raw-assets/script',saved:true,status:200,path:'script.bin'}]};
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  assert.deepEqual(requests,['/game/res/atlas/fgui/Result.bin']);
});

test('YYG 1004 JSON packages support the alternate published key and still reject truncation', () => {
  const data={'json/res.json':{root_url:'res/',res_lib:[]}};
  const cipher=createCipheriv('aes-128-cbc',Buffer.from('53D8DBC5DIK3436A'),Buffer.from('KI5JL2SKE9883365'));
  const body=Buffer.from(Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]).toString('base64'));
  const header=Buffer.alloc(6);header.writeUInt16LE(1004);header.writeInt32LE(body.length,2);
  const packet=Buffer.concat([header,body]);
  assert.deepEqual(yygBinJsonEntries(packet),data);
  assert.throws(()=>yygBinJsonEntries(packet.subarray(0,packet.length-1)),/Truncated YYG JSON package/);
});

test('native cached library root overrides stale CDN metadata without hiding missing published models', async t => {
  const requests=[];let missing=false;
  const server=http.createServer((req,res)=>{requests.push(req.url);const ok=req.url==='/game/res/models/a.lh'||(!missing&&req.url==='/game/res/models/b.lh');res.writeHead(ok?200:404,{'content-type':'application/json'});res.end(ok?'{}':'missing');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/game/`,declared=base+'old-cdn/res/';
  await mkdir(path.resolve('.tmp'),{recursive:true});const root=await mkdtemp(path.resolve('.tmp/native-library-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const documentUrl=base+'json/res.json';
  const manifest={gameUrl:base+'index.html',resources:[{url:declared+'models/b.lh',saved:false,status:404,recoveredBy:'asset-completer',runtimeRequested:false}],runtimeAssetRegistries:[{
    baseUrl:base,virtualPaths:[],dependencyDocuments:[{name:documentUrl,data:{base_url:base+'old-cdn/',root_url:'res/',res_lib:[{id:1,sub_pack:'models',url:'a.lh'},{id:2,sub_pack:'models',url:'b.lh'}]}}],
    resourceLibraryRoots:[{documentUrl,declaredBase:declared,baseUrl:base+'res/',matchedUrls:[base+'res/models/a.lh',base+'res/models/b.lh']}]
  }]};
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  assert.deepEqual(requests.sort(),['/game/res/models/a.lh','/game/res/models/b.lh']);
  assert.equal(manifest.resources.find(r=>r.url===declared+'models/b.lh').ignored,true);
  assert.ok(manifest.resources.find(r=>r.url===base+'res/models/b.lh')?.saved);
  const model=manifest.resources.find(r=>r.url===base+'res/models/b.lh');await unlink(path.join(root,model.path));missing=true;
  const second=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(second.failedAssets,1);
  assert.equal(manifest.resources.find(r=>r.url===base+'res/models/b.lh').ignored,false);
});

test('Unity loader supplies configured WASM instead of the framework fallback on repair and fresh capture', async t => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, {'content-type': req.url.endsWith('/actual.wasm') ? 'application/wasm' : 'text/html'});
    res.end(req.url.endsWith('/actual.wasm') ? Buffer.from([0,97,115,109,1,0,0,0]) : '<html>publisher fallback</html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  await mkdir(path.resolve('.tmp'), {recursive:true});
  const root = await mkdtemp(path.resolve('.tmp/unity-wasm-'));
  t.after(async () => {server.closeAllConnections();await new Promise(resolve => server.close(resolve));await rm(root,{recursive:true,force:true});});
  await writeFile(path.join(root,'index.html'), '<script>/* old disabled export: var config={frameworkUrl:"Build/old.js",codeUrl:"Build/old.wasm",dataUrl:"Build/old.data"}; */var config={frameworkUrl:"Build/framework.js",codeUrl:"Build/actual.wasm"};</script>');
  await writeFile(path.join(root,'framework.js'), 'function unityFramework(Module){var wasmBinary=Module["wasmBinary"];var wasmBinaryFile="build.wasm";function getBinaryPromise(){if(wasmBinary)return Promise.resolve(wasmBinary);return fetch(wasmBinaryFile);}}');
  for (const repair of [true, false]) {
    const manifest = {gameUrl:base+'index.html',resources:[
      {url:base+'index.html',saved:true,path:'index.html',type:'document'},
      {url:base+'Build/framework.js',saved:true,path:'framework.js',type:'script'},
      ...(repair ? [{url:base+'Build/build.wasm',saved:false,status:200,recoveredBy:'asset-completer',error:'Expected game asset, received HTML'}] : [])
    ]};
    const stats = await completeArchiveAssets(root,manifest,{emit:()=>{}});
    assert.equal(stats.failedAssets,0);
    assert.ok(manifest.resources.find(r=>r.url===base+'Build/actual.wasm')?.saved);
    if (repair) assert.equal(manifest.resources.find(r=>r.url===base+'Build/build.wasm')?.ignored,true);
  }
  assert.equal(requests.includes('/game/Build/build.wasm'),false);
});

test('legacy Unity 5 build manifests use wasmCodeUrl/wasmFrameworkUrl so the framework fallback is not fetched', async t => {
  // 7k7k 上的老 Unity 构建清单只有 dataUrl / wasmCodeUrl / wasmFrameworkUrl。
  // 不认这组键时框架文件里的 Emscripten 兜底名 build.wasm 会被当成必需资源，
  // 取回站点 HTML 后把完整归档误判成「动态依赖补全失败」。
  const requests = [];
  const unityData = Buffer.concat([Buffer.from('UnityWebData1.0\0'), Buffer.from([20, 0, 0, 0])]);
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url.endsWith('.wasm.code.unityweb')) { res.writeHead(200, {'content-type':'application/wasm'}); return res.end(Buffer.from([0,97,115,109,1,0,0,0])); }
    if (req.url.endsWith('.data.unityweb')) { res.writeHead(200, {'content-type':'application/octet-stream'}); return res.end(unityData); }
    res.writeHead(200, {'content-type':'text/html'});
    res.end('<html>portal 404 page</html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  await mkdir(path.resolve('.tmp'), {recursive:true});
  const root = await mkdtemp(path.resolve('.tmp/unity-legacy-wasm-'));
  t.after(async () => {server.closeAllConnections();await new Promise(resolve => server.close(resolve));await rm(root,{recursive:true,force:true});});
  await writeFile(path.join(root,'index.html'), '<script>var gameInstance=UnityLoader.instantiate("gameContainer","Build/game.json");</script>');
  await writeFile(path.join(root,'game.json'), JSON.stringify({
    dataUrl:'rocking.data.unityweb', wasmCodeUrl:'rocking.wasm.code.unityweb', wasmFrameworkUrl:'rocking.wasm.framework.unityweb'
  }));
  await writeFile(path.join(root,'framework.js'), 'function unityFramework(Module){var wasmBinary=Module["wasmBinary"];var wasmBinaryFile="build.wasm";function getBinaryPromise(){if(wasmBinary)return Promise.resolve(wasmBinary);return fetch(wasmBinaryFile);}}');
  const manifest = {gameUrl:base+'index.html',resources:[
    {url:base+'index.html',saved:true,path:'index.html',type:'document'},
    {url:base+'Build/game.json',saved:true,path:'game.json',type:'fetch',contentType:'application/json'},
    {url:base+'Build/rocking.wasm.framework.unityweb',saved:true,path:'framework.js',type:'script'}
  ]};
  const stats = await completeArchiveAssets(root, manifest, {emit:()=>{}});
  assert.equal(stats.failedAssets, 0);
  assert.equal(requests.includes('/game/Build/build.wasm'), false);
  assert.ok(manifest.resources.find(r=>r.url===base+'Build/rocking.wasm.code.unityweb')?.saved);
});

test('unrequested Unity catalog candidates returning HTML stay unresolved instead of failing core completeness', async t => {
  const server = http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<html>not an asset</html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/game/`;
  await mkdir(path.resolve('.tmp'),{recursive:true});const root=await mkdtemp(path.resolve('.tmp/unity-html-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  await writeFile(path.join(root,'index.html'),'<script>var config={streamingAssetsUrl:"StreamingAssets"};</script>');
  const manifest={gameUrl:base+'index.html',resources:[{url:base+'index.html',saved:true,path:'index.html',type:'document'}]};
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  assert.equal(stats.unresolvedCandidates.length,2);
});

test('runtime-requested catalogs and explicitly configured WASM returning HTML remain failures on reruns', async t => {
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<html>not an asset</html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/game/`;
  await mkdir(path.resolve('.tmp'),{recursive:true});const root=await mkdtemp(path.resolve('.tmp/unity-required-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  await writeFile(path.join(root,'index.html'),'<script>var config={codeUrl:"Build/actual.wasm",streamingAssetsUrl:"StreamingAssets"};</script>');
  const manifest={gameUrl:base+'index.html',resources:[
    {url:base+'index.html',saved:true,path:'index.html',type:'document'},
    {url:base+'StreamingAssets/aa/catalog.json',saved:false,status:200,type:'fetch',error:'capture failed'}
  ]};
  for(let run=0;run<2;run++) {
    const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
    assert.equal(stats.failedAssets,2);
    assert.equal(manifest.resources.find(r=>r.url===base+'StreamingAssets/aa/catalog.json').ignored,false);
  }
});

test('Emscripten declarations complete WASM and data without fetching package-internal files', async t => {
  const requests=[];
  const server=http.createServer((req,res)=>{
    requests.push(req.url);
    const good=/^\/build\/webapp\/index\.(?:wasm|data)$/.test(req.url);
    res.writeHead(good?200:404,{'content-type':'application/octet-stream'});
    res.end(good?Buffer.from([1,2,3,4]):'missing');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/build/`;
  const temp=path.resolve('.tmp');await mkdir(temp,{recursive:true});
  const root=await mkdtemp(path.join(temp,'emscripten-deps-'));await mkdir(path.join(root,'game'));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
  await writeFile(path.join(root,'game/index.js'),`var Module={};function loadPackage(){};
    var REMOTE_PACKAGE_BASE="index.data";
    function findWasmBinary(){var f="index.wasm";return locateFile(f);}
    loadPackage({"files":[{"filename":"/assets/atlas/default.png","start":0,"end":4}],"remote_package_size":4});
    throw Error('must never execute publisher code');`);
  const manifest={gameUrl:base+'index.html',resources:[{url:base+'webapp/index.js',saved:true,path:'game/index.js',type:'script'}]};
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  assert.deepEqual(requests.sort(),['/build/webapp/index.data','/build/webapp/index.wasm']);
  assert.equal(stats.fetchedAssets,2);
});

test('bounded modulo texture themes complete every numbered variant without executing publisher code', async t => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const material = req.url.match(/^\/game\/img\/sky\/sky([1-4])\.lmat$/);
    const good = material || /^\/game\/img\/(?:sky\/sky|roadMat\/road)[1-4]\.png$/.test(req.url);
    res.writeHead(good ? 200 : 404, {'content-type':material ? 'application/json' : 'image/png'});
    res.end(material ? JSON.stringify({textures:[`sky${material[1]}.png`]}) : good ? 'texture bytes' : 'missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  const temp = path.resolve('.tmp');await mkdir(temp, {recursive:true});
  const root = await mkdtemp(path.join(temp, 'numbered-theme-'));await mkdir(path.join(root, 'game'));
  t.after(async () => {server.closeAllConnections();await new Promise(resolve => server.close(resolve));await rm(root, {recursive:true, force:true});});
  await writeFile(path.join(root, 'game/bundle.js'), `function createScene(){
    let theme=Math.ceil(game.level/3)%0x4;
    theme=0x0!=theme?theme:0x4;
    Laya.Material.load('img/sky/sky'+theme+'.lmat');Laya.Texture2D.load('img/roadMat/road'+theme+'.png');
    let unbounded=game.level;Laya.Texture2D.load('img/other/'+unbounded+'.png');
    throw Error('must never execute publisher code');}`);
  const manifest = {gameUrl:base+'index.html', resources:[{url:base+'js/bundle.js', saved:true, path:'game/bundle.js'}]};
  const stats = await completeArchiveAssets(root, manifest, {emit:()=>{}});
  assert.equal(stats.failedAssets, 0);
  assert.deepEqual(requests.sort(), [
    '/game/img/roadMat/road1.png','/game/img/roadMat/road2.png','/game/img/roadMat/road3.png','/game/img/roadMat/road4.png',
    '/game/img/sky/sky1.lmat','/game/img/sky/sky1.png','/game/img/sky/sky2.lmat','/game/img/sky/sky2.png',
    '/game/img/sky/sky3.lmat','/game/img/sky/sky3.png','/game/img/sky/sky4.lmat','/game/img/sky/sky4.png'
  ]);
});

test('Laya scene opening completes published JSON and nested UI assets while respecting packed scenes', async t => {
  const requests = [];
  const bodies = {
    '/game/scene/view/menu.json': '{}',
    '/game/scene/view/trySkinView.json': '{"type":"View","props":{"skin":"images/dialog.png"}}',
    '/game/images/dialog.png': 'original image',
    '/game/gameScene/tooth/Conventional/detail.png': 'relative detail'
  };
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(Object.hasOwn(bodies, req.url) ? 200 : 404, {'content-type':req.url.endsWith('.json') ? 'application/json' : 'image/png'});
    res.end(bodies[req.url] || 'missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  const temp = path.resolve('.tmp');await mkdir(temp, {recursive:true});
  const root = await mkdtemp(path.join(temp, 'laya-scene-deps-'));await mkdir(path.join(root, 'game'));
  t.after(async () => {server.closeAllConnections();await new Promise(resolve => server.close(resolve));await rm(root, {recursive:true, force:true});});
  await writeFile(path.join(root, 'game/bundle.js'), `class View extends Laya.View {createChildren(){this['loadScene']('scene/view/menu');}}
    Laya['View']['open']('scene/view/trySkinView.scene');Laya.Scene.load('scene/view/packed.scene');
    Laya.View.open('scene/view/unused.scene');const ordinary='scene/non-laya.scene';`);
  await writeFile(path.join(root, 'game/texture.png'), 'captured texture');
  const manifest = {gameUrl:base+'index.html', resources:[
    {url:base+'js/bundle.js', saved:true, path:'game/bundle.js'},
    {url:base+'gameScene/tooth/Conventional/Texture2D/tooth.png', saved:true, path:'game/texture.png'}],
    runtimeAssetRegistries:[{baseUrl:base, virtualPaths:['scene/view/packed.json','gameScene/tooth/Conventional/tooth.lh','gameScene/tooth/Conventional/material.lmat','gameScene/tooth/Conventional/tooth.lm'],
      dependencyDocuments:[
        {name:'gameScene/tooth/Conventional/tooth.lh',data:{material:'gameScene/tooth/Conventional/material.lmat',mesh:'gameScene/tooth/Conventional/tooth.lm'}},
        {name:'gameScene/tooth/Conventional/material.lmat',data:{textures:['gameScene/tooth/Conventional/Texture2D/tooth.png','./detail.png']}}
      ]}]};
  const result = await completeArchiveAssets(root, manifest, {emit:()=>{}});
  assert.equal(result.failedAssets, 0);
  assert.deepEqual(requests.sort(), ['/game/gameScene/tooth/Conventional/detail.png','/game/images/dialog.png','/game/scene/view/menu.json','/game/scene/view/trySkinView.json','/game/scene/view/unused.json']);
  assert.deepEqual(result.unresolvedCandidates, [{url:base+'scene/view/unused.json',error:'HTTP 404'}]);
  assert.ok(manifest.resources.find(item => item.url === base+'scene/view/trySkinView.json')?.saved);
  assert.equal(await readFile(path.join(root, manifest.resources.find(item => item.url === base+'images/dialog.png').path), 'utf8'), 'original image');
  manifest.resources.push({url:base+'scene/view/unused.json', saved:false, status:404, recoveredBy:'asset-completer'});
  await completeArchiveAssets(root, manifest, {emit:()=>{}});
  const stale = manifest.resources.find(item => item.url === base+'scene/view/unused.json');
  assert.equal(stale.ignored, true, 'a stale completer-only candidate must not continue to mark the archive incomplete');
  delete stale.recoveredBy;delete stale.ignored;
  const runtimeMissing = await completeArchiveAssets(root, manifest, {emit:()=>{}});
  assert.equal(runtimeMissing.failedAssets, 1, 'a real browser request failure remains actionable');
});

test('Laya filename aliases resolve relative scene dependencies and repair only completer-generated 404s', async t => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const good = req.url === '/game/res/Materials/HASH.lmat';
    res.writeHead(good ? 200 : 404, {'content-type': 'application/json'});
    res.end(good ? '{"textures":["../textures/old.png"]}' : 'missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  const temp = path.resolve('.tmp');
  await mkdir(temp, {recursive: true});
  const root = await mkdtemp(path.join(temp, 'laya-version-'));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), temp);
    await rm(root, {recursive: true, force: true});
  });
  await mkdir(path.join(root, 'game'));
  await writeFile(path.join(root, 'game/scene.ls'), JSON.stringify({
    material: 'Materials/Glass Wine Bottle.lmat', mesh: 'models/player.lm'
  }));
  const stale = base + 'res/Materials/Glass%20Wine%20Bottle.lmat';
  const runtimeFailure = base + 'res/models/player.lm';
  const manifest = {gameUrl: base + 'index.html', runtimeAssetRegistries: [{
    baseUrl: base, resources: [], virtualPaths: ['res/models/MESH.lm', 'res/textures/TEX.png'],
    urlAliases: {
      'res/Materials/Glass Wine Bottle.lmat': 'res/Materials/HASH.lmat',
      'res/models/player.lm': 'res/models/MESH.lm',
      'res/textures/old.png': 'res/textures/TEX.png'
    }
  }], resources: [
    {url: base + 'res/scene.ls', saved: true, status: 200, path: 'game/scene.ls'},
    {url: stale, saved: false, status: 404, recoveredBy: 'asset-completer'},
    {url: runtimeFailure, saved: false, status: 404}
  ]};
  const stats = await completeArchiveAssets(root, manifest, {emit: () => {}});
  assert.equal(stats.failedAssets, 0);
  assert.deepEqual(requests, ['/game/res/Materials/HASH.lmat']);
  assert.equal(manifest.resources.find(r => r.url === stale).mappedTo, base + 'res/Materials/HASH.lmat');
  assert.equal(manifest.resources.find(r => r.url === stale).ignored, true);
  assert.notEqual(manifest.resources.find(r => r.url === runtimeFailure).ignored, true,
    'an actual browser failure must not disappear just because an alias exists');
  const physical = manifest.resources.find(r => r.url === base + 'res/Materials/HASH.lmat');
  await unlink(path.join(root, physical.path));
  server.removeAllListeners('request');
  server.on('request', (req, res) => {res.writeHead(404); res.end('missing');});
  const missing = await completeArchiveAssets(root, manifest, {emit: () => {}});
  assert.equal(missing.failedAssets, 1, 'the mapped physical dependency must remain required');
  assert.equal(missing.failures[0].url, physical.url);
});

test('PlayCanvas font atlas pages retain the published asset hash', async t => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const good = /^\/game\/files\/font\.ttf(?:1)?\.png\?t=abc123$/.test(req.url);
    res.writeHead(good ? 200 : 404, { 'content-type': 'image/png' });
    res.end(good ? 'font bytes' : 'missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const temp = path.resolve('.tmp');
  await mkdir(temp, { recursive: true });
  const root = await mkdtemp(path.join(temp, 'playcanvas-font-'));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); });
  await mkdir(path.join(root, 'game'));
  await writeFile(path.join(root, 'game/config.json'), JSON.stringify({assets: {12: {
    type: 'font', file: {url: 'files/font.ttf.png', hash: 'abc123'},
    data: {info: {maps: [{width:2048,height:1024},{width:512,height:256}]}}
  }}}));
  const manifest = {gameUrl: origin + '/game/index.html', resources: [{url: origin + '/game/config.json', saved:true, status:200, path:'game/config.json'}]};
  const result = await completeArchiveAssets(root, manifest, {emit:()=>{}});
  assert.equal(result.failedAssets, 0);
  assert.deepEqual(requests.sort(), ['/game/files/font.ttf.png?t=abc123','/game/files/font.ttf1.png?t=abc123']);
  assert.equal(manifest.resources.filter(r => r.saved).length, 3);
});

test('publisher PlayCanvas registry completes later scenes and GLB outside the SDK wrapper base',async t=>{
 const requests=[],server=http.createServer((req,res)=>{requests.push(req.url);const ok=['/publisher/files/cup.glb?t=model-hash','/publisher/1196825.json'].includes(req.url);res.writeHead(ok?200:404);res.end(req.url.endsWith('.json')?'{}':'native model');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,temp=path.resolve('.tmp');await mkdir(temp,{recursive:true});const root=await mkdtemp(path.join(temp,'publisher-registry-'));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 await mkdir(path.join(root,'game'));await writeFile(path.join(root,'game/config.json'),JSON.stringify({application_properties:{},assets:{1:{type:'container',file:{url:'files/cup.glb',hash:'model-hash'},data:{}}},scenes:[{name:'Level 2',url:'1196825.json'}]}));
 const manifest={gameUrl:'https://sdk.example.test/portal/index.html',resources:[{url:origin+'/publisher/config.json',saved:true,status:200,path:'game/config.json'}]};
 const result=await completeArchiveAssets(root,manifest,{emit:()=>{}});assert.equal(result.failedAssets,0);assert.deepEqual(requests.sort(),['/publisher/1196825.json','/publisher/files/cup.glb?t=model-hash']);
 assert.ok(manifest.resources.find(r=>r.url===origin+'/publisher/1196825.json')?.saved);assert.ok(manifest.resources.find(r=>r.url===origin+'/publisher/files/cup.glb?t=model-hash')?.saved);
});

test('Unity HTML build config completes declared loader, data, framework and wasm paths without executing scripts', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const good = /^\/game\/Build\/(?:game.loader.js|game.data.unityweb|game.framework.js.unityweb|game.wasm.unityweb)$/.test(req.url);
    res.writeHead(good ? 200 : 404, { 'content-type': 'application/octet-stream' });
    res.end(good ? 'original bytes' : 'missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-unity-config-'));
  try {
    await mkdir(path.join(root, 'game'), { recursive: true });
    await writeFile(path.join(root, 'game/index.html'), `<script>const buildUrl="Build";
      const loaderUrl=buildUrl+"/game.loader.js";
      const config={dataUrl:buildUrl+"/game.data.unityweb", frameworkUrl:buildUrl+"/game.framework.js.unityweb",codeUrl:buildUrl+"/game.wasm.unityweb"};
      throw Error('never execute archived scripts');</script>`);
    const manifest = { gameUrl: origin + '/game/index.html', resources: [{ url: origin + '/game/index.html', method: 'GET', type: 'document', saved: true, status: 200, path: 'game/index.html' }] };
    const result = await completeArchiveAssets(root, manifest, { emit: () => {} });
    assert.equal(result.failedAssets, 0);
    assert.equal(requests.length, 4);
    assert.ok(manifest.resources.find(r => r.url === origin + '/game/Build/game.wasm.unityweb')?.saved);
    const data = manifest.resources.find(r => r.url.endsWith('game.data.unityweb'));
    await unlink(path.join(root, data.path));
    server.removeAllListeners('request');
    server.on('request', (req, res) => { res.writeHead(req.url.endsWith('.data.unityweb') ? 404 : 200); res.end('missing'); });
    const missing = await completeArchiveAssets(root, manifest, { emit: () => {} });
    assert.equal(missing.failedAssets, 1, 'a declared but unavailable binary must remain a core failure');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); }
});

test('legacy YYG 3.0 bundles resolve virtual models and materials and repair false 404 records', async () => {
  const encrypted = value => { const cipher=createCipheriv('aes-128-cbc',Buffer.from('B3A8PBC5DIK9436A'),Buffer.from('IO1JL2SVH98833U5'));return Buffer.concat([cipher.update(typeof value==='string'?value:JSON.stringify(value)),cipher.final()]).toString('base64'); };
  const utf = value => { const b=Buffer.from(value),n=Buffer.alloc(2);n.writeUInt16LE(b.length);return Buffer.concat([n,b]); };
  const int = value => { const b=Buffer.alloc(4);b.writeUInt32LE(value);return b; };
  const metadata = {1000:[],1001:['script'],1003:['mesh'],1004:['materials'],EXT:'.bin',manifest:{'models/a.lm':'mesh'}};
  const metaBody=Buffer.from(encrypted(metadata));
  const materialBody=Buffer.from(encrypted({'models/a.lmat':{textures:['../texture.png']},'models/Animator/Door _10992/door.lmat':{textures:['Prop transport.jpg']},'json/hand.json':[{id:12,extra:33}],'json/level.json':[{level:10,nodeData:[{a:'conveyor',b:'0,0,5'}]}]}));
  const scriptBody=Buffer.from(encrypted('function loadProp(name){loader.create("sub1/prop/Conventional/"+name+".lh");} this["foodName"]="food_conveyor"; selectProp(this.foodName); function selectEffect(name){loader.create("sub1/effect/Conventional/"+name+".lh");} function selectHand(name){loader.create("sub1/hand/Conventional/"+name+".lh");} game["createEffect"]("yan",position); function playSound(name){SoundManager.playSound("img/sound/"+name+".mp3");} playSound("Collected"); SoundManager.playMusic("img/sound/bgm.mp3"); throw Error("must never execute game script");'));
  const routes=new Map([
    ['/game/raw-assets/bootstrap',Buffer.concat([int(3),utf('3.0.0'),int(metaBody.length),metaBody])],
    ['/game/raw-assets/materials.bin',Buffer.concat([Buffer.from([236,3]),int(materialBody.length),materialBody])],
    ['/game/raw-assets/mesh.bin',Buffer.from('mesh package')],
    ['/game/raw-assets/script.bin',Buffer.concat([Buffer.from([233,3]),utf('YYGGames'),utf('3.0.0'),Buffer.alloc(13),int(scriptBody.length),scriptBody])],
    ['/game/img/sound/Collected.mp3',Buffer.from('sound')],
    ['/game/img/sound/bgm.mp3',Buffer.from('music')],
    ['/game/sub1/prop/Conventional/conveyor.lh',Buffer.from('{"mesh":"../../../models/a.lm"}')],
    ['/game/sub1/prop/Conventional/food_conveyor.lh',Buffer.from('{}')],
    ['/game/sub1/effect/Conventional/yan.lh',Buffer.from('{}')],
    ['/game/sub1/hand/Conventional/hand12.lh',Buffer.from('{}')],
    ['/game/texture.png',Buffer.from('texture')],
    ['/game/models/Animator/Door%20_10992/Prop%20transport.jpg',Buffer.from('door texture')]
  ]);
  const requests=[];
  const server=http.createServer((req,res)=>{requests.push(req.url);const body=routes.get(req.url);res.writeHead(body?200:404,{'content-type':'application/octet-stream'});res.end(body||'missing');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const root=await mkdtemp(path.join(os.tmpdir(),'h5-legacy-bundle-'));
  try {
    await mkdir(path.join(root,'game'),{recursive:true});
    await writeFile(path.join(root,'game/scene.lh'),JSON.stringify({mesh:'models/a.lm',material:'models/a.lmat'}));
    await writeFile(path.join(root,'game/bootstrap.bin'),routes.get('/game/raw-assets/bootstrap'));
    const stale=origin+'/game/models/a.lm';
    const manifest={gameUrl:origin+'/game/index.html',resources:[
      {url:origin+'/game/scene.lh',method:'GET',saved:true,status:200,path:'game/scene.lh'},
      {url:origin+'/game/raw-assets/bootstrap',method:'GET',saved:true,status:200,path:'game/bootstrap.bin'},
      {url:stale,method:'GET',saved:false,status:404,type:'fetch',recoveredBy:'asset-completer'}
    ]};
    const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
    assert.equal(stats.failedAssets,0);
    assert.ok(manifest.resources.find(r=>r.url===stale)?.ignored);
    assert.ok(requests.includes('/game/raw-assets/mesh.bin'));
    assert.ok(requests.includes('/game/raw-assets/materials.bin'));
    assert.ok(requests.includes('/game/texture.png'));
    assert.ok(requests.includes('/game/models/Animator/Door%20_10992/Prop%20transport.jpg'));
    assert.ok(requests.includes('/game/img/sound/Collected.mp3'));
    assert.ok(requests.includes('/game/img/sound/bgm.mp3'));
    assert.ok(requests.includes('/game/sub1/prop/Conventional/conveyor.lh'));
    assert.ok(requests.includes('/game/sub1/prop/Conventional/food_conveyor.lh'));
    assert.ok(requests.includes('/game/sub1/effect/Conventional/yan.lh'));
    assert.ok(requests.includes('/game/sub1/hand/Conventional/hand12.lh'));
    assert.ok(!requests.includes('/game/models/a.lm'));
    assert.ok(!requests.includes('/game/models/a.lmat'));
    assert.throws(()=>yygBinJsonEntries(routes.get('/game/raw-assets/materials.bin').subarray(0,12)),/Truncated YYG JSON package/);
    routes.delete('/game/raw-assets/mesh.bin');
    const mesh=manifest.resources.find(r=>r.url===origin+'/game/raw-assets/mesh.bin');
    await unlink(path.join(root,mesh.path));
    const missing=await completeArchiveAssets(root,manifest,{emit:()=>{}});
    assert.equal(missing.failedAssets,1,'a missing physical package must remain a core failure');
    assert.equal(missing.failures[0].url,mesh.url);
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

test('SDK dynamic query prefixes are not fetched or retained as failed assets on repair', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-sdk-prefix-'));
  try {
    const url = origin + '/gameSDK/YYGGames.js';
    const file = resourcePath(root, url, 'application/javascript', '', 'game');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `const api='${origin}/pic.json?'+Date.now(); const config='${origin}/config.json';`);
    const manifest = { gameUrl: origin + '/game/index.html', runtimeInspection: { engine: 'LayaAir', coreReady: true }, resources: [
      { url, method: 'GET', status: 200, saved: true, path: path.relative(root, file) },
      { url: origin + '/pic.json?', method: 'GET', status: 200, saved: false, recoveredBy: 'asset-completer', error: 'Expected game asset, received HTML' }
    ] };
    const stats = await completeArchiveAssets(root, manifest, { emit: () => {} });
    assert.deepEqual(requests, ['/config.json']);
    assert.equal(stats.failedAssets, 0);
    assert.equal(manifest.resources.find(r => r.url === origin + '/pic.json?').ignored, true);
    assert.equal(assessCompleteness(manifest).status, 'core-complete');
  } finally {
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('h5-sdk-prefix-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('JSON completion validates the body when the server declares text/html', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { 'content-type': 'text/html; charset=UTF-8' });
    res.end(req.url === '/game/config.json' ? '{"enabled":true}' : '<!doctype html><title>Not found</title>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-json-mime-'));
  try {
    const url = base + 'resources.json';
    const file = resourcePath(root, url, 'application/json', '', 'game');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '{"config":"config.json","scene":"missing.json"}');
    const manifest = { gameUrl: base + 'index.html', resources: [
      { url, method: 'GET', status: 200, saved: true, path: path.relative(root, file) }
    ] };
    const stats = await completeArchiveAssets(root, manifest, { emit: () => {} });
    const config = manifest.resources.find(r => r.url === base + 'config.json');
    assert.equal(config?.saved, true);
    assert.equal(config.contentType, 'application/json');
    assert.deepEqual(JSON.parse(await readFile(path.join(root, config.path), 'utf8')), { enabled: true });
    assert.equal(stats.failedAssets, 1);
    assert.equal(stats.failures[0].url, base + 'missing.json');
    assert.equal(requests.filter(url => url === '/game/missing.json').length, 1);
    assert.equal(manifest.resources.find(r => r.url === base + 'missing.json').saved, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('h5-json-mime-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('YYG SDK completion includes offline host fallback logos and absolute config URLs', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { 'content-type': req.url.endsWith('.json') ? 'application/json' : 'image/png' });
    res.end(req.url.endsWith('.json') ? '{}' : 'logo');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-sdk-completion-'));
  try {
    const url = origin + '/gameSDK/YYGGames.js?v=2';
    const file = resourcePath(root, url, 'application/javascript', '', 'game');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `const fallback='H5GAMES4U'; const dev='DEVELOPMENT'; const icon='logo/'+channel+'/side.png'; const sizes=['144x144.png']; const config='${origin}/sdk/adConfig/ad_config.json';`);
    const manifest = { gameUrl: origin + '/game/index.html', resources: [
      { url, saved: true, status: 200, method: 'GET', path: path.relative(root, file) }
    ] };
    const result = await completeArchiveAssets(root, manifest, { emit: () => {} });
    assert.equal(result.failedAssets, 0);
    for (const expected of ['/gameSDK/logo/H5GAMES4U/side.png', '/gameSDK/logo/H5GAMES4U/144x144.png', '/gameSDK/logo/DEVELOPMENT/144x144.png', '/sdk/adConfig/ad_config.json']) {
      assert.ok(requests.includes(expected), `missing ${expected}`);
      assert.ok(manifest.resources.find(r => r.url === origin + expected)?.saved);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('h5-sdk-completion-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('real FairyGUI package dependencies survive compression and reject truncation', async () => {
  const raw = await readFile(new URL('./fixtures/queen-GameScore.bin', import.meta.url));
  let offset=9; for(let i=0;i<2;i++) offset+=2+raw.readUInt16BE(offset); offset+=20;
  const header=Buffer.from(raw.subarray(0,offset)); header[8]=1;
  assert.deepEqual(fairyguiAssets(Buffer.concat([header,deflateRawSync(raw.subarray(offset))])), fairyguiAssets(raw));
  assert.throws(()=>fairyguiAssets(raw.subarray(0,30)));
});

test('completion follows a resource registry, relative models and real FairyGUI atlases over HTTP', async () => {
  const gui = await readFile(new URL('./fixtures/queen-GameScore.bin', import.meta.url));
  const font = await readFile(new URL('./fixtures/queen-Font.bin', import.meta.url));
  const routes = new Map([
    ['/game/res/effect/Red.lh', JSON.stringify({ material: 'materials/red.lmat' })],
    ['/game/res/effect/materials/red.lmat', JSON.stringify({ textures: ['../texture.png'] })],
    ['/game/res/effect/texture.png', 'effect-texture'],
    ['/game/res/atlas/fgui/GameScore.bin', gui],
    ['/game/res/atlas/fgui/GameScore_atlas0.png', 'gui-atlas'],
    ['/game/res/atlas/fgui/Font.bin', font],
    ['/game/res/atlas/fgui/Font_atlas0.png', 'font-atlas'],
    ['/game/res/atlas/icons.png', 'packed-icons'],
    ['/game/res/atlas/icons.atlas', JSON.stringify({meta:{image:'icons.png',prefix:'icons/'},frames:{'pic.png':{}}})],
    ['/game/res/sounds/a%20b.mp3?v=1', 'sound']
  ]);
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const body = routes.get(req.url);
    res.writeHead(req.method === 'HEAD' ? 405 : body === undefined ? 404 : 200, { 'content-type': 'application/octet-stream' });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-completion-'));
  try {
    await mkdir(path.join(root, 'archive'));
    const manifest = { gameUrl: base + 'index.html', resources: [], failures: [] };
    for (const [name, body] of [
      ['json/res.json', JSON.stringify({ root_url: 'res/', res_lib: [{id:3003,sub_pack:'effect',url:'Red.lh'}] })],
      ['js/bundle.js', 'const ui="res/atlas/fgui/GameScore/Main"; const sound="res/sounds/a%20b.mp3?v=1"; const unused="res/unused.png"; const atlas="res/atlas/icons.atlas";'],
      ['UI/Widget.json', JSON.stringify({type:'View',props:{skin:'icons/pic.png'}})],
      ['res/other/texture.png', 'unrelated-same-basename']
    ]) {
      const url = new URL(name, base).href, file = resourcePath(root, url, '', '', 'game');
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, body);
      manifest.resources.push({ url, saved:true, method:'GET', path:path.relative(root,file), status:200 });
    }
    manifest.resources.push({ url:base+'res/effect/Red.lh', method:'GET', saved:false, status:404 });
    const stats = await completeArchiveAssets(root, manifest, { emit:()=>{} });
    assert.equal(stats.failedAssets, 0, JSON.stringify(stats.failures));
    assert.equal(stats.unresolvedCandidates.length,1);
    assert.equal(stats.scanFailures.length,0);
    assert.equal(requests.some(r=>r.includes('/icons/pic.png')),false);
    for (const route of routes.keys()) {
      const url = new URL(route, base).href;
      const items = manifest.resources.filter(r => r.url === url);
      assert.equal(items.length, 1, `unique manifest mapping for ${route}`);
      assert.equal(items[0].saved, true, `downloaded ${route}`);
      assert.deepEqual(await readFile(path.join(root,items[0].path)), Buffer.from(routes.get(route)));
    }
    assert.equal(requests.some(r => r.startsWith('HEAD')), false);
    const count = requests.length;
    const rerun = await completeArchiveAssets(root, manifest, { emit:()=>{} });
    assert.equal(rerun.fetchedAssets, 0);
    assert.equal(requests.length, count + 1); // Only the previously unresolved SDK candidate is retried.
    routes.delete('/game/res/effect/texture.png');
    const texture = manifest.resources.find(r=>r.url===base+'res/effect/texture.png');
    await rm(path.join(root,texture.path));
    const failed = await completeArchiveAssets(root, manifest, { emit:()=>{} });
    assert.equal(failed.failedAssets, 1);
    assert.equal(manifest.resources.find(r=>r.url===texture.url).saved, false);
    assert.equal(manifest.assetCompletion.failedAssets, 1);
    manifest.runtimeInspection={engine:'LayaAir',coreReady:true};
    assert.equal(assessCompleteness(manifest).status, 'incomplete');
    const controller = new AbortController(); controller.abort();
    const cancelled=await completeArchiveAssets(root,manifest,{signal:controller.signal,emit:()=>{}});
    assert.equal(cancelled.cancelled,true);
    assert.ok(cancelled.pendingAssets>0);
    assert.equal(assessCompleteness(manifest).status,'incomplete');
  } finally {
    await new Promise(resolve=>server.close(resolve));
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('h5-completion-'));
    await rm(root,{recursive:true,force:true});
  }
});

test('completion handles Laya fileconfig, app-manifest fis resolution, and binary ltcb.ls safely', async () => {
  const routes = new Map([
    ['/game/res/atlas/ui.atlas', JSON.stringify({ meta: { image: 'ui.png' }, frames: { 'btn.png': {} } })],
    ['/game/res/atlas/ui.png', 'ui-png'],
    ['/game/raw-assets/star/star.bin', 'star-bin-content'],
    ['/game/res/Scene/MainSceneGIReflection.ltcb.ls', Buffer.from('  LAYATEXTURECUBE:0000\x01\x08\x80')]
  ]);
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const body = routes.get(req.url);
    res.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/octet-stream' });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/game/`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-laya-completion-'));
  try {
    await mkdir(path.join(root, 'archive'));
    const manifest = { gameUrl: base + 'index.html', resources: [], failures: [] };

    // 1. fileconfig.json defining atlas frames
    const fileconfigUrl = base + 'fileconfig.json';
    const fileconfigFile = resourcePath(root, fileconfigUrl, '', '', 'game');
    await mkdir(path.dirname(fileconfigFile), { recursive: true });
    await writeFile(fileconfigFile, JSON.stringify({
      'res/atlas/ui.atlas': ['ui/', ['btn.png', 'icon.png']]
    }));
    manifest.resources.push({ url: fileconfigUrl, saved: true, method: 'GET', path: path.relative(root, fileconfigFile), status: 200 });

    // 2. raw-assets/app-manifest.json containing data.fis and data.raw
    const appManifestUrl = base + 'raw-assets/app-manifest.json';
    const appManifestFile = resourcePath(root, appManifestUrl, '', '', 'game');
    await mkdir(path.dirname(appManifestFile), { recursive: true });
    await writeFile(appManifestFile, JSON.stringify({
      fis: { star: ['raw-assets/star/star.bin'] },
      raw: { 'ui/btn.png': 'raw-assets/star/star.bin' }
    }));
    manifest.resources.push({ url: appManifestUrl, saved: true, method: 'GET', path: path.relative(root, appManifestFile), status: 200 });

    // 3. Binary .ltcb.ls file
    const ltcbUrl = base + 'res/Scene/MainSceneGIReflection.ltcb.ls';
    const ltcbFile = resourcePath(root, ltcbUrl, '', '', 'game');
    await mkdir(path.dirname(ltcbFile), { recursive: true });
    await writeFile(ltcbFile, Buffer.from('  LAYATEXTURECUBE:0000\x01\x08\x80'));
    manifest.resources.push({ url: ltcbUrl, saved: true, method: 'GET', path: path.relative(root, ltcbFile), status: 200 });

    const stats = await completeArchiveAssets(root, manifest, { emit: () => {} });

    assert.equal(stats.failedAssets, 0, 'No failed assets');
    assert.equal(stats.scanFailures.length, 0, 'No scan failures for binary ltcb.ls');
    // Ensure raw-assets/raw-assets/ was NOT requested
    assert.equal(requests.some(r => r.includes('raw-assets/raw-assets/')), false, 'Never request duplicate raw-assets/raw-assets/');
    // Ensure atlas frame images were NOT fetched as standalone files
    assert.equal(requests.some(r => r.endsWith('/btn.png') || r.endsWith('/icon.png')), false, 'Never fetch atlas frames as standalone files');

    // Ensure star.bin was downloaded correctly to base-relative path
    const starRecord = manifest.resources.find(r => r.url === base + 'raw-assets/star/star.bin');
    assert.ok(starRecord?.saved, 'star.bin saved');

    manifest.runtimeInspection = { engine: 'LayaAir', coreReady: true };
    const completeness = assessCompleteness(manifest);
    assert.equal(completeness.status, 'core-complete', 'Should be core-complete');
    assert.equal(completeness.criticalFailures.length, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});


test('runtime package registry fetches physical versions and skips proven virtual paths on reruns', async () => {
 const requests=[];const server=http.createServer((req,res)=>{requests.push(req.url);res.writeHead(req.url==='/game/raw-assets/pack.bin?v=7'?200:404);res.end('encrypted');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/game/`;
 const root=path.resolve('.tmp/runtime-package-regression');await mkdir(root,{recursive:true});
 const virtual=base+'res/atlas/comp.atlas';
 const manifest={gameUrl:base+'index.html',resources:[{url:virtual,method:'GET',saved:false,status:404,recoveredBy:'asset-completer',error:'HTTP 404'}],runtimeAssetRegistries:[{baseUrl:base,resources:[base+'raw-assets/pack.bin?v=7'],virtualPaths:['res/atlas/comp.atlas'],failures:[]}]};
 try {const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});assert.ok(manifest.resources.find(r=>r.url===base+'raw-assets/pack.bin?v=7')?.saved);assert.equal(stats.failedAssets,0);assert.equal(manifest.resources.find(r=>r.url===virtual)?.ignored,true);assert.equal(requests.includes('/game/res/atlas/comp.atlas'),false);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

// FairyGUI package names can refer to sibling package directories.
test('FairyGUI resolves shared packages from declared fgui_main paths',async()=>{
 const gui=await readFile(new URL('./fixtures/queen-GameScore.bin',import.meta.url));const requests=[];
 const server=http.createServer((req,res)=>{requests.push(req.url);const ok=req.url==='/game/res/atlas/fgui_main/Font.bin';res.writeHead(ok?200:404);res.end(ok?'font':'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/game/`;const root=path.resolve('.tmp/fgui-path-regression');const manifest={gameUrl:base+'index.html',resources:[]};
 try{for(const [name,body]of [['js/bundle.js','loadPackage("res/atlas/fgui_main/Font")'],['res/atlas/fgui/GameScore.bin',gui]]){const file=resourcePath(root,base+name,'','','game');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,body);manifest.resources.push({url:base+name,method:'GET',saved:true,status:200,path:path.relative(root,file)});}await completeArchiveAssets(root,manifest,{emit:()=>{}});assert.ok(requests.includes('/game/res/atlas/fgui_main/Font.bin'));assert.equal(requests.includes('/game/res/atlas/fgui/Font.bin'),false);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

test('runtime embedded scene replaces a captured HTTP error page with native JSON',async()=>{
 const root=path.resolve('.tmp/scene-regression'),base='https://example.com/game/';await mkdir(root,{recursive:true});
 const scene={type:'Scene',props:{runtime:'Loading.ts'},loadList:[]};
 const manifest={gameUrl:base+'index.html',resources:[{url:base+'LoadingScene.json',method:'GET',saved:true,status:404,path:'old.json',contentType:'text/html'}],runtimeAssetRegistries:[{baseUrl:base,resources:[],virtualPaths:[],embeddedScenes:{'LoadingScene.json':scene}}]};await writeFile(path.join(root,'old.json'),'<html>404</html>');
 try{await completeArchiveAssets(root,manifest,{emit:()=>{}});const item=manifest.resources.find(r=>r.url===base+'LoadingScene.json');assert.equal(item.status,200);assert.deepEqual(JSON.parse(await readFile(path.join(root,item.path),'utf8')),scene);}
 finally{await rm(root,{recursive:true,force:true});}
});

test('packed material dependencies include external Laya cube textures',async()=>{
 const requests=[];const server=http.createServer((req,res)=>{requests.push(req.url);res.end(JSON.stringify({front:'face.png'}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/game/`,root=path.resolve('.tmp/cube-regression');
 const manifest={gameUrl:base+'index.html',resources:[],runtimeAssetRegistries:[{baseUrl:base,resources:[],virtualPaths:['res/sky/face.png'],dependencyDocuments:[{name:'res/sky/sky.lmat',data:{textures:[{path:'cube.ltc'}]}}]}]};
 try{await completeArchiveAssets(root,manifest,{emit:()=>{}});assert.deepEqual(requests,['/game/res/sky/cube.ltc']);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});

test('rootless resource registries resolve package basenames without inventing db URLs',async()=>{
 const root=path.resolve('.tmp/rootless-regression'),base='https://example.com/game/';const wrong=base+'db/Level.lh';
 const manifest={gameUrl:base+'index.html',resources:[{url:wrong,method:'GET',saved:false,status:404,recoveredBy:'asset-completer'}],runtimeAssetRegistries:[{baseUrl:base,resources:[],virtualPaths:['res/map/Level.lh'],dependencyDocuments:[{name:'db/res.json',data:{res_lib:[{id:1,sub_pack:'map',url:'Level.lh'}]}}]}]};
 try{const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});assert.equal(stats.discoveredAssets,0);assert.equal(stats.failedAssets,0);assert.equal(manifest.resources[0].ignored,true);}
 finally{await rm(root,{recursive:true,force:true});}
});

test('FairyGUI resolves shared packages from already captured bin records and avoids false sibling 404',async()=>{
 const gui=await readFile(new URL('./fixtures/queen-GameScore.bin',import.meta.url));
 const root=path.resolve('.tmp/fgui-record-regression'),base='https://example.com/game/';await mkdir(root,{recursive:true});
 const baseFile=resourcePath(root,base+'res/fgui/base/Font.bin','','','game');
 await mkdir(path.dirname(baseFile),{recursive:true});await writeFile(baseFile,Buffer.from('font-data'));
 const mainFile=resourcePath(root,base+'res/fgui/main/GameScore.bin','','','game');
 await mkdir(path.dirname(mainFile),{recursive:true});await writeFile(mainFile,gui);
 const manifest={
  gameUrl:base+'index.html',
  resources:[
   {url:base+'res/fgui/base/Font.bin',method:'GET',saved:true,status:200,path:path.relative(root,baseFile)},
   {url:base+'res/fgui/main/GameScore.bin',method:'GET',saved:true,status:200,path:path.relative(root,mainFile)},
   {url:base+'res/fgui/main/Font.bin',method:'GET',saved:false,status:404,recoveredBy:'asset-completer'}
  ]
 };
 try{
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  const sibling=manifest.resources.find(r=>r.url===base+'res/fgui/main/Font.bin');
  assert.equal(sibling.ignored,true);
  assert.equal(sibling.ignoredReason,'Shared FairyGUI package resolved from declared path');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('redirected document records self-repair and are not rejected as invalid HTML game assets',async()=>{
 const root=path.resolve('.tmp/redirect-repair-regression'),base='https://example.com/game/';await mkdir(root,{recursive:true});
 const htmlFile=resourcePath(root,base+'index.html','','','game');
 await mkdir(path.dirname(htmlFile),{recursive:true});await writeFile(htmlFile,'<!doctype html><html><body>Game</body></html>');
 const manifest={
  gameUrl:base+'index.html',
  resources:[
   {url:base+'index.html',method:'GET',saved:true,status:200,type:'document',path:path.relative(root,htmlFile)},
   {url:base+'index.php?yad',method:'GET',saved:false,status:200,type:'document',recoveredBy:'asset-completer',error:'Expected game asset, received HTML'}
  ]
 };
 try{
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  const redirected=manifest.resources.find(r=>r.url===base+'index.php?yad');
  assert.equal(redirected.saved,true);
  assert.equal(redirected.status,302);
  assert.equal(redirected.error,undefined);
  assert.equal(redirected.redirectURL,base+'index.html');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('optional Unity Addressables catalog candidates are not treated as core failures and auto-repair',async()=>{
 const root=path.resolve('.tmp/unity-aa-regression'),base='https://example.com/game/';await mkdir(root,{recursive:true});
 const htmlFile=resourcePath(root,base+'index.html','','','game');
 await mkdir(path.dirname(htmlFile),{recursive:true});
 await writeFile(htmlFile,'<script>var config={streamingAssetsUrl:"StreamingAssets"};</script>');
 const manifest={
  gameUrl:base+'index.html',
  resources:[
   {url:base+'index.html',method:'GET',saved:true,status:200,type:'document',path:path.relative(root,htmlFile)},
   {url:base+'StreamingAssets/aa/catalog.json',method:'GET',saved:false,status:404,type:'fetch',recoveredBy:'asset-completer',error:'HTTP 404'},
   {url:base+'StreamingAssets/aa/settings.json',method:'GET',saved:false,status:404,type:'fetch',recoveredBy:'asset-completer',error:'HTTP 404'}
  ]
 };
 try{
  const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
  assert.equal(stats.failedAssets,0);
  const catalog=manifest.resources.find(r=>r.url===base+'StreamingAssets/aa/catalog.json');
  assert.equal(catalog.ignored,true);
  assert.equal(catalog.ignoredReason,'Optional Unity Addressables candidate not used by game');
 }finally{await rm(root,{recursive:true,force:true});}
});



test('PlayCanvas fallback script does not require its unused default WASM, while declared WASM remains required', async t => {
  const requests=[];let missing=false;
  const server=http.createServer((req,res)=>{requests.push(req.url);if(req.url==='/game/actual.wasm'&&!missing){res.writeHead(200,{'content-type':'application/wasm'});res.end(Buffer.from([0,97,115,109,1,0,0,0]));}else{res.writeHead(404);res.end('missing');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/game/';
  await mkdir(path.resolve('.tmp'),{recursive:true});const root=await mkdtemp(path.resolve('.tmp/playcanvas-fallback-'));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const config={application_properties:{},scenes:[],assets:{1:{type:'script',file:{url:'fallback.js'}},2:{type:'script',file:{url:'glue.js'}},3:{type:'wasm',file:{url:'actual.wasm'},data:{fallbackScriptId:1,glueScriptId:2}}}};
  await writeFile(path.join(root,'config.json'),JSON.stringify(config));await writeFile(path.join(root,'fallback.js'),'var wasmBinaryFile="draco_decoder.wasm";');await writeFile(path.join(root,'glue.js'),'// glue');
  for(const repair of [false,true]){
    const m={gameUrl:base+'index.html',resources:[{url:base+'fallback.js',saved:true,path:'fallback.js',type:'script'},{url:base+'glue.js',saved:true,path:'glue.js',type:'script'},{url:base+'config.json',saved:true,path:'config.json',type:'fetch'},...(repair?[{url:base+'draco_decoder.wasm',saved:false,status:404,recoveredBy:'asset-completer',runtimeRequested:false}]:[])]};
    const result=await completeArchiveAssets(root,m,{emit:()=>{}});assert.equal(result.failedAssets,0);if(repair)assert.equal(m.resources.find(r=>r.url===base+'draco_decoder.wasm').ignored,true);
  }
  assert.equal(requests.includes('/game/draco_decoder.wasm'),false);
  missing=true;const m={gameUrl:base+'index.html',resources:[{url:base+'config.json',saved:true,path:'config.json',type:'fetch'},{url:base+'fallback.js',saved:true,path:'fallback.js',type:'script'},{url:base+'glue.js',saved:true,path:'glue.js',type:'script'}]};
  assert.equal((await completeArchiveAssets(root,m,{emit:()=>{}})).failedAssets,1);
});

test('commented out imports and JSDoc type annotations in JavaScript files are not treated as declared dependencies', async t => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(404);
    res.end('not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/game/';
  await mkdir(path.resolve('.tmp'), { recursive: true });
  const root = await mkdtemp(path.resolve('.tmp/js-comments-'));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });

  const jsContent = `
    // import * as myModule from "./mymodule.js";
    /** @type {import("../../../global").Player} */
    /*
     * import { unused } from "./commented.js";
     */
    console.log("running");
  `;
  await writeFile(path.join(root, 'main.js'), jsContent);

  const manifest = {
    gameUrl: base + 'index.html',
    resources: [
      { url: base + 'main.js', saved: true, path: 'main.js', type: 'script' },
      { url: base + 'mymodule.js', saved: false, status: 404, recoveredBy: 'asset-completer', runtimeRequested: false }
    ]
  };

  const result = await completeArchiveAssets(root, manifest, { emit: () => {} });
  assert.equal(result.failedAssets, 0);
  assert.equal(requests.includes('/game/mymodule.js'), false);
  assert.equal(requests.includes('/game/commented.js'), false);
  assert.equal(requests.includes('/global'), false);
  const mymoduleRecord = manifest.resources.find(r => r.url === base + 'mymodule.js');
  assert.equal(mymoduleRecord.ignored, true);
});

test('audio concatenation prefixes are not mistaken for complete literal sound names', async t=>{
 const requests=[],server=http.createServer((req,res)=>{requests.push(req.url);if(['/game/img/sound/win.mp3','/game/img/sound/dragon%20combo.mp3'].includes(req.url)){res.setHeader('content-type','audio/mpeg');res.end('ID3original-sound');}else{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const temporary=path.resolve('.tmp');await mkdir(temporary,{recursive:true});const root=await mkdtemp(path.join(temporary,'audio-literal-'));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));assert.equal(path.dirname(root),temporary);await rm(root,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}/game/`;
 await writeFile(path.join(root,'entry.js'),'function playSound(name){return "img/sound/"+name+".mp3";}playSound("win");playSound("dragon combo");playSound("attack_0"+counter);playSound("../invalid");throw Error("never execute publisher entry");');
 const manifest={gameUrl:base+'index.html',resources:[{url:base+'entry.js',path:'entry.js',saved:true,status:200,type:'script'}]};
 const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
 assert.equal(stats.failedAssets,0);assert.deepEqual(requests,['/game/img/sound/win.mp3','/game/img/sound/dragon%20combo.mp3']);
});

test('lazy hand icons use only declared hand table IDs regardless of scan order',async t=>{
 const requests=[],server=http.createServer((req,res)=>{requests.push(req.url);if(['/game/img/skin/hand/hand_2.png','/game/img/skin/hand/hand_8.png'].includes(req.url)){res.setHeader('content-type','image/png');res.end('original-png');}else{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const root=await mkdtemp(path.join(os.tmpdir(),'h5-hand-icons-'));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}/game/`;
 await writeFile(path.join(root,'hand.json'),JSON.stringify([{id:2},{id:8},{id:-1},{id:'99'}]));
 await writeFile(path.join(root,'entry.js'),'this["skin"]="img/skin/hand/hand_"+this["skinId"]+".png";throw Error("never execute publisher entry");');
 const manifest={gameUrl:base+'index.html',resources:[{url:base+'json/hand.json',path:'hand.json',saved:true,status:200},{url:base+'entry.js',path:'entry.js',saved:true,status:200,type:'script'}]};
 const stats=await completeArchiveAssets(root,manifest,{emit:()=>{}});
 assert.equal(stats.failedAssets,0);assert.deepEqual(requests.sort(),['/game/img/skin/hand/hand_2.png','/game/img/skin/hand/hand_8.png']);
});


test('quoted Unity JSON config declares the default data package even when ASTC was captured',async t=>{
 const requests=[],server=http.createServer((req,res)=>{requests.push(req.url);if(req.url==='/Build/default.data.br'){res.setHeader('content-type','application/octet-stream');res.end('native-default-data');}else{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/',root=await mkdtemp(path.join(os.tmpdir(),'quoted-unity-'));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 const source='<script type="application/json">{"unityConfigOptions":{"dataUrl":"'+base+'Build/default.data.br","astcDataUrl":"'+base+'Build/astc.data.br"}}</script>';
 await writeFile(path.join(root,'index.html'),source);const manifest={gameUrl:base+'index.html',resources:[{url:base+'index.html',path:'index.html',saved:true,status:200,type:'document'}]};
 await completeArchiveAssets(root,manifest,{emit:()=>{}});assert.equal(manifest.resources.find(r=>r.url===base+'Build/default.data.br')?.saved,true);assert.ok(requests.includes('/Build/default.data.br'));assert.ok(!requests.includes('/Build/astc.data.br'));
});

test('a saved HTTP error body cannot suppress repair of a runtime asset',async t=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
 const server=http.createServer((req,res)=>{res.setHeader('content-type','image/png');res.end(png);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/',root=await mkdtemp(path.join(os.tmpdir(),'saved-http-error-'));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 await writeFile(path.join(root,'scene.json'),JSON.stringify({texture:'res/a.png'}));await writeFile(path.join(root,'bad.png'),'<Error>InternalError</Error>');
 const manifest={gameUrl:base+'index.html',resources:[{url:base+'scene.json',method:'GET',status:200,saved:true,path:'scene.json',type:'xhr'},{url:base+'res/a.png',method:'GET',status:500,saved:true,path:'bad.png',type:'image',contentType:'application/xml',bytes:27}]};
 await completeArchiveAssets(root,manifest,{emit:()=>{}});const repaired=manifest.resources.find(r=>r.url===base+'res/a.png');assert.equal(repaired.status,200);assert.equal(repaired.saved,true);assert.deepEqual(await readFile(path.join(root,repaired.path)),png);
});
