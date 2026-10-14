---
installation_status: published
source_repository_url: https://github.com/Paipai112/Work-with-Agent
release_tag: v0.2.0
resolved_commit_sha: 16907ce50b124ff59d39ea3c4bb74498ef576636
installation_page_permalink: https://github.com/Paipai112/Work-with-Agent/blob/16907ce50b124ff59d39ea3c4bb74498ef576636/docs/INSTALL.md
---

# Work-with-Agent 固定安装来源

本项目采用已发布的 Work-with-Agent v0.2.0，固定提交 `16907ce50b124ff59d39ea3c4bb74498ef576636`，来源仓库稳定 ID `1398932546`。`published` 只表示来源已发布，不表示项目配置已合并、持久 Leader 生效或实际客户端加载已验证。

完整发行包复制到以下项目目录，内容不作定制：

| 客户端 | setup | daily | check |
| --- | --- | --- | --- |
| Codex／Pi | `.agents/skills/github-collaboration-setup/` | `.agents/skills/github-collaboration/` | `.agents/skills/github-collaboration-check/` |
| Claude Code | `.claude/skills/github-collaboration-setup/` | `.claude/skills/github-collaboration/` | `.claude/skills/github-collaboration-check/` |

完整包及每文件摘要见 [package-inventory.json](package-inventory.json)。源包 `RESOURCE_MANIFEST.json` 原样保留；项目定制仅发生在包之外。MIT 许可原文见[来源说明](../../NOTICE-WORK-WITH-AGENT.md)。

## 使用与核验

1. 从固定提交取回源树，并核验仓库 ID、正式 Release／tag 与完整 SHA 的绑定。来源永久链接：[安装页](https://github.com/Paipai112/Work-with-Agent/blob/16907ce50b124ff59d39ea3c4bb74498ef576636/docs/INSTALL.md)。
2. 使用 Python 3.11+ 和包内 `requirements-helpers.txt` 对应依赖。在仓库根运行 `python3 scripts/validate-work-with-agent.py --source-root /path/to/verified/Work-with-Agent`。它核对完整包、资源、真实 YAML 与 schema，仅做离线一致性检查，不是正式 PR 检查，也不证明真人审批或权限。
3. 在目标项目新会话只读显式调用 setup、daily 或 check，记录实际 `SKILL.md` 路径、版本与相对资源。Codex 用 `$github-collaboration`，Claude 用 `/github-collaboration`，Pi 用 `/skill:github-collaboration`，按任务选择相应包。检查同名覆盖、关闭设置、信任及根／嵌套／空格目录。安装文件存在不等于客户端实际加载。
4. 日常任务从默认分支同 SHA 读取配置／协议／授权并建立本会话的有效认领。治理任务需要有效 Leader 或限定 Bootstrap／Recovery，`leader_delegations: []` 不授予持久 Leader。

本轮原生加载检查：Codex 发现用户级同名 v0.1.0 包，显式读取项目 `.agents/skills/` v0.2.0 成功，但自动选择项目版本尚未验证；Claude 的原生 Skill 工具已选择项目 `.claude/skills/` v0.2.0。根入口已明确精确项目路径，不修改全局安装。最终合并状态、根／嵌套／空格目录，以及 Windows native／WSL、Pi 等上下文仍须分别核验，不能由本轮结果推定。

## 项目定制与维护边界

- 项目配置沿用 v0.2.0 字段，最低 daily 版本为 0.2.0；Actions／Required Checks／Rulesets 的治理安装开关关闭。现有 GitHub Pages 托管设置独立保留。
- 治理配套 checker、collector、launcher、事件／范围 helper、schema 与 requirements 从同一 setup 发行模板完整复制。未在根 `.github/workflows/` 安装工作流；完整 Skill 内的示例工作流仅为包资源。
- Issue 模板仅移除未经核实存在的自动 `labels` 字段；PR 模板原样保留，实际 Issue／claim／PR／HEAD 必须由运行者填写，模板占位不是已发生事件。
- 三个根入口保留标准 v0.2.0 受管块。块外项目说明和链接由项目维护，自动升级只拥有精确受管块。授权文件始终排除自动整文件 ownership；账本及基线不授予修改权限。
- 升级前按固定包 setup 的三方差异程序审查；保留用户修改和未知状态，不用新版本覆盖它们。

凭证只在经核验的客户端安全登录，不进入仓库、聊天、Issue／PR 或日志。改名不改变 Skill 名、标记、schema 标识和 `.github/agent-collaboration/` 路径。
