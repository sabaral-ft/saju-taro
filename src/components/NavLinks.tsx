'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/reading?step=input', label: '정보입력', icon: '📝', hoverColor: 'hover:text-cyan-400', activeColor: 'text-cyan-400' },
  { href: '/reading?step=result', label: '사주타로', icon: '🔮', hoverColor: 'hover:text-purple-400', activeColor: 'text-purple-400' },
  { href: '/gunghap', label: '궁합', icon: '💕', hoverColor: 'hover:text-pink-400', activeColor: 'text-pink-400' },
  { href: '/daily', label: '오늘의 운세', icon: '⭐', hoverColor: 'hover:text-amber-400', activeColor: 'text-amber-400' },
  { href: '/calendar', label: '캘린더', icon: '📅', hoverColor: 'hover:text-green-400', activeColor: 'text-green-400' },
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
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 데스크톱 메뉴 */}
      <nav className="hidden md:flex items-center gap-5 text-base text-gray-400">
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

      {/* 모바일 햄버거 */}
      <button
        className="md:hidden text-2xl text-gray-400 hover:text-white transition"
        onClick={() => setOpen(!open)}
      >
        {open ? '✕' : '☰'}
      </button>

      {/* 모바일 드롭다운 */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#0d0d2b]/98 backdrop-blur-lg border-b border-purple-900/30 z-50">
          <nav className="flex flex-col py-2">
            {NAV_ITEMS.map((item) => {
              const basePath = item.href.split('?')[0];
              const isActive = pathname === basePath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-5 py-3 text-base transition-colors ${
                    isActive ? `${item.activeColor} font-bold bg-white/5` : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
