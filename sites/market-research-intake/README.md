# 市场调研要求表单

## 一、当前交付

本目录保存独立表单的可编辑 HTML、公开站点目录和交付记录。本说明随发布候选入库；实际上线状态见 [发布任务 #3](https://github.com/Paipai112/static-pages/issues/3)。

- 发布目录：仓库根 `market-research-intake/`。
- 入口：`index.html`。
- 输入：Amazon 站点、产品品类、检索要求。
- 输出：浏览器保存的要求，以及可复制或下载的完整 JSON 交接内容。
- [需求及批准记录](docs/prd.md)、[设计依据](docs/design/README.md)、[验收记录](docs/acceptance.md)。

## 二、运行与发布

这是无构建依赖的静态页面，不需要 npm 安装或依赖锁文件。可直接在浏览器打开 `index.html`，也可从本目录启动静态服务：

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

发布时仅复制以下两个文件到仓库根 `market-research-intake/`：

- `index.html`
- `amazon-marketplaces.js`

源文件中的资源使用相对路径。交付记录与 `docs/design/` 归档不进入公开页面目录。

## 三、数据与交接

- 填写内容保存在访问者浏览器，页面没有后端提交接口。
- 点击“确认并保存要求”后，一键复制完整交接内容给 AI，或下载 JSON。
- 保存操作本身不会自动启动调研。
- 23 个 Amazon 站点的目录来源保留在页面渐进披露区；站点目录不等同于采集工具已支持全部站点。
- 旧浏览器草稿中的检索词和显式要求会合并进入“检索要求”供用户继续编辑。
