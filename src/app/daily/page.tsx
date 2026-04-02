'use client';

import { useState, useEffect, useCallback } from 'react';
import { analyzeSaju } from '@/lib/saju-engine';
import type { SajuResult } from '@/lib/saju-engine';
import { OHAENG_COLOR } from '@/lib/saju-engine';
import { getDailyTarot } from '@/lib/daily-tarot';
import type { DailyTarotResult } from '@/lib/daily-tarot';
import { validateBirthDate, safeGetItem } from '@/lib/date-validator';
import { getSavedProfiles } from '@/lib/storage';
import type { SavedProfile } from '@/lib/storage';

type Step = 'input' | 'card' | 'result';

export default function DailyPage() {
  const [step, setStep] = useState<Step>('input');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthHour, setBirthHour] = useState('12');
  const [sajuResult, setSajuResult] = useState<SajuResult | null>(null);
  const [dailyResult, setDailyResult] = useState<DailyTarotResult | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);

  // 분석 실행 함수
  const runAnalyze = useCallback((year: string, month: string, day: string, hour: string) => {
    const y = parseInt(year), m = parseInt(month), d = parseInt(day), h = parseInt(hour);

    const dateCheck = validateBirthDate(y, m, d);
    if (!dateCheck.valid) return false;

    let saju: SajuResult;
    try {
      saju = analyzeSaju(y, m, d, h);
    } catch {
      return false;
    }
    setSajuResult(saju);

    try {
      const now = new Date();
      const daily = getDailyTarot(saju, now.getFullYear(), now.getMonth() + 1, now.getDate());
      setDailyResult(daily);
    } catch {
      return false;
    }
    setCardFlipped(false);
    return true;
  }, []);

  // 마운트 시 저장된 데이터 자동 불러오기 → 바로 결과 표시
  useEffect(() => {
    // 저장된 프로필 불러오기
    const profiles = getSavedProfiles();
    setSavedProfiles(profiles);

    // 1순위: saju-last-input (가장 최근 입력)
    const saved = safeGetItem('saju-last-input');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.year && data.month && data.day) {
          setBirthYear(data.year);
          setBirthMonth(data.month);
          setBirthDay(data.day);
          if (data.hour !== undefined && data.hour !== '-1') setBirthHour(data.hour);

          // 바로 분석 실행 → 카드 뒤집기 단계로 이동
          const success = runAnalyze(data.year, data.month, data.day, data.hour !== '-1' ? data.hour : '12');
          if (success) {
            setAutoLoaded(true);
            setStep('card');
            return;
          }
        }
      } catch { /* ignore */ }
    }

    // 2순위: 첫 번째 저장된 프로필
    if (profiles.length > 0) {
      const p = profiles[0];
      setBirthYear(p.year);
      setBirthMonth(p.month);
      setBirthDay(p.day);
      if (p.hour && p.hour !== '-1') setBirthHour(p.hour);

      const success = runAnalyze(p.year, p.month, p.day, p.hour !== '-1' ? p.hour : '12');
      if (success) {
        setAutoLoaded(true);
        setStep('card');
      }
    }
  }, [runAnalyze]);

  // 프로필 선택 시 바로 분석
  function handleSelectProfile(p: SavedProfile) {
    setBirthYear(p.year);
    setBirthMonth(p.month);
    setBirthDay(p.day);
    if (p.hour && p.hour !== '-1') setBirthHour(p.hour);
    const success = runAnalyze(p.year, p.month, p.day, p.hour !== '-1' ? p.hour : '12');
    if (success) {
      setAutoLoaded(true);
      setStep('card');
    }
  }

  function handleAnalyze() {
    if (!privacyAgreed && !autoLoaded) {
      alert('개인정보 수집·이용에 동의해주세요.');
      return;
    }
    const success = runAnalyze(birthYear, birthMonth, birthDay, birthHour);
    if (success) {
      setStep('card');
    } else {
      const dateCheck = validateBirthDate(parseInt(birthYear), parseInt(birthMonth), parseInt(birthDay));
      alert(dateCheck.error || '분석 중 오류가 발생했습니다.');
    }
  }

  function handleFlip() {
    setCardFlipped(true);
    setTimeout(() => setStep('result'), 1000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative">
      <h1 className="text-3xl font-bold text-center mb-2 text-amber-300">
        오늘의 운세
      </h1>
      <p className="text-center text-gray-400 text-sm mb-8">
        사주 기반 데일리 타로 리딩
      </p>

      {/* Step 1: 생년월일 입력 */}
      {step === 'input' && (
        <div className="space-y-4 max-w-md mx-auto relative">
          {/* X 닫기 버튼 — 오늘의 운세(카드/결과)로 돌아가기 */}
          {dailyResult && (
            <button
              onClick={() => setStep(cardFlipped ? 'result' : 'card')}
              className="absolute -top-2 right-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white bg-[#1e1e3f] hover:bg-red-600/60 rounded-full border border-gray-600/50 transition-all text-lg font-bold"
              title="닫기"
            >
              ✕
            </button>
          )}

          {/* 저장된 프로필이 있으면 바로 선택 가능 */}
          {savedProfiles.length > 0 && (
            <div className="bg-[#1e1e3f] rounded-2xl p-5 border border-amber-900/30">
              <p className="text-sm text-amber-300 font-bold mb-3">저장된 프로필로 바로 보기</p>
              <div className="flex flex-wrap gap-2">
                {savedProfiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProfile(p)}
                    className="px-4 py-2 bg-amber-900/30 hover:bg-amber-700 border border-amber-500/40 rounded-full text-sm text-amber-100 font-medium transition-all hover:scale-105"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-amber-900/30">
            <h2 className="text-xl font-bold text-center mb-6 text-amber-300">
              {savedProfiles.length > 0 ? '또는 직접 입력' : '생년월일시를 입력하세요'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">년(양력)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="1990"
                    value={birthYear}
                    onChange={e => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    data-field="daily-year"
                    className="w-full px-3 py-2 bg-[#0a0a1a] border border-amber-900/50 rounded-lg text-white text-center tracking-widest focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">월</label>
                  <select
                    value={birthMonth}
                    onChange={e => setBirthMonth(e.target.value)}
                    data-field="daily-month"
                    className="w-full px-3 py-2 bg-[#0a0a1a] border border-amber-900/50 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">선택</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}월</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">일</label>
                  <select
                    value={birthDay}
                    onChange={e => setBirthDay(e.target.value)}
                    data-field="daily-day"
                    className="w-full px-3 py-2 bg-[#0a0a1a] border border-amber-900/50 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">선택</option>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}일</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">태어난 시간</label>
                <select
                  value={birthHour}
                  onChange={e => setBirthHour(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a1a] border border-amber-900/50 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                >
                  {[
                    { value: '0', label: '자시 (23:00~01:00)' },
                    { value: '1', label: '축시 (01:00~03:00)' },
                    { value: '3', label: '인시 (03:00~05:00)' },
                    { value: '5', label: '묘시 (05:00~07:00)' },
                    { value: '7', label: '진시 (07:00~09:00)' },
                    { value: '9', label: '사시 (09:00~11:00)' },
                    { value: '11', label: '오시 (11:00~13:00)' },
                    { value: '13', label: '미시 (13:00~15:00)' },
                    { value: '15', label: '신시 (15:00~17:00)' },
                    { value: '17', label: '유시 (17:00~19:00)' },
                    { value: '19', label: '술시 (19:00~21:00)' },
                    { value: '21', label: '해시 (21:00~23:00)' },
                  ].map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 개인정보 동의 */}
              <div className="bg-[#0a0a1a] rounded-xl p-3 border border-amber-900/20 mt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAgreed}
                    onChange={e => setPrivacyAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500 shrink-0"
                  />
                  <span className="text-xs text-gray-300 leading-relaxed">
                    <span className="text-amber-300 font-bold">[필수]</span> 개인정보 수집·이용에 동의합니다.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPrivacyDetail(!showPrivacyDetail)}
                  className="mt-1.5 ml-7 text-[11px] text-amber-400/70 underline underline-offset-2 hover:text-amber-300"
                >
                  {showPrivacyDetail ? '접기' : '자세히 보기'}
                </button>
                {showPrivacyDetail && (
                  <div className="mt-2 ml-7 bg-[#1a1a2e] rounded-lg p-3 border border-amber-900/20 text-[11px] text-gray-400 leading-relaxed space-y-1.5">
                    <p className="font-bold text-gray-300">개인정보 수집·이용 안내</p>
                    <p><span className="text-gray-300">수집 항목:</span> 생년월일, 태어난 시간</p>
                    <p><span className="text-gray-300">수집 목적:</span> 일일 타로 운세 분석 서비스 제공</p>
                    <p><span className="text-gray-300">보관 방법:</span> 브라우저(localStorage)에만 저장, 서버 전송 없음</p>
                    <p><span className="text-gray-300">동의 거부 권리:</span> 거부 시 서비스 이용 불가</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!privacyAgreed}
                className={`w-full py-3 font-bold rounded-xl text-lg transition-all duration-300 mt-3 ${
                  privacyAgreed
                    ? 'bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                오늘의 카드 뽑기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: 카드 뒤집기 */}
      {step === 'card' && dailyResult && (
        <div className="text-center space-y-6">
          {autoLoaded && (
            <p className="text-xs text-gray-500">
              저장된 생년월일로 자동 분석되었습니다 ·{' '}
              <button onClick={() => { setStep('input'); setAutoLoaded(false); }} className="text-amber-400 hover:text-amber-300 underline">
                직접 입력하기
              </button>
            </p>
          )}
          <p className="text-gray-400 text-sm">{dailyResult.date}</p>
          <p className="text-amber-300 text-lg">카드를 터치하여 오늘의 메시지를 확인하세요</p>

          <div
            className="mx-auto cursor-pointer"
            style={{ width: 180, height: 270, perspective: '1000px' }}
            onClick={handleFlip}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.8s',
                transform: cardFlipped ? 'rotateY(180deg)' : '',
              }}
            >
              {/* 뒷면 */}
              <div
                className="absolute inset-0 rounded-2xl border-2 border-amber-500 bg-gradient-to-br from-amber-900/80 to-purple-900/80 flex flex-col items-center justify-center"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-5xl mb-3">🔮</div>
                <div className="text-amber-300 text-sm font-bold">오늘의 카드</div>
                <div className="text-gray-400 text-xs mt-1">터치하여 뒤집기</div>
              </div>
              {/* 앞면 */}
              <div
                className="absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center p-4"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderColor: dailyResult.card.symbolColor,
                  background: `linear-gradient(135deg, ${dailyResult.card.symbolColor}22, #1e1e3f)`,
                }}
              >
                <div className={`text-sm font-bold mb-2 ${dailyResult.isReversed ? 'text-red-400' : 'text-green-400'}`}>
                  {dailyResult.isReversed ? '역방향 ↓' : '정방향 ↑'}
                </div>
                <div className="text-4xl mb-2" style={{ transform: dailyResult.isReversed ? 'rotate(180deg)' : '' }}>
                  {dailyResult.card.arcana === 'major' ? '★' : '🃏'}
                </div>
                <div className="text-lg font-bold text-white text-center">{dailyResult.card.name}</div>
                <div className="text-xs text-gray-400 mt-1">{dailyResult.card.nameEn}</div>
                <div className="text-xs mt-2" style={{ color: OHAENG_COLOR[dailyResult.card.element] }}>
                  {dailyResult.card.element}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 상세 결과 */}
      {step === 'result' && dailyResult && sajuResult && (
        <div className="space-y-5">
          {/* 카드 + 날짜 헤더 */}
          <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-amber-900/30 text-center">
            <div className="text-xs text-gray-400 mb-1">{dailyResult.date} | {dailyResult.dailyGanji.cheongan}{dailyResult.dailyGanji.jiji}일</div>
            <div className="text-3xl mb-2" style={{ transform: dailyResult.isReversed ? 'rotate(180deg)' : '' }}>
              {dailyResult.card.arcana === 'major' ? '★' : '🃏'}
            </div>
            <h2 className="text-xl font-bold text-white">{dailyResult.card.name}</h2>
            <div className="flex justify-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${dailyResult.isReversed ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                {dailyResult.isReversed ? '역방향' : '정방향'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/30" style={{ color: OHAENG_COLOR[dailyResult.card.element] }}>
                {dailyResult.card.element}
              </span>
            </div>
          </div>

          {/* 오늘의 메시지 */}
          <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-amber-900/30">
            <h3 className="text-sm font-bold text-amber-300 mb-3">오늘의 메시지</h3>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {dailyResult.overallMessage}
            </p>
          </div>

          {/* 럭키 아이템 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#1e1e3f] rounded-xl p-4 text-center border border-amber-900/20">
              <div className="text-xl mb-1">🎨</div>
              <div className="text-[10px] text-gray-400">행운의 색</div>
              <div className="text-sm font-bold text-amber-300">{dailyResult.luckyColor}</div>
            </div>
            <div className="bg-[#1e1e3f] rounded-xl p-4 text-center border border-amber-900/20">
              <div className="text-xl mb-1">🔢</div>
              <div className="text-[10px] text-gray-400">행운의 숫자</div>
              <div className="text-sm font-bold text-amber-300">{dailyResult.luckyNumber}</div>
            </div>
            <div className="bg-[#1e1e3f] rounded-xl p-4 text-center border border-amber-900/20">
              <div className="text-xl mb-1">🧭</div>
              <div className="text-[10px] text-gray-400">행운의 방향</div>
              <div className="text-sm font-bold text-amber-300">{dailyResult.luckyDirection}</div>
            </div>
          </div>

          {/* 시간대별 조언 */}
          <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-amber-900/30">
            <h3 className="text-sm font-bold text-amber-300 mb-4">시간대별 조언</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="text-2xl">🌅</div>
                <div>
                  <div className="text-xs text-amber-400 font-bold mb-1">오전</div>
                  <p className="text-xs text-gray-300">{dailyResult.morningAdvice}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-2xl">☀️</div>
                <div>
                  <div className="text-xs text-amber-400 font-bold mb-1">오후</div>
                  <p className="text-xs text-gray-300">{dailyResult.afternoonAdvice}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-2xl">🌙</div>
                <div>
                  <div className="text-xs text-amber-400 font-bold mb-1">저녁</div>
                  <p className="text-xs text-gray-300">{dailyResult.eveningAdvice}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 분야별 운세 */}
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-[#1e1e3f] rounded-xl p-4 border border-pink-900/20">
              <div className="text-xs text-pink-400 font-bold mb-2">❤️ 연애운</div>
              <p className="text-xs text-gray-300">{dailyResult.loveMessage}</p>
            </div>
            <div className="bg-[#1e1e3f] rounded-xl p-4 border border-amber-900/20">
              <div className="text-xs text-amber-400 font-bold mb-2">💰 재물운</div>
              <p className="text-xs text-gray-300">{dailyResult.moneyMessage}</p>
            </div>
            <div className="bg-[#1e1e3f] rounded-xl p-4 border border-green-900/20">
              <div className="text-xs text-green-400 font-bold mb-2">🏥 건강운</div>
              <p className="text-xs text-gray-300">{dailyResult.healthMessage}</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
