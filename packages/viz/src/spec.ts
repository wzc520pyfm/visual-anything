import { isFullDate } from "./profile.js";
import { ANTV_PALETTE, MARK_LABEL, type ChartAdvice, type G2Spec, type Row } from "./types.js";

const HEAT_RANGE = ["#fff7ec", "#fdbb84", "#e34a33", "#7f0000"];
const SANS = '"PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif';
const SERIF = '"Songti SC", "Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", serif';

function chartTheme(): Record<string, unknown> {
  return {
    type: "classic",
    view: { viewFill: "transparent" },
    axis: {
      labelFontFamily: SANS,
      titleFontFamily: SANS,
      labelFill: "#44403c",
      titleFill: "#292524",
      labelFontSize: 12,
      titleFontSize: 12,
    },
    legend: {
      itemLabelFontFamily: SANS,
      itemLabelFill: "#44403c",
    },
    title: {
      titleFontFamily: SERIF,
      subtitleFontFamily: SANS,
      titleFill: "#1f1a17",
      subtitleFill: "#57534e",
    },
  };
}

export function buildSpec(advice: ChartAdvice, rows: Row[], title: string): G2Spec {
  const { x, y, color } = advice.encodings;
  const base = {
    autoFit: true as const,
    title: { title, subtitle: advice.reason, align: "left" as const },
    interaction: interaction(Boolean(color) && advice.mark !== "heatmap" && advice.mark !== "histogram"),
    legend: false as const,
    theme: chartTheme(),
  };

  switch (advice.mark) {
    case "line":
    case "area":
      return lineSpec(advice.mark, rows, title, advice.reason, x!, y!, color);
    case "bar":
    case "horizontal-bar":
      return barSpec(advice.mark === "horizontal-bar", rows, base, x!, y!);
    case "diverging-bar":
      return divergingSpec(rows, title, advice.reason, x!, y!);
    case "grouped-bar":
    case "stacked-bar":
      return groupedSpec(advice.mark === "stacked-bar", rows, base, x!, y!, color!);
    case "scatter":
      return {
        ...base,
        type: "point",
        data: rows,
        encode: { x: x!, y: y!, ...(color ? { color } : {}) },
        scale: {
          x: { nice: true },
          y: { nice: true },
          ...(color ? { color: { range: ANTV_PALETTE } } : {}),
        },
        axis: { x: { title: axisTitle(x!) }, y: { title: axisTitle(y!) } },
        style: { fillOpacity: 0.82, r: 4 },
        legend: color ? { color: { position: "bottom" } } : false,
      };
    case "pie":
      return {
        ...base,
        type: "interval",
        data: sortBy(rows, y!, "desc"),
        coordinate: { type: "theta", outerRadius: 0.82 },
        transform: [{ type: "stackY" }],
        encode: { y: y!, color: color! },
        scale: { color: { range: ANTV_PALETTE } },
        legend: { color: { position: "bottom" } },
        labels: [{ text: color!, position: "outside" }],
        interaction: interaction(true),
      };
    case "heatmap":
      return {
        ...base,
        type: "cell",
        data: rows,
        encode: { x: x!, y: y!, color: color! },
        scale: { color: { range: HEAT_RANGE } },
        axis: { x: { title: x! }, y: { title: y! } },
        style: { inset: 1 },
        legend: { color: { position: "right", title: color! } },
      };
    case "histogram":
      return {
        ...base,
        type: "rect",
        data: rows,
        encode: { x: x! },
        transform: [{ type: "binX", y: "count", thresholds: 8 }],
        scale: { y: { nice: true, domainMin: 0 } },
        axis: { x: { title: x! }, y: { title: "频数" } },
        style: { inset: 1 },
      };
    case "boxplot":
      return {
        ...base,
        type: "boxplot",
        data: rows,
        encode: { x: x!, y: y! },
        scale: { y: { nice: true } },
        axis: { x: { title: x! }, y: { title: axisTitle(y!) } },
      };
    default:
      return barSpec(false, rows, base, x ?? "", y ?? "");
  }
}

export function summarize(advice: ChartAdvice, rowCount: number): string {
  const label = MARK_LABEL[advice.mark];
  const { x, y, color } = advice.encodings;
  if (advice.mark === "histogram") {
    return `${label}，对${x}做分箱计数，共 ${rowCount} 行。`;
  }
  if (advice.mark === "boxplot") {
    return `${label}，横轴为${x}，纵轴为${y}的分布，共 ${rowCount} 行。`;
  }
  if (advice.mark === "pie") {
    return `${label}，用${color}看${y}的构成，共 ${rowCount} 行。`;
  }
  if (advice.mark === "diverging-bar") {
    return `${label}，横轴为${y}，以零为界，类别为${x}，共 ${rowCount} 行。`;
  }
  const axes = [x ? `横轴为${x}` : "", y ? `纵轴为${y}` : ""].filter(Boolean).join("，");
  const series = color && advice.mark !== "heatmap" ? `，按${color}分色` : "";
  const heat = advice.mark === "heatmap" ? `，颜色表示${color}` : "";
  return `${label}，${axes}${series}${heat}，共 ${rowCount} 行。`;
}

function lineSpec(
  mark: "line" | "area",
  rows: Row[],
  title: string,
  reason: string,
  x: string,
  y: string,
  color?: string,
): G2Spec {
  const temporal = rows.every((row) => row[x] === null || isFullDate(row[x]));
  const encode: Record<string, string> = { x, y, ...(color ? { color } : {}) };
  const children =
    mark === "area"
      ? [
          { type: "area", encode, style: { fillOpacity: 0.28 } },
          { type: "line", encode, style: { lineWidth: 2 } },
        ]
      : [
          { type: "line", encode, style: { lineWidth: 2 } },
          { type: "point", encode, style: { r: 3 } },
        ];

  return {
    type: "view",
    autoFit: true,
    data: sortBy(rows, x, "asc"),
    title: { title, subtitle: reason, align: "left" },
    theme: chartTheme(),
    scale: {
      x: temporal ? { type: "time" } : {},
      y: { nice: true },
      ...(color ? { color: { range: ANTV_PALETTE } } : {}),
    },
    axis: { x: { title: x }, y: { title: axisTitle(y) } },
    interaction: interaction(Boolean(color)),
    legend: color ? { color: { position: "bottom" } } : false,
    children,
  };
}

function barSpec(
  horizontal: boolean,
  rows: Row[],
  base: Pick<G2Spec, "autoFit" | "title" | "interaction" | "legend">,
  x: string,
  y: string,
): G2Spec {
  const values = rows.map((row) => row[y]).filter((value): value is number => typeof value === "number");
  const crossesZero = values.some((value) => value < 0);
  return {
    ...base,
    type: "interval",
    data: sortBy(rows, y, "desc"),
    encode: { x, y },
    scale: {
      x: { padding: 0.35 },
      y: crossesZero ? { nice: true } : { nice: true, domainMin: 0 },
    },
    axis: {
      x: { title: x, labelAutoRotate: !horizontal },
      y: { title: axisTitle(y) },
    },
    style: { radiusTopLeft: 4, radiusTopRight: 4, maxWidth: 46 },
    ...(horizontal ? { coordinate: { transform: [{ type: "transpose" }] } } : {}),
  };
}

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

function groupedSpec(
  stacked: boolean,
  rows: Row[],
  base: Pick<G2Spec, "autoFit" | "title" | "interaction" | "legend">,
  x: string,
  y: string,
  color: string,
): G2Spec {
  const values = rows.map((row) => row[y]).filter((value): value is number => typeof value === "number");
  const crossesZero = values.some((value) => value < 0);
  return {
    ...base,
    type: "interval",
    data: rows,
    encode: { x, y, color },
    transform: [{ type: stacked ? "stackY" : "dodgeX" }],
    scale: {
      y: crossesZero ? { nice: true } : { nice: true, domainMin: 0 },
      color: { range: ANTV_PALETTE },
    },
    axis: { x: { title: x }, y: { title: axisTitle(y) } },
    legend: { color: { position: "bottom" } },
    interaction: interaction(true),
  };
}

function interaction(series: boolean): Record<string, unknown> {
  return {
    tooltip: { shared: true },
    elementHighlight: { background: true },
    ...(series ? { legendFilter: true } : {}),
  };
}

function sortBy(rows: Row[], field: string, direction: "asc" | "desc"): Row[] {
  return [...rows].sort((left, right) => compare(left[field], right[field], direction));
}

function compare(left: Row[string], right: Row[string], direction: "asc" | "desc"): number {
  const sign = direction === "asc" ? 1 : -1;
  if (typeof left === "number" && typeof right === "number") return (left - right) * sign;
  return String(left ?? "").localeCompare(String(right ?? ""), "zh") * sign;
}

function axisTitle(field: string): string {
  return field;
}
