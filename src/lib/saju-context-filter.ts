/**
 * saju-context-filter.ts
 * 중앙 교차검증 유틸리티 — 모든 해석 텍스트가 사주 컨텍스트를 반영하도록 필터링/보정
 *
 * 목적: 12운성, 타로, 인생예측 등 고정 텍스트가 사주의 실제 상태
 * (약한오행, 용신/기신, 합충, 신살, 대운/세운 에너지)와 모순되지 않도록 보정
 */

import type { Ohaeng, SajuResult } from './saju-engine';
import { OHAENG_SANGSAENG, OHAENG_SANGGEUK } from './saju-engine';

// ============================================================
// 1) 사주 컨텍스트 요약 — 모든 모듈이 공통으로 사용
// ============================================================

export interface SajuContext {
  weakOh: Ohaeng | undefined;       // 가장 약한 오행
  weakBal: number;                   // 약한 오행 수치 (0~5)
  dominantOh: Ohaeng | undefined;    // 가장 강한 오행
  yongsin: Ohaeng;                   // 용신
  gisin: Ohaeng;                     // 기신
  isExtremeWeak: boolean;            // 극도 부족 (≤1)
  isModerateWeak: boolean;           // 중간 부족 (≤2)
  monthSipseong: string;             // 월주 십신
  hourSipseong: string;              // 시주 십신
  relationship: string;              // single/dating/married
  ohaengBalance: Record<Ohaeng, number>;

  // ===== 심화 분석 필드 (extractSajuContextDeep에서 채워짐) =====
  singangType?: '신강' | '신약' | '극신강' | '극신약';
  singangScore?: number;             // 0~10
  johuType?: '한습' | '난조' | '균형';

  // 재물 구조
  hasShikshinSaengJae?: boolean;     // 식신생재 구조
  hasSanggwanSaengJae?: boolean;     // 상관생재 구조
  isJaeDaSinYak?: boolean;           // 재다신약
  isShinWangJaeWang?: boolean;       // 신왕재왕
  isJaeSungHonJap?: boolean;         // 재성혼잡 (정재+편재 혼재)
  isMuJae?: boolean;                 // 무재 사주
  jaeType?: '정재' | '편재' | 'mixed' | 'none';

  // 직업/인성
  hasInsasinSamhyung?: boolean;      // 인사신 삼형살
  inseongCount?: number;             // 인성 개수
  hasInseongExcess?: boolean;        // 인성 과다 (결정장애)
  hasGwanInSangsaeng?: boolean;      // 관인상생 흐름
}

/** SajuResult에서 교차검증에 필요한 컨텍스트 추출 */
export function extractSajuContext(saju: SajuResult): SajuContext {
  const weakOh = saju.weakestOhaeng as Ohaeng | undefined;
  const weakBal = saju.ohaengBalance ? Math.min(...Object.values(saju.ohaengBalance)) : 99;
  return {
    weakOh,
    weakBal,
    dominantOh: saju.dominantOhaeng as Ohaeng | undefined,
    yongsin: saju.yongsin,
    gisin: saju.gisin,
    isExtremeWeak: !!weakOh && weakBal <= 1,
    isModerateWeak: !!weakOh && weakBal <= 2,
    monthSipseong: saju.sipseongs?.month || '',
    hourSipseong: saju.sipseongs?.hour || '',
    relationship: saju.relationship || 'single',
    ohaengBalance: saju.ohaengBalance,
  };
}

// ============================================================
// 1-B) 심화 컨텍스트 추출 — 신강/신약, 조후, 재물/직업 구조 포함
// ============================================================

/** 재물 구조 감지 */
function detectWealthStructure(saju: SajuResult): {
  hasShikshinSaengJae: boolean; hasSanggwanSaengJae: boolean;
  isJaeDaSinYak: boolean; isShinWangJaeWang: boolean;
  isJaeSungHonJap: boolean; isMuJae: boolean;
  jaeType: '정재' | '편재' | 'mixed' | 'none';
  inseongCount: number; hasInseongExcess: boolean;
  hasGwanInSangsaeng: boolean; hasInsasinSamhyung: boolean;
} {
  const sips = saju.sipseongs;
  const allSips = [sips?.year, sips?.month, sips?.hour].filter(Boolean) as string[];
  const excess = saju.sipseongBalance?.excess || [];
  const lacking = saju.sipseongBalance?.lacking || [];

  // 정재/편재 존재 여부
  const hasJeongjae = allSips.includes('정재');
  const hasPyeonjae = allSips.includes('편재');
  const hasJae = hasJeongjae || hasPyeonjae;
  const isJaeSungHonJap = hasJeongjae && hasPyeonjae;
  const isMuJae = !hasJae && lacking.some((s: string) => s.includes('재성'));
  const jaeType: '정재' | '편재' | 'mixed' | 'none' = isJaeSungHonJap ? 'mixed' : hasJeongjae ? '정재' : hasPyeonjae ? '편재' : 'none';

  // 재성 과다 + 신약 = 재다신약
  const isJaeExcess = excess.some((s: string) => s.includes('재성'));
  const weakBal = saju.ohaengBalance ? Math.min(...Object.values(saju.ohaengBalance)) : 99;
  const ilOh = saju.day?.cheonganOhaeng;
  const ilBal = ilOh && saju.ohaengBalance ? saju.ohaengBalance[ilOh] : 3;
  const isJaeDaSinYak = isJaeExcess && ilBal <= 2;
  const isShinWangJaeWang = ilBal >= 3.5 && hasJae && !isJaeDaSinYak;

  // 식신생재 / 상관생재
  const hasShikshinSaengJae = allSips.includes('식신') && hasJae;
  const hasSanggwanSaengJae = allSips.includes('상관') && hasJae;

  // 인성 분석
  const inseongCount = allSips.filter(s => s === '정인' || s === '편인').length;
  const hasInseongExcess = excess.some((s: string) => s.includes('인성'));

  // 관인상생: 관성 + 인성 모두 존재
  const hasGwan = allSips.some(s => s === '정관' || s === '편관');
  const hasIn = inseongCount > 0;
  const hasGwanInSangsaeng = hasGwan && hasIn;

  // 인사신 삼형살
  const jijis = [saju.year?.jiji, saju.month?.jiji, saju.day?.jiji, saju.hour?.jiji];
  const samCount = [jijis.includes('인'), jijis.includes('사'), jijis.includes('신')].filter(Boolean).length;
  const hasInsasinSamhyung = samCount >= 2;

  return {
    hasShikshinSaengJae, hasSanggwanSaengJae,
    isJaeDaSinYak, isShinWangJaeWang,
    isJaeSungHonJap, isMuJae, jaeType,
    inseongCount, hasInseongExcess,
    hasGwanInSangsaeng, hasInsasinSamhyung,
  };
}

/** 심화 컨텍스트 — 신강/신약, 조후, 재물 구조까지 포함 (타로 연계용) */
export function extractSajuContextDeep(saju: SajuResult): SajuContext {
  const base = extractSajuContext(saju);

  // 순환 의존 방지: require로 지연 로딩
  const { analyzeSingang, analyzeJohu } = require('./daeun');

  const singang = analyzeSingang(saju);
  const johu = analyzeJohu(saju.ohaengBalance, base.weakOh, base.isExtremeWeak);
  const wealth = detectWealthStructure(saju);

  return {
    ...base,
    singangType: singang.type,
    singangScore: singang.score,
    johuType: johu.type,
    ...wealth,
  };
}

// ============================================================
// 2) 오행↔건강 매핑 (공통 사용)
// ============================================================

/** 약한 오행별 건강 취약 장기 */
export const WEAK_OHAENG_ORGAN: Record<Ohaeng, string> = {
  '목': '간·담·눈·근육',
  '화': '심장·혈관·소장·정신',
  '토': '위장·비장·소화기',
  '금': '폐·대장·피부·호흡기',
  '수': '신장·방광·허리·비뇨기',
};

/** 약한 오행별 피해야 할 환경/활동 키워드 */
const AVOID_KEYWORDS: Record<Ohaeng, RegExp> = {
  '화': /경쟁|발표|PR|사람들 앞|SNS|이미지|적극적|대중|무대|영업/,
  '목': /야근|야간|육체|무리한|체력.*도전|과로|장시간.*서/,
  '토': /교대|불규칙|출장|유흥|자극적|폭식/,
  '금': /먼지|화학|영업|강의|말하는|환기.*안|흡연/,
  '수': /야간|유흥|과음|앉아|좌식|밤|찬.*환경/,
};

/** 약한 오행별 추천 환경/활동 */
export const RECOMMEND_ENV: Record<Ohaeng, string> = {
  '화': '안정적 루틴, 소규모 팀, 재택근무, 1:1 상담, 창작·글쓰기',
  '목': '규칙적 근무, 자연 가까운 환경, 교육·연구, 가벼운 운동',
  '토': '규칙적 식사 가능한 직종, 안정적 조직, 꾸준한 루틴',
  '금': '깨끗한 사무환경, IT·디자인, 조용한 연구직, 자연환경',
  '수': '적절한 활동량, 따뜻한 환경, 규칙적 수분 섭취 가능한 곳',
};

// ============================================================
// 3) 텍스트 충돌 필터링 — 건강과 모순되는 조언 제거/교체
// ============================================================

/**
 * 건강 취약 상태와 모순되는 텍스트를 필터링
 * - 극약(≤1): 충돌 텍스트 완전 제거 (빈 문자열)
 * - 약함(≤3): 충돌 텍스트에 경고 추가
 * - 정상(>3): 원본 그대로
 */
export function filterTextByHealth(text: string, ctx: SajuContext): string {
  if (!ctx.weakOh || ctx.weakBal > 3) return text;
  const pattern = AVOID_KEYWORDS[ctx.weakOh];
  if (!pattern || !pattern.test(text)) return text;

  if (ctx.isExtremeWeak) return ''; // 극약: 완전 제거
  // 약함: 경고 추가
  return `${text} (단, ${RECOMMEND_ENV[ctx.weakOh]} 환경이 건강상 더 적합합니다.)`;
}

/**
 * 텍스트가 건강과 충돌하면 대체 텍스트로 교체
 * - 극약(≤1): 대체 텍스트로 완전 교체
 * - 약함(≤3): 원본 + 건강 경고
 * - 정상(>3): 원본 그대로
 */
export function replaceIfConflict(
  text: string,
  replacement: string,
  ctx: SajuContext
): string {
  if (!ctx.weakOh || ctx.weakBal > 3) return text;
  const pattern = AVOID_KEYWORDS[ctx.weakOh];
  if (!pattern || !pattern.test(text)) return text;

  if (ctx.isExtremeWeak) return replacement; // 극약: 대체
  return `${text} (단, ${RECOMMEND_ENV[ctx.weakOh]} 환경이 건강상 더 적합합니다.)`;
}

// ============================================================
// 4) 12운성 텍스트 교차보정 — personality/career/love/health/advice
// ============================================================

interface StageTexts {
  personality: string;
  career: string;
  love: string;
  health: string;
  advice: string;
  fortune: string;
}

/**
 * 12운성 고정 텍스트를 사주 컨텍스트에 맞게 보정
 * - 건강 충돌 필터링
 * - 용신/기신 기반 강조/약화
 * - 십신 기반 성격 보정
 */
export function adjustStageTexts(
  stage: StageTexts,
  ctx: SajuContext
): StageTexts {
  const result = { ...stage };

  // (A) Career: 건강 충돌 → 극약이면 대체, 약하면 경고 추가
  if (ctx.weakOh && ctx.weakBal <= 3) {
    const filtered = filterTextByHealth(result.career, ctx);
    if (!filtered) {
      // 극약: 충돌 텍스트가 제거됨 → 대체 텍스트
      result.career = `건강을 고려한 직업 선택이 중요합니다. ${RECOMMEND_ENV[ctx.weakOh]}이 적합합니다.`;
    } else {
      // 약함 또는 충돌 없음: filterTextByHealth가 경고를 추가했거나 원본 유지
      result.career = filtered;
    }
  }

  // (B) Love: 건강 상태에 따른 관계 조언 보정 (극약 + 약함 모두)
  if (ctx.weakOh && ctx.weakBal <= 3) {
    if (ctx.weakOh === '화' && /매력적|인기|사교|활발|적극/.test(result.love)) {
      if (ctx.isExtremeWeak) {
        result.love = '소수의 편안한 사람과 깊은 관계에 집중하세요. 무리한 사교 활동보다 1:1 깊은 대화가 맞습니다.';
      } else {
        result.love += ' 다만 화 기운 부족으로 사교적 에너지가 제한될 수 있으니, 소수의 깊은 관계에 집중하는 것이 좋습니다.';
      }
    } else if (/적극|활발|많은.*사람|파티/.test(result.love)) {
      result.love += ' 다만 체력이 허락하는 범위 내에서 관계를 유지하세요.';
    }
  }

  // (B-2) Advice: 건강 상태와 모순되는 행동 조언 필터링
  if (ctx.weakOh && ctx.weakBal <= 3) {
    result.advice = filterTextByHealth(result.advice, ctx);
    if (!result.advice) {
      result.advice = `건강을 최우선으로 하면서 할 수 있는 범위 내에서 활동하세요. ${RECOMMEND_ENV[ctx.weakOh]} 환경이 적합합니다.`;
    }
  }

  // (C) Health: 약한 오행 기반 보정
  if (ctx.isModerateWeak && ctx.weakOh) {
    const organ = WEAK_OHAENG_ORGAN[ctx.weakOh];
    if (!result.health.includes(organ.split('·')[0])) {
      result.health += ` 특히 ${ctx.weakOh}(${organ}) 기운이 부족하므로 이 부위 관리에 신경 쓰세요.`;
    }
  }

  // (D) Personality: 십신 기반 미세 보정
  const ms = ctx.monthSipseong;
  if (ms === '상관' || ms === '겁재') {
    if (/온화|순한|조용/.test(result.personality)) {
      result.personality += ' 그러나 월주 십신의 영향으로 내면에 강한 자기주장과 반항심이 숨어 있을 수 있습니다.';
    }
  } else if (ms === '정인' || ms === '편인') {
    if (/공격|과감|무모/.test(result.personality)) {
      result.personality += ' 다만 월주 정인/편인의 영향으로 학습과 사색을 통해 충동을 제어하는 힘이 있습니다.';
    }
  }

  // (E) Fortune: 기신 오행이 강한 시기 경고
  // (이 부분은 대운/세운 오행과의 상호작용으로 daeun.ts에서 처리)

  return result;
}

// ============================================================
// 5) 타로 교차검증 — 카드 오행 vs 사주 상태
// ============================================================

/** 타로 수트 → 오행 매핑 */
export const SUIT_OHAENG: Record<string, Ohaeng> = {
  'wands': '화',
  'cups': '수',
  'swords': '금',
  'pentacles': '토',
};

/** 메이저 아르카나 주요 카드 오행 (대표적) */
export const MAJOR_OHAENG: Record<number, Ohaeng> = {
  0: '화',   // 바보 (시작, 모험)
  1: '목',   // 마법사 (성장, 기술)
  2: '수',   // 여사제 (직관, 지혜)
  3: '토',   // 여황제 (풍요, 안정)
  4: '화',   // 황제 (권위, 리더십)
  5: '토',   // 교황 (전통, 가르침)
  6: '화',   // 연인 (열정, 선택)
  7: '목',   // 전차 (추진력)
  8: '금',   // 힘 (인내, 절제)
  9: '수',   // 은둔자 (성찰)
  10: '토',  // 운명의 수레바퀴 (순환)
  11: '금',  // 정의 (공정, 결단)
  12: '수',  // 매달린 사람 (인내)
  13: '금',  // 죽음 (변환, 끝)
  14: '수',  // 절제 (조화)
  15: '화',  // 악마 (욕망, 집착)
  16: '화',  // 탑 (파괴, 변혁)
  17: '수',  // 별 (희망)
  18: '수',  // 달 (불안, 무의식)
  19: '화',  // 태양 (성공, 활력)
  20: '금',  // 심판 (재탄생)
  21: '토',  // 세계 (완성)
};

export interface TarotCrossResult {
  isYongsinCard: boolean;     // 용신 카드인지
  isGisinCard: boolean;       // 기신 카드인지
  supplementsWeak: boolean;   // 약한 오행을 보충하는지
  suppressesWeak: boolean;    // 약한 오행을 억누르는지
  crossMessage: string;       // 교차검증 메시지
}

/**
 * 타로 카드 1장의 오행과 사주 컨텍스트 교차검증
 */
export function crossCheckTarotCard(
  cardOhaeng: Ohaeng | undefined,
  ctx: SajuContext,
  isReversed: boolean = false,
): TarotCrossResult {
  const result: TarotCrossResult = {
    isYongsinCard: false,
    isGisinCard: false,
    supplementsWeak: false,
    suppressesWeak: false,
    crossMessage: '',
  };

  if (!cardOhaeng) return result;

  result.isYongsinCard = cardOhaeng === ctx.yongsin;
  result.isGisinCard = cardOhaeng === ctx.gisin;

  if (ctx.weakOh) {
    result.supplementsWeak = cardOhaeng === ctx.weakOh || OHAENG_SANGSAENG[cardOhaeng] === ctx.weakOh;
    result.suppressesWeak = OHAENG_SANGGEUK[cardOhaeng] === ctx.weakOh;
  }

  // 교차 메시지 생성
  const messages: string[] = [];

  if (result.isYongsinCard && !isReversed) {
    messages.push(`✅ 용신(${ctx.yongsin}) 카드! 당신에게 가장 필요한 기운입니다.`);
  } else if (result.isYongsinCard && isReversed) {
    messages.push(`⚠️ 용신(${ctx.yongsin}) 카드가 역방향 — 필요한 기운이 차단되고 있습니다. 의식적으로 ${ctx.yongsin} 에너지를 보충하세요.`);
  }

  if (result.isGisinCard && !isReversed) {
    messages.push(`🔴 기신(${ctx.gisin}) 카드 주의 — 유혹이나 과잉 에너지에 끌리지 않도록 경계하세요.`);
  } else if (result.isGisinCard && isReversed) {
    messages.push(`💡 기신(${ctx.gisin}) 카드가 역방향 — 부정적 영향이 약화되어 오히려 교훈을 얻을 수 있습니다.`);
  }

  if (result.supplementsWeak && ctx.isExtremeWeak) {
    messages.push(`🌿 부족한 ${ctx.weakOh} 기운을 보충해주는 카드입니다. 이 에너지를 적극 수용하세요.`);
  }

  if (result.suppressesWeak && ctx.isExtremeWeak) {
    messages.push(`⛔ 이미 약한 ${ctx.weakOh} 기운을 더 억누르는 카드입니다. ${WEAK_OHAENG_ORGAN[ctx.weakOh!]} 관련 건강에 각별히 주의하세요.`);
  }

  result.crossMessage = messages.join(' ');
  return result;
}

// ============================================================
// 6) 대운/세운 에너지 보정 — 조언 톤 조절
// ============================================================

export type EnergyLevel = 'high' | 'mid' | 'low';

export function getEnergyLevel(stageEnergy: number): EnergyLevel {
  if (stageEnergy >= 8) return 'high';
  if (stageEnergy >= 5) return 'mid';
  return 'low';
}

/**
 * 대운/세운 에너지 + 건강 상태 종합하여 조언 톤 결정
 * - high energy + healthy → "적극 도전"
 * - high energy + sick → "기회는 좋지만 무리 금물"
 * - low energy + healthy → "내실 다지기"
 * - low energy + sick → "회복에 집중"
 */
export function getAdviceTone(
  energy: EnergyLevel,
  ctx: SajuContext
): { prefix: string; suffix: string } {
  if (energy === 'high' && !ctx.isExtremeWeak) {
    return {
      prefix: '운의 에너지가 높습니다.',
      suffix: '적극적으로 움직이되, 기본기를 놓치지 마세요.',
    };
  }
  if (energy === 'high' && ctx.isExtremeWeak) {
    return {
      prefix: '운의 에너지는 좋지만 건강이 뒷받침되어야 합니다.',
      suffix: '무리하지 않는 선에서 기회를 잡으세요. 체력 관리가 성공의 핵심입니다.',
    };
  }
  if (energy === 'low' && !ctx.isExtremeWeak) {
    return {
      prefix: '내실을 다지는 시기입니다.',
      suffix: '큰 변화보다 준비와 학습에 집중하면 다음 시기에 빛을 발합니다.',
    };
  }
  // low + sick
  return {
    prefix: '건강 회복이 최우선인 시기입니다.',
    suffix: '무리한 도전보다 치료와 안정에 집중하세요. 지금의 쉼이 미래의 도약입니다.',
  };
}

// ============================================================
// 7) 십신 교차검증 — 직업/연애/재물 해석에 십신 반영
// ============================================================

/** 십신별 직업 스타일 수정자 */
export const SIPSEONG_CAREER_MOD: Record<string, string> = {
  '비견': '독립적 업무, 동업 주의, 경쟁 환경에서 성장',
  '겁재': '과감한 투자·도전 성향, 손실 리스크 관리 필수',
  '식신': '창작·요리·교육 등 표현 분야 적합, 안정적 성장',
  '상관': '혁신·비평·예술 분야 빛남, 조직 갈등 주의',
  '편재': '사업·투자·영업 재능, 큰돈 들어오고 나감',
  '정재': '안정적 월급제·공무원·관리직 적합, 꾸준한 축적',
  '편관': '군·경·법·의 등 권위 분야, 리더십과 압박 공존',
  '정관': '공직·대기업·관리직 적합, 사회적 인정 추구',
  '편인': '연구·기술·특수 분야, 고독한 전문가 기질',
  '정인': '교육·학문·상담 적합, 배움을 통한 성장',
};

/** 십신별 연애/결혼 수정자 */
export const SIPSEONG_LOVE_MOD: Record<string, string> = {
  '비견': '독립적 연애 스타일, 친구 같은 관계 선호',
  '겁재': '질투·집착 경향 주의, 열정적이지만 갈등도 강함',
  '식신': '헌신적·돌봄형 연애, 안정적 가정 지향',
  '상관': '자유로운 연애관, 속박 싫어함, 이상주의적',
  '편재': '다정다감하지만 바람기 주의, 여러 인연 가능성',
  '정재': '한 사람에게 충실, 결혼 후 안정적 가정 구축',
  '편관': '카리스마 있는 상대에 끌림, 지배적 관계 경향',
  '정관': '전통적 결혼관, 안정적 가정 추구',
  '편인': '독특한 연애관, 정신적 교감 중시',
  '정인': '따뜻하고 헌신적, 어머니 같은 포용력',
};

/** 월주 십신 기반 직업 조언 보정 */
export function addSipseongCareerNote(ctx: SajuContext): string {
  const mod = SIPSEONG_CAREER_MOD[ctx.monthSipseong];
  if (!mod) return '';
  return `\n💼 월주 십신(${ctx.monthSipseong}) 영향: ${mod}`;
}

/** 월주 십신 기반 연애 조언 보정 */
export function addSipseongLoveNote(ctx: SajuContext): string {
  const mod = SIPSEONG_LOVE_MOD[ctx.monthSipseong];
  if (!mod) return '';
  return `\n💕 월주 십신(${ctx.monthSipseong}) 영향: ${mod}`;
}

// ============================================================
// 8) 오행 균형 분석 — 타로 스프레드 전체 교차검증
// ============================================================

/**
 * 타로 카드 배열 전체의 오행 커버리지를 사주와 대조
 */
export function analyzeSpreadOhaengCoverage(
  cardOhaengs: (Ohaeng | undefined)[],
  ctx: SajuContext,
): string {
  const covered = new Set(cardOhaengs.filter(Boolean) as Ohaeng[]);
  const messages: string[] = [];

  // 부족한 오행 카드가 나왔는지
  if (ctx.weakOh && covered.has(ctx.weakOh)) {
    messages.push(`🌿 부족한 ${ctx.weakOh} 기운의 카드가 나왔습니다 — 자연스러운 보충의 신호입니다.`);
  } else if (ctx.weakOh && !covered.has(ctx.weakOh)) {
    messages.push(`⚠️ 카드에 ${ctx.weakOh} 기운이 없습니다 — 의식적으로 ${ctx.weakOh} 에너지를 보충하세요.`);
  }

  // 기신 오행 카드가 과다하면 경고
  const gisinCount = cardOhaengs.filter(oh => oh === ctx.gisin).length;
  if (gisinCount >= 2) {
    messages.push(`🔴 기신(${ctx.gisin}) 카드가 ${gisinCount}장 — 과잉 에너지에 휘둘리지 않도록 주의하세요.`);
  }

  // 용신 카드 비율
  const yongsinCount = cardOhaengs.filter(oh => oh === ctx.yongsin).length;
  if (yongsinCount >= 2) {
    messages.push(`✨ 용신(${ctx.yongsin}) 카드가 ${yongsinCount}장 — 좋은 기운이 강하게 흐르고 있습니다!`);
  }

  return messages.join('\n');
}

// ============================================================
// 9) 관계 상태 기반 텍스트 보정
// ============================================================

/** 연애 텍스트를 관계 상태에 맞게 보정 */
export function adjustLoveTextByRelationship(text: string, relationship: string): string {
  if (relationship === 'married') {
    return text
      .replace(/새로운 인연/g, '배우자와의 관계')
      .replace(/이성에게 매력/g, '배우자에게 매력')
      .replace(/연애 초기/g, '부부 관계')
      .replace(/만남의 기회/g, '부부간 대화의 기회')
      .replace(/소개팅/g, '부부 데이트')
      .replace(/고백/g, '진솔한 대화');
  }
  return text;
}

// ============================================================
// 10) 자녀 유무 기반 텍스트 보정
// ============================================================

/** 시주(시간 기둥) 관련 텍스트를 자녀 유무에 맞게 보정 */
export function adjustTextByChildren(text: string, hasChildren: boolean): string {
  if (hasChildren) {
    // 자녀가 있는 사람: "미래 계획" → "자녀·가정" 중심
    return text
      .replace(/자녀·후배·미래 계획/g, '자녀·가정·후배')
      .replace(/자녀·후배·미래/g, '자녀·가정·후배')
      .replace(/미래·계획·후배·결과물/g, '자녀·가정·후배·결과물')
      .replace(/후배를 통해 기쁜 소식/g, '자녀·후배를 통해 기쁜 소식')
      .replace(/자녀에게 기쁜 소식이 있을 수 있습니다/g, '자녀의 학업·진로에 좋은 소식이 있을 수 있습니다')
      .replace(/자녀와 관련된 고민/g, '자녀 교육·양육과 관련된 고민');
  } else {
    // 자녀가 없는 사람: "자녀" → "미래·후배·프로젝트" 중심
    return text
      .replace(/자녀·손주와 함께하는 시간/g, '후배·제자와 함께하는 시간')
      .replace(/자녀·손자녀와의 유대/g, '후배·제자와의 유대')
      .replace(/자녀에게 기쁜 소식/g, '후배·프로젝트에서 기쁜 소식')
      .replace(/자녀와 관련된 고민/g, '미래 계획과 관련된 고민')
      .replace(/자녀·후배를 통해/g, '후배·프로젝트를 통해')
      .replace(/손자녀와의 시간을 즐기세요/g, '후배·지인과의 시간을 즐기세요')
      .replace(/자녀·노후·결과물/g, '미래·노후·결과물');
  }
}
