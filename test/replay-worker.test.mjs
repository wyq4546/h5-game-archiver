import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createReplayServer} from '../src/replay.mjs';

test('SDK Worker messages load archived URLs and preserve transferred buffers',async()=>{
 const root=path.resolve('.tmp/worker-replay-regression');await mkdir(path.join(root,'archive'),{recursive:true});
 const source='https://example.com/index.html',config='https://cdn.example/config.txt';
 const document=`<html><head></head><body><script>
 const worker=new Worker(URL.createObjectURL(new Blob([
  'onmessage=e=>{const xhr=new XMLHttpRequest();xhr.open("GET",e.data.url);xhr.onload=()=>postMessage({body:xhr.responseText,bytes:e.data.payload.byteLength});xhr.send();}'
 ],{type:'application/javascript'})));
 worker.onmessage=e=>window.result=e.data;
 const payload=new ArrayBuffer(42);
 worker.postMessage({url:['https:', '//cdn.example', '/config.txt'].join(''),payload},[payload]);
 window.detached=payload.byteLength;
 </script></body></html>`;
 await writeFile(path.join(root,'index.html'),document);await writeFile(path.join(root,'config.txt'),'archived-config');
 await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:source,resources:[
  {url:source,method:'GET',status:200,saved:true,type:'document',contentType:'text/html',path:'index.html'},
  {url:config,method:'GET',status:200,saved:true,type:'fetch',contentType:'text/plain',path:'config.txt'}]}));
 const replay=await createReplayServer(root);const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(replay.url).origin?r.continue():r.abort());
  await page.goto(replay.url);await page.waitForFunction(()=>window.result,null,{timeout:3000});
  assert.deepEqual(await page.evaluate(()=>({result:window.result,detached:window.detached})),{result:{body:'archived-config',bytes:42},detached:0});
  await page.evaluate(()=>{window.YYGGames={showInterstitial(){throw Error('unavailable offline ad configuration');},showReward(){return 'reward untouched';}};});
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>{let calls=0;YYGGames.showInterstitial(()=>calls++);return {calls,reward:YYGGames.showReward()};}),{calls:1,reward:'reward untouched'});
 }finally{await browser.close();replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});
