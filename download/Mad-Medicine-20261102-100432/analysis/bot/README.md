# Bot 开发套件

本目录由归档解析自动生成，供编写自动运行脚本使用。**每次重新解析都会覆盖。**

- 引擎：Unity WebGL
- WASM 模块：`game_app-262540.games.s3.yandex.net_262540_89io2yadq5r5vcqn2hdfyj5eij4yi9up_Build_WebGL.wasm.unityweb.wasm`
- 游戏自身的类：272 个；方法：5523 个
  （已剔除 Unity 引擎、.NET 基础库和广告/工具/发行商中间件）

## 文件

- `context.json`：方法名 → IL2CPP 函数指针/dynCall 签名、类 → 字段名 → 字节偏移
- `runtime.mjs`：IL2CPP 桥接运行时，封装了托管字符串、类型查找、FindObjectsOfType、
  Transform/Collider 的 out 参数读取等样板

## 接上游戏

Unity 的 Module 必须先拿到手。做法是拦截页面 HTML，在 loader 回调里把它挂到全局：

```js
body = body.replace(".then((unityInstance) => {",
  ".then((unityInstance) => { globalThis.__module = unityInstance.Module;");
```

然后在页面上下文里：

```js
import { attach } from "./runtime.mjs";
const bridge = attach(globalThis.__module, context);

const managers = bridge.findObjects("LevelManager", "Assembly-CSharp").filter(bridge.activeComponent);
const level = bridge.readInt(managers[0] + bridge.field("LevelManager", "level"));
```

## 两个容易踩的坑

1. **实例方法的参数是 `(this, ...实参, methodInfo)`**，`methodInfo` 传 `0`。
   `invoke()` 已经帮你补好末尾的 0，并根据上下文自动选择 `dynCall_*` 或函数表。
2. **不要直接写游戏每帧重算的字段**。先用
   `node src/wasm-function.mjs <归档目录> --method "类名$$方法名" --decompile`
   看清楚那个字段是怎么被赋值的，否则写进去当帧就被覆盖。

## 名称歧义

同名类型使用 `context.types` 中的程序集/TypeDefIndex `id` 查询字段。重载方法使用 `bridge.method({name, signature})` 或 `{name, table}`；`invoke` 同样接受该对象。名称不唯一时明确报错，不再静默覆盖。

## 查看某个方法的真实逻辑

```bash
node src/wasm-function.mjs <归档目录> --method "InputController$$FixedUpdate" --decompile
```
