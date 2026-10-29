# Visual Anything

把一张整理好的表编译成一张 AntV G2 图。选图由字段形状和一句意图决定，同一输入得到同一张图、同一句结论。

这个包不依赖 Next.js。网页工作台留在仓库根目录。

## 安装

```bash
npm install visual-anything
```

```ts
import { buildVisualization } from "visual-anything";

const result = buildVisualization({
  text: "品类,销售额\n咖啡,120\n茶饮,80\n",
  intentText: "看排名",
});
```

命令行：

```bash
npx visual-anything --input data.csv --out chart.html --title 区域月销售额 --intent 看趋势
```

安装和 `npm test` 都会编译到 `dist`。网页和测试导入的是这份编译结果，和发布到 npm 的文件相同。改完 `src` 之后重新执行 `npm test` 或 `npm run dev`。

## 公开样例

[`fixtures/cases.json`](fixtures/cases.json) 是选图合同。每一条写明输入、图形、结论和检查码。测试 `src/public-contract.test.ts` 逐条核对。改规则时先改这份样例。

## 不做什么

不分组、不筛选、不把明细求和。订单流水不会自动变成「各区域销售额」；要先汇总，并在标题里写明口径。唯一的计数是：没有数值列、且只有一个类别出现重复时，柱高是出现次数。

不画地图、关系图、流程图和信息图。不写 Vega-Lite、ECharts、matplotlib、seaborn 或 Plotly。不加第二根数值轴。
