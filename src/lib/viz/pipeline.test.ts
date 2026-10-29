import { describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCli } from "../../cli";
import { SAMPLES } from "./samples";
import { G2_VERSION, V2_ENGINES, buildVisualization } from "./pipeline";

const lineCsv = "月份,销售额\n2024-01-01,120\n2024-02-01,132\n2024-03-01,128\n";

describe("buildVisualization", () => {
  test("turns a time series into an AntV G2 line chart", () => {
    const result = buildVisualization({
      text: lineCsv,
      title: "月度销售额",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.engine).toBe("antv-g2");
    expect(result.selected.mark).toBe("line");
    expect(result.selected.encodings).toMatchObject({ x: "月份", y: "销售额" });
    expect(result.spec.type).toBe("view");
    expect(result.spec.autoFit).toBe(true);
    expect(result.spec.title).toMatchObject({
      title: "月度销售额",
      align: "left",
    });
    const children = result.spec.children as { type: string; encode: Record<string, string> }[];
    expect(children.map((child) => child.type)).toEqual(["line", "point"]);
    expect(children[0].encode).toMatchObject({ x: "月份", y: "销售额" });
    expect(result.spec.scale).toMatchObject({ x: { type: "time" }, y: { nice: true } });
    expect(result.spec.interaction).toMatchObject({
      tooltip: { shared: true },
      elementHighlight: { background: true },
    });
    expect(result.summary).toContain("折线");
    expect(result.html).toContain(`@antv/g2@${G2_VERSION}`);
    expect(result.html).toContain("月度销售额");
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html.toLowerCase()).not.toContain("echarts");
    expect(result.fields.find((field) => field.name === "月份")?.type).toBe("temporal");
    expect(result.fields.find((field) => field.name === "销售额")?.type).toBe("quantitative");
    expect(result.rows[0]).toMatchObject({ 月份: "2024-01-01", 销售额: 120 });
  });

  test("ranks categories with a bar chart and keeps the zero baseline", () => {
    const result = buildVisualization({
      text: "品类,销售额\n茶饮,80\n咖啡,120\n烘焙,40\n",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("bar");
    expect(result.advices[0]).toBe(result.selected);
    expect(result.spec.type).toBe("interval");
    expect(result.spec.encode).toMatchObject({ x: "品类", y: "销售额" });
    expect(result.spec.scale).toMatchObject({ y: { nice: true, domainMin: 0 } });
    expect(result.spec.legend).toBe(false);
    expect(result.spec.data?.[0]).toMatchObject({ 品类: "咖啡", 销售额: 120 });
    expect(result.rows.map((row) => row.品类)).toEqual(["茶饮", "咖啡", "烘焙"]);
  });

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

  test("uses a horizontal bar when category labels get crowded", () => {
    const lines = ["品类,销售额"];
    for (let index = 1; index <= 10; index += 1) {
      lines.push(`分类${index},${index * 3}`);
    }
    const result = buildVisualization({ text: lines.join("\n") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("horizontal-bar");
    expect(result.spec.coordinate).toEqual({ transform: [{ type: "transpose" }] });
    expect(result.spec.scale).toMatchObject({ y: { domainMin: 0 } });
  });

  test("does not pin a bar axis at zero when values cross zero", () => {
    const result = buildVisualization({
      text: "品类,利润\n华东,10\n华北,-4\n华南,3\n",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("bar");
    const scale = result.spec.scale as { y: { domainMin?: number } };
    expect(scale.y.domainMin).toBeUndefined();
  });

  test("recommends a scatter plot for two measures", () => {
    const result = buildVisualization({
      text: "花费,成交\n10,30\n20,55\n15,40\n40,90\n",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("scatter");
    expect(result.spec.type).toBe("point");
    expect(result.spec.encode).toMatchObject({ x: "花费", y: "成交" });
    expect(result.spec.scale).toMatchObject({
      x: { nice: true },
      y: { nice: true },
    });
    const scale = result.spec.scale as { y: { domainMin?: number } };
    expect(scale.y.domainMin).toBeUndefined();
  });

  test("notes mixed units on a scatter plot without merging the axes", () => {
    const result = buildVisualization({
      text: "花费(万元),成交(单)\n1.2,30\n2.4,55\n0.8,20\n",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("scatter");
    expect(result.fields.find((field) => field.name === "花费(万元)")?.unit).toBe("万元");
    expect(result.issues.some((issue) => issue.code === "mixed-units")).toBe(true);
  });

  test("splits a time series by a category", () => {
    const result = buildVisualization({
      text: [
        "月份,区域,销售额",
        "2024-01,华东,100",
        "2024-01,华北,80",
        "2024-02,华东,110",
        "2024-02,华北,90",
      ].join("\n"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("line");
    expect(result.selected.encodings).toMatchObject({
      x: "月份",
      y: "销售额",
      color: "区域",
    });
    expect(result.spec.interaction).toMatchObject({ legendFilter: true });
    const children = result.spec.children as { encode: { color?: string } }[];
    expect(children[0].encode.color).toBe("区域");
  });

  test("prefers a pie chart only for an explicit share question", () => {
    const text = "渠道,订单数\n线上,60\n门店,30\n分销,10\n";
    const plain = buildVisualization({ text });
    const share = buildVisualization({ text, intentText: "看渠道占比" });

    expect(plain.ok && share.ok).toBe(true);
    if (!plain.ok || !share.ok) return;

    expect(plain.selected.mark).toBe("bar");
    expect(share.selected.mark).toBe("pie");
    expect(share.spec).toMatchObject({
      type: "interval",
      coordinate: { type: "theta", outerRadius: 0.82 },
      transform: [{ type: "stackY" }],
      encode: { y: "订单数", color: "渠道" },
    });
  });

  test("refuses a pie chart when a share contains negatives", () => {
    const result = buildVisualization({
      text: "渠道,利润\n线上,60\n门店,-5\n分销,10\n",
      intentText: "看利润占比",
      mark: "pie",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).not.toBe("pie");
    expect(result.issues.some((issue) => issue.code === "mark-unavailable")).toBe(true);
  });

  test("draws a heatmap for two categories and one measure", () => {
    const result = buildVisualization({
      text: [
        "时段,门店,客流",
        "早,南京路,120",
        "早,淮海路,80",
        "午,南京路,200",
        "午,淮海路,160",
        "晚,南京路,180",
        "晚,淮海路,140",
      ].join("\n"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("heatmap");
    expect(result.spec.type).toBe("cell");
    expect(result.spec.encode).toMatchObject({ x: "时段", y: "门店", color: "客流" });
    expect(result.advices.some((advice) => advice.mark === "grouped-bar")).toBe(true);
  });

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

  test("bins a single measure into a histogram", () => {
    const result = buildVisualization({
      text: "时长\n1\n2\n2\n3\n8\n9\n10\n",
      intentText: "看分布",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("histogram");
    expect(result.spec.type).toBe("rect");
    expect(result.spec.encode).toMatchObject({ x: "时长" });
    expect(result.spec.transform).toEqual([
      { type: "binX", y: "count", thresholds: expect.any(Number) },
    ]);
  });

  test("lets a valid mark override the recommendation", () => {
    const result = buildVisualization({
      text: "渠道,订单数\n线上,60\n门店,30\n分销,10\n",
      mark: "pie",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selected.mark).toBe("pie");
    expect(result.advices[0].mark).not.toBe("pie");
  });

  test("parses quoted csv, percents, and json payloads", () => {
    const csv = buildVisualization({
      text: '"品类","说明","销售额"\n"茶,饮","好","1,200"\n"咖啡","慢","20%"\n',
    });
    const json = buildVisualization({
      text: JSON.stringify({
        data: [
          { 品类: "茶", 销售额: 12 },
          { 品类: "咖", 销售额: 9 },
        ],
      }),
    });

    expect(csv.ok && json.ok).toBe(true);
    if (!csv.ok || !json.ok) return;

    expect(csv.rows[0]).toMatchObject({ 品类: "茶,饮", 销售额: 1200 });
    expect(csv.rows[1].销售额).toBe(20);
    expect(csv.fields.find((field) => field.name === "销售额")?.unit).toBe("%");
    expect(json.selected.mark).toBe("bar");
    expect(json.rows).toHaveLength(2);
  });

  test("escapes script terminators inside the exported html", () => {
    const result = buildVisualization({
      text: '品类,销售额\n"</script><script>alert(1)",12\n咖啡,8\n',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html.includes("</script><script>")).toBe(false);
    expect(result.html).toContain("\\u003c/script>");
  });

  test("caps oversized tables and says so", () => {
    const lines = ["品类,销售额"];
    for (let index = 0; index < 5; index += 1) lines.push(`类${index},${index + 1}`);
    const result = buildVisualization({ text: lines.join("\n"), maxRows: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rows).toHaveLength(2);
    expect(result.issues.some((issue) => issue.code === "row-limit")).toBe(true);
  });

  test("does not invent a cause from a why question", () => {
    const result = buildVisualization({
      text: lineCsv,
      intentText: "为什么销售额下降",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "no-causation", level: "info" }),
    );
  });

  test("rejects inputs that cannot become a statistical chart", () => {
    expect(buildVisualization({ text: "" }).ok).toBe(false);
    expect(buildVisualization({ text: "只有一段说明" }).ok).toBe(false);
    expect(buildVisualization({ text: "品类,备注\n茶,热\n咖,苦\n" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("数值"),
    });
    expect(buildVisualization({ text: "品类,销售额\n茶,\n咖,\n" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("数值"),
    });

    const broken = buildVisualization({ text: "只有一段说明" });
    if (!broken.ok) expect(broken.issues.length).toBeGreaterThan(0);
  });

  test("keeps v2 engines out of the v1 result", () => {
    expect(V2_ENGINES).toEqual(["echarts"]);
    const result = buildVisualization({ text: lineCsv });
    expect(result.ok && result.engine).toBe("antv-g2");
  });

  test("renders every bundled sample", () => {
    expect(SAMPLES.map((sample) => sample.id)).toEqual([
      "trend",
      "category",
      "scatter",
      "share",
      "heatmap",
    ]);

    for (const sample of SAMPLES) {
      const result = buildVisualization({
        text: sample.text,
        title: sample.title,
        intentText: sample.intentText,
      });
      expect(result.ok, sample.id).toBe(true);
      if (!result.ok) continue;
      expect(result.selected.mark).toBe(sample.expectedMark);
    }
  });
});

test("cli writes a standalone html file", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "wanxiang-"));
  const input = path.join(dir, "in.csv");
  const output = path.join(dir, "out.html");
  writeFileSync(input, lineCsv);

  const code = await runCli([
    "node",
    "cli",
    "--input",
    input,
    "--out",
    output,
    "--title",
    "月销售",
  ]);

  expect(code).toBe(0);
  const html = readFileSync(output, "utf8");
  expect(html).toContain(`@antv/g2@${G2_VERSION}`);
  expect(html).toContain("月销售");
});
