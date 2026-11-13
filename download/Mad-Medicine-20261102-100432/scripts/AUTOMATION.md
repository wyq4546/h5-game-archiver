# Mad Medicine 自动化与录制系统使用说明

## 一、 快速启动命令

所有自动化批处理位于 `download/Mad-Medicine-20261102-100432/scripts/` 目录下：

| 命令 | 用途 | 默认参数 |
| --- | --- | --- |
| `play-auto.cmd` | 纯物理拟人游玩（有界面可见，不录制视频） | `--play --visible --start 1 --end 0` (无限模式) |
| `record-auto.cmd` | 正式录制 1-10 关发布级成片（无头高性能录制） | `--record --start 1 --end 10` |
| `record-from-level.cmd [N]` | 指定从第 N 关开始录制 | `--record --start N --end 0` |
| `verify-recordings.cmd` | 独立对录制成片进行合规性验收（分辨率/FPS/音轨/纯净度） | `node scripts/internal/verify-recordings.mjs` |

> 批处理脚本均已内置运行时环境探测（Node.js、FFmpeg、Playwright 浏览器路径重定向与 UTF-8 编码），双击即可直接执行。

---

## 二、 自动化架构与代码组成

```text
scripts/
├─ play-auto.cmd              # 纯物理拟人游玩入口
├─ record-auto.cmd            # 1-10关正式录屏入口
├─ record-from-level.cmd      # 指定关卡续录入口
├─ AUTOMATION.md              # 本说明文档
├─ automation-context.json    # 自动化桥接配置
├─ internal/
│  ├─ game.mjs                # 浏览器/页面/Unity Hook/Yandex SDK Mock驱动
│  ├─ strategy.mjs            # 跑酷避障与收集、冲刺与领奖台策略算法
│  ├─ runner.mjs              # 关卡状态机、录屏周期调度与切关协调器
│  └─ run-auto.mjs            # CLI 命令行参数解析主入口
├─ video/                     # 【纯净视频目录】仅存放导出的 1080x1920 60FPS MP4
│  └─ recording-YYYY-MM-DDTHH-mm-ss-SSSZ/
│     ├─ level-000001.mp4
│     └─ ...
└─ recording-data/            # 【录制数据目录】存放报告、检查点与运行日志
   └─ recording-YYYY-MM-DDTHH-mm-ss-SSSZ/
      ├─ report.json
      └─ checkpoint.json
```

---

## 三、 核心技术规范

1. **纯原生物理交互**：
   - 开局：CDP TouchStart/TouchEnd 点击 `TTSButton` (540, 960)。
   - 跑酷：闭环 P 控制器通过连续 TouchMove 拖拽驱动 `PointerDisplacementSystem` 转向，动态规避汽车、路障与土匪，精准拾取护士、钻石与现金。
   - 冲刺：进入 `RoundFinishState`（$Z \ge 78.0$）后，高频点击 `SprintButton` (540, 1095)，超车轮椅竞速对手并冲刺至领奖台（$Z \ge 125.0$）。
   - 切关：登顶领奖台后抓取纯净 1.8 秒领奖台胜利特写，完成当关录制封包；随后静默隐藏结算弹窗渲染，原生点击 `StateTransitionButton` (541, 1247) 触发平滑切关。

2. **视频成片标准**：
   - 画面分辨率：1080 × 1920（竖屏 Full HD）。
   - 帧率：原生 60 FPS 逐帧捕获。
   - 编码：H.264 (yuv420p, CRF 18) + AAC 192kbps 原声音轨。
   - 纯净度：开局无多余白屏/加载卡顿，终局干净保留 1.5~2.0 秒领奖台庆祝动作，彻底杜绝结算弹窗遮挡。
