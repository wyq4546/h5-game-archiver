import { readLevelSummary } from './level-summary.mjs';
import { captureLocalPreview } from "./local-preview.mjs";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assessCompleteness, captureGame } from "./capture.mjs";
import { analyzeCapturedGame, inspectCapturedRuntime } from "./source-analysis.mjs";
import { importApkArchive } from "./apk-importer.mjs";
import { analyzeApkGame } from "./apk-analysis.mjs";
import { ArchiveStore } from "./archive-store.mjs";
import { readArchivePreview, readArchiveScreenshot, openArchiveFolder, openVideoFolder, resolveArchiveDirectory, startGameRecording, stopGameRecording, isGameRecording } from "./archive-actions.mjs";
import { readCover, saveCover } from "./archive-cover.mjs";

const previewTasks = new Set();
const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
let downloadRoot = path.resolve(publicRoot, "../download");
let store;
const jobSavedAt = new Map();
function saveJob(job, force = false) {
  if (force || Date.now() - (jobSavedAt.get(job.id) || 0) >= 1000) {
    store.saveJob(job);
    jobSavedAt.set(job.id, Date.now());
  }
}
const analyzerRoot = path.resolve(publicRoot, "../integrations/xapk-analyzer");
const analyzerUrl = "http://127.0.0.1:41741";
const jobs = new Map();
const controllers = new Map();
let activeJobId;
let activeAnalysisJobId;
let analyzerProcess;
let analyzerError = "";
const authStatePath = path.resolve(publicRoot, "../auth-state.json");
let loginBrowser = null;
let loginContext = null;

function startAnalyzer() {
  if (analyzerProcess && analyzerProcess.exitCode === null) return;
  const python = path.join(analyzerRoot, ".venv", "Scripts", "python.exe");
  if (!existsSync(python)) {
    analyzerError = `Python 环境不存在：${python}`;
    return;
  }
  analyzerError = "";
  analyzerProcess = spawn(python, ["run.py"], { cwd: analyzerRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  analyzerProcess.stdout.on("data", chunk => process.stdout.write(`[XAPK] ${chunk}`));
  analyzerProcess.stderr.on("data", chunk => {
    const message = chunk.toString();
    process.stderr.write(`[XAPK] ${message}`);
    analyzerError = message.trim().slice(-1000);
  });
  analyzerProcess.once("exit", code => {
    if (code && !analyzerError) analyzerError = `分析器退出，代码 ${code}`;
  });
}

async function analyzerStatus() {
  try {
    const response = await fetch(`${analyzerUrl}/api/health`, { signal: AbortSignal.timeout(1200) });
    const health = response.ok ? await response.json() : {};
    return { running: response.ok && health.name === "xapk-analyzer", url: analyzerUrl, pid: health.pid || null, version: health.version || null, error: response.ok ? "" : `HTTP ${response.status}` };
  } catch {
    return { running: false, url: analyzerUrl, pid: analyzerProcess?.pid || null, error: analyzerError || "分析器正在启动" };
  }
}

function json(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store"
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function validateCapture(input) {
  let url;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error("请输入有效的游戏 URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("仅支持 HTTP 和 HTTPS 地址");
  if (input.acknowledgeRights !== true) throw new Error("请先确认你有权归档此内容");
  return {
    url: url.href,
    duration: null,
    idleTimeoutSeconds: 30,
    headless: input.headless === true,
    acknowledgeRights: true,
    output: downloadRoot,
    // 默认开启：不点一下开始，游戏会停在等待输入的界面，而那里没有网络流量，
    // 抓取会在游戏真正开始前就判定空闲停止，丢掉开始按钮之后的全部资源。
    interact: input.interact !== false,
    interactClicks: 3
  };
}

async function serveFile(response, filename, contentType) {
  try {
    const body = await readFile(path.join(publicRoot, filename));
    response.writeHead(200, { "content-type": contentType, "content-length": body.length, "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}

function archiveRoot(name) {
  if (!name || name !== path.basename(name)) throw new Error("归档名称无效");
  const root = path.resolve(downloadRoot, name);
  if (!root.startsWith(`${downloadRoot}${path.sep}`)) throw new Error("归档路径超出 download 目录");
  return root;
}

// Mini-game sources are keyed by normalized URL so re-registering the same link
// updates the existing record instead of stacking duplicates.
function sourceKey(value) {
  try {
    const url = new URL(value);
    return `${url.origin.toLowerCase()}${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch { return String(value || "").trim().toLowerCase(); }
}
function decorateMinigame(record, byUrl, byName) {
  const archive = (record.archiveName && byName.get(record.archiveName)) || byUrl.get(sourceKey(record.sourceUrl)) || null;
  if (!archive) return { ...record, linked: null };
  return {
    ...record,
    linked: {
      name: archive.name,
      title: archive.title,
      capturedAt: archive.capturedAt,
      engine: archive.engine,
      savedResources: archive.savedResources,
      completeness: archive.completeness?.status ?? null,
      analysis: !!archive.analysis,
      analysisEngine: archive.analysis?.engine ?? null,
      levelSummary: archive.levelSummary ?? null,
      recording: archive.recording ? { status: archive.recording.status, videoCount: archive.recording.videoCount, targetLevels: archive.recording.targetLevels } : null
    }
  };
}

let scheduledGamesMap = null;
async function getScheduledGamesMap() {
  if (scheduledGamesMap) return scheduledGamesMap;
  try {
    const jsonPath = path.resolve(publicRoot, '../scripts/scheduled-games.json');
    const list = JSON.parse(await readFile(jsonPath, 'utf8'));
    scheduledGamesMap = new Map(list.map(g => [g.id, g]));
  } catch {
    scheduledGamesMap = new Map();
  }
  return scheduledGamesMap;
}

async function scanArchiveRecording(archiveName, root, scheduledMap) {
  const {scanVerifiedRecordingBatches}=await import('./recording-status.mjs');
  const verified=await scanVerifiedRecordingBatches(root);
  const targetLevels = verified?.nativeTotal||scheduledMap.get(archiveName)?.targetLevels || 100;
  const dirs = [
    path.join(root, 'scripts', 'video'),
    path.join(root, 'video')
  ];
  let fallbackVideoCount = 0;
  let isRecording = isGameRecording(archiveName);
  let lastRecordedAt = null;
  const levelSet = new Set();
  let maxLevel = 0;

  for (const dir of dirs) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { continue; }
    async function walk(cur, list) {
      for (const ent of list) {
        const full = path.join(cur, ent.name);
        if (ent.isDirectory()) {
          if(['rejected','persistence-replays'].includes(ent.name.toLowerCase()))continue;
          try { await walk(full, await readdir(full, { withFileTypes: true })); } catch {}
        } else if (ent.isFile()) {
          const l = ent.name.toLowerCase();
          const isVideo = l.endsWith('.mp4');
          if (isVideo || l.endsWith('.webm') || l.endsWith('.part')) {
            try {
              const st = await stat(full);
              if (Date.now() - st.mtimeMs < 45000) isRecording = true;
              if (isVideo && st.size >= 100 * 1024) {
                if (!lastRecordedAt || st.mtimeMs > lastRecordedAt) lastRecordedAt = st.mtimeMs;
                const m = ent.name.match(/level-0*(\d+)/i);
                if (m) {
                  const num = Number(m[1]);
                  levelSet.add(num);
                  if (num > maxLevel) maxLevel = num;
                } else {
                  fallbackVideoCount++;
                }
              }
            } catch {}
          }
        }
      }
    }
    await walk(dir, entries);
  }

  const effectiveCount = verified?.videoCount??(levelSet.size > 0 ? levelSet.size : fallbackVideoCount);
  if(verified){maxLevel=verified.maxLevel;lastRecordedAt=verified.lastRecordedAt;}
  let status = 'idle';
  if (isRecording) status = 'recording';
  else if (effectiveCount >= targetLevels && effectiveCount > 0) status = 'completed';
  else if (effectiveCount > 0) status = 'in_progress';

  return {
    status,
    isRecording,
    videoCount: effectiveCount,
    maxLevel,
    targetLevels,
    lastRecordedAt: lastRecordedAt ? new Date(lastRecordedAt).toISOString() : null
  };
}

async function listArchives() {
  let entries;
  try { entries = await readdir(downloadRoot, { withFileTypes: true }); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    return store.listArchives();
  }
  const scheduledMap = await getScheduledGamesMap();
  const archives = [];
  for (const entry of entries.filter(item => item.isDirectory())) {
    const root = archiveRoot(entry.name);
    try {
      const manifest = JSON.parse(await readFile(path.join(root, "archive", "manifest.json"), "utf8"));
      // Captures already save this result. Re-reading every JS file for every
      // archive on each list request can keep the page empty for many seconds.
      manifest.runtimeInspection ||= await inspectCapturedRuntime(root);
      let analysis = null;
      try { analysis = JSON.parse(await readFile(path.join(root, "analysis", "report.json"), "utf8")); } catch {}
      const completeness = assessCompleteness(manifest);
      const savedCover = await readCover(root).catch(() => null);
      const cover = savedCover ? {title:savedCover.title,kind:savedCover.kind,source:savedCover.source,titleMismatch:!!savedCover.titleMismatch} : null;
      const levelSummary = await readLevelSummary(root, analysis);
      archives.push({ levelSummary, cover, name: entry.name, title: manifest.resolvedGameName || manifest.gameTitle || entry.name, sourceUrl: manifest.sourceUrl || null, startedAt: manifest.startedAt || null, capturedAt: manifest.finishedAt || null, savedResources: completeness.savedResources, completeness, identityCheck: manifest.identityCheck || null, runtime: manifest.runtimeInspection, engine: manifest.runtimeInspection.engine, packageType: manifest.packageType || null, apk: manifest.apk || null, analysis: analysis ? { engine: analysis.engine, confidence: analysis.engineConfidence, counts: analysis.counts, generatedAt: analysis.generatedAt, ...(analysis.construct ? { construct: { status: analysis.construct.status, format: analysis.construct.format, counts: analysis.construct.counts, unresolved: analysis.construct.warnings?.length || 0 } } : {}) } : null, recording: await scanArchiveRecording(entry.name, root, scheduledMap) });
    } catch (error) { console.warn(`无法更新归档索引 ${entry.name}: ${error.message}`); }
  }
  store.syncArchives(archives, entries.filter(item => item.isDirectory()).map(item => item.name));
  return store.listArchives();
}

async function handle(request, response) {
  const url = new URL(request.url, "http://localhost");
  if (/^\/api\/archives\/[^/]+\/cover$/.test(url.pathname) && ['GET','POST'].includes(request.method)) {
    try {
      const root=await resolveArchiveDirectory(downloadRoot,decodeURIComponent(url.pathname.split('/')[3]));
      if(request.method==='POST') {
        if(request.headers.origin && request.headers.origin!==`http://${request.headers.host}`)return json(response,403,{error:'不允许跨站修改封面'});
        const chunks=[];let size=0;
        for await(const chunk of request){size+=chunk.length;if(size>5*1024*1024)return json(response,413,{error:'封面不能超过5 MB'});chunks.push(chunk);}
        const cover=await saveCover(root,Buffer.concat(chunks),{source:'manual'});
        return json(response,200,{ok:true,width:cover.width,height:cover.height});
      }
      const cover=await readCover(root);
      if(!cover) {
        const shot=await readArchiveScreenshot(downloadRoot, decodeURIComponent(url.pathname.split('/')[3])).catch(()=>null);
        if(!shot)return json(response,404,{error:'暂无封面，可上传游戏封面'});
        response.writeHead(200,{'content-type':'image/png','content-length':shot.bytes.length,'cache-control':'no-cache','x-content-type-options':'nosniff','x-cover-source':'screenshot'});
        return response.end(shot.bytes);
      }
      const bytes=Buffer.from(cover.image,'base64');
      response.writeHead(200,{'content-type':cover.mime,'content-length':bytes.length,'cache-control':'no-cache','x-content-type-options':'nosniff'});
      return response.end(bytes);
    }catch(error){return json(response,400,{error:error.message});}
  }
  if (request.method === "POST" && /^\/api\/archives\/[^/]+\/screenshot$/.test(url.pathname)) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return json(response,403,{error:'不允许跨站生成截图'});
    const name = decodeURIComponent(url.pathname.split('/')[3]);
    if (previewTasks.has(name)) return json(response,409,{error:'该游戏正在生成截图'});
    previewTasks.add(name);
    try {
      const root = await resolveArchiveDirectory(downloadRoot,name);
      const preview = await captureLocalPreview(root);
      return json(response,200,{ok:true,preview});
    } catch(error) { return json(response,400,{error:error.message}); }
    finally { previewTasks.delete(name); }
  }
  if (request.method === "GET" && /^\/api\/archives\/[^/]+\/preview$/.test(url.pathname)) {
    try {
      const body = await readArchivePreview(downloadRoot, decodeURIComponent(url.pathname.split('/')[3]));
      response.writeHead(200, {'content-type':'image/png','content-length':body.length,'cache-control':'no-cache','x-content-type-options':'nosniff'});
      return response.end(body);
    } catch { return json(response,404,{error:'暂无游戏截图'}); }
  }
  if (request.method === "POST" && /^\/api\/archives\/[^/]+\/start-record$/.test(url.pathname)) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return json(response,403,{error:'不允许跨站操作'});
    try {
      const name = decodeURIComponent(url.pathname.split('/')[3]);
      const scheduledMap = await getScheduledGamesMap();
      const result = await startGameRecording(downloadRoot, name, scheduledMap);
      return json(response, 200, { ok: true, ...result });
    } catch (error) { return json(response, 400, { error: `启动录制失败：${error.message}` }); }
  }
  if (request.method === "POST" && /^\/api\/archives\/[^/]+\/stop-record$/.test(url.pathname)) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return json(response,403,{error:'不允许跨站操作'});
    try {
      const name = decodeURIComponent(url.pathname.split('/')[3]);
      const result = await stopGameRecording(downloadRoot, name);
      return json(response, 200, { ok: true, ...result });
    } catch (error) { return json(response, 400, { error: `停止录制失败：${error.message}` }); }
  }
  if (request.method === "POST" && /^\/api\/archives\/[^/]+\/open-video-folder$/.test(url.pathname)) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return json(response,403,{error:'不允许跨站打开目录'});
    try {
      const result = await openVideoFolder(downloadRoot, decodeURIComponent(url.pathname.split('/')[3]));
      return json(response,200,{ok:true,...result});
    } catch (error) { return json(response,400,{error:`打开视频目录失败：${error.message}`}); }
  }
  if (request.method === "POST" && /^\/api\/archives\/[^/]+\/open-folder$/.test(url.pathname)) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return json(response,403,{error:'不允许跨站打开目录'});
    try {
      const result = await openArchiveFolder(downloadRoot, decodeURIComponent(url.pathname.split('/')[3]));
      return json(response,200,{ok:true,...result});
    } catch (error) { return json(response,400,{error:`打开失败：${error.message}`}); }
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    const analyzer = await analyzerStatus();
    return json(response, 200, {
      name: "h5-game-archiver",
      pid: process.pid,
      storage: "sqlite",
      activeTasks: [...jobs.values()].filter(job => ["running", "stopping"].includes(job.status)).length,
      analyzer
    });
  }
  if (request.method === "POST" && url.pathname === "/api/analyzer/start") {
    startAnalyzer();
    return json(response, 202, await analyzerStatus());
  }
  if (request.method === "GET" && url.pathname === "/api/minigames") {
    // Reuse the index the archive list already built: scanning every archive
    // directory here would make switching pages wait on the whole library.
    let archives = store.listArchives();
    if (!archives.length) {
      try { archives = await listArchives(); } catch (error) { console.warn(`小游戏列表无法关联归档索引: ${error.message}`); }
    }
    const byUrl = new Map(), byName = new Map();
    for (const archive of archives) {
      byName.set(archive.name, archive);
      if (archive.sourceUrl) byUrl.set(sourceKey(archive.sourceUrl), archive);
    }
    return json(response, 200, { minigames: store.listMinigames().map(record => decorateMinigame(record, byUrl, byName)) });
  }
  if (request.method === "POST" && url.pathname === "/api/minigames") {
    try {
      const input = await readJson(request);
      let parsed;
      try { parsed = new URL(String(input.url ?? "").trim()); } catch { throw new Error("请输入有效的游戏页面地址"); }
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("仅支持 HTTP 和 HTTPS 地址");
      const platform = ["h5", "wechat", "douyin", "other"].includes(input.platform) ? input.platform : "other";
      const existing = store.listMinigames().find(record => record.platform === platform && sourceKey(record.sourceUrl) === sourceKey(parsed.href));
      const now = new Date().toISOString();
      const record = existing ?? { id: randomUUID(), createdAt: now, note: "" };
      record.title = String(input.title ?? "").trim() || record.title || parsed.hostname.replace(/^www\./, "");
      record.sourceUrl = parsed.href;
      record.platform = platform;
      record.note = String(input.note ?? "").trim() || record.note || "";
      if (typeof input.archiveName === "string" && input.archiveName) record.archiveName = input.archiveName;
      record.updatedAt = now;
      store.saveMinigame(record);
      return json(response, existing ? 200 : 201, { minigame: record, updated: !!existing });
    } catch (error) { return json(response, 400, { error: error.message }); }
  }
  if (request.method === "DELETE" && /^\/api\/minigames\/[^/]+$/.test(url.pathname)) {
    try {
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      store.removeMinigame(id);
      return json(response, 200, { ok: true, id });
    } catch (error) { return json(response, 400, { error: `删除失败：${error.message}` }); }
  }
  if (request.method === "GET" && url.pathname === "/") {
    return serveFile(response, "index.html", "text/html; charset=utf-8");
  }
  if (request.method === "GET" && url.pathname === "/app.js") {
    return serveFile(response, "app.js", "application/javascript; charset=utf-8");
  }
  if (request.method === "POST" && /^\/api\/apk\/[a-f0-9]{12}\/open-folder$/.test(url.pathname)) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
      return json(response, 403, { error: "不允许跨站打开目录" });
    }
    try {
      const id = url.pathname.split("/")[3];
      const workspace = path.join(analyzerRoot, "workspace");
      await stat(path.join(workspace, id, "project.json"));
      return json(response, 200, await openArchiveFolder(workspace, id));
    } catch (error) {
      return json(response, 400, { error: `打开失败：${error.message}` });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/apk-import") {
    if (!request.headers["content-type"]?.startsWith("multipart/form-data;")) {
      return json(response, 415, { error: "请选择 APK 或 XAPK 文件" });
    }
    try {
      const webReq = new Request(`http://${request.headers.host || "127.0.0.1"}${url.pathname}`, {
        method: request.method,
        headers: request.headers,
        body: request,
        duplex: "half"
      });
      const formData = await webReq.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return json(response, 400, { error: "未接收到安装包文件" });
      }
      const originalFilename = file.name || "uploaded.apk";
      const tmpUploadDir = path.join(downloadRoot, ".tmp-upload");
      await mkdir(tmpUploadDir, { recursive: true });
      const tmpFilePath = path.join(tmpUploadDir, `upload-${Date.now()}-${originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      const fileBytes = Buffer.from(await file.arrayBuffer());
      await writeFile(tmpFilePath, fileBytes);
      try {
        const result = await importApkArchive({
          apkPath: tmpFilePath,
          originalFilename,
          downloadRoot
        });
        await listArchives();
        return json(response, 200, {
          ok: true,
          archiveName: result.archiveName,
          project_id: result.archiveName,
          gameTitle: result.gameTitle,
          engine: result.engine
        });
      } finally {
        await rm(tmpFilePath, { force: true }).catch(() => {});
      }
    } catch (error) {
      return json(response, 500, { error: `安装包导入失败：${error.message}` });
    }
  }
  if (request.method === "GET" && url.pathname === "/api/archives") {
    return json(response, 200, { archives: await listArchives(), packages: [] });
  }
  if (request.method === "DELETE" && /^\/api\/archives\/[^/]+$/.test(url.pathname)) {
    try {
      const name = decodeURIComponent(url.pathname.split("/")[3]);
      if (previewTasks.has(name) || [...jobs.values()].some(job => job.status === "running" && job.archiveName === name)) return json(response, 409, { error: "该归档正在执行任务，暂时不能删除" });
      const root = archiveRoot(name);
      await readFile(path.join(root, "archive", "manifest.json"));
      await rm(root, { recursive: true, force: false, maxRetries: 2, retryDelay: 200 });
      store.removeArchive(name);
      return json(response, 200, { ok: true, name });
    } catch (error) { return json(response, 400, { error: `删除失败：${error.message}` }); }
  }
  if (request.method === "POST" && /^\/api\/archives\/[^/]+\/analyze$/.test(url.pathname)) {
    try {
      if (activeAnalysisJobId) return json(response, 409, { error: "已有源码解析任务正在运行" });
      const name = decodeURIComponent(url.pathname.split("/")[3]);
      const root = archiveRoot(name);
      const manifest = JSON.parse(await readFile(path.join(root, "archive", "manifest.json"), "utf8"));
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const job = { apiVersion: 2, kind: "analysis", id, status: "running", url: manifest.sourceUrl || null, archiveName: name, startedAt: new Date().toISOString(), logs: [] };
      saveJob(job, true);
      jobs.set(id, job); activeAnalysisJobId = id;
      const isNativeApk = (manifest.packageType === "apk" || !!manifest.apk) && !manifest.apk?.isWebView && !manifest.runtimeInspection?.engine?.includes("WebView");
      const analyzeFn = isNativeApk
        ? () => analyzeApkGame(root, manifest, event => { job.logs.push(event); if (job.logs.length > 1000) job.logs.shift(); saveJob(job); })
        : () => analyzeCapturedGame(root, manifest, event => { job.logs.push(event); if (job.logs.length > 1000) job.logs.shift(); saveJob(job); });
      analyzeFn().then(async result => {
        if (!isNativeApk) {
          manifest.runtimeInspection = await inspectCapturedRuntime(root, manifest);
        }
        manifest.completeness = assessCompleteness(manifest);
        await writeFile(path.join(root, "archive", "manifest.json"), JSON.stringify(manifest, null, 2));
        Object.assign(job, { status: "completed", finishedAt: new Date().toISOString(), captureRoot: root, sourceAnalysis: result });
      }).catch(error => {
        Object.assign(job, { status: "failed", finishedAt: new Date().toISOString(), error: error.message });
      }).finally(() => { activeAnalysisJobId = undefined; saveJob(job, true); listArchives().catch(console.error); });
      return json(response, 202, job);
    } catch (error) { return json(response, 400, { error: error.message }); }
  }
  if (request.method === "GET" && url.pathname === "/api/jobs") {
    const history = [...jobs.values()].sort((a,b) => String(b.startedAt).localeCompare(String(a.startedAt))).map(({logs, sourceAnalysis, ...job}) => job);
    return json(response, 200, { jobs: history });
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
    const job = jobs.get(url.pathname.slice("/api/jobs/".length));
    return job ? json(response, 200, job) : json(response, 404, { error: "任务不存在" });
  }
  if (request.method === "POST" && /^\/api\/jobs\/[^/]+\/stop$/.test(url.pathname)) {
    const id = url.pathname.split("/")[3];
    const job = jobs.get(id);
    if (!job) return json(response, 404, { error: "任务不存在" });
    if (job.status !== "running") return json(response, 409, { error: "任务已经停止" });
    job.status = "stopping";
    job.logs.push({ time: new Date().toISOString(), type: "info", message: "用户请求停止抓取" });
    saveJob(job, true);
    controllers.get(id)?.abort();
    return json(response, 202, job);
  }
  if (request.method === "POST" && url.pathname === "/api/captures") {
    try {
      if (activeJobId) return json(response, 409, { error: "已有抓取任务正在运行" });
      const options = validateCapture(await readJson(request));
      if (existsSync(authStatePath)) options.storageState = authStatePath;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const controller = new AbortController();
      const job = { apiVersion: 2, kind: "capture", id, status: "running", url: options.url, startedAt: new Date().toISOString(), logs: [] };
      saveJob(job, true);
      jobs.set(id, job);
      controllers.set(id, controller);
      activeJobId = id;
      options.signal = controller.signal;
      options.onEvent = event => {
        job.logs.push(event);
        if (event.type === "resource") job.savedResourcesLive = (job.savedResourcesLive || 0) + 1;
        if (job.logs.length > 1000) job.logs.splice(0, job.logs.length - 1000);
        saveJob(job);
      };
      captureGame(options).then(result => {
        Object.assign(job, {
          status: "completed",
          finishedAt: new Date().toISOString(),
          captureRoot: result.captureRoot,
          savedResources: result.manifest.resources.filter(item => item.saved).length,
          failedRequests: result.manifest.failures.filter(item => !item.ignored).length,
          warningRequests: result.manifest.failures.filter(item => item.ignored).length,
          completeness: result.manifest.completeness,
          archiveName: path.basename(result.captureRoot)
        });
      }).catch(error => {
        Object.assign(job, { status: "failed", finishedAt: new Date().toISOString(), error: error.message });
      }).finally(() => {
        activeJobId = undefined;
        controllers.delete(id);
        saveJob(job, true);
        listArchives().catch(console.error);
      });
      return json(response, 202, job);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }
  if (request.method === "GET" && url.pathname === "/api/auth-state") {
    const exists = existsSync(authStatePath);
    let summary = null;
    if (exists) {
      try {
        const state = JSON.parse(await readFile(authStatePath, "utf8"));
        summary = { cookies: state.cookies?.length || 0, origins: state.origins?.length || 0 };
      } catch {}
    }
    return json(response, 200, { exists, summary, loginBrowserActive: loginBrowser !== null });
  }
  if (request.method === "POST" && url.pathname === "/api/auth-state/login") {
    try {
      const { url: loginUrl } = await readJson(request);
      if (!loginUrl) return json(response, 400, { error: "请提供登录 URL" });
      if (loginBrowser) { await loginBrowser.close().catch(() => {}); loginBrowser = null; loginContext = null; }
      loginBrowser = await chromium.launch({ headless: false });
      loginContext = await loginBrowser.newContext({ viewport: { width: 480, height: 800 } });
      const loginPage = await loginContext.newPage();
      await loginPage.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(e => {});
      return json(response, 200, { ok: true, message: "登录浏览器已打开，请手动登录后点击保存" });
    } catch (error) { return json(response, 500, { error: error.message }); }
  }
  if (request.method === "POST" && url.pathname === "/api/auth-state/save") {
    try {
      if (!loginContext) return json(response, 400, { error: "没有打开的登录浏览器" });
      await loginContext.storageState({ path: authStatePath });
      const state = JSON.parse(await readFile(authStatePath, "utf8"));
      const summary = { cookies: state.cookies?.length || 0, origins: state.origins?.length || 0 };
      await loginBrowser.close().catch(() => {});
      loginBrowser = null; loginContext = null;
      return json(response, 200, { ok: true, summary });
    } catch (error) { return json(response, 500, { error: error.message }); }
  }
  if (request.method === "DELETE" && url.pathname === "/api/auth-state/login") {
    if (loginBrowser) { await loginBrowser.close().catch(() => {}); loginBrowser = null; loginContext = null; }
    return json(response, 200, { ok: true });
  }
  if (request.method === "DELETE" && url.pathname === "/api/auth-state") {
    await rm(authStatePath, { force: true }).catch(() => {});
    return json(response, 200, { ok: true });
  }
  json(response, 404, { error: "Not found" });
}

export async function startWebUi(options = {}) {
  downloadRoot = path.resolve(options.downloadRoot || path.resolve(publicRoot, "../download"));
  store = new ArchiveStore(options.databasePath || path.resolve(publicRoot, "../data/archives.sqlite"));
  jobs.clear();
  for (const job of store.loadJobs()) jobs.set(job.id, job);
  // /api/archives refreshes the index on demand. Do not block the health
  // endpoint and browser launch on scanning every downloaded game.
  const host = options.host || "127.0.0.1";
  const port = options.port ?? 41740;
  const server = http.createServer((request, response) => {
    handle(request, response).catch(error => json(response, 500, { error: error.message }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  server.once("close", () => { for (const job of jobs.values()) saveJob(job, true); store.close(); });
  if (options.startAnalyzer !== false && !(await analyzerStatus()).running) startAnalyzer();
  return { server, url: `http://${host}:${server.address().port}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portIndex = process.argv.indexOf("--port");
  const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 41740;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error("Error: --port must be between 0 and 65535");
    process.exitCode = 1;
  } else {
    const app = await startWebUi({ port });
    console.log(`Web UI: ${app.url}`);
    console.log("Press Ctrl+C to stop.");
  }
}
