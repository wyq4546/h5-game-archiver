import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const GAME_ROOT = 'D:/code/h5-game-archiver/download/GoGy-Rocking-Sky-Trip-20261104-162647';
const GAME_DIR = path.join(GAME_ROOT, 'game/flash.7k7k.com/cms/cms10/20200529/1052008338/05');
const MANIFEST_PATH = path.join(GAME_ROOT, 'archive/manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const urlMap = new Map();
for (const r of manifest.resources) {
  if (r.path && r.saved) {
    const full = path.join(GAME_ROOT, r.path);
    urlMap.set(r.url, full);
    try {
      const u = new URL(r.url);
      urlMap.set(u.pathname, full);
      urlMap.set(decodeURIComponent(u.pathname), full);
    } catch {}
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const urlPath = req.url.split('?')[0].split('#')[0];
  const decoded = decodeURIComponent(urlPath);
  let targetFile = null;
  if (decoded === '/' || decoded === '/index.html') targetFile = path.join(GAME_DIR, 'index.html');
  else if (urlMap.has(decoded)) targetFile = urlMap.get(decoded);
  else {
    const direct = path.join(GAME_DIR, decoded.replace(/^\//, ''));
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) targetFile = direct;
  }
  if (targetFile && fs.existsSync(targetFile)) {
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.wasm': 'application/wasm',
      '.unityweb': 'application/octet-stream'
    }[ext] || 'application/octet-stream';
    if (ext === '.html') {
      let content = fs.readFileSync(targetFile, 'utf-8');
      content = content.replace("document.domain='7k7k.com'", "// document.domain");
      content = content.replace(
        '<script src="Build/UnityLoader.js"></script>',
        '<script src="Build/UnityLoader.js"></script><script>window.showUnitywebNoSupport=()=>{};window.parent.showUnitywebNoSupport=()=>{};if(window.UnityLoader)UnityLoader.compatibilityCheck=(e,c)=>c();</script>'
      );
      content = content.replace(
        'var gameInstance = UnityLoader.instantiate("gameContainer", "Build/rocking_sky_trip_gogy_v1.json", {onProgress: UnityProgress,Module:{onRuntimeInitialized: function() {UnityProgress(gameInstance, "complete")}}});',
        'var gameInstance = UnityLoader.instantiate("gameContainer", "Build/rocking_sky_trip_gogy_v1.json", {onProgress: UnityProgress,Module:{onRuntimeInitialized:function(){window.__unityModule=gameInstance.Module;window.__gameInstance=gameInstance;UnityProgress(gameInstance,"complete")}}});'
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(targetFile).pipe(res);
  } else {
    res.writeHead(404); res.end();
  }
});

const snap = () => {
  const M = window.__unityModule;
  if (!M) return { err: 'no module' };
  const u32 = M.HEAPU32, f32 = M.HEAPF32, i32 = M.HEAP32;
  const deref = (addr) => {
    const klass = u32[addr >> 2];
    if (!klass) return 0;
    const sf = u32[(klass + 92) >> 2];
    if (!sf) return 0;
    return u32[sf >> 2];
  };
  const ball = deref(2010632);
  const mc = deref(2010680);
  const out = {};
  if (ball) {
    out.ball = {
      goingtoPortal: i32[(ball + 0xC) >> 2],
      status: i32[(ball + 0x20) >> 2],
      isFlying: i32[(ball + 0x28) >> 2],
      x: +f32[(ball + 0x30) >> 2].toFixed(2),
      y: +f32[(ball + 0x34) >> 2].toFixed(2),
      z: +f32[(ball + 0x38) >> 2].toFixed(2),
      speed: +f32[(ball + 0x4C) >> 2].toFixed(2)
    };
  }
  if (mc) {
    const myLevel = u32[(mc + 0x60) >> 2];
    const templates = u32[(mc + 0x70) >> 2];
    out.mc = {
      status: i32[(mc + 0x54) >> 2],
      numDiamond: i32[(mc + 0x58) >> 2],
      currentProgress: +f32[(mc + 0x5C) >> 2].toFixed(3),
      usingShield: i32[(mc + 0x64) >> 2],
      level: i32[(mc + 0x68) >> 2],
      failScreen: u32[(mc + 0x20) >> 2] ? 1 : 0,
      completeScreen: u32[(mc + 0x24) >> 2] ? 1 : 0,
      templateCount: templates ? i32[(templates + 0xC) >> 2] : null
    };
    if (myLevel) {
      out.level = {
        levelLength: i32[(myLevel + 0xC) >> 2],
        totalDiamond: i32[(myLevel + 0x10) >> 2],
        ballSpeed: +f32[(myLevel + 0x14) >> 2].toFixed(3)
      };
    }
  }
  return out;
};

server.listen(0, '127.0.0.1', async () => {
  const PORT = server.address().port;
  console.log(`[INFO] http://127.0.0.1:${PORT}`);
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[ERR]', m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => {
    const p = document.querySelector('.progress');
    return p && p.style.display === 'none';
  }, null, { timeout: 120000 });
  console.log('[INFO] loaded');
  await new Promise(r => setTimeout(r, 4500));

  const pre = await page.evaluate(snap);
  console.log('[HOME]', JSON.stringify(pre));

  await page.bringToFront();
  await page.mouse.click(540, 1230);
  await new Promise(r => setTimeout(r, 1500));
  await page.focus('#gameContainer canvas').catch(() => {});
  await page.mouse.click(540, 1640);
  await new Promise(r => setTimeout(r, 1200));
  await page.focus('#gameContainer canvas').catch(() => {});

  for (let i = 0; i < 34; i++) {
    const s = await page.evaluate(snap);
    const b = s.ball || {};
    const m = s.mc || {};
    console.log(`[${(i * 0.5).toFixed(1)}s] z=${b.z} x=${b.x} y=${b.y} fly=${b.isFlying} bStat=${b.status} | mcStat=${m.status} prog=${m.currentProgress} dia=${m.numDiamond}`);
    await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();
  server.close();
  process.exit(0);
});
