import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {sha256} from '../src/utils.mjs';
import {createReplayServer} from '../src/replay.mjs';

test('offline POST responses require the captured method and exact request body', async t => {
  const temporaryRoot = path.resolve('.tmp');
  await mkdir(temporaryRoot,{recursive:true});
  const root = await mkdtemp(path.join(temporaryRoot,'post-replay-'));
  t.after(async()=>{assert.equal(path.dirname(root),temporaryRoot);await rm(root,{recursive:true,force:true});});
  await mkdir(path.join(root,'archive'));
  const origin='https://play.example',url=origin+'/level-data';
  await writeFile(path.join(root,'index.html'),'<html></html>');
  const resources=[{url:origin+'/',method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'}];
  for(const level of [1,2]) {
    const body=JSON.stringify({level});
    await writeFile(path.join(root,`level-${level}.json`),JSON.stringify({level,data:`original-${level}`}));
    resources.push({url,method:'POST',requestBodySha256:sha256(Buffer.from(body)),saved:true,status:200,type:'fetch',contentType:'application/json',path:`level-${level}.json`});
  }
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:origin+'/',resources}));
  const replay=await createReplayServer(root);
  try {
    const local=new URL('/__origin/'+Buffer.from(origin).toString('base64url')+'/level-data',replay.url);
    for(const level of [1,2]) {
      const response=await fetch(local,{method:'POST',body:JSON.stringify({level})});
      assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{level,data:`original-${level}`});
    }
    assert.equal((await fetch(local)).status,404);
    assert.equal((await fetch(local,{method:'POST',body:JSON.stringify({level:3})})).status,404);
    assert.equal((await fetch(replay.url,{method:'POST',body:'unrecorded'})).status,404);
  } finally {replay.server.closeAllConnections();await new Promise(resolve=>replay.server.close(resolve));}
});
