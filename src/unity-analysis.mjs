import { spawn } from "node:child_process";
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repairIl2CppWasm } from "./il2cpp-wasm-repair.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNITY_WEB_DATA_MAGIC = Buffer.from("UnityWebData1.0\0");
const IL2CPP_DUMPER_SOURCE = path.join(
  PROJECT_ROOT,
  "integrations",
  "xapk-analyzer",
  "third_party",
  "Il2CppDumper",
  "Il2CppDumper",
  "bin",
  "Release",
  "net8.0"
);
const IL2CPP_DUMPER_BIN = path.join(PROJECT_ROOT, "tools", "Il2CppDumper-bin");
const IL2CPP_DUMPER_EXE = path.join(IL2CPP_DUMPER_BIN, "Il2CppDumper.exe");

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function walkFiles(root, current = root, output = []) {
  for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) await walkFiles(root, full, output);
    else if (entry.isFile()) output.push({
      full,
      relative: path.relative(root, full).replaceAll("\\", "/")
    });
  }
  return output;
}

function readVarUint(buffer, start) {
  let value = 0;
  let shift = 0;
  let cursor = start;
  while (cursor < buffer.length && shift <= 35) {
    const byte = buffer[cursor++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value: value >>> 0, next: cursor };
    shift += 7;
  }
  throw new Error("无效的 WASM varuint");
}

export function summarizeWasm(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) {
    throw new Error("不是有效的 WASM 模块");
  }
  const sections = [];
  let cursor = 8;
  while (cursor < buffer.length) {
    const id = buffer[cursor++];
    const sizeInfo = readVarUint(buffer, cursor);
    cursor = sizeInfo.next;
    const start = cursor;
    const end = start + sizeInfo.value;
    if (end > buffer.length) throw new Error("WASM section 越界");
    const section = { id, name: ["custom", "type", "import", "function", "table", "memory", "global", "export", "start", "element", "code", "data", "dataCount"][id] || `section-${id}`, bytes: sizeInfo.value };
    if (sizeInfo.value > 0) {
      try {
        if (id === 0) {
          const nameLength = readVarUint(buffer, start);
          section.customName = buffer.subarray(nameLength.next, nameLength.next + nameLength.value).toString("utf8");
        } else if ([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12].includes(id)) {
          section.itemCount = readVarUint(buffer, start).value;
        }
      } catch {}
    }
    sections.push(section);
    cursor = end;
  }
  return {
    format: "WebAssembly",
    version: buffer.readUInt32LE(4),
    bytes: buffer.length,
    sections,
    totals: {
      functions: sections.find(item => item.id === 3)?.itemCount || 0,
      codeBodies: sections.find(item => item.id === 10)?.itemCount || 0,
      imports: sections.find(item => item.id === 2)?.itemCount || 0,
      exports: sections.find(item => item.id === 7)?.itemCount || 0
    }
  };
}

export function parseUnityWebDataEntries(data) {
  if (data.length < UNITY_WEB_DATA_MAGIC.length + 4 || !data.subarray(0, UNITY_WEB_DATA_MAGIC.length).equals(UNITY_WEB_DATA_MAGIC)) {
    throw new Error("不是 UnityWebData1.0 数据包");
  }
  const headerLength = data.readUInt32LE(UNITY_WEB_DATA_MAGIC.length);
  if (headerLength < UNITY_WEB_DATA_MAGIC.length + 4 || headerLength > data.length) throw new Error("UnityWebData header 长度无效");
  let cursor = UNITY_WEB_DATA_MAGIC.length + 4;
  const entries = [];
  while (cursor < headerLength) {
    if (cursor + 12 > headerLength) throw new Error("UnityWebData 条目头不完整");
    const offset = data.readUInt32LE(cursor); cursor += 4;
    const size = data.readUInt32LE(cursor); cursor += 4;
    const nameLength = data.readUInt32LE(cursor); cursor += 4;
    if (nameLength === 0 || cursor + nameLength > headerLength) throw new Error("UnityWebData 文件名无效");
    const name = data.subarray(cursor, cursor + nameLength).toString("utf8").replaceAll("\\", "/");
    cursor += nameLength;
    const parts = name.split("/");
    if (path.isAbsolute(name) || parts.some(part => !part || part === "." || part === "..")) throw new Error(`UnityWebData 包含不安全路径：${name}`);
    if (offset < headerLength || offset + size > data.length) throw new Error(`UnityWebData 条目越界：${name}`);
    entries.push({ name, offset, size });
  }
  return { headerLength, entries };
}

export async function extractUnityWebData(data, outputRoot, sourceFile) {
  const parsed = parseUnityWebDataEntries(data);
  await mkdir(outputRoot, { recursive: true });
  for (const entry of parsed.entries) {
    const target = path.resolve(outputRoot, ...entry.name.split("/"));
    const rootPrefix = `${path.resolve(outputRoot)}${path.sep}`.toLowerCase();
    if (!target.toLowerCase().startsWith(rootPrefix)) throw new Error(`拒绝写出分析目录：${entry.name}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data.subarray(entry.offset, entry.offset + entry.size));
  }
  const manifest = {
    format: "UnityWebData1.0",
    sourceFile,
    headerLength: parsed.headerLength,
    files: parsed.entries.length,
    entries: parsed.entries
  };
  await writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const append = (current, chunk) => (current + chunk.toString()).slice(-100_000);
    child.stdout.on("data", chunk => { stdout = append(stdout, chunk); });
    child.stderr.on("data", chunk => { stderr = append(stderr, chunk); });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

export function parseGameplayClasses(text) {
  const wanted = /(Game|Player|Input|Controller|Barrel|Roll|Stack|Obstacle|Hazard|Diamond|Coin|Collect|Finish|Road|Path|Trigger|Rope|Score|Level)/i;
  const lines = text.split(/\r?\n/);
  const images = lines
    .map(line => line.match(/^\/\/ Image \d+: (.+) - (\d+)$/))
    .filter(Boolean)
    .map(match => ({ name: match[1], typeDefStart: Number(match[2]) }))
    .sort((a, b) => a.typeDefStart - b.typeDefStart)
    .map((image, index, all) => ({ ...image, typeDefEnd: (all[index + 1]?.typeDefStart ?? Number.MAX_SAFE_INTEGER) - 1 }));
  const projectClasses = [];
  const gameplayClasses = [];
  let namespace = "";
  let current = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const namespaceMatch = line.match(/^\/\/ Namespace:\s*(.*)$/);
    if (namespaceMatch) { namespace = namespaceMatch[1].trim(); continue; }
    const classMatch = line.match(/^(?:public|internal|private|protected)?\s*(?:abstract\s+|sealed\s+|static\s+|partial\s+)*(?:class|struct|interface|enum)\s+(.+?)\s*\/\/ TypeDefIndex: (\d+)/);
    if (classMatch) {
      const typeDefIndex = Number(classMatch[2]);
      const image = images.find(item => typeDefIndex >= item.typeDefStart && typeDefIndex <= item.typeDefEnd);
      if (!image || !/^Assembly-CSharp(?:-firstpass)?\.dll$/i.test(image.name)) { current = null; continue; }
      // Compiler-generated names contain <>; generic arguments may contain spaces.
      // Only a separator outside angle brackets ends the type name.
      let depth = 0, end = classMatch[1].length;
      for (let at = 0; at < classMatch[1].length; at++) {
        const char = classMatch[1][at];
        if (char === '<') depth++;
        else if (char === '>') depth--;
        else if (depth === 0 && /[\s:]/.test(char)) { end = at; break; }
      }
      current = { name: classMatch[1].slice(0, end), namespace, assembly: image.name, typeDefIndex, declarationLine: index + 1, methods: [], fields: [] };
      projectClasses.push(current);
      if (wanted.test(`${namespace}.${current.name}`)) gameplayClasses.push(current);
      continue;
    }
    if (!current) continue;
    const fieldMatch = line.match(/^\s*(?:public|private|protected|internal)\s+(.+?);\s*\/\/\s*0x([0-9A-Fa-f]+)/);
    if (fieldMatch && current.fields.length < 200) current.fields.push({ declaration: fieldMatch[1].trim(), offset: `0x${fieldMatch[2]}`, line: index + 1 });
    const methodOffset = line.match(/^\s*\/\/ RVA:\s*(-1|0x[0-9A-Fa-f]+)\s+Offset:\s*(-1|0x[0-9A-Fa-f]+)/);
    if (methodOffset) {
      const signature = lines[index + 1]?.trim() || "";
      if (signature && current.methods.length < 500) current.methods.push({ signature, rva: methodOffset[1], offset: methodOffset[2], line: index + 2 });
    }
  }
  return { images, projectClasses, gameplayClasses };
}

// The dumper catches some failures and exits 0 after writing only assembly
// headers. Automation needs actual types and callable method mappings.
export function validateIl2CppArtifacts(dumpText, scriptText) {
  const typeDefinitions = (dumpText || '').match(/\/\/ TypeDefIndex:\s*\d+/g)?.length || 0;
  if (!typeDefinitions) return { status: 'failed', reason: 'IL2CPP dump 缺少实际类型定义，可能只生成了程序集头', typeDefinitions, mappedMethods: 0 };
  let script;
  try { script = JSON.parse(scriptText); } catch { return { status: 'failed', reason: 'IL2CPP 方法映射 script.json 缺失或无效', typeDefinitions, mappedMethods: 0 }; }
  const mappedMethods = Array.isArray(script?.ScriptMethod) ? script.ScriptMethod.filter(item => typeof item.Name === 'string' && item.Name && Number.isSafeInteger(item.Address) && item.Address > 0).length : 0;
  return mappedMethods ? { status: 'completed', typeDefinitions, mappedMethods } : { status: 'failed', reason: 'IL2CPP 方法映射没有非零原生地址', typeDefinitions, mappedMethods };
}

export async function runIl2CppAnalysis(wasmFile, metadataFile, outputRoot) {
  const useStandaloneExe = process.platform === "win32" && (await exists(IL2CPP_DUMPER_EXE));
  const sourceDll = path.join(IL2CPP_DUMPER_SOURCE, "Il2CppDumper.dll");
  if (!useStandaloneExe && !(await exists(sourceDll))) return { status: "unavailable", reason: `未找到 Il2CppDumper：${sourceDll}` };
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const toolRoot = path.join(outputRoot, ".dumper-runtime");
  if (useStandaloneExe) {
    await cp(IL2CPP_DUMPER_BIN, toolRoot, { recursive: true });
  } else {
    await cp(IL2CPP_DUMPER_SOURCE, toolRoot, { recursive: true });
  }
  const configFile = path.join(toolRoot, "config.json");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  config.RequireAnyKey = false;
  await writeFile(configFile, JSON.stringify(config, null, 2));
  // 部分 Unity WebGL 构建会把 Il2CppCodeRegistration 常量折叠掉（结构体不出现在 data 段），
  // 导致 Il2CppDumper 的自动搜索与手动模式都失效。此处检测并注入重建的等价结构。
  let effectiveWasm = path.resolve(wasmFile);
  let repair;
  try {
    repair = repairIl2CppWasm(await readFile(wasmFile), await readFile(metadataFile));
    if (repair.repairApplied) {
      effectiveWasm = path.join(toolRoot, "repaired.wasm");
      await writeFile(effectiveWasm, repair.wasm);
    }
  } catch (error) {
    repair = { repairApplied: false, reason: `注册结构修复预处理失败：${error.message}`, log: [error.message] };
  }
  let result;
  try {
    if (useStandaloneExe) {
      result = await runProcess(path.resolve(toolRoot, "Il2CppDumper.exe"), [
        effectiveWasm,
        path.resolve(metadataFile),
        path.resolve(outputRoot)
      ], { cwd: toolRoot });
    } else {
      result = await runProcess("dotnet", [
        path.resolve(toolRoot, "Il2CppDumper.dll"),
        effectiveWasm,
        path.resolve(metadataFile),
        path.resolve(outputRoot)
      ], { cwd: toolRoot });
    }
  } catch (error) {
    result = { code: -1, stdout: "", stderr: error.message };
  } finally {
    await rm(toolRoot, { recursive: true, force: true });
  }
  const outputs = (await walkFiles(outputRoot)).map(file => file.relative);
  const dumpFile = path.join(outputRoot, "dump.cs");
  let classIndex = { images: [], projectClasses: [], gameplayClasses: [] };
  if (await exists(dumpFile)) {
    classIndex = parseGameplayClasses(await readFile(dumpFile, "utf8"));
    await writeFile(path.join(outputRoot, "project-classes.json"), JSON.stringify({ classes: classIndex.projectClasses.length, items: classIndex.projectClasses }, null, 2));
    await writeFile(path.join(outputRoot, "gameplay-classes.json"), JSON.stringify({ classes: classIndex.gameplayClasses.length, items: classIndex.gameplayClasses }, null, 2));
    outputs.push("project-classes.json", "gameplay-classes.json");
  }
  const validation = validateIl2CppArtifacts(await readFile(dumpFile, 'utf8').catch(() => ''), await readFile(path.join(outputRoot, 'script.json'), 'utf8').catch(() => null));
  const status = validation.status;
  const summary = {
    status,
    executable: wasmFile,
    metadata: metadataFile,
    exitCode: result.code,
    projectClasses: classIndex.projectClasses.length,
    gameplayClasses: classIndex.gameplayClasses.length,
    wasmRepair: repair.repairApplied
      ? {
        applied: true,
        reason: repair.reason,
        codeRegistration: repair.codeRegistration,
        codeGenModules: repair.codeGenModules,
        moduleCount: repair.moduleCount,
        genericPointerSlots: repair.genericPointerSlots,
        log: repair.log
      }
      : { applied: false, reason: repair.reason, log: repair.log },
    validation,
    outputs: [...new Set(outputs)].sort(),
    log: `${result.stdout}${result.stderr}`.trim()
  };
  await writeFile(path.join(outputRoot, "analysis-summary.json"), JSON.stringify(summary, null, 2));
  return summary;
}
