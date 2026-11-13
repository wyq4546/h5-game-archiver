#!/usr/bin/env node
/* LayaAir 3D 发布产物反编译（标识符混淆 + 十六进制字面量还原）
 *
 *   node scripts/analyze-laya.mjs <游戏归档目录>
 *
 * 产物：<游戏目录>/analysis/decompiled/
 *   bundle.deobfuscated.js   还原后的完整源码（类名/属性/数字/布尔全部可读）
 *   classes/<类名>.js        按类拆分，带原混淆名与基类注释
 *   ui/<界面名>.json         Laya UI 树（uiView 原样导出）
 *   data/                    config.zip 里的关卡/数值表
 *   assets/                  1000.bundle 里的贴图、模型、场景
 *   strings.json             全部字符串字面量（含出现次数）
 *   index.md                 类清单与还原依据
 */
import path from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import zlib from "node:zlib";
import vm from "node:vm";
import { parse } from "@babel/parser";
import _generate from "@babel/generator";
import _traverse from "@babel/traverse";

const generate = _generate.default || _generate;
const traverse = _traverse.default || _traverse;

const target = process.argv[2];
if (!target) {
  console.error("用法: node scripts/analyze-laya.mjs <游戏归档目录>");
  process.exit(1);
}
const root = path.resolve(target);
const outRoot = path.join(root, "analysis", "decompiled");

/* ---------- 定位发布目录 ---------- */
function findGameRoot() {
  const candidates = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      if (existsSync(path.join(p, "js", "bundle.js")) || existsSync(path.join(p, "libs", "laya.core.js"))) candidates.push(p);
      walk(p, depth + 1);
    }
  };
  walk(path.join(root, "game"), 0);
  if (!candidates.length) throw new Error("没找到 Laya 发布目录（js/bundle.js 或 libs/laya.core.js）");
  return candidates.sort((a, b) => b.length - a.length)[0];
}
const gameRoot = findGameRoot();
const bundlePath = path.join(gameRoot, "js", "bundle.js");
console.log("发布目录:", path.relative(root, gameRoot));

/* ---------- 人工确认过的类名（依据：regClass 注册名 / 基类 / 字段名 / 调用特征） ---------- */
const HINTS = {
  _0x76c0ce: ["LayaView", "Laya.View 别名"],
  _0x58fa5f: ["LayaScene", "Laya.Scene 别名"],
  _0x32a0c4: ["regClass", "Laya.ClassUtils.regClass 别名"],
  _0x197dce: ["UI", "ui.* 类命名空间"],

  _0x1951a5: ["Script3DBase", "Script3D 基类，暴露 mySp3d/myTrans"],
  _0x35923b: ["GameEvent", "事件名常量：JSON_PRESS/RES_PRESS/GAME_SUCCESS…"],
  _0xd41dea: ["ConfigMgr", "config.zip 解包 + 关卡 JSON 读取"],
  _0x57d869: ["GameState", "isLoadOver/isBeginGame/isGateGame 等状态位"],
  _0x296d5f: ["NodeUtil", "3D 节点查找/复制/挂载工具（71 方法）"],
  _0x3990b9: ["ResFactory", "后台/粒子/网格资源工厂"],
  _0x45e8ae: ["TouchCtrl", "手势拖拽：DoDown/DoMove/DoUp/GetFuDu"],
  _0x131f03: ["MathUtil", "随机、角度、距离工具"],
  _0x158494: ["ColorConfig", "背景/跑道/门颜色与速度曲线"],
  _0x4cedcd: ["SoundMgr", "音效注册与播放"],
  _0x4e1f32: ["AudioMgr", "BGM 映射与微信音频"],
  _0x4684c2: ["WxAudio", "createInnerAudioContext 单例播放"],
  _0x646a2d: ["EffectFactory", "Mesh_Part_* 粒子特效工厂"],
  _0x2816a2: ["MapBuilder", "按关卡 JSON 铺路/障碍/收集物"],
  _0x15a563: ["LevelMgr", "当前关卡、下一关、关卡配置"],
  _0x56f7fd: ["GameFlow", "开局/下一关/成功/失败流程"],
  _0x89f362: ["HeroMgr", "创建主角、手指限位、暂停"],
  _0x4df33e: ["CameraMgr", "相机初始化、跟随、震屏"],
  _0x44a833: ["ArrowEffect", "res/home/img_eff_arrow.png 箭头拖尾"],
  _0x5ddff3: ["FloatText", "伤害/金币飘字（FontClip）"],
  _0xd8fd74: ["SwitchConfig", "远程开关（Banner/插屏/矩阵广告）"],
  _0x200740: ["UITools", "tips、遮罩等通用 UI"],
  _0xa6819: ["AdWechat", "wx.createBannerAd 系列"],
  _0x23ed07: ["AdSdk", "Yandex/聚合 SDK 广告与分享"],
  _0x474e63: ["ViewMgr", "各界面显示/清理调度"],
  _0x4489c7: ["PlayerData", "金币、关卡、角色、属性存档"],
  _0x188222: ["InitScene", "启动场景，加载 3D/2D 资源"],
  _0x437914: ["BootConfig", "启动配置 startScene"],

  _0x34f8fb: ["CastStateScript", "E_COL_TYPE/STATE_1 状态切换"],
  _0x8ab6f4: ["CompressScript", "第三道工序·压缩：STATE_3→4，+10 金币"],
  _0x892316: ["FormingScript", "第四道工序·成型：STATE_4→5，+10 金币"],
  _0x5a9ddc: ["CoolingScript", "第二道工序·冷却：STATE_2→3，熔岩流体"],
  _0x94c728: ["MoldingScript", "第一道工序·浇铸：STATE_1→2，熔岩流体"],
  _0x5ac089: ["RockyLavaScript", "M_RockyLava 材质 UV 流动"],
  _0x2b5289: ["EndGateDamageScript", "终点伤害门"],
  _0x55fd90: ["EndGateSpeedScript", "终点速度门"],
  _0x1d7e57: ["StageRootScript", "关卡根节点：门/计分/武器组"],
  _0x3f9538: ["RivalScript", "对手（PK）角色与受击动作"],
  _0x598281: ["HeroScript", "主角控制：移动/攻击/合体武器（43 方法）"],
  _0x2801ca: ["CameraFollowScript", "相机跟随与横向移动"],

  _0x5d5f33: ["SpikesScript", "s_obst_spikes：撞掉携带钢坯 -10 金币并后退"],
  _0x53b0aa: ["WallScript", "s_obst_wall：撞掉携带钢坯 -10 金币并后退"],

  _0x46099c: ["BattleView", "战斗界面逻辑"],
  _0x5769ba: ["BgView", "背景滚动"],
  _0x59ba18: ["FailView", "失败界面（看广告复活）"],
  _0x49bcda: ["HomeView", "主页（升级速度/伤害/生命）"],
  _0x1cbd97: ["LoadingView", "加载进度"],
  _0x1f90fa: ["LockView", "解锁角色界面"],
  _0x17338b: ["ShopView", "商店"],
  _0x188b09: ["SuccessView", "通关界面"],
  _0x299ea8: ["TryView", "试用角色界面"],
};

/* ---------- 读取与解析 ---------- */
const code = readFileSync(bundlePath, "utf8");
const ast = parse(code, {
  sourceType: "script",
  allowReturnOutsideFunction: true,
  errorRecovery: true,
  createParenthesizedExpressions: false,
});

/* ---------- 还原规则 1：regClass 注册名 ---------- */
const nameMap = new Map(Object.entries(HINTS).map(([k, v]) => [k, v[0]]));
const notes = new Map(Object.entries(HINTS).map(([k, v]) => [k, v[1]]));
const registered = [];
traverse(ast, {
  CallExpression(p) {
    const callee = p.node.callee;
    if (callee.type !== "Identifier" || nameMap.get(callee.name) !== "regClass") return;
    const [arg0, arg1] = p.node.arguments;
    if (arg0?.type !== "StringLiteral") return;
    const short = arg0.value.split(".").pop();
    if (arg1?.type === "Identifier") {
      nameMap.set(arg1.name, short);
      notes.set(arg1.name, "regClass 注册名 " + arg0.value);
      registered.push([arg1.name, arg0.value]);
    }
  },
});

/* ---------- 还原规则 2：逻辑界面 = 去掉 UI 后缀的基类名 ---------- */
traverse(ast, {
  ClassDeclaration(p) {
    const node = p.node;
    if (!node.id || nameMap.has(node.id.name)) return;
    const sup = node.superClass;
    if (sup?.type !== "MemberExpression") return;
    const baseName = sup.property?.type === "StringLiteral" ? sup.property.value : sup.property?.name;
    if (!baseName || !/UI$/.test(baseName)) return;
    nameMap.set(node.id.name, baseName.replace(/UI$/, ""));
    notes.set(node.id.name, "继承 " + (nameMap.get(sup.object?.name) || "UI") + "." + baseName);
  },
});

/* ---------- 还原规则 3：命名空间对象（资源名 / 枚举 / 广告类型） ---------- */
const nsKeys = new Map();
traverse(ast, {
  AssignmentExpression(p) {
    const left = p.node.left;
    if (left.type !== "MemberExpression" || left.object.type !== "Identifier") return;
    const owner = left.object.name;
    if (!/^_0x/.test(owner) || nameMap.has(owner)) return;
    const prop = left.computed ? left.property.value : left.property.name;
    if (!prop) return;
    if (!nsKeys.has(owner)) nsKeys.set(owner, new Set());
    nsKeys.get(owner).add(prop);
  },
});
function classifyNamespace(keys) {
  if (keys.has("E_COL_TYPE")) return ["ColType", "枚举命名空间（E_COL_TYPE.STATE_0..5）"];
  if (keys.has("Mesh_Scene") || keys.has("Sound_Bgm")) return ["ResConst", "资源路径常量表（h51/*.lh、res/sound/*.mp3）"];
  if (keys.has("RewardedVideo") || keys.has("Interstitial")) return ["AdType", "广告类型枚举（Banner/RewardedVideo/Interstitial/custom）"];
  return null;
}
for (const [owner, keys] of nsKeys) {
  if (nameMap.has(owner)) continue;
  const hit = classifyNamespace(keys);
  if (!hit) continue;
  nameMap.set(owner, hit[0]);
  notes.set(owner, hit[1]);
}
/* 枚举/常量表都是 `!function (P) { P.X = ... }(NS || (NS = {}))` 的写法：
   上面认出来的是 IIFE 形参 P，真正对外暴露的是外层那个 NS，必须同名，
   否则形参改了、全局没改，读起来像两份不同的东西。 */
traverse(ast, {
  CallExpression(p) {
    const callee = p.node.callee;
    if (callee.type !== "FunctionExpression") return;
    const param = callee.params[0];
    if (param?.type !== "Identifier") return;
    const keys = nsKeys.get(param.name);
    if (!keys) return;
    const hit = classifyNamespace(keys);
    if (!hit) return;
    for (const arg of p.node.arguments) {
      if (arg.type !== "LogicalExpression" || arg.left.type !== "Identifier") continue;
      const global = arg.left.name;
      if (nameMap.has(global)) continue;
      nameMap.set(global, hit[0]);
      notes.set(global, hit[1]);
    }
  },
});

/* 资源常量表（ResConst.* = 'h51/xxx.lh'）单独导出，自动化脚本直接查表用 */
const resAssign = [];
traverse(ast, {
  AssignmentExpression(p) {
    const left = p.node.left;
    if (left.type !== "MemberExpression" || left.object.type !== "Identifier") return;
    if (nameMap.get(left.object.name) !== "ResConst") return;
    const prop = left.computed ? left.property.value : left.property.name;
    if (prop) resAssign.push({ key: prop, node: p.node.right });
  },
});

/* ---------- 还原规则 4：别名变量 ---------- */
traverse(ast, {
  VariableDeclarator(p) {
    const { id, init } = p.node;
    if (id.type !== "Identifier" || !init || nameMap.has(id.name)) return;
    let text = null;
    if (init.type === "MemberExpression") {
      const obj = init.object.type === "Identifier" ? init.object.name : null;
      const prop = init.computed ? init.property.value : init.property.name;
      if (obj === "Laya" && prop) text = "Laya." + prop;
    } else if (init.type === "Identifier") {
      text = nameMap.get(init.name) || null;
    }
    if (!text) return;
    const alias = text.replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^laya/, "Laya");
    nameMap.set(id.name, alias);
    notes.set(id.name, "别名 " + text);
  },
});

/* 兜底：仍未命名的类，按基类编号 */
const unnamed = [];
traverse(ast, {
  ClassDeclaration(p) {
    const id = p.node.id?.name;
    if (!id || nameMap.has(id)) return;
    const base = p.node.superClass;
    const baseName = base?.type === "Identifier" ? nameMap.get(base.name) : null;
    const n = unnamed.length + 1;
    const name = (baseName ? baseName.replace(/Script$/, "") : "Anon") + "Cls" + n;
    nameMap.set(id, name);
    notes.set(id, "未确定，按 " + (baseName || "无基类") + " 编号");
    unnamed.push(id);
  },
});

/* ---------- 预采集：必须在重命名之前记下原混淆名 ---------- */
const classRecords = [];
traverse(ast, {
  ClassDeclaration(p) {
    const origId = p.node.id?.name;
    if (!origId) return;
    classRecords.push({
      origId,
      node: p.node,
      sup: p.node.superClass ? code.slice(p.node.superClass.start, p.node.superClass.end) : "（无基类）",
    });
  },
});
const staticAssign = new Map();
const uiTrees = [];
traverse(ast, {
  AssignmentExpression(p) {
    const left = p.node.left;
    if (left.type !== "MemberExpression" || left.object.type !== "Identifier") return;
    const owner = left.object.name;
    if (!nameMap.has(owner)) return;
    const prop = left.computed ? left.property.value : left.property.name;
    if (!staticAssign.has(owner)) staticAssign.set(owner, []);
    staticAssign.get(owner).push({ prop, node: p.node.right });
    if ((prop === "uiView" || prop === "uiJSON") && p.node.right.type === "ObjectExpression") {
      uiTrees.push({ owner, prop, node: p.node.right });
    }
  },
});

/* ---------- 应用重命名 ---------- */
function isRenameable(path) {
  const parent = path.parentPath;
  if (!parent) return true;
  if (parent.isMemberExpression({ property: true }) && !parent.node.computed) return false;
  if (parent.isObjectProperty({ key: true }) && !parent.node.computed) return false;
  if (parent.isClassMethod({ key: true }) && !parent.node.computed) return false;
  if (parent.isLabeledStatement()) return false;
  return path.isReferencedIdentifier() || path.isBindingIdentifier();
}
/* 先把要改的节点收集起来再统一改：边遍历边改会让 Babel 的作用域缓存失效，
   同一名字只改中一部分，剩下的仍留着 _0x 前缀（等于把代码改坏）。 */
const renameTargets = [];
traverse(ast, {
  Identifier(p) {
    const now = nameMap.get(p.node.name);
    if (!now) return;
    if (!isRenameable(p)) return;
    renameTargets.push([p, now]);
  },
});
for (const [p, now] of renameTargets) p.node.name = now;

/* ---------- 语法糖还原 ---------- */
const RESERVED = new Set(["class", "default", "delete", "new", "return", "typeof", "in", "instanceof", "void", "throw", "case", "do", "else", "var", "let", "const", "with", "if", "for", "while", "switch", "try", "catch", "finally", "function", "this", "super", "null", "true", "false", "extends", "static", "yield", "await", "import", "export"]);
const OK_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const stringCount = new Map();
traverse(ast, {
  /* 方法名本来就是字符串键：['onInit']() → onInit() */
  ClassMethod(p) {
    const key = p.node.key;
    if (!p.node.computed || key.type !== "StringLiteral") return;
    if (!OK_IDENT.test(key.value) || RESERVED.has(key.value)) return;
    p.node.key = { type: "Identifier", name: key.value };
    p.node.computed = false;
  },
  /* 语句级的逗号表达式拆成多条语句：a(), b(), c = 1 → 三行 */
  ExpressionStatement(p) {
    const expr = p.node.expression;
    if (expr.type !== "SequenceExpression") return;
    /* 单语句体（if (x) a(), b();）不能拆，否则语法结构被破坏 */
    const parentType = p.parentPath?.node?.type;
    if (parentType && !["Program", "BlockStatement", "ExpressionStatement"].includes(parentType)) return;
    if (p.parentPath?.node?.type === "ExpressionStatement") return;
    const statements = expr.expressions.map((e) => ({
      type: "ExpressionStatement",
      expression: e,
      start: e.start,
      end: e.end,
    }));
    p.replaceWithMultiple(statements);
  },
  MemberExpression(p) {
    const n = p.node;
    if (!n.computed) return;
    if (n.property.type !== "StringLiteral") return;
    const key = n.property.value;
    if (!OK_IDENT.test(key) || RESERVED.has(key)) return;
    n.property = { type: "Identifier", name: key };
    n.computed = false;
  },
  NumericLiteral(p) {
    /* 十六进制还原成十进制：0x1f4 → 500（只改写法，不改值） */
    if (/^0x/i.test(code.slice(p.node.start, p.node.end))) {
      p.node.extra = { rawValue: String(p.node.value), raw: String(p.node.value) };
    }
  },
  UnaryExpression(p) {
    const { operator, argument } = p.node;
    if (operator === "!" && argument.type === "NumericLiteral" && argument.value === 1) {
      p.replaceWith({ type: "BooleanLiteral", value: false });
      return;
    }
    if (operator === "!" && argument.type === "NumericLiteral" && argument.value === 0) {
      p.replaceWith({ type: "BooleanLiteral", value: true });
      return;
    }
    if (operator === "!" && argument.type === "ArrayExpression" && argument.elements.length === 0) {
      p.replaceWith({ type: "BooleanLiteral", value: false });
    }
  },
  StringLiteral(p) {
    if (p.node.value.length >= 3) stringCount.set(p.node.value, (stringCount.get(p.node.value) || 0) + 1);
  },
});

/* ---------- 生成完整源码 ---------- */
mkdirSync(outRoot, { recursive: true });
mkdirSync(path.join(outRoot, "classes"), { recursive: true });
mkdirSync(path.join(outRoot, "ui"), { recursive: true });
mkdirSync(path.join(outRoot, "data"), { recursive: true });
mkdirSync(path.join(outRoot, "assets"), { recursive: true });

const header = [
  "/*",
  " * Swords Maker —— LayaAir 3D 发布产物还原",
  " * 原始文件: <发布目录>/js/bundle.js（406 KB，单文件 IIFE，标识符与数字全部被混淆）",
  " * 还原内容:",
  " *   1. ui.* 类名取自 Laya.ClassUtils.regClass 的注册字符串（原始信息，非推测）",
  " *   2. 界面逻辑类名 = 其基类去掉 UI 后缀（BattleView extends ui.BattleViewUI）",
  " *   3. 管理器类名按方法/字段特征推定，见 index.md 的「依据」列",
  " *   4. obj['prop'] → obj.prop，0x1f4 → 500，!0x1 → false（只改写形式，不改语义）",
  " * 注意: 局部变量仍是 _0x 形式；方法名与字段名本来就没被混淆，已原样保留。",
  " */",
  "",
].join("\n");
const full = generate(ast, { comments: true, compact: false, jsescOption: { minimal: true } }, code).code;
writeFileSync(path.join(outRoot, "bundle.deobfuscated.js"), header + full);

/* ---------- 按类拆分 ---------- */
const indexRows = [];
for (const { origId, node, sup } of classRecords) {
  const name = nameMap.get(origId) || origId;
  const methods = node.body.body.filter((m) => m.type === "ClassMethod" && m.kind !== "constructor");
  const extras = staticAssign.get(origId) || [];
  const prettySup = sup
    .replace(/_0x[0-9a-f]+/g, (m) => nameMap.get(m) || m)
    .replace(/\['([A-Za-z_$][\w$]*)'\]/g, ".$1");
  const parts = [];
  parts.push(`/* ${name}  ←  原混淆名 ${origId}`);
  parts.push(` * 基类: ${prettySup}`);
  parts.push(` * 成员: ${methods.length} 个方法  ${extras.length ? "| 静态: " + extras.map((e) => e.prop).join(", ") : ""}`);
  parts.push(` * 依据: ${notes.get(origId) || "无"} */`);
  parts.push("");
  parts.push(generate(node, { comments: true, compact: false }).code);
  for (const e of extras) {
    if (e.node.type === "FunctionExpression" || e.node.type === "ArrowFunctionExpression") continue;
    parts.push("");
    parts.push(`/* 静态成员 ${name}.${e.prop} */`);
    parts.push(`${name}.${e.prop} = ${generate(e.node, { compact: false }).code};`);
  }
  writeFileSync(path.join(outRoot, "classes", name + ".js"), parts.join("\n") + "\n");
  indexRows.push({
    name,
    original: origId,
    base: prettySup,
    methods: methods.length,
    statics: extras.map((e) => e.prop),
    basis: notes.get(origId) || "",
  });
}

/* ---------- UI 树导出 ---------- */
function literalToValue(n) {
  switch (n.type) {
    case "ObjectExpression": {
      const o = {};
      for (const prop of n.properties) {
        if (prop.type !== "ObjectProperty") continue;
        const key = prop.computed ? literalToValue(prop.key) : prop.key.name ?? prop.key.value;
        o[key] = literalToValue(prop.value);
      }
      return o;
    }
    case "ArrayExpression":
      return n.elements.map((e) => (e ? literalToValue(e) : null));
    case "StringLiteral":
      return n.value;
    case "NumericLiteral":
      return n.value;
    case "BooleanLiteral":
      return n.value;
    case "NullLiteral":
      return null;
    case "UnaryExpression":
      return n.operator === "-" ? -literalToValue(n.argument) : literalToValue(n.argument);
    default:
      return undefined;
  }
}
let uiCount = 0;
for (const { owner, node } of uiTrees) {
  const value = literalToValue(node);
  if (!value) continue;
  const name = nameMap.get(owner) || owner;
  writeFileSync(path.join(outRoot, "ui", name + ".json"), JSON.stringify(value, null, 2));
  uiCount += 1;
}

/* ---------- 资源常量表 ---------- */
const constNodes = new Map();
traverse(ast, {
  VariableDeclarator(p) {
    const { id, init } = p.node;
    if (id.type === "Identifier" && init) constNodes.set(id.name, init);
  },
});
const constStrings = new Map();
const resTable = {};
function evalConst(n) {
  if (!n) return undefined;
  if (n.type === "StringLiteral") return n.value;
  if (n.type === "NumericLiteral") return n.value;
  if (n.type === "Identifier") return constStrings.get(n.name);
  /* ResConst.UI_SOUND 这类已解出的表项 */
  if (n.type === "MemberExpression" && n.object.type === "Identifier") {
    const owner = n.object.name;
    const prop = n.computed ? n.property.value : n.property.name;
    if (owner === "ResConst") return resTable[prop];
  }
  /* 发布包按浏览器分支走：wx ? '微信路径' : '网页路径' */
  if (n.type === "ConditionalExpression") {
    const alt = evalConst(n.alternate);
    return alt !== undefined ? alt : evalConst(n.consequent);
  }
  if (n.type === "BinaryExpression" && n.operator === "+") {
    const a = evalConst(n.left);
    const b = evalConst(n.right);
    if (a !== undefined && b !== undefined) return a + b;
  }
  return undefined;
}
/* 常量之间会互相引用，多跑几轮把链式拼接解开 */
for (let pass = 0; pass < 3; pass += 1) {
  for (const [name, node] of constNodes) {
    if (constStrings.has(name)) continue;
    const value = evalConst(node);
    if (value !== undefined) constStrings.set(name, value);
  }
}
for (const { key, node } of resAssign) {
  const value = evalConst(node);
  resTable[key] = value === undefined ? generate(node, { compact: true }).code : value;
}
/* 第二遍：把 ResConst.X + 'y' 这种也解开 */
for (const { key, node } of resAssign) {
  const value = evalConst(node);
  if (value !== undefined) resTable[key] = value;
}
if (Object.keys(resTable).length) {
  writeFileSync(path.join(outRoot, "data", "res-constants.json"), JSON.stringify(resTable, null, 2));
}

/* ---------- 字符串表 ---------- */
const strings = [...stringCount.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
writeFileSync(path.join(outRoot, "strings.json"), JSON.stringify(strings, null, 2));

/* ---------- config.zip 解包 ---------- */
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("不是 zip");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString("utf8");
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + csize);
    out.push({ name, data: method === 8 ? zlib.inflateRawSync(raw) : raw });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
let dataFiles = 0;
const cfgZip = path.join(gameRoot, "config", "config.zip");
if (existsSync(cfgZip)) {
  for (const entry of readZip(readFileSync(cfgZip))) {
    const safe = entry.name.replace(/\.\./g, "_");
    const dest = path.join(outRoot, "data", safe);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, entry.data);
    dataFiles += 1;
  }
}

/* ---------- 1000.bundle 解包 ---------- */
let assetFiles = 0;
const bundleBin = path.join(gameRoot, "1000.bundle");
if (existsSync(bundleBin)) {
  const buf = readFileSync(bundleBin);
  let pos = 0;
  const u16 = () => { const v = buf.readUInt16LE(pos); pos += 2; return v; };
  const u32 = () => { const v = buf.readUInt32LE(pos); pos += 4; return v; };
  const bundleId = u16();
  const verLen = u16();
  const version = buf.subarray(pos, pos + verLen).toString();
  pos += verLen;
  const count = u32();
  const readStr = () => {
    const len = u16();
    const s = buf.subarray(pos, pos + len).toString();
    pos += len;
    return s;
  };
  /* 头部之后先有一个 bundle 名（本作固定 YYGGames），再是条目表 */
  const bundleName = readStr();
  for (let i = 0; i < count; i += 1) {
    const rel = readStr();
    const size = u32();
    const data = buf.subarray(pos, pos + size);
    pos += size;
    const safe = rel.replace(/\.\./g, "_").replace(/^\/+/, "");
    const dest = path.join(outRoot, "assets", safe);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    assetFiles += 1;
  }
  console.log(`1000.bundle: 版本 ${version}，${count} 个条目，bundleId ${bundleId}`);
}

/* ---------- 多语言表（index.js 里的 window.langManager） ---------- */
let langs = null;
const indexPath = path.join(gameRoot, "index.js");
if (existsSync(indexPath)) {
  try {
    const sandbox = { window: {}, loadLib: () => {}, document: {}, console };
    vm.runInNewContext(readFileSync(indexPath, "utf8"), sandbox, { timeout: 3000 });
    langs = sandbox.window.langManager || null;
    if (langs) writeFileSync(path.join(outRoot, "lang.json"), JSON.stringify(langs, null, 2));
  } catch (error) {
    console.log("langManager 提取失败:", error.message);
  }
}

/* ---------- 索引 ---------- */
const langNames = langs ? Object.keys(langs.langs || {}) : [];
const md = [
  "# Swords Maker 反编译索引",
  "",
  `- 发布目录: \`${path.relative(root, gameRoot)}\``,
  `- 原始脚本: \`js/bundle.js\` ${(code.length / 1024).toFixed(0)} KB，单文件 IIFE`,
  `- 还原后类: ${indexRows.length} 个（UI 树 ${uiCount} 份，配置文件 ${dataFiles} 个，资源 ${assetFiles} 个）`,
  `- 多语言: ${langNames.join(" / ") || "未提取"}`,
  "",
  "## 类清单",
  "",
  "| 类名 | 原混淆名 | 基类 | 方法 | 依据 |",
  "|---|---|---|---|---|",
  ...indexRows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => `| \`${r.name}\` | \`${r.original}\` | \`${r.base}\` | ${r.methods} | ${r.basis} |`),
  "",
  "## 重新生成",
  "",
  "```bash",
  `node scripts/analyze-laya.mjs ${path.basename(root)}`,
  "```",
  "",
  "只依赖 `@babel/parser` / `@babel/generator` / `@babel/traverse`，不执行游戏脚本。",
  "",
  "## 文件",
  "",
  "- `bundle.deobfuscated.js` 完整还原源码",
  "- `classes/` 按类拆分，带原混淆名与基类 | `ui/` Laya UI 树 | `data/` 关卡与数值表",
  "- `assets/` 贴图、模型、场景 | `strings.json` 字符串表 | `lang.json` 多语言",
  "",
];
writeFileSync(path.join(outRoot, "index.md"), md.join("\n"));

console.log(`类 ${indexRows.length} 个，UI ${uiCount} 份，配置 ${dataFiles} 个，资源 ${assetFiles} 个`);
console.log("产物:", path.relative(root, outRoot));
