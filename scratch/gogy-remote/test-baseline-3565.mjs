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

  // Waypoints to test
  // waypoints: array of { z, targetX }
  const waypoints = JSON.parse(process.env.WAYPOINTS || '[]');
  console.log('Testing waypoints:', waypoints);

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

    window.__result = { maxZ: 0, failX: 0, failZ: 0, status: 0, mcStatus: 0, finished: false };

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
      if (!wps || wps.length === 0) return 0;
      let target = wps[0].x;
      for (const wp of wps) {
        if (z >= wp.z) target = wp.x;
        else break;
      }
      return target;
    }

    window.__samples = [];

    let lastTime = 0;
    let lastX = 0;

    // Pre-align to Lane -1 on launchpad
    let initialSteered = false;

    function tick() {
      if (!ball || !mc) return;

      const z = f32[(ball + 0x38) >> 2];
      const y = f32[(ball + 0x34) >> 2];
      const x = f32[(ball + 0x30) >> 2];
      const isFlying = i32[(ball + 0x28) >> 2];
      const mcStatus = i32[(mc + 0x54) >> 2];

      const now = performance.now();
      const dt = lastTime ? (now - lastTime) / 1000 : 0.016;
      lastTime = now;

      const vx = (dt > 0.001 && dt < 0.1) ? (x - lastX) / dt : 0;
      lastX = x;

      if (window.__samples.length < 500) {
        window.__samples.push({
          z: Math.round(z * 10) / 10,
          y: Math.round(y * 100) / 100,
          x: Math.round(x * 100) / 100,
          key: currentKey,
          err: Math.round((getTargetX(z) - x) * 100) / 100,
          fly: isFlying,
          mc: mcStatus
        });
      }

      if (z > window.__result.maxZ) window.__result.maxZ = z;

      if (mcStatus !== 0) {
        sendKey(null);
        window.__result.finished = true;
        window.__result.mcStatus = mcStatus;
        window.__result.failX = x;
        window.__result.failZ = z;
        return;
      }

      if (isFlying === 1 && z < 75) {
        sendKey(null);
        requestAnimationFrame(tick);
        return;
      }

      // Robust exact-lattice Schmitt trigger
      const targetX = getTargetX(z);
      const err = targetX - x;

      if (currentKey === 'ArrowRight') {
        if (err <= 0.30) sendKey(null);
      } else if (currentKey === 'ArrowLeft') {
        if (err >= -0.30) sendKey(null);
      } else {
        if (err > 0.80) sendKey('ArrowRight');
        else if (err < -0.80) sendKey('ArrowLeft');
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, waypoints);

  // Focus canvas and wait on pad until ball is pre-aligned
  await page.focus('#gameContainer canvas');
  if (waypoints.length > 0 && waypoints[0].x !== 0) {
    const targetX = waypoints[0].x;
    await page.waitForFunction((tx) => {
      const M = window.__unityModule;
      const ballClass = M.HEAPU32[2010632 >> 2];
      const ballSf = M.HEAPU32[(ballClass + 92) >> 2];
      const ball = M.HEAPU32[ballSf >> 2];
      const x = M.HEAPF32[(ball + 0x30) >> 2];
      return Math.abs(x - tx) <= 0.35;
    }, targetX, { timeout: 3000 }).catch(() => {});
  }

  // Launch!
  await page.mouse.click(540, 1640);


  // Poll until finished or 30 seconds
  const startTime = Date.now();
  let res = null;
  let airShotTaken = false;
  while (Date.now() - startTime < 30000) {
    await new Promise(r => setTimeout(r, 40));
    const cur = await page.evaluate(() => {
      const M = window.__unityModule;
      if (!M) return null;
      const ballClass = M.HEAPU32[2010632 >> 2];
      const ballSf = M.HEAPU32[(ballClass + 92) >> 2];
      const ball = M.HEAPU32[ballSf >> 2];
      return {
        z: M.HEAPF32[(ball + 0x38) >> 2],
        y: M.HEAPF32[(ball + 0x34) >> 2],
        x: M.HEAPF32[(ball + 0x30) >> 2]
      };
    });
    if (cur && cur.z >= 82 && !airShotTaken) {
      airShotTaken = true;
      await page.screenshot({ path: '/home/ubuntu/GoGy-Rocking-Sky-Trip-20261104-162647/scripts/.tmp/shot_air_z82.png' });
      console.log('Took mid-air screenshot at z =', cur.z, 'y =', cur.y, 'x =', cur.x);
    }
    res = await page.evaluate(() => window.__result);
    if (res.finished) break;
  }

  await page.screenshot({ path: '/home/ubuntu/GoGy-Rocking-Sky-Trip-20261104-162647/scripts/.tmp/shot_explore.png' });
  const samples = await page.evaluate(() => window.__samples);
  console.log('Result:', res);
  console.log('Last samples:', samples.slice(-20));

  await browser.close();
  server.close();
  process.exit(0);
});
