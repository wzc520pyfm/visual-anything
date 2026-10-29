import type { Intent } from "./intent";
import { MARK_LABEL, type ChartAdvice, type Encodings, type FieldProfile, type Issue, type Mark } from "./types";

export function advise(
  fields: FieldProfile[],
  intents: Set<Intent>,
): { advices: ChartAdvice[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const quantitative = fields.filter((field) => field.type === "quantitative" && field.max !== undefined);
  const temporal = fields.filter((field) => field.type === "temporal");
  const nominal = fields.filter((field) => field.type === "nominal");
  const measure = quantitative[0];
  const advices: ChartAdvice[] = [];

  if (!measure) return { advices, issues };

  if (intents.has("cause")) {
    issues.push({
      level: "info",
      code: "no-causation",
      message: "图可以展示变化和差异，但不能据此断定原因。先核对维度、时间和对照组。",
    });
  }

  if (quantitative.length > 1 && (nominal.length > 0 || temporal.length > 0)) {
    const rest = quantitative.slice(1).map((field) => field.name).join("、");
    issues.push({
      level: "info",
      code: "unused-measures",
      message: `当前图使用「${measure.name}」。${rest}没有和它画在同一坐标轴上，避免不同口径混在一起。`,
    });
  }

  if (quantitative.length > 2 && nominal.length === 0 && temporal.length === 0) {
    issues.push({
      level: "info",
      code: "unused-measures",
      message: `散点图使用前两个数值字段，其余 ${quantitative.length - 2} 个数值字段留在表里。`,
    });
  }

  const pieOk =
    nominal.length === 1 &&
    temporal.length === 0 &&
    nominal[0].unique >= 2 &&
    nominal[0].unique <= 6 &&
    measure.negativeCount === 0 &&
    measure.missing === 0 &&
    (measure.min ?? 0) >= 0;

  if (intents.has("part-to-whole") && !pieOk) {
    issues.push({
      level: "warning",
      code: "pie-unsuitable",
      message: "占比图需要少量类别、非负且完整的数值。这组数据不适合饼图。",
    });
  }

  if (temporal.length > 0) {
    const time = temporal[0];
    const series = nominal.find((field) => field.unique > 1 && field.unique <= 12);
    const crowded = nominal.find((field) => field.unique > 12);
    if (crowded) {
      issues.push({
        level: "warning",
        code: "too-many-series",
        message: `「${crowded.name}」有 ${crowded.unique} 个取值，没有拆成多条线。`,
      });
    }
    const encodings = { x: time.name, y: measure.name, color: series?.name };
    advices.push(
      make(
        "line",
        intents.has("area") ? 7 : 10,
        series
          ? `按${series.name}分色，比较各自随${time.name}的变化。`
          : `${time.name}是时间，折线用来看${measure.name}如何变化。`,
        encodings,
      ),
    );
    advices.push(
      make(
        "area",
        intents.has("area") ? 12 : 6,
        `面积强调${measure.name}随${time.name}积累的体量。`,
        encodings,
      ),
    );
  }

  if (temporal.length === 0 && nominal.length === 1) {
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
    if (pieOk) {
      advices.push(
        make(
          "pie",
          intents.has("part-to-whole") ? 12 : 3,
          "类别少且数值都非负，饼图只回答构成问题。",
          { y: measure.name, color: category.name },
        ),
      );
    }
  }

  if (temporal.length === 0 && nominal.length >= 2) {
    const [first, second] = nominal;
    const compact = first.unique >= 2 && second.unique >= 2 && first.unique <= 8 && second.unique <= 8;
    const colorField = first.unique <= second.unique ? first : second;
    const xField = colorField === first ? second : first;
    advices.push(
      make(
        "heatmap",
        compact ? 10 : 4,
        "两个类别交叉，用颜色深浅表示数值大小。",
        { x: first.name, y: second.name, color: measure.name },
      ),
    );
    advices.push(
      make(
        "grouped-bar",
        compact ? 8 : 10,
        `按${colorField.name}分色，并排比较${measure.name}。`,
        { x: xField.name, y: measure.name, color: colorField.name },
      ),
    );
    if (measure.negativeCount === 0) {
      advices.push(
        make(
          "stacked-bar",
          5,
          "堆叠能看合计，单段之间不如并排清楚。",
          { x: xField.name, y: measure.name, color: colorField.name },
        ),
      );
    }
  }

  if (nominal.length === 0 && temporal.length === 0 && quantitative.length >= 2) {
    const [xField, yField] = quantitative;
    if (xField.unit && yField.unit && xField.unit !== yField.unit) {
      issues.push({
        level: "info",
        code: "mixed-units",
        message: `横轴单位是${xField.unit}，纵轴单位是${yField.unit}。两轴分开读，不要直接比大小。`,
      });
    }
    advices.push(
      make(
        "scatter",
        intents.has("correlation") ? 12 : 10,
        "两个数值字段放在两轴上，只观察是否一起变化，这不是因果关系。",
        { x: xField.name, y: yField.name },
      ),
    );
  }

  if (nominal.length === 0 && temporal.length === 0 && quantitative.length === 1) {
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
  }

  advices.sort((left, right) => right.score - left.score);
  return { advices, issues };
}

function make(mark: Mark, score: number, reason: string, encodings: Encodings): ChartAdvice {
  return {
    id: mark,
    mark,
    score,
    reason,
    encodings,
    title: MARK_LABEL[mark],
  };
}
