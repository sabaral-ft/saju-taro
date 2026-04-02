/**
 * 인생 예측 엔진
 * 사주 기반으로 적합 직업, 결혼운 시기, 재물운 시기, 인생 주요 이벤트 예측
 */

import { CHEONGAN, JIJI, CHEONGAN_OHAENG, JIJI_OHAENG, OHAENG_SANGSAENG, OHAENG_SANGGEUK, calculateSipseong, JIJI_JANGGAN } from './saju-engine';
import type { Ohaeng, SajuResult, Sipseong } from './saju-engine';
import { calculateTwelveStage, TWELVE_STAGE_DATA } from './twelve-stages';
import type { TwelveStage } from './twelve-stages';
import { extractSajuContext, WEAK_OHAENG_ORGAN, RECOMMEND_ENV, adjustTextByChildren } from './saju-context-filter';
import { determineGyeokguk, determineJohu, classifyHeegishin, simulateBalanceChange, analyzeGanJiRelation, analyzeJangganDeep, analyzeCheonganHapResult, analyzeWonGukHapChungChange, checkGongmang, get12StageContextMod, analyzePillarRelations, analyzeLifePhaseContext, analyzeCheonganChung, analyzeAmhap, analyzeAdvancedSinsal, checkTuhap, analyzeGongmangDetail, analyzeHapResolution, analyzeFamilyRelations } from './daeun';
import { analyzeHapChung } from './hapchung';
import { JIJI_YUKHAP, JIJI_CHUNG } from './saju-interactions';

// ========== 신강/신약 범용 텍스트 치환 함수 ==========
// 오행별 관련 업종/직업 키워드 사전
const OHAENG_JOB_KEYWORDS: Record<Ohaeng, string[]> = {
  '목': ['교육', '출판', '의류', '가구', '인테리어', '조경', '농림', '환경', '목재', '종이', '섬유'],
  '화': ['연예', '방송', '광고', '미디어', '에너지', '전기', '조명', '뷰티', '화장품', '요리', '외식', '카페'],
  '토': ['부동산', '건설', '농업', '식품', '중개', '행정', '토목', '토지', '도자기', '광업', '창고'],
  '금': ['금융', '법률', '군경', '보석', '귀금속', '기계', '자동차', '금속', '제조', '철강'],
  '수': ['무역', '해운', '수산', '물류', '해외', '음료', '세탁', '수영', '여행', '운송'],
};

const OHAENG_HANJA: Record<Ohaeng, string> = { '목': '木', '화': '火', '토': '土', '금': '金', '수': '水' };

/**
 * 신강/신약 강도에 따라 텍스트 안의 오행 관련 키워드를 자동 처리
 *
 * @param ilOhBal - 일간 오행 밸런스 값
 * @returns 'full' | 'partial' | 'none'
 *   - full (극신강 ≥6, 극신약 ≤1.5): 일간 오행 키워드 → 용신 오행 키워드로 완전 교체
 *   - partial (신강 4.5~5.9, 신약 1.6~2.5): 원문 유지 + 용신 보충 메모 추가
 *   - none (중립 2.6~4.4): 아무 처리 안 함
 */
function getSingangStrength(ilOhBal: number): 'full' | 'partial' | 'none' {
  if (ilOhBal >= 6 || ilOhBal <= 1.5) return 'full';
  if (ilOhBal >= 4.5 || ilOhBal <= 2.5) return 'partial';
  return 'none';
}

/**
 * 텍스트 안의 "일간 오행 관련 업종" 키워드를 신강/신약 강도에 따라 자동 처리
 *
 * - full: "부동산이나 투자" → "금융이나 투자" (완전 교체)
 * - partial: 원문 그대로 유지 (fitScore 보정과 ohaengAptitude에서 용신 보충이 됨)
 * - none: 아무것도 안 함
 *
 * 한국어 조사(이나, 에서, 을, 를, 과, 와, 이 등) 자동 처리
 * 경고 맥락(오히려, 역효과, 과다, 넘치므로, 보다)이면 교체하지 않음
 */
function replaceOhaengKeywords(
  text: string,
  ilOhaeng: Ohaeng,
  yongsin: Ohaeng,
  strength: 'full' | 'partial' | 'none',
): string {
  if (strength === 'none') return text;
  if (strength === 'partial') return text; // partial은 텍스트는 유지, fitScore로만 보정

  // --- full: 키워드 완전 교체 ---
  const removeKeywords = OHAENG_JOB_KEYWORDS[ilOhaeng] || [];
  const yongsinKeywords = OHAENG_JOB_KEYWORDS[yongsin] || [];
  const yongsinFirst = yongsinKeywords[0] || '용신 관련 분야';

  // 한국어 조사 패턴 (키워드 뒤에 붙는 조사들)
  const josaPattern = '(?:이나|에서|으로|과|와|을|를|이|도|의|는|은|,|·|\\s)*';

  for (const keyword of removeKeywords) {
    // 문장 단위로 처리: 경고 맥락이 아닌 문장에서만 교체
    text = text.replace(new RegExp(`([^.]*?)(${keyword})(${josaPattern})([^.]*?\\.?)`, 'g'), (match, before, kw, josa, after) => {
      // 경고/부정적 맥락이면 그대로 유지
      if (/보다|오히려|역효과|과다|넘치므로|피하|불리|감점/.test(before + after)) {
        return match;
      }
      // 긍정적 맥락이면 용신 관련 단어로 교체
      return before + yongsinFirst + josa + after;
    });
  }

  // 정리: 연속 콤마, 빈 괄호 등 클린업
  text = text.replace(/,\s*,/g, ',');
  text = text.replace(/,\s*\)/g, ')');
  text = text.replace(/\(\s*,\s*/g, '(');
  text = text.replace(/\(\s*\)/g, '');

  return text;
}

/**
 * fitScore 보정값 계산 — 신강/신약 강도에 따라 단계적으로 적용
 * @returns { ilOhPenalty, yongsinBonus } — 일간 오행 카테고리 감점, 용신 카테고리 가점
 */
function getSingangScoreAdj(strength: 'full' | 'partial' | 'none'): { ilOhPenalty: number; yongsinBonus: number } {
  if (strength === 'full') return { ilOhPenalty: -4, yongsinBonus: 3 };
  if (strength === 'partial') return { ilOhPenalty: -2, yongsinBonus: 1 };
  return { ilOhPenalty: 0, yongsinBonus: 0 };
}

// ========== 적합 직업 분석 ==========

interface CareerRecommendation {
  category: string;
  jobs: string[];
  reason: string;
  fitScore: number; // 1~10
}

/** 일간(천간) 10개별 기본 직업 적성 — 같은 오행이라도 양/음에 따라 다르게 */
const ILGAN_CAREER_BASE: Record<string, { traits: string; categories: CareerRecommendation[] }> = {
  '갑': {
    traits: '큰 나무처럼 곧은 성품의 리더. 새 조직을 만들고, 사람을 이끌고, 개척하는 일에 타고났습니다. 명분과 정의를 중시하며, 남 밑에서 일하기보다 자기 사업이나 팀장/대표 역할이 맞습니다.',
    categories: [
      { category: '경영/창업', jobs: ['스타트업 대표', 'CEO', '프랜차이즈 오너', '사업 기획'], reason: '갑목은 "처음 시작하는 나무"라 개척과 리더십이 천직입니다.', fitScore: 9 },
      { category: '교육/멘토링', jobs: ['교장', '학원장', '기업 교육 총괄', '코칭 전문가'], reason: '사람을 키우는 것이 갑목의 본성입니다. 가르치면서 성장합니다.', fitScore: 8 },
      { category: '기획/전략', jobs: ['전략 기획', 'PM', '신사업 개발', '벤처 캐피탈'], reason: '큰 그림을 보는 능력이 뛰어나 전략적 포지션에서 빛납니다.', fitScore: 8 },
      { category: '환경/농림', jobs: ['조경업', '산림청', '친환경 사업', '목재 관련업'], reason: '나무의 기운과 직접 연결되어 자연 관련 분야에서 감각이 뛰어납니다.', fitScore: 7 },
      { category: '법률/정치', jobs: ['정치인', '시민단체 대표', '변호사', '노무사'], reason: '정의감과 명분을 추구하는 성향이 사회적 리더십 역할과 맞습니다.', fitScore: 7 },
    ],
  },
  '을': {
    traits: '풀이나 덩굴처럼 유연한 적응력의 소유자. 사람의 마음을 읽는 감각이 뛰어나고, 미적 센스가 탁월합니다. 경쟁보다 협력, 독재보다 조율에 강합니다.',
    categories: [
      { category: '예술/디자인', jobs: ['패션 디자이너', '플로리스트', '인테리어 코디', '일러스트레이터'], reason: '을목의 부드러운 미적 감각이 디자인 분야에서 빛을 발합니다.', fitScore: 9 },
      { category: '상담/서비스', jobs: ['상담사', '사회복지사', '미용사', '네일아트', '피부 관리'], reason: '사람의 마음을 잘 읽고 달래는 을목의 특성이 돌봄 직종에 맞습니다.', fitScore: 8 },
      { category: '마케팅/커뮤니케이션', jobs: ['SNS 마케터', 'PR 전문가', '카피라이터', '브랜드 매니저'], reason: '유연한 소통 능력과 트렌드 감각이 마케팅의 핵심 역량입니다.', fitScore: 8 },
      { category: '의류/패션', jobs: ['스타일리스트', '패션 MD', '의류 사업', '섬유 무역'], reason: '을목은 섬유·옷감과 직접 연관되어 패션에 천부적 감각이 있습니다.', fitScore: 8 },
      { category: '교육/코칭', jobs: ['유치원 교사', '심리 코치', '요가 강사', '힐링 캠프 운영'], reason: '부드럽게 이끄는 을목의 방식이 교육·힐링 분야에 적합합니다.', fitScore: 7 },
    ],
  },
  '병': {
    traits: '태양처럼 밝고 화려한 존재감. 무대 위, 카메라 앞, 사람들 시선이 집중되는 곳에서 에너지가 폭발합니다. 주목받아야 실력이 나오는 타입입니다.',
    categories: [
      { category: '연예/방송', jobs: ['연기자', '가수', 'MC', '유튜버', '인플루언서'], reason: '태양(병화)은 모든 사람의 시선을 끄는 힘이 있습니다. 무대체질!', fitScore: 9 },
      { category: '마케팅/광고', jobs: ['광고 크리에이티브', '브랜딩 전문가', '이벤트 기획', '홍보 대행'], reason: '화려하고 임팩트 있는 병화의 기운이 광고 분야를 빛냅니다.', fitScore: 8 },
      { category: '외식/요리', jobs: ['스타 셰프', '레스토랑 오너', '푸드 스타일리스트', '카페 운영'], reason: '불(화)과 직접 연관된 요리에서 빛나며, 접객 능력도 탁월합니다.', fitScore: 8 },
      { category: '에너지/전기', jobs: ['태양광 사업', '전기 엔지니어', '반도체', '조명 디자이너'], reason: '태양·빛·전기와 연관된 기술 분야에서 자연스럽게 성과를 냅니다.', fitScore: 7 },
      { category: '정치/리더십', jobs: ['정치인', '대중 연설가', '사회 운동가', 'NGO 대표'], reason: '카리스마와 대중을 끄는 힘이 정치·사회 리더십에 적합합니다.', fitScore: 7 },
    ],
  },
  '정': {
    traits: '촛불처럼 섬세하고 깊은 내면의 빛. 무대 위보다 작업실에서 빛나는 타입. 집중력과 디테일 감각이 탁월하고, 학문·예술에서 깊이 있는 성과를 냅니다.',
    categories: [
      { category: '학문/연구', jobs: ['연구원', '교수', '학자', '도서관 사서', '큐레이터'], reason: '정화는 촛불의 집중력—한 분야를 깊이 파고드는 능력이 탁월합니다.', fitScore: 9 },
      { category: '예술/창작', jobs: ['작가', '화가', '공예가', '사진작가', '영상 편집'], reason: '섬세한 감성과 표현력이 순수 예술 분야에서 빛을 발합니다.', fitScore: 9 },
      { category: '의료/치유', jobs: ['한의사', '심리상담사', '명상 지도사', '아로마테라피스트'], reason: '따뜻한 치유의 빛(정화)이 사람의 마음과 몸을 돌보는 일에 맞습니다.', fitScore: 8 },
      { category: 'IT/데이터', jobs: ['UX 디자이너', '데이터 분석가', '프론트엔드 개발', '앱 디자인'], reason: '디테일에 강한 정화가 사용자 경험 설계에서 차별화됩니다.', fitScore: 7 },
      { category: '교육/강의', jobs: ['과외 교사', '온라인 강사', '에디터', '번역가'], reason: '깊이 있는 지식을 쉽게 풀어내는 능력이 교육에서 강점입니다.', fitScore: 7 },
    ],
  },
  '무': {
    traits: '큰 산처럼 듬직하고 믿음직한 존재. 중심을 잡고 조직을 안정시키는 능력이 탁월합니다. 부동산·토지와 인연이 깊고, 한 자리에서 오래 버티며 성과를 쌓는 대기만성형입니다. 책임감이 강하고 맡은 일은 끝까지 해내는 뚝심이 있습니다.',
    categories: [
      { category: '부동산/건설', jobs: ['부동산 중개', '건설 PM', '건축가', '토목 엔지니어', '인테리어 사업'], reason: '큰 산(무토)은 토지와 건물의 기운 그 자체! 부동산 감각이 천부적입니다.', fitScore: 9 },
      { category: '경영/관리', jobs: ['CEO', '총무 이사', '인사 관리', '운영 총괄', '물류 관리'], reason: '조직의 중심을 잡는 무토의 안정감이 경영·관리직에서 빛납니다.', fitScore: 8 },
      { category: '공무원/공기업', jobs: ['5급 사무관', '공기업 관리직', '지방자치단체', '국토교통부'], reason: '안정과 신뢰를 중시하는 무토가 공직에서 장기 성과를 냅니다.', fitScore: 8 },
      { category: '농업/식품', jobs: ['농장 경영', '식품 제조', '외식 프랜차이즈', '유기농 사업'], reason: '대지에서 키우고 수확하는 일이 무토의 기운과 완벽하게 맞습니다.', fitScore: 7 },
      { category: '금융/보험', jobs: ['보험 설계사', '재무 설계', '은행 지점장', '감정평가사'], reason: '신뢰를 기반으로 하는 금융업에서 무토의 든든함이 강점입니다.', fitScore: 7 },
    ],
  },
  '기': {
    traits: '기름진 밭처럼 온화하고 수용적인 성격. 뒤에서 묵묵히 돌보고 가꾸는 스타일. 치밀하고 실용적이며, 남을 키우거나 서비스하는 일에서 큰 성과를 냅니다.',
    categories: [
      { category: '서비스/케어', jobs: ['간호사', '사회복지사', '돌봄 서비스', '보육 교사', '요양 관리'], reason: '기토는 "키우는 밭"—사람을 돌보고 키우는 일이 천직입니다.', fitScore: 9 },
      { category: '식품/외식', jobs: ['제과제빵', '식품 연구원', '영양사', '건강식품 사업'], reason: '기토는 곡식을 키우는 땅이라 식품·음식과 깊은 인연이 있습니다.', fitScore: 8 },
      { category: '행정/사무', jobs: ['비서', '경리', '사무 관리', '총무', '회계 담당'], reason: '꼼꼼하고 실수 없는 기토의 성향이 사무 관리에서 빛납니다.', fitScore: 8 },
      { category: '부동산/임대', jobs: ['임대 사업', '민박/펜션 운영', '셰어하우스 관리', '토지 관리'], reason: '밭(기토)은 토지를 가꾸는 기운이라 임대·관리업에 적합합니다.', fitScore: 7 },
      { category: '교육/양육', jobs: ['초등 교사', '유아교육', '방과후 교사', '아동 심리'], reason: '온화하게 이끄는 기토의 방식이 아이들 교육에 잘 맞습니다.', fitScore: 7 },
    ],
  },
  '경': {
    traits: '강철 같은 결단력과 의리. 칼처럼 날카로운 판단력으로 옳고 그름을 구분합니다. 조직의 실행자, 개혁가, 전사 타입. 권력과 정의를 동시에 추구합니다.',
    categories: [
      { category: '법률/군경', jobs: ['검사', '경찰 간부', '군 장교', '교도관', '국정원'], reason: '경금은 칼과 같아서 정의를 실현하고 규율을 잡는 일이 천직입니다.', fitScore: 9 },
      { category: '금융/투자', jobs: ['펀드매니저', '트레이더', 'M&A 전문가', 'VC 심사역'], reason: '날카로운 분석력과 과감한 결단력이 금융 투자에서 빛납니다.', fitScore: 8 },
      { category: '의료/외과', jobs: ['외과의', '정형외과', '치과의사', '수의사', '응급 구조사'], reason: '칼(경금)을 다루는 직업—외과 수술에 적합한 담력과 정밀함이 있습니다.', fitScore: 8 },
      { category: '제조/엔지니어링', jobs: ['기계 엔지니어', '자동차 정비', '금속 가공', '무기 개발'], reason: '금속(경금)과 직접 연관된 기계·제조 분야에서 전문성을 발휘합니다.', fitScore: 8 },
      { category: '스포츠/무술', jobs: ['격투기 선수', '스포츠 트레이너', '헬스장 운영', '경호원'], reason: '강인한 체력과 투지가 스포츠·격투 분야에서 빛을 발합니다.', fitScore: 7 },
    ],
  },
  '신': {
    traits: '보석처럼 빛나고 섬세한 완벽주의자. 아름다움과 정확함을 추구하며, 예리한 감각으로 차별화된 성과를 냅니다. "양보다 질"을 추구하는 전문가 타입입니다.',
    categories: [
      { category: '보석/귀금속', jobs: ['주얼리 디자이너', '보석 감정사', '시계 전문가', '귀금속 사업'], reason: '신금은 보석 그 자체! 보석·귀금속 분야에서 천부적 감각이 있습니다.', fitScore: 9 },
      { category: '뷰티/패션', jobs: ['뷰티 전문가', '헤어 디자이너', '메이크업 아티스트', '패션 에디터'], reason: '아름다움을 추구하는 신금의 심미안이 뷰티 분야에서 탁월합니다.', fitScore: 9 },
      { category: 'IT/정밀기술', jobs: ['프로그래머', 'AI 연구원', '반도체 설계', '정밀 기계 개발'], reason: '완벽주의적 성향이 정밀한 기술 분야에서 차별화된 성과를 냅니다.', fitScore: 8 },
      { category: '금융/회계', jobs: ['회계사', '세무사', '감사', '재무 분석가'], reason: '정확성과 디테일을 중시하는 신금이 수치 관리에서 강합니다.', fitScore: 7 },
      { category: '의료/치과', jobs: ['치과의사', '피부과', '성형외과', '약사'], reason: '섬세한 손재주와 미적 감각이 필요한 의료 분야에 적합합니다.', fitScore: 7 },
    ],
  },
  '임': {
    traits: '큰 바다처럼 깊고 넓은 포용력의 소유자. 지혜가 깊고 유연하며 스케일이 큽니다. 국내보다 해외, 작은 것보다 큰 것을 지향합니다. 제한 없는 자유를 추구합니다.',
    categories: [
      { category: '무역/해외사업', jobs: ['무역업', '수출입 사업', '해외 주재원', '글로벌 컨설팅'], reason: '바다(임수)는 국경을 넘나드는 기운—해외 비즈니스에 천부적입니다.', fitScore: 9 },
      { category: '학문/연구', jobs: ['교수', '연구원', '과학자', '데이터 사이언티스트', '철학자'], reason: '깊은 바다처럼 끝없이 탐구하는 임수가 학문에서 대가가 됩니다.', fitScore: 9 },
      { category: '물류/유통', jobs: ['물류 CEO', '유통 관리', '해운업', '항공 운송'], reason: '물의 흐름처럼 물건의 흐름을 관리하는 유통업에 강합니다.', fitScore: 8 },
      { category: '상담/심리', jobs: ['정신건강의학과', '심리상담사', '명상 지도사', '코칭 전문가'], reason: '깊은 공감 능력과 직관력이 사람의 마음을 읽는 분야에서 빛납니다.', fitScore: 7 },
      { category: '음료/수산', jobs: ['음료 사업', '수산업', '워터파크 운영', '정수기 사업'], reason: '물(임수)과 직접 연관된 분야에서 자연스럽게 성공 확률이 높습니다.', fitScore: 7 },
    ],
  },
  '계': {
    traits: '이슬·빗물처럼 조용하지만 만물을 적시는 힘. 관찰력과 직감이 비범하며, 남들이 못 보는 것을 꿰뚫어봅니다. 겉은 소극적이지만 내면의 세계가 매우 깊고 풍부합니다.',
    categories: [
      { category: '예술/문학', jobs: ['시인', '소설가', '영화감독', '음악가', '일러스트레이터'], reason: '계수의 감성과 직관이 예술·문학 분야에서 독보적인 작품을 만듭니다.', fitScore: 9 },
      { category: '심리/상담', jobs: ['심리상담사', '아동상담', '타로/점술', '영적 상담'], reason: '이슬(계수)의 직관력이 사람의 깊은 내면을 읽는 데 탁월합니다.', fitScore: 8 },
      { category: '연구/분석', jobs: ['데이터 분석가', '시장 조사원', '트렌드 분석가', '리서처'], reason: '조용히 관찰하고 핵심을 파악하는 능력이 분석 분야에서 빛납니다.', fitScore: 8 },
      { category: 'IT/개발', jobs: ['백엔드 개발자', '보안 전문가', 'DB 관리자', '클라우드 엔지니어'], reason: '보이지 않는 곳에서 시스템을 지탱하는 일이 계수의 성격과 맞습니다.', fitScore: 7 },
      { category: '의료/약학', jobs: ['약사', '한약사', '임상시험 전문가', '의료 연구원'], reason: '섬세한 관찰력이 약물·연구 분야에서 정확한 성과를 냅니다.', fitScore: 7 },
    ],
  },
};

/** 용신 오행에 따른 추가 직업 보너스 */
const YONGSIN_CAREER_BOOST: Record<Ohaeng, string[]> = {
  '목': ['교육', '출판', '의류', '목재', '가구', '인테리어 소품'],
  '화': ['IT', '전기전자', '미디어', '광고', '뷰티', '조명'],
  '토': ['부동산', '건설', '농업', '도자기', '광업', '창고업'],
  '금': ['금융', '보석', '자동차', '기계', '군경', '회계'],
  '수': ['무역', '운송', '음료', '세탁', '수산', '여행업'],
};

/** 오행별 직업 적성 심화 — 오행의 본질적 성질에 기반한 적성 */
const OHAENG_CAREER_APTITUDE: Record<Ohaeng, string> = {
  '목': '목(木) 기운: 위로 뻗어나가며 가르치고 키우는 교육자 적성이 강합니다. 체계·분류를 잘 잡고 재능을 밖으로 확산시키는 문과형 직업(교수, 교사, 작가, 기획)이 잘 맞습니다.',
  '화': '화(火) 기운: 빛과 열을 사방으로 퍼뜨려 자신을 시각적으로 드러내는 분야에 적합합니다. 디자인, 방송, 미디어, 무대, 시각예술 등 자기 재능을 활발히 드러내는 문과형 직업에 소질이 있습니다.',
  '토': '토(土) 기운: 목화(양)와 금수(음)의 중간에서 기운을 조절하는 중재자 역할에 강점이 있습니다. 신용과 믿음을 바탕으로 양쪽을 포용하고 대립을 조율하는 업무(인사, 중개, 상담, 행정)에 능합니다.',
  '금': '금(金) 기운: 옳고 그름을 명확히 분별하고 끊어내는 이성적 판단력이 뛰어납니다. 수(水) 기운과 함께 발달하면 논리적·분석적인 이과형 직업(IT, 공학, 법률, 회계)에 매우 적합합니다.',
  '수': '수(水) 기운: 깊은 지식과 지혜를 상징하여 공부를 깊이 파고드는 학자·지식인 직업에 어울립니다. 소리·외국어와도 연관되어 통역, 음악, 언어학 분야에 재능이 있으며, 금(金)과 합쳐지면 이과적 성향이 강해집니다.',
};

/** 인사신(寅巳申) 삼형살 직업 추천 — 권력·통제의 흉기운을 길로 전환 */
function checkInsasinSamhyung(saju: SajuResult): string | null {
  const jijis = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
  const hasIn = jijis.includes('인');
  const hasSa = jijis.includes('사');
  const hasSin = jijis.includes('신');
  // 인사신 중 2개 이상이면 삼형살 영향
  const count = [hasIn, hasSa, hasSin].filter(Boolean).length;
  if (count >= 2) {
    return '⚔️ 인사신(寅巳申) 삼형살: 남을 통제하고 가두는 강한 기운을 긍정적으로 활용하면 크게 길해집니다. 법무부, 군인, 경찰, 검찰, 교도관, 의사 등 권위와 생사를 다루는 활인(活人) 분야가 천직입니다.';
  }
  return null;
}

export function analyzeCareer(saju: SajuResult, gender?: 'male' | 'female', age?: number): {
  summary: string;
  recommendations: CareerRecommendation[];
  yongsinBoost: string;
  warningJobs: string;
} {
  const ilgan = saju.ilgan;
  const ilOhaeng = saju.day.cheonganOhaeng;
  const yongsin = saju.yongsin;
  const gisin = saju.gisin;

  // 일간(10개)별 세분화된 직업 적성 사용
  const base = ILGAN_CAREER_BASE[ilgan] || ILGAN_CAREER_BASE['갑'];

  // (용신 오행의 직업은 YONGSIN_DIRECT_CAREERS에서 별도 처리)

  // 추천 목록: 일간 기본 + 용신 보완 (점수 조정)
  // ⚠️ deep copy 필수 — shallow copy하면 원본 ILGAN_CAREER_BASE 상수가 mutate됨
  const recommendations = base.categories.map(c => ({ ...c, jobs: [...c.jobs] }));

  // ★ 용신 오행 부족도에 따른 보정 강도 결정
  const ohaengBalance = saju.ohaengBalance;
  const yongsinBalance = ohaengBalance[yongsin] || 0;
  // 용신 부족할수록 용신 직업 보정이 강해짐 (1이하: +2, 2이하: +1)
  const yongsinBoostScore = yongsinBalance <= 1 ? 2 : yongsinBalance <= 2 ? 1 : 0;

  // ★ 용신 오행과 관련된 카테고리 키워드 맵 (일간 기본 카테고리 보정용)
  const YONGSIN_CATEGORY_KEYWORDS: Record<Ohaeng, RegExp> = {
    '목': /교육|환경|농림|의류|출판|가구/i,
    '화': /연예|방송|에너지|전기|광고|마케팅|미디어/i,
    '토': /부동산|건설|농업|식품|행정|관리/i,
    '금': /금융|투자|회계|제조|엔지니어|IT|정밀|보석|기계/i,
    '수': /무역|해외|물류|학문|연구|상담|심리|음료|수산/i,
  };
  const yongsinKeyword = YONGSIN_CATEGORY_KEYWORDS[yongsin];

  // 기신 오행과 관련된 카테고리는 감점
  const GISIN_CATEGORY_KEYWORDS: Record<Ohaeng, RegExp> = {
    '목': /교육|환경|농림|의류/i,
    '화': /연예|방송|에너지|전기|광고/i,
    '토': /부동산|건설|농업|식품/i,
    '금': /금융|투자|법률|군경|제조|엔지니어/i,
    '수': /무역|해외|물류|학문|연구/i,
  };
  const gisinKeyword = GISIN_CATEGORY_KEYWORDS[gisin];

  // ── 신강/신약 강도 판별 (fitScore 단계적 보정) ──
  const ilOhBal_career = ohaengBalance[ilOhaeng] || 0;
  const strength = getSingangStrength(ilOhBal_career);
  const { ilOhPenalty, yongsinBonus } = getSingangScoreAdj(strength);
  const isExtSingang = ilOhBal_career >= 6;
  const isExtSinyak = ilOhBal_career <= 1.5;

  // 일간 오행과 동일한 카테고리 키워드 (신강일 때 감점 대상)
  const ILGAN_OH_CATEGORY_KEYWORDS: Record<Ohaeng, RegExp> = {
    '목': /교육|환경|농림|의류|출판|가구|인테리어|조경/i,
    '화': /연예|방송|에너지|전기|광고|마케팅|미디어|외식|요리/i,
    '토': /부동산|건설|농업|식품|행정|관리|공무원|공기업|토목/i,
    '금': /법률|군경|금융|투자|제조|엔지니어|보석|기계|귀금속|뷰티/i,
    '수': /무역|해외|물류|학문|연구|상담|심리|음료|수산/i,
  };
  const ilOhCategoryKeyword = ILGAN_OH_CATEGORY_KEYWORDS[ilOhaeng];

  // 일간 기본 카테고리에 신강/신약 강도별 단계적 보정 적용
  for (const rec of recommendations) {
    // 일간 오행 카테고리: 강도에 따라 감점 (full: -4, partial: -2, none: 0)
    if (ilOhPenalty !== 0 && ilOhCategoryKeyword && ilOhCategoryKeyword.test(rec.category)) {
      rec.fitScore = Math.max(1, rec.fitScore + ilOhPenalty);
      if (strength === 'full') {
        rec.reason = `⚠️ ${ilOhaeng} 기운 과다로 오히려 불리 — ` + rec.reason;
      }
    }
    // 용신 카테고리: 강도에 따라 가점 (full: +3, partial: +1, none: 0) + 용신 부족도 보너스
    if (yongsinKeyword && yongsinKeyword.test(rec.category)) {
      rec.fitScore = Math.min(10, rec.fitScore + yongsinBonus + yongsinBoostScore);
      if (yongsinBonus >= 1 || yongsinBoostScore >= 2) {
        rec.reason = `★ 용신(${yongsin}) 직업 — ` + rec.reason;
      }
    }
    // 기신 카테고리: 항상 감점 (강도가 셀수록 더 감점)
    if (gisinKeyword && gisinKeyword.test(rec.category)) {
      const gisinPenalty = strength === 'full' ? -2 : strength === 'partial' ? -1 : 0;
      rec.fitScore = Math.max(1, rec.fitScore + gisinPenalty);
    }
  }

  // ★ 용신 오행별 추가 추천 직업 (일간 성격과 무관하게 용신 오행 자체의 직업)
  // 용신 일간(경금/임수 등)의 성격 기반이 아니라, 오행 자체의 업종 카테고리
  const YONGSIN_DIRECT_CAREERS: Record<Ohaeng, CareerRecommendation[]> = {
    '목': [
      { category: '교육/출판', jobs: ['교사', '학원 운영', '출판 편집', '교육 콘텐츠 제작'], reason: '용신 목(木)의 성장·교육 에너지가 가르치는 일에서 운을 열어줍니다.', fitScore: 8 },
      { category: '인테리어/가구', jobs: ['인테리어 디자이너', '가구 제작', '공간 설계', '조경'], reason: '목(木) 에너지를 직접 다루는 분야에서 자연스럽게 성과가 납니다.', fitScore: 7 },
    ],
    '화': [
      { category: '미디어/광고', jobs: ['영상 제작', '광고 기획', 'SNS 마케터', '브랜딩'], reason: '용신 화(火)의 빛나는 에너지가 시각적 분야에서 운을 열어줍니다.', fitScore: 8 },
      { category: '전기/에너지', jobs: ['전기 엔지니어', '태양광 사업', '반도체', '조명 설계'], reason: '화(火)=전기·빛의 기운이 전기/에너지 분야에서 길로 작용합니다.', fitScore: 8 },
    ],
    '토': [
      { category: '부동산/중개', jobs: ['부동산 중개', '임대 사업', '토지 개발', '감정평가'], reason: '용신 토(土)의 안정 에너지가 부동산에서 운을 열어줍니다.', fitScore: 8 },
      { category: '식품/외식', jobs: ['요식업', '식품 제조', '영양사', '프랜차이즈'], reason: '토(土)의 수확 에너지가 식품 분야에서 풍요를 가져옵니다.', fitScore: 7 },
    ],
    '금': [
      { category: '금융/재무', jobs: ['재무 설계사', '회계사', '세무사', '보험 설계', '펀드매니저'], reason: '★ 용신 금(金)의 정밀한 에너지가 숫자·돈을 다루는 금융에서 운을 열어줍니다.', fitScore: 9 },
      { category: '기술/엔지니어링', jobs: ['기계 엔지니어', '전기 설비', '자동차 정비', '설비 관리', 'CAD 설계'], reason: '★ 금(金)=기계·금속·기술의 기운이 엔지니어링 분야에서 길로 작용합니다.', fitScore: 9 },
      { category: 'IT/데이터', jobs: ['프로그래머', '데이터 분석가', 'IT 컨설턴트', '시스템 관리'], reason: '★ 금(金)의 논리적·분석적 에너지가 IT 분야에서 빛을 발합니다.', fitScore: 8 },
    ],
    '수': [
      { category: '무역/해외', jobs: ['무역업', '수출입 사업', '해외 영업', '통번역'], reason: '용신 수(水)의 유동 에너지가 국경을 넘는 사업에서 운을 열어줍니다.', fitScore: 8 },
      { category: '연구/학문', jobs: ['연구원', '데이터 사이언티스트', '분석가', '컨설턴트'], reason: '수(水)의 깊은 지혜가 연구·분석 분야에서 탁월한 성과를 냅니다.', fitScore: 8 },
    ],
  };

  // 용신 직접 추천 카테고리 추가 (기존에 없는 것만)
  // 극신강/극신약이면 용신 직접 추천에 추가 가점
  const extBonus = isExtSingang ? 2 : isExtSinyak ? 1 : 0;
  const yongsinDirectCareers = YONGSIN_DIRECT_CAREERS[yongsin] || [];
  for (const ydc of yongsinDirectCareers) {
    const existing = recommendations.find(r => r.category === ydc.category);
    if (!existing) {
      recommendations.push({
        ...ydc,
        jobs: [...ydc.jobs],
        fitScore: Math.min(10, ydc.fitScore + yongsinBoostScore + extBonus),
      });
    } else {
      // 이미 존재하면 jobs 합치고 점수 올림
      const newJobs = ydc.jobs.filter(j => !existing.jobs.includes(j));
      existing.jobs.push(...newJobs);
      existing.fitScore = Math.min(10, Math.max(existing.fitScore, ydc.fitScore + yongsinBoostScore + extBonus));
      if (yongsinBoostScore >= 1 || isExtSingang || isExtSinyak) {
        existing.reason = ydc.reason;
      }
    }
  }

  // 십성 기반 추가 분석 — 월주·시주·연주 십성 모두 반영
  const sipseongs = saju.sipseongs;
  let sipseongNote = '';

  // 월주 십성 = 사회적 활동 스타일 (가장 중요)
  const MONTH_CAREER_NOTE: Record<Sipseong, string> = {
    '비견': '월주 비견 — 동업보다 독립 사업이 유리합니다. 남에게 지시받기 싫어하는 성향이 강해, 자기 사업이나 프리랜서로 성공 확률이 높습니다.',
    '겁재': '월주 겁재 — 승부욕이 강해 경쟁이 치열한 분야(영업, 투자, 창업, 부동산)에서 두각을 나타냅니다. 단, 동업은 금전 분쟁 위험이 있으니 피하세요.',
    '식신': '월주 식신 — 전문 기술직의 왕! 요리, IT, 연구, 공예 등 "손으로 만드는 일"에서 최고가 됩니다. 자격증이 돈이 되는 타입입니다.',
    '상관': '월주 상관 — 틀을 깨는 혁신가! 기존 규칙이 답답해서 자기만의 방식을 만듭니다. 프리랜서, 예술가, 벤처 창업에서 독보적인 성과를 냅니다.',
    '편재': '월주 편재 — 타고난 장사꾼! 돈의 흐름을 읽는 감각이 뛰어나 사업, 투자, 무역에서 큰돈을 만집니다. 여러 사업을 동시에 돌리는 것도 가능합니다.',
    '정재': '월주 정재 — 월급쟁이의 왕! 꾸준하고 안정적인 수입이 맞는 타입. 은행, 공기업, 대기업에서 장기 근속하며 높은 자리까지 올라갈 수 있습니다.',
    '편관': '월주 편관 — 조직의 실세! 군경, 검찰, 대기업 임원 등 강한 리더십이 필요한 자리에서 빛납니다. 벤처 CEO나 위기관리 전문가로도 적합합니다.',
    '정관': '월주 정관 — 명예와 출세의 별! 공무원, 교사, 판사 등 사회적으로 존경받는 안정적 직업이 딱 맞습니다. 승진이 빠르고 윗사람에게 인정받기 쉽습니다.',
    '편인': '월주 편인 — 독특한 전문가! IT, 종교, 철학, 대체의학 등 비주류 분야에서 인정받습니다. 남들이 안 하는 것을 파고들면 블루오션을 발견합니다.',
    '정인': '월주 정인 — 학문의 별! 교수, 연구원, 작가, 번역가 등 지식 기반 직업이 천직입니다. 자격증·학위가 큰 무기가 되며, 평생학습이 성공의 열쇠입니다.',
  };
  sipseongNote += MONTH_CAREER_NOTE[sipseongs.month] + '\n';

  // 시주 십성 = 말년 직업운·은퇴 후 활동
  const HOUR_CAREER_NOTE: Record<Sipseong, string> = {
    '비견': '시주 비견 — 말년에 독립 사업이나 자영업으로 전환하면 좋습니다.',
    '겁재': '시주 겁재 — 은퇴 후에도 경쟁심이 남아 투자·자영업 분야 활동이 활발합니다.',
    '식신': '시주 식신 — 말년에 취미를 직업으로 만들 수 있습니다. 요리, 공예, 강의 등.',
    '상관': '시주 상관 — 은퇴 후 작가, 유튜버, 강연가 등 표현 활동에서 제2의 전성기를 맞습니다.',
    '편재': '시주 편재 — 말년에 부동산이나 투자 수입으로 여유로운 생활이 가능합니다.',
    '정재': '시주 정재 — 말년 경제적 안정이 보장됩니다. 연금, 저축이 탄탄합니다.',
    '편관': '시주 편관 — 말년에도 조직에서 영향력을 행사합니다. 고문, 자문 역할이 적합합니다.',
    '정관': '시주 정관 — 자녀와의 관계가 좋고, 말년이 안정적이며 사회적 명예가 유지됩니다.',
    '편인': '시주 편인 — 말년에 종교, 철학, 명상 등 정신세계를 탐구하게 됩니다.',
    '정인': '시주 정인 — 말년에 가르치는 일, 집필, 멘토링 등으로 존경받는 노년을 보냅니다.',
  };
  sipseongNote += HOUR_CAREER_NOTE[sipseongs.hour];

  // 일지(일주 지지)의 십성으로 직업 적합도 보정
  const ilji = saju.day.jiji;
  const iljiOhaeng = JIJI_OHAENG[ilji];
  const ILJI_WORK_STYLE: Record<string, string> = {
    '자': '일지 자수 — 머리 회전이 빠르고 야간 활동에 강합니다. 밤에 일하는 직업(야간 근무, 엔터, 온라인 사업)도 잘 맞습니다.',
    '축': '일지 축토 — 느리지만 확실한 성과를 내는 타입. 금융, 부동산 등 장기적 안목이 필요한 분야가 맞습니다.',
    '인': '일지 인목 — 활동적이고 모험을 즐깁니다. 영업, 여행, 야외 활동, 해외 관련 직업이 잘 맞습니다.',
    '묘': '일지 묘목 — 사교적이고 매력적이라 인맥이 재산입니다. 접객, 마케팅, 엔터, 네트워킹이 강점입니다.',
    '진': '일지 진토 — 야심차고 스케일이 큽니다. 대기업, 대형 프로젝트, 창업 등 큰 무대가 맞습니다.',
    '사': '일지 사화 — 전략적이고 치밀합니다. 컨설팅, 전략 기획, 법률, 수사 등 머리쓰는 일이 강점입니다.',
    '오': '일지 오화 — 내면의 열정과 추진력이 강합니다. 에너지가 넘치고 행동력이 뛰어나 현장에서 진두지휘하는 역할이 맞습니다. 자존심이 강해 자기 분야에서 최고를 지향합니다.',
    '미': '일지 미토 — 다정하고 섬세합니다. 서비스업, 요식업, 상담, 교육 등 사람을 돌보는 일이 적합합니다.',
    '신': '일지 신금 — 실행력과 결단력이 뛰어납니다. 프로젝트 관리, 엔지니어링, 금융 투자에서 빠른 성과를 냅니다.',
    '유': '일지 유금 — 심미안이 뛰어나고 꼼꼼합니다. 디자인, 보석, 뷰티, 품질 관리 등 디테일이 중요한 분야가 맞습니다.',
    '술': '일지 술토 — 의리와 충성심이 강합니다. 경호, 군경, 공무원, 종교 등 신뢰가 중요한 분야에서 빛납니다.',
    '해': '일지 해수 — 포용력이 넓고 창의적입니다. 무역, 해외사업, 창작, 상담 등 경계를 넘나드는 일이 맞습니다.',
  };
  if (ILJI_WORK_STYLE[ilji]) {
    sipseongNote += '\n' + ILJI_WORK_STYLE[ilji];
  }

  // ── 극신강/극신약일 때 sipseongNote 안의 일간 오행 관련 키워드를 범용 함수로 자동 교체 ──
  sipseongNote = replaceOhaengKeywords(sipseongNote, ilOhaeng, yongsin, strength);

  // === 나이·성별 기반 현실성 필터 ===
  // 50대+ 남성에게 "간호사" 같은 비현실적 직업 제거, 나이대별 맞춤 조정
  const currentAge = age || 30;
  const isMale = gender === 'male';
  const isFemale = gender === 'female';

  // ========== 오행 불균형 → 건강 기반 직업 필터 ==========
  // 극단적으로 부족한 오행(1 이하)에 따라 건강에 해로운 직업 제거
  const weakestOh = saju.weakestOhaeng;
  const weakestBalance = ohaengBalance[weakestOh];
  const isExtremeWeak = weakestBalance <= 1;

  // 건강 기반 직업 필터: 극단적 부족 시 해당 오행과 관련된 체력/환경 요구 직업 제거
  const healthJobFilters: { pattern: RegExp; exclude: boolean; reason: string }[] = [];
  let healthCareerNote = '';

  if (isExtremeWeak) {
    if (weakestOh === '화') {
      // 화 극도 부족: 심장·혈관 약화, 공황장애/불안장애 가능
      // → 고강도 스트레스, 장거리 이동, 밀폐 공간, 야근 많은 직업 부적합
      healthJobFilters.push(
        { pattern: /소방관|응급 구조사|경호원|격투기/, exclude: true, reason: '심혈관 약화로 고강도 체력 직업 위험' },
        { pattern: /파일럿|승무원|선원|항해사/, exclude: true, reason: '공황장애 위험으로 밀폐 공간/장거리 이동 직업 부적합' },
        { pattern: /무역|해외.*영업|해외.*주재|외교관|국제/, exclude: true, reason: '장거리 출장이 잦은 직업은 불안 증상을 악화시킬 수 있음' },
        { pattern: /택시 기사|트럭 운전|버스 기사|배달/, exclude: true, reason: '장시간 운전/이동은 심혈관·정신 건강에 부담' },
        { pattern: /야간.*근무|교대.*근무/, exclude: true, reason: '수면 리듬 파괴가 불안장애를 악화시킴' },
      );
      healthCareerNote = '\n⚠️ 【건강 기반 직업 주의】 화(火) 기운이 극도로 부족하여 심혈관·정신 건강이 취약합니다. 고강도 스트레스, 장거리 출장, 밀폐 공간 근무, 교대 근무가 필요한 직업은 피하는 것이 좋습니다. 재택근무, 자율 출퇴근, 안정적인 환경의 직업이 건강에 유리합니다.';
    } else if (weakestOh === '목') {
      // 목 극도 부족: 간 기능 약화, 만성 피로, 우울
      healthJobFilters.push(
        { pattern: /야간.*근무|교대.*근무/, exclude: true, reason: '간 기능 약화로 야간 근무 부적합' },
        { pattern: /바텐더|소믈리에|주류/, exclude: true, reason: '간 기능 약화로 주류 관련 직업 위험' },
      );
      healthCareerNote = '\n⚠️ 【건강 기반 직업 주의】 목(木) 기운이 극도로 부족하여 간 기능·체력이 약합니다. 야근이 잦거나 음주 문화가 강한 직장, 과로가 일상인 직종은 피하세요. 규칙적인 생활이 가능한 직업이 건강에 유리합니다.';
    } else if (weakestOh === '토') {
      // 토 극도 부족: 위장 극도 약화
      healthJobFilters.push(
        { pattern: /요리사|셰프|제과제빵|외식/, exclude: true, reason: '위장 기능 극약으로 요식업 부적합' },
        { pattern: /야간.*근무|교대.*근무/, exclude: true, reason: '불규칙한 식사가 위장에 치명적' },
      );
      healthCareerNote = '\n⚠️ 【건강 기반 직업 주의】 토(土) 기운이 극도로 부족하여 위장 기능이 매우 약합니다. 불규칙한 식사를 강요하는 직종(교대근무, 외식업, 영업직)은 피하세요. 규칙적인 식사가 가능한 환경이 중요합니다.';
    } else if (weakestOh === '금') {
      // 금 극도 부족: 호흡기·면역 극약
      healthJobFilters.push(
        { pattern: /건설|토목|광업|용접|도장|페인트/, exclude: true, reason: '호흡기 약화로 분진·화학물질 노출 직업 위험' },
        { pattern: /소방관/, exclude: true, reason: '호흡기 약화로 화재 현장 작업 위험' },
      );
      healthCareerNote = '\n⚠️ 【건강 기반 직업 주의】 금(金) 기운이 극도로 부족하여 호흡기·면역력이 매우 약합니다. 먼지·분진·화학물질에 노출되는 직종, 야외 작업이 많은 직종은 피하세요. 실내 환경이 쾌적한 직업이 건강에 유리합니다.';
    } else if (weakestOh === '수') {
      // 수 극도 부족: 신장·허리 극약
      healthJobFilters.push(
        { pattern: /택시 기사|트럭 운전|버스 기사/, exclude: true, reason: '허리 약화로 장시간 앉아있는 직업 위험' },
        { pattern: /건설.*노동|택배|배달|물류.*노동/, exclude: true, reason: '허리/신장 약화로 육체 노동 직업 위험' },
      );
      healthCareerNote = '\n⚠️ 【건강 기반 직업 주의】 수(水) 기운이 극도로 부족하여 신장·허리가 매우 약합니다. 장시간 앉아있거나 무거운 물건을 드는 직종, 추운 환경에서 일하는 직종은 피하세요.';
    }
  }

  // 나이대·성별에 따라 비현실적인 직업을 필터링하는 맵
  // key: 직업명 일부, value: 제외 조건 (true면 제외)
  const jobFilterRules: { pattern: RegExp; exclude: boolean }[] = [
    // ── 나이 기반 (성별 무관) ──
    // 체력·외모 의존 직업: 나이 들면 새로 시작 비현실적
    { pattern: /아이돌/, exclude: currentAge >= 25 },
    { pattern: /가수|연기자|MC/, exclude: currentAge >= 50 },
    { pattern: /인플루언서|유튜버/, exclude: currentAge >= 60 },
    { pattern: /격투기 선수/, exclude: currentAge >= 35 },
    { pattern: /경호원/, exclude: currentAge >= 55 },
    { pattern: /스포츠 트레이너/, exclude: currentAge >= 60 },
    { pattern: /소방관|응급 구조사/, exclude: currentAge >= 45 },
    { pattern: /군 장교|교도관|국정원/, exclude: currentAge >= 50 },
    { pattern: /경찰 간부/, exclude: currentAge >= 50 },
    // 전문직 면허: 중년 이후 새로 시작 비현실적
    { pattern: /외과의|정형외과|치과의사|피부과|성형외과|한의사|정신건강의학과/, exclude: currentAge >= 40 },
    { pattern: /약사|한약사/, exclude: currentAge >= 45 },
    { pattern: /변호사|검사|노무사/, exclude: currentAge >= 50 },
    { pattern: /교수/, exclude: currentAge >= 55 },
    // CEO·임원 등은 젊은 사람에겐 비현실적
    { pattern: /CEO|대표|지점장|임원|총괄|이사/, exclude: currentAge < 25 },
    { pattern: /교장|학원장/, exclude: currentAge < 35 },
    { pattern: /은행 지점장/, exclude: currentAge < 35 },

    // ── 성별 + 나이 조합 ──
    // 남성 40대 이상 → 새로 시작하기 어려운 여성 다수 직종
    { pattern: /간호사/, exclude: isMale && currentAge >= 45 },
    { pattern: /보육 교사|유치원 교사|유아교육|방과후 교사/, exclude: isMale && currentAge >= 45 },
    { pattern: /네일아트|피부 관리|메이크업 아티스트|뷰티 전문가/, exclude: isMale && currentAge >= 40 },
    { pattern: /미용사|헤어 디자이너/, exclude: isMale && currentAge >= 50 },
    { pattern: /플로리스트/, exclude: isMale && currentAge >= 55 },
    { pattern: /요가 강사/, exclude: isMale && currentAge >= 50 },
    { pattern: /아로마테라피스트|힐링 캠프/, exclude: isMale && currentAge >= 50 },
    { pattern: /패션 디자이너|스타일리스트|패션 에디터|패션 MD/, exclude: currentAge >= 50 },
    // 여성 40대 이상 → 체력/격투 계열
    { pattern: /격투기 선수|경호원/, exclude: isFemale && currentAge >= 30 },
    { pattern: /군 장교|교도관/, exclude: isFemale && currentAge >= 40 },
    // 남성 전 연령 → 극히 드문 직종 (차별이 아닌 현실)
    { pattern: /돌봄 서비스|요양 관리/, exclude: isMale && currentAge >= 50 },

    // ── 고령자 보호 (55세 이상) ──
    { pattern: /스타트업 대표/, exclude: currentAge >= 60 },
    { pattern: /프로그래머|백엔드 개발|프론트엔드 개발|AI 연구원|클라우드 엔지니어|반도체 설계/, exclude: currentAge >= 55 },
    { pattern: /SNS 마케터/, exclude: currentAge >= 55 },
    { pattern: /제과제빵/, exclude: currentAge >= 60 },
    { pattern: /기계 엔지니어|자동차 정비|금속 가공/, exclude: currentAge >= 60 },
    { pattern: /토목 엔지니어|건설 PM/, exclude: currentAge >= 60 },
  ];

  // 건강 필터 + 나이/성별 필터 합쳐서 적용
  const allFilters = [...healthJobFilters.map(f => ({ pattern: f.pattern, exclude: f.exclude })), ...jobFilterRules];
  for (const rec of recommendations) {
    rec.jobs = rec.jobs.filter(job => {
      for (const rule of allFilters) {
        if (rule.exclude && rule.pattern.test(job)) return false;
      }
      return true;
    });
  }
  // 직업이 전부 필터된 카테고리 제거
  // full(극신강/극신약): 일간 오행 카테고리 fitScore 5이하 → 아예 제외
  // partial(신강/신약): fitScore 3이하 → 제외
  const filteredRecs = recommendations.filter(r => {
    if (r.jobs.length === 0) return false;
    if (ilOhCategoryKeyword && ilOhCategoryKeyword.test(r.category)) {
      if (strength === 'full' && r.fitScore <= 5) return false;
      if (strength === 'partial' && r.fitScore <= 3) return false;
    }
    return true;
  });

  // === 나이대별 맞춤 조언 추가 ===
  let ageNote = '';
  if (currentAge >= 60) {
    ageNote = '\n💡 60대 이상: 새 직업보다는 기존 경험을 살린 자문·강의·멘토링이 현실적입니다. 체력보다 지혜가 자산인 시기입니다.';
  } else if (currentAge >= 50) {
    ageNote = '\n💡 50대: 안정적 수입원 유지가 중요합니다. 전직보다는 부업·투자·컨설팅으로 경험을 현금화하세요.';
  } else if (currentAge >= 40) {
    ageNote = '\n💡 40대: 전문성이 무르익는 시기. 이직보다 현재 분야에서 깊이를 더하거나, 사이드 프로젝트로 제2수입원을 만드세요.';
  } else if (currentAge < 20) {
    ageNote = '\n💡 아직 가능성이 무한한 나이! 다양한 경험을 쌓으면서 적성을 찾아가세요.';
  }

  // 오행별 직업 적성 심화 — 극신강이면 오버라이드
  const SINGANG_OHAENG_APTITUDE: Record<Ohaeng, string> = {
    '목': '목(木) 기운이 과다합니다. 교육·출판 등 목 관련 분야보다, 용신 오행을 활용하는 분야가 훨씬 유리합니다. 넘치는 추진력을 발산하되, 용신 기운이 흐르는 업종을 선택하세요.',
    '화': '화(火) 기운이 과다합니다. 방송·광고 등 화 관련 분야보다, 용신 오행을 활용하는 분야가 훨씬 유리합니다. 열정은 있으나 방향을 용신 쪽으로 잡아야 성공합니다.',
    '토': '토(土) 기운이 과다합니다. 부동산·중개·행정 등 토 관련 분야는 오히려 기운이 넘쳐 역효과가 납니다. 용신 오행(이 경우 금·수 계열)을 활용하는 금융, 기술, 엔지니어링, IT 분야가 훨씬 유리합니다.',
    '금': '금(金) 기운이 과다합니다. 법률·군경 등 금 관련 분야보다, 용신 오행을 활용하는 분야가 훨씬 유리합니다. 날카로운 판단력은 있으나 용신 쪽에서 발휘해야 효과가 큽니다.',
    '수': '수(水) 기운이 과다합니다. 무역·연구 등 수 관련 분야보다, 용신 오행을 활용하는 분야가 훨씬 유리합니다. 깊은 사고력을 용신 방향으로 활용하세요.',
  };
  const SINYAK_OHAENG_APTITUDE: Record<Ohaeng, string> = {
    '목': '목(木) 기운이 매우 약합니다. 용신으로 목 기운을 보충할 수 있는 분야(교육, 출판, 환경 등)가 좋고, 무리한 리더십보다 안정적 환경에서 일하는 것이 유리합니다.',
    '화': '화(火) 기운이 매우 약합니다. 용신으로 화 기운을 보충할 수 있는 분야가 좋고, 과도한 주목을 받는 직업보다 꾸준히 역량을 쌓을 수 있는 환경이 적합합니다.',
    '토': '토(土) 기운이 매우 약하여 안정감과 자기 주장이 부족합니다. 체계가 잡힌 조직에서 용신 오행을 활용하는 분야가 좋습니다. 무리한 자영업이나 중개업은 피하세요.',
    '금': '금(金) 기운이 매우 약합니다. 용신 오행을 보충할 수 있는 분야가 좋고, 지나치게 경쟁적인 환경보다 전문성을 키울 수 있는 안정적 직장이 적합합니다.',
    '수': '수(水) 기운이 매우 약합니다. 용신 오행을 활용하는 분야가 좋고, 깊은 학문보다 실용적이고 정해진 범위의 업무가 적합합니다.',
  };
  let ohaengAptitude: string;
  if (strength === 'full' && ilOhBal_career >= 6) {
    ohaengAptitude = SINGANG_OHAENG_APTITUDE[ilOhaeng] || OHAENG_CAREER_APTITUDE[ilOhaeng] || '';
  } else if (strength === 'full' && ilOhBal_career <= 1.5) {
    ohaengAptitude = SINYAK_OHAENG_APTITUDE[ilOhaeng] || OHAENG_CAREER_APTITUDE[ilOhaeng] || '';
  } else if (strength === 'partial') {
    // partial: 기본 적성 + 용신 보충 메모
    const base_apt = OHAENG_CAREER_APTITUDE[ilOhaeng] || '';
    const yongsinAlt = OHAENG_JOB_KEYWORDS[yongsin]?.slice(0, 3).join(', ') || '용신 관련';
    if (ilOhBal_career >= 4.5) {
      ohaengAptitude = `${base_apt} 다만 ${ilOhaeng}(${OHAENG_HANJA[ilOhaeng]}) 기운이 다소 강하므로, 용신(${yongsin}) 관련 분야(${yongsinAlt} 등)를 함께 고려하면 더 좋습니다.`;
    } else {
      ohaengAptitude = `${base_apt} 다만 ${ilOhaeng}(${OHAENG_HANJA[ilOhaeng]}) 기운이 다소 약하므로, 용신(${yongsin}) 관련 분야(${yongsinAlt} 등)를 함께 고려하면 더 좋습니다.`;
    }
  } else {
    ohaengAptitude = OHAENG_CAREER_APTITUDE[ilOhaeng] || '';
  }

  // 인사신 삼형살 직업 추천
  const samhyungNote = checkInsasinSamhyung(saju) || '';

  // 신강/신약 직업 조언
  const { analyzeSingang } = require('./daeun');
  const singangResult = analyzeSingang(saju);
  let singangCareer: string = singangResult.careerAdvice || '';
  // 극신강/극신약일 때 singangCareer도 범용 함수로 자동 교체
  singangCareer = replaceOhaengKeywords(singangCareer, ilOhaeng, yongsin, strength);

  // ── 극신강/극신약일 때 base.traits 오버라이드 ──
  const ilOhBal = saju.ohaengBalance[ilOhaeng];
  const SINGANG_CAREER_TRAITS: Record<Ohaeng, string> = {
    '목': '에너지가 넘치고 자존심이 매우 강한 타입. 남의 지시를 받기 싫어하고 자기 방식만 고집하려 합니다. 독립 사업이나 프리랜서로 성공 확률이 높으며, 넘치는 추진력을 발산할 수 있는 분야가 적합합니다. 다만 고집과 독선을 경계해야 조직에서도 인정받을 수 있습니다.',
    '화': '열정과 에너지가 폭발적인 타입. 주목받고 싶은 욕구가 매우 강해 무대 위나 사람들 앞에서 빛납니다. 하지만 감정 기복이 심하고 쉽게 흥분할 수 있어, 안정적인 환경보다 변화무쌍한 분야에서 능력을 발휘합니다.',
    '토': '고집이 매우 세고 자기 방식만 고수하려는 성향이 강합니다. "듬직하다"기보다 "내 방식이 맞다"는 확신에 가까운 성격입니다. 토 기운이 이미 넘치므로 부동산·건설 같은 토 관련 업종보다, 용신 기운을 쓸 수 있는 분야(금융, 기술, 엔지니어링 등)가 훨씬 유리합니다. 자기 재량으로 움직이는 자영업이나 프리랜서가 체질에 맞지만, 남의 지시를 받는 환경에서는 스트레스가 큽니다.',
    '금': '기준이 매우 높고 타협을 모르는 완벽주의자. 자기 분야에서 최고가 되려는 욕구가 강합니다. 전문 기술직, 관리직에서 빛나지만, 부하직원이나 동료에게 지나치게 엄격하면 갈등이 생깁니다.',
    '수': '독자적 세계가 매우 강한 타입. 자기만의 판단과 방법을 고집하며, 남의 간섭을 극도로 싫어합니다. 연구, 전략, 기획 등 독립적으로 깊이 파는 분야에서 탁월합니다.',
  };
  const SINYAK_CAREER_TRAITS: Record<Ohaeng, string> = {
    '목': '자신감이 부족하고 새로운 시도를 두려워하는 타입. 남의 의견에 쉽게 흔들리며, 주도적으로 나서기 어렵습니다. 안정적인 조직에서 보호받는 환경이 필요하고, 용신 기운을 보충하는 분야를 선택하면 자신감이 살아납니다.',
    '화': '열정이 부족하고 자기 표현에 소극적인 타입. 사람들 앞에 나서기 꺼려하고 에너지가 쉽게 고갈됩니다. 소규모 조직이나 재택근무가 맞으며, 관심 분야에서 조금씩 자신감을 키워가는 것이 중요합니다.',
    '토': '자기 주장이 약하고 남에게 휘둘리기 쉬운 타입. 안정을 원하지만 스스로 만들어내는 힘이 부족합니다. 체계가 잡힌 조직에서 꾸준히 경험을 쌓는 것이 맞으며, 무리한 자영업이나 창업은 피하는 게 좋습니다.',
    '금': '자신감이 부족해 남의 평가에 민감하고, 결정을 잘 못 내립니다. 전문 기술을 하나씩 쌓아 자신감을 키우는 것이 핵심. 자격증이나 면허가 있는 안정적 직업이 적합합니다.',
    '수': '감정을 잘 표현하지 못하고 소통에 어려움을 겪는 타입. 조용한 환경에서 집중하는 업무가 맞습니다. 학문, 연구, 데이터 분석 등 혼자 몰입하는 분야에서 두각을 나타냅니다.',
  };

  let traitsText = base.traits;
  if (strength === 'full' && ilOhBal >= 6) {
    traitsText = SINGANG_CAREER_TRAITS[ilOhaeng] || base.traits;
  } else if (strength === 'full' && ilOhBal <= 1.5) {
    traitsText = SINYAK_CAREER_TRAITS[ilOhaeng] || base.traits;
  } else if (strength === 'partial') {
    // partial: 기본 traits에 용신 보충 문장 추가
    const yongsinAlt = OHAENG_JOB_KEYWORDS[yongsin]?.slice(0, 3).join(', ') || '용신 관련';
    if (ilOhBal_career >= 4.5) {
      traitsText += ` 다만 ${ilOhaeng} 기운이 다소 강한 편이므로, 용신(${yongsin}) 관련 분야(${yongsinAlt} 등)에서 능력을 발휘하면 더 좋은 결과를 얻을 수 있습니다.`;
    } else {
      traitsText += ` 다만 ${ilOhaeng} 기운이 다소 약한 편이므로, 용신(${yongsin}) 관련 분야(${yongsinAlt} 등)에서 에너지를 보충하면 더 좋은 결과를 얻을 수 있습니다.`;
    }
  }

  const summary = `${traitsText}\n\n${ohaengAptitude}\n${sipseongNote}${singangCareer}${samhyungNote ? '\n' + samhyungNote : ''}${ageNote}${healthCareerNote}`;

  // 용신 부족 정도에 따라 메시지 강도 다르게
  const yongsinBoost = yongsinBoostScore >= 2
    ? `⭐ 용신 ${yongsin}(${yongsin === '금' ? '金' : yongsin === '목' ? '木' : yongsin === '화' ? '火' : yongsin === '토' ? '土' : '水'}) 기운이 극도로 부족합니다! ${yongsin} 관련 업종이 가장 유리합니다: ${YONGSIN_CAREER_BOOST[yongsin].join(', ')}. 이 분야에서 일하면 운도 풀리고 건강도 좋아집니다.`
    : `당신에게 도움이 되는 ${yongsin}(오행)과 관련된 업종도 좋습니다: ${YONGSIN_CAREER_BOOST[yongsin].join(', ')} 분야에서 부가적인 행운이 따릅니다.`;

  const GISIN_WARNING: Record<Ohaeng, string> = {
    '목': '무리한 확장이나 과도한 경쟁이 필요한 직종은 스트레스가 클 수 있습니다.',
    '화': '감정 소모가 큰 직종이나 불안정한 프리랜서 생활은 주의가 필요합니다.',
    '토': '너무 변화가 없는 단순 반복 업무는 답답함을 느낄 수 있습니다.',
    '금': '지나치게 경쟁적이거나 남을 깎아내려야 하는 환경은 피하세요.',
    '수': '불확실성이 너무 높은 투기성 사업은 리스크가 큽니다.',
  };

  return {
    summary: adjustTextByChildren(summary, saju.hasChildren),
    recommendations: filteredRecs.sort((a, b) => b.fitScore - a.fitScore).slice(0, 5),
    yongsinBoost,
    warningJobs: GISIN_WARNING[gisin],
  };
}

// ========== 결혼운/애정운/연애운 시기 분석 ==========

export interface MarriagePrediction {
  bestAges: number[];
  goodMarriageAges: number[];      // bestAges alias (테스트 호환)
  marriageStar: Sipseong;          // 결혼성 (남:정재, 여:정관)
  bestPeriodDesc: string;
  partnerType: string;
  meetingAdvice: string;
  marriageAdvice: string;
  prediction: string;              // 종합 결혼운 예측 텍스트
}

export function analyzeMarriage(
  saju: SajuResult,
  birthYear: number,
  gender: 'male' | 'female',
  daeunPillars: Array<{ cheongan: string; jiji: string; startAge: number; endAge: number; twelveStage: TwelveStage }>
): MarriagePrediction {
  const ilOhaeng = saju.day.cheonganOhaeng;
  const ilgan = saju.ilgan;
  const eumyang = saju.day.cheonganEumyang;

  // 도화살 매핑
  const DOHWA_SAL: Record<string, string> = {
    '자': '유', '축': '오', '인': '묘', '묘': '자',
    '진': '유', '사': '오', '오': '묘', '미': '자',
    '신': '유', '유': '오', '술': '묘', '해': '자',
  };

  // 남자: 정재(아내), 여자: 정관(남편)이 결혼 배우자 성
  const marriageStar: Sipseong = gender === 'male' ? '정재' : '정관';

  // 결혼운이 좋은 대운 찾기
  const goodMarriageAges: number[] = [];
  const goodPeriods: string[] = [];

  // 남자: 재성(내가 극하는 오행), 여자: 관성(나를 극하는 오행)
  const targetOhaeng = gender === 'male'
    ? OHAENG_SANGGEUK[ilOhaeng] ?? ilOhaeng
    : getGwanOhaeng(ilOhaeng);

  // 용신 오행도 결혼에 긍정적 (용신이 오면 전체적으로 운이 좋아짐)
  const yongsinOh = saju.yongsin;

  // A. 원국 결혼성 존재 분석
  let hasMarrieStarInOrigin = false;

  // 년지, 월지, 시지의 십성에서 직접 결혼성 확인
  if (
    saju.sipseongs.year === marriageStar ||
    saju.sipseongs.month === marriageStar ||
    saju.sipseongs.hour === marriageStar
  ) {
    hasMarrieStarInOrigin = true;
  }

  // 일지와 지장간 십성에서 결혼성 확인
  if (!hasMarrieStarInOrigin && saju.jangganSipseongs) {
    for (const janggan of saju.jangganSipseongs) {
      if (janggan.sipseong === marriageStar) {
        hasMarrieStarInOrigin = true;
        break;
      }
    }
  }

  // B. 도화살 분석 (일지 기준)
  const dayJiji = saju.day.jiji;
  const dohwaTarget = DOHWA_SAL[dayJiji];
  let hasDohwaSal = false;

  if (dohwaTarget) {
    // 원국의 4주(년지, 월지, 일지, 시지)에서 도화살 확인
    const allJiji = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
    if (allJiji.includes(dohwaTarget)) {
      hasDohwaSal = true;
    }
  }

  for (const pillar of daeunPillars) {
    // 결혼 현실적 나이 범위: 18~55세만 분석
    if (pillar.startAge > 69 || pillar.endAge < 18) continue;

    const ganOh = CHEONGAN_OHAENG[pillar.cheongan];
    const jiOh = JIJI_OHAENG[pillar.jiji];
    const stage = pillar.twelveStage;
    let score = 0;

    // 재성/관성 오행이 대운에 들어오면 결혼운 (핵심)
    if (ganOh === targetOhaeng || jiOh === targetOhaeng) score += 3;

    // 용신 오행이 들어오면 전체 운 상승 → 결혼에도 긍정적
    if (ganOh === yongsinOh || jiOh === yongsinOh) score += 2;

    // 12운성: 관대/건록/제왕 = 인생 전성기 → 결혼 확률 높음
    if (['관대', '건록', '제왕'].includes(stage)) score += 2;
    // 장생/태 = 새로운 시작 에너지
    if (['장생', '태'].includes(stage)) score += 1;

    // 목욕운 = 연애/이성 만남이 많은 시기
    if (stage === '목욕') score += 2;

    // C. 일지-대운 충(沖) 분석 → 결혼 또는 이혼 시기 (큰 변동)
    if (JIJI_CHUNG[dayJiji]?.opponent === pillar.jiji) {
      score += 2;
    }

    // C. 일지-대운 합(合) 분석 → 배우자와의 인연이 깊어지는 시기
    if (JIJI_YUKHAP[dayJiji]?.partner === pillar.jiji) {
      score += 2;
    }

    // B. 도화살이 대운에 오면 이성 만남 증가
    if (hasDohwaSal && pillar.jiji === dohwaTarget) {
      score += 1;
    }

    // A. 원국에 결혼성이 없고 대운에서 결혼성이 올 때 보너스
    if (!hasMarrieStarInOrigin) {
      // 대운의 천간에서 결혼성 확인
      const daeunGanSipseong = calculateSipseong(pillar.cheongan, pillar.jiji);
      if (daeunGanSipseong === marriageStar) {
        score += 1;
      }
    }

    if (score >= 3) {
      const midAge = Math.floor((pillar.startAge + pillar.endAge) / 2);
      // 결혼 현실적 나이만 추가 (20~50세)
      for (let a = midAge - 2; a <= midAge + 2; a++) {
        if (a >= 20 && a <= 50) goodMarriageAges.push(a);
      }
      // 표시 기간도 현실적 범위만
      if (pillar.startAge <= 50) {
        const displayStart = Math.max(pillar.startAge, 20);
        const displayEnd = Math.min(pillar.endAge, 55);
        if (displayEnd - displayStart >= 3) {
          goodPeriods.push(`${displayStart}~${displayEnd}세`);
        }
      }
    }
  }

  // 못 찾으면 일반적인 결혼 적기 제시
  if (goodMarriageAges.length === 0) {
    goodMarriageAges.push(27, 28, 29, 30, 31, 32, 33);
    goodPeriods.push('27~33세 전후');
  }

  // 중복 제거 & 정리
  const uniqueAges = [...new Set(goodMarriageAges)].sort((a, b) => a - b);

  // 배우자 유형 분석
  const partnerType = getPartnerType(ilOhaeng, gender, saju);

  // 만남 조언
  const meetingAdvice = getMeetingAdvice(ilOhaeng, saju.yongsin);

  // 결혼 조언
  let marriageAdvice = getMarriageAdvice(saju, gender);

  // 기간 설명
  let bestPeriodDesc = '';
  if (goodPeriods.length > 0) {
    bestPeriodDesc = `대운 분석 결과, ${goodPeriods.join(', ')} 시기에 결혼운이 강하게 들어옵니다. `;
  }

  // 목욕운 (20세 이상만)
  const stageMarriage = daeunPillars.find(p => p.twelveStage === '목욕' && p.startAge >= 15 && p.startAge <= 50);
  if (stageMarriage) {
    bestPeriodDesc += `특히 ${stageMarriage.startAge}~${stageMarriage.endAge}세에 이성 만남이 활발해지는 '목욕운'이 있어 연애 기회가 많습니다. `;
  }

  // 건록/제왕 (20세 이상만)
  const stagePeak = daeunPillars.find(p => ['건록', '제왕'].includes(p.twelveStage) && p.startAge >= 18 && p.startAge <= 50);
  if (stagePeak) {
    bestPeriodDesc += `${stagePeak.startAge}~${stagePeak.endAge}세에는 인생의 전성기 에너지가 있어, 좋은 인연을 만났다면 결혼으로 이어질 가능성이 높습니다.`;
  }

  // 용신 기반 결혼 행운 시기 부가 설명
  const yongsinDaeun = daeunPillars.find(p =>
    (CHEONGAN_OHAENG[p.cheongan] === yongsinOh || JIJI_OHAENG[p.jiji] === yongsinOh) &&
    p.startAge >= 20 && p.startAge <= 45
  );
  if (yongsinDaeun) {
    const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
    bestPeriodDesc += ` 또한 ${yongsinDaeun.startAge}~${yongsinDaeun.endAge}세에 용신(${OH_KR[yongsinOh]}) 대운이 들어와 전체적으로 운이 좋아지므로, 이 시기에 적극적으로 인연을 찾으면 좋은 결과가 있을 수 있습니다.`;
  }

  // 건강 교차검증: 결혼/관계 조언 보정
  const mCtx = extractSajuContext(saju);
  if (mCtx.isExtremeWeak && mCtx.weakOh) {
    marriageAdvice += `\n\n⚠️ 【건강↔결혼 교차분석】 ${mCtx.weakOh}(${WEAK_OHAENG_ORGAN[mCtx.weakOh]}) 기운이 극도로 부족합니다. `;
    if (mCtx.weakOh === '화') marriageAdvice += '불안·공황 증상이 관계에 영향을 줄 수 있으므로, 파트너에게 솔직히 공유하고 이해받는 것이 중요합니다. 무리한 사교 활동보다 1:1 깊은 대화가 관계를 단단하게 만듭니다.';
    else marriageAdvice += '건강이 뒷받침되지 않으면 관계 유지에도 에너지가 부족해집니다. 파트너의 이해와 배려가 필수이며, 함께 건강을 챙기는 관계가 이상적입니다.';
  }

  // E. 종합 예측 텍스트 강화
  let originMarrieStarText = '';
  if (hasMarrieStarInOrigin) {
    originMarrieStarText = `\n\n【원국 분석】 원국에 ${marriageStar}(배우자궁)이 ${gender === 'male' ? '명하게' : '명하게'} 나타나 결혼운이 선천적으로 강합니다. `;
  } else {
    originMarrieStarText = `\n\n【원국 분석】 원국에 ${marriageStar}이 명하지 않아, 대운에서 ${marriageStar}이 올 때 결혼의 기회가 생깁니다. `;
  }

  let dohwaSalText = '';
  if (hasDohwaSal) {
    dohwaSalText = `또한 도화살(桃花殺)이 있어 이성 관계와 연애 기회가 풍부하며, 인기와 매력이 높아집니다. 다만 이성 문제로 인한 변동도 주의해야 합니다. `;
  }

  let iljiChungHapText = '';
  // 일지와 대운의 충/합 관계를 분석해서 텍스트 생성
  const chungMatchPeriods: string[] = [];
  const hapMatchPeriods: string[] = [];

  for (const pillar of daeunPillars) {
    if (pillar.startAge > 69 || pillar.endAge < 18) continue;
    if (JIJI_CHUNG[dayJiji]?.opponent === pillar.jiji) {
      chungMatchPeriods.push(`${pillar.startAge}~${pillar.endAge}세`);
    }
    if (JIJI_YUKHAP[dayJiji]?.partner === pillar.jiji) {
      hapMatchPeriods.push(`${pillar.startAge}~${pillar.endAge}세`);
    }
  }

  if (chungMatchPeriods.length > 0) {
    iljiChungHapText += `일지(배우자궁)가 ${chungMatchPeriods.join(', ')} 대운과 충(沖)하여 결혼이나 이혼 등 배우자와의 관계 변동이 큽니다. `;
  }
  if (hapMatchPeriods.length > 0) {
    iljiChungHapText += `일지(배우자궁)가 ${hapMatchPeriods.join(', ')} 대운과 합(合)하여 배우자와의 인연이 깊어지고 관계가 안정화됩니다. `;
  }

  // 종합 예측 텍스트
  const prediction = [
    bestPeriodDesc,
    originMarrieStarText + dohwaSalText + iljiChungHapText,
    `\n배우자 유형: ${partnerType}`,
    `\n만남 조언: ${meetingAdvice}`,
    `\n결혼 조언: ${marriageAdvice}`,
  ].join('');

  return {
    bestAges: uniqueAges.slice(0, 8),
    goodMarriageAges: uniqueAges.slice(0, 8),
    marriageStar,
    bestPeriodDesc: adjustTextByChildren(bestPeriodDesc, saju.hasChildren),
    partnerType,
    meetingAdvice,
    marriageAdvice,
    prediction: adjustTextByChildren(prediction, saju.hasChildren),
  };
}

function getGwanOhaeng(ilOhaeng: Ohaeng): Ohaeng {
  // 나를 극하는 오행 (관성)
  const map: Record<Ohaeng, Ohaeng> = {
    '목': '금', '화': '수', '토': '목', '금': '화', '수': '토',
  };
  return map[ilOhaeng];
}

function getPartnerType(ilOhaeng: Ohaeng, gender: 'male' | 'female', saju: SajuResult): string {
  const ilgan = saju.ilgan;
  const ilji = saju.day.jiji;

  // 일간(10개)별 배우자 유형 — 양/음에 따라 끌리는 타입이 다름
  const ILGAN_PARTNER: Record<string, { male: string; female: string }> = {
    '갑': {
      male: '경제관념이 확실하고 자기 영역이 뚜렷한 여성에게 끌립니다. 당신의 리더십을 인정하면서도 자기 주관이 뚜렷한 "실속파" 배우자가 맞습니다. 신금(보석) 타입의 세련되고 깐깐한 여성과 궁합이 좋습니다.',
      female: '강인하고 결단력 있는 남성이 매력적입니다. 경금(강철)이나 신금(보석) 타입—의리 있고 원칙적인 남성이 당신의 자존심을 지켜주면서 든든한 버팀목이 됩니다.',
    },
    '을': {
      male: '강하고 듬직하되 속은 다정한 여성에게 끌립니다. 경금(강철) 타입의 여성—겉은 단단하지만 당신에게만 부드러운 사람과 찰떡궁합입니다. 을경합(乙庚合)이라 강한 사람에게 오히려 안정감을 느낍니다.',
      female: '부드럽고 섬세한 남성보다 오히려 강하고 의지가 되는 남성에게 끌립니다. 경금 타입의 남성이 당신을 보호하면서도 서로를 변화시키는 좋은 관계가 됩니다.',
    },
    '병': {
      male: '차분하고 지적이며 깊이가 있는 여성에게 끌립니다. 계수(이슬) 타입—조용하지만 깊은 내면을 가진 여성이 당신의 뜨거운 열정을 안정시켜줍니다. 병신합(丙辛合)으로 세련된 신금 타입에게도 끌립니다.',
      female: '카리스마 있으면서도 감성적인 남성이 매력적입니다. 임수(바다) 타입의 포용력 있는 남성이나, 신금 타입의 세련된 남성과 궁합이 좋습니다.',
    },
    '정': {
      male: '든든하고 안정감 있는 여성에게 끌립니다. 임수(바다) 타입—포용력이 넓고 당신의 섬세한 감성을 이해해주는 사람과 오래갑니다. 정임합(丁壬合)이라 스케일 큰 사람에게 매력을 느낍니다.',
      female: '지적이고 학문적인 남성이 매력적입니다. 임수 타입의 깊이 있는 남성이 당신의 감성과 조화를 이루며, 서로 영감을 주는 관계가 됩니다.',
    },
    '무': {
      male: '밝고 활기차며 당신을 변화시켜줄 수 있는 여성이 맞습니다. 계수(이슬) 타입—부드럽고 지적인 여성과 무계합(戊癸合)의 좋은 궁합입니다. 변화를 줄 수 있는 사람이 인생에 활력을 불어넣습니다.',
      female: '목(나무) 기운의 진취적이고 성장하는 남성에게 끌립니다. 갑목 타입의 리더십 있는 남성이 당신의 안정된 기반을 활기차게 만들어줍니다.',
    },
    '기': {
      male: '리더십 있고 야심찬 여성에게 의외로 끌립니다. 갑목(큰 나무) 타입—진취적이고 목표가 뚜렷한 여성과 기갑합(己甲合)의 좋은 궁합입니다. 당신이 뒤에서 받쳐주면 함께 큰 성과를 냅니다.',
      female: '따뜻하고 표현력 풍부한 남성이 좋습니다. 갑목 타입의 곧은 성품 남성이 당신의 섬세한 배려에 감동받아 평생 아껴줍니다.',
    },
    '경': {
      male: '유연하고 적응력 좋은 여성에게 끌립니다. 을목(풀/덩굴) 타입—부드럽고 인간관계 좋은 여성과 경을합(庚乙合)의 찰떡궁합입니다. 당신의 강함을 부드럽게 감싸줄 사람이 필요합니다.',
      female: '화(불) 기운의 열정적인 남성에게 끌립니다. 병화 타입의 밝고 카리스마 있는 남성이 당신의 차가운 면을 녹여주며 서로를 보완합니다.',
    },
    '신': {
      male: '밝고 사교적이며 열정적인 여성에게 끌립니다. 병화(태양) 타입—화려하고 매력적인 여성과 신병합(辛丙合)의 궁합이 좋습니다. 당신의 완벽주의를 따뜻하게 녹여줄 사람입니다.',
      female: '따뜻하고 섬세한 남성이 매력적입니다. 병화 타입의 카리스마 있으면서도 다정한 남성이 당신의 예민한 면을 이해하고 보듬어줍니다.',
    },
    '임': {
      male: '섬세하고 깊이 있는 감성의 여성에게 끌립니다. 정화(촛불) 타입—조용하지만 내면의 열정이 있는 여성과 임정합(壬丁合)의 궁합이 좋습니다. 서로의 깊이를 이해하는 관계가 오래갑니다.',
      female: '든든하고 안정감 있는 남성이 좋습니다. 무토(큰 산) 타입의 듬직한 남성이 당신의 자유로운 성격에 안정감을 줍니다.',
    },
    '계': {
      male: '듬직하고 포용력 있는 여성에게 끌립니다. 무토(큰 산) 타입—안정감 있고 자기 중심이 확실한 여성과 계무합(癸戊合)의 궁합이 좋습니다. 당신의 흔들리는 감성을 잡아줄 사람입니다.',
      female: '밝고 따뜻한 남성에게 끌립니다. 병화 타입의 열정적인 남성이나 무토 타입의 든든한 남성과 궁합이 좋습니다.',
    },
  };

  // 일지별 연애/결혼 스타일 추가
  const ILJI_LOVE_STYLE: Record<string, string> = {
    '자': '\n일지 자수 — 감정이 깊고 직관적. 첫눈에 반하는 타입이며, 밤에 만남이 잘 이루어집니다.',
    '축': '\n일지 축토 — 느리지만 한번 마음 주면 변치 않습니다. 소개팅이나 중매로 좋은 인연을 만날 확률이 높습니다.',
    '인': '\n일지 인목 — 활동적이고 매력적. 여행이나 야외 활동에서 인연을 만나기 쉽습니다.',
    '묘': '\n일지 묘목 — 사교적이고 인기가 많아 이성 만남이 많습니다. 연애 경험이 풍부한 편.',
    '진': '\n일지 진토 — 이상이 높아 배우자 기준이 높습니다. 조건이 좋은 사람을 만나되 눈높이 조절이 필요합니다.',
    '사': '\n일지 사화 — 지적인 대화에서 사랑이 시작됩니다. 학교, 직장, 세미나에서 인연을 만나기 쉽습니다.',
    '오': '\n일지 오화 — 열정적인 연애를 합니다. 불꽃 같은 사랑이지만 지속을 위해 노력이 필요합니다.',
    '미': '\n일지 미토 — 다정다감하고 가정적. 결혼 후 가정에 충실한 타입이며, 음식 관련 장소에서 인연이 시작됩니다.',
    '신': '\n일지 신금 — 행동파라 적극적으로 다가갑니다. 운동, 여행, 액티비티에서 인연이 많습니다.',
    '유': '\n일지 유금 — 외모를 중시하고 로맨틱한 연애를 원합니다. 술자리나 문화 행사에서 만남이 이루어지기 쉽습니다.',
    '술': '\n일지 술토 — 의리와 진실한 감정을 중시합니다. 한번 믿으면 끝까지 함께하는 타입.',
    '해': '\n일지 해수 — 포용력이 넓어 다양한 사람과 잘 맞습니다. 해외에서 인연을 만나거나 외국인과의 인연도 가능합니다.',
  };

  const partnerBase = ILGAN_PARTNER[ilgan] || ILGAN_PARTNER['갑'];
  let result = partnerBase[gender];
  if (ILJI_LOVE_STYLE[ilji]) {
    result += ILJI_LOVE_STYLE[ilji];
  }

  // ── 용신 기반 "운명적 인연" 보정 ──
  const yongsin = saju.yongsin;
  const gisin = saju.gisin;
  const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
  const YONGSIN_PARTNER_BOOST: Record<Ohaeng, string> = {
    '목': `\n🍀 용신 목(木) 인연: ${OH_KR['목']} 기운이 강한 사람(교육·출판·환경·인테리어 분야 종사자, 성격이 진취적이고 성장 지향적인 사람)을 만나면 결혼운이 크게 상승합니다. 이런 사람과 함께하면 자연스럽게 당신의 운도 좋아집니다.`,
    '화': `\n🍀 용신 화(火) 인연: ${OH_KR['화']} 기운이 강한 사람(방송·미디어·광고·에너지 분야 종사자, 밝고 열정적인 사람)을 만나면 결혼운이 크게 상승합니다. 이런 사람이 당신에게 활력과 행운을 가져다줍니다.`,
    '토': `\n🍀 용신 토(土) 인연: ${OH_KR['토']} 기운이 강한 사람(부동산·건설·식품·행정 분야 종사자, 안정적이고 신뢰감 있는 사람)을 만나면 결혼운이 크게 상승합니다. 이런 사람이 당신에게 안정감과 실질적 도움을 줍니다.`,
    '금': `\n🍀 용신 금(金) 인연: ${OH_KR['금']} 기운이 강한 사람(금융·기술·엔지니어링·회계 분야 종사자, 논리적이고 원칙적인 사람)을 만나면 결혼운이 크게 상승합니다. 이런 사람이 당신의 판단력을 키워주고 재물운도 함께 올라갑니다.`,
    '수': `\n🍀 용신 수(水) 인연: ${OH_KR['수']} 기운이 강한 사람(연구·학문·무역·해외·상담 분야 종사자, 지혜롭고 유연한 사람)을 만나면 결혼운이 크게 상승합니다. 이런 사람이 당신에게 지혜와 방향성을 제시해줍니다.`,
  };
  const GISIN_PARTNER_WARN: Record<Ohaeng, string> = {
    '목': `\n⚠️ 기신 주의: ${OH_KR['목']} 기운이 지나치게 강한 사람(고집이 매우 세고 자기주장만 하는 타입)과는 오래 만나면 감정 소모가 큽니다. 연애 초반은 좋아도 결혼 후 갈등이 커질 수 있으니 신중하세요.`,
    '화': `\n⚠️ 기신 주의: ${OH_KR['화']} 기운이 지나치게 강한 사람(감정 기복이 심하고 충동적인 타입)과는 갈등이 빈번해질 수 있습니다. 열정적으로 시작해도 감정 소모로 지칠 수 있으니 냉정한 판단이 필요합니다.`,
    '토': `\n⚠️ 기신 주의: ${OH_KR['토']} 기운이 지나치게 강한 사람(변화를 극도로 싫어하고 답답한 타입)과는 발전 없는 관계에 갇힐 수 있습니다. 안정감은 있지만 성장이 멈추는 느낌이 들 수 있어요.`,
    '금': `\n⚠️ 기신 주의: ${OH_KR['금']} 기운이 지나치게 강한 사람(비판적이고 완벽주의가 심한 타입)과는 자존감이 떨어지는 관계가 될 수 있습니다. 상대의 날카로움이 사랑인지 비난인지 구분하세요.`,
    '수': `\n⚠️ 기신 주의: ${OH_KR['수']} 기운이 지나치게 강한 사람(우유부단하고 변덕스러운 타입)과는 관계가 불안정해질 수 있습니다. 약속을 자주 바꾸거나 마음이 변하는 상대는 피하세요.`,
  };
  result += YONGSIN_PARTNER_BOOST[yongsin];
  result += GISIN_PARTNER_WARN[gisin];

  // ── 신강/신약 연애 스타일 보정 ──
  const ilOhBal = saju.ohaengBalance[ilOhaeng];
  if (ilOhBal >= 6) {
    result += `\n💪 극신강 연애 스타일: 관계에서 주도권을 잡으려는 성향이 매우 강합니다. "내 방식대로" 하려 하면 상대가 숨 막혀할 수 있어요. 배우자에게 결정권을 나눠주고, 상대의 의견을 먼저 물어보는 습관이 행복한 결혼의 비결입니다.`;
  } else if (ilOhBal <= 1.5) {
    result += `\n🤝 극신약 연애 스타일: 상대에게 맞추다 보면 자기 자신을 잃기 쉽습니다. "이 사람이 없으면 안 돼"라는 의존보다, 용신(${OH_KR[yongsin]}) 기운을 가진 파트너와 서로 힘을 주는 대등한 관계를 만드세요.`;
  }

  return result;
}

function getMeetingAdvice(ilOhaeng: Ohaeng, yongsin: Ohaeng): string {
  // 일간 오행 + 용신 오행 조합으로 세밀한 만남 장소 추천
  const ILGAN_MEETING: Record<Ohaeng, string> = {
    '목': '학습 모임, 독서 동호회, 자기계발 강좌, 등산 모임에서 좋은 인연을 만날 수 있습니다. 봄철(3~5월)에 새로운 만남의 기회가 특히 많습니다.',
    '화': '파티, 문화 행사, 공연장, SNS, 유튜브 활동에서 인연이 시작됩니다. 여름철(6~8월)에 이성 만남이 활발해집니다.',
    '토': '직장, 동호회, 종교 모임, 소개팅에서 진지한 인연을 만납니다. 환절기(3월, 6월, 9월, 12월)에 좋은 기회가 옵니다.',
    '금': '헬스장, 운동 클럽, 전문가 네트워크, 직장 회식에서 인연이 시작됩니다. 가을철(9~11월)에 이성운이 상승합니다.',
    '수': '여행, 해외 교류, 온라인 커뮤니티, 스터디 모임에서 뜻밖의 인연이 찾아옵니다. 겨울철(12~2월)에 깊은 만남이 이루어집니다.',
  };

  const YONGSIN_MEETING: Record<Ohaeng, string> = {
    '목': ' 행운 장소: 공원, 식물원, 초록색 인테리어 카페, 산책로. 동쪽 방향에서 인연이 시작될 확률이 높습니다.',
    '화': ' 행운 장소: 밝은 레스토랑, 루프탑 바, 페스티벌, 영화관. 남쪽 방향에서의 만남이 좋습니다.',
    '토': ' 행운 장소: 전통 찻집, 베이커리, 부동산 관련 모임, 등산. 집 근처에서 인연이 시작될 수 있습니다.',
    '금': ' 행운 장소: 고급 레스토랑, 전시회, 음악회, 보석·시계 매장 근처. 서쪽 방향에서의 만남이 행운입니다.',
    '수': ' 행운 장소: 물가(강변, 바다), 수영장, 온천, 수족관. 북쪽 방향에서의 만남이 행운을 부릅니다.',
  };

  return ILGAN_MEETING[ilOhaeng] + YONGSIN_MEETING[yongsin];
}

function getMarriageAdvice(saju: SajuResult, gender: 'male' | 'female'): string {
  const sipseongs = saju.sipseongs;
  let advice = '';

  // 남자 정재, 여자 정관 분석
  if (gender === 'male') {
    if (sipseongs.month === '정재' || sipseongs.hour === '정재') {
      advice += '사주에 정재가 있어 결혼 인연이 확실합니다. 가정적이고 내조를 잘하는 배우자를 만날 수 있습니다. ';
    } else if (sipseongs.month === '편재' || sipseongs.hour === '편재') {
      advice += '사주에 편재가 있어 이성 만남은 많지만, 진지한 관계로 발전하려면 노력이 필요합니다. 여러 인연 중 진정한 배우자를 잘 선택하세요. ';
    }
  } else {
    if (sipseongs.month === '정관' || sipseongs.hour === '정관') {
      advice += '사주에 정관이 있어 좋은 남편을 만날 인연이 있습니다. 사회적으로 안정적이고 책임감 있는 배우자가 찾아올 가능성이 높습니다. ';
    } else if (sipseongs.month === '편관' || sipseongs.hour === '편관') {
      advice += '사주에 편관이 있어 강하고 카리스마 있는 남성에게 끌립니다. 때로 관계에서 갈등이 있을 수 있지만, 서로 이해하면 더 깊어지는 관계를 만들 수 있습니다. ';
    }
  }

  // 일간별 결혼 조언 — 신강/신약에 따라 다르게
  const ilOhBal0 = saju.ohaengBalance[saju.day.cheonganOhaeng];
  const ilOh0 = saju.day.cheonganOhaeng;

  if (ilOhBal0 >= 6) {
    // 극신강: 오행 관계없이 "주도하려는 성향" 중심
    const SINGANG_MARRIAGE: Record<Ohaeng, string> = {
      '목': '고집이 매우 세서 "내 방식이 맞다"는 확신이 강합니다. 결혼 후 배우자와 의견이 다를 때 한 발 물러서는 연습이 꼭 필요합니다. 배우자를 이기려 하지 말고, 함께 이기는 관계를 만드세요.',
      '화': '열정이 넘치지만 감정이 과하면 상대를 압도할 수 있습니다. 결혼은 불꽃이 아니라 잔잔한 불씨를 오래 유지하는 것입니다. 감정을 한 템포 늦추는 연습이 행복한 결혼의 열쇠입니다.',
      '토': '고집이 세고 자기 방식을 고수하는 성향이 강합니다. "나는 이렇게 할 거야"보다 "어떻게 하면 좋겠어?"라고 먼저 묻는 습관이 결혼 생활을 크게 바꿉니다. 변화를 두려워하지 마세요.',
      '금': '기준이 매우 높고 배우자에게도 같은 수준을 요구합니다. 완벽한 배우자는 없다는 걸 인정하고, "다름"을 "틀림"으로 보지 않는 것이 핵심입니다.',
      '수': '독자적인 세계가 강해 배우자가 소외감을 느낄 수 있습니다. 속마음을 나누고, 배우자를 자기 세계 안에 초대하는 노력이 필요합니다.',
    };
    advice += SINGANG_MARRIAGE[ilOh0];
  } else if (ilOhBal0 <= 1.5) {
    // 극신약: "맞추려는 성향" 중심
    const SINYAK_MARRIAGE: Record<Ohaeng, string> = {
      '목': '상대에게 맞추다 보면 자기 의견을 포기하게 됩니다. 결혼에서도 자기 목소리를 내는 연습이 필요합니다. 너무 희생적인 관계는 오래 못 갑니다.',
      '화': '상대의 기분에 지나치게 민감해서 눈치를 많이 봅니다. "나도 중요하다"는 마인드를 가지세요. 배우자가 당신을 존중하는 관계를 선택하세요.',
      '토': '남에게 피해 주기 싫어서 참고 또 참는 성격입니다. 하지만 참다가 폭발하면 관계가 크게 흔들립니다. 작은 불만도 그때그때 표현하는 것이 건강한 결혼의 비결입니다.',
      '금': '자신감이 부족해 배우자에게 의존하기 쉽습니다. 경제적·정신적 자립을 유지하면서, 서로 힘을 주는 대등한 관계를 만드세요.',
      '수': '감정을 잘 표현하지 못하고 속으로 삭이는 편입니다. 배우자에게 솔직하게 감정을 나누면 관계가 훨씬 깊어집니다.',
    };
    advice += SINYAK_MARRIAGE[ilOh0];
  } else {
    // 보통: 기본 오행 조언
    const ilganAdvice: Record<Ohaeng, string> = {
      '목': '자존심이 센 편이라 상대방의 의견도 존중하는 연습이 필요합니다. 배우자에게 너무 많은 것을 기대하기보다, 함께 성장하는 관계를 목표로 하세요.',
      '화': '열정적인 만큼 식을 때도 빠를 수 있습니다. 결혼 후에도 연애 때의 설렘을 유지하려는 노력이 중요합니다. 감정 표현을 꾸준히 하세요.',
      '토': '안정을 중시하기에 결혼 생활에 잘 맞는 타입입니다. 다만 지나친 보수성은 배우자를 답답하게 할 수 있으니, 가끔은 새로운 경험에 열린 자세를 가지세요.',
      '금': '완벽주의적 성향이 있어 배우자에게도 높은 기준을 요구할 수 있습니다. "다름"을 "틀림"으로 보지 않고 서로의 차이를 인정하는 것이 행복한 결혼의 열쇠입니다.',
      '수': '감정의 기복이 있을 수 있고 때로 속마음을 안 보여줄 수 있습니다. 배우자에게 솔직하게 표현하는 것이 관계를 더 깊게 만듭니다.',
    };
    advice += ilganAdvice[ilOh0];
  }

  // ── 용신/기신 기반 결혼 조언 ──
  const yongsin = saju.yongsin;
  const gisin = saju.gisin;
  const OH_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };
  const YONGSIN_MARRIAGE: Record<Ohaeng, string> = {
    '목': ` 용신이 목(${OH_KR['목']})이므로, 부부가 함께 새로운 것을 배우거나 자기계발을 하면 관계가 더 좋아집니다. 자연 속 데이트(산책, 등산, 캠핑)가 부부 운을 올리는 행운 활동입니다.`,
    '화': ` 용신이 화(${OH_KR['화']})이므로, 부부가 함께 활동적인 취미(여행, 공연, 운동)를 즐기면 관계가 활성화됩니다. 기념일이나 이벤트를 챙기는 것이 부부 운을 크게 올립니다.`,
    '토': ` 용신이 토(${OH_KR['토']})이므로, 가정 내 안정적인 루틴(함께 식사, 규칙적인 가족 시간)이 결혼 운을 높입니다. 부동산이나 집 꾸미기를 함께하면 유대감이 깊어집니다.`,
    '금': ` 용신이 금(${OH_KR['금']})이므로, 서로의 시간과 공간을 존중하되 정기적인 대화 시간을 가지는 것이 중요합니다. 재무 계획을 함께 세우면 부부 유대감이 강해집니다.`,
    '수': ` 용신이 수(${OH_KR['수']})이므로, 감정을 솔직하게 나누고 깊은 대화를 자주 하는 것이 결혼 운을 올리는 핵심입니다. 해외여행이나 새로운 경험을 함께하면 관계가 새로워집니다.`,
  };
  advice += YONGSIN_MARRIAGE[yongsin];

  return advice;
}

// ========== 재물운 시기 분석 ==========

export interface WealthPrediction {
  peakAges: string[];
  wealthType: string;
  investmentAdvice: string;
  spendingWarning: string;
}

export function analyzeWealth(
  saju: SajuResult,
  daeunPillars: Array<{ cheongan: string; jiji: string; startAge: number; endAge: number; twelveStage: TwelveStage }>
): WealthPrediction {
  const ilOhaeng = saju.day.cheonganOhaeng;

  const peakAges: string[] = [];

  for (const pillar of daeunPillars) {
    if (pillar.startAge > 100) continue;
    const ganOh = CHEONGAN_OHAENG[pillar.cheongan];
    const jiOh = JIJI_OHAENG[pillar.jiji];
    let score = 0;

    // 재성 오행이 들어오면 재물운
    const jaeOhaeng = OHAENG_SANGGEUK[ilOhaeng] ?? ilOhaeng;
    if (ganOh === jaeOhaeng || jiOh === jaeOhaeng) score += 3;

    // 건록, 제왕 = 경제력 최고
    if (['건록', '제왕'].includes(pillar.twelveStage)) score += 2;
    if (['관대', '장생'].includes(pillar.twelveStage)) score += 1;

    if (score >= 3) {
      peakAges.push(`${pillar.startAge}~${pillar.endAge}세`);
    }
  }

  if (peakAges.length === 0) {
    peakAges.push('꾸준히 노력하면 40대 이후 안정적인 재물운이 형성됩니다');
  }

  // 일간(10개)별 재물 유형 — 같은 오행이라도 양/음에 따라 돈 버는 방식이 완전 다름
  const ilgan = saju.ilgan;
  const ILGAN_WEALTH: Record<string, string> = {
    '갑': '큰 나무가 열매를 맺듯, 오랜 시간 투자해서 큰 결실을 얻는 타입입니다. 교육 사업, 특허, 저작권, 프랜차이즈 등 "심어놓고 기다리면 돈이 되는 것"에 강합니다. 급하게 벌려 하면 오히려 잃습니다. 30대 후반~40대에 재물운이 본격적으로 열립니다.',
    '을': '작은 풀이 사방으로 퍼지듯, 인맥과 소통으로 돈을 법니다. SNS 마케팅, 제휴 사업, 위탁판매, 소자본 창업에 강합니다. 큰 자본보다 아이디어와 네트워크가 돈이 됩니다. 꾸준한 부수입이 모여 큰 돈이 됩니다.',
    '병': '태양처럼 화려하게 큰 돈을 벌 수 있지만, 잃는 것도 빠릅니다. 유튜브, 인플루언서, 이벤트 사업, 브랜딩으로 벼락 부자가 될 수도 있습니다. 핵심은 벌 때 반드시 저축/투자 비율을 정해두는 것! 안 그러면 왔다 갔다 합니다.',
    '정': '촛불처럼 꾸준한 수입이 모여 큰 재산이 됩니다. 전문직(작가, 디자이너, 연구원), 강의, 출판 등 "지적 재산"에서 돈이 나옵니다. 한 분야를 깊이 파면 그것이 평생 밥벌이가 됩니다. 부업보다 본업에 집중하세요.',
    '무': '큰 산처럼 부동산과 토지에 타고난 인연이 있습니다! 부동산 투자, 건설업, 임대 사업에서 큰 재산을 모읍니다. "땅을 사서 오래 가지고 있으면 부자가 되는" 전형적인 타입. 급매보다 장기 보유가 핵심입니다.',
    '기': '기름진 밭처럼 꼼꼼하게 모아서 부자가 되는 타입입니다. 적금, 연금, 보험, 소형 임대 등 "안전하고 꾸준한" 재테크가 맞습니다. 한탕주의는 절대 안 맞고, 10년 이상 꾸준히 모으면 주변이 놀랄 만큼 모여있습니다.',
    '경': '강철 같은 결단력으로 투자 타이밍을 잡는 능력이 있습니다. 주식, 펀드, M&A, 사업 인수 등 "과감한 결정이 필요한 투자"에서 큰 수익을 냅니다. 다만 올인은 금물! 분산 투자로 리스크를 관리하세요.',
    '신': '보석을 감별하듯 가치를 알아보는 눈이 탁월합니다. 보석, 귀금속, 미술품, 빈티지 투자에 감각이 있고, 전문 기술(IT, 의료, 금융)로 고수익을 올립니다. "양보다 질"—작지만 비싼 것에 투자하세요.',
    '임': '바다처럼 큰 스케일로 돈을 법니다. 무역, 수출입, 해외 투자, 글로벌 사업에서 큰돈을 만집니다. 국내보다 해외에서 재물운이 강하고, 외화 자산이 유리합니다. 돈이 크게 들어오고 크게 나가는 타입이라 관리가 핵심입니다.',
    '계': '이슬처럼 조용히 모이는 돈이 결국 강이 됩니다. 저축, 보험, 자동이체 투자 등 "눈에 안 보이게 쌓이는" 재테크가 맞습니다. 아이디어로 부수입을 만드는 능력도 있어 콘텐츠, 온라인 사업에서 수입이 생깁니다.',
  };

  // 십성 기반 재물운 보정
  const sipseongs = saju.sipseongs;
  let sipseongWealth = '';
  if (sipseongs.month === '편재' || sipseongs.hour === '편재') {
    sipseongWealth += '\n💰 편재가 있어 큰돈을 만지는 인연이 있습니다! 사업, 투자, 부업 등 여러 수입원을 가질 수 있는 타입. 단, 돈이 들어오는 만큼 나가기도 쉬워 관리가 필수입니다.';
  }
  if (sipseongs.month === '정재' || sipseongs.hour === '정재') {
    sipseongWealth += '\n🏦 정재가 있어 꾸준하고 안정적인 수입이 보장됩니다. 월급쟁이로 성공하거나, 안정적인 사업으로 착실하게 재산을 불립니다.';
  }
  if (sipseongs.month === '식신') {
    sipseongWealth += '\n🎨 월주 식신 — 기술과 재능으로 돈을 법니다. 자격증, 기술, 전문 기술이 직접 수입으로 연결됩니다.';
  }
  if (sipseongs.month === '상관') {
    sipseongWealth += '\n🗣️ 월주 상관 — 남다른 아이디어와 표현력이 돈이 됩니다. 다만 돈에 무관심한 면이 있어, 의식적으로 재무 관리를 해야 합니다.';
  }
  if (sipseongs.month === '비견' || sipseongs.month === '겁재') {
    sipseongWealth += '\n⚡ 월주 비겁 — 경쟁을 통해 돈을 법니다. 승부를 겨루는 분야(영업, 투자, 부동산)에서 성과를 내지만, 보증이나 동업은 금전 손실 위험이 있으니 주의!';
  }

  const investmentAdvices: Record<string, string> = {
    '갑': '장기 투자의 왕. 인덱스 펀드, 부동산 장기 보유, 교육비 투자 등 "시간이 편"이 되는 투자가 맞습니다. 단기 매매는 손실 확률이 높습니다.',
    '을': '소자본 다각화가 핵심. 적금 + 소형 주식 + 부업을 병행하세요. 한 곳에 올인하면 안 됩니다. 인맥을 통한 투자 정보가 돈이 됩니다.',
    '병': '트렌드를 읽는 눈이 있어 성장주·기술주에 강합니다. 다만 흥분해서 올인하는 것은 금물! 벌면 반드시 30%는 안전자산으로 빼두세요.',
    '정': '한 분야에 깊이 파고드는 가치투자가 맞습니다. 오래 공부한 분야에 투자하면 남들보다 정확한 판단을 내립니다. 남의 말에 흔들리지 마세요.',
    '무': '실물 자산(부동산, 금, 토지)에 천부적 감각이 있습니다! 특히 부동산 투자가 최적. "사서 오래 묵히면 부자 되는" 스타일입니다.',
    '기': '적금, 연금, CMA 등 안전 자산이 핵심. 공격적 투자는 맞지 않지만, 10년 이상 꾸준히 모으면 놀라운 결과가 나옵니다.',
    '경': '주식, 펀드, ETF에서 과감한 결단력이 빛납니다. 분석 기반 투자가 강점이지만, 감정이 아닌 데이터로 판단하세요. 분산 투자 필수!',
    '신': '귀금속, 미술품, 빈티지 투자에 감각이 있습니다. "싸게 사서 가치가 오르길 기다리는" 가치 투자가 최적입니다.',
    '임': '해외 주식, 외화 자산, 글로벌 ETF가 유리합니다. 국내보다 해외에서 돈이 잘 벌리는 타입. 환율 변동에 민감하니 헷지 전략도 알아두세요.',
    '계': '자동이체 적금, 로보어드바이저, 소액 분산 투자가 맞습니다. "안 보이게 쌓이는" 방식이 최고. 충동 투자만 안 하면 노후가 편합니다.',
  };

  const spendingWarnings: Record<string, string> = {
    '갑': '⚠️ 체면 지출 주의! 자존심 때문에 과한 지출을 하는 경향이 있습니다. "남에게 보이기 위한 소비"를 줄이세요.',
    '을': '⚠️ 인간관계 지출 주의! 사람 좋아서 남에게 잘 쓰는데, 정작 본인은 부족할 수 있습니다. 내 것 먼저 챙기세요.',
    '병': '⚠️ 충동 구매 주의! 기분 좋을 때 큰 돈을 쓰는 경향이 있습니다. 카드 한도를 줄이고, 하루 뒤에 다시 생각하는 습관을 기르세요.',
    '정': '⚠️ 교육비·문화비 과다 주의! 배움에 대한 투자는 좋지만, 수익으로 연결되지 않는 수강료 지출은 줄이세요.',
    '무': '⚠️ 부동산 과투자 주의! 땅에 대한 욕심이 강해 분수를 넘는 투자를 할 수 있습니다. 여유자금 범위 내에서만!',
    '기': '⚠️ 너무 아끼는 것도 주의! 자신에게 투자하는 것을 아까워하면 성장이 멈춥니다. 자기계발에는 과감하게 쓰세요.',
    '경': '⚠️ 한탕주의 주의! 큰돈을 한번에 벌려는 욕심에 위험한 투자를 할 수 있습니다. 분산, 분할이 핵심입니다.',
    '신': '⚠️ 명품·브랜드 지출 주의! 좋은 것만 고르다 보면 예산이 초과됩니다. 가성비도 중요하다는 것을 기억하세요.',
    '임': '⚠️ 여행·해외 지출 주의! 해외에서 돈 쓰는 것을 좋아해서 여행비가 많이 나갑니다. 예산을 미리 정해두세요.',
    '계': '⚠️ 취미·감성 소비 주의! 분위기에 취해 소비하는 경향이 있습니다. "필요"와 "원함"을 구분하는 연습이 필요합니다.',
  };

  // ── 극신강/극신약일 때 재물 유형 오버라이드 ──
  const ohaengBal = saju.ohaengBalance;
  const ilOhaengBal = ohaengBal[saju.day.cheonganOhaeng] || 0;
  const ilOhKey = saju.day.cheonganOhaeng;
  const SINGANG_WEALTH: Record<Ohaeng, string> = {
    '목': '에너지가 넘쳐서 이것저것 사업을 벌이려 합니다. 하지만 고집이 세서 남의 조언을 안 듣고 밀어붙이다 큰 손실을 볼 위험이 높습니다. 한 가지에 집중하되, 반드시 전문가 의견을 듣고 결정하세요. 돈을 크게 벌 수 있지만 크게 잃기도 쉬운 타입입니다.',
    '화': '돈 버는 속도가 빠르지만, 쓰는 속도는 더 빠릅니다. 충동적 소비와 감정적 투자가 가장 큰 적입니다. 벌면 바로 자동이체로 저축에 넣는 "강제 저축"이 필수. 카드 한도를 줄이고, 큰 지출은 하루 뒤에 결정하세요.',
    '토': '고집이 세서 한번 결정하면 안 바꾸는 성향 때문에, 잘못된 투자에도 끝까지 버티다 손실이 커질 수 있습니다. "내가 맞다"는 확신을 내려놓고 시장 상황에 유연하게 대응하세요. 부동산에만 올인하지 말고 금융자산으로 분산이 핵심입니다.',
    '금': '기준이 높아 "좋은 것만" 사려다 지출이 커집니다. 투자에서도 완벽한 타이밍을 기다리다 기회를 놓치기 쉽습니다. 완벽한 시점은 없으니 분할 매수로 리스크를 줄이세요.',
    '수': '독자적 판단이 강해 남의 투자 조언을 안 듣습니다. 자기만의 분석이 맞을 때도 있지만, 틀릴 때 손실이 큽니다. 반드시 2개 이상 의견을 들은 후 결정하세요.',
  };
  const SINYAK_WEALTH: Record<Ohaeng, string> = {
    '목': '돈에 대한 자신감이 부족하고 투자를 두려워합니다. 안전한 적금·연금 위주로 시작하되, 용신 기운을 가진 분야에 소액이라도 투자하면 자신감이 살아납니다. 소극적으로만 모으면 큰 돈을 만들기 어렵습니다.',
    '화': '돈 관리에 에너지를 쏟기 어려워 방치하기 쉽습니다. 자동이체 적금, 로보어드바이저 등 "알아서 굴러가는" 시스템을 만들어두는 게 핵심입니다. 남에게 재무 관리를 맡기되 맹신하지는 마세요.',
    '토': '돈을 벌어도 남에게 쓰거나, 참고 참다가 한꺼번에 써버리는 패턴이 있습니다. 작은 지출도 기록하는 습관이 필수입니다. 자기 돈은 자기가 지키겠다는 마인드가 먼저 필요합니다.',
    '금': '자신감 부족으로 남의 투자 권유에 쉽게 따라가다 손해를 봅니다. 금융 교육을 먼저 받고, 이해하지 못하는 투자에는 절대 돈을 넣지 마세요.',
    '수': '감정에 따라 지출이 흔들리고, 돈 관리를 귀찮아합니다. 통장을 나눠서 생활비/저축/투자를 자동으로 분리하고, 월 1회 재무 점검하는 루틴을 만드세요.',
  };

  let wealthBase: string;
  if (ilOhaengBal >= 6) {
    wealthBase = SINGANG_WEALTH[ilOhKey] || ILGAN_WEALTH[ilgan] || ILGAN_WEALTH['갑'];
  } else if (ilOhaengBal <= 1.5) {
    wealthBase = SINYAK_WEALTH[ilOhKey] || ILGAN_WEALTH[ilgan] || ILGAN_WEALTH['갑'];
  } else {
    wealthBase = ILGAN_WEALTH[ilgan] || ILGAN_WEALTH['갑'];
  }

  // ★ 용신/기신 기반 투자 조언 추가
  const yongsin = saju.yongsin;
  const gisin = saju.gisin;
  const yongsinBal = ohaengBal[yongsin] || 0;

  // 용신 오행별 유리한 투자 분야
  const YONGSIN_INVEST: Record<Ohaeng, string> = {
    '목': '📗 용신 목(木) 투자: 교육 사업, 출판, 친환경 기업, 목재·가구 관련 투자가 유리합니다. 성장주, ESG 펀드에서 좋은 결과가 나옵니다.',
    '화': '📕 용신 화(火) 투자: IT·전기전자, 미디어, 엔터테인먼트, 태양광 등 "빛과 에너지" 관련 투자가 유리합니다. 기술주, 성장형 ETF가 체질에 맞습니다.',
    '토': '📙 용신 토(土) 투자: 부동산, 건설, 식품, 농업 관련 투자가 유리합니다. 실물 자산(부동산, 토지)에서 안정적 수익을 기대할 수 있습니다.',
    '금': '📘 용신 금(金) 투자: 금융상품(펀드, 적금, 보험), 귀금속(금, 은), 자동차·기계 관련 주식이 유리합니다. 특히 금(골드) 투자가 행운을 불러옵니다. 안정적이고 체계적인 재테크가 돈을 불립니다.',
    '수': '📓 용신 수(水) 투자: 해외 주식, 외화 자산, 무역·물류 관련 투자가 유리합니다. 해외 ETF, 달러 자산에서 좋은 성과를 기대할 수 있습니다.',
  };

  // 기신 오행별 피해야 할 투자
  const GISIN_INVEST_WARN: Record<Ohaeng, string> = {
    '목': '🚫 기신 목(木) 주의: 무리한 사업 확장, 과도한 경쟁이 필요한 투자는 손실 위험이 큽니다.',
    '화': '🚫 기신 화(火) 주의: 감정적·충동적 투자(주식 단타, 코인, 핫한 트렌드 추종)는 큰 손실을 부릅니다. 뜨거운 시장일수록 냉정하게 판단하세요.',
    '토': '🚫 기신 토(土) 주의: 부동산 과투자, 보증, 땅 투기는 오히려 독이 됩니다. 분수를 넘는 실물 투자를 경계하세요.',
    '금': '🚫 기신 금(金) 주의: 금융 레버리지(대출 투자, 신용거래)는 위험합니다. 공격적인 금융상품은 피하세요.',
    '수': '🚫 기신 수(水) 주의: 해외 투자, 환율 리스크가 큰 자산은 손실 위험이 있습니다. 검증되지 않은 해외 사업 투자에 주의하세요.',
  };

  let yongsinInvestNote = '\n\n' + YONGSIN_INVEST[yongsin];
  yongsinInvestNote += '\n' + GISIN_INVEST_WARN[gisin];

  // ★ 오행 과다 시 일간 기본 투자 조언 보정
  // 예: 무토인데 토가 과다(6 이상)하면 "부동산에만 의존하지 말라" 경고
  let overflowNote = '';
  if (ilOhaengBal >= 6) {
    const OVERFLOW_WARN: Record<Ohaeng, string> = {
      '목': '\n⚠️ 목 기운 과다: 교육·확장에 과도하게 투자하는 경향이 있습니다. 다른 분야로 분산하세요.',
      '화': '\n⚠️ 화 기운 과다: 충동적 투자·소비에 빠지기 쉽습니다. 냉철한 판단이 필요합니다.',
      '토': '\n⚠️ 토 기운 과다: 부동산·토지에만 집착하면 유동성이 부족해집니다. 금융자산(적금, 펀드, 금)으로 반드시 분산하세요!',
      '금': '\n⚠️ 금 기운 과다: 지나치게 보수적인 투자만 하면 기회를 놓칩니다. 적절한 모험도 필요합니다.',
      '수': '\n⚠️ 수 기운 과다: 이것저것 손대다 흩어질 수 있습니다. 한두 가지에 집중하세요.',
    };
    overflowNote = OVERFLOW_WARN[ilOhaeng] || '';
  }

  // ★ 신강 비겁과다 재물 관리 경고
  const { analyzeSingang: asg } = require('./daeun');
  const sgResult = asg(saju);
  let singangWealthNote = '';
  if (sgResult.type === '극신강') {
    singangWealthNote = `\n\n💸 【극신강 재물 관리 핵심】 에너지가 넘쳐서 돈을 크게 벌 수 있지만, 쓰는 것도 큽니다! 남에게 한턱 내기, 보증 서기, 동업은 반드시 피하세요. 벌면 바로 자동이체로 적금·투자에 넣는 "강제 저축" 시스템이 필수입니다. 통장을 3개로 나눠서 관리하세요 (생활비 / 투자·저축 / 비상금). 특히 용신(${yongsin}) 관련 투자에 돈을 넣으면 재물운이 열립니다.`;
  } else if (sgResult.type === '신강' && (sgResult.bigyeopCount >= 3 || ilOhaengBal >= 5)) {
    singangWealthNote = '\n\n💸 【신강 재물 관리】 에너지가 넘치는 만큼 지출도 큰 편입니다. 보증·동업은 금전 분쟁 위험이 높으니 조심하세요. 수입의 일정 비율을 자동 저축하는 습관이 중요합니다.';
  }

  // 건강 교차검증: 극도 부족 오행 → 재물운 경고
  const ctx = extractSajuContext(saju);
  let healthWealthNote = '';
  if (ctx.isExtremeWeak && ctx.weakOh) {
    healthWealthNote = `\n\n⚠️ 【건강↔재물 교차분석】 ${ctx.weakOh}(${WEAK_OHAENG_ORGAN[ctx.weakOh]}) 기운이 극도로 부족합니다. 건강이 뒷받침되지 않으면 재물운도 제대로 활용할 수 없습니다. `;
    if (ctx.weakOh === '토') healthWealthNote += '위장이 약해 부동산·음식업 투자는 신중해야 합니다. 규칙적 식사가 가능한 환경에서 재물을 키우세요.';
    else if (ctx.weakOh === '화') healthWealthNote += '불안·공황으로 판단력이 흐려질 때 투자 결정을 피하세요. 안정적인 패시브 인컴(적금, 연금, 자동투자)이 체질에 맞습니다.';
    else if (ctx.weakOh === '목') healthWealthNote += '만성 피로가 있으면 사업 확장보다 현상 유지가 현명합니다. 체력 회복 후 재도전하세요.';
    else if (ctx.weakOh === '금') healthWealthNote += '호흡기가 약해 대면 영업·강의 기반 수입은 한계가 있습니다. 온라인·비대면 수입원을 키우세요.';
    else if (ctx.weakOh === '수') healthWealthNote += '허리·신장이 약해 장시간 근무가 어려울 수 있습니다. 짧은 시간 고효율 작업으로 수입을 올리세요.';
  }

  // ── 극신강/극신약 투자 조언 오버라이드 ──
  const SINGANG_INVEST: Record<Ohaeng, string> = {
    '목': '고집대로 밀어붙이는 투자는 금물! 반드시 분산 투자하고, 한 종목에 전 재산을 걸지 마세요. 장기 인덱스 펀드가 가장 안전합니다.',
    '화': '흥분해서 올인하는 것이 가장 위험합니다! 투자 결정은 반드시 하루 뒤에 하세요. 수익의 30%는 무조건 안전자산으로 빼두는 원칙이 필수입니다.',
    '토': '부동산에만 집착하면 유동성 위기가 옵니다! 부동산 비중은 총 자산의 50% 이하로 제한하고, 나머지는 금융자산(펀드, 적금, 금)으로 분산하세요.',
    '금': '완벽한 타이밍을 기다리다 기회를 놓깁니다. 분할 매수가 정답이고, 남의 투자에 비판만 하지 말고 직접 소액으로 시작하세요.',
    '수': '독단적 판단으로 큰 베팅을 하지 마세요. 전문가 2명 이상의 의견을 듣고, 해외 투자는 환율 리스크를 반드시 헷지하세요.',
  };
  const SINYAK_INVEST: Record<Ohaeng, string> = {
    '목': '투자가 두려워도 적금만으로는 자산이 늘지 않습니다. 소액 적립식 펀드부터 시작해 자신감을 키우세요.',
    '화': '자동이체 적금·로보어드바이저 등 "손 안 대도 알아서 굴러가는" 투자가 최적입니다. 직접 매매는 피하세요.',
    '토': '남의 권유에 휘둘리지 않으려면 기본 금융 지식이 필수입니다. 소액 적금부터 시작해서 돈에 대한 감각을 키우세요.',
    '금': '이해하지 못하는 투자에는 절대 돈을 넣지 마세요. 국채, 적금 등 원금 보장 상품으로 안정감을 먼저 확보하세요.',
    '수': '월 자동이체로 적금·연금을 꾸준히 넣는 것이 가장 좋은 전략입니다. 충동 매매만 안 하면 됩니다.',
  };

  let baseInvest: string;
  if (ilOhaengBal >= 6) {
    baseInvest = SINGANG_INVEST[ilOhKey] || investmentAdvices[ilgan] || investmentAdvices['갑'];
  } else if (ilOhaengBal <= 1.5) {
    baseInvest = SINYAK_INVEST[ilOhKey] || investmentAdvices[ilgan] || investmentAdvices['갑'];
  } else {
    baseInvest = investmentAdvices[ilgan] || investmentAdvices['갑'];
  }

  // 투자 조언에도 용신 반영
  const YONGSIN_INVEST_SHORT: Record<Ohaeng, string> = {
    '목': ' 특히 교육·출판·환경 관련 투자에서 행운이 따릅니다.',
    '화': ' 특히 IT·전기전자·미디어 관련 투자에서 행운이 따릅니다.',
    '토': ' 특히 부동산·식품·건설 관련 투자에서 행운이 따릅니다.',
    '금': ' 특히 금(골드)·금융상품·기계·자동차 관련 투자에서 행운이 따릅니다.',
    '수': ' 특히 해외자산·외화·물류 관련 투자에서 행운이 따릅니다.',
  };
  const fullInvestAdvice = baseInvest + (YONGSIN_INVEST_SHORT[yongsin] || '');

  // ── 극신강/극신약 지출 경고 오버라이드 ──
  const SINGANG_SPENDING: Record<Ohaeng, string> = {
    '목': '⚠️ 극신강 지출 주의! 자존심 때문에 남에게 한턱 크게 내거나, "나는 이 정도는 써야지"라는 생각으로 분수 넘는 소비를 합니다. 보증·동업은 절대 금물!',
    '화': '⚠️ 극신강 지출 주의! 기분 좋으면 지갑이 열리고, 화나면 스트레스 소비를 합니다. 감정과 지갑을 분리하세요. 카드 한도를 월 수입의 30% 이하로 제한!',
    '토': '⚠️ 극신강 지출 주의! "내가 결정한 건 맞다"는 고집 때문에 잘못된 투자에도 끝까지 버팁니다. 손절 기준을 미리 정해두세요. 부동산 과투자가 가장 큰 위험!',
    '금': '⚠️ 극신강 지출 주의! 좋은 것만 사려는 완벽주의 때문에 지출이 많습니다. "가성비"라는 단어를 기억하세요. 명품보다 자산에 돈을 넣으세요.',
    '수': '⚠️ 극신강 지출 주의! 자기만의 세계에 빠져 현실적 돈 관리를 소홀히 합니다. 월 1회 재무 점검을 반드시 하고, 가계부 앱을 사용하세요.',
  };
  const SINYAK_SPENDING: Record<Ohaeng, string> = {
    '목': '⚠️ 극신약 지출 주의! 남에게 NO를 못 해서 돈을 빌려주거나, 불필요한 지출에 끌려다닙니다. "내 돈은 내가 지킨다"는 원칙을 세우세요.',
    '화': '⚠️ 극신약 지출 주의! 기분이 처지면 보상 소비를 합니다. 우울할 때 쇼핑몰을 열지 마세요. 감정이 가라앉은 후에 결정하세요.',
    '토': '⚠️ 극신약 지출 주의! 참고 참다가 한꺼번에 폭발적으로 쓰는 패턴이 있습니다. 작은 지출로 스트레스를 해소하는 건전한 취미를 만드세요.',
    '금': '⚠️ 극신약 지출 주의! 남의 권유에 약해서 필요 없는 보험·금융상품에 가입하기 쉽습니다. "생각해보겠습니다"를 먼저 말하는 연습을 하세요.',
    '수': '⚠️ 극신약 지출 주의! 감정에 따라 지출이 흔들립니다. 통장을 3개(생활비/저축/비상금)로 나누고, 생활비 통장으로만 소비하세요.',
  };

  let spendingWarn: string;
  if (ilOhaengBal >= 6) {
    spendingWarn = SINGANG_SPENDING[ilOhKey] || spendingWarnings[ilgan] || spendingWarnings['갑'];
  } else if (ilOhaengBal <= 1.5) {
    spendingWarn = SINYAK_SPENDING[ilOhKey] || spendingWarnings[ilgan] || spendingWarnings['갑'];
  } else {
    spendingWarn = spendingWarnings[ilgan] || spendingWarnings['갑'];
  }

  return {
    peakAges,
    wealthType: adjustTextByChildren(wealthBase + sipseongWealth + yongsinInvestNote + overflowNote + singangWealthNote + healthWealthNote, saju.hasChildren),
    investmentAdvice: fullInvestAdvice,
    spendingWarning: spendingWarn,
  };
}

// ========== 인생 타임라인 요약 ==========

export interface TimelineAreaScores {
  study: number;   // 학업운 (1~10)
  money: number;   // 재물운 (1~10)
  love: number;    // 연애운 (1~10)
  health: number;  // 건강운 (1~10)
  career: number;  // 직업운 (1~10)
}

export interface LifeTimelineEvent {
  ageRange: string;
  title: string;
  description: string;
  icon: string;
  score: number; // 1~10
  areaScores?: TimelineAreaScores; // 영역별 점수 (1~10)
  daeunGanji?: string;   // 대운 간지
  stage?: string;        // 12운성
  stars?: number;        // 별점 (1~5)
  // 영역별 상세 정보 (구조화)
  detailCareer?: string;   // 직업/학업 관련
  detailWealth?: string;   // 재물/재정 관련
  detailLove?: string;     // 애정/관계 관련
  detailHealth?: string;   // 건강 관련
  detailGeneral?: string;  // 합충/오행/격국 등 종합
  familyNotes?: string[];  // 가족관계(궁위) 해석
}

export function generateLifeTimeline(
  saju: SajuResult,
  daeunPillars: Array<{ cheongan: string; jiji: string; startAge: number; endAge: number; twelveStage: TwelveStage; score?: number; areaScores?: { study: number; money: number; love: number; health: number; career: number } }>
): LifeTimelineEvent[] {
  const events: LifeTimelineEvent[] = [];

  for (const pillar of daeunPillars) {
    if (pillar.startAge > 100) continue; // 101세 이후 생략
    const stage = pillar.twelveStage;
    const stageData = TWELVE_STAGE_DATA[stage];
    const ganOh = CHEONGAN_OHAENG[pillar.cheongan];
    const jiOh = JIJI_OHAENG[pillar.jiji];
    const ilOhaeng = saju.day.cheonganOhaeng;

    let title = '';
    let description = '';
    let icon = '';

    // ★ 대운 천간의 십성 계산 (대운 해석의 핵심!)
    const daeunGanSipseong = calculateSipseong(saju.ilgan, pillar.cheongan);
    const daeunJiSipseong = calculateSipseong(saju.ilgan, pillar.jiji);
    const daeunGanJi = `${pillar.cheongan}${pillar.jiji}`;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ★ 입체적 점수 계산 (다층 분석)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const isYongsinGan = ganOh === saju.yongsin;
    const isYongsinJi = jiOh === saju.yongsin;
    const isGisinGan = ganOh === saju.gisin;
    const isGisinJi = jiOh === saju.gisin;
    const yongsinHit = isYongsinGan || isYongsinJi;
    const gisinHit = isGisinGan || isGisinJi;
    const doubleYongsin = isYongsinGan && isYongsinJi;
    const doubleGisin = isGisinGan && isGisinJi;

    const stageScore = stageData.energy; // 1~10

    // (A) 희기신 5단계 분석
    const ganClass = classifyHeegishin(ganOh, saju.yongsin, saju.gisin, ilOhaeng);
    const jiClass = classifyHeegishin(jiOh, saju.yongsin, saju.gisin, ilOhaeng);
    const isJeongTL = ['정재', '정관', '정인', '식신'].includes(daeunGanSipseong);
    const ganW_tl = (ganClass.weight < 0 && isJeongTL) ? ganClass.weight * 0.5 : ganClass.weight;
    const jiW_tl = (jiClass.weight < 0 && isJeongTL) ? jiClass.weight * 0.5 : jiClass.weight;
    // 희기신 방향점수: -4 ~ +4
    let directionScore = ganW_tl + jiW_tl;
    // 시너지/충돌 보너스
    if (ganClass.role === '용신' && jiClass.role === '용신') directionScore += 0.5;
    if (ganClass.role === '기신' && jiClass.role === '기신') directionScore -= 0.5;
    if ((ganClass.role === '용신' && jiClass.role === '희신') || (ganClass.role === '희신' && jiClass.role === '용신')) directionScore += 0.3;

    // (B) 오행 밸런스 변화 시뮬레이션
    const { balanceMod: balMod_tl } = simulateBalanceChange(saju.ohaengBalance, ganOh, jiOh);

    // (C) 천간-지지 간 생극제화
    const { ganJiMod: gjMod_tl } = analyzeGanJiRelation(ganOh, jiOh, ilOhaeng);

    // (D) 십성 × 신강/신약 교차 보정
    const ilOhBal_tl = saju.ohaengBalance[ilOhaeng] || 0;
    const ss_tl = saju.strengthScore;
    const isSingang = ss_tl != null ? ss_tl >= 40 : ilOhBal_tl >= 5;
    const isExtSingang = ss_tl != null ? ss_tl >= 65 : ilOhBal_tl >= 6;
    const isExtSinyak = ss_tl != null ? ss_tl < 15 : ilOhBal_tl <= 1.5;

    let SIPSEONG_SCORE_MOD: Record<Sipseong, number>;
    if (isExtSingang) {
      SIPSEONG_SCORE_MOD = {
        '비견': -1.2, '겁재': -1.2, '식신': +1.2, '상관': +0.8,
        '편재': +0.8, '정재': +1.2, '편관': +0.3, '정관': +0.8,
        '편인': -0.8, '정인': -0.8,
      };
    } else if (isExtSinyak) {
      SIPSEONG_SCORE_MOD = {
        '비견': +1.2, '겁재': +0.8, '식신': +0.3, '상관': -0.3,
        '편재': -0.8, '정재': -0.3, '편관': -1.2, '정관': -0.3,
        '편인': +0.8, '정인': +1.2,
      };
    } else if (isSingang) {
      SIPSEONG_SCORE_MOD = {
        '비견': -0.3, '겁재': -0.7, '식신': +0.8, '상관': +0.4,
        '편재': +0.4, '정재': +0.8, '편관': -0.3, '정관': +0.4,
        '편인': -0.3, '정인': +0.4,
      };
    } else {
      SIPSEONG_SCORE_MOD = {
        '비견': +0.3, '겁재': -0.3, '식신': +0.4, '상관': +0.3,
        '편재': +0.3, '정재': +0.7, '편관': -0.7, '정관': +0.4,
        '편인': +0.3, '정인': +0.7,
      };
    }
    let sipseongMod = SIPSEONG_SCORE_MOD[daeunGanSipseong] || 0;
    // 정계열 길신이 기신 오행이면 감점 완화
    if (sipseongMod > 0 && isGisinGan) sipseongMod *= 0.5;
    if (sipseongMod < 0 && isYongsinGan) sipseongMod *= 0.5;

    // 최종 점수 합산: 12운성 에너지(30%) + 희기신 방향(40%) + 밸런스변화(15%) + 생극제화(15%) + 십성
    const directionScaled = (directionScore + 4) / 8 * 10; // -4~+4 → 0~10
    let score = Math.round(
      stageScore * 0.30 +
      directionScaled * 0.40 +
      (5 + balMod_tl) * 0.15 +
      (5 + gjMod_tl * 2) * 0.15 +
      sipseongMod
    );
    score = Math.max(1, Math.min(10, score));

    // 기신/편관 상한 (입체 분석으로 완화)
    if (doubleGisin) score = Math.min(4, score);
    else if (gisinHit && !yongsinHit && ganClass.role !== '희신' && jiClass.role !== '희신') score = Math.min(7, score);

    // 극신강/극신약 상한
    if (isExtSingang) {
      const isBigyeop = ['비견', '겁재'].includes(daeunGanSipseong);
      const isInseong = ['편인', '정인'].includes(daeunGanSipseong);
      if (isBigyeop && !yongsinHit) score = Math.min(5, score);
      if (isInseong && !yongsinHit) score = Math.min(5, score);
      if (isBigyeop && gisinHit) score = Math.min(3, score);
    }
    if (isExtSinyak) {
      const isGwanseong = ['편관', '정관'].includes(daeunGanSipseong);
      const isJaeseong = ['편재', '정재'].includes(daeunGanSipseong);
      if (isGwanseong && !yongsinHit) score = Math.min(4, score);
      if (isJaeseong && gisinHit) score = Math.min(5, score);
    }

    // 용신 하한 (더 관대하게)
    if (doubleYongsin) score = Math.max(7, score);
    else if (yongsinHit && !gisinHit) score = Math.max(5, score);

    // ★★ 격국(格局) 보정
    const gyeokguk = determineGyeokguk(saju);
    if (gyeokguk.favorableSipseongs.includes(daeunGanSipseong)) score += 0.5;
    if (gyeokguk.unfavorableSipseongs.includes(daeunGanSipseong)) score -= 0.5;
    // 종격 파격: 종격인데 불리 십성이 대운에 오면 큰 감점
    if (gyeokguk.group === '종격' && gyeokguk.unfavorableSipseongs.includes(daeunGanSipseong)) {
      score -= 1;
    }

    // ★★ 조후용신(調候用神) 보정
    const johu = determineJohu(saju);
    if (johu.johuYongsin) {
      if (ganOh === johu.johuYongsin || jiOh === johu.johuYongsin) {
        score += johu.priority === '급' ? 1.0 : 0.5;
      }
    }
    if (johu.johuGisin) {
      if (ganOh === johu.johuGisin || jiOh === johu.johuGisin) {
        score -= johu.priority === '급' ? 0.7 : 0.3;
      }
    }

    // ★★ 합충(合沖) 보정 — 대운과 원국 간 합충 분석
    const sajuPillars = [
      { cheongan: saju.year.cheongan, jiji: saju.year.jiji },
      { cheongan: saju.month.cheongan, jiji: saju.month.jiji },
      { cheongan: saju.day.cheongan, jiji: saju.day.jiji },
      { cheongan: saju.hour.cheongan, jiji: saju.hour.jiji },
    ];
    const hapChung = analyzeHapChung(sajuPillars, { cheongan: pillar.cheongan, jiji: pillar.jiji }, undefined, saju.ilgan);
    // 대운 점수에 합충이 이미 반영되므로 ×0.6 감쇠하여 이중 반영 완화
    const hapBonus = (hapChung.yukhapCount * 0.3 + hapChung.samhapCount * 0.5) * 0.6;
    const chungPenalty = hapChung.chungCount * -0.5 * 0.6;
    score += hapBonus + chungPenalty;
    // 격변 분위기면 추가 감점 (×0.6 감쇠)
    if (hapChung.overallMood === '격변') score -= 0.3;

    // ★★ 지장간 심층분석 (본기/중기/여기 가중치)
    const { jangganScore: jgScore_tl } = analyzeJangganDeep(
      pillar.jiji, saju.ilgan, saju.yongsin, saju.gisin, ilOhaeng,
    );
    score += jgScore_tl * 0.5; // 대운 지지 지장간 분석 반영 (대운과 동일 50%)

    // ★★ 천간합 결과 오행 분석
    const sajuGans_tl = [saju.year.cheongan, saju.month.cheongan, saju.day.cheongan, saju.hour.cheongan];
    const { hapScore: hapResultScore_tl } = analyzeCheonganHapResult(
      pillar.cheongan, sajuGans_tl, saju.yongsin, saju.gisin,
    );
    score += hapResultScore_tl * 0.8; // 대운과 유사 수준

    // ★★ 원국 합충 해소/강화 분석
    const { changeMod: wonGukChange_tl } = analyzeWonGukHapChungChange(saju, pillar.jiji);
    score += wonGukChange_tl * 0.8; // 대운과 유사 수준

    // ★★ 공망(空亡) 판별
    const { isGongmang: isGM_tl, effect: gmEffect_tl } = checkGongmang(
      saju.day.cheongan, saju.day.jiji, pillar.jiji,
    );
    if (isGM_tl) {
      // 용신이 공망이면 나쁨, 기신이 공망이면 전화위복
      if (isYongsinJi) score -= 0.5;
      else if (isGisinJi) score += 0.3;
      else score += gmEffect_tl * 0.2;
    }

    // ★★ 12운성 의미적 세분화 (십성×12운성 시너지)
    const { stageMod: stageMod_tl } = get12StageContextMod(stage, daeunGanSipseong, isSingang);
    score += stageMod_tl * 0.8; // 대운과 유사 수준

    // ★★ 천간충(天干沖) 분석
    const sajuGans_tlFull = [saju.year.cheongan, saju.month.cheongan, saju.day.cheongan, saju.hour.cheongan];
    const { chungMod: ganChungMod_tl } = analyzeCheonganChung(pillar.cheongan, sajuGans_tlFull, saju.yongsin, saju.gisin);
    score += ganChungMod_tl * 0.8; // 대운과 유사 수준

    // ★★ 암합(暗合) 분석
    const wonJiji_tl = [saju.year.jiji, saju.month.jiji, saju.day.jiji, saju.hour.jiji];
    const { amhapMod: amhapMod_tl } = analyzeAmhap(pillar.jiji, wonJiji_tl, saju.yongsin, saju.gisin);
    score += amhapMod_tl * 0.8; // 대운과 유사 수준

    // ★★ 추가 신살 종합 (12신살 + 원진/귀문관 + 천덕/월덕)
    const advSinsal_tl = analyzeAdvancedSinsal(
      pillar.jiji, pillar.cheongan, saju.day.jiji, saju.year.jiji,
      saju.month.jiji, saju.yongsin, saju.gisin, wonJiji_tl
    );
    score += advSinsal_tl.sinsalMod * 0.8; // 대운과 유사 수준

    // ★★ 투합(妬合) 판별
    const { tuhapMod: tuhapMod_tl } = checkTuhap(pillar.cheongan, sajuGans_tlFull);
    score += tuhapMod_tl * 0.8; // 대운과 유사 수준

    // ★★ 공망 진공/반공 세밀 판별
    const gmDetail_tl = analyzeGongmangDetail(saju.day.cheongan, saju.day.jiji, pillar.jiji, wonJiji_tl);
    if (gmDetail_tl.isJingong && isGM_tl) {
      score += (gmDetail_tl.gongmangMod - gmEffect_tl * 0.2) * 0.5; // 기존 공망 차이분만 보정
    } else if (gmDetail_tl.isBangong && isGM_tl) {
      score += (gmDetail_tl.gongmangMod - gmEffect_tl * 0.2) * 0.5;
    }

    // ★★ 형충파해 합 해소
    const { resolveMod: resolveMod_tl } = analyzeHapResolution(pillar.jiji, wonJiji_tl);
    score += resolveMod_tl * 0.8; // 대운과 유사 수준

    // ★★ 4주(연주/월주/일주/시주) 관계도 분석
    const pillarRel_tl = analyzePillarRelations(saju, ganOh, jiOh, pillar.jiji);
    // 구조적 영향
    score += pillarRel_tl.structuralScore * 0.15; // 대운과 동일
    // 운이 원국 관계를 활성화/약화하는 정도
    score += pillarRel_tl.runActivation * 1.0; // 대운과 동일
    // 영역별 보정 평균도 종합 점수에 반영
    const tlAreaAvg = (pillarRel_tl.areaModifiers.study + pillarRel_tl.areaModifiers.money +
      pillarRel_tl.areaModifiers.love + pillarRel_tl.areaModifiers.health +
      pillarRel_tl.areaModifiers.career) / 5;
    score += tlAreaAvg * 0.25;
    // 십성 시너지/충돌 details 기반 추가 보정
    for (const d of pillarRel_tl.details) {
      if (d.includes('삼합 완성') && d.includes('용신')) score += 0.3;
      if (d.includes('삼합 완성') && d.includes('기신')) score -= 0.2;
      if (d.includes('통관 역할')) score += 0.2;
      if (d.includes('기신 비화를 강화')) score -= 0.15;
      if (d.includes('기신 제압')) score += 0.15;
    }

    // ★★ 시기별 맥락 + 궁위(宮位) 심층 분석
    const lifePhase_tl = analyzeLifePhaseContext(saju, pillar.startAge, ganOh, jiOh, pillar.jiji);
    // 시기별 영역 보너스의 가중합을 종합 점수에 반영
    const phaseSum_tl = lifePhase_tl.areaBonus.study * lifePhase_tl.areaWeights.study +
      lifePhase_tl.areaBonus.money * lifePhase_tl.areaWeights.money +
      lifePhase_tl.areaBonus.love * lifePhase_tl.areaWeights.love +
      lifePhase_tl.areaBonus.health * lifePhase_tl.areaWeights.health +
      lifePhase_tl.areaBonus.career * lifePhase_tl.areaWeights.career;
    score += phaseSum_tl * 0.2; // 대운과 동일
    // 궁위 질 반영
    const gungwi_tl = (lifePhase_tl.educationQuality + lifePhase_tl.spouseQuality +
      lifePhase_tl.wealthStructure + lifePhase_tl.careerFoundation) / 4;
    score += gungwi_tl * 0.1; // 대운과 동일
    score -= lifePhase_tl.healthVulnerability * 0.05; // 대운과 동일

    score = Math.max(1, Math.min(10, score)); // round 하지 않음 — 블렌딩에서 소수점 정보 보존

    // ★★ 대운 점수 앵커 블렌딩: 같은 대운주이므로 대운 점수와 수렴
    // 타임라인 자체 계산 50% + 대운 점수 50% (대운과의 괴리 최소화)
    if (pillar.score != null) {
      score = Math.max(1, Math.min(10, Math.round(score * 0.5 + pillar.score * 0.5)));
    } else {
      score = Math.round(score);
    }

    // ★ 편관/칠살운은 12운성이 좋아도 압박·시련의 시기
    const isGwansal = daeunGanSipseong === '편관';
    // ★ 식신/정재/정인운은 12운성이 낮아도 길한 기운
    const isGilsin = ['식신', '정재', '정인', '정관'].includes(daeunGanSipseong);
    // ★ 상관/겁재운은 12운성이 높아도 변동·충돌의 기운
    const isHyungsin = ['상관', '겁재'].includes(daeunGanSipseong);

    // 12운성별 인생 이벤트 — 용신/기신 반영하여 세밀하게
    switch (stage) {
      case '장생':
        if (doubleGisin) {
          title = '새 출발이 힘겨운 시기';
          icon = '🌱';
          description = `${daeunGanJi} 대운에 장생의 새 출발 기운이 있지만, 천간·지지 모두 기신(${saju.gisin})이라 환경 적응이 매우 힘듭니다. 새로운 곳에서 외로움과 스트레스를 겪을 수 있지만, 이 경험이 나중에 큰 자산이 됩니다.`;
        } else if (isGwansal) {
          title = '새 출발이지만 시련도 함께';
          icon = '🌱';
          description = `${daeunGanJi} 대운에 새로운 시작의 에너지가 있지만, ${daeunGanSipseong}의 기운으로 초반부터 강한 압박이 동반됩니다. 어려운 환경에서 시작하지만, 이 시련이 오히려 단단한 기초가 됩니다.`;
        } else if (yongsinHit) {
          title = '새로운 시작 + 행운의 바람';
          icon = '🌱';
          description = `${daeunGanJi} 대운이 용신(${saju.yongsin})의 기운을 가져와 새 출발이 순조롭습니다! 이사, 전직, 학업 등 새로운 도전이 좋은 결과로 이어집니다. 귀인의 도움이 있고, 새로운 인연도 들어옵니다.`;
        } else if (gisinHit) {
          title = '신중한 새 출발의 시기';
          icon = '🌱';
          description = `${daeunGanJi} 대운에 새 출발의 기운이 있지만, 기신(${saju.gisin}) 기운이 섞여 있어 신중하게 움직여야 합니다. 준비를 철저히 하고, 큰 변화보다 작은 변화부터 시작하세요.`;
        } else {
          title = isGilsin ? '순조로운 새 출발' : '새로운 시작의 시기';
          icon = '🌱';
          description = `${daeunGanJi} 대운에 새 출발의 기운이 찾아옵니다. ${isGilsin ? daeunGanSipseong + '의 기운이 안정적인 시작을 돕습니다. ' : ''}이사, 전직, 학업 시작 등 삶에 큰 변화가 시작됩니다.`;
        }
        break;
      case '목욕':
        if (doubleGisin) {
          title = '감정 혼란과 환경 부적응의 시기';
          icon = '🌊';
          description = `${daeunGanJi} 대운에 목욕운의 변화 기운에 천간·지지 모두 기신(${saju.gisin})이 작용하여 감정적으로 매우 불안정합니다. 환경 적응이 어렵고, 대인관계에서 상처받기 쉽습니다. 안정적인 사람 곁에 머무는 것이 중요합니다.`;
        } else if (isGwansal) {
          title = '감정 기복과 외부 압박의 시기';
          icon = '🌊';
          description = `${daeunGanJi} 대운에 목욕운의 감정 변화에 ${daeunGanSipseong}의 압박이 더해져 마음이 불안정할 수 있습니다. 대인관계에서 갈등이 생기기 쉽고, 충동적인 결정은 후회를 부릅니다. 마음을 다스리는 훈련(명상, 운동)이 큰 도움이 됩니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '급격한 변화와 유혹의 시기';
          icon = '🌊';
          description = `${daeunGanJi} 대운에 ${daeunGanSipseong}의 기운이 목욕운과 만나 변화가 매우 급격합니다. 이직, 이사, 이별 등 예상치 못한 전환이 일어날 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 충동적 에너지가 감정을 앞세운 결정을 유도하므로, 큰 결정(이직·투자·이사) 전에 반드시 3일간 숙고하세요. 주변 사람의 도움 요청이나 금전 거래에 특히 신중해야 합니다.' : '상관의 날카로운 표현력이 대인관계에서 마찰을 일으킬 수 있습니다. 말 한마디가 관계를 크게 흔들 수 있으니 감정 조절이 핵심입니다.'}`;
        } else if (yongsinHit && isGilsin) {
          title = '긍정적 변화와 새 인연';
          icon = '💫';
          description = `${daeunGanJi} 대운에 목욕운의 변화 기운에 ${daeunGanSipseong}의 길한 에너지와 용신이 함께하여 이미지 변신, 새로운 인연, 좋은 기회가 찾아옵니다! 변화를 두려워하지 마세요.`;
        } else if (yongsinHit) {
          title = '변화 속 행운이 숨은 시기';
          icon = '💫';
          description = `${daeunGanJi} 대운에 외적 변화가 많지만, 용신의 기운이 변화를 긍정적 방향으로 이끕니다. 새로운 시도가 좋은 결과로 이어질 확률이 높습니다.`;
        } else if (gisinHit) {
          title = '감정 관리가 필요한 변화기';
          icon = '🌊';
          description = `${daeunGanJi} 대운에 감정의 기복이 크고, 기신(${saju.gisin})의 기운이 변화를 부정적으로 끌 수 있습니다. 충동적 결정은 피하고, 중요한 결정은 반드시 시간을 두고 판단하세요.`;
        } else {
          title = isGilsin ? '순조로운 변화와 전환' : '변화와 전환의 시기';
          icon = '💫';
          description = `${daeunGanJi} 대운에 외적 이미지에 변화가 생기고, 새로운 관심사나 인연이 찾아옵니다. ${isGilsin ? daeunGanSipseong + '의 안정적 기운이 변화를 부드럽게 이끕니다. ' : '감정의 기복이 있을 수 있지만 성장통이라 생각하세요.'}`;
        }
        break;
      case '관대':
        if (doubleGisin) {
          title = '사회적 위치는 올라가나 내실이 부족한 시기';
          icon = '🏢';
          description = `${daeunGanJi} 대운에 관대운의 사회적 인정이 있으나, 천간·지지 모두 기신(${saju.gisin})이라 겉만 화려하고 실속이 없을 수 있습니다. 명예나 체면에 집착하면 오히려 손해를 봅니다.`;
        } else if (isGwansal) {
          title = '사회적 요구가 커지는 시기';
          icon = '🏢';
          description = `${daeunGanJi} 대운에 사회적 위치가 높아지지만, ${daeunGanSipseong}의 기운으로 책임과 압박도 함께 커집니다. 승진은 가능하지만 그만큼 부담이 크고, 실수 시 큰 타격을 받을 수 있습니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '변화 속 기회와 위험이 공존';
          icon = '🔀';
          description = `${daeunGanJi} 대운에 사회적 인정과 함께 ${daeunGanSipseong}의 변동 기운이 있어, 급격한 변화나 전환이 일어날 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 경쟁심과 독립 욕구가 강해져 갑작스러운 이직·독립을 시도할 수 있지만, 준비 없는 도전은 위험합니다. 현재 위치에서 실력을 더 쌓은 후 움직이세요.' : '상관의 기운이 기존 관행에 불만을 느끼게 하여 조직 내 갈등이 생길 수 있습니다. 비판보다 대안을 제시하는 자세가 인정받는 지름길입니다.'}`;
        } else if (yongsinHit) {
          title = '사회적 인정 + 큰 기회';
          icon = '👔';
          description = `${daeunGanJi} 대운이 용신의 기운을 타고 와서 승진, 합격, 명예 등 사회적 인정을 받을 확률이 매우 높습니다! 적극적으로 도전하세요.`;
        } else {
          title = isGilsin ? '순조로운 사회적 성장' : '사회적 인정의 시기';
          icon = '👔';
          description = `${daeunGanJi} 대운에 사회적으로 인정받고 자신감이 올라갑니다. ${isGilsin ? daeunGanSipseong + '의 기운이 안정적인 성장을 돕습니다. ' : ''}승진이나 명예와 관련된 좋은 일이 생길 수 있습니다.`;
        }
        break;
      case '건록':
        if (doubleGisin) {
          title = '기신이 강하게 작용하는 힘든 시기';
          icon = '⚠️';
          description = `${daeunGanJi} 대운에 건록운의 에너지는 있지만, 천간·지지 모두 기신(${saju.gisin})이라 그 에너지가 부정적으로 작용합니다. ${daeunGanSipseong}의 기운이 오히려 스트레스와 갈등을 일으키고, 새로운 환경에 적응하기 어렵습니다. 무리하지 말고 버티는 것이 최선입니다.`;
        } else if (isGwansal) {
          title = '실력은 있으나 압박이 큰 시기';
          icon = '💪';
          description = `${daeunGanJi} 대운에 건록의 독립적 에너지가 있지만, ${daeunGanSipseong}의 기운이 강한 압박과 경쟁을 가져옵니다. 실력으로 인정받을 수 있지만 스트레스가 크고, 조직 내 갈등이 생기기 쉽습니다. 체력 관리와 스트레스 해소가 중요합니다.`;
        } else if (yongsinHit && !gisinHit) {
          title = '경제적 대박의 시기!';
          icon = '💰';
          description = `${daeunGanJi} 대운이 용신의 기운과 함께 건록운까지! 재물운이 폭발하는 시기입니다. 사업 확장, 투자, 부동산에서 큰 성과가 기대됩니다. 이 시기를 절대 놓치지 마세요!`;
        } else if (yongsinHit && gisinHit) {
          title = '기회와 방해가 공존하는 시기';
          icon = '💰';
          description = `${daeunGanJi} 대운에 건록운과 용신의 기운이 있지만 기신도 함께 작용하여 좋은 일과 나쁜 일이 교차합니다. 기회를 잡되 리스크 관리를 철저히 하세요.`;
        } else if (gisinHit) {
          title = '돈이 들어오면서 나가는 시기';
          icon = '💸';
          description = `${daeunGanJi} 대운에 건록의 기운이 있지만, 기신(${saju.gisin})의 방해가 있어 돈이 들어오면서 나가기도 합니다. ${daeunGanSipseong}의 기운이 불안정하게 작용하여 계획대로 되지 않는 일이 생깁니다. 재물 관리에 특히 신경 쓰세요.`;
        } else {
          title = isGilsin ? '안정적 경제 성장기' : '경제적 성장의 시기';
          icon = '💰';
          description = `${daeunGanJi} 대운에 재물운이 강해지고 독립적으로 돈을 벌 수 있습니다. ${isGilsin ? daeunGanSipseong + '의 기운이 안정적 성장을 돕습니다. ' : ''}사업, 투자, 부동산 등에서 성과를 기대할 수 있습니다.`;
        }
        break;
      case '제왕':
        if (doubleGisin) {
          title = '에너지는 절정이나 기신이 강한 시기';
          icon = '⚠️';
          description = `${daeunGanJi} 대운에 제왕운으로 에너지는 최고점이지만, 천간·지지 모두 기신(${saju.gisin})이라 그 에너지가 오히려 독이 됩니다. 과욕, 갈등, 건강 문제 등이 복합적으로 나타날 수 있으며, 절제와 인내가 필요합니다.`;
        } else if (isGwansal) {
          title = '강한 압박 속 성장의 시기';
          icon = '⚔️';
          description = `${daeunGanJi} 대운에 에너지가 절정이지만, ${daeunGanSipseong}(${pillar.cheongan})의 기운이 강한 압박으로 작용합니다. 외부의 기대와 요구가 매우 크고, 권위적인 환경에서 시련을 겪을 수 있습니다. 이 시련을 이겨내면 큰 내공이 쌓이지만, 무리하면 건강이 상할 수 있습니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '에너지 폭발, 방향 주의!';
          icon = '🌋';
          description = `${daeunGanJi} 대운에 에너지가 절정이지만, ${daeunGanSipseong}의 기운이 변동과 충돌을 가져올 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 승부욕과 제왕운의 에너지가 결합하여 무모한 도전이나 과도한 투자에 빠지기 쉽습니다. 동업이나 공동사업은 특히 주의하고, 자기 역량 내에서 움직이세요. 이 에너지를 운동이나 취미로 건설적으로 발산하면 오히려 큰 성취를 이룹니다.' : '상관의 기운이 조직이나 권위와 정면 충돌을 일으킬 수 있습니다. 뛰어난 창의력이 인정받으려면 겸손한 태도가 동반되어야 합니다.'}`;
        } else if (yongsinHit && isGilsin) {
          title = '인생 최고의 전성기!';
          icon = '👑';
          description = `${daeunGanJi} 대운이 제왕운 + 용신 기운 + ${daeunGanSipseong}의 길한 에너지! 인생에서 가장 빛나는 시기입니다. 모든 것이 절정에 달하고, 리더십과 재물 모두 최고조입니다. 겸손함을 유지하면서 이 기회를 최대한 활용하세요!`;
        } else if (yongsinHit) {
          title = '인생 최고의 전성기!';
          icon = '👑';
          description = `${daeunGanJi} 대운이 제왕운 + 용신 기운! 인생에서 가장 빛나는 시기입니다. 적극적으로 도전하고 기회를 잡으세요!`;
        } else if (gisinHit) {
          title = '에너지는 높지만 방해도 큰 시기';
          icon = '⚡';
          description = `${daeunGanJi} 대운에 에너지가 절정이지만, 기신(${saju.gisin}) 기운이 섞여 있어 좋은 일과 나쁜 일이 교차합니다. 기회를 잡되 리스크 관리를 철저히 하세요.`;
        } else {
          title = isGilsin ? '최고의 전성기' : '인생의 전성기';
          icon = '👑';
          description = `${daeunGanJi} 대운에 모든 것이 절정에 달하는 시기! ${isGilsin ? daeunGanSipseong + '의 길한 기운이 함께하여 ' : ''}리더십과 성취가 최고입니다. 다만 정상에서의 겸손이 더 중요합니다.`;
        }
        break;
      case '쇠':
        if (isGwansal) {
          title = '하향기에 외부 압박까지 겹치는 시기';
          icon = '🍂';
          description = `${daeunGanJi} 대운에 쇠운의 하강 기운에 ${daeunGanSipseong}의 압박이 겹칩니다. 직장에서의 강등, 구조조정, 건강 악화 등 여러 방면에서 시련이 올 수 있습니다. 욕심을 내려놓고 현상 유지에 집중하며 체력 관리가 최우선입니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '에너지 하락 속 예상 밖의 변동';
          icon = '🍂';
          description = `${daeunGanJi} 대운에 기운이 약해지는 가운데 ${daeunGanSipseong}의 변동 기운이 있어 예상치 못한 변화(이직, 이사, 관계 정리)가 생길 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 충동이 하락기에 만나면 무리한 도전이 손실로 이어질 수 있습니다. 지금은 지키는 것이 이기는 것입니다. 주변의 금전 요청은 정중히 거절하고, 보증은 절대 금물입니다.' : '상관의 기운이 직장에서의 불만이나 대인 갈등으로 표출될 수 있습니다. 말보다 행동으로 보여주는 것이 현명합니다.'} 변화를 억지로 막기보다 자연스럽게 흐름을 타는 것이 좋습니다.`;
        } else if (yongsinHit && isGilsin) {
          title = '지혜로운 안정기 + 반안의 복';
          icon = '🍁';
          description = `${daeunGanJi} 대운에 전성기를 지나 차분해지지만, ${daeunGanSipseong}의 길한 기운과 용신이 안정적인 수입과 지위를 유지해줍니다. 경험을 살려 멘토링·컨설팅으로 전환하면 좋습니다.`;
        } else if (yongsinHit) {
          title = '차분하지만 안정적인 시기';
          icon = '🍁';
          description = `${daeunGanJi} 대운에 전성기를 지나 차분해지지만, 용신의 기운이 급격한 하락을 막아줍니다. 안정적인 수입이 유지되며, 지혜로운 판단력이 빛나는 시기입니다.`;
        } else if (gisinHit) {
          title = '건강과 재물 모두 주의 시기';
          icon = '🍂';
          description = `${daeunGanJi} 대운에 쇠운의 하강 기운에 기신(${saju.gisin})까지 겹쳐 건강과 재물 모두 주의가 필요합니다. 큰 투자나 모험은 피하고, 지출을 줄이며 체력 관리에 집중하세요.`;
        } else {
          title = isGilsin ? '안정적인 하반기 전환' : '성숙과 안정의 시기';
          icon = '🍁';
          description = `${daeunGanJi} 대운에 전성기를 지나 차분해지는 시기입니다. ${isGilsin ? daeunGanSipseong + '의 기운이 부드러운 전환을 돕습니다. ' : ''}삶에 대한 깊은 통찰력을 얻으며, 경험과 지혜가 가장 큰 자산이 됩니다.`;
        }
        break;
      case '병':
        if (isGwansal) {
          title = '건강·직장 모두 시련의 시기';
          icon = '🏥';
          description = `${daeunGanJi} 대운에 병(病)운의 기력 저하에 ${daeunGanSipseong}의 강한 압박이 겹쳐 몸과 마음이 모두 힘든 시기입니다. 직장에서의 스트레스가 건강에 직접 영향을 미칠 수 있으므로, 무리한 업무는 줄이고 건강 검진을 반드시 받으세요.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '건강 주의 + 예상 밖 변동';
          icon = '🏥';
          description = `${daeunGanJi} 대운에 건강 주의가 필요한 가운데 ${daeunGanSipseong}의 변동 기운으로 뜻밖의 변화(퇴사, 이사, 관계 정리)가 생길 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 에너지가 약해진 체력에 무리를 줄 수 있습니다. 무리한 이직이나 투자보다 건강 회복에 집중하세요. 건강이 곧 재산입니다.' : '상관의 기운이 스트레스를 가중시킬 수 있으니, 감정 표출을 조절하고 충분한 휴식을 취하세요.'}`;
        } else if (yongsinHit && isGilsin) {
          title = '건강 주의지만 내적 성장의 시기';
          icon = '🍃';
          description = `${daeunGanJi} 대운에 에너지가 다소 떨어지지만, ${daeunGanSipseong}의 길한 기운과 용신이 큰 탈 없이 넘어가게 도와줍니다. 건강 관리에 신경 쓰면서 내면적 성장에 집중하면 좋은 시기입니다.`;
        } else if (yongsinHit) {
          title = '재충전하며 회복하는 시기';
          icon = '🍃';
          description = `${daeunGanJi} 대운에 건강 주의가 필요하지만, 용신의 기운이 회복력을 높여줍니다. 무리하지 않고 쉬어가면 에너지가 서서히 회복됩니다.`;
        } else if (gisinHit) {
          title = '건강 특별 주의 시기!';
          icon = '🏥';
          description = `${daeunGanJi} 대운에 기신(${saju.gisin})의 기운이 병(病)운과 만나 건강에 적신호! 정기 건강검진 필수이며, 무리한 활동은 자제하세요. 이 시기를 잘 넘기면 다음 대운에서 회복합니다.`;
        } else {
          title = isGilsin ? '가벼운 재충전 시기' : '재충전이 필요한 시기';
          icon = '🍃';
          description = `${daeunGanJi} 대운에 건강과 에너지에 주의가 필요합니다. ${isGilsin ? daeunGanSipseong + '의 기운이 큰 탈 없이 지나가게 돕습니다. ' : ''}무리하지 말고 쉬어가며 삶을 돌아보는 시간을 가지세요.`;
        }
        break;
      case '사':
        if (isGwansal) {
          title = '큰 시련과 내면 시험의 시기';
          icon = '🔥';
          description = `${daeunGanJi} 대운에 사(死)운의 종결 기운에 ${daeunGanSipseong}의 압박이 겹쳐 외부에서 큰 시련이 올 수 있습니다. 직장·사업에서의 좌절, 건강 문제, 대인 갈등 등이 복합적으로 나타날 수 있습니다. 이 시기를 잘 버티면 완전히 새로운 사람으로 거듭납니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '강제적 전환과 정리의 시기';
          icon = '🔄';
          description = `${daeunGanJi} 대운에 ${daeunGanSipseong}의 변동 기운이 사(死)운과 만나 원치 않는 변화(퇴사, 이별, 이사)가 생길 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 에너지가 기존 것을 흩트리는 방향으로 작용하여 인간관계나 재산 손실이 생길 수 있습니다. 지금은 움직이기보다 조용히 내면을 정리하고 다음을 준비하는 것이 최선입니다.' : '상관의 기운이 기존 질서를 완전히 허물려는 충동을 줍니다. 파괴적 에너지를 창작·예술·글쓰기 등으로 승화시키면 전환점이 됩니다.'} 저항하기보다 흐름을 받아들이고 새 출발을 준비하세요.`;
        } else if (yongsinHit && isGilsin) {
          title = '내면 각성 + 새로운 문';
          icon = '🔄';
          description = `${daeunGanJi} 대운에 외적 활동은 정리되지만, ${daeunGanSipseong}의 길한 기운과 용신이 정신적 각성을 이끌어 새로운 문을 열어줍니다! 철학·명상·공부 등이 큰 전환점이 됩니다.`;
        } else if (yongsinHit) {
          title = '정리 속에서 기회를 찾는 시기';
          icon = '🔄';
          description = `${daeunGanJi} 대운에 외적 활동은 정리되지만, 용신의 기운이 내면의 각성을 이끌어 새로운 가능성이 열립니다. 내면 탐색과 자기 성찰이 다음 도약의 밑거름이 됩니다.`;
        } else if (gisinHit) {
          title = '외적 정리와 내적 시련';
          icon = '🔥';
          description = `${daeunGanJi} 대운에 사(死)운과 기신(${saju.gisin})이 만나 외적 활동의 종결과 함께 내적으로도 힘든 시기입니다. 큰 도전은 피하고 최대한 조용히 지내며, 건강 관리에 집중하세요.`;
        } else {
          title = isGilsin ? '부드러운 전환과 내면 성장' : '내면 각성과 전환의 시기';
          icon = '🔄';
          description = `${daeunGanJi} 대운에 외적 활동은 줄어들지만, ${isGilsin ? daeunGanSipseong + '의 기운이 부드러운 전환을 돕습니다. ' : ''}정신이 크게 각성되는 내면적 전환점이며, 자기 성찰이 중요합니다.`;
        }
        break;
      case '묘':
        if (isGwansal) {
          title = '잠복된 위기, 내실 다지기 필수';
          icon = '📦';
          description = `${daeunGanJi} 대운에 묘(墓)운의 저장 기운 속에 ${daeunGanSipseong}의 압박이 숨어 있습니다. 겉으로는 조용하지만 내부적으로 스트레스가 쌓이기 쉽고, 갑작스러운 문제가 터질 수 있습니다. 건강 검진과 재무 점검을 미리 해두세요.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '조용한 겉모습 속 내적 갈등';
          icon = '📦';
          description = `${daeunGanJi} 대운에 겉으로는 잠잠하지만 ${daeunGanSipseong}의 기운으로 내면의 갈등이나 방황이 있을 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 에너지가 내면에서 꿈틀거려 현재 상황에 대한 불만이 커집니다. 조급하게 행동하면 묘(墓)운의 기운이 결과를 가둬버리므로, 내면 정리와 자기 계발에 집중하고 실행은 다음 대운으로 미루세요.' : '상관의 기운이 내면의 비판적 사고를 강화합니다. 이 시기의 깊은 사색이 나중에 큰 통찰로 이어지니, 일기 쓰기나 독서가 도움됩니다.'}`;
        } else if (yongsinHit && isGilsin) {
          title = '조용하지만 알찬 축적기';
          icon = '📦';
          description = `${daeunGanJi} 대운에 겉으로는 조용하지만, ${daeunGanSipseong}의 길한 기운과 용신이 내면에서 큰 힘을 쌓아줍니다! 저축, 공부, 자격증에 집중하면 다음 대운에서 폭발적으로 성장합니다.`;
        } else if (yongsinHit) {
          title = '내면 축적 + 숨겨진 행운';
          icon = '📦';
          description = `${daeunGanJi} 대운에 겉으로는 조용하지만, 용신의 기운으로 내면에서 큰 힘이 쌓이고 있습니다. 저축, 공부, 자격증에 집중하면 다음 대운에서 큰 성과를 거둡니다!`;
        } else if (gisinHit) {
          title = '침체와 정체의 시기';
          icon = '📦';
          description = `${daeunGanJi} 대운에 묘(墓)운의 저장 기운에 기신(${saju.gisin})이 겹쳐 답답하고 막히는 느낌이 강한 시기입니다. 큰 움직임은 자제하고, 조용히 내실을 다지며 때를 기다리세요.`;
        } else {
          title = isGilsin ? '안정적인 내면 축적기' : '내면 축적의 시기';
          icon = '📦';
          description = `${daeunGanJi} 대운에 겉으로는 조용하지만 내면에서 힘이 쌓이는 시기입니다. ${isGilsin ? daeunGanSipseong + '의 기운이 차분한 성장을 돕습니다. ' : ''}저축, 공부, 내공 쌓기에 집중하세요.`;
        }
        break;
      case '절':
        if (doubleGisin) {
          title = '가장 힘든 시련기';
          icon = '⚡';
          description = `${daeunGanJi} 대운에 절(絶)운과 천간·지지 모두 기신(${saju.gisin})이 겹쳐 인생에서 가장 힘든 시기 중 하나입니다. 건강·재물·관계 모두 어려움이 있을 수 있으며, 최소한의 행동으로 버티면서 내실을 다지는 것이 중요합니다. 이 시기를 잘 넘기면 완전히 새로운 인생이 펼쳐집니다.`;
        } else if (isGwansal) {
          title = '시련과 인내의 시기';
          icon = '⚡';
          description = `${daeunGanJi} 대운에 절(絶)운과 ${daeunGanSipseong}의 압박이 만나 외적으로 힘든 시기입니다. 건강·재물 관리에 각별히 신경 쓰며, 무리한 도전은 피하고 내실을 다지세요. 이 시기를 잘 넘기면 완전히 새로운 인생이 펼쳐집니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '강제적 정리와 새 출발 준비';
          icon = '⚡';
          description = `${daeunGanJi} 대운에 절(絶)운과 ${daeunGanSipseong}의 변동 기운이 만나 원치 않는 이별, 정리가 생길 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 에너지가 절지(絶地)에서 기존 인연과 재산을 흩뜨리는 방향으로 강하게 작용합니다. 모든 것을 내려놓고 완전히 새로운 마음으로 출발하는 것이 오히려 나을 수 있습니다. 과거에 집착하지 마세요.' : '상관의 기운이 모든 관계와 환경을 리셋하려는 충동을 줍니다. 이 시기의 정리가 다음 인생 장의 서막이 됩니다.'} 저항하기보다 흐름을 받아들이고 새 출발을 준비하세요.`;
        } else if (yongsinHit && isGilsin) {
          title = '어려운 환경 속 숨겨진 기회';
          icon = '🔑';
          description = `${daeunGanJi} 대운에 절(絶)운으로 외적 환경은 어렵지만, ${daeunGanSipseong}의 길한 기운과 용신이 내면의 힘을 줍니다. 겉으로 드러나지 않는 곳에서 기회가 옵니다.`;
        } else if (yongsinHit) {
          title = '절지에 용신이 비추는 시기';
          icon = '🔑';
          description = `${daeunGanJi} 대운에 절(絶)운으로 외적 환경은 어렵지만, 용신의 기운이 내면의 힘을 줍니다. 조용히 때를 기다리면 기회가 옵니다.`;
        } else if (gisinHit) {
          title = '시련과 인내의 시기';
          icon = '⚡';
          description = `${daeunGanJi} 대운에 절(絶)운과 기신(${saju.gisin})이 만나 외적으로 힘든 시기입니다. 건강·재물 관리에 각별히 신경 쓰며, 무리한 도전은 피하고 내실을 다지세요.`;
        } else {
          title = isGilsin ? '조용한 비움 속 내면의 빛' : '단절 속 진정한 자유';
          icon = '⚡';
          description = `${daeunGanJi} 대운에 모든 인연과 욕망이 단절되는 듯하지만, ${isGilsin ? daeunGanSipseong + '의 기운이 내면의 빛을 밝혀줍니다. ' : ''}완전한 비움 속에서 진정한 자유가 태어나는 시기입니다.`;
        }
        break;
      case '태':
        if (doubleGisin) {
          title = '가능성이 억눌린 시기';
          icon = '🥚';
          description = `${daeunGanJi} 대운에 태(胎)운으로 새로운 가능성이 싹트려 하지만, 천간·지지 모두 기신(${saju.gisin})이라 환경이 그 싹을 억누릅니다. 조급해하지 않고 인내하며 때를 기다리는 것이 중요합니다.`;
        } else if (isGwansal) {
          title = '가능성은 있으나 불안한 시작';
          icon = '🥚';
          description = `${daeunGanJi} 대운에 태(胎)운으로 새로운 가능성이 싹트지만, ${daeunGanSipseong}의 압박이 초기부터 부담을 줍니다. 환경이 녹록지 않아 시작이 순탄하지 않지만, 꾸준히 준비하면 나중에 빛을 봅니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '새 출발의 혼란과 모색기';
          icon = '🥚';
          description = `${daeunGanJi} 대운에 새로운 가능성의 씨앗이 보이지만, ${daeunGanSipseong}의 변동 기운으로 관심사와 방향이 자주 바뀔 수 있습니다. 이것저것 시도하며 자신에게 맞는 길을 찾는 시행착오의 시기입니다. ${daeunGanSipseong === '겁재' ? '겁재 특유의 도전정신이 여러 분야를 기웃거리게 만들지만, 한 가지에 집중하는 인내가 성공의 열쇠입니다. 주변의 유혹이나 친구의 제안에 쉽게 흔들리지 마시고 자기 내면의 목소리에 귀 기울이세요.' : '상관의 기운이 기존 질서에 반발심을 일으켜 직장·관계에서 갈등이 생길 수 있습니다. 창의적 에너지를 건설적으로 풀어내면 오히려 좋은 결과를 만들 수 있습니다.'} 조급함을 내려놓고 다양한 경험을 쌓으면 다음 대운에서 방향이 잡힙니다.`;
        } else if (yongsinHit && isGilsin) {
          title = '새로운 가능성 + 행운의 싹';
          icon = '🌱';
          description = `${daeunGanJi} 대운에 아직 겉으로 보이지 않지만, ${daeunGanSipseong}의 길한 기운과 용신이 무한한 가능성에 힘을 실어줍니다! 이 시기에 시작한 일이 나중에 큰 결실로 이어집니다.`;
        } else if (yongsinHit) {
          title = '잠재력에 행운이 깃드는 시기';
          icon = '🌱';
          description = `${daeunGanJi} 대운에 아직 겉으로 보이지 않지만, 용신의 기운이 무한한 가능성에 힘을 실어줍니다. 조급해하지 말고 천천히 준비하면 좋은 결과가 옵니다.`;
        } else if (gisinHit) {
          title = '가능성은 있으나 흐릿한 시기';
          icon = '🥚';
          description = `${daeunGanJi} 대운에 새로운 가능성이 태동하지만, 기신(${saju.gisin})의 기운으로 방향이 불분명합니다. 조급하게 시작하기보다 충분히 준비하고 때를 기다리세요.`;
        } else {
          title = isGilsin ? '안정적으로 싹트는 가능성' : '가능성이 싹트는 시기';
          icon = '🌱';
          description = `${daeunGanJi} 대운에 아직 겉으로 보이지 않지만 무한한 가능성이 자라고 있습니다. ${isGilsin ? daeunGanSipseong + '의 기운이 안정적인 싹을 틔웁니다. ' : ''}준비와 구상에 집중하세요.`;
        }
        break;
      case '양':
        if (doubleGisin) {
          title = '성장이 더딘 힘든 환경의 시기';
          icon = '🌤️';
          description = `${daeunGanJi} 대운에 양(養)운으로 성장 기운은 있지만, 천간·지지 모두 기신(${saju.gisin})이라 환경이 성장을 방해합니다. 답답하더라도 포기하지 않고 꾸준히 노력하면 나중에 반드시 빛을 봅니다.`;
        } else if (isGwansal) {
          title = '성장기지만 외부 시련이 있는 시기';
          icon = '🌤️';
          description = `${daeunGanJi} 대운에 양(養)운으로 성장 기운은 있지만, ${daeunGanSipseong}의 압박이 환경적 어려움을 가져옵니다. 엄격한 가정이나 학교 환경, 경쟁 압박 등이 있지만 이를 통해 단단해집니다.`;
        } else if (isHyungsin && !yongsinHit) {
          title = '성장 속 방향 모색의 시기';
          icon = '🌤️';
          description = `${daeunGanJi} 대운에 성장 기운 속에 ${daeunGanSipseong}의 변동이 있어 관심사나 환경이 자주 바뀔 수 있습니다. ${daeunGanSipseong === '겁재' ? '겁재의 에너지가 새로운 분야에 대한 호기심을 자극하여 이것저것 시도하게 만듭니다. 다양한 경험 자체는 좋지만, 하나를 깊이 파기보다 여러 개를 얕게 건드리면 결국 남는 것이 없을 수 있습니다. 3가지 이내로 관심사를 좁히세요.' : '상관의 기운이 기존 학습 방법이나 환경에 불만을 느끼게 합니다. 새로운 학습법이나 환경을 시도해보는 것은 좋지만, 기초를 소홀히 하면 안 됩니다.'} 시행착오를 통해 자신만의 길을 찾아가는 과정이니 조급해하지 마세요.`;
        } else if (yongsinHit && isGilsin) {
          title = '빠른 성장 + 행운의 시기';
          icon = '🌤️';
          description = `${daeunGanJi} 대운에 ${daeunGanSipseong}의 길한 기운과 용신이 함께하여 빠르게 실력이 올라갑니다! 체력 관리와 자기 계발에 집중하면 다음 대운에서 대폭 성장합니다.`;
        } else if (yongsinHit) {
          title = '순조로운 준비와 성장기';
          icon = '🌤️';
          description = `${daeunGanJi} 대운에 용신의 기운이 성장을 도와 실력이 착실히 쌓입니다. 체력 관리와 자기 계발에 집중하면 다음 대운에서 큰 성과를 거둡니다.`;
        } else if (gisinHit) {
          title = '더디지만 포기하면 안 되는 시기';
          icon = '🌤️';
          description = `${daeunGanJi} 대운에 성장 기운은 있으나 기신(${saju.gisin})의 방해로 성장 속도가 더딜 수 있습니다. 포기하지 않고 꾸준히 노력하면 나중에 반드시 결실을 봅니다.`;
        } else {
          title = isGilsin ? '안정적 성장과 준비기' : '준비와 성장의 시기';
          icon = '🌤️';
          description = `${daeunGanJi} 대운에 곧 다가올 기회를 위해 조용히 실력을 가꾸는 시기입니다. ${isGilsin ? daeunGanSipseong + '의 기운이 안정적 성장을 돕습니다. ' : ''}체력 관리와 자기 계발이 핵심입니다.`;
        }
        break;
    }

    // ===== 상세 보충 멘트 (합충·오행·건강·재물·연애·직업 구체 정보) =====
    const detailParts: string[] = [];
    let detailCareer = '';
    let detailWealth = '';
    let detailLove = '';
    let detailHealth = '';
    const generalParts: string[] = [];
    const OHAENG_NAME_TL: Record<Ohaeng, string> = { '목': '나무(목)', '화': '불(화)', '토': '흙(토)', '금': '쇠(금)', '수': '물(수)' };

    // (A) 합충 정보 — 대운이 관여하는 합충만 표시 (원국끼리의 합충은 매번 동일하므로 제외)
    const daeunJiji = pillar.jiji;
    if (hapChung.chungCount > 0) {
      const chungItems = hapChung.items.filter(i => i.type === '지지충');
      for (const item of chungItems) {
        if ('ji1' in item && 'ji2' in item) {
          const ci = item as { ji1: string; ji2: string; position1: string; position2: string };
          if (ci.position1 === '대운' || ci.position2 === '대운') {
            generalParts.push(`⚡ 충(沖) ${ci.ji1}↔${ci.ji2}: 급격한 변화·이동·갈등이 생길 수 있으니 큰 결정은 신중하게`);
            detailParts.push(`⚡ 충(沖) ${ci.ji1}↔${ci.ji2}: 급격한 변화·이동·갈등이 생길 수 있으니 큰 결정은 신중하게`);
            break;
          }
        }
      }
    }
    if (hapChung.yukhapCount > 0 || hapChung.samhapCount > 0) {
      const hapItems = hapChung.items.filter(i => i.type === '육합' || i.type === '삼합' || i.type === '반합');
      for (const item of hapItems) {
        if ('resultOhaeng' in item && 'positions' in item) {
          const hi = item as { resultOhaeng: Ohaeng; positions: string[]; type: string; members?: string[] };
          const involvesDaeun = hi.positions.includes('대운') || (hi.members && hi.members.includes(daeunJiji));
          if (involvesDaeun) {
            const ohName = OHAENG_NAME_TL[hi.resultOhaeng] || hi.resultOhaeng;
            generalParts.push(`🤝 ${hi.type}(${ohName}): 대운과 원국의 조화로 인간관계·사업에 유리`);
            detailParts.push(`🤝 ${hi.type}(${ohName}): 대운과 원국의 조화로 인간관계·사업에 유리`);
            break;
          }
        }
      }
    }

    // (B) 오행 밸런스 변화 멘트 — 대운이 가져오는 오행이 부족/과다 오행에 미치는 영향
    const weakOh_tl = saju.weakestOhaeng as Ohaeng | undefined;
    const domOh_tl = saju.dominantOhaeng as Ohaeng | undefined;
    if (weakOh_tl && (ganOh === weakOh_tl || jiOh === weakOh_tl)) {
      generalParts.push(`✨ 부족했던 ${OHAENG_NAME_TL[weakOh_tl]} 기운이 대운에서 보충됩니다 → 전반적 운세 상승`);
      detailParts.push(`✨ 부족했던 ${OHAENG_NAME_TL[weakOh_tl]} 기운이 대운에서 보충됩니다 → 전반적 운세 상승`);
    } else if (domOh_tl && (ganOh === domOh_tl || jiOh === domOh_tl)) {
      generalParts.push(`⚠️ 이미 과다한 ${OHAENG_NAME_TL[domOh_tl]} 기운이 더 쌓입니다 → 해당 오행 관련 부담 주의`);
      detailParts.push(`⚠️ 이미 과다한 ${OHAENG_NAME_TL[domOh_tl]} 기운이 더 쌓입니다 → 해당 오행 관련 부담 주의`);
    }

    // (C) 건강 포인트 — 대운 오행과 신체 기관 + 정신건강 연결
    const BODY_MAP_TL: Record<Ohaeng, string> = {
      '목': '간·담·근육·눈', '화': '심장·혈관·소장', '토': '위장·소화기·비장',
      '금': '폐·호흡기·피부·대장', '수': '신장·방광·허리·귀',
    };
    // ★ 오행별 정신건강 매핑 (한의학 기반)
    const MENTAL_MAP_TL: Record<Ohaeng, string> = {
      '목': '분노·짜증·우울감', '화': '불안·초조·공황',
      '토': '걱정·강박·과잉사고', '금': '슬픔·비관·완벽주의 스트레스',
      '수': '공포·두려움·의욕 저하',
    };
    // ★ 십성별 정신건강 경향
    const SIPSEONG_MENTAL: Record<string, string> = {
      '편관': '외부 압박이 심해 번아웃·만성 스트레스에 취약합니다. 일과 삶의 균형을 의식적으로 잡고, 취미나 운동으로 스트레스를 해소하세요.',
      '상관': '감정 기복이 크고 말실수로 인한 대인관계 스트레스가 쌓이기 쉽습니다. 감정 일기나 명상이 마음 안정에 도움됩니다.',
      '편인': '생각이 많아지고 잠이 안 오는 시기입니다. 과도한 정보 수집이나 걱정을 줄이고, 규칙적인 수면 습관을 유지하세요.',
      '겁재': '충동적 결정 후 후회하는 패턴이 반복될 수 있습니다. 중요한 결정은 3일 숙고 원칙을 지키고, 감정에 휘둘리지 않는 연습이 필요합니다.',
      '비견': '경쟁심과 비교의식이 강해져 자존감이 흔들릴 수 있습니다. 남과 비교하기보다 어제의 나와 비교하세요.',
    };

    if (gisinHit || score <= 4) {
      const targetOh = isGisinGan ? ganOh : jiOh;
      const bodyPart = BODY_MAP_TL[targetOh] || BODY_MAP_TL[ganOh];
      const mentalPart = MENTAL_MAP_TL[targetOh] || MENTAL_MAP_TL[ganOh];
      const sipMental = SIPSEONG_MENTAL[daeunGanSipseong] || '';
      const healthMsg = `🏥 신체: ${bodyPart} 주의 (${OHAENG_NAME_TL[targetOh] || OHAENG_NAME_TL[ganOh]} 과부하). 정기 건강검진 필수.\n🧠 정신: ${mentalPart} 경향이 나타날 수 있습니다.${sipMental ? ' ' + sipMental : ''} 무리하지 말고 충분한 휴식을 취하세요.`;
      detailHealth = healthMsg;
      detailParts.push(healthMsg);
    } else if (score >= 7) {
      const sipMental = SIPSEONG_MENTAL[daeunGanSipseong];
      detailHealth = `💪 신체: 대운의 기운이 에너지를 높여주는 시기. 운동이나 새로운 취미를 시작하기 좋습니다.\n😊 정신: 전반적으로 안정적이고 긍정적인 마음 상태가 유지됩니다.${sipMental ? ' 다만 ' + sipMental : ' 자기 계발이나 명상을 병행하면 더욱 좋습니다.'}`;
    } else {
      const ganBody = BODY_MAP_TL[ganOh];
      const ganMental = MENTAL_MAP_TL[ganOh];
      const sipMental = SIPSEONG_MENTAL[daeunGanSipseong] || '';
      detailHealth = `🩺 신체: ${ganBody} 계통을 평소보다 신경 쓰세요. 규칙적인 생활과 적절한 운동이 도움됩니다.\n🧠 정신: ${ganMental} 경향이 살짝 나타날 수 있으니 마음 관리에 신경 쓰세요.${sipMental ? ' ' + sipMental : ''}`;
    }

    // (D) 재물 포인트 (20세 이상에서만)
    if (pillar.startAge >= 20) {
      const isJaeseong_tl = ['편재', '정재'].includes(daeunGanSipseong);
      const isSiksang_tl = ['식신', '상관'].includes(daeunGanSipseong);
      const isBigyeop_tl = ['비견', '겁재'].includes(daeunGanSipseong);
      const isInseong_tl = ['편인', '정인'].includes(daeunGanSipseong);
      const isGwanseong_tl = ['편관', '정관'].includes(daeunGanSipseong);
      if (isJaeseong_tl && yongsinHit) {
        const wMsg = pillar.startAge >= 70
          ? `💰 안정적 자산: ${daeunGanSipseong}+용신 → 노후 자산이 안정됩니다. 안전한 금융상품 위주로 관리하면 좋습니다.`
          : `💰 재물운 강력: ${daeunGanSipseong}+용신 → 투자·사업 확장의 적기입니다. 부동산이나 주식 등 적극적인 재테크가 좋은 결과를 줍니다.`;
        detailWealth = wMsg;
        detailParts.push(wMsg);
      } else if (isJaeseong_tl && gisinHit) {
        const wMsg = `💸 재물 주의: ${daeunGanSipseong}이 있으나 기신의 방해가 있어 큰 투자보다 안정 추구가 현명합니다. 무리한 대출이나 보증은 절대 금물입니다.`;
        detailWealth = wMsg;
        detailParts.push(wMsg);
      } else if (isJaeseong_tl) {
        detailWealth = `💰 재물운 보통: ${daeunGanSipseong}의 기운으로 수입이 안정적이나 큰 변동은 없습니다. 꾸준한 저축이 도움됩니다.`;
      } else if (isSiksang_tl && !gisinHit) {
        const wMsg = pillar.startAge >= 70
          ? `📈 취미·여가 활동에서 소소한 보람과 수입을 느낍니다.`
          : `📈 식상생재: 창의적 활동이나 부업·프리랜서를 통한 수입 증가 가능. 아이디어를 행동으로 옮기면 재물이 따라옵니다.`;
        detailWealth = wMsg;
        detailParts.push(wMsg);
      } else if (isBigyeop_tl) {
        detailWealth = daeunGanSipseong === '겁재'
          ? `💸 재물 변동: 겁재의 기운으로 돈이 들어와도 빠져나갈 수 있습니다. 동업이나 보증은 특히 주의하고, 지출 관리를 철저히 하세요.`
          : `💰 재물 안정: 비견의 기운으로 독립적인 수입이 가능하지만, 경쟁자가 생길 수 있으니 자기 영역을 지키세요.`;
      } else if (isInseong_tl) {
        detailWealth = `📚 재물보다 학습: ${daeunGanSipseong}의 기운은 직접적 재물보다 자격증·학습·기술 향상을 통한 간접적 수입 증가에 유리합니다.`;
      } else if (isGwanseong_tl) {
        detailWealth = daeunGanSipseong === '편관'
          ? `⚖️ 재물 압박: 편관의 기운으로 세금·벌금·소송 등 예상치 못한 지출이 생길 수 있습니다. 법적 문제에 주의하세요.`
          : `💼 안정적 급여: 정관의 기운으로 월급이나 정기수입이 안정됩니다. 직장 내 승진을 통한 수입 증가가 기대됩니다.`;
      }
    } else {
      // 20세 미만: 학업 관련으로 변환
      detailWealth = score >= 7 ? `📚 학업운 상승: 집중력이 높아져 성적 향상이 기대됩니다.` : score <= 4 ? `📚 학업운 주의: 집중력이 떨어질 수 있으니 학습 환경을 개선하세요.` : `📚 학업운 보통: 꾸준한 노력이 성적을 만듭니다.`;
    }

    // (D-2) 직업/학업 포인트 — 십성별 직업운 상세
    if (pillar.startAge >= 20) {
      const isBigyeop_c = ['비견', '겁재'].includes(daeunGanSipseong);
      const isSiksang_c = ['식신', '상관'].includes(daeunGanSipseong);
      const isJaeseong_c = ['편재', '정재'].includes(daeunGanSipseong);
      const isGwanseong_c = ['편관', '정관'].includes(daeunGanSipseong);
      const isInseong_c = ['편인', '정인'].includes(daeunGanSipseong);
      if (isGwanseong_c && yongsinHit) {
        detailCareer = `👔 직업운 최상: ${daeunGanSipseong}+용신으로 승진·이직에 유리합니다. 리더십을 발휘하고 조직에서 인정받는 시기입니다.`;
      } else if (isGwanseong_c && gisinHit) {
        detailCareer = `⚠️ 직장 스트레스: ${daeunGanSipseong}+기신으로 직장에서 압박과 갈등이 심합니다. 무리한 야근을 줄이고 이직은 신중하게 판단하세요.`;
      } else if (isGwanseong_c) {
        detailCareer = daeunGanSipseong === '편관'
          ? `⚔️ 직업 변동: 편관의 기운으로 업무 환경이 바뀌거나 강한 경쟁이 있습니다. 실력을 갈고닦아 인정받으세요.`
          : `👔 직장 안정: 정관의 기운으로 안정적인 직장 생활이 이어집니다. 규칙적이고 성실한 모습이 빛을 발합니다.`;
      } else if (isSiksang_c && yongsinHit) {
        detailCareer = `🎨 창의력 폭발: ${daeunGanSipseong}+용신으로 창작, 기획, 교육, 프리랜서 분야에서 큰 성과를 올립니다. 자기 표현이 돈과 명예로 이어집니다.`;
      } else if (isSiksang_c) {
        detailCareer = daeunGanSipseong === '상관'
          ? `🔧 전문성 발휘: 상관의 기운으로 기존 틀을 깨는 혁신적 아이디어가 나옵니다. 다만 윗사람과의 갈등에 주의하세요.`
          : `🍳 안정적 기술직: 식신의 기운으로 요리, 기술, 교육 등 전문 분야에서 꾸준한 성과를 냅니다.`;
      } else if (isJaeseong_c) {
        detailCareer = daeunGanSipseong === '편재'
          ? `💼 사업·영업운: 편재의 기운으로 새로운 사업 기회나 영업 성과가 기대됩니다. 인맥을 적극 활용하세요.`
          : `💼 안정적 재무: 정재의 기운으로 직장에서 재정 관련 업무에서 빛을 발합니다.`;
      } else if (isBigyeop_c) {
        detailCareer = daeunGanSipseong === '겁재'
          ? `🔀 직업 변동: 겁재의 기운으로 이직·전직·독립 창업의 충동이 강해집니다. 감정적 결정은 피하고 충분히 준비한 후 움직이세요.`
          : `🤝 동료·경쟁: 비견의 기운으로 같은 분야의 경쟁자가 나타나지만, 서로 자극이 되어 성장할 수도 있습니다.`;
      } else if (isInseong_c) {
        detailCareer = daeunGanSipseong === '편인'
          ? `📖 학습·전환: 편인의 기운으로 새로운 분야를 공부하거나 자격증을 취득하는 것이 유리합니다. 기존 직업에서 전환을 고민할 수 있습니다.`
          : `🎓 학업·자격: 정인의 기운으로 학습능력이 극대화됩니다. 자격증, 승진 시험, 대학원 진학 등이 좋은 결과를 줍니다.`;
      }
    } else {
      // 20세 미만: 학교생활 관련
      if (score >= 7) {
        detailCareer = `🏫 학교생활 순탄: 선생님·친구들과의 관계가 좋고, 학업이나 과외활동에서 두각을 나타냅니다.`;
      } else if (score <= 4) {
        detailCareer = `🏫 학교생활 주의: 친구 관계나 학업에서 어려움이 있을 수 있지만, 이 시기가 지나면 더 강해집니다.`;
      } else {
        detailCareer = `🏫 학교생활 보통: 꾸준한 노력으로 학업과 교우관계가 안정적으로 유지됩니다.`;
      }
    }

    // (E) 애정·결혼·인간관계 포인트 — ★ 관계 상태(기혼/연애중/미혼) + 나이대별 분기
    const rel = saju.relationship; // 'married' | 'dating' | 'single'
    const isMarried = rel === 'married';
    const isDating = rel === 'dating';
    const isSingle = rel === 'single';

    if (pillar.startAge < 15) {
      // 유소년: 친구관계
      detailLove = `👫 친구관계: ${score >= 6 ? '좋은 친구를 만나 즐거운 시간을 보냅니다.' : '친구 관계에서 작은 갈등이 있을 수 있지만 금방 해결됩니다.'}`;
    } else if (pillar.startAge >= 70) {
      // 70세+: 가족/지인
      detailLove = isMarried
        ? `🤝 부부·가족: ${score >= 6 ? '배우자·자녀·손주와 화목하고 정서적 안정을 줍니다. 함께 여행이나 취미를 즐기세요.' : '가족 간 소통이 줄어들 수 있으니 먼저 연락하고 대화를 나누세요.'}`
        : `🤝 가족·지인: 자녀·손주·지인과의 관계가 ${score >= 6 ? '화목하고 정서적 안정을 줍니다.' : '다소 소원할 수 있으니 먼저 연락하세요.'}`;
    } else if (isMarried) {
      // ★★★ 기혼자: 부부운/가정운 중심 (절대 "새 인연", "다양한 만남" 표현 금지)
      if (daeunGanSipseong === '정재' || daeunGanSipseong === '정관') {
        const lMsg = `💕 부부운 상승: ${daeunGanSipseong}의 기운으로 배우자와의 관계가 안정되고 가정에 화목함이 깃듭니다. 함께하는 여행이나 취미 활동이 관계를 더욱 깊게 만듭니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '편재' && stage !== '절' && stage !== '묘') {
        const lMsg = `🏠 가정운 활발: 편재의 기운으로 가정 내 경제활동이 활발해지고, 부부가 함께하는 사회적 활동(모임, 커뮤니티)이 늘어납니다. 배우자와 재정 관리를 함께 하면 좋은 결과가 있습니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '상관' && !yongsinHit) {
        const lMsg = `💔 부부 갈등 주의: 상관의 기운으로 배우자와의 대화에서 감정 충돌이 생기기 쉽습니다. 말실수가 큰 다툼으로 번질 수 있으니 감정 조절이 중요합니다. 서로의 공간을 존중하세요.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '겁재') {
        const lMsg = `⚠️ 가정운 변동: 겁재의 기운으로 부부간 의견 충돌이나 경제적 갈등이 생길 수 있습니다. 큰 지출이나 투자는 반드시 배우자와 상의하고, 외부 유혹에 흔들리지 마세요.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '비견') {
        detailLove = `🏠 가정 안정: 비견의 기운으로 배우자와 동등한 파트너십이 강화됩니다. 서로의 독립성을 존중하면서 가정을 함께 꾸려나가면 좋습니다.`;
      } else if (['편인', '정인'].includes(daeunGanSipseong)) {
        detailLove = `🏠 가정 화목: ${daeunGanSipseong}의 기운으로 가족 간 정서적 유대가 깊어집니다. 부모님이나 어른과의 관계도 편안해지고, 가정 내 분위기가 따뜻해집니다.`;
      } else if (daeunGanSipseong === '식신') {
        detailLove = `🍳 가정 화목: 식신의 기운으로 가족과 함께하는 식사, 여행 등이 부부관계와 가정 분위기를 더욱 좋게 만듭니다.`;
      } else if (daeunGanSipseong === '편관') {
        const lMsg = `⚠️ 부부 스트레스: 편관의 기운으로 직장 스트레스가 가정에 영향을 줄 수 있습니다. 일과 가정의 균형을 의식적으로 잡으세요.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else {
        detailLove = `🏠 가정운 보통: 배우자와의 관계가 안정적으로 유지됩니다. 작은 관심과 대화가 부부 사이를 더 좋게 합니다.`;
      }
    } else if (isDating) {
      // ★★★ 연애 중: 관계 발전/심화 중심
      if (daeunGanSipseong === '정재' || daeunGanSipseong === '정관') {
        const lMsg = `💕 연애운 상승: ${daeunGanSipseong}의 기운으로 현재 관계가 한 단계 깊어집니다. 결혼을 진지하게 고려하거나 동거·약혼 등 관계 진전이 기대됩니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '편재' && stage !== '절' && stage !== '묘') {
        const lMsg = `💕 연애운 활발: 편재의 기운으로 연인과 함께하는 사회 활동이 늘어납니다. 다만 바쁜 일상 속에서도 둘만의 시간을 소중히 하세요.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '상관' && !yongsinHit) {
        const lMsg = `💔 연애 갈등 주의: 상관의 기운으로 연인과의 대화에서 감정 충돌이 생기기 쉽습니다. 말보다 행동으로 사랑을 표현하세요.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '겁재') {
        const lMsg = `⚠️ 연애 변동: 겁재의 기운으로 관계에 흔들림이 생길 수 있습니다. 감정적 결정을 피하고, 서로의 신뢰를 지켜나가는 것이 중요합니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '비견') {
        detailLove = `💑 연애 경쟁: 비견의 기운으로 연애에서 경쟁자가 나타날 수 있습니다. 자신감을 갖되 집착은 버리세요.`;
      } else if (['편인', '정인'].includes(daeunGanSipseong)) {
        detailLove = `💕 지적 교감: ${daeunGanSipseong}의 기운으로 연인과 학업·취미를 함께 하면 관계가 더 깊어집니다.`;
      } else if (daeunGanSipseong === '식신') {
        detailLove = `💕 달콤한 연애: 식신의 기운으로 맛집, 여행, 일상의 소소한 즐거움이 연인과의 관계를 더 달콤하게 합니다.`;
      } else if (daeunGanSipseong === '편관') {
        const lMsg = `⚠️ 연애 스트레스: 편관의 기운으로 외부 압박이 연인 관계에 영향을 줄 수 있습니다. 서로에 대한 이해와 인내가 필요합니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else {
        detailLove = `💕 연애운 보통: 연인과의 관계가 안정적으로 유지됩니다. 작은 서프라이즈가 관계를 더 좋게 합니다.`;
      }
    } else {
      // ★★★ 미혼(single): 새 인연/결혼운 중심
      const isYoung = pillar.startAge < 45;
      if (daeunGanSipseong === '정재' || daeunGanSipseong === '정관') {
        const lMsg = isYoung
          ? `💕 결혼운 활발: ${daeunGanSipseong}의 기운으로 안정적이고 진지한 인연이 들어옵니다. 결혼을 준비하거나 좋은 만남이 기대되는 시기입니다.`
          : `💕 인연운 상승: ${daeunGanSipseong}의 기운으로 늦은 인연이라도 진지하고 안정적인 만남이 기대됩니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '편재' && stage !== '절' && stage !== '묘') {
        const lMsg = isYoung
          ? `💕 애정운 다양: 편재의 기운으로 다양한 만남이 있습니다. 여러 사람을 만나보되 한 사람에게 집중하는 연습이 중요합니다.`
          : `💕 사교운 상승: 편재의 기운으로 모임이나 커뮤니티 활동에서 좋은 인연을 만날 가능성이 높습니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '상관' && !yongsinHit) {
        const lMsg = `💔 애정 주의: 상관의 기운으로 이성 관계에서 감정 충돌이 생기기 쉽습니다. 첫 만남에서 말실수를 주의하세요.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '겁재') {
        const lMsg = isYoung
          ? `💔 애정 변동: 겁재의 기운으로 이별·재회·새 만남이 반복될 수 있습니다. 감정적 결정을 피하고, 상대방을 충분히 이해하려는 노력이 필요합니다.`
          : `🤝 관계 변동: 겁재의 기운으로 주변 사람들과의 관계에 변화가 생깁니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else if (daeunGanSipseong === '비견') {
        detailLove = isYoung
          ? `💑 애정 경쟁: 비견의 기운으로 연애에서 경쟁자가 나타날 수 있습니다. 자신감을 갖되 집착은 버리세요.`
          : `🤝 동년배 교류: 비견의 기운으로 같은 또래·동료와의 유대가 깊어집니다.`;
      } else if (['편인', '정인'].includes(daeunGanSipseong)) {
        detailLove = isYoung
          ? `💕 지적 인연: ${daeunGanSipseong}의 기운으로 학업·취미 모임에서 인연을 만날 가능성이 높습니다.`
          : `🤝 정서적 안정: ${daeunGanSipseong}의 기운으로 가족이나 어른과의 관계가 편안해집니다.`;
      } else if (daeunGanSipseong === '식신') {
        detailLove = isYoung
          ? `💕 자연스러운 만남: 식신의 기운으로 맛집, 취미, 모임 등 일상에서 자연스럽게 인연이 들어옵니다.`
          : `🤝 사교 활발: 식신의 기운으로 다양한 모임에서 좋은 사람들을 만납니다.`;
      } else if (daeunGanSipseong === '편관') {
        const lMsg = isYoung
          ? `⚠️ 애정운 압박: 편관의 기운으로 연애에서 강한 끌림이 있지만 부담감도 큽니다. 상대방의 진심을 천천히 확인하세요.`
          : `🤝 인간관계: 편관의 기운으로 사회적 관계에서 긴장감이 있을 수 있습니다.`;
        detailLove = lMsg; detailParts.push(lMsg);
      } else {
        detailLove = isYoung
          ? `💕 애정운 보통: 적극적으로 나서면 좋은 인연을 만날 수 있습니다.`
          : `🤝 인간관계 안정: 주변 사람들과의 관계가 무난하게 유지됩니다.`;
      }
    }

    // (F) 격국 특이사항
    if (gyeokguk.group === '종격' && gyeokguk.unfavorableSipseongs.includes(daeunGanSipseong)) {
      const lastChar = daeunGanSipseong.charCodeAt(daeunGanSipseong.length - 1);
      const hasJongseong = (lastChar - 0xAC00) % 28 !== 0;
      const josa = hasJongseong ? '이' : '가';
      const gMsg = `🚨 종격 파격 위험: ${gyeokguk.name}인데 ${daeunGanSipseong}${josa} 와서 격국이 흔들립니다. 큰 변화를 삼가세요.`;
      generalParts.push(gMsg);
      detailParts.push(gMsg);
    }

    // 상세 멘트를 description에 합치기 (기존 호환성 유지)
    if (detailParts.length > 0) {
      description += '\n' + detailParts.join(' ');
    }

    // ===== 유소년기(0~19세) 비현실적 단어 필터링 =====
    if (pillar.startAge < 20) {
      const YOUTH_TITLE_MAP: Record<string, string> = {
        '경제적 대박의 시기!': '폭발적인 학업/재능 성장기!',
        '경제적 성장의 시기': '재능을 발견하고 키우는 시기',
        '안정적 경제 성장기': '차근차근 실력을 쌓는 시기',
        '인생 최고의 전성기!': '눈부신 학창 시절 / 재능 만개',
        '인생의 전성기': '학교 생활의 전성기',
        '최고의 전성기': '학교 생활에서 빛나는 시기',
        '사회적 인정 + 큰 기회': '학업 성취 + 리더십 발휘',
        '사회적 인정의 시기': '학업 성취 및 교우관계 원만',
        '순조로운 사회적 성장': '학업 순조로운 성장기',
        '사회적 요구가 커지는 시기': '공부·시험 압박이 커지는 시기',
        '변화 속 기회와 위험이 공존': '학교 환경 변화가 큰 시기',
        '지혜로운 안정기 + 반안의 복': '차분한 학업 집중기',
        '성숙과 안정의 시기': '또래보다 어른스러운 시기',
        '강한 압박 속 성장의 시기': '공부·시험에 대한 부담이 큰 시기',
        '에너지 폭발, 방향 주의!': '활발하지만 주의력 필요한 시기',
        '에너지는 높지만 방해도 큰 시기': '열심히 하지만 방해도 많은 시기',
        '실력은 있으나 압박이 큰 시기': '실력은 있지만 스트레스가 큰 시기',
        '돈이 들어오면서 나가는 시기': '지원은 있으나 지출도 많은 시기',
        '새 출발이지만 시련도 함께': '새로운 환경에서 적응이 필요한 시기',
        '시련과 인내의 시기': '힘든 시기지만 성장의 밑거름',
        '어려운 환경 속 숨겨진 기회': '어려운 환경에서 내면이 단단해지는 시기',
        // 목욕 새 타이틀
        '감정 기복과 외부 압박의 시기': '감정 기복이 크고 어른들 잔소리 많은 시기',
        '급격한 변화와 유혹의 시기': '친구 관계나 환경이 급변하는 시기',
        '긍정적 변화와 새 인연': '좋은 친구·선생님을 만나는 시기',
        '변화 속 행운이 숨은 시기': '새 환경에서 좋은 기회를 만나는 시기',
        '감정 관리가 필요한 변화기': '사춘기적 감정 변화가 큰 시기',
        '순조로운 변화와 전환': '자연스럽게 성장하고 변하는 시기',
        // 쇠 새 타이틀
        '하향기에 외부 압박까지 겹치는 시기': '학업 부담과 피로가 쌓이는 시기',
        '에너지 하락 속 예상 밖의 변동': '컨디션 저하 속 환경 변화가 있는 시기',
        '차분하지만 안정적인 시기': '차분하게 실력을 다지는 시기',
        '건강과 재물 모두 주의 시기': '건강 관리가 꼭 필요한 시기',
        '안정적인 하반기 전환': '안정적으로 마무리하는 시기',
        // 병 새 타이틀
        '건강·직장 모두 시련의 시기': '건강과 학업 스트레스가 큰 시기',
        '건강 주의 + 예상 밖 변동': '건강 주의 + 환경 변화의 시기',
        '건강 주의지만 내적 성장의 시기': '몸은 힘들지만 마음은 성장하는 시기',
        '재충전하며 회복하는 시기': '쉬어가며 에너지를 채우는 시기',
        '가벼운 재충전 시기': '잠깐 쉬어가는 시기',
        // 사 새 타이틀
        '큰 시련과 내면 시험의 시기': '힘든 환경에서 내면이 강해지는 시기',
        '강제적 전환과 정리의 시기': '원치 않는 변화를 받아들이는 시기',
        '내면 각성 + 새로운 문': '깊은 생각을 하게 되는 전환점',
        '정리 속에서 기회를 찾는 시기': '조용히 자기 성찰하는 시기',
        '외적 정리와 내적 시련': '외적으로 힘들고 마음도 힘든 시기',
        '부드러운 전환과 내면 성장': '조용히 성장하는 전환기',
        // 묘 새 타이틀
        '잠복된 위기, 내실 다지기 필수': '겉으로 안 보이는 스트레스 주의 시기',
        '조용한 겉모습 속 내적 갈등': '마음속 고민이 많은 시기',
        '조용하지만 알찬 축적기': '조용히 실력을 쌓는 알찬 시기',
        '내면 축적 + 숨겨진 행운': '꾸준히 공부하면 나중에 빛나는 시기',
        '침체와 정체의 시기': '답답하지만 참고 견디는 시기',
        '안정적인 내면 축적기': '차분하게 기초를 다지는 시기',
        // 태 새 타이틀
        '가능성은 있으나 불안한 시작': '새로운 시작이 불안하지만 괜찮은 시기',
        '새 출발의 혼란과 모색기': '이것저것 시도하며 길을 찾는 시기',
        '잠재력에 행운이 깃드는 시기': '숨겨진 재능이 꿈틀거리는 시기',
        '가능성은 있으나 흐릿한 시기': '아직 방향을 못 잡았지만 괜찮은 시기',
        '안정적으로 싹트는 가능성': '차근차근 가능성이 자라는 시기',
        // 양 새 타이틀
        '성장기지만 외부 시련이 있는 시기': '성장하지만 환경이 엄격한 시기',
        '성장 속 방향 모색의 시기': '관심사를 찾아가는 시행착오 시기',
        '빠른 성장 + 행운의 시기': '빠르게 실력이 느는 행운의 시기',
        '순조로운 준비와 성장기': '착실하게 성장하는 시기',
        '더디지만 포기하면 안 되는 시기': '느리지만 꾸준히 성장하는 시기',
        '안정적 성장과 준비기': '안정적으로 실력을 쌓는 시기',
        // doubleGisin 전용 타이틀
        '새 출발이 힘겨운 시기': '새 환경 적응이 힘든 시기',
        '감정 혼란과 환경 부적응의 시기': '감정이 불안하고 적응이 힘든 시기',
        '사회적 위치는 올라가나 내실이 부족한 시기': '겉은 괜찮아 보여도 속이 힘든 시기',
        '기신이 강하게 작용하는 힘든 시기': '환경 적응이 어렵고 스트레스가 큰 시기',
        '에너지는 절정이나 기신이 강한 시기': '에너지는 있으나 방향을 못 잡는 시기',
        // 절 새 타이틀
        '가장 힘든 시련기': '가장 힘들지만 성장의 밑거름이 되는 시기',
        '강제적 정리와 새 출발 준비': '원치 않는 변화를 받아들이는 시기',
        '절지에 용신이 비추는 시기': '조용히 때를 기다리는 시기',
        '조용한 비움 속 내면의 빛': '마음을 비우고 쉬어가는 시기',
        // 태 새 타이틀
        '가능성이 억눌린 시기': '아직 빛을 못 보지만 참고 견디는 시기',
        // 양 새 타이틀
        '성장이 더딘 힘든 환경의 시기': '환경은 힘들지만 조금씩 성장하는 시기',
        '기회와 방해가 공존하는 시기': '기회와 방해가 번갈아 오는 시기',
      };
      if (YOUTH_TITLE_MAP[title]) {
        title = YOUTH_TITLE_MAP[title];
      }

      description = description
        .replace(/재물운이 폭발하는 시기입니다\./g, '부모님의 전폭적인 지원이나 예상 밖의 좋은 환경이 주어집니다.')
        .replace(/사업 확장, 투자, 부동산에서 큰 성과[^.]*/g, '학업, 예체능, 자신이 관심 있는 분야에서 폭발적인 성장이 기대됩니다')
        .replace(/독립적으로 돈을 벌 수 있습니다\./g, '스스로 공부하는 자기 주도성이 강해집니다.')
        .replace(/사업, 투자, 부동산 등에서 성과[^.]*/g, '학교 성적이나 예체능 특기에서 눈에 띄는 성과를 거둡니다')
        .replace(/돈이 들어오면서 나가기도 합니다\. 재물 관리에 특히 신경 쓰세요\./g, '학업에 많은 지원이 들어가지만 그만큼 스트레스도 생길 수 있으니 컨디션 관리가 중요합니다.')
        .replace(/승진, 합격, 명예 등 사회적 인정을 받을 확률이 매우 높습니다/g, '시험 합격, 반장 당선, 혹은 예체능 대회 입상 등 학교생활에서 큰 인정을 받습니다')
        .replace(/승진이나 명예와 관련된 좋은 일이 생길 수 있습니다\./g, '학교나 친구들 사이에서 크게 칭찬받고 인정받는 일이 생깁니다.')
        .replace(/모든 것이 절정에 달하고, 리더십과 재물 모두 최고조입니다\./g, '학창 시절 최고의 전성기를 맞이합니다. 리더십을 발휘하고 학업운도 최고조입니다.')
        .replace(/권한, 재물 모두 최고입니다\./g, '학생으로서 누릴 수 있는 최고의 칭찬과 성취를 얻습니다.')
        .replace(/안정적인 수입과 지위가 유지됩니다\./g, '학업 성적이 안정되고 원만한 학교생활이 유지됩니다.')
        .replace(/경험을 살려 멘토링·컨설팅으로 전환하면 좋습니다\./g, '동생이나 친구들을 잘 이끄는 다정한 포용력이 생깁니다.')
        .replace(/외적 활동은 정리되지만/g, '밖에서 노는 시간보다 앉아있는 시간이 길어지지만')
        .replace(/외적 활동은 종결되지만/g, '야외 활동은 줄어들지만')
        .replace(/저축, 공부, 자격증에 집중하면 /g, '기초 학력을 다지고 내신 공부에 집중하면 ');
    }

    // ===== 고령(70세+) 현실성 보정 — 나이에 맞지 않는 표현 전면 교체 =====
    if (pillar.startAge >= 70) {
      // 타이틀 전면 보정
      const AGE_TITLE_MAP: Record<string, string> = {
        '인생 최고의 전성기!': '인생 경험이 빛나는 시기',
        '인생의 전성기': '삶의 결실을 거두는 시기',
        '최고의 전성기': '삶의 결실을 거두는 시기',
        '경제적 대박의 시기!': '안정적 자산 관리의 시기',
        '경제적 성장의 시기': '노후 안정의 시기',
        '안정적 경제 성장기': '노후 안정의 시기',
        '사회적 인정 + 큰 기회': '존경받는 원로의 시기',
        '사회적 인정의 시기': '존경받는 원로의 시기',
        '순조로운 사회적 성장': '존경받는 원로의 시기',
        '사회적 요구가 커지는 시기': '건강 관리가 중요한 시기',
        '가능성이 싹트는 시기': '마음의 평안을 찾는 시기',
        '새로운 가능성 + 행운의 싹': '내면의 풍요로움',
        '준비와 성장의 시기': '건강하게 여유를 누리는 시기',
        '새로운 시작의 시기': '편안한 일상을 가꾸는 시기',
        '순조로운 새 출발': '편안한 일상을 가꾸는 시기',
        '강한 압박 속 성장의 시기': '건강과 마음 관리가 중요한 시기',
        '에너지 폭발, 방향 주의!': '건강하게 활력을 유지하는 시기',
        '실력은 있으나 압박이 큰 시기': '스트레스 관리가 중요한 시기',
        '시련과 인내의 시기': '건강에 각별히 주의하는 시기',
        // 목욕 새 타이틀
        '감정 기복과 외부 압박의 시기': '마음의 안정이 필요한 시기',
        '급격한 변화와 유혹의 시기': '변화에 무리하지 않는 것이 중요한 시기',
        '긍정적 변화와 새 인연': '좋은 사람들과 함께하는 시기',
        '감정 관리가 필요한 변화기': '마음 관리가 중요한 시기',
        // 쇠 새 타이틀
        '하향기에 외부 압박까지 겹치는 시기': '건강 관리가 최우선인 시기',
        '에너지 하락 속 예상 밖의 변동': '무리하지 않고 쉬어가는 시기',
        '건강과 재물 모두 주의 시기': '건강과 자산 관리에 집중하는 시기',
        // 병 새 타이틀
        '건강·직장 모두 시련의 시기': '건강에 각별한 주의가 필요한 시기',
        '건강 주의 + 예상 밖 변동': '건강 최우선으로 챙기는 시기',
        // 사 새 타이틀
        '큰 시련과 내면 시험의 시기': '건강과 마음 모두 돌보는 시기',
        '강제적 전환과 정리의 시기': '삶을 정리하며 내면의 평화를 찾는 시기',
        // 묘 새 타이틀
        '잠복된 위기, 내실 다지기 필수': '건강 관리와 마음 정리의 시기',
        '조용한 겉모습 속 내적 갈등': '마음의 평화를 찾는 시기',
        '침체와 정체의 시기': '조용히 쉬어가는 시기',
        // 태·양 새 타이틀
        '가능성은 있으나 불안한 시작': '새로운 취미나 관심사를 찾는 시기',
        '성장기지만 외부 시련이 있는 시기': '건강 관리가 중요한 시기',
        '더디지만 포기하면 안 되는 시기': '꾸준히 건강을 관리하는 시기',
        // doubleGisin 전용
        '기신이 강하게 작용하는 힘든 시기': '건강과 마음 관리가 중요한 시기',
        '에너지는 절정이나 기신이 강한 시기': '건강하게 활력을 유지하는 시기',
        // 절 새 타이틀
        '가장 힘든 시련기': '건강에 각별히 주의하는 시기',
        '강제적 정리와 새 출발 준비': '삶을 정리하며 평화를 찾는 시기',
        '절지에 용신이 비추는 시기': '조용히 건강을 관리하는 시기',
        '조용한 비움 속 내면의 빛': '마음의 평안을 찾는 시기',
        // 태 새 타이틀
        '가능성이 억눌린 시기': '무리하지 않고 쉬어가는 시기',
        // 양 새 타이틀
        '성장이 더딘 힘든 환경의 시기': '건강 관리가 중요한 시기',
        // 기타 누락 타이틀
        '변화 속 기회와 위험이 공존': '변화에 무리하지 않는 시기',
        '안정적인 하반기 전환': '안정적으로 쉬어가는 시기',
        '건강 주의지만 내적 성장의 시기': '건강 관리 속 마음의 성장',
        '차분하지만 안정적인 시기': '차분하고 평온한 시기',
        '감정 혼란과 환경 부적응의 시기': '마음의 안정이 필요한 시기',
        '새 출발이 힘겨운 시기': '편안한 일상을 가꾸는 시기',
      };
      for (const [from, to] of Object.entries(AGE_TITLE_MAP)) {
        if (title.includes(from)) { title = to; break; }
      }

      // 설명 전면 보정
      description = description
        .replace(/사업 확장, 투자, 부동산에서 큰 성과[^.]*/g, '그동안 쌓아온 자산을 안정적으로 관리하고 가족과 함께하는 시간을 늘리세요')
        .replace(/적극적으로 도전하세요[^.]*/g, '건강을 최우선으로 하면서 여유를 즐기세요')
        .replace(/모든 것이 절정에 달하고[^.]*/g, '오랜 인생 경험이 무르익어')
        .replace(/이 기회를 최대한 활용하세요![^.]*/g, '건강하게 이 시기를 보내는 것이 가장 큰 복입니다.')
        .replace(/빠르게 실력이 올라갑니다![^.]*/g, '건강 관리와 취미 생활에 집중하면 좋습니다.')
        .replace(/다음 대운에서 대폭 성장합니다[^.]*/g, '남은 인생을 건강하고 평안하게 보내는 것이 핵심입니다')
        .replace(/무한한 가능성이 자라고 있습니다[^.]*/g, '마음의 평화를 찾고 가까운 사람들과의 관계에 집중하세요')
        .replace(/준비와 구상에 집중하세요[^.]*/g, '건강 관리를 최우선으로 하고 편안한 일상을 즐기세요')
        .replace(/큰 결실로 이어집니다[^.]*/g, '마음의 여유와 평안이 가장 큰 결실입니다');

      if (score > 7) score = Math.min(score, 7);
    }

    // ★★★ 연속 저점수 스무딩 (push 직전에 최종 적용)
    // 3개 이상 연속 score ≤ 2이면 3번째부터 최소 3점으로 올림
    if (events.length >= 2) {
      const prev2 = events.slice(-2).map(e => e.score);
      if (prev2[0] <= 2 && prev2[1] <= 2 && score <= 2) {
        score = 3;
      }
    }

    // 별점 계산 (score 1~10 → stars 1~5)
    const stars = Math.max(1, Math.min(5, Math.round(score / 2)));

    // ── 영역별 점수 산출 (종합 점수 + 세밀 영역별 보정) ──
    const clampTlArea = (v: number) => Math.round(Math.max(1, Math.min(10, v)) * 2) / 2;

    // 영역별 개별 보정값 (대운과 동일한 세밀도)
    let tStudy = 0, tMoney = 0, tLove = 0, tHealth = 0, tCareer = 0;

    // ── (A) 기존 4주 관계 + 시기별 보정 ──
    tStudy += pillarRel_tl.areaModifiers.study * 0.5 + lifePhase_tl.areaBonus.study * lifePhase_tl.areaWeights.study;
    tMoney += pillarRel_tl.areaModifiers.money * 0.5 + lifePhase_tl.areaBonus.money * lifePhase_tl.areaWeights.money;
    tLove += pillarRel_tl.areaModifiers.love * 0.5 + lifePhase_tl.areaBonus.love * lifePhase_tl.areaWeights.love;
    tHealth += pillarRel_tl.areaModifiers.health * 0.5 + lifePhase_tl.areaBonus.health * lifePhase_tl.areaWeights.health - lifePhase_tl.healthVulnerability * 0.3;
    tCareer += pillarRel_tl.areaModifiers.career * 0.5 + lifePhase_tl.areaBonus.career * lifePhase_tl.areaWeights.career;

    // ── (B) 신살 areaEffect 반영 ──
    tStudy += advSinsal_tl.areaEffect.study;
    tMoney += advSinsal_tl.areaEffect.money;
    tLove += advSinsal_tl.areaEffect.love;
    tHealth += advSinsal_tl.areaEffect.health;
    tCareer += advSinsal_tl.areaEffect.career;

    // ── (C) 십성별 영역 차등 ──
    const tlSip = daeunGanSipseong;
    if (tlSip === '정재') { tMoney += 0.7; tCareer += 0.2; }
    else if (tlSip === '편재') { tMoney += 0.5; tCareer += 0.15; }
    else if (tlSip === '정관') { tCareer += 0.7; tStudy += 0.15; }
    else if (tlSip === '편관') { tCareer += 0.4; tHealth -= 0.2; }
    else if (tlSip === '정인') { tStudy += 0.7; tHealth += 0.2; }
    else if (tlSip === '편인') { tStudy += 0.5; tHealth -= 0.15; }
    else if (tlSip === '식신') { tMoney += 0.3; tHealth += 0.3; tCareer += 0.2; }
    else if (tlSip === '상관') { tCareer -= 0.3; tMoney += 0.2; tLove += 0.15; }
    else if (tlSip === '비견') { tLove -= 0.1; }
    else if (tlSip === '겁재') { tMoney -= 0.3; tLove -= 0.2; }

    // ── (D) 신강/신약 × 십성 교차 영역 보정 ──
    const tlIsBigyeop = ['비견', '겁재'].includes(tlSip);
    const tlIsInseong = ['편인', '정인'].includes(tlSip);
    const tlIsSiksang = ['식신', '상관'].includes(tlSip);
    const tlIsJaeseong = ['편재', '정재'].includes(tlSip);
    const tlIsGwanseong = ['편관', '정관'].includes(tlSip);
    const tlIsJonggyeok = gyeokguk.group === '종격';

    if (!tlIsJonggyeok) {
      if (isSingang) {
        if (tlIsJaeseong) { tMoney += 0.5; tLove += 0.15; }
        if (tlIsGwanseong) { tCareer += 0.4; }
        if (tlIsSiksang) { tMoney += 0.3; tCareer += 0.25; }
        if (tlIsBigyeop) { tMoney -= 0.3; tCareer -= 0.2; }
        if (tlIsInseong) { tStudy += 0.2; tCareer -= 0.15; }
      }
      if (!isSingang) { // 신약
        if (tlIsInseong) { tStudy += 0.5; tHealth += 0.3; }
        if (tlIsBigyeop) { tHealth += 0.3; tCareer += 0.15; }
        if (tlIsJaeseong) { tHealth -= 0.3; tMoney -= 0.2; }
        if (tlIsGwanseong) { tHealth -= 0.3; tCareer -= 0.15; }
        if (tlIsSiksang) { tHealth -= 0.2; }
      }
    }

    // ── (E) 12운성별 영역 차등 ──
    if (stage === '장생') { tStudy += 0.4; tHealth += 0.2; tCareer += 0.15; }
    else if (stage === '목욕') { tLove += 0.5; tStudy -= 0.15; }
    else if (stage === '관대') { tCareer += 0.4; tStudy += 0.3; }
    else if (stage === '건록') { tCareer += 0.5; tMoney += 0.3; tHealth += 0.2; }
    else if (stage === '제왕') { tCareer += 0.5; tMoney += 0.2; tHealth += 0.1; }
    else if (stage === '쇠') { tHealth -= 0.2; tCareer -= 0.1; }
    else if (stage === '병') { tHealth -= 0.4; tCareer -= 0.15; }
    else if (stage === '사') { tHealth -= 0.5; tLove -= 0.2; }
    else if (stage === '묘') { tHealth -= 0.3; tStudy += 0.15; }
    else if (stage === '절') { tLove -= 0.2; tHealth -= 0.2; tMoney -= 0.15; }
    else if (stage === '태') { tLove += 0.15; tStudy += 0.1; }
    else if (stage === '양') { tStudy += 0.2; tHealth += 0.15; }

    // ── (F) 성별 × 십성 연애운 차등 ──
    if (saju.gender === 'female') {
      if (tlSip === '정관') tLove += 0.5;
      else if (tlSip === '편관') tLove += 0.2;
      if (tlIsJaeseong) tLove -= 0.1;
    }
    if (saju.gender === 'male') {
      if (tlSip === '정재') tLove += 0.5;
      else if (tlSip === '편재') tLove += 0.2;
      if (tlIsGwanseong) tLove -= 0.1;
    }

    // ── (G) 도화살/역마살/화개살 영역 보정 ──
    const DOHWA_TL: Record<string, string> = {
      '자': '유', '축': '오', '인': '묘', '묘': '자',
      '진': '유', '사': '오', '오': '묘', '미': '자',
      '신': '유', '유': '오', '술': '묘', '해': '자',
    };
    const YEOKMA_TL: Record<string, string> = {
      '자': '인', '축': '해', '인': '신', '묘': '사',
      '진': '인', '사': '해', '오': '신', '미': '사',
      '신': '인', '유': '해', '술': '신', '해': '사',
    };
    const HWAGAE_TL: Record<string, string> = {
      '자': '진', '축': '축', '인': '술', '묘': '미',
      '진': '진', '사': '축', '오': '술', '미': '미',
      '신': '진', '유': '축', '술': '술', '해': '미',
    };
    const dayJiTl = saju.day.jiji;
    const yearJiTl = saju.year.jiji;
    if (pillar.jiji === DOHWA_TL[dayJiTl] || pillar.jiji === DOHWA_TL[yearJiTl]) {
      tLove += 0.5; tCareer += 0.1;
    }
    if (pillar.jiji === YEOKMA_TL[dayJiTl] || pillar.jiji === YEOKMA_TL[yearJiTl]) {
      tCareer += 0.3; tMoney += 0.15;
    }
    if (pillar.jiji === HWAGAE_TL[dayJiTl] || pillar.jiji === HWAGAE_TL[yearJiTl]) {
      tStudy += 0.5; tHealth += 0.1;
    }

    // ── (H) 오행 밸런스 영역별 관련 오행 보정 ──
    const obTl = saju.ohaengBalance;
    if (obTl) {
      const wBal = obTl['수'] || 0;
      const wdBal = obTl['목'] || 0;
      const fBal = obTl['화'] || 0;
      const mBal = obTl['금'] || 0;
      const eBal = obTl['토'] || 0;
      if (wBal <= 1 && (ganOh === '수' || jiOh === '수')) { tStudy += 0.4; }
      if (wdBal <= 1 && (ganOh === '목' || jiOh === '목')) { tHealth += 0.4; }
      if (fBal <= 1 && (ganOh === '화' || jiOh === '화')) { tLove += 0.3; tCareer += 0.1; }
      if (mBal <= 1 && (ganOh === '금' || jiOh === '금')) { tCareer += 0.3; }
      if (eBal <= 1 && (ganOh === '토' || jiOh === '토')) { tMoney += 0.4; tHealth += 0.1; }
      if (wBal >= 5 && (ganOh === '수' || jiOh === '수')) { tHealth -= 0.2; }
      if (wdBal >= 5 && (ganOh === '목' || jiOh === '목')) { tHealth -= 0.15; }
      if (fBal >= 5 && (ganOh === '화' || jiOh === '화')) { tHealth -= 0.2; tLove -= 0.1; }
      if (mBal >= 5 && (ganOh === '금' || jiOh === '금')) { tHealth -= 0.15; }
      if (eBal >= 5 && (ganOh === '토' || jiOh === '토')) { tHealth -= 0.15; tMoney -= 0.1; }
    }

    // ── (I) 용신/기신 유입 전 영역 보정 ──
    if (ganOh === saju.yongsin || jiOh === saju.yongsin) {
      tStudy += 0.15; tMoney += 0.15; tLove += 0.1; tHealth += 0.2; tCareer += 0.15;
    }
    if (ganOh === saju.gisin || jiOh === saju.gisin) {
      tStudy -= 0.1; tMoney -= 0.1; tLove -= 0.05; tHealth -= 0.15; tCareer -= 0.1;
    }

    // ── (J) 충이 있으면 건강/연애 추가 감점 (×0.6 감쇠: 대운 이중 반영 완화) ──
    if (hapChung.chungCount > 0) {
      tHealth -= 0.12 * hapChung.chungCount;
      tLove -= 0.1 * hapChung.chungCount;
    }

    // 타임라인 자체 영역 점수
    const rawStudy = score + tStudy;
    const rawMoney = score + tMoney;
    const rawLove = score + tLove;
    const rawHealth = score + tHealth;
    const rawCareer = score + tCareer;

    // 대운 영역별 점수와 50/50 블렌딩 (대운과의 괴리 최소화)
    const da = pillar.areaScores;
    const tlAreaScores: TimelineAreaScores = {
      study: clampTlArea(da ? rawStudy * 0.5 + da.study * 0.5 : rawStudy),
      money: clampTlArea(da ? rawMoney * 0.5 + da.money * 0.5 : rawMoney),
      love: clampTlArea(da ? rawLove * 0.5 + da.love * 0.5 : rawLove),
      health: clampTlArea(da ? rawHealth * 0.5 + da.health * 0.5 : rawHealth),
      career: clampTlArea(da ? rawCareer * 0.5 + da.career * 0.5 : rawCareer),
    };

    events.push({
      ageRange: `${pillar.startAge}~${pillar.endAge}세`,
      title: adjustTextByChildren(title, saju.hasChildren),
      description: adjustTextByChildren(description, saju.hasChildren),
      icon,
      score,
      areaScores: tlAreaScores,
      daeunGanji: daeunGanJi,
      stage: stage,
      stars,
      detailCareer: detailCareer || undefined,
      detailWealth: detailWealth || undefined,
      detailLove: detailLove || undefined,
      detailHealth: detailHealth || undefined,
      detailGeneral: generalParts.length > 0 ? generalParts.join(' ') : undefined,
      // 가족관계 궁위운은 세운(올해 운세)에서만 표시 — 대운/타임라인에서는 제외
    });
  }

  return events;
}
