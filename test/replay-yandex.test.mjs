import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createReplayServer} from '../src/replay.mjs';

test('archived Yandex SDK entry and version bundle cannot restore ads; all ad calls close without rewards or banners',async()=>{
 const root=path.resolve('.tmp/yandex-adfree-replay-regression');await mkdir(path.join(root,'archive'),{recursive:true});
 const origin='https://app-286727.games.s3.yandex.net',sdkPaths=['/sdk.js','/sdk/_/v2.captured.js'];
 const document='<html><head><script src="/sdk.js"></script><script src="/sdk/_/v2.captured.js"></script></head><body><canvas width="450" height="800"></canvas></body></html>';
 const resources=[{url:origin+'/286727/index.html',path:'index.html',type:'document',contentType:'text/html'},...sdkPaths.map((p,i)=>({url:origin+p,path:`sdk${i}.js`,type:'script',contentType:'application/javascript'}))].map(x=>({...x,method:'GET',saved:true,status:200}));
 await writeFile(path.join(root,'index.html'),document);
 for(let i=0;i<2;i++)await writeFile(path.join(root,`sdk${i}.js`),'window.publisherSdkExecuted=true;window.YaGames={init:async()=>{throw Error("publisher ads restored")}};');
 await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:resources[0].url,resources}));
 const replay=await createReplayServer(root),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.goto(replay.url);
  const result=await page.evaluate(async()=>{
   const sdk=await YaGames.init();let reward=0,closed=0,wasShown;
   await sdk.adv.showBannerAdv();
   await new Promise(r=>sdk.adv.showFullscreenAdv({callbacks:{onClose(v){wasShown=v;closed++;r();}}}));
   await new Promise(r=>sdk.adv.showRewardedVideo({callbacks:{onRewarded(){reward++;},onClose(){closed++;r();}}}));
   await sdk.adv.hideBannerAdv();
   return {publisherExecuted:!!window.publisherSdkExecuted,wasShown,closed,reward,banner:await sdk.adv.getBannerAdvStatus(),iframes:document.querySelectorAll('iframe').length};
  });
  const unavailable=await page.evaluate(async()=>{const sdk=await YaGames.init();let opened=0,closed=0;const message=await new Promise(resolve=>sdk.adv.showFullscreenAdv({callbacks:{onOpen(){opened++;throw Error('audio not initialized');},onClose(){closed++;},onError(error){resolve(error.message);}}}));return {opened,closed,message};});
  assert.equal(unavailable.opened,0);assert.equal(unavailable.closed,0);assert.match(unavailable.message,/unavailable offline/);
  assert.deepEqual(result,{publisherExecuted:false,wasShown:false,closed:2,reward:0,banner:{stickyAdvIsShowing:false,reason:'offline'},iframes:0});assert.deepEqual(errors,[]);assert.equal(requests.some(u=>new URL(u).origin!==new URL(replay.url).origin),false);
 }finally{await browser.close();replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});

test('offline Unity Yandex wrapper initializes anonymous player before the delayed loader and preserves structured saves',async()=>{
  const root=path.resolve('.tmp/yandex-replay-regression');await mkdir(path.join(root,'archive'),{recursive:true});
  const origin='https://app-454453.games.s3.yandex.net';
  const document=`<html><head></head><body><script>
  let StartUnityInstance;let player=null;const spinner={style:{display:'block'}};
  function LocalHost(){return location.hostname==='127.0.0.1';}
  function StartUnityInstance_IfUnloaded(){if(spinner.style.display!=='none')StartUnityInstance();}
  async function InitYSDK(){if(LocalHost())return;const sdk=await YaGames.init();player=await sdk.getPlayer();window.sdk=sdk;window.auth={mode:player.getMode(),paying:player.getPayingStatus()};StartUnityInstance_IfUnloaded();}
  InitYSDK();
  setTimeout(()=>{StartUnityInstance=()=>{window.starts=(window.starts||0)+1;spinner.style.display='none';};if(LocalHost())StartUnityInstance_IfUnloaded();},75);
  </script></body></html>`;
  const resources=[
    {url:origin+'/454453/index.html',path:'index.html',type:'document',contentType:'text/html'},
    {url:origin+'/454453/Build/game.wasm',path:'game.wasm',type:'fetch',contentType:'application/wasm'},
    {url:origin+'/sdk.js',path:'sdk.js',type:'script',contentType:'application/javascript'},
  ].map(item=>({...item,method:'GET',status:200,saved:true}));
  await writeFile(path.join(root,'index.html'),document);await writeFile(path.join(root,'game.wasm'),Buffer.from([0,97,115,109,1,0,0,0]));await writeFile(path.join(root,'sdk.js'),'');
  await writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:resources[0].url,resources}));
  const replay=await createReplayServer(root);const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 Android Mobile'});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(replay.url);await page.waitForFunction(()=>window.starts===1&&window.auth,null,{timeout:3000});
    const result=await page.evaluate(async()=>{
      const player=await sdk.getPlayer();const value={saves:['native-json',JSON.stringify({painted:4})],flags:{sound:true}};
      await player.setData(value);const data=await player.getData(['saves','flags','missing']);
      let reward=0,closed=0,shown=null;
      await new Promise(resolve=>sdk.adv.showRewardedVideo({callbacks:{onRewarded(){reward++;},onClose(){closed++;resolve();}}}));
      await new Promise(resolve=>sdk.adv.showFullscreenAdv({callbacks:{onClose(value){shown=value;resolve();}}}));
      let paymentRejected=false;try{await (await sdk.getPayments()).purchase({id:'test'});}catch{paymentRejected=true;}
      return {data,auth,starts,mobile:sdk.deviceInfo.isMobile(),appId:sdk.environment.app.id,reward,closed,shown,paymentRejected};
    });
    assert.deepEqual(result,{data:{saves:['native-json','{"painted":4}'],flags:{sound:true}},auth:{mode:'lite',paying:'unknown'},starts:1,mobile:true,appId:'454453',reward:0,closed:1,shown:false,paymentRejected:true});
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>{localStorage.setItem('unrelated-secret','private');localStorage.setItem('h5-archive:another-app:saves','private');});
    assert.deepEqual(await page.evaluate(async()=>(await sdk.getPlayer()).getData()),{saves:['native-json','{"painted":4}'],flags:{sound:true}});
    assert.deepEqual(await page.evaluate(async()=>(await sdk.getPlayer()).getData([])),{});
    await page.reload();await page.waitForFunction(()=>window.starts===1,null,{timeout:3000});
    assert.deepEqual(await page.evaluate(async()=>(await sdk.getPlayer()).getData(['saves'])),{saves:['native-json','{"painted":4}']});
    assert.deepEqual(await page.evaluate(async()=>(await sdk.getPlayer()).getData()),{saves:['native-json','{"painted":4}'],flags:{sound:true}});
  }finally{await browser.close();replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await rm(root,{recursive:true,force:true});}
});

test('offline Laya Yandex startup reaches the bundle after storage and game recommendations initialize', async () => {
  const root = path.resolve('.tmp/yandex-laya-replay-regression');
  await mkdir(path.join(root, 'archive'), {recursive: true});
  const origin = 'https://app-239150.games.s3.yandex.net';
  const document = `<html><head></head><body><script>
    YaGames.init().then(async sdk => {
      const storage = await sdk.getStorage();
      storage.setItem('level', '7');
      const recommendations = await sdk.features.GamesAPI.getAllGames();
      window.loaded = {level: storage.getItem('level'), recommendations};
      const canvas = document.createElement('canvas');canvas.width=450;canvas.height=800;document.body.append(canvas);
    }).catch(error => { window.startupError = error.message; });
  </script></body></html>`;
  const resources = [
    {url: origin+'/239150/index.html', path:'index.html', type:'document', contentType:'text/html'},
    {url: origin+'/239150/index.js', path:'index.js', type:'script', contentType:'application/javascript'},
    {url: origin+'/sdk.js', path:'sdk.js', type:'script', contentType:'application/javascript'}
  ].map(item => ({...item, method:'GET', status:200, saved:true}));
  await writeFile(path.join(root, 'index.html'), document);
  await writeFile(path.join(root, 'index.js'), '');
  await writeFile(path.join(root, 'sdk.js'), '');
  await writeFile(path.join(root, 'archive/manifest.json'), JSON.stringify({gameUrl:resources[0].url, runtimeInspection:{coreFiles:['index.js']}, resources}));
  const replay = await createReplayServer(root);
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.goto(replay.url);
    await page.waitForFunction(() => window.loaded || window.startupError);
    assert.equal(await page.evaluate(() => window.startupError), undefined);
    assert.deepEqual(await page.evaluate(() => window.loaded), {level:'7', recommendations:{games:[], developerURL:''}});
    assert.equal(await page.locator('canvas').count(), 1);
  } finally {
    await browser.close();replay.server.closeAllConnections();await new Promise(resolve => replay.server.close(resolve));
    await rm(root, {recursive:true, force:true});
  }
});

test('offline Construct Yandex plugin initializes serverTime, isAvailableMethod, onEvent, and EVENTS', async () => {
  const root = path.resolve('.tmp/yandex-construct-replay-regression');
  await mkdir(path.join(root, 'archive'), {recursive: true});
  const origin = 'https://app-286727.games.s3.yandex.net';
  const document = `<html><head></head><body><script>
    YaGames.init().then(async ysdk => {
      let backHandled = false;
      ysdk.onEvent(ysdk.EVENTS.HISTORY_BACK, () => { backHandled = true; });
      ysdk.dispatchEvent(ysdk.EVENTS.HISTORY_BACK);
      const serverTime = ysdk.serverTime();
      const available = await ysdk.isAvailableMethod('leaderboards.setLeaderboardScore');
      ysdk.features.PluginEngineDataReporterAPI.report({ engine: 'Construct' });
      window.sdkTest = {
        serverTimeIsNumber: typeof serverTime === 'number' && serverTime > 0,
        available,
        backHandled,
        hasEvents: Boolean(YaGames.EVENTS && ysdk.EVENTS),
      };
      const canvas = document.createElement('canvas');canvas.width=450;canvas.height=800;document.body.append(canvas);
    }).catch(error => { window.sdkError = error.message; });
  </script></body></html>`;
  const resources = [
    {url: origin+'/286727/index.html', path:'index.html', type:'document', contentType:'text/html'},
    {url: origin+'/sdk.js', path:'sdk.js', type:'script', contentType:'application/javascript'}
  ].map(item => ({...item, method:'GET', status:200, saved:true}));
  await writeFile(path.join(root, 'index.html'), document);
  await writeFile(path.join(root, 'sdk.js'), '');
  await writeFile(path.join(root, 'archive/manifest.json'), JSON.stringify({gameUrl:resources[0].url, resources}));
  const replay = await createReplayServer(root);
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.goto(replay.url);
    await page.waitForFunction(() => window.sdkTest || window.sdkError);
    assert.equal(await page.evaluate(() => window.sdkError), undefined);
    const result = await page.evaluate(() => window.sdkTest);
    assert.deepEqual(result, {
      serverTimeIsNumber: true,
      available: false,
      backHandled: true,
      hasEvents: true
    });
  } finally {
    await browser.close();replay.server.closeAllConnections();await new Promise(resolve => replay.server.close(resolve));
    await rm(root, {recursive:true, force:true});
  }
});
