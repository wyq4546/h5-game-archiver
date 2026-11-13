import { analyzeLevelSummary } from './level-summary.mjs';
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { extractUnityWebData, runIl2CppAnalysis, summarizeWasm } from "./unity-analysis.mjs";
import { writeBotKit } from "./bot-kit.mjs";
import { openflBuildDependencies } from "./openfl-assets.mjs";
import { analyzeConstruct } from "./construct-analysis.mjs";
import { analyzeEmscriptenData, readEmscriptenPackage } from "./emscripten-data.mjs";
import {writeJavaScriptIndex} from './javascript-symbols.mjs';
import {inlineGameBuilds,isEmbeddedPixiGame} from './inline-builds.mjs';

const require = createRequire(import.meta.url);
const wabtFactory = require("../tools/wabt-js/node_modules/wabt");
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".html", ".htm", ".json", ".css", ".map", ".txt"]);
const AUTOMATION_TERMS = /\b(player|snake|ball|character|controller|input|move|speed|position|obstacle|enemy|collect|coin|diamond|score|gameover|restart|lane|jump)\b/ig;
const NOISE_HOST = /(?:^|\.)(?:fundingchoicesmessages\.google\.com|doubleclick\.net|google\.com|googleapis\.com|googlesyndication\.com|googleadservices\.com|facebook\.com|facebook\.net|twitter\.com|twimg\.com|gamedock\.io|gamemonkey\.org|azerioncircle\.com|improvedigital\.com|amazon-adsystem\.com|cloudfront\.net|quantserve\.com|scorecardresearch\.com|cookielaw\.org|cookiebot\.com)$/i;

async function walk(root, current = root, output = []) {
  for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) await walk(root, full, output);
    else if (entry.isFile()) output.push({ full, relative: path.relative(root, full).replaceAll("\\", "/") });
  }
  return output;
}

function tryDecodeWasm(buffer) {
  const candidates = [buffer];
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) try { candidates.push(gunzipSync(buffer)); } catch {}
  for (const decoder of [brotliDecompressSync, inflateSync]) try { candidates.push(decoder(buffer)); } catch {}
  return candidates.find(value => value.length >= 8 && value.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) || null;
}

function decodedCandidates(buffer) {
  const candidates = [buffer];
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) try { candidates.push(gunzipSync(buffer)); } catch {}
  for (const decoder of [brotliDecompressSync, inflateSync]) try { candidates.push(decoder(buffer)); } catch {}
  return candidates;
}

function tryDecodeUnityWebData(buffer) {
  const magic = Buffer.from("UnityWebData1.0\0");
  return decodedCandidates(buffer).find(value => value.length >= magic.length + 4 && value.subarray(0, magic.length).equals(magic)) || null;
}

function urlHost(value) {
  try { return new URL(value).hostname.toLowerCase(); } catch { return ""; }
}

export function classifySourceFile(relative, manifest = {}) {
  const normalized = relative.replaceAll("\\", "/");
  if (normalized === "index.html") return "archive-entry";
  const coreFiles = new Set((manifest.runtimeInspection?.coreFiles || []).map(value => value.replaceAll("\\", "/")));
  const host = normalized.match(/^game\/([^/]+)\//i)?.[1]?.toLowerCase() || "";
  if (!host) return "archive-other";
  if (NOISE_HOST.test(host)) return "noise";
  if (coreFiles.has(normalized)) return "game-core";
  const gameHosts = new Set((manifest.platform?.mode === 'iframe' ? [urlHost(manifest.gameUrl)] : [urlHost(manifest.gameUrl), urlHost(manifest.finalUrl)]).filter(Boolean));
  const siteHost = urlHost(manifest.siteUrl || manifest.sourceUrl);
  if (gameHosts.has(host)) return "game";
  if (host === siteHost) return "site-wrapper";
  return "external";
}

export function detectEngine(files, text) {
  const paths = files.map(file => file.relative).join("\n");
  const engines = [
    { name: "OpenFL / Lime", evidence: [[/\blime\.embed\s*\(/, 40, "Lime 应用启动声明"], [/\bopenfl\.display\.(?:Stage|IBitmapDrawable)\b/, 40, "OpenFL 发布运行库"], [/\blime\.\$scripts(?:\.|\[)/, 35, "Lime 编译应用注册"]] },
    { name: "Three.js", evidence: [[/(?:^|\/)three(?:-[\w.-]+)?(?:\.min)?\.js$/im, 45, "Three.js 发布运行库", "path"], [/\bimport\s*[^;\r\n]*?["'](?:[^"']*\/)?three(?:-[\w.-]+)?(?:\.min)?\.js["']/,40,"Three.js 游戏模块导入","entry"]] },
    { name: "PixiJS", evidence: [[/(?:^|\/)pixi(?:[.-][\w.-]+)?\.js$/im, 45, "PixiJS 发布运行库", "path"], [/\[pixi\.js\/(?:math|core):/i, 45, "PixiJS 内置运行库标记"], [/\b__PIXI_RENDERER_INIT__\b/, 25, "PixiJS renderer 初始化钩子"], [/(?:^|\/)WebGLRenderer(?:-[\w.-]+)?\.js$/im, 20, "拆分 WebGL renderer 模块", "path"]] },
    { name: "Fancade / Emscripten", evidence: [[/(?:^|\/)fancade\.css$/im, 60, "Fancade 发布运行时样式", "path"]] },
    { name: "LayaAir 3D", evidence: [[/libs\/(?:min\/)?laya\.core(?:\.min)?\.js/i, 45, "Laya core 运行库（libs/ 或 libs/min/）", "path"], [/libs\/(?:min\/)?laya\.d3(?:\.min)?\.js/i, 45, "Laya d3 运行库（libs/ 或 libs/min/）", "path"], [/LayaScene_[^/]+/i, 25, "LayaScene_*", "path"], [/\.(?:lm|lmat|lh|ls)(?:$|\?)/im, 12, "Laya 3D 资源格式", "path"], [/\bLaya(?:3D)?\.init\s*\(/i, 35, "Laya.init/Laya3D.init"], [/\bLaya\.Scene3D\b/i, 25, "Laya.Scene3D API"]] },
    { name: "Unity WebGL", evidence: [[/createUnityInstance\s*\(/i, 45, "createUnityInstance"], [/\bUnityLoader\.instantiate\s*\(/i, 45, "UnityLoader.instantiate"], [/(?:\.loader|\/UnityLoader)\.js(?:$|\?)/im, 18, "Unity loader 文件", "path"], [/\.wasm(?:\.code)?(?:\.unityweb)?(?:\.(?:gz|br))?(?:$|\?)/im, 18, "Unity WASM 构建产物", "path"], [/\.data(?:\.unityweb)?(?:\.(?:gz|br))?(?:$|\?)/im, 18, "Unity data 构建产物", "path"]] },
    { name: "Cocos Creator", evidence: [[/(?:cocos2d-js|cocos-js|cocoslib)/i, 35, "Cocos 运行库", "path"], [/\bcc\.director\b/i, 25, "cc.director API"], [/\bCocosCreator\b/i, 25, "CocosCreator 标记"], [/\bvar\s+engine\s*=\s*["']cocos2d["']/i, 25, "engine=cocos2d 标记"], [/\bcc\.game\b/i, 20, "cc.game API"]] },
    { name: "Construct", evidence: [[/(?:c3runtime|c2runtime|c3main(?:\.min)?\.js)/i, 40, "Construct 运行库", "path"], [/(?:Generated by Construct\b|Construct\s*[23]\b|construct\.net)/i, 30, "Construct 标记"]] },
    { name: "PlayCanvas", evidence: [[/playcanvas(?:-[\w.-]+)?(?:\.min)?\.js/i, 35, "PlayCanvas 运行库", "path"], [/\bpc\.Application\b/i, 30, "pc.Application API"]] },
    { name: "Phaser", evidence: [[/phaser(?:\.min)?\.js/i, 35, "Phaser 运行库", "path"], [/\bPhaser\.(?:Game|Scene)\b/i, 30, "Phaser API"]] },
    // GameMaker (YoYo) HTML5 导出，两种产物形态：
    // 旧版：html5game/ 目录 + GML 编译桥接（gml_Script_*）+ 运行时日志；
    // 新版（WASM runner）：同目录的 runner.js / runner.wasm / runner.data，
    // 以及 IFF 格式（FORM…GEN8）的数据包 game.unx。
    { name: "GameMaker HTML5", evidence: [
      [/(?:^|\/)html5game\/[^/]+\.js(?:$|\?)/im, 35, "GameMaker html5game 运行库目录", "path"],
      [/(?:^|\/)runner\.wasm(?:$|\?)/im, 50, "GameMaker WASM 运行时 runner.wasm", "path"],
      [/(?:^|\/)game\.(?:unx|win|droid)(?:$|\?)/im, 40, "GameMaker 数据包 game.unx", "path"],
      [/\bdatafile_runner\.data\b|\bprocessPackageData\b/, 30, "GameMaker WASM 加载器预载包"],
      [/\bcaching game\.unx\b/, 20, "GameMaker 数据包缓存流程"],
      [/\bApplication Surface (?:created|resized)\b/, 45, "GameMaker Application Surface 运行时日志"],
      [/\bEntering main loop\.\.\./, 25, "GameMaker 主循环启动日志"],
      [/\bgml_Script_[A-Za-z0-9_$]+/, 35, "GML 编译脚本桥接"],
      [/function display_reset\(\) is not supported/, 20, "GameMaker display 运行时标记"],
      [/\bYaGames_sdk_src\b/, 10, "GameMaker Yandex 扩展配置"]] }
  ];
  const source = `${paths}\n${text}`;
  engines.find(e=>e.name==='PixiJS').evidence.push([/\bvar\s+PIXI\s*=\s*function\b/,45,'内嵌 PixiJS 运行库实现']);
  const ranked = engines.map(engine => {
    // A shared SDK can name several engines without loading their libraries.
    // Filename evidence must come from captured paths, not compatibility text.
    const hits = engine.evidence.filter(([pattern, , , kind]) => pattern.test(kind === "path" ? paths : source));
    // WASM and .data are shared Emscripten formats, including Fancade builds.
    // Require a Unity-specific loader or API before assigning Unity rules.
    if (engine.name === "Unity WebGL" && !hits.some(([, , label]) =>
      ["createUnityInstance", "UnityLoader.instantiate", "Unity loader 文件"].includes(label))) {
      return {name:engine.name,score:0,pathScore:0,evidence:[]};
    }
    return { name: engine.name, score: hits.reduce((sum, [, points]) => sum + points, 0),
      entryScore: hits.reduce((sum, [, points, , kind]) => sum + (kind === "entry" ? points : 0), 0),
      pathScore: hits.reduce((sum, [, points, , kind]) => sum + (kind === "path" ? points : 0), 0),
      evidence: hits.map(([, points, label]) => ({ label, points })) };
  }).sort((a, b) => (b.entryScore||0) - (a.entryScore||0) || b.pathScore - a.pathScore || b.score - a.score);
  // Prefer captured builds over a larger number of generic SDK mentions.
  // Weak resource-format hints alone still do not establish an engine.
  const best = ranked.find(item => item.score >= 30);
  // Generic generated loaders are a fallback: Unity/Fancade and other known
  // engines keep their stricter engine-specific completeness rules.
  if (!best && /\bwasmBinaryFile\s*=\s*["'][^"']+\.wasm["']/.test(text) &&
      /\b(?:instantiateAsync|createWasm)\s*\(/.test(text) &&
      /\b(?:REMOTE_PACKAGE_BASE|HEAPU8)\b/.test(text)) {
    return {engine:'Emscripten', confidence:'high', evidence:[{label:'Emscripten 生成的 WASM 加载器',points:70}], candidates:ranked.filter(item=>item.score)};
  }
  if (!best || best.score < 30) return { engine: "Unknown / insufficient runtime assets", confidence: "insufficient", evidence: [], candidates: ranked.filter(item => item.score) };
  return { engine: best.name, confidence: best.score >= 70 ? "high" : "medium", evidence: best.evidence, candidates: ranked.filter(item => item.score) };
}

async function runtimeScope(captureRoot, allFiles, suppliedManifest) {
  const manifest = suppliedManifest ?? await readFile(path.join(captureRoot,'archive','manifest.json'),'utf8').then(JSON.parse).catch(()=>({}));
  const gameHost = urlHost(manifest.gameUrl), siteHost = urlHost(manifest.siteUrl || manifest.sourceUrl);
  const files = allFiles.filter(file => !NOISE_HOST.test(file.relative.match(/^game\/([^/]+)\//)?.[1] || ''));
  // Older archives sometimes still name their portal as gameUrl. Preserve
  // their build evidence until entry discovery has supplied a native URL.
  const legacyWrapper = ['games.crazygames.com','playhop.com','yandex.com','yandex.ru'].includes(gameHost) || /\/gameframe\//.test(manifest.gameUrl || '');
  if (!gameHost || gameHost === siteHost || !manifest.platform?.mode || legacyWrapper || !files.some(file=>file.relative.startsWith(`game/${gameHost}/`))) return {files,manifest,native:false};
  const records = new Map((manifest.resources || []).filter(r=>r.saved && r.path).map(r=>[r.path.replaceAll('\\','/'),r]));
  const gameHosts=new Set([gameHost,...[...records.values()].filter(r=>r.gameResource).map(r=>urlHost(r.url)).filter(Boolean)]);
  const hasGameDocument=files.some(f=>f.relative.startsWith(`game/${gameHost}/`) && /\.html?$/i.test(f.relative));
  const selected = new Set(files.filter(file=>(file.relative==='index.html' && !hasGameDocument) || gameHosts.has(file.relative.match(/^game\/([^/]+)\//)?.[1])));
  const byUrl = new Map(), sourceUrls=new Map();
  for (const file of files) {
    const record = records.get(file.relative);
    const inferred = file.relative.match(/^game\/([^/]+)(\/.*)$/);
    const url = record?.url || (inferred ? `https://${inferred[1]}${inferred[2]}` : manifest.gameUrl);
    if (url) { const u=new URL(url);u.search='';u.hash='';byUrl.set(u.href,file);sourceUrls.set(file,u.href); }
  }
  // Keep libraries explicitly loaded from other CDNs, while excluding portal
  // engine catalogs and independently captured advertisements.
  for (const file of selected) {
    if (!/\.(?:js|mjs|html?)$/i.test(file.relative)) continue;
    const source = await readFile(file.full,'utf8').catch(()=>'');
    const parent = sourceUrls.get(file) || manifest.gameUrl;
    const references = [
      ...source.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["']/gi),
      ...source.matchAll(/\b(?:loadLib|importScripts|import)\s*\(\s*["']([^"']+)["']/g),
      ...source.matchAll(/\b(?:import|export)\s*(?:[^"'();\r\n]*?\bfrom\s*)?["']([^"'\r\n]+)["']/g),
      ...source.matchAll(/\bsrc\s*:\s*["'](https?:\/\/[^"']+\.js)["']/g)
    ];
    for (const match of references) {
      try { const u=new URL(match[1].replaceAll('&amp;','&'),parent);u.search='';u.hash='';const dependency=byUrl.get(u.href);if(dependency)selected.add(dependency); } catch {}
    }
  }
  return {files:[...selected],manifest,native:true};
}

export async function inspectCapturedRuntime(captureRoot, suppliedManifest) {
  // Runtime detection only needs playable assets. Logs, videos and extracted
  // analysis trees can contain hundreds of thousands of unrelated files.
  const allFiles = await walk(captureRoot, path.join(captureRoot, "game"));
  allFiles.push({ full: path.join(captureRoot, "index.html"), relative: "index.html" });
  const {files,manifest,native} = await runtimeScope(captureRoot,allFiles,suppliedManifest);
  const snippets = [];
  for (const file of files) {
    if (!/[.](?:js|mjs|html?)$/i.test(file.relative)) continue;
    try {
      const buffer=await readFile(file.full);
      if(buffer.length<=8*1024*1024){
        const text=buffer.toString('utf8');snippets.push(text.slice(0,2*1024*1024));
        if(/\.html?$/i.test(file.relative))for(const build of inlineGameBuilds(text))snippets.push(build.code);
      }
    } catch {}
  }
  const detection = detectEngine(files, snippets.join("\n"));
  const paths = files.map(file => file.relative);
  const pick = pattern => paths.filter(value => pattern.test(value));
  let coreFiles = [], coreReady = false, coreRule = "未识别引擎，无法确定核心文件";
  if (detection.engine === "OpenFL / Lime") {
    const applications = new Set(snippets.flatMap(text=>openflBuildDependencies(text).applications));
    const records = new Map((manifest.resources || []).filter(r=>r.saved && r.path).map(r=>[r.path.replaceAll('\\','/'),r]));
    for (const entry of pick(/\.(?:js|mjs)$/i)) {
      const source = await readFile(path.join(captureRoot,entry),'utf8').catch(()=>'');
      if (!/\bopenfl\.display\.(?:Stage|IBitmapDrawable)\b/.test(source)) continue;
      const registered = [...source.matchAll(/\blime\.\$scripts(?:\.([\w-]+)|\[\s*["']([\w-]+)["']\s*\])\s*=/g)].map(m=>m[1]||m[2]);
      if (!registered.some(name=>applications.has(name))) continue;
      coreFiles.push(entry);
      const declarations = openflBuildDependencies(source).packs;
      let ready=true;
      for (const declaration of declarations) {
        const parent = records.get(entry)?.url || `https://${entry.slice(5)}`;
        const expected=new URL(declaration.url,parent);expected.search='';expected.hash='';
        const pack = files.find(file=>{
          const url=new URL(records.get(file.relative)?.url || (file.relative.startsWith('game/') ? `https://${file.relative.slice(5)}` : parent));url.search='';url.hash='';return url.href===expected.href;
        });
        if (!pack) {ready=false;continue;}
        coreFiles.push(pack.relative);
        try {
          const body=await readFile(pack.full),magic=Buffer.from('lime-asset-pack');
          if (!body.subarray(0,magic.length).equals(magic) || body.length<=magic.length) ready=false;
          else if (declaration.compression==='gzip' && !gunzipSync(body.subarray(magic.length),{maxOutputLength:64*1024*1024}).length) ready=false;
          else if (['zip','deflate'].includes(declaration.compression) && !inflateSync(body.subarray(magic.length),{maxOutputLength:64*1024*1024}).length) ready=false;
        } catch {ready=false;}
      }
      if (ready) coreReady=true;
    }
    coreRule = "需要与 lime.embed 一致的 OpenFL 编译应用及其声明的完整 Lime 资源包（校验包头与压缩内容）";
  } else if (detection.engine === "Fancade / Emscripten") {
    const roots = pick(/(?:^|\/)fancade\.css$/i).map(value => path.posix.dirname(value));
    for (const root of roots) {
      const required = ["fancade.css", "source_min.js", "index.js", "index.wasm", "index.data"].map(name => `${root}/${name}`);
      const checks = await Promise.all(required.map(async relative => {
        try {
          const body = await readFile(path.join(captureRoot, relative));
          return body.length > 0 && (!relative.endsWith('.wasm') || Boolean(tryDecodeWasm(body)));
        } catch { return false; }
      }));
      coreFiles.push(...required.filter(relative => paths.includes(relative)));
      if (checks.every(Boolean)) coreReady = true;
    }
    coreRule = "需要同一 Fancade 构建目录的 source_min.js、index.js、有效 WASM、非空 Data 与 fancade.css";
  } else if (detection.engine === "Emscripten") {
    const records = new Map((manifest.resources || []).filter(r=>r.saved && r.path).map(r=>[r.path.replaceAll('\\','/'),r]));
    const sourceUrl = file => records.get(file.relative)?.url || `https://${file.relative.slice(5)}`;
    const canonical = value => {const url=new URL(value);url.hash='';return url.href;};
    for (const loader of files.filter(file=>/\.js$/i.test(file.relative))) {
      const source = await readFile(loader.full,'utf8').catch(()=>'');
      const wasmName = source.match(/\bwasmBinaryFile\s*=\s*["']([^"']+\.wasm)["']/)?.[1];
      if (!wasmName || !/\b(?:instantiateAsync|createWasm)\s*\(/.test(source)) continue;
      const findDependency = name => files.find(file=>canonical(sourceUrl(file))===canonical(new URL(name,sourceUrl(loader)).href));
      coreFiles.push(loader.relative);
      let ready = true;
      const wasm = findDependency(wasmName);
      if (wasm) {
        coreFiles.push(wasm.relative);
        const body = tryDecodeWasm(await readFile(wasm.full));
        if (!body || !WebAssembly.validate(body)) ready=false;
      } else ready=false;
      const dataName = source.match(/\bREMOTE_PACKAGE_BASE\s*=\s*["']([^"']+)["']/)?.[1];
      if (dataName) {
        const data = findDependency(dataName);
        if (!data) ready=false;
        else {
          coreFiles.push(data.relative);
          try { readEmscriptenPackage(source,await readFile(data.full)); } catch {ready=false;}
        }
      } else if (/\bloadPackage\s*\(/.test(source)) ready=false;
      if (ready) coreReady=true;
    }
    coreRule = '需要 Emscripten 加载器实际声明的有效 WASM，以及匹配包大小和文件范围的 Data（如声明）';
  } else if (detection.engine === "Three.js") {
    const runtimes = pick(/(?:^|\/)three(?:-[\w.-]+)?(?:\.min)?\.js$/i);
    for (const runtime of runtimes) {
      const directory = path.posix.dirname(runtime);
      const entries = paths.filter(value => path.posix.dirname(value) === directory &&
        /(?:^|\/)(?:index|main|game|bundle)(?:-[\w.-]+)?(?:\.min)?\.js$/i.test(value));
      const library = await readFile(path.join(captureRoot, runtime), 'utf8').catch(() => '');
      if (!library.includes('WebGLRenderer')) continue;
      coreFiles.push(runtime);
      for (const entry of entries) {
        const source = await readFile(path.join(captureRoot, entry), 'utf8').catch(() => '');
        if (source.includes(path.posix.basename(runtime))) { coreFiles.push(entry); coreReady = true; }
      }
    }
    coreRule = "需要有效的 Three.js WebGLRenderer 运行库及同目录实际引用它的游戏入口模块";
  } else if (detection.engine === "PixiJS") {
    for(const entry of files.filter(f=>/\.html?$/i.test(f.relative))){
      const html=await readFile(entry.full,'utf8').catch(()=>'');
      try{if(inlineGameBuilds(html).some(build=>isEmbeddedPixiGame(build.code,html))){coreFiles.push(entry.relative);coreReady=true;}}catch{}
    }
    const entries = pick(/(?:^|\/)(?:index|main|game|bundle)(?:[.-][\w.-]+)?\.js$/i);
    for (const entry of entries) {
      const source = await readFile(path.join(captureRoot, entry), 'utf8').catch(() => '');
      if (!/\[pixi\.js\/(?:math|core):|\b__PIXI_RENDERER_INIT__\b|\bPIXI\.(?:Application|Renderer)\b/.test(source)) continue;
      coreFiles.push(entry);
      const declared = [...new Set(source.match(/WebGLRenderer(?:-[\w.-]+)?\.js/g) || [])];
      const directory = path.posix.dirname(entry);
      for (const name of declared) {
        const renderer = `${directory}/${name}`;
        if (!paths.includes(renderer)) continue;
        const text = await readFile(path.join(captureRoot, renderer), 'utf8').catch(() => '');
        if (/\bWebGLRenderer\b/.test(text) && /\.getContext\s*\(\s*["']webgl2?["']/.test(text)) {
          coreFiles.push(renderer);
          coreReady = true;
        }
      }
      // A split build must retain its declared renderer; a bundled release
      // can contain the renderer directly in the same entry file.
      if (!declared.length && /\bWebGLRenderer\b/.test(source) && /\.getContext\s*\(\s*["']webgl2?["']/.test(source)) coreReady = true;
    }
    coreRule = "需要 PixiJS 游戏入口和有效 renderer；支持经解压校验且内含运行库、启动代码及图片资源的单文件 HTML 构建";
  } else if (detection.engine === "LayaAir 3D") {
    const entryPattern = /(?:^|\/)(?:bundle|index|main|game)(?:\d+|[.-][\w.-]+)?(?:\.min)?\.js$/i;
    const runtimePattern = /(?:^|\/)laya\.(?:core|d3)(?:\.min)?\.js$/i;
    coreFiles = [...pick(entryPattern), ...pick(runtimePattern)];
    coreReady = coreFiles.some(value => entryPattern.test(value)) && coreFiles.some(value => runtimePattern.test(value));
    coreRule = "需要 Laya 运行库与 index/main/bundle 游戏入口脚本";
  } else if (detection.engine === "Unity WebGL") {
    const loaderPattern = /(?:\.loader|\/UnityLoader)\.js$/i;
    const wasmPattern = /\.wasm(?:\.code)?(?:\.unityweb)?(?:\.(?:gz|br))?$/i;
    const dataPattern = /\.data(?:\.unityweb)?(?:\.(?:gz|br))?$/i;
    const allCode = snippets.join("\n");
    const requiresData = /\bdataUrl\s*[:=]/i.test(allCode) || dataPattern.test(allCode);
    coreFiles = [...pick(loaderPattern), ...pick(wasmPattern), ...pick(dataPattern)];
    // Unity 2019's nameFilesAsHashes build option removes every semantic
    // filename. Resolve the JSON passed to instantiate, rather than borrowing
    // unrelated .wasm/.data files or accepting an SDK's Unity name mention.
    const records = new Map((manifest.resources || []).filter(r => r.saved && r.path)
      .map(r => [r.path.replaceAll("\\", "/"), r]));
    const sourceUrl = file => records.get(file.relative)?.url ||
      (file.relative.startsWith('game/') ? `https://${file.relative.slice(5)}` : manifest.gameUrl);
    const canonical = value => { const url = new URL(value); url.hash = ''; return url.href; };
    const byUrl = new Map();
    for (const file of files) {
      try { byUrl.set(canonical(sourceUrl(file)), file); } catch {}
    }
    const declaredConfigs = new Map();
    let hasLegacyLoader = false;
    for (const file of files.filter(file => /\.(?:js|mjs|html?)$/i.test(file.relative))) {
      if ((await stat(file.full).catch(() => ({size: Infinity}))).size > 8 * 1024 * 1024) continue;
      const source = await readFile(file.full, 'utf8').catch(() => '');
      if (/\b(?:var|let|const)\s+UnityLoader\s*=/.test(source) && /\binstantiate\s*:/.test(source)) {
        hasLegacyLoader = true;
        coreFiles.push(file.relative);
      }
      for (const match of source.matchAll(/\bUnityLoader\.instantiate\s*\(\s*[^,\r\n]+,\s*["']([^"']+\.json(?:\?[^"']*)?)["']/g)) {
        try {
          const url = new URL(match[1], sourceUrl(file));
          declaredConfigs.set(canonical(url.href), byUrl.get(canonical(url.href)));
        } catch {}
      }
    }
    const hasLoader = coreFiles.some(value => loaderPattern.test(value));
    const hasWasm = coreFiles.some(value => wasmPattern.test(value));
    const hasData = coreFiles.some(value => dataPattern.test(value));
    coreReady = hasLoader && hasWasm && (!requiresData || hasData);
    coreRule = requiresData
      ? "需要 Loader、WASM 与 Data 构建产物（支持 .data.unityweb）"
      : "需要 Loader 与 WASM 构建产物（支持 UnityLoader.js 和 .wasm.code.unityweb）";
    if (declaredConfigs.size) {
      coreReady = false;
      coreRule = '需要 Unity 加载器及其实际声明的构建清单、有效 WASM、Data 和 Framework（支持哈希文件名）';
      for (const [configUrl, configFile] of declaredConfigs) {
        if (!configFile || (await stat(configFile.full)).size > 1024 * 1024) continue;
        let config;
        try { config = JSON.parse(await readFile(configFile.full, 'utf8')); } catch { continue; }
        if (!config || typeof config !== 'object' || typeof config.wasmCodeUrl !== 'string' ||
            typeof config.dataUrl !== 'string' || typeof config.wasmFrameworkUrl !== 'string') continue;
        coreFiles.push(configFile.relative);
        let ready = hasLoader || hasLegacyLoader;
        for (const [key, kind] of [['wasmCodeUrl', 'wasm'], ['dataUrl', 'data'], ['wasmFrameworkUrl', 'framework']]) {
          let dependency;
          try { dependency = byUrl.get(canonical(new URL(config[key], configUrl).href)); } catch {}
          if (!dependency) { ready = false; continue; }
          coreFiles.push(dependency.relative);
          try {
            const size = (await stat(dependency.full)).size;
            if (!size || size > 160 * 1024 * 1024) { ready = false; continue; }
            const body = await readFile(dependency.full);
            if (kind === 'wasm') {
              const decoded = tryDecodeWasm(body);
              if (!decoded || !WebAssembly.validate(decoded)) ready = false;
            } else if (kind === 'data') {
              const decoded = tryDecodeUnityWebData(body);
              const magicLength = Buffer.byteLength('UnityWebData1.0\0');
              if (!decoded) { ready = false; continue; }
              const headerSize = decoded.readUInt32LE(magicLength);
              let cursor = magicLength + 4;
              if (headerSize <= cursor || headerSize > decoded.length) { ready = false; continue; }
              while (cursor < headerSize) {
                if (cursor + 12 > headerSize) { ready = false; break; }
                const offset = decoded.readUInt32LE(cursor), length = decoded.readUInt32LE(cursor + 4);
                const nameLength = decoded.readUInt32LE(cursor + 8);
                cursor += 12;
                if (!nameLength || cursor + nameLength > headerSize || offset < headerSize ||
                    offset + length > decoded.length) { ready = false; break; }
                cursor += nameLength;
              }
            } else if (!decodedCandidates(body).some(decoded =>
              /\b(?:function|var)\s+(?:unityFramework|Module)\b|\b(?:asmLibraryArg|wasmMemory|wasmTable|WebAssembly|Module\s*\[)/.test(decoded.toString('utf8')))) ready = false;
          } catch { ready = false; }
        }
        if (ready) coreReady = true;
      }
    }
  } else if (detection.engine === "Cocos Creator") {
    // Creator release builds append a dot-separated content version, e.g.
    // main.351cd.js and assets/main/index.a9410.js.
    const entryPattern = /(?:^|\/)(?:game|index|application|bundle|main)(?:[.-][\w.-]+)?(?:\.min)?\.js$/i;
    const runtimePattern = /(?:^|\/)(?:cocos[^/]*|cocoslib[^/]*|cc(?:[.-][\w.-]+)?)\.js$/i;
    const runtimes = pick(runtimePattern);
    const runtimeHosts = new Set(runtimes.map(r => r.split('/')[1]).filter(Boolean));
    const entries = pick(entryPattern).filter(entry => runtimeHosts.size === 0 || runtimeHosts.has(entry.split('/')[1]) || (native && entry.split('/')[1] === urlHost(manifest.gameUrl)));
    coreFiles = [...entries, ...runtimes];
    coreReady = coreFiles.some(value => entryPattern.test(value)) && coreFiles.some(value => runtimePattern.test(value));
    coreRule = "需要 Cocos 运行库与游戏入口脚本";
  } else if (detection.engine === "PlayCanvas") {
    const runtimePattern = /(?:^|\/)playcanvas(?:-[\w.-]+)?(?:\.min)?\.js$/i;
    const entryPattern = /(?:^|\/)(?:__start__|__game-scripts|game|bundle|main)(?:\.min)?\.js$/i;
    const runtimes=pick(runtimePattern),roots=runtimes.map(value=>path.posix.dirname(value));
    coreFiles = [...runtimes, ...pick(entryPattern).filter(value=>roots.some(root=>value.startsWith(root+'/')))];
    coreReady = coreFiles.some(value => runtimePattern.test(value)) && coreFiles.some(value => entryPattern.test(value));
    coreRule = "需要 PlayCanvas 运行库与游戏启动/业务脚本；Ammo WASM 仅代表物理依赖";
  } else if (detection.engine === "Construct") {
    const runtimePattern = /(?:^|\/)(?:c3runtime|c2runtime|c3main)(?:\.min)?\.js$/i;
    const runtimes = pick(runtimePattern);
    const roots = runtimes.map(value => path.posix.dirname(value));
    const entryPattern = /(?:^|\/)(?:c3runtime|c2runtime|c3main|main)(?:\.min)?\.js$/i;
    coreFiles = runtimes.length > 0
      ? [...runtimes, ...pick(entryPattern).filter(value => roots.some(root => value.startsWith(root + "/")))]
      : pick(entryPattern);
    coreReady = coreFiles.some(value => runtimePattern.test(value));
    coreRule = "需要 Construct 运行库（c3main.js / c3runtime.js / c2runtime.js）与主脚本";
  } else if (detection.engine === "Phaser") {
    coreFiles = pick(/(?:runtime|game|bundle|main)(?:\.min)?\.js$/i);
    coreReady = coreFiles.length > 0;
    coreRule = "需要引擎运行时或主业务脚本";
  } else if (detection.engine === "GameMaker HTML5") {
    // 新版（WASM runner）导出把运行时拆成同目录的 runner.js / runner.wasm
    // 与基于 FORM…GEN8 的 game.unx 数据包；runner.data 常常只是一个空占位，
    // 不能按体积当作缺件。老版导出沿用 html5game/ 下的单文件主构建 +
    // 同目录贴图音效（bqh_YaGames.js 之类的扩展脚本不能单独当核心）。
    const wasmRunners = pick(/(?:^|\/)runner\.wasm$/i);
    if (wasmRunners.length) {
      const runtimeDirectory = path.posix.dirname(wasmRunners[0]);
      const siblings = pattern => paths.filter(value =>
        path.posix.dirname(value) === runtimeDirectory && pattern.test(path.posix.basename(value)));
      const loader = siblings(/^runner\.js$/i);
      const dataPackage = siblings(/^runner\.data$/i);
      const gameData = siblings(/^game\.(?:unx|win|droid)$/i);
      const payload = siblings(/^[^/]+\.(?:dat|ogg|mp3|m4a|wav|png)$/i);
      const dataBytes = gameData.length
        ? await stat(path.join(captureRoot, gameData[0])).then(info => info.size).catch(() => 0)
        : 0;
      coreFiles = [...loader, ...wasmRunners, ...dataPackage, ...gameData, ...payload];
      coreReady = loader.length > 0 && dataBytes > 64 * 1024;
      coreRule = "需要 GameMaker WASM 运行时的 runner.js、runner.wasm 与有效的 game.unx 数据包（runner.data 允许是空占位）";
    } else {
      const builds = pick(/(?:^|\/)html5game\/[^/]+\.js$/i);
      const mains = [];
      for (const build of builds) {
        const source = await readFile(path.join(captureRoot, build), 'utf8').catch(() => '');
        if (/\bApplication Surface (?:created|resized)\b|\bEntering main loop\.\.\./.test(source)) mains.push(build);
      }
      const payload = pick(/(?:^|\/)html5game\/[^/]+\.(?:png|ogg|mp3|m4a|wav)$/i);
      coreFiles = [...mains, ...payload];
      coreReady = mains.length > 0;
      coreRule = "需要 html5game/ 下的 GameMaker 运行时主构建（内含 Application Surface / 主循环标记）及同目录贴图音效";
    }
  }
  return { engine: detection.engine, confidence: detection.confidence, evidence: detection.evidence, coreFiles: [...new Set(coreFiles)], coreReady, coreRule };
}

function uniqueMatches(text, expression, limit = 500) {
  const values = new Set();
  for (const match of text.matchAll(expression)) { values.add(match[1] || match[0]); if (values.size >= limit) break; }
  return [...values];
}

export async function analyzeCapturedGame(captureRoot, manifest, onEvent = () => {}) {
  const emit = (message, details = {}) => onEvent({ time: new Date().toISOString(), type: "analysis", message, ...details });
  const analysisRoot = path.join(captureRoot, "analysis");
  const wasmRoot = path.join(analysisRoot, "wasm");
  const unityDataRoot = path.join(analysisRoot, "unity-data");
  const il2cppRoot = path.join(analysisRoot, "il2cpp");
  const scriptsRoot = path.join(captureRoot, "scripts");
  await Promise.all([
    rm(wasmRoot, { recursive: true, force: true }),
    rm(unityDataRoot, { recursive: true, force: true }),
    rm(il2cppRoot, { recursive: true, force: true })
  ]);
  await Promise.all([mkdir(analysisRoot, { recursive: true }), mkdir(wasmRoot, { recursive: true }), mkdir(unityDataRoot, { recursive: true }), mkdir(scriptsRoot, { recursive: true })]);
  emit("开始解析归档源码与运行时资源");
  const files = await walk(captureRoot);
  const candidates = files.filter(file => file.relative === "index.html" || file.relative.startsWith("game/"));
  const textFiles = [], wasmFiles = [], unityDataFiles = [], symbols = [], inlineBuilds=[];
  const automationTerms = new Map();
  for (const file of candidates) {
    const extension = path.extname(file.full).toLowerCase();
    let buffer; try { buffer = await readFile(file.full); } catch { continue; }
    if(/\.html?$/i.test(file.relative)&&buffer.length<=8*1024*1024&&['game','game-core'].includes(classifySourceFile(file.relative,manifest))){
      for(const build of inlineGameBuilds(buffer.toString('utf8'))){
        if(inlineBuilds.some(b=>b.sha256===build.sha256))continue;
        const relative=`analysis/inline-builds/${build.sha256}.js`;
        await mkdir(path.join(captureRoot,'analysis/inline-builds'),{recursive:true});
        await writeFile(path.join(captureRoot,relative),build.code);
        const ast=await writeJavaScriptIndex(captureRoot,relative);
        const terms=uniqueMatches(build.code,AUTOMATION_TERMS,100).map(v=>v.toLowerCase());
        const functions=uniqueMatches(build.code,/(?:function\s+|class\s+)([$A-Z_a-z][$\w]*)/g,300);
        const scope=classifySourceFile(file.relative,manifest);
        textFiles.push({file:relative,bytes:Buffer.byteLength(build.code),extension:'.js',scope,derivedFrom:file.relative,functionsOrClasses:functions.length,automationTerms:terms,ast});
        symbols.push({file:relative,functions,automationTerms:terms,ast});
        for(const term of terms)automationTerms.set(term,(automationTerms.get(term)||0)+1);
        inlineBuilds.push({file:relative,derivedFrom:file.relative,compression:build.compression,compressedBytes:build.compressedBytes,sha256:build.sha256});
      }
    }
    const unityData = buffer.length <= 160 * 1024 * 1024 ? tryDecodeUnityWebData(buffer) : null;
    if (unityData) {
      const safeBase = path.basename(file.relative).replace(/[^a-z0-9._-]+/gi, "_").replace(/\.(?:unityweb|data)$/i, "") || "unity-data";
      const outputDirectory = path.join(unityDataRoot, safeBase);
      try {
        const extracted = await extractUnityWebData(unityData, outputDirectory, file.relative);
        const metadataEntry = extracted.entries.find(entry => /(?:^|\/)global-metadata\.dat$/i.test(entry.name));
        unityDataFiles.push({
          file: file.relative,
          bytes: unityData.length,
          compressed: unityData !== buffer,
          extractedDirectory: path.relative(analysisRoot, outputDirectory).replaceAll("\\", "/"),
          files: extracted.files,
          metadataFile: metadataEntry ? path.join(outputDirectory, ...metadataEntry.name.split("/")) : null,
          metadataRelative: metadataEntry ? `${path.relative(analysisRoot, outputDirectory).replaceAll("\\", "/")}/${metadataEntry.name}` : null
        });
        emit(`已解包 Unity 数据：${extracted.files} 个文件`, { source: file.relative });
      } catch (error) {
        unityDataFiles.push({ file: file.relative, bytes: unityData.length, error: error.message });
      }
      continue;
    }
    const wasm = buffer.length <= 96 * 1024 * 1024 ? tryDecodeWasm(buffer) : null;
    if (wasm) {
      const safeName = file.relative.replace(/[^a-z0-9._-]+/gi, "_").slice(-150);
      const extractedFile = `wasm/${safeName}.wasm`;
      const summaryFile = `wasm/${safeName}.summary.json`;
      const outputFile = path.join(analysisRoot, extractedFile);
      await writeFile(outputFile, wasm);
      try { await writeFile(path.join(analysisRoot, summaryFile), JSON.stringify(summarizeWasm(wasm), null, 2)); } catch {}
      wasmFiles.push({ file: file.relative, bytes: wasm.length, compressed: wasm !== buffer, extractedFile, summaryFile, outputFile });
      continue;
    }
    if (!TEXT_EXTENSIONS.has(extension) || buffer.length > 12 * 1024 * 1024) continue;
    const scope = classifySourceFile(file.relative, manifest);
    const text = buffer.toString("utf8"), record = { file: file.relative, bytes: buffer.length, extension, scope };
    if ([".js", ".mjs", ".cjs", ".html"].includes(extension)) {
      const functions = uniqueMatches(text, /(?:function\s+|class\s+)([$A-Z_a-z][$\w]*)/g, 300);
      const terms = uniqueMatches(text, AUTOMATION_TERMS, 100).map(value => value.toLowerCase());
      record.functionsOrClasses = functions.length; record.automationTerms = terms;
      if (["game-core", "game"].includes(scope)) {
        const ast=[".js",".mjs",".cjs"].includes(extension)?await writeJavaScriptIndex(captureRoot,file.relative):null;
        if(ast)record.ast=ast;
        if (functions.length || terms.length || ast) symbols.push({ file: file.relative, functions, automationTerms: terms,...(ast?{ast}:{}) });
        for (const term of terms) automationTerms.set(term, (automationTerms.get(term) || 0) + 1);
      }
    }
    textFiles.push(record);
  }
  let wasmConverted = 0;
  if (wasmFiles.length) {
    const wabt = await wabtFactory();
    for (const item of wasmFiles) {
      if (item.bytes > 32 * 1024 * 1024) {
        item.watSkippedReason = "模块超过 32 MiB；完整 WAT 通常会膨胀数倍，已改用 IL2CPP 结构化解析";
        continue;
      }
      try {
        const bytes = await readFile(path.join(analysisRoot, item.extractedFile));
        const module = wabt.readWasm(bytes, { readDebugNames: true, exceptions: true }); module.generateNames(); module.applyNames();
        const watFile = item.extractedFile.replace(/\.wasm$/, ".wat");
        await writeFile(path.join(analysisRoot, watFile), module.toText({ foldExprs: false, inlineExport: false }));
        module.destroy(); item.watFile = watFile; wasmConverted += 1;
      } catch (error) { item.watError = error.message; }
    }
  }
  const scoped = await runtimeScope(captureRoot,candidates,manifest);
  const scopedText = await Promise.all(scoped.files.filter(f=>/\.(?:js|mjs|html?)$/i.test(f.relative)).map(f=>readFile(f.full,'utf8').then(s=>s.slice(0,2*1024*1024)+'\n'+(/\.html?$/i.test(f.relative)?inlineGameBuilds(s).map(b=>b.code).join('\n'):'')).catch(()=>'')));
  const detection = detectEngine(scoped.files, scopedText.join("\n"));
  const engine = detection.engine;
  let emscriptenData;
  if(engine==='Fancade / Emscripten' || engine==='Emscripten') {
    let loader=scoped.files.find(f=>f.relative.endsWith('/webapp/index.js'));
    if (!loader && engine==='Emscripten') {
      for (const file of scoped.files.filter(f=>/\.js$/i.test(f.relative))) {
        const source=await readFile(file.full,'utf8').catch(()=>'');
        if (/\bREMOTE_PACKAGE_BASE\s*=/.test(source) && /\bloadPackage\s*\(/.test(source)) {loader=file;break;}
      }
    }
    if(loader) {try {emscriptenData=await analyzeEmscriptenData(captureRoot,loader.relative);emit(`Emscripten Data 已提取 ${emscriptenData.files.length} 个内嵌文件`);}catch(error){emscriptenData={status:'failed',reason:error.message};emit(`Emscripten Data 解包失败：${error.message}`);}}
  }
  let construct;
  if (engine === "Construct") {
    emit("开始静态解码 Construct 对象引用、布局与事件表");
    construct = await analyzeConstruct(captureRoot, scoped.files);
    emit(`Construct ${construct.status === "decoded" ? "事件解码完成" : "部分解析"}：${construct.counts.objectTypes} 个对象类型、${construct.counts.layouts} 个布局、${construct.counts.conditions} 个条件、${construct.counts.actions} 个动作，${construct.warnings.length} 个未识别项`);
  }
  let il2cpp = { status: "not-applicable" };
  const primaryWasm = wasmFiles[0];
  const primaryMetadata = unityDataFiles.find(item => item.metadataFile);
  if (engine === "Unity WebGL" && primaryWasm && primaryMetadata) {
    emit("已找到 Unity IL2CPP 的 WASM 与 global-metadata.dat，开始生成类、字段和方法表");
    il2cpp = await runIl2CppAnalysis(primaryWasm.outputFile, primaryMetadata.metadataFile, il2cppRoot);
    emit(il2cpp.status === "completed" ? `IL2CPP 解析完成：识别 ${il2cpp.gameplayClasses} 个可能的游戏业务类` : `IL2CPP 解析未完成：${il2cpp.reason || il2cpp.log || "未知错误"}`);
  } else if (engine === "Unity WebGL") {
    il2cpp = { status: "missing-input", reason: `缺少${primaryWasm ? " global-metadata.dat" : " WASM"}` };
  }
  const prioritizedScripts = textFiles
    .filter(item => ["game-core", "game"].includes(item.scope) && [".js", ".mjs", ".cjs", ".html"].includes(item.extension))
    .map(item => ({
      ...item,
      priority: (item.scope === "game-core" ? 100 : 50) + (item.automationTerms?.length || 0) * 5 + Math.min(20, Math.round(item.bytes / 100000))
    }))
    .sort((a, b) => b.priority - a.priority);
  const publicWasmFiles = wasmFiles.map(({ outputFile, ...item }) => ({ ...item, ...(engine === 'Construct' && /(?:^|\/)opus(?:\.|\/)/i.test(item.file) ? { role: 'audio-codec' } : {}) }));
  const publicUnityDataFiles = unityDataFiles.map(({ metadataFile, ...item }) => item);
  const gameTextSources = textFiles.filter(item => ["game-core", "game"].includes(item.scope)).length;
  const ignoredNoiseSources = textFiles.filter(item => item.scope === "noise").length;
  const levelSummary = await analyzeLevelSummary(captureRoot, textFiles);
  const report = {
    levelSummary,
    version: 4,
    generatedAt: new Date().toISOString(),
    engine,
    engineConfidence: detection.confidence,
    engineEvidence: detection.evidence,
    engineCandidates: detection.candidates,
    captureRoot,
    analysisRoot,
    counts: {
      files: candidates.length,
      textSources: textFiles.length,
      gameTextSources,
      ignoredNoiseSources,
      wasmModules: wasmFiles.length,
      watGenerated: wasmConverted,
      unityDataPackages: unityDataFiles.length,
      unityDataExtractedFiles: unityDataFiles.reduce((sum, item) => sum + (item.files || 0), 0),
      il2cppGameplayClasses: il2cpp.gameplayClasses || 0,
      ...(construct ? { constructEventBlocks: construct.counts.eventBlocks, constructConditions: construct.counts.conditions, constructActions: construct.counts.actions, constructUnresolved: construct.warnings.length } : {})
    },
    prioritizedScripts,
    wasmFiles: publicWasmFiles,
    unityDataFiles: publicUnityDataFiles,
    il2cpp,
    ...(inlineBuilds.length?{inlineBuilds}:{}),
    ...(emscriptenData ? {emscriptenData} : {}),
    ...(construct ? { construct } : {}),
    automationKeywords: [...automationTerms].map(([name, count]) => ({ name, files: count })).sort((a, b) => b.files - a.files),
    limitations: engine === "Construct"
      ? "这是 Construct 发布模型与运行库的静态解码。保留事件顺序、子事件、对象筛选目标与原始数据位置；未识别项明确列出。不能保证恢复原始变量名、注释或可重新编辑的 .capx/.c3p 工程；静态解码完成不代表实机玩法已验证。"
      : engine === "Unity WebGL"
        ? "这是对发布产物的静态整理和反编译，不等同于开发者原始 Unity 工程。IL2CPP 可以恢复类、字段、方法签名及 WASM 方法映射，但不能恢复原始变量名、注释和完整 C# 方法体。"
        : "这是发布文件的静态索引与运行时资源分析，不等同于开发者原始工程或完整业务逻辑还原。"
  };
  await writeFile(path.join(analysisRoot, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(analysisRoot, "source-index.json"), JSON.stringify({ textFiles, symbols, ...(construct ? { construct: { format: construct.format, counts: construct.counts, files: construct.files } } : {}) }, null, 2));
  const automationContext = { engine, prioritizedScripts: prioritizedScripts.slice(0, 30), wasmFiles: publicWasmFiles, unityDataFiles: publicUnityDataFiles, il2cpp, ...(emscriptenData ? {emscriptenData} : {}), ...(construct ? { construct } : {}), keywords: report.automationKeywords };
  await writeFile(path.join(analysisRoot, "automation-context.json"), JSON.stringify(automationContext, null, 2));
  await writeFile(path.join(scriptsRoot, "automation-context.json"), JSON.stringify(automationContext, null, 2));
  // 上面那份只是文件清单，写 bot 需要的是方法表索引和字段偏移，单独产出一份。
  // 非 IL2CPP 的归档会自行跳过，不影响解析主流程。
  const botKit = engine === 'Construct'
    ? { status: 'not-applicable', reason: 'Construct 对象、事件和行为索引见 construct/project.json，无需 IL2CPP 桥接。' }
    : await writeBotKit(captureRoot, onEvent).catch(error => ({ status: "failed", reason: error.message }));
  report.botKit = botKit;
  await writeFile(path.join(analysisRoot, "report.json"), JSON.stringify(report, null, 2));
  const readme = ["# 游戏发布源码分析", "", "原始发布文件保留在 ../game/，本目录保存分析产物。", "", `- 引擎：${engine}（${detection.confidence}）`, `- 游戏相关文本文件：${gameTextSources}；全部文本：${textFiles.length}；噪声：${ignoredNoiseSources}`, `- WASM 模块：${wasmFiles.length}；已生成 WAT：${wasmConverted}`, "", "## 分析范围", "", report.limitations, "", "## 产物", "", "- report.json：总报告与解析范围", "- source-index.json：文件、作用域和符号索引", "- automation-context.json：后续分析入口与文件索引", "- wasm/：WASM 副本、结构摘要与 WAT（存在 WASM 时）"];
  if (construct) {
    readme.push("", `- Construct 状态：${construct.status === "decoded" ? "事件解码完成" : "部分解析"}`, `- 对象类型：${construct.counts.objectTypes}；对象族：${construct.counts.families}；布局：${construct.counts.layouts}；正整数命名布局：${construct.counts.numericLayouts}`, `- 事件表：${construct.counts.eventSheets}；事件/组：${construct.counts.eventBlocks}；条件：${construct.counts.conditions}；动作：${construct.counts.actions}`, `- 可定位的方法体：${construct.counts.methodBodies}/${construct.counts.objectReferences} 个引用`, `- 未识别项：${construct.warnings.length}（见 construct/summary.json）`, "- construct/summary.json：来源哈希、覆盖范围和未识别项");
    if (construct.files.project) readme.push("- construct/project.json：对象、实例、行为参数、布局和完整事件树；含原始数据与 JSON 位置", "- construct/events.md：按顺序还原的可读条件/动作", "- construct/object-references.json：引用索引、真实运行库名称及可定位的方法体");
  }
  if (engine === "Unity WebGL") {
    readme.push(`- Unity data 包：${unityDataFiles.length}；解包文件：${report.counts.unityDataExtractedFiles}`, `- IL2CPP：${il2cpp.status}`, "- unity-data/：Unity 数据包与 metadata", "- il2cpp/：类、字段、方法签名和 WASM 方法映射");
    if (botKit.status === "ok") readme.push("- bot/：IL2CPP 方法索引与桥接运行时");
  }
  await writeFile(path.join(analysisRoot, "README.md"), readme.join("\n") + "\n");
  // A re-analysis must not overwrite an existing game's hand-maintained automation guide.
  try { await writeFile(path.join(scriptsRoot, "AUTOMATION.md"), "# 自动化脚本准备目录\n\nautomation-context.json 记录分析入口。自动化脚本请保存在 scripts/。\n", { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  emit(`源码解析完成：${gameTextSources} 个游戏文本源码，${wasmFiles.length} 个 WASM，${report.counts.unityDataExtractedFiles} 个 Unity 解包文件，识别引擎 ${engine}`, { analysisRoot });
  return report;
}
