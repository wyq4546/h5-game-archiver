let projectId=null,currentProject=null,currentIndex=null,activeTaskId=null,activeTaskKind=null,pollTimer=null,pollInFlight=false;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

async function readJson(r){let d;try{d=await r.json()}catch{throw new Error(`HTTP ${r.status}`)}if(!r.ok)throw new Error(d.detail||JSON.stringify(d));return d}
function setBadge(el,ready,name=""){el.className=`status-pill ${ready?"ready":"missing"}`;el.textContent=`${name}${name?" ":""}${ready?"已就绪":"未安装"}`}
function toolStatusHtml(d){return `<div class="status-row"><span class="status-label">Git</span><span class="status-value ${d.git?"ok":"bad"}">${d.git?"可用":"缺失"}</span></div><div class="status-row"><span class="status-label">.NET SDK</span><span class="status-value ${d.dotnet?"ok":"bad"}">${d.dotnet?"可用":"缺失"}</span></div><div class="status-row"><span class="status-label">解析器</span><span class="status-value ${d.ready?"ok":"bad"}">${d.ready?"已就绪":"未就绪"}</span></div>${d.path?`<div class="tool-path" title="${esc(d.path)}">${esc(d.path)}</div>`:""}`}

async function refreshTool(){const b=$("#dumperBadge"),box=$("#toolStatus");b.className="status-pill checking";b.textContent="检查中";try{const d=await readJson(await fetch("/api/tools/il2cppdumper/status"));setBadge(b,d.ready,"Il2CppDumper");box.innerHTML=toolStatusHtml(d)}catch(e){b.className="status-pill missing";b.textContent="失败";box.textContent=e.message}}
async function refreshCpp2il(){const b=$("#cpp2ilBadge"),box=$("#cpp2ilStatus");b.className="status-pill checking";b.textContent="检查中";try{const d=await readJson(await fetch("/api/tools/cpp2il/status"));setBadge(b,d.ready,"Cpp2IL");box.innerHTML=toolStatusHtml(d)}catch(e){b.className="status-pill missing";b.textContent="失败";box.textContent=e.message}}

refreshTool();refreshCpp2il();$("#refreshTool").onclick=refreshTool;$("#refreshCpp2il").onclick=refreshCpp2il;

async function refreshIlspy(){
  const b=$("#ilspyBadge"),box=$("#ilspyStatus");
  b.className="status-pill checking";b.textContent="C# 反编译器 检查中";
  try{
    const d=await readJson(await fetch("/api/tools/ilspycmd/status"));
    setBadge(b,d.ready,"C# 反编译器");
    box.innerHTML=`<div class="status-row"><span class="status-label">.NET SDK</span><span class="status-value ${d.dotnet?"ok":"bad"}">${d.dotnet?"可用":"缺失"}</span></div>
    <div class="status-row"><span class="status-label">ILSpyCmd</span><span class="status-value ${d.ready?"ok":"bad"}">${d.ready?"已就绪":"未就绪"}</span></div>
    ${d.path?`<div class="tool-path" title="${esc(d.path)}">${esc(d.path)}</div>`:""}`;
  }catch(e){b.className="status-pill missing";b.textContent="C# 反编译器 失败";box.textContent=e.message}
}
refreshIlspy();$("#refreshIlspy").onclick=refreshIlspy;

$("#setupIlspy").onclick=async()=>{
  const btn=$("#setupIlspy");btn.disabled=true;
  $("#ilspyInstallProgress").classList.remove("hidden");$("#ilspyInstallText").textContent="正在安装 ILSpyCmd...";
  try{
    const d=await readJson(await fetch("/api/tools/ilspycmd/setup",{method:"POST"}));
    $("#ilspySetupLog").textContent=`完成\n路径：${d.path}\n\n${d.log||""}`;
    $("#ilspyInstallText").textContent="安装完成";await refreshIlspy();
  }catch(e){$("#ilspySetupLog").textContent="失败：\n"+e.message;$("#ilspyInstallText").textContent="安装失败"}
  finally{btn.disabled=false;setTimeout(()=>$("#ilspyInstallProgress").classList.add("hidden"),1000)}
};


function renderSetupAllSteps(steps){
  $("#setupAllSteps").innerHTML=(steps||[]).map(x=>{
    const ok=x.status!=="failed";
    return `<span class="setup-step ${ok?"ok":"fail"}">${esc(x.tool)}：${esc(x.status==="ready"?"已就绪":x.status==="installed"?"已安装":"失败")}</span>`;
  }).join("");
}

$("#setupAllTools").onclick=async()=>{
  const btn=$("#setupAllTools");
  btn.disabled=true;
  $("#setupAllPanel").classList.remove("hidden");
  $("#setupAllTitle").textContent="正在检查并安装缺失插件...";
  $("#setupAllSteps").innerHTML='<span class="setup-step">Il2CppDumper</span><span class="setup-step">Cpp2IL</span><span class="setup-step">ILSpyCmd</span>';

  try{
    const d=await readJson(await fetch("/api/tools/setup-all",{method:"POST"}));
    renderSetupAllSteps(d.steps);
    $("#setupAllTitle").textContent=d.ok?"全部插件已准备完成":"部分插件安装失败";
    await Promise.all([refreshTool(),refreshCpp2il(),refreshIlspy()]);
  }catch(e){
    $("#setupAllTitle").textContent="一键安装失败："+e.message;
  }finally{
    btn.disabled=false;
  }
};

async function refreshSourceStatus(){
  if(!projectId){$("#sourceFileMetric").textContent="0";return}
  try{
    const d=await readJson(await fetch(`/api/project/${projectId}/source/status`));
    $("#sourceFileMetric").textContent=d.source_file_count||0;
  }catch{$("#sourceFileMetric").textContent="0"}
}


function setParserExpanded(expanded){
  $("#parserPanel").classList.toggle("hidden",!expanded);
  $("#toggleParsers").textContent=expanded?"收起解析器":"管理解析器";
}
$("#toggleParsers").onclick=()=>setParserExpanded($("#parserPanel").classList.contains("hidden"));
setParserExpanded(false);





$("#setupTool").onclick=async()=>{const btn=$("#setupTool");btn.disabled=true;$("#dumperInstallProgress").classList.remove("hidden");$("#dumperInstallText").textContent="正在下载并编译...";try{const d=await readJson(await fetch("/api/tools/il2cppdumper/setup",{method:"POST"}));$("#setupLog").textContent=`完成\n路径：${d.path}\n\n${d.log||""}`;$("#dumperInstallText").textContent="安装完成";await refreshTool()}catch(e){$("#setupLog").textContent="失败：\n"+e.message;$("#dumperInstallText").textContent="安装失败"}finally{btn.disabled=false;setTimeout(()=>$("#dumperInstallProgress").classList.add("hidden"),1000)}};
$("#setupCpp2il").onclick=async()=>{const btn=$("#setupCpp2il");btn.disabled=true;$("#cpp2ilInstallProgress").classList.remove("hidden");$("#cpp2ilInstallText").textContent="正在下载并编译兼容版...";try{const d=await readJson(await fetch("/api/tools/cpp2il/setup",{method:"POST"}));$("#cpp2ilSetupLog").textContent=`完成\n路径：${d.path}\n\n${d.log||""}`;$("#cpp2ilInstallText").textContent="安装完成";await refreshCpp2il()}catch(e){$("#cpp2ilSetupLog").textContent="失败：\n"+e.message;$("#cpp2ilInstallText").textContent="安装失败"}finally{btn.disabled=false;setTimeout(()=>$("#cpp2ilInstallProgress").classList.add("hidden"),1000)}};
$("#reselectTool").onclick=async()=>{try{const d=await readJson(await fetch("/api/tools/il2cppdumper/reselect",{method:"POST"}));$("#setupLog").textContent=`已重新选择：\n${d.path}`;await refreshTool()}catch(e){$("#setupLog").textContent="失败：\n"+e.message}};

async function copyText(target,btn){const text=document.getElementById(target)?.textContent||"";if(!text.trim())return;try{await navigator.clipboard.writeText(text)}catch{const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}const old=btn.textContent;btn.textContent="已复制";setTimeout(()=>btn.textContent=old,1000)}
document.addEventListener("click",e=>{const b=e.target.closest(".copy-log");if(b)copyText(b.dataset.target,b)});

const drop=$("#drop"),fileInput=$("#file");drop.onclick=()=>fileInput.click();drop.ondragover=e=>{e.preventDefault();drop.classList.add("drag")};drop.ondragleave=()=>drop.classList.remove("drag");drop.ondrop=e=>{e.preventDefault();drop.classList.remove("drag");if(e.dataTransfer.files.length)upload(e.dataTransfer.files[0])};fileInput.onchange=()=>{if(fileInput.files.length)upload(fileInput.files[0])};

async function upload(file){$("#progress").textContent=`正在解析：${file.name}`;const fd=new FormData();fd.append("file",file);try{const d=await readJson(await fetch("/api/upload",{method:"POST",body:fd}));projectId=d.project_id;currentProject=d;renderSummary(d);$("#workArea").classList.remove("hidden");$("#progress").textContent="解析完成";await loadIndex();}catch(e){$("#progress").textContent="解析失败："+e.message}}
function renderSummary(d){const vals=[["文件",d.filename],["包名",d.package_name||"未识别"],["引擎",d.engine],["Backend",d.backend],["Unity版本",d.unity_version||"未识别"],["Metadata",d.metadata_version??"未识别"],["架构",(d.architectures||[]).join(", ")||"未识别"],["libil2cpp.so",(d.files_found?.libil2cpp||[]).length],["metadata",(d.files_found?.metadata||[]).length],["DEX",(d.files_found?.dex||[]).length]];$("#summary").innerHTML=vals.map(([k,v])=>`<div class="kv"><div class="k">${esc(k)}</div><div class="v" title="${esc(v)}">${esc(v)}</div></div>`).join("");$("#engineSummary").textContent=`${d.engine||"unknown"} · ${d.backend||"unknown"} · metadata v${d.metadata_version??"?"}`}

function fmtElapsed(sec){sec=Number(sec||0);return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,"0")).join(":")}
function setRunning(running){$("#runDumper").disabled=running;$("#runCpp2il").disabled=running;$("#autoAnalyze").disabled=running;$("#decompileCsharp").disabled=running;$("#stopTask").disabled=!running}
function renderTask(d){$("#runtimeState").classList.remove("hidden");$("#taskState").textContent=d.status||"-";$("#elapsed").textContent=fmtElapsed(d.elapsed_seconds);const fallback=activeTaskKind==="decompile"?`ILSpyCmd 正在重建 C# 源码${d.source_file_count?`，已生成 ${d.source_file_count} 个文件`:"..."}`:"等待分析器输出...";$("#toolLog").textContent=d.log_text||d.error||fallback;setRunning(["pending","running","waiting_input"].includes(d.status));if(d.wait_kind){$("#inputPanel").classList.remove("hidden");$("#sendZero").classList.add("hidden");if(d.wait_kind==="dump_address"){$("#inputHint").textContent="检测到 dump 文件，可发送 0 强制继续。";$("#sendZero").classList.remove("hidden")}else if(d.wait_kind==="code_registration")$("#inputHint").textContent="需要 CodeRegistration 地址。";else $("#inputHint").textContent="需要 MetadataRegistration 地址。"}else $("#inputPanel").classList.add("hidden");if(d.index){currentIndex=d.index;renderIndex(d.index)}}
async function pollTask(){if(!activeTaskId||pollInFlight)return;pollInFlight=true;const taskId=activeTaskId,taskKind=activeTaskKind,taskProjectId=projectId;try{const url=taskKind==="cpp2il"
  ? `/api/project/${taskProjectId}/cpp2il-task/${taskId}`
  : taskKind==="decompile"
    ? `/api/project/${taskProjectId}/decompile-task/${taskId}`
    : taskKind==="native"
      ? `/api/project/${taskProjectId}/native-task/${taskId}`
    : `/api/project/${taskProjectId}/task/${taskId}`;const d=await readJson(await fetch(url));
  if(taskId!==activeTaskId||taskKind!==activeTaskKind||taskProjectId!==projectId)return;
  renderTask(d);if(["done","failed","stopped"].includes(d.status)){
  clearInterval(pollTimer);pollTimer=null;activeTaskId=null;setRunning(false);refreshSourceStatus();
  if(taskKind==="decompile"){
    if(d.status==="done" && (d.source_file_count||0)>0){
      $("#decompileHint").className="action-hint ok";
      $("#decompileHint").textContent=`完成：${d.source_file_count} 个 C# 文件`;
    }else{
      $("#decompileHint").className="action-hint fail";
      $("#decompileHint").textContent="反编译失败/未生成源码，点击分析日志查看";
      document.querySelector(".run-details").open=true;
    }
  }
}}catch(e){$("#toolLog").textContent+="\n轮询失败："+e.message}finally{pollInFlight=false}}
async function startAnalysis(tool){
  if(!projectId)return;
  setRunning(true);
  activeTaskKind=tool;
  if(tool==="decompile"){
    $("#decompileHint").className="action-hint busy";
    $("#decompileHint").textContent="正在启动反编译...";
  }
  $("#runtimeState").classList.remove("hidden");
  $("#taskState").textContent="starting";
  $("#elapsed").textContent="00:00:00";
  $("#toolLog").textContent=`正在启动 ${tool==="cpp2il"?"Cpp2IL":tool==="decompile"?"C# 反编译":"Il2CppDumper"}...\n`;
  try{const d=await readJson(await fetch(`/api/project/${projectId}/run`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool})}));activeTaskId=d.task.task_id;renderTask(d.task);if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(pollTask,500);await pollTask()}catch(e){
    $("#taskState").textContent="failed";
    $("#toolLog").textContent="启动失败：\n"+e.message;
    document.querySelector(".run-details").open=true;
    if(tool==="decompile"){
      $("#decompileHint").className="action-hint fail";
      $("#decompileHint").textContent="反编译启动失败，已展开日志";
    }
    setRunning(false);
  }
}
$("#runCpp2il").onclick=()=>startAnalysis("cpp2il");$("#runDumper").onclick=()=>startAnalysis("il2cppdumper");$("#decompileCsharp").onclick=async()=>{ $("#decompileHint").textContent="正在检查插件..."; await startAnalysis("decompile"); };$("#autoAnalyze").onclick=()=>{const v=Number(currentProject?.metadata_version||0);startAnalysis(v>31?"cpp2il":"il2cppdumper")};
$("#analyzeNative").onclick=async()=>{
  if(!projectId)return;setRunning(true);activeTaskKind="native";$("#toolLog").textContent="正在提取关键类 ARM 原生逻辑...\n";
  try{const d=await readJson(await fetch(`/api/project/${projectId}/native-analysis`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({types:[]})}));activeTaskId=d.task.task_id;renderTask(d.task);if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(pollTask,500);await pollTask()}catch(e){$("#toolLog").textContent="原生分析启动失败：\n"+e.message;setRunning(false)}
};
$("#stopTask").onclick=async()=>{if(!activeTaskId)return;try{await fetch(`/api/project/${projectId}/task/${activeTaskId}/stop`,{method:"POST"});if(pollTimer)clearInterval(pollTimer);activeTaskId=null;setRunning(false);$("#taskState").textContent="stopped"}catch(e){$("#toolLog").textContent+="\n终止失败："+e.message}};
$("#sendInput").onclick=async()=>{if(!activeTaskId)return;const value=$("#taskInput").value.trim();if(!value)return;await readJson(await fetch(`/api/project/${projectId}/task/${activeTaskId}/input`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value})}));$("#taskInput").value="";await pollTask()};$("#sendZero").onclick=()=>{$("#taskInput").value="0";$("#sendInput").click()};

$("#reindex").onclick=async()=>{if(!projectId)return;currentIndex=await readJson(await fetch(`/api/project/${projectId}/reindex`,{method:"POST"}));renderIndex(currentIndex)};
$("#export").onclick=()=>{if(projectId)location.href=`/api/project/${projectId}/export`};
$("#exportSource").onclick=async()=>{
  if(!projectId)return;
  const btn=$("#exportSource"),old=btn.textContent;
  btn.disabled=true;btn.textContent="正在打包...";
  try{
    const r=await fetch(`/api/project/${projectId}/export-source`);
    if(!r.ok){let message=`HTTP ${r.status}`;try{const d=await r.json();message=d.detail||message}catch{}throw new Error(message)}
    const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
    const disposition=r.headers.get("content-disposition")||"";
    const match=disposition.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
    a.href=url;a.download=match?decodeURIComponent(match[1]):`${projectId}-reconstructed-source.zip`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    btn.textContent="已导出";
  }catch(e){
    $("#decompileHint").className="action-hint fail";
    $("#decompileHint").textContent="导出源码失败："+e.message;
  }finally{setTimeout(()=>{btn.disabled=false;btn.textContent=old},1000)}
};
async function loadIndex(){if(!projectId)return;currentIndex=await readJson(await fetch(`/api/project/${projectId}/index`));renderIndex(currentIndex);await refreshSourceStatus()}

function itemHtml(x){
  const isClass=!x.kind || x.kind==="class";
  const cls=isClass?"item clickable":"item";
  const attr=isClass?` data-class-name="${esc(x.name)}"`:"";
  return `<div class="${cls}"${attr}><div class="item-name">${esc(x.name)}${x.assembly?`<span class="assembly-tag">${esc(x.assembly)}</span>`:""}</div><div class="item-meta">${x.score?`score ${x.score} · `:""}${esc(x.file||"")}</div></div>`;
}
function renderIndex(idx){$("#workArea").classList.remove("hidden");$("#gameClassMetric").textContent=idx.game_class_count||0;$("#gameMethodMetric").textContent=idx.game_method_count||0;$("#gameFieldMetric").textContent=idx.game_field_count||0;$("#allClassMetric").textContent=idx.class_count||0;const candidates=(idx.candidates||[]);$("#candidateCount").textContent=candidates.length;$("#candidates").innerHTML=candidates.slice(0,250).map(itemHtml).join("")||`<div class="empty-state">没有找到游戏核心类候选</div>`;}
async function doSearch(){if(!projectId)return;const q=$("#query").value.trim();if(!q)return;const scope=$("#searchAll").checked?"all":"game";$("#searchScopeText").textContent=`当前范围：${scope==="all"?"全部程序集":"游戏代码"}`;try{const d=await readJson(await fetch(`/api/project/${projectId}/search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,limit:300,scope})}));const rows=d.results||[];$("#resultCount").textContent=rows.length;$("#results").classList.remove("empty-state");$("#results").innerHTML=rows.map(itemHtml).join("")||`<div class="empty-state">没有找到匹配项</div>`}catch(e){$("#results").innerHTML=`<div class="empty-state">${esc(e.message)}</div>`}}
$("#searchBtn").onclick=doSearch;$("#query").onkeydown=e=>{if(e.key==="Enter")doSearch()};$("#searchAll").onchange=()=>{$("#searchScopeText").textContent=`当前范围：${$("#searchAll").checked?"全部程序集":"游戏代码"}`};


function openDrawer(){ $("#classDrawerBackdrop").classList.remove("hidden");$("#classDrawer").classList.remove("hidden");document.body.style.overflow="hidden" }
function closeDrawer(){ $("#classDrawerBackdrop").classList.add("hidden");$("#classDrawer").classList.add("hidden");document.body.style.overflow="" }
$("#closeDrawer").onclick=closeDrawer;$("#classDrawerBackdrop").onclick=closeDrawer;

function memberHtmlField(x){return `<div class="member"><span class="member-type">${esc(x.type||"")}</span> <span class="member-name">${esc(x.name||"")}</span></div>`}
function memberHtmlMethod(x){const labels={logic:"真实逻辑",stub:"空壳",declaration:"声明"};return `<div class="member"><span class="method-quality ${esc(x.quality||"declaration")}">${labels[x.quality]||"未知"}</span> <span class="member-type">${esc(x.return_type||"")}</span> <span class="member-name">${esc(x.name||"")}</span>(${esc(x.parameters||"")})</div>`}

async function showClassDetail(name){
  if(!projectId)return;
  openDrawer();
  $("#detailClassName").textContent=name;
  $("#detailNamespace").textContent="正在读取重建源码...";
  $("#detailUnavailable").classList.add("hidden");
  $("#detailBody").classList.add("hidden");

  try{
    const d=await readJson(await fetch(`/api/project/${projectId}/class-detail?name=${encodeURIComponent(name)}`));
    if(!d.available){
      $("#detailUnavailable").textContent=d.message||"没有可用源码";
      $("#detailUnavailable").classList.remove("hidden");
      $("#detailNamespace").textContent="";
      return;
    }

    $("#detailClassName").textContent=d.resolved_name||d.name;
    $("#detailNamespace").textContent=d.namespace?`namespace ${d.namespace}`:"全局命名空间";
    $("#detailFieldCount").textContent=d.field_count||0;
    $("#detailMethodCount").textContent=d.method_count||0;
    $("#detailLogicCount").textContent=d.quality?.logic||0;
    $("#detailStubCount").textContent=d.quality?.stub||0;
    const grade=d.quality?.grade||"skeleton",gradeText={skeleton:"仅类型骨架",partial:"部分方法可用",usable:"方法体较完整"};
    $("#detailQuality").className=`quality-banner ${grade}`;
    $("#detailQuality").textContent=`反编译质量：${gradeText[grade]||grade} · 有效逻辑比例 ${Math.round((d.quality?.logic_ratio||0)*100)}%`;
    $("#detailFile").textContent=d.file||"";
    $("#detailFields").innerHTML=(d.fields||[]).map(memberHtmlField).join("")||'<div class="member">无字段</div>';
    $("#detailMethods").innerHTML=(d.methods||[]).map(memberHtmlMethod).join("")||'<div class="member">无方法</div>';
    $("#detailSource").textContent=d.source||"";
    $("#nativeUnavailable").classList.toggle("hidden",!!d.native_available);
    $("#detailNative").classList.toggle("hidden",!d.native_available);
    $("#detailNative").textContent=d.native_disassembly||"";
    $("#detailBody").classList.remove("hidden");
  }catch(e){
    $("#detailUnavailable").textContent="读取类详情失败："+e.message;
    $("#detailUnavailable").classList.remove("hidden");
  }
}

document.addEventListener("click",e=>{
  const item=e.target.closest(".item.clickable[data-class-name]");
  if(item)showClassDetail(item.dataset.className);
});
$("#copySource").onclick=async()=>{
  const text=$("#detailSource").textContent||"";
  if(!text)return;
  try{await navigator.clipboard.writeText(text)}catch{}
  const old=$("#copySource").textContent;$("#copySource").textContent="已复制";setTimeout(()=>$("#copySource").textContent=old,900);
};
$("#copyNative").onclick=async()=>{const text=$("#detailNative").textContent||"";if(!text)return;try{await navigator.clipboard.writeText(text)}catch{}const old=$("#copyNative").textContent;$("#copyNative").textContent="已复制";setTimeout(()=>$("#copyNative").textContent=old,900)};
