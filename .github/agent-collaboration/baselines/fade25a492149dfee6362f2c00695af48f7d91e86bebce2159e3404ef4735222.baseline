# static-pages 协作入口

先读[项目说明](../../README.md)及[网站开发流程](../../docs/site-development.md)。本仓把已确认的设计与 PRD 交付物归档，再拆分 Issue、认领实施、审查验证、发布 Pages，最后更新汇总主网站。

版本与路径以[配置](config.yml)为准。每次从已确认默认分支同一 SHA 读取配置及其选择的[协议](PROTOCOL.md)、[授权](authorization.yml)。日常 Agent 使用完整 `github-collaboration >=0.2.0`，治理使用获授权的 setup，只读检查使用 check。固定来源和实际加载要求见[安装说明](INSTALL_SKILL.md)。

## 项目上下文索引

| 事实 | 权威路径或链接 | 范围／缺口 |
| --- | --- | --- |
| 仓库目标与站点索引 | [根 README](../../README.md) | 网站源码、交付物与公开 Pages 的统一入口 |
| 设计确认、拆票、开发与发布流程 | [网站开发流程](../../docs/site-development.md) | 进入实施前确认设计及需求，审查通过后发布并收录 |
| 每个网站的 PRD 与设计 | 各网站 Issue 所链接的仓库交付物 | 未归档的交付物位置及确认记录仍未知 |
| 决策、计划与进展 | 相关 Issue／PR／协作事件 | 以真实记录为准，未建立记录的事项未知 |
| 验证与验收证据 | 对应 PR 链接的检查、审查和发布读回 | 首次治理 PR、原生客户端加载及最终部署证据待真实产生 |

[角色说明](ROLES.md)是兼容指针；所有 Agent 默认 Member。当前 `leader_delegations` 为空，没有持久 Leader。本次初始化采用限域会话，后续治理需重新核验相应有效授权。账号管理权限与文件存在不产生委任。

[资源账本](managed-resources.yml)仅记录维护基线，[完整包清单](package-inventory.json)记录固定发行内容；二者都不授予权限。授权文件不纳入自动整文件维护。动态认领、审批、Issue 与 PR 信息保存在真实 GitHub 记录，不由候选文件代写。
