import type { FieldProfile, Row } from "./types";

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}[-/]\d{2}$/;
const SLASH_DATE = /^\d{4}\/\d{2}\/\d{2}$/;
const CHINESE_DATE = /^\d{4}年\d{1,2}月(\d{1,2}日)?$/;
const YEAR = /^\d{4}$/;

export function profileFields(rows: Row[], percentColumns: string[]): FieldProfile[] {
  const names = fieldNames(rows);
  return names.map((name) => profileField(name, rows, percentColumns.includes(name)));
}

export function fieldNames(rows: Row[]): string[] {
  const names: string[] = [];
  for (const row of rows) {
    for (const name of Object.keys(row)) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
}

export function isFullDate(value: unknown): boolean {
  return typeof value === "string" && FULL_DATE.test(value);
}

function profileField(name: string, rows: Row[], percent: boolean): FieldProfile {
  const values = rows.map((row) => row[name] ?? null);
  const present = values.filter((value) => value !== null);
  const missing = values.length - present.length;
  const numbers = present.filter((value): value is number => typeof value === "number");
  const asTemporal = present.length > 0 && present.every(isTemporalValue);
  const asNumber = present.length > 0 && numbers.length === present.length;

  let type: FieldProfile["type"] = "nominal";
  if (asTemporal) type = "temporal";
  else if (asNumber) type = "quantitative";

  const unique = new Set(present.map((value) => String(value))).size;
  const unit = unitFromName(name) ?? (percent && type === "quantitative" ? "%" : undefined);
  const profile: FieldProfile = {
    name,
    type,
    missing,
    unique,
    negativeCount: numbers.filter((value) => value < 0).length,
    ...(unit ? { unit } : {}),
  };

  if (type === "quantitative" && numbers.length > 0) {
    profile.min = Math.min(...numbers);
    profile.max = Math.max(...numbers);
  }

  return profile;
}

function isTemporalValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return FULL_DATE.test(value) || YEAR_MONTH.test(value) || SLASH_DATE.test(value) || CHINESE_DATE.test(value) || YEAR.test(value);
}

function unitFromName(name: string): string | undefined {
  const match = name.match(/[（(]([^()（）]+)[)）]\s*$/);
  return match?.[1];
}
