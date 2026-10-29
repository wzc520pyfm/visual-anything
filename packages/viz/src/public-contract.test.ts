import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildVisualization } from "visual-anything";

interface SuccessExpect {
  ok: true;
  mark: string;
  encodings?: Record<string, string>;
  title?: string;
  finding?: string;
  issues?: string[];
}

interface FailureExpect {
  ok: false;
  errorIncludes: string;
}

interface Fixture {
  id: string;
  note: string;
  text: string;
  title?: string;
  intentText?: string;
  expect: SuccessExpect | FailureExpect;
}

const cases = JSON.parse(
  readFileSync(new URL("../fixtures/cases.json", import.meta.url), "utf8"),
) as Fixture[];

describe("public chart contract", () => {
  test("ships a fixed set of cases", () => {
    expect(cases.map((item) => item.id)).toEqual([
      "time-change",
      "multi-series-line",
      "category-bar",
      "rank",
      "distribution-without-repeats",
      "histogram",
      "boxplot",
      "diverging-bar",
      "all-negative-bar",
      "scatter",
      "mixed-units",
      "share",
      "heatmap",
      "unused-measure",
      "no-causation",
      "count",
      "unique-labels",
    ]);
  });

  for (const item of cases) {
    test(item.id, () => {
      const result = buildVisualization({
        text: item.text,
        title: item.title,
        intentText: item.intentText,
      });
      if (!item.expect.ok) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain(item.expect.errorIncludes);
        return;
      }

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.selected.mark).toBe(item.expect.mark);
      if (item.expect.encodings) expect(result.selected.encodings).toMatchObject(item.expect.encodings);
      if (item.expect.title) expect(result.title).toBe(item.expect.title);
      if (item.expect.finding) expect(result.finding).toBe(item.expect.finding);
      if (item.expect.issues) {
        expect(result.issues.map((issue) => issue.code)).toEqual(item.expect.issues);
      }
    });
  }
});
