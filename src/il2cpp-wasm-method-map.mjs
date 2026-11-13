// 为 Unity 6 / metadata v31 的 WebGL 归档重建 Il2CppDumper 兼容的 script.json。
//
// 背景：Unity 6 的 WebGL 构建会把 Il2CppCodeRegistration / Il2CppMetadataRegistration
// 以及 Il2CppType 表常量折叠掉（data 段里既没有指向它们的指针，也没有结构体本体），
// 于是 Il2CppDumper 与 Cpp2IL 都只能退化成「只有名字的骨架」，script.json 生不出来。
//
// 但 Il2CppCodeGenModule 数组本身仍在 data 段里：每个模块带 moduleName、
// methodPointerCount 与 methodPointers（函数表索引）。把它的方法与 global-metadata.dat
// 里每个方法的 MethodDef token 行号关联，就能恢复「方法名 → 函数表索引」映射，
// 这正是 script.json 的 ScriptMethod 部分，也是 wasm-function.mjs 反编译真实方法体的前提。
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readWasmSections, readDataSegments, buildDataMemory, readMetadataInfo } from "./il2cpp-wasm-repair.mjs";

const IMAGE_ENTRY_BYTES = 40;
const TYPE_DEFINITION_BYTES = 88;

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function firstFile(directory, extension) {
  const entries = (await readdir(directory).catch(() => [])).filter(name => name.endsWith(extension));
  return entries.length ? path.join(directory, entries[0]) : null;
}

/** 解析 global-metadata.dat：image 列表、每个 image 的类型范围与按顺序展开的方法名。 */
export function readMetadataLayout(metadata) {
  const info = readMetadataInfo(metadata);
  const stringStart = info.sizes.string.offset;
  const stringBytes = info.sizes.string.size;
  const readString = index => {
    const start = stringStart + index;
    if (index < 0 || index >= stringBytes) return "";
    let end = start;
    while (end < stringStart + stringBytes && metadata[end] !== 0) end += 1;
    return metadata.toString("utf8", start, end);
  };

  const typeCount = Math.floor(info.sizes.typeDefinitions.size / TYPE_DEFINITION_BYTES);
  const typeBase = info.sizes.typeDefinitions.offset;
  const readType = index => {
    const base = typeBase + index * TYPE_DEFINITION_BYTES;
    return {
      name: readString(metadata.readInt32LE(base)),
      namespace: readString(metadata.readInt32LE(base + 4)),
      methodStart: metadata.readInt32LE(base + 36),
      methodCount: metadata.readUInt16LE(base + 64)
    };
  };

  const totalMethodCount = (() => {
    let total = 0;
    for (let index = 0; index < typeCount; index += 1) {
      const base = typeBase + index * TYPE_DEFINITION_BYTES;
      total += metadata.readUInt16LE(base + 64);
    }
    return total;
  })();
  // v31 的 Il2CppMethodDefinition 不是 32 字节对齐的定长结构，直接按「表大小 / 方法总数」反解步长。
  const methodStride = totalMethodCount > 0 ? info.sizes.methods.size / totalMethodCount : 0;
  if (!Number.isInteger(methodStride) || methodStride <= 0) {
    return { status: "failed", reason: `方法表步长无法整除（size=${info.sizes.methods.size}, methods=${totalMethodCount}）` };
  }
  const methodBase = info.sizes.methods.offset;
  if (![32, 36].includes(methodStride)) return { status: 'failed', reason: 'Unsupported method definition stride: ' + methodStride };
  const readMethodToken = index => metadata.readUInt32LE(methodBase + index * methodStride + methodStride - 12);
  const readMethodFlags = index => metadata.readUInt16LE(methodBase + index * methodStride + methodStride - 8);
  const readMethodParameterCount = index => metadata.readUInt16LE(methodBase + index * methodStride + methodStride - 2);
  const readMethodName = index => readString(metadata.readInt32LE(methodBase + index * methodStride));

  const images = [];
  const imageBase = info.sizes.images.offset;
  const imageCount = Math.floor(info.sizes.images.size / IMAGE_ENTRY_BYTES);
  for (let index = 0; index < imageCount; index += 1) {
    const base = imageBase + index * IMAGE_ENTRY_BYTES;
    images.push({
      name: readString(metadata.readInt32LE(base)),
      typeStart: metadata.readInt32LE(base + 8),
      typeCount: metadata.readInt32LE(base + 12)
    });
  }

  return {
    status: "ok",
    info,
    stringStart,
    stringBytes,
    readString,
    readType,
    readMethodName,
    readMethodToken,
    readMethodFlags,
    readMethodParameterCount,
    typeCount,
    totalMethodCount,
    methodStride,
    images
  };
}

/** 在 wasm data 段中找出所有 Il2CppCodeGenModule 结构（moduleName + methodPointerCount + methodPointers）。 */
export function findCodeGenModules(wasm) {
  const sections = readWasmSections(wasm);
  const dataSection = sections.find(section => section.id === 11);
  if (!dataSection) return { memory: null, modules: [] };
  const { memory, maxEnd } = buildDataMemory(wasm, dataSection, readDataSegments(wasm, dataSection));
  const readUint32 = address => (address >= 0 && address + 4 <= maxEnd ? memory.readUInt32LE(address) : -1);
  const readCString = address => {
    if (address < 0x400 || address >= maxEnd) return null;
    let end = address;
    while (end < maxEnd && memory[end] !== 0 && end - address < 260) end += 1;
    return end > address ? memory.toString("latin1", address, end) : null;
  };
  const modules = [];
  for (let address = 0x400; address + 16 <= maxEnd; address += 4) {
    const name = readCString(readUint32(address));
    if (!name || !/\.dll$/.test(name)) continue;
    const methodPointerCount = readUint32(address + 4);
    const methodPointers = readUint32(address + 8);
    if (methodPointerCount < 0 || methodPointerCount > 400000) continue;
    if (methodPointerCount === 0) {
      modules.push({ address, name, methodPointerCount, methodPointers, readable: true });
      continue;
    }
    // 少数模块的方法指针数组落在 data 段之外（由 il2cpp 启动时写入的运行期区域），
    // 静态镜像里读不到地址，但仍然记录模块本身，便于解释缺口。
    if (methodPointers >= 0x400 && methodPointers + methodPointerCount * 4 <= maxEnd) {
      modules.push({ address, name, methodPointerCount, methodPointers, readable: true });
    } else if (methodPointers >= maxEnd && methodPointers < 0x10000000) {
      modules.push({ address, name, methodPointerCount, methodPointers, readable: false });
    }
  }
  return { memory, maxEnd, readUint32, modules };
}

/**
 * 生成 script.json 内容。
 * 校验：每个 image 的 metadata 方法数必须与其 module 的 methodPointerCount 完全一致，否则跳过该 image 并记录。
 */
export function buildScript({ metadata, wasm }) {
  const layout = readMetadataLayout(metadata);
  if (layout.status !== "ok") return layout;
  const { memory, readUint32, modules } = findCodeGenModules(wasm);
  if (!memory) return { status: "failed", reason: "wasm 缺少 data 段，无法定位 Il2CppCodeGenModule" };

  const methods = [];
  const images = [];
  const skipped = [];
  for (const image of layout.images) {
    const candidates = modules.filter(module => module.name === image.name);
    let total = 0;
    for (let index = image.typeStart; index < image.typeStart + image.typeCount; index += 1) total += layout.readType(index).methodCount;
    const module = candidates.find(item => item.methodPointerCount === total && item.readable);
    if (!module) {
      const unreadable = candidates.find(item => item.methodPointerCount === total);
      skipped.push({
        image: image.name,
        reason: unreadable
          ? `方法指针数组位于 data 段之外（运行时初始化，0x${unreadable.methodPointers.toString(16)}），静态镜像不可读`
          : `未找到方法数匹配的模块（metadata=${total}, wasm=${candidates.map(item => item.methodPointerCount).join("/") || "none"}）`
      });
      continue;
    }
    let offset = 0;
    let added = 0;
    const moduleMethods = [];
    const seenRows = new Set();
    let invalidToken = false;
    for (let index = image.typeStart; index < image.typeStart + image.typeCount; index += 1) {
      const type = layout.readType(index);
      if (type.methodStart < 0 || !type.methodCount) continue;
      const owner = `${type.namespace ? `${type.namespace}.` : ""}${type.name}`;
      for (let m = 0; m < type.methodCount; m += 1) {
        const methodIndex = type.methodStart + m;
        const name = layout.readMethodName(methodIndex);
        const token = layout.readMethodToken(methodIndex);
        const row = token & 0xffffff;
        if ((token >>> 24) !== 6 || row < 1 || row > module.methodPointerCount || seenRows.has(row)) {
          invalidToken = true;
          continue;
        }
        seenRows.add(row);
        const address = readUint32(module.methodPointers + (row - 1) * 4);
        offset += 1;
        if (!name || !Number.isSafeInteger(address) || address < 0) continue;
        moduleMethods.push({ Address: address, Name: `${owner}$$${name}`, Signature: null, Token: token, Flags: layout.readMethodFlags(methodIndex), IsStatic: Boolean(layout.readMethodFlags(methodIndex) & 0x10), ParameterCount: layout.readMethodParameterCount(methodIndex) });
        added += 1;
      }
    }
    if (invalidToken || offset !== module.methodPointerCount) {
      skipped.push({ image: image.name, reason: `方法数回填不一致（metadata 展开=${offset}, 模块=${module.methodPointerCount}）` });
      continue;
    }
    methods.push(...moduleMethods);
    images.push({ image: image.name, methods: added, module: `0x${module.address.toString(16)}` });
  }

  return {
    status: methods.length ? "ok" : "failed",
    script: {
      ScriptMethod: methods,
      ScriptString: [],
      ScriptMetadata: [],
      ScriptMetadataMethod: [],
      Addresses: []
    },
    images,
    skipped,
    methodStride: layout.methodStride,
    totalMethodCount: layout.totalMethodCount
  };
}

/**
 * 从 global-metadata.dat 的字符串字面量表直接读出字面量。
 * 表项为 Il2CppStringLiteral{ int32 length, int32 dataIndex }，字节落在 stringLiteralData 区。
 * Unity 6 构建下 dumper 的 stringliteral.json 是乱码（缺 metadata registration），这里的值才是权威的。
 */
export function readStringLiterals(metadata, layout = readMetadataLayout(metadata)) {
  if (layout.status !== "ok") return [];
  const table = layout.info.sizes.stringLiteral;
  const blob = layout.info.sizes.stringLiteralData;
  const literals = [];
  const count = Math.floor(table.size / 8);
  for (let index = 0; index < count; index += 1) {
    const base = table.offset + index * 8;
    const length = metadata.readInt32LE(base);
    const dataIndex = metadata.readInt32LE(base + 4);
    if (length <= 0 || dataIndex < 0 || dataIndex + length > blob.size) continue;
    const value = metadata.toString("utf8", blob.offset + dataIndex, blob.offset + dataIndex + length);
    literals.push({ value });
  }
  return literals;
}

/** 对归档目录执行一次恢复：写出 analysis/il2cpp/script.json。 */
export async function writeWasmMethodScript(captureRoot, onEvent = () => {}) {
  const wasmRoot = path.join(captureRoot, "analysis", "wasm");
  const wasmFile = await firstFile(wasmRoot, ".wasm");
  if (!wasmFile) return { status: "skipped", reason: `${wasmRoot} 下没有 .wasm` };
  const unityRoot = path.join(captureRoot, "analysis", "unity-data");
  const dataDirectories = await readdir(unityRoot, { withFileTypes: true }).catch(() => []);
  let metadataFile = null;
  for (const entry of dataDirectories) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(unityRoot, entry.name, "Il2CppData", "Metadata", "global-metadata.dat");
    if (await exists(candidate)) { metadataFile = candidate; break; }
  }
  if (!metadataFile) return { status: "skipped", reason: "未找到 global-metadata.dat" };

  const metadata = await readFile(metadataFile);
  const result = buildScript({ metadata, wasm: await readFile(wasmFile) });
  if (result.status !== "ok") {
    onEvent({ type: "wasm-method-map", status: result.status, reason: result.reason });
    return result;
  }
  const outputFile = path.join(captureRoot, "analysis", "il2cpp", "script.json");
  await writeFile(outputFile, JSON.stringify(result.script, null, 2), "utf8");
  // 同时把字符串字面量按 metadata 原表重写：dumper 在缺 metadata registration 时给出的那份是乱码。
  const literals = readStringLiterals(metadata);
  const literalsFile = path.join(captureRoot, "analysis", "il2cpp", "stringliteral.json");
  if (literals.length) await writeFile(literalsFile, JSON.stringify(literals, null, 2), "utf8");
  const summary = {
    status: "ok",
    output: outputFile,
    methods: result.script.ScriptMethod.length,
    images: result.images.length,
    skipped: result.skipped,
    methodStride: result.methodStride,
    metadataMethods: result.totalMethodCount,
    stringLiterals: literals.length,
    stringLiteralsFile: literals.length ? literalsFile : null
  };
  onEvent({ type: "wasm-method-map", ...summary });
  return summary;
}
