import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const notoSerif = Noto_Serif_JP({
  variable: "--font-noto-serif",
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

const jbMono = JetBrains_Mono({
  variable: "--font-mono-jb",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shogi Edge — 将棋勝敗予想",
  description:
    "Live中継対象のプロ棋戦に絞った、データドリブン勝敗予想。レーティング・直近成績・直接対戦・戦型相性の7要素を根拠で提示します。",
  applicationName: "Shogi Edge",
  authors: [{ name: "shogi-edge" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ja"
      className={`${notoSans.variable} ${notoSerif.variable} ${jbMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-sumi-950 text-washi-100">
        {children}
      </body>
    </html>
  );
}
