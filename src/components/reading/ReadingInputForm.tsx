'use client';

import { useState } from 'react';
// import { KOREAN_CITIES } from '@/lib/local-time'; // 출생지역 보정 제거


interface ReadingInputFormProps {
  calendarType: 'solar' | 'lunar';
  setCalendarType: (v: 'solar' | 'lunar') => void;
  isLeapMonth: boolean;
  setIsLeapMonth: (v: boolean) => void;
  birthYear: string;
  setBirthYear: (v: string) => void;
  birthMonth: string;
  setBirthMonth: (v: string) => void;
  birthDay: string;
  setBirthDay: (v: string) => void;
  birthHour: string;
  setBirthHour: (v: string) => void;
  birthCity?: string;
  setBirthCity?: (v: string) => void;
  gender: 'male' | 'female';
  setGender: (v: 'male' | 'female') => void;
  relationship: 'single' | 'dating' | 'married';
  setRelationship: (v: 'single' | 'dating' | 'married') => void;
  hasChildren: boolean;
  setHasChildren: (v: boolean) => void;
  onAnalyze: () => void;
}

export function ReadingInputForm({
  calendarType, setCalendarType,
  isLeapMonth, setIsLeapMonth,
  birthYear, setBirthYear,
  birthMonth, setBirthMonth,
  birthDay, setBirthDay,
  birthHour, setBirthHour,
  // birthCity, setBirthCity, // 출생지역 제거
  gender, setGender,
  relationship, setRelationship,
  hasChildren, setHasChildren,
  onAnalyze,
}: ReadingInputFormProps) {
  return (
    <div className="bg-[#1e1e3f] rounded-2xl p-8 border border-purple-900/30 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-center mb-2 text-purple-300">
        정보 입력란
      </h2>
      <p className="text-xs text-gray-500 text-center mb-6">
        BT-<span className="italic font-serif text-sm text-purple-400">𝑥</span> = <span className="text-gray-400">Better Tomorrow - <span className="italic font-serif text-purple-400">𝑥</span><span className="text-gray-500">(미지의 수)</span></span><br />
        오늘보다 나은 내일을 위한 사주 + 타로 통합 분석
      </p>

      <div className="space-y-4">
        {/* 음력/양력 선택 */}
        <div>
          <label className="text-base text-gray-400 mb-2 block">달력 구분</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setCalendarType('solar'); setIsLeapMonth(false); }}
              className={`flex-1 py-2 rounded-lg text-base font-bold transition-all ${calendarType === 'solar' ? 'bg-purple-600 text-white' : 'bg-[#0a0a1a] text-gray-400 border border-purple-900/50'}`}
            >
              양력 (일반)
            </button>
            <button
              type="button"
              onClick={() => setCalendarType('lunar')}
              className={`flex-1 py-2 rounded-lg text-base font-bold transition-all ${calendarType === 'lunar' ? 'bg-purple-600 text-white' : 'bg-[#0a0a1a] text-gray-400 border border-purple-900/50'}`}
            >
              음력
            </button>
          </div>
          {calendarType === 'lunar' && (
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLeapMonth}
                  onChange={e => setIsLeapMonth(e.target.checked)}
                  className="w-4 h-4 rounded border-purple-900/50 bg-[#0a0a1a] text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-400">윤달</span>
              </label>
              <span className="text-sm text-gray-600">(해당 월이 윤달인 경우에만 체크)</span>
            </div>
          )}
          {calendarType === 'lunar' && (
            <p className="text-sm text-amber-400 mt-1">음력 날짜를 입력하면 자동으로 양력으로 변환하여 사주를 계산합니다</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-base text-gray-400 mb-1 block">년({calendarType === 'solar' ? '양력' : '음력'})</label>
            <select
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">선택</option>
              {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-base text-gray-400 mb-1 block">월</label>
            <select
              value={birthMonth}
              onChange={e => setBirthMonth(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">선택</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}월</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-base text-gray-400 mb-1 block">일</label>
            <select
              value={birthDay}
              onChange={e => setBirthDay(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">선택</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}일</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-base text-gray-400 mb-1 block">태어난 시간</label>
          <select
            value={birthHour}
            onChange={e => setBirthHour(e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="-1">모름 (시간을 모름)</option>
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

        {/* 출생 지역 보정 제거 — 태어난 시간 그대로 적용 */}

        <div>
          <label className="text-base text-gray-400 mb-1 block">성별</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`flex-1 py-2 rounded-lg border transition-colors ${
                gender === 'male'
                  ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              남성
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`flex-1 py-2 rounded-lg border transition-colors ${
                gender === 'female'
                  ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              여성
            </button>
          </div>
        </div>

        <div>
          <label className="text-base text-gray-400 mb-1 block">연애 상태</label>
          <div className="flex gap-3">
            {([
              { value: 'single' as const, label: '솔로' },
              { value: 'dating' as const, label: '연애중' },
              { value: 'married' as const, label: '기혼' },
            ]).map(opt => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setRelationship(opt.value)}
                className={`flex-1 py-2 rounded-lg border transition-colors text-base ${
                  relationship === opt.value
                    ? 'border-pink-500 bg-pink-900/30 text-pink-300'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-base text-gray-400 mb-1 block">자녀 유무</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setHasChildren(false)}
              className={`flex-1 py-2 rounded-lg border transition-colors text-base ${
                !hasChildren
                  ? 'border-sky-500 bg-sky-900/30 text-sky-300'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              없음
            </button>
            <button
              type="button"
              onClick={() => setHasChildren(true)}
              className={`flex-1 py-2 rounded-lg border transition-colors text-base ${
                hasChildren
                  ? 'border-sky-500 bg-sky-900/30 text-sky-300'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              있음
            </button>
          </div>
        </div>

        {/* 개인정보 수집·이용 동의 */}
        <PrivacyConsent onAnalyze={onAnalyze} />

      </div>
    </div>
  );
}

// ========== 개인정보 동의 컴포넌트 ==========
function PrivacyConsent({ onAnalyze }: { onAnalyze: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="space-y-3 pt-2">
      <div className="bg-[#0a0a1a] rounded-xl p-4 border border-purple-900/20">
        <button
          type="button"
          onClick={() => setAgreed(!agreed)}
          className="flex items-center gap-3 w-full text-left"
        >
          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            agreed ? 'border-purple-500 bg-purple-600' : 'border-gray-600 bg-[#0a0a1a]'
          }`}>
            {agreed && <span className="text-white text-sm font-bold">✓</span>}
          </div>
          <span className="text-sm text-gray-300 leading-relaxed">
            <span className="text-purple-300 font-bold">[필수]</span> 개인정보 수집·이용에 동의합니다.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowDetail(!showDetail)}
          className="mt-2 ml-9 text-[11px] text-purple-400 underline underline-offset-2 hover:text-purple-300"
        >
          {showDetail ? '내용 접기' : '자세히 보기'}
        </button>
        {showDetail && (
          <div className="mt-3 ml-7 bg-[#1e1e3f] rounded-lg p-3 border border-purple-900/20 text-[11px] text-gray-400 leading-relaxed space-y-2">
            <p className="font-bold text-gray-300">개인정보 수집·이용 안내</p>
            <p><span className="text-gray-300">수집 항목:</span> 생년월일, 태어난 시간, 성별, 관계 상태, 자녀 유무</p>
            <p><span className="text-gray-300">수집 목적:</span> 사주팔자 및 타로 기반 운세 분석 서비스 제공</p>
            <p><span className="text-gray-300">보관 방법:</span> 사용자 기기의 브라우저(localStorage)에만 저장되며, 외부 서버로 전송되지 않습니다.</p>
            <p><span className="text-gray-300">보관 기간:</span> 사용자가 직접 삭제하거나 브라우저 데이터를 삭제할 때까지</p>
            <p><span className="text-gray-300">동의 거부 권리:</span> 동의를 거부할 수 있으며, 이 경우 분석 서비스를 이용할 수 없습니다.</p>
            <p className="text-purple-400/80 pt-1 border-t border-purple-900/30">
              * 입력하신 정보는 오직 사주·타로 분석 목적으로만 사용되며, 서버에 저장·전송되지 않습니다.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!agreed) {
            alert('개인정보 수집·이용에 동의해주세요.');
            return;
          }
          onAnalyze();
        }}
        disabled={!agreed}
        className={`w-full py-3 font-bold rounded-xl text-lg transition-all duration-300 ${
          agreed
            ? 'bg-gradient-to-r from-purple-600 to-indigo-800 hover:from-purple-500 hover:to-indigo-700 text-white'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        사주 분석하기
      </button>
    </div>
  );
}

