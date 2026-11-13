#!/usr/bin/env node
// 从大型 IL2CPP WASM 中反汇编单个函数。
//
// 整模块 WAT 对这类构建不可用：Barrel Roller 的代码段就有 37.6 MB、115322 个函数体，
// 转成文本会膨胀到几百 MB。这里只按函数表索引切出一个函数体自行解码，
// 并借助 script.json 把 call 指令还原成方法名，便于读懂真实逻辑。
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import opcodeTable from './wasm-opcodes.json' with {type:'json'};

// npm 的 wabt 包自带 wasm-decompile，输出类 C 伪代码，比 WAT 好读得多。直接用 node 执行它的
// JS 入口，而不是 .bin 里的 .cmd 包装——新版 Node 在 Windows 上拒绝 spawn .cmd（EINVAL）。
const DECOMPILER = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "..", "tools", "wabt-js", "node_modules", "wabt", "bin", "wasm-decompile");

const SECTION_NAMES = { 1: "Type", 2: "Import", 3: "Function", 4: "Table", 5: "Memory", 6: "Global", 7: "Export", 8: "Start", 9: "Element", 10: "Code", 11: "Data", 12: "DataCount" };
const VALUE_TYPES = { 0x7f: "i32", 0x7e: "i64", 0x7d: "f32", 0x7c: "f64", 0x7b: "v128", 0x70: "funcref", 0x6f: "externref" };

// 立即数形式：u32 / s32 / s64 / f32 / f64 / memarg / blocktype / brtable / callindirect / lane
const OPCODES = new Map(Object.entries({
  0x00: ["unreachable"], 0x01: ["nop"], 0x02: ["block", "blocktype"], 0x03: ["loop", "blocktype"],
  0x04: ["if", "blocktype"], 0x05: ["else"], 0x0b: ["end"], 0x0c: ["br", "u32"], 0x0d: ["br_if", "u32"],
  0x0e: ["br_table", "brtable"], 0x0f: ["return"], 0x10: ["call", "func"], 0x11: ["call_indirect", "callindirect"],
  0x1a: ["drop"], 0x1b: ["select"],
  0x20: ["local.get", "u32"], 0x21: ["local.set", "u32"], 0x22: ["local.tee", "u32"],
  0x23: ["global.get", "u32"], 0x24: ["global.set", "u32"],
  0x28: ["i32.load", "memarg"], 0x29: ["i64.load", "memarg"], 0x2a: ["f32.load", "memarg"], 0x2b: ["f64.load", "memarg"],
  0x2c: ["i32.load8_s", "memarg"], 0x2d: ["i32.load8_u", "memarg"], 0x2e: ["i32.load16_s", "memarg"], 0x2f: ["i32.load16_u", "memarg"],
  0x30: ["i64.load8_s", "memarg"], 0x31: ["i64.load8_u", "memarg"], 0x32: ["i64.load16_s", "memarg"], 0x33: ["i64.load16_u", "memarg"],
  0x34: ["i64.load32_s", "memarg"], 0x35: ["i64.load32_u", "memarg"],
  0x36: ["i32.store", "memarg"], 0x37: ["i64.store", "memarg"], 0x38: ["f32.store", "memarg"], 0x39: ["f64.store", "memarg"],
  0x3a: ["i32.store8", "memarg"], 0x3b: ["i32.store16", "memarg"], 0x3c: ["i64.store8", "memarg"],
  0x3d: ["i64.store16", "memarg"], 0x3e: ["i64.store32", "memarg"],
  0x3f: ["memory.size", "u32"], 0x40: ["memory.grow", "u32"],
  0x41: ["i32.const", "s32"], 0x42: ["i64.const", "s64"], 0x43: ["f32.const", "f32"], 0x44: ["f64.const", "f64"],
  0x45: ["i32.eqz"], 0x46: ["i32.eq"], 0x47: ["i32.ne"], 0x48: ["i32.lt_s"], 0x49: ["i32.lt_u"], 0x4a: ["i32.gt_s"],
  0x4b: ["i32.gt_u"], 0x4c: ["i32.le_s"], 0x4d: ["i32.le_u"], 0x4e: ["i32.ge_s"], 0x4f: ["i32.ge_u"],
  0x50: ["i64.eqz"], 0x51: ["i64.eq"], 0x52: ["i64.ne"], 0x53: ["i64.lt_s"], 0x54: ["i64.lt_u"], 0x55: ["i64.gt_s"],
  0x56: ["i64.gt_u"], 0x57: ["i64.le_s"], 0x58: ["i64.le_u"], 0x59: ["i64.ge_s"], 0x5a: ["i64.ge_u"],
  0x5b: ["f32.eq"], 0x5c: ["f32.ne"], 0x5d: ["f32.lt"], 0x5e: ["f32.gt"], 0x5f: ["f32.le"], 0x60: ["f32.ge"],
  0x61: ["f64.eq"], 0x62: ["f64.ne"], 0x63: ["f64.lt"], 0x64: ["f64.gt"], 0x65: ["f64.le"], 0x66: ["f64.ge"],
  0x67: ["i32.clz"], 0x68: ["i32.ctz"], 0x69: ["i32.popcnt"], 0x6a: ["i32.add"], 0x6b: ["i32.sub"], 0x6c: ["i32.mul"],
  0x6d: ["i32.div_s"], 0x6e: ["i32.div_u"], 0x6f: ["i32.rem_s"], 0x70: ["i32.rem_u"], 0x71: ["i32.and"],
  0x72: ["i32.or"], 0x73: ["i32.xor"], 0x74: ["i32.shl"], 0x75: ["i32.shr_s"], 0x76: ["i32.shr_u"],
  0x77: ["i32.rotl"], 0x78: ["i32.rotr"],
  0x7c: ["i64.add"], 0x7d: ["i64.sub"], 0x7e: ["i64.mul"],
  0x8b: ["f32.abs"], 0x8c: ["f32.neg"], 0x8d: ["f32.ceil"], 0x8e: ["f32.floor"], 0x8f: ["f32.trunc"],
  0x90: ["f32.nearest"], 0x91: ["f32.sqrt"], 0x92: ["f32.add"], 0x93: ["f32.sub"], 0x94: ["f32.mul"],
  0x95: ["f32.div"], 0x96: ["f32.min"], 0x97: ["f32.max"], 0x98: ["f32.copysign"],
  0x99: ["f64.abs"], 0x9a: ["f64.neg"], 0x9b: ["f64.ceil"], 0x9c: ["f64.floor"], 0x9d: ["f64.trunc"],
  0x9e: ["f64.nearest"], 0x9f: ["f64.sqrt"], 0xa0: ["f64.add"], 0xa1: ["f64.sub"], 0xa2: ["f64.mul"],
  0xa3: ["f64.div"], 0xa4: ["f64.min"], 0xa5: ["f64.max"], 0xa6: ["f64.copysign"],
  0xa7: ["i32.wrap_i64"], 0xa8: ["i32.trunc_f32_s"], 0xa9: ["i32.trunc_f32_u"], 0xaa: ["i32.trunc_f64_s"], 0xab: ["i32.trunc_f64_u"],
  0xac: ["i64.extend_i32_s"], 0xad: ["i64.extend_i32_u"],
  0xb2: ["f32.convert_i32_s"], 0xb3: ["f32.convert_i32_u"], 0xb6: ["f32.demote_f64"],
  0xb7: ["f64.convert_i32_s"], 0xb8: ["f64.convert_i32_u"], 0xbb: ["f64.promote_f32"],
  0xbc: ["i32.reinterpret_f32"], 0xbe: ["f32.reinterpret_i32"],
}).map(([key, value]) => [Number(key), value]));
const PREFIX_OPCODES=new Map();
for(const entry of opcodeTable.entries){
  if(entry.prefix===0){if(!OPCODES.has(entry.code))OPCODES.set(entry.code,[entry.name,entry.immediate]);}
  else PREFIX_OPCODES.set(`${entry.prefix}:${entry.code}`,[entry.name,entry.immediate]);
}

class Reader {
  constructor(buffer, offset = 0) { this.buffer = buffer; this.offset = offset; }
  byte() { return this.buffer[this.offset++]; }
  u32() {
    let result = 0, shift = 0, byte;
    do { byte = this.buffer[this.offset++]; result += (byte & 0x7f) * 2 ** shift; shift += 7; } while (byte & 0x80);
    return result;
  }
  s(bits) {
    let result = 0n, shift = 0n, byte;
    do { byte = this.buffer[this.offset++]; result |= BigInt(byte & 0x7f) << shift; shift += 7n; } while (byte & 0x80);
    if (byte & 0x40 && shift < BigInt(bits)) result |= -1n << shift;
    return BigInt.asIntN(bits, result);
  }
  f32() { const value = this.buffer.readFloatLE(this.offset); this.offset += 4; return value; }
  f64() { const value = this.buffer.readDoubleLE(this.offset); this.offset += 8; return value; }
  vec(read) { return Array.from({ length: this.u32() }, () => read()); }
}

export function readSections(buffer) {
  if (buffer.readUInt32LE(0) !== 0x6d736100) throw new Error("不是 WASM 模块");
  const sections = [];
  const reader = new Reader(buffer, 8);
  while (reader.offset < buffer.length) {
    const id = reader.byte();
    const size = reader.u32();
    sections.push({ id, name: SECTION_NAMES[id] || `Custom(${id})`, start: reader.offset, size });
    reader.offset += size;
  }
  return sections;
}

// 函数索引空间是「先导入后定义」，代码段只覆盖后半段。这个计数同时是签名表和函数体的
// 偏移基准，一旦少算，取到的就是完全不相干的函数——所以解析完必须落在段尾，否则直接报错。
function countImportedFunctions(buffer, section) {
  if (!section) return 0;
  const reader = new Reader(buffer, section.start);
  const total = reader.u32();
  let functions = 0;
  for (let index = 0; index < total; index += 1) {
    // `reader.offset += reader.u32()` 会先取 offset 旧值，丢掉 u32() 自身推进的字节，
    // 于是长度前缀没被跳过。必须先取长度再前进。
    const moduleLength = reader.u32();
    reader.offset += moduleLength;
    const fieldLength = reader.u32();
    reader.offset += fieldLength;
    const kind = reader.byte();
    if (kind === 0x00) { reader.u32(); functions += 1; }   // func：typeidx
    else if (kind === 0x01) {                              // table：elemtype + limits
      reader.byte();
      const flags = reader.byte();
      reader.u32();
      if (flags & 0x01) reader.u32();
    } else if (kind === 0x02) {                            // memory：limits
      const flags = reader.byte();
      reader.u32();
      if (flags & 0x01) reader.u32();
    } else if (kind === 0x03) { reader.byte(); reader.byte(); }  // global：valtype + mut
    else throw new Error(`导入段第 ${index} 项出现未知类型 0x${kind.toString(16)}`);
  }
  const finish = section.start + section.size;
  if (reader.offset !== finish) throw new Error(`导入段解析未落在段尾（${reader.offset} ≠ ${finish}），计数不可信`);
  return functions;
}

// script.json 的 Address 是函数表索引；元素段给出表索引 → 函数索引。
export function readTableMap(buffer, section) {
  const byTable = new Map(), byFunction = new Map();
  if (!section) return { byTable, byFunction };
  const reader = new Reader(buffer, section.start);
  for (let segment = 0, total = reader.u32(); segment < total; segment += 1) {
    const flags = reader.u32();
    if (flags !== 0) throw new Error(`元素段使用了尚未支持的形式 flags=${flags}`);
    let base = 0;                                        // offset 表达式：i32.const N end
    if (reader.byte() === 0x41) base = Number(reader.s(32));
    while (reader.byte() !== 0x0b);                      // 跳到表达式结束
    reader.offset -= 1;
    reader.byte();
    const functions = reader.vec(() => reader.u32());
    functions.forEach((functionIndex, position) => {
      const tableIndex = base + position;
      byTable.set(tableIndex, functionIndex);
      if (!byFunction.has(functionIndex)) byFunction.set(functionIndex, tableIndex);
    });
  }
  return { byTable, byFunction };
}

// 类型段 + 函数段给出每个已定义函数的真实签名，是核对「名字是否对得上」的权威依据。
function readSignatures(buffer, typeSection, functionSection) {
  const types = [];
  if (typeSection) {
    const reader = new Reader(buffer, typeSection.start);
    for (let index = 0, total = reader.u32(); index < total; index += 1) {
      reader.byte();                                     // 0x60 func
      const params = reader.vec(() => VALUE_TYPES[reader.byte()] || "?");
      const results = reader.vec(() => VALUE_TYPES[reader.byte()] || "?");
      types.push({ params, results, text: `(${params.join(", ")}) -> ${results.join(", ") || "void"}` });
    }
  }
  const typeOfFunction = [];
  if (functionSection) {
    const reader = new Reader(buffer, functionSection.start);
    for (let index = 0, total = reader.u32(); index < total; index += 1) typeOfFunction.push(reader.u32());
  }
  return { types, typeOfFunction };
}

function readCodeOffsets(buffer, section) {
  const reader = new Reader(buffer, section.start);
  const total = reader.u32();
  const bodies = [];
  for (let index = 0; index < total; index += 1) {
    const size = reader.u32();
    bodies.push({ start: reader.offset, size });
    reader.offset += size;
  }
  return bodies;
}

function blockType(reader) {
  const byte = reader.buffer[reader.offset];
  if (byte === 0x40) { reader.offset += 1; return ""; }
  if (VALUE_TYPES[byte]) { reader.offset += 1; return ` (result ${VALUE_TYPES[byte]})`; }
  return ` (type ${reader.s(33)})`;
}

export function disassemble(buffer, body, describeFunction) {
  const reader = new Reader(buffer, body.start);
  const end = body.start + body.size;
  const locals = [];
  for (let index = 0, groups = reader.u32(); index < groups; index += 1) {
    const count = reader.u32();
    const type = VALUE_TYPES[reader.byte()] || "?";
    locals.push(`${count} × ${type}`);
  }
  const lines = [];
  let depth = 1;
  while (reader.offset < end) {
    const offset = reader.offset;
    const opcode = reader.byte();
    const subopcode=[0xfc,0xfd,0xfe].includes(opcode)?reader.u32():undefined;
    const entry = subopcode===undefined?OPCODES.get(opcode):PREFIX_OPCODES.get(`${opcode}:${subopcode}`);
    if (!entry) {
      // Unknown immediate widths make all following offsets untrustworthy.
      // Stop rather than interpreting operand bytes as invented instructions.
      throw new Error(`不支持的操作码 0x${opcode.toString(16)}${subopcode===undefined?'':':'+subopcode}，偏移0x${offset.toString(16)}；已停止解码，后续指令不可推断`);
    }
    const [name, immediate] = entry;
    if (name === "end" || name === "else") depth = Math.max(1, depth - 1);
    let text = name;
    if (immediate === "u32") text += ` ${reader.u32()}`;
    else if (immediate === "s32") text += ` ${reader.s(32)}`;
    else if (immediate === "s64") text += ` ${reader.s(64)}`;
    else if (immediate === "s33") text += ` ${reader.s(33)}`;
    else if (immediate === "f32") text += ` ${reader.f32()}`;
    else if (immediate === "f64") text += ` ${reader.f64()}`;
    else if (immediate === "memarg"||immediate === "memlane") { const flags=reader.u32(),memory=flags&64?reader.u32():0,align=flags&63; text += ` offset=${reader.u32()} align=${2 ** align}${memory?' memory='+memory:''}`;if(immediate==='memlane')text+=` lane=${reader.byte()}`; }
    else if (immediate === "lane") text += ` ${reader.byte()}`;
    else if (immediate === "bytes16") {const values=Array.from(reader.buffer.subarray(reader.offset,reader.offset+16));reader.offset+=16;text+=` ${name==='v128.const'?'i8x16 ':''}${values.join(' ')}`;}
    else if (immediate === "types") text += ` (${reader.vec(()=>VALUE_TYPES[reader.byte()]||'?').join(' ')})`;
    else if (immediate === "twoindices") text += ` ${reader.u32()} ${reader.u32()}`;
    else if (immediate === "blocktype") text += blockType(reader);
    else if (immediate === "func") { const target = reader.u32(); text += ` ${target}${describeFunction(target)}`; }
    else if (immediate === "callindirect") { const type = reader.u32(); reader.u32(); text += ` (type ${type})`; }
    else if (immediate === "brtable") { const targets = reader.vec(() => reader.u32()); text += ` [${targets.join(" ")}] default=${reader.u32()}`; }
    lines.push({ offset, depth, text });
    if(reader.offset>end)throw new Error('操作码立即数超出函数体边界');
    if (name === "block" || name === "loop" || name === "if" || name === "else" || name==='try') depth += 1;
  }
  return { locals, lines };
}

function leb(value) {
  const bytes = [];
  do { let byte = value & 0x7f; value >>>= 7; if (value) byte |= 0x80; bytes.push(byte); } while (value);
  return Buffer.from(bytes);
}

// wasm-decompile 只能整模块处理，而这个模块有 115322 个函数、37.6MB 代码段。
// 于是重建一个「同构」模块：类型/导入/函数/内存等段原样保留以维持所有索引有效，
// 代码段里只留目标函数的真实函数体，其余一律换成 4 字节的 unreachable 桩。
// 桩对任何签名都合法，所以模块整体仍然有效，体积却降到 1MB 以内。
export function buildSingleFunctionModule(archive, bodyIndex) {
  const keep = [1, 2, 3, 4, 5, 6];
  const parts = [Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])];
  for (const id of keep) {
    const section = archive.sections.find(item => item.id === id);
    if (!section) continue;
    parts.push(Buffer.from([id]), leb(section.size),
      archive.buffer.subarray(section.start, section.start + section.size));
  }
  const stub = Buffer.from([0x03, 0x00, 0x00, 0x0b]);   // 长度3：局部变量0 + unreachable + end
  const bodies = [leb(archive.bodies.length)];
  archive.bodies.forEach((body, index) => {
    if (index === bodyIndex) {
      bodies.push(leb(body.size), archive.buffer.subarray(body.start, body.start + body.size));
    } else {
      bodies.push(stub);
    }
  });
  const code = Buffer.concat(bodies);
  parts.push(Buffer.from([10]), leb(code.length), code);
  return Buffer.concat(parts);
}

export async function loadArchive(archiveRoot) {
  const wasmRoot = path.join(archiveRoot, "analysis", "wasm");
  const candidates = (await readdir(wasmRoot).catch(() => [])).filter(name => name.endsWith(".wasm"));
  if (!candidates.length) throw new Error(`${wasmRoot} 下没有找到 .wasm`);
  const buffer = await readFile(path.join(wasmRoot, candidates[0]));
  const sections = readSections(buffer);
  const find = id => sections.find(item => item.id === id);
  const importedFunctions = countImportedFunctions(buffer, find(2));
  const { byTable, byFunction } = readTableMap(buffer, find(9));
  const { types, typeOfFunction } = readSignatures(buffer, find(1), find(3));
  const bodies = readCodeOffsets(buffer, find(10));
  const signatureOf = functionIndex => types[typeOfFunction[functionIndex - importedFunctions]];
  // script.json 除了方法表，还给出静态元数据和字面量的地址。反编译输出里那些光秃秃的
  // 常量（例如 5254220[0]）多半就是它们，解开之后才看得懂代码在碰哪个单例。
  const dump = await readFile(path.join(archiveRoot, "analysis", "il2cpp", "script.json"), "utf8")
    .then(text => JSON.parse(text)).catch(() => ({}));
  const script = dump.ScriptMethod || [];
  const nameByTable = new Map(script.map(item => [item.Address, item.Name]));
  const metadataByAddress = new Map((dump.ScriptMetadata || []).map(item => [item.Address, item.Name]));
  const stringByAddress = new Map((dump.ScriptString || []).map(item => [item.Address, item.Value]));
  const classes = await readFile(path.join(archiveRoot, "analysis", "il2cpp", "project-classes.json"), "utf8")
    .then(text => JSON.parse(text).items || []).catch(() => []);
  // 类全名 → (字节偏移 → 字段名)，用来把反编译里的 a[11] 还原成 a.position
  const fieldsByType = new Map(classes.map(item => {
    const full = (item.namespace ? `${item.namespace}.` : "") + item.name;
    const offsets = new Map();
    for (const field of item.fields || []) {
      const offset = Number.parseInt(field.offset, 16);
      if (Number.isFinite(offset)) offsets.set(offset, field.declaration.split(/\s+/).at(-1));
    }
    return [full, offsets];
  }));
  return { buffer, sections, importedFunctions, byTable, byFunction, bodies, script, nameByTable,
    metadataByAddress, stringByAddress, fieldsByType, signatureOf, wasmFile: candidates[0] };
}

// wasm-decompile 的下标是按访问宽度缩放的：a[11]:float 指字节偏移 44，a[110]:ubyte 指 110。
const ACCESS_WIDTH = { byte: 1, ubyte: 1, short: 2, ushort: 2, int: 4, uint: 4, float: 4, int_ptr: 4, long: 8, ulong: 8, double: 8 };

// 反编译输出里只有裸地址和裸下标，人要靠它写 bot 就得两头查表。这里把已知的静态元数据
// 地址换成类型名，把第一个参数（实例方法的 this）的字段下标换成字段名。
export function annotateDecompiled(text, archive, ownerType) {
  let output = text;
  const declaration = text.match(/^function\s+\w+\(\s*(\w+)\s*:/m);
  const self = declaration?.[1];
  const fields = ownerType ? archive.fieldsByType.get(ownerType) : undefined;

  if (self && fields) {
    output = output.replace(new RegExp(`\\b${self}\\[(\\d+)\\]:(\\w+)`, "g"), (whole, index, access) => {
      const width = ACCESS_WIDTH[access];
      if (!width) return whole;
      const name = fields.get(Number(index) * width);
      return name ? `${self}.${name}:${access}` : whole;
    });
  }
  // 静态元数据地址：5254220[0] → Lean.Touch.LeanTouch_TypeInfo[0]
  output = output.replace(/\b(\d{6,})\[/g, (whole, digits) => {
    const name = archive.metadataByAddress.get(Number(digits));
    return name ? `${name}[` : whole;
  });
  // 字面量地址单独标注，方便认出 UI 文案和事件名
  output = output.replace(/\b(\d{6,})\b(?!\[)/g, (whole, digits) => {
    const value = archive.stringByAddress.get(Number(digits));
    return value ? `${whole} /* "${value.slice(0, 40)}" */` : whole;
  });
  return output;
}

export function describeFunctionFactory(archive) {
  return functionIndex => {
    const tableIndex = archive.byFunction.get(functionIndex);
    const name = tableIndex === undefined ? undefined : archive.nameByTable.get(tableIndex);
    return name ? `  ; ${name}` : "";
  };
}

async function main(argv) {
  const archiveRoot = argv.find(value => !value.startsWith("--"));
  const option = flag => { const index = argv.indexOf(flag); return index < 0 ? undefined : argv[index + 1]; };
  if (!archiveRoot) {
    console.error("用法: node src/wasm-function.mjs <归档目录> [--method 名称片段] [--table-index N] [--func-index N] [--out 文件]");
    process.exitCode = 1;
    return;
  }
  const archive = await loadArchive(archiveRoot);
  const method = option("--method");
  let tableIndex = option("--table-index") === undefined ? undefined : Number(option("--table-index"));
  let functionIndex = option("--func-index") === undefined ? undefined : Number(option("--func-index"));

  if (method !== undefined) {
    const matches = archive.script.filter(item => item.Name.includes(method));
    if (!matches.length) throw new Error(`script.json 中没有匹配「${method}」的方法`);
    if (matches.length > 1 && option("--first") === undefined) {
      console.error(`「${method}」匹配到 ${matches.length} 个方法，请写得更具体，或加 --first 取第一个：`);
      for (const item of matches.slice(0, 20)) console.error(`  ${item.Address}  ${item.Name}`);
      process.exitCode = 1;
      return;
    }
    tableIndex = matches[0].Address;
    console.log(`方法：${matches[0].Name}`);
    console.log(`签名：${matches[0].Signature || "(无)"}`);
  }
  if (functionIndex === undefined) {
    if (tableIndex === undefined) throw new Error("需要 --method 或 --table-index 或 --func-index");
    functionIndex = archive.byFunction.size ? archive.byTable.get(tableIndex) : undefined;
    if (functionIndex === undefined) throw new Error(`函数表索引 ${tableIndex} 不在元素段中`);
  }
  const bodyIndex = functionIndex - archive.importedFunctions;
  if (bodyIndex < 0) throw new Error(`函数索引 ${functionIndex} 属于导入函数，模块内没有函数体`);
  const body = archive.bodies[bodyIndex];
  if (!body) throw new Error(`函数索引 ${functionIndex} 超出代码段范围`);

  // 实例方法的第一个参数就是 this，据此把字段下标还原成字段名。
  const resolvedName = tableIndex === undefined ? undefined : archive.nameByTable.get(tableIndex);
  const ownerType = resolvedName?.includes("$$") ? resolvedName.split("$$")[0] : undefined;
  const { locals, lines } = disassemble(archive.buffer, body, describeFunctionFactory(archive));
  const header = [
    `模块：${archive.wasmFile}`,
    `函数表索引：${tableIndex ?? "(未知)"}  函数索引：${functionIndex}  代码段第 ${bodyIndex} 个函数体`,
    `WASM 签名：${archive.signatureOf(functionIndex)?.text || "(未知)"}`,
    `函数体大小：${body.size} 字节  局部变量：${locals.join(", ") || "无"}`,
    "",
  ];
  const text = header.concat(lines.map(line =>
    `${line.offset.toString(16).padStart(8, "0")}  ${"  ".repeat(line.depth)}${line.text}`)).join("\n");
  const out = option("--out");
  if (argv.includes("--decompile")) {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const module = buildSingleFunctionModule(archive, bodyIndex);
    const temporary = path.join(path.dirname(out || "."), `.single-${functionIndex}.wasm`);
    await writeFile(temporary, module);
    try {
      const { stdout } = await promisify(execFile)(process.execPath, [DECOMPILER, temporary],
        { maxBuffer: 512 * 1024 * 1024 });
      // 桩函数会占满输出，只截取目标函数那一段。wasm-decompile 给函数起的是 f_a/f_b 这类名字，
      // 真正的函数索引写在行尾注释里（// func34406），所以按注释定位再回退到声明行。
      const marker = stdout.indexOf(`// func${functionIndex}\n`);
      const declaration = marker < 0 ? -1 : stdout.lastIndexOf("\nfunction ", marker) + 1;
      const slice = declaration <= 0 ? stdout : stdout.slice(declaration).split(/\n(?=function )/)[0];
      if (marker < 0) throw new Error(`反编译输出中找不到 // func${functionIndex}，无法截取目标函数`);
      const body = header.concat([annotateDecompiled(slice, archive, ownerType)]).join("\n");
      if (out) { await writeFile(out, body, "utf8"); console.log(`已写入 ${out}`); } else console.log(body);
    } finally {
      await rm(temporary, { force: true });
    }
    return;
  }
  if (out) { await writeFile(out, text, "utf8"); console.log(`已写入 ${out}（${lines.length} 条指令）`); }
  else console.log(text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(`失败：${error.message}`); process.exitCode = 1; });
}
