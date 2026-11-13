// 生成「写 bot 专用」的解析产物。
//
// 解析阶段原本只产出 automation-context.json（文件清单 + IL2CPP 状态），能告诉你文件在哪，
// 却不能告诉你怎么驱动这个游戏。真正写 bot 时需要的是三样东西，过去都得自己去 56MB 的
// script.json 和 2MB 的 project-classes.json 里手工刨：
//
//   1. 方法名 → IL2CPP 函数指针（旧 Unity 走 dynCall，新 Unity 可直接查函数表）
//   2. 类 → 字段名 → 字节偏移（bot 靠偏移直接读写对象状态）
//   3. 一套 IL2CPP 桥接样板（托管字符串、类型查找、FindObjectsOfType、out 参数……）
//
// 这里把前两样压缩成一份只含游戏自身代码的索引，第三样直接生成可 import 的运行时。
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadArchive } from "./wasm-function.mjs";

// Unity 引擎、.NET 基础库，以及广告/工具/发行商中间件：都不是这个游戏自己的玩法代码。
const NOT_GAME = /^(UnityEngine|System|Unity|TMPro|DG\.|Mono|Microsoft|Newtonsoft|Firebase|Google|Spine|Cinemachine|I18N|Facebook|GameAnalytics|Interop|Il2Cpp|__|<|MaxSdk|AppLovin|IronSource|MoreMountains|Voodoo|PathCreation|Sirenix|Coffee|Doozy|Lean|EasyMobile|Rewired|SRDebugger|SRF|PaperPlaneTools|ToonyColorsPro|MS\.Internal)/;
// 玩法相关的词根，用来把最可能先看的类排到前面，纯属排序提示，不做过滤。
const GAMEPLAY_HINT = /(player|ball|input|control|level|obstacle|hazard|path|follow|spawn|trigger|collect|score|game|manager|move|speed|stack|reward|enemy|die|finish|win|lose)/i;

const REQUIRED_SIGNATURES = new Map([
  ["System.String$$FastAllocateString", [/::FastAllocateString\(System\.Int32 length\)$/, /FastAllocateString \(int32_t length, const MethodInfo\* method\)/]],
  ["System.Type$$GetType", [/::GetType\(System\.String typeName\)$/, /GetType \(System_String_o\* typeName, const MethodInfo\* method\)/]],
  ["UnityEngine.Object$$FindObjectsOfType", [/::FindObjectsOfType\(System\.Type type, System\.Boolean includeInactive\)$/, /FindObjectsOfType \(System_Type_o\* type, bool includeInactive, const MethodInfo\* method\)/]],
]);

export function chooseRequiredMethod(name, matches) {
  const patterns = REQUIRED_SIGNATURES.get(name) || [];
  return matches.find(item => patterns.some(pattern => pattern.test(item.Signature || "")))
    || matches.find(item => item.IsStatic === true && item.ParameterCount === ({'System.String$$FastAllocateString':1,'System.Type$$GetType':1,'UnityEngine.Object$$FindObjectsOfType':2})[name])
    || [...matches].sort((a, b) => (a.Signature || "").length - (b.Signature || "").length)[0];
}

function emscriptenType(type) {
  if (/^void$/i.test(type.trim())) return "v";
  if (/\bdouble\b/i.test(type)) return "d";
  if (/\bfloat\b/i.test(type)) return "f";
  if (/\b(?:u?int64_t|long\s+long)\b/i.test(type)) return "j";
  return "i";
}

// Unity 6 的构建会把 IL2CPP 元数据表常量折叠，dump.cs 里方法签名全部退化成 object，
// 于是 emscriptenSignature() 拿不到可用文本。此时退回 wasm 类型段：函数表索引 → 真实函数
// 的 wasm 签名（含 this 与末尾的 MethodInfo*），刚好等价于 dynCall 需要的形态。
function wasmDynCall(archive, table) {
  // 方法指针为 0 的是泛型共享桩 / 未实现方法，函数表第 0 项不是它的实现。
  if (!Number.isInteger(table) || table <= 0) return null;
  const functionIndex = archive?.byTable?.get?.(table);
  if (!Number.isInteger(functionIndex)) return null;
  const signature = archive?.signatureOf?.(functionIndex);
  if (!signature?.params) return null;
  const code = type => (type === "i32" ? "i" : type === "i64" ? "j" : type === "f32" ? "f"
    : type === "f64" ? "d" : type === "v128" ? null : null);
  const result = signature.results?.length ? code(signature.results[0]) : "v";
  const params = signature.params.map(code);
  if (!result || params.some(item => !item)) return null;
  return result + params.join("");
}

export function emscriptenSignature(signature) {
  const match = signature?.trim().match(/^(.+?)\s+\S+\s*\((.*)\);?$/);
  if (!match) return null;
  const parameters = match[2].trim();
  return emscriptenType(match[1]) + (parameters && parameters !== "void"
    ? parameters.split(",").map(emscriptenType).join("")
    : "");
}

export const RUNTIME_SOURCE = `// IL2CPP 桥接运行时（由归档解析自动生成，请勿手改）。
//
// 用法：先在页面里拿到 Unity 的 Module，再传进来。
//   const bridge = attach(unityInstance.Module, context);
//   const level = bridge.readInt(obj + bridge.field("LevelManager", "level"));
//
// 注意：旧 Unity WebGL 的函数指针不是直接的 table 索引，invoke() 会优先走对应的
// Module.dynCall_*；新版本没有 dynCall 时才回退到 table.get()。
export function attach(module, context) {
  // Unity 6 的 asm 导出名被压缩（例如 wasmTable = Module["asm"]["dl"]），
  // 因此按「对象带 get/ length」的特征在 asm 与 module 上兜底查找函数表。
  const findFunctionTable = () => {
    if (module.asm?.__indirect_function_table) return module.asm.__indirect_function_table;
    if (module.wasmTable) return module.wasmTable;
    if (module.__ttFunctionTable) return module.__ttFunctionTable;
    const candidates = [];
    for (const bag of [module.asm, module]) {
      if (!bag || typeof bag !== 'object') continue;
      for (const key of Object.keys(bag)) {
        const value = bag[key];
        if (value && typeof value.get === 'function' && typeof value.length === 'number') candidates.push(value);
      }
    }
    return candidates.sort((a, b) => b.length - a.length)[0] || null;
  };
  const table = findFunctionTable();
  if (!table) throw new Error("Unity Module 尚未就绪：拿不到函数表");

  const methodIndex = new Map();
  for (const item of context.methods) {
    if (!methodIndex.has(item.name)) methodIndex.set(item.name, []);
    methodIndex.get(item.name).push(item);
  }
  const typeIndex = new Map();
  for (const type of context.types) {
    for (const key of new Set([type.name, type.id].filter(Boolean))) {
      if (!typeIndex.has(key)) typeIndex.set(key, []);
      typeIndex.get(key).push(type);
    }
  }

  const call = (index, ...args) => table.get(index)(...args);
  const readPointer = address => module.HEAPU32[address >>> 2];
  const readInt = address => module.HEAP32[address >>> 2];
  const readFloat = address => module.HEAPF32[address >>> 2];
  const readByte = address => module.HEAPU8[address];
  const writeFloat = (address, value) => { module.HEAPF32[address >>> 2] = value; };
  const writeInt = (address, value) => { module.HEAP32[address >>> 2] = value; };

  const resolveMethod = query => {
    const name = typeof query === "string" ? query : query.name;
    let matches = methodIndex.get(name) || [];
    if (typeof query !== "string") matches = matches.filter(item =>
      (query.signature === undefined || item.signature === query.signature) &&
      (query.table === undefined || item.table === query.table));
    else if (matches.some(item => item.required)) matches = matches.filter(item => item.required);
    if (new Set(matches.map(item => item.table)).size > 1) throw new Error("方法名存在歧义，请指定 signature 或 table：" + name);
    const item = matches[0];
    if (!item) throw new Error("上下文里没有这个方法：" + name);
    return item;
  };
  const method = query => resolveMethod(query).table;
  const field = (typeName, fieldName) => {
    const types = typeIndex.get(typeName) || [];
    if (types.length > 1) throw new Error("类型名存在歧义，请使用 context.types 中的 id：" + typeName);
    const entry = types[0]?.fields.find(item => item.name === fieldName);
    if(entry?.static)throw new Error('静态字段不属于实例地址；需核验真实类静态数据布局：'+typeName+'.'+fieldName);
    const offset = entry?.offset;
    if (offset === undefined) throw new Error("上下文里没有这个字段：" + typeName + "." + fieldName);
    return offset;
  };
  const invoke = (name, ...args) => {
    const item = resolveMethod(name);
    const dynamic = item.dynCall && module["dynCall_" + item.dynCall];
    return dynamic ? dynamic.call(module, item.table, ...args, 0) : call(item.table, ...args, 0);
  };

  // IL2CPP 字符串布局：+8 长度，+12 起 UTF-16 字符。
  const managedString = value => {
    const pointer = invoke("System.String$$FastAllocateString", value.length);
    module.HEAPU32[(pointer + 8) >>> 2] = value.length;
    for (let i = 0; i < value.length; i += 1) module.HEAPU16[(pointer + 12 + i * 2) >>> 1] = value.charCodeAt(i);
    return pointer;
  };
  const readString = pointer => {
    if (!pointer) return "";
    const length = module.HEAPU32[(pointer + 8) >>> 2];
    if (length > 4096) return "";
    let text = "";
    for (let i = 0; i < length; i += 1) text += String.fromCharCode(module.HEAPU16[(pointer + 12 + i * 2) >>> 1]);
    return text;
  };

  const typeCache = new Map();
  const getType = (name, assembly = "Assembly-CSharp") => {
    const key = name + ", " + assembly;
    if (!typeCache.has(key)) typeCache.set(key, invoke("System.Type$$GetType", managedString(key)));
    return typeCache.get(key);
  };

  // Il2CppArray 布局：+12 元素个数，+16 起数据。
  const arrayItems = pointer => {
    if (!pointer) return [];
    const count = module.HEAPU32[(pointer + 12) >>> 2];
    const items = [];
    for (let i = 0; i < count; i += 1) {
      const value = readPointer(pointer + 16 + i * 4);
      if (value) items.push(value);
    }
    return items;
  };
  // List<T> 布局：+8 内部数组，+12 元素个数。
  const listItems = pointer => {
    if (!pointer) return [];
    const size = readInt(pointer + 12);
    const items = readPointer(pointer + 8);
    return Array.from({ length: size }, (_, i) => readPointer(items + 16 + i * 4)).filter(Boolean);
  };

  const alive = pointer => {
    if (!pointer) return false;
    try { return Boolean(invoke("UnityEngine.Object$$op_Implicit", pointer)); } catch { return false; }
  };
  const findObjects = (typeName, assembly, includeInactive = 1) => {
    const type = getType(typeName, assembly);
    if (methodIndex.has("UnityEngine.Object$$FindObjectsOfType")) {
      return arrayItems(invoke("UnityEngine.Object$$FindObjectsOfType", type, includeInactive));
    }
    if (methodIndex.has("UnityEngine.Resources$$FindObjectsOfTypeAll")) {
      return arrayItems(invoke("UnityEngine.Resources$$FindObjectsOfTypeAll", type));
    }
    if (methodIndex.has("UnityEngine.ResourcesAPIInternal$$FindObjectsOfTypeAll")) {
      return arrayItems(invoke("UnityEngine.ResourcesAPIInternal$$FindObjectsOfTypeAll", type));
    }
    return [];
  };
  const gameObjectOf = component => invoke("UnityEngine.Component$$get_gameObject", component);
  const activeInHierarchy = gameObject => Boolean(invoke("UnityEngine.GameObject$$get_activeInHierarchy", gameObject));
  const activeComponent = component => {
    if (!alive(component)) return false;
    const gameObject = gameObjectOf(component);
    return alive(gameObject) && activeInHierarchy(gameObject);
  };
  const transformOf = component => invoke("UnityEngine.Component$$get_transform", component);

  // Unity 的 _Injected 方法用 out 指针返回结构体，必须自己分配再释放。
  const structOut = (name, object, floats) => {
    const buffer = module._malloc(floats * 4);
    try {
      // Unity 6 Injected accessors take the native IntPtr, rather than the
      // managed object. Use the public sret getter, whose original body
      // performs the managed-to-native conversion and null checks.
      if (((resolveMethod(name).signature || "").includes("IntPtr_o* _unity_self") || (resolveMethod(name).signature || "").includes("intptr_t _unity_self"))) {
        const getter = name.replace(/_Injected$/, "");
        const target = resolveMethod(getter);
        if (target.dynCall !== "viii") throw new Error("未验证的结构体返回 ABI：" + getter);
        invoke(getter, buffer, object);
      } else invoke(name, object, buffer);
      return Array.from({ length: floats }, (_, i) => readFloat(buffer + i * 4));
    } finally { module._free(buffer); }
  };
  const worldPosition = transform => structOut("UnityEngine.Transform$$get_position_Injected", transform, 3);
  const colliderBounds = collider => {
    const values = structOut("UnityEngine.Collider$$get_bounds_Injected", collider, 6);
    return { center: values.slice(0, 3), extents: values.slice(3, 6) };
  };

  return {
    module, table, call, invoke, method, field,
    readPointer, readInt, readFloat, readByte, writeFloat, writeInt,
    managedString, readString, getType, arrayItems, listItems,
    alive, findObjects, gameObjectOf, activeInHierarchy, activeComponent,
    transformOf, structOut, worldPosition, colliderBounds,
  };
}
`;

function readmeSource(context) {
  return `# Bot 开发套件

本目录由归档解析自动生成，供编写自动运行脚本使用。**每次重新解析都会覆盖。**

- 引擎：${context.meta.engine}
- WASM 模块：\`${context.meta.wasmFile}\`
- 游戏自身的类：${context.types.length} 个；方法：${context.methods.length} 个
  （已剔除 Unity 引擎、.NET 基础库和广告/工具/发行商中间件）

## 文件

- \`context.json\`：方法名 → IL2CPP 函数指针/dynCall 签名、类 → 字段名 → 字节偏移
- \`runtime.mjs\`：IL2CPP 桥接运行时，封装了托管字符串、类型查找、FindObjectsOfType、
  Transform/Collider 的 out 参数读取等样板

## 接上游戏

Unity 的 Module 必须先拿到手。做法是拦截页面 HTML，在 loader 回调里把它挂到全局：

\`\`\`js
body = body.replace(".then((unityInstance) => {",
  ".then((unityInstance) => { globalThis.__module = unityInstance.Module;");
\`\`\`

然后在页面上下文里：

\`\`\`js
import { attach } from "./runtime.mjs";
const bridge = attach(globalThis.__module, context);

const managers = bridge.findObjects("LevelManager", "Assembly-CSharp").filter(bridge.activeComponent);
const level = bridge.readInt(managers[0] + bridge.field("LevelManager", "level"));
\`\`\`

## 两个容易踩的坑

1. **实例方法的参数是 \`(this, ...实参, methodInfo)\`**，\`methodInfo\` 传 \`0\`。
   \`invoke()\` 已经帮你补好末尾的 0，并根据上下文自动选择 \`dynCall_*\` 或函数表。
2. **不要直接写游戏每帧重算的字段**。先用
   \`node src/wasm-function.mjs <归档目录> --method "类名$$方法名" --decompile\`
   看清楚那个字段是怎么被赋值的，否则写进去当帧就被覆盖。

## 名称歧义

同名类型使用 \`context.types\` 中的程序集/TypeDefIndex \`id\` 查询字段。重载方法使用 \`bridge.method({name, signature})\` 或 \`{name, table}\`；\`invoke\` 同样接受该对象。名称不唯一时明确报错，不再静默覆盖。

## 查看某个方法的真实逻辑

\`\`\`bash
node src/wasm-function.mjs <归档目录> --method "InputController$$FixedUpdate" --decompile
\`\`\`
`;
}

export async function writeBotKit(captureRoot, onEvent = () => {}) {
  const botRoot = path.join(captureRoot, "analysis", "bot");
  let archive;
  try {
    archive = await loadArchive(captureRoot);
  } catch (error) {
    onEvent({ type: "bot-kit", status: "skipped", reason: error.message });
    return { status: "skipped", reason: error.message };
  }
  if (!archive.script.length) {
    const reason = "没有 IL2CPP 方法表（script.json 为空或缺失），无法生成 bot 索引";
    onEvent({ type: "bot-kit", status: "skipped", reason });
    return { status: "skipped", reason };
  }

  const methods = [];
  let derivedDynCalls = 0;
  for (const item of archive.script) {
    if (NOT_GAME.test(item.Name)) continue;
    const dynCall = wasmDynCall(archive, item.Address) || emscriptenSignature(item.Signature);
    if (dynCall && dynCall !== emscriptenSignature(item.Signature)) derivedDynCalls += 1;
    methods.push({
      name: item.Name,
      table: item.Address,
      dynCall,
      signature: item.Signature || null,
      hint: GAMEPLAY_HINT.test(item.Name) || undefined,
    });
  }

  // 桥接运行时自己要用的引擎方法必须保留，否则 runtime.mjs 无法工作。
  const REQUIRED = [
    "System.String$$FastAllocateString", "System.Type$$GetType",
    "UnityEngine.Object$$FindObjectsOfType", "UnityEngine.Resources$$FindObjectsOfTypeAll", "UnityEngine.ResourcesAPIInternal$$FindObjectsOfTypeAll",
    "UnityEngine.Object$$op_Implicit",
    "UnityEngine.Component$$get_transform", "UnityEngine.Component$$get_gameObject",
    "UnityEngine.GameObject$$get_activeInHierarchy",
    "UnityEngine.Transform$$get_position_Injected", "UnityEngine.Collider$$get_bounds_Injected", "UnityEngine.Transform$$get_position", "UnityEngine.Collider$$get_bounds",
  ];
  for (const name of REQUIRED) {
    const matches = archive.script.filter(item => item.Name === name);
    const chosen = chooseRequiredMethod(name, matches);
    if (!chosen) continue;
    methods.push({
      name, table: chosen.Address,
      dynCall: wasmDynCall(archive, chosen.Address) || emscriptenSignature(chosen.Signature),
      required: true,
      signature: chosen.Signature || null,
    });
  }

  let types = [];
  try {
    const classes = JSON.parse(await (await import("node:fs/promises"))
      .readFile(path.join(captureRoot, "analysis", "il2cpp", "project-classes.json"), "utf8"));
    // 字段表一律保留，不套 NOT_GAME 过滤。判断「哪些中间件与玩法无关」不该由一条固定正则
    // 拍板：这个游戏的输入就走 Lean Touch，把它当第三方剔掉，就查不到 Fingers 的偏移了。
    // 体积大头在方法表，字段表全留也只多几百 KB。
    types = (classes.items || [])
      .map(item => ({ namespace: item.namespace || "", name: (item.namespace ? item.namespace + "." : "") + item.name, item }))
      .map(entry => ({
        id: entry.item.assembly + ":" + entry.item.typeDefIndex,
        assembly: entry.item.assembly,
        typeDefIndex: entry.item.typeDefIndex,
        name: entry.name,
        hint: GAMEPLAY_HINT.test(entry.name) || undefined,
        fields: (entry.item.fields || []).map(field => {
          const words = field.declaration.split(/\s+/);
          return { name: words.at(-1), type: words.slice(0, -1).join(" "), offset: Number.parseInt(field.offset, 16),...(field.static?{static:true}:{}) };
        }).filter(field => Number.isFinite(field.offset)),
      }));
  } catch (error) {
    onEvent({ type: "bot-kit", status: "partial", reason: `字段表读取失败：${error.message}` });
  }

  const context = {
    meta: {
      engine: "Unity WebGL",
      wasmFile: archive.wasmFile,
      importedFunctions: archive.importedFunctions,
      generatedAt: new Date().toISOString(),
      note: "table 字段是函数表索引，调用方式为 (module.asm?.__indirect_function_table || module.wasmTable).get(table)(this, ...args, 0)。dynCall 为 null 时说明该方法没有可用的函数表项（泛型共享桩或未实现）。",
    },
    types, methods,
    // 反编译输出里的裸地址：静态类型信息与字符串字面量。没有这两张表，
    // 5254220[0] 这种代码没人看得懂它在碰哪个单例。
    statics: [...archive.metadataByAddress].map(([address, name]) => ({ address, name })),
    strings: [...archive.stringByAddress]
      .filter(([, value]) => value && value.length <= 120)
      .map(([address, value]) => ({ address, value })),
  };

  await mkdir(botRoot, { recursive: true });
  await writeFile(path.join(botRoot, "context.json"), JSON.stringify(context, null, 2), "utf8");
  await writeFile(path.join(botRoot, "runtime.mjs"), RUNTIME_SOURCE, "utf8");
  await writeFile(path.join(botRoot, "README.md"), readmeSource(context), "utf8");
  onEvent({ type: "bot-kit", status: "ok", types: types.length, methods: methods.length, derivedDynCalls });
  return { status: "ok", types: types.length, methods: methods.length, derivedDynCalls, directory: botRoot };
}
