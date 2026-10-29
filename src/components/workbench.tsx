"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { AntvChart } from "@/components/antv-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLES } from "@/lib/viz/samples";
import { G2_VERSION, buildVisualization, type Mark } from "@/lib/viz/pipeline";
import type { FieldProfile, Issue } from "@/lib/viz/types";

const FIELD_LABEL: Record<FieldProfile["type"], string> = {
  quantitative: "数值",
  nominal: "类别",
  temporal: "时间",
};

export function Workbench() {
  const first = SAMPLES[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(first.text);
  const [title, setTitle] = useState(first.title);
  const [intent, setIntent] = useState(first.intentText ?? "");
  const [mark, setMark] = useState<Mark | undefined>(undefined);
  const [activeSample, setActiveSample] = useState<string | null>(first.id);
  const [fileMessage, setFileMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const deferredText = useDeferredValue(text);

  const result = useMemo(
    () =>
      buildVisualization({
        text: deferredText,
        title,
        intentText: intent,
        mark,
      }),
    [deferredText, title, intent, mark],
  );
  const pending = text !== deferredText;

  function applySample(id: string) {
    const sample = SAMPLES.find((item) => item.id === id);
    if (!sample) return;
    setActiveSample(sample.id);
    setText(sample.text);
    setTitle(sample.title);
    setIntent(sample.intentText ?? "");
    setMark(undefined);
    setFileMessage("");
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setFileMessage("文件超过 2MB。请先截取需要可视化的表格。");
      return;
    }
    file.text().then((content) => {
      setText(content);
      setTitle(file.name.replace(/\.(csv|json|tsv|txt)$/i, ""));
      setIntent("");
      setMark(undefined);
      setActiveSample(null);
      setFileMessage(file.name);
    });
  }

  function download() {
    if (!result.ok) return;
    const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.title}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copySpec() {
    if (!result.ok) return;
    await navigator.clipboard.writeText(JSON.stringify(result.spec, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-border/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.18em] text-primary">ANTV G2 · V1</p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight">万象</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              把表格整理成可交互图表。先看字段和时间，再决定柱状、折线、散点或热力，并标出不该下的结论。
            </p>
          </div>
          <Badge variant="outline">AntV G2 {G2_VERSION}</Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
        <section className="order-3 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>数据</CardTitle>
              <CardDescription>粘贴带表头的 CSV 或 JSON，也可以从示例开始。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {SAMPLES.map((sample) => (
                  <Button
                    key={sample.id}
                    type="button"
                    size="sm"
                    variant={activeSample === sample.id ? "default" : "outline"}
                    aria-pressed={activeSample === sample.id}
                    onClick={() => applySample(sample.id)}
                  >
                    {sample.title}
                  </Button>
                ))}
              </div>
              {activeSample ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {SAMPLES.find((sample) => sample.id === activeSample)?.description}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                  上传文件
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json,.tsv,text/csv,application/json"
                  className="sr-only"
                  onChange={(event) => onFile(event.target.files?.[0])}
                />
                {fileMessage ? <p className="text-xs text-muted-foreground">{fileMessage}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="data-text">表格</Label>
                <Textarea
                  id="data-text"
                  value={text}
                  spellCheck={false}
                  className="min-h-56 font-mono text-xs"
                  placeholder={"品类,销售额\n咖啡,120\n茶饮,80"}
                  onChange={(event) => {
                    setText(event.target.value);
                    setMark(undefined);
                    setActiveSample(null);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="chart-title">标题</Label>
                <Input
                  id="chart-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="chart-intent">你想看什么</Label>
                <Input
                  id="chart-intent"
                  value={intent}
                  placeholder="例如：看趋势、看渠道占比"
                  onChange={(event) => {
                    setIntent(event.target.value);
                    setMark(undefined);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="order-1 lg:order-2" aria-busy={pending}>
          <Card className={pending ? "opacity-80" : undefined}>
            <CardHeader>
              <CardTitle>{result.ok ? result.title : "这张图还不能画"}</CardTitle>
              <CardDescription id="chart-summary">
                {result.ok ? result.summary : result.error}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {result.ok ? (
                <div role="img" aria-describedby="chart-summary" aria-label={result.alt}>
                  <AntvChart spec={result.spec} />
                </div>
              ) : (
                <div className="flex h-[340px] flex-col items-start justify-center gap-2 rounded-xl bg-muted/60 px-6 sm:h-[480px]">
                  <p className="font-heading text-2xl">换一份表格</p>
                  <p className="max-w-md text-sm leading-6 text-muted-foreground">
                    需要至少一列数值。类别用来比较，时间用来看变化。关系图和信息图还没接上，这一版只画统计图。
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={download} disabled={!result.ok}>
                  下载 HTML
                </Button>
                <Button type="button" variant="outline" onClick={copySpec} disabled={!result.ok}>
                  {copied ? "已复制规格" : "复制 G2 规格"}
                </Button>
              </div>
              {result.ok ? <DataPreview rows={result.rows} /> : null}
            </CardContent>
          </Card>
        </section>

        <section className="order-2 lg:order-3">
          <Card>
            <CardHeader>
              <CardTitle>判断</CardTitle>
              <CardDescription>推荐来自字段类型，不来自模型临场发挥。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {result.ok ? (
                <ul className="flex flex-col gap-2">
                  {result.advices.map((advice) => {
                    const current = advice.mark === result.selected.mark;
                    const recommended = advice.mark === result.advices[0].mark;
                    return (
                      <li key={advice.id}>
                        <button
                          type="button"
                          aria-pressed={current}
                          onClick={() => setMark(advice.mark)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                            current
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium">{advice.title}</span>
                            {recommended ? (
                              <Badge variant="secondary">推荐</Badge>
                            ) : current ? (
                              <Badge variant="outline">当前</Badge>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {advice.reason}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">读入可用表格后，这里会列出能画的图。</p>
              )}

              <Separator />

              <div>
                <h2 className="mb-2 text-sm font-medium">字段</h2>
                {result.fields && result.fields.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {result.fields.map((field) => (
                      <li key={field.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{field.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {FIELD_LABEL[field.type]}
                          {field.unit ? ` · ${field.unit}` : ""}
                          {field.missing > 0 ? ` · 空 ${field.missing}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">还没有识别到字段。</p>
                )}
              </div>

              <Separator />

              <div>
                <h2 className="mb-2 text-sm font-medium">检查</h2>
                <IssueList issues={result.issues} />
              </div>

              <p className="text-xs leading-5 text-muted-foreground">
                这一版的引擎是 AntV G2。ECharts 和其他引擎留到 v2，不在这里切换。
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function DataPreview({ rows }: { rows: Record<string, string | number | null>[] }) {
  const columns = Object.keys(rows[0] ?? {});
  const preview = rows.slice(0, 8);
  if (columns.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted-foreground">
          数据预览，显示前 {preview.length} 行，共 {rows.length} 行。
        </caption>
        <thead>
          <tr className="border-b">
            {columns.map((column) => (
              <th key={column} className="px-2 py-1.5 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, index) => (
            <tr key={index} className="border-b border-border/70">
              {columns.map((column) => (
                <td key={column} className="px-2 py-1.5 text-muted-foreground">
                  {row[column] === null || row[column] === undefined ? "—" : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">没有发现空值、单位混用或超出范围的图形。</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue) => (
        <li
          key={`${issue.code}-${issue.message}`}
          className={`text-sm leading-6 ${
            issue.level === "error"
              ? "text-destructive"
              : issue.level === "warning"
                ? "text-amber-800"
                : "text-muted-foreground"
          }`}
        >
          {issue.message}
        </li>
      ))}
    </ul>
  );
}
