# 参与网站开发

永远用中文回复。先读[项目说明](README.md)和[网站开发流程](docs/site-development.md)。需求与设计确认后归档交付物，再拆票、认领、实施、审查、发布并更新汇总页。

只修改认领范围；既有站点地址及内容保持不变，除非任务明确授权对应变更。

本项目固定使用 `.agents/skills/github-collaboration/SKILL.md`；治理配置读取 `.agents/skills/github-collaboration-setup/SKILL.md`，只读检查读取 `.agents/skills/github-collaboration-check/SKILL.md`。发现用户级同名旧包时，显式读取并选择上述项目级 v0.2.0 完整包，不修改全局安装；实际读取路径与版本须在本会话核验。

<!-- github-agent-collaboration:start version=0.2.0 -->
## Agent collaboration

先读[项目入口](.github/agent-collaboration/README.md)。Agent 日常写操作使用兼容 `github-collaboration >=0.2.0`；缺少/不兼容时仅诊断，见[安装说明](.github/agent-collaboration/INSTALL_SKILL.md)。所有 Agent 默认 Member；治理需有效 Leader（或限域 Bootstrap/Recovery）使用 `github-collaboration-setup`。创建 Issue/首次认领/讨论/审查无需已有实施 claim；实施、提交、推送需当前有效范围。人类可按项目约定参与。
<!-- github-agent-collaboration:end -->
