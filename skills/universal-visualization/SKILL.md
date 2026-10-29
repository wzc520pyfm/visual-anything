---
name: universal-visualization
description: Use when a table, CSV, JSON, or report excerpt should become one deterministic AntV G2 statistical chart, with the mark chosen by field shape and a short intent. Use when the user asks to visualize rows, pick a chart, or export a standalone chart page. Do not use it to hand-author another chart library.
---

# Universal Visualization

v1 draws statistical charts with AntV G2. Call the pipeline. Do not hand-write chart markup, and do not switch the renderer to ECharts or another engine.

## When to use

- The input is a table: CSV, TSV, JSON rows, or an array already parsed into objects.
- The user wants a chart, a comparison, a trend, a share, a distribution, or a downloadable page.
- A previous chart looks misleading: truncated axis, mixed units, pie of negatives, or a cause stated from a correlation.

Do not use this for flowcharts, org charts, knowledge graphs, or infographics. Those AntV surfaces (X6, G6, Infographic) are not in v1. One repeated category with no measure becomes a count chart; a list of unique labels still does not.

## Pipeline

1. Put the table in `buildVisualization` from `src/lib/viz/pipeline.ts`.
2. Pass `text` or `rows`, plus `title` and `intentText` when the user named them.
3. If `ok` is false, show `error` and stop.
4. Use `selected` for the chart, `advices` if the user wants another valid mark, and `issues` in the caption.
5. Render `spec` with `chart.options(spec)`, or deliver `html`.
6. To force a mark, pass `mark` only when that mark appears in `advices`.

```ts
import { buildVisualization } from "./src/lib/viz/pipeline";

const result = buildVisualization({
  text: csv,
  title: "区域月销售额",
  intentText: "看各区域趋势",
});
```

CLI, from the repo root:

```bash
npm run viz -- --input examples/region-sales.csv --out chart.html --title 区域月销售额 --intent 看趋势
```

## Rules the pipeline already enforces

- Time plus a measure becomes a line. A second category with at most 12 values becomes the series color.
- One category plus a measure becomes a bar from zero, or a horizontal bar once there are more than 8 categories. The zero baseline is removed only when a value is negative.
- A rank intent with one category and one measure becomes a horizontal bar sorted from high to low. The vertical bar remains available.
- Two measures and no category become a scatter plot. Different units are called out and stay on separate axes.
- A pie chart is recommended only for a composition question, with at most 6 categories and no negative or missing values.
- Two categories plus one measure become a heatmap when both are compact, with a grouped bar as the alternative.
- One measure and nothing else becomes a histogram.
- A distribution intent with one measure and no category stays a histogram. The same intent with repeated measures inside one category becomes a boxplot. One row per category stays a comparison and adds `distribution-needs-repeats`.
- A category measure that is both positive and negative becomes a diverging bar with a zero rule. All-negative values stay an ordinary bar and do not pin zero.
- One repeated nominal column and no measure becomes a bar of counts and adds `count-chart`. Unique labels, or more than one nominal column, still produce no chart.
- `facts`, `finding`, and `alt` are recomputed from the drawn rows. A caller-supplied title is kept. The finding does not claim a cause, a correlation coefficient, or a share that was not in the table.
- “为什么 / 原因” adds `no-causation`. Describe the pattern. Do not name a cause the rows do not establish.
- More than 5000 rows are truncated with `row-limit`. Say that the chart uses the first 5000.
- Do not use this skill to hand-write Vega-Lite, Observable Plot, or ECharts. Do not use this skill for matplotlib, seaborn, or Plotly. Those skills author library code; this one calls `buildVisualization`.
- Do not publish through Datawrapper or Flourish. Deliver `html` or `spec`.
- Do not draw a map, a graph, a flowchart, or an infographic.
- Do not add a dual axis. A second measure remains `unused-measures`.

If `issues` contains `mark-unavailable`, `pie-unsuitable`, `mixed-units`, `missing-values`, or `no-causation`, put that sentence where the user can see it.

## v2

`V2_ENGINES` lists `echarts`. An adapter would return the same task result with a different `engine` and spec. Do not add that adapter inside the G2 spec builder. Further AntV marks (S2 tables, G6 graphs, X6 diagrams, Infographic) extend this task later; they are not v2 engines.
