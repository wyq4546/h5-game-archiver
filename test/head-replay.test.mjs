import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createReplayServer} from '../src/replay.mjs';
import {assessCompleteness} from '../src/capture.mjs';

test('the detected native game document is preferred to a publisher wrapper',async()=>{
 const root=path.resolve('.tmp/native-entry-regression');await mkdir(path.join(root,'archive'),{recursive:true});
 const gameUrl='https://example.com/games/noodle/index.html?yad';
 const siteUrl='https://example.com/Noodle';
 const manifest={gameUrl,sourceUrl:siteUrl,finalUrl:siteUrl,resources:[
  {url:siteUrl,method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'site.html'},
  {url:gameUrl,method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'game.html'}]};
 await writeFile(path.join(root,'site.html'),'<html>publisher wrapper</html>');await writeFile(path.join(root,'game.html'),'<html>native game</html>');await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify(manifest));
 const replay=await createReplayServer(root);
 try{assert.match(await(await fetch(replay.url)).text(),/native game/);}
 finally{replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});
test('YYG daily cachebuster reuses the saved unversioned ad config only', async () => {
 const root=path.resolve('.tmp/yyg-cache-regression');await mkdir(path.join(root,'archive'),{recursive:true});
 const config='https://h5gamessdk.yyggames.com/sdk/adConfig/ad_config.json';
 const manifest={gameUrl:'https://example.com/index.html',resources:[
  {url:'https://example.com/index.html',method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'},
  {url:config,method:'GET',saved:true,status:200,type:'fetch',contentType:'application/json',path:'config.json'}]};
 await writeFile(path.join(root,'index.html'),'<html></html>');await writeFile(path.join(root,'config.json'),'{}');await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify(manifest));
 const replay=await createReplayServer(root);
 try {
  assert.equal((await fetch(replay.url+'/__resource?url='+encodeURIComponent(config+'?20260930'))).status,200);
  assert.equal((await fetch(replay.url+'/__resource?url='+encodeURIComponent(config+'?variant=other'))).status,404);
 } finally {replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});
test('successful HEAD probes survive old archives and replay without a body',async()=>{
 const root=path.resolve('.tmp/head-regression');await mkdir(path.join(root,'archive'),{recursive:true});
 const url='https://cdn.example.com/game/raw-assets/app-manifest.bin';
 const manifest={gameUrl:'https://cdn.example.com/game/index.html',runtimeInspection:{engine:'Laya',coreReady:true},resources:[
 {url:'https://cdn.example.com/game/index.html',method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'},
 {url,method:'HEAD',saved:false,status:200,type:'fetch',error:'No data found'},
 {url:url+'?v=123',method:'GET',saved:true,status:200,type:'fetch',path:'manifest.bin'}]};
 await writeFile(path.join(root,'index.html'),'<html></html>');await writeFile(path.join(root,'manifest.bin'),'binary');await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify(manifest));
 const replay=await createReplayServer(root);
 try{const r=await fetch(replay.url+'/raw-assets/app-manifest.bin',{method:'HEAD'});assert.equal(r.status,200);assert.equal(await r.text(),'');assert.equal(assessCompleteness(manifest).status,'core-complete');const get=await fetch(replay.url+'/raw-assets/app-manifest.bin');assert.equal(get.status,404,'HEAD must not invent an unversioned GET');}
 finally{replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});

test('YYG daily cachebuster reuses one archived dated payload without accepting other variants',async()=>{
 const root=path.resolve('.tmp/yyg-dated-cache-regression');await mkdir(path.join(root,'archive'),{recursive:true});
 const config='https://h5gamessdk.yyggames.com/sdk/adConfig/ad_config.json';
 const resources=[{url:'https://example.com/index.html',method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'},{url:config+'?20261010',method:'GET',saved:true,status:200,type:'fetch',contentType:'application/json',path:'config.json',sha256:'captured-one'}];
 await writeFile(path.join(root,'index.html'),'<html></html>');await writeFile(path.join(root,'config.json'),'{"archived":true}');await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:resources[0].url,resources}));
 let replay=await createReplayServer(root);
 try{
  const response=await fetch(replay.url+'/__resource?url='+encodeURIComponent(config+'?20261014'));assert.equal(response.status,200);assert.deepEqual(await response.json(),{archived:true});
  assert.equal((await fetch(replay.url+'/__resource?url='+encodeURIComponent(config+'?variant=other'))).status,404);
 }finally{replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));}
 resources.push({...resources[1],url:config+'?20261011',path:'other.json',sha256:'captured-two'});await writeFile(path.join(root,'other.json'),'{"different":true}');await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:resources[0].url,resources}));replay=await createReplayServer(root);
 try{assert.equal((await fetch(replay.url+'/__resource?url='+encodeURIComponent(config+'?20261014'))).status,404,'conflicting recorded payloads cannot be selected arbitrarily');}
 finally{replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});

test('saved HTTP error bodies remain errors in replay and completeness',async()=>{
 const root=path.resolve('.tmp/http-error-regression');await mkdir(path.join(root,'archive'),{recursive:true});
 const manifest={gameUrl:'https://example.com/game/index.html',runtimeInspection:{engine:'Laya',coreReady:true},resources:[{url:'https://example.com/game/index.html',method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'},{url:'https://example.com/game/scene.json',method:'GET',saved:true,status:404,type:'fetch',contentType:'text/html',path:'error.html'}]};
 await writeFile(path.join(root,'index.html'),'<html></html>');await writeFile(path.join(root,'error.html'),'Not found');await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify(manifest));const replay=await createReplayServer(root);
 try{assert.equal((await fetch(replay.url+'/scene.json')).status,404);assert.equal(assessCompleteness(manifest).status,'incomplete');}
 finally{replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});

test('SDK version maps retain original URLs for SDK host validation',async()=>{
 const root=path.resolve('.tmp/sdk-map-regression');await mkdir(path.join(root,'archive'),{recursive:true});const base='https://example.com/game/';
 const mapping={a:'https://example.com/game/a.png'};const manifest={gameUrl:base+'index.html',resources:[{url:base+'index.html',method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'},{url:base+'gameSDK/ui/version.json',method:'GET',saved:true,status:200,type:'fetch',contentType:'application/json',path:'version.json'},{url:mapping.a,method:'GET',saved:true,status:200,type:'image',path:'a.png'}]};
 await writeFile(path.join(root,'index.html'),'<html></html>');await writeFile(path.join(root,'version.json'),JSON.stringify(mapping));await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify(manifest));const replay=await createReplayServer(root);
 try{assert.deepEqual(await (await fetch(replay.url+'/gameSDK/ui/version.json')).json(),mapping);}
 finally{replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});
