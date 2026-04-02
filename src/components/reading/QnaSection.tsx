'use client';

import type { SajuResult } from '@/lib/saju-engine';
import type { DaeunResult } from '@/lib/daeun';

interface QnaSectionProps {
  sajuResult: SajuResult;
  daeunResult: DaeunResult | null;
  sajuQuestion: string;
  setSajuQuestion: (v: string) => void;
  sajuAnswer: string;
  userQuestion: string;
  onAskQuestion: () => void;
  onQuickQuestion: (q: string) => void;
}

export function QnaSection({
  sajuResult,
  daeunResult,
  sajuQuestion,
  setSajuQuestion,
  sajuAnswer,
  userQuestion,
  onAskQuestion,
  onQuickQuestion,
}: QnaSectionProps) {
  const age = daeunResult?.currentAge || 30;

  const quickQuestions = getQuickQuestionsForQna(age, sajuResult.relationship, sajuResult.hasChildren);

  return (
    <div className="bg-[#1e1e3f] rounded-2xl p-6 border border-purple-900/30">
      <h3 className="text-lg font-bold text-center mb-2 text-purple-300">
        💬 사주에 대해 궁금한 점이 있으신가요?
      </h3>
      <p className="text-sm text-gray-500 text-center mb-4">
        직업, 결혼, 돈, 건강, 관계, 올해운세 등 무엇이든 물어보세요
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={sajuQuestion}
          onChange={e => setSajuQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAskQuestion()}
          placeholder={
            sajuResult?.relationship === 'married'
              ? "예: 나한테 맞는 직업이 뭐야? / 부부 궁합은 어때?"
              : "예: 나한테 맞는 직업이 뭐야? / 언제 결혼할 수 있어?"
          }
          className="flex-1 px-4 py-2 bg-[#0a0a1a] border border-purple-900/50 rounded-lg text-white text-base focus:border-purple-500 focus:outline-none"
        />
        <button
          onClick={onAskQuestion}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-base font-bold transition-colors shrink-0"
        >
          질문하기
        </button>
      </div>

      {/* 빠른 질문 버튼 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {quickQuestions.map(q => (
          <button
            key={q}
            onClick={() => onQuickQuestion(q)}
            className="text-sm px-3 py-1.5 rounded-full border border-purple-900/30 text-gray-400 hover:text-purple-300 hover:border-purple-500 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {sajuAnswer && sajuQuestion.trim() && sajuQuestion !== userQuestion && (
        <div className="bg-[#0a0a1a] rounded-xl p-4 border border-purple-500/30 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🔮</span>
            <span className="text-sm font-bold text-purple-300">&ldquo;{sajuQuestion}&rdquo; 답변</span>
          </div>
          <p className="text-base text-gray-300 leading-relaxed whitespace-pre-line">{sajuAnswer}</p>
        </div>
      )}
    </div>
  );
}

function getQuickQuestionsForQna(age: number, relationship?: string, hasChildren?: boolean): string[] {
  const childQ = hasChildren ? '자녀운은 어때?' : '미래 전망은?';
  if (age < 20) {
    return [
      '친구 관계 어때?', '나의 재능/적성은?', '공부 잘하는 방법?',
      '올해 운세는?', '건강 · 아픈 곳은?', '대인관계 어때?',
      '나한테 맞는 진로는?', '숨은 재능은?', '내 성격 분석해줘',
    ];
  } else if (age >= 60) {
    return [
      '건강 · 아픈 곳은?', '올해 운세는?', childQ,
      '재물운은 어때?', '대인관계 어때?', '이사해도 될까?', '내 인생 황금기는?',
    ];
  } else if (relationship === 'married') {
    return [
      '나한테 맞는 직업은?', '부부 궁합은 어때?', '재물운은 어때?',
      '올해 운세는?', '건강 · 아픈 곳은?', '대인관계 어때?',
      '바람끼가 있을까?', '이사해도 될까?', childQ, '내 재복/황금기는?',
    ];
  } else {
    return [
      '나한테 맞는 직업은?', '언제 결혼운이 올까?', '재물운은 어때?',
      '올해 운세는?', '건강 · 아픈 곳은?', '대인관계 어때?',
      '바람끼가 있을까?', '이사해도 될까?',
      ...(hasChildren ? ['자녀운은 어때?'] : []),
      '학업/시험운은?', '내 재복/황금기는?',
    ];
  }
}
