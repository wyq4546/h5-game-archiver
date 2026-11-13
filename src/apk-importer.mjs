import { mkdir, readFile, writeFile, rm, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { archiveDirectoryName, normalizeGameTitle } from "./game-name.mjs";
import { saveCover } from "./archive-cover.mjs";
import { writeArchiveLaunchers } from "./launchers.mjs";

const runFile = promisify(execFile);

function readStringPool(b, chunkPos) {
  const hSize = b.readUInt16LE(chunkPos + 2);
  const strCount = b.readUInt32LE(chunkPos + 8);
  const flags = b.readUInt32LE(chunkPos + 16);
  const strStart = chunkPos + b.readUInt32LE(chunkPos + 20);
  const utf8 = (flags & 0x100) !== 0;
  const out = [];
  for (let i = 0; i < strCount; i++) {
    let off = strStart + b.readUInt32LE(chunkPos + hSize + i * 4);
    if (utf8) {
      if (b[off] & 0x80) off += 2; else off += 1;
      let len = b[off];
      if (len & 0x80) { len = ((len & 0x7f) << 8) | b[off + 1]; off += 2; } else off += 1;
      out.push(b.subarray(off, off + len).toString("utf8"));
    } else {
      let len = b.readUInt16LE(off);
      if (len & 0x8000) { len = ((len & 0x7fff) << 16) | b.readUInt16LE(off + 2); off += 4; } else off += 2;
      out.push(b.subarray(off, off + len * 2).toString("utf16le"));
    }
  }
  return out;
}

export function parseAxml(b) {
  if (b.length < 8 || b.readUInt32LE(0) !== 0x00080003) return null;
  const spHeaderSize = b.readUInt16LE(10), spSize = b.readUInt32LE(12);
  const strings = readStringPool(b, 8);
  let pos = 8 + spSize;
  const resIds = [];
  const result = { packageName: null, versionName: null, versionCode: null, labelResId: 0, iconResId: 0, label: null, icon: null };
  while (pos + 8 <= b.length) {
    const type = b.readUInt16LE(pos), hSize = b.readUInt16LE(pos + 2), size = b.readUInt32LE(pos + 4);
    if (size < 8) break;
    if (type === 0x0180) {
      for (let p = pos + hSize; p + 4 <= pos + size; p += 4) resIds.push(b.readUInt32LE(p));
    } else if (type === 0x0102) {
      const nameIdx = b.readInt32LE(pos + 20), attrStart = b.readUInt16LE(pos + 24), attrSize = b.readUInt16LE(pos + 26), attrCount = b.readUInt16LE(pos + 28);
      const tag = strings[nameIdx];
      for (let i = 0; i < attrCount; i++) {
        const a = pos + 16 + attrStart + i * attrSize;
        const aNameIdx = b.readInt32LE(a + 4), rawVal = b.readInt32LE(a + 8), dType = b[a + 15], dVal = b.readUInt32LE(a + 16);
        const resId = aNameIdx >= 0 && aNameIdx < resIds.length ? resIds[aNameIdx] : 0;
        const name = strings[aNameIdx] || "";
        if (tag === "manifest") {
          if (name === "package") result.packageName = dType === 3 ? strings[dVal] : (rawVal >= 0 ? strings[rawVal] : null);
          if (resId === 0x0101021b) result.versionCode = dVal;
          if (resId === 0x0101021c) result.versionName = dType === 3 ? strings[dVal] : (rawVal >= 0 ? strings[rawVal] : String(dVal));
        } else if (tag === "application") {
          if (resId === 0x01010001) {
            if (dType === 1) result.labelResId = dVal;
            else if (dType === 3) result.label = strings[dVal];
          }
          if (resId === 0x01010002) {
            if (dType === 1) result.iconResId = dVal;
            else if (dType === 3) result.icon = strings[dVal];
          }
        }
      }
    }
    pos += size;
  }
  return result;
}

export function parseArsc(b, targetIds) {
  const found = new Map();
  if (b.length < 8 || b.readUInt16LE(0) !== 0x0002) return found;
  let pos = b.readUInt16LE(2), globalStrings = [];
  while (pos + 8 <= b.length) {
    const type = b.readUInt16LE(pos), hSize = b.readUInt16LE(pos + 2), size = b.readUInt32LE(pos + 4);
    if (size < 8) break;
    if (type === 0x0001) {
      globalStrings = readStringPool(b, pos);
    } else if (type === 0x0200) {
      const pkgId = b.readUInt32LE(pos + 8);
      let p = pos + hSize;
      while (p + 8 <= pos + size) {
        const cType = b.readUInt16LE(p), cHSize = b.readUInt16LE(p + 2), cSize = b.readUInt32LE(p + 4);
        if (cSize < 8) break;
        if (cType === 0x0201) {
          const typeId = b[p + 8], entryCount = b.readUInt32LE(p + 12), entriesStart = p + b.readUInt32LE(p + 16), flags = b[p + 9];
          const density = b.readUInt16LE(p + 30);
          const sparse = (flags & 0x01) !== 0, offset16 = (flags & 0x02) !== 0;
          for (let i = 0; i < entryCount; i++) {
            let entryIdx = i, entryOff;
            if (sparse) { entryIdx = b.readUInt16LE(p + cHSize + i * 4); entryOff = b.readUInt16LE(p + cHSize + i * 4 + 2) * 4; }
            else if (offset16) { const o = b.readUInt16LE(p + cHSize + i * 2); if (o === 0xffff) continue; entryOff = o * 4; }
            else { const o = b.readInt32LE(p + cHSize + i * 4); if (o === -1) continue; entryOff = o; }
            const resId = ((pkgId << 24) | (typeId << 16) | entryIdx) >>> 0;
            if (!targetIds.has(resId)) continue;
            const ePos = entriesStart + entryOff;
            if (ePos + 8 > b.length) continue;
            const eSize = b.readUInt16LE(ePos), eFlags = b.readUInt16LE(ePos + 2);
            if ((eFlags & 0x0001) === 0) {
              const dType = (eFlags & 0x0004) ? b[ePos + 3] : b[ePos + eSize + 3];
              const dVal = (eFlags & 0x0004) ? b.readUInt32LE(ePos + 4) : b.readUInt32LE(ePos + eSize + 4);
              if (dType === 3 && globalStrings[dVal]) {
                if (!found.has(resId)) found.set(resId, []);
                found.get(resId).push({ value: globalStrings[dVal], density });
              }
            }
          }
        }
        p += cSize;
      }
    }
    pos += size;
  }
  return found;
}

export async function inspectApk(apkPath) {
  const tmpDir = path.join(path.dirname(apkPath), `.tmp-meta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(tmpDir, { recursive: true });
  try {
    await runFile("tar.exe", ["-xf", apkPath, "-C", tmpDir, "AndroidManifest.xml", "resources.arsc"], { windowsHide: true, timeout: 15000 }).catch(() => {});
    const axmlPath = path.join(tmpDir, "AndroidManifest.xml");
    const arscPath = path.join(tmpDir, "resources.arsc");
    let axml = null, arscMap = new Map();
    try {
      const axmlBuf = await readFile(axmlPath);
      axml = parseAxml(axmlBuf);
    } catch {}

    if (axml && (axml.labelResId || axml.iconResId)) {
      try {
        const arscBuf = await readFile(arscPath);
        const targetIds = new Set([axml.labelResId, axml.iconResId].filter(Boolean));
        arscMap = parseArsc(arscBuf, targetIds);
      } catch {}
    }

    const { stdout: tarList } = await runFile("tar.exe", ["-tf", apkPath], { windowsHide: true, timeout: 20000, maxBuffer: 10 * 1024 * 1024 });
    const entries = tarList.split(/\r?\n/).map(s => s.trim().replaceAll("\\", "/")).filter(Boolean);

    let resolvedLabel = axml?.label || null;
    if (axml?.labelResId && arscMap.has(axml.labelResId)) {
      resolvedLabel = arscMap.get(axml.labelResId)[0]?.value || resolvedLabel;
    }

    let iconCandidates = [];
    if (axml?.iconResId && arscMap.has(axml.iconResId)) {
      iconCandidates = arscMap.get(axml.iconResId).map(x => x.value);
    } else if (axml?.icon) {
      iconCandidates = [axml.icon];
    }

    // Engine and type detection
    const hasWebIndex = entries.some(e => /^assets\/(?:(?:www|web|public|html5)\/)?index\.html$/i.test(e));
    const webHtmlFiles = entries.filter(e => /^assets\/.*\.html$/i.test(e));
    const isWebView = hasWebIndex || webHtmlFiles.length > 0;

    const hasIl2Cpp = entries.some(e => e.includes("libil2cpp.so")) && entries.some(e => e.includes("global-metadata.dat"));
    const hasUnityMono = entries.some(e => e.includes("Assembly-CSharp.dll"));
    const hasUnityLib = entries.some(e => e.includes("libunity.so"));
    const isUnity = hasIl2Cpp || hasUnityMono || hasUnityLib;

    const hasCocos = entries.some(e => /libcocos2d.*\.so/i.test(e));
    const hasGodot = entries.some(e => /libgodot.*\.so/i.test(e));

    let engine = "Android App";
    let backend = "native";
    let apkType = "native-android";
    if (isWebView) {
      apkType = "webview";
      engine = "H5 / WebView";
      backend = "web";
    } else if (isUnity) {
      apkType = hasIl2Cpp ? "unity-il2cpp" : "unity-mono";
      engine = "Unity (Android / IL2CPP)";
      backend = hasIl2Cpp ? "il2cpp" : "mono";
    } else if (hasCocos) {
      apkType = "cocos-android";
      engine = "Cocos (Android)";
      backend = "native";
    } else if (hasGodot) {
      apkType = "godot-android";
      engine = "Godot (Android)";
      backend = "native";
    }

    return {
      packageName: axml?.packageName || null,
      versionName: axml?.versionName || null,
      versionCode: axml?.versionCode || null,
      label: resolvedLabel,
      iconCandidates,
      entries,
      apkType,
      engine,
      backend,
      isWebView
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function importApkArchive({ apkPath, originalFilename, downloadRoot, onEvent = () => {} }) {
  const emit = (message) => onEvent({ time: new Date().toISOString(), type: "info", message });
  emit(`开始解析安装包：${originalFilename}`);

  const info = await inspectApk(apkPath);
  emit(`检测到应用信息：包名 ${info.packageName || "未知"}，引擎 ${info.engine}`);

  const cleanedFilename = originalFilename.replace(/\.x?apk$/i, "").replaceAll("+", " ").replace(/_[\d.]+_APKPure$/i, "").trim();
  let rawTitle = info.label || cleanedFilename;
  if (info.label && cleanedFilename && cleanedFilename.length > info.label.length && cleanedFilename.toLowerCase().startsWith(info.label.toLowerCase())) {
    rawTitle = cleanedFilename;
  }
  const gameTitle = normalizeGameTitle(rawTitle) || "Android Game";

  const dirName = archiveDirectoryName(gameTitle);
  const targetRoot = path.join(downloadRoot, dirName);
  await mkdir(path.join(targetRoot, "archive"), { recursive: true });
  await mkdir(path.join(targetRoot, "game"), { recursive: true });
  await mkdir(path.join(targetRoot, "preview"), { recursive: true });
  await mkdir(path.join(targetRoot, "scripts"), { recursive: true });
  await mkdir(path.join(targetRoot, "analysis"), { recursive: true });

  // Save the original APK to archive/
  const archiveApkName = originalFilename.endsWith(".apk") ? originalFilename : `${originalFilename}.apk`;
  const savedApkPath = path.join(targetRoot, "archive", archiveApkName);
  await copyFile(apkPath, savedApkPath);
  emit(`安装包已归档到 archive/${archiveApkName}`);

  // Unpack contents
  emit(`正在解包游戏主体文件到 game/...`);
  if (info.isWebView) {
    // For WebView wrap: extract only the web directory to game/
    const webEntry = info.entries.find(e => /^assets\/(?:(?:www|web|public|html5)\/)?index\.html$/i.test(e));
    const webSubdir = webEntry ? path.posix.dirname(webEntry) : "assets";
    await runFile("tar.exe", ["-xf", savedApkPath, "-C", path.join(targetRoot, "game"), webSubdir], { windowsHide: true, timeout: 60000 });
    // If index.html is nested inside game/assets/www/, hoist it up or write entry
    const candidateIndex = path.join(targetRoot, "game", webSubdir, "index.html");
    try {
      await readFile(candidateIndex);
      // Link or copy to game/index.html if needed
      if (path.resolve(candidateIndex) !== path.resolve(targetRoot, "game", "index.html")) {
        await copyFile(candidateIndex, path.join(targetRoot, "game", "index.html")).catch(() => {});
      }
    } catch {}
    await writeArchiveLaunchers(targetRoot);
  } else {
    // For Native / Unity: unpack all apk files into game/
    await runFile("tar.exe", ["-xf", savedApkPath, "-C", path.join(targetRoot, "game")], { windowsHide: true, timeout: 90000 });
  }

  // Extract cover icon
  let iconSaved = false;
  const tmpIconDir = path.join(targetRoot, "preview", ".tmp-icon");
  await mkdir(tmpIconDir, { recursive: true });
  try {
    const checkNames = [...(info.iconCandidates || [])];
    if (!checkNames.length) {
      checkNames.push(...info.entries.filter(e => /res\/(?:mipmap|drawable).*\.(?:png|webp)/i.test(e)));
    }
    // Sort by largest or specific density
    for (const iconRel of checkNames) {
      try {
        await runFile("tar.exe", ["-xf", savedApkPath, "-C", tmpIconDir, iconRel], { windowsHide: true, timeout: 10000 });
        const extractedIcon = path.join(tmpIconDir, iconRel);
        const iconBuf = await readFile(extractedIcon);
        if (iconBuf && iconBuf.length >= 1000) {
          await saveCover(targetRoot, iconBuf, { source: "apk-icon", title: gameTitle });
          iconSaved = true;
          emit(`已成功提取高清游戏图标作为封面`);
          break;
        }
      } catch {}
    }
  } finally {
    await rm(tmpIconDir, { recursive: true, force: true }).catch(() => {});
  }

  // Generate manifest.json
  const coreFiles = [];
  if (info.engine.includes("Unity")) {
    const foundCore = info.entries.filter(e => e.includes("libil2cpp.so") || e.includes("global-metadata.dat") || e.includes("Assembly-CSharp.dll"));
    coreFiles.push(...foundCore);
  } else if (info.isWebView) {
    coreFiles.push("game/index.html");
  }

  const manifest = {
    packageType: "apk",
    gameTitle,
    resolvedGameName: gameTitle,
    sourceUrl: `local-apk:${originalFilename}`,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    apk: {
      filename: originalFilename,
      packageName: info.packageName,
      versionName: info.versionName,
      versionCode: info.versionCode,
      engine: info.engine,
      backend: info.backend,
      apkType: info.apkType
    },
    runtimeInspection: {
      engine: info.engine,
      confidence: "high",
      coreReady: true,
      coreFiles: coreFiles.length ? coreFiles : ["archive/" + archiveApkName],
      coreRule: info.isWebView ? "包含完整的可直接运行的 Web/H5 资源" : "APK 包含完整 Android 运行时产物"
    },
    resources: [
      {
        url: `local-apk:${originalFilename}`,
        path: `archive/${archiveApkName}`,
        saved: true,
        type: "other"
      }
    ]
  };

  await writeFile(path.join(targetRoot, "archive", "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  // Generate README.txt and launchers
  const readmeContent = [
    `游戏：${gameTitle}`,
    `应用包名：${info.packageName || "未知"}`,
    `引擎架构：${info.engine} (${info.backend})`,
    "",
    "archive/         原始安装包与 manifest.json",
    "game/            解包后的游戏资源与动态库",
    "preview/         游戏应用图标与封面",
    "analysis/        C# 反编译源码、类与关卡索引",
    "scripts/         自动化与测试脚本",
    "",
    ...(info.isWebView ? [
      "启动：双击 start.cmd（可在浏览器直接启动离线运行）",
      "停止：双击 stop.cmd"
    ] : [
      "说明：本归档为 Android 原生安装包工程。点击管理界面中的「开始解析」可一键反编译提取 C# 源码和关卡数据。"
    ])
  ].join("\r\n");

  await writeFile(path.join(targetRoot, "README.txt"), readmeContent, "utf8");

  if (!info.isWebView) {
    await writeFile(path.join(targetRoot, "start.cmd"), `@echo off\r\necho 这是 Android 原生 APK 项目（${gameTitle}）。\r\necho 游戏主体与动态库在 game/，反编译源码在 analysis/。\r\npause\r\n`, "utf8");
    await writeFile(path.join(targetRoot, "stop.cmd"), `@echo off\r\necho 没有运行中的网页服务。\r\n`, "utf8");
  }

  // Pre-seed automation context
  const autoCtx = {
    engine: info.engine,
    packageType: "apk",
    packageName: info.packageName,
    prioritizedScripts: [],
    wasmFiles: [],
    unityDataFiles: [],
    il2cpp: { status: info.backend === "il2cpp" ? "ready-to-decompile" : "not-applicable" }
  };
  await writeFile(path.join(targetRoot, "scripts", "automation-context.json"), JSON.stringify(autoCtx, null, 2), "utf8");
  await writeFile(path.join(targetRoot, "scripts", "AUTOMATION.md"), `# ${gameTitle} 自动化指南\n\n点击管理系统中的「开始解析」可自动反编译并提取完整 C# 业务代码与关卡配置。\n`, "utf8");

  emit(`APK 已成功转换为标准归档项目：${dirName}`);
  return {
    archiveName: dirName,
    archiveRoot: targetRoot,
    gameTitle,
    engine: info.engine,
    iconSaved
  };
}
