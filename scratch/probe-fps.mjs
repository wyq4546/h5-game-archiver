// 帧率归因探针：区分 (a) 渲染/合成瓶颈 (b) Unity CPU 主循环瓶颈 (c) 分辨率填充率瓶颈
// 用法: node probe-fps.mjs [--only A|B|C|D]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const GAME_ROOT = path.resolve(SCRIPT_DIR, '..');
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
  if (!targetFile || !fs.existsSync(targetFile)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(targetFile).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.png': 'image/png', '.wasm': 'application/wasm', '.unityweb': 'application/octet-stream'
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
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(content); return;
  }
  if (ext === '.js' && targetFile.endsWith('7k7k.js')) {
    let content = fs.readFileSync(targetFile, 'utf-8');
    content = content.replace('var Browser = {', 'window.__unityBrowser = Browser; var Browser = window.__unityBrowser = {');
    res.writeHead(200, { 'Content-Type': contentType }); res.end(content); return;
  }
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(targetFile).pipe(res);
});

const PORT = 8099;
const FULL_CHROME = path.join(process.env.HOME, '.cache/ms-playwright/chromium-1254/chrome-linux64/chrome');

// rAF 采样器：注入到页面，统计 3 秒内 rAF 回调次数 + 最长/平均间隔
const RAF_SAMPLER = `
(() => {
  window.__rafLog = [];
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => { window.__rafLog.push(t); cb(t); });
  return true;
})()`;

async function measure(name, launchOpts, viewport) {
  const out = { name, renderer: '?', rafFps: 0, uniFps: 0, loadMs: 0, err: null };
  let browser;
  try {
    const t0 = Date.now();
    browser = await chromium.launch({ headless: true, ...launchOpts });
    const page = await browser.newPage({ viewport });
    await page.addInitScript(RAF_SAMPLER);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await page.waitForFunction('window.__unityModule', null, { timeout: 180000 });
    out.loadMs = Date.now() - t0;

    out.renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'NO_WEBGL';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no_ext:' + gl.getParameter(gl.RENDERER);
    });

    // 预热，让游戏进入 Playing
    await page.waitForTimeout(8000);
    // 复位采样窗口
    await page.evaluate(() => { window.__rafLog = []; window.__rafT0 = performance.now(); });
    await page.waitForTimeout(4000);
    const r = await page.evaluate(() => {
      const log = window.__rafLog || [];
      const span = performance.now() - window.__rafT0;
      let maxGap = 0;
      for (let i = 1; i < log.length; i++) maxGap = Math.max(maxGap, log[i] - log[i - 1]);
      return { n: log.length, span, maxGap };
    });
    out.rafFps = +(r.n / (r.span / 1000)).toFixed(1);
    out.maxGapMs = Math.round(r.maxGap);
  } catch (e) {
    out.err = String(e).split('\n')[0].slice(0, 160);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  console.log(`[${out.name}] renderer=${out.renderer} rafFps=${out.rafFps} maxGap=${out.maxGapMs ?? '-'}ms load=${(out.loadMs/1000).toFixed(0)}s ${out.err ? 'ERR=' + out.err : ''}`);
  return out;
}

const CONFIGS = {
  A: { label: 'A 现状(headless-shell)', opts: { args: ['--no-sandbox','--use-gl=angle','--use-angle=gl-egl','--disable-background-timer-throttling'] }, viewport: { width: 1080, height: 1920 } },
  B: { label: 'B 完整chrome(new headless)+gl-egl', opts: { channel: 'chromium', args: ['--no-sandbox','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist','--enable-gpu-rasterization','--disable-background-timer-throttling'] }, viewport: { width: 1080, height: 1920 } },
  C: { label: 'C 完整chrome+gl-egl+小视口600', opts: { channel: 'chromium', args: ['--no-sandbox','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist'] }, viewport: { width: 600, height: 600 } },
  D: { label: 'D 完整chrome+vulkan', opts: { channel: 'chromium', args: ['--no-sandbox','--use-angle=vulkan','--ignore-gpu-blocklist','--disable-background-timer-throttling'] }, viewport: { width: 1080, height: 1920 } },
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
server.listen(PORT, '127.0.0.1', async () => {
  const results = [];
  for (const k of Object.keys(CONFIGS)) {
    if (only && k !== only) continue;
    const c = CONFIGS[k];
    results.push(await measure(c.label, c.opts, c.viewport));
  }
  console.log('=== SUMMARY ===');
  for (const r of results) console.log(`${r.name} | ${r.renderer} | raf=${r.rafFps}fps | maxGap=${r.maxGapMs ?? '-'}ms`);
  server.close();
  process.exit(0);
});
