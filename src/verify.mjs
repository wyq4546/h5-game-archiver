import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createReplayServer } from "./replay.mjs";

function originalRequestUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/__origin\/([^/]+)(\/.*)?$/);
    if (!match) return value;
    const origin = Buffer.from(match[1], "base64url").toString("utf8");
    return `${origin}${match[2] || "/"}${url.search}`;
  } catch {
    return value;
  }
}

export function isCoreGameRequest(value, manifest) {
  const original = originalRequestUrl(value);
  if (/\.(?:wasm|data|unityweb|mem|pak)(?:[?#]|$)/i.test(original)) return true;
  try {
    const requestUrl = new URL(original);
    return [manifest.gameUrl, manifest.finalUrl].filter(Boolean).some(value => {
      const gameUrl = new URL(value);
      const directory = gameUrl.pathname.replace(/[^/]*$/, "");
      return requestUrl.origin === gameUrl.origin && requestUrl.pathname.startsWith(directory);
    });
  } catch {
    return false;
  }
}

export function isActionablePageError(message) {
  // This YYG Worker diagnostic is emitted via console.error even on success.
  if (/^onmessage data \{url:/.test(message)) return false;
  return !/Failed to load resource|ERR_ABORTED|^Blocked: https?:|Pointer_stringify|FS\.syncfs operations|IMA SDK is either not loaded from a google domain|Cross-Origin-Opener-Policy header has been ignored|Failed to register a ServiceWorker.*https?:\/\/(?:127\.0\.0\.1|localhost)|newapi\.rollic\.gs.*Content Security Policy|has been blocked by CORS policy|Shader .*subshader .*pass .*variant .*not found|reading 'SendMessage'/i.test(message);
}

export async function verifyArchive(options) {
  const replay = await createReplayServer(options.archive);
  const failures = [];
  const pageErrors = [];
  let browser;
  try {
    let context,page;
    if(replay.archive.manifest.offlineReplay?.preserveHostname){
      const {launchMappedReplay}=await import('./offline-origin-player.mjs');
      const opened=await launchMappedReplay(options.archive,replay.url,{headless:true,persistent:false,localPort:replay.server.address().port,navigate:false});
      context=opened.context;page=opened.page;browser={close:()=>context.close()};
    }else{
      browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
      context=await browser.newContext({viewport:{width:450,height:800}});page=await context.newPage();
    }
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") pageErrors.push(message.text());
    });
    page.on("requestfailed", request => {
      const error = request.failure()?.errorText;
      if (error === "net::ERR_ABORTED") return;
      failures.push({ url: request.url(), error });
    });
    page.on("response", response => {
      if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() });
    });
    await page.goto(replay.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout((options.duration || 5) * 1000);
    const outputDirectory = replay.archive.manifest.layoutVersion === 2
      ? path.join(replay.archive.root, "preview")
      : replay.archive.root;
    const screenshot = path.join(outputDirectory, "offline.png");
    await page.screenshot({ path: screenshot });
    const replayOrigin = new URL(replay.url).origin;
    const externalRequests = await page.evaluate(origin =>
      performance.getEntriesByType("resource").map(item => item.name).filter(url => {
        try { return new URL(url).origin !== origin; } catch { return false; }
      }),
      replayOrigin
    );
    const gameSurface = await page.evaluate(() => {
      const canvases = [...document.querySelectorAll("canvas")];
      const visibleCanvases = canvases.filter(canvas => {
        const rect = canvas.getBoundingClientRect();
        const style = getComputedStyle(canvas);
        return rect.width > 50 && rect.height > 50 && style.display !== "none" && style.visibility !== "hidden";
      });
      return {
        canvasCount: canvases.length,
        visibleCanvasCount: visibleCanvases.length,
        documentReady: document.readyState
      };
    });
    const criticalFailures = failures.filter(item => isCoreGameRequest(item.url, replay.archive.manifest));
    const criticalPageErrors = pageErrors.filter(isActionablePageError);
    const report = {
      verifiedAt: new Date().toISOString(),
      ok: criticalFailures.length === 0 && criticalPageErrors.length === 0 && gameSurface.visibleCanvasCount > 0,
      replayUrl: replay.url,
      failures,
      criticalFailures,
      ignoredFailures: failures.filter(item => !criticalFailures.includes(item)),
      pageErrors,
      criticalPageErrors,
      externalRequests,
      gameSurface,
      screenshot: replay.archive.manifest.layoutVersion === 2 ? "preview/offline.png" : "offline.png"
    };
    const reportPath = replay.archive.manifest.layoutVersion === 2
      ? path.join(replay.archive.root, "archive", "verification.json")
      : path.join(replay.archive.root, "verification.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    await context.close();
    return report;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => replay.server.close(resolve));
  }
}

