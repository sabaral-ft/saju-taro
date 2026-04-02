/**
 * 타로 카드 데이터베이스
 * 78장 전체 (메이저 아르카나 22장 + 마이너 아르카나 56장)
 * 각 카드마다 정방향/역방향 해석 + 오행별 특수 해석 포함
 */

import type { Ohaeng } from '@/lib/saju-engine';

// 카발라 생명의 나무 통로 정보 (메이저 아르카나 전용)
export interface KabbalahPath {
  pathNumber: number;           // 11~32번 통로
  sephiroth: [string, string];  // 연결하는 두 세피로트
  hebrewLetter: string;         // 히브리어 글자 (한글)
  hebrewLetterEn: string;       // 히브리어 글자 (영문)
  letterCategory: 'mother' | 'double' | 'simple'; // 어머니/이중/단순 글자
  astrology: string;            // 점성술 대응 (원소/행성/별자리)
  realm: 'upper' | 'middle' | 'lower'; // 상위/중간/하위 영역
}

export interface TarotCard {
  id: number;
  name: string;
  nameEn: string;
  arcana: 'major' | 'minor';
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';
  number?: number;
  keywords: string[];
  // 기본 해석
  upright: string;
  reversed: string;
  // 사주 오행별 특수 해석 (핵심 차별점!)
  ohaengReading: Record<Ohaeng, { upright: string; reversed: string }>;
  // 연애/재물/건강/직업 상세 해석 (유료)
  detailed: {
    love: { upright: string; reversed: string };
    money: { upright: string; reversed: string };
    health: { upright: string; reversed: string };
    career: { upright: string; reversed: string };
  };
  // 카드 이미지 (CSS 그라데이션으로 대체)
  symbolColor: string;
  element: Ohaeng;
  // 카발라 생명의 나무 매핑 (메이저 아르카나 전용)
  kabbalah?: KabbalahPath;
}

// ========== 카발라 생명의 나무 × 메이저 아르카나 22개 통로 매핑 (황금새벽회 체계) ==========
const KABBALAH_PATHS: Record<number, KabbalahPath> = {
  0:  { pathNumber: 11, sephiroth: ['케테르', '호크마'], hebrewLetter: '알레프', hebrewLetterEn: 'Aleph', letterCategory: 'mother', astrology: '공기', realm: 'upper' },
  1:  { pathNumber: 12, sephiroth: ['케테르', '비나'], hebrewLetter: '베트', hebrewLetterEn: 'Beth', letterCategory: 'double', astrology: '수성', realm: 'upper' },
  2:  { pathNumber: 13, sephiroth: ['케테르', '티페레트'], hebrewLetter: '기멜', hebrewLetterEn: 'Gimel', letterCategory: 'double', astrology: '달', realm: 'upper' },
  3:  { pathNumber: 14, sephiroth: ['호크마', '비나'], hebrewLetter: '달레트', hebrewLetterEn: 'Daleth', letterCategory: 'double', astrology: '금성', realm: 'upper' },
  4:  { pathNumber: 15, sephiroth: ['호크마', '티페레트'], hebrewLetter: '헤', hebrewLetterEn: 'Heh', letterCategory: 'simple', astrology: '양자리', realm: 'upper' },
  5:  { pathNumber: 16, sephiroth: ['호크마', '헤세드'], hebrewLetter: '바우', hebrewLetterEn: 'Vau', letterCategory: 'simple', astrology: '황소자리', realm: 'upper' },
  6:  { pathNumber: 17, sephiroth: ['비나', '티페레트'], hebrewLetter: '자인', hebrewLetterEn: 'Zain', letterCategory: 'simple', astrology: '쌍둥이자리', realm: 'upper' },
  7:  { pathNumber: 18, sephiroth: ['비나', '게부라'], hebrewLetter: '헤트', hebrewLetterEn: 'Cheth', letterCategory: 'simple', astrology: '게자리', realm: 'upper' },
  8:  { pathNumber: 19, sephiroth: ['헤세드', '게부라'], hebrewLetter: '테트', hebrewLetterEn: 'Teth', letterCategory: 'simple', astrology: '사자자리', realm: 'middle' },
  9:  { pathNumber: 20, sephiroth: ['헤세드', '티페레트'], hebrewLetter: '요드', hebrewLetterEn: 'Yod', letterCategory: 'simple', astrology: '처녀자리', realm: 'middle' },
  10: { pathNumber: 21, sephiroth: ['헤세드', '네차흐'], hebrewLetter: '카프', hebrewLetterEn: 'Kaph', letterCategory: 'double', astrology: '목성', realm: 'middle' },
  11: { pathNumber: 22, sephiroth: ['게부라', '티페레트'], hebrewLetter: '라메드', hebrewLetterEn: 'Lamed', letterCategory: 'simple', astrology: '천칭자리', realm: 'middle' },
  12: { pathNumber: 23, sephiroth: ['게부라', '호드'], hebrewLetter: '멤', hebrewLetterEn: 'Mem', letterCategory: 'mother', astrology: '물', realm: 'middle' },
  13: { pathNumber: 24, sephiroth: ['티페레트', '네차흐'], hebrewLetter: '눈', hebrewLetterEn: 'Nun', letterCategory: 'simple', astrology: '전갈자리', realm: 'middle' },
  14: { pathNumber: 25, sephiroth: ['티페레트', '예소드'], hebrewLetter: '사메크', hebrewLetterEn: 'Samekh', letterCategory: 'simple', astrology: '사수자리', realm: 'middle' },
  15: { pathNumber: 26, sephiroth: ['티페레트', '호드'], hebrewLetter: '아인', hebrewLetterEn: 'Ayin', letterCategory: 'simple', astrology: '염소자리', realm: 'middle' },
  16: { pathNumber: 27, sephiroth: ['네차흐', '호드'], hebrewLetter: '페', hebrewLetterEn: 'Peh', letterCategory: 'double', astrology: '화성', realm: 'lower' },
  17: { pathNumber: 28, sephiroth: ['네차흐', '예소드'], hebrewLetter: '차디', hebrewLetterEn: 'Tzaddi', letterCategory: 'simple', astrology: '물병자리', realm: 'lower' },
  18: { pathNumber: 29, sephiroth: ['네차흐', '말쿠트'], hebrewLetter: '코프', hebrewLetterEn: 'Qoph', letterCategory: 'simple', astrology: '물고기자리', realm: 'lower' },
  19: { pathNumber: 30, sephiroth: ['호드', '예소드'], hebrewLetter: '레시', hebrewLetterEn: 'Resh', letterCategory: 'double', astrology: '태양', realm: 'lower' },
  20: { pathNumber: 31, sephiroth: ['호드', '말쿠트'], hebrewLetter: '신', hebrewLetterEn: 'Shin', letterCategory: 'mother', astrology: '불', realm: 'lower' },
  21: { pathNumber: 32, sephiroth: ['예소드', '말쿠트'], hebrewLetter: '타우', hebrewLetterEn: 'Tau', letterCategory: 'double', astrology: '토성', realm: 'lower' },
};

// ========== 수트별 점성술 대응 (4원소 × 별자리 그룹) ==========
export const SUIT_ZODIAC: Record<string, { element: string; elementEn: string; zodiacSigns: string[] }> = {
  wands:     { element: '불', elementEn: 'Fire',  zodiacSigns: ['양자리', '사자자리', '사수자리'] },
  cups:      { element: '물', elementEn: 'Water', zodiacSigns: ['게자리', '전갈자리', '물고기자리'] },
  swords:    { element: '공기', elementEn: 'Air',   zodiacSigns: ['쌍둥이자리', '천칭자리', '물병자리'] },
  pentacles: { element: '흙', elementEn: 'Earth', zodiacSigns: ['황소자리', '처녀자리', '염소자리'] },
};

// ========== 메이저 아르카나 22장 ==========

export const MAJOR_ARCANA: TarotCard[] = [
  {
    id: 0,
    name: '바보',
    nameEn: 'The Fool',
    arcana: 'major',
    keywords: ['새로운 시작', '순수', '모험', '자유', '무한 가능성'],
    symbolColor: '#fbbf24',
    element: '목',
    kabbalah: KABBALAH_PATHS[0],
    upright: '새로운 시작이 다가오고 있습니다. 두려움 없이 한 걸음을 내딛을 때입니다. 순수한 마음으로 세상을 바라보면 예상치 못한 기회가 찾아올 것입니다.',
    reversed: '무모한 결정을 주의하세요. 충분한 준비 없이 뛰어드는 것은 위험합니다. 현실을 직시하고 신중하게 계획을 세울 필요가 있습니다.',
    ohaengReading: {
      '목': {
        upright: '목(木)의 기운이 바보 카드를 만나 강력한 성장의 에너지가 됩니다. 봄날의 새싹처럼 거침없이 뻗어나갈 때입니다. 당신의 개척자 정신이 빛을 발할 시기입니다.',
        reversed: '목의 성급함이 바보의 무모함과 합쳐져 큰 실수를 부를 수 있습니다. 나무가 뿌리를 내리듯 기반을 먼저 다지세요.'
      },
      '화': {
        upright: '화(火)의 열정과 바보의 용기가 만나 강렬한 새 출발을 예고합니다. 당신의 밝은 에너지가 주변 사람들에게도 영감을 줄 것입니다.',
        reversed: '화의 성급함이 경솔한 판단으로 이어질 수 있습니다. 열정을 잠시 식히고 차분히 상황을 살펴보세요.'
      },
      '토': {
        upright: '토(土)의 안정감 위에서 새로운 도전을 시작하면 성공 확률이 높습니다. 당신의 신중한 성품이 모험에 균형을 더해줍니다.',
        reversed: '토의 보수적 성향이 새로운 시작을 방해할 수 있습니다. 때로는 익숙한 것을 내려놓아야 성장할 수 있습니다.'
      },
      '금': {
        upright: '금(金)의 결단력이 바보의 새 출발을 도와줍니다. 명확한 판단 아래 과감하게 움직이면 좋은 결과를 얻을 것입니다.',
        reversed: '금의 완벽주의가 새로운 시도를 막고 있습니다. 처음부터 완벽할 필요는 없습니다. 일단 시작하세요.'
      },
      '수': {
        upright: '수(水)의 유연함이 바보의 모험심과 어우러져, 물 흐르듯 자연스러운 변화가 찾아옵니다. 직감을 믿으세요.',
        reversed: '수의 불안정함이 방향 없는 방황으로 이어질 수 있습니다. 흘러가는 대로만 두지 말고 목표를 정하세요.'
      }
    },
    detailed: {
      love: {
        upright: '새로운 인연이 나타날 수 있는 시기입니다. 기존의 틀에서 벗어나 마음을 열어보세요. 예상치 못한 곳에서 인연을 만날 수 있습니다.',
        reversed: '감정에 휩쓸려 관계를 급하게 진전시키지 마세요. 상대방을 더 알아가는 시간이 필요합니다.'
      },
      money: {
        upright: '새로운 수입원이나 투자 기회가 보입니다. 그러나 큰 금액보다는 소액으로 시작하는 것이 좋습니다.',
        reversed: '충동적인 지출이나 무계획적인 투자를 피하세요. 재정 계획을 먼저 세워야 합니다.'
      },
      health: {
        upright: '새로운 운동이나 건강 관리 방법을 시도하기 좋은 때입니다. 활력이 넘치는 시기입니다.',
        reversed: '무리한 활동으로 체력이 소모될 수 있습니다. 안전에 유의하세요.'
      },
      career: {
        upright: '이직, 창업, 새로운 프로젝트 시작에 좋은 운입니다. 과감하게 도전해보세요.',
        reversed: '준비 없는 이직이나 무모한 창업은 위험합니다. 실력을 먼저 쌓으세요.'
      }
    }
  },
  {
    id: 1,
    name: '마법사',
    nameEn: 'The Magician',
    arcana: 'major',
    keywords: ['창조력', '의지력', '집중', '능력 발휘', '실현'],
    symbolColor: '#ef4444',
    element: '화',
    kabbalah: KABBALAH_PATHS[1],
    upright: '당신 안에 모든 것을 이룰 수 있는 힘이 있습니다. 의지와 집중력을 발휘하면 원하는 것을 현실로 만들 수 있는 때입니다.',
    reversed: '능력을 제대로 발휘하지 못하고 있습니다. 집중력이 흐트러지거나 속임수에 주의하세요. 진정한 실력을 키워야 합니다.',
    ohaengReading: {
      '목': {
        upright: '목의 성장력과 마법사의 창조력이 만나 대단한 성과를 낼 수 있습니다. 아이디어를 실행에 옮기세요.',
        reversed: '목의 확장 욕구가 현실성 없는 계획으로 이어질 수 있습니다. 실현 가능한 것에 집중하세요.'
      },
      '화': {
        upright: '화의 열정이 마법사의 실현력과 시너지를 냅니다. 강력한 의지로 목표를 달성할 수 있는 최상의 시기입니다.',
        reversed: '과도한 열정이 번아웃으로 이어질 수 있습니다. 에너지를 적절히 분배하세요.'
      },
      '토': {
        upright: '토의 현실감각이 마법사의 능력에 단단한 기반을 제공합니다. 실용적이고 확실한 성과를 낼 수 있습니다.',
        reversed: '지나친 현실주의가 창의적 발상을 막고 있습니다. 상상력을 좀 더 발휘해보세요.'
      },
      '금': {
        upright: '금의 예리함이 마법사의 집중력을 극대화합니다. 정확하고 효율적으로 일을 처리할 수 있습니다.',
        reversed: '지나친 분석이 행동을 지연시킵니다. 때로는 직감적으로 움직이는 것도 필요합니다.'
      },
      '수': {
        upright: '수의 지혜가 마법사의 기술과 합쳐져 깊이 있는 성과를 만듭니다. 직관과 논리를 함께 활용하세요.',
        reversed: '수의 유동성이 집중력을 방해합니다. 한 가지에 몰입하는 연습이 필요합니다.'
      }
    },
    detailed: {
      love: {
        upright: '당신의 매력이 빛나는 시기입니다. 적극적으로 다가가면 좋은 결과가 있을 것입니다. 소통 능력이 관계를 발전시킵니다.',
        reversed: '상대방에게 진심이 아닌 모습을 보여주고 있진 않나요? 진정성 있는 태도가 필요합니다.'
      },
      money: {
        upright: '재테크나 사업에서 능력을 발휘할 때입니다. 자신의 전문성을 활용한 수입 창출이 유리합니다.',
        reversed: '사기나 사기성 투자에 주의하세요. 너무 좋아 보이는 거래는 의심해볼 필요가 있습니다.'
      },
      health: {
        upright: '건강 관리에 대한 의지가 강한 시기입니다. 새로운 건강법을 시도하면 효과를 볼 수 있습니다.',
        reversed: '건강을 과신하지 마세요. 기본적인 생활 습관부터 점검이 필요합니다.'
      },
      career: {
        upright: '전문성이 빛나는 시기입니다. 프레젠테이션, 면접, 프로젝트 제안 등에서 좋은 성과를 낼 수 있습니다.',
        reversed: '과대포장이나 허풍에 주의하세요. 실력 이상의 것을 약속하면 곤란해질 수 있습니다.'
      }
    }
  },
  {
    id: 2,
    name: '여사제',
    nameEn: 'The High Priestess',
    arcana: 'major',
    keywords: ['직감', '신비', '내면의 지혜', '잠재의식', '인내'],
    symbolColor: '#6366f1',
    element: '수',
    kabbalah: KABBALAH_PATHS[2],
    upright: '내면의 목소리에 귀를 기울이세요. 보이지 않는 것에 답이 있습니다. 직감이 이성보다 정확한 시기이니, 조용히 자신의 내면을 탐색해보세요.',
    reversed: '직감을 무시하고 있거나, 비밀이 드러날 수 있습니다. 과도한 감정에 휘둘리지 말고 균형을 잡으세요.',
    ohaengReading: {
      '목': {
        upright: '목의 직선적 에너지가 여사제의 직관과 만나 명확한 방향을 찾게 됩니다. 내면의 소리를 따르면 성장의 길이 열립니다.',
        reversed: '성급하게 답을 찾으려 하지 마세요. 목의 조급함이 직관을 흐리게 합니다.'
      },
      '화': {
        upright: '화의 밝음이 여사제의 신비로운 영역을 비추어, 숨겨진 진실을 발견하게 합니다.',
        reversed: '화의 성급함이 깊은 통찰을 방해합니다. 차분히 기다리는 인내가 필요한 때입니다.'
      },
      '토': {
        upright: '토의 안정감 위에서 직관력이 극대화됩니다. 현실적인 감각과 영적 직관이 조화를 이룹니다.',
        reversed: '현실에만 집착하면 중요한 신호를 놓칠 수 있습니다. 마음의 눈을 열어보세요.'
      },
      '금': {
        upright: '금의 예리함이 직관을 더욱 날카롭게 만듭니다. 핵심을 꿰뚫는 통찰력을 발휘할 수 있습니다.',
        reversed: '분석적 사고에 너무 의존하면 직관이 무뎌집니다. 논리를 잠시 내려놓아 보세요.'
      },
      '수': {
        upright: '수의 직관력이 여사제와 완벽한 조화를 이룹니다. 당신의 예감은 거의 틀림없이 맞을 것입니다. 깊은 명상이 도움이 됩니다.',
        reversed: '수의 감정적 흐름에 너무 빠져들면 현실과 동떨어질 수 있습니다. 균형을 찾으세요.'
      }
    },
    detailed: {
      love: {
        upright: '아직 드러나지 않은 감정이 있습니다. 서두르지 말고 천천히 관계를 관찰하세요. 상대방의 진심이 곧 보일 것입니다.',
        reversed: '비밀연애나 숨겨진 감정이 문제가 될 수 있습니다. 솔직해질 필요가 있습니다.'
      },
      money: {
        upright: '겉으로 보이지 않는 재물 운이 있습니다. 직감적으로 끌리는 투자나 기회를 주시하세요.',
        reversed: '숨겨진 지출이나 재정적 비밀이 문제를 일으킬 수 있습니다. 가계부를 꼼꼼히 살펴보세요.'
      },
      health: {
        upright: '몸이 보내는 신호에 귀를 기울이세요. 명상이나 요가 같은 내면 수련이 건강에 도움이 됩니다.',
        reversed: '무시해온 건강 신호가 있다면 지금 체크하세요. 정기 검진을 받아보시기 바랍니다.'
      },
      career: {
        upright: '조용히 관찰하고 때를 기다리는 것이 좋습니다. 성급하게 나서기보다 정보를 모으세요.',
        reversed: '직장 내 보이지 않는 갈등이 있을 수 있습니다. 소문이나 험담에 주의하세요.'
      }
    }
  },
  {
    id: 3,
    name: '여황제',
    nameEn: 'The Empress',
    arcana: 'major',
    keywords: ['풍요', '모성', '자연', '창조', '아름다움'],
    symbolColor: '#22c55e',
    element: '토',
    kabbalah: KABBALAH_PATHS[3],
    upright: '풍요와 번영의 시기가 왔습니다. 창조적 에너지가 넘치며, 사랑과 아름다움이 가득한 때입니다. 자연과 교감하며 내면의 풍요를 키우세요.',
    reversed: '과잉 보호나 집착에 주의하세요. 창의력이 막혀있거나 의존적인 태도가 문제가 될 수 있습니다.',
    ohaengReading: {
      '목': { upright: '목의 성장력이 여황제의 풍요와 만나 대단한 번영을 예고합니다. 씨앗을 뿌린 것들이 풍성한 열매를 맺을 것입니다.', reversed: '지나친 확장 욕구가 오히려 자원을 분산시킵니다. 선택과 집중이 필요합니다.' },
      '화': { upright: '화의 에너지가 여황제의 창조력을 폭발시킵니다. 예술, 요리, 패션 등 아름다움과 관련된 분야에서 성과가 빛납니다.', reversed: '지나친 욕심이 아름다움을 해칩니다. 소박한 풍요에서 행복을 찾으세요.' },
      '토': { upright: '토와 여황제의 조합은 최고의 풍요를 상징합니다. 기름진 대지에서 모든 것이 자라나듯, 풍성한 결실의 시기입니다.', reversed: '지나친 안정 추구가 성장을 멈추게 합니다. 변화를 두려워하지 마세요.' },
      '금': { upright: '금의 정제된 아름다움이 여황제의 풍요와 합쳐져, 품격 있는 성과를 만듭니다.', reversed: '완벽주의가 창조의 자연스러운 흐름을 방해합니다. 조금 여유를 가지세요.' },
      '수': { upright: '수의 유연함이 여황제의 풍요를 더욱 풍부하게 합니다. 감정적 교류가 관계에 풍요를 가져옵니다.', reversed: '감정적 과잉이 관계를 질식시킬 수 있습니다. 적절한 거리를 유지하세요.' }
    },
    detailed: {
      love: { upright: '사랑이 무르익는 시기입니다. 연인과의 관계가 깊어지고, 싱글이라면 매력적인 만남이 예상됩니다.', reversed: '집착이나 질투가 관계를 해칠 수 있습니다. 상대방에게 자유를 주세요.' },
      money: { upright: '재물운이 풍성합니다. 수입이 증가하거나 예상치 못한 재물이 들어올 수 있습니다.', reversed: '사치나 과소비에 주의하세요. 풍요에 취해 지출을 관리하지 못하면 위험합니다.' },
      health: { upright: '건강 상태가 좋습니다. 임신이나 출산에도 좋은 운입니다. 자연 속에서 쉬면 더욱 좋습니다.', reversed: '과식이나 나태함이 건강을 해칠 수 있습니다. 적절한 운동을 하세요.' },
      career: { upright: '직장에서 인정받는 시기입니다. 특히 창작, 디자인, 서비스업에서 성과가 좋습니다.', reversed: '업무에서 창의성이 부족하거나 동기부여가 안 될 수 있습니다. 새로운 자극을 찾아보세요.' }
    }
  },
  {
    id: 4,
    name: '황제',
    nameEn: 'The Emperor',
    arcana: 'major',
    keywords: ['권위', '리더십', '안정', '규율', '아버지'],
    symbolColor: '#dc2626',
    element: '금',
    kabbalah: KABBALAH_PATHS[4],
    upright: '강력한 리더십과 결단력이 필요한 시기입니다. 체계와 질서를 세우면 원하는 바를 이룰 수 있습니다. 주도적으로 상황을 이끌어가세요.',
    reversed: '지나친 권위나 통제가 문제입니다. 독선적인 태도를 버리고 유연하게 대처하세요.',
    ohaengReading: {
      '목': { upright: '목의 진취적 기상이 황제의 리더십과 합쳐져 강력한 추진력을 발휘합니다. 조직이나 팀을 이끌어 큰 성과를 낼 수 있습니다.', reversed: '고집과 독선이 충돌합니다. 타인의 의견에도 귀를 기울이세요.' },
      '화': { upright: '화의 열정이 황제의 권위에 카리스마를 더합니다. 강렬한 리더십으로 사람들을 이끌 수 있습니다.', reversed: '분노와 지배욕이 합쳐져 관계를 파괴할 수 있습니다. 감정 조절이 필요합니다.' },
      '토': { upright: '토의 안정감이 황제의 체계성과 완벽한 조화를 이룹니다. 단단한 기반 위에 건설하면 흔들리지 않을 것입니다.', reversed: '너무 보수적이고 경직된 태도가 발전을 가로막습니다.' },
      '금': { upright: '금과 황제의 조합은 최상의 결단력과 실행력을 의미합니다. 냉철하고 정확한 판단으로 성공을 거둘 수 있습니다.', reversed: '지나치게 냉정하고 권위적인 태도가 주변을 멀리하게 만듭니다.' },
      '수': { upright: '수의 지혜가 황제의 권위에 깊이를 더합니다. 현명한 리더십을 발휘할 수 있습니다.', reversed: '감정과 이성 사이에서 갈등이 생깁니다. 중심을 잡으세요.' }
    },
    detailed: {
      love: { upright: '안정적이고 책임감 있는 관계를 맺을 수 있습니다. 연인에게 든든한 존재가 되어주세요.', reversed: '지배적이거나 통제적인 태도가 관계를 해칩니다. 파트너의 자율성을 존중하세요.' },
      money: { upright: '체계적인 재정 관리로 부를 축적할 수 있습니다. 장기 투자, 부동산에 유리합니다.', reversed: '무리한 투자나 과도한 빚에 주의하세요. 기본에 충실해야 합니다.' },
      health: { upright: '규칙적인 생활과 운동이 건강을 지켜줍니다. 체력이 튼튼한 시기입니다.', reversed: '스트레스가 건강을 해칠 수 있습니다. 허리, 어깨 통증에 주의하세요.' },
      career: { upright: '승진, 독립, 사업 확장에 좋은 운입니다. 자신감을 가지고 추진하세요.', reversed: '직장 상사와의 갈등이나 권력 다툼에 주의하세요.' }
    }
  },
  {
    id: 5,
    name: '교황',
    nameEn: 'The Hierophant',
    arcana: 'major',
    keywords: ['전통', '교육', '영성', '규범', '조언'],
    symbolColor: '#8b5cf6',
    element: '토',
    kabbalah: KABBALAH_PATHS[5],
    upright: '전통적인 가치와 가르침에서 답을 찾을 수 있습니다. 스승이나 멘토의 조언에 귀를 기울이세요. 배움의 시기입니다.',
    reversed: '관습에 얽매이지 마세요. 자신만의 길을 찾아야 할 때입니다. 형식보다 본질이 중요합니다.',
    ohaengReading: {
      '목': { upright: '목의 성장 에너지가 교황의 가르침과 만나 큰 깨달음을 얻을 수 있습니다. 학업이나 자격증 취득에 유리합니다.', reversed: '자신만의 방식을 고집하여 좋은 가르침을 놓칠 수 있습니다. 겸손히 배우세요.' },
      '화': { upright: '화의 열정이 배움에 집중될 때 놀라운 성과를 낼 수 있습니다. 종교, 철학, 영성 탐구에도 좋은 시기입니다.', reversed: '충동적으로 믿음을 바꾸거나 극단적 사고에 빠지지 않도록 주의하세요.' },
      '토': { upright: '토와 교황은 전통과 안정의 극치를 이룹니다. 검증된 방법을 따르면 확실한 성과를 얻습니다.', reversed: '너무 고루한 사고방식이 발전을 막습니다. 새로운 시각도 열어두세요.' },
      '금': { upright: '금의 정확함이 교황의 규범과 맞아 원칙에 충실한 삶이 보상을 줍니다.', reversed: '규칙에 대한 과도한 집착이 유연성을 잃게 합니다.' },
      '수': { upright: '수의 직관이 교황의 영적 가르침과 합쳐져 깊은 영성적 체험이 가능합니다.', reversed: '지나친 의심이 믿음을 흔듭니다. 마음을 열고 받아들여 보세요.' }
    },
    detailed: {
      love: { upright: '결혼이나 약혼 같은 공식적인 관계 발전이 있을 수 있습니다. 전통적인 방식의 만남이 유리합니다.', reversed: '관습적 기대에 관계가 압박받을 수 있습니다. 두 사람만의 방식을 찾으세요.' },
      money: { upright: '안정적인 재정 관리가 좋습니다. 보험, 연금, 저축 같은 전통적 재테크가 유리합니다.', reversed: '재정 조언자의 말을 맹신하지 마세요. 자신만의 판단도 중요합니다.' },
      health: { upright: '전통 의학이나 검증된 건강법이 도움이 됩니다. 정기적인 건강검진을 받으세요.', reversed: '건강에 대한 미신이나 검증되지 않은 민간요법은 피하세요.' },
      career: { upright: '교육, 종교, 상담 관련 분야에서 성과가 좋습니다. 자격증 취득에도 유리합니다.', reversed: '직장의 경직된 문화에 답답함을 느낄 수 있습니다. 변화를 시도해보세요.' }
    }
  },
  {
    id: 6,
    name: '연인',
    nameEn: 'The Lovers',
    arcana: 'major',
    keywords: ['사랑', '선택', '조화', '관계', '가치관'],
    symbolColor: '#ec4899',
    element: '화',
    kabbalah: KABBALAH_PATHS[6],
    upright: '중요한 선택의 시기입니다. 마음이 이끄는 대로 따르되, 가치관에 부합하는 결정을 내리세요. 사랑과 관계에 진실된 시기입니다.',
    reversed: '불균형한 관계나 잘못된 선택에 주의하세요. 갈등이나 유혹에 흔들리지 말고 자신의 가치관을 지키세요.',
    ohaengReading: {
      '목': { upright: '목의 곧은 성품이 진실된 사랑을 부릅니다. 자신에게 솔직한 선택이 가장 좋은 결과를 가져옵니다.', reversed: '급한 마음에 잘못된 선택을 할 수 있습니다. 천천히 생각하세요.' },
      '화': { upright: '화와 연인 카드의 조합은 강렬한 사랑과 열정을 의미합니다. 운명적인 만남이나 깊은 감정적 유대가 형성됩니다.', reversed: '감정의 불꽃이 이성을 태워버릴 수 있습니다. 열정에만 휩쓸리지 마세요.' },
      '토': { upright: '안정적이고 신뢰할 수 있는 관계가 형성됩니다. 현실적이면서도 따뜻한 선택을 하게 됩니다.', reversed: '현실적 조건만 따지다 진정한 사랑을 놓칠 수 있습니다.' },
      '금': { upright: '명확한 기준으로 좋은 선택을 할 수 있습니다. 이성적이면서도 마음을 따르는 결정이 가능합니다.', reversed: '조건과 감정 사이에서 갈등합니다. 진짜 중요한 것이 무엇인지 생각하세요.' },
      '수': { upright: '깊은 감정적 교감이 이루어지는 시기입니다. 영혼의 단짝을 만날 수 있습니다.', reversed: '감정에 빠져 현실을 보지 못할 수 있습니다. 균형을 잡으세요.' }
    },
    detailed: {
      love: { upright: '진정한 사랑을 만나거나 관계가 한 단계 깊어지는 시기입니다. 고백이나 프러포즈에도 좋은 운입니다.', reversed: '삼각관계, 바람, 이별의 위험이 있습니다. 관계에 정직하세요.' },
      money: { upright: '재정적 파트너십이 좋은 결과를 가져옵니다. 공동 투자나 사업이 유리합니다.', reversed: '금전 문제로 관계가 악화될 수 있습니다. 돈 문제는 명확히 하세요.' },
      health: { upright: '정신적 안정이 신체 건강에도 좋은 영향을 줍니다. 사랑하는 사람과 함께하는 활동이 건강에 도움됩니다.', reversed: '감정적 스트레스가 건강을 해칠 수 있습니다. 마음의 평화를 찾으세요.' },
      career: { upright: '좋은 파트너나 동료와의 협업이 성공을 가져옵니다. 선택의 기로에서 옳은 결정을 내릴 수 있습니다.', reversed: '직업 선택에서 갈등이 있습니다. 자신의 가치관에 맞는 일을 찾으세요.' }
    }
  },
  {
    id: 7,
    name: '전차',
    nameEn: 'The Chariot',
    arcana: 'major',
    keywords: ['승리', '전진', '의지력', '결단', '정복'],
    symbolColor: '#3b82f6',
    element: '금',
    kabbalah: KABBALAH_PATHS[7],
    upright: '강한 의지와 결단력으로 장애물을 극복하고 승리할 수 있습니다. 목표를 향해 돌진하세요. 지금은 멈출 때가 아닙니다.',
    reversed: '방향을 잃었거나 통제력을 상실한 상태입니다. 무리한 추진은 역효과를 냅니다. 잠시 멈추고 방향을 재점검하세요.',
    ohaengReading: {
      '목': { upright: '목의 전진력이 전차의 승리 에너지와 합쳐져 막힘없는 돌파가 가능합니다.', reversed: '무모한 돌진이 큰 충돌을 일으킬 수 있습니다.' },
      '화': { upright: '화의 열정이 전차의 추진력을 더욱 강화합니다. 불꽃같은 승리를 쟁취할 수 있습니다.', reversed: '성질과 서두름이 사고를 부릅니다. 분노 운전 주의.' },
      '토': { upright: '토의 안정감이 전차의 속도에 방향성을 부여합니다. 안정적으로 목표에 도달합니다.', reversed: '느린 진행에 답답할 수 있지만, 서두르면 더 느려집니다.' },
      '금': { upright: '금의 예리한 판단력이 전차의 추진력과 합쳐져 최단거리로 목표를 달성합니다.', reversed: '지나친 경쟁심이 관계를 해칩니다.' },
      '수': { upright: '수의 유연함이 전차의 힘을 조절하여, 지혜로운 방식으로 승리합니다.', reversed: '감정적 동요가 진행을 방해합니다. 흔들리지 마세요.' }
    },
    detailed: {
      love: { upright: '적극적인 구애가 성공합니다. 당당하게 마음을 표현하세요.', reversed: '관계에서 일방적인 추진은 역효과입니다. 상대방의 속도에 맞추세요.' },
      money: { upright: '적극적인 투자나 사업 확장이 좋은 결과를 가져옵니다.', reversed: '과도한 투자나 무리한 사업 확장은 손해를 부릅니다.' },
      health: { upright: '활동적인 운동이 건강에 좋습니다. 마라톤, 수영 등 체력을 쓰는 운동을 추천합니다.', reversed: '과도한 운동이나 무리가 부상을 부릅니다. 적절히 쉬세요.' },
      career: { upright: '승진, 계약 성사, 프로젝트 성공 등 직업적 승리가 예상됩니다.', reversed: '무리한 업무 추진이 번아웃을 일으킵니다.' }
    }
  },
  {
    id: 8,
    name: '힘',
    nameEn: 'Strength',
    arcana: 'major',
    keywords: ['내면의 힘', '용기', '인내', '자제력', '부드러운 강함'],
    symbolColor: '#f59e0b',
    element: '화',
    kabbalah: KABBALAH_PATHS[8],
    upright: '부드러움 속에 진정한 강함이 있습니다. 인내와 사랑으로 어려움을 극복할 수 있는 시기입니다. 감정을 다스리고 내면의 힘을 발휘하세요.',
    reversed: '자신감 부족이나 감정 조절 실패에 주의하세요. 내면의 두려움을 마주할 용기가 필요합니다.',
    ohaengReading: {
      '목': { upright: '나무의 유연하면서도 강한 성질처럼, 부드럽지만 꺾이지 않는 힘을 발휘합니다.', reversed: '고집과 강함을 혼동하고 있습니다. 진정한 강함은 유연함입니다.' },
      '화': { upright: '화의 용기와 힘 카드의 내적 강함이 합쳐져 두려움 없는 전진이 가능합니다.', reversed: '분노를 힘으로 착각하지 마세요. 차분한 힘이 진짜 힘입니다.' },
      '토': { upright: '토의 인내심이 힘 카드와 완벽한 조화를 이룹니다. 묵묵히 견디면 반드시 좋은 결과가 옵니다.', reversed: '참기만 하는 것은 힘이 아닙니다. 때로는 표현해야 합니다.' },
      '금': { upright: '금의 단단함과 내면의 힘이 합쳐져 어떤 시련도 이겨낼 수 있습니다.', reversed: '강해 보이려고 감정을 억누르면 오히려 무너집니다.' },
      '수': { upright: '물의 부드러움처럼 유연하게 대처하면서도 결국 바위도 뚫는 힘을 보여줍니다.', reversed: '감정적 약함이 자신감을 무너뜨립니다. 내면을 단단히 하세요.' }
    },
    detailed: {
      love: { upright: '인내와 사랑으로 관계를 지켜낼 수 있습니다. 진심은 반드시 통합니다.', reversed: '관계에서 자신감이 부족하거나 상대에게 의존적입니다.' },
      money: { upright: '꾸준한 노력이 재정적 안정을 가져옵니다. 급한 것보다 꾸준한 것이 이깁니다.', reversed: '재정적 불안감에 잘못된 결정을 내릴 수 있습니다.' },
      health: { upright: '정신력이 건강을 지켜줍니다. 규칙적인 생활이 가장 좋은 약입니다.', reversed: '스트레스로 인한 건강 문제에 주의하세요.' },
      career: { upright: '어려운 프로젝트도 인내심으로 해결할 수 있습니다. 포기하지 마세요.', reversed: '업무에 대한 자신감이 부족합니다. 작은 성공부터 쌓아가세요.' }
    }
  },
  {
    id: 9,
    name: '은둔자',
    nameEn: 'The Hermit',
    arcana: 'major',
    keywords: ['고독', '성찰', '지혜', '탐구', '내면 여행'],
    symbolColor: '#6b7280',
    element: '토',
    kabbalah: KABBALAH_PATHS[9],
    upright: '혼자만의 시간이 필요한 때입니다. 고요 속에서 진정한 지혜를 찾을 수 있습니다. 외부보다 내면을 향해 등불을 비추세요.',
    reversed: '지나친 고립이나 외로움에 빠져있습니다. 세상과 소통하세요. 혼자서는 모든 답을 찾을 수 없습니다.',
    ohaengReading: {
      '목': { upright: '활동적인 목에게 은둔의 시간은 오히려 큰 도약을 위한 준비입니다. 뿌리를 깊이 내리는 시간입니다.', reversed: '활동을 멈추는 것에 불안해하지 마세요. 잠시 쉬어도 됩니다.' },
      '화': { upright: '화의 밝은 에너지가 은둔 속에서 내면의 진실을 비추어 줍니다. 명상과 자기성찰의 시간입니다.', reversed: '고독 속에서 열정이 꺼질 수 있습니다. 작은 불씨라도 지켜가세요.' },
      '토': { upright: '토의 안정감과 은둔자의 지혜가 합쳐져 깊은 깨달음을 얻습니다.', reversed: '너무 오래 웅크리고 있으면 기회가 지나갑니다.' },
      '금': { upright: '금의 예리함이 은둔 속에서 더욱 빛납니다. 정밀한 분석과 깊은 사고가 가능합니다.', reversed: '비판적 사고가 자기 비하로 이어지지 않도록 주의하세요.' },
      '수': { upright: '수의 깊이와 은둔자의 지혜가 완벽히 어우러집니다. 심오한 통찰을 얻는 시기입니다.', reversed: '우울함이나 고독에 빠지지 않도록 주의하세요.' }
    },
    detailed: {
      love: { upright: '관계보다 자기 자신에게 집중할 시기입니다. 내면이 성숙하면 더 좋은 인연이 옵니다.', reversed: '외로움에 아무나 만나지 마세요. 진정으로 원하는 것이 무엇인지 먼저 알아야 합니다.' },
      money: { upright: '재정 상태를 조용히 점검하고 정리하기 좋은 때입니다.', reversed: '재정 문제를 혼자 끌어안지 마세요. 전문가의 도움을 받으세요.' },
      health: { upright: '조용한 환경에서 휴식하면 건강이 회복됩니다. 명상, 산책이 도움이 됩니다.', reversed: '우울증이나 정신 건강에 주의하세요. 필요하면 전문 상담을 받으세요.' },
      career: { upright: '학업, 연구, 전문 분야 심화에 좋은 시기입니다. 조용히 실력을 키우세요.', reversed: '고립되면 기회를 놓칩니다. 네트워킹도 필요합니다.' }
    }
  },
  {
    id: 10,
    name: '운명의 수레바퀴',
    nameEn: 'Wheel of Fortune',
    arcana: 'major',
    keywords: ['운명', '변화', '행운', '전환점', '순환'],
    symbolColor: '#a855f7',
    element: '목',
    kabbalah: KABBALAH_PATHS[10],
    upright: '운명의 전환점에 서 있습니다. 행운이 돌아오는 시기이니 기회를 놓치지 마세요. 변화를 받아들이면 더 좋은 방향으로 흘러갑니다.',
    reversed: '불운이나 예상치 못한 변화에 주의하세요. 하지만 이것도 지나갑니다. 흔들리지 말고 중심을 잡으세요.',
    ohaengReading: {
      '목': { upright: '봄이 오듯 운이 상승하는 시기입니다. 목의 성장 에너지와 행운이 합쳐져 대단한 도약이 가능합니다.', reversed: '변화의 바람이 거세니 뿌리를 단단히 하세요.' },
      '화': { upright: '불꽃처럼 화려한 행운이 찾아옵니다. 열정을 다해 기회를 잡으세요.', reversed: '급격한 변화에 당황할 수 있습니다. 침착하세요.' },
      '토': { upright: '안정 속에서 자연스러운 발전이 이루어집니다. 급변보다 점진적 상승입니다.', reversed: '변화를 두려워하면 좋은 운도 지나갑니다.' },
      '금': { upright: '정확한 타이밍에 정확한 결정을 내려 행운을 극대화합니다.', reversed: '변화에 저항하면 오히려 손해봅니다. 유연하게 대처하세요.' },
      '수': { upright: '물 흐르듯 운명의 흐름을 타면 좋은 곳에 도달합니다. 직감을 따르세요.', reversed: '감정적 동요가 기회를 놓치게 할 수 있습니다.' }
    },
    detailed: {
      love: { upright: '운명적인 만남이 있을 수 있습니다. 인연의 순환 속에서 좋은 사람이 나타납니다.', reversed: '관계에 변화가 올 수 있습니다. 이별도 새로운 시작일 수 있습니다.' },
      money: { upright: '재물운이 상승합니다. 복권, 경품, 뜻밖의 수입이 있을 수 있습니다.', reversed: '예상치 못한 지출이나 손실에 대비하세요.' },
      health: { upright: '건강이 호전되는 시기입니다. 좋은 치료법을 만날 수 있습니다.', reversed: '갑작스러운 건강 변화에 주의하세요.' },
      career: { upright: '전직, 승진, 새로운 기회 등 커리어에 전환점이 옵니다.', reversed: '직장에서 예상치 못한 변화가 있을 수 있습니다. 대비하세요.' }
    }
  },
  {
    id: 11,
    name: '정의',
    nameEn: 'Justice',
    arcana: 'major',
    keywords: ['공정', '진실', '균형', '책임', '인과응보'],
    symbolColor: '#14b8a6',
    element: '금',
    kabbalah: KABBALAH_PATHS[11],
    upright: '공정한 결과가 돌아오는 시기입니다. 진실은 반드시 밝혀지고, 뿌린 대로 거둘 것입니다. 정직하고 공평하게 행동하세요.',
    reversed: '불공정하거나 편파적인 상황에 처할 수 있습니다. 법적 문제나 분쟁에 주의하세요.',
    ohaengReading: {
      '목': { upright: '곧은 나무처럼 바른 길을 가면 반드시 보상이 돌아옵니다.', reversed: '고집이 공정함을 해칠 수 있습니다. 상대의 입장도 들어보세요.' },
      '화': { upright: '진실을 밝히는 불꽃입니다. 정의로운 행동이 인정받습니다.', reversed: '분노가 판단을 흐리게 합니다. 냉정해지세요.' },
      '토': { upright: '균형과 안정의 최적의 조합입니다. 공평한 처리가 이루어집니다.', reversed: '한쪽으로 기울어진 균형을 바로잡아야 합니다.' },
      '금': { upright: '금의 예리한 판단이 정의와 합쳐져 최선의 결정을 내릴 수 있습니다.', reversed: '너무 엄격한 잣대가 오히려 불공정을 만듭니다.' },
      '수': { upright: '수의 공정한 흐름이 모든 것을 제자리로 돌려놓습니다.', reversed: '감정에 치우친 판단은 공정하지 않습니다.' }
    },
    detailed: {
      love: { upright: '공평하고 대등한 관계가 유지됩니다. 결혼이나 계약 관련 결정에 좋습니다.', reversed: '관계에서 불균형이 있습니다. 한쪽만 희생하는 관계는 건강하지 않습니다.' },
      money: { upright: '정당한 보상을 받습니다. 법적 분쟁이 유리하게 해결됩니다.', reversed: '세금, 벌금, 법적 비용에 주의하세요.' },
      health: { upright: '몸의 균형을 맞추면 건강이 회복됩니다. 규칙적인 생활이 약입니다.', reversed: '좌우 밸런스, 자세 교정에 신경 쓰세요.' },
      career: { upright: '능력에 맞는 공정한 평가를 받습니다. 계약, 협상이 유리합니다.', reversed: '부당한 대우를 받을 수 있습니다. 증거를 확보하세요.' }
    }
  },
  {
    id: 12,
    name: '매달린 사람',
    nameEn: 'The Hanged Man',
    arcana: 'major',
    keywords: ['희생', '인내', '새로운 관점', '기다림', '깨달음'],
    symbolColor: '#06b6d4',
    element: '수',
    kabbalah: KABBALAH_PATHS[12],
    upright: '지금은 기다림과 인내의 시간입니다. 관점을 바꾸면 전혀 다른 세상이 보입니다. 포기가 아니라 새로운 시각으로의 전환입니다.',
    reversed: '불필요한 희생을 멈추세요. 기다림이 너무 길어지고 있습니다. 과감하게 변화를 택하세요.',
    ohaengReading: {
      '목': { upright: '성장을 잠시 멈추고 뿌리를 돌아볼 때입니다. 이 시간이 더 큰 성장의 밑거름이 됩니다.', reversed: '기다리는 것이 너무 힘들겠지만, 조금만 더 참으세요.' },
      '화': { upright: '불꽃을 잠시 낮추면 오히려 더 오래 타오를 수 있습니다. 에너지를 축적하는 시간입니다.', reversed: '답답함에 폭발하기 직전이지만, 지금 행동하면 후회합니다.' },
      '토': { upright: '토의 인내심과 매달린 사람의 기다림이 완벽히 어울립니다. 때를 기다리면 반드시 좋은 결과가 옵니다.', reversed: '무작정 참기만 하면 기회를 놓칩니다. 전략적으로 기다리세요.' },
      '금': { upright: '날카로운 판단을 잠시 내려놓고 다른 각도에서 바라보세요. 새로운 해결책이 보입니다.', reversed: '결단을 미루는 것과 기다리는 것은 다릅니다.' },
      '수': { upright: '물처럼 상황에 순응하면 자연스럽게 해결됩니다. 물은 아래로 흐르지만 결국 바다에 이릅니다.', reversed: '수동적인 태도가 너무 깊어졌습니다. 이제 움직일 때입니다.' }
    },
    detailed: {
      love: { upright: '관계에서 기다림이 필요합니다. 조급해하지 말고 시간이 해결해줄 것을 믿으세요.', reversed: '일방적인 기다림은 그만두세요. 당신의 시간도 소중합니다.' },
      money: { upright: '투자 수익이 나오려면 시간이 필요합니다. 장기적 관점을 가지세요.', reversed: '손절할 때는 과감히 하세요. 미련이 더 큰 손해를 부릅니다.' },
      health: { upright: '지금은 무리하지 말고 충분히 쉬세요. 회복에 시간이 필요합니다.', reversed: '병원 방문을 미루지 마세요. 빠른 조치가 필요할 수 있습니다.' },
      career: { upright: '지금 당장의 성과보다 장기적인 커리어를 생각하세요. 실력을 쌓는 시간입니다.', reversed: '정체된 커리어에서 벗어날 때입니다. 새로운 도전을 고민하세요.' }
    }
  },
  {
    id: 13, name: '죽음', nameEn: 'Death', arcana: 'major',
    keywords: ['끝과 시작', '변환', '재생', '정리', '탈피'],
    symbolColor: '#1f2937', element: '수', kabbalah: KABBALAH_PATHS[13],
    upright: '한 시대가 끝나고 새로운 시대가 열립니다. 집착을 내려놓으면 더 좋은 것이 찾아옵니다. 두려워하지 마세요, 이것은 재탄생입니다.',
    reversed: '변화에 저항하고 있습니다. 끝나야 할 것을 끝내지 못하면 새 시작도 없습니다.',
    ohaengReading: {
      '목': { upright: '낡은 잎이 떨어져야 새싹이 돋습니다. 과거를 정리하면 강력한 새 시작이 기다립니다.', reversed: '변화를 거부하면 성장이 멈춥니다.' },
      '화': { upright: '불이 태우고 난 자리에서 새 생명이 돋아납니다. 과감한 변화가 재탄생을 가져옵니다.', reversed: '태우지 말아야 할 것까지 태울 수 있습니다. 신중하세요.' },
      '토': { upright: '오래된 것을 정리하고 기반을 새로 다질 때입니다.', reversed: '변화에 대한 두려움이 너무 큽니다. 용기를 내세요.' },
      '금': { upright: '불필요한 것을 날카롭게 잘라내면 핵심만 남습니다.', reversed: '정리할 것과 지켜야 할 것을 구분하세요.' },
      '수': { upright: '물처럼 변화에 순응하면 자연스러운 전환이 이루어집니다.', reversed: '감정적 집착이 변화를 막고 있습니다.' }
    },
    detailed: {
      love: { upright: '관계의 전환점입니다. 이별 후 새로운 만남이 올 수도, 관계가 완전히 새로운 단계로 갈 수도 있습니다.', reversed: '끝난 관계에 미련을 버리세요.' },
      money: { upright: '재정 구조를 완전히 바꿀 때입니다. 빚 정리, 새로운 수입원 개척이 좋습니다.', reversed: '낡은 재정 습관을 바꾸지 못하면 계속 어렵습니다.' },
      health: { upright: '생활습관을 완전히 바꾸면 건강이 크게 나아집니다. 금연, 금주, 식단 변화 등.', reversed: '건강에 대한 경고 신호를 무시하지 마세요.' },
      career: { upright: '이직이나 완전한 직업 전환이 오히려 좋은 결과를 가져옵니다.', reversed: '맞지 않는 직장에 억지로 남아있으면 더 힘들어집니다.' }
    }
  },
  {
    id: 14, name: '절제', nameEn: 'Temperance', arcana: 'major',
    keywords: ['균형', '조화', '절제', '인내', '중용'],
    symbolColor: '#a78bfa', element: '토', kabbalah: KABBALAH_PATHS[14],
    upright: '균형과 조화가 핵심입니다. 극단을 피하고 중용의 길을 걸으세요. 서두르지 않으면 모든 것이 제자리를 찾습니다.',
    reversed: '균형이 무너졌습니다. 과도하거나 부족한 것은 없는지 점검하세요.',
    ohaengReading: {
      '목': { upright: '성장의 속도를 조절하면 더 건강하게 자랍니다.', reversed: '급한 성장 욕구가 균형을 깨뜨립니다.' },
      '화': { upright: '열정을 적절히 조절하면 오래도록 빛날 수 있습니다.', reversed: '감정의 기복이 심합니다. 안정을 찾으세요.' },
      '토': { upright: '최상의 균형 상태입니다. 모든 일이 조화롭게 진행됩니다.', reversed: '지나친 안정 추구가 정체를 부릅니다.' },
      '금': { upright: '정확한 조율로 최적의 결과를 만들어냅니다.', reversed: '완벽주의가 오히려 균형을 해칩니다.' },
      '수': { upright: '물과 불을 섞어 적절한 온도를 만드는 것처럼, 상반된 것들의 조화를 이룹니다.', reversed: '감정과 이성의 균형이 무너지고 있습니다.' }
    },
    detailed: {
      love: { upright: '서로 양보하고 조화를 이루면 관계가 안정됩니다.', reversed: '한쪽으로 기울어진 관계입니다. 균형을 맞추세요.' },
      money: { upright: '수입과 지출의 균형을 맞추면 재정이 안정됩니다.', reversed: '과소비나 지나친 인색함 모두 문제입니다.' },
      health: { upright: '식이요법과 운동의 균형이 건강의 핵심입니다.', reversed: '불규칙한 생활 습관을 교정하세요.' },
      career: { upright: '일과 삶의 균형을 잘 맞추면 오래도록 좋은 성과를 냅니다.', reversed: '워라밸이 무너졌습니다. 조정이 필요합니다.' }
    }
  },
  {
    id: 15, name: '악마', nameEn: 'The Devil', arcana: 'major',
    keywords: ['유혹', '집착', '속박', '욕망', '중독'],
    symbolColor: '#991b1b', element: '화', kabbalah: KABBALAH_PATHS[15],
    upright: '유혹이나 집착에 빠져있지 않은지 돌아보세요. 물질적 욕망이나 나쁜 습관에 묶여 있을 수 있습니다. 스스로 선택한 사슬임을 인식하세요.',
    reversed: '속박에서 벗어나고 있습니다. 중독이나 나쁜 관계에서 탈출할 용기를 내세요.',
    ohaengReading: {
      '목': { upright: '성장에 대한 과도한 욕심이 집착이 되었습니다. 욕심을 내려놓으세요.', reversed: '속박에서 벗어나 자유로운 성장이 가능해집니다.' },
      '화': { upright: '화의 욕망이 악마의 유혹과 합쳐져 위험합니다. 자제력이 필요합니다.', reversed: '지나친 열정을 조절하면 해방감을 느낄 수 있습니다.' },
      '토': { upright: '물질적 안정에 대한 집착이 정신을 옥죄고 있습니다.', reversed: '물질적 집착에서 벗어나면 마음이 자유로워집니다.' },
      '금': { upright: '완벽에 대한 강박이 스스로를 가두고 있습니다.', reversed: '자기 통제를 통해 유혹에서 벗어날 수 있습니다.' },
      '수': { upright: '감정적 의존이나 중독에 빠져있을 수 있습니다.', reversed: '감정적 속박에서 해방되고 있습니다.' }
    },
    detailed: {
      love: { upright: '불건전한 관계나 집착에서 벗어나야 합니다. 독점욕을 주의하세요.', reversed: '독한 관계에서 벗어날 수 있는 힘이 생기고 있습니다.' },
      money: { upright: '도박, 과소비, 빚 등 재정적 유혹에 주의하세요.', reversed: '빚이나 나쁜 재정 습관에서 벗어날 수 있습니다.' },
      health: { upright: '중독성 물질이나 나쁜 습관이 건강을 해치고 있습니다.', reversed: '금연, 금주 등 나쁜 습관을 끊을 좋은 시기입니다.' },
      career: { upright: '직장에서 부당한 상황에 묶여있을 수 있습니다. 벗어날 방법을 찾으세요.', reversed: '나쁜 직장 환경에서 탈출할 용기가 생깁니다.' }
    }
  },
  {
    id: 16, name: '탑', nameEn: 'The Tower', arcana: 'major',
    keywords: ['붕괴', '충격', '해방', '깨달음', '급변'],
    symbolColor: '#b91c1c', element: '화', kabbalah: KABBALAH_PATHS[16],
    upright: '예상치 못한 충격적 변화가 올 수 있습니다. 하지만 무너져야 새로 세울 수 있습니다. 잘못된 기반 위의 것들이 무너지는 것은 결국 좋은 일입니다.',
    reversed: '파국을 피할 수 있습니다. 경고 신호를 무시하지 말고 미리 변화를 준비하세요.',
    ohaengReading: {
      '목': { upright: '거대한 나무가 벼락에 쓰러지듯 충격이 오지만, 그 자리에서 새 숲이 자랍니다.', reversed: '유연하게 대처하면 큰 피해를 줄일 수 있습니다.' },
      '화': { upright: '불의 파괴력이 극대화됩니다. 모든 것을 태우고 새 시작을 합니다.', reversed: '화재 같은 급변을 사전에 막을 수 있습니다.' },
      '토': { upright: '안정의 기반이 흔들립니다. 하지만 더 단단한 기반을 다시 세울 기회입니다.', reversed: '기초가 약한 부분을 미리 보강하세요.' },
      '금': { upright: '날카로운 현실 인식이 환상을 깨뜨립니다. 아프지만 필요한 깨달음입니다.', reversed: '충격을 최소화할 방법을 찾을 수 있습니다.' },
      '수': { upright: '감정의 폭풍이 옵니다. 하지만 폭풍 후에 맑은 하늘이 옵니다.', reversed: '감정적 충격에 미리 대비하세요.' }
    },
    detailed: {
      love: { upright: '관계에 큰 변화가 오지만, 더 진실된 관계로 재건될 수 있습니다.', reversed: '위기의 관계를 아직 살릴 수 있습니다. 솔직한 대화가 필요합니다.' },
      money: { upright: '재정적 충격에 대비하세요. 보험, 비상금이 중요합니다.', reversed: '재정 위기를 사전에 막을 수 있습니다. 지금 점검하세요.' },
      health: { upright: '갑작스러운 건강 문제에 주의하세요. 사고나 부상에 조심하세요.', reversed: '건강 경고를 지금 주의하면 큰 병을 막을 수 있습니다.' },
      career: { upright: '해고, 사업 실패 등 충격이 있을 수 있지만 이것이 새 출발이 됩니다.', reversed: '직장 내 위기를 미리 감지하고 대비할 수 있습니다.' }
    }
  },
  {
    id: 17, name: '별', nameEn: 'The Star', arcana: 'major',
    keywords: ['희망', '영감', '치유', '평화', '축복'],
    symbolColor: '#fcd34d', element: '수', kabbalah: KABBALAH_PATHS[17],
    upright: '어둠 뒤에 빛나는 별처럼, 희망이 찾아옵니다. 치유와 평화의 시기입니다. 꿈을 향해 나아가세요, 우주가 당신을 돕고 있습니다.',
    reversed: '희망을 잃지 마세요. 지금은 어둡지만 곧 빛이 보입니다. 자신을 믿으세요.',
    ohaengReading: {
      '목': { upright: '새 봄이 오는 것처럼 희망의 싹이 돋아나고 있습니다.', reversed: '희망의 씨앗을 포기하지 마세요. 곧 싹이 납니다.' },
      '화': { upright: '별빛 같은 영감이 열정에 불을 붙입니다. 창조적 에너지가 넘칩니다.', reversed: '열정이 식었지만 작은 불씨가 남아있습니다. 다시 키우세요.' },
      '토': { upright: '안정적인 기반 위에서 꿈이 현실이 됩니다.', reversed: '현실에 지쳐 꿈을 포기하지 마세요.' },
      '금': { upright: '맑고 순수한 결단이 축복을 가져옵니다.', reversed: '비관적 사고를 버리면 희망이 보입니다.' },
      '수': { upright: '수와 별의 조합은 최고의 치유력입니다. 마음의 상처가 회복됩니다.', reversed: '눈물 뒤에 웃음이 옵니다. 감정을 충분히 느끼세요.' }
    },
    detailed: {
      love: { upright: '아름다운 사랑이 찾아옵니다. 과거의 상처가 치유되고 새로운 인연이 기다립니다.', reversed: '사랑에 대한 희망을 잃지 마세요. 아직 때가 안 된 것일 뿐입니다.' },
      money: { upright: '재정적으로 점점 나아지고 있습니다. 희망적인 흐름입니다.', reversed: '재정 상태가 어려워도 곧 나아집니다.' },
      health: { upright: '건강이 회복되는 시기입니다. 몸과 마음이 모두 치유됩니다.', reversed: '건강 회복에 시간이 좀 더 필요합니다.' },
      career: { upright: '꿈꿔왔던 직업이나 프로젝트를 시작하기 좋은 때입니다.', reversed: '꿈을 향한 길이 멀어 보여도 포기하지 마세요.' }
    }
  },
  {
    id: 18, name: '달', nameEn: 'The Moon', arcana: 'major',
    keywords: ['환상', '불안', '직감', '무의식', '비밀'],
    symbolColor: '#c4b5fd', element: '수', kabbalah: KABBALAH_PATHS[18],
    upright: '보이는 것이 전부가 아닙니다. 불안하고 혼란스러울 수 있지만, 직감을 믿고 안개 속을 걸어가세요. 숨겨진 진실이 드러날 것입니다.',
    reversed: '불안과 두려움에서 벗어나고 있습니다. 혼란이 걷히고 진실이 보이기 시작합니다.',
    ohaengReading: {
      '목': { upright: '성장의 방향이 불명확합니다. 직감을 따르면서 천천히 나아가세요.', reversed: '혼란이 걷히고 갈 길이 보이기 시작합니다.' },
      '화': { upright: '어둠 속의 불안이 있지만, 내면의 불꽃이 길을 밝혀줄 것입니다.', reversed: '두려움이 물러가고 열정이 되살아납니다.' },
      '토': { upright: '현실과 환상의 경계가 흐릿해집니다. 발 딛고 있는 땅을 확인하세요.', reversed: '현실 감각이 돌아오면서 안정을 찾습니다.' },
      '금': { upright: '판단이 어려운 시기입니다. 중요한 결정은 미루세요.', reversed: '판단력이 회복되고 명확한 결정이 가능해집니다.' },
      '수': { upright: '무의식의 세계가 활발합니다. 꿈에서 메시지를 받을 수 있습니다.', reversed: '깊은 불안에서 서서히 벗어나고 있습니다.' }
    },
    detailed: {
      love: { upright: '상대방의 진심을 알기 어렵습니다. 시간을 두고 지켜보세요.', reversed: '의심과 불안이 해소되고 신뢰가 회복됩니다.' },
      money: { upright: '재정 관련 사기나 오해에 주의하세요. 불확실한 투자는 피하세요.', reversed: '재정 상황이 명확해지기 시작합니다.' },
      health: { upright: '정신 건강에 주의하세요. 불면증, 불안 장애에 유의하세요.', reversed: '정신적 안정을 되찾고 있습니다.' },
      career: { upright: '직장 내 보이지 않는 정치에 주의하세요. 모든 것이 겉보기와 다를 수 있습니다.', reversed: '직장 내 혼란이 정리되기 시작합니다.' }
    }
  },
  {
    id: 19, name: '태양', nameEn: 'The Sun', arcana: 'major',
    keywords: ['성공', '행복', '활력', '자신감', '기쁨'],
    symbolColor: '#f97316', element: '화', kabbalah: KABBALAH_PATHS[19],
    upright: '밝고 찬란한 시기입니다! 성공과 행복이 가득합니다. 자신감을 가지고 무엇이든 도전하세요. 모든 것이 잘 풀리는 최고의 운입니다.',
    reversed: '행복이 지연되거나 자신감이 다소 부족할 수 있지만, 본질적으로 좋은 운입니다.',
    ohaengReading: {
      '목': { upright: '태양 아래서 나무가 무성하게 자라듯, 모든 것이 성장하는 최고의 시기입니다.', reversed: '약간의 그늘이 있지만 전체적으로 좋은 흐름입니다.' },
      '화': { upright: '화와 태양의 조합은 최강의 성공운입니다. 찬란하게 빛나는 시기입니다.', reversed: '빛이 잠시 가려져도 곧 다시 빛납니다.' },
      '토': { upright: '안정적인 성공입니다. 꾸준히 쌓아온 것들이 빛을 발합니다.', reversed: '성공이 조금 느리지만 확실하게 오고 있습니다.' },
      '금': { upright: '빛나는 성과가 인정받습니다. 상이나 보상을 받을 수 있습니다.', reversed: '겸손함을 유지하면 더 큰 성공이 옵니다.' },
      '수': { upright: '감정적으로 매우 행복한 시기입니다. 마음이 따뜻해지는 일이 생깁니다.', reversed: '행복감이 조금 덜하지만 기본적으로 좋은 시기입니다.' }
    },
    detailed: {
      love: { upright: '사랑이 빛나는 시기입니다. 연인과 행복한 시간을 보냅니다. 결혼, 출산에도 최고의 운입니다.', reversed: '관계에 약간의 그늘이 있지만 극복 가능합니다.' },
      money: { upright: '재물운이 최고입니다. 투자 수익, 급여 인상, 사업 성공 등 좋은 일이 많습니다.', reversed: '재정적으로 나쁘지는 않지만 기대만큼은 아닐 수 있습니다.' },
      health: { upright: '활력이 넘칩니다. 건강 상태가 매우 좋습니다.', reversed: '건강은 대체로 좋지만 과로하지 마세요.' },
      career: { upright: '직업적 성공의 절정입니다. 어떤 일이든 잘 풀립니다.', reversed: '직장에서 약간의 어려움이 있지만 곧 해결됩니다.' }
    }
  },
  {
    id: 20, name: '심판', nameEn: 'Judgement', arcana: 'major',
    keywords: ['부활', '깨달음', '결산', '소명', '갱신'],
    symbolColor: '#fbbf24', element: '화', kabbalah: KABBALAH_PATHS[20],
    upright: '과거의 결산과 새로운 소명의 시기입니다. 지난 일들을 돌아보고 교훈을 얻으세요. 더 높은 부름에 응답할 때입니다.',
    reversed: '자기 반성이 부족하거나 과거에 매여 있습니다. 스스로를 용서하고 앞으로 나아가세요.',
    ohaengReading: {
      '목': { upright: '과거의 성장을 결산하고 새로운 도약을 준비하는 때입니다.', reversed: '과거의 실패에 매여 있지 마세요. 새로 시작할 수 있습니다.' },
      '화': { upright: '열정이 재점화됩니다. 잊었던 꿈이 다시 타오릅니다.', reversed: '과거의 열정을 되찾으세요.' },
      '토': { upright: '현실적인 자기 평가가 새로운 기반을 다져줍니다.', reversed: '자기 비하를 멈추세요. 당신은 충분히 잘했습니다.' },
      '금': { upright: '냉정한 자기 점검이 더 나은 미래를 만듭니다.', reversed: '자신에게 너무 가혹하지 마세요.' },
      '수': { upright: '감정적 치유와 영적 각성이 이루어집니다.', reversed: '과거의 상처를 치유하는 시간이 필요합니다.' }
    },
    detailed: {
      love: { upright: '과거 관계에서 교훈을 얻고 더 성숙한 사랑을 시작합니다.', reversed: '전 연인에 대한 미련을 놓아야 새 사랑이 옵니다.' },
      money: { upright: '재정을 점검하고 새로운 전략을 세우기 좋은 때입니다.', reversed: '과거의 잘못된 재정 결정을 반복하지 마세요.' },
      health: { upright: '건강을 되돌아보고 생활 습관을 재점검하세요.', reversed: '방치했던 건강 문제를 이제 해결하세요.' },
      career: { upright: '커리어의 전환점입니다. 진정한 소명을 찾을 수 있습니다.', reversed: '직업적 후회에 매달리지 말고 앞으로 나아가세요.' }
    }
  },
  {
    id: 21, name: '세계', nameEn: 'The World', arcana: 'major',
    keywords: ['완성', '성취', '통합', '여행', '축하'],
    symbolColor: '#10b981', element: '토', kabbalah: KABBALAH_PATHS[21],
    upright: '하나의 순환이 완성되었습니다! 목표를 달성하고 모든 것이 조화를 이루는 축복의 시기입니다. 성취를 즐기면서 다음 여정을 준비하세요.',
    reversed: '완성에 가까이 왔지만 마지막 한 걸음이 남았습니다. 포기하지 마세요.',
    ohaengReading: {
      '목': { upright: '성장의 꽃이 활짝 피었습니다. 당신의 노력이 결실을 맺는 완성의 시기입니다.', reversed: '마무리가 아쉽습니다. 조금만 더 힘을 내세요.' },
      '화': { upright: '열정을 다해 쏟아온 것들이 찬란한 성과로 돌아옵니다.', reversed: '번아웃 직전이지만, 조금만 더 가면 완성입니다.' },
      '토': { upright: '토와 세계의 조합은 완벽한 안정과 성취를 의미합니다. 최고의 시기입니다.', reversed: '마지막 마무리에 신경 쓰면 완벽한 성취가 됩니다.' },
      '금': { upright: '세련되고 완벽한 결과물이 나옵니다. 인정과 보상이 따릅니다.', reversed: '완벽주의가 완성을 지연시킵니다. 있는 그대로도 충분합니다.' },
      '수': { upright: '감정적으로도 물질적으로도 충만한 시기입니다. 깊은 만족감을 느낍니다.', reversed: '완성의 기쁨이 조금 덜하지만 성취한 것은 분명합니다.' }
    },
    detailed: {
      love: { upright: '사랑의 완성입니다. 결혼, 동거, 관계의 완전한 조화를 이룹니다.', reversed: '관계에서 아직 해결할 것이 남아있지만 거의 다 왔습니다.' },
      money: { upright: '재정적 목표를 달성합니다. 풍요로운 시기입니다.', reversed: '재정 목표 달성이 조금 지연될 수 있지만 곧 이룹니다.' },
      health: { upright: '신체적, 정신적 건강이 모두 최상입니다.', reversed: '전체적으로 건강하지만 특정 부분의 마무리 관리가 필요합니다.' },
      career: { upright: '직업적 목표를 완전히 달성합니다. 해외 진출이나 큰 프로젝트 완성에 좋습니다.', reversed: '프로젝트 마무리에 신경 쓰면 큰 성과를 거둡니다.' }
    }
  },
];

// ========== 마이너 아르카나 (4수트 × 14장 = 56장) ==========

// 수트별 기본 설정
const SUIT_CONFIG = {
  wands: { nameKr: '완드', element: '화' as Ohaeng, color: '#ef4444', theme: '열정, 의지, 행동, 창의력' },
  cups: { nameKr: '컵', element: '수' as Ohaeng, color: '#3b82f6', theme: '감정, 사랑, 관계, 직감' },
  swords: { nameKr: '소드', element: '금' as Ohaeng, color: '#94a3b8', theme: '사고, 갈등, 진실, 결단' },
  pentacles: { nameKr: '펜타클', element: '토' as Ohaeng, color: '#22c55e', theme: '물질, 재물, 건강, 현실' },
};

// 마이너 아르카나 숫자별 키워드
const MINOR_KEYWORDS: Record<number, string[]> = {
  1: ['시작', '잠재력', '기회'],
  2: ['균형', '선택', '파트너십'],
  3: ['성장', '창조', '확장'],
  4: ['안정', '기반', '구조'],
  5: ['갈등', '변화', '도전'],
  6: ['조화', '소통', '치유'],
  7: ['성찰', '지혜', '인내'],
  8: ['힘', '진보', '성취'],
  9: ['완성', '성숙', '충만'],
  10: ['결말', '순환', '전환'],
  11: ['탐험', '열정', '메시지'], // Page
  12: ['행동', '모험', '추진'], // Knight
  13: ['직관', '양육', '감수성'], // Queen
  14: ['통솔', '권위', '완성'], // King
};

// 마이너 아르카나 데이터 생성 함수
function generateMinorArcana(): TarotCard[] {
  const cards: TarotCard[] = [];
  const suits: Array<'wands' | 'cups' | 'swords' | 'pentacles'> = ['wands', 'cups', 'swords', 'pentacles'];

  // 각 수트별 상세 해석 데이터
  const minorData: Record<string, Record<number, { upright: string; reversed: string; love: { upright: string; reversed: string }; money: { upright: string; reversed: string }; health: { upright: string; reversed: string }; career: { upright: string; reversed: string } }>> = {
    wands: {
      1: { upright: '새로운 열정과 영감이 불타오르는 시작입니다. 창의적인 아이디어가 떠오르고 행동으로 옮길 에너지가 가득합니다.', reversed: '동기부여가 부족하거나 시작이 지연되고 있습니다. 열정을 되살릴 방법을 찾으세요.', love: { upright: '설레는 새로운 인연의 시작입니다.', reversed: '관계에 열정이 식어가고 있습니다.' }, money: { upright: '새로운 수입원이 열립니다.', reversed: '사업 아이디어가 막혀있습니다.' }, health: { upright: '새로운 운동이나 활동을 시작하기 딱 좋은 때예요. 에너지가 넘칩니다!', reversed: '의욕만 앞서서 몸이 따라가지 못할 수 있어요. 준비운동 꼭 하세요.' }, career: { upright: '창업이나 새 프로젝트를 시작할 열정이 가득해요. 지금이 기회!', reversed: '하고 싶은 건 많은데 실행이 안 돼요. 작은 것부터 시작해보세요.' } },
      2: { upright: '계획과 결정의 시기입니다. 세계를 손에 쥐고 다음 행보를 결정하세요.', reversed: '결정을 미루고 있습니다. 두려움을 극복하고 선택하세요.', love: { upright: '관계에서 중요한 결정을 내릴 때입니다.', reversed: '관계의 방향에 대해 고민이 많습니다.' }, money: { upright: '투자나 사업의 방향을 결정해야 합니다.', reversed: '재정 계획이 불확실합니다.' }, health: { upright: '건강 계획을 세우고 실천할 에너지가 있어요. 운동 루틴을 짜보세요.', reversed: '이것저것 건강법을 고민만 하고 있어요. 하나만 골라서 시작하세요.' }, career: { upright: '커리어 방향을 정할 때예요. 비전을 세우고 밀고 나가세요.', reversed: '진로 고민이 깊어요. 너무 오래 망설이면 기회가 지나갑니다.' } },
      3: { upright: '노력의 첫 결실이 보이기 시작합니다. 기회가 다가오고 있으니 준비하세요.', reversed: '기다림이 길어지고 있습니다. 인내심을 가지세요.', love: { upright: '관계가 발전하고 있습니다.', reversed: '기대한 만큼 관계가 진전되지 않습니다.' }, money: { upright: '사업이나 투자에서 전망이 밝습니다.', reversed: '예상보다 수익이 늦어질 수 있습니다.' }, health: { upright: '운동 효과가 슬슬 나타나기 시작해요. 꾸준히 가세요!', reversed: '체력이 기대만큼 안 올라요. 조급해하지 말고 천천히 가세요.' }, career: { upright: '준비한 일이 결실을 맺기 시작해요. 기회가 오고 있어요.', reversed: '성과가 더딘 느낌이에요. 조금만 더 인내하면 됩니다.' } },
      4: { upright: '축하와 기쁨의 시기입니다. 안정과 조화를 이루어 가정에 경사가 있을 수 있습니다.', reversed: '불안정하거나 뿌리내리지 못하는 느낌입니다.', love: { upright: '결혼이나 동거 등 안정적인 관계로 발전합니다.', reversed: '관계에 불안정감이 있습니다.' }, money: { upright: '재정적 안정이 찾아옵니다.', reversed: '재정적 기반이 흔들릴 수 있습니다.' }, health: { upright: '몸과 마음이 안정돼서 컨디션이 좋아요. 활력이 넘치는 시기!', reversed: '안정을 못 찾고 불안해서 체력이 떨어질 수 있어요. 쉬면서 충전하세요.' }, career: { upright: '직장에서 축하받을 일이 생겨요. 승진이나 좋은 평가가 기대됩니다.', reversed: '일에서 안정감을 못 느끼고 있어요. 기반을 다시 다져보세요.' } },
      5: { upright: '경쟁이나 갈등 상황이지만, 건설적인 방향으로 활용할 수 있습니다.', reversed: '불필요한 갈등을 피하세요. 타협이 필요합니다.', love: { upright: '관계에서 건강한 토론이 필요합니다.', reversed: '감정적 싸움을 멈추세요.' }, money: { upright: '경쟁을 통해 더 나아질 수 있습니다.', reversed: '불필요한 소비 경쟁을 피하세요.' }, health: { upright: '경쟁 스포츠나 격한 운동으로 스트레스를 풀어보세요.', reversed: '과도한 경쟁심에 몸을 혹사하고 있어요. 부상 조심하세요.' }, career: { upright: '경쟁 속에서 성장할 수 있어요. 건전한 라이벌 의식을 가져보세요.', reversed: '직장 내 갈등이 스트레스예요. 불필요한 다툼은 피하세요.' } },
      6: { upright: '승리와 인정의 시기입니다. 리더십을 발휘하면 좋은 결과가 따릅니다.', reversed: '자만심에 주의하세요. 겸손한 태도가 필요합니다.', love: { upright: '관계에서 주도권을 잡을 수 있습니다.', reversed: '자기중심적인 태도가 관계를 해칩니다.' }, money: { upright: '성과에 대한 보상이 주어집니다.', reversed: '과도한 자신감이 손해를 부릅니다.' }, health: { upright: '활력이 넘치고 체력이 최상이에요. 운동 대회에 도전해볼 만해요!', reversed: '자신감이 과해서 무리하기 쉬워요. 몸의 신호에 귀 기울이세요.' }, career: { upright: '리더로서 인정받는 시기예요. 팀을 이끌면 좋은 성과가 나와요.', reversed: '자만심이 동료와의 관계를 해칠 수 있어요. 겸손하게 가세요.' } },
      7: { upright: '방어하고 지켜야 할 것이 있습니다. 자신의 입장을 확고히 하세요.', reversed: '지나친 방어적 태도가 기회를 막습니다.', love: { upright: '관계를 지키기 위해 노력이 필요합니다.', reversed: '불필요한 경계심을 풀어보세요.' }, money: { upright: '기존 재산을 잘 지키세요.', reversed: '방어에만 급급하면 성장이 없습니다.' }, health: { upright: '면역력을 지키는 데 집중하세요. 건강 수비가 중요한 시기예요.', reversed: '너무 건강 걱정만 하면 오히려 스트레스예요. 적당히 관리하세요.' }, career: { upright: '자기 포지션을 지키면서 실력으로 승부하세요.', reversed: '방어적 태도가 새로운 기회를 막고 있어요. 마음을 열어보세요.' } },
      8: { upright: '빠른 진행과 발전입니다. 일이 순조롭게 풀리며 속도가 붙습니다.', reversed: '서두르면 실수가 생깁니다. 속도를 조절하세요.', love: { upright: '관계가 빠르게 발전합니다.', reversed: '너무 빠른 관계 진행에 주의하세요.' }, money: { upright: '빠르게 수익이 들어옵니다.', reversed: '성급한 투자 결정을 피하세요.' }, health: { upright: '신진대사가 활발해요. 유산소 운동 효과가 좋은 시기입니다.', reversed: '너무 급하게 운동 강도를 올리면 다칠 수 있어요. 페이스 조절하세요.' }, career: { upright: '일이 빠르게 진행돼요. 추진력을 살려서 밀어붙이세요!', reversed: '서두르다 실수할 수 있어요. 속도보다 정확성이 중요합니다.' } },
      9: { upright: '끈기와 인내로 거의 끝에 다다랐습니다. 마지막 힘을 내세요.', reversed: '지쳐있지만 포기하면 안 됩니다. 도움을 요청하세요.', love: { upright: '관계에서 인내가 보상받습니다.', reversed: '관계 피로감이 쌓이고 있습니다.' }, money: { upright: '오래 기다린 수익이 곧 들어옵니다.', reversed: '재정적 스트레스가 쌓이고 있습니다.' }, health: { upright: '체력적으로 힘들지만 거의 고비를 넘겼어요. 조금만 더 버텨요!', reversed: '번아웃 직전이에요. 무리하지 말고 충분히 쉬어가세요.' }, career: { upright: '힘든 프로젝트가 거의 끝나가요. 마지막까지 집중하세요!', reversed: '업무 과로로 지쳐있어요. 도움을 요청하는 것도 능력입니다.' } },
      10: { upright: '과도한 책임과 부담을 지고 있습니다. 내려놓을 것은 내려놓으세요.', reversed: '짐을 나누거나 줄일 방법을 찾으세요.', love: { upright: '관계에서 너무 많은 책임을 지고 있습니다.', reversed: '부담스러운 관계를 정리하세요.' }, money: { upright: '재정적 부담이 크지만 해결 방법이 있습니다.', reversed: '빚이나 의무를 줄여나가세요.' }, health: { upright: '과로와 스트레스로 몸이 무거워요. 짐을 좀 덜어내세요.', reversed: '번아웃이 심해요. 강제로라도 쉬는 시간을 만드세요.' }, career: { upright: '업무가 과중해요. 위임할 건 위임하고 우선순위를 정하세요.', reversed: '너무 많은 일을 떠안고 있어요. 과감히 내려놓아야 앞으로 갈 수 있어요.' } },
      11: { upright: '새로운 소식과 모험적인 기회가 옵니다. 젊은 에너지로 도전하세요.', reversed: '경솔한 행동이나 미숙함에 주의하세요.', love: { upright: '설레는 메시지나 만남이 기다립니다.', reversed: '가벼운 마음의 접근이 문제가 됩니다.' }, money: { upright: '새로운 사업 기회가 전해집니다.', reversed: '검증되지 않은 기회에 주의하세요.' }, health: { upright: '새로운 운동이나 액티비티에 도전해보세요. 젊은 에너지가 넘쳐요!', reversed: '무모한 활동으로 다칠 수 있어요. 안전장비 챙기세요.' }, career: { upright: '신선한 아이디어로 주목받을 수 있어요. 적극적으로 제안해보세요.', reversed: '경험 부족이 드러날 수 있어요. 배우는 자세가 필요합니다.' } },
      12: { upright: '열정적으로 목표를 향해 돌진합니다. 행동력이 최고입니다.', reversed: '무모하거나 급한 행동이 문제를 일으킵니다.', love: { upright: '적극적인 구애가 성공합니다.', reversed: '너무 급하게 접근하면 역효과입니다.' }, money: { upright: '과감한 투자가 좋은 결과를 가져옵니다.', reversed: '충동적 투자에 주의하세요.' }, health: { upright: '운동에 대한 열정이 최고조예요. 체력이 빠르게 좋아집니다.', reversed: '과격한 운동으로 근육이나 관절을 다칠 수 있어요. 워밍업 필수!' }, career: { upright: '적극적인 행동력이 커리어를 빠르게 발전시켜요.', reversed: '너무 급하게 밀어붙이면 동료와 마찰이 생겨요. 호흡을 맞추세요.' } },
      13: { upright: '자신감 있고 따뜻한 리더십을 발휘하세요. 창의적 능력이 빛납니다.', reversed: '질투심이나 독재적 태도에 주의하세요.', love: { upright: '매력이 빛나는 시기입니다.', reversed: '소유욕이 관계를 해칩니다.' }, money: { upright: '사업 수완이 좋은 시기입니다.', reversed: '재정 관리에 감정을 개입시키지 마세요.' }, health: { upright: '자신감이 넘쳐서 건강 관리도 즐겁게 해요. 요가나 댄스 추천!', reversed: '감정 기복이 체력에 영향을 줘요. 마음을 다스리는 게 우선이에요.' }, career: { upright: '창의적 리더십으로 팀에 활기를 불어넣어요. 사업 수완이 빛나는 시기!', reversed: '질투심이 커리어를 방해해요. 남과 비교하지 말고 자기 길을 가세요.' } },
      14: { upright: '강력한 리더십과 비전으로 큰일을 성사시킵니다.', reversed: '독단적이거나 권위적인 태도가 반발을 부릅니다.', love: { upright: '포용력 있는 리더 같은 파트너입니다.', reversed: '지배적인 태도가 관계를 힘들게 합니다.' }, money: { upright: '사업적 성공과 재물이 따릅니다.', reversed: '독단적 결정이 재정 손실을 부릅니다.' }, health: { upright: '강한 체력과 활력으로 어떤 활동도 거뜬해요. 리더다운 건강!', reversed: '과도한 책임감이 스트레스를 유발해요. 가끔은 내려놓고 쉬세요.' }, career: { upright: '사업가로서 비전을 실현할 때예요. CEO 기질이 빛납니다!', reversed: '독단적 경영이 반발을 부를 수 있어요. 의견을 들어보세요.' } },
    },
    cups: {
      1: { upright: '새로운 사랑이나 감정적 시작이 찾아옵니다. 마음을 열면 행복이 들어옵니다.', reversed: '감정적 공허함이나 거부의 시기입니다.', love: { upright: '운명적인 만남의 시작입니다.', reversed: '마음을 닫고 있어 인연을 놓칩니다.' }, money: { upright: '기부하면 복이 돌아옵니다.', reversed: '감정적 소비를 조절하세요.' }, health: { upright: '마음이 편안해지면서 몸도 좋아져요. 명상이나 힐링 시작해보세요.', reversed: '감정적 공허함이 몸에도 영향을 줘요. 마음 챙김이 필요해요.' }, career: { upright: '마음이 끌리는 일을 시작해보세요. 창의적인 직업에 좋은 시기예요.', reversed: '일에 대한 열정을 잃었어요. 진짜 하고 싶은 게 뭔지 돌아보세요.' } },
      2: { upright: '아름다운 파트너십과 상호 사랑입니다. 두 마음이 하나가 됩니다.', reversed: '관계의 불균형이나 오해가 있습니다.', love: { upright: '완벽한 사랑의 조화입니다.', reversed: '소통 부재가 관계를 해칩니다.' }, money: { upright: '동업이나 파트너십이 유리합니다.', reversed: '금전적 파트너십에서 갈등이 있습니다.' }, health: { upright: '마음의 안정이 건강에 좋은 영향을 줘요. 정서적 균형이 잡혀요.', reversed: '관계 스트레스가 건강을 해치고 있어요. 감정 정리가 필요해요.' }, career: { upright: '좋은 파트너와 협업하면 시너지가 나요. 동업도 좋아요.', reversed: '동료와의 소통이 안 돼요. 오해를 풀고 마음을 맞춰보세요.' } },
      3: { upright: '축하하고 기뻐할 일이 생깁니다. 우정과 커뮤니티의 즐거움입니다.', reversed: '과음이나 방탕에 주의하세요.', love: { upright: '사교적 활동에서 인연을 만납니다.', reversed: '가벼운 관계를 조심하세요.' }, money: { upright: '모임이나 네트워킹을 통한 수익이 있습니다.', reversed: '유흥비 지출에 주의하세요.' }, health: { upright: '즐거운 사교 활동이 정신 건강에 도움이 돼요. 사람들을 만나세요!', reversed: '과음이나 과식에 주의하세요. 즐거움도 적당히가 좋아요.' }, career: { upright: '동료들과의 좋은 관계가 일에도 긍정적이에요. 팀워크가 빛나요.', reversed: '회식이나 모임에 너무 시간을 쓰면 업무에 지장이 생겨요.' } },
      4: { upright: '무관심이나 권태에 빠져있습니다. 주어진 것의 가치를 돌아보세요.', reversed: '새로운 관점으로 기회를 발견합니다.', love: { upright: '관계에 권태가 옵니다.', reversed: '새로운 사랑에 마음이 열리고 있습니다.' }, money: { upright: '좋은 기회를 무관심으로 놓칠 수 있습니다.', reversed: '새로운 재정 기회를 발견합니다.' }, health: { upright: '무기력함이 건강 관리를 소홀하게 만들어요. 의욕을 되찾아 보세요.', reversed: '권태에서 벗어나 새로운 건강 루틴을 발견해요.' }, career: { upright: '일에 흥미를 잃었어요. 새로운 자극이 필요한 시점이에요.', reversed: '새로운 관점으로 일의 의미를 재발견해요. 전환점이 될 수 있어요.' } },
      5: { upright: '상실과 슬픔을 경험하지만, 아직 남아있는 것에 주목하세요.', reversed: '슬픔을 극복하고 회복하기 시작합니다.', love: { upright: '관계에서 상실감을 느낍니다.', reversed: '이별의 아픔에서 회복하고 있습니다.' }, money: { upright: '재정적 손실이 있을 수 있습니다.', reversed: '손실에서 회복하기 시작합니다.' }, health: { upright: '슬픔이나 우울감이 몸에 영향을 줘요. 마음의 상처를 돌봐주세요.', reversed: '감정적 회복이 시작되면서 건강도 나아지기 시작해요.' }, career: { upright: '일에서 실망하는 일이 있지만, 남은 기회에 집중하세요.', reversed: '실패에서 배우고 다시 일어서고 있어요. 회복 중이에요.' } },
      6: { upright: '과거의 추억이나 인연이 돌아옵니다. 향수와 순수한 기쁨입니다.', reversed: '과거에 집착하지 마세요.', love: { upright: '첫사랑이나 옛 인연과 재회할 수 있습니다.', reversed: '과거 연인에 대한 미련을 놓으세요.' }, money: { upright: '과거 투자가 수익을 가져옵니다.', reversed: '과거의 재정 방식에 집착하지 마세요.' }, health: { upright: '어린 시절처럼 순수한 마음이 건강에 도움이 돼요. 스트레스가 줄어요.', reversed: '과거의 안 좋은 습관이 건강을 해칠 수 있어요. 새로운 루틴을 만드세요.' }, career: { upright: '과거 경험이 현재 일에 도움이 돼요. 옛 인맥이 기회를 가져다줘요.', reversed: '과거의 성공에 안주하지 마세요. 새로운 도전이 필요해요.' } },
      7: { upright: '환상과 유혹이 많습니다. 현실을 직시하고 올바른 선택을 하세요.', reversed: '환상에서 깨어나 현실을 볼 수 있습니다.', love: { upright: '이상적인 관계에 대한 환상을 주의하세요.', reversed: '현실적인 사랑의 가치를 알게 됩니다.' }, money: { upright: '비현실적인 투자에 주의하세요.', reversed: '재정적 환상에서 깨어납니다.' }, health: { upright: '몸에 좋다는 것에 현혹되지 마세요. 검증된 건강법을 선택하세요.', reversed: '비현실적 건강 기대에서 벗어나 현실적인 관리를 시작해요.' }, career: { upright: '꿈같은 직업 환상에 빠지지 마세요. 현실적인 커리어 계획이 필요해요.', reversed: '환상에서 깨어나 실질적인 커리어 목표를 세워요.' } },
      8: { upright: '더 큰 것을 위해 현재를 떠나야 합니다. 용기 있는 변화의 때입니다.', reversed: '떠나야 할지 남아야 할지 고민이 깊습니다.', love: { upright: '관계를 떠나 새로운 길을 찾아야 할 때입니다.', reversed: '떠날 용기가 나지 않지만 변화가 필요합니다.' }, money: { upright: '현재 수입원을 버리고 새로운 길을 찾을 때입니다.', reversed: '현 상황에 안주하려는 마음과 변화 욕구 사이에서 갈등합니다.' }, health: { upright: '정신적으로 성장할 때예요. 명상이나 심리 상담이 도움이 됩니다.', reversed: '감정적 미련이 스트레스를 주고 있어요. 놓아주는 연습이 필요해요.' }, career: { upright: '지금 직장을 떠나 새로운 길을 찾을 용기가 필요해요.', reversed: '이직 고민이 깊어요. 마음이 시키는 대로 하되 준비는 철저히 하세요.' } },
      9: { upright: '소원 성취의 카드입니다. 물질적, 감정적 만족이 가득합니다.', reversed: '만족을 느끼기 어렵습니다. 감사하는 마음을 가지세요.', love: { upright: '사랑에 대한 소원이 이루어집니다.', reversed: '사랑에 대한 기대가 너무 높습니다.' }, money: { upright: '재정적 소원이 성취됩니다. 풍요로운 시기입니다.', reversed: '물질적 풍요가 있어도 만족을 모릅니다.' }, health: { upright: '마음이 만족스러우니 건강도 최상이에요. 행복이 최고의 보약!', reversed: '겉으로는 괜찮아 보여도 마음속 불만이 건강을 갉아먹어요.' }, career: { upright: '원하던 직업이나 포지션을 얻게 돼요. 소원 성취의 시기!', reversed: '일에서 만족을 느끼지 못해요. 진짜 원하는 게 뭔지 돌아보세요.' } },
      10: { upright: '가정의 행복과 완전한 감정적 충만함입니다.', reversed: '가족 간 갈등이나 관계의 균열에 주의하세요.', love: { upright: '행복한 가정의 완성입니다.', reversed: '가족 관계에서 문제가 있습니다.' }, money: { upright: '가족과 함께하는 재정적 안정입니다.', reversed: '가족으로 인한 재정적 부담이 있습니다.' }, health: { upright: '가족의 사랑이 정신 건강에 큰 힘이 돼요. 마음이 따뜻해요.', reversed: '가족 갈등이 스트레스를 줘요. 대화로 풀어나가세요.' }, career: { upright: '일과 가정의 균형이 잘 맞아요. 행복한 워라밸이에요.', reversed: '가정 문제가 업무에 영향을 줘요. 균형을 찾아야 해요.' } },
      11: { upright: '감성적이고 창의적인 메시지가 옵니다. 예술적 영감을 따르세요.', reversed: '감정적 미숙함이나 비현실적 기대에 주의하세요.', love: { upright: '순수한 고백이나 러브레터를 받을 수 있습니다.', reversed: '감정적으로 미성숙한 만남을 주의하세요.' }, money: { upright: '창의적 아이디어가 수익으로 이어집니다.', reversed: '비현실적인 사업 계획에 주의하세요.' }, health: { upright: '감성을 표현하는 활동이 정신 건강에 좋아요. 그림 그리기나 일기 쓰기 추천!', reversed: '감정을 억누르면 스트레스성 증상이 나타날 수 있어요.' }, career: { upright: '창의적인 일에서 두각을 나타내요. 예술, 디자인, 상담 분야에 기회!', reversed: '감정에 치우쳐 전문성이 부족해 보일 수 있어요. 실력도 키우세요.' } },
      12: { upright: '로맨틱한 제안이나 감정적 초대가 옵니다.', reversed: '감정에 속거나 비현실적 약속에 주의하세요.', love: { upright: '로맨틱한 프러포즈나 고백이 있습니다.', reversed: '말뿐인 약속을 주의하세요.' }, money: { upright: '감성적 투자(예술품 등)가 좋은 결과를 냅니다.', reversed: '감정에 치우친 투자 결정을 피하세요.' }, health: { upright: '감정이 풍부해지면서 활력도 생겨요. 수영이나 물놀이가 좋아요.', reversed: '감정 기복이 심해서 수면에 영향을 줄 수 있어요. 마음을 안정시키세요.' }, career: { upright: '직관을 믿고 움직이면 좋은 기회를 잡아요. 감성 마케팅에 재능!', reversed: '감정에 휘둘리면 판단이 흐려져요. 냉정한 분석도 필요해요.' } },
      13: { upright: '따뜻한 포용력과 깊은 직관력을 발휘하세요.', reversed: '감정적 의존이나 과도한 감수성에 주의하세요.', love: { upright: '깊은 사랑과 돌봄을 주고받습니다.', reversed: '감정적으로 소모되고 있습니다.' }, money: { upright: '직관으로 좋은 재정 결정을 내립니다.', reversed: '감정에 치우친 결정을 조심하세요.' }, health: { upright: '마음을 돌보는 것이 곧 건강이에요. 심리 상담이나 명상이 큰 도움!', reversed: '남을 돌보느라 자기 건강을 소홀히 하고 있어요. 나부터 챙기세요.' }, career: { upright: '돌봄, 상담, 의료 등 사람을 돕는 일에서 빛나요.', reversed: '감정 소모가 심한 일이라면 번아웃에 주의하세요.' } },
      14: { upright: '감정적 성숙함과 지혜로 주변을 이끕니다.', reversed: '감정적 조종이나 억압에 주의하세요.', love: { upright: '성숙하고 깊은 사랑을 경험합니다.', reversed: '감정적으로 닫혀있거나 냉담합니다.' }, money: { upright: '감정과 이성의 균형으로 좋은 재정 결정을 합니다.', reversed: '감정적 동요가 재정 판단을 흐립니다.' }, health: { upright: '정서적 안정이 건강의 바탕이에요. 마음이 평온하면 몸도 편해요.', reversed: '감정을 억누르면 심신에 무리가 와요. 감정 표현을 연습하세요.' }, career: { upright: '감정적 지혜로 조직을 이끌어요. 인사, 교육, 심리 분야에서 탁월!', reversed: '감정적으로 조종하는 리더가 되지 않도록 주의하세요.' } },
    },
    swords: {
      1: { upright: '진실의 힘으로 돌파하세요. 명확한 사고와 결단의 시기입니다.', reversed: '혼란스러운 생각이나 잘못된 판단에 주의하세요.', love: { upright: '솔직한 대화가 관계를 개선합니다.', reversed: '말로 상처를 줄 수 있습니다.' }, money: { upright: '명확한 판단으로 좋은 결정을 내립니다.', reversed: '잘못된 정보에 기반한 결정을 주의하세요.' }, health: { upright: '머리가 맑아지는 시기예요. 새로운 건강 정보를 분석해서 적용해보세요.', reversed: '생각이 너무 많아서 머리가 아플 수 있어요. 명상으로 마음을 비우세요.' }, career: { upright: '명확한 목표 설정으로 커리어를 돌파해요. 분석력이 빛나는 시기!', reversed: '잘못된 판단으로 커리어에 타격이 올 수 있어요. 신중하게 결정하세요.' } },
      2: { upright: '결정을 내리지 못하고 있습니다. 마음을 열고 진실을 마주하세요.', reversed: '교착 상태가 풀리기 시작합니다.', love: { upright: '마음을 결정하지 못하고 있습니다.', reversed: '마음의 결정을 내리게 됩니다.' }, money: { upright: '재정 결정을 미루고 있습니다.', reversed: '재정적 교착 상태가 풀립니다.' }, health: { upright: '이런저런 걱정으로 잠을 못 자고 있어요. 결정을 내리면 마음이 편해져요.', reversed: '고민이 풀리면서 수면의 질이 좋아져요.' }, career: { upright: '두 가지 선택지 사이에서 고민 중이에요. 직감보다 데이터로 판단하세요.', reversed: '고민하던 커리어 방향이 잡히기 시작해요.' } },
      3: { upright: '가슴 아픈 상처와 슬픔입니다. 하지만 이 아픔도 지나갑니다.', reversed: '상처를 치유하고 회복하기 시작합니다.', love: { upright: '이별이나 배신의 아픔이 있습니다.', reversed: '마음의 상처가 서서히 아물고 있습니다.' }, money: { upright: '재정적 손실로 고통받습니다.', reversed: '재정적 상처에서 회복합니다.' }, health: { upright: '정신적 고통이 두통이나 가슴 통증으로 나타날 수 있어요. 마음을 돌보세요.', reversed: '마음의 상처가 아물면서 몸도 회복되고 있어요.' }, career: { upright: '직장에서 상처받는 일이 있어요. 하지만 이 경험도 성장의 밑거름이에요.', reversed: '업무에서 받은 상처에서 회복 중이에요. 다시 일어설 수 있어요.' } },
      4: { upright: '휴식과 회복의 시간입니다. 지친 심신을 쉬게 하세요.', reversed: '너무 오래 쉬면 기회를 놓칩니다.', love: { upright: '관계에서 잠시 거리를 두고 쉬세요.', reversed: '고립에서 벗어나 소통을 시작하세요.' }, money: { upright: '재정 활동을 잠시 쉬고 점검하세요.', reversed: '활동을 재개할 때입니다.' }, health: { upright: '정신적 피로가 심해요. 충분한 수면과 명상으로 머리를 쉬게 하세요.', reversed: '너무 오래 쉬면 오히려 무기력해져요. 가벼운 활동부터 시작하세요.' }, career: { upright: '업무 과부하예요. 잠시 쉬면서 에너지를 충전하세요. 휴가 추천!', reversed: '쉬는 시간이 길어지면 복귀가 어려워요. 서서히 일상으로 돌아가세요.' } },
      5: { upright: '갈등에서 이기려 하기보다 진정으로 중요한 것이 무엇인지 생각하세요.', reversed: '갈등이 해소되어 가고 있습니다.', love: { upright: '관계에서 날카로운 갈등이 있습니다.', reversed: '다툼 후 화해가 가능합니다.' }, money: { upright: '재정적 분쟁이나 소송에 주의하세요.', reversed: '분쟁이 해결되어 갑니다.' }, health: { upright: '갈등으로 인한 스트레스가 두통이나 소화불량을 유발해요.', reversed: '갈등이 풀리면서 스트레스성 증상도 완화돼요.' }, career: { upright: '직장 내 갈등이 심해요. 이기는 것보다 해결하는 게 중요해요.', reversed: '직장 갈등이 해소되기 시작해요. 중재자 역할을 해보세요.' } },
      6: { upright: '어려운 시기를 벗어나 평화로운 곳으로 이동합니다.', reversed: '문제를 피해 도망치는 것은 해결이 아닙니다.', love: { upright: '관계의 어려움을 함께 극복하고 나아갑니다.', reversed: '문제를 회피하면 더 악화됩니다.' }, money: { upright: '재정적 어려움에서 벗어나기 시작합니다.', reversed: '재정 문제를 직면해야 합니다.' }, health: { upright: '스트레스에서 벗어나 회복기에 접어들어요. 환경을 바꿔보세요.', reversed: '문제를 피하기만 하면 스트레스가 계속돼요. 근본 원인을 해결하세요.' }, career: { upright: '힘든 업무 환경에서 벗어날 기회가 와요. 이직이나 부서 이동 추천.', reversed: '도망치듯 직장을 옮기면 같은 문제를 반복해요. 원인을 짚어보세요.' } },
      7: { upright: '전략적으로 행동해야 합니다. 정직하면서도 지혜롭게 처신하세요.', reversed: '부정직한 행동이 들통날 수 있습니다.', love: { upright: '관계에서 지혜로운 접근이 필요합니다.', reversed: '비밀이 드러나 관계에 위기가 올 수 있습니다.' }, money: { upright: '전략적 투자가 필요합니다.', reversed: '부정직한 거래에 주의하세요.' }, health: { upright: '건강도 전략이 필요해요. 자기 몸 상태를 잘 분석해서 관리하세요.', reversed: '건강에 대해 자기를 속이지 마세요. 불편하면 바로 검진받으세요.' }, career: { upright: '전략적 사고로 경쟁에서 앞서나갈 수 있어요.', reversed: '부정한 방법은 결국 들통나요. 정직하게 실력으로 승부하세요.' } },
      8: { upright: '스스로 만든 제약에 갇혀있습니다. 생각을 바꾸면 자유로워집니다.', reversed: '정신적 속박에서 벗어나기 시작합니다.', love: { upright: '자기 제한적 사고가 관계를 막고 있습니다.', reversed: '두려움을 극복하고 사랑에 다가갑니다.' }, money: { upright: '두려움이 재정적 성장을 막고 있습니다.', reversed: '재정적 두려움에서 벗어나고 있습니다.' }, health: { upright: '부정적인 생각이 건강을 옥죄고 있어요. 생각을 바꾸면 몸도 가벼워져요.', reversed: '정신적 속박에서 벗어나면서 두통이나 어깨 통증이 나아져요.' }, career: { upright: '자기 한계를 스스로 만들고 있어요. 할 수 있다고 믿으면 길이 열려요.', reversed: '직장에서 느끼던 막힘이 풀리기 시작해요. 새로운 가능성이 보여요.' } },
      9: { upright: '걱정과 불안이 너무 많습니다. 대부분은 기우입니다. 마음을 놓으세요.', reversed: '불안에서 벗어나고 있습니다.', love: { upright: '관계에 대한 걱정이 너무 많습니다.', reversed: '관계에 대한 불안이 줄어듭니다.' }, money: { upright: '재정 걱정이 수면을 방해합니다.', reversed: '재정 불안이 완화됩니다.' }, health: { upright: '불안과 걱정으로 불면증이 올 수 있어요. 걱정의 90%는 일어나지 않아요.', reversed: '불안이 줄면서 수면의 질이 좋아지고 건강도 회복돼요.' }, career: { upright: '업무 걱정에 잠을 못 자요. 최악의 시나리오 대비만 해두고 놓으세요.', reversed: '업무 불안에서 벗어나고 있어요. 마음이 편해지면 성과도 나와요.' } },
      10: { upright: '최악의 상황이지만, 이것이 끝이자 새로운 시작입니다.', reversed: '가장 어두운 시기가 지나가고 있습니다.', love: { upright: '관계의 최대 위기입니다.', reversed: '최악의 시기를 넘기고 회복합니다.' }, money: { upright: '재정적 최저점이지만 여기서 더 나빠지지는 않습니다.', reversed: '최악의 재정 상황에서 벗어나고 있습니다.' }, health: { upright: '정신적으로 매우 힘든 시기예요. 전문가의 도움을 받는 것도 방법이에요.', reversed: '가장 힘든 시기는 지났어요. 조금씩 회복하고 있으니 힘내세요.' }, career: { upright: '커리어의 최대 위기예요. 하지만 바닥을 찍었으니 이제 올라갈 일만 남았어요.', reversed: '최악의 업무 상황이 끝나가고 있어요. 새로운 시작이 기다려요.' } },
      11: { upright: '진실을 탐구하는 자세로 정보를 수집하세요.', reversed: '가십이나 소문에 주의하세요.', love: { upright: '관계에서 진실을 찾으려는 태도가 중요합니다.', reversed: '소문에 흔들리지 마세요.' }, money: { upright: '재정 정보를 철저히 조사하세요.', reversed: '잘못된 정보에 속지 마세요.' }, health: { upright: '건강 정보를 꼼꼼히 알아보세요. 정확한 지식이 건강을 지켜줘요.', reversed: '인터넷 건강 정보에 너무 의존하지 마세요. 전문가에게 물어보세요.' }, career: { upright: '정보 수집과 분석 능력이 빛나요. 리서치나 저널리즘에 재능!', reversed: '사내 소문에 휘말리지 마세요. 팩트만 보고 판단하세요.' } },
      12: { upright: '빠른 결단과 행동이 필요합니다. 과감히 움직이세요.', reversed: '무모한 돌진이 사고를 부릅니다.', love: { upright: '빠르게 결단을 내려야 하는 관계 상황입니다.', reversed: '급한 결정이 관계를 해칩니다.' }, money: { upright: '빠른 결정으로 기회를 잡으세요.', reversed: '급한 투자 결정을 피하세요.' }, health: { upright: '빠른 판단력이 건강 위기 대처에 도움이 돼요. 몸에 이상이 있으면 바로 병원!', reversed: '너무 급하게 행동하면 사고 위험이 있어요. 안전 먼저 생각하세요.' }, career: { upright: '빠른 의사결정이 필요한 시기예요. 분석하고 바로 실행하세요.', reversed: '성급한 결정이 큰 실수로 이어질 수 있어요. 한 박자 쉬고 판단하세요.' } },
      13: { upright: '날카로운 판단력과 명확한 소통으로 문제를 해결합니다.', reversed: '차가운 태도가 관계를 해칩니다.', love: { upright: '명확한 소통이 관계를 개선합니다.', reversed: '너무 날카로운 말이 상처를 줍니다.' }, money: { upright: '냉철한 판단으로 재정을 관리합니다.', reversed: '감정을 배제한 결정이 때로는 손해를 줍니다.' }, health: { upright: '머리를 많이 쓰는 시기라 두통에 주의하세요. 뇌 건강 관리가 중요해요.', reversed: '너무 날카로워지면 신경이 예민해져요. 긴장을 풀어주는 활동을 하세요.' }, career: { upright: '소통과 분석 능력으로 문제를 해결해요. 컨설팅이나 법률 분야에 강점!', reversed: '날카로운 비판이 동료를 상처줄 수 있어요. 표현을 부드럽게 하세요.' } },
      14: { upright: '공정하고 지적인 판단으로 상황을 정리합니다.', reversed: '독단적이고 냉정한 태도에 주의하세요.', love: { upright: '이성적이면서도 공정한 관계입니다.', reversed: '감정 없는 관계에 주의하세요.' }, money: { upright: '논리적 판단으로 재정적 성공을 거둡니다.', reversed: '인정머리 없는 결정이 반발을 부릅니다.' }, health: { upright: '논리적으로 건강을 관리하면 좋은 결과가 나와요. 데이터 기반 건강 관리 추천!', reversed: '머리만 쓰고 몸은 안 움직이면 건강이 나빠져요. 운동을 병행하세요.' }, career: { upright: '공정한 리더십으로 조직을 이끌어요. 법률, 학계, 경영 분야에서 최고!', reversed: '너무 냉정한 판단이 팀 사기를 떨어뜨려요. 따뜻함도 필요해요.' } },
    },
    pentacles: {
      1: { upright: '새로운 재물운과 물질적 기회가 열립니다.', reversed: '기회를 놓치거나 재정적 시작이 불안합니다.', love: { upright: '안정적인 새 인연을 만납니다.', reversed: '물질적 조건에만 집중하면 인연을 놓칩니다.' }, money: { upright: '새로운 수입원이 열립니다. 사업 시작에 좋습니다.', reversed: '투자 시작이 불안합니다. 더 알아보세요.' }, health: { upright: '새로운 건강 습관을 시작하기 좋은 때예요. 식단 개선이나 운동 시작이 잘 될 거예요.', reversed: '건강 관리 시작이 흐지부지될 수 있어요. 작은 것부터 꾸준히 해보세요.' }, career: { upright: '새로운 사업이나 프로젝트에 물질적 기반이 마련돼요. 시작하세요!', reversed: '창업이나 새 프로젝트의 자금 계획이 부족해요. 더 준비하세요.' } },
      2: { upright: '여러 가지를 동시에 잘 관리하고 있습니다. 유연하게 대처하세요.', reversed: '너무 많은 일을 벌여놓아 관리가 어렵습니다.', love: { upright: '관계에서 균형을 잘 잡고 있습니다.', reversed: '관계에 집중하지 못하고 있습니다.' }, money: { upright: '여러 수입원을 잘 관리합니다.', reversed: '재정 관리가 복잡해지고 있습니다.' }, health: { upright: '여러 건강 관리를 잘 병행하고 있어요. 균형 잡힌 식사와 운동을 유지하세요.', reversed: '이것저것 하느라 오히려 건강 관리가 안 되고 있어요. 하나에 집중하세요.' }, career: { upright: '멀티태스킹 능력이 빛나는 시기예요. 여러 업무를 유연하게 처리할 수 있어요.', reversed: '너무 많은 일을 벌여서 어느 것도 제대로 못 하고 있어요. 우선순위를 정하세요.' } },
      3: { upright: '전문성과 실력이 인정받는 시기입니다. 장인정신을 발휘하세요.', reversed: '실력이 부족하거나 인정받지 못하고 있습니다.', love: { upright: '함께 무언가를 만들어가는 관계입니다.', reversed: '관계에 노력이 부족합니다.' }, money: { upright: '전문성으로 수입이 증가합니다.', reversed: '실력 부족으로 기회를 놓칩니다.' }, health: { upright: '몸이 튼튼하고 체력이 좋은 시기예요. 손으로 하는 활동(요리, 정원 가꾸기)이 치유가 돼요.', reversed: '같은 자세로 오래 일하면 근골격계 문제가 생길 수 있어요. 스트레칭하세요.' }, career: { upright: '전문 기술과 실력이 인정받아요. 자격증이나 스킬업이 승진으로 이어질 수 있어요.', reversed: '기술이 부족하다고 느끼고 있어요. 배움에 투자하는 시간이 필요해요.' } },
      4: { upright: '재산을 잘 지키고 있지만, 지나친 인색함은 주의하세요.', reversed: '재정적 불안으로 너무 움켜쥐거나 반대로 낭비합니다.', love: { upright: '안정적이지만 변화가 없는 관계입니다.', reversed: '소유욕이 관계를 해칩니다.' }, money: { upright: '저축과 재산 보전에 좋은 시기입니다.', reversed: '지나친 인색함이나 과소비 모두 주의하세요.' }, health: { upright: '안정적인 건강 상태예요. 지금의 좋은 습관을 잘 유지하면 돼요.', reversed: '건강을 지키려고 너무 집착하거나, 반대로 방치하고 있어요. 적절한 균형을 찾으세요.' }, career: { upright: '현재 직장에서 안정적인 위치를 잘 지키고 있어요. 꾸준함이 무기예요.', reversed: '변화를 거부하면 도태될 수 있어요. 새로운 기술이나 역할에 눈을 돌려보세요.' } },
      5: { upright: '경제적 어려움이나 건강 문제에 주의하세요. 도움을 구하세요.', reversed: '어려운 시기가 지나가고 있습니다.', love: { upright: '경제적 어려움이 관계에 영향을 줍니다.', reversed: '함께 어려움을 극복합니다.' }, money: { upright: '재정적 어려움이 있습니다. 절약이 필요합니다.', reversed: '재정 상황이 개선되기 시작합니다.' }, health: { upright: '면역력이 떨어지기 쉬운 때예요. 영양 보충과 충분한 수면이 중요해요.', reversed: '건강 문제가 서서히 나아지고 있어요. 포기하지 말고 관리를 계속하세요.' }, career: { upright: '직업적으로 어려운 시기예요. 실직이나 수입 감소에 대비하세요.', reversed: '직업적 어려움이 해소되기 시작해요. 다시 기회가 올 거예요.' } },
      6: { upright: '베풀고 나누면 복이 돌아옵니다. 관대함의 시기입니다.', reversed: '받기만 하려는 태도나 불공평한 거래에 주의하세요.', love: { upright: '주고받는 균형 있는 관계입니다.', reversed: '일방적인 관계입니다.' }, money: { upright: '기부하면 더 큰 복이 옵니다. 후원, 봉사 추천.', reversed: '공정하지 않은 거래에 주의하세요.' }, health: { upright: '다른 사람을 돕는 활동이 내 건강에도 좋아요. 봉사나 나눔이 마음의 건강을 채워줘요.', reversed: '남을 돌보느라 정작 자기 건강은 방치하고 있어요. 나 자신도 챙기세요.' }, career: { upright: '베푸는 마음이 직업적 성공으로 이어져요. 멘토링, 교육, 복지 분야에 적성!', reversed: '일에서 공정하지 못한 대우를 받고 있어요. 자기 가치를 당당히 주장하세요.' } },
      7: { upright: '투자한 것들이 서서히 자라고 있습니다. 인내심을 가지세요.', reversed: '조급함이 성과를 망칩니다.', love: { upright: '관계에 투자한 시간이 결실을 맺고 있습니다.', reversed: '관계에서 결과가 안 보여 조급합니다.' }, money: { upright: '장기 투자가 수익을 내기 시작합니다.', reversed: '조급한 환매가 손해를 부릅니다.' }, health: { upright: '꾸준히 해온 건강 관리가 서서히 효과를 보이고 있어요. 인내심을 갖고 계속하세요.', reversed: '빨리 효과를 보려고 무리한 다이어트나 운동을 하면 역효과예요.' }, career: { upright: '지금까지 쌓아온 실력과 경력이 결실을 맺기 시작해요. 조금만 더 기다리세요.', reversed: '성과가 안 나온다고 포기하면 아까워요. 방향만 점검하고 꾸준히 가세요.' } },
      8: { upright: '꾸준한 노력으로 전문가의 길을 걷고 있습니다. 장인이 되는 과정입니다.', reversed: '반복 작업에 지쳐있습니다. 의미를 되새기세요.', love: { upright: '관계를 위해 꾸준히 노력하고 있습니다.', reversed: '관계가 의무적으로 느껴집니다.' }, money: { upright: '꾸준한 노력이 재정적 성과로 이어집니다.', reversed: '노력에 비해 보상이 적게 느껴집니다.' }, health: { upright: '규칙적이고 꾸준한 생활 습관이 건강의 비결이에요. 지금 하고 있는 그대로 좋아요.', reversed: '같은 일만 반복하면서 몸이 지쳐가고 있어요. 변화와 휴식이 필요해요.' }, career: { upright: '장인 정신으로 꾸준히 기술을 갈고닦으면 최고가 될 수 있어요. 포기하지 마세요.', reversed: '반복적인 업무에 번아웃이 왔어요. 잠시 쉬거나 새로운 도전을 찾아보세요.' } },
      9: { upright: '물질적 풍요와 자립의 달성입니다. 노력의 결실을 즐기세요.', reversed: '외로운 성공이거나 물질에만 집착하고 있습니다.', love: { upright: '독립적이면서도 풍요로운 관계입니다.', reversed: '물질적 성공이 관계를 대체하고 있습니다.' }, money: { upright: '재정적 자유를 이루었습니다.', reversed: '돈은 있지만 행복하지 않습니다.' }, health: { upright: '물질적 여유가 건강 관리에도 도움을 주고 있어요. 좋은 음식, 좋은 환경을 즐기세요.', reversed: '돈은 벌었지만 건강을 잃었다면 의미가 없어요. 건강이 진짜 부자예요.' }, career: { upright: '독립적으로 성공을 이뤘어요. 자영업이나 프리랜서로 풍요로운 시기!', reversed: '성공했지만 외롭고 허전해요. 동료와의 관계도 소중히 하세요.' } },
      10: { upright: '가문의 번영과 세대를 이어가는 재물입니다.', reversed: '가족 재산 문제나 상속 갈등에 주의하세요.', love: { upright: '가정의 안정과 번영입니다.', reversed: '가족 문제가 관계에 영향을 줍니다.' }, money: { upright: '큰 재산이나 유산을 받을 수 있습니다.', reversed: '상속이나 재산 분배에서 갈등이 있습니다.' }, health: { upright: '가족 모두 건강하고 안정적인 시기예요. 가족 건강 검진을 함께 받아보세요.', reversed: '유전적 건강 문제에 관심을 가지세요. 가족력이 있는 질환을 체크하세요.' }, career: { upright: '가업을 잇거나, 큰 조직에서 안정적인 성공을 이뤄요. 장기적 비전이 빛나요.', reversed: '가족 사업이나 상속 문제로 직업 생활에 스트레스가 있어요.' } },
      11: { upright: '새로운 학습이나 재정 계획을 시작할 때입니다.', reversed: '비현실적인 계획에 주의하세요.', love: { upright: '현실적이고 안정적인 만남이 시작됩니다.', reversed: '너무 조건을 따지면 인연을 놓칩니다.' }, money: { upright: '새로운 투자 공부를 시작하세요.', reversed: '재정 지식이 부족합니다. 더 배우세요.' }, health: { upright: '건강에 대해 새로 배우고 시작하는 시기예요. 영양학이나 운동법을 공부해보세요.', reversed: '건강 관련 정보가 너무 많아서 혼란스러워요. 전문가 상담이 필요해요.' }, career: { upright: '새로운 자격증이나 기술을 배우기 시작하세요. 투자한 시간이 곧 돈이 돼요.', reversed: '현실성 없는 사업 계획에 주의하세요. 기본기부터 다지세요.' } },
      12: { upright: '꾸준하고 신뢰할 수 있는 방식으로 목표에 다가갑니다.', reversed: '너무 느리거나 변화를 거부합니다.', love: { upright: '안정적이고 믿음직한 파트너입니다.', reversed: '너무 무미건조한 관계입니다.' }, money: { upright: '안정적인 재정 성장이 이루어집니다.', reversed: '보수적 투자가 오히려 손해일 수 있습니다.' }, health: { upright: '느리지만 꾸준한 건강 관리가 최고예요. 매일 조금씩 걷기만 해도 큰 변화가 와요.', reversed: '너무 안일하게 건강을 방치하고 있어요. 속도를 좀 올려서 관리하세요.' }, career: { upright: '묵묵히 맡은 일을 잘하고 있어요. 신뢰를 쌓으면 큰 기회가 찾아와요.', reversed: '변화에 너무 느리게 대응하고 있어요. 업계 트렌드를 파악하세요.' } },
      13: { upright: '실용적 지혜와 풍요로운 관리 능력을 발휘합니다.', reversed: '물질에 대한 과도한 집착에 주의하세요.', love: { upright: '현실적이고 안정적인 사랑입니다.', reversed: '사랑보다 조건을 우선시합니다.' }, money: { upright: '뛰어난 재테크 능력을 발휘합니다.', reversed: '인색함이 관계를 해칩니다.' }, health: { upright: '실용적인 건강 관리가 빛을 발해요. 좋은 음식과 규칙적 생활이 비결!', reversed: '돈을 아끼려다 건강에 투자를 안 하면 나중에 더 큰 비용이 들어요.' }, career: { upright: '재정 관리와 사업 경영에 뛰어난 감각을 보여요. 관리직에 적합!', reversed: '물질적 성과에만 집착하면 팀워크가 무너져요. 사람도 중요해요.' } },
      14: { upright: '물질적 성공의 완성입니다. 풍요와 안정의 극치입니다.', reversed: '돈에 대한 과도한 집착이 다른 가치를 해칩니다.', love: { upright: '물심양면으로 풍요로운 관계입니다.', reversed: '돈으로 사랑을 살 수는 없습니다.' }, money: { upright: '최상의 재물운입니다. 큰 성공을 거둡니다.', reversed: '부의 관리를 잘못하면 잃을 수 있습니다.' }, health: { upright: '최상의 건강 상태예요. 물질적 여유로 프리미엄 건강 관리가 가능해요.', reversed: '돈은 많지만 건강을 소홀히 하면 의미가 없어요. 몸이 자본이에요.' }, career: { upright: '사업과 재정의 정점에 올랐어요. 리더십과 관리 능력이 최고 수준이에요!', reversed: '권력에 취하면 주변 사람이 떠나요. 겸손한 리더가 오래가요.' } },
    },
  };

  let cardId = 22; // 메이저 아르카나 이후부터

  for (const suit of suits) {
    const config = SUIT_CONFIG[suit];
    const suitData = minorData[suit];

    for (let num = 1; num <= 14; num++) {
      let cardName: string;
      if (num <= 10) cardName = `${config.nameKr} ${num}`;
      else if (num === 11) cardName = `${config.nameKr} 시종`;
      else if (num === 12) cardName = `${config.nameKr} 기사`;
      else if (num === 13) cardName = `${config.nameKr} 여왕`;
      else cardName = `${config.nameKr} 왕`;

      let nameEn: string;
      if (num <= 10) nameEn = `${num} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;
      else if (num === 11) nameEn = `Page of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;
      else if (num === 12) nameEn = `Knight of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;
      else if (num === 13) nameEn = `Queen of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;
      else nameEn = `King of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;

      const data = suitData[num];

      // 오행별 해석 생성 (수트의 원소와 각 오행의 상호작용)
      const ohaengReading = generateOhaengReadingForMinor(config.element, data.upright, data.reversed);

      cards.push({
        id: cardId++,
        name: cardName,
        nameEn,
        arcana: 'minor',
        suit,
        number: num,
        keywords: MINOR_KEYWORDS[num],
        symbolColor: config.color,
        element: config.element,
        upright: data.upright,
        reversed: data.reversed,
        ohaengReading,
        detailed: {
          love: data.love,
          money: data.money,
          health: data.health,
          career: data.career,
        },
      });
    }
  }

  return cards;
}

/**
 * 마이너 아르카나의 오행별 해석 자동 생성
 */
function generateOhaengReadingForMinor(
  cardElement: Ohaeng,
  baseUpright: string,
  baseReversed: string
): Record<Ohaeng, { upright: string; reversed: string }> {
  const interactions: Record<string, Record<Ohaeng, { relation: string; uprightMod: string; reversedMod: string }>> = {
    '목': {
      '목': { relation: '비화', uprightMod: '같은 나무의 에너지가 만나 성장이 배가됩니다.', reversedMod: '과잉 성장 욕구가 부작용을 일으킵니다.' },
      '화': { relation: '상생', uprightMod: '목이 화를 생하여 에너지가 더욱 활발해집니다.', reversedMod: '열정이 과해져 통제가 어려울 수 있습니다.' },
      '토': { relation: '상극', uprightMod: '토의 안정이 목의 성장에 기반을 제공합니다.', reversedMod: '성장과 안정 사이에서 갈등합니다.' },
      '금': { relation: '상극받음', uprightMod: '금의 제재가 오히려 방향을 잡아줍니다.', reversedMod: '외부 제약이 성장을 심하게 방해합니다.' },
      '수': { relation: '상생받음', uprightMod: '수의 지원으로 목이 더욱 건강하게 자랍니다.', reversedMod: '너무 많은 도움이 자생력을 약화시킵니다.' },
    },
    '화': {
      '목': { relation: '상생받음', uprightMod: '목의 지원으로 열정이 더욱 타오릅니다.', reversedMod: '불이 너무 커져 통제 불능입니다.' },
      '화': { relation: '비화', uprightMod: '두 배의 열정으로 강력한 에너지를 발휘합니다.', reversedMod: '과도한 열정이 소진을 부릅니다.' },
      '토': { relation: '상생', uprightMod: '화가 토를 생하여 안정적인 결과를 만듭니다.', reversedMod: '에너지가 분산되어 효과가 약합니다.' },
      '금': { relation: '상극', uprightMod: '화의 힘으로 금의 장벽을 녹여냅니다.', reversedMod: '파괴적 에너지가 소중한 것도 태울 수 있습니다.' },
      '수': { relation: '상극받음', uprightMod: '수의 제어로 화가 적절히 조절됩니다.', reversedMod: '외부 환경이 열정을 꺼뜨립니다.' },
    },
    '토': {
      '목': { relation: '상극받음', uprightMod: '변화의 에너지가 안정을 깨뜨려 새로운 성장을 유도합니다.', reversedMod: '기반이 흔들려 불안합니다.' },
      '화': { relation: '상생받음', uprightMod: '열정이 안정적인 기반을 더욱 단단하게 만듭니다.', reversedMod: '과도한 열기가 기반을 메마르게 합니다.' },
      '토': { relation: '비화', uprightMod: '최고의 안정감과 현실적 성과를 이룹니다.', reversedMod: '지나친 안주가 정체를 부릅니다.' },
      '금': { relation: '상생', uprightMod: '토가 금을 생하여 가치 있는 결과물이 나옵니다.', reversedMod: '결과가 기대에 미치지 못합니다.' },
      '수': { relation: '상극', uprightMod: '현실적 판단으로 감정의 홍수를 막습니다.', reversedMod: '감정을 억누르면 폭발할 수 있습니다.' },
    },
    '금': {
      '목': { relation: '상극', uprightMod: '결단력으로 불필요한 것을 잘라냅니다.', reversedMod: '지나친 판단이 가능성을 잘라버립니다.' },
      '화': { relation: '상극받음', uprightMod: '열정의 불이 금의 고집을 녹여 유연하게 만듭니다.', reversedMod: '외부 압력에 무너질 수 있습니다.' },
      '토': { relation: '상생받음', uprightMod: '안정적 기반이 결단력을 더욱 빛나게 합니다.', reversedMod: '보수적 환경이 결단을 방해합니다.' },
      '금': { relation: '비화', uprightMod: '최고의 판단력과 실행력을 발휘합니다.', reversedMod: '완벽주의가 극대화되어 마비됩니다.' },
      '수': { relation: '상생', uprightMod: '금이 수를 생하여 지혜로운 결정이 흘러나옵니다.', reversedMod: '우유부단함이 결정을 지연시킵니다.' },
    },
    '수': {
      '목': { relation: '상생', uprightMod: '직관이 새로운 가능성을 키워줍니다.', reversedMod: '방향 없는 성장을 부추길 수 있습니다.' },
      '화': { relation: '상극받음', uprightMod: '열정이 직관의 깊이를 보완해줍니다.', reversedMod: '감정이 증발할 수 있습니다.' },
      '토': { relation: '상극받음', uprightMod: '현실감이 감정의 흐름을 바르게 이끕니다.', reversedMod: '현실에 감정이 막혀있습니다.' },
      '금': { relation: '상생받음', uprightMod: '명확한 사고가 직관에 구조를 부여합니다.', reversedMod: '분석이 직감을 가립니다.' },
      '수': { relation: '비화', uprightMod: '깊은 직관과 감성이 극대화됩니다.', reversedMod: '감정의 홍수에 빠질 수 있습니다.' },
    },
  };

  const result = {} as Record<Ohaeng, { upright: string; reversed: string }>;
  const ohaengs: Ohaeng[] = ['목', '화', '토', '금', '수'];

  for (const oh of ohaengs) {
    const interaction = interactions[cardElement][oh];
    result[oh] = {
      upright: `${interaction.uprightMod} ${baseUpright}`,
      reversed: `${interaction.reversedMod} ${baseReversed}`,
    };
  }

  return result;
}

// 전체 타로 카드 배열 (78장)
export const ALL_TAROT_CARDS: TarotCard[] = [
  ...MAJOR_ARCANA,
  ...generateMinorArcana(),
];

// 카드 ID로 찾기
export function getCardById(id: number): TarotCard | undefined {
  return ALL_TAROT_CARDS.find(card => card.id === id);
}

// 랜덤 카드 뽑기
export function drawRandomCards(count: number): Array<{ card: TarotCard; isReversed: boolean }> {
  const shuffled = [...ALL_TAROT_CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(card => ({
    card,
    isReversed: Math.random() > 0.5,
  }));
}
