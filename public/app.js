const $ = selector => document.querySelector(selector);
const form = $("#capture-form"), startButton = $("#submit"), stopButton = $("#stop");
const analyzeButton = $("#analyze"), archiveSelect = $("#archive-select");
const statusBox = $("#status"), analysisStatus = $("#analysis-status"), logsBox = $("#logs"), live = $("#live"), logTitle = $("#log-title");
let activeCaptureId, activeAnalysisId, renderedLogs = 0, archiveItems = [], archivePage = 1;
const ARCHIVES_PER_PAGE = 10;
let archiveFilter = "all", archiveSearch = "";
let previewArchive = "", previewMode = "cover";
const recordingActions = new Map();
function filteredArchives() {
  return archiveItems.filter(item => {
    let matchesFilter = true;
    if (archiveFilter === "done") matchesFilter = !!item.analysis;
    else if (archiveFilter === "pending") matchesFilter = !item.analysis;
    else if (archiveFilter === "recording") matchesFilter = item.recording?.status === "recording";
    else if (archiveFilter === "has_video" || archiveFilter === "recorded") matchesFilter = item.recording?.status !== "recording" && (item.recording?.videoCount || 0) > 0;

    const matchesSearch = !archiveSearch || [
      item.title, item.name, item.sourceUrl, item.engine, item.analysis?.engine,
      item.recording?.status === 'recording' ? '录制中' : '',
      item.recording?.videoCount ? `${item.recording.videoCount}关` : '',
      item.recording?.videoCount ? `${item.recording.videoCount}视频` : ''
    ].some(value => String(value ?? "").toLowerCase().includes(archiveSearch));
    return matchesFilter && matchesSearch;
  });
}
$("#archive-filters").addEventListener("click", event => {
  const filter = event.target.closest("[data-filter]");
  if (!filter) return;
  archiveFilter = filter.dataset.filter; archivePage = 1; renderArchivePage();
  $(`#archive-filters [data-filter="${archiveFilter}"]`)?.focus({ preventScroll: true });
});
$("#archive-search")?.addEventListener("input", event => {
  archiveSearch = event.target.value.trim().toLowerCase(); archivePage = 1; renderArchivePage();
});
const formatTime = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "未记录";
const formatShortTime = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "未记录";
function sourceLink(value) {
  if (value && value.startsWith("local-apk:")) {
    const filename = value.slice("local-apk:".length);
    return `<span class="source-link" title="${escapeHtml(filename)}">本地安装包<small>${escapeHtml(filename)}</small></span>`;
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return `<a class="source-link" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(value)}">${escapeHtml(url.hostname.replace(/^www\./, ""))} <span aria-hidden="true">↗</span><small>${escapeHtml(url.pathname + url.search)}</small></a>`;
  } catch { return '<span class="game-name">未记录来源链接</span>'; }
}
const escapeHtml = value => { const node = document.createElement("span"); node.textContent = String(value ?? ""); return node.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;"); };
function show(box, message, kind = "") { box.hidden = false; box.className = `status${box === analysisStatus ? " compact" : ""} ${kind}`; box.innerHTML = message; }
function setTaskRunning(kind, running) {
  startButton.disabled = kind === "capture" ? running : !!activeCaptureId;
  stopButton.disabled = !activeCaptureId;
  analyzeButton.disabled = running || !archiveSelect.value;
  live.className = `live ${running ? "running" : ""}`;
  live.textContent = running ? (kind === "capture" ? "归档中" : "解析中") : "已停止";
}
function renderLogs(logs) {
  const followLatest = logs.length < renderedLogs || logsBox.scrollHeight - logsBox.clientHeight - logsBox.scrollTop <= 24;
  if (logs.length < renderedLogs) { logsBox.innerHTML = ""; renderedLogs = 0; }
  if (!renderedLogs && logs.length) logsBox.innerHTML = "";
  for (const entry of logs.slice(renderedLogs)) {
    const row = document.createElement("div"); row.className = `line ${entry.type}`;
    row.innerHTML = `<span class="time">${new Date(entry.time).toLocaleTimeString("zh-CN", { hour12: false })}</span><span class="tag">${escapeHtml(entry.type.toUpperCase())}</span><span class="message">${escapeHtml(entry.message)}</span>`;
    logsBox.append(row);
  }
  if (followLatest && logs.length > renderedLogs) logsBox.scrollTop = logsBox.scrollHeight;
  renderedLogs = logs.length;
}
function fail(kind, message) {
  if (kind === "capture") activeCaptureId = undefined; else activeAnalysisId = undefined;
  setTaskRunning(kind, false);
  show(kind === "capture" ? statusBox : analysisStatus, escapeHtml(message || "任务失败"), "error");
}

function pageNumbers(totalPages, current = archivePage) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = current <= 4 ? 2 : current >= totalPages - 3 ? totalPages - 4 : current - 1;
  const end = current <= 4 ? 5 : current >= totalPages - 3 ? totalPages - 1 : current + 1;
  return [1, ...(start > 2 ? ["…"] : []), ...Array.from({ length: end - start + 1 }, (_, index) => start + index), ...(end < totalPages - 1 ? ["…"] : []), totalPages];
}

function changeArchivePage(page, button) {
  const totalPages = Math.max(1, Math.ceil(filteredArchives().length / ARCHIVES_PER_PAGE));
  const nextPage = Math.min(Math.max(1, page), totalPages);
  if (nextPage === archivePage) return;
  const focusSelector = button?.id ? `#${button.id}` : `#page-numbers [data-page="${nextPage}"]`;
  archivePage = nextPage;
  renderArchivePage();
  const focusTarget = $(focusSelector);
  (focusTarget && !focusTarget.disabled ? focusTarget : $(`#page-numbers [data-page="${archivePage}"]`))?.focus({ preventScroll: true });
  $(".library-toolbar")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}

function renderArchivePage() {
  const filtered = filteredArchives();
  const done = archiveItems.filter(item => item.analysis).length;
  const recordingCount = archiveItems.filter(item => item.recording?.status === "recording").length;
  const hasVideoCount = archiveItems.filter(item => item.recording?.status !== "recording" && (item.recording?.videoCount || 0) > 0).length;
  $("#archive-filters").innerHTML = [
    ["all","全部",archiveItems.length],
    ["recording","录制中",recordingCount],
    ["has_video","已录制",hasVideoCount],
    ["pending","未解析",archiveItems.length-done],
    ["done","已解析",done]
  ].map(([key,label,count]) => `<button type="button" data-filter="${key}" aria-pressed="${archiveFilter===key}" class="filter-button ${archiveFilter===key?'selected':''}">${label}<span>${count}</span></button>`).join("");
  const totalPages = Math.max(1, Math.ceil(filtered.length / ARCHIVES_PER_PAGE));
  archivePage = Math.min(Math.max(1, archivePage), totalPages);
  const items = filtered.slice((archivePage - 1) * ARCHIVES_PER_PAGE, archivePage * ARCHIVES_PER_PAGE);
  $("#archive-table").innerHTML = items.length ? items.map(item => {
    const complete = item.completeness?.status === "core-complete";
    const state = complete ? '<span class="badge good">完整归档</span>' : item.completeness?.status === "shell-only" ? '<span class="badge warn">仅加载外壳</span>' : '<span class="badge neutral">需要检查</span>';
    const engineName = item.engine?.startsWith("Unknown") ? "等待核心文件" : item.engine || "未识别";
    const engineBadge = `<span class="badge ${item.runtime?.confidence === "high" ? "good" : "neutral"}">${escapeHtml(engineName)}</span>`;
    const coreFiles = item.runtime?.coreFiles || [];
    const core = item.runtime?.coreReady ? `<span class="badge good">已就绪</span><div class="game-name">${escapeHtml(coreFiles.slice(0, 2).map(value => value.split("/").pop()).join("、"))}</div>` : `<span class="badge warn">未就绪</span><div class="game-name">${escapeHtml(item.runtime?.coreRule || "缺少核心构建产物")}</div>`;
    const analysisCounts = item.analysis?.counts;
    // Counts also allow an already-running older backend to show regenerated reports.
    const construct = item.analysis?.construct || (analysisCounts?.constructEventBlocks != null ? { status: analysisCounts.constructUnresolved ? 'partial' : 'decoded', counts: { conditions: analysisCounts.constructConditions, actions: analysisCounts.constructActions }, unresolved: analysisCounts.constructUnresolved } : null);
    const parsed = construct
      ? `<span class="parse-state ${construct.status === 'decoded' ? 'done' : 'pending'}" title="静态事件解码；不代表原始工程恢复或实机玩法验收">${construct.status === 'decoded' ? '事件已解码' : '部分解码'}</span><div class="cell-note">${construct.counts.conditions} 条件 / ${construct.counts.actions} 动作${construct.unresolved ? ` · ${construct.unresolved} 未识别` : ''}</div>`
      : item.analysis ? `<span class="parse-state done">${item.engine === 'Construct' ? '基础分析' : '已解析'}</span><div class="cell-note">${analysisCounts?.gameTextSources ?? analysisCounts?.textSources ?? 0} 个文本文件</div>` : '<span class="parse-state pending">未解析</span><div class="cell-note">等待源码解析</div>';
    const levels = item.levelSummary;
    const levelText = levels?.kind === 'infinite' ? '无限' : levels?.kind === 'finite' && Number.isSafeInteger(levels.total) && levels.total > 0 ? `${levels.total} 关` : item.analysis ? '待确认' : '未解析';
    const levelHint = levels?.evidence?.map(e => `${e.file}: ${e.detail}`).join('；') || (item.analysis ? '解析结果尚未确认总关卡数' : '解析后显示总关卡数');
    const levelHtml = `<span class="level-count" title="${escapeHtml(levelHint)}">${escapeHtml(levelText)}</span>`;
    const time = formatTime(item.capturedAt);
    const startedFull = formatTime(item.startedAt);
    const startedShort = formatShortTime(item.startedAt);
    const finishedShort = formatShortTime(item.capturedAt);
    const previewUrl = `/api/archives/${encodeURIComponent(item.name)}/cover`;
    const thumbnail = `<button class="preview-thumb" type="button" data-preview="${escapeHtml(previewUrl)}" data-archive="${escapeHtml(item.name)}" data-title="${escapeHtml(item.title)}" aria-label="预览 ${escapeHtml(item.title)}"><img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(item.title)} 游戏封面" loading="lazy"><span class="preview-missing" hidden>${escapeHtml(Array.from(item.title || "游戏").slice(0,2).join("").toUpperCase())}</span></button>`;
    const rec = item.recording || { status: "idle", videoCount: 0, targetLevels: 100, isRecording: false };
    const pendingRecordingAction = recordingActions.get(item.name);
    const stopRecording = pendingRecordingAction ? pendingRecordingAction === "stop" : rec.status === "recording";
    const isNativeApk = item.packageType === "apk" && !item.engine?.includes("H5") && !item.engine?.includes("WebView");
    const recordControl = isNativeApk ? '' : `<button class="row-action record-action ${stopRecording ? 'stop' : 'start'}" data-${stopRecording ? 'stop' : 'start'}-record="${escapeHtml(item.name)}"${pendingRecordingAction ? ' disabled' : ''}>${pendingRecordingAction ? (stopRecording ? '停止中…' : '启动中…') : (stopRecording ? '停止录制' : '开始录制')}</button>`;
    return `<tr class="${item.analysis ? 'is-analyzed' : 'is-pending'}"><td><div class="game-identity">${thumbnail}<div class="game-label"><div class="game-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div><div class="game-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="game-engine">${engineBadge}<details class="core-details"><summary>${item.runtime?.coreReady ? '核心文件已就绪' : '查看核心文件'}</summary>${core}</details></div></div></div></td><td>${sourceLink(item.sourceUrl)}</td><td class="archive-time"><div title="开始 ${escapeHtml(startedFull)}"><span>开始</span> ${escapeHtml(startedShort)}</div><div class="archive-finished" title="完成 ${escapeHtml(time)}"><span>完成</span> ${escapeHtml(finishedShort)}</div></td><td>${state}<div class="cell-note">${item.savedResources || 0} 个资源</div></td><td>${parsed}</td><td>${levelHtml}</td><td><div class="row-actions"><button class="row-action ${item.analysis ? 'secondary-action' : 'analyze-primary'}" data-analyze="${escapeHtml(item.name)}">${item.analysis ? "重新解析" : "开始解析"}</button><button class="row-action delete" data-delete="${escapeHtml(item.name)}" data-title="${escapeHtml(item.title)}">删除</button><button class="row-action folder-action" data-folder="${escapeHtml(item.name)}" title="打开游戏工程根目录">打开文件夹</button><button class="row-action video-action" data-video-folder="${escapeHtml(item.name)}" title="打开游戏录制视频目录">打开视频目录</button>${recordControl}</div></td></tr>`;
  }).join("") : `<tr><td colspan="7"><div class="empty archive-empty"><strong>${archiveSearch ? "暂无搜索结果" : archiveItems.length ? "当前分类暂无归档" : "暂无游戏归档"}</strong><span>${archiveSearch ? "试试清空关键词，或切换解析状态分类。" : archiveItems.length ? "切换其他分类，查看已有归档。" : "在归档任务中添加游戏链接，完成后即可在这里查看。"}</span></div></td></tr>`;
  const firstItem = filtered.length ? (archivePage - 1) * ARCHIVES_PER_PAGE + 1 : 0;
  const lastItem = Math.min(archivePage * ARCHIVES_PER_PAGE, filtered.length);
  $("#page-summary").textContent = `显示 ${firstItem}–${lastItem} 条，共 ${filtered.length} 条`;
  $("#page-position").textContent = `第 ${archivePage} / ${totalPages} 页`;
  $("#page-numbers").innerHTML = pageNumbers(totalPages).map(page => page === "…" ? '<span class="page-ellipsis" aria-hidden="true">…</span>' : `<button type="button" class="page-number" data-page="${page}" aria-label="第 ${page} 页"${page === archivePage ? ' aria-current="page"' : ""}>${page}</button>`).join("");
  $("#page-prev").disabled = archivePage <= 1;
  $("#page-next").disabled = archivePage >= totalPages;
}

async function refreshArchives(preselect = "") {
  try {
    const response = await fetch("/api/archives", { cache: "no-store" }), data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取归档失败");
    const archives = data.archives || [];
    $("#stat-total").textContent = archives.length;
    const completeCount = archives.filter(item => item.completeness?.status === "core-complete").length;
    $("#stat-complete").textContent = completeCount;
    $("#stat-shell").textContent = archives.filter(item => item.completeness?.status === "shell-only").length;
    $("#stat-analyzed").textContent = archives.filter(item => item.analysis).length;
    const completeRatio = archives.length ? Math.round(completeCount / archives.length * 100) : 0;
    const completeBar = $("#stat-complete-bar");
    if (completeBar) completeBar.style.width = `${completeRatio}%`;
    const completeNote = $("#stat-complete-note");
    if (completeNote) completeNote.textContent = archives.length ? `占全部归档 ${completeRatio}%` : "核心构建与启动检查通过";
    archiveSelect.innerHTML = archives.length ? archives.map(item => {
      const state = item.completeness?.status === "core-complete" ? "归档完整" : item.completeness?.status === "shell-only" ? "仅加载外壳" : "需检查";
      const engine = item.engine?.startsWith("Unknown") ? "引擎未知" : item.engine;
      const parsed = item.analysis ? " · 已解析" : " · 未解析";
      return `<option value="${escapeHtml(item.name)}">${escapeHtml(item.title)} · ${escapeHtml(engine)} · ${state}${parsed}</option>`;
    }).join("") : '<option value="">暂无归档</option>';
    if (preselect && archives.some(item => item.name === preselect)) archiveSelect.value = preselect;
    analyzeButton.disabled = !archiveSelect.value || !!activeAnalysisId;
    archiveItems = [
      ...(data.packages || []).map(item => ({ ...item, name: `apk:${item.id}`, isApk: true })),
      ...archives
    ];
    if (preselect) {
      archiveFilter = "all"; archiveSearch = "";
      if ($("#archive-search")) $("#archive-search").value = "";
      archivePage = Math.floor(Math.max(0, archiveItems.findIndex(item => item.name === preselect)) / ARCHIVES_PER_PAGE) + 1;
    }
    renderArchivePage();

  } catch (error) { archiveSelect.innerHTML = '<option value="">读取归档失败</option>'; show(analysisStatus, escapeHtml(error.message), "error"); }
}

async function poll(id, kind) {
  const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" }), job = await response.json();
  if (!response.ok) throw new Error(job.error || "无法读取任务状态");
  renderLogs(job.logs || []);
  if (job.status === "running" || job.status === "stopping") {
    if (kind === "capture") show(statusBox, job.status === "stopping" ? "正在收尾并生成归档……" : `正在归档 <strong>${escapeHtml(job.url)}</strong><br>已保存资源：${job.savedResourcesLive || 0}`);
    else show(analysisStatus, "正在筛选游戏源码，并解析 Unity data、WASM 与 IL2CPP……");
    setTimeout(() => poll(id, kind).catch(error => fail(kind, error.message)), 700); return;
  }
  if (job.status !== "completed") return fail(kind, job.error || "任务失败");
  if (kind === "capture") {
    activeCaptureId = undefined; setTaskRunning(kind, false);
    const complete = job.completeness?.status === "core-complete";
    const message = complete
      ? `第一步完成：核心构建与本地启动检查通过。保存 ${job.savedResources} 个资源。<br><span class="path">${escapeHtml(job.captureRoot)}</span>`
      : `归档已保存，但完整性或本地启动检查未通过：${escapeHtml(job.completeness?.criticalFailures?.[0]?.error || "请查看日志")}<br><span class="path">${escapeHtml(job.captureRoot)}</span>`;
    show(statusBox, message, complete ? "success" : "error");
    await refreshArchives(job.archiveName);
  } else {
    activeAnalysisId = undefined; setTaskRunning(kind, false);
    const a = job.sourceAnalysis;
    await refreshArchives(job.archiveName);
    const il2cpp = a.il2cpp?.status === "completed" ? `，IL2CPP 业务类 ${a.counts.il2cppGameplayClasses}` : "";
    show(analysisStatus, `第二步完成：引擎 ${escapeHtml(a.engine)}，游戏源码 ${a.counts.gameTextSources ?? a.counts.textSources}，Unity 解包 ${a.counts.unityDataExtractedFiles || 0}，WASM ${a.counts.wasmModules}${il2cpp}。<br><span class="path">${escapeHtml(job.captureRoot + "\\analysis")}</span>`, "success");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const inputUrl = $("#url").value.trim();
  const existing = archiveItems.find(item => {
    if (!item.sourceUrl) return false;
    try {
      const u1 = new URL(item.sourceUrl);
      const u2 = new URL(inputUrl);
      return u1.origin.toLowerCase() === u2.origin.toLowerCase() &&
             u1.pathname.replace(/\/+$/, "").toLowerCase() === u2.pathname.replace(/\/+$/, "").toLowerCase();
    } catch {
      return item.sourceUrl.toLowerCase() === inputUrl.toLowerCase();
    }
  });
  if (existing) {
    const hasAnalysis = !!existing.analysis;
    const desc = hasAnalysis ? "已归档且已解析完成" : "已存在归档（等待解析）";
    const ok = window.confirm(`检测到本地已存在该游戏的归档记录：\n\n· 游戏名称：${existing.title || existing.name}\n· 归档目录：${existing.name}\n· 当前状态：${desc}\n\n确定要再次对该游戏执行归档与解析吗？`);
    if (!ok) return;
  }
  renderedLogs = 0; logsBox.innerHTML = '<div class="empty">正在启动 Chromium…</div>'; logTitle.textContent = "归档日志";
  setTaskRunning("capture", true); show(statusBox, "正在启动浏览器并寻找实际游戏入口……");
  try {
    const response = await fetch("/api/captures", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: $("#url").value, headless: $("#headless").checked, interact: $("#interact").checked, acknowledgeRights: $("#rights").checked }) });
    const job = await response.json(); if (!response.ok) throw new Error(job.error || "无法启动归档");
    activeCaptureId = job.id; await poll(job.id, "capture");
  } catch (error) { fail("capture", error.message); }
});
stopButton.addEventListener("click", async () => {
  if (!activeCaptureId) return; stopButton.disabled = true;
  try { const response = await fetch(`/api/jobs/${encodeURIComponent(activeCaptureId)}/stop`, { method: "POST" }); if (!response.ok) throw new Error((await response.json()).error); } catch (error) { fail("capture", error.message); }
});
analyzeButton.addEventListener("click", async () => {
  if (!archiveSelect.value) return;
  const currentArchive = archiveItems.find(item => item.name === archiveSelect.value);
  if (currentArchive?.analysis) {
    const textSources = currentArchive.analysis.counts?.gameTextSources ?? currentArchive.analysis.counts?.textSources ?? 0;
    const engine = currentArchive.analysis.engine || currentArchive.engine || "未识别引擎";
    const ok = window.confirm(`游戏「${currentArchive.title || currentArchive.name}」已存在解析结果：\n\n· 识别引擎：${engine}\n· 已提取源码：${textSources} 个文件\n\n重新解析将覆盖现有分析产物，确定要重新解析吗？`);
    if (!ok) return;
  }
  renderedLogs = 0; logsBox.innerHTML = '<div class="empty">正在读取归档…</div>'; logTitle.textContent = "源码解析日志";
  setTaskRunning("analysis", true); show(analysisStatus, "正在启动独立解析任务……");
  try {
    const response = await fetch(`/api/archives/${encodeURIComponent(archiveSelect.value)}/analyze`, { method: "POST" }), job = await response.json();
    if (!response.ok) throw new Error(job.error || "无法启动解析"); activeAnalysisId = job.id; await poll(job.id, "analysis");
  } catch (error) { fail("analysis", error.message); }
});
archiveSelect.addEventListener("change", () => refreshArchives(archiveSelect.value));
$("#archive-table").addEventListener("error", event => {
  if (event.target.tagName !== "IMG") return;
  const thumb = event.target.closest(".preview-thumb");
  if (!thumb) return;
  event.target.hidden = true; thumb.querySelector(".preview-missing").hidden = false; thumb.title = "暂无封面，点击可上传";
}, true);
function showPreviewMode(mode) {
  previewMode = mode;
  $("#screenshot-refresh").hidden = mode !== "preview";
  $("#preview-image").hidden = false;
  $("#preview-empty").hidden = true;
  $("#preview-image").alt = mode === "cover" ? "游戏封面" : "归档实机截图";
  $("#preview-image").src = `/api/archives/${encodeURIComponent(previewArchive)}/${mode}?v=${Date.now()}`;
  $("#preview-description").textContent = mode === "cover" ? "游戏封面用于辨认游戏；可上传图片替换，手动封面将优先保留。" : "从本地归档运行后截取，已阻止外网请求；游戏内菜单仍可能出现。";
  const cover = archiveItems.find(item => item.name === previewArchive)?.cover;
  if(mode === "cover" && cover?.titleMismatch) $("#preview-description").textContent = `来源网站将此游戏标为「${cover.title}」，与本地识别名称不同；此处使用来源游戏卡片封面。`;
  $("#cover-tab").setAttribute("aria-pressed",String(mode === "cover"));
  $("#screenshot-tab").setAttribute("aria-pressed",String(mode === "preview"));
}
$("#cover-tab").addEventListener("click",()=>showPreviewMode("cover"));
$("#screenshot-refresh").addEventListener("click",async()=>{
  const archive=previewArchive, button=$("#screenshot-refresh");
  button.disabled=true;$("#cover-feedback").textContent="正在启动本地游戏并截图，请稍候…";
  try {
    const response=await fetch(`/api/archives/${encodeURIComponent(archive)}/screenshot`,{method:"POST"});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"截图失败");
    if(previewArchive===archive){showPreviewMode("preview");$("#cover-feedback").textContent="本地截图已更新。";}
  } catch(error) {if(previewArchive===archive)$("#cover-feedback").textContent=error.message;}
  finally {button.disabled=false;}
});
$("#screenshot-tab").addEventListener("click",()=>showPreviewMode("preview"));
$("#preview-image").addEventListener("error",()=>{
  $("#preview-image").hidden = true; $("#preview-empty").hidden = false;
  $("#preview-empty").textContent = previewMode === "cover" ? "暂无可靠封面，请上传游戏封面。" : "暂无实机截图。";
});
$("#cover-upload").addEventListener("click",()=>$("#cover-file").click());
$("#cover-file").addEventListener("change",async event=>{
  const file=event.target.files[0];if(!file)return;
  const archive=previewArchive;
  $("#cover-upload").disabled=true;$("#cover-feedback").textContent="正在保存封面…";
  try{
    if(file.size>5*1024*1024)throw new Error("请选择5 MB以内的图片");
    const response=await fetch(`/api/archives/${encodeURIComponent(archive)}/cover`,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:file});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"保存封面失败");
    $("#cover-feedback").textContent="封面已保存，后续自动提取不会覆盖。";
    if(previewArchive===archive)showPreviewMode("cover");renderArchivePage();
  }catch(error){$("#cover-feedback").textContent=error.message;}
  finally{$("#cover-upload").disabled=false;event.target.value="";}
});
$("#preview-close").addEventListener("click", () => $("#preview-dialog").close());
$("#preview-dialog").addEventListener("click", event => { if (event.target === $("#preview-dialog")) $("#preview-dialog").close(); });
$("#archive-table").addEventListener("click", event => {
  const preview = event.target.closest("[data-preview]");
  if (preview) {
    previewArchive = preview.dataset.archive;
    $("#preview-title").textContent = preview.dataset.title;
    $("#cover-feedback").textContent = "";
    showPreviewMode("cover");
    $("#preview-dialog").showModal(); return;
  }
  const startBtn = event.target.closest("[data-start-record]");
  if (startBtn) {
    const archiveName = startBtn.dataset.startRecord;
    if (recordingActions.has(archiveName)) return;
    recordingActions.set(archiveName, "start");
    startBtn.disabled = true;
    startBtn.textContent = "启动中…";
    fetch(`/api/archives/${encodeURIComponent(archiveName)}/start-record`, { method: "POST" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "启动录制失败");
        show(analysisStatus, `游戏「${escapeHtml(archiveName)}」后台任务${data.alreadyRunning ? '已在运行' : '已启动'}（PID: ${data.pid}）。`, "success");
        await refreshArchives("", true);
      })
      .catch(error => {
        show(analysisStatus, escapeHtml(error.message), "error");
      })
      .finally(() => { recordingActions.delete(archiveName); renderArchivePage(); });
    return;
  }
  const stopBtn = event.target.closest("[data-stop-record]");
  if (stopBtn) {
    const archiveName = stopBtn.dataset.stopRecord;
    if (recordingActions.has(archiveName)) return;
    if (!window.confirm(`确定停止游戏「${archiveName}」的当前录制任务吗？`)) return;
    recordingActions.set(archiveName, "stop");
    stopBtn.disabled = true;
    stopBtn.textContent = "停止中…";
    fetch(`/api/archives/${encodeURIComponent(archiveName)}/stop-record`, { method: "POST" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "停止录制失败");
        show(analysisStatus, `已停止游戏「${escapeHtml(archiveName)}」录制任务。`, "success");
        await refreshArchives("", true);
      })
      .catch(error => {
        show(analysisStatus, escapeHtml(error.message), "error");
      })
      .finally(() => { recordingActions.delete(archiveName); renderArchivePage(); });
    return;
  }
  const videoFolder = event.target.closest("[data-video-folder]");
  if (videoFolder) {
    const archiveName = videoFolder.dataset.videoFolder;
    const isBtn = videoFolder.tagName === "BUTTON";
    const originalText = videoFolder.textContent;
    if (isBtn) {
      videoFolder.disabled = true;
      videoFolder.textContent = "正在打开…";
    }
    fetch(`/api/archives/${encodeURIComponent(archiveName)}/open-video-folder`, { method: "POST" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "打开视频目录失败");
        if (isBtn) {
          videoFolder.textContent = "已打开 ✓";
          setTimeout(() => { videoFolder.textContent = originalText; }, 2000);
        }
        show(analysisStatus, data.foreground ? "视频目录已打开。" : "视频目录已打开；若未置顶，请查看任务栏中的资源管理器窗口。", "success");
      })
      .catch(error => {
        alert("打开视频目录失败：" + error.message);
        if (isBtn) videoFolder.textContent = originalText;
      })
      .finally(() => {
        if (isBtn) videoFolder.disabled = false;
      });
    return;
  }
  const folder = event.target.closest("[data-folder]");
  if (folder) {
    folder.disabled = true;
    const name = folder.dataset.folder;
    const endpoint = name.startsWith("apk:") ? `/api/apk/${encodeURIComponent(name.slice(4))}/open-folder` : `/api/archives/${encodeURIComponent(name)}/open-folder`;
    fetch(endpoint, {method:"POST"}).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "打开文件夹失败");
      show(analysisStatus, data.foreground ? "归档文件夹已打开。" : "文件夹已打开；若未切换，请点击任务栏中的资源管理器。", "success");
    }).catch(error => show(analysisStatus, escapeHtml(error.message), "error")).finally(() => {folder.disabled=false;});
    return;
  }
  const analyze = event.target.closest("[data-analyze]");
  if (analyze && !activeAnalysisId) { archiveSelect.value = analyze.dataset.analyze; analyzeButton.click(); return; }
  const remove = event.target.closest("[data-delete]");
  if (!remove) return;
  if (!window.confirm(`确定永久删除归档“${remove.dataset.title}”吗？\n\n将删除该游戏目录中的资产、抓包记录、分析结果和自动化脚本。`)) return;
  remove.disabled = true; remove.textContent = "删除中…";
  fetch(`/api/archives/${encodeURIComponent(remove.dataset.delete)}`, { method: "DELETE" }).then(async response => {
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "删除失败");
    await refreshArchives();
    show(analysisStatus, `已删除归档：${escapeHtml(remove.dataset.title)}`, "success");
  }).catch(error => { show(analysisStatus, escapeHtml(error.message), "error"); remove.disabled = false; remove.textContent = "删除"; });
});
$("#page-prev").addEventListener("click", event => changeArchivePage(archivePage - 1, event.currentTarget));
$("#page-next").addEventListener("click", event => changeArchivePage(archivePage + 1, event.currentTarget));
$("#page-numbers").addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (button) changeArchivePage(Number(button.dataset.page), button);
});

const pageSwitch = $("#page-switch");
const viewMeta = {
  archive: { title: "网页归档管理", subtitle: "创建归档并按引擎、核心文件和解析状态管理" },
  minigames: { title: "小游戏归档管理", subtitle: "登记小游戏来源、导入构建并跟踪归档进度" }
};
function switchView(name) {
  const key = viewMeta[name] ? name : "archive", meta = viewMeta[key];
  document.querySelectorAll(".tab[data-view]").forEach(tab => tab.classList.toggle("active", tab.dataset.view === key));
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${key}`));
  pageSwitch.hidden = key !== "archive";
  $("#page-title").textContent = meta.title;
  $("#page-subtitle").textContent = meta.subtitle;
  if (key === "minigames") refreshMinigames();
}
pageSwitch.addEventListener("click", event => {
  const selected = event.target.closest("button[data-subpage]");
  if (!selected) return;
  $("#view-archive").dataset.subpage = selected.dataset.subpage;
  pageSwitch.querySelectorAll("button[data-subpage]").forEach(button => {
    button.classList.toggle("active", button === selected);
    button.setAttribute("aria-selected", String(button === selected));
  });
  window.scrollTo(0, 0);
});
document.querySelectorAll(".tab[data-view]").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));
switchView("archive");

/* ---------------- 小游戏归档管理 ---------------- */
const MINI_PER_PAGE = 10;
const MINI_PLATFORM_LABELS = { h5: "H5 网页版", wechat: "微信小游戏", douyin: "抖音小游戏", other: "其他平台" };
const mini = { items: [], page: 1, filter: "all", search: "", jobId: null, jobSeen: 0, pending: null };
const miniLogsBox = $("#mini-logs"), miniLive = $("#mini-live"), miniStatus = $("#mini-status"), miniAnalysisStatus = $("#mini-analysis-status");
const miniStart = $("#mini-submit"), miniStop = $("#mini-stop");

function miniLog(type, message) {
  if (!miniLogsBox) return;
  if (miniLogsBox.querySelector(".console-empty")) miniLogsBox.innerHTML = "";
  const row = document.createElement("div");
  row.className = `line ${type}`;
  row.innerHTML = `<span class="time">${new Date().toLocaleTimeString("zh-CN", { hour12: false })}</span><span class="tag">${escapeHtml(String(type).toUpperCase())}</span><span class="message">${escapeHtml(message)}</span>`;
  miniLogsBox.append(row);
  miniLogsBox.scrollTop = miniLogsBox.scrollHeight;
}
function miniStreamLogs(entries) {
  const list = entries || [];
  if (list.length <= mini.jobSeen) return;
  for (const entry of list.slice(mini.jobSeen)) miniLog(entry.type, entry.message);
  mini.jobSeen = list.length;
}
function setMiniRunning(running, label) {
  miniStart.disabled = running;
  miniStop.disabled = !mini.jobId;
  miniLive.className = `live ${running ? "running" : ""}`;
  miniLive.textContent = running ? (label || "任务进行中") : "未运行";
}
function miniFail(message) {
  mini.jobId = null; mini.pending = null; setMiniRunning(false);
  show(miniStatus, escapeHtml(message || "任务失败"), "error");
  miniLog("error", message || "任务失败");
}
function miniFiltered() {
  return mini.items.filter(item => {
    const linked = item.linked;
    const matchesFilter = mini.filter === "archived" ? !!linked
      : mini.filter === "pending" ? !linked
        : mini.filter === "recorded" ? (linked?.recording?.videoCount || 0) > 0
          : true;
    const haystack = [item.title, item.sourceUrl, MINI_PLATFORM_LABELS[item.platform], linked?.name, linked?.engine]
      .map(value => String(value ?? "").toLowerCase());
    return matchesFilter && (!mini.search || haystack.some(value => value.includes(mini.search)));
  });
}

function renderMiniPage() {
  const filtered = miniFiltered();
  const archived = mini.items.filter(item => item.linked).length;
  const recorded = mini.items.filter(item => (item.linked?.recording?.videoCount || 0) > 0).length;
  $("#mini-filters").innerHTML = [
    ["all", "全部", mini.items.length],
    ["archived", "已归档", archived],
    ["pending", "待导入", mini.items.length - archived],
    ["recorded", "已录制", recorded]
  ].map(([key, label, count]) => `<button type="button" data-filter="${key}" aria-pressed="${mini.filter === key}" class="filter-button ${mini.filter === key ? "selected" : ""}">${label}<span>${count}</span></button>`).join("");
  const totalPages = Math.max(1, Math.ceil(filtered.length / MINI_PER_PAGE));
  mini.page = Math.min(Math.max(1, mini.page), totalPages);
  const items = filtered.slice((mini.page - 1) * MINI_PER_PAGE, mini.page * MINI_PER_PAGE);
  $("#mini-table").innerHTML = items.length ? items.map(item => {
    const linked = item.linked;
    const platform = MINI_PLATFORM_LABELS[item.platform] ?? MINI_PLATFORM_LABELS.other;
    const initials = Array.from(item.title || "小游戏").slice(0, 2).join("").toUpperCase();
    let host = item.sourceUrl || "";
    try { host = new URL(item.sourceUrl).hostname.replace(/^www\./, ""); } catch {}
    const build = linked
      ? `<span class="badge good">已归档</span><div class="game-name" title="${escapeHtml(linked.name)}">${escapeHtml(linked.name)}</div>`
      : `<span class="badge warn">待导入构建</span><div class="game-name">${item.platform === "h5" ? "可直接抓取归档" : "需要工程或构建"}</div>`;
    const stateCell = linked
      ? (linked.analysis ? `<span class="parse-state done">已解析</span><div class="cell-note">${escapeHtml(linked.analysisEngine || linked.engine || "引擎已识别")}</div>` : '<span class="parse-state pending">未解析</span><div class="cell-note">等待源码解析</div>')
      : '<span class="parse-state pending">未归档</span><div class="cell-note">仅登记来源</div>';
    const levels = linked?.levelSummary;
    const levelText = levels?.kind === "infinite" ? "无限" : levels?.kind === "finite" && Number.isSafeInteger(levels.total) && levels.total > 0 ? `${levels.total} 关` : linked ? "待确认" : "未归档";
    const levelHint = levels?.evidence?.map(entry => `${entry.file}: ${entry.detail}`).join("；") || (linked ? "解析结果尚未确认总关卡数" : "归档后显示总关卡数");
    return `<tr><td><div class="game-identity"><span class="mini-avatar" aria-hidden="true">${escapeHtml(initials)}</span><div class="game-label"><div class="game-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div><div class="game-name" title="${escapeHtml(item.sourceUrl)}">${escapeHtml(host)}</div></div></div></td><td><span class="badge ${item.platform === "h5" ? "good" : "neutral"}">${escapeHtml(platform)}</span></td><td>${sourceLink(item.sourceUrl)}</td><td class="archive-time"><div title="登记 ${escapeHtml(formatTime(item.createdAt))}"><span>登记</span> ${escapeHtml(formatShortTime(item.createdAt))}</div><div class="archive-finished" title="更新 ${escapeHtml(formatTime(item.updatedAt))}"><span>更新</span> ${escapeHtml(formatShortTime(item.updatedAt))}</div></td><td>${build}</td><td>${stateCell}</td><td><span class="level-count" title="${escapeHtml(levelHint)}">${escapeHtml(levelText)}</span></td><td><div class="row-actions"><button class="row-action" type="button" data-mini-open="${escapeHtml(item.id)}">打开来源</button><button class="row-action delete" type="button" data-mini-delete="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}">删除</button>${linked ? `<button class="row-action folder-action" type="button" data-mini-folder="${escapeHtml(linked.name)}">打开文件夹</button>` : ""}</div></td></tr>`;
  }).join("") : `<tr><td colspan="8"><div class="empty archive-empty"><strong>${mini.search ? "暂无搜索结果" : mini.items.length ? "当前分类暂无记录" : "暂无小游戏归档"}</strong><span>${mini.search ? "试试清空关键词，或切换构建状态分类。" : mini.items.length ? "切换其他分类，查看已登记的小游戏。" : "在上方登记小游戏来源，完成后即可在这里管理。"}</span></div></td></tr>`;
  const firstItem = filtered.length ? (mini.page - 1) * MINI_PER_PAGE + 1 : 0;
  const lastItem = Math.min(mini.page * MINI_PER_PAGE, filtered.length);
  $("#mini-page-summary").textContent = `显示 ${firstItem}–${lastItem} 条，共 ${filtered.length} 条`;
  $("#mini-page-position").textContent = `第 ${mini.page} / ${totalPages} 页`;
  $("#mini-page-numbers").innerHTML = pageNumbers(totalPages, mini.page).map(page => page === "…" ? '<span class="page-ellipsis" aria-hidden="true">…</span>' : `<button type="button" class="page-number" data-page="${page}" aria-label="第 ${page} 页"${page === mini.page ? ' aria-current="page"' : ""}>${page}</button>`).join("");
  $("#mini-page-prev").disabled = mini.page <= 1;
  $("#mini-page-next").disabled = mini.page >= totalPages;
}

async function refreshMinigames() {
  try {
    const response = await fetch("/api/minigames", { cache: "no-store" }), data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取小游戏列表失败");
    mini.items = data.minigames || [];
    const archived = mini.items.filter(item => item.linked).length;
    $("#mini-stat-total").textContent = mini.items.length;
    $("#mini-stat-archived").textContent = archived;
    $("#mini-stat-pending").textContent = mini.items.length - archived;
    $("#mini-stat-analyzed").textContent = mini.items.filter(item => item.linked?.analysis).length;
    const ratio = mini.items.length ? Math.round(archived / mini.items.length * 100) : 0;
    $("#mini-stat-bar").style.width = `${ratio}%`;
    $("#mini-stat-archived-note").textContent = mini.items.length ? `占全部登记 ${ratio}%` : "可直接本地运行与录制";
    renderMiniPage();
  } catch (error) {
    $("#mini-table").innerHTML = `<tr><td colspan="8"><div class="empty archive-empty"><strong>读取失败</strong><span>${escapeHtml(error.message)}</span></div></td></tr>`;
  }
}

async function miniPoll(id) {
  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: "no-store" }), job = await response.json();
    if (!response.ok) throw new Error(job.error || "无法读取任务状态");
    miniStreamLogs(job.logs);
    if (job.status === "running" || job.status === "stopping") {
      show(miniStatus, job.status === "stopping" ? "正在收尾并生成归档……" : `正在归档 <strong>${escapeHtml(job.url)}</strong><br>已保存资源：${job.savedResourcesLive || 0}`);
      setTimeout(() => miniPoll(id).catch(error => miniFail(error.message)), 700);
      return;
    }
    const capture = mini.pending;
    mini.jobId = null; setMiniRunning(false);
    if (job.status !== "completed") return miniFail(job.error || "任务失败");
    const complete = job.completeness?.status === "core-complete";
    show(miniStatus, `归档完成：保存 ${job.savedResources} 个资源。<br><span class="path">${escapeHtml(job.captureRoot || "")}</span>`, complete ? "success" : "error");
    miniLog("success", `归档完成${job.archiveName ? `：${job.archiveName}` : ""}`);
    if (capture && job.archiveName) {
      await fetch("/api/minigames", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: capture.url, platform: "h5", title: capture.title, archiveName: job.archiveName }) }).catch(() => {});
    }
    mini.pending = null;
    await refreshMinigames();
  } catch (error) { miniFail(error.message); }
}

$("#mini-filters")?.addEventListener("click", event => {
  const filter = event.target.closest("[data-filter]");
  if (!filter) return;
  mini.filter = filter.dataset.filter; mini.page = 1; renderMiniPage();
});
$("#mini-search")?.addEventListener("input", event => {
  mini.search = event.target.value.trim().toLowerCase(); mini.page = 1; renderMiniPage();
});
$("#mini-page-prev")?.addEventListener("click", () => { if (mini.page > 1) { mini.page -= 1; renderMiniPage(); } });
$("#mini-page-next")?.addEventListener("click", () => { mini.page += 1; renderMiniPage(); });
$("#mini-page-numbers")?.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (button) { mini.page = Number(button.dataset.page); renderMiniPage(); }
});

$("#mini-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  const url = $("#mini-url").value.trim(), platform = $("#mini-platform").value, title = $("#mini-title").value.trim();
  if (!$("#mini-rights").checked) { show(miniStatus, "请先确认已获得归档授权。", "error"); return; }
  miniLogsBox.innerHTML = '<div class="empty">正在登记来源…</div>';
  mini.jobSeen = 0;
  miniStart.disabled = true;
  let record;
  try {
    const response = await fetch("/api/minigames", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, platform, title }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "登记失败");
    record = data.minigame;
    miniLog("info", `${data.updated ? "已更新" : "已登记"}来源：${record.title}（${MINI_PLATFORM_LABELS[platform] ?? "其他平台"}）`);
    show(miniStatus, `来源已${data.updated ? "更新" : "登记"}：<strong>${escapeHtml(record.title)}</strong>`, "success");
    await refreshMinigames();
  } catch (error) { miniStart.disabled = false; return miniFail(error.message); }

  if (platform !== "h5") {
    miniStart.disabled = false;
    show(miniStatus, `已登记来源。<br>该平台只保留入口信息：取得可独立运行的 Web 构建后，把运行平台改为「H5 网页版」即可继续归档。`, "success");
    return;
  }
  try {
    const response = await fetch("/api/captures", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, headless: $("#mini-headless").checked, interact: $("#mini-interact").checked, acknowledgeRights: true })
    });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || "无法启动归档");
    mini.jobId = job.id; mini.jobSeen = 0; mini.pending = { url, title: record.title };
    setMiniRunning(true, "归档中");
    show(miniStatus, "正在启动浏览器并寻找实际游戏入口……");
    await miniPoll(job.id);
  } catch (error) { miniStart.disabled = false; miniFail(error.message); }
});
$("#mini-stop")?.addEventListener("click", async () => {
  if (!mini.jobId) return;
  miniStop.disabled = true;
  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(mini.jobId)}/stop`, { method: "POST" });
    if (!response.ok) throw new Error((await response.json()).error || "停止失败");
    miniLog("warn", "已请求停止当前归档任务");
  } catch (error) { miniFail(error.message); }
});
$("#mini-table")?.addEventListener("click", event => {
  const open = event.target.closest("[data-mini-open]");
  if (open) {
    const item = mini.items.find(entry => entry.id === open.dataset.miniOpen);
    if (item?.sourceUrl) window.open(item.sourceUrl, "_blank", "noopener");
    return;
  }
  const folder = event.target.closest("[data-mini-folder]");
  if (folder) {
    folder.disabled = true;
    fetch(`/api/archives/${encodeURIComponent(folder.dataset.miniFolder)}/open-folder`, { method: "POST" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "打开文件夹失败");
        show(miniAnalysisStatus, data.foreground ? "归档文件夹已打开。" : "文件夹已打开；若未切换，请点击任务栏中的资源管理器。", "success");
      })
      .catch(error => show(miniAnalysisStatus, escapeHtml(error.message), "error"))
      .finally(() => { folder.disabled = false; });
    return;
  }
  const remove = event.target.closest("[data-mini-delete]");
  if (!remove) return;
  if (!window.confirm(`确定删除小游戏登记「${remove.dataset.title}」吗？\n\n只移除登记记录，已归档的游戏目录不会被删除。`)) return;
  remove.disabled = true; remove.textContent = "删除中…";
  fetch(`/api/minigames/${encodeURIComponent(remove.dataset.miniDelete)}`, { method: "DELETE" })
    .then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "删除失败");
      await refreshMinigames();
      show(miniAnalysisStatus, `已删除登记：${escapeHtml(remove.dataset.title)}`, "success");
    })
    .catch(error => {
      show(miniAnalysisStatus, escapeHtml(error.message), "error");
      remove.disabled = false; remove.textContent = "删除";
    });
});
setMiniRunning(false);

refreshArchives();
setInterval(() => {
  if (document.visibilityState === "visible" && !activeCaptureId && !activeAnalysisId && !mini.jobId) {
    refreshArchives("", true);
    refreshMinigames();
  }
}, 5000);

const apkImport = $("#apk-import"), apkFile = $("#apk-file"), apkStatus = $("#apk-import-status");
apkImport.addEventListener("click", () => apkFile.click());
$("#sidebar-apk-import").addEventListener("click", () => apkFile.click());
apkFile.addEventListener("change", async () => {
  const file = apkFile.files[0];
  apkFile.value = "";
  if (!file) return;
  switchView("archive");
  pageSwitch.querySelector('[data-subpage="library"]').click();
  apkImport.disabled = $("#sidebar-apk-import").disabled = true;
  apkStatus.textContent = "导入中…";
  try {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/apk-import", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.detail || "导入失败");
    await refreshArchives(result.archiveName || `apk:${result.project_id}`);
    apkStatus.textContent = "已导入";
  } catch (error) {
    apkStatus.textContent = error.message;
  } finally {
    apkImport.disabled = $("#sidebar-apk-import").disabled = false;
  }
});