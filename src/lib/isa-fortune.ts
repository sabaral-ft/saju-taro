/**
 * 이사운 (이사/이동 운세) 분석 엔진
 * 사주 오행 기반으로 좋은 방향, 나쁜 방향, 이사 시기를 분석합니다.
 */

import type { Ohaeng } from './saju-engine';

// 오행별 방향 매핑 (동양 풍수 기본)
const OHAENG_DIRECTION: Record<Ohaeng, { direction: string; directionEmoji: string; description: string }> = {
  '목': { direction: '동쪽', directionEmoji: '🌅', description: '동쪽 (해 뜨는 방향)' },
  '화': { direction: '남쪽', directionEmoji: '☀️', description: '남쪽 (따뜻한 방향)' },
  '토': { direction: '중앙', directionEmoji: '🏠', description: '중앙 (현재 위치)' },
  '금': { direction: '서쪽', directionEmoji: '🌇', description: '서쪽 (해 지는 방향)' },
  '수': { direction: '북쪽', directionEmoji: '❄️', description: '북쪽 (차가운 방향)' },
};

// 오행 상생 관계 (나를 도와주는 관계)
const SANGSAENG: Record<Ohaeng, Ohaeng> = {
  '목': '수', // 수→목 (물이 나무를 키움)
  '화': '목', // 목→화 (나무가 불을 키움)
  '토': '화', // 화→토 (불이 흙을 만듦)
  '금': '토', // 토→금 (흙이 금속을 만듦)
  '수': '금', // 금→수 (금속이 물을 모음)
};

// 오행 상극 관계 (나를 해치는 관계)
const SANGGEUK: Record<Ohaeng, Ohaeng> = {
  '목': '금', // 금극목 (쇠가 나무를 자름)
  '화': '수', // 수극화 (물이 불을 끔)
  '토': '목', // 목극토 (나무가 흙을 뚫음)
  '금': '화', // 화극금 (불이 쇠를 녹임)
  '수': '토', // 토극수 (흙이 물을 막음)
};

// 지지별 월 매핑 (이사 시기 분석용)
const JIJI_MONTH: Record<string, number[]> = {
  '인': [2], '묘': [3], '진': [4],    // 봄 (목)
  '사': [5], '오': [6], '미': [7],    // 여름 (화)
  '신': [8], '유': [9], '술': [10],   // 가을 (금)
  '해': [11], '자': [12], '축': [1],  // 겨울 (수)
};

// 오행별 계절/월
const OHAENG_SEASON: Record<Ohaeng, { season: string; months: number[]; emoji: string }> = {
  '목': { season: '봄', months: [2, 3, 4], emoji: '🌸' },
  '화': { season: '여름', months: [5, 6, 7], emoji: '🌻' },
  '토': { season: '환절기', months: [1, 4, 7, 10], emoji: '🍂' },
  '금': { season: '가을', months: [8, 9, 10], emoji: '🍁' },
  '수': { season: '겨울', months: [11, 12, 1], emoji: '⛄' },
};

// 삼살방(三殺方) — 매년 바뀌는 흉한 방향
// 세운 지지의 삼합국 충 방향이 삼살방이 됨
// 삼합: 申子辰(수), 寅午戌(화), 巳酉丑(금), 亥卯未(목)
const SAMSAL_MAP: Record<string, { direction: string; emoji: string; jijis: string[] }> = {
  '신': { direction: '남쪽', emoji: '🔥', jijis: ['사', '오', '미'] },
  '자': { direction: '남쪽', emoji: '🔥', jijis: ['사', '오', '미'] },
  '진': { direction: '남쪽', emoji: '🔥', jijis: ['사', '오', '미'] },
  '인': { direction: '북쪽', emoji: '❄️', jijis: ['해', '자', '축'] },
  '오': { direction: '북쪽', emoji: '❄️', jijis: ['해', '자', '축'] },
  '술': { direction: '북쪽', emoji: '❄️', jijis: ['해', '자', '축'] },
  '사': { direction: '동쪽', emoji: '🌅', jijis: ['인', '묘', '진'] },
  '유': { direction: '동쪽', emoji: '🌅', jijis: ['인', '묘', '진'] },
  '축': { direction: '동쪽', emoji: '🌅', jijis: ['인', '묘', '진'] },
  '해': { direction: '서쪽', emoji: '🌇', jijis: ['신', '유', '술'] },
  '묘': { direction: '서쪽', emoji: '🌇', jijis: ['신', '유', '술'] },
  '미': { direction: '서쪽', emoji: '🌇', jijis: ['신', '유', '술'] },
};

// 대장군방(大將軍方) — 3년마다 바뀌는 흉방
// 寅卯辰년(동) → 巳午未년(남) → 申酉戌년(서) → 亥子丑년(북)
const DAEJANGGUN_MAP: Record<string, { direction: string; emoji: string }> = {
  '인': { direction: '동쪽', emoji: '⚔️' },
  '묘': { direction: '동쪽', emoji: '⚔️' },
  '진': { direction: '동쪽', emoji: '⚔️' },
  '사': { direction: '남쪽', emoji: '⚔️' },
  '오': { direction: '남쪽', emoji: '⚔️' },
  '미': { direction: '남쪽', emoji: '⚔️' },
  '신': { direction: '서쪽', emoji: '⚔️' },
  '유': { direction: '서쪽', emoji: '⚔️' },
  '술': { direction: '서쪽', emoji: '⚔️' },
  '해': { direction: '북쪽', emoji: '⚔️' },
  '자': { direction: '북쪽', emoji: '⚔️' },
  '축': { direction: '북쪽', emoji: '⚔️' },
};

// 역마살(驛馬殺) — 이동/변화의 기운
// 사주에 역마살이 있으면 이사·이동에 유리한 체질
const YEOKMA_SAL: Record<string, string> = {
  '자': '인', '축': '해', '인': '신', '묘': '사',
  '진': '인', '사': '해', '오': '신', '미': '사',
  '신': '인', '유': '해', '술': '신', '해': '사',
};

export interface IsaFortuneResult {
  // 좋은 방향
  bestDirection: {
    direction: string;
    emoji: string;
    reason: string;
    detail: string;
  };
  // 두번째 좋은 방향
  secondBestDirection: {
    direction: string;
    emoji: string;
    reason: string;
  };
  // 절대 가면 안 되는 방향
  worstDirection: {
    direction: string;
    emoji: string;
    reason: string;
    detail: string;
  };
  // 주의해야 할 방향
  cautionDirection: {
    direction: string;
    emoji: string;
    reason: string;
  };
  // 이사 최적 시기
  bestTiming: {
    season: string;
    months: number[];
    emoji: string;
    reason: string;
  };
  // 이사 피해야 할 시기
  worstTiming: {
    season: string;
    months: number[];
    emoji: string;
    reason: string;
  };
  // 올해 이사 가능 여부
  thisYearMoving: {
    score: number;    // 1~10
    verdict: string;  // "매우 좋음" | "좋음" | "보통" | "주의" | "위험"
    emoji: string;
    advice: string;
  };
  // 대운 기반 이사 시기 추천
  daeunAdvice: string;
  // 종합 한 줄 요약
  summary: string;
  // 풍수 팁
  fengShuiTips: string[];
  // 삼살방(三殺方) — 올해의 흉한 방향
  samsalDirection?: {
    direction: string;
    emoji: string;
    warning: string;
  };
  // 대장군방(大將軍方) — 3년마다 바뀌는 흉방
  daejanggunDirection?: {
    direction: string;
    emoji: string;
    warning: string;
  };
  // 역마살(驛馬殺) 여부
  hasYeokmaSal?: boolean;
  // 역마살 조언
  yeokmaAdvice?: string;
}

export function analyzeIsaFortune(params: {
  yongsin: Ohaeng;
  gisin: Ohaeng;
  dominantOhaeng: Ohaeng;
  weakestOhaeng: Ohaeng;
  ilgan: string;
  dayJiji: string;
  yearJiji: string;
  monthJiji: string;
  hourJiji: string;
  currentDaeunStage?: string;
  currentDaeunEnergy?: number;
  thisYearJiji?: string;
  ohaengBalance: Record<Ohaeng, number>;
}): IsaFortuneResult {
  const { yongsin, gisin, dominantOhaeng, weakestOhaeng, ilgan, dayJiji,
          yearJiji, monthJiji, hourJiji,
          currentDaeunStage, currentDaeunEnergy = 5, thisYearJiji, ohaengBalance } = params;

  // === 역마살(驛馬殺) 분석 ===
  // 역마살 판별: 일지 기준 역마 위치의 지지가 사주 4주(년/월/일/시) 중 하나에 있어야 함
  const yeokmaTarget = YEOKMA_SAL[dayJiji]; // 일지 기준 역마가 발동하는 지지
  const sajuJijis = [yearJiji, monthJiji, dayJiji, hourJiji];
  const hasYeokmaSal = !!yeokmaTarget && sajuJijis.includes(yeokmaTarget);
  // 올해 세운에서 역마살이 발동하는지도 체크
  const yeokmaActiveThisYear = !!yeokmaTarget && thisYearJiji === yeokmaTarget;

  let yeokmaAdvice = '';
  if (hasYeokmaSal && yeokmaActiveThisYear) {
    yeokmaAdvice = '🐎 당신의 사주에 역마살이 있고, 올해 세운에서도 역마살이 발동합니다! 이동·변화에 매우 유리한 체질인데 올해 그 기운이 극대화되므로, 이사나 이주를 계획 중이라면 지금이 최적의 타이밍이에요!';
  } else if (hasYeokmaSal) {
    yeokmaAdvice = '🐎 당신의 사주에는 역마살이 있어서 이동·변화에 유리한 체질입니다. 이사나 이주를 고려 중이라면 자신의 기질에 맞는 선택이에요. 역마살이 발동하는 해에 이사하면 더 좋은 결과를 얻을 수 있습니다.';
  } else if (yeokmaActiveThisYear) {
    yeokmaAdvice = '🐎 올해 세운에서 역마살이 발동합니다! 사주 원국에는 역마살이 없지만, 올해는 이동·변화의 기운이 강해지는 해입니다. 이사 계획이 있다면 올해가 좋은 시기일 수 있어요.';
  }

  // === 삼살방(三殺方) 분석 — thisYearJiji 기반 ===
  let samsalDirection = undefined;
  if (thisYearJiji) {
    const samsal = SAMSAL_MAP[thisYearJiji];
    if (samsal) {
      samsalDirection = {
        direction: samsal.direction,
        emoji: samsal.emoji,
        warning: `⚠️ 올해(${thisYearJiji}년)의 삼살방은 ${samsal.direction}입니다! 이 방향으로의 이사는 피하세요. 해마다 바뀌는 흉방이므로 내년에는 달라질 수 있습니다.`,
      };
    }
  }

  // === 대장군방(大將軍方) 분석 — thisYearJiji 기반 ===
  let daejanggunDirection = undefined;
  if (thisYearJiji) {
    const daejanggun = DAEJANGGUN_MAP[thisYearJiji];
    if (daejanggun) {
      daejanggunDirection = {
        direction: daejanggun.direction,
        emoji: daejanggun.emoji,
        warning: `⚠️ 올해(${thisYearJiji}년)의 대장군방은 ${daejanggun.direction}입니다! 대장군이 머무르는 곳이라 이 방향으로의 이사·공사는 주의가 필요합니다. 3년마다 바뀌니까 참고하세요.`,
      };
    }
  }

  // === 좋은 방향: 용신 방향 ===
  const bestDir = OHAENG_DIRECTION[yongsin];
  const bestSangsaeng = SANGSAENG[yongsin]; // 용신을 생해주는 오행
  let secondBestOhaeng = bestSangsaeng;

  // === 나쁜 방향: 기신 방향 ===
  const worstDir = OHAENG_DIRECTION[gisin];
  const gisinHelper = SANGSAENG[gisin]; // 기신을 강하게 만드는 오행
  let cautionOhaeng = gisinHelper;

  // 방향 충돌 방어: secondBest와 worst가 같은 방향이면 대안 선택
  // (용신을 생하는 오행 === 기신인 경우, 예: 용신=화, 기신=목)
  if (OHAENG_DIRECTION[secondBestOhaeng].direction === worstDir.direction) {
    // 용신이 생하는 오행(설기)으로 대체: 목→화→토→금→수
    const SANGSAENG_TARGET: Record<Ohaeng, Ohaeng> = {
      '목': '화', '화': '토', '토': '금', '금': '수', '수': '목',
    };
    secondBestOhaeng = SANGSAENG_TARGET[yongsin];
  }

  // 방향 충돌 방어: best와 caution이 같은 방향이면 대안 선택
  // (기신을 생하는 오행 === 용신인 경우, 예: 용신=목, 기신=화)
  if (OHAENG_DIRECTION[cautionOhaeng].direction === bestDir.direction) {
    // 기신이 생하는 오행(설기)으로 대체
    const SANGGEUK_SOURCE: Record<Ohaeng, Ohaeng> = {
      '목': '금', '화': '수', '토': '목', '금': '화', '수': '토',
    };
    cautionOhaeng = SANGGEUK_SOURCE[gisin]; // 기신을 극하는 오행 대신, 상극원으로
  }

  const secondDir = OHAENG_DIRECTION[secondBestOhaeng];
  const cautionDir = OHAENG_DIRECTION[cautionOhaeng];

  // 일간별 특성
  const ILGAN_OHAENG: Record<string, Ohaeng> = {
    '갑': '목', '을': '목', '병': '화', '정': '화', '무': '토',
    '기': '토', '경': '금', '신': '금', '임': '수', '계': '수',
  };
  const myOhaeng = ILGAN_OHAENG[ilgan] || '토';

  // === 이사 최적 시기: 용신 계절 ===
  const bestSeason = OHAENG_SEASON[yongsin];
  const worstSeason = OHAENG_SEASON[gisin];

  // === 올해 이사 가능 여부 (대운 에너지 + 풍수 요소 기반) ===
  let moveScore = currentDaeunEnergy;

  // 역마살이 있고 올해 발동하면 크게 상향, 사주에만 있으면 소폭 상향
  if (hasYeokmaSal && yeokmaActiveThisYear) {
    moveScore = Math.min(10, moveScore + 2);
  } else if (hasYeokmaSal || yeokmaActiveThisYear) {
    moveScore = Math.min(10, moveScore + 1);
  }

  // 삼살방이 없으면 점수 유지, 있으면 약간 감소 (심각한 영향은 아니고 주의 수준)
  if (samsalDirection) {
    moveScore = Math.max(1, moveScore - 1);
  }

  // 오행 균형 분석: 극심한 불균형이면 이사로 환경 변화가 도움될 수 있음
  const balanceValues = Object.values(ohaengBalance);
  const maxBalance = Math.max(...balanceValues);
  const minBalance = Math.min(...balanceValues);
  const balanceGap = maxBalance - minBalance;
  if (balanceGap >= 4) {
    // 오행 불균형이 심하면 환경 변화(이사)가 기운 보충에 도움
    moveScore = Math.min(10, moveScore + 1);
  }

  let moveVerdict = '';
  let moveEmoji = '';
  let moveAdvice = '';

  // 대운 에너지가 높으면 이사 좋음
  if (moveScore >= 8) {
    moveVerdict = '매우 좋음';
    moveEmoji = '🟢';
    moveAdvice = `지금이 이사하기 아주 좋은 시기입니다! 대운의 기운이 강해서 새로운 환경에 빠르게 적응하고, 이사 후 운이 더 좋아질 수 있어요. ${bestDir.directionEmoji} ${bestDir.direction} 방향으로 이사하면 최고!`;
  } else if (moveScore >= 6) {
    moveVerdict = '좋음';
    moveEmoji = '🔵';
    moveAdvice = `이사해도 괜찮은 시기예요. 다만 서두르지 말고 충분히 준비한 뒤 움직이세요. ${bestDir.directionEmoji} ${bestDir.direction} 방향이면 더 좋습니다.`;
  } else if (moveScore >= 4) {
    moveVerdict = '보통';
    moveEmoji = '🟡';
    moveAdvice = `이사를 꼭 해야 한다면 할 수 있지만, 최적의 시기는 아닙니다. 가능하면 ${bestSeason.emoji} ${bestSeason.season}(${bestSeason.months.map(m => m + '월').join(', ')})까지 기다리는 게 좋아요.`;
  } else if (moveScore >= 2) {
    moveVerdict = '주의';
    moveEmoji = '🟠';
    moveAdvice = `지금은 이사를 자제하는 게 좋습니다. 대운 에너지가 낮아 새 환경에 적응하기 힘들 수 있어요. 꼭 이사해야 하면 ${bestDir.directionEmoji} ${bestDir.direction} 방향만 고려하고, ${worstDir.direction}은 절대 피하세요!`;
  } else {
    moveVerdict = '위험';
    moveEmoji = '🔴';
    moveAdvice = `이사를 미루세요! 현재 대운이 매우 약한 시기라 이사 후 적응이 어렵고, 예상치 못한 문제가 생길 수 있습니다. 최소 1~2년 뒤로 미루는 것을 강력히 추천합니다.`;
  }

  // === 대운 기반 상세 조언 ===
  let daeunAdvice = '';
  if (currentDaeunStage) {
    const stageAdvice: Record<string, string> = {
      '장생': '장생운(새로 태어나는 기운)이라 새 출발에 좋습니다! 이사하면 새로운 시작의 행운이 함께해요.',
      '목욕': '목욕운(정리하는 시기)이라 이사 전 짐 정리를 확실히 하세요. 버릴 건 과감히 버리면 운이 트입니다.',
      '관대': '관대운(성장하는 기운)이라 더 넓은 곳으로 이사하면 좋습니다. 공간이 넓어지면 운도 커져요!',
      '건록': '건록운(안정·재물의 기운)이라 이사하면 재물운이 따라올 수 있습니다. 특히 직장 근처로 이사하면 좋아요.',
      '제왕': '제왕운(최고조 기운)이라 지금 이사하면 최고의 결과를 얻을 수 있어요! 과감하게 움직이세요.',
      '쇠': '쇠운(기운이 줄어드는 시기)이라 이사보다는 현재 위치에서 안정을 찾는 게 좋습니다.',
      '병': '병운(기운이 약해지는 시기)이라 큰 이사보다 작은 이사(같은 동네 내)가 낫습니다.',
      '사': '사운(정리의 시기)이라 이사하면 과거를 정리하고 새로 시작할 수 있어요. 단, 무리하지 마세요.',
      '묘': '묘운(저장의 시기)이라 이사보다 돈을 모으는 시기입니다. 이사 자금을 충분히 확보한 뒤 움직이세요.',
      '절': '절운(끊어지는 기운)이라 이사하면 인간관계가 바뀔 수 있습니다. 새로운 인연을 만들 준비를 하세요.',
      '태': '태운(잉태의 기운)이라 새 집에서 새로운 계획을 세우기 좋습니다. 작은 공간부터 시작하세요.',
      '양': '양운(키워가는 기운)이라 서두르지 말고 차근차근 이사 계획을 세우세요. 급하게 움직이면 손해봐요.',
    };
    daeunAdvice = stageAdvice[currentDaeunStage] || `현재 ${currentDaeunStage}운입니다. 용신 방향(${bestDir.direction})으로 이사하면 기운을 보충할 수 있어요.`;
  } else {
    daeunAdvice = `용신(${yongsin}) 방향인 ${bestDir.direction}으로 이사하면 부족한 기운을 채울 수 있습니다.`;
  }

  // === 풍수 팁 ===
  const fengShuiTips: string[] = [];

  // 부족한 오행에 따른 인테리어 팁
  const OHAENG_INTERIOR: Record<Ohaeng, string> = {
    '목': '🌿 나무 기운이 부족해요! 새 집에 화분, 나무 가구를 배치하면 운이 올라갑니다. 녹색 커튼이나 소품도 좋아요.',
    '화': '🕯️ 불 기운이 부족해요! 새 집은 남향(햇빛 잘 드는 집)이 좋고, 붉은색이나 주황색 소품을 놓으세요. 조명을 밝게!',
    '토': '🏺 흙 기운이 부족해요! 도자기, 돌, 크리스탈 소품을 새 집에 배치하세요. 베이지·갈색 톤 인테리어가 좋아요.',
    '금': '🔔 쇠 기운이 부족해요! 금속 소품(시계, 풍경종)을 걸고, 흰색·은색 톤으로 인테리어하면 운이 올라요.',
    '수': '🐟 물 기운이 부족해요! 어항이나 분수를 놓으면 재물운이 올라갑니다. 검은색·파란색 소품도 좋아요.',
  };
  fengShuiTips.push(OHAENG_INTERIOR[weakestOhaeng]);

  // 과다한 오행 경고
  const OHAENG_EXCESS_TIP: Record<Ohaeng, string> = {
    '목': '⚠️ 나무 기운이 과해요. 나무 가구를 너무 많이 놓지 마세요. 금속 소품으로 균형을 잡으세요.',
    '화': '⚠️ 불 기운이 과해요. 너무 밝은 조명이나 붉은색 인테리어는 피하세요. 물 관련 소품(어항 등)으로 균형을.',
    '토': '⚠️ 흙 기운이 과해요. 돌이나 도자기를 과하게 놓지 마세요. 나무 소품이나 화분으로 균형을 잡으세요.',
    '금': '⚠️ 쇠 기운이 과해요. 금속 가구를 줄이고 나무·천 소재를 활용하세요. 따뜻한 조명이 좋아요.',
    '수': '⚠️ 물 기운이 과해요. 어항이나 물 관련 인테리어는 자제하세요. 흙(도자기)이나 나무 소품으로 균형을.',
  };
  fengShuiTips.push(OHAENG_EXCESS_TIP[dominantOhaeng]);

  // 현관 방향 팁
  fengShuiTips.push(`🚪 새 집의 현관이 ${bestDir.direction}을 향하면 최고! ${worstDir.direction}을 향하면 거울이나 소금으로 나쁜 기운을 막으세요.`);

  // 침실 위치 팁
  fengShuiTips.push(`🛏️ 침대 머리를 ${bestDir.direction}으로 향하게 놓으면 수면의 질이 좋아지고 건강운이 올라갑니다.`);

  // 삼살방 경고 팁
  if (samsalDirection) {
    fengShuiTips.push(`${samsalDirection.emoji} ${samsalDirection.warning}`);
  }

  // 대장군방 경고 팁
  if (daejanggunDirection) {
    fengShuiTips.push(`${daejanggunDirection.emoji} ${daejanggunDirection.warning}`);
  }

  // === 종합 요약 ===
  let summaryAddition = '';
  if (samsalDirection || daejanggunDirection) {
    summaryAddition = ` ⚠️ 삼살방/대장군방 주의!`;
  }
  const summary = moveScore >= 6
    ? `${moveEmoji} 이사 OK! ${bestDir.directionEmoji} ${bestDir.direction}으로 가면 운이 좋아지고, ${worstDir.direction}은 절대 피하세요! 최적 시기는 ${bestSeason.months.map(m => m + '월').join('/')}.${summaryAddition}`
    : `${moveEmoji} 이사는 조금 기다리세요. 꼭 해야 한다면 ${bestDir.directionEmoji} ${bestDir.direction} 방향만! ${worstDir.direction}은 큰 손해를 볼 수 있어요.${summaryAddition}`;

  return {
    bestDirection: {
      direction: bestDir.direction,
      emoji: bestDir.directionEmoji,
      reason: `용신(${yongsin}) 방향이라 나에게 가장 좋은 기운을 주는 곳이에요!`,
      detail: `${yongsin}(${bestDir.description}) 방향으로 이사하면 부족한 기운이 채워지고, 건강·재물·인간관계 모든 면에서 도움을 받을 수 있습니다. 이 방향의 도시나 동네를 우선적으로 알아보세요!`,
    },
    secondBestDirection: {
      direction: secondDir.direction,
      emoji: secondDir.directionEmoji,
      reason: `${secondBestOhaeng}(${secondDir.description}) 방향도 좋아요! 용신의 기운을 보강해주는 방향이에요.`,
    },
    worstDirection: {
      direction: worstDir.direction,
      emoji: worstDir.directionEmoji,
      reason: `기신(${gisin}) 방향이라 나에게 해로운 기운이 강한 곳이에요!`,
      detail: `${gisin}(${worstDir.description}) 방향으로 이사하면 나쁜 기운이 강해져서 건강 문제, 금전 손실, 인간관계 갈등이 생길 수 있습니다. 이 방향은 반드시 피하세요! 직장이 이 방향이라도 거주지만큼은 다른 방향으로 선택하는 게 좋습니다.`,
    },
    cautionDirection: {
      direction: cautionDir.direction,
      emoji: cautionDir.directionEmoji,
      reason: `${cautionOhaeng}(${cautionDir.description}) 방향도 주의! 기신의 기운을 강화시킬 수 있는 방향이에요.`,
    },
    bestTiming: {
      season: bestSeason.season,
      months: bestSeason.months,
      emoji: bestSeason.emoji,
      reason: `${yongsin} 기운이 강한 ${bestSeason.season}(${bestSeason.months.map(m => m + '월').join(', ')})에 이사하면 좋은 기운을 받으며 새 출발을 할 수 있어요!`,
    },
    worstTiming: {
      season: worstSeason.season,
      months: worstSeason.months,
      emoji: worstSeason.emoji,
      reason: `${gisin} 기운이 강한 ${worstSeason.season}(${worstSeason.months.map(m => m + '월').join(', ')})에 이사하면 나쁜 기운의 영향을 받기 쉬워요. 이 시기는 피하세요!`,
    },
    thisYearMoving: {
      score: moveScore,
      verdict: moveVerdict,
      emoji: moveEmoji,
      advice: moveAdvice,
    },
    daeunAdvice,
    summary,
    fengShuiTips,
    samsalDirection,
    daejanggunDirection,
    hasYeokmaSal: hasYeokmaSal || yeokmaActiveThisYear,
    yeokmaAdvice: (hasYeokmaSal || yeokmaActiveThisYear) ? yeokmaAdvice : undefined,
  };
}
