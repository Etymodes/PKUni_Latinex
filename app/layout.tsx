import type { Metadata } from "next";
import "./globals.css";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "哔丘 Pikku · 多语言学习站",
  description: "Pikku 多语言剧情、课程、练习与词汇学习平台",
  icons: { icon: `${publicBasePath}/pkuni-latinex-logo-final.png` },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
