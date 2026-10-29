import { advise } from "./advise";
import { renderHtml } from "./html";
import { detectIntents } from "./intent";
import { parseTable } from "./parse";
import { profileFields } from "./profile";
import { buildSpec, summarize } from "./spec";
import {
  G2_VERSION,
  MARK_LABEL,
  V2_ENGINES,
  type ChartAdvice,
  type FieldProfile,
  type Issue,
  type Row,
  type VizInput,
  type VizResult,
} from "./types";

export { G2_VERSION, V2_ENGINES };
export type { Mark, VizInput, VizResult, VizSuccess } from "./types";

const DEFAULT_MAX_ROWS = 5000;

export function buildVisualization(input: VizInput): VizResult {
  const parsed = input.rows
    ? { ok: true as const, table: { rows: input.rows.map((row) => ({ ...row })), percentColumns: [] as string[] } }
    : parseTable(input.text ?? "");

  if (!parsed.ok) {
    return fail(parsed.error, "unreadable-input");
  }

  const issues: Issue[] = [];
  const maxRows = input.maxRows ?? DEFAULT_MAX_ROWS;
  let rows = parsed.table.rows;
  if (rows.length > maxRows) {
    issues.push({
      level: "warning",
      code: "row-limit",
      message: `共 ${rows.length} 行，已使用前 ${maxRows} 行。`,
    });
    rows = rows.slice(0, maxRows);
  }

  if (rows.length === 0) return fail("没有数据行。", "empty-table");

  const fields = promoteYearFields(rows, profileFields(rows, parsed.table.percentColumns));
  const measure = fields.find((field) => field.type === "quantitative" && field.max !== undefined);
  if (!measure) {
    return {
      ok: false,
      error: "没有可用的数值字段，当前版本只绘制统计图。",
      issues: [
        {
          level: "error",
          code: "no-measure",
          message: "没有可用的数值字段，当前版本只绘制统计图。",
        },
      ],
      rows,
      fields,
    };
  }

  const adviceResult = advise(fields, detectIntents(input.intentText));
  issues.push(...adviceResult.issues);
  if (adviceResult.advices.length === 0) {
    return fail("这组字段还不能画出统计图。", "no-chart", rows, fields);
  }

  let selected = adviceResult.advices[0];
  if (input.mark) {
    const match = adviceResult.advices.find((item) => item.mark === input.mark);
    if (match) selected = match;
    else {
      issues.push({
        level: "warning",
        code: "mark-unavailable",
        message: `${MARK_LABEL[input.mark]}不适合这组字段，已保留${MARK_LABEL[selected.mark]}。`,
      });
    }
  }

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

  const missingField = [selected.encodings.x, selected.encodings.y, selected.encodings.color]
    .filter((name): name is string => Boolean(name))
    .map((name) => fields.find((field) => field.name === name))
    .find((field) => field && field.missing > 0);
  if (missingField) {
    issues.push({
      level: "warning",
      code: "missing-values",
      message: `「${missingField.name}」有 ${missingField.missing} 个空值，图中会跳过这些点。`,
    });
  }

  const title = input.title?.trim() || defaultTitle(selected);
  const spec = buildSpec(selected, rows, title);
  const summary = summarize(selected, rows.length);

  return {
    ok: true,
    engine: "antv-g2",
    title,
    rows,
    fields,
    advices: adviceResult.advices,
    selected,
    spec,
    issues,
    summary,
    html: renderHtml({ title, summary, spec, issues }),
  };
}

function defaultTitle(selected: ChartAdvice): string {
  const { x, y, color } = selected.encodings;
  if (selected.mark === "pie") return `${color ?? ""}的${y ?? ""}构成`;
  if (selected.mark === "histogram") return `${x ?? ""}分布`;
  if (selected.mark === "heatmap") return `${color ?? ""}热力`;
  if (selected.mark === "scatter") return `${x ?? ""}与${y ?? ""}`;
  return y && x ? `${y}按${x}` : "未命名图表";
}

function promoteYearFields(rows: Row[], fields: FieldProfile[]): FieldProfile[] {
  for (const field of fields) {
    if (field.type !== "quantitative" || field.min === undefined || field.max === undefined) continue;
    if (!/年|year|日期|date/i.test(field.name)) continue;
    if (field.min < 1900 || field.max > 2100 || field.unique < 2) continue;
    if (!Number.isInteger(field.min) || !Number.isInteger(field.max)) continue;
    field.type = "temporal";
    field.min = undefined;
    field.max = undefined;
    field.negativeCount = 0;
    for (const row of rows) {
      if (typeof row[field.name] === "number") row[field.name] = String(row[field.name]);
    }
  }
  return fields;
}

function fail(error: string, code: string, rows?: Row[], fields?: FieldProfile[]): VizResult {
  return {
    ok: false,
    error,
    issues: [{ level: "error", code, message: error }],
    ...(rows ? { rows } : {}),
    ...(fields ? { fields } : {}),
  };
}
