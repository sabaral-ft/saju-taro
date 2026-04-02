/**
 * 사령(司令) 심화 분석 엔진
 * - 길신/흉신 판단 + 십신별 발복/파괴 패턴
 * - 대운 투출 시기 감지
 * - 역용(逆用) 원리 + 융 그림자 이론 기반 개운법
 * - 초등학생도 알아듣는 쉬운 설명
 */

import { calculateSipseong, CHEONGAN_OHAENG, JIJI_OHAENG, OHAENG_SANGSAENG, OHAENG_SANGGEUK } from './saju-engine';
import type { Sipseong, Ohaeng } from './saju-engine';

// ========== 십신 → 5그룹 매핑 ==========
type SipseongGroup = '비겁' | '식상' | '재성' | '관성' | '인성';

const SIPSEONG_TO_GROUP: Record<string, SipseongGroup> = {
  '비견': '비겁', '겁재': '비겁',
  '식신': '식상', '상관': '식상',
  '정재': '재성', '편재': '재성',
  '정관': '관성', '편관': '관성',
  '정인': '인성', '편인': '인성',
};

// ========== 길신/흉신 판단 ==========
// 일반적으로: 정관/정인/정재/식신 = 길신 계열, 편관(칠살)/상관/겁재/편인 = 흉신 계열
// 실제로는 사주 구조에 따라 달라지지만, 기본 분류로 사용

const GILSIN_SET = new Set<string>(['정관', '정인', '정재', '식신', '비견']);
const HYUNGSIN_SET = new Set<string>(['편관', '상관', '겁재', '편인', '편재']);

export type SaryeongNature = '길신' | '흉신' | '중성';

export function judgeSaryeongNature(saryeongSipseong: string): SaryeongNature {
  if (GILSIN_SET.has(saryeongSipseong)) return '길신';
  if (HYUNGSIN_SET.has(saryeongSipseong)) return '흉신';
  return '중성';
}

// ========== 길신 발복 패턴 (초등학생 수준) ==========

const GILSIN_PATTERNS: Record<SipseongGroup, {
  title: string;
  emoji: string;
  easyExplanation: string;
  realLifeResult: string;
}> = {
  '비겁': {
    title: '친구·형제의 힘으로 대박!',
    emoji: '🤝',
    easyExplanation: '나와 비슷한 사람들(형제, 친구, 동업자)이 나를 도와줘요. ' +
      '마치 축구에서 팀 동료가 완벽한 패스를 해주는 것처럼, 주변 사람들의 힘으로 큰 성공을 이뤄요!',
    realLifeResult: '동업 성공, 투자 대박, 형제·친구의 결정적인 도움, 뜻밖의 횡재',
  },
  '식상': {
    title: '숨겨진 재능이 빛을 발해요!',
    emoji: '🌟',
    easyExplanation: '그동안 속으로만 간직했던 재능과 아이디어가 세상에 나와요. ' +
      '마치 애벌레가 나비가 되는 것처럼, 새로운 도전으로 큰 인기를 얻어요!',
    realLifeResult: '창의적 성공, 인기 폭발, 먹고사는 걱정 없음, 자녀의 덕',
  },
  '재성': {
    title: '돈을 버는 감각이 최고!',
    emoji: '💰',
    easyExplanation: '돈이 어디 있는지 귀신같이 아는 시기예요. ' +
      '마치 보물찾기에서 정확히 보물을 찾는 것처럼, 목표한 바를 딱딱 이뤄내요!',
    realLifeResult: '큰 재산 축적, 사업 성공, 현명한 배우자의 도움, 아버지의 덕',
  },
  '관성': {
    title: '리더로 우뚝 서요!',
    emoji: '👑',
    easyExplanation: '남들이 피하는 어려운 일도 멋지게 해내요. ' +
      '마치 반장선거에서 1등하는 것처럼, 모두가 인정하는 리더가 되는 시기!',
    realLifeResult: '승진, 높은 지위, 타인의 존경, 어려운 프로젝트 성공',
  },
  '인성': {
    title: '공부의 신이 되는 시기!',
    emoji: '📚',
    easyExplanation: '머리가 맑아지고 이해력이 폭발해요. ' +
      '마치 시험 문제가 다 보이는 것처럼, 학문과 자격증에서 대성공!',
    realLifeResult: '시험 합격, 학문 성취, 부동산·문서 취득, 부모님·선생님의 큰 도움',
  },
};

// ========== 흉신 파괴 패턴 (초등학생 수준) ==========

const HYUNGSIN_PATTERNS: Record<SipseongGroup, {
  title: string;
  emoji: string;
  easyExplanation: string;
  dangerSign: string;
  shadowExplanation: string;
}> = {
  '비겁': {
    title: '고집이 화를 부를 수 있어요',
    emoji: '😤',
    easyExplanation: '내 것을 지키려는 마음이 너무 커져서, 친구나 주변 사람과 다투게 될 수 있어요. ' +
      '마치 장난감을 아무에게도 안 빌려주는 것처럼, 독차지하려는 마음이 오히려 손해를 불러요.',
    dangerSign: '파산, 지인과의 갈등, 맹목적인 고집으로 인한 실패',
    shadowExplanation: '🪞 내 안의 그림자: "절대 지면 안 돼!"라는 마음이 숨어있어요. 이 마음을 알아차리고, 가끔은 양보하는 연습을 해봐요.',
  },
  '식상': {
    title: '쉽게 싫증나고 무기력해질 수 있어요',
    emoji: '😮‍💨',
    easyExplanation: '이것저것 시작은 잘 하는데 끝까지 하기 힘들어요. ' +
      '마치 게임을 시작했다가 바로 다른 게임으로 넘어가는 것처럼, 하나에 집중하지 못해요.',
    dangerSign: '직장 불안정, 규칙 무시, 명예 실추, 먹고사는 문제',
    shadowExplanation: '🪞 내 안의 그림자: "규칙은 나한테 안 맞아!"라는 반항심이 있어요. 이 에너지를 창작이나 예술로 풀면 오히려 큰 재능이 돼요!',
  },
  '재성': {
    title: '돈 욕심이 오히려 독이 될 수 있어요',
    emoji: '💸',
    easyExplanation: '돈을 너무 많이 벌고 싶은 마음이 커져서, 무리한 투자를 하게 될 수 있어요. ' +
      '마치 용돈을 다 모아서 한 번에 뽑기에 쓰는 것처럼, 큰 위험을 감수하게 돼요.',
    dangerSign: '부도, 가산 탕진, 아버지·배우자와의 심각한 갈등',
    shadowExplanation: '🪞 내 안의 그림자: "돈이 있어야 행복해!"라는 생각이 너무 강해요. 돈보다 소중한 것들(가족, 건강, 우정)을 잊지 마세요.',
  },
  '관성': {
    title: '스트레스가 나를 짓누를 수 있어요',
    emoji: '😰',
    easyExplanation: '완벽하게 해야 한다는 압박감이 너무 커져요. ' +
      '마치 시험 때 머릿속이 하얘지는 것처럼, 긴장과 두려움에 시달릴 수 있어요.',
    dangerSign: '극심한 스트레스, 법적 문제, 건강 악화, 상사와의 갈등',
    shadowExplanation: '🪞 내 안의 그림자: "모든 걸 다 컨트롤해야 해!"라는 강박이 있어요. 가끔은 "괜찮아, 완벽하지 않아도 돼"라고 스스로에게 말해줘요.',
  },
  '인성': {
    title: '생각이 너무 많아질 수 있어요',
    emoji: '🌀',
    easyExplanation: '이것저것 생각만 많아지고 실제로 행동하지 못해요. ' +
      '마치 결정 장애처럼 뭘 해야 할지 모르는 상태에 빠질 수 있어요.',
    dangerSign: '시험 실패, 해고, 잘못된 판단, 윗사람으로 인한 고통',
    shadowExplanation: '🪞 내 안의 그림자: "내 생각이 항상 맞아!"라는 고집이 있어요. 다른 사람의 의견도 한 번 더 들어보는 열린 마음이 필요해요.',
  },
};

// ========== 개운법 추천 시스템 ==========

interface GaewunAdvice {
  study: string;          // 공부/전공 추천
  career: string;         // 직업 환경 추천
  partner: string;        // 배우자 조건 추천
  dailyTip: string;       // 일상 실천 팁
  jungShadowWork: string; // 융 그림자 통합 조언
}

function getGilsinGaewun(group: SipseongGroup): GaewunAdvice {
  const advices: Record<SipseongGroup, GaewunAdvice> = {
    '비겁': {
      study: '리더십, 경영학, 체육 관련 분야에서 재능을 키워요',
      career: '팀을 이끄는 리더, 스포츠 감독, 창업가가 잘 맞아요',
      partner: '나를 존중하면서도 함께 성장할 수 있는 파트너가 좋아요',
      dailyTip: '매일 한 가지씩 주변 사람에게 감사 표현하기!',
      jungShadowWork: '당신의 강점(추진력, 리더십)을 더 키우되, 독선에 빠지지 않도록 팀원의 의견을 경청하세요.',
    },
    '식상': {
      study: '예술, 문학, 요리, IT/콘텐츠 제작 분야가 딱이에요',
      career: '크리에이터, 셰프, 작가, 연예인, 교육자가 천직이에요',
      partner: '나의 표현을 응원하고 안정감을 주는 배우자가 좋아요',
      dailyTip: '하루에 한 가지 새로운 것을 시도해보기!',
      jungShadowWork: '당신의 창의력은 최고의 무기예요. 세상에 당신의 이야기를 마음껏 펼치세요!',
    },
    '재성': {
      study: '경제, 회계, 부동산, 경영 분야에서 감각을 살려요',
      career: '사업가, 투자자, 부동산 전문가, 금융업이 잘 맞아요',
      partner: '함께 재산을 불려갈 현실적이고 지혜로운 파트너가 좋아요',
      dailyTip: '목표를 정하고 매일 조금씩 저축하는 습관 들이기!',
      jungShadowWork: '돈을 버는 능력이 뛰어나요. 번 돈으로 주변에 베풀면 복이 더 커져요.',
    },
    '관성': {
      study: '법학, 행정학, 의학, 군사학 분야에서 실력을 발휘해요',
      career: '공무원, 판사, 의사, 군인, 대기업 임원이 잘 맞아요',
      partner: '나의 야망을 이해하고 내조할 수 있는 파트너가 좋아요',
      dailyTip: '하루 끝에 "오늘 잘한 것 3가지" 적어보기!',
      jungShadowWork: '당신은 타고난 리더예요. 높은 자리에서 사람들을 위해 일하면 크게 빛나요.',
    },
    '인성': {
      study: '철학, 교육학, 심리학, 종교학 분야에서 깊이를 더해요',
      career: '교수, 연구원, 상담사, 교사, 작가가 천직이에요',
      partner: '지적인 대화가 통하고 정서적으로 안정감을 주는 파트너가 좋아요',
      dailyTip: '매일 30분 독서하며 내면의 지혜를 키우기!',
      jungShadowWork: '당신의 깊은 사고력은 보물이에요. 배운 것을 세상에 나누면 더 큰 행복이 와요.',
    },
  };
  return advices[group];
}

function getHyungsinGaewun(group: SipseongGroup, saryeongSipseong: string): GaewunAdvice {
  // 역용(逆用)의 원리: 흉신의 에너지를 긍정적 방향으로 전환
  const advices: Record<SipseongGroup, GaewunAdvice> = {
    '비겁': {
      study: '협상학, 스포츠 경영, 군사학 분야에서 투쟁심을 활용해요',
      career: '무역, 개척자, 경호, 프로 스포츠, 영업 분야로 승화시켜요',
      partner: '나의 승부욕을 이해하면서 브레이크 역할을 해줄 배우자가 좋아요',
      dailyTip: '경쟁심이 올라올 때, 3초 멈추고 심호흡하기!',
      jungShadowWork: '🪞 "지면 안 돼!"라는 마음은 사실 강한 의지의 표현이에요. 이 에너지를 건강한 경쟁(운동, 자기계발)으로 풀어보세요.',
    },
    '식상': {
      study: '음악, 미술, 방송, 발명, 프로그래밍 분야에서 반항심을 창의력으로!',
      career: '예술가, 음악가, 방송인, 발명가, 스타트업이 천직이에요',
      partner: '나의 자유로운 영혼을 존중하면서 현실감각을 보완해줄 파트너가 좋아요',
      dailyTip: '싫증날 때 새로운 취미 대신, 하던 것을 한 단계 더 깊이 파보기!',
      jungShadowWork: '🪞 규칙을 깨고 싶은 마음은 남다른 창의력의 증거예요. 이 힘을 예술이나 혁신에 쏟으면 천재가 될 수 있어요!',
    },
    '재성': {
      study: '리스크 관리, 투자론, 심리학을 배워 욕심을 다스려요',
      career: '투자 전문가, 보험 설계사, 재무 상담사가 물욕을 긍정적으로 활용해요',
      partner: '검소하고 현실적인 파트너가 나의 과한 물욕을 균형 잡아줘요',
      dailyTip: '큰 돈 쓰기 전에 3일 생각하기! 충동구매 금지!',
      jungShadowWork: '🪞 돈에 대한 집착은 "안전하고 싶다"는 마음에서 와요. 진짜 안전은 돈이 아니라 사랑하는 사람들에게서 온다는 걸 기억하세요.',
    },
    '관성': {
      study: '의학, 법학, 경찰학, 심리상담 분야에서 압박감을 활인(活人)의 힘으로!',
      career: saryeongSipseong === '편관'
        ? '의사, 경찰, 군인, 검찰, 종교인 — 생사를 다루는 활인 분야가 천직이에요'
        : '법관, 공무원, 감사관 — 정의를 실현하는 분야가 잘 맞아요',
      partner: '나를 있는 그대로 받아들이고 정서적 안정을 주는 파트너가 좋아요',
      dailyTip: '완벽하지 않아도 괜찮다고 하루에 한 번 스스로에게 말하기!',
      jungShadowWork: '🪞 스트레스와 압박감은 당신이 책임감이 강하다는 증거예요. 이 힘을 세상을 지키는 데 쓰면 영웅이 될 수 있어요!',
    },
    '인성': {
      study: '철학, 종교학, 명상, 심리상담 분야에서 깊은 생각을 지혜로 전환!',
      career: '상담사, 종교인, 철학자, 연구원 — 깊은 사고가 무기인 분야가 좋아요',
      partner: '행동력이 좋고 현실적인 파트너가 내 우유부단함을 보완해줘요',
      dailyTip: '생각이 많을 때, 일단 종이에 적고 가장 중요한 한 가지만 실행하기!',
      jungShadowWork: '🪞 "내가 다 알아야 해!"라는 마음은 배움에 대한 열정이에요. 아는 것을 실천으로 옮기면, 진짜 지혜가 완성돼요.',
    },
  };
  return advices[group];
}

// ========== 대운 투출 감지 ==========

export interface DaeunTouchulResult {
  isTouchul: boolean;
  touchulGan: string;
  easyExplanation: string;
  lifeChangeStory: string;
}

export function checkDaeunTouchul(
  saryeongGan: string,
  daeunCheongan: string,
  saryeongSipseong: string,
  nature: SaryeongNature,
): DaeunTouchulResult {
  const isTouchul = saryeongGan === daeunCheongan;

  if (!isTouchul) {
    return {
      isTouchul: false,
      touchulGan: '',
      easyExplanation: '아직 사령의 기운이 대운에서 나타나지 않았어요. 내면의 힘을 조용히 키우는 시기예요.',
      lifeChangeStory: '',
    };
  }

  let lifeChangeStory = '';
  if (nature === '길신') {
    lifeChangeStory = `🎆 인생의 대전환점이 왔어요!\n\n` +
      `그동안 마음 깊은 곳에 꽁꽁 숨겨두었던 진짜 꿈과 재능이 드디어 세상 밖으로 나와요! ` +
      `마치 오랫동안 준비한 무대에 드디어 올라가는 것처럼, ` +
      `주변 사람들이 "이 사람이 이렇게 대단했어?"라고 깜짝 놀랄 거예요.\n\n` +
      `💪 이 시기의 핵심: 준비했던 것을 과감하게 실행하세요! ` +
      `다만 너무 흥분해서 무리하지 말고, 하나씩 차근차근 밟아가면 크게 성공해요!`;
  } else if (nature === '흉신') {
    lifeChangeStory = `⚠️ 중요한 시기가 왔어요! 주의가 필요해요.\n\n` +
      `마음속 깊이 숨어있던 강한 욕구가 갑자기 터져 나오려고 해요. ` +
      `이 에너지가 좋은 방향으로 가면 엄청난 성취를 이루지만, ` +
      `잘못된 방향으로 가면 큰 실수를 할 수 있어요.\n\n` +
      `🛡️ 이 시기의 핵심: 충동적으로 행동하지 마세요! ` +
      `큰 결정은 반드시 신뢰하는 사람과 상의하고, ` +
      `이 강한 에너지를 운동이나 창작활동으로 풀어보세요!`;
  } else {
    lifeChangeStory = `🔄 변화의 바람이 불어와요.\n\n` +
      `내면의 숨겨진 능력이 세상에 드러나는 시기예요. ` +
      `좋은 쪽으로든 조심해야 할 쪽으로든, 확실히 변화가 생겨요.\n\n` +
      `🧭 이 시기의 핵심: 변화를 받아들이되, 방향을 잘 잡으세요!`;
  }

  return {
    isTouchul: true,
    touchulGan: saryeongGan,
    easyExplanation: `🔥 사령(${saryeongGan})이 대운 천간에 나타났어요! ` +
      `마음 깊은 곳에 숨어있던 진짜 나(${saryeongSipseong})가 세상 밖으로 나오는 인생의 결정적 순간이에요!`,
    lifeChangeStory,
  };
}

// ========== 미투출 개운법 ==========

export interface MitouchulGaewun {
  hermitWisdom: string;    // 은둔자(The Hermit) 지혜
  potentialMindset: string; // 가능성 마인드셋
  threeFactors: GaewunAdvice; // 후천적 3요소
}

function getMitouchulGaewun(saryeongSipseong: string): MitouchulGaewun {
  const group = SIPSEONG_TO_GROUP[saryeongSipseong] || '비겁';

  return {
    hermitWisdom: `🃏 타로의 '은둔자' 카드처럼, 지금은 조용히 내면의 목소리에 귀 기울이는 시간이에요.\n\n` +
      `속마음을 억지로 꺼내려 하지 말고, 안전하고 편안한 환경에서 천천히 나 자신을 들여다보세요. ` +
      `일기를 쓰거나, 좋아하는 음악을 들으며 "나는 정말 뭘 원하는 걸까?" 생각해보는 게 좋아요.\n\n` +
      `이렇게 조용히 준비하는 시간이 있어야, 나중에 기회가 왔을 때 빛나게 폭발할 수 있어요! ✨`,

    potentialMindset: `사주는 "이미 정해진 운명"이 아니에요! 🌱\n\n` +
      `내 안에 숨어있는 ${saryeongSipseong}의 기운은 "아직 세상에 나오지 않은 가능성"이에요. ` +
      `지금 당장 빛나지 않아도 괜찮아요. 씨앗이 땅속에서 조용히 뿌리를 내리듯, ` +
      `실력을 쌓고 준비하면 언젠가 대운의 흐름을 만나 크게 꽃피울 수 있어요!\n\n` +
      `🎯 지금 할 일: 꾸준히 공부하고 경험을 쌓으면서, 내 안의 가능성을 믿고 키워가세요!`,

    threeFactors: getGilsinGaewun(group), // 후천적 3요소는 길신 기준으로 제공
  };
}

// ========== 종합 분석 결과 ==========

export interface SaryeongAdvancedResult {
  saryeongSipseong: string;
  saryeongGroup: SipseongGroup;
  nature: SaryeongNature;

  // 길신/흉신별 패턴
  patternTitle: string;
  patternEmoji: string;
  patternExplanation: string;   // 초등학생 수준 설명
  patternResult: string;        // 현실 결과

  // 흉신일 때만
  dangerSign?: string;
  shadowExplanation?: string;

  // 개운법
  gaewun: GaewunAdvice;

  // 대운 투출 여부
  daeunTouchul?: DaeunTouchulResult;

  // 미투출 개운법
  mitouchulGaewun?: MitouchulGaewun;
}

/**
 * 사령 심화 종합 분석
 */
export function analyzeSaryeongAdvanced(
  ilgan: string,
  saryeongGan: string,
  saryeongSipseong: string,
  isTouchul: boolean,
  daeunCheongan?: string,
): SaryeongAdvancedResult {
  const group = SIPSEONG_TO_GROUP[saryeongSipseong] || '비겁';
  const nature = judgeSaryeongNature(saryeongSipseong);

  let patternTitle = '';
  let patternEmoji = '';
  let patternExplanation = '';
  let patternResult = '';
  let dangerSign: string | undefined;
  let shadowExplanation: string | undefined;
  let gaewun: GaewunAdvice;

  if (nature === '길신') {
    const pattern = GILSIN_PATTERNS[group];
    patternTitle = pattern.title;
    patternEmoji = pattern.emoji;
    patternExplanation = pattern.easyExplanation;
    patternResult = pattern.realLifeResult;
    gaewun = getGilsinGaewun(group);
  } else {
    const pattern = HYUNGSIN_PATTERNS[group];
    patternTitle = pattern.title;
    patternEmoji = pattern.emoji;
    patternExplanation = pattern.easyExplanation;
    patternResult = '';
    dangerSign = pattern.dangerSign;
    shadowExplanation = pattern.shadowExplanation;
    gaewun = getHyungsinGaewun(group, saryeongSipseong);
  }

  // 대운 투출 체크
  let daeunTouchul: DaeunTouchulResult | undefined;
  if (daeunCheongan) {
    daeunTouchul = checkDaeunTouchul(saryeongGan, daeunCheongan, saryeongSipseong, nature);
  }

  // 미투출이면 미투출 개운법 제공
  let mitouchulGaewun: MitouchulGaewun | undefined;
  if (!isTouchul) {
    mitouchulGaewun = getMitouchulGaewun(saryeongSipseong);
  }

  return {
    saryeongSipseong,
    saryeongGroup: group,
    nature,
    patternTitle,
    patternEmoji,
    patternExplanation,
    patternResult,
    dangerSign,
    shadowExplanation,
    gaewun,
    daeunTouchul,
    mitouchulGaewun,
  };
}
