import type { SeunResult } from '@/lib/daeun';
import type { SamjaeResult } from '@/lib/sinsal';

/** 텍스트 블록의 줄을 파싱하여 섹션별로 나눠주는 헬퍼 */
function parseTextBlock(text: string): { lines: string[] } {
  if (!text) return { lines: [] };
  return { lines: text.split('\n').filter(l => l.trim()) };
}

/** 월별 하이라이트 텍스트에서 월별 데이터 추출 */
function parseMonthlyData(text: string): {
  months: { month: number; ganji: string; sipseong: string; level: string; score: string; tip: string }[];
  bestMonths: string[];
  worstMonths: string[];
  halfYearNote: string;
} {
  const months: { month: number; ganji: string; sipseong: string; level: string; score: string; tip: string }[] = [];
  const bestMonths: string[] = [];
  const worstMonths: string[] = [];
  let halfYearNote = '';
  let section: 'calendar' | 'best' | 'worst' | 'half' | '' = '';

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.includes('📅 월별 흐름')) { section = 'calendar'; continue; }
    if (trimmed.includes('🏆 최고의 달')) { section = 'best'; continue; }
    if (trimmed.includes('⚠️ 주의할 달')) { section = 'worst'; continue; }
    if (trimmed.includes('📈') || trimmed.includes('📊')) { halfYearNote = trimmed; continue; }

    if (section === 'calendar') {
      const m = trimmed.match(/^(\d+)월\s+(\S{2})\((\S+)\)\s+(🟢|🟡|🔴)([\d.]+)점\s*—\s*(.+)/);
      if (m) {
        months.push({ month: parseInt(m[1]), ganji: m[2], sipseong: m[3], level: m[4], score: m[5], tip: m[6] });
      }
    } else if (section === 'best' && trimmed) {
      bestMonths.push(trimmed);
    } else if (section === 'worst' && trimmed) {
      worstMonths.push(trimmed);
    }
  }
  return { months, bestMonths, worstMonths, halfYearNote };
}

/** 오행 밸런스 텍스트에서 바차트 데이터 추출 */
function parseBalanceData(text: string): {
  bars: { name: string; oh: string; value: number; incoming: boolean }[];
  notes: string[];
} {
  const bars: { name: string; oh: string; value: number; incoming: boolean }[] = [];
  const notes: string[] = [];
  const OHAENG_MAP: Record<string, string> = { '목': '木', '화': '火', '토': '土', '금': '金', '수': '水' };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    // 바차트 줄: 화(火): ██ 2.6
    const barMatch = trimmed.match(/^(.+?)\((.)\):\s*█*\s*([\d.]+)(.*)/);
    if (barMatch) {
      bars.push({
        name: barMatch[1],
        oh: barMatch[2],
        value: parseFloat(barMatch[3]),
        incoming: barMatch[4]?.includes('⬆') || false,
      });
      continue;
    }
    // 분석 노트
    if (trimmed.startsWith('✅') || trimmed.startsWith('⚠️') || trimmed.startsWith('💎') || trimmed.startsWith('🚨') || trimmed.startsWith('📈') || trimmed.startsWith('📊')) {
      notes.push(trimmed);
    }
  }
  return { bars, notes };
}

/** 행운 정보 텍스트에서 항목 추출 */
function parseLuckyInfo(text: string): { items: { icon: string; label: string; value: string }[]; gaeun: string } {
  const items: { icon: string; label: string; value: string }[] = [];
  let gaeun = '';
  const iconMap: Record<string, string> = {
    '🎨': '행운의 색상', '🧭': '행운의 방위', '🔢': '행운의 숫자',
    '✨': '개운 활동', '🍽️': '행운의 음식', '👔': '행운의 패션',
    '✈️': '행운의 여행', '🏥': '건강 포인트',
  };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('💡') || trimmed.startsWith('📌')) {
      gaeun += (gaeun ? '\n' : '') + trimmed;
      continue;
    }
    for (const [icon, label] of Object.entries(iconMap)) {
      if (trimmed.startsWith(icon)) {
        const value = trimmed.replace(new RegExp(`^${icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*${label}:\\s*`), '').trim();
        items.push({ icon, label, value: value || trimmed.split(': ').slice(1).join(': ').trim() });
        break;
      }
    }
  }
  return { items, gaeun };
}

export function NewYearReading({ seunList, samjaeResult }: { seunList: SeunResult[]; samjaeResult?: SamjaeResult | null }) {
  const currentYear = new Date().getFullYear();
  const thisYearSeun = seunList.find(s => s.year === currentYear) || seunList[0];
  if (!thisYearSeun) return null;

  const monthData = thisYearSeun.monthlyHighlights ? parseMonthlyData(thisYearSeun.monthlyHighlights) : null;
  const balanceData = thisYearSeun.balanceAnalysis ? parseBalanceData(thisYearSeun.balanceAnalysis) : null;
  const luckyData = thisYearSeun.luckyInfo ? parseLuckyInfo(thisYearSeun.luckyInfo) : null;
  const jijangganLines = thisYearSeun.jijangganAnalysis ? parseTextBlock(thisYearSeun.jijangganAnalysis) : null;

  // 점수별 컬러
  const scoreColor = thisYearSeun.overallScore >= 7 ? 'text-amber-400' : thisYearSeun.overallScore >= 5 ? 'text-yellow-500' : thisYearSeun.overallScore >= 3 ? 'text-orange-400' : 'text-red-400';
  const stars = Math.max(1, Math.min(5, Math.round(thisYearSeun.overallScore / 2)));

  // 띠별 이모지
  const animalEmoji: Record<string, string> = {
    '쥐': '🐭', '소': '🐮', '호랑이': '🐯', '토끼': '🐰', '용': '🐲', '뱀': '🐍',
    '말': '🐴', '양': '🐑', '원숭이': '🐵', '닭': '🐔', '개': '🐶', '돼지': '🐷',
  };
  const emoji = animalEmoji[thisYearSeun.animal] || '🐅';

  return (
    <div className="space-y-6">
      {/* ─── 헤더 ─── */}
      <div className="bg-white/5 p-6 md:p-8 rounded-2xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 text-9xl opacity-10">{emoji}</div>

        <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">
          🎆 {thisYearSeun.year}년 ({thisYearSeun.cheongan}{thisYearSeun.jiji}년) 신년운세 종합 리포트
        </h2>

        {/* 종합 점수 배지 */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-3xl font-black ${scoreColor}`}>
            {thisYearSeun.overallScore}/10
          </div>
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-xl ${i < stars ? scoreColor : 'text-gray-700'}`}>★</span>
            ))}
          </div>
          <div className="text-sm text-gray-400">
            {thisYearSeun.twelveStage} · {thisYearSeun.sipseong || ''} · {thisYearSeun.animal}띠해
          </div>
        </div>

        {/* 삼재 경고 배너 */}
        {samjaeResult?.current.active && (
          <div className={`mb-4 p-4 rounded-xl border ${
            samjaeResult.current.type === '눌삼재' ? 'bg-red-900/30 border-red-500/40' :
            samjaeResult.current.type === '들삼재' ? 'bg-orange-900/30 border-orange-500/40' :
            'bg-yellow-900/30 border-yellow-500/40'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{samjaeResult.current.emoji}</span>
              <span className="text-sm font-bold text-red-300">
                올해는 {samjaeResult.current.type}에 해당합니다
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">큰 변화보다는 현상 유지에 집중하고, 건강과 재물 관리에 신경 쓰세요</p>
          </div>
        )}

        {/* 종합 설명 */}
        <div className="p-5 bg-black/30 rounded-xl backdrop-blur-sm border border-white/5 shadow-inner">
          <p className="text-gray-200 leading-relaxed text-lg whitespace-pre-wrap">
            {thisYearSeun.description}
          </p>
        </div>
      </div>

      {/* ─── 4대 분야 운세 ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-green-900/10 border border-green-500/20 transform transition-all hover:scale-[1.02]">
          <h3 className="font-bold text-green-400 mb-3 flex items-center gap-2"><span className="text-xl">💰</span> 재물운
            {thisYearSeun.areaScores && <span className="ml-auto text-xs text-gray-500">{thisYearSeun.areaScores.money}/10</span>}
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">{thisYearSeun.money}</p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-900/10 border border-blue-500/20 transform transition-all hover:scale-[1.02]">
          <h3 className="font-bold text-blue-400 mb-3 flex items-center gap-2"><span className="text-xl">💼</span> 직업 및 학업운
            {thisYearSeun.areaScores && <span className="ml-auto text-xs text-gray-500">{thisYearSeun.areaScores.career}/10</span>}
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">{thisYearSeun.career}</p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-900/10 border border-pink-500/20 transform transition-all hover:scale-[1.02]">
          <h3 className="font-bold text-pink-400 mb-3 flex items-center gap-2"><span className="text-xl">❤️</span> 애정 및 대인운
            {thisYearSeun.areaScores && <span className="ml-auto text-xs text-gray-500">{thisYearSeun.areaScores.love}/10</span>}
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">{thisYearSeun.love}</p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/20 transform transition-all hover:scale-[1.02]">
          <h3 className="font-bold text-purple-400 mb-3 flex items-center gap-2"><span className="text-xl">💪</span> 건강운
            {thisYearSeun.areaScores && <span className="ml-auto text-xs text-gray-500">{thisYearSeun.areaScores.health}/10</span>}
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">{thisYearSeun.health}</p>
        </div>
      </div>

      {/* ─── 오행 밸런스 변화 ─── */}
      {balanceData && balanceData.bars.length > 0 && (
        <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-cyan-400">
            📊 올해 오행 밸런스 변화
          </h3>
          <div className="space-y-3 mb-4">
            {balanceData.bars.map(bar => {
              const maxVal = Math.max(...balanceData.bars.map(b => b.value), 1);
              const pct = Math.max(4, Math.round((bar.value / maxVal) * 100));
              const ohDef = { bg: 'bg-gray-500', gradient: 'from-gray-400 to-gray-600', text: 'text-gray-400', emoji: '⚪', label: bar.oh };
              const ohStyles: Record<string, { bg: string; gradient: string; text: string; emoji: string; label: string }> = {
                '木': { bg: 'bg-green-500', gradient: 'from-green-400 to-emerald-600', text: 'text-green-400', emoji: '🌿', label: '목(木)' },
                '목': { bg: 'bg-green-500', gradient: 'from-green-400 to-emerald-600', text: 'text-green-400', emoji: '🌿', label: '목(木)' },
                '火': { bg: 'bg-red-500', gradient: 'from-orange-400 to-red-600', text: 'text-red-400', emoji: '🔥', label: '화(火)' },
                '화': { bg: 'bg-red-500', gradient: 'from-orange-400 to-red-600', text: 'text-red-400', emoji: '🔥', label: '화(火)' },
                '土': { bg: 'bg-yellow-600', gradient: 'from-yellow-400 to-amber-700', text: 'text-yellow-400', emoji: '🏔️', label: '토(土)' },
                '토': { bg: 'bg-yellow-600', gradient: 'from-yellow-400 to-amber-700', text: 'text-yellow-400', emoji: '🏔️', label: '토(土)' },
                '金': { bg: 'bg-gray-300', gradient: 'from-gray-200 to-slate-400', text: 'text-gray-300', emoji: '⚔️', label: '금(金)' },
                '금': { bg: 'bg-gray-300', gradient: 'from-gray-200 to-slate-400', text: 'text-gray-300', emoji: '⚔️', label: '금(金)' },
                '水': { bg: 'bg-blue-500', gradient: 'from-cyan-400 to-blue-600', text: 'text-blue-400', emoji: '💧', label: '수(水)' },
                '수': { bg: 'bg-blue-500', gradient: 'from-cyan-400 to-blue-600', text: 'text-blue-400', emoji: '💧', label: '수(水)' },
              };
              const style = ohStyles[bar.oh] || ohDef;
              return (
                <div key={bar.oh} className="flex items-center gap-3">
                  <span className={`text-sm w-16 shrink-0 font-medium ${style.text} flex items-center gap-1`}>
                    <span>{style.emoji}</span>{style.label}
                  </span>
                  <div className="flex-1 h-6 bg-black/40 rounded-full overflow-hidden relative border border-white/5">
                    <div
                      className={`h-full bg-gradient-to-r ${style.gradient} rounded-full transition-all shadow-lg`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold w-10 text-right ${style.text}`}>{bar.value}</span>
                  {bar.incoming && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                      ⬆유입
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {balanceData.notes.length > 0 && (
            <div className="space-y-2 mt-4 p-4 bg-black/20 rounded-xl border border-white/5">
              {balanceData.notes.map((note, i) => {
                const isPositive = note.startsWith('✅') || note.startsWith('💎');
                const isNegative = note.startsWith('⚠️') || note.startsWith('🚨');
                const noteColor = isPositive ? 'text-green-300' : isNegative ? 'text-orange-300' : 'text-gray-300';
                return (
                  <p key={i} className={`text-sm leading-relaxed ${noteColor}`}>{note}</p>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── 월별 운세 하이라이트 ─── */}
      {monthData && monthData.months.length > 0 && (
        <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-400">
            📅 {thisYearSeun.year}년 월별 운세 흐름
          </h3>

          {/* 12개월 그리드 */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-5">
            {monthData.months.map(m => {
              const sc = parseFloat(m.score);
              const bg = sc >= 7 ? 'bg-green-900/40 border-green-500/30' :
                         sc >= 5 ? 'bg-yellow-900/30 border-yellow-500/20' :
                         'bg-red-900/30 border-red-500/20';
              const textColor = sc >= 7 ? 'text-green-400' : sc >= 5 ? 'text-yellow-400' : 'text-red-400';
              return (
                <div key={m.month} className={`p-2 rounded-lg border text-center ${bg}`}>
                  <div className="text-xs text-gray-500">{m.month}월</div>
                  <div className="text-sm font-bold text-gray-200">{m.ganji}</div>
                  <div className={`text-xs font-bold ${textColor}`}>{m.level}{m.score}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.sipseong}</div>
                  <div className="text-xs text-gray-600">{m.tip}</div>
                </div>
              );
            })}
          </div>

          {/* 최고의 달 / 주의할 달 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {monthData.bestMonths.length > 0 && (
              <div className="p-3 rounded-xl bg-green-900/20 border border-green-500/20">
                <h4 className="text-sm font-bold text-green-400 mb-2">🏆 최고의 달</h4>
                {monthData.bestMonths.map((line, i) => (
                  <p key={i} className="text-xs text-gray-300 leading-relaxed mb-1">{line}</p>
                ))}
              </div>
            )}
            {monthData.worstMonths.length > 0 && (
              <div className="p-3 rounded-xl bg-red-900/20 border border-red-500/20">
                <h4 className="text-sm font-bold text-red-400 mb-2">⚠️ 주의할 달</h4>
                {monthData.worstMonths.map((line, i) => (
                  <p key={i} className="text-xs text-gray-300 leading-relaxed mb-1">{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* 상하반기 비교 */}
          {monthData.halfYearNote && (
            <p className="text-sm text-gray-400 mt-2">{monthData.halfYearNote}</p>
          )}
        </div>
      )}

      {/* ─── 대운-세운 교차 분석 ─── */}
      {thisYearSeun.daeunCross && (
        <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-400">
            🔄 대운-세운 교차 분석
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              thisYearSeun.daeunCross.daeunBase === '길운' ? 'bg-green-900/40 text-green-400' :
              thisYearSeun.daeunCross.daeunBase === '흉운' ? 'bg-red-900/40 text-red-400' :
              'bg-gray-800 text-gray-400'
            }`}>
              대운 기조: {thisYearSeun.daeunCross.daeunBase}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              thisYearSeun.daeunCross.crossScore > 0 ? 'bg-green-900/40 text-green-400' :
              thisYearSeun.daeunCross.crossScore < 0 ? 'bg-red-900/40 text-red-400' :
              'bg-gray-800 text-gray-400'
            }`}>
              교차 보정: {thisYearSeun.daeunCross.crossScore > 0 ? '+' : ''}{thisYearSeun.daeunCross.crossScore}점
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mb-3">{thisYearSeun.daeunCross.daeunSeunRelation}</p>
          {thisYearSeun.daeunCross.crossNotes.length > 0 && (
            <div className="space-y-2">
              {thisYearSeun.daeunCross.crossNotes.map((note, i) => (
                <p key={i} className="text-xs text-gray-400 leading-relaxed">{note}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 지장간(숨겨진 기운) 분석 ─── */}
      {jijangganLines && jijangganLines.lines.length > 0 && (
        <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-teal-400">
            🔮 지장간 — 올해 숨겨진 기운 분석
          </h3>
          <div className="space-y-1">
            {jijangganLines.lines.map((line, i) => {
              const isTitle = line.includes('【') || line.includes('지지 속');
              const isSummary = line.startsWith('💎') || line.startsWith('⚠️') || line.startsWith('⚖️') || line.startsWith('🔵');
              if (isTitle && i === 0) return null; // 제목은 이미 h3에 표시
              return (
                <p key={i} className={`leading-relaxed ${
                  isSummary ? 'text-sm text-gray-200 mt-3 p-3 bg-black/20 rounded-lg' :
                  isTitle ? 'text-sm text-gray-300 font-medium mt-2' :
                  'text-xs text-gray-400'
                }`}>
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 특수관계 (합충형파해) 상세 ─── */}
      {thisYearSeun.specialNotes && thisYearSeun.specialNotes.length > 0 && (
        <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-orange-400">
            ⚡ 올해의 특수 관계 (합·충·형·파·해)
          </h3>
          <div className="space-y-4">
            {thisYearSeun.specialNotes.filter(n => !n.startsWith('\n【🔄')).map((note, i) => {
              const isPositive = note.startsWith('🤝') || note.startsWith('🔱') || note.startsWith('🔗') || note.startsWith('📜');
              const isNegative = note.startsWith('⚠️') || note.startsWith('⚔️') || note.startsWith('💥');
              const bg = isPositive ? 'bg-green-900/15 border-green-500/15' :
                         isNegative ? 'bg-red-900/15 border-red-500/15' :
                         'bg-gray-800/30 border-gray-600/15';
              return (
                <div key={i} className={`p-4 rounded-xl border ${bg}`}>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{note}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 행운 정보 & 개운법 ─── */}
      {luckyData && luckyData.items.length > 0 && (
        <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-400">
            🍀 올해의 행운 정보 & 개운법
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {luckyData.items.map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/5 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                <div className="text-sm text-gray-300 font-medium">{item.value}</div>
              </div>
            ))}
          </div>

          {/* 개운법 */}
          {luckyData.gaeun && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-900/20 to-amber-900/20 border border-yellow-500/15">
              <h4 className="text-sm font-bold text-yellow-400 mb-2">💡 맞춤 개운법</h4>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{luckyData.gaeun}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
