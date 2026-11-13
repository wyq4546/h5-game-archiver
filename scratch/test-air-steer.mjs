import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const GAME_ROOT = path.resolve(SCRIPT_DIR, '..');
const GAME_DIR = path.join(GAME_ROOT, 'game/flash.7k7k.com/cms/cms10/20200529/1052008338/05');
const MANIFEST_PATH = path.join(GAME_ROOT, 'archive/manifest.json');
const RUNS_FILE = path.join(GAME_ROOT, 'scripts/runs.jsonl');
const TRAJ_FILE = path.join(GAME_ROOT, 'scripts/trajectory.jsonl');

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
    if (ext === '.js' && targetFile.endsWith('7k7k.js')) {
      let content = fs.readFileSync(targetFile, 'utf-8');
      content = content.replace('var Browser = {', 'window.__unityBrowser = Browser; var Browser = window.__unityBrowser = {');
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(targetFile).pipe(res);
  } else {
    res.writeHead(404); res.end();
  }
});

const OBSTACLES_FILE = path.join(GAME_ROOT, 'scripts/level1-obstacles.json');
const obstaclesData = JSON.parse(fs.readFileSync(OBSTACLES_FILE, 'utf-8'));

async function runRound(round, totalRounds, PORT) {
  console.log(`\n========================================`);
  console.log(`[INFO] Starting Run ${round}/${totalRounds}`);
  console.log(`========================================`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=gl-egl',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    console.log(`[INFO] [Run ${round}] Navigating to index.html...`);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);

    console.log(`[INFO] [Run ${round}] Waiting for progress to disappear...`);
    await page.waitForFunction(() => {
      const p = document.querySelector('.progress');
      return p && p.style.display === 'none';
    }, null, { timeout: 60000 });

    const glRenderer = await page.evaluate(() => {
      const c = document.querySelector('#gameContainer canvas');
      const gl = c?.getContext('webgl2') || c?.getContext('webgl');
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    console.log(`[INFO] [Run ${round}] WebGL Renderer: ${glRenderer}`);

    console.log(`[INFO] [Run ${round}] Progress complete. Waiting 4.5s for audio prompt...`);
    await new Promise(r => setTimeout(r, 4500));
    await page.mouse.click(540, 1230);
    console.log(`[INFO] [Run ${round}] Clicked sound prompt, waiting 1.5s...`);
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate((obsData) => {
      const M = window.__unityModule;
      const u32 = M.HEAPU32;
      const f32 = M.HEAPF32;
      const i32 = M.HEAP32;

      // Build spatial lookup maps for reactive collision avoidance
      const groundMap = new Map();
      for (const g of obsData.ground) {
        if (g.z === 52) continue; // Skip blocked tile under pillar at z=52
        if (!groundMap.has(g.z)) groundMap.set(g.z, new Set());
        groundMap.get(g.z).add(g.x);
      }
      if (obsData.push) {
        for (const p of obsData.push) {
          if (!groundMap.has(p.z)) groundMap.set(p.z, new Set());
          groundMap.get(p.z).add(p.x);
        }
      }

      const obsMap = new Map();
      for (const o of obsData.obs) {
        const intZ = Math.round(o.z);
        if (!obsMap.has(intZ)) obsMap.set(intZ, []);
        obsMap.get(intZ).push(o);
      }
      for (const s of (obsData.spin || [])) {
        const intZ = Math.round(s.z);
        if (!obsMap.has(intZ)) obsMap.set(intZ, []);
        obsMap.get(intZ).push({ x: s.x, z: s.z, w: 1.6, kind: 'spin' });
      }

      function getObstacleMargin(o) {
        if (o.kind === 'spin') return 1.6 + 0.55; // 2.15 (Hammer radius + ball radius)
        return o.w + 0.55; // Real obstacle scaleX + ball radius
      }

      function getTargetX(z, x, isFlying) {
        const zMin = z;
        const zMax = z + 16;
        const slices = [];
        const startZ = Math.floor(zMin);
        const endZ = Math.ceil(zMax);
        for (let sz = startZ; sz <= endZ; sz++) {
          if (groundMap.has(sz)) slices.push(sz);
        }
        if (slices.length === 0) return x;

        const candSet = new Set();
        for (const sz of slices) {
          for (const gx of groundMap.get(sz)) candSet.add(gx);
        }
        const candXs = Array.from(candSet).sort((a, b) => a - b);
        if (candXs.length === 0) return x;

        function isCandidateSafe(candX, sliceList) {
          for (const sz of sliceList) {
            const tiles = groundMap.get(sz);
            let onTile = false;
            for (const tx of tiles) {
              if (Math.abs(tx - candX) <= 1.0) { onTile = true; break; }
            }
            if (!onTile) return false;

            const obsList = obsMap.get(sz);
            if (obsList) {
              for (const o of obsList) {
                const m = getObstacleMargin(o);
                if (Math.abs(o.x - candX) < m) return false;
              }
            }
          }
          return true;
        }

        const fullValid = candXs.filter(cx => isCandidateSafe(cx, slices));
        if (fullValid.length > 0) {
          fullValid.sort((a, b) => Math.abs(a - x) - Math.abs(b - x));
          return fullValid[0];
        }

        for (let n = slices.length - 1; n >= 1; n--) {
          const sub = slices.slice(0, n);
          const subValid = candXs.filter(cx => isCandidateSafe(cx, sub));
          if (subValid.length > 0) {
            subValid.sort((a, b) => Math.abs(a - x) - Math.abs(b - x));
            return subValid[0];
          }
        }

        return x;
      }

      window.__result = {
        finished: false,
        success: false,
        maxZ: 0,
        deathZ: 0,
        deathX: 0,
        ballStatus: 0,
        mcStatus: 0,
        diamonds: 0,
        level: 1
      };
      window.__samples = [];
      window.__trajectory = []; // Every frame log: { z, x, y, target, err, key, ballStatus }

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

      let initialZ = null;
      let started = false;
      let maxZ = 0;
      let lastZ = 0;
      let stagnantFrames = 0;

      function tick() {
        const ballClass = u32[2010632 >> 2];
        const ballSf = ballClass ? u32[(ballClass + 92) >> 2] : 0;
        const ball = ballSf ? u32[ballSf >> 2] : 0;

        const mcClass = u32[2010680 >> 2];
        const mcSf = mcClass ? u32[(mcClass + 92) >> 2] : 0;
        const mc = mcSf ? u32[mcSf >> 2] : 0;

        if (!ball || !mc) {
          requestAnimationFrame(tick);
          return;
        }

        const z = f32[(ball + 0x38) >> 2];
        const y = f32[(ball + 0x34) >> 2];
        const x = f32[(ball + 0x30) >> 2];
        const isFlying = i32[(ball + 0x28) >> 2];
        const ballStatus = i32[(ball + 0x20) >> 2];
        const mcStatus = i32[(mc + 0x54) >> 2];
        const diamonds = i32[(mc + 0x58) >> 2];
        const currentProgress = f32[(mc + 0x5C) >> 2];
        const level = i32[(mc + 0x68) >> 2] || 1;

        if (initialZ === null) {
          initialZ = z;
          lastZ = z;
          maxZ = z;
        }

        window.__result.curZ = z;
        if (z > maxZ) maxZ = z;
        window.__result.maxZ = maxZ;

        // Steering control: targetX computed with reactive avoidance
        const targetX = getTargetX(z, x, isFlying);
        const err = targetX - x;

        if (currentKey === 'ArrowRight') {
          if (err <= 0.40) sendKey(null);
        } else if (currentKey === 'ArrowLeft') {
          if (err >= -0.40) sendKey(null);
        } else {
          if (err > 0.70) sendKey('ArrowRight');
          else if (err < -0.70) sendKey('ArrowLeft');
        }

        let unityTime = 0;
        try {
          unityTime = Math.round(M.dynCall_fii(30, 0, 0) * 1000) / 1000;
        } catch {}
        const frameCount = window.__unityBrowser?.mainLoop?.currentFrameNumber ?? 0;

        // Record every frame trajectory
        if (started || z > 1.0) {
          window.__trajectory.push({
            z: Math.round(z * 100) / 100,
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            target: Math.round(targetX * 100) / 100,
            err: Math.round(err * 100) / 100,
            key: currentKey,
            ballStatus: ballStatus,
            unityTime: unityTime,
            frameCount: frameCount
          });
        }

        if (z > 0 && (!window.__lastSampleZ || Math.abs(z - window.__lastSampleZ) >= 0.8)) {
          window.__lastSampleZ = z;
          window.__samples.push({
            z: Math.round(z * 10) / 10,
            y: Math.round(y * 100) / 100,
            x: Math.round(x * 100) / 100,
            key: currentKey,
            fly: isFlying,
            bs: ballStatus,
            mc: mcStatus
          });
          if (window.__samples.length > 500) window.__samples.shift();
        }

        if (z >= 220 && !window.__snap220) {
          window.__snap220 = true;
        }

        // Termination check
        if (!started) {
          if (z > initialZ + 1.0) {
            started = true;
            maxZ = z;
            lastZ = z;
            stagnantFrames = 0;
          }
        } else {
          if (z > lastZ + 0.05) {
            stagnantFrames = 0;
            lastZ = z;
          } else {
            stagnantFrames++;
          }

          // Goal check
          if ((currentProgress >= 1000 || z >= 1000) && mcStatus === 1) {
            sendKey(null);
            window.__result.finished = true;
            window.__result.success = true;
            window.__result.deathZ = z;
            window.__result.deathX = x;
            window.__result.ballStatus = ballStatus;
            window.__result.mcStatus = mcStatus;
            window.__result.diamonds = diamonds;
            window.__result.level = level;
            return;
          }

          // Failure check
          if ((ballStatus === 0 && stagnantFrames >= 10) || stagnantFrames >= 30 || y < -15) {
            sendKey(null);
            window.__result.finished = true;
            window.__result.success = false;
            window.__result.deathZ = z;
            window.__result.deathX = x;
            window.__result.ballStatus = ballStatus;
            window.__result.mcStatus = mcStatus;
            window.__result.diamonds = diamonds;
            window.__result.level = level;
            return;
          }
        }

        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    }, obstaclesData);

    console.log(`[INFO] [Run ${round}] Injecting controller and waiting for ball setup...`);
    await page.focus('#gameContainer canvas');
    await page.waitForFunction(() => {
      const M = window.__unityModule;
      const ballClass = M.HEAPU32[2010632 >> 2];
      const ballSf = M.HEAPU32[(ballClass + 92) >> 2];
      const ball = M.HEAPU32[ballSf >> 2];
      const x = M.HEAPF32[(ball + 0x30) >> 2];
      return Math.abs(x - (-2.0)) <= 0.45;
    }, null, { timeout: 3000 }).catch(() => {});

    console.log(`[INFO] [Run ${round}] Launching ball at (540, 1640)...`);
    const launchTime = Date.now();
    await page.mouse.click(540, 1640);
    console.log(`[INFO] [Run ${round}] Ball launched, tracking progress...`);

    let res = null;
    let snapped220 = false;
    const maxWaitMs = 85000;
    while (Date.now() - launchTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, 20));
      if (!snapped220) {
        const snap = await page.evaluate(() => window.__snap220);
        if (snap) {
          snapped220 = true;
          await page.screenshot({ path: path.join(GAME_ROOT, 'scripts/.tmp/shot_z220_live.png') }).catch(() => {});
          console.log(`[INFO] [Run ${round}] Saved shot_z220_live.png!`);
        }
      }
      res = await page.evaluate(() => window.__result);
      if (res && res.finished) break;
    }
    const runMs = Date.now() - launchTime;

    await page.screenshot({ path: path.join(GAME_ROOT, `scripts/.tmp/shot_run${round}.png`) }).catch(() => {});

    // Fallback if not finished
    if (!res || !res.finished) {
      const finalState = await page.evaluate(() => {
        const M = window.__unityModule;
        const u32 = M?.HEAPU32;
        const f32 = M?.HEAPF32;
        const i32 = M?.HEAP32;
        if (!u32 || !f32 || !i32) return window.__result;
        const ballClass = u32[2010632 >> 2];
        const ballSf = u32[(ballClass + 92) >> 2];
        const ball = u32[ballSf >> 2];
        const mcClass = u32[2010680 >> 2];
        const mcSf = u32[(mcClass + 92) >> 2];
        const mc = u32[mcSf >> 2];
        return {
          finished: true,
          maxZ: window.__result?.maxZ || (ball ? f32[(ball + 0x38) >> 2] : 0),
          deathZ: ball ? f32[(ball + 0x38) >> 2] : 0,
          deathX: ball ? f32[(ball + 0x30) >> 2] : 0,
          ballStatus: ball ? i32[(ball + 0x20) >> 2] : 0,
          mcStatus: mc ? i32[(mc + 0x54) >> 2] : 0,
          diamonds: mc ? i32[(mc + 0x58) >> 2] : 0,
          level: mc ? i32[(mc + 0x68) >> 2] : 1
        };
      }).catch(() => null);
      if (finalState) res = finalState;
    }

    // Save every frame trajectory
    const traj = await page.evaluate(() => window.__trajectory || []).catch(() => []);
    if (traj && traj.length > 0) {
      const trajContent = traj.map(t => JSON.stringify(t)).join('\n') + '\n';
      fs.writeFileSync(TRAJ_FILE, trajContent, 'utf-8');
      console.log(`[INFO] [Run ${round}] Saved ${traj.length} frames to ${TRAJ_FILE}`);

      const uniqueX = Array.from(new Set(traj.map(t => t.x))).sort((a, b) => a - b);
      console.log(`\n=== UNIQUE X VALUES (${uniqueX.length} values) ===`);
      console.log(JSON.stringify(uniqueX));
      console.log(`=== END UNIQUE X VALUES ===\n`);

      const z80_120 = traj.filter(t => t.z >= 80 && t.z <= 120);
      console.log(`\n=== TRAJECTORY z=80..120 (${z80_120.length} frames) ===`);
      for (const t of z80_120) {
        console.log(JSON.stringify(t));
      }
      console.log(`=== END TRAJECTORY ===\n`);

      console.log(`\n=== LAST 15 FRAMES (stagnation inspection) ===`);
      for (const t of traj.slice(-15)) {
        console.log(JSON.stringify(t));
      }
      console.log(`=== END LAST 15 FRAMES ===\n`);
    }

    const samples = await page.evaluate(() => window.__samples).catch(() => []);
    console.log(`[INFO] [Run ${round}] Result:`, res);
    console.log(`[INFO] [Run ${round}] Total samples:`, samples?.length || 0);

    const record = {
      level: res?.level ?? 1,
      maxZ: Math.round((res?.maxZ ?? 0) * 100) / 100,
      deathZ: Math.round((res?.deathZ ?? 0) * 100) / 100,
      deathX: Math.round((res?.deathX ?? 0) * 100) / 100,
      ballStatus: res?.ballStatus ?? 0,
      mcStatus: res?.mcStatus ?? 0,
      diamonds: res?.diamonds ?? 0,
      elapsed: runMs,
      wpVersion: 'reactive_v1',
      ms: runMs
    };

    fs.appendFileSync(RUNS_FILE, JSON.stringify(record) + '\n', 'utf-8');
    console.log(`[INFO] [Run ${round}] Appended to ${RUNS_FILE}:`, JSON.stringify(record));

    return record;
  } finally {
    await browser.close().catch(() => {});
  }
}

server.listen(0, '127.0.0.1', async () => {
  const PORT = server.address().port;
  console.log(`[INFO] Server listening on http://127.0.0.1:${PORT}`);

  const TOTAL_ROUNDS = parseInt(process.env.ROUNDS || process.argv[2] || '1', 10);
  console.log(`[INFO] Running ${TOTAL_ROUNDS} round(s)...`);

  const results = [];
  try {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      const res = await runRound(round, TOTAL_ROUNDS, PORT);
      results.push(res);
    }
  } catch (err) {
    console.error('[ERROR] Run failed:', err);
  } finally {
    server.close();
  }

  console.log('\n========================================');
  console.log('[SUMMARY] Completed all rounds. Runs recorded:');
  for (const r of results) {
    console.log(JSON.stringify(r));
  }
  console.log('========================================');

  process.exit(0);
});
