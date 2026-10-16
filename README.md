# Static Pages

这里维护[网站汇总首页](https://paipai112.github.io/static-pages/)和各网站的公开页面。新网站将需求、可编辑设计稿、PRD 与已有确认记录整理入库，形成固定输入后拆票，经实现、独立审查与验收后发布为 Pages，并收录到首页。Agent 与人类协作者使用同一组仓库、Issue 和 PR 记录接力完成工作。

## 一、协作入口

- 新需求从 [网站开发约定](docs/site-development.md) 开始，在 `sites/<slug>/` 保存 PRD、设计源文件和站点说明；[模板目录](docs/templates/)提供可复制的文件。
- 需求和设计可以在入库前确认。已有本次聊天或其他可信确认记录时，核对入库内容与批准内容一致，再将记录绑定交付物版本及固定提交 SHA；无实质变化时不重复申请设计确认。尚未确认的内容或实质变更取得相应确认后，再拆实施 Issue。
- Agent 读取 [AGENTS.md](AGENTS.md) 与[项目上下文索引](.github/agent-collaboration/README.md)，按 Work-with-Agent 的日常 Skill 核对身份、任务、范围与认领。
- 站点任务以 `sites/<slug>/` 为开发范围；根发布目录 `<slug>/` 由发布任务认领。根 `index.html`、`site-catalog.json` 等公共文件由单独的集成任务认领。
- 人类协作者在 Issue 与 PR 中保留目标、范围、依据、验证和交接记录。采用哪个客户端、模型及是否使用 worktree，由任务选择。

本仓库的协作规则来源为 [Work-with-Agent v0.2.0](https://github.com/Paipai112/Work-with-Agent/releases/tag/v0.2.0)。治理授权、协议审查和合并仍按默认分支上的有效规则执行；项目级 Skill 的安装与加载记录以仓库内的安装入口和实际验证为准。

## 二、网站目录

[site-catalog.json](site-catalog.json) 保存站点名称、发布路径和已迁入源码位置。根 `index.html` 展示对应链接。筹备和开发中的新站保留在其目录与 Issue 中；发布 PR 具备已验收的真实产物后，才将新条目与首页链接一并提交。PR 中的候选条目仍属待发布，线上部署成功后才记为已收录。

| 网站 | 发布目录 | 仓库内源码 |
| --- | --- | --- |
| 美国站自行车前灯 · 品牌价格路标 | `bike-headlights-us/` | 尚未迁入 |
| 欧元站自行车前灯 · 品牌价格路标 | `bike-headlights-eu/` | 尚未迁入 |
| 欧洲自行车前灯竞品对比 | `competitor-matrix/` | 尚未迁入 |
| 全球雷达尾灯 · 品牌价格路标 | `radar-tail-light-roadmap/` | 尚未迁入 |
| 德国站自行车雷达尾灯 | `de-bike-radar-taillight/` | 尚未迁入 |
| ESP-Claw / Ditto 与 StackChan 调研报告 | `robot-projects/` | 尚未迁入 |
| 市场调研要求表单 | `market-research-intake/` | [源码与交付说明](sites/market-research-intake/) |
| 雷达尾灯 · Roadmap 与竞品分析 Demo | `radar-tail-light-demo/` | [源码与交付说明](sites/radar-tail-light-demo/) |

现有六站保留原地址。`source_path: null` 表示本仓库尚未收录可确认对应线上版本的开发源码；维护时通过独立任务迁入，不把发布产物当成已验收的源码工程。

## 三、目录与发布

```text
sites/<slug>/          PRD、可编辑设计稿、开发源码、构建与验收说明
<slug>/                该站经验证的静态发布产物
site-catalog.json       网站发布清单
index.html              汇总首页
docs/                   跨站约定与模板
.github/agent-collaboration/  项目协作协议与事实入口
```

当前 Pages 从 `main` 的仓库根目录发布，各网站使用独立子路径，共用仓库的一次部署。发布 PR 可同时交付站点产物、目录和汇总首页，由覆盖这些范围的任务协作完成，部署后验证子站与首页。

- 所有站点资源适配 `/static-pages/<slug>/`，保留已有 URL。
- `_config.yml` 排除开发、依赖和协作文件；公开仓库中的文件仍可从 GitHub 读取。
- 保留现有 Pages 发布方式，不增加 `.nojekyll` 或新的自动工作流。改变发布机制、权限或保护设置时，作为独立治理改动处理。
