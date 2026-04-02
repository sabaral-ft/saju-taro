'use client';

import type { SajuResult } from '@/lib/saju-engine';
import type { DaeunResult, SeunResult } from '@/lib/daeun';
import { OHAENG_COLOR } from '@/lib/saju-engine';
import type { Ohaeng } from '@/lib/saju-engine';
import type { SamjaeResult } from '@/lib/sinsal';

type ResultSection = 'menu' | 'saju' | 'newyear' | 'daeun' | 'fiveyear' | 'samjae' | 'timeline' | 'career' | 'love' | 'wealth' | 'health' | 'relation' | 'isa' | 'tarot' | 'qna';

interface ResultMenuProps {
  sajuResult: SajuResult;
  daeunResult: DaeunResult | null;
  fiveYearSeun: SeunResult[];
  samjaeResult: SamjaeResult | null;
  setActiveSection: (s: ResultSection) => void;
}

/** 오행 한글→이모지 */
const OHAENG_EMOJI: Record<string, string> = {
  '목': '🌳', '화': '🔥', '토': '🏔️', '금': '⚙️', '수': '💧',
};

export function ResultMenu({ sajuResult, daeunResult, fiveYearSeun, samjaeResult, setActiveSection }: ResultMenuProps) {
  const currentAge = daeunResult?.currentAge || 30;
  const currentYear = new Date().getFullYear();
  const thisYearSeun = fiveYearSeun.find(s => s.year === currentYear);

  return (
    <div className="space-y-5">

      {/* ===== 핵심 미리보기 카드 4개 ===== */}
      <div className="grid grid-cols-2 gap-3">

        {/* 1. 사주 핵심 요약 */}
        <button
          onClick={() => setActiveSection('saju')}
          className="bg-gradient-to-br from-purple-900/60 to-indigo-900/40 rounded-2xl p-4 border border-purple-500/40 hover:border-purple-400 transition-all text-left hover:scale-[1.02]"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔮</span>
            <span className="text-sm font-bold text-purple-300">내 사주팔자</span>
          </div>
          <div className="flex gap-1.5 mb-2">
            {[sajuResult.year, sajuResult.month, sajuResult.day, sajuResult.hour].map((p, i) => (
              <div key={i} className="text-center">
                <div className="text-base font-bold" style={{ color: OHAENG_COLOR[p.cheonganOhaeng as Ohaeng] }}>{p.cheongan}</div>
                <div className="text-base font-bold" style={{ color: OHAENG_COLOR[p.jijiOhaeng as Ohaeng] }}>{p.jiji}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400">
            {sajuResult.ilgan}일간 · {sajuResult.animal}띠 · 용신 {OHAENG_EMOJI[sajuResult.yongsin]}{sajuResult.yongsin}
          </div>
          <div className="text-[10px] text-purple-400 mt-1">터치하여 상세 보기 →</div>
        </button>

        {/* 2. 올해 운세 미리보기 */}
        <button
          onClick={() => setActiveSection('newyear')}
          className="bg-gradient-to-br from-amber-900/50 to-orange-900/30 rounded-2xl p-4 border border-amber-500/40 hover:border-amber-400 transition-all text-left hover:scale-[1.02]"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎍</span>
            <span className="text-sm font-bold text-amber-300">{currentYear}년 운세</span>
          </div>
          {thisYearSeun ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="text-2xl font-black text-amber-400">{thisYearSeun.overallScore}</div>
                <div className="text-xs text-gray-400">/10점</div>
                <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${thisYearSeun.overallScore * 10}%`,
                      backgroundColor: thisYearSeun.overallScore >= 7 ? '#22c55e' : thisYearSeun.overallScore >= 4 ? '#eab308' : '#ef4444',
                    }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-400">{thisYearSeun.animal}의 해 · 12운성: {thisYearSeun.twelveStage}</div>
            </>
          ) : (
            <div className="text-xs text-gray-500">올해 종합운세 + 월별 운세</div>
          )}
          <div className="text-[10px] text-amber-400 mt-1">터치하여 상세 보기 →</div>
        </button>

        {/* 3. 현재 대운 미리보기 */}
        <button
          onClick={() => setActiveSection('daeun')}
          className="bg-gradient-to-br from-blue-900/50 to-cyan-900/30 rounded-2xl p-4 border border-blue-500/40 hover:border-blue-400 transition-all text-left hover:scale-[1.02]"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌊</span>
            <span className="text-sm font-bold text-blue-300">현재 대운</span>
          </div>
          {daeunResult?.currentDaeun ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-bold text-white">
                  {daeunResult.currentDaeun.cheongan}{daeunResult.currentDaeun.jiji}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 rounded-full text-blue-300">
                  {daeunResult.currentDaeun.startAge}~{daeunResult.currentDaeun.endAge}세
                </span>
              </div>
              <div className="text-xs text-gray-400">
                12운성: {daeunResult.currentDaeun.twelveStage} · {daeunResult.currentDaeun.bangSeason}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500">10년 단위 인생의 큰 흐름</div>
          )}
          <div className="text-[10px] text-blue-400 mt-1">터치하여 상세 보기 →</div>
        </button>

        {/* 4. 5년 세운 미리보기 */}
        <button
          onClick={() => setActiveSection('fiveyear')}
          className="bg-gradient-to-br from-green-900/50 to-emerald-900/30 rounded-2xl p-4 border border-green-500/40 hover:border-green-400 transition-all text-left hover:scale-[1.02]"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📅</span>
            <span className="text-sm font-bold text-green-300">5년 세운</span>
          </div>
          {fiveYearSeun.length > 0 ? (
            <div className="flex gap-1">
              {fiveYearSeun.slice(0, 5).map(s => (
                <div key={s.year} className="flex-1 text-center">
                  <div className="text-[10px] text-gray-500">{String(s.year).slice(2)}</div>
                  <div
                    className="mx-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{
                      backgroundColor: s.overallScore >= 7 ? '#22c55e' : s.overallScore >= 4 ? '#eab308' : '#ef4444',
                    }}
                  >
                    {s.overallScore}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">{currentYear}~{currentYear + 4}년 운세</div>
          )}
          <div className="text-[10px] text-green-400 mt-1">터치하여 상세 보기 →</div>
        </button>
      </div>

      {/* ===== 나머지 카테고리 메뉴 ===== */}
      <div className="bg-[#1e1e3f]/50 rounded-2xl p-4 border border-white/5">
        <p className="text-xs text-gray-500 mb-3 text-center">더 알아보기</p>

        {/* ★ 인생 타임라인 — 한줄 전체 너비, 크게 강조 */}
        <button
          onClick={() => setActiveSection('timeline' as ResultSection)}
          className="w-full bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-indigo-900/40 rounded-xl p-4 border border-indigo-500/40 hover:border-indigo-400/70 transition-all hover:scale-[1.02] flex items-center gap-4 mb-3 shadow-lg shadow-indigo-900/20"
        >
          <span className="text-3xl">⏳</span>
          <div className="flex-1">
            <span className="text-base font-bold text-indigo-200">나의 인생 타임라인</span>
            <p className="text-[11px] text-indigo-400/80 mt-0.5">대운으로 보는 10년 단위 인생 흐름 · 직업 · 재물 · 건강</p>
          </div>
          <span className="text-indigo-400 text-lg">→</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'career', icon: '💼', title: '직업운 · 적성', titleClass: 'text-cyan-300', borderClass: 'border-cyan-900/30 hover:border-cyan-500/50' },
            {
              key: 'love', icon: '💕',
              title: sajuResult.relationship === 'married' ? '부부운 · 가정운' : currentAge < 20 ? '친구 · 학교생활' : sajuResult.relationship === 'dating' ? '애정운 · 연애운' : '결혼운 · 애정운',
              titleClass: 'text-pink-300', borderClass: 'border-pink-900/30 hover:border-pink-500/50',
            },
            {
              key: 'wealth', icon: '💰',
              title: currentAge < 20 ? '재능 · 미래 진로' : '재물운 · 돈 관리',
              titleClass: 'text-yellow-300', borderClass: 'border-yellow-900/30 hover:border-yellow-500/50',
            },
            { key: 'health', icon: '🏥', title: '건강운 · 체질', titleClass: 'text-green-300', borderClass: 'border-green-900/30 hover:border-green-500/50' },
            { key: 'relation', icon: '🤝', title: '대인관계', titleClass: 'text-teal-300', borderClass: 'border-teal-900/30 hover:border-teal-500/50' },
            {
              key: 'samjae', icon: samjaeResult?.current.active ? '🔥' : '🛡️',
              title: samjaeResult?.current.active ? `삼재 (${samjaeResult.current.type})` : '삼재 확인',
              titleClass: samjaeResult?.current.active ? 'text-red-300' : 'text-orange-300',
              borderClass: samjaeResult?.current.active ? 'border-red-900/30 hover:border-red-500/50' : 'border-orange-900/30 hover:border-orange-500/50',
            },
            { key: 'isa', icon: '🏠', title: '이사운', titleClass: 'text-emerald-300', borderClass: 'border-emerald-900/30 hover:border-emerald-500/50' },
            { key: 'tarot', icon: '🃏', title: '타로 카드', titleClass: 'text-violet-300', borderClass: 'border-violet-900/30 hover:border-violet-500/50' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key as ResultSection)}
              className={`bg-[#1e1e3f] rounded-xl p-3 border transition-all text-left hover:scale-[1.02] flex items-center gap-3 ${item.borderClass}`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`text-sm font-bold ${item.titleClass}`}>{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
