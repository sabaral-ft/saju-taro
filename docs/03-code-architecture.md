# 코드 아키텍처 가이드

## 핵심 엔진 파일

### saju-engine.ts — 만세력 엔진
- 생년월일시 → 사주 4기둥(연월일시) 계산
- 천간/지지 매핑, 오행 분포 산출
- `SajuResult` 인터페이스 반환
- 절기 기반 월주 계산 (IPCHUN_PRECISE 정밀 시각)
- KST +30분 보정, 야자시/조자시 토글

### daeun.ts — 대운/세운 + 교차분석 엔진
- `calculateDaeun()` — 대운 산출 (순행/역행, 대운수)
- `generateDaeunDescription(saju?)` — 대운별 해석 (건강 교차분석 포함)
- `generateSeunCareer/Health/Money/Love()` — 세운별 4영역 해석
- `analyzeJohu()` — 조후(한난조습) + 신강/신약 + 체질별 식이/운동
- `analyzeHealthForecast()` — 건강 호전/악화 시기 예측
- `OHAENG_EXTREME_HEALTH` — 부족한 오행별 건강 위험
- `OHAENG_EXCESS_HEALTH` — 과다한 오행별 건강 위험
- `HEALTH_ACTIVITY_ADJUST` — 건강 기반 활동 조정

### hapchung.ts — 합충회합 분석
- `HapChungAnalysis` — items: HapChungItem[] 구조
- type: '지지충' | '천간합' | '삼합' | '육합' 등
- `JIJI_ORGAN` 매핑 — 충 → 장기 건강 영향

### sinsal.ts — 신살 분석
- 도화살, 역마살, 양인살, 화개살, 괴강살 등
- 건강 교차분석 (도화살+공황, 역마살+이동불가 등)

### twelve-stages.ts — 12운성
- 장생~양 12단계 에너지 해석
- 나이별 보정 (60세+ 건강 비중 높임, 70세+ 성장 표현 금지)

### saryeong-advanced.ts — 사령(지장간) 심화 분석
- 월지 지장간 사령 도출
- 길신/흉신 판정 + 심리 분석
- 투출/미투출 분석

### saju-taro-matcher.ts — 사주↔타로 매칭 엔진
- 오행↔수트 매핑 (목→Wands, 화→Wands, 토→Pentacles, 금→Swords, 수→Cups)
- 오행 과다/부족 → 타로 카드 가중치
- 역방향 심층 해석 (4단계+WIND+5D+Greer)
- 질문 분야별 수트 해석 변주

### saju-interactions.ts — 사주 상호작용
- 오행 상생/상극 양면성 분석
- 밸런스 기반 맥락 해석 (같은 극도 상황에 따라 다르게)

## 주요 데이터 흐름

```
사용자 입력 (생년월일시)
    ↓
saju-engine.ts → SajuResult
    ↓
┌──────────────────────────┐
│ daeun.ts (대운/세운)       │
│ hapchung.ts (합충)        │
│ sinsal.ts (신살)          │
│ twelve-stages.ts (12운성)  │
│ saryeong-advanced.ts (사령)│
└──────────────────────────┘
    ↓ 교차분석
reading/page.tsx → 통합 해석 출력
    ↓ 타로 연계
saju-taro-matcher.ts → 카드 가중치 + 해석 톤
```

## 교차분석 체크리스트
새 해석 영역 추가 시 반드시:
1. weakestOhaeng 건강 교차 반영
2. dominantOhaeng 과다 경고 반영
3. 조후(한난조습) 체질 반영
4. 신강/신약 판정 반영
5. 나이별 보정 적용
6. 앞뒤 모순 검증
7. 합충 결과 건강 교차
8. 대운×세운 복합효과
9. 타로 카드 가중치 연동
