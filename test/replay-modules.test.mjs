import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createReplayServer} from '../src/replay.mjs';

test('offline module URLs retain their original directory for sibling imports and import.meta.url', async t => {
  const temporaryRoot = path.resolve('.tmp');
  await mkdir(temporaryRoot, {recursive:true});
  const root = await mkdtemp(path.join(temporaryRoot, 'module-replay-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temporaryRoot);
    await rm(root, {recursive:true, force:true});
  });
  await mkdir(path.join(root, 'archive'));
  await mkdir(path.join(root, 'game'));
  const origin = 'https://play.example';
  const files = [
    {url:origin+'/', path:'game/index.html', type:'document', contentType:'text/html', body:'<script type="module" src="/assets/main.js"></script>'},
    {url:origin+'/assets/main.js', path:'game/main.js', type:'script', contentType:'application/javascript', body:'import {value} from "./sibling.js"; const text=await fetch(new URL("./data.txt",import.meta.url)).then(r=>r.text()); window.moduleResult={value,text};'},
    {url:origin+'/assets/sibling.js', path:'game/sibling.js', type:'script', contentType:'application/javascript', body:'export const value=42;'},
    {url:origin+'/assets/data.txt', path:'game/data.txt', type:'fetch', contentType:'text/plain', body:'original asset'},
  ];
  for (const file of files) await writeFile(path.join(root,file.path),file.body);
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:origin+'/', resources:files.map(({body,...file})=>({...file,method:'GET',saved:true,status:200}))}));
  const replay = await createReplayServer(root);
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage(), failures = [];
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(replay.url).origin ? route.continue() : route.abort());
    page.on('response', response => {if(response.status()>=400)failures.push(response.url());});
    await page.goto(replay.url);
    await page.waitForFunction(()=>window.moduleResult, null, {timeout:1500}).catch(()=>{});
    assert.deepEqual(await page.evaluate(()=>window.moduleResult), {value:42,text:'original asset'});
    assert.deepEqual(failures, []);
  } finally {
    await browser.close();
    replay.server.closeAllConnections();
    await new Promise(resolve=>replay.server.close(resolve));
  }
});
