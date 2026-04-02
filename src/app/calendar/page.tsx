'use client';
import { useState, useMemo, useEffect } from 'react';
import type { SavedProfile } from '@/lib/storage';
import { getLastAnalysis } from '@/lib/storage';
import { analyzeSaju, calculateDayPillar, Ohaeng, CHEONGAN_OHAENG, JIJI_OHAENG, OHAENG_COLOR } from '@/lib/saju-engine';
import { applyLocalTimeCorrection } from '@/lib/local-time';
import { analyzeHapChung, applyHapChungToOhaengScore } from '@/lib/hapchung';
import { recalculateSajuWithNewBalance } from '@/lib/saju-engine';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProfile, setSelectedProfile] = useState<SavedProfile | null>(null);

  // 마지막 분석 데이터가 있으면 자동으로 프로필 생성
  useEffect(() => {
    if (selectedProfile) return; // 이미 선택된 프로필 있으면 무시
    const last = getLastAnalysis();
    if (last) {
      setSelectedProfile({
        id: 'last-analysis',
        name: '나',
        year: last.year,
        month: last.month,
        day: last.day,
        hour: last.hour,
        minute: last.minute || '0',
        calendarType: last.calendarType || 'solar',
        isLeapMonth: last.isLeapMonth || false,
        gender: last.gender,
        relationship: last.relationship,
        hasChildren: last.hasChildren ?? false,
        birthCity: last.birthCity || '모름/기본',
        useYajasi: last.useYajasi,
        createdAt: last.savedAt,
      });
    }
  }, []);

  // 현재 달의 날짜들 캘린더 배열 생성
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  // 사주 분석 결과 (선택된 프로필이 있을 경우)
  const sajuResult = useMemo(() => {
    if (!selectedProfile) return null;
    const { year, month, day, hour, minute, birthCity, gender, relationship, useYajasi, hasChildren } = selectedProfile;
    
    // 이전에 저장된 모델 구조가 맞는지 체크
    if (!year || !month || !day) return null;

    try {
      const localCorr = applyLocalTimeCorrection(parseInt(hour), parseInt(minute||'0'), birthCity || '모름/기본');
      const cityApplied = localCorr.offsetMinutes !== 0;
      const baseSaju = analyzeSaju(parseInt(year), parseInt(month), parseInt(day), localCorr.correctedHour, gender, relationship, localCorr.correctedMinute, useYajasi || true, false, cityApplied, hasChildren ?? false);

      const hapChung = analyzeHapChung([baseSaju.year, baseSaju.month, baseSaju.day, baseSaju.hour], undefined, undefined, baseSaju.ilgan);
      const newBalance = applyHapChungToOhaengScore(baseSaju.ohaengBalance, hapChung);
      return recalculateSajuWithNewBalance(baseSaju, newBalance);
    } catch (err) {
      console.error('캘린더 사주 분석 실패:', err);
      return null;
    }
  }, [selectedProfile]);

  const yongsin = sajuResult?.yongsin;
  const gisin = sajuResult?.gisin;

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  return (
    <main className="min-h-screen bg-[#050510] text-gray-100 py-12 md:py-20 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 헤더 */}
        <h1 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-amber-300">
          운세 캘린더
        </h1>

        {/* 사용법 안내 */}
        {!sajuResult && (
          <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/30 rounded-2xl p-6 border border-purple-500/30">
            <h2 className="text-lg font-bold text-purple-300 mb-3">📖 운세 캘린더 사용법</h2>
            <div className="space-y-2 text-sm text-gray-300">
              <p><span className="text-amber-300 font-bold">1단계:</span> 먼저 <span className="text-purple-300 font-bold">사주+타로 분석</span> 페이지에서 생년월일을 입력하고 프로필을 저장하세요.</p>
              <p><span className="text-amber-300 font-bold">2단계:</span> 아래 <span className="text-purple-300 font-bold">"나의 사람들"</span>에서 저장된 프로필을 선택하세요.</p>
              <p><span className="text-amber-300 font-bold">3단계:</span> 캘린더에 내 사주에 맞는 날짜별 운세 색상이 표시됩니다!</p>
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/40" />
                <span className="text-green-300">대길 — 나에게 좋은 기운</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-gray-500/20 border border-gray-500/30" />
                <span className="text-gray-400">무난 — 평범한 날</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/40" />
                <span className="text-red-300">주의 — 기신 기운 주의</span>
              </div>
            </div>
          </div>
        )}

        {/* 프로필 상태 표시 */}
        {sajuResult && selectedProfile ? (
          <div className="bg-[#1e1e3f] p-4 rounded-2xl border border-purple-900/30">
            <p className="text-gray-300 whitespace-pre-wrap text-base">
              나를 돕는 에너지(용신): <span className="text-green-400 font-bold">{yongsin}</span> | 나를 지치게 하는 에너지(기신): <span className="text-red-400 font-bold">{gisin}</span>
            </p>
          </div>
        ) : (
          <div className="bg-[#1e1e3f] p-6 rounded-2xl border border-purple-900/30">
            <p className="text-gray-300 mb-4">
              먼저 <a href="/reading" className="text-purple-400 underline font-bold">사주 분석</a>을 진행해주세요. 분석 후 자동으로 캘린더가 활성화됩니다.
            </p>
          </div>
        )}

        {/* 프로필 활성화 후 색상 범례 */}
        {sajuResult && (
          <div className="flex flex-wrap gap-4 text-xs px-2">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/40" />
              <span className="text-green-300">대길 — 용신({yongsin}) 기운이 강한 날</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-gray-500/20 border border-gray-500/30" />
              <span className="text-gray-400">무난</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/40" />
              <span className="text-red-300">주의 — 기신({gisin}) 기운 주의</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded ring-2 ring-purple-500" />
              <span className="text-purple-300">오늘</span>
            </div>
          </div>
        )}

        {/* 달력 UI */}
        <div className="bg-[#0a0a1a] rounded-2xl p-6 border border-white/5 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <button onClick={prevMonth} className="px-4 py-2 hover:bg-white/5 rounded-lg font-bold">◀</button>
            <h2 className="text-2xl font-bold">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h2>
            <button onClick={nextMonth} className="px-4 py-2 hover:bg-white/5 rounded-lg font-bold">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-sm font-bold text-gray-500 mb-2">
            <div className="text-red-400">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400">토</div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="p-4" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const date = i + 1;
              const iljin = calculateDayPillar(currentDate.getFullYear(), currentDate.getMonth() + 1, date);
              
              // 해당 날짜의 오행 기운
              const ganOhaeng = CHEONGAN_OHAENG[iljin.cheongan];
              const jiOhaeng = JIJI_OHAENG[iljin.jiji];

              let moodClass = "bg-[#1e1e3f] border-white/5 border text-gray-200";
              let label = "";

              if (sajuResult) {
                // 용신/기신 맞춤 점수 산출
                let score = 0;
                if (ganOhaeng === yongsin) score++;
                if (jiOhaeng === yongsin) score++;
                if (ganOhaeng === gisin) score--;
                if (jiOhaeng === gisin) score--;

                if (score > 0) {
                  moodClass = "bg-green-500/20 border-green-500/30 text-green-300";
                  label = "대길";
                } else if (score < 0) {
                  moodClass = "bg-red-500/20 border-red-500/30 text-red-300";
                  label = "주의";
                } else {
                  moodClass = "bg-gray-500/10 border-gray-500/30 text-gray-300";
                  label = "무난";
                }
              }

              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), date).toDateString();

              return (
                <div key={date} className={`relative p-2 md:p-4 rounded-xl flex flex-col items-center justify-center ${moodClass} ${isToday ? 'ring-2 ring-purple-500' : ''} transition-all hover:scale-105`}>
                  <span className="text-lg font-bold mb-1">{date}</span>
                  <div className="text-xs space-y-1">
                    <span style={{ color: OHAENG_COLOR[ganOhaeng] }}>{iljin.cheongan}</span>
                    <span style={{ color: OHAENG_COLOR[jiOhaeng] }}>{iljin.jiji}</span>
                  </div>
                  {label && <span className="absolute bottom-1 right-2 text-[10px] opacity-70">{label}</span>}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </main>
  );
}
