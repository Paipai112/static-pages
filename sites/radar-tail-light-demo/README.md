# 雷达尾灯市场研究 Demo

## 一、当前交付

本目录保存可复现源码、依赖锁文件、已批准设计与实现范围。本说明随发布候选入库；实际合并、Pages 运行和线上检查见 [发布任务 #3](https://github.com/Paipai112/static-pages/issues/3)。

- 发布目录：仓库根 `radar-tail-light-demo/`。
- 工程入口：`demo.html`。
- Pages 入口：构建后 `pages-dist/index.html`。
- 菜单：Roadmap、竞品分析；竞品分析提供产品、厂商、大盘视图。
- 需求与确认：[PRD](docs/prd.md)。
- 原设计与后续改动：[设计说明](docs/design/README.md)。
- 已执行检查和待验证项：[验收记录](docs/acceptance.md)。

## 二、运行与构建

构建环境为 Node.js 24.21.0、npm 11.19.0；工程要求 Node.js 22 及以上。依赖版本保存在 `package-lock.json`。从本目录执行：

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run build:pages
```

- 开发服务中打开 `/demo.html#roadmap`。
- `npm run build` 产生 `dist/`，保留原 Roadmap 和 Demo 两个工程入口。
- `npm run build:pages` 随后生成 `pages-dist/`，以 Demo HTML 作为 `index.html`，并仅复制 Demo 所需资源。
- 将 `pages-dist/` 的内容复制到仓库根 `radar-tail-light-demo/`，保留相对资源路径和 hash 菜单。
- 发布预览需使用 `/static-pages/radar-tail-light-demo/` 子路径，不能仅依据开发根路径判断资源可用。

源码归档保留原运行依赖和锁文件。`package.json` 仅保留开发、构建、预览命令，并增加 `build:pages`；原研究导入、离线打包和测试命令未纳入此站交付。

## 三、数据范围

- 现有目录包含 30 款雷达尾灯、21 个品牌，沿用已获准呈现的商品快照字段。
- 趋势使用设计稿演示序列；品牌与大盘从同一套演示产品序列汇总。
- 保存的视图配置仅在访问者浏览器内存储，可主动导入或导出 JSON。
- 部分产品图片依赖 Amazon 图片 CDN。
- 设计资产同时保存在 `docs/design/` 与源码原引用位置 `designs/report-website-20261013/assets/`，以保持原源码和产物一致。
