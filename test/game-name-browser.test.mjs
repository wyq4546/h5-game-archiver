import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import * as gameNames from '../src/game-name.mjs';
import http from 'node:http';

test('Yad name evidence selects the game_frame title instead of catalog SEO or advertisement frames', async () => {
  const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
  try {
    const page=await browser.newPage();
    await page.setContent(`<title>Run Healthy 2 - Running Unblocked Game</title>
      <meta property="og:title" content="Run Healthy 2 - Running Unblocked Game">
      <iframe name="advertisement" srcdoc="<title>Unrelated Game</title>"></iframe>
      <iframe id="game_frame" srcdoc="<title>Run Healthy 2</title>"></iframe>`);
    const evidence=await gameNames.readGameNameEvidence(page,'https://www.yad.com/Run-Healthy-2');
    assert.equal(evidence.gameFrameTitle,'Run Healthy 2');
    assert.equal(gameNames.resolveGameName({...evidence,sourceUrl:'https://www.yad.com/Run-Healthy-2'}).name,'Run Healthy 2');
  } finally {await browser.close();}
});

test('name evidence follows the discovered native game URL even when its iframe has no name', async () => {
  const server=http.createServer((req,res)=>{
    res.writeHead(200,{'content-type':'text/html'});
    res.end(req.url==='/portal' ? '<title>Portal</title><iframe src="/ad"></iframe><iframe src="/native/index.html"></iframe>' :
      req.url==='/ad' ? '<title>Unrelated Game</title>' : '<title>Run Healthy 2 3D</title>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
  try {
    const page=await browser.newPage();
    await page.goto(origin+'/portal');
    const evidence=await gameNames.readGameNameEvidence(page,'https://www.yad.com/Run-Healthy-2',origin+'/native/index.html');
    assert.equal(evidence.gameFrameTitle,'Run Healthy 2 3D');
    assert.equal(gameNames.resolveGameName({...evidence,sourceUrl:'https://www.yad.com/Run-Healthy-2'}).name,'Run Healthy 2 3D');
  } finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('FreeGame name evidence reads the designated game iframe instead of the catalog or another iframe', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<title>泡泡龙全民版 | 免费益智小游戏在线</title>
      <meta property="og:title" content="泡泡龙全民版 - FreeGame.Com">
      <iframe name="advertisement" srcdoc="<title>Unrelated Game</title>"></iframe>
      <iframe name="play_game_frame" srcdoc="<title>Bubble Shooter - Classic Pop</title>"></iframe>`);
    const evidence = await gameNames.readGameNameEvidence(page, 'https://www.freegame.com/cs/game/bubble-shooter-classic-pop');
    assert.equal(evidence.gameFrameTitle, 'Bubble Shooter - Classic Pop');
    assert.equal(gameNames.resolveGameName({ ...evidence, sourceUrl: 'https://www.freegame.com/cs/game/bubble-shooter-classic-pop' }).name, 'Bubble Shooter Classic Pop');
    const generic = await gameNames.readGameNameEvidence(page, 'https://example.org/game');
    assert.equal(generic.gameFrameTitle, undefined);
    assert.equal(generic.pageMetaTitle, '泡泡龙全民版 - FreeGame.Com');
  } finally {
    await browser.close();
  }
});
