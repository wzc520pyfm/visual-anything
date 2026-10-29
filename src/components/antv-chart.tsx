"use client";

import { useEffect, useRef, useState } from "react";
import type { G2Spec } from "visual-anything";

export function AntvChart({ spec }: { spec: G2Spec }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let chart: { destroy: () => void } | null = null;
    setStatus("loading");
    setMessage("");

    import("@antv/g2")
      .then(async ({ Chart }) => {
        if (disposed) return;
        host.replaceChildren();
        const next = new Chart({ container: host, autoFit: true });
        chart = next;
        (next.options as (value: G2Spec) => void)(spec);
        await next.render();
        if (disposed) {
          next.destroy();
          return;
        }
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "图表渲染失败");
      });

    return () => {
      disposed = true;
      chart?.destroy();
    };
  }, [spec]);

  return (
    <div className="relative h-[340px] sm:h-[480px]">
      <div ref={hostRef} className="h-full w-full" />
      {status === "loading" ? (
        <p className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm text-muted-foreground">
          正在绘制…
        </p>
      ) : null}
      {status === "error" ? (
        <p
          role="alert"
          className="absolute inset-x-4 bottom-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          图表没有画出来。{message}
        </p>
      ) : null}
    </div>
  );
}
