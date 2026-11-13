# H5 Game Archiver

本项目现在也是一个统一的本机游戏分析平台。双击 `start.cmd` 后，一个页面中包含：

- “网页游戏归档”：捕获 H5 游戏资源；
- “APK / XAPK 分析”：识别 Unity/IL2CPP、运行 Il2CppDumper/Cpp2IL、重建 C#，并提取关键类的 ARM 原生逻辑。

集成分析器位于 `integrations/xapk-analyzer`，由主服务自动启动在本机内部端口 41741，无需再单独运行原下载目录中的 `start.bat`。

Capture an authorized HTML5 game session with a real Chromium browser. The tool records a HAR file and saves dynamically loaded HTML, JavaScript, CSS, JSON, WASM, images, audio, video, fonts, XHR and fetch responses.

This is an archival and debugging tool. It does not bypass authentication, access controls, DRM, domain restrictions or licensing checks. A captured release bundle is not the original project source code.

## Setup

需要 Node.js 22.13 或更新版本（本机 Node.js 24 可直接运行）。

归档管理索引和网页任务历史保存于 `data/archives.sqlite`，无需单独安装数据库。  
管理页展示最初输入的来源链接、开始时间和完成时间；历史任务包含失败和服务中断记录。  
首次启动自动从 `download/*/archive/manifest.json` 导入已有归档，后续刷新会同步外部新增或更新的归档。  
没有记录的旧字段显示“未记录”，不会用当前时间或跳转后的地址冒充原始记录。  
升级前仅存在内存中的失败任务无法补回；升级后的网页任务会持久保存。  
删除归档会删除资源目录和管理索引，任务历史保留。游戏资源及 JSON 清单继续留在原目录。  
备份时先停止管理服务，再一起复制 `data/` 和 `download/`；运行期间 SQLite 可能使用 WAL 辅助文件。

```powershell
npm install
npx playwright install chromium
```

## Capture

归档命名按**来源网址的平台**选择字段与优先级，规则集中在 `src/game-name.mjs` 的 `PLATFORM_RULES`。嵌入页的域名不会覆盖来源平台。新增网站时，在此表增加该站规则及回归测试。

| 来源网站        | 字段优先级与专属处理                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FreeGame    | `play_game_frame` 游戏 iframe 的 `<title>` → 游戏 URL 名称 → 页面 `og:title` / `<title>` → 落地页元数据 / 标题；直达 CDN 游戏页时读取其 `<title>`。清除 `FreeGame.com` 后缀，目录使用英文游戏名。 |
| Y8          | 游戏页 `og:title` → 游戏页 `<title>` → 落地页元数据 / 标题 → URL；站点名称与 URL 相符时排除明显无关的嵌入页标题。                                                                          |
| Yad         | 游戏页 `og:title` → 游戏页 `<title>` → 落地页元数据 / 标题 → URL；通用引擎标题无效，宣传文案与 URL 名称相符时用 URL。                                                                      |
| LayaBox     | 游戏页 `og:title` → URL → 游戏页 `<title>` → 落地页元数据 / 标题；过滤引擎域名，`index.html` 入口取上级游戏目录。                                                                      |
| Playhop     | 游戏页 `og:title` → 游戏页 `<title>` → 落地页元数据 / 标题 → URL。                                                                                                    |
| Kiz10       | 游戏页 `og:title` → 游戏页 `<title>` → 落地页元数据 / 标题 → URL；保留描述性构建文件名纠错。                                                                                       |
| PlayPlayFun | 游戏页 `og:title` → 游戏页 `<title>` → 落地页元数据 / 标题 → URL；`/play/` 入口取上级游戏目录。                                                                                 |
| 其他网站        | 游戏页元数据 / 标题 → 落地页元数据 / 标题 → URL。                                                                                                                       |

所有规则都会过滤无意义名称、清理常见宣传后缀，并在唯一、明确的构建名与标题冲突时采用构建名。原始标题和命名依据记录在 `archive/manifest.json` 的 `nameEvidence`、`nameResolution` 中，后者同时标明命中的 `platform`。修改工具代码后需重启服务，新抓取才会使用更新后的规则。

游戏页面的标题或 metadata 如果在来源网址对应的完整游戏名后追加 `Best Arcade Game`，命名时也会去掉该宣传后缀；不会仅因网址较短就删除正式名称中的 `3D` 等内容。目录保留抓取时间戳，便于区分批次。

Only run this against content you own or are authorized to archive:

Windows 用户可以直接双击项目根目录的 `start.cmd` 启动归档器，双击  
`stop.cmd` 停止归档器。

“打开文件夹”和“打开视频目录”需要后台服务运行在当前 Windows 交互桌面。由自动化工具启动到 `exebox-*` 等隔离桌面时，网页仍可访问，但目录窗口无法显示在用户桌面；请在服务空闲时从正常 Windows 桌面双击 `start.cmd` 重启。后台只有确认目标目录窗口实际存在且可见，才会报告打开成功。

启动失败时，窗口会区分后台进程退出和启动检测超时，并显示最近的错误。  
启动日志保存在 `data/logs/web.stdout.log` 和 `data/logs/web.stderr.log`；上次启动的日志保留为对应的 `.previous.log` 文件。

也可以在终端启动本机 Web 控制台，在页面中填写游戏 URL：

```powershell
npm run web
```

然后访问 `http://127.0.0.1:41740`。页面启动的归档默认保存在项目根目录的  
`download` 文件夹。

```powershell
npm run capture -- --url "https://example.com/game/" --duration 60 --acknowledge-rights
```

开发时可以先启动仓库内自带的本地测试页面，然后在另一个终端执行抓取：

```powershell
npm run fixture
npm run capture -- --url "http://127.0.0.1:41739" --output "archives/fixture" --duration 5 --acknowledge-rights
```

The Chromium window stays visible by default. Interact with the game during the capture period so that deferred level resources are requested. Add `--headless` for unattended captures that do not require interaction.

Output:

```text
output/<host-timestamp>/
  final.png
  manifest.json
  session.har
  resources/<host>/...
```

`manifest.json` records frames, response metadata, hashes and failed requests. `session.har` preserves complete browser request/response metadata with response bodies embedded.

## Offline replay and verification

Serve a completed capture without contacting the original host:

```powershell
npm run replay -- --archive "archives/fixture/<capture>" --port 8080
```

Run an automated headless replay check. It writes `verification.json` and `offline.png` into the capture directory and exits with code 2 if a resource is missing or the page contacts an external origin:

```powershell
npm run verify -- --archive "archives/fixture/<capture>" --duration 5
```

## Current scope

Replay resolves relative assets against the captured entry page and rewrites URLs that were observed during capture. URLs assembled dynamically at runtime cannot always be inferred; the verification report highlights missing resources and unexpected external requests. Authentication, DRM, WebSocket backends and server-side game logic are intentionally not reproduced.

# 游戏专用自动化

每个游戏可以在自己的归档目录中保存独立脚本，并通过通用命令运行：

```powershell
npm run play:game -- --game "游戏归档目录" --script 脚本名
```

删除某个游戏归档后，不应在根目录 `package.json` 中继续保留指向该归档的  
固定命令。重新归档并创建游戏脚本后，再按新目录添加对应快捷命令。

## 新版归档目录

抓取收尾会自动补全可解析的动态依赖：Laya `res_lib` 资源表、场景/模型/材质引用、FairyGUI 界面包及其依赖包和图集（含压缩包与随机图集文件名）。按原始完整 URL 去重并解析相对路径；Laya 图集内的图片不会作为独立文件重复下载。下载直接使用 GET，支持查询参数和已编码路径，失败的旧记录或磁盘缺失文件可以续补。

补全结果写入 `archive/manifest.json` 的 `assetCompletion`。资源表/依赖声明下载失败、解析失败、取消或超出默认 3 分钟/10000 个地址上限时，会标记未完成；SDK 源码中从未请求过、仅凭字符串推测且源站返回 404/410 的路径列为 `unresolvedCandidates` 警告。静态补全不能保证任意运行时计算路径都已覆盖，仍需离线实玩验证。

已有归档也可补全：`node src/cli.mjs complete --archive "download/游戏目录"`。声明依赖未补全时退出码为 2。已启动的归档器需重启后使用新逻辑；已有回放服务也需重新启动以读取更新后的清单。

新下载的游戏使用网页标题命名文件夹，并按用途分区：

```text
游戏名-抓取时间/
  index.html
  game/
  archive/
    manifest.json
    session.har
  preview/
  analysis/
    report.json
    source-index.json
    wasm/
  scripts/
    automation-context.json
    AUTOMATION.md
  README.txt
```

网页抓取完成后会自动运行发布源码分析：识别引擎，索引 JS/HTML/JSON 中的函数、类和自动化关键词，检查任意扩展名文件中的 WASM，并在体积允许时输出 WAT。分析产物与该游戏归档放在一起，供后续编写游戏专用自动化脚本使用。

旧归档可以无损整理为新版目录（原目录会保留）：

```powershell
npm run organize -- "旧归档目录"
```

## 游戏封面

归档列表优先显示来源网站的游戏封面，点击可切换查看实机截图。封面从已归档网页的 Open Graph / Twitter 图片中提取，并过滤常见网站 Logo。Y8 会用 `/games/` 路径核对站点标题，并按 `cloudimage` 图片 ID 匹配已保存的不同尺寸；Yad 会匹配同一游戏的缩略图格式变体，若本地自动格式无法解析则尝试明确的封面地址。其他网站仍要求页面标题与游戏名称匹配。图片保存在归档的 `preview/cover.json`（含原始图片字节与来源）中，离线也可显示。

未找到可靠封面时显示名称占位，不把奖励弹窗当封面。在预览窗口点击“上传封面”，可选择 5 MB 以内、96～8192 像素的 PNG、JPEG、WebP 图片；手动封面不会被自动提取覆盖。以后抓取会自动尝试提取封面。名称匹配仍不能保证图像内容正确，可手动替换。

Playhop 优先按当前页面游戏 ID 提取结构化数据中的原始卡片图，使用分享图作为后备；不会选取推荐列表中的其他游戏。来源名称和本地识别名称不同时，预览中标注差异。

### 本地实机截图

游戏封面用于列表识别，实机截图单独展示。新归档完成后从本地回放生成 `preview/local.png`，阻止外网 HTTP 与 WebSocket 请求，并检查画布是否被网页元素遮挡。线上 `capture-end.png` 仅作诊断，不再作为实机预览。旧归档点击封面 → 实机截图 → 重新截取本地截图。失败会保留原有本地截图，不使用线上图片补位；游戏内绘制的菜单仍可能出现在画面中。
