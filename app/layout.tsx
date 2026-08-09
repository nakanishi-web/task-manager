import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AuthStatus from "./components/AuthStatus";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaskFlow | タスク管理アプリ",
  description: "シンプルで効率的なタスク管理アプリ。Next.js × Tailwind CSS で構築。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-blue-50 font-sans">
        {/* ヘッダー */}
        <header className="w-full bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          {/* ロゴ */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xl">✓</span>
            </div>
            <span className="text-2xl font-bold text-blue-700 tracking-wide">
              TaskFlow
            </span>
          </div>

          {/* ナビゲーション */}
          <nav className="flex gap-6 text-gray-600 font-medium tracking-wide items-center">
            <Link href="/" className="hover:text-blue-600 transition">
              ホーム
            </Link>
            <Link href="/features" className="hover:text-blue-600 transition">
              機能
            </Link>
            <Link href="/contact" className="hover:text-blue-600 transition">
              お問い合わせ
            </Link>
            <div className="ml-4">
              <AuthStatus />
            </div>
          </nav>
        </header>

        {/* ページコンテンツ */}
        <main className="flex flex-col items-center justify-center px-6 py-12 flex-1">
          {children}
        </main>

        {/* フッター */}
        <footer className="w-full bg-white shadow-inner px-6 py-4 text-center text-gray-600 font-medium tracking-wide">
          © 2026 TaskFlow — All Rights Reserved
        </footer>
      </body>
    </html>
  );
}
