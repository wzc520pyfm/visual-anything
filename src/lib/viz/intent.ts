export type Intent =
  | "part-to-whole"
  | "correlation"
  | "distribution"
  | "area"
  | "trend"
  | "rank"
  | "cause";

export function detectIntents(text?: string): Set<Intent> {
  const intents = new Set<Intent>();
  if (!text?.trim()) return intents;
  const source = text.toLowerCase();
  if (/占比|构成|份额|组成|pie|share|proportion/.test(source)) intents.add("part-to-whole");
  if (/相关|关系|散点|correlation|scatter/.test(source)) intents.add("correlation");
  if (/分布|直方|histogram|distribution/.test(source)) intents.add("distribution");
  if (/面积|累计|\barea\b/.test(source)) intents.add("area");
  if (/趋势|走势|变化|trend/.test(source)) intents.add("trend");
  if (/排名|排序|rank|\btop\b/.test(source)) intents.add("rank");
  if (/为什么|原因|导致|cause/.test(source)) intents.add("cause");
  return intents;
}
