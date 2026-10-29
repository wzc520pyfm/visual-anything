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
