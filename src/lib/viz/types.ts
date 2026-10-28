export const G2_VERSION = "5.4.8";

/** Engines other than AntV G2. Adapters for these are v2 work. */
export const V2_ENGINES = ["echarts"] as const;

export type Mark =
  | "bar"
  | "horizontal-bar"
  | "grouped-bar"
  | "stacked-bar"
  | "line"
  | "area"
  | "scatter"
  | "pie"
  | "heatmap"
  | "histogram";

export type FieldType = "quantitative" | "nominal" | "temporal";

export type Row = Record<string, string | number | null>;

export interface Issue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface FieldProfile {
  name: string;
  type: FieldType;
  missing: number;
  unique: number;
  unit?: string;
  min?: number;
  max?: number;
  negativeCount: number;
}

export interface Encodings {
  x?: string;
  y?: string;
  color?: string;
}

export interface ChartAdvice {
  id: string;
  mark: Mark;
  title: string;
  score: number;
  reason: string;
  encodings: Encodings;
}

export type G2Spec = {
  type: string;
  autoFit: boolean;
  data?: Row[];
  title: { title: string; subtitle: string; align: "left" };
  encode?: Record<string, string>;
  scale?: Record<string, Record<string, unknown>>;
  axis?: Record<string, unknown>;
  transform?: Record<string, unknown>[];
  coordinate?: Record<string, unknown>;
  interaction: Record<string, unknown>;
  legend: false | Record<string, unknown>;
  children?: { type: string; encode: Record<string, string>; style?: Record<string, unknown> }[];
  style?: Record<string, unknown>;
  labels?: Record<string, unknown>[];
  theme?: Record<string, unknown>;
};

export interface VizSuccess {
  ok: true;
  engine: "antv-g2";
  title: string;
  rows: Row[];
  fields: FieldProfile[];
  advices: ChartAdvice[];
  selected: ChartAdvice;
  spec: G2Spec;
  issues: Issue[];
  html: string;
  summary: string;
}

export interface VizFailure {
  ok: false;
  error: string;
  issues: Issue[];
  rows?: Row[];
  fields?: FieldProfile[];
}

export type VizResult = VizSuccess | VizFailure;

export interface VizInput {
  text?: string;
  rows?: Row[];
  intentText?: string;
  title?: string;
  mark?: Mark;
  maxRows?: number;
}

export const MARK_LABEL: Record<Mark, string> = {
  bar: "柱状图",
  "horizontal-bar": "条形图",
  "grouped-bar": "分组柱状图",
  "stacked-bar": "堆叠柱状图",
  line: "折线图",
  area: "面积图",
  scatter: "散点图",
  pie: "饼图",
  heatmap: "热力图",
  histogram: "直方图",
};

export const ANTV_PALETTE = [
  "#5B8FF9",
  "#5AD8A6",
  "#5D7092",
  "#F6BD16",
  "#E8684A",
  "#6DC8EC",
  "#9270CA",
  "#FF9D4D",
  "#269A99",
  "#FF99C3",
];
