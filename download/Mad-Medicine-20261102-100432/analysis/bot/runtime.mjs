// IL2CPP 桥接运行时（由归档解析自动生成，请勿手改）。
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
