/**
 * 데일리 타로 (오늘의 운세) 엔진
 * 날짜 + 사주 기반으로 매일 다른 카드를 뽑고 해석
 */

import { ALL_TAROT_CARDS, getCardById } from '@/data/tarot-cards';
import type { TarotCard } from '@/data/tarot-cards';
import { CHEONGAN, JIJI, CHEONGAN_OHAENG, JIJI_OHAENG, OHAENG_SANGGEUK } from './saju-engine';
import type { Ohaeng, SajuResult } from './saju-engine';
import { extractSajuContext, crossCheckTarotCard, WEAK_OHAENG_ORGAN, adjustLoveTextByRelationship, adjustTextByChildren } from './saju-context-filter';

export interface DailyTarotResult {
  date: string;              // YYYY-MM-DD
  card: TarotCard;
  isReversed: boolean;
  dailyGanji: { cheongan: string; jiji: string; ohaeng: Ohaeng };
  luckyColor: string;
  luckyNumber: number;
  luckyDirection: string;
  overallMessage: string;
  morningAdvice: string;
  afternoonAdvice: string;
  eveningAdvice: string;
  loveMessage: string;
  moneyMessage: string;
  healthMessage: string;
}

/**
 * 날짜 기반 시드 해시 (결정론적 - 같은 날짜+사주면 같은 결과)
 */
function dateHash(dateStr: string, ilgan: string): number {
  let hash = 0;
  const seed = dateStr + ilgan;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * 간단한 결정론적 난수 생성기 (LCG)
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * 오늘의 간지 계산
 */
function getDailyGanji(year: number, month: number, day: number) {
  // JDN 기반 정밀 일간지 계산 (sxtwl 교차검증 완료, 오프셋 49)
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

  const ganIdx = ((jdn + 49) % 10 + 10) % 10;
  const jiIdx = ((jdn + 49) % 12 + 12) % 12;

  const cheongan = CHEONGAN[ganIdx];
  const jiji = JIJI[jiIdx];
  const ohaeng = CHEONGAN_OHAENG[cheongan];

  return { cheongan, jiji, ohaeng };
}

const COLORS: Record<Ohaeng, string> = {
  '목': '초록색',
  '화': '빨간색',
  '토': '노란색',
  '금': '흰색',
  '수': '검은색',
};

const LUCKY_COLORS: string[] = [
  '라벤더', '민트', '코랄', '골드', '실버',
  '로즈핑크', '하늘색', '베이지', '올리브', '버건디',
  '네이비', '아이보리', '피치', '에메랄드', '오렌지',
];

const DIRECTIONS = ['동쪽', '서쪽', '남쪽', '북쪽', '동남쪽', '서남쪽', '동북쪽', '서북쪽'];

/**
 * 데일리 타로 메인 함수
 */
export function getDailyTarot(
  saju: SajuResult,
  year: number,
  month: number,
  day: number
): DailyTarotResult {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const hash = dateHash(dateStr, saju.ilgan);
  const rand = seededRandom(hash);

  // 오늘의 간지
  const dailyGanji = getDailyGanji(year, month, day);
  const ilOhaeng = CHEONGAN_OHAENG[saju.ilgan];

  // 카드 선택 (날짜+사주 기반 가중치)
  const cards = ALL_TAROT_CARDS;
  const weights = cards.map(card => {
    let w = 1;
    // 용신과 같은 오행 카드 가중치 높임
    if (card.element === saju.yongsin) w += 0.5;
    // 기신 카드 가중치 낮춤
    if (card.element === saju.gisin) w -= 0.3;
    // 약한 오행 보충 카드 가중치 높임
    if (card.element === saju.weakestOhaeng) w += 0.4;
    // 오늘 간지 오행과 맞는 카드
    if (card.element === dailyGanji.ohaeng) w += 0.3;
    // 메이저 아르카나 약간 높임
    if (card.arcana === 'major') w += 0.2;
    return Math.max(0.1, w);
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let pick = rand() * totalWeight;
  let cardIdx = 0;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) { cardIdx = i; break; }
  }

  const card = cards[cardIdx];
  const isReversed = rand() < 0.3; // 30% 역방향

  // 럭키 아이템
  const luckyColor = LUCKY_COLORS[Math.floor(rand() * LUCKY_COLORS.length)];
  const luckyNumber = Math.floor(rand() * 9) + 1;
  const luckyDirection = DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)];

  // 메시지 생성
  const overallMessage = generateOverallMessage(card, isReversed, dailyGanji, saju);
  const morningAdvice = generateTimeAdvice('morning', card, isReversed, rand, saju);
  const afternoonAdvice = generateTimeAdvice('afternoon', card, isReversed, rand, saju);
  const eveningAdvice = generateTimeAdvice('evening', card, isReversed, rand, saju);
  const loveMessage = generateDailyLove(card, isReversed, saju);
  const moneyMessage = generateDailyMoney(card, isReversed, saju);
  const healthMessage = generateDailyHealth(card, isReversed, dailyGanji, saju);

  // 자녀 유무 기반 텍스트 보정
  const applyChildren = (text: string) => adjustTextByChildren(text, saju.hasChildren);

  return {
    date: dateStr,
    card,
    isReversed,
    dailyGanji,
    luckyColor,
    luckyNumber,
    luckyDirection,
    overallMessage: applyChildren(overallMessage),
    morningAdvice: applyChildren(morningAdvice),
    afternoonAdvice: applyChildren(afternoonAdvice),
    eveningAdvice: applyChildren(eveningAdvice),
    loveMessage: applyChildren(loveMessage),
    moneyMessage: applyChildren(moneyMessage),
    healthMessage: applyChildren(healthMessage),
  };
}

function generateOverallMessage(card: TarotCard, reversed: boolean, ganji: ReturnType<typeof getDailyGanji>, saju: SajuResult): string {
  const cardMsg = reversed ? card.reversed : card.upright;
  const ohaengMsg = card.ohaengReading[CHEONGAN_OHAENG[saju.ilgan]];
  const specificMsg = reversed ? ohaengMsg.reversed : ohaengMsg.upright;

  let prefix = '';
  if (card.arcana === 'major') {
    prefix = `오늘은 메이저 아르카나 "${card.name}"이(가) 나왔습니다. 중요한 메시지가 담긴 하루입니다.\n\n`;
  } else {
    prefix = `오늘의 카드는 "${card.name}"(${card.element})입니다.\n\n`;
  }

  return prefix + specificMsg;
}

function generateTimeAdvice(time: 'morning' | 'afternoon' | 'evening', card: TarotCard, reversed: boolean, rand: () => number, saju: SajuResult): string {
  const ilOhaeng = CHEONGAN_OHAENG[saju.ilgan];
  const yongsin = saju.yongsin;

  // 오행별 시간대 조언 (일간 + 용신 기반)
  const OHAENG_TIME_ADVICE: Record<Ohaeng, { morning: string[]; afternoon: string[]; evening: string[] }> = {
    '목': {
      morning: [
        '목(木) 일간은 아침에 에너지가 강합니다. 중요한 결정은 오전에 하세요.',
        '아침 산책이나 스트레칭으로 나무처럼 뻗어가는 기운을 깨우세요.',
        '아침에 새로운 계획을 세우면 성장의 기운이 함께합니다.',
      ],
      afternoon: [
        '오후에는 화(火) 기운이 강해져 목(木)이 설기됩니다. 무리하지 말고 페이스를 조절하세요.',
        '오후에 동료와의 협업이 좋은 결과를 낳습니다. 나무는 숲에서 더 강합니다.',
        '점심 후 잠깐 자연을 접하면(산책, 화분 보기) 에너지가 회복됩니다.',
      ],
      evening: [
        '저녁에는 수(水) 기운으로 영양을 보충하세요. 독서나 학습이 효과적입니다.',
        '밤에 고민하기보다 내일 아침 맑은 머리로 다시 생각하세요. 나무는 밤에 자랍니다.',
        '충분한 수면이 내일의 성장 에너지를 만듭니다.',
      ],
    },
    '화': {
      morning: [
        '화(火) 일간은 아침에 의욕이 넘칩니다. 하지만 너무 서두르면 빈틈이 생깁니다.',
        '아침 햇살을 받으며 에너지를 충전하세요. 화 일간에게 빛은 활력입니다.',
        '오전에 중요한 프레젠테이션이나 발표가 있다면 좋은 결과를 얻습니다.',
      ],
      afternoon: [
        '오후에 감정이 과열될 수 있습니다. 차분한 호흡으로 균형을 잡으세요.',
        '오후에 창의적인 작업에 집중하면 불꽃같은 아이디어가 떠오릅니다.',
        '뜨거운 열정을 차가운 머리로 제어하면 최고의 성과가 나옵니다.',
      ],
      evening: [
        '저녁에는 불꽃을 가라앉히는 시간. 명상이나 반신욕이 좋습니다.',
        '밤에는 수(水) 기운이 강해지므로 감정 기복에 주의하세요.',
        '가까운 사람과 따뜻한 대화로 하루의 열기를 부드럽게 식히세요.',
      ],
    },
    '토': {
      morning: [
        '토(土) 일간은 아침에 안정적인 루틴이 중요합니다. 규칙적인 아침 식사를 권합니다.',
        '아침에 하루의 우선순위를 정하면 흔들림 없이 하루를 보낼 수 있습니다.',
        '토 일간의 아침은 느긋해도 괜찮습니다. 서두르면 오히려 실수합니다.',
      ],
      afternoon: [
        '오후에는 실무적인 일에 집중하면 큰 성과를 냅니다. 산처럼 묵묵히 진행하세요.',
        '오후에 부동산, 재테크 관련 정보를 접하면 좋은 기회를 발견합니다.',
        '중심을 잡고 흔들리지 않는 오후를 보내세요. 토 일간의 강점입니다.',
      ],
      evening: [
        '저녁에는 가족이나 가까운 사람과의 시간이 마음을 안정시킵니다.',
        '저녁 식사를 정성껏 준비하면 토 기운이 보충되어 내일이 편안합니다.',
        '잠들기 전 내일의 계획을 간단히 메모하면 불안이 줄어듭니다.',
      ],
    },
    '금': {
      morning: [
        '금(金) 일간은 아침에 판단력이 맑습니다. 중요한 결단은 오전에 내리세요.',
        '아침 운동으로 몸을 깨우면 하루종일 예리한 판단력이 유지됩니다.',
        '오전에 복잡한 문서나 계약 관련 일을 처리하면 실수가 적습니다.',
      ],
      afternoon: [
        '오후에는 대인관계에 신경 쓰세요. 금 일간의 날카로움이 타인에게 상처를 줄 수 있습니다.',
        '오후에 재무 관련 일이 잘 풀립니다. 금(金) 기운이 돈과 통합니다.',
        '오후 3시 이후 집중력이 최고조에 달합니다. 핵심 업무를 배치하세요.',
      ],
      evening: [
        '저녁에는 긴장을 풀고 부드러운 음악이나 영화로 마음을 녹이세요.',
        '금 일간은 밤에 생각이 많아질 수 있습니다. 걱정은 내려놓고 쉬세요.',
        '저녁 산책이나 가벼운 스트레칭으로 굳은 기운을 풀어주세요.',
      ],
    },
    '수': {
      morning: [
        '수(水) 일간은 아침에 직감이 예민합니다. 꿈에서 받은 영감을 기록해두세요.',
        '아침에 물 한 잔으로 시작하면 하루의 흐름이 좋아집니다.',
        '오전에 새로운 정보를 접하면 좋은 기회를 발견할 수 있습니다.',
      ],
      afternoon: [
        '오후에 사람을 만나면 뜻밖의 정보나 기회를 얻습니다. 수(水)는 소통의 기운입니다.',
        '오후에 유연하게 대처하면 어려운 상황도 물처럼 흘러갑니다.',
        '창의적 아이디어가 오후에 샘솟을 수 있습니다. 메모를 준비하세요.',
      ],
      evening: [
        '저녁에는 깊은 사색의 시간을 가지세요. 수 일간의 지혜가 빛납니다.',
        '밤에 공부나 연구를 하면 효율이 극대화됩니다. 수(水)의 집중력을 활용하세요.',
        '잠들기 전 따뜻한 차 한 잔이 수 기운을 안정시키고 좋은 꿈을 가져옵니다.',
      ],
    },
  };

  const ohaengAdvices = OHAENG_TIME_ADVICE[ilOhaeng] || OHAENG_TIME_ADVICE['토'];
  const advices = ohaengAdvices[time];
  const idx = Math.floor(rand() * advices.length);

  // 용신 보충 조언
  const YONGSIN_TIME_TIP: Record<Ohaeng, Record<'morning' | 'afternoon' | 'evening', string>> = {
    '목': { morning: '녹색 옷이나 소품이 행운을 부릅니다.', afternoon: '잠깐 산책하면 용신 기운이 보충됩니다.', evening: '독서나 학습으로 성장 에너지를 채우세요.' },
    '화': { morning: '밝은 색 옷이 오전 기운을 올립니다.', afternoon: '사람들과 활발히 교류하면 운이 올라갑니다.', evening: '따뜻한 차나 캔들이 용신 기운을 보충합니다.' },
    '토': { morning: '아침 식사를 든든히 하면 하루가 안정됩니다.', afternoon: '중심을 잡고 꾸준히 진행하면 성과가 있습니다.', evening: '집에서 편안한 시간이 최고의 보약입니다.' },
    '금': { morning: '깔끔한 정리정돈으로 하루를 시작하세요.', afternoon: '체계적인 계획이 금 기운을 끌어옵니다.', evening: '금속 액세서리나 시계가 행운을 부릅니다.' },
    '수': { morning: '물을 충분히 마시면 기운이 올라갑니다.', afternoon: '유연한 사고가 기회를 만듭니다.', evening: '반신욕이나 물가 산책이 최고의 힐링입니다.' },
  };

  let result = advices[idx];

  // 카드 원소와 일간 오행 관계 반영
  if (card.element === yongsin) {
    result += ` 오늘 카드(${card.name})가 용신(${yongsin}) 기운! ${YONGSIN_TIME_TIP[yongsin]?.[time] || ''}`;
  }

  if (reversed) {
    const caution = time === 'morning' ? '아침에 서두르면 실수할 수 있으니 여유를 가지세요. ' :
      time === 'afternoon' ? '오후에 감정적인 판단은 피하세요. ' :
        '저녁에 과한 음주나 야식은 자제하세요. ';
    return caution + result;
  }
  return result;
}

function generateDailyLove(card: TarotCard, reversed: boolean, saju: SajuResult): string {
  let reading = reversed ? card.detailed.love.reversed : card.detailed.love.upright;
  // 관계 상태 반영
  reading = adjustLoveTextByRelationship(reading, saju.relationship);
  // 사주 교차검증
  const ctx = extractSajuContext(saju);
  const cross = crossCheckTarotCard(card.element as Ohaeng, ctx, reversed);
  if (cross.isYongsinCard && !reversed) {
    reading += ` ✨ 용신(${ctx.yongsin}) 카드로 연애운이 한층 좋습니다!`;
  } else if (cross.isGisinCard && !reversed) {
    reading += ` ⚠️ 기신(${ctx.gisin}) 에너지가 관계에 갈등을 부추길 수 있으니 감정 조절에 신경 쓰세요.`;
  }
  return reading;
}

function generateDailyMoney(card: TarotCard, reversed: boolean, saju: SajuResult): string {
  let reading = reversed ? card.detailed.money.reversed : card.detailed.money.upright;
  const ctx = extractSajuContext(saju);
  const cross = crossCheckTarotCard(card.element as Ohaeng, ctx, reversed);
  if (cross.isGisinCard && reversed) {
    reading += ` 🚨 기신 역방향 카드 — 오늘은 큰 지출·투자를 피하세요!`;
  } else if (cross.isYongsinCard && !reversed) {
    reading += ` 💰 용신 카드로 금전 흐름이 좋습니다. 합리적 소비는 OK!`;
  }
  // 겁재 십신 경고
  if (ctx.monthSipseong === '겁재') {
    reading += ' ⚠️ 월주 겁재 에너지가 있어 충동 소비에 각별히 주의하세요.';
  }
  return reading;
}

function generateDailyHealth(card: TarotCard, reversed: boolean, ganji: ReturnType<typeof getDailyGanji>, saju?: SajuResult): string {
  let reading = reversed ? card.detailed.health.reversed : card.detailed.health.upright;
  // 사주 교차검증
  if (saju) {
    const ctx = extractSajuContext(saju);
    const cross = crossCheckTarotCard(card.element as Ohaeng, ctx, reversed);
    if (cross.suppressesWeak && ctx.isExtremeWeak) {
      reading = `⛔ 오늘 카드가 약한 ${ctx.weakOh}(${WEAK_OHAENG_ORGAN[ctx.weakOh!]}) 기운을 억누릅니다. ${WEAK_OHAENG_ORGAN[ctx.weakOh!]} 관련 증상 악화에 주의하고 무리하지 마세요. ` + reading;
    } else if (cross.supplementsWeak && ctx.isExtremeWeak) {
      reading = `🌿 오늘 카드가 부족한 ${ctx.weakOh} 기운을 보충해줍니다! 건강 관리·치료에 좋은 날입니다. ` + reading;
    }
    if (ctx.isModerateWeak && ctx.weakOh) {
      reading += ` 💊 ${ctx.weakOh}(${WEAK_OHAENG_ORGAN[ctx.weakOh]}) 부위를 꾸준히 관리하세요.`;
    }
  }
  return reading;
}
