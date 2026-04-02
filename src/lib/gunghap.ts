/**
 * 궁합 (宮合) 분석 시스템
 * 두 사람의 사주팔자를 비교하여 관계의 조화를 분석
 */

import { CHEONGAN, JIJI, CHEONGAN_OHAENG, JIJI_OHAENG, OHAENG_COLOR } from './saju-engine';
import type { Ohaeng, SajuResult } from './saju-engine';

// ========== 오행 상생상극 ==========

/** 상생 관계: A가 B를 생(生)함 */
const SANGSAENG: Record<Ohaeng, Ohaeng> = {
  '목': '화', '화': '토', '토': '금', '금': '수', '수': '목',
};

/** 상극 관계: A가 B를 극(克)함 */
const SANGGEUK: Record<Ohaeng, Ohaeng> = {
  '목': '토', '화': '금', '토': '수', '금': '목', '수': '화',
};

function getOhaengRelation(a: Ohaeng, b: Ohaeng): 'same' | 'saeng' | 'piSaeng' | 'geuk' | 'piGeuk' {
  if (a === b) return 'same';
  if (SANGSAENG[a] === b) return 'saeng';     // a가 b를 생
  if (SANGSAENG[b] === a) return 'piSaeng';    // b가 a를 생 (피생)
  if (SANGGEUK[a] === b) return 'geuk';        // a가 b를 극
  return 'piGeuk';                              // b가 a를 극 (피극)
}

// ========== 천간합 (天干合) ==========

/** 천간 합 쌍 - 서로 합이 되는 천간 */
const CHEONGAN_HAP: [string, string][] = [
  ['갑', '기'], // 갑기합 → 토
  ['을', '경'], // 을경합 → 금
  ['병', '신'], // 병신합 → 수
  ['정', '임'], // 정임합 → 목
  ['무', '계'], // 무계합 → 화
];

function checkCheonganHap(gan1: string, gan2: string): boolean {
  return CHEONGAN_HAP.some(([a, b]) => (gan1 === a && gan2 === b) || (gan1 === b && gan2 === a));
}

// ========== 지지합/충 ==========

/** 지지 육합 (六合) */
const JIJI_YUKHAP: [string, string][] = [
  ['자', '축'], // 자축합 → 토
  ['인', '해'], // 인해합 → 목
  ['묘', '술'], // 묘술합 → 화
  ['진', '유'], // 진유합 → 금
  ['사', '신'], // 사신합 → 수
  ['오', '미'], // 오미합 → 토/화
];

/** 지지 삼합 (三合) */
const JIJI_SAMHAP: [string, string, string, Ohaeng][] = [
  ['신', '자', '진', '수'], // 수국
  ['해', '묘', '미', '목'], // 목국
  ['인', '오', '술', '화'], // 화국
  ['사', '유', '축', '금'], // 금국
];

/** 지지 충 (六沖) */
const JIJI_CHUNG: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'],
  ['묘', '유'], ['진', '술'], ['사', '해'],
];

/** 지지 형 (三刑) */
const JIJI_HYUNG: [string, string][] = [
  ['인', '사'], ['사', '신'], ['인', '신'], // 무은지형
  ['축', '술'], ['술', '미'], ['축', '미'], // 무례지형
  ['자', '묘'],                              // 무례지형
];

/** 지지 파 (破) */
const JIJI_PA: [string, string][] = [
  ['자', '유'], ['축', '진'], ['인', '해'],
  ['묘', '오'], ['사', '신'], ['술', '미'],
];

/** 지지 해 (害) */
const JIJI_HAE: [string, string][] = [
  ['자', '미'], ['축', '오'], ['인', '사'],
  ['묘', '진'], ['신', '해'], ['유', '술'],
];

function checkPair(pairs: [string, string][], a: string, b: string): boolean {
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

// ========== 띠 궁합 ==========

const DDI_SAMHAP: string[][] = [
  ['자', '진', '신'], // 수국 삼합
  ['축', '사', '유'], // 금국 삼합
  ['인', '오', '술'], // 화국 삼합
  ['묘', '미', '해'], // 목국 삼합
];

const DDI_YUKCHUNG: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'],
  ['묘', '유'], ['진', '술'], ['사', '해'],
];

const ANIMAL_MAP: Record<string, string> = {
  '자': '쥐', '축': '소', '인': '호랑이', '묘': '토끼',
  '진': '용', '사': '뱀', '오': '말', '미': '양',
  '신': '원숭이', '유': '닭', '술': '개', '해': '돼지',
};

// ========== 궁합 결과 인터페이스 ==========

export interface GunghapCategory {
  name: string;
  score: number; // 0~100
  emoji: string;
  description: string;
  detail: string;
}

export interface GunghapResult {
  totalScore: number;          // 0~100 종합 점수
  grade: string;               // 등급 (천생연분, 좋은 궁합, ...)
  gradeEmoji: string;
  summary: string;
  categories: {
    ilgan: GunghapCategory;    // 일간 궁합 (가장 중요)
    ohaeng: GunghapCategory;   // 오행 밸런스
    cheonganHap: GunghapCategory; // 천간합
    jijiHap: GunghapCategory;  // 지지합/충
    ddi: GunghapCategory;      // 띠 궁합
    yongsin: GunghapCategory;  // 용신 보완
  };
  loveAdvice: string;
  strengths: string[];
  cautions: string[];
}

// ========== 궁합 분석 메인 함수 ==========

export function analyzeGunghap(person1: SajuResult, person2: SajuResult): GunghapResult {
  const ilgan = analyzeIlganGunghap(person1, person2);
  const ohaeng = analyzeOhaengBalance(person1, person2);
  const cheonganHap = analyzeCheonganHap(person1, person2);
  const jijiHap = analyzeJijiRelations(person1, person2);
  const ddi = analyzeDdiGunghap(person1, person2);
  const yongsin = analyzeYongsinComplement(person1, person2);

  // 가중 평균 (일간 30%, 오행 20%, 천간합 15%, 지지합 15%, 띠 10%, 용신 10%)
  const totalScore = Math.round(
    ilgan.score * 0.30 +
    ohaeng.score * 0.20 +
    cheonganHap.score * 0.15 +
    jijiHap.score * 0.15 +
    ddi.score * 0.10 +
    yongsin.score * 0.10
  );

  const { grade, gradeEmoji } = getGrade(totalScore);
  const summary = generateSummary(totalScore, person1, person2);
  const loveAdvice = generateLoveAdvice(ilgan, ohaeng, jijiHap, totalScore);
  const strengths = collectStrengths(ilgan, ohaeng, cheonganHap, jijiHap, ddi, yongsin);
  const cautions = collectCautions(ilgan, ohaeng, cheonganHap, jijiHap, ddi, yongsin);

  return {
    totalScore,
    grade,
    gradeEmoji,
    summary,
    categories: { ilgan, ohaeng, cheonganHap, jijiHap, ddi, yongsin },
    loveAdvice,
    strengths,
    cautions,
  };
}

// ========== 일간 궁합 ==========

function analyzeIlganGunghap(p1: SajuResult, p2: SajuResult): GunghapCategory {
  const oh1 = CHEONGAN_OHAENG[p1.ilgan];
  const oh2 = CHEONGAN_OHAENG[p2.ilgan];
  const relation = getOhaengRelation(oh1, oh2);
  const hasHap = checkCheonganHap(p1.ilgan, p2.ilgan);

  let score = 50;
  let description = '';
  let detail = '';

  if (hasHap) {
    score = 95;
    description = `${p1.ilgan}과 ${p2.ilgan}은 천간합! 하늘이 맺어준 인연입니다.`;
    detail = '일간끼리 합을 이루어 서로에게 자연스럽게 끌리는 관계입니다. 만나면 편안하고, 함께 있으면 안정감을 느낍니다. 서로의 부족한 부분을 채워주는 천생 배필의 조합입니다.';
  } else {
    switch (relation) {
      case 'same':
        score = 65;
        description = `같은 ${oh1}의 기운으로 서로를 잘 이해합니다.`;
        detail = '같은 오행이라 서로를 잘 이해하지만, 비슷한 성격 때문에 부딪힐 수도 있습니다. 상대를 거울처럼 보게 되어 장점과 단점이 명확히 보입니다. 서로 존중하는 자세가 필요합니다.';
        break;
      case 'saeng':
        score = 85;
        description = `${p1.ilgan}(${oh1})이 ${p2.ilgan}(${oh2})을 생(生)해주는 관계입니다.`;
        detail = `${oh1}이 ${oh2}를 돕는 상생 관계입니다. ${p1.ilgan} 쪽이 배려하고 지지해주는 역할을 자연스럽게 합니다. 한쪽이 헌신적이 될 수 있으니, 감사하는 마음을 표현하면 관계가 더욱 좋아집니다.`;
        break;
      case 'piSaeng':
        score = 80;
        description = `${p2.ilgan}(${oh2})이 ${p1.ilgan}(${oh1})을 생(生)해주는 관계입니다.`;
        detail = `${oh2}가 ${oh1}을 돕는 상생 관계입니다. ${p2.ilgan} 쪽이 배려하고 지지해주는 역할을 합니다. 서로의 기운이 자연스럽게 조화를 이루는 좋은 인연입니다.`;
        break;
      case 'geuk':
        score = 40;
        description = `${p1.ilgan}(${oh1})이 ${p2.ilgan}(${oh2})을 극(克)하는 관계입니다.`;
        detail = `${oh1}이 ${oh2}를 억누르는 상극 관계입니다. ${p1.ilgan} 쪽이 무의식적으로 상대를 통제하려 할 수 있습니다. 하지만 상극도 적절한 긴장감을 주어 서로 성장시킬 수 있습니다. 서로의 차이를 인정하는 노력이 필요합니다.`;
        break;
      case 'piGeuk':
        score = 45;
        description = `${p2.ilgan}(${oh2})이 ${p1.ilgan}(${oh1})을 극(克)하는 관계입니다.`;
        detail = `${oh2}가 ${oh1}을 억누르는 상극 관계입니다. 때로 갈등이 생길 수 있지만, 적절한 긴장은 관계에 활력을 줍니다. 서로 다름을 인정하고 대화로 풀어가면 극복 가능합니다.`;
        break;
    }
  }

  return {
    name: '일간 궁합',
    score,
    emoji: '💑',
    description,
    detail,
  };
}

// ========== 오행 밸런스 궁합 ==========

function analyzeOhaengBalance(p1: SajuResult, p2: SajuResult): GunghapCategory {
  const b1 = p1.ohaengBalance;
  const b2 = p2.ohaengBalance;

  // 두 사람의 오행을 합쳤을 때 균형도 계산
  const combined: Record<string, number> = {};
  const allOh: Ohaeng[] = ['목', '화', '토', '금', '수'];
  let total = 0;

  for (const oh of allOh) {
    combined[oh] = b1[oh] + b2[oh];
    total += combined[oh];
  }

  // 균형도: 각 오행이 20%에 가까울수록 좋음
  const ideal = total / 5;
  let deviation = 0;
  for (const oh of allOh) {
    deviation += Math.abs(combined[oh] - ideal);
  }

  // deviation이 작을수록 좋음 (0~total 범위)
  const maxDeviation = total * 0.8; // 최대 편차
  const balanceRatio = 1 - Math.min(deviation / maxDeviation, 1);
  const score = Math.round(40 + balanceRatio * 60); // 40~100

  // 서로 부족한 오행을 보완하는지 체크
  const p1Weak = allOh.filter(oh => b1[oh] < 1);
  const p2Weak = allOh.filter(oh => b2[oh] < 1);
  const p1Complements = p2Weak.filter(oh => b1[oh] >= 2);
  const p2Complements = p1Weak.filter(oh => b2[oh] >= 2);

  let description = '';
  let detail = '';

  if (score >= 80) {
    description = '두 분의 오행이 합쳐지면 매우 균형 잡힌 조합이 됩니다!';
    detail = '두 사람이 함께하면 오행의 균형이 잘 맞아 서로에게 부족한 기운을 채워줍니다. 함께 있을 때 안정감을 느끼고, 서로의 존재가 삶의 균형을 가져다줍니다.';
  } else if (score >= 60) {
    description = '오행 밸런스가 대체로 양호합니다.';
    detail = '두 사람의 오행 조합이 나쁘지 않습니다. 일부 오행이 치우칠 수 있지만, 서로 의식적으로 보완하면 좋은 조합이 됩니다.';
  } else {
    description = '오행 밸런스에 편중이 있습니다.';
    detail = '두 사람의 오행이 비슷하게 치우쳐 있어, 함께 있으면 특정 기운이 과다해질 수 있습니다. 균형을 위한 외부 활동이나 취미를 함께하면 도움이 됩니다.';
  }

  if (p1Complements.length > 0 || p2Complements.length > 0) {
    detail += `\n서로 보완하는 오행: ${[...p1Complements.map(oh => `${oh}(→상대)`), ...p2Complements.map(oh => `${oh}(→본인)`)].join(', ')}`;
  }

  return {
    name: '오행 밸런스',
    score,
    emoji: '⚖️',
    description,
    detail,
  };
}

// ========== 천간합 궁합 ==========

function analyzeCheonganHap(p1: SajuResult, p2: SajuResult): GunghapCategory {
  // 모든 천간 조합 체크
  const p1Gans = [p1.year.cheongan, p1.month.cheongan, p1.day.cheongan, p1.hour.cheongan];
  const p2Gans = [p2.year.cheongan, p2.month.cheongan, p2.day.cheongan, p2.hour.cheongan];
  const pillarNames = ['연주', '월주', '일주', '시주'];

  const hapPairs: string[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (checkCheonganHap(p1Gans[i], p2Gans[j])) {
        hapPairs.push(`${pillarNames[i]}(${p1Gans[i]})↔${pillarNames[j]}(${p2Gans[j]})`);
      }
    }
  }

  let score: number;
  let description: string;
  let detail: string;

  if (hapPairs.length >= 3) {
    score = 95;
    description = `천간합이 ${hapPairs.length}개! 여러 방면에서 인연이 깊습니다.`;
    detail = `다수의 천간 합이 이루어져 서로 강하게 끌리는 관계입니다. 합의 조합: ${hapPairs.join(', ')}. 이 정도의 합은 전생의 인연이라 할 만큼 깊은 끌림이 있습니다.`;
  } else if (hapPairs.length === 2) {
    score = 85;
    description = `천간합이 ${hapPairs.length}개로 좋은 인연입니다.`;
    detail = `${hapPairs.join(', ')} 천간이 합을 이룹니다. 서로 자연스럽게 맞는 부분이 많아 편안한 관계를 유지할 수 있습니다.`;
  } else if (hapPairs.length === 1) {
    score = 70;
    description = `${hapPairs[0]} 천간합이 있습니다.`;
    detail = `한 쌍의 천간 합이 있어 기본적인 인연의 끈이 있습니다. 합이 있는 기둥의 영역에서 특히 좋은 궁합을 보입니다.`;
  } else {
    score = 45;
    description = '천간합은 없지만, 다른 영역에서 인연이 있을 수 있습니다.';
    detail = '천간끼리 직접적인 합은 없습니다. 하지만 천간합이 없다고 궁합이 나쁜 것은 아닙니다. 지지합이나 오행 보완 등 다른 요소를 함께 봐야 합니다.';
  }

  return {
    name: '천간합',
    score,
    emoji: '🌟',
    description,
    detail,
  };
}

// ========== 지지 관계 궁합 ==========

function analyzeJijiRelations(p1: SajuResult, p2: SajuResult): GunghapCategory {
  const p1Jis = [p1.year.jiji, p1.month.jiji, p1.day.jiji, p1.hour.jiji];
  const p2Jis = [p2.year.jiji, p2.month.jiji, p2.day.jiji, p2.hour.jiji];
  const pillarNames = ['연주', '월주', '일주', '시주'];

  const haps: string[] = [];
  const chungs: string[] = [];
  const hyungs: string[] = [];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (checkPair(JIJI_YUKHAP, p1Jis[i], p2Jis[j])) {
        haps.push(`${pillarNames[i]}(${p1Jis[i]})↔${pillarNames[j]}(${p2Jis[j]}) 합`);
      }
      if (checkPair(JIJI_CHUNG, p1Jis[i], p2Jis[j])) {
        chungs.push(`${pillarNames[i]}(${p1Jis[i]})↔${pillarNames[j]}(${p2Jis[j]}) 충`);
      }
      if (checkPair(JIJI_HYUNG, p1Jis[i], p2Jis[j])) {
        hyungs.push(`${pillarNames[i]}(${p1Jis[i]})↔${pillarNames[j]}(${p2Jis[j]}) 형`);
      }
    }
  }

  let score = 50;
  score += haps.length * 12;
  score -= chungs.length * 10;
  score -= hyungs.length * 8;
  score = Math.max(15, Math.min(100, score));

  let description = '';
  let detail = '';

  const parts: string[] = [];
  if (haps.length > 0) parts.push(`육합 ${haps.length}개`);
  if (chungs.length > 0) parts.push(`충 ${chungs.length}개`);
  if (hyungs.length > 0) parts.push(`형 ${hyungs.length}개`);

  if (parts.length === 0) {
    description = '지지 간 특별한 합이나 충은 없습니다.';
    detail = '지지끼리 직접적인 합이나 충이 없어 무난한 관계입니다. 극적인 끌림은 적지만, 갈등도 적은 안정적인 조합입니다.';
  } else {
    description = `지지 관계: ${parts.join(', ')}`;
    const details: string[] = [];
    if (haps.length > 0) {
      details.push(`육합(${haps.join(', ')}): 서로 자연스럽게 맞아 편안한 관계입니다.`);
    }
    if (chungs.length > 0) {
      details.push(`충(${chungs.join(', ')}): 의견 충돌이 있을 수 있지만, 서로 다른 시각이 성장을 돕습니다. 충은 변화와 역동성을 가져옵니다.`);
    }
    if (hyungs.length > 0) {
      details.push(`형(${hyungs.join(', ')}): 서로에게 상처를 주기 쉬운 관계입니다. 말과 행동에 주의가 필요합니다.`);
    }
    detail = details.join('\n');
  }

  return {
    name: '지지 합충',
    score,
    emoji: '🔄',
    description,
    detail,
  };
}

// ========== 띠 궁합 ==========

function analyzeDdiGunghap(p1: SajuResult, p2: SajuResult): GunghapCategory {
  const ji1 = p1.year.jiji;
  const ji2 = p2.year.jiji;
  const animal1 = ANIMAL_MAP[ji1] || p1.animal;
  const animal2 = ANIMAL_MAP[ji2] || p2.animal;

  // 삼합 체크
  const isSamhap = DDI_SAMHAP.some(group => group.includes(ji1) && group.includes(ji2));
  // 육합 체크
  const isYukhap = checkPair(JIJI_YUKHAP, ji1, ji2);
  // 육충 체크
  const isChung = checkPair(DDI_YUKCHUNG, ji1, ji2);
  // 같은 띠
  const isSame = ji1 === ji2;

  let score: number;
  let description: string;
  let detail: string;

  if (isYukhap) {
    score = 90;
    description = `${animal1}띠와 ${animal2}띠는 육합! 천생연분의 띠 궁합입니다.`;
    detail = `${animal1}과 ${animal2}는 지지 육합으로 서로 가장 잘 맞는 띠입니다. 만나면 자연스럽게 편안하고, 서로를 이해하는 힘이 있습니다. 결혼 궁합으로도 최고입니다.`;
  } else if (isSamhap) {
    score = 80;
    description = `${animal1}띠와 ${animal2}띠는 삼합! 좋은 띠 궁합입니다.`;
    detail = `${animal1}과 ${animal2}는 삼합 관계로 서로 힘이 되는 조합입니다. 같은 목표를 향해 함께 달려갈 수 있는 파트너입니다. 사업 궁합으로도 좋습니다.`;
  } else if (isSame) {
    score = 60;
    description = `같은 ${animal1}띠끼리는 서로를 잘 이해합니다.`;
    detail = `같은 띠여서 비슷한 성격과 가치관을 공유합니다. 서로 이해하기 쉽지만, 비슷해서 지루해질 수 있습니다. 새로운 자극을 함께 찾아보세요.`;
  } else if (isChung) {
    score = 30;
    description = `${animal1}띠와 ${animal2}띠는 충! 갈등에 주의해야 합니다.`;
    detail = `${animal1}과 ${animal2}는 지지 충으로 서로 정반대의 기운을 가집니다. 강한 끌림이 있을 수 있지만, 갈등도 클 수 있습니다. 서로의 차이를 이해하고 존중하는 노력이 필요합니다. 충 관계가 반드시 나쁜 것은 아니며, 오히려 강렬한 인연일 수 있습니다.`;
  } else {
    score = 55;
    description = `${animal1}띠와 ${animal2}띠는 무난한 관계입니다.`;
    detail = `특별한 합이나 충은 없는 중립적 관계입니다. 서로의 노력에 따라 충분히 좋은 관계를 만들어갈 수 있습니다.`;
  }

  return {
    name: '띠 궁합',
    score,
    emoji: '🐾',
    description,
    detail,
  };
}

// ========== 용신 보완 궁합 ==========

function analyzeYongsinComplement(p1: SajuResult, p2: SajuResult): GunghapCategory {
  const b1 = p1.ohaengBalance;
  const b2 = p2.ohaengBalance;

  // 상대방이 내 용신 오행을 많이 가지고 있는지
  const p1YongsinFromP2 = b2[p1.yongsin] || 0;
  const p2YongsinFromP1 = b1[p2.yongsin] || 0;

  // 서로의 용신을 보완해주는 정도
  const complementScore1 = Math.min(p1YongsinFromP2 / 3, 1) * 50; // 0~50
  const complementScore2 = Math.min(p2YongsinFromP1 / 3, 1) * 50; // 0~50
  let score = Math.round(complementScore1 + complementScore2);
  score = Math.max(20, Math.min(100, score));

  // 서로의 기신을 강화하는지 체크
  const p1GisinFromP2 = b2[p1.gisin] || 0;
  const p2GisinFromP1 = b1[p2.gisin] || 0;
  if (p1GisinFromP2 >= 3 || p2GisinFromP1 >= 3) {
    score = Math.max(20, score - 15);
  }

  let description: string;
  let detail: string;

  if (score >= 80) {
    description = '서로의 용신을 완벽하게 보완하는 최고의 조합!';
    detail = `상대방이 나에게 필요한 기운(용신)을 풍부하게 갖고 있습니다. 함께 있으면 운이 좋아지는 관계입니다.\n본인 용신(${p1.yongsin}): 상대 보유량 ${p1YongsinFromP2.toFixed(1)}\n상대 용신(${p2.yongsin}): 본인 보유량 ${p2YongsinFromP1.toFixed(1)}`;
  } else if (score >= 50) {
    description = '용신 보완이 어느 정도 이루어지는 조합입니다.';
    detail = `한쪽 또는 양쪽이 상대의 용신을 일부 보완해줍니다.\n본인 용신(${p1.yongsin}): 상대 보유량 ${p1YongsinFromP2.toFixed(1)}\n상대 용신(${p2.yongsin}): 본인 보유량 ${p2YongsinFromP1.toFixed(1)}`;
  } else {
    description = '용신 보완은 약하지만, 다른 영역의 궁합을 참고하세요.';
    detail = `서로의 용신 오행을 많이 갖고 있지 않아 기운 보완이 약합니다. 하지만 궁합은 종합적으로 봐야 합니다.\n본인 용신(${p1.yongsin}): 상대 보유량 ${p1YongsinFromP2.toFixed(1)}\n상대 용신(${p2.yongsin}): 본인 보유량 ${p2YongsinFromP1.toFixed(1)}`;
  }

  return {
    name: '용신 보완',
    score,
    emoji: '🎯',
    description,
    detail,
  };
}

// ========== 유틸리티 ==========

function getGrade(score: number): { grade: string; gradeEmoji: string } {
  if (score >= 90) return { grade: '천생연분', gradeEmoji: '💕' };
  if (score >= 80) return { grade: '최고의 궁합', gradeEmoji: '❤️' };
  if (score >= 70) return { grade: '좋은 궁합', gradeEmoji: '💛' };
  if (score >= 60) return { grade: '무난한 궁합', gradeEmoji: '💚' };
  if (score >= 50) return { grade: '보통 궁합', gradeEmoji: '💙' };
  if (score >= 40) return { grade: '노력이 필요한 궁합', gradeEmoji: '🤔' };
  return { grade: '주의가 필요한 궁합', gradeEmoji: '⚠️' };
}

function generateSummary(score: number, p1: SajuResult, p2: SajuResult): string {
  const oh1 = CHEONGAN_OHAENG[p1.ilgan];
  const oh2 = CHEONGAN_OHAENG[p2.ilgan];

  if (score >= 85) {
    return `${p1.ilgan}(${oh1})과 ${p2.ilgan}(${oh2})의 만남은 하늘이 점지한 인연입니다. 서로의 기운이 자연스럽게 조화를 이루어, 함께할수록 좋은 일이 생기는 관계입니다. 서로를 소중히 여기면 평생의 반려가 될 수 있습니다.`;
  } else if (score >= 70) {
    return `${p1.ilgan}(${oh1})과 ${p2.ilgan}(${oh2})은 서로에게 좋은 영향을 주는 관계입니다. 기본적인 궁합이 좋아 함께 있을 때 편안함을 느낍니다. 서로의 장점을 살려주면 더욱 발전하는 관계가 됩니다.`;
  } else if (score >= 55) {
    return `${p1.ilgan}(${oh1})과 ${p2.ilgan}(${oh2})은 무난한 관계입니다. 큰 갈등은 없지만, 서로를 더 잘 이해하려는 노력이 필요합니다. 서로의 차이점을 인정하고 대화를 자주 하면 좋은 관계를 유지할 수 있습니다.`;
  } else {
    return `${p1.ilgan}(${oh1})과 ${p2.ilgan}(${oh2})은 서로 다른 기운을 가져 때로 갈등이 있을 수 있습니다. 하지만 모든 관계는 노력으로 발전할 수 있습니다. 서로의 차이를 이해하고, 상대의 관점을 존중하는 것이 중요합니다.`;
  }
}

function generateLoveAdvice(ilgan: GunghapCategory, ohaeng: GunghapCategory, jiji: GunghapCategory, totalScore: number): string {
  if (totalScore >= 80) {
    return '두 분은 타고난 좋은 인연입니다. 서로에 대한 감사함을 잊지 말고, 작은 것에도 애정을 표현하세요. 함께하는 시간이 길수록 더 깊은 유대감이 형성됩니다. 서로의 꿈을 응원하고 함께 성장해 나가세요.';
  } else if (totalScore >= 60) {
    return '기본적인 궁합이 나쁘지 않습니다. 서로의 장점에 집중하고, 갈등이 생기면 대화로 풀어가세요. 상대방의 생각과 감정을 경청하는 것이 가장 중요합니다. 함께하는 취미 활동을 만들면 관계가 더 깊어집니다.';
  } else {
    return '궁합 점수가 낮다고 해서 안 되는 관계는 아닙니다. 오히려 서로 다른 점이 많아 배울 것도 많습니다. 상대를 변화시키려 하지 말고 있는 그대로 받아들이는 것이 핵심입니다. 각자의 시간도 소중히 하면서, 함께하는 시간의 질을 높이세요.';
  }
}

function collectStrengths(...categories: GunghapCategory[]): string[] {
  const strengths: string[] = [];
  for (const c of categories) {
    if (c.score >= 70) {
      strengths.push(`${c.emoji} ${c.name}(${c.score}점): ${c.description}`);
      // 점수별 추가 코멘트
      if (c.score >= 90) {
        strengths.push(`  → 이 항목은 특히 뛰어나며, 두 사람 관계의 핵심 강점입니다.`);
      } else if (c.score >= 80) {
        strengths.push(`  → 매우 좋은 수준으로, 이 영역에서 큰 시너지를 기대할 수 있습니다.`);
      }
    }
  }
  // 종합 강점 메시지
  const highScoreCount = categories.filter(c => c.score >= 70).length;
  if (highScoreCount >= 4) {
    strengths.push('💎 6개 항목 중 4개 이상이 우수합니다. 여러 방면에서 잘 맞는 커플입니다!');
  } else if (highScoreCount >= 2) {
    strengths.push('✨ 주요 항목에서 좋은 궁합을 보여, 서로에게 긍정적인 영향을 줍니다.');
  }
  return strengths;
}

function collectCautions(...categories: GunghapCategory[]): string[] {
  const cautions: string[] = [];
  for (const c of categories) {
    if (c.score < 50) {
      cautions.push(`${c.emoji} ${c.name}(${c.score}점): ${c.description}`);
      // 보완 조언
      if (c.name === '일간 궁합') {
        cautions.push(`  → 상극 관계는 서로를 성장시킬 수도 있습니다. 상대를 통제하려 하지 말고 존중하세요.`);
      } else if (c.name === '지지 합충') {
        cautions.push(`  → 충(沖)이 있다면 갈등 후 대화의 시간을 충분히 가지세요. 급한 결정은 피하세요.`);
      } else if (c.name === '띠 궁합') {
        cautions.push(`  → 띠 궁합은 전체에서 10%의 비중입니다. 다른 항목이 좋다면 크게 걱정하지 않아도 됩니다.`);
      } else if (c.name === '용신 보완') {
        cautions.push(`  → 각자의 용신 오행을 개별적으로 보강하면 (색상, 방향, 음식 등) 도움이 됩니다.`);
      }
    }
  }
  // 종합 주의 메시지
  const lowScoreCount = categories.filter(c => c.score < 50).length;
  if (lowScoreCount >= 3) {
    cautions.push('💡 주의 항목이 많지만, 서로를 이해하려는 노력이 가장 중요합니다. 궁합은 참고일 뿐, 관계는 두 사람이 만들어가는 것입니다.');
  }
  return cautions;
}
