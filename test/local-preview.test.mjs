import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {captureLocalPreview} from '../src/local-preview.mjs';
import {isUnobscuredSurface} from '../src/capture-preview.mjs';
import {chromium} from 'playwright';

test('an unobscured canvas cannot hide a fatal local startup exception',async t=>{
  const temp=path.resolve('.tmp');await mkdir(temp,{recursive:true});
  const root=await mkdtemp(path.join(temp,'preview-failure-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'archive'));await mkdir(path.join(root,'preview'));
  const url='https://example.com/build/index.html';
  await writeFile(path.join(root,'index.html'),'<html><body style="margin:0"><canvas width="480" height="800"></canvas><script>throw new Error("Missing required SDK method");</script></body></html>');
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:url,resources:[{url,method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'}]}));
  await assert.rejects(captureLocalPreview(root),/Missing required SDK method/);
});

test('OpenFL native play gestures are exercised before accepting a local startup screenshot',async t=>{
  const temp=path.resolve('.tmp');await mkdir(temp,{recursive:true});
  const root=await mkdtemp(path.join(temp,'preview-openfl-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'archive'));await mkdir(path.join(root,'preview'));
  const url='https://example.com/build/index.html';
  await writeFile(path.join(root,'index.html'),'<html><body style="margin:0"><canvas width="480" height="800"></canvas><script>document.querySelector("canvas").addEventListener("click",()=>{throw Error("Missing pack after native play");});</script></body></html>');
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:url,runtimeInspection:{engine:'OpenFL / Lime'},resources:[{url,method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'}]}));
  await assert.rejects(captureLocalPreview(root),/Missing pack after native play/);
});

test('Construct preview waits for a late native canvas',async t=>{
  const temp=path.resolve('.tmp');await mkdir(temp,{recursive:true});const root=await mkdtemp(path.join(temp,'preview-construct-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'archive'));await mkdir(path.join(root,'preview'));
  const url='https://example.com/game/index.html';await writeFile(path.join(root,'index.html'),'<body style="margin:0"><script>setTimeout(()=>{document.body.innerHTML="<canvas width=480 height=800></canvas>";},12500)</script>');
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:url,runtimeInspection:{engine:'Construct'},resources:[{url,method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'index.html'}]}));
  assert.equal((await captureLocalPreview(root)).source,'local-replay');
});

test('only an empty transparent Construct HTML layer can cover a preview canvas',async()=>{
 const b=await chromium.launch({headless:true});try{const p=await b.newPage({viewport:{width:480,height:800}});await p.setContent('<body style="margin:0"><canvas width=480 height=800></canvas><div class=c3htmlwrap style="position:absolute;inset:0"></div>');
 assert.equal(await p.locator('canvas').evaluate(isUnobscuredSurface),true);
 await p.locator('.c3htmlwrap').evaluate(el=>el.textContent='Loading');assert.equal(await p.locator('canvas').evaluate(isUnobscuredSurface),false);
 await p.locator('.c3htmlwrap').evaluate(el=>{el.textContent='';el.style.background='black';});assert.equal(await p.locator('canvas').evaluate(isUnobscuredSurface),false);
 }finally{await b.close();}
});
