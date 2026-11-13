import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createReplayServer} from '../src/replay.mjs';

test('Poki offline replay uses the allowed localhost host and completes SDK startup without a portal parent', async t => {
  const temp = path.resolve('.tmp'); await mkdir(temp,{recursive:true});
  const root = await mkdtemp(path.join(temp,'poki-replay-'));
  await mkdir(path.join(root,'archive')); await mkdir(path.join(root,'game'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const url='https://game-id.gdn.poki.com/build/index.html?hoist=yes&mode=normal&gdmode=mobile&speed=1.5';
  const sdk='https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
  const body=`<html><head><script src="${sdk.replace('https:','')}"></script></head><body>
    <script>if(location.hostname!=='localhost')location.href='https://poki.com/sitelock';
    window.config={mode:PokiSDK.getURLParam('mode'),speed:PokiSDK.getURLParam('speed'),absent:PokiSDK.getURLParam('absent')};
    PokiSDK.movePill(0,0);PokiSDK.measure('missions','word_hunt','start');PokiSDK.customEvent('game','start');PokiSDK.happyTime();
    PokiSDK.init().then(()=>PokiSDK.commercialBreak()).then(async()=>{window.nativeReady=true;window.reward=await PokiSDK.rewardedBreak();window.telemetryQueued=navigator.sendBeacon('https://leveldata.poki.io/fancade-longcat','game-id');});</script></body></html>`;
  const original='window.PokiSDK={init:()=>new Promise(()=>{})};';
  await writeFile(path.join(root,'game/index.html'),body);
  await writeFile(path.join(root,'game/sdk.js'),original);
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({sourceUrl:'https://poki.com/en/g/longcat',gameUrl:url,platform:{id:'poki',mode:'iframe'},resources:[
    {url,method:'GET',saved:true,status:200,type:'document',contentType:'text/html',path:'game/index.html'},
    {url:sdk,method:'GET',saved:true,status:200,type:'script',contentType:'application/javascript',path:'game/sdk.js'}
  ]}));
  const replay=await createReplayServer(root);
  const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
  try {
    const info = await (await fetch(new URL('/__archive_info', replay.url))).json();
    assert.equal(info.replayUrl, replay.url, 'Windows launcher must receive the allowed hostname and original entry query');
    const page=await browser.newPage();
    page.setDefaultTimeout(1200);
    const loopback=new URL(replay.url);loopback.hostname='localhost';
    const external=[];
    await page.route('**/*', route=>{
      if(new URL(route.request().url()).origin!==loopback.origin){external.push(route.request().url());return route.abort();}
      return route.continue();
    });
    await page.goto(loopback.href);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.nativeReady),true);
    assert.deepEqual(await page.evaluate(()=>window.config),{mode:'mobile',speed:'1.5',absent:null});
    assert.equal(await page.evaluate(()=>window.reward),false);
    assert.equal(await page.evaluate(()=>window.telemetryQueued),false);
    assert.equal(new URL(replay.url).hostname,'localhost');
    assert.deepEqual(external,[]);
    assert.equal(await readFile(path.join(root,'game/sdk.js'),'utf8'),original);
  } finally {await browser.close();replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));}
});
