import { G2_VERSION, type G2Spec, type Issue } from "./types.js";

export function renderHtml(input: {
  title: string;
  summary: string;
  finding: string;
  alt: string;
  spec: G2Spec;
  issues: Issue[];
}): string {
  const specJson = JSON.stringify(input.spec).replace(/</g, "\\u003c");
  const issueList =
    input.issues.length === 0
      ? ""
      : `<ul>${input.issues
          .map((issue) => `<li>${escapeHtml(issue.message)}</li>`)
          .join("")}</ul>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; background: #f3eee6; color: #1f1a17; font-family: "PingFang SC", "Noto Sans SC", "Source Han Sans SC", sans-serif; }
    main { max-width: 980px; margin: 0 auto; padding: 36px 20px 56px; }
    .kicker { margin: 0 0 8px; color: #0f6e56; font-size: 13px; letter-spacing: 0.08em; }
    h1 { margin: 0 0 8px; font-family: "Iowan Old Style", "Songti SC", "Noto Serif SC", serif; font-size: 32px; font-weight: 560; letter-spacing: -0.03em; }
    p { margin: 0 0 18px; line-height: 1.6; color: #44403c; }
    #chart { height: 520px; background: #fffdf9; border: 1px solid #e4d9c8; border-radius: 18px; }
    ul { margin: 18px 0 0; padding-left: 18px; color: #57534e; }
    li { margin: 6px 0; }
  </style>
</head>
<body>
  <main>
    <p class="kicker">Visual Anything · ANTV G2 ${G2_VERSION}</p>
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(input.summary)}</p>
    <p class="finding">${escapeHtml(input.finding)}</p>
    <div id="chart" role="img" aria-label="${escapeHtml(input.alt)}"></div>
    ${issueList}
  </main>
  <script type="module">
    import { Chart } from "https://esm.sh/@antv/g2@${G2_VERSION}";
    const spec = ${specJson};
    const chart = new Chart({ container: "chart", autoFit: true });
    chart.options(spec);
    await chart.render();
  </script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
