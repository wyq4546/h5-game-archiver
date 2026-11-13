// IL2CPP WebGL(WASM) 注册结构丢失修复
//
// 背景
// ----
// Unity WebGL / IL2CPP 构建通常把 `Il2CppCodeRegistration`、`Il2CppMetadataRegistration`
// 以“常量结构体”的形式放在 wasm 的 data 段里，Il2CppDumper 的 WebAssembly 后端依靠
// 在 data 段内做指针引用链回溯（搜索 "mscorlib.dll" -> 模块指针 -> codeGenModules 数组）
// 来自动定位它们。
//
// 但在部分构建里（本仓库遇到的 Unity 2022.3.9f1 构建即如此），链接器/优化器把
// `Il2CppCodeRegistration` 的所有字段读取都**常量折叠成了 code 段里的 i32.const 立即数**，
// 结构体本身从未出现在 data 段。此时 Il2CppDumper 会报：
//
//     CodeRegistration : 0
//     MetadataRegistration : 0
//     ERROR: Can't use auto mode to process file, try manual mode.
//
// 而它的手动模式同样没救 —— 因为结构体在二进制里根本不存在。
//
// 关键观察
// --------
// 折叠掉的只是**结构体**，它指向的那些数组（codeGenModules 数组、各模块的
// methodPointers / invokerIndices、MetadataRegistration 指向的 types / methodSpecs 等）
// 全都完好地保留在 data 段里。因此可以反向重建一个等价的 `Il2CppCodeRegistration`
// 并把它作为一个新的 data segment 注入 wasm：
//
//   1. 按“首字段指向 *.dll 字符串的定长结构体”特征找出全部 Il2CppCodeGenModule，
//      再找出引用它们的连续指针数组 —— 那就是 codeGenModules 数组；
//   2. 合成 60 字节的 Il2CppCodeRegistration(v29)，填上 codeGenModulesCount / codeGenModules；
//   3. genericMethodPointers / invokerPointers 这类全局数组如果同样被折叠，就用一段
//      全零数组占位（Il2CppDumper 只在地址 > 0 时使用，因此等价于“缺少泛型方法地址”，
//      不会崩溃也不会污染其它输出）。
//
// 注入后 Il2CppDumper 的**原版自动搜索即可成功**，无需手动输入地址，也无需修改 dumper。
//
// 三个必须同时满足的约束（2026-10 在 Rodha 2 / metadata v31 构建上逐一实测确认）
// -----------------------------------------------------------------------------
// 1. 搜索端偏移：`SectionHelper.FindCodeRegistration2019()` 对 `Version >= 29` 硬编码
//    返回 `refva3 - PointerSize * 14`（即认定 codeGenModules 在结构体偏移 56），
//    并校验 `[refva3 - 4] == imageCount`（refva3 = 保存 codeGenModules 指针的那个单元）。
// 2. 读取端布局：`Il2Cpp.AutoPlusInit()` 对 metadata v31 会先按 v31 读一遍，若
//    `genericMethodPointersCount <= 0x35000` 就把 Version 降为 29 再读；v31 布局里
//    codeGenModules 在偏移 64，v29 布局里在偏移 56 —— 只写一份必然有一端读错。
//    因此注入块在 +56 与 +64、+52 与 +60 各写一份（搜索端认前者，读取端两种布局都能命中）。
// 3. 泛型指针占位数组：`Il2Cpp.Init()` 会执行
//    `methodSpecGenericMethodPointers.Add(methodSpec, genericMethodPointers[table.indices.methodIndex])`，
//    其中 methodIndex 来自真实 Il2CppGenericMethodTable。占位数组长度必须 **严格大于** 该最大下标，
//    否则抛 `System.IndexOutOfRangeException`（这正是此前 Init 崩溃的真因：旧实现按 12 字节步长推导，
//    而 v27.1+ 的 Il2CppGenericMethodFunctionsDefinitions 含 adjustorThunk，步长是 16 字节）。
//    长度取 dumper 自己的 WebAssembly 上限 0x35000：既覆盖真实最大下标（Rodha 2 为 78895），
//    又不会触发 `> 0x35000` 的“版本位移”分支（那会把结构体基址挪偏 8 字节）。
//    invokerPointers 同样需要占位数组（反编译泛型方法时会按 invokerIndex 取值）。

const WASM_MAGIC = Buffer.from([0x00, 0x61, 0x73, 0x6d]);

// Il2CppDumper 对 WebAssembly 的版本位移阈值（Il2Cpp.AutoPlusInit 内的 limit）
export const WEBASSEMBLY_CODE_POINTER_LIMIT = 0x35000;

// 注入的 Il2CppCodeRegistration 兼容块（32 位，4 字节字段）
const CODE_REGISTRATION_BLOCK = {
  sizeBytes: 96,
  reversePInvokeWrapperCount: 0,
  reversePInvokeWrappers: 4,
  genericMethodPointersCount: 8,
  genericMethodPointers: 12,
  genericAdjustorThunks: 16,
  invokerPointersCount: 20,
  invokerPointers: 24,
  unresolvedVirtualCallCount: 28,
  unresolvedVirtualCallPointers: 32,
  windowsRuntimeFactoryCount: 44,   // v29 布局
  windowsRuntimeFactoryTable: 48,   // v29 布局
  codeGenModulesCountV29: 52,
  codeGenModulesV29: 56,            // 同时是 Il2CppDumper 搜索端认定的 refva3
  codeGenModulesCountV31: 60,
  codeGenModulesV31: 64
};

// Il2CppGenericMethodFunctionsDefinitions = { int genericMethodIndex; int methodIndex; int invokerIndex; int adjustorThunk; }
// adjustorThunk 自 v27.1 起存在，因此步长是 16 而不是 12。
const GENERIC_METHOD_TABLE_ENTRY_BYTES = 16;

const MODULE_NAME_PATTERN = /^(?:[A-Za-z0-9_.+-]+\.dll|__Generated)$/;

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

function writeVarUint(value) {
  const out = [];
  let x = value >>> 0;
  do {
    let byte = x & 0x7f;
    x >>>= 7;
    if (x) byte |= 0x80;
    out.push(byte);
  } while (x);
  return Buffer.from(out);
}

/** 遍历 wasm 顶层 section，返回 { id, headerOffset, bodyOffset, size } 列表。 */
export function readWasmSections(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 4).equals(WASM_MAGIC)) {
    throw new Error("不是有效的 WASM 模块");
  }
  const sections = [];
  let cursor = 8;
  while (cursor < buffer.length) {
    const id = buffer[cursor++];
    const sizeInfo = readVarUint(buffer, cursor);
    const bodyOffset = sizeInfo.next;
    sections.push({ id, sizeOffset: cursor, bodyOffset, size: sizeInfo.value });
    cursor = bodyOffset + sizeInfo.value;
  }
  return sections;
}

/** 解析 data 段（id=11）的所有 segment，返回 { count, segments }。 */
export function readDataSegments(buffer, dataSection) {
  const body = buffer.subarray(dataSection.bodyOffset, dataSection.bodyOffset + dataSection.size);
  const countInfo = readVarUint(body, 0);
  let cursor = countInfo.next;
  const segments = [];
  for (let i = 0; i < countInfo.value; i += 1) {
    const flagsInfo = readVarUint(body, cursor);
    cursor = flagsInfo.next;
    const flags = flagsInfo.value;
    if (flags === 1) {
      const sizeInfo = readVarUint(body, cursor);
      cursor = sizeInfo.next + sizeInfo.value;
      continue;
    }
    if (flags === 2) {
      const memInfo = readVarUint(body, cursor);
      cursor = memInfo.next;
    }
    if (body[cursor++] !== 0x41) throw new Error("data segment 的 offset 表达式不是 i32.const");
    const offsetInfo = readVarUint(body, cursor);
    cursor = offsetInfo.next;
    if (body[cursor++] !== 0x0b) throw new Error("data segment 的 offset 表达式缺少 end");
    const sizeInfo = readVarUint(body, cursor);
    cursor = sizeInfo.next;
    segments.push({
      offset: offsetInfo.value,
      dataOffset: dataSection.bodyOffset + cursor,
      size: sizeInfo.value
    });
    cursor += sizeInfo.value;
  }
  return { count: countInfo.value, segments };
}

/**
 * 按 Il2CppDumper 的 WebAssemblyMemory 语义重建 data 段内存镜像：
 * 缓冲区长度为 wasm 文件长度，各 data segment 按自身线性内存地址写入。
 */
export function buildDataMemory(buffer, dataSection, dataSegments) {
  const memory = Buffer.alloc(buffer.length);
  let maxEnd = 0;
  for (const segment of dataSegments.segments) {
    if (segment.offset + segment.size > memory.length) continue;
    buffer.copy(memory, segment.offset, segment.dataOffset, segment.dataOffset + segment.size);
    const end = segment.offset + segment.size;
    if (end > maxEnd) maxEnd = end;
  }
  void dataSection;
  return { memory, maxEnd };
}

function readCString(memory, address, maxLength = 96) {
  if (address < 0 || address >= memory.length) return null;
  let end = address;
  while (end < memory.length && memory[end] !== 0 && end - address < maxLength) end += 1;
  if (end === address) return null;
  return memory.toString("latin1", address, end);
}

/**
 * 找出全部 Il2CppCodeGenModule 结构体地址。
 * 特征：结构体首个字段指向一个内容形如 `<Assembly>.dll` / `__Generated` 的字符串。
 */
function findCodeGenModuleStructs(memory, maxEnd) {
  const start = 1024;
  const end = Math.min(maxEnd, memory.length - 4);
  const modules = new Map();
  for (let address = start; address < end; address += 4) {
    const nameAddress = memory.readUInt32LE(address);
    if (nameAddress < start || nameAddress >= memory.length - 1) continue;
    const name = readCString(memory, nameAddress);
    if (name && MODULE_NAME_PATTERN.test(name)) modules.set(address, name);
  }
  return modules;
}

/**
 * 在内存镜像里找出连续引用这些模块结构体的指针数组（即 codeGenModules 数组）。
 * 返回最长的连续段。
 */
function findCodeGenModulesArray(memory, moduleStructs) {
  const cells = [];
  const end = memory.length - 4;
  for (let address = 1024; address < end; address += 4) {
    if (moduleStructs.has(memory.readUInt32LE(address))) cells.push(address);
  }
  let best = null;
  let run = null;
  for (const cell of cells) {
    if (!run || cell !== run.end + 4) {
      if (run && (!best || run.entries > best.entries)) best = run;
      run = { start: cell, end: cell, entries: 1 };
    } else {
      run.end = cell;
      run.entries += 1;
    }
  }
  if (run && (!best || run.entries > best.entries)) best = run;
  return best;
}

/**
 * 判断 data 段里是否**真的**存在 Il2CppCodeRegistration 结构体。
 *
 * 不能用「逐字节搜索 codeGenModules 指针」这种判定：那样会被未对齐的巧合字节命中而误判为
 * “结构体已存在、无需修复”（Rodha 2 就是这么跳过注入、进而让 dumper 报 auto mode 失败的）。
 * 这里复刻 dumper 自己的校验：存在 4 字节对齐单元 P 保存 codeGenModules 指针，
 * 且其**前一个单元**（codeGenModulesCount）等于 imageCount。
 */
function hasCodeRegistrationStruct(memory, codeGenModules, imageCount) {
  const start = 1024;
  for (let address = start + 4; address < memory.length - 4; address += 4) {
    if (memory.readUInt32LE(address) !== codeGenModules) continue;
    if (memory.readUInt32LE(address - 4) !== imageCount) continue;
    return true;
  }
  return false;
}

/** 解析 global-metadata.dat 的头部，取 images / typeDefinitions 等规模信息。 */
export function readMetadataInfo(metadata) {
  const header = {
    sanity: metadata.readUInt32LE(0),
    version: metadata.readInt32LE(4)
  };
  const fieldOrder = [
    "stringLiteral", "stringLiteralData", "string", "events", "properties", "methods",
    "parameterDefaultValues", "fieldDefaultValues", "fieldAndParameterDefaultValueData",
    "fieldMarshaledSizes", "parameters", "fields", "genericParameters",
    "genericParameterConstraints", "genericContainers", "nestedTypes", "interfaces",
    "vtableMethods", "interfaceOffsets", "typeDefinitions", "images", "assemblies",
    "fieldRefs", "referencedAssemblies", "attributeData", "attributeDataRange"
  ];
  const sizes = {};
  for (let i = 0; i < fieldOrder.length; i += 1) {
    const offset = 8 + i * 8;
    sizes[fieldOrder[i]] = { offset: metadata.readInt32LE(offset), size: metadata.readInt32LE(offset + 4) };
  }
  // Il2CppImageDefinition 在 v29 下为 40 字节
  const imageCount = Math.floor(sizes.images.size / 40);
  // Il2CppTypeDefinition 在 v29 下为 88 字节
  const typeDefinitionsCount = Math.floor(sizes.typeDefinitions.size / 88);
  return { header, sizes, imageCount, typeDefinitionsCount };
}

/**
 * 按 Il2CppDumper `FindMetadataRegistrationV21` 的判据定位 Il2CppMetadataRegistration。
 * 判据（已在 Rodha 2 / metadata v31 上用真机数据复核）：
 *   存在 4 字节对齐地址 addr，使 [addr] == typeDefinitionsCount，
 *   且 [addr + 8] 是一个“指向 typeDefinitionsCount 个数据段内指针”的数组指针，
 *   结构体起点为 addr - 40（PointerSize * 10）。
 * 例：Rodha 2 命中 addr = MetadataRegistration + 40（fieldOffsetsCount），
 *     指针取到 +48 的 typeDefinitionsSizes，基址回推得 0x4ff0ac，与 dumper 输出一致。
 */
function findMetadataRegistration(memory, typeDefinitionsCount) {
  const end = memory.length - 16;
  const probes = Math.min(typeDefinitionsCount, 4096); // 抽样校验即可，避免 O(n²) 扫描
  for (let address = 1024; address < end; address += 4) {
    if (memory.readUInt32LE(address) !== typeDefinitionsCount) continue;
    const pointer = memory.readUInt32LE(address + 8);
    if (pointer < 1024 || pointer > memory.length - 4) continue;
    if (pointer + typeDefinitionsCount * 4 > memory.length) continue;
    let valid = true;
    for (let i = 0; i < probes && valid; i += 1) {
      const value = memory.readUInt32LE(pointer + i * (typeDefinitionsCount > probes ? Math.floor(typeDefinitionsCount / probes) * 4 : 4));
      if (value < 1024 || value > memory.length) valid = false;
    }
    if (!valid) continue;
    return address - 40;
  }
  return 0;
}

/**
 * 推导 genericMethodPointers / invokerPointers 全零占位数组需要多少项：
 * 读取 Il2CppMetadataRegistration.genericMethodTable，取其中最大的 methodIndex / invokerIndex。
 * 注意步长：Il2CppGenericMethodFunctionsDefinitions 在 v27.1+ 含 adjustorThunk，为 16 字节；
 * 旧实现按 12 字节推导会让占位数组偏小，导致 Il2Cpp.Init 里 genericMethodPointers[...] 下标越界。
 */
function deriveGenericPointerSlots(memory, metadataRegistration) {
  if (!metadataRegistration) return 0;
  const tablePointer = memory.readUInt32LE(metadataRegistration + 20);
  const tableCount = memory.readUInt32LE(metadataRegistration + 16);
  if (tablePointer < 1024 || tablePointer >= memory.length) return 0;
  if (!Number.isSafeInteger(tableCount) || tableCount <= 0 || tableCount > 5_000_000) return 0;
  const end = tablePointer + tableCount * GENERIC_METHOD_TABLE_ENTRY_BYTES;
  if (end > memory.length) return 0;
  let maxIndex = -1;
  for (let i = 0; i < tableCount; i += 1) {
    const methodIndex = memory.readInt32LE(tablePointer + i * GENERIC_METHOD_TABLE_ENTRY_BYTES + 4);
    const invokerIndex = memory.readInt32LE(tablePointer + i * GENERIC_METHOD_TABLE_ENTRY_BYTES + 8);
    if (methodIndex > maxIndex) maxIndex = methodIndex;
    if (invokerIndex > maxIndex) maxIndex = invokerIndex;
  }
  return maxIndex + 1;
}

function align(value, boundary) {
  return Math.ceil(value / boundary) * boundary;
}

function buildDataSegment(address, data) {
  return Buffer.concat([
    Buffer.from([0x00, 0x41]), // active, memory 0, i32.const
    writeVarUint(address),
    Buffer.from([0x0b]), // end
    writeVarUint(data.length),
    data
  ]);
}

/**
 * 检测并修复“Il2CppCodeRegistration 被常量折叠”的 WebGL 构建。
 *
 * @param {Buffer} wasmBuffer  原始 .wasm
 * @param {Buffer} metadataBuffer global-metadata.dat
 * @returns {{repairApplied:boolean, reason:string, codeGenModules:number, moduleCount:number,
 *            codeRegistration:number, genericPointerSlots:number, wasm:Buffer, log:string[]}}
 */
export function repairIl2CppWasm(wasmBuffer, metadataBuffer) {
  const log = [];
  const result = {
    repairApplied: false,
    reason: "",
    codeGenModules: 0,
    moduleCount: 0,
    codeRegistration: 0,
    genericPointerSlots: 0,
    wasm: wasmBuffer,
    log
  };

  const sections = readWasmSections(wasmBuffer);
  const dataSection = sections.find(section => section.id === 11);
  if (!dataSection) {
    result.reason = "未找到 wasm data 段";
    log.push(result.reason);
    return result;
  }

  const dataSegments = readDataSegments(wasmBuffer, dataSection);
  const { memory, maxEnd } = buildDataMemory(wasmBuffer, dataSection, dataSegments);
  const metadataInfo = readMetadataInfo(metadataBuffer);
  log.push(`metadata v${metadataInfo.header.version}, imageCount=${metadataInfo.imageCount}, typeDefinitionsCount=${metadataInfo.typeDefinitionsCount}`);

  const moduleStructs = findCodeGenModuleStructs(memory, maxEnd);
  if (moduleStructs.size === 0) {
    result.reason = "未在 data 段内找到 Il2CppCodeGenModule 结构，跳过修复";
    log.push(result.reason);
    return result;
  }

  const array = findCodeGenModulesArray(memory, moduleStructs);
  if (!array || array.entries < 2) {
    result.reason = "未能定位 codeGenModules 指针数组，跳过修复";
    log.push(result.reason);
    return result;
  }
  const codeGenModules = array.start;
  result.codeGenModules = codeGenModules;
  result.moduleCount = array.entries;
  log.push(`定位 codeGenModules 数组 @ ${codeGenModules}（${array.entries} 项，模块结构共 ${moduleStructs.size} 个）`);

  // codeGenModules 数组存在，但若没有任何「结构体形态」的指针引用它，说明 Il2CppCodeRegistration 被折叠。
  if (hasCodeRegistrationStruct(memory, codeGenModules, metadataInfo.imageCount)) {
    result.reason = "Il2CppCodeRegistration 已在 data 段中，无需修复";
    log.push(result.reason);
    return result;
  }
  log.push("data 段中无任何结构体形态的指针引用 codeGenModules 数组 —— 判定 Il2CppCodeRegistration 已被常量折叠");

  const metadataRegistration = findMetadataRegistration(memory, metadataInfo.typeDefinitionsCount);
  log.push(metadataRegistration
    ? `Il2CppMetadataRegistration @ ${metadataRegistration}`
    : "未定位到 Il2CppMetadataRegistration（降级处理）");

  let slots = deriveGenericPointerSlots(memory, metadataRegistration);
  if (slots <= 0) slots = WEBASSEMBLY_CODE_POINTER_LIMIT;
  slots = Math.max(slots, 1024);
  // 取 2 的幂上界，便于地址对齐
  let slotCount = 1024;
  while (slotCount < slots) slotCount *= 2;
  if (slotCount > WEBASSEMBLY_CODE_POINTER_LIMIT) {
    // 超过 dumper 自己的 WebAssembly 阈值会触发它的“版本位移”分支（把结构体基址挪偏 8 字节），
    // 因此这里夹到阈值；若真实最大下标恰好超过阈值，需要另行处理（记录告警）。
    log.push(`推导出的占位长度 ${slotCount} 超过 dumper 阈值 ${WEBASSEMBLY_CODE_POINTER_LIMIT}，已夹取到阈值`);
    slotCount = WEBASSEMBLY_CODE_POINTER_LIMIT;
  }
  result.genericPointerSlots = slotCount;

  const codeRegistrationAddress = align(maxEnd + 0x1000, 0x1000);
  const genericPointerTableAddress = align(codeRegistrationAddress + CODE_REGISTRATION_BLOCK.sizeBytes, 0x10);
  const invokerPointerTableAddress = align(genericPointerTableAddress + slotCount * 4, 0x10);

  // 兼容块：搜索端认 +56（并校验 +52 == imageCount），读取端 v29 认 +56、v31 认 +64，因此两处都写。
  const codeRegistration = Buffer.alloc(CODE_REGISTRATION_BLOCK.sizeBytes);
  codeRegistration.writeUInt32LE(slotCount, CODE_REGISTRATION_BLOCK.genericMethodPointersCount);
  codeRegistration.writeUInt32LE(genericPointerTableAddress, CODE_REGISTRATION_BLOCK.genericMethodPointers);
  codeRegistration.writeUInt32LE(slotCount, CODE_REGISTRATION_BLOCK.invokerPointersCount);
  codeRegistration.writeUInt32LE(invokerPointerTableAddress, CODE_REGISTRATION_BLOCK.invokerPointers);
  codeRegistration.writeUInt32LE(metadataInfo.imageCount, CODE_REGISTRATION_BLOCK.codeGenModulesCountV29);
  codeRegistration.writeUInt32LE(codeGenModules, CODE_REGISTRATION_BLOCK.codeGenModulesV29);
  codeRegistration.writeUInt32LE(metadataInfo.imageCount, CODE_REGISTRATION_BLOCK.codeGenModulesCountV31);
  codeRegistration.writeUInt32LE(codeGenModules, CODE_REGISTRATION_BLOCK.codeGenModulesV31);

  const genericPointerTable = Buffer.alloc(slotCount * 4);
  const invokerPointerTable = Buffer.alloc(slotCount * 4);

  const extraSegments = [
    buildDataSegment(codeRegistrationAddress, codeRegistration),
    buildDataSegment(genericPointerTableAddress, genericPointerTable),
    buildDataSegment(invokerPointerTableAddress, invokerPointerTable)
  ];
  const extraBytes = extraSegments.reduce((total, segment) => total + segment.length, 0);

  const body = wasmBuffer.subarray(dataSection.bodyOffset, dataSection.bodyOffset + dataSection.size);
  const countInfo = readVarUint(body, 0);
  const newBody = Buffer.concat([
    writeVarUint(dataSegments.count + extraSegments.length),
    body.subarray(countInfo.next),
    ...extraSegments
  ]);
  const newSize = newBody.length;

  result.wasm = Buffer.concat([
    wasmBuffer.subarray(0, dataSection.sizeOffset),
    writeVarUint(newSize),
    newBody,
    wasmBuffer.subarray(dataSection.bodyOffset + dataSection.size)
  ]);
  result.repairApplied = true;
  result.codeRegistration = codeRegistrationAddress;
  result.reason = "已注入重建的 Il2CppCodeRegistration";
  log.push(`合成 Il2CppCodeRegistration 兼容块 @ ${codeRegistrationAddress}（imageCount=${metadataInfo.imageCount}, codeGenModules=${codeGenModules}, 模块数=${array.entries}）`);
  log.push(`合成全零 genericMethodPointers 占位数组（${slotCount} 项）@ ${genericPointerTableAddress}`);
  log.push(`合成全零 invokerPointers 占位数组（${slotCount} 项）@ ${invokerPointerTableAddress}`);
  log.push(`wasm ${wasmBuffer.length} -> ${result.wasm.length} 字节（+${extraBytes}）`);
  return result;
}
