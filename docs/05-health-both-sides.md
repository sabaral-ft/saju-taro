---
name: 오행 건강 양면 분석
description: "부족해도 병, 지나쳐도 병" — 오행 과다도 부족만큼 건강 위험, 양면 분석 필수
type: feedback
---

오행 건강 분석은 부족(결핍)뿐 아니라 과다(지나침)도 반드시 분석해야 함.

**Why:** 기존 코드가 weakestOhaeng만 건강 경고하고 dominantOhaeng의 건강 위험은 완전 무시. 유저가 오행별 과다 증상(목과다→알레르기/편두통, 화과다→고혈압/불면증, 토과다→소화불량/어깨결림, 금과다→비염/피부건조, 수과다→부종/우울증)을 상세히 제공.

**How to apply:**
- 대운/세운 건강 해석에서 weakOh + dominantOh 양쪽 경고
- analyzeHealthForecast의 병의 원인에 과다 원인도 포함
- OHAENG_EXCESS_HEALTH, OHAENG_EXCESS_CAUSE 상수 활용
- 과다 기준: ohaengBalance >= 4
