import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createReplayServer } from './replay.mjs';
import { saveGamePreview, isUnobscuredSurface } from './capture-preview.mjs';
import { isCoreGameRequest } from './verify.mjs';
import { isNoiseUrl } from './noise-url.mjs';

export function allowPreviewRequest(value, origin) {
  if (/^(data:|blob:)/.test(value)) return true;
  try {
    const url=new URL(value);
    if(url.origin!==origin)return false;
    const match=url.pathname.match(/^\/__origin\/([^/]+)(\/.*)?$/);
    const original=match ? Buffer.from(match[1],'base64url').toString('utf8')+(match[2]||'/')+url.search : url.searchParams.get('url')||value;
    // 广告 SDK 的在线状态心跳在回放里由本地服务直接回 200 空响应（与线上一致），
    // 不能被「噪声拦截」掐掉，否则 SDK 初始化会连等数轮超时。
    if(/\/\/[^/]*(?:gamepush|eponesh)\.com\/gs\/api\/status(?:[/?#]|$)/i.test(original))return true;
    const host = new URL(original).hostname;
    return !isNoiseUrl(original) && !/(^|\.)(an\.yandex\.ru|yandexadexchange\.net|adfox\.ru)$/.test(host);
  } catch {return false;}
}

// CrazyGames gates the game behind its account-progress-save probe. Offline the
// hidden APS frame never answers, so the publisher frame shows a "Connection
// issues" modal that covers the canvas. "Continue offline" is the platform's own
// supported offline branch, so take it instead of treating the modal as a failure.
async function dismissOfflinePlatformPrompt(page) {
  for (const frame of page.frames()) {
    try {
      const button = frame.getByRole('button', {name: /^\s*continue offline\s*$/i}).first();
      if (await button.count() && await button.isVisible({timeout: 800}).catch(() => false)) {
        await button.click({timeout: 2000});
        await page.waitForTimeout(700);
        return true;
      }
    } catch { /* A navigating frame is not a prompt owner. */ }
  }
  return false;
}

// A Unity WebGL canvas keeps the HTML default 300x150 until the runtime attaches
// and sizes it. Accepting the default would screenshot an empty page as a win.
async function canvasSizedByRuntime(page) {
  for (const frame of page.frames()) {
    try {
      for (const canvas of await frame.locator('canvas').all()) {
        const size = await canvas.evaluate(el => ({w: el.width, h: el.height}), null, {timeout: 800}).catch(() => null);
        if (size && size.w > 300 && size.h > 150) return true;
      }
    } catch { /* Detached canvases are not evidence of a running game. */ }
  }
  return false;
}

export async function captureLocalPreview(root) {
  const replay=await createReplayServer(root);
  const directory=path.join(root,'preview');
  let browser;
  const failures=[],pageErrors=[];
  try {
    await mkdir(directory,{recursive:true});
    let context,page,mapped=false;
    if(replay.archive.manifest.offlineReplay?.preserveHostname){
      const {launchMappedReplay}=await import('./offline-origin-player.mjs');
      const opened=await launchMappedReplay(root,replay.url,{headless:true,persistent:false,localPort:replay.server.address().port,navigate:false});
      context=opened.context;page=opened.page;browser={close:()=>context.close()};mapped=true;
    }else{
      browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-zero-copy']});
      context=await browser.newContext({viewport:{width:480,height:800},serviceWorkers:'block'});
      await context.route('**/*',route=>allowPreviewRequest(route.request().url(),new URL(replay.url).origin)?route.continue():route.abort());
      await context.routeWebSocket('**/*',socket=>socket.close());
      page=await context.newPage();
    }
    // 页面脚本错误才说明游戏自身启动失败。第三方平台/广告 SDK 在离线时拿不到
    // 线上接口，会抛出「未归档资源」这类提示——那属于预期的离线缺失，真正的
    // 核心资源缺件由下面的 requestfailed / 4xx+ 列表单独判定。
    page.on('pageerror',error=>{
      const message=String(error?.message||'').trim();
      if(/^(?:\d{3}\.\s*)?Missing archived resource:/i.test(message))return;
      // 门户写的 `document.domain = '<父域>'` 在 127.0.0.1 回放里天然不成立；回放注入的
      // 兼容脚本已经吞掉这类赋值，这里再兜一层，避免个别页面绕过注入仍被判成启动失败。
      if(/Failed to set the ['\u2018\u2019]domain['\u2018\u2019] property/i.test(message))return;
      pageErrors.push(error.stack || error.message);
    });
    page.on('requestfailed',request=>{
      if(request.failure()?.errorText!=='net::ERR_ABORTED' && isCoreGameRequest(request.url(),replay.archive.manifest))failures.push(request.url());
    });
    page.on('response',r=>{if(r.status()>=400 && isCoreGameRequest(r.url(),replay.archive.manifest))failures.push(r.url());});
    page.setDefaultTimeout(5000);
    await page.goto(replay.url,{waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForTimeout(5000);
    if (replay.archive.manifest.runtimeInspection?.engine === 'Unity WebGL') {
      // The offline progress-save prompt and the runtime attach both land after
      // first paint; keep clearing the prompt until the canvas is really sized.
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline && !await canvasSizedByRuntime(page)) {
        await dismissOfflinePlatformPrompt(page);
        await page.waitForTimeout(500);
      }
    }
    if (replay.archive.manifest.runtimeInspection?.engine === 'Unity WebGL') {
      // Runtime canvas sizing precedes the publisher splash and game startup.
      // Allow initialization to settle before accepting a preview.
      await dismissOfflinePlatformPrompt(page);
      await page.waitForTimeout(15000);
      await dismissOfflinePlatformPrompt(page);
    }
    if (replay.archive.manifest.runtimeInspection?.engine === 'OpenFL / Lime') {
      // OpenFL can render only its native play icon until a trusted gesture.
      // Exercise that gesture so subsequent asset errors affect validation.
      for (const canvas of await page.locator('canvas').all()) {
        if (!await canvas.evaluate(isUnobscuredSurface)) continue;
        await canvas.click({timeout:3000});
        await page.waitForTimeout(2500);
        break;
      }
    }
    const previewAttempts = replay.archive.manifest.runtimeInspection?.engine === 'Construct' ? 12 : 3;
    for(let attempt=0;attempt<previewAttempts;attempt++){
      if(pageErrors.length)throw new Error(`本地回放启动异常：${pageErrors[0]}`);
      if(failures.length)throw new Error('本地回放缺少游戏资源，未更新截图');
      await dismissOfflinePlatformPrompt(page);
      const preview=await saveGamePreview(page,root,'local-candidate.png').catch(()=>null);
      if(preview){
        if(pageErrors.length)throw new Error(`本地回放启动异常：${pageErrors[0]}`);
        await rename(path.join(directory,'local-candidate.png'),path.join(directory,'local.png'));
        const result={...preview,path:'preview/local.png',source:'local-replay',externalNetwork:'blocked'};
        await writeFile(path.join(directory,'local-preview.json'),JSON.stringify(result,null,2));
        return result;
      }
      await page.waitForTimeout(2000);
    }
    throw new Error('本地游戏画面未就绪或被遮挡，未更新截图');
  } finally {
    try { if(browser) await Promise.race([browser.close(), new Promise((_, r) => setTimeout(() => r(new Error('close timeout')), 3000))]).catch(()=>{}); }
    finally { replay.server.closeAllConnections(); await new Promise(resolve=>replay.server.close(resolve)); }
  }
}
