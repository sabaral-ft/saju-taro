/**
 * 대운 (大運) / 세운 (歲運) 계산 엔진
 * 대운: 10년 단위로 바뀌는 큰 운의 흐름
 * 세운: 매년 바뀌는 그 해의 운
 */

import { CHEONGAN, JIJI, CHEONGAN_OHAENG, JIJI_OHAENG, OHAENG_COLOR, OHAENG_SANGSAENG, OHAENG_SANGGEUK, calculateSipseong, JIJI_JANGGAN, getSaryeong } from './saju-engine';
import type { Ohaeng, SajuResult } from './saju-engine';
import { calculateTwelveStage, TWELVE_STAGE_DATA } from './twelve-stages';
import type { TwelveStage } from './twelve-stages';
import {
  extractSajuContext,
  adjustStageTexts,
  addSipseongCareerNote,
  addSipseongLoveNote,
  adjustLoveTextByRelationship,
  adjustTextByChildren,
  type SajuContext,
} from './saju-context-filter';

// ========== 오행 상생/상극 분석 헬퍼 ==========

/** 오행 한글 풀네임 */
const OHAENG_NAME: Record<Ohaeng, string> = {
  '목': '나무(목)',
  '화': '불(화)',
  '토': '흙(토)',
  '금': '쇠(금)',
  '수': '물(수)',
};

/** 오행 자연 이미지 비유 */
const OHAENG_METAPHOR: Record<Ohaeng, string> = {
  '목': '봄날 새싹이 돋는 것처럼 성장하고 뻗어나가는',
  '화': '활활 타오르는 모닥불처럼 열정적이고 빛나는',
  '토': '넓은 대지처럼 듬직하고 안정감 있는',
  '금': '잘 벼린 칼날처럼 날카롭고 결단력 있는',
  '수': '깊은 바다처럼 지혜롭고 유연한',
};

/** 오행별 건강 취약 부위 */
const OHAENG_HEALTH_WEAK: Record<Ohaeng, string> = {
  '목': '간, 담, 눈, 근육 쪽에 신경 쓰세요. 스트레칭과 녹색 채소 섭취가 도움이 됩니다.',
  '화': '심장, 혈압, 눈 건강에 주의하세요. 과도한 흥분이나 스트레스를 피하고 충분히 쉬어야 합니다.',
  '토': '위장, 소화기, 피부 관리에 집중하세요. 규칙적인 식사 습관이 특히 중요합니다.',
  '금': '폐, 호흡기, 피부, 대장 쪽에 주의하세요. 맑은 공기와 깊은 호흡이 도움됩니다.',
  '수': '신장, 방광, 허리, 귀 건강을 챙기세요. 몸을 따뜻하게 하고 수분 섭취를 적절히 조절하세요.',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ========== 격국(格局) 판단 시스템 ==========
// 월지 사령(본기) 십성 기반 8정격 + 특수격 판단
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type GyeokgukType =
  | '정관격' | '편관격' | '정인격' | '편인격'
  | '식신격' | '상관격' | '정재격' | '편재격'
  | '건록격' | '양인격'
  | '종아격' | '종재격' | '종관격' | '종살격' | '종강격'
  | '화기격' | '곡직격' | '윤하격' | '종혁격' | '가색격'  // 일행득기격
  | '미정';

export interface GyeokgukResult {
  type: GyeokgukType;
  name: string;           // 한글 격국명
  hanja: string;          // 한자
  group: '정격' | '특수격' | '종격' | '일행득기격' | '미정';
  description: string;    // 격국 설명
  // 격국에 따른 좋은/나쁜 세운 십성
  favorableSipseongs: string[];   // 이 격국에 유리한 십성
  unfavorableSipseongs: string[]; // 이 격국에 불리한 십성
  breakCondition: string;         // 격국이 파격되는 조건 설명
}

// 월지의 본기(사령) 천간 → 격국 결정
const WOLJI_BONGI: Record<string, string> = {
  '자': '계', '축': '기', '인': '갑', '묘': '을',
  '진': '무', '사': '병', '오': '정', '미': '기',
  '신': '경', '유': '신', '술': '무', '해': '임',
};

// 건록 지지 (일간의 건록지)
const GEONROK_JIJI: Record<string, string> = {
  '갑': '인', '을': '묘', '병': '사', '정': '오', '무': '사',
  '기': '오', '경': '신', '신': '유', '임': '해', '계': '자',
};

// 양인 지지 (일간의 양인지)
const YANGIN_JIJI: Record<string, string> = {
  '갑': '묘', '병': '오', '무': '오', '경': '유', '임': '자',
};

/**
 * 격국 판단 — 월지 사령 기반 8정격 + 건록격/양인격 + 종격
 */
export function determineGyeokguk(saju: SajuResult): GyeokgukResult {
  const ilgan = saju.ilgan;
  const wolji = saju.month.jiji;
  const ilOhaeng = CHEONGAN_OHAENG[ilgan];

  // 1) 건록격 체크: 월지가 일간의 건록지
  if (GEONROK_JIJI[ilgan] === wolji) {
    return {
      type: '건록격', name: '건록격', hanja: '建祿格', group: '특수격',
      description: '일간이 월지에서 건록을 얻어 자체적으로 매우 강합니다. 별도의 격국 없이 일간의 힘 자체가 격이 됩니다.',
      favorableSipseongs: ['식신', '상관', '편재', '정재'],
      unfavorableSipseongs: ['비견', '겁재', '편인'],
      breakCondition: '건록격은 파격이 없으나, 비겁이 과다하면 재물운이 약해집니다.',
    };
  }

  // 2) 양인격 체크: 월지가 일간의 양인지
  if (YANGIN_JIJI[ilgan] === wolji) {
    return {
      type: '양인격', name: '양인격', hanja: '羊刃格', group: '특수격',
      description: '일간의 기운이 극도로 강한 격입니다. 날카로운 결단력과 추진력이 있으나, 기운이 과잉되면 위험합니다.',
      favorableSipseongs: ['정관', '편관', '식신'],
      unfavorableSipseongs: ['비견', '겁재', '편인', '정인'],
      breakCondition: '관성(정관/편관)이 양인을 제어하면 길, 관성 없이 비겁이 더 오면 흉.',
    };
  }

  // 3) 종격 체크 — 사주 전체가 한쪽으로 쏠린 경우
  const bal = saju.ohaengBalance;
  const ilBal = bal[ilOhaeng] || 0;
  // 인성 오행 = 나를 생해주는 오행 (OHAENG_SANGSAENG에서 value가 ilOhaeng인 key)
  // 예: 토 일간 → 화생토이므로 인성=화
  const inOhaeng = (Object.keys(OHAENG_SANGSAENG).find(k => OHAENG_SANGSAENG[k as Ohaeng] === ilOhaeng) as Ohaeng) || ilOhaeng;
  // 비겁(일간오행) + 인성 = 내 편 세력
  const myForce = ilBal + (bal[inOhaeng] || 0);
  const totalBal = Object.values(bal).reduce((a, b) => a + b, 0);

  // 종강격: 비겁+인성이 85% 이상, 일간 6 이상
  // 80%에서는 경계선 사주(80~85%)가 종강격으로 오판되어 용신/기신이 뒤집히는 문제 발생
  // 추가 조건: 반대 세력(식상/재성/관성) 중 balance 1.0 이상인 오행이 2개 이상이면 종격 불가
  const sikOhaengForCheck = OHAENG_SANGSAENG[ilOhaeng];
  const jaeOhaengForCheck = OHAENG_SANGGEUK[ilOhaeng];
  const gwanOhaengForCheck = Object.keys(OHAENG_SANGGEUK).find(k => OHAENG_SANGGEUK[k as Ohaeng] === ilOhaeng) as Ohaeng | undefined;
  const antiGanCnt = [bal[sikOhaengForCheck] || 0, bal[jaeOhaengForCheck] || 0, bal[gwanOhaengForCheck!] || 0]
    .filter(v => v >= 1.0).length;
  if (myForce >= totalBal * 0.85 && ilBal >= 6 && antiGanCnt <= 1) {
    return {
      type: '종강격', name: '종강격', hanja: '從強格', group: '종격',
      description: '일간의 기운이 압도적으로 강해 거스를 수 없는 격입니다. 비겁·인성의 흐름을 따르는 것이 길합니다.',
      favorableSipseongs: ['비견', '겁재', '편인', '정인'],
      unfavorableSipseongs: ['편관', '정관', '편재', '정재'],
      breakCondition: '관성이나 재성이 세운/대운에서 강하게 오면 종격이 깨져 대흉.',
    };
  }

  // 종아격: 식상이 매우 강하고 일간도 어느정도 힘이 있음
  const sikOhaeng = OHAENG_SANGSAENG[ilOhaeng];
  if ((bal[sikOhaeng] || 0) >= totalBal * 0.4 && ilBal >= 2) {
    return {
      type: '종아격', name: '종아격', hanja: '從兒格', group: '종격',
      description: '식상의 기운이 매우 강해 일간이 식상의 흐름을 따르는 격입니다. 표현·창작·학문에 뛰어납니다.',
      favorableSipseongs: ['식신', '상관', '편재', '정재'],
      unfavorableSipseongs: ['편인', '정인', '편관'],
      breakCondition: '인성(편인)이 식상을 극하면 도식(倒食)으로 파격.',
    };
  }

  // 종재격: 재성이 매우 강하고 일간이 약함
  const jaeOhaeng = OHAENG_SANGGEUK[ilOhaeng];
  if ((bal[jaeOhaeng] || 0) >= totalBal * 0.35 && ilBal <= 2) {
    return {
      type: '종재격', name: '종재격', hanja: '從財格', group: '종격',
      description: '재성의 기운이 압도적이어서 일간이 재성의 흐름을 따르는 격입니다. 재물에 인연이 깊습니다.',
      favorableSipseongs: ['편재', '정재', '식신', '상관'],
      unfavorableSipseongs: ['비견', '겁재', '편인', '정인'],
      breakCondition: '비겁이 대운/세운에서 강하게 오면 종격이 깨져 큰 재물 손실.',
    };
  }

  // 종관격/종살격
  const gwanOhaeng = Object.keys(OHAENG_SANGGEUK).find(k => OHAENG_SANGGEUK[k as Ohaeng] === ilOhaeng) as Ohaeng | undefined;
  if (gwanOhaeng && (bal[gwanOhaeng] || 0) >= totalBal * 0.35 && ilBal <= 2) {
    const isJeong = CHEONGAN_OHAENG[saju.month.cheongan] === gwanOhaeng;
    return {
      type: isJeong ? '종관격' : '종살격',
      name: isJeong ? '종관격' : '종살격',
      hanja: isJeong ? '從官格' : '從殺格',
      group: '종격',
      description: isJeong
        ? '관성의 기운이 압도적이어서 일간이 관성을 따르는 격입니다. 공직·조직에서 큰 성취를 이룹니다.'
        : '살(殺)의 기운이 강해 일간이 이를 따르는 격입니다. 강인한 추진력과 권위를 발휘합니다.',
      favorableSipseongs: isJeong ? ['정관', '정인', '정재'] : ['편관', '편인', '편재'],
      unfavorableSipseongs: ['식신', '상관', '비견', '겁재'],
      breakCondition: '식상이 관성을 극하면 종격이 깨져 직업·지위에 큰 변동.',
    };
  }

  // 4) 8정격: 월지 사령의 십성으로 판단
  const bongiGan = WOLJI_BONGI[wolji];
  if (!bongiGan) {
    return { type: '미정', name: '미정', hanja: '未定', group: '미정',
      description: '격국을 특정하기 어렵습니다.', favorableSipseongs: [], unfavorableSipseongs: [], breakCondition: '' };
  }

  const bongiSipseong = calculateSipseong(ilgan, bongiGan);

  // 비견/겁재는 격을 이루지 못함 → 월지 지장간 중기/여기에서 투출된 것으로 격 판단
  if (bongiSipseong === '비견' || bongiSipseong === '겁재') {
    // 지장간에서 비겁 아닌 것 중 천간에 투출된 것 찾기
    const jangganList = JIJI_JANGGAN[wolji] || [];
    for (const jg of jangganList) {
      const jgSip = calculateSipseong(ilgan, jg);
      if (jgSip !== '비견' && jgSip !== '겁재') {
        // 천간에 투출 확인
        const pillars = [saju.year.cheongan, saju.month.cheongan, saju.hour.cheongan];
        if (pillars.some(p => CHEONGAN_OHAENG[p] === CHEONGAN_OHAENG[jg])) {
          return makeJeonggyeok(jgSip);
        }
      }
    }
    // 투출 없으면 건록격으로 간주
    return {
      type: '건록격', name: '건록격(잡기)', hanja: '建祿格', group: '특수격',
      description: '월지가 비겁이고 뚜렷한 격이 없어 건록격에 준하여 판단합니다.',
      favorableSipseongs: ['식신', '상관', '편재', '정재'],
      unfavorableSipseongs: ['비견', '겁재'],
      breakCondition: '비겁 과다 시 재물운 약화.',
    };
  }

  return makeJeonggyeok(bongiSipseong);
}

function makeJeonggyeok(sipseong: string): GyeokgukResult {
  const GYEOKGUK_DATA: Record<string, Omit<GyeokgukResult, 'type'>> = {
    '정관': {
      name: '정관격', hanja: '正官格', group: '정격' as const,
      description: '조직력과 책임감이 뛰어나며, 공직·대기업·관리직에서 두각을 나타냅니다. 질서와 규율을 중시합니다.',
      favorableSipseongs: ['정인', '정재', '식신'],
      unfavorableSipseongs: ['상관', '편관', '겁재'],
      breakCondition: '상관이 정관을 극하면 "상관견관(傷官見官)"으로 파격 — 직장 갈등·실직 위험.',
    },
    '편관': {
      name: '편관격(칠살격)', hanja: '偏官格(七殺格)', group: '정격' as const,
      description: '강한 추진력과 카리스마를 지녔습니다. 군인·경찰·외과의·CEO 등 결단이 필요한 분야에 적합합니다.',
      favorableSipseongs: ['식신', '정인', '편인'],
      unfavorableSipseongs: ['편재', '겁재'],
      breakCondition: '식신이 편관을 제어하면 "식신제살(食神制殺)"로 최고의 길격. 식신 없이 편관만 강하면 흉.',
    },
    '정인': {
      name: '정인격', hanja: '正印格', group: '정격' as const,
      description: '학문과 교육에 뛰어나며, 명예를 중시합니다. 교수·연구원·공무원·의사 등에 적합합니다.',
      favorableSipseongs: ['정관', '식신', '정재'],
      unfavorableSipseongs: ['편재', '겁재'],
      breakCondition: '재성(편재/정재)이 인성을 극하면 "재파인(財破印)" — 학업 중단·명예 실추.',
    },
    '편인': {
      name: '편인격', hanja: '偏印格', group: '정격' as const,
      description: '비범한 창의력과 영감을 지녔습니다. 예술가·종교인·철학자·IT 분야에 적합합니다.',
      favorableSipseongs: ['편관', '정관', '편재'],
      unfavorableSipseongs: ['식신', '겁재'],
      breakCondition: '식신이 편인과 만나면 "도식(倒食)" — 의식주 불안정, 건강 문제.',
    },
    '식신': {
      name: '식신격', hanja: '食神格', group: '정격' as const,
      description: '타고난 낙천성과 표현력. 요리사·예술가·교사·프리랜서 등 창의적 분야에서 빛납니다.',
      favorableSipseongs: ['편재', '정재', '정인'],
      unfavorableSipseongs: ['편인', '편관'],
      breakCondition: '편인이 식신을 극하면 "도식(倒食)" — 생계 불안·소화기 문제.',
    },
    '상관': {
      name: '상관격', hanja: '傷官格', group: '정격' as const,
      description: '뛰어난 언변과 재능. 변호사·연예인·작가·사업가 등 자신을 표현하는 분야에 강합니다.',
      favorableSipseongs: ['편재', '정재', '정인'],
      unfavorableSipseongs: ['정관', '편관'],
      breakCondition: '상관이 정관을 만나면 "상관견관" — 윗사람과 충돌·직업 불안.',
    },
    '정재': {
      name: '정재격', hanja: '正財格', group: '정격' as const,
      description: '성실하고 계획적인 재물 관리. 회계사·은행원·사업가·관리직에서 안정적 성공을 거둡니다.',
      favorableSipseongs: ['정관', '식신', '상관'],
      unfavorableSipseongs: ['겁재', '비견', '편인'],
      breakCondition: '겁재가 정재를 탈취하면 "겁재탈재(劫財奪財)" — 재물 손실·배신.',
    },
    '편재': {
      name: '편재격', hanja: '偏財格', group: '정격' as const,
      description: '대범한 투자 감각과 사교력. 무역·영업·투자·자영업에서 큰 재물을 움직일 수 있습니다.',
      favorableSipseongs: ['식신', '상관', '정관'],
      unfavorableSipseongs: ['겁재', '비견'],
      breakCondition: '겁재가 편재를 빼앗으면 "겁재탈재" — 투자 실패·사기 피해.',
    },
  };

  const data = GYEOKGUK_DATA[sipseong];
  if (!data) {
    return { type: '미정', name: '미정', hanja: '未定', group: '미정',
      description: '격국을 특정하기 어렵습니다.', favorableSipseongs: [], unfavorableSipseongs: [], breakCondition: '' };
  }
  return { type: sipseong as GyeokgukType, ...data };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ========== 조후용신(調候用神) 시스템 ==========
// 일간 + 월지(계절)에 따라 가장 급한 오행 결정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface JohuResult {
  johuYongsin: Ohaeng | null;     // 조후용신 (null이면 조후 불필요)
  johuGisin: Ohaeng | null;       // 조후기신
  priority: '급' | '보통' | '불필요';  // 조후 긴급도
  reason: string;                 // 조후 판단 이유
}

// 월지 → 계절 매핑
const WOLJI_SEASON: Record<string, '봄' | '여름' | '가을' | '겨울' | '환절기'> = {
  '인': '봄', '묘': '봄', '진': '환절기',
  '사': '여름', '오': '여름', '미': '환절기',
  '신': '가을', '유': '가을', '술': '환절기',
  '해': '겨울', '자': '겨울', '축': '환절기',
};

// 조후용신 테이블: 일간(10) × 월지(12)
// 명리학 조후론 기반 — 일간별 계절에 따라 급한 오행
type JohuEntry = { yongsin: Ohaeng; gisin: Ohaeng; priority: '급' | '보통'; reason: string };
const JOHU_TABLE: Record<string, Record<string, JohuEntry>> = {
  // 갑목 (큰 나무)
  '갑': {
    '자': { yongsin: '화', gisin: '금', priority: '급', reason: '한겨울 갑목은 얼어붙으므로 병화(태양)로 따뜻하게 해야 합니다.' },
    '축': { yongsin: '화', gisin: '금', priority: '급', reason: '겨울 끝 갑목, 아직 추우니 병화가 필수입니다.' },
    '인': { yongsin: '화', gisin: '금', priority: '보통', reason: '초봄 갑목, 아직 찬 기운이 남아 병화가 도움됩니다.' },
    '묘': { yongsin: '금', gisin: '화', priority: '보통', reason: '봄 갑목은 왕성하니 경금(도끼)으로 다듬어야 재목이 됩니다.' },
    '진': { yongsin: '금', gisin: '수', priority: '보통', reason: '늦봄 갑목, 기운이 넘치니 금으로 조절합니다.' },
    '사': { yongsin: '수', gisin: '토', priority: '급', reason: '초여름 갑목은 수분이 말라가니 계수(비)로 적셔야 합니다.' },
    '오': { yongsin: '수', gisin: '토', priority: '급', reason: '한여름 갑목은 타들어가므로 수가 생명수입니다.' },
    '미': { yongsin: '수', gisin: '토', priority: '보통', reason: '늦여름 갑목, 아직 더우니 수로 보충합니다.' },
    '신': { yongsin: '수', gisin: '금', priority: '보통', reason: '초가을 갑목, 금이 강해지니 수로 통관(금생수, 수생목)합니다.' },
    '유': { yongsin: '화', gisin: '금', priority: '보통', reason: '가을 갑목은 금극에 노출되니 화로 금을 녹여야 합니다.' },
    '술': { yongsin: '화', gisin: '수', priority: '보통', reason: '늦가을 갑목, 서늘해지니 화로 온기를 더합니다.' },
    '해': { yongsin: '화', gisin: '금', priority: '급', reason: '초겨울 갑목, 추워지므로 병화(태양)가 반드시 필요합니다.' },
  },
  // 을목 (풀, 덩굴)
  '을': {
    '자': { yongsin: '화', gisin: '금', priority: '급', reason: '겨울 을목은 시들어 있으니 병화(햇살)가 생명입니다.' },
    '축': { yongsin: '화', gisin: '금', priority: '급', reason: '겨울 끝 을목, 아직 얼어있으니 화가 필수입니다.' },
    '인': { yongsin: '수', gisin: '금', priority: '보통', reason: '봄 을목은 성장기이니 수(비)로 키워줍니다.' },
    '묘': { yongsin: '화', gisin: '수', priority: '보통', reason: '봄 을목이 왕성하니 화(태양)로 꽃을 피웁니다.' },
    '진': { yongsin: '수', gisin: '화', priority: '보통', reason: '늦봄 을목, 수분 보충이 필요합니다.' },
    '사': { yongsin: '수', gisin: '토', priority: '급', reason: '여름 을목은 말라가니 수가 필수입니다.' },
    '오': { yongsin: '수', gisin: '토', priority: '급', reason: '한여름 을목은 시들으므로 수(물)가 생명입니다.' },
    '미': { yongsin: '수', gisin: '토', priority: '보통', reason: '늦여름 을목, 수분 보충이 필요합니다.' },
    '신': { yongsin: '화', gisin: '금', priority: '보통', reason: '가을 을목은 금극에 노출되니 화로 보호합니다.' },
    '유': { yongsin: '화', gisin: '금', priority: '급', reason: '가을 을목은 금에 꺾이므로 화(丙)가 급합니다.' },
    '술': { yongsin: '화', gisin: '금', priority: '보통', reason: '늦가을 을목, 서늘하니 화로 온기를 줍니다.' },
    '해': { yongsin: '화', gisin: '금', priority: '급', reason: '겨울 을목은 얼어 죽으니 화가 급합니다.' },
  },
  // 병화 (태양)
  '병': {
    '자': { yongsin: '목', gisin: '수', priority: '급', reason: '겨울 병화는 빛이 약하니 갑목(장작)으로 불을 살려야 합니다.' },
    '축': { yongsin: '목', gisin: '수', priority: '급', reason: '겨울 끝 병화, 갑목이 꼭 필요합니다.' },
    '인': { yongsin: '목', gisin: '수', priority: '보통', reason: '봄 병화, 목(장작)이 있으면 불꽃이 활활 탑니다.' },
    '묘': { yongsin: '토', gisin: '수', priority: '보통', reason: '봄 병화가 왕성하니 토로 기운을 빼줍니다.' },
    '진': { yongsin: '토', gisin: '수', priority: '보통', reason: '늦봄 병화, 토가 기운을 조절합니다.' },
    '사': { yongsin: '수', gisin: '목', priority: '급', reason: '여름 병화는 태양이 너무 뜨거우니 임수(바다)로 식혀야 합니다.' },
    '오': { yongsin: '수', gisin: '목', priority: '급', reason: '한여름 병화는 과열되므로 수(물)가 반드시 필요합니다.' },
    '미': { yongsin: '수', gisin: '목', priority: '보통', reason: '늦여름 병화, 아직 뜨거우니 수로 조절합니다.' },
    '신': { yongsin: '목', gisin: '수', priority: '보통', reason: '가을 병화는 약해지니 목으로 보충합니다.' },
    '유': { yongsin: '목', gisin: '수', priority: '보통', reason: '가을 병화가 기울어 가니 목(장작)이 필요합니다.' },
    '술': { yongsin: '목', gisin: '수', priority: '보통', reason: '늦가을 병화, 갑목으로 불을 유지합니다.' },
    '해': { yongsin: '목', gisin: '수', priority: '급', reason: '겨울 병화는 소멸 위기, 갑목이 생명줄입니다.' },
  },
  // 정화 (촛불, 별빛)
  '정': {
    '자': { yongsin: '목', gisin: '수', priority: '급', reason: '겨울 정화는 꺼질 위기, 갑목(장작)이 급합니다.' },
    '축': { yongsin: '목', gisin: '수', priority: '급', reason: '겨울 끝 정화, 목이 꼭 필요합니다.' },
    '인': { yongsin: '목', gisin: '수', priority: '보통', reason: '봄 정화, 목의 도움으로 안정됩니다.' },
    '묘': { yongsin: '토', gisin: '수', priority: '보통', reason: '봄 정화가 강하니 토로 설기합니다.' },
    '진': { yongsin: '목', gisin: '수', priority: '보통', reason: '늦봄 정화, 목이 도움됩니다.' },
    '사': { yongsin: '수', gisin: '목', priority: '보통', reason: '여름 정화는 뜨거우니 수로 조절합니다.' },
    '오': { yongsin: '수', gisin: '목', priority: '급', reason: '한여름 정화는 과열되므로 수가 필수입니다.' },
    '미': { yongsin: '수', gisin: '목', priority: '보통', reason: '늦여름 정화, 수로 온도를 낮춥니다.' },
    '신': { yongsin: '목', gisin: '금', priority: '보통', reason: '가을 정화가 약해지니 목으로 불을 살립니다.' },
    '유': { yongsin: '목', gisin: '금', priority: '급', reason: '가을 정화는 금에 눌리니 목이 급합니다.' },
    '술': { yongsin: '목', gisin: '토', priority: '보통', reason: '늦가을 정화, 목으로 생명력을 유지합니다.' },
    '해': { yongsin: '목', gisin: '수', priority: '급', reason: '겨울 정화는 꺼지기 직전, 목이 생명줄입니다.' },
  },
  // 무토 (큰 산, 대지)
  '무': {
    '자': { yongsin: '화', gisin: '수', priority: '급', reason: '겨울 무토는 얼어붙은 대지, 병화(태양)로 녹여야 합니다.' },
    '축': { yongsin: '화', gisin: '수', priority: '급', reason: '겨울 끝 무토, 아직 춥고 습하니 화가 필수입니다.' },
    '인': { yongsin: '화', gisin: '수', priority: '보통', reason: '봄 무토, 갑목에 극당하니 화로 통관(목생화, 화생토)합니다.' },
    '묘': { yongsin: '화', gisin: '수', priority: '보통', reason: '봄 무토는 목극에 노출, 화로 중재합니다.' },
    '진': { yongsin: '금', gisin: '목', priority: '보통', reason: '늦봄 무토가 강하니 금(갑경)으로 설기합니다.' },
    '사': { yongsin: '수', gisin: '화', priority: '보통', reason: '여름 무토는 건조하니 수분이 필요합니다.' },
    '오': { yongsin: '수', gisin: '화', priority: '급', reason: '한여름 무토는 타들어가는 대지, 임수(비)가 급합니다.' },
    '미': { yongsin: '수', gisin: '화', priority: '보통', reason: '늦여름 무토, 아직 건조하니 수가 필요합니다.' },
    '신': { yongsin: '화', gisin: '수', priority: '보통', reason: '가을 무토, 금이 설기하니 화로 보충합니다.' },
    '유': { yongsin: '화', gisin: '수', priority: '보통', reason: '가을 무토가 약해지니 화로 힘을 줍니다.' },
    '술': { yongsin: '금', gisin: '화', priority: '보통', reason: '늦가을 무토가 강하니 금으로 기운을 빼줍니다.' },
    '해': { yongsin: '화', gisin: '수', priority: '급', reason: '겨울 무토는 얼고 수극에 노출, 화가 급합니다.' },
  },
  // 기토 (논밭, 비옥한 땅)
  '기': {
    '자': { yongsin: '화', gisin: '수', priority: '급', reason: '겨울 기토는 얼어붙은 논밭, 화로 녹여야 합니다.' },
    '축': { yongsin: '화', gisin: '수', priority: '급', reason: '겨울 끝 기토, 병화(태양)가 필수입니다.' },
    '인': { yongsin: '화', gisin: '수', priority: '보통', reason: '봄 기토, 화로 온기를 줍니다.' },
    '묘': { yongsin: '화', gisin: '수', priority: '보통', reason: '봄 기토는 목에 극당하니 화로 통관합니다.' },
    '진': { yongsin: '금', gisin: '목', priority: '보통', reason: '늦봄 기토, 금으로 설기하면 좋습니다.' },
    '사': { yongsin: '수', gisin: '화', priority: '보통', reason: '여름 기토, 건조하니 수분이 필요합니다.' },
    '오': { yongsin: '수', gisin: '화', priority: '급', reason: '한여름 기토는 갈라진 논, 수(물)가 급합니다.' },
    '미': { yongsin: '수', gisin: '화', priority: '보통', reason: '늦여름 기토, 수로 촉촉하게 합니다.' },
    '신': { yongsin: '화', gisin: '금', priority: '보통', reason: '가을 기토, 화로 기운을 보충합니다.' },
    '유': { yongsin: '화', gisin: '금', priority: '보통', reason: '가을 기토가 약해지니 화가 도움됩니다.' },
    '술': { yongsin: '금', gisin: '화', priority: '보통', reason: '늦가을 기토, 금으로 기운을 빼줍니다.' },
    '해': { yongsin: '화', gisin: '수', priority: '급', reason: '겨울 기토는 얼어붙으니 화가 급합니다.' },
  },
  // 경금 (무쇠, 바위)
  '경': {
    '자': { yongsin: '화', gisin: '수', priority: '보통', reason: '겨울 경금, 정화(용광로)로 제련해야 빛납니다.' },
    '축': { yongsin: '화', gisin: '수', priority: '보통', reason: '겨울 끝 경금, 화로 제련합니다.' },
    '인': { yongsin: '화', gisin: '수', priority: '보통', reason: '봄 경금, 정화로 다듬으면 보석이 됩니다.' },
    '묘': { yongsin: '화', gisin: '수', priority: '보통', reason: '봄 경금, 화로 제련하면 쓸모 있는 도구가 됩니다.' },
    '진': { yongsin: '화', gisin: '수', priority: '보통', reason: '늦봄 경금, 화로 제련합니다.' },
    '사': { yongsin: '수', gisin: '토', priority: '보통', reason: '여름 경금은 뜨거운 쇳물, 수로 담금질합니다.' },
    '오': { yongsin: '수', gisin: '토', priority: '급', reason: '한여름 경금은 녹아내리니 수(물)로 급히 식혀야 합니다.' },
    '미': { yongsin: '수', gisin: '토', priority: '보통', reason: '늦여름 경금, 수로 온도를 낮춥니다.' },
    '신': { yongsin: '화', gisin: '토', priority: '보통', reason: '가을 경금이 왕성하니 화(정화)로 제련합니다.' },
    '유': { yongsin: '화', gisin: '토', priority: '급', reason: '가을 경금은 너무 날카로우니 화로 다듬어야 합니다.' },
    '술': { yongsin: '수', gisin: '토', priority: '보통', reason: '늦가을 경금, 수로 기운을 설기합니다.' },
    '해': { yongsin: '화', gisin: '수', priority: '보통', reason: '겨울 경금, 화로 녹이고 제련합니다.' },
  },
  // 신금 (보석, 세공품)
  '신': {
    '자': { yongsin: '화', gisin: '수', priority: '보통', reason: '겨울 신금, 화로 연마하면 보석이 빛납니다.' },
    '축': { yongsin: '화', gisin: '수', priority: '보통', reason: '겨울 끝 신금, 화(태양)로 빛을 냅니다.' },
    '인': { yongsin: '수', gisin: '목', priority: '보통', reason: '봄 신금, 수로 씻어 광택을 냅니다.' },
    '묘': { yongsin: '수', gisin: '목', priority: '보통', reason: '봄 신금은 목에 소모되니 수로 보호합니다.' },
    '진': { yongsin: '수', gisin: '토', priority: '보통', reason: '늦봄 신금, 수로 세척합니다.' },
    '사': { yongsin: '수', gisin: '화', priority: '급', reason: '여름 신금은 녹아버리니 임수(물)가 급합니다.' },
    '오': { yongsin: '수', gisin: '화', priority: '급', reason: '한여름 신금은 녹을 위기, 수가 생명입니다.' },
    '미': { yongsin: '수', gisin: '화', priority: '보통', reason: '늦여름 신금, 수로 보호합니다.' },
    '신': { yongsin: '화', gisin: '토', priority: '보통', reason: '가을 신금이 강하니 화(병화)로 연마합니다.' },
    '유': { yongsin: '화', gisin: '토', priority: '보통', reason: '가을 신금, 화로 빛을 냅니다.' },
    '술': { yongsin: '수', gisin: '토', priority: '보통', reason: '늦가을 신금, 수로 기운을 내보냅니다.' },
    '해': { yongsin: '화', gisin: '수', priority: '보통', reason: '겨울 신금, 화로 온기와 광택을 줍니다.' },
  },
  // 임수 (큰 강, 바다)
  '임': {
    '자': { yongsin: '토', gisin: '금', priority: '급', reason: '겨울 임수는 범람 위기, 무토(제방)로 막아야 합니다.' },
    '축': { yongsin: '화', gisin: '금', priority: '보통', reason: '겨울 끝 임수, 병화(태양)로 따뜻하게 합니다.' },
    '인': { yongsin: '화', gisin: '금', priority: '보통', reason: '봄 임수, 화로 온기를 줍니다.' },
    '묘': { yongsin: '토', gisin: '금', priority: '보통', reason: '봄 임수, 토로 조절합니다.' },
    '진': { yongsin: '금', gisin: '토', priority: '보통', reason: '늦봄 임수, 금으로 수원을 보충합니다.' },
    '사': { yongsin: '금', gisin: '토', priority: '보통', reason: '여름 임수는 마르기 시작, 금(수원)으로 보충합니다.' },
    '오': { yongsin: '금', gisin: '토', priority: '급', reason: '한여름 임수는 말라가니 금(경금 수원)이 급합니다.' },
    '미': { yongsin: '금', gisin: '토', priority: '보통', reason: '늦여름 임수, 금으로 수원을 유지합니다.' },
    '신': { yongsin: '토', gisin: '금', priority: '보통', reason: '가을 임수, 금이 강하니 토로 조절합니다.' },
    '유': { yongsin: '토', gisin: '금', priority: '보통', reason: '가을 임수에 금이 넘치니 토로 제어합니다.' },
    '술': { yongsin: '금', gisin: '토', priority: '보통', reason: '늦가을 임수, 금으로 수원을 보충합니다.' },
    '해': { yongsin: '토', gisin: '금', priority: '급', reason: '겨울 임수는 범람 위기, 토(제방)가 급합니다.' },
  },
  // 계수 (이슬, 봄비)
  '계': {
    '자': { yongsin: '화', gisin: '금', priority: '급', reason: '겨울 계수는 얼어붙으니 병화(태양)가 급합니다.' },
    '축': { yongsin: '화', gisin: '금', priority: '급', reason: '겨울 끝 계수, 화가 필수입니다.' },
    '인': { yongsin: '금', gisin: '토', priority: '보통', reason: '봄 계수, 금(수원)으로 물줄기를 유지합니다.' },
    '묘': { yongsin: '금', gisin: '토', priority: '보통', reason: '봄 계수는 목에 빨리므로 금으로 보충합니다.' },
    '진': { yongsin: '화', gisin: '금', priority: '보통', reason: '늦봄 계수, 화로 따뜻하게 합니다.' },
    '사': { yongsin: '금', gisin: '토', priority: '급', reason: '여름 계수는 증발 위기, 금(수원)이 급합니다.' },
    '오': { yongsin: '금', gisin: '토', priority: '급', reason: '한여름 계수는 말라버리니 금(경금)이 생명줄입니다.' },
    '미': { yongsin: '금', gisin: '토', priority: '보통', reason: '늦여름 계수, 금으로 보충합니다.' },
    '신': { yongsin: '화', gisin: '토', priority: '보통', reason: '가을 계수, 화(병화)로 빛을 줍니다.' },
    '유': { yongsin: '화', gisin: '토', priority: '보통', reason: '가을 계수, 금이 넘치니 화로 균형을 잡습니다.' },
    '술': { yongsin: '금', gisin: '토', priority: '보통', reason: '늦가을 계수, 금으로 수원을 확보합니다.' },
    '해': { yongsin: '화', gisin: '금', priority: '급', reason: '겨울 계수는 얼어붙으니 병화(태양)가 급합니다.' },
  },
};

/**
 * 조후용신 판단
 */
export function determineJohu(saju: SajuResult): JohuResult {
  const ilgan = saju.ilgan;
  const wolji = saju.month.jiji;
  const entry = JOHU_TABLE[ilgan]?.[wolji];
  if (!entry) {
    return { johuYongsin: null, johuGisin: null, priority: '불필요', reason: '조후 판단 데이터가 없습니다.' };
  }
  return {
    johuYongsin: entry.yongsin,
    johuGisin: entry.gisin,
    priority: entry.priority,
    reason: entry.reason,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ========== 대운-세운 교차 분석 시스템 ==========
// 세운 2글자 × 대운 2글자 × 원국 8글자 관계망
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DaeunSeunCross {
  // 대운-세운 교차
  daeunSeunRelation: string;    // 대운과 세운의 관계 요약
  daeunBase: '길운' | '흉운' | '평운';  // 대운 기조
  crossScore: number;           // 교차 분석 점수 보정값 (-2 ~ +2)
  crossNotes: string[];         // 교차 분석 특기사항

  // 글자별 관계망
  characterMap: CharacterRelation[];  // 세운 2글자의 전체 관계망
}

export interface CharacterRelation {
  seunChar: string;           // 세운 글자 (천간 or 지지)
  seunPosition: '천간' | '지지';
  targets: {
    position: string;         // 대상 위치 (년간, 월간, 일간, 시간, 년지, 월지, 일지, 시지, 대운간, 대운지)
    targetChar: string;       // 대상 글자
    relation: string;         // 관계 (생, 극, 합, 충 등)
    effect: '길' | '흉' | '중립';
    note: string;             // 구체적 해석
  }[];
}

/**
 * 대운-세운 교차 분석
 */
export function analyzeDaeunSeunCross(
  saju: SajuResult,
  daeun: DaeunPillar | null,
  seunGan: string,
  seunJi: string,
  seunGanOh: Ohaeng,
  seunJiOh: Ohaeng,
): DaeunSeunCross {
  const crossNotes: string[] = [];
  let crossScore = 0;

  if (!daeun) {
    return {
      daeunSeunRelation: '대운 정보 없음',
      daeunBase: '평운',
      crossScore: 0,
      crossNotes: [],
      characterMap: [],
    };
  }

  const dGan = daeun.cheongan;
  const dJi = daeun.jiji;
  const dGanOh = daeun.cheonganOhaeng;
  const dJiOh = daeun.jijiOhaeng;

  // ── 1) 대운 기조 판단 ──
  const dGanSip = calculateSipseong(saju.ilgan, dGan);
  const dJiSip = calculateSipseong(saju.ilgan, WOLJI_BONGI[dJi] || dGan);
  let daeunBase: '길운' | '흉운' | '평운' = '평운';

  // 대운 천간/지지의 용신기신 체크
  const dYongCount = (dGanOh === saju.yongsin ? 1 : 0) + (dJiOh === saju.yongsin ? 1 : 0);
  const dGiCount = (dGanOh === saju.gisin ? 1 : 0) + (dJiOh === saju.gisin ? 1 : 0);
  if (dYongCount >= 2) daeunBase = '길운';
  else if (dYongCount === 1 && dGiCount === 0) daeunBase = '길운';
  else if (dGiCount >= 2) daeunBase = '흉운';
  else if (dGiCount === 1 && dYongCount === 0) daeunBase = '흉운';

  // ── 2) 대운-세운 간 상호작용 ──
  // 대운 천간 + 세운 천간 합 체크
  const CHEONGAN_HAP_PAIR: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을',
    '병': '신', '신': '병', '정': '임', '임': '정', '무': '계', '계': '무',
  };
  if (CHEONGAN_HAP_PAIR[dGan] === seunGan) {
    crossNotes.push(`🤝 대운 천간(${dGan})과 세운 천간(${seunGan})이 천간합! 대운과 세운이 협력하는 해입니다.`);
    crossScore += 0.5;
  }

  // 대운 천간 + 세운 천간 충(극) 체크
  if (OHAENG_SANGGEUK[dGanOh] === seunGanOh) {
    crossNotes.push(`⚡ 세운 천간(${seunGan})이 대운 천간(${dGan})을 극합니다. 대운의 기운이 방해받는 해입니다.`);
    if (daeunBase === '길운') {
      crossScore -= 0.5;
      crossNotes.push(`   → 좋은 대운인데 세운이 방해하므로 "큰 틀은 좋지만 올해 잠깐 고비"입니다.`);
    } else if (daeunBase === '흉운') {
      crossScore += 0.3;
      crossNotes.push(`   → 나쁜 대운의 기운이 세운에 의해 깨지므로 오히려 숨통이 트입니다.`);
    }
  }
  if (OHAENG_SANGGEUK[seunGanOh] === dGanOh) {
    crossNotes.push(`⚡ 대운 천간(${dGan})이 세운 천간(${seunGan})을 극합니다.`);
    if (daeunBase === '흉운') {
      crossScore -= 0.3;
    }
  }

  // 대운 지지 + 세운 지지 충 체크
  const JIJI_CHUNG: Record<string, string> = {
    '자': '오', '축': '미', '인': '신', '묘': '유', '진': '술', '사': '해',
    '오': '자', '미': '축', '신': '인', '유': '묘', '술': '진', '해': '사',
  };
  if (JIJI_CHUNG[dJi] === seunJi) {
    crossNotes.push(`💥 대운 지지(${dJi})와 세운 지지(${seunJi})가 충(沖)! 이 해에 큰 변동이 일어납니다.`);
    crossScore -= 0.5;
    if (daeunBase === '길운') {
      crossNotes.push(`   → 좋은 대운의 기반이 흔들리는 해. 갑작스러운 이직·이사·관계 변화에 주의.`);
    } else {
      crossNotes.push(`   → 나쁜 대운 속에서 충이 겹쳐 변화가 격렬합니다. 하지만 "기존의 나쁜 것을 깨뜨리는" 전화위복도 가능.`);
      crossScore += 0.3;
    }
  }

  // 대운 지지 + 세운 지지 합 체크 (육합)
  const JIJI_YUKHAP: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };
  if (JIJI_YUKHAP[dJi] === seunJi) {
    crossNotes.push(`🤝 대운 지지(${dJi})와 세운 지지(${seunJi})가 육합! 대운과 세운이 화합하는 해입니다.`);
    crossScore += 0.5;
  }

  // ── 3) 대운 기조에 따른 세운 영향 조정 ──
  if (daeunBase === '길운') {
    if (seunGanOh === saju.gisin || seunJiOh === saju.gisin) {
      crossNotes.push(`📌 대운은 길운이지만 세운에 기신(${saju.gisin})이 있습니다. 큰 틀은 좋으나 올해 일시적 어려움이 있습니다. 대운이 받쳐주므로 큰 탈은 없습니다.`);
      crossScore += 0.3; // 대운 길운이 기신 세운을 완화
    }
    if (seunGanOh === saju.yongsin || seunJiOh === saju.yongsin) {
      crossNotes.push(`⭐ 대운도 길운, 세운도 용신(${saju.yongsin})! 올해는 "겹경사"입니다. 인생의 전환점이 될 만큼 좋은 해입니다.`);
      crossScore += 0.5;
    }
  } else if (daeunBase === '흉운') {
    if (seunGanOh === saju.yongsin || seunJiOh === saju.yongsin) {
      crossNotes.push(`📌 대운은 흉운이지만 세운에 용신(${saju.yongsin})이 있습니다. 근본적으로 어려운 시기에 잠깐 숨통이 트이는 해입니다.`);
      crossScore += 0.3;
    }
    if (seunGanOh === saju.gisin || seunJiOh === saju.gisin) {
      crossNotes.push(`⚠️ 대운도 흉운, 세운도 기신(${saju.gisin})! 올해는 "설상가상"입니다. 큰 변동을 피하고 보수적으로 행동하세요.`);
      crossScore -= 0.5;
    }
  }

  // ── 4) 글자별 관계망 생성 ──
  const characterMap: CharacterRelation[] = [];

  // 원국 8글자 + 대운 2글자 = 10개 대상
  const allTargets: { position: string; char: string; ohaeng: Ohaeng }[] = [
    { position: '년간', char: saju.year.cheongan, ohaeng: saju.year.cheonganOhaeng },
    { position: '월간', char: saju.month.cheongan, ohaeng: saju.month.cheonganOhaeng },
    { position: '일간', char: saju.ilgan, ohaeng: CHEONGAN_OHAENG[saju.ilgan] },
    { position: '시간', char: saju.hour.cheongan, ohaeng: saju.hour.cheonganOhaeng },
    { position: '년지', char: saju.year.jiji, ohaeng: saju.year.jijiOhaeng },
    { position: '월지', char: saju.month.jiji, ohaeng: saju.month.jijiOhaeng },
    { position: '일지', char: saju.day.jiji, ohaeng: saju.day.jijiOhaeng },
    { position: '시지', char: saju.hour.jiji, ohaeng: saju.hour.jijiOhaeng },
    { position: '대운간', char: dGan, ohaeng: dGanOh },
    { position: '대운지', char: dJi, ohaeng: dJiOh },
  ];

  // 세운 천간의 관계망
  const ganRelations: CharacterRelation['targets'] = [];
  for (const t of allTargets) {
    if (t.position.includes('지')) continue; // 천간은 천간끼리만
    const rel = getOhaengRelation(seunGanOh, t.ohaeng);
    const isHap = CHEONGAN_HAP_PAIR[seunGan] === t.char;
    let effect: '길' | '흉' | '중립' = '중립';
    let note = '';

    if (isHap) {
      effect = '길';
      note = `세운 ${seunGan}과 ${t.position}(${t.char})이 천간합 — ${t.position} 관련 영역에서 좋은 인연·협력이 생깁니다.`;
    } else if (rel === '극아') {
      effect = '흉';
      note = `${t.position}(${t.char})이 세운 ${seunGan}을 극합니다 — ${t.position} 관련 영역에서 압박을 받습니다.`;
    } else if (rel === '아극') {
      note = `세운 ${seunGan}이 ${t.position}(${t.char})을 극합니다 — ${t.position} 관련 영역을 제어·지배합니다.`;
      effect = seunGanOh === saju.yongsin ? '길' : '중립';
    } else if (rel === '생아') {
      effect = '길';
      note = `${t.position}(${t.char})이 세운 ${seunGan}을 생해줍니다 — 도움과 지원의 기운.`;
    } else if (rel === '아생') {
      note = `세운 ${seunGan}이 ${t.position}(${t.char})을 생합니다 — 에너지를 내보내는 설기(洩氣).`;
    } else if (rel === '비화') {
      note = `세운 ${seunGan}과 ${t.position}(${t.char})이 같은 오행 — 힘을 합칩니다.`;
    }

    if (note) ganRelations.push({ position: t.position, targetChar: t.char, relation: isHap ? '합' : rel, effect, note });
  }
  characterMap.push({ seunChar: seunGan, seunPosition: '천간', targets: ganRelations });

  // 세운 지지의 관계망
  const jiRelations: CharacterRelation['targets'] = [];
  for (const t of allTargets) {
    if (!t.position.includes('지') && t.position !== '대운지') continue;
    const isChung = JIJI_CHUNG[seunJi] === t.char;
    const isHap = JIJI_YUKHAP[seunJi] === t.char;
    const rel = getOhaengRelation(seunJiOh, t.ohaeng);
    let effect: '길' | '흉' | '중립' = '중립';
    let note = '';

    if (isChung) {
      effect = '흉';
      note = `세운 ${seunJi}와 ${t.position}(${t.char})이 충(沖) — ${t.position} 관련 영역에서 큰 변동·충돌이 발생합니다.`;
    } else if (isHap) {
      effect = '길';
      note = `세운 ${seunJi}와 ${t.position}(${t.char})이 육합 — ${t.position} 관련 영역에서 조화·협력의 기운.`;
    } else if (rel === '극아') {
      effect = '흉';
      note = `${t.position}(${t.char})이 세운 ${seunJi}를 극합니다.`;
    } else if (rel === '생아') {
      effect = '길';
      note = `${t.position}(${t.char})이 세운 ${seunJi}를 생해줍니다.`;
    } else if (rel === '아극') {
      note = `세운 ${seunJi}가 ${t.position}(${t.char})을 극합니다.`;
    } else if (rel === '아생') {
      note = `세운 ${seunJi}가 ${t.position}(${t.char})을 생합니다.`;
    }

    if (note) jiRelations.push({ position: t.position, targetChar: t.char, relation: isChung ? '충' : isHap ? '합' : rel, effect, note });
  }
  characterMap.push({ seunChar: seunJi, seunPosition: '지지', targets: jiRelations });

  // 대운-세운 관계 요약 텍스트
  const daeunSeunRelation = `현재 대운: ${dGan}${dJi}(${dGanSip}) — ${daeunBase === '길운' ? '좋은 대운의 흐름 위에' : daeunBase === '흉운' ? '어려운 대운의 흐름 속에서' : '평탄한 대운의 흐름 속에서'} ${seunGan}${seunJi}년의 기운이 작용합니다.`;

  return {
    daeunSeunRelation,
    daeunBase,
    crossScore: Math.round(Math.max(-2, Math.min(2, crossScore)) * 2) / 2,
    crossNotes,
    characterMap,
  };
}

/** 오행 관계 판단 헬퍼 */
function getOhaengRelation(from: Ohaeng, to: Ohaeng): '비화' | '아생' | '아극' | '생아' | '극아' {
  if (from === to) return '비화';
  if (OHAENG_SANGSAENG[from] === to) return '아생';  // 내가 생해주는 것
  if (OHAENG_SANGGEUK[from] === to) return '아극';    // 내가 극하는 것
  if (OHAENG_SANGSAENG[to] === from) return '극아';   // 나를 극하는 것 (to가 나를 생→X, to가 from을 생하면 from이 생받음)
  return '생아'; // 나를 생해주는 것
}

// ========== 신강/신약(身强/身弱) 판정 ==========

export type SingangType = '신강' | '신약' | '극신강' | '극신약';

export interface SingangAnalysis {
  type: SingangType;
  score: number;            // 0~10 (높을수록 신강)
  bigyeopCount: number;     // 비겁 개수
  inseongCount: number;     // 인성 개수
  hasWoljiRoot: boolean;    // 월지에 뿌리
  hasIljiRoot: boolean;     // 일지에 뿌리
  personality: string;      // 성격 분석
  healthAdvice: string;     // 건강/운동 조언
  careerAdvice: string;     // 직업 조언
  moneyAdvice: string;      // 재물 조언
  exerciseAdvice: string;   // 운동 추천
}

/**
 * 신강/신약 판정 — 득령·득지·득세 + 지지 뿌리 기반
 * 핵심: 천간보다 월지·일지에 일간의 뿌리가 있는지가 결정적
 */
export function analyzeSingang(saju: SajuResult): SingangAnalysis {
  const ilOh = CHEONGAN_OHAENG[saju.ilgan];
  // 인성 오행 = 나를 생해주는 오행
  const inOh = Object.entries(OHAENG_SANGSAENG).find(([, v]) => v === ilOh)![0] as Ohaeng;
  const bal = saju.ohaengBalance;

  // 비겁(나와 같은 오행) + 인성(나를 생하는 오행) 세력
  const myForce = (bal[ilOh] || 0) + (bal[inOh] || 0);
  // 식상+재성+관성 세력
  const shikOh = OHAENG_SANGSAENG[ilOh];
  const jaeOh = OHAENG_SANGGEUK[ilOh];
  const gwanOh = Object.entries(OHAENG_SANGGEUK).find(([, v]) => v === ilOh)?.[0] as Ohaeng;
  const otherForce = (bal[shikOh] || 0) + (bal[jaeOh] || 0) + (bal[gwanOh] || 0);

  // 득령 (월지에 비겁/인성 뿌리)
  const woljiOh = saju.month.jijiOhaeng;
  const hasWoljiRoot = woljiOh === ilOh || woljiOh === inOh;

  // 득지 (일지에 비겁/인성 뿌리)
  const iljiOh = saju.day.jijiOhaeng;
  const hasIljiRoot = iljiOh === ilOh || iljiOh === inOh;

  // 득세 (연주·시주에 비겁/인성)
  const yearHelp = saju.year.cheonganOhaeng === ilOh || saju.year.cheonganOhaeng === inOh ||
                   saju.year.jijiOhaeng === ilOh || saju.year.jijiOhaeng === inOh;
  const hourHelp = saju.hour.cheonganOhaeng === ilOh || saju.hour.cheonganOhaeng === inOh ||
                   saju.hour.jijiOhaeng === ilOh || saju.hour.jijiOhaeng === inOh;

  // 비겁/인성 개수
  const sipseongs = saju.sipseongs;
  const bigyeopCount = [sipseongs.year, sipseongs.month, sipseongs.hour]
    .filter(s => s === '비견' || s === '겁재').length;
  const inseongCount = [sipseongs.year, sipseongs.month, sipseongs.hour]
    .filter(s => s === '정인' || s === '편인').length;

  // 종합 점수 (0~10)
  let score = 5; // 기본
  if (hasWoljiRoot) score += 2;  // 월지 뿌리 = 가장 중요
  if (hasIljiRoot) score += 1.5; // 일지 뿌리 = 매우 중요
  if (yearHelp) score += 0.5;
  if (hourHelp) score += 0.5;
  if (myForce > otherForce) score += 1;
  if (myForce < otherForce) score -= 1;
  if (bigyeopCount >= 2) score += 0.5;
  // 천간에만 있고 지지에 뿌리 없으면 → 극신약 보정
  if (!hasWoljiRoot && !hasIljiRoot && bigyeopCount + inseongCount >= 2) score -= 2;

  score = Math.max(0, Math.min(10, score));

  // 유형 판정: strengthScore(3요소 100점)가 있으면 우선 사용
  let type: SingangType;
  const ss = saju.strengthScore;
  if (ss != null) {
    // 3요소 100점 만점 기준
    if (ss >= 65) type = '극신강';
    else if (ss >= 40) type = '신강';
    else if (ss >= 25) type = '신약';
    else type = '극신약';
    // score도 strengthScore 기반으로 보정 (0~10 스케일)
    score = Math.max(0, Math.min(10, Math.round(ss / 10)));
  } else {
    if (score >= 8) type = '극신강';
    else if (score >= 6) type = '신강';
    else if (score >= 4) type = '신약';
    else type = '극신약';
  }

  // 십신 과다 체크
  const sipExcess = saju.sipseongBalance?.excess || [];
  const isBigyeopExcess = sipExcess.some((s: string) => s.includes('비겁'));
  const isJaeExcess = sipExcess.some((s: string) => s.includes('재성'));
  const isInExcess = sipExcess.some((s: string) => s.includes('인성'));

  // 재다신약 체크
  const isJaeDaSinYak = isJaeExcess && score < 5;

  // ===== 성격 분석 =====
  let personality = '';
  if (type === '극신강' || type === '신강') {
    personality = `신강(身强)한 사주입니다. 자아와 주체성이 강하고 추진력·돌파력이 뛰어납니다.`;
    if (isBigyeopExcess) {
      personality += ` 비겁(比劫) 기운이 과다하여 "절대 지지 않겠다"는 강한 투쟁심과 승부욕을 타고났습니다.`;
      personality += ` ⚠️ 에너지를 밖으로 발산하지 않으면 극단적 고집, 오만, 급발진, 맹목적 집착으로 변질될 수 있습니다. 한번 멘탈이 무너지면 와르르 무너질 위험이 있으니, 적극적인 에너지 발산이 필수입니다.`;
    }
    if (isInExcess) {
      personality += ` 인성(印星)까지 과다한 인다신강(印多身强) 구조로, 생각이 지나치게 많아 결정 장애에 빠지거나 속으로 자신을 끝없이 괴롭히는 경향이 있습니다. 💡 왕자희설(旺者喜泄) 극복법: 과도한 생각을 멈추고 식상(표현·행동)으로 에너지를 배출하세요 — 산책, 수다, 글쓰기, 창작 활동이 돌파구입니다.`;
    }
  } else {
    personality = `신약(身弱)한 사주입니다. 외부 환경의 기운이 자아보다 강해, 타인의 눈치를 보거나 억눌리기 쉬운 환경에 놓이는 경우가 많습니다.`;
    personality += ` 하고 싶은 말을 밖으로 표출하지 못하고 마음에 쌓아두어, 우울감·공허함에 시달리기 쉽습니다.`;
    if (isJaeDaSinYak) {
      personality += ` ⚠️ 재다신약(財多身弱): 재물 기회는 많지만 감당할 힘이 부족한 "부옥빈인(부잣집의 가난한 사람)" 구조입니다. 큰돈을 좇다 극심한 피로와 스트레스를 겪을 수 있습니다.`;
    }
  }

  // ===== 오행 심리 불균형 분석 =====
  const OHAENG_PSYCH: Record<Ohaeng, { excess: string; lack: string }> = {
    '목': { excess: '독단적 고집이 강하고 분노 조절에 어려움이 있을 수 있습니다.', lack: '의지가 박약하고 새로운 일을 시작하기 어려워합니다.' },
    '화': { excess: '감정 기복이 심하고 허영심·조급증이 나타나기 쉽습니다.', lack: '삶의 열정이 떨어지고 자기표현이 위축됩니다.' },
    '토': { excess: '변화에 둔감하고 과거에 대한 미련·고립감을 느낄 수 있습니다.', lack: '갈등 중재 능력이 부족하고 신용·안정성에 불안합니다.' },
    '금': { excess: '냉혹해지고 타인에 대한 공격적 비판이나 살기(殺氣)를 띠기 쉽습니다.', lack: '결단력이 부족하고 의리를 상실하기 쉽습니다.' },
    '수': { excess: '깊은 우울감, 음침함, 불확실성에 시달릴 수 있습니다.', lack: '유연한 대처 지혜가 부족하고 활력이 저하됩니다.' },
  };
  const domOh = saju.dominantOhaeng as Ohaeng | undefined;
  const weakOhP = saju.weakestOhaeng as Ohaeng | undefined;
  if (domOh && bal[domOh] >= 4) personality += `\n🧠 ${domOh} 과다 심리: ${OHAENG_PSYCH[domOh].excess}`;
  if (weakOhP && bal[weakOhP] <= 1) personality += `\n🧠 ${weakOhP} 부족 심리: ${OHAENG_PSYCH[weakOhP].lack}`;

  // ===== 천간합 사회성 =====
  const CHEONGAN_HAP: Record<string, string> = { '갑': '기', '기': '갑', '을': '경', '경': '을', '병': '신', '신': '병', '정': '임', '임': '정', '무': '계', '계': '무' };
  const allGans = [saju.year.cheongan, saju.month.cheongan, saju.hour.cheongan];
  const hapCount = allGans.filter(g => CHEONGAN_HAP[saju.ilgan] === g).length;
  if (hapCount > 0) {
    const isYangGan = ['갑', '병', '무', '경', '임'].includes(saju.ilgan);
    personality += `\n🤝 천간합 ${hapCount}개: 타인과의 융화력이 뛰어나고 낯선 환경에도 빠르게 적응합니다. `;
    personality += isYangGan
      ? '양간이므로 사회생활에서 주도적으로 이끌고 업무를 계획적·꼼꼼하게 처리하는 성향입니다.'
      : '음간이므로 안정적인 직장·조직 생활을 지향하며 소속감과 편안함을 중시합니다.';
  }

  // ===== 정관/편관(칠살) 심리 =====
  const gwanSips = allGans.map((_, i) => [saju.sipseongs?.year, saju.sipseongs?.month, saju.sipseongs?.hour][i]).filter(Boolean);
  const hasJeonggwan = gwanSips.includes('정관');
  const hasPyeongwan = gwanSips.includes('편관');
  if (hasJeonggwan) {
    personality += `\n⚖️ 정관 심리: 타인에게 인정받고 "괜찮은 사람"이 되고 싶어합니다. 원리원칙을 지키며 공명정대하지만, 눈치를 많이 보고 모험을 피해 현상 유지에 머무르려는 경향이 있습니다.`;
  }
  if (hasPyeongwan) {
    personality += `\n⚔️ 편관(칠살) 심리: 강한 억압 속에서 비상한 인내력·통찰력·직관이 발달했습니다. 청렴결백하고 냉철한 카리스마가 있지만, 극심한 스트레스와 자기 번민에 빠지기 쉽고 관계를 단절하는 경향이 있습니다.`;
  }

  // ===== 건강/운동 조언 =====
  let healthAdvice = '';
  let exerciseAdvice = '';
  if (type === '극신강' || type === '신강') {
    healthAdvice = '넘치는 에너지를 밖으로 발산(식상 작용)하지 않으면 내면에서 곪아 정신적·육체적 문제로 이어집니다.';
    exerciseAdvice = '🏋️ 신강 체질 운동: 축구, 격투기, 헬스(중량운동) 등 땀을 흠뻑 흘리는 격렬한 운동이 필수입니다. 뭉친 에너지를 폭발적으로 발산하세요. 실내에서는 홈트레이닝, 수다(언어 발산), 글쓰기·창작 활동으로 에너지를 빼세요.';
  } else {
    healthAdvice = '에너지가 부족하므로 무리한 활동을 피하고, 몸과 마음의 안정을 최우선으로 챙기세요.';
    exerciseAdvice = '🧘 신약 체질 운동: 명상, 요가, 필라테스처럼 차분히 심신의 균형을 다지는 부드러운 운동이 적합합니다. ⚠️ 격투기, 헬스(중량운동)는 기가 눌리고 체력을 갉아먹어 건강에 해롭습니다.';
    if (saju.weakestOhaeng === '수') {
      exerciseAdvice += ' 수 기운 부족으로 관절이 약하니 무리한 PT·중량운동은 특히 금지입니다.';
    }
  }

  // ===== 직업 조언 =====
  let careerAdvice = '';
  if (type === '극신강' || type === '신강') {
    if (isBigyeopExcess) {
      careerAdvice = `💼 비겁 과다 신강: 넘치는 에너지를 적극 발산할 수 있는 직업이 적합합니다. 독립 사업, 영업, 부동산, 프리랜서 등 자율성이 높고 자기 재량으로 움직이는 직업군이 좋습니다. 특히 용신(${saju.yongsin}) 관련 분야에서 에너지를 쓰면 성과와 건강 모두 좋아집니다.`;
    } else {
      careerAdvice = '💼 신강한 사주: 자신감과 추진력을 살린 리더십 역할이 적합합니다. 사업, 경영, 관리직에서 빛을 발합니다.';
    }
  } else {
    careerAdvice = '💼 신약한 사주: 안정적이고 체계적인 환경이 적합합니다. 대기업, 공무원, 전문직 등 울타리가 있는 조직이 좋습니다.';
    if (isJaeDaSinYak) {
      careerAdvice += ' 재다신약이므로 혼자 큰 사업을 벌이기보다 동업자와 이익을 나누며 협력하세요. 인성(공부·자격증)을 보강하여 내공을 키우는 것이 우선입니다.';
    }
  }

  // ===== 재물 조언 =====
  let moneyAdvice = '';
  if (type === '극신강' || type === '신강') {
    moneyAdvice = '신왕재왕(身旺財旺)의 구조가 되면 적극적으로 재물을 통제하여 큰 부를 이룰 수 있습니다. 용신 운(유리한 운)에는 자신감을 가지고 스케일을 크게 가져가세요.';
    if (isBigyeopExcess) {
      moneyAdvice += ' 단, 과시욕이 강해 "오늘은 내가 쏠게" 하다 실속을 놓칠 수 있으니 주의하세요.';
    }
  } else {
    if (isJaeDaSinYak) {
      moneyAdvice = '⚠️ 재다신약: 큰돈이 오가는 환경이지만 실속이 적고, 재물 관리에 극심한 피로를 겪습니다. 재성운(재물운)이 또 들어오면 큰 병·사고 위험이 있으니 방어적으로 생활하세요. 아버지(재성)의 그늘에서 독립하는 것이 개운의 핵심입니다.';
    } else {
      moneyAdvice = '기구신 운(불리한 운)에는 삶의 규모를 축소하고 보수적으로 방어하세요. 확실하지 않으면 투자하지 않는 것이 원칙입니다.';
    }
  }

  return {
    type, score, bigyeopCount, inseongCount,
    hasWoljiRoot, hasIljiRoot,
    personality, healthAdvice, careerAdvice, moneyAdvice, exerciseAdvice,
  };
}

// ========== 조후(調候) — 한난조습 분석 ==========

export type Johu = '한습' | '난조' | '균형';

/**
 * 사주의 한난조습(寒暖燥濕) 판정
 * - 한습: 수(Water)+목(Wood) 과다 → 차갑고 축축
 * - 난조: 화(Fire)+금(Metal) 과다 → 뜨겁고 건조
 * - 균형: 양쪽 차이가 적음
 */
export function analyzeJohu(ohaengBalance: Record<Ohaeng, number>, weakOh?: Ohaeng, isWeak?: boolean): {
  type: Johu;
  description: string;
  healthWarning: string;
  tasteAdvice: string;
  exerciseAdvice: string;
} {
  const cold = (ohaengBalance['수'] || 0) + (ohaengBalance['목'] || 0); // 한습 (수+목)
  const hot = (ohaengBalance['화'] || 0) + (ohaengBalance['금'] || 0);  // 난조 (화+금)
  // 토는 중성

  const diff = hot - cold;

  // 신약 판정 (일간 오행의 밸런스가 낮으면 신약)
  const ilOhBal = weakOh ? ohaengBalance[weakOh] : 3;
  const totalBal = Object.values(ohaengBalance).reduce((a, b) => a + b, 0);
  const isBodyWeak = isWeak || ilOhBal <= 1.5;

  if (diff <= -3) {
    // 한습 (차갑고 습함)
    let exercise = '🏃 조후 운동법: 가벼운 유산소 운동(걷기, 조깅, 실내 자전거)으로 심장 박동을 올리고 혈액 순환을 도우세요. 땀을 흘린 뒤 체온이 떨어지지 않도록 보온에 신경 쓰고, 발 찜질·족욕·따뜻한 차로 열기를 보충하세요.';
    if (weakOh === '수') exercise += ' ⚠️ 수 기운이 부족하여 관절이 약하니 무리한 근력 운동(PT, 중량 운동)은 피하고 물 흐르듯 부드러운 운동을 하세요.';
    if (isBodyWeak) exercise += ' 신약한 체질이므로 격렬한 운동보다 명상·요가·필라테스처럼 차분히 몸의 균형을 다지는 운동이 적합합니다.';
    return {
      type: '한습',
      description: '사주가 한습(寒濕)합니다. 수(水)·목(木) 기운이 과다하여 차갑고 축축한 기후 조건입니다.',
      healthWarning: '❄️ 한습 체질 주의: 우울증에 취약하고, 만사가 정체되어 무기력해지기 쉽습니다. 냉증·수족냉증이 동반되며, 감정의 잦은 동요와 불안감을 겪을 수 있습니다. 몸과 마음에 따뜻한 기운을 불어넣는 것이 핵심입니다.',
      tasteAdvice: '🍽️ 조후 식이요법: ☕ 쓴맛(화 기운: 쑥, 더덕, 도라지, 씀바귀, 고들빼기, 여주, 다크초콜릿, 커피, 녹차)과 🌶️ 매운맛(금 기운: 생강, 마늘, 고추, 양파)을 의식적으로 챙기세요. 🍅 붉은색 식재료(토마토, 팥, 대추, 구기자, 석류, 비트, 소고기)도 화 기운 보충에 좋습니다. 반대로 🧂 짠맛(수 기운)과 🍋 신맛(목 기운)은 이미 넘치니 줄이세요. 따뜻하게 조리해 드시고, 찬 음식·음료를 피하세요.',
      exerciseAdvice: exercise,
    };
  }

  if (diff >= 3) {
    // 난조 (뜨겁고 건조)
    let exercise = '🏊 조후 운동법: 수영이 강력 추천됩니다. 뜨거운 기운을 식히고 수(水) 기운을 적극 보충합니다. 스트레칭·요가로 굳어지기 쉬운 근육을 풀어 목(木) 기운도 보완하세요.';
    const bigyeop = (ohaengBalance[Object.keys(ohaengBalance).reduce((a, b) => ohaengBalance[a as Ohaeng] > ohaengBalance[b as Ohaeng] ? a : b) as Ohaeng] || 0);
    if (bigyeop >= 4.5) exercise += ' 에너지가 넘치는 신강 체질이므로 뭉친 기운을 발산하기 위해 적극적으로 땀 흘리는 운동(달리기, 등산, 격투기)도 정신 건강에 도움됩니다.';
    if (weakOh === '수') exercise += ' ⚠️ 단, 수 기운 부족으로 관절이 약하니 착지 충격이 큰 운동(점프, 고강도 달리기)은 피하세요.';
    return {
      type: '난조',
      description: '사주가 난조(暖燥)합니다. 화(火)·금(金) 기운이 과다하여 뜨겁고 건조한 기후 조건입니다.',
      healthWarning: '🔥 난조 체질 주의: 성격이 급하고 폭발적이 되기 쉬우며, 주변과 잦은 충돌을 빚어 스트레스가 가중됩니다. 심장 과열, 염증, 피부·호흡기 건조증에 노출되기 쉽습니다. 열을 식히고 촉촉하게 해주는 수·목 기운 보충이 핵심입니다.',
      tasteAdvice: '🍽️ 조후 식이요법: 🧂 짠맛(수 기운: 미역, 다시마, 김, 해조류, 된장, 간장, 검은콩, 흑미, 흑임자)과 🍋 신맛(목 기운: 식초, 레몬, 매실, 유자, 오미자, 감귤류)을 적극 보충하세요. 반대로 ☕ 쓴맛(화 기운)과 🌶️ 매운맛(금 기운)은 열을 더 올리니 줄이세요. 수분을 충분히 섭취하고, 수영·족욕 등 수 기운 활동을 하세요.',
      exerciseAdvice: exercise,
    };
  }

  return {
    type: '균형',
    description: '사주의 한난조습(寒暖燥濕)이 비교적 균형 잡혀 있습니다.',
    healthWarning: '',
    tasteAdvice: '',
    exerciseAdvice: '',
  };
}

/**
 * 두 오행 간의 상생/상극/비화 관계를 분석하여
 * 일상 언어로 된 해석 텍스트를 반환한다.
 */
/**
 * 오행 상호작용 분석 — 상생/상극의 양면성 반영
 *
 * 핵심 원리:
 * - 상생이 무조건 좋고 상극이 무조건 나쁜 것이 아님
 * - 과한 상생 → 에너지 유출, 의존성, 기운을 빼앗김
 * - 적절한 상극 → 성장의 자극, 규율, 유용한 형태로 거듭남
 * - 오행의 밸런스(치우침 정도)에 따라 같은 관계도 다르게 해석
 *
 * @param targetBal - 대상(나)의 오행 강도. 높으면 강한 사주, 낮으면 약한 사주
 */
function analyzeOhaengInteraction(
  sourceOhaeng: Ohaeng, targetOhaeng: Ohaeng,
  sourceLabel: string = '대운', targetLabel: string = '나',
  targetBal?: number // 대상의 해당 오행 밸런스 수치 (optional)
): {
  relation: '비화' | '생아' | '아생' | '극아' | '아극';
  summary: string;
  detail: string;
} {
  const sN = OHAENG_NAME[sourceOhaeng];
  const tN = OHAENG_NAME[targetOhaeng];
  const isStrong = targetBal !== undefined && targetBal >= 4; // 나의 기운이 강한 경우
  const isWeak = targetBal !== undefined && targetBal <= 1.5; // 나의 기운이 약한 경우

  // 같은 오행 (비화) — 양면: 힘 배가 vs 한쪽 치우침
  if (sourceOhaeng === targetOhaeng) {
    const detail = isStrong
      ? `${sN}의 기운이 이미 강한데 또 겹치면서 한쪽으로 치우칠 수 있습니다. 자신감과 추진력이 넘치지만, 고집이나 독선으로 흐르기 쉽습니다. 다른 기운(특히 상극 기운)을 의식적으로 받아들여 균형을 잡으세요. 주변의 다른 의견이 오히려 약이 됩니다.`
      : isWeak
      ? `${sN}의 기운이 부족했는데 같은 기운이 들어와 보충해줍니다. 든든한 동료를 만난 것처럼 자신감이 회복되는 시기입니다. 이때 기반을 다지면 다음 시기에 큰 힘이 됩니다.`
      : `${sN}의 기운이 겹치면서 자신감과 추진력이 강해집니다. 동업이나 팀 프로젝트에서 시너지가 나기 쉽고, 자기 주장을 확실히 펼칠 수 있는 시기입니다. 다만 지나치면 고집이 세질 수 있으니 주변의 조언에도 귀를 기울이세요.`;
    return {
      relation: '비화',
      summary: isStrong
        ? `${sourceLabel}과 ${targetLabel}이 같은 기운이라 강하지만, 치우침 주의가 필요합니다.`
        : `${sourceLabel}과 ${targetLabel}이 같은 기운이라 힘이 보강됩니다.`,
      detail,
    };
  }

  // 생아 (대운→나 상생) — 양면: 도움/귀인 vs 과보호/에너지 유출
  if (OHAENG_SANGSAENG[sourceOhaeng] === targetOhaeng) {
    const detail = isStrong
      ? `${sN}이 ${tN}을 더 키워주는데, 이미 강한 기운에 연료를 더 붓는 격입니다. 도움은 들어오지만 과한 지원에 의존하거나, 넘치는 에너지를 주체하지 못할 수 있습니다. 받는 것보다 나누는 쪽으로 에너지를 써야 균형이 잡힙니다.`
      : isWeak
      ? `${sN}이 ${tN}을 키워주는 관계로, 부족했던 기운이 채워지는 소중한 시기입니다. 든든한 후원자가 뒤에서 밀어주는 것과 같습니다. 귀인의 도움, 학업·자격증 취득에 유리하니 이 기회를 적극 활용하세요.`
      : `${sN}이 ${tN}을 키워주는 관계로, 윗사람의 도움이나 귀인의 등장이 기대됩니다. 누군가의 호의를 잘 받아들이되, 지나치게 의존하지 말고 스스로 성장하는 힘도 함께 키우세요.`;
    return {
      relation: '생아',
      summary: isStrong
        ? `${sourceLabel}이 ${targetLabel}을 밀어주지만, 이미 강한 기운에 과잉 주의.`
        : `${sourceLabel}이 ${targetLabel}을 도와주는 흐름입니다.`,
      detail,
    };
  }

  // 아생 (나→대운 상생) — 내 에너지가 밖으로 나감 → 결실/표현 vs 소모/지침
  if (OHAENG_SANGSAENG[targetOhaeng] === sourceOhaeng) {
    const detail = isStrong
      ? `${tN}이 ${sN}을 만들어내는 관계로, 강한 기운이 밖으로 표현되어 큰 결실을 맺을 수 있습니다. 창작·사업·표현 활동의 결과물이 나오는 시기입니다.`
      : isWeak
      ? `${tN}이 ${sN}을 만들어내야 하는데, 기운이 약한 상태에서 에너지가 빠져나가면 탈진 위험이 있습니다. 이 시기에는 큰 프로젝트보다 에너지 보존을 우선하고, 남에게 베풀기보다 자신을 먼저 챙기세요.`
      : `${tN}이 ${sN}을 만들어내는 관계로, 내 재능과 노력이 결과물로 나타납니다. 창작·사업·표현 활동에 좋지만, 일방적으로 에너지를 쏟다 보면 소모가 크므로 체력 관리에 신경 쓰세요.`;
    return {
      relation: '아생',
      summary: isWeak
        ? `${targetLabel}의 에너지가 밖으로 빠져나가니 소모에 주의하세요.`
        : `${targetLabel}의 에너지가 표현되어 결실을 맺는 시기입니다.`,
      detail,
    };
  }

  // 극아 (대운→나 상극) — 양면: 압박/스트레스 vs 성장의 자극/규율
  if (OHAENG_SANGGEUK[sourceOhaeng] === targetOhaeng) {
    const detail = isStrong
      ? `${sN}이 ${tN}을 누르지만, 기운이 강한 당신은 이 압박을 성장의 자극으로 삼을 수 있습니다. 마치 대장장이의 망치질이 쇠를 명검으로 만들듯, 적절한 극은 당신을 더 날카롭고 유능하게 만듭니다. 시련을 피하지 말고 정면으로 부딪히세요.`
      : isWeak
      ? `${sN}이 ${tN}을 누르는데, 기운이 약한 상태에서 이 압박은 상당한 부담이 됩니다. 직장 스트레스, 건강 악화, 대인 갈등이 동시에 올 수 있습니다. 이 시기에는 무리한 도전보다 방어와 회복에 집중하세요. 극이 지나가면 반드시 회복의 시기가 옵니다.`
      : `${sN}이 ${tN}을 누르는 관계로, 외부에서 오는 압박이나 경쟁이 있을 수 있습니다. 하지만 상극은 단순한 파괴가 아니라 한쪽으로 치우치지 않도록 견제하고 다듬어주는 역할도 합니다. 이 시련이 당신을 더 단단하게 만들 수 있으니, 너무 두려워하지 말고 배움의 기회로 삼으세요.`;
    return {
      relation: '극아',
      summary: isStrong
        ? `${sourceLabel}의 압박이 있지만, 강한 기운으로 성장의 발판으로 삼을 수 있습니다.`
        : isWeak
        ? `${sourceLabel}이 ${targetLabel}을 누르는 시기이니 방어와 회복에 집중하세요.`
        : `${sourceLabel}의 견제가 있지만, 이를 통해 더 단단해질 수 있습니다.`,
      detail,
    };
  }

  // 아극 (나→대운 상극) — 내가 제어/통제 → 재물운 vs 소모/번아웃
  if (OHAENG_SANGGEUK[targetOhaeng] === sourceOhaeng) {
    const detail = isStrong
      ? `${tN}이 ${sN}을 다스리는 관계로, 강한 기운 덕에 상황을 주도하고 통제하는 능력이 최고조입니다. 사업 운영, 재테크, 관리 업무에서 좋은 성과를 기대할 수 있습니다.`
      : isWeak
      ? `${tN}이 ${sN}을 다스려야 하는데, 기운이 약한 상태에서 상대를 제어하려면 과도한 에너지가 필요합니다. 재물은 움직이지만 몸과 마음이 따라가지 못해 번아웃이 올 수 있습니다. 욕심을 줄이고 할 수 있는 범위 내에서만 움직이세요.`
      : `${tN}이 ${sN}을 다스리는 관계로, 상황을 주도하고 통제하는 능력이 강해집니다. 재물운이 활발하지만, 너무 강하게 밀어붙이면 에너지 소모가 크고 반발이 올 수 있습니다. 부드럽게 이끄는 리더십이 필요합니다.`;
    return {
      relation: '아극',
      summary: isWeak
        ? `${targetLabel}이 상황을 제어하려 하지만, 에너지 부족으로 무리하지 마세요.`
        : `${targetLabel}이 ${sourceLabel}을 제어하는 흐름이라 주도권을 쥘 수 있습니다.`,
      detail,
    };
  }

  // 기본 fallback
  return {
    relation: '비화',
    summary: `${sourceLabel}과 ${targetLabel}의 기운이 조화롭게 흐릅니다.`,
    detail: '안정적인 흐름 속에서 꾸준히 나아갈 수 있는 시기입니다.',
  };
}

/** 12운성을 일상 비유로 풀어주는 매핑 */
const TWELVE_STAGE_PLAIN: Record<TwelveStage, string> = {
  '장생': '새로운 시작을 알리는 봄의 첫 새싹 같은 시기입니다 (장생).',
  '목욕': '갓 태어난 아기를 씻기듯, 정화와 변화의 성장통을 겪는 시기입니다 (목욕).',
  '관대': '성인이 되어 사회에 첫발을 딛는 것처럼, 자신감이 올라가고 인정받기 시작하는 시기입니다 (관대).',
  '건록': '월급을 받으며 독립하는 것처럼, 실력으로 당당히 성과를 내는 시기입니다 (건록).',
  '제왕': '인생의 전성기와 같은 시기입니다 (제왕). 모든 것이 절정에 달하지만, 정상 이후에는 내려오는 길이 있다는 점도 기억하세요.',
  '쇠': '한여름이 지나고 가을이 오는 것처럼, 전성기를 지나 차분히 성숙해지는 시기입니다 (쇠).',
  '병': '몸이 아플 때 비로소 건강의 소중함을 아는 것처럼, 약간의 시련을 통해 내면이 단단해지는 시기입니다 (병).',
  '사': '한 챕터가 끝나고 새 챕터가 시작되기 직전, 낡은 것을 정리하는 시기입니다 (사).',
  '묘': '씨앗이 땅속에서 에너지를 모으듯, 겉으로는 조용하지만 내면에서 힘을 축적하는 시기입니다 (묘).',
  '절': '가장 캄캄한 새벽 바로 직전과 같은 시기입니다 (절). 완전한 전환이 이루어지는 극적인 때입니다.',
  '태': '새 생명이 뱃속에 잉태되는 것처럼, 아직 보이지 않지만 무한한 가능성이 자라고 있는 시기입니다 (태).',
  '양': '태아가 영양을 받으며 세상 밖으로 나올 준비를 하듯, 조용히 실력을 가꾸는 시기입니다 (양).',
};

/** 12운성별 구체적 행동 조언 */
const TWELVE_STAGE_ACTION_ADVICE: Record<TwelveStage, string> = {
  '장생': '새로운 것을 시작하세요. 공부, 자격증, 사업, 이사, 연애 등 무엇이든 첫걸음을 떼기에 좋습니다. 주변에 도움을 요청하면 기꺼이 돕는 사람이 나타납니다.',
  '목욕': '감정 기복이 클 수 있으니, 명상이나 일기 쓰기로 마음을 안정시키세요. 큰 결정은 한 박자 쉬었다 내리는 것이 현명합니다. 대신 예술이나 창작 활동에 도전하면 뜻밖의 재능을 발견할 수 있습니다.',
  '관대': '자신을 적극적으로 드러내세요. 면접, 발표, SNS 활동 등 사람들 앞에 서는 일에 유리합니다. 외모를 가꾸고 이미지를 업그레이드하기에도 좋은 시기입니다.',
  '건록': '실력으로 승부하세요. 남에게 기대지 말고 독립적으로 밀어붙이면 반드시 결과가 따라옵니다. 전문성을 키우거나 사이드 프로젝트를 시작하기에 좋습니다.',
  '제왕': '기회를 놓치지 말되, 겸손함을 잃지 마세요. 사업 확장, 리더 역할, 큰 프로젝트 수주에 과감히 도전하세요. 단, 주변 사람들에게 감사를 표하고 독불장군이 되지 않도록 주의하세요.',
  '쇠': '공격보다 수비가 중요한 시기입니다. 기존에 쌓아둔 것을 잘 관리하고, 과한 욕심을 내려놓으세요. 후배를 양성하거나 경험을 나누는 일이 보람을 줍니다.',
  '병': '무리하지 마세요. 건강 검진을 받고, 휴식과 재충전에 시간을 할애하세요. 남을 돌보는 일(봉사, 상담)이 오히려 나를 치유하는 시간이 됩니다.',
  '사': '미련 없이 정리할 건 정리하세요. 안 쓰는 물건, 에너지를 뺏는 관계, 오래된 습관 등을 과감히 내려놓으면 새 기회가 열립니다. 이 시기의 정리는 미래의 축복이 됩니다.',
  '묘': '겉으로 드러나는 활동보다 저축, 공부, 자기 계발처럼 조용히 쌓아가는 일에 집중하세요. 부동산이나 장기 투자를 검토하기에 좋습니다. 성급하게 결과를 기대하지 마세요.',
  '절': '삶의 큰 전환점이 올 수 있습니다. 두려워하지 말고 변화를 받아들이세요. 기존 틀을 깨는 새로운 도전이 오히려 돌파구가 됩니다. 직감을 믿으세요.',
  '태': '아이디어를 구체적 계획으로 만드는 데 시간을 쏟으세요. 아직 실행할 때는 아니지만, 탄탄한 준비가 나중에 큰 차이를 만듭니다. 독서와 학습이 큰 도움이 됩니다.',
  '양': '자기 관리가 핵심입니다. 잘 먹고, 잘 자고, 꾸준히 운동하세요. 곧 올 기회를 맞이할 체력과 마음의 준비를 해두는 것이 최선입니다. 급할수록 돌아가세요.',
};

// ========== 대운 계산 ==========

// ========== 대운 방(方) — 계절/방위별 성격 변화 ==========
export type DaeunBang = '동방' | '남방' | '서방' | '북방';

const JIJI_BANG: Record<string, DaeunBang> = {
  '인': '동방', '묘': '동방', '진': '동방',  // 寅卯辰 = 봄/동방
  '사': '남방', '오': '남방', '미': '남방',  // 巳午未 = 여름/남방
  '신': '서방', '유': '서방', '술': '서방',  // 申酉戌 = 가을/서방
  '해': '북방', '자': '북방', '축': '북방',  // 亥子丑 = 겨울/북방
};

const BANG_SEASON: Record<DaeunBang, string> = {
  '동방': '봄', '남방': '여름', '서방': '가을', '북방': '겨울',
};

const BANG_OHAENG: Record<DaeunBang, Ohaeng> = {
  '동방': '목', '남방': '화', '서방': '금', '북방': '수',
};

const BANG_PERSONALITY: Record<DaeunBang, string> = {
  '동방': '새로운 시작과 성장을 추구하며, 진취적이고 도전적인 성향이 강해집니다. 계획을 세우고 새 일을 벌이는 기운이 왕성해지며, 인간관계가 넓어지고 활동 반경이 확대됩니다.',
  '남방': '열정과 표현력이 극대화되어 화려하고 적극적인 성향으로 변합니다. 사교성이 좋아지고 명예와 인정을 중시하게 되며, 밖으로 드러나는 활동이 많아집니다. 다만 조급함과 과욕에 주의해야 합니다.',
  '서방': '현실적이고 결단력 있는 성향으로 전환됩니다. 내면을 돌아보고 정리하는 시기로, 재물 관리에 능해지고 실리를 추구합니다. 불필요한 것을 과감히 정리하며 핵심에 집중하게 됩니다.',
  '북방': '깊은 사색과 내면의 성장이 이루어지는 시기입니다. 겉으로 드러나는 활동보다 내면의 지혜가 깊어지며, 인내심과 참을성이 강해집니다. 준비와 축적의 시기로, 실속을 챙기는 성향이 됩니다.',
};

/** 대운 방(方) 정보 도출 */
export function getDaeunBang(jiji: string): { bang: DaeunBang; season: string; ohaeng: Ohaeng; personality: string } {
  const bang = JIJI_BANG[jiji] || '동방';
  return {
    bang,
    season: BANG_SEASON[bang],
    ohaeng: BANG_OHAENG[bang],
    personality: BANG_PERSONALITY[bang],
  };
}

// ═══════════════════════════════════════════════════════════════
// ★★★ 입체적 운세 분석 헬퍼 함수 ★★★
// 단순 "용신 오면 좋다" → 다층 구조 분석
// ═══════════════════════════════════════════════════════════════

/**
 * 희기신(喜忌神) 5단계 판별
 * 용신(用神): 가장 필요한 오행 (+2.0)
 * 희신(喜神): 용신을 돕는 오행 (+1.0)
 * 한신(閑神): 영향이 적은 중립 오행 (0)
 * 기신(忌神): 해로운 오행 (-1.5)
 * 구신(仇神): 기신을 돕는 오행, 용신을 극하는 오행 (-2.0)
 */
export function classifyHeegishin(
  ohaeng: Ohaeng,
  yongsin: Ohaeng,
  gisin: Ohaeng,
  ilganOhaeng: Ohaeng,
): { role: '용신' | '희신' | '한신' | '기신' | '구신'; weight: number } {
  if (ohaeng === yongsin) return { role: '용신', weight: 2.0 };
  if (ohaeng === gisin) return { role: '기신', weight: -1.5 };
  // 희신: 용신을 생해주는 오행
  if (OHAENG_SANGSAENG[ohaeng] === yongsin) return { role: '희신', weight: 1.0 };
  // 구신: 기신을 생해주는 오행 OR 용신을 극하는 오행
  if (OHAENG_SANGSAENG[ohaeng] === gisin) return { role: '구신', weight: -1.0 };
  if (OHAENG_SANGGEUK[ohaeng] === yongsin) return { role: '구신', weight: -0.8 };
  // 한신: 나머지
  return { role: '한신', weight: 0 };
}

/**
 * 오행 밸런스 변화 시뮬레이션
 * 운(대운/세운)이 들어왔을 때 밸런스가 어떻게 변하는지 계산
 * - 부족한 오행이 채워지면 가산 (최대 +1.5)
 * - 이미 넘치는 오행이 더 들어오면 감점 (최대 -1.0)
 * - 균형에 가까워지면 가산, 멀어지면 감점
 */
export function simulateBalanceChange(
  balance: Record<Ohaeng, number>,
  ganOh: Ohaeng,
  jiOh: Ohaeng,
): { balanceMod: number; detail: string } {
  const total = Object.values(balance).reduce((a, b) => a + b, 0);
  if (total === 0) return { balanceMod: 0, detail: '' };

  // 각 오행의 비율 (0~1)
  const ratios: Record<Ohaeng, number> = {} as Record<Ohaeng, number>;
  const idealRatio = 0.2; // 이상적 균등 비율 (5행이므로 20%)
  for (const oh of ['목', '화', '토', '금', '수'] as Ohaeng[]) {
    ratios[oh] = (balance[oh] || 0) / total;
  }

  // 현재 편차 (균형에서 얼마나 멀리 있는가)
  let currentDeviation = 0;
  for (const oh of ['목', '화', '토', '금', '수'] as Ohaeng[]) {
    currentDeviation += Math.abs(ratios[oh] - idealRatio);
  }

  // 운이 들어온 후의 밸런스 시뮬레이션
  const newBal = { ...balance };
  newBal[ganOh] = (newBal[ganOh] || 0) + 1.2; // 천간 가중치
  newBal[jiOh] = (newBal[jiOh] || 0) + 1.5;   // 지지 가중치
  const newTotal = Object.values(newBal).reduce((a, b) => a + b, 0);

  let newDeviation = 0;
  for (const oh of ['목', '화', '토', '금', '수'] as Ohaeng[]) {
    newDeviation += Math.abs(((newBal[oh] || 0) / newTotal) - idealRatio);
  }

  // 편차 변화량 (줄어들면 좋음, 늘어나면 나쁨)
  const deviationDelta = currentDeviation - newDeviation; // 양수 = 균형 개선

  let balanceMod = 0;
  let detail = '';

  if (deviationDelta > 0.08) {
    balanceMod = 1.2;
    detail = '오행 균형이 크게 개선';
  } else if (deviationDelta > 0.03) {
    balanceMod = 0.6;
    detail = '오행 균형 소폭 개선';
  } else if (deviationDelta < -0.08) {
    balanceMod = -1.0;
    detail = '오행 편중 심화';
  } else if (deviationDelta < -0.03) {
    balanceMod = -0.4;
    detail = '오행 균형 소폭 악화';
  }

  // 보너스: 완전히 없던 오행(0점)이 채워질 때
  const ohaengs = ['목', '화', '토', '금', '수'] as Ohaeng[];
  for (const oh of ohaengs) {
    if ((balance[oh] || 0) < 0.3 && (oh === ganOh || oh === jiOh)) {
      balanceMod += 0.8; // 결핍 오행 보충 보너스
      detail += (detail ? ' + ' : '') + `결핍 ${oh} 보충`;
    }
  }

  // 감점: 이미 가장 많은 오행(30%+)이 더 들어올 때
  const maxOh = ohaengs.reduce((a, b) => (ratios[a] > ratios[b] ? a : b));
  if (ratios[maxOh] > 0.30 && (maxOh === ganOh || maxOh === jiOh)) {
    balanceMod -= 0.5;
    detail += (detail ? ' + ' : '') + `과잉 ${maxOh} 추가적재`;
  }

  return { balanceMod: Math.round(balanceMod * 10) / 10, detail };
}

/**
 * 천간-지지 간 생극 관계 분석
 * 운(運)의 천간과 지지가 서로 돕는지 싸우는지
 * + 운의 천간/지지가 원국의 일간과 어떤 관계인지
 */
export function analyzeGanJiRelation(
  ganOh: Ohaeng,
  jiOh: Ohaeng,
  ilganOhaeng: Ohaeng,
): { ganJiMod: number; detail: string } {
  let mod = 0;
  let detail = '';

  // (1) 운 내부: 천간↔지지 관계
  if (ganOh === jiOh) {
    mod += 0.3; // 동오행: 기운 집중, 약간 양면적
    detail = '천간·지지 동오행(집중)';
  } else if (OHAENG_SANGSAENG[jiOh] === ganOh) {
    mod += 0.5; // 지지가 천간을 생 → 천간의 힘이 강화 (좋음)
    detail = '지지→천간 상생(안정)';
  } else if (OHAENG_SANGSAENG[ganOh] === jiOh) {
    mod += 0.2; // 천간이 지지를 생 → 에너지 설기
    detail = '천간→지지 상생(순환)';
  } else if (OHAENG_SANGGEUK[ganOh] === jiOh) {
    mod -= 0.3; // 천간이 지지를 극 → 내부 갈등
    detail = '천간→지지 상극(내부갈등)';
  } else if (OHAENG_SANGGEUK[jiOh] === ganOh) {
    mod -= 0.5; // 지지가 천간을 극 → 겉은 좋아보여도 속이 막힘
    detail = '지지→천간 상극(겉과속 불일치)';
  }

  // (2) 운의 천간 → 일간 관계
  if (OHAENG_SANGSAENG[ganOh] === ilganOhaeng) {
    mod += 0.3; // 운 천간이 일간을 생 → 인성 작용
  } else if (OHAENG_SANGGEUK[ganOh] === ilganOhaeng) {
    mod -= 0.2; // 운 천간이 일간을 극 → 관성 압박
  }

  return { ganJiMod: Math.round(mod * 10) / 10, detail };
}

/**
 * 원국 글자와의 구체적 작용 분석
 * 운의 천간/지지가 원국의 각 기둥과 어떤 관계를 형성하는지
 * - 합(合): 새로운 관계/기회
 * - 충(沖): 변동/파괴
 * - 생(生): 도움/지원
 * - 극(剋): 압박/제약
 */
function analyzeWonGukInteraction(
  saju: SajuResult,
  ganOh: Ohaeng,
  jiOh: Ohaeng,
): { interactionMod: number; details: string[] } {
  let mod = 0;
  const details: string[] = [];
  const wonGanOhs = [
    saju.year.cheonganOhaeng,
    saju.month.cheonganOhaeng,
    CHEONGAN_OHAENG[saju.ilgan], // 일간
    saju.hour.cheonganOhaeng,
  ];
  const wonJiOhs = [
    saju.year.jijiOhaeng,
    saju.month.jijiOhaeng,
    saju.day.jijiOhaeng,
    saju.hour.jijiOhaeng,
  ];
  const pillarNames = ['년주', '월주', '일주', '시주'];

  // 천간 vs 원국 천간
  for (let i = 0; i < wonGanOhs.length; i++) {
    if (i === 2) continue; // 일간은 별도 처리
    const wOh = wonGanOhs[i];
    if (ganOh === wOh) {
      // 동오행: 힘 보충
      if (wOh === saju.yongsin) {
        mod += 0.2;
      }
    } else if (OHAENG_SANGSAENG[ganOh] === wOh) {
      // 운 천간이 원국 천간을 생 → 해당 기둥 활성화
      if (wOh === saju.yongsin) mod += 0.3;
      else if (wOh === saju.gisin) mod -= 0.2; // 기신을 생해주면 나쁨
    } else if (OHAENG_SANGGEUK[ganOh] === wOh) {
      // 운 천간이 원국 천간을 극
      if (wOh === saju.gisin) {
        mod += 0.3; // 기신을 극해주면 좋음
        details.push(`${pillarNames[i]} 기신 제압`);
      } else if (wOh === saju.yongsin) {
        mod -= 0.3; // 용신을 극하면 나쁨
      }
    }
  }

  // 지지 vs 원국 지지 (오행 레벨의 생극)
  for (let i = 0; i < wonJiOhs.length; i++) {
    const wOh = wonJiOhs[i];
    if (OHAENG_SANGSAENG[jiOh] === wOh && wOh === saju.yongsin) {
      mod += 0.2; // 운 지지가 원국 지지의 용신을 생
    }
    if (OHAENG_SANGGEUK[jiOh] === wOh && wOh === saju.gisin) {
      mod += 0.2; // 운 지지가 원국 기신 지지를 극
      details.push(`${pillarNames[i]} 기신 견제`);
    }
    if (OHAENG_SANGGEUK[jiOh] === wOh && wOh === saju.yongsin) {
      mod -= 0.2; // 운 지지가 원국 용신 지지를 극
    }
  }

  return { interactionMod: Math.round(mod * 10) / 10, details };
}

/**
 * 지장간 심층 분석 — 본기(사령)/중기/여기 가중치 차별화 + 십성 분석
 * 본기(사령): 70% 가중치 — 해당 지지의 핵심 기운
 * 중기: 20% 가중치 — 보조 기운
 * 여기: 10% 가중치 — 미세 기운
 */
export function analyzeJangganDeep(
  jiji: string,
  ilgan: string,
  yongsin: Ohaeng,
  gisin: Ohaeng,
  ilganOhaeng: Ohaeng,
): { jangganScore: number; saryeongSipseong: string; detail: string } {
  const jangganList = JIJI_JANGGAN[jiji] || [];
  if (jangganList.length === 0) return { jangganScore: 0, saryeongSipseong: '', detail: '' };

  // 가중치: 본기(0) > 중기(1) > 여기(2)
  const weights = [0.70, 0.20, 0.10];
  let totalScore = 0;
  let detail = '';
  let saryeongSipseong = '';

  for (let i = 0; i < jangganList.length && i < 3; i++) {
    const jg = jangganList[i];
    const jgOh = CHEONGAN_OHAENG[jg];
    const jgSip = calculateSipseong(ilgan, jg);
    const w = weights[i] || 0.10;
    const label = i === 0 ? '본기' : i === 1 ? '중기' : '여기';

    if (i === 0) saryeongSipseong = jgSip;

    // 희기신 5단계 판별
    const cls = classifyHeegishin(jgOh, yongsin, gisin, ilganOhaeng);
    totalScore += cls.weight * w;

    // 십성 품질 보정: 정계열이면 기신이어도 완화
    const isJeongJg = ['정재', '정관', '정인', '식신'].includes(jgSip);
    if (cls.weight < 0 && isJeongJg) {
      totalScore += Math.abs(cls.weight) * w * 0.3; // 30% 복구
    }

    if (Math.abs(cls.weight) >= 1.0) {
      detail += (detail ? ', ' : '') + `${label}(${jgSip})=${cls.role}`;
    }
  }

  return {
    jangganScore: Math.round(totalScore * 100) / 100,
    saryeongSipseong,
    detail,
  };
}

/**
 * 천간합 결과 오행 분석
 * 운의 천간이 원국 천간과 합을 이룰 때, 합화(合化) 결과 오행이 용신/기신인지
 */
export function analyzeCheonganHapResult(
  seunGan: string,
  sajuGans: string[], // [년간, 월간, 일간, 시간]
  yongsin: Ohaeng,
  gisin: Ohaeng,
): { hapScore: number; hapDetails: string[] } {
  const HAP_PAIR: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을',
    '병': '신', '신': '병', '정': '임', '임': '정',
    '무': '계', '계': '무',
  };
  const HAP_RESULT: Record<string, Ohaeng> = {
    '갑기': '토', '기갑': '토', '을경': '금', '경을': '금',
    '병신': '수', '신병': '수', '정임': '목', '임정': '목',
    '무계': '화', '계무': '화',
  };
  const PILLAR_NAMES = ['년간', '월간', '일간', '시간'];

  const partner = HAP_PAIR[seunGan];
  if (!partner) return { hapScore: 0, hapDetails: [] };

  let hapScore = 0;
  const hapDetails: string[] = [];

  for (let i = 0; i < sajuGans.length; i++) {
    if (sajuGans[i] === partner) {
      const key = `${seunGan}${partner}`;
      const resultOh = HAP_RESULT[key];
      if (!resultOh) continue;

      // 합화 결과 오행이 용신이면 가산, 기신이면 감점
      if (resultOh === yongsin) {
        hapScore += (i === 2) ? 1.0 : 0.5; // 일간합이 가장 중요
        hapDetails.push(`${PILLAR_NAMES[i]}합→${resultOh}(용신)`);
      } else if (resultOh === gisin) {
        hapScore -= (i === 2) ? 0.7 : 0.3;
        hapDetails.push(`${PILLAR_NAMES[i]}합→${resultOh}(기신)`);
      } else {
        // 희신인지 구신인지 체크
        if (OHAENG_SANGSAENG[resultOh] === yongsin) {
          hapScore += 0.3; // 희신
          hapDetails.push(`${PILLAR_NAMES[i]}합→${resultOh}(희신)`);
        } else {
          hapScore += 0.1; // 한신 (합 자체가 조화이므로 약간 긍정)
        }
      }
    }
  }

  return { hapScore: Math.round(hapScore * 10) / 10, hapDetails };
}

/**
 * 원국 기존 합/충 해소·강화 분석
 * 원국에 이미 있는 충이 운에 의해 해소되거나, 합이 깨지는 경우
 */
export function analyzeWonGukHapChungChange(
  saju: SajuResult,
  seunJiji: string,
): { changeMod: number; changeDetails: string[] } {
  const wonJijis = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  const PILLAR = ['년지', '월지', '일지', '시지'];

  const CHUNG_MAP: Record<string, string> = {
    '자': '오', '오': '자', '축': '미', '미': '축',
    '인': '신', '신': '인', '묘': '유', '유': '묘',
    '진': '술', '술': '진', '사': '해', '해': '사',
  };
  const HAP_MAP: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };

  let changeMod = 0;
  const changeDetails: string[] = [];

  // (1) 원국에 이미 충이 있는지 확인
  for (let i = 0; i < wonJijis.length; i++) {
    for (let j = i + 1; j < wonJijis.length; j++) {
      if (CHUNG_MAP[wonJijis[i]] === wonJijis[j]) {
        // 원국에 충이 있음. 세운 지지가 이 충을 해소하는가?
        // 해소 조건: 세운이 충 당사자 중 하나와 합을 이루면 → 합으로 충 해소
        if (HAP_MAP[seunJiji] === wonJijis[i] || HAP_MAP[seunJiji] === wonJijis[j]) {
          changeMod += 0.5;
          changeDetails.push(`${PILLAR[i]}↔${PILLAR[j]} 충 해소(${seunJiji} 합)`);
        }
      }
    }
  }

  // (2) 원국에 합이 있는데 세운이 깨는지 확인
  for (let i = 0; i < wonJijis.length; i++) {
    for (let j = i + 1; j < wonJijis.length; j++) {
      if (HAP_MAP[wonJijis[i]] === wonJijis[j]) {
        // 원국에 합이 있음. 세운이 합 당사자 중 하나를 충하면 → 합 파괴
        if (CHUNG_MAP[seunJiji] === wonJijis[i] || CHUNG_MAP[seunJiji] === wonJijis[j]) {
          // 합이 깨지면 나쁠 수도 좋을 수도 있음
          // 합의 결과 오행이 기신이면 → 깨지는 게 좋음
          const hapResultMap: Record<string, Ohaeng> = {
            '자축': '토', '축자': '토', '인해': '목', '해인': '목',
            '묘술': '화', '술묘': '화', '진유': '금', '유진': '금',
            '사신': '수', '신사': '수', '오미': '화', '미오': '화',
          };
          const hapKey = `${wonJijis[i]}${wonJijis[j]}`;
          const resultOh = hapResultMap[hapKey];
          if (resultOh === saju.gisin) {
            changeMod += 0.3;
            changeDetails.push(`${PILLAR[i]}+${PILLAR[j]} 기신합 파괴(전화위복)`);
          } else if (resultOh === saju.yongsin) {
            changeMod -= 0.5;
            changeDetails.push(`${PILLAR[i]}+${PILLAR[j]} 용신합 파괴(위험)`);
          } else {
            changeMod -= 0.2;
            changeDetails.push(`${PILLAR[i]}+${PILLAR[j]} 합 파괴`);
          }
        }
      }
    }
  }

  return { changeMod: Math.round(changeMod * 10) / 10, changeDetails };
}

/**
 * 공망(空亡) 판별
 * 일주 기준 공망: 10천간이 12지지를 모두 커버하지 못해 빈 2개 지지
 * 대운/세운 지지가 공망에 해당하면 → 그 기운이 약화/허무
 */
export function checkGongmang(
  dayGan: string,
  dayJi: string,
  targetJiji: string,
): { isGongmang: boolean; effect: number } {
  // 일주의 순(旬) 계산: 갑자~계유(공망:술해), 갑술~계미(공망:신유), ...
  const ganIdx = CHEONGAN.indexOf(dayGan as typeof CHEONGAN[number]);
  const jiIdx = JIJI.indexOf(dayJi as typeof JIJI[number]);
  if (ganIdx < 0 || jiIdx < 0) return { isGongmang: false, effect: 0 };

  // 순서 시작점: 천간이 '갑'인 지점에서의 지지 인덱스
  const sunStart = (jiIdx - ganIdx + 12) % 12;
  // 공망 = 순 밖에 남은 2개 지지
  const gongmang1 = JIJI[(sunStart + 10) % 12];
  const gongmang2 = JIJI[(sunStart + 11) % 12];

  const isGM = targetJiji === gongmang1 || targetJiji === gongmang2;
  // 공망이면 그 지지의 기운이 약화됨
  // 용신 오행이 공망이면 나쁨, 기신 오행이 공망이면 오히려 좋음(기신 약화)
  return { isGongmang: isGM, effect: isGM ? -0.3 : 0 };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ========== 추가 신살·귀인·천간충·암합 상수 ==========
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 천간충(天干沖) — 갑경, 을신, 병임, 정계, 무기(무기는 충이 아닌 설도 있으나 포함) */
const CHEONGAN_CHUNG: Record<string, string> = {
  '갑': '경', '경': '갑', '을': '신', '신': '을',
  '병': '임', '임': '병', '정': '계', '계': '정',
};

/** 암합(暗合) — 지장간 본기 사이의 숨겨진 천간합 */
const AMHAP_MAP: [string, string][] = [
  ['축', '인'],   // 기-갑 합 (축 본기 기, 인 본기 갑)
  ['인', '축'],
  ['묘', '신'],   // 을-경 합 (묘 본기 을, 신 본기 경)
  ['신', '묘'],
  ['사', '해'],   // 병-임 합 (사 본기 병, 해 본기 임) -- 동시에 지지충이라 복합
  ['해', '사'],
  ['오', '해'],   // 정-임 합? → 실제로는 정-임 충. 대신 午 중 기-壬 보정
  ['진', '유'],   // 무-신 합 → 진 본기 무, 유 본기 신 → 실제 갑기합 아닌 무계합 맞지 않으므로 제외
];
// 정확한 암합: 축인(기갑합), 묘신(을경합), 사해(병임합+충)
const AMHAP_PAIRS: [string, string][] = [
  ['축', '인'], ['인', '축'],
  ['묘', '신'], ['신', '묘'],
  ['사', '해'], ['해', '사'],
];

/** 원진살(怨嗔殺) — 미워하면서도 끌리는 관계 */
const WONJIN_MAP: Record<string, string> = {
  '자': '미', '미': '자', '축': '오', '오': '축',
  '인': '사', '사': '인', '묘': '진', '진': '묘',
  '신': '해', '해': '신', '유': '술', '술': '유',
};

/** 귀문관살(鬼門關殺) — 정신적 불안·영적 예민 */
const GWIMUN_MAP: Record<string, string> = {
  '자': '유', '유': '자', '축': '오', '오': '축',
  '인': '미', '미': '인', '묘': '신', '신': '묘',
  '진': '사', '사': '진', '술': '해', '해': '술',
};

/** 천덕귀인(天德貴人) — 월지 기준 */
const CHEONDUK_GWIIN: Record<string, string> = {
  '인': '정', '묘': '신', '진': '임', '사': '신',
  '오': '갑', '미': '계', '신': '임', '유': '병',
  '술': '을', '해': '갑', '자': '계', '축': '경',
};

/** 월덕귀인(月德貴人) — 월지 기준 */
const WOLDUK_GWIIN: Record<string, string> = {
  '인': '병', '오': '병', '술': '병',   // 화국
  '사': '경', '유': '경', '축': '경',   // 금국
  '신': '임', '자': '임', '진': '임',   // 수국
  '해': '갑', '묘': '갑', '미': '갑',   // 목국
};

/** 12신살 전체 — 일지(또는 년지) 기준 */
const TWELVE_SINSAL: Record<string, Record<string, string>> = {
  // 겁살(劫殺), 재살(災殺), 천살(天殺), 지살(地殺), 년살(年殺), 월살(月殺),
  // 망신살(亡身殺), 장성살(將星殺), 반안살(攀鞍殺)
  // 기준: 일지(또는 년지)의 삼합국 기준
  // 인오술(화국): 겁살=해, 재살=자, 천살=축, 지살=인, 년살=묘, 월살=진, 망신=사, 장성=오, 반안=미
  '인': { '겁살': '해', '재살': '자', '천살': '축', '지살': '인', '년살': '묘', '월살': '진', '망신살': '사', '장성살': '오', '반안살': '미' },
  '오': { '겁살': '해', '재살': '자', '천살': '축', '지살': '인', '년살': '묘', '월살': '진', '망신살': '사', '장성살': '오', '반안살': '미' },
  '술': { '겁살': '해', '재살': '자', '천살': '축', '지살': '인', '년살': '묘', '월살': '진', '망신살': '사', '장성살': '오', '반안살': '미' },
  // 사유축(금국): 겁살=인, 재살=묘, 천살=진, 지살=사, 년살=오, 월살=미, 망신=신, 장성=유, 반안=술
  '사': { '겁살': '인', '재살': '묘', '천살': '진', '지살': '사', '년살': '오', '월살': '미', '망신살': '신', '장성살': '유', '반안살': '술' },
  '유': { '겁살': '인', '재살': '묘', '천살': '진', '지살': '사', '년살': '오', '월살': '미', '망신살': '신', '장성살': '유', '반안살': '술' },
  '축': { '겁살': '인', '재살': '묘', '천살': '진', '지살': '사', '년살': '오', '월살': '미', '망신살': '신', '장성살': '유', '반안살': '술' },
  // 신자진(수국): 겁살=사, 재살=오, 천살=미, 지살=신, 년살=유, 월살=술, 망신=해, 장성=자, 반안=축
  '신': { '겁살': '사', '재살': '오', '천살': '미', '지살': '신', '년살': '유', '월살': '술', '망신살': '해', '장성살': '자', '반안살': '축' },
  '자': { '겁살': '사', '재살': '오', '천살': '미', '지살': '신', '년살': '유', '월살': '술', '망신살': '해', '장성살': '자', '반안살': '축' },
  '진': { '겁살': '사', '재살': '오', '천살': '미', '지살': '신', '년살': '유', '월살': '술', '망신살': '해', '장성살': '자', '반안살': '축' },
  // 해묘미(목국): 겁살=신, 재살=유, 천살=술, 지살=해, 년살=자, 월살=축, 망신=인, 장성=묘, 반안=진
  '해': { '겁살': '신', '재살': '유', '천살': '술', '지살': '해', '년살': '자', '월살': '축', '망신살': '인', '장성살': '묘', '반안살': '진' },
  '묘': { '겁살': '신', '재살': '유', '천살': '술', '지살': '해', '년살': '자', '월살': '축', '망신살': '인', '장성살': '묘', '반안살': '진' },
  '미': { '겁살': '신', '재살': '유', '천살': '술', '지살': '해', '년살': '자', '월살': '축', '망신살': '인', '장성살': '묘', '반안살': '진' },
};

/** 태세(太歲) 관계 — 세운 천간과 연간의 관계 */
function analyzeTaesae(seunGan: string, yearGan: string, ilgan: string): { taesaeMod: number; taesaeDetail: string } {
  let mod = 0;
  let detail = '';
  // 세운 천간이 연간과 충이면 → 태세충 (직업/사회운 동요)
  if (CHEONGAN_CHUNG[seunGan] === yearGan) {
    mod -= 0.3;
    detail = `태세충(${seunGan}↔${yearGan}): 사회적 변동·직업 불안`;
  }
  // 세운 천간이 연간과 합이면 → 태세합 (사회적 지원)
  const CHEONGAN_HAP_MAP: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을',
    '병': '신', '신': '병', '정': '임', '임': '정',
    '무': '계', '계': '무',
  };
  if (CHEONGAN_HAP_MAP[seunGan] === yearGan) {
    mod += 0.2;
    detail = `태세합(${seunGan}+${yearGan}): 사회적 지원·귀인의 도움`;
  }
  return { taesaeMod: mod, taesaeDetail: detail };
}

/**
 * 천간충 분석 — 운의 천간이 원국 4천간과 충이 되는지
 */
export function analyzeCheonganChung(
  runGan: string,
  sajuGans: string[],
  yongsin: Ohaeng,
  gisin: Ohaeng,
): { chungMod: number; chungDetails: string[] } {
  let mod = 0;
  const details: string[] = [];
  const PILLAR_NAME = ['연간', '월간', '일간', '시간'];
  const chungTarget = CHEONGAN_CHUNG[runGan];
  if (!chungTarget) return { chungMod: 0, chungDetails: [] };

  for (let i = 0; i < sajuGans.length; i++) {
    if (sajuGans[i] === chungTarget) {
      const targetOh = CHEONGAN_OHAENG[chungTarget];
      if (targetOh === gisin) {
        mod += 0.2;  // 기신 천간 충 = 기신 약화 → 좋음
        details.push(`${runGan}↔${PILLAR_NAME[i]}(${chungTarget}) 천간충: 기신(${gisin}) 약화로 전화위복`);
      } else if (targetOh === yongsin) {
        mod -= 0.4;  // 용신 천간 충 = 용신 손상 → 나쁨
        details.push(`${runGan}↔${PILLAR_NAME[i]}(${chungTarget}) 천간충: 용신(${yongsin}) 손상 주의`);
      } else {
        mod -= 0.15;
        details.push(`${runGan}↔${PILLAR_NAME[i]}(${chungTarget}) 천간충: 기운 충돌`);
      }
      // 일간충은 가장 직접적 → 추가 보정
      if (i === 2) mod -= 0.15;
    }
  }
  return { chungMod: Math.round(mod * 100) / 100, chungDetails: details };
}

/**
 * 암합(暗合) 분석 — 운의 지지가 원국 지지와 지장간 암합을 형성하는지
 */
export function analyzeAmhap(
  runJiji: string,
  wonJiji: string[],
  yongsin: Ohaeng,
  gisin: Ohaeng,
): { amhapMod: number; amhapDetails: string[] } {
  let mod = 0;
  const details: string[] = [];
  const PILLAR_NAME = ['연지', '월지', '일지', '시지'];

  for (let i = 0; i < wonJiji.length; i++) {
    for (const [a, b] of AMHAP_PAIRS) {
      if ((runJiji === a && wonJiji[i] === b)) {
        // 암합 발견 — 숨겨진 인연/조력
        const bongiA = JIJI_JANGGAN[a as keyof typeof JIJI_JANGGAN]?.[0];
        const bongiB = JIJI_JANGGAN[b as keyof typeof JIJI_JANGGAN]?.[0];
        if (bongiA && bongiB) {
          const amhapOh = CHEONGAN_OHAENG[bongiA];
          if (amhapOh === yongsin) {
            mod += 0.25;
            details.push(`${runJiji}↔${PILLAR_NAME[i]}(${wonJiji[i]}) 암합: 용신(${yongsin}) 활성화(숨겨진 조력)`);
          } else if (amhapOh === gisin) {
            mod -= 0.15;
            details.push(`${runJiji}↔${PILLAR_NAME[i]}(${wonJiji[i]}) 암합: 기신(${gisin}) 활성화 주의`);
          } else {
            mod += 0.1;
            details.push(`${runJiji}↔${PILLAR_NAME[i]}(${wonJiji[i]}) 암합: 보이지 않는 인연·도움`);
          }
        }
        break;
      }
    }
  }
  return { amhapMod: Math.round(mod * 100) / 100, amhapDetails: details };
}

/**
 * 추가 신살 종합 분석 — 12신살 + 원진살 + 귀문관살 + 천덕/월덕귀인 + 공망 진공/반공
 */
export function analyzeAdvancedSinsal(
  runJiji: string,
  runGan: string,
  dayJiji: string,
  yearJiji: string,
  wolji: string,
  yongsin: Ohaeng,
  gisin: Ohaeng,
  wonJiji: string[],
): { sinsalMod: number; sinsalDetails: string[]; areaEffect: { study: number; money: number; love: number; health: number; career: number } } {
  let mod = 0;
  const details: string[] = [];
  const area = { study: 0, money: 0, love: 0, health: 0, career: 0 };

  // ── 12신살 (일지 기준) ──
  const sinsalTable = TWELVE_SINSAL[dayJiji];
  if (sinsalTable) {
    // 겁살: 갑작스러운 재난·사고
    if (sinsalTable['겁살'] === runJiji) {
      mod -= 0.25;
      area.health -= 0.3;
      area.money -= 0.2;
      details.push(`겁살(劫殺): 갑작스러운 변고·사고 주의, 무리한 투자/모험 자제`);
    }
    // 재살: 질병·재해
    if (sinsalTable['재살'] === runJiji) {
      mod -= 0.2;
      area.health -= 0.35;
      details.push(`재살(災殺): 건강·안전에 각별히 주의, 정기 건강검진 권장`);
    }
    // 천살: 하늘의 재앙, 예측 불가
    if (sinsalTable['천살'] === runJiji) {
      mod -= 0.15;
      area.health -= 0.2;
      area.career -= 0.1;
      details.push(`천살(天殺): 예기치 않은 변수 주의, 보험·안전장치 점검`);
    }
    // 지살: 이동·변동
    if (sinsalTable['지살'] === runJiji) {
      mod += 0.05;
      area.career += 0.1;
      details.push(`지살(地殺): 이사·이동·전근 가능성, 변화 속 기회 모색`);
    }
    // 년살: 색정·이성 문제
    if (sinsalTable['년살'] === runJiji) {
      area.love += 0.15;
      area.career -= 0.1;
      details.push(`년살(年殺): 이성 관계 복잡해질 수 있음, 사적 관계와 공적 영역 구분 필요`);
    }
    // 월살: 고독·이별
    if (sinsalTable['월살'] === runJiji) {
      mod -= 0.1;
      area.love -= 0.25;
      details.push(`월살(月殺): 외로움·이별 기운, 주변 인연에 감사하며 관계 돌봄 필요`);
    }
    // 망신살: 명예 실추·체면 손상
    if (sinsalTable['망신살'] === runJiji) {
      mod -= 0.15;
      area.career -= 0.25;
      details.push(`망신살(亡身殺): 실언·실수로 체면 손상 주의, 말과 행동 신중`);
    }
    // 장성살: 권위·리더십 강화
    if (sinsalTable['장성살'] === runJiji) {
      mod += 0.2;
      area.career += 0.3;
      area.study += 0.1;
      details.push(`장성살(將星殺): 리더십·권위 상승, 승진·인정 기회`);
    }
    // 반안살: 안정·승진의 기운
    if (sinsalTable['반안살'] === runJiji) {
      mod += 0.15;
      area.career += 0.2;
      area.money += 0.1;
      details.push(`반안살(攀鞍殺): 안정적 상승세, 단계적 발전 기회`);
    }
  }

  // 년지 기준 12신살도 추가 검토 (약화 반영)
  const sinsalTableYear = TWELVE_SINSAL[yearJiji];
  if (sinsalTableYear) {
    if (sinsalTableYear['겁살'] === runJiji && sinsalTable?.['겁살'] !== runJiji) {
      mod -= 0.1;
      area.health -= 0.1;
      details.push(`겁살(년지 기준): 사회적 변고 주의`);
    }
    if (sinsalTableYear['장성살'] === runJiji && sinsalTable?.['장성살'] !== runJiji) {
      mod += 0.1;
      area.career += 0.15;
      details.push(`장성살(년지 기준): 사회적 인정 확대`);
    }
  }

  // ── 원진살 ──
  for (const wj of wonJiji) {
    if (WONJIN_MAP[runJiji] === wj) {
      mod -= 0.1;
      area.love -= 0.15;
      area.health -= 0.05;
      const pos = wonJiji.indexOf(wj);
      const posName = ['연지', '월지', '일지', '시지'][pos];
      details.push(`원진살(${runJiji}↔${posName} ${wj}): 가까운 관계에서 미묘한 갈등·불화`);
      // 일지와 원진이면 배우자 관계에 직접 영향
      if (pos === 2) { area.love -= 0.15; }
      break; // 1개만 반영
    }
  }

  // ── 귀문관살 ──
  for (const wj of wonJiji) {
    if (GWIMUN_MAP[runJiji] === wj) {
      mod -= 0.1;
      area.health -= 0.15;
      area.study += 0.1; // 영적 감수성 = 학문/예술에 유리할 수도
      const pos = wonJiji.indexOf(wj);
      const posName = ['연지', '월지', '일지', '시지'][pos];
      details.push(`귀문관살(${runJiji}↔${posName} ${wj}): 정신적 불안·예민함, 명상·심리 안정 필요 (단 예술·학문적 영감 가능)`);
      break;
    }
  }

  // ── 천덕귀인 ──
  if (CHEONDUK_GWIIN[wolji] === runGan) {
    mod += 0.25;
    area.career += 0.15;
    area.health += 0.1;
    details.push(`천덕귀인(天德貴人): 하늘의 보호, 위기를 넘기는 귀인의 기운`);
  }

  // ── 월덕귀인 ──
  if (WOLDUK_GWIIN[wolji] === runGan) {
    mod += 0.2;
    area.money += 0.15;
    area.career += 0.1;
    details.push(`월덕귀인(月德貴人): 꾸준한 복, 재물과 명예에 안정적 지원`);
  }

  return {
    sinsalMod: Math.round(mod * 100) / 100,
    sinsalDetails: details,
    areaEffect: area,
  };
}

/**
 * 공망 진공/반공 세밀 판별
 * 진공(眞空): 공망 지지가 원국에 없고, 합으로도 구제 안 됨 → 강한 공망
 * 반공(半空): 공망 지지가 원국에 있거나, 합/충으로 구제됨 → 약한 공망
 */
export function analyzeGongmangDetail(
  dayGan: string,
  dayJi: string,
  targetJiji: string,
  wonJiji: string[],
): { isJingong: boolean; isBangong: boolean; gongmangMod: number } {
  const gm = checkGongmang(dayGan, dayJi, targetJiji);
  if (!gm.isGongmang) return { isJingong: false, isBangong: false, gongmangMod: 0 };

  // 원국에 같은 지지가 있으면 → 반공 (실공(實空)이라고도 함)
  if (wonJiji.includes(targetJiji)) {
    return { isJingong: false, isBangong: true, gongmangMod: -0.1 }; // 약한 공망
  }

  // 육합으로 구제되는지 확인
  const YUKHAP_MAP: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };
  const hapTarget = YUKHAP_MAP[targetJiji];
  if (hapTarget && wonJiji.includes(hapTarget)) {
    return { isJingong: false, isBangong: true, gongmangMod: -0.15 }; // 합으로 일부 구제
  }

  // 아무 구제도 없으면 → 진공
  return { isJingong: true, isBangong: false, gongmangMod: -0.4 }; // 강한 공망
}

/**
 * 투합(妬合) 판별 — 한 천간에 대해 합 상대가 2개 이상 존재
 * 예: 원국에 갑이 2개 있고 운에서 기가 오면 → 갑+기 합이 투합(쟁합)
 */
export function checkTuhap(
  runGan: string,
  sajuGans: string[],
): { isTuhap: boolean; tuhapMod: number; tuhapDetail: string } {
  const CHEONGAN_HAP_M: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을',
    '병': '신', '신': '병', '정': '임', '임': '정',
    '무': '계', '계': '무',
  };
  const hapTarget = CHEONGAN_HAP_M[runGan];
  if (!hapTarget) return { isTuhap: false, tuhapMod: 0, tuhapDetail: '' };

  // 원국에 합 상대가 몇 개 있는지
  const count = sajuGans.filter(g => g === hapTarget).length;
  // 동시에 운의 간과 같은 간이 원국에도 있으면 → 쟁합
  const sameCount = sajuGans.filter(g => g === runGan).length;

  if (count >= 2 || (count >= 1 && sameCount >= 1)) {
    return {
      isTuhap: true,
      tuhapMod: -0.2,
      tuhapDetail: `투합(妬合): ${runGan}+${hapTarget} 합에 경쟁자 존재 → 합의 효과 감소, 인간관계 복잡`,
    };
  }
  return { isTuhap: false, tuhapMod: 0, tuhapDetail: '' };
}

/**
 * 형충파해 합 해소 분석 — 원국의 충/형이 운의 합에 의해 해소되는지
 */
export function analyzeHapResolution(
  runJiji: string,
  wonJiji: string[],
): { resolveMod: number; resolveDetails: string[] } {
  let mod = 0;
  const details: string[] = [];
  const JIJI_CHUNG_M: Record<string, string> = {
    '자': '오', '축': '미', '인': '신', '묘': '유', '진': '술', '사': '해',
    '오': '자', '미': '축', '신': '인', '유': '묘', '술': '진', '해': '사',
  };
  const YUKHAP_M: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };
  const PILLAR_NAME = ['연지', '월지', '일지', '시지'];

  // 원국 내 충 쌍 찾기
  for (let i = 0; i < wonJiji.length; i++) {
    for (let j = i + 1; j < wonJiji.length; j++) {
      if (JIJI_CHUNG_M[wonJiji[i]] === wonJiji[j]) {
        // 원국에 충이 존재 → 운이 그 중 하나와 합하면 충 해소
        if (YUKHAP_M[runJiji] === wonJiji[i]) {
          mod += 0.2;
          details.push(`${PILLAR_NAME[i]}(${wonJiji[i]})↔${PILLAR_NAME[j]}(${wonJiji[j]}) 충이 운(${runJiji})의 합으로 해소`);
        } else if (YUKHAP_M[runJiji] === wonJiji[j]) {
          mod += 0.2;
          details.push(`${PILLAR_NAME[i]}(${wonJiji[i]})↔${PILLAR_NAME[j]}(${wonJiji[j]}) 충이 운(${runJiji})의 합으로 해소`);
        }
      }
    }
  }

  // 반대: 원국 합이 운의 충으로 파괴되는 경우
  for (let i = 0; i < wonJiji.length; i++) {
    for (let j = i + 1; j < wonJiji.length; j++) {
      if (YUKHAP_M[wonJiji[i]] === wonJiji[j]) {
        // 원국에 합이 존재 → 운이 그 중 하나와 충하면 합 파괴
        if (JIJI_CHUNG_M[runJiji] === wonJiji[i] || JIJI_CHUNG_M[runJiji] === wonJiji[j]) {
          mod -= 0.2;
          details.push(`${PILLAR_NAME[i]}(${wonJiji[i]})+${PILLAR_NAME[j]}(${wonJiji[j]}) 합이 운(${runJiji})의 충으로 파괴`);
        }
      }
    }
  }

  return { resolveMod: Math.round(mod * 100) / 100, resolveDetails: details };
}

/**
 * 12운성 의미적 세분화 보정
 * 단순 에너지 수치가 아닌, 각 단계 고유의 의미를 점수에 반영
 * - 장생: 새 시작, 성장 → 변화에 유리
 * - 목욕: 불안정하지만 변신 가능 → 양면적
 * - 관대: 사회적 인정 → 직업/명예에 유리
 * - 건록: 실력 발휘 → 가장 안정적
 * - 제왕: 정점이지만 쇠퇴 임박 → 높은 에너지지만 주의
 * - 묘: 고요, 저장 → 내면 성장/부동산에 유리
 * - 절: 리셋 → 극적 전환, 새 분야 개척
 */
export function get12StageContextMod(
  stage: TwelveStage,
  seunSipseong: string,
  isSingang: boolean,
): { stageMod: number; stageDetail: string } {
  let mod = 0;
  let detail = '';

  switch (stage) {
    case '장생':
      if (['식신', '정재', '정인'].includes(seunSipseong)) {
        mod += 0.3;
        detail = '장생+길신: 새 출발에 순풍';
      }
      break;
    case '목욕':
      if (['상관', '편재', '겁재'].includes(seunSipseong)) {
        mod -= 0.3;
        detail = '목욕+불안정 십성: 유혹/실수 주의';
      }
      if (seunSipseong === '식신' || seunSipseong === '정인') {
        mod += 0.2;
        detail = '목욕+안정 십성: 변신 성공 가능';
      }
      break;
    case '관대':
      if (['정관', '정재'].includes(seunSipseong)) {
        mod += 0.4;
        detail = '관대+명예 십성: 사회적 인정 극대화';
      }
      break;
    case '건록':
      mod += 0.2; // 건록 자체가 안정적
      if (isSingang && ['비견', '겁재'].includes(seunSipseong)) {
        mod -= 0.3;
        detail = '건록+비겁(신강): 에너지 과잉 주의';
      } else {
        detail = '건록: 안정적 실력 발휘기';
      }
      break;
    case '제왕':
      if (isSingang) {
        mod -= 0.2;
        detail = '제왕(신강): 정점 후 하강 경계';
      } else {
        mod += 0.3;
        detail = '제왕(신약): 최대 에너지 충전';
      }
      break;
    case '쇠':
      if (['정인', '편인'].includes(seunSipseong)) {
        mod += 0.2;
        detail = '쇠+인성: 경험으로 극복';
      }
      break;
    case '병':
      if (['편관'].includes(seunSipseong)) {
        mod -= 0.3;
        detail = '병+편관: 건강/정신 압박 주의';
      }
      break;
    case '사':
      if (['식신'].includes(seunSipseong)) {
        mod += 0.2;
        detail = '사+식신: 전환기 창의력 발휘';
      }
      break;
    case '묘':
      if (['정재', '편재'].includes(seunSipseong)) {
        mod += 0.2;
        detail = '묘+재성: 저축/부동산 유리';
      }
      break;
    case '절':
      if (['식신', '상관'].includes(seunSipseong)) {
        mod += 0.3;
        detail = '절+식상: 새 분야 개척기';
      }
      if (['편관', '겁재'].includes(seunSipseong)) {
        mod -= 0.3;
        detail = '절+흉신: 극도 불안정';
      }
      break;
    case '태':
    case '양':
      if (['정인', '식신'].includes(seunSipseong)) {
        mod += 0.2;
        detail = `${stage}+길신: 성장의 씨앗`;
      }
      break;
  }

  return { stageMod: Math.round(mod * 10) / 10, stageDetail: detail };
}

// ========== 4주(연주/월주/일주/시주) 관계 분석 ==========

/**
 * 4주 관계도(Pillar Relationship) 복합 분석
 *
 * 사주명리학에서 연주·월주·일주·시주는 각각 의미 영역을 갖고,
 * 주 간의 천간·지지 관계(생극/합충)가 원국의 구조적 특성을 결정한다.
 *
 * ■ 주 의미:
 *   연주(年柱) = 조상, 유년기(0~15), 사회적 배경
 *   월주(月柱) = 부모, 청년기(16~30), 사회 환경/직업
 *   일주(日柱) = 본인/배우자, 중년기(31~45)
 *   시주(時柱) = 자녀/하인, 노년기(46~), 결실
 *
 * ■ 인접 관계:
 *   연-월: 가문 → 사회 전환 (원활하면 학업/직업 순조)
 *   월-일: 환경 → 자아 (원활하면 직업/결혼 순조)
 *   일-시: 자아 → 결실 (원활하면 자녀/노후 순조)
 *
 * ■ 대각 관계:
 *   연-일: 외부 → 내면 (원활하면 자존감/사회 적응)
 *   월-시: 청년 → 노년 흐름 (원활하면 커리어 지속성)
 *   연-시: 시작 → 끝 (원활하면 일생 관통 안정)
 *
 * ■ 분석 내용:
 *   (1) 천간 간 생극 관계 (6쌍)
 *   (2) 지지 간 합충형파해 (6쌍)
 *   (3) 천간투출·암장 관계
 *   (4) 각 관계가 영역별(학업/재물/연애/건강/직업)에 미치는 영향
 *   (5) 운(대운/세운)이 원국 관계를 활성화/약화시키는지
 */
export interface PillarRelation {
  pair: string;            // '연-월' | '월-일' | '일-시' | '연-일' | '월-시' | '연-시'
  ganRelation: string;     // '상생' | '상극' | '비화' | '무관계'
  ganDetail: string;       // e.g., '연간(甲목)→월간(丙화) 상생'
  jiRelation: string;      // '육합' | '삼합' | '충' | '형' | '상생' | '상극' | '비화'
  jiDetail: string;
  areaImpact: {            // 영역별 영향도 (-1.0 ~ +1.0)
    study: number;
    money: number;
    love: number;
    health: number;
    career: number;
  };
  harmony: number;         // 종합 조화도 (-2 ~ +2)
}

export interface PillarRelationAnalysis {
  relations: PillarRelation[];
  structuralScore: number;       // 원국 구조 점수 (-5 ~ +5)
  areaModifiers: {               // 영역별 총 보정
    study: number;
    money: number;
    love: number;
    health: number;
    career: number;
  };
  runActivation: number;         // 운이 원국 관계를 활성화하는 정도
  details: string[];
}

export function analyzePillarRelations(
  saju: SajuResult,
  runGanOh?: Ohaeng,  // 대운/세운 천간 오행 (optional)
  runJiOh?: Ohaeng,   // 대운/세운 지지 오행 (optional)
  runJiji?: string,   // 대운/세운 지지 글자 (optional)
): PillarRelationAnalysis {
  const pillars = [
    { name: '연', gan: saju.year.cheongan, ji: saju.year.jiji, ganOh: saju.year.cheonganOhaeng, jiOh: saju.year.jijiOhaeng },
    { name: '월', gan: saju.month.cheongan, ji: saju.month.jiji, ganOh: saju.month.cheonganOhaeng, jiOh: saju.month.jijiOhaeng },
    { name: '일', gan: saju.day.cheongan, ji: saju.day.jiji, ganOh: CHEONGAN_OHAENG[saju.ilgan], jiOh: saju.day.jijiOhaeng },
    { name: '시', gan: saju.hour.cheongan, ji: saju.hour.jiji, ganOh: saju.hour.cheonganOhaeng, jiOh: saju.hour.jijiOhaeng },
  ];

  const CHUNG_MAP: Record<string, string> = {
    '자': '오', '오': '자', '축': '미', '미': '축',
    '인': '신', '신': '인', '묘': '유', '유': '묘',
    '진': '술', '술': '진', '사': '해', '해': '사',
  };
  const YUKHAP_MAP: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };
  // 삼합 그룹
  const SAMHAP_GROUPS: string[][] = [
    ['신', '자', '진'], // 수국
    ['해', '묘', '미'], // 목국
    ['인', '오', '술'], // 화국
    ['사', '유', '축'], // 금국
  ];
  // 형(刑)
  const HYUNG_MAP: Record<string, string[]> = {
    '인': ['사', '신'], '사': ['인', '신'], '신': ['인', '사'], // 무례지형(無禮之刑)
    '축': ['술', '미'], '술': ['축', '미'], '미': ['축', '술'], // 무은지형(無恩之刑)
    '자': ['묘'], '묘': ['자'],                                   // 상형지형(相刑之刑)
    '진': ['진'], '오': ['오'], '유': ['유'], '해': ['해'],       // 자형(自刑)
  };

  const ilOhaeng = CHEONGAN_OHAENG[saju.ilgan];
  const yongsin = saju.yongsin;
  const gisin = saju.gisin;

  const relations: PillarRelation[] = [];
  const details: string[] = [];
  const areaModifiers = { study: 0, money: 0, love: 0, health: 0, career: 0 };
  let structuralScore = 0;
  let runActivation = 0;

  // 6쌍 분석: [연-월(0-1), 월-일(1-2), 일-시(2-3), 연-일(0-2), 월-시(1-3), 연-시(0-3)]
  const pairs: [number, number][] = [[0,1], [1,2], [2,3], [0,2], [1,3], [0,3]];
  const pairNames = ['연-월', '월-일', '일-시', '연-일', '월-시', '연-시'];

  // 인접주 가중치(더 중요) vs 대각 가중치
  const pairWeights = [1.0, 1.2, 1.0, 0.6, 0.6, 0.4];

  for (let p = 0; p < pairs.length; p++) {
    const [i, j] = pairs[p];
    const pi = pillars[i];
    const pj = pillars[j];
    const w = pairWeights[p];
    const pairName = pairNames[p];
    let harmony = 0;
    const impact = { study: 0, money: 0, love: 0, health: 0, career: 0 };

    // ── (1) 천간 관계 분석 ──
    let ganRel = '무관계';
    let ganDet = '';
    const ganOh_i = pi.ganOh;
    const ganOh_j = pj.ganOh;

    if (ganOh_i === ganOh_j) {
      ganRel = '비화';
      ganDet = `${pi.name}간(${pi.gan})↔${pj.name}간(${pj.gan}) 동오행(${ganOh_i})`;
      // 비화: 같은 오행이 나란히 → 해당 오행 강화
      if (ganOh_i === yongsin) { harmony += 0.3; }
      else if (ganOh_i === gisin) { harmony -= 0.3; }
    } else if (OHAENG_SANGSAENG[ganOh_i] === ganOh_j) {
      ganRel = '상생';
      ganDet = `${pi.name}간(${pi.gan}${ganOh_i})→${pj.name}간(${pj.gan}${ganOh_j}) 상생`;
      harmony += 0.5;
      // 상생 방향: 앞주가 뒷주를 생해줌 → 뒷주 영역 활성화
      if (ganOh_j === yongsin) harmony += 0.3;
      if (ganOh_j === gisin) harmony -= 0.2;
    } else if (OHAENG_SANGSAENG[ganOh_j] === ganOh_i) {
      ganRel = '역생';
      ganDet = `${pj.name}간(${pj.gan}${ganOh_j})→${pi.name}간(${pi.gan}${ganOh_i}) 역생`;
      harmony += 0.3; // 역생도 조화이지만 순방향보다 약함
      if (ganOh_i === yongsin) harmony += 0.2;
    } else if (OHAENG_SANGGEUK[ganOh_i] === ganOh_j) {
      ganRel = '상극';
      ganDet = `${pi.name}간(${pi.gan}${ganOh_i})→${pj.name}간(${pj.gan}${ganOh_j}) 상극`;
      // 극: 앞주가 뒷주를 극함
      if (ganOh_j === gisin) {
        harmony += 0.2; // 기신을 극 → 오히려 좋음
        ganDet += '(기신제압)';
      } else if (ganOh_j === yongsin) {
        harmony -= 0.5; // 용신을 극 → 나쁨
        ganDet += '(용신극)';
      } else {
        harmony -= 0.3;
      }
    } else if (OHAENG_SANGGEUK[ganOh_j] === ganOh_i) {
      ganRel = '역극';
      ganDet = `${pj.name}간(${pj.gan}${ganOh_j})→${pi.name}간(${pi.gan}${ganOh_i}) 역극`;
      if (ganOh_i === gisin) { harmony += 0.15; }
      else if (ganOh_i === yongsin) { harmony -= 0.4; }
      else { harmony -= 0.2; }
    }

    // 천간합 체크 (갑기합토, 을경합금, 병신합수, 정임합목, 무계합화)
    const CHEONGAN_HAP_PAIR: Record<string, string> = {
      '갑': '기', '기': '갑', '을': '경', '경': '을',
      '병': '신', '신': '병', '정': '임', '임': '정',
      '무': '계', '계': '무',
    };
    const CHEONGAN_HAP_RESULT: Record<string, Ohaeng> = {
      '갑기': '토', '기갑': '토', '을경': '금', '경을': '금',
      '병신': '수', '신병': '수', '정임': '목', '임정': '목',
      '무계': '화', '계무': '화',
    };
    if (CHEONGAN_HAP_PAIR[pi.gan] === pj.gan) {
      const hapKey = `${pi.gan}${pj.gan}`;
      const hapResult = CHEONGAN_HAP_RESULT[hapKey];
      ganRel = '천간합';
      ganDet = `${pi.name}간(${pi.gan})↔${pj.name}간(${pj.gan}) 천간합→${hapResult || ''}`;
      harmony += 0.5; // 합 자체가 조화
      if (hapResult === yongsin) { harmony += 0.5; ganDet += '(용신화)'; }
      else if (hapResult === gisin) { harmony -= 0.3; ganDet += '(기신화)'; }
      // 일간이 합에 참여하면 연애 보너스
      if (i === 2 || j === 2) {
        impact.love += 0.3;
        // 월-일 합이면 직업+연애 동시 보너스
        if (pairName === '월-일') impact.career += 0.2;
      }
    }

    // ── (2) 지지 관계 분석 ──
    let jiRel = '무관계';
    let jiDet = '';
    const jiOh_i = pi.jiOh;
    const jiOh_j = pj.jiOh;

    // 육합 체크
    if (YUKHAP_MAP[pi.ji] === pj.ji) {
      jiRel = '육합';
      jiDet = `${pi.name}지(${pi.ji})↔${pj.name}지(${pj.ji}) 육합`;
      harmony += 0.6;
      if (pairName === '일-시') { impact.love += 0.2; impact.health += 0.2; }
      if (pairName === '월-일') { impact.career += 0.3; impact.money += 0.2; }
      if (pairName === '연-월') { impact.study += 0.2; }
    }
    // 충 체크
    else if (CHUNG_MAP[pi.ji] === pj.ji) {
      jiRel = '충';
      jiDet = `${pi.name}지(${pi.ji})↔${pj.name}지(${pj.ji}) 충`;
      harmony -= 0.7;
      if (pairName === '일-시') { impact.health -= 0.3; impact.love -= 0.2; }
      if (pairName === '월-일') { impact.career -= 0.3; impact.health -= 0.2; }
      if (pairName === '연-월') { impact.study -= 0.2; impact.career -= 0.1; }
      if (pairName === '연-시') { impact.health -= 0.2; } // 시작↔끝 충 = 일생 불안정
    }
    // 형(刑) 체크
    else if (HYUNG_MAP[pi.ji]?.includes(pj.ji)) {
      jiRel = '형';
      jiDet = `${pi.name}지(${pi.ji})↔${pj.name}지(${pj.ji}) 형`;
      harmony -= 0.4;
      impact.health -= 0.2;
      if (pairName === '월-일' || pairName === '일-시') impact.love -= 0.15;
    }
    else {
      // 삼합 부분 관계 (반합) 체크
      let isSamhapPart = false;
      for (const group of SAMHAP_GROUPS) {
        if (group.includes(pi.ji) && group.includes(pj.ji)) {
          jiRel = '반합';
          jiDet = `${pi.name}지(${pi.ji})↔${pj.name}지(${pj.ji}) 반합`;
          harmony += 0.3;
          isSamhapPart = true;
          break;
        }
      }
      if (!isSamhapPart) {
        // 오행 레벨 생극
        if (OHAENG_SANGSAENG[jiOh_i] === jiOh_j) {
          jiRel = '지지상생';
          jiDet = `${pi.name}지(${pi.ji}${jiOh_i})→${pj.name}지(${pj.ji}${jiOh_j}) 상생`;
          harmony += 0.3;
          if (jiOh_j === yongsin) harmony += 0.2;
        } else if (OHAENG_SANGSAENG[jiOh_j] === jiOh_i) {
          jiRel = '지지역생';
          jiDet = `${pj.name}지(${pj.ji}${jiOh_j})→${pi.name}지(${pi.ji}${jiOh_i}) 역생`;
          harmony += 0.2;
        } else if (jiOh_i === jiOh_j) {
          jiRel = '지지비화';
          jiDet = `${pi.name}지↔${pj.name}지 동오행(${jiOh_i})`;
          if (jiOh_i === yongsin) harmony += 0.2;
          else if (jiOh_i === gisin) harmony -= 0.2;
        } else if (OHAENG_SANGGEUK[jiOh_i] === jiOh_j) {
          jiRel = '지지상극';
          jiDet = `${pi.name}지(${jiOh_i})→${pj.name}지(${jiOh_j}) 상극`;
          if (jiOh_j === gisin) harmony += 0.1;
          else if (jiOh_j === yongsin) harmony -= 0.3;
          else harmony -= 0.2;
        }
      }
    }

    // ── (3) 주 위치별 영역 매핑 ──
    // 연-월: 학업·진로 결정 시기
    if (pairName === '연-월') {
      impact.study += harmony * 0.3;
      impact.career += harmony * 0.15;
    }
    // 월-일: 직업·결혼 핵심 축
    else if (pairName === '월-일') {
      impact.career += harmony * 0.25;
      impact.love += harmony * 0.2;
      impact.money += harmony * 0.15;
    }
    // 일-시: 배우자·자녀·건강·노후
    else if (pairName === '일-시') {
      impact.love += harmony * 0.25;
      impact.health += harmony * 0.2;
      impact.money += harmony * 0.1;
    }
    // 연-일: 사회↔자아 적응
    else if (pairName === '연-일') {
      impact.career += harmony * 0.15;
      impact.health += harmony * 0.1;
    }
    // 월-시: 커리어 지속성
    else if (pairName === '월-시') {
      impact.career += harmony * 0.2;
      impact.money += harmony * 0.15;
    }
    // 연-시: 일생 관통 안정성
    else if (pairName === '연-시') {
      impact.health += harmony * 0.15;
      impact.study += harmony * 0.1;
    }

    // ── (4) 운(대운/세운)이 원국 관계를 활성화/약화시키는지 ──
    if (runGanOh || runJiOh) {
      // 운의 오행이 원국 관계에 개입하는 경우
      // 충 관계인데 운이 합을 가져와 해소 → 활성화 보너스
      if (jiRel === '충' && runJiji) {
        if (YUKHAP_MAP[runJiji] === pi.ji || YUKHAP_MAP[runJiji] === pj.ji) {
          runActivation += 0.4 * w;
          details.push(`${pairName} 충을 운(${runJiji})이 합으로 해소`);
        }
      }
      // 합 관계인데 운이 충을 가져와 파괴 → 감점
      if ((jiRel === '육합' || jiRel === '반합') && runJiji) {
        if (CHUNG_MAP[runJiji] === pi.ji || CHUNG_MAP[runJiji] === pj.ji) {
          runActivation -= 0.3 * w;
          details.push(`${pairName} 합을 운(${runJiji})이 충으로 파괴`);
        }
      }
      // 운의 오행이 관계 중 약한 쪽을 생해주면 → 구조 보강
      if (runGanOh) {
        if (ganRel === '상극' && OHAENG_SANGSAENG[runGanOh] === ganOh_j && ganOh_j === yongsin) {
          runActivation += 0.3 * w;
          details.push(`운이 ${pairName} 극당하는 용신(${ganOh_j})을 생`);
        }
        // 운이 기신 비화를 더 강화하면 감점
        if (ganRel === '비화' && ganOh_i === gisin && runGanOh === gisin) {
          runActivation -= 0.3 * w;
          details.push(`운이 ${pairName} 기신 비화를 강화`);
        }
      }
      // 운 지지 오행이 원국 상극 관계의 통관(通關) 역할
      if (runJiOh && (jiRel === '지지상극' || jiRel === '충')) {
        // 통관: A극B일 때 A→통관→B 상생 흐름 (A생통관, 통관생B)
        if (OHAENG_SANGSAENG[jiOh_i] === runJiOh && OHAENG_SANGSAENG[runJiOh] === jiOh_j) {
          runActivation += 0.5 * w;
          details.push(`운(${runJiOh})이 ${pairName} 상극의 통관 역할`);
        }
      }
    }

    harmony = Math.round(harmony * w * 100) / 100;
    structuralScore += harmony;

    // 영역별 누적
    for (const k of ['study', 'money', 'love', 'health', 'career'] as const) {
      areaModifiers[k] += Math.round(impact[k] * w * 100) / 100;
    }

    relations.push({
      pair: pairName,
      ganRelation: ganRel,
      ganDetail: ganDet,
      jiRelation: jiRel,
      jiDetail: jiDet,
      areaImpact: impact,
      harmony,
    });
  }

  // ── (5) 삼합 완성 체크 (3개 지지가 모두 있으면 강력 보너스) ──
  const allJijis = [pillars[0].ji, pillars[1].ji, pillars[2].ji, pillars[3].ji];
  for (const group of SAMHAP_GROUPS) {
    const count = group.filter(g => allJijis.includes(g)).length;
    if (count === 3) {
      const SAMHAP_RESULT: Record<string, Ohaeng> = {
        '신자진': '수', '해묘미': '목', '인오술': '화', '사유축': '금',
      };
      const key = group.join('');
      const resultOh = SAMHAP_RESULT[key];
      if (resultOh === yongsin) {
        structuralScore += 1.0;
        areaModifiers.career += 0.3;
        areaModifiers.money += 0.2;
        details.push(`삼합 완성(${group.join('')}→${resultOh}=용신): 대길`);
      } else if (resultOh === gisin) {
        structuralScore -= 0.5;
        details.push(`삼합 완성(${group.join('')}→${resultOh}=기신): 기신 강화 주의`);
      } else {
        structuralScore += 0.3;
        details.push(`삼합 완성(${group.join('')}→${resultOh})`);
      }
    }
  }

  // ── (6) 천간 일기(一氣) / 지지 방합 등 특수 패턴 ──
  // 천간 3개 이상 같은 오행 → 해당 오행 극강
  const ganOhCounts: Record<string, number> = {};
  for (const p of pillars) { ganOhCounts[p.ganOh] = (ganOhCounts[p.ganOh] || 0) + 1; }
  for (const [oh, cnt] of Object.entries(ganOhCounts)) {
    if (cnt >= 3) {
      if (oh === yongsin) { structuralScore += 0.5; details.push(`천간 ${oh} 3주 이상: 용신 극강`); }
      else if (oh === gisin) { structuralScore -= 0.5; details.push(`천간 ${oh} 3주 이상: 기신 과잉`); }
    }
  }

  // 지지 방합 체크 (인묘진=목, 사오미=화, 신유술=금, 해자축=수)
  const BANGHAP: [string[], Ohaeng][] = [
    [['인', '묘', '진'], '목'], [['사', '오', '미'], '화'],
    [['신', '유', '술'], '금'], [['해', '자', '축'], '수'],
  ];
  for (const [group, resultOh] of BANGHAP) {
    const cnt = group.filter(g => allJijis.includes(g)).length;
    if (cnt === 3) {
      if (resultOh === yongsin) { structuralScore += 0.8; areaModifiers.career += 0.2; details.push(`방합(${group.join('')}→${resultOh}=용신)`); }
      else if (resultOh === gisin) { structuralScore -= 0.4; details.push(`방합(${group.join('')}→${resultOh}=기신)`); }
      else { structuralScore += 0.2; }
    }
  }

  // ── (7) 천간투출(透出) 분석 ── 지장간 본기가 천간에 드러남
  // 투출되면 해당 오행의 힘이 표면화되어 실질적 영향력 극대화
  const PILLAR_IDX_NAMES = ['연', '월', '일', '시'];
  for (let pi2 = 0; pi2 < 4; pi2++) {
    const jiJanggan = JIJI_JANGGAN[pillars[pi2].ji];
    if (!jiJanggan || jiJanggan.length === 0) continue;
    const bongi = jiJanggan[0]; // 본기 (가장 중요)
    const bongiOh = CHEONGAN_OHAENG[bongi];
    // 같은 주 내부 투출
    if (pillars[pi2].gan === bongi) {
      if (bongiOh === yongsin) {
        structuralScore += 0.3;
        areaModifiers.career += 0.1;
        details.push(`${PILLAR_IDX_NAMES[pi2]}주 천간투출(${bongi}=${bongiOh}=용신)`);
      } else if (bongiOh === gisin) {
        structuralScore -= 0.2;
        details.push(`${PILLAR_IDX_NAMES[pi2]}주 기신 투출(${bongi}=${bongiOh})`);
      }
    }
    // 다른 주 천간에 투출 (인접 주 우선)
    for (let pj2 = 0; pj2 < 4; pj2++) {
      if (pi2 === pj2) continue;
      if (pillars[pj2].gan === bongi) {
        const adjBonus = Math.abs(pi2 - pj2) === 1 ? 0.2 : 0.1; // 인접주면 더 강함
        if (bongiOh === yongsin) {
          structuralScore += adjBonus;
          details.push(`${PILLAR_IDX_NAMES[pi2]}지 본기→${PILLAR_IDX_NAMES[pj2]}간 투출(용신)`);
        } else if (bongiOh === gisin) {
          structuralScore -= adjBonus * 0.7;
        }
      }
    }
  }

  // ── (8) 각 주의 십성 교차 분석 ──
  // 일간 기준 각 주 천간의 십성을 분석하고, 인접 십성 간 시너지/충돌 판정
  const pillarSipseongs: string[] = [];
  for (let pi3 = 0; pi3 < 4; pi3++) {
    if (pi3 === 2) { pillarSipseongs.push('일간'); continue; }
    pillarSipseongs.push(calculateSipseong(saju.ilgan, pillars[pi3].gan));
  }
  // 인접 십성 시너지/충돌
  const SIPSEONG_SYNERGY: Record<string, string[]> = {
    '식신': ['정재', '편재'],      // 식신생재
    '정인': ['정관'],              // 관인상생
    '편인': ['편관'],              // 살인상생
    '정관': ['정인', '정재'],      // 관인, 재관
    '정재': ['정관'],              // 재생관
  };
  const SIPSEONG_CLASH: Record<string, string[]> = {
    '상관': ['정관'],              // 상관견관
    '겁재': ['정재'],              // 겁재탈재
    '편관': ['편재'],              // 재생살 (살 강화)
    '편인': ['식신'],              // 효신탈식
  };
  for (let k = 0; k < 3; k++) {
    const s1 = pillarSipseongs[k];
    const s2 = pillarSipseongs[k + 1];
    if (s1 === '일간' || s2 === '일간') continue;
    // 시너지 체크
    if (SIPSEONG_SYNERGY[s1]?.includes(s2) || SIPSEONG_SYNERGY[s2]?.includes(s1)) {
      structuralScore += 0.3;
      // 시너지별 영역 보정
      if ((s1 === '식신' || s2 === '식신') && (s1 === '정재' || s2 === '정재' || s1 === '편재' || s2 === '편재')) {
        areaModifiers.money += 0.2; // 식신생재 → 재물
        details.push(`${PILLAR_IDX_NAMES[k]}-${PILLAR_IDX_NAMES[k+1]} 식신생재 시너지`);
      }
      if ((s1 === '정관' || s2 === '정관') && (s1 === '정인' || s2 === '정인')) {
        areaModifiers.career += 0.2; areaModifiers.study += 0.15;
        details.push(`${PILLAR_IDX_NAMES[k]}-${PILLAR_IDX_NAMES[k+1]} 관인상생 시너지`);
      }
      if ((s1 === '정재' || s2 === '정재') && (s1 === '정관' || s2 === '정관')) {
        areaModifiers.career += 0.2; areaModifiers.money += 0.15;
        details.push(`${PILLAR_IDX_NAMES[k]}-${PILLAR_IDX_NAMES[k+1]} 재관 시너지`);
      }
    }
    // 충돌 체크
    if (SIPSEONG_CLASH[s1]?.includes(s2) || SIPSEONG_CLASH[s2]?.includes(s1)) {
      structuralScore -= 0.3;
      if ((s1 === '상관' || s2 === '상관') && (s1 === '정관' || s2 === '정관')) {
        areaModifiers.career -= 0.2;
        details.push(`${PILLAR_IDX_NAMES[k]}-${PILLAR_IDX_NAMES[k+1]} 상관견관 충돌`);
      }
      if ((s1 === '겁재' || s2 === '겁재') && (s1 === '정재' || s2 === '정재')) {
        areaModifiers.money -= 0.2;
        details.push(`${PILLAR_IDX_NAMES[k]}-${PILLAR_IDX_NAMES[k+1]} 겁재탈재 충돌`);
      }
      if ((s1 === '편인' || s2 === '편인') && (s1 === '식신' || s2 === '식신')) {
        areaModifiers.study -= 0.15; areaModifiers.health -= 0.1;
        details.push(`${PILLAR_IDX_NAMES[k]}-${PILLAR_IDX_NAMES[k+1]} 효신탈식`);
      }
    }
  }

  // ── (9) 음양 조화도 분석 ──
  // 천간 음양 균형 (이상: 2양2음), 지지 음양 균형
  let yangGanCount = 0;
  let yangJiCount = 0;
  for (const p of pillars) {
    const ganIdx = CHEONGAN.indexOf(p.gan as typeof CHEONGAN[number]);
    if (ganIdx >= 0 && ganIdx % 2 === 0) yangGanCount++;
    const jiIdx = JIJI.indexOf(p.ji as typeof JIJI[number]);
    if (jiIdx >= 0 && jiIdx % 2 === 0) yangJiCount++;
  }
  // 천간 음양 균형 (2:2 최적, 4:0 또는 0:4 최악)
  const ganYinYangDev = Math.abs(yangGanCount - 2); // 0=최적, 2=최악
  if (ganYinYangDev === 0) {
    structuralScore += 0.2;
    areaModifiers.health += 0.1;
  } else if (ganYinYangDev >= 2) {
    structuralScore -= 0.2;
    areaModifiers.health -= 0.1;
    details.push(`천간 음양 편중(양${yangGanCount}:음${4-yangGanCount})`);
  }
  // 지지 음양 균형
  const jiYinYangDev = Math.abs(yangJiCount - 2);
  if (jiYinYangDev === 0) {
    structuralScore += 0.15;
  } else if (jiYinYangDev >= 2) {
    structuralScore -= 0.15;
    details.push(`지지 음양 편중(양${yangJiCount}:음${4-yangJiCount})`);
  }

  // ── (10) 각 주 천간↔지지(내부) 관계 분석 ──
  // 각 주 내부의 천간-지지가 조화롭지(생/비화) vs 갈등(극)인지
  for (let pi4 = 0; pi4 < 4; pi4++) {
    const gOh = pillars[pi4].ganOh;
    const jOh = pillars[pi4].jiOh;
    const pName = PILLAR_IDX_NAMES[pi4];
    if (gOh === jOh) {
      // 비화: 내부 조화
      if (gOh === yongsin) { structuralScore += 0.15; }
      else if (gOh === gisin) { structuralScore -= 0.1; }
    } else if (OHAENG_SANGSAENG[jOh] === gOh) {
      // 지지가 천간을 생 → 지지가 천간을 지원 (좋음)
      structuralScore += 0.2;
      if (gOh === yongsin) areaModifiers.career += 0.05;
    } else if (OHAENG_SANGSAENG[gOh] === jOh) {
      // 천간이 지지를 생 → 에너지 누출
      structuralScore += 0.1;
    } else if (OHAENG_SANGGEUK[gOh] === jOh) {
      // 천간극지지: 위에서 아래를 누름 → 약한 갈등
      structuralScore -= 0.1;
      if (pi4 === 2) areaModifiers.love -= 0.05; // 일주 내부 갈등 = 배우자 관계 약간 불리
    } else if (OHAENG_SANGGEUK[jOh] === gOh) {
      // 지지극천간: 아래에서 위를 공격 → 강한 갈등 (절각살 유사)
      structuralScore -= 0.2;
      if (pi4 === 2) { areaModifiers.love -= 0.1; areaModifiers.health -= 0.05; }
      if (pi4 === 0) { areaModifiers.study -= 0.05; } // 연주 절각 → 유년기 어려움
      details.push(`${pName}주 지극천(${jOh}극${gOh}): 내부 갈등`);
    }
  }

  // ── (11) 운이 특정 주를 직접 타겟팅하는 분석 ──
  // 운의 천간/지지가 특정 원국 주와 합/충/생/극할 때 그 주 영역에 직접 영향
  if (runGanOh || runJiOh) {
    const CHEONGAN_HAP_PAIR2: Record<string, string> = {
      '갑': '기', '기': '갑', '을': '경', '경': '을',
      '병': '신', '신': '병', '정': '임', '임': '정',
      '무': '계', '계': '무',
    };
    // 운 vs 각 주
    for (let pi5 = 0; pi5 < 4; pi5++) {
      const pName = PILLAR_IDX_NAMES[pi5];
      const pillarGanOh = pillars[pi5].ganOh;
      const pillarJiOh = pillars[pi5].jiOh;

      // 운 천간 → 각 주 천간 관계
      if (runGanOh) {
        // 운이 해당 주 천간의 용신을 생
        if (OHAENG_SANGSAENG[runGanOh] === pillarGanOh && pillarGanOh === yongsin) {
          runActivation += 0.15;
          if (pi5 === 0) areaModifiers.study += 0.1;
          if (pi5 === 1) { areaModifiers.career += 0.1; areaModifiers.money += 0.05; }
          if (pi5 === 3) { areaModifiers.health += 0.05; }
        }
        // 운이 해당 주 천간의 기신을 극
        if (OHAENG_SANGGEUK[runGanOh] === pillarGanOh && pillarGanOh === gisin) {
          runActivation += 0.15;
          if (pi5 === 1) areaModifiers.career += 0.1;
          details.push(`운이 ${pName}간 기신(${pillarGanOh}) 제압`);
        }
        // 운이 해당 주 천간의 용신을 극 (나쁨)
        if (OHAENG_SANGGEUK[runGanOh] === pillarGanOh && pillarGanOh === yongsin) {
          runActivation -= 0.2;
          if (pi5 === 1) areaModifiers.career -= 0.1;
          if (pi5 === 2) areaModifiers.love -= 0.1;
        }
      }

      // 운 천간이 원국 천간과 합
      if (runJiji && CHEONGAN_HAP_PAIR2[pillars[pi5].gan]) {
        // 운 지지가 원국 지지와 관계는 이미 (4)에서 분석됨
      }

      // 운 지지 → 각 주 지지 직접 관계
      if (runJiji) {
        // 운 지지가 해당 주 지지와 육합
        if (YUKHAP_MAP[runJiji] === pillars[pi5].ji) {
          runActivation += 0.2;
          if (pi5 === 2) { areaModifiers.love += 0.15; } // 일지와 합 = 배우자궁 활성화
          if (pi5 === 1) { areaModifiers.career += 0.1; } // 월지와 합 = 직업궁 활성화
          if (pi5 === 0) { areaModifiers.study += 0.1; } // 년지와 합 = 학업궁 활성화
          if (pi5 === 3) { areaModifiers.health += 0.1; } // 시지와 합 = 건강궁 활성화
          details.push(`운(${runJiji})↔${pName}지(${pillars[pi5].ji}) 육합`);
        }
        // 운 지지가 해당 주 지지와 충
        if (CHUNG_MAP[runJiji] === pillars[pi5].ji) {
          runActivation -= 0.2;
          if (pi5 === 2) { areaModifiers.love -= 0.15; areaModifiers.health -= 0.1; }
          if (pi5 === 1) { areaModifiers.career -= 0.15; }
          if (pi5 === 0) { areaModifiers.study -= 0.1; }
          if (pi5 === 3) { areaModifiers.health -= 0.15; }
          details.push(`운(${runJiji})↔${pName}지(${pillars[pi5].ji}) 충`);
        }
        // 운 지지가 해당 주 지지와 형
        if (HYUNG_MAP[runJiji]?.includes(pillars[pi5].ji)) {
          runActivation -= 0.1;
          areaModifiers.health -= 0.05;
          if (pi5 === 2) areaModifiers.love -= 0.05;
        }
      }
    }

    // 운이 삼합을 완성하는지 체크 (원국 2개 + 운 1개 = 삼합 완성)
    if (runJiji) {
      for (const group of SAMHAP_GROUPS) {
        const wonCount = group.filter(g => allJijis.includes(g)).length;
        if (wonCount === 2 && group.includes(runJiji)) {
          const SAMHAP_RESULT2: Record<string, Ohaeng> = {
            '신자진': '수', '해묘미': '목', '인오술': '화', '사유축': '금',
          };
          const resultOh = SAMHAP_RESULT2[group.join('')];
          if (resultOh === yongsin) {
            runActivation += 0.5;
            areaModifiers.career += 0.15;
            areaModifiers.money += 0.1;
            details.push(`운(${runJiji})이 삼합 완성(→${resultOh}=용신)`);
          } else if (resultOh === gisin) {
            runActivation -= 0.3;
            details.push(`운(${runJiji})이 삼합 완성(→${resultOh}=기신)`);
          } else {
            runActivation += 0.2;
          }
        }
      }
      // 운이 방합을 완성하는지 체크
      for (const [group, resultOh] of BANGHAP) {
        const wonCount = group.filter(g => allJijis.includes(g)).length;
        if (wonCount === 2 && group.includes(runJiji)) {
          if (resultOh === yongsin) {
            runActivation += 0.4;
            details.push(`운(${runJiji})이 방합 완성(→${resultOh}=용신)`);
          } else if (resultOh === gisin) {
            runActivation -= 0.25;
          }
        }
      }
    }
  }

  // ── (12) 지장간 간 교차 분석 ── 인접 주 지장간 본기 간 상호작용
  for (let pi6 = 0; pi6 < 3; pi6++) {
    const jg_i = JIJI_JANGGAN[pillars[pi6].ji];
    const jg_j = JIJI_JANGGAN[pillars[pi6 + 1].ji];
    if (!jg_i?.length || !jg_j?.length) continue;
    const bongi_i_oh = CHEONGAN_OHAENG[jg_i[0]];
    const bongi_j_oh = CHEONGAN_OHAENG[jg_j[0]];
    if (!bongi_i_oh || !bongi_j_oh) continue;

    if (OHAENG_SANGSAENG[bongi_i_oh] === bongi_j_oh) {
      // 앞 주 지장간 본기가 뒷 주 본기를 생
      if (bongi_j_oh === yongsin) {
        structuralScore += 0.15;
        if (pi6 === 0) areaModifiers.study += 0.05; // 연→월 지장간 상생 = 학업 기반
        if (pi6 === 1) areaModifiers.career += 0.05; // 월→일 지장간 상생 = 직업↔자아 조화
        if (pi6 === 2) areaModifiers.love += 0.05; // 일→시 지장간 상생 = 배우자↔자녀 원만
      }
    } else if (OHAENG_SANGGEUK[bongi_i_oh] === bongi_j_oh) {
      if (bongi_j_oh === yongsin) {
        structuralScore -= 0.15;
        if (pi6 === 1) areaModifiers.career -= 0.05;
      } else if (bongi_j_oh === gisin) {
        structuralScore += 0.1; // 기신 지장간이 극당함 = 좋음
      }
    }
  }

  return {
    relations,
    structuralScore: Math.round(structuralScore * 100) / 100,
    areaModifiers: {
      study: Math.round(areaModifiers.study * 100) / 100,
      money: Math.round(areaModifiers.money * 100) / 100,
      love: Math.round(areaModifiers.love * 100) / 100,
      health: Math.round(areaModifiers.health * 100) / 100,
      career: Math.round(areaModifiers.career * 100) / 100,
    },
    runActivation: Math.round(runActivation * 100) / 100,
    details,
  };
}

// ========== 4주 가족관계(궁위) 복합 해석 생성 ==========

/**
 * 대운/세운이 원국 4주 각각과 맺는 관계를 **가족 관점**으로 복합 분석한다.
 *
 * ■ 분석 레이어:
 *   L1: 궁위 기반 (년주=조상, 월주=부모, 일주=배우자, 시주=자녀)
 *   L2: 십성 기반 육친 (정인=어머니, 편재=아버지, 정재=아내, 정관=남편/자식 등)
 *   L3: 지장간 교차 (궁위 속 숨은 십성이 운에 의해 자극될 때)
 *   L4: 삼합·방합 (운이 원국 2주와 합세하여 가족궁 변화)
 *   L5: 복합 관계 (충+합 동시, 충이 기존 합을 해소, 형+충 복합)
 *
 * @returns familyNotes: string[] — 2~3문장씩 풀어쓴 가족관계 메모 배열
 */
export function analyzeFamilyRelations(
  saju: SajuResult,
  runGan: string,
  runJi: string,
  startAge?: number,
  includeWonGuk: boolean = true,
): string[] {
  const notes: string[] = [];
  const runGanOh = CHEONGAN_OHAENG[runGan];
  const runJiOh = JIJI_OHAENG[runJi];
  const yongsin = saju.yongsin;
  const gisin = saju.gisin;
  const isMale = saju.gender === 'male';

  const CHUNG_MAP_F: Record<string, string> = {
    '자': '오', '오': '자', '축': '미', '미': '축',
    '인': '신', '신': '인', '묘': '유', '유': '묘',
    '진': '술', '술': '진', '사': '해', '해': '사',
  };
  const YUKHAP_MAP_F: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };
  const HYUNG_MAP_F: Record<string, string[]> = {
    '인': ['사', '신'], '사': ['인', '신'], '신': ['인', '사'],  // 무례지형
    '축': ['술', '미'], '술': ['축', '미'], '미': ['축', '술'],  // 무은지형
    '자': ['묘'], '묘': ['자'],                                    // 상형지형
    '진': ['진'], '오': ['오'], '유': ['유'], '해': ['해'],        // 자형(自刑)
  };
  const CHEONGAN_HAP_F: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을',
    '병': '신', '신': '병', '정': '임', '임': '정',
    '무': '계', '계': '무',
  };
  // 삼합 그룹 (지지 3개 → 결과 오행)
  const SAMHAP_GROUPS_F: [string[], Ohaeng][] = [
    [['신', '자', '진'], '수'], [['해', '묘', '미'], '목'],
    [['인', '오', '술'], '화'], [['사', '유', '축'], '금'],
  ];

  // ── 운의 천간 십성 계산 ──
  const runSipseong = calculateSipseong(saju.ilgan, runGan);
  // 운 지장간의 본기 십성
  const runJanggan = JIJI_JANGGAN[runJi] || [];
  const runBongiSip = runJanggan.length > 0 ? calculateSipseong(saju.ilgan, runJanggan[0]) : null;

  // ── 십성 → 가족 인물 매핑 (성별 차등, 전통 사주학 기준) ──
  // 편(偏)=음양 같음=같은 성별, 정(正)=음양 다름=다른 성별
  const sipToFamily = (sip: string): string => {
    if (sip === '정인') return '어머니';
    if (sip === '편인') return '계모/의부/편모';
    if (sip === '편재') return '아버지';  // 남녀 공통
    if (sip === '정재') return isMale ? '아내' : '';  // 여성에게 정재는 직접적 가족관계 없음
    if (sip === '정관') return isMale ? '자녀(딸)' : '남편';  // 정(正)=다른 성별
    if (sip === '편관') return isMale ? '자녀(아들)' : '연인/재혼상대';  // 편(偏)=같은 성별
    if (sip === '식신') return isMale ? '장인/장모' : '자녀(딸)';  // 여: 편=같은 성별=딸
    if (sip === '상관') return isMale ? '외조모' : '자녀(아들)';  // 여: 정=다른 성별=아들
    if (sip === '비견') return isMale ? '형제/친구' : '자매/친구';
    if (sip === '겁재') return isMale ? '이복형제/경쟁자' : '이복자매/경쟁자';
    return '';
  };

  // 4궁위 정보 (천간 십성 추가)
  const gungwi = [
    { name: '년주', label: '조상/가문', idx: 0, gan: saju.year.cheongan, ji: saju.year.jiji, ganOh: saju.year.cheonganOhaeng, jiOh: saju.year.jijiOhaeng },
    { name: '월주', label: '부모', idx: 1, gan: saju.month.cheongan, ji: saju.month.jiji, ganOh: saju.month.cheonganOhaeng, jiOh: saju.month.jijiOhaeng },
    { name: '일주', label: '나/배우자', idx: 2, gan: saju.day.cheongan, ji: saju.day.jiji, ganOh: CHEONGAN_OHAENG[saju.ilgan], jiOh: saju.day.jijiOhaeng },
    { name: '시주', label: '자식/말년', idx: 3, gan: saju.hour.cheongan, ji: saju.hour.jiji, ganOh: saju.hour.cheonganOhaeng, jiOh: saju.hour.jijiOhaeng },
  ];

  // 각 궁위 천간의 십성과 지장간 십성 미리 계산
  const gungwiSipseong = gungwi.map(g => {
    const ganSip = g.idx === 2 ? '비견' : calculateSipseong(saju.ilgan, g.gan); // 일간은 비견(자기자신)
    const janggan = JIJI_JANGGAN[g.ji] || [];
    const jangganSips = janggan.map(jg => calculateSipseong(saju.ilgan, jg));
    return { ganSip, jangganSips, janggan };
  });

  // 시기에 따라 어떤 궁위가 더 중요한지 결정
  const age = startAge ?? 30;
  const phaseWeight = age <= 15 ? [1.2, 0.8, 0.5, 0.3]
    : age <= 30 ? [0.6, 1.2, 0.8, 0.5]
    : age <= 50 ? [0.4, 0.7, 1.2, 0.8]
    : [0.3, 0.5, 0.7, 1.2];

  // ══════════════════════════════════════════
  // L1 + L2: 궁위 기반 + 십성 육친 복합 분석
  // ══════════════════════════════════════════
  for (let i = 0; i < 4; i++) {
    const g = gungwi[i];
    const w = phaseWeight[i];
    if (w < 0.4 && i !== 2) continue;

    const subNotes: string[] = [];
    const gSip = gungwiSipseong[i];
    const ganFamily = sipToFamily(gSip.ganSip); // 이 궁위 천간이 나에게 어떤 가족인지

    // ── 지지 충 + 십성 교차 (궁위 천간의 가족 정체 + 지장간 숨은 가족 통합) ──
    if (CHUNG_MAP_F[runJi] === g.ji) {
      // 궁위 지장간에 숨은 가족 십성이 충을 받으면 그 가족에게 영향
      const hiddenFamilies = gSip.jangganSips.map(s => sipToFamily(s)).filter(f => f);
      // 궁위 천간의 가족도 포함
      const ganFam = ganFamily;
      const allFamilies = ganFam ? [ganFam, ...hiddenFamilies] : hiddenFamilies;
      const uniqueFamilies = [...new Set(allFamilies)].slice(0, 2);
      const familyText = uniqueFamilies.length > 0 ? ` ${uniqueFamilies.join('·')}에게 직접적 영향이 갑니다.` : '';

      // 운의 십성도 고려: 충이지만 운 자체가 좋은 가족 십성이면 "충격 속 전환"
      const runFam = sipToFamily(runSipseong);
      const isRunPositiveFamily = (runSipseong === '정인' || runSipseong === '정재' || runSipseong === '식신' || runSipseong === '정관');

      if (i === 0) {
        const isYong = g.jiOh === yongsin;
        const isGi = g.jiOh === gisin;
        if (isYong) {
          subNotes.push(`조상궁(년지 ${g.ji})이 충을 받아 가문의 도움이 흔들립니다.${familyText}`);
        } else if (isGi) {
          subNotes.push(`조상궁(년지 ${g.ji})이 충을 받지만 기신 자리이므로, 묵은 가족 갈등이 해소되는 전환점이 될 수 있습니다.${familyText}`);
        } else {
          subNotes.push(`조상궁(년지 ${g.ji})이 충을 받아 가문·조상 관련 변동이 생깁니다. 집안 행사나 가족 관계에서 크고 작은 변화가 있을 수 있습니다.${familyText}`);
        }
      } else if (i === 1) {
        // 월주 천간 십성에 따라 구체적 가족 특정
        const parentPerson = gSip.ganSip === '정인' ? '어머니' : gSip.ganSip === '편재' ? '아버지' : gSip.ganSip === '편인' ? '계모/편모' : '부모님';
        const parentAdvice = gSip.ganSip === '정인' ? ' 어머니 건강에 각별히 신경 쓰세요.' : gSip.ganSip === '편재' ? ' 아버지 재정이나 건강 상태를 살펴보세요.' : '';
        if (isRunPositiveFamily && runFam) {
          subNotes.push(`부모궁(월지 ${g.ji})이 충을 받아 ${parentPerson}과의 관계에 변동이 있지만, 운에 ${runSipseong}(${runFam}) 기운이 있어 위기 속 전환의 기회도 있습니다.${parentAdvice}`);
        } else {
          subNotes.push(`부모궁(월지 ${g.ji})이 충을 받아 ${parentPerson}과의 관계에 변화가 오는 시기입니다.${parentAdvice}${familyText}`);
        }
      } else if (i === 2) {
        const spouseNote = isMale
          ? (gSip.jangganSips.includes('정재') ? ' 일지에 정재(아내)가 있어 아내와의 관계에 직접적 변동이 예상됩니다.' : '')
          : (gSip.jangganSips.includes('정관') ? ' 일지에 정관(남편)이 있어 남편과의 관계에 직접적 변동이 예상됩니다.' : '');
        subNotes.push(`배우자궁(일지 ${g.ji})이 충을 받아 부부간 갈등이 심해지기 쉽습니다. 대화로 풀어가세요.${spouseNote}`);
      } else {
        if (saju.hasChildren) {
          // 시주 지장간에서 구체적 자녀 타입 확인
          const childSips = isMale
            ? gSip.jangganSips.filter(s => s === '정관' || s === '편관')
            : gSip.jangganSips.filter(s => s === '식신' || s === '상관');
          const childDetail = childSips.length > 0
            ? ` 특히 ${childSips.map(s => sipToFamily(s)).filter(f => f).join('·')}과의 갈등에 주의하세요.`
            : '';
          subNotes.push(`자녀궁(시지 ${g.ji})이 충을 받아 자녀와의 관계에 긴장이 생깁니다.${childDetail}`);
        } else {
          subNotes.push(`자녀궁(시지 ${g.ji})이 충을 받아 미래 계획에 변동이 생기기 쉽습니다. 장기 계획을 점검하세요.`);
        }
      }
    }

    // ── 지지 육합 + 십성 교차 ──
    if (YUKHAP_MAP_F[runJi] === g.ji) {
      if (i === 0) {
        subNotes.push(`조상궁(년지 ${g.ji})과 육합이 형성되어 가문·친척과의 유대가 깊어집니다. 집안 어른의 도움이 큰 힘이 되며, 가족 행사를 통해 화합의 기운이 생깁니다.`);
      } else if (i === 1) {
        const parentHapNote = gSip.ganSip === '정인' ? ' 어머니와 특히 마음이 통하는 시기입니다.' : (gSip.ganSip === '편재' ? ' 아버지와의 관계가 좋아지고 아버지의 도움을 받을 수 있습니다.' : '');
        subNotes.push(`부모궁(월지 ${g.ji})과 육합이 형성되어 부모님과의 관계가 돈독해집니다. 부모님의 지원이나 사회적 인맥을 통해 좋은 기회가 올 수 있습니다.${parentHapNote}`);
      } else if (i === 2) {
        subNotes.push(`배우자궁(일지 ${g.ji})과 육합이 형성되어 부부 사이가 좋아지거나, 미혼이라면 좋은 인연을 만날 가능성이 높습니다. 함께하는 시간이 행복감을 키워줍니다.`);
      } else {
        subNotes.push(saju.hasChildren
          ? `자녀궁(시지 ${g.ji})과 육합이 형성되어 자녀와의 관계가 화목해집니다. 자녀의 성장이나 성취에서 기쁨을 느낄 수 있습니다.`
          : `자녀궁(시지 ${g.ji})과 육합이 형성되어 미래 계획이 순조롭게 풀립니다.`);
      }
    }

    // ── 지지 형(刑) — 유형별 세분화 ──
    if (HYUNG_MAP_F[runJi]?.includes(g.ji)) {
      // 형(刑) 유형 판별
      const MURYEJI = new Set(['인', '사', '신']); // 무례지형(無禮之刑): 예의를 잃는 형
      const MUEUNJI = new Set(['축', '술', '미']); // 무은지형(無恩之刑): 은혜를 잊는 형
      const SANGHYUNG: Record<string, string> = { '자': '묘', '묘': '자' }; // 상형지형(相刑之刑): 무례한 형벌
      const JAHYUNG = new Set(['진', '오', '유', '해']); // 자형(自刑): 스스로를 해치는 형

      let hyungType = '';
      let hyungDesc = '';
      if (MURYEJI.has(runJi) && MURYEJI.has(g.ji)) {
        hyungType = '무례지형(無禮之刑)';
        hyungDesc = '예의와 배려가 무너지기 쉬워 말실수·감정폭발에 주의하세요.';
      } else if (MUEUNJI.has(runJi) && MUEUNJI.has(g.ji)) {
        hyungType = '무은지형(無恩之刑)';
        hyungDesc = '가까운 사이일수록 고마움을 잊기 쉬운 때입니다. 감사 표현이 약이 됩니다.';
      } else if (SANGHYUNG[runJi] === g.ji) {
        hyungType = '상형지형(相刑之刑)';
        hyungDesc = '서로 무례함이 오가기 쉬우니 예절과 경계를 지키세요.';
      } else if (JAHYUNG.has(runJi) && runJi === g.ji) {
        hyungType = '자형(自刑)';
        hyungDesc = '스스로를 괴롭히는 경향이 강해지니 자기비판보다 자기돌봄에 집중하세요.';
      } else {
        hyungType = '형(刑)';
        hyungDesc = '갈등이나 마찰에 주의하세요.';
      }

      const posLabel = ['조상궁(년지)', '부모궁(월지)', '배우자궁(일지)', '자녀궁(시지)'][i];
      if (i === 0) subNotes.push(`${posLabel} ${g.ji}에 ${hyungType}이 걸립니다. 가문 내 시비나 법적 분쟁에 주의하세요. ${hyungDesc}`);
      else if (i === 1) subNotes.push(`${posLabel} ${g.ji}에 ${hyungType}이 걸립니다. 부모님과의 관계에서 ${hyungDesc}`);
      else if (i === 2) subNotes.push(`${posLabel} ${g.ji}에 ${hyungType}이 걸립니다. 부부간 ${hyungDesc}`);
      else subNotes.push(saju.hasChildren
        ? `${posLabel} ${g.ji}에 ${hyungType}이 걸립니다. 자녀와의 관계에서 ${hyungDesc}`
        : `${posLabel} ${g.ji}에 ${hyungType}이 걸립니다. 미래 계획에 ${hyungDesc}`);
    }

    // ── 천간합 + 십성 교차 ──
    const hasGanHap = CHEONGAN_HAP_F[runGan] === g.gan;
    if (hasGanHap) {
      if (i === 0) subNotes.push(`운의 천간(${runGan})이 조상궁 천간(${g.gan}, ${sipToFamily(gSip.ganSip) || gSip.ganSip})과 합을 이루어 가문의 기운이 나에게 힘이 됩니다.`);
      else if (i === 1) {
        const parentType = ganFamily || '부모';
        subNotes.push(`운의 천간(${runGan})이 부모궁 천간(${g.gan}, ${parentType})과 합을 이루어 ${parentType}과(와) 뜻이 잘 맞는 시기입니다. 가업이나 부모님 사업에서 좋은 결과를 기대할 수 있습니다.`);
      }
      else if (i === 2) subNotes.push(`운의 천간(${runGan})이 일간(${g.gan})과 합을 이루어 새로운 인연이나 파트너십이 형성됩니다. 결혼·동업 등 인생의 중요한 만남이 있을 수 있습니다.`);
      else subNotes.push(saju.hasChildren
        ? `운의 천간(${runGan})이 자녀궁 천간(${g.gan})과 합을 이루어 자녀와 마음이 통합니다. 자녀의 꿈을 함께 응원하면 좋은 성과가 있을 수 있습니다.`
        : `운의 천간(${runGan})이 시주 천간(${g.gan})과 합을 이루어 미래 비전이 구체화됩니다.`);
    }

    // ── 천간 상극 (합이 있으면 스킵) ──
    if (runGanOh && OHAENG_SANGGEUK[runGanOh] === g.ganOh && !hasGanHap) {
      if (i === 1) {
        // 월주 천간 십성으로 구체적 가족 특정
        const parentPerson = gSip.ganSip === '정인' ? '어머니' : gSip.ganSip === '편재' ? '아버지' : gSip.ganSip === '편인' ? '계모/편모' : ganFamily || '부모님';
        subNotes.push(`운이 부모궁 천간(${g.gan}, ${parentPerson})을 극하여 ${parentPerson}과(와) 갈등이 생기거나 어려운 일이 있을 수 있습니다.`);
      }
      else if (i === 0) {
        const ancestorPerson = ganFamily || '조상/가문';
        subNotes.push(`운이 조상궁 천간(${g.gan}, ${ancestorPerson})을 극하여 ${ancestorPerson} 쪽 도움이 줄어듭니다.`);
      }
      else if (i === 3) {
        const childPerson = ganFamily || (saju.hasChildren ? '자녀' : '미래 계획');
        subNotes.push(saju.hasChildren
          ? `운이 자녀궁 천간(${g.gan}, ${childPerson})을 극하여 ${childPerson} 관련 어려움이 있을 수 있습니다. 따뜻한 소통이 필요합니다.`
          : `운이 시주 천간을 극하여 미래 계획에 차질이 생길 수 있습니다.`);
      }
    }

    // ── 천간 상생 ──
    if (runGanOh && OHAENG_SANGSAENG[runGanOh] === g.ganOh && !hasGanHap) {
      if (i === 1) {
        const parentPerson = gSip.ganSip === '정인' ? '어머니' : gSip.ganSip === '편재' ? '아버지' : ganFamily || '부모님';
        subNotes.push(`운이 부모궁에 생기를 불어넣어 ${parentPerson}의 건강이 호전되거나, ${parentPerson}을(를) 통해 좋은 기회가 올 수 있습니다.`);
      }
      else if (i === 0) {
        const ancestorPerson = ganFamily || '가문·친척';
        subNotes.push(`운이 조상궁에 생기를 불어넣어 ${ancestorPerson}의 도움이 들어옵니다.`);
      }
      else if (i === 3) {
        const childPerson = ganFamily || (saju.hasChildren ? '자녀' : '미래');
        subNotes.push(saju.hasChildren
          ? `운이 자녀궁에 생기를 불어넣어 ${childPerson}의 학업이나 진로에 좋은 소식이 있을 수 있습니다.`
          : `운이 시주에 생기를 불어넣어 미래 계획이 순조롭습니다.`);
      }
    }

    if (subNotes.length > 0) {
      notes.push(...subNotes);
    }
  }

  // ══════════════════════════════════════════
  // L2: 운의 십성으로 본 가족 관계 변화
  // ══════════════════════════════════════════
  const runFamily = sipToFamily(runSipseong);
  if (runFamily) {
    // 인성이 들어오면 → 어머니/스승 관련
    if (runSipseong === '정인') {
      notes.push(`이 시기 운에 정인(正印)이 들어와 어머니의 기운이 강해집니다. 어머니의 도움이나 학문적 스승의 인도가 큰 힘이 되며, 공부·자격증에 유리합니다. 어머니와의 유대가 깊어지는 시기입니다.`);
    } else if (runSipseong === '편인') {
      notes.push(`이 시기 운에 편인(偏印)이 들어와 비전통적인 학문이나 종교·철학적 스승과의 인연이 생길 수 있습니다. 다만 식신을 극하므로(도식) ${isMale ? '장인·장모와의 관계가 멀어지거나' : '자녀(딸)와의 관계에서 갈등이 생기거나'} 소화 기능이 약해질 수 있습니다.`);
    }
    // 재성이 들어오면 → 아버지/아내 관련
    else if (runSipseong === '편재') {
      notes.push(`이 시기 운에 편재(偏財)가 들어와 아버지와의 관계에 변화가 있을 수 있습니다. 아버지의 재정 상황에 변동이 오거나, 아버지를 통해 새로운 기회가 열릴 수 있습니다.${isMale ? ' 이성과의 만남도 활발해지는 시기입니다.' : ''}`);
    } else if (runSipseong === '정재') {
      if (isMale) {
        notes.push(`이 시기 운에 정재(正財)가 들어와 아내와의 관계가 좋아지거나, 미혼이라면 결혼 인연이 다가올 수 있습니다. 안정적인 재물이 들어오며, 가정에 따뜻한 기운이 감돕니다.`);
      }
    }
    // 관성이 들어오면 → 남편(여)/자녀(남) 관련
    else if (runSipseong === '정관') {
      if (!isMale) {
        notes.push(`이 시기 운에 정관(正官)이 들어와 남편과의 관계가 안정되거나, 미혼이라면 결혼 인연이 다가옵니다. 직장에서도 안정적인 위치를 잡을 수 있는 시기입니다.`);
      } else if (saju.hasChildren) {
        notes.push(`이 시기 운에 정관(正官)이 들어와 자녀(특히 딸)에게 좋은 일이 생기거나, 자녀와의 관계가 안정됩니다. 직장에서의 승진·인정도 기대할 수 있습니다.`);
      }
    } else if (runSipseong === '편관') {
      if (!isMale) {
        notes.push(`이 시기 운에 편관(偏官·칠살)이 들어와 이성관계에 변화가 올 수 있습니다. 기혼이라면 남편과의 갈등에 주의하고, 미혼이라면 강렬한 만남이 있을 수 있지만 신중해야 합니다.`);
      } else if (saju.hasChildren) {
        notes.push(`이 시기 운에 편관(偏官)이 들어와 자녀(특히 아들)와의 관계에서 권위적 충돌이 생기기 쉽습니다. 자녀의 반항이나 독립심이 강해질 수 있으니 열린 대화가 중요합니다.`);
      }
    }
    // 식상이 들어오면 → 자녀(여)/장인장모(남) 관련
    else if (runSipseong === '식신' || runSipseong === '상관') {
      if (!isMale && saju.hasChildren) {
        const isShikshin = runSipseong === '식신';
        const childType = isShikshin ? '딸' : '아들';
        notes.push(`이 시기 운에 ${runSipseong}이 들어와 자녀(특히 ${childType})에 대한 관심이 커지는 시기입니다. ${isShikshin ? '자녀와 평화로운 시간이 많아지고, 교육적으로도 좋은 성과가 있을 수 있습니다.' : '자녀를 향한 기대가 높아지기 쉬우니, 있는 그대로 인정해주는 것이 관계에 도움이 됩니다.'}`);
      } else if (isMale && runSipseong === '식신') {
        notes.push(`이 시기 운에 식신(食神)이 들어와 장인·장모 또는 윗세대와의 관계가 좋아지는 시기입니다. 표현력이 풍부해지고 대인관계가 원만해집니다.`);
      } else if (isMale && runSipseong === '상관') {
        notes.push(`이 시기 운에 상관(傷官)이 들어와 기존 질서에 반발하는 기운이 강해집니다. 외조모·윗세대 어른과의 관계에 변화가 있을 수 있으며, 윗사람과의 마찰에 주의하고 자유로운 표현을 건설적으로 활용하세요.`);
      }
    }
    // 비겁이 들어오면 → 형제/친구 관련
    else if (runSipseong === '비견' || runSipseong === '겁재') {
      const isGood = runSipseong === '비견';
      const siblingType = isMale ? '형제' : '자매';
      notes.push(`이 시기 운에 ${runSipseong}이 들어와 ${siblingType}·친구·동료와의 관계가 ${isGood ? '활발해집니다. 오래된 친구와의 재회나 협력이 좋은 결과를 가져올 수 있습니다.' : '복잡해질 수 있습니다. 금전 거래는 피하고, 경쟁적 상황에서 감정 조절이 중요합니다.'}`);
    }
  }

  // ══════════════════════════════════════════
  // L3: 지장간 교차 (궁위 속 숨은 가족 십성이 운에 의해 자극)
  // ══════════════════════════════════════════
  // 운의 천간 오행이 원국 궁위 지장간의 가족 십성과 상호작용
  // 본기(첫번째 지장간)가 가장 강한 영향
  // L1에서 이미 다룬 궁위의 충/합과 모순되지 않도록 체크
  const l1Chung = new Set<number>(); // L1에서 충이 발생한 궁위 인덱스
  const l1Hap = new Set<number>();   // L1에서 합이 발생한 궁위 인덱스
  for (let i = 0; i < 4; i++) {
    if (CHUNG_MAP_F[runJi] === gungwi[i].ji) l1Chung.add(i);
    if (YUKHAP_MAP_F[runJi] === gungwi[i].ji) l1Hap.add(i);
  }

  for (let i = 0; i < 4; i++) {
    const g = gungwi[i];
    const gSip = gungwiSipseong[i];
    const w = phaseWeight[i];
    if (w < 0.4 && i !== 2) continue; // 일주(배우자궁)는 항상 분석

    for (let j = 0; j < gSip.jangganSips.length; j++) {
      const hiddenSip = gSip.jangganSips[j];
      const hiddenGan = gSip.janggan[j];
      const hiddenOh = CHEONGAN_OHAENG[hiddenGan];
      const hiddenFamily = sipToFamily(hiddenSip);
      if (!hiddenFamily || !hiddenOh) continue;

      const isBongi = j === 0; // 본기(사령)이면 영향력 더 강함
      const bongiTag = isBongi ? '(본기) ' : '';

      // 운이 숨은 가족 십성을 극하는 경우
      if (runGanOh && OHAENG_SANGGEUK[runGanOh] === hiddenOh) {
        // L1에서 이미 합으로 좋다고 했는데 지장간 극을 말하면 모순 → 스킵
        if (l1Hap.has(i)) continue;

        if (hiddenSip === '정인' && i <= 1) {
          notes.push(`${g.name} 지장간에 ${bongiTag}숨어있는 정인(어머니) 기운을 운이 극합니다. 어머니 건강이나 심리적 상태에 변화가 올 수 있으니 안부를 살피세요.`);
        } else if (hiddenSip === '편재' && i <= 1) {
          notes.push(`${g.name} 지장간에 ${bongiTag}숨어있는 편재(아버지) 기운을 운이 극합니다. 아버지의 재정이나 건강에 변동이 있을 수 있습니다.`);
        } else if (hiddenSip === '정관' && !isMale && i === 2) {
          notes.push(`일주 지장간에 ${bongiTag}숨어있는 정관(남편) 기운을 운이 극합니다. 남편과의 관계에 변화가 예상됩니다.`);
        } else if (hiddenSip === '정재' && isMale && i === 2) {
          notes.push(`일주 지장간에 ${bongiTag}숨어있는 정재(아내) 기운을 운이 극합니다. 아내와의 관계에 변화가 예상됩니다.`);
        } else if ((hiddenSip === '식신' || hiddenSip === '상관') && !isMale && i === 3 && saju.hasChildren) {
          notes.push(`시주 지장간에 ${bongiTag}숨어있는 ${hiddenSip}(${hiddenFamily}) 기운을 운이 극합니다. 자녀와의 소통에 어려움이 올 수 있습니다.`);
        } else if ((hiddenSip === '편관' || hiddenSip === '정관') && isMale && i === 3 && saju.hasChildren) {
          notes.push(`시주 지장간에 ${bongiTag}숨어있는 ${hiddenSip}(${hiddenFamily}) 기운을 운이 극합니다. 자녀의 진로나 학업에서 변동이 있을 수 있습니다.`);
        }
      }
      // 운이 숨은 가족 십성을 생하는 경우
      if (runGanOh && OHAENG_SANGSAENG[runGanOh] === hiddenOh) {
        // L1에서 충으로 나쁘다고 했는데 지장간 생을 말하면 모순 → 스킵
        if (l1Chung.has(i)) continue;

        if (hiddenSip === '정인' && i <= 1 && isBongi) {
          notes.push(`${g.name} 지장간 본기의 정인(어머니) 기운을 운이 생해줍니다. 어머니 건강이 호전되거나, 어머니를 통한 좋은 소식이 있을 수 있습니다.`);
        } else if (hiddenSip === '편재' && i <= 1 && isBongi) {
          notes.push(`${g.name} 지장간 본기의 편재(아버지) 기운을 운이 생해줍니다. 아버지로부터 도움이나 좋은 소식이 올 수 있습니다.`);
        } else if (hiddenSip === '정관' && !isMale && i === 2 && isBongi) {
          notes.push(`일주 지장간 본기의 정관(남편) 기운을 운이 생해줍니다. 남편과의 관계가 좋아지거나 남편의 사업·직장에 좋은 일이 있을 수 있습니다.`);
        } else if (hiddenSip === '정재' && isMale && i === 2 && isBongi) {
          notes.push(`일주 지장간 본기의 정재(아내) 기운을 운이 생해줍니다. 아내와의 관계가 좋아지거나 가정에 좋은 일이 있을 수 있습니다.`);
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // L4: 삼합 교차 (운이 원국 2주와 삼합을 완성)
  // ══════════════════════════════════════════
  const allJijis = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  for (const [group, resultOh] of SAMHAP_GROUPS_F) {
    const wonMembers = group.filter(g => allJijis.includes(g));
    if (wonMembers.length === 2 && group.includes(runJi)) {
      // 운이 삼합을 완성
      const memberPositions = wonMembers.map(m => {
        const idx = allJijis.indexOf(m);
        return ['년주(조상)', '월주(부모)', '일주(배우자)', '시주(자녀)'][idx];
      });
      const isYong = resultOh === yongsin;
      const isGi = resultOh === gisin;
      if (isYong) {
        notes.push(`운(${runJi})이 ${memberPositions.join('·')}과 삼합을 완성하여 용신(${resultOh}) 기운이 활성화됩니다. 가족 전체에 좋은 기운이 흐르며, 특히 ${memberPositions.join('과 ')} 관련 가족에게 경사가 있을 수 있습니다.`);
      } else if (isGi) {
        notes.push(`운(${runJi})이 ${memberPositions.join('·')}과 삼합을 완성하지만 기신(${resultOh}) 방향이라 가족관계에 복잡한 변화가 올 수 있습니다. ${memberPositions.join('과 ')} 관련 가족 사이에서 의견 조율이 필요합니다.`);
      }
    }
  }

  // ══════════════════════════════════════════
  // L5: 복합 관계 (운이 기존 원국 합을 충으로 깨트리거나, 충을 합으로 해소)
  // ══════════════════════════════════════════
  // 일지-시지 합이 있는데 운이 일지를 충 → 부부-자녀 동시 영향
  if (YUKHAP_MAP_F[saju.day.jiji] === saju.hour.jiji && CHUNG_MAP_F[runJi] === saju.day.jiji) {
    notes.push(`원국에서 일지(${saju.day.jiji})와 시지(${saju.hour.jiji})의 육합이 있었는데, 운이 일지를 충하여 이 합이 깨질 수 있습니다. ${saju.hasChildren ? '배우자와 자녀 사이의 조화가 흔들릴 수 있으니, 가족 간 소통에 더 신경 쓰세요.' : '배우자와의 안정적 관계에 변동이 올 수 있으니 대화를 통해 풀어가세요.'}`);
  }
  // 월지-일지 충이 있는데 운이 통관(通關) 역할
  if (CHUNG_MAP_F[saju.month.jiji] === saju.day.jiji) {
    const monthOh = saju.month.jijiOhaeng;
    const dayOh = saju.day.jijiOhaeng;
    // 운 오행이 둘 사이를 중재하면
    if ((OHAENG_SANGSAENG[monthOh] === runJiOh && OHAENG_SANGSAENG[runJiOh] === dayOh) ||
        (OHAENG_SANGSAENG[dayOh] === runJiOh && OHAENG_SANGSAENG[runJiOh] === monthOh)) {
      notes.push(`원국에서 월지(부모궁)와 일지(배우자궁)가 충이었는데, 이 시기 운(${runJi})이 통관(通關) 역할을 합니다. 부모님과 배우자 사이의 오래된 갈등이 완화되거나, 내가 중재자로서 양쪽을 화해시킬 수 있는 좋은 시기입니다.`);
    }
  }

  // ══════════════════════════════════════════
  // L6: 반합(半合) — 삼합 중 2글자만 있는 경우 (운+원국 1주)
  // 완전한 삼합보다 약하지만 잠재적 영향
  // ══════════════════════════════════════════
  for (const [group, resultOh] of SAMHAP_GROUPS_F) {
    if (!group.includes(runJi)) continue;
    // 운+원국 1주 = 반합 (삼합 2/3)
    for (let i = 0; i < 4; i++) {
      const sj = allJijis[i];
      if (!group.includes(sj) || sj === runJi) continue;
      // 원국에 삼합의 나머지 1개가 있는지 확인 → 있으면 이미 L4 삼합에서 처리됨
      const thirdMember = group.find(g => g !== runJi && g !== sj);
      if (thirdMember && allJijis.includes(thirdMember)) continue; // 삼합 완성 = L4에서 이미 처리

      const posLabel = ['년주(조상)', '월주(부모)', '일주(배우자)', '시주(자녀)'][i];
      const familyLabel = [
        sipToFamily(gungwiSipseong[0].ganSip) || '조상/가문',
        sipToFamily(gungwiSipseong[1].ganSip) || '부모',
        '배우자',
        saju.hasChildren ? '자녀' : '미래',
      ][i];
      const isYong = resultOh === yongsin;
      const isGi = resultOh === gisin;

      if (isYong) {
        notes.push(`운(${runJi})과 ${posLabel}(${sj})이 반합(${resultOh}·용신 방향)을 형성합니다. ${familyLabel} 쪽에서 잠재적 도움이 올 수 있으나, 삼합이 완성되지 않아 조건이 갖춰져야 현실화됩니다.`);
      } else if (isGi) {
        notes.push(`운(${runJi})과 ${posLabel}(${sj})이 반합(${resultOh}·기신 방향)을 형성합니다. ${familyLabel} 관련 잠재적 불안 요소가 있으니 미리 대비하세요.`);
      }
    }
  }

  // ══════════════════════════════════════════
  // L6-2: 방합(方合) — 동일 방위 3지지가 모이면 강력한 오행 결집
  // 인묘진=동방목, 사오미=남방화, 신유술=서방금, 해자축=북방수
  // ══════════════════════════════════════════
  const BANGHAP_GROUPS: [string[], Ohaeng, string][] = [
    [['인', '묘', '진'], '목', '동방(봄)'],
    [['사', '오', '미'], '화', '남방(여름)'],
    [['신', '유', '술'], '금', '서방(가을)'],
    [['해', '자', '축'], '수', '북방(겨울)'],
  ];
  for (const [group, resultOh, direction] of BANGHAP_GROUPS) {
    if (!group.includes(runJi)) continue;
    const wonMembers = group.filter(g => allJijis.includes(g));
    if (wonMembers.length >= 2) {
      // 운이 방합을 완성 (원국 2개 + 운 1개 = 3개)
      const fullSet = new Set([...wonMembers, runJi]);
      if (fullSet.size >= 3 && group.every(g => fullSet.has(g))) {
        const memberPositions = wonMembers.map(m => {
          const idx = allJijis.indexOf(m);
          return ['년주(조상)', '월주(부모)', '일주(배우자)', '시주(자녀)'][idx];
        });
        const isYong = resultOh === yongsin;
        const isGi = resultOh === gisin;
        if (isYong) {
          notes.push(`운(${runJi})이 ${memberPositions.join('·')}과 ${direction} 방합을 완성하여 용신(${resultOh}) 기운이 크게 강화됩니다. 가족 전체에 안정과 번영의 기운이 흐릅니다.`);
        } else if (isGi) {
          notes.push(`운(${runJi})이 ${memberPositions.join('·')}과 ${direction} 방합을 완성하여 기신(${resultOh}) 기운이 강해집니다. 가족 전체에 영향을 미치는 변화에 대비하세요.`);
        } else {
          notes.push(`운(${runJi})이 ${memberPositions.join('·')}과 ${direction} 방합을 완성합니다. ${resultOh} 기운이 집중되어 관련 가족에게 큰 변화가 올 수 있습니다.`);
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // L7: 암합(暗合) — 궁위 지장간과 운 지장간 사이의 천간합
  // 겉으로 드러나지 않는 은밀한 가족 인연/변화
  // ══════════════════════════════════════════
  const runJangganList = JIJI_JANGGAN[runJi] || [];
  for (let i = 0; i < 4; i++) {
    const g = gungwi[i];
    const gSip = gungwiSipseong[i];
    const gJanggan = gSip.janggan;
    if (gJanggan.length === 0) continue;

    for (const rjg of runJangganList) {
      for (let j = 0; j < gJanggan.length; j++) {
        const gjg = gJanggan[j];
        // 지장간끼리 천간합이 성립하면 = 암합
        if (CHEONGAN_HAP_F[rjg] === gjg) {
          const hiddenSip = gSip.jangganSips[j];
          const hiddenFamily = sipToFamily(hiddenSip);
          const posLabel = ['조상궁(년주)', '부모궁(월주)', '배우자궁(일주)', '자녀궁(시주)'][i];

          if (i === 2) {
            notes.push(`운과 ${posLabel}의 지장간이 암합(暗合)을 이룹니다. 겉으로 드러나지 않는 배우자와의 깊은 교감이나 은밀한 인연이 활성화되는 시기입니다.`);
          } else if (i === 1 && hiddenFamily) {
            notes.push(`운과 ${posLabel}의 지장간이 암합을 이룹니다. 부모님(특히 ${hiddenFamily}) 쪽에서 예상치 못한 도움이나 인연이 생길 수 있습니다.`);
          } else if (i === 3) {
            notes.push(`운과 ${posLabel}의 지장간이 암합을 이룹니다. ${saju.hasChildren ? '자녀와의 보이지 않는 유대가 깊어지거나, 자녀를 통한 숨은 인연이 열립니다.' : '미래에 대한 숨겨진 기회가 서서히 드러나는 시기입니다.'}`);
          } else if (i === 0) {
            notes.push(`운과 ${posLabel}의 지장간이 암합을 이룹니다. 가문이나 집안 어른 쪽에서 예기치 않은 은덕이 있을 수 있습니다.`);
          }
          break; // 궁위당 암합 1개만 보고
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // L8: 쟁합(爭合)/투합(妬合) — 운 천간이 원국 기존 천간합을 방해
  // 예: 원국에 갑-기 합 → 운에 또 갑이 오면 쟁합
  // ══════════════════════════════════════════
  const wonGans = [saju.year.cheongan, saju.month.cheongan, saju.day.cheongan, saju.hour.cheongan];
  const wonGanLabels = ['년간(조상)', '월간(부모)', '일간(나)', '시간(자녀)'];
  // 원국 내 기존 천간합 찾기
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      if (CHEONGAN_HAP_F[wonGans[a]] === wonGans[b]) {
        // 원국 a-b 천간합이 있음
        // 운 천간이 a 또는 b와 같은 글자면 → 쟁합
        if (runGan === wonGans[a] || runGan === wonGans[b]) {
          const targetGan = runGan === wonGans[a] ? wonGans[b] : wonGans[a];
          const targetIdx = runGan === wonGans[a] ? b : a;
          const partnerIdx = runGan === wonGans[a] ? a : b;
          const targetFamily = sipToFamily(gungwiSipseong[targetIdx].ganSip);
          const partnerFamily = sipToFamily(gungwiSipseong[partnerIdx].ganSip);

          if (targetIdx === 2 || partnerIdx === 2) {
            // 일간이 관련된 합이 쟁합 → 배우자/인연 관련
            notes.push(`운의 천간(${runGan})이 원국의 ${wonGanLabels[a]}-${wonGanLabels[b]} 합에 쟁합(爭合)을 겁니다. ${a === 2 || b === 2 ? '제3의 인연이 개입하거나, 기존 관계에 미묘한 변화가 올 수 있습니다.' : '가족 관계에 경쟁적 긴장이 생길 수 있습니다.'}`);
          } else {
            const f1 = partnerFamily || wonGanLabels[partnerIdx];
            const f2 = targetFamily || wonGanLabels[targetIdx];
            notes.push(`운의 천간(${runGan})이 원국의 ${wonGanLabels[a]}-${wonGanLabels[b]} 합에 쟁합을 겁니다. ${f1}과 ${f2} 사이의 조화가 흔들려 가족 내 미묘한 갈등이 생길 수 있습니다.`);
          }
        }
        // 운 천간이 a 또는 b의 합 대상이면 → 투합(질투합)
        // 단, 쟁합과 중복 방지: 운 천간이 이미 a/b와 같으면 스킵 (쟁합에서 처리됨)
        if ((CHEONGAN_HAP_F[runGan] === wonGans[a] || CHEONGAN_HAP_F[runGan] === wonGans[b])
            && runGan !== wonGans[a] && runGan !== wonGans[b]) {
          const attractedIdx = CHEONGAN_HAP_F[runGan] === wonGans[a] ? a : b;
          const leftBehindIdx = attractedIdx === a ? b : a;
          const attractedFamily = sipToFamily(gungwiSipseong[attractedIdx].ganSip);
          const leftFamily = sipToFamily(gungwiSipseong[leftBehindIdx].ganSip);

          if (attractedIdx === 2) {
            notes.push(`운의 천간(${runGan})이 일간(나)과 합하려 하여, 기존 ${wonGanLabels[leftBehindIdx]}와의 결속이 느슨해질 수 있습니다. ${leftFamily ? leftFamily + '과의 관계에 소홀해지지 않도록 주의하세요.' : '가족 관계의 균형에 신경 쓰세요.'}`);
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // L9: 해(害)/파(破) — 육합을 깨뜨리는 관계 + 파괴적 관계
  // ══════════════════════════════════════════
  const JIJI_HAE: Record<string, string> = {
    '자': '미', '미': '자', '축': '오', '오': '축',
    '인': '사', '사': '인', '묘': '진', '진': '묘',
    '신': '해', '해': '신', '유': '술', '술': '유',
  };
  const JIJI_PA: Record<string, string> = {
    '자': '유', '유': '자', '축': '진', '진': '축',
    '인': '해', '해': '인', '묘': '오', '오': '묘',
    '사': '신', '신': '사', '미': '술', '술': '미',
  };

  for (let i = 0; i < 4; i++) {
    const g = gungwi[i];
    const posLabel = ['조상궁(년지)', '부모궁(월지)', '배우자궁(일지)', '자녀궁(시지)'][i];
    const familyLabel = [
      sipToFamily(gungwiSipseong[0].ganSip) || '조상/가문',
      sipToFamily(gungwiSipseong[1].ganSip) || '부모',
      '배우자',
      saju.hasChildren ? '자녀' : '미래',
    ][i];

    // 해(害): 은근한 해침, 속마음의 갈등
    if (JIJI_HAE[runJi] === g.ji) {
      if (i === 2) {
        notes.push(`운(${runJi})과 ${posLabel}(${g.ji})이 해(害) 관계입니다. 배우자와 겉으로는 평온하지만 속으로 서운함이 쌓이기 쉽습니다. 감정을 표현하고 진솔한 대화가 필요합니다.`);
      } else if (i === 1) {
        notes.push(`운(${runJi})과 ${posLabel}(${g.ji})이 해(害) 관계입니다. ${familyLabel}과의 사이에 은근한 불만이 쌓일 수 있습니다. 표면적으로는 괜찮아 보여도 마음의 거리가 생기지 않도록 관심을 기울이세요.`);
      } else if (i === 3) {
        notes.push(`운(${runJi})과 ${posLabel}(${g.ji})이 해 관계입니다. ${saju.hasChildren ? '자녀와 마음이 잘 통하지 않는 시기입니다. 자녀의 속마음을 들어보는 시간을 가지세요.' : '미래 계획에 보이지 않는 걸림돌이 있을 수 있습니다.'}`);
      } else {
        notes.push(`운(${runJi})과 ${posLabel}(${g.ji})이 해 관계입니다. 집안 어른이나 가문 쪽에서 은근한 갈등이 있을 수 있습니다.`);
      }
    }

    // 파(破): 깨뜨림, 기존 질서의 파괴
    if (JIJI_PA[runJi] === g.ji) {
      if (i === 2) {
        notes.push(`운(${runJi})과 ${posLabel}(${g.ji})이 파(破) 관계입니다. 부부간 기존의 약속이나 합의가 깨지기 쉽습니다. 중요한 결정은 서로 충분히 논의 후 진행하세요.`);
      } else if (i === 1) {
        notes.push(`운(${runJi})과 ${posLabel}(${g.ji})이 파 관계입니다. 부모님과의 기존 관계 패턴에 변화가 오거나, 부모님 쪽 상황이 재편될 수 있습니다.`);
      } else if (i === 3 && saju.hasChildren) {
        notes.push(`운(${runJi})과 ${posLabel}(${g.ji})이 파 관계입니다. 자녀와의 기존 약속이나 계획이 틀어지기 쉽습니다. 유연하게 대처하세요.`);
      }
    }
  }

  // ══════════════════════════════════════════
  // L10: 궁위 간 연쇄 반응 (운이 복수 궁위에 동시 영향)
  // ══════════════════════════════════════════
  // 충+합 동시: 운이 한 궁위와 충이면서 다른 궁위와 합
  const chungIdxs: number[] = [];
  const hapIdxs: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (CHUNG_MAP_F[runJi] === allJijis[i]) chungIdxs.push(i);
    if (YUKHAP_MAP_F[runJi] === allJijis[i]) hapIdxs.push(i);
  }

  if (chungIdxs.length > 0 && hapIdxs.length > 0) {
    const chungLabels = chungIdxs.map(i => ['년주(조상)', '월주(부모)', '일주(배우자)', '시주(자녀)'][i]);
    const hapLabels = hapIdxs.map(i => ['년주(조상)', '월주(부모)', '일주(배우자)', '시주(자녀)'][i]);

    // 충과 합이 서로 다른 궁위일 때 → 한쪽 갈등이 다른 쪽 화합으로 보상
    const chungFamilies = chungIdxs.map(i => [sipToFamily(gungwiSipseong[i].ganSip) || '조상', sipToFamily(gungwiSipseong[i].ganSip) || '부모', '배우자', saju.hasChildren ? '자녀' : '미래'][i]);
    const hapFamilies = hapIdxs.map(i => [sipToFamily(gungwiSipseong[i].ganSip) || '조상', sipToFamily(gungwiSipseong[i].ganSip) || '부모', '배우자', saju.hasChildren ? '자녀' : '미래'][i]);

    notes.push(`운(${runJi})이 ${chungLabels.join('·')}과 충이면서 ${hapLabels.join('·')}과 합을 이룹니다. ${chungFamilies.join('·')} 쪽 갈등이 있지만 ${hapFamilies.join('·')} 쪽에서 위안과 힘을 얻는 구조입니다. 흔들리는 관계에 집착하기보다 화합하는 관계에 에너지를 쏟으세요.`);
  }

  // 충 2개 이상: 운이 복수 궁위를 동시에 충 → 가족 전체 변동기
  if (chungIdxs.length >= 2) {
    const labels = chungIdxs.map(i => ['년주(조상)', '월주(부모)', '일주(배우자)', '시주(자녀)'][i]);
    notes.push(`운(${runJi})이 ${labels.join('·')}을 동시에 충합니다. 가족 전반에 큰 변동이 오는 해입니다. 이사·이직·가족 재편 등 구조적 변화에 대비하되, 가족 간 결속을 다지는 계기로 삼으세요.`);
  }

  // 형+충 동시: 같은 궁위에 형과 충이 겹침
  for (let i = 0; i < 4; i++) {
    const g = gungwi[i];
    const hasChung = CHUNG_MAP_F[runJi] === g.ji;
    const hasHyung = HYUNG_MAP_F[runJi]?.includes(g.ji);
    if (hasChung && hasHyung) {
      const posLabel = ['조상궁', '부모궁', '배우자궁', '자녀궁'][i];
      notes.push(`${posLabel}에 충과 형이 겹쳐 이중 타격입니다. 이 궁위 관련 가족에게 건강·사고·법적 문제 등에 각별히 주의가 필요합니다.`);
    }
  }

  // ══════════════════════════════════════════
  // 원국 4주 간 고유 가족관계 (대운 description에만 포함)
  // ══════════════════════════════════════════
  // 노트 과다 방지: 세운/타임라인은 최대 8개, 중요도 높은 것(궁위 충/합)이 앞에 배치됨
  if (!includeWonGuk) return notes.slice(0, 8);

  // 연-월 (조상→부모)
  if (CHUNG_MAP_F[saju.year.jiji] === saju.month.jiji) {
    const yearGanSip = calculateSipseong(saju.ilgan, saju.year.cheongan);
    const monthGanSip = calculateSipseong(saju.ilgan, saju.month.cheongan);
    notes.push(`원국에서 년지(${saju.year.jiji})와 월지(${saju.month.jiji})가 충입니다. ${sipToFamily(yearGanSip) || '조상'}과 ${sipToFamily(monthGanSip) || '부모'}의 기운이 부딪혀, 어린 시절 가정환경에 변화가 많았거나 조부모-부모 간 갈등이 있었을 수 있습니다. 이 시기에 그 영향이 드러날 수 있으니 가족 화합에 신경 쓰세요.`);
  } else if (YUKHAP_MAP_F[saju.year.jiji] === saju.month.jiji) {
    notes.push(`원국에서 년지(${saju.year.jiji})와 월지(${saju.month.jiji})가 합이므로, 가문과 부모의 기운이 조화롭습니다. 이 시기에 가족의 도움이 자연스럽게 흘러들어 옵니다.`);
  }

  // 일-시 (본인→자식)
  if (CHUNG_MAP_F[saju.day.jiji] === saju.hour.jiji) {
    notes.push(saju.hasChildren
      ? `원국에서 일지(${saju.day.jiji})와 시지(${saju.hour.jiji})가 충이므로, 자녀와의 관계에서 갈등이 반복되기 쉬운 구조입니다. 자녀의 독립성을 인정하고 존중으로 풀어가세요.`
      : `원국에서 일지(${saju.day.jiji})와 시지(${saju.hour.jiji})가 충이므로, 말년이나 미래 계획에 변동이 잦을 수 있습니다.`);
  } else if (YUKHAP_MAP_F[saju.day.jiji] === saju.hour.jiji) {
    notes.push(saju.hasChildren
      ? `원국에서 일지(${saju.day.jiji})와 시지(${saju.hour.jiji})가 합이므로, 자녀와 천생 궁합입니다. 자녀와 함께하는 활동이 서로에게 큰 행복을 가져다 줍니다.`
      : `원국에서 일지(${saju.day.jiji})와 시지(${saju.hour.jiji})가 합이므로, 미래 비전과 현재 행동이 잘 맞아떨어집니다.`);
  }

  // 월-시 (부모→자식)
  if (CHUNG_MAP_F[saju.month.jiji] === saju.hour.jiji) {
    notes.push(saju.hasChildren
      ? `원국에서 월지(${saju.month.jiji})와 시지(${saju.hour.jiji})가 충이므로, 부모님과 자녀 사이에서 중재 역할이 필요합니다. 세대 간 가치관 차이를 이해하고 다리가 되어주세요.`
      : `원국에서 월지(${saju.month.jiji})와 시지(${saju.hour.jiji})가 충이므로, 직장생활과 미래 준비 사이에서 균형을 잡아야 합니다.`);
  }

  // 연-시 (조상→자녀) — 먼 관계지만 의미 있음
  if (YUKHAP_MAP_F[saju.year.jiji] === saju.hour.jiji) {
    notes.push(saju.hasChildren
      ? `원국에서 년지(${saju.year.jiji})와 시지(${saju.hour.jiji})가 합이므로, 조상의 덕이 자녀에게 이어지는 좋은 구조입니다. 가문의 전통이 자녀를 통해 빛날 수 있습니다.`
      : `원국에서 년지(${saju.year.jiji})와 시지(${saju.hour.jiji})가 합이므로, 과거의 경험이 미래 계획에 도움이 되는 좋은 구조입니다.`);
  } else if (CHUNG_MAP_F[saju.year.jiji] === saju.hour.jiji) {
    notes.push(saju.hasChildren
      ? `원국에서 년지(${saju.year.jiji})와 시지(${saju.hour.jiji})가 충이므로, 가문의 전통과 자녀의 가치관이 부딪힐 수 있습니다. 새로운 시대에 맞는 유연한 가족 문화를 만들어가세요.`
      : `원국에서 년지(${saju.year.jiji})와 시지(${saju.hour.jiji})가 충이므로, 과거와 미래 사이에서 방향을 정해야 할 때가 있습니다.`);
  }

  // 대운용은 최대 12개
  return notes.slice(0, 12);
}

// ========== 시기별 맥락 + 궁위(宮位) 심층 분석 ==========

/**
 * 인생 시기별 맥락 분석
 *
 * 대운의 나이에 따라 해당 시기에 중요한 영역의 가중치를 차등 적용하고,
 * 원국의 궁위(宮位) 상태를 시기별로 세밀하게 분석한다.
 *
 * ■ 시기 구분:
 *   유년기(0~15): 학업 최우선, 연주 영향 극대, 인성·식상 건재 여부 핵심
 *   청년기(16~30): 학업+직업 전환기, 월주 영향 극대, 관성·재성 중요
 *   중년기(31~50): 직업+재물+가정, 일주 영향 극대, 재성·관성·배우자궁
 *   노년기(51~): 건강+자녀+결실, 시주 영향 극대, 건강·인성
 *
 * ■ 궁위(宮位) 분석:
 *   연주 = 조상궁, 월주 = 부모궁/직업궁, 일지 = 배우자궁, 시주 = 자녀궁
 *
 * ■ 추가 세부 분석:
 *   - 인성 건재/재극인(財剋印) → 학업 판별
 *   - 학당귀인/문창귀인 → 학업 유리
 *   - 배우자궁(일지) 상태 → 결혼시기/배우자운
 *   - 재물궁(월주 재성/시주) → 재물축적/손재 패턴
 *   - 건강 취약 오행/장기 매핑
 *   - 식상생재 흐름 존재 여부
 *   - 관인상생 구조 존재 여부
 */
export interface LifePhaseAnalysis {
  phase: '유년기' | '청년기' | '중년기' | '노년기';
  areaWeights: { study: number; money: number; love: number; health: number; career: number };
  // 궁위 상태 분석
  educationQuality: number;     // 학업 환경 질 (-2 ~ +2)
  spouseQuality: number;        // 배우자궁 질 (-2 ~ +2)
  wealthStructure: number;      // 재물 구조 질 (-2 ~ +2)
  healthVulnerability: number;  // 건강 취약도 (0 ~ 3, 높을수록 취약)
  careerFoundation: number;     // 직업 기반 질 (-2 ~ +2)
  // 세부 분석 결과
  details: string[];
  areaBonus: { study: number; money: number; love: number; health: number; career: number };
}

export function analyzeLifePhaseContext(
  saju: SajuResult,
  age: number,
  runGanOh?: Ohaeng,
  runJiOh?: Ohaeng,
  runJiji?: string,
): LifePhaseAnalysis {
  const ilOhaeng = CHEONGAN_OHAENG[saju.ilgan];
  const yongsin = saju.yongsin;
  const gisin = saju.gisin;
  const details: string[] = [];
  const areaBonus = { study: 0, money: 0, love: 0, health: 0, career: 0 };

  // ── 시기 구분 ──
  let phase: LifePhaseAnalysis['phase'];
  let areaWeights: LifePhaseAnalysis['areaWeights'];
  if (age <= 15) {
    phase = '유년기';
    areaWeights = { study: 1.5, money: 0.3, love: 0.2, health: 1.0, career: 0.3 };
  } else if (age <= 30) {
    phase = '청년기';
    areaWeights = { study: 1.2, money: 0.8, love: 1.0, health: 0.7, career: 1.2 };
  } else if (age <= 50) {
    phase = '중년기';
    areaWeights = { study: 0.5, money: 1.3, love: 1.0, health: 1.0, career: 1.3 };
  } else {
    phase = '노년기';
    areaWeights = { study: 0.4, money: 0.8, love: 0.6, health: 1.8, career: 0.5 };
  }

  // ═══════════════════════════════════════════
  // ① 인성(印星) 건재 분석 → 학업 판별
  // ═══════════════════════════════════════════
  const inOhaeng = Object.entries(OHAENG_SANGSAENG).find(([, v]) => v === ilOhaeng)![0] as Ohaeng;
  const bal = saju.ohaengBalance;
  const total = Object.values(bal).reduce((a, b) => a + b, 0) || 1;
  const inBalance = (bal[inOhaeng] || 0) / total;

  // 인성이 원국에 있는지 (천간/지지)
  const wonGans = [saju.year.cheongan, saju.month.cheongan, saju.hour.cheongan];
  const wonGanOhs = [saju.year.cheonganOhaeng, saju.month.cheonganOhaeng, saju.hour.cheonganOhaeng];
  const wonJiOhs = [saju.year.jijiOhaeng, saju.month.jijiOhaeng, saju.day.jijiOhaeng, saju.hour.jijiOhaeng];

  let inseongCount = 0; // 인성 천간 개수
  let jeongInExists = false;
  let pyeonInExists = false;
  for (let k = 0; k < wonGans.length; k++) {
    const sip = calculateSipseong(saju.ilgan, wonGans[k]);
    if (sip === '정인') { inseongCount++; jeongInExists = true; }
    if (sip === '편인') { inseongCount++; pyeonInExists = true; }
  }
  // 지지 지장간에서도 인성 탐색
  const wonJijis = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  for (const ji of wonJijis) {
    const jg = JIJI_JANGGAN[ji];
    if (jg) {
      for (const g of jg) {
        const sip = calculateSipseong(saju.ilgan, g);
        if (sip === '정인' || sip === '편인') inseongCount++;
      }
    }
  }

  // 재극인(財剋印): 재성이 인성을 극하는 구조
  const jaeOhaeng = OHAENG_SANGGEUK[ilOhaeng]; // 일간이 극하는 오행 = 재성 오행
  const jaeBalance = (bal[jaeOhaeng] || 0) / total;
  const isJaeGeukIn = jaeBalance > 0.2 && inBalance < 0.15; // 재성 과잉 + 인성 부족

  let educationQuality = 0;
  if (jeongInExists) {
    educationQuality += 0.8;
    details.push('정인 존재: 정규교육 순조');
  }
  if (pyeonInExists && !jeongInExists) {
    educationQuality += 0.3;
    details.push('편인만 존재: 비정규/특수 학업 경향');
  }
  if (inseongCount === 0) {
    educationQuality -= 0.8;
    details.push('인성 부재: 학업 기회 부족 우려');
  }
  if (isJaeGeukIn) {
    educationQuality -= 0.7;
    details.push('재극인(財剋印): 재물 환경이 학업을 방해');
    areaBonus.study -= 0.3;
  }
  if (inBalance < 0.05) {
    educationQuality -= 0.5;
    details.push('인성 오행 극도 부족: 학업 중단 위험');
  }

  // 식상의 학업 영향: 식신은 지적 호기심(긍정), 상관은 반항(부정)
  let siksangStudyMod = 0;
  for (const g of wonGans) {
    const sip = calculateSipseong(saju.ilgan, g);
    if (sip === '식신') siksangStudyMod += 0.3;
    if (sip === '상관') siksangStudyMod -= 0.2;
  }
  // 상관견관: 상관이 정관을 극 → 학교 규율과 충돌
  const hasJeongGwan = wonGans.some(g => calculateSipseong(saju.ilgan, g) === '정관');
  const hasSangGwan = wonGans.some(g => calculateSipseong(saju.ilgan, g) === '상관');
  if (hasJeongGwan && hasSangGwan) {
    educationQuality -= 0.4;
    details.push('상관견관: 학교 규율과 충돌 → 중퇴/전학 우려');
    areaBonus.study -= 0.2;
  }
  educationQuality += siksangStudyMod;

  // ② 학당귀인(學堂貴人) / 문창귀인(文昌貴人) 체크
  // 학당: 일간의 장생지 = 학당
  const JANGSEONG_JI: Record<string, string> = {
    '갑': '해', '을': '오', '병': '인', '정': '유', '무': '인',
    '기': '유', '경': '사', '신': '자', '임': '신', '계': '묘',
  };
  // 문창: 일간 기준 (갑→사, 을→오, 병→신, 정→유, 무→신, 기→유, 경→해, 신→자, 임→인, 계→묘)
  const MUNCHANG_JI: Record<string, string> = {
    '갑': '사', '을': '오', '병': '신', '정': '유', '무': '신',
    '기': '유', '경': '해', '신': '자', '임': '인', '계': '묘',
  };

  const hakdangJi = JANGSEONG_JI[saju.ilgan] || '';
  const munchangJi = MUNCHANG_JI[saju.ilgan] || '';

  // 원국에 학당/문창이 있는지
  const hasHakdang = wonJijis.includes(hakdangJi);
  const hasMunchang = wonJijis.includes(munchangJi);
  if (hasHakdang) {
    educationQuality += 0.5;
    details.push(`학당귀인(${hakdangJi}): 학업에 천부적 재능`);
    areaBonus.study += 0.3;
  }
  if (hasMunchang) {
    educationQuality += 0.5;
    details.push(`문창귀인(${munchangJi}): 시험운·문서운 유리`);
    areaBonus.study += 0.3;
  }

  // 운이 학당/문창을 가져오는지
  if (runJiji) {
    if (runJiji === hakdangJi) {
      areaBonus.study += 0.4;
      details.push(`운이 학당귀인(${hakdangJi}) 활성화`);
    }
    if (runJiji === munchangJi) {
      areaBonus.study += 0.4;
      details.push(`운이 문창귀인(${munchangJi}) 활성화`);
    }
  }

  // 연주 12운성: 유년기 환경 질
  const yearGanStage = calculateTwelveStage(saju.ilgan, saju.year.jiji);
  const yearStageData = TWELVE_STAGE_DATA[yearGanStage];
  if (yearStageData.energy >= 7) {
    educationQuality += 0.3;
    details.push(`연주 12운성(${yearGanStage}): 유년기 환경 양호`);
  } else if (yearStageData.energy <= 3) {
    educationQuality -= 0.3;
    details.push(`연주 12운성(${yearGanStage}): 유년기 환경 어려움`);
  }

  // 유년기 대운(운이 5~15세)에 기신이 오면 학업 중단 우려
  if (phase === '유년기' && runGanOh) {
    if (runGanOh === gisin || runJiOh === gisin) {
      educationQuality -= 0.5;
      areaBonus.study -= 0.3;
      details.push('유년기 대운에 기신: 학업 환경 불안정');
    }
    if (runGanOh === yongsin || runJiOh === yongsin) {
      educationQuality += 0.3;
      areaBonus.study += 0.2;
      details.push('유년기 대운에 용신: 학업 환경 순조');
    }
  }

  educationQuality = Math.round(Math.max(-2, Math.min(2, educationQuality)) * 100) / 100;

  // ═══════════════════════════════════════════
  // ③ 배우자궁(일지) 심층분석
  // ═══════════════════════════════════════════
  let spouseQuality = 0;
  const dayJiOh = saju.day.jijiOhaeng;
  const dayJiSipseong = calculateSipseong(saju.ilgan, JIJI_JANGGAN[saju.day.jiji]?.[0] || saju.day.jiji);

  // 일지 오행과 일간의 관계
  if (OHAENG_SANGSAENG[dayJiOh] === ilOhaeng) {
    spouseQuality += 0.5; // 일지가 일간을 생 → 배우자 내조/내助
    details.push('일지→일간 상생: 배우자 내조 양호');
  } else if (OHAENG_SANGGEUK[dayJiOh] === ilOhaeng) {
    spouseQuality -= 0.5; // 일지가 일간을 극 → 배우자와 갈등
    details.push('일지→일간 상극: 배우자 갈등 소지');
    areaBonus.love -= 0.2;
  }
  // 일지 본기가 용신이면 배우자가 도움
  if (dayJiOh === yongsin) {
    spouseQuality += 0.6;
    details.push('일지=용신 오행: 배우자가 큰 도움');
    areaBonus.love += 0.2;
  } else if (dayJiOh === gisin) {
    spouseQuality -= 0.4;
    details.push('일지=기신 오행: 배우자 관계 어려움');
    areaBonus.love -= 0.15;
  }
  // 일지가 도화살이면 매력적 배우자
  const DOHWA_SAL_LP: Record<string, string> = {
    '자': '유', '축': '오', '인': '묘', '묘': '자',
    '진': '유', '사': '오', '오': '묘', '미': '자',
    '신': '유', '유': '오', '술': '묘', '해': '자',
  };
  if (saju.day.jiji === DOHWA_SAL_LP[saju.day.jiji]) {
    spouseQuality += 0.3;
    details.push('일지 도화: 매력적 배우자');
  }
  // 일지 공망이면 배우자궁이 빈 상태
  const gmDayJi = checkGongmang(saju.day.cheongan, saju.day.jiji, saju.day.jiji);
  // (공망은 일주 기준이므로 일지 자체는 공망이 아님, 다른 지지 체크)
  // 대신 배우자궁에 충이 있으면 결혼 난항
  const dayJi = saju.day.jiji;
  const CHUNG_MAP_LP: Record<string, string> = {
    '자': '오', '오': '자', '축': '미', '미': '축',
    '인': '신', '신': '인', '묘': '유', '유': '묘',
    '진': '술', '술': '진', '사': '해', '해': '사',
  };
  // 월지↔일지 충 = 직장/환경과 배우자 충돌
  if (CHUNG_MAP_LP[saju.month.jiji] === dayJi) {
    spouseQuality -= 0.4;
    details.push('월지↔일지 충: 직장과 가정 양립 어려움');
    areaBonus.love -= 0.15;
  }
  // 시지↔일지 충 = 자녀와 배우자 갈등
  if (CHUNG_MAP_LP[saju.hour.jiji] === dayJi) {
    spouseQuality -= 0.3;
    details.push('시지↔일지 충: 자녀 출산 후 부부 갈등');
  }
  // 운이 일지와 합 → 결혼 시기
  if (runJiji && runJiji === (({ '자': '축', '축': '자', '인': '해', '해': '인', '묘': '술', '술': '묘', '진': '유', '유': '진', '사': '신', '신': '사', '오': '미', '미': '오' } as Record<string, string>)[dayJi])) {
    spouseQuality += 0.5;
    areaBonus.love += 0.4;
    details.push(`운(${runJiji})↔일지(${dayJi}) 육합: 결혼/인연 시기`);
  }
  // 운이 일지와 충 → 이별/갈등
  if (runJiji && CHUNG_MAP_LP[runJiji] === dayJi) {
    spouseQuality -= 0.5;
    areaBonus.love -= 0.3;
    if (phase === '중년기') areaBonus.love -= 0.2; // 중년기에 일지 충은 더 치명적
    details.push(`운(${runJiji})↔일지(${dayJi}) 충: 배우자 갈등/이별 주의`);
  }

  spouseQuality = Math.round(Math.max(-2, Math.min(2, spouseQuality)) * 100) / 100;

  // ═══════════════════════════════════════════
  // ④ 재물궁 심층분석 — 재성의 구조와 흐름
  // ═══════════════════════════════════════════
  let wealthStructure = 0;
  const jaeCount = wonGanOhs.filter(oh => oh === jaeOhaeng).length;
  // 식상 → 재성 흐름 (식신생재: 기술/재능으로 돈 버는 구조)
  const shikOhaeng = OHAENG_SANGSAENG[ilOhaeng]; // 일간이 생하는 = 식상 오행
  const hasShikSangJaeFlow = (bal[shikOhaeng] || 0) > 0 && (bal[jaeOhaeng] || 0) > 0;
  if (hasShikSangJaeFlow) {
    wealthStructure += 0.5;
    details.push('식상생재 흐름: 기술/재능 기반 재물 축적 구조');
    areaBonus.money += 0.2;
  }

  // 월주에 재성이 있으면 안정적 수입
  const monthGanSip = calculateSipseong(saju.ilgan, saju.month.cheongan);
  if (['정재', '편재'].includes(monthGanSip)) {
    wealthStructure += 0.6;
    details.push(`월간 ${monthGanSip}: 안정적 수입/직장 재물`);
    areaBonus.money += 0.2;
    areaBonus.career += 0.1;
  }
  // 시주에 재성이 있으면 노후 재물
  const hourGanSip = calculateSipseong(saju.ilgan, saju.hour.cheongan);
  if (['정재', '편재'].includes(hourGanSip)) {
    wealthStructure += 0.3;
    details.push(`시간 ${hourGanSip}: 노후 재물 축적`);
    if (phase === '노년기') areaBonus.money += 0.3;
  }

  // 겁재가 강하면 손재(損財) 패턴
  const hasGyeopjae = wonGans.some(g => calculateSipseong(saju.ilgan, g) === '겁재');
  if (hasGyeopjae && jaeCount > 0) {
    wealthStructure -= 0.4;
    details.push('겁재+재성 공존: 들어오는 만큼 나가는 손재 패턴');
    areaBonus.money -= 0.15;
  }

  // 재성이 아예 없으면
  const jaeInJiji = wonJiOhs.filter(oh => oh === jaeOhaeng).length;
  if (jaeCount === 0 && jaeInJiji === 0 && (bal[jaeOhaeng] || 0) < 0.5) {
    wealthStructure -= 0.5;
    details.push('재성 부재: 재물 운 약, 봉급 생활 유리');
    areaBonus.money -= 0.2;
  }

  // 운이 재성 오행을 가져오면
  if (runGanOh === jaeOhaeng || runJiOh === jaeOhaeng) {
    areaBonus.money += 0.3;
    if (phase === '중년기') areaBonus.money += 0.15; // 중년에 재성 운 = 최대 효과
    details.push(`운이 재성(${jaeOhaeng}) 가져옴`);
  }
  // 신약인데 재성 운이면 감당 어려움
  const ss = saju.strengthScore;
  const isSinyak = ss != null ? ss < 35 : (bal[ilOhaeng] || 0) / total < 0.15;
  if (isSinyak && (runGanOh === jaeOhaeng || runJiOh === jaeOhaeng)) {
    areaBonus.money -= 0.2;
    details.push('신약+재성 운: 재물 감당 어려움(과투자 주의)');
  }

  wealthStructure = Math.round(Math.max(-2, Math.min(2, wealthStructure)) * 100) / 100;

  // ═══════════════════════════════════════════
  // ⑤ 건강 취약 분석 — 오행/장기 매핑
  // ═══════════════════════════════════════════
  // 오행별 장기: 목=간/담/눈, 화=심장/소장/혈액, 토=위/비장/근육, 금=폐/대장/피부, 수=신장/방광/귀
  let healthVulnerability = 0;

  // 가장 약한 오행 = 가장 취약한 장기
  const weakest = saju.weakestOhaeng;
  const weakestBal = (bal[weakest] || 0) / total;
  if (weakestBal < 0.05) {
    healthVulnerability += 1.0;
    details.push(`${weakest} 오행 극도 부족: 관련 장기 취약`);
  } else if (weakestBal < 0.1) {
    healthVulnerability += 0.5;
  }

  // 관성(官星) 과잉 = 외부 압박 → 스트레스/건강 위협
  const gwanOhaeng = Object.entries(OHAENG_SANGGEUK).find(([, v]) => v === ilOhaeng)?.[0] as Ohaeng;
  const gwanBal = gwanOhaeng ? (bal[gwanOhaeng] || 0) / total : 0;
  if (gwanBal > 0.25) {
    healthVulnerability += 0.7;
    details.push('관성 과잉: 스트레스성 질환 주의');
    areaBonus.health -= 0.2;
  }

  // 운이 건강 취약 오행을 더 약화시키면
  if (runGanOh && OHAENG_SANGGEUK[runGanOh] === weakest) {
    healthVulnerability += 0.5;
    areaBonus.health -= 0.3;
    details.push(`운이 최약 오행(${weakest}) 상극: 건강 주의`);
  }
  // 운이 취약 오행을 보충하면
  if (runGanOh === weakest || runJiOh === weakest) {
    healthVulnerability -= 0.3;
    areaBonus.health += 0.2;
    details.push(`운이 최약 오행(${weakest}) 보충: 건강 개선`);
  }

  // 노년기에 건강 가중
  if (phase === '노년기') {
    healthVulnerability += 0.3;
    if (gwanBal > 0.2) areaBonus.health -= 0.15;
  }

  healthVulnerability = Math.round(Math.max(0, Math.min(3, healthVulnerability)) * 100) / 100;

  // ═══════════════════════════════════════════
  // ⑥ 직업 기반 분석 — 관인상생/재관 구조
  // ═══════════════════════════════════════════
  let careerFoundation = 0;

  // 관인상생: 관성→인성→일간 (조직에서 인정받고 학업/자격으로 승진)
  const gwanExists = wonGans.some(g => ['정관', '편관'].includes(calculateSipseong(saju.ilgan, g)));
  const inExists = inseongCount > 0;
  if (gwanExists && inExists) {
    careerFoundation += 0.7;
    details.push('관인상생 구조: 조직 내 안정적 승진');
    areaBonus.career += 0.2;
  }

  // 재관: 재성→관성 (재물이 지위를 뒷받침)
  if (jaeCount > 0 && gwanExists) {
    careerFoundation += 0.4;
    details.push('재관 연결: 재력 기반 사회적 지위');
    areaBonus.career += 0.15;
    areaBonus.money += 0.1;
  }

  // 식상생재: 재능/기술로 돈 버는 프리랜서형
  if (hasShikSangJaeFlow && !gwanExists) {
    careerFoundation += 0.3;
    details.push('식상생재(관성 부재): 자영업/프리랜서형');
    areaBonus.career += 0.1;
  }

  // 관성 없으면 조직 생활 어려움
  if (!gwanExists) {
    careerFoundation -= 0.3;
    details.push('관성 부재: 정규 조직보다 자유업 유리');
  }

  // 청년기에 관성 운이면 취직
  if (phase === '청년기' && runGanOh === gwanOhaeng) {
    areaBonus.career += 0.3;
    details.push('청년기+관성 운: 취직/합격 유리');
  }

  // 월주 12운성 = 직업궁의 에너지
  const monthGanStage = calculateTwelveStage(saju.ilgan, saju.month.jiji);
  const monthStageData = TWELVE_STAGE_DATA[monthGanStage];
  if (monthStageData.energy >= 7) {
    careerFoundation += 0.3;
    details.push(`월주 12운성(${monthGanStage}): 직업 기반 탄탄`);
  } else if (monthStageData.energy <= 3) {
    careerFoundation -= 0.3;
    details.push(`월주 12운성(${monthGanStage}): 직업 불안정`);
  }

  careerFoundation = Math.round(Math.max(-2, Math.min(2, careerFoundation)) * 100) / 100;

  // ═══════════════════════════════════════════
  // ⑦ 시기별 추가 보정
  // ═══════════════════════════════════════════
  // 유년기에 연주 충이 있으면 학업 중단 위험 가중
  if (phase === '유년기') {
    if (CHUNG_MAP_LP[saju.year.jiji] === saju.month.jiji) {
      areaBonus.study -= 0.3;
      details.push('연지↔월지 충: 유년기 가정환경 변동(전학/이사)');
    }
    // 연주에 편관이면 유년기 엄한 환경
    const yearSip = calculateSipseong(saju.ilgan, saju.year.cheongan);
    if (yearSip === '편관') {
      areaBonus.study -= 0.15;
      areaBonus.health -= 0.1;
      details.push('연간 편관: 유년기 엄격한 환경/압박');
    }
    if (yearSip === '정인') {
      areaBonus.study += 0.3;
      details.push('연간 정인: 유년기 교육 환경 우수');
    }
  }

  // 청년기에 역마살 대운이면 유학/해외 활동
  if (phase === '청년기' && runJiji) {
    const YEOKMA_LP: Record<string, string> = {
      '자': '인', '축': '해', '인': '신', '묘': '사',
      '진': '인', '사': '해', '오': '신', '미': '사',
      '신': '인', '유': '해', '술': '신', '해': '사',
    };
    if (YEOKMA_LP[saju.day.jiji] === runJiji || YEOKMA_LP[saju.year.jiji] === runJiji) {
      areaBonus.study += 0.2;
      areaBonus.career += 0.15;
      details.push('청년기 역마 대운: 유학/해외취업 유리');
    }
  }

  // 중년기에 도화살 대운이면 외도 주의 vs 사교성 향상
  if (phase === '중년기' && runJiji) {
    const DOHWA_LP2: Record<string, string> = {
      '자': '유', '축': '오', '인': '묘', '묘': '자',
      '진': '유', '사': '오', '오': '묘', '미': '자',
      '신': '유', '유': '오', '술': '묘', '해': '자',
    };
    if (DOHWA_LP2[saju.day.jiji] === runJiji) {
      areaBonus.love += 0.2;
      details.push('중년기 도화 대운: 연애/사교 활발(외도 주의)');
    }
  }

  // 노년기에 인성 운이면 건강/정신 안정
  if (phase === '노년기' && (runGanOh === inOhaeng || runJiOh === inOhaeng)) {
    areaBonus.health += 0.3;
    details.push('노년기 인성 운: 건강 안정/정신적 평온');
  }

  return {
    phase,
    areaWeights,
    educationQuality,
    spouseQuality,
    wealthStructure,
    healthVulnerability,
    careerFoundation,
    details,
    areaBonus,
  };
}

/**
 * 대운 종합 점수 산출 (1~10)
 * ★ 입체적 분석: 12운성 + 희기신 5단계 + 밸런스 변화 + 생극제화 + 원국 상호작용 + 격국
 */
function calculateDaeunScore(
  saju: SajuResult,
  cheongan: string,
  jiji: string,
  cheonganOhaeng: Ohaeng,
  jijiOhaeng: Ohaeng,
  twelveStage: TwelveStage,
  startAge?: number,
): { score: number; areaScores: DaeunAreaScores } {
  const stageData = TWELVE_STAGE_DATA[twelveStage];
  const ilOhaeng = CHEONGAN_OHAENG[saju.ilgan];
  const ilOhBal = saju.ohaengBalance?.[ilOhaeng] || 3;

  // base = 5 (중립)
  let score = 5;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ① 12운성 에너지 보정 (±1.35 범위)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const energyMod = (stageData.energy - 5.5) * 0.3;
  score += energyMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ② 희기신(喜忌神) 5단계 판별 — 단순 용신/기신 이분법 → 5단계
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const ganClass = classifyHeegishin(cheonganOhaeng, saju.yongsin, saju.gisin, ilOhaeng);
  const jiClass = classifyHeegishin(jijiOhaeng, saju.yongsin, saju.gisin, ilOhaeng);

  // 십성 판단
  const daeunSipseong = calculateSipseong(saju.ilgan, cheongan);
  const isJeong = daeunSipseong === '정재' || daeunSipseong === '정관' || daeunSipseong === '정인' || daeunSipseong === '식신';

  // 희기신 가중치 적용 (정계열 길신이면 기신/구신 감점 완화)
  const ganWeight = (ganClass.weight < 0 && isJeong) ? ganClass.weight * 0.5 : ganClass.weight;
  const jiWeight = (jiClass.weight < 0 && isJeong) ? jiClass.weight * 0.5 : jiClass.weight;
  score += ganWeight * 0.75; // 천간 75% 반영
  score += jiWeight * 0.75;  // 지지 75% 반영

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ③ 오행 밸런스 변화 시뮬레이션
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { balanceMod } = simulateBalanceChange(saju.ohaengBalance, cheonganOhaeng, jijiOhaeng);
  score += balanceMod * 0.5; // 대운은 밸런스 영향 50% 반영

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ④ 천간-지지 간 생극제화(生剋制化)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { ganJiMod } = analyzeGanJiRelation(cheonganOhaeng, jijiOhaeng, ilOhaeng);
  score += ganJiMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑤ 원국 글자와의 생극 상호작용
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { interactionMod } = analyzeWonGukInteraction(saju, cheonganOhaeng, jijiOhaeng);
  score += interactionMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑥ 십성 품질 (정계열 보너스 / 흉신 감점)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (daeunSipseong === '정재') score += 0.6;
  else if (daeunSipseong === '정관') score += 0.5;
  else if (daeunSipseong === '정인') score += 0.5;
  else if (daeunSipseong === '식신') score += 0.5;
  else if (daeunSipseong === '편재') score += 0.2;
  else if (daeunSipseong === '편인') score += 0.1;
  else if (daeunSipseong === '겁재') score -= 0.4;
  else if (daeunSipseong === '상관') score -= 0.2;
  else if (daeunSipseong === '편관') score -= 0.2;

  // 천간·지지 동일 십성 시너지
  const jiJanggan = JIJI_JANGGAN[jiji];
  if (jiJanggan && jiJanggan.length > 0) {
    const jiSaryeongGan = jiJanggan[0];
    const jiSipseong = calculateSipseong(saju.ilgan, jiSaryeongGan);
    if (jiSipseong === daeunSipseong) score += 0.6; // 천간·지지 동일 십성 시너지
    if (jiSipseong === '정재' || jiSipseong === '정관' || jiSipseong === '정인' || jiSipseong === '식신') {
      score += 0.2;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑦ 신강/신약 × 십성 교차 보정
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const isBigyeop = daeunSipseong === '비견' || daeunSipseong === '겁재';
  const isInseong = daeunSipseong === '편인' || daeunSipseong === '정인';
  const isSiksang = daeunSipseong === '식신' || daeunSipseong === '상관';
  const isJaeseong = daeunSipseong === '편재' || daeunSipseong === '정재';
  const isGwanseong = daeunSipseong === '편관' || daeunSipseong === '정관';

  const gyeokguk = determineGyeokguk(saju);
  const isJonggyeok = gyeokguk.group === '종격';
  const ss = saju.strengthScore;
  const isSingang = ss != null ? ss >= 40 : ilOhBal >= 4.5;
  const isSinyak = ss != null ? ss < 25 : ilOhBal <= 2.5;

  if (isJonggyeok) {
    if (gyeokguk.type === '종강격') {
      if (isBigyeop) score += 0.5;
      if (isInseong) score += 0.8;
      if (isSiksang || isJaeseong || isGwanseong) score -= 1.0;
    } else if (gyeokguk.type === '종아격') {
      if (isSiksang) score += 0.8;
      if (isJaeseong) score += 0.5;
      if (isBigyeop || isInseong) score -= 1.0;
    } else if (gyeokguk.type === '종재격') {
      if (isJaeseong) score += 0.8;
      if (isSiksang) score += 0.3;
      if (isBigyeop || isInseong) score -= 1.0;
    } else if (gyeokguk.type === '종관격') {
      if (isGwanseong) score += 0.8;
      if (isBigyeop || isInseong) score -= 1.0;
    }
  } else {
    if (isSingang) {
      if (isBigyeop) score -= 0.4;
      if (isInseong) score -= 0.2;
      if (isSiksang) score += 0.4;
      if (isJaeseong) score += 0.4;
      if (isGwanseong && daeunSipseong === '정관') score += 0.3;
    }
    if (isSinyak) {
      if (isBigyeop) score += 0.4;
      if (isInseong) score += 0.4;
      if (isJaeseong) score -= (isJeong ? 0.1 : 0.3);
      if (isGwanseong) score -= (daeunSipseong === '정관' ? 0.1 : 0.3);
    }
    if (gyeokguk.group === '정격') {
      if (gyeokguk.favorableSipseongs.includes(daeunSipseong)) score += 0.4;
      if (gyeokguk.unfavorableSipseongs.includes(daeunSipseong)) score -= 0.3;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑧ 원국 합충 (지지충)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const JIJI_CHUNG: Record<string, string> = {
    '자': '오', '축': '미', '인': '신', '묘': '유', '진': '술', '사': '해',
    '오': '자', '미': '축', '신': '인', '유': '묘', '술': '진', '해': '사',
  };
  const wonJiji = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  let chungCount = 0;
  for (const wj of wonJiji) {
    if (JIJI_CHUNG[jiji] === wj) chungCount++;
  }
  // 충이 용신 자리를 치면 더 나쁨, 기신 자리를 치면 오히려 좋을 수 있음
  if (chungCount > 0) {
    const chungTargetOh = JIJI_OHAENG[JIJI_CHUNG[jiji]];
    if (chungTargetOh === saju.gisin) {
      // 기신 충 = 기신 파괴 → 긍정적
      score += 0.3 * chungCount;
    } else if (chungTargetOh === saju.yongsin) {
      // 용신 충 = 용신 손상 → 매우 부정적
      score -= 0.7 * chungCount;
    } else {
      score -= 0.3 * chungCount;
    }
    // 일지충은 추가 감점 (자기 자신의 자리)
    if (saju.day.jiji === JIJI_CHUNG[jiji]) score -= 0.3;
  }

  // ⑧-A: 지지 육합 점수 반영
  const DAEUN_YUKHAP: Record<string, { pair: string; result: Ohaeng }> = {
    '자': { pair: '축', result: '토' }, '축': { pair: '자', result: '토' },
    '인': { pair: '해', result: '목' }, '해': { pair: '인', result: '목' },
    '묘': { pair: '술', result: '화' }, '술': { pair: '묘', result: '화' },
    '진': { pair: '유', result: '금' }, '유': { pair: '진', result: '금' },
    '사': { pair: '신', result: '수' }, '신': { pair: '사', result: '수' },
    '오': { pair: '미', result: '토' }, '미': { pair: '오', result: '토' },
  };
  const yukhapEntry = DAEUN_YUKHAP[jiji];
  if (yukhapEntry) {
    for (const wj of wonJiji) {
      if (wj === yukhapEntry.pair) {
        if (yukhapEntry.result === saju.yongsin) score += 0.4;
        else if (yukhapEntry.result === saju.gisin) score -= 0.15;
        else score += 0.2;
        break; // 육합은 1:1이므로 최초 매칭만
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑧-B 해(害)/파(破)/형(刑) 점수 반영
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const DAEUN_JIJI_HAE: Record<string, string> = {
    '자': '미', '미': '자', '축': '오', '오': '축',
    '인': '사', '사': '인', '묘': '진', '진': '묘',
    '신': '해', '해': '신', '유': '술', '술': '유',
  };
  const DAEUN_JIJI_PA: Record<string, string> = {
    '자': '유', '유': '자', '축': '진', '진': '축',
    '인': '해', '해': '인', '묘': '오', '오': '묘',
    '사': '신', '신': '사', '미': '술', '술': '미',
  };
  const DAEUN_HYUNG: Record<string, string[]> = {
    '인': ['사', '신'], '사': ['인', '신'], '신': ['인', '사'],
    '축': ['술', '미'], '술': ['축', '미'], '미': ['축', '술'],
    '자': ['묘'], '묘': ['자'],
    '진': ['진'], '오': ['오'], '유': ['유'], '해': ['해'],
  };
  for (const wj of wonJiji) {
    if (DAEUN_JIJI_HAE[jiji] === wj) score -= 0.15; // 해: 은근한 해침
    if (DAEUN_JIJI_PA[jiji] === wj) score -= 0.15;   // 파: 기존 질서 파괴
    if (DAEUN_HYUNG[jiji]?.includes(wj)) {
      score -= (wj === saju.day.jiji ? 0.3 : 0.2);    // 형: 일지 형이면 더 감점
    }
  }

  // ⑧-C: 방합(方合) — 동일 방위 3지지 결집
  const DAEUN_BANGHAP: { members: string[]; result: Ohaeng }[] = [
    { members: ['인', '묘', '진'], result: '목' },
    { members: ['사', '오', '미'], result: '화' },
    { members: ['신', '유', '술'], result: '금' },
    { members: ['해', '자', '축'], result: '수' },
  ];
  for (const bg of DAEUN_BANGHAP) {
    const allJijis = [...wonJiji, jiji];
    const matchCount = bg.members.filter(m => allJijis.includes(m)).length;
    if (bg.members.includes(jiji) && matchCount >= 3) {
      if (bg.result === saju.yongsin) score += 0.5;
      else if (bg.result === saju.gisin) score -= 0.5;
      else score += 0.15;
    }
  }

  // ⑧-D: 반합(半合) — 삼합 중 2글자 (운+원국)
  const DAEUN_SAMHAP: { members: string[]; result: Ohaeng }[] = [
    { members: ['신', '자', '진'], result: '수' },
    { members: ['해', '묘', '미'], result: '목' },
    { members: ['인', '오', '술'], result: '화' },
    { members: ['사', '유', '축'], result: '금' },
  ];
  for (const sg of DAEUN_SAMHAP) {
    if (!sg.members.includes(jiji)) continue;
    const others = sg.members.filter(m => m !== jiji);
    const matchCount = others.filter(o => wonJiji.includes(o)).length;
    if (matchCount >= 2) {
      // 삼합 완성
      if (sg.result === saju.yongsin) score += 0.7;
      else if (sg.result === saju.gisin) score -= 0.7;
      else score += 0.2;
    } else if (matchCount === 1) {
      // 반합
      if (sg.result === saju.yongsin) score += 0.25;
      else if (sg.result === saju.gisin) score -= 0.25;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑨ 조후 보정
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const johu = determineJohu(saju);
  if (johu.johuYongsin) {
    if (cheonganOhaeng === johu.johuYongsin || jijiOhaeng === johu.johuYongsin) {
      score += johu.priority === '급' ? 0.7 : 0.3;
    }
  }
  if (johu.johuGisin) {
    if (cheonganOhaeng === johu.johuGisin || jijiOhaeng === johu.johuGisin) {
      score -= johu.priority === '급' ? 0.5 : 0.2;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑩ 지장간 심층 분석 (본기/중기/여기 가중치 차별화)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { jangganScore } = analyzeJangganDeep(jiji, saju.ilgan, saju.yongsin, saju.gisin, ilOhaeng);
  score += jangganScore * 0.5; // 대운은 지장간 50% 반영

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑪ 천간합 결과 오행 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const sajuGans = [saju.year.cheongan, saju.month.cheongan, saju.ilgan, saju.hour.cheongan];
  const { hapScore: ganHapScore } = analyzeCheonganHapResult(cheongan, sajuGans, saju.yongsin, saju.gisin);
  score += ganHapScore;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑫ 원국 합/충 해소·강화
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { changeMod } = analyzeWonGukHapChungChange(saju, jiji);
  score += changeMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑬ 공망(空亡) 체크
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const gm = checkGongmang(saju.day.cheongan, saju.day.jiji, jiji);
  if (gm.isGongmang) {
    // 공망 지지가 기신 오행이면 → 기신 약화로 오히려 좋음
    if (jijiOhaeng === saju.gisin) score += 0.3;
    else if (jijiOhaeng === saju.yongsin) score -= 0.5; // 용신 공망 = 매우 나쁨
    else score += gm.effect; // 기본 -0.3
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑭ 12운성 의미적 세분화
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { stageMod } = get12StageContextMod(twelveStage, daeunSipseong, isSingang);
  score += stageMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑮-A 천간충(天干沖) 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const sajuGansDaeun = [saju.year.cheongan, saju.month.cheongan, saju.ilgan, saju.hour.cheongan];
  const { chungMod: ganChungMod } = analyzeCheonganChung(cheongan, sajuGansDaeun, saju.yongsin, saju.gisin);
  score += ganChungMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑮-B 암합(暗合) 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const wonJijiDaeun = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  const { amhapMod } = analyzeAmhap(jiji, wonJijiDaeun, saju.yongsin, saju.gisin);
  score += amhapMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑮-C 추가 신살 종합 (12신살 + 원진/귀문관 + 천덕/월덕)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const advSinsalDaeun = analyzeAdvancedSinsal(
    jiji, cheongan, saju.day.jiji, saju.year.jiji,
    saju.month.jiji, saju.yongsin, saju.gisin, wonJijiDaeun
  );
  score += advSinsalDaeun.sinsalMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑮-D 투합(妬合) 판별
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { tuhapMod } = checkTuhap(cheongan, sajuGansDaeun);
  score += tuhapMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑮-E 공망 진공/반공 세밀 판별
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const gmDetail = analyzeGongmangDetail(saju.day.cheongan, saju.day.jiji, jiji, wonJijiDaeun);
  if (gmDetail.isJingong) {
    score += gmDetail.gongmangMod - (gm.isGongmang ? gm.effect : 0); // 기존 공망 효과 대체
  } else if (gmDetail.isBangong) {
    score += gmDetail.gongmangMod - (gm.isGongmang ? gm.effect : 0);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑮-F 형충파해 합 해소
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { resolveMod } = analyzeHapResolution(jiji, wonJijiDaeun);
  score += resolveMod;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑯ 4주(연주/월주/일주/시주) 관계도 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const pillarRel = analyzePillarRelations(saju, cheonganOhaeng, jijiOhaeng, jiji);
  // 원국 구조 점수 반영 (대운은 10년 주기이므로 구조적 영향 크게 반영)
  score += pillarRel.structuralScore * 0.15;
  // 운이 원국 관계를 활성화/약화하는 정도
  score += pillarRel.runActivation;
  // 영역별 보정의 종합 평균도 대운 종합 점수에 미세 반영
  const areaAvg = (pillarRel.areaModifiers.study + pillarRel.areaModifiers.money +
    pillarRel.areaModifiers.love + pillarRel.areaModifiers.health +
    pillarRel.areaModifiers.career) / 5;
  score += areaAvg * 0.3;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑯ 시기별 맥락 + 궁위(宮位) 심층 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const lifePhase = analyzeLifePhaseContext(saju, startAge ?? 30, cheonganOhaeng, jijiOhaeng, jiji);
  // 시기별 영역 보너스 합산을 종합 점수에 가중 반영
  const phaseAreaSum = lifePhase.areaBonus.study * lifePhase.areaWeights.study +
    lifePhase.areaBonus.money * lifePhase.areaWeights.money +
    lifePhase.areaBonus.love * lifePhase.areaWeights.love +
    lifePhase.areaBonus.health * lifePhase.areaWeights.health +
    lifePhase.areaBonus.career * lifePhase.areaWeights.career;
  score += phaseAreaSum * 0.2;
  // 궁위 질 평균
  const gungwiAvg = (lifePhase.educationQuality + lifePhase.spouseQuality +
    lifePhase.wealthStructure + lifePhase.careerFoundation) / 4;
  score += gungwiAvg * 0.1;
  // 건강 취약도는 감점 방향
  score -= lifePhase.healthVulnerability * 0.05;

  // ── 영역별 점수 산출 (종합 점수 기반 + 세밀 영역별 보정) ──
  const baseArea = score; // 종합 점수를 기본으로
  const clampDaeunArea = (v: number) => Math.round(Math.max(1, Math.min(10, v)) * 2) / 2;

  // 영역별 개별 보정값 (세운과 동일한 세밀도)
  let aStudy = 0, aMoney = 0, aLove = 0, aHealth = 0, aCareer = 0;

  // ── (A) 기존 4주 관계 + 시기별 보정 ──
  aStudy += pillarRel.areaModifiers.study * 0.5 + lifePhase.areaBonus.study * lifePhase.areaWeights.study;
  aMoney += pillarRel.areaModifiers.money * 0.5 + lifePhase.areaBonus.money * lifePhase.areaWeights.money;
  aLove += pillarRel.areaModifiers.love * 0.5 + lifePhase.areaBonus.love * lifePhase.areaWeights.love;
  aHealth += pillarRel.areaModifiers.health * 0.5 + lifePhase.areaBonus.health * lifePhase.areaWeights.health - lifePhase.healthVulnerability * 0.3;
  aCareer += pillarRel.areaModifiers.career * 0.5 + lifePhase.areaBonus.career * lifePhase.areaWeights.career;

  // ── (B) 신살 areaEffect 반영 (analyzeAdvancedSinsal에서 이미 계산) ──
  aStudy += advSinsalDaeun.areaEffect.study;
  aMoney += advSinsalDaeun.areaEffect.money;
  aLove += advSinsalDaeun.areaEffect.love;
  aHealth += advSinsalDaeun.areaEffect.health;
  aCareer += advSinsalDaeun.areaEffect.career;

  // ── (C) 십성별 영역 차등 ──
  if (daeunSipseong === '정재') { aMoney += 0.7; aCareer += 0.2; }
  else if (daeunSipseong === '편재') { aMoney += 0.5; aCareer += 0.15; }
  else if (daeunSipseong === '정관') { aCareer += 0.7; aStudy += 0.15; }
  else if (daeunSipseong === '편관') { aCareer += 0.4; aHealth -= 0.2; }
  else if (daeunSipseong === '정인') { aStudy += 0.7; aHealth += 0.2; }
  else if (daeunSipseong === '편인') { aStudy += 0.5; aHealth -= 0.15; }
  else if (daeunSipseong === '식신') { aStudy += 0.3; aMoney += 0.3; aHealth += 0.3; aCareer += 0.2; aLove += 0.15; }
  else if (daeunSipseong === '상관') { aStudy += 0.15; aCareer -= 0.3; aMoney += 0.2; aLove += 0.2; }
  else if (daeunSipseong === '비견') { aHealth += 0.15; aLove -= 0.1; aMoney -= 0.15; }
  else if (daeunSipseong === '겁재') { aMoney -= 0.4; aLove -= 0.2; aCareer -= 0.15; }

  // ── (D) 신강/신약 × 십성 교차 영역 보정 ──
  if (!isJonggyeok) {
    if (isSingang) {
      if (isJaeseong) { aMoney += 0.5; aLove += 0.15; }
      if (isGwanseong) { aCareer += 0.4; }
      if (isSiksang) { aMoney += 0.3; aCareer += 0.25; }
      if (isBigyeop) { aMoney -= 0.3; aCareer -= 0.2; }
      if (isInseong) { aStudy += 0.2; aCareer -= 0.15; }
    }
    if (isSinyak) {
      if (isInseong) { aStudy += 0.5; aHealth += 0.3; }
      if (isBigyeop) { aHealth += 0.3; aCareer += 0.15; }
      if (isJaeseong) { aHealth -= 0.3; aMoney -= 0.2; }
      if (isGwanseong) { aHealth -= 0.3; aCareer -= 0.15; }
      if (isSiksang) { aHealth -= 0.2; }
    }
  }

  // ── (E) 12운성별 영역 차등 ──
  if (twelveStage === '장생') { aStudy += 0.4; aHealth += 0.2; aCareer += 0.15; }
  else if (twelveStage === '목욕') { aLove += 0.5; aStudy -= 0.15; }
  else if (twelveStage === '관대') { aCareer += 0.4; aStudy += 0.3; }
  else if (twelveStage === '건록') { aCareer += 0.5; aMoney += 0.3; aHealth += 0.2; }
  else if (twelveStage === '제왕') { aCareer += 0.5; aMoney += 0.2; aHealth += 0.1; }
  else if (twelveStage === '쇠') { aHealth -= 0.2; aCareer -= 0.1; }
  else if (twelveStage === '병') { aHealth -= 0.4; aCareer -= 0.15; }
  else if (twelveStage === '사') { aHealth -= 0.5; aLove -= 0.2; }
  else if (twelveStage === '묘') { aHealth -= 0.3; aStudy += 0.15; }
  else if (twelveStage === '절') { aLove -= 0.2; aHealth -= 0.2; aMoney -= 0.15; }
  else if (twelveStage === '태') { aLove += 0.15; aStudy += 0.1; }
  else if (twelveStage === '양') { aStudy += 0.2; aHealth += 0.15; }

  // ── (F) 성별 × 십성 연애운 차등 ──
  if (saju.gender === 'female') {
    if (daeunSipseong === '정관') aLove += 0.5;     // 여성: 정관=정부(正夫)
    else if (daeunSipseong === '편관') aLove += 0.2; // 여성: 편관=편부
    if (isJaeseong) aLove -= 0.1;                     // 여성: 재성→관성 극 → 시모갈등
  }
  if (saju.gender === 'male') {
    if (daeunSipseong === '정재') aLove += 0.5;     // 남성: 정재=정처(正妻)
    else if (daeunSipseong === '편재') aLove += 0.2; // 남성: 편재=편처
    if (isGwanseong) aLove -= 0.1;                    // 남성: 관성→비겁 극 → 경쟁자
  }

  // ── (G) 도화살/역마살/화개살 영역 보정 ──
  const DOHWA_DAEUN: Record<string, string> = {
    '자': '유', '축': '오', '인': '묘', '묘': '자',
    '진': '유', '사': '오', '오': '묘', '미': '자',
    '신': '유', '유': '오', '술': '묘', '해': '자',
  };
  const YEOKMA_DAEUN: Record<string, string> = {
    '자': '인', '축': '해', '인': '신', '묘': '사',
    '진': '인', '사': '해', '오': '신', '미': '사',
    '신': '인', '유': '해', '술': '신', '해': '사',
  };
  const HWAGAE_DAEUN: Record<string, string> = {
    '자': '진', '축': '축', '인': '술', '묘': '미',
    '진': '진', '사': '축', '오': '술', '미': '미',
    '신': '진', '유': '축', '술': '술', '해': '미',
  };
  const dayJiDaeun = saju.day.jiji;
  const yearJiDaeun = saju.year.jiji;
  if (jiji === DOHWA_DAEUN[dayJiDaeun] || jiji === DOHWA_DAEUN[yearJiDaeun]) {
    aLove += 0.5; aCareer += 0.1;  // 도화살 → 연애운↑, 대인관계↑
  }
  if (jiji === YEOKMA_DAEUN[dayJiDaeun] || jiji === YEOKMA_DAEUN[yearJiDaeun]) {
    aCareer += 0.3; aMoney += 0.15; // 역마살 → 직업운↑ (활동/이동)
  }
  if (jiji === HWAGAE_DAEUN[dayJiDaeun] || jiji === HWAGAE_DAEUN[yearJiDaeun]) {
    aStudy += 0.5; aHealth += 0.1;  // 화개살 → 학업운↑, 정신건강↑
  }

  // ── (H) 오행 밸런스 영역별 관련 오행 보정 ──
  const ob = saju.ohaengBalance;
  if (ob) {
    // 수(水) = 지혜/학문, 목(木) = 성장/건강, 화(火) = 예의/인간관계
    // 금(金) = 직업/결단, 토(土) = 재물/안정
    const waterBal = ob['수'] || 0;
    const woodBal = ob['목'] || 0;
    const fireBal = ob['화'] || 0;
    const metalBal = ob['금'] || 0;
    const earthBal = ob['토'] || 0;

    // 결핍 오행을 대운이 채워주면 해당 영역 보너스
    if (waterBal <= 1 && (cheonganOhaeng === '수' || jijiOhaeng === '수')) { aStudy += 0.4; }
    if (woodBal <= 1 && (cheonganOhaeng === '목' || jijiOhaeng === '목')) { aHealth += 0.4; }
    if (fireBal <= 1 && (cheonganOhaeng === '화' || jijiOhaeng === '화')) { aLove += 0.3; aCareer += 0.1; }
    if (metalBal <= 1 && (cheonganOhaeng === '금' || jijiOhaeng === '금')) { aCareer += 0.3; }
    if (earthBal <= 1 && (cheonganOhaeng === '토' || jijiOhaeng === '토')) { aMoney += 0.4; aHealth += 0.1; }

    // 과잉 오행을 대운이 더 보태면 해당 영역 감점
    if (waterBal >= 5 && (cheonganOhaeng === '수' || jijiOhaeng === '수')) { aHealth -= 0.2; }
    if (woodBal >= 5 && (cheonganOhaeng === '목' || jijiOhaeng === '목')) { aHealth -= 0.15; }
    if (fireBal >= 5 && (cheonganOhaeng === '화' || jijiOhaeng === '화')) { aHealth -= 0.2; aLove -= 0.1; }
    if (metalBal >= 5 && (cheonganOhaeng === '금' || jijiOhaeng === '금')) { aHealth -= 0.15; }
    if (earthBal >= 5 && (cheonganOhaeng === '토' || jijiOhaeng === '토')) { aHealth -= 0.15; aMoney -= 0.1; }
  }

  // ── (I) 용신 유입 시 전 영역 보너스, 기신 유입 시 전 영역 감점 ──
  if (cheonganOhaeng === saju.yongsin || jijiOhaeng === saju.yongsin) {
    aStudy += 0.15; aMoney += 0.15; aLove += 0.1; aHealth += 0.2; aCareer += 0.15;
  }
  if (cheonganOhaeng === saju.gisin || jijiOhaeng === saju.gisin) {
    aStudy -= 0.1; aMoney -= 0.1; aLove -= 0.05; aHealth -= 0.15; aCareer -= 0.1;
  }

  // ── (J) 충이 있으면 건강/연애 추가 감점 ──
  if (chungCount > 0) {
    aHealth -= 0.2 * chungCount;
    aLove -= 0.15 * chungCount;
  }

  const daeunAreaScores: DaeunAreaScores = {
    study: clampDaeunArea(baseArea + aStudy),
    money: clampDaeunArea(baseArea + aMoney),
    love: clampDaeunArea(baseArea + aLove),
    health: clampDaeunArea(baseArea + aHealth),
    career: clampDaeunArea(baseArea + aCareer),
  };

  // 최종 상한/하한 (1~10)
  return {
    score: Math.round(Math.max(1, Math.min(10, score))),
    areaScores: daeunAreaScores,
  };
}

export interface DaeunAreaScores {
  study: number;   // 학업운 (1~10)
  money: number;   // 재물운 (1~10)
  love: number;    // 연애운 (1~10)
  health: number;  // 건강운 (1~10)
  career: number;  // 직업운 (1~10)
}

export interface DaeunPillar {
  cheongan: string;
  jiji: string;
  cheonganOhaeng: Ohaeng;
  jijiOhaeng: Ohaeng;
  startAge: number;
  endAge: number;
  twelveStage: TwelveStage;
  score: number;            // 종합 점수 (1~10)
  areaScores: DaeunAreaScores; // 영역별 점수 (1~10)
  description: string;
  bang: DaeunBang;          // 방(方) — 동/남/서/북
  bangSeason: string;       // 계절
  bangPersonality: string;  // 방위별 성격 변화
}

export interface DaeunResult {
  startAge: number;         // 대운 시작 나이
  direction: 'forward' | 'backward'; // 순행/역행
  pillars: DaeunPillar[];   // 대운 기둥들 (8~10개)
  currentDaeun: DaeunPillar | null;  // 현재 대운
  currentAge: number;
  birthYear: number;        // 양력 출생 연도 (연도 계산용)
}

/**
 * 대운 순행/역행 결정
 * 남자 양년생, 여자 음년생 → 순행
 * 남자 음년생, 여자 양년생 → 역행
 */
function getDaeunDirection(yearCheongan: string, gender: 'male' | 'female'): 'forward' | 'backward' {
  const yearGanIdx = CHEONGAN.indexOf(yearCheongan as typeof CHEONGAN[number]);
  const isYangYear = yearGanIdx % 2 === 0; // 갑(0), 병(2), 무(4), 경(6), 임(8) = 양

  if (gender === 'male') {
    return isYangYear ? 'forward' : 'backward';
  } else {
    return isYangYear ? 'backward' : 'forward';
  }
}

/**
 * 대운 시작 나이 계산 (간략화)
 * 실제로는 생일~절기까지 일수를 3으로 나눈 값
 * 여기서는 간략하게 평균값 사용
 */
function calculateDaeunStartAge(
  birthMonth: number,
  birthDay: number,
  direction: 'forward' | 'backward'
): number {
  // 절기까지의 대략적 일수를 계산
  // 각 월의 절기 기준일 (대략적)
  const jeolgiDays = [6, 4, 6, 5, 6, 6, 7, 7, 8, 8, 7, 7]; // 1~12월
  const jeolgiDay = jeolgiDays[birthMonth - 1];

  // 각 월의 실제 일수 (평년 기준; 윤년 차이는 1일로 대운 나이에 무의미)
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 1~12월

  let daysDiff: number;
  if (direction === 'forward') {
    // 다음 절기까지의 일수
    if (birthDay < jeolgiDay) {
      daysDiff = jeolgiDay - birthDay;
    } else {
      const daysLeft = monthDays[birthMonth - 1] - birthDay;
      const nextJeolgi = jeolgiDays[birthMonth % 12];
      daysDiff = daysLeft + nextJeolgi;
    }
  } else {
    // 이전 절기까지의 일수
    if (birthDay >= jeolgiDay) {
      daysDiff = birthDay - jeolgiDay;
    } else {
      const prevMonth = birthMonth === 1 ? 12 : birthMonth - 1;
      const prevMonthDays = monthDays[prevMonth - 1];
      daysDiff = birthDay + (prevMonthDays - jeolgiDays[prevMonth - 1]);
    }
  }

  // 3일 = 1년으로 환산 (명리학 공식: 나머지 2 → 올림, 나머지 1 → 버림, 나머지 0 → 그대로)
  const quotient = Math.floor(daysDiff / 3);
  const remainder = daysDiff % 3;
  const startAge = remainder === 2 ? quotient + 1 : quotient;
  return Math.max(1, Math.min(startAge, 10));
}

/**
 * 대운 기둥들 생성
 */
export function calculateDaeun(
  saju: SajuResult,
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  gender: 'male' | 'female',
  currentYear: number = new Date().getFullYear()
): DaeunResult {
  const direction = getDaeunDirection(saju.year.cheongan, gender);
  const startAge = calculateDaeunStartAge(birthMonth, birthDay, direction);
  const currentAge = currentYear - birthYear + 1; // 만나이가 아닌 세는 나이

  // 월주에서 시작
  const monthGanIdx = CHEONGAN.indexOf(saju.month.cheongan as typeof CHEONGAN[number]);
  const monthJiIdx = JIJI.indexOf(saju.month.jiji as typeof JIJI[number]);

  const pillars: DaeunPillar[] = [];
  let currentDaeun: DaeunPillar | null = null;

  for (let i = 1; i <= 12; i++) {
    let ganIdx: number, jiIdx: number;

    if (direction === 'forward') {
      ganIdx = (monthGanIdx + i) % 10;
      jiIdx = (monthJiIdx + i) % 12;
    } else {
      ganIdx = (monthGanIdx - i + 100) % 10;
      jiIdx = (monthJiIdx - i + 120) % 12;
    }

    const cheongan = CHEONGAN[ganIdx];
    const jiji = JIJI[jiIdx];
    const pillarStartAge = startAge + (i - 1) * 10;
    const pillarEndAge = pillarStartAge + 9;

    const twelveStage = calculateTwelveStage(saju.ilgan, jiji);

    const bangInfo = getDaeunBang(jiji);
    const cOh = CHEONGAN_OHAENG[cheongan];
    const jOh = JIJI_OHAENG[jiji];
    const daeunResult = calculateDaeunScore(saju, cheongan, jiji, cOh, jOh, twelveStage, pillarStartAge);
    const pillar: DaeunPillar = {
      cheongan,
      jiji,
      cheonganOhaeng: cOh,
      jijiOhaeng: jOh,
      startAge: pillarStartAge,
      endAge: pillarEndAge,
      twelveStage,
      score: daeunResult.score,
      areaScores: daeunResult.areaScores,
      description: generateDaeunDescription(saju.ilgan, cheongan, jiji, twelveStage, pillarStartAge, pillarEndAge, saju),
      bang: bangInfo.bang,
      bangSeason: bangInfo.season,
      bangPersonality: bangInfo.personality,
    };

    pillars.push(pillar);

    if (currentAge >= pillarStartAge && currentAge <= pillarEndAge) {
      currentDaeun = pillar;
    }
  }

  return {
    startAge,
    direction,
    pillars,
    currentDaeun,
    currentAge,
    birthYear,
  };
}

// ========== 건강 교차분석용 매핑 ==========

/** 오행 극도 부족 시 건강 상세 경고 (대운/세운용) */
const OHAENG_EXTREME_HEALTH: Record<Ohaeng, string> = {
  '화': '⚠️ 화(火) 기운이 극도로 부족합니다. 심장·혈관이 약하고 공황장애·불안장애·불면증 위험이 높습니다. "적극적으로 도전하라"는 조언은 이 분에게 맞지 않습니다. 무리한 사회활동보다 안정적 환경에서 자기 페이스를 지키는 것이 핵심입니다.',
  '목': '⚠️ 목(木) 기운이 극도로 부족합니다. 간·담 기능이 약하고 근육·관절 문제, 만성 피로가 올 수 있습니다. 🧠 정신적으로는 우울감·무기력·의욕 상실이 심해질 수 있으며, 심하면 우울증으로 발전할 위험이 있습니다. 과도한 업무나 야근은 몸과 마음을 더 망가뜨립니다. 충분한 수면과 가벼운 스트레칭, 산림욕이 필수입니다.',
  '토': '⚠️ 토(土) 기운이 극도로 부족합니다. 위장·소화기가 매우 약하고 영양 흡수가 안 되어 만성 체력 저하로 이어집니다. 🧠 정신적으로는 걱정·강박사고·불안장애가 나타나기 쉬우며, 끊임없이 사소한 일을 걱정하는 패턴이 생길 수 있습니다. 불규칙한 식사, 자극적인 음식, 과도한 스트레스가 치명적입니다.',
  '금': '⚠️ 금(金) 기운이 극도로 부족합니다. 폐·호흡기·피부가 약하고 알레르기·천식·아토피가 심해질 수 있습니다. 🧠 정신적으로는 슬픔·비관적 사고에 빠지기 쉬우며, 완벽주의 성향으로 인한 만성 스트레스와 자기비하가 나타날 수 있습니다. 미세먼지, 환기 안 되는 환경, 과도한 말하기(영업·강의)가 부담됩니다.',
  '수': '⚠️ 수(水) 기운이 극도로 부족합니다. 신장·방광·허리가 약하고 만성 요통, 부종, 비뇨기 문제가 올 수 있습니다. 🧠 정신적으로는 공포감·두려움·위축감이 강해져서 새로운 도전을 극도로 꺼리게 되며, 심하면 공포장애·회피성 성격으로 발전할 수 있습니다. 장시간 앉아있는 업무, 찬 환경, 과음이 특히 위험합니다.',
};

/** 오행 과다(지나침)로 인한 건강 위험 — "부족해도 병, 지나쳐도 병" */
const OHAENG_EXCESS_HEALTH: Record<Ohaeng, string> = {
  '목': '⚠️ 목(木) 기운이 과다합니다. 간 기능이 과항진되어 알레르기·과민반응이 심해지고, 눈 피로·눈꺼풀 떨림·목 결림이 잦을 수 있습니다. 화를 낼 때 편두통이 동반되며, 분노 조절에 어려움이 있을 수 있습니다. 🍋 신맛 음식을 지나치게 찾는 경향이 있으니 의식적으로 줄이고, 간에 무리를 주는 음주·야식을 절제하세요.',
  '화': '⚠️ 화(火) 기운이 과다합니다. 심장이 과열되어 고혈압·심혈관 질환·뇌경색 위험이 높아집니다. 심장 두근거림·불면증·안질(눈병)·잇몸 질환·과열성 염증에 취약합니다. ☕ 쓴맛을 지나치게 찾는 경향이 있으니 커피·차 등 섭취를 줄이고, 수영 등 수(水) 기운 활동으로 열을 식히세요.',
  '토': '⚠️ 토(土) 기운이 과다합니다. 위장이 예민해져 위장 장애·소화불량·만성 피로가 나타나기 쉽습니다. 🧠 정신적으로는 걱정·강박·과잉사고가 심해지고, 같은 생각을 반복하며 잠들기 어려운 패턴이 나타날 수 있습니다. 반복되는 체증과 어깨 결림이 동반될 수 있습니다. 🍯 단맛을 지나치게 선호하는 경향이 있으니 의식적으로 단 음식을 줄이세요. 과식·폭식을 피하고 소식(小食) 습관이 중요합니다.',
  '금': '⚠️ 금(金) 기운이 과다합니다. 폐·호흡기가 예민해져 비염·기침·숨 가쁨이 잦고 피부 건조증이 심해질 수 있습니다. 🧠 정신적으로는 슬픔·비관적 사고·완벽주의 성향이 극대화되어 자기 자신과 주변을 끊임없이 비판하고, 만성 스트레스에 시달릴 수 있습니다. 뼈와 관절이 단단하지만 유연성이 부족해 부상 시 회복이 느립니다. 🌶️ 매운맛을 지나치게 찾는 경향이 있으니 줄이고, 습도 관리와 스트레칭으로 유연성을 키우세요.',
  '수': '⚠️ 수(水) 기운이 과다합니다. 신장·방광이 과활성되어 하체 부종·요통·관절 약화가 올 수 있습니다. 호르몬 변동이 심해 감정 동요·우울증·감정 과민·불면증에 취약합니다. 🧂 짠맛을 지나치게 찾는 경향이 있으니 줄이고, 몸을 따뜻하게 유지하며 차가운 음식·음료를 절제하세요.',
};

/** 건강 상태와 충돌하는 12운성 career 텍스트 필터링 */
const HEALTH_CAREER_CONFLICT: Record<Ohaeng, RegExp> = {
  '화': /경쟁|발표|PR|사람들 앞|SNS|이미지|적극적/,
  '목': /야근|야간|육체|무리한|체력.*도전/,
  '토': /교대|불규칙|출장|유흥/,
  '금': /먼지|화학|영업|강의|말하는/,
  '수': /야간|유흥|과음|앉아|좌식|밤/,
};

/** 건강 충돌하는 직업 조언을 대체 텍스트로 교체 (약하면 경고 추가, 극약이면 완전 대체) */
const HEALTH_CAREER_REPLACE: Record<Ohaeng, string> = {
  '화': '사람이 적은 환경, 재택·온라인 기반 업무, 창작·디자인·상담직이 체질에 맞습니다.',
  '목': '규칙적 근무시간의 사무직·전문직, 교육·연구·IT 분야가 체질에 맞습니다.',
  '토': '규칙적 식사가 가능한 안정적 조직, 식품·건강·교육 분야가 체질에 맞습니다.',
  '금': '깨끗한 사무환경, IT·디자인·연구직, 자연환경 가까운 업무가 체질에 맞습니다.',
  '수': '적절한 활동량이 있는 직종, 따뜻한 환경, 규칙적 생활이 가능한 업무가 체질에 맞습니다.',
};

function filterCareerByHealth(careerText: string, weakOh: Ohaeng | undefined, weakBalance: number): string {
  if (!weakOh || weakBalance > 3) return careerText; // 균형 잡힌 사주는 그대로
  const conflict = HEALTH_CAREER_CONFLICT[weakOh];
  if (!conflict || !conflict.test(careerText)) return careerText; // 충돌 없으면 그대로

  if (weakBalance <= 1) {
    // 극약: 충돌 텍스트를 건강 맞춤 대체 텍스트로 완전 교체
    return HEALTH_CAREER_REPLACE[weakOh];
  }
  // 약함(2~3): 원래 텍스트 + 건강 경고 추가
  return `${careerText} (단, ${HEALTH_ACTIVITY_ADJUST[weakOh].avoid} 환경은 건강상 피하는 것이 좋습니다.)`;
}

/** 건강 상태에 따른 직업/활동 조언 교차 매핑 */
const HEALTH_ACTIVITY_ADJUST: Record<Ohaeng, { avoid: string; recommend: string }> = {
  '화': {
    avoid: '사람 많은 곳, 장거리 출장, 높은 강도의 경쟁 환경, 대중 앞 발표',
    recommend: '재택근무, 소규모 팀, 창작·글쓰기·디자인, 1:1 상담, 안정적 루틴 업무',
  },
  '목': {
    avoid: '과도한 야근, 육체노동, 장시간 서서 하는 일, 음주가 잦은 회식 문화',
    recommend: '규칙적 근무시간, 앉아서 하는 전문직, 교육·연구, 자연 가까운 환경',
  },
  '토': {
    avoid: '불규칙한 식사가 불가피한 직종, 교대근무, 장기 출장, 극심한 스트레스 환경',
    recommend: '규칙적 생활이 가능한 직종, 안정적 조직, 식품·건강 관련 분야, 꾸준한 루틴',
  },
  '금': {
    avoid: '먼지·화학물질 노출 환경, 장시간 말하는 직종, 환기 안 되는 실내',
    recommend: '깨끗한 사무환경, IT·디자인, 조용한 연구직, 자연환경 가까운 곳',
  },
  '수': {
    avoid: '장시간 앉아있는 업무(허리 부담), 야간근무, 찬 환경, 과음 문화',
    recommend: '적절한 활동량이 있는 직종, 따뜻한 환경, 규칙적 수분 섭취 가능한 곳',
  },
};

/**
 * 대운 해석 생성 (상세 버전 — 건강 교차분석 포함)
 */
function generateDaeunDescription(
  ilgan: string,
  daeunGan: string,
  daeunJi: string,
  twelveStage: TwelveStage,
  startAge: number,
  endAge: number,
  saju?: SajuResult
): string {
  const rawStageData = TWELVE_STAGE_DATA[twelveStage];
  const ganOhaeng = CHEONGAN_OHAENG[daeunGan];
  const jiOhaeng = JIJI_OHAENG[daeunJi];
  const ilOhaeng = CHEONGAN_OHAENG[ilgan];

  // 사주 컨텍스트 기반 12운성 텍스트 교차보정
  const ctx = saju ? extractSajuContext(saju) : null;
  const adjusted = ctx ? adjustStageTexts(rawStageData, ctx) : rawStageData;
  // 관계 상태 반영
  const stageData = ctx ? {
    ...adjusted,
    love: adjustLoveTextByRelationship(adjusted.love, ctx.relationship),
  } : adjusted;

  let desc = `${startAge}~${endAge}세: ${daeunGan}${daeunJi} 대운 (${ganOhaeng}/${jiOhaeng})\n`;
  desc += `12운성: ${twelveStage}${rawStageData.emoji} (에너지: ${rawStageData.energy}/10)\n\n`;

  // 60세+ 시니어: 건강 중심 해석 프레임
  const isSenior = startAge >= 60;
  if (isSenior) {
    desc += `🏥 이 시기(${startAge}~${endAge}세)는 건강이 가장 중요한 시기입니다. 모든 운세는 건강이 뒷받침되어야 의미가 있습니다.\n\n`;
  }

  // 12운성을 일상 비유로 풀어줌
  desc += `${TWELVE_STAGE_PLAIN[twelveStage]}\n\n`;

  // 오행 상호작용 분석 (천간 기준) — 나의 오행 강도 전달
  const ilBal = saju?.ohaengBalance?.[ilOhaeng] ?? undefined;
  const ganInteraction = analyzeOhaengInteraction(ganOhaeng, ilOhaeng, '대운 천간', '나(일간)', ilBal);
  desc += `【기운의 흐름】 ${OHAENG_METAPHOR[ganOhaeng]} 기운이 찾아옵니다. `;
  desc += `${ganInteraction.detail}\n\n`;

  // 천간과 지지의 오행이 다르면 지지 오행도 분석
  if (ganOhaeng !== jiOhaeng) {
    const jiInteraction = analyzeOhaengInteraction(jiOhaeng, ilOhaeng, '대운 지지', '나(일간)', ilBal);
    desc += `또한 안쪽에서는 ${OHAENG_NAME[jiOhaeng]}의 기운이 함께 작용하여, ${jiInteraction.summary}\n\n`;
  }

  // ===== 건강 교차분석 데이터 준비 =====
  const weakOh = saju?.weakestOhaeng as Ohaeng | undefined;
  const weakBal = saju?.ohaengBalance ? Math.min(...Object.values(saju.ohaengBalance)) : 99;
  const isExtremeWeak = weakOh && weakBal <= 1;
  const healthAdjust = isExtremeWeak ? HEALTH_ACTIVITY_ADJUST[weakOh] : null;

  // ===== 성격/기질 교차분석 =====
  {
    const bangInfo = getDaeunBang(daeunJi);
    desc += `【이 시기의 성격 변화 (${bangInfo.bang} · ${bangInfo.season})】 `;
    desc += bangInfo.personality;

    // 성격 변화 ↔ 건강 교차분석
    if (isExtremeWeak) {
      desc += `\n\n⚠️ 기질↔건강 교차분석: `;
      const bangOh = bangInfo.ohaeng;
      if (bangOh === '화' && weakOh !== '화') {
        // 남방 대운이면 열정적·외향적으로 변하는데...
        if (weakOh === '금') desc += '남방(화) 대운이 열정적 성향을 만들지만, 금 기운 부족으로 호흡기가 약해 과도한 사교활동은 건강을 해칩니다. 열정은 조용한 창작으로 발산하세요.';
        else if (weakOh === '목') desc += '남방(화) 대운이 적극적 성향을 만들지만, 목 기운 부족으로 쉽게 지칩니다. 번아웃에 주의하고 에너지 분배를 철저히 하세요.';
        else desc += `남방(화) 대운이 외향적 성향을 만들지만, ${weakOh} 부족으로 체력이 따라주지 않을 수 있습니다. 마음은 앞서가되 몸과 타협하세요.`;
      } else if (bangOh === '목' && weakOh !== '목') {
        if (weakOh === '화') desc += '동방(목) 대운이 도전적 성향을 만들지만, 화 기운 부족으로 불안·공황이 도전을 가로막을 수 있습니다. 작은 성공 경험을 쌓아가며 자신감을 천천히 키우세요.';
        else desc += `동방(목) 대운이 진취적 성향을 만들지만, ${weakOh} 부족으로 실행력이 부족할 수 있습니다. 계획을 잘게 나누어 하나씩 실행하세요.`;
      } else if (bangOh === '금') {
        if (weakOh === '화') desc += '서방(금) 대운이 현실적·결단력 있는 성향을 만들고, 이는 불안이 있는 당신에게 오히려 도움이 됩니다. 감정보다 이성으로 판단하는 훈련이 이 시기에 잘 됩니다.';
        else if (weakOh === '목') desc += '서방(금) 대운이 정리하는 성향을 만들지만, 금이 목을 극하므로 간·근육이 더 약해질 수 있습니다. 결단은 좋되 몸을 혹사하지 마세요.';
        else desc += `서방(금) 대운이 내면 정리에 좋은 시기이며, ${weakOh} 부족에 대한 관리도 이때 체계적으로 세울 수 있습니다.`;
      } else if (bangOh === '수') {
        if (weakOh === '화') desc += '북방(수) 대운이 내면 성장을 촉진하지만, 수가 화를 극하므로 불안·우울이 심해질 수 있는 시기입니다. 명상보다는 따뜻한 환경에서의 가벼운 활동이 더 맞습니다.';
        else desc += `북방(수) 대운이 사색적 성향을 만드는데, ${weakOh} 부족 체질에게는 지나친 고립이 건강을 악화시킬 수 있습니다. 혼자만의 시간과 사회 활동의 균형을 잡으세요.`;
      } else {
        desc += `이 시기의 성격 변화가 ${weakOh} 부족 체질과 충돌할 수 있으니, 몸이 보내는 신호에 귀 기울이면서 성향 변화를 받아들이세요.`;
      }
    }

    // 일간 기질 ↔ 대운 성격 변화 교차
    if (saju) {
      const ilOhTemp = CHEONGAN_OHAENG[saju.ilgan];
      const bangOh = bangInfo.ohaeng;
      if (ilOhTemp === bangOh) {
        desc += `\n✅ 타고난 기질(${OHAENG_NAME[ilOhTemp]})과 대운 방위가 같아, 본래 성격이 더 강화됩니다. 장점은 극대화되지만 단점도 함께 커지니 주의하세요.`;
      } else if (OHAENG_SANGGEUK[bangOh] === ilOhTemp) {
        desc += `\n⚡ 대운 방위(${bangInfo.bang})가 타고난 기질(${OHAENG_NAME[ilOhTemp]})을 억누릅니다. 내면의 갈등이 생기기 쉬운 시기이며, 스트레스 관리가 중요합니다.`;
      } else if (OHAENG_SANGSAENG[bangOh] === ilOhTemp) {
        desc += `\n🌿 대운 방위(${bangInfo.bang})가 타고난 기질(${OHAENG_NAME[ilOhTemp]})을 도와줍니다. 자연스럽게 성장하고 발전하는 시기입니다.`;
      }
    }
    desc += '\n\n';
  }

  // 직업/사회생활 예측 — 60세+ 시니어는 건강 중심으로 전환
  if (isSenior) {
    desc += '【노후 생활】 ';
    desc += `이 시기는 새로운 도전보다 건강 관리와 가족과의 시간이 최우선입니다. `;
    if (rawStageData.energy >= 7) {
      desc += '에너지가 좋은 편이니 가벼운 사회활동(봉사, 멘토링, 취미 강의)을 통해 보람을 찾으세요.';
    } else if (rawStageData.energy >= 4) {
      desc += '무리하지 않는 선에서 산책, 취미활동, 손자녀와의 시간을 즐기세요.';
    } else {
      desc += '체력이 약한 시기이니 건강 검진을 철저히 하고, 충분한 휴식과 영양 섭취에 집중하세요.';
    }
    desc += '\n\n';
  } else {
  desc += '【직업/사회생활】 ';
  if (isExtremeWeak) {
    // 건강이 극도로 약한 사람: 에너지 레벨과 무관하게 건강 기반 조언
    desc += `이 10년의 운세 에너지는 ${rawStageData.energy >= 8 ? '높은 편' : rawStageData.energy >= 5 ? '중간 정도' : '낮은 편'}이지만, `;
    desc += `${weakOh}(${OHAENG_NAME[weakOh]}) 기운이 극도로 부족한 당신에게는 무조건적인 도전보다 건강을 지키면서 할 수 있는 범위 내에서의 성장이 중요합니다.\n`;
    desc += `피해야 할 환경: ${healthAdjust!.avoid}\n`;
    desc += `추천 방향: ${healthAdjust!.recommend}\n`;
    if (rawStageData.energy >= 8) {
      desc += `운의 에너지 자체는 좋으니, 몸에 무리가 가지 않는 방식으로 기회를 활용하세요. 재택 기반 프로젝트, 온라인 사업, 자격증 취득 등이 좋습니다.`;
    } else if (rawStageData.energy >= 5) {
      desc += `안정적인 흐름이니 현재 하고 있는 일을 꾸준히 이어가되, 체력 한계를 넘지 않도록 조절하세요.`;
    } else {
      desc += `에너지가 낮은 시기이므로 건강 회복에 최우선을 두세요. 무리한 취업활동이나 이직보다 치료와 안정이 먼저입니다.`;
    }
    const filteredCareer = filterCareerByHealth(stageData.career, weakOh, weakBal);
    if (filteredCareer) desc += ` ${filteredCareer}`;
    desc += '\n\n';
  } else if (rawStageData.energy >= 8) {
    const fc = filterCareerByHealth(stageData.career, weakOh, weakBal);
    desc += `에너지가 높아 적극적으로 도전할 수 있는 10년입니다. 승진, 이직, 창업 등 커리어의 큰 도약이 가능합니다. ${fc}\n\n`;
  } else if (rawStageData.energy >= 5) {
    const fc = filterCareerByHealth(stageData.career, weakOh, weakBal);
    desc += `안정적인 흐름 속에서 실력을 쌓을 수 있는 10년입니다. 급격한 변화보다 꾸준한 노력이 빛을 발합니다. ${fc}\n\n`;
  } else {
    const fc = filterCareerByHealth(stageData.career, weakOh, weakBal);
    desc += `외부 활동보다 내면의 성장과 준비에 집중하는 10년입니다. 지금 쌓는 내공이 다음 대운에서 빛을 발합니다. ${fc}\n\n`;
  }
  // 월주 십신 기반 직업 교차검증
  if (!isSenior && ctx) {
    const sipNote = addSipseongCareerNote(ctx);
    if (sipNote) desc += sipNote + '\n\n';
  }
  } // isSenior else 블록 닫기

  // 인간관계/연애 예측 — 60세+ 시니어는 가족 중심
  if (isSenior) {
    desc += '【가족·인간관계】 ';
    desc += '이 시기에는 배우자와의 동반자 관계, 자녀·손자녀와의 유대가 가장 소중합니다. ';
    desc += '오래된 친구들과의 교류를 유지하고, 건강이 허락하는 범위에서 가벼운 모임을 즐기세요. ';
    desc += '과거의 갈등이 있다면 이 시기에 화해하는 것이 마음의 평화를 가져다줍니다.\n\n';
  } else {
  // 인간관계/연애 예측 — 건강 교차분석 적용
  desc += '【인간관계】 ';
  if (isExtremeWeak && weakOh === '화') {
    // 화 부족 = 공황/불안 → 사교활동 조언 조정
    desc += `화(火) 부족으로 불안 증상이 있을 수 있어, 많은 사람을 만나는 것보다 소수의 편안한 관계에 집중하는 것이 좋습니다. `;
    desc += `1~2명의 정말 믿을 수 있는 사람과 깊은 관계를 유지하세요. 온라인 소통도 충분히 의미 있습니다. ${stageData.love}\n\n`;
  } else if (isExtremeWeak) {
    desc += `건강이 좋지 않을 때는 대인관계도 부담이 될 수 있습니다. 에너지를 빼앗는 관계는 정리하고, 진심으로 편안한 사람들과의 관계에 집중하세요. ${stageData.love}\n\n`;
  } else if (ganInteraction.relation === '비화') {
    desc += `같은 기운의 사람들을 만나기 쉽습니다. 친구, 동료와의 우정이 깊어지고, 같은 목표를 가진 사람들과 좋은 팀을 이룰 수 있습니다. ${stageData.love}\n\n`;
  } else if (ganInteraction.relation === '생아') {
    desc += `윗사람이나 스승 같은 존재가 나를 이끌어주는 시기입니다. 좋은 멘토를 만나거나 귀인의 도움이 있을 수 있습니다. ${stageData.love}\n\n`;
  } else if (ganInteraction.relation === '아생') {
    desc += `내가 주변 사람들을 돌보고 이끄는 역할을 하게 됩니다. 후배 양성, 가르치는 일에서 보람을 느끼지만, 에너지 소모에도 주의하세요. ${stageData.love}\n\n`;
  } else if (ganInteraction.relation === '극아') {
    desc += `대인 관계에서 갈등이나 경쟁이 생기기 쉬운 시기입니다. 상사나 경쟁자와의 마찰에 주의하되, 이를 통해 더 강해질 수 있습니다. ${stageData.love}\n\n`;
  } else {
    desc += `내가 상황을 주도하는 관계가 많아집니다. 리더십을 발휘하되, 상대방의 입장도 배려하면 더 좋은 관계를 만들 수 있습니다. ${stageData.love}\n\n`;
  }
  // 월주 십신 기반 연애/관계 교차검증
  if (!isSenior && ctx) {
    const loveSipNote = addSipseongLoveNote(ctx);
    if (loveSipNote) desc += loveSipNote + '\n\n';
  }
  } // isSenior 연애 else 블록 닫기

  // 건강 예측 — "부족해도 병, 지나쳐도 병" 양면 분석
  // 어린이(16세 미만)에겐 성인 질환 경고 대신 체질 특성만 간략히
  const isChild = startAge < 16;
  if (isChild) {
    desc += '【건강】 ';
    if (weakOh) {
      const CHILD_HEALTH: Record<Ohaeng, string> = {
        '목': '체력이 약한 편이니 충분한 수면과 균형 잡힌 식사가 중요해요. 바깥에서 뛰어노는 시간을 늘리면 좋아요!',
        '화': '겁이 많거나 소심해질 수 있어요. 따뜻하게 입히고, 자신감을 키워주는 칭찬이 중요해요!',
        '토': '편식하지 않도록 다양한 음식을 먹는 습관이 중요해요. 규칙적인 식사 시간을 지켜주세요!',
        '금': '감기에 잘 걸리거나 피부가 약할 수 있어요. 환기를 자주 하고 깨끗한 환경을 만들어주세요!',
        '수': '겁이 많거나 밤에 무서워할 수 있어요. 안정감을 주고, 물을 충분히 마시게 해주세요!',
      };
      desc += `${CHILD_HEALTH[weakOh]}\n\n`;
    } else {
      desc += `${stageData.health}\n\n`;
    }
  } else {
  desc += isSenior ? '【⚕️ 건강 — 이 시기의 핵심】 ' : '【건강】 ';

  // 시니어 건강 강조 프리픽스
  if (isSenior) {
    desc += `${startAge}세 이후는 건강이 모든 운의 전제 조건입니다. 아무리 좋은 운이 들어와도 건강이 뒷받침되지 않으면 활용할 수 없습니다. 정기 건강검진을 반드시 받고, 무리한 활동은 절대 피하세요.\n`;
  }

  // (1) 부족한 오행 → 건강 경고
  if (isExtremeWeak) {
    desc += `${OHAENG_EXTREME_HEALTH[weakOh]}\n`;
    desc += `이 대운에서 가장 중요한 것은 ${weakOh} 기운을 보충하는 것입니다. `;
    if (weakOh === '목') desc += '🍋 신맛 음식을 의식적으로 챙기세요. 추천 식재료: 식초, 레몬, 매실, 귤, 유자, 감귤류, 식초절임, 오미자. 🎨 청색(푸른색) 옷과 소품을 가까이하고, 푸른 나무가 있는 산이나 바다를 자주 찾으면 마음이 차분해집니다. 산림욕·산책이 최고의 보충법입니다. 간 기능 검사를 정기적으로 받으세요.';
    else if (weakOh === '화') desc += '☕ 쓴맛 음식을 의식적으로 챙기세요. 추천 식재료: 쑥, 더덕, 도라지, 씀바귀, 고들빼기, 여주, 민들레, 칡, 우엉, 수수, 다크초콜릿(70%+). 추천 차: 영지버섯차, 홍차, 보이차, 칡차, 자몽차, 쑥차(반드시 따뜻하게). 🍅 붉은색 식재료(토마토, 팥, 대추, 구기자, 석류, 비트, 소고기, 딸기, 홍파프리카)도 화 기운 보충에 좋습니다. 🎨 적색(붉은색)의 화사하고 밝은 옷을 입으면 화 기운이 보충됩니다. 남쪽 방향이 유리하며, 심장 관련 정기 검진을 꼭 받으세요.';
    else if (weakOh === '토') desc += '🍯 단맛 음식을 의식적으로 챙기세요. 추천 식재료: 꿀, 고구마, 호박, 대추, 밤, 잣, 찹쌀, 옥수수, 감, 참외, 바나나. 🎨 황색(노란색) 계열 옷과 소품을 가까이하면 좋습니다. 규칙적 식사가 가장 중요하며, 잡곡밥이 토 기운을 보충합니다. 위장 내시경을 정기적으로 받으세요.';
    else if (weakOh === '금') desc += '🌶️ 매운맛 음식을 의식적으로 챙기세요. 추천 식재료: 고추, 생강, 마늘, 양파, 겨자, 고추냉이(와사비), 후추, 부추, 파. 금 기운이 약하면 매운맛에 약한 경우가 많으니 조금씩 익숙해지는 연습이 필요합니다. 🎨 백색(흰색) 옷과 금속 소품(시계, 반지)을 적극 활용하세요. 깊은 호흡 운동, 폐 건강 관리가 핵심입니다.';
    else if (weakOh === '수') desc += '🧂 짠맛 음식을 의식적으로 보강하세요. 추천 식재료: 미역, 다시마, 김, 해조류, 된장, 간장, 검은콩, 흑미, 흑임자, 오징어, 새우젓. 🎨 흑색(검은색) 옷과 소품을 가까이 두면 수 기운이 채워집니다. 몸을 따뜻하게 유지하고, 허리 스트레칭, 수영·족욕이 좋습니다. 신장 기능 검사를 정기적으로 받으세요.';
    desc += '\n';
  }

  // (2) 과다한 오행 → 건강 경고 (부족과 별개로 추가 분석)
  const dominantOh = saju?.dominantOhaeng as Ohaeng | undefined;
  const dominantBal = dominantOh && saju?.ohaengBalance ? saju.ohaengBalance[dominantOh] : 0;
  if (dominantOh && dominantBal >= 4 && dominantOh !== weakOh) {
    desc += `${OHAENG_EXCESS_HEALTH[dominantOh]}\n`;
  }

  // (3) 12운성 기본 건강 조언
  if (!isExtremeWeak) {
    const daeunDominant = rawStageData.energy >= 5 ? ganOhaeng : jiOhaeng;
    desc += `이 시기에는 ${OHAENG_HEALTH_WEAK[daeunDominant]} `;
  }
  desc += `${stageData.health}\n`;

  // (4) 조후(한난조습) 분석 — 기후적 체질 건강
  if (saju?.ohaengBalance) {
    const johu = analyzeJohu(saju.ohaengBalance, weakOh, isExtremeWeak);
    if (johu.type !== '균형') {
      desc += `\n${johu.healthWarning}\n${johu.tasteAdvice}\n${johu.exerciseAdvice}`;
    }
  }
  // (5) 신강/신약 체질 분석
  if (saju) {
    const singang = analyzeSingang(saju);
    desc += `\n${singang.personality}\n${singang.healthAdvice}\n${singang.exerciseAdvice}`;
  }
  desc += '\n';

  // (6) 개운법(開運) — 오행 부족/과다에 따른 실용적 루틴
  if (saju) {
    const weakOhK = saju.weakestOhaeng as Ohaeng | undefined;
    const domOhK = saju.dominantOhaeng as Ohaeng | undefined;
    const GAEUN: Record<Ohaeng, string> = {
      '목': '🌿 목 보충 개운: 자연 속 산책·산림욕, 새로운 도전·기획, 녹색 식물 가까이, 동쪽 방향 활용',
      '화': '🔥 화 보충 개운: 에너지 강한 장소(산 정상 등) 방문, 적극적 자기표현, 붉은색·남쪽 활용, 따뜻한 차 마시기',
      '토': '🏔️ 토 보충 개운: 규칙적 생활 루틴 확립, 신뢰 쌓는 관계, 황색·노란색 활용, 안정적 환경 조성',
      '금': '⚔️ 금 보충 개운: 불필요한 것 정리·결단, 깨끗한 공간 유지, 흰색·금속 소품 활용, 서쪽 방향',
      '수': '💧 수 보충 개운: 독서·명상으로 내면 깊이, 검은색·북쪽 활용, 수영·족욕, 조용한 사색 시간 확보',
    };
    const GAEUN_EXCESS: Record<Ohaeng, string> = {
      '목': '🍃 목 과다 해소: 금 기운(결단·정리) 활동으로 과잉 에너지 수렴, 분노 조절 훈련',
      '화': '💨 화 과다 해소: 수 기운(수영·명상·독서) 활동으로 열 식히기, 차분한 취미 시작',
      '토': '🌱 토 과다 해소: 목 기운(새로운 도전·변화) 활동으로 정체 탈출, 여행·이사 고려',
      '금': '🔥 금 과다 해소: 화 기운(사교·표현·운동) 활동으로 냉정함 완화, 따뜻한 관계 구축',
      '수': '🏔️ 수 과다 해소: 토 기운(규칙·안정·루틴) 활동으로 감정 동요 다스리기, 규칙적 생활',
    };
    let gaeunText = '';
    const gBal = saju.ohaengBalance;
    if (weakOhK && gBal[weakOhK] <= 1.5) gaeunText += GAEUN[weakOhK];
    if (domOhK && gBal[domOhK] >= 4 && domOhK !== weakOhK) gaeunText += (gaeunText ? '\n' : '') + GAEUN_EXCESS[domOhK];

    // 무오행(결핍 십신) 개운
    const sipLacking = saju.sipseongBalance?.lacking || [];
    if (sipLacking.some((s: string) => s.includes('비겝') || s.includes('비겁'))) {
      gaeunText += '\n🏠 비겁 부족 개운: 독립 생활(자취), 스스로 돈 벌기(아르바이트), 주체적 의사결정 연습';
    }
    if (sipLacking.some((s: string) => s.includes('식상'))) {
      gaeunText += '\n🎨 식상 부족 개운: 취미·창작 활동, 감정 표현 연습(일기·수다), 요리·운동 시작';
    }

    // 풍수 개운
    gaeunText += '\n🏡 공간 개운: 안 입는 옷·고장난 물건 버리기, 현관 청결 유지, 뾰족한 식물·마주보는 거울 제거';

    if (gaeunText) desc += `\n【🍀 개운법(開運)】\n${gaeunText}\n`;
  }

  } // isChild else 블록 닫기

  // 구체적 행동 조언 — 건강 상태에 따라 처음부터 맞는 조언 제공
  desc += '【이 시기를 잘 보내는 법】 ';
  if (isExtremeWeak && weakOh) {
    // 건강 극약자: 원본 조언 대신 건강에 맞는 대체 조언을 처음부터 제공
    const HEALTH_ADJUSTED_ADVICE: Record<Ohaeng, Record<string, string>> = {
      '화': {
        // 화 부족 = 불안/공황 → 대중 노출·경쟁·적극적 활동 대체
        '관대': '온라인이나 글쓰기를 통해 자신을 표현하세요. 대면 발표·면접보다 포트폴리오·블로그·영상 등 비대면 방식이 불안 없이 자신을 드러내는 좋은 방법입니다. 이미지 관리도 사진 위주로 차분하게 준비하세요.',
        '건록': '실력을 쌓되 경쟁적 환경은 피하세요. 조용히 전문성을 키우는 온라인 학습, 자격증 준비, 1인 프로젝트가 적합합니다.',
        '제왕': '기회가 와도 무리하게 확장하지 마세요. 작은 규모에서 확실한 성과를 내는 것이 건강을 지키면서 성장하는 방법입니다.',
        _default: '무리한 사회 활동보다 자기 내면을 가꾸는 데 집중하세요. 명상, 일기 쓰기, 가벼운 산책이 불안을 다스리는 데 효과적입니다.',
      },
      '목': {
        _default: '새벽 기상이나 강도 높은 운동 대신 가벼운 요가·산책으로 대체하세요. 간·근육에 무리를 주지 않는 선에서 꾸준히 움직이는 것이 최선입니다. 충분한 수면과 규칙적인 스트레칭이 이 시기의 핵심입니다.',
      },
      '토': {
        _default: '바쁘게 뛰어다니기보다 규칙적 식사를 최우선으로 하세요. 일정을 여유 있게 잡고, 소화에 부담 가는 야식이나 폭식을 피하세요. 따뜻한 음식, 제때 먹는 식사가 이 시기 최고의 전략입니다.',
      },
      '금': {
        _default: '대규모 모임이나 밀폐된 공간보다 야외 활동이나 소규모 만남을 택하세요. 호흡기를 보호하면서도 꾸준히 관계를 유지하는 것이 중요합니다. 공기 좋은 곳에서의 가벼운 운동이 좋습니다.',
      },
      '수': {
        '묘': '장시간 앉아서 공부하기보다 50분 작업 후 반드시 10분 스트레칭을 하세요. 부동산·투자 검토는 좋지만, 앉아서 분석하는 시간이 길어지면 허리에 부담이 됩니다. 서서 일하는 습관을 들이세요.',
        _default: '장시간 좌식을 피하고, 적절히 움직이면서 일하세요. 허리·신장 보호가 최우선이니 50분 활동 후 10분 휴식을 습관화하세요. 따뜻한 환경에서 몸을 보온하며 활동하는 것이 이 시기의 핵심입니다.',
      },
    };
    const ohAdvice = HEALTH_ADJUSTED_ADVICE[weakOh];
    desc += ohAdvice[twelveStage] || ohAdvice['_default'] || TWELVE_STAGE_ACTION_ADVICE[twelveStage];
  } else if (weakOh && weakBal <= 3) {
    // 약한 오행: 원본 조언 + 건강 주의사항 한 줄 추가
    const filteredAdvice = filterCareerByHealth(TWELVE_STAGE_ACTION_ADVICE[twelveStage], weakOh, weakBal);
    desc += filteredAdvice;
  } else {
    desc += TWELVE_STAGE_ACTION_ADVICE[twelveStage];
  }

  // 자녀 유무 기반 텍스트 보정
  if (saju) {
    desc = adjustTextByChildren(desc, saju.hasChildren);
  }

  return desc;
}

// ========== 세운 (歲運) ==========

export interface SeunAreaScores {
  study: number;   // 학업/자격증운 (2~9)
  money: number;   // 재물운 (2~9)
  love: number;    // 연애/결혼운 (2~9)
  health: number;  // 건강운 (2~9)
  career: number;  // 직업/사업운 (2~9)
}

export interface SeunResult {
  year: number;
  cheongan: string;
  jiji: string;
  cheonganOhaeng: Ohaeng;
  jijiOhaeng: Ohaeng;
  animal: string;
  twelveStage: TwelveStage;
  overallScore: number; // 2~9
  areaScores: SeunAreaScores; // 영역별 세부 점수
  description: string;
  love: string;
  money: string;
  career: string;
  health: string;
  // 고급 분석 (격국·조후·대운 교차)
  gyeokguk?: GyeokgukResult;
  johu?: JohuResult;
  daeunCross?: DaeunSeunCross;
  // 신년운세 상세 데이터
  balanceAnalysis?: string;      // 오행 밸런스 변화 분석
  monthlyHighlights?: string;    // 월별 하이라이트 (최고/주의 달)
  jijangganAnalysis?: string;    // 지장간 분석
  luckyInfo?: string;            // 행운 정보 (색상/방위/숫자/개운법)
  sipseong?: string;             // 세운 십성
  specialNotes?: string[];       // 특수관계 메모 (합충형파해 등)
  familyNotes?: string[];        // 가족관계(궁위) 해석 메모
}

const ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

/**
 * 세운 (해당 연도의 운세) 계산
 */
export function calculateSeun(
  saju: SajuResult,
  targetYear: number,
  currentDaeun?: DaeunPillar | null,
): SeunResult {
  // 세운 간지 계산
  const ganIdx = (targetYear - 4) % 10;
  const jiIdx = (targetYear - 4) % 12;
  const cheongan = CHEONGAN[(ganIdx + 10) % 10];
  const jiji = JIJI[(jiIdx + 12) % 12];

  const cheonganOhaeng = CHEONGAN_OHAENG[cheongan];
  const jijiOhaeng = JIJI_OHAENG[jiji];
  const animal = ANIMALS[(jiIdx + 12) % 12];

  const ilOhaeng = CHEONGAN_OHAENG[saju.ilgan];
  const twelveStage = calculateTwelveStage(saju.ilgan, jiji);
  const stageData = TWELVE_STAGE_DATA[twelveStage];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 세운 점수 종합 계산 (입체적 다층 분석)
  // 희기신5단계 + 밸런스시뮬 + 생극제화 + 원국상호작용 + 십성×신강신약 + 합충 + 신살 + 격국 + 조후
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // base = 5 (중립)
  let score = 5;

  // ① 12운성 에너지 보정 (±1.35 범위)
  const energyMod = (stageData.energy - 5.5) * 0.3;
  score += energyMod;

  // ② 희기신(喜忌神) 5단계 판별 — 용신/기신 이분법 → 용신/희신/한신/기신/구신
  const seunSipseong = calculateSipseong(saju.ilgan, cheongan);
  const isJeongSS = seunSipseong === '정재' || seunSipseong === '정관' || seunSipseong === '정인' || seunSipseong === '식신';

  const ganClass = classifyHeegishin(cheonganOhaeng, saju.yongsin, saju.gisin, ilOhaeng);
  const jiClass = classifyHeegishin(jijiOhaeng, saju.yongsin, saju.gisin, ilOhaeng);

  // 정계열 길신이면 기신/구신 감점 완화
  const ganW = (ganClass.weight < 0 && isJeongSS) ? ganClass.weight * 0.5 : ganClass.weight;
  const jiW = (jiClass.weight < 0 && isJeongSS) ? jiClass.weight * 0.5 : jiClass.weight;
  score += ganW;
  score += jiW;

  // 천간+지지 모두 용신이면 시너지 보너스
  if (ganClass.role === '용신' && jiClass.role === '용신') score += 0.5;
  if (ganClass.role === '기신' && jiClass.role === '기신') score -= 0.5;
  // 천간 용신 + 지지 희신 (또는 반대)도 시너지
  if ((ganClass.role === '용신' && jiClass.role === '희신') || (ganClass.role === '희신' && jiClass.role === '용신')) score += 0.3;

  // ③ 오행 밸런스 변화 시뮬레이션
  const { balanceMod } = simulateBalanceChange(saju.ohaengBalance, cheonganOhaeng, jijiOhaeng);
  score += balanceMod * 0.7; // 세운은 밸런스 영향 70% 반영 (더 직접적)

  // ④ 천간-지지 간 생극제화
  const { ganJiMod } = analyzeGanJiRelation(cheonganOhaeng, jijiOhaeng, ilOhaeng);
  score += ganJiMod;

  // ④-2 원국 글자와의 생극 상호작용
  const { interactionMod } = analyzeWonGukInteraction(saju, cheonganOhaeng, jijiOhaeng);
  score += interactionMod;

  // ⑤ 십성 × 신강/신약 교차 보정
  const ilOhBal = saju.ohaengBalance?.[ilOhaeng] || 3;
  const ss2 = saju.strengthScore;
  const isExtSingang = ss2 != null ? ss2 >= 65 : ilOhBal >= 6;
  const isExtSinyak = ss2 != null ? ss2 < 15 : ilOhBal <= 1.5;
  const isSingang = ss2 != null ? ss2 >= 40 : ilOhBal >= 4.5;
  const isSinyak = ss2 != null ? ss2 < 25 : ilOhBal <= 2.5;

  const isBigyeop = seunSipseong === '비견' || seunSipseong === '겁재';
  const isInseong = seunSipseong === '편인' || seunSipseong === '정인';
  const isSiksang = seunSipseong === '식신' || seunSipseong === '상관';
  const isJaeseong = seunSipseong === '편재' || seunSipseong === '정재';
  const isPyeonGwan = seunSipseong === '편관';
  const isJeongGwan = seunSipseong === '정관';

  let sipMod = 0;
  if (isExtSingang) {
    if (isBigyeop) sipMod = -1.2;
    if (isInseong) sipMod = -0.8;
    if (isSiksang) sipMod = +1.2;
    if (isJaeseong) sipMod = +0.8;
    if (isPyeonGwan) sipMod = -1.0;
    if (isJeongGwan) sipMod = +0.3;
  } else if (isExtSinyak) {
    if (isBigyeop) sipMod = +1.2;
    if (isInseong) sipMod = +1.2;
    if (isPyeonGwan) sipMod = -1.2;
    if (isJeongGwan) sipMod = -0.7;
    if (isJaeseong) sipMod = -0.8;
    if (isSiksang) sipMod = -0.3;
  } else if (isSingang) {
    if (isBigyeop) sipMod = -0.4;
    if (isInseong) sipMod = -0.3;
    if (isSiksang) sipMod = +0.7;
    if (isJaeseong) sipMod = +0.4;
  } else if (isSinyak) {
    if (isBigyeop) sipMod = +0.4;
    if (isInseong) sipMod = +0.7;
    if (isPyeonGwan) sipMod = -0.7;
    if (isJeongGwan) sipMod = -(isJeongSS ? 0.2 : 0.4);
    if (isJaeseong) sipMod = -(isJeongSS ? 0.1 : 0.4);
  }
  score += sipMod;

  // 십성 품질 보너스 (정계열 기본 가산)
  if (seunSipseong === '정재') score += 0.4;
  else if (seunSipseong === '정관') score += 0.3;
  else if (seunSipseong === '정인') score += 0.3;
  else if (seunSipseong === '식신') score += 0.3;
  else if (seunSipseong === '겁재') score -= 0.2;
  else if (seunSipseong === '상관') score -= 0.1;

  // ⑤-2 지장간 분석 — 희기신 5단계로 판별
  const jangganList = JIJI_JANGGAN[jiji] || [];
  let jangganMod = 0;
  for (const jg of jangganList) {
    const jgOhaeng = CHEONGAN_OHAENG[jg];
    const jgClass = classifyHeegishin(jgOhaeng, saju.yongsin, saju.gisin, ilOhaeng);
    jangganMod += jgClass.weight * 0.2; // 지장간은 20% 가중치
  }
  // 사령(본기)은 추가 가중치
  const saryeong = getSaryeong(jiji);
  if (saryeong) {
    const saryeongOhaeng = CHEONGAN_OHAENG[saryeong];
    const saryeongClass = classifyHeegishin(saryeongOhaeng, saju.yongsin, saju.gisin, ilOhaeng);
    jangganMod += saryeongClass.weight * 0.2;
  }
  score += jangganMod;

  // ⑥ 합충형파해 분석 — 세운 지지 ↔ 사주 원국 지지
  const sajuJijis = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  const PILLAR_NAMES = ['년지', '월지', '일지', '시지'];
  let hapchungMod = 0;
  // 텍스트용 특수관계 수집
  const specialNotes: string[] = [];

  // 지지충 (대립/변동)
  const JIJI_CHUNG: Record<string, string> = {
    '자': '오', '오': '자', '축': '미', '미': '축',
    '인': '신', '신': '인', '묘': '유', '유': '묘',
    '진': '술', '술': '진', '사': '해', '해': '사',
  };
  const chungTarget = JIJI_CHUNG[jiji];
  let chungCount = 0;
  for (const sj of sajuJijis) {
    if (sj === chungTarget) chungCount++;
  }
  // 충 = 변동. 용신 오행 충이면 나쁨, 기신 오행 충이면 기신 파괴로 좋을 수 있음
  if (chungCount > 0) {
    const chungTargetOhaeng = JIJI_OHAENG[chungTarget];
    const chungPillars = sajuJijis.map((sj, i) => sj === chungTarget ? PILLAR_NAMES[i] : null).filter(Boolean);
    const chungPillarStr = chungPillars.join('·');
    // 충이 어떤 주(柱)를 치느냐에 따라 영향 영역이 다름
    const chungRel = saju.relationship || 'single';
    const chungDayArea = chungRel === 'married' ? '나 자신·배우자·건강·가정' : chungRel === 'dating' ? '나 자신·연인·건강·내면' : '나 자신·건강·내면·생활패턴';
    const chungAreaMap: Record<string, string> = {
      '년지': '조상·사회적 환경·외부 변동',
      '월지': '직장·부모·사회활동·재물 흐름',
      '일지': chungDayArea,
      '시지': saju.hasChildren ? '자녀·가정·후배·말년' : '미래 계획·후배·말년',
    };
    const affectedAreas = chungPillars.map(p => chungAreaMap[p as string] || '').filter(Boolean).join(' / ');

    if (chungTargetOhaeng === saju.yongsin) {
      hapchungMod -= 0.5 * chungCount;
      specialNotes.push(`⚡ 지지충(${jiji}↔${chungTarget}): ${chungPillarStr}의 용신(${saju.yongsin}) 자리를 흔들어 불안정합니다.\n   📍 영향 영역: ${affectedAreas}\n   🔮 용신이 충을 맞으면 그동안 잘 풀리던 일에 갑작스러운 장애가 생기거나, 도움을 주던 사람과의 관계가 흔들릴 수 있습니다.\n   💡 대처법: 큰 변동(이사·이직·계약)은 반드시 2~3번 재확인하세요. 용신(${saju.yongsin}) 기운을 보충하는 활동(${saju.yongsin === '금' ? '폐 호흡 운동·등산·금속공예' : saju.yongsin === '수' ? '수영·명상·독서' : saju.yongsin === '목' ? '등산·식물가꾸기·스트레칭' : saju.yongsin === '화' ? '운동·열정적 활동·예술' : '요가·원예·맨발걷기'})으로 안정을 찾으세요.\n   ⏰ 가장 조심할 시기: ${chungTarget === '자' || chungTarget === '축' ? '겨울(11~1월)' : chungTarget === '인' || chungTarget === '묘' ? '봄(2~4월)' : chungTarget === '사' || chungTarget === '오' ? '여름(5~7월)' : chungTarget === '신' || chungTarget === '유' ? '가을(8~10월)' : chungTarget === '진' || chungTarget === '미' ? '환절기(3·6·9·12월)' : '환절기'}에 충의 기운이 가장 강해집니다.`);
    } else if (chungTargetOhaeng === saju.gisin) {
      hapchungMod += 0.5 * chungCount;
      specialNotes.push(`💥 지지충(${jiji}↔${chungTarget}): ${chungPillarStr}의 기신(${saju.gisin}) 기운을 깨뜨립니다!\n   📍 영향 영역: ${affectedAreas}\n   🔮 기신이 충을 맞으면 "전화위복"의 기운입니다. 그동안 발목을 잡던 나쁜 습관·환경·인간관계가 깨지면서 새로운 돌파구가 열릴 수 있습니다. 초반에는 혼란스럽지만 결과적으로 좋은 방향으로 흘러갑니다.\n   💡 활용법: 기신(${saju.gisin}) 기운이 약해지는 틈을 타서 묵혀둔 계획을 실행하세요. 변화를 두려워하지 말고 적극적으로 움직이면 큰 전환점이 됩니다.\n   ⏰ 전환의 시기: ${jiji === '자' || jiji === '축' ? '겨울(11~1월)' : jiji === '인' || jiji === '묘' ? '봄(2~4월)' : jiji === '사' || jiji === '오' ? '여름(5~7월)' : jiji === '신' || jiji === '유' ? '가을(8~10월)' : '환절기'}에 변화의 기운이 가장 강합니다.`);
    } else {
      hapchungMod -= 0.3 * chungCount;
      specialNotes.push(`⚡ 지지충(${jiji}↔${chungTarget}): ${chungPillarStr}과 충돌합니다.\n   📍 영향 영역: ${affectedAreas}\n   🔮 충(沖)은 "파괴와 재건"의 에너지입니다. 기존의 안정적 상태가 흔들리고 예상치 못한 변화가 찾아옵니다. 이사·이직·이별·사고 등 급격한 변동이 생길 수 있으나, 준비된 사람에게는 새 출발의 기회이기도 합니다.\n   💡 대처법: ①큰 계약·이동은 꼼꼼히 서류 확인 ②감정적 충돌을 피하고 대화로 해결 ③무리한 스케줄을 줄이고 충분히 쉬기 ④충의 시기에 새 일을 시작하기보다 기존 일을 정리하는 데 집중\n   ⏰ 특히 ${chungTarget}월(${chungTarget === '자' ? '11' : chungTarget === '축' ? '12' : chungTarget === '인' ? '1' : chungTarget === '묘' ? '2' : chungTarget === '사' ? '4' : chungTarget === '오' ? '5' : chungTarget === '미' ? '6' : chungTarget === '신' ? '7' : chungTarget === '유' ? '8' : chungTarget === '술' ? '9' : chungTarget === '해' ? '10' : '?'}월경)에 변동이 집중될 수 있습니다.`);
    }
    if (saju.day.jiji === chungTarget) {
      hapchungMod -= 0.3;
      const dayChungRel = saju.relationship || 'single';
      const dayChungEffect = dayChungRel === 'married'
        ? '건강 악화·배우자와의 갈등·심리적 불안이 올 수 있습니다.'
        : dayChungRel === 'dating'
          ? '건강 변화·연인과의 갈등·심리적 불안이 올 수 있습니다.'
          : '건강 변화·심리적 불안·생활패턴의 변동이 올 수 있습니다.';
      const dayChungAdvice = dayChungRel === 'married'
        ? '①연 1회 종합검진 필수 ②배우자와 정기적 대화 시간 확보 ③중요한 결정은 혼자 하지 말고 신뢰할 수 있는 사람과 상의'
        : dayChungRel === 'dating'
          ? '①연 1회 종합검진 필수 ②연인과 솔직한 대화 시간 확보 ③중요한 결정은 혼자 하지 말고 신뢰할 수 있는 사람과 상의'
          : '①연 1회 종합검진 필수 ②감정 기복에 주의하고 규칙적 생활 유지 ③중요한 결정은 혼자 하지 말고 신뢰할 수 있는 사람과 상의';
      specialNotes.push(`🔺 일지(${saju.day.jiji}) 충 — 가장 주의!\n   나 자신의 자리(일지)가 직접 흔들리므로 ${dayChungEffect}\n   💡 대처법: ${dayChungAdvice}`);
    }
    if (saju.year.jiji === chungTarget) {
      specialNotes.push(`🔺 년지(${saju.year.jiji}) 충: 사회적 환경·직장·외부 여건에서 변동이 옵니다. 경제 상황이나 업계 트렌드 변화에 민감하게 대응하세요.`);
    }
    if (saju.month.jiji === chungTarget) {
      specialNotes.push(`🔺 월지(${saju.month.jiji}) 충: 직장·사업·재물의 기반이 흔들릴 수 있습니다. 직장 내 인사이동이나 업무 변경에 유연하게 대처하세요. 부모님 건강도 살펴보세요.`);
    }
    if (saju.hour.jiji === chungTarget) {
      specialNotes.push(saju.hasChildren
        ? `🔺 시지(${saju.hour.jiji}) 충: 자녀·가정과 관련된 변동이 있을 수 있습니다. 자녀 교육·진로 결정에 신중하세요.`
        : `🔺 시지(${saju.hour.jiji}) 충: 미래 계획·후배와 관련된 변동이 있을 수 있습니다. 투자·사업 확장 등 미래 설계에 신중하세요.`);
    }
  }

  // 합 카운트 (영역별 텍스트에 전달용)
  let hapCount = 0;

  // 육합 (조화/안정)
  const YUKHAP: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };
  const yukhapTarget = YUKHAP[jiji];
  // 육합의 결과 오행
  const YUKHAP_RESULT: Record<string, Ohaeng> = {
    '자축': '토', '축자': '토', '인해': '목', '해인': '목',
    '묘술': '화', '술묘': '화', '진유': '금', '유진': '금',
    '사신': '수', '신사': '수', '오미': '화', '미오': '화',
  };
  for (let idx = 0; idx < sajuJijis.length; idx++) {
    if (sajuJijis[idx] === yukhapTarget) {
      hapchungMod += 0.3;
      hapCount++;
      const yukhapKey = `${jiji}${yukhapTarget}` as string;
      const resultOh = YUKHAP_RESULT[yukhapKey] || '토';
      const rel = saju.relationship || 'single';
      const dayAreaText = rel === 'married' ? '나 자신·배우자·가정' : rel === 'dating' ? '나 자신·연인·내면' : '나 자신·내면·건강';
      const pillarArea: Record<string, string> = {
        '년지': '사회적 환경·조상·외부 인연',
        '월지': '직장·부모·사회활동',
        '일지': dayAreaText,
        '시지': saju.hasChildren ? '자녀·가정·후배' : '미래·후배·프로젝트',
      };
      const area = pillarArea[PILLAR_NAMES[idx]] || '';
      const isYongResult = resultOh === saju.yongsin;
      const isGiResult = resultOh === saju.gisin;
      let yukhapDetail = `🤝 육합(${jiji}+${yukhapTarget}→${OHAENG_NAME[resultOh]}): ${PILLAR_NAMES[idx]}과 합을 이룹니다.`;
      yukhapDetail += `\n   📍 영향 영역: ${area}`;
      yukhapDetail += `\n   🔮 육합은 "끌어당김·화합·결합"의 기운입니다. ${PILLAR_NAMES[idx]}이 나타내는 ${area} 분야에서 좋은 인연이나 협력 관계가 형성됩니다.`;
      if (isYongResult) {
        yukhapDetail += `\n   ⭐ 합의 결과가 용신(${saju.yongsin})! 최고의 길합(吉合)입니다. 이 인연·협력은 당신에게 실질적인 이익과 안정을 가져다줍니다.`;
      } else if (isGiResult) {
        yukhapDetail += `\n   ⚠️ 합의 결과가 기신(${saju.gisin})이므로 겉으로는 좋아 보이지만 결과가 나쁠 수 있습니다. "좋은 게 좋은 것"이라며 모든 인연을 받아들이지 마세요.`;
      }
      yukhapDetail += `\n   💡 활용법: 올해 새로운 만남·제안·협력 기회가 오면 적극적으로 받아들이세요. 특히 ${PILLAR_NAMES[idx] === '일지' ? '연애·결혼·동업' : PILLAR_NAMES[idx] === '월지' ? '직장 내 협업·멘토 관계' : PILLAR_NAMES[idx] === '년지' ? '사회적 네트워킹·소개' : '후배와의 협력·교육 사업'}에 유리합니다.`;
      specialNotes.push(yukhapDetail);
      break;
    }
  }

  // 삼합 확인 (세운 지지가 사주 원국 지지 2개와 삼합을 이루면)
  const SAMHAP_GROUPS = [
    { members: ['해', '묘', '미'], result: '목' as Ohaeng },
    { members: ['인', '오', '술'], result: '화' as Ohaeng },
    { members: ['사', '유', '축'], result: '금' as Ohaeng },
    { members: ['신', '자', '진'], result: '수' as Ohaeng },
  ];
  for (const group of SAMHAP_GROUPS) {
    if (!group.members.includes(jiji)) continue;
    const others = group.members.filter(m => m !== jiji);
    const matchCount = others.filter(o => sajuJijis.includes(o)).length;
    if (matchCount >= 2) {
      hapCount++;
      const matchedPillars = others.map(o => {
        const pIdx = sajuJijis.indexOf(o);
        return pIdx >= 0 ? PILLAR_NAMES[pIdx] : null;
      }).filter(Boolean);
      const samhapOhName = OHAENG_NAME[group.result];
      if (group.result === saju.yongsin) {
        hapchungMod += 1.5;
        specialNotes.push(`🔱 삼합 ${group.members.join('·')}(→${samhapOhName}): 용신(${saju.yongsin}) 삼합 완성!\n   📍 관련 주: ${matchedPillars.join('·')}과 세운 지지(${jiji})가 삼합\n   🔮 올해 가장 강력한 길신(吉神) 작용입니다! 세 글자가 모여 용신 ${samhapOhName} 기운을 극대화시킵니다. 하는 일마다 순풍이 불고, 주변의 도움이 자연스럽게 모입니다.\n   💡 활용법: ①올해 계획했던 일을 과감히 실행하세요 ②팀 프로젝트·동업·협력 사업에 최적의 해 ③용신(${saju.yongsin}) 관련 활동(${saju.yongsin === '금' ? '금융·기술·정밀업' : saju.yongsin === '수' ? '유통·물류·교육' : saju.yongsin === '목' ? '창업·교육·건강' : saju.yongsin === '화' ? '예술·홍보·미디어' : '부동산·농업·중개'})을 적극 추진\n   ⏰ 삼합의 기운은 연중 꾸준하지만, 세운 지지(${jiji})와 같은 달에 정점을 찍습니다.`);
      } else if (group.result === saju.gisin) {
        hapchungMod -= 1.5;
        specialNotes.push(`⚠️ 삼합 ${group.members.join('·')}(→${samhapOhName}): 기신(${saju.gisin}) 삼합 완성!\n   📍 관련 주: ${matchedPillars.join('·')}과 세운 지지(${jiji})가 삼합\n   🔮 기신 ${samhapOhName} 기운이 세 글자의 결합으로 극대화됩니다. 올해 가장 경계해야 할 흉신(凶神) 작용으로, 불리한 상황이 겹쳐서 올 수 있습니다.\n   💡 대처법: ①과감한 도전·투자·확장은 절대 삼가 ②기존 것을 지키는 수성(守成) 전략으로 일관 ③기신(${saju.gisin}) 기운을 설기(泄氣)하는 활동 필요 — ${saju.gisin === '화' ? '토(土) 활동: 원예·도예·안정적 루틴' : saju.gisin === '목' ? '화(火) 활동: 운동·열정적 취미' : saju.gisin === '토' ? '금(金) 활동: 기술·규율·정리정돈' : saju.gisin === '금' ? '수(水) 활동: 명상·독서·여행' : '목(木) 활동: 산책·스트레칭·새 도전'}\n   ⏰ 특히 삼합 글자가 모이는 달(${group.members.map(m => m === '자' ? '11월' : m === '축' ? '12월' : m === '인' ? '1월' : m === '묘' ? '2월' : m === '진' ? '3월' : m === '사' ? '4월' : m === '오' ? '5월' : m === '미' ? '6월' : m === '신' ? '7월' : m === '유' ? '8월' : m === '술' ? '9월' : '10월').join('·')})에 영향이 집중됩니다.`);
      } else {
        hapchungMod += 0.5;
        specialNotes.push(`🔱 삼합 ${group.members.join('·')}(→${samhapOhName}): 삼합 완성!\n   📍 관련 주: ${matchedPillars.join('·')}과 세운 지지(${jiji})가 삼합\n   🔮 삼합은 세 글자가 의기투합하여 강한 에너지장을 형성합니다. ${samhapOhName} 기운이 크게 강화되어 관련 분야에서 큰 시너지가 기대됩니다.\n   💡 활용법: 팀워크와 협력이 빛을 발하는 해입니다. 혼자 하는 일보다 함께 하는 일에서 성과가 큽니다. ${samhapOhName === '목' ? '새로운 시작·교육·건강 분야' : samhapOhName === '화' ? '열정·예술·홍보 분야' : samhapOhName === '토' ? '부동산·중개·안정 분야' : samhapOhName === '금' ? '기술·금융·정밀 분야' : '유통·무역·지식 분야'}에서 특히 좋습니다.`);
      }
    } else if (matchCount === 1) {
      const matched = others.find(o => sajuJijis.includes(o));
      const matchedIdx = sajuJijis.indexOf(matched!);
      const matchedPillar = matchedIdx >= 0 ? PILLAR_NAMES[matchedIdx] : '';
      if (group.result === saju.yongsin) {
        hapchungMod += 0.5;
        specialNotes.push(`🔗 반합(${jiji}+${matched}→${OHAENG_NAME[group.result]}): ${matchedPillar}과 반합을 이루어 용신(${saju.yongsin}) 방향으로 은근한 도움이 있습니다.\n   🔮 삼합이 완전히 이루어지지는 않았지만, 두 글자만으로도 용신 기운이 강화됩니다. 나머지 한 글자(${others.find(o => !sajuJijis.includes(o))})가 대운이나 다음 세운에서 채워지면 완전한 삼합이 됩니다.\n   💡 올해는 "준비의 해"입니다. 지금 쌓아놓은 기반이 나중에 큰 결실로 돌아옵니다.`);
      } else if (group.result === saju.gisin) {
        hapchungMod -= 0.5;
        specialNotes.push(`🔗 반합(${jiji}+${matched}→${OHAENG_NAME[group.result]}): ${matchedPillar}과 기신(${saju.gisin}) 방향의 반합이 형성됩니다.\n   🔮 완전한 삼합은 아니지만 기신 기운이 서서히 강해지는 조짐입니다. 올해 무리하지 않고 조심하면 큰 문제는 없지만, 방심은 금물입니다.`);
      }
    }
  }

  // 방합(方合) 점수 반영 — 동일 방위 3지지 결집
  const BANGHAP_SEUN: { members: string[]; result: Ohaeng }[] = [
    { members: ['인', '묘', '진'], result: '목' },
    { members: ['사', '오', '미'], result: '화' },
    { members: ['신', '유', '술'], result: '금' },
    { members: ['해', '자', '축'], result: '수' },
  ];
  for (const bg of BANGHAP_SEUN) {
    const allJijis = [...sajuJijis, jiji];
    const matchCount = bg.members.filter(m => allJijis.includes(m)).length;
    const seunInGroup = bg.members.includes(jiji);
    if (seunInGroup && matchCount >= 3) {
      if (bg.result === saju.yongsin) {
        hapchungMod += 1.0;
      } else if (bg.result === saju.gisin) {
        hapchungMod -= 1.0;
      } else {
        hapchungMod += 0.3;
      }
    }
  }

  // 지지형 (刑) — 마찰/갈등/법적 문제
  // 형(刑)의 종류별 상세 해석
  const HYUNG_TYPES: { pair: [string, string]; type: string; detail: string; advice: string }[] = [
    { pair: ['인', '사'], type: '무은지형(無恩之刑)', detail: '은혜를 원수로 갚는 형입니다. 도와준 사람에게 배신당하거나, 내가 도운 사람이 뒤통수를 칠 수 있습니다. 직장에서의 배신·동업자 갈등·친구 사이 금전 분쟁이 대표적입니다.', advice: '①보증·대출 보증 절대 금지 ②동업 계약 시 서면으로 꼼꼼히 ③"좋은 게 좋은 것"이라며 구두 약속으로 넘어가지 마세요 ④법률 분쟁 시 감정 대응 말고 전문가(변호사) 상담' },
    { pair: ['사', '신'], type: '무은지형(無恩之刑)', detail: '은혜를 원수로 갚는 형입니다. 자신이 베푼 호의가 되돌아오지 않거나, 신뢰했던 관계에서 균열이 생깁니다. 특히 금전 관련 배신에 주의하세요.', advice: '①금전 거래 시 반드시 서류 남기기 ②감정에 휘둘려 충동 결정 금지 ③의심이 드는 제안은 48시간 냉각기 후 결정' },
    { pair: ['인', '신'], type: '무은지형(無恩之刑)', detail: '은혜를 모르는 형으로, 인(寅)의 시작하는 힘과 신(申)의 마무리하는 힘이 정면충돌합니다. 계획을 세워도 중간에 뒤엎어지거나, 방향 전환이 잦아집니다.', advice: '①한 가지 일에 끝까지 집중 ②시작과 마무리를 동시에 하려다 모두 놓치지 않도록 ③우선순위를 명확히 세우세요' },
    { pair: ['축', '술'], type: '무례지형(無禮之刑)', detail: '예의와 질서가 무너지는 형입니다. 사회적 규범·예절·도덕이 흔들려 대인관계에서 무례한 상황을 겪거나, 법적 문제에 휘말릴 수 있습니다.', advice: '①말과 행동에 예의를 갖추세요 ②공식 석상에서의 실수 주의 ③법률·규정 위반 각별히 조심 ④서류·계약서 꼼꼼히 검토' },
    { pair: ['술', '미'], type: '무례지형(無禮之刑)', detail: '질서가 깨지는 형입니다. 그동안 지켜온 규칙이나 관례가 무너지면서 혼란이 옵니다. 조직 내 서열·규칙·역할 분담에서 문제가 생기기 쉽습니다.', advice: '①조직 내에서 자기 역할에 충실 ②남의 영역 침범 금지 ③위계질서를 존중하되 부당함에는 합리적으로 대응' },
    { pair: ['축', '미'], type: '무례지형(無禮之刑)', detail: '토(土)끼리의 형으로, 고집과 고집이 부딪힙니다. 서로 양보하지 않는 갈등으로 관계가 경직됩니다. 부동산·상속·재산 분배 분쟁이 대표적입니다.', advice: '①고집을 부리기보다 타협점을 찾으세요 ②재산·상속 문제는 미리 법적 절차 정리 ③가족 간 돈 문제는 제3자 중재 활용' },
    { pair: ['자', '묘'], type: '상형지형(相刑之刑)', detail: '수(水)와 목(木)의 충돌로 감정적 혼란이 옵니다. 이성 문제·가정 갈등·사생활 논란이 생기기 쉬우며, 특히 음주 후 실수에 주의하세요.', advice: '①음주 자리에서의 실수 주의 ②이성 관계 정리가 필요하면 미루지 말고 깔끔하게 ③감정에 휘둘리지 말고 이성적으로 판단' },
    { pair: ['진', '진'], type: '자형(自刑)', detail: '진(辰)이 스스로를 형하는 자형입니다. 자기 안의 고민·갈등이 깊어지고, 우울감이나 자책에 빠지기 쉽습니다. 남 탓보다 자기 반성이 과해져 에너지가 소모됩니다.', advice: '①완벽주의를 내려놓으세요 ②자책보다는 자기돌봄에 집중 ③명상·산책 등 마음 정리 시간 확보' },
    { pair: ['오', '오'], type: '자형(自刑)', detail: '오(午)의 불꽃이 스스로를 태우는 자형입니다. 성급한 결정·과도한 열정으로 자충수를 둘 수 있습니다. 화병·분노 조절 실패에 주의하세요.', advice: '①중요한 결정은 하루 재운 뒤 ②분노가 치밀 때 6초 호흡법 ③과로·과욕 자제' },
    { pair: ['유', '유'], type: '자형(自刑)', detail: '유(酉)의 날카로움이 자신을 향하는 자형입니다. 말실수·자기비판·외로움이 깊어지기 쉽습니다. 완벽주의 성향이 강해져 스트레스가 쌓입니다.', advice: '①말하기 전에 한 번 더 생각 ②자기비판 대신 "잘한 점 3가지" 찾기 ③혼자 고민하지 말고 소통하세요' },
    { pair: ['해', '해'], type: '자형(自刑)', detail: '해(亥)가 스스로를 해치는 자형입니다. 방향 없는 고민·우유부단·무기력에 빠지기 쉽습니다. 생각은 많지만 행동으로 옮기지 못하는 시기입니다.', advice: '①작은 것부터 실행에 옮기기 ②결정장애가 오면 신뢰하는 사람의 의견 듣기 ③규칙적 운동으로 에너지 충전' },
  ];
  for (const hyung of HYUNG_TYPES) {
    const [a, b] = hyung.pair;
    let matched = false;
    if (jiji === a && sajuJijis.includes(b)) matched = true;
    if (jiji === b && sajuJijis.includes(a)) matched = true;
    if (matched) {
      const existsAlready = specialNotes.some(n => n.includes(`${hyung.type}(${a}↔${b})`) || n.includes(`${hyung.type}(${b}↔${a})`));
      if (!existsAlready) {
        hapchungMod -= 0.3;
        const affectedPillarIdx = sajuJijis.findIndex(sj => sj === a || sj === b);
        const affectedPillar = affectedPillarIdx >= 0 ? PILLAR_NAMES[affectedPillarIdx] : '';
        specialNotes.push(`⚔️ 지지형 — ${hyung.type}(${jiji === a ? a : b}↔${jiji === a ? b : a})\n   📍 관련 주: ${affectedPillar}\n   🔮 ${hyung.detail}\n   💡 대처법: ${hyung.advice}`);
      }
    }
  }

  // 지지파(破) — 약한 부정, 깨짐
  const JIJI_PA_MAP: [string, string][] = [
    ['자', '유'], ['축', '진'], ['인', '해'],
    ['묘', '오'], ['사', '신'], ['술', '미'],
  ];
  for (const [a, b] of JIJI_PA_MAP) {
    let paMatched = false;
    if (jiji === a && sajuJijis.includes(b)) paMatched = true;
    if (jiji === b && sajuJijis.includes(a)) paMatched = true;
    if (paMatched) {
      hapchungMod -= 0.2;
      specialNotes.push(`💔 지지파(破)(${jiji === a ? a : b}↔${jiji === a ? b : a}): 기존에 잘 맞던 것이 서서히 깨지는 기운입니다. 급격한 충돌은 아니지만, 신뢰 관계에 금이 가거나 계획이 수정되어야 하는 상황이 올 수 있습니다.\n   💡 대처법: 작은 균열을 방치하지 말고 빠르게 보수하세요. 관계·사업·건강 모두 "예방적 관리"가 핵심입니다.`);
      break; // 파는 하나만 표시
    }
  }

  // 지지해(害) — 암암리의 방해
  const JIJI_HAE_MAP: [string, string][] = [
    ['자', '미'], ['축', '오'], ['인', '사'],
    ['묘', '진'], ['신', '해'], ['유', '술'],
  ];
  for (const [a, b] of JIJI_HAE_MAP) {
    let haeMatched = false;
    if (jiji === a && sajuJijis.includes(b)) haeMatched = true;
    if (jiji === b && sajuJijis.includes(a)) haeMatched = true;
    if (haeMatched) {
      hapchungMod -= 0.2;
      specialNotes.push(`🕳️ 지지해(害)(${jiji === a ? a : b}↔${jiji === a ? b : a}): 눈에 보이지 않는 암해(暗害)의 기운입니다. 겉으로는 문제가 없어 보이지만, 뒤에서 누군가 방해하거나 험담하는 상황이 생길 수 있습니다.\n   💡 대처법: ①뒷담화·소문에 휘말리지 않도록 말조심 ②중요한 정보를 함부로 공유하지 마세요 ③의심스러운 제안은 겉이 좋아도 속을 파보세요`);
      break; // 해도 하나만 표시
    }
  }

  // 천간합 — 세운 천간이 사주 원국 천간과 합
  const CHEONGAN_HAP: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을',
    '병': '신', '신': '병', '정': '임', '임': '정',
    '무': '계', '계': '무',
  };
  // 천간합의 화합 결과 오행
  const CHEONGAN_HAP_RESULT: Record<string, Ohaeng> = {
    '갑기': '토', '기갑': '토', '을경': '금', '경을': '금',
    '병신': '수', '신병': '수', '정임': '목', '임정': '목',
    '무계': '화', '계무': '화',
  };
  const hapPartner = CHEONGAN_HAP[cheongan];
  const sajuCheongans = [saju.year.cheongan, saju.month.cheongan, saju.day.cheongan, saju.hour.cheongan];
  const CHEONGAN_PILLAR_NAMES = ['년간', '월간', '일간', '시간'];
  if (hapPartner && sajuCheongans.includes(hapPartner)) {
    const hapKey = `${cheongan}${hapPartner}` as string;
    const hapResultOh = CHEONGAN_HAP_RESULT[hapKey] || '토';
    const hapResultName = OHAENG_NAME[hapResultOh];
    const isHapYong = hapResultOh === saju.yongsin;
    const isHapGi = hapResultOh === saju.gisin;

    if (saju.ilgan === hapPartner) {
      hapchungMod += 0.5;
      let ilganHapText = `💞 천간합(${cheongan}+${hapPartner}→${hapResultName}): 세운 천간이 일간과 합!\n   🔮 천간합 중 가장 강력한 "일간합"입니다. 올해 만나는 사람·기회·환경이 나와 자연스럽게 융합됩니다. 새로운 파트너십(연애·동업·협력)이 형성될 가능성이 매우 높습니다.`;
      if (isHapYong) {
        ilganHapText += `\n   ⭐ 합의 결과가 용신(${saju.yongsin})! 이 만남·기회가 실질적 이익과 성장을 가져다줍니다. 올해의 인연을 소중히 하세요.`;
      } else if (isHapGi) {
        ilganHapText += `\n   ⚠️ 합의 결과가 기신(${saju.gisin})이므로, 겉으로 좋아 보이는 인연이 오히려 독이 될 수 있습니다. 새 관계를 맺을 때 신중하세요.`;
      }
      ilganHapText += `\n   💡 활용법: 결혼·약혼·계약·동업 등 "결합" 성격의 일에 최적의 해입니다. 단, 합이 기신으로 변하는 경우엔 거리두기가 현명합니다.`;
      specialNotes.push(ilganHapText);
    } else {
      hapchungMod += 0.3;
      const hapPillarIdx = sajuCheongans.findIndex(c => c === hapPartner);
      const hapPillarName = CHEONGAN_PILLAR_NAMES[hapPillarIdx];
      const pillarMeaning: Record<string, string> = {
        '년간': '사회적 환경·윗사람·조상과의 인연에서 합의 기운이 작용합니다',
        '월간': '직장·사업·부모와의 관계에서 합의 기운이 작용합니다',
        '시간': saju.hasChildren ? '자녀·가정과 관련된 인연에서 합의 기운이 작용합니다' : '후배·미래 계획과 관련된 인연에서 합의 기운이 작용합니다',
      };
      const meaning = pillarMeaning[hapPillarName] || '외부 인연에서 합의 기운이 작용합니다';
      specialNotes.push(`🤝 천간합(${cheongan}+${hapPartner}→${hapResultName}): ${hapPillarName}과 합!\n   🔮 ${meaning}. 외부의 도움이나 새로운 인연이 자연스럽게 들어옵니다.${isHapYong ? ` 용신(${saju.yongsin}) 방향의 합으로 실질적 도움이 큽니다!` : isHapGi ? ` 기신(${saju.gisin}) 방향의 합이므로 겉 좋은 제안을 경계하세요.` : ''}\n   💡 올해 ${hapPillarName === '년간' ? '사회적 모임·단체 활동' : hapPillarName === '월간' ? '직장 내 협업·상사와의 관계' : '후배 육성·미래 투자'}에서 좋은 기회가 옵니다.`);
    }
  }

  score += hapchungMod;

  // ⑦ 신살 보정 — 세운 지지가 트리거하는 신살
  // 역마살: 이동/변동 (충과 겹치면 이사 가능성)
  const YEOKMA_SAL: Record<string, string> = {
    '자': '인', '축': '해', '인': '신', '묘': '사',
    '진': '인', '사': '해', '오': '신', '미': '사',
    '신': '인', '유': '해', '술': '신', '해': '사',
  };
  // 도화살: 인기/로맨스 (대체로 중립~긍정)
  const DOHWA_SAL: Record<string, string> = {
    '자': '유', '축': '오', '인': '묘', '묘': '자',
    '진': '유', '사': '오', '오': '묘', '미': '자',
    '신': '유', '유': '오', '술': '묘', '해': '자',
  };
  // 화개살: 학문/종교/내면
  const HWAGAE_SAL: Record<string, string> = {
    '자': '진', '축': '축', '인': '술', '묘': '미',
    '진': '진', '사': '축', '오': '술', '미': '미',
    '신': '진', '유': '축', '술': '술', '해': '미',
  };

  let sinsalMod = 0;
  const dayJiji = saju.day.jiji;
  const yearJiji = saju.year.jiji;

  // 역마살: 세운 지지가 역마 위치면 → 변동운
  const yeokmaFromDay = YEOKMA_SAL[dayJiji];
  const yeokmaFromYear = YEOKMA_SAL[yearJiji];
  if (jiji === yeokmaFromDay || jiji === yeokmaFromYear) {
    const yeokmaSource = jiji === yeokmaFromDay ? '일지' : '년지';
    if (chungCount > 0) {
      sinsalMod -= 0.3;
      specialNotes.push(`🐎 역마살+충 (${yeokmaSource} 기준)\n   🔮 역마살에 충(沖)까지 겹쳐 "강제 이동"의 기운이 매우 강합니다. 이사·전직·해외 발령·유학 등 큰 변동이 예상되며, 본인의 의지와 무관하게 이동이 발생할 수 있습니다.\n   📍 영향 분야: ${yeokmaSource === '일지' ? '나 자신의 생활 근거지·직장·거주지 변동' : '사회적 환경 변화로 인한 이동(회사 이전, 학교 전학 등)'}\n   💡 대처법: ①이동이 불가피하면 미리 새 환경을 답사·준비 ②교통사고에 각별히 주의(장거리 이동 시 컨디션 확인) ③이사·이직은 용신(${saju.yongsin}) 방향(${saju.yongsin === '금' ? '서쪽' : saju.yongsin === '수' ? '북쪽' : saju.yongsin === '목' ? '동쪽' : saju.yongsin === '화' ? '남쪽' : '중앙'})이 유리합니다\n   ⏰ 이동의 기운이 가장 강한 시기: ${jiji === '인' || jiji === '신' ? '2월·8월' : jiji === '사' || jiji === '해' ? '4월·10월' : '환절기'}`);
    } else {
      sinsalMod += 0.1;
      specialNotes.push(`🐎 역마살 (${yeokmaSource} 기준)\n   🔮 활동 범위가 넓어지는 해입니다. 출장·여행·이사·전보·해외 활동 등 이동이 잦아지며, 새로운 환경에서 뜻밖의 기회를 만납니다.\n   📍 영향 분야: 직업적으로는 영업·무역·운송·여행업·프리랜서에 유리하고, 개인적으로는 여행·탐험·학습 기회가 늘어납니다.\n   💡 활용법: ①여행이나 출장을 통해 새 인맥을 만드세요 ②해외 관련 일(어학·무역·유학)이 있다면 올해 시작 ③가만히 있으면 역마의 기운이 초조함으로 변하니 적극적으로 움직이세요\n   🧭 유리한 방향: ${saju.yongsin === '금' ? '서쪽' : saju.yongsin === '수' ? '북쪽' : saju.yongsin === '목' ? '동쪽' : saju.yongsin === '화' ? '남쪽' : '중앙'} (용신 방향)`);
    }
  }

  // 도화살: 인기/매력 상승
  const dohwaFromDay = DOHWA_SAL[dayJiji];
  const dohwaFromYear = DOHWA_SAL[yearJiji];
  if (jiji === dohwaFromDay || jiji === dohwaFromYear) {
    sinsalMod += 0.2;
    const dohwaSource = jiji === dohwaFromDay ? '일지' : '년지';
    const isMarriedDohwa = saju.relationship === 'married';
    specialNotes.push(`🌸 도화살(桃花殺) (${dohwaSource} 기준)\n   🔮 매력·인기가 한껏 올라가는 해입니다! "꽃이 피듯" 이성의 관심이 쏠리고, 대인관계가 화려해집니다. 외모·패션에 관심이 커지며, 사교 모임에서 중심이 됩니다.\n   📍 영향 분야:\n   • 연애: ${isMarriedDohwa ? '부부 사이 로맨스가 살아납니다. 다만 외부 유혹에 주의! 이성 친구와의 거리 조절이 필요합니다.' : '새로운 인연이 찾아올 확률이 매우 높습니다. 소개팅·미팅·SNS·모임에서 적극적으로 나가보세요.'}\n   • 직업: 대중을 상대하는 직업(영업·서비스·연예·마케팅)에서 큰 효과를 발휘합니다. 이미지 관리에 투자하면 직업운도 상승합니다.\n   • 건강: 피부 관리·다이어트 효과가 좋은 해입니다. 외모 가꾸기에 투자하세요.\n   💡 활용법: ①프로필 사진 교체, 이미지 메이킹 ②사교 모임·동호회 적극 참여 ③예술·문화 활동으로 매력 업그레이드\n   ⚠️ 주의: 도화살은 양날의 검! 지나치면 색정(色情) 문제·스캔들·삼각관계로 이어질 수 있습니다. 절제가 중요합니다.`);
  }

  // 화개살: 학문/내면 성장
  const hwagaeFromDay = HWAGAE_SAL[dayJiji];
  const hwagaeFromYear = HWAGAE_SAL[yearJiji];
  if (jiji === hwagaeFromDay || jiji === hwagaeFromYear) {
    sinsalMod += 0.1;
    specialNotes.push(`📿 화개살(華蓋殺)\n   🔮 학문·예술·종교·철학에 깊이 빠져드는 해입니다. "화개(華蓋)"는 임금의 수레를 덮는 화려한 덮개로, 고귀한 정신세계를 상징합니다. 내면의 성장과 정신적 깨달음을 얻기 좋은 시기입니다.\n   📍 영향 분야:\n   • 학업: 공부·연구·자격증 취득에 집중력이 최고조! 시험 준비 중이라면 올해가 승부의 해입니다.\n   • 정신: 명상·요가·심리상담·종교 활동이 마음의 평화를 가져다줍니다. 번아웃을 겪고 있다면 내면 수양이 특효약입니다.\n   • 예술: 그림·음악·글쓰기 등 창작 활동에서 영감이 폭발합니다. 작품 활동이나 취미 예술을 시작하기 좋습니다.\n   💡 활용법: ①서점·도서관·미술관·사찰 등 정신적 공간을 자주 방문 ②하루 10분 명상 루틴 시작 ③인문학·철학 서적 읽기\n   ⚠️ 주의: 화개살이 강하면 세속과 담을 쌓고 혼자만의 세계에 빠질 수 있습니다. 사회생활과의 균형을 잃지 마세요.`);
  }

  // 천을귀인: 세운 지지가 천을귀인 위치면 → 귀인의 도움 (강한 긍정)
  const CHEONEUL_GWIIN: Record<string, string[]> = {
    '갑': ['축', '미'], '무': ['축', '미'],
    '을': ['자', '신'], '기': ['자', '신'],
    '병': ['해', '유'], '정': ['해', '유'],
    '경': ['축', '미'], '신': ['인', '오'],
    '임': ['묘', '사'], '계': ['묘', '사'],
  };
  const gwiin = CHEONEUL_GWIIN[saju.ilgan] || [];
  if (gwiin.includes(jiji)) {
    sinsalMod += 0.5;
    // 천을귀인과 다른 흉살이 겹치는지 확인
    const hasChung = chungCount > 0;
    const hasHyung = specialNotes.some(n => n.includes('지지형'));
    specialNotes.push(`🌟 천을귀인(天乙貴人) — 올해 최고의 수호신!\n   🔮 사주학에서 가장 강력한 길신(吉神)입니다. 위기의 순간에 반드시 도와주는 귀인(貴人)이 나타납니다. 어려운 상황이 생겨도 누군가의 중재·조언·지원으로 해결될 가능성이 매우 높습니다.\n   📍 영향 분야:\n   • 직업: 상사·선배·멘토의 추천이나 도움으로 승진·발탁·좋은 기회를 얻습니다.\n   • 재물: 투자나 사업에서 조언자가 나타나 큰 손실을 막아줍니다.\n   • 건강: 좋은 의사·치료사를 만나 건강 문제가 호전됩니다.\n   • 법률: 소송·분쟁이 있어도 유리하게 해결될 가능성이 높습니다.${hasChung ? '\n   ⚡ 충과 겹침: 올해 충(沖)의 위기가 있지만, 천을귀인이 보호해주므로 "위기 속 기회"가 됩니다. 어려움이 와도 포기하지 마세요!' : ''}${hasHyung ? '\n   ⚔️ 형과 겹침: 형(刑)의 마찰이 있지만, 천을귀인의 보호로 큰 피해를 면합니다.' : ''}\n   💡 활용법: ①도움을 요청하는 것을 두려워하지 마세요. 올해는 도움이 옵니다 ②새로운 만남에 열린 마음을 가지세요 — 그 사람이 귀인일 수 있습니다 ③감사의 마음을 표현하면 귀인의 도움이 더 커집니다`);
  }

  // 양인살: 세운 지지가 양인 위치면 → 강한 변동/사고 주의
  const YANGIN_SAL: Record<string, string> = {
    '갑': '묘', '병': '오', '무': '오', '경': '유', '임': '자',
  };
  const yanginTarget = YANGIN_SAL[saju.ilgan];
  if (yanginTarget && jiji === yanginTarget) {
    sinsalMod -= 0.5;
    const isSingang = saju.strengthScore != null ? saju.strengthScore >= 40 : (saju.ohaengBalance?.[CHEONGAN_OHAENG[saju.ilgan]] || 3) >= 4.5;
    specialNotes.push(`🗡️ 양인살(羊刃殺) — 강력한 흉살, 각별 주의!\n   🔮 양인(羊刃)은 "칼날"을 의미합니다. 일간의 기운이 극도로 강해지는 자리로, 날카로운 변동·사고·수술·사상(死傷)의 위험이 있는 해입니다.${isSingang ? ' 특히 일간이 이미 신강한 사주에 양인살이 오면 기운이 과잉되어 위험이 더 커집니다!' : ''}\n   📍 영향 분야:\n   • 건강: 교통사고·낙상·수술·칼 관련 부상에 각별히 주의하세요. 위험한 스포츠(번지점프·스카이다이빙·격투기)는 피하세요.\n   • 대인관계: 말이 날카로워져 다른 사람에게 상처를 주기 쉽습니다. 직설적 표현을 삼가고 한 박자 쉬고 말하세요.\n   • 재물: 도박·투기·무모한 투자에 빠지기 쉬운 시기입니다. "한 방"을 노리지 마세요.\n   • 직업: 직장 내 갈등이 날카로워질 수 있습니다. 감정적 대응은 해고·징계로 이어질 수 있으니 참으세요.\n   💡 대처법: ①위험한 활동·장소 피하기 ②교통안전 최우선 (음주운전 절대 금지) ③분노 조절 훈련 (화가 나면 10초 세기) ④정기 건강검진 + 보험 점검 ⑤양인의 날카로운 에너지를 긍정적으로 쓰려면 — 수술이 필요한 경우 올해 하면 절개가 깔끔, 경쟁이 치열한 시험에서는 승부근성 발휘\n   ⏰ 가장 조심할 시기: ${yanginTarget}월(${yanginTarget === '묘' ? '2월' : yanginTarget === '오' ? '5월' : yanginTarget === '유' ? '8월' : '11월'}경)에 양인의 기운이 최고조에 달합니다.`);
  }

  score += sinsalMod;

  // ⑧ 극신강/극신약 일간 오행 과다/보충
  if (isExtSingang) {
    if (cheonganOhaeng === ilOhaeng) score -= 0.5;
    if (jijiOhaeng === ilOhaeng) score -= 0.5;
  }
  if (isExtSinyak) {
    if (cheonganOhaeng === ilOhaeng) score += 0.5;
    if (jijiOhaeng === ilOhaeng) score += 0.5;
  }

  // ⑨ 격국(格局) 보정 — 격국에 유리/불리한 십성이면 가감
  const gyeokguk = determineGyeokguk(saju);
  let gyeokgukMod = 0;
  if (gyeokguk.favorableSipseongs.includes(seunSipseong)) {
    gyeokgukMod += 0.5;
    specialNotes.push(`📜 격국 길신: ${gyeokguk.name}에 ${seunSipseong}은 유리한 십성! 격국의 기운이 순조롭게 흐릅니다.`);
  }
  if (gyeokguk.unfavorableSipseongs.includes(seunSipseong)) {
    gyeokgukMod -= 0.5;
    specialNotes.push(`📜 격국 흉신: ${gyeokguk.name}에 ${seunSipseong}은 불리한 십성. ${gyeokguk.breakCondition}`);
  }
  // 파격 체크: 상관견관, 도식 등
  if (gyeokguk.type === '정관격' && seunSipseong === '상관') {
    gyeokgukMod -= 1;
    specialNotes.push(`⚠️ 상관견관(傷官見官): 정관격에 상관이 오면 직장·지위가 크게 흔들립니다. 윗사람과의 충돌을 극도로 조심하세요.`);
  }
  if (gyeokguk.type === '식신격' && seunSipseong === '편인') {
    gyeokgukMod -= 1;
    specialNotes.push(`⚠️ 도식(倒食): 식신격에 편인이 오면 생계·건강·소화기에 문제가 생길 수 있습니다. 무리한 계획 변경을 피하세요.`);
  }
  if ((gyeokguk.type === '정재격' || gyeokguk.type === '편재격') && seunSipseong === '겁재') {
    gyeokgukMod -= 1;
    specialNotes.push(`⚠️ 겁재탈재(劫財奪財): 재성격에 겁재가 오면 재물 손실·투자 실패·배신의 위험이 큽니다. 큰 돈 거래를 삼가세요.`);
  }
  // 종격 파격 체크
  if (gyeokguk.group === '종격') {
    const breakingSipseongs: string[] = gyeokguk.unfavorableSipseongs;
    if (breakingSipseongs.includes(seunSipseong)) {
      gyeokgukMod -= 1.5;
      specialNotes.push(`💀 종격 파격: ${gyeokguk.name}인데 ${seunSipseong}이 오면 격국 자체가 깨집니다! 올해는 극도의 주의가 필요합니다. 기존 생활 패턴을 유지하고 큰 변화를 시도하지 마세요.`);
    }
  }
  score += gyeokgukMod;

  // ⑩ 조후용신(調候用神) 보정 — 계절에 따른 급한 오행 반영
  const johu = determineJohu(saju);
  let johuMod = 0;
  if (johu.johuYongsin) {
    if (cheonganOhaeng === johu.johuYongsin || jijiOhaeng === johu.johuYongsin) {
      johuMod += johu.priority === '급' ? 1.0 : 0.5;
      specialNotes.push(`🌡️ 조후 충족: ${johu.reason} 올해 ${OHAENG_NAME[johu.johuYongsin]} 기운이 들어와 조후가 해결됩니다!`);
    }
    if (johu.johuGisin && (cheonganOhaeng === johu.johuGisin || jijiOhaeng === johu.johuGisin)) {
      johuMod -= johu.priority === '급' ? 0.7 : 0.3;
      specialNotes.push(`🌡️ 조후 역행: ${johu.reason} 그런데 올해 오히려 반대 기운(${OHAENG_NAME[johu.johuGisin]})이 들어와 조후가 악화됩니다.`);
    }
  }
  score += johuMod;

  // ⑪ 대운-세운 교차 분석 보정
  const daeunCross = analyzeDaeunSeunCross(saju, currentDaeun || null, cheongan, jiji, cheonganOhaeng, jijiOhaeng);
  score += daeunCross.crossScore;
  if (daeunCross.crossNotes.length > 0) {
    specialNotes.push(`\n【🔄 대운-세운 교차 분석】\n${daeunCross.daeunSeunRelation}\n${daeunCross.crossNotes.join('\n')}`);
  }

  // ⑫ 지장간 심층 분석 (본기/중기/여기 가중치 차별화)
  const { jangganScore: jgScore } = analyzeJangganDeep(jiji, saju.ilgan, saju.yongsin, saju.gisin, ilOhaeng);
  score += jgScore * 0.7; // 세운은 지장간 70% 반영 (더 직접적)

  // ⑬ 천간합 결과 오행 분석
  const sajuGansSeun = [saju.year.cheongan, saju.month.cheongan, saju.ilgan, saju.hour.cheongan];
  const { hapScore: ganHapScoreSeun, hapDetails: ganHapDetailsSeun } = analyzeCheonganHapResult(cheongan, sajuGansSeun, saju.yongsin, saju.gisin);
  score += ganHapScoreSeun;
  if (ganHapDetailsSeun.length > 0) {
    specialNotes.push(`🔗 천간합 결과: ${ganHapDetailsSeun.join(', ')}`);
  }

  // ⑭ 원국 합/충 해소·강화 분석
  const { changeMod: wonChangeMod, changeDetails: wonChangeDetails } = analyzeWonGukHapChungChange(saju, jiji);
  score += wonChangeMod;
  if (wonChangeDetails.length > 0) {
    specialNotes.push(`🔄 원국 구조 변화: ${wonChangeDetails.join(', ')}`);
  }

  // ⑮ 공망(空亡) 체크
  const gmSeun = checkGongmang(saju.day.cheongan, saju.day.jiji, jiji);
  if (gmSeun.isGongmang) {
    if (jijiOhaeng === saju.gisin) {
      score += 0.3;
      specialNotes.push(`🕳️ 공망(空亡): 기신(${saju.gisin}) 지지가 공망! 기신 약화로 전화위복의 기운입니다.`);
    } else if (jijiOhaeng === saju.yongsin) {
      score -= 0.5;
      specialNotes.push(`🕳️ 공망(空亡): 용신(${saju.yongsin}) 지지가 공망! 용신의 힘이 약해져 기대했던 것만큼 효과를 보기 어렵습니다. 실속 없는 기회에 주의하세요.`);
    } else {
      score += gmSeun.effect;
      specialNotes.push(`🕳️ 공망(空亡): ${jiji}이 공망에 해당합니다. 올해의 기운이 겉보기와 다를 수 있으니 허상에 속지 마세요.`);
    }
  }

  // ⑮-A 천간충(天干沖) 분석
  const sajuGansSeunFull = [saju.year.cheongan, saju.month.cheongan, saju.ilgan, saju.hour.cheongan];
  const { chungMod: ganChungModSeun, chungDetails: ganChungDetailsSeun } = analyzeCheonganChung(cheongan, sajuGansSeunFull, saju.yongsin, saju.gisin);
  score += ganChungModSeun;
  for (const gcd of ganChungDetailsSeun) {
    specialNotes.push(`⚔️ ${gcd}`);
  }

  // ⑮-B 암합(暗合) 분석
  const { amhapMod: amhapModSeun, amhapDetails: amhapDetailsSeun } = analyzeAmhap(jiji, sajuJijis, saju.yongsin, saju.gisin);
  score += amhapModSeun;
  for (const amd of amhapDetailsSeun) {
    specialNotes.push(`🤝 ${amd}`);
  }

  // ⑮-C 추가 신살 종합 (12신살 + 원진/귀문관 + 천덕/월덕)
  const advSinsalSeun = analyzeAdvancedSinsal(
    jiji, cheongan, saju.day.jiji, saju.year.jiji,
    saju.month.jiji, saju.yongsin, saju.gisin, sajuJijis
  );
  score += advSinsalSeun.sinsalMod;
  for (const asd of advSinsalSeun.sinsalDetails.slice(0, 3)) {
    specialNotes.push(`🔮 ${asd}`);
  }

  // ⑮-D 투합(妬合) 판별
  const { tuhapMod: tuhapModSeun, tuhapDetail: tuhapDetailSeun } = checkTuhap(cheongan, sajuGansSeunFull);
  score += tuhapModSeun;
  if (tuhapDetailSeun) {
    specialNotes.push(`🔄 ${tuhapDetailSeun}`);
  }

  // ⑮-E 공망 진공/반공 세밀 판별
  const gmDetailSeun = analyzeGongmangDetail(saju.day.cheongan, saju.day.jiji, jiji, sajuJijis);
  if (gmDetailSeun.isJingong) {
    score += gmDetailSeun.gongmangMod - (gmSeun.isGongmang ? gmSeun.effect : 0);
    specialNotes.push(`🕳️ 진공(眞空): 공망이 합/충으로 구제되지 않아 효과가 매우 강합니다. 허상에 특히 주의!`);
  } else if (gmDetailSeun.isBangong && gmSeun.isGongmang) {
    score += gmDetailSeun.gongmangMod - (gmSeun.effect);
    specialNotes.push(`🕳️ 반공(半空): 공망이 합/충으로 일부 구제되어 효과가 약화됩니다.`);
  }

  // ⑮-F 태세(太歲) 분석 — 세운 천간과 연간 관계
  const { taesaeMod, taesaeDetail } = analyzeTaesae(cheongan, saju.year.cheongan, saju.ilgan);
  score += taesaeMod;
  if (taesaeDetail) {
    specialNotes.push(`👑 ${taesaeDetail}`);
  }

  // ⑮-G 형충파해 합 해소
  const { resolveMod: resolveModSeun, resolveDetails: resolveDetailsSeun } = analyzeHapResolution(jiji, sajuJijis);
  score += resolveModSeun;
  for (const rd of resolveDetailsSeun) {
    specialNotes.push(`🔗 ${rd}`);
  }

  // ⑯ 12운성 의미적 세분화 (십성×12운성 시너지)
  const { stageMod: stageContextMod, stageDetail } = get12StageContextMod(twelveStage, seunSipseong, isSingang);
  score += stageContextMod;
  if (stageDetail) {
    specialNotes.push(`🎯 ${stageDetail}`);
  }

  // ⑰ 4주(연주/월주/일주/시주) 관계도 분석
  const pillarRelSeun = analyzePillarRelations(saju, cheonganOhaeng, jijiOhaeng, jiji);
  // 세운은 1년 주기이므로 구조적 영향 작게, 운 활성화 영향 크게
  score += pillarRelSeun.structuralScore * 0.08;
  score += pillarRelSeun.runActivation;
  // 영역별 보정 종합 평균도 세운 종합에 미세 반영
  const seunAreaAvg = (pillarRelSeun.areaModifiers.study + pillarRelSeun.areaModifiers.money +
    pillarRelSeun.areaModifiers.love + pillarRelSeun.areaModifiers.health +
    pillarRelSeun.areaModifiers.career) / 5;
  score += seunAreaAvg * 0.25;
  // 주요 detail 2개까지 specialNotes에 표시
  for (let dIdx = 0; dIdx < Math.min(2, pillarRelSeun.details.length); dIdx++) {
    specialNotes.push(`🔗 ${pillarRelSeun.details[dIdx]}`);
  }

  // ⑱ 시기별 맥락 + 궁위(宮位) 심층 분석
  const seunAge = saju.age ? saju.age + (targetYear - new Date().getFullYear()) : 30;
  const lifePhaseSeun = analyzeLifePhaseContext(saju, seunAge, cheonganOhaeng, jijiOhaeng, jiji);
  // 시기별 영역 보너스 → 종합 점수 미세 반영
  const phaseAreaSumSeun = lifePhaseSeun.areaBonus.study * lifePhaseSeun.areaWeights.study +
    lifePhaseSeun.areaBonus.money * lifePhaseSeun.areaWeights.money +
    lifePhaseSeun.areaBonus.love * lifePhaseSeun.areaWeights.love +
    lifePhaseSeun.areaBonus.health * lifePhaseSeun.areaWeights.health +
    lifePhaseSeun.areaBonus.career * lifePhaseSeun.areaWeights.career;
  score += phaseAreaSumSeun * 0.15;
  // 궁위 질 평균 반영
  const gungwiAvgSeun = (lifePhaseSeun.educationQuality + lifePhaseSeun.spouseQuality +
    lifePhaseSeun.wealthStructure + lifePhaseSeun.careerFoundation) / 4;
  score += gungwiAvgSeun * 0.08;
  score -= lifePhaseSeun.healthVulnerability * 0.04;
  // 주요 시기별 details 표시
  if (lifePhaseSeun.details.length > 0) {
    specialNotes.push(`📊 ${lifePhaseSeun.phase}: ${lifePhaseSeun.details[0]}`);
  }

  // ⑲ 높은 에너지 12운성에서 최소점 보장
  const highEnergyStages = ['관대', '건록', '제왕', '장생'];
  if (highEnergyStages.includes(twelveStage) && score < 3) {
    score = 3;
  }

  // ⑳ 최종 상한/하한 (실제 사주에서 2~9점 범위)
  score = Math.round(Math.max(2, Math.min(9, score)));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⑩ 영역별 점수 계산 — 십성의 영역별 영향이 핵심
  // 같은 해라도 학업은 좋고 재물은 나쁠 수 있음
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const clampArea = (v: number) => Math.round(Math.max(2, Math.min(9, v)) * 2) / 2;

  // 십성의 영역별 기본 영향 (신강/신약 무관한 순수 십성 의미)
  // { study, money, love, health, career }
  const SIPSEONG_AREA: Record<string, { study: number; money: number; love: number; health: number; career: number }> = {
    '비견': { study: 0, money: -0.5, love: -0.5, health: 0.5, career: 0 },
    '겁재': { study: 0, money: -1, love: -0.5, health: 0, career: -0.5 },
    '식신': { study: 1, money: 0.5, love: 0.5, health: 1, career: 0.5 },
    '상관': { study: 0.5, money: 0, love: 1, health: 0, career: -0.5 },
    '편재': { study: -0.5, money: 1.5, love: 1, health: 0, career: 1 },
    '정재': { study: 0, money: 1.5, love: 1, health: 0.5, career: 1 },
    '편관': { study: 0.5, money: 0, love: -0.5, health: -1, career: 0.5 },
    '정관': { study: 1, money: 0.5, love: 1, health: 0, career: 1.5 },
    '편인': { study: 2, money: -1, love: -0.5, health: -0.5, career: 0.5 },
    '정인': { study: 1.5, money: 0, love: 0.5, health: 0.5, career: 0.5 },
  };

  const sipArea = SIPSEONG_AREA[seunSipseong] || { study: 0, money: 0, love: 0, health: 0, career: 0 };

  // 12운성의 영역별 영향
  const STAGE_AREA: Record<string, { study: number; money: number; love: number; health: number; career: number }> = {
    '장생': { study: 0.5, money: 0.5, love: 0.5, health: 0.5, career: 0.5 },
    '목욕': { study: -0.5, money: 0, love: 1, health: 0, career: -0.5 },
    '관대': { study: 1, money: 0.5, love: 0.5, health: 0, career: 1 },
    '건록': { study: 0.5, money: 1, love: 0.5, health: 0.5, career: 1 },
    '제왕': { study: 1, money: 1, love: 0.5, health: 0, career: 1 },
    '쇠':   { study: 0.5, money: 0, love: 0, health: -0.5, career: 0 },
    '병':   { study: 0, money: -0.5, love: 0, health: -1, career: -0.5 },
    '사':   { study: 0.5, money: -0.5, love: -0.5, health: -1, career: -0.5 },
    '묘':   { study: 0, money: 0.5, love: -0.5, health: -0.5, career: 0 },
    '절':   { study: 0, money: -1, love: -1, health: -0.5, career: -0.5 },
    '태':   { study: 0.5, money: 0, love: 0.5, health: 0, career: 0 },
    '양':   { study: 0.5, money: 0, love: 0.5, health: 0.5, career: 0 },
  };
  const stArea = STAGE_AREA[twelveStage] || { study: 0, money: 0, love: 0, health: 0, career: 0 };

  // 기본 base (종합 점수에서 시작, 영역별로 조정)
  const areaBase = score;

  // ── 영역별 밸런스 변화 반영 ──
  // 운이 들어왔을 때 각 영역에 관련된 오행의 변화를 반영
  // 재물=재성오행, 학업=인성오행, 건강=관성오행(과잉 시 건강 위협), 직업=관성오행
  const inOhaeng = Object.entries(OHAENG_SANGSAENG).find(([, v]) => v === ilOhaeng)![0] as Ohaeng;
  const shikOhaeng = OHAENG_SANGSAENG[ilOhaeng];
  const jaeOhaeng = OHAENG_SANGGEUK[ilOhaeng];
  const gwanOhaeng = Object.entries(OHAENG_SANGGEUK).find(([, v]) => v === ilOhaeng)?.[0] as Ohaeng;

  // 결핍 오행 보충 보너스 (영역별 적용)
  const bal = saju.ohaengBalance;
  const total = Object.values(bal).reduce((a, b) => a + b, 0) || 1;
  const getDeficiency = (oh: Ohaeng) => (bal[oh] || 0) / total < 0.1; // 10% 미만 = 결핍

  // ━━━ 학업운 ━━━
  let studyScore = areaBase + sipArea.study + stArea.study;
  if ((isExtSingang || isSingang) && isInseong) studyScore += 1.5;
  if (hwagaeFromDay === jiji || hwagaeFromYear === jiji) studyScore += 0.5;
  // 인성 오행이 결핍이었는데 채워지면 학업 보너스
  if (getDeficiency(inOhaeng) && (cheonganOhaeng === inOhaeng || jijiOhaeng === inOhaeng)) studyScore += 0.5;
  // [NEW] 신약+인성운 = 학업에 최적 (신약한 사람이 인성을 만나면 학업 집중력 향상)
  if (isSinyak && isInseong) studyScore += 0.6;
  // [NEW] 상관운 = 창의적 학업에 유리하지만 시험/자격증에는 불리
  if (seunSipseong === '상관') { studyScore += 0.2; }
  // [NEW] 편관운 = 학업 압박감 증가 (시험 스트레스)
  if (isPyeonGwan) studyScore -= 0.3;
  // [NEW] 식상 오행이 결핍이었는데 채워지면 표현력/창작력 보너스
  if (getDeficiency(shikOhaeng) && (cheonganOhaeng === shikOhaeng || jijiOhaeng === shikOhaeng)) studyScore += 0.3;
  // [NEW] 겁재운 = 경쟁적 학업환경 (동기부여지만 스트레스)
  if (seunSipseong === '겁재') { studyScore -= 0.2; }
  // [NEW] 오행 밸런스 기반 학업운 — 인성오행 비율이 적절(15~25%)하면 학업 안정
  const inRatio = (bal[inOhaeng] || 0) / total;
  if (inRatio >= 0.15 && inRatio <= 0.25) studyScore += 0.2;
  else if (inRatio > 0.35) studyScore -= 0.2; // 인성 과다 = 우유부단, 실행력 부족

  // ━━━ 재물운 ━━━
  let moneyScore = areaBase + sipArea.money + stArea.money;
  if (isInseong && isSiksang) moneyScore -= 0.5;
  if (isExtSingang && isJaeseong) moneyScore += 0.8;
  if (isExtSinyak && isJaeseong) moneyScore -= 0.4;
  // 재성 오행이 결핍이었는데 채워지면 재물 보너스
  if (getDeficiency(jaeOhaeng) && (cheonganOhaeng === jaeOhaeng || jijiOhaeng === jaeOhaeng)) moneyScore += 0.5;
  // 식상 → 재성 생성 흐름: 식상이 오면서 원국에 재성이 있으면 시너지
  if (isSiksang && (bal[jaeOhaeng] || 0) >= 1.5) moneyScore += 0.3;
  // [NEW] 비겁운 = 재물 경쟁/손재 (비견보다 겁재가 더 위험)
  // 단, 신약일 때 비겁은 자기 강화 → 재물 보호 효과
  if (isBigyeop && (isSinyak || isExtSinyak)) {
    moneyScore += 0.2; // 신약+비겁 = 자기 강화로 재물 지킬 힘 생김
  } else if (seunSipseong === '겁재') moneyScore -= 0.4;
  else if (seunSipseong === '비견') moneyScore -= 0.15;
  // [NEW] 정재+건록/제왕 = 안정적 고수입 시기
  if (seunSipseong === '정재' && ['건록', '제왕'].includes(twelveStage)) moneyScore += 0.4;
  // [NEW] 편재+장생/관대 = 투자/사업 기회
  if (seunSipseong === '편재' && ['장생', '관대'].includes(twelveStage)) moneyScore += 0.3;
  // [NEW] 재성 오행 비율이 적절(15~25%)이면 안정적 재물운
  const jaeRatio = (bal[jaeOhaeng] || 0) / total;
  if (jaeRatio >= 0.15 && jaeRatio <= 0.25) moneyScore += 0.2;
  // [NEW] 식상 → 재성 연결: 원국에 식상+재성 모두 있고 운에서 활성화
  if (isJaeseong && (bal[shikOhaeng] || 0) >= 1.0) moneyScore += 0.2;
  // [NEW] 신강+식상운 = 활발한 경제활동 (자영업/프리랜서에 유리)
  if (isSingang && isSiksang) moneyScore += 0.25;
  // [NEW] 인성 과다+재성운 = 재극인(財剋印) → 재물은 오지만 학업/정신 소모
  if (isJaeseong && inRatio > 0.3) moneyScore += 0.15;

  // ━━━ 연애운 ━━━
  let loveScore = areaBase + sipArea.love + stArea.love;
  if (dohwaFromDay === jiji || dohwaFromYear === jiji) loveScore += 1;
  if (isExtSingang && isJaeseong && saju.gender === 'male') loveScore += 0.5;
  // 천간합이 일간과 맺어지면 연애운 추가
  const CHEONGAN_HAP_CHECK: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을',
    '병': '신', '신': '병', '정': '임', '임': '정',
    '무': '계', '계': '무',
  };
  if (CHEONGAN_HAP_CHECK[cheongan] === saju.ilgan) loveScore += 0.5;
  // [NEW] 여성: 관성운 = 남편/남자친구운 (정관=좋은 만남, 편관=복잡한 인연)
  if (saju.gender === 'female') {
    if (isJeongGwan) loveScore += 0.5;
    else if (isPyeonGwan) loveScore += 0.2; // 만남은 있지만 복잡
  }
  // [NEW] 남성: 재성운 = 아내/여자친구운 (정재=좋은 만남, 편재=다양한 인연)
  if (saju.gender === 'male') {
    if (seunSipseong === '정재') loveScore += 0.4;
    else if (seunSipseong === '편재') loveScore += 0.2;
  }
  // [NEW] 비겁운 = 연애 경쟁자 출현 / 배우자와 갈등
  if (isBigyeop) loveScore -= 0.3;
  // [NEW] 식신+도화 = 매력 폭발 (외모/말솜씨로 인연)
  if (isSiksang && (dohwaFromDay === jiji || dohwaFromYear === jiji)) loveScore += 0.3;
  // [NEW] 목욕 12운성 = 연애 활발 / 유혹 주의
  if (twelveStage === '목욕') loveScore += 0.3;
  // [NEW] 일지 육합 = 배우자와 좋은 시기
  const YUKHAP_CHECK: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인',
    '묘': '술', '술': '묘', '진': '유', '유': '진',
    '사': '신', '신': '사', '오': '미', '미': '오',
  };
  if (YUKHAP_CHECK[jiji] === saju.day.jiji) loveScore += 0.4;
  // [NEW] 일지 충 = 배우자 갈등/이별 위험
  if (chungTarget === saju.day.jiji) loveScore -= 0.4;
  // [NEW] 암합이 일지와 형성되면 숨겨진 인연
  for (const [a, b] of AMHAP_PAIRS) {
    if (jiji === a && saju.day.jiji === b) { loveScore += 0.25; break; }
  }

  // ━━━ 건강운 (12운성 에너지 기반, 종합운 영향 축소) ━━━
  const healthEnergyBase = 5 + (stageData.energy - 5.5) * 0.4;
  const healthBase = Math.round((areaBase * 0.25 + healthEnergyBase * 0.75) * 2) / 2;
  let healthScore = healthBase + sipArea.health + stArea.health;
  if (yanginTarget && jiji === yanginTarget) healthScore -= 0.5;
  if (isExtSingang && isInseong) healthScore -= 0.3;
  if (isExtSinyak && (isPyeonGwan || isJeongGwan)) healthScore -= 0.5;
  // 관성 과잉 시 건강 위협: 이미 관성이 많은데 더 들어오면
  if (gwanOhaeng && (bal[gwanOhaeng] || 0) / total > 0.25 && (cheonganOhaeng === gwanOhaeng || jijiOhaeng === gwanOhaeng)) {
    healthScore -= 0.4;
  }
  // 밸런스 개선 시 건강 보너스
  if (balanceMod > 0.5) healthScore += 0.3;
  // [NEW] 최약 오행 보충 시 건강 보너스
  const ohaengArr: Ohaeng[] = ['목', '화', '토', '금', '수'];
  const weakestOh = ohaengArr.reduce((a, b) => ((bal[a] || 0) < (bal[b] || 0) ? a : b));
  if ((cheonganOhaeng === weakestOh || jijiOhaeng === weakestOh) && (bal[weakestOh] || 0) / total < 0.1) {
    healthScore += 0.4;
  }
  // [NEW] 최과다 오행 추가 유입 시 건강 경고
  const strongestOh = ohaengArr.reduce((a, b) => ((bal[a] || 0) > (bal[b] || 0) ? a : b));
  if ((cheonganOhaeng === strongestOh || jijiOhaeng === strongestOh) && (bal[strongestOh] || 0) / total > 0.35) {
    healthScore -= 0.3;
  }
  // [NEW] 식신운 = 건강에 가장 좋은 십성 (먹거리/건강관리 의지)
  if (seunSipseong === '식신') healthScore += 0.3;
  // [NEW] 상관운 = 정신건강 주의 (스트레스/과로)
  if (seunSipseong === '상관') healthScore -= 0.2;
  // [NEW] 신약+비겁운 = 체력·면역력 회복 (자기 강화)
  if (isBigyeop && (isSinyak || isExtSinyak)) healthScore += 0.3;
  // [NEW] 인성+용신 = 정신적 안정, 건강 관리 잘됨
  if (isInseong && (cheonganOhaeng === saju.yongsin || jijiOhaeng === saju.yongsin)) healthScore += 0.25;
  // [NEW] 형(刑)이 있으면 건강 약화 (이미 hapchungMod에 반영되지만 건강 영역에 추가)
  if (hapCount > 0 && chungCount > 0) healthScore -= 0.2; // 합충 동시 = 복합 스트레스
  // [NEW] 장생/건록/제왕 = 체력 최상, 병/사/묘/절 = 체력 주의
  if (['병', '사'].includes(twelveStage)) healthScore -= 0.2;
  if (['절'].includes(twelveStage)) healthScore -= 0.15;

  // ━━━ 직업운 ━━━
  let careerScore = areaBase + sipArea.career + stArea.career;
  if (yeokmaFromDay === jiji || yeokmaFromYear === jiji) {
    if (chungCount > 0) careerScore -= 0.5;
    else careerScore += 0.3;
  }
  if (isExtSingang && isSiksang) careerScore += 0.5;
  // 정관+용신 시너지: 승진/안정의 최적 조합
  if (isJeongGwan && cheonganOhaeng === saju.yongsin) careerScore += 0.5;
  // [NEW] 편관운 = 직업 변동/압박 (신강이면 도전 기회, 신약이면 위험)
  if (isPyeonGwan) {
    if (isSingang || isExtSingang) careerScore += 0.2; // 강한 사람은 편관을 활용
    else careerScore -= 0.35; // 약한 사람은 편관에 눌림
  }
  // [NEW] 상관운 = 직장 내 갈등/반항 (이직 가능성)
  if (seunSipseong === '상관') careerScore -= 0.3;
  // [NEW] 정인운 = 학업/자격증 통한 커리어 발전
  if (seunSipseong === '정인') careerScore += 0.25;
  // [NEW] 편인운 = 전문기술 향상 (특수 분야에 유리)
  if (seunSipseong === '편인') careerScore += 0.15;
  // [NEW] 관대+정관 = 승진 최적기
  if (twelveStage === '관대' && isJeongGwan) careerScore += 0.4;
  // [NEW] 건록+비견 = 독립/창업 적기
  if (twelveStage === '건록' && seunSipseong === '비견' && isSingang) careerScore += 0.3;
  // [NEW] 역마+식상 = 해외진출/영업 확장
  if ((yeokmaFromDay === jiji || yeokmaFromYear === jiji) && isSiksang) careerScore += 0.3;
  // [NEW] 절+겁재 = 직업 리셋/실직 위험
  if (twelveStage === '절' && seunSipseong === '겁재') careerScore -= 0.3;
  // [NEW] 관성 오행 비율 적절(15~25%) = 직업 안정
  const gwanRatio = gwanOhaeng ? (bal[gwanOhaeng] || 0) / total : 0;
  if (gwanRatio >= 0.15 && gwanRatio <= 0.25) careerScore += 0.15;
  // [NEW] 재성+관성 연결 (재생관): 돈이 지위를 만드는 구조
  if (isJaeseong && gwanOhaeng && (bal[gwanOhaeng] || 0) >= 1.0) careerScore += 0.2;

  // ── 영역별 심층분석 반영 ──
  // 공망이면 해당 영역 약화
  if (gmSeun.isGongmang && jijiOhaeng !== saju.gisin) {
    moneyScore -= 0.3;
    careerScore -= 0.3;
    // [NEW] 공망 진공이면 영역별 추가 약화
    if (gmDetailSeun.isJingong) {
      studyScore -= 0.15;
      loveScore -= 0.15;
    }
  }
  // 천간합 결과 용신이면 영역 전체 보너스
  if (ganHapScoreSeun > 0) {
    loveScore += ganHapScoreSeun * 0.3;
    careerScore += ganHapScoreSeun * 0.3;
    // [NEW] 천간합 기신이면 영역별 약화
  } else if (ganHapScoreSeun < 0) {
    careerScore += ganHapScoreSeun * 0.2;
    moneyScore += ganHapScoreSeun * 0.15;
  }
  // 원국 충 해소 시 건강/연애 보너스
  if (wonChangeMod > 0) {
    healthScore += 0.3;
    loveScore += 0.2;
    // [NEW] 원국 충 해소 시 직업 안정 보너스
    careerScore += 0.15;
  } else if (wonChangeMod < 0) {
    healthScore -= 0.2;
    // [NEW] 원국 합 파괴 시 연애/직업도 약화
    loveScore -= 0.15;
    careerScore -= 0.1;
  }
  // 12운성×십성 시너지 영역별 반영
  if (stageContextMod > 0) {
    if (['관대'].includes(twelveStage)) careerScore += stageContextMod;
    if (['장생', '태', '양'].includes(twelveStage)) studyScore += stageContextMod;
    if (['묘'].includes(twelveStage)) moneyScore += stageContextMod;
    // [NEW] 건록+길신 = 재물/직업 모두 좋음
    if (['건록'].includes(twelveStage)) { moneyScore += stageContextMod * 0.5; careerScore += stageContextMod * 0.5; }
    // [NEW] 제왕+길신 = 직업 정점
    if (['제왕'].includes(twelveStage)) careerScore += stageContextMod * 0.7;
  } else if (stageContextMod < 0) {
    // [NEW] 12운성×흉신 시너지 시 영역별 감점 분배
    if (['목욕'].includes(twelveStage)) { loveScore += stageContextMod * 0.5; careerScore += stageContextMod * 0.3; }
    if (['병', '사'].includes(twelveStage)) { healthScore += stageContextMod * 0.5; careerScore += stageContextMod * 0.3; }
    if (['절'].includes(twelveStage)) { careerScore += stageContextMod * 0.5; moneyScore += stageContextMod * 0.3; }
  }
  // 지장간 심층분석 영역별 반영
  if (jgScore > 0.3) {
    moneyScore += 0.3;
    careerScore += 0.2;
    // [NEW] 지장간 본기가 용신이면 학업에도 보너스
    studyScore += 0.1;
  } else if (jgScore < -0.3) {
    moneyScore -= 0.2;
    healthScore -= 0.2;
    // [NEW] 지장간 기신이면 연애에도 약화
    loveScore -= 0.1;
  }

  // ── [NEW] 암합/투합/공망상세 영역별 세밀 반영 ──
  // 암합: 숨겨진 인연·조력 → 연애/직업에 미세 반영
  if (amhapModSeun > 0) {
    loveScore += amhapModSeun * 0.4;  // 암합 = 숨겨진 인연
    careerScore += amhapModSeun * 0.3; // 암합 = 보이지 않는 조력
  } else if (amhapModSeun < 0) {
    loveScore += amhapModSeun * 0.3;
    healthScore += amhapModSeun * 0.2;
  }
  // 투합: 합의 효과 감소 → 연애/재물 복잡
  if (tuhapModSeun < 0) {
    loveScore += tuhapModSeun * 0.4;  // 투합 = 삼각관계/복잡한 인연
    moneyScore += tuhapModSeun * 0.3; // 투합 = 투자 경쟁
  }

  // ── 추가 신살 영역별 반영 ──
  // advSinsalSeun은 위에서 이미 계산됨 (12신살 + 원진/귀문관 + 천덕/월덕)
  studyScore += advSinsalSeun.areaEffect.study;
  moneyScore += advSinsalSeun.areaEffect.money;
  loveScore += advSinsalSeun.areaEffect.love;
  healthScore += advSinsalSeun.areaEffect.health;
  careerScore += advSinsalSeun.areaEffect.career;

  // 천간충 영역별 반영
  if (ganChungModSeun < 0) {
    careerScore += ganChungModSeun * 0.5;  // 천간충은 직업/사회운에 직접 영향
    healthScore += ganChungModSeun * 0.3;
  } else if (ganChungModSeun > 0) {
    careerScore += ganChungModSeun * 0.4;
    moneyScore += ganChungModSeun * 0.3;
  }

  // 태세 영역별 반영
  if (taesaeMod !== 0) {
    careerScore += taesaeMod * 0.5;  // 태세는 주로 사회적 운에 영향
    moneyScore += taesaeMod * 0.3;
  }

  // 형충파해 합 해소 영역별 반영
  if (resolveModSeun > 0) {
    healthScore += resolveModSeun * 0.4;
    loveScore += resolveModSeun * 0.3;
  } else if (resolveModSeun < 0) {
    loveScore += resolveModSeun * 0.3;
    healthScore += resolveModSeun * 0.2;
  }

  // ── 지지충 주(柱)별 영역 차등 반영 ──
  if (chungCount > 0) {
    for (let ci = 0; ci < 4; ci++) {
      if (sajuJijis[ci] === JIJI_CHUNG[jiji]) {
        if (ci === 0) { careerScore -= 0.15; studyScore -= 0.1; }       // 년지충 = 사회환경/학업 기반 동요
        else if (ci === 1) { careerScore -= 0.2; moneyScore -= 0.15; }  // 월지충 = 직장/재물 흐름 변동
        else if (ci === 2) { loveScore -= 0.25; healthScore -= 0.2; }   // 일지충 = 배우자/건강 직격
        else if (ci === 3) { loveScore -= 0.1; healthScore -= 0.1; }    // 시지충 = 자녀/말년/미래 불안
      }
    }
  }

  // ── 4주(연주/월주/일주/시주) 관계도 영역별 반영 ──
  // pillarRelSeun은 위에서 이미 계산됨 (구조+운활성화+영역별 모두 포함)
  studyScore += pillarRelSeun.areaModifiers.study;
  moneyScore += pillarRelSeun.areaModifiers.money;
  loveScore += pillarRelSeun.areaModifiers.love;
  healthScore += pillarRelSeun.areaModifiers.health;
  careerScore += pillarRelSeun.areaModifiers.career;

  // 4주 관계의 십성 시너지/충돌이 영역에 미치는 추가 세밀 보정
  // (analyzePillarRelations 내부에서 계산된 십성교차 시너지 details 기반)
  for (const d of pillarRelSeun.details) {
    if (d.includes('식신생재')) moneyScore += 0.15;
    if (d.includes('관인상생')) { careerScore += 0.1; studyScore += 0.1; }
    if (d.includes('재관 시너지')) { careerScore += 0.1; moneyScore += 0.1; }
    if (d.includes('상관견관')) careerScore -= 0.15;
    if (d.includes('겁재탈재')) moneyScore -= 0.15;
    if (d.includes('효신탈식')) { studyScore -= 0.1; healthScore -= 0.1; }
    if (d.includes('삼합 완성') && d.includes('용신')) { careerScore += 0.2; moneyScore += 0.15; }
    if (d.includes('방합 완성') && d.includes('용신')) { careerScore += 0.15; }
    if (d.includes('통관 역할')) { healthScore += 0.15; careerScore += 0.1; }
    if (d.includes('기신 제압')) { careerScore += 0.1; healthScore += 0.05; }
  }

  // 운의 원국 구조 활성화 정도가 높으면 전 영역 미세 보너스
  if (pillarRelSeun.runActivation > 0.5) {
    const raBonus = (pillarRelSeun.runActivation - 0.5) * 0.2;
    studyScore += raBonus; moneyScore += raBonus; loveScore += raBonus;
    healthScore += raBonus; careerScore += raBonus;
  } else if (pillarRelSeun.runActivation < -0.5) {
    const raPenalty = (pillarRelSeun.runActivation + 0.5) * 0.15;
    studyScore += raPenalty; moneyScore += raPenalty; loveScore += raPenalty;
    healthScore += raPenalty; careerScore += raPenalty;
  }

  // ── 시기별 맥락 + 궁위 분석 영역별 반영 ──
  // lifePhaseSeun은 위에서 이미 계산됨
  studyScore += lifePhaseSeun.areaBonus.study * lifePhaseSeun.areaWeights.study;
  moneyScore += lifePhaseSeun.areaBonus.money * lifePhaseSeun.areaWeights.money;
  loveScore += lifePhaseSeun.areaBonus.love * lifePhaseSeun.areaWeights.love;
  healthScore += lifePhaseSeun.areaBonus.health * lifePhaseSeun.areaWeights.health;
  careerScore += lifePhaseSeun.areaBonus.career * lifePhaseSeun.areaWeights.career;
  // 궁위 질을 영역별로 차등 반영
  studyScore += lifePhaseSeun.educationQuality * 0.15;
  moneyScore += lifePhaseSeun.wealthStructure * 0.15;
  loveScore += lifePhaseSeun.spouseQuality * 0.15;
  healthScore -= lifePhaseSeun.healthVulnerability * 0.1;
  careerScore += lifePhaseSeun.careerFoundation * 0.15;

  // ── 대운 영역별 점수 반영 (대운이 좋으면 세운도 좋은 방향으로) ──
  if (currentDaeun?.areaScores) {
    const da = currentDaeun.areaScores;
    const daeunBase = currentDaeun.score; // 대운 종합 점수 (1~10)

    // (1) 편차 반영: 대운 영역이 종합보다 높/낮으면 세운에도 반영 (±0.3 범위)
    studyScore += Math.max(-0.3, Math.min(0.3, (da.study - daeunBase) * 0.1));
    moneyScore += Math.max(-0.3, Math.min(0.3, (da.money - daeunBase) * 0.1));
    loveScore += Math.max(-0.3, Math.min(0.3, (da.love - daeunBase) * 0.1));
    healthScore += Math.max(-0.3, Math.min(0.3, (da.health - daeunBase) * 0.1));
    careerScore += Math.max(-0.3, Math.min(0.3, (da.career - daeunBase) * 0.1));

    // (2) 절대 수준 반영: 대운 영역별 점수가 높으면(7+) 세운도 보너스, 낮으면(3-) 감점
    //     10년 대운의 기조가 세운 각 영역에 지속적으로 영향 (±0.5 범위)
    const absBonus = (areaVal: number) => {
      if (areaVal >= 8) return 0.5;
      if (areaVal >= 7) return 0.3;
      if (areaVal >= 6) return 0.1;
      if (areaVal <= 2) return -0.5;
      if (areaVal <= 3) return -0.3;
      if (areaVal <= 4) return -0.1;
      return 0;
    };
    studyScore += absBonus(da.study);
    moneyScore += absBonus(da.money);
    loveScore += absBonus(da.love);
    healthScore += absBonus(da.health);
    careerScore += absBonus(da.career);
  }

  // ── [1차] 영역별 점수 초벌 앵커링: 종합 대비 ±2.0 이내 ──
  const maxDeviation = 2.0;
  const anchorAreaTo = (raw: number, anchor: number) => {
    const clamped = clampArea(raw);
    if (clamped > anchor + maxDeviation) return clampArea(anchor + maxDeviation);
    if (clamped < anchor - maxDeviation) return clampArea(anchor - maxDeviation);
    return clamped;
  };

  let areaScores: SeunAreaScores = {
    study: anchorAreaTo(studyScore, score),
    money: anchorAreaTo(moneyScore, score),
    love: anchorAreaTo(loveScore, score),
    health: anchorAreaTo(healthScore, score),
    career: anchorAreaTo(careerScore, score),
  };

  // ── 종합 ↔ 영역 상호 수렴 (50/50 블렌딩) ──
  const areaAvgSeun = (areaScores.study + areaScores.money + areaScores.love + areaScores.health + areaScores.career) / 5;
  score = Math.round(Math.max(2, Math.min(9, score * 0.5 + areaAvgSeun * 0.5)));

  // ── [2차] 최종 블렌딩된 종합 기준으로 영역 재앵커링 (±1.5) ──
  const finalMaxDev = 1.5;
  const reAnchor = (val: number) => {
    if (val > score + finalMaxDev) return clampArea(score + finalMaxDev);
    if (val < score - finalMaxDev) return clampArea(score - finalMaxDev);
    return val;
  };
  areaScores = {
    study: reAnchor(areaScores.study),
    money: reAnchor(areaScores.money),
    love: reAnchor(areaScores.love),
    health: reAnchor(areaScores.health),
    career: reAnchor(areaScores.career),
  };

  const description = generateSeunDescription(saju, cheongan, jiji, twelveStage, score, targetYear, seunSipseong, cheonganOhaeng, jijiOhaeng, specialNotes);

  // ── 영역별 고득점 요인 수집 (7점 이상일 때 텍스트 부각용) ──
  const hf: SeunTextContext['highFactors'] = { study: [], money: [], love: [], health: [], career: [] };

  // 학업운 요인
  if ((isExtSingang || isSingang) && isInseong) hf.study.push('신강+인성으로 학업 집중력 최상');
  if (isSinyak && isInseong) hf.study.push('인성운이 부족한 기운을 보충해 학업 최적기');
  if (hwagaeFromDay === jiji || hwagaeFromYear === jiji) hf.study.push('화개살 발동으로 학문·예술적 영감 폭발');
  if (getDeficiency(inOhaeng) && (cheonganOhaeng === inOhaeng || jijiOhaeng === inOhaeng)) hf.study.push('결핍된 인성 오행 보충으로 학습 효율 상승');
  if (cheonganOhaeng === saju.yongsin || jijiOhaeng === saju.yongsin) hf.study.push('용신 기운 유입으로 전반적 상승');

  // 재물운 요인
  if (isExtSingang && isJaeseong) hf.money.push('신강+재성운으로 재물 획득력 최고조');
  if (seunSipseong === '정재' && ['건록', '제왕'].includes(twelveStage)) hf.money.push(`정재+${twelveStage}으로 안정적 고수입의 최적기`);
  if (seunSipseong === '편재' && ['장생', '관대'].includes(twelveStage)) hf.money.push(`편재+${twelveStage}으로 투자·사업 기회 극대화`);
  if (isSingang && isSiksang) hf.money.push('신강+식상운으로 활발한 경제활동');
  if (isSiksang && (bal[jaeOhaeng] || 0) >= 1.5) hf.money.push('식상→재성 생성 흐름으로 수입 창출력 상승');
  if (getDeficiency(jaeOhaeng) && (cheonganOhaeng === jaeOhaeng || jijiOhaeng === jaeOhaeng)) hf.money.push('결핍된 재성 오행이 채워져 재물운 활성화');
  if (cheonganOhaeng === saju.yongsin || jijiOhaeng === saju.yongsin) hf.money.push('용신 기운이 재물을 강력히 지원');

  // 연애운 요인
  if (saju.gender === 'female' && isJeongGwan) hf.love.push('정관운으로 좋은 남성 인연의 최적기');
  if (saju.gender === 'male' && seunSipseong === '정재') hf.love.push('정재운으로 좋은 여성 인연의 최적기');
  if (isExtSingang && isJaeseong && saju.gender === 'male') hf.love.push('신강+재성으로 남성 배우자운 강화');
  if (dohwaFromDay === jiji || dohwaFromYear === jiji) hf.love.push('도화살 발동으로 이성 매력 최고조');
  if (CHEONGAN_HAP_CHECK[cheongan] === saju.ilgan) hf.love.push('천간합이 일간과 맺어져 인연의 힘 상승');
  if (YUKHAP_CHECK[jiji] === saju.day.jiji) hf.love.push('일지 육합으로 배우자궁 활성화');
  if (twelveStage === '목욕') hf.love.push('목욕 운성으로 연애 활발');
  if (isSiksang && (dohwaFromDay === jiji || dohwaFromYear === jiji)) hf.love.push('식상+도화로 매력 폭발');
  if (amhapModSeun > 0) hf.love.push('암합으로 숨겨진 인연이 활성화');

  // 건강운 요인
  if ((cheonganOhaeng === weakestOh || jijiOhaeng === weakestOh) && (bal[weakestOh] || 0) / total < 0.1) hf.health.push('최약 오행 보충으로 체질 균형 개선');
  if (seunSipseong === '식신') hf.health.push('식신운으로 건강 관리 의지 상승');
  if (isInseong && (cheonganOhaeng === saju.yongsin || jijiOhaeng === saju.yongsin)) hf.health.push('인성+용신으로 정신적 안정 최상');
  if (balanceMod > 0.5) hf.health.push('오행 밸런스 크게 개선');
  if (['장생', '건록', '제왕'].includes(twelveStage)) hf.health.push(`${twelveStage} 운성으로 체력·활력 최고조`);

  // 직업운 요인
  if (twelveStage === '관대' && isJeongGwan) hf.career.push('관대+정관으로 승진·인정의 최적기');
  if (twelveStage === '건록' && seunSipseong === '비견' && isSingang) hf.career.push('건록+비견으로 독립·창업 적기');
  if (isJeongGwan && cheonganOhaeng === saju.yongsin) hf.career.push('정관+용신으로 직업 안정과 승진 최고 시너지');
  if (isPyeonGwan && (isSingang || isExtSingang)) hf.career.push('신강+편관으로 도전적 기회 활용 가능');
  if ((yeokmaFromDay === jiji || yeokmaFromYear === jiji) && isSiksang) hf.career.push('역마+식상으로 해외진출·영업 확장의 기회');
  else if (yeokmaFromDay === jiji || yeokmaFromYear === jiji) hf.career.push('역마살 발동으로 이동·변화·해외 활동 활성화');
  if (isExtSingang && isSiksang) hf.career.push('신강+식상운으로 표현력·실행력 극대화');
  if (seunSipseong === '정인') hf.career.push('정인운으로 학업·자격증 통한 커리어 발전');
  if (amhapModSeun > 0) hf.career.push('암합으로 보이지 않는 조력 활성화');

  // 영역별 텍스트 생성 — 세운 십성·간지·연도·합충 정보 전달하여 연도별 차별화
  const seunCtx: SeunTextContext = { seunSipseong, cheongan, jiji, targetYear, specialNotes, chungCount, hapCount, highFactors: hf };
  const love = generateSeunLove(saju, cheonganOhaeng, jijiOhaeng, twelveStage, areaScores.love, seunCtx);
  const money = generateSeunMoney(saju, cheonganOhaeng, jijiOhaeng, twelveStage, areaScores.money, seunCtx);
  const career = generateSeunCareer(saju, cheonganOhaeng, jijiOhaeng, twelveStage, areaScores.career, seunCtx);
  const health = generateSeunHealth(saju, cheonganOhaeng, jijiOhaeng, twelveStage, areaScores.health, seunCtx);

  // 신년운세 상세 분석 데이터 생성
  const balanceAnalysis = analyzeBalanceChange(saju, cheonganOhaeng, jijiOhaeng);
  const monthlyHighlights = getMonthlyHighlights(saju, targetYear, cheongan);
  const jijangganAnalysis = getJijangganAnalysis(saju, jiji, jijiOhaeng);
  const luckyInfo = getLuckyInfo(saju, seunSipseong);

  const seunResult: SeunResult = {
    year: targetYear,
    cheongan, jiji,
    cheonganOhaeng, jijiOhaeng,
    animal, twelveStage,
    overallScore: score,
    areaScores,
    description, love, money, career, health,
    gyeokguk,
    johu,
    daeunCross,
    balanceAnalysis,
    monthlyHighlights,
    jijangganAnalysis,
    luckyInfo,
    sipseong: seunSipseong,
    specialNotes,
    familyNotes: analyzeFamilyRelations(saju, cheongan, jiji, saju.age ?? 30, false),
  };


  return filterSeunResultForChildren(seunResult, saju);
}

function generateSeunDescription(saju: SajuResult, gan: string, ji: string, stage: TwelveStage, score: number, year: number, sipseong: string, ganOh: Ohaeng, jiOh: Ohaeng, specialNotes: string[]): string {
  const stageData = TWELVE_STAGE_DATA[stage];
  const animal = ANIMALS[(JIJI.indexOf(ji as typeof JIJI[number]) + 12) % 12];

  // ── 1) 헤더 (간결하게) ──
  const stars = Math.max(1, Math.min(5, Math.round(score / 2)));
  let desc = `${year}년 ${gan}${ji}년(${animal}띠) · ${stage}${stageData.emoji} · ${sipseong}\n`;
  desc += `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} (${score}/10)\n\n`;

  // ── 2) 올해 핵심 흐름 (12운성 + 점수 기반, 2~3문장) ──
  const STAGE_KEYWORD: Record<string, string> = {
    '태': '새 시작의 씨앗을 뿌리는', '양': '계획이 구체화되는',
    '장생': '성장과 도전의', '목욕': '변화와 만남이 활발한',
    '관대': '사회적 인정을 받는', '건록': '실력이 빛나는',
    '제왕': '정점 에너지의', '쇠': '경험과 지혜로 승부하는',
    '병': '건강 관리가 중요한', '사': '전환점이 되는',
    '묘': '재충전과 내면 성장의', '절': '리셋과 재탄생의',
  };
  const keyword = STAGE_KEYWORD[stage] || '';

  if (score >= 8) {
    desc += `${keyword} 시기로, 매우 좋은 운세입니다. ${OHAENG_METAPHOR[ganOh]} 기운이 힘을 더해 적극적으로 도전하기에 최적의 해입니다.`;
  } else if (score >= 6) {
    desc += `${keyword} 시기로, 대체로 순탄합니다. 꾸준한 노력이 성과로 이어지는 해입니다.`;
  } else if (score >= 4) {
    desc += `${keyword} 시기이나, 무리하지 않고 안정적으로 보내는 것이 현명합니다. 에너지를 비축하세요.`;
  } else {
    desc += `${keyword} 시기로, 내실을 다지는 데 집중하세요. 이 시기가 지나면 반드시 더 나은 때가 옵니다.`;
  }

  // ── 3) 용신/기신 핵심 (1~2문장) ──
  const ganIsYongsin = ganOh === saju.yongsin;
  const jiIsYongsin = jiOh === saju.yongsin;
  const ganIsGisin = ganOh === saju.gisin;
  const jiIsGisin = jiOh === saju.gisin;
  const hasYongsin = ganIsYongsin || jiIsYongsin;
  const hasGisin = ganIsGisin || jiIsGisin;

  if (hasYongsin && !hasGisin) {
    desc += `\n\n💎 용신(${saju.yongsin}) 기운이 들어와 운이 상승합니다.`;
  } else if (hasGisin && !hasYongsin) {
    desc += `\n\n⚠️ 기신(${saju.gisin}) 기운이 강해지니, 과한 욕심을 줄이고 방어적으로 행동하세요.`;
  } else if (hasYongsin && hasGisin) {
    desc += `\n\n🔄 좋은 기운(${saju.yongsin})과 어려운 기운(${saju.gisin})이 함께 옵니다. 기회를 잡되 리스크 관리도 하세요.`;
  }

  // ── 4) 특수관계 (합충/신살) — 있을 때만 간단히 ──
  if (specialNotes.length > 0) {
    desc += '\n\n⚡ ' + specialNotes.slice(0, 2).join(' / ');
  }

  // 자녀 유무 기반 텍스트 보정
  if (saju) {
    desc = adjustTextByChildren(desc, saju.hasChildren);
  }

  return desc;
}

/** 세운 오행이 원국 밸런스에 미치는 영향 분석 */
function analyzeBalanceChange(saju: SajuResult, ganOh: Ohaeng, jiOh: Ohaeng): string {
  if (!saju.ohaengBalance) return '';
  const bal = saju.ohaengBalance;
  const allOh: Ohaeng[] = ['목', '화', '토', '금', '수'];
  const maxOh = allOh.reduce((a, b) => (bal[a] || 0) > (bal[b] || 0) ? a : b);
  const minOh = allOh.reduce((a, b) => (bal[a] || 0) < (bal[b] || 0) ? a : b);
  const minVal = bal[minOh] || 0;

  const parts: string[] = [];

  // 현재 오행 분포 시각화
  const barChart = allOh.map(oh => {
    const v = bal[oh] || 0;
    const bar = '█'.repeat(Math.round(v));
    const incoming = (oh === ganOh || oh === jiOh) ? ' ⬆' : '';
    return `  ${OHAENG_NAME[oh]}(${oh}): ${bar} ${v}${incoming}`;
  }).join('\n');
  parts.push(`📊 현재 오행 분포 (⬆=올해 유입):\n${barChart}`);

  // 세운으로 인한 변화 분석
  const incomingOh = new Set<Ohaeng>();
  if (ganOh) incomingOh.add(ganOh);
  if (jiOh) incomingOh.add(jiOh);

  // 이 해에 들어오는 오행이 부족한 오행을 채워주는지
  if (ganOh === minOh || jiOh === minOh) {
    const FILL_ACTIVITY: Record<Ohaeng, string> = {
      '목': '나무·식물 가꾸기, 등산, 초록색 소품 활용이 이 기운을 더욱 키워줍니다.',
      '화': '밝은 조명, 촛불 명상, 활발한 사교 활동이 이 기운을 북돋아줍니다.',
      '토': '도자기·흙 관련 취미, 규칙적 식사, 중후한 노란색 소품이 안정감을 줍니다.',
      '금': '금속 액세서리 착용, 악기 연주, 결단력 있는 행동이 이 기운을 살려줍니다.',
      '수': '수영·족욕, 충분한 수분 섭취, 유연한 사고방식이 이 기운을 보충합니다.',
    };
    parts.push(`✅ 올해 ${OHAENG_NAME[minOh]} 기운이 들어와 가장 부족한 오행(${minOh}=${minVal})을 보충합니다. 약했던 부분이 채워지면서 전체적인 균형이 개선됩니다. ${FILL_ACTIVITY[minOh]}`);
  }
  // 이미 넘치는 오행이 더 들어오는지
  if (ganOh === maxOh || jiOh === maxOh) {
    const BALANCE_TIP: Record<Ohaeng, string> = {
      '목': '금(金) 기운으로 제어하세요 — 금속 소품, 흰색 인테리어, 결단력 있는 판단이 도움됩니다.',
      '화': '수(水) 기운으로 식혀주세요 — 수영, 냉수 마시기, 차분한 명상이 필요합니다.',
      '토': '목(木) 기운으로 뚫어주세요 — 등산, 식물 가꾸기, 새로운 도전이 편중을 완화합니다.',
      '금': '화(火) 기운으로 녹여주세요 — 열정적 활동, 사교 모임, 밝은 색상 활용이 효과적입니다.',
      '수': '토(土) 기운으로 막아주세요 — 규칙적 루틴, 안정적 환경, 노란색·갈색 소품이 도움됩니다.',
    };
    parts.push(`⚠️ 이미 강한 ${OHAENG_NAME[maxOh]} 기운(${maxOh}=${bal[maxOh]})이 올해 더 강화됩니다. 편중이 심해지면 건강·성격·대인관계에 부정적 영향이 올 수 있습니다. ${BALANCE_TIP[maxOh]}`);
  }
  // 용신 오행이 들어오면 → 밸런스 개선
  if ((ganOh === saju.yongsin || jiOh === saju.yongsin) && !parts.some(p => p.includes('보충'))) {
    parts.push(`💎 용신(${saju.yongsin}) 기운이 유입되어 사주의 균형이 좋아지는 방향입니다. 이 기운을 적극 활용하세요!`);
  }
  // 기신 오행 유입 경고
  if ((ganOh === saju.gisin || jiOh === saju.gisin) && !parts.some(p => p.includes('편중'))) {
    parts.push(`🚨 기신(${saju.gisin}) 기운이 유입됩니다. ${OHAENG_NAME[saju.gisin]} 관련 활동(${saju.gisin === '화' ? '과로·흥분·분노' : saju.gisin === '수' ? '방탕·우유부단' : saju.gisin === '목' ? '과욕·무모한 확장' : saju.gisin === '금' ? '고집·냉정함' : '게으름·정체'})을 줄이고 용신(${saju.yongsin}) 활동으로 상쇄하세요.`);
  }

  // 오행 편중도 진단
  const maxVal = bal[maxOh] || 0;
  const gap = maxVal - minVal;
  if (gap >= 5) {
    parts.push(`📈 편중도 진단: ${OHAENG_NAME[maxOh]}(${maxVal}) vs ${OHAENG_NAME[minOh]}(${minVal}) — 격차 ${gap}로 매우 불균형합니다. 부족한 ${OHAENG_NAME[minOh]} 보충에 특히 신경 쓰세요.`);
  } else if (gap >= 3) {
    parts.push(`📊 편중도 진단: ${OHAENG_NAME[maxOh]}(${maxVal}) vs ${OHAENG_NAME[minOh]}(${minVal}) — 격차 ${gap}로 다소 불균형합니다. 균형 잡는 노력이 필요합니다.`);
  }

  return parts.join('\n');
}

/** 월별 운세 하이라이트 — 12개월의 간지를 계산하여 좋은 달/주의할 달 표시 */
function getMonthlyHighlights(saju: SajuResult, year: number, yearGan: string): string {
  const yearGanIdx = CHEONGAN.indexOf(yearGan as typeof CHEONGAN[number]);
  const yearGanGroup = yearGanIdx % 5;
  const startGan: Record<number, number> = { 0: 2, 1: 4, 2: 6, 3: 8, 4: 0 };

  type MonthInfo = { month: number; gan: string; ji: string; ganOh: Ohaeng; jiOh: Ohaeng; sipseong: string; score: number };
  const months: MonthInfo[] = [];

  for (let m = 1; m <= 12; m++) {
    const jiIdx = (m + 1) % 12;
    const ganIdx = (startGan[yearGanGroup] + (m - 1)) % 10;
    const gan = CHEONGAN[ganIdx];
    const ji = JIJI[jiIdx];
    const ganOh = CHEONGAN_OHAENG[gan];
    const jiOh = JIJI_OHAENG[ji];
    const sipseong = calculateSipseong(saju.ilgan, gan);

    let sc = 5;
    if (ganOh === saju.yongsin) sc += 1.5;
    if (jiOh === saju.yongsin) sc += 1;
    if (ganOh === saju.gisin) sc -= 1.5;
    if (jiOh === saju.gisin) sc -= 1;
    if (sipseong === '식신' || sipseong === '정재' || sipseong === '정관') sc += 0.5;
    if (sipseong === '편관') sc -= 0.5;
    if (sipseong === '겁재') sc -= 0.3;

    months.push({ month: m, gan, ji, ganOh, jiOh, sipseong, score: Math.round(sc * 2) / 2 });
  }

  // 월별 십성 요약 코멘트
  const SIP_MONTH_TIP: Record<string, string> = {
    '비견': '경쟁·협력', '겁재': '지출주의', '식신': '창작·식복', '상관': '변화·표현',
    '편재': '투자기회', '정재': '안정수입', '편관': '시험·압박', '정관': '승진·명예',
    '편인': '학문·영감', '정인': '배움·성장',
  };

  const sorted = [...months].sort((a, b) => b.score - a.score);
  const best = sorted.slice(0, 2);
  const worst = sorted.slice(-2).reverse();

  let text = '【월별 운세 하이라이트】\n';

  // 12개월 전체 캘린더
  text += '📅 월별 흐름:\n';
  for (const m of months) {
    const stars = m.score >= 7 ? '🟢' : m.score >= 5 ? '🟡' : '🔴';
    const tip = SIP_MONTH_TIP[m.sipseong] || '';
    text += `  ${m.month}월 ${m.gan}${m.ji}(${m.sipseong}) ${stars}${m.score}점 — ${tip}\n`;
  }

  // 베스트/워스트 상세
  text += `\n🏆 최고의 달:\n`;
  for (const m of best) {
    const yongParts: string[] = [];
    if (m.ganOh === saju.yongsin) yongParts.push(`천간(${m.gan}=${m.ganOh})`);
    if (m.jiOh === saju.yongsin) yongParts.push(`지지(${m.ji}=${m.jiOh})`);
    const reason = yongParts.length > 0 ? `${yongParts.join('+')}에서 용신 기운` : `${m.sipseong} 십성의 긍정적 작용`;
    text += `  ${m.month}월(${m.gan}${m.ji}, ${m.sipseong}, ${m.score}점): ${reason}. 중요한 계약·시험·면접·고백을 잡기에 최적입니다.\n`;
  }
  text += `⚠️ 주의할 달:\n`;
  for (const m of worst) {
    const giParts: string[] = [];
    if (m.ganOh === saju.gisin) giParts.push(`천간(${m.gan}=${m.ganOh})`);
    if (m.jiOh === saju.gisin) giParts.push(`지지(${m.ji}=${m.jiOh})`);
    const reason = giParts.length > 0 ? `${giParts.join('+')}에서 기신 기운` : `${m.sipseong} 십성의 부정적 작용`;
    text += `  ${m.month}월(${m.gan}${m.ji}, ${m.sipseong}, ${m.score}점): ${reason}. 큰 결정·투자·이직은 미루고 현상 유지에 집중하세요.\n`;
  }

  // 상반기 vs 하반기 비교
  const h1Avg = months.slice(0, 6).reduce((s, m) => s + m.score, 0) / 6;
  const h2Avg = months.slice(6).reduce((s, m) => s + m.score, 0) / 6;
  if (h1Avg > h2Avg + 0.5) {
    text += `📈 상반기(평균 ${h1Avg.toFixed(1)}점)가 하반기(${h2Avg.toFixed(1)}점)보다 유리합니다. 중요한 일은 상반기에 집중하세요.`;
  } else if (h2Avg > h1Avg + 0.5) {
    text += `📈 하반기(평균 ${h2Avg.toFixed(1)}점)가 상반기(${h1Avg.toFixed(1)}점)보다 유리합니다. 상반기에 준비하고 하반기에 실행하세요.`;
  } else {
    text += `📊 상반기(${h1Avg.toFixed(1)}점)와 하반기(${h2Avg.toFixed(1)}점)가 비슷한 흐름입니다. 꾸준한 페이스를 유지하세요.`;
  }

  return text;
}

/** 지장간 분석 — 세운 지지 속 숨겨진 천간의 영향 */
function getJijangganAnalysis(saju: SajuResult, ji: string, jiOh: Ohaeng): string {
  const janggan = JIJI_JANGGAN[ji];
  if (!janggan || janggan.length === 0) return '';

  let text = `【지장간(숨겨진 기운) 분석】\n`;

  // 지장간 발현 시기 설명
  const PHASE_NAMES = ['초기(여기, 1~10일)', '중기(중기, 11~20일)', '말기(정기, 21~30일)'];
  text += `${ji}(${OHAENG_NAME[jiOh]}) 지지 속에 숨겨진 천간들:\n`;

  const details: string[] = [];
  for (let i = 0; i < janggan.length; i++) {
    const jg = janggan[i];
    const jgOh = CHEONGAN_OHAENG[jg];
    const jgSip = calculateSipseong(saju.ilgan, jg);
    let impact = '';
    if (jgOh === saju.yongsin) impact = '✅용신';
    else if (jgOh === saju.gisin) impact = '⚠️기신';
    else impact = '중립';
    const phase = i < janggan.length ? (janggan.length === 1 ? '전체 기간' :
      janggan.length === 2 ? (i === 0 ? '전반부' : '후반부') :
      (i === 0 ? '초기(1~10일)' : i === 1 ? '중기(11~20일)' : '말기(정기, 21~30일)')) : '';

    // 십성별 구체적 영향
    const SIP_EFFECT: Record<string, string> = {
      '비견': '동료·경쟁자의 등장, 자기주장 강화',
      '겁재': '예상치 못한 지출, 재물 유출 주의',
      '식신': '재능 발현, 식복, 건강 회복',
      '상관': '자유로운 표현, 윗사람과의 마찰 가능',
      '편재': '투자 기회, 유동적 재물 흐름',
      '정재': '안정적 수입, 저축 기회',
      '편관': '외부 압박, 시험·경쟁 긴장감',
      '정관': '사회적 인정, 승진 기운',
      '편인': '독특한 영감, 학문적 깨달음',
      '정인': '은인의 도움, 학업 향상',
    };
    const effect = SIP_EFFECT[jgSip] || '';

    details.push(`  ${i + 1}. ${jg}(${OHAENG_NAME[jgOh]}) — ${jgSip}(${impact}) [${phase}]\n     → ${effect}`);
  }
  text += details.join('\n') + '\n';

  // 용신/기신 지장간 유무에 따른 해석
  const hasYongJJ = janggan.some(jg => CHEONGAN_OHAENG[jg] === saju.yongsin);
  const hasGisinJJ = janggan.some(jg => CHEONGAN_OHAENG[jg] === saju.gisin);

  if (hasYongJJ && !hasGisinJJ) {
    const yongIdx = janggan.findIndex(jg => CHEONGAN_OHAENG[jg] === saju.yongsin);
    const timing = janggan.length <= 1 ? '꾸준히' :
      yongIdx === 0 ? '월 초반부터' : yongIdx === janggan.length - 1 ? '월 후반으로 갈수록' : '월 중반에';
    text += `\n💎 종합: 겉으로는 드러나지 않지만 속에서 용신(${saju.yongsin}) 기운이 ${timing} 도와줍니다. 매달 하반기로 갈수록 좋아지는 흐름입니다. 조급하지 말고 기다리면 결실이 옵니다.`;
  } else if (hasGisinJJ && !hasYongJJ) {
    const giIdx = janggan.findIndex(jg => CHEONGAN_OHAENG[jg] === saju.gisin);
    const timing = janggan.length <= 1 ? '지속적으로' :
      giIdx === 0 ? '월 초반에 특히' : giIdx === janggan.length - 1 ? '월 후반에 특히' : '월 중반에 특히';
    text += `\n⚠️ 종합: 겉은 괜찮아 보여도 속에서 기신(${saju.gisin}) 기운이 ${timing} 작용합니다. 겉보기에 좋은 기회도 속을 잘 살펴봐야 합니다. 충동적 결정을 피하고 숙고하세요.`;
  } else if (hasYongJJ && hasGisinJJ) {
    text += `\n⚖️ 종합: 속에 좋은 기운(${saju.yongsin})과 나쁜 기운(${saju.gisin})이 뒤섞여 있습니다. 양날의 검 같은 해로, 신중하게 판단하면 좋은 쪽으로 이끌 수 있습니다. 선택의 순간에 용신 방향을 택하세요.`;
  } else {
    text += `\n🔵 종합: 지장간의 기운은 용신·기신과 직접적 관계가 적어 중립적으로 작용합니다. 다른 요인(합충형파해, 대운 등)의 영향이 더 크게 작용합니다.`;
  }

  return text;
}

/** 행운의 색상/방위/숫자 + 십성 기반 맞춤 개운법 */
function getLuckyInfo(saju: SajuResult, sipseong: string): string {
  const LUCKY: Record<Ohaeng, { color: string; direction: string; number: string; element: string; food: string; fashion: string; travel: string; health: string }> = {
    '목': { color: '초록색·청색·민트', direction: '동쪽', number: '3, 8', element: '나무·식물 인테리어, 산책·등산',
      food: '채소·나물·녹차·신맛 음식(식초, 레몬)', fashion: '초록·청색 계열 의류, 나무 소재 액세서리',
      travel: '산·숲·국립공원·식물원', health: '간·담낭 관리, 스트레칭, 아침 산책' },
    '화': { color: '빨간색·보라색·핑크', direction: '남쪽', number: '2, 7', element: '밝은 조명, 촛불, 열정적 활동',
      food: '쓴맛 음식(커피, 다크초콜릿), 붉은색 과일·토마토', fashion: '빨강·보라 포인트 의류, 밝은 색상 소품',
      travel: '따뜻한 지역·해변·온천·남쪽 여행', health: '심장·소장 관리, 유산소 운동, 충분한 수면' },
    '토': { color: '노란색·갈색·베이지', direction: '중앙', number: '5, 10', element: '도자기·흙 관련 취미, 안정적 루틴',
      food: '단맛 음식(꿀, 고구마), 곡물·잡곡밥, 황색 식품', fashion: '노랑·갈색·베이지 톤, 가죽 제품, 클래식 스타일',
      travel: '들판·평야·농촌 체험·사막 투어', health: '위장·비장 관리, 규칙적 식사, 소화 건강' },
    '금': { color: '흰색·금색·은색', direction: '서쪽', number: '4, 9', element: '금속 액세서리, 악기 연주, 결단력 있는 행동',
      food: '매운맛 음식(생강, 마늘), 흰색 식품(무, 배, 도라지)', fashion: '흰색·금속 톤, 시계·반지 등 금속 액세서리',
      travel: '서쪽 방향 여행, 도시·건축물 탐방', health: '폐·대장 관리, 호흡 운동, 깊은 심호흡' },
    '수': { color: '검정색·남색·짙은 파랑', direction: '북쪽', number: '1, 6', element: '수영·족욕, 수분 섭취, 유연한 사고',
      food: '짠맛 음식(해조류, 해산물), 검은콩·흑미·흑임자', fashion: '검정·남색·짙은 파랑, 물결무늬, 유연한 소재',
      travel: '바다·호수·강변·온천·북쪽 여행', health: '신장·방광 관리, 수영, 충분한 수분 섭취' },
  };

  const yong = saju.yongsin;
  const info = LUCKY[yong];

  let text = '【올해의 행운 정보】\n';
  text += `🎨 행운의 색상: ${info.color} (용신 ${yong} 기운 보충)\n`;
  text += `🧭 행운의 방위: ${info.direction}\n`;
  text += `🔢 행운의 숫자: ${info.number}\n`;
  text += `✨ 개운 활동: ${info.element}\n`;
  text += `🍽️ 행운의 음식: ${info.food}\n`;
  text += `👔 행운의 패션: ${info.fashion}\n`;
  text += `✈️ 행운의 여행: ${info.travel}\n`;
  text += `🏥 건강 포인트: ${info.health}\n\n`;

  // 십성별 맞춤 개운법 (상세)
  const SIP_GAEUN: Record<string, string> = {
    '비견': '💡 올해 개운법: 경쟁자를 의식하기보다 나만의 강점을 키우세요. 운동·자기계발로 에너지를 분출하면 경쟁에서 자연스럽게 앞서갑니다.\n📌 구체적 실천: 매일 30분 이상 유산소 운동, 주 1회 자기계발 시간 확보, 라이벌을 롤모델로 삼아 긍정적 자극으로 전환하세요.',
    '겁재': '💡 올해 개운법: 큰 돈 움직임을 자제하고, 보증·투자 제안은 48시간 냉각기를 두세요. 절약과 검소함이 최고의 재테크입니다.\n📌 구체적 실천: 월 고정 저축액 설정 후 자동이체, 충동구매 방지를 위해 장바구니 3일 규칙 적용, 보증·대출은 절대 금지.',
    '식신': '💡 올해 개운법: 요리·글쓰기·그림 등 창작 활동에 시간을 투자하세요. 재능을 키우면 자연스럽게 수입으로 연결됩니다.\n📌 구체적 실천: 주 1회 새로운 요리 도전, 블로그나 SNS에 작품 공유, 취미를 부업으로 연결할 수 있는 방법 탐색하세요.',
    '상관': '💡 올해 개운법: 말 한마디를 내뱉기 전에 3초 멈추세요. 특히 윗사람 앞에서 자기주장보다 경청이 득입니다.\n📌 구체적 실천: 감정일기 쓰기, 예술·운동으로 에너지 발산, 중요한 대화 전 메모로 정리한 후 말하기. 분노 조절이 올해 최대 과제입니다.',
    '편재': '💡 올해 개운법: 한 곳에 올인하지 말고 분산 투자하세요. 인맥이 곧 돈입니다.\n📌 구체적 실천: 투자 포트폴리오를 3개 이상으로 분산, 월 1회 이상 네트워킹 모임 참석, 새로운 정보 채널(뉴스레터·커뮤니티) 구독하세요.',
    '정재': '💡 올해 개운법: 자동이체 적금을 하나 더 만드세요. 꾸준히 쌓는 것이 정재의 힘입니다.\n📌 구체적 실천: 가계부 앱 매일 기록, 연 1회 자산현황 점검표 작성, 불필요한 구독 서비스 해지. 소소한 절약이 연말에 큰 차이를 만듭니다.',
    '편관': '💡 올해 개운법: 스트레스 해소법을 반드시 마련하세요. 체력이 곧 운세입니다.\n📌 구체적 실천: 규칙적 운동(주 3회 이상), 명상·요가 10분씩, 과로 방지를 위한 타이머 설정. 건강검진 꼭 받으세요. 스트레스를 방치하면 큰 탈이 납니다.',
    '정관': '💡 올해 개운법: 자격증·면허·승진 기회를 적극적으로 노리세요.\n📌 구체적 실천: 연초에 목표 자격증/승진 계획 수립, 상사에게 성과 보고 주기적으로 하기, 업무 매뉴얼화로 체계적 이미지 구축. 성실함이 곧 인정으로 이어집니다.',
    '편인': '💡 올해 개운법: 새로운 분야의 책이나 강좌를 시작해보세요. 내면의 에너지를 채워줍니다.\n📌 구체적 실천: 월 2권 이상 독서, 명상·요가·철학 강좌 수강, 주 1회 이상 사교 모임 유지(세상과의 연결 끊기지 않도록). 혼자만의 시간과 사교의 균형이 핵심입니다.',
    '정인': '💡 올해 개운법: 배움에 투자하세요! 배운 것을 남에게 가르치면 두 배로 돌아옵니다.\n📌 구체적 실천: 온라인 강좌 1개 이상 수료, 독서 모임·스터디 그룹 참여, 멘토 찾기. 감사 편지를 은인에게 보내면 좋은 기운이 순환됩니다.',
  };

  text += (SIP_GAEUN[sipseong] || '💡 올해 개운법: 용신 오행의 색상을 자주 활용하고, 행운의 방위에서 중요한 활동을 하세요.');

  return text;
}

/** 대운+세운 교차 분석 — 현재 대운과 세운의 시너지/충돌 */
function getDaeunSeunCross(saju: SajuResult, ganOh: Ohaeng, jiOh: Ohaeng, stage: TwelveStage, year: number, seunGan: string, seunJi: string): string {
  // 현재 대운 추정 (saju.age 기준)
  const birthYear = year - saju.age + 1;
  const direction = getDaeunDirection(saju.year.cheongan, saju.gender);
  // 월주 지지에서 생월 추정 (인=1월, 묘=2월, ... 축=12월)
  const JIJI_TO_MONTH: Record<string, number> = {
    '인': 1, '묘': 2, '진': 3, '사': 4, '오': 5, '미': 6,
    '신': 7, '유': 8, '술': 9, '해': 10, '자': 11, '축': 12,
  };
  const estimatedMonth = JIJI_TO_MONTH[saju.month.jiji] || 6;
  // 정확한 대운 시작 나이 계산 (생일은 15일 평균 추정)
  const startAge = calculateDaeunStartAge(estimatedMonth, 15, direction);
  const currentAge = year - birthYear + 1;
  const daeunIdx = Math.max(1, Math.floor((currentAge - startAge) / 10) + 1);

  const monthGanIdx = CHEONGAN.indexOf(saju.month.cheongan as typeof CHEONGAN[number]);
  const monthJiIdx = JIJI.indexOf(saju.month.jiji as typeof JIJI[number]);

  let dGanIdx: number, dJiIdx: number;
  if (direction === 'forward') {
    dGanIdx = (monthGanIdx + daeunIdx) % 10;
    dJiIdx = (monthJiIdx + daeunIdx) % 12;
  } else {
    dGanIdx = (monthGanIdx - daeunIdx + 100) % 10;
    dJiIdx = (monthJiIdx - daeunIdx + 120) % 12;
  }
  const dGan = CHEONGAN[dGanIdx];
  const dJi = JIJI[dJiIdx];
  const dGanOh = CHEONGAN_OHAENG[dGan];
  const dJiOh = JIJI_OHAENG[dJi];
  const dStage = calculateTwelveStage(saju.ilgan, dJi);

  // 대운 십성 계산
  const dSipseong = calculateSipseong(saju.ilgan, dGan);

  let text = `【대운+세운 교차 분석】\n`;
  text += `현재 대운: ${dGan}${dJi}(${dGanOh}+${dJiOh}) ${dStage} | 대운 십성: ${dSipseong}\n`;
  text += `올해 세운: ${seunGan}${seunJi}(${ganOh}+${jiOh}) ${stage}\n`;

  // 대운 십성 해석
  const D_SIP_MEANING: Record<string, string> = {
    '비견': '독립·경쟁의 10년 흐름 속에 있습니다. 자기 힘으로 개척하는 시기입니다.',
    '겁재': '재물 변동이 큰 10년 흐름입니다. 지키는 전략이 중요합니다.',
    '식신': '재능·표현의 10년 흐름입니다. 창작과 기술이 빛나는 시기입니다.',
    '상관': '변화·도전의 10년 흐름입니다. 기존 틀을 깨고 새로운 길을 모색하는 시기입니다.',
    '편재': '사업·투자의 10년 흐름입니다. 큰 돈이 오가는 역동적인 시기입니다.',
    '정재': '안정 수입의 10년 흐름입니다. 꾸준히 쌓아가는 시기입니다.',
    '편관': '시련·성장의 10년 흐름입니다. 압박 속에서 강해지는 시기입니다.',
    '정관': '명예·안정의 10년 흐름입니다. 사회적 지위가 높아지는 시기입니다.',
    '편인': '학문·영감의 10년 흐름입니다. 내면의 성장이 외면의 성과로 이어집니다.',
    '정인': '배움·성장의 10년 흐름입니다. 은인의 도움이 함께하는 시기입니다.',
  };
  text += `→ ${D_SIP_MEANING[dSipseong] || '평탄한 10년 흐름입니다.'}\n\n`;

  // 대운-세운 오행 시너지/충돌
  const parts: string[] = [];
  if (dGanOh === ganOh) parts.push(`천간 오행이 모두 ${ganOh}로 같아 올해 ${OHAENG_NAME[ganOh]} 기운이 극도로 강합니다. ${ganOh === saju.yongsin ? '용신이 배가되어 매우 유리합니다!' : ganOh === saju.gisin ? '기신이 겹쳐 가장 경계할 부분입니다.' : '편중에 주의하세요.'}`);
  if (dJiOh === jiOh) parts.push(`지지 오행이 모두 ${jiOh}로 같아 내면의 ${OHAENG_NAME[jiOh]} 기운이 크게 증폭됩니다. ${jiOh === saju.yongsin ? '내면에서 용신이 강하게 작용합니다.' : jiOh === saju.gisin ? '내면에서 기신이 쌓여 감정·건강에 주의하세요.' : ''}`);

  // 대운 용신/기신 + 세운 용신/기신
  const dHasYong = dGanOh === saju.yongsin || dJiOh === saju.yongsin;
  const dHasGi = dGanOh === saju.gisin || dJiOh === saju.gisin;
  const sHasYong = ganOh === saju.yongsin || jiOh === saju.yongsin;
  const sHasGi = ganOh === saju.gisin || jiOh === saju.gisin;

  if (dHasYong && sHasYong) {
    parts.push(`🔥 대운·세운 모두 용신(${saju.yongsin}) 기운! 10년에 한두 번 올까 말까 한 최고의 조합입니다. 이직·창업·투자·고백 등 큰 결정을 내리기에 최적의 타이밍입니다. 이 기회를 반드시 잡으세요!`);
  } else if (dHasYong && sHasGi) {
    parts.push(`대운은 용신(${saju.yongsin})으로 좋지만 세운이 기신(${saju.gisin})으로 역풍. 큰 틀은 좋으나 올해는 보수적으로 행동하세요. 내년을 위한 준비 기간으로 활용하는 것이 현명합니다.`);
  } else if (dHasGi && sHasYong) {
    parts.push(`💡 대운이 기신(${saju.gisin})으로 어려운 시기이지만, 세운 용신(${saju.yongsin})이 한줄기 빛입니다. 올해 안에 가능한 것은 최대한 실행하세요 — 대운의 역풍 속에서도 세운이 도와주는 소중한 해입니다.`);
  } else if (dHasGi && sHasGi) {
    parts.push(`⚠️ 대운·세운 모두 기신(${saju.gisin}) 기운. 가장 조심해야 할 해입니다. 무리한 도전은 절대 피하고, 건강검진·보험 점검·비상금 확보를 최우선으로 하세요. 이 시기만 지나면 반드시 좋아집니다.`);
  } else if (dHasYong) {
    parts.push(`대운 용신(${saju.yongsin}) 기운이 큰 틀에서 돕고 있어, 올해 세운의 부족함을 어느 정도 보완해줍니다. 10년 대운의 좋은 흐름을 믿고 꾸준히 가세요.`);
  } else if (dHasGi) {
    parts.push(`대운 기신(${saju.gisin}) 기운이 배경에 깔려 있어, 전반적으로 인내가 필요한 시기입니다. 큰 변화보다는 현재를 지키는 데 집중하세요.`);
  }

  // 대운-세운 12운성 시너지
  const dEnergy = TWELVE_STAGE_DATA[dStage].energy;
  const sEnergy = TWELVE_STAGE_DATA[stage].energy;
  if (dEnergy >= 7 && sEnergy >= 7) {
    parts.push(`대운(${dStage} ${dEnergy}/10)과 세운(${stage} ${sEnergy}/10) 모두 고에너지! 체력이 넘치는 시기이지만 과욕에 주의하세요.`);
  } else if (dEnergy <= 4 && sEnergy <= 4) {
    parts.push(`대운(${dStage} ${dEnergy}/10)과 세운(${stage} ${sEnergy}/10) 모두 저에너지. 체력 관리가 중요하며, 무리하면 탈이 납니다.`);
  } else if (Math.abs(dEnergy - sEnergy) >= 5) {
    parts.push(`대운(${dStage} ${dEnergy}/10)과 세운(${stage} ${sEnergy}/10)의 에너지 격차가 큽니다. 기복이 심한 한 해가 될 수 있습니다.`);
  }

  // 대운 지지-세운 지지 충
  const JIJI_CHUNG_MAP: Record<string, string> = {
    '자': '오', '오': '자', '축': '미', '미': '축', '인': '신', '신': '인',
    '묘': '유', '유': '묘', '진': '술', '술': '진', '사': '해', '해': '사',
  };
  if (JIJI_CHUNG_MAP[dJi] === seunJi) {
    parts.push(`⚡ 대운(${dJi})↔세운(${seunJi}) 지지충! 대운의 흐름이 올해 크게 흔들립니다. 이사·이직·관계 변동 등 큰 변화가 예상됩니다.`);
  }
  // 대운 지지-세운 지지 합
  const YUKHAP_MAP: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인', '묘': '술', '술': '묘',
    '진': '유', '유': '진', '사': '신', '신': '사', '오': '미', '미': '오',
  };
  if (YUKHAP_MAP[dJi] === seunJi) {
    parts.push(`💞 대운(${dJi})↔세운(${seunJi}) 육합! 큰 흐름과 올해가 조화를 이루어 안정감이 있습니다.`);
  }

  text += parts.length > 0 ? parts.join('\n') : '대운과 세운 사이에 특별한 충돌이나 시너지 없이 무난한 흐름입니다.';
  return text;
}

/** 원국 4주별 영향 분석 — 세운이 년주/월주/일주/시주 각각에 미치는 영향 */
function getFourPillarImpact(saju: SajuResult, seunGan: string, seunJi: string, ganOh: Ohaeng, jiOh: Ohaeng): string {
  const rel = saju.relationship || 'single';
  const isMarried = rel === 'married';
  const isDating = rel === 'dating';
  const isSingle = rel === 'single';

  // 일주 영역/텍스트를 관계 상태에 따라 분기
  const dayArea = isMarried ? '나 자신·배우자·가정' : isDating ? '나 자신·연인·내면' : '나 자신·내면·건강';
  const dayChung = isMarried
    ? '개인적 변화가 크거나 배우자와의 갈등이 있을 수 있습니다. 부부 대화 시간을 확보하고, 감정적 대응은 삼가세요. 건강에도 주의가 필요합니다.'
    : isDating
    ? '개인적 변화가 크거나 연인과의 마찰이 생길 수 있습니다. 서로의 입장을 이해하려 노력하세요. 건강 관리에도 신경 쓰세요.'
    : '개인적으로 큰 변화가 오거나 심리적 혼란을 겪을 수 있습니다. 자기 자신을 돌보는 시간이 필요합니다. 건강검진도 챙기세요.';
  const dayHap = isMarried
    ? '가정에 기쁜 일이 생기거나 배우자와의 관계가 깊어집니다. 가족 여행·이벤트를 계획하면 좋습니다.'
    : isDating
    ? '연인과의 관계가 한 단계 발전합니다. 함께하는 시간이 즐겁고 뜻깊어지는 시기입니다.'
    : '자기 자신에 대한 이해가 깊어지고, 내면의 안정감이 커집니다. 새로운 인연이 자연스럽게 찾아올 수 있는 기반이 됩니다.';
  const dayGanhap = isMarried
    ? '부부 관계에 새로운 활력이 생깁니다. 함께 새로운 취미나 활동을 시작해보세요.'
    : isDating
    ? '연인과의 관계에 새로운 전환점이 올 수 있습니다. 진지한 대화를 나눠보세요.'
    : '새로운 인연이나 나를 변화시킬 만남이 찾아올 수 있습니다. 열린 마음으로 사람들을 만나보세요.';

  // 시주도 나이/관계/자녀유무에 따라 조정
  const age = saju.age || 20;
  const hc = saju.hasChildren;
  const hourArea = hc ? '자녀·가정·결과물' : (age >= 40 ? '미래·노후·결과물' : '미래·계획·후배·결과물');
  const hourChung = hc
    ? '자녀 교육·진로와 관련된 고민이 생기거나, 가정 내 예상치 못한 변동이 있을 수 있습니다. 자녀와 충분히 소통하세요.'
    : (age >= 40
      ? '진행 중인 프로젝트의 결과물이 예상과 달라지거나, 미래 계획에 변동이 생길 수 있습니다. 장기적 관점에서 인내하세요.'
      : '미래 계획이 흔들리거나 예상치 못한 방향으로 바뀔 수 있습니다. 유연하게 대처하되 장기 목표는 놓지 마세요.');
  const hourHap = hc
    ? '자녀에게 좋은 소식이 있거나, 가정에 기쁜 일이 생깁니다. 자녀의 재능을 응원하고 함께 시간을 보내세요.'
    : (age >= 40
      ? '노력한 일의 결과가 좋게 맺어지거나, 후배를 통해 기쁜 소식이 있을 수 있습니다. 마무리를 잘하면 더 큰 열매를 맺습니다.'
      : '진행 중인 일의 마무리가 좋거나, 미래를 위한 좋은 기반이 만들어집니다. 장기 계획을 구체화하기 좋은 시기입니다.');
  const hourGanhap = hc
    ? '자녀를 통해 예상치 못한 기쁜 소식이 오거나, 가정에서 새로운 즐거움을 발견합니다.'
    : (age >= 40
      ? '예상치 못한 곳에서 성과가 나타나거나, 후배·프로젝트를 통해 기쁜 소식이 옵니다.'
      : '예상치 못한 곳에서 성과가 나타나거나, 미래를 위한 새로운 기회가 생깁니다. 새로운 가능성에 열린 마음을 가지세요.');

  const PILLAR_MEANING = {
    year: { name: '년주', area: '조상·사회관계·외부환경', advice_chung: '사회적 관계에서 갈등이 생기거나 소속 집단(회사·동호회·가족 모임)에 변화가 올 수 있습니다. 대인관계를 재정비하는 계기로 삼으세요.', advice_hap: '사회적 인맥이 넓어지고 외부에서 좋은 기회가 찾아옵니다. 모임·행사에 적극 참여하세요.', advice_ganhap: '뜻밖의 귀인이 나타나거나, 새로운 사회적 연결이 생깁니다. 첫인상을 좋게 만드는 데 신경 쓰세요.' },
    month: { name: '월주', area: '부모·직장·사회생활', advice_chung: '직장 환경이 바뀌거나 부서 이동·이직의 가능성이 있습니다. 변화에 유연하게 대처하되, 충동적 결정은 피하세요.', advice_hap: '직장에서 좋은 평가를 받거나 부모님과의 관계가 돈독해집니다. 상사·선배에게 성의를 보이면 좋은 결과가 따릅니다.', advice_ganhap: '직장에서 새로운 프로젝트나 역할이 주어질 수 있습니다. 적극적으로 받아들이세요.' },
    day: { name: '일주', area: dayArea, advice_chung: dayChung, advice_hap: dayHap, advice_ganhap: dayGanhap },
    hour: { name: '시주', area: hourArea, advice_chung: hourChung, advice_hap: hourHap, advice_ganhap: hourGanhap },
  };

  const JIJI_CHUNG: Record<string, string> = {
    '자': '오', '오': '자', '축': '미', '미': '축', '인': '신', '신': '인',
    '묘': '유', '유': '묘', '진': '술', '술': '진', '사': '해', '해': '사',
  };
  const YUKHAP: Record<string, string> = {
    '자': '축', '축': '자', '인': '해', '해': '인', '묘': '술', '술': '묘',
    '진': '유', '유': '진', '사': '신', '신': '사', '오': '미', '미': '오',
  };
  const CHEONGAN_HAP: Record<string, string> = {
    '갑': '기', '기': '갑', '을': '경', '경': '을', '병': '신', '신': '병',
    '정': '임', '임': '정', '무': '계', '계': '무',
  };

  // 삼합 테이블
  const SAMHAP_GROUPS = [
    { members: ['인', '오', '술'], result: '화', name: '인오술 삼합(화국)' },
    { members: ['사', '유', '축'], result: '금', name: '사유축 삼합(금국)' },
    { members: ['신', '자', '진'], result: '수', name: '신자진 삼합(수국)' },
    { members: ['해', '묘', '미'], result: '목', name: '해묘미 삼합(목국)' },
  ];

  // 방합 테이블
  const BANGHAP_GROUPS = [
    { members: ['인', '묘', '진'], result: '목', name: '인묘진 방합(동방 목)' },
    { members: ['사', '오', '미'], result: '화', name: '사오미 방합(남방 화)' },
    { members: ['신', '유', '술'], result: '금', name: '신유술 방합(서방 금)' },
    { members: ['해', '자', '축'], result: '수', name: '해자축 방합(북방 수)' },
  ];

  let text = '【원국 4주별 영향】\n';
  const pillars = [
    { key: 'year' as const, p: saju.year },
    { key: 'month' as const, p: saju.month },
    { key: 'day' as const, p: saju.day },
    { key: 'hour' as const, p: saju.hour },
  ];

  // 원국 지지 모음 (삼합/방합 체크용)
  const wonJijis = pillars.map(pp => pp.p.jiji);

  for (const { key, p } of pillars) {
    const info = PILLAR_MEANING[key];
    const pJi = p.jiji;
    const pGan = p.cheongan;
    const notes: string[] = [];

    // 지지충
    if (JIJI_CHUNG[seunJi] === pJi) {
      notes.push(`⚡ 충(${seunJi}↔${pJi}): ${info.advice_chung}`);
    }
    // 육합
    if (YUKHAP[seunJi] === pJi) {
      notes.push(`💞 합(${seunJi}+${pJi}): ${info.advice_hap}`);
    }
    // 천간합
    if (CHEONGAN_HAP[seunGan] === pGan) {
      notes.push(`🤝 천간합(${seunGan}+${pGan}): ${info.advice_ganhap}`);
    }
    // 오행 시너지/충돌
    const pJiOh = JIJI_OHAENG[pJi];
    const pGanOh = CHEONGAN_OHAENG[pGan];
    if (jiOh === saju.yongsin && pJiOh === saju.yongsin) {
      notes.push(`💎 용신(${saju.yongsin}) 시너지 — ${info.area}에 강한 도움이 작용합니다.`);
    }
    if (jiOh === saju.gisin && pJiOh === saju.gisin) {
      notes.push(`🚨 기신(${saju.gisin}) 겹침 — ${info.area}에서 어려움이 가중될 수 있으니 각별히 주의하세요.`);
    }
    // 천간 상극 체크
    if (OHAENG_SANGGEUK[ganOh] === pGanOh) {
      notes.push(`⚔️ 천간 상극(${seunGan}${ganOh}→${pGan}${pGanOh}) — ${info.area}에서 외부 압박·제약이 있을 수 있습니다.`);
    }

    if (notes.length > 0) {
      text += `\n📌 ${info.name}(${pGan}${pJi}):\n`;
      text += notes.map(n => `  ${n}`).join('\n') + '\n';
    } else {
      text += `\n✅ ${info.name}(${pGan}${pJi}): ${info.area} — 세운과 특별한 충돌 없이 무난합니다.\n`;
    }
  }

  // 삼합 체크: 세운 지지 + 원국 지지 2개 이상이 삼합 구성
  for (const sg of SAMHAP_GROUPS) {
    const allJijis = [...wonJijis, seunJi];
    const matchCount = sg.members.filter(m => allJijis.includes(m)).length;
    const seunInGroup = sg.members.includes(seunJi);
    if (seunInGroup && matchCount >= 3) {
      const isYong = sg.result as Ohaeng === saju.yongsin;
      const isGi = sg.result as Ohaeng === saju.gisin;
      text += `\n🔺 ${sg.name} 완성! 세운이 삼합을 완성시켜 ${OHAENG_NAME[sg.result as Ohaeng]} 기운이 크게 강화됩니다.`;
      if (isYong) text += ` 용신 삼합으로 매우 유리한 흐름입니다!`;
      else if (isGi) text += ` 기신 삼합이므로 이 기운의 과잉에 주의하세요.`;
      text += '\n';
    } else if (seunInGroup && matchCount === 2) {
      text += `\n🔸 ${sg.name} 반합(2/3): 삼합이 부분적으로 형성되어 ${OHAENG_NAME[sg.result as Ohaeng]} 기운이 서서히 강화되고 있습니다.\n`;
    }
  }

  // 방합 체크
  for (const bg of BANGHAP_GROUPS) {
    const allJijis = [...wonJijis, seunJi];
    const matchCount = bg.members.filter(m => allJijis.includes(m)).length;
    const seunInGroup = bg.members.includes(seunJi);
    if (seunInGroup && matchCount >= 3) {
      const isYong = bg.result as Ohaeng === saju.yongsin;
      const isGi = bg.result as Ohaeng === saju.gisin;
      text += `\n🔷 ${bg.name} 완성! 한 방향의 기운이 극도로 강해집니다.`;
      if (isYong) text += ` 용신 방합으로 강력한 지원을 받습니다!`;
      else if (isGi) text += ` 기신 방합이므로 과잉에 특히 주의하세요.`;
      text += '\n';
    }
  }

  return text;
}

/** 나이별 맞춤 조언 — 학생/청년/중년/장년에 따라 다른 구체적 조언 */
function getAgeSpecificAdvice(age: number, sipseong: string, score: number, gender: 'male' | 'female', relationship: 'single' | 'dating' | 'married' = 'single'): string {
  let text = '【나이별 맞춤 조언】\n';
  const isSingle = relationship === 'single';
  const isDating = relationship === 'dating';
  const isMarried = relationship === 'married';

  if (age <= 19) {
    text += `📚 ${age}세 학생 시기:\n`;
    if (sipseong === '정인' || sipseong === '편인') {
      text += '학업운이 강한 십성입니다! 집중력을 살려 성적 향상에 도전하세요. 새로운 과목이나 관심사를 탐구하기 좋은 해입니다.\n';
    } else if (sipseong === '식신' || sipseong === '상관') {
      text += '창의력과 표현력이 빛나는 해입니다. 예체능·글쓰기·발표 등에서 두각을 나타낼 수 있습니다.\n';
    } else if (sipseong === '편관' || sipseong === '정관') {
      text += '시험·경쟁에서 긴장감이 높은 해입니다. 꾸준한 노력이 필요하며, 스트레스 관리가 핵심입니다.\n';
    } else if (sipseong === '비견' || sipseong === '겁재') {
      text += '친구·동료와의 관계가 중요한 해입니다. 좋은 친구를 사귀고, 나쁜 유혹은 단호히 거절하세요.\n';
    } else {
      text += score >= 6 ? '전반적으로 순탄한 학업 흐름입니다. 목표를 세우고 꾸준히 실천하세요.\n'
        : '조금 힘든 시기일 수 있지만, 기초를 다지는 데 집중하면 나중에 큰 성과로 이어집니다.\n';
    }
    text += gender === 'male'
      ? '🏃 건강: 체력 관리를 위해 규칙적인 운동을 권합니다. 게임·스마트폰 과다 사용으로 눈·목·허리 건강에 주의하세요.\n'
      : '🏃 건강: 감정 기복에 주의하고, 충분한 수면과 균형 잡힌 식사가 중요합니다. 다이어트보다 건강한 체력 만들기에 집중하세요.\n';
    text += score >= 6
      ? '📝 학업: 성적 향상에 유리한 해입니다. 목표를 높게 잡아도 좋습니다. 선생님·멘토의 조언을 적극 구하세요.\n'
      : '📝 학업: 성적이 정체되거나 약간 떨어질 수 있습니다. 기본기를 탄탄히 하고, 약한 과목에 집중 투자하세요.\n';
    text += sipseong === '비견' || sipseong === '겁재'
      ? '👥 교우: 친구 관계에 변화가 올 수 있습니다. 진정한 친구를 가려내는 눈을 키우세요. 스터디 그룹이 큰 도움됩니다.'
      : '👥 교우: 대인관계는 무난합니다. 다양한 친구를 사귀되, 학업과의 균형을 잃지 마세요.';

  } else if (age <= 30) {
    text += `🌱 ${age}세 청년 시기:\n`;
    if (sipseong === '편재' || sipseong === '정재') {
      text += '재물·사업 기회가 눈에 들어오는 시기입니다. 첫 투자·적금·재테크를 시작하기 좋습니다.\n';
    } else if (sipseong === '정관' || sipseong === '편관') {
      text += '직장·사회에서의 위치가 중요한 해입니다. 상사의 인정을 받기 위해 성실함을 보여주세요.\n';
    } else if (sipseong === '식신' || sipseong === '상관') {
      text += '자기 표현과 재능 발휘의 시기입니다. SNS·블로그 등 개인 브랜딩을 시작해보세요.\n';
    } else if (sipseong === '정인' || sipseong === '편인') {
      text += '자기계발·자격증·대학원 등 추가 학습에 투자하기 좋은 해입니다.\n';
    } else {
      text += score >= 6 ? '인간관계를 넓히고 다양한 경험을 쌓기 좋은 시기입니다.\n'
        : '조급해하지 마세요. 기초 체력과 실력을 쌓는 시간이 필요합니다.\n';
    }
    text += gender === 'male'
      ? '🏃 건강: 불규칙한 생활패턴(야근·음주·운동 부족)에 주의하세요. 주 3회 운동 습관을 만들면 운세도 따라 올라갑니다.\n'
      : '🏃 건강: 스트레스성 두통·소화불량·피부 트러블에 주의하세요. 규칙적 수면과 가벼운 요가·필라테스가 도움됩니다.\n';
    text += score >= 6
      ? '💰 재물: 재물운이 열리는 시기입니다. 소액이라도 투자·저축을 시작하세요. 월급의 20% 자동이체가 기본입니다.\n'
      : '💰 재물: 큰 돈을 벌기보다는 지출을 줄이는 데 집중하세요. 불필요한 구독 해지, 외식 줄이기가 효과적입니다.\n';
    // 연애/관계 — relationship 상태에 따라 분기
    if (isMarried) {
      text += '👨‍👩‍👧‍👦 가정: ' + (score >= 6
        ? '부부 관계가 안정적인 해입니다. 함께 새로운 취미나 여행을 계획하면 관계가 더욱 깊어집니다.'
        : '부부 사이 소통이 중요한 해입니다. 바쁘더라도 대화 시간을 확보하고, 서로에게 감사를 표현하세요.');
    } else if (isDating) {
      text += '💕 연애: ' + (score >= 6
        ? '연인과의 관계가 한 단계 발전할 수 있습니다. 진지한 미래 계획을 함께 이야기해보세요.'
        : '연인과 사소한 마찰이 생길 수 있습니다. 상대의 입장에서 생각하고, 감정적 반응을 줄이세요.');
    } else {
      // 솔로
      if (sipseong === '편재' || sipseong === '정재') {
        text += gender === 'male'
          ? '💕 인연: 적극적인 만남이 유리합니다. 소개팅·앱보다 취미 모임이나 직장 관련 자리에서 인연을 찾아보세요.'
          : '💕 인연: 안정적이고 성실한 사람과의 인연이 있을 수 있습니다. 조건보다 가치관이 맞는 사람을 찾으세요.';
      } else if (sipseong === '편관' || sipseong === '정관') {
        text += gender === 'male'
          ? '💕 인연: 직장이나 공적 모임에서 인연을 만날 수 있습니다. 성실한 이미지가 매력 포인트입니다.'
          : '💕 인연: 카리스마 있는 상대에게 끌릴 수 있습니다. 첫인상에 현혹되지 말고 상대의 본질을 살피세요.';
      } else {
        text += score >= 6
          ? '💕 인연: 인연운이 따르는 해입니다. 새로운 모임이나 활동에 적극 참여하면 좋은 만남이 올 수 있습니다.'
          : '💕 인연: 인연을 억지로 찾기보다 자기 자신을 먼저 가꾸세요. 매력이 올라가면 자연스럽게 인연이 따릅니다.';
      }
    }

  } else if (age <= 50) {
    text += `💼 ${age}세 중년 시기:\n`;
    if (sipseong === '편재' || sipseong === '정재') {
      text += '재산 관리와 투자 전략이 중요한 해입니다. 장기 자산 포트폴리오를 점검하세요.\n';
    } else if (sipseong === '정관') {
      text += '직장에서 승진·인사고과에 유리한 해입니다. 리더십을 발휘할 기회를 놓치지 마세요.\n';
    } else if (sipseong === '편관') {
      text += '직장 스트레스와 건강에 각별히 주의하세요. 정기검진을 받고, 워라밸을 지키세요.\n';
    } else if (sipseong === '비견' || sipseong === '겁재') {
      text += '동업·확장보다는 현재 사업을 안정적으로 유지하는 것이 현명합니다.\n';
    } else {
      text += score >= 6 ? (isMarried ? '가정과 직장 모두에서 안정적인 흐름입니다.\n' : '직장과 개인 생활 모두에서 안정적인 흐름입니다.\n')
        : '체력이 예전 같지 않습니다. 건강검진을 최우선으로 하세요.\n';
    }
    text += gender === 'male'
      ? '🏃 건강: 만성질환(고혈압·당뇨·고지혈증) 검진을 빠짐없이 받으세요. 음주·흡연을 줄이고 주 3회 유산소 운동이 필수입니다.\n'
      : '🏃 건강: 호르몬 변화에 따른 체중 관리·골밀도 검사를 신경 쓰세요. 스트레스 관리와 충분한 수면이 중요합니다.\n';
    text += score >= 6
      ? '💰 재물: 투자 수익이 기대되는 해입니다. 부동산·연금·보험 등 장기 자산을 점검하고 리밸런싱하세요.\n'
      : '💰 재물: 보수적 재테크가 안전합니다. 보증·동업 제안은 거절하고, 비상금을 확보해두세요.\n';
    // 관계 상태에 따라 분기
    if (isMarried) {
      text += '👨‍👩‍👧‍👦 가정: 가족과의 소통 시간을 늘리세요. ' + (sipseong === '편관' || sipseong === '상관'
        ? '스트레스를 가족에게 풀지 않도록 주의하세요. 주말 가족 활동이 관계 회복에 도움됩니다.'
        : '가족 여행이나 함께하는 취미 활동이 유대감을 강화합니다.');
    } else if (isDating) {
      text += '💕 연애: ' + (score >= 6
        ? '연인과의 관계가 결혼으로 이어질 수 있는 좋은 시기입니다. 진지한 대화를 나눠보세요.'
        : '연인과의 관계에서 현실적 문제(경제, 가치관)가 부각될 수 있습니다. 솔직한 대화가 필요합니다.');
    } else {
      text += '💕 인연: ' + (score >= 6
        ? '새로운 인연이 찾아올 수 있습니다. 사회적 모임이나 취미 활동에서 만남의 기회를 넓히세요.'
        : '인연에 조급해하기보다 자기 삶의 안정과 성장에 집중하세요. 준비된 사람에게 좋은 인연이 옵니다.');
    }

  } else {
    text += `🏡 ${age}세 장년 시기:\n`;
    if (sipseong === '정인' || sipseong === '편인') {
      text += '정신적 성장과 내면의 평화를 추구하기 좋은 해입니다. 종교·철학·명상이 큰 위안이 됩니다.\n';
    } else if (sipseong === '식신') {
      text += '건강과 식복이 따르는 해입니다. 좋은 음식을 즐기고, 취미생활로 삶의 활력을 유지하세요.\n';
    } else if (sipseong === '편관' || sipseong === '정관') {
      text += '건강검진을 꼭 받으세요. 특히 혈압·심장·관절에 신경 쓰시고, 과로를 피하세요.\n';
    } else {
      text += score >= 6 ? '주변 사람들과의 관계가 좋은 해입니다. 멘토 역할을 해보세요.\n'
        : '무리하지 마시고 건강을 최우선으로 하세요.\n';
    }
    text += '🏃 건강: 정기검진(혈압·혈당·암검진)을 빠짐없이 받으세요. 가벼운 산책·스트레칭을 매일 30분 이상 하는 것이 장수의 비결입니다.\n';
    text += score >= 6
      ? '💰 재물: 안정적인 수입 흐름이 유지됩니다. 노후 자금 관리에 신경 쓰되, 무리한 투자는 피하세요.\n'
      : '💰 재물: 큰 지출이나 투자를 자제하고, 기존 자산을 안전하게 지키는 데 집중하세요.\n';
    // 관계에 따라 분기
    if (isMarried) {
      text += '👨‍👩‍👧‍👦 가족: ' + (sipseong === '식신' || sipseong === '정재'
        ? '자녀·손주와 함께하는 시간이 큰 기쁨을 줍니다. 가족 행사를 주도적으로 만들어보세요.'
        : '배우자·가족의 지지와 소통이 건강과 행복의 원천입니다. 가족에게 먼저 연락하고 관심을 표현하세요.');
    } else if (isDating) {
      text += '💕 연애: 현재의 인연을 소중히 여기세요. 함께하는 시간이 삶의 큰 활력이 됩니다.';
    } else {
      text += '🤝 인간관계: ' + (score >= 6
        ? '친구·동료·지인과의 교류가 삶에 활력을 줍니다. 동호회나 봉사 활동에 참여해보세요.'
        : '외로움을 느낄 수 있는 시기입니다. 가까운 사람들과 자주 연락하고, 사회적 활동을 유지하세요.');
    }
  }

  return text;
}

/** 십성별 올해 테마 텍스트 */
function getSipseongTheme(sipseong: string, saju: SajuResult, score: number): string {
  const ilBal = saju.ohaengBalance?.[CHEONGAN_OHAENG[saju.ilgan]] || 3;
  const isSingang = saju.strengthScore != null ? saju.strengthScore >= 40 : ilBal >= 4.5;

  const themes: Record<string, string> = {
    '비견': isSingang
      ? '【올해 테마: 경쟁】 나와 비슷한 에너지가 겹치는 해로, 경쟁이 치열해질 수 있습니다. 차별화와 독자적 영역 확보가 핵심입니다.'
      : '【올해 테마: 협력】 나와 같은 기운이 도와주는 해입니다. 동료·친구의 지원이 힘이 되며, 함께하면 시너지가 납니다.',
    '겁재': isSingang
      ? '【올해 테마: 손재수 주의】 겁재의 기운이 재물을 흩뜨릴 수 있습니다. 보증·동업·큰 지출에 특히 조심하고 지키는 전략이 필요합니다.'
      : '【올해 테마: 추진력】 과감한 추진력이 생기는 해입니다. 망설이던 일을 밀어붙일 수 있지만, 지나친 욕심은 경계하세요.',
    '식신': '【올해 테마: 재능 발현】 식신의 기운이 당신의 재능과 표현력을 꽃피우는 해입니다. 창작·요리·기술 등 만드는 일에 좋은 성과가 기대됩니다. 건강과 식복도 따릅니다.',
    '상관': score >= 5
      ? '【올해 테마: 변화·도전】 상관의 기운이 기존 틀을 깨고 새로운 시도를 하게 합니다. 프리랜서·이직·창업 등 변화에 유리하지만, 윗사람과의 충돌은 피하세요.'
      : '【올해 테마: 불안정】 상관의 기운이 변동성을 높입니다. 직장·대인관계에서 마찰이 생기기 쉬우니 말조심하고 참을성을 기르세요.',
    '편재': '【올해 테마: 투자·사업】 편재의 기운이 사업·투자·유통 분야에서 기회를 가져옵니다. 돈의 흐름이 빨라지는 해로, 수입도 크지만 지출도 클 수 있습니다. 분산 투자로 리스크를 관리하세요.',
    '정재': '【올해 테마: 안정 수입】 정재의 기운이 꾸준하고 안정적인 수입을 가져옵니다. 급여·임대수입·적금 등 고정 수입 분야에서 좋은 성과가 기대됩니다. 근검절약이 부를 키웁니다.',
    '편관': isSingang
      ? '【올해 테마: 승부·도전】 편관이 적절한 압박과 긴장감을 주어 역량을 끌어올립니다. 시험·경쟁·승부처에서 힘을 발휘할 수 있습니다.'
      : '【올해 테마: 압박·시련】 편관의 기운이 외부 압박과 스트레스를 가져옵니다. 직장 상사·시험·건강 등에서 부담이 커질 수 있으니 무리하지 마세요.',
    '정관': '【올해 테마: 안정·명예】 정관의 기운이 사회적 인정과 안정을 가져옵니다. 승진·자격증·공직·명예 관련 좋은 소식이 기대됩니다. 규칙과 원칙을 지키면 좋은 결과가 따릅니다.',
    '편인': score >= 5
      ? '【올해 테마: 학문·영감】 편인의 기운이 독특한 아이디어와 영감을 줍니다. 자격증·연구·예술·종교·철학 분야에서 깊은 깨달음을 얻을 수 있습니다.'
      : '【올해 테마: 고독·내면 탐구】 편인의 기운이 내면으로 향합니다. 혼자만의 시간이 많아지고 생각이 깊어지지만, 외부 활동과 대인관계가 줄어들 수 있으니 균형을 맞추세요.',
    '정인': '【올해 테마: 공부·성장】 정인의 기운이 학업·자기계발·정신적 성장을 돕습니다. 새로운 것을 배우기에 최적의 해이며, 어머니·스승 등 은인의 도움도 기대됩니다.',
  };

  return themes[sipseong] || '【올해 테마】 차분하게 자기 페이스를 유지하며 한 해를 보내세요.';
}

/** 계절별 조언 생성 헬퍼 — 십성/12운성/점수/용신기신 모두 반영하여 연도별 차별화 */
function getSeasonAdvice(ilOhaeng: Ohaeng, ganOh: Ohaeng, jiOh: Ohaeng, seasonOhaeng: Ohaeng, score: number, stage: TwelveStage, yongsin: Ohaeng, gisin: Ohaeng, sipseong: string, year: number): string {

  // 십성별 계절 구체 조언 매트릭스 — 이것이 연도별 차별화의 핵심
  const SIP_SEASON: Record<string, Record<string, string>> = {
    '비견': { '봄': '동료나 라이벌과의 경쟁이 활발해집니다. 팀워크를 발휘하되 자기 몫은 챙기세요.',
              '여름': '에너지가 넘쳐 과도한 소비나 충동적 행동이 나올 수 있습니다. 절제가 필요합니다.',
              '가을': '경쟁에서 빛나는 시기입니다. 실력으로 승부하면 좋은 결과가 따릅니다.',
              '겨울': '혼자보다 함께하는 것이 유리합니다. 네트워크를 활용하세요.' },
    '겁재': { '봄': '재물 유출에 주의하세요. 보증이나 동업 제안은 신중히 검토하세요.',
              '여름': '충동적 결정이 손실로 이어질 수 있습니다. 큰 지출은 자제하세요.',
              '가을': '흩어진 에너지를 모아 한 곳에 집중하면 성과가 납니다.',
              '겨울': '조용히 내실을 다지세요. 무리한 확장보다 현재 자원 관리가 중요합니다.' },
    '식신': { '봄': '창의력이 꽃피는 시기입니다. 새로운 아이디어를 적극적으로 시도해보세요.',
              '여름': '맛집 탐방, 여행, 문화생활 등 즐거운 경험이 풍성합니다. 식복도 따릅니다.',
              '가을': '재능을 발휘해 수익으로 연결하기 좋은 시기입니다. 자격증·기술 습득에 투자하세요.',
              '겨울': '차분히 작품을 완성하거나 장기 프로젝트를 마무리하기 좋은 때입니다.' },
    '상관': { '봄': '자유로운 발상이 빛나지만, 윗사람과의 마찰에 조심하세요. 말 한마디가 큰 파장을 일으킵니다.',
              '여름': '변화의 욕구가 강해집니다. 이직·창업을 고려한다면 철저한 준비가 필요합니다.',
              '가을': '독창적인 아이디어로 주목받을 수 있습니다. 프리랜서·예술 활동에 유리합니다.',
              '겨울': '감정 기복에 주의하세요. 스트레스를 건전한 방법으로 해소하는 것이 중요합니다.' },
    '편재': { '봄': '사업·투자 기회가 눈에 들어옵니다. 분산 투자로 리스크를 관리하세요.',
              '여름': '돈의 흐름이 빨라집니다. 수입도 크지만 지출도 커질 수 있으니 관리가 핵심입니다.',
              '가을': '투자 성과가 나타나기 시작하는 시기입니다. 수확의 기쁨을 누리되 과욕은 금물입니다.',
              '겨울': '한 해의 재물 흐름을 정리하고 내년을 위한 자산 재배치를 계획하세요.' },
    '정재': { '봄': '꾸준히 쌓아온 노력이 안정적 수입으로 이어집니다. 적금·보험 가입에 좋은 시기입니다.',
              '여름': '고정 수입은 안정적이나 예상 외 지출에 주의하세요. 가계부 점검이 필요합니다.',
              '가을': '절약과 저축의 성과가 드러나는 시기입니다. 부동산·장기 투자를 검토해보세요.',
              '겨울': '연말 정산·세금 관련 챙길 것이 많습니다. 세무 관련 서류를 미리 준비하세요.' },
    '편관': { '봄': '외부 압박과 스트레스가 강해집니다. 체력 관리를 최우선으로 하세요.',
              '여름': '시험·경쟁·프레젠테이션 등 승부처에서 긴장감이 높습니다. 철저히 준비하면 돌파할 수 있습니다.',
              '가을': '직장에서의 평가·감사에 대비하세요. 실력을 보여줄 기회가 올 수 있습니다.',
              '겨울': '한 해의 긴장을 풀고 재충전하세요. 무리하면 건강이 위험합니다.' },
    '정관': { '봄': '사회적 인정이나 승진의 기운이 있습니다. 규칙을 지키며 성실히 임하세요.',
              '여름': '안정적이고 체계적인 흐름이 이어집니다. 자격증·면허 취득에 좋은 시기입니다.',
              '가을': '명예나 직위가 높아질 수 있습니다. 리더십을 발휘할 기회를 놓치지 마세요.',
              '겨울': '한 해의 성과를 정리하고 다음 단계를 계획하세요. 멘토의 조언이 큰 도움이 됩니다.' },
    '편인': { '봄': '새로운 학문·기술에 대한 호기심이 커집니다. 독특한 분야에서 영감을 얻을 수 있습니다.',
              '여름': '혼자만의 시간이 필요한 시기입니다. 내면 탐구와 명상이 도움됩니다.',
              '가을': '깊이 있는 연구나 자격증 공부에 몰두하기 좋습니다. 집중력이 높아집니다.',
              '겨울': '고독감이 커질 수 있으니 가까운 사람들과의 연락을 유지하세요.' },
    '정인': { '봄': '배움의 시작에 좋은 시기입니다. 새 학기·새 강좌·독서 모임을 시작해보세요.',
              '여름': '어머니·스승 등 은인의 도움을 받기 쉽습니다. 감사를 표현하세요.',
              '가을': '학업 성과가 나타나는 시기입니다. 시험·발표에서 좋은 결과가 기대됩니다.',
              '겨울': '한 해 배운 것을 정리하고 내면화하세요. 정신적 성장이 깊어집니다.' },
  };

  const SEASON_NAME: Record<string, string> = { '목': '봄', '화': '여름', '금': '가을', '수': '겨울' };
  const sName = SEASON_NAME[seasonOhaeng] || '';
  const sipSeason = SIP_SEASON[sipseong]?.[sName] || '';

  // 용신/기신 기본 맥락 + 십성별 구체 조언 조합
  if (seasonOhaeng === yongsin) {
    const overlap = (seasonOhaeng === ganOh || seasonOhaeng === jiOh);
    const base = overlap
      ? `용신(${yongsin}) 기운이 올해의 흐름과 만나 가장 유리한 시기!`
      : `용신(${yongsin}) 기운이 돕는 시기.`;
    return `${base} ${sipSeason}`;
  }
  if (seasonOhaeng === gisin) {
    const overlap = (seasonOhaeng === ganOh || seasonOhaeng === jiOh);
    const base = overlap
      ? `기신(${gisin}) 기운이 올해 흐름과 겹쳐 가장 조심할 시기.`
      : `기신(${gisin}) 기운이 작용하는 시기.`;
    return `${base} ${sipSeason}`;
  }

  // 계절이 세운 천간/지지와 같으면
  if (seasonOhaeng === ganOh) {
    return `올해 천간(${ganOh})의 기운이 집중되는 시기. ${sipSeason}`;
  }
  if (seasonOhaeng === jiOh && seasonOhaeng !== ganOh) {
    return `올해 지지(${jiOh})의 기운이 강화되는 시기. ${sipSeason}`;
  }
  // 일간이 계절 오행을 생 → 에너지 소모
  if (OHAENG_SANGSAENG[ilOhaeng] === seasonOhaeng) {
    return `체력 소모가 커지는 시기. ${sipSeason}`;
  }
  // 계절이 일간을 극 → 억눌림
  if (OHAENG_SANGGEUK[seasonOhaeng] === ilOhaeng) {
    return `에너지가 억눌리는 시기. ${sipSeason}`;
  }
  // 계절이 일간을 생 → 도움
  if (OHAENG_SANGSAENG[seasonOhaeng] === ilOhaeng) {
    return `도움의 기운이 있는 시기. ${sipSeason}`;
  }
  // 그 외
  return `무난한 시기. ${sipSeason}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 세운 영역별 텍스트 생성 컨텍스트 + 십성별 차별화 데이터
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SeunTextContext {
  seunSipseong: string;
  cheongan: string;
  jiji: string;
  targetYear: number;
  specialNotes: string[];
  chungCount: number;
  hapCount: number;
  // 영역별 고득점 요인 추적 (7점 이상일 때 텍스트에 부각)
  highFactors: {
    study: string[];
    money: string[];
    love: string[];
    health: string[];
    career: string[];
  };
}

// 십성별 연애운 특화 텍스트 (매년 세운 십성이 달라지므로 연도별 차별화의 핵심)
const SIP_LOVE: Record<string, { good: string; mid: string; bad: string }> = {
  '비견': {
    good: '비견(比肩)의 해: "어깨를 나란히 하는 동등한 기운"입니다. 같은 눈높이에서 만나는 인연이 오니, 동갑·동기·같은 업종 종사자와의 만남이 유력합니다. 친구에서 연인으로 자연스럽게 발전하는 시기입니다.',
    mid: '비견의 해: 비슷한 성향이라 주도권 다툼이 생길 수 있습니다. 상대를 인정하고 한 발 양보하는 여유가 필요합니다. 각자의 역할을 존중하면 오히려 안정적인 관계가 만들어집니다.',
    bad: '비견의 해: 경쟁 에너지가 강해져 관계가 팽팽해질 수 있습니다. 누가 더 나은가를 따지지 말고, 함께 성장하는 동반자로 보세요. 너무 신경 쓰면 자신만의 시간도 필요하다는 핑계가 될 수 있습니다.',
  },
  '겁재': {
    good: '겁재(劫財)의 해: "빼앗는 기운"이지만 감정이 강렬합니다. 격렬한 사랑에 빠질 수 있으며, 상대에 대한 집착이 강해집니다. 격정적이지만 진심 있는 만남이 가능합니다.',
    mid: '겁재의 해: 질투와 소유욕이 관계를 흔들 수 있습니다. 친구와의 삼각관계나 감정 침범으로 복잡해질 수 있으니, 상대의 관계망을 존중하세요. 불신이 관계를 깨뜨릴 수 있습니다.',
    bad: '겁재의 해: 경제적 손실과 감정적 손실을 동시에 입을 수 있습니다. 상대에게 과하게 투자하거나 재물을 베풀다 후회합니다. 이별 후 복수심이 생기지 않도록 정리하는 시간을 충분히 갖세요.',
  },
  '식신': {
    good: '식신(食神)의 해: "먹고 즐기는 안일한 기운"입니다. 맛집, 예술 활동, 문화 모임에서 자연스럽게 인연을 만납니다. 상대와 함께 있는 것 자체가 즐거운 편안한 사랑이 피어납니다.',
    mid: '식신의 해: 편안함에만 빠져 관계의 발전을 외면하기 쉬운 시기입니다. 자신의 취미를 너무 우선하다 상대를 소홀히 할 수 있으니, 상대를 위한 시간을 따로 만드세요.',
    bad: '식신의 해: 관성적으로 관계를 유지하되 의욕이 없는 상태입니다. 안주와 게으름이 사랑을 식게 할 수 있습니다. 새로운 경험을 함께 만드는 노력이 필요합니다.',
  },
  '상관': {
    good: '상관(傷官)의 해: "표현을 통해 상대를 평가하는 기운"입니다. 말의 매력과 재치로 이성을 매료시킵니다. 감정을 솔직하게 표현할 수 있어 고백이 성공할 확률이 높습니다.',
    mid: '상관의 해: 말이 많아져 상대의 약점을 지적하기 쉬운 시기입니다. 솔직함이 상대를 상처 주는 말로 변할 수 있으니, 따뜻한 표현을 먼저 생각하세요. 이성 관계에서 남의 의견을 받아들이는 유연성이 중요합니다.',
    bad: '상관의 해: 비판적 태도가 강해져 상대의 단점만 보게 됩니다. 날카로운 말로 관계를 상하게 하기 쉬운 시기입니다. 일단 생각한 후 말하는 습관을 들이세요.',
  },
  '편재': {
    good: '편재(偏財)의 해: "변하는 외적 재물 에너지"로 만남의 기회가 많습니다. 소개팅, 모임, SNS 등 다양한 경로에서 인연을 만날 수 있습니다. 활동적으로 움직일수록 좋은 만남을 얻을 확률이 높습니다.',
    mid: '편재의 해: 여러 이성에게 동시에 마음이 이동하기 쉽습니다. 각 사람의 장점만 보는 경향이 있으니, 한 사람과의 관계를 깊이 있게 알아갈 시간이 필요합니다. 현실적 조건만 고려하면 감정적 교감을 놓칩니다.',
    bad: '편재의 해: 변덕스러운 마음이 관계를 흔들 수 있습니다. 이 사람 저 사람을 비교하다 누구와도 깊은 사랑을 하지 못합니다. 한 사람과의 관계에 몰두하려는 결단이 필요합니다.',
  },
  '정재': {
    good: '정재(正財)의 해: "안정적이고 고정적인 재물 기운"입니다. 신뢰할 수 있는 인연이 찾아오거나 기존 관계가 한 단계 깊어집니다. 결혼이나 공고한 약속으로 이어질 수 있는 안정적 시기입니다.',
    mid: '정재의 해: 현실적인 조건(집, 직업, 재산)을 고려하게 됩니다. 감정과 현실 사이에서 고민하지만, 함께 미래를 설계할 수 있는지를 보게 되는 시기입니다. 경제 계획을 함께 짜면 관계가 더 견고해집니다.',
    bad: '정재의 해: 금전 문제가 관계의 갈등이 될 수 있습니다. 결혼 자금, 생활비, 빌려준 돈 등으로 싸울 수 있으니 미리 솔직히 대화하세요. 경제 관념의 차이가 심하면 극복이 필요합니다.',
  },
  '편관': {
    good: '편관(偏官)의 해: "통제하고 제약하는 강한 기운"입니다. 카리스마 있고 강렬한 상대에게 끌립니다. 극적이고 운명 같은 만남이 이루어질 수 있으며, 관계가 매우 강렬합니다.',
    mid: '편관의 해: 상대의 강한 에너지에 눌리거나 조종당하는 느낌을 받을 수 있습니다. 자신을 지켜야 할 선을 명확히 하되, 상대의 리더십을 존중하는 균형이 필요합니다. 너무 자신감을 잃지 마세요.',
    bad: '편관의 해: 통제적이고 폭력적인 관계로 빠질 수 있는 위험한 시기입니다. 상대의 주도권에 무조건 따르거나 심한 언행을 견디고 있다면 즉시 벗어나야 합니다. 안전이 최우선입니다.',
  },
  '정관': {
    good: '정관(正官)의 해: "공식적이고 올바른 기운"입니다. 예의 있고 신실한 인연이 찾아옵니다. 공식적인 소개팅이나 사회적 자리에서의 만남이 유력하며, 결혼으로 발전할 가능성이 높습니다.',
    mid: '정관의 해: 관계에서 사회적 규범과 예절을 너무 중시하게 됩니다. 격식만 차리다 보면 상대가 답답해할 수 있으니, 함께 편하게 있을 수 있는 순간을 찾으세요. 때론 격식을 내려놓는 용기가 필요합니다.',
    bad: '정관의 해: 남의 시선과 체면을 의식해 진심을 감출 수 있습니다. 관계에서 솔직함이 부족하면 신뢰가 쌓이지 않습니다. 용감하게 본모습을 드러내세요.',
  },
  '편인': {
    good: '편인(偏印)의 해: "비주류적이고 독특한 기운"입니다. 학문이나 예술, 철학 모임에서 지적 교감이 있는 상대를 만날 수 있습니다. 깊이 있는 정신적 교류가 사랑으로 발전할 수 있는 시기입니다.',
    mid: '편인의 해: 혼자만의 생각 속에 빠져 상대를 외면하거나 마음을 닫을 수 있습니다. 타인과의 연결을 꺼리는 경향이 생기므로, 상대의 다가옴에 마음을 열려고 노력하세요. 이성적 분석보다 감정적 교감이 중요합니다.',
    bad: '편인의 해: 상대를 자꾸만 분석하고 평가하려는 습관이 관계를 식게 합니다. 두뇌 회전이 빠르다 보니 상대의 약점을 먼저 보게 되고, 그것이 거리감으로 이어집니다. 함께하는 시간을 즐기는 법을 배우세요.',
  },
  '정인': {
    good: '정인(正印)의 해: "자애로운 모성적 기운"입니다. 포근하고 따뜻한 사람이 다가옵니다. 어머니 같은 보호와 돌봄을 주는 상대, 또는 좋은 멘토가 연인이 될 수 있습니다.',
    mid: '정인의 해: 상대를 통해 자신을 성장시키려는 마음이 큽니다. 사랑하는 사람과 함께 배우고 성숙해지는 과정을 경험할 수 있습니다. 감정보다 영혼의 교감이 관계의 기초가 됩니다.',
    bad: '정인의 해: 상대방에게 과도하게 의존하거나 모든 것을 내맡기려는 경향이 생깁니다. 상대가 당신의 모든 것을 채워줄 수는 없습니다. 스스로 성장하는 독립적인 자아를 지키세요.',
  },
};

// 십성별 재물운 특화 텍스트
const SIP_MONEY: Record<string, { good: string; mid: string; bad: string }> = {
  '비견': {
    good: '비견(比肩)의 해: "같은 것을 모으는 기운"입니다. 동료와의 동업이나 협력 사업으로 큰 수익을 올릴 수 있습니다. 비슷한 성향의 사람과 함께하면 시너지가 강력합니다. 단, 수익 분배를 명확히 정해야 합니다.',
    mid: '비견의 해: 비슷한 사업을 하는 경쟁자가 많아져 수입이 분산됩니다. 남과 같은 방식으로는 경쟁에서 뒤떨어지므로, 나만의 차별성 있는 강점을 찾아 살려야 합니다. 개성이 곧 경쟁력입니다.',
    bad: '비견의 해: 형제나 동료의 문제로 인한 금전 손실이 생길 수 있습니다. 보증은 절대 서지 말고, 공동 투자나 자금 대출도 신중해야 합니다. 명확한 계약과 서류가 분쟁을 방지합니다.',
  },
  '겁재': {
    good: '겁재(劫財)의 해: "돈을 빼앗는 다혈질 기운"입니다. 공격적인 투자나 사업으로 큰 수익을 노릴 수 있습니다. 빠른 판단과 실행력이 장점이지만, 욕심을 부리면 큰 손실도 입을 수 있습니다. 이익이 생기면 즉시 일부를 현금화하세요.',
    mid: '겁재의 해: 예상치 못한 지출이 자주 생기는 시기입니다. 경조사비, 친구의 부탁, 교제비 등으로 돈이 새나갑니다. 별도의 임시 지출 예산을 미리 잡아두고, 불필요한 지출은 거절하는 의지가 필요합니다.',
    bad: '겁재의 해: 금전 손실과 도난 위험이 높은 시기입니다. 사기, 분실, 도난에 특별히 주의하고, 큰 금액의 거래는 가급적 피하세요. 보안과 재산 관리에 신경 쓰지 않으면 후회할 손실을 입을 수 있습니다.',
  },
  '식신': {
    good: '식신(食神)의 해: "편안하게 먹고사는 기운"입니다. 자신의 기술과 실력이 인정받아 안정적인 수입을 얻습니다. 꾸준한 노력의 결실을 맺는 시기로, 부업이나 프리랜서 활동도 수익성이 좋습니다. 콘텐츠, 강의, 자문 같은 지식 기반 수입이 특히 좋습니다.',
    mid: '식신의 해: 음식, 취미, 문화생활에 돈을 많이 씁니다. 외식·여행·쇼핑 비용이 자연스럽게 늘어납니다. 즐기되, 기본 저축과 투자는 꾸준히 하는 자제력이 필요합니다. 소비와 저축의 균형을 맞추세요.',
    bad: '식신의 해: 일에 게을러지면서 수입이 정체되거나 감소합니다. 주어진 기회를 내팽개치고 편함만 추구하면 안 됩니다. 지금 부지런히 움직여야 내년의 수입이 커집니다.',
  },
  '상관': {
    good: '상관(傷官)의 해: "혁신과 창의성의 기운"입니다. 새로운 아이디어와 창의적 표현으로 수익을 만듭니다. 마케팅, 콘텐츠, 디자인, 서비스업 등에서 기존과 다른 시도가 큰 돈이 됩니다. 창의성을 마음껏 발휘하세요.',
    mid: '상관의 해: 혁신하려다 기존 시스템과 충돌하기 쉽습니다. 사업상 불만이나 아이디어 차이로 말실수를 하면 신뢰를 잃을 수 있습니다. 말보다 행동과 결과로 보여주는 것이 더 효과적입니다. 참을성이 필요한 시기입니다.',
    bad: '상관의 해: 불만과 반항심으로 안정적인 수입원을 스스로 포기할 수 있습니다. 일반적인 관행에 저항하다가 오히려 손실을 입을 수 있습니다. 충동적인 퇴사나 사업 정리 같은 큰 결정은 최소 3개월은 신중히 고민하세요.',
  },
  '편재': {
    good: '편재(偏財)의 해: "변화무쌍한 횡재의 기운"입니다. 큰 돈이 예상치 못하게 움직이는 해입니다. 사업 기회, 부동산 거래, 투자 수익 등에서 상당한 이득을 볼 수 있습니다. 과감함이 필요하되, 한 곳에만 집중하지 말고 분산 투자하세요.',
    mid: '편재의 해: 돈이 들어오는 만큼 나가는 양도 큽니다. 횡재를 경험하지만 그것을 유지하지 못할 수 있습니다. 불필요한 지출을 줄이고 수익의 일부는 반드시 저축하세요. 보수적인 자산도 함께 늘려야 안정성이 생깁니다.',
    bad: '편재의 해: 투기와 도박에 빠질 위험이 높습니다. "쉬운 돈", "한 번에 역전"이라는 생각이 위험합니다. 정해진 직업과 사업의 수입을 지키는 것이 최우선이며, 투기적 행동은 철저히 자제하세요.',
  },
  '정재': {
    good: '정재(正財)의 해: "정직하고 고정적인 재물 기운"입니다. 월급 인상, 승진 수당, 정기 수입이 안정적으로 늘어납니다. 이 시기에는 보수적인 자산에 투자하는 것이 가장 효과적입니다. 적금, 예금, 장기 채권 같은 안전자산이 확실한 수익을 만듭니다.',
    mid: '정재의 해: 수입은 꾸준히 늘어나지만 급격한 성장은 없습니다. 큰 욕심보다 현명한 절약과 체계적인 자산관리에 집중하세요. 매월 정기적으로 저축하는 습관이 미래의 자산을 만듭니다. 소소한 즐거움을 찾으면서도 검소함을 유지하세요.',
    bad: '정재의 해: 월세, 교육비, 보험료 등 고정 지출이 늘어나면서 수입 대비 여유가 줄어듭니다. 불필요한 구독 서비스, 중복된 보험료를 정리하고 고정비를 체계적으로 줄여야 합니다. 생활비 관리가 이 시기의 핵심입니다.',
  },
  '편관': {
    good: '편관(偏官)의 해: "강압적이지만 성과를 요구하는 기운"입니다. 직장에서 높은 성과를 내면 보너스나 인센티브로 보상받습니다. 규율 있게 움직이고 체계적으로 재정을 관리하면 큰 손실을 막을 수 있습니다. 성공의 해입니다.',
    mid: '편관의 해: 세금, 벌금, 과태료 같은 강제 지출에 주의해야 합니다. 법적 분쟁이 금전 손실로 이어질 수 있으니, 계약서와 서류를 명확히 정리하세요. 법규를 지키는 것이 재물을 지키는 방법입니다.',
    bad: '편관의 해: 법적 압박, 부도덕한 거래의 강요, 사업 제재 등으로 인한 갑작스러운 재물 손실이 올 수 있습니다. 현금 보유를 최소화하고 안전자산 위주로 자산을 관리하세요. 법률 자문을 미리 받는 것이 도움됩니다.',
  },
  '정관': {
    good: '정관(正官)의 해: "올바른 권위와 지위의 기운"입니다. 승진이나 직위 상승으로 수입이 자연스럽게 증가합니다. 정부 지원금, 공적 대출, 사회 복지 혜택 같은 정당한 자금을 활용하기에 좋은 해입니다. 신뢰와 신용이 자산입니다.',
    mid: '정관의 해: 규칙적이고 계획적인 재테크가 효과를 발휘합니다. 충동 구매를 줄이고 연간 재무 계획을 세워 월별로 실천하세요. 예산 범위 내에서 생활하면 확실한 저축이 가능합니다.',
    bad: '정관의 해: 사회적 지위를 유지하기 위한 의무적 지출이 늘어납니다. 접대비, 선물, 기부금 같은 것들이 자연스럽게 나갑니다. 꼭 필요한 지출과 체면상의 지출을 구분하고, 불필요한 것은 과감히 줄이세요.',
  },
  '편인': {
    good: '편인(偏印)의 해: "비주류적이고 독특한 지적 기운"입니다. 자격증, 특허, 기술력, 또는 독특한 지식으로 수입을 올립니다. 지적 재산이 곧 돈이 되는 시기입니다. 온라인 강의, 컨설팅, 저술, 연구 같은 지식 기반 사업을 고려하세요.',
    mid: '편인의 해: 교육과 자기 계발에 돈을 투자하게 됩니다. 당장 눈에 띄는 수익은 아니지만, 지금 쌓는 역량이 내년의 큰 자산이 됩니다. 공부에 투자하는 것을 아까워하지 말고, 신중히 선택하세요.',
    bad: '편인의 해: 비현실적이고 추상적인 사업 아이디어에 돈을 쏟을 위험이 있습니다. "이번에는 성공할 것" 같은 낙관적 판단이 실은 위험할 수 있습니다. 전문가 조언을 구하고, 작은 규모로 테스트 후 확대하세요.',
  },
  '정인': {
    good: '정인(正印)의 해: "모성적이고 자애로운 지지의 기운"입니다. 부모님, 어른, 멘토의 도움과 지원으로 재물이 늘어납니다. 상속, 증여, 후원, 또는 예상치 못한 지원이 들어올 수 있습니다. 감사함으로 대하고 현명히 관리하세요.',
    mid: '정인의 해: 교육, 건강관리, 자기 계발에 돈을 쓰게 됩니다. 당장은 지출처럼 보이지만, 지금의 투자가 미래의 큰 자산과 건강을 만듭니다. 미래를 위한 현명한 소비입니다. 아까워하지 말고 투자하세요.',
    bad: '정인의 해: 타인의 지원에 의존하면서 스스로 버는 의욕이 약해질 수 있습니다. 남의 도움에만 기대다 보면 기회를 놓칩니다. 받은 것에 감사하되, 독립적으로 소득을 만드는 능력을 키워야 장기적인 성공이 가능합니다.',
  },
};

// 십성별 직업운 특화 텍스트
const SIP_CAREER: Record<string, { good: string; mid: string; bad: string }> = {
  '비견': {
    good: '비견(比肩)의 해: "나와 같은 힘"의 기운입니다. 동료·동기와의 협업에서 큰 성과를 냅니다. 팀 프로젝트, 공동 사업, 같은 업계 네트워킹이 기회를 만들어주는 시기입니다. 형제자매나 친한 후배와 함께하면 시너지가 극대화됩니다.',
    mid: '비견(比肩)의 해: 직장 내 경쟁과 비교의식이 커집니다. 동료와 스트레스 받기보다, 자신만의 독특한 강점을 찾아 차별화하세요. 편 가르기나 파벌싸움에 휘말리면 손해입니다.',
    bad: '비견(比肩)의 해: 동료와의 갈등, 진급 경합, 권한 분쟁이 생길 수 있습니다. 집단 내 알력에 말려들지 말고 중립을 지키세요. 이 시기는 혼자 힘내기보다 현 위치 유지에 집중하는 것이 현명합니다.',
  },
  '겁재': {
    good: '겁재(劫財)의 해: "나를 같이 앗아가는 강한 기운"입니다. 추진력과 배짱으로 어려운 프로젝트를 성공시킵니다. 과감한 결단이 필요한 순간에 리더십을 발휘할 수 있으며, 도전적 과제에서 두각을 나타냅니다.',
    mid: '겁재(劫財)의 해: 직장 내 경합과 정치적 갈등에 휘말릴 수 있습니다. 편을 들기보다 실력으로 승부하되, 불필요한 인간관계 소모를 줄이세요. 동료 간 이해관계가 충돌하기 쉬운 시기입니다.',
    bad: '겁재(劫財)의 해: 충동적인 결정으로 인한 후회가 생길 수 있습니다. 이직·퇴사·사업 변경에 주의하세요. "다른 곳은 더 낫다"는 환상에 빠지기 쉬우니, 먼저 확실한 대안과 성찰의 시간을 가지세요.',
  },
  '식신': {
    good: '식신(食神)의 해: "내가 생하는 편안하고 표현적인 에너지"입니다. 전문성과 기술력이 충분히 인정받습니다. 꾸준히 쌓아온 실력이 자격증·포트폴리오·프로젝트로 구체화되는 시기이며, 창작 활동도 좋은 결과를 냅니다.',
    mid: '식신(食神)의 해: 안정적이지만 정체감에 빠지기 쉽습니다. 현재 위치에 안주하지 말고 새로운 기술이나 방법론을 배우세요. 작은 개선이 모여 큰 경쟁력이 됩니다.',
    bad: '식신(食神)의 해: 자만과 나태함이 커리어 정체로 이어질 수 있습니다. 마감에 쫓기기보다 체계적으로 준비하는 습관을 들이세요. 자신이 안주하는 분야에서 벗어나려는 노력이 필요합니다.',
  },
  '상관': {
    good: '상관(傷官)의 해: "내가 극하는 제약과 규범을 벗어나는 기운"입니다. 창의적 아이디어와 표현력이 빛을 발합니다. 기획·디자인·마케팅·콘텐츠·미디어 분야에서 독창성을 뽐낼 수 있으며, 프리랜서나 1인 창작활동도 매우 좋습니다.',
    mid: '상관(傷官)의 해: 상사나 조직의 규칙과 마찰이 생길 수 있습니다. 불만이 있어도 감정적 표현보다 건설적 피드백으로 전달하세요. 개인의 주장과 조직의 질서 사이에서 균형을 맞추는 것이 중요합니다.',
    bad: '상관(傷官)의 해: 권위자와의 충돌로 인한 문제가 발생할 수 있습니다. 입다물기와 인내심을 기르세요. 이직을 고려한다면 최소 3개월간 신중하게 검토하고, 차라리 부서 이동이나 역할 변화를 먼저 시도해보세요.',
  },
  '편재': {
    good: '편재의 해: 사업 기회가 쏟아지는 해입니다. 영업·유통·무역·프리랜서 등 유동적인 직종에서 큰 성과가 기대됩니다.',
    mid: '편재의 해: 여러 일을 동시에 벌리게 되어 집중력이 분산됩니다. "선택과 집중"이 올해의 키워드입니다.',
    bad: '편재의 해: 무리한 사업 확장이나 무모한 이직은 실패로 이어질 수 있습니다. 현실적인 판단이 필요합니다.',
  },
  '정재': {
    good: '정재(正財)의 해: "내가 극하는 안정적인 재물"입니다. 꾸준한 노력이 승진·연봉 인상으로 보상받습니다. 맡은 바 책임을 성실히 다하면 상사의 신뢰와 조직 내 위상이 올라갑니다. 안정적 성장의 황금기입니다.',
    mid: '정재(正財)의 해: 현재 직장에서 묵묵히 일하는 것이 최선입니다. 화려한 변화보다 지금의 기반을 다지는 데 집중하세요. 작은 성과의 적립이 장기적 신뢰로 변환되는 시기입니다.',
    bad: '정재(正財)의 해: 업무량은 많은데 보상이 적다고 느낄 수 있습니다. 단기 불만보다 장기적 관점에서 실력을 구축하고 있다고 생각하세요. 조급함은 버리고, 시간이 되면 반드시 평가받을 것이라는 믿음을 유지하세요.',
  },
  '편관': {
    good: '편관(偏官)의 해: "나를 극하는 강제적 제약의 기운"입니다. 도전적 업무에서 성과를 냅니다. 경쟁이 치열한 환경에서 오히려 실력이 발휘되며, 승진·발탁·특별한 임무의 기회가 옵니다. 강압적 상황에 강해지는 해입니다.',
    mid: '편관(偏官)의 해: 직장에서 압박과 스트레스가 증가합니다. 상사의 요구가 까다로워질 수 있으나, 이를 견뎌내면 한 단계 성장하게 됩니다. 짧은 기간의 고난이 미래의 자산이 된다고 생각하세요.',
    bad: '편관(偏官)의 해: 구조조정·부서 이동·조직 갈등이 생길 수 있습니다. 외부 압력이 심해질 때는 감정적 대응보다 유연한 대처가 현명합니다. "때가 지나면 편관도 정관이 된다"는 마음으로 인내하되, 건강과 마음 관리를 우선으로 하세요.',
  },
  '정관': {
    good: '정관(正官)의 해: "나를 극하는 명분과 질서의 기운"입니다. 승진·인사 발탁의 해입니다. 안정적인 조직 내에서 위치가 올라가며, 공무원·대기업·공공기관에서 특히 좋은 기회를 얻습니다. 사회적 지위와 신분의 상승기입니다.',
    mid: '정관(正官)의 해: 조직의 규칙과 질서 속에서 묵묵히 역할을 수행하는 것이 최선입니다. 화려한 성과보다 신뢰와 평판 축적에 집중하세요. 조직의 기준에 맞춰 행동하는 것이 이 해의 성공 전략입니다.',
    bad: '정관(正官)의 해: 조직 변화나 인사 이동에 휘말릴 수 있습니다. 급변하는 상황에 흔들리지 말고 본분을 지키세요. 미리 본인의 실력을 증명할 포트폴리오를 준비하고, 변화에 대비하는 자세를 가지세요.',
  },
  '편인': {
    good: '편인(偏印)의 해: "나를 생하는 창의적이고 독특한 에너지"입니다. 연구·개발·기술·특화 분야에서 돌파구를 찾습니다. 독창적인 아이디어가 커리어 도약의 계기가 되며, 대학원·자격증·전문 분야 학습에 매우 유리합니다.',
    mid: '편인(偏印)의 해: 배우고 싶은 욕구는 크지만, 산만해지기 쉽습니다. 여러 분야에 손을 대기보다 핵심 하나에 깊이 있게 집중하세요. 이론과 실무 사이의 균형을 맞추고, 학습을 명확한 성과로 연결하세요.',
    bad: '편인(偏印)의 해: 현실과 동떨어진 이상에 빠져 커리어가 표류할 수 있습니다. 거창한 계획보다 당장 실행 가능하고 시장성 있는 스킬에 집중하세요. 사상 체계에서 벗어나 실질적인 가치 창출에 눈을 돌려야 합니다.',
  },
  '정인': {
    good: '정인(正印)의 해: "나를 생하는 안정적이고 지혜로운 에너지"입니다. 상사·선배·멘토·후원자의 지원으로 커리어가 탄탄해집니다. 추천·소개·후원을 통해 좋은 기회를 얻으며, 학습과 성장의 기반이 마련되는 해입니다.',
    mid: '정인(正印)의 해: 자기 계발과 학습에 집중하는 시기입니다. 당장의 성과가 눈에 띄지 않아도, 지금 쌓는 지식과 경험이 미래의 큰 무기가 됩니다. 뒷받침과 신뢰 구축에 초점을 맞추세요.',
    bad: '정인(正印)의 해: 수동적 태도로 기회를 놓치기 쉽습니다. 누군가 해주기를 기다리지 말고, 적극적으로 나서서 배움의 기회를 찾으세요. 주어진 지원과 환경을 최대한 활용하려는 주도성이 필요합니다.',
  },
};

// 십성별 건강운 특화 텍스트
const SIP_HEALTH: Record<string, { good: string; mid: string; bad: string }> = {
  '비견': {
    good: '비견(比肩)의 해: 체력이 충실하고 활력이 넘칩니다. 그룹 운동(등산 모임, 러닝 크루)이 신체와 정신 건강에 모두 효과적입니다. 단, 과도한 경쟁 의식은 버리고 함께 즐기는 것에 초점을 맞추세요.',
    mid: '비견(比肩)의 해: 과도한 경쟁심으로 무리하기 쉽습니다. 운동 중 부상 위험이 있으니 충분한 스트레칭과 휴식을 취하세요. 휴식과 운동의 균형 유지가 건강의 핵심입니다.',
    bad: '비견(比肩)의 해: 스트레스를 운동으로 풀려다 오히려 과로하기 쉽습니다. 명상·요가·산책 등 정적 활동으로 마음을 진정시키세요. 신체의 신호를 무시하고 밀어붙이는 것은 오버트레이닝으로 이어집니다.',
  },
  '겁재': {
    good: '겁재(劫財)의 해: 강인한 의지력으로 건강 목표를 달성할 수 있습니다. 다이어트·체력 단련·금연 등 큰 결심이 실제 성과로 이어지는 시기입니다. 이 추진력을 긍정적 건강 습관 형성에 활용하세요.',
    mid: '겁재(劫財)의 해: 사고·부상·낙상에 특히 주의하세요. 무리한 운동이나 과격한 스포츠는 피하고, 헬멧·안전장비 착용을 필수로 하세요. 극기 훈련이 아닌 신체 관리에 집중하세요.',
    bad: '겁재(劫財)의 해: 음주·흡연·폭식 등 자기 파괴적 습관이 강해질 수 있습니다. 스트레스 관리가 건강의 핵심이므로, 운동·상담·취미 등 건전한 해소 방법을 찾으세요. 중독성 물질은 절대 피하세요.',
  },
  '식신': {
    good: '식신(食神)의 해: "내가 생하는 편안하고 표현적인 에너지"로 소화기능과 영양 흡수가 매우 좋습니다. 이 시기에 섭취하는 영양분은 흡수가 잘 되므로, 한방 보양식이나 건강식이 효과적입니다. 식단 개선으로 체질 강화 기회입니다.',
    mid: '식신(食神)의 해: 과식·폭식 위험이 있습니다. 맛있는 음식 앞에서 자제력이 약해지기 쉬우니, 규칙적 식사 시간을 지키고 한 끼 분량을 미리 정해두세요. 특히 단 음식과 기름진 음식은 절제하세요.',
    bad: '식신(食神)의 해: 나태함과 무기력감으로 운동 부족이 이어질 수 있습니다. 체중 증가와 소화 기능 저하를 방지하기 위해, 최소한 하루 30분의 가벼운 산책 습관을 들이세요. 정신적 활동도 신체 건강을 돕습니다.',
  },
  '상관': {
    good: '상관(傷官)의 해: "내가 극하는 제약을 벗어나는 표현적 에너지"로 활발한 활동력이 신체 건강을 좋게 만듭니다. 댄스·수영·테니스·요가 등 창의적이고 표현적인 운동이 특별히 효과적입니다. 취미 활동도 건강 증진에 매우 좋습니다.',
    mid: '상관(傷官)의 해: 정서적 불안이 신체 증상(두통, 소화불량, 불면)으로 나타날 수 있습니다. 감정 표현의 건전한 출구(예술, 일기, 상담)를 찾으세요. 마음의 답답함이 신체 증상을 악화시키므로, 심리 관리가 매우 중요합니다.',
    bad: '상관(傷官)의 해: 신경과민·불면증·스트레스성 질환(위장 장애, 두통)에 주의하세요. 불만과 답답함을 안으로 억누르지 마세요. 명상·아로마·음악 감상 등 차분한 활동으로 마음을 달래고, 마음의 여유가 최고의 건강 관리법입니다.',
  },
  '편재': {
    good: '편재(偏財)의 해: "내가 극하는 유동적인 에너지"로 활동적인 생활이 자연스럽게 신체 건강을 유지시킵니다. 등산·캠핑·여행·야외 활동이 신체와 정신 건강 모두에 매우 좋습니다. 새로운 환경의 자극이 면역력 강화로 이어집니다.',
    mid: '편재(偏財)의 해: 바쁜 사회생활과 이동으로 건강 관리가 소홀해지기 쉽습니다. 회식·음주 기회가 많아져 간 건강, 소화기 건강에 특히 주의하세요. 정기적인 건강검진과 규칙적 수면이 필수입니다.',
    bad: '편재(偏財)의 해: 과로와 스트레스로 면역력이 급격히 떨어질 수 있습니다. 신체가 피로 신호를 보낼 때 무시하고 밀어붙이면 큰 질병으로 이어질 수 있습니다. 피로가 쌓이기 전에 충분한 휴식과 회복을 우선으로 하세요.',
  },
  '정재': {
    good: '정재(正財)의 해: "내가 극하는 안정적인 에너지"로 규칙적인 생활 패턴이 자동으로 유지됩니다. 매일의 작은 운동 루틴(스트레칭, 산책, 요가)이 큰 건강 효과를 발휘하는 시기입니다. 꾸준함이 가장 효과적인 건강 관리법입니다.',
    mid: '정재(正財)의 해: 장시간 같은 자세로 일하는 생활이 허리·목·어깨에 만성적 부담을 줍니다. 매 시간 스트레칭과 자세 교정을 의식적으로 실행하세요. 경추 베개나 요추 쿠션 등 보조도구 사용도 도움됩니다.',
    bad: '정재(正財)의 해: 금전적 걱정과 불안이 불면증, 위장 장애, 소화 불량으로 이어질 수 있습니다. 신체 증상이 정신적 불안에서 비롯된 것이므로, 마음 관리가 신체 건강의 핵심입니다. 신뢰할 수 있는 사람과 대화하세요.',
  },
  '편관': {
    good: '편관(偏官)의 해: "나를 극하는 강제적 제약의 에너지"로 극기와 단련을 통해 체력이 강해집니다. 격투기·마라톤·등산 등 고강도 운동도 신체가 충분히 소화할 수 있는 시기입니다. 신체 한계에 도전하는 것도 이 시기에 적합합니다.',
    mid: '편관(偏官)의 해: 외부 스트레스와 압박이 신체 건강을 위협합니다. 혈압·당뇨 관리에 특히 주의하세요. 분노와 스트레스를 억누르지 말고 적절히 해소하세요. 과도한 흥분은 심장과 혈관 건강을 해칠 수 있습니다.',
    bad: '편관(偏官)의 해: 사고·외상·수술 위험이 높습니다. 위험한 장소나 과격한 활동은 피하고, 교통안전에 철저히 주의하세요. 신체 신호를 무시하면 예상치 못한 질병으로 이어질 수 있으므로, 의료 검진을 주기적으로 받으세요.',
  },
  '정관': {
    good: '정관(正官)의 해: "나를 극하는 명분과 질서의 에너지"로 체계적이고 규칙적인 건강 관리가 최고의 효과를 발휘합니다. 병원 정기검진 일정을 명확히 정하고, 식단과 운동을 계획적으로 실행하세요. 이 시기의 작은 관리가 큰 효과를 냅니다.',
    mid: '정관(正官)의 해: 과중한 업무와 책임으로 인한 스트레스가 만성 피로로 이어질 수 있습니다. 퇴근 후와 주말에 충분한 휴식과 수면(최소 7시간)을 반드시 확보하세요. 스트레스 누적은 면역력 저하와 질병으로 직결됩니다.',
    bad: '정관(正官)의 해: 과도한 책임감과 의무감이 심리적 압박과 번아웃으로 이어질 수 있습니다. 번아웃 초기 증상(피로, 무기력, 우울감)이 보이면 즉시 휴식을 취하세요. 자신의 한계를 인정하고, 때로는 짐을 내려놓을 수 있는 융통성이 건강을 지키는 방법입니다.',
  },
  '편인': {
    good: '편인(偏印)의 해: "나를 생하는 창의적이고 독특한 에너지"로 대체의학·한방치료·명상·요가 등 비전통적 건강법이 뛰어난 효과를 발휘합니다. 정신 건강과 명상이 신체 건강의 견고한 토대가 되는 시기입니다. 심신 수련에 투자하세요.',
    mid: '편인(偏印)의 해: 과도한 생각과 고민으로 인한 신체 증상(두통, 불면, 소화불량)이 나타날 수 있습니다. 머리를 쉬게 하는 시간을 의식적으로 만들고, 몸에 집중하는 활동(스트레칭, 명상, 산책)을 하세요. 사고를 멈추는 훈련이 필요합니다.',
    bad: '편인(偏印)의 해: 건강에 대한 과도한 불안(건강염려증)에 빠지지 않도록 주의하세요. 사소한 증상을 큰 질병으로 확대 해석하기 쉬우니, 신뢰할 수 있는 의사의 조언을 따르세요. 검증되지 않은 민간요법이나 과도한 보충제 섭취는 오히려 건강을 해칩니다.',
  },
  '정인': {
    good: '정인(正印)의 해: "나를 생하는 안정적이고 지혜로운 에너지"로 돌봄과 후원을 받는 해입니다. 가족·의료 전문가·건강 전문가의 조언을 적극적으로 따르면 건강이 크게 호전됩니다. 남의 경험과 지식을 배우는 것이 자신의 건강 관리 지혜가 됩니다.',
    mid: '정인(正印)의 해: 체력보다 정신과 감정 건강에 주의가 필요한 시기입니다. 좋은 책·음악·예술 감상·자연 속 산책 등이 마음의 치유와 회복에 큰 도움을 줍니다. 심리적 안정이 신체 건강으로 자동 전환되는 시기입니다.',
    bad: '정인(正印)의 해: 수동적이고 게으른 생활로 체력이 빠르게 떨어지기 쉽습니다. 남에게만 의존하고 자신은 노력하지 않으면 건강은 악화됩니다. 받은 돌봄과 지원을 감사히 여기되, 자신의 건강은 스스로 챙기겠다는 자주성이 필요합니다.',
  },
};

// 12운성별 영역 보충 텍스트 (짧은 한 줄)
const STAGE_AREA_HINT: Record<string, { love: string; money: string; career: string; health: string }> = {
  '장생': { love: '새로운 시작의 기운, 첫 만남에 유리.', money: '새 수입원이 열리는 시기.', career: '신규 프로젝트나 입사에 좋은 시기.', health: '체력이 서서히 올라가는 상승기.' },
  '목욕': { love: '매력이 폭발하는 시기, 도화(桃花)의 기운.', money: '유흥·사치 지출 주의.', career: '외모·이미지가 중요한 업무에 유리.', health: '피부·비뇨기 관리에 신경.' },
  '관대': { love: '자신감 넘치는 연애, 적극적 고백 추천.', money: '투자·사업 확장에 좋은 타이밍.', career: '승진·발탁의 기회, 자신감이 무기.', health: '에너지는 높으나 과로 주의.' },
  '건록': { love: '안정적이고 성숙한 관계 형성.', money: '고정 수입 증가, 저축에 유리.', career: '실력이 인정받는 시기, 월급이 오른다.', health: '체력 최고조, 꾸준한 운동 효과.' },
  '제왕': { love: '주도적 연애, 리더십을 발휘하는 관계.', money: '재물운 정점, 큰 거래에 유리.', career: '최고의 위치에서 성과를 낸다.', health: '에너지 과잉, 적절한 발산이 필요.' },
  '쇠': { love: '관계의 열기가 식어가는 시기, 대화가 중요.', money: '수입이 줄어드는 경향, 절약 필요.', career: '성장이 정체되는 느낌, 재충전의 시간.', health: '면역력 저하에 주의, 보양식 추천.' },
  '병': { love: '정서적 불안이 관계에 영향, 배려가 필요.', money: '의료비·예상치 못한 지출 주의.', career: '업무 능률 저하, 건강 관리가 우선.', health: '만성질환 주의, 정기검진 필수.' },
  '사': { love: '관계가 끝나가거나 이별 수 있는 시기.', money: '재물 손실 위험, 큰 지출 주의.', career: '퇴사·전직 시점이 될 수 있다.', health: '큰 병·수술 가능성, 정밀 검사 필요.' },
  '묘': { love: '감정이 감춰지거나 비밀연애 가능성.', money: '돈이 묶이거나 회수 어려움.', career: '실력이 숨겨지는 시기, 인정받기 어려움.', health: '원인 모를 증상, 종합검진 추천.' },
  '절': { love: '완전한 이별 또는 새 인연의 시작.', money: '기존 수입원 단절, 새 길을 찾아야.', career: '완전한 전환, 새 출발이 필요한 시기.', health: '면역력 최저점, 예방접종·관리 필수.' },
  '태': { love: '새로운 인연의 씨앗이 생기는 시기.', money: '소규모 투자에서 새 가능성 발견.', career: '새로운 분야·업종으로의 전환점.', health: '새로운 건강 습관 시작에 적합.' },
  '양': { love: '인연이 서서히 자라나는 시기, 성급함 금물.', money: '저축·적금으로 기반을 다지는 시기.', career: '학습·수련으로 실력을 기르는 시기.', health: '체력이 서서히 회복, 꾸준한 관리가 핵심.' },
};

// ========== 어린이(16세 이하) 텍스트 필터링 ==========

/**
 * 나이 계산: 세운 year - 생년 = 나이
 * 16세 이하이면 어린이
 */
function calculateAge(saju: SajuResult, seunYear: number): number {
  // 역산: seunYear 기준으로 과거로 거슬러 올라가며 천간지 매칭
  for (let y = seunYear; y >= seunYear - 120; y--) {
    const checkGanIdx = (y - 4) % 10;
    const checkJiIdx = (y - 4) % 12;
    const checkGan = CHEONGAN[(checkGanIdx + 10) % 10];
    const checkJi = JIJI[(checkJiIdx + 12) % 12];

    if (checkGan === saju.year.cheongan && checkJi === saju.year.jiji) {
      return seunYear - y;
    }
  }
  return 20; // 매칭 실패 시 기본값
}

/**
 * 텍스트를 어린이용으로 치환
 */
function filterTextForChildren(text: string): string {
  let result = text;

  const replacements: Array<[RegExp, string]> = [
    [/세금·?벌금·?과태료/g, "예상치 못한 지출"],
    [/(세금|벌금|과태료)/g, "예상치 못한 지출"],
    [/승진·인사\s*발탁/g, "성적 향상"],
    [/승진·연봉\s*인상/g, "성적 향상"],
    [/(직장\s*내|직장에서)/g, "학교에서"],
    [/직장(?![운에])/g, "학교"],
    [/(회사에서|회사\s*내)/g, "학교에서"],
    [/회사(?![운에])/g, "학교"],
    [/(승진|인사\s*발탁|연봉\s*인상|연봉|급여\s*인상)/g, "성적 향상"],
    [/(이직|퇴사)/g, "환경 변화"],
    [/(사업\s*확장|사업\s*확대)/g, "활동 범위 확대"],
    [/(투기|도박)/g, "충동적인 소비"],
    [/소송/g, "갈등"],
    [/상사의/g, "선생님의"],
    [/상사(?![의운])/g, "선생님이나 선배"],
    [/(부하직원|부하)/g, "후배"],
  ];

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * SeunResult를 어린이용으로 필터링
 */
function filterSeunResultForChildren(result: SeunResult, saju: SajuResult): SeunResult {
  const age = calculateAge(saju, result.year);

  if (age > 16) {
    return result;
  }

  return {
    ...result,
    description: filterTextForChildren(result.description),
    love: filterTextForChildren(result.love),
    money: filterTextForChildren(result.money),
    career: filterTextForChildren(result.career),
    health: filterTextForChildren(result.health),
  };
}

function generateSeunLove(saju: SajuResult, ganOh: Ohaeng, jiOh: Ohaeng, stage: TwelveStage, score: number, seunCtx: SeunTextContext): string {
  const { seunSipseong, jiji, chungCount, hapCount, highFactors } = seunCtx;
  const sipLove = SIP_LOVE[seunSipseong] || SIP_LOVE['비견'];
  const isMarried = saju.relationship === 'married';
  const isDating = saju.relationship === 'dating';
  const isSingle = saju.relationship === 'single';

  // 도화살 체크
  const DOHWA_SAL: Record<string, string> = {
    '자': '유', '축': '오', '인': '묘', '묘': '자',
    '진': '유', '사': '오', '오': '묘', '미': '자',
    '신': '유', '유': '오', '술': '묘', '해': '자',
  };
  const isDohwaYear = (DOHWA_SAL[saju.day.jiji] === jiji || DOHWA_SAL[saju.year.jiji] === jiji);

  let intro = '';
  if (score >= 7) {
    // 고득점 부각: 왜 연애운이 좋은지 구체적으로 설명
    const factors = highFactors.love;
    const factorText = factors.length > 0 ? ` 특히 ${factors.slice(0, 2).join(', ')}하여 ` : ' ';
    if (score >= 8) {
      intro = isMarried ? `가정운이 매우 좋은 한 해입니다.${factorText}부부 사이에 깊은 화합과 신뢰가 형성됩니다.` :
              isDating ? `애정운이 매우 좋아${factorText}관계가 결실(약혼·동거·결혼)로 이어질 수 있습니다.` :
              isSingle ? `애정운이 매우 좋아${factorText}운명적 인연을 만날 가능성이 높습니다.` :
              `애정운이 매우 좋습니다.${factorText}적극적으로 인연을 맞이하세요.`;
    } else {
      intro = isMarried ? `가정운이 좋습니다.${factorText}부부 관계가 한층 돈독해집니다.` :
              isDating ? `애정운이 좋아${factorText}관계가 한 단계 발전합니다.` :
              isSingle ? `애정운이 좋아${factorText}새 인연의 가능성이 높습니다.` :
              `애정운이 좋습니다.${factorText}인연에 적극적으로 나서세요.`;
    }
    intro += ' ' + sipLove.good;
  } else if (score >= 4) {
    intro = isMarried ? '가정운은 무난합니다.' : isDating ? '애정운은 무난하며 관계가 안정적입니다.' : isSingle ? '애정운은 보통이며 적극성이 필요합니다.' : '애정운은 보통입니다.';
    intro += ' ' + sipLove.mid;
  } else {
    intro = isMarried ? '가정운이 다소 약합니다.' : isDating ? '애정운이 다소 약하며 관계에 시련이 있을 수 있습니다.' : isSingle ? '애정운이 약하여 자기 성장에 집중하세요.' : '애정운이 다소 약합니다.';
    intro += ' ' + sipLove.bad;
  }

  const extras: string[] = [];
  if (hapCount > 0) extras.push('합(合)으로 화합에 유리');
  if (chungCount > 0) extras.push('충(沖)으로 감정 충돌 주의');
  if (isDohwaYear) extras.push(isMarried ? '🌸 도화살 발동 — 부부 애정표현 강화' : '🌸 도화살 발동 — 이성 매력 상승');

  return extras.length > 0 ? `${intro} ${extras.join('. ')}.` : intro;
}

function generateSeunMoney(saju: SajuResult, ganOh: Ohaeng, jiOh: Ohaeng, stage: TwelveStage, score: number, seunCtx: SeunTextContext): string {
  const { seunSipseong, chungCount, highFactors } = seunCtx;
  const sipMoney = SIP_MONEY[seunSipseong] || SIP_MONEY['비견'];

  let text = '';
  if (score >= 7) {
    // 고득점 부각: 왜 재물운이 좋은지 구체적으로 설명
    const factors = highFactors.money;
    const factorText = factors.length > 0 ? ` ${factors.slice(0, 2).join('. ')}.` : '';
    if (score >= 8) {
      text = `재물운이 크게 상승하는 한 해입니다.${factorText} ${sipMoney.good} 💰 적극적인 재테크와 투자에 최적의 시기입니다.`;
    } else {
      text = `재물운이 상승합니다.${factorText} ${sipMoney.good}`;
    }
  } else if (score >= 4) {
    text = `재물운은 평탄합니다. ${sipMoney.mid}`;
  } else {
    text = `재물운이 약합니다. ${sipMoney.bad}`;
  }

  const extras: string[] = [];
  if (ganOh === saju.yongsin || jiOh === saju.yongsin) extras.push('용신이 재물을 돕습니다');
  if (ganOh === saju.gisin || jiOh === saju.gisin) extras.push('기신의 방해에 주의');
  if (chungCount > 0) extras.push('충(沖)으로 금전 변동 대비');

  return extras.length > 0 ? `${text} ${extras.join('. ')}.` : text;
}

function generateSeunCareer(saju: SajuResult, ganOh: Ohaeng, jiOh: Ohaeng, stage: TwelveStage, score: number, seunCtx: SeunTextContext): string {
  const { seunSipseong, chungCount, hapCount, highFactors } = seunCtx;
  const sipCareer = SIP_CAREER[seunSipseong] || SIP_CAREER['비견'];

  let text = '';
  if (score >= 7) {
    // 고득점 부각: 왜 직업운이 좋은지 구체적으로 설명
    const factors = highFactors.career;
    const factorText = factors.length > 0 ? ` ${factors.slice(0, 2).join('. ')}.` : '';
    if (score >= 8) {
      text = `직업운이 크게 상승하는 한 해입니다.${factorText} ${sipCareer.good} 🚀 커리어 도약의 최적기이니 적극적으로 기회를 잡으세요.`;
    } else {
      text = `직업운이 좋습니다.${factorText} ${sipCareer.good}`;
    }
  } else if (score >= 4) {
    text = `직업운이 안정적입니다. ${sipCareer.mid}`;
  } else {
    text = `직업운이 다소 약합니다. ${sipCareer.bad}`;
  }

  const extras: string[] = [];
  if (ganOh === saju.yongsin || jiOh === saju.yongsin) extras.push('용신이 직업운을 돕습니다');
  if (ganOh === saju.gisin || jiOh === saju.gisin) extras.push('기신으로 직장 내 어려움 주의');
  if (chungCount > 0) extras.push('이직·부서이동 변동 가능');
  if (hapCount > 0) extras.push('협력·제휴에 유리');

  return extras.length > 0 ? `${text} ${extras.join('. ')}.` : text;
}

function generateSeunHealth(saju: SajuResult, ganOh: Ohaeng, jiOh: Ohaeng, stage: TwelveStage, score: number, seunCtx: SeunTextContext): string {
  const { seunSipseong, chungCount } = seunCtx;
  const sipHealth = SIP_HEALTH[seunSipseong] || SIP_HEALTH['비견'];

  const ORGAN_MAP: Record<Ohaeng, string> = {
    '목': '간·근육·눈', '화': '심장·혈관', '토': '위장·소화기',
    '금': '폐·호흡기·피부', '수': '신장·허리·방광',
  };

  // 오행별 정신건강 매핑 (한의학 기반)
  const MENTAL_MAP: Record<Ohaeng, string> = {
    '목': '분노·짜증·우울감',
    '화': '불안·초조·공황',
    '토': '걱정·강박·과잉사고',
    '금': '슬픔·비관·완벽주의 스트레스',
    '수': '공포·두려움·의욕 저하',
  };

  // 십성별 정신건강 경향
  const SIP_MENTAL: Record<string, string> = {
    '편관': '외부 압박으로 번아웃·만성 스트레스 주의',
    '상관': '감정 기복이 커지고 말실수로 인한 스트레스 주의',
    '편인': '생각이 많아지고 불면·강박 경향 주의',
    '겁재': '충동적 결정 후 후회 패턴 주의',
    '비견': '경쟁심·비교의식으로 자존감 흔들림 주의',
  };

  let text = '';
  if (score >= 7) {
    // 고득점 부각: 왜 건강운이 좋은지 구체적으로 설명
    const factors = seunCtx.highFactors.health;
    const factorText = factors.length > 0 ? ` ${factors.slice(0, 2).join('. ')}.` : '';
    if (score >= 8) {
      text = `건강운이 매우 좋은 한 해입니다.${factorText} ${sipHealth.good} 💪 체력이 좋으니 운동이나 건강 목표를 세우기에 최적의 시기입니다.`;
    } else {
      text = `건강운이 좋습니다.${factorText} ${sipHealth.good}`;
    }
  } else if (score >= 4) {
    text = `건강 관리에 신경 쓰세요. ${sipHealth.mid}`;
  } else {
    text = `건강에 각별히 주의하세요. ${sipHealth.bad}`;
  }

  // 주의 부위 (천간·지지 오행 기반)
  const organs = new Set<string>();
  organs.add(ORGAN_MAP[ganOh]);
  if (ganOh !== jiOh) organs.add(ORGAN_MAP[jiOh]);
  text += ` 🏥 주의 부위: ${Array.from(organs).join(', ')}.`;

  // 정신건강 (오행 + 십성)
  const mentalOhaeng = MENTAL_MAP[ganOh];
  const sipMental = SIP_MENTAL[seunSipseong];
  if (score <= 4) {
    text += ` 🧠 정신건강: ${mentalOhaeng} 경향이 나타날 수 있습니다.`;
    if (sipMental) text += ` ${sipMental}.`;
  } else if (score <= 6 && sipMental) {
    text += ` 🧠 ${sipMental}.`;
  }

  if (chungCount > 0) text += ' 충(沖)으로 돌발 부상·정신적 충격 주의.';

  return text;
}

// ========== 건강 원인 분석 + 호전 시기 예측 ==========

/** 오행 과다의 사주 원인 분석 — "지나쳐도 병" */
const OHAENG_EXCESS_CAUSE: Record<Ohaeng, string> = {
  '목': '목(木) 과다의 원인: 사주 원국에 목 기운(갑·을, 인·묘)이 몰려 있습니다. 간 기능이 과항진되어 알레르기·눈 피로·편두통·분노 조절 문제가 나타나기 쉬운 체질입니다. 금(金) 기운을 보충하여 목을 적절히 다듬어야 균형이 잡힙니다.',
  '화': '화(火) 과다의 원인: 사주 원국에 화 기운(병·정, 사·오)이 몰려 있습니다. 심장이 과열되어 고혈압·심혈관 질환·불면증·과열성 염증에 취약합니다. 수(水) 기운을 보충하여 열을 식혀야 합니다.',
  '토': '토(土) 과다의 원인: 사주 원국에 토 기운(무·기, 진·술·축·미)이 몰려 있습니다. 위장이 과민해져 소화불량·만성 피로·어깨 결림이 나타나기 쉽고, 🧠 정신적으로는 걱정·강박·과잉사고·반복적 불안에 시달리기 쉽습니다. 목(木) 기운을 보충하여 토를 소통시켜야 합니다.',
  '금': '금(金) 과다의 원인: 사주 원국에 금 기운(경·신, 신·유)이 몰려 있습니다. 폐·호흡기가 과민해져 비염·기침·피부 건조증이 심하고, 🧠 정신적으로는 슬픔·비관적 사고·완벽주의로 인한 만성 스트레스가 나타나기 쉽습니다. 유연성이 부족하여 변화에 적응하기 어려울 수 있습니다. 화(火) 기운을 보충하여 금을 적절히 녹여야 합니다.',
  '수': '수(水) 과다의 원인: 사주 원국에 수 기운(임·계, 해·자)이 몰려 있습니다. 신장 과활성으로 하체 부종·관절 약화가 오고, 호르몬 변동이 심해 우울증·감정 과민·불면증에 취약합니다. 토(土) 기운을 보충하여 수를 다스려야 합니다.',
};

/** 오행 부족의 사주 원인 분석 */
const OHAENG_WEAKNESS_CAUSE: Record<Ohaeng, string> = {
  '화': '화(火) 부족의 원인: 사주 원국에 화 기운(병·정, 사·오)이 거의 없거나, 수(水) 기운이 과다하여 화를 극(克)하고 있습니다. 심장·소장·혈관 계통이 선천적으로 약하며, 정서적으로 불안·공황·우울 증상이 나타나기 쉬운 체질입니다. 이는 타고난 것이므로 "의지로 극복"이 아닌 "관리와 치료"가 핵심입니다.',
  '목': '목(木) 부족의 원인: 사주 원국에 목 기운(갑·을, 인·묘)이 거의 없거나, 금(金) 기운이 과다하여 목을 극(克)하고 있습니다. 간·담·근육·관절이 선천적으로 약하며, 🧠 정신적으로는 우울감·의욕 저하·만성 피로·무기력증이 나타나기 쉬운 체질입니다. 목은 생장(生長)의 기운이므로 부족하면 삶의 의욕과 추진력이 떨어지고 쉽게 지치는 경향이 있습니다.',
  '토': '토(土) 부족의 원인: 사주 원국에 토 기운(무·기, 진·술·축·미)이 거의 없거나, 목(木) 기운이 과다하여 토를 극(克)하고 있습니다. 위장·소화기·비장이 선천적으로 약하며, 🧠 정신적으로는 걱정·강박·과잉사고·불안정한 사고 패턴이 나타나기 쉬운 체질입니다. 토는 중심(中)의 기운이므로 부족하면 마음의 중심이 흔들리고 끊임없이 걱정하는 경향이 있습니다.',
  '금': '금(金) 부족의 원인: 사주 원국에 금 기운(경·신, 신·유)이 거의 없거나, 화(火) 기운이 과다하여 금을 극(克)하고 있습니다. 폐·호흡기·대장·피부가 선천적으로 약하며, 🧠 정신적으로는 슬픔·비관적 사고·완벽주의 스트레스·결단력 부족이 나타나기 쉬운 체질입니다. 금은 결단(決斷)의 기운이므로 부족하면 우유부단해지고 작은 일에도 슬퍼지는 경향이 있습니다.',
  '수': '수(水) 부족의 원인: 사주 원국에 수 기운(임·계, 해·자)이 거의 없거나, 토(土) 기운이 과다하여 수를 극(克)하고 있습니다. 신장·방광·허리·귀가 선천적으로 약하며, 🧠 정신적으로는 공포·두려움·의욕 저하·위축감이 나타나기 쉬운 체질입니다. 수는 지혜(智)의 기운이므로 부족하면 겁이 많아지고 새로운 시도를 두려워하는 경향이 있습니다.',
};

export interface HealthForecast {
  cause: string;               // 병의 원인 (사주 분석)
  currentStatus: string;        // 현재 상태
  recoveryPeriods: { period: string; description: string; level: 'good' | 'neutral' | 'bad' }[];
  overallAdvice: string;
}

/**
 * 건강 호전 시기 예측: 대운 기둥들을 스캔하여 부족한 오행이 보충되는 시기를 찾음
 */
export function analyzeHealthForecast(
  saju: SajuResult,
  daeunResult: DaeunResult
): HealthForecast | null {
  const weakOh = saju.weakestOhaeng as Ohaeng | undefined;
  const weakBal = saju.ohaengBalance ? Math.min(...Object.values(saju.ohaengBalance)) : 99;

  if (!weakOh || weakBal > 0) return null; // 완전히 없는 오행(0)만 극약자 — 지장간에라도 있으면 skip

  let cause = OHAENG_WEAKNESS_CAUSE[weakOh];

  // 과다 오행도 병의 원인으로 추가 (부족해도 병, 지나쳐도 병)
  const excessOh = saju.dominantOhaeng as Ohaeng | undefined;
  const excessBal = excessOh && saju.ohaengBalance ? saju.ohaengBalance[excessOh] : 0;
  if (excessOh && excessBal >= 4 && excessOh !== weakOh) {
    cause += `\n\n${OHAENG_EXCESS_CAUSE[excessOh]}`;
  }

  // 현재 대운 상태
  let currentStatus = '';
  if (daeunResult.currentDaeun) {
    const cd = daeunResult.currentDaeun;
    const supplies = cd.cheonganOhaeng === weakOh || cd.jijiOhaeng === weakOh;
    const generates = OHAENG_SANGSAENG[cd.cheonganOhaeng] === weakOh || OHAENG_SANGSAENG[cd.jijiOhaeng] === weakOh;
    const suppresses = OHAENG_SANGGEUK[cd.cheonganOhaeng] === weakOh || OHAENG_SANGGEUK[cd.jijiOhaeng] === weakOh;

    if (supplies || generates) {
      currentStatus = `현재 대운(${cd.startAge}~${cd.endAge}세)에서 ${weakOh} 기운이 어느 정도 보충되고 있어 관리만 잘하면 악화를 막을 수 있는 시기입니다.`;
    } else if (suppresses) {
      currentStatus = `현재 대운(${cd.startAge}~${cd.endAge}세)에서 ${weakOh} 기운이 더 억눌리고 있어 건강 관리에 각별한 주의가 필요한 시기입니다. 적극적인 치료와 관리가 필수입니다.`;
    } else {
      currentStatus = `현재 대운(${cd.startAge}~${cd.endAge}세)은 ${weakOh} 기운에 직접적 영향이 없어 현상 유지 수준입니다. 꾸준한 관리가 핵심입니다.`;
    }
  }

  // 미래 대운들 스캔 (100세까지, 최대 6개 주요 시기)
  const MAX_AGE = 100;
  const MAX_PERIODS = 6;
  const recoveryPeriods: HealthForecast['recoveryPeriods'] = [];

  // 오행 한글 이름
  const OH_NAME: Record<Ohaeng, string> = { '목': '목(木·나무)', '화': '화(火·불)', '토': '토(土·흙)', '금': '금(金·쇠)', '수': '수(水·물)' };
  // 오행별 건강 키워드 (구체적 신체 부위)
  const OH_BODY: Record<Ohaeng, string> = {
    '목': '간·담·근육·눈',
    '화': '심장·소장·혈관·혈압',
    '토': '위장·비장·소화기',
    '금': '폐·대장·피부·호흡기',
    '수': '신장·방광·허리·귀',
  };
  // 오행별 건강 관리 팁 (짧은 버전)
  const OH_TIP: Record<Ohaeng, string> = {
    '목': '스트레칭·산림욕으로 근육과 간을 풀어주세요. 🧠 우울감 예방을 위해 규칙적 야외활동과 충분한 수면이 중요합니다',
    '화': '유산소 운동으로 심장을 강화하고 혈액순환을 도와주세요. 🧠 불안 완화를 위해 명상·요가·복식호흡이 도움됩니다',
    '토': '규칙적 식사와 소화가 잘 되는 음식 위주로 관리하세요. 🧠 걱정·강박 완화를 위해 마음 비우기 연습(저널링·산책)이 좋습니다',
    '금': '호흡 운동·수영으로 폐 기능을 챙기고 피부 보습에 신경 쓰세요. 🧠 슬픔·비관 완화를 위해 사회적 교류와 취미 활동을 유지하세요',
    '수': '족욕·반신욕으로 하체 순환을 돕고 허리 근력을 키우세요. 🧠 공포·위축 완화를 위해 작은 성취감을 쌓는 활동이 효과적입니다',
  };

  for (const pillar of daeunResult.pillars) {
    if (pillar.startAge <= daeunResult.currentAge) continue;
    if (pillar.startAge >= MAX_AGE) break;
    if (recoveryPeriods.length >= MAX_PERIODS) break;

    const ganOh = pillar.cheonganOhaeng;
    const jiOh = pillar.jijiOhaeng;
    const supplies = ganOh === weakOh || jiOh === weakOh;
    const generates = OHAENG_SANGSAENG[ganOh] === weakOh || OHAENG_SANGSAENG[jiOh] === weakOh;
    const suppresses = OHAENG_SANGGEUK[ganOh] === weakOh || OHAENG_SANGGEUK[jiOh] === weakOh;

    // 대운의 실제 오행 조합 표시
    const daeunOhDesc = ganOh === jiOh
      ? `${OH_NAME[ganOh]} 기운`
      : `${OH_NAME[ganOh]}+${OH_NAME[jiOh]} 기운`;

    let desc = '';

    // 오행별 정신건강 회복 키워드
    const OH_MENTAL_RECOVERY: Record<Ohaeng, string> = {
      '목': '우울감·무기력이 줄어들고 삶의 의욕이 되살아나며',
      '화': '불안·공황 증상이 안정되고 마음이 따뜻해지며',
      '토': '걱정·강박이 줄어들고 마음의 중심이 잡히며',
      '금': '비관적 사고가 줄고 결단력이 회복되며',
      '수': '공포·두려움이 사라지고 자신감이 되살아나며',
    };

    if (supplies && generates) {
      // 직접 보충 + 상생까지
      desc = `${pillar.cheongan}${pillar.jiji} 대운 → ${daeunOhDesc}이 들어옵니다. `
        + `부족한 ${weakOh} 기운이 직접 보충되면서 동시에 상생(生) 작용까지 받아 `
        + `${OH_BODY[weakOh]} 쪽 컨디션이 크게 호전될 수 있는 최고의 건강 시기입니다. `
        + `🧠 ${OH_MENTAL_RECOVERY[weakOh]} 정신적으로도 가장 편안한 시기입니다. `
        + `이때 적극적으로 검진·치료를 받으면 효과가 배가됩니다.`;
    } else if (supplies) {
      // 직접 보충
      const sourceGan = ganOh === weakOh;
      const sourceJi = jiOh === weakOh;
      desc = `${pillar.cheongan}${pillar.jiji} 대운 → ${daeunOhDesc}이 들어옵니다. `
        + `${sourceGan && sourceJi ? '천간·지지 모두' : sourceGan ? '천간에서' : '지지에서'} `
        + `${weakOh} 기운을 직접 보충해줘서 ${OH_BODY[weakOh]} 관련 증상이 완화될 가능성이 높습니다. `
        + `🧠 ${OH_MENTAL_RECOVERY[weakOh]} 정신적 안정감도 높아집니다. `
        + `${OH_TIP[weakOh]}.`;
    } else if (generates) {
      // 상생으로 간접 보충
      const genSource = OHAENG_SANGSAENG[ganOh] === weakOh ? ganOh : jiOh;
      desc = `${pillar.cheongan}${pillar.jiji} 대운 → ${daeunOhDesc}이 들어옵니다. `
        + `${OH_NAME[genSource]}이 ${weakOh}을(를) 생(生)해주는 상생 관계라 `
        + `간접적으로 ${OH_BODY[weakOh]} 기능이 서서히 회복됩니다. `
        + `🧠 정신적으로도 서서히 안정을 찾아가는 시기입니다. `
        + `급격한 호전보다는 꾸준히 컨디션이 나아지는 흐름이에요.`;
    } else if (suppresses) {
      // 상극으로 약화
      const suppressSource = OHAENG_SANGGEUK[ganOh] === weakOh ? ganOh : jiOh;
      desc = `${pillar.cheongan}${pillar.jiji} 대운 → ${daeunOhDesc}이 들어옵니다. `
        + `${OH_NAME[suppressSource]}이 ${weakOh}을(를) 극(克)하는 상극 관계라 `
        + `이미 약한 ${OH_BODY[weakOh]} 쪽이 더 부담을 받을 수 있습니다. `
        + `🧠 정신적으로도 스트레스·불안이 가중될 수 있으니 심리 상담이나 명상 등 정신건강 관리가 필요합니다. `
        + `이 시기 전에 미리 건강 기반을 다져놓고, 정기검진과 절제가 필수입니다.`;
    } else {
      // 직접 관계 없음 → 대운 오행이 어디에 영향을 주는지 알려줌
      const affectedOrgan = OH_BODY[ganOh] || '';
      desc = `${pillar.cheongan}${pillar.jiji} 대운 → ${daeunOhDesc}이 들어옵니다. `
        + `${weakOh} 기운에 직접적 영향은 없지만, `
        + `${ganOh !== jiOh ? `${ganOh}·${jiOh}` : ganOh} 관련 장기(${affectedOrgan}${ganOh !== jiOh ? ', ' + OH_BODY[jiOh] : ''})의 컨디션 변화에 관심을 두세요. `
        + `${weakOh} 쪽은 꾸준한 생활 관리로 현상 유지하는 것이 핵심입니다.`;
    }

    const level = (supplies || generates) ? 'good' : suppresses ? 'bad' : 'neutral';
    recoveryPeriods.push({
      period: `${pillar.startAge}~${pillar.endAge}세`,
      description: desc,
      level,
    });
  }

  const goodPeriods = recoveryPeriods.filter(p => p.level === 'good');
  let overallAdvice = '';
  if (goodPeriods.length > 0) {
    const firstGood = goodPeriods[0];
    overallAdvice = goodPeriods.length === 1
      ? `💡 희망적 소식: ${firstGood.period} 시기에 ${weakOh} 기운이 보충됩니다. `
      : `💡 희망적 소식: ${goodPeriods.map(p => p.period).join(', ')} 등 총 ${goodPeriods.length}번의 호전 기회가 있습니다. `;
    overallAdvice += '지금부터 건강 기반을 잘 관리해두면 호전의 기회를 최대한 활용할 수 있습니다. ';
    overallAdvice += '타고난 체질은 바꿀 수 없지만, 대운의 흐름을 타면 증상이 크게 완화될 수 있습니다.';
  } else {
    overallAdvice = `향후 대운에서 ${weakOh} 기운이 직접 보충되는 시기가 없어, 인위적인 보충이 더욱 중요합니다. `;
    if (weakOh === '목') overallAdvice += '🍋 신맛 음식(식초, 레몬, 매실, 유자, 감귤류, 오미자)을 식단에 더하고, 🎨 청색(푸른색) 옷·소품을 활용하세요. 동쪽 방향, 산림욕, 녹색 식물이 목 기운을 꾸준히 보충합니다.';
    else if (weakOh === '화') overallAdvice += '☕ 쓴맛 음식(쑥, 더덕, 도라지, 씀바귀, 고들빼기, 여주, 다크초콜릿)과 따뜻한 차(영지버섯차, 홍차, 칡차, 쑥차)를 식단에 더하세요. 🍅 붉은색 식재료(토마토, 팥, 대추, 구기자, 석류, 비트)도 좋습니다. 🎨 적색(붉은색) 밝은 옷을 챙겨 입고, 남쪽 방향, 따뜻한 환경, 규칙적 유산소 운동이 화 기운을 보충합니다.';
    else if (weakOh === '토') overallAdvice += '🍯 단맛 음식(꿀, 고구마, 호박, 대추, 밤, 잣, 찹쌀, 감, 바나나)을 식단에 더하고, 🎨 황색(노란색) 소품을 활용하세요. 규칙적 식사가 가장 중요하며, 잡곡밥이 토 기운을 보충합니다.';
    else if (weakOh === '금') overallAdvice += '🌶️ 매운맛 음식(고추, 생강, 마늘, 양파, 겨자, 후추, 부추, 파)을 조금씩 식단에 더하고, 🎨 백색(흰색) 옷·금속 소품(시계, 반지)을 활용하세요. 서쪽 방향, 깊은 호흡 운동이 금 기운을 보충합니다.';
    else if (weakOh === '수') overallAdvice += '🧂 짠맛 음식(미역, 다시마, 김, 해조류, 된장, 검은콩, 흑미, 흑임자)을 식단에 더하고, 🎨 흑색(검은색) 옷·소품을 가까이 두세요. 북쪽 방향, 수영·족욕이 수 기운을 보충합니다.';
  }

  return { cause, currentStatus, recoveryPeriods, overallAdvice };
}

// ========== 성중유패 / 패중유성 (格局 전환) 분석 ==========

export interface GyeokgukTransition {
  type: '성중유패' | '패중유성' | '안정';
  title: string;
  emoji: string;
  easyExplanation: string;
  advice: string;
}

/**
 * 성중유패/패중유성 분석
 * 원국(사주)의 강약 + 대운의 오행 상호작용으로 격국 전환 판단
 *
 * - 성중유패: 좋은 원국인데 대운이 나를 극(克)하거나 용신을 합거 → 실패 위험
 * - 패중유성: 약한 원국인데 대운이 나를 생(生)하거나 부족한 것 보완 → 성공 기회
 */
export function analyzeGyeokgukTransition(
  saju: SajuResult,
  daeunGanOhaeng: Ohaeng,
  daeunJiOhaeng: Ohaeng,
  daeunScore: number,
): GyeokgukTransition {
  const ilOhaeng = CHEONGAN_OHAENG[saju.ilgan];

  // 대운이 나를 극하는가?
  const ilBalG = saju.ohaengBalance?.[ilOhaeng];
  const ganRelation = analyzeOhaengInteraction(daeunGanOhaeng, ilOhaeng, '대운', '나', ilBalG);
  const isGukA = ganRelation.relation === '극아';
  const isSaengA = ganRelation.relation === '생아' || ganRelation.relation === '비화';

  // 원국 균형도 간이 판단 (십신 과다/부재)
  const hasExcess = saju.sipseongBalance.excess.length > 0;
  const hasLacking = saju.sipseongBalance.lacking.length > 0;
  const isWeakWonguk = hasLacking && !hasExcess; // 부족한 것만 있으면 약한 원국
  const isStrongWonguk = hasExcess && !hasLacking; // 과다한 것만 있으면 강한 원국

  // 성중유패: 강한 원국 + 대운이 극
  if (isStrongWonguk && isGukA && daeunScore <= 4) {
    return {
      type: '성중유패',
      title: '조심! 좋은 기운이 흔들리는 시기',
      emoji: '⚠️',
      easyExplanation:
        `원래 사주가 꽤 좋은 편인데, 이 대운에서 방해하는 기운이 들어와요.\n\n` +
        `쉽게 말하면, 시험 잘 보는 학생인데 갑자기 감기에 걸린 것과 비슷해요. ` +
        `실력은 있으니까 너무 걱정하지 말되, 이 시기에는 무리하지 않는 게 중요해요!\n\n` +
        `마치 바둑에서 잘 두다가 한 수를 실수하면 판이 뒤집히듯, ` +
        `이 시기에는 큰 모험보다 안전한 선택이 현명해요.`,
      advice:
        `🛡️ 이 시기를 잘 넘기는 법:\n` +
        `• 큰 투자나 이직은 미뤄주세요\n` +
        `• 건강 관리에 특별히 신경 쓰세요\n` +
        `• 주변 사람들과의 관계를 소중히 하세요\n` +
        `• 실력을 유지하면서 다음 좋은 운을 기다리세요\n` +
        `• 이 시기가 지나면 다시 빛날 수 있어요!`,
    };
  }

  // 패중유성: 약한 원국 + 대운이 생해줌
  if (isWeakWonguk && isSaengA && daeunScore >= 7) {
    return {
      type: '패중유성',
      title: '대역전! 약점이 강점으로 바뀌는 시기',
      emoji: '🌟',
      easyExplanation:
        `원래 사주에 부족한 부분이 있었는데, 이 대운에서 딱 필요한 기운이 들어와요!\n\n` +
        `쉽게 말하면, 수학이 약했던 학생이 최고의 과외 선생님을 만난 것과 같아요. ` +
        `원래 약했던 부분이 오히려 강점으로 바뀌면서 인생이 확 달라지는 시기예요!\n\n` +
        `이때야말로 과감하게 도전할 때예요. 그동안 못했던 것들을 시작해보세요!`,
      advice:
        `🚀 이 기회를 잡는 법:\n` +
        `• 새로운 도전을 두려워하지 마세요!\n` +
        `• 부족했던 분야의 공부나 자격증에 도전하세요\n` +
        `• 좋은 인연(멘토, 파트너)이 나타나면 놓치지 마세요\n` +
        `• 이 대운의 기운을 최대한 활용해서 기반을 다져놓으세요\n` +
        `• 인생의 터닝포인트가 될 수 있어요!`,
    };
  }

  // 안정
  return {
    type: '안정',
    title: '꾸준히 가는 안정적인 흐름',
    emoji: '🌈',
    easyExplanation:
      `큰 변동 없이 안정적인 흐름이에요. ` +
      `급격한 변화보다는 꾸준히 실력을 쌓고 기반을 다지는 시기예요.\n\n` +
      `마치 씨앗을 심고 물을 주며 기다리는 것처럼, ` +
      `지금 하는 노력이 나중에 큰 열매로 돌아올 거예요!`,
    advice:
      `🌱 이 시기에 할 일:\n` +
      `• 꾸준히 자기 계발에 투자하세요\n` +
      `• 건강한 습관을 만들어가세요\n` +
      `• 인간관계를 넓혀두세요\n` +
      `• 다음 기회를 위한 준비를 차곡차곡!`,
  };
}

/**
 * 5년 세운 예측
 */
export function calculateFiveYearSeun(saju: SajuResult, startYear: number, currentDaeun?: DaeunPillar | null): SeunResult[] {
  const results: SeunResult[] = [];
  for (let i = 0; i < 5; i++) {
    results.push(calculateSeun(saju, startYear + i, currentDaeun));
  }
  return results;
}

// ========== 월별 운세 (月運) ==========

export interface MonthlyFortune {
  month: number; // 1~12
  cheongan: string;
  jiji: string;
  ohaengGan: Ohaeng;
  ohaengJi: Ohaeng;
  twelveStage: TwelveStage;
  score: number; // 1~10
  stars: number; // 1~5
  sipseong: string; // 월운 천간의 십성
  title: string;
  description: string;
  love: string;
  money: string;
  career: string;
  health: string;
  lucky: string; // 행운 포인트
}

/**
 * 월주 천간 계산: 연간(세운 천간)으로부터 각 월의 천간을 구함
 * 갑/기년 → 병인월 시작, 을/경년 → 무인월 시작, 등등 (오호연원법)
 */
function getMonthlyCheongan(yearGan: string, monthIdx: number): string {
  // 오호연원법: 연간에 따른 1월(인월) 시작 천간
  const START_GAN_MAP: Record<string, number> = {
    '갑': 2, '기': 2, // 병인
    '을': 4, '경': 4, // 무인
    '병': 6, '신': 6, // 경인
    '정': 8, '임': 8, // 임인
    '무': 0, '계': 0, // 갑인
  };
  const startIdx = START_GAN_MAP[yearGan] ?? 0;
  return CHEONGAN[(startIdx + monthIdx - 1) % 10];
}

/** 월별 지지: 1월=인, 2월=묘, ... 12월=축 */
const MONTH_JIJI = ['인', '묘', '진', '사', '오', '미', '신', '유', '술', '해', '자', '축'];

/**
 * 올해 12개월 월별 운세 계산
 */
export function calculateMonthlyFortunes(
  saju: SajuResult,
  targetYear: number,
): MonthlyFortune[] {
  // 해당 연도의 세운 천간 구하기
  const yearGanIdx = (targetYear - 4) % 10;
  const yearGan = CHEONGAN[(yearGanIdx + 10) % 10];

  const results: MonthlyFortune[] = [];

  for (let m = 1; m <= 12; m++) {
    const gan = getMonthlyCheongan(yearGan, m);
    const ji = MONTH_JIJI[m - 1];
    const ohaengGan = CHEONGAN_OHAENG[gan];
    const ohaengJi = JIJI_OHAENG[ji];
    const twelveStage = calculateTwelveStage(saju.ilgan, ji);
    const stageData = TWELVE_STAGE_DATA[twelveStage];
    const sipseong = calculateSipseong(saju.ilgan, gan);

    // 점수 계산
    let score = stageData.energy;

    // 십성 보정
    const SIPSEONG_MOD: Record<string, number> = {
      '비견': 0, '겁재': -1, '식신': +2, '상관': +1,
      '편재': +1, '정재': +2, '편관': -2, '정관': +1,
      '편인': 0, '정인': +2,
    };
    let sipMod = SIPSEONG_MOD[sipseong] || 0;
    if (sipMod > 0 && ohaengGan === saju.gisin) sipMod = 0;
    if (sipMod < 0 && ohaengGan === saju.yongsin) sipMod = Math.ceil(sipMod / 2);
    score += sipMod;

    // 용신/기신
    const isYongGan = ohaengGan === saju.yongsin;
    const isYongJi = ohaengJi === saju.yongsin;
    const isGisinGan = ohaengGan === saju.gisin;
    const isGisinJi = ohaengJi === saju.gisin;
    if (isYongGan && isYongJi) score += 3;
    else if (isYongGan || isYongJi) score += 2;
    if (isGisinGan && isGisinJi) score -= 4;
    else if (isGisinGan || isGisinJi) score -= 2;

    // 편관 상한
    if (sipseong === '편관') score = Math.min(7, score);
    if (isGisinGan && isGisinJi) score = Math.min(5, score);
    else if (isGisinGan || isGisinJi) score = Math.min(7, score);

    score = Math.max(1, Math.min(10, score));
    const stars = Math.max(1, Math.min(5, Math.round(score / 2)));

    // 타이틀 & 설명 생성
    const yongsinHit = isYongGan || isYongJi;
    const gisinHit = isGisinGan || isGisinJi;
    const isGwansal = sipseong === '편관';
    const isGilsin = ['식신', '정재', '정인', '정관'].includes(sipseong);

    let title: string;
    let desc: string;

    if (isGisinGan && isGisinJi) {
      title = '주의가 필요한 달';
      desc = `${gan}${ji}월 — ${sipseong}의 기운과 기신이 겹쳐 컨디션이 떨어지기 쉽습니다. 큰 결정이나 모험은 피하고, 건강 관리와 안정에 집중하세요.`;
    } else if (isGwansal && gisinHit) {
      title = '압박과 시련의 달';
      desc = `${gan}${ji}월 — ${sipseong}의 압박 기운이 강합니다. 직장이나 학교에서 스트레스가 클 수 있으니 감정 관리가 중요합니다. 무리한 야근이나 과로는 피하세요.`;
    } else if (yongsinHit && isGilsin) {
      title = '최고의 기회가 오는 달!';
      desc = `${gan}${ji}월 — ${sipseong}의 길한 에너지와 용신이 함께하여 무엇을 해도 잘 풀리는 달입니다! 중요한 계획이나 결정은 이 달에 실행하세요.`;
    } else if (yongsinHit) {
      title = '행운이 함께하는 달';
      desc = `${gan}${ji}월 — 용신(${saju.yongsin})의 기운이 들어와 전반적으로 순조롭습니다. 새로운 시작이나 도전에 유리한 시기입니다.`;
    } else if (isGwansal) {
      title = '긴장과 도전의 달';
      desc = `${gan}${ji}월 — ${sipseong}의 기운이 외부 압박을 가져옵니다. 시험, 평가, 경쟁에서 긴장감이 높지만 잘 넘기면 성장의 기회가 됩니다.`;
    } else if (gisinHit) {
      title = '조심하며 보내는 달';
      desc = `${gan}${ji}월 — 기신(${saju.gisin})의 기운이 있어 예상치 못한 방해가 생길 수 있습니다. 중요한 일은 다른 달로 미루는 것이 좋습니다.`;
    } else if (isGilsin) {
      title = '안정적이고 순조로운 달';
      desc = `${gan}${ji}월 — ${sipseong}의 안정적 에너지가 흐르는 달입니다. 평소 하던 일에서 성과가 나오고, 사람 관계도 원만합니다.`;
    } else {
      title = score >= 6 ? '무난하게 흘러가는 달' : '조용히 내실을 다지는 달';
      desc = score >= 6
        ? `${gan}${ji}월 — 특별한 변동 없이 안정적으로 흘러가는 달입니다. 꾸준함이 빛을 발합니다.`
        : `${gan}${ji}월 — 조용히 에너지를 비축하며 다음 기회를 준비하는 달입니다. 무리하지 마세요.`;
    }

    // 분야별 간단 운세
    const love = generateMonthLove(saju, sipseong, score, yongsinHit, gisinHit);
    const money = generateMonthMoney(saju, sipseong, score, yongsinHit, gisinHit);
    const career = generateMonthCareer(saju, sipseong, score, yongsinHit, gisinHit);
    const health = generateMonthHealth(saju, ohaengGan, ohaengJi, score);
    const lucky = generateMonthLucky(ohaengGan, ohaengJi, m);

    results.push({
      month: m, cheongan: gan, jiji: ji,
      ohaengGan, ohaengJi, twelveStage,
      score, stars, sipseong, title, description: desc,
      love, money, career, health, lucky,
    });
  }

  return results;
}

function generateMonthLove(saju: SajuResult, sipseong: string, score: number, yongsin: boolean, gisin: boolean): string {
  const isMarried = saju.relationship === 'married';
  if (yongsin && score >= 7) {
    return isMarried ? '배우자와의 관계가 따뜻해지는 달. 함께하는 시간을 늘려보세요.' : '새로운 인연을 만날 확률이 높은 달! 적극적으로 나서보세요.';
  }
  if (gisin || score <= 3) {
    return isMarried ? '사소한 다툼이 생기기 쉽습니다. 양보와 대화가 약입니다.' : '감정 기복이 있을 수 있으니, 충동적인 고백이나 결정은 피하세요.';
  }
  if (['편재', '정재'].includes(sipseong)) {
    return isMarried ? '가정에 작은 기쁨이 찾아올 수 있습니다.' : '이성에 대한 관심이 높아지는 달. 자연스러운 만남이 좋습니다.';
  }
  return isMarried ? '평온한 가정 분위기. 특별한 일은 없지만 안정적입니다.' : '급한 인연보다 자연스러운 만남에 집중하세요.';
}

function generateMonthMoney(saju: SajuResult, sipseong: string, score: number, yongsin: boolean, gisin: boolean): string {
  if (yongsin && score >= 7) return '재물운이 상승하는 달! 투자나 저축 계획을 실행하기에 좋습니다.';
  if (gisin && score <= 3) return '예상치 못한 지출이 생길 수 있습니다. 큰 구매는 자제하세요.';
  if (['편재', '정재'].includes(sipseong)) return '돈이 들어오는 기운이 있습니다. 부수입이나 보너스 가능성이 있어요.';
  if (['상관', '겁재'].includes(sipseong)) return '지출이 늘어나기 쉬운 달. 충동구매를 조심하세요.';
  return score >= 6 ? '안정적인 재정 상태. 계획적으로 쓰면 무리 없습니다.' : '절약 모드가 필요한 달. 불필요한 지출을 줄이세요.';
}

function generateMonthCareer(saju: SajuResult, sipseong: string, score: number, yongsin: boolean, gisin: boolean): string {
  if (yongsin && score >= 7) return '직장/학업에서 인정받을 기회! 프로젝트나 시험에서 좋은 성과가 기대됩니다.';
  if (sipseong === '편관') return '상사나 선생님과의 관계에 긴장감이 있을 수 있습니다. 겸손하게 처신하세요.';
  if (gisin && score <= 3) return '업무 실수나 갈등에 주의. 중요한 보고서는 한 번 더 검토하세요.';
  if (['식신', '상관'].includes(sipseong)) return '창의적 아이디어가 떠오르는 달. 새로운 기획이나 제안에 도전해보세요.';
  if (['정관', '정인'].includes(sipseong)) return '학업/자격증 공부에 유리한 달. 집중력이 높아집니다.';
  return score >= 6 ? '꾸준히 하던 일에서 성과가 보이는 달.' : '큰 변화보다 현상 유지에 집중하세요.';
}

function generateMonthHealth(saju: SajuResult, ganOh: Ohaeng, jiOh: Ohaeng, score: number): string {
  const weak = saju.weakestOhaeng as Ohaeng | undefined;
  const ORGAN_MAP: Record<string, string> = { '목': '간/눈', '화': '심장/혈압', '토': '위장/소화', '금': '폐/호흡기', '수': '신장/허리' };
  if (weak && (ganOh === weak || jiOh === weak)) {
    return `${ORGAN_MAP[weak] || weak} 관련 건강에 주의하세요. 과로를 피하고 충분한 수면을 챙기세요.`;
  }
  if (score <= 3) return '전반적으로 컨디션이 떨어지기 쉬운 달. 무리하지 말고 일찍 쉬세요.';
  if (score >= 8) return '에너지가 넘치는 달! 운동이나 야외 활동을 즐기기에 좋습니다.';
  return '건강은 무난합니다. 규칙적인 생활 리듬을 유지하세요.';
}

function generateMonthLucky(ganOh: Ohaeng, jiOh: Ohaeng, month: number): string {
  const COLOR_MAP: Record<string, string> = { '목': '초록색/청색', '화': '빨간색/분홍색', '토': '노란색/베이지', '금': '흰색/은색', '수': '검은색/남색' };
  const DIR_MAP: Record<string, string> = { '목': '동쪽', '화': '남쪽', '토': '중앙', '금': '서쪽', '수': '북쪽' };
  const NUM_MAP: Record<string, string> = { '목': '3, 8', '화': '2, 7', '토': '5, 10', '금': '4, 9', '수': '1, 6' };
  return `행운 색상: ${COLOR_MAP[ganOh] || '?'} | 행운 방향: ${DIR_MAP[jiOh] || '?'} | 행운 숫자: ${NUM_MAP[ganOh] || '?'}`;
}
