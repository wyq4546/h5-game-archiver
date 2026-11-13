// Execute in the game frame: the SDK has already authenticated/decrypted its
// manifest. Keep original encrypted downloads; only export dependency metadata.
export async function readRuntimeAssetRegistry() {
  const impl = globalThis.YYGGames?.assetManager?.impl;
  const hasSdkRegistry = impl?.manifestReady && typeof impl.session?.manifestMetaJson === 'function';
  const version = globalThis.Laya?.ResourceVersion;
  const versionEntries = Object.entries(version?.manifest || {});
  if (versionEntries.length > 10000) throw new Error('Laya version registry exceeds 10000 entries');
  const urlAliases = {};
  for (const [name, target] of versionEntries) {
    if (typeof target !== 'string' || !target || name.length > 2048 || target.length > 2048) continue;
    urlAliases[name] = version.type === version.FILENAME_VERSION ? target : `${target}/${name}`;
  }
  const preloaded = Object.entries(globalThis.Laya?.Loader?.preLoadedMap || {});
  if (preloaded.length > 10000) throw new Error('Laya preloaded registry exceeds 10000 entries');
  const loaded=globalThis.Laya?.Loader?.loadedMap||{};
  const libraryDocuments=Object.entries(loaded).filter(([name,data])=>name.length<=2048&&Array.isArray(data?.res_lib)&&typeof data.root_url==='string'&&typeof data.base_url==='string');
  if (!hasSdkRegistry && !Object.keys(urlAliases).length && !preloaded.length && !libraryDocuments.length) return null;
  const meta = hasSdkRegistry ? JSON.parse(impl.session.manifestMetaJson()) : {};
  const resources = [], virtualPaths = new Set(Object.keys(meta.scripts || {})), failures = [];
  const baseUrl = new URL('.', location.href).href;
  const embeddedScenes = {};
  const dependencyDocuments = [];
  for (const [name, data] of preloaded) {
    if (name.length > 2048 || !data) continue;
    // Publishers leave editor templates under relative keys. The engine's
    // absolute preload for the same URL is the active published configuration.
    const canonical = new URL(name, baseUrl).href;
    if (name !== canonical && globalThis.Laya?.Loader?.preLoadedMap?.[canonical]) continue;
    virtualPaths.add(name);
    if (/\.scene(?:[?#]|$)/i.test(name) && data?.type && data?.props)
      embeddedScenes[name.replace(/\.scene(?=[?#]|$)/i, '.json')] = data;
    else if (/\.(?:json|lh|ls|lmat|atlas|ltc)(?:[?#]|$)/i.test(name) && typeof data === 'object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data))
      dependencyDocuments.push({name, data});
  }
  for (const url of impl?.sdkUrlVersions?.values() || []) {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) resources.push(url);
  }
  const entries = Object.entries(meta.versions || {});
  if (entries.length > 10000) throw new Error('SDK resource registry exceeds 10000 entries');
  const deadline = Date.now() + 45000;
  let next = 0;
  await Promise.all(Array.from({length: 4}, async () => {
    while (next < entries.length) {
      const [name, version] = entries[next++];
      const url = new URL(name, baseUrl);
      if (!url.href.startsWith(baseUrl)) continue;
      url.searchParams.set('v', String(version));
      resources.push(url.href);
      if (!/\.bin$/i.test(url.pathname)) continue;
      try {
        if (Date.now() >= deadline) throw new Error('Runtime registry inspection timed out');
        const response = await fetch(url.href, {signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now())))});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const assets = impl.decryptFiPackageOnMainThread(impl.session, bytes);
        for (const [key, data] of assets) {
          virtualPaths.add(key);
          if (/\.(?:json|lh|ls|lmat|atlas|ltc)$/i.test(key)) {
            const text = new TextDecoder().decode(data).trimStart();
            if (text.startsWith('{') || text.startsWith('['))
              dependencyDocuments.push({name: key, data: JSON.parse(text)});
          }
        }
      } catch (error) { failures.push({url: url.href, error: error.message}); }
    }
  }));
  const resourceLibraryRoots = [];
  for(const [name,data]of libraryDocuments)if(!dependencyDocuments.some(d=>new URL(d.name,baseUrl).href===new URL(name,baseUrl).href))dependencyDocuments.push({name,data});
  const loadedUrls=new Set(Object.keys(loaded).map(name=>{try{return new URL(name,baseUrl).href;}catch{return '';}}));
  for (const doc of dependencyDocuments) {
    const data = doc.data;
    if (!Array.isArray(data?.res_lib) || typeof data.root_url !== 'string' || typeof data.base_url !== 'string') continue;
    const declaredBase = new URL(data.root_url, new URL(data.base_url, baseUrl)).href;
    const publishedBase = new URL(data.root_url, baseUrl).href;
    if (declaredBase === publishedBase || !publishedBase.startsWith(baseUrl)) continue;
    const matchedUrls = [...new Set(data.res_lib.filter(lib => typeof lib.url === 'string' && lib.url)
      .map(lib => new URL([lib.sub_pack, lib.url].filter(Boolean).join('/'), publishedBase).href)
      .filter(url => loadedUrls.has(url)))].slice(0, 8);
    // Confirm the publication layout with multiple actual native cache entries;
    // a stale string alone never authorizes relocating a resource library.
    if (matchedUrls.length >= 2) resourceLibraryRoots.push({documentUrl:new URL(doc.name, baseUrl).href, declaredBase, baseUrl:publishedBase, matchedUrls});
  }
  return {baseUrl, resources, virtualPaths: [...virtualPaths], embeddedScenes, dependencyDocuments, resourceLibraryRoots, urlAliases, failures};
}

export async function collectRuntimeAssetRegistries(page, {gameUrl} = {}) {
  const registries = [];
  const game = gameUrl ? new URL(gameUrl) : null;
  const frames = page.frames().filter(frame => {
    if (frame.isDetached() || !/^https?:/i.test(frame.url())) return false;
    if (!game) return true;
    // Portal/ad frames have independent lifecycles and cannot own this game's
    // dependency manifest. Read the native game origin, including its children.
    for (let ancestor = frame; ancestor; ancestor = ancestor.parentFrame()) {
      try { if (new URL(ancestor.url()).origin === game.origin) return true; } catch {}
    }
    return false;
  });
  if (game && !frames.length) throw new Error(`Game frame unavailable for runtime resource inspection: ${game.origin}`);
  for (const frame of frames) {
    const registry = await frame.evaluate(readRuntimeAssetRegistry);
    if (registry) registries.push(registry);
  }
  return registries;
}
