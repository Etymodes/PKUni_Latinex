import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "比丘拟 PKUni_Latinex · 真题模拟网站",
  description: "面向北京大学拉丁语标准化考试公开范围的非官方真题制式模拟与阅读训练工具",
  icons: { icon: "/pkuni-latinex-logo-final.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
