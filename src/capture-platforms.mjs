import { isNoiseUrl } from './noise-url.mjs';

export function normalizeGameEntryUrl(value, baseUrl = "") {
  try {
    const parsed = new URL(value.startsWith("//") ? `https:${value}` : value, baseUrl || undefined);
    if (!/^https?:$/.test(parsed.protocol)) return "";
    if (isNoiseUrl(parsed.href)) return "";
    const host = parsed.hostname.toLowerCase();
    if (/\b(?:facebook\.(?:com|net)|fbcdn\.net|connect\.facebook\.net|google-analytics\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|googleadservices\.com|recaptcha|amazononcircle\.com|advertisingquality\.page|hotjar\.com|cloudflareinsights\.com|mixpanel\.com|amplitude\.com|appsflyer\.com|branch\.io|adjust\.com|taboola\.com|outbrain\.com|criteo\.com|bidswitch\.net|openx\.net|pubmatic\.com|adroll\.com|scorecardresearch\.com|adsrvr\.org|tiktok\.com|twitter\.com|x\.com|linkedin\.com|pinterest\.com|reddit\.com|youtube\.com)\b/i.test(host)) return "";
    if (/\.(?:js|css|mjs|map|json|xml|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp4|webm)(?:$|[?#])/i.test(parsed.pathname)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export function shouldFollowEmbeddedGameUrl(parentUrl, childUrl) {
  try {
    const expectedParent = new URLSearchParams(new URL(childUrl).hash.slice(1)).get("origin");
    return !expectedParent || new URL(expectedParent).origin !== new URL(parentUrl).origin;
  } catch {
    return true;
  }
}

export function findEmbeddedGameUrl(html, baseUrl = "") {
  const normalized = html
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&")
    .replaceAll("&#x2F;", "/")
    .replaceAll("&#47;", "/");
  const candidates = [];
  const addMatches = (pattern, sourceScore) => {
    for (const match of normalized.matchAll(pattern)) {
      const value = match[1] || match[0];
      const candidate = normalizeGameEntryUrl(value, baseUrl);
      if (!candidate) continue;
      try {
        const parsed = new URL(candidate);
        let score = sourceScore + parsed.pathname.split("/").filter(Boolean).length;
        if (/\/index\.html$/i.test(parsed.pathname)) score += 300;
        if (/html5\.gamedistribution\.com$/i.test(parsed.hostname)) score += 100;
        if (/\/[a-f0-9]{20,}\/index\.html$/i.test(parsed.pathname)) score += 300;
        if (/\/(?:play|game|runner|embed)\//i.test(parsed.pathname)) score += 50;
        if (/\/play\/?$/i.test(parsed.pathname)) score += 250;
        candidates.push({ url: candidate, score });
      } catch {}
    }
  };
  addMatches(/<a\b[^>]*?\bhref=["']([^"']+\/play\/?(?:\?[^"']*)?)["'][^>]*>[\s\S]{0,200}?\bPLAY(?:\s+NOW)?\b/gi, 600);
  addMatches(/(?:id=["']item-direct-container["']|class=["'][^"']*item-direct-container[^"']*["'])[\s\S]{0,1200}?data-src=["'](https?:\/\/[^"']+)["']/gi, 250);
  addMatches(/["'](?:loaderOptions|gameUrl|game_url|embedUrl|gamePath|iframeUrl)["'][^}]*?["']url["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi, 500);
  addMatches(/["'](?:gameUrl|game_url|embedUrl|gamePath|iframeUrl)["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi, 450);
  // 国内门户（7k7k 等）把真实构建地址写在页面自己的 JS 对象里：`gamePath: "https://…"`。
  // 键名没有引号，属于 JS 字面量而不是 JSON，上面那条只认带引号的键，会整页漏检——
  // 于是把详情页当成游戏本体抓，最终只拿到加载外壳。这里的引号必须可选。
  addMatches(/["']?\b(?:gameUrl|game_url|embedUrl|embed_url|gamePath|game_path|iframeUrl)["']?\s*:\s*["'](https?:\/\/[^"']+)["']/gi, 420);
  addMatches(/<iframe\b[^>]*?\bsrc=["'](https?:\/\/[^"']+)["']/gi, 350);
  addMatches(/gameSrc\s*=\s*["'](\/\/[^"']+)["']/gi, 500);
  addMatches(/<iframe\b[^>]*?\bsrc=["'](\/\/[^"']+)["']/gi, 300);
  addMatches(/(?:^|[\s>])src\s*=\s*["'](\/\/[^"']+)["']/gi, 20);
  addMatches(/https?:\/\/html5\.gamedistribution\.com\/[^"'<>\s\\]+/gi, 100);
  return candidates.sort((a, b) => b.score - a.score)[0]?.url || "";
}

export async function activateKnownGameLoader(page, emit) {
  let host = "";
  try { host = new URL(page.url()).hostname; } catch {}
  if (!/(?:^|\.)gamedistribution\.com$/i.test(host)) return false;

  const accept = page.locator("#onetrust-accept-btn-handler");
  await accept.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
  if (await accept.isVisible().catch(() => false)) {
    await accept.click({ timeout: 5_000 }).catch(() => {});
    emit("info", "已处理 GameDistribution 隐私提示");
  }

  const play = page.locator("#pluto-splash-button");
  await play.waitFor({ state: "visible", timeout: 12_000 }).catch(() => {});
  if (!await play.isVisible().catch(() => false)) return false;
  await play.click({ timeout: 5_000 });
  emit("info", "已自动点击 GameDistribution PLAY，正在加载游戏构建");
  return true;
}

const PLATFORMS = [
  { id: 'playhop', label: 'Playhop', hosts: ['playhop.com'], strategy: 'sdk-parent' },
  { id: 'yandex-games', label: 'Yandex Games', hosts: ['yandex.ru', 'yandex.com'], strategy: 'sdk-parent' },
  { id: 'freegame', label: 'FreeGame', hosts: ['freegame.com'], strategy: 'designated-frame' },
  { id: 'y8', label: 'Y8', hosts: ['y8.com'], strategy: 'lazy-entry' },
  { id: 'yad', label: 'Yad / YYG', hosts: ['yad.com'], strategy: 'publisher-entry' },
  { id: 'crazygames', label: 'CrazyGames', hosts: ['crazygames.com'], strategy: 'publisher-frame' },
  { id: 'gamedistribution', label: 'GameDistribution', hosts: ['gamedistribution.com'], strategy: 'native-play' },
  { id: 'poki', label: 'Poki', hosts: ['poki.com', 'poki.cn'], strategy: 'poki-frame' },
  { id: 'kiz10', label: 'Kiz10', hosts: ['kiz10.com'], strategy: 'kiz10-frame' },
  { id: 'gamemonetize', label: 'GameMonetize', hosts: ['gamemonetize.com'], strategy: 'publisher-frame' },
  // 7k7k 的详情页 `/swf/<id>.htm` 从不直接嵌 iframe，而是把构建地址写在页面自己的
  // `var gameInfo = { gamePath: "https://flash.7k7k.com/…/index.html" }` 里，由它的播放器
  // 脚本（前置广告/防沉迷倒计时结束后）动态载入。只按 iframe 找入口会扑空，
  // 必须读页面声明的 gamePath 才拿得到真正的构建产物。
  { id: '7k7k', label: '7k7k 小游戏', hosts: ['7k7k.com'], strategy: 'declared-game-path' },
  { id: 'playplayfun', label: 'PlayPlayFun', hosts: ['playplayfun.com'], strategy: 'designated-frame' },
  { id: 'lagged', label: 'Lagged', hosts: ['lagged.com'], strategy: 'publisher-frame' }
];

export function identifyCapturePlatform(value) {
  try {
    const url = new URL(value);
    const found = PLATFORMS.find(rule => rule.hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)) &&
      (rule.id !== 'yandex-games' || /^\/games(?:\/|$)/.test(url.pathname)));
    if (found) return { id: found.id, label: found.label, strategy: found.strategy };
  } catch {}
  return { id: 'generic', label: '通用站点', strategy: 'generic-entry' };
}

function yandexGameHost(hostname) {
  const app = hostname.match(/^app-(\d+)\.(?:games\.s3\.yandex\.net|cdn\.games\.yandex\.net)$/i);
  if (app) return { appId: app[1] };
  return /^(?:games\.s3\.yandex\.net|cdn\.games\.yandex\.net)$/i.test(hostname) ? { appId: '' } : null;
}

function matchingSdkFrame(value, appId) {
  try {
    const url = new URL(value);
    const hash = new URLSearchParams(url.hash.slice(1));
    const host = yandexGameHost(url.hostname), pathId = url.pathname.match(/^\/(\d+)\//)?.[1];
    return Boolean(normalizeGameEntryUrl(value)) && Boolean(host) && !/^\/(?:helpers?|sdk)(?:\/|$)/i.test(url.pathname) &&
      (!host.appId || host.appId === appId) && (!pathId || pathId === appId) &&
      (!hash.get('app-id') || hash.get('app-id') === appId) &&
      (host.appId === appId || pathId === appId);
  } catch { return false; }
}

/** Source platform selects entry discovery; engine detection runs on the captured build afterwards. */
export async function resolvePlatformGameEntry(page, options = {}) {
  const sourceUrl = options.sourceUrl || page.url();
  let platform = identifyCapturePlatform(sourceUrl);
  if (platform.id === 'generic') platform = identifyCapturePlatform(page.url());
  const emit = options.emit || (() => {});
  emit('info', `识别归档平台：${platform.label}；入口策略：${platform.strategy}`);
  const timeoutMs = options.timeoutMs ?? (platform.strategy === 'sdk-parent' ? 60_000 : 25_000);
  const activation = { clicked: false };
  const result = (entryUrl, mode, reason) => ({ platform, entryUrl, mode, reason, activation });

  if (platform.id === 'poki') {
    // games.poki.com is the SDK bridge; the publisher lives one frame deeper.
    // Keep that parent alive for hoist=yes and wait for the actual CDN frame.
    const deadline = Date.now() + timeoutMs;
    let lastPlayClickAt = 0;
    do {
      const native = page.frames().map(frame => frame.url()).find(value => {
        try {
          return /(?:^|\.)(?:gdn\.poki\.com|poki-gdn\.com)$/i.test(new URL(value).hostname) && normalizeGameEntryUrl(value);
        } catch { return false; }
      });
      if (native) return result(native, 'iframe', 'native-publisher-frame');
      if (options.signal?.aborted) return result(page.url(), 'current', 'cancelled');
      if (options.interact !== false && Date.now() - lastPlayClickAt >= 1000) {
        const play = page.locator('button#play-game-tile').first();
        if (await play.isVisible().catch(() => false)) {
          try {
            await play.click({timeout:1500});
            lastPlayClickAt = Date.now();
            const first = !activation.clicked;
            activation.clicked = true;
            emit('info', first ? '已点击 Poki 手机页面 Play now，等待原生游戏 iframe' : 'Poki 开始按钮仍可见，客户端就绪后重试原生启动');
          } catch { /* A hydrated/replaced tile can be retried while waiting. */ }
        }
      }
      await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    throw new Error('Poki 未找到真实游戏 CDN iframe；保留加载失败诊断，不把门户或 SDK 桥接页当作游戏入口');
  }

  if (platform.id === 'crazygames') {
    const deadline = Date.now() + timeoutMs;
    let declaredPublisher = '';
    let lastPlayClickAt = 0;
    do {
      const frames = page.frames();
      const urls = frames.map(frame => frame.url());
      const publisher = urls.find(value => {
        try {
          return /(?:^|\.)game-files\.crazygames\.com$/i.test(new URL(value).hostname) && normalizeGameEntryUrl(value);
        } catch { return false; }
      });
      if (publisher) return result(publisher, 'iframe', 'native-publisher-frame');
      if (options.interact !== false && Date.now() - lastPlayClickAt >= 1000) {
        const play = page.getByRole('button', {name:/^Play now$/i}).first();
        if (await play.isVisible().catch(() => false)) {
          lastPlayClickAt = Date.now();
          try {
            await play.click({timeout:1500});
            if (!activation.clicked) emit('info', '已点击 CrazyGames 手机页面 Play now，等待原生游戏 iframe');
            activation.clicked = true;
          } catch { /* Retry if the mobile tile is still hydrating or covered. */ }
        }
      }
      // Some games use a developer-owned host rather than game-files. Only
      // follow the URL declared by the CrazyGames bridge, within its subtree.
      for (const bridge of frames.filter(frame => {
        try { return new URL(frame.url()).hostname === 'games.crazygames.com'; }
        catch { return false; }
      })) {
        const declared = await bridge.evaluate(() => window.options?.loader === 'iframe'
          ? window.options.loaderOptions?.url : '').catch(() => '');
        const expected = normalizeGameEntryUrl(declared || '', bridge.url());
        if (!expected) continue;
        declaredPublisher = expected;
        const target = new URL(expected);
        const native = frames.find(frame => {
          if (!normalizeGameEntryUrl(frame.url())) return false;
          let ancestor = frame.parentFrame();
          while (ancestor && ancestor !== bridge) ancestor = ancestor.parentFrame();
          if (ancestor !== bridge) return false;
          const url = new URL(frame.url());
          return url.origin === target.origin && url.pathname === target.pathname;
        });
        if (native) return result(native.url(), 'iframe', 'declared-external-publisher-frame');
      }
      if (options.signal?.aborted) break;
      await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    if (declaredPublisher && !options.signal?.aborted) throw new Error(`CrazyGames 未找到声明的真实游戏 iframe：${declaredPublisher}`);
    const fallback = page.frames().map(frame => frame.url()).find(value => {
      try {
        return /(?:^|\.)(?:games|game-files)\.crazygames\.com$/i.test(new URL(value).hostname) && normalizeGameEntryUrl(value);
      } catch { return false; }
    });
    if (fallback) return result(fallback, fallback === page.url() ? 'current' : 'iframe', 'native-publisher-frame');
  }

  if (platform.strategy === 'sdk-parent') {
    const extractAppId = u => {
      try {
        const url = new URL(u);
        const pathMatch = url.pathname.match(/\/app\/(?:.*?[_-])?(\d+)(?:\/|$)/i) ||
                          url.pathname.match(/\/app\/(\d+)(?:\/|$)/i) ||
                          url.pathname.match(/\/(\d{5,9})(?:\/|$)/);
        if (pathMatch) return pathMatch[1];
        const param = url.searchParams.get('app-id') || url.searchParams.get('appId') ||
                      new URLSearchParams(url.hash.slice(1)).get('app-id');
        if (param && /^\d+$/.test(param)) return param;
      } catch {}
      return '';
    };
    let appId = extractAppId(sourceUrl) || extractAppId(page.url());
    let deadline = Date.now() + timeoutMs;
    let entryUrl = '';
    let lastAdLogAt = 0;
    let lastSkipAttemptAt = 0;

    if (options.interact !== false) {
      await page.locator('button[data-guard-accept]:visible, button:has-text("现在玩"):visible, button:has-text("Play"):visible').first()
        .waitFor({ state: 'visible', timeout: Math.min(5000, timeoutMs) }).catch(() => {});
    }
    do {
      if (options.signal?.aborted) return result(entryUrl, 'iframe', 'cancelled');

      const now = Date.now();
      if (options.interact !== false && !activation.clicked) {
        const guard = page.locator('button[data-guard-accept]:visible, button:has-text("现在玩"):visible, button:has-text("Play now"):visible, button:has-text("Play"):visible').first();
        if (await guard.isVisible().catch(() => false)) {
          await guard.click({ timeout: Math.max(1, Math.min(5000, deadline - now)) }).catch(() => {});
          activation.clicked = true;
          emit('info', `已点击 ${platform.label} 原生开始按钮，保留父页面以完成 SDK 通信`);
        }
      }

      if (options.interact !== false && now - lastSkipAttemptAt > 1000) {
        lastSkipAttemptAt = now;
        const skipCandidate = page.locator([
          '[class*="skip-button" i]:visible',
          '[class*="skip_button" i]:visible',
          '[class*="skipAd" i]:visible',
          '[class*="btn-skip" i]:visible',
          'button:has-text("Skip"):visible',
          'button:has-text("跳过"):visible',
          '[aria-label*="skip" i]:visible',
          '[aria-label*="close" i]:visible'
        ].join(', ')).first();
        if (await skipCandidate.isVisible().catch(() => false)) {
          const btnText = await skipCandidate.innerText().catch(() => '') || '';
          await skipCandidate.click({ timeout: 1000 }).catch(() => {});
          emit('info', `已触发前置广告跳过按钮${btnText ? ` [${btnText.trim()}]` : ''}`);
        }
      }

      if (!appId) {
        for (const frame of page.frames()) {
          try {
            const u = new URL(frame.url());
            const host = yandexGameHost(u.hostname);
            const candidate = host && (host.appId || u.pathname.match(/^\/(\d{5,9})\//)?.[1]);
            if (candidate) { appId = candidate; break; }
          } catch {}
        }
      }
      if (appId) {
        entryUrl = page.frames().map(frame => frame.url()).find(url => matchingSdkFrame(url, appId)) || '';
      }
      if (!entryUrl && !appId) {
        entryUrl = page.frames().map(frame => frame.url()).find(url => {
          try {
            const u = new URL(url);
            return Boolean(yandexGameHost(u.hostname)) &&
              !/helper|storage|preloader|adv|banner|adfox/i.test(u.pathname);
          } catch { return false; }
        }) || '';
      }
      if (entryUrl) return result(entryUrl, 'iframe', 'app-id-frame');

      const adStatus = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        for (const v of videos) {
          if (v.muted === false) {
            try { v.muted = true; } catch {}
          }
          if (v.paused && !v.ended && v.currentTime > 0) {
            try { v.play(); } catch {}
          }
          if (v.playbackRate < 4 && !v.ended) {
            try { v.playbackRate = 4.0; } catch {}
          }
          if (!v.ended && (v.duration > 0 || v.currentTime > 0)) {
            return {
              hasVideo: true,
              duration: Math.round(v.duration || 0),
              currentTime: Math.round(v.currentTime || 0),
              remaining: Math.max(0, Math.round((v.duration || 0) - (v.currentTime || 0)))
            };
          }
        }
        const adContainer = document.querySelector('[class*="video-player" i], [class*="ad-player" i], [id*="player" i], [class*="adv" i], [class*="preroll" i]');
        if (adContainer && adContainer.getBoundingClientRect().height > 50) {
          return { hasVideo: false, duration: 0, currentTime: 0, remaining: 15 };
        }
        return null;
      }).catch(() => null);

      if (adStatus) {
        const minNeededDeadline = Date.now() + Math.max(15_000, (adStatus.remaining + 10) * 1000);
        if (minNeededDeadline > deadline) {
          deadline = minNeededDeadline;
        }
        if (now - lastAdLogAt > 4000) {
          lastAdLogAt = now;
          if (adStatus.hasVideo && adStatus.duration > 0) {
            emit('info', `检测到 ${platform.label} 前置视频广告正在播放（进度：${adStatus.currentTime}s/${adStatus.duration}s），自动延期等待...`);
          } else {
            emit('info', `检测到 ${platform.label} 前置广告正在加载或播放，自动延期等待...`);
          }
        }
      }

      await page.waitForTimeout(300);
    } while (Date.now() < deadline);
    throw new Error(`${platform.label} 未找到${appId ? ` app ${appId}` : ''} 的真实游戏 iframe；保留加载失败诊断，不跟随广告入口`);
  }

  let entryUrl = '';
  if (platform.id === 'freegame') {
    if (new URL(sourceUrl).hostname === 'cdn.freegame.com' || new URL(page.url()).hostname === 'cdn.freegame.com')
      return result(page.url(), 'current', 'native-cdn-entry');
    const frame = page.locator('iframe[name="play_game_frame"], iframe#play_game_frame').first();
    await frame.waitFor({ state: 'attached', timeout: timeoutMs }).catch(() => {});
    if (await frame.count()) entryUrl = normalizeGameEntryUrl(await frame.getAttribute('src', { timeout: 1000 }).catch(() => '') || '', page.url());
    if (!entryUrl) entryUrl = page.frames().map(frame => frame.url()).find(value => { try { return new URL(value).hostname === 'cdn.freegame.com'; } catch { return false; } }) || '';
    if (!entryUrl) throw new Error('FreeGame 未找到指定 iframe 或原生 CDN 的真实游戏入口');
  } else if (platform.id === 'y8') {
    const lazy = page.locator('#item-direct-container[data-src], .item-direct-container[data-src]').first();
    entryUrl = normalizeGameEntryUrl(await lazy.getAttribute('data-src', { timeout: Math.min(timeoutMs, 3000) }).catch(() => '') || '', page.url());
  } else if (platform.id === 'yad') {
    const gameFrame = page.locator('iframe#game_frame, iframe#game-frame').first();
    entryUrl = normalizeGameEntryUrl(await gameFrame.getAttribute('src', { timeout: Math.min(timeoutMs, 3000) }).catch(() => '') || '', page.url());
  } else if (platform.id === 'kiz10') {
    const kizFrame = page.locator('iframe#game-iframe, iframe[src*="kiz10"], iframe.game-iframe').first();
    entryUrl = normalizeGameEntryUrl(await kizFrame.getAttribute('src', { timeout: Math.min(timeoutMs, 3000) }).catch(() => '') || '', page.url());
  } else if (platform.id === 'gamemonetize') {
    const gmFrame = page.locator('iframe[src*="gamemonetize"], iframe#game-frame').first();
    entryUrl = normalizeGameEntryUrl(await gmFrame.getAttribute('src', { timeout: Math.min(timeoutMs, 3000) }).catch(() => '') || '', page.url());
  }
  if (!entryUrl) entryUrl = findEmbeddedGameUrl(await page.content().catch(() => options.html || ''), page.url());
  if (!entryUrl && options.html) entryUrl = findEmbeddedGameUrl(options.html, page.url());
  if (!entryUrl || entryUrl === page.url()) return result(page.url(), 'current', 'already-game-or-no-embedded-entry');
  const mode = shouldFollowEmbeddedGameUrl(page.url(), entryUrl) ? 'direct' : 'iframe';
  return result(entryUrl, mode, platform.strategy);
}
