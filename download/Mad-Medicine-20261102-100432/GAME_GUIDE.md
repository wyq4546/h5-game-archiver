# Mad Medicine (疯狂医学/轮椅跑酷) 逆向与自动化工程指南

## 一、 游戏基础元数据与反编译核验

| 项目 | 属性与参数 |
| --- | --- |
| **游戏标识** | `Mad-Medicine-20261102-100432` |
| **发布平台** | Yandex Games (App ID: `262540`) |
| **引擎与版本** | Unity 2022.3.14f1 WebGL (IL2CPP, metadata v29) |
| **核心底层架构** | LeoECS 实体组件系统 + Dreamteck Splines 样条曲线轨迹 |
| **分辨率与画幅** | 1080 × 1920（竖屏 Mobile Portrait, Device Scale Factor 1.0） |
| **反编译交付产物** | `analysis/il2cpp/dump.cs` (13.1 MB), `script.json` (37.5 MB), `project-classes.json`, `gameplay-classes.json`, `analysis/bot/context.json` (3.2 MB) |
| **WASM ABI 规范** | Unity 2022.3 结构体/向量返回值采用指针注入：`Transform$$get_position_Injected(trans, vecPtr)`，栈内存通过 `stackAlloc(16)` 分配 |

---

## 二、 玩法机制与对象逆向分析

### 1. 玩家与轨道空间坐标
- **核心组件**：`Modules.MadMedicine.UnityComponents.ViewComponents.PlayerColliderViewComponent`
- **运动规律**：角色挂载于样条曲线轨迹。前进量沿主轴 $Z$ 递增，横向自由度 $X$ 范围大致在 $[-2.5, +2.5]$。
- **关卡阶段空间划分**：
  - **常规跑道（$Z \in [0, 78.0]$）**：沿途分布障碍物与升级收集项，由 `PointerDisplacementSystem` 接收触控横向位移。
  - **冲刺决胜段（$Z \in [78.0, 125.0]$）**：进入 `RoundFinishState`，激活 `SprintButton`。高频点击加速并超越轮椅对手。
  - **领奖台胜利（$Z \ge 125.0$）**：登顶第一名领奖台（1st Place Podium），触发胜利动画与特效。

### 2. 实体组件分类表（ViewComponents）

| 组件类名 | 类型 | 行为与规避/拾取策略 |
| --- | --- | --- |
| `PlayerColliderViewComponent` | 玩家 | 碰撞体主体，受输入系统控制 |
| `NurseViewComponent` | 收集项 | 护士（治疗/升级病人）：轮椅 $\to$ 双拐 $\to$ 独拐 $\to$ 奔跑。**极高收益，优先拾取** |
| `DiamondViewComponent` | 收集项 | 钻石道具。**收益项，择机拾取** |
| `MoneyViewComponent` | 收集项 | 现金叠包。**收益项，择机拾取** |
| `CarViewComponent` | 危险障碍 | 轨道疾驰的汽车，被撞扣除健康值。**绝对规避** |
| `BarrierViewComponent` | 危险障碍 | 施工路障与硬墙。**绝对规避** |
| `ObstacleViewComponent` | 危险障碍 | 地面静态障碍物。**绝对规避** |
| `BanditViewComponent` | 危险障碍 | 歹徒/抢夺者。**绝对规避** |
| `CompetitorViewComponent` | 竞速对手 | 冲刺段轮椅对手，通过高频冲刺点击超越 |
| `PedestalViewComponent` | 终点建筑 | 终点 1-2-3 名领奖台 |

---

## 三、 原生交互契约与触控映射

所有自动化控制必须遵循严格的**纯原生物理触控**，杜绝瞬移和修改内存常数：

1. **开局点击（Start Screen）**：
   - 目标组件：`Modules.MadMedicine.UI.UnityComponents.TTSButton` ("Tap To Start")。
   - 屏幕坐标：$(540, 960)$。
   - 触发方式：原生 CDP `Input.dispatchTouchEvent` 发送 `touchStart` $\to$ 100ms $\to$ `touchEnd`。

2. **跑酷横向闭环控制（Steering Loop）**：
   - 原理：`PointerDisplacementSystem` 读取帧间横向位移差值 $\Delta X / \text{Screen.width}$。
   - 实现：以 $Y = 1500$ 为基准线，根据候选航道代价函数评估最优目标 $X_{\text{target}}$。
   - 闭环 P 控制律：
     $$\text{err} = X_{\text{target}} - X_{\text{player}}$$
     $$\Delta \text{touchX} = \text{clamp}(\text{err} \times 70, -45, 45)$$
     $$\text{touchX} = \text{clamp}(\text{touchX} + \Delta \text{touchX}, 100, 980)$$
     通过持续 `touchMove` 引导角色平滑避障。

3. **冲刺高频连击（Sprint Finish）**：
   - 触发时机：当玩家 $Z \ge 78.0$ 且 $Z < 125.0$。
   - 目标组件：`Modules.MadMedicine.UI.UnityComponents.SprintButton`。
   - 屏幕坐标：$(540, 1095)$。
   - 频率：$20\text{ms}$ 按下 + $20\text{ms}$ 抬起交替连击，确保以第一名超越所有对手并飞跃至领奖台。

4. **领奖台庆祝与切关（Settlement & Next Level）**：
   - 胜利时机：玩家坐标 $Z \ge 125.0$。
   - 庆祝特写：录屏保留 $1.8$ 秒纯净领奖台第一名庆祝特写画面，随后完成录屏封包。
   - 结算渲染抑制：通过 `CanvasGroup.alpha = 0` 静默隐藏 `RoundCompleted(Clone)` 弹窗渲染，确保视觉纯净。
   - 下一关按钮：组件 `Modules.MadMedicine.UI.UnityComponents.StateTransitionButton`，按钮名称 `"Button"`（"ДАЛЬШЕ" / Next）。
   - 按钮屏幕包围盒：$X \in [351, 730], Y \in [1193, 1301]$，中心点 $(541, 1247)$。
   - 点击 $(541, 1247)$ 触发关卡平滑迁移。

---

## 四、 Yandex Games SDK 平台契约与 Mock 实现

本游戏深度依赖 Yandex Games SDK（`YaGames` / `ysdk`）。若在非 iframe 或外部环境运行，游戏底层 C# 跨语言绑定会调用导出的 Emscripten 方法，必须在页面加载前（`addInitScript`）提供完备 Mock，否则将导致 WebAssembly 运行时崩溃：

1. **环境与国际化（`i18n.tld`）**：
   - `_GetYandexGamesCurrentDomainExtension` 内部执行 `yandexGames.allocateUnmanagedString(yandexGames.sdk.environment.i18n.tld)`。
   - 若 `tld` 未定义，`lengthBytesUTF8(undefined)` 将抛出 `TypeError` 并中断 Unity 主循环。
   - Mock 必须显式定义：`environment: { i18n: { lang: 'ru', tld: 'ru' }, app: { id: '262540' } }`。

2. **支付与账号接口（IAP & Player）**：
   - 游戏初始化调用 `sdk.getPayments()`，要求返回 Promise 解析为 `{ getPurchases: async () => [], getCatalog: async () => [] }`。
   - `sdk.getPlayer()` 要求提供 `_personalInfo: { scopePermissions: { public_name: 'allow' } }`。

3. **全屏插屏与激励广告（Adv Handlers）**：
   - `sdk.adv.showFullscreenAdv(opts)` 必须异步触发 `opts.callbacks.onOpen()` 与 `opts.callbacks.onClose(true)`，防止切关时广告回调悬挂。

---

## 五、 发布级逐关录制标准

1. **规格指标**：
   - 分辨率：1080 × 1920（竖屏 Full HD）。
   - 刷新率：恒定 60 FPS 逐帧采集（`captureEveryFrame = true`）。
   - 编码与画质：CRF 18，H.264 (yuv420p) + AAC 192kbps 原声音轨。
2. **纯净度基线**：
   - 开头：开局无任何白屏、黑屏、菜单残留，第一帧即为关卡纯净就绪画面。
   - 结尾：终局干净保留 1.5~2.0 秒领奖台庆祝动作，彻底杜绝结算弹窗遮挡。
   - 目录规范：`scripts/video/` 仅存放最终生成的 MP4 视频；所有日志、元数据与检查点均隔离存放于 `scripts/recording-data/`。
