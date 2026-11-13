import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const GAME_ROOT = '/home/ubuntu/GoGy-Rocking-Sky-Trip-20261104-162647';
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

server.listen(0, '127.0.0.1', async () => {
  const PORT = server.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=gl-egl'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => {
    const p = document.querySelector('.progress');
    return p && p.style.display === 'none';
  }, null, { timeout: 60000 });
  await new Promise(r => setTimeout(r, 4500));
  await page.mouse.click(540, 1230);
  await new Promise(r => setTimeout(r, 1500));

  const waypoints = [
    { z: 0, x: -2.0 },
    { z: 21, x: 2.0 },
    { z: 40, x: -2.0 },
    { z: 53, x: 0.0 },
    { z: 81, x: -2.0 },
    { z: 89, x: 0.0 },
    { z: 110.5, x: 4.0 },
    { z: 122.0, x: 0.0 },
    { z: 158, x: -3.0 },
    { z: 168, x: 0.0 },
    { z: 182, x: 3.6 },
    { z: 194, x: 1.0 },
    { z: 225, x: -3.0 }
  ];

  await page.evaluate((wps) => {
    const M = window.__unityModule;
    const u32 = M.HEAPU32;
    const f32 = M.HEAPF32;
    const i32 = M.HEAP32;

    const ballClass = u32[2010632 >> 2];
    const ballSf = u32[(ballClass + 92) >> 2];
    const ball = u32[ballSf >> 2];
    const mcClass = u32[2010680 >> 2];
    const mcSf = u32[(mcClass + 92) >> 2];
    const mc = u32[mcSf >> 2];

    window.__result = { maxZ: 0, failX: 0, failZ: 0, finished: false };
    window.__snapZ = false;

    let currentKey = null;
    function sendKey(key) {
      if (currentKey === key) return;
      if (currentKey) {
        const code = currentKey === 'ArrowLeft' ? 37 : 39;
        window.dispatchEvent(new KeyboardEvent('keyup', { key: currentKey, code: currentKey, keyCode: code, which: code, bubbles: true, cancelable: true }));
      }
      currentKey = key;
      if (currentKey) {
        const code = currentKey === 'ArrowLeft' ? 37 : 39;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: currentKey, code: currentKey, keyCode: code, which: code, bubbles: true, cancelable: true }));
      }
    }

    function getTargetX(z) {
      let target = wps[0].x;
      for (const wp of wps) {
        if (z >= wp.z) target = wp.x;
        else break;
      }
      return target;
    }

    function tick() {
      if (!ball || !mc) return;
      const z = f32[(ball + 0x38) >> 2];
      const y = f32[(ball + 0x34) >> 2];
      const x = f32[(ball + 0x30) >> 2];
      const mcStatus = i32[(mc + 0x54) >> 2];

      if (z > 215) window.__snapZ = true;

      window.__result.curZ = z;
      if (z > window.__result.maxZ) window.__result.maxZ = z;

      if (mcStatus !== 0) {
        sendKey(null);
        window.__result.finished = true;
        window.__result.mcStatus = mcStatus;
        window.__result.failX = x;
        window.__result.failZ = z;
        return;
      }

      const targetX = getTargetX(z);
      const err = targetX - x;
      if (currentKey === 'ArrowRight') {
        if (err <= 0.45) sendKey(null);
      } else if (currentKey === 'ArrowLeft') {
        if (err >= -0.45) sendKey(null);
      } else {
        if (err > 0.75) sendKey('ArrowRight');
        else if (err < -0.75) sendKey('ArrowLeft');
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, waypoints);

  await page.focus('#gameContainer canvas');
  await page.waitForFunction(() => {
    const M = window.__unityModule;
    const ballClass = M.HEAPU32[2010632 >> 2];
    const ballSf = M.HEAPU32[(ballClass + 92) >> 2];
    const ball = M.HEAPU32[ballSf >> 2];
    const x = M.HEAPF32[(ball + 0x30) >> 2];
    return Math.abs(x - (-2.0)) <= 0.45;
  }, null, { timeout: 3000 }).catch(() => {});

  await page.mouse.click(540, 1640);

  // Wait until z > 215 or fail
  while (true) {
    const snap = await page.evaluate(() => window.__snapZ || window.__result.finished);
    if (snap) break;
    await new Promise(r => setTimeout(r, 50));
  }

  // Take screenshot!
  await page.screenshot({ path: '/home/ubuntu/.gemini/antigravity-cli/brain/ecaef967-723a-4e3e-ac13-1fb49ba81a4d/shot_z220.png' });
  console.log('Saved shot_z220.png!');

  await new Promise(r => setTimeout(r, 500));
  const res = await page.evaluate(() => window.__result);
  console.log('Result:', res);
  await page.screenshot({ path: '/home/ubuntu/.gemini/antigravity-cli/brain/ecaef967-723a-4e3e-ac13-1fb49ba81a4d/shot_z220_fail.png' });

  await browser.close();
  server.close();
  process.exit(0);
});
