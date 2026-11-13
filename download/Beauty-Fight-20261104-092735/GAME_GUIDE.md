# Beauty Fight - 游戏机制与自动化全解析工程指南

## 一、 游戏概况与核心机制

- **游戏名称**：Beauty Fight (美丽战斗 / 高跟鞋格斗)
- **游戏引擎**：LayaAir 3D (纯 JavaScript/TypeScript，包含 `laya.core.js`, `laya.d3.js`, `laya.physics3D.js`, `NevMesh.js`)
- **宿主平台**：Playhop / Yandex Games (App ID: `239345`)
- **画面规格**：9:16 竖屏 (设计分辨率 640×1138，录制成片原生基准 1080×1920，60 FPS CFR)
- **核心逻辑与类结构**：
  - 游戏代码经打包整合于 `ru/js/bundle-910497ed1c.js`。
  - 原生类命名由 TypeScript 编译混淆生成：
    - `Lt` (继承自 `At` / `Laya.Script3D`): 主角控制器，维护角色模型、双脚高跟鞋绑定 (`hp_foot_left`, `hp_foot_right`)、鞋跟层数 (`heel_num`)、碰撞响应 (`onTriggerEnter`, `onCollisionEnter`)、动画播放 (`hp_3p_anim`) 与胜负判定。
    - `st`: 主角移动控制器 (`move_ctrl`)，负责横向位置更新 (`updatePos(dx)`) 与竖向推进 (`updateVSpeed(speed)`)。
    - `Jt` (继承自 `e.test.GameSceneUI`): 游戏主界面单例 (`Jt.instance`)，管理 3D 场景加载 (`loadLevelMap`)、触摸摇杆分发 (`Tt` / `It`)、广告流转与关卡生命周期。
    - `Dt` (继承自 `e.test.VictorySceneUI`): 关卡胜利界面，处理结算金币计算与下一关加载。
    - `Rt` (继承自 `e.test.FailSceneUI`): 关卡失败界面。
    - `f` / `p`: 用户数据持久化管理器，`f.getGrade()` 获取当前关卡，`f.setGrade(lv)` 设置关卡，`f.addGrade()` 关卡加一。
    - `H`: 全局音频与音效管理器 (`H.instance.playSound`, `H.instance.playMusic`)。

---

## 二、 逆向分析成果与原生方法体

### 2.1 赛道实体与触发器
1. **收集物 (Collectibles)**：
   - `HeelPart`: 高跟鞋道具。触发后主角 `this.heel_num++` 并调用 `this.addHeel()`，鞋跟高度抬升，角色碰撞胶囊体随之增大。
   - `Gem`: 钻石道具。触发后拾取金币并广播 `X.BroadCast(i.DEM)`。
   - `InGameRewardCollectable`: 局内特殊奖励（时装/饰品）。
2. **障碍与陷阱 (Obstacles & Hazards)**：
   - `Obstacle` (黄色/橙色矮墙/高台)：需要主角具备对应高度的鞋跟。通过时消耗鞋跟 `this.heel_num -= Math.round(e)`；若鞋跟不足 (`heel_num < 0`)，主角跌倒触发 `goDead()`。
   - `RotatingObstacle`: 旋转刀片障碍，触碰扣减 1 层鞋跟。
   - `GrindPad`: 磨损踏板，触碰扣减 1 层鞋跟。
   - `single_walk_line` / `walk_line_pair`: 细钢轨与双滑轨，主角进入后展开劈叉滑行姿态。
3. **终点结算 (Finish & Victory)**：
   - `FinishStep_1` $\dots$ `FinishStep_N`: 终点台阶。主角踩上每个台阶消耗 1 层鞋跟，若鞋跟耗尽则停留在当前阶梯并触发胜利。
   - `Podium`: 登顶奖台。踩上后进入最高奖励胜利状态 `this.mFSMLeg.ChangeState(se.instance)`。
   - 胜利时主角触发胜利舞蹈动画 `Arm_Char|win_dance_02`，伴随礼花喷射。

### 2.2 控制模型与触摸映射
- **输入分发机制**：
  游戏在 `Jt.instance.jsui`（`Tt` 摇杆组件）上监听 `Laya.Event.MOUSE_DOWN`, `MOUSE_MOVE`, `MOUSE_UP`：
  ```javascript
  onMouseDown: this._centerX = e.stageX / scaleRate;
  onMouseMove: let dx = (e.stageX / scaleRate) - this._centerX;
               player.ctrlMoveX(dx);
  ```
  在 `At.ctrlMoveX(dx)` $\to$ `st.updatePos(dx)` 中：
  ```javascript
  updatePos(dx) {
      let targetX = this.x - (dx / 640) * 6;
      if (Math.abs(targetX) < 2.5) {
          this.role.transform.position.x = targetX;
      }
  }
  ```
  赛道有效横向范围为 $X \in [-2.4, +2.4]$。

---

## 三、 核心策略与专有算法沉淀

1. **赛道感知与世界模型**：
   - 通过 LayaAir 场景树实时遍历 `Jt.instance.map_main` 下的 `Segments`、`Obstacles` 与收集物节点；
   - 提取主角前方近场（$Z \in [Z_{\text{cur}}, Z_{\text{cur}} + 25]$）的所有道具与障碍物三维坐标及尺寸；
   - 计算安全通行走廊：优先收集沿途的高跟鞋道具确保鞋跟高度充裕；遇高墙时横向避开或确保鞋跟高度大于障碍墙高度。
2. **平滑转向控制**：
   - 采用二阶阻尼与死区滤波算法计算目标 $X_{\text{target}}$，通过 CDP 分发连续平滑的 TouchMove 事件；
   - 杜绝瞬态大跳变与高频抖动，确保角色运镜平稳自然。
3. **高质感终点特写与弹窗拦截**：
   - 终点过关时拦截 `VictoryUI` / `FailUI` 弹窗与结算按钮显示，保留主角在领奖台上的胜利舞蹈特写 1.2~1.5 秒；
   - 庆祝完成后自动调用底层的关卡前进逻辑 `f.addGrade()` 与场景重载 `Zt.instance.reloadLevelMapAuto()`，无缝衔接下一关。

---

## 四、 工程目录与文件拓扑

```text
Beauty-Fight-20261104-092735/
├── GAME_GUIDE.md                    # 本权威工程指南
├── index.html                       # 门户入口源码
├── start.cmd / stop.cmd             # Windows 启动/停止服务
├── archive/
│   ├── manifest.json                # 静态资源清单与抓取映射
│   └── session.har                  # 完整网络录制 HAR
├── analysis/
│   ├── report.json                  # 引擎识别与架构分析报告
│   ├── source-index.json            # 核心脚本与符号索引
│   └── decompiled/
│       └── bundle-beautified.js     # 格式化业务核心源码
├── game/                            # 离线游戏资源
└── scripts/
    ├── automation-context.json      # 自动化优先分析上下文
    ├── play-auto.cmd                # 本地静默/可见自动化运行
    ├── record-auto.cmd              # 自动录制全关卡入口 (Windows)
    ├── record-from-level.cmd        # 指定起始关卡录制入口 (Windows)
    ├── verify-recordings.cmd        # 视频验收检查入口 (Windows)
    ├── internal/
    │   ├── game.mjs                 # 游戏生命周期、CDP 桥接与环境初始化
    │   ├── strategy.mjs             # 逐帧赛道感知、避障与轨迹规划算法
    │   ├── runner.mjs               # 长跑执行器、状态机与关卡推进
    │   ├── run-auto.mjs             # 跨平台 CLI 启动入口
    │   ├── verify-recordings.mjs    # 视频验收测试
    │   └── lib/
    │       ├── replay.mjs           # 本地离线重放 HTTP 服务
    │       ├── game-video-recorder.mjs # 60FPS CFR 极速录制引擎
    │       ├── recording-acceptance.mjs# 自动化验收标准校验器
    │       ├── recording-layout.mjs # 1080x1920 移动端布局计算器
    │       └── recording-runtime.mjs# 录制运行时配置与环境守护
    ├── recording-data/              # 录制元数据、日志、检查点 (严格分离)
    └── video/                       # 最终交付视频目录 (纯净仅含 .mp4)
```

---

## 五、 常用开发、测试与排查命令备忘

1. **运行自动化回放（不录像）**：
   ```bash
   node scripts/internal/run-auto.mjs --start 1 --end 10
   ```
2. **执行正式逐关录制（1-10关）**：
   ```bash
   node scripts/internal/run-auto.mjs --record --start 1 --end 10
   ```
3. **验证视频文件合规性**：
   ```bash
   node scripts/internal/verify-recordings.mjs
   ```
