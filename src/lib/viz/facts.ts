import type { ChartAdvice, ChartFacts, FieldProfile, Row } from "./types";
import { MARK_LABEL } from "./types";

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

export function findingSentence(advice: ChartAdvice, facts: ChartFacts, counted: boolean): string {
  const { mark, encodings } = advice;
  const { rowCount, measureName, maximumCategory, maximum, first, last, delta, sum } = facts;
  const { x, y, color } = encodings;

  if (counted && maximumCategory != null && maximum != null) {
    return `没有数值列。出现最多的是「${maximumCategory}」，${String(maximum)} 次。`;
  }

  if (
    (mark === "line" || mark === "area") &&
    measureName &&
    typeof first === "number" &&
    typeof last === "number" &&
    typeof delta === "number"
  ) {
    return `${measureName}从 ${String(first)} 变为 ${String(last)}，变化 ${String(delta)}。`;
  }

  if ((mark === "line" || mark === "area") && color && measureName) {
    return `各组${measureName}随时间变化，共 ${String(rowCount)} 行。`;
  }

  if (
    (mark === "bar" || mark === "horizontal-bar" || mark === "diverging-bar") &&
    maximumCategory &&
    maximum != null &&
    measureName
  ) {
    return `「${maximumCategory}」的${measureName}最高，为 ${String(maximum)}。`;
  }

  if (mark === "scatter" && x && y) {
    return `图上每个点是一行。只看${x}和${y}是否同向变化，不表示原因。`;
  }

  if (mark === "histogram" && x) {
    return `按${x}分箱计数，共 ${String(rowCount)} 行。`;
  }

  if (mark === "boxplot" && x && y) {
    return `按${x}看${y}的分布，共 ${String(rowCount)} 行。`;
  }

  if (mark === "pie" && color && y && sum != null) {
    return `按${color}看${y}的构成，合计 ${String(sum)}。`;
  }

  if (mark === "heatmap" && color) {
    return `颜色表示${color}，共 ${String(rowCount)} 行。`;
  }

  return measureName ? `${measureName}，共 ${String(rowCount)} 行。` : `共 ${String(rowCount)} 行。`;
}

export function altText(advice: ChartAdvice, _facts: ChartFacts, finding: string): string {
  return `${MARK_LABEL[advice.mark]}。${finding}`;
}
