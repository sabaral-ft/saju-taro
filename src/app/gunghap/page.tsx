'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { analyzeSaju } from '@/lib/saju-engine';
import type { SajuResult } from '@/lib/saju-engine';
import { OHAENG_COLOR } from '@/lib/saju-engine';
import type { Ohaeng } from '@/lib/saju-engine';
import { analyzeGunghap } from '@/lib/gunghap';
import type { GunghapResult, GunghapCategory } from '@/lib/gunghap';
import { validateBirthDate, safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/date-validator';
import { drawRandomCards } from '@/data/tarot-cards';
import type { TarotCard } from '@/data/tarot-cards';

type Step = 'input' | 'result';

interface PersonInput {
  year: string;
  month: string;
  day: string;
  hour: string;
  gender: 'male' | 'female';
  label: string;
}

const STORAGE_KEY = 'btx-gunghap-inputs';

const HOUR_OPTIONS = [
  { value: '0', label: '자시 (23~01)' },
  { value: '1', label: '축시 (01~03)' },
  { value: '3', label: '인시 (03~05)' },
  { value: '5', label: '묘시 (05~07)' },
  { value: '7', label: '진시 (07~09)' },
  { value: '9', label: '사시 (09~11)' },
  { value: '11', label: '오시 (11~13)' },
  { value: '13', label: '미시 (13~15)' },
  { value: '15', label: '신시 (15~17)' },
  { value: '17', label: '유시 (17~19)' },
  { value: '19', label: '술시 (19~21)' },
  { value: '21', label: '해시 (21~23)' },
];

// ========== PersonForm — 외부 컴포넌트로 분리 (리렌더 시 input 포커스 유지) ==========
const PersonForm = memo(function PersonForm({ person, onChange, colorClass }: {
  person: PersonInput;
  onChange: (field: keyof PersonInput, value: string) => void;
  colorClass: string;
}) {
  return (
    <div className={`bg-[#1e1e3f] rounded-2xl p-6 border ${colorClass}`}>
      <h3 className="text-lg font-bold text-center mb-4 text-purple-300">{person.label}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">년(양력)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="1990"
              autoComplete="off"
              value={person.year}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                onChange('year', v);
              }}
              className="w-full px-2 py-2.5 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white text-base text-center tracking-widest focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">월</label>
            <select
              value={person.month}
              onChange={e => onChange('month', e.target.value)}
              className="w-full px-2 py-2.5 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
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
              value={person.day}
              onChange={e => onChange('day', e.target.value)}
              className="w-full px-2 py-2.5 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
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
            value={person.hour}
            onChange={e => onChange('hour', e.target.value)}
            className="w-full px-2 py-2.5 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
          >
            {HOUR_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">성별</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange('gender', 'male')}
              className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${
                person.gender === 'male'
                  ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              남성
            </button>
            <button
              type="button"
              onClick={() => onChange('gender', 'female')}
              className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${
                person.gender === 'female'
                  ? 'border-pink-500 bg-pink-900/30 text-pink-300'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              여성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ========== 궁합 타로 해석 ==========
interface GunghapTarotReading {
  card: TarotCard;
  isReversed: boolean;
  position: string;
  reading: string;
}

function generateGunghapTarot(p1: SajuResult, p2: SajuResult, gunghap: GunghapResult): GunghapTarotReading[] {
  const drawn = drawRandomCards(5);
  const oh1 = p1.day.cheonganOhaeng;
  const oh2 = p2.day.cheonganOhaeng;
  const positions = [
    '현재 두 사람의 에너지',
    '관계의 강점',
    '관계의 과제',
    '6개월 후 전망',
    '1년 후 전망',
  ];

  return drawn.map(({ card, isReversed }, i) => {
    const position = positions[i];
    let reading = '';

    // 오행별 특수 해석 활용
    const combinedOhaeng = (i % 2 === 0) ? oh1 : oh2;
    const ohaengReading = card.ohaengReading[combinedOhaeng];
    const baseReading = isReversed ? ohaengReading.reversed : ohaengReading.upright;

    // 포지션별 맥락 해석
    switch (i) {
      case 0: { // 현재 에너지
        const energyLevel = gunghap.totalScore >= 70 ? '높은' : gunghap.totalScore >= 50 ? '안정적인' : '변화가 필요한';
        reading = `두 사람 사이에 ${energyLevel} 에너지가 흐르고 있습니다. ${baseReading}`;
        if (card.element === oh1 || card.element === oh2) {
          reading += ` 특히 ${card.element}(${card.element === oh1 ? '본인' : '상대'})의 기운과 공명하여 더욱 강한 영향을 미칩니다.`;
        }
        break;
      }
      case 1: { // 관계 강점
        const strength = gunghap.strengths.length > 0 ? gunghap.strengths[0].replace(/^[^\s]+\s/, '') : '서로를 이해하려는 마음';
        reading = `이 관계의 가장 큰 강점은 "${strength}"입니다. ${baseReading}`;
        if (!isReversed) {
          reading += ' 이 카드는 두 사람의 장점이 더욱 빛날 것임을 알려줍니다.';
        } else {
          reading += ' 다만 이 강점을 당연시하지 말고, 의식적으로 가꿔나가세요.';
        }
        break;
      }
      case 2: { // 관계 과제
        const caution = gunghap.cautions.length > 0 ? gunghap.cautions[0].replace(/^[^\s]+\s/, '') : '서로의 차이를 인정하는 것';
        reading = `두 사람이 함께 풀어야 할 과제는 "${caution}"입니다. ${baseReading}`;
        if (!isReversed) {
          reading += ' 이 과제를 잘 해결하면 관계가 한 단계 더 깊어질 수 있습니다.';
        } else {
          reading += ' 서로에게 솔직한 대화가 필요한 시점입니다. 마음을 열고 이야기해보세요.';
        }
        break;
      }
      case 3: { // 6개월 후
        reading = `향후 6개월, ${baseReading}`;
        if (!isReversed && card.element === p1.yongsin) {
          reading += ` ${card.name} 카드가 본인의 용신(${p1.yongsin})과 같은 기운이라 특히 좋은 시기가 될 수 있습니다.`;
        } else if (!isReversed && card.element === p2.yongsin) {
          reading += ` ${card.name} 카드가 상대의 용신(${p2.yongsin})과 통하여 상대에게 좋은 변화가 생길 수 있습니다.`;
        } else if (isReversed) {
          reading += ' 이 시기에는 서로에게 여유를 주고, 급한 결정은 피하는 것이 좋겠습니다.';
        }
        break;
      }
      case 4: { // 1년 후
        const outlook = gunghap.totalScore >= 70 ? '밝은' : gunghap.totalScore >= 50 ? '성장 가능성이 있는' : '전환점이 될';
        reading = `1년 후, ${outlook} 미래가 보입니다. ${baseReading}`;
        if (card.arcana === 'major') {
          reading += ` 메이저 아르카나 "${card.name}"이 나온 것은 이 관계에 중대한 전환점이 올 수 있음을 시사합니다.`;
        }
        if (!isReversed) {
          reading += ' 두 사람이 함께 노력한다면 더 좋은 결실을 맺을 수 있습니다.';
        } else {
          reading += ' 변화가 필요한 시기일 수 있습니다. 서로의 기대를 조율해보세요.';
        }
        break;
      }
    }

    return { card, isReversed, position, reading };
  });
}

export default function GunghapPage() {
  const [step, setStep] = useState<Step>('input');
  const [person1, setPerson1] = useState<PersonInput>({
    year: '', month: '', day: '', hour: '12', gender: 'male', label: '본인',
  });
  const [person2, setPerson2] = useState<PersonInput>({
    year: '', month: '', day: '', hour: '12', gender: 'female', label: '상대방',
  });
  const [saju1, setSaju1] = useState<SajuResult | null>(null);
  const [saju2, setSaju2] = useState<SajuResult | null>(null);
  const [gunghapResult, setGunghapResult] = useState<GunghapResult | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [tarotReadings, setTarotReadings] = useState<GunghapTarotReading[] | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);

  // ========== localStorage 저장/복원 ==========
  useEffect(() => {
    const saved = safeGetItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.person1) setPerson1(prev => ({ ...prev, ...data.person1 }));
        if (data.person2) setPerson2(prev => ({ ...prev, ...data.person2 }));
      } catch { /* ignore */ }
    }
  }, []);

  // 디바운스 저장 (타이핑 중 매번 저장하지 않고, 500ms 후 한번만)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSave = useCallback((p1: PersonInput, p2: PersonInput) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const data = {
        person1: { year: p1.year, month: p1.month, day: p1.day, hour: p1.hour, gender: p1.gender },
        person2: { year: p2.year, month: p2.month, day: p2.day, hour: p2.hour, gender: p2.gender },
      };
      safeSetItem(STORAGE_KEY, JSON.stringify(data));
    }, 500);
  }, []);

  // 필드 단위로 업데이트하는 핸들러
  const handlePerson1Change = useCallback((field: keyof PersonInput, value: string) => {
    setPerson1(prev => {
      const next = { ...prev, [field]: value };
      debouncedSave(next, person2);
      return next;
    });
  }, [person2, debouncedSave]);

  const handlePerson2Change = useCallback((field: keyof PersonInput, value: string) => {
    setPerson2(prev => {
      const next = { ...prev, [field]: value };
      debouncedSave(person1, next);
      return next;
    });
  }, [person1, debouncedSave]);

  function handleClearInputs() {
    setPerson1({ year: '', month: '', day: '', hour: '12', gender: 'male', label: '본인' });
    setPerson2({ year: '', month: '', day: '', hour: '12', gender: 'female', label: '상대방' });
    setPrivacyAgreed(false);
    setShowPrivacyDetail(false);
    safeRemoveItem(STORAGE_KEY);
  }

  function handleAnalyze() {
    if (!privacyAgreed) {
      alert('개인정보 수집·이용에 동의해주세요.');
      return;
    }

    const y1 = parseInt(person1.year), m1 = parseInt(person1.month), d1 = parseInt(person1.day), h1 = parseInt(person1.hour);
    const y2 = parseInt(person2.year), m2 = parseInt(person2.month), d2 = parseInt(person2.day), h2 = parseInt(person2.hour);

    const check1 = validateBirthDate(y1, m1, d1);
    if (!check1.valid) {
      alert(`본인: ${check1.error}`);
      return;
    }
    const check2 = validateBirthDate(y2, m2, d2);
    if (!check2.valid) {
      alert(`상대방: ${check2.error}`);
      return;
    }

    let result1: SajuResult, result2: SajuResult;
    try {
      result1 = analyzeSaju(y1, m1, d1, h1);
      result2 = analyzeSaju(y2, m2, d2, h2);
    } catch (err) {
      alert(err instanceof Error ? err.message : '사주 분석 중 오류가 발생했습니다. 날짜를 확인해주세요.');
      return;
    }
    setSaju1(result1);
    setSaju2(result2);

    try {
      const gunghap = analyzeGunghap(result1, result2);
      setGunghapResult(gunghap);

      // 궁합 타로 자동 생성
      const readings = generateGunghapTarot(result1, result2, gunghap);
      setTarotReadings(readings);
    } catch (err) {
      alert(err instanceof Error ? err.message : '궁합 분석 중 오류가 발생했습니다.');
      return;
    }
    setExpandedCategory(null);
    setStep('result');
  }

  function ScoreCircle({ score, size = 120 }: { score: number; size?: number }) {
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? '#f472b6' : score >= 60 ? '#a78bfa' : score >= 40 ? '#60a5fa' : '#94a3b8';

    return (
      <svg width={size} height={size} className="mx-auto">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e1e3f" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
        <text x={size / 2} y={size / 2 - 8} textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">
          {score}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="#9ca3af" fontSize="12">
          / 100
        </text>
      </svg>
    );
  }

  function CategoryCard({ category }: { category: GunghapCategory }) {
    const isExpanded = expandedCategory === category.name;
    const barColor = category.score >= 80 ? 'bg-pink-500' : category.score >= 60 ? 'bg-purple-500' : category.score >= 40 ? 'bg-blue-500' : 'bg-gray-500';

    return (
      <div
        className="bg-[#0a0a1a] rounded-xl p-4 border border-purple-900/20 cursor-pointer hover:border-purple-500/50 transition-all"
        onClick={() => setExpandedCategory(isExpanded ? null : category.name)}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl">{category.emoji}</span>
          <span className="text-sm font-bold text-white flex-1">{category.name}</span>
          <span className="text-sm font-bold text-purple-300">{category.score}점</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${category.score}%` }}
          />
        </div>
        <p className="text-xs text-gray-300">{category.description}</p>

        {/* 좋은 이유 / 안 좋은 이유 뱃지 */}
        <div className="flex items-center gap-2 mt-2">
          {category.score >= 70 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-green-900/40 text-green-400 border border-green-800/50">
              좋은 궁합
            </span>
          )}
          {category.score >= 50 && category.score < 70 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">
              보통
            </span>
          )}
          {category.score < 50 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-red-900/40 text-red-400 border border-red-800/50">
              주의 필요
            </span>
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-purple-900/30 space-y-3">
            <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">{category.detail}</p>

            {/* 좋은 이유 상세 */}
            {category.score >= 60 && (
              <div className="bg-green-900/20 rounded-lg p-3 border border-green-800/30">
                <h5 className="text-xs font-bold text-green-400 mb-1">이 항목이 좋은 이유</h5>
                <p className="text-[11px] text-green-300/80 leading-relaxed">
                  {getGoodReasonDetail(category)}
                </p>
              </div>
            )}

            {/* 안 좋은 이유 / 주의할 점 상세 */}
            {category.score < 70 && (
              <div className="bg-amber-900/20 rounded-lg p-3 border border-amber-800/30">
                <h5 className="text-xs font-bold text-amber-400 mb-1">
                  {category.score < 50 ? '이 항목이 약한 이유' : '주의할 점'}
                </h5>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  {getCautionReasonDetail(category)}
                </p>
              </div>
            )}

            {/* 개선 팁 */}
            <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-800/30">
              <h5 className="text-xs font-bold text-purple-400 mb-1">관계 개선 팁</h5>
              <p className="text-[11px] text-purple-300/80 leading-relaxed">
                {getImprovementTip(category)}
              </p>
            </div>
          </div>
        )}
        <div className="text-[10px] text-purple-400 mt-1 text-right">
          {isExpanded ? '접기 ▲' : '상세보기 ▼'}
        </div>
      </div>
    );
  }

  // ========== 타로 카드 시각화 (클릭 뒤집기) ==========
  function TarotCardVisual({ reading, index }: { reading: GunghapTarotReading; index: number }) {
    const { card, isReversed, position, reading: text } = reading;
    const isFlipped = flippedCards.has(index);

    const elementColors: Record<string, string> = {
      '목': 'from-green-800 to-emerald-900',
      '화': 'from-red-800 to-orange-900',
      '토': 'from-yellow-800 to-amber-900',
      '금': 'from-gray-600 to-slate-800',
      '수': 'from-blue-800 to-indigo-900',
    };
    const bgGradient = elementColors[card.element] || 'from-purple-800 to-indigo-900';

    function handleFlip() {
      if (!isFlipped) {
        setFlippedCards(prev => new Set(prev).add(index));
      }
    }

    // 카드 뒷면 (아직 안 뒤집음)
    if (!isFlipped) {
      return (
        <div
          onClick={handleFlip}
          className="cursor-pointer group"
        >
          <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 rounded-xl border-2 border-purple-500/40 p-6 text-center hover:border-purple-400/70 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
            <div className="text-[10px] text-purple-300/70 mb-2 uppercase tracking-wider">{position}</div>
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
              {index === 0 ? '🔮' : index === 1 ? '💫' : index === 2 ? '⚡' : index === 3 ? '🌙' : '☀️'}
            </div>
            <div className="w-12 h-0.5 bg-purple-500/30 mx-auto mb-3" />
            <div className="text-sm text-purple-300/80 font-medium">카드를 터치하세요</div>
            <div className="text-[10px] text-purple-400/50 mt-1">tap to reveal</div>
          </div>
        </div>
      );
    }

    // 카드 앞면 (뒤집힌 후)
    return (
      <div className="card-reveal">
        <div className="bg-[#0a0a1a] rounded-xl border border-purple-900/30 overflow-hidden">
          {/* 카드 헤더 */}
          <div className={`bg-gradient-to-br ${bgGradient} p-4`}>
            <div className="text-center">
              <div className="text-[10px] text-white/60 mb-1">{position}</div>
              <div className="text-lg font-bold text-white">
                {card.name} {isReversed ? '(역방향)' : ''}
              </div>
              <div className="text-xs text-white/70 mt-1">
                {card.arcana === 'major' ? '메이저 아르카나' : `${card.suit} ${card.number}`}
                {' · '}{card.element} 원소
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {card.keywords.slice(0, 3).map((kw, ki) => (
                  <span key={ki} className="px-2 py-0.5 bg-black/30 rounded-full text-[10px] text-white/80">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* 해석 */}
          <div className="p-4">
            <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-2 text-purple-300">
        사주 궁합 분석
      </h1>
      <p className="text-center text-gray-400 text-sm mb-8">
        두 사람의 사주팔자를 비교하여 궁합을 분석합니다
      </p>

      {/* Step 1: 입력 */}
      {step === 'input' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PersonForm
              person={person1}
              onChange={handlePerson1Change}
              colorClass="border-blue-900/30"
            />
            <PersonForm
              person={person2}
              onChange={handlePerson2Change}
              colorClass="border-pink-900/30"
            />
          </div>

          <div className="text-center text-4xl">💕</div>

          {/* 개인정보 수집·이용 동의 */}
          <div className="bg-[#1e1e3f] rounded-xl p-4 border border-purple-900/30">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAgreed}
                onChange={e => setPrivacyAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-purple-500 bg-[#0a0a1a] text-purple-500 focus:ring-purple-500 accent-purple-500 shrink-0"
              />
              <span className="text-xs text-gray-300 leading-relaxed">
                <span className="text-purple-300 font-bold">[필수]</span> 개인정보 수집·이용에 동의합니다.
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowPrivacyDetail(!showPrivacyDetail)}
              className="mt-2 ml-7 text-[11px] text-purple-400 underline underline-offset-2 hover:text-purple-300"
            >
              {showPrivacyDetail ? '내용 접기' : '자세히 보기'}
            </button>
            {showPrivacyDetail && (
              <div className="mt-3 ml-7 bg-[#0a0a1a] rounded-lg p-3 border border-purple-900/20 text-[11px] text-gray-400 leading-relaxed space-y-2">
                <p className="font-bold text-gray-300">개인정보 수집·이용 안내</p>
                <p><span className="text-gray-300">수집 항목:</span> 생년월일, 태어난 시간, 성별</p>
                <p><span className="text-gray-300">수집 목적:</span> 사주팔자 기반 궁합 분석 서비스 제공</p>
                <p><span className="text-gray-300">보관 방법:</span> 사용자 기기의 브라우저(localStorage)에만 저장되며, 외부 서버로 전송되지 않습니다.</p>
                <p><span className="text-gray-300">보관 기간:</span> 사용자가 직접 삭제(입력 초기화)하거나 브라우저 데이터를 삭제할 때까지</p>
                <p><span className="text-gray-300">동의 거부 권리:</span> 동의를 거부할 수 있으며, 이 경우 궁합 분석 서비스를 이용할 수 없습니다.</p>
                <p className="text-purple-400/80 pt-1 border-t border-purple-900/30">
                  * 입력하신 정보는 오직 사주 분석 목적으로만 사용되며, 서버에 저장·전송되지 않습니다.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!privacyAgreed}
            className={`w-full py-3 font-bold rounded-xl text-lg transition-all duration-300 ${
              privacyAgreed
                ? 'bg-gradient-to-r from-pink-600 to-purple-800 hover:from-pink-500 hover:to-purple-700 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            궁합 분석하기
          </button>

          {/* 입력 초기화 버튼 */}
          {(person1.year || person1.month || person1.day || person2.year || person2.month || person2.day) && (
            <button
              onClick={handleClearInputs}
              className="w-full py-2 border border-gray-700 text-gray-400 rounded-xl text-sm hover:border-red-500 hover:text-red-400 transition-colors"
            >
              입력 초기화
            </button>
          )}
        </div>
      )}

      {/* Step 2: 결과 */}
      {step === 'result' && gunghapResult && saju1 && saju2 && (
        <div className="space-y-6">
          {/* 두 사람 사주 요약 */}
          <div className="grid grid-cols-2 gap-4">
            {[{ saju: saju1, label: person1.label }, { saju: saju2, label: person2.label }].map(({ saju, label }) => (
              <div key={label} className="bg-[#1e1e3f] rounded-xl p-4 border border-purple-900/30 text-center">
                <div className="text-sm text-gray-400 mb-2">{label}</div>
                <div className="flex justify-center gap-1 mb-2">
                  {(['year', 'month', 'day', 'hour'] as const).map((key) => (
                    <div key={key} className="text-center">
                      <span className="text-lg font-bold" style={{ color: OHAENG_COLOR[saju[key].cheonganOhaeng] }}>
                        {saju[key].cheongan}
                      </span>
                      <span className="text-lg font-bold" style={{ color: OHAENG_COLOR[saju[key].jijiOhaeng] }}>
                        {saju[key].jiji}
                      </span>
                      {key !== 'hour' && <span className="text-gray-600 mx-0.5">|</span>}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400">
                  일간: <span className="text-white font-bold">{saju.ilgan}</span>
                  ({OHAENG_COLOR[saju.day.cheonganOhaeng] ? saju.day.cheonganOhaeng : ''})
                  | {saju.animal}띠
                  | 용신: <span className="font-bold" style={{ color: OHAENG_COLOR[saju.yongsin] }}>{saju.yongsin}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 종합 점수 */}
          <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-purple-900/30 text-center">
            <h2 className="text-lg font-bold text-purple-300 mb-4">궁합 종합 점수</h2>
            <ScoreCircle score={gunghapResult.totalScore} />
            <div className="mt-4">
              <span className="text-3xl">{gunghapResult.gradeEmoji}</span>
              <h3 className="text-xl font-bold text-white mt-2">{gunghapResult.grade}</h3>
            </div>
            <p className="text-sm text-gray-300 mt-4 leading-relaxed max-w-lg mx-auto">
              {gunghapResult.summary}
            </p>
          </div>

          {/* 카테고리별 점수 */}
          <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
            <h3 className="text-lg font-bold text-center mb-4 text-purple-300">항목별 궁합</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CategoryCard category={gunghapResult.categories.ilgan} />
              <CategoryCard category={gunghapResult.categories.ohaeng} />
              <CategoryCard category={gunghapResult.categories.cheonganHap} />
              <CategoryCard category={gunghapResult.categories.jijiHap} />
              <CategoryCard category={gunghapResult.categories.ddi} />
              <CategoryCard category={gunghapResult.categories.yongsin} />
            </div>
          </div>

          {/* 장점/주의점 (개선된 레이아웃) */}
          {(gunghapResult.strengths.length > 0 || gunghapResult.cautions.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gunghapResult.strengths.length > 0 && (
                <div className="bg-[#1e1e3f] rounded-xl p-5 border border-green-900/30">
                  <h4 className="text-sm font-bold text-green-400 mb-3">궁합이 좋은 이유</h4>
                  <ul className="space-y-2">
                    {gunghapResult.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                        <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {gunghapResult.cautions.length > 0 && (
                <div className="bg-[#1e1e3f] rounded-xl p-5 border border-amber-900/30">
                  <h4 className="text-sm font-bold text-amber-400 mb-3">주의가 필요한 이유</h4>
                  <ul className="space-y-2">
                    {gunghapResult.cautions.map((c, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5 shrink-0">!</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 연애 조언 */}
          <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-pink-900/30">
            <h3 className="text-lg font-bold text-center mb-3 text-pink-300">연애 조언</h3>
            <p className="text-sm text-gray-300 leading-relaxed text-center max-w-lg mx-auto">
              {gunghapResult.loveAdvice}
            </p>
          </div>

          {/* 미래 예측 타로 섹션 — 항상 펼침 */}
          {tarotReadings && (
            <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-indigo-900/30">
              <h3 className="text-lg font-bold text-center text-indigo-300 mb-1">미래 예측 타로</h3>
              <p className="text-xs text-gray-400 text-center mb-4">
                두 사람의 사주 에너지를 기반으로 5장의 타로를 뽑아 미래를 점칩니다
              </p>
              <div className="space-y-3">
                {tarotReadings.map((reading, i) => (
                  <TarotCardVisual key={i} reading={reading} index={i} />
                ))}
                {flippedCards.size < tarotReadings.length && (
                  <p className="text-center text-xs text-purple-400/60 animate-pulse">
                    카드를 하나씩 터치하여 운명을 확인하세요
                  </p>
                )}
                {flippedCards.size === tarotReadings.length && (
                  <button
                    onClick={() => {
                      if (saju1 && saju2 && gunghapResult) {
                        setTarotReadings(generateGunghapTarot(saju1, saju2, gunghapResult));
                        setFlippedCards(new Set());
                      }
                    }}
                    className="w-full py-2 border border-indigo-700 text-indigo-300 rounded-lg text-sm hover:bg-indigo-900/30 transition-colors"
                  >
                    타로 다시 뽑기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 다시하기 (입력값 유지) */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setStep('input');
                setGunghapResult(null);
                setSaju1(null);
                setSaju2(null);
                setExpandedCategory(null);
                setTarotReadings(null);
                setFlippedCards(new Set());
                // person1, person2는 유지! localStorage에 이미 저장되어 있음
              }}
              className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-800 text-white rounded-lg hover:from-pink-500 hover:to-purple-700 transition-all"
            >
              다시 분석하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 상세 이유 헬퍼 함수들 ==========

function getGoodReasonDetail(category: GunghapCategory): string {
  const { name, score } = category;
  switch (name) {
    case '일간 궁합':
      if (score >= 90) return '일간끼리 천간합을 이루고 있어, 서로에게 자연스럽게 끌리는 최고의 인연입니다. 합(合)은 두 기운이 만나 새로운 하나를 만드는 것으로, 함께할 때 시너지가 극대화됩니다.';
      if (score >= 80) return '일간의 오행이 상생 관계로, 한 사람이 다른 사람을 자연스럽게 도와주는 구조입니다. 배려와 지지가 자연스럽게 이루어지는 편안한 관계입니다.';
      return '일간의 오행이 서로 보완적이거나 비슷하여 기본적인 이해가 가능한 관계입니다. 서로의 성격을 이해하기 쉬워 소통이 원활합니다.';
    case '오행 밸런스':
      if (score >= 80) return '두 사람의 오행을 합하면 목·화·토·금·수가 고르게 분포됩니다. 함께 있을 때 삶의 균형이 잡히고, 서로에게 부족한 기운을 자연스럽게 채워줍니다.';
      return '두 사람의 오행 조합이 어느 정도 균형을 이루고 있어, 서로에게 필요한 에너지를 주고받을 수 있는 관계입니다.';
    case '천간합':
      if (score >= 90) return '여러 기둥의 천간이 합을 이루어, 다방면에서 인연의 끈이 강합니다. 사업, 연애, 가정 등 어떤 관계로 만나도 좋은 결과를 기대할 수 있습니다.';
      if (score >= 70) return '천간 합이 존재하여 서로에게 호감을 느끼기 쉬운 관계입니다. 합이 이루어진 기둥의 영역(연주=부모/사회, 월주=직장/사회, 일주=배우자, 시주=자녀/미래)에서 특히 좋은 궁합을 보입니다.';
      return '기본적인 천간합이 있어 인연의 끈이 존재합니다.';
    case '지지 합충':
      if (score >= 80) return '지지끼리 육합이 여러 개 이루어져, 실생활에서의 궁합이 매우 좋습니다. 지지는 실제 행동과 환경을 나타내므로, 함께 생활할 때 자연스럽게 맞는 부분이 많습니다.';
      return '지지 간 합이 존재하여 일상에서의 조화가 기대됩니다. 생활 패턴이나 가치관이 자연스럽게 맞는 부분이 있습니다.';
    case '띠 궁합':
      if (score >= 85) return '띠끼리 육합 또는 삼합으로, 전통적으로 가장 좋은 궁합으로 여겨지는 조합입니다. 시대를 막론하고 인정받는 최고의 띠 궁합으로, 부모님이 보셔도 합격입니다!';
      return '띠 궁합이 좋아 세대 간 이해나 주변의 시선도 긍정적입니다.';
    case '용신 보완':
      if (score >= 80) return '상대방이 나에게 필요한 오행(용신)을 풍부하게 갖고 있어, 함께 있으면 실제로 운이 좋아지는 효과가 있습니다. 이것은 사주학에서 가장 실질적인 궁합 요소입니다.';
      return '서로의 용신 오행을 어느 정도 보완해주고 있어, 함께 있을 때 긍정적인 에너지를 주고받을 수 있습니다.';
    default:
      return '이 항목에서 좋은 점수를 받았습니다.';
  }
}

function getCautionReasonDetail(category: GunghapCategory): string {
  const { name, score } = category;
  switch (name) {
    case '일간 궁합':
      if (score < 45) return '일간의 오행이 상극 관계로, 한 사람이 다른 사람의 기운을 무의식적으로 억누를 수 있습니다. 통제하려는 성향이 나타나기 쉽고, 상대가 답답함을 느낄 수 있습니다. 하지만 상극도 적절히 활용하면 서로를 단련시키는 긍정적 긴장감이 됩니다.';
      return '일간 궁합이 보통 수준으로, 특별한 끌림보다는 노력으로 관계를 만들어가야 합니다. 서로의 차이점을 이해하고 존중하는 자세가 필요합니다.';
    case '오행 밸런스':
      if (score < 50) return '두 사람의 오행이 비슷하게 치우쳐 있어, 합치면 특정 오행이 과다하고 다른 오행은 부족해집니다. 예를 들어 화(火)가 과다하면 급한 성격이 증폭되고, 수(水)가 부족하면 유연성이 떨어질 수 있습니다.';
      return '오행 밸런스에 약간의 편중이 있습니다. 의식적으로 부족한 오행과 관련된 활동(운동, 취미 등)을 함께하면 보완할 수 있습니다.';
    case '천간합':
      return '천간 간 직접적인 합이 없어 처음에 강한 끌림을 느끼기 어려울 수 있습니다. 하지만 천간합이 없다고 궁합이 나쁜 것은 아니며, 지지합이나 오행 보완 등 다른 요소가 이를 충분히 보완할 수 있습니다.';
    case '지지 합충':
      if (score < 40) return '지지 간 충(沖)이나 형(刑)이 존재하여, 일상생활에서 가치관 충돌이나 의견 대립이 생기기 쉽습니다. 특히 일지끼리의 충은 부부간 갈등을, 연지끼리의 충은 가문 간 갈등을 암시할 수 있습니다. 대화와 양보가 핵심입니다.';
      return '지지 관계가 평범하여 특별한 합도 충도 없는 무난한 관계입니다. 적극적으로 공감대를 만들어가는 노력이 필요합니다.';
    case '띠 궁합':
      if (score < 40) return '띠끼리 육충(六沖) 관계로, 전통적으로 주의가 필요한 조합입니다. 정반대의 에너지라 강한 끌림이 있을 수 있지만, 갈등도 클 수 있습니다. 다만 현대에서 띠 궁합의 비중은 크지 않으니 다른 요소를 종합적으로 판단하세요.';
      return '띠 궁합이 평범한 수준입니다. 서로의 노력에 따라 충분히 좋은 관계를 만들 수 있습니다.';
    case '용신 보완':
      if (score < 40) return '서로의 용신 오행을 보완해주지 못하거나, 오히려 기신(忌神)을 강화하는 관계일 수 있습니다. 함께 있을 때 운이 안 풀리는 느낌을 받을 수 있습니다. 개인적인 용신 보강(색상, 방향, 음식 등)으로 보완하세요.';
      return '용신 보완이 약한 편이지만, 궁합은 한 가지 요소로만 판단하지 않습니다. 다른 좋은 요소들이 이를 충분히 상쇄할 수 있습니다.';
    default:
      return '이 항목에서 주의가 필요합니다.';
  }
}

function getImprovementTip(category: GunghapCategory): string {
  switch (category.name) {
    case '일간 궁합':
      return category.score >= 70
        ? '이미 좋은 관계이므로, 서로에 대한 감사함을 자주 표현하세요. 당연하다고 여기지 않는 것이 관계를 오래 유지하는 비결입니다.'
        : '서로의 다름을 인정하는 것이 출발점입니다. 상대의 장점을 3가지 적어보고, 매일 하나씩 칭찬해보세요. 작은 실천이 큰 변화를 만듭니다.';
    case '오행 밸런스':
      return category.score >= 70
        ? '함께 여행을 가거나 새로운 경험을 하면 오행 에너지가 더욱 활성화됩니다. 자연 속 활동이 특히 좋습니다.'
        : '부족한 오행을 보완하는 활동을 함께하세요. 목(木)은 산책, 화(火)는 요리, 토(土)는 원예, 금(金)은 음악, 수(水)는 수영이나 온천이 도움됩니다.';
    case '천간합':
      return category.score >= 70
        ? '천간합의 에너지를 활용하여, 서로 중요한 결정을 함께 내려보세요. 두 사람의 의견이 합쳐질 때 최고의 결과가 나옵니다.'
        : '천간합이 없더라도, 함께 목표를 세우고 달성하는 경험을 쌓으면 인연의 끈이 강해집니다. 작은 프로젝트부터 시작해보세요.';
    case '지지 합충':
      return category.score >= 70
        ? '지지합이 좋으므로, 함께 사는 공간의 인테리어나 생활 패턴을 맞추면 더욱 좋은 에너지가 흐릅니다.'
        : '충이 있다면 "시간차 대화법"을 추천합니다. 갈등 상황에서 바로 대응하지 말고, 30분~1시간 후에 차분히 이야기하세요. 충의 에너지가 가라앉은 후 대화가 훨씬 생산적입니다.';
    case '띠 궁합':
      return category.score >= 70
        ? '좋은 띠 궁합을 가진 커플은 결혼 후에도 안정적인 관계를 유지하기 쉽습니다. 가족 행사를 함께하면 인연이 더욱 깊어집니다.'
        : '띠 궁합이 낮아도 걱정하지 마세요. 현대에서 띠 궁합의 영향력은 제한적입니다. 나머지 5가지 요소가 더 중요하며, 무엇보다 두 사람의 노력이 가장 중요합니다.';
    case '용신 보완':
      return category.score >= 70
        ? '서로의 용신을 잘 보완하고 있으므로, 중요한 일이 있을 때 함께 있으면 행운이 따릅니다. 시험, 면접, 계약 등 중요한 순간에 함께하세요.'
        : '용신 보완이 약하다면, 각자의 용신을 개별적으로 보강하세요. 용신 오행의 색상을 활용하거나, 해당 방위의 여행이 도움됩니다. 자세한 것은 개인 사주 분석을 참고하세요.';
    default:
      return '서로에 대한 이해와 배려를 통해 관계를 발전시켜 나가세요.';
  }
}
