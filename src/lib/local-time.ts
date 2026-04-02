// src/lib/local-time.ts

export interface CityLongitudes {
  name: string;
  longitude: number;
}

export const KOREAN_CITIES: CityLongitudes[] = [
  { name: '모름/기본', longitude: 135.0 }, // 보정 없음(KST 기준)
  // 수도권
  { name: '서울', longitude: 126.97 },
  { name: '인천', longitude: 126.70 },
  { name: '수원', longitude: 127.02 },
  { name: '성남', longitude: 127.14 },
  { name: '용인', longitude: 127.18 },
  { name: '고양', longitude: 126.83 },
  { name: '안양', longitude: 126.95 },
  // 강원
  { name: '춘천', longitude: 127.73 },
  { name: '강릉', longitude: 128.87 },
  { name: '원주', longitude: 127.95 },
  { name: '속초', longitude: 128.59 },
  // 충청
  { name: '대전', longitude: 127.38 },
  { name: '청주', longitude: 127.48 },
  { name: '천안', longitude: 127.15 },
  { name: '세종', longitude: 127.00 },
  { name: '충주', longitude: 127.93 },
  // 전라
  { name: '광주', longitude: 126.85 },
  { name: '전주', longitude: 127.14 },
  { name: '목포', longitude: 126.39 },
  { name: '여수', longitude: 127.66 },
  { name: '순천', longitude: 127.49 },
  // 경북
  { name: '대구', longitude: 128.60 },
  { name: '포항', longitude: 129.37 },
  { name: '경주', longitude: 129.21 },
  { name: '안동', longitude: 128.73 },
  { name: '구미', longitude: 128.34 },
  // 경남
  { name: '부산', longitude: 129.07 },
  { name: '울산', longitude: 129.31 },
  { name: '창원', longitude: 128.68 },
  { name: '김해', longitude: 128.88 },
  { name: '진주', longitude: 128.08 },
  { name: '거제', longitude: 128.62 },
  { name: '합천', longitude: 128.17 },
  { name: '통영', longitude: 128.43 },
  { name: '밀양', longitude: 128.75 },
  { name: '사천', longitude: 128.06 },
  // 제주
  { name: '제주', longitude: 126.53 },
  { name: '서귀포', longitude: 126.56 },
];

/**
 * 표준시(KST: 135도 기준)를 출생 지역의 경도를 반영하여 실제 태양시(참태양시) 변동분(분)으로 반환합니다.
 * 1도 차이당 4분 변동.
 * 예: 135도(표준시) - 127도(서울) = 8도 차이 * 4분 = -32분
 */
export function getLocalTimeOffsetMinutes(longitude: number): number {
  const KST_LONGITUDE = 135.0;
  const diff = longitude - KST_LONGITUDE;
  return Math.round(diff * 4); // 분 단위 보정값
}

/**
 * 출생 시간에 경도 보정값을 적용하여 최종 태양시를 계산합니다.
 */
export function applyLocalTimeCorrection(
  hour: number,
  minute: number,
  cityName: string
): { correctedHour: number; correctedMinute: number; offsetMinutes: number } {
  const city = KOREAN_CITIES.find(c => c.name === cityName);
  if (!city || city.name === '모름/기본') return { correctedHour: hour, correctedMinute: minute, offsetMinutes: 0 };

  const offsetMinutes = getLocalTimeOffsetMinutes(city.longitude);
  
  let totalMinutes = hour * 60 + minute + offsetMinutes;
  
  if (totalMinutes < 0) totalMinutes += 24 * 60; // 전날
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60; // 다음날

  const correctedHour = Math.floor(totalMinutes / 60);
  const correctedMinute = totalMinutes % 60;

  return { correctedHour, correctedMinute, offsetMinutes };
}
