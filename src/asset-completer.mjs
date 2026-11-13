import {configuredAssetTemplates, configuredAssetDependencies} from './configured-scenes.mjs';
import {boundedLevelDependencies} from './bounded-level-dependencies.mjs';
import {wrappedAudioDependencies} from './wrapped-audio-dependencies.mjs';
import {layaPublishedVariants} from './laya-published-variants.mjs';
import {declaredResourceAliases} from './resource-aliases.mjs';
import {parse} from '@babel/parser';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isNoiseUrl } from './noise-url.mjs';
import { resourcePath, sha256 } from './utils.mjs';
import { fairyguiAssets, layaSkeletonAssets, layaZipEntries, yygBinJsonEntries, yygBinScript, yygLegacyBundleManifest, deobfuscateJsStrings } from './fairygui-assets.mjs';
import { webpackChunkDependencies } from './webpack-assets.mjs';
import { openflBuildDependencies } from './openfl-assets.mjs';
import { serviceWorkerRegistrations, constructOfflineCacheDeclaration, classifyOfflineCacheRequests } from './offline-cache.mjs';
import { cocosBundleImports, cocosPackedNativeAssets, cocosStandaloneNativeAssets } from './cocos-assets.mjs';

export function declaredPrefabBaseLetters(text){
 if(!text.includes('selectProp')||!text.includes('substring'))return [];
 let ast;try{ast=parse(text,{sourceType:'unambiguous',errorRecovery:true});}catch{return [];}
 const nodes=[],pending=[ast.program];
 while(pending.length){const n=pending.pop();if(!n||typeof n!=='object')continue;nodes.push(n);for(const[k,v]of Object.entries(n))if(!['loc','start','end','extra','comments','errors'].includes(k)){if(Array.isArray(v))pending.push(...v);else if(v&&typeof v==='object')pending.push(v);}}
 const property=n=>n?.computed?n.property?.value:n?.property?.name;
 const letters=new Set();
 for(const d of nodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.init?.type==='ConditionalExpression')){
  if(!nodes.some(n=>n.type==='CallExpression'&&property(n.callee)==='selectProp'&&n.arguments[0]?.name===d.id.name))continue;
  const found=[];let branch=d.init,input=null,valid=true;
  while(branch.type==='ConditionalExpression'){
   const t=branch.test;let literal=t.left,call=t.right;if(literal?.type!=='StringLiteral')[literal,call]=[call,literal];
   if(!['==','==='].includes(t.operator)||literal?.type!=='StringLiteral'||!/^[a-z]$/i.test(literal.value)||call?.type!=='CallExpression'||property(call.callee)!=='substring'||call.callee.object.type!=='Identifier'||call.arguments.length!==2||call.arguments.map(a=>a.value).sort().join(',')!=='0,1'||branch.consequent.type!=='StringLiteral'||branch.consequent.value!==literal.value){valid=false;break;}
   if(input&&input!==call.callee.object.name){valid=false;break;}input=call.callee.object.name;found.push(literal.value);branch=branch.alternate;
  }
  if(valid&&branch.type==='Identifier'&&branch.name===input&&nodes.some(n=>n.type==='VariableDeclarator'&&n.id.name===input&&property(n.init)==='a'))for(const c of found)letters.add(c);
 }
 return [...letters];
}

const ASSET = /(?:^|\/)[^/.\s][^/\s]*\.(?:json|lani|lh|ls|lmat|lm|ltc|ltcb|png|jpe?g|webp|gif|svg|bin|sk|lav|atlas|fnt|ttf|woff2?|mp3|wav|ogg|aac|ktx|pvr|dds)(?:\?[^\s]*)?$/i;
const SCANNABLE = /\.(?:json|lh|ls|lmat|ltc|atlas|js|mjs|html?|php|bin|zip|sk)$/i;
const CONTAINER = /(?:app-manifest|fileconfig)\.json$|\.(?:zip|atlas|bin)$|\/raw-assets\/[^/.]+$/i;
const BINARY_EXT = /\.(?:bin|dat|wasm|data|unityweb|mem|pak|zip|png|jpe?g|gif|webp|ico|mp3|ogg|wav|aac|ttf|woff2?|lm|lani|sk|lav|ktx|pvr|dds)$/i;
const CORE_BINARY_EXT = /\.(?:bin|dat|wasm|data|unityweb|mem|pak|zip)(?:\.(?:gz|br))?(?:[?#]|$)/i;
const NON_CRITICAL_EXT = /\.(?:png|jpe?g|gif|webp|ico|svg|mp3|ogg|wav|m4a|aac|ttf|otf|woff2?)(?:[?#]|$)/i;

export function stripJsComments(code) {
  return code.replace(/('(?:[^'\\\r\n]|\\.)*'|"(?:[^"\\\r\n]|\\.)*"|`(?:\$\{[^}]*\}|[^`\\]|\\.)*`)|(\/{2}[^\r\n]*|\/\*[\s\S]*?\*\/)/g, (match, str) => {
    return str ? match : ' ';
  });
}

function decodePackedScript(script, {signal, timeoutMs}) {
  // The installed webcrack sandbox evaluates string decoders in isolation,
  // never the game's entry point. Use its own Node process and bounded output.
  return new Promise((resolve, reject) => {
    const program="import {decodeLegacyScaffold} from './src/legacy-string-scaffold.mjs';let input='';for await(const part of process.stdin)input+=part;const legacy=decodeLegacyScaffold(input);const result=legacy!==input?{code:legacy}:await (await import('webcrack')).webcrack(input,{unpack:false,jsx:false});process.stdout.write(result.code,()=>process.exit(0));";
    const child=spawn(process.execPath,['--no-node-snapshot','--input-type=module','-e',program],{
      cwd:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),windowsHide:true,stdio:['pipe','pipe','pipe'],signal
    });
    const chunks=[];let bytes=0,diagnostic='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Packed script string decoding timed out'));},timeoutMs);
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>16*1024*1024){child.kill();reject(new Error('Decoded script exceeds 16 MiB'));}else chunks.push(chunk);});
    child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk.toString()).slice(-4000);});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{clearTimeout(timer);if(code===0)resolve(Buffer.concat(chunks));else reject(new Error(`Packed script decoder failed: ${diagnostic.trim()||code}`));});
    child.stdin.on('error',()=>{});child.stdin.end(script);
  });
}

// Resolve only string literals and declared string concatenation. Never eval a publisher's HTML/JS.
function unityBuildDependencies(text) {
  text=stripJsComments(text.replace(/<!--[\s\S]*?(?:-->|$)/g, ' '));
  const strings = new Map();
  const literal = /^(?:"([^"\\]*)"|'([^'\\]*)')$/;
  const resolve = expression => {
    const parts = expression.trim().match(/"[^"\\]*"|'[^'\\]*'|[A-Za-z_$][\w$]*/g) || [];
    if (!parts.length || expression.replace(/"[^"\\]*"|'[^'\\]*'|[A-Za-z_$][\w$]*|\s|\+/g, '')) return null;
    const values = parts.map(part => { const match = part.match(literal); return match ? match[1] ?? match[2] : strings.get(part); });
    return values.some(value => value === undefined) ? null : values.join('');
  };
  const declarations = [...text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\r\n]+);/g)];
  for (let pass = 0; pass < 2; pass++) for (const [, name, expression] of declarations) {
    const value = resolve(expression);
    if (value !== null) strings.set(name, value);
  }
  const requiredUrls = new Set(), candidateUrls = new Set(), frameworkUrls = new Set(), codeUrls = new Set();
  // Unity 5.6/2017 的构建清单用的是 wasmCodeUrl / wasmFrameworkUrl（更早的 asm 变体还叫
  // asmCodeUrl / asmFrameworkUrl），只有 2018+ 才统一成 codeUrl / frameworkUrl。
  // 漏认这组键会让框架文件里的 Emscripten 兜底名 build.wasm 被当成「必须下载」的资源：
  // 线上并不存在该路径，取回的是站点 HTML，最终把一份完整归档误判成补全失败。
  for (const match of text.matchAll(/\b(loaderUrl|dataUrl|frameworkUrl|codeUrl|memoryUrl|wasmCodeUrl|wasmFrameworkUrl|asmCodeUrl|asmMemoryUrl|asmFrameworkUrl|streamingAssetsUrl)["']?\s*[:=]\s*([^,;\r\n}]+)/g)) {
    const value = resolve(match[2]);
    if (value && /\.(?:js|wasm|data|mem|unityweb)(?:\.(?:gz|br))?(?:[?#]|$)/i.test(value)) {
      requiredUrls.add(value);
      if (['frameworkUrl', 'wasmFrameworkUrl', 'asmFrameworkUrl'].includes(match[1])) frameworkUrls.add(value);
      if (['codeUrl', 'wasmCodeUrl', 'asmCodeUrl'].includes(match[1])) codeUrls.add(value);
    }
    else if (value && match[1] === 'streamingAssetsUrl') {
      const trimmed = value.replace(/\/+$/, '');
      candidateUrls.add(trimmed + '/aa/settings.json');
      candidateUrls.add(trimmed + '/aa/catalog.json');
    }
  }
  return { requiredUrls, candidateUrls, frameworkUrls: codeUrls.size ? frameworkUrls : new Set(), codeUrls };
}

function emscriptenBuildDependencies(text) {
  const urls = new Set(), virtualPaths = [];
  if (!/\b(?:loadPackage|findWasmBinary|wasmBinaryFile)\b/.test(text)) return {urls, virtualPaths};
  for (const match of text.matchAll(/\b(?:REMOTE_PACKAGE_BASE|wasmBinaryFile)\s*=\s*["']([^"'\\\r\n]+)["']/g)) {
    if (/\.(?:wasm|data)(?:\.(?:gz|br))?(?:[?#]|$)/i.test(match[1])) urls.add(match[1]);
  }
  const finder = text.match(/function\s+findWasmBinary\s*\([^)]*\)\s*\{([^}]{0,2000})/);
  for (const match of (finder?.[1] || '').matchAll(/["']([^"'\\\r\n]+\.wasm(?:\.(?:gz|br))?(?:\?[^"'\\\r\n]*)?)["']/g)) urls.add(match[1]);
  // The file packager embeds a JSON offset table. These filenames live in the
  // downloaded .data package, not at independent HTTP endpoints.
  for (const match of text.matchAll(/\bloadPackage\s*\(\s*(\{[\s\S]*?\})\s*\)/g)) {
    try {
      const metadata = JSON.parse(match[1]);
      if (!Number.isInteger(metadata.remote_package_size) || metadata.remote_package_size < 0 || !Array.isArray(metadata.files)) continue;
      for (const file of metadata.files) {
        if (typeof file.filename === 'string' && Number.isInteger(file.start) && Number.isInteger(file.end) &&
            file.start >= 0 && file.end >= file.start && file.end <= metadata.remote_package_size) virtualPaths.push(file.filename);
      }
    } catch { /* Dynamic declarations cannot be resolved without executing code. */ }
  }
  return {urls, virtualPaths};
}

function inferResourceType(urlStr, contentType = '', fallback = 'fetch') {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    if (/\.(?:png|jpe?g|gif|webp|svg|ico)(?:$|\?)/i.test(pathname) || /^image\//i.test(contentType)) return 'image';
    if (/\.(?:mp3|wav|ogg|aac|m4a|mp4|webm)(?:$|\?)/i.test(pathname) || /^(?:audio|video)\//i.test(contentType)) return 'media';
    if (/\.(?:ttf|otf|woff2?|eot)(?:$|\?)/i.test(pathname) || /^font\//i.test(contentType)) return 'font';
    if (/\.(?:css)(?:$|\?)/i.test(pathname) || /text\/css/i.test(contentType)) return 'stylesheet';
    if (/\.(?:js|mjs)(?:$|\?)/i.test(pathname) || /javascript/i.test(contentType)) return 'script';
    if (/\.(?:html?)(?:$|\?)/i.test(pathname) || /text\/html/i.test(contentType)) return 'document';
  } catch {}
  return fallback;
}

function valid(value) {
  return typeof value === 'string' && value.length < 2048 && ASSET.test(value.replaceAll(' ', '%20')) && !/[{}<>`\r\n]/.test(value) && !isNoiseUrl(value);
}

// Infer only literal modulo bounds and direct URL concatenation. Never execute
// downloaded code or enumerate an unbounded level counter.
function numberedThemeDependencies(text) {
  const urls = new Set();
  const declarations = /\b(?:let|var|const)\s+([\w$]+)\s*=\s*[^;,\r\n]{1,240}?\s*%\s*(0x[\da-f]+|\d+)(?=\s*[,;\r\n])/gi;
  for (const match of text.matchAll(declarations)) {
    const limit = Number(match[2]);
    if (!Number.isInteger(limit) || limit < 1 || limit > 32) continue;
    const name = match[1].replace(/[^a-zA-Z0-9_]/g, '\\$&');
    const fallback = new RegExp('\\b' + name + '\\s*=\\s*(?:0x0|0)\\s*!=\\s*' + name + '\\s*\\?\\s*' + name + '\\s*:\\s*(0x[\\da-f]+|\\d+)\\b', 'i');
    const oneBased = Number(text.slice(match.index + match[0].length, match.index + match[0].length + 256).match(fallback)?.[1]) === limit;
    const template = new RegExp('["\\\']([^"\\\'\\r\\n]+)["\\\']\\s*\\+\\s*' + name + '\\s*\\+\\s*["\\\'](\\.[a-z0-9]+)["\\\']', 'gi');
    for (const ref of text.matchAll(template)) {
      for (let value = oneBased ? 1 : 0; value < limit + (oneBased ? 1 : 0); value++) {
        const url = ref[1] + value + ref[2];
        if (valid(url)) urls.add(url);
      }
    }
  }
  return urls;
}

/** Follow declared dependencies using original URLs, never disk basenames. */
export async function completeArchiveAssets(captureRoot, manifest, options = {}) {
  const emit = options.emit || ((level, message) => console.log(`[${level.toUpperCase()}] ${message}`));
  const concurrency = Math.max(1, Math.min(16, options.concurrency || 8));
  const maxAssets = options.maxAssets ?? 10000;
  const deadline = Date.now() + (options.maxDurationMs ?? 300000);
  const base = new URL('.', manifest.gameUrl || manifest.finalUrl || manifest.sourceUrl);
  const records = new Map(manifest.resources.filter(r => !r.method || r.method === 'GET').map(r => [r.url, r]));
  const queue = [], seen = new Set(), failures = [], scanFailures = [], unresolvedCandidates = [];
  const required = new Set(), atlasFrames = new Set();
  const unityFrameworksWithCode = new Set();
  // Unity 5/2017 把 Emscripten 的默认文件名（build.wast / build.wasm / build.asm.js）
  // 留在 inlined 框架里，真正的构建产物由构建清单的 wasmCodeUrl 指定。只要这份归档
  // 自己声明过 WASM 代码文件，这些默认名就一定是永不使用的兜底，不能当成必需资源。
  const unityDeclaredWasm = new Set();
  const playcanvasFallbackScripts = new Set();
  const withoutQuery = value => { const u = new URL(value); u.search = ""; u.hash = ""; return u.href; };
  const isEmscriptenDefaultName = value => {
    if (!unityDeclaredWasm.size) return false;
    try {
      return /^(?:build|unity)\.(?:wasm|wast|asm\.js|temp\.asm\.js)(?:\.(?:gz|br))?$/.test(new URL(value).pathname.split('/').pop().toLowerCase());
    } catch { return false; }
  };
  const runtimeRequested = record => !!record && (record.runtimeRequested === true || record.recoveredBy !== 'asset-completer');
  const urlAliases = declaredResourceAliases(manifest);
  for(const [from,to] of urlAliases){const previous=records.get(from);update(from,{...previous,ignored:true,ignoredReason:manifest.offlineResourceAliases?.some(a=>a.from===from)?'User-approved offline compatibility fallback; original file remains absent':'Published Laya filename has trailing editor whitespace',mappedTo:to});}
  const libraryRoots = new Map();
  const decodedScripts = new Map();
  const configuredTemplates = new Map(), scannedConfigs = new Map();
  const completeConfiguredAssets = () => {for(const [u,data] of scannedConfigs)for(const ref of configuredAssetDependencies(data,[...configuredTemplates.values()]))enqueue(ref,base,false);};
  const guiPackages = new Map();
  const cocosPackDeclarations = new Map(), cocosSeenPacks = new Map();
  const prefabNames = new Set(), prefabAliases = new Set(), prefabPrefixes = new Set(), prefabBaseLetters = new Set();
  const handIds = new Set(), handPrefixes = new Set(), handIconPrefixes=new Set(), prefabVariants=new Map();
  const enqueueScenePrefabs = () => {
    for (const prefix of prefabPrefixes) for (const name of [...prefabNames].flatMap(n=>[n,...(prefabVariants.get(n)||[])])) {
      const normalized=prefabBaseLetters.has(name[0])?name[0]:name;
      if(normalized!==name){const original=new URL(prefix+name+'.lh',base).href,previous=records.get(original);if(previous&&!previous.saved&&previous.recoveredBy==='asset-completer'&&!runtimeRequested(previous))update(original,{...previous,ignored:true,ignoredReason:'Native selectProp normalizes node name to declared base letter',mappedTo:new URL(prefix+normalized+'.lh',base).href});}
      enqueue(prefix + normalized + '.lh', base);
    }
    for (const prefix of prefabPrefixes) for (const name of prefabAliases) enqueue(prefix + name + '.lh', base, false);
    for (const prefix of handPrefixes) for (const id of handIds) enqueue(prefix + 'hand' + id + '.lh', base);
    for (const prefix of handIconPrefixes) for (const id of handIds) enqueue(prefix + id + '.png', base, false);
  };
  const guiPathPattern = /["']((?:(?:res\/)?(?:atlas\/)?fgui(?:_[A-Za-z0-9_-]+)?|loading)\/[A-Za-z0-9_-]+)(?:\/[^"'\r\n]*)?["']/g;
  function registerGuiPaths(text) {
    for (const match of text.matchAll(guiPathPattern)) {
      const url = new URL(match[1] + '.bin', base).href;
      const name = path.posix.basename(match[1]) + '.bin';
      if (!guiPackages.has(name)) guiPackages.set(name, new Set());
      guiPackages.get(name).add(url);
    }
  }
  for (const record of records.values()) {
    if (record.saved && (record.status === undefined || (record.status >= 200 && record.status < 300))) {
      try {
        const u = new URL(record.url);
        if (/\.bin$/i.test(u.pathname)) {
          const name = path.posix.basename(u.pathname);
          if (!guiPackages.has(name)) guiPackages.set(name, new Set());
          guiPackages.get(name).add(record.url);
        }
      } catch {}
    }
  }
  let scannedFiles = 0, fetchedAssets = 0, limitReached = false, missingCandidates = 0, lastReported = 0;
  function enqueue(raw, parent = base, declared = true) {
    let url; try { url = new URL(raw, parent); } catch { return; }
    if (!/^https?:$/.test(url.protocol) || isNoiseUrl(url.href)) return;
    url.hash = '';
    // Scene/material bodies retain editor filenames. Resolve the native engine's
    // version map before testing package paths or making a physical request.
    if (urlAliases.has(url.href)) url = new URL(urlAliases.get(url.href));
    if (atlasFrames.has(url.href)) return;
    const existing = records.get(url.href);
    if (existing?.ignored && !declared) return;
    const wasRuntimeRequested = runtimeRequested(existing);
    if (declared || wasRuntimeRequested) required.add(url.href);
    if (seen.has(url.href)) return;
    if (seen.size >= maxAssets) { limitReached = true; return; }
    seen.add(url.href);
    if (CONTAINER.test(url.pathname)) queue.unshift(url.href);
    else if (SCANNABLE.test(url.pathname)) {
      const idx = queue.findIndex(u => !CONTAINER.test(new URL(u).pathname));
      queue.splice(idx >= 0 ? idx : queue.length, 0, url.href);
    } else queue.push(url.href);
  }
  function update(url, record) {
    const previous = records.get(url);
    if (previous) manifest.resources[manifest.resources.indexOf(previous)] = record;
    else manifest.resources.push(record);
    records.set(url, record);
  }
  function registerVirtualPath(name, parent = base) {
    const url = new URL(name.replaceAll('\\', '/'), parent).href;
    atlasFrames.add(url);
    const previous = records.get(url);
    if (previous && !previous.saved && previous.recoveredBy === 'asset-completer')
      update(url, {...previous, ignored: true, ignoredReason: 'Declared SDK package-internal asset'});
  }
  // Register all frames' aliases before scanning any dependency documents.
  for (const registry of manifest.runtimeAssetRegistries || []) {
    for (const root of registry.resourceLibraryRoots || []) {
      try {
        const published = new URL(root.baseUrl, registry.baseUrl), declared = new URL(root.declaredBase);
        const matches = [...new Set(root.matchedUrls || [])].filter(url => typeof url === 'string' && url.startsWith(published.href));
        if (!published.href.startsWith(registry.baseUrl) || !/^https?:$/.test(declared.protocol) || matches.length < 2) continue;
        libraryRoots.set(new URL(root.documentUrl, registry.baseUrl).href, {published, declared});
      } catch { /* Incomplete root evidence leaves the declared URL unchanged. */ }
    }
    for (const [name, target] of Object.entries(registry.urlAliases || {})) {
      if (typeof target !== 'string') continue;
      const source = new URL(name, registry.baseUrl), resolved = new URL(target, registry.baseUrl);
      source.hash = ''; resolved.hash = '';
      if (!/^https?:$/.test(resolved.protocol) || isNoiseUrl(resolved.href) || source.href === resolved.href) continue;
      urlAliases.set(source.href, resolved.href);
    }
  }
  for (const [source, target] of urlAliases) {
    const previous = records.get(source);
    if (previous && !previous.saved && previous.recoveredBy === 'asset-completer') {
      update(source, {...previous, ignored: true, ignoredReason: 'Native Laya resource version alias', mappedTo: target});
      enqueue(source);
    }
  }
  for (const record of records.values()) {
    if (!record.saved && record.recoveredBy === 'asset-completer' && record.error === 'Expected game asset, received HTML') {
      try {
        const htmlUrl = new URL(record.url);
        if (/\.php$/i.test(htmlUrl.pathname)) htmlUrl.pathname = htmlUrl.pathname.replace(/\.php$/i, '.html');
        let targetRecord = records.get(htmlUrl.href);
        if (!targetRecord) {
          htmlUrl.search = '';
          targetRecord = records.get(htmlUrl.href);
        }
        if (!targetRecord) {
          targetRecord = [...records.values()].find(r => r.saved && new URL(r.url).pathname === htmlUrl.pathname);
        }
        if (targetRecord?.saved) {
          const repaired = {
            ...record,
            status: 302,
            saved: true,
            bytes: 0,
            recoveredBy: 'redirect-repair',
            redirectURL: targetRecord.url
          };
          delete repaired.error;
          delete repaired.ignored;
          update(record.url, repaired);
        }
      } catch {}
    }
  }
  for (const record of records.values()) {
    if (!record.saved && record.recoveredBy === 'asset-completer' && !runtimeRequested(record) && /\/StreamingAssets\/aa\/(?:catalog|settings)\.json$/i.test(new URL(record.url).pathname)) {
      update(record.url, {
        ...record,
        ignored: true,
        ignoredReason: 'Optional Unity Addressables candidate not used by game'
      });
    }
  }
  for (const registry of manifest.runtimeAssetRegistries || []) {
    for (const [name, data] of Object.entries(registry.embeddedScenes || {})) {
      const url = new URL(name, registry.baseUrl).href;
      const previous = records.get(url);
      if (previous?.saved && previous.status < 400) continue;
      const body = Buffer.from(JSON.stringify(data));
      const file = resourcePath(captureRoot, url, 'application/json', '', 'game');
      await mkdir(path.dirname(file), {recursive: true});
      await writeFile(file, body);
      update(url, {url, method: 'GET', status: 200, type: 'fetch', contentType: 'application/json', saved: true,
        path: path.relative(captureRoot, file).replaceAll('\\', '/'), bytes: body.length, sha256: sha256(body), recoveredBy: 'runtime-embedded-scene'});
    }
    for (const name of registry.virtualPaths || []) {
      const url = new URL(name, registry.baseUrl).href;
      atlasFrames.add(url);
      // FairyGUI atlas names identify the package even when the UI bootstrap
      // script is encrypted and cannot be scanned as JavaScript.
      const guiAtlas = name.match(/^((?:res\/atlas\/fgui[^/]*|loading)\/[^/]+)_atlas\d[^/]*\.(?:png|jpg)$/i);
      if (guiAtlas) {
        registerGuiPaths(JSON.stringify(guiAtlas[1]));
        enqueue(guiAtlas[1] + '.bin', registry.baseUrl, false);
      }
      const previous = records.get(url);
      if (previous && !previous.saved && previous.recoveredBy === 'asset-completer') {
        update(url, {...previous, ignored: true, ignoredReason: 'SDK package-internal asset'});
      }
    }
    for (const url of registry.resources || []) enqueue(url);
    for (const failure of registry.failures || []) scanFailures.push(failure);
  }
  function dependency(raw, parent, declared = true) {
    if (!valid(raw)) return;
    // Laya mutates preloaded prefab references to game-root paths when parsing
    // them. The native registry proves these paths; do not append them twice.
    const rootUrl = new URL(raw, base).href;
    const capturedRootPath = raw.includes('/') && records.get(rootUrl)?.saved;
    enqueue(raw, raw.startsWith('res/') || atlasFrames.has(rootUrl) || urlAliases.has(rootUrl) || capturedRootPath ? base : parent, declared);
  }
  function walk(value, parent) {
    if (typeof value === 'string') dependency(value.trim(), parent);
    else if (value && typeof value === 'object') for (const child of Object.values(value)) walk(child, parent);
  }
  function isLaya2DData(val) {
    if (!val || typeof val !== 'object') return false;
    if (['Scene','View','Dialog','Sprite','Box','Image','Panel','Widget','List','Tab','RadioGroup','Clip'].includes(val.type)) return true;
    if (val.child && (val.props || val.compId !== undefined || val.loadList)) return true;
    return false;
  }
  function isLayaFileConfig(val) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
    const values = Object.values(val);
    return values.length > 0 && values.every(v => Array.isArray(v) && typeof v[0] === 'string' && Array.isArray(v[1]));
  }
  function scanJsonData(data, url) {
    if(/\/res\/config\/[^/]+\.json(?:[?#]|$)/i.test(url)){scannedConfigs.set(url,data);completeConfiguredAssets();}
    if (!data || typeof data !== 'object') return;
    // Lazy Cocos prefabs share one compressed import pack. Their native UUID
    // textures/audio are declared in the bundle's version table, not URL strings.
    for (const item of cocosBundleImports(data, url)) {
      const declaration = {config: data, configUrl: url, packId: item.id};
      cocosPackDeclarations.set(item.url, declaration);
      enqueue(item.url, url, true);
      const seen = cocosSeenPacks.get(item.url);
      if (seen) for (const dependency of [...cocosPackedNativeAssets(data, item.id, seen, url), ...cocosStandaloneNativeAssets(data, item.id, seen, url)]) enqueue(dependency, url, true);
    }
    if (Array.isArray(data) && data[0] === 1 && Array.isArray(data[5]) && /\/import\//.test(new URL(url).pathname)) {
      cocosSeenPacks.set(url, data);
      const declaration = cocosPackDeclarations.get(url);
      if (declaration) for (const dependency of [...cocosPackedNativeAssets(declaration.config, declaration.packId, data, declaration.configUrl), ...cocosStandaloneNativeAssets(declaration.config, declaration.packId, data, declaration.configUrl)]) enqueue(dependency, url, true);
    }
    // This Laya export stores audio basenames separately from the loader path.
    if (/\/res\/config\/AudioConfig\.json(?:[?#]|$)/i.test(url) && data && typeof data === 'object') {
      for (const item of Object.values(data)) {
        if (typeof item?.audio_path === 'string' && /^[A-Za-z0-9_-]+$/.test(item.audio_path) && Number.isInteger(item.audio_type))
          enqueue(new URL('../audio/' + item.audio_path + '.mp3', url).href, url, true);
      }
    }
    // PlayCanvas derives the cache query and additional font pages from the
    // registry, so walking URL strings alone misses the actual loader requests.
    if (data.assets && !Array.isArray(data.assets) && typeof data.assets === 'object' &&
        Object.values(data.assets).some(asset => asset?.type && asset?.file?.url)) {
      // PlayCanvas selects this script only as the non-WASM fallback. Its
      // embedded Emscripten filename is not the registry-selected WASM URL.
      for (const module of Object.values(data.assets)) {
        const fallback = data.assets[module?.data?.fallbackScriptId];
        const glue = data.assets[module?.data?.glueScriptId];
        if (module.type === 'wasm' && module.file?.url && glue?.file?.url && fallback?.file?.url) {
          playcanvasFallbackScripts.add(withoutQuery(new URL(fallback.file.url, url).href));
          enqueue(new URL(module.file.url, url).href, url, true);
          enqueue(new URL(glue.file.url, url).href, url, true);
        }
      }
      for (const asset of Object.values(data.assets)) {
        const file = asset?.file;
        if (file?.url) {
          // Published PlayCanvas exports relocate the custom loading script.
          // Only use the captured same-build export when registry metadata agrees.
          if (asset.type === 'script' && asset.data?.loading === true) {
            const publishedUrl = new URL('__loading__.js', url).href;
            const published = records.get(publishedUrl);
            if (published?.saved && published.bytes === file.size && file.size > 0) {
              const staleUrl = new URL(file.url, url);
              if (file.hash) staleUrl.searchParams.set('t', file.hash);
              const previous = records.get(staleUrl.href);
              if (previous && !previous.saved && !runtimeRequested(previous))
                update(staleUrl.href, {...previous, ignored:true, ignoredReason:'PlayCanvas loading script published as __loading__.js', mappedTo:publishedUrl});
              continue;
            }
          }
          const target = new URL(file.url, url);
          if (file.hash) target.searchParams.set('t', file.hash);
          enqueue(target.href, url);
          if (asset.type === 'font' && Array.isArray(asset.data?.info?.maps)) {
            for (let page = 1; page < asset.data.info.maps.length; page++) {
              const next = new URL(target);
              next.pathname = next.pathname.replace(/\.png$/i, `${page}.png`);
              dependency(next.href, url);
            }
          }
          for (const variant of Object.values(file.variants || {})) {
            if (!variant?.url) continue;
            const variantUrl = new URL(variant.url, url);
            if (variant.hash) variantUrl.searchParams.set('t', variant.hash);
            enqueue(variantUrl.href, url);
          }
        }
        walk(asset?.data, url);
      }
      for (const [key, value] of Object.entries(data)) if (key !== 'assets') walk(value, url);
      return;
    }
    if (/\/hand\.json(?:[?#]|$)/i.test(url) && Array.isArray(data))
      for (const item of data) if (Number.isSafeInteger(item?.id) && item.id > 0) handIds.add(item.id);
    // Laya level tables name prefabs separately from the loader's URL template.
    // Keep both halves so package scan ordering cannot omit later-level assets.
    for (const item of Array.isArray(data) ? data : [data]) {
      if (!Array.isArray(item?.nodeData)) continue;
      for (const node of item.nodeData) if (typeof node.a === 'string' && /^[A-Za-z0-9_-]+$/.test(node.a)) prefabNames.add(node.a);
    }
    enqueueScenePrefabs();
    if (Array.isArray(data.res_lib) && typeof data.root_url !== 'string') {
      // Legacy registries store a package name and a basename, not a URL
      // relative to db/res.json. Confirm the local layout using the SDK registry.
      for (const lib of data.res_lib) if (lib.id && typeof lib.url === 'string' && lib.url) {
        const target = new URL(['res', lib.sub_pack, lib.url].filter(Boolean).join('/'), base).href;
        if (atlasFrames.has(target)) {
          const legacy = new URL(lib.url, url).href, previous = records.get(legacy);
          if (previous && !previous.saved && previous.recoveredBy === 'asset-completer')
            update(legacy, {...previous, ignored: true, ignoredReason: 'Registry basename resolved to SDK package path'});
        } else enqueue(target, base, false);
      }
    } else if (Array.isArray(data.res_lib) && typeof data.root_url === 'string') {
      const declaredBase = new URL(data.root_url, new URL(data.base_url || '.', base));
      const native = libraryRoots.get(new URL(url, base).href);
      const resourceBase = native?.declared.href === declaredBase.href ? native.published : declaredBase;
      for (const lib of data.res_lib) if (lib.id && typeof lib.url === 'string' && lib.url) {
        const name = [lib.sub_pack, lib.url].filter(Boolean).join('/');
        if (resourceBase.href !== declaredBase.href) {
          const stale = new URL(name, declaredBase).href, previous = records.get(stale);
          if (previous && !previous.saved && previous.recoveredBy === 'asset-completer' && !runtimeRequested(previous))
            update(stale, {...previous, ignored:true, ignoredReason:'Native cached resource library uses the published game root', mappedTo:new URL(name, resourceBase).href});
        }
        enqueue(name, resourceBase);
      }
    } else if (data.raw && typeof data.raw === 'object' && !Array.isArray(data.raw) && (data.fis || data.json)) {
      for (const [k, v] of Object.entries(data.raw)) {
        const cleanK = k.replaceAll('\\', '/');
        atlasFrames.add(new URL(cleanK, base).href);
        atlasFrames.add(new URL(path.posix.basename(cleanK), base).href);
        if (typeof v === 'string') enqueue(v, base, true);
      }
      for (const item of Object.values(data.fis || {}).flat()) if (typeof item === 'string') enqueue(item, base, true);
      for (const item of Object.values(data.json || {}).flat()) if (typeof item === 'string') enqueue(item, base, true);
    } else if (isLayaFileConfig(data)) {
      for (const [atlasPath, entry] of Object.entries(data)) {
        if (valid(atlasPath)) enqueue(atlasPath, base, true);
        const [prefix, files] = entry;
        if (Array.isArray(files)) {
          for (const f of files) {
            if (typeof f === 'string') {
              const cleanF = f.replaceAll('\\', '/');
              const fullF = (prefix || '') + cleanF;
              atlasFrames.add(new URL(fullF, base).href);
              atlasFrames.add(new URL(cleanF, base).href);
              if (url) atlasFrames.add(new URL(cleanF, url).href);
            }
          }
        }
      }
    } else if (data.json && typeof data.json === 'object' && !Array.isArray(data.json)) {
      const entries = Object.entries(data.json);
      for (const [k] of entries) { const n = k.replaceAll('\\', '/'); if (valid(n)) atlasFrames.add(new URL(n, base).href); }
      for (const [k, v] of entries) { const n = k.replaceAll('\\', '/'); walk(v, valid(n) ? new URL(n, base) : url); }
    } else {
      if (Array.isArray(data.m_InternalIds)) {
        const catalogDir = new URL('.', url);
        for (const id of data.m_InternalIds) {
          if (typeof id === 'string' && (id.includes('.bundle') || id.includes('.json'))) {
            const resolved = id.replace('{UnityEngine.AddressableAssets.Addressables.RuntimePath}', '.');
            enqueue(resolved, catalogDir, true);
          }
        }
      }
      if (Array.isArray(data.m_CatalogLocations)) {
        const settingsDir = new URL('.', url);
        for (const loc of data.m_CatalogLocations) {
          if (typeof loc?.m_InternalId === 'string') {
            const resolved = loc.m_InternalId.replace('{UnityEngine.AddressableAssets.Addressables.RuntimePath}', '.');
            enqueue(resolved, settingsDir, true);
          }
        }
      }
      if (Array.isArray(data.Sound?.fields) && Array.isArray(data.Sound?.values)) {
        const idx = data.Sound.fields.indexOf('AudioName');
        if (idx >= 0) for (const row of data.Sound.values) if (typeof row[idx] === 'string' && row[idx]) enqueue(`res/sound/${row[idx]}.mp3`, base, false);
      }
      walk(data, isLaya2DData(data) ? base : url);
    }
  }
  function scan(body, url) { 
    const parsedUrl = new URL(url), ext = path.extname(parsedUrl.pathname).toLowerCase() || (/\/raw-assets\//.test(parsedUrl.pathname) ? '.bin' : '');
    if (!SCANNABLE.test(ext)) return;
    scannedFiles++;
    if (ext === '.sk') {for(const ref of layaSkeletonAssets(body))enqueue(ref,url,true);return;}
    if (ext === '.zip') {
      for (const name of layaZipEntries(body)) atlasFrames.add(new URL(name, base).href);
      return;
    }
    if (ext === '.bin') {
      const legacy = yygLegacyBundleManifest(body);
      if (legacy) {
        for (const name of legacy.virtualPaths) registerVirtualPath(name);
        for (const name of legacy.resources) enqueue(name, base);
        return;
      }
      const script = yygBinScript(body);
      if (script !== null) {
        scan(Buffer.from(script), new URL('yyg-package.js', base).href);
        return;
      }
      for (const ref of fairyguiAssets(body)) {
        const locations = !ref.prefix && guiPackages.get(ref.file);
        const sibling = new URL(ref.file, url).href;
        if (locations?.size === 1 && !locations.has(sibling)) {
          enqueue([...locations][0]);
          const previous = records.get(sibling);
          if (previous && !previous.saved && previous.recoveredBy === 'asset-completer')
            update(sibling, {...previous, ignored: true, ignoredReason: 'Shared FairyGUI package resolved from declared path'});
        } else enqueue((ref.prefix ? path.posix.basename(parsedUrl.pathname, '.bin') + '_' : '') + ref.file, url, false);
      }
      const entries = yygBinJsonEntries(body);
      if (entries && typeof entries === 'object') {
        for (const [k, v] of Object.entries(entries)) {
          const n = k.replaceAll('\\', '/');
          if (valid(n)) registerVirtualPath(n);
          scanJsonData(v, valid(n) ? new URL(n, base).href : url);
        }
      }
      return;
    }
    const text = body.toString('utf8');
    if (ext==='.js') {
      for (const worker of serviceWorkerRegistrations(text)) enqueue(worker,base,false);
      const offline=constructOfflineCacheDeclaration(text);
      if(offline)enqueue(offline.manifest,url,false);
      // Construct exports its precache file list as JSON in offline.js.
      // Preserve late assets even if the worker's directory prefetch failed.
      if(text.trimStart().startsWith('{'))try{
        const data=JSON.parse(text);
        if(Number.isFinite(data.version)&&Array.isArray(data.fileList)&&data.fileList.every(x=>typeof x==='string'))
          for(const name of data.fileList)if(name&&name!=='.'&&name!=='./')enqueue(name,url,false);
      }catch{}
    }  const openfl = openflBuildDependencies(text);
    for (const reference of [...openfl.scripts,...openfl.packs.map(pack=>pack.url)]) {
      const target=new URL(reference,url);
      // Lime appends a random cache-break query. The original captured URL
      // already identifies the declared pack; keep its exact replay mapping.
      const captured=[...records.values()].find(record=>{
        if (!record.saved) return false;
        const candidate=new URL(record.url);return candidate.origin===target.origin && candidate.pathname===target.pathname;
      });
      enqueue(captured?.url || target.href,url,true);
    }
    if (['.html', '.htm', '.php'].includes(ext)) {
      for (const match of text.replace(/<!--[\s\S]*?(?:-->|$)/g, '').matchAll(/<(?:script|link)\b[^>]*>/gi)) {
        const tag = match[0];
        const script = /^<script\b/i.test(tag);
        const icon = !script && /\brel\s*=\s*["'](?:shortcut\s+|apple-touch-)?icon["']/i.test(tag);
        if (!script && !icon && !/\brel\s*=\s*["'](?:stylesheet|modulepreload)["']/i.test(tag)) continue;
        const reference = tag.match(script ? /\bsrc\s*=\s*["']([^"']+)["']/i : /\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
        if (reference) enqueue(reference.replaceAll('&amp;', '&'), url, !icon);
      }
    }
    if (['.js', '.mjs'].includes(ext)) {
      for (const dependency of webpackChunkDependencies(text)) enqueue(dependency, url, false);  const activeCode = stripJsComments(text);
      for (const match of activeCode.matchAll(/\b(?:import|export)\s*(?:[^"'();\r\n]*?\bfrom\s*)?["']([^"'\r\n]+)["']/g)) {
        if (/^(?:\.{1,2}\/|\/|https?:\/\/)/.test(match[1])) enqueue(match[1], url, true);
      }
      for (const match of activeCode.matchAll(/\bimport\s*\(\s*["']([^"'\r\n]+)["']\s*\)/g)) {
        if (/^(?:\.{1,2}\/|\/|https?:\/\/)/.test(match[1])) enqueue(match[1], url, false);
      }
      // Vite texture registries use root URLs even for unseen later tutorials.
      for (const match of activeCode.matchAll(/["'](\/assets\/[^"'\r\n]+)["']/g)) {
        if (BINARY_EXT.test(new URL(match[1], url).pathname)) enqueue(match[1], url, false);
      }
    }
    if (ext === '.js') {  const build = emscriptenBuildDependencies(text);
      for (const name of build.virtualPaths) registerVirtualPath(name, url);
      const loaderProvidesWasm = unityFrameworksWithCode.has(url) && /\bfunction\s+unityFramework\s*\(/.test(text);
      for (const dependency of build.urls) {
        const unusedEmscriptenDefault = isEmscriptenDefaultName(new URL(dependency, url).href);
        // Unity passes the configured codeUrl bytes into its framework factory.
        // Emscripten's literal build.wasm is an unused fallback in that case.
        if ((loaderProvidesWasm || unusedEmscriptenDefault || playcanvasFallbackScripts.has(withoutQuery(url))) && /\.wasm(?:\.(?:gz|br))?(?:[?#]|$)/i.test(dependency)) {
          const fallback = new URL(dependency, url).href, previous = records.get(fallback);
          if (previous && !previous.saved && previous.recoveredBy === 'asset-completer' && !runtimeRequested(previous))
            update(fallback, {...previous, ignored:true, ignoredReason:'Engine registry overrides unused Emscripten WASM fallback'});
        } else enqueue(dependency, url, true);
      }
    }
    // .json 也必须在列：Unity 5/2017 的构建清单（Build/<name>.json）本身是一个独立的
    // JSON 文档，dataUrl / wasmCodeUrl / wasmFrameworkUrl 只写在这里，不在 HTML 里。
    if (['.html', '.htm', '.php', '.js', '.json'].includes(ext)) {  const { requiredUrls, candidateUrls, codeUrls } = unityBuildDependencies(text);
      for (const code of codeUrls) unityDeclaredWasm.add(new URL(code, url).href);
      for (const dependency of requiredUrls) enqueue(dependency, url, true);
      for (const dependency of candidateUrls) enqueue(dependency, url, false);
    }
    if (['.html', '.htm', '.php'].includes(ext)) return;
    if (ext === '.js') {  const decoded = deobfuscateJsStrings(text); for(const t of configuredAssetTemplates(decoded))configuredTemplates.set(JSON.stringify(t),t);completeConfiguredAssets();  for(const letter of declaredPrefabBaseLetters(decoded))prefabBaseLetters.add(letter);  const variants=layaPublishedVariants(decoded);for(const {from,to} of variants.prefabs){if(!prefabVariants.has(from))prefabVariants.set(from,new Set());prefabVariants.get(from).add(to);}for(const theme of variants.themes)enqueue(theme,base,false);for(const ui of variants.ui)enqueue(ui,base,false);  for (const dependency of numberedThemeDependencies(decoded)) enqueue(dependency, base, false);
      // Laya publishes View/Scene .scene references as JSON. Match the native
      // loader calls, rather than guessing every string ending in .scene.
      const sceneCalls = /(?:\bLaya(?:\.(?:Scene|View)|\[["'](?:Scene|View)["']\])(?:\.(?:open|load)|\[["'](?:open|load)["']\])|\bthis(?:\.loadScene|\[["']loadScene["']\]))\s*\(\s*["']([^"'\r\n]+)["']/g;
      for (const match of decoded.matchAll(sceneCalls)) {
        const name = match[1];
        if (/\.scene(?:[?#]|$)/i.test(name)) enqueue(name.replace(/\.scene(?=[?#]|$)/i, '.json'), base, false);
        else if (!path.posix.extname(name) && /^\w[\w/-]*$/.test(name)) enqueue(name + '.json', base, false);
        else if (/\.json(?:[?#]|$)/i.test(name)) enqueue(name, base, false);
      }
      for (const template of decoded.matchAll(/["']((?:sub\d+\/)?prop\/[A-Za-z0-9_/-]+\/)["']\s*\+\s*[$\w]+\s*\+\s*["']\.lh["']/g)) prefabPrefixes.add(template[1]);
      for (const template of decoded.matchAll(/["']((?:sub\d+\/)?hand\/[A-Za-z0-9_/-]+\/)["']\s*\+\s*[$\w]+\s*\+\s*["']\.lh["']/g)) handPrefixes.add(template[1]);
      // The native hand table supplies the finite IDs for lazy unlock icons.
      // Require an actual literal path + property + .png declaration; no ID guessing.
      for (const template of decoded.matchAll(/["'](img\/[A-Za-z0-9_/-]*hand_)["']\s*\+\s*[$\w]+(?:\.[\w$]+|\[["'][\w$]+["']\])?\s*\+\s*["']\.png["']/g)) handIconPrefixes.add(template[1]);
      for (const alias of decoded.matchAll(/(?:\[["'](?:foodName|prefabName|propName)["']\]|\.(?:foodName|prefabName|propName))\s*=\s*["']([A-Za-z0-9_-]+)["']/g)) prefabAliases.add(alias[1]);
      enqueueScenePrefabs();
      for (const template of decoded.matchAll(/["']((?:sub\d+\/)?effect\/[A-Za-z0-9_/-]+\/)["']\s*\+\s*[$\w]+\s*\+\s*["']\.lh["']/g)) {
        for (const call of decoded.matchAll(/(?:\b(?:createEffect|selectEffect|getNode)|\[["'](?:createEffect|selectEffect|getNode)["']\])\s*\(\s*["']([A-Za-z0-9_-]+)["']/g))
          dependency(template[1] + call[1] + '.lh', base, false);
      }
      if (/\/gameSDK\/YYGGames\.js$/i.test(parsedUrl.pathname)) {
        // Local replay changes the hostname: this SDK selects fallback channels
        // whose logos were never requested on the original publisher's domain.
        if (decoded.includes('H5GAMES4U') && decoded.includes('side.png'))
          enqueue('logo/H5GAMES4U/side.png', url, false);
        if (decoded.includes('H5GAMES4U') && decoded.includes('144x144.png'))
          enqueue('logo/H5GAMES4U/144x144.png', url, false);
        if (decoded.includes('DEVELOPMENT') && decoded.includes('144x144.png'))
          enqueue('logo/DEVELOPMENT/144x144.png', url, false);
        for (const match of decoded.matchAll(/["'](https?:\/\/[^"'\s]+)["']/g)) {
          // A query prefix concatenated with runtime parameters is not a
          // complete asset URL (some SDK endpoints also require POST).
          if (match[1].endsWith('?') && /^\s*\+/.test(decoded.slice(match.index + match[0].length))) {
            const previous = records.get(match[1]);
            if (previous && !previous.saved && previous.recoveredBy === 'asset-completer')
              update(match[1], { ...previous, ignored: true, ignoredReason: 'Incomplete SDK dynamic query prefix' });
            emit('info', `跳过未拼接完整的 SDK 动态接口：${match[1]}`);
            continue;
          }
          dependency(match[1], url, false);
        }
      }
      for (const match of decoded.matchAll(/["']((?:res|Assets|assets|img|sound|sounds|audio|music|unity1?)\/[^"'\r\n]+)["']/g)) dependency(match[1], base, false);
      // Some wrappers accept a sound name and construct the URL at runtime.
      // Only derive candidates when the script declares that exact template.
      for (const template of decoded.matchAll(/["']((?:img\/)?(?:sound|sounds|audio)\/)["']\s*\+\s*[$\w]+\s*\+\s*["'](\.(?:mp3|wav|ogg))["']/g)) {
        for (const call of decoded.matchAll(/(?:\bplaySound|\[["']playSound["']\])\s*\(\s*["']([A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*)["'](?=\s*[,\)])/g))
          dependency(template[1] + call[1] + template[2], base, false);
      }
      for (const audio of wrappedAudioDependencies(decoded)) dependency(audio, base, false);
      for (const level of boundedLevelDependencies(decoded)) dependency(level, base, false);
      registerGuiPaths(decoded);
      for (const match of decoded.matchAll(guiPathPattern)) enqueue(match[1] + '.bin', base, false);
      for (const match of decoded.matchAll(/["']([A-Za-z0-9_-]+\.(?:json|lh|ls|lmat|atlas))["']/g)) dependency(match[1], base, false);
      return;
    }
    const trimmed = text.trimStart();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return;
    const data = JSON.parse(text);
    if (ext === '.atlas') {
      if (data.frames && typeof data.frames === 'object') {
        const prefix = typeof data.meta?.prefix === 'string' ? data.meta.prefix : '';
        for (const name of Object.keys(data.frames)) {
          if (prefix) atlasFrames.add(new URL(prefix + name, base).href);
          atlasFrames.add(new URL(name, base).href);
        }
      }
      for (const image of (data.meta?.image || '').split(',')) if (image.trim()) dependency(image.trim(), url);
    } else scanJsonData(data, url);
  }
  for (const registry of manifest.runtimeAssetRegistries || []) {
    for (const doc of registry.dependencyDocuments || []) {
      const url = new URL(doc.name, registry.baseUrl).href;
      scan(Buffer.from(JSON.stringify(doc.data)), url);
    }
  }
  // Resolve published Unity configuration before scanning framework files;
  // manifest ordering must not decide whether a fallback becomes required.
  for (const record of records.values()) {
    const url = new URL(record.url);
    if (!record.saved || !record.path || url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || !/\.(?:html?|php|js|json)$/i.test(url.pathname)) continue;
    const text = await readFile(path.join(captureRoot, record.path), 'utf8');
    const unity = unityBuildDependencies(text);
    for (const framework of unity.frameworkUrls) unityFrameworksWithCode.add(new URL(framework, url).href);
    for (const code of unity.codeUrls) unityDeclaredWasm.add(new URL(code, url).href);
  }
  for (const record of records.values()) {
    const url = new URL(record.url);
    // A portal iframe can leave gameUrl at its SDK wrapper. The publisher's
    // captured PlayCanvas registry is still authoritative for scene assets.
    if (record.saved && record.path && /\/config\.json$/i.test(url.pathname)) {
      try {
        const config = JSON.parse(await readFile(path.join(captureRoot, record.path), 'utf8'));
        if (config.application_properties && config.assets && Array.isArray(config.scenes)) { scanJsonData(config, record.url); enqueue(record.url); }
      } catch {}
    }
    if (record.saved && record.path && url.origin === base.origin && url.pathname.startsWith(base.pathname) && /\.js$/i.test(url.pathname)) {
      registerGuiPaths(deobfuscateJsStrings(await readFile(path.join(captureRoot, record.path), 'utf8')));
    }
    const sdkVersionManifest = /\/(?:gameSDK|sdk)\/.*\/version\.json$/i.test(url.pathname);
    const yygSdk = /\/gameSDK\/YYGGames\.js$/i.test(url.pathname);
    // 上次补全自己猜出来、线上并不存在的引擎兜底名（build.wasm 等）不要再重试：
    // 构建清单已经声明了真正的 WASM 产物，重试只会把同一份 HTML 再取一遍。
    if (record.saved === false && !runtimeRequested(record) && isEmscriptenDefaultName(record.url)) {
      update(record.url, {...record, ignored: true, ignoredReason: 'Engine registry overrides unused Emscripten fallback'});
      continue;
    }
    if (record.saved && (record.status === undefined || (record.status >= 200 && record.status < 300)) &&
        ((url.origin === base.origin && url.pathname.startsWith(base.pathname)) || sdkVersionManifest || yygSdk) &&
        !isNoiseUrl(record.url) && (SCANNABLE.test(url.pathname) || CONTAINER.test(url.pathname) || (BINARY_EXT.test(url.pathname) && /^text\//i.test(record.contentType || '')))) enqueue(record.url);
  }
  // Late native requests, including extensionless Unity AssetBundles, are
  // authoritative dependencies even when static URL scanning cannot infer them.
  for (const request of options.runtimeRequests || []) {
    const raw = typeof request === 'string' ? request : request.url;
    let url; try { url = new URL(raw); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || isNoiseUrl(url.href) || (request.method && request.method !== 'GET')) continue;
    const prior = records.get(url.href);
    update(url.href, {...prior,url:url.href,method:'GET',type:prior?.type || 'fetch',status:prior?.status || 404,saved:prior?.saved || false,runtimeRequested:true,ignored:false});
    enqueue(url.href);
  }
  async function processResource(url) {
    if (atlasFrames.has(url)) return;
    let body, previous = records.get(url);
    if (previous?.status >= 300 && previous?.status < 400) return;
    const corruptedTextBin = previous?.saved && previous.recoveredBy !== 'asset-completer' &&
      /^text\//i.test(previous.contentType || '') && BINARY_EXT.test(new URL(url).pathname);
    const zeroByteBin = previous?.saved && (previous.bytes === 0 || previous.sha256 === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') && BINARY_EXT.test(new URL(url).pathname);
    if (!corruptedTextBin && !zeroByteBin && previous?.saved && (previous.status === undefined || previous.status >= 200 && previous.status < 300) && previous.path && await access(path.join(captureRoot, previous.path)).then(() => true, () => false)) {
      body = await readFile(path.join(captureRoot, previous.path));
      if (body.length === 0 && BINARY_EXT.test(new URL(url).pathname)) body = null;
    }
    if (!body) {
      missingCandidates++;
      let status = 0;
      try {
        let contentType;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const isCore = CORE_BINARY_EXT.test(url);
            const perAssetTimeout = isCore ? (options.coreTimeoutMs ?? 180_000) : (options.timeoutMs ?? 30_000);
            const signals = [AbortSignal.timeout(Math.max(1, Math.min(perAssetTimeout, deadline - Date.now())))];
            if (options.signal) signals.push(options.signal);
            const response = await fetch(url, { signal: AbortSignal.any(signals) });
            status = response.status;
            if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${status}`); }
            contentType = response.headers.get('content-type') || 'application/octet-stream';
            body = Buffer.from(await response.arrayBuffer());
            if (!body.length) throw new Error('Empty asset response');
            const htmlType = /text\/html/i.test(contentType);
            const htmlBody = /^\s*(?:<!doctype\s+html\b|<(?:html|head|body)\b)/i.test(body.subarray(0, 512).toString('utf8'));
            if ((htmlType || htmlBody) && !/\.(?:html?|php)(?:[?#]|$)/i.test(new URL(url).pathname) && previous?.type !== 'document') {
              let jsonBody = false;
              if (/\.json$/i.test(new URL(url).pathname)) {
                try { JSON.parse(body.toString('utf8')); jsonBody = true; } catch {}
              }
              if (!jsonBody) throw Object.assign(new Error('Expected game asset, received HTML'), { code: 'INVALID_ASSET_RESPONSE' });
              // Some SDKs serve valid JSON with an HTML MIME type. Normalize
              // it so replay does not treat the config as a document.
              contentType = 'application/json';
            }
            break;
          } catch (error) {
            if (options.signal?.aborted || Date.now() >= deadline || attempt === 2 || error.code === 'INVALID_ASSET_RESPONSE' || (status >= 400 && status < 500 && status !== 429)) throw error;
          }
        }
        const file = resourcePath(captureRoot, url, contentType, '', 'game');
        await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, body);
        const resType = previous?.type && previous.type !== 'fetch' && previous.type !== 'other'
          ? previous.type
          : inferResourceType(url, contentType, 'fetch');
        update(url, { url, method: 'GET', status, type: resType, contentType, saved: true,
          path: path.relative(captureRoot, file).replaceAll('\\', '/'), bytes: body.length,
          sha256: sha256(body), recoveredBy: 'asset-completer', ...(previous?.runtimeRequested ? {runtimeRequested:true} : {}) });
        fetchedAssets++;
      } catch (error) {
        // SDK code or unreferenced UI configs can contain paths for unused modules or assets.
        // Keep their absence visible without pretending they were requested or break core completeness.
        const isNonCritical = NON_CRITICAL_EXT.test(new URL(url).pathname);
        const wasPreviouslySaved = previous?.saved === true;
        const wasRuntimeRequested = runtimeRequested(previous);
        const unavailableCandidate = !required.has(url) && error.code === 'INVALID_ASSET_RESPONSE';
        if (unavailableCandidate || ((!required.has(url) || (!wasPreviouslySaved && !wasRuntimeRequested && isNonCritical)) && [404,410].includes(status))) {
          unresolvedCandidates.push({url,error:error.message});
          if (previous?.recoveredBy === 'asset-completer')
            update(url, {...previous, ignored:true, ignoredReason:'Unrequested static candidate is unavailable at source'});
          return;
        }
        failures.push({ url, error: error.message });
        const resType = inferResourceType(url, '', previous?.type || 'fetch');
        update(url, { ...previous, url, method: 'GET', type: resType, status, saved: false, ignored: false, error: error.message, recoveredBy: 'asset-completer', runtimeRequested: wasRuntimeRequested });
        emit('warning', `资源补全失败：${url}：${error.message}`); return;
      }
    }
    try {
      const packed=yygBinScript(body);
      const script=packed||(/\.m?js(?:[?#]|$)/i.test(url)?body.toString('utf8'):null);
      if (script && /\b(?:function\s+_0x[\da-f]+\s*\(|(?:const|let|var)\s+_0x[\da-f]+\s*=\s*\[)/i.test(script) && /\b_0x[\da-f]+\(\s*['"]?0x[\da-f]+/i.test(script)) {
        emit('info', '正在解析混淆依赖：' + url);
        const key=sha256(script);
        if(!decodedScripts.has(key))decodedScripts.set(key,decodePackedScript(script,{signal:options.signal,timeoutMs:Math.max(1,Math.min(90000,deadline-Date.now()))}));
        const decodedBody = await decodedScripts.get(key); emit('info','字符串解码完成：'+url);
        scan(decodedBody,packed?new URL('yyg-package.js',base).href:url); emit('info','依赖扫描完成：'+url);
      } else scan(body, url);
    }
    catch (error) { scanFailures.push({ url, error: error.message }); emit('warning', `依赖解析失败：${url}：${error.message}`); }
  }
  while (queue.length && !options.signal?.aborted && Date.now() < deadline) {
    // Finish dependency containers before leaf images, so atlas frame names are
    // recognized even when the atlas itself had to be fetched in this run.
    let count = Math.min(queue.length, concurrency);
    if (CONTAINER.test(new URL(queue[0]).pathname)) {
      const next = queue.findIndex(url => !CONTAINER.test(new URL(url).pathname));
      if (next >= 0) count = Math.min(count, next);
    } else if (SCANNABLE.test(new URL(queue[0]).pathname)) {
      const leaf = queue.findIndex(url => !SCANNABLE.test(new URL(url).pathname));
      if (leaf >= 0) count = Math.min(count, leaf);
    }
    await Promise.all(queue.splice(0, count).map(processResource));
    if (fetchedAssets - lastReported >= 40) {
      emit('info', `动态资源补全：已下载 ${fetchedAssets}，待检查 ${queue.length}`);
      lastReported = fetchedAssets;
    }
  }
  for (const record of records.values()) {
    if (record.recoveredBy === 'asset-completer' && !record.saved && !runtimeRequested(record) && !seen.has(record.url) && !record.ignored) {
      update(record.url, {
        ...record,
        ignored: true,
        ignoredReason: 'Stale unrequested completer candidate is no longer referenced'
      });
    }
  }
  const stats = { scannedFiles, discoveredAssets: missingCandidates, fetchedAssets, failedAssets: failures.length,
    failures, scanFailures, unresolvedCandidates, pendingAssets: queue.length, limitReached,
    cancelled: Boolean(options.signal?.aborted), timedOut: queue.length > 0 && Date.now() >= deadline };
  manifest.assetCompletion = { ...stats, checkedAt: new Date().toISOString(), scope: 'declared-dependencies' };
  const cacheWarnings=await classifyOfflineCacheRequests(captureRoot,manifest);
  for(const warning of cacheWarnings)emit('info',`离线缓存目录预取失败（不影响游戏入口）：${warning.url}`);
  await mkdir(path.join(captureRoot, 'archive'), { recursive: true });
  await writeFile(path.join(captureRoot, 'archive/manifest.json'), JSON.stringify(manifest, null, 2));
  emit('info', `动态资源补全：下载 ${fetchedAssets}，失败 ${failures.length}，解析失败 ${scanFailures.length}，未检查 ${queue.length}`);
  if (unresolvedCandidates.length) emit('info', `另有 ${unresolvedCandidates.length} 个静态候选在源站不存在，可能为未启用配置；不计入核心缺失，详情见 manifest.assetCompletion.unresolvedCandidates`);
  return stats;
}




