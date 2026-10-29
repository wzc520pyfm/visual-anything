# Visual Anything

把一份表格变成可交互的 AntV G2 图表。

粘贴 CSV 或 JSON，Visual Anything 会识别数值、类别和时间，选出一种图形，标出零基线、单位和缺失值方面的问题，并导出一个不依赖本项目的 HTML 文件。选图是确定的规则，不是临时让模型拼页面。

这一版只接 AntV G2。ECharts 和其他引擎记在 v2，还没有适配器。表格、关系图和信息图也还没接。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器默认在 [http://localhost:3000](http://localhost:3000)。

把示例画成独立页面：

```bash
npm run viz -- --input examples/region-sales.csv --out chart.html --title 区域月销售额 --intent 看趋势
```

装上已发布的包之后，同一条命令是 `npx visual-anything`。

测试：

```bash
npm test
```

## 给 Agent 用

选图编译器已发布为 [`visual-anything`](https://www.npmjs.com/package/visual-anything)，源码在 [`packages/viz`](packages/viz)。安装后调用 `buildVisualization`。规则在 [`skills/universal-visualization/SKILL.md`](skills/universal-visualization/SKILL.md)。公开样例在 [`packages/viz/fixtures/cases.json`](packages/viz/fixtures/cases.json)。

## 部署

这是一个 Next.js 应用。Netlify 使用仓库里的 `netlify.toml`：构建命令 `npm run build`，发布目录 `.next`。Netlify 会识别 Next.js，不需要再装适配器。
