'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
const TrialTimer = dynamic(() => import('@/components/TrialTimer'), { ssr: false });
import { recalculateSajuWithNewBalance, analyzeSaju } from '@/lib/saju-engine';
import type { SajuResult } from '@/lib/saju-engine';
import { performReading } from '@/lib/saju-taro-matcher';
import type { TarotReading, SpreadType } from '@/lib/saju-taro-matcher';
import { OHAENG_COLOR, CHEONGAN_OHAENG, JIJI_OHAENG, OHAENG_SANGSAENG, OHAENG_SANGGEUK } from '@/lib/saju-engine';
import type { Ohaeng } from '@/lib/saju-engine';
import { calculateAllTwelveStages, TWELVE_STAGE_DATA } from '@/lib/twelve-stages';
import { detectAllSinsal, analyzeSamjae } from '@/lib/sinsal';
import type { SamjaeResult } from '@/lib/sinsal';
import { calculateDaeun, calculateSeun, calculateFiveYearSeun, analyzeGyeokgukTransition, analyzeHealthForecast, calculateMonthlyFortunes } from '@/lib/daeun';
import type { DaeunResult, SeunResult, GyeokgukTransition, HealthForecast, MonthlyFortune } from '@/lib/daeun';
import { analyzeHapChung, applyHapChungToOhaengScore } from '@/lib/hapchung';
import type { HapChungAnalysis } from '@/lib/hapchung';
import { analyzeSaryeongAdvanced } from '@/lib/saryeong-advanced';
import type { SaryeongAdvancedResult } from '@/lib/saryeong-advanced';
import { analyzeCareer, analyzeMarriage, analyzeWealth, generateLifeTimeline } from '@/lib/life-prediction';
import type { MarriagePrediction, WealthPrediction, LifeTimelineEvent } from '@/lib/life-prediction';
import { analyzeIsaFortune } from '@/lib/isa-fortune';
import type { IsaFortuneResult } from '@/lib/isa-fortune';
import KoreanLunarCalendar from 'korean-lunar-calendar';

import { easySipseongText, adaptLoveTextForMarried, sipseongLabel, SIPSEONG_EASY } from '@/lib/reading-formatters';
import { generateSajuAnswer } from '@/lib/reading-generators/saju-qna';
import { SipseongBadge } from '@/components/reading/SipseongBadge';
import { NewYearReading } from '@/components/reading/NewYearReading';
import { ReadingInputForm } from '@/components/reading/ReadingInputForm';
import { ResultMenu } from '@/components/reading/ResultMenu';
import { QnaSection } from '@/components/reading/QnaSection';
import { saveLastAnalysis, getLastAnalysis } from '@/lib/storage';
import { setAnalysisCompleted } from '@/components/NavLinks';
import { DeckAnimation } from '@/components/tarot/DeckAnimation';
// import { KOREAN_CITIES, applyLocalTimeCorrection } from '@/lib/local-time'; // 출생지역 보정 제거
import { validateBirthDate, safeGetItem, safeSetItem } from '@/lib/date-validator';


type Step = 'input' | 'result';
type ResultSection = 'menu' | 'saju' | 'newyear' | 'daeun' | 'fiveyear' | 'samjae' | 'timeline' | 'career' | 'love' | 'wealth' | 'health' | 'relation' | 'isa' | 'tarot' | 'qna';


// 십성 용어 → 초등학생도 이해할 수 있는 쉬운 설명
export default function ReadingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<Step>('input');
  const [pendingAutoAnalyze, setPendingAutoAnalyze] = useState(false);
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthHour, setBirthHour] = useState('-1');
  const [birthMinute, setBirthMinute] = useState('-1');
  const [birthCity, setBirthCity] = useState('모름/기본');
  const useYajasi = true;
  const [useDongsaeng, setUseDongsaeng] = useState(false); // 동생동사 모드 (12운성)
  const showSinsal = true; // 신살 표시 ON 고정
  const showTwelveStages = true; // 12운성 표시 ON 고정
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [relationship, setRelationship] = useState<'single' | 'dating' | 'married'>('single');
  const [hasChildren, setHasChildren] = useState(false);
  const [sajuResult, setSajuResult] = useState<SajuResult | null>(null);
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [isAnimatingDeck, setIsAnimatingDeck] = useState(false);
  const isPremium = true; // 모든 기능 무료 제공
  const [daeunResult, setDaeunResult] = useState<DaeunResult | null>(null);
  const [fiveYearSeun, setFiveYearSeun] = useState<SeunResult[]>([]);
  const [pastFiveYearSeun, setPastFiveYearSeun] = useState<SeunResult[]>([]);
  const [seunViewMode, setSeunViewMode] = useState<'future' | 'past'>('future');
  const [selectedSeunYear, setSelectedSeunYear] = useState<number>(new Date().getFullYear());
  const [lifePredictions, setLifePredictions] = useState<{
    career: ReturnType<typeof analyzeCareer>;
    marriage: MarriagePrediction;
    wealth: WealthPrediction;
    timeline: LifeTimelineEvent[];
  } | null>(null);
  const [sajuQuestion, setSajuQuestion] = useState('');
  const [sajuAnswer, setSajuAnswer] = useState('');
  const [hapChungResult, setHapChungResult] = useState<HapChungAnalysis | null>(null);
  const [saryeongAdvResult, setSaryeongAdvResult] = useState<SaryeongAdvancedResult | null>(null);
  const [gyeokgukResult, setGyeokgukResult] = useState<GyeokgukTransition | null>(null);
  const [isaResult, setIsaResult] = useState<IsaFortuneResult | null>(null);
  const [samjaeResult, setSamjaeResult] = useState<SamjaeResult | null>(null);
  const [activeSection, setActiveSectionRaw] = useState<ResultSection>('menu');

  // 섹션 변경 시 URL 히스토리에 push (뒤로가기로 이전 섹션으로 돌아가기 가능)
  const skipHistoryRef = useRef(false);
  const setActiveSection = (section: ResultSection) => {
    setActiveSectionRaw(section);
    if (skipHistoryRef.current) return; // popstate 복원 시에는 히스토리 push 안 함
    if (section === 'menu') {
      // 메뉴로 돌아갈 때는 replace (중복 히스토리 방지)
      window.history.replaceState({ section: 'menu' }, '', '/reading?step=result');
    } else {
      // 서브 섹션 → URL에 section 파라미터 추가 (히스토리 push)
      window.history.pushState({ section }, '', `/reading?step=result&section=${section}`);
    }
  };
  const [monthlyFortunes, setMonthlyFortunes] = useState<MonthlyFortune[]>([]);
  const [expandedStage, setExpandedStage] = useState<'year' | 'month' | 'day' | 'hour' | null>(null);
  const [selectedDaeunIdx, setSelectedDaeunIdx] = useState<number | null>(null);
  const [selectedTimelineIdx, setSelectedTimelineIdx] = useState<number | null>(null);

  // 자동 복원 (컴포넌트 마운트 시 한 번)
  useEffect(() => {
    const saved = safeGetItem('saju-last-input');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.year) setBirthYear(data.year);
        if (data.month) setBirthMonth(data.month);
        if (data.day) setBirthDay(data.day);
        if (data.hour !== undefined) setBirthHour(data.hour);
        if (data.minute !== undefined) setBirthMinute(data.minute);
        if (data.birthCity) setBirthCity(data.birthCity);
        if (data.calendarType) setCalendarType(data.calendarType);
        if (data.isLeapMonth !== undefined) setIsLeapMonth(data.isLeapMonth);
        if (data.gender) setGender(data.gender);
        if (data.relationship) setRelationship(data.relationship);
        if (data.hasChildren !== undefined) setHasChildren(data.hasChildren);
      } catch (e) {
        console.error('Failed to parse saved input', e);
      }
    }
  }, []);

  // 자동 저장 (상태 변경 시) - localStorage + window 메모리 둘 다 저장
  useEffect(() => {
    if (birthYear || birthMonth || birthDay) {
      const data = {
        year: birthYear, month: birthMonth, day: birthDay,
        hour: birthHour, minute: birthMinute,
        birthCity, calendarType, isLeapMonth, gender, relationship, hasChildren,
      };
      safeSetItem('saju-last-input', JSON.stringify(data));
      // window 메모리에도 저장 (사주타로 클릭 시 자동 분석용)
      saveLastAnalysis({ ...data, useYajasi: true, hasChildren });
    }
  }, [birthYear, birthMonth, birthDay, birthHour, birthMinute, birthCity, calendarType, isLeapMonth, gender, relationship, hasChildren]);
  // 십성 용어를 쉬운 설명으로 치환 (Q&A 텍스트용)
  function handleSajuQuestion() {
    if (!sajuQuestion.trim() || !sajuResult || !daeunResult || !lifePredictions) return;
    const ans = generateSajuAnswer(sajuQuestion, sajuResult, daeunResult, lifePredictions, fiveYearSeun, sinsalList, hapChungResult);
    setSajuAnswer(easySipseongText(ans));
  }

  function handleQuickSajuQuestion(q: string) {
    if (!sajuResult || !daeunResult || !lifePredictions) return;
    setSajuQuestion(q);
    const ans = generateSajuAnswer(q, sajuResult, daeunResult, lifePredictions, fiveYearSeun, sinsalList, hapChungResult);
    setSajuAnswer(easySipseongText(ans));
  }

  /** 질문 키워드로 자동 섹션 감지 */
  function detectSectionFromQuestion(question: string): ResultSection {
    const q = question.trim();
    // 직업/이직/적성/사업
    if (/직업|이직|적성|취업|진로|사업|창업|회사|커리어/.test(q)) return 'career';
    // 연애/결혼/부부/배우자/애정
    if (/연애|결혼|부부|배우자|남자|여자|소개팅|바람|이혼|궁합|애정|사랑|연인|남친|여친/.test(q)) return 'love';
    // 재물/돈/재테크
    if (/재물|돈|재테크|투자|부자|수입|월급|재산|재복/.test(q)) return 'wealth';
    // 이사/풍수/방향
    if (/이사|풍수|방향|집|부동산/.test(q)) return 'isa';
    // 건강
    if (/건강|아[픈프]|병|체질|수술|다이어트/.test(q)) return 'health';
    // 올해/운세/신년
    if (/올해|운세|신년|금년|202[0-9]년/.test(q)) return 'newyear';
    // 대인관계/친구
    if (/대인|관계|친구|동료|상사|인간/.test(q)) return 'relation';
    // 자녀/학업/시험
    if (/자녀|아이|학업|시험|공부|성적|수능/.test(q)) return 'qna';
    // 삼재
    if (/삼재|들삼재|눌삼재|날삼재|재난|재앙/.test(q)) return 'samjae';
    // 대운/운의 흐름
    if (/대운|10년|인생 흐름/.test(q)) return 'daeun';
    // 타임라인/황금기
    if (/타임|황금기|전성기|인생 전체/.test(q)) return 'timeline';
    // 타로
    if (/타로|카드/.test(q)) return 'tarot';
    // 기본: Q&A로 이동 (자유 질문 답변을 바로 보여줌)
    return 'qna';
  }

  function handleAnalyze() {
    const year_raw = parseInt(birthYear);
    const month_raw = parseInt(birthMonth);
    const day_raw = parseInt(birthDay);
    const hour = parseInt(birthHour);

    const dateCheck = validateBirthDate(year_raw, month_raw, day_raw);
    if (!dateCheck.valid) {
      console.error('날짜 유효성 오류:', dateCheck.error);
      return;
    }

    let year = year_raw;
    let month = month_raw;
    let day = day_raw;

    // 음력→양력 변환
    if (calendarType === 'lunar') {
      try {
        const cal = new KoreanLunarCalendar();
        const valid = cal.setLunarDate(year, month, day, isLeapMonth);
        if (!valid) {
          console.error('유효하지 않은 음력 날짜');
          return;
        }
        const solar = cal.getSolarCalendar();
        year = solar.year;
        month = solar.month;
        day = solar.day;
      } catch {
        console.error('음력 변환 실패');
        return;
      }
    }

    const minute = parseInt(birthMinute);
    const isTimeUnknown = hour === -1;
    const isMinuteUnknown = minute === -1;

    let correctedHour = hour;
    let correctedMinute = isMinuteUnknown ? 0 : minute;
    const cityApplied = false; // 출생지역 보정 제거 — 태어난 시간 그대로 적용

    let baseSaju: SajuResult;
    try {
      baseSaju = analyzeSaju(
        year,
        month,
        day,
        isTimeUnknown ? 12 : correctedHour,
        gender,
        relationship,
        isTimeUnknown ? 0 : correctedMinute,
        useYajasi,
        isTimeUnknown,
        cityApplied, // 도시 보정 적용 시 엔진 내부 +30분 KST 보정 건너뜀
        hasChildren,
      );
    } catch (err) {
      console.error('사주 분석 오류:', err instanceof Error ? err.message : err);
      return;
    }

    // 합충 분석 (오행 밸런스 점수 보정용)
    const baseHapChung = analyzeHapChung(
      [baseSaju.year, baseSaju.month, baseSaju.day, baseSaju.hour],
      undefined,
      undefined,
      baseSaju.ilgan
    );

    // 합충 반영된 점수로 사주 결과 재컴파일
    const newBalance = applyHapChungToOhaengScore(baseSaju.ohaengBalance, baseHapChung);
    const result = recalculateSajuWithNewBalance(baseSaju, newBalance);

    // ── 용신/기신 재계산 (85% 종강격 기준, 원국 밸런스 기준) ──
    // 격국/용신 판정은 합충 보정 전의 원래 밸런스로 해야 함
    // (합충 보정은 운세 분석용이지, 기본 격국 판정을 바꾸면 안 됨)
    {
      const bal = baseSaju.ohaengBalance; // ★ 합충 전 원래 밸런스 사용
      const ilOh = CHEONGAN_OHAENG[result.ilgan] as Ohaeng;
      const inOh = (Object.entries(OHAENG_SANGSAENG).find(([, v]) => v === ilOh)?.[0] || ilOh) as Ohaeng;
      const shikOh = OHAENG_SANGSAENG[ilOh] as Ohaeng;
      const jaeOh = OHAENG_SANGGEUK[ilOh] as Ohaeng;
      const gwanOh = (Object.entries(OHAENG_SANGGEUK).find(([, v]) => v === ilOh)?.[0]) as Ohaeng | undefined;

      const ilBal = bal[ilOh] || 0;
      const myForce = ilBal + (bal[inOh] || 0);
      const totalBal = Object.values(bal).reduce((a: number, b: number) => a + b, 0) as number;

      const antiGanCount = [bal[shikOh] || 0, bal[jaeOh] || 0, bal[gwanOh!] || 0]
        .filter((v: number) => v >= 1.0).length;

      // 종강격: 원국 기준 85% 이상, 일간 6 이상, 반대세력 1개 이하
      const isJonggang = myForce >= totalBal * 0.85 && ilBal >= 6 && antiGanCount <= 1;

      if (!isJonggang) {
        // 정격 판정
        const isStrong = myForce > totalBal / 2;
        if (isStrong) {
          // 신강: 식상 또는 재성 중 약한 쪽이 용신, 인성이 기신
          result.yongsin = ((bal[shikOh] || 0) <= (bal[jaeOh] || 0) ? shikOh : jaeOh) as Ohaeng;
          result.gisin = inOh;
        } else {
          // 신약: 인성 또는 비겁 중 약한 쪽이 용신, 재성이 기신
          result.yongsin = ((bal[inOh] || 0) <= (bal[ilOh] || 0) ? inOh : ilOh) as Ohaeng;
          result.gisin = jaeOh;
        }
      }
    }

    // ── 대운/세운/인생예측 계산 시 원국 밸런스 사용 ──
    // 격국/신강신약/종격 판정은 합충 보정 전 원래 밸런스로 해야 정확함
    // (합충 보정은 운세 디테일용이지, 기본 격국을 바꾸면 안 됨)
    const hapchungBalance = result.ohaengBalance;       // 합충 보정 후 (나중에 복원)
    const rawBalance = baseSaju.ohaengBalance;           // 합충 전 원래 밸런스
    result.ohaengBalance = rawBalance;                   // 원국 밸런스로 교체

    setSajuResult({ ...result, ohaengBalance: hapchungBalance }); // UI에는 합충 후 표시

    // 대운 계산 (원국 밸런스 기준으로 격국/용신 판정)
    const daeun = calculateDaeun(result, year, month, day, gender);
    setDaeunResult(daeun);

    // 5년 세운 계산 (앞으로 5년 + 지난 5년) — 대운 교차 분석 연동
    const currentYear = new Date().getFullYear();
    const seun = calculateFiveYearSeun(result, currentYear, daeun.currentDaeun);
    setFiveYearSeun(seun);
    const pastSeun = calculateFiveYearSeun(result, currentYear - 5, daeun.currentDaeun);
    setPastFiveYearSeun(pastSeun);

    // 인생 예측 (적합 직업, 결혼운, 재물운, 타임라인)
    const userAge = currentYear - year + 1; // 한국 나이
    const career = analyzeCareer(result, gender, userAge);
    const marriage = analyzeMarriage(result, year, gender, daeun.pillars);
    const wealth = analyzeWealth(result, daeun.pillars);
    const timeline = generateLifeTimeline(result, daeun.pillars);

    // 밸런스 복원 (이후 렌더링에서 합충 후 밸런스 사용)
    result.ohaengBalance = hapchungBalance;
    setLifePredictions({ career, marriage, wealth, timeline });

    // 삼재 분석 (연지 기준)
    const samjae = analyzeSamjae(result.year.jiji, currentYear);
    setSamjaeResult(samjae);

    // 자동으로 타로 3장 리딩도 함께 실행 (질문 있으면 반영)
    const taroResult = performReading(result, isPremium ? 'three' : 'one', userQuestion || undefined);
    setReading(taroResult);
    setFlippedCards(new Set());

    // ★ 합충회합 분석
    const pillars = [
      { cheongan: result.year.cheongan, jiji: result.year.jiji },
      { cheongan: result.month.cheongan, jiji: result.month.jiji },
      { cheongan: result.day.cheongan, jiji: result.day.jiji },
      { cheongan: result.hour.cheongan, jiji: result.hour.jiji },
    ];
    const currentDaeunPillar = daeun.currentDaeun ? { cheongan: daeun.currentDaeun.cheongan, jiji: daeun.currentDaeun.jiji } : undefined;
    const hapChung = analyzeHapChung(pillars, currentDaeunPillar, undefined, result.ilgan);
    setHapChungResult(hapChung);

    // ★ 사령 심화 분석
    if (result.saryeongAnalysis) {
      const saryeongAdv = analyzeSaryeongAdvanced(
        result.ilgan,
        result.saryeongAnalysis.saryeongGan,
        result.saryeongAnalysis.saryeongSipseong,
        result.saryeongAnalysis.isTouchul,
        currentDaeunPillar?.cheongan,
      );
      setSaryeongAdvResult(saryeongAdv);
    }

    // ★ 격국 전환 (성중유패/패중유성)
    if (daeun.currentDaeun) {
      const daeunGanOh = CHEONGAN_OHAENG[daeun.currentDaeun.cheongan] as Ohaeng;
      const daeunJiOh = JIJI_OHAENG[daeun.currentDaeun.jiji] as Ohaeng;
      const gyeokguk = analyzeGyeokgukTransition(result, daeunGanOh, daeunJiOh, 6);
      setGyeokgukResult(gyeokguk);
    }

    // ★ 이사운 분석
    const thisYearSeunForIsa = seun.find(s => s.year === currentYear);
    const isa = analyzeIsaFortune({
      yongsin: result.yongsin,
      gisin: result.gisin,
      dominantOhaeng: result.dominantOhaeng,
      weakestOhaeng: result.weakestOhaeng,
      ilgan: result.ilgan,
      dayJiji: result.day.jiji,
      yearJiji: result.year.jiji,
      monthJiji: result.month.jiji,
      hourJiji: result.hour.jiji,
      currentDaeunStage: daeun.currentDaeun?.twelveStage,
      currentDaeunEnergy: daeun.currentDaeun?.twelveStage
        ? (TWELVE_STAGE_DATA[daeun.currentDaeun.twelveStage as keyof typeof TWELVE_STAGE_DATA]?.energy || 5)
        : 5,
      thisYearJiji: thisYearSeunForIsa?.jiji,
      ohaengBalance: result.ohaengBalance,
    });
    setIsaResult(isa);

    // 궁금한 점이 있으면 자동으로 사주 답변 생성
    if (userQuestion.trim()) {
      setSajuQuestion(userQuestion.trim());
    }

    // 월별 운세 계산
    const monthly = calculateMonthlyFortunes(result, currentYear);
    setMonthlyFortunes(monthly);

    // 마지막 분석 데이터 자동 저장 (캘린더 등에서 재사용)
    saveLastAnalysis({
      year: birthYear, month: birthMonth, day: birthDay,
      hour: birthHour, minute: birthMinute,
      gender, relationship, hasChildren, birthCity,
      useYajasi, calendarType, isLeapMonth,
    });

    // 질문이 있으면 해당 카테고리로 자동 이동, 없으면 메뉴
    const autoSection = userQuestion.trim() ? detectSectionFromQuestion(userQuestion) : 'menu';
    skipHistoryRef.current = true; // 분석 완료 시에는 히스토리 push 안 함 (router.push로 대체)
    setActiveSectionRaw(autoSection);
    skipHistoryRef.current = false;
    setStep('result');
    setAnalysisCompleted(true);

    // URL을 ?step=result로 변경 (push로 히스토리에 추가 → 뒤로가기로 input으로 돌아감)
    router.push('/reading?step=result');
  }

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const url = new URL(window.location.href);
      const stepP = url.searchParams.get('step');
      const sectionP = url.searchParams.get('section');

      skipHistoryRef.current = true; // 복원 중 히스토리 push 방지
      if (stepP === 'input') {
        setStep('input');
      } else if (stepP === 'result' && sajuResult) {
        setStep('result');
        setActiveSectionRaw(sectionP as ResultSection || 'menu');
      }
      skipHistoryRef.current = false;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [sajuResult]);

  // URL 파라미터로 step 전환
  useEffect(() => {
    const stepParam = searchParams.get('step');
    const sectionParam = searchParams.get('section');
    if (stepParam === 'input') {
      setStep('input');
    } else if (stepParam === 'result') {
      if (sajuResult) {
        // 이미 분석 완료된 결과가 있으면 바로 표시
        setStep('result');
        // section 파라미터가 없으면 메뉴로 (상단 네비 '사주타로' 클릭 시)
        if (!sectionParam) {
          skipHistoryRef.current = true;
          setActiveSectionRaw('menu');
          skipHistoryRef.current = false;
        }
      } else if (birthYear && birthMonth && birthDay) {
        // 폼 데이터가 이미 state에 있으면 바로 분석 실행
        handleAnalyze();
      } else {
        // state에 없으면 window 메모리에서 복원 후 자동 분석 예약
        const last = getLastAnalysis();
        if (last) {
          setBirthYear(last.year);
          setBirthMonth(last.month);
          setBirthDay(last.day);
          setBirthHour(last.hour);
          setBirthMinute(last.minute);
          setBirthCity(last.birthCity);
          setGender(last.gender);
          setRelationship(last.relationship);
          setCalendarType(last.calendarType);
          setIsLeapMonth(last.isLeapMonth);
          setPendingAutoAnalyze(true);
        } else {
          setStep('input');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 폼 데이터 세팅 후 자동 분석 실행
  useEffect(() => {
    if (pendingAutoAnalyze && birthYear && birthMonth && birthDay) {
      setPendingAutoAnalyze(false);
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoAnalyze, birthYear, birthMonth, birthDay]);

  // 궁금한 점 입력 시 자동 답변 생성
  useEffect(() => {
    if (step === 'result' && sajuQuestion.trim() && sajuResult && daeunResult && lifePredictions) {
      handleSajuQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sajuResult, daeunResult, lifePredictions]);

  // 12운성 계산 (메모이제이션)
  const twelveStages = useMemo(() => {
    if (!sajuResult) return null;
    return calculateAllTwelveStages(
      sajuResult.ilgan,
      sajuResult.year.jiji,
      sajuResult.month.jiji,
      sajuResult.day.jiji,
      sajuResult.hour.jiji,
      useDongsaeng
    );
  }, [sajuResult, useDongsaeng]);

  // 신살 감지 (메모이제이션)
  const sinsalList = useMemo(() => {
    if (!sajuResult) return [];
    return detectAllSinsal(
      sajuResult.ilgan,
      sajuResult.year.jiji,
      sajuResult.month.jiji,
      sajuResult.day.jiji,
      sajuResult.hour.jiji
    );
  }, [sajuResult]);

  // 다른 스프레드로 타로 다시 뽑기
  function handleReshuffle(spreadType: SpreadType) {
    if (!sajuResult) return;
    const result = performReading(sajuResult, spreadType, userQuestion || undefined);
    setReading(result);
    setFlippedCards(new Set());
  }

  // 카드 뒤집기
  function flipCard(index: number) {
    setFlippedCards(prev => new Set(prev).add(index));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Step 1: 생년월일 입력 */}
      {step === 'input' && (
        <ReadingInputForm
          calendarType={calendarType} setCalendarType={setCalendarType}
          isLeapMonth={isLeapMonth} setIsLeapMonth={setIsLeapMonth}
          birthYear={birthYear} setBirthYear={setBirthYear}
          birthMonth={birthMonth} setBirthMonth={setBirthMonth}
          birthDay={birthDay} setBirthDay={setBirthDay}
          birthHour={birthHour} setBirthHour={setBirthHour}
          birthCity={birthCity} setBirthCity={setBirthCity}
          gender={gender} setGender={setGender}
          relationship={relationship} setRelationship={setRelationship}
          hasChildren={hasChildren} setHasChildren={setHasChildren}
          onAnalyze={handleAnalyze}
        />
      )}

      {/* Step 2: 통합 결과 (사주 + 타로) */}
      {step === 'result' && sajuResult && (
        <>
        <TrialTimer />
        <div className="space-y-6">
          {/* 네비게이션: 메뉴 화면에서만 '정보 다시 입력하기' 표시 */}
          {activeSection === 'menu' && (
            <button
              onClick={() => setStep('input')}
              className="text-base text-gray-400 hover:text-purple-300 transition-colors"
            >
              ← 정보 다시 입력하기
            </button>
          )}

          {/* 절기 경계일 등 경고 표시 */}
          {sajuResult.warnings && sajuResult.warnings.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4">
              {sajuResult.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-300">⚠️ {w}</p>
              ))}
            </div>
          )}

          {/* 궁금한 점에 대한 맞춤 답변 — 사주 기본 분석 바로 아래 */}
          {activeSection !== 'menu' && userQuestion.trim() && sajuAnswer && (
            <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🔮</span>
                <h2 className="text-lg font-bold text-purple-300">"{userQuestion}" 에 대한 사주 분석</h2>
              </div>
              <p className="text-base text-gray-300 leading-relaxed whitespace-pre-line">{sajuAnswer}</p>
            </div>
          )}

          {/* 카테고리 메뉴 */}
          {activeSection === 'menu' && (
            <ResultMenu sajuResult={sajuResult} daeunResult={daeunResult} fiveYearSeun={fiveYearSeun} samjaeResult={samjaeResult} setActiveSection={setActiveSection} />
          )}

          {activeSection === 'saju' && (<>
          <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-purple-900/30">
            <h2 className="text-2xl font-bold text-center mb-2 text-purple-300">
              사주 팔자 분석 결과
            </h2>
            {/* 핵심 요약 카드 — 시간마다 달라지는 정보를 강조 */}
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 rounded-xl p-5 mb-6 border border-purple-500/30">
              <div className="text-center mb-3">
                <span className="text-lg font-bold text-amber-300">{sajuResult.hourInfo.name}</span>
                <span className="text-base text-gray-400 ml-1">({sajuResult.hourInfo.hanja})</span>
                <span className="text-base text-gray-300 ml-2">{sajuResult.hourInfo.time} 생</span>
              </div>
              <p className="text-sm text-center text-purple-300 mb-4">{sajuResult.hourInfo.meaning}</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[#0a0a1a] rounded-lg p-3">
                  <div className="text-sm text-gray-500">태어난 시간의 기운</div>
                  <div className="text-lg font-bold text-white">{sajuResult.hour.cheongan}{sajuResult.hour.jiji}</div>
                  <SipseongBadge sip={sajuResult.sipseongs.hour} size="sm" />
                </div>
                <div className="bg-[#0a0a1a] rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-sm text-green-400">💪 도움되는 기운</div>
                      <div className="text-lg font-bold" style={{ color: OHAENG_COLOR[sajuResult.yongsin] }}>{sajuResult.yongsin}</div>
                    </div>
                    <div>
                      <div className="text-sm text-red-400">⚠️ 조심할 기운</div>
                      <div className="text-lg font-bold" style={{ color: OHAENG_COLOR[sajuResult.gisin] }}>{sajuResult.gisin}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 사주 네 기둥 — 쉬운 설명 */}
            <div className="mb-2">
              <h3 className="text-base text-center text-gray-300 mb-1 font-bold">나의 사주 네 기둥</h3>
              <p className="text-sm text-center text-gray-500 mb-3">태어난 연·월·일·시로 만든 나만의 운명 설계도예요</p>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-8">
              {(['hour', 'day', 'month', 'year'] as const).map((pillarKey) => {
                const pillar = sajuResult[pillarKey];
                const labels: Record<string, { title: string; emoji: string; desc: string }> = {
                  year: { title: '연주', emoji: '👴', desc: '집안·배경' },
                  month: { title: '월주', emoji: '👨‍👩‍👧', desc: '부모·직장' },
                  day: { title: '일주', emoji: '🙋', desc: '나 자신!' },
                  hour: { title: '시주', emoji: '👶', desc: '자녀·노후' },
                };
                const OHAENG_NAME: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
                const info = labels[pillarKey];
                return (
                  <div key={pillarKey} className="text-center">
                    <div className="text-lg mb-1">{info.emoji}</div>
                    <div className="text-sm font-bold text-gray-300">{info.title}</div>
                    <div className="text-sm text-gray-500 mb-2">{info.desc}</div>
                    <div className={`bg-[#0a0a1a] rounded-xl p-3 border ${pillarKey === 'day' ? 'border-purple-500/60 ring-1 ring-purple-500/30' : 'border-purple-900/30'}`}>
                      <div
                        className="text-2xl font-bold mb-1"
                        style={{ color: OHAENG_COLOR[pillar.cheonganOhaeng] }}
                      >
                        {pillar.cheongan}
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        {OHAENG_NAME[pillar.cheonganOhaeng] || pillar.cheonganOhaeng} · {pillar.cheonganEumyang === '양' ? '밝은 기운' : '부드러운 기운'}
                      </div>
                      <div className="border-t border-purple-900/30 pt-2">
                        <div
                          className="text-2xl font-bold mb-1"
                          style={{ color: OHAENG_COLOR[pillar.jijiOhaeng] }}
                        >
                          {pillar.jiji}
                        </div>
                        <div className="text-sm text-gray-400">
                          {OHAENG_NAME[pillar.jijiOhaeng] || pillar.jijiOhaeng}
                        </div>
                      </div>
                    </div>
                    {pillarKey === 'day' && (
                      <div className="text-sm text-purple-400 mt-1 font-bold">⭐ 이게 바로 나!</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 띠 + 일주 */}
            <div className="text-center mb-4 text-gray-300">
              띠: <span className="text-amber-400 font-bold">{sajuResult.animal}띠</span>
              <span className="mx-2 text-gray-600">|</span>
              일주: <span className="text-purple-300 font-bold">{sajuResult.day.cheongan}{sajuResult.day.jiji}</span>
            </div>
            {/* 일주 조합 해석 */}
            <div className="bg-[#0a0a1a] rounded-xl p-4 mb-6 border border-purple-900/20">
              {sajuResult.isTimeUnknown && (
              <div className="bg-red-900/30 text-red-200 border border-red-500/50 p-3 rounded-lg mb-4 text-sm whitespace-pre-line">
                ⚠️ 태어난 시간을 모르시는 경우, 삼주육자(3기둥 6글자)만으로 명식을 구성합니다.
                이에 따라 전체 오행 밸런스 점수(시주 20점 누락) 및 일부 해석이 제한적이거나 불완전할 수 있습니다.
              </div>
            )}
            <h3 className="text-sm text-purple-400 mb-1 font-bold">🏛 일주({sajuResult.day.cheongan}{sajuResult.day.jiji}) 해석</h3>
              <p className="text-xs text-gray-600 mb-2">일주 = 태어난 날의 글자 조합. 나의 핵심 성격과 배우자운을 나타내요</p>
              <p className="text-base text-gray-300 leading-relaxed">{sajuResult.iljuDesc}</p>
            </div>

            {/* 오행 분포 바 */}
            <div className="mb-6">
              <h3 className="text-base text-gray-400 mb-1 text-center">오행 분포</h3>
              <p className="text-sm text-gray-500 mb-1 text-center">나를 구성하는 5가지 에너지 밸런스</p>
              <p className="text-xs text-gray-600 mb-3 text-center">목(나무)=성장, 화(불)=열정, 토(흙)=안정, 금(쇠)=결단, 수(물)=지혜 — 균형이 좋을수록 안정적이에요</p>
              <div className="space-y-2">
                {(Object.entries(sajuResult.ohaengBalance) as [Ohaeng, number][]).map(([oh, val]) => {
                  const maxVal = Math.max(...Object.values(sajuResult.ohaengBalance));
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return (
                    <div key={oh} className="flex items-center gap-3">
                      <span className="w-8 text-base font-bold" style={{ color: OHAENG_COLOR[oh] }}>{oh}</span>
                      <div className="flex-1 bg-[#0a0a1a] rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: OHAENG_COLOR[oh],
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-400 w-8">{val.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 용신/기신 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#0a0a1a] rounded-xl p-4 text-center border border-green-900/30">
                <div className="text-xs text-gray-600 mb-1">용신(用神)</div>
                <div className="text-sm text-gray-400 mb-1">나에게 도움이 되는 기운 💪</div>
                <div className="text-xl font-bold" style={{ color: OHAENG_COLOR[sajuResult.yongsin] }}>
                  {sajuResult.yongsin}
                </div>
              </div>
              <div className="bg-[#0a0a1a] rounded-xl p-4 text-center border border-red-900/30">
                <div className="text-xs text-gray-600 mb-1">기신(忌神)</div>
                <div className="text-sm text-gray-400 mb-1">조심해야 할 기운 ⚠️</div>
                <div className="text-xl font-bold" style={{ color: OHAENG_COLOR[sajuResult.gisin] }}>
                  {sajuResult.gisin}
                </div>
              </div>
            </div>

            {/* 상세 성격 분석 */}
            <div className="bg-[#0a0a1a] rounded-xl p-5 border border-purple-900/30">
              <h3 className="text-base text-purple-300 mb-1 font-bold">상세 성격 분석</h3>
              <p className="text-xs text-gray-600 mb-3">태어난 날의 오행과 사주 전체 구성으로 분석한 나의 타고난 성격이에요</p>
              <div className="text-base text-gray-300 leading-relaxed whitespace-pre-line">{sajuResult.description}</div>
            </div>

            {/* 나의 성격 에너지 분석 (십신) */}
            <div className="bg-[#0a0a1a] rounded-xl p-5 border border-amber-900/30">
              <h3 className="text-base text-amber-300 mb-1 font-bold">나의 성격 에너지 분석</h3>
              <p className="text-sm text-gray-500 mb-1">사주에 있는 10가지 성격 에너지 중 어떤 게 많고 적은지 분석해요</p>
              <p className="text-xs text-gray-600 mb-3">십성(十星)이라 불리는 10가지 에너지가 사주에 어떻게 배치되어 있는지 보여줘요</p>
              {sajuResult.sipseongBalance.excess.length > 0 && (
                <div className="mb-3 bg-red-900/20 rounded-lg p-3 border border-red-900/30">
                  <span className="text-sm text-red-400 font-bold block mb-1">넘치는 에너지 (너무 많아서 조절이 필요해요!)</span>
                  <div className="flex flex-wrap gap-2">
                    {sajuResult.sipseongBalance.excess.map((sip: string) => (
                      <span key={sip} className="text-sm text-red-300 bg-red-900/30 px-2 py-1 rounded-full">
                        <SipseongBadge sip={sip} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {sajuResult.sipseongBalance.lacking.length > 0 && (
                <div className="mb-3 bg-blue-900/20 rounded-lg p-3 border border-blue-900/30">
                  <span className="text-sm text-blue-400 font-bold block mb-1">부족한 에너지 (이런 부분을 채우면 더 좋아져요!)</span>
                  <div className="flex flex-wrap gap-2">
                    {sajuResult.sipseongBalance.lacking.map((sip: string) => (
                      <span key={sip} className="text-sm text-blue-300 bg-blue-900/30 px-2 py-1 rounded-full">
                        <SipseongBadge sip={sip} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-base text-gray-300 leading-relaxed whitespace-pre-line mt-2">
                {sajuResult.sipseongBalance.psychology}
              </div>
              {/* 지장간 사령 정보 */}
              <div className="mt-4 pt-3 border-t border-gray-700/50">
                <h4 className="text-sm text-purple-400 font-bold mb-1">숨겨진 내면의 기운 (지장간)</h4>
                <p className="text-sm text-gray-500 mb-1">겉으로 안 보이지만 마음속에 숨어있는 성격이에요</p>
                <p className="text-xs text-gray-600 mb-2">지지(地支) 안에 숨어있는 글자를 지장간이라 해요. 겉 성격과 속 성격이 다를 수 있는 이유!</p>
                <div className="grid grid-cols-4 gap-2">
                  {(['시주', '일주', '월주', '연주'] as const).map((label, i) => {
                    const idx = [3, 2, 1, 0][i];
                    const jg = sajuResult.jangganSipseongs[idx];
                    const info = SIPSEONG_EASY[jg.sipseong];
                    return (
                      <div key={label} className="text-center bg-[#1a1a3a] rounded-lg p-2">
                        <div className="text-sm text-gray-400">{label}</div>
                        <div className="text-sm text-white font-bold">{jg.saryeong}({jg.jiji})</div>
                        <div className="text-sm text-amber-400">{info ? `${info.emoji} ${jg.sipseong}` : jg.sipseong}</div>
                        <div className="text-sm text-gray-500">{info?.name || ''}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 사령 심화 심리 분석 */}
            {sajuResult.saryeongAnalysis && (
              <div className="bg-[#0a0a1a] rounded-xl p-5 border border-teal-900/30">
                <h3 className="text-base text-teal-300 mb-1 font-bold">겉과 속이 다른 진짜 나</h3>
                <p className="text-sm text-gray-500 mb-3">남들이 보는 나 vs 진짜 내 마음속 성격을 비교해봐요!</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-[#1a1a3a] rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-400 mb-1">남들이 보는 나</div>
                    <SipseongBadge sip={sajuResult.saryeongAnalysis.monthSipseong} size="lg" />
                  </div>
                  <div className="bg-[#1a1a3a] rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-400 mb-1">진짜 내 속마음</div>
                    <SipseongBadge sip={sajuResult.saryeongAnalysis.saryeongSipseong} size="lg" />
                    <div className="text-sm text-gray-500 mt-1">내면의 글자: {sajuResult.saryeongAnalysis.saryeongGan}</div>
                  </div>
                </div>
                <div className="text-base text-gray-300 leading-relaxed mb-3">
                  {sajuResult.saryeongAnalysis.outerInnerAnalysis}
                </div>
                <div className="border-t border-gray-700/50 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm px-2 py-0.5 rounded ${sajuResult.saryeongAnalysis.isTouchul ? 'bg-teal-900/50 text-teal-300' : 'bg-gray-800 text-gray-400'}`}>
                      속마음 표현 {sajuResult.saryeongAnalysis.isTouchul ? '잘함 ✓' : '숨김 ✗'}
                    </span>
                    <span className="text-sm text-gray-500">{sajuResult.saryeongAnalysis.isTouchul ? '속마음이 밖으로 잘 드러나는 타입' : '속마음을 잘 드러내지 않는 타입'}</span>
                  </div>
                  <div className="text-sm text-gray-400 leading-relaxed">
                    {sajuResult.saryeongAnalysis.touchulAnalysis}
                  </div>
                  {sajuResult.saryeongAnalysis.gyeomgyeokAnalysis && (
                    <div className="mt-3 pt-2 border-t border-gray-700/50">
                      <div className="text-sm text-orange-400 leading-relaxed">
                        {sajuResult.saryeongAnalysis.gyeomgyeokAnalysis}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 야자시 표시 */}
            {sajuResult.isYajasi && (
              <div className="bg-[#0a0a1a] rounded-xl p-3 border border-indigo-900/30 text-center">
                <span className="text-sm text-indigo-300">
                  밤 11시~1시 사이 출생 — {useYajasi ? '오늘 날짜로 계산했어요' : '다음날 날짜로 계산했어요'}
                </span>
              </div>
            )}
          </div>

          {/* 궁금한 점에 대한 맞춤 답변 — 사주 기본 분석 바로 아래 */}
          {sajuAnswer && userQuestion.trim() && (
            <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-2xl p-6 border border-purple-500/40">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🔮</span>
                <h2 className="text-lg font-bold text-purple-300">"{userQuestion}" 에 대한 사주 분석</h2>
              </div>
              <p className="text-base text-gray-200 leading-relaxed whitespace-pre-line">{sajuAnswer}</p>
            </div>
          )}

          {/* 12운성 */}
          {showTwelveStages && twelveStages && (
            <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-purple-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-purple-300">나의 에너지 흐름</h3>
              <p className="text-sm text-gray-400 text-center mb-1">사주의 네 기둥이 각각 인생의 어떤 영역을 담당하는지, 그 에너지가 얼마나 강한지 보여줘요</p>
              <p className="text-sm text-gray-600 text-center mb-1">에너지가 높으면 활발하게 움직이는 시기, 낮으면 쉬면서 준비하는 시기예요</p>
              <p className="text-sm text-gray-600 text-center mb-3">에너지가 낮다고 나쁜 게 아니에요 — 조용히 쌓아가는 힘이 될 수 있어요</p>
              <div className="flex items-center justify-center gap-2 mb-6">
                <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDongsaeng}
                    onChange={e => setUseDongsaeng(e.target.checked)}
                    className="accent-purple-500 w-3.5 h-3.5"
                  />
                  동생동사(同生同死) 방식
                </label>
                <span className="text-[10px] text-gray-600" title="기본: 음생양사(陰生陽死) — 양간 순행, 음간 역행. 동생동사: 음양 구분 없이 모두 순행. 학파마다 견해가 다릅니다.">ⓘ</span>
                {sajuResult && ['갑','병','무','경','임'].includes(sajuResult.ilgan) && (
                  <span className="text-[10px] text-gray-600 ml-1">(양간은 차이 없음)</span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {(['hour', 'day', 'month', 'year'] as const).map((key) => {
                  const stage = twelveStages[key];
                  const data = TWELVE_STAGE_DATA[stage];

                  // 나이대별로 쉬운 설명 제공
                  let pillarInfo: Record<'year'|'month'|'day'|'hour', { title: string; desc: string; meaning: string }>;
                  if (sajuResult.age < 20) {
                    pillarInfo = {
                      year:  { title: '연주', desc: '태어난 해', meaning: '초년/환경' },
                      month: { title: '월주', desc: '태어난 달', meaning: '학업/재능' },
                      day:   { title: '일주', desc: '태어난 날', meaning: '자아/친구' },
                      hour:  { title: '시주', desc: '태어난 시간', meaning: '미래/잠재력' },
                    };
                  } else if (sajuResult.age < 40) {
                    pillarInfo = {
                      year:  { title: '연주', desc: '태어난 해', meaning: '사회/기반' },
                      month: { title: '월주', desc: '태어난 달', meaning: '직업/커리어' },
                      day:   { title: '일주', desc: '태어난 날', meaning: '연애/결혼' },
                      hour:  { title: '시주', desc: '태어난 시간', meaning: '목표/결실' },
                    };
                  } else {
                    pillarInfo = {
                      year:  { title: '연주', desc: '태어난 해', meaning: '사회적 지위' },
                      month: { title: '월주', desc: '태어난 달', meaning: '본업/재물' },
                      day:   { title: '일주', desc: '태어난 날', meaning: '가정/배우자' },
                      hour:  { title: '시주', desc: '태어난 시간', meaning: '자녀/노후' },
                    };
                  }
                  const info = pillarInfo[key];
                  const isExpanded = expandedStage === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setExpandedStage(isExpanded ? null : key)}
                      className={`bg-[#0a0a1a] rounded-xl p-3 border text-center cursor-pointer transition-all duration-200 ${
                        isExpanded ? 'border-purple-500/60 ring-1 ring-purple-500/30' : 'border-purple-900/20 hover:border-purple-700/40'
                      }`}
                    >
                      <div className="text-sm text-gray-400 mb-0.5">{info.title} <span className="text-[10px] text-gray-600">({info.desc})</span></div>
                      <div className="text-sm text-purple-400 mb-1">{info.meaning}</div>
                      <div className="text-2xl mb-1">{data.emoji}</div>
                      <div className="text-base font-bold text-white mb-2">{stage}({data.hanja})</div>
                      <div className="flex justify-center gap-0.5 mb-2">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-4 rounded-sm ${i < data.energy ? 'bg-purple-400' : 'bg-gray-700'}`}
                          />
                        ))}
                      </div>
                      <div className="text-sm text-gray-400">에너지 {data.energy}/10</div>
                      <div className="text-xs text-purple-300/60 mt-1">{data.keyword.join(' · ')}</div>
                      <div className="text-xs text-gray-600 mt-1">탭하여 상세보기 ▾</div>
                    </div>
                  );
                })}
              </div>

              {/* 펼침 상세 패널 */}
              {expandedStage && twelveStages && (() => {
                const stage = twelveStages[expandedStage];
                const data = TWELVE_STAGE_DATA[stage];
                const stageLabels: Record<string, string> = { year: '연주(태어난 해)', month: '월주(태어난 달)', day: '일주(태어난 날)', hour: '시주(태어난 시간)' };
                return (
                  <div className="mt-4 bg-[#0a0a1a] rounded-xl p-5 border border-purple-500/30 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-bold text-purple-300">
                        {data.emoji} {stageLabels[expandedStage]} — {stage}({data.hanja})
                      </h4>
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedStage(null); }}
                        className="text-gray-500 hover:text-gray-300 text-sm"
                      >✕ 닫기</button>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed mb-3">{data.description}</p>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-purple-400 font-semibold">🧑 성격:</span> <span className="text-gray-300">{data.personality}</span></div>
                      <div><span className="text-amber-400 font-semibold">🔮 운세:</span> <span className="text-gray-300">{data.fortune}</span></div>
                      <div><span className="text-pink-400 font-semibold">❤️ 연애:</span> <span className="text-gray-300">{data.love}</span></div>
                      <div><span className="text-blue-400 font-semibold">💼 직업:</span> <span className="text-gray-300">{data.career}</span></div>
                      <div><span className="text-green-400 font-semibold">🏥 건강:</span> <span className="text-gray-300">{data.health}</span></div>
                      <div className="pt-2 border-t border-purple-900/30">
                        <span className="text-yellow-400 font-semibold">💡 조언:</span> <span className="text-gray-200">{data.advice}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 신살 */}
          {showSinsal && sinsalList.length > 0 && (
            <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-purple-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-purple-300">운명의 별 (신살)</h3>
              <p className="text-sm text-gray-400 text-center mb-1">사주에 숨겨진 나만의 특별한 능력과 주의할 점이에요</p>
              <p className="text-xs text-gray-600 text-center mb-1">신살(神殺)은 사주 글자들의 특정 조합에서 나타나는 특수한 기운이에요</p>
              <p className="text-sm text-gray-600 text-center mb-6">초록색 = 나를 도와주는 좋은 별, 빨간색 = 조심해야 할 별, 노란색 = 상황에 따라 달라지는 별</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sinsalList.map((sinsal, idx) => (
                  <div
                    key={idx}
                    className={`bg-[#0a0a1a] rounded-xl p-4 border ${
                      sinsal.type === 'good' ? 'border-green-900/30' : sinsal.type === 'bad' ? 'border-red-900/30' : 'border-yellow-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{sinsal.emoji}</span>
                      <div>
                        <span className="font-bold text-white text-base">{sinsal.name}</span>
                        <span className="text-sm text-gray-500 ml-1">({sinsal.hanja})</span>
                      </div>
                      <span className={`ml-auto text-sm px-2 py-0.5 rounded-full ${
                        sinsal.type === 'good' ? 'bg-green-900/30 text-green-400' : sinsal.type === 'bad' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {sinsal.type === 'good' ? '길신' : sinsal.type === 'bad' ? '흉살' : '중성'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed mb-2">{sinsal.shortDesc}</p>
                    <details className="text-sm">
                      <summary className="text-purple-400 cursor-pointer hover:text-purple-300 transition-colors">상세 보기 ▾</summary>
                      <div className="mt-2 space-y-1.5 text-gray-400 leading-relaxed">
                        <p><span className="text-purple-300 font-bold">성격:</span> {sinsal.effect.personality}</p>
                        <p><span className="text-amber-300 font-bold">운세:</span> {sinsal.effect.fortune}</p>
                        <p><span className="text-pink-300 font-bold">연애:</span> {sinsal.effect.love}</p>
                        <p><span className="text-cyan-300 font-bold">직업:</span> {sinsal.effect.career}</p>
                        <p><span className="text-green-300 font-bold">조언:</span> {sinsal.effect.advice}</p>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>)}

          {/* 신년운세 + 월별 운세 */}
          {activeSection === 'newyear' && (
            <>
              {fiveYearSeun && fiveYearSeun.length > 0 && <NewYearReading seunList={fiveYearSeun} samjaeResult={samjaeResult} />}
              {monthlyFortunes.length > 0 && (
                <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-amber-900/30">
                  <h3 className="text-lg font-bold text-center mb-2 text-amber-300">📅 {new Date().getFullYear()}년 월별 운세</h3>
                  <p className="text-sm text-gray-400 text-center mb-1">매달 바뀌는 운의 흐름을 미리 확인하세요</p>
                  <p className="text-xs text-gray-600 text-center mb-4">월운(月運)은 매달 바뀌는 천간·지지가 나의 사주와 어떤 관계인지를 분석해요</p>
                  <div className="space-y-3">
                    {monthlyFortunes.map(mf => {
                      const isCurrentMonth = mf.month === new Date().getMonth() + 1;
                      return (
                        <div key={mf.month} className={`rounded-xl p-4 border ${isCurrentMonth ? 'bg-amber-900/20 border-amber-500/50' : 'bg-[#0a0a1a] border-purple-900/20'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-bold ${isCurrentMonth ? 'text-amber-300' : 'text-gray-300'}`}>{mf.month}월</span>
                              {isCurrentMonth && <span className="text-sm bg-amber-600 text-white px-2 py-0.5 rounded-full">이번 달</span>}
                              <span className="text-sm text-gray-500">{mf.cheongan}{mf.jiji}</span>
                              <span className="text-sm text-gray-500">({mf.sipseong} — {({'비견':'나와 같은 기운','겁재':'경쟁·승부','식신':'재능·표현','상관':'창의·변화','편재':'투자·사업','정재':'안정·저축','편관':'시련·도전','정관':'직장·규율','편인':'영감·독학','정인':'학업·도움'} as Record<string,string>)[mf.sipseong] || ''})</span>
                            </div>
                            <div className="flex">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={`text-sm ${i < mf.stars ? (mf.stars >= 4 ? 'text-amber-400' : mf.stars >= 3 ? 'text-yellow-500' : mf.stars >= 2 ? 'text-orange-400' : 'text-red-400') : 'text-gray-700'}`}>★</span>)}</div>
                          </div>
                          <p className={`text-base font-bold mb-1 ${isCurrentMonth ? 'text-white' : 'text-gray-300'}`}>{mf.title}</p>
                          <p className="text-sm text-gray-400">{mf.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 대운 */}
          {activeSection === 'daeun' && daeunResult && (
            <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-purple-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-purple-300">대운 (大運)</h3>
              <p className="text-sm text-gray-400 text-center mb-1">
                10년마다 바뀌는 나의 인생 시즌 | {daeunResult.direction === 'forward' ? '순행 →' : '← 역행'} | 현재 나이: {daeunResult.currentAge}세
              </p>
              <p className="text-xs text-gray-600 text-center mb-3">대운은 인생의 큰 흐름이에요. 10년 단위로 주변 환경과 기회가 바뀌는 걸 보여줍니다</p>

              {/* 용신/기신 설명 + 라벨 범례 */}
              <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-purple-900/20">
                <h4 className="text-sm font-bold text-purple-300 mb-2">📖 카드 읽는 법</h4>
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>
                    <span className="text-amber-300 font-bold">용신(用神)</span>은 내 사주에서 부족한 기운을 채워주는 <span className="text-green-400">도움이 되는 에너지</span>예요.
                    반대로 <span className="text-red-300 font-bold">기신(忌神)</span>은 이미 넘치는 기운을 더 쏠리게 만드는 <span className="text-red-400">부담이 되는 에너지</span>예요.
                  </p>
                  <p>대운에 용신이 들어오면 순풍을 타듯 일이 잘 풀리고, 기신이 들어오면 역풍처럼 더 조심해야 하는 시기가 됩니다.</p>
                  <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-purple-900/20">
                    <span className="text-green-400">🔥 좋은 시기 = 종합 점수 7점 이상</span>
                    <span className="text-red-400">⚠️ 주의 시기 = 종합 점수 4점 이하</span>
                    <span className="text-yellow-400">🔄 복합 = 용신·기신 모두 있는 대운</span>
                  </div>
                  <p className="text-gray-500 mt-1">내 용신: <span className="font-bold text-green-400">{sajuResult.yongsin}</span> | 내 기신: <span className="font-bold text-red-400">{sajuResult.gisin}</span></p>
                </div>
              </div>
              <div className="overflow-x-auto pb-2 mb-4">
                <div className="flex gap-2 min-w-max justify-center">
                  {daeunResult.pillars.filter(p => p.startAge <= 100).map((pillar, idx) => {
                    const isCurrent = daeunResult.currentDaeun === pillar;
                    const isSelected = selectedDaeunIdx === idx;
                    const stageData = TWELVE_STAGE_DATA[pillar.twelveStage];
                    // 점수 기반 라벨 판별 (score 7+ → 좋은 시기, 4- → 주의 시기, 5~6 → 보통)
                    const hasYongsin = pillar.cheonganOhaeng === sajuResult.yongsin || pillar.jijiOhaeng === sajuResult.yongsin;
                    const hasGisin = pillar.cheonganOhaeng === sajuResult.gisin || pillar.jijiOhaeng === sajuResult.gisin;
                    const yongsinGrade = hasYongsin && !hasGisin ? 'yong' : hasGisin && !hasYongsin ? 'gi' : hasYongsin && hasGisin ? 'mixed' : 'neutral';
                    const daeunGrade = pillar.score >= 7 ? 'good' : pillar.score <= 4 ? 'caution' : (yongsinGrade === 'mixed' ? 'mixed' : 'neutral');
                    const gradeLabel = { good: '🔥 좋은 시기', caution: '⚠️ 주의 시기', mixed: '🔄 복합', neutral: '' };
                    const gradeColor = { good: 'text-green-400', caution: 'text-red-400', mixed: 'text-yellow-400', neutral: 'text-gray-600' };
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDaeunIdx(isSelected ? null : idx)}
                        className={`rounded-xl p-3 text-center min-w-[80px] border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-purple-900/40 border-purple-500 ring-2 ring-purple-500/50'
                            : isSelected
                            ? 'bg-[#0a0a1a] border-purple-400/60 ring-1 ring-purple-400/30'
                            : 'bg-[#0a0a1a] border-purple-900/20 hover:border-purple-700/40'
                        }`}
                      >
                        <div className="text-sm text-gray-400 mb-1">{pillar.startAge}~{pillar.endAge}세</div>
                        <div className="flex justify-center gap-1 mb-1">
                          <span className="text-lg font-bold" style={{ color: OHAENG_COLOR[pillar.cheonganOhaeng] }}>
                            {pillar.cheongan}
                          </span>
                          <span className="text-lg font-bold" style={{ color: OHAENG_COLOR[pillar.jijiOhaeng] }}>
                            {pillar.jiji}
                          </span>
                        </div>
                        <div className="text-sm mb-1">{stageData.emoji} {pillar.twelveStage}</div>
                        <div className="text-sm text-amber-400/70 mb-0.5">{pillar.bang} · {pillar.bangSeason}</div>
                        <div className="text-sm text-gray-500 mb-1">{pillar.score}/10</div>
                        <div className="flex justify-center gap-0.5">
                          {Array.from({ length: 10 }, (_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-2 rounded-sm ${i < pillar.score ? (isCurrent ? 'bg-purple-400' : 'bg-gray-500') : 'bg-gray-800'}`}
                            />
                          ))}
                        </div>
                        {daeunGrade !== 'neutral' && (
                          <div className={`text-[10px] mt-1 ${gradeColor[daeunGrade]}`}>{gradeLabel[daeunGrade]}</div>
                        )}
                        {isCurrent && <div className="text-sm text-purple-300 mt-1 font-bold">현재</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 선택된 대운 상세 (클릭 시 펼침) */}
              {(() => {
                const visiblePillars = daeunResult.pillars.filter(p => p.startAge <= 100);
                const selectedPillar = selectedDaeunIdx !== null ? visiblePillars[selectedDaeunIdx] : daeunResult.currentDaeun;
                const isCurrentShowing = selectedDaeunIdx === null || selectedPillar === daeunResult.currentDaeun;
                if (!selectedPillar) return null;
                const selStageData = TWELVE_STAGE_DATA[selectedPillar.twelveStage];
                return (
                <div className="space-y-3">
                  {!isCurrentShowing && (
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm text-purple-300 font-bold">
                        {selectedPillar.startAge}~{selectedPillar.endAge}세 대운 ({selectedPillar.cheongan}{selectedPillar.jiji}) 상세
                      </h4>
                      <button onClick={() => setSelectedDaeunIdx(null)} className="text-xs text-gray-500 hover:text-gray-300">현재 대운으로 돌아가기</button>
                    </div>
                  )}
                  {isCurrentShowing && (
                    <p className="text-xs text-gray-500 text-center">다른 시기의 대운을 탭하면 그 시기의 상세 해석을 볼 수 있어요</p>
                  )}
                  <div className="bg-[#0a0a1a] rounded-xl p-4 border border-purple-900/20">
                    <h4 className="text-sm text-purple-300 mb-2">{isCurrentShowing ? '현재' : `${selectedPillar.startAge}~${selectedPillar.endAge}세`} 대운 해석</h4>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{selStageData.emoji}</span>
                      <div>
                        <span className="text-base font-bold text-white">{selectedPillar.cheongan}{selectedPillar.jiji}</span>
                        <span className="text-sm text-gray-400 ml-2">{selectedPillar.twelveStage} · {selectedPillar.bang} · {selectedPillar.bangSeason} · 대운점수 {selectedPillar.score}/10</span>
                      </div>
                    </div>
                    <p className="text-base text-gray-300 leading-relaxed whitespace-pre-line mb-3">
                      {selectedPillar.description}
                    </p>

                    {/* 대운 영역별 점수 */}
                    {selectedPillar.areaScores && (
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {([
                          { key: 'study' as const, label: '📚 학업', color: 'text-blue-400' },
                          { key: 'money' as const, label: '💰 재물', color: 'text-yellow-400' },
                          { key: 'love' as const, label: '❤️ 애정', color: 'text-pink-400' },
                          { key: 'health' as const, label: '🏥 건강', color: 'text-green-400' },
                          { key: 'career' as const, label: '💼 직업', color: 'text-purple-400' },
                        ]).map(({ key, label, color }) => {
                          const aScore = selectedPillar.areaScores[key];
                          return (
                            <div key={key} className="bg-[#1e1e3f]/50 rounded-lg p-2 text-center border border-purple-900/20">
                              <div className="text-xs mb-1">{label}</div>
                              <div className={`text-sm font-bold ${aScore >= 7 ? 'text-green-400' : aScore >= 4 ? color : 'text-red-400'}`}>
                                {aScore}/10
                              </div>
                              <div className="flex justify-center gap-0.5 mt-1">
                                {Array.from({ length: 10 }, (_, i) => (
                                  <div key={i} className={`w-0.5 h-1.5 rounded-sm ${i < aScore ? (aScore >= 7 ? 'bg-green-500' : aScore >= 4 ? 'bg-purple-400' : 'bg-red-500') : 'bg-gray-800'}`} />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 10년 세운 — 대운 기간 내 연도별 운세 */}
                    {sajuResult && daeunResult && (() => {
                      // daeunResult.birthYear는 양력 출생 연도 (음력→양력 변환 후)
                      const startYear = daeunResult.birthYear + selectedPillar.startAge - 1;
                      const yearSeuns = Array.from({ length: 10 }, (_, i) => {
                        const y = startYear + i;
                        const s = calculateSeun(sajuResult, y, selectedPillar);
                        return { year: y, age: selectedPillar.startAge + i, score: s.overallScore, cheongan: s.cheongan, jiji: s.jiji };
                      });

                      return (
                        <div className="bg-[#1e1e3f]/50 rounded-lg p-3 border border-purple-900/20">
                          <h5 className="text-sm text-purple-300 font-bold mb-1">📊 이 대운 기간 매년 운세</h5>
                          <p className="text-xs text-gray-500 mb-3">대운이 좋아도 세운이 나쁘면 그 해는 힘들 수 있어요</p>
                          <div className="space-y-1.5">
                            {yearSeuns.map((ys) => {
                              const pct = Math.max(5, (ys.score / 10) * 100);
                              const barColor = ys.score >= 7 ? 'bg-green-500' : ys.score >= 5 ? 'bg-purple-500' : ys.score >= 3 ? 'bg-yellow-500' : 'bg-red-500';
                              const textColor = ys.score >= 7 ? 'text-green-400' : ys.score >= 5 ? 'text-gray-300' : ys.score >= 3 ? 'text-yellow-400' : 'text-red-400';
                              const isNow = ys.year === new Date().getFullYear();
                              return (
                                <div key={ys.year} className="flex items-center gap-2">
                                  <span className={`text-xs w-20 shrink-0 ${isNow ? 'text-purple-300 font-bold' : 'text-gray-400'}`}>
                                    {ys.year} ({ys.age}세){isNow ? ' ◀' : ''}
                                  </span>
                                  <span className="text-xs text-gray-500 w-8 shrink-0">{ys.cheongan}{ys.jiji}</span>
                                  <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor} flex items-center justify-end pr-1.5`} style={{ width: `${pct}%` }}>
                                      {ys.score >= 3 && <span className="text-[10px] text-white font-bold">{ys.score}</span>}
                                    </div>
                                  </div>
                                  {ys.score < 3 && <span className="text-xs text-red-400 font-bold w-4">{ys.score}</span>}
                                  <span className={`text-xs w-10 text-right shrink-0 ${textColor}`}>
                                    {ys.score >= 8 ? '대길' : ys.score >= 6 ? '길' : ys.score >= 4 ? '평' : ys.score >= 3 ? '주의' : '흉'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="bg-[#0a0a1a] rounded-xl p-4 border border-amber-900/20">
                    <h4 className="text-sm text-amber-300 mb-1">
                      대운 방(方): {selectedPillar.bang} ({selectedPillar.bangSeason}) — 변화하는 성격
                    </h4>
                    <p className="text-xs text-gray-600 mb-2">방(方)은 동서남북 방위에요. 이 시기 대운의 방위가 가치관과 행동을 변화시켜요</p>
                    <p className="text-base text-gray-300 leading-relaxed">
                      {selectedPillar.bangPersonality}
                    </p>
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          {/* 삼재 (三災) */}
          {activeSection === 'samjae' && samjaeResult && (
            <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-red-300">🛡️ 삼재 (三災)</h3>
              <p className="text-sm text-gray-400 text-center mb-1">
                12년 주기로 3년간 이어지는 주의 기간 | {samjaeResult.groupName} 그룹
              </p>
              <p className="text-xs text-gray-600 text-center mb-4">
                삼재는 띠(연지) 기준으로 12년마다 3년 연속 찾아오는 주의 시기예요. 들삼재→눌삼재→날삼재 순서로 진행됩니다
              </p>

              {/* 현재 연도 삼재 상태 */}
              <div className={`rounded-xl p-5 mb-4 border ${
                samjaeResult.current.active
                  ? samjaeResult.current.type === '눌삼재'
                    ? 'bg-red-900/30 border-red-500/50'
                    : samjaeResult.current.type === '들삼재'
                    ? 'bg-orange-900/30 border-orange-500/50'
                    : 'bg-yellow-900/30 border-yellow-500/50'
                  : 'bg-green-900/20 border-green-800/30'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{samjaeResult.current.emoji}</span>
                  <div>
                    <h4 className={`text-base font-bold ${samjaeResult.current.active ? 'text-red-300' : 'text-green-300'}`}>
                      {new Date().getFullYear()}년: {samjaeResult.current.title}
                    </h4>
                    <p className="text-xs text-gray-400">
                      연지(띠): {sajuResult.year.jiji} | 올해 지지: {samjaeResult.current.yearJiji}
                      {samjaeResult.current.active && ` | 삼재 지지: ${samjaeResult.samjaeJiji.join('·')}`}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{samjaeResult.current.description}</p>
                {samjaeResult.current.advice && (
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-sm text-amber-300 font-bold mb-1">💡 조언</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{samjaeResult.current.advice}</p>
                  </div>
                )}
              </div>

              {/* 삼재 원리 설명 */}
              <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-purple-900/20">
                <h4 className="text-sm font-bold text-purple-300 mb-2">📖 삼재란?</h4>
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>삼재(三災)는 수재(水災)·화재(火災)·풍재(風災)의 세 가지 재난을 뜻하며, 12년 주기로 3년간 연속으로 찾아옵니다.</p>
                  <p>내 띠가 <span className="text-purple-300 font-bold">{samjaeResult.groupName}</span> 그룹이므로,
                  삼재 해당 지지는 <span className="text-red-300 font-bold">{samjaeResult.samjaeJiji.join(' · ')}</span>입니다.</p>
                  <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-purple-900/20">
                    <span className="text-orange-400">🔥 들삼재 = 삼재 시작, 조심 시작</span>
                    <span className="text-red-400">⚡ 눌삼재 = 삼재 절정, 가장 주의</span>
                    <span className="text-yellow-400">🌅 날삼재 = 삼재 마무리, 서서히 회복</span>
                  </div>
                </div>
              </div>

              {/* 향후 삼재 타임라인 */}
              {samjaeResult.upcoming.length > 0 && (
                <div className="bg-[#0a0a1a] rounded-xl p-4 border border-purple-900/20">
                  <h4 className="text-sm font-bold text-purple-300 mb-3">📅 향후 삼재 기간</h4>
                  <div className="space-y-2">
                    {samjaeResult.upcoming.map((info, idx) => (
                      <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${
                        info.active
                          ? 'bg-red-900/20 border-red-800/40'
                          : 'bg-gray-900/20 border-gray-800/30'
                      }`}>
                        <span className="text-xl">{info.emoji}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{info.year}년</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              info.type === '눌삼재' ? 'bg-red-900/50 text-red-300' :
                              info.type === '들삼재' ? 'bg-orange-900/50 text-orange-300' :
                              'bg-yellow-900/50 text-yellow-300'
                            }`}>{info.type}</span>
                            {info.active && <span className="text-xs text-red-400 font-bold">(올해!)</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{info.yearJiji}년 · {info.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 삼재 아닌 해 표시 */}
                  <div className="mt-3 pt-3 border-t border-purple-900/20">
                    <p className="text-xs text-gray-500">
                      다음 삼재 없는 기간: {(() => {
                        const lastSamjae = samjaeResult.upcoming[samjaeResult.upcoming.length - 1];
                        if (!lastSamjae) return '정보 없음';
                        const freeStart = lastSamjae.year + 1;
                        const freeEnd = freeStart + 8;
                        return `${freeStart}년~${freeEnd}년 (${freeEnd - freeStart + 1}년간 삼재 없음)`;
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* 삼재 대처법 */}
              <div className="bg-gradient-to-r from-amber-900/20 to-orange-900/10 rounded-xl p-4 mt-4 border border-amber-800/30">
                <h4 className="text-sm font-bold text-amber-300 mb-2">🧿 삼재 대처법</h4>
                <div className="space-y-1.5 text-xs text-gray-400 leading-relaxed">
                  <p>• <span className="text-amber-300">건강</span>: 무리하지 말고, 정기검진과 규칙적 생활을 유지하세요</p>
                  <p>• <span className="text-amber-300">재물</span>: 보증·투기·큰 투자는 피하고, 지출을 줄여 안전 자산을 확보하세요</p>
                  <p>• <span className="text-amber-300">대인</span>: 다툼을 피하고, 새로운 동업이나 계약은 신중히 하세요</p>
                  <p>• <span className="text-amber-300">마음</span>: 삼재는 영원하지 않습니다. 3년 후엔 9년의 좋은 운이 기다립니다</p>
                </div>
              </div>
            </div>
          )}

          {/* 5년 세운 */}
          {activeSection === 'fiveyear' && fiveYearSeun.length > 0 && (
            <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-purple-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-purple-300">5년 세운 (歲運)</h3>
              <p className="text-sm text-gray-400 text-center mb-1">
                {seunViewMode === 'future' ? '올해부터 5년간 나의 운세 변화' : '지난 5년간 나의 운세 흐름'}
              </p>
              <p className="text-xs text-gray-600 text-center mb-4">세운은 매년 바뀌는 운이에요. 대운이 계절이라면, 세운은 그 해의 날씨 같은 거예요</p>
              {/* 앞으로 5년 / 지난 5년 토글 버튼 */}
              <div className="flex justify-center gap-2 mb-6">
                <button
                  onClick={() => {
                    setSeunViewMode('past');
                    if (pastFiveYearSeun.length > 0) setSelectedSeunYear(pastFiveYearSeun[pastFiveYearSeun.length - 1].year);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                    seunViewMode === 'past'
                      ? 'bg-purple-700 text-white shadow-lg shadow-purple-900/50'
                      : 'bg-[#0a0a1a] text-gray-400 border border-purple-900/30 hover:border-purple-600/50 hover:text-purple-300'
                  }`}
                >
                  ◀ 지난 5년
                </button>
                <button
                  onClick={() => {
                    setSeunViewMode('future');
                    setSelectedSeunYear(new Date().getFullYear());
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                    seunViewMode === 'future'
                      ? 'bg-purple-700 text-white shadow-lg shadow-purple-900/50'
                      : 'bg-[#0a0a1a] text-gray-400 border border-purple-900/30 hover:border-purple-600/50 hover:text-purple-300'
                  }`}
                >
                  앞으로 5년 ▶
                </button>
              </div>
              <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-5 gap-2 min-w-[360px]">
                {(seunViewMode === 'future' ? fiveYearSeun : pastFiveYearSeun).map((seun) => {
                  const isThisYear = seun.year === new Date().getFullYear();
                  const isSelected = seun.year === selectedSeunYear;
                  const stageData = TWELVE_STAGE_DATA[seun.twelveStage];
                  const samjaeYear = samjaeResult?.upcoming.find(s => s.year === seun.year);
                  return (
                    <div
                      key={seun.year}
                      onClick={() => setSelectedSeunYear(seun.year)}
                      className={`rounded-xl p-3 text-center border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-purple-900/40 border-purple-500 ring-2 ring-purple-500/50 scale-105'
                          : 'bg-[#0a0a1a] border-purple-900/20 hover:border-purple-700/50 hover:bg-purple-900/10'
                      }`}
                    >
                      <div className={`text-base font-bold mb-1 ${isSelected ? 'text-purple-300' : 'text-gray-300'}`}>
                        {seun.year}
                      </div>
                      <div className="flex justify-center gap-0.5 mb-1">
                        <span style={{ color: OHAENG_COLOR[seun.cheonganOhaeng] }} className="font-bold">{seun.cheongan}</span>
                        <span style={{ color: OHAENG_COLOR[seun.jijiOhaeng] }} className="font-bold">{seun.jiji}</span>
                      </div>
                      <div className="text-sm text-gray-400 mb-1">{seun.animal}띠</div>
                      <div className="text-sm mb-1">{stageData.emoji}</div>
                      <div className="flex justify-center">
                        {(() => { const s = Math.max(1, Math.min(5, Math.round(seun.overallScore / 2))); const color = s >= 4 ? 'text-amber-400' : s >= 3 ? 'text-yellow-500' : s >= 2 ? 'text-orange-400' : 'text-red-400'; return Array.from({ length: 5 }).map((_, i) => <span key={i} className={`text-sm ${i < s ? color : 'text-gray-700'}`}>★</span>); })()}
                      </div>
                      <div className="text-sm text-gray-500">{seun.overallScore}/10</div>
                      <div className="text-sm text-gray-400 mt-0.5">{stageData.name}</div>
                      {samjaeYear && (
                        <div className={`text-[10px] mt-1 font-bold ${
                          samjaeYear.type === '눌삼재' ? 'text-red-400' :
                          samjaeYear.type === '들삼재' ? 'text-orange-400' : 'text-yellow-400'
                        }`}>{samjaeYear.emoji} {samjaeYear.type}</div>
                      )}
                      {isThisYear && <div className="text-sm text-purple-300 mt-1 font-bold">올해</div>}
                    </div>
                  );
                })}
              </div>
              </div>

              {/* 선택된 연도 세운 상세 */}
              {(fiveYearSeun.find(s => s.year === selectedSeunYear) || pastFiveYearSeun.find(s => s.year === selectedSeunYear)) && (
                <div className="mt-4 bg-[#0a0a1a] rounded-xl p-4 border border-purple-900/20">
                  <h4 className="text-sm text-purple-300 mb-2">{selectedSeunYear}년 운세 {selectedSeunYear === new Date().getFullYear() ? '(올해)' : selectedSeunYear < new Date().getFullYear() ? '(지난해)' : ''}</h4>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line mb-3">
                    {(fiveYearSeun.find(s => s.year === selectedSeunYear) || pastFiveYearSeun.find(s => s.year === selectedSeunYear))!.description}
                  </p>
                  {/* 특수관계(합충형파해) 메모 */}
                  {(() => {
                    const thisS = (fiveYearSeun.find(s => s.year === selectedSeunYear) || pastFiveYearSeun.find(s => s.year === selectedSeunYear))!;
                    return (thisS.specialNotes && thisS.specialNotes.length > 0) ? (
                      <div className="mb-3 space-y-1.5">
                        {thisS.specialNotes.map((note, ni) => (
                          <p key={ni} className="text-xs text-cyan-300/80 leading-relaxed whitespace-pre-line bg-cyan-900/10 rounded-lg px-3 py-2 border border-cyan-900/20">{note}</p>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {/* 가족관계(궁위) 해석 */}
                  {(() => {
                    const thisS = (fiveYearSeun.find(s => s.year === selectedSeunYear) || pastFiveYearSeun.find(s => s.year === selectedSeunYear))!;
                    return (thisS.familyNotes && thisS.familyNotes.length > 0) ? (
                      <div className="mb-3 bg-[#1a1a2e] rounded-lg p-3 border border-purple-900/20">
                        <h5 className="text-xs text-purple-300 font-bold mb-1.5">👨‍👩‍👧‍👦 가족관계·궁위 운</h5>
                        <div className="space-y-1">
                          {thisS.familyNotes.map((note, ni) => (
                            <p key={ni} className="text-xs text-gray-300 leading-relaxed">{note}</p>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    {isPremium ? (
                      <>
                        {(() => {
                          const gridAge = daeunResult?.currentAge || 30;
                          const gridMarried = sajuResult?.relationship === 'married';
                          const thisSeun = (fiveYearSeun.find(s => s.year === selectedSeunYear) || pastFiveYearSeun.find(s => s.year === selectedSeunYear))!;
                          const areas = gridAge < 20
                            ? [
                                { icon: '👫', label: '친구운', text: thisSeun.love, color: 'text-pink-400' },
                                { icon: '📚', label: '학업운', text: thisSeun.career, color: 'text-blue-400' },
                                { icon: '🎯', label: '재능/진로', text: thisSeun.money, color: 'text-amber-400' },
                                { icon: '🏥', label: '건강운', text: thisSeun.health, color: 'text-green-400' },
                              ]
                            : [
                                { icon: '❤️', label: gridMarried ? '가정운' : gridAge >= 60 ? '대인운' : '애정운', text: thisSeun.love, color: 'text-pink-400' },
                                { icon: '💰', label: gridAge >= 60 ? '자산관리' : '재물운', text: thisSeun.money, color: 'text-amber-400' },
                                { icon: '💼', label: gridAge >= 60 ? '활동운' : '직업운', text: thisSeun.career, color: 'text-blue-400' },
                                { icon: '🏥', label: '건강운', text: thisSeun.health, color: 'text-green-400' },
                              ];
                          const seunAreaScores = thisSeun.areaScores;
                          const areaKeys = gridAge < 20
                            ? ['love', 'career', 'money', 'health'] as const
                            : ['love', 'money', 'career', 'health'] as const;
                          return areas.map((a, i) => {
                            const aKey = areaKeys[i];
                            const aScore = seunAreaScores?.[aKey] ?? 0;
                            return (
                              <div key={i} className="bg-[#1e1e3f] rounded-lg p-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs ${a.color}`}>{a.icon} {a.label}</span>
                                  <span className={`text-xs font-bold ${aScore >= 7 ? 'text-green-400' : aScore >= 4 ? 'text-gray-300' : 'text-red-400'}`}>{aScore}/10</span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-gray-800 mb-1.5 overflow-hidden">
                                  <div className={`h-full rounded-full ${aScore >= 7 ? 'bg-green-500' : aScore >= 4 ? 'bg-purple-500' : 'bg-red-500'}`} style={{ width: `${aScore * 10}%` }} />
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">{a.text}</p>
                              </div>
                            );
                          });
                        })()}
                      </>
                    ) : (
                      <div className="col-span-2 bg-[#1e1e3f] rounded-lg p-3 text-center border border-amber-900/30">
                        <div className="text-amber-400 text-sm mb-1">🔒 분야별 상세 운세</div>
                        <p className="text-xs text-gray-400 mb-2">이용권을 구매하면 분야별 운세를 확인할 수 있습니다</p>
                        <button className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-800 text-white rounded-lg text-xs hover:from-amber-500 hover:to-amber-700 transition-all">
                          이용권 구매하기
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ★ 합충회합 분석 */}
          {activeSection === 'saju' && hapChungResult && hapChungResult.items.length > 0 && (
            <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-cyan-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-cyan-300">⚡ 합충회합 분석</h3>
              <p className="text-sm text-gray-400 text-center mb-1">사주 글자들이 서로 손잡거나(합) 부딪히는(충) 관계를 분석해요</p>
              <p className="text-xs text-gray-600 text-center mb-2">합(合)=서로 도와주는 관계, 충(沖)=부딪히는 관계, 회합=여러 글자가 모여 새 기운을 만드는 것</p>
              <div className="flex justify-center gap-3 mb-4">
                {hapChungResult.hapCount > 0 && (
                  <span className="text-sm px-3 py-1 rounded-full bg-green-900/30 text-green-400">합 {hapChungResult.hapCount}개</span>
                )}
                {hapChungResult.chungCount > 0 && (
                  <span className="text-sm px-3 py-1 rounded-full bg-red-900/30 text-red-400">충 {hapChungResult.chungCount}개</span>
                )}
                {hapChungResult.samhapCount > 0 && (
                  <span className="text-sm px-3 py-1 rounded-full bg-amber-900/30 text-amber-400">삼합/반합 {hapChungResult.samhapCount}개</span>
                )}
                <span className={`text-sm px-3 py-1 rounded-full ${
                  hapChungResult.overallMood === '평온' ? 'bg-blue-900/30 text-blue-300' :
                  hapChungResult.overallMood === '화합' ? 'bg-green-900/30 text-green-300' :
                  hapChungResult.overallMood === '변동' ? 'bg-yellow-900/30 text-yellow-300' :
                  'bg-red-900/30 text-red-300'
                }`}>
                  분위기: {hapChungResult.overallMood}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                {hapChungResult.items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`bg-[#0a0a1a] rounded-xl p-4 border ${
                      item.type === '천간합' ? 'border-green-900/30' :
                      item.type === '지지충' ? 'border-red-900/30' :
                      'border-amber-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm px-2 py-0.5 rounded-full font-bold ${
                        item.type === '천간합' ? 'bg-green-900/40 text-green-400' :
                        item.type === '지지충' ? 'bg-red-900/40 text-red-400' :
                        'bg-amber-900/40 text-amber-400'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-base font-bold text-white">{item.name}</span>
                      {'resultOhaeng' in item && (
                        <span className="text-sm px-2 py-0.5 rounded-full bg-purple-900/30" style={{ color: OHAENG_COLOR[item.resultOhaeng] }}>
                          → {item.resultOhaeng} 기운
                        </span>
                      )}
                    </div>
                    <p className="text-base text-gray-300 leading-relaxed mb-2">{item.easyExplanation}</p>
                    {'psychologyDetail' in item && item.psychologyDetail && (
                      <p className="text-sm text-cyan-400/80 leading-relaxed">{item.psychologyDetail}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-[#0a0a1a] rounded-xl p-4 border border-cyan-900/20">
                <h4 className="text-sm text-cyan-300 mb-2 font-bold">종합 요약</h4>
                <p className="text-base text-gray-300 leading-relaxed">{hapChungResult.summary}</p>
              </div>
            </div>
          )}

          {/* ★ 사령 심화 분석 — 유저 요청으로 숨김 처리 */}
          {activeSection === 'career' && saryeongAdvResult && (
            <div hidden>
            <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-emerald-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-emerald-300">
                {saryeongAdvResult.patternEmoji} 사령 심화 분석 — {saryeongAdvResult.nature === '길신' ? '길신 발복' : saryeongAdvResult.nature === '흉신' ? '흉신 제어' : '중성'} 패턴
              </h3>
              <p className="text-sm text-gray-400 text-center mb-4">숨겨진 내면의 사령 기운이 실제 인생에 어떤 영향을 주는지 분석해요</p>

              {/* 길신/흉신 판정 배지 */}
              <div className="flex justify-center mb-4">
                <span className={`text-base px-4 py-1.5 rounded-full font-bold ${
                  saryeongAdvResult.nature === '길신' ? 'bg-green-900/40 text-green-300 border border-green-700/50' :
                  saryeongAdvResult.nature === '흉신' ? 'bg-red-900/40 text-red-300 border border-red-700/50' :
                  'bg-gray-800 text-gray-300 border border-gray-700/50'
                }`}>
                  사령 {saryeongAdvResult.saryeongSipseong} → {saryeongAdvResult.nature}
                </span>
              </div>

              {/* 패턴 설명 */}
              <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-emerald-900/20">
                <h4 className="text-base font-bold text-emerald-300 mb-2">{saryeongAdvResult.patternTitle}</h4>
                <p className="text-base text-gray-300 leading-relaxed mb-2">{saryeongAdvResult.patternExplanation}</p>
                <p className="text-sm text-amber-400">현실 결과: {saryeongAdvResult.patternResult}</p>
              </div>

              {/* 흉신일 때 위험 신호 + 그림자 설명 */}
              {saryeongAdvResult.nature === '흉신' && (
                <>
                  {saryeongAdvResult.dangerSign && (
                    <div className="bg-red-900/20 rounded-xl p-4 mb-3 border border-red-900/30">
                      <h4 className="text-sm font-bold text-red-400 mb-1">위험 신호</h4>
                      <p className="text-sm text-red-300 leading-relaxed">{saryeongAdvResult.dangerSign}</p>
                    </div>
                  )}
                  {saryeongAdvResult.shadowExplanation && (
                    <div className="bg-purple-900/20 rounded-xl p-4 mb-3 border border-purple-900/30">
                      <h4 className="text-sm font-bold text-purple-300 mb-1">칼 융(Jung)의 그림자 통합 관점</h4>
                      <p className="text-sm text-purple-200 leading-relaxed">{saryeongAdvResult.shadowExplanation}</p>
                    </div>
                  )}
                </>
              )}

              {/* 개운법 3요소 */}
              <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-emerald-900/20">
                <h4 className="text-base font-bold text-emerald-300 mb-3">개운법 — 운명을 바꾸는 3가지 실천</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-bold text-blue-400">📚 공부/전공 추천</span>
                    <p className="text-sm text-gray-300 leading-relaxed mt-1">{saryeongAdvResult.gaewun.study}</p>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-green-400">💼 직업 환경 추천</span>
                    <p className="text-sm text-gray-300 leading-relaxed mt-1">{saryeongAdvResult.gaewun.career}</p>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-pink-400">💑 배우자 조건 추천</span>
                    <p className="text-sm text-gray-300 leading-relaxed mt-1">{saryeongAdvResult.gaewun.partner}</p>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-amber-400">✨ 일상 실천 팁</span>
                    <p className="text-sm text-gray-300 leading-relaxed mt-1">{saryeongAdvResult.gaewun.dailyTip}</p>
                  </div>
                  <div className="pt-2 border-t border-gray-700/50">
                    <span className="text-sm font-bold text-purple-400">🧠 융 그림자 통합 조언</span>
                    <p className="text-sm text-gray-300 leading-relaxed mt-1">{saryeongAdvResult.gaewun.jungShadowWork}</p>
                  </div>
                </div>
              </div>

              {/* 대운 투출 상태 */}
              {saryeongAdvResult.daeunTouchul && (
                <div className={`bg-[#0a0a1a] rounded-xl p-4 mb-4 border ${saryeongAdvResult.daeunTouchul.isTouchul ? 'border-yellow-700/50' : 'border-gray-700/30'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm px-2 py-0.5 rounded-full font-bold ${saryeongAdvResult.daeunTouchul.isTouchul ? 'bg-yellow-900/50 text-yellow-300' : 'bg-gray-800 text-gray-400'}`}>
                      대운 투출 {saryeongAdvResult.daeunTouchul.isTouchul ? 'O — 지금이 기회!' : 'X — 준비 시기'}
                    </span>
                  </div>
                  <p className="text-base text-gray-300 leading-relaxed">{saryeongAdvResult.daeunTouchul.easyExplanation}</p>
                  {saryeongAdvResult.daeunTouchul.lifeChangeStory && (
                    <p className="text-sm text-yellow-400/80 mt-2 leading-relaxed">{saryeongAdvResult.daeunTouchul.lifeChangeStory}</p>
                  )}
                </div>
              )}

              {/* 미투출 개운법 */}
              {saryeongAdvResult.mitouchulGaewun && (
                <div className="space-y-3">
                  <div className="bg-indigo-900/20 rounded-xl p-4 border border-indigo-900/30">
                    <h4 className="text-sm font-bold text-indigo-300 mb-2">은둔자의 지혜 — 아직 때가 아닌 당신에게</h4>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{saryeongAdvResult.mitouchulGaewun.hermitWisdom}</p>
                  </div>
                  <div className="bg-teal-900/20 rounded-xl p-4 border border-teal-900/30">
                    <h4 className="text-sm font-bold text-teal-300 mb-2">가능성 마인드셋</h4>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{saryeongAdvResult.mitouchulGaewun.potentialMindset}</p>
                  </div>
                </div>
              )}
            </div>
            </div>
          )}

          {/* ★ 격국 전환 (성중유패/패중유성) */}
          {activeSection === 'daeun' && gyeokgukResult && gyeokgukResult.type !== '안정' && (
            <div className={`bg-[#1e1e3f] rounded-2xl p-6 border ${
              gyeokgukResult.type === '성중유패' ? 'border-red-900/30' : 'border-green-900/30'
            }`}>
              <h3 className="text-lg font-bold text-center mb-2">
                <span className="mr-2">{gyeokgukResult.emoji}</span>
                <span className={gyeokgukResult.type === '성중유패' ? 'text-red-300' : 'text-green-300'}>
                  {gyeokgukResult.title}
                </span>
              </h3>
              <p className="text-xs text-gray-600 text-center mb-2">대운이 바뀌면서 타고난 사주의 균형이 흔들리거나 좋아지는 시기를 알려줘요</p>
              <div className="flex justify-center mb-4">
                <span className={`text-sm px-3 py-1 rounded-full font-bold ${
                  gyeokgukResult.type === '성중유패' ? 'bg-red-900/40 text-red-300' : 'bg-green-900/40 text-green-300'
                }`}>
                  {gyeokgukResult.type}
                </span>
              </div>
              <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-gray-700/30">
                <p className="text-base text-gray-300 leading-relaxed whitespace-pre-line">{gyeokgukResult.easyExplanation}</p>
              </div>
              <div className={`rounded-xl p-4 border ${
                gyeokgukResult.type === '성중유패' ? 'bg-red-900/10 border-red-900/30' : 'bg-green-900/10 border-green-900/30'
              }`}>
                <h4 className={`text-sm font-bold mb-2 ${gyeokgukResult.type === '성중유패' ? 'text-red-300' : 'text-green-300'}`}>
                  {gyeokgukResult.type === '성중유패' ? '주의 사항 & 대처법' : '기회를 잡는 조언'}
                </h4>
                <p className="text-base text-gray-300 leading-relaxed whitespace-pre-line">{gyeokgukResult.advice}</p>
              </div>
            </div>
          )}

          {/* ★ 이사운 분석 (학생에게는 표시 안 함) */}
          {activeSection === 'isa' && isaResult && (daeunResult?.currentAge || 30) >= 20 && (
            <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-emerald-900/30">
              <h3 className="text-lg font-bold text-center mb-1 text-emerald-300">🏠 이사운 분석</h3>
              <p className="text-sm text-gray-500 text-center mb-1">현재 위치에서 어느 방향으로 이사하면 좋고, 언제 가면 좋은지 알려줄게요!</p>
              <p className="text-xs text-gray-600 text-center mb-4">사주의 오행 균형과 올해 운세를 바탕으로 이사에 유리한 방향과 시기를 분석해요</p>

              {/* 올해 이사 가능 여부 */}
              <div className={`rounded-xl p-4 mb-4 border text-center ${
                isaResult.thisYearMoving.score >= 6 ? 'bg-emerald-900/20 border-emerald-500/30' :
                isaResult.thisYearMoving.score >= 4 ? 'bg-yellow-900/20 border-yellow-500/30' :
                'bg-red-900/20 border-red-500/30'
              }`}>
                <div className="text-2xl mb-1">{isaResult.thisYearMoving.emoji}</div>
                <div className={`text-lg font-bold mb-1 ${
                  isaResult.thisYearMoving.score >= 6 ? 'text-emerald-300' :
                  isaResult.thisYearMoving.score >= 4 ? 'text-yellow-300' : 'text-red-300'
                }`}>
                  올해 이사운: {isaResult.thisYearMoving.verdict} ({isaResult.thisYearMoving.score}/10)
                </div>
                <p className="text-base text-gray-300 leading-relaxed">{isaResult.thisYearMoving.advice}</p>
              </div>

              {/* 방향 나침반 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* 최고의 방향 */}
                <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-500/30">
                  <div className="text-center mb-2">
                    <span className="text-2xl">{isaResult.bestDirection.emoji}</span>
                    <div className="text-lg font-bold text-emerald-300">{isaResult.bestDirection.direction}</div>
                    <div className="text-sm text-emerald-400 font-bold">이사하면 최고!</div>
                  </div>
                  <p className="text-base text-gray-400 leading-relaxed">{isaResult.bestDirection.reason}</p>
                </div>
                {/* 절대 안 되는 방향 */}
                <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/30">
                  <div className="text-center mb-2">
                    <span className="text-2xl">{isaResult.worstDirection.emoji}</span>
                    <div className="text-lg font-bold text-red-300">{isaResult.worstDirection.direction}</div>
                    <div className="text-sm text-red-400 font-bold">절대 가면 안 돼요!</div>
                  </div>
                  <p className="text-base text-gray-400 leading-relaxed">{isaResult.worstDirection.reason}</p>
                </div>
              </div>

              {/* 보조 방향 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#0a0a1a] rounded-xl p-3 border border-emerald-900/20">
                  <div className="text-center">
                    <span className="text-lg">{isaResult.secondBestDirection.emoji}</span>
                    <div className="text-base font-bold text-emerald-400">{isaResult.secondBestDirection.direction}</div>
                    <div className="text-sm text-gray-500">두 번째로 좋은 방향</div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 text-center">{isaResult.secondBestDirection.reason}</p>
                </div>
                <div className="bg-[#0a0a1a] rounded-xl p-3 border border-orange-900/20">
                  <div className="text-center">
                    <span className="text-lg">{isaResult.cautionDirection.emoji}</span>
                    <div className="text-base font-bold text-orange-400">{isaResult.cautionDirection.direction}</div>
                    <div className="text-sm text-gray-500">주의해야 할 방향</div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 text-center">{isaResult.cautionDirection.reason}</p>
                </div>
              </div>

              {/* 상세 설명 */}
              <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-gray-700/30">
                <h4 className="text-sm text-emerald-400 font-bold mb-2">왜 {isaResult.bestDirection.direction}이 좋을까?</h4>
                <p className="text-base text-gray-300 leading-relaxed mb-3">{isaResult.bestDirection.detail}</p>
                <h4 className="text-sm text-red-400 font-bold mb-2">왜 {isaResult.worstDirection.direction}은 안 될까?</h4>
                <p className="text-base text-gray-300 leading-relaxed">{isaResult.worstDirection.detail}</p>
              </div>

              {/* 이사 시기 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-900/10 rounded-xl p-4 border border-emerald-900/30">
                  <h4 className="text-sm text-emerald-400 font-bold mb-2">이사하기 좋은 시기</h4>
                  <div className="text-center mb-2">
                    <span className="text-xl">{isaResult.bestTiming.emoji}</span>
                    <div className="text-base font-bold text-emerald-300">{isaResult.bestTiming.season}</div>
                    <div className="text-sm text-emerald-400">{isaResult.bestTiming.months.map(m => m + '월').join(', ')}</div>
                  </div>
                  <p className="text-base text-gray-400 leading-relaxed">{isaResult.bestTiming.reason}</p>
                </div>
                <div className="bg-red-900/10 rounded-xl p-4 border border-red-900/30">
                  <h4 className="text-sm text-red-400 font-bold mb-2">이사 피해야 할 시기</h4>
                  <div className="text-center mb-2">
                    <span className="text-xl">{isaResult.worstTiming.emoji}</span>
                    <div className="text-base font-bold text-red-300">{isaResult.worstTiming.season}</div>
                    <div className="text-sm text-red-400">{isaResult.worstTiming.months.map(m => m + '월').join(', ')}</div>
                  </div>
                  <p className="text-base text-gray-400 leading-relaxed">{isaResult.worstTiming.reason}</p>
                </div>
              </div>

              {/* 대운 조언 */}
              <div className="bg-gradient-to-r from-purple-900/30 to-emerald-900/30 rounded-xl p-4 mb-4 border border-purple-500/20">
                <h4 className="text-sm text-purple-300 font-bold mb-2">현재 대운으로 본 이사 조언</h4>
                <p className="text-base text-gray-300 leading-relaxed">{isaResult.daeunAdvice}</p>
              </div>

              {/* 풍수 인테리어 팁 */}
              <div className="bg-[#0a0a1a] rounded-xl p-4 border border-amber-900/20">
                <h4 className="text-sm text-amber-300 font-bold mb-3">새 집 풍수 인테리어 팁</h4>
                <div className="space-y-2">
                  {isaResult.fengShuiTips.map((tip, i) => (
                    <p key={i} className="text-base text-gray-400 leading-relaxed">{tip}</p>
                  ))}
                </div>
              </div>

              {/* 종합 한 줄 요약 */}
              <div className="mt-4 text-center">
                <p className="text-base font-bold text-emerald-300">{isaResult.summary}</p>
              </div>
            </div>
          )}

          {/* 자유질문 섹션 제거됨 */}

          {/* 인생 예측: 적합 직업, 결혼운, 재물운, 인생 타임라인 */}
          {lifePredictions && isPremium && (
            <div className="space-y-6">

              {/* 인생 타임라인 */}
              {activeSection === 'timeline' && (
              <div className="bg-[#1e1e3f] rounded-2xl p-4 sm:p-6 border border-purple-900/30">
                <h3 className="text-lg font-bold text-center mb-2 text-purple-300">나의 인생 타임라인</h3>
                <p className="text-sm text-gray-500 text-center mb-1">대운으로 보는 10년 단위 인생 흐름</p>
                <p className="text-xs text-gray-600 text-center mb-4">각 시기를 터치하면 직업·재물·건강 상세 정보를 볼 수 있어요</p>

                {/* ★ 최상단 가로 타임라인 바 */}
                {(() => {
                  const tlEvents = lifePredictions.timeline.filter(e => parseInt(e.ageRange) <= 100);
                  const currentAge = daeunResult ? daeunResult.currentAge : 0;
                  // 자동 선택: selectedTimelineIdx가 없으면 현재 시기 선택
                  const activeIdx = selectedTimelineIdx !== null ? selectedTimelineIdx : tlEvents.findIndex(e => {
                    const sa = parseInt(e.ageRange); const ea = parseInt(e.ageRange.split('~')[1]); return currentAge >= sa && currentAge <= ea;
                  });
                  const selectedEvent = activeIdx >= 0 ? tlEvents[activeIdx] : null;

                  return (
                    <>
                      {/* 가로 스크롤 타임라인 바 */}
                      <div className="overflow-x-auto pb-2 mb-4 -mx-2 px-2">
                        <div className="relative flex items-center min-w-max">
                          {/* 가로선 제거됨 */}
                          <div className="flex gap-1.5 relative z-10">
                            {tlEvents.map((event, idx) => {
                              const startAge = parseInt(event.ageRange);
                              const endAge = parseInt(event.ageRange.split('~')[1]);
                              const isCurrent = currentAge >= startAge && currentAge <= endAge;
                              const isActive = idx === activeIdx;
                              const scoreColor = event.score >= 8 ? 'from-amber-400 to-yellow-500' : event.score >= 6 ? 'from-green-400 to-emerald-500' : event.score >= 4 ? 'from-blue-400 to-cyan-500' : 'from-orange-400 to-red-500';
                              const bgColor = event.score >= 8 ? 'bg-amber-500/20 border-amber-500/50' : event.score >= 6 ? 'bg-green-500/20 border-green-500/50' : event.score >= 4 ? 'bg-blue-500/20 border-blue-500/50' : 'bg-red-500/20 border-red-500/50';
                              const nodeStars = Math.max(1, Math.min(5, event.stars || Math.round(event.score / 2)));
                              const starColor = nodeStars >= 4 ? 'text-amber-400' : nodeStars >= 3 ? 'text-yellow-500' : nodeStars >= 2 ? 'text-orange-400' : 'text-red-400';

                              return (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedTimelineIdx(idx === selectedTimelineIdx ? null : idx)}
                                  className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[72px] ${isActive ? bgColor + ' border scale-105 shadow-lg' : 'hover:bg-purple-900/20 border border-transparent'} ${isCurrent ? 'ring-2 ring-purple-400/60' : ''}`}
                                >
                                  <span className="text-xl mb-0.5">{event.icon}</span>
                                  <span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>{startAge}~{endAge}</span>
                                  {/* 별점 */}
                                  <div className="flex flex-nowrap gap-0 mt-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <span key={i} className={`text-[8px] leading-none ${i < nodeStars ? starColor : 'text-gray-700'}`}>★</span>
                                    ))}
                                  </div>
                                  {/* 점수 미니 바 */}
                                  <div className="w-10 h-1.5 rounded-full bg-gray-800 mt-1 overflow-hidden">
                                    <div className={`h-full rounded-full bg-gradient-to-r ${scoreColor}`} style={{ width: `${event.score * 10}%` }} />
                                  </div>
                                  {isCurrent && <span className="text-[9px] text-purple-300 mt-0.5 font-bold">현재</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* ★ 선택된 시기 상세 정보 */}
                      {selectedEvent && (() => {
                        const ev = selectedEvent;
                        const stars = Math.max(1, Math.min(5, ev.stars || Math.round(ev.score / 2)));
                        const scoreColor = ev.score >= 8 ? 'text-amber-400' : ev.score >= 6 ? 'text-green-400' : ev.score >= 4 ? 'text-blue-400' : 'text-red-400';
                        const scoreBg = ev.score >= 8 ? 'from-amber-500/20 to-yellow-500/10 border-amber-500/30' : ev.score >= 6 ? 'from-green-500/20 to-emerald-500/10 border-green-500/30' : ev.score >= 4 ? 'from-blue-500/20 to-cyan-500/10 border-blue-500/30' : 'from-red-500/20 to-orange-500/10 border-red-500/30';
                        const barColor = ev.score >= 8 ? 'from-amber-400 to-yellow-500' : ev.score >= 6 ? 'from-green-400 to-emerald-500' : ev.score >= 4 ? 'from-blue-400 to-cyan-500' : 'from-orange-400 to-red-500';

                        // description에서 detailParts(줄바꿈 이후) 제외한 본문만
                        const mainDesc = ev.description.split('\n')[0];

                        return (
                          <div className="space-y-3">
                            {/* 헤더: 제목 + 점수 */}
                            <div className={`bg-gradient-to-br ${scoreBg} rounded-xl p-4 border`}>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl">{ev.icon}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-bold text-white">{ev.ageRange}</span>
                                    {ev.daeunGanji && <span className="text-xs text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded">{ev.daeunGanji}대운 · {ev.stage}</span>}
                                    {ev.score >= 8 && <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">황금기</span>}
                                  </div>
                                  <div className="text-lg font-bold text-white mt-0.5">{ev.title}</div>
                                </div>
                              </div>
                              {/* 점수 바 */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-sm font-bold ${scoreColor}`}>{ev.score}/10</span>
                                <div className="flex-1 h-2 rounded-full bg-gray-800/60 overflow-hidden">
                                  <div className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`} style={{ width: `${ev.score * 10}%` }} />
                                </div>
                                <div className="flex">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span key={i} className={`text-sm ${i < stars ? (stars >= 4 ? 'text-amber-400' : stars >= 3 ? 'text-yellow-500' : 'text-orange-400') : 'text-gray-700'}`}>★</span>
                                  ))}
                                </div>
                              </div>
                              {/* 본문 설명 */}
                              <p className="text-sm text-gray-300 leading-relaxed">{mainDesc}</p>
                            </div>

                            {/* 영역별 점수 요약 바 */}
                            {ev.areaScores && (
                              <div className="grid grid-cols-5 gap-2">
                                {([
                                  { key: 'study' as const, label: '📚 학업', color: 'text-blue-400', bar: 'bg-blue-500' },
                                  { key: 'money' as const, label: '💰 재물', color: 'text-yellow-400', bar: 'bg-yellow-500' },
                                  { key: 'love' as const, label: '❤️ 애정', color: 'text-pink-400', bar: 'bg-pink-500' },
                                  { key: 'health' as const, label: '🏥 건강', color: 'text-green-400', bar: 'bg-green-500' },
                                  { key: 'career' as const, label: '💼 직업', color: 'text-purple-400', bar: 'bg-purple-500' },
                                ]).map(({ key, label, color, bar }) => {
                                  const aScore = ev.areaScores![key];
                                  return (
                                    <div key={key} className="bg-[#0a0a1a] rounded-lg p-2 text-center border border-purple-900/20">
                                      <div className="text-[10px] mb-0.5">{label}</div>
                                      <div className={`text-xs font-bold ${aScore >= 7 ? 'text-green-400' : aScore >= 4 ? color : 'text-red-400'}`}>{aScore}</div>
                                      <div className="w-full h-1 rounded-full bg-gray-800 mt-1 overflow-hidden">
                                        <div className={`h-full rounded-full ${aScore >= 7 ? 'bg-green-500' : aScore >= 4 ? bar : 'bg-red-500'}`} style={{ width: `${aScore * 10}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* ★ 영역별 2열 그리드 카드 */}
                            <div className="grid grid-cols-2 gap-2">
                              {/* 직업/학업 카드 (65세 이상은 표시 안 함) */}
                              {ev.detailCareer && parseInt(ev.ageRange) < 65 && (
                                <div className="bg-[#0a0a1a] rounded-xl p-3 border border-purple-900/20">
                                  <div className="text-xs font-bold text-purple-300 mb-1.5">{parseInt(ev.ageRange) < 20 ? '🏫 학교생활' : '💼 직업운'}</div>
                                  <p className="text-xs text-gray-400 leading-relaxed">{ev.detailCareer.replace(/^[^\s]+\s/, '')}</p>
                                </div>
                              )}
                              {/* 재물 카드 */}
                              {ev.detailWealth && (
                                <div className="bg-[#0a0a1a] rounded-xl p-3 border border-purple-900/20">
                                  <div className="text-xs font-bold text-yellow-400 mb-1.5">{parseInt(ev.ageRange) < 20 ? '📚 학업운' : '💰 재물운'}</div>
                                  <p className="text-xs text-gray-400 leading-relaxed">{ev.detailWealth.replace(/^[^\s]+\s/, '')}</p>
                                </div>
                              )}
                              {/* 부부운·가정운·애정운 카드 — 타임라인에서 제거됨 (별도 메뉴에서 확인) */}
                              {/* 건강 카드 */}
                              {ev.detailHealth && (
                                <div className="bg-[#0a0a1a] rounded-xl p-3 border border-purple-900/20">
                                  <div className="text-xs font-bold text-green-400 mb-1.5">🏥 건강운</div>
                                  <p className="text-xs text-gray-400 leading-relaxed">{ev.detailHealth.replace(/^[^\s]+\s/, '')}</p>
                                </div>
                              )}
                            </div>

                            {/* 종합 참고 (합충/오행/격국) */}
                            {ev.detailGeneral && (
                              <div className="bg-[#0a0a1a] rounded-xl p-3 border border-purple-900/20">
                                <div className="text-xs font-bold text-cyan-400 mb-1.5">📋 종합 참고</div>
                                <p className="text-xs text-gray-400 leading-relaxed">{ev.detailGeneral}</p>
                              </div>
                            )}
                            {/* 가족관계(궁위) 해석 */}
                            {ev.familyNotes && ev.familyNotes.length > 0 && (
                              <div className="bg-[#0a0a1a] rounded-xl p-3 border border-purple-900/20">
                                <div className="text-xs font-bold text-purple-300 mb-1.5">👨‍👩‍👧‍👦 가족관계·궁위 운</div>
                                <div className="space-y-1">
                                  {ev.familyNotes.map((note: string, ni: number) => (
                                    <p key={ni} className="text-xs text-gray-400 leading-relaxed">{note}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* 선택 안 된 경우 안내 */}
                      {!selectedEvent && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          위 타임라인에서 시기를 선택하면 상세 정보를 볼 수 있어요
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              )}

              {/* 적합 직업 */}
              {activeSection === 'career' && lifePredictions && isPremium && (
              <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
                <h3 className="text-lg font-bold text-center mb-2 text-purple-300">💼 나에게 맞는 직업</h3>
                <p className="text-sm text-gray-500 text-center mb-1">사주의 5가지 에너지와 성격 분석으로 찾은 나에게 딱 맞는 직업!</p>
                <p className="text-xs text-gray-600 text-center mb-4">용신(나를 돕는 기운) 오행과 십성(성격 에너지)을 바탕으로 어울리는 직업을 추천해요</p>

                <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-purple-900/20">
                  <p className="text-base text-gray-300 leading-relaxed">{lifePredictions.career.summary}</p>
                </div>

                <div className="space-y-3 mb-4">
                  {lifePredictions.career.recommendations.map((rec, idx) => (
                    <div key={idx} className="bg-[#0a0a1a] rounded-xl p-3 border border-purple-900/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-bold text-purple-300">{rec.category}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">적합도</span>
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-sm ${i < Math.round(rec.fitScore / 2) ? 'text-amber-400' : 'text-gray-700'}`}>★</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {rec.jobs.map(job => (
                          <span key={job} className="text-base px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300">{job}</span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-400">{rec.reason}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-green-900/20 rounded-lg p-3 border border-green-900/30 mb-3">
                  <p className="text-sm text-green-300">💡 {lifePredictions.career.yongsinBoost}</p>
                </div>
                <div className="bg-red-900/20 rounded-lg p-3 border border-red-900/30">
                  <p className="text-sm text-red-300">⚠️ {lifePredictions.career.warningJobs}</p>
                </div>
              </div>
              )}

              {/* 부부운 · 가정운 · 애정운 · 결혼운 · 연애운 */}
              {activeSection === 'love' && lifePredictions && isPremium && (
              <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
                {(daeunResult?.currentAge || 30) < 20 ? (
                  /* 10대: 친구관계·학교생활 */
                  <>
                    <h3 className="text-lg font-bold text-center mb-2 text-purple-300">👫 친구 관계 · 학교생활</h3>
                    <p className="text-sm text-gray-500 text-center mb-1">사주로 보는 나의 교우관계 스타일</p>
                    <p className="text-xs text-gray-600 text-center mb-4">나의 오행 성격과 용신/기신을 바탕으로 잘 맞는 친구 타입을 분석해요</p>
                    {(() => {
                      const myOh = sajuResult.day.cheonganOhaeng;
                      const monthSip = sajuResult.sipseongs.month;
                      const hourSip = sajuResult.sipseongs.hour;
                      const ilOhBal = sajuResult.ohaengBalance[myOh];
                      const yongsin = sajuResult.yongsin;
                      const gisin = sajuResult.gisin;
                      const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
                      const FRIEND_STYLE: Record<string, string> = {
                        '목': '새로운 친구를 잘 사귀고, 리더 역할을 맡는 경우가 많아요. 친구들에게 아이디어를 주는 타입!',
                        '화': '밝고 에너지 넘쳐서 인기가 많아요. 다만 감정 기복이 있을 수 있으니, 화가 날 때 한 발 물러서는 연습을 하면 더 좋은 관계를 만들 수 있어요.',
                        '토': '듬직하고 신뢰감 있는 친구예요. 주변에서 의지하는 존재! 다만 변화를 싫어해서 새로운 친구 사귀는 건 느린 편이에요.',
                        '금': '정의감이 강하고 옳고 그름이 분명해요. 친한 친구에게는 진심으로 대하지만, 맘에 안 드는 건 바로 말하는 타입이라 오해를 받을 수 있어요.',
                        '수': '관찰력이 뛰어나고 상대의 마음을 잘 읽어요. 소수의 친한 친구와 깊은 우정을 쌓는 타입이에요.',
                      };
                      // 신강/신약에 따라 친구 스타일 오버라이드
                      const SINGANG_FRIEND: Record<string, string> = {
                        '목': '자기주장이 강하고 리더십이 확실해요. 무리에서 자연스럽게 대장 역할을 맡지만, 친구들이 "너무 내 맘대로 한다"고 느낄 수 있어요.',
                        '화': '에너지가 넘치고 존재감이 압도적이에요! 어디서든 중심에 서지만, 너무 앞서나가면 친구들이 부담을 느낄 수 있어요.',
                        '토': '고집이 세고 자기 방식을 고수해요. 한번 결정하면 안 바꾸는 타입이라, 친구들이 "고집불통"이라고 느낄 수 있어요. 양보하는 연습이 필요해요!',
                        '금': '까다롭고 원칙적이라 친구 고르는 기준이 높아요. 인정한 친구에겐 의리가 확실하지만, 맘에 안 드는 애한테는 냉정할 수 있어요.',
                        '수': '독자적인 세계가 강해서 혼자 있는 걸 좋아해요. 깊이 있는 소수 친구와 잘 맞지만, 무리에 잘 안 섞이는 편이에요.',
                      };
                      const SINYAK_FRIEND: Record<string, string> = {
                        '목': '착하고 남에게 잘 맞춰주는 타입이에요. 갈등을 피하려 해서 관계가 평화롭지만, 속으로 답답할 수 있어요. "싫다"고 말하는 연습이 필요해요!',
                        '화': '따뜻하고 공감을 잘 해주지만, 에너지가 부족해서 큰 모임에서 금방 지쳐요. 소수의 편한 친구와 함께하는 게 맞아요.',
                        '토': '조용하고 남에게 피해 안 주려고 노력해요. 믿음직하지만 자기 의견을 잘 안 내서, 친구들에게 끌려다닐 수 있어요.',
                        '금': '섬세하고 예민해서 상처받기 쉬워요. 한번 마음을 열면 깊은 우정을 나누지만, 먼저 다가가는 건 어려워해요.',
                        '수': '눈치가 빠르고 친구 기분을 잘 맞춰주지만, 정작 자기 이야기는 잘 안 해요. 마음을 열면 좋은 친구를 많이 사귈 수 있어요!',
                      };
                      let friendStyle = FRIEND_STYLE[myOh];
                      if (ilOhBal >= 6) friendStyle = SINGANG_FRIEND[myOh] || friendStyle;
                      else if (ilOhBal <= 1.5) friendStyle = SINYAK_FRIEND[myOh] || friendStyle;
                      return (
                        <div className="space-y-3">
                          <div className="bg-[#0a0a1a] rounded-xl p-4 border border-purple-900/20">
                            <h4 className="text-base font-bold text-purple-300 mb-2">🎭 나의 교우관계 스타일</h4>
                            <p className="text-sm text-gray-300 leading-relaxed">{friendStyle}</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/20">
                              <h4 className="text-base font-bold text-green-300 mb-2">✅ 친구 관계에서의 장점</h4>
                              <p className="text-sm text-gray-300 leading-relaxed">
                                {monthSip === '비견' || monthSip === '겁재' ? '동갑이나 비슷한 또래와 잘 어울리고, 경쟁심이 성장의 원동력이 됩니다.' :
                                 monthSip === '식신' ? '유머 감각이 뛰어나고, 친구들을 웃게 만드는 분위기 메이커예요.' :
                                 monthSip === '상관' ? '창의적이고 재능이 많아 친구들이 멋있다고 느끼는 포인트가 있어요.' :
                                 monthSip === '정관' ? '규칙을 잘 지키고 리더십이 있어 반장이나 조장에 잘 어울려요.' :
                                 monthSip === '정인' ? '차분하고 지적이어서 공부 잘하는 친구로 인정받아요.' :
                                 '자기만의 매력이 확실해서 진정한 친구를 만들 수 있는 기운이 있어요.'}
                              </p>
                            </div>
                            <div className="bg-[#0a0a1a] rounded-xl p-4 border border-red-900/20">
                              <h4 className="text-base font-bold text-red-300 mb-2">⚠️ 주의할 점</h4>
                              <p className="text-sm text-gray-300 leading-relaxed">
                                {hourSip === '상관' ? '솔직한 게 장점이지만, 말이 너무 직설적이면 친구가 상처받을 수 있어요. 말하기 전 한번 생각!' :
                                 hourSip === '겁재' ? '경쟁심이 강해서 가끔 친구와 다툴 수 있어요. 승패보다 우정이 더 중요하다는 걸 기억하세요.' :
                                 hourSip === '편관' ? '스트레스를 받으면 예민해질 수 있어요. 힘들 때 혼자 삭이지 말고 믿을 수 있는 친구에게 이야기하세요.' :
                                 hourSip === '편인' ? '혼자만의 시간이 필요한 타입이라 친구들이 서운해할 수 있어요. 가끔은 먼저 연락해보세요!' :
                                 '큰 단점은 없지만, 기신(' + OH_KR[gisin] + ') 에너지가 강해지면 예민해질 수 있으니 그때 조심!'}
                              </p>
                            </div>
                          </div>
                          {/* 잘 맞는 친구 / 주의할 친구 (용신/기신) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-[#0a0a1a] rounded-xl p-4 border border-cyan-900/20">
                              <h4 className="text-base font-bold text-cyan-300 mb-2">💚 잘 맞는 친구 (용신 {OH_KR[yongsin]})</h4>
                              <p className="text-sm text-gray-300 leading-relaxed">
                                {OH_KR[yongsin]}({yongsin}) 기운이 강한 친구와 함께하면 공부도 잘 되고 기분도 좋아져요!
                                {yongsin === '목' ? ' 진취적이고 아이디어가 많은 친구, 같이 뭔가 새로운 걸 시작하는 친구가 딱이에요.' :
                                 yongsin === '화' ? ' 밝고 에너지 넘치는 친구, 같이 있으면 웃음이 끊이지 않는 친구가 좋아요.' :
                                 yongsin === '토' ? ' 듬직하고 약속을 잘 지키는 친구, 믿을 수 있는 단짝이 최고예요.' :
                                 yongsin === '금' ? ' 논리적이고 공부 잘하는 친구, 서로 자극을 주는 관계가 좋아요.' :
                                 ' 차분하고 깊이 있는 친구, 진지한 대화를 나눌 수 있는 친구가 좋아요.'}
                              </p>
                            </div>
                            <div className="bg-[#0a0a1a] rounded-xl p-4 border border-orange-900/20">
                              <h4 className="text-base font-bold text-orange-300 mb-2">🔥 조심할 친구 (기신 {OH_KR[gisin]})</h4>
                              <p className="text-sm text-gray-300 leading-relaxed">
                                {OH_KR[gisin]}({gisin}) 기운이 너무 강한 친구랑 오래 있으면 스트레스를 받을 수 있어요.
                                {gisin === '목' ? ' 너무 고집 세고 자기주장만 하는 친구와는 거리를 두세요.' :
                                 gisin === '화' ? ' 감정 기복이 심하고 화를 잘 내는 친구와는 적당한 거리가 필요해요.' :
                                 gisin === '토' ? ' 너무 느리고 변화를 싫어하는 친구와는 답답할 수 있어요.' :
                                 gisin === '금' ? ' 너무 비판적이고 까다로운 친구와는 자존감이 떨어질 수 있어요.' :
                                 ' 약속을 잘 안 지키고 변덕스러운 친구와는 거리를 두세요.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (daeunResult?.currentAge || 30) >= 50 && sajuResult.relationship !== 'married' ? (
                  /* 50대 이상 미혼: 인생 후반 대인관계 조언 */
                  <>
                    <h3 className="text-lg font-bold text-center mb-2 text-purple-300">🤝 인생 후반 인간관계</h3>
                    <p className="text-sm text-gray-500 text-center mb-1">사주로 보는 나의 인간관계 방향과 동반자</p>
                    <p className="text-xs text-gray-600 text-center mb-4">일주(태어난 날)의 배우자궁과 용신 기운으로 좋은 인연의 방향을 분석해요</p>
                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">🌿 인간관계 스타일</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.partnerType}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">💛 좋은 동반자/인연</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.meetingAdvice}</p>
                      </div>
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">🏠 삶의 안정 조언</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.marriageAdvice}</p>
                      </div>
                    </div>
                  </>
                ) : (
                <>
                  {sajuResult.relationship === 'married' && (daeunResult?.currentAge || 30) >= 60 ? (
                  /* 60세 이상 기혼: 가족 화합 · 노후 동반자 관점 */
                  <>
                    <h3 className="text-lg font-bold text-center mb-2 text-purple-300">🏠 가족 화합 · 노후 생활</h3>
                    <p className="text-sm text-gray-500 text-center mb-1">오래 함께한 인연을 소중히, 건강하게 나이 드는 법</p>
                    <p className="text-xs text-gray-600 text-center mb-4">시주(태어난 시간)의 자녀궁과 용신 기운으로 노후 가족관계를 분석해요</p>

                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">🤝 부부 화합 · 함께 나이 드는 법</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        이 시기에 가장 중요한 것은 서로의 건강을 챙기고, 함께하는 시간의 질을 높이는 것입니다.
                        용신({({'목':'나무','화':'불','토':'흙','금':'쇠','수':'물'} as Record<string,string>)[sajuResult.yongsin]}) 기운을 활용해 {sajuResult.yongsin === '목' ? '함께 산책이나 텃밭 가꾸기' : sajuResult.yongsin === '화' ? '같이 여행이나 문화생활 즐기기' : sajuResult.yongsin === '토' ? '규칙적인 식사와 편안한 가정 루틴 만들기' : sajuResult.yongsin === '금' ? '각자의 시간을 존중하되 정기적인 대화 시간 갖기' : '감정을 솔직하게 나누고 서로 이해하는 시간 갖기'}를 추천합니다.
                      </p>
                    </div>

                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">👨‍👩‍👧‍👦 자녀 · 가족 관계</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {sajuResult.sipseongs.hour === '식신' ? '자녀와 좋은 인연입니다. 자녀가 효도하고 노후를 함께할 가능성이 높습니다.' :
                         sajuResult.sipseongs.hour === '상관' ? '자녀와 의견 충돌이 있을 수 있지만, 서로의 개성을 인정하면 좋은 관계를 유지할 수 있습니다.' :
                         '자녀와의 관계는 대체로 원만합니다. 먼저 연락하고 관심을 표현하면 더 가까워집니다.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">🏠 노후 생활 조언</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          건강을 최우선으로 삼고, 무리한 활동은 피하세요. 배우자와 서로의 건강을 챙기며 편안한 일상을 만들어가는 것이 가장 현명합니다.
                        </p>
                      </div>
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">💝 관계 유지 조언</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          기신({({'목':'나무','화':'불','토':'흙','금':'쇠','수':'물'} as Record<string,string>)[sajuResult.gisin]}) 에너지가 과해지면 불필요한 갈등이 생길 수 있습니다. 사소한 것에 서로 양보하는 마음을 가지세요.
                        </p>
                      </div>
                    </div>
                  </>
                ) : sajuResult.relationship === 'married' ? (
                  <>
                    <h3 className="text-lg font-bold text-center mb-2 text-purple-300">💍 부부운 · 가정운</h3>
                    <p className="text-sm text-gray-500 text-center mb-1">사주 분석 기반 배우자 궁합 & 가정 안정도</p>
                    <p className="text-xs text-gray-600 text-center mb-4">일지(배우자궁)와 12운성, 대운의 충/합으로 부부 관계의 흐름을 분석해요</p>

                    {/* 배우자 궁합 */}
                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">👫 {sajuResult.gender === 'male' ? '아내와의 궁합' : '남편과의 궁합'} 분석</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.partnerType}</p>
                    </div>

                    {/* 부부 갈등 주의 시기 */}
                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">⚠️ 부부 갈등 주의 시기</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {(() => {
                          const cautionPeriods: string[] = [];
                          if (daeunResult) {
                            for (const p of daeunResult.pillars) {
                              if (['목욕', '쇠', '병', '사'].includes(p.twelveStage) && p.startAge <= 100) {
                                cautionPeriods.push(`${p.startAge}~${p.startAge + 9}세 (${p.cheongan}${p.jiji}, ${p.twelveStage}운)`);
                              }
                            }
                          }
                          const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
                          return cautionPeriods.length > 0
                            ? `부부 갈등이 심해지기 쉬운 시기: ${cautionPeriods.join(', ')}. 이 시기에는 배우자와의 소통을 더 의식적으로 늘리고, 기신(${OH_KR[sajuResult.gisin]}) 에너지가 과해지지 않도록 주의하세요.`
                            : `대운상 특별히 위험한 갈등 시기는 보이지 않습니다. 다만 기신(${OH_KR[sajuResult.gisin]}) 에너지가 강해지는 시기에는 의식적으로 배우자에게 양보하세요.`;
                        })()}
                      </p>
                    </div>

                    {/* 가정 안정 & 결혼 생활 조언 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">🏠 가정 안정 조언</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          용신({({'목':'나무','화':'불','토':'흙','금':'쇠','수':'물'} as Record<string,string>)[sajuResult.yongsin]}) 기운을 활용하면 가정이 안정됩니다. {sajuResult.yongsin === '목' ? '함께 자연 속 산책이나 새로운 취미를 시작하세요.' : sajuResult.yongsin === '화' ? '부부가 함께 활동적인 취미(여행, 운동)를 즐기세요.' : sajuResult.yongsin === '토' ? '가정 내 안정적인 루틴과 가족 식사 시간을 만드세요.' : sajuResult.yongsin === '금' ? '서로의 시간과 공간을 존중하되, 정기적인 대화 시간을 가지세요.' : '감정을 솔직하게 나누고, 서로의 내면을 이해하려 노력하세요.'}
                        </p>
                      </div>
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">💝 결혼 생활 조언</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.marriageAdvice}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-bold text-center mb-2 text-purple-300">
                      {sajuResult.relationship === 'dating' ? '💕 애정운 · 연애운' : '💍 결혼운 · 애정운'}
                    </h3>
                    <p className="text-sm text-gray-500 text-center mb-1">
                      {sajuResult.relationship === 'dating'
                        ? '사주 분석 기반 현재 연애 흐름 & 관계 발전 가능성'
                        : `대운 분석 기반 결혼 시기 & ${sajuResult.gender === 'male' ? '아내' : '남편'} 유형`}
                    </p>
                    <p className="text-xs text-gray-600 text-center mb-4">
                      {sajuResult.relationship === 'dating'
                        ? '일지(배우자궁)와 대운 흐름으로 현재 연애의 발전 방향과 결혼 가능성을 분석해요'
                        : '일지(배우자궁)와 대운 흐름, 결혼성(정관/정재) 유무를 종합해서 결혼 시기와 배우자 유형을 분석해요'}
                    </p>

                    {/* 애정운 요약 (연애 중일 때) */}
                    {sajuResult.relationship === 'dating' && (
                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">💕 현재 애정운 흐름</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {(() => {
                          const curDaeun = daeunResult?.currentDaeun;
                          const stage = curDaeun?.twelveStage || '관대';
                          const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
                          const yongOh = OH_KR[sajuResult.yongsin] || sajuResult.yongsin;
                          const stageMsg: Record<string, string> = {
                            '장생': '새로운 시작의 에너지가 있어, 관계가 신선하게 발전할 수 있는 시기예요.',
                            '목욕': '감정의 변화가 많은 시기로, 서로의 진심을 확인하는 과정이 필요해요.',
                            '관대': '관계가 안정되고 서로를 더 깊이 이해하게 되는 좋은 시기예요.',
                            '건록': '자립 에너지가 강해 각자의 삶도 중시하면서 건강한 관계를 유지할 수 있어요.',
                            '제왕': '관계의 에너지가 최고조! 결혼으로 발전할 가능성이 높은 시기예요.',
                            '쇠': '관계의 열정이 조금 식을 수 있어요. 의식적으로 데이트 시간을 만드세요.',
                            '병': '관계에 권태기가 올 수 있어요. 새로운 활동을 함께하면 극복할 수 있어요.',
                            '사': '관계의 전환점이에요. 진지한 대화로 미래 방향을 정하는 것이 좋아요.',
                            '묘': '내면을 돌아보는 시기로, 관계의 본질을 깊이 생각하게 돼요.',
                            '절': '관계의 큰 변화가 올 수 있어요. 이별이든 결합이든 중요한 결정의 시기예요.',
                            '태': '새로운 가능성이 잉태되는 시기로, 관계의 다음 단계를 준비하세요.',
                            '양': '서서히 관계가 성장하는 시기로, 조급하지 않게 자연스러운 흐름을 따르세요.',
                          };
                          return `현재 대운 12운성 "${stage}" — ${stageMsg[stage] || '관계의 흐름을 잘 살피세요.'} 용신(${yongOh}) 기운을 활용한 데이트가 관계 발전에 도움이 돼요.`;
                        })()}
                      </p>
                    </div>
                    )}

                    {/* 결혼 시기 */}
                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">
                        {sajuResult.relationship === 'dating' ? '🗓️ 결혼으로 발전할 수 있는 시기' : '🗓️ 결혼운이 들어오는 시기'}
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {lifePredictions.marriage.bestAges.map(age => {
                          const currentAge = daeunResult ? daeunResult.currentAge : 0;
                          const isCurrent = Math.abs(age - currentAge) <= 1;
                          return (
                            <span key={age} className={`text-base px-3 py-1 rounded-full font-bold ${isCurrent ? 'bg-pink-600 text-white' : 'bg-pink-900/30 text-pink-300'}`}>
                              {age}세{isCurrent ? ' (지금!)' : ''}
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.bestPeriodDesc}</p>
                    </div>

                    {/* 배우자 유형 */}
                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-pink-900/20">
                      <h4 className="text-base font-bold text-pink-300 mb-2">👤 나와 잘 맞는 {sajuResult.gender === 'male' ? '아내' : '남편'} 유형</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.partnerType}</p>
                    </div>

                    {/* 만남 & 결혼 조언 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">📍 좋은 인연을 만나려면</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.meetingAdvice}</p>
                      </div>
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-pink-900/20">
                        <h4 className="text-base font-bold text-pink-300 mb-2">💝 결혼 생활 조언</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.marriage.marriageAdvice}</p>
                      </div>
                    </div>
                  </>
                )}
                </>
                )}
              </div>
              )}

              {/* 재물운 — 나이별 분기 */}
              {activeSection === 'wealth' && lifePredictions && isPremium && (
              <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
                {(daeunResult?.currentAge || 30) < 20 ? (
                  /* 학생: 용돈/경제관념/미래 진로와 연결 */
                  <>
                    <h3 className="text-lg font-bold text-center mb-2 text-purple-300">🎯 나의 재능 · 미래 진로</h3>
                    <p className="text-sm text-gray-500 text-center mb-4">사주로 보는 나의 숨은 재능과 어울리는 분야</p>

                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-amber-900/20">
                      <h4 className="text-base font-bold text-amber-300 mb-2">💡 나의 타고난 재능</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {sajuResult.day.cheonganOhaeng === '목' ? '성장과 도전을 좋아하는 개척자 기질! 새로운 아이디어를 내고 프로젝트를 시작하는 데 재능이 있어요. 리더십이 돋보입니다.' :
                         sajuResult.day.cheonganOhaeng === '화' ? '표현력과 열정이 넘치는 엔터테이너 기질! 무대, 발표, 창작 등에서 빛나는 재능이 있어요. 사람들의 시선을 끄는 매력이 있습니다.' :
                         sajuResult.day.cheonganOhaeng === '토' ? '꾸준함과 신뢰감이 장점인 관리자 기질! 한번 시작하면 끝까지 하는 끈기가 있고, 사람들이 의지하는 존재예요.' :
                         sajuResult.day.cheonganOhaeng === '금' ? '분석력과 논리가 뛰어난 전략가 기질! 수학, 과학, 프로그래밍 등 논리적 분야에서 두각을 나타내요.' :
                         '직관력과 창의성이 뛰어난 예술가 기질! 감성적 표현, 글쓰기, 음악, 미술 등에서 남다른 재능을 보여줍니다.'}
                      </p>
                    </div>

                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-amber-900/20">
                      <h4 className="text-base font-bold text-amber-300 mb-2">🚀 커서 잘 맞는 분야 TOP 3</h4>
                      {lifePredictions.career.recommendations.slice(0, 3).map((rec, i) => (
                        <div key={i} className="mb-2">
                          <span className="text-base text-amber-300 font-bold">{i + 1}. {rec.category}</span>
                          <span className="text-sm text-gray-400 ml-2">적합도 {rec.fitScore}/10</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rec.jobs.slice(0, 3).map(job => (
                              <span key={job} className="text-sm px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-300">{job}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-[#0a0a1a] rounded-xl p-4 border border-amber-900/20">
                      <h4 className="text-base font-bold text-amber-300 mb-2">💰 경제 감각 (커서의 돈복)</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        지금은 돈보다 실력을 쌓을 때! 하지만 미래의 재물 유형을 미리 알아두면 좋아요. {lifePredictions.wealth.wealthType.split('.')[0]}. 커서 돈을 잘 벌려면 용돈 관리부터 시작하세요!
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                  <h3 className="text-lg font-bold text-center mb-2 text-purple-300">💰 재물운 · 돈 관리</h3>
                    <p className="text-sm text-gray-500 text-center mb-4">사주로 보는 나의 돈 유형과 {(daeunResult?.currentAge || 30) >= 50 ? '노후 자산 관리' : '부자 되는 시기'}</p>

                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-amber-900/20">
                      <h4 className="text-base font-bold text-amber-300 mb-2">📈 {(daeunResult?.currentAge || 30) >= 50 ? '재물 안정 시기' : '재물운이 강한 시기'}</h4>
                      {(() => {
                        const myAge = daeunResult?.currentAge || 30;
                        const future = lifePredictions.wealth.peakAges.filter((p: string) => { const m = p.match(/(\d+)/); return m ? parseInt(m[1]) >= myAge - 2 : true; });
                        const past = lifePredictions.wealth.peakAges.filter((p: string) => { const m = p.match(/(\d+)/); return m ? parseInt(m[1]) < myAge - 2 : false; });
                        return (
                          <>
                            {future.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {future.map((period: string, i: number) => (
                                  <span key={i} className="text-base px-3 py-1 rounded-full bg-amber-900/30 text-amber-300 font-bold">{period}</span>
                                ))}
                              </div>
                            )}
                            {past.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span className="text-sm text-gray-500">지난 시기:</span>
                                {past.map((period: string, i: number) => (
                                  <span key={i} className="text-sm px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">{period}</span>
                                ))}
                              </div>
                            )}
                            {future.length === 0 && past.length > 0 && (
                              <p className="text-sm text-amber-400 mt-1">재물 황금기가 지났지만, 앞으로의 대운에서 새로운 기회가 찾아옵니다!</p>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="bg-[#0a0a1a] rounded-xl p-4 mb-4 border border-amber-900/20">
                      <h4 className="text-base font-bold text-amber-300 mb-2">💎 나의 재물 유형</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.wealth.wealthType}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/20">
                        <h4 className="text-base font-bold text-green-300 mb-2">📊 {(daeunResult?.currentAge || 30) >= 50 ? '자산 관리 조언' : '투자 조언'}</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.wealth.investmentAdvice}</p>
                      </div>
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-red-900/20">
                        <h4 className="text-base font-bold text-red-300 mb-2">⚠️ 지출 주의</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{lifePredictions.wealth.spendingWarning}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              )}

              {/* 건강운 · 체질 */}
              {activeSection === 'health' && sajuResult && daeunResult && (
              <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
                <h3 className="text-lg font-bold text-center mb-2 text-green-300">🏥 건강운 · 체질 분석</h3>
                <p className="text-sm text-gray-500 text-center mb-4">사주 오행의 균형으로 보는 건강 체질과 관리법</p>

                {(() => {
                  const healthData = analyzeHealthForecast(sajuResult, daeunResult);
                  const weakOh = sajuResult.weakestOhaeng;
                  const dominantOh = sajuResult.dominantOhaeng;
                  const WEAK_ORGAN: Record<string, string> = {
                    '목': '간, 담낭, 눈, 근육, 손발톱',
                    '화': '심장, 소장, 혀, 혈관, 혈압',
                    '토': '위장, 비장, 입술, 소화기관',
                    '금': '폐, 대장, 코, 피부, 호흡기',
                    '수': '신장, 방광, 귀, 뼈, 허리',
                  };
                  const EXCESS_ISSUE: Record<string, string> = {
                    '목': '간 기운이 과다하면 화를 잘 내고, 두통·편두통이 잦으며, 근육 경련이 자주 발생할 수 있습니다. 🧠 정신적으로는 분노 조절이 어렵고 짜증·과민반응이 심해집니다.',
                    '화': '화 기운이 과다하면 가슴이 답답하고, 불면증·불안감이 심하며, 혈압이 높아질 수 있습니다. 🧠 정신적으로는 초조·공황·과도한 흥분 상태가 지속될 수 있습니다.',
                    '토': '토 기운이 과다하면 소화불량·더부룩함이 잦고, 체중이 쉽게 늘며, 무기력해질 수 있습니다. 🧠 정신적으로는 걱정·강박·같은 생각의 반복이 심해질 수 있습니다.',
                    '금': '금 기운이 과다하면 피부가 건조하고, 알레르기가 잦으며, 유연성이 부족할 수 있습니다. 🧠 정신적으로는 슬픔·비관적 사고·완벽주의 스트레스가 심해집니다.',
                    '수': '수 기운이 과다하면 몸이 잘 붓고, 하체가 차가우며, 호르몬 변동이 심합니다. 🧠 정신적으로는 우울증·감정 과민·불면증에 취약해집니다.',
                  };
                  // 오행별 정신건강 경향
                  const MENTAL_TENDENCY: Record<string, string> = {
                    '목': '🧠 목(木) 부족 → 우울감·의욕 저하·무기력증 경향. 목은 생장의 기운으로, 부족하면 삶의 추진력이 떨어집니다. 산림욕·규칙적 야외활동·충분한 수면이 도움됩니다.',
                    '화': '🧠 화(火) 부족 → 불안·공황·대인기피 경향. 화는 기쁨의 기운으로, 부족하면 사회적 관계가 위축됩니다. 명상·요가·복식호흡·따뜻한 환경이 도움됩니다.',
                    '토': '🧠 토(土) 부족 → 걱정·강박·불안정한 사고 경향. 토는 중심의 기운으로, 부족하면 마음의 안정이 흔들립니다. 저널링·산책·규칙적 생활 패턴이 도움됩니다.',
                    '금': '🧠 금(金) 부족 → 슬픔·비관·결단력 부족 경향. 금은 결단의 기운으로, 부족하면 우유부단하고 슬퍼집니다. 사회적 교류·취미활동·호흡 운동이 도움됩니다.',
                    '수': '🧠 수(水) 부족 → 공포·두려움·위축감 경향. 수는 지혜의 기운으로, 부족하면 겁이 많아집니다. 작은 성취감 쌓기·족욕·따뜻한 환경이 도움됩니다.',
                  };
                  const OHAENG_FOOD: Record<string, string> = {
                    '목': '🥬 신맛 음식: 식초, 레몬, 매실, 유자, 감귤류, 오미자 / 초록색 채소, 녹즙',
                    '화': '☕ 쓴맛 음식: 쑥, 더덕, 도라지, 여주, 다크초콜릿 / 🍅 붉은 식재료: 토마토, 팥, 대추, 석류',
                    '토': '🍯 단맛 음식: 꿀, 고구마, 호박, 대추, 밤, 잣, 찹쌀, 감 / 잡곡밥, 규칙적 식사',
                    '금': '🌶️ 매운맛 음식: 고추, 생강, 마늘, 양파, 후추 / 흰색 식재료: 도라지, 연근, 배',
                    '수': '🧂 짠맛 음식: 미역, 다시마, 김, 해조류, 검은콩, 흑미 / 충분한 수분 섭취',
                  };
                  const OHAENG_EXERCISE: Record<string, string> = {
                    '목': '🌲 산림욕, 등산, 스트레칭, 요가 — 나무(목)의 기운을 받으세요',
                    '화': '🏃 유산소 운동, 달리기, 댄스 — 심장을 뛰게 해 화 기운을 순환시키세요',
                    '토': '🧘 걷기, 맨발 걷기, 필라테스 — 대지(토)의 안정적 기운과 연결하세요',
                    '금': '🫁 호흡 명상, 수영, 복식호흡 — 폐(금)를 강화하는 운동이 좋습니다',
                    '수': '🏊 수영, 족욕, 반신욕 — 수(물) 기운과 직접 접촉하세요',
                  };

                  return (
                    <div className="space-y-4">
                      {/* 체질 요약 */}
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/30">
                        <h4 className="text-base font-bold text-green-400 mb-2">📊 오행 체질 분석</h4>
                        {weakOh && (
                          <div className="mb-3">
                            <p className="text-sm text-gray-300 mb-1">
                              <span className="text-red-400 font-bold">부족한 오행: {weakOh}({WEAK_ORGAN[weakOh] || ''})</span>
                            </p>
                            <p className="text-sm text-gray-400">
                              {weakOh} 기운이 부족하면 {WEAK_ORGAN[weakOh]} 부위가 약해질 수 있습니다. 평소 해당 장기 관련 증상에 주의하세요.
                            </p>
                          </div>
                        )}
                        {dominantOh && dominantOh !== weakOh && (
                          <div>
                            <p className="text-sm text-gray-300 mb-1">
                              <span className="text-amber-400 font-bold">과다한 오행: {dominantOh}</span>
                            </p>
                            <p className="text-sm text-gray-400">{EXCESS_ISSUE[dominantOh] || ''}</p>
                          </div>
                        )}
                      </div>

                      {/* 건강 예보 (analyzeHealthForecast 결과) */}
                      {healthData && (
                        <>
                          <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/30">
                            <h4 className="text-base font-bold text-green-400 mb-2">🔍 사주로 본 건강 취약점</h4>
                            <p className="text-sm text-gray-300 whitespace-pre-line">{healthData.cause}</p>
                          </div>

                          {healthData.currentStatus && (
                            <div className="bg-[#0a0a1a] rounded-xl p-4 border border-blue-900/30">
                              <h4 className="text-base font-bold text-blue-400 mb-2">📍 현재 대운의 건강 상태</h4>
                              <p className="text-sm text-gray-300">{healthData.currentStatus}</p>
                            </div>
                          )}

                          {healthData.recoveryPeriods.length > 0 && (
                            <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/30">
                              <h4 className="text-base font-bold text-green-400 mb-3">📅 향후 건강 흐름 (대운별)</h4>
                              <div className="space-y-3">
                                {healthData.recoveryPeriods.map((rp, idx) => (
                                  <div key={idx} className={`p-3 rounded-lg border ${
                                    rp.level === 'good' ? 'border-green-800/50 bg-green-900/20' :
                                    rp.level === 'bad' ? 'border-red-800/50 bg-red-900/20' :
                                    'border-gray-700/50 bg-gray-900/20'
                                  }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-bold">{rp.level === 'good' ? '🟢' : rp.level === 'bad' ? '🔴' : '🟡'}</span>
                                      <span className="text-sm font-bold text-white">{rp.period}</span>
                                    </div>
                                    <p className="text-sm text-gray-300">{rp.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/20 rounded-xl p-4 border border-green-800/30">
                            <p className="text-sm text-green-300">{healthData.overallAdvice}</p>
                          </div>
                        </>
                      )}

                      {!healthData && (
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/30">
                          <p className="text-sm text-green-400 mb-2">✅ 오행 균형이 양호합니다</p>
                          <p className="text-sm text-gray-400">사주에서 특별히 심각하게 부족한 오행이 없어, 기본 체질은 건강한 편입니다. 일반적인 건강 관리를 잘 하시면 됩니다.</p>
                        </div>
                      )}

                      {/* 정신건강 체질 분석 */}
                      {weakOh && (
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-indigo-900/30">
                          <h4 className="text-base font-bold text-indigo-400 mb-2">🧠 정신건강 체질 분석</h4>
                          <p className="text-sm text-gray-300 whitespace-pre-line">{MENTAL_TENDENCY[weakOh]}</p>
                          {dominantOh && dominantOh !== weakOh && (
                            <p className="text-sm text-gray-400 mt-2">
                              {dominantOh === '목' && '※ 목 과다 → 분노 조절 어려움·과민반응 경향도 함께 나타날 수 있습니다.'}
                              {dominantOh === '화' && '※ 화 과다 → 초조·과도한 흥분·불면 경향도 함께 나타날 수 있습니다.'}
                              {dominantOh === '토' && '※ 토 과다 → 걱정·강박·반복적 불안 경향도 함께 나타날 수 있습니다.'}
                              {dominantOh === '금' && '※ 금 과다 → 완벽주의·자기비판·만성 스트레스 경향도 함께 나타날 수 있습니다.'}
                              {dominantOh === '수' && '※ 수 과다 → 우울·감정 과민·불면 경향도 함께 나타날 수 있습니다.'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* 보충 음식/운동 */}
                      {weakOh && (
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/30">
                          <h4 className="text-base font-bold text-green-400 mb-3">💊 {weakOh} 기운 보충법</h4>
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-bold text-amber-300 mb-1">추천 음식</p>
                              <p className="text-sm text-gray-300">{OHAENG_FOOD[weakOh]}</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-cyan-300 mb-1">추천 운동</p>
                              <p className="text-sm text-gray-300">{OHAENG_EXERCISE[weakOh]}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-gray-600 text-center mt-2">
                        ※ 사주 건강 분석은 체질적 경향성을 참고하는 것이며, 실제 진단이나 치료를 대체하지 않습니다.
                      </p>
                    </div>
                  );
                })()}
              </div>
              )}

              {/* 대인관계 · 인간관계 */}
              {activeSection === 'relation' && (
              <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
                <h3 className="text-lg font-bold text-center mb-2 text-purple-300">🤝 대인관계 · 인간관계</h3>
                <p className="text-sm text-gray-500 text-center mb-4">사주로 보는 나의 관계 패턴과 조언</p>

                {sajuResult && (() => {
                  const ilOh = sajuResult.day.cheonganOhaeng;
                  const yongsin = sajuResult.yongsin;
                  const gisin = sajuResult.gisin;
                  const monthSip = sajuResult.sipseongs.month;
                  const hourSip = sajuResult.sipseongs.hour;
                  const ilOhaengBal = sajuResult.ohaengBalance[ilOh];
                  const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };

                  const RELATION_PATTERNS: Record<string, { style: string; strength: string; weakness: string; futureAdvice: string }> = {
                    '목': {
                      style: '진취적이고 정의감이 강하며, 새로운 사람에게 먼저 다가가는 편입니다. 리더 역할을 자연스럽게 맡고, 주변을 이끌어가는 힘이 있습니다.',
                      strength: '의리가 있고 약속을 잘 지킵니다. 어려운 친구를 그냥 지나치지 못하며, 인맥이 넓은 편입니다. 후배나 아랫사람에게 인기가 많습니다.',
                      weakness: '고집이 세서 한번 결정하면 남의 말을 잘 안 듣습니다. 직설적인 표현이 상대에게 상처를 줄 수 있습니다. 참을성이 부족할 때가 있어요.',
                      futureAdvice: '나이가 들수록 인맥이 큰 자산이 됩니다. 지금 만나는 사람들을 소홀히 하지 마세요. 특히 비즈니스 인맥이 노후에 큰 도움이 됩니다.',
                    },
                    '화': {
                      style: '밝고 사교적이며, 모임에서 분위기를 주도하는 타입입니다. 말재주가 좋고 표현력이 풍부해 사람들이 자연스럽게 모여듭니다.',
                      strength: '첫인상이 좋고 호감을 쉽게 얻습니다. 어떤 자리에서든 분위기 메이커 역할을 하며, 네트워킹 능력이 뛰어납니다.',
                      weakness: '감정이 격해지면 말실수를 하기 쉽습니다. 싫증을 잘 내서 관계를 오래 유지하는 데 노력이 필요합니다. 깊이 있는 관계보다 넓은 관계를 선호하는 경향이 있어요.',
                      futureAdvice: '나이가 들수록 "소수의 깊은 관계"가 더 소중해집니다. 지금부터 정말 중요한 사람 5명을 정해서 꾸준히 관계를 유지하세요.',
                    },
                    '토': {
                      style: '듬직하고 포용력이 있어, 주변 사람들이 편안함을 느낍니다. 갈등 상황에서 중재자 역할을 잘 하며, 신뢰를 쉽게 얻습니다.',
                      strength: '한번 맺은 관계를 오래 유지하는 끈기가 있습니다. 비밀을 잘 지키고, "이 사람에게는 말해도 되겠다"는 느낌을 주는 타입입니다.',
                      weakness: '변화를 싫어해서 새로운 관계를 만드는 데 소극적입니다. 속마음을 잘 표현하지 않아 오해를 살 때가 있습니다. 지나치게 참다가 한번에 폭발할 수 있어요.',
                      futureAdvice: '꾸준한 관계 유지가 가장 큰 강점입니다. 오래된 친구, 동료와의 관계가 나이 들수록 큰 힘이 됩니다. 가끔은 새로운 사람도 만나보세요.',
                    },
                    '금': {
                      style: '원칙적이고 깔끔한 관계를 선호합니다. 신뢰할 수 있는 소수의 사람과 깊은 관계를 맺는 타입이며, 불필요한 사교에 에너지를 쓰지 않습니다.',
                      strength: '의리가 있고 한번 인정한 사람에게는 확실하게 지지해줍니다. 조언이 정확하고 객관적이라 주변에서 의견을 구하는 경우가 많습니다.',
                      weakness: '까다로운 기준 때문에 첫 만남에서 차갑게 보일 수 있습니다. 비판적인 말투가 상대를 위축시킬 때가 있어요. 타인의 실수를 쉽게 용납하지 못하는 면이 있습니다.',
                      futureAdvice: '나이가 들수록 "유연함"이 관계의 열쇠가 됩니다. 완벽하지 않아도 괜찮다는 마음으로 사람을 대하면, 더 많은 사람이 당신 곁에 남을 것입니다.',
                    },
                    '수': {
                      style: '유연하고 적응력이 뛰어나 어떤 사람과도 잘 어울립니다. 공감 능력이 높고, 상대방의 감정을 잘 읽어내는 타입입니다.',
                      strength: '경청을 잘 하고 상담 능력이 뛰어납니다. 다양한 부류의 사람과 두루두루 친하게 지낼 수 있으며, 해외 인맥도 넓은 편입니다.',
                      weakness: '우유부단하게 보일 수 있고, 여러 사람의 의견에 휘둘리는 경우가 있습니다. 관계의 깊이보다 넓이에 치중할 때가 있어요. 가끔 감정 기복이 관계에 영향을 줍니다.',
                      futureAdvice: '지혜로운 멘토와의 관계를 꼭 유지하세요. 당신은 좋은 조언을 받아 큰 성장을 이룰 수 있는 사람입니다. 미래에 국제적 인맥이 큰 자산이 됩니다.',
                    },
                  };
                  const data = { ...RELATION_PATTERNS[ilOh] };

                  // ── 0) 신강/신약 + 월주 십성에 따라 관계 스타일 자체를 보정 ──
                  // 극신강: 기본 오행 설명의 부드러운 면이 약해지고, 주도적/강한 면이 전면에 옴
                  const SINGANG_STYLE_OVERRIDE: Record<string, string> = {
                    '목': '강한 추진력과 자기 확신으로 사람을 이끌어갑니다. 의견이 뚜렷하고 한번 결정하면 밀고 나가는 타입이라, 자연스럽게 리더 포지션에 서게 됩니다. 주변에서 카리스마가 있다고 느끼지만, 상대가 숨 막힌다고 느낄 수도 있습니다.',
                    '화': '에너지가 넘치고 존재감이 압도적입니다. 어디서든 주목을 받으며, 분위기를 지배하는 힘이 있습니다. 열정이 과하면 상대를 압도하거나 피곤하게 만들 수 있으니, 때로 한 발 물러서는 여유가 필요합니다.',
                    '토': '고집이 매우 세고 자기 방식에 대한 확신이 강합니다. 한번 마음먹으면 끝까지 밀어붙이는 뚝심이 있어, 주변에서 믿음직스럽다고 느끼지만 동시에 "말이 안 통한다"는 평가를 받기도 합니다. 포용력보다는 주도력이 앞서는 관계 방식입니다.',
                    '금': '원칙과 기준이 매우 엄격하고, 타인에게도 같은 수준을 요구합니다. 날카롭고 정확한 판단력으로 존경을 받지만, 기준에 못 미치는 사람에게 차갑게 대할 수 있습니다. 완벽주의가 관계를 좁히는 원인이 될 수 있어요.',
                    '수': '지적이고 독자적인 세계가 강합니다. 자기만의 방식으로 사람을 분석하고 판단하는 경향이 있으며, 깊이 있는 대화를 선호합니다. 마음을 쉽게 열지 않아 친해지기까지 시간이 걸리는 타입입니다.',
                  };
                  const SINYAK_STYLE_OVERRIDE: Record<string, string> = {
                    '목': '타인의 의견에 잘 맞춰주는 유연한 성격입니다. 갈등을 피하려는 성향이 강해 관계가 평화롭지만, 자기 의견을 제대로 표현하지 못해 속으로 답답함을 느낄 때가 있습니다.',
                    '화': '따뜻하고 공감 능력이 뛰어나지만, 에너지가 부족해 사교 활동이 오래 지속되면 지칩니다. 소수의 친한 사람과 깊은 관계를 맺는 것이 편하고, 큰 모임에서는 에너지 소모가 큽니다.',
                    '토': '조용하고 차분하며, 남에게 폐를 끼치지 않으려는 성향이 강합니다. 믿음직하지만 자기주장이 약해, 관계에서 끌려다니거나 이용당할 수 있습니다. 자신의 경계를 명확히 하는 연습이 필요합니다.',
                    '금': '섬세하고 예민한 감각을 가졌지만, 자신감이 부족해 먼저 다가가기를 주저합니다. 한번 신뢰를 쌓으면 깊고 오래가는 관계를 유지하는 타입입니다.',
                    '수': '눈치가 빠르고 상대의 기분을 잘 읽지만, 자기 기분이나 의견을 표현하는 데 서툽니다. 적응력이 좋아 어디서든 잘 어울리지만, 정작 깊은 관계에서 진심을 보여주는 데 시간이 걸립니다.',
                  };

                  // 월주 십성이 관계 스타일에 미치는 영향
                  const MONTH_SIP_STYLE_ADJUST: Record<string, string> = {
                    '겁재': ' 특히 경쟁심이 강하고 승부욕이 있어, 친구나 동료 사이에서도 주도권 다툼이 생기기 쉽습니다.',
                    '상관': ' 말이 거침없고 솔직해서 사람들의 이목을 끌지만, 윗사람과 마찰이 생기기 쉬운 편입니다.',
                    '편관': ' 조직에서 카리스마를 발휘하며, 위계를 중시하는 관계 방식을 보입니다.',
                    '식신': ' 베풀기를 좋아하고 사람들을 잘 챙겨서, 모임에서 인기가 많은 편입니다.',
                    '편인': ' 독특한 사고방식이 있어, 일반적인 모임보다 특별한 취미·관심사 커뮤니티에서 더 잘 맞습니다.',
                  };

                  // 신강/신약에 따라 스타일 덮어쓰기
                  if (ilOhaengBal >= 6 && SINGANG_STYLE_OVERRIDE[ilOh]) {
                    data.style = SINGANG_STYLE_OVERRIDE[ilOh];
                  } else if (ilOhaengBal <= 1.5 && SINYAK_STYLE_OVERRIDE[ilOh]) {
                    data.style = SINYAK_STYLE_OVERRIDE[ilOh];
                  }
                  // 월주 십성 보정 추가
                  if (MONTH_SIP_STYLE_ADJUST[monthSip]) {
                    data.style += MONTH_SIP_STYLE_ADJUST[monthSip];
                  }

                  // ── 1) 용신 기반 "잘 맞는 사람" ──
                  const YONGSIN_PARTNER: Record<string, string> = {
                    '목': `${OH_KR['목']}(木) 기운의 사람 — 교육, 출판, 인테리어, 친환경 분야 종사자나 성격이 진취적이고 성장 지향적인 사람과 함께하면 서로에게 좋은 기운을 줍니다. 목 기운이 당신의 용신이므로, 이런 사람 곁에 있으면 자연스럽게 운이 풀리고 마음이 안정됩니다.`,
                    '화': `${OH_KR['화']}(火) 기운의 사람 — 밝고 열정적인 사람, 방송/미디어/광고/에너지 분야 종사자와 인연이 좋습니다. 화 기운이 당신의 용신이므로, 적극적이고 표현력이 풍부한 사람과 함께하면 에너지가 충전되고 좋은 기회가 옵니다.`,
                    '토': `${OH_KR['토']}(土) 기운의 사람 — 듬직하고 안정적인 성격의 사람, 부동산/건설/식품/행정 분야 종사자와 궁합이 좋습니다. 토 기운이 당신의 용신이므로, 신뢰감 있고 꾸준한 사람 곁에서 마음의 안정과 실질적 도움을 받을 수 있습니다.`,
                    '금': `${OH_KR['금']}(金) 기운의 사람 — 원칙적이고 정밀한 사람, 금융/기술/엔지니어링/회계 분야 종사자와 인연이 좋습니다. 금 기운이 당신의 용신이므로, 논리적이고 체계적인 사람과 함께하면 판단력이 좋아지고 재물운도 올라갑니다.`,
                    '수': `${OH_KR['수']}(水) 기운의 사람 — 지혜롭고 유연한 사람, 연구/무역/해외/학문/상담 분야 종사자와 궁합이 좋습니다. 수 기운이 당신의 용신이므로, 차분하고 깊이 있는 사람 곁에서 지혜를 얻고 인생의 방향을 찾을 수 있습니다.`,
                  };
                  const bestPartners = YONGSIN_PARTNER[yongsin] || '';

                  // ── 2) 기신 기반 "주의할 관계" ──
                  const GISIN_CONFLICT: Record<string, string> = {
                    '목': `${OH_KR['목']}(木) 기운이 강한 사람과는 에너지 소모가 클 수 있습니다. 고집이 세고 자기주장이 강한 타입과 만나면 갈등이 깊어지기 쉬워요. 꼭 만나야 한다면, 논쟁을 피하고 서로의 영역을 존중하는 거리감을 유지하세요.`,
                    '화': `${OH_KR['화']}(火) 기운이 강한 사람과는 감정적 충돌이 생기기 쉽습니다. 열정적이지만 감정 기복이 큰 타입과 만나면 서로 소모되는 관계가 될 수 있어요. 냉정함을 유지하고, 감정에 휘말리지 않는 것이 핵심입니다.`,
                    '토': `${OH_KR['토']}(土) 기운이 강한 사람과는 답답함을 느끼기 쉽습니다. 변화를 싫어하고 고루한 타입과 만나면 발전 없는 관계에 갇힐 수 있어요. 적당한 거리감을 유지하되, 필요할 때만 교류하는 것이 좋습니다.`,
                    '금': `${OH_KR['금']}(金) 기운이 강한 사람과는 날카로운 갈등이 생길 수 있습니다. 비판적이고 완벽주의적인 타입과 만나면 자존감이 떨어질 수 있어요. 상대의 날카로움에 상처받지 말고, 필요한 조언만 취하세요.`,
                    '수': `${OH_KR['수']}(水) 기운이 강한 사람과는 방향성 갈등이 생기기 쉽습니다. 우유부단하거나 변덕이 심한 타입과 만나면 관계가 불안정해질 수 있어요. 명확한 경계를 정하고, 흔들리지 않는 자기 기준을 유지하세요.`,
                  };
                  const conflictWith = GISIN_CONFLICT[gisin] || '';

                  // ── 3) 신강/신약 관계 핵심 조언 ──
                  // 3요소(득령+득지+득세) 점수가 있으면 우선 사용
                  const ssUI = sajuResult?.strengthScore;
                  const isExtSingangUI = ssUI != null ? ssUI >= 65 : ilOhaengBal >= 6;
                  const isSingangUI = ssUI != null ? ssUI >= 40 : ilOhaengBal >= 4.5;
                  const isExtSinyakUI = ssUI != null ? ssUI < 15 : ilOhaengBal <= 1.5;
                  const isSinyakUI = ssUI != null ? ssUI < 25 : ilOhaengBal <= 2.5;
                  let singangNote = '';
                  if (isExtSingangUI) {
                    singangNote = `극신강(${ilOh} ${ilOhaengBal.toFixed(1)}) 체질이라 관계에서 주도권을 잡으려는 성향이 매우 강합니다. 리더십으로 발현되면 좋지만, "내 방식이 맞다"는 확신이 지나치면 주변이 떠날 수 있어요. 의식적으로 상대의 의견을 먼저 물어보고, 양보하는 연습을 해보세요. 특히 용신(${OH_KR[yongsin]}) 기운의 사람을 만나면 균형이 맞아 자연스럽게 관계가 편안해집니다.`;
                  } else if (isSingangUI) {
                    singangNote = `신강(${ilOh} ${ilOhaengBal.toFixed(1)}) 체질이라 자기 주관이 뚜렷하고 믿음직스럽지만, 때로 고집으로 비칠 수 있습니다. 용신(${OH_KR[yongsin]}) 기운의 사람과 함께하면 기운의 균형이 맞아 관계가 안정됩니다.`;
                  } else if (isExtSinyakUI) {
                    singangNote = `극신약(${ilOh} ${ilOhaengBal.toFixed(1)}) 체질이라 관계에서 상대에게 맞추는 경향이 매우 강합니다. "No"라고 말하는 연습이 꼭 필요합니다. 용신(${OH_KR[yongsin]}) 기운의 사람을 만나면 힘을 얻고 자신감이 생깁니다. 반대로 기신(${OH_KR[gisin]}) 기운이 강한 사람과 오래 있으면 점점 지치므로 거리를 두세요.`;
                  } else if (isSinyakUI) {
                    singangNote = `신약(${ilOh} ${ilOhaengBal.toFixed(1)}) 체질이라 협력적이고 조화를 중시하지만, 가끔 자기 의견을 내세우지 못할 때가 있습니다. 용신(${OH_KR[yongsin]}) 기운의 사람 곁에서 힘을 얻으세요.`;
                  }

                  // ── 4) 십성 기반 사회적 관계 패턴 ──
                  const MONTH_SIP_RELATION: Record<string, string> = {
                    '비견': '월주에 비견이 있어, 동료·친구와 동등한 관계를 선호합니다. 경쟁보다 협력을 중시하며, 같은 레벨의 사람들과 가장 편안합니다. 다만 무리에서 자기 몫을 지키려는 성향이 있어, 이익 분배에서 갈등이 생길 수 있습니다.',
                    '겁재': '월주에 겁재가 있어, 사회적으로 경쟁심이 강하고 승부욕이 있습니다. 친구나 동료 사이에서 주도권을 잡으려 하며, 때로 관계가 경쟁적으로 흐를 수 있습니다. 동업이나 금전 거래는 신중하게 하세요.',
                    '식신': '월주에 식신이 있어, 베풀기를 좋아하고 모임에서 사람들을 챙기는 역할을 합니다. 먹고 마시며 즐기는 자리에서 인맥이 넓어지며, 후배들에게 인기가 많습니다.',
                    '상관': '월주에 상관이 있어, 솔직하고 자유로운 소통을 선호합니다. 표현력이 뛰어나 사람들의 관심을 끌지만, 거침없는 말투가 오해를 살 때도 있습니다. 윗사람과의 관계에서 마찰이 있을 수 있으니 말을 가리는 연습이 도움됩니다.',
                    '편재': '월주에 편재가 있어, 활동적인 사교가이며 다양한 사람과 교류합니다. 사업적 인맥이 넓고, 모임이나 행사에서 자연스럽게 중심에 서게 됩니다. 다만 관계가 넓은 만큼 깊이가 부족할 수 있습니다.',
                    '정재': '월주에 정재가 있어, 성실하고 믿음직한 관계를 쌓아갑니다. 약속을 잘 지키고 신용이 좋아 오래된 지인에게 신뢰를 받습니다. 새로운 관계를 넓히기보다 기존 관계를 깊게 유지하는 타입입니다.',
                    '편관': '월주에 편관이 있어, 카리스마 있는 관계 방식을 보여줍니다. 조직에서 리더십을 발휘하고, 권위 있는 사람과의 관계를 중시합니다. 다만 강압적으로 보일 수 있으니 유연한 태도가 관계를 오래 유지하는 비결입니다.',
                    '정관': '월주에 정관이 있어, 예의 바르고 격식 있는 관계를 선호합니다. 사회적으로 신뢰감이 높고, 공적인 자리에서 빛나는 타입입니다. 친한 사이에서도 예의를 지키는 편이라, 때로 거리감이 느껴질 수 있습니다.',
                    '편인': '월주에 편인이 있어, 독특한 사고방식과 비전통적인 관계 패턴을 보입니다. 소수의 깊은 관계를 맺으며, 취미나 관심사가 같은 사람과 특히 잘 맞습니다. 독자적인 세계가 있어 일반적인 모임보다 특별한 커뮤니티에서 빛납니다.',
                    '정인': '월주에 정인이 있어, 학구적이고 지적인 관계를 추구합니다. 멘토-멘티 관계에서 특히 빛나며, 배움을 주고받는 사이에서 깊은 유대를 형성합니다. 어머니 같은 포근한 분위기로 주변을 편안하게 합니다.',
                  };
                  const monthRelation = MONTH_SIP_RELATION[monthSip] || '';

                  // ── 5) 건강 상태를 고려한 미래 조언 보정 ──
                  const weakOhVal = sajuResult.ohaengBalance[sajuResult.weakestOhaeng as keyof typeof sajuResult.ohaengBalance];
                  if (weakOhVal <= 1) {
                    const wOh = sajuResult.weakestOhaeng;
                    if (wOh === '화') {
                      data.futureAdvice = '화(火) 기운이 극도로 부족하여 불안·공황 증상이 나타날 수 있는 체질입니다. 사람을 많이 만나야 한다는 부담을 내려놓으세요. 소수의 정말 편안한 사람 1~2명과 깊은 관계를 유지하는 것이 더 중요합니다. 온라인 소통, 짧은 만남, 익숙한 공간에서의 모임으로 관계를 유지하세요.';
                      data.weakness += ' 특히 화(火) 부족으로 사교 활동에서 긴장과 불안을 느끼기 쉬운 편입니다. 이는 성격의 문제가 아니라 체질적인 특성이니 자책하지 마세요.';
                    } else if (wOh === '목') {
                      data.futureAdvice = '목(木) 기운이 극도로 부족하여 만성 피로를 느끼기 쉬운 체질입니다. 에너지가 부족할 때 억지로 사교 활동을 늘리면 오히려 번아웃이 올 수 있어요. 체력이 회복된 후에 사람을 만나고, 자신의 컨디션에 맞는 속도로 관계를 관리하세요.';
                    } else if (wOh === '토') {
                      data.futureAdvice = '토(土) 기운이 극도로 부족하여 위장이 약한 체질입니다. 회식이나 음주 모임이 잦으면 건강이 악화될 수 있어요. 식사보다 차 한 잔 하는 가벼운 만남을 선호하고, 규칙적인 생활을 유지하면서 관계를 쌓아가세요.';
                    } else if (wOh === '금') {
                      data.futureAdvice = '금(金) 기운이 극도로 부족하여 호흡기가 약한 체질입니다. 실내 환기가 안 되는 공간이나 먼지가 많은 곳에서의 모임은 피하세요. 야외 산책이나 쾌적한 카페에서의 만남이 건강에도 관계에도 좋습니다.';
                    } else if (wOh === '수') {
                      data.futureAdvice = '수(水) 기운이 극도로 부족하여 허리와 체력이 약한 체질입니다. 장시간 앉아 있는 모임은 부담이 될 수 있으니, 짧고 가벼운 만남을 여러 번 하는 것이 좋습니다. 건강을 우선하면서 관계를 유지하세요.';
                    }
                  }
                  return (
                    <div className="space-y-3">
                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-purple-900/20">
                        <h4 className="text-base font-bold text-purple-300 mb-2">🎭 나의 관계 스타일</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{data.style}</p>
                      </div>

                      {/* 신강/신약 관계 특성 */}
                      {singangNote && (
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-yellow-900/20">
                          <h4 className="text-base font-bold text-yellow-300 mb-2">⚖️ 사주 강약과 관계</h4>
                          <p className="text-sm text-gray-300 leading-relaxed">{singangNote}</p>
                        </div>
                      )}

                      {/* 월주 십성 사회적 관계 패턴 */}
                      {monthRelation && (
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-indigo-900/20">
                          <h4 className="text-base font-bold text-indigo-300 mb-2">🏢 사회적 관계 패턴 ({monthSip})</h4>
                          <p className="text-sm text-gray-300 leading-relaxed">{monthRelation}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-green-900/20">
                          <h4 className="text-base font-bold text-green-300 mb-2">✅ 관계에서의 강점</h4>
                          <p className="text-sm text-gray-300 leading-relaxed">{data.strength}</p>
                        </div>
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-red-900/20">
                          <h4 className="text-base font-bold text-red-300 mb-2">⚠️ 주의할 점</h4>
                          <p className="text-sm text-gray-300 leading-relaxed">{data.weakness}</p>
                        </div>
                      </div>

                      {/* 용신 기반 잘 맞는 사람 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-cyan-900/20">
                          <h4 className="text-base font-bold text-cyan-300 mb-2">💚 잘 맞는 사람 (용신 {OH_KR[yongsin]})</h4>
                          <p className="text-sm text-gray-300 leading-relaxed">{bestPartners}</p>
                        </div>
                        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-orange-900/20">
                          <h4 className="text-base font-bold text-orange-300 mb-2">🔥 주의할 관계 (기신 {OH_KR[gisin]})</h4>
                          <p className="text-sm text-gray-300 leading-relaxed">{conflictWith}</p>
                        </div>
                      </div>

                      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-blue-900/20">
                        <h4 className="text-base font-bold text-blue-300 mb-2">🔮 미래 관계 조언</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{data.futureAdvice}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
              )}
            </div>
          )}

          {/* 타로 카드 리딩 결과 */}
          {activeSection === 'tarot' && reading && (
            <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
              <h3 className="text-lg font-bold text-center mb-2 text-purple-300">🃏 타로 카드가 전하는 메시지</h3>
              {userQuestion && (
                <div className="text-center mb-3">
                  <span className="text-sm text-gray-500">질문: </span>
                  <span className="text-base text-purple-200">"{userQuestion}"</span>
                </div>
              )}
              <p className="text-sm text-gray-500 text-center mb-4">카드를 터치해서 뒤집어 보세요</p>

              <div className="space-y-4">
                {reading.cards.map((drawn, index) => {
                  const isFlipped = flippedCards.has(index);
                  const OHAENG_NAMES: Record<string, string> = { '목': '🌿나무', '화': '🔥불', '토': '🏔️흙', '금': '⚔️쇠', '수': '💧물' };
                  const suitNames: Record<string, string> = { wands: '지팡이', cups: '잔', swords: '검', pentacles: '동전' };
                  return (
                    <div key={index}>
                      <div className="text-base text-purple-300 font-bold mb-2 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-sm flex items-center justify-center">{index + 1}</span>
                        {drawn.position}
                      </div>

                      {!isFlipped ? (
                        <div
                          className="cursor-pointer mx-auto rounded-xl border-2 border-purple-500 bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center hover:scale-105 transition-transform"
                          style={{ width: 140, height: 200 }}
                          onClick={() => flipCard(index)}
                        >
                          <div className="text-center">
                            <div className="text-4xl mb-2">🔮</div>
                            <div className="text-sm text-purple-300">터치하여 뒤집기</div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#0a0a1a] rounded-xl p-5 border border-purple-900/30 animate-fade-in">
                          <div className="flex items-center gap-3 mb-4">
                            <div
                              className="w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-center shrink-0"
                              style={{
                                borderColor: drawn.card.symbolColor,
                                background: `linear-gradient(135deg, ${drawn.card.symbolColor}22, #1e1e3f)`,
                              }}
                            >
                              <div className="text-xl" style={{ transform: drawn.isReversed ? 'rotate(180deg)' : '' }}>
                                {drawn.card.arcana === 'major' ? '★' : drawn.card.suit === 'wands' ? '🪄' : drawn.card.suit === 'cups' ? '🏆' : drawn.card.suit === 'swords' ? '⚔️' : '💰'}
                              </div>
                            </div>
                            <div>
                              <div className="font-bold text-white text-lg">{drawn.card.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-sm px-2 py-0.5 rounded-full ${drawn.isReversed ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                  {drawn.isReversed ? '⚠️ 돌아볼 점이 있어요' : '✨ 순조로운 흐름'}
                                </span>
                                <span className="text-sm px-2 py-0.5 rounded-full bg-purple-900/30" style={{ color: OHAENG_COLOR[drawn.card.element] }}>
                                  {OHAENG_NAMES[drawn.card.element] || drawn.card.element} 기운
                                </span>
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                키워드: {drawn.card.keywords.join(' · ')}
                              </div>
                            </div>
                          </div>

                          {/* 질문 맥락에 맞는 포지션별 핵심 해석 */}
                          {userQuestion.trim() && (() => {
                            const qLow = userQuestion.trim().toLowerCase();
                            const pos = drawn.position;
                            const rev = drawn.isReversed;
                            const cardName = drawn.card.name;
                            const kw = drawn.card.keywords;
                            const cardOh = drawn.card.element;
                            const ohName = OHAENG_NAMES[cardOh] || cardOh;
                            const yongOh = OHAENG_NAMES[sajuResult.yongsin] || sajuResult.yongsin;
                            const isYong = cardOh === sajuResult.yongsin;
                            const isGi = cardOh === sajuResult.gisin;
                            // 사주 심화 데이터
                            const monthSip = sajuResult.sipseongs.month;
                            const hourSip = sajuResult.sipseongs.hour;
                            const curDaeun = daeunResult?.currentDaeun;
                            const curStage = curDaeun?.twelveStage || '';
                            const curStageEnergy = curDaeun && curStage ? (TWELVE_STAGE_DATA[curStage as keyof typeof TWELVE_STAGE_DATA]?.energy || 5) : 5;
                            const relStatus = sajuResult.relationship;
                            const sipList = Object.values(sajuResult.sipseongs);
                            const tarotAge = daeunResult ? daeunResult.currentAge : 30;
                            let contextReading = '';

                            // 초등학생 전용 타로 해석 (반말 + 신조어 + 사주 기반)
                            if (tarotAge <= 12) {
                              const ohKr: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
                              const myOhKr = ohKr[sajuResult.day.cheonganOhaeng] || '';
                              const cardOhKr = ohKr[cardOh] || '';
                              const funMemes = [
                                '스트롱 스트롱💪 힘내!',
                                '할렐야루~ 좋은 기운이야!',
                                '난리자베스! 대박 운세다!',
                                '김풍스럽게 결국 잘 될 거야!',
                                '중지정! 중요한 건 지치지 않는 정신이야!',
                                '밤티여도 괜찮아~ 망해도 웃으면 이긴 거야! ㅋㅋ',
                                '피치 못할 사정? 피자치킨 사정이지? 🍕🍗',
                                '간바레 간바레~ 넌 할 수 있어!',
                              ];
                              const meme = funMemes[Math.floor(Math.random() * funMemes.length)];
                              if (rev) {
                                contextReading = `🃏 "${cardName}" 카드가 거꾸로 나왔어!\n\n` +
                                  `이 카드는 "${kw[0]}" 이런 느낌인데, 지금은 좀 막혀있는 상태야.\n` +
                                  `네 타고난 ${myOhKr} 기운이랑 이 카드의 ${cardOhKr} 기운이 ` +
                                  (isGi ? '좀 안 맞아서 조심해야 해! 😤 ' : '만났는데, 걱정 마~ 금방 풀릴 수 있어! ') +
                                  `\n\n근데 있지, 이런 카드가 나온다고 나쁜 게 아니야! ` +
                                  `"조심하면 괜찮아~"라는 뜻이거든 ㅎㅎ\n` +
                                  `${meme}\n\n` +
                                  `💡 넌 분명 잘 해낼 수 있어! 힘든 건 다 지나가~ 화이팅! 🌈`;
                              } else {
                                contextReading = `🃏 "${cardName}" 카드가 짠~ 하고 나왔어!\n\n` +
                                  `이 카드는 "${kw[0]}" 이런 좋은 느낌이야! ✨\n` +
                                  `네 타고난 ${myOhKr} 기운이랑 이 카드의 ${cardOhKr} 기운이 ` +
                                  (isYong ? '찰떡궁합이야! 완전 혜자베스~! 🎉 ' : '만나서 좋은 에너지를 줄 수 있어! ') +
                                  `\n\n${kw.slice(0, 2).join(', ')} 같은 에너지가 너한테 오고 있어~\n` +
                                  `${meme}\n\n` +
                                  `💡 앞으로 좋은 일이 생길 수 있어! 기대해도 돼~ 😆🌟`;
                              }
                              return (
                                <div className="mb-3 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 rounded-lg p-4 border border-purple-500/30">
                                  <h4 className="text-sm font-bold text-amber-300 mb-2">
                                    🎯 [{pos}] 너만을 위한 카드 해석!
                                  </h4>
                                  <p className="text-base text-gray-100 leading-relaxed whitespace-pre-line">{contextReading}</p>
                                </div>
                              );
                            }

                            // 중고등학생 전용 타로 해석 (존댓말 + 희망적 + 신조어)
                            if (tarotAge >= 13 && tarotAge < 20) {
                              const ohKr: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
                              const myOhKr = ohKr[sajuResult.day.cheonganOhaeng] || '';
                              const cardOhKr = ohKr[cardOh] || '';
                              const studentMemes = [
                                '스트롱 스트롱💪 지금 이 시간이 나중에 다 빛날 거예요!',
                                '장항준적 사고로 가볍게~ 너무 무겁게 생각하지 마세요!',
                                '김풍스럽게, 과정은 불안해도 결과는 좋을 수 있어요!',
                                '역기대컨 걸어두면 작은 성과에도 대박 만족! 지혜로운 전략이에요 😎',
                                '결과가 밤티여도 당당하게 공유하는 사람이 진짜 쿨한 거예요!',
                              ];
                              const meme = studentMemes[Math.floor(Math.random() * studentMemes.length)];
                              if (rev) {
                                contextReading = `"${cardName}" 카드가 역방향으로 나왔어요.\n\n` +
                                  `${kw[0]}·${kw[1]} 에너지가 지금은 좀 막혀있는 느낌이에요. ` +
                                  `${myOhKr} 기운을 가진 당신에게 ${cardOhKr} 카드가 전하는 메시지는 ` +
                                  (isGi ? '"지금은 조심하면서 때를 기다려보세요"예요.' : '"잠깐 쉬어가도 괜찮아요"라는 뜻이에요.') +
                                  `\n\n하지만 걱정하지 마세요! 역방향 카드는 "나쁘다"가 아니라 "돌아볼 점이 있다"는 거예요. ` +
                                  `지금 이 시간이 나중에 엄청 소중한 경험이 될 수 있어요.\n\n` +
                                  `${meme}\n\n` +
                                  `🌟 힘든 시간은 반드시 지나가요. 당신의 미래는 충분히 밝아요! 화이팅! 💪`;
                              } else {
                                contextReading = `"${cardName}" 카드가 정방향으로 나왔어요! ✨\n\n` +
                                  `${kw[0]}·${kw[1]} 에너지가 당신에게 좋은 기운을 보내고 있어요. ` +
                                  `${myOhKr} 기운을 가진 당신에게 ${cardOhKr} 카드는 ` +
                                  (isYong ? '"지금 하는 일이 맞는 방향이에요!"라고 응원해요.' : '"좋은 흐름이 올 수 있어요"라고 말해줘요.') +
                                  `\n\n지금 노력하고 있는 모든 것들이 결실을 맺을 수 있어요.\n\n` +
                                  `${meme}\n\n` +
                                  `🌟 당신의 가능성은 무한해요! 자신감을 가지세요! 🌈`;
                              }
                              return (
                                <div className="mb-3 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 rounded-lg p-4 border border-purple-500/30">
                                  <h4 className="text-sm font-bold text-amber-300 mb-2">
                                    🎯 [{pos}] "{userQuestion}" 맞춤 해석
                                  </h4>
                                  <p className="text-base text-gray-100 leading-relaxed whitespace-pre-line">{contextReading}</p>
                                </div>
                              );
                            }

                            // 바람/외도 질문
                            if (/바람|외도|불륜|도화|유혹/.test(qLow)) {
                              // 십성으로 바람끼 위험도 판단
                              const riskySip = sipList.filter(s => ['편재', '상관', '겁재'].includes(s)).length;
                              const stableSip = sipList.filter(s => ['정관', '정인', '정재'].includes(s)).length;
                              const riskLevel = riskySip >= 3 ? '높음' : riskySip >= 2 ? '약간 있음' : stableSip >= 2 ? '낮음' : '보통';
                              const mokYokRisk = curStage === '목욕' ? ' 현재 대운이 목욕(沐浴)운으로 이성에 대한 관심이 높아질 수 있는 시기예요!' : '';
                              const daeunNote = curDaeun ? ` (현재 대운 ${curDaeun.cheongan}${curDaeun.jiji}, ${curStage}운, 에너지 ${curStageEnergy}/10)` : '';

                              if (/본성/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 카드가 뒤집혀 나왔어요. 사주 십성 분석상 바람끼 위험도는 【${riskLevel}】이에요. 사주에 ${riskySip > 0 ? `편재·상관·겁재가 ${riskySip}개 있어 자극을 추구하는 성향이 있을 수 있고, ` : ''}${kw[0]}·${kw[1]} 키워드가 암시하듯 내면의 공허함이 유혹에 약한 구조를 만들 수 있어요.${isGi ? ` 특히 ${ohName} 기운이 기신(忌神)이라 충동적 감정에 휘둘릴 위험이 있을 수 있어요.` : ''}${isYong ? ` 다행히 ${ohName} 기운이 용신(用神)이라 이성적 판단력이 유혹을 억제하는 힘이 될 수 있어요.` : ''}`
                                  : `"${cardName}" 카드가 정방향이에요. 사주 십성 분석상 바람끼 위험도는 【${riskLevel}】이에요. ${stableSip > 0 ? `사주에 정관·정인·정재가 ${stableSip}개 있어 안정과 절제를 중시하는 성향일 수 있고, ` : ''}${kw[0]}·${kw[1]} 키워드가 보여주듯 안정적인 내면을 가져 쉽게 흔들리지 않는 편이에요.${isYong ? ` ${ohName} 용신 기운이 자제력을 더욱 강화해줄 수 있어요.` : ''}${isGi ? ` 다만 ${ohName} 기신 기운으로 특정 상황에서 감정 조절이 약해질 수 있으니 주의해보세요.` : ''}`;
                              } else if (/유혹/.test(pos)) {
                                contextReading = rev
                                  ? `현재 유혹의 기운이 감지될 수 있어요${daeunNote}. "${cardName}" 역방향은 ${kw.slice(0, 2).join('·')}의 에너지가 왜곡되어, 주변에 마음을 흔드는 사람이나 상황이 있을 수 있어요.${mokYokRisk}${curStageEnergy >= 7 ? ' 대운 에너지가 높아 활동범위가 넓어지면서 유혹의 기회도 많아질 수 있어요.' : curStageEnergy <= 3 ? ' 대운 에너지가 낮아 외로움과 결핍감이 외도로 이어질 위험이 있을 수 있어요.' : ''} 감정적 결핍이 외부로 향할 수 있는 시기예요.${isGi ? ` ${ohName} 기신 에너지가 유혹을 증폭시킬 수 있어요!` : ''}`
                                  : `현재 외부 유혹은 크지 않은 편이에요${daeunNote}. "${cardName}" 정방향은 ${kw.slice(0, 2).join('·')}의 안정된 에너지를 보여줘요.${mokYokRisk || (curStage === '관대' || curStage === '건록' ? ' 현재 대운이 안정적이라 가정에 충실할 수 있는 시기예요.' : '')} 배우자/파트너와의 관계에 큰 틈이 없어 바람의 위험은 낮은 편이에요.${isYong ? ` ${ohName} 용신 에너지가 가정의 안정을 지켜주고 있을 수 있어요.` : ''}`;
                              } else if (/흐름|미래/.test(pos)) {
                                contextReading = rev
                                  ? `앞으로 감정적 동요가 올 수 있어요. "${cardName}" 역방향이 주의를 알려줘요. ${kw.slice(0, 2).join('·')}의 불안정한 에너지가 관계에 균열을 일으킬 수 있어요. ${riskySip >= 2 ? '사주에 편재·상관 기운이 강하므로 새로운 자극에 끌리기 쉬운 구조일 수 있어요. ' : ''}배우자와의 대화를 늘리고 함께하는 시간을 의식적으로 만들어보세요.`
                                  : `앞으로의 흐름은 안정적인 편이에요. "${cardName}" 정방향은 ${kw.slice(0, 2).join('·')}의 긍정 에너지가 관계를 단단하게 만들어줄 수 있어요. ${stableSip >= 2 ? '사주의 정관·정인 기운이 가정을 지키는 힘이 될 수 있어요. ' : ''}서로에 대한 신뢰가 깊어지는 시기가 올 수 있어요.`;
                              }
                            }
                            // 이혼/재혼 질문
                            else if (/이혼|재혼|별거|파경/.test(qLow)) {
                              if (/본질|바탕/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 역방향이 결혼운의 근본적 불안정을 나타낼 수 있어요. ${kw.slice(0, 2).join('·')} 에너지가 흔들리고 있어, 관계의 기반 자체에 점검이 필요할 수 있어요.${isGi ? ` ${ohName} 기신 기운이 갈등을 증폭시킬 수 있어요.` : ''}`
                                  : `"${cardName}" 정방향은 결혼의 토대가 견고한 편임을 보여줘요. ${kw.slice(0, 2).join('·')} 에너지가 안정적이라 쉽게 무너지지 않는 관계일 수 있어요.${isYong ? ` ${ohName} 용신이 결혼 생활을 보호하는 힘이 될 수 있어요.` : ''}`;
                              } else if (/위기/.test(pos)) {
                                contextReading = rev
                                  ? `현재 위기 요인이 있을 수 있어요. "${cardName}" 역방향은 소통 단절, 감정적 거리감, 외부 갈등 중 하나 이상이 작용하고 있을 수 있음을 암시해요. 방치하면 돌이키기 어려워질 수 있어요. 💡 평소보다 작고 조심스러운 목소리로 변명 없이 "미안해"라고 먼저 건네보세요. 투박하고 짧은 한마디라도 진정성이 담긴 낮은 톤이 관계의 장벽을 허물 수 있어요. "괜찮니?", "많이 힘들었지?"라는 다독임을 덧붙이면 얼어붙은 마음이 녹을 수 있어요.`
                                  : `당장 심각한 위기 요인은 없는 편이에요. "${cardName}" 정방향이 보여주는 ${kw[0]}의 에너지가 관계를 지탱하고 있을 수 있어요. 하지만 안심하지 말고 꾸준한 노력이 필요해요.`;
                              } else if (/앞으로|미래|결혼운/.test(pos)) {
                                contextReading = rev
                                  ? `앞으로의 결혼운에 주의가 필요할 수 있어요. "${cardName}" 역방향은 관계 회복에 상당한 노력이 필요함을 의미할 수 있어요. 💡 극단적 결정 전에 최소 3개월~1년, 상대에게 '예쁜 말'을 심는 기간을 가져보세요. 예쁜 말이란 영혼 없는 사랑 고백이 아니라, 힘들다 할 때 인정해주고 작은 성과에 감탄해주는 최소한의 예의예요. 꾸준히 시도해 본 뒤에도 변화가 없다면 그때 결정해도 늦지 않을 수 있어요. 전문 상담이나 제3자의 도움도 고려해보세요.`
                                  : `결혼운이 회복·안정되는 흐름일 수 있어요. "${cardName}" 정방향의 ${kw.slice(0, 2).join('·')} 에너지가 두 사람의 유대를 강화시켜 줄 수 있어요.`;
                              }
                            }
                            // 결혼/연애/부부 질문
                            else if (/결혼|연애|사랑|인연|소개팅|만남|부부|궁합|가정/.test(qLow)) {
                              const hasJunggwan = sipList.includes('정관');
                              const hasJungjae = sipList.includes('정재');
                              const hasPyeonjae = sipList.includes('편재');
                              const isMarried = relStatus === 'married';
                              const loveNote = isMarried ? '(기혼)' : relStatus === 'dating' ? '(연애중)' : '(솔로)';
                              const daeunLove = curStage === '목욕' ? ' 대운 목욕운으로 이성운이 활발할 수 있어요.' : ['장생', '관대'].includes(curStage) ? ` 대운 ${curStage}운으로 좋은 인연이 들어오기 좋은 시기일 수 있어요.` : '';

                              if (isMarried) {
                                // 기혼자 전용 해석
                                if (/인연|바탕/.test(pos)) {
                                  contextReading = rev
                                    ? `"${cardName}" 역방향 — 부부 관계의 기반에 미세한 균열이 감지될 수 있어요 ${loveNote}. ${kw[0]}·${kw[1]}의 에너지가 불안정하여 소통 부재가 쌓이고 있을 수 있어요.${isGi ? ` ${ohName} 기신이 부부 갈등을 부추길 수 있으니 의식적으로 대화 시간을 늘려보세요.` : ''} 배우자의 입장에서 한번 생각해보면 좋을 수 있어요.`
                                    : `"${cardName}" 정방향 — 부부 관계의 토대가 견고한 편이에요 ${loveNote}. ${kw.slice(0, 2).join('·')}의 에너지가 가정에 안정감을 주고 있을 수 있어요. ${hasJunggwan ? '사주의 정관이 가정에 대한 책임감을 뒷받침하는 편이에요.' : hasJungjae ? '사주의 정재가 가정의 경제적 안정을 도울 수 있어요.' : ''}${isYong ? ` ${ohName} 용신이 부부 화합을 보호해줄 수 있어요.` : ''}`;
                                } else if (/현재/.test(pos)) {
                                  contextReading = rev
                                    ? `현재 부부 사이에 권태기나 갈등의 기운이 있을 수 있어요. "${cardName}" 역방향은 서로에 대한 무관심이나 소통 단절을 암시할 수 있어요.${curStageEnergy <= 4 ? ` 대운 에너지가 ${curStageEnergy}/10으로 낮아 서로 지치기 쉬운 시기일 수 있어요.` : ''} 💡 불만을 전할 때는 "햄버거 기법"(감사→부탁→감사)을 써보세요. 나 중심 화법의 핵심은 상대를 원인 제공자로 몰지 않는 것이에요 — "네가 나를 화나게 했어"가 아니라 "나는 지금 슬퍼, 나는 지금 속상해"처럼 순수하게 내 감정에만 집중하면 상대도 방어적 태도를 풀 수 있어요. "밥 먹었어?", "차 조심해"같은 투박한 일상 안부에도 "나는 당신을 봅니다"라는 진심이 담길 수 있어요.`
                                    : `현재 가정운이 안정적인 편이에요! "${cardName}" 정방향은 부부 사이의 신뢰와 애정이 유지되고 있을 수 있어요.${curStageEnergy >= 7 ? ` 대운 에너지 ${curStageEnergy}/10으로 함께 새로운 목표나 여행을 계획하면 더 좋아질 수 있어요!` : ''}`;
                                } else if (/미래/.test(pos)) {
                                  contextReading = rev
                                    ? `앞으로 부부 관계에 시험이 올 수 있어요. "${cardName}" 역방향은 갈등이 깊어지기 전에 대화로 풀어야 할 수 있음을 알려줘요. ${sipList.includes('상관') ? '사주의 상관 기운이 배우자에 대한 불만을 키울 수 있으니 감정 조절이 핵심이에요. ' : ''}💡 평소보다 조심스럽고 낮은 목소리로 "미안해"라고 먼저 건네보세요. 유창한 해명보다 투박하고 작은 소리에 담긴 진정성이 오래 닫혀 있던 마음을 열 수 있어요. 그리고 "괜찮니?", "많이 힘들었지?"라고 다독여주면 얼어붙은 마음이 녹을 수 있습니다.`
                                    : `부부 관계의 미래가 밝은 편이에요! "${cardName}" 정방향은 ${kw.slice(0, 2).join('·')}의 에너지가 가정의 행복을 키워줄 수 있어요. ${hasJunggwan ? '정관 기운이 가정의 안정을 장기적으로 보호해줄 수 있어요.' : hasJungjae ? '정재 기운이 경제적 풍요와 가정의 화목을 동시에 가져다줄 수 있어요.' : ''}`;
                                }
                              } else {
                                // 미혼/연애중 해석
                                if (/인연|바탕/.test(pos)) {
                                  contextReading = rev
                                    ? `"${cardName}" 역방향 — 인연의 흐름이 아직 무르익지 않았을 수 있어요 ${loveNote}. ${kw[0]}의 에너지가 부족하고, ${hasPyeonjae ? '사주에 편재가 있어 인연이 와도 오래 유지되기 어려운 패턴이 보일 수 있어요. ' : ''}좋은 인연을 알아보는 눈을 키워보세요.${isGi ? ` ${ohName} 기신의 영향으로 잘못된 상대에게 끌릴 수 있으니 주의해보세요.` : ''}`
                                    : `"${cardName}" 정방향 — 인연의 씨앗이 잘 심어져 있는 편이에요 ${loveNote}. ${kw.slice(0, 2).join('·')}의 에너지가 좋은 사람을 끌어당길 수 있어요. ${hasJunggwan || hasJungjae ? '사주에 정관/정재가 있어 진지하고 안정적인 인연을 만날 기질이 있는 편이에요. ' : ''}${isYong ? `${ohName} 용신이 좋은 인연을 만들어줄 수 있어요.` : ''}${daeunLove}`;
                                } else if (/현재/.test(pos)) {
                                  contextReading = rev
                                    ? `현재 연애운에 정체기가 있을 수 있어요. "${cardName}" 역방향은 감정 표현의 어려움이나 타이밍의 어긋남을 암시할 수 있어요.${curStageEnergy <= 4 ? ` 대운 에너지가 ${curStageEnergy}/10으로 낮아 적극적인 만남보다 자기 관리가 우선일 수 있어요.` : ''} 조급해하지 말고 자기 자신을 먼저 돌봐보세요.`
                                    : `현재 연애운이 활발한 편이에요! "${cardName}" 정방향의 ${kw[0]} 에너지가 매력을 높여주고 있을 수 있어요.${curStageEnergy >= 7 ? ` 대운 에너지 ${curStageEnergy}/10으로 적극적으로 움직이면 좋은 인연을 만날 확률이 높아질 수 있어요!` : ''}${daeunLove}`;
                                } else if (/미래/.test(pos)) {
                                  contextReading = rev
                                    ? `결혼운이 쉽게 열리지는 않을 수 있어요. "${cardName}" 역방향은 아직 준비가 더 필요할 수 있음을 의미해요. ${sipList.includes('비견') || sipList.includes('겁재') ? '사주에 비견/겁재가 있어 독립심이 강한데, 이것이 결혼을 늦추는 원인일 수 있어요. ' : ''}이상형 기준을 재점검하고 내면 성장에 집중해보세요.`
                                    : `결혼운이 밝은 편이에요! "${cardName}" 정방향은 ${kw.slice(0, 2).join('·')}의 축복 에너지가 앞으로의 결혼 생활을 응원해줄 수 있어요. ${hasJunggwan ? '정관이 있어 좋은 배우자를 만날 가능성이 높은 편이에요.' : hasJungjae ? '정재가 있어 안정적이고 화목한 가정을 꾸릴 기질이 있는 편이에요.' : ''}`;
                                }
                              }
                            }
                            // 직업/이직 질문
                            else if (/직업|직장|이직|취업|퇴사|면접|승진|사업|창업/.test(qLow)) {
                              const careerSip = monthSip;
                              const hasEdgwan = sipList.includes('편관');
                              const hasSanggwan = sipList.includes('상관');
                              const daeunCareer = curStageEnergy >= 7 ? `대운 에너지 ${curStageEnergy}/10으로 커리어 상승기일 수 있어요!` : curStageEnergy <= 3 ? `대운 에너지 ${curStageEnergy}/10으로 현 위치에서 내실을 다지는 게 현명할 수 있어요.` : `대운 에너지 ${curStageEnergy}/10이에요.`;

                              if (/바탕|적성/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 역방향 — 현재 직업이 적성과 다소 맞지 않을 수 있어요. ${kw[0]}·${kw[1]}의 에너지가 억눌려 있어 강점을 충분히 발휘하지 못하고 있을 수 있어요. ${careerSip === '편관' ? '월주 편관은 조직에서 압박을 받기 쉬운 구조일 수 있어요.' : careerSip === '식신' ? '월주 식신으로 창의적 분야가 더 맞을 수 있어요.' : ''}`
                                  : `"${cardName}" 정방향 — 직업 적성의 기반이 탄탄한 편이에요. ${kw.slice(0, 2).join('·')}의 에너지가 커리어를 뒷받침해줄 수 있어요. ${careerSip === '정관' ? '월주 정관으로 조직 내에서 인정받는 타입일 수 있어요.' : careerSip === '편재' ? '월주 편재로 사업/영업 수완이 있는 편이에요.' : ''}${isYong ? ` ${ohName} 용신이 직업운을 강화해줄 수 있어요.` : ''}`;
                              } else if (/현재/.test(pos)) {
                                contextReading = rev
                                  ? `현재 직장/사업에서 불만이나 정체감이 있을 수 있어요. "${cardName}" 역방향은 성과가 보이지 않는 시기일 수 있어요. ${daeunCareer} ${hasSanggwan ? '상관 기운이 상사와의 갈등을 만들 수 있으니 말조심해보세요.' : ''}`
                                  : `현재 직업운이 좋은 흐름일 수 있어요! "${cardName}" 정방향은 ${kw[0]}의 에너지가 활발한 편이에요. ${daeunCareer} ${hasEdgwan ? '편관 기운이 있어 경쟁에서 이길 수 있는 파워가 있을 수 있어요.' : ''}`;
                              } else if (/변화|미래|전망/.test(pos)) {
                                contextReading = rev
                                  ? `이직/전환은 신중하면 좋을 수 있어요. "${cardName}" 역방향은 변화의 타이밍이 아직 아닐 수 있어요. ${curStageEnergy <= 5 ? `대운 에너지가 ${curStageEnergy}/10이라 최소 1~2년 준비 후 움직여보세요.` : '충분히 준비한 후 6개월 후 재검토해보세요.'}`
                                  : `앞으로 좋은 변화가 기대되는 편이에요! "${cardName}" 정방향은 ${kw.slice(0, 2).join('·')}의 상승 에너지예요. ${curStageEnergy >= 7 ? `대운 에너지가 ${curStageEnergy}/10으로 이직·승진·창업 모두 좋은 타이밍일 수 있어요!` : '준비된 상태라면 변화를 두려워하지 마세요.'}`;
                              }
                            }
                            // 돈/재물 질문
                            else if (/돈|재물|투자|재복|부자|금전|수입/.test(qLow)) {
                              const hasJungjae = sipList.includes('정재');
                              const hasPyeonjae = sipList.includes('편재');
                              const jaeCount = sipList.filter(s => s === '정재' || s === '편재').length;
                              const daeunMoney = curStageEnergy >= 7 ? `대운 에너지 ${curStageEnergy}/10으로 재물이 들어올 수 있는 시기예요!` : curStageEnergy <= 3 ? `대운 에너지 ${curStageEnergy}/10으로 지출을 줄이고 절약이 우선일 수 있어요.` : `대운 에너지 ${curStageEnergy}/10이에요.`;

                              if (/뿌리|바탕|복/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 역방향 — 재물복의 기반이 불안정할 수 있어요. ${kw[0]}의 에너지가 흔들려, 돈이 들어와도 새는 구멍이 있을 수 있어요. ${jaeCount === 0 ? '사주에 재성(정재·편재)이 없어 돈이 자연스럽게 모이기보다 노력형 재물운일 수 있어요.' : ''} ${isGi ? `${ohName} 기신이 재물 누수의 원인일 수 있어요.` : ''}`
                                  : `"${cardName}" 정방향 — 재물복의 뿌리가 건실한 편이에요. ${kw.slice(0, 2).join('·')}의 에너지가 돈을 모으고 불리는 능력을 뒷받침해줄 수 있어요. ${jaeCount >= 2 ? '사주에 재성이 2개 이상 있어 재복이 있는 편이에요!' : hasJungjae ? '정재가 있어 꾸준히 모으는 타입일 수 있어요.' : hasPyeonjae ? '편재가 있어 큰 돈을 만질 기회가 있을 수 있어요.' : ''} ${isYong ? `${ohName} 용신이 재물운을 크게 키워줄 수 있어요!` : ''}`;
                              } else if (/현재/.test(pos)) {
                                contextReading = rev
                                  ? `현재 금전운에 주의가 필요할 수 있어요! "${cardName}" 역방향은 예상치 못한 지출이나 손실 가능성을 암시해요. ${daeunMoney} 큰 투자는 미루고 안전한 관리에 집중해보세요.`
                                  : `현재 금전운이 양호한 편이에요! "${cardName}" 정방향은 ${kw[0]}의 에너지로 수입이 안정적일 수 있어요. ${daeunMoney}`;
                              } else if (/미래|흐름/.test(pos)) {
                                contextReading = rev
                                  ? `재물 흐름에 변동이 있을 수 있어요. "${cardName}" 역방향은 재정 계획을 보수적으로 짜는 게 좋을 수 있음을 알려줘요. ${curStageEnergy <= 4 ? '대운이 하락기라 무리한 투자는 자제하고 원금 보전에 집중해보세요.' : '분산 투자와 리스크 관리가 핵심이에요.'}`
                                  : `앞으로 재물운 상승이 기대되는 편이에요! "${cardName}" 정방향의 ${kw.slice(0, 2).join('·')} 에너지가 새로운 수입원이나 재산 증식 기회를 가져다줄 수 있어요. ${curStageEnergy >= 7 ? '대운 상승기와 맞물려 재물 황금기가 될 수도 있어요!' : ''}`;
                              }
                            }
                            // 건강 질문
                            else if (/건강|병|아프|수술|질병/.test(qLow)) {
                              const ilOh = sajuResult.day.cheonganOhaeng;
                              const weakOrgan: Record<string, string> = { '목': '간·담·눈', '화': '심장·혈압·소장', '토': '위장·비장·소화기', '금': '폐·기관지·대장·피부', '수': '신장·방광·생식기' };
                              const myWeak = weakOrgan[ilOh] || '';
                              const gisinWeak = weakOrgan[sajuResult.gisin] || '';

                              if (/체질|약점/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 역방향 — 체질적 취약점에 주의가 필요할 수 있어요! 일간 ${ilOh} 기운으로 ${myWeak} 계통이 약할 수 있고, 기신 ${sajuResult.gisin}으로 인해 ${gisinWeak} 쪽도 관리가 필요할 수 있어요. ${kw[0]}의 에너지 부족이 면역력 저하로 이어질 수 있어요.`
                                  : `"${cardName}" 정방향 — 기본 체력이 양호한 편이에요. 일간 ${ilOh} 기운으로 ${OHAENG_NAMES[ilOh]}의 생명력이 탄탄한 편이에요. ${kw.slice(0, 2).join('·')}의 에너지가 건강의 토대를 만들어줄 수 있어요.${isYong ? ` ${ohName} 용신이 건강을 보호해줄 수 있어요.` : ''} 다만 ${gisinWeak} 계통은 정기 검진을 받아보면 좋을 수 있어요.`;
                              } else if (/현재/.test(pos)) {
                                contextReading = rev
                                  ? `현재 건강에 주의 신호가 있을 수 있어요! "${cardName}" 역방향은 과로·스트레스·불규칙한 생활이 몸에 부담을 줄 수 있어요. ${curStageEnergy <= 4 ? `대운 에너지가 ${curStageEnergy}/10으로 낮아 면역력이 떨어져 있을 수 있어요. 검진을 꼭 받아보세요.` : `대운 에너지가 ${curStageEnergy}/10이지만 방심은 금물이에요.`}${curStage === '병' || curStage === '사' ? ` 현재 대운 ${curStage}운이라 건강관리에 특히 신경 쓰면 좋을 수 있어요!` : ''}`
                                  : `현재 건강 상태가 양호한 편이에요! "${cardName}" 정방향은 활력이 넘치는 시기일 수 있어요. ${curStageEnergy >= 7 ? `대운 에너지 ${curStageEnergy}/10으로 체력이 좋은 시기예요. 운동을 시작하면 효과가 배가 될 수 있어요.` : `대운 에너지 ${curStageEnergy}/10이니 무리하지 않는 선에서 꾸준히 관리해보세요.`}`;
                              } else if (/전망|미래/.test(pos)) {
                                contextReading = rev
                                  ? `건강 관리를 더 강화하면 좋을 수 있어요. "${cardName}" 역방향은 방치하면 악화될 수 있는 부분을 알려줘요. ${weakOrgan[sajuResult.gisin] ? `특히 기신 ${sajuResult.gisin} 관련 ${gisinWeak} 계통을 주기적으로 체크해보세요.` : ''} 예방이 최선이며, 용신 ${sajuResult.yongsin}(${yongOh}) 기운을 보강하는 음식·운동이 도움될 수 있어요.`
                                  : `건강 전망이 밝은 편이에요! "${cardName}" 정방향은 꾸준한 관리가 좋은 결과로 이어질 수 있음을 보여줘요. 용신 ${sajuResult.yongsin}(${yongOh}) 기운을 보강하면 더욱 건강한 삶을 유지할 수 있어요.`;
                              }
                            }
                            // 자녀/출산
                            else if (/자녀|아이|출산|임신/.test(qLow)) {
                              const hourPillar = `${sajuResult.hour.cheongan}${sajuResult.hour.jiji}`;
                              const hasSiksin = sipList.includes('식신');
                              const hasSanggwan = sipList.includes('상관');
                              const childSip = sajuResult.sipseongs.hour;
                              const childNote = hasSiksin ? '식신이 있어 자녀와 정이 깊고 좋은 인연일 수 있어요.' : hasSanggwan ? '상관이 있어 자녀가 개성이 강하고 재능이 있을 수 있어요.' : '';

                              const hcTarot = sajuResult.hasChildren;
                              if (/인연/.test(pos)) {
                                contextReading = rev
                                  ? (hcTarot
                                    ? `"${cardName}" 역방향 — 자녀와의 관계에서 소통 부족이 느껴질 수 있어요. 시주(자녀궁) ${hourPillar}, 시십성 ${childSip}으로 볼 때 ${hasSanggwan ? '상관 기운이 자녀와의 갈등 요인이 될 수 있어요.' : '자녀에게 먼저 다가가는 대화가 필요해요.'} 💡 "잘했어" 대신 "와, 어떻게 그런 생각을 다 했어?"라는 감탄이 아이 자존감을 키울 수 있어요.`
                                    : `"${cardName}" 역방향 — 자녀 인연이 늦어질 수 있어요. 시주(자녀궁) ${hourPillar}, 시십성 ${childSip}으로 볼 때 ${hasSanggwan ? '상관 기운이 출산 시기를 늦추는 요인이 될 수 있어요.' : '서두르기보다 몸과 마음의 준비를 충분히 해보세요.'} ${isGi ? `${ohName} 기신 영향으로 임신 과정에서 스트레스가 있을 수 있어요.` : ''}`)
                                  : (hcTarot
                                    ? `"${cardName}" 정방향 — 자녀와의 관계가 좋은 흐름이에요! 시주(자녀궁) ${hourPillar}, 시십성 ${childSip}으로 볼 때 ${childNote || `${kw[0]}의 에너지가 자녀와의 유대를 더 깊게 해줄 수 있어요.`}${isYong ? ` ${ohName} 용신이 자녀운을 밝게 해줄 수 있어요.` : ''}`
                                    : `"${cardName}" 정방향 — 자녀 인연이 있는 편이에요! 시주(자녀궁) ${hourPillar}, 시십성 ${childSip}으로 볼 때 ${childNote || `${kw[0]}의 에너지가 좋은 아이와의 인연을 이끌어줄 수 있어요.`}${isYong ? ` ${ohName} 용신이 자녀운을 밝게 해줄 수 있어요.` : ''}`);
                              } else if (/현재/.test(pos)) {
                                contextReading = rev
                                  ? (hcTarot
                                    ? `현재 자녀 양육·교육과 관련된 고민이 있을 수 있어요. "${cardName}" 역방향은 스트레스 관리가 우선일 수 있어요. ${curStageEnergy <= 4 ? `대운 에너지가 ${curStageEnergy}/10으로 낮아 부모 자신의 건강부터 챙기세요.` : ''}`
                                    : `현재 자녀/출산 관련 걱정이 있을 수 있어요. "${cardName}" 역방향은 스트레스 관리와 건강 점검이 우선일 수 있어요. ${curStageEnergy <= 4 ? `대운 에너지가 ${curStageEnergy}/10으로 낮아 체력 관리가 중요해요.` : ''}`)
                                  : (hcTarot
                                    ? `현재 자녀운이 좋은 흐름이에요! "${cardName}" 정방향은 자녀와의 관계가 순조로울 수 있어요. ${curStageEnergy >= 6 ? `대운 에너지 ${curStageEnergy}/10으로 자녀 교육에 좋은 성과가 있을 수 있어요.` : ''}`
                                    : `현재 자녀운이 좋은 흐름이에요! "${cardName}" 정방향은 임신/출산 또는 자녀와의 관계가 순조로울 수 있어요. ${curStageEnergy >= 6 ? `대운 에너지 ${curStageEnergy}/10으로 출산에도 좋은 시기일 수 있어요.` : ''}`);
                              } else if (/전망/.test(pos)) {
                                contextReading = rev
                                  ? (hcTarot
                                    ? `자녀 양육에서 인내가 필요한 시기일 수 있어요. "${cardName}" 역방향은 조금 더 기다려야 할 수 있어요. ${hasSanggwan ? '상관 기운으로 자녀와 갈등이 있을 수 있지만, 독립된 인격체로 존중하면 관계가 좋아질 수 있어요.' : ''}`
                                    : `출산/양육 계획은 장기적으로 세우면 좋을 수 있어요. "${cardName}" 역방향은 준비 기간이 더 필요할 수 있어요. ${hasSanggwan ? '상관 기운으로 양육 과정에서 자녀와 갈등이 있을 수 있어요. 💡 사춘기 아이를 통제하기보다 독립된 주체로 인정해주세요.' : ''}`)
                                  : (hcTarot
                                    ? `자녀와의 관계 전망이 밝은 편이에요! "${cardName}" 정방향은 자녀의 성장과 함께 가정에 행복이 깃들 수 있어요. ${hasSiksin ? '식신 기운이 있어 자녀를 잘 키울 수 있는 복이 있을 수 있어요.' : ''}`
                                    : `출산/양육 전망이 밝은 편이에요! "${cardName}" 정방향은 좋은 자녀운과 행복한 가정의 에너지를 보여줘요. ${hasSiksin ? '식신 기운이 있어 자녀를 잘 키울 수 있는 복이 있을 수 있어요.' : ''}`);
                              }
                            }
                            // 이사/이동
                            else if (/이사|이동|이민|해외|유학/.test(qLow)) {
                              const hasYeokma = sipList.includes('편관') || sipList.includes('상관');
                              const moveNote = hasYeokma ? '사주에 이동성이 강한 기운(편관/상관)이 있어 한 곳에 정착하기보다 변화를 통해 발전하는 타입일 수 있어요.' : '사주 구조상 안정을 선호하는 편이라, 이동은 충분히 검토 후 결정하면 좋을 수 있어요.';

                              if (/터전|현재/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 역방향 — 현재 장소의 기운이 맞지 않을 수 있어요. ${moveNote} ${curStageEnergy <= 4 ? `대운 에너지가 ${curStageEnergy}/10으로 낮아 현 장소에서 정체감을 느낄 수 있어요.` : ''} 이동을 고려해볼 만해요.`
                                  : `"${cardName}" 정방향 — 현재 터전의 기운이 나쁘지 않은 편이에요. ${moveNote} ${curStageEnergy >= 6 ? `대운 에너지 ${curStageEnergy}/10이라 현재 위치에서도 발전 가능할 수 있어요.` : ''} 급한 이사보다 시기를 살펴보면 좋을 수 있어요.`;
                              } else if (/필요성/.test(pos)) {
                                contextReading = rev
                                  ? `이동의 필요성이 클 수 있어요! "${cardName}" 역방향은 현 상태 유지가 정체를 부를 수 있다고 알려줘요. ${hasYeokma ? '사주의 이동성 기운과 일치하여, 새로운 환경이 큰 전환점이 될 수 있어요.' : '성격상 변화를 꺼리더라도 지금은 용기가 필요할 수 있어요.'} ${curStage === '장생' || curStage === '관대' ? `대운 ${curStage}운이라 이동해도 잘 적응할 수 있어요.` : ''}`
                                  : `당장 이동의 급박함은 없는 편이에요. "${cardName}" 정방향은 현재 위치에서 충분히 발전 가능함을 보여줘요. ${curStageEnergy >= 7 ? '대운이 좋아 굳이 환경을 바꾸지 않아도 될 수 있어요.' : '시기를 조금 더 지켜보면 좋을 수 있어요.'}`;
                              } else if (/전망|후/.test(pos)) {
                                contextReading = rev
                                  ? `이동 후 적응에 시간이 필요할 수 있어요. "${cardName}" 역방향은 새 환경에서의 어려움을 암시해요. ${isGi ? `${ohName} 기신 영향으로 새 장소에서 스트레스가 클 수 있으니` : ''} 충분히 조사하고 1~2년 적응기를 각오해보세요.`
                                  : `이동 후 좋은 전망이에요! "${cardName}" 정방향은 새로운 곳에서 ${kw[0]}의 에너지가 꽃필 수 있어요. ${isYong ? `${ohName} 용신 에너지가 새 환경과 잘 맞아 빠르게 안착할 수 있어요.` : ''} ${hasYeokma ? '이동성이 강한 사주라 새 환경에서 오히려 날개를 펼칠 수 있어요.' : ''}`;
                              }
                            }
                            // 학업/시험
                            else if (/학업|시험|공부|수능|합격|자격증/.test(qLow)) {
                              const hasJeongin = sipList.includes('정인');
                              const hasPyeonin = sipList.includes('편인');
                              const hasSiksin = sipList.includes('식신');
                              const studyNote = hasJeongin ? '정인이 있어 정통 학문·자격증 공부에 강합니다.' : hasPyeonin ? '편인이 있어 특수 분야·기술·예체능 계열에 적성이 있습니다.' : hasSiksin ? '식신이 있어 창의적 사고와 표현력이 뛰어납니다.' : '';

                              if (/적성/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 역방향 — 현재 학습 방법이 적성에 맞지 않을 수 있어요. ${studyNote || `${kw[0]}의 에너지가 억눌려 있어 공부 방식을 바꿔보면 좋을 수 있어요.`} ${sajuResult.day.cheonganOhaeng === '수' ? '수(水) 일간이라 논리·분석 계열이 적합할 수 있어요.' : sajuResult.day.cheonganOhaeng === '화' ? '화(火) 일간이라 표현·예술·대인 관련 분야가 맞을 수 있어요.' : ''}`
                                  : `"${cardName}" 정방향 — 학업 적성이 좋은 편이에요! ${studyNote || `${kw[0]}의 에너지가 집중력과 이해력을 높여줄 수 있어요.`}${isYong ? ` ${ohName} 용신이 학업운을 크게 밀어줄 수 있어요!` : ''} ${curStageEnergy >= 7 ? `대운 에너지 ${curStageEnergy}/10으로 지금 공부하면 효율이 높을 수 있어요.` : ''}`;
                              } else if (/현재/.test(pos)) {
                                contextReading = rev
                                  ? `현재 학업 효율이 떨어져 있을 수 있어요. "${cardName}" 역방향은 집중력 저하나 동기 부족을 나타낼 수 있어요. ${curStageEnergy <= 4 ? `대운 에너지가 ${curStageEnergy}/10으로 낮아 체력 관리를 병행하면 좋을 수 있어요.` : '환경을 바꾸거나 짧은 휴식이 필요할 수 있어요.'} ${isGi ? `${ohName} 기신 영향이 산만함의 원인일 수 있어요.` : ''}`
                                  : `현재 공부 운이 좋은 편이에요! "${cardName}" 정방향은 학습 효율이 높은 시기일 수 있어요. ${curStageEnergy >= 7 ? `대운 에너지 ${curStageEnergy}/10! 지금 집중하면 시험 합격률이 크게 올라갈 수 있어요.` : `대운 에너지 ${curStageEnergy}/10이니 꾸준한 페이스를 유지해보세요.`}`;
                              } else if (/전망|합격/.test(pos)) {
                                contextReading = rev
                                  ? `합격/성취까지 추가 노력이 필요할 수 있어요. "${cardName}" 역방향은 아직 실력이 완성되지 않았을 수 있음을 알려줘요. ${hasJeongin ? '정인이 있어 기본기는 탄탄하니, 실전 연습을 더 해보세요.' : hasPyeonin ? '편인이 있어 응용력은 있지만 기본기를 다시 점검해보세요.' : '마지막까지 긴장을 늦추지 마세요.'}`
                                  : `합격/성취 전망이 밝은 편이에요! "${cardName}" 정방향은 노력한 만큼 결과가 돌아올 수 있어요. ${hasJeongin ? '정인의 학문 복이 있어 합격 가능성이 높은 편이에요!' : ''} ${curStageEnergy >= 7 ? `대운 에너지 ${curStageEnergy}/10과 함께 최고의 결과를 기대해보세요!` : '꾸준한 노력이 결실을 맺을 수 있어요.'}`;
                              }
                            }
                            // 황금기/운명
                            else if (/황금기|전성기|운명|팔자/.test(qLow)) {
                              const topPillars = daeunResult ? [...daeunResult.pillars].filter(p => p.startAge <= 100).sort((a, b) => {
                                const eA = TWELVE_STAGE_DATA[a.twelveStage as keyof typeof TWELVE_STAGE_DATA]?.energy || 5;
                                const eB = TWELVE_STAGE_DATA[b.twelveStage as keyof typeof TWELVE_STAGE_DATA]?.energy || 5;
                                return eB - eA;
                              }).slice(0, 3) : [];
                              const goldenAges = topPillars.map(p => `${p.startAge}~${p.startAge + 9}세(${p.cheongan}${p.jiji}, ${p.twelveStage}운)`).join(', ');

                              if (/타고난|운명/.test(pos)) {
                                contextReading = rev
                                  ? `"${cardName}" 역방향 — 타고난 운명에 굴곡이 있지만, 이는 성장의 원동력이 될 수 있어요. 사주 구조상 ${sipList.includes('편관') ? '편관이 있어 시련을 통해 강해지는 타입일 수 있어요.' : sipList.includes('상관') ? '상관이 있어 기존 틀을 깨고 새 길을 개척하는 운명일 수 있어요.' : '어려움을 이겨내면 더 큰 성취가 기다릴 수 있어요.'}`
                                  : `"${cardName}" 정방향 — 타고난 운명이 빛나는 편이에요! ${kw.slice(0, 2).join('·')}의 에너지가 인생 전반을 밝혀줄 수 있어요. ${sipList.includes('정관') ? '정관이 있어 사회적 성공의 복이 있는 편이에요.' : sipList.includes('식신') ? '식신이 있어 먹고 사는 복이 있고 삶의 즐거움이 풍부할 수 있어요.' : ''} 용신 ${yongOh} 기운을 잘 살리면 운명이 더욱 빛날 수 있어요.`;
                              } else if (/현재|인생/.test(pos)) {
                                contextReading = rev
                                  ? `현재 인생 흐름이 정체기일 수 있어요. "${cardName}" 역방향은 숨 고르기가 필요한 시기를 나타낼 수 있어요. ${curDaeun ? `현재 대운 ${curDaeun.cheongan}${curDaeun.jiji}(${curStage}운), 에너지 ${curStageEnergy}/10.` : ''} 황금기를 위한 준비 기간이라 생각하고 실력을 쌓아보세요.`
                                  : `현재 좋은 인생 흐름을 타고 있을 수 있어요! "${cardName}" 정방향은 상승기를 나타내요. ${curDaeun ? `현재 대운 ${curDaeun.cheongan}${curDaeun.jiji}(${curStage}운), 에너지 ${curStageEnergy}/10${curStageEnergy >= 7 ? '으로 지금이 인생의 중요한 기회일 수 있어요!' : '이에요.'}` : ''}`;
                              } else if (/최고|시기/.test(pos)) {
                                contextReading = rev
                                  ? `최고의 시기가 오려면 준비가 더 필요할 수 있어요. "${cardName}" 역방향은 아직 때가 아닐 수 있으니 실력과 인맥을 계속 쌓아보세요. ${goldenAges ? `사주상 황금기 TOP 3: ${goldenAges}. 이 시기를 목표로 준비해보세요!` : ''}`
                                  : `최고의 황금기가 다가올 수 있어요! "${cardName}" 정방향의 ${kw.slice(0, 2).join('·')} 에너지가 인생 최고의 순간을 예고해요. ${goldenAges ? `사주상 황금기 TOP 3: ${goldenAges}. 이 시기에 최대의 성과를 거둘 수 있어요!` : ''}`;
                              }
                            }

                            // 일반 질문 fallback
                            if (!contextReading) {
                              contextReading = rev
                                ? `"${cardName}" 역방향이 "${pos}" 자리에서 주의를 알려줘요. ${kw.slice(0, 2).join('·')}의 에너지가 불안정하여, 이 영역에서 신중한 접근이 필요할 수 있어요.${isGi ? ` ${ohName} 기신의 영향이 있을 수 있으니 더욱 조심해보세요.` : ''}`
                                : `"${cardName}" 정방향이 "${pos}" 자리에서 긍정적 에너지를 보내고 있어요. ${kw.slice(0, 2).join('·')}의 힘이 이 영역을 밝혀주고 있을 수 있어요.${isYong ? ` ${ohName} 용신의 보호가 강하게 작용할 수 있어요!` : ''}`;
                            }

                            return (
                              <div className="mb-3 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 rounded-lg p-4 border border-purple-500/30">
                                <h4 className="text-sm font-bold text-amber-300 mb-2">
                                  🎯 [{pos}] "{userQuestion}" 맞춤 해석
                                </h4>
                                <p className="text-base text-gray-100 leading-relaxed">{contextReading}</p>
                              </div>
                            );
                          })()}

                          <div className="mb-3 bg-[#1e1e3f] rounded-lg p-4 border-l-4 border-l-purple-500">
                            <h4 className="text-sm font-bold text-purple-300 mb-1">
                              🔮 {sajuResult.ilgan}({OHAENG_NAMES[sajuResult.day.cheonganOhaeng]}) 사주에 맞춘 해석
                            </h4>
                            <p className="text-base text-gray-200 leading-relaxed">
                              {drawn.isReversed
                                ? drawn.card.ohaengReading[sajuResult.day.cheonganOhaeng].reversed
                                : drawn.card.ohaengReading[sajuResult.day.cheonganOhaeng].upright
                              }
                            </p>
                            {(() => {
                              const cardOh = drawn.card.element;
                              const yongsin = sajuResult.yongsin;
                              const gisin = sajuResult.gisin;
                              const myOh = sajuResult.day.cheonganOhaeng;
                              let harmony = '';
                              if (cardOh === yongsin) harmony = `이 카드의 ${OHAENG_NAMES[cardOh]} 기운은 당신에게 가장 도움이 되는 에너지일 수 있어요! 이 메시지를 특히 주의 깊게 새겨두면 좋을 수 있습니다.`;
                              else if (cardOh === gisin) harmony = `이 카드의 ${OHAENG_NAMES[cardOh]} 기운은 당신이 조심해야 할 에너지일 수 있어요. 경고의 의미가 강할 수 있으니 주의해보세요.`;
                              else if (cardOh === myOh) harmony = `이 카드의 기운이 당신의 타고난 기운과 같은 편이에요. 자신의 본래 성격대로 행동하면 좋은 결과가 있을 수 있어요.`;
                              return harmony ? <div className="text-sm text-amber-300 bg-amber-900/20 rounded-lg px-3 py-2 mt-2">💡 {harmony}</div> : null;
                            })()}
                            {/* 사주↔타로 연결 포인트 */}
                            {(() => {
                              const cardOh = drawn.card.element;
                              const myOh = sajuResult.day.cheonganOhaeng;
                              const SANGSAENG_MAP: Record<string, string> = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
                              const SANGGEUK_MAP: Record<string, string> = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };
                              const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
                              let bridgeText = '';
                              if (SANGSAENG_MAP[myOh] === cardOh) {
                                bridgeText = `당신의 ${OH_KR[myOh]} 일간이 이 카드의 ${OH_KR[cardOh]} 에너지를 생(生)해요 — 이 카드의 메시지를 실천하면 자연스럽게 좋은 결과로 이어질 수 있어요.`;
                              } else if (SANGSAENG_MAP[cardOh] === myOh) {
                                bridgeText = `이 카드의 ${OH_KR[cardOh]} 에너지가 당신의 ${OH_KR[myOh]} 일간을 생(生)해요 — 이 카드가 당신에게 힘과 활력을 보내주고 있을 수 있어요!`;
                              } else if (SANGGEUK_MAP[myOh] === cardOh) {
                                bridgeText = `당신의 ${OH_KR[myOh]} 일간이 이 카드의 ${OH_KR[cardOh]} 에너지를 극(剋)해요 — 이 카드의 경고에 주의를 기울이면 에너지 소모를 줄일 수 있어요.`;
                              } else if (SANGGEUK_MAP[cardOh] === myOh) {
                                bridgeText = `이 카드의 ${OH_KR[cardOh]} 에너지가 당신의 ${OH_KR[myOh]} 일간을 극(剋)해요 — 외부에서 오는 압박이나 도전을 의미할 수 있어요. 신중하게 대응하면 좋을 수 있습니다.`;
                              }
                              return bridgeText ? (
                                <div className="text-sm text-cyan-300 bg-cyan-900/20 rounded-lg px-3 py-2 mt-2 border border-cyan-900/30">
                                  🔗 사주↔타로: {bridgeText}
                                </div>
                              ) : null;
                            })()}
                            {/* 십성 기반 타로 맞춤 조언 */}
                            {(() => {
                              const mSip = sajuResult.sipseongs.month;
                              const hSip = sajuResult.sipseongs.hour;
                              const cOh = drawn.card.element;
                              const isRev = drawn.isReversed;
                              const SIP_TAROT: Record<string, { upright: string; reversed: string }> = {
                                '비견': { upright: '독립적인 성격이라 이 카드의 메시지를 자기 방식대로 해석하면 좋을 수 있어요.', reversed: '경쟁심이 자극될 수 있는 시기예요. 타인과 비교하기보다 나만의 길에 집중해보세요.' },
                                '겁재': { upright: '과감한 결단이 필요할 수 있어요. 이 카드가 용기를 내라는 신호일 수 있습니다.', reversed: '충동적 행동은 자제하는 게 좋을 수 있어요. 한 템포 쉬고 생각해보세요.' },
                                '식신': { upright: '창의적 해결책이 보일 수 있어요. 직감을 믿어보면 좋은 결과가 있을 수 있습니다.', reversed: '과도한 안일함에 빠지지 않도록 주의하면 좋겠어요. 행동으로 옮겨보세요.' },
                                '상관': { upright: '남다른 시각이 장점이 될 수 있어요. 틀을 깨는 발상이 기회가 될 수 있습니다.', reversed: '말실수나 갈등에 주의하면 좋을 수 있어요. 표현은 부드럽게 해보세요.' },
                                '편재': { upright: '재물이나 기회가 다가올 수 있어요. 과감하게 잡되, 리스크 관리도 함께 하면 좋겠어요.', reversed: '재물 손실이나 투자 실패에 주의할 필요가 있을 수 있어요. 안전한 선택이 나을 수 있습니다.' },
                                '정재': { upright: '꾸준한 노력이 결실을 맺을 수 있는 시기예요. 안정적인 방향을 유지해보세요.', reversed: '계획대로 되지 않을 수 있지만, 기본에 충실하면 회복할 수 있어요.' },
                                '편관': { upright: '도전적인 상황이 올 수 있지만, 이겨내면 크게 성장할 수 있어요.', reversed: '외부 압박이 클 수 있어요. 무리하지 말고 건강과 안전을 우선하면 좋겠어요.' },
                                '정관': { upright: '원칙을 지키면 좋은 결과가 따를 수 있어요. 신뢰를 쌓는 시기일 수 있습니다.', reversed: '규칙에 얽매이기보다 유연하게 대처하면 좋을 수 있어요.' },
                                '편인': { upright: '독특한 영감이 떠오를 수 있어요. 남들과 다른 접근이 정답일 수 있습니다.', reversed: '지나친 걱정이나 불안은 내려놓는 게 좋을 수 있어요. 현실에 집중해보세요.' },
                                '정인': { upright: '배움이나 지혜가 도움이 될 수 있어요. 멘토나 어른의 조언을 참고해보세요.', reversed: '의존적인 마음이 생길 수 있어요. 스스로 판단하는 용기를 가져보면 좋겠어요.' },
                              };
                              const mainSip = mSip || hSip;
                              const sipAdvice = SIP_TAROT[mainSip];
                              if (!sipAdvice) return null;
                              return (
                                <div className="text-sm text-emerald-300 bg-emerald-900/20 rounded-lg px-3 py-2 mt-2 border border-emerald-900/30">
                                  🧬 십성({mainSip}) 맞춤: {isRev ? sipAdvice.reversed : sipAdvice.upright}
                                </div>
                              );
                            })()}
                          </div>

                          <details className="mb-2">
                            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300">📖 카드 기본 의미 보기</summary>
                            <div className="mt-2 bg-[#1e1e3f] rounded-lg p-3"><p className="text-sm text-gray-400 leading-relaxed">{drawn.isReversed ? drawn.card.reversed : drawn.card.upright}</p></div>
                          </details>

                          {isPremium && (() => {
                            const questionLower = userQuestion.trim().toLowerCase();
                            let highlightField: 'love' | 'money' | 'health' | 'career' | null = null;
                            if (/결혼|연애|사랑|인연|배우자|바람|외도|이혼/.test(questionLower)) highlightField = 'love';
                            else if (/돈|재물|투자|사업|재복|부자|재테크/.test(questionLower)) highlightField = 'money';
                            else if (/건강|아프|병원|운동|체력/.test(questionLower)) highlightField = 'health';
                            else if (/직업|이직|취업|창업|승진|직장/.test(questionLower)) highlightField = 'career';

                            const fields = ['love', 'money', 'health', 'career'] as const;

                            return (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {(highlightField ? [highlightField, ...fields.filter(f => f !== highlightField)] : fields).map((field) => {
                                  const icons = { love: '❤️', money: '💰', health: '💪', career: '💼' };
                                  const labels = { love: sajuResult?.relationship === 'married' ? '부부운' : sajuResult?.relationship === 'dating' ? '애정운' : '애정운', money: '재물', health: '건강', career: '직업' };
                                  const borderColors = { love: 'border-pink-900/30', money: 'border-amber-900/30', health: 'border-green-900/30', career: 'border-blue-900/30' };
                                  const isHighlight = field === highlightField;
                                  return (
                                    <div key={field} className={`bg-[#1e1e3f] rounded-lg p-2 border ${isHighlight ? 'border-purple-500/60 col-span-2' : borderColors[field]}`}>
                                      <div className={`text-sm mb-0.5 ${isHighlight ? 'text-purple-300 font-bold' : 'text-gray-400'}`}>{icons[field]} {labels[field]} {isHighlight ? '(질문 관련)' : ''}</div>
                                      <p className={`${isHighlight ? 'text-sm text-gray-200' : 'text-base text-gray-300'}`}>{(() => {
                                        const raw = drawn.isReversed ? drawn.card.detailed[field].reversed : drawn.card.detailed[field].upright;
                                        return field === 'love' && sajuResult?.relationship === 'married' ? adaptLoveTextForMarried(raw) : raw;
                                      })()}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 종합 해석 */}
              {reading.cards.every((_, i) => flippedCards.has(i)) && (
                <div className="mt-4 bg-[#0a0a1a] rounded-xl p-5 border border-purple-500/30">
                  <h4 className="text-base font-bold text-purple-300 mb-2">📜 종합 해석</h4>
                  <p className="text-base text-gray-300 leading-relaxed whitespace-pre-line">{reading.overallMessage}</p>
                </div>
              )}

              {/* 다른 스프레드로 다시 뽑기 */}
              <div className="flex gap-2 justify-center mt-4">
                <button onClick={() => handleReshuffle('one')} className="text-sm px-3 py-1.5 rounded-full border border-purple-900/30 text-gray-400 hover:text-purple-300 hover:border-purple-500">1장 다시 뽑기</button>
                <button onClick={() => handleReshuffle('three')} className="text-sm px-3 py-1.5 rounded-full border border-purple-900/30 text-gray-400 hover:text-purple-300 hover:border-purple-500">3장 다시 뽑기</button>
                {isPremium && <button onClick={() => handleReshuffle('celtic')} className="text-sm px-3 py-1.5 rounded-full border border-purple-900/30 text-gray-400 hover:text-purple-300 hover:border-purple-500">10장 켈틱크로스</button>}
              </div>
            </div>
          )}

          {/* 자유질문 섹션 제거됨 */}
        </div>
        </>
      )}

    </div>
  );
}
