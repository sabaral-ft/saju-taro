'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/reading?step=input', label: '정보입력란', hoverColor: 'hover:text-cyan-400', activeColor: 'text-cyan-400' },
  { href: '/reading?step=result', label: '사주타로', hoverColor: 'hover:text-purple-400', activeColor: 'text-purple-400' },
  { href: '/gunghap', label: '궁합', hoverColor: 'hover:text-pink-400', activeColor: 'text-pink-400' },
  { href: '/daily', label: '오늘의 운세', hoverColor: 'hover:text-amber-400', activeColor: 'text-amber-400' },
  { href: '/calendar', label: '캘린더', hoverColor: 'hover:text-green-400', activeColor: 'text-green-400' },
];

// 분석 완료 플래그
declare global {
  interface Window { __btx_analyzed?: boolean; }
}

export function setAnalysisCompleted(value: boolean) {
  if (typeof window !== 'undefined') {
    window.__btx_analyzed = value;
  }
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-5 text-base text-gray-400">
      {NAV_ITEMS.map((item) => {
        const basePath = item.href.split('?')[0];
        const isActive = pathname === basePath;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${item.hoverColor} transition-colors ${isActive ? `${item.activeColor} font-bold` : ''}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
