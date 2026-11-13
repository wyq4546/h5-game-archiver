import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { writeArchiveLaunchers } from "./launchers.mjs";
import { ensureDir, requestIdentity, resourcePath, sha256, compareGameIdentity } from "./utils.mjs";
import { inspectCapturedRuntime } from "./source-analysis.mjs";
import { archiveDirectoryName, readGameNameEvidence, resolveGameName } from "./game-name.mjs";
import { captureLocalPreview } from "./local-preview.mjs";
import { isNoiseUrl } from "./noise-url.mjs";
export { isNoiseUrl } from "./noise-url.mjs";
import { extractArchiveCover } from "./archive-cover.mjs";
import { completeArchiveAssets } from "./asset-completer.mjs";
import { collectRuntimeAssetRegistries } from "./runtime-assets.mjs";
import { isOptionalOfflineCacheFailure } from "./offline-cache.mjs";
export { normalizeGameTitle } from "./game-name.mjs";

import { identifyCapturePlatform, resolvePlatformGameEntry, findEmbeddedGameUrl, shouldFollowEmbeddedGameUrl, activateKnownGameLoader } from "./capture-platforms.mjs";
export { identifyCapturePlatform, resolvePlatformGameEntry, findEmbeddedGameUrl, shouldFollowEmbeddedGameUrl } from "./capture-platforms.mjs";

const SAVED_RESOURCE_TYPES = new Set([
  "document", "stylesheet", "script", "image", "media", "font", "xhr", "fetch", "manifest", "other"
]);

export function conciseCaptureError(error) {
  const message = String(error?.message ?? error ?? "资源下载失败")
    .replace(/[\u001b\u009b]\[[0-?]*[ -/]*[@-~]/g, "");
  return message.split(/\r?\n/, 1)[0].trim() || "资源下载失败";
}

export async function retryTransientResource(operation, options = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      options.onRetry?.({ attempt, delayMs, error: conciseCaptureError(error) });
      if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function isCoreBinaryUrl(value) {
  return /\.(?:wasm|data|unityweb|mem|pak)(?:\.(?:gz|br))?(?:[?#]|$)/i.test(value);
}

export function isGameProgressResource(url, frameUrl, manifest) {
  if (isNoiseUrl(url)) return false;
  if (!manifest.gameUrl) return true; // Entry discovery has not completed yet.
  try {
    const game = new URL(manifest.gameUrl);
    const directory = game.pathname.replace(/[^/]*$/, '');
    const inGameBase = [url, frameUrl].filter(Boolean).some(value => {
      const candidate = new URL(value);
      return candidate.origin === game.origin && candidate.pathname.startsWith(directory);
    });
    if (inGameBase) return true;
    if (manifest.discoveredGameFrames?.some(frame => {
      try { return new URL(url).origin === new URL(frame).origin; } catch { return false; }
    })) return true;
    if (isCoreBinaryUrl(url)) return true;
    return false;
  } catch { return false; }
}


/** 日志用的短 URL。放在模块作用域，交互与抓取主流程都要用。 */
function shortUrl(value) {
  const text = String(value ?? "");
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

// 交互抓取 -------------------------------------------------------------------
//
// 为什么需要它：停止条件是「连续 N 秒没有新资源」。但游戏停在开始界面等玩家
// 点击时**不产生任何网络流量**，与「已经加载完毕」在网络层面完全无法区分，
// 于是抓取会在游戏真正开始之前就结束——开始按钮之后才加载的视图场景、角色
// 模型、数字贴图、音效等全部丢失，而完整性判定只统计「实际请求过的资源」，
// 还会报 core-complete。Rubber Ball 3D 就是这样丢了 26 个资源、离线无法开局。
//
// 因此把「主动与游戏交互一次」变成接受网络空闲的前置条件：先点一下开始，
// 再重新计时，让点击之后那一层资源有机会被请求到。

/** 计算 iframe 相对主页面视口的累计偏移，让页面坐标点击能命中 canvas。 */
async function frameOffset(frame) {
  const offset = { x: 0, y: 0 };
  let current = frame;
  while (current.parentFrame()) {
    const element = await current.frameElement().catch(() => null);
    if (!element) break;
    const rect = await element.evaluate(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y };
    }).catch(() => null);
    if (!rect) break;
    offset.x += rect.x;
    offset.y += rect.y;
    current = current.parentFrame();
  }
  return offset;
}

/**
 * 找出真正的游戏画面：所有非广告 frame 里面积最大、且**确实位于视口内**的 canvas。
 *
 * 「位于视口内」这一条是必需的，不是保险：游戏在开始前常把画布挪到屏幕外
 * （Rubber Ball 3D 的 playhop 外壳把 canvas 停在 x=-10000），只按面积挑会选中
 * 那个隐形画布，点击坐标落在视口之外，等于什么都没点。
 * 取视口内最大的 canvas 也顺带避免点到广告 iframe。
 */
async function findGameSurface(page) {
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  const candidates = [];
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame() && isNoiseUrl(frame.url())) continue;
    const box = await frame.evaluate(() => {
      let best = null;
      for (const canvas of document.querySelectorAll("canvas")) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        if (!best || rect.width * rect.height > best.width * best.height) {
          best = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
      }
      return best;
    }).catch(() => null);
    if (!box || box.width < 120 || box.height < 120) continue;
    const offset = await frameOffset(frame);
    const placed = { x: box.x + offset.x, y: box.y + offset.y, width: box.width, height: box.height };
    const centerX = placed.x + placed.width / 2;
    const centerY = placed.y + placed.height / 2;
    const onScreen = centerX >= 0 && centerX <= viewport.width && centerY >= 0 && centerY <= viewport.height;
    if (!onScreen) continue;
    candidates.push({ frameUrl: frame.url(), area: placed.width * placed.height, box: placed });
  }
  candidates.sort((a, b) => b.area - a.area);
  return candidates[0] ?? null;
}

/**
 * 与游戏交互一轮。
 *
 * canvas 游戏没有可查询的 DOM 按钮，唯一可移植的做法是在开始控件通常所在的
 * 位置点击。点位刻意限制在中轴线上（开始按钮基本都在中轴）。找不到可见画布时
 * 退回点击视口中心——站点详情页的 PLAY 按钮通常也在那里。
 * 点击若打开了新标签页（广告常见行为），立即关掉，保证抓取留在游戏上。
 */
/**
 * 在游戏画布元素上派发合成指针事件。
 *
 * 依赖于坐标的点击在画布被移出视口时完全无效，而 canvas 游戏（LayaAir/Unity 等）
 * 的输入监听挂在画布元素本身，所以直接派发事件可以绕过屏幕位置限制。
 * 同时向 canvas 与 window 派发，覆盖把监听挂在 window 上的实现。
 */
async function dispatchSyntheticStart(pages, emit) {
  const fired = [];
  for (const candidate of pages) {
    if (candidate.isClosed()) continue;
    for (const frame of candidate.frames()) {
      if (isNoiseUrl(frame.url())) continue;
      const result = await frame.evaluate(() => {
        const canvases = [...document.querySelectorAll("canvas")];
        if (!canvases.length) return null;
        canvases.sort((a, b) => b.width * b.height - a.width * a.height);
        const canvas = canvases[0];
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const options = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1, view: window };
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
          const event = type.startsWith("pointer") && typeof PointerEvent === "function"
            ? new PointerEvent(type, { ...options, pointerId: 1, pointerType: "mouse", isPrimary: true })
            : new MouseEvent(type, options);
          canvas.dispatchEvent(event);
          window.dispatchEvent(event);
        }
        return { width: Math.round(rect.width), height: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y) };
      }).catch(() => null);
      if (!result) continue;
      fired.push({ frame: shortUrl(frame.url()), canvas: result });
      emit("info", `已在画布上派发合成开始事件（画布 ${result.width}×${result.height} @ ${result.x},${result.y}）`);
      await candidate.waitForTimeout(900);
    }
  }
  if (!fired.length) return { clicked: 0, via: "", reason: "没有可派发事件的画布" };
  return { clicked: fired.length, via: `合成事件 ${fired.map(f => f.frame).join(" | ")}`, synthetic: fired };
}

async function interactWithGame(page, context, emit, state) {
  const pagesBefore = new Set(context.pages());
  const openPages = context.pages().filter(candidate => !candidate.isClosed());

  // 游戏未必在 `page` 上，所以跨页面找可见画布。但**只在找到可见画布时才点**：
  // 实测「找不到画布就对每个页面点视口中心」是有害的——Rubber Ball 3D 那次多抓了
  // 240 个资源，全部来自 doubleclick / googlesyndication / google-analytics，
  // 而游戏本体资源一个都没多（反而因为门户流程差异少了 26 个）。盲点等于在给广告
  // 制造流量，收益为零，所以这里不再回退到乱点。
  const targets = [];
  for (const candidate of openPages) {
    const surface = await findGameSurface(candidate);
    if (surface) targets.push({ target: candidate, box: surface.box, via: `画布 ${shortUrl(candidate.url())}` });
  }
  if (!targets.length) {
    // 没有视口内可见的画布。坐标点击此时无能为力（Rubber Ball 3D 的画布被门户
    // 停在 x=-10000），但**在画布元素上直接派发合成指针事件**不依赖屏幕位置，
    // 因此仍然可能触发游戏自己的开始逻辑。这比盲点坐标精确得多，也不会点到广告。
    const synthetic = await dispatchSyntheticStart(openPages, emit);
    if (synthetic.clicked > 0) return synthetic;
    return {
      clicked: 0,
      via: "",
      reason: "未找到视口内可见的游戏画布，且无法在画布上派发合成事件",
      candidatePages: openPages.map(candidate => shortUrl(candidate.url()))
    };
  }
  if (!targets.length) return { clicked: 0, via: "", reason: "没有可交互的页面" };

  const ratios = [[0.5, 0.5], [0.5, 0.62], [0.5, 0.75]].slice(0, Math.max(1, state.clicks));
  const attempts = [];
  let clicked = 0;

  for (const { target, box, via } of targets.slice(0, 3)) {
    if (target.isClosed()) continue;
    const size = target.viewportSize() ?? { width: 1280, height: 800 };
    const points = [];
    for (const [rx, ry] of ratios) {
      // 夹进视口：即使拿到的矩形略有偏移，也不会点到窗口外面去。
      const x = Math.min(size.width - 1, Math.max(1, Math.round(box.x + box.width * rx)));
      const y = Math.min(size.height - 1, Math.max(1, Math.round(box.y + box.height * ry)));
      points.push([x, y]);
    }
    attempts.push({ via, points });
    for (const [x, y] of points) {
      try {
        await target.mouse.click(x, y, { timeout: 3_000 });
        clicked += 1;
        emit("info", `已点击 (${x}, ${y}) @ ${via}，尝试触发开始动作`);
      } catch (error) {
        emit("warning", `点击失败：${conciseCaptureError(error)}`);
      }
      await target.waitForTimeout(900);
      for (const openPage of context.pages()) {
        if (pagesBefore.has(openPage)) continue;
        await openPage.close().catch(() => {});
        emit("info", "交互打开了新的标签页（广告），已关闭");
      }
    }
  }
  return { clicked, via: targets.map(t => t.via).join(" | "), attempts };
}

export async function recoverEmptyResourcesFromHar(captureRoot, manifest) {
  const emptyItems = manifest.resources.filter(item => item.path && (!item.saved || item.bytes === 0));
  if (!emptyItems.length) return 0;
  let har;
  try {
    const harPath = manifest.layoutVersion === 2
      ? path.join(captureRoot, "archive", "session.har")
      : path.join(captureRoot, "session.har");
    har = JSON.parse(await readFile(harPath, "utf8"));
  } catch {
    return 0;
  }
  let recovered = 0;
  for (const item of emptyItems) {
    const candidates = har.log?.entries?.filter(entry =>
      entry.request?.method === item.method && entry.request?.url === item.url && entry.response?.content?.text
    ) || [];
    const best = candidates.sort((a, b) =>
      (b.response.content.text?.length || 0) - (a.response.content.text?.length || 0)
    )[0];
    if (!best) continue;
    const content = best.response.content;
    const body = Buffer.from(content.text, content.encoding === "base64" ? "base64" : "utf8");
    if (!body.length) continue;
    const target = path.join(captureRoot, item.path);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
    } catch (error) {
      emit("warning", `HAR 恢复失败（已跳过）：${shortUrl(item.url)}：${error.message}`);
      continue;
    }
    item.saved = true;
    item.bytes = body.length;
    item.sha256 = sha256(body);
    item.recoveredFromHar = true;
    delete item.error;
    recovered += 1;
  }
  return recovered;
}

export function sanitizeRetryHeaders(headers) {
  const result = { ...headers };
  for (const name of Object.keys(result)) {
    if (/^(?::|host|connection|content-length|cookie|accept-encoding|proxy-|sec-)/i.test(name)) {
      delete result[name];
    }
  }
  return result;
}

export function assessCompleteness(manifest) {
  if (manifest?.packageType === "apk") {
    const ready = manifest.runtimeInspection?.coreReady !== false;
    return {
      status: ready ? "core-complete" : "incomplete",
      savedResources: manifest.resources?.length || 1,
      failedResources: 0,
      criticalFailures: ready ? [] : [{ url: manifest.sourceUrl, error: manifest.runtimeInspection?.coreRule || "APK 核心产物不完整" }],
      notes: []
    };
  }
  const extraUrls = [];
  if (Array.isArray(manifest.resources)) {
    for (const item of manifest.resources) {
      if (item.saved && item.type === "document" && item.url && !isNoiseUrl(item.url)) {
        if (manifest.platform?.mode === 'iframe') {
          if (manifest.finalUrl && item.url === manifest.finalUrl) continue;
          if (manifest.gameUrl) {
            try {
              const gu = new URL(manifest.gameUrl);
              const iu = new URL(item.url);
              if (iu.origin !== gu.origin) continue;
            } catch {}
          }
        }
        if (manifest.gameUrl || manifest.finalUrl) {
          try {
            const itemOrigin = new URL(item.url).origin;
            const validOrigins = [manifest.gameUrl, manifest.finalUrl].filter(Boolean).map(u => new URL(u).origin);
            if (!validOrigins.includes(itemOrigin)) continue;
          } catch { continue; }
        }
        extraUrls.push(item.url);
      }
    }
  }
  const gameBases = [...new Set([
    ...(manifest.platform?.mode === 'iframe' ? [manifest.gameUrl] : [manifest.gameUrl, manifest.finalUrl]),
    ...extraUrls
  ].filter(Boolean))].flatMap(value => {
    try {
      const url = new URL(value);
      return [{ origin: url.origin, directory: url.pathname.replace(/[^/]*$/, "") }];
    } catch { return []; }
  });
  const coreHosts = new Set();
  for (const f of manifest.runtimeInspection?.coreFiles || []) {
    const match = f.match(/^(?:game\/)?([^/]+)\//i);
    if (match) coreHosts.add(match[1].toLowerCase());
  }
  const belongsToGame = value => {
    try {
      const url = new URL(value);
      if (coreHosts.has(url.hostname.toLowerCase())) return true;
      return gameBases.some(base => url.origin === base.origin && url.pathname.startsWith(base.directory));
    } catch { return false; }
  };
  const saved = manifest.resources.filter(item => item.saved);
  const failed = manifest.resources.filter(item => (!item.saved || item.status >= 400) && !item.ignored && !isNoiseUrl(item.url) &&
    !(item.method === "HEAD" && item.status >= 200 && item.status < 300));
  const NON_CRITICAL_EXT = /\.(?:png|jpe?g|gif|webp|ico|svg|mp3|ogg|wav|m4a|aac|ttf|otf|woff2?)(?:[?#]|$)/i;
  const critical = failed.filter(item => {
    if (isOptionalOfflineCacheFailure(item,manifest)) return false;
    // Some Unity builds request absent service/localization configurations and
    // recover successfully. Only downgrade these recorded 404s after a complete
    // build has actually passed an offline startup check; retain the failures.
    if (item.status === 404 && item.saved && (item.method || 'GET') === 'GET' &&
        manifest.runtimeInspection?.engine === 'Unity WebGL' && manifest.runtimeInspection.coreReady &&
        manifest.localReplay?.status === 'passed' && manifest.localReplay.externalNetwork === 'blocked' &&
        /\/StreamingAssets\/(?:UnityServicesProjectConfiguration\.json|aa\/settings\.json)(?:[?#]|$)/.test(item.url)) return false;
    if (item.status === 404 && item.saved && (item.method || 'GET') === 'GET' &&
        manifest.runtimeInspection?.engine === 'Construct' && manifest.runtimeInspection.coreReady &&
        manifest.localReplay?.status === 'passed' && manifest.localReplay.externalNetwork === 'blocked' &&
        /(?:^|\/)(?:i18n\/[a-z0-9_-]+\.json|[a-z]{2}(?:-[A-Za-z0-9]+)?\.json)(?:[?#]|$)/i.test(new URL(item.url).pathname)) {
      item.nonCriticalFailure = item.nonCriticalFailure || {
        category: 'construct-optional-i18n',
        reason: 'Construct 语言配置请求 404；引擎内置捕获并使用默认文案，离线回放已通过'
      };
      return false;
    }
    if (item.status >= 300 && item.status < 400) return false;
    if (/\.(?:wasm|data|unityweb|mem|pak)(?:\.(?:gz|br))?(?:[?#]|$)/i.test(item.url)) return true;
    if (NON_CRITICAL_EXT.test(item.url)) return false;
    return belongsToGame(item.url) && ["document", "script", "stylesheet", "xhr", "fetch", "other"].includes(item.type);
  });
  const gamePayload = gameBases.length ? manifest.resources.filter(item => {
    if (!item.saved || !item.url) return false;
    return belongsToGame(item.url) && ["document", "script", "xhr", "fetch", "image", "media", "font", "other"].includes(item.type);
  }) : [];
  const gamePayloadBytes = gamePayload.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const runtime = manifest.runtimeInspection;
  const engineKnown = runtime?.engine && !runtime.engine.startsWith("Unknown");
  const shellOnly = !runtime?.coreReady && (gamePayload.length < 3 || gamePayloadBytes < 500_000);
  // 屏蔽外网后仍能启动并渲染出可见画布，是核心构建完整的直接证据；引擎名
  // 只是辅助判断，没收录特征的新引擎不应因此把整份归档判成不完整。
  const replayProvedPlayable = manifest.localReplay?.status === 'passed' &&
    manifest.localReplay.externalNetwork === 'blocked';
  const notes = [];
  if (shellOnly) critical.push({
    url: manifest.gameUrl || manifest.finalUrl || manifest.sourceUrl,
    error: `只捕获到加载外壳（${gamePayload.length} 个核心文件，${gamePayloadBytes} 字节），没有取得实际游戏构建产物`
  });
  if (!shellOnly && runtime && !runtime.coreReady) {
    const entry = manifest.gameUrl || manifest.finalUrl || manifest.sourceUrl;
    if (!engineKnown && replayProvedPlayable) notes.push({
      url: entry,
      error: "引擎未识别（未收录该引擎特征），已由离线回放验证可运行",
      reason: "引擎未识别，离线回放已通过"
    });
    else critical.push({
      url: entry,
      error: engineKnown ? `${runtime.engine} 核心文件不足：${runtime.coreRule}` : '引擎未识别，尚无法确认核心构建完整'
    });
  }
  if (manifest.localReplay?.status === 'failed') critical.push({
    url: manifest.gameUrl || manifest.finalUrl || manifest.sourceUrl,
    error: `本地回放启动未通过：${manifest.localReplay.error || '游戏画面未就绪'}`
  });
  if (manifest.captureError) critical.push({
    url: manifest.finalUrl || manifest.gameUrl || manifest.sourceUrl,
    error: `抓取失败：${manifest.captureError}`
  });
  if (manifest.runtimeAssetRegistryError) critical.push({
    url: manifest.gameUrl || manifest.finalUrl || manifest.sourceUrl,
    error: `运行时资源清单读取失败：${manifest.runtimeAssetRegistryError}`
  });
  const completion = manifest.assetCompletion;
  if (completion && (completion.failedAssets || completion.scanFailures?.length || completion.pendingAssets ||
      completion.limitReached || completion.cancelled || completion.timedOut || completion.error)) critical.push({
    url: manifest.gameUrl || manifest.finalUrl || manifest.sourceUrl,
    error: `动态依赖补全未完成（失败 ${completion.failedAssets || 0}，解析失败 ${completion.scanFailures?.length || 0}，待检查 ${completion.pendingAssets || 0}）${completion.error ? '：' + completion.error : ''}`
  });
  return {
    status: shellOnly ? "shell-only" : critical.length ? "incomplete" : "core-complete",
    savedResources: saved.length,
    failedResources: failed.length,
    gamePayloadFiles: gamePayload.length,
    gamePayloadBytes,
    criticalFailures: critical.map(item => ({ url: item.url, error: item.error || (item.status >= 400 ? `HTTP ${item.status}` : "not saved") })),
    nonCriticalFailures: [...failed.filter(item=>!critical.includes(item)).map(item=>({url:item.url,error:item.error || `HTTP ${item.status}`,reason:item.nonCriticalFailure?.reason || '非核心请求失败'})), ...notes],
    // 覆盖已请求资源与可解析的声明依赖，无法穷举运行时动态计算的路径。
    // core-complete 仍不等于实玩通过，离线可玩性必须由 replay/verify 核验。
    scope: completion ? "requested-and-declared-dependencies" : "requested-only",
    interaction: manifest.interaction ? {
      enabled: manifest.interaction.enabled !== false,
      rounds: manifest.interaction.rounds?.length ?? 0,
      clicks: (manifest.interaction.rounds ?? []).reduce((total, round) => total + (round.clicked || 0), 0),
      stoppedIdleWithoutInteraction: Boolean(manifest.interaction.stoppedIdleWithoutInteraction)
    } : null
  };
}

export function gameNameFromUrl(value) {
  const parsed = new URL(value);
  let candidate = (parsed.pathname.split("/").filter(Boolean).at(-1) || parsed.hostname).replace(/[-_]\d{5,}$/, "");
  return candidate
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[_-]+/)
    .filter(Boolean)
    .map(word => /^\d+[a-z]$/i.test(word)
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function availableCaptureRoot(output, baseName) {
  for (let suffix = 0; ; suffix += 1) {
    const candidate = path.join(output, suffix ? `${baseName}-${suffix}` : baseName);
    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }
}

export async function captureGame(options) {
  const emit = (type, message, details = {}) => options.onEvent?.({
    time: new Date().toISOString(), type, message, ...details
  });
  const startedAt = new Date();
  let lastUsefulResourceAt = Date.now();
  let coreWaitExtended = false;
  const settlePending = async (timeoutMs, pending = pendingResponses) => {
    const deadline = Date.now() + timeoutMs;
    while (pending.size) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return "timeout";
      const result = await Promise.race([
        Promise.allSettled([...pending]).then(() => "completed"),
        new Promise(resolve => setTimeout(() => resolve("timeout"), remaining))
      ]);
      if (result === "timeout") return "timeout";
    }
    return "completed";
  };
  const withTimeout = (promise, timeoutMs) => Promise.race([
    promise.then(() => "completed", () => "failed"),
    new Promise(resolve => setTimeout(() => resolve("timeout"), timeoutMs))
  ]);
  const provisionalBaseName = archiveDirectoryName(gameNameFromUrl(options.url), startedAt);
  let captureRoot = await availableCaptureRoot(options.output, provisionalBaseName);
  await ensureDir(captureRoot);
  await ensureDir(path.join(captureRoot, "archive"));
  await ensureDir(path.join(captureRoot, "preview"));
  await writeFile(path.join(captureRoot, "archive", ".capturing"), "抓取尚未完成，请勿作为完整归档使用。\r\n");

  const platform = identifyCapturePlatform(options.url);
  try {
    const urlObj = new URL(options.url);
    emit("info", `【网址识别】目标域名：${urlObj.hostname} ➜ 识别平台：[${platform.label}]（专属拉取策略：${platform.strategy}）`);
  } catch {
    emit("info", `【网址识别】匹配归档平台：[${platform.label}]（专属拉取策略：${platform.strategy}）`);
  }

  const manifest = {
    version: 2,
    layoutVersion: 2,
    sourceUrl: options.url,
    platform,
    startedAt: startedAt.toISOString(),
    durationSeconds: options.duration ?? null,
    pages: [],
    frames: [],
    resources: [],
    failures: []
  };
  const seen = new Set();
  const pendingResponses = new Set();
  const pendingCoreResponses = new Set();
  let browser;
  let context;
  let page;
  let captureError = null;
  let finalizing = false;

  const track = (promise, core = false) => {
    pendingResponses.add(promise);
    if (core) pendingCoreResponses.add(promise);
    promise.finally(() => {
      pendingResponses.delete(promise);
      pendingCoreResponses.delete(promise);
    });
  };

  try {
    const isMobilePlatform = Boolean(options.isMobile);
    const contextOptions = {
      viewport: options.viewportWidth && options.viewportHeight
        ? { width: options.viewportWidth, height: options.viewportHeight }
        : (isMobilePlatform ? { width: 450, height: 800 } : { width: 1280, height: 800 }),
      recordHar: { path: path.join(captureRoot, "archive", "session.har"), content: "embed", mode: "full" },
      isMobile: isMobilePlatform,
      hasTouch: Boolean(isMobilePlatform || options.hasTouch),
      userAgent: options.userAgent || (isMobilePlatform
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
        : undefined)
    };
    if (isMobilePlatform) {
      emit("info", `【移动环境】已针对 [${platform.label}] 启用真实移动端模拟（Mobile 9:16 + Touch）`);
    }
    if (options.storageState) {
      contextOptions.storageState = options.storageState;
      emit("info", "已加载登录态（storageState）");
    }
    emit("info", "正在启动 Chromium");
    browser = await chromium.launch({ headless: options.headless, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'] });
    context = await browser.newContext(contextOptions);
    page = await context.newPage();

  context.on("requestfailed", request => {
    const error = request.failure()?.errorText || "request failed";
    const ignored = error === "net::ERR_ABORTED" || isNoiseUrl(request.url());
    manifest.failures.push({ url: request.url(), error, ignored });
    if (isNoiseUrl(request.url())) return;
    const message = error === "net::ERR_ABORTED" ? "请求已取消" : ignored ? "已忽略非游戏请求失败" : "请求失败";
    emit(ignored ? "warning" : "error", `${message}：${shortUrl(request.url())}`, { error });
  });

  context.on("response", response => track(saveResponse(response), isCoreBinaryUrl(response.url())));

  async function saveResponse(response) {
    const request = response.request();
    if (!SAVED_RESOURCE_TYPES.has(request.resourceType())) return;
    const url = response.url();
    if (!/^https?:/i.test(url)) return;
    // Telemetry/ad bodies cannot advance game progress and must not flood the archive or idle clock.
    if (isNoiseUrl(url)) return;
    const identity = requestIdentity(request);
    if (seen.has(identity)) return;
    seen.add(identity);
    const headers = await response.allHeaders().catch(() => ({}));
    const contentType = headers["content-type"] || "";
    const item = {
      url,
      method: request.method(),
      status: response.status(),
      type: request.resourceType(),
      contentType,
      requestBodySha256: request.postDataBuffer()?.length ? sha256(request.postDataBuffer()) : undefined,
      saved: false
    };
    const frameUrl = (() => { try { return request.frame().url(); } catch { return ''; } })();
    const worker = (() => { try { return request.serviceWorker(); } catch { return null; } })();
    if (worker) item.requestSource = {type:'service-worker',url:worker.url()};
    item.gameResource = manifest.gameUrl ? isGameProgressResource(url, frameUrl, manifest) : undefined;
    const requestDiscriminator = request.method() === "GET"
      ? ""
      : `${request.method()}-${item.requestBodySha256?.slice(0, 12) || "no-body"}`;
    const destination = resourcePath(captureRoot, url, contentType, requestDiscriminator, "game");
    item.path = path.relative(captureRoot, destination).replaceAll("\\", "/");
    try {
      if (request.method() === "HEAD" || [204, 205, 304].includes(response.status()) || (response.status() >= 300 && response.status() < 400)) {
        item.saved = true;
        item.bytes = 0;
        manifest.resources.push(item);
        emit("info", `${response.status() >= 300 && response.status() < 400 ? "重定向" : "空响应"} ${response.status()}：${shortUrl(url)}`);
        return;
      }
      let body;
      try {
        if (/\.(?:bin|dat|wasm|data|unityweb|mem|pak|zip|png|jpe?g|gif|webp|ico|mp3|ogg|wav|m4a|aac|ttf|otf|woff2?|lm|lani|ltc|ltcb|sk|lav|ktx|pvr|dds)(?:\.(?:gz|br))?(?:[?#]|$)/i.test(url) &&
            /^text\//i.test(contentType) && request.method() === "GET" && response.status() >= 200 && response.status() < 300) {
          const rawRes = await fetch(url, {
            headers: sanitizeRetryHeaders(await request.allHeaders().catch(() => ({}))),
            signal: AbortSignal.timeout(30_000)
          }).catch(() => null);
          if (rawRes?.ok) body = Buffer.from(await rawRes.arrayBuffer());
        }
        if (!body) body = await response.body();
        if ((!body || body.length === 0) && response.status() >= 200 && response.status() < 300) {
          const cl = Number(response.headers()['content-length']);
          const isBinary = /\.(?:bin|dat|wasm|data|unityweb|mem|pak|zip|png|jpe?g|gif|webp|ico|mp3|ogg|wav|m4a|aac|ttf|otf|woff2?|lm|lani|ltc|ltcb|sk|lav|ktx|pvr|dds)(?:\.(?:gz|br))?(?:[?#]|$)/i.test(url);
          if (cl > 0 || isBinary) {
            throw new Error(`浏览器返回的响应体为空 (0 字节，预期 ${cl || '非空'})`);
          }
        }
      } catch (originalError) {
        const canRetry = (!finalizing || isCoreBinaryUrl(url)) && request.method() === "GET" && response.status() >= 200 && response.status() < 300 && !isNoiseUrl(url);
        if (!canRetry) throw originalError;
        emit("warning", `浏览器缓存中无法读取资源，正在补抓：${shortUrl(url)}`, { error: conciseCaptureError(originalError) });
        const retryHeaders = sanitizeRetryHeaders(await request.allHeaders().catch(() => ({})));
        body = await retryTransientResource(async () => {
          let retryResponse = null;
          try {
            if (context) {
              retryResponse = await context.request.get(url, {
                headers: retryHeaders,
                timeout: 180_000,
                failOnStatusCode: false
              });
              if (retryResponse.status() >= 200 && retryResponse.status() < 300) {
                return await retryResponse.body();
              }
              throw new Error(`补抓返回 HTTP ${retryResponse.status()}`);
            }
          } catch (ctxErr) {
            // context.request 失败或 context 已关闭时，平滑降级到原生 fetch 兜底
          } finally {
            if (retryResponse) await retryResponse.dispose().catch(() => {});
          }
          const rawRes = await fetch(url, {
            headers: retryHeaders,
            signal: AbortSignal.timeout(180_000)
          });
          if (!rawRes.ok) throw new Error(`HTTP ${rawRes.status}`);
          return Buffer.from(await rawRes.arrayBuffer());
        }, {
          onRetry: ({ attempt, delayMs, error }) => emit(
            "warning",
            `补抓失败，将在 ${delayMs}ms 后重试（${attempt}/3）：${shortUrl(url)}`,
            { error }
          )
        });
        item.recoveredBy = "context-request";
      }
      await ensureDir(path.dirname(destination));
      await writeFile(destination, body);
      item.saved = true;
      item.bytes = body.length;
      item.sha256 = sha256(body);
      if (isGameProgressResource(url, frameUrl, manifest)) lastUsefulResourceAt = Date.now();
      emit("resource", `已保存 ${request.resourceType()}：${shortUrl(url)}`, { bytes: body.length, path: item.path });
    } catch (error) {
      item.error = conciseCaptureError(error);
      item.ignored = isNoiseUrl(url) || undefined;
      emit(item.ignored ? "warning" : "error", `${item.ignored ? "已跳过非游戏资源" : "保存失败"}：${shortUrl(url)}`, { error: item.error });
    }
    manifest.resources.push(item);
  }

    emit("info", `正在打开：${options.url}`);
    let navigationResponse = null;
    try {
      navigationResponse = await page.goto(options.url, { waitUntil: "commit", timeout: 45_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
    } catch (navError) {
      emit("warning", `主导航未在预期时间内完成完整加载，继续尝试解析已渲染页面：${conciseCaptureError(navError)}`);
    }
    manifest.nameEvidence = {
      landingTitle: await page.title().catch(() => ""),
      landingMetaTitle: await page.evaluate(() => document.querySelector('meta[property="og:title"]')?.content || '').catch(() => "")
    };
    const entry = await resolvePlatformGameEntry(page, {
      sourceUrl: options.url, html: await navigationResponse?.text().catch(() => '') || '',
      emit, signal: options.signal, interact: options.interact
    });
    manifest.platform = { ...entry.platform, mode: entry.mode, reason: entry.reason, activation: entry.activation };
    manifest.gameUrl = entry.entryUrl;
    let embeddedGameUrl = entry.entryUrl;
    if (entry.mode === 'iframe') {
      manifest.siteUrl = page.url();
      emit('info', `保留平台父页面，在真实游戏 iframe 中归档：${shortUrl(entry.entryUrl)}`);
    }
    if (entry.mode === 'direct' && embeddedGameUrl && /^https?:/i.test(embeddedGameUrl)) {
      manifest.siteUrl = options.url;
      const gamePage = await context.newPage();
      const sitePage = page;
      let referer = options.url;
      const visitedEntries = new Set();
      for (let depth = 0; depth < 4 && embeddedGameUrl && !visitedEntries.has(embeddedGameUrl); depth += 1) {
        visitedEntries.add(embeddedGameUrl);
        manifest.gameUrl = embeddedGameUrl;
        emit("info", `${depth ? "发现更深一层游戏入口" : "发现实际游戏入口"}：${shortUrl(embeddedGameUrl)}`);
        emit("info", "正在直接加载游戏，而不是站点详情页");
        const gameResponse = await gamePage.goto(embeddedGameUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
          referer
        });
        const gameHtml = gameResponse
          ? await gameResponse.text().catch(() => gamePage.content().catch(() => ""))
          : await gamePage.content().catch(() => "");
        const nestedGameUrl = findEmbeddedGameUrl(gameHtml, embeddedGameUrl);
        if (!nestedGameUrl || visitedEntries.has(nestedGameUrl)) break;
        if (!shouldFollowEmbeddedGameUrl(embeddedGameUrl, nestedGameUrl)) {
          manifest.gameUrl = nestedGameUrl;
          manifest.platform.mode = 'iframe';
          emit("info", "检测到依赖嵌入环境的平台游戏，保留父页面并在 iframe 内抓取资源");
          break;
        }
        referer = embeddedGameUrl;
        embeddedGameUrl = nestedGameUrl;
      }
      page = gamePage;
      lastUsefulResourceAt = Date.now();
      // 详情页只剩下广告/统计/反爬信标在空转：它们既不属于游戏，也不该出现在
      // failures 里，还会让「连续 N 秒无新资源」迟迟不成立。游戏已按直接入口加载，
      // 父页面不再参与运行（需要父页面的平台走的是 iframe 分支），可以立刻关掉。
      if (sitePage && !sitePage.isClosed() && sitePage !== gamePage) {
        const closed = await sitePage.close().then(() => true, () => false);
        if (closed) emit("info", "已关闭站点详情页，停止与游戏无关的广告/统计请求");
      }
    }
    if (await activateKnownGameLoader(page, emit)) lastUsefulResourceAt = Date.now();
    emit("info", "游戏页面已加载，请操作游戏以触发延迟资源");
    await page.waitForTimeout(5_000);
    Object.assign(manifest.nameEvidence, await readGameNameEvidence(page, options.url, manifest.gameUrl));
    manifest.gameTitle = resolveGameName({ ...manifest.nameEvidence, sourceUrl: options.url }).name;

    const interaction = {
      enabled: options.interact !== false,
      clicks: Number.isInteger(options.interactClicks) ? options.interactClicks : 3,
      rounds: [],
      performedAt: null,
      stoppedIdleWithoutInteraction: false
    };
    let interactionsDone = 0;
    let savedAtLastInteraction = 0;
    const savedCount = () => manifest.resources.filter(item => item.saved && item.gameResource !== false).length;
    // 第一轮用较短阈值，避免每轮都等满 idleTimeoutSeconds；后续轮次等更长的空闲窗口，
    // 且只在上一轮确实带来新资源时才继续（说明点击后面还有一层内容）。
    // 注意这些阈值不能依赖 idleTimeoutSeconds 是否存在：CLI 入口不设置它
    // （只有 Web 入口设 30 秒），但 CLI 抓包同样需要交互。
    const idleBudgetMs = (options.idleTimeoutSeconds || 15) * 1000;
    const firstInteractionIdleMs = Math.min(idleBudgetMs, 8_000);
    const laterInteractionIdleMs = Math.min(idleBudgetMs, 15_000);
    const MAX_INTERACTION_ROUNDS = interaction.enabled ? 2 : 0;

    const deadline = options.duration == null ? Infinity : Date.now() + options.duration * 1000;
    while (Date.now() < deadline && !options.signal?.aborted) {
      manifest.pages = context.pages().map(openPage => ({ url: openPage.url() }));
      manifest.frames = context.pages().flatMap((openPage, pageIndex) =>
        openPage.frames().map(frame => ({ pageIndex, url: frame.url(), name: frame.name() }))
      );
      for (const openPage of context.pages()) {
        for (const frame of openPage.frames()) {
          const fUrl = frame.url();
          if (fUrl && !isNoiseUrl(fUrl) && fUrl !== manifest.gameUrl && fUrl !== options.url && !/^about:/i.test(fUrl)) {
            if (/^https?:/i.test(fUrl)) {
              manifest.discoveredGameFrames ||= [];
              if (!manifest.discoveredGameFrames.includes(fUrl)) {
                manifest.discoveredGameFrames.push(fUrl);
                emit("info", `【嵌套入口感知】发现活跃子 Frame 入口：${shortUrl(fUrl)}`);
              }
            }
          }
        }
      }
      const idleMs = Date.now() - lastUsefulResourceAt;
      // 在把「网络空闲」当成「抓完了」之前，先主动与游戏交互一次。等点击的游戏
      // 不产生流量，空闲与加载完成无法区分，这一步是补回交互后才加载的资源的关键。
      // 它独立于 idleTimeoutSeconds，因为 CLI 入口不设置该选项。
      if (interaction.enabled && interactionsDone < MAX_INTERACTION_ROUNDS && !options.signal?.aborted
          && idleMs >= (interactionsDone === 0 ? firstInteractionIdleMs : laterInteractionIdleMs)
          && (interactionsDone === 0 || savedCount() > savedAtLastInteraction)) {
        savedAtLastInteraction = savedCount();
        const round = await interactWithGame(page, context, emit, interaction);
        interaction.performedAt ??= new Date().toISOString();
        interaction.rounds.push({ ...round, at: new Date().toISOString(), savedBefore: savedAtLastInteraction });
        interactionsDone += 1;
        if (round.clicked > 0) {
          lastUsefulResourceAt = Date.now();
          emit("info", `第 ${interactionsDone} 轮游戏交互完成（点击 ${round.clicked} 次），重新开始等待新资源`);
          continue;
        }
      }
      if (options.idleTimeoutSeconds && idleMs >= options.idleTimeoutSeconds * 1000) {
        if (pendingCoreResponses.size > 0) {
          lastUsefulResourceAt = Date.now();
          emit("info", `检测到 ${pendingCoreResponses.size} 个核心资源正在传输中，保持连接并继续等待...`);
          await page.waitForTimeout(1_000);
          continue;
        }
        const runtime = await inspectCapturedRuntime(captureRoot, manifest).catch(() => null);
        const engineKnown = runtime?.engine && !runtime.engine.startsWith("Unknown");
        if (!coreWaitExtended && engineKnown && !runtime.coreReady) {
          coreWaitExtended = true;
          lastUsefulResourceAt = Date.now();
          emit("info", `已识别 ${runtime.engine} 加载壳，继续等待核心资源 ${options.idleTimeoutSeconds} 秒`);
          continue;
        }
        manifest.stopReason = "network-idle";
        interaction.stoppedIdleWithoutInteraction = !interaction.enabled || interactionsDone === 0;
        if (interaction.stoppedIdleWithoutInteraction) {
          emit("warning", "在未与游戏交互的情况下判定空闲停止；开始按钮之后的资源可能未纳入归档");
        }
        emit("info", `连续 ${options.idleTimeoutSeconds} 秒没有新的有效资源，自动停止抓取`);
        break;
      }
      await page.waitForTimeout(Math.min(1_000, Math.max(1, deadline - Date.now())));
    }
    manifest.interaction = interaction;
    if (options.signal?.aborted) {
      manifest.stopReason = "manual";
      emit("info", "收到停止指令，正在整理归档");
    } else if (!manifest.stopReason && Number.isFinite(deadline)) {
      manifest.stopReason = "duration";
    }
    await page.screenshot({ path: path.join(captureRoot, "preview", "capture-end.png"), fullPage: false, timeout: 10_000 })
      .catch(error => emit("warning", `最终截图失败：${error.message}`));
  } catch (error) {
    captureError = error;
  } finally {
    if (page && !page.isClosed()) {
      try {
        emit("info", "正在检查运行时资源包清单");
        manifest.runtimeAssetRegistries = await collectRuntimeAssetRegistries(page, {gameUrl: manifest.gameUrl});
        for (const registry of manifest.runtimeAssetRegistries) emit("info", `运行时资源清单：${registry.resources.length} 个物理资源，${registry.virtualPaths.length} 个包内路径，${Object.keys(registry.urlAliases || {}).length} 个版本映射`);
      } catch (error) {
        manifest.runtimeAssetRegistryError = conciseCaptureError(error);
        emit("warning", `运行时资源清单读取失败：${manifest.runtimeAssetRegistryError}`);
      }
    }
    finalizing = true;
    manifest.finalUrl = page?.url() || options.url;
    if (context) {
      if (pendingCoreResponses.size) emit("info", `正在等待 ${pendingCoreResponses.size} 个核心资源完成下载`);
      const coreDrained = await settlePending(180_000, pendingCoreResponses);
      if (coreDrained === "timeout") emit("warning", `仍有 ${pendingCoreResponses.size} 个核心资源未结束，将继续常规收尾`);
      if (pendingResponses.size) emit("info", `正在等待 ${pendingResponses.size} 个响应写入归档`);
      const drained = await settlePending(15_000);
      if (drained === "timeout") emit("warning", `仍有 ${pendingResponses.size} 个长连接未结束，正在强制收尾`);
      const contextClose = await withTimeout(context.close(), 10_000);
      if (contextClose !== "completed") emit("warning", `浏览器上下文关闭${contextClose === "timeout" ? "超时" : "失败"}，继续生成清单`);
      await settlePending(15_000);
      const recovered = await recoverEmptyResourcesFromHar(captureRoot, manifest);
      if (recovered) emit("info", `已从 HAR 恢复 ${recovered} 个空响应资源`);
    }
    manifest.finishedAt = new Date().toISOString();
    if (browser) {
      const browserClose = await withTimeout(browser.close(), 5_000);
      if (browserClose !== "completed") emit("warning", `Chromium 关闭${browserClose === "timeout" ? "超时" : "失败"}，归档仍将保存`);
    }
    const recoveredAfterClose = await recoverEmptyResourcesFromHar(captureRoot, manifest);
    if (recoveredAfterClose) emit("info", `已从 HAR 恢复 ${recoveredAfterClose} 个空响应资源`);
    if (captureError) manifest.captureError = conciseCaptureError(captureError);
    try {
      manifest.runtimeInspection = await inspectCapturedRuntime(captureRoot, manifest);
      emit("info", `识别游戏引擎：${manifest.runtimeInspection.engine}；核心文件${manifest.runtimeInspection.coreReady ? "已就绪" : "不足"}`);
    } catch (error) {
      emit("warning", `引擎与核心文件检查失败：${error.message}`);
    }
    try {
      const completionStats = await completeArchiveAssets(captureRoot, manifest, { emit, signal: options.signal });
      if (completionStats.fetchedAssets > 0) {
        emit("info", `自动补全完成：发现并下载了 ${completionStats.fetchedAssets} 个动态懒加载资源`);
        manifest.runtimeInspection = await inspectCapturedRuntime(captureRoot, manifest);
        emit('info', `补全后复查游戏引擎：${manifest.runtimeInspection.engine}；核心文件${manifest.runtimeInspection.coreReady ? '已就绪' : '不足'}`);
      }
    } catch (completerErr) {
      manifest.assetCompletion = { error: completerErr.message, checkedAt: new Date().toISOString() };
      emit("warning", `动态资源自动补全异常：${completerErr.message}`);
    }
    manifest.completeness = assessCompleteness(manifest);
    if (manifest.completeness.criticalFailures.length) {
      emit("error", `归档完整性检查发现 ${manifest.completeness.criticalFailures.length} 项问题（包含依赖检查结果，非缺失文件数）`);
    } else {
      emit("info", `核心资源完整；另有 ${manifest.completeness.failedResources} 个非核心请求未保存`);
      if (manifest.runtimeInspection && !manifest.runtimeInspection.coreReady) {
        emit("warning", `${manifest.runtimeInspection.engine}：核心文件规则未覆盖该引擎特征，已由离线回放（屏蔽外网）确认可运行`);
      }
    }
    // 保留身份比对用于诊断；最终名称综合标题、来源网址及描述性构建名决定。
    const buildFilenames = manifest.resources
      .filter(item => item.saved && /\.(?:data|wasm|unityweb)(?:\.(?:gz|br))?$/i.test(item.url || ""))
      .map(item => (item.url || "").split(/[?#]/)[0].split("/").pop());
    manifest.identityCheck = compareGameIdentity(manifest.gameTitle, buildFilenames);
    manifest.nameResolution = resolveGameName({ ...manifest.nameEvidence, sourceUrl: options.url, buildFilenames });
    const archiveDisplayName = manifest.nameResolution.name;
    manifest.resolvedGameName = archiveDisplayName;
    const finalBaseName = archiveDirectoryName(archiveDisplayName || manifest.gameTitle || gameNameFromUrl(options.url), startedAt);
    if (path.basename(captureRoot) !== finalBaseName && pendingResponses.size === 0) {
      const finalRoot = await availableCaptureRoot(options.output, finalBaseName);
      await rename(captureRoot, finalRoot);
      captureRoot = finalRoot;
    } else if (pendingResponses.size) {
      emit("warning", `仍有 ${pendingResponses.size} 个资源写入未结束，为避免路径失效，保留原归档目录名`);
    }
    const targetEntryUrl = new URL(manifest.gameUrl || manifest.finalUrl || manifest.sourceUrl);
    const runtimeCoreFiles = new Set(manifest.runtimeInspection?.coreFiles || []);
    const entry = (await Promise.all(manifest.resources
      .filter(item => item.saved && item.type === "document" && item.path)
      .map(async item => {
        const candidate = new URL(item.url);
        const exact = candidate.origin === targetEntryUrl.origin && candidate.pathname.replace(/index\.html$/i, "").replace(/\/$/, "") === targetEntryUrl.pathname.replace(/index\.html$/i, "").replace(/\/$/, "");
        let score = exact ? 1000 : candidate.origin === targetEntryUrl.origin ? 100 : -1000;
        try {
          const content = await readFile(path.join(captureRoot, item.path), "utf8");
          for (const core of runtimeCoreFiles) {
            if (content.includes(path.basename(core))) { score += 5000; break; }
          }
        } catch {}
        return { item, score };
      }))).sort((a, b) => b.score - a.score)[0]?.item;
    if (entry) await copyFile(path.join(captureRoot, entry.path), path.join(captureRoot, "index.html")).catch(() => {});
    await writeFile(path.join(captureRoot, "archive", "manifest.json"), JSON.stringify(manifest, null, 2));
    const coverResult = await extractArchiveCover(captureRoot, manifest, {allowNetwork:true}).catch(error => ({status:'missing',reason:error.message}));
    emit('info', coverResult.status==='saved' ? '已保存游戏封面' : '封面未自动更新，可在归档管理中手动上传');
    await writeFile(path.join(captureRoot, "README.txt"), [
      `游戏：${archiveDisplayName}`,
      ...(manifest.nameResolution.source === "build" ? [
        `注：落地页标题（${manifest.gameTitle}）与构建自报名不同，已按构建名命名。`
      ] : []),
      "",
      "index.html       游戏入口源码（离线运行请使用回放命令）",
      "game/            游戏脚本、图片、音频、模型等资源",
      "archive/         抓包记录与资源映射清单",
      "preview/         抓取及验证截图",
      "analysis/        全部解析产物（源码索引、Unity data、IL2CPP、WASM）",
      "scripts/         自动化脚本目录与 automation-context.json",
      "",
      "启动：双击 start.cmd（先关闭本游戏的旧实例，再使用随机空闲端口）",
      "停止：双击 stop.cmd"
    ].join("\r\n"));
    await writeArchiveLaunchers(captureRoot);
    await rm(path.join(captureRoot, "archive", ".capturing"), { force: true });
    if (captureError) {
      emit("error", `抓取失败，现场归档已保留：${captureRoot}`, { error: captureError.message });
    } else if (manifest.completeness.status === "shell-only") {
      emit("warning", `仅捕获到加载壳，归档已保留用于诊断：${captureRoot}`);
    } else if (manifest.completeness.status === "incomplete") {
      emit("warning", `归档已保存但核心资源不完整：${captureRoot}`);
    } else {
      emit("info", `核心构建已保存，继续验证本地启动：${captureRoot}`);
    }
  }

  if (captureError) throw captureError;
  emit("info", "正在从本地回放生成截图（禁止外网请求）");
  try {
    const previewPromise = captureLocalPreview(captureRoot);
    manifest.preview = await Promise.race([
      previewPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("本地回放截图超时（55 秒）")), 55000))
    ]);
    manifest.localReplay = {status:'passed',scope:'startup-and-visible-canvas',checkedAt:new Date().toISOString(),externalNetwork:'blocked'};
  } catch (error) {
    manifest.localReplay = {status:'failed',error:error.message,checkedAt:new Date().toISOString(),externalNetwork:'blocked'};
    emit("warning", `本地回放启动未通过：${error.message}`);
  }
  manifest.completeness = assessCompleteness(manifest);
  await writeFile(path.join(captureRoot, "archive", "manifest.json"), JSON.stringify(manifest, null, 2));
  if (manifest.completeness.status === 'core-complete') emit('complete', `核心构建与本地启动检查通过，归档已保存：${captureRoot}`);
  else emit('warning', `归档已保存，仍需检查：${manifest.completeness.criticalFailures[0]?.error || manifest.completeness.status}`);
  return { captureRoot, manifest };
}
