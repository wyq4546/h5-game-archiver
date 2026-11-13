import test from 'node:test';
import assert from 'node:assert/strict';
import {webpackChunkDependencies} from '../src/webpack-assets.mjs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {completeArchiveAssets} from '../src/asset-completer.mjs';
test('webpack literal names and common build hash include numeric fallback chunks',()=>{
 const source='__webpack_require__.u=e=>(({123:"gs.overlay",7:"i18n/en-json"})[e]||e)+".9e758e8d1d85df8da18b.js";Promise.all([__webpack_require__.e(1914),__webpack_require__.e(123),__webpack_require__.e(9026)]);';
 assert.deepEqual([...webpackChunkDependencies(source)].sort(),['1914.9e758e8d1d85df8da18b.js','9026.9e758e8d1d85df8da18b.js','gs.overlay.9e758e8d1d85df8da18b.js','i18n/en-json.9e758e8d1d85df8da18b.js'].sort());
});
test('chunk dependencies do not execute calls or infer an unbounded loader range',()=>{
 assert.equal(webpackChunkDependencies('w.u=id=>dangerous(id)+".js";w.e(2);').size,0);
 assert.equal(webpackChunkDependencies('w.u=id=>id+".js";other.e(500);').size,0);
 assert.equal(webpackChunkDependencies('w.u=id=>"https://example.com/"+id+".js";w.e(4);').size,0);
});
test('webpack ternaries and per-chunk literal hashes remain bounded',()=>{
 assert.deepEqual([...webpackChunkDependencies('w.u=id=>(id===4?"small":id)+"."+({4:"ab",5:"cd"})[id]+".js";w.e(4);w.e(5);')].sort(),['5.cd.js','small.ab.js']);
});
test('declared literal build-hash getters and module require aliases match the native SDK',()=>{
 const source='var modules={1:(module,exports,require)=>Promise.all([require.e(1914),require.e(9206)])};w.u=id=>(({1634:"gs.windows"})[id]||id)+"."+w.h()+".js";w.h=()=>"9e758e8d1d85df8da18b";';
 assert.deepEqual([...webpackChunkDependencies(source)].sort(),['1634','1914','9206'].map(id=>(id==='1634'?'gs.windows':id)+'.9e758e8d1d85df8da18b.js').sort());
 assert.equal(webpackChunkDependencies('w.u=id=>id+"."+w.h()+".js";w.h=()=>fetch("secret");w.e(1);').size,0);
});
test('archive completion fetches the SDK lazy scripts over HTTP without executing publisher code',async t=>{
 const received=[],server=http.createServer((req,res)=>{received.push(req.url);if(['/sdk/1914.build.js','/sdk/gs.overlay.build.js'].includes(req.url)){res.setHeader('content-type','application/javascript');res.end('throw new Error("publisher code must never execute during completion");');}else res.writeHead(404).end();});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,temp=path.resolve(os.tmpdir(),'h5-webpack-assets');await mkdir(temp,{recursive:true});const root=await mkdtemp(path.join(temp,'case-'));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));assert.equal(path.dirname(path.resolve(root)),temp);await rm(root,{recursive:true,force:true});});
 await mkdir(path.join(root,'game'));const source='var modules={1:(a,b,n)=>n.e(1914)};r.u=id=>(({42:"gs.overlay"})[id]||id)+"."+r.h()+".js";r.h=()=>"build";';await writeFile(path.join(root,'game','sdk.js'),source);
 const manifest={gameUrl:origin+'/game.html',resources:[{url:origin+'/sdk/game-score.js?projectId=1',method:'GET',path:'game/sdk.js',saved:true,status:200,type:'script',contentType:'application/javascript',bytes:source.length}]};
 const result=await completeArchiveAssets(root,manifest,{emit:()=>{}});assert.equal(result.failedAssets,0);assert.ok(received.includes('/sdk/1914.build.js'));assert.ok(received.includes('/sdk/gs.overlay.build.js'));assert.ok(manifest.resources.find(r=>r.url===origin+'/sdk/1914.build.js')?.saved);
});
