import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "妖怪ウォッチ変換 | あなただけの妖怪をつくろう",
  description: "写真から、あなただけの妖怪をつくろう。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className="h-full antialiased"
    >
      <body className="items-center min-h-full flex flex-col">
        <main className="w-full max-w-[430px] overflow-x-clip">
          {children}
        </main>
      </body>
    </html>
  );
}
