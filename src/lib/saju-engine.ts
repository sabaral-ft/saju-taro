/**
 * 사주 계산 엔진
 * 만세력 기반 천간지지 계산, 오행 분석, 십성 판단
 */

import { ILJU_FULL_DESCRIPTION } from './ilju-descriptions';
import { analyzeSajuInteractions } from './saju-interactions';

// ========== 기본 데이터 ==========

// 천간 (天干) - 10개
export const CHEONGAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
// 한자: 甲 乙 丙 丁 戊 己 庚 辛 壬 癸

// 지지 (地支) - 12개
export const JIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;
// 한자: 子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥

// 띠 동물
export const ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'] as const;

// 오행 (五行)
export type Ohaeng = '목' | '화' | '토' | '금' | '수';

// 천간의 오행
export const CHEONGAN_OHAENG: Record<string, Ohaeng> = {
  '갑': '목', '을': '목',
  '병': '화', '정': '화',
  '무': '토', '기': '토',
  '경': '금', '신': '금',
  '임': '수', '계': '수',
};

// 천간의 음양
export const CHEONGAN_EUMYANG: Record<string, '양' | '음'> = {
  '갑': '양', '을': '음',
  '병': '양', '정': '음',
  '무': '양', '기': '음',
  '경': '양', '신': '음',
  '임': '양', '계': '음',
};

// 지지의 오행
export const JIJI_OHAENG: Record<string, Ohaeng> = {
  '자': '수', '축': '토',
  '인': '목', '묘': '목',
  '진': '토', '사': '화',
  '오': '화', '미': '토',
  '신': '금', '유': '금',
  '술': '토', '해': '수',
};

// 지지의 음양
export const JIJI_EUMYANG: Record<string, '양' | '음'> = {
  '자': '양', '축': '음',
  '인': '양', '묘': '음',
  '진': '양', '사': '음',
  '오': '양', '미': '음',
  '신': '양', '유': '음',
  '술': '양', '해': '음',
};

// 지지 장간 (지지 속에 숨은 천간) — 순서: 본기(사령), 중기, 여기
export const JIJI_JANGGAN: Record<string, string[]> = {
  '자': ['계'],
  '축': ['기', '계', '신'],
  '인': ['갑', '병', '무'],
  '묘': ['을'],
  '진': ['무', '계', '을'],
  '사': ['병', '경', '무'],
  '오': ['정', '기'],
  '미': ['기', '정', '을'],
  '신': ['경', '임', '무'],
  '유': ['신'],
  '술': ['무', '신', '정'],
  '해': ['임', '갑'],
};

// 지장간 사령(司令) — 각 지지의 주도적 기운 (본기, 첫 번째 장간)
export function getSaryeong(jiji: string): string {
  const janggan = JIJI_JANGGAN[jiji];
  return janggan ? janggan[0] : '';
}

// ========== 정밀 사령(司令) 도출 시스템 ==========
// 각 월지별 지장간 배분 일수 (지지조화도표)
// 순서: [여기(잔기), 중기, 정기(본기)] — 절기 시작부터 순차 배분
const JANGGAN_DAYS: Record<string, { gan: string; days: number }[]> = {
  '자': [{ gan: '임', days: 10 }, { gan: '계', days: 20 }],
  '축': [{ gan: '계', days: 9 }, { gan: '신', days: 3 }, { gan: '기', days: 18 }],
  '인': [{ gan: '무', days: 7 }, { gan: '병', days: 7 }, { gan: '갑', days: 16 }],
  '묘': [{ gan: '갑', days: 10 }, { gan: '을', days: 20 }],
  '진': [{ gan: '을', days: 9 }, { gan: '계', days: 3 }, { gan: '무', days: 18 }],
  '사': [{ gan: '무', days: 5 }, { gan: '경', days: 9 }, { gan: '병', days: 16 }],
  '오': [{ gan: '병', days: 11 }, { gan: '기', days: 9 }, { gan: '정', days: 10 }],
  '미': [{ gan: '정', days: 9 }, { gan: '을', days: 3 }, { gan: '기', days: 18 }],
  '신': [{ gan: '기', days: 7 }, { gan: '임', days: 3 }, { gan: '경', days: 20 }],
  '유': [{ gan: '경', days: 10 }, { gan: '신', days: 20 }],
  '술': [{ gan: '신', days: 9 }, { gan: '정', days: 3 }, { gan: '무', days: 18 }],
  '해': [{ gan: '무', days: 7 }, { gan: '갑', days: 5 }, { gan: '임', days: 18 }],
};

/**
 * 정밀 사령 도출 — 월지 + 절기부터의 경과일수로 실제 사령을 판별
 * @param monthJiji 월지 (예: '인')
 * @param daysFromJeolgi 절기(절입)부터 출생일까지의 경과 일수
 * @returns 사령 천간
 */
export function getPreciseSaryeong(monthJiji: string, daysFromJeolgi: number): string {
  const entries = JANGGAN_DAYS[monthJiji];
  if (!entries) return getSaryeong(monthJiji);

  let accumulated = 0;
  for (const entry of entries) {
    accumulated += entry.days;
    if (daysFromJeolgi <= accumulated) {
      return entry.gan;
    }
  }
  // 초과 시 마지막 (정기/본기) 반환
  return entries[entries.length - 1].gan;
}

// 십신별 심리 키워드 (사령 심화 분석용)
const SIPSEONG_PSYCHOLOGY: Record<string, { outer: string; inner: string }> = {
  '비견': {
    outer: '자주적이고 독립적이며 자존심이 강한',
    inner: '남에게 지기 싫고 경쟁심이 강하며, 자기 영역을 굳건히 지키려는',
  },
  '겁재': {
    outer: '사교적이고 활동적이며 추진력이 있는',
    inner: '내 것을 빼앗길까 불안하고, 승부욕과 소유욕이 강한',
  },
  '식신': {
    outer: '온화하고 여유 있으며 즐거움을 추구하는',
    inner: '안정과 풍요를 갈망하며, 먹고 쉬고 즐기려는 본능이 강한',
  },
  '상관': {
    outer: '재치 있고 표현력이 뛰어나며 자유분방한',
    inner: '기존 질서에 반항하고 싶고, 자신의 재능을 인정받고 싶은 욕구가 강렬한',
  },
  '편재': {
    outer: '현실적이고 돈에 대한 감각이 뛰어난',
    inner: '큰 돈을 벌고 싶은 야망이 있고, 투기적 모험을 즐기는',
  },
  '정재': {
    outer: '성실하고 절약하며 계획적인',
    inner: '안정적인 수입과 재산 축적에 대한 집착이 있는',
  },
  '편관': {
    outer: '강직하고 원칙을 중시하며 예리하고 단호한',
    inner: '의심이 깊고 치밀하게 다음 계획(모사)을 꾸미고 있는',
  },
  '정관': {
    outer: '책임감 있고 예의 바르며 신뢰감을 주는',
    inner: '체면과 명예를 중시하고, 남들 눈에 모범적으로 보이고 싶은',
  },
  '편인': {
    outer: '독창적이고 비범한 사고를 하는',
    inner: '생각이 매우 깊고 매사에 의심을 품으며, 남과 다른 길을 가려는',
  },
  '정인': {
    outer: '학구적이고 자상하며 배려심이 깊은',
    inner: '인정받고 보호받고 싶은 마음이 크고, 안정된 환경을 갈망하는',
  },
};

/**
 * 사령 기반 심화 심리 분석
 * 월지 십신(겉모습) vs 사령 십신(내면) 대비 + 투출 여부
 */
export function analyzeSaryeongPsychology(
  ilgan: string,
  monthJiji: string,
  saryeongGan: string,
  allCheongan: string[] // [연간, 월간, 일간, 시간]
): {
  monthSipseong: string;
  saryeongSipseong: string;
  outerInnerAnalysis: string;
  isTouchul: boolean;
  touchulAnalysis: string;
  gyeomgyeokAnalysis: string;
} {
  // 월지의 본기 십신 (겉모습)
  const monthBongi = getSaryeong(monthJiji);
  const monthSipseong = monthBongi ? calculateSipseong(ilgan, monthBongi) : '비견';

  // 사령의 십신 (내면)
  const saryeongSipseong = saryeongGan ? calculateSipseong(ilgan, saryeongGan) : '비견';

  // 겉과 속 대비 분석
  const outerData = SIPSEONG_PSYCHOLOGY[monthSipseong] || SIPSEONG_PSYCHOLOGY['비견'];
  const innerData = SIPSEONG_PSYCHOLOGY[saryeongSipseong] || SIPSEONG_PSYCHOLOGY['비견'];

  let outerInnerAnalysis = '';
  if (monthSipseong === saryeongSipseong) {
    outerInnerAnalysis = `월지 본성과 내면의 사령이 모두 ${monthSipseong}으로 일치합니다. 겉과 속이 같은 사람으로, ${outerData.outer} 성격이 그대로 내면까지 관통합니다. 솔직하고 일관된 성향이지만, ${monthSipseong}의 특성이 극대화될 수 있으므로 균형에 유의해야 합니다.`;
  } else {
    outerInnerAnalysis = `겉보기에는 ${monthSipseong}의 특성처럼 ${outerData.outer} 본성을 지녔습니다. 하지만 가장 깊은 내면(사령)에는 ${saryeongSipseong}의 심리가 숨어 있어, 속으로는 ${innerData.inner} 사람입니다.`;
  }

  // 투출 여부: 사령 천간이 사주의 천간에 드러나 있는지
  const isTouchul = allCheongan.some(g => g === saryeongGan);

  let touchulAnalysis = '';
  if (isTouchul) {
    touchulAnalysis = `사령(${saryeongGan})이 천간에 투출되어 있습니다. 마음먹은 바를 주저하지 않고 세상에 적극적으로 표출하며, 생각과 행동이 일치하는 삶을 지향합니다. 내면의 욕구가 현실에서 실현될 가능성이 높습니다.`;
  } else {
    touchulAnalysis = `사령(${saryeongGan})이 천간에 드러나지 않은 상태입니다. 평소에는 진짜 마음을 쉽게 표출하지 않고 감추고 지내지만, 내면에는 '언젠가 때가 되면 나의 진짜 생각과 욕구를 터뜨리겠다'는 강렬한 동기가 잠재되어 있습니다.`;
  }

  // 겸격(兼格) 분석: 월지 지장간 중 2개 이상이 천간에 투출된 경우
  const monthJanggan = JIJI_JANGGAN[monthJiji] || [];
  const touchulJanggan = monthJanggan.filter(jg => allCheongan.includes(jg));
  let gyeomgyeokAnalysis = '';
  if (touchulJanggan.length >= 2) {
    const touchulSipseongs = touchulJanggan.map(jg => calculateSipseong(ilgan, jg));
    const touchulPsychologies = touchulJanggan.map((jg, i) => {
      const data = SIPSEONG_PSYCHOLOGY[touchulSipseongs[i]];
      return data ? `${touchulSipseongs[i]}(${data.outer})` : touchulSipseongs[i];
    });
    gyeomgyeokAnalysis = `겸격(兼格): 월지 지장간의 기운 ${touchulPsychologies.join('과 ')}이(가) 동시에 천간으로 투출되어 있습니다. 내면의 욕구가 하나로 통일되지 못해 성정이 일정하지 않고, 상황에 따라 전혀 다른 면모를 보이는 다중적이고 복합적인 심리를 지녔습니다.`;
  }

  return {
    monthSipseong,
    saryeongSipseong,
    outerInnerAnalysis,
    isTouchul,
    touchulAnalysis,
    gyeomgyeokAnalysis,
  };
}

// 십신 불균형 분석 (과다/부재에 따른 심리 특성)
// ilgan, gender를 받아 개인별 맞춤 설명 생성
export function analyzeSipseongBalance(
  sipseongs: { year: Sipseong; month: Sipseong; hour: Sipseong },
  jangganSipseongs: Sipseong[],
  ilgan?: string,
  gender?: 'male' | 'female',
): {
  excess: string[];
  lacking: string[];
  psychology: string;
} {
  // 모든 십성 카운트
  const allSip = [sipseongs.year, sipseongs.month, sipseongs.hour, ...jangganSipseongs];
  const count: Record<string, number> = {};
  for (const s of allSip) {
    count[s] = (count[s] || 0) + 1;
  }

  // 5가지 분류 그룹
  const groups: Record<string, string[]> = {
    '인성': ['정인', '편인'],
    '식상': ['식신', '상관'],
    '재성': ['정재', '편재'],
    '관성': ['정관', '편관'],
    '비겁': ['비견', '겁재'],
  };

  const groupCount: Record<string, number> = {};
  for (const [group, members] of Object.entries(groups)) {
    groupCount[group] = members.reduce((sum, m) => sum + (count[m] || 0), 0);
  }

  const excess: string[] = [];
  const lacking: string[] = [];
  let psychology = '';

  // 과다 (3개 이상)
  for (const [group, cnt] of Object.entries(groupCount)) {
    if (cnt >= 3) excess.push(group);
    if (cnt === 0) lacking.push(group);
  }

  // 일간별 오행 기질 → 과다/부재 설명을 개인화
  const ilOh = ilgan ? CHEONGAN_OHAENG[ilgan] : '';
  const isMale = gender === 'male';
  const OH_NAME: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
  const ilOhName = ilOh ? OH_NAME[ilOh] || ilOh : '';

  // --- 과다 심리 분석 (일간별 맞춤) ---
  if (excess.includes('인성')) {
    if (ilOh === '목') {
      psychology += `인성(印星) 과다: ${ilOhName} 일간에 수(물) 기운이 넘쳐 생각의 숲에 갇히기 쉽습니다. 아이디어는 많지만 실행이 늦어지는 타입입니다. 나무가 물을 너무 많이 먹으면 뿌리가 썩듯, 고민보다 작은 행동 하나가 더 큽니다.\n`;
    } else if (ilOh === '화') {
      psychology += `인성(印星) 과다: ${ilOhName} 일간에 목(나무) 기운이 과해 열정은 있지만 생각이 앞서 불안합니다. 머릿속은 번뜩이는 계획으로 가득하지만 정작 시작을 못 합니다. 직관을 믿고 바로 움직이세요.\n`;
    } else if (ilOh === '토') {
      psychology += `인성(印星) 과다: ${ilOhName} 일간에 화(불) 기운이 과해 남을 돌보느라 자기를 잃기 쉽습니다. 모든 걸 품어주려 하지만 정작 본인은 지칩니다. 나를 위한 시간을 의식적으로 확보하세요.\n`;
    } else if (ilOh === '금') {
      psychology += `인성(印星) 과다: ${ilOhName} 일간에 토(흙) 기운이 과해 신중함이 지나쳐 우유부단해질 수 있습니다. 완벽하게 준비된 뒤에 시작하려 하면 기회를 놓칩니다. 70%만 준비되면 시작하세요.\n`;
    } else {
      psychology += `인성(印星) 과다: ${ilOhName} 일간에 금(쇠) 기운이 과해 분석은 뛰어나지만 감정 표현이 서투릅니다. 머리로는 알지만 마음을 전달하는 데 서툰 타입입니다. 느끼는 대로 말하는 연습을 하세요.\n`;
    }
  }
  if (excess.includes('식상')) {
    if (ilOh === '목') {
      psychology += `식상(食傷) 과다: ${ilOhName} 일간의 불 에너지가 넘쳐 창의력은 폭발하지만 수십 가지를 동시에 벌입니다. 하나를 끝까지 마무리하는 힘이 약합니다. "하나만 끝내고 다음"이 성공의 열쇠입니다.\n`;
    } else if (ilOh === '화') {
      psychology += `식상(食傷) 과다: ${ilOhName} 일간의 토 에너지가 넘쳐 말과 행동이 앞서고 주변을 휘어잡습니다. 카리스마가 있지만 독선적으로 보일 수 있습니다. 경청하는 습관이 인간관계를 크게 바꿉니다.\n`;
    } else if (ilOh === '금') {
      psychology += `식상(食傷) 과다: ${ilOhName} 일간의 수 에너지가 넘쳐 비판 능력은 날카롭지만 입이 너무 정직합니다. 맞는 말이라도 상대가 상처받을 수 있으니, 전달 방법을 신경 쓰세요.\n`;
    } else {
      psychology += `식상(食傷) 과다: 표현력과 활동력이 넘칩니다. 시작하는 힘은 강하지만 마무리가 약할 수 있습니다. 관성(직장/조직)을 극하므로 윗사람과 갈등이 생기기 쉽습니다. 하나에 집중하는 연습이 필요합니다.\n`;
    }
  }
  if (excess.includes('재성')) {
    if (isMale) {
      psychology += `재성(財星) 과다: 현실 감각이 뛰어나고 돈을 잘 벌지만, 이성에 대한 관심이 많아 바람끼 주의가 필요합니다. 남자에게 재성은 여자(아내)를 의미하므로, 재성 과다는 여자 인연이 많다는 뜻이기도 합니다. 인성(공부/자격증)이 약해지기 쉬우니 자기계발을 의식적으로 하세요.\n`;
    } else {
      psychology += `재성(財星) 과다: 현실적이고 경제 감각이 뛰어나지만, 물질에 집착하거나 아버지와의 관계에서 어려움이 있을 수 있습니다. 인성(학문/어머니)을 극하므로 학업보다 실전에서 빛나는 타입입니다. 정신적 성장에도 투자하면 더 큰 부를 이룹니다.\n`;
    }
  }
  if (excess.includes('관성')) {
    if (isMale) {
      psychology += `관성(官星) 과다: 책임감이 매우 강하고 사회적 평판을 중시합니다. 하지만 남에게 인정받으려는 욕구가 지나쳐 스트레스를 많이 받습니다. ${ilOh === '목' ? '나무가 쇠에 찍히듯 외부 압력에 취약합니다. 완벽주의를 내려놓으세요.' : ilOh === '화' ? '불이 물에 꺼지듯 자존감이 흔들리기 쉽습니다. 남의 시선보다 내 기준을 세우세요.' : '번아웃이 올 수 있으니 의식적으로 쉬는 시간을 만드세요.'}\n`;
    } else {
      psychology += `관성(官星) 과다: 여자에게 관성은 남자(남편)를 의미하므로, 이성 인연이 많거나 남자 때문에 고민할 일이 많습니다. 책임감과 도덕성이 강하지만, 타인의 기대에 짓눌리기 쉽습니다. ${ilOh === '수' ? '감정이 억눌려 우울해지기 쉬우니 자기 감정을 표현하는 연습을 하세요.' : '자기 자신을 위한 시간을 꼭 확보하세요.'}\n`;
    }
  }
  if (excess.includes('비겁')) {
    psychology += `비겁(比劫) 과다: ${ilOhName} 기운이 사주에 넘쳐 자존심과 독립심이 매우 강합니다. ${ilOh === '목' ? '숲처럼 나무끼리 경쟁하듯 형제·친구와 갈등이 생기기 쉽고, 양보를 모르는 편입니다.' : ilOh === '화' ? '불꽃이 서로 부딪히듯 주변과 충돌이 잦고, 감정적으로 과격해질 수 있습니다.' : ilOh === '토' ? '고집이 산처럼 단단해서 한번 정한 건 절대 안 바꿉니다. 유연성이 필요합니다.' : ilOh === '금' ? '칼끼리 부딪히듯 날카로운 경쟁심이 있고, 비판이 지나칠 수 있습니다.' : '물이 넘치면 범람하듯 감정이 불안정해지기 쉽고, 이리저리 흔들릴 수 있습니다.'} 재성(재물)을 극하므로 ${isMale ? '동업이나 공동 투자에서 손해를 볼 수 있습니다. 혼자 하는 일이 더 맞습니다.' : '돈 관리를 더 신경 써야 하고, 친구에게 돈 빌려주는 건 피하세요.'}\n`;
  }

  // --- 부재 심리 분석 (일간/성별별 맞춤) ---
  if (lacking.includes('식상')) {
    psychology += `식상(食傷) 부재: 자기 표현이 서툴고 시작하는 힘이 약합니다. ${ilOh === '목' ? '나무의 성장 에너지가 밖으로 안 나가니 속으로만 답답합니다. 운동이나 예술 활동으로 에너지를 발산하세요.' : ilOh === '금' ? '논리적이지만 감정 전달이 어렵습니다. 글쓰기나 일기를 통해 마음을 꺼내보세요.' : ilOh === '수' ? '직관은 뛰어나지만 말로 설명하는 게 어렵습니다. 시각적 표현(그림, 영상)이 더 맞을 수 있습니다.' : '속마음을 표현하는 연습이 인생을 크게 바꿉니다. 발표, 글쓰기, SNS 등 어떤 형태든 시작하세요.'}\n`;
  }
  if (lacking.includes('재성')) {
    if (isMale) {
      psychology += `재성(財星) 부재: 남자에게 재성은 아내·재물을 뜻하므로, 결혼이 늦거나 경제관념이 약할 수 있습니다. ${ilOh === '목' ? '이상은 높지만 돈 버는 건 관심 밖입니다. 현실 감각을 키워야 합니다.' : ilOh === '화' ? '열정적으로 일하지만 돈이 남지 않습니다. 수입/지출 관리를 반드시 배우세요.' : '의식적으로 재테크를 공부하고, 돈 관련 습관을 만드세요.'}\n`;
    } else {
      psychology += `재성(財星) 부재: 현실 감각이 약하고 돈에 무관심한 편입니다. ${ilOh === '수' ? '감성적이라 충동 소비가 많을 수 있습니다. 가계부를 쓰는 습관이 큰 도움이 됩니다.' : '재물 관리를 의식적으로 배워야 합니다.'} 아버지와의 인연이 약할 수 있지만, 스스로 경제력을 키우면 충분히 풍요로워집니다.\n`;
    }
  }
  if (lacking.includes('관성')) {
    if (isMale) {
      psychology += `관성(官星) 부재: 자유로운 영혼이라 조직에 소속되는 걸 싫어합니다. ${ilOh === '화' ? '뜨거운 성격이라 위계질서를 못 견딥니다. 프리랜서나 창업이 더 맞습니다.' : ilOh === '목' ? '독립적 성향이 강해 자기 사업을 하면 크게 성공할 수 있습니다.' : '규율보다 자율에서 능력을 발휘합니다. 프리랜서, 자영업, 예술 분야를 고려하세요.'}\n`;
    } else {
      psychology += `관성(官星) 부재: 여자에게 관성은 남편을 뜻하므로, 결혼이 늦거나 남자 인연이 약할 수 있습니다. ${ilOh === '화' ? '자유분방한 성격이라 구속을 싫어합니다. 본인의 자유를 존중해주는 파트너를 찾으세요.' : '하지만 스스로 강한 독립심이 있어 혼자서도 충분히 잘 사는 타입입니다.'} 자기 관리와 규칙적 생활을 의식적으로 해야 더 좋은 기회가 옵니다.\n`;
    }
  }
  if (lacking.includes('인성')) {
    psychology += `인성(印星) 부재: ${ilOh === '목' ? '나무에 물이 부족하듯 배움의 기회가 적었을 수 있습니다. 하지만 독학으로 성공하는 타입입니다.' : ilOh === '금' ? '분석력은 타고났지만 학문적 뒷받침이 약합니다. 독서와 자기 공부가 큰 무기가 됩니다.' : '어머니의 도움이 부족하거나 학업에서 고생할 수 있습니다.'} 스스로 배우고 경험으로 익히는 실전형 인재입니다. 자격증이나 학벌보다 실무 능력이 진짜 무기입니다.\n`;
  }

  if (!psychology) {
    psychology = `${ilOhName ? ilOhName + ' 기운의 ' : ''}오행과 십성의 분포가 비교적 균형 잡혀 있어, 극단적인 편향 없이 안정적인 성향을 보입니다. 균형 잡힌 사주는 어떤 환경에서든 적응력이 뛰어납니다.`;
  }

  return { excess, lacking, psychology };
}

// 오행 상생 관계
export const OHAENG_SANGSAENG: Record<Ohaeng, Ohaeng> = {
  '목': '화', // 목생화
  '화': '토', // 화생토
  '토': '금', // 토생금
  '금': '수', // 금생수
  '수': '목', // 수생목
};

// 오행 상극 관계
export const OHAENG_SANGGEUK: Record<Ohaeng, Ohaeng> = {
  '목': '토', // 목극토
  '토': '수', // 토극수
  '수': '화', // 수극화
  '화': '금', // 화극금
  '금': '목', // 금극목
};

// 오행 색상 매핑
export const OHAENG_COLOR: Record<Ohaeng, string> = {
  '목': '#22c55e', // 초록
  '화': '#ef4444', // 빨강
  '토': '#eab308', // 노랑
  '금': '#f8fafc', // 흰색
  '수': '#3b82f6', // 파랑
};

// ========== 십성 (十星) ==========
export type Sipseong = '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

// 십성 계산: 일간 기준으로 다른 천간과의 관계
export function calculateSipseong(ilgan: string, target: string): Sipseong {
  const ilOhaeng = CHEONGAN_OHAENG[ilgan];
  const targetOhaeng = CHEONGAN_OHAENG[target];
  const ilEumyang = CHEONGAN_EUMYANG[ilgan];
  const targetEumyang = CHEONGAN_EUMYANG[target];
  const sameEumyang = ilEumyang === targetEumyang;

  if (ilOhaeng === targetOhaeng) {
    return sameEumyang ? '비견' : '겁재';
  }
  if (OHAENG_SANGSAENG[ilOhaeng] === targetOhaeng) {
    return sameEumyang ? '식신' : '상관';
  }
  if (OHAENG_SANGGEUK[ilOhaeng] === targetOhaeng) {
    return sameEumyang ? '편재' : '정재';
  }
  if (OHAENG_SANGGEUK[targetOhaeng] === ilOhaeng) {
    return sameEumyang ? '편관' : '정관';
  }
  // 생아 (나를 생하는 것)
  return sameEumyang ? '편인' : '정인';
}

// ========== 육친 (六親) — 십신을 구체적 인물 관계로 매핑 ==========
// 십신 = 추상적 기운(심리·성향), 육친 = 구체적 인물(부모·형제·배우자·자녀)

export type Gender = '남' | '여';

export interface YukChinRelation {
  male: string;   // 남성 기준 육친
  female: string; // 여성 기준 육친
}

/** 십신 → 육친 매핑 (남녀 기준 다름) */
export const SIPSEONG_TO_YUKCHIN: Record<Sipseong, YukChinRelation> = {
  '비견': { male: '형제·친구·동료', female: '자매·친구·동료' },
  '겁재': { male: '이복형제·경쟁자', female: '이복자매·경쟁자' },
  '식신': { male: '장인·장모', female: '자녀(딸)' },          // 편(같은 성별): 여→딸
  '상관': { male: '외조모', female: '자녀(아들)' },            // 정(다른 성별): 여→아들
  '편재': { male: '아버지·애인', female: '아버지' },           // 남녀 공통 아버지
  '정재': { male: '아내·재물', female: '재물' },               // 여성에게는 직접적 가족 아님
  '편관': { male: '자녀(아들)', female: '연인·재혼상대' },     // 편(같은 성별): 남→아들
  '정관': { male: '자녀(딸)·상사', female: '남편·직장상사' },  // 정(다른 성별): 남→딸
  '편인': { male: '계모·의부·스승', female: '계모·의부·스승' },
  '정인': { male: '어머니·조부모', female: '어머니·조부모' },
};

/** 십신을 육친 인물로 변환 */
export function getYukChin(sipseong: Sipseong, gender: Gender): string {
  const relation = SIPSEONG_TO_YUKCHIN[sipseong];
  return gender === '남' ? relation.male : relation.female;
}

// ========== 월지 십신 5그룹 — 타고난 본성 (생극제화 원리) ==========

export type SipseongGroup = '비겁' | '식상' | '재성' | '관성' | '인성';

export interface MonthJiGroupInfo {
  group: SipseongGroup;
  formation: string;    // 생극제화 원리
  personality: string;  // 타고난 본성 설명
}

/** 십신 → 5그룹 분류 */
export function getSipseongGroup(sipseong: Sipseong): SipseongGroup {
  if (sipseong === '비견' || sipseong === '겁재') return '비겁';
  if (sipseong === '식신' || sipseong === '상관') return '식상';
  if (sipseong === '편재' || sipseong === '정재') return '재성';
  if (sipseong === '편관' || sipseong === '정관') return '관성';
  return '인성';
}

/** 월지 십신 5그룹별 타고난 본성 설명 */
export const MONTH_JI_GROUP_INFO: Record<SipseongGroup, MonthJiGroupInfo> = {
  '비겁': {
    group: '비겁',
    formation: '월지가 일간과 같은 오행',
    personality: '주체성·독립심이 매우 강하고, 타인과 평등하게 어울리려 하지만 지기 싫어하는 강한 고집도 있어요.',
  },
  '식상': {
    group: '식상',
    formation: '일간이 월지를 생(生)해주는 관계',
    personality: '감성과 융통성이 발달해 낙천적이고 창의적이에요. 언변과 표현력이 뛰어나 주변을 즐겁게 해요.',
  },
  '재성': {
    group: '재성',
    formation: '일간이 월지를 극(剋)하는 관계',
    personality: '현실 감각이 강하고 목표를 쟁취하려는 추진력이 있어요. 치밀하고 성과·효율을 중시해요.',
  },
  '관성': {
    group: '관성',
    formation: '월지가 일간을 극(剋)하는 관계',
    personality: '원리원칙과 책임감을 중시하고, 조직에 잘 적응해요. 명예욕이 있고 바른 생활을 지향해요.',
  },
  '인성': {
    group: '인성',
    formation: '월지가 일간을 생(生)해주는 관계',
    personality: '수용성이 강하고 사려 깊어요. 학문적이고 직관·이성적 사고를 하며, 어른을 잘 모셔요.',
  },
};

// ========== 절기 기반 월주 계산 데이터 ==========

// 24절기 (양력 기준) - 월건 결정에 사용
// 월 순서대로 정렬 (1월~12월) — getMonthJijiIndex에서 올바르게 탐색하기 위함
//
// 아래는 절기의 "기본값(fallback)"이며, JEOLGI_PRECISE 데이터에 없는 연도에만 사용됩니다.
// 1940~2030년은 JEOLGI_PRECISE에서 연도별 정확한 절기일을 참조합니다.
const JEOLGI_DATES: Array<{ month: number; day: number; name: string; monthJiji: number }> = [
  { month: 1, day: 6, name: '소한', monthJiji: 1 },    // 축월 시작
  { month: 2, day: 4, name: '입춘', monthJiji: 2 },   // 인월 시작
  { month: 3, day: 6, name: '경칩', monthJiji: 3 },   // 묘월 시작
  { month: 4, day: 5, name: '청명', monthJiji: 4 },   // 진월 시작
  { month: 5, day: 6, name: '입하', monthJiji: 5 },   // 사월 시작
  { month: 6, day: 6, name: '망종', monthJiji: 6 },   // 오월 시작
  { month: 7, day: 7, name: '소서', monthJiji: 7 },   // 미월 시작
  { month: 8, day: 7, name: '입추', monthJiji: 8 },   // 신월 시작
  { month: 9, day: 8, name: '백로', monthJiji: 9 },   // 유월 시작
  { month: 10, day: 8, name: '한로', monthJiji: 10 },  // 술월 시작
  { month: 11, day: 7, name: '입동', monthJiji: 11 },  // 해월 시작
  { month: 12, day: 7, name: '대설', monthJiji: 0 },   // 자월 시작
];

// 연도별 입춘 정밀 시각 (한국천문연구원 기준)
// { day, hour, minute } — 분 단위까지 비교하여 연주/월주 결정
const IPCHUN_PRECISE: Record<number, { day: number; hour: number; minute: number }> = {
  // 1927~1939: 입춘일만 확인 (시/분은 미확보, day 단위 비교)
  1927: { day: 5, hour: 0, minute: 0 }, 1928: { day: 5, hour: 0, minute: 0 },
  1929: { day: 4, hour: 0, minute: 0 }, 1930: { day: 4, hour: 0, minute: 0 },
  1931: { day: 5, hour: 0, minute: 0 }, 1932: { day: 5, hour: 0, minute: 0 },
  1933: { day: 4, hour: 0, minute: 0 }, 1934: { day: 4, hour: 0, minute: 0 },
  1935: { day: 5, hour: 0, minute: 0 }, 1936: { day: 5, hour: 0, minute: 0 },
  1937: { day: 4, hour: 0, minute: 0 }, 1938: { day: 4, hour: 0, minute: 0 },
  1939: { day: 5, hour: 0, minute: 0 },
  // 1940~: 시/분 정밀 데이터 (한국천문연구원 기준)
  1940: { day: 5, hour: 2, minute: 8 }, 1941: { day: 4, hour: 7, minute: 50 },
  1942: { day: 4, hour: 13, minute: 48 }, 1943: { day: 4, hour: 19, minute: 40 },
  1944: { day: 5, hour: 1, minute: 23 }, 1945: { day: 4, hour: 7, minute: 20 },
  1946: { day: 4, hour: 13, minute: 4 }, 1947: { day: 4, hour: 18, minute: 52 },
  1948: { day: 5, hour: 0, minute: 43 }, 1949: { day: 4, hour: 6, minute: 22 },
  1950: { day: 4, hour: 12, minute: 21 }, 1951: { day: 4, hour: 18, minute: 14 },
  1952: { day: 5, hour: 0, minute: 1 }, 1953: { day: 4, hour: 5, minute: 46 },
  1954: { day: 4, hour: 11, minute: 31 }, 1955: { day: 4, hour: 17, minute: 18 },
  1956: { day: 4, hour: 23, minute: 13 }, 1957: { day: 4, hour: 4, minute: 55 },
  1958: { day: 4, hour: 10, minute: 50 }, 1959: { day: 4, hour: 16, minute: 43 },
  1960: { day: 4, hour: 22, minute: 23 }, 1961: { day: 4, hour: 4, minute: 4 },
  1962: { day: 4, hour: 9, minute: 58 }, 1963: { day: 4, hour: 15, minute: 45 },
  1964: { day: 4, hour: 21, minute: 5 }, 1965: { day: 4, hour: 3, minute: 2 },
  1966: { day: 4, hour: 8, minute: 38 }, 1967: { day: 4, hour: 14, minute: 31 },
  1968: { day: 4, hour: 20, minute: 8 }, 1969: { day: 4, hour: 1, minute: 59 },
  1970: { day: 4, hour: 7, minute: 46 }, 1971: { day: 4, hour: 13, minute: 26 },
  1972: { day: 4, hour: 19, minute: 20 }, 1973: { day: 4, hour: 1, minute: 4 },
  1974: { day: 4, hour: 6, minute: 59 }, 1975: { day: 4, hour: 12, minute: 59 },
  1976: { day: 4, hour: 18, minute: 40 }, 1977: { day: 4, hour: 0, minute: 34 },
  1978: { day: 4, hour: 6, minute: 27 }, 1979: { day: 4, hour: 12, minute: 13 },
  1980: { day: 4, hour: 17, minute: 51 }, 1981: { day: 3, hour: 23, minute: 44 },
  1982: { day: 4, hour: 5, minute: 46 }, 1983: { day: 4, hour: 11, minute: 40 },
  1984: { day: 4, hour: 17, minute: 19 }, 1985: { day: 3, hour: 23, minute: 12 },
  1986: { day: 4, hour: 5, minute: 8 }, 1987: { day: 4, hour: 10, minute: 52 },
  1988: { day: 4, hour: 16, minute: 43 }, 1989: { day: 3, hour: 22, minute: 27 },
  1990: { day: 4, hour: 4, minute: 14 }, 1991: { day: 4, hour: 10, minute: 8 },
  1992: { day: 4, hour: 15, minute: 48 }, 1993: { day: 3, hour: 21, minute: 38 },
  1994: { day: 4, hour: 3, minute: 31 }, 1995: { day: 4, hour: 9, minute: 14 },
  1996: { day: 4, hour: 15, minute: 8 }, 1997: { day: 3, hour: 20, minute: 52 },
  1998: { day: 4, hour: 2, minute: 57 }, 1999: { day: 4, hour: 8, minute: 57 },
  2000: { day: 4, hour: 14, minute: 32 }, 2001: { day: 3, hour: 20, minute: 29 },
  2002: { day: 4, hour: 2, minute: 24 }, 2003: { day: 4, hour: 8, minute: 5 },
  2004: { day: 4, hour: 13, minute: 56 }, 2005: { day: 3, hour: 19, minute: 43 },
  2006: { day: 4, hour: 1, minute: 27 }, 2007: { day: 4, hour: 7, minute: 18 },
  2008: { day: 4, hour: 13, minute: 0 }, 2009: { day: 3, hour: 18, minute: 50 },
  2010: { day: 4, hour: 0, minute: 47 }, 2011: { day: 4, hour: 6, minute: 33 },
  2012: { day: 4, hour: 12, minute: 22 }, 2013: { day: 3, hour: 18, minute: 13 },
  2014: { day: 4, hour: 0, minute: 3 }, 2015: { day: 4, hour: 5, minute: 58 },
  2016: { day: 4, hour: 11, minute: 46 }, 2017: { day: 3, hour: 17, minute: 34 },
  2018: { day: 3, hour: 23, minute: 28 }, 2019: { day: 4, hour: 5, minute: 14 },
  2020: { day: 4, hour: 11, minute: 3 }, 2021: { day: 3, hour: 16, minute: 59 },
  2022: { day: 3, hour: 22, minute: 51 }, 2023: { day: 4, hour: 4, minute: 43 },
  2024: { day: 4, hour: 10, minute: 27 }, 2025: { day: 3, hour: 16, minute: 10 },
  2026: { day: 3, hour: 22, minute: 2 }, 2027: { day: 4, hour: 3, minute: 46 },
  2028: { day: 4, hour: 9, minute: 30 }, 2029: { day: 3, hour: 15, minute: 20 },
  2030: { day: 4, hour: 21, minute: 8 },
};

// 연도별 정밀 절기일 (sxtwl 寿星天文历 기반 생성, 입춘 제외)
// 입춘은 IPCHUN_PRECISE에서 시/분 단위로 별도 관리
const JEOLGI_PRECISE: Record<number, Record<string, number>> = {
  1927: { '소한': 6, '경칩': 6, '청명': 6, '입하': 6, '망종': 7, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1928: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1929: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1930: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1931: { '소한': 6, '경칩': 6, '청명': 6, '입하': 6, '망종': 7, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1932: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1933: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1934: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1935: { '소한': 6, '경칩': 6, '청명': 6, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1936: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1937: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1938: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1939: { '소한': 6, '경칩': 6, '청명': 6, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1940: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1941: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1942: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1943: { '소한': 6, '경칩': 6, '청명': 6, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1944: { '소한': 6, '경칩': 6, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1945: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1946: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1947: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1948: { '소한': 6, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1949: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1950: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1951: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1952: { '소한': 6, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1953: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1954: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1955: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1956: { '소한': 6, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1957: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1958: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1959: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1960: { '소한': 6, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1961: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1962: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1963: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1964: { '소한': 6, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1965: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1966: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1967: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1968: { '소한': 6, '경칩': 5, '청명': 5, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1969: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1970: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1971: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1972: { '소한': 6, '경칩': 5, '청명': 5, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1973: { '소한': 5, '경칩': 6, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1974: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1975: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1976: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1977: { '소한': 5, '경칩': 6, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1978: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1979: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1980: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1981: { '소한': 5, '경칩': 6, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1982: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1983: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 8, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 8 },
  1984: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1985: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1986: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1987: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1988: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1989: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1990: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  1991: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1992: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1993: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1994: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1995: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  1996: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1997: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  1998: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  1999: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  2000: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2001: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2002: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  2003: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  2004: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2005: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2006: { '소한': 5, '경칩': 6, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  2007: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 9, '입동': 8, '대설': 7 },
  2008: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2009: { '소한': 5, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2010: { '소한': 5, '경칩': 6, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  2011: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  2012: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2013: { '소한': 5, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2014: { '소한': 5, '경칩': 6, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  2015: { '소한': 6, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  2016: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2017: { '소한': 5, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2018: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  2019: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  2020: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 6, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2021: { '소한': 5, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2022: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 6, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2023: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 8, '대설': 7 },
  2024: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 6, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 6 },
  2025: { '소한': 5, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2026: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2027: { '소한': 5, '경칩': 6, '청명': 5, '입하': 6, '망종': 6, '소서': 7, '입추': 8, '백로': 8, '한로': 8, '입동': 7, '대설': 7 },
  2028: { '소한': 6, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 6, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 6 },
  2029: { '소한': 5, '경칩': 5, '청명': 4, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
  2030: { '소한': 5, '경칩': 5, '청명': 5, '입하': 5, '망종': 5, '소서': 7, '입추': 7, '백로': 7, '한로': 8, '입동': 7, '대설': 7 },
};

// JEOLGI_YEARLY: JEOLGI_PRECISE + IPCHUN_PRECISE 통합
const JEOLGI_YEARLY: Record<number, Partial<Record<string, number>>> = {};
for (const [yr, data] of Object.entries(JEOLGI_PRECISE)) {
  JEOLGI_YEARLY[Number(yr)] = { ...data };
}
for (const [yr, data] of Object.entries(IPCHUN_PRECISE)) {
  if (!JEOLGI_YEARLY[Number(yr)]) JEOLGI_YEARLY[Number(yr)] = {};
  JEOLGI_YEARLY[Number(yr)]!['입춘'] = data.day;
}

// ========== 연주 계산 ==========

/**
 * 해당 연도의 절기 날짜 반환 (연도별 보정 적용)
 */
function getJeolgiDay(year: number, name: string, defaultDay: number): number {
  const yearData = JEOLGI_YEARLY[year];
  if (yearData && yearData[name] !== undefined) {
    return yearData[name]!;
  }
  return defaultDay;
}

/**
 * 연주(년간지) 계산
 * 기준: 갑자년 = 서기 4년 (또는 1984년)
 * 입춘 기준으로 해가 바뀜 — 분 단위 정밀 비교
 */
export function calculateYearPillar(year: number, month: number, day: number, hour: number = 0, minute: number = 0): { cheongan: string; jiji: string } {
  // 입춘 시각 정밀 비교
  const ipchun = IPCHUN_PRECISE[year];
  let beforeIpchun = false;

  if (ipchun) {
    // 분 단위 비교: 출생일시 < 입춘 시각이면 전년도
    if (month < 2) {
      beforeIpchun = true;
    } else if (month === 2) {
      if (day < ipchun.day) {
        beforeIpchun = true;
      } else if (day === ipchun.day) {
        // 같은 날이면 시:분 비교
        const birthMinutes = hour * 60 + minute;
        const ipchunMinutes = ipchun.hour * 60 + ipchun.minute;
        if (birthMinutes < ipchunMinutes) {
          beforeIpchun = true;
        }
      }
    }
  } else {
    // 정밀 데이터 없으면 기본값 2/4 사용
    const ipchunDay = getJeolgiDay(year, '입춘', 4);
    if (month < 2 || (month === 2 && day < ipchunDay)) {
      beforeIpchun = true;
    }
  }

  let adjustedYear = year;
  if (beforeIpchun) {
    adjustedYear = year - 1;
  }

  const ganIndex = (adjustedYear - 4) % 10;
  const jiIndex = (adjustedYear - 4) % 12;

  return {
    cheongan: CHEONGAN[(ganIndex + 10) % 10],
    jiji: JIJI[(jiIndex + 12) % 12],
  };
}

// ========== 월주 계산 ==========

/**
 * 절기 기반 월의 지지 인덱스 계산 (연도별 보정 적용)
 */
function getMonthJijiIndex(month: number, day: number, year?: number): number {
  // 연도별 보정된 절기 날짜로 배열 생성
  const boundaries = JEOLGI_DATES.map(j => ({
    ...j,
    day: year ? getJeolgiDay(year, j.name, j.day) : j.day,
  }));

  // 배열이 1월~12월 순서로 정렬되어 있으므로 역순 탐색
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const b = boundaries[i];
    if (month > b.month || (month === b.month && day >= b.day)) {
      return b.monthJiji;
    }
  }

  // 1월 소한 이전 → 전년 대설 이후 = 자월(0)
  return 0;
}

/**
 * 월주 계산
 * 연간에 따른 월간 결정 (년간오호법)
 */
export function calculateMonthPillar(yearCheongan: typeof CHEONGAN[number] | string, month: number, day: number, year?: number): { cheongan: string; jiji: string } {
  const monthJijiIdx = getMonthJijiIndex(month, day, year);
  const jiji = JIJI[monthJijiIdx];

  // 년간오호법 (年干五虎法)
  // 갑기년 → 병인월 시작, 을경년 → 무인월 시작, 병신년 → 경인월 시작
  // 정임년 → 임인월 시작, 무계년 → 갑인월 시작
  const yearGanIdx = CHEONGAN.indexOf(yearCheongan as typeof CHEONGAN[number]);
  const yearGanGroup = yearGanIdx % 5;
  const startGanCorrect: Record<number, number> = {
    0: 2,  // 갑/기 → 병인월 시작
    1: 4,  // 을/경 → 무인월 시작
    2: 6,  // 병/신 → 경인월 시작
    3: 8,  // 정/임 → 임인월 시작
    4: 0,  // 무/계 → 갑인월 시작
  };

  // 인월(2)부터 시작하므로, 해당 월까지의 오프셋
  const inWolIdx = 2; // 인월 = 지지 인덱스 2
  let offset = monthJijiIdx - inWolIdx;
  if (offset < 0) offset += 12;

  const monthGanIdx = (startGanCorrect[yearGanGroup] + offset) % 10;

  return {
    cheongan: CHEONGAN[monthGanIdx],
    jiji,
  };
}

// ========== 일주 계산 ==========

/**
 * 일주 계산 (양력 날짜 → 간지)
 * JDN(율리우스 일수) 기반 정밀 계산
 * 검증: 2024-02-10 = 갑자일, 2000-01-01 = 무인일
 */
export function calculateDayPillar(year: number, month: number, day: number): { cheongan: string; jiji: string } {
  // JDN(율리우스 일수) 기반 정밀 일주 계산
  // 검증완료 (sxtwl 寿星天文历 교차검증):
  // 1975-08-26=갑진, 2024-02-10=갑진, 2000-01-01=무오, 2024-01-01=갑자, 1975-12-25=을사
  const jdn = toJulianDayNumber(year, month, day);

  // 60간지 인덱스 계산 (오프셋 49, sxtwl 라이브러리로 검증)
  const ganjiIndex = ((jdn + 49) % 60 + 60) % 60;
  const ganIndex = ganjiIndex % 10;
  const jiIndex = ganjiIndex % 12;

  return {
    cheongan: CHEONGAN[ganIndex],
    jiji: JIJI[jiIndex],
  };
}

/**
 * 율리우스 일수 (Julian Day Number) 계산
 * 천문학 표준 - 날짜를 연속 일수로 변환
 */
function toJulianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

// ========== 시주 계산 ==========

/**
 * 시주 계산
 * 일간오서법 (日干五鼠法)으로 시간의 천간 결정
 * 태어난 시간을 그대로 적용 (별도 보정 없음)
 * 자시=23:00~00:59, 축시=01:00~02:59, ...
 * minute 파라미터로 분 단위 정밀 계산 가능
 */
export function calculateHourPillar(dayCheongan: typeof CHEONGAN[number] | string, hour: number, minute: number = 0, skipKstCorrection: boolean = false): { cheongan: string; jiji: string; isYajasi: boolean } {
  // 태어난 시간 그대로 사용 (보정 없음)
  const correctedHour = hour;
  const correctedMin = minute;

  // 시진(지지) 결정
  // 자시: 23:00~00:59
  // 축시: 01:00~02:59
  // ...
  let jijiIdx: number;
  if (correctedHour >= 23 || correctedHour < 1) jijiIdx = 0;      // 자시
  else if (correctedHour >= 1 && correctedHour < 3) jijiIdx = 1;  // 축시
  else if (correctedHour >= 3 && correctedHour < 5) jijiIdx = 2;  // 인시
  else if (correctedHour >= 5 && correctedHour < 7) jijiIdx = 3;  // 묘시
  else if (correctedHour >= 7 && correctedHour < 9) jijiIdx = 4;  // 진시
  else if (correctedHour >= 9 && correctedHour < 11) jijiIdx = 5; // 사시
  else if (correctedHour >= 11 && correctedHour < 13) jijiIdx = 6;// 오시
  else if (correctedHour >= 13 && correctedHour < 15) jijiIdx = 7;// 미시
  else if (correctedHour >= 15 && correctedHour < 17) jijiIdx = 8;// 신시
  else if (correctedHour >= 17 && correctedHour < 19) jijiIdx = 9;// 유시
  else if (correctedHour >= 19 && correctedHour < 21) jijiIdx = 10;// 술시
  else jijiIdx = 11;                                                // 해시

  // 야자시 판별: 보정 전 원래 시각이 23시~0시 사이이면 야자시
  // (야자시: 밤 11시~자정, 일주를 당일로 유지하는 옵션)
  const isYajasi = jijiIdx === 0 && hour >= 23;

  // 일간오서법
  const dayGanIdx = CHEONGAN.indexOf(dayCheongan as typeof CHEONGAN[number]);
  const dayGanGroup = dayGanIdx % 5;
  const startGan: Record<number, number> = {
    0: 0,  // 갑/기일 → 갑자시 시작
    1: 2,  // 을/경일 → 병자시 시작
    2: 4,  // 병/신일 → 무자시 시작
    3: 6,  // 정/임일 → 경자시 시작
    4: 8,  // 무/계일 → 임자시 시작
  };

  const hourGanIdx = (startGan[dayGanGroup] + jijiIdx) % 10;

  return {
    cheongan: CHEONGAN[hourGanIdx],
    jiji: JIJI[jijiIdx],
    isYajasi,
  };
}

// ========== 사주 팔자 전체 계산 ==========

export interface SajuPillar {
  cheongan: string;
  jiji: string;
  cheonganOhaeng: Ohaeng;
  jijiOhaeng: Ohaeng;
  cheonganEumyang: '양' | '음';
}

export interface SajuResult {
  // 사주 네 기둥
  year: SajuPillar;    // 연주
  month: SajuPillar;   // 월주
  day: SajuPillar;     // 일주 (일간 = 나 자신)
  hour: SajuPillar;    // 시주

  // 분석 결과
  ilgan: string;       // 일간 (나를 대표하는 천간)
  ohaengBalance: Record<Ohaeng, number>;  // 오행 분포
  dominantOhaeng: Ohaeng;    // 가장 강한 오행
  weakestOhaeng: Ohaeng;     // 가장 약한 오행
  yongsin: Ohaeng;           // 용신 (필요한 오행)
  gisin: Ohaeng;             // 기신 (피해야 할 오행)
  sipseongs: { year: Sipseong; month: Sipseong; hour: Sipseong };
  sipseongBalance: { excess: string[]; lacking: string[]; psychology: string }; // 십신 불균형 심리 분석
  jangganSipseongs: { jiji: string; saryeong: string; sipseong: Sipseong }[]; // 지장간 사령 십성
  saryeongAnalysis: {
    saryeongGan: string;           // 정밀 사령 천간
    monthSipseong: string;         // 월지 본기 십신 (겉)
    saryeongSipseong: string;      // 사령 십신 (속)
    outerInnerAnalysis: string;    // 겉과 속 대비 분석
    isTouchul: boolean;            // 투출 여부
    touchulAnalysis: string;       // 투출 분석 텍스트
    gyeomgyeokAnalysis?: string;    // 겸격 분석 (다중 투출)
  };
  animal: string;            // 띠
  description: string;       // 일간 기본 성격
  iljuDesc: string;          // 일주 조합 해석
  interactions?: {             // 천간합/지지합충 분석
    cheonganHaps: string[];
    jijiYukhaps: string[];
    jijiChungs: string[];
    jijiSamhaps: string[];
    summary: string;
  };
  hourInfo: { name: string; hanja: string; time: string; meaning: string }; // 시주 정보
  gender: 'male' | 'female';
  relationship: 'single' | 'dating' | 'married';
  hasChildren: boolean;      // 자녀 유무
  age: number;               // 한국 나이 (만 나이 아님)
  isYajasi: boolean;         // 야자시 여부
  isTimeUnknown?: boolean;   // 시간 모름 여부
  warnings?: string[];       // 정밀도 관련 경고 메시지
  strengthScore?: number;    // 신강/신약 종합 점수 (득령+득지+득세, 100점 만점)
}

function makePillar(cheongan: string, jiji: string): SajuPillar {
  return {
    cheongan,
    jiji,
    cheonganOhaeng: CHEONGAN_OHAENG[cheongan],
    jijiOhaeng: JIJI_OHAENG[jiji],
    cheonganEumyang: CHEONGAN_EUMYANG[cheongan],
  };
}

// 일간별 기본 성격
const ILGAN_DESCRIPTION: Record<string, string> = {
  '갑': '우뚝 솟은 거목(甲木)의 기상을 타고났습니다. 하늘을 향해 곧게 뻗어나가려는 기질 덕분에 불의와 타협하지 않는 올곧은 성품을 지녔으며, 무리 안에서 자연스럽게 리더십을 발휘하게 됩니다. 때로는 남에게 굽히기 싫어하는 자존심이 앞설 수 있지만, 개척자로서 새로운 길을 여는 데 탁월한 능력을 자랑합니다.',
  '을': '바람에 부드럽게 흔들리면서도 결코 꺾이지 않는 덩굴풀(乙木)의 생명력을 가졌습니다. 어떤 척박한 환경에 떨어져도 살아남는 눈부신 적응력과 끈기가 가장 큰 무기입니다. 인간관계에서는 특유의 유연함과 사교성으로 사람들의 마음을 쉽게 열며, 뛰어난 미적 감각과 눈썰미를 지녔습니다.',
  '병': '세상을 환하게 비추는 한낮의 태양(丙火)처럼 막강한 존재감을 내뿜습니다. 숨기는 것 없이 솔직하고 뒤끝 없는 호탕한 성격으로 만인의 주목을 받는 스타일입니다. 불의를 보면 참지 못하는 대담함과 넘치는 열정을 가졌기에 어딜 가든 분위기 메이커 역할을 톡톡히 해냅니다.',
  '정': '은은하게 주변을 밝히는 호롱불이나 별빛(丁火) 같은 따뜻한 심성의 소유자입니다. 강렬하게 폭발하기보다는 내면의 열정을 고요하고 끈기 있게 태우는 외유내강형입니다. 직관력이 비상하며 타인의 아픔에 깊이 다가가는 섬세한 배려심으로 주변 사람들에게 정신적 위안을 줍니다.',
  '무': '모든 생명을 묵묵히 품어내는 광활한 대지와 큰 산(戊土)의 기운을 담았습니다. 쉽게 속을 드러내지 않는 진중함과 넓은 포용력으로 타인에게 굳건한 신뢰감을 줍니다. 어떤 시련에도 쉽게 흔들리지 않는 뚝심이 있으며, 사람과 사람 사이를 조율하는 중재자 역할에 매우 탁월합니다.',
  '기': '알맞게 물기를 머금어 씨앗을 키워내는 비옥한 논밭(己土)과 같습니다. 어머니처럼 사람을 품어주고 보살피는 온화한 수용력이 엄청난 무기입니다. 실무에 매우 강하고 꼼꼼하며 주변 환경을 잘 정돈하는 기질이 뛰어나, 겉보기엔 부드러워 보여도 결심한 목표는 무조건 이뤄내는 끈기가 있습니다.',
  '경': '아직 제련되지 않은 거친 무쇠나 웅장한 바위산(庚金)의 숙살지기를 품고 있습니다. 시시비비가 명확하고 한 번 내뱉은 말은 반드시 지켜내는 굳센 의리와 결단력의 소유자입니다. 불의와 타협하지 않는 대쪽 같은 성품 덕에 강한 카리스마를 발휘하며, 역경을 두려워하지 않는 투사적 기질이 있습니다.',
  '신': '오랜 인고 끝에 섬세하게 세공된 보석(辛金)처럼 날카로운 지성과 완벽주의를 추구합니다. 호불호가 매우 뚜렷하며, 정밀하고 매서운 통찰력으로 상황의 본질을 단번에 꿰뚫어 봅니다. 타고난 심미안과 자존심 덕에 어느 분야에서든 최고 수준의 세련된 결과물을 만들어내는 프로페셔널입니다.',
  '임': '도도하게 흐르는 거대한 강물이나 넓은 바다(壬水)를 닮은 어마어마한 스케일의 소유자입니다. 모든 강물을 품어 바다가 되듯 포용력이 넓고 융통성이 타의 추종을 불허합니다. 틀에 얽매이는 것을 극도로 싫어하는 자유로운 영혼이며, 비상한 두뇌와 기발한 창의력으로 세상을 넓게 봅니다.',
  '계': '만물을 조용히 적셔 생명수를 공급하는 봄비나 이슬(癸水)의 기운입니다. 겉모습은 무척 고요하고 차분해 보이지만, 바위도 뚫어내는 물방울처럼 집요한 인내심과 막강한 잠재력을 지녔습니다. 타인의 감정을 읽어내는 직감과 영감이 매우 뛰어나며, 학문이나 기획 분야에서 천재적인 소질을 보입니다.',
};

// 시(時) 이름 매핑
const HOUR_NAME: Record<number, { name: string; hanja: string; time: string; meaning: string }> = {
  0: { name: '자시', hanja: '子時', time: '23:00~01:00', meaning: '한밤중의 고요한 기운. 깊은 사색과 직관이 강한 시간에 태어났습니다.' },
  1: { name: '축시', hanja: '丑時', time: '01:00~03:00', meaning: '새벽의 차분한 기운. 끈기와 인내심이 남다른 시간에 태어났습니다.' },
  2: { name: '인시', hanja: '寅時', time: '03:00~05:00', meaning: '동이 트기 전 호랑이의 기운. 새로운 시작의 에너지가 강합니다.' },
  3: { name: '묘시', hanja: '卯時', time: '05:00~07:00', meaning: '해가 뜨는 시간의 기운. 활발하고 사교적인 성격이 부여됩니다.' },
  4: { name: '진시', hanja: '辰時', time: '07:00~09:00', meaning: '용의 기운이 깃든 시간. 야망과 리더십이 부여됩니다.' },
  5: { name: '사시', hanja: '巳時', time: '09:00~11:00', meaning: '뱀의 지혜로운 기운. 분석력과 전략적 사고가 뛰어납니다.' },
  6: { name: '오시', hanja: '午時', time: '11:00~13:00', meaning: '정오의 강렬한 기운. 열정과 행동력이 가장 강한 시간입니다.' },
  7: { name: '미시', hanja: '未時', time: '13:00~15:00', meaning: '오후의 부드러운 기운. 예술적 감성과 배려심이 깊습니다.' },
  8: { name: '신시', hanja: '申時', time: '15:00~17:00', meaning: '원숭이의 영민한 기운. 재치와 순발력이 뛰어납니다.' },
  9: { name: '유시', hanja: '酉時', time: '17:00~19:00', meaning: '석양의 정돈된 기운. 심미안과 완벽주의 성향이 부여됩니다.' },
  10: { name: '술시', hanja: '戌時', time: '19:00~21:00', meaning: '충견의 의리 있는 기운. 신뢰감과 책임감이 강합니다.' },
  11: { name: '해시', hanja: '亥時', time: '21:00~23:00', meaning: '밤의 포용적인 기운. 포용력과 직관력이 뛰어납니다.' },
};

// 일주(日柱) 조합별 상세 해석 — 일간+일지 조합
const ILJU_COMBINATION: Record<string, string> = {
  // 갑(甲) 일간
  '갑자': '갑자일주는 큰 나무가 물 위에 서있는 형상입니다. 지혜롭고 계획적이며 학문에 재능이 있습니다. 머리가 명석하고 전략적 사고가 뛰어납니다.',
  '갑인': '갑인일주는 큰 나무가 숲에 뿌리내린 형상입니다. 자수성가형으로 독립심이 매우 강합니다. 리더십이 탁월하지만 고집도 셉니다.',
  '갑진': '갑진일주는 큰 나무가 산에 서있는 형상입니다. 야망이 크고 성취욕이 강합니다. 귀인의 도움을 잘 받는 운이 있습니다.',
  '갑오': '갑인일주는 나무에 불이 붙은 형상입니다. 열정적이고 표현력이 풍부합니다. 예술적 재능이 있으며 화려한 삶을 추구합니다.',
  '갑신': '갑신일주는 나무가 도끼를 만난 형상입니다. 시련을 통해 강해지는 타입입니다. 역경을 이겨내는 강인함이 있습니다.',
  '갑술': '갑술일주는 큰 나무가 건조한 땅에 선 형상입니다. 정의감이 강하고 원칙적입니다. 늦게 빛나는 대기만성형입니다.',
  // 을(乙) 일간
  '을축': '을축일주는 겨울의 풀이 땅속에 숨은 형상입니다. 인내심이 강하고 내면이 단단합니다. 차분하게 때를 기다리는 지혜가 있습니다.',
  '을묘': '을묘일주는 풀이 봄밭에 피어난 형상입니다. 매력적이고 사교적이며 인기가 많습니다. 유연한 처세술로 사람의 마음을 잡습니다.',
  '을사': '을사일주는 풀이 햇볕을 받는 형상입니다. 총명하고 학문적 성취가 높습니다. 지적 호기심이 강합니다.',
  '을미': '을미일주는 풀이 기름진 밭에 심겨진 형상입니다. 온화하고 포용적입니다. 사람을 돌보는 능력이 뛰어납니다.',
  '을유': '을유일주는 꽃이 가위를 만난 형상입니다. 심미안이 뛰어나고 예민합니다. 예술적 감각이 탁월합니다.',
  '을해': '을해일주는 풀이 물을 만난 형상입니다. 적응력이 뛰어나고 다재다능합니다. 어디서든 잘 자라는 생명력이 있습니다.',
  // 병(丙) 일간
  '병자': '병자일주는 태양이 물 위에 비치는 형상입니다. 지혜와 열정을 겸비했습니다. 이성적 매력이 강합니다.',
  '병인': '병인일주는 태양이 숲을 비추는 형상입니다. 카리스마가 넘치고 리더십이 있습니다. 대중적 인기를 얻기 쉽습니다.',
  '병진': '병진일주는 태양이 산 위에 뜬 형상입니다. 포부가 크고 성공 욕구가 강합니다. 큰 무대에서 빛을 발합니다.',
  '병오': '병오일주는 한여름 태양의 형상입니다. 에너지가 넘치고 열정적입니다. 극강의 추진력을 가졌지만 지나친 열기에 주의해야 합니다.',
  '병신': '병신일주는 태양이 금속을 녹이는 형상입니다. 결단력이 있고 변혁적입니다. 새로운 것을 만들어내는 창조력이 있습니다.',
  '병술': '병술일주는 석양의 형상입니다. 원숙하고 깊이 있는 사고를 합니다. 말년으로 갈수록 운이 좋아지는 경향이 있습니다.',
  // 정(丁) 일간
  '정축': '정축일주는 겨울밤의 촛불 형상입니다. 고독하지만 깊은 내면의 빛이 있습니다. 학문이나 예술에서 빛을 발합니다.',
  '정묘': '정묘일주는 촛불이 봄바람에 흔들리는 형상입니다. 감성적이고 예술적 재능이 탁월합니다. 사람을 끄는 매력이 있습니다.',
  '정사': '정사일주는 화산의 형상입니다. 내면에 강한 에너지를 품고 있습니다. 한번 불붙으면 대단한 성과를 냅니다.',
  '정미': '정미일주는 따뜻한 난로의 형상입니다. 가정적이고 포근합니다. 사람들이 편안함을 느끼는 따뜻한 성격입니다.',
  '정유': '정유일주는 촛불이 보석을 비추는 형상입니다. 심미안이 뛰어나고 섬세합니다. 럭셔리한 취향이 있습니다.',
  '정해': '정해일주는 바다 위의 등대 형상입니다. 사람들에게 길을 안내하는 역할을 합니다. 지도자적 자질이 있습니다.',
  // 무(戊) 일간
  '무자': '무자일주는 큰 산 아래 호수가 있는 형상입니다. 지혜롭고 깊이 있는 사고를 합니다. 외유내강 타입입니다.',
  '무인': '무인일주는 산에 숲이 우거진 형상입니다. 포용력이 크고 사람을 끌어들이는 힘이 있습니다. 대인관계가 좋습니다.',
  '무진': '무진일주는 높은 산봉우리의 형상입니다. 야망이 크고 자존심이 강합니다. 큰 뜻을 품고 있습니다.',
  '무오': '무오일주는 화산의 형상입니다. 겉은 듬직하지만 내면에 강한 열정을 품고 있습니다. 행동력이 뛰어납니다.',
  '무신': '무신일주는 산에서 광물이 나오는 형상입니다. 실용적이고 결과를 중시합니다. 재물 운이 좋은 편입니다.',
  '무술': '무술일주는 높은 산이 겹겹이 쌓인 형상입니다. 고집이 세지만 신뢰감이 있습니다. 꾸준한 노력으로 성공합니다.',
  // 기(己) 일간
  '기축': '기축일주는 기름진 밭의 형상입니다. 실용적이고 알뜰합니다. 꾸준한 재물 축적 능력이 있습니다.',
  '기묘': '기묘일주는 봄밭에 씨를 뿌리는 형상입니다. 시작하는 힘이 있고 창의적입니다. 새로운 분야를 개척합니다.',
  '기사': '기사일주는 햇볕에 뜨거운 흙의 형상입니다. 열정적이고 추진력이 있습니다. 끈기 있게 목표를 달성합니다.',
  '기미': '기미일주는 들판의 형상입니다. 수용적이고 포용적입니다. 많은 것을 받아들이는 넓은 마음의 소유자입니다.',
  '기유': '기유일주는 보석이 묻힌 흙의 형상입니다. 겉보기엔 수수하지만 내면에 빛나는 재능이 있습니다. 감정이 섬세합니다.',
  '기해': '기해일주는 진흙탕의 형상입니다. 혼란스러운 상황에서도 실리를 찾는 능력이 있습니다. 적응력이 뛰어납니다.',
  // 경(庚) 일간
  '경자': '경자일주는 차가운 금속이 물에 잠긴 형상입니다. 냉철한 판단력과 지혜를 갖추었습니다. 전략가 타입입니다.',
  '경인': '경인일주는 도끼가 숲에 있는 형상입니다. 실행력이 뛰어나고 과감합니다. 목표를 향해 돌진하는 성격입니다.',
  '경진': '경진일주는 산에서 캐낸 원석의 형상입니다. 잠재력이 크고 큰 그릇입니다. 귀인의 도움을 받기 쉽습니다.',
  '경오': '경오일주는 달궈진 쇠의 형상입니다. 열정과 결단력을 겸비했습니다. 리더로서 카리스마가 있습니다.',
  '경신': '경신일주는 순수한 금속의 형상입니다. 원칙적이고 깨끗합니다. 정의감이 강하고 불의를 참지 못합니다.',
  '경술': '경술일주는 칼이 집에 보관된 형상입니다. 능력을 갖추고 때를 기다립니다. 충성스럽고 의리가 있습니다.',
  // 신(辛) 일간
  '신축': '신축일주는 보석이 흙 속에 묻힌 형상입니다. 숨겨진 재능이 많습니다. 시간이 지날수록 가치가 드러납니다.',
  '신묘': '신묘일주는 보석이 꽃밭에 놓인 형상입니다. 심미안이 뛰어나고 매력적입니다. 예술과 패션에 감각이 있습니다.',
  '신사': '신사일주는 보석이 불에 닦이는 형상입니다. 시련을 통해 더 빛나는 타입입니다. 역경을 통한 성장이 큽니다.',
  '신미': '신미일주는 보석이 들판에 놓인 형상입니다. 소박하면서도 품위가 있습니다. 내면의 아름다움이 빛납니다.',
  '신유': '신유일주는 순금의 형상입니다. 자존심이 매우 강하고 완벽주의입니다. 전문 분야에서 최고를 추구합니다.',
  '신해': '신해일주는 보석이 물에 씻기는 형상입니다. 깨끗하고 순수한 성품입니다. 지혜와 아름다움을 겸비했습니다.',
  // 임(壬) 일간
  '임자': '임자일주는 대해(大海)의 형상입니다. 스케일이 크고 포용력이 넓습니다. 큰 꿈을 품고 넓은 세상을 지향합니다.',
  '임인': '임인일주는 물이 숲을 적시는 형상입니다. 다른 사람을 키우는 능력이 뛰어납니다. 교육자적 자질이 있습니다.',
  '임진': '임진일주는 구름 위의 용(龍)의 형상입니다. 비범한 기질과 큰 야망을 가졌습니다. 특별한 운명을 타고났습니다.',
  '임오': '임오일주는 바다에 태양이 비치는 형상입니다. 지혜와 열정을 겸비했습니다. 이상과 현실을 모두 추구합니다.',
  '임신': '임신일주는 강물이 바위를 만난 형상입니다. 장애물을 돌아가는 지혜가 있습니다. 유연한 문제 해결 능력이 탁월합니다.',
  '임술': '임술일주는 바다가 제방을 만난 형상입니다. 자기 절제력이 강합니다. 규율 있는 생활로 큰 성과를 냅니다.',
  // 계(癸) 일간
  '계축': '계축일주는 겨울의 이슬이 땅에 내린 형상입니다. 참을성이 강하고 내공이 깊습니다. 뒤에서 묵묵히 힘을 축적합니다.',
  '계묘': '계묘일주는 봄비가 꽃을 적시는 형상입니다. 섬세하고 감성적입니다. 예술적 재능이 뛰어납니다.',
  '계사': '계사일주는 이슬이 뜨거운 땅에 떨어진 형상입니다. 적응력이 뛰어나지만 불안정할 수 있습니다. 변화무쌍한 인생을 경험합니다.',
  '계미': '계미일주는 빗물이 들판을 적시는 형상입니다. 온화하고 수용적입니다. 사람을 살리는 힘이 있습니다.',
  '계유': '계유일주는 이슬이 보석 위에 맺힌 형상입니다. 깨끗하고 영리합니다. 학문적 재능이 뛰어납니다.',
  '계해': '계해일주는 바다의 형상입니다. 깊고 넓은 내면을 가졌습니다. 직관력이 뛰어나고 영적 감수성이 높습니다.',
};

// 연주 십성 해석 (조상/가문/사회적 배경)
const YEAR_SIPSEONG_DESC: Record<Sipseong, string> = {
  '비견': '어린 시절부터 자립심을 요구받는 환경에서 자랐으며, 그 덕분에 일찍부터 자기 앞가림을 해내는 강인한 정신력을 지니게 되었습니다. 형제나 또래와 경쟁하고 협력하는 법을 배우며 타고난 생존력을 길렀습니다.',
  '겁재': '다소 기복이 있거나 경쟁이 치열한 가정 환경을 겪었을 수 있습니다. 하지만 이러한 경험이 오히려 어떤 시련에도 굴하지 않는 잡초 같은 생명력과 강렬한 승부욕을 당신의 내면에 심어주었습니다.',
  '식신': '의식주가 비교적 여유롭고 따뜻한 사랑을 듬뿍 받는 환경에서 자라났습니다. 덕분에 매사를 긍정적으로 바라보는 여유가 있으며, 조상이나 부모로부터 풍부한 감수성과 낙천적인 기질을 물려받았습니다.',
  '상관': '규칙이나 틀에 얽매이지 않는 자유분방한 환경의 영향을 받았습니다. 억압받는 것을 극도로 싫어하며, 어려서부터 남다른 창의력과 반항적인 천재성을 바탕으로 기존의 방식에 의문을 품고 성장해왔습니다.',
  '편재': '일찍부터 경제 관념이나 상업적 감각을 접할 수 있는 환경에 놓여 있었습니다. 돈이 흐르는 이치를 남들보다 빠르게 깨우쳤으며, 부모나 조상의 사업가적 기질을 가슴 깊이 간직하고 있습니다.',
  '정재': '매우 성실하고 계획적이며 안정을 최우선으로 여기는 든든한 가정에서 자라났습니다. 덕분에 낭비나 허세 없이 단단하게 자신의 내실을 다져가는 지혜를 일찍부터 체득할 수 있었습니다.',
  '편관': '자라온 환경에 엄격한 규율이나 다소 억압적인 분위기가 존재했을 수 있습니다. 하지만 이 과정에서 남들은 상상하기 어려운 책임감과 인내력을 길러냈으며, 어떠한 고난도 이겨내는 카리스마를 얻었습니다.',
  '정관': '명예와 체면, 바른 도리를 매우 중시하는 모범적인 가풍 아래에서 자랐습니다. 정도(正道)를 걷는 것을 당연하게 여기며, 윗사람의 지혜를 스펀지처럼 흡수하여 사회적 성취의 든든한 밑거름으로 삼았습니다.',
  '편인': '다소 독특하거나 비범한, 혹은 예술이나 종교적 색채가 강한 환경에서 성장했습니다. 세상을 바라보는 시야가 남들과는 확연히 다르며, 남들은 캐치하지 못하는 고차원적인 영감을 어려서부터 축적해왔습니다.',
  '정인': '배움과 교육을 무엇보다 소중하게 여기는 뼈대 있는 환경의 혜택을 받았습니다. 특히 어머니의 지대한 사랑과 헌신 아래에서 정서적인 풍요로움을 누렸으며, 덕분에 평생 인복이 끊이지 않는 기운을 타고났습니다.',
};

/**
 * 시주, 오행 분포, 십성을 반영한 상세 성격 해석 생성
 */
function generateDetailedDescription(
  ilgan: string,
  hourPillar: SajuPillar,
  ohaengBalance: Record<Ohaeng, number>,
  sipseongs: { year: Sipseong; month: Sipseong; hour: Sipseong },
  yongsin: Ohaeng,
  gisin: Ohaeng,
  dominantOhaeng: Ohaeng,
  weakestOhaeng: Ohaeng,
  dayPillar?: SajuPillar,
  monthPillar?: SajuPillar,
  interactionsSummary?: string,
  iljuFullDesc?: string
): string {
  const baseDesc = ILGAN_DESCRIPTION[ilgan];
  const ilOhaeng = CHEONGAN_OHAENG[ilgan];

  // 시주 영향 해석
  const hourGan = hourPillar.cheongan;
  const hourOhaeng = hourPillar.cheonganOhaeng;
  const hourSipseong = sipseongs.hour;

  const HOUR_SIPSEONG_DESC: Record<Sipseong, string> = {
    '비견': '가장 깊은 내면에는 타인에게 의지하지 않고 스스로 운명을 개척하려는 강렬한 자아의식이 자리 잡고 있습니다. 인생의 후반부로 갈수록 이러한 독립적인 성향이 더욱 짙어져, 조직에 얽매이기보다는 나만의 독자적인 영역이나 문파를 구축하여 존경받는 말년을 보내게 될 가능성이 농후합니다.',
    '겁재': '겉보기엔 차분할지 몰라도, 당신의 깊은 무의식에는 승부를 향해 돌진하는 야수의 심장이 깃들어 있습니다. 인생의 결정적인 순간마다 남들은 포기할 리스크를 과감히 걸어 기적을 만들어내는 힘이 있습니다. 중장년 이후 큰 무대에서 엄청난 부를 노릴 수 있지만, 베풀 때와 웅크릴 때를 정확히 재는 지혜가 필요합니다.',
    '식신': '스트레스를 유희와 창작으로 승화시키는 믿을 수 없을 만큼 부드럽고 풍요로운 내면을 가졌습니다. 나이가 들수록 먹고, 마시고, 베풀고, 예술을 즐기는 진정한 욜로(YOLO) 라이프를 만끽하게 됩니다. 재능을 나누면 말년에 사람들이 구름처럼 몰려와 당신의 매력에 열광할 것입니다.',
    '상관': '가슴 깊은 곳에는 세상을 향한 날 선 비판 의식과 천재적인 혁신 의지가 펄떡이고 있습니다. 기성세대의 지루한 룰을 참지 못하며, 낡은 체제를 깨부수는 파괴력이 숨어 있습니다. 노년기에도 결코 구태의연해지지 않고, 화려한 언변과 안목으로 트렌드를 선도하는 독보적 존재로 남게 됩니다.',
    '편재': '돈의 흐름을 본능적으로 냄새 맡고 스케일 크게 움직이려는 사업가적 야망이 내면 깊숙이 숨 쉬고 있습니다. 소소한 저축보다는 스펙터클한 투자나 사업 확장에 피가 끓는 타입입니다. 말년에는 결국 거대한 재물을 쥐락펴락하며, 베풀기도 화끈하게 베푸는 호쾌한 인생을 즐기게 될 것입니다.',
    '정재': '어떤 위기가 닥쳐도 한 치의 흔들림 없이 계산기를 두드리며 내 몫을 지켜내는 완벽한 안정 추구형 내면입니다. 불확실한 도박보다는 내 손안에 들어온 확실한 성과에 깊은 애착과 안도감을 느낍니다. 인생 후반전은 한 치의 오차도 없이 설계된 재무 계획 아래, 그 누구보다 평온하고 풍족한 노후를 보장받습니다.',
    '편관': '아무도 보지 않는 곳에서도 스스로를 채찍질하며 엄청난 압박감을 견뎌내는 강철 같은 카리스마가 내면에 서려 있습니다. 권력과 존경에 대한 깊은 갈망이 당신을 끊임없이 위로 끌어올립니다. 엄청난 책임감을 견뎌낸 끝에, 수많은 사람들을 리드하고 군림하는 강력한 노년을 맞이하게 됩니다.',
    '정관': '스스로 세운 원칙과 도덕적 나침반을 목숨처럼 여기며, 절도 있고 기품 있는 삶을 갈망하는 바른 내면의 소유자입니다. 남에게 지탄받을 일을 가장 혐오하며, 나이가 들수록 그 품위가 더욱 빛을 발합니다. 존경받는 위치에 오르고 세상의 인정을 받으며, 흠잡을 데 없이 명예롭고 평온한 말년을 누립니다.',
    '편인': '현실 세계의 물리적 가치보다는 철학, 명리, 예술 등 고차원적인 진리와 깨달음을 탐구하려는 신비로운 내면이 돋보입니다. 왁자지껄한 군중을 떠나 홀로 사색할 때 가장 완벽한 에너지를 충전합니다. 말년에는 대중이 도달할 수 없는 깊은 정신적 경지에 다다라, 타인들의 존경받는 정신적 멘토가 됩니다.',
    '정인': '머리가 희끗해질 때까지도 배움의 끈을 놓지 않는 지치지 않는 지적 호기심과 학자적 양심이 내면에 가득합니다. 누군가를 가르치고 사랑으로 품어주는 데서 인생의 최고 가치를 확인합니다. 인생 후기에 지루함 없이 학문적 성취나 명예를 쌓으며, 후학이나 자녀들이 당신의 지혜를 우러러보게 될 것입니다.',
  };

  // 오행 밸런스 해석
  let ohaengDesc = '';
  const total = Object.values(ohaengBalance).reduce((a, b) => a + b, 0);
  const dominantPct = ((ohaengBalance[dominantOhaeng] / total) * 100).toFixed(0);
  const weakestPct = ((ohaengBalance[weakestOhaeng] / total) * 100).toFixed(0);

  const OHAENG_TRAIT: Record<Ohaeng, { strong: string; weak: string }> = {
    '목': {
      strong: '겨우내 얼었던 척박한 땅을 뚫고 솟아오르는 봄의 새싹처럼, 무시무시한 생명력과 성장 욕구를 뿜어냅니다. 한 곳에 정체되는 것을 병적으로 싫어하며, 항상 새로운 아이디어를 던지고 일을 벌이는 진취적인 선봉장이 됩니다. 다만, 이 기운이 과도하면 주변과 타협하지 않는 외골수적 고집으로 번지거나 앞뒤 안 가리고 부딪혀 마찰을 빚을 수 있으니 때로는 숙이는 유연성을 기르는 것이 중요합니다.',
      weak: '무언가를 새로 시작하거나 첫걸음을 내딛는 데 유독 망설임과 두려움을 쉽게 느낄 수 있습니다. 머릿속으로 구상만 하다 좋은 기회를 허무하게 놓쳐버리는 경우가 생길 수 있으니, 아주 작은 단계부터 일단 실행에 옮겨보는 행동력을 억지로라도 끌어올려야 운이 트입니다.',
    },
    '화': {
      strong: '모든 사람의 시선을 한몸에 받으며 찬란하게 타오르는 한여름의 용광로 같은 열정과 화려함을 내뿜습니다. 뛰어난 언변과 주체할 수 없는 활력으로 대중을 사로잡으며 폭발적인 추진력을 자랑합니다. 반면, 기운이 한계치에 달하면 감정의 진폭이 걷잡을 수 없이 커지고 다혈질적 분노나 급격한 번아웃으로 이어질 수 있으니, 스스로 열기를 식히는 고요한 명상의 시간이 반드시 필요합니다.',
      weak: '내면의 감정을 솔직하게 표현하거나 열정적으로 자신을 어필하는 데 어려움을 느끼며, 때때로 원인 모를 삶의 무기력증에 우울함을 겪을 수 있습니다. 심박수를 올리는 격렬한 활동성과 나 자신을 마음껏 표현할 취미 생활을 통해 삶에 생기를 수혈해야 합니다.',
    },
    '토': {
      strong: '거대한 태산처럼 든든하고 넓은 지평선처럼 세상의 모든 가치를 품어 수용하는 압도적인 포용력과 묵직한 안정감을 지녔습니다. 이들 틈에서 이리저리 흔들리는 사람들에게 절대적인 믿음과 피난처가 되어주는 타고난 중재자입니다. 허나, 이 기운이 탁하게 뭉치면 세상 어떤 논리로도 꺾을 수 없는 황소고집과 변화를 거부하는 보수성으로 굳어버리니, 낯선 환경 시스템에 의도적으로 몸을 던져야 합니다.',
      weak: '사방에서 거세게 부는 바람에 이리저리 흔들리는 갈대처럼, 내 삶의 뚜렷한 중심을 잡지 못하고 남의 의견에 쉽게 휩쓸리거나 정체성의 혼란을 겪을 수 있습니다. 매일 정해진 루틴을 실천하며 세상의 유행보다 나 스스로만의 확고한 철학을 세우는 것이 최우선 과제입니다.',
    },
    '금': {
      strong: '가을바람에 서릿발이 맺히듯 날카로울 정도로 시시비비가 명확하고 한 치의 오차도 허용하지 않는 강력한 절도성을 뿜어냅니다. 불의나 비효율을 결코 참지 못하는 냉철한 완벽주의와 오싹한 카리스마를 지녔습니다. 이런 무장의 기질이 제대로 제어되지 않으면, 무심코 던진 팩트 폭력이 타인에게 깊은 상처가 되어 돌아올 수 있으니 부드러운 화법을 각인시키는 것이 필수입니다.',
      weak: '결정적인 승부처에 단호하게 마침표를 찍지 못하고 끌려다니거나, 득이 되지 않는 불필요한 인간관계나 업무를 단칼에 베어내지 못해 혼자 끙끙 앓으며 스트레스를 떠안기 십상입니다. 세상 사람들에게 미움받을 용기를 내어 단호하게 쳐낼 것은 쳐내는 훈련을 시작해야 합니다.',
    },
    '수': {
      strong: '형태가 없는 맹물이 어떤 그릇에도 맞춰서 담기듯이, 세상의 그 어떤 돌발 상황이나 척박한 인간관계 속에서도 유유히 적응해 살아남는 신들린 유연성과 깊은 지성을 자랑합니다. 숨겨진 행간의 의미까지 단숨에 포착해내는 직관력이 소름 돋게 뛰어납니다. 다만 방어 기제가 높아져 심연으로 침잠하면 걷잡을 수 없는 우울감이나 잡념의 늪에 빠지니, 밖으로 나가 육체를 움직여 에너지를 발산해야 합니다.',
      weak: '변화무쌍한 현실 속에서 물 흐르듯 유연하게 대처하는 융통성이 부족해 꽉 막힌 길에서 오도가도 못하거나, 한 가지 수에 집착하다 그만 큰 시야를 놓치곤 합니다. 철학적인 독서나 명상, 그리고 타인의 조언을 적극적으로 수용하여 삶을 바라보는 시야각을 극단적으로 넓혀야 합니다.',
    },
  };

  const OHAENG_MEANING: Record<Ohaeng, string> = {
    '목': '나무의 기운',
    '화': '불의 기운',
    '토': '흙의 기운',
    '금': '쇠의 기운',
    '수': '물의 기운',
  };

  // 오행 상호작용 분석
  let interactionDesc = '';
  const sortedOhaeng = (Object.entries(ohaengBalance) as [Ohaeng, number][]).sort((a, b) => b[1] - a[1]);
  const top2 = sortedOhaeng.slice(0, 2).map(e => e[0]);
  const OHAENG_INTERACT: Record<string, string> = {
    '목화': '목화(木火) 에너지가 강합니다. 성장하면서 빛을 발하는 형태로, 창의적이고 열정적입니다. 새로운 아이디어를 실행에 옮기는 능력이 탁월합니다.',
    '화목': '목화(木火) 에너지가 강합니다. 성장하면서 빛을 발하는 형태로, 창의적이고 열정적입니다. 새로운 아이디어를 실행에 옮기는 능력이 탁월합니다.',
    '화토': '화토(火土) 에너지가 강합니다. 열정이 안정감으로 이어지는 형태로, 꾸준히 결실을 맺는 타입입니다. 리더십과 실행력을 겸비했습니다.',
    '토화': '화토(火土) 에너지가 강합니다. 열정이 안정감으로 이어지는 형태로, 꾸준히 결실을 맺는 타입입니다. 리더십과 실행력을 겸비했습니다.',
    '토금': '토금(土金) 에너지가 강합니다. 안정 속에서 가치를 만들어내는 형태로, 꼼꼼하고 실용적입니다. 재물 관리와 자산 증식에 탁월합니다.',
    '금토': '토금(土金) 에너지가 강합니다. 안정 속에서 가치를 만들어내는 형태로, 꼼꼼하고 실용적입니다. 재물 관리와 자산 증식에 탁월합니다.',
    '금수': '금수(金水) 에너지가 강합니다. 명석한 두뇌와 전략적 사고가 결합된 형태입니다. 분석력과 지혜가 뛰어나 학문이나 전문직에 재능이 있습니다.',
    '수금': '금수(金水) 에너지가 강합니다. 명석한 두뇌와 전략적 사고가 결합된 형태입니다. 분석력과 지혜가 뛰어나 학문이나 전문직에 재능이 있습니다.',
    '수목': '수목(水木) 에너지가 강합니다. 지혜가 성장으로 이어지는 형태로, 배움을 실천에 옮기는 능력이 뛰어납니다. 교육이나 연구 분야에 적합합니다.',
    '목수': '수목(水木) 에너지가 강합니다. 지혜가 성장으로 이어지는 형태로, 배움을 실천에 옮기는 능력이 뛰어납니다. 교육이나 연구 분야에 적합합니다.',
    // 상극 조합
    '목금': '목금(木金) 에너지가 충돌합니다. 추진력과 결단력이 모두 강하지만, 내면에서 갈등이 일어나기 쉽습니다. 이 긴장감이 오히려 큰 성취의 원동력이 됩니다.',
    '금목': '목금(木金) 에너지가 충돌합니다. 추진력과 결단력이 모두 강하지만, 내면에서 갈등이 일어나기 쉽습니다. 이 긴장감이 오히려 큰 성취의 원동력이 됩니다.',
    '화수': '수화(水火) 에너지가 충돌합니다. 열정과 냉정함이 공존합니다. 감정의 기복이 있을 수 있지만, 두 극단을 모두 이해하는 깊이 있는 인물입니다.',
    '수화': '수화(水火) 에너지가 충돌합니다. 열정과 냉정함이 공존합니다. 감정의 기복이 있을 수 있지만, 두 극단을 모두 이해하는 깊이 있는 인물입니다.',
    '토목': '목토(木土) 에너지가 충돌합니다. 변화를 추구하면서도 안정을 원하는 이중적 성향이 있습니다. 현실적 기반 위에서 도전할 때 가장 좋은 결과를 냅니다.',
    '목토': '목토(木土) 에너지가 충돌합니다. 변화를 추구하면서도 안정을 원하는 이중적 성향이 있습니다. 현실적 기반 위에서 도전할 때 가장 좋은 결과를 냅니다.',
    '금화': '화금(火金) 에너지가 충돌합니다. 열정으로 새로운 것을 만들어내는 대장장이의 기질이 있습니다. 창조와 혁신 분야에서 두각을 나타낼 수 있습니다.',
    '화금': '화금(火金) 에너지가 충돌합니다. 열정으로 새로운 것을 만들어내는 대장장이의 기질이 있습니다. 창조와 혁신 분야에서 두각을 나타낼 수 있습니다.',
    '수토': '토수(土水) 에너지가 충돌합니다. 안정과 유동이 함께 있어 내면의 갈등이 생길 수 있습니다. 그러나 이것이 실용적 지혜로 발현되면 큰 힘이 됩니다.',
    '토수': '토수(土水) 에너지가 충돌합니다. 안정과 유동이 함께 있어 내면의 갈등이 생길 수 있습니다. 그러나 이것이 실용적 지혜로 발현되면 큰 힘이 됩니다.',
  };
  const interKey = top2[0] + top2[1];
  if (OHAENG_INTERACT[interKey]) {
    interactionDesc = `\n${OHAENG_INTERACT[interKey]}`;
  }

  ohaengDesc = `\n\n【에너지 밸런스】\n`;
  ohaengDesc += `가장 넘치는 에너지: ${dominantOhaeng} (${OHAENG_MEANING[dominantOhaeng]}, ${dominantPct}%) — ${OHAENG_TRAIT[dominantOhaeng].strong}\n`;
  ohaengDesc += `가장 부족한 에너지: ${weakestOhaeng} (${OHAENG_MEANING[weakestOhaeng]}, ${weakestPct}%) — ${OHAENG_TRAIT[weakestOhaeng].weak}`;
  ohaengDesc += interactionDesc;

  // 용신/기신 해석
  const YONGSIN_ADVICE: Record<Ohaeng, string> = {
    '목': '나무, 숲, 초록색 계열이 도움이 됩니다. 동쪽 방향이 길합니다. 봄철에 기운이 상승합니다. 식물 가꾸기나 등산이 좋고, 나무 소재 액세서리를 가까이하세요.',
    '화': '붉은색, 따뜻한 조명, 남쪽 방향이 유리합니다. 여름에 에너지가 충전됩니다. 활동적인 취미가 좋고, 태양광을 많이 받으세요. 빨간색 소품이 행운을 부릅니다.',
    '토': '황토색, 갈색 계열이 좋습니다. 대지와 가까운 활동(등산, 정원 가꾸기)이 도움됩니다. 환절기에 특히 이 기운이 필요합니다. 도자기나 석재 소품이 좋습니다.',
    '금': '흰색, 금색 계열과 서쪽 방향이 유리합니다. 가을에 운이 강해집니다. 규칙적인 생활이 좋고, 금속 소재 장신구(시계, 반지)가 행운을 가져옵니다.',
    '수': '검은색, 파란색 계열과 북쪽 방향이 길합니다. 겨울에 지혜가 깊어집니다. 수영이나 명상이 도움됩니다. 수족관이나 분수가 있는 곳이 좋습니다.',
  };

  let yongsinDesc = `\n\n【행운을 부르는 팁】\n`;
  yongsinDesc += `당신에게 필요한 기운은 ${yongsin}(${OHAENG_COLOR_NAME[yongsin]})입니다. ${YONGSIN_ADVICE[yongsin]}`;
  yongsinDesc += `\n조심해야 할 기운은 ${gisin}(${OHAENG_COLOR_NAME[gisin]})입니다. 이 기운이 과하면 균형이 무너지니, ${gisin} 기운이 강한 환경이나 사람을 피하는 것이 좋습니다.`;

  // 시주 십성 해석
  let hourDesc = `\n\n【시주로 본 내면 성격 · 말년운】\n`;
  hourDesc += `시주 ${hourPillar.cheongan}${hourPillar.jiji}(${hourSipseong}) — ${HOUR_SIPSEONG_DESC[hourSipseong]}`;

  // 월주 십성 해석 (사회적 성향)
  const monthSipseong = sipseongs.month;
  const MONTH_SIPSEONG_DESC: Record<Sipseong, string> = {
    '비견': '사회생활에서 남 밑에 굽히고 지시에 맹종하는 것을 생리적으로 강하게 거부합니다. 권위적인 조직 시스템보다는 동료들과 당당히 어깨를 나란히 하고 경쟁할 때 자신의 진가가 맹렬하게 폭발합니다. 특정 분야의 최고가 되어 자율적으로 권한을 휘두르는 프리랜서나 전문직 그룹, 혹은 파트너십 구조에서 눈부신 성과를 냅니다.',
    '겁재': '직장이나 비즈니스 생태계라는 치열한 정글에서 본능적으로 승부 구도를 형성하고, 결국 어떻게든 경쟁자를 제치고 유리한 고지를 점령해내는 폭발적이고 호전적인 투쟁력을 지녔습니다. 거대한 위기 상황이나 극한의 압박 속에서 오히려 무서운 야성으로 돌파구를 마련하지만, 자칫 과도한 승부욕으로 불필요한 적을 양산할 수 있으니 둥글게 돌아가는 처세술이 필수적입니다.',
    '식신': '억압받지 않는 환경에서 무한대로 뻗어나가는 뛰어난 기획력, 예술적 상상력, 감각적인 재능을 주무기로 삼아 사회에서 크게 대접받습니다. 교육, 기획, 요식, 디자인 등 본인이 스스로 생각하고 행동해 새로운 작품을 만들어내는 분야에 최적화되어 있습니다. 자유가 보장될수록 일의 능률과 부(富)의 스케일이 비례하여 기하급수적으로 커지는 타입입니다.',
    '상관': '기존 직장의 불합리나 꽉 막힌 지휘 체계를 절대로 참지 못하고 곧바로 뒤엎어버리려 하는 대단한 혁명가적 기질을 세상에 드러냅니다. 보통 인간의 상상을 초월하는 화려한 언변과 촌철살인의 날카로운 논리로 순식간에 수많은 대중을 사로잡습니다. 언론방송, 첨단 IT, 스타트업 등 변화의 주기가 미친 듯이 빠르고 파격적인 판에서 대체불가의 아이콘으로 자리 잡습니다.',
    '편재': '마치 황야의 사냥꾼처럼 무의식적으로 돈이 모이는 길목을 냄새 맡고 스펙터클한 승부수를 던지며 판을 흔드는 무서운 사업적 야수성을 발휘합니다. 따박따박 들어오는 고정 급여로는 도무지 피가 끓지 않으며 지분 참여나 파격적 인센티브제, 주식, 글로벌 무역 등 거대한 자금 흐름을 통제하고 지배할 때 살아있음을 느낍니다.',
    '정재': '그 어떤 치명적인 글로벌 경제 위기가 몰아닥치더라도 놀라운 생존력으로 흑자 구조를 유지해내는 무결점 재무의 신입니다. 금융, 회계, 행정 계통이나 세밀한 관리직에서 한 치의 오차조차 허용치 않는 무서운 성실함으로 모든 인사권자의 절대적 신임을 얻어냅니다. 티끌 하나 잃지 않으며 철벽 같이 차곡차곡 쌓아올린 거대한 재산 성곽을 완성합니다.',
    '편관': '살벌한 권력 투쟁이 벌어지는 전장, 군경검을 비롯한 생사여탈권이 걸린 직역이나 극한의 책임을 부과받는 최상위 요직에서 그 누구도 범접할 수 없는 카리스마를 발산합니다. 목에 시퍼런 칼이 들어와도 부여받은 끔찍한 임무를 완수해내는 독종 기질 덕에 주변 사람들을 그저 압도해버리며, 남들보다 몇 발 앞서 고속 승진의 탄탄대로를 박차고 오릅니다.',
    '정관': '스스로 깎아놓은 구도승처럼 철저한 규칙 준수와 한 치의 흐트러짐도 없는 완벽한 처세술로 모든 조직 내 윗사람들의 깊은 사랑을 싹쓸이하는 엘리트 그 자체입니다. 대기업의 핵심 부서 공직 사회 등 질서 정연한 생태계에 마치 물 만난 고기처럼 완벽하게 녹아들며, 평생 단 한 번의 비리나 치명적 구설수 없이 우아하게 조직의 최정점 사령탑까지 도달합니다.',
    '편인': '최첨단 딥테크 인공지능, 고도의 철학과 명리, 대체 의학이나 종교 등 일반 대중들의 보편적 시선과 상식이 닿지 않는 극마이너하고 심오한 영역에서 번뜩이는 천재성을 유감없이 발휘합니다. 번잡한 인맥 관리와 물리적인 육체노동 없이도 오로지 비범한 통찰력과 직관력 단 하나만으로 세상에 대체 불가능한 자신만의 절대적인 사이버 블루오션을 창출합니다.',
    '정인': '화려한 언변이나 눈속임 같은 얕은 수작에 기대지 않고 오직 묵직하고 압도적인 학력 자격증 전문가적 타이틀만으로 사회 명사들의 반열에 당당히 똬리를 틉니다. 평생토록 배움을 멈추지 않는 지독한 지적 탐구심과 도덕성 덕분에 존경받는 학자나 최고위 연구원 명망 높은 교육자로 우뚝 서 조직원들을 배후에서 지휘하는 막후 최고 권위자가 됩니다.',
  };

  let monthDesc = `\n\n【사회에서의 모습 · 직업적 성향】\n`;
  monthDesc += `월주 ${monthSipseong} — ${MONTH_SIPSEONG_DESC[monthSipseong]}`;

  // 연주 십성 해석 (가문/배경)
  const yearSipseong = sipseongs.year;
  let yearDesc = `\n\n【가정 환경 · 사회적 배경】\n`;
  yearDesc += `연주 ${yearSipseong} — ${YEAR_SIPSEONG_DESC[yearSipseong]}`;

  // 일지(배우자궁)의 오행과 일간 관계 분석 — 일주별 고유 특성
  let iljuInteraction = '';
  if (dayPillar) {
    const iljiOh = dayPillar.jijiOhaeng;
    const iljiJiji = dayPillar.jiji;

    // 일간-일지 관계 분석 (60갑자 중 어떤 조합인지에 따라 성격이 크게 달라짐)
    const ILJI_CHARACTER: Record<string, string> = {
      '자': '일지 자수(子水) — 내면이 깊고 직관적입니다. 밤에 영감이 잘 떠오르고, 비밀이 많으며, 겉으로 드러내지 않는 감정이 풍부합니다.',
      '축': '일지 축토(丑土) — 느리지만 확실한 사람입니다. 한번 마음먹으면 끝까지 가고, 재물을 모으는 능력이 탁월합니다. 겨울 소(牛)처럼 묵묵한 인내심이 있습니다.',
      '인': '일지 인목(寅木) — 활동적이고 모험을 즐기는 성격입니다. 새벽 호랑이의 기운으로 새로운 도전을 두려워하지 않습니다. 다만 한곳에 오래 머물기 어려울 수 있습니다.',
      '묘': '일지 묘목(卯木) — 사교적이고 매력이 넘칩니다. 이성에게 인기가 많고, 예술적 감각이 뛰어납니다. 꽃처럼 아름다운 외모나 분위기를 가진 경우가 많습니다.',
      '진': '일지 진토(辰土) — 야심차고 스케일이 큽니다. 용(龍)의 기운으로 큰 꿈을 품고 있으며, 귀인의 도움을 잘 받습니다. 다만 이상이 높아 현실과 괴리가 생길 수 있습니다.',
      '사': '일지 사화(巳火) — 전략적이고 지적입니다. 뱀의 지혜로 복잡한 상황에서도 최적의 해법을 찾아냅니다. 비밀을 잘 지키고, 관찰력이 매우 뛰어납니다.',
      '오': '일지 오화(午火) — 열정적이고 활발합니다. 말(馬)의 에너지로 행동력이 넘치고 주변을 밝게 합니다. 다만 한 가지에 집중하기보다 여러 일을 벌이는 경향이 있습니다.',
      '미': '일지 미토(未土) — 다정하고 섬세합니다. 양(羊)처럼 온순하면서도 고집이 있고, 먹는 것을 좋아하며, 가정적입니다. 예술이나 요리에 재능이 있습니다.',
      '신': '일지 신금(申金) — 재치 있고 영민합니다. 원숭이의 기지로 어떤 상황에서도 빠져나가는 능력이 있고, 변화에 빠르게 적응합니다. 다재다능한 타입입니다.',
      '유': '일지 유금(酉金) — 깔끔하고 미적 감각이 뛰어납니다. 닭(酉)의 정확함으로 디테일에 강하고, 외모에 신경 많이 쓰며, 비판적 시각을 가지고 있습니다.',
      '술': '일지 술토(戌土) — 의리 있고 충성스럽습니다. 개(犬)의 충직함으로 한번 믿은 사람을 끝까지 지킵니다. 정의감이 강하고, 늦게 빛나는 대기만성형입니다.',
      '해': '일지 해수(亥水) — 포용력이 넓고 창의적입니다. 돼지(亥)의 복덕으로 먹을 복이 있고, 마음이 넓습니다. 해외 인연이 있으며, 어디서든 적응 잘합니다.',
    };

    iljuInteraction = `\n\n【일주(일간+일지)의 고유 성격】\n`;
    iljuInteraction += ILJI_CHARACTER[iljiJiji] || '';

    // 일간-일지 상생/상극 관계 분석
    if (OHAENG_SANGSAENG[ilOhaeng] === iljiOh) {
      iljuInteraction += `\n일간(${ilOhaeng})이 일지(${iljiOh})를 생(生)합니다 — 자기 에너지를 주변에 나눠주는 타입. 베풀기 좋아하지만, 자신은 소진될 수 있으니 자기 관리가 중요합니다.`;
    } else if (OHAENG_SANGSAENG[iljiOh] === ilOhaeng) {
      iljuInteraction += `\n일지(${iljiOh})가 일간(${ilOhaeng})을 생(生)합니다 — 배우자나 가까운 사람에게 도움을 많이 받는 타입. 복이 많고 편안한 삶을 살기 쉽습니다.`;
    } else if (OHAENG_SANGGEUK[ilOhaeng] === iljiOh) {
      iljuInteraction += `\n일간(${ilOhaeng})이 일지(${iljiOh})를 극(克)합니다 — 배우자에게 요구가 많거나 지배적일 수 있습니다. 상대방을 존중하는 연습이 필요합니다.`;
    } else if (OHAENG_SANGGEUK[iljiOh] === ilOhaeng) {
      iljuInteraction += `\n일지(${iljiOh})가 일간(${ilOhaeng})을 극(克)합니다 — 배우자에게 눌리거나 스트레스받을 수 있지만, 이것이 오히려 성장의 동력이 됩니다.`;
    } else if (ilOhaeng === iljiOh) {
      iljuInteraction += `\n일간과 일지가 같은 오행(${ilOhaeng})입니다 — 자기 중심이 뚜렷하고 주관이 강합니다. 독립적이며 자수성가할 가능성이 높습니다.`;
    }
  }

  // 월간-일간 상호작용 (사회적 나 vs 진짜 나)
  let monthInteraction = '';
  if (monthPillar) {
    const monthGanOh = monthPillar.cheonganOhaeng;
    if (monthGanOh !== ilOhaeng) {
      if (OHAENG_SANGSAENG[monthGanOh] === ilOhaeng) {
        monthInteraction = `\n\n【사회적 나 vs 진짜 나】\n월간(${monthGanOh})이 일간(${ilOhaeng})을 생해줘서, 사회생활에서 도움을 잘 받고 환경이 나에게 유리합니다. 직장운이 좋은 편입니다.`;
      } else if (OHAENG_SANGGEUK[monthGanOh] === ilOhaeng) {
        monthInteraction = `\n\n【사회적 나 vs 진짜 나】\n월간(${monthGanOh})이 일간(${ilOhaeng})을 극해서, 사회생활에서 압박이나 스트레스를 받기 쉽습니다. 하지만 이 긴장감이 오히려 성장의 원동력이 됩니다.`;
      } else if (OHAENG_SANGSAENG[ilOhaeng] === monthGanOh) {
        monthInteraction = `\n\n【사회적 나 vs 진짜 나】\n일간(${ilOhaeng})이 월간(${monthGanOh})을 생해줘서, 직장이나 사회에서 에너지를 많이 쏟는 타입입니다. 일에 올인하는 만큼 번아웃에 주의하세요.`;
      }
    }
  }

  // ★ 다이나믹 타이틀 생성 (가장 강한 오행 + 월주 십성 조합)
  const OHAENG_TITLE: Record<string, string> = {
    '목': '성장 본능이 숨쉬는', '화': '뜨거운 열정을 품은', '토': '단단하고 흔들림 없는', '금': '날카롭고 결단력 있는', '수': '깊고 유연한 지혜의'
  };
  const TYPE_KEYWORDS: Record<string, string> = {
    '비견': '개척자', '겁재': '승부사', '식신': '예술가', '상관': '혁신가',
    '편재': '전략가', '정재': '관리자', '편관': '통솔자', '정관': '원칙주의자',
    '편인': '영감형 탐구자', '정인': '지적 학자',
  };
  const headline = `🌟 [ ${OHAENG_TITLE[dominantOhaeng]} ${TYPE_KEYWORDS[monthSipseong]} ]\n\n`;

  // 특이 구조 판별
  let specialTrait = '';
  if (ohaengBalance[dominantOhaeng] >= 40) {
    specialTrait += `타고난 성향 중 ${OHAENG_MEANING[dominantOhaeng]}의 비중이 40% 이상으로 압도적입니다. 이는 강한 줏대와 개성을 의미하지만, 타인과 타협하는 연습이 꼭 필요합니다.\n`;
  }
  if (ohaengBalance[weakestOhaeng] === 0) {
    specialTrait += `사주 팔자에 ${OHAENG_MEANING[weakestOhaeng]}의 기운이 전혀 없습니다. 없는 기운을 억지로 채우기보다, 가진 장점(넘치는 기운)을 극대화하는 전략이 유리합니다.\n`;
  }
  if (sipseongs.month === '상관' && sipseongs.hour === '편관') {
    specialTrait += `특히 기존 체제를 거부하는 상관과 권력을 상징하는 편관이 공존하여, 강한 카리스마와 반항아적 기질이 묘하게 섞여 있는 매력적인 캐릭터입니다.\n`;
  }

  // 일주 상세 해석 (60갑자 고유 설명)
  let iljuFullSection = '';
  if (iljuFullDesc && dayPillar) {
    iljuFullSection = `\n\n【${dayPillar.cheongan}${dayPillar.jiji}일주의 고유 특성】\n${iljuFullDesc}`;
  }

  // 천간합/지지합충 분석 결과
  let interactionsSection = '';
  if (interactionsSummary) {
    interactionsSection = `\n\n【사주 원국의 합·충 구조】\n${interactionsSummary}`;
  }

  // ★ 문단 재구성: 중복 제거 (오행밸런스, 용신팁, 연/월/시 십성은 별도 UI로 표시)
  // description에는 일간 성격 + 일주 고유성 + 합충 구조 + 월간상호작용만 포함
  return headline
    + `가장 본질적인 자아(일간)를 보면, 당신은 ${baseDesc} `
    + (specialTrait ? `\n\n【사주 원국의 가장 큰 특징】\n${specialTrait}` : '')
    + `${iljuFullSection}`
    + `${iljuInteraction}`
    + `${interactionsSection}`
    + `${monthInteraction}`;
}

const OHAENG_COLOR_NAME: Record<Ohaeng, string> = {
  '목': '초록', '화': '빨강', '토': '노랑', '금': '흰색', '수': '파랑/검정',
};

/**
 * 오행 분포 계산 (천간, 지지, 장간 모두 포함)
 */
function calculateOhaengBalance(pillars: SajuPillar[], isTimeUnknown?: boolean): Record<Ohaeng, number> {
  const balance: Record<Ohaeng, number> = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };

  // 지장간 가중치: 본기/정기(첫번째)=0.7, 중기=0.3, 여기(마지막)=0.1
  // JIJI_JANGGAN 배열 순서: [본기, 중기, 여기] → 가중치도 같은 순서
  const JANGGAN_WEIGHTS: Record<number, number[]> = {
    1: [0.7],
    2: [0.7, 0.3],
    3: [0.7, 0.3, 0.1],
  };

  for (let i = 0; i < pillars.length; i++) {
    if (isTimeUnknown && i === 3) continue; // Skip hour pillar
    const pillar = pillars[i];
    // 천간 오행 (가중치 1.0)
    balance[pillar.cheonganOhaeng] += 1.0;
    // 지지 본기 오행 (가중치 1.2 — 지지는 천간보다 약간 더 강하게 작용)
    balance[pillar.jijiOhaeng] += 1.2;
    // 지장간 오행 (여기/중기/정기 가중치 차등 적용)
    const jangganList = JIJI_JANGGAN[pillar.jiji];
    const weights = JANGGAN_WEIGHTS[jangganList.length] || [0.5];
    for (let j = 0; j < jangganList.length; j++) {
      balance[CHEONGAN_OHAENG[jangganList[j]]] += weights[j] || 0.3;
    }
  }

  // 부동소수점 정리 - 소수점 1자리로 반올림
  for (const key of Object.keys(balance)) {
    balance[key as Ohaeng] = Math.round(balance[key as Ohaeng] * 10) / 10;
  }

  return balance;
}

/**
 * 용신 판단 (종격 대응 버전)
 * ① 종격 여부를 먼저 판단 → 종격이면 종격 용신 결정법 적용
 * ② 정격이면 신강/신약에 따라 기존 방식
 *
 * 종격 용신 원리:
 *   종강격: 비겁+인성 방향이 용신 (강한 흐름을 따라가야 길)
 *   종아격: 식상+재성 방향이 용신
 *   종재격: 재성+식상 방향이 용신
 *   종관/종살격: 관성+재성 방향이 용신
 */
function determineYongsin(
  ilganOhaeng: Ohaeng,
  balance: Record<Ohaeng, number>,
  wonJiji?: string[],
  monthJiji?: string,  // 월지 (득령 판정용)
  allPillars?: { cheongan: string; jiji: string }[],  // 전체 기둥 (득지/득세 판정용)
): { yongsin: Ohaeng; gisin: Ohaeng; strengthScore: number } {
  const total = Object.values(balance).reduce((a, b) => a + b, 0);
  // 인성 오행 (나를 생해주는 오행)
  const inOhaeng = Object.entries(OHAENG_SANGSAENG).find(([, v]) => v === ilganOhaeng)![0] as Ohaeng;
  // 식상 오행 (내가 생하는 오행)
  const shikSang = OHAENG_SANGSAENG[ilganOhaeng];
  // 재성 오행 (내가 극하는 오행)
  const jae = OHAENG_SANGGEUK[ilganOhaeng];
  // 관성 오행 (나를 극하는 오행)
  const gwan = Object.entries(OHAENG_SANGGEUK).find(([, v]) => v === ilganOhaeng)?.[0] as Ohaeng | undefined;

  const ilBal = balance[ilganOhaeng] || 0;
  const inBal = balance[inOhaeng] || 0;
  const myForce = ilBal + inBal;  // 비겁 + 인성

  // ═══════════════════════════════════════════════
  // ★ 신강/신약 정밀 판정: 득령 + 득지 + 득세 3요소
  // ═══════════════════════════════════════════════

  // ────── (1) 득령(得令): 월지에서 힘을 얻는가 (가장 중요, 40점 배점) ──────
  // 월령은 사주에서 가장 강한 기운. 월지 오행/지장간이 일간을 돕는지 판단.
  let deukryeong = 0; // 0~40점

  if (monthJiji) {
    const woljiOh = JIJI_OHAENG[monthJiji];
    const woljiJanggan = JIJI_JANGGAN[monthJiji] || [];

    // (1a) 월지 본기 오행이 일간과 같으면 (비겁) → 매우 강한 득령
    if (woljiOh === ilganOhaeng) {
      deukryeong += 30;
    }
    // (1b) 월지 본기 오행이 인성이면 (나를 생해주는 오행) → 강한 득령
    else if (OHAENG_SANGSAENG[woljiOh] === ilganOhaeng) {
      deukryeong += 25;
    }
    // (1c) 월지 본기가 식상이면 → 설기(泄氣), 약간 실령
    else if (woljiOh === shikSang) {
      deukryeong -= 5;
    }
    // (1d) 월지 본기가 재성이면 → 극출(剋出), 실령
    else if (woljiOh === jae) {
      deukryeong -= 10;
    }
    // (1e) 월지 본기가 관성이면 → 극입(剋入), 강한 실령
    else if (gwan && woljiOh === gwan) {
      deukryeong -= 15;
    }

    // (1f) 월지 지장간에 일간과 같은 천간(비겁)이 있으면 추가 득령
    for (const jg of woljiJanggan) {
      if (CHEONGAN_OHAENG[jg] === ilganOhaeng) {
        deukryeong += 8;
        break;
      }
    }
    // (1g) 월지 지장간에 인성 오행이 있으면 추가 득령
    for (const jg of woljiJanggan) {
      if (OHAENG_SANGSAENG[CHEONGAN_OHAENG[jg]] === ilganOhaeng) {
        deukryeong += 5;
        break;
      }
    }
  }

  // ────── (2) 득지(得地): 일지/시지/연지에 통근(뿌리)이 있는가 (30점 배점) ──────
  // 일간과 같은 오행(비겁) 또는 인성 오행이 지지에 있으면 통근
  let deukji = 0; // 0~30점

  if (wonJiji) {
    // 일지 통근 (가장 중요 — 일지는 일간의 좌하, 가장 가까운 뿌리)
    const ilji = wonJiji[2]; // index 2 = 일지
    if (ilji) {
      const iljiOh = JIJI_OHAENG[ilji];
      const iljiJanggan = JIJI_JANGGAN[ilji] || [];
      // 일지 본기가 비겁(같은 오행)
      if (iljiOh === ilganOhaeng) deukji += 12;
      // 일지 본기가 인성
      else if (OHAENG_SANGSAENG[iljiOh] === ilganOhaeng) deukji += 10;
      // 일지 지장간에 비겁/인성이 있으면 (본기가 아니더라도 뿌리)
      for (const jg of iljiJanggan) {
        const jgOh = CHEONGAN_OHAENG[jg];
        if (jgOh === ilganOhaeng || OHAENG_SANGSAENG[jgOh] === ilganOhaeng) {
          deukji += 3;
          break;
        }
      }
    }

    // 연지 통근
    const yeonji = wonJiji[0]; // index 0 = 연지
    if (yeonji) {
      const yeonjiOh = JIJI_OHAENG[yeonji];
      if (yeonjiOh === ilganOhaeng) deukji += 5;
      else if (OHAENG_SANGSAENG[yeonjiOh] === ilganOhaeng) deukji += 4;
    }

    // 시지 통근
    const siji = wonJiji[3]; // index 3 = 시지
    if (siji) {
      const sijiOh = JIJI_OHAENG[siji];
      if (sijiOh === ilganOhaeng) deukji += 7;
      else if (OHAENG_SANGSAENG[sijiOh] === ilganOhaeng) deukji += 5;
    }
  }

  // ────── (3) 득세(得勢): 천간에 비겁/인성이 많은가 (30점 배점) ──────
  // 천간(연간/월간/시간)에 일간과 같은 오행 또는 인성 오행이 있으면 득세
  let deukse = 0; // 0~30점

  if (allPillars) {
    // 연간(index 0), 월간(index 1), 시간(index 3) 검사 (일간=index 2는 제외)
    for (let i = 0; i < allPillars.length; i++) {
      if (i === 2) continue; // 일간 자신은 제외
      const ganOh = CHEONGAN_OHAENG[allPillars[i].cheongan];
      if (ganOh === ilganOhaeng) {
        // 비겁(비견/겁재)이 천간에 있음
        deukse += (i === 1) ? 10 : 7; // 월간이면 더 중요
      } else if (OHAENG_SANGSAENG[ganOh] === ilganOhaeng) {
        // 인성이 천간에 있음
        deukse += (i === 1) ? 8 : 5;
      }
    }
  }

  // ────── 신강/신약 종합 판정 ──────
  // 총 100점 만점: 득령 40 + 득지 30 + 득세 30
  const strengthScore = deukryeong + deukji + deukse;

  // 추가: 오행밸런스 비율도 보조 지표로 사용
  const balanceRatio = myForce / total; // 비겁+인성 비율

  // 신강 기준: 40점 이상 또는 밸런스 비율 50% 이상
  // 극신강: 65점 이상
  // 신약: 25점 미만 그리고 밸런스 비율 40% 미만
  // 극신약: 15점 미만
  // 나머지: 중화(보통)

  const isExtremeStrong = strengthScore >= 65 && balanceRatio >= 0.55;
  const isStrong = strengthScore >= 40 || balanceRatio >= 0.50;
  const isExtremeWeak = strengthScore < 15 && balanceRatio < 0.30;
  const isWeak = strengthScore < 25 && balanceRatio < 0.40;
  // 중화: !isStrong && !isWeak

  // ═══════════════════════════════════════════════
  // ★ 종격 판단 (극단적 편중에서만)
  // ═══════════════════════════════════════════════

  const antiGanCount = [balance[shikSang] || 0, balance[jae] || 0, balance[gwan!] || 0]
    .filter(v => v >= 1.0).length;

  // 종강격: 비겁+인성이 85% 이상, 일간 6 이상, 반대세력 거의 없음
  if (myForce >= total * 0.85 && ilBal >= 6 && antiGanCount <= 1) {
    const yongsin = balance[inOhaeng] <= balance[ilganOhaeng] ? inOhaeng : ilganOhaeng;
    const gisin = shikSang;
    return { yongsin, gisin, strengthScore: 80 }; // 종강격 = 극신강
  }

  // 종아격: 식상이 40% 이상, 일간 2 이상
  if ((balance[shikSang] || 0) >= total * 0.4 && ilBal >= 2) {
    const yongsin = balance[shikSang] >= balance[jae] ? jae : shikSang;
    const gisin = inOhaeng;
    return { yongsin, gisin, strengthScore: 10 }; // 종아격 = 극신약
  }

  // 종재격: 재성이 35% 이상, 일간 2 이하
  if ((balance[jae] || 0) >= total * 0.35 && ilBal <= 2) {
    const yongsin = jae;
    const gisin = ilganOhaeng;
    return { yongsin, gisin, strengthScore: 5 }; // 종재격 = 극신약
  }

  // 종관/종살격: 관성이 35% 이상, 일간 2 이하
  if (gwan && (balance[gwan] || 0) >= total * 0.35 && ilBal <= 2) {
    const yongsin = gwan;
    const gisin = shikSang;
    return { yongsin, gisin, strengthScore: 5 }; // 종살격 = 극신약
  }

  // ═══════════════════════════════════════════════
  // ★ 정격 — 신강/신약에 따른 용신/기신 결정
  // ═══════════════════════════════════════════════

  if (isExtremeStrong) {
    // 극신강: 관성(나를 극하는 오행)이 용신, 비겁이 기신
    // 힘이 너무 강하면 관(官)으로 다스려야 함
    const yongsin = gwan || shikSang;
    const gisin = ilganOhaeng; // 비겁이 기신
    return { yongsin, gisin, strengthScore };
  }

  if (isStrong) {
    // 신강: 식상 또는 재성이 용신 (힘을 빼줘야 함)
    // 식상과 재성 중 더 부족한 쪽이 용신
    const yongsin = (balance[shikSang] || 0) <= (balance[jae] || 0) ? shikSang : jae;
    // 기신: 인성 (일간을 더 강하게 만드는 오행)
    const gisin = inOhaeng;
    return { yongsin, gisin, strengthScore };
  }

  if (isExtremeWeak) {
    // 극신약: 인성이 용신 (나를 생해주는 오행으로 살려야 함)
    // 관성이 가장 위험한 기신
    const yongsin = inOhaeng;
    const gisin = gwan || jae;
    return { yongsin, gisin, strengthScore };
  }

  if (isWeak) {
    // 신약: 비겁 또는 인성이 용신 (힘을 보태줘야 함)
    // 비겁과 인성 중 더 부족한 쪽이 용신
    const yongsin = (balance[inOhaeng] || 0) <= (balance[ilganOhaeng] || 0) ? inOhaeng : ilganOhaeng;
    // 기신: 관성(나를 극하는 오행) — 신약에게 관살은 가장 위험
    // 재성보다 관성이 더 해로움 (관이 나를 직접 극함)
    const gisin = gwan || jae;
    return { yongsin, gisin, strengthScore };
  }

  // ── 중화(中和): 신강도 신약도 아닌 균형 잡힌 사주 ──
  // 조후(調候)나 격국에 따라 판단해야 하지만, 기본적으로
  // 가장 부족한 오행이 용신, 가장 과다한 오행이 기신
  {
    const sortedOh = (Object.entries(balance) as [Ohaeng, number][]).sort((a, b) => a[1] - b[1]);
    const weakestOh = sortedOh[0][0];
    const strongestOh = sortedOh[sortedOh.length - 1][0];
    // 가장 부족한 오행 중 일간에게 유리한 것 우선
    let yongsin: Ohaeng = weakestOh;
    // 약한 오행 중에서 인성/비겁이면 더 좋음
    for (const [oh] of sortedOh) {
      if (oh === inOhaeng || oh === ilganOhaeng) {
        yongsin = oh;
        break;
      }
    }
    // 기신: 가장 과다한 오행
    let gisin: Ohaeng = strongestOh;
    if (gisin === ilganOhaeng) {
      // 비겁이 가장 많으면 → 식상을 설기로 기신 대신 사용
      gisin = shikSang;
    }
    return { yongsin, gisin, strengthScore };
  }
}

/**
 * 사주 팔자 전체 분석
 */
/**
 * 날짜 유효성 검증 — 존재하지 않는 날짜(2월 30일 등) 방지
 */
export function isValidDate(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 99; // 100세 제한
  if (year < minYear || year > currentYear) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function analyzeSaju(
  year: number,
  month: number,
  day: number,
  hour: number,
  gender: 'male' | 'female' = 'male',
  relationship: 'single' | 'dating' | 'married' = 'single',
  minute: number = 0,
  useYajasi: boolean = true,
  isTimeUnknown: boolean = false,
  skipKstCorrection: boolean = false,
  hasChildren: boolean = false,
): SajuResult {
  // 날짜 유효성 검증
  if (!isValidDate(year, month, day)) {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 99;
    throw new Error(`유효하지 않은 날짜입니다: ${year}년 ${month}월 ${day}일. ${minYear}~${currentYear}년 사이의 올바른 양력 날짜를 입력해주세요. (100세 이하)`);
  }

  // 네 기둥 계산
  const yearRaw = calculateYearPillar(year, month, day, hour, minute);
  const monthRaw = calculateMonthPillar(yearRaw.cheongan, month, day, year);
  let dayRaw = calculateDayPillar(year, month, day);
  const hourRaw = calculateHourPillar(dayRaw.cheongan, hour, minute, skipKstCorrection);

  // 야자시/조자시 처리
  // 태양시 보정 후 자시(KST 23:30~01:30)에 해당하는 경우의 일주 결정
  // 옵션 OFF (useYajasi=false): KST 23:30 이후 출생은 무조건 다음날 일주 사용
  // 옵션 ON  (useYajasi=true):  야자시(KST 23:30~00:30) = 당일 일주 유지
  //                              조자시(KST 00:30~01:30) = 다음날 일주 사용
  const isJasi = hourRaw.jiji === '자'; // 보정 후 자시에 해당

  if (isJasi) {
    if (!useYajasi) {
      // 옵션 OFF: 23:30 이후(보정 후 자시)면 무조건 다음날 일주
      if (hour >= 23) {
        const nextDay = new Date(year, month - 1, day + 1);
        dayRaw = calculateDayPillar(nextDay.getFullYear(), nextDay.getMonth() + 1, nextDay.getDate());
      }
    } else {
      // 옵션 ON: 조자시(보정 후 자시이면서 원래 시각 0시~1시대) → 다음날 일주
      // 야자시(원래 시각 23시대) → 당일 유지 (변경 없음)
      if (hour >= 0 && hour < 2) {
        // 조자시: 이미 날짜가 넘어간 시각이므로 일주 변경 불필요 (이미 다음날)
        // 단, 사용자가 입력한 날짜가 이미 다음날이므로 그대로 유지
      }
      // 야자시(23시대): 당일 유지 → 변경 없음
    }
  }

  const yearPillar = makePillar(yearRaw.cheongan, yearRaw.jiji);
  const monthPillar = makePillar(monthRaw.cheongan, monthRaw.jiji);
  const dayPillar = makePillar(dayRaw.cheongan, dayRaw.jiji);
  const hourPillar = makePillar(hourRaw.cheongan, hourRaw.jiji);

  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar];

  // 일간
  const ilgan = dayPillar.cheongan;

  // 오행 분포
  const ohaengBalance = calculateOhaengBalance(pillars, isTimeUnknown);

  // 부동소수점 정리 (이중 안전장치)
  for (const key of Object.keys(ohaengBalance)) {
    ohaengBalance[key as Ohaeng] = Math.round(ohaengBalance[key as Ohaeng] * 10) / 10;
  }

  // 가장 강한/약한 오행
  const ohaengEntries = Object.entries(ohaengBalance) as [Ohaeng, number][];
  const dominantOhaeng = ohaengEntries.sort((a, b) => b[1] - a[1])[0][0];
  const weakestOhaeng = ohaengEntries.sort((a, b) => a[1] - b[1])[0][0];

  // 용신/기신 (원국 지지 배열 전달 → 종격 판정 시 반대 세력의 뿌리 유무 체크)
  const wonJijiList = pillars.map(p => p.jiji);
  const { yongsin, gisin, strengthScore } = determineYongsin(
    CHEONGAN_OHAENG[ilgan],
    ohaengBalance,
    wonJijiList,
    monthPillar.jiji,  // 월지 (득령 판정용)
    pillars,           // 전체 기둥 (득지/득세 판정용)
  );

  // 십성 (일간 기준)
  const sipseongs = {
    year: calculateSipseong(ilgan, yearPillar.cheongan),
    month: calculateSipseong(ilgan, monthPillar.cheongan),
    hour: calculateSipseong(ilgan, hourPillar.cheongan),
  };

  // 지장간 사령 십성 (각 기둥의 지지 속 사령 천간의 십성)
  const jangganSipseongs = [yearPillar, monthPillar, dayPillar, hourPillar].map(p => {
    const saryeong = getSaryeong(p.jiji);
    return {
      jiji: p.jiji,
      saryeong,
      sipseong: saryeong ? calculateSipseong(ilgan, saryeong) : '비견' as Sipseong,
    };
  });

  // 십신 불균형 심리 분석
  const sipseongBalance = analyzeSipseongBalance(sipseongs, jangganSipseongs.map(j => j.sipseong), ilgan, gender);

  // 정밀 사령 분석 — 월지 절기부터 출생일까지의 경과일수로 정밀 사령 도출
  const monthJijiIdx = getMonthJijiIndex(month, day, year);
  const monthJijiName = JIJI[monthJijiIdx];
  // 현재 월의 절기 날짜 계산
  const currentJeolgi = JEOLGI_DATES.find(j => j.monthJiji === monthJijiIdx);
  let daysFromJeolgi = 0;
  if (currentJeolgi) {
    const jeolgiDay = year ? getJeolgiDay(year, currentJeolgi.name, currentJeolgi.day) : currentJeolgi.day;
    if (month === currentJeolgi.month && day >= jeolgiDay) {
      daysFromJeolgi = day - jeolgiDay;
    } else if (month > currentJeolgi.month) {
      // 절기월과 양력월이 다른 경우 (예: 절기는 전월에 시작)
      const daysInPrevMonth = new Date(year, currentJeolgi.month, 0).getDate();
      daysFromJeolgi = (daysInPrevMonth - jeolgiDay) + day;
    } else {
      daysFromJeolgi = day; // fallback
    }
  }
  const saryeongGan = getPreciseSaryeong(monthPillar.jiji, daysFromJeolgi);
  const allCheongan = [yearPillar.cheongan, monthPillar.cheongan, dayPillar.cheongan, hourPillar.cheongan];
  const saryeongAnalysis = analyzeSaryeongPsychology(ilgan, monthPillar.jiji, saryeongGan, allCheongan);

  // 띠
  const yearJijiIdx = JIJI.indexOf(yearPillar.jiji as typeof JIJI[number]);
  const animal = ANIMALS[yearJijiIdx];

  // 일주 조합 해석 (확장된 60일주 상세 설명 우선 사용)
  const iljuKey = dayPillar.cheongan + dayPillar.jiji;
  let iljuDesc = ILJU_FULL_DESCRIPTION[iljuKey] || ILJU_COMBINATION[iljuKey] || `${iljuKey}일주 — ${ILGAN_DESCRIPTION[ilgan]}`;

  // 일간 오행 기반 정신건강 경향 동적 추가
  const ILJU_MENTAL: Record<Ohaeng, string> = {
    '목': ' 정신건강: 우울감·의욕 저하·무기력 경향 주의. 스트레스 시 분노·짜증이 폭발할 수 있으니 산림욕·규칙적 수면이 중요.',
    '화': ' 정신건강: 불안·초조·공황·불면 경향 주의. 흥분이 과해지면 심장에 부담이 오니 명상·복식호흡으로 마음을 가라앉히세요.',
    '토': ' 정신건강: 걱정·강박·과잉사고 경향 주의. 같은 생각을 반복하며 잠 못 드는 패턴이 나타날 수 있으니 산책·저널링이 도움.',
    '금': ' 정신건강: 슬픔·비관적 사고·완벽주의 스트레스 경향 주의. 자기비판이 심해질 수 있으니 사회적 교류와 취미활동을 유지하세요.',
    '수': ' 정신건강: 공포·두려움·위축감 경향 주의. 새로운 도전을 두려워하는 경향이 있으니 작은 성취감을 쌓는 활동이 효과적.',
  };
  const ilganOhaeng = CHEONGAN_OHAENG[ilgan];
  if (ilganOhaeng && ILJU_MENTAL[ilganOhaeng]) {
    iljuDesc += ILJU_MENTAL[ilganOhaeng];
  }

  // 천간합/지지합충 분석
  const pillarsForInteraction = [
    { cheongan: yearPillar.cheongan, jiji: yearPillar.jiji },
    { cheongan: monthPillar.cheongan, jiji: monthPillar.jiji },
    { cheongan: dayPillar.cheongan, jiji: dayPillar.jiji },
    { cheongan: hourPillar.cheongan, jiji: hourPillar.jiji },
  ];
  const interactions = analyzeSajuInteractions(pillarsForInteraction);

  // 시주 정보 (시간대별 이름 및 의미)
  // hour 값에서 지지 인덱스를 역산하여 HOUR_NAME 매핑
  let hourNameIdx: number;
  if (hour === 23 || hour === 0) hourNameIdx = 0;
  else if (hour >= 1 && hour < 3) hourNameIdx = 1;
  else if (hour >= 3 && hour < 5) hourNameIdx = 2;
  else if (hour >= 5 && hour < 7) hourNameIdx = 3;
  else if (hour >= 7 && hour < 9) hourNameIdx = 4;
  else if (hour >= 9 && hour < 11) hourNameIdx = 5;
  else if (hour >= 11 && hour < 13) hourNameIdx = 6;
  else if (hour >= 13 && hour < 15) hourNameIdx = 7;
  else if (hour >= 15 && hour < 17) hourNameIdx = 8;
  else if (hour >= 17 && hour < 19) hourNameIdx = 9;
  else if (hour >= 19 && hour < 21) hourNameIdx = 10;
  else hourNameIdx = 11;
  const hourInfo = HOUR_NAME[hourNameIdx];

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    ilgan,
    ohaengBalance,
    dominantOhaeng,
    weakestOhaeng,
    yongsin,
    gisin,
    sipseongs,
    sipseongBalance,
    jangganSipseongs,
    saryeongAnalysis: {
      saryeongGan,
      ...saryeongAnalysis,
    },
    animal,
    description: generateDetailedDescription(
      ilgan, hourPillar, ohaengBalance, sipseongs, yongsin, gisin, dominantOhaeng, weakestOhaeng, dayPillar, monthPillar,
      interactions.summary, ILJU_FULL_DESCRIPTION[iljuKey]
    ),
    iljuDesc,
    interactions,
    hourInfo,
    gender,
    relationship,
    hasChildren,
    age: new Date().getFullYear() - year + 1,
    isYajasi: hourRaw.isYajasi,
    isTimeUnknown,
    warnings: generateWarnings(month, day),
    strengthScore,  // 신강/신약 종합 점수 (득령+득지+득세)
  };
}

/**
 * 절기 경계일 등 정밀도 관련 경고 메시지 생성
 */
function generateWarnings(month: number, day: number): string[] {
  const warnings: string[] = [];
  // 절기 경계일 체크 (입춘은 정밀 데이터가 있으므로 제외)
  const JEOLGI_BOUNDARIES: { month: number; minDay: number; maxDay: number; name: string }[] = [
    { month: 1, minDay: 5, maxDay: 7, name: '소한' },
    { month: 3, minDay: 5, maxDay: 7, name: '경칩' },
    { month: 4, minDay: 4, maxDay: 6, name: '청명' },
    { month: 5, minDay: 5, maxDay: 7, name: '입하' },
    { month: 6, minDay: 5, maxDay: 7, name: '망종' },
    { month: 7, minDay: 6, maxDay: 8, name: '소서' },
    { month: 8, minDay: 6, maxDay: 8, name: '입추' },
    { month: 9, minDay: 7, maxDay: 9, name: '백로' },
    { month: 10, minDay: 7, maxDay: 9, name: '한로' },
    { month: 11, minDay: 6, maxDay: 8, name: '입동' },
    { month: 12, minDay: 6, maxDay: 8, name: '대설' },
  ];
  for (const b of JEOLGI_BOUNDARIES) {
    if (month === b.month && day >= b.minDay && day <= b.maxDay) {
      warnings.push(`${b.name} 절기 경계일(${b.month}/${b.minDay}~${b.maxDay})에 해당합니다. 연도에 따라 월주가 달라질 수 있으니, 만세력에서 정확한 절기 시각을 확인해보세요.`);
      break;
    }
  }
  return warnings;
}

/**
 * 합충 결과를 반영한 새로운 오행 점수 밸런스를 바탕으로 사주 원국을 재분석합니다.
 */
export function recalculateSajuWithNewBalance(
  saju: SajuResult,
  newBalance: Record<Ohaeng, number>
): SajuResult {
  const ohaengEntries = Object.entries(newBalance) as [Ohaeng, number][];
  const dominantOhaeng = ohaengEntries.sort((a, b) => b[1] - a[1])[0][0];
  const weakestOhaeng = ohaengEntries.sort((a, b) => a[1] - b[1])[0][0];

  const wonJijiList = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  const allPillars = [
    { cheongan: saju.year.cheongan, jiji: saju.year.jiji },
    { cheongan: saju.month.cheongan, jiji: saju.month.jiji },
    { cheongan: saju.day.cheongan, jiji: saju.day.jiji },
    { cheongan: saju.hour.cheongan, jiji: saju.hour.jiji },
  ];
  const { yongsin, gisin, strengthScore } = determineYongsin(
    CHEONGAN_OHAENG[saju.ilgan],
    newBalance,
    wonJijiList,
    saju.month.jiji,  // 월지 (득령 판정용)
    allPillars,       // 전체 기둥 (득지/득세 판정용)
  );

  const newDescription = generateDetailedDescription(
    saju.ilgan,
    saju.hour,
    newBalance,
    saju.sipseongs,
    yongsin,
    gisin,
    dominantOhaeng,
    weakestOhaeng,
    saju.day,
    saju.month
  );

  return {
    ...saju,
    ohaengBalance: newBalance,
    dominantOhaeng,
    weakestOhaeng,
    yongsin,
    gisin,
    description: newDescription,
    strengthScore,
  };
}
