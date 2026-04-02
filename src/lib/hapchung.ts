/**
 * 합충회합(合沖會合) 분석 엔진
 * 사주 원국 + 대운/세운 간의 합·충·삼합·반합 탐지 + 초등학생도 알아듣는 심리 해석
 */

import { CHEONGAN, JIJI, CHEONGAN_OHAENG, JIJI_OHAENG, calculateSipseong } from './saju-engine';
import type { Ohaeng, Sipseong } from './saju-engine';

// ========== 천간합 (天干合) ==========
// 두 천간이 만나면 마치 친한 친구처럼 손을 잡고, 새로운 오행 기운으로 변한다

const CHEONGAN_HAP_MAP: Record<string, { partner: string; result: Ohaeng; name: string }> = {
  '갑': { partner: '기', result: '토', name: '갑기합(토)' },
  '기': { partner: '갑', result: '토', name: '갑기합(토)' },
  '을': { partner: '경', result: '금', name: '을경합(금)' },
  '경': { partner: '을', result: '금', name: '을경합(금)' },
  '병': { partner: '신', result: '수', name: '병신합(수)' },
  '신': { partner: '병', result: '수', name: '병신합(수)' },
  '정': { partner: '임', result: '목', name: '정임합(목)' },
  '임': { partner: '정', result: '목', name: '정임합(목)' },
  '무': { partner: '계', result: '화', name: '무계합(화)' },
  '계': { partner: '무', result: '화', name: '무계합(화)' },
};

// ========== 지지충 (地支沖) ==========
// 정반대에 있는 두 글자가 부딪히면, 마치 시소의 양쪽 끝이 팽팽한 것처럼 긴장과 변화가 생긴다

const JIJI_CHUNG_MAP: Record<string, string> = {
  '자': '오', '오': '자',
  '축': '미', '미': '축',
  '인': '신', '신': '인',
  '묘': '유', '유': '묘',
  '진': '술', '술': '진',
  '사': '해', '해': '사',
};

// 충 이름
const CHUNG_NAMES: Record<string, string> = {
  '자오': '자오충', '오자': '자오충',
  '축미': '축미충', '미축': '축미충',
  '인신': '인신충', '신인': '인신충',
  '묘유': '묘유충', '유묘': '묘유충',
  '진술': '진술충', '술진': '진술충',
  '사해': '사해충', '해사': '사해충',
};

// ========== 삼합 (三合) ==========
// 세 글자가 모이면 매우 강력한 팀이 된다 (마치 어벤져스처럼!)

interface SamhapGroup {
  members: string[];
  result: Ohaeng;
  name: string;
}

const SAMHAP_GROUPS: SamhapGroup[] = [
  { members: ['해', '묘', '미'], result: '목', name: '해묘미 목국(나무팀)' },
  { members: ['인', '오', '술'], result: '화', name: '인오술 화국(불팀)' },
  { members: ['사', '유', '축'], result: '금', name: '사유축 금국(쇠팀)' },
  { members: ['신', '자', '진'], result: '수', name: '신자진 수국(물팀)' },
];

// ========== 반합 (半合) ==========
// 삼합의 3명 중 2명만 모인 것 — 아직 완전하진 않지만 힘이 모이는 중

interface BanhapPair {
  pair: [string, string];
  result: Ohaeng;
  name: string;
  missing: string;
}

const BANHAP_PAIRS: BanhapPair[] = [
  { pair: ['해', '묘'], result: '목', name: '해묘 반합(나무)', missing: '미' },
  { pair: ['묘', '미'], result: '목', name: '묘미 반합(나무)', missing: '해' },
  { pair: ['인', '오'], result: '화', name: '인오 반합(불)', missing: '술' },
  { pair: ['오', '술'], result: '화', name: '오술 반합(불)', missing: '인' },
  { pair: ['사', '유'], result: '금', name: '사유 반합(쇠)', missing: '축' },
  { pair: ['유', '축'], result: '금', name: '유축 반합(쇠)', missing: '사' },
  { pair: ['신', '자'], result: '수', name: '신자 반합(물)', missing: '진' },
  { pair: ['자', '진'], result: '수', name: '자진 반합(물)', missing: '신' },
];

// ========== 육합 (六合) ==========
// 음양의 두 기운이 1대1로 만나 긴밀하게 결속 — 남녀·개인 간 직접적 합의

interface YukhapPair {
  pair: [string, string];
  result: Ohaeng;
  name: string;
}

const YUKHAP_PAIRS: YukhapPair[] = [
  { pair: ['자', '축'], result: '토', name: '자축합(토)' },
  { pair: ['인', '해'], result: '목', name: '인해합(목)' },
  { pair: ['묘', '술'], result: '화', name: '묘술합(화)' },
  { pair: ['진', '유'], result: '금', name: '진유합(금)' },
  { pair: ['사', '신'], result: '수', name: '사신합(수)' },
  { pair: ['오', '미'], result: '토', name: '오미합(토)' },
];

// ========== 합충 동시 발생 상호작용 ==========

/** 탐합망충(貪合忘沖): 합을 탐하느라 충의 파괴력이 약화되는 현상 */
/** 충발(沖發): 강력한 충이 기존의 합을 깨뜨려 묶인 기운이 폭발하는 현상 */

const HAPCHUNG_SIMULTANEOUS_EXPLANATION =
  '합과 충이 동시에 작용하면, 상반된 기운이 서로 견제하며 매우 변화무쌍한 상황이 생겨요.\n' +
  '① 탐합망충(貪合忘沖): 합의 결속력이 충의 충격을 흡수해서, 충돌이 있어도 타협으로 무마될 수 있어요.\n' +
  '② 충발(沖發): 반대로, 이미 합으로 묶여 안정된 기운에 강한 충이 가해지면 갑자기 묶인 것이 풀리며 큰 변화가 폭발해요.\n' +
  '결국 갈등 속에서 타협점을 찾거나, 안정된 일이 돌발 변수로 뒤집히는 굴곡진 흐름이에요.';

/** 합충 불안정 시기 대처법 */
const HAPCHUNG_COPING_ADVICE = [
  '🏥 몸의 신호 주시: 운이 요동칠 때는 소화불량·변비 등 몸이 먼저 알려줘요. 건강 체크 우선!',
  '🧠 멘탈 관리: 혼란스러울수록 감정에 휩쓸리지 말고, 롱런을 위한 마음 관리에 집중하세요.',
  '🎯 주체적 개입: 운명에 끌려가지 말고, 변화를 직접 통제하고 방향을 정하려는 의지가 중요해요.',
  '🤝 좋은 인연 쌓기: 같은 사주라도 주변에 베풀면, 위기 때 귀인이 나타나요. 인복은 후천적!',
  '🎨 부족한 오행 보충: 필요한 기운에 맞는 색상의 옷이나, 맛(신맛·단맛·쓴맛·매운맛)의 음식으로 균형을 맞춰보세요.',
];

// ========== 궁위 (宮位) 이름 ==========
const GUNGWI_NAMES = ['년주', '월주', '일주', '시주'] as const;
type Gungwi = typeof GUNGWI_NAMES[number];

const GUNGWI_MEANING: Record<Gungwi, string> = {
  '년주': '할아버지·할머니, 어린 시절, 먼 곳(해외)',
  '월주': '부모님, 직장·학교, 사회생활',
  '일주': '나 자신, 배우자, 집·이사',
  '시주': '자녀, 미래, 노후',
};

// ========== 분석 결과 타입 ==========

export interface HapResult {
  type: '천간합';
  name: string;
  resultOhaeng: Ohaeng;
  position1: Gungwi | '대운' | '세운';
  position2: Gungwi | '대운' | '세운';
  gan1: string;
  gan2: string;
  easyExplanation: string;
  psychologyDetail: string;
}

export interface ChungResult {
  type: '지지충';
  name: string;
  position1: Gungwi | '대운' | '세운';
  position2: Gungwi | '대운' | '세운';
  ji1: string;
  ji2: string;
  easyExplanation: string;
  psychologyDetail: string;
}

export interface SamhapResult {
  type: '삼합' | '반합';
  name: string;
  resultOhaeng: Ohaeng;
  members: string[];
  positions: string[];
  easyExplanation: string;
}

export interface YukhapResult {
  type: '육합';
  name: string;
  resultOhaeng: Ohaeng;
  position1: Gungwi | '대운' | '세운';
  position2: Gungwi | '대운' | '세운';
  ji1: string;
  ji2: string;
  easyExplanation: string;
  psychologyDetail: string;
}

export type HapChungItem = HapResult | ChungResult | SamhapResult | YukhapResult;

// ========== 천간합 쉬운 설명 ==========

function getHapEasyExplanation(pos1: string, pos2: string, name: string, resultOhaeng: Ohaeng): string {
  const ohaengEmoji: Record<Ohaeng, string> = { '목': '🌳', '화': '🔥', '토': '🏔️', '금': '⚔️', '수': '💧' };
  const ohaengSimple: Record<Ohaeng, string> = {
    '목': '나무(새로운 시작, 성장)',
    '화': '불(열정, 인기)',
    '토': '흙(안정, 믿음)',
    '금': '쇠(결단, 실력)',
    '수': '물(지혜, 유연함)',
  };

  return `${pos1}와 ${pos2}가 손을 꼭 잡았어요! (${name}) ${ohaengEmoji[resultOhaeng]}\n` +
    `두 글자가 합쳐져서 ${ohaengSimple[resultOhaeng]}의 기운이 생겨요.\n` +
    `쉽게 말하면, 이 두 자리가 서로 협력하면서 새로운 힘을 만들어내는 거예요!`;
}

function getHapPsychology(pos1: string, pos2: string, isYongsinHap: boolean): string {
  if (isYongsinHap) {
    return `⚠️ 조심해야 할 합이에요! 나를 돕는 소중한 기운(용신)이 합으로 꽁꽁 묶여버렸어요. ` +
      `마치 제일 잘하는 친구가 다른 애랑 놀러 가서 나를 못 도와주는 것과 같아요. ` +
      `이 시기에는 중요한 결정을 서두르지 말고 신중하게!`;
  }

  const posExplanations: Record<string, string> = {
    '년주': '어린 시절이나 먼 곳(해외)과 관련된 좋은 인연이 생기거나, 조상의 덕을 볼 수 있어요.',
    '월주': '직장이나 학교에서 좋은 팀워크가 만들어져요. 부모님과도 화합이 잘 돼요.',
    '일주': '나 자신이 변화하거나, 배우자와의 관계가 깊어져요. 이사나 새 출발의 기운이 있어요.',
    '시주': '자녀에게 좋은 일이 생기거나, 미래 계획이 순조롭게 풀려요.',
    '대운': '10년 동안 서서히 좋은 변화가 찾아와요. 인생의 큰 전환점!',
    '세운': '올해 특별한 만남이나 협력의 기회가 찾아와요.',
  };

  const parts: string[] = [];
  if (posExplanations[pos1]) parts.push(posExplanations[pos1]);
  if (posExplanations[pos2] && pos2 !== pos1) parts.push(posExplanations[pos2]);

  return `합(合)은 '화합하고 협력하는 힘'이에요. 😊\n` +
    `두 기운이 서로 끌려서 하나로 뭉치는 거예요. ` +
    `계획한 일을 실행에 옮기거나, 좋은 인연을 만나기 좋은 때예요.\n` +
    (parts.length > 0 ? parts.join(' ') : '');
}

// ========== 지지충 쉬운 설명 ==========

function getChungEasyExplanation(pos1: string, pos2: string, name: string): string {
  return `${pos1}와 ${pos2}가 부딪혔어요! (${name}) 💥\n` +
    `서로 정반대인 두 기운이 만나서 팽팽하게 대립하는 거예요.\n` +
    `쉽게 말하면, 갑자기 변화가 생기거나 바빠지는 시기예요!`;
}

function getChungPsychology(pos1: string, pos2: string): string {
  const chungEffects: Record<string, string> = {
    '년주': '🌏 멀리 떠나거나(해외여행, 유학, 이민), 할아버지·할머니와 관련된 변화가 생겨요.',
    '월주': '💼 직장을 옮기거나, 부모님과 의견이 달라질 수 있어요. 학교나 직장에서 새로운 변화가!',
    '일주': '🏠 이사를 가거나, 배우자(짝꿍)와의 관계에 변화가 생겨요. 내 마음도 많이 바뀌는 시기!',
    '시주': '👶 자녀 문제나 미래 계획에 변동이 생겨요. 하던 일의 방향이 바뀔 수 있어요.',
    '대운': '🔄 10년 주기의 큰 변화! 인생의 방향이 확 바뀌는 전환점이에요.',
    '세운': '⚡ 올해 갑작스러운 변화가 찾아와요. 바쁘고 역동적인 한 해!',
  };

  const parts: string[] = [];
  if (chungEffects[pos1]) parts.push(chungEffects[pos1]);
  if (chungEffects[pos2] && pos2 !== pos1) parts.push(chungEffects[pos2]);

  return `충(沖)은 '갑작스러운 변화와 움직임'이에요. ⚡\n` +
    `나쁜 게 아니라, 가만히 있던 것들이 움직이기 시작하는 거예요! ` +
    `부지런해지고, 새로운 도전을 하게 되는 시기예요.\n` +
    `다만 마음이 예민해질 수 있으니, 화를 참고 차분하게 대처하는 게 중요해요.\n\n` +
    (parts.length > 0 ? parts.join('\n') : '');
}

// ========== 육합 쉬운 설명 ==========

function getYukhapExplanation(pos1: string, pos2: string, name: string, resultOhaeng: Ohaeng): string {
  const ohaengSimple: Record<Ohaeng, string> = {
    '목': '나무(성장, 새 시작)', '화': '불(열정, 인기)',
    '토': '흙(안정, 신뢰)', '금': '쇠(결단, 집중)', '수': '물(지혜, 소통)',
  };
  return `${pos1}와 ${pos2}가 1대1로 꼭 맞았어요! (${name}) 💕\n` +
    `음양의 두 기운이 딱 짝이 맞아 ${ohaengSimple[resultOhaeng]}의 기운을 만들어요.\n` +
    `삼합이 여러 명이 뭉치는 팀이라면, 육합은 단짝친구처럼 둘만의 특별한 결속이에요!`;
}

function getYukhapPsychology(pos1: string, pos2: string): string {
  const effects: Record<string, string> = {
    '년주': '어린 시절이나 먼 곳에서 단짝 같은 인연이 찾아와요.',
    '월주': '직장이나 사회생활에서 나와 딱 맞는 파트너를 만나요.',
    '일주': '배우자나 가장 가까운 사람과의 유대가 깊어져요.',
    '시주': '자녀와의 관계가 깊어지거나, 미래에 믿을 수 있는 인연이 생겨요.',
    '대운': '10년간 나와 꼭 맞는 인연이나 환경을 만나는 시기예요.',
    '세운': '올해 1대1로 깊은 인연이 찾아올 수 있어요.',
  };
  const parts: string[] = [];
  if (effects[pos1]) parts.push(effects[pos1]);
  if (effects[pos2] && pos2 !== pos1) parts.push(effects[pos2]);
  return `육합(六合)은 '1대1의 특별한 결속'이에요. 💕\n` +
    `삼합이 넓은 범위의 타협이라면, 육합은 나와 딱 맞는 사람과의 긴밀한 관계를 뜻해요.\n` +
    (parts.length > 0 ? parts.join(' ') : '');
}

// ========== 삼합/반합 쉬운 설명 ==========

function getSamhapExplanation(name: string, resultOhaeng: Ohaeng, positions: string[], isFull: boolean): string {
  const teamNames: Record<Ohaeng, string> = {
    '목': '🌳 나무팀 — 새로 시작하고 쑥쑥 성장하는 힘!',
    '화': '🔥 불팀 — 열정적이고 인기 폭발하는 힘!',
    '금': '⚔️ 쇠팀 — 단단하고 결단력 있는 힘!',
    '수': '💧 물팀 — 지혜롭고 무엇이든 돌파하는 힘!',
    '토': '🏔️ 흙팀 — 안정적이고 든든한 힘!',
  };

  if (isFull) {
    return `와! ${positions.join(', ')}에서 삼합이 완성됐어요! (${name}) 🎉\n` +
      `세 글자가 완벽한 팀을 이뤄서 엄청 강한 힘이 생겨요!\n` +
      `${teamNames[resultOhaeng]}\n` +
      `이건 마치 3명이 합체해서 로봇을 만든 것처럼 파워풀한 거예요!`;
  } else {
    return `${positions.join(', ')}에서 반합이 생겼어요! (${name}) ✨\n` +
      `아직 3명 중 2명만 모였지만, 벌써 힘이 모이기 시작했어요!\n` +
      `${teamNames[resultOhaeng]}\n` +
      `나머지 한 명이 올 때(운에서 만날 때) 완전체가 돼요!`;
  }
}

// ========== 메인 분석 함수 ==========

export interface HapChungAnalysis {
  items: HapChungItem[];
  summary: string;
  hapCount: number;
  chungCount: number;
  samhapCount: number;
  yukhapCount: number;
  overallMood: '평온' | '화합' | '변동' | '격변';
  /** 합충 동시 발생 시 상호작용 설명 (탐합망충/충발) */
  simultaneousExplanation?: string;
  /** 합충 불안정 시기 대처법 (격변일 때만 포함) */
  copingAdvice?: string[];
}

/**
 * 사주 원국 내부 + 대운/세운과의 합충회합 종합 분석
 * @param pillars 사주 4주 [연주, 월주, 일주, 시주] — 각각 { cheongan, jiji }
 * @param daeunPillar 현재 대운 { cheongan, jiji } (옵션)
 * @param seunPillar 현재 세운 { cheongan, jiji } (옵션)
 * @param ilgan 일간 (용신 판단용)
 */
export function analyzeHapChung(
  pillars: { cheongan: string; jiji: string }[],
  daeunPillar?: { cheongan: string; jiji: string },
  seunPillar?: { cheongan: string; jiji: string },
  ilgan?: string,
): HapChungAnalysis {
  const items: HapChungItem[] = [];

  // 모든 천간/지지 수집 (위치 라벨 포함)
  const allGan: { gan: string; pos: string }[] = pillars.map((p, i) => ({ gan: p.cheongan, pos: GUNGWI_NAMES[i] }));
  const allJi: { ji: string; pos: string }[] = pillars.map((p, i) => ({ ji: p.jiji, pos: GUNGWI_NAMES[i] }));

  if (daeunPillar) {
    allGan.push({ gan: daeunPillar.cheongan, pos: '대운' });
    allJi.push({ ji: daeunPillar.jiji, pos: '대운' });
  }
  if (seunPillar) {
    allGan.push({ gan: seunPillar.cheongan, pos: '세운' });
    allJi.push({ ji: seunPillar.jiji, pos: '세운' });
  }

  // 1) 천간합 탐지
  for (let i = 0; i < allGan.length; i++) {
    for (let j = i + 1; j < allGan.length; j++) {
      const a = allGan[i];
      const b = allGan[j];
      const hapInfo = CHEONGAN_HAP_MAP[a.gan];
      if (hapInfo && hapInfo.partner === b.gan) {
        // 용신 합거 여부 (간단 판단: 일간 기준 정인/편인이 합으로 묶이면 위험)
        const isYongsinHap = false; // TODO: 용신 정밀 판단 추가 가능
        items.push({
          type: '천간합',
          name: hapInfo.name,
          resultOhaeng: hapInfo.result,
          position1: a.pos as any,
          position2: b.pos as any,
          gan1: a.gan,
          gan2: b.gan,
          easyExplanation: getHapEasyExplanation(a.pos, b.pos, hapInfo.name, hapInfo.result),
          psychologyDetail: getHapPsychology(a.pos, b.pos, isYongsinHap),
        });
      }
    }
  }

  // 2) 지지충 탐지
  for (let i = 0; i < allJi.length; i++) {
    for (let j = i + 1; j < allJi.length; j++) {
      const a = allJi[i];
      const b = allJi[j];
      if (JIJI_CHUNG_MAP[a.ji] === b.ji) {
        const chungName = CHUNG_NAMES[a.ji + b.ji] || `${a.ji}${b.ji}충`;
        items.push({
          type: '지지충',
          name: chungName,
          position1: a.pos as any,
          position2: b.pos as any,
          ji1: a.ji,
          ji2: b.ji,
          easyExplanation: getChungEasyExplanation(a.pos, b.pos, chungName),
          psychologyDetail: getChungPsychology(a.pos, b.pos),
        });
      }
    }
  }

  // 3) 삼합 탐지
  const jiList = allJi.map(j => j.ji);
  const jiPosMap: Record<string, string[]> = {};
  for (const j of allJi) {
    if (!jiPosMap[j.ji]) jiPosMap[j.ji] = [];
    jiPosMap[j.ji].push(j.pos);
  }

  for (const group of SAMHAP_GROUPS) {
    const found = group.members.filter(m => jiList.includes(m));
    if (found.length === 3) {
      const positions = found.flatMap(m => jiPosMap[m] || []);
      items.push({
        type: '삼합',
        name: group.name,
        resultOhaeng: group.result,
        members: found,
        positions,
        easyExplanation: getSamhapExplanation(group.name, group.result, positions, true),
      });
    }
  }

  // 4) 반합 탐지 (삼합이 아닌 경우만)
  const fullSamhaps = items.filter(i => i.type === '삼합').map(i => (i as SamhapResult).name);
  for (const bh of BANHAP_PAIRS) {
    const [a, b] = bh.pair;
    if (jiList.includes(a) && jiList.includes(b)) {
      // 이미 삼합으로 잡힌 경우 스킵
      const parentSamhap = SAMHAP_GROUPS.find(g => g.members.includes(a) && g.members.includes(b));
      if (parentSamhap && fullSamhaps.includes(parentSamhap.name)) continue;

      const positions = [
        ...(jiPosMap[a] || []),
        ...(jiPosMap[b] || []),
      ];
      items.push({
        type: '반합',
        name: bh.name,
        resultOhaeng: bh.result,
        members: [a, b],
        positions,
        easyExplanation: getSamhapExplanation(bh.name, bh.result, positions, false),
      });
    }
  }

  // 5) 육합 (六合) 탐지 — 음양 1대1 긴밀한 결속
  for (const yh of YUKHAP_PAIRS) {
    const [a, b] = yh.pair;
    // 정방향·역방향 모두 탐색
    for (let i = 0; i < allJi.length; i++) {
      for (let j = i + 1; j < allJi.length; j++) {
        if ((allJi[i].ji === a && allJi[j].ji === b) || (allJi[i].ji === b && allJi[j].ji === a)) {
          items.push({
            type: '육합',
            name: yh.name,
            resultOhaeng: yh.result,
            position1: allJi[i].pos as any,
            position2: allJi[j].pos as any,
            ji1: allJi[i].ji,
            ji2: allJi[j].ji,
            easyExplanation: getYukhapExplanation(allJi[i].pos, allJi[j].pos, yh.name, yh.result),
            psychologyDetail: getYukhapPsychology(allJi[i].pos, allJi[j].pos),
          });
        }
      }
    }
  }

  // 통계
  const hapCount = items.filter(i => i.type === '천간합').length;
  const chungCount = items.filter(i => i.type === '지지충').length;
  const samhapCount = items.filter(i => i.type === '삼합' || i.type === '반합').length;
  const yukhapCount = items.filter(i => i.type === '육합').length;
  const totalHapCount = hapCount + samhapCount + yukhapCount;

  // 전체 분위기
  let overallMood: HapChungAnalysis['overallMood'] = '평온';
  if (totalHapCount > 0 && chungCount === 0) overallMood = '화합';
  else if (chungCount > 0 && totalHapCount === 0) overallMood = '변동';
  else if (chungCount >= 2 || (chungCount > 0 && totalHapCount >= 2)) overallMood = '격변';
  else if (chungCount > 0 && totalHapCount > 0) overallMood = '변동';

  // 합충 동시 발생 시 상호작용 + 대처법
  let simultaneousExplanation: string | undefined;
  let copingAdvice: string[] | undefined;
  if (overallMood === '격변') {
    simultaneousExplanation = HAPCHUNG_SIMULTANEOUS_EXPLANATION;
    copingAdvice = HAPCHUNG_COPING_ADVICE;
  }

  // 종합 요약 (초등학생 수준)
  let summary = '';
  if (items.length === 0) {
    summary = '🌈 사주 안에서 특별한 합이나 충이 없어요. 조용하고 안정적인 흐름이에요!';
  } else {
    const moodEmoji: Record<string, string> = { '평온': '🌈', '화합': '🤝', '변동': '⚡', '격변': '🌪️' };
    summary = `${moodEmoji[overallMood]} `;
    if (hapCount > 0) summary += `천간합이 ${hapCount}개 — 좋은 인연과 협력의 기운이 있어요! `;
    if (yukhapCount > 0) summary += `육합이 ${yukhapCount}개 — 나와 딱 맞는 단짝 같은 인연이 있어요! `;
    if (chungCount > 0) summary += `충이 ${chungCount}개 — 역동적인 변화와 새로운 시작이 기다려요! `;
    if (samhapCount > 0) summary += `삼합/반합이 ${samhapCount}개 — 여러 기운이 뭉쳐서 강한 힘이 생겨요! `;

    if (overallMood === '격변') {
      summary += '\n\n🌪️ 합과 충이 동시에 있어요! ' +
        '탐합망충(貪合忘沖) — 합의 결속이 충의 충격을 흡수해 갈등이 무마될 수도 있고, ' +
        '충발(沖發) — 묶인 기운이 충으로 풀려 예기치 못한 큰 변화가 폭발할 수도 있어요.\n' +
        '변화를 두려워하지 말고, 차분하게 준비하면 오히려 크게 성장할 수 있어요!';
    }
  }

  return { items, summary, hapCount, chungCount, samhapCount, yukhapCount, overallMood, simultaneousExplanation, copingAdvice };
}

// ========== 합충 실전 통변 사례 (운세 텍스트 활용) ==========

export interface HapChungCase {
  title: string;
  situation: string;
  chungDetail: string;
  hapDetail: string;
  result: string;
}

/** 합충 동시 발생 실전 통변 사례 — 운세/타임라인 텍스트에 활용 */
export const HAPCHUNG_CASES: HapChungCase[] = [
  {
    title: '주거지와 회사 동시 이전',
    situation: '술토(戌) 운이 들어온 시기',
    chungDetail: '월지 진토(辰)와 진술충(辰戌沖) → 기존 직장 환경 타파',
    hapDetail: '일지 묘목(卯)과 묘술합(卯戌合) → 새로운 계획 실행·결속',
    result: '충으로 인한 이동(이사)과 합으로 인한 새 출발(회사 이전)이 동시에 일어나, 거주지와 직장이 함께 바뀌는 큰 변화를 겪었어요.',
  },
  {
    title: '먼 곳으로 생계 이주 결심',
    situation: '신금(申) 월운이 들어온 시기',
    chungDetail: '일지 인목(寅)과 인신상충(寅申相沖) → 갑작스러운 이동·환경 변화',
    hapDetail: '년지 진토(辰)와 신진반합(申辰半合) → 새로운 계획이 묶이기 시작',
    result: '충이 이동을 부추기고 반합이 새 계획을 잡아주면서, 먼 곳으로 이사해 새 생활을 모색하게 되었어요.',
  },
  {
    title: '원거리 직업 이동 + 자녀 다툼',
    situation: '자수(子) 월운(정관)이 들어온 시기',
    chungDetail: '시지(자식궁) 오화(午)와 자오충(子午沖) → 자녀 관련 문제·다툼 발생',
    hapDetail: '년지 진토(辰)와 자진반합(子辰半合) → 먼 곳에서의 새 기회 형성',
    result: '합이 원거리 직업 기회를 만들면서, 동시에 충이 자녀와의 갈등을 일으켜 복합적인 변화가 겹쳤어요.',
  },
];

/**
 * 합충 결과를 반영하여 최종 오행 밸런스(점수)를 정밀 보정
 * (합화: 새로운 오행 기운 추가 및 기존 기운 약화 / 충: 충돌로 인한 기운 분산)
 * @param baseBalance 기존 오행 점수 객체
 * @param hapChung 합충 분석 결과
 * @returns 보정된 새로운 오행 점수 객체
 */
export function applyHapChungToOhaengScore(
  baseBalance: Record<Ohaeng, number>,
  hapChung: HapChungAnalysis
): Record<Ohaeng, number> {
  const newBalance = { ...baseBalance };

  for (const item of hapChung.items) {
    if (item.type === '천간합' || item.type === '육합') {
      // 오행 합화(合化): 만들어진 오행에 +1.5점, 원래 결속된 기운에서 -0.5점씩
      // 합화는 원국 기운의 방향성을 바꾸지만 총량을 급변시키지는 않음
      const r = item as (HapResult | YukhapResult);
      newBalance[r.resultOhaeng] = (newBalance[r.resultOhaeng] || 0) + 1.5;

      const oh1 = item.type === '천간합' ? CHEONGAN_OHAENG[(r as HapResult).gan1] : JIJI_OHAENG[(r as YukhapResult).ji1];
      const oh2 = item.type === '천간합' ? CHEONGAN_OHAENG[(r as HapResult).gan2] : JIJI_OHAENG[(r as YukhapResult).ji2];

      newBalance[oh1] = Math.max(0, newBalance[oh1] - 0.5);
      newBalance[oh2] = Math.max(0, newBalance[oh2] - 0.5);

    } else if (item.type === '삼합') {
      // 삼합: 강력한 기운 생성 (+2.5점), 기존 3개 기운 각각 -0.5점
      const r = item as SamhapResult;
      newBalance[r.resultOhaeng] = (newBalance[r.resultOhaeng] || 0) + 2.5;
      for (const member of r.members) {
        const oh = JIJI_OHAENG[member];
        newBalance[oh] = Math.max(0, newBalance[oh] - 0.5);
      }

    } else if (item.type === '반합') {
      // 반합: 중간 강도의 기운 생성 (+1.5점), 기존 2개 기운 각각 -0.3점
      const r = item as SamhapResult;
      newBalance[r.resultOhaeng] = (newBalance[r.resultOhaeng] || 0) + 1.5;
      for (const member of r.members) {
        const oh = JIJI_OHAENG[member];
        newBalance[oh] = Math.max(0, newBalance[oh] - 0.3);
      }

    } else if (item.type === '지지충') {
      // 충: 충돌로 인해 지지의 기운이 약화 (-0.5점)
      const r = item as ChungResult;
      const oh1 = JIJI_OHAENG[r.ji1];
      const oh2 = JIJI_OHAENG[r.ji2];
      newBalance[oh1] = Math.max(0, newBalance[oh1] - 0.5);
      newBalance[oh2] = Math.max(0, newBalance[oh2] - 0.5);
    }
  }

  // 소수점 1자리 처리 및 최소 0점 보장
  for (const key of Object.keys(newBalance) as Ohaeng[]) {
    newBalance[key] = Math.round(newBalance[key] * 10) / 10;
  }

  return newBalance;
}

