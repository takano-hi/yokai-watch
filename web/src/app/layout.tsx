import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "妖怪ウォッチ変換 | あなただけの妖怪をつくろう",
  description: "写真から、あなただけの妖怪をつくろう。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
