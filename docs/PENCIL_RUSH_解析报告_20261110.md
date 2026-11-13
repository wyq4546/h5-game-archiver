# Pencil Rush 归档核验与逆向解析报告

> 对象：`download/Pencil-Rush-20261104-100819`
> 引擎：**PlayCanvas 1.60.0**（业务脚本未混淆，仅压缩）
> 结论：资源完整（无缺失、未补抓），16 关全部可静态还原，离线可实际游玩；核心玩法与数值已从源码定位到行级。
> 全局工程基线见 `docs/H5_GAME_AUTOMATION_AND_RECORDING_GUIDE.md`，单游戏速查见归档根目录 `GAME_GUIDE.md`。

---

## 一、结论摘要

| 项目 | 结果 |
| --- | --- |
| 归档完整性 | `core-complete`，904 条已保存资源，失败 0 |
| 磁盘一致性 | 881 条通过大小+sha256 校验，0 不符；9 条“缺失”全部是广告像素（HTTP 302，无响应体） |
| 游戏资产覆盖 | `config.json` 引用 590 个本地文件，**590/590 在盘**（0 缺失） |
| 场景引用 | 22 个场景、1,894 个模板实例，**0 悬空模板** |
| 离线试玩 | 加载 195 类本地资源，**0 个 4xx/5xx、0 个页面异常、0 个外部请求**，画面可操作 |
| 需补抓项 | **无**（`unresolvedCandidates` 里的 102 条均为源站 404 的按钮/占位图，不是游戏资产） |
| 关卡规模 | 有限 **16 关**（level-1 ~ level-16），另有 5 个“画室”场景与 1 个主菜单 |
| 反编译 | 11 个脚本块 / 23 个注册脚本 / 22 个场景 / 13,809 个实体 |

一句话：**这份归档不需要补资源，已经具备做逐关自动化与录制的条件。**

---

## 二、资源完整性核验

### 2.1 抓取清单（`archive/manifest.json`）

| 字段 | 值 |
| --- | --- |
| 平台 / 策略 | CrazyGames / `publisher-frame`（iframe） |
| 入口 | `https://www.crazygames.com/game/pencil-rush` |
| 实际游戏帧 | `https://games.crazygames.com/en_US/pencil-rush/index.html` |
| 抓取时间 | 2026-11-04 02:08:19Z ~ 02:09:29Z（70s，`network-idle` 结束） |
| 资源 | 904 条（GET 890），全部 `saved` |
| 游戏载荷 | 622 个文件 / 46,240,128 字节（44.1 MiB） |
| 完整度判定 | `core-complete`，critical 0 / non-critical 0 |
| 本地回放 | `passed`（`startup-and-visible-canvas`，外部网络已封） |

### 2.2 磁盘逐条校验

对 890 条 GET 资源重新计算文件大小与 sha256：

```
磁盘校验通过 881 · 总字节 56,917,305 · 未保存 0 · 大小不符 0 · 哈希不符 0
文件缺失 9 → 全部为广告/追踪像素（adsrvr / turn.com / analytics.yahoo / sitescout / rlcdn），HTTP 302 无正文
非 2xx 8 → 与上面同一批追踪请求
```

这 9 条不在游戏运行路径上（离线回放中零外部请求），不构成缺失。

### 2.3 PlayCanvas 资产覆盖（关键）

`config.json` 注册 **1,319 个资产**，其中 590 个带本地文件（其余是 material/script/json 等内联数据）。逐个按“资产 id 目录 + 文件名主干”匹配磁盘：

```
config 引用文件 590 · 命中 590 · 缺失 0
```

匹配时必须注意两点，否则会误判成大面积缺失：

1. **落盘文件名被清洗过**：`Take 001.glb` → `Take-001-1fa9785837.glb`，空格、`|`、`&`、括号统一变 `-`；
2. **文件名后缀带抓取哈希**：`road_1.glb` → `road_1-7b9c745d33.glb`，所以要按“主干 + 扩展名”比对，不能按完整名。

另外 147 条“大小与 config 声明不符”不是损坏：CDN 会按 UA/Accept 重编码图片，例如 `road_1.png` 声明 3,058 字节、实际 142 字节，但仍是合法 PNG（211×256）。manifest 记录的实际下载字节与磁盘一致。

### 2.4 场景引用闭合

22 个场景共 1,894 个模板实例，逐个核对 `template_id` 是否存在于 `config.json.assets`：

```
Main 0 · level-1..16 共 1,884 · room-1..5 共 10 → 悬空模板 0
```

### 2.5 离线运行验证

用 `createReplayServer` 起本地回放，手机视口（450×800、触摸），加载后连续左右拖动 5 次并观察 45 秒：

| 指标 | 结果 |
| --- | --- |
| 请求过的本地资源 | 195 类 |
| 4xx / 5xx | **0** |
| `requestfailed`（排除主动取消） | **0** |
| `pageerror` + console error | **0** |
| 外部域请求 | **0** |

截图为实机画面（`preview/offline-play.png`）：跑道、成组铅笔、彩色玻璃墙、仙人掌、左上齿轮设置按钮，以及“左右滑动”的手势提示。

> 验证范围：第 1 关的启动、加载与可操作画面。第 2~16 关的**资源存在性**已由 2.3/2.4 静态覆盖，未逐关实玩。

### 2.6 `unresolvedCandidates` 的 102 条是什么

`assetCompletion` 记录 102 个“候选但未取到”的 URL，形如 `Present.png`、`blue-button.png`、`11111.png`、`ico-coin-1.png`。逐条回源均为 **HTTP 404**——它们是旧版本 UI 图或代码里拼接出来的死路径，源站本身就没有。**不是漏抓，也不能伪造占位图补进去**（归档规范明确禁止用空纹理冒充资源）。

---

## 三、启动链路

```
index.html
├─ amplitude.min.js / amplitude-init.js      // 统计（离线被拦）
├─ googletagmanager gtag.js                  // 统计（离线被拦）
├─ google-init.js
├─ crazygames-sdk.js                         // 平台 SDK（广告/存档/悬浮按钮）
├─ playcanvas-stable.min.js                  // 引擎 1.60.0
├─ __settings__.js                           // SCENE_PATH=1196898.json（Main）
│                                            // PRELOAD_MODULES: Ammo wasm（glue+wasm+fallback）
├─ cg-init.js
├─ __modules__.js                            // Ammo 预加载器
├─ __start__.js                              // app.start()，加载 Main
└─ __loading__.js                            // 进度条 / 首屏
```

- 场景清单在 `config.json.scenes`：`Main` + `level-1..16` + `room-1..5`。
- 关卡内容按需 `loadScene`，`AssetManager` 做了 level/room 级缓存（`cacheLevelEntity` / `cacheRoomEntity`），切关只销毁实例不重下资源。
- `__settings__.js` 的 `SCRIPTS` 列出 13 个脚本资产，其中 `50291198` 就是 `__game-scripts.js`（1,044,641 字节）。

---

## 四、反编译产物

```bash
npm run playcanvas -- download/Pencil-Rush-20261104-100819
# 等价：node scripts/analyze-playcanvas.mjs download/Pencil-Rush-20261104-100819
```

产物在 `analysis/playcanvas/`：

| 产物 | 内容 |
| --- | --- |
| `game-scripts/00..10-*.js` | `__game-scripts.js` 按原始文件边界切出的 11 块：`FBInstantMock / SocialSDK / loadingScreen / vconsole.min / timer-extension / tween / dat.gui.min / game.build / scrolling-texture / shader-chunk / effects-water` |
| `scripts.json` | **23 个 `pc` 脚本注册项**：id、类名、行号、`_attributes` 全量属性（名称/类型/默认值） |
| `scenes.json` | 22 个场景索引：实体数、根节点、模板实例、脚本使用直方图、场景 settings（重力 -9.8、fog 10~20、clustered lighting 等） |
| `scenes/*.tree.json` | 每个场景的实体树（名字/标签/脚本组件 id） |
| `summary.json` | 计数、包 sha256、资产类型分布、能力边界 |

汇总：

```
脚本块 11 · 注册脚本 23 · 辅助文件 7 · 场景 22（缺失 0）· 实体 13,809 · 未被场景引用 5
bundle 1,044,641 B · sha256 5f974e1bb06fc993be7742efebbe8f61990f910cc160898fcf3b76e56a29521b
assets 1,319：material 519 / model 390 / texture 135 / template 125 / sprite 83 / animation 18 / audio 13 / script 13 / font 7 / …
```

### 4.1 本次修复：自定义 `@createScript` 装饰器

这个项目用 TS 写，脚本不是 `pc.createScript('playerScript')`，而是自定义装饰器：

```js
// 编译后（__game-scripts.js）
e.createScript = function (t) {
  return function (e) {
    t = (t = t || e.name)[0].toLowerCase() + t.slice(1);  // PlayerScript → playerScript
    pc.registerScript(e, t);
    ...
  };
};
// 类定义处
c = function (t) { ... }(a.ScriptTypeBase);
c = o([(0, a.createScript)("PlayerScript")], c);
e.PlayerScript = c;
```

旧解析器只认 `pc.createScript('x')` 和 `class X extends pc.ScriptType`，于是只认出 4 个（`fpsMeter / scrollingTexture / shaderChunk / effectsWater`），**漏掉 19 个**。

`src/playcanvas-analysis.mjs` 现在增加一遍装饰器扫描：识别 `(0,x.createScript)("Name")],classVar)}(基类);ns.ClassName=` 形态（基类允许 `a.ScriptTypeBase`、`n(7476).FallingObjectAnimation` 这类中间基类），按“首字母小写”还原 id，并从类体里读 `_attributes`（含 `type/default/title`）与 `classVar.prototype.*` 方法。修复后：**23 个脚本，scene 里出现的 18 个 id 全部命中**；剩下 5 个是关卡未使用的 `cameraScript / rotatePencil / effectsWater / scrollingTexture / shaderChunk`。

> 注意：这类压缩构建的脚本类通常**只有属性、没有方法**——逻辑在普通 TS 类里（`Player`、`PencilGrig`、`PathController`、`Level`…）。读属性看 `scripts.json`，读逻辑看 `game-scripts/07-game.build.js`。

---

## 五、玩法机制（源码级）

### 5.1 沿轨道前进

`PathController`（`07-game.build.js`，`e.PathController`）：

```js
update(dt) {
  progress += (currentSpeed / pathLength) * dt;
  currentSpeed = currentSpeed < speed ? currentSpeed + 15 * dt : speed;
  if (progress >= 0.99) { isFinish = true; endLevel(); fire(PathEvent.EndLevel); }
}
```

- 路径是 `levelPlayerPath` 下 `point`/`segment` 拼出的 **spline 曲线**（`pc.CURVE_SPLINE`），`progress` 归一化到 0~1；
- 速度属性 `playerSpeed = 4`（16 关全部相同），加速度 **15/s**，约 0.27s 到满速；
- **0.99 即判通关**，不是 1.0；收尾有 0.5s 的 `SineInOut` 位移补间。

### 5.2 左右横移（唯一的操作）

输入层 `DefaultInput`：

```js
// 每次 pointermove
const dx = x - lastX;
fire(dx > 0 ? MoveRight : MoveLeft, dx / 1.5);   // 像素 → 冲量，除以 1.5
```

`PathController` 累积冲量并逐帧结算：

```js
moveRight(v) { rightMove += v; rightOffset = rightMove; }
syncPos(dt) {
  xOffset += dt * rightMove * playerSwingSpeed;   // 0.12
  xOffset -= dt * leftMove  * playerSwingSpeed;
  xOffset = clamp(xOffset, -2.25, 2.25);          // 路宽的一半，写死
  player.x = pathPoint.x + xOffset;
}
moveCorrection() {                                // 每帧衰减，没有乘 dt
  rightMove -= rightOffset / playerInertness;     // 10 → 每帧 ×0.9
}
```

要点：

- 滑动的**总位移**是等比级数：每帧 `x += dt·0.12·I`，冲量每帧 ×0.9，所以 `总位移 ≈ dt·0.12·I / 0.1`。
  60fps 下 ≈ `dx × 0.0133`，**约 170px 就能从中心滑到 ±2.25 边界**；30fps 下变成 `dx × 0.0267`（同样手势滑得更远）；
- 边界 **±2.25** 世界单位写死在代码里，不随关卡变化；
- 衰减用“每帧 10%”而非 `dt`，**帧率不同手感会变**（30fps 衰减速度只有 60fps 的一半）——做自动化回放时要固定帧率；
- `playerInertness` 在 16 关都是 10，`playerSwingSpeed` 都是 0.12。

### 5.3 铅笔网格：3 行 × 15 列

`PencilGrig`：

| 属性 | 值 | 含义 |
| --- | --- | --- |
| `maxCountRows` | 3 | 行数（前后） |
| `maxCountPencilsInRow` | 15 | 每行铅笔数（横向） |
| 容量 | **45** | 上限 |
| `pencilsInterval` | 0.065 | 同行铅笔间距 |
| `pencilsRowInterval` | 0.2（**16 关实例统一 0.36**） | 行距 |
| `pencilsY` | 0.185（**16 关实例统一 0.27**） | 离地高度 |
| `addPencilAnimationTime` | 0.4 | 拾取补位动画 |
| `rebuildPencilsDelay` / `Time` | 1 / 0.5（16 关实例为 1 / 0.1） | 复活重建节奏 |

- 空位查找 `freePosition`：**从中间列向两侧交替扩散**（`rowCenterIndex` + `changeNextFreeSide`），所以队伍是“从中间往两边长”的；
- 开局每关固定 **3 支**（`levelScript.initPencils`，7 个槽位只填 3 个）：level-1~12/14~16 = `red/blue/green`，**level-13 = `red/blue/red`**；
- 网格铅笔不是场景实体，是运行时从 `pencils` 模板 **clone** 出来的（每支带 trail、shavings、grinding 动画）。

### 5.4 拾取

拾取物标签 `inactivePencil`（父节点名 `InactivePencilWithColor`），碰撞在 **frontInspector**（队伍前端那个 0.01 厚的探测器）上：

```js
if (other.tags.has('inactivePencil')) {
  fire(PlayerEvent.AddPencil);
  other.tags.clear();
  addPencil(other);      // 在 freePosition 处补一支，颜色沿用拾取物
  other.destroy();
  updateInspectorsWidth();
}
```

第 1 关有 **71 组**拾取铅笔（含 87 个铅笔模型），第 13 关最少只有 40 组。

### 5.5 死亡判定

`Pencil.onCollisionStart`：

- 碰到 `wall-r` / `wall-l`（两侧护栏）→ 只做边界处理，**不死**；
- 碰到**任何其他刚体** → 立刻 `state = Dead`，按法线施加 `pencilForceImpulseAfterDeadObstacle`（1.5）的冲量飞出去；
- `Player.update` 里：`livingPencilsCount === 0` → `PlayerDead`（整局失败）。

**没有血量、没有受伤动画，铅笔就是命。**

### 5.6 彩色玻璃墙：本作的核心策略

关卡里每面玻璃墙都带 `glassScript.color`，并涉及四个标签：`glass` / `whole_glass` / `glass_activator` / `glass_part`（碎片）。

```js
// 队伍前端接触玻璃时
if (other.tags.has('glass_activator')) {
  const color = other.parent.parent.findComponent('script')
                      .get('glassScript').__attributes.color;
  startShootToGlass(other.parent, color);
}
// PencilGrig.shootToGlass(shotPoint, color)
const slot = getPencilByColor(color);          // 严格同色，优先第 2/3 行
if (!slot) return false;                        // 没有这个颜色 → 不射
detach(slot);  pencil.shootToGlass(shotPoint);  // 飞向 ShotPoint
→ BreakGlass → Glass.break()
```

- **有同色铅笔**：自动射出一支，命中后整面墙碎掉，该铅笔**消耗**；
- **没有同色铅笔**：不射，墙保持原样 → 队伍撞上去按 5.5 逐支判死（可能一瞬间全灭）；
- 碎裂表现由 `skipGlassPart`（碎片保留间隔，73 个实例取值 2~20）、`maxRandomOffset`（18~70）、`enableFX`（交替开/关以省性能）控制，碎完 `tiltRoad()`，碎片先飞 1s、再等 1s 转静态。

因此策略本质是**颜色库存管理**：前方是什么颜色的墙，就要提前攒到同色铅笔；没带对颜色就只能硬撞，撞上去的铅笔当场判死。

### 5.7 订书机（`stapler`）

```js
onCollisionStart(e) {
  if (e.other.name === 'FrontInspector' || e.other.tags.has('pencil')) playAnimation();
}
playAnimation() {
  root.tween(startPos → targetPoint, moveDuration, CubicOut);
  await delay(rotateDelay);
  rotatingObject.tween(rot → targetAngle, rotateDuration, CubicIn);
}
```

一次性的机械陷阱：前端一碰就“压下来 + 转一下”，之后保持姿态，靠物理挤压杀铅笔。`restart()` 会复位。第 13 关最多（13 个），第 11 关 7 个，第 14 关 11 个。

### 5.8 结算：给画上色

到达 0.99 后 `endLevel()`：停角色、停路径、`startColoring()` → 相机平移到画框，玩家**按住/点击**把剩下的铅笔一支支射到画上（`PencilGrig.shoot()` 取随机一支）。画面由 `PictureManager` + `pictures_config` 驱动：

```
pictureConfig = { ...model/texture/mask, painting_speed,
                  picturePaint: defaultPicturePaint * painting_speed + boosterPaint.currentValue }
```

涂满（`PaintedOver`）后 1.5s 切换下一幅画，并触发下一关/回画室。**所以“剩多少铅笔”直接决定这一局能涂多少。**

### 5.9 外围系统

- **金币 / 皮肤 / 加成**：`storeManager` + `PlayerModel`，三种加成 `BoosterCount`（铅笔数量）、`BoosterStrength`、`BoosterPaint`（涂色效率），各有等级/价格/看广告渠道；
- **皮肤**：`skinsMaterials`（cosmos / holographic / ice / lava / orange / sunny / sunnyGlow），按关卡解锁（`newEpicSkinOnLevel`）；
- **存档**：平台 SDK（CrazyGames / FBInstant），本地只存 `lowQuality` 画质标记；
- **画室**：`room-1..5`，每个房间 4 个画位（`picture:focus:1..4`），共 20 个画框；每关场景自带一个 `picture` 实体（`PictureManager` 按当前关卡配置取 `model/texture/mask`）。

---

## 六、关卡数据（16 关，全部来自场景 JSON 原始属性）

| 关卡 | 实体 | 可拾取铅笔 | 玻璃墙 | 玻璃颜色 | 订书机 | 障碍标签 | 初始铅笔 |
| --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| level-1 | 869 | 71 | 5 | red, green, orange, blue, purpure | 0 | 18 | red/blue/green |
| level-2 | 992 | 67 | 8 | red, green, orange, blue, purpure, green, purpure, blue | 0 | 15 | red/blue/green |
| level-3 | 438 | 43 | 0 | — | 0 | 13 | red/blue/green |
| level-4 | 695 | 59 | 2 | red, orange | 0 | 16 | red/blue/green |
| level-5 | 957 | 87 | 4 | blue, red, green, blue | 2 | 13 | red/blue/green |
| level-6 | 1,037 | 62 | 9 | blue, red, green, green, red, orange, green, blue, purpure | 0 | 15 | red/blue/green |
| level-7 | 843 | 58 | 5 | red, purpure, red, green, blue | 2 | 19 | red/blue/green |
| level-8 | 1,080 | 66 | 9 | red, blue, green, green, red, green, orange, blue, purpure | 1 | 20 | red/blue/green |
| level-9 | 944 | 66 | 6 | purpure, red, purpure, green, pink, red | 0 | 33 | red/blue/green |
| level-10 | 1,001 | 70 | 6 | red, red, orange, green, blue, purpure | 0 | 18 | red/blue/green |
| level-11 | 968 | 79 | 5 | red, red, orange, green, blue | 7 | 28 | red/blue/green |
| level-12 | 662 | 54 | 1 | red | 0 | 31 | red/blue/green |
| level-13 | 753 | 40 | 3 | red, red, red | 13 | 29 | **red/blue/red** |
| level-14 | 897 | 47 | 7 | purpure, orange, green, red, green, green, green | 11 | 19 | red/blue/green |
| level-15 | 557 | 30 | 2 | green, green | 0 | 22 | red/blue/green |
| level-16 | 724 | 61 | 1 | green | 2 | 25 | red/blue/green |

说明：

- “可拾取铅笔”= `inactivePencilScript` 组数（每组含 1~3 个 `pencilScript` 模型）；
- 速度、网格、横移参数 16 关完全一致（4 / 3×15 / 0.12 / ±2.25），**难度只靠关卡布局、铅笔密度、玻璃与订书机数量**；
- level-3 没有玻璃、level-13 全是红墙，是两处明显的节奏设计点。

---

## 七、场景与实体

| 场景 | 实体 | 根 | 模板实例 | 主要脚本/机关 |
| --- | ---: | ---: | ---: | --- |
| Main | 277 | 1 | 0 | `pressAnimation`×47、`glowAnimation`×3、`game`、`spinner`、`hintHandAnimation`（菜单 UI） |
| level-1 | 869 | 1 | 124 | 87 铅笔 / 71 拾取 / 5 玻璃 |
| level-2 | 992 | 1 | 129 | 83 铅笔 / 67 拾取 / 8 玻璃 |
| level-3 | 438 | 1 | 77 | 无玻璃无订书机（教学后放松） |
| level-4 | 695 | 1 | 105 | 2 玻璃 + `movingObject`×2 |
| level-5 | 957 | 1 | 137 | 4 玻璃 + 订书机 2 + `rotatingObject` |
| level-6 | 1,037 | 1 | 125 | 9 玻璃 + 仙人掌 2 + 笔筒 2 |
| level-7 | 843 | 1 | 116 | 5 玻璃 + 订书机 2 |
| level-8 | 1,080 | 1 | 138 | 9 玻璃 + 订书机 1（实体最多） |
| level-9 | 944 | 1 | 138 | 6 玻璃 + `rotatingObject` + 坠落物 |
| level-10 | 1,001 | 1 | 131 | 6 玻璃 |
| level-11 | 968 | 1 | 140 | 订书机 7（模板最多） |
| level-12 | 662 | 1 | 110 | 1 玻璃 + 坠落物 4 |
| level-13 | 753 | 1 | 106 | 订书机 13（机关最密） |
| level-14 | 897 | 1 | 112 | 订书机 11 + 7 玻璃 |
| level-15 | 557 | 1 | 81 | 2 玻璃（实体最少） |
| level-16 | 724 | 1 | 115 | `game`+`fpsMeter`（同 Main 的调试脚本） |
| room-1..5 | 23 ×5 | 1 | 2 ×5 | 只有 `picture:focus:1..4` 与 `exit` 标签，无脚本 |

`Main` 的层级是标准 PlayCanvas 界面骨架：`SceneManager / SoundManager / World / ScreenManager / View3D / View2D / MainView / Popup / EpicPencilOfferScreen`。

---

## 八、脚本注册表（23 个）

| 脚本 id | 类 | 属性数 | 说明 |
| --- | --- | ---: | --- |
| `playerScript` | PlayerScript | 11 | 速度、横移、网格、间距、高度（核心调参入口） |
| `pencilScript` | PencilScript | 9 | 削笔速度、死亡冲量、倾斜、拖尾 |
| `cupWithPencilsAnimation` | CupWithPencilsAnimation | 9 | 笔筒拾取：多支铅笔依次飞入网格（继承 `FallingObjectAnimation`） |
| `glassScript` | GlassScript | 8 | 颜色、碎片间隔、随机偏移、特效开关 |
| `stapler` | Stapler | 7 | 落点、旋转目标角、延迟、时长 |
| `skinsMaterials` | SkinsMaterials | 7 | 7 套皮肤材质 |
| `rotatingObject` | RotatingObject | 6 | 旋转机关 + 拖尾 |
| `shaderChunk` | ShaderChunk | 6 | shader chunk 注入 |
| `fallingObjectAnimation` | FallingObjectAnimation | 5 | 坠落物曲线动画 |
| `game` | Game | 4 | 环境/调试/起始关（`startLevelId` 实际未使用） |
| `movingObject` | MovingObject | 4 | 往返移动平台/障碍 |
| `effectsWater` | EffectsWater | 3 | 水面 shader |
| `scrollingTexture` | ScrollingTexture | 3 | 滚动纹理 |
| `hintHandAnimation` | HintHandAnimation | 2 | 手势提示 |
| `rotatePencil` | RotatePencil | 2 | （未被关卡使用） |
| `cactusAnimation` | CactusAnimation | 1 | 仙人掌摆动 |
| `levelScript` | LevelScript | 1 | `initPencils` 初始颜色表 |
| `inactivePencilScript` | InactivePencilScript | 1 | 拾取物颜色 |
| `cameraScript` | CameraScript | 0 | （未被关卡使用） |
| `fpsMeter` | —（`pc.createScript` 直调） | 0 | 非 prod 才显示 |
| `pressAnimation` | PressAnimation | 0 | 按钮按下 |
| `glowAnimation` | GlowAnimation | 0 | 呼吸发光 |
| `spinner` | Spinner | 0 | 菜单转盘 |

### 8.1 核心属性全量（可直接抄进自动化配置）

```jsonc
// playerScript
{ "playerSpeed": 4, "playerSwingSpeed": 0.12, "playerInertness": 10,
  "addPencilAnimationTime": 0.4, "rebuildPencilsDelay": 1, "rebuildPencilsTime": 0.5,
  "maxCountRows": 3, "maxCountPencilsInRow": 15,
  "pencilsInterval": 0.065, "pencilsRowInterval": 0.2, "pencilsY": 0.185 }

// pencilScript
{ "pencilGrindingSpeed": 0.03, "pencilForceImpulseAfterDeadObstacle": 1.5,
  "pencilForceImpulseAfterDeadFloor": 0.05, "speedTilt": 0.006,
  "startTiltFrom": 1, "maxTilt": 0.3,
  "trailLifeTime": 1, "trailWidth": 0.02, "trailStartAlpha": 0.8 }

// glassScript
{ "color": "red", "obstacleLayer": false, "enableFX": true, "skipGlassPart": 1,
  "maxRandomOffset": 10, "setMaskDelay": 2.5, "fallingRoad": null, "roadAngle": 0 }

// stapler
{ "root": …, "targetPoint": …, "rotatingObject": …,
  "moveDuration": …, "targetAngle": …, "rotateDelay": …, "rotateDuration": … }
```

> 关卡实例会覆盖默认值：16 关的 `pencilsRowInterval` 全部是 0.36、`pencilsY` 全部 0.27、`rebuildPencilsTime` 全部 0.1。玻璃墙**每面单独配**：73 个实例里 `skipGlassPart` 从 2 到 20、`maxRandomOffset` 从 18 到 70 都出现过（`skip=3/offset=50` 只占 23 个）。**读数值必须以场景 JSON 的实例属性为准**。

---

## 九、物理层与事件（做自动化时最该记住的两张表）

### 9.1 碰撞组 / 掩码

| 枚举 | 类 | 值 | 用途 |
| --- | --- | --- | --- |
| `RigidbodyGroup` | None | 0 | — |
| | BrokenGlass | 3 | 碎玻璃 |
| | **Pencil** | 15 | 铅笔（会与 Obstacle 撞） |
| | **Obstacle** | 16 | 障碍 |
| | FrontInspector | 25 | 前端探测器 |
| `RigidbodyMask` | None | 0 | — |
| | BrokenGlass | 2 | 碎玻璃只与部分层碰 |
| | **Obstacle** | 15 | 障碍掩码 |
| | **Pencil** | 16 | 铅笔掩码 |
| | FrontInspector | 26 | 16+8+2 |
| | DeadPencilObstacle | 2 | 死笔飞向障碍 |
| | DeadPencilRoad | 4 | 死笔落地 |
| | ShootToGlassPencil | 5 | 射向玻璃的笔只与玻璃碰 |

### 9.2 事件表

```js
PlayerEvent: Start / Pause / MoveRight / MoveLeft / EndLevel / PencilDead /
             PlayerDead / BreakGlass / AddPencil / DeadPencil / Created /
             ColoringShoot / ColoringStart / ColoringEnd
PathEvent:   EndLevel
DefaultInputEvent: FirstPointerDown / PointerDown / PointerUp / Click / Tap /
                   MoveRight / MoveLeft
```

自动化只需要盯三个：`PlayerEvent.PlayerDead`（失败）、`PathEvent.EndLevel`（跑完）、`PlayerEvent.PencilDead`（实时库存变化）。

---

## 十、能力边界与风险

1. **未做逐关实玩**：只验证了第 1 关的完整加载与操作；其余 15 关做的是静态资源闭合检查（0 缺失、0 悬空模板），不等于玩法通过。
2. **横移衰减依赖帧率**：`moveCorrection` 没乘 `dt`，30fps 与 60fps 手感不同。回放必须锁帧，否则轨迹会漂。
3. **业务代码是压缩产物**：类名保留、变量名被压成单字母，`game-scripts/07-game.build.js` 只有 4 行、826KB；改逻辑要按字符串特征定位，不要按行。
4. **`startLevelId` 是死属性**：只在 `game` 脚本里声明，运行时没有任何读取点。想直跳某关，得改存档或 `level` 组件加载流程，不能改这个字段。
5. **CDN 会重编码图片**：147 个资产的实际字节数与 `config.json` 声明值不同——图片多为压得更小（`road_1.png` 3,058 → 142），脚本包因合并略大（1,042,338 → 1,044,641）。都仍是合法文件，做哈希/尺寸对比时不能拿声明值当基准。
6. **平台 SDK 联网**：`crazygames-sdk.js` + amplitude + gtag 在离线回放里被替换/拦截；如果直接开 `index.html`（不走 `createReplayServer`），会有外部请求与广告。
7. **碎片上限**：`glass_part` 标签合计 1,394 个碎片刚体，13 关订书机 13 个，低端机建议把 `enableFX` 关掉、`window.isLowQualityGPU = true`（代码里已有分支）。

---

## 十一、复现命令

```bash
# 1) 重新解析（幂等）
npm run playcanvas -- download/Pencil-Rush-20261104-100819

# 2) 离线回放（自带本地静态服务 + 禁外网）
node src/cli.mjs verify --archive download/Pencil-Rush-20261104-100819 --duration 12

# 3) 指定端口手动玩
node src/cli.mjs replay --archive download/Pencil-Rush-20261104-100819

# 4) 语法/回归
npm run check
```

关键文件：

```
archive/manifest.json                     抓取清单（904 条）
analysis/playcanvas/scripts.json          23 个脚本 + 属性
analysis/playcanvas/scenes.json           22 个场景索引
analysis/playcanvas/scenes/level-*.tree.json
analysis/playcanvas/game-scripts/07-game.build.js   全部业务逻辑（826KB / 4 行）
game/pencil-rush.game-files.crazygames.com/pencil-rush/8/config.json   1,319 个资产
```

---

## 十二、变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-10 | 首次核验：资源 590/590、22 场景 0 悬空、离线试玩 0 异常；输出本报告与 `GAME_GUIDE.md` |
| 2026-11-10 | `src/playcanvas-analysis.mjs` 支持自定义 `@createScript` 装饰器注册，注册脚本由 4 → 23 |
