// PlayCanvas 发布产物的源码还原。
//
// PlayCanvas 的发布目录里，业务逻辑被打包进 `__game-scripts.js`（按 `// 文件名.js` 分块拼接，
// 通常是未混淆的 ES5/ES6 源码），关卡与场景在 `<assetId>.json`（compressedFormat 压缩）里，
// 场景资产注册表在 `config.json`。本模块把这些东西还原成可读、可检索的结构：
//
//   analysis/playcanvas/game-scripts/   按原始文件切分后的脚本源码
//   analysis/playcanvas/scripts.json    createScript 注册表（脚本 id → 类、属性、方法、生命周期）
//   analysis/playcanvas/scenes.json     场景索引（实体数、根节点、脚本使用直方图、模板实例数）
//   analysis/playcanvas/scenes/*.tree.json  每个场景还原后的实体树（名字/标签/脚本组件）
//
// 压缩场景的字段名解码规则直接取自引擎 playcanvas-stable.min.js：
//   单字符键：index = charCode - fieldFirstCode
//   双字符键：index = ((c0 - fieldFirstCode) * fieldCodeBase) + (c1 - fieldFirstCode)
// 实体变换（position/rotation/scale）在压缩场景里指向场景级 singleVecs / tripleVecs 向量表，
// 本工具只还原结构与名字；若表缺失则说明变换随模板资产（template）下发，需另解模板。
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function walk(current, output = []) {
  for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) await walk(full, output);
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

/** 在 game/ 下找到带 config.json + __game-scripts.js 的 PlayCanvas 发布根目录。 */
export async function findPlayCanvasRoot(captureRoot) {
  const files = await walk(path.join(captureRoot, "game"));
  const configs = files.filter(file => path.basename(file) === "config.json" && /assets|scenes/i.test(file) === false);
  for (const configFile of configs) {
    const root = path.dirname(configFile);
    let config;
    try { config = JSON.parse(await readFile(configFile, "utf8")); } catch { continue; }
    if (!config?.assets || !config?.scenes) continue;
    const scriptsFile = path.join(root, "__game-scripts.js");
    if (!(await exists(scriptsFile))) continue;
    return { root, configFile, config, scriptsFile };
  }
  return null;
}

/** 按 `// xxx.js` 分块把打包脚本切回独立文件。 */
export function splitGameScripts(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = null;
  lines.forEach((line, index) => {
    const marker = line.match(/^\/\/\s*([\w./@()\- ]+\.js)\s*$/);
    if (marker) {
      if (current) blocks.push(current);
      current = { file: marker[1].trim(), startLine: index + 2, lines: [] };
      return;
    }
    if (current) current.lines.push(line);
  });
  if (current) blocks.push(current);
  return blocks.map(block => ({
    file: block.file,
    startLine: block.startLine,
    source: block.lines.join("\n"),
    bytes: Buffer.byteLength(block.lines.join("\n"), "utf8")
  }));
}

const LIFECYCLE = ["initialize", "postInitialize", "update", "postUpdate", "onEnable", "onDisable", "onDestroy", "swap", "on" + "AttributesChanged"];

// TS 项目常把 pc.ScriptType 包一层自己的装饰器，编译后长这样：
//   s=function(t){…e.prototype.update=function(t){…}…}(a.ScriptTypeBase);e.PlayerScript=s
//   s=o([(0,a.createScript)("PlayerScript")],s)}(a.ScriptTypeBase);e.PlayerScript=s;
// 子类还会继承中间基类（如 CupWithPencilsAnimation 继承 FallingObjectAnimation）：
//   e=o([(0,a.createScript)("CupWithPencilsAnimation")],e)}(n(7476).FallingObjectAnimation);
// 这类注册既没有 pc.createScript('x') 也没有 class X extends pc.ScriptType，
// 只按行扫会整块漏掉（Pencil Rush 的 18 个脚本就是这么丢的）。
// 基类只要求形如 `x.Base` 或 `n(123).Base`，不锁死 ScriptTypeBase。
const DECORATOR_CREATE = /\(\s*0\s*,\s*[\w$]+\.createScript\s*\)\s*\(\s*['"]([\w.-]+)['"]\s*\)\s*\]\s*,\s*([\w$]+)\s*\)\s*\}\s*\(\s*[\w$]+(?:\(\s*\d+\s*\))?\.\w+\s*\)\s*;\s*[\w$]+\.([\w$]+)\s*=/g;

/** 从 index 处的 `{` 开始截出配平的整个对象字面量。 */
function objectLiteralAt(text, index) {
  let depth = 0;
  let quote = null;
  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (quote) {
      if (char === "\\") cursor += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(index, cursor + 1);
    }
  }
  return null;
}

/** 对象字面量的一级键 → 该键之后的片段，用于读 type/default/title。 */
function literalEntries(literal) {
  const positions = [];
  let depth = 1;
  let quote = null;
  for (let cursor = 1; cursor < literal.length; cursor += 1) {
    const char = literal[cursor];
    if (quote) {
      if (char === "\\") cursor += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{" || char === "[" || char === "(") { depth += 1; continue; }
    if (char === "}" || char === "]" || char === ")") { depth -= 1; continue; }
    if (depth !== 1) continue;
    if (cursor > 1 && !/[,\s{]/.test(literal[cursor - 1])) continue;
    const match = /^([\w$]+)\s*:\s*/.exec(literal.slice(cursor, cursor + 96));
    if (match) positions.push({ name: match[1], at: cursor + match[0].length });
  }
  return positions.map((entry, index) => ({
    name: entry.name,
    body: literal.slice(entry.at, index + 1 < positions.length ? positions[index + 1].at : literal.length)
  }));
}

/** 装饰器注册的脚本：补上类名、属性、方法，避免只认 pc.createScript 直调。 */
function decoratorScripts(source, block) {
  const scripts = [];
  DECORATOR_CREATE.lastIndex = 0;
  let match;
  while ((match = DECORATOR_CREATE.exec(source))) {
    const [, name, classVar, className] = match;
    const id = name.charAt(0).toLowerCase() + name.slice(1);
    const classStart = source.lastIndexOf("=function", match.index);
    const region = source.slice(Math.max(0, classStart), match.index);
    const script = { id, className, file: block.file, line: block.startLine + (source.slice(0, match.index).match(/\n/g)?.length || 0), attributes: [], methods: [], properties: [], lifecycle: {} };

    const methodPattern = new RegExp("(\\w+)\\.prototype\\.([\\w$]+)\\s*=\\s*function\\s*\\(([^)]*)\\)", "g");
    let method;
    while ((method = methodPattern.exec(region))) {
      if (method[1] !== classVar) continue;
      const params = method[3].split(",").map(item => item.trim()).filter(Boolean);
      script.methods.push({ name: method[2], line: script.line, params });
      if (LIFECYCLE.includes(method[2])) script.lifecycle[method[2]] = true;
    }

    const attributesAt = region.indexOf(`${classVar}._attributes=`);
    if (attributesAt >= 0) {
      const brace = region.indexOf("{", attributesAt);
      const literal = brace >= 0 ? objectLiteralAt(region, brace) : null;
      for (const entry of literal ? literalEntries(literal) : []) {
        const type = entry.body.match(/AttributeType\.(\w+)/)?.[1]?.toLowerCase() || null;
        const title = entry.body.match(/title\s*:\s*['"]([^'"]+)['"]/)?.[1] || null;
        const fallback = entry.body.match(/default\s*:\s*([^,}]+)/)?.[1]?.trim() || null;
        script.attributes.push({ name: entry.name, type, title, default: fallback || undefined, line: script.line });
      }
    }
    scripts.push(script);
  }
  return scripts;
}
/** 从单个脚本文本里抽取 createScript 注册信息、属性与方法。 */
export function parseScriptBlock(block) {
  const scripts = [];
  const lines = block.source.split("\n");
  const lineOf = index => block.startLine + index;
  let current = null;
  lines.forEach((line, index) => {
    const creation = line.match(/(?:var|let|const)\s+(\w+)\s*=\s*pc\.createScript\(\s*['"]([\w.-]+)['"]/);
    if (creation) {
      current = { id: creation[2], className: creation[1], file: block.file, line: lineOf(index), attributes: [], methods: [], properties: [], lifecycle: {} };
      scripts.push(current);
      return;
    }
    const classStyle = line.match(/^class\s+(\w+)\s+extends\s+pc\.ScriptType/);
    if (classStyle) {
      current = { id: classStyle[1], className: classStyle[1], file: block.file, line: lineOf(index), attributes: [], methods: [], properties: [], lifecycle: {} };
      scripts.push(current);
      return;
    }
    if (!current) return;
    const attribute = line.match(/(\w+)\.attributes\.add\(\s*['"]([\w$]+)['"]([\s\S]*)$/);
    if (attribute && attribute[1] === current.className) {
      const tail = attribute[3];
      const type = tail.match(/type\s*:\s*['"]([\w]+)['"]/)?.[1] || null;
      const title = tail.match(/title\s*:\s*['"]([^'"]+)['"]/)?.[1] || null;
      const isArray = /array\s*:\s*true/.test(tail);
      const fallback = tail.match(/default\s*:\s*([^,}]+)/)?.[1]?.trim() || null;
      current.attributes.push({ name: attribute[2], type, title, array: isArray || undefined, default: fallback || undefined, line: lineOf(index) });
      return;
    }
    const method = line.match(/(\w+)\.prototype\.([\w$]+)\s*=\s*function\s*\(([^)]*)\)/);
    if (method && method[1] === current.className) {
      const params = method[3].split(",").map(item => item.trim()).filter(Boolean);
      current.methods.push({ name: method[2], line: lineOf(index), params });
      if (LIFECYCLE.includes(method[2])) current.lifecycle[method[2]] = true;
      return;
    }
    const prop = line.match(/(\w+)\.prototype\.([\w$]+)\s*=/);
    if (prop && prop[1] === current.className && !method) {
      current.properties.push({ name: prop[2], line: lineOf(index) });
      return;
    }
    const namedMethod = line.match(/^\s{0,4}([\w$]+)\s*\(([^)]*)\)\s*\{/);
    if (namedMethod && !/^(if|for|while|switch|catch|function)$/.test(namedMethod[1])) {
      const params = namedMethod[2].split(",").map(item => item.trim()).filter(Boolean);
      current.methods.push({ name: namedMethod[1], line: lineOf(index), params });
      if (LIFECYCLE.includes(namedMethod[1])) current.lifecycle[namedMethod[1]] = true;
    }
  });
  // 装饰器式注册（自定义 @createScript）另走一遍，按 id 去重后并入，顺序保持稳定
  const known = new Set(scripts.map(script => script.id));
  for (const script of decoratorScripts(block.source, block)) {
    if (known.has(script.id)) continue;
    known.add(script.id);
    scripts.push(script);
  }
  return scripts;
}

/** 引擎的解压规则：把压缩场景的字段名还原。 */
function fieldDecoder(format) {
  if (!format?.fieldArray) return key => key;
  return key => {
    if (key.length === 1) return format.fieldArray[key.charCodeAt(0) - format.fieldFirstCode] ?? key;
    if (key.length === 2) {
      let index = 0;
      for (const char of key) index = index * format.fieldCodeBase + (char.charCodeAt(0) - format.fieldFirstCode);
      return format.fieldArray[index] ?? key;
    }
    return key;
  };
}

function decodeDeep(value, decode) {
  if (Array.isArray(value)) return value.map(item => decodeDeep(item, decode));
  if (value && typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value)) output[decode(key)] = decodeDeep(value[key], decode);
    return output;
  }
  return value;
}

function scriptIdsOf(entity) {
  const scripts = entity?.components?.script?.scripts;
  return scripts && typeof scripts === "object" ? Object.keys(scripts) : [];
}

/** 还原一个场景 JSON：实体清单、根节点、脚本直方图、实体树。 */
export function summarizeScene(scene) {
  const decode = fieldDecoder(scene?.compressedFormat);
  const raw = scene?.entities || {};
  const entities = [];
  for (const id of Object.keys(raw)) {
    const entity = decodeDeep(raw[id], decode);
    entities.push({
      id,
      name: entity.name ?? null,
      parent: entity.parent ?? null,
      children: Array.isArray(entity.children) ? entity.children : [],
      enabled: entity.enabled !== false,
      tags: Array.isArray(entity.tags) ? entity.tags : [],
      template: entity.template_id || null,
      layers: entity.layers || null,
      scripts: scriptIdsOf(entity)
    });
  }
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const counts = new Map();
  for (const entity of entities) for (const id of entity.scripts) counts.set(id, (counts.get(id) || 0) + 1);

  const build = id => {
    const entity = byId.get(id);
    if (!entity) return null;
    const node = { name: entity.name, ...(entity.scripts.length ? { scripts: entity.scripts } : {}), ...(entity.tags.length ? { tags: entity.tags } : {}) };
    const children = (entity.children || []).map(build).filter(Boolean);
    if (children.length) node.children = children;
    return node;
  };
  const roots = entities.filter(entity => !entity.parent || !byId.has(entity.parent)).map(entity => build(entity.id)).filter(Boolean);

  return {
    counts: {
      entities: entities.length,
      roots: roots.length,
      withScripts: entities.filter(entity => entity.scripts.length).length,
      templateInstances: entities.filter(entity => entity.template).length
    },
    scripts: [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
    roots
  };
}

/** 主入口：产出 analysis/playcanvas/。 */
export async function writePlayCanvasAnalysis(captureRoot, onEvent = () => {}) {
  const found = await findPlayCanvasRoot(captureRoot);
  if (!found) return { status: "skipped", reason: "没有找到 PlayCanvas 发布根目录（config.json + __game-scripts.js）" };
  const { root, config, scriptsFile } = found;
  const outputRoot = path.join(captureRoot, "analysis", "playcanvas");
  await mkdir(path.join(outputRoot, "game-scripts"), { recursive: true });
  await mkdir(path.join(outputRoot, "scenes"), { recursive: true });

  // 1) 切分脚本包并建立注册表
  const bundle = await readFile(scriptsFile, "utf8");
  const blocks = splitGameScripts(bundle);
  const registry = [];
  const written = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const safe = block.file.replace(/[\\/:*?"<>|]/g, "_");
    const target = path.join(outputRoot, "game-scripts", `${String(index).padStart(2, "0")}-${safe}`);
    await writeFile(target, `// 源：__game-scripts.js 第 ${block.startLine} 行起（${safe}）\n${block.source}`, "utf8");
    written.push(path.relative(outputRoot, target).replaceAll("\\", "/"));
    for (const script of parseScriptBlock(block)) registry.push(script);
  }
  await writeFile(path.join(outputRoot, "scripts.json"), JSON.stringify({
    bundle: { file: path.relative(captureRoot, scriptsFile).replaceAll("\\", "/"), bytes: Buffer.byteLength(bundle, "utf8"), sha256: createHash("sha256").update(bundle).digest("hex"), blocks: blocks.length },
    scripts: registry.sort((a, b) => a.id.localeCompare(b.id)),
    helperFiles: blocks.filter(block => !registry.some(script => script.file === block.file)).map(block => block.file)
  }, null, 2), "utf8");

  // 2) 场景还原
  const scenes = [];
  const sceneRoot = root;
  for (const sceneRef of config.scenes || []) {
    const candidates = [path.join(sceneRoot, sceneRef.url), path.join(sceneRoot, "scenes", sceneRef.url)];
    let sceneFile = null;
    for (const candidate of candidates) if (await exists(candidate)) { sceneFile = candidate; break; }
    if (!sceneFile) { scenes.push({ name: sceneRef.name, url: sceneRef.url, status: "missing" }); continue; }
    let scene;
    try { scene = JSON.parse(await readFile(sceneFile, "utf8")); } catch (error) {
      scenes.push({ name: sceneRef.name, url: sceneRef.url, status: "invalid", reason: error.message });
      continue;
    }
    const summary = summarizeScene(scene);
    const slug = sceneRef.name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "-");
    await writeFile(path.join(outputRoot, "scenes", `${slug}.tree.json`), JSON.stringify({ name: sceneRef.name, ...summary }, null, 2), "utf8");
    scenes.push({
      name: sceneRef.name,
      url: sceneRef.url,
      settings: scene.settings || null,
      ...summary.counts,
      scripts: summary.scripts,
      tree: `scenes/${slug}.tree.json`
    });
  }
  await writeFile(path.join(outputRoot, "scenes.json"), JSON.stringify({ count: scenes.length, scenes }, null, 2), "utf8");

  const scriptIds = new Set(registry.map(item => item.id));
  const usedInScenes = new Set(scenes.flatMap(scene => (scene.scripts || []).map(item => item.id)));
  const summary = {
    status: "ok",
    engine: "PlayCanvas",
    gameRoot: path.relative(captureRoot, root).replaceAll("\\", "/"),
    bundle: {
      bytes: Buffer.byteLength(bundle, "utf8"),
      sha256: createHash("sha256").update(bundle).digest("hex"),
      blocks: blocks.length
    },
    counts: {
      scriptBlocks: blocks.length,
      scripts: registry.length,
      helperFiles: blocks.filter(block => !registry.some(script => script.file === block.file)).length,
      scenes: scenes.filter(scene => scene.status !== "missing").length,
      scenesMissing: scenes.filter(scene => scene.status === "missing").length,
      entities: scenes.reduce((sum, scene) => sum + (scene.entities || 0), 0),
      unusedScripts: [...scriptIds].filter(id => !usedInScenes.has(id)).length
    },
    assets: {
      total: Object.keys(config.assets || {}).length,
      byType: Object.values(config.assets || {}).reduce((accumulator, asset) => {
        accumulator[asset.type] = (accumulator[asset.type] || 0) + 1;
        return accumulator;
      }, {})
    },
    outputs: {
      gameScripts: "game-scripts/",
      scripts: "scripts.json",
      scenes: "scenes.json",
      trees: "scenes/"
    },
    limitations: "PlayCanvas 业务脚本本身是未混淆源码，按其原始文件边界完整切分；场景 JSON 使用引擎的 compressedFormat 压缩，本工具只还原字段名、实体层级、标签与脚本组件，实体变换（position/rotation/scale）指向场景级向量表或模板资产，需另行解析模板才能拿到坐标。"
  };
  await writeFile(path.join(outputRoot, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  onEvent({ type: "playcanvas", ...summary.counts, output: outputRoot });
  return summary;
}
