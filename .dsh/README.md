# 项目级 harness 配置

本目录是 DSH（DeepSeek Harness）的**项目级** skill 根，仅对 `C:\code\h5-game-archiver`
会话生效。发现优先级来自 `@deepseek-ai/dsh-skill-filesystem`：项目级 `.dsh/skills`
（rank 100）高于用户级 `~/.dsh/skills`（rank 400），同名时项目级胜出。

## 目录约定

| 路径 | 作用 |
|---|---|
| `skills/<name>/SKILL.md` | 每个 skill 一个目录，DSH 只发现这一层 |
| `references/security-checklist.md` | **共享资源**，见下方说明 |
| `skill-sources.json` | 机器可读的来源与 commit 记录 |

DSH 的发现是**一层深**：只识别 `<root>/<name>/SKILL.md` 和 `<root>/<name>.md`，
更深的 `**/SKILL.md` 会被忽略。因此不要把 skill 放在更深层的子目录里。

## 已安装的 8 个编码类 skill

按来源仓库的 star 相对排名挑选，全部经 DSH frontmatter 规则校验通过。

| skill | 来源仓库 | commit |
|---|---|---|
| `test-driven-development` | obra/superpowers | `b36e0829c6d0` |
| `systematic-debugging` | obra/superpowers | `b36e0829c6d0` |
| `writing-plans` | obra/superpowers | `b36e0829c6d0` |
| `code-review` | mattpocock/skills | `3cca18b368ae` |
| `codebase-design` | mattpocock/skills | `3cca18b368ae` |
| `spec-driven-development` | addyosmani/agent-skills | `6ca0cd7db39b` |
| `security-and-hardening` | addyosmani/agent-skills | `6ca0cd7db39b` |
| `mcp-builder` | anthropics/skills | `34040c9c5685` |

## 为什么会有 `references/` 这个目录

`security-and-hardening/SKILL.md` 里有 4 处引用写成 `../../references/security-checklist.md`。
在原始仓库里 `references/` 位于**仓库根**，而 DSH 只复制 skill 自己的目录，
这个相对路径本来会断掉。

从 `<project>/.dsh/skills/security-and-hardening/` 向上两级正好是 `<project>/.dsh/`，
所以把该文件放在 `.dsh/references/` 就能让原始路径原样生效，
**无需修改任何第三方内容**。

`../../references/` 是本仓库中唯一一处包外引用，其余 7 个 skill 都是自包含的。
如果以后新增 addyosmani 的 skill，注意检查是否也引用了仓库根的 `references/`。

## 注意

- 这里是**快照**，不会自动跟随上游更新。更新时重新拉取对应 commit 并覆盖目录。
- skill 内容是第三方指令，会被模型当作任务指导执行。它们不携带可执行权限提升，
  但 `code-review` 会指示派发并行子代理，`mcp-builder/scripts/` 下有 Python 脚本。
