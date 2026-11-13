# H5 游戏自动化与逐关录制工程指导规范 (Engineering Guide)

<a id="decompilation-correctness-gate"></a>

## 最高优先级规则：先验证反编译文件正确，再编写自动化脚本

**这是所有游戏自动化开发的首要前置条件。编写、重构、调优或修复自动化控制脚本之前，必须先验证当前游戏的反编译产物完整、正确，并与实际运行的游戏构建一致。未通过验证，先补解或修复解析链路，通过后才允许编写或修改控制策略。** 此顺序适用于正式脚本、临时策略探针、续录修复及其他游戏的脚本移植，不能因赶进度、已有旧脚本或历史通关记录而跳过。

按以下顺序完成检查：

1. **确认来源与版本**：确认真实游戏入口、引擎及构建版本；核对原始发布资源、当前运行资源与分析输入的 SHA256。Unity 必须核对 WASM、DATA、解包 metadata 的配对；其他引擎核对实际加载的业务脚本、资源包及对应解析产物。跨版本、跨机器复制的旧产物须重新核验。
2. **验证产物内容**：按第一章第 8 节核查所需文件，并读取实际解析日志、`analysis/report.json` 与引擎专属分析摘要。Unity 要将类型、字段和方法映射与 metadata、真实 WASM 函数表交叉核对，确认业务类可用；JS 引擎要确认核心业务源码已有效提取或解混淆，符号索引指向当前源码。文件存在、体积大、退出码为 0、非零方法计数或助手声称完成，均不能单独证明正确。**Unity 6 / metadata v31 的 WebGL 构建会把 IL2CPP 注册表与类型表常量折叠，出现「字段与返回值全是 `object`、方法头全是 `RVA: -1`、字段偏移是 `0x10/0x14/0x18` 顺序占位值」的降级产物时一律视为未通过**，必须先按第二章重建 `script.json`，并把字段偏移标注为不可信。
3. **核实本次策略依赖**：逐项确认将要使用的业务类、字段类型与偏移、方法签名与真实实现、状态机、原生输入及结算流程。Unity 使用 `node src/wasm-function.mjs` 核验相关真实方法体和 WASM ABI；JS 引擎追到实际事件处理和调用链。`dump.cs` 空方法体、静态恢复骨架、泛型零占位及历史指南必须标明能力边界，不能代替所用方法的真实逻辑证据。
4. **检查失败并先修解析**：产物缺失、只含程序集头、映射为空、Dumper 搜索或初始化失败、输入哈希不匹配，以及源码与运行状态不符，均判为前置检查未通过。先执行标准「开始解析」流水线；仍失败则依据实际解析器源码和原始构建定位原因、修复并重建产物。通用解析器修改还须回归此前依赖它的构建；不能靠猜类名、字段、偏移或反复试注入点绕过失败。
5. **只读实机交叉验证**：用原生页面和只读观察确认解析出的对象、字段、状态及输入路径与实际运行一致。前置检查可使用只读解析/诊断探针；未验证前不能加入自动通关、自动移动或修改业务状态的控制代码。实机验证仍须遵守原生 DOM 输入、录制资源调度及用户当前的暂停/恢复指令。
6. **保存可复核结论**：在该游戏 `GAME_GUIDE.md` 记录检查时间、输入/产物/解析器版本或 SHA256、真实命令与日志、核验过的关键字段和方法、验证范围及未解决项；辅助证据放入 `scripts/recording-data/`，临时探针放入 `scripts/.tmp/`。仅当本次策略依赖的各项均通过且没有阻断项时，才开始控制脚本开发。相关游戏构建、解析器或依赖方法变化后，重新执行受影响的检查。

**固定执行顺序：阅读全局与单游戏指南 → 验证反编译正确性 → 补解/修复并复核 → 编写自动化 → 原生实战与逐片验收。** 本规则作为本文所有自动化流程的先决条件；后文的便捷示例、历史方案或“先跑一关”步骤均须在通过此前置检查后执行。

> **核心指导规范（双层阅读标准）**：  
> 本项目面向多种类型（物理滚球、双滚筒跑酷、通道堆叠、障碍贪吃蛇、休闲工艺等）的 H5/WebGL 游戏。  
> 无论是人类工程师还是任何 AI 助手（Antigravity、Claude Code、Cursor、Windsurf 等），接手开发或排查问题时，**必须严格遵循以下两步流程**：  
> 
> * **第一步（必读全局规范）**：阅读本文档，掌握全局工程架构、Unity / LayaAir / Construct / Cocos 引擎逆向路径、自动化架构与录屏/NVENC 转码基线；  
> * **第二步（必读单游戏指南）**：进入具体游戏目录后，**必读其目录下的专属 `GAME_GUIDE.md`**（如 `download/[游戏名]/GAME_GUIDE.md`），获取该游戏专属的逆向结论、物理动力学、专有避障算法与实操指令。

### 新游戏接手顺序与经验适用边界

逆向与调试工具的当前入口以 [`package.json`](../package.json) 的 scripts 为准：Unity 方法核验使用 `node src/wasm-function.mjs`，JS 解混淆使用 `deobfuscate` / `restringer`，Construct 事件解码使用 `construct`。工具产物须按文首正确性规则核验；调试采样的开销与正式实机验收分开记录。

先确认真实游戏身份、引擎、原生入口和关卡范围，并通过[反编译正确性前置检查](#decompilation-correctness-gate)，再建立第四章的「原生行为契约」，随后按玩法选择第五章的策略。不要从别的游戏复制一组阈值就直接开始百关录制。

| 当前问题 / 玩法 | 优先阅读 |
| --- | --- |
| 加载失败、SDK 包、后续地图资源缺失 | 第一章第 4 节；第五章第 10～12、14、22 节 |
| 跑酷、队列、双选门、周期机关 | 第五章第 3～4、9、13、15～18 节 |
| 滑动迷宫、涂色覆盖 | 第二章分支 C；第五章第 19 节 |
| 泡泡龙、离散发射、随机棋盘 | 第二章分支 D；第五章第 20 节 |
| 漏奖励、假胜利、切关错号、跨关污染 | 第四章；第五章第 5、14、18、21 节 |
| 首次卡顿、录错画布、无声或断流 | 第三章；第五章第 7～8 节 |
| 队列漏加工、双选门擦边、重录版本混用 | 第五章第 23 节的 Coffee Stack 实战检查表，再查第 13、16 节 |
| Unity 6 桥接失败、运行中生成障碍、终点移动目标射击 | 第二章分支 A；第五章第 26 节；第四章的录像版本与进度链 |

**经验分为三类**：跨游戏不变量写入本文；输入换算、周期、速度、阈值与特定补丁留在单游戏指南；历史失败方案保留原因与替代方案。数值必须标明单位、适用模式和实测版本。旧脚本中修改速度/重力、改地图、跳过伤害或伪造奖励的做法，不能因曾经通关就成为纯原生自动化模板。用户明确授权的特殊模式需单独标记，不能与原版实玩验收混用。

2026-10-02 已逐份审阅 `download/` 下 24 份 `GAME_GUIDE.md`，并核对 20 份 `scripts/AUTOMATION.md` 与另外 4 款游戏的 `scripts/使用说明.txt`。该记录列出文档中的依据与验证范围，不代表本次重新运行过这些游戏。单游戏来源指南索引、历史冲突与合并原则详见下文：

#### 单游戏经验来源索引与适用边界

审阅日期：2026-10-02。范围：当前 `download/` 下 24 份 `GAME_GUIDE.md`、20 份 `scripts/AUTOMATION.md`，以及 Barrel Roller、Color Snake、Nail Stack、Potato Rush 的 4 份 `scripts/使用说明.txt`。本次为文档审阅，未重新运行游戏或审计历史视频；下述实测结果均为来源指南的记载。

本文件用于查找机制证据与历史边界，通用执行规则以[全局工程指南](H5_GAME_AUTOMATION_AND_RECORDING_GUIDE.md)为准。后续开发先读全局契约，再阅读目标游戏的当前推荐入口、原生机制与对应日志；不要把此表中的经验当作可直接复制的参数集。

后续新增案例：[Coffee Stack 归档与自动化指南](../download/Coffee-Stack-20261002-060813/GAME_GUIDE.md)（2026-10-02）。实际为 LayaAir 3D；`libs/min/` 漏识别与 SDK 多引擎文字造成误判。通用检测改为实际路径证据优先、按引擎区分核心文件要求。新自动化沉淀了前向杯队列、加工口真实 offset、接物中心误差与整列加工锁、追踪手归位与斧头落下包络、SDK `DEV_` 持久化桶、`SDKEnvImage._skin` 标识清理、独立 WebGL draw 帧计数、按词法绑定与哈希锁定的引擎固定字符串展开，以及通过所属浏览器 CDP 限定 PID 的 Windows 调度优化；完整采集窗口实测引擎平均帧耗时减少 66.4%，硬件采集以 NVML 活跃会话核验。最终组合 1–100 关全部首尝原生通关、完整音视频解码通过、最低实际绘制 60.0036 FPS，原生下一关为 101；见 百关验收与录像（历史批次文件已不在当前目录）。旧居中批次 52 关及中间调试批次仅保留诊断日志。它不计入上方原始 24 份指南的审阅统计。

随后牛奶修订发现：`milk` 是含两个 Box 出奶口的 Compound，顶层 Box 检测会把机器从路线候选删除；升级门自动注液也会掩盖漏接。已递归合成子形状变换、对未知加工形状报错，并用实际首站位置匹配原生加工触发；第 7/10/17 张地图的开局六杯均已实际录制接奶通过。首站不能固定为 `Z<60`，地图 3 在 Z=68。新版已在独立目录完成百关原生通关与全部音视频完整解码，95 个牛奶关卡首站均通过，最低源绘制 59.8578 FPS，下一关为 101；102 次记录中保留两次首站验收误判，修正后重录，不称为全首尝通过。见 历史牛奶修订版百关验收（历史批次文件已不在当前目录）；故障与对照见 [牛奶回归报告](../download/Coffee-Stack-20261002-060813/scripts/logs/milk-routing-verification.md)。

升级门路线追加修订：宽门零成本平台与缺少居中锁造成中间擦边；长队列固定提前量又不足以横移并传播到前端。现按实际门收益锁定中线，并依据原生前进、输入限速/加速度及队列跟随延迟，将危险出售通道提前交接到成对升级门。逐杯读取触发前后等级，版本哈希禁止混入旧录像。真实第 10 关六杯门居中、第 7 关长队列 15 杯升级已回归；第 7 张地图首门世界 X=+2.7 才是画面左侧，不能按坐标符号命名屏幕方向。独立 `scripts/video/validation-gates-rerecord-20261002` 百关已全部新录并完整解码通过，完整证据见 [升级门修订记录](../download/Coffee-Stack-20261002-060813/scripts/logs/upgrade-door-fix-verification.md)。

当前 Coffee Stack 百关新录证据：新版升级门修订版已于 2026/10/2 16:06:46（北京时间）从第 1 关重新录完并完成全部音视频解码。100 次首次原生通关，下一关存档 101；95/95 个牛奶关卡首站实际触发。第 7 张地图画面左侧首门六杯及第二门长队列、第 10 张地图首门六杯的原生升级和最大中线偏移 ≤0.15，分别通过 5/5 次循环回归。最低源绘制 59.8715 FPS，最低录制刷新 59.9 FPS；100 段均为 1080×1920、60 FPS、H.264/yuv420p、AAC 有效原声音轨，总时长 4419.23 秒，共 9332508684 字节。实际升级 2424 次、Sell 出售 9 次；验收不代表全加工、全拾取、零出售或零碰撞。全部片段新录，策略/适配器版本匹配，未复用旧批次；12 项源码哈希与逐关证据随报告保存。 见 [本次验收与录像](../download/Coffee-Stack-20261002-060813/scripts/video/validation-gates-rerecord-20261002/verification-1-100.md)。此前旧录像删除受执行策略拦截；本次核对时旧批次目录已不在磁盘；本批未复用旧片段。

2026-10-03 新增 [Man Runner 2048](../download/Man-Runner-2048-20261003-095019/GAME_GUIDE.md)：Unity 6/metadata v31；从旧分析的 0 个业务类恢复出 376 个项目类，恢复常量绑定原始 WASM/metadata 哈希。实战经验归入全局第二章分支 A、第四章录像版本与进度链、第五章第 21、22、26 节；不计入原始 24 份指南的审阅统计。

该游戏原生第 1～100 关已逐片验收，100 段全部完整解码并验证原声，最低平均源绘制 59.838 FPS；每关实际射击有同一目标掉血或原生死亡证据，真实进度到第 101 关。批次保留多个实际录制源码版本，修复后从真实第 39 关存档重跑后续；最终脚本另以新存档回归第 1～2 关，未录制。这里的百关成片覆盖不能等同于最终同一版本的完整百关回归。证据见[逐片验收](../download/Man-Runner-2048-20261003-095019/scripts/video/recording-2026-10-03T03-16-00-827Z/verification.json)及专属指南中的 `report.json`、源码/进度快照与回归记录。

##### 逐游戏机制沉淀与界限

表中的章节均指全局工程指南。每个来源链接指向游戏权威指南，运行入口另见同目录 `scripts/AUTOMATION.md` 或 `scripts/使用说明.txt`。

| 来源游戏 | 值得复用的机制与排障方法 | 适用边界 / 归入位置 |
| --- | --- | --- |
| [Man Runner 2048（后续新增）](../download/Man-Runner-2048-20261003-095019/GAME_GUIDE.md) | Unity 6 指针/结构体返回 ABI；激活对象与新增对象分别发现；成长碰撞体与动态危险群组；负收益门真实运算；录制起跑相位；发射延迟与目标运动预测；实际掉血验收；源码快照与连续原生存档链 | 30 张地图不等于 30 关；扫描周期、群组距离、瞄准增益、弹速与延迟均为该构建参数。百关成片含多个实际版本，最终脚本新存档回归仅 1～2 关。第二章 A；第一章 6；第四章批次版本；第五章 21、22、26 |
| [Coffee Stack（后续新增）](../download/Coffee-Stack-20261002-060813/GAME_GUIDE.md) | Box/Compound 子形状完整变换；加工生效与中线对齐分开；升级门整列锁；横移/跟随时间预算；验收误判分类；续录版本匹配及迁移前后视频哈希核验 | 5/28 控制限值、逐帧跟随和门偏移阈值属于本地参数；当前百关通过不代表零出售或最高分。第四章批次版本；第五章 13、16、23。仍不计入原始 24 份审阅统计 |
| [Barrel Roller](../download/Barrel-Roller-20260828-185000/GAME_GUIDE.md) | 持续 LeanTouch finger 才能保持原生间距；双滚筒按同一个真实控制自由度规划；根据堆叠对象与 Layer/Tag 读真实支撑和收集条件 | 不把双主体当两个独立车道；旧 30 FPS 指令不可沿用。第四章；第五章 15～16 |
| [Battery Run 3D](../download/Battery-Run-3D-20260910-051700/GAME_GUIDE.md) | 头部拖拽与尾部历史跟随形成完整占用；早对齐真实充电接触；可见翻板与已失效 collider 的风险分别识别 | 输入增益、跟随深度、最大持有/充电阈值需本地标定。第五章 13、15～16、21 |
| [Bubble Shooter Classic Pop](../download/Bubble-Shooter-Classic-Pop-20261001-142030/GAME_GUIDE.md) | Cocos 模块还原；真实触摸预览/发射/attach 审计；稀疏行宽、六角错列、反射、独立 RNG；每弹比较预测与原生结果；分帧搜索 | 初始金币、道具与 90 秒上限是当时任务条件；有限 beam 不是最优性证明。第二章 D；第五章 20 |
| [Build A Queen](../download/Build-A-Queen-Christmas-Beauty-20260930-200244/GAME_GUIDE.md) | 压缩 bundle 先解压再反混淆；只读主玩家而非 AI；持续拖拽输入需原生复位才能归零 yaw；飞行/游泳模式切换；奖励区独立于普通胜利；服装 reparent 排除重复目标 | 不替换原生随机选图；实际现金/奖励触发与通关分开。全赛道、服装和入水效果预热。第二章 B；第三章；第五章 18、21 |
| [Cake Art 3D 归档：实际 Pancake Stack 3D](../download/Cake-Art-3D-20260914-034400/GAME_GUIDE.md) | 真实身份确认；路段方向独立于角色/相机滞后 yaw；先提取叶 collider 再过滤远近；高堆叠门洞净高；全身通过才释放锁；动态转子相位；批处理 Shader 变体预热 | 指南包含多轮历史参数；涉及原生路径/yaw 容差补丁不能一概称纯输入。第四章；第三章铁律 5；第五章 15、17～18 |
| [Color Maze Puzzle 2](../download/Color-Maze-Puzzle-2-20260923-044200/GAME_GUIDE.md) | Construct 布局/事件表；滑到底后才能接受下一方向；同时核对涂色计数、原生 WIN 与真实布局 | 已确认 L1～L40；L41 显示计数不是新地图证据。第二章 C；第五章 19、21 |
| [Color Maze Puzzle](../download/Color-Maze-Puzzle-20260923-044000/GAME_GUIDE.md) | 停点图边保存经过格，覆盖 bitset 搜索；先查滑动可覆盖性；实机定位 Solid 重叠与不能中途转向的目标 | 80 关批次中的 61/66 明确为布局修复版；改重力的慢球模式也是特定用户要求，不能作为原版不改物理的证据。第五章 19；第一章 2～3 |
| [Color Snake 3D Online](../download/Color-Snake-3D-Online-20260823-064700/GAME_GUIDE.md) | 变色后刷新同色可吃规则；主 `layaCanvas` 与更大的字体图集区分；音频真实活动验证 | 不按「最大 canvas」录制，不把所有方块当危险。第三章铁律 2 / 音频；第五章 16 |
| [Count Master Match Color Run](../download/Count-Master-Match-Color-Run-20260925-010943/GAME_GUIDE.md) | 分流时离散换位、合流时连续拖拽；两个原生换位标志都完成后再输入；按真正 rayCast 选中对象验证手势；模板/活波次区分；优先最近波次；算术门读操作与数值 | 固定慢换位旧方案已被后续推荐撤回；旧直接赋值/禁用 collider 辅助模式不作原生模板。1.5 倍是用户要求的离线导出。第五章 4、15～18、21 |
| [Count Masters](../download/Count-Masters-20260928-175220/GAME_GUIDE.md) | 世界矩阵变换完整碰撞包络；旋转横杆在角色平面求交；首个外侧士兵可能锁定坏门；问答组件异步生成；强制战斗阶段重建目标；粒子/群体热点剖析 | 指南百关记载均值 58.35、最低 55.55 FPS，未达到全局门槛；8 模板满帧回归不证明百关。隐藏成员必须核实玩法等价，不能替换原生随机地图。第三章；第五章 13～18 |
| [Going Balls](../download/Going-Balls-20260913-001200/GAME_GUIDE.md) | 真实 WASM 方法体/桥接签名；滑动冲量量化；路段弧长、支持面与多层道路；多尺度弯角与制动；合法等待/回退；整桥同步与分板错相；负寻路缓存失效 | 不把 worldZ 当前进量，不沿金币直线横跨缺口，不用错误 abort 壳推断逻辑；速度与阈值留本地，后续补丁按其实际回归范围报告。第二章 A；第五章 4、15～17、21 |
| [Hair Challenge Online](../download/Hair-Challenge-Online-20260909-092100/GAME_GUIDE.md) | 池化对象选择实际活组件/阶段；主骨骼致命与发尾损耗区分；高差/空中支持判断；只有原生允许的开局时机可等待 | 自动前进不能写速度停跑；固定开局延迟范围与掉落计时是游戏特定值。第五章 15～17 |
| [Join Blob Clash](../download/Join-Blob-Clash-20260929-164518/GAME_GUIDE.md) | Animator 成本实测与纯视觉后排分相更新；活跃 3D 绘制握手；页面重建与浏览器进程隔离分级；冲线后合体→拳击→Boss→胜利 | D3D11/OpenGL、分相人数和 40ms 连击是特定环境/机制；动画、真实成员与碰撞不等价的修改不可推广。第三章；第四章；第五章 18 |
| [Maze Paint 3D](../download/Maze-Paint-3D-20260923-044500/GAME_GUIDE.md) | Unity 格子/移动状态桥接；原生静止后输入；涂色与胜利双判据；相同字节在 localhost 黑屏时保留原始 URL 路由本地资源 | 50 关为已实测范围而非已证实上限；修改 playerSpeed 的模式不并入不改物理基线。第二章 A；第五章 19、22 |
| [Merge Rush 2048](../download/Merge-Rush-2048-20260927-113252/GAME_GUIDE.md) | 以对称半间距规划双角色；状态敏感的等值合成；非 trigger 的 collision 仍有效；消耗节点残留与真实数值更新区分；穿块保持与粒子预热 | 2048 不能按「大吃小」泛化；队列通过距离由实际包络求。第三章铁律 5；第五章 13、15～16、21 |
| [Nail Stack](../download/Nail-Stack-20260906-083100/GAME_GUIDE.md) | 指甲在手前方；前端加工与尾手通道衔接；碎片 prefab 排除；旋转 mesh 真实顶点半径；Unity 音频输出镜像；原生结算多次递增 | 回合号、原生关卡与视频号分别记录；音频按身份/调用链分类，长音频不自动等于 BGM。第三章音频；第五章 13、15、21 |
| [Noodle Stack Runner](../download/Noodle-Stack-Runner-20261001-010716/GAME_GUIDE.md) | YYG v3 物理包/虚拟路径；配置别名与动态依赖；完整子节点 ready；队列全体加工；高关试用候选集合修复；真实 SDK checkpoint；空白页节拍对照；Worker 边界 | 普通插屏与奖励广告严格区分；1px 环境节拍不能作视频/FPS证据；指南记录的全部通关不代表全部碗收集。第一章 4；第三章；第五章 12～14、21～22 |
| [Number Master Run And Merge](../download/Number-Master-Run-And-Merge-20260928-222712/GAME_GUIDE.md) | Laya 2D 图集/基址依赖；异步地图解包；射击到达前数值翻正预测；全路径扫掠与逃离危险方向；门后走廊联合收益；同一结算 UI 的胜负参数；粒子/shape 生命周期 | 门锁评分尺度不能照搬；弹道预测需由真实命中校正；只缓存位数会漏真实 shape 变化。第五章 7～10、14、16、18、21 |
| [Potato Rush](../download/Potato-Rush-20260906-023900/GAME_GUIDE.md) | Raw→Peeled→Chopped→Fried→Packed 原生阶段；先收集再回加工门需两个可达时间预算；加工完成按整个活队列判定 | 旧减前进速度做法不作为纯原生策略；旧路径/30 FPS 命令需核对当前入口。第五章 13、16 |
| [Rubber Ball 3D](../download/Rubber-Ball-3D-20260911-051000/GAME_GUIDE.md) | 原生横屏；最近威胁优先，避免对称势场抵消；按真实球心高度算碰撞；击退恢复；拾取后读等级改变可战斗对象；同模板后期难度变化 | 保持横屏不强改 9:16；贴地 `2√(r1r2)` 与同高 `r1+r2` 有不同前提，按实际三维距离统一。第五章 15～16、18、21 |
| [Snake Run Race](../download/Snake-Run-Race-20260929-231315/GAME_GUIDE.md) | 原生摇杆使横/纵速耦合；周期机关完整占用窗口；骨骼 RigidBody 与双方 mask；洞 trigger 提前移路；合法桥梁搬运；原生事件保留与 FairyGUI/Timeline 清理 | 68 个真实配置即有限终点；仅验证头部安全不能宣称尾部全部无碰撞；进程消失不构成根因证明。第五章 5、15～18、21 |
| [Spiral Roll](../download/Spiral-Roll-20260924-192735/GAME_GUIDE.md) | 按下卷木/抬起原生抬刀与发射；当前木卷、飞行卷和后续墙的资源预算；终点蓄卷/飞行/原生胜利阶段图 | 空 prefab 与奖励广告假成功不能推广；指南报告 59.2～60.5 FPS，不能把整个范围标成均达 59.5。第五章 16、18、22 |
| [Watermelon Run 3D](../download/Watermelon-Run-3D-20260923-170700/GAME_GUIDE.md) | 真实颜色匹配、桥梁消耗库存；动态速度影响前瞻；弯道方向对齐；终点原生按钮蓄力；关卡/解锁/循环地图分开 | 当前 `--levels` 表示终点编号；不能与数量型通用命令混用；禁止直接写满充能。第四章；第五章 6、16、18、21 |
| [You Are Queen](../download/You-Are-Queen-20260914-034800/GAME_GUIDE.md) | 资源池 null 追到 loader 真实缺失；FairyGUI 缺包可导致终局停住；清单补齐后重启缓存回放服务；回归初始漏抓场景与通用补全器 | 清单完整性、20 秒实玩与全量 40 地图验证分别报告；静态候选数不是实际崩溃数。第一章 4；第五章 10、14、22 |

#### 冲突与历史方案的处理原则

2026-10-03 新增 [Pencil Rush 来源指南](../download/Pencil-Rush-20261003-153217/GAME_GUIDE.md)：PlayCanvas/Ammo 与 Unity 的识别分界、CrazyGames 多层发布 iframe、带 hash 的配置资产/多页字体/后续场景补全、原生碰撞形状缩放与偏移、SDK 遮罩下真实输入可达性，以及编码原始时间戳与原生运动窗口的交叉门禁。16 个地图模板不代表 16 关；1500ms 预热后的单次成功不证明普遍稳定。6000ms、AboveNormal 和 70° FOV 是本机此游戏的实测设置，百关状态以其新版报告和验收文件为准，不计入原始 24 份文档统计。

同日录制脚本清单包含 28 款游戏的 29 个入口，见根 `scripts/logs/recording-script-audit.json`。静态调用链核对、冷启动对照、历史坏片确认和新版本全量实录是不同证据；共享修复不能把各游戏历史百关成绩自动提升为新版无卡顿验收。

以下条目供接手时快速避坑，未修改单游戏原文，也未将历史结果重新标为已验收。

| 发现的冲突 | 全局采用的结论 |
| --- | --- |
| 旧 30 FPS 命令与新 60 FPS 基线并存；共享录制器默认仍为 30 FPS / `captureEveryFrame=false` | 新脚本显式传入 `{fps:60,captureEveryFrame:true,speed:1.0}`，实测主画布绘制与媒体结果；历史成片参数保留原样 |
| 部分文档把放大、有损 H.264 或约 2 秒 NVENC 导出写成「无损/恒定极速」 | 分别记录真实采集方式、源缓冲、输出尺寸、编码与耗时，不能用导出 CFR 60 替代实际绘制 FPS |
| Count Master 旧慢换位方案与后续开头推荐相反 | 采用后续撤回结论；平滑以原生可达性与危险窗口为约束，不强套固定长冷却 |
| Color Maze / Maze Paint 的“自然速度”仍含物理常数修改 | 模式名不能代替修改披露；一般基线不改速度/重力，用户授权的慢速/修图模式单独记录 |
| 部分跑酷指南用坐标写入、禁 collider、直接 Tween、改随机地图增强稳定性 | 可学习机制识别与规划思路，不继承绕过原生输入/碰撞的实现，不能冒充原版随机过程验证 |
| Spiral Roll 的空资源 fallback / 奖励回调补丁能让流程继续 | 资源缺失修归档与通用补全器；奖励成功须真实原生资格/回调，不能空节点或假成功遮错 |
| Rubber Ball 的两种球体横向间距公式看似相反 | 核对实际球心高度，由三维球体距离推导各自特例，拒绝不带前提的公式 |
| Count Masters 百关均值 58.35；Spiral Roll 范围含 59.2，文字却称满帧达标 | 保留原数值；未达全局门槛的批次不作为达标证据。回归范围、采样区间与后续补丁版本须匹配 |
| “100 个 MP4 存在”“主窗口可见”“资源扫描零缺失”被当作通关证据 | 原生成功/任务目标、进度、运行资源、绘制性能、媒体分别核验并按关关联；文件存在或静态扫描只证明其中一部分 |
| 68/40/80 关有限游戏与默认跑 100 关冲突；50 关测试范围被误当上限 | 确认的有限游戏跑全量并报告终点；未确认上限就写已测试范围，不取模或修改计数制造关卡 |

#### 后续新增经验怎样并入

1. 在目标游戏指南中先记录真实方法/字段、现场日志、触发条件、参数单位和脚本版本；清楚区分实测结论、推测和未验证范围。
2. 只有跨游戏成立的不变量进入全局主文；引擎/玩法分支需写明前提，游戏参数和专用补丁留在来源指南。
3. 新结论显式标明取代的旧方案；修改脚本后按全局要求完成真实关卡回归与全量录制，历史批次不能自动覆盖新版本。
4. 本索引新增对应来源和适用边界，主文已有规则直接引用，不再增加重复大段说明。

---

## 一、 核心开发哲学与交付约定

### 1. 实战第一、日志驱动（摒弃离线虚拟单测）
* **拒绝无意义的伪单测**：WebGL/Unity/Laya 引擎的微重力、真实刚体摩擦力、碰撞体网格穿透、以及连续多边形路网，根本无法通过手写的离线虚拟单测有效检验。
* **唯一真理流水线**：
  $$\text{真实关卡运行} \longrightarrow \text{自动采集遥测日志与截图} \longrightarrow \text{定位真实物理异常} \longrightarrow \text{针对性优化策略脚本} \longrightarrow \text{产出通关 MP4}$$
* **回归与验收标准**：以关卡运行日志中的 `实测页面刷新 FPS`（$\ge 59.0$，帧率大于 59 即可合格判定）、关卡一次通过率（Attempt 1）以及导出的最终 MP4 视频质量为唯一验收依据。

### 2. 纯原生物理交互（绝不作弊）
* **零修改内存物理常数**：不修改角色/物体坐标（严禁瞬移）、不修改重力加速度、不锁血、不破坏原生碰撞体。
* 所有的操作必须通过**模拟原生触控滑动（Swipe/Drag）或键盘事件（Key/Arrow）**完成，确保游戏行为真实、可信、具备极高的视频观赏价值与作品发布标准。
* 若在浏览器内驱动引擎输入入口，必须先追踪真实 DOM 事件到引擎回调的链路，保持按下、移动、抬起、事件参数和模式检查一致。直接调用拾取、伤害、胜利、奖励或移动 Tween 方法属于跳过交互，不得冒充原生输入。弹窗只隐藏绘制；普通插屏结束与奖励广告成功不是同一种回调。

### 3. 录屏成片交付标准（面向作品发布）
* **视频画幅**：竖屏游戏统一输出 **1080 × 1920（Full HD 1080P）**，横屏按画布比例输出。
* **帧率与编码**：稳定 **60 FPS**（实测平均刷新与编码帧率 $\ge 59.0$ 即可合规）、**CRF 18**（高画质保真压制）、**H.264 (yuv420p)**、**faststart**。
* **无卡顿交付（强制）**：成片从第一帧到终局必须连续、顺滑；**任何可见的非原生停顿、运动中连续重复画面或丢帧跳跃均判定不合格，必须定位、修复并重录受影响关卡后才能交付**。特别检查每关开头 0～2 秒；标称 60 FPS、平均绘制达标和完整解码通过均不能替代画面连续性验收。执行步骤见第三章「铁律 6」。
* **自然速度与真实时长**：统一采用 **1 倍速（`playbackSpeed = 1.0`）自然实玩速度**录制与导出，简单关卡允许短于 15 秒，严禁为了凑时长而人为延长转向等待、通关后强制空等、或后期慢放/补帧。
* **音频参数**：原声音频采样 **AAC 192 kbps, 48000 Hz 立体声**；无麦克风杂音。
* **画面纯净度**：
  * **开头**：首次实玩输入前完成场景加载、UI 清理和真实主画布绘制握手（包括跨两次 RAF），杜绝开始菜单、教学手势或黑屏。正式录制标记必须在触发运动的第一次输入/开始动作之前；不得先起跑再等待两帧，用晚标记漏掉实际加载卡顿。原生入场与开始运动耦合时，需在单游戏适配器中解决就绪与纯净画面，不得修改运动/碰撞状态来冻结起跑。
  * **结尾**：保留完整的通关动作、终点特效与镜头特写（约 1~1.5 秒），**彻底屏蔽/隐藏结算窗口（WinWindow/ChestWindow/广告弹窗）的 Graphic 渲染**，但保留其底层业务回调以保证正常切关。
* **文件命名与生命周期**：
  * **录像唯一输出目录（强制）**：所有游戏的视频只能录制并保存在该游戏的 `download/[游戏名]/scripts/video/` 目录下，所有视频必须位于这个目录树内。
  * **video 只放视频（强制，适用于整个目录树）**：`scripts/video/` 及其所有批次子目录内只能保存 MP4、WebM 等视频文件，以及组织这些视频的批次目录。**报告、日志、JSON、存档、源码、截图等任何非视频文件或辅助目录都必须放在 `scripts/` 下的其他位置；不得放入 video，也不得在 video 内另建 metadata、source、checkpoints 等目录绕过此规则。**
  * **录制辅助数据固定位置**：报告、验收结果、运行日志、断点、原生存档、源码快照和清理记录统一保存到 `download/[游戏名]/scripts/recording-data/[录制批次名]/`；与 `scripts/video/[录制批次名]/` 使用完全相同的批次名，一对一关联。包括 `report.json`、`verification.json`、`run.log`、`checkpoint.json`、`checkpoints/`、`source/`、`fresh-start.json`、`cleanup-status.json` 及诊断轨迹。临时探针与调试截图仍遵循 `scripts/.tmp/` 的用完即删规则。
  * **批次文件夹命名（强制）**：新批次统一使用 `recording-YYYY-MM-DDTHH-mm-ss-SSSZ/`，例如用户指定的 `recording-2026-10-01T14-10-16-180Z/`。时间取本批次实际开始时间，使用 UTC，保留 `T`、毫秒和 `Z`；生成方式为 `recording-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`。默认录制、手动 `--output`、测试和重录均遵守；不得自行改成 `smooth-*`、`final-*` 等策略名或省略时间。续录沿用原批次目录名。修正已有批次名称时，以 `report.createdAt` 为时间依据，同时同步报告、索引和指南的路径，保留原始录制日志并追加更名记录。
  * **适用范围**：首次录制、重新录制、断点续录、测试录像、原始录制文件（WebM/MP4）、转码成片与失败片段均遵守此要求；命令行 `--output`、`--resume` 也只能指向该游戏的 `scripts/video/` 或其子目录。
  * **执行前检查**：先解析输出路径的绝对位置，确认实际保存位置在该游戏的 `scripts/video/` 内，再启动录制；目录外的参数必须修正后才能执行。禁止擅自另建 `scripts/recordings/`，也不得把视频录到 `scripts/.tmp/`、桌面或其他目录。
  * **清理受阻不改变目录**：旧录像无法删除、权限受限或批次冲突时，仍在 `scripts/video/` 内建立新的批次子目录；不得借此更换录像根目录。对应报告与录像索引保存到 `scripts/recording-data/` 下的同名批次，记录视频与辅助数据的真实路径。
  * 一关一个独立 MP4，关卡编号补齐六位（如 `level-000001.mp4`）。
  * 正常中断、重试或异常退出时，自动清理未完成片段，绝不导出零字节或破损的残片。

  **完整统一目录树规范（游戏根目录 vs scripts 严格隔离）**：

  ```text
  download/[游戏名]/
  ├─ analysis/                     # 逆向与符号反编译产物
  ├─ archive/                      # 原生 WebGL 静态资源与 manifest
  ├─ game/                         # 原始包体文件
  ├─ preview/                      # 预览缩略图
  ├─ GAME_GUIDE.md                 # 游戏专属技术与算法指南
  ├─ index.html                    # 本地试玩入口
  ├─ README.txt                    # 游戏基础元数据
  ├─ start.cmd                     # 【根目录专属】启动本地 Web 回放服务
  ├─ stop.cmd                      # 【根目录专属】停止本地 Web 回放服务
  └─ scripts/                      # 自动化与录制专用目录（所有自动化入口必须在此）
     ├─ play-auto.cmd              # 纯物理拟人游玩，不录像
     ├─ record-auto.cmd            # 持续无限逐关录制（默认 --end 0 无限运行）
     ├─ record-from-level.cmd      # 指定起始关卡录制
     ├─ verify-recordings.cmd      # （若包含质检模块）成片画质与无卡顿验收
     ├─ AUTOMATION.md              # 自动化上下文说明
     ├─ automation-context.json    # 自动化桥接配置
     ├─ internal/                  # 核心运行、适配器与策略源码
     ├─ video/                     # 【强制】只存放最终导出的 MP4/WebM 视频
     │  └─ recording-2026-10-01T14-10-16-180Z/
     │     ├─ level-000001.mp4
     │     └─ level-000002.mp4
     ├─ recording-data/            # 存放与 video 批次同名的辅助数据
     │  └─ recording-2026-10-01T14-10-16-180Z/
     │     ├─ report.json
     │     ├─ verification.json
     │     ├─ run.log
     │     ├─ checkpoint.json
     │     ├─ checkpoints/
     │     └─ source/
     └─ .tmp/                      # 临时探针与调试截图（用完即删铁律）
  ```

  **脚本存放与执行隔离铁律**：
  * **游戏根目录禁令**：**根目录下的 `.cmd` 脚本只能且必须仅有 `start.cmd` 与 `stop.cmd` 两个本地回放服务控制器**！**严禁将 `play-auto.cmd`、`record-auto.cmd`、`record-from-level.cmd`、`verify-recordings.cmd` 等自动化脚本直接散落在游戏根目录**；严禁在根目录放置任何临时探针（`*.mjs`、`*.cjs`）、运行日志（`*.log`）、根目录 `.tmp/` 或调试图片目录（`debug-images/`）。
  * **自动化脚本收敛**：所有用户和开发日常执行的自动化控制批处理（`play-auto.cmd`、`record-auto.cmd`、`record-from-level.cmd`、`verify-recordings.cmd`）**必须统一且唯一存放在 `download/[游戏名]/scripts/` 目录下**。
  * **工作目录规范**：所有 `scripts/` 下的 `.cmd` 脚本，首部必须使用 `cd /d "%~dp0.."` 显式切至游戏根目录，再调用 `node scripts/internal/...`，确保无论从哪个路径调用或双击，工作目录均稳定为游戏根目录；
  * **Windows 批处理编码规范**：所有 `.cmd` 文件必须强制使用 CRLF（`\r\n`）换行，首部声明 `@echo off`、`setlocal` 与 `chcp 65001 >nul`，杜绝 GBK 控制台下的换行与中文解析异常。

  **执行与迁移要求**：录制入口、续录器、验收器和清理工具必须分别解析视频目录与辅助数据目录，不能继续假设 `report.json` 等文件位于视频批次内。迁移旧批次时先保全数据，更新全部读写位置、报告中的路径及指南链接，并核对续录/验收仍能找到原生存档和源码快照；不能直接删除这些证据。交付前递归检查 video，确认没有非视频文件或辅助目录。本文历史案例中指向 video 内报告的链接记录迁移前的实际位置，不是新目录模板；迁移后再同步为真实的新路径。

### 4. 游戏数据缺失实时补拉与拉取代码同步优化铁律（治标 + 治本）
在运行自动化脚本跑关或巡检时，**必须全程监控网络请求与引擎加载日志（HTTP `404`、`requestfailed`、`pageerror`、资源加载失败回调）**。一旦发现任何游戏数据（关卡配置、3D 模型/预制体 `.lh`/`.lm`/`.lmat`、贴图、图集 `.atlas`、UI 包 `.bin`、音频 `.mp3`/`.wav` 等）缺失，必须严格执行以下两步闭环：
1. **第一步（治标——立即拉取并补齐当前游戏缺失内容）**：
   * 从 `archive/manifest.json`（`gameUrl` / `finalUrl` / `sourceUrl`）或游戏配置中提取原始远端基地址，计算出缺失文件对应的源站 URL；
   * 调用 [`node scripts/add-archive-resources.mjs --archive <游戏目录> --url <远端URL...>`](../scripts/add-archive-resources.mjs) 拉取原始资源并触发次级依赖扫描，直到目标范围内 **零未解决的实际游戏资源加载失败**。包内虚拟路径、源站也缺失的可选请求和静态推测按下表分类记录，不能用吞掉 404 或伪造响应达成「零错误」。
2. **第二步（治本——溯源漏抓原因并优化通用拉取代码）**：
   * **严禁只手动补文件而不修拉取器**！必须分析为什么初次抓取（[`src/capture.mjs`](../src/capture.mjs)）和静态依赖补全器（[`src/asset-completer.mjs`](../src/asset-completer.mjs)、[`src/fairygui-assets.mjs`](../src/fairygui-assets.mjs)）未能自动捕获该资源：
     - **扩展名或路径规则遗漏**：检查 [`src/asset-completer.mjs`](../src/asset-completer.mjs) 中的 `ASSET` 与 `SCANNABLE` 正则是否漏掉了特定后缀或子目录（如 `sub1/`~`sub9/`、`zipRes/`、`StreamingAssets/` 等）；
     - **混淆代码或动态拼接路径**：若 `bundle.js` 通过混淆数组（`_0x...`）或字符串拼接（如 `'stage' + id`、`res/configs/*.json`）动态构造路径，需在 [`src/asset-completer.mjs`](../src/asset-completer.mjs) 的 `scan()` 中补充反混淆提取或关联配置（如解析 `lhs.json`、`StageConfig.json`、`res_lib`）的递归依赖推导；
     - **二进制包内部引用**：若缺失资源隐藏在 `.bin`（FairyGUI）或特定引擎二进制描述文件中，同步增强 [`src/fairygui-assets.mjs`](../src/fairygui-assets.mjs) 或对应解析器。
   * 修改拉取代码后，运行 `npm run check` 与 `npm test` 验证通过，确保后续抓取同类游戏时一键自动拉全。

**先确认资源身份，再决定补拉或修复引用**：

| 现场证据 | 应采取的动作 |
| --- | --- |
| 原生加载器需要独立文件，源站存在而归档缺失 | 补拉原始字节并递归扫描依赖，同时修正通用补全器 |
| SDK 清单明确列出包内虚拟路径 | 抓取并验证对应物理包，按清单登记虚拟资源；不能把每个虚拟路径当独立 URL 下载 |
| Laya 原生版本表将编辑器路径映射为发布文件名 | 先采集 `Laya.ResourceVersion.manifest`，按文件名或版本目录模式解析映射，再检查包内路径或下载实际文件 |
| 源站也返回 404，且引用编号超出实际配置目录 | 回查生成引用的原生 UI/配置逻辑，修正越界候选；不要制造不存在的资源或伪造成功响应 |
| 只有静态扫描推测，尚无实际加载或清单证明 | 保留未解决候选及来源，不冒充核心缺失文件数，也不据此掩盖运行时错误 |
| Emscripten `loadPackage` 声明文件偏移与 `remote_package_size` | 补齐其声明的物理 `.data` 和 WASM；有效偏移表中的文件是包内虚拟路径，不能逐项拼成独立 HTTP 请求 |

删除旧误报必须有清单或实际加载证据，只处理补全器生成的对应记录。真实物理包缺失、截断或运行时加载失败仍判为失败。YYG v3 与配置驱动的动态依赖详见第五章第 12 节。

Run Healthy 2 的 YYG 3.0 现场（2026-10-08）表明：旧 SDK 没有现代 `assetManager.impl`，
但原生 `Laya.ResourceVersion.manifest` 已有完整文件名映射；场景、材质仍引用原始编辑器名。
`readRuntimeAssetRegistry()` 必须独立导出 `urlAliases`，补全器在依赖入队前解析这些别名。
不能把所有名为 `manifest.json` 的文档都猜作版本表，也不能仅因存在别名而忽略实际请求失败。
修正补全器生成的旧名 404 时保存 `mappedTo`，映射后的独立文件及对应物理包仍须验证。
具体资源结构见[本批次专属说明](../download/Run-Healthy-2-20261008-145125/GAME_GUIDE.md)。

Smile Rush 的 Playhop/Laya 现场（2026-10-10）补充：[专属指南](../download/Smile-Rush-20261010-000244/GAME_GUIDE.md)。运行时清单应限定真实游戏 frame 范围，门户广告销毁不能中断游戏资源检查，真实游戏读取失败仍须保留。Yandex 同应用 host 的 `/helpers/` 存储预加载页不是游戏入口。原生 `Laya.Loader.preLoadedMap` 可独立提供包内路径及模型/材质依赖，不要求 YYG 现代 SDK；Laya 已解析的根目录引用须有清单、版本映射或完整已抓资源路径证据，不能重复拼接目录或按同名文件猜测。原生 View/Scene 调用的 `.scene` 按发布规则转换为 `.json`，字面量取模和直接拼接可推导有界主题；不存在的静态候选保留诊断，实际加载失败仍判失败。离线 SDK 必须满足入口实际调用的初始化接口，不能以「无页面异常」代替可见画布与原生输入运行验收。

**平台识别先于入口跟随，引擎识别依据真实构建**：归档按「来源平台 → 原生开始/SDK 握手 → 真实游戏入口 → 引擎依赖补全 → 回放验证」执行。Playhop/Yandex 的 SDK iframe 要保留父页面，第一层入口也必须检查 `origin` 依赖；不能把坐标点击画布当作门户开始按钮。统计和广告不更新游戏空闲计时，门户文件不计入 iframe 游戏核心负载；补全后必须刷新引擎检查结果。完整按平台归档与入口抓取全流程规范如下：

适用代码：[平台入口策略](../src/capture-platforms.mjs)、[抓取主流程](../src/capture.mjs)、[引擎依赖补全](../src/asset-completer.mjs)。平台负责找到游戏并完成原生启动；引擎负责说明需要哪些构建文件。Playhop 上的游戏可以使用 Unity、LayaAir 或其他引擎，不能把平台名称当作引擎名称。

#### 4.1 平台归档与入口抓取执行顺序

1. 从用户输入 URL 的主机名识别平台，使用完整域名边界。未知来源可根据落地页重定向补识别；不要用广告或游戏发行商的 iframe 主机名覆盖来源平台。
2. 按平台定位真实入口，完成原生开始按钮操作。等待动态 iframe 挂载，保留 URL 的查询串、版本号和 hash 参数。
3. 决定直接打开还是保留父页面。带 `#origin=<父页面 origin>` 的 SDK 游戏第一层、后续层都要保留父页面通信环境；Referer 不能代替 `postMessage` 握手。
4. 在真实游戏中进行启动交互，并抓取动态资源。仅实际游戏目录资源或由实际游戏 frame 发起的资源更新游戏空闲计时；门户推荐、广告刷新、点击统计不构成游戏加载进展。外部 CDN 游戏资源仍按请求发起 frame 识别。
5. 检查实际构建文件识别引擎，执行共同的依赖补全。Unity HTML 中明确声明的 `loaderUrl`、`dataUrl`、`frameworkUrl`、`codeUrl` 支持字符串常量和拼接解析；禁止执行下载来的脚本来推导路径。补全后重新检查核心文件，避免沿用补全前的“不足”状态。
6. 分别保存平台解析结果、核心完整性、本地回放与实玩验证证据。`core-complete` 仅代表已请求及可解析的声明依赖范围，不能冒充全关卡资源齐全或完整离线实玩通过。

#### 4.2 已有平台策略

| 来源平台 | 入口及启动逻辑 |
| --- | --- |
| Playhop、Yandex Games | 从 `/app/<ID>` 取应用 ID，点击门户 `button[data-guard-accept]`，匹配该应用的 Yandex 游戏存储 iframe；保留父页面。找不到该应用时报告失败，不能拿广告 iframe 顶替。关闭自动交互时不点击门户按钮，保留未启动的诊断事实。 |
| FreeGame | 优先指定 `play_game_frame`；不要用页面上其他 iframe 替代。原生 CDN 直链可直接抓取。 |
| Y8 | 读取 `item-direct-container` 的 `data-src`，再使用通用发现作为兜底。 |
| Yad / YYG | 优先 `iframe#game_frame`，例如 Coffee Stack 的 `cdn.yad.com/.../index.php?yad`；SDK 资源清单由共同的运行时补全读取。 |
| GameDistribution | 发现真实构建入口后处理原生隐私提示及 `#pluto-splash-button` PLAY；不按固定坐标猜启动按钮。 |
| Poki | 等待 `gdn.poki.com` / `poki-gdn.com` 的真实发布 frame，保留 `games.poki.com` SDK 父页面与完整查询参数；手机门户的 `button#play-game-tile` 必须等客户端事件绑定完成，仍可见时有界重试。不能退回门户页面并宣布找到游戏。 |
| 未识别平台 | 保留 HTML/DOM 通用入口发现与最多四层跟随；每一层都检查父页面依赖，过滤已知广告/统计入口。 |

当前策略集中在一个模块中。新增平台先提供失败现场、真实入口 DOM/网络证据及浏览器回归；不得仅靠新增域名名单宣布支持，也不复制一份抓包和引擎补全主流程。

Longcat 的 Poki/Fancade 现场（2026-10-10）：`.wasm` 与 `.data` 也属于通用 Emscripten 构建，不能单凭这两个扩展名判为 Unity。Fancade 以同构建目录的 `fancade.css`、`source_min.js`、`index.js`、有效 WASM 和非空 Data 核验核心文件。离线回放使用发布脚本允许的 `localhost`，启动器必须采用服务返回的 `replayUrl`（保留查询参数）；`//game-cdn.poki.com/...` 也必须重写到本地。Poki SDK 离线适配仅释放初始化与普通插屏继续链，奖励广告返回失败，外网上报不排队；不得修改原始游戏资源。`leveldata.poki.io/fancade-longcat` 的实际调用是 `sendBeacon` 上传游戏标识，不能因域名含 leveldata 就误当关卡下载。严格禁网手机触摸已实测第 1 关进入第 2 关，范围不等同于全量关卡。见[专属指南与证据](../download/Longcat-20261010-145810/GAME_GUIDE.md)。

Subway Surfers 的 Poki/Three.js 现场（2026-10-10）：发布运行库为哈希命名的 Three.js，PixiJS 负责 UI，业务入口必须实际引用同目录 Three.js 模块；不能将它套用 Unity/WASM 核心要求。离线 SDK 还要满足实际调用的 `getURLParam`（`gd` 前缀参数优先）、`movePill`、`measure`、`customEvent`、`happyTime`；平台 UI/统计接口保持可调用但不发送远程统计，奖励资格仍不伪造。大体积资源不能替代引擎核心核验；未知引擎且核心未确认，或 `manifest.localReplay.status=failed`，均不得显示完整归档。通用抓取在本地启动和可见画布检查后才发出完成事件，页面异常与游戏请求失败必须记录，预览失败原因写入清单；有可见画布仍不等于已实玩。该版本以真实手机触摸启动、原生换道、计分及碰撞结算确认初始流程，见[专属指南](../download/Subway-Surfers-20261010-153851/GAME_GUIDE.md)。

#### 4.3 Playhop 454453 现场依据（2026-10-02）

- 游戏：Tap To Color: Painting Book，Unity WebGL。旧归档：[180449 批次](../download/Tap-To-Color-Painting-Book-20261002-180449/GAME_GUIDE.md)。
- 原流程第一层无条件直接打开带 `origin=https://playhop.com` 的游戏 URL，并用画布坐标点击启动。实际初始化链为 `YaGames.init → LoadCloud → GetPayments → InitPlayer → StartUnityInstance`，门户“现在玩”未完成时无法下载完整构建。
- 在保留门户的真实浏览器中点击原生按钮后，WASM、data、framework 请求全部出现，Unity 实例成功初始化；新实抓证据位于 `download/Tap-To-Color-Painting-Book-20261002-182432/archive/manifest.json`。
- 实抓及旧归档补拉均取得约 13.22 MB 游戏目录负载，核心缺失为 0。本地禁止外网回放截图已进入第 1 关。旧归档通过 `scripts/add-archive-resources.mjs` 补齐三个原始构建文件，并重新解析出 1 个 WASM、7 个 Unity 包内文件与 55 个可能的业务类。
- 旧归档的 `archive/verification.json` 仍有 `Failed init player data`、`Failed - Game Ready` 两条离线平台初始化错误；没有核心 HTTP 加载失败。这是待验证的离线兼容范围，不能删除错误或伪造成功记录。
- `mc.yandex.com/clmap` 属于点击统计，不是关卡资源。统计失败保存为忽略记录，不逐条刷错误日志、不补拉响应体、不更新游戏空闲计时；Yandex 游戏 CDN、SDK 和支付接口保持可用，不按整个 Yandex 域名屏蔽。

#### 4.4 平台名称与封面提取规范

原生入口已经确认时，标题证据采集按 `gameUrl` 精确匹配实际 frame，不能随意读取
广告 iframe。Yad 优先使用原生游戏标题，可回退到 `game_frame`；保留原始页面和落地页
标题用于诊断。Run Healthy 2 的外层标题带有 `Running Unblocked Game`，原生标题没有。
清理明确的 Unblocked Game 推广后缀，覆盖常见分隔符；无分隔符时，去掉后缀后的名称
须与来源 URL 一致。不能因为来源 URL 更短，就删掉 `3D`、数字或真实副标题。
显示名称、目录、清单、README 与管理任务引用应同步；改名前的诊断证据保留历史值。

名称判定与入口发现各自使用来源平台规则。CrazyGames 的目录页标题优先于嵌入的 SDK/加载器标题；去除 `🎮` 和 `🕹️ Play on CrazyGames` 包装，目录标题缺失时再用来源 `/game/<slug>`。本游戏的正确名称是 `Man Runner 2048`。

构建文件只有描述性名称才可参与身份比对：哈希、`max_512mb` 等内存配置不能覆盖目录页名称，也不能产生“抓错游戏”的误报；只有这些技术标识时，身份比对为未知（`match: null`）。`Potato-Rush_<hash>` 等仍保留真实名称前缀，继续检测和纠正不同游戏，不能整体关闭构建名校验。

封面须与已确认的名称、来源 URL 匹配。CrazyGames 的 `imgs.crazygames.com` 封面尺寸/质量在查询参数中，游戏、画幅和资源版本在路径中；仅路径一致时可复用本地尺寸变体。保留原有 PNG/JPEG/WebP 支持，支持本次实测的静态 AVIF（`ftyp=avif`、`meta/iprp/ipco/ispe` 尺寸），校验盒边界、尺寸与大小，拒绝截断及尺寸不明确的容器。已抓到的有效封面优先使用；不拿推荐游戏、站点图标或随机截图补位。

2026-10-03 的 Man Runner 2048 现场因 `max_512mb_<hash>.wasm.br` 被误判为名称，又因本地 AVIF 不被接受而缺少封面。修复后由相同标题证据得到真实名称，直接保存已归档的 196×110 AVIF 封面；目录、解析报告及管理索引路径同步修正，原始游戏资源保留。证据见[本批次身份修复记录](../download/Man-Runner-2048-20261003-095019/archive/identity-repair.json)。该修复不代表已验证游戏全关卡自动化。

本次语法检查与 71 项回归通过；空闲的管理服务重载后，真实列表显示正确名称，封面接口返回原始 AVIF 字节且浏览器成功解码。接口、任务路径及页面截图证据见[身份与封面验收](../download/Man-Runner-2048-20261003-095019/archive/identity-verification.json)。

#### 4.5 抓取与归档验证入口

```powershell
npm run check
npm test
```

回归包括浏览器中真实父子 frame 消息握手、延迟门户按钮、错误应用/广告入口、平台域名边界、指定 iframe、游戏资源空闲计时及 HTTP Unity 构建依赖补全。测试只验证抓取工程，不代替真实引擎物理或关卡实玩。

本次 `npm run check` 与 60 项回归通过。最终在线启动证据保存于旧归档的 `archive/platform-capture-verification.json`；独立临时 Web 服务的真实 `/api/captures` 与归档列表检查见 `archive/web-platform-validation.json`，抓取正常按 30 秒游戏资源空闲结束，核心缺失及未保存资源均为 0。该临时服务与产物已清理，现有管理服务保持运行。正在运行的 Node 管理服务会缓存模块；修改后需重启管理服务才会加载新策略，刷新浏览器页面不能替代服务重启。

### 5. 临时测试/探针文件固定目录与用完即删铁律（严防项目臃肿）
* **固定存放位置**：在逆向分析、排查疑难关卡或验证画质/帧率时，所有临时编写的探针脚本（`probe-*.mjs`、`inspect-*.mjs`、`check-*.mjs`、`test-*.mjs`）、一次性补抓脚本、调试截图（`*.png`）与临时日志，**严禁直接散落在 `scripts/internal/`、游戏根目录或项目根目录 `scripts/` 下**！必须统一创建在固定临时目录：
  * 单游戏临时测试目录：`download/[游戏目录名]/scripts/.tmp/`
  * 全局临时测试目录：项目根目录 `.tmp/`
* **用完即删（闭环强制清理）**：
  * 探针脚本与测试文件的唯一使命是“定位问题、摸清机制”。一旦核心逻辑已合入正式自动化脚本（`run-auto.mjs` / `play-auto.mjs` / `strategy.mjs` / `adapter.mjs`）且结论已沉淀至 `GAME_GUIDE.md`，**必须在任务交付前立即删除对应的临时测试文件及 `.tmp/` 目录**！
  * 正式交付的 `scripts/internal/` 下只允许保留生产运行必需的核心脚本（如 `run-auto.mjs`、`play-auto.mjs`、`adapter.mjs`、`strategy.mjs`、`game.mjs` 及必要的反混淆参考文件），保持工程目录干净、精简。

### 6. 百关长程实战全量验证与持续无限录制架构铁律 (1-100 Marathon Validation & Continuous Running)
* **严格区分「AI 交付验收基线」与「用户日常脚本设计」**：
  1. **AI 交付验收的硬性底线（跑 100 关）**：AI 助手在开发、编写与调优自动化脚本期间，**必须完整跑通并录制第 1 至 100 关（或游戏全量关卡）作为质量交付底线**。严禁仅跑前 1~3 关就交差。H5/WebGL 游戏后期关卡包含高复杂度障碍、内存泄漏、全新分支以及长时间运行的 GPU 管道负荷，必须经受住 100 关全长程洗礼。
  2. **用户日常脚本的核心设计（默认持续无限运行）**：交付给用户日常运行的执行脚本（如 `record-auto.cmd`、`play-auto.cmd`、`run-auto.mjs` 等），**必须设计为默认持续无限运行模式——只要用户不主动暂停或关闭窗口，就必须一直一关接一关录制/游玩下去（101, 102, 103... 循环推进），严禁硬编码在 100 关自动退出**！关卡数量限制（如 `--end <N>`、`--levels <N>`）仅作为可选的调试参数，缺省或输入 0 时必须无限制持续运行，由用户通过 `Ctrl+C` 自主决定何时停止。
* **全量 1~100 关 AI 实战验收命令**：
  在 AI 验证与交付验收阶段，通过参数显式指定 100 关作为本次验收的终点：
  ```bash
  node download/[游戏名]/scripts/internal/run-auto.mjs --end 100
  ```
#### 6.1 命令行交互约定与持续运行设计
* **默认持续无限运行铁律（Continuous & Unlimited Recording by Default）**：
  - 核心执行脚本（`record-auto.cmd`、`play-auto.cmd`、`run-auto.mjs`）**默认必须为持续无限运行模式**：只要用户不按 `Ctrl+C` 或不关闭窗口，就一直连续运行与录制（101, 102, 103... 循环递增）。
  - 关卡上限（如 `--end <N>`、`--levels <N>`）仅作为可选调试参数。当缺省或传入 0 时，视为 `Infinity` 持续运行。
  - 双击 `record-auto.cmd` 或 `play-auto.cmd` 时，回车即默认开启无限制持续运行，绝不强加 100 关硬编码终止。
* **`record-from-level.cmd` 智能续录与重录**：
  - 双击直接回车：自动从最新未完成批次断点续录，并持续向后录制不设上限；
  - 输入关卡号（例如 13）：从该关真实输入前存档重录该关（分支重录修复）。
* **优雅的中断与存档持久化**：
  - 首次 `Ctrl+C` 在当前关完成后安全停止，完成当前视频编码封装、原生进度 checkpoint 持久化和报告更新；再次中断才强制退出未完成片段，杜绝损坏已有成片。
  - 循环内捕获 `SIGINT` 时，Playwright 启动可使用 `handleSIGINT: false`，待循环内媒体保存、checkpoint 完成后平滑关闭浏览器，避免默认信号提前关闭页面造成丢失当前关卡进度。

### 7. 手机移动端（Mobile 9:16）原生布局与真机模拟强制铁律 (Mandatory Mobile 9:16 Portrait Baseline)
* **强制以手机端打开布局为唯一验收基线，拒绝 PC 伪宽屏**：
  同一个 H5 游戏在电脑（PC）与手机端打开时，布局和交互有重大差异（PC 端常附带桌面外壳、横屏 iframe、非原生宽屏视锥与多余的桌面专属 UI）。**所有竖屏游戏的自动化脚本与录制，必须强制以真实智能手机移动端（Mobile 9:16 Portrait）打开的布局为唯一标准，严禁使用电脑端宽屏视口！**
* **无头浏览器真机参数模拟 (Mobile Device Emulation)**：
  自动化脚本在创建页面时，必须显式注入移动端真机参数：
  ```javascript
  page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  ```
  使游戏 SDK 内部的 `Laya.Browser.onMobile`、`navigator.maxTouchPoints`、`ontouchstart` 等移动端探测 100% 命中真机逻辑。
* **直达移动原生入口，绕开 PC 网页包装**：
  很多游戏抓取自 `yad.com`、`crazygames.com` 等聚合站点，PC 端页面常注入 PC 专属脚本 `game_pc-*.js`。自动化录制必须直接加载游戏底层原生移动入口（`index.html`），严禁录入 PC 网页外壳。
* **舞台设计分辨率与缩放模式绝对对齐**：
  在 LayaAir 等引擎中，通过 `addInitScript` 或场景加载钩子，将舞台尺寸与模式精确校准为 9:16：
  ```javascript
  if (window.Laya?.stage) {
    window.Laya.stage.scaleMode = 'showall';
    window.Laya.stage.size(750, 1333.333); // 1080 / 750 = 1.44, 1333.333 * 1.44 = 1920.0
  }
  ```
  使缩放比精确为 $1.44$，促使 WebGL 底层 Drawing Buffer 渲染出物理原生的 $1080 \times 1920$ 画面，实现 0 像素黑边、0 像素形变。
* **3D 全景透视视角补偿 (Panoramic Camera FOV)**：
  在竖屏 9:16 模式下，默认的垂直 FOV（如 60 度）对应的水平视角仅约 36 度，画面显得狭窄拥挤。自动化脚本在进入关卡后必须动态拓宽主相机视野：
  ```javascript
  const sm = window.__sceneMgr;
  if (sm?.camera) {
    sm.camera.fieldOfView = 70; // 从 60 度拓宽至 70~72 度，展现开阔的全景跑道与背景
  }
  ```
* **纯净实机画面（隐藏教学手势与常驻暂停）**：
  - **教学手势**：彻底隐藏并移除 `gameView.ctrhint.visible = false; gameView.ctrhint.removeSelf()`，杜绝录像被新手教学手指贯穿全程；
  - **常驻暂停按钮**：隐藏右上角暂停按钮 `gameView.pauseBtn.visible = false`，保证录屏无 UI 杂质；
  - **终点特写**：保留胜利过关特写约 1~1.5 秒，底层穿透拦截结算窗口渲染，确保成片具备殿堂级作品质感。

### 8. 自动化编写前反编译产物完整性前置校验与缺漏补解铁律 (Pre-flight Decompilation Verification Rule)
本节列出各引擎所需产物；**文件齐全只是第一层检查，必须同时满足文首[最高优先级规则](#decompilation-correctness-gate)中的正确性、版本匹配和实际逻辑验证要求**。
* **严禁无据盲写与凭空猜测**：
  在为任何游戏编写、重构或调试自动化策略脚本（`scripts/internal/run-auto.mjs`、`strategy.mjs`、`adapter.mjs` 等）之前，**第一步必须强制核查该游戏的反编译产物（`analysis/` 目录）是否完整、正确，且与当前运行构建一致**。
  严禁在没有反编译证据的前提下，在控制台中胡乱盲猜类名、属性名、状态标记或凭空试探输入注入点。
* **各引擎完整性验收门槛**：
  1. **Unity WebGL 游戏**：
     - `analysis/report.json` 存在且状态成功；
     - `analysis/unity-data/` 目录存在，已完整解出包内文件并包含 `global-metadata.dat`；
     - `analysis/wasm/*.wasm` 已就绪并生成模块摘要；
     - `analysis/il2cpp/dump.cs`、`script.json` 与 `gameplay-classes.json` 已全部生成；
     - `analysis/bot/runtime.mjs` 与 `bot/context.json` 已生成可直接调用的反射运行时。
     - **Unity 6 / metadata v31 分支**：若 `dump.cs` 的字段与返回值全是 `object`、方法头全是 `RVA: -1`、字段偏移是顺序占位值，说明注册表被常量折叠（判断依据见第二章）。此时 `script.json` 允许由 `npm run method-map -- download/[游戏目录名]` 从 `Il2CppCodeGenModule` 重建，且必须在 `analysis-summary.json` 里标 `validation.status: degraded`、在 `GAME_GUIDE.md` 里写明「字段类型/签名/偏移不可得」；没有这份声明就视为门槛未通过。
  2. **LayaAir / Cocos / Construct / Three.js 游戏**：
     - `analysis/report.json` 与 `analysis/source-index.json` 存在且符号表分类完毕；
     - 核心业务脚本已提取（`gameTextSources > 0`）；
     - `scripts/automation-context.json` 包含了高优先级分析脚本与关键业务词列表。
* **缺失或不正确时的强制处理流程（先解析、后编码）**：
  - 若 `analysis/` 目录不存在、为空、缺少上述核心文件，或虽有文件但解析失败、内容无效、版本/哈希不匹配：
    1. **第一步（触发标准流水线解析）**：在 Web 管理页面找到该游戏并点击 **「开始解析」**（或通过 API `POST /api/archives/:name/analyze`），让后台全自动解包资源、识别引擎、生成基础符号与 IL2CPP/Bot 骨架；
    2. **第二步（疑难深挖与高阶工具增强）**：
       - 若是 Unity WebGL 且需要查看具体方法实现体，执行 `npm run cpp2il` 还原出包含完整 IL 指令的 C# 程序集；
       - **若是 Unity 6 / metadata v31 且 `script.json` 缺失、`dump.cs` 全为 `object`**：不要再跑 `cpp2il`（这类构建必然报 `Failed to find code registration or metadata registration!`），改用 `npm run method-map -- download/[游戏目录名]` 从 `Il2CppCodeGenModule` 重建方法映射，再重生成 `analysis/bot/`（见第二章「`script.json` 缺失时的重建」）；
       - 若是混淆严重的 JS（如大量十六进制加密数组），执行 `npm run restringer` 沙箱解密；
    3. **第三步（沉淀分析结论并开始写脚本）**：
       - 完成文首正确性前置检查，在目标游戏 `GAME_GUIDE.md` 中记录真实来源、产物哈希、关键业务类、字段类型/偏移、方法实现及输入契约的核验结论后，方可正式开始编写自动化脚本。

### 9. 跨平台（Linux 与 Windows）双环境兼容强制铁律 (Cross-Platform Dual-Environment Compatibility Baseline)

本项目面向 **Linux（云端服务器、无头 GPU 录屏集群、Docker 容器、CI/CD）** 与 **Windows（本地开发机、个人电脑、桌面双击运行与调试）** 双平台架构。所有交付的自动化策略脚本、录制引擎、分析工具及启动入口，**必须确保在 Linux 和 Windows 环境下均能开箱即用、零报错互通**。严禁编写仅在单一操作系统可用的偏门代码或脚本。

* **启动器双轨交付与路径解耦规范 (Dual Launchers Standard)**：
  - **Windows 桌面快捷入口**：每个游戏 `scripts/` 目录下交付标准批处理脚本（`record-auto.cmd`、`play-auto.cmd`、`record-from-level.cmd`、`verify-recordings.cmd`），满足用户在资源管理器中直接双击运行或在 CMD 中便捷调用；
  - **Linux / CLI 跨平台通用入口**：所有执行逻辑统一以 Node.js 原生 ESM 模块驱动（`node scripts/internal/run-auto.mjs`），在 Linux Shell 或跨平台终端中均可直接传参执行；
  - **工作目录彻底解耦**：无论在游戏根目录、`scripts/` 目录内部，还是从项目顶级目录远程拉起，脚本均须具备自包含路径解析能力，严禁强依赖调用方当前的 Working Directory (`cwd`)。

* **Windows 批处理 (`.cmd`/`.bat`) 换行符与寻址硬性铁律**：
  - **换行符强制 CRLF 铁律（严禁 LF 换行）**：
    Windows `cmd.exe` 内部采用基于 CRLF 的物理字节偏移量寻址。**所有 `.cmd` / `.bat` 文件必须强制采用 Windows 原生换行符 `CRLF` (`\r\n`)，严禁保存为 Linux 的 `LF` (`\n`)**！
    > **典型惨痛事故**：当批处理中包含中文字符并执行 `chcp 65001 >nul` 时，若文件是 `LF` 换行，CMD 代码页重置会导致文件 Seek 偏移指针剧烈错位，把 `chcp 65001` 截断误执行为 `'5001' 不是内部或外部命令`，把中文标题截断误执行为 `'GameName' 不是内部或外部命令`，并直接跳过核心指令 `cd /d "%~dp0.."`。
  - **绝对基准路径锚定 (`%~dp0`)，拒绝脆弱相对路径**：
    批处理内部调用 Node.js 脚本时，必须使用 `%~dp0` 前缀进行绝对基准路径锚定：
    ```cmd
    node "%~dp0internal\run-auto.mjs" --record --start 1 --end 0 %*
    ```
    严禁写成相对路径 `node scripts/internal/run-auto.mjs`。相对路径在用户进入 `scripts/` 目录执行时，会被拼成 `scripts\scripts\internal\...` 导致 `MODULE_NOT_FOUND` 致命错误。
  - **编码规范与防闪退交互**：
    批处理统一保存为 **UTF-8（无 BOM）格式 + CRLF 换行**。开头声明 `@echo off` 与 `chcp 65001 >nul`，结尾通过 `set "EXITCODE=%errorlevel%"` 捕获真实退出码，并追加 `pause`，确保双击运行遇错时控制台窗口不会闪退消失。
  - **前置依赖防空检查**：
    启动前必须执行 `where node.exe >nul 2>nul` 以及脚本存在性检查 `if not exist "%~dp0internal\run-auto.mjs"`，环境异常时输出清晰中文排障提示。

* **Node.js 运行时跨平台编码规范**：
  - **路径拼接强制使用 `path` 模块**：
    所有文件路径操作必须使用 `path.join()`、`path.resolve()`。严禁在 JS/MJS 源码中硬编码 Windows 反斜杠 `\` 作为路径拼接字符串，确保在 Windows (`\`) 和 POSIX (`/`) 上原生安全。
  - **游戏根目录安全基准定位**：
    统一使用基于当前 ESM 模块元数据的绝对定位方案，严禁使用 `process.cwd()` 推导项目目录：
    ```javascript
    import { fileURLToPath } from 'node:url';
    import path from 'node:path';
    const root = fileURLToPath(new URL('../../', import.meta.url));
    ```
  - **文件系统大小写敏感度严格遵守 Linux 标准**：
    Windows 对文件名大小写不敏感，而 Linux（ext4/xfs）**严格区分大小写**。代码中引用的资源路径（如 `video`、`recording-data`、`analysis/report.json`、引擎资源图集等）必须与磁盘真实大小写 100% 吻合，严防在 Windows 开发正常、部署至 Linux 服务器直接报 404 或 `ENOENT`。
  - **优雅退出与资源清理 (SIGINT / SIGTERM 释放保障)**：
    自动化脚本内部必须显式注册 `process.on('SIGINT')` 与 `process.on('SIGTERM')`。当接收到中断信号（用户按 `Ctrl+C` 或容器停止）时，必须依次执行：
    1. 调用 `recorder.discard()` 清理丢弃正在缓冲的临时视频分片；
    2. 调用 `await browser.close()` 释放无头 Chromium 浏览器实例，严防后台遗留 Chromium 僵尸进程；
    3. 调用 `replay.server.close()` 关闭内置 Replay 本地 HTTP 服务，释放端口监听。
  - **子进程派生与外部工具兼容**：
    在派生 Python、FFmpeg 或系统 CLI 时做平台自适应：
    ```javascript
    const isWin = process.platform === 'win32';
    const pythonCmd = isWin ? 'python' : 'python3';
    ```
    在 Windows 下执行 npm 或 CLI 模块时，需注意使用 `shell: true` 或指定 `.cmd` 后缀。

* **版本控制 `.gitattributes` 防线**：
  为杜绝因 Git 在跨平台检出（Checkout）或不同系统编辑器保存时破坏 Windows 批处理的换行符，项目根目录必须配置 `.gitattributes`，强制锁定：
  ```gitattributes
  *.cmd text eol=crlf
  *.bat text eol=crlf
  *.sh text eol=lf
  *.mjs text eol=lf
  *.js text eol=lf
  *.json text eol=lf
  *.md text eol=lf
  ```
  保证 Windows 批处理在任何操作系统检出时始终锁定为 `CRLF`，其余源码与配置文件锁定为 `LF`。

### 10. 长跑高负荷防意外关机与蓝屏崩溃（0xEF / 0x1A / 0xc0000006）硬件与系统级防护铁律 (Host Crash Prevention Baseline) [重要]

> [!IMPORTANT]
> **【系统与硬件级安全红线：绝不允许因自动化录制导致宿主机意外断电关机或系统蓝屏重启】**
> 在长程百关（1~100 关连续数小时）或高并发多关卡录制过程中，宿主机硬件（CPU/GPU/NVMe SSD）、系统驱动与操作系统的稳定性是所有自动化任务成立的物理基石。
> 任何导致操作系统蓝屏（BugCheck `0xEF CRITICAL_PROCESS_DIED`、`0x1A MEMORY_MANAGEMENT`、`0x154 UNEXPECTED_STORE_EXCEPTION`、`0xc0000006 STATUS_IN_PAGE_ERROR`）或电脑突发黑屏断电关机的问题，必须被视为最高优先级的系统级缺陷，严禁在未彻底排除根因前盲目长跑！

* **四大深层致命诱因与彻底防御规范**：
  1. **【硬件与电源策略】PCIe ASPM 与 NVMe SSD 链路省电断连（最致命关机根因）**：
     - **机理剖析**：Windows 默认“平衡”电源方案开启了 **PCIe 链接状态电源管理（ASPM = Moderate power savings）** 和 **“在此时间后关闭硬盘”（默认 20 分钟）**。在高性能 NVMe M.2 SSD（如三星 980 PRO、西数 SN850X）上，录制呈现“突发连续高频写盘 -> 关卡间 1~2 秒瞬间空闲”的交替形态。空闲瞬间 PCIe 控制器试图退入 L1/L1.2 低功耗省电状态；而在下一关突发 I/O 时，PCIe 链路唤醒超时或总线响应延迟，直接触发 `STATUS_IN_PAGE_ERROR (0xc0000006)`，伴随 `volmgr 161 (0x00040049)` 转储写入失败。主板在检测到总线致命异常或供电过流保护时直接黑屏断电关机，或操作系统虚拟内存失效崩溃（`0x1A`、`0x154`、`0xEF`）。
     - **系统级配置基线（所有开发与录制机必须执行）**：
       ```powershell
       powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
       powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
       powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_DISK DISKIDLE 0
       powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_DISK DISKIDLE 0
       powercfg /SETACTIVE SCHEME_CURRENT
       ```
  2. **【CDP 通信与 Windows LPC】并发 Base64 视频块击穿跨进程缓冲区**：
     - **机理剖析**：旧版 `chunkTransport: 'binding'` 在关卡结束调用 `stop()` 瞬间，将整关录制的几十至上百个分块全部转为 Base64 字符串（瞬间内存膨胀 33% 达到 200MB~500MB+），并在同一毫秒内向 Chrome DevTools Protocol (CDP) WebSocket 发送上百个并发 RPC 响应。瞬间打爆 Chromium Mojo IPC 与 Windows 系统的 LPC/ALPC 内核缓冲区，导致关键系统服务终止触发 `0xEF`。
     - **传输基线**：统一锁定 **`chunkTransport: 'pull'` 串行拉取模式**（`queue.shift()` 单块读取、传输、写入、释放，全程内存占用压降至 `< 2MB`），杜绝内存洪峰与 IPC 崩溃。
  3. **【GPU 驱动与桌面窗口】NVENC 转码与 WebGL 3D 渲染在单显卡上竞争死锁**：
     - **机理剖析**：无头 Chromium 正在通过 WebGL/ANGLE 以 60 FPS 满负荷提交复杂的 3D 着色器光栅化指令，FFmpeg 若同时并发调用 `h264_nvenc` 硬件编码器，两类任务在显卡驱动（`nvlddmkm.sys`）与 D3D11 调度器内抢占上下文，极易造成 GPU 调度死锁或 TDR（超时检测与恢复），致使桌面窗口管理器（DWM.exe）崩溃并触发 `0xEF`。
     - **转码基线**：百关长程录制或高负载 3D 游戏，视频转码强制优先选用 **CPU 隔离压制（`libx264 -preset fast -crf 18 -threads 4`）**。实测 4 线程 CPU 转码单段仅需 ~8 秒且仅占用 20~25% CPU，与 GPU 渲染实现物理级隔离，确保显卡 100% 专注 3D 渲染，0 次 GPU 调度死锁。可通过环境变量 `GAME_FORCE_LIBX264=1` 与 `GAME_FFMPEG_THREADS=4` 全局锁定。
  4. **【连续物理热积累与 I/O 拥塞】长跑关卡间必须加入 3 秒冷却周期**：
     - **机理剖析**：连续自动化录制 100 关过程中，若转码落盘后毫秒级进入下一关，会导致 NVMe SSD 控制器和显存控制器持续处于极限吞吐状态，缺乏垃圾回收（GC）、TRIM 和物理散热窗口，主控温度逼近高温阈值时极易触发硬件自我熔断保护。
     - **冷却基线**：每关视频切片转码与 checkpoint 写入落盘后，强制加入 **3 秒物理冷却周期**（`await new Promise(r => setTimeout(r, 3000))` 或 `Start-Sleep 3`），让 SSD 控制器清理 SLC 缓存并恢复稳定温度。
  5. **【Node.js 运行堆保护】**：
     - 长跑录制命令必须追加 `--expose-gc --max-old-space-size=4096`，并在关卡结束后显式调用 `global.gc?.()`，防止 V8 堆内存累积膨胀。

---

## 二、 逆向分析与反编译查看指引（AI 必读）

针对归档在 `download/[游戏目录名]/` 下的游戏，项目收录了两种截然不同的主流 3D 引擎。进入一个新游戏前，首先查看 `download/[游戏目录名]/analysis/report.json` 中的 `engine` 字段以确定引擎分支：

### 分支 A：Unity WebGL (IL2CPP + WASM)
**典型游戏**：`Going-Balls`、`Barrel-Roller`、`Nail-Stack`、`Potato-Rush`。

此类游戏的 C# 代码已被编译为 IL2CPP C++ 并打包为 WebAssembly 二进制模块，逆向产物分布如下：
```text
download/[游戏目录名]/analysis/
  il2cpp/
    dump.cs                 # C# 完整类定义、字段与方法签名（静态结构字典）
    gameplay-classes.json   # 筛选后的核心玩法业务类列表（快速缩小类查找范围）
    script.json             # 方法名与 WASM 函数表索引/地址映射表
    DummyDll/               # 导出的托管程序集骨架，供反编译工具继续浏览
  bot/
    README.md               # 该游戏 Bot 开发说明
    context.json            # 方法名 → 函数表索引/dynCall 签名，类 → 字段名 → 字节偏移
    runtime.mjs             # IL2CPP 桥接运行时，提供 findObjects、readInt、invoke 等通用 API
```

#### 动态反编译真实 WASM 方法体（重要命令）
仅看 `dump.cs` 的签名无法推断具体计算逻辑与字段赋值。项目内置了单个 WASM 函数的反编译工具：
```bash
# 反编译并查看指定类的方法真实逻辑（输出类 C 伪代码）
node src/wasm-function.mjs download/[游戏目录名] --method '类名$$方法名' --decompile
```
> **Windows PowerShell 避坑提醒**：  
> 在 PowerShell 下执行命令行时，方法名中的 `$$` 必须使用**单引号**包裹（如 `'Movement$$OnSwipeEvent'`），否则 `$$` 会被 PowerShell 解释为系统内置变量导致传参被吞！

#### `script.json` 缺失时的重建（Unity 6 / metadata v31，已实测）
某些 Unity 6 WebGL 构建把 `Il2CppCodeRegistration`、`Il2CppMetadataRegistration` 和 `Il2CppType` 表全部常量折叠掉：
dumper 能吐出名字齐全但**类型全是 `object`、RVA 全是 `-1`、字段偏移是顺序占位值**的 `dump.cs`，
并在写出 `script.json` / `il2cpp.h` / `DummyDll` 之前中断（Cpp2IL 也会报 `Failed to find code registration or metadata registration!`）。
此时 `wasm-function.mjs` 因为没有方法表无法工作，用下面的命令从 `Il2CppCodeGenModule` 重建方法映射：
```bash
npm run method-map -- download/[游戏目录名]
# 等价：node scripts/build-wasm-method-map.mjs download/[游戏目录名]
```
实现见 `src/il2cpp-wasm-method-map.mjs`，三个关键事实（务必复用，不要另写一套）：
1. `Il2CppCodeGenModule` 数组仍留在 data 段，模块含 `moduleName(+0)`、`methodPointerCount(+4)`、`methodPointers(+8)`，后者是**函数表索引**；
2. `Il2CppMethodDefinition` 在这类构建里是 **36 字节**（不是 32），用 `methodsTable.size / ΣtypeDef.method_count` 反解步长，`nameIndex` 在 `+0`；
3. 模块与 image 用「模块名 + 方法数完全相等」双条件对齐，不要依赖数组下标顺序（顺序与 `images` 表并不一致）。
少数模块的方法指针数组落在 data 段之外（启动期写入），会被跳过并在输出里列出——Twisted Tangle 为 6 个模块、37 个方法（99.96% 覆盖）。
**顺带能补回的两张表（同一条命令 / 同一支工具）**：
- `analysis/bot/context.json` 的 `dynCall`：`dump.cs` 签名退化成 `object` 时 `emscriptenSignature()` 拿不到文本，`src/bot-kit.mjs` 会自动回退到 **wasm 类型段**（函数表索引 → 真实 wasm 签名，含 `this` 与末尾 `MethodInfo*`）派生 emscripten 签名；函数指针为 0 的泛型共享桩跳过。Twisted Tangle 实测 21522/24220 可用，抽样与 `wasm-function` 打印的签名一致。
- `analysis/il2cpp/stringliteral.json`：dumper 在缺 metadata registration 时写出的那份是乱码，`readStringLiterals()` 直接从 metadata 的 `stringLiteral`（`{length, dataIndex}`）与 `stringLiteralData` 表读出真实文本（15721 条），**但没有地址**，只能当关键词索引，不能用于反编译产物的地址注解。

**警告**：该方法只恢复「方法名 → 函数」，字段类型与真实字段偏移依然不可得；`dump.cs` 的偏移是占位值，
`wasm-function.mjs` 的字段名注解只能当线索，不能据此做内存读写。

**判定信号（先确认是不是这一类构建，再动手）**：
- `dump.cs` 里 grep 不到任何 `public int` / `public float` / `public bool`，全是 `public object`；
- 所有方法头都是 `// RVA: -1 Offset: -1 VA: -1`；
- 字段偏移严格按 `0x10, 0x14, 0x18…` 递增（4 字节步长的占位值，与真实布局无关）；
- `analysis/il2cpp/script.json`、`il2cpp.h`、`DummyDll/` 都不存在，`stringliteral.json` 里是没有 `address` 的乱码；
- `src/il2cpp-wasm-repair.mjs` 日志出现 `未定位到 Il2CppMetadataRegistration（降级处理）`。

**取证结论（Twisted Tangle 实测，可作同类构建的预期）**：data 段（9.48 MB，末地址 `0x9582c0`）里既没有指向 `codeGenModules` 数组的指针，也没有 `{count=15263, ptr→指针数组}` 形态的 `fieldOffsets` / `typeDefinitionsSizes`，同时不存在连续的 `Il2CppType`（8 字节 `{data, bits}`，`type` 位于 `bits>>16`）结构块；另有 6 个模块的 `methodPointers` 直接越出 data 段（启动期才写入）。**因此「类型表不存在」是构建特性，不是解析姿势不对**，再换工具或反复重跑都不会有类型信息。

**运行期双重核实（排除「启动期才建表」）**：判断「静态没有」之后，还要确认运行期也没有，否则就应该走运行时补丁而不是放弃。做法是离线回放 + Playwright 拿 `window.unityGameInstance.Module.HEAPU8`，在 page 内按 dumper 的 `FindMetadataRegistrationV21` 判据（`[c][c][ptr]`，c = typeDefinitionsCount，指针数组逐项落在内存范围内）扫一遍；再按 `Il2CppType` 特征找 `types` 指针串（`type = (bits>>16)&0xff ∈ 1..0x2E`）。Twisted Tangle 结果：360 MB 堆里 metareg 命中 **0**，最长类型指针串仅 8192 项且无人引用 → 确认该构建根本不保留这两张表。若这一步反而命中了，就应该把命中的区间写回 wasm（追加 data segment）再喂给 dumper，而不是放弃。

**工具链前置依赖**：`npm run cpp2il` 指向 net10.0 构建的 `Cpp2IL.exe`，需要 **.NET 10 运行时**；仓库内 `integrations/.../Il2CppDumper/.../net8.0` 需要 .NET 8。环境里没有 dotnet 时，用 `tools/Il2CppDumper-bin/Il2CppDumper.exe`（自包含单文件）配合上面的修复脚本即可，不必先装 SDK。

**恢复后的自检**：`metadata` 的 `ΣtypeDef.method_count` 必须等于 `Il2CppCodeGenModule.methodPointerCount`（Twisted Tangle：90824 对 90824，逐模块 122/128 精确相等），再用 `node src/wasm-function.mjs <归档目录> --method 'Class$$Method' --decompile` 抽 2~3 个业务方法核对逻辑是否符合 `GAME_GUIDE.md` 描述。

#### IL2CPP dumper 的执行范式：参数化 + 后台 + 读日志（不要开交互窗口）

`Il2CppDumper` 是命令行工具，**必须把三样东西直接当参数传进去**：IL2CPP 二进制、`global-metadata.dat`、输出目录；并把 `config.json` 的 `RequireAnyKey` 改为 `false`。少了参数它会进交互模式（等按键 / 等粘贴路径），在自动化里表现为「窗口开着、没有日志、看似卡住」——这不是环境问题，是调用方式不完整。

本项目已内置正确调用：`src/unity-analysis.mjs` 的 `runIl2CppAnalysis()` 会复制一份 dumper 运行目录、强制 `RequireAnyKey=false`、检测并注入 `Il2CppCodeRegistration`、然后以 `dotnet Il2CppDumper.dll <wasm> <global-metadata.dat> <out>` 无交互跑完，stdout/stderr 全量落到 `analysis-summary.json` 的 `log`。**单游戏排查一律复用 `analyzeCapturedGame`（Web 后台「开始解析」或 `scripts/.tmp/run-analysis.mjs`），不要自己开窗口手点。**

运行时依赖与兜底：该 dll 是 `net8.0` 框架依赖，机器上只有 .NET 10 时加 `DOTNET_ROLL_FORWARD=Major` 即可（Emoji Puzzle 实测通过）；完全没有 dotnet 时改用 `tools/Il2CppDumper-bin/Il2CppDumper.exe` 自包含版，同样以参数方式调用。需要 Cpp2IL 时其 `net10.0` 构建要求 .NET 10 运行时。临时装一份便携运行时的做法（不写注册表、不污染系统）：

```bash
curl -sL -o .tmp/dotnet.zip https://builds.dotnet.microsoft.com/dotnet/Runtime/10.0.0/dotnet-runtime-10.0.0-win-x64.zip
mkdir -p .tmp/dotnet && unzip -q .tmp/dotnet.zip -d .tmp/dotnet
PATH="$PWD/.tmp/dotnet:$PATH" DOTNET_ROLL_FORWARD=Major node scripts/.tmp/run-analysis.mjs download/[游戏目录名]
```

判读日志的三个关键行：`metadata vNN, imageCount=…` 表示元数据读取成功；`Il2CppCodeRegistration 已在 data 段中，无需修复` 或 `合成 … 兼容块 @` 说明注册表就绪；`status: completed` 且 `mappedMethods > 0` 才是真正成功（对照 `analysis-summary.json` 的 `validation`）。

#### IL2CPP 自动 dump 失败（`Can't use auto mode to process file, try manual mode.`）的标准修复
部分 Unity WebGL 构建（已实测：Unity 6 / metadata **v31** 的 `Rodha 2`）会让 Il2CppDumper 自动搜索失败，
`analysis/il2cpp/` 只留下程序集头与 `dumper-failure.json`（`mappedMethods: 0`）。这是**三处缺陷叠加**，缺一不可，
`src/il2cpp-wasm-repair.mjs` 已完整实现修复，遇到时请按下列顺序核查，**不要**用自研恢复脚本另起一套（那会让
`dump.cs` 与 `script.json` 长期失真）：

1. **判定“结构体是否真的不存在”必须用对齐搜索**：`Il2CppCodeRegistration` 被常量折叠时，data 段里不会
   有任何指针指向 `codeGenModules` 数组。旧实现用逐字节 `containsValue()` 探测，会被**未对齐的巧合字节**命中，
   误判成“结构体已存在、无需修复”而跳过注入。正确判据：存在 4 字节对齐单元保存该指针，且其**前一格**等于 `imageCount`。
2. **注入块要同时满足 dumper 的“搜索端”和“读取端”**：`SectionHelper.FindCodeRegistration2019()` 对
   `Version >= 29` 硬编码返回 `refva3 - 56`（认定 `codeGenModules` 在偏移 56），而 `Il2Cpp.AutoPlusInit()`
   会把 v31 降级成 v29 再读；v31 布局里该字段在偏移 64。因此注入块必须在 +52/+56 与 +60/+64 **各写一份**
   （`codeGenModulesCount` / `codeGenModules`），两端才都能命中。
3. **`genericMethodPointers` / `invokerPointers` 必须给足长度的全零占位数组**：`Il2Cpp.Init()` 会执行
   `genericMethodPointers[table.indices.methodIndex]`，长度不足就抛 `System.IndexOutOfRangeException`
   （表现为 `Init` 里莫名崩栈）。两个关键细节：
   - `Il2CppGenericMethodFunctionsDefinitions` 自 v27.1 起含 `adjustorThunk`，**步长是 16 字节**（不是 12），
     按 12 推导会把占位长度算小一半；
   - 长度取 dumper 自己的 WebAssembly 阈值 `0x35000`（217088）最稳：既覆盖真实最大下标，
     又不会触发它 `genericMethodPointersCount > 0x35000` 的“版本位移”分支（那会把结构体基址挪偏 8 字节）。

修复后的自检标准（`analysis/il2cpp/analysis-summary.json`）：
```text
status: completed
validation: { status: "completed", typeDefinitions: <全部类型数>, mappedMethods: > 0 }
```
以 `Rodha 2` 为例：修复后 `typeDefinitions = 11265`、`mappedMethods = 63106`、`projectClasses = 530`，
并额外产出 `il2cpp.h`、`stringliteral.json` 与 90+ 个 `DummyDll/*.dll`；`dumper-failure.json` 会被自然清除。
重新解析请走与 Web 管理后台同一个入口（`analyzeCapturedGame`，即后台「开始解析」按钮），
不要手工拼装 `analysis/` 目录。

---

### 分支 B：LayaAir 3D (纯 JavaScript / TypeScript)
**典型游戏**：`Merge-Rush-2048`、`Battery-Run-3D`、`Cake-Art-3D`、`Color-Snake-3D-Online`、`Hair-Challenge-Online`、`Rubber-Ball-3D`、`You-are-Queen`。

此类游戏**完全没有 WASM 和 IL2CPP**，其所有代码均为原生 JavaScript（通常为打包后的 bundle）：
```text
download/[游戏目录名]/
  game/
    .../js/bundle.js        # 游戏核心业务代码（包含关卡、角色控制、碰撞响应）
    .../libs/laya.core.js   # Laya 引擎核心库（生命周期、Stage、事件系统）
    .../libs/laya.d3.js     # Laya 3D 渲染库（Scene3D、MeshSprite3D、Transform3D）
    .../libs/laya.physics3D.js # 物理引擎桥接
  analysis/
    report.json             # 静态分析总览，列出包含 player/position/input 等关键词的优先脚本
    source-index.json       # 符号索引与作用域
```

#### LayaAir 3D 逆向与调试技巧
1. **全局控制点探测**：LayaAir 游戏通常会在全局对象挂载控制器，如 `window.game`、`window.player` 或单例对象（如 `Laya.StageScene.Instance`、`Laya.GameUI.Instance`）；
2. **场景节点遍历**：通过 `Laya.stage._children` 遍历场景树，查找 `Laya.Scene3D` 实例及其子节点（角色、跑道、障碍物）；
3. **混淆字典还原**：若 `bundle.js` 包含混淆字典（如 `_0x...`），可在 `scripts/internal/` 编写反混淆脚本（如 `Merge-Rush-2048` / `Rubber-Ball-3D` 的 `decode-bundle.mjs`）还原清晰源码；
4. **原生事件注入**：自动化脚本可通过 Playwright 原生 `page.mouse` 拖拽或 `Laya.stage.event(Laya.Event.MOUSE_DOWN, ...)` 注入控制量。

### 分支 C：PlayCanvas（业务脚本未混淆，场景 JSON 压缩）

**典型游戏**：`Teeth-Runner`。

PlayCanvas 的发布目录里，业务逻辑被打包进 `__game-scripts.js`（按 `// 文件名.js` 分块拼接，通常保留真实类名），场景是 `<assetId>.json`，资产注册表是 `config.json`。反编译的重点不是「还原」，而是**切分 + 建索引 + 解压场景**：

```bash
npm run playcanvas -- download/[游戏目录名]
# 等价：node scripts/analyze-playcanvas.mjs download/[游戏目录名]
```

产物（`analysis/playcanvas/`）：

- `game-scripts/NN-<原文件名>.js`：按标记切回的原始脚本，页首标注打包桶起始行号；
- `scripts.json`：`pc.createScript` 注册表（脚本 id → 类名、文件、行号、`attributes`、方法、生命周期）+ 辅助文件清单；
- `scenes.json` 与 `scenes/*.tree.json`：每个场景的实体数、脚本使用直方图与还原后的实体树；
- `summary.json`：计数、脚本包 sha256、资产类型分布、能力边界。

**场景压缩解码（关键，取自引擎 `playcanvas-stable.min.js`）**：
- 单字符键：`index = charCode - fieldFirstCode`；
- 双字符键：`index = ((c0 - fieldFirstCode) * fieldCodeBase) + (c1 - fieldFirstCode)`；
- 必须**递归**解码（`components` 内部同样是压缩键），脚本 id 在 `components.script.scripts` 的键上；
- 实体变换在 `___1` / `___2` 里指向场景级 `singleVecs` / `tripleVecs`；若场景里没有这两张表，坐标随**模板资产**（`files/assets/<id>/1/*.json`，未压缩）下发，需另解模板才能拿到位置。

**策略提示**：这类游戏的无限关卡常由 `proceduralLevelGenerator` 之类脚本按概率参数现场拼装（模板槽位 + 间距/概率），先读属性即可掌握关卡分布，不要盲试。

---

## 三、 极速录屏与逐帧时钟铁律（所有游戏通用）

为确保录制的视频达到 60 FPS 满帧、绝对流畅无停顿、零掉帧、零首秒跳跃与重复帧，必须严格遵循以下录屏铁律：

### 铁律 1：强制开启 GPU 硬件加速基线（无头游戏 CPU 破局）
Playwright 无头 Chromium 启动时，默认禁用显卡加速并将 3D 渲染降级到 CPU 软件栅格化，导致录制严重卡顿掉帧。  
**标准规范**（定义于 `src/game-video-recorder.mjs`）：
```javascript
export const recordingBrowserArgs = [
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion',
  '--autoplay-policy=no-user-gesture-required',
  // 显式开启 GPU 硬件加速
  '--ignore-gpu-blocklist',       // 越过无头模式下的 GPU 黑名单
  '--enable-gpu-rasterization',   // 强制 GPU 栅格化渲染 WebGL Canvas
  '--enable-zero-copy'            // 零拷贝内存架构加速跨线程开销
];
```

### 铁律 2：时钟绝对对齐（严禁使用外部定时器盲采与伪时钟劫持）
* **定时器盲采的陷阱**：严禁使用带固定帧率参数的盲采 `canvas.captureStream(60)`！外部盲采定时器每 16.66ms 触发一次，与游戏内部 `requestAnimationFrame` 实际绘制存在毫秒级相位差，极易发生时间戳撕裂与画面顿挫。
* **无参逐绘制帧标准捕获**：  
  必须使用无参原生 `canvas.captureStream()`（在录制器配置中开启 `captureEveryFrame: true`）。  
  **原理**：让 MediaStream 直接监听 WebGL Canvas 的每一次实际 `Draw` 事件，做到“绘制一帧、录制一帧”，实现逐帧绝对同步。
* **【致命避坑铁律】严禁在外部通过伪时钟或自定义 1px Canvas 粗暴劫持 `window.requestAnimationFrame`**：
  - **反面典型（严厉禁止）**：像某些老脚本引入 `render-clock.mjs`，在页面外部创建一个隐藏的 1px 画布，并在 `window` 层覆盖 `requestAnimationFrame`，试图强行将所有回调约束在自定义的 60Hz 步长内（例如包含 `if (time - next > 1000/60) next = time + 1000/60` 的重置逻辑）。
  - **为什么会导致开头 0~1 秒卡顿**：
    1. Chromium 本身开启硬件加速后，渲染合成器（Compositor）内部已具备高精度的硬件 VSync 调度；
    2. 在游戏从开始界面切换到正式跑酷场景的第 0 秒，主线程需要加载/激活 3D 预制体、初始化赛道实体，会产生瞬间微小的耗时（约 15~30ms）；
    3. 此时外部劫持的伪时钟节拍器会误判超时并强行重置 `next` 节拍，**直接导致这几帧的 rAF 回调被推迟、丢弃或产生长达 33~50ms 的跳变断档**！
    4. WebGL 主画布 `layaCanvas` 出现绘制空档，`captureStream()` 捕获的时间戳（PTS）严重不均匀。转码压制为恒定 60 FPS (CFR) 时，FFmpeg 只能被迫复制上一帧画面填补空隙，直观表现为视频开头 0~1 秒出现肉眼可见的停顿、卡顿与画面断层！
  - **铁律要求**：彻底移除任何第三方 1px Canvas 或覆写 `window.requestAnimationFrame` 的伪时钟工具，完全信任并使用浏览器原生 `requestAnimationFrame` 与无参 `canvas.captureStream()` 逐绘制帧捕获。

### 铁律 3：游戏 3D 渲染与 1080P 还原原则（兼顾 LayaAir 原生 1080P 渲染规范）
* **物理分辨率与渲染负载**：Canvas 实时渲染分辨率直接决定 WebGL 着色器像素填充负荷。  
  - 原始工程为 720P 或 450P 时，直接放大可能造成锯齿与模糊；
* **动态分辨率基线**：
  1. **高性能 3D 游戏（如纯净 LayaAir 3D 跑酷）**：实测页面刷新稳定在 59.0 ~ 60.0 FPS 时，直接将 Playwright 视口设为物理原生 **`1080 × 1920`**，开启 `SCALE_SHOWALL` 与硬件抗锯齿（`Config.isAntialias = true`），各向异性过滤设为 16x（`anisoLevel = 16`），获得无损超清实机录制；
  2. **高负载场景/多同屏实体**：若直接 1080P 渲染导致帧率低于 58 FPS，则保持游戏以 720P 原生满帧运行，录制后交由 FFmpeg 离线 Lanczos 算法超分辨率放大，绝不能在游戏运行时拖垮渲染主线程。

### 铁律 4：GPU NVENC 硬件极速转码与 CPU 隔离长跑安全双基线

> [!WARNING]
> **【致命冲突警示：单显卡 NVENC 硬件转码与 WebGL 3D 渲染并发死锁风险】**
> 虽然 NVENC 硬件编码极快（单片 1.8~2.0 秒），但在**高负载 3D WebGL 游戏长程百关（1~100 关连续数小时）录制**中，Chromium 的 WebGL/ANGLE 渲染上下文与 FFmpeg NVENC 在 NVIDIA 驱动（`nvlddmkm.sys`）和 D3D11 调度器中极易发生资源抢占死锁或 TDR（超时检测与恢复），致使桌面窗口管理器（DWM.exe）崩溃并触发系统 BugCheck `0xEF CRITICAL_PROCESS_DIED` 蓝屏甚至断电关机！

* **双基线调度规范**：
  1. **日常单关调试 / 轻量 2D 游戏**：自动探测宿主显卡并启用 `h264_nvenc`（`-c:v h264_nvenc -preset p4 -cq 20`），实现单片 ~2 秒极速导出。
  2. **【长跑百关 / 复杂 3D 游戏唯一推荐安全基线】CPU 隔离安全转码**：
     - 启用 CPU 快速多线程软解压制：`-c:v libx264 -preset fast -crf 18 -threads 4`；
     - **实测表现**：锁定 4 线程时，单片 1080P 转码仅耗时约 8 秒，仅占用 20%~25% CPU 算力，与显卡的 3D WebGL 渲染实现**物理级完全隔离**；
     - 彻底消除与 Chromium 抢占 GPU 显存与驱动上下文的死锁隐患，百关长跑 0 蓝屏、0 关机、0 崩溃；
     - 支持通过统一环境变量注入：`GAME_FORCE_LIBX264=1` 与 `GAME_FFMPEG_THREADS=4`。

### 铁律 5：录制前全量预热 WebGL 3D 着色器（Shader）、动态道具材质与音频
* **Shader 冷编译卡顿根因**：游戏在加载完成时，即便通过 `Laya.loader.create` 下载了 3D 资产，底层 WebGL / ANGLE (D3D11) **在首个 Mesh 真正提交给 GPU 渲染之前，并不会预先编译着色器（`gl.compileShader` / `gl.linkProgram`）**。首次触发时会引起主线程 150ms ~ 220ms 的瞬间卡顿！
* **【致命避坑铁律】动态赛道道具/模型/材质的 Shader 全量预编译**：
  - **跑酷游戏的次级冷编译陷阱**：在跑酷与通道堆叠类游戏中（如 Coffee Stack、Merge Rush），空杯、咖啡液体、牛奶层、杯盖、吸管、包装等各类模型都是在赛道上动态生成的；
  - 若仅预热了主相机和开局静态模型，在角色跑出第 0.5~1 秒、首次碰到赛道新道具或生成新形态时，LayaAir 会突发提交这些动态材质的着色器编译，造成前 1 秒内突发单帧掉帧（33ms~80ms）；
  - **标准要求**：在录制启动前的 `warm()` 阶段，遍历场景引用的动态 Prefab 及其 Material，强制进行一次离屏渲染或着色器预编译，确保进关首秒 0 掉帧。
* **强制全量预热流程规范**：
  1. 自动化脚本在初始化完成、**正式调用 `recorder.start` 录制第 1 关之前**，必须执行一次全量 GPU 渲染预热：
     - 将游戏中所有核心 3D 特效预制体在相机视野内渲染约 200~250ms，迫使 WebGL 驱动提前完成全套 Shader 编译；
     - 预先播放并立刻静音一次所有动态音效与音轨；
     - 遍历所有动态材质与贴图并强制上传 GPU 纹理显存；
  2. 预热完成后，刷新并恢复正常游戏状态，再正式开启录制。

### 铁律 6：编码器冷启动预热与起跑时序原子对齐（开头停顿零放行铁律）
> **核心质量红线**：所有录制出的成片必须逐关检查开头 0～2 秒。**成片开头绝不允许出现任何静止停顿、抽搐重复画面或位移瞬移**！即使平均 FPS 达标、标称 60 FPS 且完整解码通过，只要开头画面存在非原生停顿，一律判定为不及格，必须定位、重录并重新验收！

#### 6.1 录制截断起点 (logicalStart) 与原生起跑事件的原子对齐铁律
* **错误模式分析（起跑时序严重倒置错位）**：
  ```javascript
  // ❌ 严重错误示范：游戏起跑早于录制截断，造成截断点落在运动中间
  if (record) await recorder.prepare(level); // 启动 MediaRecorder，此时未记录 logicalStart
  await page.evaluate(() => __coffee.click(menu.btn_startGame)); // 点击开始游戏
  await page.waitForFunction(() => views().trial || views().play); // 等待 UI 切换
  await page.waitForFunction(() => views().play && game.isStartGame); // 此时底层已经进入起跑滑行！
  await page.evaluate(() => cleanUI()); // 耗时清理操作
  const mediaInfo = await recorder.start(level); // 晚于起跑才记录 trimHeadSeconds (logicalStart)！
  await page.evaluate(() => __coffee.begin()); // 此时才派发输入
  ```
  - **机理剖析**：
    1. 在调用 `recorder.start()` 之前，角色已经开始位移并滑行了一段；
    2. `recorder.start()` 记录的时间戳恰好落在了运动中途与等待输入之间；
    3. FFmpeg 以 `-ss trimHeadSeconds` 切割视频时，切点前后缺失关键帧，或落在静态等待帧；
    4. 结果导致最终成片呈现为：“画面静止定格约 0.5~1 秒，随后咖啡杯突然向前瞬移”。
* **标准规范（原子对齐平滑起跑方案）**：
  ```javascript
  // ✅ 标准原子对齐起跑规范
  if (record) await recorder.prepare(level); // 启动媒体管道流
  // 1. 等待场景加载完毕、主关卡完全就绪
  await page.waitForFunction(() => views().play && isReady);
  // 2. 彻底清理并隐藏所有教学手势、常驻按钮与弹窗
  await page.evaluate(() => cleanUI());
  // 3. 等待主画面渲染稳定 2 帧（保证首帧构图完美静止且已绘制完成）
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  // 4. 精准打下录制截断逻辑起点 (logicalStart / trimHeadSeconds)
  const mediaInfo = record ? await recorder.start(level) : null;
  // 5. 紧随其后在同一次调用或微任务中派发原生起跑事件（MOUSE_DOWN / begin）
  await page.evaluate(() => dispatchGameStart());
  ```
  - 成片从第 0 秒起呈现为前 0.1~0.2 秒完美的起跑前静止画面，随后角色丝滑起步，彻底杜绝开头定格与跳帧。

#### 6.2 编码器预热与缓冲区零开销
1. **录制器必须优先开启 `deferChunkWrites: true`**：MediaRecorder 在录制期间只把 Blob chunk 推入内存数组，关卡结束才一次性写盘，杜绝录制期间主线程与 Node I/O 竞争造成的卡顿；
2. **首帧运动窗口交叉验证**：录制完成后，通过 FFmpeg 分析首秒运动变化，确认第一秒内有效位移平滑连续，杜绝静止超过 0.1 秒的坏片流出。

---
## 四、 自动化脚本架构与改进工作流

所有游戏的自动化脚本统一遵循四层架构，并收敛在各自游戏的 `scripts/internal/` 目录下：

```text
download/[游戏目录名]/scripts/
  play-auto.cmd               # 双击直接全自动跑关（不录屏，用于快速调试算法）
  record-auto.cmd             # 双击从第 1 关开始全自动录制
  record-from-level.cmd       # 双击提示输入起始关卡，无上限持续自动录制
  internal/                   # 仅存放正式生产运行核心脚本（严禁遗留临时测试/探针文件）
    play-auto.mjs / run-auto.mjs # 自动化主循环入口（关卡进度维护、录屏生命周期控制）
    adapter.mjs               # 游戏逆向适配器（内存读取、物理状态感知、原生事件/输入注入）
    strategy.mjs              # 核心决策层（寻路、速度规划、避障策略）
    game.mjs                  # 本地服务托管、Playwright 浏览器拉起与 WebGL 桥接
  .tmp/                       # 【用完即删】临时探针脚本（probe-*.mjs）与调试截图固定目录，交付前必须清空删除
  logs/                       # 真实关卡运行日志
  video/                      # 正式录制的逐关 1080P 60FPS 成品视频库
```

### 编写与改进脚本的标准工作流（六步法）

每个游戏保留一套正式脚本，明确唯一写入者，同一时间仅一条实机任务；先完成同版全流程纯游玩验证，再冻结版本进行录像质量验收。当前角色、模型及任务范围以用户最新授权为准。

1. **阅读指南并验证反编译正确性（首要前置步骤）**：
   - 接手或新建自动化时，**必须第一时间阅读或创建该游戏的专属 [`GAME_GUIDE.md`](#六-单游戏专属指南-game_guidemd-创建与同步维护铁律)**；
   - 按文首[最高优先级规则](#decompilation-correctness-gate)核对来源、产物内容和本次策略依赖；未通过先修解析，禁止进入后续自动控制与录制步骤。
2. **真实跑关复现与资源完整性核验**：
   - 通过 `play-auto.mjs --start-level N --levels 1` 运行目标关卡，观察角色行为并获取完整遥测日志；
   - **若跑关时发现游戏数据/资源缺失（404 / 加载报错）**：立即从远端拉取补齐缺失内容（`scripts/add-archive-resources.mjs`），并同步优化通用拉取与补全代码（[`src/asset-completer.mjs`](file:///c:/code/h5-game-archiver/src/asset-completer.mjs) / [`src/capture.mjs`](file:///c:/code/h5-game-archiver/src/capture.mjs)）；
3. **在固定临时目录编写探针脚本（`scripts/.tmp/`）**：
   - 若需编写探针脚本或导出调试截图以探测障碍物坐标、路径多边形与输入响应，统一创建在 `download/[游戏目录名]/scripts/.tmp/` 下，**严禁污染 `scripts/internal/`**；
4. **查阅反编译确认原生行为**：
   - Unity WebGL 游戏使用 `node src/wasm-function.mjs` 查看相关方法的实际 C-like 伪代码；
   - LayaAir 3D 游戏检索 `bundle.js` 相关类的事件监听器与属性更新函数；
5. **针对性修改正式脚本（`run-auto` / `strategy` / `adapter`）**：调整决策参数或优化状态桥接；
6. **成片核验、临时文件清理与文档同步沉淀（闭环关键步）**：
   - 运行带 `--record` 的单关或全量验证，检查导出的 MP4 成片与平均刷新 FPS；
   - **临时测试文件清理铁律**：验证通过后，**立即删除 `scripts/.tmp/` 下的所有临时探针脚本、测试文件与调试截图**，杜绝项目臃肿；
   - **文档同步铁律**：攻克特定游戏机制后，**必须立即将专有算法与排查心得回写更新至该游戏的 `GAME_GUIDE.md`**；若发现跨游戏通用机制，则同步更新本文档。

---

## 五、 跨游戏通用底层避坑指南

### 1. Unity WebGL (WASM / dlmalloc) 内存指针复用陷阱
* **现象**：同一关卡重试（Restart）或连续重载时，自动化主循环卡死在 `waitForFunction(old => inspect().p && inspect().p !== old)` 导致 30 秒超时强制退出，但截图显示场景早已重新加载完毕。
* **根因**：Unity WebGL 底层 C++ 分配器（dlmalloc）按相同顺序释放并重新分配内存块，新生成的组件指针极大概率恰好等于刚才的旧虚拟内存地址（`new_p === old_p`）。
* **铁律**：严禁仅依赖原生内存地址 `p` 判断场景/对象是否更新！必须通过 Unity 引擎层全局单调自增的唯一对象 ID 校验：
  ```javascript
  const id = b.invoke('UnityEngine.Object$$GetInstanceID', p);
  // 等待场景重建：
  await page.waitForFunction((oldId) => inspect().id && inspect().id !== oldId, oldId);
  ```

### 2. 寻路与策略计算削峰（杜绝主线程冻结）
* **陷阱**：在大型复杂关卡，A* 寻路或场景遍历如果在浏览器主线程同步执行，会占用数秒单线程死循环，导致 `requestAnimationFrame` 画面渲染循环完全停摆。
* **标准规范**：
  1. 寻路预算与状态解耦：深度记账静态规划时间，在计算复杂路径时分片让出主线程；
  2. 增量寻路或分段计算：优先使用路段锚点分段规划或动态缓存，严禁同步遍历庞大网格。

### 3. 浏览器内 60Hz 逐帧二阶速度阻尼平滑移动与穿块直行保持（杜绝“1 帧瞬移”、“18Hz 阶梯频闪”与“吃完瞬间急拐”）
* **三重陷阱**：
  1. **单帧无上限横移**：在通过鼠标/触控横向位移直接映射角色位置或间距的跑酷游戏中（如 $\Delta x = k \cdot \Delta \text{mouseX}$），若单帧直接移动全部误差量，会导致角色在 **1 帧内横跨赛道瞬移**，并将身上的 3D 粒子光圈拉成斜向残影；
  2. **外部 Node.js 跨进程 `page.mouse.move` 阶梯频闪（“一闪一闪”）**：若在浏览器外部的 Node.js 循环中执行 `waitForTimeout(25)` + `page.evaluate` + `page.mouse.move`，由于跨进程 CDP 通信往返耗时约 $45 \sim 55\text{ ms}$，鼠标每 **3～4 个 WebGL 渲染帧（仅约 18Hz）** 才移动一次——表现为角色在 60 FPS 视频中“横向静止 3 帧 $\to$ 突然横跳几十像素 $\to$ 再静止 3 帧”，肉眼呈现明显的频闪/一闪一闪感；
  3. **吃道具前表面触发瞬间急拐**：3D 碰撞体在角色前缘刚接触道具前表面（距离道具中心还有约 $0.5\text{ m}$）时即触发拾取回调并更新数值。若规划器立即将目标切向下一排并以最大加速度横移，角色会在还没跑过该道具、销毁动画刚开始的那一瞬间突然斜向横甩。
* **标准规范**：
  1. **植入浏览器渲染帧循环（`requestAnimationFrame` / `Laya.timer.frameLoop(1)`）**：必须将实时路径规划与横向移动驱动植入浏览器内部，与每一帧 WebGL 渲染 $100\%$ 同步（每秒连续更新 60 次，0 帧断档）；
  2. **穿块直行保持（Post-Eat Straight-Through Hold）**：当检测到角色刚拾取/合成道具时（只要前方 $2.5\text{ m}$ 内无紧急陷阱），保持当前横向车道并归零横向速度直行约 $0.85\text{ m}$（约 $0.2\text{ s}$），待角色身体完整穿过道具模型后再平稳启动下一段变道；
  3. **基于前方距离 $\Delta z$ 的二阶钟形阻尼平滑曲线（Ease-In / Ease-Out）**：每帧按距下一排目标的可用时间 `availTime` 动态规划温和的速度上限 `adaptiveMaxSpeed`，以柔和起步加速度 `accelRate` 平滑提升横向速度 `vel += (desiredVel - vel) * min(1, dt * accelRate)`，再通过原生鼠标回调注入单帧微位移 `step = vel * dt`，实现“穿块直行 $\to$ 柔和起步 $\to$ 匀速丝滑滑行 $\to$ 柔和减速落位”的真人观感。

### 4. 跑酷角色横向微步震颤与极限环高频抖动根除铁律（Deadband / Slew-Rate Limiter / Hysteresis）
* **视觉瑕疵机理（视频播放时角色剧烈左右晃动/高频颤抖）**：
  1. **无死区（No Deadband）与符号函数 Bang-Bang 极限环振荡**：
     - 其内部 `data.fis` 所指路径（如 `"raw-assets/star/8bZ.bin"`）本身是**相对于游戏根目录**的路径；
     - 若将其作为相对路径与 `app-manifest.json` 自身 URL 拼接，会解析出畸形的 `raw-assets/raw-assets/...`，导致本已在本地存在的真实资源被误判为 404 缺失，触发“归档缺少核心游戏资源”误报；
  3. **LayaAir 二进制场景/反射探针（`.ltcb.ls`）误当 JSON 解析崩溃**：
     - LayaAir 3D 导出中的天空盒/反射探针 `MainSceneGIReflection.ltcb.ls` 文件扩展名为 `.ls`，但底层实质是二进制格式（以 `LAYATEXTURECUBE:0000` 开头），非 JSON 字符串。强制执行 `JSON.parse` 会抛出语法异常并计入 `scanFailures`，从而错误拉低归档完整度评级。
* **通用工程标准规范**：
  1. **`fileconfig.json` 结构化识别与图集子帧注册**：
     - 将 `fileconfig.json` 纳入容器文件优先处理队列；匹配 `isLayaFileConfig` 模式时，将其中所有 `fullF`（带前缀）与 `cleanF`（裸名）全量注册入 `atlasFrames` 集合，同时仅拉取其对应的 `.atlas` 主文件，严禁将子帧作为独立单图下发网络请求；
  2. **`app-manifest.json` 全量对齐 Game Base**：
     - `data.fis`、`data.json` 与 `data.raw` 中的所有资源映射统一针对游戏根基准（`base`）进行 URL 解析，杜绝多级目录重复叠加；
  3. **非 JSON 文本优雅跳过**：
     - `scan()` 对 `.ls` / `.lh` 执行 JSON 解析前，必须校验文本是否以 `{` 或 `[` 开头；凡属于 `LAYATEXTURECUBE` 等二进制资产直接跳过文本扫描，杜绝虚假 `scanFailures`。
---


### 5. Coffee Stack 跑酷通道类游戏 0~1s 停顿专项复盘与修复检查表
* **背景与问题定位**：在 `Coffee Stack` 等 LayaAir 3D 跑酷游戏中，部分录制批次在前 0~1 秒出现约 0.5~1 秒的画面定格与随后的位移瞬移。通过深入排查，确认了三大核心诱因：
  1. **起跑与录制时序倒置**：`btn_startGame` 点击过早，Laya 内部 `isStartGame` 已经跑动，而 `recorder.start()` 在经过多层异步等待和 UI 清理后才打下 `trimHeadSeconds` 截断标记。FFmpeg 根据截断时间切割视频时切断了连续运动流，导致定格与瞬移；
  2. **`render-clock.mjs` 外部伪时钟抖动**：外部 1px Canvas 劫持 `window.requestAnimationFrame`，在场景切换产生 20ms 微小延迟时触发重置，导致数帧回调丢失，WebGL 主画布跳帧；
  3. **赛道动态杯子/材质未在预热期编译**：赛道上的空杯、咖啡液体、包装等动态 Prefab 未在开局前编译 Shader，进入赛道后首秒突发着色器编译卡顿。
* **专项实战修复检查表**：
  - [x] **移除外部伪时钟**：彻底废弃 `render-clock.mjs`，依托 Chromium 原生硬件 VSync 与无参 `canvas.captureStream()` 捕获；
  - [x] **起跑原子对齐**：必须在 `PlayView` 完全就绪、UI 清理完毕、静止画面稳定渲染后，先调用 `recorder.start()`，紧接着同微任务派发 `__coffee.begin()` 原生起跑；
  - [x] **动态 Mesh 全量预热**：在 `warm()` 中克隆动态赛道预制体并执行一次预渲染，消除动态着色器编译延迟；
  - [x] **开头连续性验收**：通过 FFmpeg 扫描前 2 秒视频，确保无任何非原生静止帧（静止时长 $\le 0.1\text{s}$）。

### 6. Windows WebM 容器时间戳微量量化抖动容差基线 (42.0ms 容差 vs 33.4ms 误判)
* **背景与现象**：在长程自动化录制中，偶发出现实际平均刷新 60.01 FPS、平均编码 60.00 FPS、全片零卡顿的优质成片，却在验收门禁处被 `原始编码开头丢帧: maxGapMs=39.0ms > 33.4ms` 异常抛错拦截并触发无效重试。
* **底层根因分析**：
  1. 在 Windows 平台 D3D11 SwapChain 环境下，Chromium 的 `MediaRecorder` 在向 WebM 容器打包离散音视频 Chunk 时，时间戳受操作系统计时器分辨率限制（$\pm 3\sim 6\text{ms}$ 抖动）；
  2. 60 FPS 基准下单帧间隔为 $16.67\text{ms}$，两帧间隔为 $33.33\text{ms}$。若偶发产生单次微量量化抖动（如两帧间隔实测为 $33.33 + 5.67 = 39.0\text{ms}$），紧随其后的下一帧必定在毫秒级内追平（平均帧率仍锁定 $60.00\text{ FPS}$）；
  3. 旧版硬编码的 `33.4ms` 门禁（相当于 $33.33\text{ms} + 0.07\text{ms}$）对操作系统级时钟离散存在零容忍误判，将正常的 39ms 抖动误杀为丢帧。
* **工程修复基线**：
  - **开局与全片动态容差**：将 `encodedOpening.maxGapMs` 与 `encodedContinuity.gaps` 的判定阈值统一校准为 **$42.0\text{ms}$**（即两帧间隔 $33.33\text{ms} + 8.67\text{ms}$ 容差）；
  - **严守真实卡顿红线**：人眼视觉暂留时间约为 $50\text{ms}$（即连续丢失 3 帧及以上）。$42.0\text{ms}$ 阈值既完全吸收了 Windows WebM 容器的偶发量化毛刺，又能 $100\%$ 拦截任何 $\ge 50\text{ms}$ 的实质性卡顿；
  - **双重刚性基线互锁（帧率大于 59 即可合格）**：全片强制满足 `averageRefreshFps >= 59.0` 与 `averageEncodedFps >= 59.0`（统一基线为大于 59 即可达标合格，杜绝 59.1～59.4 FPS 微量时钟抖动引发无效重录），确保标称 60 FPS CFR 成片绝对真实满帧。支持通过 `GAME_MIN_FPS=59.0` 统一环境变量注入。

### 7. 全局高阶通用法则与新游戏自动化极速落地指南（基于 10 款全量百关实战经验沉淀）

通过对 10 款代表性游戏（包括 Going Balls、Merge Rush 2048、Count Masters、Coffee Stack、Join Blob Clash、Pencil Rush、Man Runner 2048、Build A Queen、Bubble Shooter、Snake Run Race 等）1~100 关的全量真实通关与 60 FPS 录制交付，沉淀出以下跨引擎、跨玩法的通用指导法则，供后续所有新游戏自动化开发秒级复用：

#### 7.1 关卡级物理独立浏览器进程生命周期隔离（Process-Level Isolation per Level）
* **底层机理**：在 Chromium 中，即使在同一浏览器实例内通过 `browser.newPage()` 与 `page.close()` 重复创建页面，连续录制 5~10 关后，Chromium 底层的 GPU Process、Direct3D11 SwapChain 设备上下文以及 Mojo MediaStream IPC 管道极易发生句柄泄漏或内部死锁，导致后续页面的 `canvas.captureStream()` 视频帧无法跨进程投递（表现为录制状态为 `recording` 但 `Chunks=0`，产出 0 字节断流）。
* **标准落地模式**：
  - 每一个关卡在 `playOneLevel(level)` 中独立启动全新的物理级 Chromium 实例：`const browser = await launchBrowser();`
  - 关卡结算（无论是 win、defeat 还是 exception）后，在 `finally` 块中严格执行 `await page.close()` 与 `await browser.close()`，彻底由操作系统回收该关卡的全部显存、D3D11 设备与 V8 堆内存；
  - 实测物理启动 Chromium 仅需 ~350ms，相比 40~60 秒的关卡录制流程性能开销小于 0.8%，但可达成 **100 关长程自动化 0 内存泄漏、0 断流、100% 稳定性**。

#### 7.2 视锥内多阶段着色器与动态 Prefab 预编译法则（Multi-Stage In-Frustum Shader Pre-warming）
* **底层机理**：很多 3D 跑酷/动作游戏开头 0~1 秒由于画面静止并不掉帧，但中途遇敌（如 Z=-230 处敌人入屏）、过终点线（碰撞触发爆开粒子）或相机飞跃至 Boss 擂台时，会突发 100ms~250ms 的严重停顿，导致原始编码帧率跌破 59.5 FPS。根因是 WebGL 着色器（Shader Program）和 3D 材质仅在**首次进入相机视锥（Frustum）并被 GPU 实际光栅化渲染**时，驱动才会现场编译（Compile Shader & Link Program）。
* **标准落地模式**：在菜单已加载、开跑前的准备期（`prepare()` 之后、正式 `start()` 之前），执行三阶段视锥内预编译：
  1. **终点场景与相机动画预热**：将相机临时瞬移至终点擂台/终点门，播放飞跃动画（如 `CamtoBoxing`），点亮终点 UI（`Hpbar`）与 Boss 材质，渲染 8 帧强制 GPU 预编译终点全套着色器；
  2. **动态敌人与粒子系统预热**：在主角正前方 5 米处实例化敌人 Prefab（`Laya.Sprite3D.instantiate(enemy)`），将通关粒子（`FX_star`）、死亡粒子（`FX_Dead`）激活并放置于相机正前方渲染 8 帧；
  3. **状态复位与稳定归位**：销毁临时预热实体，将相机和主角复位回初始赛道起点，静止稳定 10 帧后再正式打下 `recorder.start()` 标记并派发原生起跑输入。全片中途将彻底告别任何现场编译卡顿。

#### 7.3 物理实体对象池与“黄金甜点区间”动态规划（Object Pooling & Sweet-Spot Planning）
* **底层机理**：在人群倍增或道具堆叠类跑酷中，主角穿过倍增门瞬间若同步执行几十上百次 `clone()`，会引发 80ms+ 的同步卡死；且如果终点集结 50+ 个实体并发执行位移动画（Tween），会严重阻塞主线程，导致终点阶段帧率暴跌。
* **标准落地模式**：
  - **实体物理对象池（`_blobPool`）**：在开局预热阶段预先克隆 20~25 个实体放入隐藏对象池。过门增减人数时优先从对象池 `pop()` 与 `push()`，杜绝动态内存分配与 GC 尖峰；
  - **“黄金甜点区间”动态规划**：跑酷策略无需盲目追求将队伍规模最大化到几百人（过大的人群只会造成骨骼更新爆炸和物理摩擦）；将队伍目标规模严格控制在“既能 100% 稳胜关底 Boss，又极致轻量”的甜点区间（如 12~16 人），门评分算法据此动态调整优先级；
  - **终点合体裁剪与 Tween 降级**：冲线合体前，若队伍超过 14 人，在后台静默裁剪多余实体回对象池，确保参与终点缓动动画的实体上限不超过 14 个，彻底消除主线程拥堵。

#### 7.4 手机移动端（Mobile 9:16）原生真机模拟与舞台数学对齐（Mobile Emulation & Stage Math）
* **底层机理**：同一个 H5 游戏在电脑桌面打开与手机打开时布局差异巨大（PC 端常附带侧边栏、评分条、桌面包装脚本 `game_pc-*.js`、甚至由于宽屏视锥导致视角形变）。录制必须完全还原玩家在智能手机全屏运行的原生体验。
* **标准落地模式**：
  - **移动端环境模拟**：Playwright 启动页面时显式配置 `isMobile: true`、`hasTouch: true` 与移动端 `userAgent`（如 Pixel 7 Pro），确保引擎内部环境探测 100% 命中移动端；
  - **绕过 PC 外壳直达原生入口**：直达 `index.html`，绝不加载聚合站 PC 页面；
  - **舞台自适应数学对齐**：对于 LayaAir 等引擎，设计分辨率强制对齐 9:16（如 $750 \times 1333.333$），配合 `scaleMode = 'showall'`，在 $1080 \times 1920$ 视口下缩放比为精确且均匀的 $1.44$，生成 0 黑边、0 形变的物理原生 $1080 \times 1920$ WebGL 缓冲；
  - **全景广角透视补偿（Panoramic FOV）**：进关后动态将 3D 相机视野提升至 $70^\circ \sim 75^\circ$，拓宽视锥，消除竖屏默认视锥过窄导致画面狭窄拥挤的感觉；
  - **极致纯净实机画面**：彻底清除/隐藏教学手势图标（`ctrhint` 手指/箭头）、常驻暂停按钮（`pauseBtn`）、调试信息，确保录制出的画面为极致纯净的实机演示。

#### 7.5 速度铁律与长程流水线设计（Native 1.0x Baseline & Resumable Infinite Runner）
* **原生 1.0x 速度铁律**：录制必须默认强制锁定原生 1.0x 真实游戏速度（`--speed 1.0`）。未经用户明确指定的加速（如 1.5x、2.0x）严禁擅自启用；
* **断点秒级续录（Skip-Existing Resumption）**：关卡主循环在开启新页面前优先探测目标目录下的成片文件 `level-XXXXXX.mp4`，若文件存在且大小正常（$> 1000$ 字节），在 0ms 内输出跳过日志并自增 `currentLevel`，支持随时中断、随处无缝续跑；
* **用户日常脚本设计（默认持续无限推进）**：交付给用户日常使用的脚本（`record-auto.cmd`、`play-auto.cmd`），必须设计为默认持续无限运行模式（`--levels 0` 即持续循环录制 101, 102... 推进下去），只要用户不按 Ctrl+C 就不停止。

#### 7.6 录制中间文件与目录自收敛闭环（Intermediate Capture Auto-Pruning & Name Normalization）
* **录像目录单一纯净**：所有视频必须保存在各自的 `scripts/video/` 下，每个游戏只保留唯一一个正式批次目录；视频目录树内只放视频，报告与元数据存入 `scripts/recording-data/[同名批次]/`；
* **隐式 capture 碎片秒级清理**：录制器在发生重试或被用户手动中止时，遗留在磁盘上的临时捕获流（`.level-*.capture.webm`、`.encoding.mp4`）极占空间（单关 80~150MB）。必须确保在关卡结束或重试时自动执行 `rm(clip.raw, { force: true })`，杜绝磁盘隐式膨胀；
* **重试成片规范化归一**：经由重试成功导出的成片如果带有 `-attempt-N` 后缀（如 `level-000051-attempt-2.mp4`），必须在录制完成后自动归一化重命名为标准的 `level-000051.mp4`，确保成片文件编号严格连续。

#### 7.7 新游戏自动化极速落地“五步标准化流水线”（Five-Step Rapid Implementation Workflow）
后续为任何全新游戏编写自动化与录制脚本时，严格按照以下五步流水线推进，可在 1~2 小时内实现高质量通关与成片交付：
1. **第一步：环境探测与单例拦截（0~15 分钟）**  
   查看 `analysis/report.json` 确定引擎。通过 `page.addInitScript` 拦截底层原型（`Object.prototype` 属性钩子），获取全局核心单例（如 `SceneManager`、`PlayerController`、`UIManager`、`InputManager`），并底层穿透拦截一切皮肤试用（`View_Trial`）与转盘抽奖（`View_OverAdd`）弹窗。
2. **第二步：真机视口与纯净 UI 对齐（15~30 分钟）**  
   配置 Playwright 移动真机模拟（`isMobile: true`, 1080x1920），修正舞台设计分辨率与 `showall` 缩放，将相机视野拓宽至 FOV 70，清除开屏教学手势与常驻暂停图标。
3. **第三步：纯物理拟人控制与轻量决策（30~60 分钟）**  
   从反编译代码中推导原生输入坐标换算公式（如 `stageX = startpos.x - 50 * (targetX - offset)`），施加最大单帧横移速度限制（防瞬移），派发原生 `MOUSE_MOVE` 或 Touch 事件。根据前方 40~50 米内的道具/门计算净收益并选择最优通道，遇致死障碍物动态规避。
4. **第四步：视锥内多阶段着色器预热与对象池（60~80 分钟）**  
   在开跑前执行三阶段视锥内预渲染（终点擂台/Boss -> 敌人 Prefab/粒子 -> 归位起点），并在小兵/堆叠增减处挂载轻量物理对象池，将队伍规模锁定在甜点区间，彻底消除 WebGL 现场编译卡顿。
5. **第五步：独立进程录制集成与百关长程推演（80~100 分钟）**  
   封装 `playOneLevel` 物理进程隔离循环，验证第 1 关 1080P/60FPS CFR 零卡顿成片（`Refresh FPS >= 59.0`（大于 59 即可达标）, `maxGapMs <= 42ms`）；通过后一键启动 1~100 关全自动流水线，直达最终交付！

### 8. 长程百关录制防主机断电关机、BugCheck 蓝屏（0xEF / 0x1A / 0xc0000006）与 SSD 掉盘终极避坑实战 [重要]

> [!IMPORTANT]
> **【高负荷自动化长跑必备工程防御指南】**
> 本规范基于在高性能开发机（Intel Core i9/AMD Ryzen + NVMe PCIe 4.0 SSD 如三星 980 PRO + NVIDIA RTX 独立显卡）上跑 1~100 关长程录制时遭遇电脑连续意外断电关机和蓝屏重启的真实排查与根除经验整理，所有游戏自动化录制工程必须严格遵照执行！

#### 8.1 故障现场征兆与系统事件复盘
* **外部表象**：
  - 录制运行到第 40~70 关或连续运行 1~2 小时后，电脑毫无预警直接**黑屏瞬间断电关机**；
  - 或突发蓝屏重启，停机码包括：`0x000000EF CRITICAL_PROCESS_DIED`、`0x0000001A MEMORY_MANAGEMENT`、`0x00000154 UNEXPECTED_STORE_EXCEPTION`；
  - 查看 Windows 事件查看器（`eventvwr.msc`）：
    - 出现大量 `volmgr` 事件 ID 161：“创建故障转储失败，因为在创建期间发生错误。”（`0x00040049`）；
    - 紧随 `Kernel-Power` 事件 ID 41（系统未先正常关闭而重新启动）；
    - BugCheck 参数为 `0xc0000006 STATUS_IN_PAGE_ERROR`，表明操作系统在尝试从磁盘分页文件读取内存页时底层 I/O 请求失败。

#### 8.2 三大根因深层解剖
1. **根因 1（硬件与电源策略）：PCIe 动态省电 (ASPM) 导致 NVMe SSD 瞬间掉盘**
   - Windows 11/10 默认电源方案为“平衡（Balanced）”，默认对 PCI Express 开启了**链接状态电源管理（ASPM = Moderate power savings）**，并开启了**20 分钟硬盘休眠（DISKIDLE = 1200s）**；
   - 游戏录制在关卡内处于大并发高频写入状态，通关时有 1~2 秒等待下一关或转码的间歇；
   - 在此间歇内，PCIe 链路控制器迅速退入 L1/L1.2 极低功耗省电状态；当下一次大吞吐写入突发到达时，NVMe 主控或 PCIe 物理层唤醒延迟超过驱动容限，产生 PCIe 掉盘或虚拟内存缺页异常 `STATUS_IN_PAGE_ERROR (0xc0000006)`；
   - 由于系统盘掉线，Windows 连崩溃转储文件（`MEMORY.DMP`）都无法写入磁盘（导致 `volmgr 161`）；主板 BIOS/UEFI 硬件看门狗在总线失去响应或检测到供电异常时触发断电保护，导致电脑直接关机。
2. **根因 2（跨进程通信与内存洪峰）：CDP 并发 Base64 击穿 Windows LPC 缓冲区**
   - 录制脚本使用 `chunkTransport: 'binding'` 模式时，每关结束瞬间将整关 100~200 个 WebM 分块全部在内存中并行转为 Base64 字符串（内存瞬增数百兆）；
   - 随后在 1ms 内向 CDP WebSocket 并发投递上百个请求，瞬间打爆 Chromium Mojo IPC 与操作系统的 LPC/ALPC 内核管道，直接杀死 Chromium 核心进程，进而波及宿主 Node.js 并触发 `0xEF CRITICAL_PROCESS_DIED`。
3. **根因 3（GPU 调度死锁）：NVENC 硬件编码与 WebGL 3D 渲染在单显卡上竞争**
   - Chromium WebGL 正在高负荷光栅化渲染，FFmpeg 又并发启动显卡 NVENC 编码器。两套异步 GPU 上下文在 NVIDIA 显卡驱动（`nvlddmkm.sys`）与 DirectX 调度器中抢占锁，产生 GPU 调度死锁或 TDR（超时检测与恢复），致使桌面窗口管理器（DWM）崩溃触发 `0xEF` 蓝屏或死机。

#### 8.3 五维一体彻底解决防御基线
1. **【系统层】彻底关闭 PCIe ASPM 与硬盘休眠（强制执行）**：
   在任何长期运行自动化录制的 Windows 机器上，使用管理员权限执行以下批处理命令，彻底禁用 PCIe 节能与硬盘休眠：
   ```powershell
   # 禁用交流电与直流电下的 PCIe 链接状态省电管理 (ASPM = Off)
   powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
   powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
   # 禁用硬盘空闲休眠 (Never sleep)
   powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_DISK DISKIDLE 0
   powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_DISK DISKIDLE 0
   # 立即激活当前电源方案
   powercfg /SETACTIVE SCHEME_CURRENT
   ```
2. **【通信层】强制切换 `chunkTransport: 'pull'` 串行流式传输**：
   - 在 `game-video-recorder.mjs` 中将传输模式默认值改为 `'pull'`，或通过环境变量 `GAME_CHUNK_TRANSPORT=pull` 锁定；
   - 页面端维持一个轻量队列，录制器每次仅 `queue.shift()` 一个分块，通过 `evaluate` 单块拉取、单块传输、单块落盘并立即被 V8 垃圾回收；
   - 全程内存占用稳死在 **`< 2MB`**，彻底消除 LPC 缓冲区爆炸与内存洪峰。
3. **【转码层】CPU 4 线程物理隔离转码（长跑稳定基线）**：
   - 百关长跑必须配置 `GAME_FORCE_LIBX264=1` 与 `GAME_FFMPEG_THREADS=4`；
   - 锁定 CPU 4 线程（`libx264 -preset fast -crf 18`），单关转码仅需 ~8 秒，CPU 占用率仅 20~25%，与显卡 3D 渲染物理级解耦，杜绝显卡驱动调度死锁。
4. **【温控层】关卡间强制 3 秒硬件物理冷却周期**：
   - 在 `run-auto.mjs` 关卡循环内成片与 checkpoint 保存后，强制加入冷却等待：
     ```javascript
     // 关卡间硬件物理冷却，给予 NVMe SSD 控制器释放 SLC Cache、GC 与降温窗口
     await new Promise(resolve => setTimeout(resolve, 3000));
     ```
   - 实测 3 秒冷却使 NVMe SSD 主控温度下降 8~12°C，SSD 读写延迟长期维持在 0.1ms 内。
5. **【进程层】Node.js 运行时内存防护**：
   - 启动命令统一加上：`node --expose-gc --max-old-space-size=4096 ...`；
   - 关卡结算关闭浏览器后，执行 `global.gc?.()`，确保 V8 堆内存绝不跨关卡泄漏。

---
## 六、 单游戏专属指南 (GAME_GUIDE.md) 创建与同步维护铁律

> **核心强制铁律**：  
> **后续在为任何新游戏编写自动化脚本，或为现有游戏扩展新特性时，必须在游戏根目录创建并持续维护该游戏的专属说明文档：`download/[游戏目录名]/GAME_GUIDE.md`！**  
> 任何没有编写或同步更新 `GAME_GUIDE.md` 的自动化代码，均视为**未完成交付**！

### 1. 为什么必须创建 GAME_GUIDE.md？
* **AI 跨上下文传承**：AI 助手的交互是无状态或分会话的。代码可以表达“怎么做”，但无法清晰表达“为什么这样写”、“原生 WASM 的函数行为是什么”、“有哪些踩坑血泪”。
* **几秒内完全接管**：一份高质量的 `GAME_GUIDE.md` 能让任何后续接手的人类工程师或新 AI（Claude Code、Cursor、Windsurf 等）在 30 秒内完全掌握该游戏的反编译脉络、物理动力学、策略算法与常用命令，杜绝推倒重来的重复劳动。

### 2. 创建与更新的生命周期时机
1. **新游戏立项建档时**：
   - 检查 `analysis/report.json` 确定引擎类型；
   - 在 `download/[游戏目录名]/GAME_GUIDE.md` 初始化文档骨架；
   - 在 `download/[游戏目录名]/scripts/AUTOMATION.md` 中添加指向该指南的快捷跳转链接。
2. **反编译与逆向突破时**：
   - 查明原生输入控制、碰撞 Layer/Tag、生命扣除与胜利切关的内部函数后，立即将反编译伪代码与字段结论写入第二章。
3. **算法调优与疑难关卡攻关时**：
   - 解决特定物理障碍（如高空滑轨颠簸、大角度急弯离心力防撞墙、钥匙金币拾取磁吸、旋转闸刀周期等待等）后，必须把数学公式、阈值参数与策略逻辑沉淀至第三章。
4. **清理临时探针并沉淀结论时**：
   - 删除 `scripts/.tmp/` 下的临时探针脚本前，将探针查明的关卡数据结构、坐标规律与正式运行命令沉淀至文档对应章节。

### 3. GAME_GUIDE.md 标准结构与脚手架模板
后续新游戏建档或补充时，请直接复制以下 Markdown 模板并填充：

```markdown
# [游戏名称] 自动化与逐关录制权威工程指南

> **文档定位**：本指南是 `[游戏目录名]` 的专属权威说明文档。  
> 无论是人类工程师还是任何 AI 助手，在接手、维护或改进本游戏的自动化脚本、逆向逻辑与策略算法时，优先阅读本文档即可完全掌握该游戏的一切细节。  
> 全局通用工程基线请参考根目录 `docs/H5_GAME_AUTOMATION_AND_RECORDING_GUIDE.md`。

---

## 一、 游戏概况与核心机制
- **游戏名称**：[游戏全称]
- **引擎与运行环境**：[Unity WebGL (IL2CPP + WASM) / LayaAir 3D (Pure JS)]
- **底层玩法机制**：[核心玩法简述、角色移动方式、收集物与障碍物、终点胜利条件]

---

## 二、 逆向分析成果与原生方法体
- **反编译产物路径**：[analysis/ 目录核心文件索引]
- **核心类与方法签名**：[列举关键 Controller、Update、OnTriggerEnter 等]
- **原生行为契约**：[详细描述原生加力、横移换算、扣血逻辑、结算切关的具体实现]

---

## 三、 核心策略与专有算法沉淀
- **核心控制哲学**：[默认全速/匀速跑动/拟人滑动阻尼等]
- **专属地形与障碍策略**：[针对该游戏特有机关（如滑轨、闸刀、变色门、翻板等）的数学模型与应对算法]
- **收集物与终点保全逻辑**：[最优收益通道选择、防甩尾余量、终点胜利阈值]

---

## 四、 工程目录与文件拓扑
[列出 scripts/internal/ 下核心文件的分工]

---

## 五、 常用开发、测试与排查命令备忘
[列出单关不录屏测试、单关录屏、批量录制、WASM 反编译等标准命令]
```


### Construct 世界模型旋转角核验（2026-10-24）
C2/C3 实例世界模型的旋转角均在 rawWorld[6]，单位弧度；rawWorld[5] 不是旋转角。已核对原生 C3 SetAngle(e[6]) 与 C2 inst.angle=wm[6]，修复 src/construct-analysis.mjs，并用 test/construct-world-model.test.mjs 覆盖不同的第5/6字段，避免旋转物体被错误解析为0角度。涉及平台、坡面和障碍路线时，应同时比对解析旋转角和原生运行时碰撞几何。


### Yandex getData省略keys的离线兼容（2026-10-24）
花样滑冰258973的原生yandex-bridge.js调用player.getData()加载全部云存档，再读取onIceSaveV1。离线适配不能把省略keys等同于空数组，否则会把真实已保存进度当成空存档。src/replay.mjs现只枚举当前appId前缀键；显式[]仍为空，指定keys行为不变。test/replay-yandex.test.mjs覆盖实际浏览器保存/刷新/全量读取及跨应用隔离；已有广告回调断言改为等待真实异步onClose，避免计时竞态。真实新浏览器恢复该游戏首关Win存档后原生进入下一关，不能用直接写内存关号掩盖存档接口缺漏。

### GamePush webpack延迟提示资源（2026-10-25）
Apple Worm: Level Up的原生第10关首次成就提示触发GamePush SDK分包，主SDK已抓到也不代表提示界面依赖齐全。src/webpack-assets.mjs静态解析webpack u文件名函数、已声明名字/哈希表、纯字面量h构建hash和模块require别名的有限e(ID)引用，asset-completer按原脚本URL解析可选依赖；不执行bundle、不猜ID区间。真实SDK发现76个声明候选，覆盖本次实机缺少的5个同构建JS。5项针对性测试含HTTP保存及不执行源代码，32项现有资源补全回归与语法检查通过。此经验只适用于可静态解析的webpack声明，动态执行所得地址仍须按实际运行证据补齐。

### 2026-10-25 离线回放去广告偏好与SDK防覆盖
用户要求归档游玩、录制默认不展示广告。Yandex回放必须替换同源/sdk.js以及/sdk/_/v*.js，而非只在HTML前注入stub后继续执行原广告SDK。仅匹配平台SDK路径，保留游戏业务脚本；横幅不创建，插屏与激励视频异步关闭，维持原启动/恢复链，不伪造已观看奖励。test/replay-yandex.test.mjs覆盖原SDK试图覆盖YaGames、两个入口、无广告iframe和外网请求。其他平台需分别验证，不将此修复描述为已验收全部归档。


### 2026-10-25 Apple Worm - Snake Puzzle：原生计时与浏览器VSync叠加
该GameMaker HTML5构建的_Jw3先按game_get_speed(0)=60计时，再setTimeout后请求原生RAF，默认无头源编码仅51–52FPS。仅本游戏专用浏览器使用--disable-frame-rate-limit，保留引擎自身60Hz计时与完整原始构建；未覆写RAF/setTimeout/Date/performance，也未调用game_set_speed。此参数不能推广至按RAF次数推进且没有自身限速的游戏。页面RAF可上千次/秒，不能当作游戏绘制FPS；实际交付仍要求原始编码帧率>=59.5和逐片连续性。观察等待保护须用实际经过时间，不能用600次RAF误当10秒。纯教学sprite图层可单独隐藏，包含原生存档逻辑的结算Draw不可整体关闭。


### 2026-10-25 Yandex 新 CDN 游戏入口识别
游戏入口除 app-ID.games.s3.yandex.net 外，还会使用 app-ID.cdn.games.yandex.net。src/capture-platforms.mjs 现同时识别这两类精确域名；主机 app ID、路径数字 ID 与 fragment app-id 如存在必须一致，排除 SDK/helper、其他应用与伪造域名。保留 SDK 父页的 iframe 启动链，不能跟随广告页面替代入口。15 项平台回归及 npm run check 通过；416988 真正联网抓取为 core-complete，原失败归档恢复后在禁止外网条件下本地启动通过。修复历史归档时保留原 pages/frames，仅记录实际重验来源；先备份 manifest，再确认离线启动成功后清除 captureError。

### 2026-10-25 归档列表总关卡数
管理页在源码解析与视频录制之间展示总关卡数。analysis/report.json.levelSummary 为标准结果；专门的反编译器或人工核验可补写 analysis/level-summary.json，结构为 {"kind":"finite","total":60,"evidence":[{"file":"analysis/gameplay/native-levels.json","detail":"完整原生表"}]}。无限推进必须核实原生生成或循环逻辑，写 kind=infinite、total=null，并提供具体源码文件与逻辑说明；不得仅凭 endless 字符串或关卡表数量声称无限。未解析显示未解析；已解析但未确定显示待确认。默认解析器只统计受支持的完整连续编号配置表，冲突结果不取最大值。录像目标100、已录数量、解锁进度、布局总数和付费可访问范围均不能代替总关卡数。旧报告可用同一分析器回填，无证据的保留待确认。专用浏览器验证60关、无限、9列及空列表；test/level-summary.test.mjs覆盖证据门槛、重复/缺号、冲突和未解析状态。


### 2026-10-28 Count Balls / 1 Cut Run 归档补全

HTML注释中的vconsole.js不是浏览器真实依赖，通用HTML扫描已排除注释。1 Cut Run采用零偏移Base64字面量表，现用AST仅还原已验证的固定索引；若表额外引用或旋转则保持未解析，绝不运行游戏入口。关卡nodeData.a实例名经过原生selectProp首字母条件规范化，不能直接把a1、a2等当成独立模型。音效调用中的动态前缀attack_0加计数器不再误判为完整文件名；实际原生逻辑使用attack_01至07以及bgm0至2，原始音源已补齐。两个归档已禁网手机触摸实玩，资源加载和页面异常均为0，清单状态core-complete，证据见各游戏archive/repair-verification.json与GAME_GUIDE.md。验证范围为已请求、可静态解析声明资源和短程实玩，不宣称逐关通关。通用语法检查通过，除缺少既有Tilo样本的Construct组外186项回归通过，最终37项依赖补全与新增用例全部通过。管理服务另有活动任务，未强制重启；此次独立CLI修复与清单状态已经生效，服务后续重启加载通用代码。

### 配置基名与补抓资源身份

Laya配置可能只保存资源基名，不能以没有扩展名视为无依赖。通用configured-scenes解析静态路径拼接helper及其原生调用字段，用配置中的真实值补全；不执行业务代码，不猜关号。Merge本构建验证恢复后续场景。历史补抓记录若误登记本地回放URL，应先逐项向发布源站核对SHA再恢复原始URL，禁止依赖固定本地端口或假成功回调。Pet64个资源按此方式验证恢复，另补齐真实纹理。


### 本轮通用修复补充（2026-11-02）

Unity6 intptr_t _unity_self 的Injected接口不能传托管对象地址；结构体返回必须采用真实WASM签名及sret，不能套用元数据TypeSignature。带引号JSON键的Unity dataUrl同样需要扫描，ASTC包存在不代表默认DATA已补全。补抓时saved:true但HTTP非2xx的错误正文不可视为资源，必须重试真实源站；不得以空纹理代替500 XML。已添加相应桥接、JSON依赖、SDK设置及错误正文补抓回归测试。碰撞规划必须覆盖同一障碍的全部独立Col，旋转与往返平移的包络应投影到当前道路方向，整队宽度按真实队员包络计算。


## 2026-11-03 原生晚加载与无扩展名资源

Unity LevelStreamer 的 AssetBundle 可以没有扩展名，并可能直到接近关卡末尾才预取。启动画面完整不代表后续资源完整。createReplayServer 现在暴露 missingResources，保留原始 URL、方法、时间和 runtimeRequested；调用者应写进批次报告并在核心404时中止当前尝试。completeArchiveAssets 的 runtimeRequests 参数把真实请求作为必需依赖，保留身份，补抓前仍返回真实404，不生成假包。恢复入口：node scripts/repair-runtime-resources.mjs --archive <归档> --report <实机report.json>。新回归 test/late-runtime-resources.test.mjs 验证真实 UnityFS 包恢复前404、恢复后原字节回放。

CrazyGames 原生调用链对 requestAd 返回值调用 catch；离线桩必须返回 Promise 并调用 adError，返回 false，不触发 adFinished 或奖励。

## 2026-11-10 PlayCanvas 自定义 @createScript 装饰器

TS 项目常把 pc.ScriptType 包一层自有装饰器，编译后既没有 `pc.createScript('x')`，也没有 `class X extends pc.ScriptType`，形如 `c=function(t){…}(a.ScriptTypeBase);c=o([(0,a.createScript)("PlayerScript")],c);e.PlayerScript=c`。旧解析器只认前两种写法，Pencil Rush 的 22 个脚本被漏成 4 个。src/playcanvas-analysis.mjs 现增加装饰器扫描：按 `(0,x.createScript)("Name")],classVar)}(x.ScriptTypeBase);ns.ClassName=` 还原 id（首字母小写），并从类体读 `_attributes` 与 `classVar.prototype.*`。这类压缩构建的脚本类通常只有属性、没有方法，业务逻辑在普通 TS 类里（Player/PencilGrig/PathController），读逻辑仍要回到 __game-scripts.js 原文。判定依据是 scene JSON 里出现的脚本 id 能否在 scripts.json 全部命中，Pencil Rush 为 18/18，另有 5 个关卡未使用。资源侧另有一条通用结论：`config.json` 的 `file.url` 是未加哈希的原始名，落盘文件名带抓取哈希且空格、`|`、`&`、括号被替换成 `-`，核对必须按“主干+扩展名”，按全名比对会把 590 个资产误判成 577 个缺失；CDN 还会重编码图片，实际字节小于声明 size 不代表损坏。

