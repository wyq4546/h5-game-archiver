# AI Agent Instructions & Project Guidelines

Welcome to `h5-game-archiver`!

## 核心指导规范（双层阅读标准）

本项目面向多种类型（物理滚球、通道堆叠跑酷、休闲益智等）的 H5/WebGL 游戏，所有 AI 助手（Antigravity、Claude Code、Cursor、Windsurf 等）接手开发或排查问题时，**必须遵循以下双层规范**：

### 1. 全局工程权威指南（第一步必读）
👉 **[H5 游戏自动化与逐关录制工程指导规范](docs/H5_GAME_AUTOMATION_AND_RECORDING_GUIDE.md)**
- **规范所有游戏的通用基线**：反编译产物查看路径（`analysis/il2cpp/`、`dump.cs`、`script.json`、`bot/runtime.mjs`）、WASM 真实方法反编译命令（`node src/wasm-function.mjs`）、`script.json` 缺失时的重建命令（`npm run method-map -- download/[游戏目录名]`）、纯原生物理交互铁律、自动化脚本架构、Chromium GPU 硬件加速基线、逐绘制帧无损录制（无参 `canvas.captureStream()`）、NVENC 硬件极速转码（2 秒成片导出）以及 Unity WebGL 指针复用等通用避坑。

### 2. 单游戏专属工程指南（开发具体游戏时必读）
进入特定游戏目录后，**必须查阅该游戏专属的权威说明文档**，以完全掌握该游戏的具体反编译机制、物理特性与专有策略算法：
- **Going Balls 滚球跑酷**：👉 **[`download/Going-Balls-20260913-001200/GAME_GUIDE.md`](download/Going-Balls-20260913-001200/GAME_GUIDE.md)**  
  （包含 WASM 滑动力注入、A* 跑道中线钥匙/金币动态磁吸、高空滑轨冲量飞天、90° 复合大弯累计偏角与离心力防撞墙等算法细节）
- **Merge Rush 2048 双人对称间距跑酷**：👉 **[`download/Merge-Rush-2048-20260927-113252/GAME_GUIDE.md`](download/Merge-Rush-2048-20260927-113252/GAME_GUIDE.md)**  
  （包含 LayaAir 3D 混淆还原、双人对称半间距规划、原生 1080P MSAA + 16x 各向异性超清渲染、WebGL 3D 粒子 Shader 与音效录制前预热防首关 183ms 卡顿、拟人平滑拖拽限速防 1 帧瞬移等细节）
- **Count Masters 小兵爱打架人群倍增跑酷**：👉 **[`download/Count-Masters-20260928-175220/GAME_GUIDE.md`](download/Count-Masters-20260928-175220/GAME_GUIDE.md)**  
  （包含 LayaAir 3D 十六进制混淆还原、3D 世界矩阵 `transformCoordinate` 精确碰撞体包络提取、旋转横杆切面交点计算、双侧倍增门防外沿擦碰与问答门动态识别、`Fx_baoshi` 死亡粒子泄漏修复及 `_noShowCount` 可视编队分帧池化等细节）
- **Join Blob Clash 史莱姆人群乱斗跑酷**：👉 **[`download/Join-Blob-Clash-20260929-164518/GAME_GUIDE.md`](download/Join-Blob-Clash-20260929-164518/GAME_GUIDE.md)**  
  （包含 170+ 人群三相交错骨骼更新 60 FPS 满帧突破、关卡级物理独立浏览器进程生命周期隔离防断流、活跃 3D 渲染录制握手、`View_Trial`/`View_OverAdd` 弹窗底层穿透拦截、终点巨物擂台拟人连击与 1~100 关全量超清无损录制导出）
- **Twisted Tangle 绳索解谜（Unity 6 / metadata v31）**：👉 **[`download/Twisted-Tangle-20261022-045250/GAME_GUIDE.md`](download/Twisted-Tangle-20261022-045250/GAME_GUIDE.md)**  
  （包含 Unity 6 把 IL2CPP 注册表与类型表常量折叠后的产物降级判定、`npm run method-map` 从 `Il2CppCodeGenModule` 重建 `script.json` 的 99.96% 方法映射、`Il2CppMethodDefinition` 36 字节步长、字段偏移占位值不可信警告、Obi Rope 物理与 `MapFinishChecker`/`CutController` 真实逻辑）
- **Teeth Runner 刷牙跑酷（PlayCanvas，可读源码）**：👉 **[`download/Teeth-Runner-20261022-051713/GAME_GUIDE.md`](download/Teeth-Runner-20261022-051713/GAME_GUIDE.md)**  
  （包含 `npm run playcanvas` 把 `__game-scripts.js` 切成 98 个原始脚本并建 91 个 `pc.createScript` 注册表、`compressedFormat` 场景字段名解码规则、28 个场景实体树还原、`proceduralLevelGenerator` 概率参数与 `playerController`/`speedController`/`feverController` 关键属性）
- **Emoji Puzzle 连线配对（Unity 2022.3 / metadata v29，反编译完整成功的样例）**：👉 **[`download/Emoji-Puzzle-20261022-053832/GAME_GUIDE.md`](download/Emoji-Puzzle-20261022-053832/GAME_GUIDE.md)**  
  （包含 4532 类型 / 54797 方法全量 dump、`DummyDll` + `il2cpp.h` + 带地址的 `stringliteral.json` 齐备、`LevelManager$GetFieldSet` 按 emoji 列数选 `Set3_3`/`Set4_4`/`Set5_5` 盘面、`Check` 的连线配对胜负判定、`InputController.OnTouch` 输入契约，以及「dumper 必须参数化后台运行、不要开窗口等按键」的执行范式）
- **Gem Stack 宝石堆叠跑酷**：👉 [`download/Gem-Stack-20261027-031238/GAME_GUIDE.md`](download/Gem-Stack-20261027-031238/GAME_GUIDE.md)  
  （包含 LayaAir 3D 混淆还原、相机 180° Y 轴旋转导致 -X 为右的屏幕坐标反转、小手 Z=-0.0284 物理偏移量补偿、时空切片顺序跟踪 Sequential Target Tracking 解决首颗原石漏吃、粗胚磨床缩放对调预热消除 85ms 冻结、染色门视锥中心 (0, 0.03, 0.1) 预热消除 54.8ms 卡顿、以及 `Laya.SubMeshRenderElement.enableDynamicBatch = false` 彻底根除收集 4 颗宝石触发 GPU_INSTANCE 动态合批卡顿等细节，1~10 关首尝 100% 通过与 CFR 60 FPS 交付）
- **Monster Evolution Run 怪兽进化跑酷**：👉 [`download/Monster-Evolution-Run-20261028-152411/GAME_GUIDE.md`](download/Monster-Evolution-Run-20261028-152411/GAME_GUIDE.md)  
  （包含 LayaAir 3D 十六进制混淆还原、40 套原生地图模 41 无限循环架构、3D 相机 72° 广角透视补偿与 `enableDynamicBatch = false` 消除 GPU 尖峰、转弯圆弧轨迹预测与跨弯目标投影、动态障碍物 3D OBB 包络精确计算、强敌变道穿越排斥、跳板/终点智能回中、0ms 秒级断点续录与全套标准脚本配备）
- **Swords Maker 铸剑跑酷 + 终点对砍**：👉 [`download/Swords-Maker-20261104-095255/GAME_GUIDE.md`](download/Swords-Maker-20261104-095255/GAME_GUIDE.md)  
  （包含 `npm run laya` 的 LayaAir 混淆还原四规则（`regClass` 原始类名 / 基类去 UI 后缀 / 特征命名 / 命名空间枚举）、62 个类与 10 份 UI 树导出、四道铸剑工序 `STATE_1→5` 与终点双门各 8 格上限、PK 双方血量/伤害/攻击间隔公式，以及 15 张关卡布局循环与 `1000.bundle` 私有包头解析）
- **其他游戏**：请查阅各游戏目录下的 `GAME_GUIDE.md` 或 `scripts/AUTOMATION.md`。

---

### 核心铁律概览

**录像目录强制要求**：所有游戏的视频只能录制并保存在各自的 `download/[游戏名]/scripts/video/` 下，批次子目录也必须位于其中。**video 整个目录树只放视频；报告、日志、JSON、存档、源码快照及其他非视频文件统一放在 `scripts/recording-data/[同名录制批次]/`，临时探针与调试截图放在 `scripts/.tmp/`。**首次录制、重录、续录、测试录像及原始/转码视频均适用；`--output`、`--resume` 不得指向视频目录外。录制/续录/验收器须分别读写视频与辅助数据目录。旧录像清理受阻也不得擅自改用其他目录。完整要求见[全局指南的文件命名与生命周期](docs/H5_GAME_AUTOMATION_AND_RECORDING_GUIDE.md)。
1. **实战第一、日志驱动**：严禁编写脱离 WebGL 物理环境的离线虚拟单测。以关卡实际运行日志中的 `实测页面刷新 FPS`（$\ge 59.5$）、一次通过率与成片质量为唯一依据。
2. **纯物理拟人控制**：绝不通过内存瞬移修改坐标、不锁血、不破坏原生碰撞。
3. **GPU 硬件加速基线**：无头 Chromium 必须注入 `--ignore-gpu-blocklist`、`--enable-gpu-rasterization`、`--enable-zero-copy`。
4. **时钟绝对对齐**：必须使用无参 `canvas.captureStream()`（`captureEveryFrame: true`），严禁使用定时器盲采。
   **无卡顿交付强制要求**：必须执行[全局指南第三章铁律 6](docs/H5_GAME_AUTOMATION_AND_RECORDING_GUIDE.md#铁律-6编码器冷启动预热与实际画面连续性验收开头卡顿零放行)：验证编码冷启动预热效果，逐关检查开头 0～2 秒并扫描全片连续性；任何可见的非原生停顿必须修复、重录并重新验收后才能交付。平均 FPS 达标、MP4 标称 60 FPS 或完整解码通过均不能代替此项。
5. **极速转码解耦**：游戏本体保 60 FPS 锁帧，1080P 由 GPU NVENC 硬件芯片极速压制（2 秒完成导出）或离线高质量 Lanczos 导出。
6. **专属指南强制维护铁律**：为任何游戏编写或扩展自动化脚本时，必须第一时间创建并持续维护该游戏的 `download/[游戏名]/GAME_GUIDE.md`；攻克特定游戏机制后必须实时沉淀，未编写/未同步更新专属指南的代码视为未完成交付。
7. **缺失数据补拉与拉取代码同步优化铁律**：运行自动化脚本时若发现游戏数据/资源有缺失（404 或加载报错），必须立即拉取补齐当前游戏缺失内容（`scripts/add-archive-resources.mjs`），同时溯源漏抓原因并同步优化通用拉取与依赖补全代码（`src/asset-completer.mjs` / `src/capture.mjs`）。
8. **临时测试文件固定目录与用完即删铁律**：所有临时探针脚本（`probe-*.mjs`、`test-*.mjs`、`inspect-*.mjs`、`check-*.mjs`）与调试截图必须统一创建在 `download/[游戏名]/scripts/.tmp/`（或根目录 `.tmp/`）下，严禁污染 `scripts/internal/`；问题解决并沉淀至 `GAME_GUIDE.md` 后必须立即删除，严防项目臃肿。
9. **百关自动化长程实战验证与持续无限录制设计铁律**：
   - **AI 交付验收基线（跑 100 关）**：为每个游戏编写或调整自动化脚本时，AI 助手**必须完整跑通并录制第 1 至 100 关（或全量关卡）作为质量交付底线**。长程执行过程中必须实时监测遥测日志、帧率刷新（$\ge 59.5$ FPS）、切片断流、页面错误及通关成功率；一旦中途出现卡死、掉帧、媒体管道异常（如 `Chunks=0`）、漏门或碰撞失效，必须立即中断或利用断点续录机制，深入反编译文件/源码定位根因、修复脚本逻辑与关卡策略，并重新/继续录制直到 1-100 关全部无损清关交付。
   - **面向用户的日常脚本设计（默认持续无限运行）**：交付给用户日常使用的自动化与录制脚本（如 `record-auto.cmd`、`play-auto.cmd`、`run-auto.mjs` 等），**必须设计为默认持续无限运行模式——只要用户不按 Ctrl+C 或不主动暂停，就一直一关接一关录制/游玩下去（101, 102, 103... 循环推进），严禁在脚本中硬编码跑完 100 关就强制终止退出！** 关卡数量限制（如 `--end <N>`、`--levels <N>`）仅作为可选的调试参数，缺省或输入 0 时必须无限制持续运行。
10. **手机移动端（Mobile 9:16）原生布局与真机模拟强制铁律**：所有竖屏游戏的自动化脚本与录制，**必须强制以真实手机移动端（Mobile 9:16 Portrait）打开的布局为唯一验收基线，严禁使用电脑桌面端（PC）布局或宽屏视口！** 同一个游戏在电脑打开与手机打开时布局经常不同（PC 端常附带桌面外壳、横屏 iframe、宽屏视锥甚至不同 UI），录制必须完全还原玩家在智能手机上全屏运行的原生体验。必须满足：
    - **真机环境参数模拟（Mobile Emulation）**：Playwright 启动页面时必须显式配置 `isMobile: true`、`hasTouch: true` 与真实移动端 `userAgent`（如 Pixel/iPhone），使 `Browser.onMobile`、`navigator.maxTouchPoints` 等引擎环境探测 100% 命中移动端；
    - **绕过 PC 网页包装**：必须直达游戏内部原生移动入口（`index.html`），严禁加载包含 PC 侧边栏、评分框、桌面包装脚本（如 `game_pc-*.js`）的聚合站 PC 页面；
    - **舞台自适应数学对齐**：对于 LayaAir 等引擎，设计分辨率必须对齐为严格 9:16（如 $750 \times 1333.333$ 或 $1080 \times 1920$），配合 `scaleMode = 'showall'`，使视口 $1080 \times 1920$ 下缩放比为精确且均匀的 $1.44$，生成 0 像素黑边、0 像素形变的物理原生 $1080 \times 1920$ WebGL 绘图缓冲；
    - **3D 广角透视补偿（Panoramic FOV）**：竖屏模式下相机垂直 FOV 往往导致水平视锥过窄、画面像被局部截取裁切（感觉赛道拥挤、两侧水域/背景丢失）。必须在进关后动态补偿相机视野（将 FOV 适当拓宽至 $70^\circ \sim 75^\circ$），还原全景开阔视角；
    - **极致纯净实机画面**：彻底清除/隐藏教学手势图标（`ctrhint` 手指/左右箭头）、常驻暂停按钮（`pauseBtn`）、调试信息及外部广告/Banner，确保录制出的画面为极致纯净、无任何杂质的殿堂级实机演示。
11. **目录结构与脚本存放绝对隔离铁律（游戏根目录 vs scripts 边界固定死）**：
    所有游戏的目录结构必须强制遵循双层隔离规范，**严防脚本错放与根目录污染**：
    - **游戏根目录（`download/[游戏名]/`）的绝对边界**：
      - **标准内容**：子目录仅允许 `analysis/`、`archive/`、`game/`、`preview/`、`scripts/`；文件仅允许 `GAME_GUIDE.md`、`index.html`、`README.txt`、`start.cmd`、`stop.cmd`。
      - **根目录严格禁令**：**根目录下的 `.cmd` 脚本只能且必须仅有 `start.cmd` 与 `stop.cmd`（本地 Web 回放服务启动与停止）**！**严禁将 `play-auto.cmd`、`record-auto.cmd`、`record-from-level.cmd`、`verify-recordings.cmd` 等任何自动化脚本放在游戏根目录**；严禁在根目录散落任何临时探针（`*.mjs`、`*.cjs`）、运行日志（`*.log`）、根目录 `.tmp/` 或调试图片目录（`debug-images/`）。
    - **自动化目录（`download/[游戏名]/scripts/`）的绝对边界**：
      - **自动化入口唯一收敛处**：所有日常使用的自动化控制脚本必须统一位于 `scripts/` 下，标准配备包括：
        - `play-auto.cmd`（纯物理拟人游玩，不录像）
        - `record-auto.cmd`（持续无限制 1080P/60FPS 逐关无损录制）
        - `record-from-level.cmd`（指定起始关卡录制）
        - `verify-recordings.cmd`（若具备质检模块，成片画质与无卡顿验收）
      - **工作目录强制对齐**：所有 `scripts/` 下的 `.cmd` 脚本，首部必须使用 `cd /d "%~dp0.."` 显式切至游戏根目录，再调用 `node scripts/internal/...`，确保无论从何处双击或调用，工作目录解析 100% 绝对一致；
      - **Windows 批处理编码铁律**：所有 `.cmd` 文件必须强制使用 CRLF（`\r\n`）换行，首部声明 `@echo off`、`setlocal` 与 `chcp 65001 >nul`，杜绝 GBK 控制台下的换行与中文解析异常；
      - **内部目录各司其职**：核心源码入 `internal/`，成片视频**唯一**入 `video/`，报告与快照**唯一**入 `recording-data/`，临时探针入 `.tmp/` 且用完即删。
12. **自动化编写前反编译产物完整性前置校验与缺漏补解铁律（严禁盲写脚本）**：
    在为任何游戏编写、重构或调优自动化策略脚本（`scripts/internal/` 下的 `run-auto.mjs`、`play-auto.mjs`、`adapter.mjs`、`strategy.mjs` 等）之前，**第一步必须强制核查该游戏的 `analysis/` 目录及反编译产物是否完整且就绪，严禁在没有反编译证据的情况下凭空盲猜类名、属性名或乱试注入点**：
    - **完整性硬性门槛**：
      - **Unity WebGL**：必须存在 `analysis/report.json`、`analysis/unity-data/`（含解包文件与 `global-metadata.dat`）、`analysis/wasm/*.wasm`、`analysis/il2cpp/dump.cs`、`analysis/il2cpp/script.json`，以及 `analysis/bot/runtime.mjs` / `context.json`；
      - **Cocos / LayaAir / Construct / 其他 JS 引擎**：必须存在 `analysis/report.json`、`analysis/source-index.json`（已建立符号表与作用域）及 `scripts/automation-context.json`，且已提取出有效核心业务文本源码；
    - **不完整时的强制动作（先解析、后编码）**：
      - 若 `analysis/` 为空、不存在或核心产物缺失（即 Web 管理后台显示为“未解析 等待源码解析”），**必须在写任何脚本前先触发反编译与源码解析流水线**：
        1. 本地 Web 管理后台对该游戏点击 **「开始解析」**（`POST /api/archives/:name/analyze`），等待后台全自动完成数据包解包、引擎识别、符号提取与 IL2CPP/BotKit 骨架生成；
        2. 如遇 Unity 函数体需要深度还原，调用 `npm run cpp2il` 产出完整 C# DLL 程序集；如遇复杂前端混淆，调用 `npm run restringer` 沙箱解密；
    - **Unity 6 / metadata v31「产物齐全但已降级」的判定与恢复（严禁把降级产物当真）**：
      - **判定信号**：`analysis/il2cpp/dump.cs` 中字段与返回值**全部是 `object`**、方法头全是 `RVA: -1 Offset: -1`、字段偏移是 `0x10/0x14/0x18` 顺序占位值；`analysis/il2cpp/script.json` 缺失；`analysis-summary.json` 的 `validation.status` 为 `degraded`。
      - **成因（构建特性，不是解析没跑）**：Unity 6 的 WebGL 构建会把 `Il2CppCodeRegistration`、`Il2CppMetadataRegistration` 与 `Il2CppType` 表常量折叠，静态镜像里没有类型表，因此 Il2CppDumper 在写出 `script.json` / `il2cpp.h` / `DummyDll` 之前就中断，Cpp2IL 也会报 `Failed to find code registration or metadata registration!`。**不要反复重跑解析或 `npm run cpp2il` 空转**，先按下面的恢复动作处理。
      - **恢复动作**：执行 `npm run method-map -- download/[游戏目录名]`，从仍存在的 `Il2CppCodeGenModule` 重建 `script.json`（方法名 → wasm 函数表索引，已实测 Twisted Tangle 覆盖 90787/90824），再用 `writeBotKit` 重新生成 `analysis/bot/`，随后即可用 `node src/wasm-function.mjs ... --decompile` 读真实方法体。
      - **使用边界**：该方法只恢复方法映射，**字段类型、方法签名、真实字段偏移依然不可得**。此时自动化一律走原生触控输入，禁止按 `dump.cs` 的占位偏移读写内存；`wasm-function.mjs` 的字段名注解只能当线索，真机读写前必须实测偏移。
    - **只有当反编译产物完全就绪，并且已对照 `GAME_GUIDE.md` / `automation-context.json` 确认了真实业务类、字段偏移、方法签名和状态机后，才允许正式动手编写或修改自动化控制脚本**。
