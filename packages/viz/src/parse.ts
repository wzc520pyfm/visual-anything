import type { Row } from "./types.js";

export interface ParsedTable {
  rows: Row[];
  percentColumns: string[];
}

const EMPTY = /^(null|na|n\/a|none|—|-)$/i;

export function parseTable(text: string): { ok: true; table: ParsedTable } | { ok: false; error: string } {
  const source = text.replace(/^\uFEFF/, "").trim();
  if (!source) return { ok: false, error: "没有读到数据。粘贴 CSV、JSON，或选择一份示例。" };

  if (source.startsWith("{") || source.startsWith("[")) {
    return parseJson(source);
  }

  if (!source.includes(",") && !source.includes("\n") && !source.includes("\t")) {
    return { ok: false, error: "这不像表格。请使用带表头的 CSV 或 JSON 数组。" };
  }

  return parseCsv(source);
}

function parseJson(source: string): { ok: true; table: ParsedTable } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return { ok: false, error: "JSON 无法解析。请检查括号和引号。" };
  }

  const records = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.data)
      ? value.data
      : isRecord(value) && Array.isArray(value.rows)
        ? value.rows
        : null;

  if (!records) {
    return { ok: false, error: "JSON 需要是对象数组，或包含 data / rows 数组。" };
  }

  const objects = records.filter(isRecord);
  if (objects.length === 0) return { ok: false, error: "JSON 里没有数据行。" };

  const names: string[] = [];
  for (const record of objects) {
    for (const key of Object.keys(record)) {
      if (!names.includes(key)) names.push(key);
    }
  }

  return { ok: true, table: materialize(names, objects.map((record) => names.map((name) => cellText(record[name])))) };
}

function parseCsv(source: string): { ok: true; table: ParsedTable } | { ok: false; error: string } {
  const matrix = tokenize(source).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (matrix.length < 2) return { ok: false, error: "表格至少需要表头和一行数据。" };

  const names = matrix[0].map((name) => name.trim());
  if (names.some((name) => name === "")) return { ok: false, error: "表头有空列名。" };

  return { ok: true, table: materialize(names, matrix.slice(1)) };
}

function materialize(names: string[], body: string[][]): ParsedTable {
  const percent = new Set<string>();
  const rows: Row[] = body.map((cells) => {
    const row: Row = {};
    names.forEach((name, index) => {
      const parsed = parseCell(cells[index] ?? "");
      row[name] = parsed.value;
      if (parsed.percent) percent.add(name);
    });
    return row;
  });

  return { rows, percentColumns: [...percent] };
}

function parseCell(raw: string): { value: string | number | null; percent: boolean } {
  const text = raw.trim();
  if (text === "" || EMPTY.test(text)) return { value: null, percent: false };
  if (/^-?\d+(\.\d+)?%$/.test(text)) {
    return { value: Number(text.slice(0, -1)), percent: true };
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    return { value: Number(text.replace(/,/g, "")), percent: false };
  }
  if (/^-?\d+(\.\d+)?$/.test(text)) return { value: Number(text), percent: false };
  return { value: text, percent: false };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function tokenize(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
