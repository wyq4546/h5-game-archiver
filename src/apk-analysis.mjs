import { mkdir, readFile, writeFile, readdir, rm, cp, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_RIPPER_EXE = path.join(PROJECT_ROOT, "tools", "AssetRipper", "AssetRipper.GUI.Free.exe");

async function getFreePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

async function waitHttp(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`连接 AssetRipper 超时 (${url})`);
}

async function walkFiles(dir, base = dir, list = []) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(full, base, list);
    } else if (entry.isFile()) {
      list.push({
        full,
        relative: path.relative(base, full).replaceAll("\\", "/")
      });
    }
  }
  return list;
}

export async function analyzeApkGame(archiveRoot, manifest, onEvent = () => {}) {
  const emit = (message, details = {}) => onEvent({ time: new Date().toISOString(), type: "analysis", message, ...details });
  emit("开始分析 Android 安装包业务源码与关卡配置");

  const analysisRoot = path.join(archiveRoot, "analysis");
  const scriptsRoot = path.join(archiveRoot, "scripts");
  const reconstructedSourceRoot = path.join(analysisRoot, "reconstructed_source");
  const assembliesRoot = path.join(analysisRoot, "assemblies");
  const il2cppRoot = path.join(analysisRoot, "il2cpp");

  await Promise.all([
    rm(reconstructedSourceRoot, { recursive: true, force: true }),
    rm(assembliesRoot, { recursive: true, force: true }),
    rm(il2cppRoot, { recursive: true, force: true })
  ]);
  await Promise.all([
    mkdir(analysisRoot, { recursive: true }),
    mkdir(scriptsRoot, { recursive: true }),
    mkdir(il2cppRoot, { recursive: true })
  ]);

  // Find APK file
  const archiveDir = path.join(archiveRoot, "archive");
  const archiveFiles = await readdir(archiveDir).catch(() => []);
  const apkFilename = archiveFiles.find(f => /\.apk$/i.test(f)) || manifest.apk?.filename;
  if (!apkFilename) {
    throw new Error("archive/ 目录中未找到 APK 原文件");
  }
  const apkPath = path.join(archiveDir, apkFilename);

  const engine = manifest.runtimeInspection?.engine || manifest.apk?.engine || "Unity (Android / IL2CPP)";
  const isUnity = engine.toLowerCase().includes("unity") || manifest.apk?.backend === "il2cpp";

  let totalCsFiles = 0;
  let gameCsFiles = 0;
  const projectClasses = [];
  const gameplayClasses = [];
  let levelSummary = { kind: "unknown", total: null, evidence: [] };

  if (isUnity) {
    emit("正在启动 AssetRipper 引擎反编译 IL2CPP 脚本...", { tool: "AssetRipper" });
    const port = await getFreePort();
    const tempExportDir = path.join(analysisRoot, ".temp_ripper_export");
    await rm(tempExportDir, { recursive: true, force: true });
    await mkdir(tempExportDir, { recursive: true });

    const ripperChild = spawn(ASSET_RIPPER_EXE, [
      "--headless", "--port", String(port)
    ], { windowsHide: true, stdio: "ignore" });

    try {
      await waitHttp(`http://127.0.0.1:${port}/`);
      emit("AssetRipper 反编译服务已就绪，正在加载 APK 并还原 C# 代码与资产引用...");

      // 1) Load APK
      const loadResp = await fetch(`http://127.0.0.1:${port}/LoadFile`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Path: apkPath }).toString()
      });
      if (!loadResp.ok && loadResp.status !== 302) {
        throw new Error(`AssetRipper 加载 APK 失败：HTTP ${loadResp.status}`);
      }

      // 2) Export PrimaryContent
      emit("正在导出反编译的 C# 源码和程序集...");
      const expResp = await fetch(`http://127.0.0.1:${port}/Export/PrimaryContent`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Path: tempExportDir }).toString()
      });
      if (!expResp.ok && expResp.status !== 302) {
        throw new Error(`AssetRipper 导出源码失败：HTTP ${expResp.status}`);
      }

      // Move exported folders
      const exportedScripts = path.join(tempExportDir, "Scripts");
      const exportedAssemblies = path.join(tempExportDir, "Assemblies");
      await cp(exportedScripts, reconstructedSourceRoot, { recursive: true }).catch(() => {});
      await cp(exportedAssemblies, assembliesRoot, { recursive: true }).catch(() => {});

      emit("C# 源码反编译完成，开始解析类结构与关卡常量...");
    } finally {
      ripperChild.kill();
      await rm(tempExportDir, { recursive: true, force: true }).catch(() => {});
      // Clean AssetRipper temp folder
      const ripperTemp = path.join(PROJECT_ROOT, "tools", "AssetRipper", "temp");
      await rm(ripperTemp, { recursive: true, force: true }).catch(() => {});
    }

    // Scan decompiled C# scripts
    const allScripts = await walkFiles(reconstructedSourceRoot);
    const csFiles = allScripts.filter(f => f.relative.endsWith(".cs"));
    totalCsFiles = csFiles.length;

    const ENGINE_MODULES = /^(?:UnityEngine|Unity\.|System|mscorlib|Mono\.|GoogleMobileAds|__Generated)/i;
    const gameScripts = csFiles.filter(f => {
      const topDir = f.relative.split("/")[0] || "";
      return !ENGINE_MODULES.test(topDir);
    });
    gameCsFiles = gameScripts.length;

    // Detect level summary from Constants.cs or Scene*.cs
    const sceneNumbers = new Set();
    let maxConstantStage = null;
    let constantEvidenceFile = null;

    for (const script of csFiles) {
      const filename = path.basename(script.relative);
      const sceneMatch = filename.match(/Scene(?:Moto)?(\d{1,4})\.cs$/i);
      if (sceneMatch) {
        sceneNumbers.add(Number(sceneMatch[1]));
      }

      // Read small files or files named Constants / Level / Config
      if (/(?:Constant|Config|Level|Stage|GameManager)/i.test(filename)) {
        try {
          const content = await readFile(script.full, "utf8");
          const constMatch = content.match(/\b(?:STAGE_NUM_MAX|MAX_STAGE|MAX_LEVEL|TOTAL_LEVELS|STAGE_COUNT)\s*=\s*(\d+)\b/i);
          if (constMatch) {
            maxConstantStage = Number(constMatch[1]);
            constantEvidenceFile = script.relative;
          }
        } catch {}
      }
    }

    if (maxConstantStage && maxConstantStage > 0) {
      levelSummary = {
        kind: "finite",
        total: maxConstantStage,
        evidence: [
          {
            file: `analysis/reconstructed_source/${constantEvidenceFile}`,
            detail: `STAGE_NUM_MAX = ${maxConstantStage} 关卡常量声明`
          }
        ]
      };
      if (sceneNumbers.size > 0) {
        levelSummary.evidence.push({
          file: `analysis/reconstructed_source/`,
          detail: `包含 ${sceneNumbers.size} 个 Scene*.cs 独立关卡脚本`
        });
      }
    } else if (sceneNumbers.size > 0) {
      const maxScene = Math.max(...sceneNumbers);
      levelSummary = {
        kind: "finite",
        total: maxScene,
        evidence: [
          {
            file: `analysis/reconstructed_source/`,
            detail: `包含 ${sceneNumbers.size} 个关卡场景脚本（最大关号 ${maxScene}）`
          }
        ]
      };
    }

    // Extract classes
    for (const script of (gameScripts.length ? gameScripts : csFiles.slice(0, 50))) {
      try {
        const text = await readFile(script.full, "utf8");
        for (const line of text.split(/\r?\n/)) {
          const classMatch = line.match(/(?:public|internal)?\s*(?:abstract|sealed|static|partial)*\s*class\s+([A-Za-z0-9_]+)/);
          if (classMatch) {
            const className = classMatch[1];
            const item = {
              name: className,
              file: script.relative
            };
            projectClasses.push(item);
            if (/(Game|Player|Level|Stage|Block|Ball|Racket|Item|Scene|Ad|Save)/i.test(className)) {
              gameplayClasses.push(item);
            }
          }
        }
      } catch {}
    }

    await writeFile(path.join(il2cppRoot, "project-classes.json"), JSON.stringify({ classes: projectClasses.length, items: projectClasses }, null, 2));
    await writeFile(path.join(il2cppRoot, "gameplay-classes.json"), JSON.stringify({ classes: gameplayClasses.length, items: gameplayClasses }, null, 2));
  }

  // Save level summary
  await writeFile(path.join(analysisRoot, "level-summary.json"), JSON.stringify(levelSummary, null, 2));

  // Build report.json
  const report = {
    version: 4,
    generatedAt: new Date().toISOString(),
    engine,
    engineConfidence: "high",
    captureRoot: archiveRoot,
    analysisRoot,
    counts: {
      files: totalCsFiles,
      textSources: totalCsFiles,
      gameTextSources: gameCsFiles,
      il2cppGameplayClasses: gameplayClasses.length
    },
    il2cpp: {
      status: "completed",
      gameplayClasses: gameplayClasses.length
    },
    levelSummary,
    limitations: "这是基于 APK 发布产物自动反编译出的 C# 业务源码，包含完整的类声明、字段、常量与关卡场景逻辑。"
  };
  await writeFile(path.join(analysisRoot, "report.json"), JSON.stringify(report, null, 2));

  // Save source index
  const sourceIndex = {
    packageType: "apk",
    engine,
    totalCsFiles,
    gameCsFiles,
    gameplayClasses: gameplayClasses.map(c => c.name)
  };
  await writeFile(path.join(analysisRoot, "source-index.json"), JSON.stringify(sourceIndex, null, 2));

  // Automation context
  const automationContext = {
    engine,
    packageType: "apk",
    counts: report.counts,
    levelSummary,
    il2cpp: report.il2cpp
  };
  await writeFile(path.join(analysisRoot, "automation-context.json"), JSON.stringify(automationContext, null, 2));
  await writeFile(path.join(scriptsRoot, "automation-context.json"), JSON.stringify(automationContext, null, 2));

  // README
  const readme = [
    `# ${manifest.gameTitle || "Android Game"} 源码与反编译分析`,
    "",
    `- 引擎：${engine}`,
    `- 反编译 C# 脚本总数：${totalCsFiles}`,
    `- 核心玩法脚本：${gameCsFiles}`,
    `- 识别总关卡数：${levelSummary.total ? `${levelSummary.total} 关` : "待确认"}`,
    "",
    "## 产物结构",
    "- report.json：分析总报告与关卡信息",
    "- level-summary.json：关卡总数与判定证据",
    "- reconstructed_source/：反编译出的完整 C# 代码",
    "- assemblies/：恢复的 DLL 程序集",
    "- il2cpp/gameplay-classes.json：玩法控制类索引"
  ].join("\n");
  await writeFile(path.join(analysisRoot, "README.md"), readme, "utf8");

  emit(`源码解析完成：共反编译 ${totalCsFiles} 个 C# 脚本，识别 ${levelSummary.total ? `${levelSummary.total} 个关卡` : "关卡待确认"}`);
  return report;
}
