import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startWebUi} from '../src/web.mjs';
const run=promisify(execFile);

async function fixture(t){
 const temp=path.resolve('.tmp');await mkdir(temp,{recursive:true});const root=await mkdtemp(path.join(temp,'archive-refresh-'));
 t.after(async()=>{assert.equal(path.dirname(root),temp);await rm(root,{recursive:true,force:true});});
 const archive=path.join(root,'download','Game'),base='https://native.example/build/';
 await mkdir(path.join(archive,'archive'),{recursive:true});await mkdir(path.join(archive,'game/native.example/build'),{recursive:true});
 const files={'index.html':'<title>Game</title><script src="cocos2d-js.js"></script><script src="main.351cd.js"></script>','cocos2d-js.js':'var cc={};','main.351cd.js':'cc.game.run();'};
 for(const [name,body] of Object.entries(files))await writeFile(path.join(archive,'game/native.example/build',name),body);
 const manifest={gameUrl:base+'index.html',sourceUrl:'https://portal.example/game',platform:{mode:'iframe'},runtimeInspection:{engine:'Construct',coreReady:false,coreRule:'stale inspection'},localReplay:{status:'passed',scope:'startup-and-visible-canvas'},resources:Object.keys(files).map(name=>({url:base+name,path:'game/native.example/build/'+name,method:'GET',type:name==='index.html'?'document':'script',status:200,saved:true,bytes:files[name].length}))};
 await writeFile(path.join(archive,'archive/manifest.json'),JSON.stringify(manifest));return{root,archive,manifest};
}

test('CLI completion refreshes stale engine inspection even when no new assets were downloaded',async t=>{
 const {archive}=await fixture(t);
 await run(process.execPath,['src/cli.mjs','complete','--archive',archive],{cwd:path.resolve('.'),windowsHide:true,timeout:15000});
 const saved=JSON.parse(await readFile(path.join(archive,'archive/manifest.json'),'utf8'));
 assert.equal(saved.assetCompletion.fetchedAssets,0);
 assert.equal(saved.runtimeInspection.engine,'Cocos Creator');
 assert.equal(saved.runtimeInspection.coreReady,true);
 assert.equal(saved.completeness.status,'core-complete');
});

test('CLI completion reports failure when a native core build is still missing',async t=>{
 const {archive,manifest}=await fixture(t);
 manifest.resources=manifest.resources.filter(r=>!r.url.endsWith('cocos2d-js.js'));
 await rm(path.join(archive,'game/native.example/build/cocos2d-js.js'));
 await writeFile(path.join(archive,'game/native.example/build/index.html'),'<title>Game</title>');
 await writeFile(path.join(archive,'archive/manifest.json'),JSON.stringify(manifest));
 await assert.rejects(run(process.execPath,['src/cli.mjs','complete','--archive',archive],{cwd:path.resolve('.'),windowsHide:true,timeout:15000}),error=>error.code===2);
});

test('web reanalysis refreshes persisted runtime readiness while archive listing remains cached',async t=>{
 const {root,archive}=await fixture(t);
 const {server,url}=await startWebUi({port:0,startAnalyzer:false,downloadRoot:path.join(root,'download'),databasePath:path.join(root,'archives.sqlite')});
 try{
  const before=await (await fetch(url+'/api/archives')).json();assert.equal(before.archives[0].engine,'Construct');
  const response=await fetch(url+'/api/archives/Game/analyze',{method:'POST'});assert.equal(response.status,202);const {id}=await response.json();
  let job;for(let i=0;i<150;i++){job=await (await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(job.status,'completed',job.error);
  const saved=JSON.parse(await readFile(path.join(archive,'archive/manifest.json'),'utf8'));
  assert.equal(saved.runtimeInspection.engine,'Cocos Creator');assert.equal(saved.runtimeInspection.coreReady,true);assert.equal(saved.completeness.status,'core-complete');
  const after=await (await fetch(url+'/api/archives')).json();assert.equal(after.archives[0].engine,'Cocos Creator');assert.equal(after.archives[0].analysis.engine,'Cocos Creator');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
