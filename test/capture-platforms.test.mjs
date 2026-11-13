import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import * as capture from '../src/capture.mjs';
import { isNoiseUrl } from '../src/noise-url.mjs';

test('Yandex accepts its new native CDN while rejecting storage helpers, forged hosts and conflicting app identities', async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),source='https://yandex.com/games/zh/app/apple-worm-snake-puzzle-416988',game='https://app-416988.cdn.games.yandex.net/416988/build/index.html?sdk=%2Fsdk.js#origin=https%3A%2F%2Fyandex.com&app-id=416988';
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:''}));await page.goto(source);
  const invalid=['https://app-416988.cdn.games.yandex.net/helpers/storage/preloader.html','https://app-999.cdn.games.yandex.net/416988/build/index.html#app-id=416988','https://app-416988.cdn.games.yandex.net/999/build/index.html','https://app-416988.cdn.games.yandex.net.attacker.example/416988/build/index.html','https://app-416988.cdn.games.yandex.net/416988/build/index.html#app-id=999'];
  await page.setContent(invalid.map(u=>`<iframe src="${u}"></iframe>`).join(''));
  await assert.rejects(capture.resolvePlatformGameEntry(page,{sourceUrl:source,interact:false,timeoutMs:300}),/未找到.*416988/);
  await page.evaluate(u=>{const f=document.createElement('iframe');f.src=u;document.body.append(f);},game);
  const entry=await capture.resolvePlatformGameEntry(page,{sourceUrl:source,interact:false,timeoutMs:1000});assert.equal(entry.entryUrl,game);assert.equal(entry.mode,'iframe');assert.equal(page.url(),source);
 }finally{await browser.close();}
});

test('Poki activates its mobile Play now tile before waiting for the publisher frame', async () => {
  const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
  try {
    const page=await browser.newPage({isMobile:true,hasTouch:true});
    const source='https://poki.com/en/g/longcat';
    const native='https://game-id.gdn.poki.com/build/index.html?hoist=yes';
    await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:''}));
    await page.goto(source);
    await page.setContent(`<button id="play-game-tile">Play now</button><script>document.getElementById('play-game-tile').onclick=()=>{const f=document.createElement('iframe');f.src=${JSON.stringify(native)};document.body.append(f)};</script>`);
    const entry=await capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:1000,interact:true});
    assert.equal(entry.entryUrl,native);
    assert.equal(entry.activation.clicked,true);
    assert.equal(entry.mode,'iframe');
  } finally {await browser.close();}
});

test('Poki retries a still-visible mobile tile after its delayed client hydration', async () => {
  const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
  try {
    const page=await browser.newPage({isMobile:true,hasTouch:true});
    const source='https://poki.com/en/g/longcat';
    const native='https://game-id.gdn.poki.com/build/index.html';
    await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:''}));
    await page.goto(source);
    await page.setContent(`<button id="play-game-tile">Play now</button><script>setTimeout(()=>{document.getElementById('play-game-tile').onclick=()=>{const f=document.createElement('iframe');f.src=${JSON.stringify(native)};document.body.append(f)};},250);</script>`);
    const entry=await capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:1800,interact:true});
    assert.equal(entry.entryUrl,native);
    assert.equal(entry.activation.clicked,true);
  } finally {await browser.close();}
});

test('Poki waits for the native nested gdn.poki.com frame and preserves its SDK parent', async () => {
  const browser = await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
  try {
    const page = await browser.newPage();
    const source = 'https://poki.com/en/g/longcat';
    const native = 'https://game-id.gdn.poki.com/version/index.html?hoist=yes&device=mobile';
    await page.route('**/*', route => route.fulfill({contentType:'text/html',body:''}));
    await page.goto(source);
    await page.setContent(`<iframe src="https://games.poki.com/123/game-id"></iframe>
      <script>setTimeout(()=>{const f=document.createElement('iframe');f.src=${JSON.stringify(native)};document.body.append(f)},150)</script>`);
    const entry = await capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:1500,interact:false});
    assert.equal(entry.entryUrl,native);
    assert.equal(entry.mode,'iframe');
    await page.setContent('<iframe src="https://ads.example/index.html"></iframe>');
    await assert.rejects(capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:250,interact:false}), /Poki.*真实游戏/);
  } finally {await browser.close();}
});

test('capture selects a platform from the source host with strict domain boundaries', () => {
  for (const [url, id] of [
    ['https://playhop.com/zh/app/454453', 'playhop'],
    ['https://yandex.ru/games/app/454453', 'yandex-games'],
    ['https://www.yad.com/Coffee-Stack', 'yad'],
    ['https://www.freegame.com/game/bubbles', 'freegame'],
    ['https://www.y8.com/games/example', 'y8'],
    ['https://html5.gamedistribution.com/abc/', 'gamedistribution'],
    ['https://www.crazygames.com/game/pencil-rush', 'crazygames'],
    ['https://playhop.com.attacker.example/app/454453', 'generic'],
    ['https://example.org/playhop.com', 'generic']
  ]) assert.equal(capture.identifyCapturePlatform(url).id, id);
});

test('CrazyGames selects the nested publisher frame instead of its SDK shell', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage(),source='https://www.crazygames.com/game/pencil-rush';
    const publisher='https://pencil-rush.game-files.crazygames.com/pencil-rush/7/index.html?native=true';
    await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:route.request().url()===source?'<iframe src="https://games.crazygames.com/en_US/pencil-rush/index.html"></iframe>':route.request().url().includes('games.crazygames.com/en_US')?`<iframe src="${publisher}"></iframe>`:'<canvas></canvas>'}));
    await page.goto(source);await page.waitForFunction(()=>document.querySelector('iframe'));
    const result=await capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:1500});
    assert.equal(result.entryUrl,publisher);assert.equal(result.mode,'iframe');assert.equal(page.url(),source);
  }finally{await browser.close();}
});

test('CrazyGames follows its declared external publisher and rejects unrelated frames', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage(), source = 'https://www.crazygames.com/game/honk';
    const bridge = 'https://games.crazygames.com/en_US/honk/index.html';
    const publisher = 'https://playhonk.gg/?platform=crazygames';
    await page.route('**/*', route => route.fulfill({contentType:'text/html', body:
      route.request().url() === source ? `<iframe src="https://unrelated.example/game.html"></iframe><iframe src="${bridge}"></iframe>` :
      route.request().url() === bridge ? `<script>var options={loader:"iframe",loaderOptions:{url:"https://playhonk.gg?platform=crazygames"}};</script><iframe src="https://ads.example/game.html"></iframe><iframe src="${publisher}"></iframe>` : '<canvas></canvas>'}));
    await page.goto(source);
    const result = await capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:1000});
    assert.equal(result.entryUrl, publisher);
    assert.equal(result.mode, 'iframe');
    assert.equal(page.url(), source);
    const bridgeFrame = page.frames().find(frame=>frame.url()===bridge);
    await bridgeFrame.locator('iframe').last().evaluate(element=>element.remove());
    await assert.rejects(capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:150}), /CrazyGames.*真实游戏/);
  } finally {await browser.close();}
});

test('CrazyGames activates mobile Play now before waiting for a declared publisher', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({isMobile:true,hasTouch:true});
    const source='https://www.crazygames.com/game/honk',bridge='https://games.crazygames.com/en_US/honk/index.html',publisher='https://playhonk.gg/?platform=crazygames';
    await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:route.request().url()===source?
      `<button>Play now</button><iframe src="${bridge}"></iframe><script>document.querySelector('button').onclick=()=>document.querySelector('iframe').contentWindow.postMessage('boot','https://games.crazygames.com');</script>`:
      route.request().url()===bridge?`<script>var options={loader:'iframe',loaderOptions:{url:'${publisher}'}};addEventListener('message',event=>{if(event.data==='boot'){const frame=document.createElement('iframe');frame.src='${publisher}';document.body.append(frame);}});</script>`:'<canvas></canvas>'}));
    await page.goto(source);
    const result=await capture.resolvePlatformGameEntry(page,{sourceUrl:source,timeoutMs:1500,interact:true});
    assert.equal(result.entryUrl,publisher);
    assert.equal(result.activation.clicked,true);
    assert.equal(page.url(),source);
  } finally {await browser.close();}
});

test('platform discovery clicks the portal guard and preserves the SDK parent while selecting the matching app frame', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const source = 'https://playhop.com/zh/app/454453';
    const game = 'https://app-454453.games.s3.yandex.net/454453/build/index.html?sdk=%2Fsdk.js#origin=https%3A%2F%2Fplayhop.com&app-id=454453';
    const requests = [];
    await page.route('**/*', async route => {
      const url = route.request().url(); requests.push(url);
      if (url === source) return route.fulfill({ contentType: 'text/html', body: `<title>Portal</title>
        <iframe src="https://app-999.games.s3.yandex.net/999/ad/index.html"></iframe>
        <button data-guard-accept>Play now</button><script>
        document.querySelector('button').onclick=()=>{const f=document.createElement('iframe');f.src=${JSON.stringify(game)};document.body.append(f);
        window.addEventListener('message',e=>{if(e.data==='ready')e.source.postMessage('boot',new URL(f.src).origin)});};</script>` });
      if (/app-454453/.test(url)) return route.fulfill({ contentType: 'text/html', body: `<script>
        window.addEventListener('message',e=>{if(e.origin==='https://playhop.com'&&e.data==='boot')fetch('/Build/game.wasm')});parent.postMessage('ready','https://playhop.com');</script>` });
      return route.fulfill({ contentType: 'application/wasm', body: 'fixture' });
    });
    await page.goto(source);
    const entry = await capture.resolvePlatformGameEntry(page, { sourceUrl: source, timeoutMs: 3000 });
    assert.equal(entry.platform.id, 'playhop');
    assert.equal(entry.mode, 'iframe');
    assert.equal(entry.entryUrl, game);
    assert.equal(entry.activation.clicked, true);
    assert.equal(page.url(), source);
    await page.waitForTimeout(100);
    assert.ok(requests.includes('https://app-454453.games.s3.yandex.net/Build/game.wasm'), 'real parent handshake must trigger the build request');
  } finally { await browser.close(); }
});

test('FreeGame uses the designated frame; Y8 resolves lazy data-src; unknown SDK embeddings retain their parent', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '' }));
    await page.setContent('<iframe src="https://ads.example/index.html"></iframe><iframe name="play_game_frame" src="https://cdn.freegame.com/game/index.html"></iframe>');
    const free = await capture.resolvePlatformGameEntry(page, { sourceUrl: 'https://freegame.com/game/a', timeoutMs: 1000 });
    assert.equal(free.entryUrl, 'https://cdn.freegame.com/game/index.html');
    await page.setContent('<div id="item-direct-container" data-src="https://cdn.example/game/index.html"></div>');
    const y8 = await capture.resolvePlatformGameEntry(page, { sourceUrl: 'https://y8.com/games/a', timeoutMs: 1000 });
    assert.equal(y8.mode, 'direct');
    assert.equal(y8.entryUrl, 'https://cdn.example/game/index.html');
    const source = 'https://example.org/game';
    const child = 'https://games.example/index.html#origin=https%3A%2F%2Fexample.org';
    await page.goto(source);
    await page.setContent(`<iframe src="${child}"></iframe>`);
    const generic = await capture.resolvePlatformGameEntry(page, { sourceUrl: source, timeoutMs: 1000 });
    assert.equal(generic.mode, 'iframe', 'the first hop must apply the parent dependency check too');
    assert.equal(generic.entryUrl, child);
  } finally { await browser.close(); }
});

test('Yandex telemetry is noise without discarding game storage, SDKs or payment API requests', () => {
  for (const url of ['https://mc.yandex.com/clmap/92757394?pointer=1', 'https://mc.yandex.ru/watch/1', 'https://mc.webvisor.org/watch/1'])
    assert.equal(isNoiseUrl(url), true, url);
  for (const url of ['https://app-454453.games.s3.yandex.net/sdk.js', 'https://yandex.ru/games/api/sdk/v1/payments', 'https://mc.yandex.com.attacker.example/game.wasm'])
    assert.equal(isNoiseUrl(url), false, url);
});

test('an unquoted JS gamePath declaration is the game entry, and WeChat client probes are noise', async () => {
  // 7k7k 的详情页把构建地址写成 JS 字面量（键名无引号），只认 JSON 的规则会整页漏检，
  // 于是把详情页当游戏本体抓，最终只剩加载外壳。
  const source = 'https://www.7k7k.com/swf/199426.htm';
  const game = 'https://flash.7k7k.com/cms/cms10/20200529/1052008338/05/index.html';
  const html = `<script>var gameInfo = { gameType: 4, gameId: 199426, gamewidth: 640, gameheight: 480,
    gamePath: "${game}", gamePic: "https://i1.7k7kimg.cn/game/7070/200/199426_571864.jpg" };</script>`;
  assert.equal(capture.identifyCapturePlatform(source).id, '7k7k');
  assert.equal(capture.findEmbeddedGameUrl(html, source), game);

  // 微信客户端探测永远连不上，也不提供任何游戏资源，不能当成抓取失败。
  assert.equal(isNoiseUrl('https://localhost.weixin.qq.com:14017/wx_game_base/api/business'), true);
  assert.equal(isNoiseUrl('https://flash.7k7k.com/cms/cms10/20200529/1052008338/05/Build/game.wasm'), false);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: route.request().url() === source ? html : '' }));
    await page.goto(source);
    const entry = await capture.resolvePlatformGameEntry(page, { sourceUrl: source, timeoutMs: 300 });
    assert.equal(entry.platform.id, '7k7k');
    assert.equal(entry.entryUrl, game);
    assert.equal(entry.mode, 'direct', 'another origin must be loaded directly instead of assumed to be an iframe');
  } finally { await browser.close(); }
});

test('game progress excludes portal churn but includes external CDN assets requested by the real game frame', () => {
  const manifest = { gameUrl: 'https://game.example/build/index.html', platform: { mode: 'iframe' } };
  assert.equal(capture.isGameProgressResource('https://playhop.com/api/recommend', 'https://playhop.com/zh/app/454453', manifest), false);
  assert.equal(capture.isGameProgressResource('https://external.example/model.lh', 'https://game.example/build/index.html', manifest), true);
  assert.equal(capture.isGameProgressResource('https://game.example/build/model.lh', '', manifest), true);
  assert.equal(capture.isGameProgressResource('https://game.example/build-ad/ad.js', '', manifest), false);
  for (const url of ['https://analytics.google.com/g/collect?v=2', 'https://cdn.fuseplatform.net/telemetry/noconsent', 'https://mc.yandex.com/sync_cookie_image_check?cid=1'])
    assert.equal(isNoiseUrl(url), true, url);
});

test('Playhop waits for a late portal guard even if its game frame already exists, and never substitutes an ad frame', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const source = 'https://playhop.com/zh/app/454453';
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '' }));
    await page.goto(source);
    await page.setContent(`<iframe src="https://app-454453.games.s3.yandex.net/454453/build/index.html"></iframe>
      <script>setTimeout(()=>{const b=document.createElement('button');b.dataset.guardAccept='true';b.textContent='Play now';b.onclick=()=>document.body.dataset.started='true';document.body.append(b)},200)</script>`);
    const entry = await capture.resolvePlatformGameEntry(page, { sourceUrl: source, timeoutMs: 1000 });
    assert.equal(entry.activation.clicked, true);
    assert.equal(await page.locator('body').getAttribute('data-started'), 'true');
    await page.setContent('<iframe src="https://ads.example/index.html"></iframe>');
    await assert.rejects(capture.resolvePlatformGameEntry(page, { sourceUrl: source, timeoutMs: 300, interact: false }), /未找到.*454453/);
    await page.setContent('<iframe src="https://ads.example/deep/index.html"></iframe><iframe id="game_frame" src="https://cdn.yad.com/Coffee-Stack/index.php?yad"></iframe>');
    const yad = await capture.resolvePlatformGameEntry(page, { sourceUrl: 'https://www.yad.com/Coffee-Stack', timeoutMs: 1000 });
    assert.equal(yad.entryUrl, 'https://cdn.yad.com/Coffee-Stack/index.php?yad');
    await page.setContent('<iframe src="https://ads.example/index.html"></iframe>');
    await assert.rejects(capture.resolvePlatformGameEntry(page, { sourceUrl: 'https://freegame.com/game/a', timeoutMs: 200 }), /FreeGame.*真实游戏/);
  } finally { await browser.close(); }
});

test('iframe capture measures game payload and failures independently of the portal shell', () => {
  const result = capture.assessCompleteness({ gameUrl: 'https://game.example/build/index.html', finalUrl: 'https://playhop.com/zh/app/454453',
    platform: { mode: 'iframe' }, runtimeInspection: { engine: 'Unity WebGL', coreReady: false }, resources: [
      { url: 'https://playhop.com/zh/app/454453', saved: true, type: 'document', bytes: 1000000 },
      { url: 'https://playhop.com/zh/app/bad.js', saved: false, type: 'script', status: 404 },
      { url: 'https://game.example/build/index.html', saved: true, type: 'document', bytes: 1000 }
    ] });
  assert.equal(result.status, 'shell-only');
  assert.equal(result.gamePayloadBytes, 1000);
  assert.equal(result.criticalFailures.length, 1);
});

test('Playhop waits past same-app storage preloaders and unrelated app frames for the native mobile entry', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({isMobile:true, hasTouch:true});
    const source = 'https://playhop.com/zh/app/smile-rush-239150';
    const game = 'https://app-239150.games.s3.yandex.net/239150/build/index.html?sdk=%2Fsdk.js#origin=https%3A%2F%2Fplayhop.com&app-id=239150&device-type=mobile';
    await page.route('**/*', route => route.fulfill({contentType:'text/html', body:''}));
    await page.goto(source);
    await page.setContent(`<iframe src="https://app-239150.games.s3.yandex.net/helpers/storage/2/ios-macos-localstorage-preloader.html"></iframe>
      <iframe src="https://app-999.games.s3.yandex.net/999/build/index.html"></iframe>
      <script>setTimeout(()=>{const f=document.createElement('iframe');f.src=${JSON.stringify(game)};document.body.append(f)},150)</script>`);
    const entry = await capture.resolvePlatformGameEntry(page, {sourceUrl:source, interact:false, timeoutMs:1500});
    assert.equal(entry.entryUrl, game);
    await page.setContent('<iframe src="https://app-999.games.s3.yandex.net/999/build/index.html"></iframe>');
    await assert.rejects(capture.resolvePlatformGameEntry(page, {sourceUrl:source, interact:false, timeoutMs:300}), /未找到.*239150/);
  } finally { await browser.close(); }
});
