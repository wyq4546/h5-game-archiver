import http from "node:http";
import {declaredResourceAliases} from './resource-aliases.mjs';
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from './utils.mjs';

const TEXT_TYPES = /^(text\/|application\/(javascript|json|xml|x-javascript))/i;
const CORE_BINARY_URL = /\.(?:wasm|data|unityweb|mem|pak)(?:\.(?:gz|br))?(?:[?#]|$)/i;
const BINARY_EXTENSION = /\.(?:bin|dat|wasm|data|unityweb|mem|pak|zip|png|jpe?g|gif|webp|ico|mp3|ogg|wav|m4a|aac|ttf|otf|woff2?|lm|lani|ltc|ltcb)(?:\.(?:gz|br))?(?:[?#]|$)/i;

function isBinaryBuffer(buf) {
  const checkLen = Math.min(buf.length, 1024);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

export async function loadArchive(archiveRoot) {
  const root = path.resolve(archiveRoot);
  let manifestPath = path.join(root, "archive", "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    manifestPath = path.join(root, "manifest.json");
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  }
  const resources = manifest.resources.filter(item => item.saved && item.method === "GET");
  const byUrl = new Map(resources.map(item => [item.url, item]));
  for(const [from,to] of declaredResourceAliases(manifest))byUrl.set(from,byUrl.get(to));
  // Older captures tried to read HEAD bodies and marked these probes unsaved.
  const headByUrl = new Map(manifest.resources.filter(item => item.method === "HEAD" && item.status >= 200 && item.status < 300).map(item => [item.url, item]));
  const byRequest = new Map(manifest.resources.filter(item => item.saved && !['GET','HEAD'].includes(item.method))
    .map(item => [`${item.method} ${item.url} ${item.requestBodySha256 || ''}`, item]));
  return { root, manifestPath, manifest, resources, byUrl, headByUrl, byRequest };
}

function localResourceUrl(url) {
  // Module imports and import.meta.url resolve against this URL. Keep the
  // original directory instead of collapsing every file to /__resource.
  const source = new URL(url);
  return `${localOriginUrl(source.origin)}${source.pathname}${source.search}${source.hash}`;
}

function localOriginUrl(origin) {
  return `/__origin/${Buffer.from(origin).toString("base64url")}`;
}

function offlinePokiRuntime() {
  window.__archiveOfflinePoki = true;
  // Beacons upload telemetry, rather than fetch game assets. Keep standalone
  // replay local and truthfully report that remote uploads were not queued.
  const nativeBeacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = (url, data) => {
    try { if (new URL(url, location.href).origin !== location.origin) return false; }
    catch { return false; }
    return nativeBeacon(url, data);
  };
  window.PokiSDK = {
    init: () => Promise.resolve(),
    getURLParam: name => {
      const params = new URLSearchParams(location.search);
      return params.get(`gd${name}`) || params.get(name);
    },
    gameLoadingStart() {}, gameLoadingFinished() {}, gameLoadingProgress() {},
    gameplayStart() {}, gameplayStop() {}, setDebug() {},
    // Publisher UI and analytics have no offline destination. These calls must
    // remain available without changing the game's progress or physics.
    movePill() {}, measure() {}, customEvent() {}, happyTime() {},
    // An unavailable interstitial must release the original start/resume chain.
    // Rewarded ads remain unsuccessful; never manufacture an earned reward.
    commercialBreak: () => Promise.resolve(),
    rewardedBreak: () => Promise.resolve(false),
  };
}

function offlineCrazyGamesRuntime(namespace) {
  const prefix = 'h5-archive:crazygames:' + namespace + ':';
  window.__archiveOfflineCrazyGames = true;
  window.__archiveOfflineCrazyGamesEvents = [];
  const unavailable = () => { throw new Error('Advertisements are unavailable offline'); };
  const sdk = {
    init: () => Promise.resolve(), environment: 'local',
    game: {settings:{disableChat:new URLSearchParams(location.search).get('disableChat')==='true',muteAudio:new URLSearchParams(location.search).get('muteAudio')==='true'},inviteParams:{},addSettingsChangeListener() {},removeSettingsChangeListener() {},addJoinRoomListener() {},removeJoinRoomListener() {},gameplayStart() {}, gameplayStop() {}, loadingStart() {}, loadingStop() {}, happyTime() {}, happytime() {}, inviteLink: () => '', getInviteParam: () => null},
    user: {systemInfo: {browser:{name:'Chromium',version:''},os:{name:'',version:''},device:{type:/Mobi|Android/i.test(navigator.userAgent)?'mobile':'desktop'},locale:navigator.language || 'en-US',countryCode:'',applicationType:'web'}, getUser: () => Promise.resolve(null), isUserAccountAvailable: false, addAuthListener() {}, removeAuthListener() {}},
    data: {
      getItem(key) { const value=localStorage.getItem(prefix+key);if(value===null)return null;try{return JSON.parse(value);}catch{return value;} },
      setItem(key,value) { localStorage.setItem(prefix+key,JSON.stringify(value)); },
      removeItem(key) { localStorage.removeItem(prefix+key); },
      clear() { for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key); }
    },
    ad: {addAdblockPopupListener() {},removeAdblockPopupListener() {},hasAdblock: () => Promise.resolve(false), requestAd(type,callbacks={}) { window.__archiveOfflineCrazyGamesEvents.push({type,at:Date.now()});return new Promise(resolve=>setTimeout(()=>{callbacks.adError?.({reason:'offline',message:'Advertisements are unavailable offline'});resolve(false);},0)); }},
    banner: {requestBanner:unavailable,requestResponsiveBanner:unavailable,clearBanner() {},clearAllBanners() {}}
  };
  window.CrazyGames = {...window.CrazyGames, SDK:sdk};
}

function isCrazyGamesSdkUrl(value) {
  try {const url=new URL(value);return url.hostname==='sdk.crazygames.com' && /^\/crazygames-sdk-v[23]\.js$/i.test(url.pathname);}catch{return false;}
}

function isPokiSdkUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'game-cdn.poki.com' && /^\/scripts\//.test(url.pathname) &&
      /\/poki-sdk(?:-[\w.-]+)?\.js$/i.test(url.pathname);
  } catch { return false; }
}

function offlineYandexRuntime(appId) {
  if (window.YaGames) return;
  const storagePrefix = `h5-archive:${appId}:`;
  const player = {
    getMode: () => "lite", getName: () => "", getPhoto: () => "",
    getUniqueID: () => "", getPayingStatus: () => "unknown",
    getData: async keys => {
      // Native bridges may omit keys to load the full player save. Only this
      // app's namespace belongs in that response; an explicit [] stays empty.
      const requested = keys === undefined
        ? Object.keys(localStorage).filter(key => key.startsWith(storagePrefix)).map(key => key.slice(storagePrefix.length))
        : (keys || []);
      return Object.fromEntries(requested.flatMap(key => {
        const value = localStorage.getItem(storagePrefix + key);
        if (value === null) return [];
        try { return [[key, JSON.parse(value)]]; } catch { return [[key, value]]; }
      }));
    },
    setData: async data => {
      for (const [key, value] of Object.entries(data || {})) localStorage.setItem(storagePrefix + key, JSON.stringify(value));
    },
    getStats: async () => ({}),
    setStats: async () => {},
    incrementStats: async () => ({}),
  };
  const mobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const lang = navigator.language?.split("-")[0] || "en";
  const payments = {
    getCatalog: async () => [],
    getPurchases: async () => [],
    purchase: async () => { throw new Error("Payments are unavailable offline"); },
    consumePurchase: async () => {},
  };
  const leaderboards = {
    getLeaderboardPlayerEntry: async () => null, setLeaderboardScore: async () => {},
    getLeaderboardEntries: async () => ({ entries: [], userRank: 0 }),
    setScore: async () => {},
    getEntries: async () => ({ entries: [], userRank: 0 }),
    getLeaderboardDescription: async () => ({}),
  };
  // Games subscribe to platform pause/resume through the SDK event bus. Offline
  // there is no publisher frame, so the bus must still exist and accept
  // handlers; a missing `on` makes bridges throw and aborts the whole boot.
  const handlers = new Map();
  const on = (event, handler) => {
    if (typeof handler !== "function") return;
    const list = handlers.get(event) || [];
    list.push(handler);
    handlers.set(event, list);
  };
  const off = (event, handler) => {
    const list = handlers.get(event);
    if (!list) return;
    const index = handler ? list.indexOf(handler) : 0;
    if (index >= 0) list.splice(index, handler ? 1 : list.length);
  };
  const dispatchEvent = (event, detail) => {
    for (const handler of handlers.get(event) || []) { try { handler(detail); } catch {} }
  };
  const EVENTS = new Proxy({
    HISTORY_BACK: "HISTORY_BACK",
    EXIT: "EXIT",
  }, {
    get: (target, prop) => typeof prop === "string" ? (target[prop] || prop) : undefined
  });
  window.__archiveOfflineYandex = true;
  window.refreshBannerStatus = () => Promise.resolve(false);
  window.YaGames = {
    EVENTS,
    init: async () => ({
      on, off, once: on, dispatchEvent, onEvent: on,
      EVENTS,
      serverTime: () => Date.now(),
      isAvailableMethod: async () => false,
      adv: {
        getBannerAdvStatus: async () => ({ stickyAdvIsShowing: false, reason: "offline" }),
        showBannerAdv: async () => {}, hideBannerAdv: async () => {},
        // 真实插屏是「先 onOpen、后 onClose」的异步事件序列。同步回调会让依赖
        // 事件顺序的桥接扩展（GameMaker / Clickteam）把广告判定为未结束，
        // 于是一直停在启动加载画面上。
        showFullscreenAdv: ({ callbacks } = {}) => {
          // No fullscreen ad is displayed offline. Use the publisher's explicit failure branch when supplied.
          if(typeof callbacks?.onError==='function'){setTimeout(()=>callbacks.onError(new Error('Fullscreen advertising unavailable offline')),0);return;}
          setTimeout(() => { callbacks?.onOpen?.(); setTimeout(() => callbacks?.onClose?.(false), 0); }, 0);
        },
        showRewardedVideo: ({ callbacks } = {}) => {
          setTimeout(() => { callbacks?.onOpen?.(); setTimeout(() => callbacks?.onClose?.(), 0); }, 0);
        },
      },
      getStorage: async () => localStorage,
      getSafeStorage: async () => ({
        getItem: async k => localStorage.getItem(storagePrefix + k),
        setItem: async (k, v) => localStorage.setItem(storagePrefix + k, String(v)),
        removeItem: async k => localStorage.removeItem(storagePrefix + k),
      }),
      getPayments: async () => payments, getPlayer: async () => player,
      getFlags: async () => ({}), getLeaderboards: async () => leaderboards, leaderboards,
      clipboard: { writeText: async () => {} },
      environment: { i18n: { lang, tld: "local" }, app: { id: appId }, browser: { lang: navigator.language }, payload: "" },
      deviceInfo: { type: mobile ? "mobile" : "desktop", isMobile: () => mobile, isDesktop: () => !mobile, isTablet: () => false, isTV: () => false },
      screen: { fullscreen: { status: "off", request: async () => {} } },
      features: {
        LoadingAPI: { ready() {} },
        GameplayAPI: { start() {}, stop() {} },
        GamesAPI: { getAllGames: async () => ({ games: [], developerURL: "" }), getGameByID: async () => null },
        PluginEngineDataReporterAPI: { report() {} },
      },
      shortcut: { canShowPrompt: async () => ({ canShow: false }), showPrompt: async () => ({ outcome: "dismissed" }) },
      feedback: { canReview: async () => ({ value: false, reason: "offline" }), requestReview: async () => ({ feedbackSent: false }) },
      auth: { openAuthDialog: async () => { throw new Error("Authentication is unavailable offline"); } },
      openAuthDialog: async () => { throw new Error("Authentication is unavailable offline"); },
    })
  };
}

function offlineYandexShim(sourceUrl) {
  const appId = new URL(sourceUrl).hostname.match(/^app-(\d+)\./)?.[1] || "local";
  return `<script>(${offlineYandexRuntime.toString()})(${JSON.stringify(appId)});</script>`;
}

function workerUrlShim(origins) {
  return `<script>(()=>{if(typeof Worker==='undefined')return;const origins=${JSON.stringify(origins)};const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message,...rest){if(message&&typeof message.url==='string'){try{const u=new URL(message.url,location.href),base=origins[u.origin];if(base)message={...message,url:new URL(base+u.pathname+u.search+u.hash,location.href).href};}catch{}}return post.call(this,message,...rest);};})();</script>`;
}

// 国内门户/CP 页普遍在 <head> 里写 `document.domain = '7k7k.com'`（跨子域 iframe 通信用）。
// 回放跑在 127.0.0.1，父域不存在同源关系，原生 setter 会抛 SecurityError；而这段通常
// 是页面最外层的独立 <script>，异常会中断后续初始化，把「游戏能跑」误判成回放失败。
// 只吞掉这种「无法生效」的赋值：同源合法赋值仍按原生语义执行。
function domainRelaxShim() {
  return `<script>(()=>{try{const d=Object.getOwnPropertyDescriptor(Document.prototype,'domain');if(!d||typeof d.set!=='function')return;Object.defineProperty(Document.prototype,'domain',{configurable:true,enumerable:d.enumerable,get(){try{return d.get.call(this)}catch{return location.hostname}},set(value){try{d.set.call(this,value)}catch{}}});}catch{}})();</script>`;
}

function offlineYygShim() {
  // Interstitial completion resumes the native game. Reward callbacks retain
  // their original semantics; offline replay must not award skipped rewards.
  return `<script>(()=>{const timer=setInterval(()=>{const sdk=window.YYGGames;if(typeof sdk?.showInterstitial!=='function')return;sdk.showInterstitial=callback=>{if(typeof callback==='function')callback();};clearInterval(timer);},50);})();</script>`;
}

function runtimeUrlShim(archive, options = {}) {
  const origins = Object.fromEntries([...new Set(archive.resources.map(item => new URL(item.url).origin))]
    .map(origin => [origin, localOriginUrl(origin)]));
  const platform = domainRelaxShim() + (options.yandexFallback ? offlineYandexShim(options.sourceUrl) : "") + workerUrlShim(origins) + offlineYygShim();
  return `${platform}<script>(()=>{const origins=${JSON.stringify(origins)};const NativeURL=window.URL;function PatchedURL(url,base){try{return new NativeURL(url,base||location.href)}catch(e){return new NativeURL(url,location.origin)}};PatchedURL.prototype=NativeURL.prototype;Object.setPrototypeOf(PatchedURL,NativeURL);window.URL=PatchedURL;const map=value=>{try{const u=new URL(String(value),location.href);if(!/^https?:$/.test(u.protocol)||u.pathname.startsWith("/__origin/"))return value;const base=origins[u.origin];return base?base+u.pathname+u.search+u.hash:value}catch{return value}};const nativeFetch=window.fetch;window.fetch=(input,init)=>nativeFetch(typeof input==='string'?map(input):input,init);const nativeOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){return nativeOpen.call(this,method,map(url),...rest)};for(const [ctor,key] of [[HTMLScriptElement,'src'],[HTMLImageElement,'src'],[HTMLLinkElement,'href'],[HTMLIFrameElement,'src'],[HTMLSourceElement,'src']]){const d=Object.getOwnPropertyDescriptor(ctor.prototype,key);if(d?.set)Object.defineProperty(ctor.prototype,key,{...d,set(value){d.set.call(this,map(value))}})}const nativeSet=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){return nativeSet.call(this,name,/^(src|href)$/i.test(name)?map(value):value)};const dummyUi=()=>({visible:false,left:0,right:0,top:0,bottom:0,centerX:0,centerY:0,width:0,height:0,game1:{},game2:{},scale(){return this},removeSelf(){}});const preparePlatformUi=()=>{const sdk=window.YYGGames;if(!sdk)return;const moduleUi=window.module_forgames_LayaEngineGame;if(!sdk.gameBanner)sdk.gameBanner=moduleUi?.gameBanner||dummyUi();if(!sdk.gameBox)sdk.gameBox=moduleUi?.gameBox||dummyUi();if(!sdk.icon)sdk.icon=dummyUi()};const hidePlatformUi=()=>{preparePlatformUi();for(const name of ['gameBox','gameBanner','icon']){const item=window.YYGGames?.[name];if(item){item.visible=false;item.removeSelf?.()}}document.querySelectorAll('[class*="gamebox" i],[class*="game-banner" i],[id*="gamebox" i],[class*="recommend" i]').forEach(item=>item.remove());const sr=document.getElementById('splash-root');if(sr&&parseFloat(getComputedStyle(sr).opacity)<0.1){const g=document.getElementById('gui');if(g){g.style.display='none';g.style.pointerEvents='none';}sr.style.display='none';sr.style.pointerEvents='none';}};setInterval(hidePlatformUi,10)})();</script>`;
}

function rewriteKnownUrls(body, item, archive) {
  let text = body.toString("utf8");
  const source = new URL(item.url);
  for (const resource of archive.resources) {
    const local = localResourceUrl(resource.url);
    text = text.replaceAll(resource.url, local);
    const target = new URL(resource.url);
    if (target.origin === source.origin) {
      const rootReference = `${target.pathname}${target.search}`;
      for (const quote of ['"', "'", "`"]) {
        text = text.replaceAll(`${quote}${rootReference}${quote}`, `${quote}${local}${quote}`);
      }
      text = text.replaceAll(`url(${rootReference})`, `url(${local})`);
    }
  }
  const origins = [...new Set(archive.resources.map(resource => new URL(resource.url).origin))]
    .sort((a, b) => b.length - a.length);
  for (const origin of origins) {
    const local = localOriginUrl(origin);
    text = text.replaceAll(origin, local);
    // HTML parser-created src/href attributes do not invoke JS setter shims.
    // Protocol-relative URLs inherit HTTP locally, so rewrite them explicitly.
    const relative = origin.replace(/^https?:/, '');
    for (const quote of ['"', "'", '`', '(']) {
      text = text.replaceAll(`${quote}${relative}/`, `${quote}${local}/`);
    }
  }
  return Buffer.from(text);
}

async function serveItem(response, item, archive, options = {}) {
  try {
    let body = await readFile(path.join(archive.root, item.path));
    const isBinary = BINARY_EXTENSION.test(item.url) || BINARY_EXTENSION.test(item.path || "") || isBinaryBuffer(body);
    // SDK version maps validate the CDN host before accepting entries. Keep
    // these values intact; runtimeUrlShim routes their eventual requests locally.
    const sdkVersionMap = /\/(?:gameSDK|sdk)\/.*\/version\.json$/i.test(new URL(item.url).pathname);
    if (!isBinary && !sdkVersionMap && TEXT_TYPES.test(item.contentType || "")) body = rewriteKnownUrls(body, item, archive);
    if (/^text\/html/i.test(item.contentType || "")) {
      let text = body.toString("utf8");
      // Unity Yandex wrappers skip SDK init on localhost, yet their player
      // adapter dereferences player even for anonymous users. Keep the original
      // init chain and wait for its loader, using the explicit offline SDK.
      if (options.yandexFallback && /async function InitYSDK\(\)/.test(text) && /function StartUnityInstance_IfUnloaded\(\)/.test(text)) {
        text = text.replace(/if\s*\(LocalHost\(\)\)\s*return;/, "if (LocalHost() && !window.__archiveOfflineYandex) return;");
        text = text.replace(/if\s*\(LocalHost\(\)\)\s*StartUnityInstance_IfUnloaded\(\);/, "if (LocalHost() && !window.__archiveOfflineYandex) StartUnityInstance_IfUnloaded();");
        text = text.replace(/function StartUnityInstance_IfUnloaded\(\)\s*\{/, "$&\nif (typeof StartUnityInstance !== 'function') { setTimeout(StartUnityInstance_IfUnloaded, 20); return; }");
      }
      const shim = runtimeUrlShim(archive, { ...options, sourceUrl: item.url });
      body = Buffer.from(/<head[^>]*>/i.test(text) ? text.replace(/<head[^>]*>/i, match => `${match}${shim}`) : `${shim}${text}`);
    }
    const headers = {
      "content-type": item.contentType || "application/octet-stream",
      "content-length": body.length,
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    };
    if (/\.unityweb$/i.test(item.url || item.path || "")) {
      if (body.subarray(0, 64).includes(Buffer.from("UnityWeb Compressed Content (brotli)"))) {
        headers["content-encoding"] = "br";
      } else if (body.subarray(0, 64).includes(Buffer.from("UnityWeb Compressed Content (gzip)")) || (body[0] === 0x1f && body[1] === 0x8b)) {
        headers["content-encoding"] = "gzip";
      }
    } else if (/\.br$/i.test(item.url || item.path || "")) {
      const isRaw = (body[0] === 0x00 && body[1] === 0x61 && body[2] === 0x73 && body[3] === 0x6d) ||
                    body.subarray(0, 16).toString('utf8').includes('UnityWebData') ||
                    body.subarray(0, 32).toString('utf8').includes('unityFramework');
      if (!isRaw) {
        headers["content-encoding"] = "br";
      }
    } else if (/\.gz$/i.test(item.url || item.path || "")) {
      if (body[0] === 0x1f && body[1] === 0x8b) {
        headers["content-encoding"] = "gzip";
      }
    }
    response.writeHead(item.status >= 200 && item.status < 600 ? item.status : 200, headers);
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Archive read error: ${error.message}`);
  }
}

export async function createReplayServer(archiveRoot, options = {}) {
  const archive = await loadArchive(archiveRoot);
  const missingResources = [];
  const documents = archive.resources.filter(item =>
    (item.type === "document" || /^text\/html(?:;|$)/i.test(item.contentType || "")) &&
    item.saved && item.path && item.status >= 200 && item.status < 300
  );
  const directGameDocument = documents
    .filter(item => /html5\.gamedistribution\.com/i.test(item.url))
    .filter(item => /\/index\.html(?:\?|$)/i.test(item.url))
    .sort((a, b) => new URL(b.url).pathname.length - new URL(a.url).pathname.length)[0];
  const runtimeCoreFiles = new Set(archive.manifest?.runtimeInspection?.coreFiles || []);
  const coreResources = archive.resources.filter(item => item.saved && (CORE_BINARY_URL.test(item.url) || runtimeCoreFiles.has(item.path)));
  const coreBackedDocument = (await Promise.all(documents
    .map(async item => {
      const documentUrl = new URL(item.url);
      const directory = documentUrl.pathname.replace(/[^/]*$/, "");
      let docText = "";
      try { docText = (await readFile(path.join(archive.root, item.path))).toString("utf8"); } catch {}
      const matchingCore = coreResources.find(resource => {
        const resourceUrl = new URL(resource.url);
        if (resourceUrl.origin === documentUrl.origin && resourceUrl.pathname.startsWith(directory)) return true;
        const fileName = path.basename(resourceUrl.pathname);
        return docText && (docText.includes(fileName) || docText.includes(resource.url));
      });
      if (!matchingCore) return null;
      const indexBonus = /\/index\.html$/i.test(documentUrl.pathname) ? 10_000 : 0;
      return { item, score: indexBonus + directory.length };
    }))
  ).filter(Boolean)
   .sort((a, b) => b.score - a.score)[0]?.item;
  const preferredUrls = options.sitePage
    ? [archive.manifest.sourceUrl]
    : [coreBackedDocument?.url, directGameDocument?.url, archive.manifest.gameUrl, archive.manifest.finalUrl, archive.manifest.sourceUrl];
  const entry = preferredUrls
    .map(url => documents.find(item => item.url === url))
    .find(Boolean) || documents[0];
  if (!entry) throw new Error("Archive does not contain a saved document entry point");
  // The Yandex SDK is requested by the served game document itself, so the
  // offline stub must key off that document rather than the core-binary match.
  // Pure-JS engines (Clickteam etc.) legitimately expose no core binaries, and
  // losing the stub there makes their bootstrap throw "YaGames is not defined".
  const yandexDocument = coreBackedDocument || entry;
  const needsYandexFallback = Boolean(yandexDocument && archive.resources.some(resource => {
    const resourceUrl = new URL(resource.url);
    return resource.saved && resourceUrl.origin === new URL(yandexDocument.url).origin && resourceUrl.pathname === "/sdk.js";
  }));

  const pokiReplay = !options.sitePage && /(?:^|\.)(?:gdn\.poki\.com|poki-gdn\.com)$/i.test(new URL(entry.url).hostname);
  // CrazyGames' game frame decides whether it is embedded externally by checking
  // the referrer against "crazygames.com" plus the literal host "localhost".
  // Serving at 127.0.0.1 makes it take the embedding-disallowed branch, load an
  // unarchived error chunk and tear the game frame down.
  const crazyGamesReplay = !options.sitePage && (
    archive.manifest?.platform?.id === 'crazygames' ||
    /(?:^|\.)crazygames\.com$/i.test(new URL(entry.url).hostname)
  );

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://archive.local");
    let requestBodySha256 = '';
    if (!['GET','HEAD'].includes(request.method)) {
      const chunks = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024 * 1024) { response.writeHead(413).end('Replay request body exceeds 1 MiB'); return; }
        chunks.push(chunk);
      }
      if (size) requestBodySha256 = sha256(Buffer.concat(chunks));
    }
    const lookup = url => {
      // Replay only the response to this exact recorded request. Never borrow
      // another level's POST data or invent success for an unrecorded write.
      if (!['GET','HEAD'].includes(request.method)) return archive.byRequest.get(`${request.method} ${url} ${requestBodySha256}`);
      const exact = request.method === "HEAD"
        ? archive.headByUrl.get(url) || archive.byUrl.get(url)
        : archive.byUrl.get(url);
      if (exact) return exact;
      if (request.method === 'GET' && url) {
        const [base, query] = url.split('?');
        if (query && /^\d+$/.test(query) && /\/sdk\/adConfig\/ad_config\.json$/i.test(base)) {
          const cached = archive.byUrl.get(base);
          if (cached) return cached;
          // YYG adds the current date even when the payload was archived under
          // an earlier date. Reuse an unambiguous recorded payload for this
          // one known cachebuster; all other query variants remain exact.
          const candidates = archive.resources.filter(item => {
            const [capturedBase, capturedQuery] = item.url.split('?');
            return capturedBase === base && /^\d+$/.test(capturedQuery || '') && item.status >= 200 && item.status < 300;
          });
          if (candidates.length && new Set(candidates.map(item => item.sha256 || item.path)).size === 1) return candidates[0];
        }
      }
      if (url && url.includes('/res/packed/') && url.includes('/high/')) {
        const altUrl = url.replace('/high/', '/h1000webp/');
        const alt = archive.byUrl.get(altUrl);
        if (alt) return alt;
      }
      return undefined;
    };
    if (requestUrl.pathname === "/__archive_info") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ sourceUrl: archive.manifest.sourceUrl, resources: archive.resources.length, replayUrl, browserHostMapping: Boolean(archive.manifest.offlineReplay?.preserveHostname) }));
      return;
    }
    let item;
    if (requestUrl.pathname === "/__resource") {
      item = lookup(requestUrl.searchParams.get("url"));
    } else if (requestUrl.pathname.startsWith("/__origin/")) {
      const [, , token, ...remaining] = requestUrl.pathname.split("/");
      try {
        const origin = Buffer.from(token, "base64url").toString("utf8");
        const originalUrl = `${origin}/${remaining.join("/")}${requestUrl.search}`;
        item = lookup(originalUrl);
      } catch {
        item = undefined;
      }
    } else if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
      item = ['GET','HEAD'].includes(request.method) ? entry : lookup(entry.url);
    } else {
      const requestedPath = requestUrl.pathname + requestUrl.search;
      item = lookup(new URL(requestedPath, entry.url).href) ||
        lookup(new URL(requestedPath.replace(/^\//, ""), entry.url).href);
    }
    if (!item) {
      // GamePush / Eponesh 的在线状态心跳在线上就是 200 + 空响应体，抓取时也只
      // 记下状态而没有正文。离线回放照原样返回空 200，SDK 的初始化竞速会立刻
      // 结束；返回 404 会让它连等 4 轮 5 秒超时，启动加载画面一直不消失。
      const heartbeat = requestUrl.pathname.startsWith("/__origin/")
        ? (() => {
            try { return Buffer.from(requestUrl.pathname.split("/")[2], "base64url").toString("utf8"); } catch { return ""; }
          })()
        : "";
      const requested = `${heartbeat}${requestUrl.pathname.replace(/^\/__origin\/[^/]+/, "")}${requestUrl.search}`;
      if (/(?:^|\/\/)(?:[^/]*\.)?(?:gamepush|eponesh)\.com\/gs\/api\/status(?:[/?#]|$)/i.test(requested)) {
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "content-length": 0, "cache-control": "no-store", "access-control-allow-origin": "*" });
        response.end();
        return;
      }
      const originalUrl = heartbeat ? requested : new URL(requestUrl.pathname + requestUrl.search, entry.url).href;
      if (!missingResources.some(r => r.url === originalUrl && r.method === request.method)) {
        const missing = {url:originalUrl,method:request.method,status:404,saved:false,runtimeRequested:true,at:new Date().toISOString()};
        missingResources.push(missing);
        options.onMissingResource?.(missing);
      }
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Missing archived resource: ${request.url}`);
      return;
    }
    // Do not execute an archived publisher SDK after injecting its local
    // replacement: a later SDK load can restore network ads and banners.
    // Match only this game's SDK namespace, never other gameplay scripts.
    const source = new URL(item.url);
    if (needsYandexFallback && source.origin === new URL(yandexDocument.url).origin &&
        (source.pathname === '/sdk.js' || /^\/sdk\/_\/v[\w.-]+\.js$/i.test(source.pathname))) {
      const appId = new URL(yandexDocument.url).hostname.match(/^app-(\d+)\./)?.[1] || 'local';
      const body = Buffer.from(`(${offlineYandexRuntime.toString()})(${JSON.stringify(appId)});`);
      response.writeHead(200, {'content-type':'application/javascript','content-length':body.length,'cache-control':'no-store'});
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    if (isCrazyGamesSdkUrl(item.url)) {
      const body=Buffer.from('('+offlineCrazyGamesRuntime.toString()+')('+JSON.stringify(new URL(entry.url).origin)+');');
      response.writeHead(200, {'content-type':'application/javascript','content-length':body.length,'cache-control':'no-store'});
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    if (pokiReplay && isPokiSdkUrl(item.url)) {
      const body = Buffer.from(`(${offlinePokiRuntime.toString()})();`);
      response.writeHead(200, {'content-type':'application/javascript','content-length':body.length,'cache-control':'no-store'});
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    if (request.method === "HEAD") {
      response.writeHead(item.status || 200, { "content-type": item.contentType || "application/octet-stream" });
      response.end();
      return;
    }
    await serveItem(response, item, archive, {
      yandexFallback: needsYandexFallback && item === yandexDocument
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port || 0, options.host || "127.0.0.1", resolve);
  });
  const address = server.address();
  const entryLocation = new URL(entry.url);
  const entrySearch = entryLocation.search || "";
  // 入口的 #origin=…&app-id=… 片段是门户/广告 SDK 判断自己运行在哪个平台上的
  // 唯一依据。丢掉它，SDK 会退回默认平台去请求一个从未被归档过的平台分包
  // （如 platform.gp.<hash>.js），启动链断在缺块上，游戏停在加载画面。
  // 同一份文档常被同时记录成带/不带 hash 两条资源，这里回退到 manifest 的
  // gameUrl，保证片段不丢。
  const hashOf = value => { try { return new URL(value).hash || ""; } catch { return ""; } };
  const entryHash = entryLocation.hash || hashOf(archive.manifest?.gameUrl) || hashOf(archive.manifest?.finalUrl);
  // Poki's own publisher scripts explicitly allow localhost, and CrazyGames'
  // game frame only treats the literal host "localhost" as its own origin.
  // Preserve their bytes and use that supported hostname while retaining the
  // IPv4 binding.
  const mappedHost = archive.manifest.offlineReplay?.preserveHostname;
  if(mappedHost && mappedHost !== entryLocation.hostname)throw Error('Offline replay hostname must match archived entry');
  const publicHost = mappedHost || options.host || (pokiReplay || crazyGamesReplay ? 'localhost' : '127.0.0.1');
  const replayUrl = mappedHost ? `https://${mappedHost}${entryLocation.pathname}${entrySearch}${entryHash}` : `http://${publicHost}:${address.port}${entrySearch}${entryHash}`;
  return { server, url: replayUrl, archive, missingResources };
}

export async function replayArchive(options) {
  const replay = await createReplayServer(options.archive, options);
  console.log(`Offline replay: ${replay.url}`);
  console.log("Press Ctrl+C to stop.");
  return replay;
}





