# GoGy 自动化：外部复核结论（2026-11-11 11:15）

> 依据：`analysis/il2cpp/dump.cs`（TypeDefIndex 2780 / 2781 / 2785 / 2800）＋ 在本机同一份构建上的实测。
> 先按 A 改，再谈策略；A1 不改，后面所有实验数据都不可信。

## A. 三个必须先纠正的事实

### A1. `mcStatus !== 0` 不是失败判据

dump 里 `MainController.Status`（TypeDefIndex 2781）只有两个值：

```csharp
public const MainController.Status Playing  = 0;
public const MainController.Status Complete = 1;   // 没有 Fail
```

`MainController.status` 在 `+0x54`（这点你找对了），但它是**通关标志**，不是失败标志。

实测：球还没开始滚（z=19.04、`Ball.status`=Moving）时读到的就已经是 `1`。

所以 `if (mcStatus !== 0) → finished` 会把「还没开始」和「通关」都判成失败，run 会随时提前断掉。**这一行删掉。**

生产可用的失败判据（三选一，建议 2）：

1. `Ball.status`（+0x20，`0=Stop / 1=Moving`）由 1 变 0，且 z 不再增长
2. 连续 N 帧 z 不变（N=30 帧或 500ms），且 `mc.status` 仍为 0
3. 用 `npm run method-map`（`scripts/build-wasm-method-map.mjs`）拿到 `Ball$$OnFail` 的函数表索引，用 `Module.wasmTable.set(idx, hook)` 换成只置位的桩函数 —— 唯一能拿到「精确死亡瞬间」的做法

注意：`Ball` 的 `+0x54` 是 `beginFlyTime`（float），**不是状态**。别拿 ball+0x54 当状态读。

### A2. 关卡长度是 1000，你的 waypoint 表只到 310

`MainController.myLevel`（+0x60）→ `MyLevel`（TypeDefIndex 2800），实测：

| 字段 | 偏移 | 实测值 |
|---|---|---|
| `levelLength` | +0xC | **1000** |
| `totalDiamond` | +0x10 | **20** |
| `ballSpeed` | +0x14 | **14** |

`MainController.currentProgress`（+0x5C）是**绝对距离**，不是百分比：实测 z=19.04 时 `currentProgress = 19.039`。
进度百分比 = `currentProgress / levelLength`。

而 `test-air-steer.mjs` 的 waypoint 表最后一条是 `{ z: 310 }`，只覆盖 31%。就算前面全走对，过了 310 就没有目标了，球会直冲撞死。**先把表补到 1000。**

其它可用字段（顺带）：`templates` +0x70（实测 List 长度 26，即本关 26 个 template）、`level` +0x68（当前关卡号 = 1）、`numDiamond` +0x58、`usingShield` +0x64。

### A3. `Ball` 的字段只用了一半

```csharp
public bool goingtoPortal;        // 0xC
private Ball.Status status;       // 0x20   0=Stop 1=Moving   ← 没用
public bool isFlying;             // 0x28   ✓ 在用
public float originalY;           // 0x2C
public Vector3 transformPosition; // 0x30   ✓ x/y/z
public Quaternion transformRotation; // 0x3C
public float speed;               // 0x4C   ← 实测恒为 14，可用来算到达时间
private float beginFlyPositionY;  // 0x50
private float beginFlyTime;       // 0x54
```

## B. 换探索方式：不要再「撞一次改一个数字」

现在的循环是「跑 → 死 → 截图 → 改一个 waypoint → 再跑」。10 关要几百轮，这就是卡住的真正原因。改成下面两条之一。

### B1. 电影条截图（稳，一次 run 拿一段）

固定车道（一直 x=0 不转向），每前进 20 个 z 截一张图，一次 run 可拿到 50 张。拼成 4~6 张长图后一次性读完，直接写出障碍表。
局限：x=0 那条线上会死，只能拿到死点之前的图；死了就换个起始车道再来一段。

### B2. 传送探针（先验证，成功了收益最大）

`Ball.transformPosition` 是托管字段，理论上可直接写：

```js
f32[(ball + 0x38) >> 2] = z;   // 直接改 z，把球往前挪
```

如果 `Ball.Move()` 每帧从 `transformPosition` 取位置，写进去球就瞬移，一次 run 扫完 1000 个 z，20 分钟拿到全关地图。

**先做最小验证**：在 z≈50 时写入 60，看下一帧 z 是否停在 60 附近、`Ball.status` 是否仍为 1。不行就退回 B1，别纠缠。

## C. 控制环要改

现在：`按住键 → |err| < 0.6 松手`。这游戏转向有明显惯性，长按必然过冲；帧率一抖就更糟。

建议改成速度前馈 + 短脉冲：

```js
const latency = 0.08;                       // 先用 2~3 帧估值，再用实测校准
const xPred   = x + (vx || 0) * latency;    // vx 用前后帧差分
const err     = targetX - xPred;
if (Math.abs(err) > 0.25) pulse(err > 0 ? 'ArrowRight' : 'ArrowLeft', 90);  // 90ms 脉冲
```

到达时机直接算，别数帧：`t = (z_target - z) / 14`。

另外：`isFlying` 为 1 时是空中阶段，转向权重和地面不同，建议空中阶段用更短的脉冲（50ms）并降低目标误差阈值。

## D. 验收标准

一关跑完必须同时满足：

- `currentProgress >= levelLength`（1000）
- `mc.status === 1`（这时它才是真通关）
- `numDiamond === totalDiamond`（20）

并且把每次 run 追加到 `scripts/runs.jsonl`：

```json
{"level":1,"maxZ":0,"deathZ":0,"deathX":0,"ballStatus":0,"mcStatus":0,"diamonds":0,"wpVersion":"v7","ms":0}
```

没有这份表，改一个参数是变好还是变坏全靠感觉，等于在噪声里做优化。

## E. 执行顺序

1. **删掉 `mcStatus !== 0` 的终止条件**（A1）—— 不改这一步，后面全是脏数据
2. **waypoint 表补到 1000**（A2）
3. **加 `runs.jsonl` 记录**（D）
4. 试传送探针（B2）；成功就一次做出全关地图，失败退回电影条截图（B1）
5. 最后再调控制环（C）

先只做第 1~3 步，跑 3 次，把 `runs.jsonl` 的前 3 行发出来，再继续。
