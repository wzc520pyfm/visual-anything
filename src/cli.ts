import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildVisualization } from "./lib/viz/pipeline";

interface CliArgs {
  input?: string;
  out?: string;
  title?: string;
  intent?: string;
}

export async function runCli(argv: string[]): Promise<number> {
  const args = readArgs(argv.slice(2));
  if (!args.input || !args.out) {
    console.error("用法: npm run viz -- --input data.csv --out chart.html [--title 标题] [--intent 看趋势]");
    return 1;
  }

  try {
    const text = readFileSync(args.input, "utf8");
    const result = buildVisualization({
      text,
      title: args.title,
      intentText: args.intent,
    });
    if (!result.ok) {
      console.error(result.error);
      return 1;
    }
    mkdirSync(path.dirname(args.out), { recursive: true });
    writeFileSync(args.out, result.html);
    console.log(result.summary);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "读取或写出文件失败。");
    return 1;
  }
}

function readArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--input") args.input = value;
    if (key === "--out") args.out = value;
    if (key === "--title") args.title = value;
    if (key === "--intent") args.intent = value;
    if (key.startsWith("--")) index += 1;
  }
  return args;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  runCli(process.argv).then((code) => {
    process.exit(code);
  });
}
