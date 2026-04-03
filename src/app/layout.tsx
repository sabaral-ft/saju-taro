import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: {
    default: "BT-𝑥 사주타로 - 사주 기반 타로 해석",
    template: "%s | BT-𝑥 사주타로",
  },
  description: "만세력 기반 정밀 사주 분석 + 78장 타로 카드 오행 맞춤 해석. 생년월일시 입력 한 번으로 사주·타로를 한눈에.",
  keywords: ["사주", "타로", "운세", "궁합", "사주팔자", "오행", "만세력", "데일리타로"],
  openGraph: {
    title: "BT-𝑥 사주타로 - 사주 기반 타로 해석",
    description: "만세력 기반 정밀 사주 분석 + 78장 타로 카드 오행 맞춤 해석",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="사주타로" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Playfair+Display:ital@1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <header className="border-b border-purple-900/30 bg-[#0d0d2b]/80 backdrop-blur-sm sticky top-0 z-50 relative">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="text-xl sm:text-2xl">🔮</span>
              <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">
                BT-<span className="italic font-serif">𝑥</span> 사주타로
              </span>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-purple-900/30 py-6 text-center text-sm text-gray-500">
          <p>&copy; 2026 BT-𝑥 사주타로. 오행의 지혜로 운명을 읽다.</p>
        </footer>
      </body>
    </html>
  );
}
