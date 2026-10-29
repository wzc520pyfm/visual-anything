import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

const serif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Visual Anything · AntV 可视化",
  description: "把 CSV 或 JSON 表格变成可交互的 AntV G2 图表，并导出独立 HTML。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
