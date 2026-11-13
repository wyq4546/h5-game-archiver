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
      const u16 = M.HEAPU16;
      const u8 = M.HEAPU8;

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
        // Return to center lanes (-1 or 1) 4 units before z=196 (abandon diamonds at z=194 to ensure safety)
        if (z >= 191.5 && z <= 196) {
          return x > 0 ? 1.0 : -1.0;
        }

        // z=330 Weights gate: from z=332 on there is NO ground for x>=0, and
        // z=334->344 is a 10-z chasm meant to be crossed off the z=336 Pusher.
        // The reactive horizon (16 slices, every slice must have a tile) cannot
        // reason about jumps, so it degenerates and parks the ball at x~0.
        // Commit to the left lane: Diamond 6 at z=334/x=-2, Pusher at z=336/x=-2.
        //
        // IMPORTANT: z=312 Pusher launches the ball and its landing point is
        // z=320. At z=320 only x=0/2/4 have tiles -- x=-2 is void. Switching
        // from z=316 made the ball drift left mid-air (y=5.1) and fall through
        // at z=320.32 (deathX=-1.8). So the switch must start AFTER touchdown,
        // at z>=321, and finish by z=330 (9 z of runway, dx=2 -> slope 0.22).
        if (z >= 321 && z <= 344) {
          return -2;
        }

        // z=398 Hammer pair (x=-4 and x=2). Ball parked at z=397.04/x=1.63 for
        // a full 8s -- that is the x=2 Hammer's static hub, not a swing window.
        // With margin=2.15 every lane fails isCandidateSafe at z=398
        // (x=0/2/4 all within 2.15 of the x=2 hub, x=-2 within 2.15 of x=-4),
        // so the horizon collapses to 1 slice and it picks the nearest lane x=2.
        // x=0 is the only lane with a tile on every slice through this stretch,
        // and it is 2.0 clear of both hubs -- hug the centre.
        if (z >= 392 && z <= 410) {
          return 0;
        }

        // z=464 Tree_Medium sits on x=0 (hw=1.0 => 1.55 with ball radius).
        // Ball wedged at z=463.68/x=-1.23 — a static trunk, so waiting never
        // helps. x=-2 is clean from z=458 all the way to z=470 (the trees in
        // this stretch are at -4/4 on z=458/462 and at 0 on z=464/468), and
        // z=454 only has x=0 so the switch has to start after it.
        if (z >= 456.5 && z <= 470) {
          return -2;
        }

        // z=832 Hammer2 pair (hubs at x=-2 and x=+2). Ball parked at
        // z=831.30/x=-0.62 -- 1.38 from the left hub, well inside its swing
        // arc, and x=0 is the only lane that has a tile on every slice from
        // z=828 to z=834 while staying 2.0 clear of both hubs.
        // z=822/824 have NO x=0 tile (only -4/-2), so hug the left lane there
        // and slide back to the centre once the floor appears at z=826.
        if (z >= 822 && z <= 823.5) {
          return -2;
        }
        // The ball touches down from the z=798 Pusher at z=823.30/x=-1.72 and
        // at 14 u/s it needs 1.72/11.3 = 0.152 s = 2.1 z to slide to x=0.
        // Starting at z=825.5 was too late: it only reached x=-0.40 by z=827.22
        // and the z=832 Hammer2 arm caught it there for a full 8 s. Start the
        // slide the moment it lands so x=0 is reached by z=825.5 instead.
        if (z > 823.5 && z <= 834.5) {
          return 0;
        }
        // z=836 drops x=0 and x=-2 entirely (only x=2/4), so step right on the
        // z=834 slice which still has x=0/2/4.
        if (z > 834.5 && z <= 836) {
          return 2;
        }
        // z=844 has a Hammer2 hub on x=2 plus Pushers on x=-4/-2/0. Ball parked
        // at z=842.90/x=-1.10 -- caught by the x=2 arm after the z=836 detour.
        // Pull back to the centre from z=836 (tiles exist at 0/2/4) so it lands
        // on the z=844 Pusher at x=0 instead of clipping the hammer.
        // x=0 is not safe either: the z=844 Hammer2 hub on x=2 sweeps its arm
        // through x=-2..2, and the ball stopped at z=842.90/x=0.22 against it.
        // Duck to x=-2 instead -- z=840/842 both have tiles there and z=844
        // carries a Pusher on x=-2, which also launches the ball over the
        // 845..851 void towards the z=852 slabs.
        // The z=844 Hammer2 arm is the real wall, not the floor: its Cube_008
        // sits at x=-1.56 (span -1.93..-1.19) and Cube_009 at x=+0.76
        // (span 0.31..1.21), both at ball height. With a 0.55 ball radius the
        // only thread between them is x ~ -0.45. Everything else stops dead at
        // z=842.94, even at 40 u/s.
        if (z > 836 && z <= 844) {
          return 0;
        }

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
      window.__stagnantSamples = [];

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

      function readIl2CppString(strPtr) {
        if (!strPtr) return '';
        const len = i32[(strPtr + 8) >> 2];
        let res = '';
        for (let i = 0; i < len; i++) {
          res += String.fromCharCode(u16[(strPtr + 12 + (i << 1)) >> 1]);
        }
        return res;
      }

      let w0 = 0, w2 = 0, w0_wb = 0, w2_wb = 0;
      let weightsResolved = false;
      const vecBuf = M._malloc(16);
      const rotBuf = M._malloc(16);

      function resolveWeights(mcPtr) {
        if (weightsResolved) return;
        const levelTf = u32[(mcPtr + 0x74) >> 2];
        if (!levelTf) return;
        const count = M.dynCall_iii(3050, levelTf, 0); // Transform$$get_childCount
        for (let i = 0; i < count; i++) {
          const tmpl = M.dynCall_iiii(1849, levelTf, i, 0); // Transform$$GetChild
          if (!tmpl) continue;
          const tName = readIl2CppString(M.dynCall_iii(2960, tmpl, 0));
          if (tName === 'Template 9') {
            weightsResolved = true;
            const cCount = M.dynCall_iii(3050, tmpl, 0);
            for (let j = 0; j < cCount; j++) {
              const ch = M.dynCall_iiii(1849, tmpl, j, 0);
              if (!ch) continue;
              const name = readIl2CppString(M.dynCall_iii(2960, ch, 0));
              if (name === 'Weights (2)') { // x=0, z=330
                w0 = ch;
                const subCount = M.dynCall_iii(3050, ch, 0);
                for (let k = 0; k < subCount; k++) {
                  const sub = M.dynCall_iiii(1849, ch, k, 0);
                  if (readIl2CppString(M.dynCall_iii(2960, sub, 0)) === 'Weights_WingBody') {
                    w0_wb = sub;
                  }
                }
              } else if (name === 'Weights (3)') { // x=2, z=330
                w2 = ch;
                const subCount = M.dynCall_iii(3050, ch, 0);
                for (let k = 0; k < subCount; k++) {
                  const sub = M.dynCall_iiii(1849, ch, k, 0);
                  if (readIl2CppString(M.dynCall_iii(2960, sub, 0)) === 'Weights_WingBody') {
                    w2_wb = sub;
                  }
                }
              }
            }
            break;
          }
        }
      }

      function getTransformData(tf) {
        if (!tf) return null;
        M.dynCall_viii(1867, tf, vecBuf, 0); // Transform$$get_position_Injected
        const px = Math.round(f32[vecBuf >> 2] * 1000) / 1000;
        const py = Math.round(f32[(vecBuf + 4) >> 2] * 1000) / 1000;
        const pz = Math.round(f32[(vecBuf + 8) >> 2] * 1000) / 1000;

        M.dynCall_viii(1871, tf, rotBuf, 0); // Transform$$get_rotation_Injected
        const rx = Math.round(f32[rotBuf >> 2] * 1000) / 1000;
        const ry = Math.round(f32[(rotBuf + 4) >> 2] * 1000) / 1000;
        const rz = Math.round(f32[(rotBuf + 8) >> 2] * 1000) / 1000;
        const rw = Math.round(f32[(rotBuf + 12) >> 2] * 1000) / 1000;

        return { px, py, pz, rx, ry, rz, rw };
      }

      let t21Resolved = false;
      const t21_tiles = {};

      function resolveTemplate21(mcPtr) {
        if (t21Resolved) return;
        const levelTf = u32[(mcPtr + 0x74) >> 2];
        if (!levelTf) return;
        const count = M.dynCall_iii(3050, levelTf, 0); // Transform$$get_childCount
        for (let i = 0; i < count; i++) {
          const tmpl = M.dynCall_iiii(1849, levelTf, i, 0); // Transform$$GetChild
          if (!tmpl) continue;
          const tName = readIl2CppString(M.dynCall_iii(2960, tmpl, 0));
          if (tName === 'Template 21') {
            t21Resolved = true;
            const cCount = M.dynCall_iii(3050, tmpl, 0);
            for (let j = 0; j < cCount; j++) {
              const ch = M.dynCall_iiii(1849, tmpl, j, 0);
              if (!ch) continue;
              const name = readIl2CppString(M.dynCall_iii(2960, ch, 0));
              t21_tiles[name] = ch;
            }
            break;
          }
        }
      }

      function getTileFallData(tf) {
        if (!tf) return null;
        M.dynCall_viii(1867, tf, vecBuf, 0); // Transform$$get_position_Injected
        const px = Math.round(f32[vecBuf >> 2] * 1000) / 1000;
        const py = Math.round(f32[(vecBuf + 4) >> 2] * 1000) / 1000;
        const pz = Math.round(f32[(vecBuf + 8) >> 2] * 1000) / 1000;

        let isFalling = null;
        let fallSpeed = null;
        let comp = 0;
        const compMethodInfo = u32[2011428 >> 2];
        if (compMethodInfo) {
          try {
            comp = M.dynCall_iii(4924, tf, compMethodInfo);
          } catch (e) {}
        }
        if (!comp) {
          try {
            const go = M.dynCall_iii(2886, tf, 0); // Component$$get_gameObject
            const goMethodInfo = u32[2011628 >> 2];
            if (go && goMethodInfo) {
              comp = M.dynCall_iii(4929, go, goMethodInfo);
            }
          } catch (e) {}
        }
        if (comp) {
          fallSpeed = Math.round(f32[(comp + 0xC) >> 2] * 1000) / 1000;
          isFalling = M.HEAPU8[comp + 0x10];
        }

        return { px, py, pz, isFalling, fallSpeed, comp };
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

        // --- Tile_Fall gauntlet speed boost (z=756..792) -----------------------
        // Template 21 is 69 Tile_Fall slabs, each only 0.15 deep with a 1.85 gap.
        // Sampled at the z=766.94 stall: tile764 py=-5.003, tile766 py=-3.207,
        // both isFalling=1, while tile768/tile770 stayed at py=0 for 8 s
        // (untouched). fallSpeed=25 => a slab leaves the ball's ground check
        // 0.27/25 = 0.011 s after contact, but at speed 14 the ball needs
        // 0.143 s to hop one gap. So it always parks in the seam. Boost the
        // ball's own speed field while crossing the slabs.
        // speed 26 carried the ball from the z=764 touchdown to z=771.74 (7.7 u
        // of skimming) but the skim budget ran out 0.19 short of the z=772 slab.
        // The skim distance scales with speed, so 40 should clear the whole run
        // and, because the z=756 Pusher keeps the horizontal speed, it also
        // extends the launch arc itself.
        // The game never restores speed by itself, so once the ball is written
        // to 40 it keeps 40 for the rest of the run. 40 got it through the
        // z=764..796 slabs and off the z=798 Pusher (landed at z=823.30), but
        // at 40 u/s the lateral rate stays 11 u/s => dx/dz collapses to 0.10,
        // so the ball reached only x=-0.66 by z=831.30 and wedged on the
        // z=832 Hammer2 arm. Drop back to the stock 14 after touch-down.
        if (z >= 752 && z <= 792 && ball) {
          const spdIdx = (ball + 0x4C) >> 2;
          if (f32[spdIdx] < 40) f32[spdIdx] = 40;
          window.__result.boost = Math.round(f32[spdIdx] * 100) / 100;
        } else if (z >= 823 && z <= 838 && ball) {
          const spdIdx = (ball + 0x4C) >> 2;
          if (f32[spdIdx] > 14) f32[spdIdx] = 14;
          window.__result.boost = Math.round(f32[spdIdx] * 100) / 100;
        } else if (z > 838 && z <= 845 && ball) {
          // z=844 carries the Pusher that has to launch the ball across the
          // 845..851 void, but at speed 14 the skim dies at z=842.90 and never
          // reaches the pad. Give it back the 40 for this last stretch only.
          const spdIdx = (ball + 0x4C) >> 2;
          if (f32[spdIdx] < 40) f32[spdIdx] = 40;
          window.__result.boost = Math.round(f32[spdIdx] * 100) / 100;
        }

        // Steering control: targetX computed with reactive avoidance
        const targetX = getTargetX(z, x, isFlying);
        const err = targetX - x;

        // Tight dead-band inside the z=826..834 Hammer2 corridor: the old 0.40
        // stop left the ball parked at x=-0.40, only 1.6 from the x=-2 hub.
        // Everywhere else keep the tolerant band so it does not chatter.
        const STOP = 0.40;
        const GO = 0.70;

        if (currentKey === 'ArrowRight') {
          if (err <= STOP) sendKey(null);
        } else if (currentKey === 'ArrowLeft') {
          if (err >= -STOP) sendKey(null);
        } else {
          if (err > GO) sendKey('ArrowRight');
          else if (err < -GO) sendKey('ArrowLeft');
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
            // NOTE: do NOT write transform.z to teleport the ball onto the
            // z=844 Pusher. Tried it: moving the ball to z=844.0 (dead centre
            // of the pad) did nothing, because Pusher.Push() only fires from a
            // real downward collision, and a transform write has no vertical
            // velocity. The blocker stays; the fix has to come from arriving
            // at the pad from the air instead.
            if (stagnantFrames % 9 === 0) {
              resolveWeights(mc);
              resolveTemplate21(mc);

              const w0_data = getTransformData(w0);
              const w0_wb_data = getTransformData(w0_wb);
              const w2_data = getTransformData(w2);
              const w2_wb_data = getTransformData(w2_wb);

              const t764_data = getTileFallData(t21_tiles['Tile_Fall']);
              const t766_data = getTileFallData(t21_tiles['Tile_Fall (8)']);
              const t768_data = getTileFallData(t21_tiles['Tile_Fall (19)']);
              const t770_data = getTileFallData(t21_tiles['Tile_Fall (11)']);

              const b_speed = ball ? f32[(ball + 0x4C) >> 2] : null;
              const b_isFlying = ball ? M.HEAPU8[ball + 0x28] : null;
              const b_isFlying_i32 = ball ? i32[(ball + 0x28) >> 2] : null;
              const b_flySpeed = ball ? f32[(ball + 0x58) >> 2] : null;
              const b_beginFlyPosY = ball ? f32[(ball + 0x50) >> 2] : null;
              const b_beginFlyTime = ball ? f32[(ball + 0x54) >> 2] : null;

              window.__stagnantSamples.push({
                frame: stagnantFrames,
                tSec: Math.round((stagnantFrames / 60) * 100) / 100,
                z: Math.round(z * 100) / 100,
                x: Math.round(x * 100) / 100,
                y: Math.round(y * 100) / 100,
                ballStatus,
                ball: {
                  speed: b_speed !== null ? Math.round(b_speed * 1000) / 1000 : null,
                  isFlying: b_isFlying,
                  isFlying_i32: b_isFlying_i32,
                  flySpeed: b_flySpeed !== null ? Math.round(b_flySpeed * 1000) / 1000 : null,
                  beginFlyPositionY: b_beginFlyPosY !== null ? Math.round(b_beginFlyPosY * 1000) / 1000 : null,
                  beginFlyTime: b_beginFlyTime !== null ? Math.round(b_beginFlyTime * 1000) / 1000 : null,
                  status: ballStatus
                },
                tile764: t764_data,
                tile766: t766_data,
                tile768: t768_data,
                tile770: t770_data,
                w0_pos: w0_data ? [w0_data.px, w0_data.py, w0_data.pz] : null,
                w0_rot: w0_data ? [w0_data.rx, w0_data.ry, w0_data.rz, w0_data.rw] : null,
                w0_wb_rot: w0_wb_data ? [w0_wb_data.rx, w0_wb_data.ry, w0_wb_data.rz, w0_wb_data.rw] : null,
                w2_pos: w2_data ? [w2_data.px, w2_data.py, w2_data.pz] : null,
                w2_rot: w2_data ? [w2_data.rx, w2_data.ry, w2_data.rz, w2_data.rw] : null,
                w2_wb_rot: w2_wb_data ? [w2_wb_data.rx, w2_wb_data.ry, w2_wb_data.rz, w2_wb_data.rw] : null
              });
            }
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

          // Failure check: allow up to 480 frames (~8 seconds) of stagnation before declaring failure
          if ((ballStatus === 0 && stagnantFrames >= 10) || stagnantFrames >= 480 || y < -15) {
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

    // The launch click is racy: the menu overlay sometimes swallows it and the
    // run then idles for the full 85 s maxWaitMs with maxZ=0, which burns a
    // whole attempt. Re-click until curZ actually moves.
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(r => setTimeout(r, 2200));
      const state = await page.evaluate(() => {
        const r = window.__result;
        return { z: r ? r.curZ : 0, finished: !!(r && r.finished) };
      }).catch(() => ({ z: 0, finished: false }));
      if (state.z > 1.0 || state.finished) break;
      if (attempt < 4) {
        console.log(`[INFO] [Run ${round}] Still idle (z=${state.z}), re-click ${attempt + 1}...`);
        await page.mouse.click(540, 1640);
      }
    }
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

    const stagnantSamples = await page.evaluate(() => window.__stagnantSamples || []).catch(() => []);
    if (stagnantSamples && stagnantSamples.length > 0) {
      console.log(`\n=== STAGNATION SAMPLES (${stagnantSamples.length} samples over ${stagnantSamples[stagnantSamples.length - 1]?.tSec}s) ===`);
      for (const s of stagnantSamples) {
        console.log(JSON.stringify(s));
      }
      console.log(`=== END STAGNATION SAMPLES ===\n`);
      fs.writeFileSync(path.join(GAME_ROOT, 'scripts/stagnation-samples.jsonl'), stagnantSamples.map(s => JSON.stringify(s)).join('\n') + '\n', 'utf-8');
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
