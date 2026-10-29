import type { FieldProfile, Row } from "./types.js";

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
