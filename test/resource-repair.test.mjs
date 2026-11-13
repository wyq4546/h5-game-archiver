import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
test('resource repair rejects a publisher HTML fallback for a missing image',async t=>{
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<!DOCTYPE html><html><body>publisher fallback</body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'h5-resource-repair-'));await fs.mkdir(path.join(root,'archive'));const file=path.join(root,'archive/manifest.json');await fs.writeFile(file,JSON.stringify({sourceUrl:'http://127.0.0.1/',resources:[]}));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}/assets/triple.webp`,result=await new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,['scripts/add-archive-resources.mjs','--archive',root,'--url',url],{windowsHide:true});child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('error',reject);child.on('exit',code=>resolve({code,output}));});
 assert.notEqual(result.code,0,result.output);assert.match(result.output,/received HTML/);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).resources,[]);
});
