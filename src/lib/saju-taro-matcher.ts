/**
 * 사주-타로 연동 매칭 로직
 * 사주 분석 결과를 바탕으로 타로 카드를 해석하는 핵심 엔진
 */

import type { SajuResult, Ohaeng } from './saju-engine';
import { OHAENG_SANGSAENG, OHAENG_SANGGEUK } from './saju-engine';
import type { TarotCard } from '@/data/tarot-cards';
import { ALL_TAROT_CARDS } from '@/data/tarot-cards';
import {
  extractSajuContext,
  crossCheckTarotCard,
  analyzeSpreadOhaengCoverage,
  SUIT_OHAENG as SUIT_OHAENG_MAP,
  WEAK_OHAENG_ORGAN,
  type SajuContext,
} from './saju-context-filter';

// ========== 스프레드 타입 ==========

export type SpreadType = 'one' | 'three' | 'celtic';

export interface DrawnCard {
  card: TarotCard;
  isReversed: boolean;
  position: string;       // 스프레드에서의 위치 의미
  positionIndex: number;
}

export interface TarotReading {
  spread: SpreadType;
  cards: DrawnCard[];
  saju: SajuResult;
  overallMessage: string;
  dominantElement: Ohaeng;
}

// ========== 스프레드 정의 ==========

const SPREAD_POSITIONS: Record<SpreadType, string[]> = {
  one: ['현재 상황'],
  three: ['과거', '현재', '미래'],
  celtic: [
    '현재 상황',
    '장애물/도전',
    '의식/목표',
    '무의식/근본',
    '과거',
    '가까운 미래',
    '자신의 태도',
    '주변 환경',
    '희망과 두려움',
    '최종 결과',
  ],
};

// ========== 질문 키워드별 3카드 포지션 ==========

function getThreeCardPositions(userQuestion?: string): string[] {
  if (!userQuestion || !userQuestion.trim()) return ['과거', '현재', '미래'];
  const q = userQuestion.trim().toLowerCase();

  // 바람/외도/불륜
  if (/바람|외도|불륜|도화|유혹|간통/.test(q)) {
    return ['본성(바람끼)', '현재 유혹운', '앞으로의 흐름'];
  }
  // 이혼/재혼
  if (/이혼|재혼|별거|파경/.test(q)) {
    return ['결혼운의 본질', '현재 위기 요인', '앞으로의 결혼운'];
  }
  // 결혼/연애
  if (/결혼|연애|사랑|인연|소개팅|짝|고백|썸|만남/.test(q)) {
    return ['인연의 흐름', '현재 연애운', '미래 결혼운'];
  }
  // 이직/취업/직장
  if (/이직|취업|직장|퇴사|면접/.test(q)) {
    return ['직장운의 바탕', '현재 직업운', '앞으로의 변화'];
  }
  // 승진/인정
  if (/승진|인정|성과|평가/.test(q)) {
    return ['실력과 역량', '현재 조직 내 위치', '승진 전망'];
  }
  // 사업/창업
  if (/사업|창업|자영|가게|장사/.test(q)) {
    return ['사업 적성', '현재 사업운', '사업의 미래'];
  }
  // 돈/재물/투자
  if (/재물|돈|금전|투자|부자|수입|월급|로또|주식|재복/.test(q)) {
    return ['재물 복의 뿌리', '현재 금전운', '미래 재물 흐름'];
  }
  // 건강
  if (/건강|병|아프|수술|질병|컨디션|다이어트/.test(q)) {
    return ['체질과 약점', '현재 건강 상태', '건강 전망'];
  }
  // 자녀/출산
  if (/자녀|아이|아들|딸|출산|임신/.test(q)) {
    return ['자녀 인연', '현재 자녀운', '출산/양육 전망'];
  }
  // 이사/이동/해외
  if (/이사|이동|이민|해외|유학/.test(q)) {
    return ['현재 터전의 기운', '이동의 필요성', '이동 후 전망'];
  }
  // 학업/시험
  if (/학업|시험|공부|수능|합격|자격증/.test(q)) {
    return ['학업 적성', '현재 학업운', '합격/성취 전망'];
  }
  // 황금기/운명/팔자
  if (/황금기|전성기|운명|팔자|몇\s*살/.test(q)) {
    return ['타고난 운명', '현재 인생 흐름', '최고의 시기'];
  }

  return ['과거', '현재', '미래'];
}

// ========== 질문 분야별 수트 해석 변주 ==========
// 같은 수트라도 질문이 연애인지 직업인지에 따라 에너지 발현 방식이 다름

type QuestionDomain = 'love' | 'career' | 'money' | 'health' | 'general';

function detectQuestionDomain(userQuestion?: string): QuestionDomain {
  if (!userQuestion) return 'general';
  const q = userQuestion.trim();
  if (/결혼|연애|사랑|인연|소개팅|짝|고백|썸|만남|바람|외도|이혼|재혼|배우자/.test(q)) return 'love';
  if (/이직|취업|직장|퇴사|면접|승진|사업|창업|커리어/.test(q)) return 'career';
  if (/재물|돈|금전|투자|수입|월급|주식|재복/.test(q)) return 'money';
  if (/건강|병|아프|수술|질병|컨디션/.test(q)) return 'health';
  return 'general';
}

/** 수트별 질문 분야에 맞는 해석 키워드 */
const SUIT_DOMAIN_KEYWORDS: Record<string, Record<QuestionDomain, string>> = {
  '불': {
    love: '초기 발전 단계의 강렬한 이끌림과 열정',
    career: '리더십과 목표를 향한 강한 추진력',
    money: '과감한 투자와 새로운 수입원 개척',
    health: '활력과 에너지 넘치는 상태',
    general: '열정·창조성·행동력',
  },
  '물': {
    love: '깊은 정서적 교감과 로맨스, 헌신적 유대감',
    career: '직장 내 대인관계의 조화와 감정 통제력',
    money: '감정에 흔들리지 않는 재정 판단 필요',
    health: '정서적 안정이 건강의 핵심',
    general: '감정·직관·사랑·인간관계',
  },
  '공기': {
    love: '지적인 끌림과 솔직한 소통, 또는 머리와 가슴의 갈등',
    career: '치열한 집중력과 빠른 의사결정이 필요한 시기',
    money: '냉철한 분석과 정보력이 재운의 열쇠',
    health: '스트레스와 정신적 과부하 주의',
    general: '지성·논리·소통·갈등',
  },
  '흙': {
    love: '신뢰와 인내심으로 관계의 현실적 안정 구축',
    career: '근면성과 끈기로 실질적 결과물 창출',
    money: '안정적 자산 관리와 저축, 실질적 수익',
    health: '규칙적인 생활과 물리적 환경 관리',
    general: '물질·재정·안정·실용성',
  },
};

/** 카드의 수트 원소에 맞는 질문 분야별 해석 반환 */
export function getSuitDomainKeyword(element: Ohaeng, userQuestion?: string): string {
  const domain = detectQuestionDomain(userQuestion);
  const suitMap: Record<Ohaeng, string> = { '목': '불', '화': '불', '토': '흙', '금': '공기', '수': '물' };
  const suitKey = suitMap[element];
  return SUIT_DOMAIN_KEYWORDS[suitKey]?.[domain] || SUIT_DOMAIN_KEYWORDS[suitKey]?.general || '';
}

// ========== 스프레드 맥락 읽기 — 카드 유형 분포 분석 ==========

// ========== 카드 조합 패턴 15개 (메모리 기반) ==========
const COMBO_PATTERNS: { ids: [number, number]; message: string }[] = [
  { ids: [16, 17], message: '🌟 탑+별 조합: 큰 파괴 후에 반드시 희망이 찾아옵니다. 지금의 위기가 전환점이 될 거예요.' },
  { ids: [13, 14], message: '🔄 죽음+절제 조합: 변화를 건강하게 통합할 수 있는 시기예요. 낡은 것을 보내고 균형을 찾으세요.' },
  { ids: [15, 6], message: '⚡ 악마+연인 조합: 독성 집착과 진정한 선택 사이에서 갈등이 있어요. 진짜 사랑을 구별하세요.' },
  { ids: [2, 18], message: '🔮 여사제+달 조합: 직관이 매우 강한 시기지만, 환상과 통찰이 혼재해요. 냉정한 판단도 필요해요.' },
  { ids: [4, 3], message: '⚖️ 황제+여제 조합: 통제와 양육 사이의 균형이 핵심이에요. 둘 다 필요하지만 한쪽에 치우치면 안 돼요.' },
  { ids: [10, 11], message: '☯️ 운명의 수레바퀴+정의 조합: 인과응보의 시기예요. 뿌린 대로 거두게 됩니다.' },
  { ids: [1, 7], message: '✨ 마법사+전차 조합: 의지력과 추진력이 최고조! 지금 움직이면 원하는 것을 얻을 수 있어요.' },
  { ids: [19, 18], message: '☀️ 태양+달(역방향 무관) 조합: 혼란이 걷히고 진실이 드러나는 시기예요.' },
  // --- 마이너 아르카나 포함 조합 패턴 ---
  { ids: [63, 49], message: '🗡️💧 검의 왕+컵의 여왕 조합: 논리와 감정이 충돌하고 있어요. 이성이 감정을 억압하면 내면이 메말라요. 둘 다 존중하는 균형이 필요합니다.' },
  { ids: [59, 22], message: '⚔️🌱 검의 10+지팡이의 에이스 조합: 완전한 바닥을 찍었지만, 바로 그 자리에서 새로운 열정이 싹트고 있어요! 최악이 최선의 시작점이 됩니다.' },
  { ids: [52, 17], message: '💔⭐ 검의 3+별 조합: 깊은 상처를 통해 영적 성장이 일어나고 있어요. 아픔이 결국 당신을 더 빛나게 만들 거예요.' },
  { ids: [1, 42], message: '🎩🌫️ 마법사+컵의 7 조합: 환상이 걷히고 진짜 실력이 등장하는 시기예요. 달콤한 유혹을 뿌리치고 본질에 집중하세요.' },
  { ids: [58, 53], message: '😰🧘 검의 9+검의 4 조합: 불안과 걱정의 해법은 고요함과 휴식이에요. 머릿속 소음을 멈추고 잠시 쉬어가세요.' },
  { ids: [5, 16], message: '📿⚡ 교황+탑 조합: 겉으로는 조용하지만 내면에서 근본적인 개혁이 일어나고 있어요. 기존 믿음이 무너지며 더 깊은 진리를 발견합니다.' },
  { ids: [37, 45], message: '💕🏠 컵의 2+컵의 10 조합: 만남이 영원한 행복으로 이어지는 최고의 조합이에요! 진심 어린 관계가 가정의 완성으로 발전합니다.' },
  { ids: [57, 8], message: '🔗🦁 검의 8+힘 조합: 정신적 감옥에 갇혀 있지만, 내면의 용기로 탈출할 수 있어요. 두려움은 환상일 뿐, 당신은 충분히 강합니다.' },
];

/** 메이저/코트 카드 다수 출현 + 숫자 반복 + 슈트 쏠림 + 조합 패턴 분석 */
export function getCardTypeDistributionMessage(cards: DrawnCard[]): string {
  const majorCount = cards.filter(c => c.card.id <= 21).length;
  const courtCards = cards.filter(c => c.card.id > 21 && /시종|기사|여왕|왕/.test(c.card.name));
  const reversedCount = cards.filter(c => c.isReversed).length;
  const messages: string[] = [];

  // 메이저 아르카나 비중
  if (majorCount >= Math.ceil(cards.length * 0.6)) {
    messages.push('메이저 아르카나가 많이 나왔어요. 지금 인생의 중대한 전환점이거나, 불가항력적인 큰 흐름이 작용하고 있어요.');
  }

  // 코트 카드 + 성숙도 분석
  if (courtCards.length >= Math.ceil(cards.length * 0.4)) {
    messages.push('궁정 카드(인물 카드)가 많이 나왔어요. 주변 인물들의 영향이 크거나, 당신 안의 여러 자아가 부딪히고 있을 수 있어요.');
  }
  for (const cc of courtCards) {
    const name = cc.card.name;
    if (/시종/.test(name)) {
      messages.push(`${name}: 새로운 기회의 시작 단계예요. 호기심을 갖고 배우는 자세가 중요해요.`);
    } else if (/기사/.test(name)) {
      messages.push(`${name}: 행동과 추진력의 시기예요. 과감하게 움직이되 방향은 신중하게!`);
    } else if (/여왕/.test(name)) {
      messages.push(`${name}: 감성적 지혜와 내면의 힘이 빛나는 때예요. 직관을 믿으세요.`);
    } else if (/왕/.test(name) && !/여왕/.test(name)) {
      messages.push(`${name}: 권위와 숙련도가 완성된 단계예요. 리더십을 발휘할 때입니다.`);
    }
  }

  // 슈트 쏠림 분석
  const suitCounts: Record<string, number> = {};
  for (const c of cards) {
    if (c.card.suit) {
      suitCounts[c.card.suit] = (suitCounts[c.card.suit] || 0) + 1;
    }
  }
  const dominantSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0];
  if (dominantSuit && dominantSuit[1] >= Math.ceil(cards.length * 0.5)) {
    const SUIT_DOMINANCE_MSG: Record<string, string> = {
      wands: '🔥 지팡이(불) 수트가 지배적이에요. 행동력·열정·야망이 핵심 주제입니다.',
      cups: '💧 컵(물) 수트가 지배적이에요. 감정·관계·직관이 핵심 주제입니다.',
      swords: '⚔️ 검(공기) 수트가 지배적이에요. 사고·소통·갈등이 핵심 주제입니다.',
      pentacles: '🪙 동전(흙) 수트가 지배적이에요. 재물·안정·실질적 결과가 핵심 주제입니다.',
    };
    if (SUIT_DOMINANCE_MSG[dominantSuit[0]]) {
      messages.push(SUIT_DOMINANCE_MSG[dominantSuit[0]]);
    }
  }

  // 숫자 반복 패턴 감지
  const numberCounts: Record<number, number> = {};
  for (const c of cards) {
    if (c.card.number && c.card.number <= 10) {
      numberCounts[c.card.number] = (numberCounts[c.card.number] || 0) + 1;
    }
  }
  for (const [num, count] of Object.entries(numberCounts)) {
    if (count >= 2) {
      const NUMBER_MEANINGS: Record<string, string> = {
        '1': '새로운 시작의 에너지가 매우 강해요!',
        '2': '선택과 균형의 시기입니다.',
        '3': '창조와 성장의 기운이 넘쳐요.',
        '4': '안정과 기반 다지기가 핵심이에요.',
        '5': '변화와 도전의 파도가 밀려오고 있어요.',
        '6': '조화와 회복의 에너지가 강합니다.',
        '7': '내면 탐구와 깊은 성찰의 시기예요.',
        '8': '힘과 성취가 가까워지고 있어요.',
        '9': '완성 직전! 마무리에 집중하세요.',
        '10': '한 사이클의 끝과 새 시작이 동시에 일어나요.',
      };
      messages.push(`🔢 숫자 ${num}이 ${count}번 반복! ${NUMBER_MEANINGS[num] || ''}`);
    }
  }

  // 역방향 클러스터링 감지
  if (reversedCount >= Math.ceil(cards.length * 0.6) && cards.length >= 3) {
    messages.push('🔄 역방향 카드가 집중적으로 나왔어요. 지금은 밖으로 나아가기보다 내면을 정리하고 미뤄둔 문제를 해결하는 시기예요.');
  }

  // 카드 조합 패턴 매칭
  const cardIds = cards.map(c => c.card.id);
  for (const combo of COMBO_PATTERNS) {
    if (cardIds.includes(combo.ids[0]) && cardIds.includes(combo.ids[1])) {
      messages.push(combo.message);
    }
  }

  return messages.join('\n');
}

// ========== 사주 기반 카드 뽑기 ==========

/**
 * 사주의 오행 분포를 고려한 가중치 기반 카드 뽑기
 * 완전 랜덤이 아니라, 사주에 따라 특정 카드가 나올 확률이 달라짐
 */
export function drawCardsWithSaju(
  saju: SajuResult,
  spreadType: SpreadType,
  userQuestion?: string
): DrawnCard[] {
  const positions = spreadType === 'three' ? getThreeCardPositions(userQuestion) : SPREAD_POSITIONS[spreadType];
  const numCards = positions.length;

  // 심화 사주 컨텍스트 (가중치 + 역방향 확률에 사용)
  const { extractSajuContextDeep } = require('./saju-context-filter');
  const deepCtx = extractSajuContextDeep(saju);

  // 사주 오행 분포에 따른 카드 가중치 계산
  const weightedCards = ALL_TAROT_CARDS.map(card => {
    let weight = 1;

    // 카드의 원소가 용신과 같으면 가중치 높임
    if (card.element === saju.yongsin) weight += 2;

    // 카드의 원소가 일간의 오행과 상생이면 가중치 높임
    const ilganOhaeng = saju.day.cheonganOhaeng;
    if (OHAENG_SANGSAENG[card.element] === ilganOhaeng) weight += 1;
    if (OHAENG_SANGSAENG[ilganOhaeng] === card.element) weight += 1;

    // 카드의 원소가 기신과 같으면 역방향 나올 확률 높임
    if (card.element === saju.gisin) weight += 0.5; // 나오긴 하되...

    // ===== 심화 사주 이론 가중치 =====
    // 조후: 부족한 기운의 카드 가중치 높임
    if (deepCtx.johuType === '한습' && card.element === '화') weight += 0.3;
    if (deepCtx.johuType === '난조' && card.element === '수') weight += 0.3;

    // 신강/신약: 필요한 에너지 카드 가중치
    const shikOh = OHAENG_SANGSAENG[ilganOhaeng]; // 식상 오행
    const inOh = Object.entries(OHAENG_SANGSAENG).find(([, v]) => v === ilganOhaeng)?.[0];
    if ((deepCtx.singangType === '극신강' || deepCtx.singangType === '신강') && card.element === shikOh) weight += 0.2;
    if ((deepCtx.singangType === '극신약' || deepCtx.singangType === '신약') && inOh && card.element === inOh) weight += 0.2;

    // 식신생재: Pentacles(토) 카드 가중치
    if (deepCtx.hasShikshinSaengJae && card.element === '토') weight += 0.3;

    return { card, weight };
  });

  // 가중치 기반 랜덤 선택
  const totalWeight = weightedCards.reduce((sum, wc) => sum + wc.weight, 0);
  const selected: DrawnCard[] = [];
  const usedIds = new Set<number>();

  for (let i = 0; i < numCards; i++) {
    let attempts = 0;
    while (attempts < 100) {
      let rand = Math.random() * totalWeight;
      for (const wc of weightedCards) {
        rand -= wc.weight;
        if (rand <= 0 && !usedIds.has(wc.card.id)) {
          // 역방향 확률: 기신 원소면 60%, 용신이면 20%, 나머지 40%
          let reversedChance = 0.4;
          if (wc.card.element === saju.gisin) reversedChance = 0.6;
          if (wc.card.element === saju.yongsin) reversedChance = 0.2;
          // 재다신약: 재물(토) 카드 역방향 확률 상승 (감당 부족)
          if (deepCtx.isJaeDaSinYak && wc.card.element === '토') reversedChance += 0.15;

          selected.push({
            card: wc.card,
            isReversed: Math.random() < reversedChance,
            position: positions[i],
            positionIndex: i,
          });
          usedIds.add(wc.card.id);
          break;
        }
      }
      if (selected.length === i + 1) break;
      attempts++;
    }
  }

  return selected;
}

// ========== 오행 이름 풀이 ==========

const OHAENG_PLAIN: Record<Ohaeng, string> = {
  '목': '나무의 기운 (성장·도전)',
  '화': '불의 기운 (열정·표현)',
  '토': '흙의 기운 (안정·신뢰)',
  '금': '쇠의 기운 (결단·정의)',
  '수': '물의 기운 (지혜·유연)',
};

const OHAENG_EMOJI: Record<Ohaeng, string> = {
  '목': '🌿', '화': '🔥', '토': '🏔️', '금': '⚔️', '수': '💧',
};

// ========== WIND 모델 — 역방향 카드 성질 빠른 파악 ==========
// Weakened energy(약화), Inverted meaning(반전), Negative influence(부정), Delay(지연)

type WindAspect = 'weakened' | 'inverted' | 'negative' | 'delay';

/** 포지션과 사주 맥락 + 주변 카드 컨텍스트에 따라 WIND 중 가장 적합한 성질 판단
 *  - 주변에 Swords 수트 or Tower(16) 카드가 있으면 → I(반전)보다 N(부정적 왜곡) 쪽으로 전환
 *  - 이론: 날카로운/파괴적 카드가 둘러싸면 같은 특성이 과도·왜곡되어 해롭게 발현 */
function getWindAspect(position: string, isGisin: boolean, neighborCards?: TarotCard[]): WindAspect {
  const isPast = /과거|뿌리|본성|타고난|체질|무의식/.test(position);
  const isFuture = /미래|흐름|결과|가능성|시기|방향/.test(position);

  // 주변 카드에 Swords 수트 또는 Tower가 있으면 N(부정) 쪽으로 밀어줌
  const hasSwordsOrTowerNeighbor = neighborCards?.some(
    c => c.suit === 'swords' || c.id === 16
  ) ?? false;

  if (isFuture) return isGisin ? 'negative' : 'delay';
  if (isPast) {
    // 원래 I(inverted)지만 주변에 날카로운 카드가 있으면 N(negative)
    return hasSwordsOrTowerNeighbor ? 'negative' : 'inverted';
  }
  // 현재/기본: 원래 W(weakened)지만 주변이 날카로우면 N
  return hasSwordsOrTowerNeighbor && isGisin ? 'negative' : 'weakened';
}

const WIND_LABELS: Record<WindAspect, string> = {
  weakened: '에너지 약화',
  inverted: '의미 반전 — 내면화된 기운',
  negative: '주의 필요한 부정적 영향',
  delay: '아직 때가 아닌 지연·보류',
};

// ========== R.I.T.E. 리딩 접근법 ==========
// 해석은 상호작용적(Interactive), 변형적(Transformational), 힘을 실어주는(Empowering) 방향으로
// 부정 카드도 → 문제 원인 파악 + 회복탄력성 기르는 긍정적 행동 조언

/** 부정적 카드/역방향에 R.I.T.E. 원칙 적용 — 절망 대신 행동 방향 제시 */
function getRiteAdvice(cardName: string, isGisin: boolean): string {
  if (isGisin) {
    return `이 카드가 보여주는 도전은, 그 안에 성장의 씨앗이 숨어있다는 뜻이에요. ` +
      `"${cardName}"가 주는 불편함을 외면하지 않고 마주하면, 자신만의 회복탄력성을 키울 수 있어요.`;
  }
  return `"${cardName}" 카드는 지금 필요한 변화를 보여주고 있어요. ` +
    `이 상황을 받아들이되, 당신의 선택으로 방향을 바꿀 수 있다는 걸 기억하세요.`;
}

// ========== 역방향 카드 4단계 심층 해석 프레임워크 ==========

/**
 * 역방향 카드를 4가지 관점(Layer) + WIND 모델로 분석
 * 포지션(과거/현재/미래)과 질문 유형에 따라 강조 레이어가 달라짐
 * R.I.T.E. 원칙: 부정 카드도 행동 방향과 희망을 함께 제시
 */
function getReversedDeepInterpretation(
  card: TarotCard,
  position: string,
  saju: SajuResult,
  neighborCards?: TarotCard[],
): string {
  const kw = card.keywords.slice(0, 2).join('·');
  const cardName = card.name;
  const isGisin = card.element === saju.gisin;
  const isYongsin = card.element === saju.yongsin;
  const ohEmoji = OHAENG_EMOJI[card.element];
  const isCourtCard = card.id > 21 && /시종|기사|여왕|왕/.test(card.name);

  // 포지션에 따라 레이어 우선순위 결정
  const isPast = /과거|뿌리|본성|타고난|체질|무의식/.test(position);
  const isFuture = /미래|흐름|결과|가능성|시기|방향/.test(position);
  const isInner = /내면|심리|두려움|희망|태도/.test(position);

  // WIND 모델로 역방향 성질 판단 (주변 카드 컨텍스트 반영)
  const windAspect = getWindAspect(position, isGisin, neighborCards);
  const windLabel = WIND_LABELS[windAspect];

  let interpretation = '';

  if (isFuture) {
    // Layer 1 & 2: 에너지 지연 + 피할 수 있는 장애물
    // WIND-Delay 핵심: 지연 ≠ 무산. 에너지가 사라진 게 아니라 보류·억눌린 상태
    interpretation = `"${cardName}" 카드가 뒤집혀 나왔어요 [${windLabel}]. ${kw}의 에너지가 아직 완전히 발휘되지 못하고 막혀있는 상태예요. `;
    interpretation += `중요한 건, 이건 '안 된다'는 뜻이 절대 아니에요! 기대했던 성과나 보상이 사라진 게 아니라 시기적으로 늦춰지고 있을 뿐이에요. `;
    if (isGisin) {
      interpretation += `특히 ${ohEmoji} 기운이 조심해야 할 에너지라서, 충동적으로 움직이면 장애물에 부딪힐 수 있어요. `;
    }
    interpretation += `좌절하기보다 인내심을 갖고 장애물을 하나씩 해결하며 때를 기다려보세요. 지금 이걸 알았으니, 미리 준비하면 충분히 피하거나 줄일 수 있는 장애물이에요. `;
    interpretation += getRiteAdvice(cardName, isGisin);
  } else if (isPast) {
    // Layer 3 & 4: 내면화된 믿음 + 그림자 작업
    interpretation = `"${cardName}" 카드가 뒤집혀 나왔어요 [${windLabel}]. 과거의 경험에서 생긴 마음의 짐이 지금도 영향을 주고 있을 수 있어요. `;
    interpretation += `${kw}의 에너지가 막혀있다는 건, 어쩌면 "나는 이걸 할 수 없어" 같은 생각이 무의식에 자리 잡았다는 뜻이에요. `;
    if (isYongsin) {
      interpretation += `하지만 이 ${ohEmoji} 기운은 당신에게 꼭 필요한 에너지예요! 두려워하지 말고 받아들여보세요. `;
    }
    interpretation += `이 그림자를 인정하고 받아들이면, 오히려 큰 힘이 되어줄 거예요. `;
    interpretation += getRiteAdvice(cardName, isGisin);
  } else if (isInner) {
    // Layer 3: 내면화된 믿음
    interpretation = `"${cardName}" 카드가 뒤집혀 나왔어요 [${windLabel}]. ${kw}의 에너지가 밖으로 표현되지 못하고 마음 안에서만 맴돌고 있어요. `;
    interpretation += `혹시 "이러면 안 되는데..." 하고 자신을 억누르고 있지는 않나요? `;
    interpretation += `당신의 진짜 마음을 있는 그대로 바라보는 것이 첫 번째 해결책이에요. `;
    interpretation += getRiteAdvice(cardName, isGisin);
  } else {
    // 기본: Layer 1 + Layer 4 혼합
    interpretation = `"${cardName}" 카드가 뒤집혀 나왔어요 [${windLabel}]. ${kw}의 에너지가 지금은 온전히 발휘되지 못하고 있어요. `;
    if (isGisin) {
      interpretation += `${ohEmoji} 기운이 조심해야 할 에너지라서, 이 카드는 "잠깐, 다시 생각해봐!"라는 우주의 경고예요. `;
    } else if (isYongsin) {
      interpretation += `이 ${ohEmoji} 기운은 당신에게 도움이 되는 에너지인데 막혀있으니, 무엇이 방해하는지 찾아보세요. `;
    }
    interpretation += `이 카드가 보여주는 불편한 면을 외면하지 않고 바라보면, 성장의 열쇠를 발견할 수 있어요. `;
    interpretation += getRiteAdvice(cardName, isGisin);
  }

  // 궁정 카드(Court Card) 역방향 특수 해석 추가
  if (isCourtCard) {
    interpretation += ` 💡 이 카드는 인물 카드가 뒤집힌 것이라, 주변의 특정 인물이 부정적 영향을 줄 수 있다는 경고이기도 해요. `;
    interpretation += `숨겨진 장애물이나 드러나지 않은 갈등이 있을 수 있으니, 가까운 관계를 한 번 점검해보세요.`;
  }

  // I→N 컨텍스트 전환 안내: 주변 Swords/Tower로 인해 N(부정)으로 판단된 경우
  const hasSwordsOrTower = neighborCards?.some(c => c.suit === 'swords' || c.id === 16) ?? false;
  if (windAspect === 'negative' && hasSwordsOrTower && !isFuture) {
    interpretation += ` ⚠️ 주변에 갈등·파괴를 상징하는 카드가 함께 나왔기 때문에, 이 역방향은 단순한 반전이 아니라 같은 에너지가 과도하게 왜곡되어 부정적으로 발현될 수 있어요. 주변 환경이나 관계에서 오는 압박을 점검해보세요.`;
  }

  return interpretation;
}

// ========== 사주 오행 ↔ 타로 수트 가중치 분석 ==========

/**
 * 사주의 오행 과다/부족에 따라 타로 수트별 특별 메시지 생성
 */
function getOhaengSuitEnhancement(saju: SajuResult, cards: DrawnCard[]): string {
  const balance = saju.ohaengBalance;
  const maxOh = (Object.entries(balance) as [Ohaeng, number][]).sort((a, b) => b[1] - a[1])[0];
  const minOh = (Object.entries(balance) as [Ohaeng, number][]).sort((a, b) => a[1] - b[1])[0];

  // 사주 오행 ↔ 타로 수트 매핑
  const OHAENG_SUIT: Record<Ohaeng, string> = {
    '목': '지팡이(Wands)', '화': '지팡이(Wands)', '토': '동전(Pentacles)',
    '금': '검(Swords)', '수': '잔(Cups)',
  };

  let msg = '';

  // 과다 오행에 해당하는 수트 카드가 나왔는지 확인
  const excessSuitCards = cards.filter(c => c.card.element === maxOh[0]);
  if (excessSuitCards.length > 0 && maxOh[1] >= 3) {
    const suitName = OHAENG_SUIT[maxOh[0]];
    msg += `\n⚖️ 사주-타로 연계 분석: 당신의 사주에 ${OHAENG_EMOJI[maxOh[0]]}${OHAENG_PLAIN[maxOh[0]]}이 이미 강한데, 타로에서도 ${suitName} 계열 카드가 나왔어요. `;
    if (excessSuitCards.some(c => c.isReversed)) {
      msg += `뒤집힌 ${suitName} 카드는 "이 에너지가 넘치니까 조절하세요!"라는 강한 신호예요. 과하면 독이 되듯, 균형을 잡는 게 중요해요.\n`;
    } else {
      msg += `이 에너지를 잘 다루면 큰 힘이 되지만, 과하면 문제가 될 수 있으니 균형을 의식하세요.\n`;
    }
  }

  // 부족 오행에 해당하는 수트 카드가 나왔는지 확인
  const deficitSuitCards = cards.filter(c => c.card.element === minOh[0]);
  if (deficitSuitCards.length > 0 && minOh[1] <= 1) {
    const suitName = OHAENG_SUIT[minOh[0]];
    msg += `\n💡 사주-타로 보완 신호: 당신의 사주에 부족한 ${OHAENG_EMOJI[minOh[0]]}${OHAENG_PLAIN[minOh[0]]}의 ${suitName} 카드가 나왔어요! `;
    if (!deficitSuitCards.some(c => c.isReversed)) {
      msg += `이건 부족한 에너지를 채울 기회가 오고 있다는 좋은 신호예요. 이 방향으로 적극적으로 움직여보세요!\n`;
    } else {
      msg += `하지만 뒤집혀 나왔으니, 이 에너지를 받아들이는 데 아직 준비가 필요해요. 천천히 시작해보세요.\n`;
    }
  }

  return msg;
}

// ========== 종합 해석 생성 ==========

/**
 * 사주와 타로 카드를 종합한 해석 메시지 생성
 * 일반인이 이해하기 쉬운 표현으로 작성
 */
export function generateOverallReading(saju: SajuResult, cards: DrawnCard[], userQuestion?: string): string {
  const ilganOhaeng = saju.day.cheonganOhaeng;
  const yongsin = saju.yongsin;

  // 뽑힌 카드들의 원소 분포 분석
  const cardElements: Record<Ohaeng, number> = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
  let majorCount = 0;
  let reversedCount = 0;
  let uprightCount = 0;

  for (const drawn of cards) {
    cardElements[drawn.card.element]++;
    if (drawn.card.arcana === 'major') majorCount++;
    if (drawn.isReversed) reversedCount++;
    else uprightCount++;
  }

  const dominantCardElement = (Object.entries(cardElements) as [Ohaeng, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  let message = '';

  // 질문이 있으면 질문에 대한 답변 형태로 시작
  if (userQuestion && userQuestion.trim()) {
    message += `💬 "${userQuestion}"에 대한 카드의 답변\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    message += generateQuestionResponse(userQuestion, cards, saju, dominantCardElement) + '\n\n';
  }

  // 전체 분위기 요약
  message += `✨ 종합 리딩 요약\n`;
  message += `━━━━━━━━━━━━━━━━━━\n\n`;

  // 긍정도 판단
  const positivityScore = uprightCount / cards.length;
  if (positivityScore >= 0.7) {
    message += `전체적으로 매우 긍정적인 카드가 나왔습니다! 지금은 적극적으로 움직이면 좋은 결과를 얻을 수 있는 시기입니다.\n\n`;
  } else if (positivityScore >= 0.4) {
    message += `긍정적인 면과 주의할 점이 함께 나왔습니다. 좋은 흐름을 살리되, 카드가 경고하는 부분은 조심하세요.\n\n`;
  } else {
    message += `지금은 조심하고 돌아보는 시기입니다. 무리하게 밀어붙이기보다 내면을 정리하고 준비하는 것이 현명합니다.\n\n`;
  }

  // 사주와 카드의 궁합 분석 (쉬운 말로)
  if (dominantCardElement === yongsin) {
    message += `🍀 행운 신호: 오늘 뽑힌 카드에 당신에게 가장 도움이 되는 ${OHAENG_EMOJI[yongsin]}${OHAENG_PLAIN[yongsin]}이 강하게 나타났습니다. 우주가 당신을 응원하고 있는 것과 같은 에너지입니다!\n\n`;
  } else if (dominantCardElement === saju.gisin) {
    message += `⚠️ 주의 신호: 카드에 당신이 조심해야 할 ${OHAENG_EMOJI[saju.gisin]}${OHAENG_PLAIN[saju.gisin]}이 많이 보입니다. 이 에너지에 끌려다니지 말고 한 발 물러서서 냉정하게 판단하세요.\n\n`;
  } else {
    message += `${OHAENG_EMOJI[dominantCardElement]} 카드에서 ${OHAENG_PLAIN[dominantCardElement]}이 주로 느껴집니다. 이 에너지를 잘 활용하면 좋은 결과를 만들 수 있습니다.\n\n`;
  }

  // 사주↔타로 원소 교차 분석
  const SUIT_OHAENG: Record<string, string> = { wands: '목/화(성장·열정)', cups: '수(감정·직관)', swords: '금(지성·판단)', pentacles: '토(안정·물질)' };
  const suitCounts: Record<string, number> = {};
  for (const drawn of cards) {
    if (drawn.card.suit) {
      suitCounts[drawn.card.suit] = (suitCounts[drawn.card.suit] || 0) + 1;
    }
  }
  const dominantSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0];
  if (dominantSuit) {
    const suitOh = SUIT_OHAENG[dominantSuit[0]] || '';
    message += `🔗 사주↔타로 원소 분석: 뽑힌 카드에서 ${suitOh} 수트가 강하게 나왔습니다. `;
    if (dominantSuit[0] === 'cups' && saju.yongsin === '수') {
      message += `당신의 사주 용신(${OHAENG_EMOJI['수']}물)과 일치하여 감정적·직관적 영역에서 큰 힘을 받을 수 있습니다!\n\n`;
    } else if (dominantSuit[0] === 'swords' && saju.yongsin === '금') {
      message += `당신의 사주 용신(${OHAENG_EMOJI['금']}쇠)과 일치하여 분석력·결단력이 빛나는 시기입니다!\n\n`;
    } else if (dominantSuit[0] === 'pentacles' && saju.yongsin === '토') {
      message += `당신의 사주 용신(${OHAENG_EMOJI['토']}흙)과 일치하여 재물·안정 운이 강화됩니다!\n\n`;
    } else if ((dominantSuit[0] === 'wands') && (saju.yongsin === '목' || saju.yongsin === '화')) {
      message += `당신의 사주 용신(${OHAENG_EMOJI[saju.yongsin]})과 일치하여 행동력·창의력이 극대화되는 시기입니다!\n\n`;
    } else {
      message += `이 에너지는 사주의 ${OHAENG_EMOJI[ilganOhaeng]}${OHAENG_PLAIN[ilganOhaeng]} 일간과 상호작용하며 균형을 만들어냅니다.\n\n`;
    }
  }

  // 사주 일간과 카드 원소의 상생/상극 관계
  const yongsinCards = cards.filter(c => c.card.element === yongsin);
  const gisinCards = cards.filter(c => c.card.element === saju.gisin);
  if (yongsinCards.length > 0 && gisinCards.length === 0) {
    message += `✅ 기신 카드 없이 용신(${OHAENG_EMOJI[yongsin]}${OHAENG_PLAIN[yongsin]}) 카드만 나왔습니다 — 사주와 타로가 함께 좋은 방향을 가리키고 있어요!\n\n`;
  } else if (gisinCards.length > yongsinCards.length) {
    message += `⚠️ 기신(${OHAENG_EMOJI[saju.gisin]}${OHAENG_PLAIN[saju.gisin]}) 에너지 카드가 많습니다. 사주와 타로 모두 지금 신중할 것을 권하고 있어요. 충동적 결정을 피하세요.\n\n`;
  }

  // 사주 교차검증: 약한 오행 + 오행 커버리지
  const ctx = extractSajuContext(saju);
  const cardOhaengs = cards.map(c => c.card.element as Ohaeng | undefined);
  const coverageMsg = analyzeSpreadOhaengCoverage(cardOhaengs, ctx);
  if (coverageMsg) {
    message += `🔬 사주↔타로 교차검증\n${coverageMsg}\n\n`;
  }

  // 개별 카드 교차검증 요약 (기신/용신/약한오행 보충/억압)
  if (ctx.isExtremeWeak) {
    const suppressCards = cards.filter(c => {
      const check = crossCheckTarotCard(c.card.element as Ohaeng, ctx, c.isReversed);
      return check.suppressesWeak;
    });
    if (suppressCards.length > 0) {
      message += `⛔ 건강 주의: ${suppressCards.length}장의 카드가 이미 약한 ${ctx.weakOh}(${WEAK_OHAENG_ORGAN[ctx.weakOh!]}) 기운을 더 억누르고 있습니다. 오늘은 특히 ${WEAK_OHAENG_ORGAN[ctx.weakOh!]} 관리에 신경 쓰세요.\n\n`;
    }
  }

  // 메이저/마이너 비율 분석
  if (majorCount >= cards.length / 2) {
    message += `🌟 메이저 카드(인생의 큰 전환점을 알려주는 카드)가 많이 나왔습니다. 지금 겪고 있는 일이 단순한 일상이 아니라 인생의 중요한 갈림길일 수 있습니다.\n\n`;
  }

  // 정방향/역방향 분석 (쉬운 설명)
  if (reversedCount > cards.length / 2) {
    message += `🔄 뒤집힌 카드(돌아볼 점을 알려주는 카드)가 많습니다. 지금은 밖으로 나아가기보다 자신의 내면을 정리하고, 미루어둔 문제를 해결하는 것이 우선입니다.\n\n`;
  } else if (reversedCount === 0) {
    message += `☀️ 모든 카드가 순조로운 방향으로 나왔습니다! 에너지의 흐름이 막힘없이 잘 통하고 있습니다. 지금의 방향을 믿고 나아가세요.\n\n`;
  }

  // 3카드 스프레드일 때 포지션별 해석
  if (cards.length === 3) {
    message += `📖 카드 배치 해석:\n`;
    for (let i = 0; i < 3; i++) {
      const c = cards[i];
      const posName = c.position;
      const cardName = c.card.name;
      const rev = c.isReversed;
      const revTag = rev ? '(뒤집힘)' : '';
      // 포지션 맥락에 맞는 해석
      let posInterp = '';
      if (/본성|적성|뿌리|체질|타고난|인연|실력|현재 터전|결혼운의 본질/.test(posName)) {
        posInterp = rev
          ? '타고난 기질에 불안정한 요소가 있습니다. 자기 이해가 먼저 필요해요.'
          : '타고난 바탕이 탄탄합니다. 본래의 기질을 믿어도 좋습니다.';
      } else if (/현재|지금|조직 내/.test(posName)) {
        posInterp = rev
          ? '현재 상황에 돌아볼 점이 있습니다. 내면을 점검하세요.'
          : '지금의 흐름이 순조롭습니다. 이 방향을 유지하세요.';
      } else if (/미래|전망|앞으로|흐름|최고의 시기/.test(posName)) {
        posInterp = rev
          ? '앞으로 신중한 접근이 필요합니다. 서두르지 말고 준비하세요.'
          : '앞으로 좋은 변화가 기대됩니다. 적극적으로 움직이세요.';
      } else if (/필요성|위기|유혹/.test(posName)) {
        posInterp = rev
          ? '외부 자극에 흔들릴 수 있는 시기입니다. 중심을 잡으세요.'
          : '큰 위험 요소는 없지만 방심은 금물입니다.';
      } else {
        posInterp = rev
          ? '이 영역에 주의가 필요합니다.'
          : '이 영역에서 긍정적인 기운이 흐르고 있습니다.';
      }
      message += `• ${posName}: ${cardName}${revTag} — ${posInterp}\n`;
      // 역방향 카드에 4단계 심층 해석 추가
      if (rev) {
        // 주변 카드 목록 (I vs N 컨텍스트 전환용)
        const neighborCardObjs = cards.filter((_, idx) => idx !== i).map(n => n.card);
        message += `  └ ${getReversedDeepInterpretation(c.card, posName, saju, neighborCardObjs)}\n`;
        // 주변 카드 맥락 완화: 옆 카드가 긍정적이면 역방향 해석 톤 다운
        const neighbors = cards.filter((_, idx) => idx !== i && !cards[idx].isReversed);
        const hasPositiveNeighbor = neighbors.some(n =>
          n.card.element === yongsin || (n.card.id <= 21 && [17, 19, 21, 6, 10].includes(n.card.id))
        ); // Star(17), Sun(19), World(21), Lovers(6), Wheel(10) = 대표 긍정 메이저
        if (hasPositiveNeighbor) {
          message += `  └ 💫 다만 주변에 긍정적인 카드가 함께 나왔으므로, 이 역방향의 영향은 크지 않거나 일시적일 수 있어요. 너무 걱정하지 마세요!\n`;
        }
      }
    }
    message += '\n';
  }

  // 사주 오행 ↔ 타로 수트 가중치 분석 추가
  const ohaengSuitMsg = getOhaengSuitEnhancement(saju, cards);
  if (ohaengSuitMsg) {
    message += ohaengSuitMsg + '\n';
  }

  // ===== 사주 심화 이론 ↔ 타로 교차분석 =====
  {
    const { extractSajuContextDeep } = require('./saju-context-filter');
    const deep = extractSajuContextDeep(saju);

    // 신강/신약 해석 톤
    if (deep.singangType === '극신강' || deep.singangType === '신강') {
      if (positivityScore >= 0.7) {
        message += `💪 신강 사주 × 긍정 카드: 강한 내면 에너지가 카드의 좋은 흐름을 극대화합니다. 적극적으로 도전하되, 넘치는 에너지를 운동·창작·사회 활동으로 발산하세요.\n\n`;
      } else {
        message += `💪 신강 사주 × 주의 카드: 강한 자아가 시련 앞에서 고집으로 변할 수 있습니다. 유연하게 대처하고, 주변의 조언에 귀 기울이세요.\n\n`;
      }
    } else if (deep.singangType === '극신약' || deep.singangType === '신약') {
      if (positivityScore >= 0.7) {
        message += `🌱 신약 사주 × 긍정 카드: 지금은 우주가 당신을 도와주는 시기입니다. 혼자 밀어붙이지 말고 타인의 도움을 적극 수용하세요.\n\n`;
      } else {
        message += `🌱 신약 사주 × 주의 카드: 에너지가 부족한 시기입니다. 무리하지 말고 쉬며 내면을 다지세요. 인성(공부·멘토)을 보강하면 역전의 기회가 옵니다.\n\n`;
      }
    }

    // 조후 × 카드 원소 교차
    if (deep.johuType === '한습') {
      const fireCards = cards.filter(c => c.card.element === '화');
      if (fireCards.length > 0) {
        message += `🌞 한습 체질 × 화(火) 카드: 차갑고 축축한 체질에 꼭 필요한 따뜻한 에너지 카드가 나왔습니다! 열정과 활력을 되찾을 기회를 놓치지 마세요.\n\n`;
      }
      const waterCards = cards.filter(c => c.card.element === '수');
      if (waterCards.length >= 2) {
        message += `❄️ 한습 체질 × 수(水) 카드 과다: 이미 차가운 체질에 물 에너지가 겹칩니다. 우울감·무기력에 빠지지 않도록 따뜻한 음식, 가벼운 유산소 운동으로 보완하세요.\n\n`;
      }
    } else if (deep.johuType === '난조') {
      const waterCards = cards.filter(c => c.card.element === '수');
      if (waterCards.length > 0) {
        message += `💧 난조 체질 × 수(水) 카드: 뜨겁고 건조한 체질에 시원한 물 에너지가 들어옵니다! 마음의 평화를 찾고 열을 식힐 좋은 기회입니다.\n\n`;
      }
      const fireCards = cards.filter(c => c.card.element === '화');
      if (fireCards.length >= 2) {
        message += `🔥 난조 체질 × 화(火) 카드 과다: 이미 뜨거운 체질에 불 에너지가 겹칩니다. 과열·갈등·염증에 주의하세요. 수영이나 명상으로 열을 식히세요.\n\n`;
      }
    }

    // 재물 구조 × 카드 교차
    const pentacleCards = cards.filter(c => c.card.element === '토');
    if (deep.isJaeDaSinYak && pentacleCards.length > 0) {
      const revPent = pentacleCards.filter(c => c.isReversed);
      if (revPent.length > 0) {
        message += `⚠️ 재다신약 × 역방향 재물 카드: 재물 기회가 있지만 감당 능력이 부족합니다. 규모를 줄이고 인성(공부·자격증)을 보강하여 그릇을 키우세요.\n\n`;
      }
    }
    if (deep.isShinWangJaeWang && pentacleCards.length > 0 && pentacleCards.every(c => !c.isReversed)) {
      message += `🏦 신왕재왕 × 정방향 재물 카드: 재물을 통제할 힘과 기회가 동시에 옵니다. 적극적으로 투자하고 판을 키울 타이밍입니다!\n\n`;
    }
    if (deep.hasShikshinSaengJae && pentacleCards.length > 0) {
      message += `🔄 식신생재 × 재물 카드: 전문 기술과 노력이 재물로 연결되는 구조가 활성화됩니다. 꾸준히 실력을 갈고닦으세요.\n\n`;
    }
  }

  // 종합 조언
  message += `💡 오늘의 핵심 조언\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;

  // 용신 기반 조언
  const YONGSIN_TIP: Record<Ohaeng, string> = {
    '목': '새로운 시작이나 도전이 도움이 됩니다. 자연 속에서 산책하거나, 새로운 것을 배워보세요. 초록색 계열의 물건이 행운을 불러옵니다.',
    '화': '적극적으로 사람들을 만나고, 자신을 표현하세요. 따뜻한 색상의 옷이나 밝은 공간이 에너지를 충전시켜 줍니다.',
    '토': '급하게 움직이기보다 차분하게 기반을 다지세요. 규칙적인 생활 습관과 익숙한 환경이 안정감을 줍니다.',
    '금': '결단이 필요한 일이 있다면 과감하게 정리하세요. 깔끔한 정리정돈과 단호한 결정이 운을 열어줍니다.',
    '수': '직감을 믿고, 조용히 생각할 시간을 가지세요. 물 가까이 가거나, 명상·독서가 좋은 기운을 끌어옵니다.',
  };
  message += YONGSIN_TIP[yongsin] + '\n';

  return message;
}

/**
 * 사용자 질문에 대한 카드 기반 응답 생성
 */
function generateQuestionResponse(
  question: string,
  cards: DrawnCard[],
  saju: SajuResult,
  dominantElement: Ohaeng
): string {
  const q = question.trim().toLowerCase();
  const uprightCount = cards.filter(c => !c.isReversed).length;
  const positivity = uprightCount / cards.length;
  const mainCard = cards[cards.length > 1 ? 1 : 0]; // 현재 위치 카드 우선

  // 질문 유형 분류
  const isLove = /연애|사랑|인연|결혼|이별|썸|짝|고백|만남|소개팅/.test(q);
  const isMoney = /재물|돈|금전|투자|사업|부자|수입|월급|로또|주식/.test(q);
  const isCareer = /이직|취업|직장|승진|시험|합격|면접|사업|창업|공부/.test(q);
  const isHealth = /건강|병|아프|다이어트|운동|스트레스|컨디션/.test(q);
  const isYesNo = /할까|될까|괜찮|좋을까|해도|맞을까|가능|성공/.test(q);

  let response = '';

  // Yes/No 질문에 대한 직접적 답변
  if (isYesNo) {
    if (positivity >= 0.7) {
      response += `카드가 "가도 좋다"는 신호를 보내고 있습니다. `;
      response += mainCard.isReversed
        ? `다만 "${mainCard.card.name}" 카드가 주의를 당부하고 있으니, 신중하게 준비한 뒤 행동에 옮기세요.`
        : `"${mainCard.card.name}" 카드가 밝은 에너지로 응원하고 있어요. 자신감을 갖고 추진하세요!`;
    } else if (positivity >= 0.4) {
      response += `카드가 "조건부 OK"를 내리고 있습니다. `;
      response += `시기를 조금 조절하거나, 준비를 더 단단히 한다면 좋은 결과를 기대할 수 있어요. 서두르지 마세요.`;
    } else {
      response += `지금 당장은 "잠시 멈추라"는 신호입니다. `;
      response += `나쁜 결과가 정해진 것이 아니라, 지금은 준비와 충전의 시간이 필요하다는 뜻이에요. 타이밍을 다시 잡아보세요.`;
    }
  }

  // 분야별 맞춤 응답 (사주 데이터 깊게 연결)
  const ilganOh = saju.day.cheonganOhaeng;
  const monthSipseong = saju.sipseongs?.month || '';
  const hourSipseong = saju.sipseongs?.hour || '';

  if (isLove) {
    response += response ? '\n\n' : '';
    const loveCard = cards.find(c => c.card.element === '화') || mainCard;
    const loveCardOh = loveCard.card.element;
    const isMarried = saju.relationship === 'married';
    // 타로 원소↔사주 오행 연결
    const loveOhMatch = loveCardOh === saju.yongsin ? '용신과 일치하여 매우 긍정적' : loveCardOh === saju.gisin ? '기신과 겹쳐 주의 필요' : '중립적';

    if (isMarried) {
      response += `[사주↔타로 연결] "${loveCard.card.name}" 카드의 ${OHAENG_EMOJI[loveCardOh]}${OHAENG_PLAIN[loveCardOh]} 기운이 당신의 부부 관계에 【${loveOhMatch}】인 에너지입니다. `;
      response += positivity >= 0.5
        ? `부부 관계가 안정적인 흐름입니다. 사주의 용신(${OHAENG_EMOJI[saju.yongsin]}${OHAENG_PLAIN[saju.yongsin]}) 기운을 살려 배우자와 함께하는 시간을 늘리면 관계가 더 깊어집니다.`
        : `부부 사이에 약간의 긴장이 있을 수 있습니다. 기신(${OHAENG_EMOJI[saju.gisin]}${OHAENG_PLAIN[saju.gisin]}) 에너지가 갈등을 부추기고 있으니, 의식적으로 소통을 늘리세요.`;
    } else {
      response += `[사주↔타로 연결] "${loveCard.card.name}" 카드의 ${OHAENG_EMOJI[loveCardOh]}${OHAENG_PLAIN[loveCardOh]} 기운이 당신의 연애운에 【${loveOhMatch}】인 에너지입니다. `;
      response += positivity >= 0.5
        ? `${saju.ilgan}일간의 ${OHAENG_EMOJI[ilganOh]}${OHAENG_PLAIN[ilganOh]} 기운과 카드의 에너지가 조화를 이루고 있어요. 마음을 열면 좋은 인연이 들어옵니다.`
        : `지금은 상대방보다 나 자신의 마음을 먼저 돌보는 것이 중요합니다. ${monthSipseong === '상관' ? '사주의 상관 기운이 이상형 기준을 높이고 있으니 유연한 마음이 필요해요.' : monthSipseong === '비견' ? '사주의 비견 기운이 독립심을 키우고 있어 천천히 다가가세요.' : ''}`;
    }
  }

  if (isMoney) {
    response += response ? '\n\n' : '';
    const moneyCard = cards.find(c => c.card.element === '토') || mainCard;
    const moneyOhMatch = moneyCard.card.element === saju.yongsin ? '용신과 일치! 재물 기운 강화' : moneyCard.card.element === saju.gisin ? '기신 영향으로 금전 손실 주의' : '중립적 흐름';
    response += `[사주↔타로 연결] "${moneyCard.card.name}" 카드의 재물 에너지 — 【${moneyOhMatch}】. `;
    // 겁재 십신 손실 경고
    const hasLossRisk = monthSipseong === '겁재' && moneyCard.card.element === saju.gisin && moneyCard.isReversed;
    if (hasLossRisk) {
      response += `🚨 사주의 겁재 + 기신 역방향 카드 = 금전 손실 위험이 높습니다. 큰 거래·투자·보증은 반드시 보류하세요.`;
    } else {
      response += positivity >= 0.5
        ? `사주의 용신(${OHAENG_EMOJI[saju.yongsin]}${OHAENG_PLAIN[saju.yongsin]})을 활용하면 금전적 기회를 더 잘 잡을 수 있어요. ${['정재', '편재'].includes(monthSipseong) ? '월주에 재성이 있어 돈이 자연스럽게 모이는 구조입니다!' : monthSipseong === '겁재' ? '⚠️ 월주 겁재 에너지가 있어 충동적 지출에 주의하세요.' : '꾸준한 저축과 현명한 투자가 열쇠입니다.'}`
        : `금전적으로 보수적 접근이 현명합니다. ${saju.gisin === moneyCard.card.element ? `카드와 기신이 겹쳐 충동적 소비에 특히 주의하세요.` : '큰 투자는 조금 미루고 안정적 관리에 집중하세요.'}`;
    }
  }

  // 재물 질문: 심화 재물 구조 교차분석
  if (isMoney) {
    const { extractSajuContextDeep } = require('./saju-context-filter');
    const dMoney = extractSajuContextDeep(saju);
    if (dMoney.jaeType === '정재') {
      response += `\n💰 정재형 재물 성향: 안정적 고정수입(월급·임대·적금)이 강점입니다. 투기보다 꾸준한 저축이 부를 쌓는 열쇠입니다.`;
    } else if (dMoney.jaeType === '편재') {
      response += `\n💰 편재형 재물 성향: 사업·투자·유통에서 큰 순환의 힘을 발휘합니다. 대범한 직관력이 장점이지만 과욕은 금물입니다.`;
    }
    if (dMoney.hasShikshinSaengJae) response += `\n🔄 식신생재: 전문 기술로 안정적 부를 쌓는 구조입니다.`;
    if (dMoney.hasSanggwanSaengJae) response += `\n🔄 상관생재: 아이디어·서비스로 이익을 창출하는 구조입니다.`;
    if (dMoney.isJaeDaSinYak) response += `\n⚠️ 재다신약: 재물 기회는 많지만 감당할 힘이 부족합니다. 인성(공부·자격증)으로 그릇을 키우세요.`;
    if (dMoney.isShinWangJaeWang) response += `\n🏦 신왕재왕: 재물을 통제할 힘이 있습니다. 용신운에 스케일을 키우세요.`;
    if (dMoney.isJaeSungHonJap) response += `\n🔀 재성혼잡: 수입원이 산만합니다. 한 가지에 집중하세요.`;
    if (dMoney.isMuJae) response += `\n🚫 무재 사주: 인성(지식)→식상(기술)→재성(수입) 경로로 간접 생재하세요.`;
  }

  if (isCareer) {
    response += response ? '\n\n' : '';
    const careerCard = mainCard;
    const cCtx = extractSajuContext(saju);
    const careerOhMatch = careerCard.card.element === saju.yongsin ? '용신과 일치하여 직업운 상승' : careerCard.card.element === saju.gisin ? '기신 영향으로 직장 내 스트레스 주의' : '안정적 흐름';
    response += `[사주↔타로 연결] "${careerCard.card.name}" 카드 — 【${careerOhMatch}】. `;
    // 건강 극약자: 직업 조언 교차검증
    if (cCtx.isExtremeWeak) {
      response += positivity >= 0.5
        ? `직업운 에너지는 좋지만, ${cCtx.weakOh}(${WEAK_OHAENG_ORGAN[cCtx.weakOh!]}) 기운이 극도로 부족한 상태입니다. 무리한 도전보다 건강이 허락하는 범위 내에서 기회를 잡으세요. ${monthSipseong === '정관' ? '조직 내 안정적 위치를 활용하되 과로는 금물.' : monthSipseong === '식신' ? '창의적 업무는 좋지만 체력 소모를 조절하세요.' : '재택·온라인·파트타임 등 유연한 방식을 고려하세요.'}`
        : `건강이 우선인 시기입니다. 이직·창업 같은 큰 변화는 건강이 안정된 후에 추진하세요. 지금은 치료와 회복에 집중하면서 가볍게 준비만 해두세요.`;
    } else {
      response += positivity >= 0.5
        ? `직업 분야에서 전진의 기운이 보입니다. ${monthSipseong === '정관' ? '사주의 정관이 조직 내 인정과 승진을 도와줍니다.' : monthSipseong === '편재' ? '사주의 편재가 사업적 수완을 발휘하게 합니다.' : monthSipseong === '식신' ? '사주의 식신이 창의적 역량을 극대화합니다.' : '준비된 사람에게 기회가 옵니다.'}`
        : `지금은 큰 변화보다 실력을 쌓는 데 집중하세요. ${monthSipseong === '편관' ? '사주의 편관이 직장 스트레스를 높이고 있으니, 감정 관리가 중요합니다.' : '때가 되면 기회는 반드시 찾아옵니다.'}`;
    }
    // 심화: 오행 적성 + 신강/신약 직업 조언
    const { extractSajuContextDeep } = require('./saju-context-filter');
    const dCareer = extractSajuContextDeep(saju);
    const OHAENG_CAREER_APT: Record<string, string> = {
      '목': '교육·출판·기획 분야', '화': '디자인·방송·미디어 분야',
      '토': '중재·인사·상담 분야', '금': 'IT·공학·법률 분야', '수': '연구·학문·외국어 분야',
    };
    response += `\n📋 오행 적성: ${OHAENG_CAREER_APT[ilganOh] || '다양한 분야'}에 천부적 감각이 있습니다.`;
    if (dCareer.singangType === '신강' || dCareer.singangType === '극신강') {
      response += ' 신강 사주이므로 리더십 포지션, 독립 사업, 활동적 직업에서 빛납니다.';
    } else {
      response += ' 신약 사주이므로 안정적 조직(대기업·공무원·전문직)에서 역량을 발휘하세요.';
    }
    if (dCareer.hasInsasinSamhyung) {
      response += '\n⚔️ 인사신 삼형살: 법률·군경·의료 등 권위 분야가 천직입니다.';
    }
  }

  if (isHealth) {
    response += response ? '\n\n' : '';
    const healthCard = mainCard;
    const qCtx = extractSajuContext(saju);
    const cardCross = crossCheckTarotCard(healthCard.card.element as Ohaeng, qCtx, healthCard.isReversed);
    response += `[사주↔타로 연결] "${healthCard.card.name}" 카드의 ${OHAENG_EMOJI[healthCard.card.element]} 에너지 — `;
    if (qCtx.isExtremeWeak && cardCross.suppressesWeak) {
      response += `⛔ 이 카드가 이미 약한 ${qCtx.weakOh}(${WEAK_OHAENG_ORGAN[qCtx.weakOh!]}) 기운을 더 억누르고 있습니다. 오늘은 ${WEAK_OHAENG_ORGAN[qCtx.weakOh!]} 관리에 특별히 주의하세요. 과로·무리한 활동을 피하고 충분한 휴식이 필수입니다.`;
    } else if (qCtx.isExtremeWeak && cardCross.supplementsWeak) {
      response += `🌿 다행히 이 카드가 부족한 ${qCtx.weakOh} 기운을 보충해주고 있습니다. 오늘은 건강 관리에 좋은 날이니, 치료·운동·영양 보충을 적극적으로 하세요!`;
    } else {
      response += positivity >= 0.5
        ? `건강 면에서 크게 걱정할 것은 없습니다. 다만 사주 기신(${OHAENG_EMOJI[saju.gisin]}${OHAENG_PLAIN[saju.gisin]}) 관련 ${WEAK_OHAENG_ORGAN[saju.gisin]} 계통은 정기 검진을 권합니다.`
        : `몸과 마음의 피로가 쌓여 있을 수 있어요. 사주상 ${WEAK_OHAENG_ORGAN[saju.gisin]} 계통이 약할 수 있으니 특히 주의하고, 용신(${OHAENG_EMOJI[saju.yongsin]}) 기운을 보강하는 음식과 운동이 도움됩니다.`;
    }
    if (cardCross.crossMessage) response += `\n${cardCross.crossMessage}`;
    // 조후 × 건강 카드 교차
    const { extractSajuContextDeep } = require('./saju-context-filter');
    const dHealth = extractSajuContextDeep(saju);
    if (dHealth.johuType === '한습') {
      response += '\n🌡️ 한습 체질: 우울·무기력·냉증에 취약합니다. 따뜻한 음식(쓴맛), 가벼운 유산소 운동, 보온이 핵심입니다.';
    } else if (dHealth.johuType === '난조') {
      response += '\n🌡️ 난조 체질: 과열·염증·피부건조에 취약합니다. 수영, 충분한 수분 섭취, 짠맛·신맛 보충이 핵심입니다.';
    }
    if (dHealth.singangType === '신강' || dHealth.singangType === '극신강') {
      response += '\n🏋️ 신강 체질: 넘치는 에너지를 운동(축구·격투기·헬스)으로 발산하세요.';
    } else {
      response += '\n🧘 신약 체질: 격렬한 운동은 피하고 요가·필라테스·명상이 적합합니다.';
    }
  }

  // 일반 질문 (분류 안 됨)
  if (!isLove && !isMoney && !isCareer && !isHealth && !isYesNo) {
    const mainOhMatch = mainCard.card.element === saju.yongsin ? '카드와 용신이 일치하여 매우 좋은 신호' : mainCard.card.element === saju.gisin ? '카드가 기신 에너지를 경고' : '카드의 에너지가 중립적';
    response += `[사주↔타로 연결] ${saju.ilgan}일간(${OHAENG_EMOJI[ilganOh]}${OHAENG_PLAIN[ilganOh]})의 사주와 "${mainCard.card.name}" 카드를 종합하면 【${mainOhMatch}】입니다. `;
    response += positivity >= 0.6
      ? `전체적으로 순조로운 흐름이 보입니다. 용신(${OHAENG_EMOJI[saju.yongsin]}${OHAENG_PLAIN[saju.yongsin]}) 기운을 잘 활용하면 더 좋은 결과를 얻을 수 있어요.`
      : `지금은 신중한 판단이 필요한 시기입니다. 기신(${OHAENG_EMOJI[saju.gisin]}${OHAENG_PLAIN[saju.gisin]}) 에너지에 휘둘리지 말고 준비하세요.`;
  }

  return response;
}

// ========== 현대적 심리 상담 해석 (투사적 매개체 + 개성화 여정 + 1~2년 스토리) ==========

/**
 * 현재 심리 상태 분석 (타로 카드 기반 심리 투사)
 * "이 카드가 당신에게 어떤 느낌인가요?" 방식의 현대적 접근
 */
function generatePsychologyReading(cards: DrawnCard[], saju: SajuResult): string {
  const mainCard = cards[cards.length > 1 ? 1 : 0]; // 현재 위치 카드
  const cardName = mainCard.card.name;
  const isReversed = mainCard.isReversed;

  // 메이저 아르카나 개성화 여정 매핑
  const INDIVIDUATION_MAP: Record<number, { stage: string; meaning: string }> = {
    0: { stage: '출발점', meaning: '지금 당신은 새로운 시작 앞에 서 있어요. 마치 처음 학교에 가는 날처럼 설레면서도 두려운 마음이 있을 거예요.' },
    1: { stage: '능력 발견', meaning: '당신 안에 숨겨진 재능을 발견하는 시기예요. "나도 이런 걸 할 수 있구나!" 하는 놀라운 깨달음이 올 거예요.' },
    2: { stage: '직관의 성장', meaning: '마음의 소리에 귀 기울이는 시기예요. 머리로 따지는 것보다 느낌이 더 정확한 때예요.' },
    3: { stage: '풍요와 성장', meaning: '사랑과 풍요가 가득한 시기예요. 주변 사람들과의 관계가 더 따뜻해져요.' },
    4: { stage: '구조와 안정', meaning: '규칙과 계획이 중요한 시기예요. 탄탄한 기반을 다지면 나중에 큰 열매를 맺어요.' },
    5: { stage: '지혜 탐구', meaning: '더 깊이 배우고 성장하고 싶은 마음이 커지는 시기예요.' },
    6: { stage: '선택의 기로', meaning: '중요한 선택 앞에 서 있어요. 마음이 이끄는 방향을 따라가세요.' },
    7: { stage: '의지와 전진', meaning: '강한 의지로 앞으로 나아가는 시기예요. 장애물을 뚫고 전진하세요!' },
    8: { stage: '내면의 힘', meaning: '겉으로 보이는 힘이 아니라, 참을성과 인내의 힘이 필요한 때예요.' },
    9: { stage: '내면 성찰', meaning: '혼자만의 시간이 필요한 시기예요. 조용히 자신을 돌아보면 중요한 답을 찾을 수 있어요.' },
    10: { stage: '운명의 전환', meaning: '인생이 새로운 국면으로 접어드는 시기예요. 변화를 자연스럽게 받아들이세요.' },
    11: { stage: '공정한 판단', meaning: '올바른 판단과 공정함이 중요한 시기예요. 감정보다 이성으로 결정하세요.' },
    12: { stage: '관점 전환', meaning: '익숙한 것을 다른 각도에서 보면 완전히 새로운 해답이 보여요.' },
    13: { stage: '변화와 재탄생', meaning: '끝나는 것은 새로운 시작이에요! 낡은 것을 보내고 새로운 나로 다시 태어나는 시기예요.' },
    14: { stage: '균형과 조화', meaning: '이것저것 균형을 맞추는 게 중요한 시기예요. 한쪽에 치우치지 않도록!' },
    15: { stage: '유혹과 집착', meaning: '무언가에 너무 빠져들 수 있는 시기예요. 정말 중요한 게 뭔지 다시 생각해보세요.' },
    16: { stage: '충격과 해방', meaning: '갑작스러운 변화가 올 수 있어요. 무너진 것 위에서 더 단단한 것을 세울 수 있어요!' },
    17: { stage: '희망과 치유', meaning: '힘든 시기를 지나 빛이 보이기 시작해요. 당신은 회복하고 있어요!' },
    18: { stage: '불안과 직감', meaning: '잘 안 보이는 것들이 있어요. 불안하더라도 직감을 믿고 조심조심 나아가세요.' },
    19: { stage: '빛과 성공', meaning: '밝은 에너지가 가득한 시기! 자신감을 갖고 빛나세요!' },
    20: { stage: '각성과 부활', meaning: '과거를 돌아보고 새로운 각오로 다시 시작하는 시기예요.' },
    21: { stage: '완성과 통합', meaning: '지금까지의 여정이 하나로 모이는 순간이에요. 당신은 한 단계 성장했어요!' },
  };

  let psychReading = `🧠 지금 당신의 마음 상태\n`;
  psychReading += `━━━━━━━━━━━━━━━━━━\n\n`;

  // 메이저 아르카나면 개성화 여정 적용
  if (mainCard.card.arcana === 'major' && INDIVIDUATION_MAP[mainCard.card.id]) {
    const journey = INDIVIDUATION_MAP[mainCard.card.id];
    psychReading += `🃏 "${cardName}" 카드가 말하는 당신의 현재 위치: **${journey.stage}**\n\n`;
    psychReading += `${journey.meaning}\n\n`;

    if (isReversed) {
      psychReading += `🔄 이 카드가 뒤집혀 나왔어요. 이것은 이 단계에서 아직 풀지 못한 숙제가 있다는 뜻이에요. ` +
        `마음속에 억눌러 놓은 감정이나 회피하고 있는 문제가 있지 않나요? ` +
        `그 감정을 솔직하게 마주하면 다음 단계로 넘어갈 수 있어요.\n\n`;
    }
  }

  // 사주 기반 심리 보강
  const ilganOhaeng = saju.day.cheonganOhaeng;
  const OHAENG_FEELING: Record<Ohaeng, string> = {
    '목': '새로운 것을 시작하고 싶은 마음, 성장하고 싶은 열망이 있어요',
    '화': '열정적이고 뭔가를 표현하고 싶은 에너지가 넘쳐요',
    '토': '안정과 편안함을 원하고, 변화보다 현재를 지키고 싶어요',
    '금': '뭔가를 정리하고 깔끔하게 결정짓고 싶은 마음이 있어요',
    '수': '깊이 생각하고 혼자만의 시간이 필요한 상태예요',
  };

  psychReading += `💭 당신의 타고난 성향(${ilganOhaeng})으로 볼 때, 지금 ${OHAENG_FEELING[ilganOhaeng]}.\n\n`;

  // 동시성(Synchronicity) 설명
  psychReading += `🔮 동시성(Synchronicity)의 원리\n`;
  psychReading += `이 카드는 우연히 뽑힌 것이 아니에요. 당신의 무의식이 지금 가장 필요한 메시지를 골라낸 거예요. ` +
    `카드의 그림을 천천히 바라보며 "이 그림이 나에게 무엇을 말해주는 것 같은지" 느껴보세요.\n\n`;

  return psychReading;
}

/**
 * 1~2년 미래 스토리 예측 (사주 + 타로 결합)
 */
function generateFutureStory(cards: DrawnCard[], saju: SajuResult): string {
  const currentYear = new Date().getFullYear();
  const mainCard = cards[cards.length > 1 ? 1 : 0];
  const futureCard = cards[cards.length - 1]; // 마지막 카드 = 미래
  const uprightCount = cards.filter(c => !c.isReversed).length;
  const positivity = uprightCount / cards.length;

  let story = `📖 앞으로 1~2년, 당신의 이야기\n`;
  story += `━━━━━━━━━━━━━━━━━━\n\n`;

  // 현재 상황 (올해)
  story += `📅 ${currentYear}년 (올해)\n`;
  if (positivity >= 0.6) {
    story += `지금 당신에게는 ${mainCard.isReversed ? '아직 풀어야 할 과제' : '좋은 흐름'}이 있어요. `;
    story += `"${mainCard.card.name}" 카드가 알려주듯, `;
    story += mainCard.isReversed
      ? `내면의 고민을 먼저 정리하는 시간이 필요해요. 하지만 이 과정이 끝나면 훨씬 단단해질 거예요.\n\n`
      : `에너지가 잘 흐르고 있어요. 이 기운을 살려서 하고 싶었던 일에 도전해보세요!\n\n`;
  } else {
    story += `지금은 준비의 시간이에요. 마치 겨울에 씨앗이 땅속에서 봄을 기다리듯, ` +
      `실력을 쌓고 내면을 정비하는 시기예요. 초조해하지 마세요!\n\n`;
  }

  // 내년
  story += `📅 ${currentYear + 1}년 (내년)\n`;
  if (!futureCard.isReversed && positivity >= 0.5) {
    story += `"${futureCard.card.name}" 카드가 밝은 미래를 가리키고 있어요! `;
    const ilganOhaeng = saju.day.cheonganOhaeng;
    if (ilganOhaeng === '목' || ilganOhaeng === '화') {
      story += `당신의 ${ilganOhaeng === '목' ? '성장하는 힘' : '열정'}이 빛을 발하는 해가 될 거예요. ` +
        `새로운 인연을 만나거나, 오래 준비한 일이 결실을 맺을 가능성이 높아요.\n\n`;
    } else if (ilganOhaeng === '토') {
      story += `안정적인 기반 위에서 한 단계 더 성장하는 해예요. ` +
        `부동산이나 장기 계획에 좋은 결과가 있을 수 있어요.\n\n`;
    } else if (ilganOhaeng === '금') {
      story += `결단력이 빛나는 해! 미루어둔 일을 과감히 정리하고 새 출발을 할 수 있어요.\n\n`;
    } else {
      story += `지혜로운 판단으로 좋은 기회를 잡는 해예요. 직감을 믿으세요!\n\n`;
    }
  } else {
    story += `도전과 시련이 있을 수 있지만, 그만큼 성장하는 해예요. `;
    story += `"${futureCard.card.name}" 카드가 알려주듯, `;
    story += futureCard.isReversed
      ? `아직 배워야 할 교훈이 남아있어요. 실패를 두려워하지 말고, 모든 경험을 성장의 양분으로 삼으세요.\n\n`
      : `어려움 속에서도 빛나는 기회가 숨어있어요. 포기하지 마세요!\n\n`;
  }

  // 2년 후 전망
  story += `📅 ${currentYear + 2}년 (2년 후 전망)\n`;
  if (positivity >= 0.5) {
    story += `지금부터 차곡차곡 쌓아가면, 2년 후에는 눈에 띄는 성과를 거둘 수 있어요. ` +
      `특히 사주의 ${OHAENG_EMOJI[saju.yongsin]}${OHAENG_PLAIN[saju.yongsin]}을 잘 활용하면 ` +
      `더 빠르게 목표에 다가갈 수 있어요!\n\n`;
  } else {
    story += `지금의 시련은 2년 후의 성공을 위한 뿌리가 될 거예요. ` +
      `타로 카드는 "모든 겨울 다음에는 반드시 봄이 온다"고 말하고 있어요. ` +
      `포기하지 말고 꾸준히 나아가세요!\n\n`;
  }

  // 사주↔타로 연결 핵심 메시지
  story += `🔗 사주와 타로의 교차점\n`;
  const futureOh = futureCard.card.element;
  const ilOh = saju.day.cheonganOhaeng;
  // 상생/상극 판정
  const SANGSAENG: Record<string, string> = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const SANGGEUK: Record<string, string> = { '목': '토', '토': '수', '수': '화', '화': '금', '금': '목' };
  const isSangsaeng = SANGSAENG[ilOh] === futureOh || SANGSAENG[futureOh] === ilOh;
  const isSanggeuk = SANGGEUK[ilOh] === futureOh || SANGGEUK[futureOh] === ilOh;

  if (futureOh === saju.yongsin) {
    story += `미래 카드("${futureCard.card.name}")의 ${OHAENG_EMOJI[futureOh]}${OHAENG_PLAIN[futureOh]} 기운이 사주의 용신과 정확히 일치합니다!\n`;
    story += `이것은 타로와 사주가 같은 방향을 가리키는 매우 강력한 신호예요.\n\n`;
    story += `구체적으로 보면:\n`;
    story += `• 당신의 일간(${OHAENG_EMOJI[ilOh]}${OHAENG_PLAIN[ilOh]})에게 ${OHAENG_PLAIN[futureOh]} 에너지는 사주에서 가장 필요한 기운입니다.\n`;
    story += `• "${futureCard.card.name}" 카드가 이 에너지를 가져온다는 것은, 앞으로의 흐름이 당신에게 유리하게 전개될 가능성이 높다는 뜻이에요.\n`;
    story += `• ${futureOh === '목' ? '새로운 시작, 성장, 학습의 기회가 열립니다. 배우고 시작하는 모든 것이 잘 될 시기예요.' : futureOh === '화' ? '열정, 표현, 인정의 에너지가 옵니다. 적극적으로 나서고 주목받을 기회를 잡으세요.' : futureOh === '토' ? '안정, 신뢰, 축적의 에너지가 옵니다. 꾸준히 쌓아온 것이 결실을 맺는 시기예요.' : futureOh === '금' ? '결단, 정리, 효율의 에너지가 옵니다. 불필요한 것을 정리하고 핵심에 집중하면 큰 성과를 거둡니다.' : '지혜, 직관, 유연함의 에너지가 옵니다. 흐름에 맡기되 방향만 잡으면 자연스럽게 좋은 곳에 도달해요.'}\n`;
    story += `• 실전 조언: ${OHAENG_PLAIN[saju.yongsin]} 관련 색상(${futureOh === '목' ? '초록, 파란' : futureOh === '화' ? '빨강, 주황' : futureOh === '토' ? '노랑, 갈색' : futureOh === '금' ? '흰색, 은색' : '검정, 남색'}), 방향(${futureOh === '목' ? '동쪽' : futureOh === '화' ? '남쪽' : futureOh === '토' ? '중앙' : futureOh === '금' ? '서쪽' : '북쪽'}), 활동을 의식적으로 늘리면 이 좋은 에너지를 극대화할 수 있어요.\n\n`;
  } else if (futureOh === saju.gisin) {
    story += `미래 카드("${futureCard.card.name}")의 ${OHAENG_EMOJI[futureOh]}${OHAENG_PLAIN[futureOh]} 기운이 사주의 기신과 겹칩니다.\n`;
    story += `타로와 사주 모두 "이 에너지를 조심하라"고 경고하고 있어요.\n\n`;
    story += `구체적으로 보면:\n`;
    story += `• 당신의 일간(${OHAENG_EMOJI[ilOh]}${OHAENG_PLAIN[ilOh]})에게 ${OHAENG_PLAIN[futureOh]} 에너지는 부담이 되는 기운입니다.\n`;
    story += `• "${futureCard.card.name}" 카드가 이 에너지를 예고하므로, 앞으로 ${saju.gisin === '목' ? '무리한 확장이나 새 사업 시작' : saju.gisin === '화' ? '충동적 결정이나 감정적 행동' : saju.gisin === '토' ? '지나친 안주나 변화 거부' : saju.gisin === '금' ? '과도한 비판이나 완벽주의' : '감정에 휩쓸리거나 우유부단한 태도'}에 특히 주의가 필요합니다.\n`;
    story += `• 하지만 기신 에너지가 나쁘기만 한 건 아닙니다 — 조심하라는 경고를 미리 받은 것이니, 인식하고 대비하면 오히려 위기를 기회로 바꿀 수 있어요.\n`;
    story += `• 실전 조언: ${OHAENG_PLAIN[saju.gisin]} 에너지가 과해지지 않도록 반대 에너지인 ${OHAENG_PLAIN[saju.yongsin]}(용신) 활동을 의식적으로 늘리세요. 예를 들어 ${saju.yongsin === '목' ? '자연 산책, 새로운 배움' : saju.yongsin === '화' ? '운동, 사교 활동' : saju.yongsin === '토' ? '규칙적 루틴, 안정감 확보' : saju.yongsin === '금' ? '정리정돈, 명확한 계획 수립' : '명상, 충분한 수면, 감정 표현'}이 도움이 됩니다.\n\n`;
  } else {
    // 용신/기신이 아닌 경우 — 상생/상극 분석
    story += `미래 카드("${futureCard.card.name}")의 ${OHAENG_EMOJI[futureOh]}${OHAENG_PLAIN[futureOh]} 기운이 당신의 ${OHAENG_EMOJI[ilOh]}${OHAENG_PLAIN[ilOh]} 일간과 만납니다.\n\n`;
    story += `구체적으로 보면:\n`;
    if (futureOh === ilOh) {
      story += `• 카드 에너지와 일간 오행이 같습니다! ${OHAENG_PLAIN[ilOh]} 기운이 더욱 강해지는 시기예요.\n`;
      story += `• 자신의 본질이 강화되므로 자신감은 올라가지만, 한쪽으로 치우칠 수 있으니 균형감을 유지하세요.\n`;
      story += `• ${ilOh === '목' ? '독립성이 강해지지만 고집도 세질 수 있어요. 주변 의견도 들어보세요.' : ilOh === '화' ? '열정이 폭발하지만 과열되기 쉬워요. 쉬어가는 시간을 꼭 만드세요.' : ilOh === '토' ? '안정감이 커지지만 변화를 거부할 수 있어요. 작은 변화도 수용하는 연습을 하세요.' : ilOh === '금' ? '판단력이 날카로워지지만 비판적이 될 수 있어요. 칭찬도 섞어주세요.' : '직관이 강해지지만 감정에 빠지기 쉬워요. 이성적 판단도 함께 하세요.'}\n`;
    } else if (isSangsaeng) {
      const ilGenerates = SANGSAENG[ilOh] === futureOh;
      if (ilGenerates) {
        story += `• 당신의 ${OHAENG_PLAIN[ilOh]}이(가) 카드의 ${OHAENG_PLAIN[futureOh]}를 생(生)합니다 — 당신이 이 에너지를 만들어내는 주체입니다!\n`;
        story += `• 능동적으로 움직이면 좋은 결과가 따라옵니다. 수동적으로 기다리기보다 먼저 행동하세요.\n`;
      } else {
        story += `• 카드의 ${OHAENG_PLAIN[futureOh]}이(가) 당신의 ${OHAENG_PLAIN[ilOh]}을(를) 생(生)합니다 — 외부에서 좋은 에너지가 유입되는 시기입니다!\n`;
        story += `• 새로운 기회, 도움을 주는 사람, 좋은 소식이 찾아올 수 있어요. 마음을 열고 받아들이세요.\n`;
      }
    } else if (isSanggeuk) {
      const ilOvercomes = SANGGEUK[ilOh] === futureOh;
      if (ilOvercomes) {
        story += `• 당신의 ${OHAENG_PLAIN[ilOh]}이(가) 카드의 ${OHAENG_PLAIN[futureOh]}를 극(克)합니다 — 도전을 극복하는 힘이 있다는 뜻이에요.\n`;
        story += `• 어려움이 와도 당신의 기질로 충분히 이겨낼 수 있습니다. 자신감을 가지세요.\n`;
      } else {
        story += `• 카드의 ${OHAENG_PLAIN[futureOh]}이(가) 당신의 ${OHAENG_PLAIN[ilOh]}을(를) 극(克)합니다 — 외부에서 압력이 올 수 있다는 경고입니다.\n`;
        story += `• 하지만 용신(${OHAENG_EMOJI[saju.yongsin]}${OHAENG_PLAIN[saju.yongsin]}) 에너지로 이 극을 완화할 수 있어요. ${saju.yongsin === '목' ? '새로운 배움과 성장으로' : saju.yongsin === '화' ? '열정과 적극성으로' : saju.yongsin === '토' ? '안정감과 인내로' : saju.yongsin === '금' ? '냉철한 판단으로' : '유연함과 지혜로'} 대응하세요.\n`;
      }
    } else {
      story += `• 이 에너지는 당신의 일간과 직접적 상생/상극은 아니지만, 용신(${OHAENG_EMOJI[saju.yongsin]}) 방향으로 활용하면 긍정적 결과를 만들 수 있어요.\n`;
    }
    story += `• 실전 조언: 용신(${OHAENG_EMOJI[saju.yongsin]}${OHAENG_PLAIN[saju.yongsin]}) 에너지를 의식적으로 보강하면서 이 카드의 메시지를 참고하세요.\n\n`;
  }

  // 핵심 키워드 3가지
  story += `🔑 앞으로의 키워드:\n`;
  const keywords = [];
  if (positivity >= 0.6) {
    keywords.push('도전', '성장', '결실');
  } else if (positivity >= 0.4) {
    keywords.push('인내', '준비', '전환');
  } else {
    keywords.push('성찰', '회복', '재시작');
  }
  story += keywords.map(k => `• ${k}`).join('\n') + '\n';

  return story;
}

/**
 * 전체 타로 리딩 수행
 */
export function performReading(saju: SajuResult, spreadType: SpreadType, userQuestion?: string): TarotReading {
  const cards = drawCardsWithSaju(saju, spreadType, userQuestion);

  // 기존 해석 + 현대적 심리 + 미래 스토리 통합
  let overallMessage = generateOverallReading(saju, cards, userQuestion);
  overallMessage += '\n' + generatePsychologyReading(cards, saju);
  overallMessage += '\n' + generateFutureStory(cards, saju);

  const cardElements: Record<Ohaeng, number> = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
  for (const drawn of cards) {
    cardElements[drawn.card.element]++;
  }
  const dominantElement = (Object.entries(cardElements) as [Ohaeng, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    spread: spreadType,
    cards,
    saju,
    overallMessage,
    dominantElement,
  };
}
