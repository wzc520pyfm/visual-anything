# Chart Compiler Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the next iteration of 万象 a stricter statistical compiler: rank and distribution intents change the chart, repeated measures can become a boxplot, signed values become a diverging bar, repeated categories with no measure become an explicit count, and every successful chart carries recomputed facts, a finding sentence, and alt text.

**Architecture:** Selection stays in `advise`. New marks (`boxplot`, `diverging-bar`) and the count rewrite are decided there, then `spec.ts` only renders the selected mark. `facts.ts` reads the already-selected encodings and the rows that were actually drawn. The chart title stays whatever the caller passed; the finding is a separate sentence. No second renderer, no aggregation beyond counting one repeated category, no dual axis.

**Tech Stack:** TypeScript, Vitest, AntV G2 5.4.8 (`type: "boxplot"` and `type: "lineY"` already exist in the installed package), Next.js workbench.

## Global Constraints

- The v1 engine remains `antv-g2`. Do not add an ECharts adapter, a Vega-Lite backend, or a call to any chart API.
- `G2_VERSION` stays `"5.4.8"`.
- The same table and the same `intentText` must return the same mark, encodings, facts, finding, and alt text.
- User-facing sentences stay in Chinese.
- A bar, horizontal bar, stacked bar, or count bar of non-negative values keeps `domainMin: 0`. A boxplot does not force zero. A diverging bar does not force zero; it draws a zero rule instead.
- Pie eligibility does not change: one nominal, no time, 2 to 6 categories, no negatives, no missing values, and `part-to-whole` intent is still required for pie to outrank the bar.
- Do not add a dual axis. Extra measures stay on `unused-measures`.
- Do not add maps, regression, density, violin, radar, sankey, or normalized stacks in this iteration.
- More than `maxRows` (default 5000) is still truncated before profiling, with `row-limit`.
- Do not hand-write chart markup from the skill. The skill continues to call `buildVisualization`.
- Before editing `src/components/workbench.tsx` or `src/app`, read the Next.js guide under `node_modules/next/dist/docs/` that matches the component being edited.

## File structure

- Modify `src/lib/viz/types.ts` — add `boxplot` and `diverging-bar` to `Mark`, plus `ChartFacts` and the new success fields.
- Modify `src/lib/viz/intent.ts` — `rank` and `distribution` already exist. Add `count`.
- Modify `src/lib/viz/advise.ts` — rank, distribution, boxplot, diverging bar, and the advice list for a synthesized count column.
- Create `src/lib/viz/counts.ts` — pure rewrite of one repeated nominal column into `{ category, 次数 }` rows. Returns null when the rewrite is not allowed.
- Create `src/lib/viz/facts.ts` — `chartFacts`, `findingSentence`, `altText`.
- Modify `src/lib/viz/spec.ts` — render boxplot and diverging bar.
- Modify `src/lib/viz/pipeline.ts` — run the count rewrite before the no-measure failure, attach facts, finding, and alt.
- Modify `src/lib/viz/html.ts` — print the finding and put alt text on the chart.
- Modify `src/components/workbench.tsx` — put the same alt text on the chart region.
- Modify `src/lib/viz/pipeline.test.ts` — one failing test per task, then the assertion that matches the new behavior.
- Modify `skills/universal-visualization/SKILL.md` — document the new rules and the routes that belong to other skills.

`ChartFacts` and the success fields are introduced in Task 3 and extended with `finding` and `alt` in Task 7. Tasks 1, 2, 4, 5, and 6 must not read those fields.

---

### Task 1: Rank intent selects a sorted horizontal bar

**Files:**
- Modify: `src/lib/viz/advise.ts`
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: `Intent` already includes `"rank"` from `detectIntents` (`排名`, `排序`, `rank`, `top`).
- Produces: when there is no time column, one nominal column, one measure, and `rank` is present, the winning advice is `horizontal-bar` with score 12. `bar` remains available at score 6. `barSpec` already sorts by the measure descending, so no spec change is required.

- [ ] **Step 1: Write the failing test**

Add this test inside `describe("buildVisualization")` in `src/lib/viz/pipeline.test.ts`:

```ts
test("ranks a short category list as a horizontal bar sorted high to low", () => {
  const result = buildVisualization({
    text: "品类,销售额\n茶饮,80\n咖啡,120\n烘焙,40\n",
    intentText: "看排名",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("horizontal-bar");
  expect(result.selected.score).toBe(12);
  expect(result.selected.reason).toContain("从高到低");
  expect(result.spec.coordinate).toEqual({ transform: [{ type: "transpose" }] });
  expect(result.spec.data?.map((row) => row.品类)).toEqual(["咖啡", "茶饮", "烘焙"]);
  expect(result.advices.map((advice) => advice.mark)).toContain("bar");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because `selected.mark` is `"bar"`.

- [ ] **Step 3: Raise the horizontal bar when rank is present**

In `advise`, inside the `temporal.length === 0 && nominal.length === 1` block, replace the two `advices.push` calls that choose `bar` and `horizontal-bar` with:

```ts
const category = nominal[0];
const crowded = category.unique > 8;
const ranked = intents.has("rank") && category.unique <= 12;
const primary = ranked || crowded ? "horizontal-bar" : "bar";
const secondary = primary === "horizontal-bar" ? "bar" : "horizontal-bar";
advices.push(
  make(
    primary,
    ranked ? 12 : 10,
    ranked
      ? `按${measure.name}从高到低排列${category.name}。`
      : crowded
        ? "类别较多，横条更方便阅读标签。"
        : `${category.name}之间比较${measure.name}，柱状图从零开始。`,
    { x: category.name, y: measure.name },
  ),
);
advices.push(
  make(
    secondary,
    5,
    secondary === "horizontal-bar"
      ? "类别不多，横条和竖柱都可以读。"
      : "竖柱也能比较，只是标签更容易挤在一起。",
    { x: category.name, y: measure.name },
  ),
);
```

Leave the pie advice in that block unchanged. `advices.sort` at the bottom already puts score 12 first, ahead of pie at score 3 when rank and part-to-whole are both absent.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: PASS, including the existing test that a category table without a rank intent stays a vertical bar.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/advise.ts src/lib/viz/pipeline.test.ts
git commit -m "Rank intent selects a horizontal bar sorted by the measure."
```

---

### Task 2: Distribution intent is explicit

**Files:**
- Modify: `src/lib/viz/advise.ts`
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: `Intent` already includes `"distribution"`.
- Produces: a single measure and no category or time stays `histogram`, and the reason contains `分布` when that intent is present. One nominal plus one measure with exactly one row per category stays a comparison bar and adds issue `distribution-needs-repeats` when the intent is present. This task does not add `boxplot`.

- [ ] **Step 1: Write the failing tests**

```ts
test("names the distribution when a single measure is already a histogram", () => {
  const result = buildVisualization({
    text: "耗时\n4\n9\n9\n15\n3\n",
    intentText: "看分布",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("histogram");
  expect(result.selected.reason).toContain("分布");
});

test("does not switch a one-row-per-category table to a distribution", () => {
  const result = buildVisualization({
    text: "品类,销售额\n茶饮,80\n咖啡,120\n烘焙,40\n",
    intentText: "看分布",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("bar");
  expect(result.issues).toContainEqual(
    expect.objectContaining({
      code: "distribution-needs-repeats",
      level: "info",
      message: "每个类别只有一个值，看不了分布，仍用柱状图比较大小。",
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because the histogram reason does not contain `分布`, and `distribution-needs-repeats` is absent.

- [ ] **Step 3: Implement the two branches**

Replace the histogram `make` call with:

```ts
advices.push(
  make(
    "histogram",
    10,
    intents.has("distribution")
      ? `要看「${measure.name}」的分布，按取值分箱计数。`
      : `只有「${measure.name}」一个数值，分箱后看分布。`,
    { x: measure.name },
  ),
);
```

`advise` does not receive rows, so it cannot tell "one row per category" from a unique count. Detect that case in `pipeline.ts` after `selected` is chosen:

```ts
const category = fields.find((field) => field.type === "nominal");
const askedDistribution = detectIntents(input.intentText).has("distribution");
if (
  askedDistribution &&
  selected.mark !== "histogram" &&
  category &&
  fields.filter((field) => field.type === "nominal").length === 1 &&
  fields.filter((field) => field.type === "temporal").length === 0 &&
  category.unique === rows.length
) {
  issues.push({
    level: "info",
    code: "distribution-needs-repeats",
    message: "每个类别只有一个值，看不了分布，仍用柱状图比较大小。",
  });
}
```

`selected` is assigned just below the current insertion point. Put the check after `selected` is chosen, so it can read `selected.mark`. Do not change the selected mark in this task.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/advise.ts src/lib/viz/pipeline.ts src/lib/viz/pipeline.test.ts
git commit -m "State when a distribution request stays a histogram or a bar."
```

---

### Task 3: Recomputed facts

**Files:**
- Create: `src/lib/viz/facts.ts`
- Modify: `src/lib/viz/types.ts`
- Modify: `src/lib/viz/pipeline.ts`
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: `FieldProfile`, `ChartAdvice`, `Row`.
- Produces:

```ts
export interface ChartFacts {
  rowCount: number;
  measureName?: string;
  sum?: number;
  minimum?: number;
  maximum?: number;
  maximumCategory?: string;
  missing?: number;
  first?: number;
  last?: number;
  delta?: number;
}

export function chartFacts(advice: ChartAdvice, rows: Row[], fields: FieldProfile[]): ChartFacts;
```

`VizSuccess` gains `facts: ChartFacts`. Numbers are sums and extremes of the rows actually passed in, after the row limit. No rounding. Missing measure values are skipped in `sum`, `minimum`, and `maximum`, and counted in `missing`.

- [ ] **Step 1: Write the failing test**

```ts
test("recomputes the measure total, the leading category, and the time change", () => {
  const bars = buildVisualization({
    text: "品类,销售额\n茶饮,80\n咖啡,120\n烘焙,40\n",
  });
  expect(bars.ok).toBe(true);
  if (!bars.ok) return;
  expect(bars.facts).toEqual({
    rowCount: 3,
    measureName: "销售额",
    sum: 240,
    minimum: 40,
    maximum: 120,
    maximumCategory: "咖啡",
    missing: 0,
  });

  const line = buildVisualization({
    text: "月份,销售额\n2024-01-01,10\n2024-03-01,40\n2024-02-01,25\n",
  });
  expect(line.ok).toBe(true);
  if (!line.ok) return;
  expect(line.facts).toMatchObject({
    measureName: "销售额",
    first: 10,
    last: 40,
    delta: 30,
    sum: 75,
  });
  expect(line.facts.maximumCategory).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because `facts` does not exist.

- [ ] **Step 3: Add the facts helper and attach it**

Create `src/lib/viz/facts.ts`:

```ts
import type { ChartAdvice, ChartFacts, FieldProfile, Row } from "./types";

export function chartFacts(advice: ChartAdvice, rows: Row[], fields: FieldProfile[]): ChartFacts {
  const measureName = advice.mark === "heatmap"
    ? advice.encodings.color
    : advice.encodings.y ?? advice.encodings.x;
  const facts: ChartFacts = { rowCount: rows.length };
  if (!measureName) return facts;

  const field = fields.find((item) => item.name === measureName);
  const values = rows
    .map((row) => row[measureName])
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return facts;

  facts.measureName = measureName;
  facts.sum = values.reduce((total, value) => total + value, 0);
  facts.minimum = Math.min(...values);
  facts.maximum = Math.max(...values);
  facts.missing = field?.missing ?? rows.length - values.length;

  const category = advice.mark === "line" || advice.mark === "area" || advice.mark === "scatter" || advice.mark === "heatmap" || advice.mark === "histogram"
    ? undefined
    : advice.encodings.x;
  if (category) {
    const leader = rows.find((row) => row[measureName] === facts.maximum && row[category] != null);
    if (leader) facts.maximumCategory = String(leader[category]);
  }

  const time = advice.encodings.x;
  const singleSeries = advice.mark === "line" || advice.mark === "area";
  if (singleSeries && time && !advice.encodings.color) {
    const ordered = [...rows]
      .filter((row) => typeof row[measureName] === "number")
      .sort((left, right) => String(left[time] ?? "").localeCompare(String(right[time] ?? "")));
    const first = ordered[0]?.[measureName];
    const last = ordered[ordered.length - 1]?.[measureName];
    if (typeof first === "number" && typeof last === "number") {
      facts.first = first;
      facts.last = last;
      facts.delta = last - first;
    }
  }

  return facts;
}
```

Add `ChartFacts` to `src/lib/viz/types.ts` and `facts: ChartFacts` on `VizSuccess`.

In `pipeline.ts`, after `const summary = summarize(...)`:

```ts
const facts = chartFacts(selected, rows, fields);
```

Include `facts` on the returned object.

A histogram has no `encodings.y`; `y ?? x` still selects its measure, and `maximumCategory` stays absent because histogram and heatmap are excluded above. A heatmap measure is `encodings.color`, not the category on `y`. The time sort uses string order, which matches `YYYY-MM-DD` values already accepted by `profile.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/facts.ts src/lib/viz/types.ts src/lib/viz/pipeline.ts src/lib/viz/pipeline.test.ts
git commit -m "Attach recomputed measure facts to every successful chart."
```

---

### Task 4: Boxplot for repeated measures

**Files:**
- Modify: `src/lib/viz/types.ts`
- Modify: `src/lib/viz/advise.ts`
- Modify: `src/lib/viz/spec.ts`
- Modify: `src/lib/viz/pipeline.ts` (the distribution issue from Task 2 must not fire when boxplot is selected)
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: `Mark`, `buildSpec`, `advise`.
- Produces: `"boxplot"` in `Mark` and `MARK_LABEL` (`箱线图`). It is recommended only when `distribution` is present, there is no time column, there is one nominal column, there is a measure, and `rows.length >= nominal.unique * 2`. Otherwise it is listed at score 7 while the comparison bar stays at 10. The spec type is `"boxplot"`. The y scale is `{ nice: true }` and has no `domainMin`.

`advise` still does not receive rows. Pass a boolean into `advise` rather than guessing from unique counts.

Change the signature to:

```ts
export function advise(
  fields: FieldProfile[],
  intents: Set<Intent>,
  options?: { repeatedMeasures?: boolean },
): { advices: ChartAdvice[]; issues: Issue[] }
```

`pipeline.ts` computes:

```ts
const onlyCategory = fields.filter((field) => field.type === "nominal");
const repeatedMeasures =
  onlyCategory.length === 1 &&
  fields.every((field) => field.type !== "temporal") &&
  onlyCategory[0].unique >= 2 &&
  rows.length >= onlyCategory[0].unique * 2;
```

and calls `advise(fields, detectIntents(input.intentText), { repeatedMeasures })`.

- [ ] **Step 1: Write the failing tests**

```ts
test("keeps a bar as the default when each group has repeated measures", () => {
  const text = "门店,耗时\n甲,4\n甲,9\n甲,6\n乙,3\n乙,8\n乙,5\n";
  const result = buildVisualization({ text });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("bar");
  expect(result.advices.map((advice) => advice.mark)).toContain("boxplot");
});

test("uses a boxplot when the user asks for a distribution of repeated measures", () => {
  const result = buildVisualization({
    text: "门店,耗时\n甲,4\n甲,9\n甲,6\n乙,3\n乙,8\n乙,5\n",
    intentText: "看分布",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("boxplot");
  expect(result.selected.encodings).toEqual({ x: "门店", y: "耗时" });
  expect(result.spec.type).toBe("boxplot");
  const scale = result.spec.scale as { y: { domainMin?: number; nice?: boolean } };
  expect(scale.y.nice).toBe(true);
  expect(scale.y.domainMin).toBeUndefined();
  expect(result.issues.some((issue) => issue.code === "distribution-needs-repeats")).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because `boxplot` is not a mark.

- [ ] **Step 3: Add the mark, the score, and the spec**

In `types.ts`:

```ts
| "boxplot"
| "diverging-bar"
```

Add `diverging-bar` to the union now so Task 5 does not reshuffle the type, but do not emit it until Task 5. Add both labels:

```ts
boxplot: "箱线图",
"diverging-bar": "发散条形图",
```

In the one-nominal block of `advise`, after the pie advice:

```ts
if (options?.repeatedMeasures && measure) {
  advices.push(
    make(
      "boxplot",
      intents.has("distribution") ? 12 : 7,
      `「${nominal[0].name}」各组有多条${measure.name}，箱线图用来看分布而不是合计。`,
      { x: nominal[0].name, y: measure.name },
    ),
  );
}
```

`measure` is already required before this block. The comparison bar stays at score 10, so distribution intent at 12 wins and the default bar still wins at 10 over 7.

In `spec.ts`, add a `case "boxplot"` before `default`:

```ts
case "boxplot":
  return {
    ...base,
    type: "boxplot",
    data: rows,
    encode: { x: x!, y: y! },
    scale: { y: { nice: true } },
    axis: { x: { title: x! }, y: { title: axisTitle(y!) } },
  };
```

In `summarize`, handle boxplot before the generic axis sentence:

```ts
if (advice.mark === "boxplot") {
  return `${label}，横轴为${x}，纵轴为${y}的分布，共 ${rowCount} 行。`;
}
```

In the Task 2 distribution issue, change `selected.mark !== "histogram"` to also exclude `"boxplot"`:

```ts
selected.mark !== "histogram" && selected.mark !== "boxplot"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: PASS. The one-row-per-category distribution test from Task 2 still reports `distribution-needs-repeats`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/types.ts src/lib/viz/advise.ts src/lib/viz/spec.ts src/lib/viz/pipeline.ts src/lib/viz/pipeline.test.ts
git commit -m "Offer a boxplot when a category has repeated measures."
```

---

### Task 5: Diverging bar when a measure crosses zero

**Files:**
- Modify: `src/lib/viz/advise.ts`
- Modify: `src/lib/viz/spec.ts`
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: `Mark` `"diverging-bar"` and `MARK_LABEL["diverging-bar"]` from Task 4.
- Produces: when one nominal, no time, and the measure has both a positive and a negative value (`negativeCount > 0` and `(max ?? 0) > 0`), the winning advice is `diverging-bar` at score 12. The ordinary bar remains at score 6. The spec is a transposed view: an `interval` child plus a `lineY` child whose data is `[0]`. All-negative measures stay on the ordinary bar and do not set `domainMin`.

- [ ] **Step 1: Write the failing test and update the old crossing-zero test**

Replace the assertion in `"does not pin a bar axis at zero when values cross zero"` so it expects the new mark. Keep the fixture `品类,利润 / 华东,10 / 华北,-4 / 华南,3`. The test should now be:

```ts
test("draws a zero rule when a category measure crosses zero", () => {
  const result = buildVisualization({
    text: "品类,利润\n华东,10\n华北,-4\n华南,3\n",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("diverging-bar");
  expect(result.selected.reason).toContain("零");
  expect(result.spec.type).toBe("view");
  expect(result.spec.coordinate).toEqual({ transform: [{ type: "transpose" }] });
  const children = result.spec.children as { type: string; data?: number[] }[];
  expect(children.map((child) => child.type)).toEqual(["interval", "lineY"]);
  expect(children[1].data).toEqual([0]);
});

test("keeps an ordinary bar when every value is negative", () => {
  const result = buildVisualization({
    text: "品类,利润\n华东,-10\n华北,-4\n华南,-1\n",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("bar");
  const scale = result.spec.scale as { y: { domainMin?: number } };
  expect(scale.y.domainMin).toBeUndefined();
});
```

Delete the old test name `"does not pin a bar axis at zero when values cross zero"` so there is one crossing-zero test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because the crossing-zero fixture still selects `bar`.

- [ ] **Step 3: Select and render the diverging bar**

In the one-nominal block, before the comparison bar is pushed, when `measure.negativeCount > 0 && (measure.max ?? 0) > 0`:

```ts
advices.push(
  make(
    "diverging-bar",
    12,
    `${measure.name}有正有负，以零为界向两侧展开。`,
    { x: category.name, y: measure.name },
  ),
);
```

Lower the primary comparison score from 10 to 6 in this same situation so the diverging bar wins. Do this with a local `comparisonScore`:

```ts
const crossesBothWays = measure.negativeCount > 0 && (measure.max ?? 0) > 0;
const comparisonScore = crossesBothWays ? 6 : ranked ? 12 : 10;
```

Use `comparisonScore` as the score of `primary`. Rank plus mixed signs still shows both advices; diverging bar at 12 outranks a ranked horizontal bar at 6. That is intentional: a ranking of mixed signs is still read from the zero line.

Add `divergingSpec` in `spec.ts` and call it from `case "diverging-bar"`:

```ts
function divergingSpec(
  rows: Row[],
  title: string,
  reason: string,
  x: string,
  y: string,
): G2Spec {
  return {
    type: "view",
    autoFit: true,
    data: sortBy(rows, y, "desc"),
    title: { title, subtitle: reason, align: "left" },
    theme: chartTheme(),
    coordinate: { transform: [{ type: "transpose" }] },
    interaction: interaction(false),
    legend: false,
    children: [
      {
        type: "interval",
        encode: { x, y },
        scale: { x: { padding: 0.35 }, y: { nice: true } },
        axis: { x: { title: x }, y: { title: axisTitle(y) } },
        style: { maxWidth: 28 },
      },
      {
        type: "lineY",
        data: [0],
        style: { stroke: "#1f1a17", lineWidth: 1 },
        encode: {},
      },
    ],
  };
}
```

Extend the `children` member of `G2Spec` so a child may include `data`, `scale`, `axis`, and `style`. The existing area and line children only use `type`, `encode`, and `style`.

In `summarize`:

```ts
if (advice.mark === "diverging-bar") {
  return `${label}，横轴为${y}，以零为界，类别为${x}，共 ${rowCount} 行。`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: PASS. Non-negative category charts still pin `domainMin: 0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/advise.ts src/lib/viz/spec.ts src/lib/viz/types.ts src/lib/viz/pipeline.test.ts
git commit -m "Use a diverging bar when a category measure crosses zero."
```

---

### Task 6: Count a repeated category when no measure exists

**Files:**
- Create: `src/lib/viz/counts.ts`
- Modify: `src/lib/viz/intent.ts`
- Modify: `src/lib/viz/pipeline.ts`
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: parsed `rows` and `fields` before the no-measure failure.
- Produces:

```ts
export interface CountTable {
  rows: Row[];
  category: string;
}

export function countRepeatedCategory(rows: Row[], fields: FieldProfile[]): CountTable | null;
```

The rewrite is allowed only when every field is nominal, exactly one field has `unique >= 2`, `unique < rows.length`, and `unique <= 12`. The returned rows are one per distinct value: `{ [category]: value, 次数: count }`, sorted by `次数` descending. `pipeline` profiles those rows again and continues through the normal advice path. It then appends:

```ts
{ level: "info", code: "count-chart", message: `没有数值列。柱高是「${category}」出现的次数。` }
```

A list of unique labels, two nominal columns, or an empty table still returns `ok: false` and the existing error still contains `数值`. `Intent` gains `"count"`, detected from `计数|频数|多少个|出现次数|\bcount\b`. The count rewrite does not require that intent. The intent only exists so a later refusal can name it; this task does not branch on it.

- [ ] **Step 1: Write the failing tests**

```ts
test("counts a repeated category when the table has no measure", () => {
  const result = buildVisualization({
    text: "品类\n咖啡\n咖啡\n咖啡\n茶饮\n茶饮\n",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.selected.mark).toBe("bar");
  expect(result.selected.encodings).toEqual({ x: "品类", y: "次数" });
  expect(result.spec.encode).toMatchObject({ x: "品类", y: "次数" });
  expect(result.spec.data).toEqual([
    { 品类: "咖啡", 次数: 3 },
    { 品类: "茶饮", 次数: 2 },
  ]);
  expect(result.issues).toContainEqual(
    expect.objectContaining({
      code: "count-chart",
      level: "info",
      message: "没有数值列。柱高是「品类」出现的次数。",
    }),
  );
  expect(result.spec.scale).toMatchObject({ y: { domainMin: 0 } });
});

test("still rejects a list of unique labels", () => {
  const result = buildVisualization({
    text: "品类\n咖啡\n茶饮\n烘焙\n",
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error).toContain("数值");
});
```

The existing rejection of `品类,备注` with two unique rows must stay as written.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because the repeated category table is `ok: false`.

- [ ] **Step 3: Rewrite the table before giving up**

Create `src/lib/viz/counts.ts`:

```ts
import type { FieldProfile, Row } from "./types";

export interface CountTable {
  rows: Row[];
  category: string;
}

export function countRepeatedCategory(rows: Row[], fields: FieldProfile[]): CountTable | null {
  if (fields.length === 0 || fields.some((field) => field.type !== "nominal")) return null;
  const countable = fields.filter((field) => field.unique >= 2 && field.unique < rows.length && field.unique <= 12);
  if (countable.length !== 1) return null;

  const category = countable[0].name;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[category];
    if (value == null || value === "") continue;
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size < 2) return null;

  const counted = [...counts.entries()]
    .map(([name, count]) => ({ [category]: name, 次数: count }))
    .sort((left, right) => right.次数 - left.次数);
  return { rows: counted, category };
}
```

In `intent.ts`, add `"count"` to the `Intent` union and:

```ts
if (/计数|频数|多少个|出现次数|\bcount\b/.test(source)) intents.add("count");
```

In `pipeline.ts`, when `measure` is missing, call `countRepeatedCategory(rows, fields)`. If it returns a table, replace `rows` with `counted.rows`, recompute fields with `profileFields(counted.rows, [])`, and continue. Do not recurse through row limiting. After the successful advice for this path, push the `count-chart` issue. If `countRepeatedCategory` returns null, keep the current `no-measure` failure unchanged.

The count rows are already sorted, and `barSpec` sorts again by `次数` descending, so the order stays coffee then tea.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: PASS, including `"rejects inputs that cannot become a statistical chart"`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/counts.ts src/lib/viz/intent.ts src/lib/viz/pipeline.ts src/lib/viz/pipeline.test.ts
git commit -m "Count one repeated category when the table has no measure."
```

---

### Task 7: Finding sentence and alt text

**Files:**
- Modify: `src/lib/viz/facts.ts`
- Modify: `src/lib/viz/types.ts`
- Modify: `src/lib/viz/pipeline.ts`
- Modify: `src/lib/viz/html.ts`
- Modify: `src/components/workbench.tsx`
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: `ChartFacts`, `ChartAdvice`, and the `count-chart` issue when present.
- Produces:

```ts
export function findingSentence(advice: ChartAdvice, facts: ChartFacts, counted: boolean): string;
export function altText(advice: ChartAdvice, facts: ChartFacts, finding: string): string;
```

`VizSuccess` gains `finding: string` and `alt: string`.

`findingSentence` uses only `facts` and the selected mark:

- `bar`, `horizontal-bar`, or `diverging-bar` with `maximumCategory` and `maximum`: `「${maximumCategory}」的${measureName}最高，为 ${maximum}。`
- `line` or `area` with numeric `first`, `last`, and `delta`: `${measureName}从 ${first} 变为 ${last}，变化 ${delta}。`
- `line` or `area` with a color encoding: `各组${measureName}随时间变化，共 ${rowCount} 行。`
- `scatter`: `图上每个点是一行。只看${x}和${y}是否同向变化，不表示原因。`
- `histogram`: `按${x}分箱计数，共 ${rowCount} 行。`
- `boxplot`: `按${x}看${y}的分布，共 ${rowCount} 行。`
- `pie`: `按${color}看${y}的构成，合计 ${sum}。`
- `heatmap`: `颜色表示${color}，共 ${rowCount} 行。`
- counted bar: `没有数值列。出现最多的是「${maximumCategory}」，${maximum} 次。`

`altText` is `${MARK_LABEL[mark]}。${finding}`

If `input.title` is missing or blank, `result.title` becomes `finding` with the trailing `。` removed. If `input.title` is present, `result.title` stays the caller title and `finding` is not copied over it.

`renderHtml` prints `<p class="finding">` after the summary and sets `role="img"` and `aria-label` on `#chart`. The workbench chart wrapper sets `aria-label` to `result.alt`.

- [ ] **Step 1: Write the failing tests**

```ts
test("uses the leading category as the finding when no title was given", () => {
  const result = buildVisualization({
    text: "品类,销售额\n茶饮,80\n咖啡,120\n烘焙,40\n",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.finding).toBe("「咖啡」的销售额最高，为 120。");
  expect(result.title).toBe("「咖啡」的销售额最高，为 120");
  expect(result.alt).toBe("柱状图。「咖啡」的销售额最高，为 120。");
  expect(result.html).toContain('aria-label="柱状图。「咖啡」的销售额最高，为 120。"');
  expect(result.html).toContain("「咖啡」的销售额最高，为 120。");
});

test("keeps a caller title and still reports the time change", () => {
  const result = buildVisualization({
    text: "月份,销售额\n2024-01-01,10\n2024-02-01,25\n2024-03-01,40\n",
    title: "月度销售额",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.title).toBe("月度销售额");
  expect(result.finding).toBe("销售额从 10 变为 40，变化 30。");
  expect(result.spec.title).toMatchObject({ title: "月度销售额" });
});

test("does not describe a scatter plot as a cause", () => {
  const result = buildVisualization({
    text: "花费,成交\n10,30\n20,55\n15,40\n",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.finding).toContain("不表示原因");
  expect(result.finding).not.toContain("相关");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because `finding` is undefined. The existing line-chart test passes a title, so its title assertion stays valid.

- [ ] **Step 3: Generate the sentences and thread them through**

Add `findingSentence` and `altText` to `facts.ts` using the sentences in the interface block. Format numbers with `String(value)` so integers stay integers. `delta` is the raw subtraction, including negatives.

In `pipeline.ts`:

```ts
const counted = issues.some((issue) => issue.code === "count-chart");
const finding = findingSentence(selected, facts, counted);
const alt = altText(selected, facts, finding);
const title = input.title?.trim() || finding.replace(/。$/, "");
```

Pass `title` to `buildSpec` as it already does. Return `finding` and `alt`.

In `html.ts`, add the finding paragraph and:

```html
<div id="chart" role="img" aria-label="${escapeHtml(input.alt)}"></div>
```

Extend the `renderHtml` input with `finding: string` and `alt: string`. Escape both.

In `workbench.tsx`, on the element that wraps `AntvChart`, set `aria-label={result.alt}`.

Read the local Next.js component docs before editing the client component. This change does not add a new route or a server API.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: PASS. Also run `npm test` and expect the whole Vitest file set to pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/facts.ts src/lib/viz/types.ts src/lib/viz/pipeline.ts src/lib/viz/html.ts src/components/workbench.tsx src/lib/viz/pipeline.test.ts
git commit -m "Add a recomputed finding and alt text to every chart."
```

---

### Task 8: Tell agents what this skill does not draw

**Files:**
- Modify: `skills/universal-visualization/SKILL.md`
- Test: `src/lib/viz/pipeline.test.ts`

**Interfaces:**
- Consumes: the behaviors from Tasks 1 through 7.
- Produces: a skill description that names the hand-offs. No runtime behavior changes.

- [ ] **Step 1: Write the failing test**

```ts
test("the skill tells agents where not to send a statistical table", () => {
  const skill = readFileSync(new URL("../../../skills/universal-visualization/SKILL.md", import.meta.url), "utf8");

  expect(skill).toContain("horizontal bar sorted from high to low");
  expect(skill).toContain("boxplot");
  expect(skill).toContain("diverging bar");
  expect(skill).toContain("count-chart");
  expect(skill).toContain("Do not use this skill to hand-write Vega-Lite");
  expect(skill).toContain("Do not use this skill for matplotlib, seaborn, or Plotly");
  expect(skill).toContain("Do not publish through Datawrapper or Flourish");
  expect(skill).toContain("Do not draw a map");
  expect(skill).toContain("Do not add a dual axis");
});
```

`pipeline.test.ts` already imports `readFileSync`. Add `import.meta.url` only in this test; Vitest is running the TypeScript source, so the URL is the `src/lib/viz` directory and `../../../skills` reaches `skills/`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/viz/pipeline.test.ts`

Expected: FAIL because those sentences are not in the skill.

- [ ] **Step 3: Replace the rules section with the enlarged contract**

Keep the frontmatter `name`. Replace the description with:

```yaml
description: Use when a table, CSV, JSON, or report excerpt should become one deterministic AntV G2 statistical chart, with the mark chosen by field shape and a short intent. Use when the user asks to visualize rows, pick a chart, or export a standalone chart page. Do not use it to hand-author another chart library.
```

Add these bullets under the existing rules:

- A rank intent with one category and one measure becomes a horizontal bar sorted from high to low. The vertical bar remains available.
- A distribution intent with one measure and no category stays a histogram. The same intent with repeated measures inside one category becomes a boxplot. One row per category stays a comparison and adds `distribution-needs-repeats`.
- A category measure that is both positive and negative becomes a diverging bar with a zero rule. All-negative values stay an ordinary bar and do not pin zero.
- One repeated nominal column and no measure becomes a bar of counts and adds `count-chart`. Unique labels, or more than one nominal column, still produce no chart.
- `facts`, `finding`, and `alt` are recomputed from the drawn rows. A caller-supplied title is kept. The finding does not claim a cause, a correlation coefficient, or a share that was not in the table.
- Do not use this skill to hand-write Vega-Lite, Observable Plot, ECharts, matplotlib, seaborn, or Plotly. Those skills author library code; this one calls `buildVisualization`.
- Do not publish through Datawrapper or Flourish. Deliver `html` or `spec`.
- Do not draw a map, a graph, a flowchart, or an infographic.
- Do not add a dual axis. A second measure remains `unused-measures`.

Keep the existing pie, zero-baseline, mixed-unit, causation, and row-limit bullets. They are still true.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/universal-visualization/SKILL.md src/lib/viz/pipeline.test.ts
git commit -m "Document the chart compiler boundaries against other visualization skills."
```

---

## Out of scope

- Normalized stacks for part-to-whole over time.
- Five render backends, Flint templates, or a Python port.
- Executing model-written plotting code.
- Hosted publishing, accounts, or image URLs.
- Maps, choropleths, and geographic field types.
- Color-blind pixel checks and a second review of the rendered PNG. Alt text is the text contract; it is not an image linter.
- Changing pie eligibility or adding dual axes.

## Self-review

- Rank, distribution, facts, boxplot, diverging bar, count, finding, alt text, and skill routing each have a task.
- The count rule is decided: one repeated nominal column becomes counts; unique labels still fail the existing no-measure test.
- `diverging-bar` is added to the type in Task 4 and emitted in Task 5, so the mark union does not change twice.
- `advise` gains an optional argument in Task 4. Tasks 1 and 2 call the old two-argument form, which still typechecks.
- The old crossing-zero test is replaced in Task 5 rather than left asserting `bar`.
- No task asks for a dual axis, a map, or a second engine.
