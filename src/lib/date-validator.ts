// src/lib/date-validator.ts
// 날짜 검증 유틸리티 - 모든 페이지에서 공통 사용

/**
 * 주어진 연, 월에 대한 최대 일수를 반환합니다.
 * 윤년도 정확히 계산합니다.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 윤년 여부를 판단합니다.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export interface DateValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 생년월일 유효성을 검사합니다.
 * - 연도: 올해 기준 100세 이내 ~ 올해 (예: 2026년이면 1927~2026)
 * - 월: 1~12
 * - 일: 해당 월의 실제 일수 범위
 * - 2월 29일 윤년 체크 포함
 */
export function validateBirthDate(
  year: number | string,
  month: number | string,
  day: number | string
): DateValidationResult {
  const y = typeof year === 'string' ? parseInt(year) : year;
  const m = typeof month === 'string' ? parseInt(month) : month;
  const d = typeof day === 'string' ? parseInt(day) : day;

  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return { valid: false, error: '생년월일을 모두 입력해주세요.' };
  }

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 99; // 100세 제한 (예: 2026→1927)
  if (y < minYear || y > currentYear) {
    return { valid: false, error: `연도는 ${minYear}~${currentYear}년 사이로 입력해주세요. (100세 이하)` };
  }

  if (m < 1 || m > 12) {
    return { valid: false, error: '월은 1~12 사이로 입력해주세요.' };
  }

  const maxDays = getDaysInMonth(y, m);
  if (d < 1 || d > maxDays) {
    return { valid: false, error: `${m}월은 ${maxDays}일까지만 입력 가능합니다.` };
  }

  return { valid: true };
}

/**
 * 안전하게 localStorage에 접근하는 헬퍼 함수들
 */
export function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`localStorage.getItem('${key}') 실패:`, e);
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`localStorage.setItem('${key}') 실패:`, e);
    // 용량 초과 등의 에러 시 조용히 실패
    return false;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`localStorage.removeItem('${key}') 실패:`, e);
    return false;
  }
}
