
// @ts-nocheck
import type { SajuResult, Ohaeng } from '@/lib/saju-engine';
import { CHEONGAN_OHAENG, JIJI_OHAENG } from '@/lib/saju-engine';
import type { DaeunResult, SeunResult } from '@/lib/daeun';
import type { HapChungAnalysis } from '@/lib/hapchung';
import { TWELVE_STAGE_DATA } from '@/lib/twelve-stages';

export function generateSajuAnswer(
  question: string,
  sajuResult: SajuResult,
  daeunResult: DaeunResult,
  lifePredictions: any,
  fiveYearSeun: SeunResult[],
  sinsalList: any[],
  hapChungResult: HapChungAnalysis | null
): string {
    const q = question.trim().toLowerCase();
    const ilOh = sajuResult.day.cheonganOhaeng;
    const OHAENG_KR: Record<string, string> = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };

    let answer = '';

    const currentDaeun = daeunResult.currentDaeun;
    const currentStage = currentDaeun ? currentDaeun.twelveStage : '';
    const currentStageEnergy = currentDaeun && currentStage ? TWELVE_STAGE_DATA[currentStage as keyof typeof TWELVE_STAGE_DATA].energy : 5;
    const thisYearSeun = fiveYearSeun.find(s => s.year === new Date().getFullYear());
    const currentAge = daeunResult.currentAge;
    // 인생 단계 판별 (나이 기반 상황 판단)
    const lifeStage = currentAge < 20 ? 'youth' : currentAge < 30 ? 'twenties' : currentAge < 40 ? 'thirties' : currentAge < 50 ? 'forties' : currentAge < 60 ? 'fifties' : 'senior';

    // 직업 관련
    if (/직업|직장|이직|취업|직종|일을|일할|사업|창업|퇴사|쉬고|쉬는|무직|백수|구직|실업|놀고|일자리/.test(q)) {
      // 쉬고 있는/구직 중인 상황 인식
      const isResting = /쉬고|쉬는|무직|백수|구직|실업|놀고|일자리|일을\s*할\s*수/.test(q);

      if (currentAge <= 12) {
        // 초딩용 헤더 — 한자어 없이 쉽게
        answer = `═══ 🔮 넌 커서 뭐가 될까? ═══\n\n`;
        answer += `📋 나이: ${currentAge}살\n`;
        answer += `📋 너의 기운: ${OHAENG_KR[ilOh]} 기운 — ${sajuResult.iljuDesc.split('.')[0]}.\n`;
        answer += `📋 잘 맞는 기운: ${OHAENG_KR[sajuResult.yongsin]} | 조심할 기운: ${OHAENG_KR[sajuResult.gisin]}\n\n`;
      } else {
        answer = isResting ? `═══ 취업/재취업 가능성 분석 ═══\n\n` : `═══ 사주 직업 분석 ═══\n\n`;
        answer += `📋 현재 나이: ${currentAge}세 | 대운: ${currentDaeun ? `${currentDaeun.cheongan}${currentDaeun.jiji}(${currentStage}운, 에너지 ${currentStageEnergy}/10)` : '분석중'}\n`;
        answer += `📋 당신의 사주: ${sajuResult.ilgan}일간 (${OHAENG_KR[ilOh]} 기운) — ${sajuResult.iljuDesc.split('.')[0]}.\n`;
        answer += `📋 일주: ${sajuResult.day.cheongan}${sajuResult.day.jiji} | 월주: ${sajuResult.month.cheongan}${sajuResult.month.jiji} | 시주: ${sajuResult.hour.cheongan}${sajuResult.hour.jiji} (${sajuResult.hourInfo.name})\n`;
        answer += `📋 용신: ${OHAENG_KR[sajuResult.yongsin]} | 기신: ${OHAENG_KR[sajuResult.gisin]} | 월주 십성: ${sajuResult.sipseongs.month} | 시주 십성: ${sajuResult.sipseongs.hour}\n`;
        answer += `📋 넘치는 기운: ${sajuResult.dominantOhaeng}(${OHAENG_KR[sajuResult.dominantOhaeng]}) | 부족한 기운: ${sajuResult.weakestOhaeng}(${OHAENG_KR[sajuResult.weakestOhaeng]})\n\n`;
      }

      if (isResting) {
        // 취업 가능성 판단
        answer += `【취업 가능성 판단】\n`;
        if (currentStageEnergy >= 7) {
          answer += `✅ 취업 가능성: 높은 편! 현재 대운 에너지가 ${currentStageEnergy}/10으로 강한 시기예요. 적극적으로 구직활동을 하면 좋은 결과가 있을 수 있습니다.\n\n`;
        } else if (currentStageEnergy >= 5) {
          answer += `⚡ 취업 가능성: 보통. 현재 대운 에너지가 ${currentStageEnergy}/10이에요. 준비를 철저히 하면 좋은 기회가 올 수 있습니다. 자격증이나 포트폴리오를 보강한 후 도전해보세요.\n\n`;
        } else {
          answer += `⚠️ 취업 가능성: 당장은 쉽지 않을 수 있어요. 현재 대운 에너지가 ${currentStageEnergy}/10으로 낮은 시기예요. 하지만 이 시기를 실력을 쌓는 기간으로 활용하면 나중에 더 좋은 기회가 올 수 있습니다.\n\n`;
        }

        // 취업 시기 전망
        answer += `【취업 시기 전망】\n`;
        if (currentStageEnergy >= 6) {
          answer += `현재 대운(${currentDaeun ? currentDaeun.cheongan + currentDaeun.jiji : ''}, ${currentStage}운)이 나쁘지 않아 올해 안에 취업 기회가 올 수 있습니다.\n`;
        } else {
          // 다음 좋은 대운 찾기
          const nextGoodPillar = daeunResult?.pillars.find(p => {
            const e = TWELVE_STAGE_DATA[p.twelveStage as keyof typeof TWELVE_STAGE_DATA]?.energy || 5;
            return e >= 7 && p.startAge > (currentDaeun?.startAge || 0);
          });
          if (nextGoodPillar) {
            answer += `현재 대운이 약하지만, ${nextGoodPillar.startAge}세부터 시작되는 ${nextGoodPillar.cheongan}${nextGoodPillar.jiji}(${nextGoodPillar.twelveStage}운) 대운에서 큰 기회가 올 수 있어요. 그때를 목표로 준비해보세요.\n`;
          } else {
            answer += `대운 흐름이 점진적으로 회복될 수 있어요. 꾸준한 준비가 결실을 맺을 가능성이 있습니다.\n`;
          }
        }
        if (thisYearSeun) {
          answer += `${new Date().getFullYear()}년 세운: ${thisYearSeun.cheongan}${thisYearSeun.jiji} — ${thisYearSeun.description}\n`;
        }
        answer += '\n';

        // 어떤 일이 맞는지
        answer += `【당신에게 맞는 일】\n`;
      }

      // ★ 이 사주의 확실한 특징 강조
      const ilganName = sajuResult.ilgan;
      const monthSipMain = sajuResult.sipseongs.month;
      const hourSipMain = sajuResult.sipseongs.hour;
      const dominantOh = sajuResult.dominantOhaeng;
      const weakOh = sajuResult.weakestOhaeng;
      answer += `【✅ 이 사주의 확실한 특징】\n`;
      answer += `• 일간 ${ilganName}(${OHAENG_KR[ilOh]}) — ${sajuResult.iljuDesc.split('.')[0]}. 이것이 당신의 본질적인 성격입니다.\n`;
      answer += `• 월주 ${monthSipMain} — 사회적 활동 스타일을 결정짓는 핵심입니다. ${monthSipMain === '식신' ? '전문 기술직에서 빛나는 타입' : monthSipMain === '상관' ? '틀을 깨는 혁신가 기질' : monthSipMain === '편재' ? '타고난 장사 감각의 소유자' : monthSipMain === '정재' ? '꾸준한 안정 수입이 맞는 타입' : monthSipMain === '편관' ? '조직의 실세형 리더' : monthSipMain === '정관' ? '명예와 출세를 추구하는 관리자' : monthSipMain === '편인' ? '비주류 분야에서 두각을 나타내는 전문가' : monthSipMain === '정인' ? '학문과 자격증이 무기인 지식인' : monthSipMain === '비견' ? '독립 사업이 맞는 자주적 성향' : '승부욕 강한 경쟁형 도전가'}입니다.\n`;
      answer += `• ${OHAENG_KR[dominantOh]} 기운이 넘치고 ${OHAENG_KR[weakOh]} 기운이 부족합니다. → ${OHAENG_KR[weakOh]} 관련 활동을 의식적으로 보충하면 균형이 잡힙니다.\n\n`;

      answer += `【직업 적성 분석】\n${lifePredictions.career.summary}\n\n`;
      answer += `【TOP 3 적합 직종】\n`;
      lifePredictions.career.recommendations.forEach((r: any, i: number) => {
        answer += `${i + 1}. ${r.category} (적합도 ${r.fitScore}/10)\n`;
        answer += `   추천 직업: ${r.jobs.join(', ')}\n`;
        answer += `   이유: ${r.reason}\n\n`;
      });
      answer += `【용신 보너스】\n${lifePredictions.career.yongsinBoost}\n\n`;
      answer += `【주의할 직종】\n${lifePredictions.career.warningJobs}\n\n`;

      // ★ 건강↔직업 교차 분석: 오행 불균형이 직업 선택에 미치는 영향
      const weakBalance = sajuResult.ohaengBalance[weakOh as Ohaeng];
      if (weakBalance <= 1) {
        answer += `【⚠️ 건강 상태를 고려한 직업 조언】\n`;
        const HEALTH_CAREER_CROSS: Record<string, string> = {
          '목': `당신의 목(木) 기운이 ${weakBalance}점으로 극도로 부족합니다. `
            + `간 기능이 약해 만성 피로와 무기력에 빠지기 쉬운 체질입니다. `
            + `야근이 잦은 직장, 음주 문화가 강한 업계는 건강을 악화시킬 수 있습니다. `
            + `규칙적인 생활이 가능한 9-to-6 직장이나, 자율 출퇴근이 가능한 직업이 유리합니다. `
            + `용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 보충하면서 스트레스를 줄이는 것이 직업 성공의 전제 조건입니다.`,
          '화': `당신의 화(火) 기운이 ${weakBalance}점으로 극도로 부족합니다. `
            + `심장·혈관이 약하고, 공황장애·불안장애·심장 두근거림이 올 수 있는 체질입니다. `
            + `고강도 스트레스 환경, 장거리 출장, 밀폐된 공간에서의 근무, 교대 근무는 불안 증상을 악화시킬 수 있으니 피하세요. `
            + `재택근무, 프리랜서, 자율 출퇴근 등 자기 페이스를 조절할 수 있는 환경이 최적입니다. `
            + `따뜻하고 안정적인 환경에서 일할 때 성과도 건강도 좋아집니다. `
            + `IT, 작가, 디자인, 상담, 교육 등 자기 공간에서 집중할 수 있는 직업이 특히 잘 맞습니다.`,
          '토': `당신의 토(土) 기운이 ${weakBalance}점으로 극도로 부족합니다. `
            + `위장 기능이 매우 약해 불규칙한 식사가 곧 건강 악화로 이어지는 체질입니다. `
            + `식사 시간을 지킬 수 없는 영업직, 교대근무, 외식업은 위장을 더 망가뜨릴 수 있습니다. `
            + `규칙적인 식사가 가능한 사무직, 연구직, 교육직이 건강과 커리어 모두에 유리합니다.`,
          '금': `당신의 금(金) 기운이 ${weakBalance}점으로 극도로 부족합니다. `
            + `호흡기·면역력이 매우 약해 먼지, 화학물질, 건조한 환경에서 쉽게 아플 수 있는 체질입니다. `
            + `공장, 건설현장, 야외근무가 많은 직업은 건강에 직접적인 위험이 됩니다. `
            + `실내 환경이 쾌적한 사무실, 도서관, 연구소 등에서 일하는 것이 최적입니다.`,
          '수': `당신의 수(水) 기운이 ${weakBalance}점으로 극도로 부족합니다. `
            + `신장·허리가 매우 약해 장시간 앉아있거나 무거운 것을 드는 일에 취약한 체질입니다. `
            + `운전직, 물류 노동, 장시간 데스크워크는 허리 디스크를 악화시킬 수 있습니다. `
            + `서서 움직이며 일하되 과도한 육체 노동은 피하는 직업이 좋습니다. 교사, 상담사, 가벼운 서비스업이 맞습니다.`,
        };
        answer += HEALTH_CAREER_CROSS[weakOh] + '\n\n';
      } else if (weakBalance <= 2) {
        // 약간 부족한 경우 간단한 주의
        const MILD_HEALTH_CAREER: Record<string, string> = {
          '목': `목(木) 기운이 다소 부족하여 피로 누적에 주의하세요. 야근이 과도한 직장은 체력적으로 버거울 수 있습니다.`,
          '화': `화(火) 기운이 다소 부족하여 스트레스 관리가 중요합니다. 너무 긴장도가 높은 직업은 심혈관에 부담이 될 수 있습니다.`,
          '토': `토(土) 기운이 다소 부족하여 규칙적인 식사가 중요합니다. 식사 시간이 불규칙한 직종은 위장 건강에 불리합니다.`,
          '금': `금(金) 기운이 다소 부족하여 호흡기가 약합니다. 먼지나 화학물질에 노출되는 환경은 피하는 것이 좋습니다.`,
          '수': `수(水) 기운이 다소 부족하여 허리 관리가 중요합니다. 장시간 앉아있는 직업이라면 스트레칭 습관이 필수입니다.`,
        };
        answer += `【건강 참고사항】\n${MILD_HEALTH_CAREER[weakOh]}\n\n`;
      }

      // ★ 구체적 행동 가이드 (나이대별)
      answer += `【💡 구체적으로 이렇게 하면 좋습니다】\n`;
      const topRec = lifePredictions.career.recommendations[0];
      if (currentAge < 25) {
        answer += `• 지금은 다양한 경험을 쌓을 시기입니다. ${topRec ? topRec.category + ' 분야 인턴십이나 아르바이트를 경험해보세요.' : '관심 분야에서 실전 경험을 쌓으세요.'}\n`;
        answer += `• 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 살리는 전공·자격증을 미리 준비하면 취업 시 남들보다 유리합니다.\n`;
      } else if (currentAge < 35) {
        answer += `• 커리어 방향을 확립할 시기입니다. ${topRec ? `${topRec.category} 분야에서 전문성을 쌓는 데 집중하세요.` : '한 분야에 깊이를 더하세요.'}\n`;
        answer += `• 월주 ${monthSipMain}의 기운을 살려 ${monthSipMain === '식신' || monthSipMain === '정인' ? '자격증·학위를 취득하면 경력에 큰 도움이 됩니다.' : monthSipMain === '편재' || monthSipMain === '정재' ? '재무 관리 능력을 키우면 30대 후반부터 경제적 안정이 옵니다.' : '대인관계 네트워크를 넓히면 40대에 큰 기회로 돌아옵니다.'}\n`;
      } else if (currentAge < 50) {
        answer += `• 전문성을 깊게 파고들 시기입니다. ${topRec ? `${topRec.category} 분야에서 리더십을 발휘하면 좋은 결과가 옵니다.` : '경험을 살려 관리자 역할로 전환을 고려하세요.'}\n`;
        answer += `• 기신(${OHAENG_KR[sajuResult.gisin]}) 기운이 강해지면 업무 스트레스가 심해질 수 있습니다. 용신(${OHAENG_KR[sajuResult.yongsin]}) 활동으로 밸런스를 유지하세요.\n`;
      } else if (currentAge < 60) {
        answer += `• 그동안 쌓은 경험이 가장 큰 자산입니다. ${topRec ? `${topRec.category} 분야 경험을 살려 컨설팅·자문 역할을 고려해보세요.` : '후배 양성이나 멘토링을 통해 영향력을 키우세요.'}\n`;
        answer += `• 무리한 이직보다 현재 위치에서 부가가치를 높이거나, 은퇴 후를 대비한 사이드 프로젝트를 준비하세요.\n`;
      } else {
        answer += `• 인생 경험과 지혜가 최고의 경쟁력입니다. 강의, 저술, 멘토링, 상담 등으로 제2의 전성기를 만들 수 있습니다.\n`;
        answer += `• 체력 관리가 핵심! 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 보충하는 가벼운 운동과 취미를 꾸준히 유지하세요.\n`;
      }
      answer += '\n';

      if (isResting) {
        // 쉬는 사람에게 맞는 조언
        answer += `【지금 해야 할 것】\n`;
        const monthSip = sajuResult.sipseongs.month;
        if (['식신', '정인', '편인'].includes(monthSip)) {
          answer += `사주에 ${monthSip}이 있어 배우는 능력이 뛰어난 편일 수 있어요. 쉬는 기간을 자기 투자 기간으로 삼으면 좋을 수 있습니다. 자격증, 온라인 강의, 실무 경험을 쌓으면 경쟁력이 올라갈 수 있어요.\n\n`;
        } else if (['편재', '정재'].includes(monthSip)) {
          answer += `사주에 ${monthSip}이 있어 재물 감각이 있는 편일 수 있어요. 취업만 고집하지 말고 부업, 프리랜서, 소규모 사업도 고려해보면 좋을 수 있습니다.\n\n`;
        } else {
          answer += `쉬는 시간을 활용해서 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 보강하는 활동(운동, 공부, 인맥 관리)을 해보세요. 준비된 사람에게 기회가 올 가능성이 높아요.\n\n`;
        }
      }

      // 현재 대운 기반 시기 분석 (이직 상황일 때만)
      if (!isResting && currentDaeun) {
        answer += `【현재 직업운 (대운 ${currentDaeun.cheongan}${currentDaeun.jiji}, ${currentStage}운)】\n`;
        if (['장생', '관대', '건록', '제왕'].includes(currentStage)) {
          answer += `지금은 에너지가 ${currentStageEnergy}/10으로 높은 시기입니다! 적극적으로 도전하고 변화를 추구해도 좋습니다. 이직, 창업, 승진 기회를 잡으세요.\n`;
        } else if (['쇠', '병', '사'].includes(currentStage)) {
          answer += `현재 에너지가 ${currentStageEnergy}/10으로 하락 추세입니다. 큰 변화보다 현재 위치에서 실력을 갈고닦는 것이 현명합니다. 이직은 1~2년 후를 목표로 준비하세요.\n`;
        } else if (['목욕', '양'].includes(currentStage)) {
          answer += `현재 에너지가 ${currentStageEnergy}/10으로 변동이 큰 시기입니다. 충동적 결정보다 충분히 알아보고 신중하게 움직이세요.\n`;
        } else {
          answer += `현재 에너지가 ${currentStageEnergy}/10입니다. 무리한 변화보다 자격증 취득, 스킬업 등 내실을 다지세요.\n`;
        }
      }

      // 이직운 분석 (쉬는 사람에게는 표시 안 함)
      const monthSipForJob = sajuResult.sipseongs.month;
      const hourSipForJob = sajuResult.sipseongs.hour;
      if (isResting) {
        // 쉬는 사람에게는 이직운 대신 취업 전략 마무리
        answer += `\n【핵심 조언】\n`;
        answer += `지금 쉬고 있다고 조급해하지 마세요. 사주 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 활용한 분야로 방향을 잡고, `;
        if (currentStageEnergy >= 6) {
          answer += `대운 에너지가 ${currentStageEnergy}/10이니 적극적으로 지원하면 좋은 결과가 있을 것입니다. 행동이 운을 만듭니다!\n`;
        } else {
          answer += `지금은 준비의 시간입니다. 자격증이나 스킬을 쌓고, 대운이 올라갈 때 승부를 걸면 훨씬 좋은 결과를 얻습니다.\n`;
        }
      }
      if (!isResting) {
        answer += `\n【이직운 분석】\n`;
        if (['편관', '상관', '겁재'].includes(monthSipForJob) || ['편관', '상관'].includes(hourSipForJob)) {
          answer += `사주 구조상 한 직장에 오래 머물기보다 변화를 추구하는 성향이 강합니다. `;
          if (currentStageEnergy >= 7) {
            answer += `현재 대운 에너지가 높아 이직 성공률이 높습니다. 적극적으로 이력서를 돌리세요!\n`;
          } else if (currentStageEnergy >= 4) {
            answer += `이직은 가능하지만 충분히 준비한 후 움직이세요. 최소 3개월은 다음 직장을 알아보면서 진행하세요.\n`;
          } else {
            answer += `지금은 이직보다 현재 자리에서 버티면서 실력을 쌓는 것이 유리합니다. 1~2년 후가 이직 적기입니다.\n`;
          }
        } else if (['정관', '정인', '정재'].includes(monthSipForJob)) {
          answer += `안정적인 직장 생활에 적합한 사주입니다. 이직보다 현 직장에서 꾸준히 승진하는 것이 유리합니다. `;
          answer += `다만 직장 내 정치에 휘말리지 말고, 실력으로 인정받는 데 집중하세요.\n`;
        } else {
          answer += `이직 성향은 보통입니다. 현재 환경이 맞지 않다면 이직을 고려할 수 있지만, 충동적으로 그만두지 마세요.\n`;
        }

        // 직장 인정/승진운
        answer += `\n【직장 인정/승진운】\n`;
        if (['정관', '편관'].includes(monthSipForJob)) {
          answer += `관성(정관/편관)이 월주에 있어 조직에서 인정받기 쉬운 사주입니다. 특히 ${['장생', '관대', '건록', '제왕'].includes(currentStage) ? '현재 대운이 좋아 승진 가능성이 높습니다!' : '꾸준히 성과를 내면 인정받는 시기가 반드시 옵니다.'}\n`;
        } else if (['식신', '정재'].includes(monthSipForJob)) {
          answer += `실무 능력으로 인정받는 타입입니다. 화려한 성과보다 묵묵히 쌓아온 결과물이 평가받습니다. 결과물 위주로 어필하세요.\n`;
        } else {
          answer += `조직 적응보다 개인 역량이 빛나는 사주입니다. 프리랜서나 전문직이 더 맞을 수 있습니다.\n`;
        }
      }

      // 사업운 분석
      answer += `\n【사업운 분석】\n`;
      if (['편재', '겁재', '식신'].includes(monthSipForJob) || ['편재', '식신'].includes(hourSipForJob)) {
        answer += `사업적 수완이 있는 사주입니다! `;
        if (monthSipForJob === '편재') answer += `편재가 강해 돈의 흐름을 읽는 감각이 뛰어납니다. 투자, 무역, 유통 등에서 두각을 나타낼 수 있습니다.\n`;
        else if (monthSipForJob === '식신') answer += `식신이 강해 아이디어와 기획력이 뛰어납니다. 콘텐츠, 교육, 요식업에서 성공 가능성이 높습니다.\n`;
        else answer += `도전정신이 강해 창업에 적합하지만, 동업보다 독자 경영이 유리합니다. 자금 관리에 특히 신경 쓰세요.\n`;
        if (currentStageEnergy >= 7) {
          answer += `현재 대운 에너지가 높아 사업 시작이나 확장에 좋은 시기입니다.\n`;
        } else {
          answer += `현재는 사업 준비 단계로 삼고, 시장 조사와 자금 확보에 집중하세요.\n`;
        }
      } else if (['정관', '정인'].includes(monthSipForJob)) {
        answer += `안정을 추구하는 사주로, 사업보다 전문직이나 조직 생활이 더 맞습니다. 사업을 한다면 프랜차이즈처럼 검증된 모델을 선택하세요.\n`;
      } else {
        answer += `사업 성향은 보통입니다. 사업을 한다면 본업을 유지하면서 부업으로 시작하는 것이 안전합니다.\n`;
      }

      // 나이별 맞춤 조언
      answer += `\n【${currentAge}세, 지금 시점의 직업 조언】\n`;
      if (lifeStage === 'youth') {
        answer += `아직 어린 나이이므로 다양한 경험과 학습이 우선입니다. 적성을 탐색하는 시기로 삼으세요. ${currentStageEnergy >= 7 ? '대운이 좋아 학업이나 기술 습득에 집중하면 큰 효과를 볼 수 있습니다.' : '지금은 기초를 다지는 시기입니다.'}\n`;
      } else if (lifeStage === 'twenties') {
        answer += `사회 진출의 시기입니다. ${currentStageEnergy >= 7 ? '대운 에너지가 높아 적극적으로 도전하세요! 이직이나 새로운 분야 진출에 유리합니다.' : currentStageEnergy <= 4 ? '대운 에너지가 낮아 실력을 쌓는 데 집중하세요. 30대에 빛을 발할 것입니다.' : '경험을 쌓으며 자신만의 전문성을 만드세요.'}\n`;
      } else if (lifeStage === 'thirties') {
        answer += `커리어의 전환점입니다. ${currentStageEnergy >= 7 ? '지금이 승진·이직·창업 최적의 타이밍입니다!' : currentStageEnergy <= 4 ? '지금은 현 위치에서 내실을 다지세요. 무리한 변화는 위험합니다.' : '안정적 성장을 추구하되, 전문성을 더 깊이 파세요.'}\n`;
      } else if (lifeStage === 'forties') {
        answer += `경력의 정점에 도달하는 시기입니다. ${currentStageEnergy >= 7 ? '리더십을 발휘할 수 있는 좋은 시기! 경영·관리직으로의 이동이 유리합니다.' : '후반전을 위한 전략이 필요합니다. 은퇴 후를 대비한 제2의 커리어를 준비해보세요.'}\n`;
      } else if (lifeStage === 'fifties') {
        answer += `그간의 경험과 인맥이 빛을 발하는 시기입니다. ${currentStageEnergy >= 7 ? '경험을 바탕으로 컨설팅, 멘토링, 강의 등에서 큰 성과를 거둘 수 있습니다.' : '체력 관리와 함께 세컨드 커리어를 차분히 준비하세요.'}\n`;
      } else {
        answer += `인생의 지혜가 가장 빛나는 시기입니다. ${currentStageEnergy >= 6 ? '사회적 경험을 살려 후배 양성이나 봉사 활동이 보람과 건강 모두에 좋습니다.' : '무리하지 않는 범위에서 즐겁게 할 수 있는 일을 찾으세요.'}\n`;
      }

      // 시주 십성 기반 직업 보충 — 같은 날 다른 시간 태어난 사람과 차별화
      answer += `\n【시주(${sajuResult.hour.cheongan}${sajuResult.hour.jiji})로 본 직업 잠재력】\n`;
      const HOUR_JOB_INSIGHT: Record<string, string> = {
        '비견': '독립심이 강한 편이라 1인 기업이나 프리랜서로 성공할 잠재력이 있을 수 있어요. 남에게 지시받기보다 자기 방식대로 일하는 게 맞는 타입일 가능성이 높습니다.',
        '겁재': '도전적이고 과감한 결단력이 숨어 있을 수 있어, 변화가 많은 업종(영업, 트레이딩, 벤처)에 적합한 편일 수 있습니다. 다만 동업이나 파트너십에서는 신중할 필요가 있어요.',
        '식신': '창의력과 표현력이 내면에 있을 수 있어, 문화·예술·콘텐츠·요식업 분야에서 빛을 발할 가능성이 있습니다. 나이 들수록 이 재능이 꽃을 피울 수 있어요.',
        '상관': '기존의 틀을 깨는 혁신가 기질이 있을 수 있습니다. 기술 개발, 발명, 전문 분야에서 독보적 실력을 쌓으면 업계에서 인정받을 가능성이 높아요.',
        '편재': '사업 수완과 투자 감각이 내면에 있을 수 있습니다. 부동산, 무역, 유통, 금융 분야에서 큰 수익을 올릴 가능성이 있어요. 중년 이후 재물운이 상승하는 편일 수 있습니다.',
        '정재': '안정적이고 계획적인 직업관이 있을 수 있어, 공무원, 금융, 회계, 관리직에서 꾸준히 성과를 낼 가능성이 높습니다. 체계적인 조직이 잘 맞는 타입일 수 있어요.',
        '편관': '조직 관리 능력과 통솔력이 있을 수 있어, 관리직·임원·경영자로 성장할 가능성이 있습니다. 다만 스트레스 관리에 신경 쓰는 게 좋아요.',
        '정관': '사회적 명예와 규율을 중시하는 직업관이 있을 수 있어, 공직·법조·교육·대기업에서 안정적으로 커리어를 쌓을 가능성이 높습니다.',
        '편인': '비주류적 관심사에서 전문성을 쌓는 타입일 수 있어요. IT, 연구, 특수 기술, 대체의학, 종교·철학 분야에서 두각을 나타낼 가능성이 있습니다.',
        '정인': '배움을 전달하는 데 재능이 있을 수 있어, 교육·연구·출판·학술 분야에서 꾸준히 성과를 낼 가능성이 있습니다. 전문 자격증이나 학위가 큰 도움이 될 수 있어요.',
      };
      answer += `${HOUR_JOB_INSIGHT[hourSipForJob]}\n`;

      // 올해 세운 직업운
      if (thisYearSeun) {
        answer += `\n【${thisYearSeun.year}년 직업운】\n${thisYearSeun.career}`;
      }
    }
    // 결혼/연애/부부/애정 — 나이별 분기
    else if (/결혼|연애|사랑|인연|배우자|남편|아내|이혼|소개팅|만남|부부|궁합|가정|애정|연인|남친|여친/.test(q)) {
      const rel = sajuResult.relationship;
      const relLabel = rel === 'married' ? '기혼' : rel === 'dating' ? '연애중' : '미혼';

      // 학생 (< 20세): 궁합/결혼 대신 교우관계 분석 (초딩은 반말+웃긴 톤)
      if (currentAge < 20) {
        const isMale = sajuResult.gender === 'male';
        if (currentAge <= 12) {
          // 초등학생 — 반말 + 웃긴 연애운
          answer = `═══ 💘 연애운?! 뭐?! ═══\n\n`;
          answer += `야야야 ${currentAge}살이 연애운을 본다고?? 머리에 피도 안 말랐는데!! 😂😂😂\n\n`;
          answer += `그래 그래~ 뭐 한번 보긴 보자 ㅋㅋㅋ\n\n`;
          answer += `【💕 짝꿍 운】\n`;
          answer += ilOh === '목' ? `넌 활발해서 같은 반 친구들한테 인기 있는 편이야! 짝꿍이랑 잘 맞을 수 있어 ㅋ\n` :
            ilOh === '화' ? `넌 밝고 재밌어서 옆자리 친구가 좋아할 타입이야! 근데 너무 시끄러우면 짝꿍이 도망갈수도... 🏃\n` :
            ilOh === '토' ? `넌 듬직한 스타일이라 같이 있으면 편한 타입이야~ 짝꿍이 널 좋아할 수도 있어 ㅎ\n` :
            ilOh === '금' ? `넌 쿨한 스타일이라 은근 인기 있을 수 있어! "쟤 좀 멋있다" 이런 소리 들을지도? 😎\n` :
            `넌 감성 충만해서 편지 같은 거 쓰면 감동 폭발할 타입이야! ✉️\n`;
          answer += `\n【👫 베프 운】\n`;
          answer += `${OHAENG_KR[sajuResult.yongsin]} 기운 가진 친구랑 찐친이 될 수 있어! 같이 다니면 좋은 일이 생길 수도?\n\n`;
          answer += `【⚠️ 주의할 친구】\n`;
          answer += `${OHAENG_KR[sajuResult.gisin]} 기운 가진 친구랑은 싸울 수도 있어... 근데 싸워도 먼저 화해하면 더 친해질 수 있어!\n\n`;
          const monthSip = sajuResult.sipseongs.month;
          answer += `【🌈 마무리】\n`;
          answer += `연애는 나중에 해도 돼~ 지금은 공부하고 친구랑 놀고 맛있는 거 먹는 게 최고야! 할렐야루~ 🍕\n`;
          answer += monthSip === '상관' ? `근데 넌 커서 엄청 매력적인 사람이 될 수도 있어 ㅋㅋ 기대해! 난리자베스급 인기를 누릴지도?! 😎` :
            monthSip === '편재' ? `넌 커서 돈도 잘 벌고 멋진 사람 만날 수 있을 거야! 혜자베스~ 지금은 저금이나 하자 ㅋ` :
            `넌 멋진 어른이 될 거야! 스트롱 스트롱💪 지금 열심히 하면 나중에 좋은 사람이 알아볼 거야!`;
        } else {
          // 중고등학생 — 존댓말이지만 가벼운 톤
          answer = `═══ 친구·교우 관계 분석 ═══\n\n`;
          answer += `📋 나이: ${currentAge}세 | 일간: ${sajuResult.ilgan} (${OHAENG_KR[ilOh]} 기운)\n\n`;
          answer += `【나의 교우관계 스타일】\n`;
          answer += `${isMale ? '남자' : '여자'}로서 ${ilOh === '목' ? '의리 있고 리더십이 강한 친구 타입일 수 있어요. 새로운 친구를 잘 사귀고 모임에서 중심이 되는 편이에요.' : ilOh === '화' ? '밝고 에너지 넘쳐서 인기가 많은 타입일 수 있어요. 분위기 메이커!' : ilOh === '토' ? '듬직하고 신뢰감 있는 타입일 수 있어요. 주변에서 의지하는 존재가 될 가능성이 있어요.' : ilOh === '금' ? '쿨하고 정의감 강한 타입일 수 있어요. 옳고 그름이 분명한 편이에요.' : '감성적이고 공감 능력이 뛰어난 타입일 수 있어요.'}\n\n`;
          answer += `【잘 맞는 친구】\n${OHAENG_KR[sajuResult.yongsin]} 기운의 친구와 잘 맞을 수 있어요. 서로 시너지가 나고 함께 성장할 수 있는 관계일 가능성이 높아요.\n\n`;
          answer += `【주의할 관계】\n${OHAENG_KR[sajuResult.gisin]} 기운의 친구와는 갈등이 생길 수 있어요. 의견이 다를 때 한 발 물러서면 관계가 좋아질 수 있습니다.\n\n`;
          answer += `【학교생활 조언】\n`;
          const monthSip = sajuResult.sipseongs.month;
          if (['정관', '정인'].includes(monthSip)) answer += `규칙적이고 성실한 성격이라 선생님에게 신뢰받을 수 있는 타입이에요. 반장이나 조장 역할에 잘 어울릴 수 있어요.`;
          else if (['식신', '상관'].includes(monthSip)) answer += `창의적이고 표현력이 뛰어난 편이라 예체능이나 발표에서 빛을 발할 수 있어요. 자유로운 활동을 좋아하는 타입일 수 있어요.`;
          else if (['비견', '겁재'].includes(monthSip)) answer += `경쟁심이 있는 편이라 친구와 선의의 경쟁을 통해 성장할 수 있어요. 스포츠나 대회에서 두각을 나타낼 가능성이 있어요.`;
          else answer += `자기만의 페이스로 학교생활을 즐기는 타입일 수 있어요. 나답게 생활하면 좋은 친구를 만날 수 있을 거예요.`;
        }
      }
      // 60세 이상 기혼: 궁합 대신 가족 화합/노후 동반자
      else if (currentAge >= 60 && rel === 'married') {
        answer = `═══ 가족 화합 · 노후 동반자 운 ═══\n\n`;
        answer += `📋 현재 나이: ${currentAge}세 | 대운: ${currentDaeun ? `${currentDaeun.cheongan}${currentDaeun.jiji}(${currentStage}운)` : '분석중'}\n\n`;
        answer += `【부부 화합 · 함께 나이 드는 법】\n`;
        answer += `이 나이에 가장 중요한 것은 서로의 건강을 챙기고, 함께하는 시간의 질을 높이는 것일 수 있어요. `;
        answer += `용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 활용해 ${sajuResult.yongsin === '목' ? '함께 산책이나 텃밭 가꾸기' : sajuResult.yongsin === '화' ? '같이 여행이나 문화생활' : sajuResult.yongsin === '토' ? '규칙적인 식사와 가정 내 안정된 루틴' : sajuResult.yongsin === '금' ? '각자의 시간을 존중하되 정기적인 대화 시간' : '감정을 솔직하게 나누고 서로 이해하는 시간'}을 늘려보면 좋을 수 있어요.\n\n`;
        answer += `【자녀·가족 관계】\n`;
        const hourSipS = sajuResult.sipseongs.hour;
        answer += hourSipS === '식신' ? `자녀와 좋은 인연일 가능성이 높아요. 자녀가 효도하고 노후를 함께할 수 있는 편이에요.\n\n` :
          hourSipS === '상관' ? `자녀와 의견 충돌이 있을 수 있지만, 서로의 개성을 인정하면 좋은 관계를 유지할 수 있어요.\n\n` :
          `자녀와의 관계는 대체로 원만한 편일 수 있어요. 먼저 연락하고 관심을 표현하면 더 가까워질 수 있습니다.\n\n`;
        answer += `【노후 생활 조언】\n`;
        answer += `건강을 최우선으로 삼고, 무리한 활동은 피하는 게 좋을 수 있어요. `;
        answer += `기신(${OHAENG_KR[sajuResult.gisin]}) 에너지가 과해지면 부부 사이에 불필요한 갈등이 생길 수 있으니, 서로에게 양보하는 마음을 가지면 좋을 수 있습니다.\n`;
        if (thisYearSeun) answer += `\n【올해 가정운】\n${thisYearSeun.love}`;
      }
      // 60세 이상 미혼: 인생 후반 동반자
      else if (currentAge >= 60) {
        answer = `═══ 인생 후반 인간관계 · 동반자 운 ═══\n\n`;
        answer += `📋 현재 나이: ${currentAge}세\n\n`;
        answer += `【좋은 동반자/인연】\n${lifePredictions.marriage.partnerType}\n\n`;
        answer += `【인간관계 조언】\n${lifePredictions.marriage.meetingAdvice}\n\n`;
        answer += `이 나이에 중요한 것은 서로 존중하고 편안한 관계입니다. 무리하게 새로운 인연을 찾기보다, 주변의 소중한 사람들과의 관계를 돌아보세요.\n`;
        if (thisYearSeun) answer += `\n【올해 대인운】\n${thisYearSeun.love}`;
      }
      else {
      answer = `═══ 사주 ${rel === 'married' ? '부부운/가정운' : rel === 'dating' ? '애정운/연애운' : '결혼운/애정운'} 분석 ═══\n\n`;
      answer += `📋 현재 나이: ${currentAge}세 | 대운: ${currentDaeun ? `${currentDaeun.cheongan}${currentDaeun.jiji}(${currentStage}운, 에너지 ${currentStageEnergy}/10)` : '분석중'}\n`;
      answer += `📋 당신의 사주: ${sajuResult.ilgan}일간 (${OHAENG_KR[ilOh]} 기운) — ${sajuResult.iljuDesc.split('.')[0]}.\n`;
      answer += `📋 일주: ${sajuResult.day.cheongan}${sajuResult.day.jiji} (일지=${sajuResult.day.jiji}는 배우자궁) | 현재 상태: ${relLabel}\n`;
      answer += `📋 월주 십성: ${sajuResult.sipseongs.month} | 시주 십성: ${sajuResult.sipseongs.hour} | 용신: ${OHAENG_KR[sajuResult.yongsin]}\n\n`;

      if (rel === 'married') {
        // 기혼자용
        answer += `【부부 궁합 분석】\n${lifePredictions.marriage.partnerType}\n\n`;
        answer += `【결혼 생활 조언】\n${lifePredictions.marriage.marriageAdvice}\n\n`;

        // 바람끼/외도 성향 분석
        const hourSip = sajuResult.sipseongs.hour;
        const monthSip = sajuResult.sipseongs.month;
        let cheatingLevel = '보통';
        let cheatingDesc = '';
        // 도화살 성향 분석 (시주/월주 십성 기반)
        const riskyStars = ['편재', '상관', '겁재'];
        const stableStars = ['정관', '정인', '정재'];
        const riskCount = [hourSip, monthSip].filter(s => riskyStars.includes(s)).length;
        const stableCount = [hourSip, monthSip].filter(s => stableStars.includes(s)).length;
        if (riskCount >= 2) {
          cheatingLevel = '주의 필요';
          cheatingDesc = '사주 구조상 외부 인연에 끌릴 수 있는 기운이 있습니다. 특히 편재·상관이 겹치면 자극적인 새로운 만남에 흔들릴 수 있으니, 배우자와의 소통을 더 자주 하고 함께하는 시간을 늘리세요.';
        } else if (riskCount === 1 && stableCount === 0) {
          cheatingLevel = '약간 있음';
          cheatingDesc = '평소에는 안정적이지만, 스트레스를 받거나 권태기가 오면 외부 유혹에 약해질 수 있습니다. 취미나 운동으로 에너지를 건전하게 발산하세요.';
        } else if (stableCount >= 1) {
          cheatingLevel = '낮음';
          cheatingDesc = '정관·정인·정재가 있어 가정에 충실한 성향입니다. 원칙적이고 책임감이 강해 외도 가능성이 낮습니다. 다만 배우자에 대한 무관심은 관계를 식게 하니, 표현을 아끼지 마세요.';
        } else {
          cheatingLevel = '보통';
          cheatingDesc = '특별히 강한 외도 성향은 없지만, 환경에 따라 달라질 수 있습니다. 부부 간 신뢰와 소통이 가장 중요합니다.';
        }
        // 현재 대운 목욕살 체크
        if (currentStage === '목욕') {
          cheatingLevel = '주의 필요 (현재 목욕운)';
          cheatingDesc += '\n\n⚠️ 현재 대운이 "목욕"운으로, 외적 변화와 이성 관심이 높아지는 시기입니다. 이 시기에 새로운 이성에게 끌리는 감정이 생길 수 있지만, 일시적인 감정에 휘둘리지 말고 가정을 소중히 하세요.';
        }
        answer += `【외도/바람끼 성향 분석】\n`;
        answer += `바람끼 수준: ${cheatingLevel}\n`;
        answer += `${cheatingDesc}\n\n`;

        answer += `【부부간 주의사항】\n`;
        answer += `당신의 기신(${OHAENG_KR[sajuResult.gisin]})이 과하면 부부 갈등이 생기기 쉽습니다. `;
        answer += `배우자와의 소통에서 ${OHAENG_KR[sajuResult.yongsin]} 기운을 의식하면 관계가 좋아집니다.\n\n`;
        if (currentDaeun) {
          answer += `【현재 가정운 (대운 ${currentDaeun.cheongan}${currentDaeun.jiji}, ${currentStage}운)】\n`;
          if (['장생', '관대', '건록'].includes(currentStage)) {
            answer += `가정에 활기가 넘치는 시기입니다. 부부 여행이나 새로운 목표를 함께 세워보세요.\n`;
          } else if (['쇠', '병', '사'].includes(currentStage)) {
            answer += `부부 사이에 오해가 생기기 쉬운 시기입니다. 대화와 배려를 더 신경 쓰세요.\n`;
          } else {
            answer += `안정적인 가정운입니다. 함께하는 시간을 소중히 하면 더 깊어집니다.\n`;
          }
        }

        // 이혼/재혼 성향 분석
        answer += `\n【이혼/재혼 성향 분석】\n`;
        const dayJiji = sajuResult.day.jiji;
        const hasSangGwan = [sajuResult.sipseongs.month, sajuResult.sipseongs.hour].includes('상관');
        const hasGyeopJae = [sajuResult.sipseongs.month, sajuResult.sipseongs.hour].includes('겁재');
        const hasJeongGwan = [sajuResult.sipseongs.month, sajuResult.sipseongs.hour].includes('정관');
        const hasJeongIn = [sajuResult.sipseongs.month, sajuResult.sipseongs.hour].includes('정인');
        if (hasSangGwan && hasGyeopJae) {
          answer += `상관+겁재가 함께 있어 부부 갈등이 잦을 수 있는 구조입니다. 감정 조절이 핵심이며, 서로의 영역을 존중하는 것이 이혼을 막는 열쇠입니다. 위기가 오면 제3자(상담사 등)의 도움을 받는 것이 좋습니다.\n`;
        } else if (hasSangGwan) {
          answer += `상관이 있어 배우자에 대한 불만이 쌓이기 쉬운 구조입니다. 불만을 속으로 삭이지 말고 건설적으로 대화하세요. 적극적 소통으로 위기를 넘기면 오히려 더 단단한 부부가 됩니다.\n`;
        } else if (hasJeongGwan && hasJeongIn) {
          answer += `정관+정인이 있어 가정에 헌신적인 사주입니다. 이혼 가능성이 낮고, 어려운 시기도 책임감으로 버텨냅니다. 평생 한 사람과 함께할 가능성이 높습니다.\n`;
        } else {
          answer += `특별한 이혼 성향은 보이지 않습니다. 부부 관계는 사주보다 서로의 노력이 더 중요합니다. 대운이 좋지 않은 시기에 갈등이 심해질 수 있으니, 그때 더 인내하세요.\n`;
        }
        // 재혼운
        if (hasSangGwan || hasGyeopJae) {
          answer += `만약의 경우, 재혼운은 있는 편입니다. 첫 결혼의 실수를 교훈 삼아 더 나은 관계를 만들 수 있는 사주입니다.\n`;
        }

      } else if (rel === 'dating') {
        // 연애중
        answer += `【현재 연애 분석】\n`;
        answer += `교제 중인 상대와의 관계를 사주로 살펴보면, ${lifePredictions.marriage.partnerType}\n\n`;
        answer += `【결혼 적기】\n`;
        answer += lifePredictions.marriage.bestAges.map((age: number) => `• ${age}세`).join('\n') + '\n\n';
        answer += `【시기별 상세 설명】\n${lifePredictions.marriage.bestPeriodDesc}\n\n`;
        answer += `【결혼 생활 조언】\n${lifePredictions.marriage.marriageAdvice}\n\n`;
        if (currentDaeun) {
          answer += `【현재 연애운 (대운 ${currentDaeun.cheongan}${currentDaeun.jiji}, ${currentStage}운)】\n`;
          if (['장생', '관대', '건록'].includes(currentStage)) {
            answer += `관계가 깊어지기 좋은 시기입니다. 결혼을 고려한다면 지금이 좋은 타이밍입니다.\n`;
          } else if (['쇠', '병', '사'].includes(currentStage)) {
            answer += `관계에 권태기가 올 수 있는 시기입니다. 새로운 경험을 함께 하며 활력을 불어넣으세요.\n`;
          } else {
            answer += `안정적으로 관계를 이어가기 좋은 시기입니다.\n`;
          }
        }
      } else {
        // 솔로
        // 결혼 가능성 분석
        const soloMonthSip = sajuResult.sipseongs.month;
        const soloHourSip = sajuResult.sipseongs.hour;
        answer += `【결혼 사주 분석 — 결혼을 할 수 있는 사주인가?】\n`;
        const hasJeongJae = [soloMonthSip, soloHourSip].includes('정재');
        const hasJeongGwanS = [soloMonthSip, soloHourSip].includes('정관');
        const hasEdInS = [soloMonthSip, soloHourSip].includes('편인');
        const hasBiGyeon = [soloMonthSip, soloHourSip].includes('비견');
        if (sajuResult.gender === 'male' && hasJeongJae) {
          answer += `정재가 있어 결혼운이 좋은 사주입니다. 안정적이고 가정적인 배우자를 만날 가능성이 높습니다. 결혼은 반드시 합니다!\n\n`;
        } else if (sajuResult.gender === 'female' && hasJeongGwanS) {
          answer += `정관이 있어 좋은 남편을 만날 수 있는 사주입니다. 듬직하고 책임감 있는 배우자를 만날 가능성이 높습니다.\n\n`;
        } else if (hasEdInS && hasBiGyeon) {
          answer += `편인+비견이 강해 독립성이 매우 높은 사주입니다. 혼자서도 충분히 잘 살 수 있어 결혼의 필요성을 못 느낄 수 있습니다. 하지만 결혼을 못 하는 것이 아니라, 결혼 의지만 있으면 충분히 가능합니다. 다만 늦은 결혼(30대 중후반 이후)이 더 안정적입니다.\n\n`;
        } else {
          answer += `결혼을 못 하는 사주는 없습니다. 다만 시기의 차이가 있을 뿐입니다. 대운에서 인연이 오는 시기를 잘 잡으면 좋은 결혼을 할 수 있습니다.\n\n`;
        }

        answer += `【결혼운 최적 시기】\n`;
        answer += lifePredictions.marriage.bestAges.map((age: number) => `• ${age}세`).join('\n') + '\n\n';
        answer += `【시기별 상세 설명】\n${lifePredictions.marriage.bestPeriodDesc}\n\n`;
        answer += `【잘 맞는 배우자 유형】\n${lifePredictions.marriage.partnerType}\n\n`;
        answer += `【좋은 인연을 만나려면】\n${lifePredictions.marriage.meetingAdvice}\n\n`;
        answer += `【결혼 생활 조언】\n${lifePredictions.marriage.marriageAdvice}\n\n`;
        if (currentDaeun) {
          answer += `【현재 연애운 (대운 ${currentDaeun.cheongan}${currentDaeun.jiji}, ${currentStage}운)】\n`;
          // 건강 상태에 따라 사교 활동 조언 조정
          const wkBal = sajuResult.ohaengBalance[sajuResult.weakestOhaeng as Ohaeng];
          const hasAnxiety = sajuResult.weakestOhaeng === '화' && wkBal <= 1;
          const hasFatigue = sajuResult.weakestOhaeng === '목' && wkBal <= 1;
          if (['장생', '관대', '건록', '목욕'].includes(currentStage)) {
            if (hasAnxiety) {
              answer += `에너지가 활발한 시기이지만, 화(火) 부족으로 불안 증상이 있을 수 있어 대규모 모임보다는 소수의 편안한 만남이 더 효과적입니다. 온라인 만남이나 취미 동호회처럼 부담이 적은 방식으로 인연을 넓혀보세요.\n`;
            } else if (hasFatigue) {
              answer += `에너지가 활발한 시기이지만, 목(木) 부족으로 체력이 따라가지 않을 수 있어요. 무리하지 않는 선에서 자연스러운 만남의 기회를 잡으세요.\n`;
            } else {
              answer += `에너지가 활발한 시기로 새로운 만남이 많습니다. 적극적으로 사교 활동에 나서세요!\n`;
            }
          } else if (['쇠', '병', '사', '묘'].includes(currentStage)) {
            answer += `내면에 집중하는 시기입니다. 외모보다 마음이 맞는 사람을 찾는 것이 좋습니다.\n`;
          } else {
            if (hasAnxiety) {
              answer += `좋은 인연이 다가올 수 있는 시기입니다. 편안한 환경에서 자연스럽게 사람을 만나보세요. 억지로 큰 모임에 나가기보다, 가까운 사람의 소개나 온라인 만남이 당신에게 더 맞을 수 있어요.\n`;
            } else {
              answer += `좋은 인연이 다가올 수 있는 시기입니다. 마음을 열고 사람들을 만나보세요.\n`;
            }
          }
        }
      }

      if (thisYearSeun) {
        answer += `\n【${thisYearSeun.year}년 ${rel === 'married' ? '가정운' : '연애운'}】\n${thisYearSeun.love}`;
      }
      } // close else block for age >= 20 && age < 60
    }
    // 돈/재물
    else if (/돈|재물|부자|투자|주식|부동산|월급|수입|재테크|저축|로또/.test(q)) {
      answer = `═══ 사주 재물 분석 ═══\n\n`;
      answer += `📋 당신의 사주: ${sajuResult.ilgan}일간 (${OHAENG_KR[ilOh]} 기운) — ${sajuResult.iljuDesc.split('.')[0]}.\n`;
      answer += `📋 일주: ${sajuResult.day.cheongan}${sajuResult.day.jiji} | 월주: ${sajuResult.month.cheongan}${sajuResult.month.jiji}\n`;
      answer += `📋 용신: ${OHAENG_KR[sajuResult.yongsin]} | 기신: ${OHAENG_KR[sajuResult.gisin]} | 넘치는 기운: ${sajuResult.dominantOhaeng} | 부족한 기운: ${sajuResult.weakestOhaeng}\n`;
      answer += `📋 월주 십성: ${sajuResult.sipseongs.month} | 시주 십성: ${sajuResult.sipseongs.hour}\n\n`;
      // 현재 나이 기준으로 과거/미래 시기 구분
      const wDetailAge = currentAge;
      const wFuture = lifePredictions.wealth.peakAges.filter((p: string) => { const m = p.match(/(\d+)/); return m ? parseInt(m[1]) >= wDetailAge - 2 : true; });
      const wPast = lifePredictions.wealth.peakAges.filter((p: string) => { const m = p.match(/(\d+)/); return m ? parseInt(m[1]) < wDetailAge - 2 : false; });
      if (wFuture.length > 0) {
        answer += `【앞으로의 재물운 최고 시기】\n${wFuture.map((p: string) => `• ${p}`).join('\n')}\n`;
      }
      if (wPast.length > 0) {
        answer += `(이미 지난 시기: ${wPast.join(', ')})\n`;
      }
      answer += '\n';
      answer += `【나의 재물 유형】\n${lifePredictions.wealth.wealthType}\n\n`;
      answer += `【투자 조언】\n${lifePredictions.wealth.investmentAdvice}\n\n`;
      answer += `【지출 주의사항】\n${lifePredictions.wealth.spendingWarning}\n\n`;

      if (currentDaeun) {
        answer += `【현재 재물운 (대운 ${currentDaeun.cheongan}${currentDaeun.jiji}, ${currentStage}운)】\n`;
        if (currentStageEnergy >= 7) {
          answer += `에너지가 높아 재물 활동에 유리합니다. 적극적인 투자나 수입 확대를 고려해보세요. 단, 과욕은 금물입니다.\n`;
        } else if (currentStageEnergy >= 4) {
          answer += `보통의 재물운입니다. 안정적인 저축과 꾸준한 재테크가 좋습니다. 고위험 투자는 피하세요.\n`;
        } else {
          answer += `재물에 주의가 필요한 시기입니다. 큰 투자나 보증을 피하고, 절약과 저축에 집중하세요.\n`;
        }
      }

      // 사업자용 상세 분석
      const wMonthSip = sajuResult.sipseongs.month;
      const wHourSip = sajuResult.sipseongs.hour;
      answer += `\n【사업/장사 수완 분석】\n`;
      if (['편재', '식신'].includes(wMonthSip)) {
        answer += `사업적 감각이 뛰어난 사주입니다. `;
        if (wMonthSip === '편재') {
          answer += `편재가 월주에 있어 돈의 흐름을 읽는 능력이 탁월합니다. 큰 돈을 벌 수 있는 구조이지만, 쓰는 것도 커서 자금 관리가 핵심입니다. 레버리지(빚)를 활용한 투자도 가능하지만 과하면 위험합니다.\n`;
        } else {
          answer += `식신이 있어 아이디어로 돈을 버는 타입입니다. 콘텐츠, 교육, 요식업, 프랜차이즈에서 성공 가능성이 높습니다.\n`;
        }
      } else if (['정재', '정관'].includes(wMonthSip)) {
        answer += `안정적으로 돈을 벌고 지키는 사주입니다. 급격한 부자보다 꾸준히 자산을 불리는 타입입니다. 부동산, 적금, 연금 등 안정 자산이 유리합니다.\n`;
      } else if (['겁재', '상관'].includes(wMonthSip)) {
        answer += `돈을 크게 벌 수 있지만 크게 잃을 수도 있는 사주입니다. 감정적 투자를 절대 피하세요. 반드시 전문가 조언을 받고, 분산 투자하세요.\n`;
      } else {
        answer += `재물 성향은 보통입니다. 본업에 충실하면서 부수입을 만드는 것이 현명합니다.\n`;
      }

      // 향후 재물 방향 조언
      answer += `\n【앞으로의 재물 전략】\n`;
      if (currentStageEnergy >= 7) {
        answer += `현재 대운이 좋아 공격적 재테크가 가능합니다.\n`;
        answer += `• 사업 확장, 신규 투자, 부동산 매입 등 적극적 행동이 유리합니다.\n`;
        answer += `• 단, 이 시기에 번 돈의 30% 이상은 반드시 안전 자산에 넣어두세요. 좋은 대운이 영원하지 않습니다.\n`;
      } else if (currentStageEnergy >= 4) {
        answer += `현재는 공격보다 수비가 중요한 시기입니다.\n`;
        answer += `• 기존 수입원을 안정화하고, 불필요한 지출을 줄이세요.\n`;
        answer += `• 새 사업보다 기존 사업의 효율화에 집중하세요.\n`;
        answer += `• 보증이나 대출은 최대한 줄이세요.\n`;
      } else {
        answer += `재물에 주의가 필요한 시기입니다.\n`;
        answer += `• 절대 큰 투자나 보증을 서지 마세요.\n`;
        answer += `• 현금 보유를 늘리고, 지출을 최소화하세요.\n`;
        answer += `• 이 시기를 잘 버티면 다음 대운에서 큰 기회가 옵니다.\n`;
      }

      // 시주 십성 기반 재물 보충 — 같은 날 다른 시간과 차별화
      answer += `\n【시주(${sajuResult.hour.cheongan}${sajuResult.hour.jiji})로 본 말년 재물운】\n`;
      const HOUR_WEALTH: Record<string, string> = {
        '비견': '독립적으로 돈을 벌어야 하는 구조일 수 있어요. 파트너와 재물을 나누면 갈등이 생기기 쉬운 편이라, 자기 명의의 자산을 확보하는 게 유리할 수 있습니다.',
        '겁재': '중년 이후 예상치 못한 재물 유출이 있을 수 있는 편이에요. 보증이나 공동 투자는 특히 신중하게 판단하는 게 좋습니다.',
        '식신': '말년이 풍족할 가능성이 높은 사주예요! 기술이나 재능으로 돈이 꾸준히 들어올 수 있는 구조라 노후가 안정적인 편일 수 있습니다.',
        '상관': '전문성을 돈으로 바꾸는 능력이 있을 수 있어, 말년에도 전문 분야에서 수입을 유지할 가능성이 있습니다. 다만 돈보다 자존심을 앞세우면 기회를 놓칠 수 있어요.',
        '편재': '시주에 편재가 있어 말년 사업운이 좋을 수 있어요! 중년 이후 투자나 사업에서 큰 수익을 올릴 가능성이 있습니다. 다만 과도한 욕심은 주의가 필요해요.',
        '정재': '가장 안정적인 말년 재물운일 가능성이 높아요. 꾸준히 저축한 것이 노후에 큰 힘이 될 수 있습니다. 연금, 적금 등 안전 자산이 유리한 편이에요.',
        '편관': '사회적 지위를 통해 재물이 따라오는 구조일 수 있어요. 명예와 재물이 연결되어 있을 가능성이 있어, 사회 활동을 유지하는 게 경제적으로도 유리할 수 있습니다.',
        '정관': '안정적인 직장 연금이나 퇴직금이 노후 자산의 핵심이 될 수 있어요. 규칙적인 저축 습관이 큰 자산으로 쌓일 가능성이 높습니다.',
        '편인': '독특한 방법으로 돈을 버는 사주일 수 있어요. 일반적인 투자보다 자신만 아는 틈새 시장에서 수익을 낼 가능성이 있습니다.',
        '정인': '지적 자산이 재물로 이어질 수 있는 사주예요. 책, 강의, 교육, 특허 등 지식 기반 수입이 노후에 큰 도움이 될 가능성이 있습니다.',
      };
      answer += `${HOUR_WEALTH[wHourSip]}\n`;

      if (thisYearSeun) {
        answer += `\n【${thisYearSeun.year}년 재물운】\n${thisYearSeun.money}`;
      }
    }
    // 건강
    else if (/건강|아프|병원|다이어트|운동|스트레스|수명|체력|몸|아픈|통증|허리|머리|위장/.test(q)) {
      const HEALTH_MAP: Record<string, { weak: string; bodyParts: string; symptoms: string; exercise: string; food: string; season: string; danger: string }> = {
        '목': {
          weak: '간, 담낭, 눈, 근육, 신경계, 손발 저림',
          bodyParts: '🔸 간/담낭: 간 수치 이상, 담석, 지방간 가능성. 음주 절제 필수\n🔸 눈: 시력 저하, 안구건조증, 눈 충혈 가능. 장시간 스마트폰/PC 주의\n🔸 근육/인대: 근육통, 허리 디스크, 관절 약화. 무리한 운동보다 스트레칭\n🔸 신경계: 두통, 편두통, 손발 저림, 신경과민. 스트레스 관리 중요\n🔸 손톱/발톱: 갈라지거나 약해질 수 있음. 단백질 섭취 보강',
          symptoms: '피로감이 잘 풀리지 않음, 눈 밑 다크서클, 근육 경련, 소화는 괜찮으나 피로 회복이 느림',
          exercise: '스트레칭, 요가, 산책, 등산 등 자연 속 운동. 과격한 운동보다 유연성 중심',
          food: '녹색 채소(시금치, 브로콜리), 신맛 음식(매실, 식초, 레몬), 간에 좋은 부추, 결명자차',
          season: '봄에 에너지 상승 → 새로운 운동 시작 적기. 가을(금극목)에 건강 주의 → 면역력 저하',
          danger: '🚗 운전조심: 피로 누적 시 졸음운전 위험. 장거리 운전 삼가\n🔥 불조심: 신경이 예민해질 때 부주의 사고. 화기 근처 집중력 유지\n💧 물조심: 간/담 약할 때 음주 후 물놀이 절대 금지'
        },
        '화': {
          weak: '심장, 소장, 혈압, 눈, 혀, 혈관',
          bodyParts: '🔸 심장/혈관: 심장 두근거림, 부정맥, 고혈압/저혈압 주의. 심혈관 검진 필수\n🔸 소장: 소화 불량(특히 밀가루/기름진 음식), 복통\n🔸 혈압: 급격한 혈압 변동. 찬물 샤워, 사우나 주의\n🔸 눈/혀: 충혈, 구내염, 혀 갈라짐. 열이 많으면 악화\n🔸 정신: 불면증, 불안, 공황장애 가능성. 과도한 흥분 주의',
          symptoms: '가슴 답답함, 얼굴 열감(화끈거림), 입안 헐기 쉬움, 잠들기 어려움, 꿈이 많음',
          exercise: '수영, 명상, 호흡법 등 열을 식히는 운동. 격렬한 운동 시 심박수 체크 필수',
          food: '쓴맛 음식(녹차, 셀러리), 심장에 좋은 견과류/오메가3, 토마토, 적포도',
          season: '여름에 에너지 높지만 열사병/탈수 주의. 겨울(수극화)에 심혈관 사고 위험 → 보온 필수',
          danger: '🚗 운전조심: 흥분/화날 때 과속 위험. 감정 조절 후 운전\n🔥 불조심: 화(火) 기운 과잉 시 화재 사고 가능성 높음! 가스, 전기 점검 철저\n💧 물조심: 심장이 약할 때 냉수 수영/급격한 온도변화 위험'
        },
        '토': {
          weak: '위장, 비장, 소화기, 피부, 입/잇몸',
          bodyParts: '🔸 위장/비장: 위염, 위궤양, 소화불량, 역류성 식도염. 불규칙 식사가 주적\n🔸 피부: 아토피, 습진, 두드러기, 여드름. 스트레스 시 악화\n🔸 입/잇몸: 구내염, 잇몸 질환, 입냄새. 구강 관리 필수\n🔸 근육/지방: 비만 경향, 살이 쉽게 찜. 기초대사량 유지 중요\n🔸 혈당: 당뇨 가능성. 단 음식 과다 섭취 주의',
          symptoms: '배가 더부룩함, 식후 졸림, 살이 잘 찜, 피부 트러블 반복, 입 마름',
          exercise: '걷기, 등산, 정원 가꾸기 등 규칙적 운동. 식후 30분 산책 습관화',
          food: '단맛 음식(고구마, 호박, 꿀), 소화에 좋은 음식, 규칙적 식사가 핵심. 밀가루/인스턴트 줄이기',
          season: '환절기마다 면역력 저하. 사계절 고른 관리 필요. 장마철 습기에 약함',
          danger: '🚗 운전조심: 식곤증, 졸음 주의. 식후 바로 운전 삼가\n🔥 불조심: 주방 사고 주의 (요리 중 화상). 가스 밸브 확인\n💧 물조심: 습한 환경에서 건강 악화. 장마철 특히 주의'
        },
        '금': {
          weak: '폐, 대장, 호흡기, 피부, 코, 기관지',
          bodyParts: '🔸 폐/기관지: 기침, 천식, 만성 기관지염 가능. 흡연 절대 금물\n🔸 대장: 변비, 과민성 대장증후군(IBS), 대장 용종 주의\n🔸 피부: 건조함, 가려움, 알레르기 반응 쉬움. 보습 철저\n🔸 코: 비염, 축농증, 코막힘. 미세먼지/황사 대비 필수\n🔸 뼈/치아: 골다공증 가능성, 치아 관리 중요',
          symptoms: '감기에 잘 걸림, 피부 건조/가려움, 변비 경향, 코 알레르기, 건조한 기침',
          exercise: '깊은 호흡 운동, 에어로빅, 맑은 공기 속 운동. 실내 환기 중요',
          food: '매운맛 적당히(생강, 마늘), 폐에 좋은 배·도라지·더덕, 식이섬유 풍부한 음식',
          season: '가을에 에너지 높지만 건조함 주의. 봄(목극금 아님, 화극금) 황사철 호흡기 악화',
          danger: '🚗 운전조심: 미세먼지/황사 시 시야 확보 어려움. 차량 에어필터 점검\n🔥 불조심: 화극금 — 화재에 특히 취약한 오행! 소화기 비치, 전기 점검 필수\n💧 물조심: 찬물/찬바람에 약함. 겨울철 냉수 접촉 주의'
        },
        '수': {
          weak: '신장, 방광, 허리, 귀, 뼈, 생식기',
          bodyParts: '🔸 신장/방광: 신장 기능 약화, 빈뇨, 야간뇨, 부종. 수분 섭취·배출 밸런스 중요\n🔸 허리: 허리 디스크, 만성 요통. 장시간 앉아있기 주의\n🔸 귀: 이명, 난청 가능성. 큰 소리 노출 주의\n🔸 뼈/관절: 골밀도 저하, 관절 약화. 칼슘/비타민D 보충\n🔸 생식기/호르몬: 호르몬 불균형, 냉증, 생리불순(여성). 하체 보온 중요',
          symptoms: '허리가 자주 아픔, 소변이 잦음, 추위를 많이 탐, 하체 부종, 피로감, 귀 울림',
          exercise: '수영, 온천, 반신욕 등 물과 관련된 활동. 허리 근력 강화 운동 병행',
          food: '짠맛 적당히(해조류, 미역, 다시마), 검은콩, 호두, 새우, 신장에 좋은 산수유차',
          season: '겨울에 지혜 깊어지지만 추위에 약함 → 허리/관절 주의. 여름(화극수 아님, 토극수)에 수분 보충',
          danger: '🚗 운전조심: 허리 통증 시 장시간 운전 위험. 쿠션/자세 교정 필수\n🔥 불조심: 보일러, 온수기 등 난방기구 점검. 동파 사고 주의\n💧 물조심: 수(水) 기운 과잉 시 물 관련 사고 위험 높음! 수영장/바다/비올 때 각별히 주의'
        },
      };
      const hd = HEALTH_MAP[ilOh];
      answer = `═══ 사주 건강 · 신체 정밀 분석 ═══\n\n`;
      answer += `📋 당신의 사주: ${sajuResult.ilgan}일간 (${OHAENG_KR[ilOh]} 기운)\n`;
      answer += `📋 용신: ${OHAENG_KR[sajuResult.yongsin]} | 기신: ${OHAENG_KR[sajuResult.gisin]} | 약한 오행: ${OHAENG_KR[sajuResult.weakestOhaeng]}\n\n`;

      answer += `【현재 몸의 취약 부위 (오행 기반)】\n${hd.bodyParts}\n\n`;

      answer += `【자주 나타나는 증상】\n${hd.symptoms}\n\n`;

      // 오행 불균형 기반 추가 건강 분석
      const weakOh = sajuResult.weakestOhaeng;
      const weakBalance = sajuResult.ohaengBalance[weakOh as Ohaeng];
      const isExtreme = weakBalance <= 1; // 극단적 부족 (1 이하)
      const WEAK_HEALTH_DETAIL: Record<string, string> = {
        '목': '목(木) 기운 부족 → 간 해독 기능 약화, 눈 피로 심화, 근육 경직. 녹색 채소 필수, 봄나물 섭취, 아침 산책 권장. 비타민B, 밀크씨슬 보조제 고려.',
        '화': '화(火) 기운 부족 → 혈액순환 저하, 손발 차가움, 무기력, 심장 두근거림. 반신욕, 따뜻한 차, 적당한 유산소 운동 권장. 코엔자임Q10, 홍삼 고려.',
        '토': '토(土) 기운 부족 → 소화 기능 약화, 영양 흡수 불량. 따뜻한 음식 위주, 규칙적 식사, 과식 금지. 유산균/프로바이오틱스 권장.',
        '금': '금(金) 기운 부족 → 면역력 약화, 호흡기 질환 반복. 깊은 호흡 연습, 공기 좋은 곳 방문, 가습기 사용. 비타민C, 프로폴리스 고려.',
        '수': '수(水) 기운 부족 → 신장 기능 약화, 허리 통증 반복. 충분한 수분 섭취, 허리 보호, 하체 보온. 오메가3, 검은깨/검은콩 섭취.',
      };
      // 극단적 부족(1 이하) 시 심화 경고
      const EXTREME_WEAK_DETAIL: Record<string, string> = {
        '목': '🚨 목(木) 극도 부족! 간/담 기능이 매우 약하여 만성 피로, 탈모, 근육 위축이 올 수 있습니다. 우울감·무력감이 잦다면 간 기능 검진을 받으세요. 스트레스 관리가 생존 전략입니다.',
        '화': '🚨 화(火) 극도 부족! 심장·혈관 기능이 매우 약하여 공황장애, 불안장애, 심장 두근거림, 불면증이 올 수 있습니다. 갑작스러운 두려움이나 호흡곤란을 느낀다면 정신건강의학과 상담을 권합니다. 따뜻한 환경 유지, 규칙적인 유산소 운동(걷기·수영), 명상·호흡법이 필수입니다. 카페인·찬 음식을 줄이고, 혈액순환을 돕는 홍삼·계피·생강차를 챙기세요.',
        '토': '🚨 토(土) 극도 부족! 위장 기능이 매우 약하여 만성 소화불량, 영양실조, 급격한 체중 변화가 올 수 있습니다. 불규칙한 식사가 치명적입니다. 따뜻한 죽·스프 위주의 부드러운 식단을 유지하세요.',
        '금': '🚨 금(金) 극도 부족! 면역력이 매우 약하여 감기·폐렴이 잦고, 피부 질환이 만성화될 수 있습니다. 공기 청정기 필수, 호흡기 질환 조기 치료, 건조한 환경 피하세요.',
        '수': '🚨 수(水) 극도 부족! 신장·방광 기능이 매우 약하여 만성 허리 통증, 탈수, 냉증이 심합니다. 하체 보온 필수, 허리 근력 운동, 충분한 수분 섭취가 생존 전략입니다.',
      };
      answer += `【오행 불균형 분석 (${OHAENG_KR[weakOh]} 기운 부족 — ${weakBalance}점)】\n`;
      if (isExtreme) {
        answer += `${EXTREME_WEAK_DETAIL[weakOh]}\n\n`;
      } else {
        answer += `${WEAK_HEALTH_DETAIL[weakOh]}\n\n`;
      }

      // 기신 오행이 건강에 미치는 영향
      const gisinOh = sajuResult.gisin;
      const GISIN_HEALTH: Record<string, string> = {
        '목': '기신 목(木) → 간에 과부하가 걸리기 쉬움. 과음/과로가 직접적으로 건강을 해칩니다. 스트레스로 인한 근육 경직, 편두통 주의.',
        '화': '기신 화(火) → 심장/혈관에 부담. 흥분, 분노가 건강의 적입니다. 고혈압, 심장 두근거림, 불면증 위험.',
        '토': '기신 토(土) → 위장 기능에 부담. 과식, 야식이 건강의 적입니다. 위염, 체중 증가, 피부 트러블 위험.',
        '금': '기신 금(金) → 호흡기에 부담. 건조한 환경, 먼지가 건강의 적입니다. 알레르기, 피부 건조, 기관지 질환 위험.',
        '수': '기신 수(水) → 신장/비뇨기에 부담. 차가운 환경, 과로가 건강의 적입니다. 부종, 냉증, 허리 통증 위험.',
      };
      answer += `【기신(忌神) 건강 영향 — 이것이 당신을 아프게 한다】\n${GISIN_HEALTH[gisinOh]}\n\n`;

      // ★ 교차 검증 건강 분석: 개별 오행 나열이 아닌, 서로 영향을 주는 관계를 분석
      {
        const bal = sajuResult.ohaengBalance;
        const ohList: Ohaeng[] = ['목', '화', '토', '금', '수'];
        const crossHealthNotes: string[] = [];

        // (A) 과다 오행이 상극하는 오행의 건강도 악화시키는 효과
        const SANGGEUK: Record<Ohaeng, Ohaeng> = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };
        const domOhH = sajuResult.dominantOhaeng as Ohaeng;
        const domBalH = bal[domOhH];
        const targetOh = SANGGEUK[domOhH];
        const targetBal = bal[targetOh];
        if (domBalH >= 4 && targetBal <= 2) {
          const ORGAN_MAP: Record<Ohaeng, string> = { '목': '간/담', '화': '심장/혈관', '토': '위장/비장', '금': '폐/호흡기', '수': '신장/허리' };
          crossHealthNotes.push(
            `${OHAENG_KR[domOhH]}(${domBalH}점) 과다가 ${OHAENG_KR[targetOh]}(${targetBal}점)을 상극으로 억누르고 있습니다. `
            + `→ ${ORGAN_MAP[targetOh]}가 이중으로 약해지는 구조예요. `
            + `${OHAENG_KR[domOhH]} 기운을 빼주는(설기) ${OHAENG_KR[SANGGEUK[targetOh] === domOhH ? targetOh : domOhH]} 활동이 도움이 됩니다.`
          );
        }

        // (B) 두 번째로 부족한 오행도 위험 경고
        const sorted = ohList.slice().sort((a, b) => bal[a] - bal[b]);
        const secondWeakest = sorted[1];
        if (bal[secondWeakest] <= 1.5 && secondWeakest !== weakOh) {
          const ORGAN_MAP2: Record<Ohaeng, string> = { '목': '간/눈/근육', '화': '심장/혈관/정신', '토': '위장/소화기/피부', '금': '폐/호흡기/피부', '수': '신장/허리/생식기' };
          crossHealthNotes.push(
            `${OHAENG_KR[secondWeakest]}(${bal[secondWeakest]}점)도 부족합니다. `
            + `→ ${ORGAN_MAP2[secondWeakest]}도 함께 주의해야 합니다. 가장 약한 ${OHAENG_KR[weakOh]}만 챙기면 안 되고, ${OHAENG_KR[secondWeakest]}도 동시에 보충해야 합니다.`
          );
        }

        // (C) 일간↔부족 오행의 십성 관계로 어떤 능력이 결핍되는지 해석
        const IL_OH_SIPSEONG: Record<string, Record<Ohaeng, string>> = {
          '목': { '목': '비겁(자아)', '화': '식상(표현/창의)', '토': '재성(재물/현실감)', '금': '관성(규율/책임)', '수': '인성(학습/지혜)' },
          '화': { '화': '비겁(자아)', '토': '식상(표현/창의)', '금': '재성(재물/현실감)', '수': '관성(규율/책임)', '목': '인성(학습/지혜)' },
          '토': { '토': '비겁(자아)', '금': '식상(표현/창의)', '수': '재성(재물/현실감)', '목': '관성(규율/책임)', '화': '인성(학습/지혜)' },
          '금': { '금': '비겁(자아)', '수': '식상(표현/창의)', '목': '재성(재물/현실감)', '화': '관성(규율/책임)', '토': '인성(학습/지혜)' },
          '수': { '수': '비겁(자아)', '목': '식상(표현/창의)', '화': '재성(재물/현실감)', '토': '관성(규율/책임)', '금': '인성(학습/지혜)' },
        };
        const weakSipseong = IL_OH_SIPSEONG[ilOh]?.[weakOh as Ohaeng];
        if (weakSipseong && bal[weakOh as Ohaeng] <= 1.5) {
          crossHealthNotes.push(
            `${sajuResult.ilgan}일간 기준 ${OHAENG_KR[weakOh]}는 ${weakSipseong}에 해당합니다. `
            + `→ 이 기운이 극도로 부족하면 ${weakSipseong.includes('식상') ? '자기 표현·소통 능력이 부족하고, 감정을 안에 가둬두기 쉽습니다' : weakSipseong.includes('재성') ? '돈 관리·현실 감각이 약할 수 있고, 재물을 모으기 어려운 구조입니다' : weakSipseong.includes('관성') ? '자기 통제·규율이 약해져 생활이 불규칙해지기 쉽습니다' : weakSipseong.includes('인성') ? '학습 의지·자기 돌봄이 약해져 건강 관리에 소홀해지기 쉽습니다' : '자아 에너지가 약해 쉽게 지치고 무기력해질 수 있습니다'}. `
            + `이것이 건강 문제의 근본 원인일 수 있어요.`
          );
        }

        if (crossHealthNotes.length > 0) {
          answer += `【🕸️ 오행 교차 검증 — 단순 나열이 아닌 연결 분석】\n`;
          crossHealthNotes.forEach(note => { answer += `• ${note}\n`; });
          answer += '\n';
        }
      }

      // ★ 정신건강 체질 분석 (오행 + 십성 기반)
      {
        const MENTAL_OHAENG: Record<string, string> = {
          '목': '목(木) 기운 부족 → 우울감·의욕 저하·무기력증 경향. 목은 생장의 기운으로, 부족하면 삶의 추진력과 의욕이 떨어지고 쉽게 지칩니다. 산림욕·규칙적 야외활동·충분한 수면이 도움됩니다.',
          '화': '화(火) 기운 부족 → 불안·공황·대인기피 경향. 화는 기쁨의 기운으로, 부족하면 사회적 관계가 위축됩니다. 명상·요가·복식호흡·따뜻한 환경이 도움됩니다.',
          '토': '토(土) 기운 부족 → 걱정·강박·불안정한 사고 경향. 토는 중심의 기운으로, 부족하면 마음의 안정이 흔들립니다. 저널링·산책·규칙적 생활이 도움됩니다.',
          '금': '금(金) 기운 부족 → 슬픔·비관적 사고·결단력 부족 경향. 금은 결단의 기운으로, 부족하면 우유부단하고 슬퍼집니다. 사회적 교류·취미활동·호흡 운동이 도움됩니다.',
          '수': '수(水) 기운 부족 → 공포·두려움·위축감 경향. 수는 지혜의 기운으로, 부족하면 겁이 많아지고 새로운 시도를 두려워합니다. 작은 성취 쌓기·족욕·따뜻한 환경이 도움됩니다.',
        };
        const MENTAL_EXCESS: Record<string, string> = {
          '목': '목(木) 과다 → 분노·짜증·과민반응 경향. 감정 폭발이 잦고 인간관계에서 마찰이 생깁니다.',
          '화': '화(火) 과다 → 초조·과도한 흥분·불면 경향. 항상 들뜬 상태라 쉽게 지치고 번아웃이 옵니다.',
          '토': '토(土) 과다 → 걱정·강박·같은 생각 반복 경향. 잠들기 어렵고 사소한 일에 집착합니다.',
          '금': '금(金) 과다 → 완벽주의·자기비판·만성 스트레스 경향. 실수를 용납하지 못하고 자책이 심합니다.',
          '수': '수(水) 과다 → 우울·감정 과민·불면 경향. 감정의 파도에 휩쓸리기 쉽습니다.',
        };
        const domOhM = sajuResult.dominantOhaeng as Ohaeng;
        const domBalM = sajuResult.ohaengBalance[domOhM];
        answer += `【🧠 정신건강 체질 분석 (오행 기반)】\n`;
        answer += `${MENTAL_OHAENG[weakOh]}\n`;
        if (domOhM && domBalM >= 4 && domOhM !== weakOh) {
          answer += `${MENTAL_EXCESS[domOhM]}\n`;
        }
        answer += '\n';
      }

      answer += `【추천 운동】\n${hd.exercise}\n\n`;
      answer += `【추천 음식/보양식】\n${hd.food}\n\n`;
      answer += `【계절별 건강 주의】\n${hd.season}\n\n`;

      // 안전 주의사항 (운전조심, 차조심, 물조심, 불조심)
      answer += `【⚠️ 안전 주의사항 (조심해야 할 것)】\n${hd.danger}\n`;

      // 대운 기반 건강 상세
      if (currentDaeun) {
        const daeunOh = CHEONGAN_OHAENG[currentDaeun.cheongan];
        answer += `\n【현재 건강운 (대운 ${currentDaeun.cheongan}${currentDaeun.jiji}, ${currentStage}운, 에너지 ${currentStageEnergy}/10)】\n`;
        if (currentStageEnergy >= 7) {
          answer += '체력이 좋은 시기이지만, 과신하지 말고 정기 검진은 유지하세요. 과로와 스트레스가 누적되면 한꺼번에 무너질 수 있습니다.\n';
        } else if (currentStageEnergy >= 4) {
          answer += '보통의 건강 상태입니다. 규칙적인 운동과 7시간 이상 수면이 중요합니다. 무리한 음주나 야근을 줄이세요.\n';
        } else {
          answer += '에너지가 낮은 시기입니다. 반드시 건강 검진을 받으시고, 충분한 휴식과 영양 보충을 우선하세요. 큰 수술이나 무리한 활동은 피하세요.\n';
        }
        // 대운 오행이 건강에 미치는 구체적 영향
        if (daeunOh === gisinOh) {
          answer += `⚠️ 현재 대운이 기신(${OHAENG_KR[gisinOh]}) 기운이라 건강에 불리합니다! 위 취약 부위를 특히 주의하고, 정기 검진을 반드시 받으세요.\n`;
        } else if (daeunOh === sajuResult.yongsin) {
          answer += `✅ 현재 대운이 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운이라 건강에 유리합니다. 이 시기에 체력을 비축해두세요.\n`;
        }

        // 12운성별 건강 위험도
        if (['사', '병', '묘'].includes(currentStage)) {
          answer += `🚨 현재 12운성이 "${currentStage}"운입니다. 에너지 하락기이므로 사고, 질병에 각별히 주의하세요. 무리한 활동 자제!\n`;
        } else if (currentStage === '목욕') {
          answer += `💡 현재 목욕운 — 감정 기복이 심해 스트레스성 질환(위장, 두통) 주의. 충동적 행동으로 인한 사고도 조심하세요.\n`;
        }
      }

      // 세운 건강 전망
      if (thisYearSeun) {
        answer += `\n【${new Date().getFullYear()}년 건강 전망】\n`;
        const seunOh = CHEONGAN_OHAENG[thisYearSeun.cheongan];
        if (seunOh === gisinOh) {
          answer += `올해 세운이 기신(${OHAENG_KR[gisinOh]}) 기운이라 건강에 불리한 해입니다. 상반기에 건강 검진을 받으세요.\n`;
        } else if (seunOh === sajuResult.yongsin) {
          answer += `올해 세운이 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운이라 건강 회복에 좋은 해입니다. 운동 습관을 만드세요.\n`;
        } else {
          answer += `올해는 특별히 좋거나 나쁘지 않습니다. 기본 건강 관리를 꾸준히 유지하세요.\n`;
        }
      }

      // ★ 건강 호전 시기 예측 + 병의 원인 분석 (교차분석)
      if (daeunResult) {
        const healthForecast = analyzeHealthForecast(sajuResult, daeunResult);
        if (healthForecast) {
          answer += `\n【🔍 병의 원인 — 왜 이 체질이 됐는가?】\n`;
          answer += `${healthForecast.cause}\n\n`;
          answer += `【📍 현재 상태】\n${healthForecast.currentStatus}\n\n`;
          answer += `【🔮 건강 호전/악화 시기 예측 (대운 기반)】\n`;
          healthForecast.recoveryPeriods.forEach((p: any) => {
            const icon = p.level === 'good' ? '🟢' : p.level === 'bad' ? '🔴' : '🟡';
            answer += `${icon} ${p.period}: ${p.description}\n`;
          });
          answer += `\n${healthForecast.overallAdvice}\n`;
        }
      }
    }
    // 성격/관계
    else if (/성격|관계|친구|가족|부모|자녀|형제|직장동료|대인/.test(q)) {
      answer = `🔮 대인관계와 숨겨진 성향을 중심으로 분석해 드릴게요.\n(기본 성격은 위쪽에 있는 '상세 성격 분석'을 참고해주세요!)\n\n`;
      answer += `【대인관계 궁합 가이드】\n`;
      answer += `• 💖 나를 끌어올려 주는 사람: ${OHAENG_KR[sajuResult.yongsin]}(${sajuResult.yongsin}) 기운을 가진 사람과 어울리면 큰 시너지 효과가 납니다.\n`;
      answer += `• ⚠️ 스트레스를 유발하는 사람: ${OHAENG_KR[sajuResult.gisin]}(${sajuResult.gisin}) 기운이 강한 사람 앞에서는 갈등을 피하고 한 발 물러서는 것이 좋습니다.\n`;
      // 십성별 관계 스타일
      const relMonthSip = sajuResult.sipseongs.month;
      if (['비견', '겁재'].includes(relMonthSip)) {
        answer += `\n• 사회적 관계 스타일: ${relMonthSip}이 월주에 있어 동등한 관계를 추구합니다. 위계적인 관계보다 수평적 파트너십에서 능력을 발휘합니다.`;
      } else if (['식신', '상관'].includes(relMonthSip)) {
        answer += `\n• 사회적 관계 스타일: ${relMonthSip}이 월주에 있어 자유롭고 창의적인 관계를 선호합니다. 규칙에 얽매이지 않는 유연한 환경이 맞습니다.`;
      } else if (['편재', '정재'].includes(relMonthSip)) {
        answer += `\n• 사회적 관계 스타일: ${relMonthSip}이 월주에 있어 실리적인 관계를 중시합니다. 사업적 파트너나 실질적 도움을 주는 인간관계가 발달합니다.`;
      } else if (['편관', '정관'].includes(relMonthSip)) {
        answer += `\n• 사회적 관계 스타일: ${relMonthSip}이 월주에 있어 조직 안에서의 역할을 중시합니다. 리더십이 있고, 규칙적인 관계에서 편안함을 느낍니다.`;
      } else if (['편인', '정인'].includes(relMonthSip)) {
        answer += `\n• 사회적 관계 스타일: ${relMonthSip}이 월주에 있어 지적·정신적 교류를 중시합니다. 깊은 대화가 가능한 소수의 친구를 선호합니다.`;
      }
      answer += `\n\n아래 "대인관계·인간관계" 섹션에서 더 상세한 분석을 확인하세요.`;
    }
    // 바람/외도
    else if (/바람|외도|불륜|도화|유혹|다른\s*사람|의심/.test(q)) {
      // 나이별 분기
      if (currentAge <= 12) {
        // 초딩 — 반말 + 웃긴 돌려말하기
        answer = `═══ 🤔 다른 친구 운?! ═══\n\n`;
        answer += `야 ${currentAge}살이 벌써 이런 걸 물어봐?? ㅋㅋㅋ 😂\n\n`;
        answer += `좋아좋아~ 솔직하게 물어보는 건 좋은 거야!\n\n`;
        answer += `【💭 넌 다른 친구도 만나는 타입?】\n`;
        const kidHSip = sajuResult.sipseongs.hour;
        const kidMSip = sajuResult.sipseongs.month;
        answer += ['편재', '상관', '겁재'].includes(kidMSip) ?
          `넌 호기심이 많은 편이라 이 친구 저 친구 다 만나고 싶은 타입일 수 있어! 🦋\n새로운 애들한테 먼저 말 거는 스타일이지? ㅋㅋ\n` :
          ['정관', '정인', '정재'].includes(kidMSip) ?
          `넌 한번 친해지면 그 친구만 쭉 좋아하는 의리파 타입일 수 있어! 👊\n베프 한명이면 충분한 스타일이지?\n` :
          `넌 적당히 친구 만나는 타입이야~ 특별히 바람둥이(?)는 아닌 것 같아 ㅋ\n`;
        answer += `\n【🌟 마무리】\n`;
        answer += `지금은 바람 걱정할 나이가 아니야~ 친구랑 사이좋게 지내고, 맛있는 거 먹고, 재밌게 놀면 돼! 🎈\n`;
        answer += `나중에 크면 그때 다시 와~ 그때 진짜 바람끼 분석해줄게 ㅋㅋㅋ 😎`;
      } else if (currentAge < 20) {
        // 중고등학생
        answer = `═══ 이성관계 스타일 분석 ═══\n\n`;
        answer += `아직 어리니까 바람끼보다는 이성관계 스타일을 볼게요~\n\n`;
        const kidMSip2 = sajuResult.sipseongs.month;
        answer += ['편재', '상관', '겁재'].includes(kidMSip2) ?
          `호기심이 많고 이성에 대한 관심이 높은 편일 수 있어요. 다양한 친구를 만나보고 싶은 마음이 자연스러운 나이예요!\n` :
          `한 사람에게 집중하는 타입일 수 있어요. 진지하게 사람을 대하는 성격일 가능성이 높아요.\n`;
        answer += `\n지금은 공부하고 좋은 친구 만드는 게 가장 중요한 시기예요. 멋진 어른이 되면 좋은 인연이 알아서 찾아올 수 있어요! 💪`;
      } else if (currentAge >= 65) {
        answer = `═══ 부부 신뢰 · 동반자 분석 ═══\n\n`;
        answer += `이 나이에 가장 소중한 것은 오랜 세월 함께한 동반자와의 신뢰일 수 있습니다.\n`;
        answer += `용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 활용해 배우자와 함께하는 시간을 늘리고, 서로의 건강을 챙기는 것이 좋을 수 있어요.\n`;
        answer += `오랜 인연을 소중히 여기면 더 평화로운 노후를 보낼 수 있을 거예요.`;
      } else {
        answer = `═══ 사주 외도/바람끼 분석 ═══\n\n`;
        answer += `📋 일주: ${sajuResult.day.cheongan}${sajuResult.day.jiji} | 시주: ${sajuResult.hour.cheongan}${sajuResult.hour.jiji}\n`;
        answer += `📋 현재 상태: ${sajuResult.relationship === 'married' ? '기혼' : sajuResult.relationship === 'dating' ? '연애중' : '미혼'}\n\n`;
        const extHourSip = sajuResult.sipseongs.hour;
        const extMonthSip = sajuResult.sipseongs.month;
        const extRisky = ['편재', '상관', '겁재'];
        const extStable = ['정관', '정인', '정재'];
        const extRiskCnt = [extHourSip, extMonthSip].filter(s => extRisky.includes(s)).length;
        const extStableCnt = [extHourSip, extMonthSip].filter(s => extStable.includes(s)).length;
        answer += `【사주 구조상 바람끼 분석】\n`;
        if (extRiskCnt >= 2) {
          answer += `⚠️ 바람끼 수준: 높을 수 있음\n`;
          answer += `편재·상관·겁재가 겹쳐 자극적인 만남에 이끌리기 쉬운 구조일 수 있습니다. 새로운 이성에게 호기심이 강하고, 감정적으로 흔들릴 가능성이 있어요. 의식적으로 가정/파트너에게 집중하는 노력이 필요할 수 있습니다.\n\n`;
        } else if (extRiskCnt === 1) {
          answer += `바람끼 수준: 약간 있을 수 있음\n`;
          answer += `평소에는 안정적이지만, 스트레스나 권태기에 외부 유혹에 약해질 수 있는 편이에요. 취미나 운동으로 에너지를 건전하게 발산하면 좋을 수 있습니다.\n\n`;
        } else if (extStableCnt >= 1) {
          answer += `바람끼 수준: 낮은 편 ✓\n`;
          answer += `정관·정인·정재가 있어 원칙적이고 가정에 충실한 성향일 가능성이 높습니다.\n\n`;
        } else {
          answer += `바람끼 수준: 보통\n`;
          answer += `특별한 외도 성향은 없는 편이지만, 환경과 상황에 따라 달라질 수 있습니다.\n\n`;
        }
        answer += `【현재 대운과 도화운】\n`;
        if (currentStage === '목욕') {
          answer += `⚠️ 현재 "목욕"운으로 이성에 대한 관심이 높아질 수 있는 시기예요! 외적 변화에 관심이 생기고, 새로운 이성이 다가올 가능성이 있습니다.\n`;
        } else if (['장생', '관대'].includes(currentStage)) {
          answer += `에너지가 활발해 사교 활동이 많아질 수 있는 시기예요. 의도치 않게 이성과 가까워질 수 있으니 선을 지키는 게 좋을 수 있습니다.\n`;
        } else {
          answer += `현재 대운에서 특별한 도화운은 없는 편이에요. 비교적 안정적인 시기일 수 있습니다.\n`;
        }
        if (thisYearSeun) {
          answer += `\n【${thisYearSeun.year}년 이성운】\n${thisYearSeun.love}`;
        }
      }
    }
    // 자녀/출산
    else if (/자녀|아이|아들|딸|출산|임신|태어|2세/.test(q)) {
      const hc = sajuResult.hasChildren;
      answer = hc ? `═══ 사주 자녀운 분석 ═══\n\n` : `═══ 사주 자녀/출산 분석 ═══\n\n`;
      answer += `📋 시주: ${sajuResult.hour.cheongan}${sajuResult.hour.jiji} (시주 = ${hc ? '자녀궁 · 가정운' : '자녀궁 · 미래운'})\n`;
      answer += `📋 시주 십성: ${sajuResult.sipseongs.hour}\n\n`;
      const childSip = sajuResult.sipseongs.hour;
      if (hc) {
        // 자녀가 있는 경우 — 자녀 교육/양육/관계 초점
        answer += `【자녀 관계 분석】\n`;
        if (['식신', '정관', '정인'].includes(childSip)) {
          answer += `시주에 ${childSip}이 있어 자녀와의 관계가 좋은 편입니다. `;
          if (childSip === '식신') answer += `자녀가 건강하고 재능이 넘치며, 부모에게 기쁨을 줍니다. 자녀의 예술·창작 활동을 격려해주세요.\n\n`;
          else if (childSip === '정관') answer += `자녀가 예의 바르고 사회적으로 인정받을 가능성이 높습니다. 자녀의 규칙적인 생활 습관을 응원해주세요.\n\n`;
          else answer += `자녀가 학문적으로 뛰어나고 부모를 존경합니다. 학습 환경을 잘 만들어주면 큰 성과가 있습니다.\n\n`;
        } else if (['편관', '상관'].includes(childSip)) {
          answer += `시주에 ${childSip}이 있어 자녀와 의견 충돌이 있을 수 있지만, 자녀가 개성이 강하고 독립적입니다. `;
          if (childSip === '상관') answer += `자녀가 창의적이고 반항기가 있을 수 있지만, 전문 분야에서 뛰어난 재능을 발휘합니다. 통제보다 자율성을 존중하세요.\n\n`;
          else answer += `자녀가 리더십이 강하고 자기 주장이 뚜렷합니다. 존중해주면서 이끌어주세요.\n\n`;
        } else {
          answer += `시주에 ${childSip}이 있습니다. 자녀와의 관계에서 꾸준한 소통이 중요합니다.\n\n`;
        }
      } else {
        // 자녀가 없는 경우 — 출산 계획/미래 전망 초점
        answer += `【자녀운 전망】\n`;
        if (['식신', '정관', '정인'].includes(childSip)) {
          answer += `시주에 ${childSip}이 있어 자녀운이 좋은 편입니다. `;
          if (childSip === '식신') answer += `자녀가 건강하고 재능이 넘치며, 부모에게 기쁨을 줍니다. 특히 예술이나 먹는 것에 관련된 재능이 있을 수 있습니다.\n\n`;
          else if (childSip === '정관') answer += `자녀가 예의 바르고 사회적으로 인정받을 가능성이 높습니다. 안정적인 직업을 가질 자녀입니다.\n\n`;
          else answer += `자녀가 학문적으로 뛰어나고 부모를 존경합니다. 공부를 잘하는 자녀를 둘 가능성이 높습니다.\n\n`;
        } else if (['편관', '상관'].includes(childSip)) {
          answer += `시주에 ${childSip}이 있어 자녀와 갈등이 있을 수 있지만, 자녀가 개성이 강하고 독립적입니다. `;
          if (childSip === '상관') answer += `자녀가 창의적이고 반항기가 있을 수 있지만, 전문 분야에서 뛰어난 재능을 발휘합니다.\n\n`;
          else answer += `자녀가 리더십이 강하고 자기 주장이 뚜렷합니다. 존중해주면서 이끌어주세요.\n\n`;
        } else {
          answer += `시주에 ${childSip}이 있습니다. 자녀와의 관계에서 소통이 중요합니다.\n\n`;
        }
      }
      answer += `💡 자녀 소통 TIP: "잘했어", "거봐 엄마 말 들으니까 되지?"는 부모 중심의 '평가'예요. "와, 완전 놀랍다! 어떻게 그런 생각을 다 했어?"라는 순수한 감탄이 아이를 삶의 주체로 세워줘요. `;
      answer += childSip === '상관' ? `상관 기운이 있는 자녀는 특히 통제보다 독립된 주체로 인정해주는 게 중요해요. 제주도 돌담처럼 실수할 틈, 방황할 공간을 허락해주세요 — 틈이 있어야 오히려 무너지지 않아요. ` :
        childSip === '편관' ? `편관 기운의 자녀에게 강하게 나가면 더 세게 반발할 수 있어요. 예의를 갖춰 하나의 인격체로 대해보세요. ` : '';
      answer += `아이에게 쏟던 에너지를 잠시 거두고 부모 자신이 좋아하는 것을 하며 여유를 찾으면, 짜증 대신 편안한 말투로 다가갈 수 있어요.\n\n`;
      if (!hc) {
        answer += `【출산 적기】\n`;
        const goodChildStages = daeunResult.pillars.filter((p: any) => p.startAge <= 50 && ['장생', '관대', '건록', '제왕'].includes(p.twelveStage));
        if (goodChildStages.length > 0) {
          answer += goodChildStages.map((p: any) => `• ${p.startAge}~${p.endAge}세 (${p.twelveStage}운) — 에너지가 높아 출산과 양육에 적합`).join('\n') + '\n';
        } else {
          answer += `대운에서 특별히 출산에 좋은 시기가 표시되지 않지만, 건강 관리를 잘 하면 언제든 좋은 결과를 기대할 수 있습니다.\n`;
        }
      } else {
        answer += `【자녀 성장 시기별 조언】\n`;
        const currentAge = daeunResult.currentAge || 30;
        if (currentAge < 35) {
          answer += `현재 나이대에서는 자녀가 어린 시기일 가능성이 높습니다. 양육에 에너지를 쏟되 자신의 건강도 챙기세요.\n`;
        } else if (currentAge < 50) {
          answer += `자녀가 성장기·사춘기일 가능성이 높습니다. 대화와 경청이 가장 중요한 시기입니다. 자녀의 진로를 함께 고민하되, 강요보다 탐색을 도와주세요.\n`;
        } else {
          answer += `자녀가 성인이 되는 시기입니다. 독립을 응원하되, 든든한 버팀목이 되어주세요. 필요할 때 조언을 구할 수 있는 관계를 유지하세요.\n`;
        }
      }
      answer += `\n💡 자녀 앞에서 배우자 이야기할 때 주의: 부부 사이가 아무리 밉더라도 아이 앞에서 "네 아빠(엄마) 때문에 못 살겠다"라고 하면, 아이 마음에 저항감이 생겨 성장에 큰 장애가 될 수 있어요. 용돈을 줄 때도 "아빠가 주지 말라 했는데 엄마가 몰래 주는 거야"보다 "아빠가 힘들게 벌어온 돈이니 아껴 써라"가 훨씬 좋아요. 아빠를 나쁘게 말할수록 아이는 오히려 미워하는 아빠의 모습을 닮고, 긍정적으로 말해줄수록 엄마의 좋은 모습을 닮게 될 수 있어요.\n`;
      answer += `💡 혹시 배우자를 먼저 보낸 분이라면: "너희 아빠(엄마)는 참 좋고 훌륭한 사람이었단다"라고 자랑스럽게 이야기해 주세요. 아이는 그 사랑과 자랑을 먹고 자라며 훌륭한 사람으로 성장해요. 부재 자체가 상처가 아니라, 부모가 위축되어 있을 때 아이에게 상처가 될 수 있어요. 아빠와 엄마의 사랑 이야기를 자주 들려주고, 제삿날이나 산소를 함께 찾아가세요. 제사는 상실을 확인하는 의식이 아니라 보이지 않는 사랑의 연결고리를 이어가는 과정이에요 — 아이 마음속에 아빠가 늘 긍정적으로 살아 있다면, 그것은 곧 아빠가 곁에 있는 것과 같아요. 그리고 새로운 만남이나 사회생활에서 아이의 존재를 절대 숨기지 마세요 — 엄마가 아이를 숨기면 아이는 자신이 방해되는 존재라 여기고 깊은 상처를 받을 수 있어요. 사별이든 이혼이든, 아이가 있다는 건 어떤 죄도 잘못도 아니에요. 혼자 키운다는 사실에 열등감을 갖지 마세요. 내 아이라는 사실에 당당하고, 끝까지 책임지겠다는 마음을 가질 때 아이는 엄마를 세상 최고로 여기며 상처 없이 자랄 수 있어요.\n`;
    }
    // 이사/이동
    else if (/이사|이동|이민|해외|유학|여행|방향/.test(q)) {
      answer = `═══ 사주 이사/이동 분석 ═══\n\n`;
      answer += `📋 용신: ${OHAENG_KR[sajuResult.yongsin]} | 기신: ${OHAENG_KR[sajuResult.gisin]}\n\n`;
      const DIR_MAP: Record<string, string> = { '목': '동쪽', '화': '남쪽', '토': '중앙(현재 위치)', '금': '서쪽', '수': '북쪽' };
      answer += `【이사/이동 방향】\n`;
      answer += `좋은 방향: ${DIR_MAP[sajuResult.yongsin]} (${OHAENG_KR[sajuResult.yongsin]} 기운)\n`;
      answer += `피할 방향: ${DIR_MAP[sajuResult.gisin]} (${OHAENG_KR[sajuResult.gisin]} 기운)\n\n`;
      answer += `【이사 적기】\n`;
      if (currentStageEnergy >= 7) {
        answer += `현재 대운 에너지가 높아 이사/이동에 좋은 시기입니다. 새 환경에서 좋은 결과를 기대할 수 있습니다.\n\n`;
      } else if (currentStageEnergy >= 4) {
        answer += `이사는 가능하지만, 충분히 준비한 후 움직이세요. 급하게 결정하지 마세요.\n\n`;
      } else {
        answer += `지금은 이사보다 현재 위치에서 안정을 찾는 것이 좋습니다. 꼭 이사해야 한다면 용신 방향(${DIR_MAP[sajuResult.yongsin]})을 선택하세요.\n\n`;
      }
      answer += `【해외운】\n`;
      const hasYeokma = ['편관', '편재', '상관'].includes(sajuResult.sipseongs.month);
      if (hasYeokma) {
        answer += `월주에 ${sajuResult.sipseongs.month}이 있어 이동/해외 활동에 유리한 사주입니다. 해외 출장, 무역, 유학 등에서 좋은 결과를 기대할 수 있습니다.\n`;
      } else {
        answer += `특별한 해외운은 강하지 않지만, 용신 방향의 나라나 도시를 선택하면 좋은 기운을 받을 수 있습니다.\n`;
      }

      // ★ 이사운↔건강 교차분석
      {
        const isaWeakOh = sajuResult.weakestOhaeng as Ohaeng;
        const isaWeakBal = sajuResult.ohaengBalance[isaWeakOh];
        if (isaWeakBal <= 1.5) {
          const OHAENG_DIR: Record<string, string> = { '목': '동쪽', '화': '남쪽', '토': '중앙', '금': '서쪽', '수': '북쪽' };
          const healthDir = OHAENG_DIR[isaWeakOh];
          answer += `\n【🏥 이사↔건강 교차분석】\n`;
          answer += `${OHAENG_KR[isaWeakOh]} 기운이 ${isaWeakBal}점으로 극도로 부족합니다.\n`;

          // 용신 방향과 건강 보충 방향이 같은지
          if (sajuResult.yongsin === isaWeakOh) {
            answer += `✅ 다행히 용신 방향(${healthDir})이 곧 건강 보충 방향입니다! ${healthDir}으로 이사하면 운과 건강 모두에 도움이 됩니다.\n`;
          } else {
            answer += `용신 방향은 ${OHAENG_DIR[sajuResult.yongsin]}이고, 건강 보충 방향은 ${healthDir}입니다. `;
            answer += `두 방향이 다르므로, 이사 시 운(용신)과 건강(부족 오행) 중 우선순위를 정해야 합니다. `;
            answer += `건강이 심각하다면 ${healthDir} 방향을 우선 고려하세요.\n`;
          }

          // 건강 상태별 이사 주의사항
          if (isaWeakOh === '화') {
            answer += `⚠️ 공황·불안 증상이 있으면: 장거리 이사(타 지역, 해외)는 큰 스트레스입니다. 현재 거주지 근처에서 방향만 맞추는 것이 안전합니다. 비행기 이용이 어려우면 해외 유학/이민은 신중히 판단하세요.\n`;
          } else if (isaWeakOh === '금') {
            answer += `⚠️ 호흡기가 약하므로: 미세먼지가 심한 도시, 공업지대 근처는 절대 피하세요. 공기 좋은 곳(산 근처, 신도시)이 건강에 도움됩니다.\n`;
          } else if (isaWeakOh === '수') {
            answer += `⚠️ 신장·허리가 약하므로: 높은 층수(엘리베이터 없는 곳), 지하, 습한 환경은 피하세요. 따뜻하고 건조한 환경이 좋습니다.\n`;
          } else if (isaWeakOh === '목') {
            answer += `⚠️ 간·근육이 약하므로: 녹지가 가까운 곳, 조용한 주거 환경이 건강에 도움됩니다. 시끄럽고 복잡한 번화가는 스트레스를 키웁니다.\n`;
          } else if (isaWeakOh === '토') {
            answer += `⚠️ 위장이 약하므로: 규칙적 식사가 가능한 환경(직장 가까운 곳, 배달·마트 접근성 좋은 곳)이 중요합니다. 식사 시간이 불규칙해지는 출퇴근 거리는 피하세요.\n`;
          }
        }
      }
    }
    // 학업/시험/자격증
    else if (/학업|시험|공부|수능|합격|자격증|고시|면접/.test(q)) {
      answer = `═══ 사주 학업/시험 분석 ═══\n\n`;
      answer += `📋 일간: ${sajuResult.ilgan}일간 | 월주 십성: ${sajuResult.sipseongs.month}\n\n`;
      const studySip = sajuResult.sipseongs.month;
      answer += `【학업 적성】\n`;
      if (['정인', '편인'].includes(studySip)) {
        answer += `인성(정인/편인)이 월주에 있어 학업운이 매우 좋습니다! 공부에 재능이 있고, 자격증이나 학위가 인생에 큰 도움이 됩니다.\n`;
        if (studySip === '정인') answer += `특히 정통 학문(법, 의학, 교육 등)에 적성이 있습니다.\n\n`;
        else answer += `비주류 학문이나 특수 분야(IT, 철학, 대체의학)에서 두각을 나타낼 수 있습니다.\n\n`;
      } else if (['식신', '상관'].includes(studySip)) {
        answer += `식상이 있어 창의적 사고가 뛰어납니다. 암기식 공부보다 이해 위주, 실습 위주 학습이 맞습니다.\n\n`;
      } else {
        answer += `학업 성향은 보통이지만, 꾸준한 노력으로 충분히 좋은 결과를 낼 수 있습니다. 용신(${OHAENG_KR[sajuResult.yongsin]}) 관련 분야를 공부하면 더 효과적입니다.\n\n`;
      }
      answer += `【시험/합격운】\n`;
      if (currentStageEnergy >= 7) {
        answer += `현재 대운 에너지가 높아 시험 합격 가능성이 높습니다! 집중력과 체력이 모두 좋은 시기이니, 지금 도전하세요.\n`;
      } else if (currentStageEnergy >= 4) {
        answer += `합격 가능성은 보통입니다. 남들보다 2배 노력하면 반드시 합격할 수 있습니다. 꾸준함이 핵심입니다.\n`;
      } else {
        answer += `에너지가 낮아 집중력이 떨어질 수 있습니다. 컨디션 관리를 최우선으로 하고, 무리하지 말고 꾸준히 진행하세요.\n`;
      }
    }
    // 재복/복/팔자
    else if (/재복|복|팔자|운명|타고난|전생|사주가\s*좋|사주가\s*나쁜|황금기|전성기|몇\s*살/.test(q)) {
      answer = `═══ 사주 종합 운명 분석 ═══\n\n`;
      answer += `📋 일간: ${sajuResult.ilgan} (${OHAENG_KR[ilOh]} 기운)\n`;
      answer += `📋 일주: ${sajuResult.day.cheongan}${sajuResult.day.jiji}\n\n`;
      // 재복
      const fbMonthSip = sajuResult.sipseongs.month;
      const fbHourSip = sajuResult.sipseongs.hour;
      answer += `【재복(財福) — 돈복이 있는가?】\n`;
      if (['정재', '편재'].includes(fbMonthSip) || ['정재', '편재'].includes(fbHourSip)) {
        answer += `✓ 재성이 사주에 있어 재복이 있습니다! `;
        if (fbMonthSip === '편재') answer += `특히 편재가 월주에 있어 큰 돈을 벌 수 있는 구조입니다. 사업이나 투자에서 성과를 기대할 수 있습니다.\n\n`;
        else answer += `꾸준히 모으면 큰 자산을 만들 수 있는 구조입니다.\n\n`;
      } else {
        answer += `직접적인 재성은 약하지만, 용신(${OHAENG_KR[sajuResult.yongsin]})을 활용하면 재물을 끌어올 수 있습니다. 노력형 재복입니다.\n\n`;
      }
      // 건강복
      answer += `【건강복 — 건강 걱정 해야 하는가?】\n`;
      const ohBalance = sajuResult.ohaengBalance;
      const ohTotal = Object.values(ohBalance).reduce((a, b) => a + b, 0);
      const ohMax = Math.max(...Object.values(ohBalance));
      const ohMin = Math.min(...Object.values(ohBalance));
      if (ohMax / ohTotal < 0.35 && ohMin / ohTotal > 0.1) {
        answer += `오행이 비교적 균형 잡힌 편이라 건강 체질일 수 있어요. 큰 건강 걱정 없이 지낼 수 있지만, 과로와 스트레스 관리는 기본이에요.\n\n`;
      } else {
        answer += `${sajuResult.weakestOhaeng}(${OHAENG_KR[sajuResult.weakestOhaeng]}) 기운이 부족한 편이라 관련 장기에 주의가 필요할 수 있어요. 정기 검진과 예방이 도움이 될 수 있습니다.\n\n`;
      }
      // 황금기
      answer += `【인생 황금기 — 몇 살이 전성기인가?】\n`;
      const fbBestDaeun = daeunResult.pillars
        .filter((p: any) => p.startAge <= 100)
        .map((p: any) => {
          let score = TWELVE_STAGE_DATA[p.twelveStage as keyof typeof TWELVE_STAGE_DATA].energy;
          if (CHEONGAN_OHAENG[p.cheongan] === sajuResult.yongsin || JIJI_OHAENG[p.jiji] === sajuResult.yongsin) score += 2;
          if (CHEONGAN_OHAENG[p.cheongan] === sajuResult.gisin || JIJI_OHAENG[p.jiji] === sajuResult.gisin) score -= 2;
          return { ...p, score: Math.max(1, Math.min(10, score)) };
        })
        .sort((a, b) => b.score - a.score);
      if (fbBestDaeun.length >= 3) {
        answer += `🥇 1순위: ${fbBestDaeun[0].startAge}~${fbBestDaeun[0].endAge}세 (${fbBestDaeun[0].twelveStage}운, 점수 ${fbBestDaeun[0].score}/10)\n`;
        answer += `🥈 2순위: ${fbBestDaeun[1].startAge}~${fbBestDaeun[1].endAge}세 (${fbBestDaeun[1].twelveStage}운, 점수 ${fbBestDaeun[1].score}/10)\n`;
        answer += `🥉 3순위: ${fbBestDaeun[2].startAge}~${fbBestDaeun[2].endAge}세 (${fbBestDaeun[2].twelveStage}운, 점수 ${fbBestDaeun[2].score}/10)\n\n`;
      }
      // 평생 고생하는 사주인가?
      answer += `【평생 일해야 하는 사주인가?】\n`;
      const avgEnergy = fbBestDaeun.reduce((s, p) => s + p.score, 0) / (fbBestDaeun.length || 1);
      if (avgEnergy >= 6) {
        answer += `전체 대운 평균 에너지가 높은 편이라 인생 전반적으로 좋은 흐름일 가능성이 높아요. 노력하면 보상을 받을 수 있는 사주일 수 있습니다.\n\n`;
      } else if (avgEnergy >= 4) {
        answer += `좋은 시기와 어려운 시기가 교차할 수 있어요. 황금기에 집중적으로 자산을 쌓고, 어려운 시기를 대비하면 편안한 노후를 보낼 수 있을 거예요.\n\n`;
      } else {
        answer += `고생이 좀 있을 수 있는 사주이지만, 역경을 이겨내는 힘도 함께 있을 수 있어요. 용신(${OHAENG_KR[sajuResult.yongsin]})을 적극 활용하면 운이 크게 바뀔 가능성이 있습니다.\n\n`;
      }
      // 앞으로 어떻게 해야 하는지
      answer += `【인생 전략 — 앞으로 어떻게 헤쳐나가야 하는가?】\n`;
      answer += `• 용신(${OHAENG_KR[sajuResult.yongsin]}) 방향의 직업, 색깔, 방위를 활용하면 좋을 수 있어요.\n`;
      answer += `• 기신(${OHAENG_KR[sajuResult.gisin]}) 관련 환경/사람은 되도록 피하는 게 나을 수 있어요.\n`;
      if (currentStageEnergy >= 7) answer += `• 지금이 기회일 수 있어요! 적극적으로 도전해볼 만합니다.\n`;
      else if (currentStageEnergy >= 4) {
        const wBal = sajuResult.ohaengBalance[sajuResult.weakestOhaeng as Ohaeng];
        if (wBal <= 1 && sajuResult.weakestOhaeng === '화') {
          answer += `• 현재는 준비 기간일 수 있어요. 건강(특히 심혈관·정신 건강)을 먼저 챙기면서, 자기 공간에서 할 수 있는 온라인 학습·자격증·콘텐츠 등으로 실력을 쌓으면 좋을 수 있습니다.\n`;
        } else if (wBal <= 1 && sajuResult.weakestOhaeng === '목') {
          answer += `• 현재는 준비 기간일 수 있어요. 체력 회복을 최우선으로 하면서, 무리하지 않는 범위에서 실력을 쌓아가면 좋을 수 있습니다.\n`;
        } else {
          answer += `• 현재는 준비 기간일 수 있어요. 실력을 쌓고 인맥을 넓히면 좋을 수 있습니다.\n`;
        }
      }
      else answer += `• 지금은 인내의 시기일 수 있어요. 건강과 가정을 우선하면서 다음 기회를 기다려보세요.\n`;
    }
    // 올해 운세
    else if (/올해|금년|2026|운세|운|흐름/.test(q)) {
      if (thisYearSeun) {
        // 나이별 레이블 적용
        const seunAge = currentAge;
        if (seunAge <= 12) {
          // 초딩 전용 헤더 — 한자어 없이 쉽게
          answer = `═══ ✨ ${thisYearSeun.year}년 너의 운세! ═══\n\n`;
          answer += `📋 올해는 ${thisYearSeun.animal}띠 해야!\n`;
          answer += `📋 운세 점수: ⭐ ${thisYearSeun.overallScore}/10점!\n`;
          answer += thisYearSeun.overallScore >= 7 ? ` 와~ 대박 좋은 해다!! 🎉\n\n` :
            thisYearSeun.overallScore >= 4 ? ` 보통이야~ 노력하면 더 좋아질 수 있어!\n\n` :
            ` 좀 힘들 수 있지만 걱정 마~ 이겨낼 수 있어! 💪\n\n`;
        } else {
          answer = `═══ ${thisYearSeun.year}년 운세 상세 ═══\n\n`;
          answer += `📋 세운: ${thisYearSeun.cheongan}${thisYearSeun.jiji} (${thisYearSeun.animal}띠 해)\n`;
          answer += `📋 12운성: ${thisYearSeun.twelveStage} | 종합 점수: ${thisYearSeun.overallScore}/10\n\n`;
          answer += `【총평】\n${thisYearSeun.description}\n\n`;
        }
        if (seunAge < 20) {
          const studentMonthSip = sajuResult.sipseongs.month;
          const studentHourSip = sajuResult.sipseongs.hour;
          const studentOh = sajuResult.day.cheonganOhaeng;
          const seunScore = thisYearSeun.overallScore;

          if (seunAge <= 12) {
            // 초등학생 수준 — 반말 + 웃긴 요소 + 사주 기반
            answer += `【🎒 선생님 운】\n`;
            if (seunScore >= 7) {
              answer += `오~ 넌 올해 선생님한테 칭찬 엄청 받을 운세다! 🌟\n`;
              answer += studentMonthSip === '정관' ? `규칙 잘 지키는 타입이라 선생님이 "역시 넌 달라~" 이럴 수도 있어 ㅋㅋ\n\n` :
                studentMonthSip === '식신' ? `발표할 때 뭔가 기발한 걸 말해서 선생님이 깜짝 놀랄 수도 있어! 🤩\n\n` :
                studentMonthSip === '상관' ? `근데 가끔 엉뚱한 소리 해서 선생님 빵 터지게 할 수도 있음 ㅋㅋㅋ 웃기다고 혼나지는 마!\n\n` :
                `네 숨은 매력을 선생님이 알아볼 거야. 발표 한번 해봐, 깜짝 놀랄걸? 😎\n\n`;
            } else if (seunScore >= 4) {
              answer += `보통이야~ 열심히 하면 칭찬받고, 장난치면 혼난다 ㅋㅋ\n`;
              answer += studentMonthSip === '상관' ? `특히 수업 시간에 친구한테 몰래 쪽지 보내다 걸리면... 끝장이야 조심해! 📝\n\n` :
                studentMonthSip === '겁재' ? `옆에 친구랑 누가 더 잘하나 시합하다가 선생님한테 "조용히 해!" 들을 수도 ㅋㅋ\n\n` :
                `수업 시간에 졸면 안 돼~ 눈 크게 뜨고 앞에 집중! 👀\n\n`;
            } else {
              answer += `야... 올해는 좀 조심해 😅 수업 시간에 딴짓하면 100% 걸린다!\n`;
              answer += studentMonthSip === '상관' ? `하고 싶은 말 참는 연습 좀 해! "선생님 그건 아닌데요" 이러면 골로 간다 ㅋㅋ\n\n` :
                studentMonthSip === '편관' ? `숙제 안 해가면 대참사 날 수 있어... 숙제는 꼭 해가자 알겠지? 📚\n\n` :
                `선생님 눈을 피할 수 있다고? 절대 못 피해~ 착하게 굴면 편해진다 ㅋ\n\n`;
            }

            answer += `【👫 친구 운】\n`;
            if (seunScore >= 7) {
              answer += `올해 넌 인싸다! 새 친구도 생기고, 친한 친구랑은 더 찐친 될 수 있어! 🤝\n`;
            } else if (seunScore >= 4) {
              answer += `친구 관계는 무난해~ 크게 싸울 일은 없을 거야.\n`;
            } else {
              answer += `올해 친구랑 다툴 수 있어... 😤 근데 먼저 "미안" 하면 금방 화해할 수 있어!\n`;
            }
            answer += studentHourSip === '겁재' ? `넌 승부욕이 좀 있어서 게임할 때 "내가 이겼다!!" 하면서 친구 기분 상하게 할 수도 ㅋㅋ 이기더라도 좀 봐줘~\n\n` :
              studentHourSip === '상관' ? `할 말 다 하는 스타일이라 친구가 "야 너 너무하다" 할 수도 있어. 말은 좀 돌려서 하자 ㅎㅎ\n\n` :
              studentHourSip === '식신' ? `넌 유머 감각이 있어서 친구들한테 인기 많을 거야! 급식 시간에 재밌는 얘기 해줘 ㅋㅋ 🍱\n\n` :
              studentHourSip === '비견' ? `넌 리더 기질이 있어! 조별과제 할 때 대장 역할 하면 딱이야 💪\n\n` :
              `${OHAENG_KR[sajuResult.yongsin]} 기운 가진 친구랑 특히 잘 맞을 수 있어! 그 친구랑 짝꿍 하면 대박 ㅋ\n\n`;

            answer += `【🏠 엄마아빠 운】\n`;
            if (seunScore >= 7) {
              answer += `올해는 부모님한테 칭찬 많이 받을 운세! "엄마는 블랙핑크, 아빠는 그냥 시민" 아니고 둘 다 최고야 ㅋㅋ 😊\n`;
              answer += `착하게 굴면 용돈 UP! 심부름 자청하면 더블 UP!! 엄마아빠 동결건조 시키고 싶을 만큼 소중하다고 말해봐~ 💰\n\n`;
            } else if (seunScore >= 4) {
              answer += `보통이야~ 시키는 거 잘하면 평화롭고, 안 하면... 알지? ㅋㅋ\n`;
              answer += `시험 성적표 가져가는 날은 좀 떨릴 수도 있어 😅\n\n`;
            } else {
              answer += `올해 엄마한테 혼날 확률 좀 있어... 😱 특히 방 정리 안 하면 대폭발!\n`;
              answer += `근데 걱정 마~ 혼나도 엄마아빠는 널 세상에서 제일 사랑해 ❤️ 잘못했을 땐 빨리 사과하면 돼!\n\n`;
            }

            answer += `【📚 공부 운】\n`;
            if (['정인', '편인'].includes(studentMonthSip)) {
              answer += `오~ 넌 공부 머리가 있는 편이야! 집중하면 성적이 확 올라갈 수 있어 🧠\n`;
              answer += `특히 ${studentOh === '금' ? '수학이나 과학' : studentOh === '수' ? '국어나 독서' : studentOh === '목' ? '영어나 새로운 과목' : studentOh === '화' ? '체육이나 발표' : '사회나 역사'}에서 빛날 수 있다!\n\n`;
            } else if (studentMonthSip === '식신') {
              answer += `넌 교과서보다 체험학습이나 만들기에서 더 잘할 타입이야! 🎨\n`;
              answer += `미술, 음악, 실과 시간에 "와 쟤 진짜 잘한다!" 소리 들을 수도 있어 ㅋ\n\n`;
            } else {
              answer += `꾸준히 하면 실력이 쑥쑥 늘어! 하루에 조금씩만 해도 나중에 엄청 달라져 📈\n`;
              answer += `${OHAENG_KR[sajuResult.yongsin]} 색 펜이나 노트 쓰면 집중력이 올라갈 수 있어! 한번 해봐~\n\n`;
            }

            answer += `【💪 건강 운】\n`;
            answer += seunScore >= 6 ? `건강은 걱정 없어! 밖에 나가서 신나게 뛰어놀아~ 🏃‍♂️\n` :
              `올해는 감기 조심해! 손 잘 씻고, 밥 골고루 먹어. 편식하면 키 안 큰다? ㅋㅋ 🥦\n`;
            answer += `${ilOh === '목' ? '눈이 좀 피로할 수 있어~ 핸드폰 너무 오래 보지 마! 📱' : ilOh === '화' ? '가끔 얼굴이 화끈거릴 수 있어. 물 많이 마셔! 💧' : ilOh === '토' ? '배 아플 수 있으니 찬 거 너무 많이 먹지 마! 아이스크림 적당히~ 🍦' : ilOh === '금' ? '감기 조심! 환절기에 겉옷 꼭 챙겨~ 🧥' : '추위를 좀 탈 수 있어. 따뜻하게 입고 다녀! 🧣'}\n\n`;

            // 마무리 — 훈훈 + 훈계 + 신조어
            answer += `【🌈 오늘의 한마디】\n`;
            const funnyEndings = [
              `넌 지금도 충분히 멋진 사람이야! 근데 숙제는 꼭 해가자 알겠지? ㅋㅋ 스트롱 스트롱💪`,
              `미래에 넌 엄청 대단한 사람이 될 수도 있어! 근데 그러려면 지금 수업 시간에 졸면 안 돼~ 할렐야루~ 😄`,
              `넌 특별한 사주를 가지고 태어났어! 자신감 가져~ 근데 양치는 꼭 해 ㅋㅋ 행복자베스✨`,
              `세상에 너 같은 사람은 딱 하나뿐이야! 소중한 너, 오늘도 난리자베스급 파이팅! 🌟`,
              `걱정하지 마~ 김풍스럽게 결국 잘 될 거야! 근데 게임은 좀 줄이자... 엄마 말이 맞을 때도 있거든 ㅎㅎ 🎮`,
              `중지정! 중요한 건 지치지 않는 정신! 넌 할 수 있어~ 근데 아침밥은 꼭 먹자! 💪🍚`,
              `힘든 일이 있어도 스트롱 스트롱💪! 운동 많이 된다~ 오늘도 화이팅! 🏃‍♂️`,
              `시험 기대컨 하지 말고 열심히 해봐! 기대 낮추면 놀라운 결과가 올 수도 있어~ 할렐야루~ 📝`,
              `피치 못할 사정이 있다고? 피자와 치킨 먹으러 가야 하는 사정? ㅋㅋㅋ 먹고 와서 공부하자! 🍕🍗`,
              `우리 엄마아빠 동결건조 시키고 싶다... 그만큼 소중한 가족이야! 오늘 집 가서 안아드려~ 🤗`,
              `숙제가 밤티라고? ㅋㅋ 괜찮아~ 밤티여도 제출하는 게 안 하는 것보다 100배 나아! 김풍스럽게 결국 잘 될 거야! 📚`,
              `공부하기 완너벌이라고? 나도 그래~ 근데 10분만 해보자! 10분 하다 보면 30분 하게 되거든~ 간바레 간바레! 💪`,
              `오늘 기분이 좋으면 나무 챌린지처럼 팔다리 흔들며 춤춰! 기분이 안 좋아도 춤추면 좋아져~ 할렐야루! 🌳💃`,
            ];
            const endIdx = (seunScore + (studentMonthSip.charCodeAt(0) % 5)) % funnyEndings.length;
            answer += `${funnyEndings[endIdx]}\n`;

            // 럭키 아이템
            const luckyItems: Record<string, string> = {
              '목': '🍀 오늘의 럭키 아이템: 초록색 지우개! 시험 칠 때 가져가면 행운이 올지도?',
              '화': '🔥 오늘의 럭키 아이템: 빨간색 볼펜! 중요한 거 적을 때 쓰면 대박날 수도!',
              '토': '🌻 오늘의 럭키 아이템: 노란색 간식! 시험 전에 먹으면 머리가 빙글빙글 돌아갈지도 ㅋ',
              '금': '⚡ 오늘의 럭키 아이템: 반짝이 스티커! 공책에 붙이면 공부 의욕이 UP!',
              '수': '💧 오늘의 럭키 아이템: 파란색 물병! 물 많이 마시면 머리가 맑아질 수 있어!',
            };
            answer += `\n${luckyItems[sajuResult.yongsin] || luckyItems['토']}`;

          } else if (seunAge <= 15) {
            // 중학생 수준 — 가능성 어투 + 훈훈 마무리
            answer += `【학교생활 운 🏫】\n`;
            if (seunScore >= 7) answer += `올해 학교생활이 전체적으로 순조로울 수 있어요! 시험 성적도 기대해볼 만합니다. `;
            else if (seunScore >= 4) answer += `보통 수준의 학교생활이 될 수 있어요. 꾸준히 노력하면 좋은 결과가 따라올 수 있어요. `;
            else answer += `올해는 학교에서 좀 힘든 시기가 올 수 있어요. 하지만 이겨내면 더 강해질 수 있어요! `;
            answer += studentMonthSip === '정관' ? `규율을 잘 지키는 스타일이라 선생님들에게 좋은 평가를 받을 수 있어요.\n\n` :
              studentMonthSip === '상관' ? `자기만의 생각이 뚜렷한 편이라 선생님과 의견이 부딪힐 수도 있어요. 존중의 태도가 중요해요!\n\n` :
              studentMonthSip === '식신' ? `동아리, 체육, 음악 등 활동에서 두각을 나타낼 수 있는 해예요.\n\n` :
              `용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 활용하면 학교생활이 더 잘 풀릴 수 있어요.\n\n`;

            answer += `【친구·선후배 운 👥】\n`;
            answer += seunScore >= 7 ? `인간관계가 좋은 해! 새로운 친구도 생기고 인기도 올라갈 수 있어요. ` :
              seunScore >= 4 ? `평소대로 무난한 관계가 유지될 수 있어요. ` :
              `친구나 선후배와 갈등이 생길 수도 있어요. 먼저 양보하면 오히려 더 친해질 수 있어요! `;
            answer += studentHourSip === '비견' || studentHourSip === '겁재' ? `경쟁심이 자극될 수 있으니, 비교보다 나만의 성장에 집중해보세요.\n\n` :
              `${OHAENG_KR[sajuResult.yongsin]} 기운의 친구와 함께하면 시너지가 날 수 있어요.\n\n`;

            answer += `【학업·시험 운 📖】\n`;
            answer += ['정인', '편인'].includes(studentMonthSip) ? `학문적 자질이 빛날 수 있는 해! 집중하면 성적이 올라갈 가능성이 높아요.\n\n` :
              `${studentOh === '목' ? '새로운 것을 배우는 속도가 빠를 수 있어서 예습이 효과적' : studentOh === '화' ? '관심 있는 과목에 집중하면 놀라운 성과가 나올 수 있' : studentOh === '토' ? '꾸준한 복습이 핵심! 매일 조금씩 하면 기말에 빛날 수 있' : studentOh === '금' ? '수학·과학 같은 논리 과목에서 강점을 보일 수 있' : '국어·예술 같은 감성 과목에서 재능을 발휘할 수 있'}어요.\n\n`;

            answer += `【건강 운 🏃】\n${thisYearSeun.health}\n\n`;
            answer += `【🌟 응원 한마디】\n지금 힘들어도 괜찮아요. 스트롱 스트롱💪 시험 결과가 밤티여도 괜찮아요 — 실패한 결과물을 웃으면서 공유할 수 있는 사람이 진짜 멋진 사람이에요. 김풍스럽게, 과정은 불안해도 결과는 좋을 수 있어요! 나만의 속도로 나아가면 돼요~ 할렐야루! 💪`;

          } else {
            // 고등학생/대학생 수준
            answer += `【학업·진로 운 📚】\n${thisYearSeun.career}\n\n`;
            answer += `【친구·인간관계 운 👫】\n${thisYearSeun.love}\n\n`;
            answer += `【용돈·경제 감각 💰】\n`;
            answer += seunScore >= 6 ? `올해는 아르바이트나 용돈 관리에서 좋은 감각을 보일 수 있는 해예요. ` : `지출이 좀 늘 수 있으니 계획적 소비가 필요할 수 있어요. `;
            answer += `${studentOh === '토' ? '알뜰하게 모으는 재능이 있는 편이에요' : studentOh === '금' ? '가성비를 잘 따지는 합리적 소비를 할 수 있는 타입이에요' : '감각적인 소비를 하는 편이지만 저축도 신경 쓰면 좋아요'}.\n\n`;
            answer += `【건강 운 🏃】\n${thisYearSeun.health}\n\n`;
            answer += `【🌟 응원 한마디】\n고민이 많은 건 성장하고 있다는 증거예요. 장항준적 사고로 가볍게! 결과에 역기대컨 걸어두면 작은 성과에도 "와 대박!" 할 수 있어요 — 만족의 하한선을 낮추는 것도 지혜입니다. 스트롱 스트롱💪 지금 이 순간을 동결건조 시키고 싶을 만큼 소중히 보내세요 💪`;
          }
        } else if (seunAge >= 60) {
          // 시니어: 정리/안정 톤
          answer += `【가족·인간관계 운】\n${thisYearSeun.love}\n\n`;
          answer += `【노후 자산관리】\n${thisYearSeun.money}\n\n`;
          answer += `【활동운 · 보람】\n`;
          answer += thisYearSeun.overallScore >= 6 ? `올해는 봉사 활동, 취미, 멘토링 등에서 보람을 찾을 수 있는 해입니다.\n\n` :
            `무리하지 않는 범위에서 가벼운 활동을 권합니다. 건강이 최우선입니다.\n\n`;
          answer += `【건강운 — 가장 중요!】\n${thisYearSeun.health}`;
        } else {
          answer += `【${sajuResult.relationship === 'married' ? '부부운/가정운' : sajuResult.relationship === 'dating' ? '애정운/연애운' : '애정운'}】\n${thisYearSeun.love}\n\n`;
          answer += `【${seunAge >= 60 ? '노후 자산관리' : '재물운'}】\n${thisYearSeun.money}\n\n`;
          answer += `【${seunAge >= 60 ? '활동운' : '직업운'}】\n${thisYearSeun.career}\n\n`;
          answer += `【건강운】\n${thisYearSeun.health}`;
        }

        if (currentDaeun) {
          answer += `\n\n【대운과의 조합】\n`;
          answer += `현재 대운(${currentDaeun.cheongan}${currentDaeun.jiji}, ${currentStage}운)과 올해 세운이 함께 작용합니다. `;
          if (currentStageEnergy + thisYearSeun.overallScore >= 14) {
            answer += '대운과 세운 모두 좋은 에너지! 올해는 적극적으로 도전하고 기회를 잡으세요.';
          } else if (currentStageEnergy + thisYearSeun.overallScore >= 10) {
            answer += '전체적으로 무난한 흐름입니다. 꾸준함이 성공의 열쇠입니다.';
          } else {
            answer += '조금 조심해야 할 해입니다. 큰 결정은 미루고 내실을 다지세요.';
          }
        }
      } else {
        answer = '올해 세운 데이터를 찾을 수 없습니다.';
      }
    }
    // 일반 질문 → 종합 운세로 상세 답변
    else {
      answer = `═══ 사주 종합 운세 분석 ═══\n\n`;
      answer += `📋 현재 나이: ${currentAge}세 | 대운: ${currentDaeun ? `${currentDaeun.cheongan}${currentDaeun.jiji}(${currentStage}운, 에너지 ${currentStageEnergy}/10)` : '분석중'}\n`;
      answer += `📋 일간: ${sajuResult.ilgan} (${OHAENG_KR[ilOh]} 기운)\n`;
      answer += `📋 일주: ${sajuResult.day.cheongan}${sajuResult.day.jiji} | 시주: ${sajuResult.hour.cheongan}${sajuResult.hour.jiji} (${sajuResult.hourInfo.name})\n`;
      answer += `📋 용신: ${OHAENG_KR[sajuResult.yongsin]} | 기신: ${OHAENG_KR[sajuResult.gisin]}\n\n`;

      // ★ 이 사주의 확실한 특징 강조
      {
        const mSip = sajuResult.sipseongs.month;
        const hSip = sajuResult.sipseongs.hour;
        answer += `【✅ 이 사주의 확실한 특징】\n`;
        answer += `• ${sajuResult.ilgan}일간(${OHAENG_KR[ilOh]}) — ${sajuResult.iljuDesc.split('.')[0]}. 이것이 당신의 본질입니다.\n`;
        answer += `• 월주 ${mSip} — ${mSip === '식신' ? '전문 기술과 표현력이 강점' : mSip === '상관' ? '창의적 혁신가 기질' : mSip === '편재' ? '타고난 사업 감각' : mSip === '정재' ? '꾸준한 안정 추구형' : mSip === '편관' ? '강한 리더십과 추진력' : mSip === '정관' ? '원칙과 명예를 중시하는 관리자형' : mSip === '편인' ? '독특한 전문 분야에서 빛나는 타입' : mSip === '정인' ? '학문과 지식이 무기인 타입' : mSip === '비견' ? '독립적이고 자주적인 성향' : '경쟁에서 두각을 나타내는 도전가'}입니다.\n`;
        answer += `• 시주 ${hSip} — 말년과 내면의 힘을 결정합니다. ${hSip === '식신' || hSip === '정재' ? '말년이 안정적일 가능성이 높습니다.' : hSip === '편관' || hSip === '상관' ? '중년 이후에도 활발한 활동이 예상됩니다.' : '꾸준한 자기관리가 좋은 말년을 만듭니다.'}\n`;
        answer += `• 넘치는 기운: ${OHAENG_KR[sajuResult.dominantOhaeng]} → 조절 필요 | 부족한 기운: ${OHAENG_KR[sajuResult.weakestOhaeng]} → 의식적 보충 권장\n\n`;

        // ★ 건강↔성격↔직업↔대인관계 통합 분석 (거미줄 해석)
        const wkOh = sajuResult.weakestOhaeng;
        const wkVal = sajuResult.ohaengBalance[wkOh as Ohaeng];
        const domOh = sajuResult.dominantOhaeng;
        const domVal = sajuResult.ohaengBalance[domOh as Ohaeng];
        if (wkVal <= 1.5) {
          answer += `【🕸️ 오행 불균형이 삶 전체에 미치는 영향】\n`;
          const CROSS_ANALYSIS: Record<string, string> = {
            '목': `${OHAENG_KR['목']}(木) 기운이 ${wkVal}점으로 극도로 부족합니다.\n`
              + `→ 【건강】 간 기능 약화로 만성 피로, 무기력감, 눈 피로가 반복될 수 있어요.\n`
              + `→ 【성격】 의지력과 추진력이 쉽게 꺾이고, 결단을 내리기 어려울 수 있어요. 목(나무)은 위로 뻗어가는 에너지인데, 이게 부족하면 "시작은 하는데 끝까지 밀어붙이기 힘든" 패턴이 생길 수 있습니다.\n`
              + `→ 【직업】 야근이 잦거나 체력 소모가 큰 직업은 건강을 빠르게 망가뜨릴 수 있어요. 규칙적인 생활이 가능한 안정적 직업이 체질에 맞습니다.\n`
              + `→ 【대인관계】 에너지가 부족해 사교 활동이 부담될 수 있어요. 소수의 깊은 관계를 유지하는 것이 현실적이에요.\n`
              + `→ 【개운법】 아침 산책, 녹색 채소, 동쪽 방위, 나무 소재 인테리어로 목 기운을 보충하세요.\n`,
            '화': `${OHAENG_KR['화']}(火) 기운이 ${wkVal}점으로 극도로 부족합니다.\n`
              + `→ 【건강】 심장·혈관이 약하고, 공황장애·불안장애·심장 두근거림·불면증이 나타날 수 있는 체질이에요. 손발이 차갑고 혈액순환이 안 되는 증상도 흔합니다.\n`
              + `→ 【성격】 화(불)는 열정·표현력·사교성의 에너지인데, 이게 부족하면 감정 표현이 어렵고, 새로운 사람 앞에서 긴장하기 쉽고, 의욕이 쉽게 떨어질 수 있어요. "하고 싶은 건 많은데 몸이 안 따라가는" 느낌이 반복될 수 있습니다.\n`
              + `→ 【직업】 고강도 스트레스, 장거리 출장, 밀폐 공간, 교대 근무 직업은 불안 증상을 악화시킬 수 있어요. 재택근무, 자율 출퇴근, 자기 페이스를 조절할 수 있는 환경이 최적입니다. IT, 작가, 디자인, 상담, 교육 등이 체질에 맞아요.\n`
              + `→ 【대인관계】 대규모 모임이나 네트워킹 행사가 부담될 수 있어요. 소수의 편안한 사람과 깊은 관계를 유지하고, 온라인 소통을 적극 활용하세요.\n`
              + `→ 【개운법】 따뜻한 환경, 붉은색 소품, 남쪽 방위, 반신욕, 명상·호흡법, 홍삼·계피·생강차로 화 기운을 보충하세요.\n`,
            '토': `${OHAENG_KR['토']}(土) 기운이 ${wkVal}점으로 극도로 부족합니다.\n`
              + `→ 【건강】 위장 기능이 매우 약해 소화불량, 체중 변화, 영양 흡수 불량이 반복될 수 있어요.\n`
              + `→ 【성격】 토(흙)는 안정감·신뢰·중심의 에너지인데, 이게 부족하면 마음이 불안정하고 자기 확신이 부족할 수 있어요. 결정을 내려도 자꾸 흔들리는 패턴이 생길 수 있습니다.\n`
              + `→ 【직업】 불규칙한 식사를 강요하는 직종(교대, 영업, 외식업)은 위장을 더 망가뜨립니다. 규칙적인 생활이 가능한 사무직, 연구직, 교육직이 체질에 맞아요.\n`
              + `→ 【대인관계】 상대에게 너무 맞추다 자신을 잃기 쉬워요. 자기 의견을 표현하는 연습이 필요합니다.\n`
              + `→ 【개운법】 노란색 소품, 중앙 방위, 규칙적 식사, 고구마·호박·꿀 등 단맛 음식으로 토 기운을 보충하세요.\n`,
            '금': `${OHAENG_KR['금']}(金) 기운이 ${wkVal}점으로 극도로 부족합니다.\n`
              + `→ 【건강】 호흡기·면역력이 매우 약해 감기·알레르기·피부 질환이 반복될 수 있어요.\n`
              + `→ 【성격】 금(쇠)은 결단력·원칙·정의감의 에너지인데, 이게 부족하면 우유부단하고 남의 눈치를 많이 볼 수 있어요. "거절 못 하는 성격"이 스트레스의 원인일 수 있습니다.\n`
              + `→ 【직업】 먼지·화학물질·야외 작업이 많은 직종은 건강에 직접적인 위험입니다. 쾌적한 실내 환경의 사무직, 교육직, IT 직종이 체질에 맞아요.\n`
              + `→ 【대인관계】 "NO"라고 말하는 연습이 필요합니다. 모든 부탁을 다 들어주다 지칠 수 있어요.\n`
              + `→ 【개운법】 흰색 소품, 서쪽 방위, 깊은 호흡 연습, 배·도라지·마늘로 금 기운을 보충하세요.\n`,
            '수': `${OHAENG_KR['수']}(水) 기운이 ${wkVal}점으로 극도로 부족합니다.\n`
              + `→ 【건강】 신장·방광·허리가 매우 약해 만성 요통, 냉증, 부종이 반복될 수 있어요.\n`
              + `→ 【성격】 수(물)는 지혜·유연성·적응력의 에너지인데, 이게 부족하면 생각이 경직되고 변화에 적응하기 어려울 수 있어요. "같은 방법만 고집하는" 패턴이 생길 수 있습니다.\n`
              + `→ 【직업】 장시간 앉아있거나 추운 환경에서 일하는 직종은 허리를 더 악화시킵니다. 적당히 움직이면서 일할 수 있는 교육, 상담, 서비스업이 체질에 맞아요.\n`
              + `→ 【대인관계】 고집이 강해 보일 수 있으니 상대 의견도 열린 마음으로 들어보세요.\n`
              + `→ 【개운법】 검은색 소품, 북쪽 방위, 충분한 수분 섭취, 검은콩·해조류·호두로 수 기운을 보충하세요.\n`,
          };
          answer += CROSS_ANALYSIS[wkOh] + '\n';
        }
      }

      // 일주 해석
      answer += `【일주 해석】\n${sajuResult.iljuDesc}\n\n`;

      // 시주(時柱) 기반 개인화 — 같은 날 다른 시간 태어난 사람과 차별화되는 핵심
      const genHourSip = sajuResult.sipseongs.hour;
      const hourJiji = sajuResult.hour.jiji;
      const hourOh = sajuResult.hour.cheonganOhaeng;

      answer += `【태어난 시간의 기운 — ${sajuResult.hourInfo.name}(${sajuResult.hour.cheongan}${hourJiji})】\n`;
      answer += `${sajuResult.hourInfo.meaning}\n`;

      // 시주 십성별 인생 방향 차이
      const HOUR_SIP_LIFE: Record<string, string> = {
        '비견': '자기 주도적 삶을 살 가능성이 높은 편이에요. 중년 이후 독립적으로 자기 사업이나 프리랜서 활동에서 성취를 이룰 수 있습니다. 남에게 의존하기보다 스스로의 힘으로 길을 개척하는 타입일 수 있어요.',
        '겁재': '도전정신이 내면에 강하게 있을 수 있어, 중년 이후 과감한 결단으로 인생 전환점을 맞이할 가능성이 있습니다. 다만 충동적 재정 결정은 주의하는 게 좋아요.',
        '식신': '말년이 풍족하고 여유로울 가능성이 있는 사주예요. 먹거리, 문화, 예술 관련 분야에서 보람을 찾을 수 있고, 자녀와의 관계도 좋은 편일 수 있습니다.',
        '상관': '독창적 재능이 내면에 있을 수 있어, 전문 분야에서 독보적 실력을 쌓을 가능성이 있어요. 기존 틀을 깨는 혁신가 기질이 있어 나이 들수록 빛을 발할 수 있는 타입입니다.',
        '편재': '사업 수완이 내면에 있을 수 있어, 투자·사업에서 큰 성과를 낼 가능성이 있습니다. 돈을 벌고 쓰는 스케일이 큰 편이며, 말년 재물운이 좋을 수 있어요.',
        '정재': '알뜰하고 계획적인 내면이 있을 수 있어, 꾸준히 자산을 쌓아 안정적인 노후를 보낼 가능성이 높습니다. 가정적이며 책임감이 강한 편이에요.',
        '편관': '내면에 권위와 통솔력이 있을 수 있어, 조직이나 사회에서 높은 위치에 오를 가능성이 있습니다. 다만 스트레스 관리와 건강 관리에 신경 쓰는 게 좋아요.',
        '정관': '원칙적이고 바른 내면이 있을 수 있어, 사회적 명예를 중시하며 안정적인 인생 경로를 걸을 가능성이 높습니다. 자녀와의 관계가 좋고 말년이 편안한 편일 수 있어요.',
        '편인': '학구열과 영적 탐구심이 내면에 있을 수 있어, 비주류적 관심사에서 큰 성취를 이룰 가능성이 있습니다. 독특한 직관력이 장점이 될 수 있어요.',
        '정인': '배움에 대한 열정이 내면에 있을 수 있어, 교육·연구·학문 분야에서 꾸준한 성과를 낼 가능성이 있습니다. 지적 풍요를 추구하는 편이며, 어머니와의 인연이 깊을 수 있어요.',
      };
      answer += `시주 십성 "${genHourSip}" — ${HOUR_SIP_LIFE[genHourSip]}\n`;

      // 시주 오행이 용신/기신과의 관계
      if (hourOh === sajuResult.yongsin) {
        answer += `✅ 시주의 오행(${OHAENG_KR[hourOh]})이 용신과 같아 말년운이 특히 좋을 수 있어요! 나이 들수록 운이 상승하는 구조일 가능성이 있습니다.\n\n`;
      } else if (hourOh === sajuResult.gisin) {
        answer += `⚠️ 시주의 오행(${OHAENG_KR[hourOh]})이 기신이라 중년 이후 건강이나 재물 관리에 신경 쓰면 좋을 수 있어요. 용신(${OHAENG_KR[sajuResult.yongsin]}) 보충이 도움이 될 수 있습니다.\n\n`;
      } else {
        answer += `시주의 오행(${OHAENG_KR[hourOh]})은 중립적인 편이라, 노력에 따라 말년운이 달라질 수 있어요.\n\n`;
      }

      // 나이별 맞춤 분석 — 학생에게 금전운은 부적절, 시니어에게 연애운은 부적절
      const genMonthSip = sajuResult.sipseongs.month;

      if (lifeStage === 'youth') {
        // 10대: 학업운/적성 중심 — 초딩은 반말
        if (currentAge <= 12) {
          answer += `【📚 공부 · 재능 분석】\n`;
          if (['정인', '편인'].includes(genMonthSip)) {
            answer += genMonthSip === '정인' ? `오~ 넌 공부 머리가 좋은 편일 수 있어! 🧠 열심히 하면 성적이 확 올라갈 수도 있어!\n\n` : `넌 남들이랑 좀 다른 방식으로 생각하는 타입일 수 있어! 그림, 음악, 만들기 같은 데서 빛날 수 있어 🎨\n\n`;
          } else if (['식신'].includes(genMonthSip)) {
            answer += `넌 아이디어가 톡톡 튀는 타입일 수 있어! ✨ 발표나 미술 시간에 "와 대박!" 소리 들을 수도 있어 ㅋ\n\n`;
          } else if (['정관'].includes(genMonthSip)) {
            answer += `넌 규칙 잘 지키는 모범생 타입일 수 있어! 반장이나 조장 하면 딱 어울릴 수도? 👔\n\n`;
          } else {
            answer += `${OHAENG_KR[ilOh]} 기운을 가진 넌 ${ilOh === '목' ? '새로운 거 배우는 속도가 빠를 수 있어' : ilOh === '화' ? '좋아하는 거에 완전 빠져드는 타입일 수 있어' : ilOh === '토' ? '꾸준히 하면 엄청 잘하게 되는 타입일 수 있어' : ilOh === '금' ? '수학이나 퍼즐 같은 거 잘할 수 있어' : '감성이 풍부해서 글이나 그림에 재능이 있을 수 있어'}! 💪\n\n`;
          }
          answer += `【🔮 넌 커서 뭐가 될까?】\n`;
          answer += lifePredictions.career.recommendations.slice(0, 3).map((r: any, i: number) =>
            `${['🥇', '🥈', '🥉'][i]} ${r.category} — ${r.jobs.slice(0, 2).join(', ')}`
          ).join('\n') + '\n\n';
          answer += `물론 미래는 네가 만드는 거야! 꿈이 바뀌어도 전혀 걱정 없어~ 스트롱 스트롱💪 지금은 다양한 경험을 많이 해봐! 김풍스럽게 과정은 엉망이어도 결과는 대박날 수 있으니까! 🌈\n\n`;

          // ★ 초딩 사주 맞춤 인생조언 (웃기면서 감동적)
          answer += `【🌟 ${sajuResult.ilgan}일간인 너에게 보내는 한마디】\n`;
          if (ilOh === '목') {
            answer += `넌 새싹처럼 무럭무럭 자라는 중이야 🌱 지금 키 안 큰다고 속상해? ㅋㅋ 나무도 처음엔 작았어! 근데 나중에 아파트보다 커지잖아. 네 가능성도 그래~ 지금은 뿌리 내리는 시간이야. 친구랑 싸워도, 시험 망해도, 다 비료가 되는 거야! 할렐야루~ 🌳\n\n`;
          } else if (ilOh === '화') {
            answer += `넌 불꽃처럼 뜨거운 마음을 가졌어 🔥 가끔 화가 확 나거나 신나서 날뛸 때 있지? 그게 바로 너의 에너지야! 그 열정 절대 끄지 마. 세상에서 가장 멋진 건 뭔가에 푹 빠져있는 사람이거든. 오늘도 네가 좋아하는 거 하면서 불태워봐! 스트롱 스트롱💪\n\n`;
          } else if (ilOh === '토') {
            answer += `넌 든든한 땅 같은 아이야 🏔️ "나는 좀 느린 것 같아..." 하고 생각한 적 있지? 근데 있잖아, 산은 원래 천천히 만들어지는 거야. 대신 한번 만들어지면 안 무너져! 넌 꾸준히만 하면 나중에 "우와 저 사람 어떻게 저렇게 됐지?" 소리 듣는 타입이야. 기대컨 하지 말고 그냥 달려! 🏃\n\n`;
          } else if (ilOh === '금') {
            answer += `넌 보석 원석 같은 아이야 💎 아직 반짝반짝 안 할 수도 있어. 근데 보석이 처음부터 빛나? ㄴㄴ 깎고 다듬어야 빛나는 거잖아! 공부가 그 깎는 과정이야 ㅋㅋ 힘들어도 나중에 난리자베스급으로 빛날 거니까 조금만 참아봐! ✨\n\n`;
          } else {
            answer += `넌 깊은 바다 같은 아이야 🌊 겉으로는 조용한데 속으로는 엄청 많은 생각이 들지? 그게 넌 남들보다 느끼는 게 많다는 뜻이야. 가끔 혼자 있고 싶을 때는 충분히 쉬어도 돼. 물은 쉬면서 힘을 모으거든. 그리고 다시 콸콸 흐르면 아무도 못 막아! 중지정! 💧\n\n`;
          }

          answer += `【🌟 성장 시기】\n`;
        } else {
          // 중고등학생 — 가능성 어투
          answer += `【학업운 · 적성 분석】\n`;
          if (['정인', '편인'].includes(genMonthSip)) {
            answer += genMonthSip === '정인' ? `정인이 월주에 있어 학문적 자질이 뛰어날 수 있어요! 정규 교육과 자격증 취득에 강점을 보일 수 있고, 꾸준히 공부하면 좋은 성과를 거둘 가능성이 높아요.\n\n` : `편인이 있어 독창적 사고가 강한 편일 수 있어요! 일반적인 공부보다 예체능, 기술, 특수 분야에서 재능을 발휘할 수 있을 거예요.\n\n`;
          } else if (['식신'].includes(genMonthSip)) {
            answer += `식신이 있어 창의력과 표현력이 뛰어날 수 있어요! 글쓰기, 예술, 요리 등 표현 활동에서 빛을 발할 가능성이 있어요.\n\n`;
          } else if (['정관'].includes(genMonthSip)) {
            answer += `정관이 있어 규칙적이고 성실한 타입일 수 있어요. 조직적으로 공부하는 게 맞을 수 있고, 리더 역할에서 성장할 가능성이 있어요.\n\n`;
          } else {
            answer += `${OHAENG_KR[ilOh]} 기운을 가진 당신은 ${ilOh === '목' ? '새로운 것을 배우는 속도가 빠르고 호기심이 많은 편일 수 있어요' : ilOh === '화' ? '열정적으로 관심 분야에 몰입하는 타입일 수 있어요' : ilOh === '토' ? '꾸준히 반복하며 실력을 쌓는 타입일 수 있어요' : ilOh === '금' ? '분석적이고 논리적인 사고가 강한 편일 수 있어요' : '직관적이고 창의적인 사고가 돋보이는 편일 수 있어요'}. 용신(${OHAENG_KR[sajuResult.yongsin]}) 방향의 과목이나 활동에 집중하면 학업 성과가 올라갈 수 있어요.\n\n`;
          }
          answer += `【미래 진로 — 잘 맞을 수 있는 분야】\n`;
          answer += lifePredictions.career.recommendations.slice(0, 3).map((r: any, i: number) =>
            `${i + 1}. ${r.category} (적합도 ${r.fitScore}/10) — ${r.jobs.slice(0, 3).join(', ')}`
          ).join('\n') + '\n\n';

          // ★ 중고등학생 사주 맞춤 인생조언 (웃기면서 감동적)
          answer += `【🌟 ${sajuResult.ilgan}일간인 너에게 보내는 인생 한마디】\n`;
          if (ilOh === '목') {
            answer += `넌 나무처럼 위로 자라는 사람이야 🌿 지금 성적이 안 나와도? 걱정 ㄴㄴ. 대나무는 4년 동안 겨우 3cm 자라다가 5년째에 하루 30cm씩 폭풍성장하거든. 넌 지금 뿌리 내리는 중이야. 친구관계가 복잡해도 괜찮아 — 나무는 가지치기를 해야 더 크게 자라니까. 진짜 너를 좋아하는 사람은 남아있을 거야. 할렐야루~ 🌳\n\n`;
          } else if (ilOh === '화') {
            answer += `넌 불꽃 같은 존재야 🔥 열정이 넘쳐서 가끔 충동적이라는 소리 듣지? ㅋㅋ 그거 단점 아님. 세상을 바꾼 사람들은 다 "미쳤다" 소리 들은 사람들이야. 다만 불은 방향이 중요해 — 아무 데나 태우면 산불이지만, 잘 쓰면 로켓 엔진이잖아. 네 열정을 하나에 집중해봐. 스트롱 스트롱💪 그게 뭐든 네가 진심이면 돼!\n\n`;
          } else if (ilOh === '토') {
            answer += `넌 산처럼 묵직한 사람이야 🏔️ "나는 왜 남들처럼 빠릿빠릿 못 하지?" 이런 생각 해본 적 있지? 근데 토끼와 거북이 결말 알잖아 ㅋㅋ 넌 거북이 타입인데, 거북이가 이기는 이유 알아? 절대 포기를 안 해. 넌 한번 마음먹으면 끝까지 가는 사람이야. 지금 느려 보여도 10년 후에 "어? 쟤가 왜 저기에?" 소리 들을 거야. 기대컨 하지 말고 묵묵히 가자! 🐢\n\n`;
          } else if (ilOh === '금') {
            answer += `넌 칼날처럼 예리한 사람이야 ⚔️ 친구들이 "너 말 좀 독하다" 그러지? ㅋㅋ 그건 네가 거짓말을 못 하는 거야. 솔직한 게 나쁜 건 아닌데, 포장은 좀 하자 ㅎㅎ "넌 틀렸어" 대신 "다른 방법도 있지 않을까?"라고 하면 같은 말인데 반응이 180도 달라져. 넌 분석력이 장난 아니거든 — 그 머리 잘 쓰면 난리자베스급 인재 될 수 있어! 💎\n\n`;
          } else {
            answer += `넌 깊은 호수 같은 사람이야 🌊 겉으론 조용한데 속으로는 세상 모든 걸 다 느끼고 있지? 감수성이 폭발적이라 가끔 혼자 눈물 날 때도 있을 거야. 그게 약점이 아니라 최고의 무기야. 공감 능력이 뛰어난 사람이 결국 리더가 돼. 지금 외로워도 괜찮아 — 깊은 물에는 진짜 보석이 숨어있거든. 네 안에 있는 보석을 찾는 시간이야! 중지정! 💧\n\n`;
          }

          answer += `【성장 시기 · 인생 황금기 예고】\n`;
        }
      } else if (lifeStage === 'fifties') {
        // 50대: 건강/퇴직 준비/자산 관리 강조
        answer += `【⚠️ 건강 관리 — ${currentAge}세, 지금이 가장 중요한 시기】\n`;
        const HEALTH_BRIEF_50: Record<string, string> = {
          '목': '간 기능과 눈 건강에 특히 신경 써야 할 수 있어요. 정기적인 간 수치 검사와 눈 검진을 추천드려요.',
          '화': '심장과 혈압 관리가 핵심일 수 있어요. 정기적인 심혈관 검진과 가벼운 유산소 운동이 도움이 될 수 있습니다.',
          '토': '위장과 소화기 건강에 주의하면 좋을 수 있어요. 규칙적인 식사와 소화가 잘 되는 음식 위주가 좋아요.',
          '금': '폐와 호흡기를 보호하는 게 중요할 수 있어요. 호흡 운동과 깨끗한 공기가 큰 도움이 될 수 있습니다.',
          '수': '신장과 허리 관리가 중요한 시기일 수 있어요. 하체 보온과 충분한 수분 섭취가 도움이 될 수 있어요.',
        };
        answer += `${HEALTH_BRIEF_50[ilOh]}\n`;
        answer += `50대는 몸이 보내는 신호에 주의를 기울여야 할 시기예요. 기신(${OHAENG_KR[sajuResult.gisin]}) 관련 장기가 약해질 수 있으니 정기 검진을 받아보시면 좋겠어요.\n\n`;

        answer += `【💼 직장 · 퇴직 준비】\n`;
        const monthSipFor50 = sajuResult.sipseongs.month;
        if (['정관', '편관'].includes(monthSipFor50)) {
          answer += `조직 내에서 인정받을 수 있는 기운이 있지만, 50대는 퇴직을 준비해야 하는 현실적인 시기이기도 해요. `;
          answer += currentStageEnergy >= 6 ? `다행히 대운 에너지가 괜찮은 편이라, 현 직장에서 좀 더 버틸 수 있을 가능성이 있어요.\n` :
            `대운 에너지가 낮은 편이라, 퇴직 후를 미리 준비해두는 게 현명할 수 있어요.\n`;
        } else if (['편재', '정재'].includes(monthSipFor50)) {
          answer += `재물 감각이 있는 편이라, 퇴직 후에도 사업이나 투자로 수입을 유지할 가능성이 있어요. `;
          answer += `다만 이 나이에는 안정적인 수입원 확보가 우선일 수 있습니다.\n`;
        } else {
          answer += `이 시기는 현실적으로 퇴직을 준비해야 하는 나이예요. `;
          answer += `용신(${OHAENG_KR[sajuResult.yongsin]}) 방향의 부업이나 제2의 직업을 미리 탐색해보면 좋을 수 있어요.\n`;
        }
        answer += `• 퇴직 후 수입원을 미리 확보해두면 마음이 편해질 수 있어요.\n`;
        answer += `• 연금, 보험, 저축 등 노후 자금 점검이 필요한 시기예요.\n`;
        answer += `• 건강이 곧 재산이에요. 건강할 때 건강을 챙기는 게 가장 현명할 수 있습니다.\n\n`;

        answer += `【가정운 · 자녀 관계】\n`;
        const hourSip50 = sajuResult.sipseongs.hour;
        answer += hourSip50 === '식신' ? `자녀와 좋은 인연일 가능성이 있어요. 자녀가 부모를 잘 따르는 편일 수 있습니다.\n` :
          hourSip50 === '상관' ? `자녀와 의견 충돌이 있을 수 있지만, 서로의 개성을 인정하면 좋은 관계를 유지할 수 있어요.\n` :
          `자녀와의 관계는 대체로 원만한 편일 수 있어요. 먼저 관심을 표현하면 더 가까워질 수 있습니다.\n`;
        answer += `💡 자녀 관계 TIP: "잘했어", "거봐 엄마 말 들으니까 되지?"는 부모 중심의 평가예요. 사춘기 자녀에게는 "와, 완전 놀랍다! 어떻게 그런 생각을 다 했어?"라는 순수한 감탄이 아이를 삶의 주체로 인정해줘 자존감을 높일 수 있어요. `;
        answer += `자녀가 방황할 때는 제주도 돌담처럼 틈을 허락해주세요 — 실수할 틈, 실패할 틈이 있어야 오히려 무너지지 않을 수 있어요. 아이에게 쏟던 에너지를 거두고 부모 자신이 좋아하는 것을 하며 여유를 찾으면, 짜증 대신 편안한 말투로 다가갈 수 있어요.\n`;
        answer += `💡 배우자 소통 TIP: ${sajuResult.gender === 'male' ? '아내에게 불만을 전할 때는 "당신이 있어서 고마워" + 부탁 + "항상 고마워"로 감싸는 햄버거 기법이 효과적일 수 있어요.' : '남편에게 섭섭할 때 "너 왜 그래?"보다 "나는 지금 속상해"라고 나 중심 화법을 쓰면 갈등이 줄어들 수 있어요.'} 단, 나 중심 화법의 핵심은 상대를 원인 제공자로 몰지 않는 것이에요 — "네가 나를 화나게 했어"가 아니라 "나는 지금 슬퍼, 나는 지금 속상해"처럼 순수하게 내 감정에만 집중해야 상대도 방어벽을 내릴 수 있어요. 처음엔 어색해도 연기하듯 시도해보세요. 3개월만 꾸준히 하면 자연스러운 내 모습이 될 수 있어요!\n\n`;

      } else if (lifeStage === 'senior') {
        // 60대 이상: 건강/가정/인생정리 중심
        answer += `【⚠️ 건강 관리 (${currentAge}세 최우선)】\n`;
        const HEALTH_BRIEF_S: Record<string, string> = {
          '목': '간 기능과 눈 건강에 특히 주의하면 좋을 수 있어요. 산책과 녹색 채소가 도움이 될 수 있습니다.',
          '화': '심장과 혈압 관리가 핵심일 수 있어요. 가벼운 운동과 명상이 도움이 될 수 있습니다.',
          '토': '위장과 소화기 건강에 신경 쓰면 좋을 수 있어요. 규칙적인 식사와 소화 잘 되는 음식 위주가 좋아요.',
          '금': '폐와 호흡기를 보호하는 게 중요할 수 있어요. 깨끗한 공기와 깊은 호흡 운동이 도움이 될 수 있습니다.',
          '수': '신장과 허리를 관리하면 좋을 수 있어요. 충분한 수분 섭취와 보온에 신경 쓰는 게 좋아요.',
        };
        answer += `${HEALTH_BRIEF_S[ilOh]}\n`;
        answer += `기신(${OHAENG_KR[sajuResult.gisin]}) 관련 장기가 약해질 수 있으니 정기 검진을 받아보시면 좋겠어요.\n\n`;

        answer += `【가정운 · 자녀운】\n`;
        const hourSipGen = sajuResult.sipseongs.hour;
        answer += hourSipGen === '식신' ? `식신이 시주에 있어 자녀와 좋은 인연일 가능성이 높아요. 자녀가 효도하고 노후를 돌봐줄 수 있는 편이에요.\n` :
          hourSipGen === '상관' ? `상관이 있어 자녀와 의견 충돌이 있을 수 있지만, 서로의 개성을 인정하면 좋은 관계를 유지할 수 있어요.\n` :
          `자녀와의 관계는 대체로 원만한 편일 수 있어요. 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운을 살려 가족과의 시간을 늘리면 좋을 수 있습니다.\n`;
        answer += `💡 가족 소통 TIP: 사과할 때는 변명 없이 평소보다 조심스럽고 낮은 목소리로 "미안하다"라고 건네보세요. 유창한 해명보다 투박하고 짧은 한마디라도 작은 소리에 담긴 진정성이 오래 닫혀 있던 마음의 문을 열 수 있어요. "괜찮니?"라고 다독이는 한마디를 덧붙이면 상대의 굳은 마음이 녹을 수 있어요. 자녀에게는 "잘했어", "아이고 착하다"같은 부모 중심의 평가 대신 "와, 대단하다! 어떻게 그런 생각을 다 했어?"라는 순수한 감탄이 아이를 삶의 주체로 인정해줘 자존감을 세울 수 있어요.\n\n`;

        answer += `【인생 정리 · 지혜의 시기】\n`;
        answer += `${currentAge}세의 지금은 새로운 도전보다 그동안의 성과를 정리하고 지키는 시기일 수 있어요. `;
        answer += currentStageEnergy >= 6 ? `대운 에너지가 아직 괜찮은 편이라, 무리하지 않는 선에서 봉사 활동이나 후배 멘토링을 통해 보람을 찾을 수 있을 거예요.\n\n` : `건강을 최우선으로 하고, 가족과의 시간을 소중히 하며 마음의 평화를 지키면 좋을 수 있어요.\n\n`;
        answer += `【💎 행복한 노후를 위한 다섯 가지 지혜】\n`;
        answer += `① 말을 줄이세요 — 젊은이의 미숙함이 보여도 입을 다물고 지켜봐 주세요. 직접 부딪혀 배우는 게 가장 큰 공부예요. 잔소리는 사랑이지만, 참아주는 것은 더 큰 사랑일 수 있어요.\n`;
        answer += `② 욕심을 내려놓으세요 — 단풍처럼 물들어가는 자신의 모습을 차분히 받아들이는 여유를 가져보세요. 젊을 때 10가지를 시도했다면, 지금은 1가지만 실행하고 나머지 9개는 과감히 놓아주는 지혜가 필요해요. 인생을 포기하는 게 아니라, 열매를 잘 맺기 위해 잔가지를 정리하는 거예요. 과로·과식·과음만 피해도 건강을 지킬 수 있어요. '채우기'보다 '비우기'에 집중하면, 봄꽃보다 더 아름다운 단풍 같은 인생 후반을 보낼 수 있어요.\n`;
        answer += `③ 모으기보다 베푸세요 — 자손이 잘되기를 말이나 마음으로만 비는 것보다, 천 원이라도 틈나는 대로 주위에 나누는 게 진짜 복을 짓는 실천이에요. 할아버지 할머니가 일상에서 베풀며 지은 복은 그대로 손자에게 전달되어 자손이 잘 풀리는 밑거름이 될 수 있어요. 재물을 움켜쥐지 않고 자꾸 털어내며 베푸는 습관이 본인의 노후도 편안하게 해줄 수 있습니다.\n`;
        answer += `④ 내 몫은 반드시 남겨두세요 — 자식이 아무리 어려워도, 잠잘 방 한 칸과 밥 사 먹을 생활비는 꼭 쥐고 계세요. 그게 관계를 건강하게 유지하는 힘이 될 수 있어요.\n`;
        answer += `⑤ 가능한 한 독립적으로 사세요 — 자연 생태계에서도 어미가 새끼를 돌보는 건 본능이지만, 새끼가 병든 어미를 돌보는 건 인간만의 특수한 일이에요. 자식이 도와주면 고마운 일이지만, 처음부터 기대하는 마음을 내려놓으면 서운함이나 갈등을 미리 막을 수 있어요. 거동이 불편해지기 전까지는 아픈 몸을 이끌고 직접 밥을 해 먹더라도 자식에게 의지하지 않는 것 — 그 주체적인 마음가짐이 오히려 당당하고 편안한 노후를 만들어줄 수 있어요.\n\n`;
      } else {
        // 20대~50대: 기존 재복 분석
        answer += `【재복(財福) 분석 — 돈복이 있는 사주인가?】\n`;
        if (['정재', '편재'].includes(genMonthSip) || ['정재', '편재'].includes(genHourSip)) {
          answer += `재성(정재/편재)이 사주에 있어 재복이 있는 편입니다! `;
          if (genMonthSip === '편재') answer += `특히 편재가 월주에 있어 큰 돈을 다룰 운이 있습니다. 사업이나 투자에 적합하며, 노력한 만큼 이상의 수입이 기대됩니다.\n\n`;
          else if (genMonthSip === '정재') answer += `정재가 있어 안정적인 수입이 꾸준히 들어옵니다. 급부자보다 알뜰하게 모아서 부자가 되는 타입입니다. 월급쟁이로도 충분히 자산을 쌓을 수 있습니다.\n\n`;
          else answer += `시주에 재성이 있어 중년 이후 재물운이 좋아집니다. 나이가 들수록 경제적으로 여유로워집니다.\n\n`;
        } else if (['식신'].includes(genMonthSip)) {
          answer += `식신이 있어 기술이나 아이디어로 돈을 버는 사주입니다. 직접 재복은 아니지만 재능으로 돈을 만들어내는 능력이 뛰어납니다. 노력형 부자입니다.\n\n`;
        } else {
          answer += `직접적인 재성은 약하지만, 용신(${OHAENG_KR[sajuResult.yongsin]})을 잘 활용하면 재물운을 높일 수 있습니다. 평생 돈걱정을 할 사주는 아닙니다 — 다만 노력과 전략이 필요합니다. `;
          answer += `${OHAENG_KR[sajuResult.yongsin]} 관련 업종이나 방향을 선택하면 재물이 따라옵니다.\n\n`;
        }
      }

      // 황금기 분석 — 100세까지 포함
      const bestDaeun = daeunResult.pillars
        .filter((p: any) => p.startAge <= 100)
        .sort((a, b) => {
          const aData = TWELVE_STAGE_DATA[a.twelveStage as keyof typeof TWELVE_STAGE_DATA];
          const bData = TWELVE_STAGE_DATA[b.twelveStage as keyof typeof TWELVE_STAGE_DATA];
          let aScore = aData.energy;
          let bScore = bData.energy;
          if (CHEONGAN_OHAENG[a.cheongan] === sajuResult.yongsin || JIJI_OHAENG[a.jiji] === sajuResult.yongsin) aScore += 2;
          if (CHEONGAN_OHAENG[b.cheongan] === sajuResult.yongsin || JIJI_OHAENG[b.jiji] === sajuResult.yongsin) bScore += 2;
          return bScore - aScore;
        });
      if (currentAge >= 60) {
        answer += `【인생 정리기 — 지혜를 나누는 시기】\n`;
        // 60대 이상: 과거 황금기를 돌아보고, 남은 시간은 안정/정리 관점
        const pastBest = bestDaeun.filter((p: any) => p.startAge < currentAge);
        const futureDaeun = bestDaeun.filter((p: any) => p.startAge >= currentAge);
        if (pastBest.length > 0) {
          const pb = pastBest[0];
          answer += `인생 황금기였을 가능성이 높은 시기: ${pb.startAge}~${pb.endAge}세 (${pb.cheongan}${pb.jiji} 대운, ${pb.twelveStage}운)\n`;
          answer += `→ 그때 쌓은 경험과 인맥이 지금의 소중한 자산일 수 있습니다.\n\n`;
        }
        if (futureDaeun.length > 0) {
          const fd = futureDaeun[0];
          answer += `앞으로 에너지가 좋을 수 있는 시기: ${fd.startAge}~${fd.endAge}세 — 무리하지 않는 범위에서 봉사, 멘토링, 취미 활동에 보람을 찾을 수 있을 거예요.\n\n`;
        }
        answer += `이 시기는 새로운 도전보다 그동안 이룬 것을 정리하고, 가족과의 시간을 소중히 하며, 건강을 최우선으로 삼는 것이 현명할 수 있습니다.\n\n`;
      } else {
        answer += `【인생 황금기 — 가장 빛날 수 있는 시기】\n`;
        if (bestDaeun.length >= 2) {
          const best1 = bestDaeun[0];
          const best2 = bestDaeun[1];
          answer += `1순위 황금기: ${best1.startAge}~${best1.endAge}세 (${best1.cheongan}${best1.jiji} 대운, ${best1.twelveStage}운)\n`;
          answer += `→ 이 시기에 인생 최고의 성과를 거둘 가능성이 높습니다. 커리어, 재물, 인간관계 모두 상승할 수 있어요.\n`;
          answer += `2순위 황금기: ${best2.startAge}~${best2.endAge}세 (${best2.cheongan}${best2.jiji} 대운, ${best2.twelveStage}운)\n`;
          answer += `→ 이 시기도 에너지가 높아 도전하기 좋은 시기일 수 있습니다.\n\n`;
        }
      }

      // 건강 전망
      const genIlOh = ilOh;
      const HEALTH_BRIEF: Record<string, string> = {
        '목': '간/눈/근육 관리 필요. 스트레칭과 녹색 채소가 도움.',
        '화': '심장/혈압 관리 필요. 수영이나 명상이 좋음.',
        '토': '위장/소화기 관리 필요. 규칙적 식사가 핵심.',
        '금': '폐/호흡기 관리 필요. 깊은 호흡과 맑은 공기.',
        '수': '신장/허리 관리 필요. 수분 섭취와 보온.',
      };
      answer += `【건강 전망】\n`;
      answer += `${HEALTH_BRIEF[genIlOh]} `;
      if (currentStageEnergy >= 7) {
        answer += `현재 대운 에너지가 높은 편이라 건강은 양호할 수 있지만, 과로에는 주의하는 게 좋아요.\n\n`;
      } else if (currentStageEnergy >= 4) {
        answer += `현재 보통 수준의 건강 상태일 수 있어요. 규칙적 운동과 충분한 수면이 도움이 될 수 있습니다.\n\n`;
      } else {
        answer += `현재 에너지가 낮은 편이라 건강에 좀 더 신경 쓰면 좋을 수 있어요. 정기 검진을 받아보시면 좋겠어요.\n\n`;
      }

      // 앞으로의 방향 조언 — 60+ 시니어는 정리/안정 관점
      if (currentAge >= 60) {
        answer += `【앞으로의 인생 전략 — 정리와 안정】\n`;
        answer += `• 무리한 새 도전보다는 그동안의 성과를 지키는 데 집중하는 게 좋을 수 있어요.\n`;
        answer += `• 건강 관리가 최우선일 수 있습니다. 정기 검진을 받아보시면 좋겠어요.\n`;
        answer += `• 가족·자녀와의 관계에 시간을 투자하면 큰 보람을 느낄 수 있어요.\n`;
        answer += `• 재산 정리, 노후 계획을 체계적으로 세워두면 마음이 편해질 수 있습니다.\n`;
        answer += `• 봉사 활동이나 후배 멘토링에서 보람을 찾을 수 있을 거예요.\n`;
        answer += `• 용신(${OHAENG_KR[sajuResult.yongsin]}) 기운으로 마음의 평화를 유지하면 좋을 수 있습니다.\n\n`;
      } else {
        answer += `【앞으로의 인생 전략】\n`;
        if (currentStageEnergy >= 7) {
          answer += `지금은 적극적으로 도전해볼 만한 시기일 수 있어요.\n`;
          answer += `• 새로운 일을 시작하거나 확장하기에 좋은 타이밍일 수 있습니다.\n`;
          answer += `• 용신(${OHAENG_KR[sajuResult.yongsin]}) 방향의 활동을 늘리면 좋을 수 있어요.\n`;
          answer += `• 이 기회를 활용하면서, 다음 하락기를 위한 준비도 병행하면 더 좋을 수 있습니다.\n\n`;
        } else if (currentStageEnergy >= 4) {
          answer += `지금은 꾸준함이 가장 중요한 시기일 수 있어요.\n`;
          answer += `• 큰 모험보다 현재 하고 있는 일에 집중하면 좋을 수 있습니다.\n`;
          answer += `• 자격증, 스킬업, 인맥 관리 등 내실을 다지면 나중에 큰 도움이 될 수 있어요.\n`;
          answer += `• 다가올 황금기를 위한 준비 기간이라 생각해도 좋을 것 같아요.\n\n`;
        } else {
          answer += `지금은 인내와 준비의 시기일 수 있어요.\n`;
          answer += `• 무리한 도전은 피하고, 건강과 가정을 우선하면 좋을 수 있습니다.\n`;
          answer += `• 저축과 절약으로 재무 안전망을 확보해두면 마음이 편해질 수 있어요.\n`;
          answer += `• 이 시기를 잘 버티면 다음 대운에서 반드시 빛이 납니다.\n\n`;
        }
      }

      // ★ 종합 행동 가이드 — "구체적으로 이렇게 하세요"
      answer += `【💡 올해 핵심 행동 가이드】\n`;
      answer += `• 용신(${OHAENG_KR[sajuResult.yongsin]}) 보충: ${sajuResult.yongsin === '목' ? '자연 속 산책, 새로운 학습, 초록색 소품 활용' : sajuResult.yongsin === '화' ? '활동적 운동, 사교 모임, 붉은색 포인트' : sajuResult.yongsin === '토' ? '규칙적 루틴, 등산, 황토색 옷이나 도자기' : sajuResult.yongsin === '금' ? '명상, 결단력 연습, 흰색·금속 소품' : '물 가까이 하기(수영·온천), 검정·파란색 활용'}\n`;
      answer += `• 기신(${OHAENG_KR[sajuResult.gisin]}) 주의: ${sajuResult.gisin === '목' ? '과도한 경쟁이나 무리한 확장 자제' : sajuResult.gisin === '화' ? '감정적 충동과 과로 주의' : sajuResult.gisin === '토' ? '고정관념에 갇히지 않기, 변화를 두려워하지 않기' : sajuResult.gisin === '금' ? '지나친 비판이나 냉소 자제' : '우유부단함을 경계, 결정을 미루지 않기'}\n`;
      if (currentDaeun && currentStageEnergy >= 7) {
        answer += `• 현재 대운 에너지 ${currentStageEnergy}/10 — 도전의 시기! 미루던 일을 올해 실행하세요.\n`;
      } else if (currentDaeun && currentStageEnergy <= 4) {
        answer += `• 현재 대운 에너지 ${currentStageEnergy}/10 — 내실을 다지는 시기. 무리한 변화보다 기초체력과 실력을 키우세요.\n`;
      }
      answer += '\n';

      answer += `더 궁금한 점이 있으면 "직업", "결혼/애정", "돈/재물", "건강", "올해운세", "성격/관계" 키워드로 질문해보세요!`;
    }

    // ★ 공통: 사주 교차 분석 — 오행·십성·12운성이 서로 영향을 주는 방식 (모든 질문에 적용)
    if (sajuResult) {
      const _wOh = sajuResult.weakestOhaeng;
      const _wVal = sajuResult.ohaengBalance[_wOh as Ohaeng];
      const _dOh = sajuResult.dominantOhaeng;
      const _dVal = sajuResult.ohaengBalance[_dOh as Ohaeng];
      const _mSip = sajuResult.sipseongs.month;
      const isHealthQ = /건강|아프|병원|다이어트|운동|스트레스|수명|체력|몸|아픈|통증/.test(q);

      // (1) 오행 극단 부족 → 건강↔생활 교차 (건강 질문 제외)
      if (!isHealthQ && _wVal <= 1) {
        const SHORT_HEALTH_NOTE: Record<string, string> = {
          '목': `\n\n💡 참고: ${OHAENG_KR['목']} 기운이 극도로 부족(${_wVal}점)하여 만성 피로 체질입니다. "활발히 활동하라"는 조언은 체력 범위 내에서 조절하세요.`,
          '화': `\n\n💡 참고: ${OHAENG_KR['화']} 기운이 극도로 부족(${_wVal}점)하여 불안·공황 체질입니다. "적극적으로 나서라", "사람 많이 만나라"는 조언은 컨디션에 맞게 조절하세요. 편안한 환경에서의 소수 만남이 더 효과적입니다.`,
          '토': `\n\n💡 참고: ${OHAENG_KR['토']} 기운이 극도로 부족(${_wVal}점)하여 위장이 매우 약한 체질입니다. 회식·야식이 잦은 환경은 건강을 악화시킵니다.`,
          '금': `\n\n💡 참고: ${OHAENG_KR['금']} 기운이 극도로 부족(${_wVal}점)하여 호흡기·면역력이 약한 체질입니다. 먼지가 많거나 환기가 안 되는 환경은 피하세요.`,
          '수': `\n\n💡 참고: ${OHAENG_KR['수']} 기운이 극도로 부족(${_wVal}점)하여 허리·신장이 약한 체질입니다. 장시간 같은 자세를 피하고 스트레칭하세요.`,
        };
        answer += SHORT_HEALTH_NOTE[_wOh];
      }

      // (2) 넘치는 오행 → 성격 과잉이 다른 분야에 미치는 영향
      if (_dVal >= 5) {
        const DOMINANT_CROSS: Record<string, string> = {
          '목': `\n\n🔗 교차분석: ${OHAENG_KR['목']} 기운이 ${_dVal}점으로 과다합니다. 고집이 세고 자기 방식만 고수하려는 경향이 있어, 대인관계에서 마찰이 생기기 쉽고 직장에서도 상사와 충돌할 수 있습니다. 유연하게 양보하는 연습이 직업운·연애운 모두에 도움이 됩니다.`,
          '화': `\n\n🔗 교차분석: ${OHAENG_KR['화']} 기운이 ${_dVal}점으로 과다합니다. 열정이 넘치지만 쉽게 흥분하고 싫증을 내는 경향이 있어, 한 곳에 오래 머무르기 어려울 수 있습니다. 직업을 자주 바꾸거나 관계가 단기간에 타오르다 식는 패턴이 반복된다면, 의식적으로 인내심을 기르세요.`,
          '토': `\n\n🔗 교차분석: ${OHAENG_KR['토']} 기운이 ${_dVal}점으로 과다합니다. 안정을 지나치게 추구해 변화에 적응하기 어려울 수 있습니다. 이직·이사·새로운 관계 시작이 두려워 현상 유지에 머무르는 경향이 있어요. 때로는 변화가 성장입니다.`,
          '금': `\n\n🔗 교차분석: ${OHAENG_KR['금']} 기운이 ${_dVal}점으로 과다합니다. 완벽주의 성향이 강해 자신과 타인에게 엄격합니다. 직장에서 유능하지만 주변이 숨 막히다고 느낄 수 있어요. 관계에서도 기준이 높아 맞는 사람 찾기가 어려울 수 있습니다. 80%에서 만족하는 연습이 필요해요.`,
          '수': `\n\n🔗 교차분석: ${OHAENG_KR['수']} 기운이 ${_dVal}점으로 과다합니다. 생각이 너무 많아 결단을 못 내리는 경향이 있습니다. 이것저것 따져보다 기회를 놓치거나, 걱정이 행동을 마비시키는 패턴이 반복될 수 있어요. 70% 확신이면 바로 움직이는 연습을 하세요.`,
        };
        answer += DOMINANT_CROSS[_dOh];
      }

      // (3) 십성 조합 → 성격↔재물↔관계 연계 위험 신호
      const _hSip = sajuResult.sipseongs.hour;
      const sipComboCross: string[] = [];
      if ((_mSip === '상관' || _hSip === '상관') && (_mSip === '겁재' || _hSip === '겁재')) {
        sipComboCross.push('상관+겁재 조합 — 창의력은 뛰어나지만 충동적 소비·투자 위험이 있습니다. 큰 결정 전에 반드시 하루를 두고 생각하세요.');
      }
      if ((_mSip === '편재' || _hSip === '편재') && (_mSip === '겁재' || _hSip === '겁재')) {
        sipComboCross.push('편재+겁재 조합 — 돈을 크게 벌 수 있지만 크게 잃을 수도 있는 구조입니다. 수입의 30%는 무조건 저축하는 원칙을 세우세요.');
      }
      if ((_mSip === '편관' || _hSip === '편관') && (_mSip === '상관' || _hSip === '상관')) {
        sipComboCross.push('편관+상관 조합 — 권위에 반항하는 기질이 강합니다. 직장 상사와 충돌이 잦을 수 있어요. 독립적인 환경(프리랜서, 창업)이 스트레스를 줄입니다.');
      }
      if (sipComboCross.length > 0) {
        answer += `\n\n🔗 십성 교차분석:\n${sipComboCross.map(s => `• ${s}`).join('\n')}`;
      }

      // (4) 타고난 기질(일간+월주십성) ↔ 건강·직업·관계 연계
      //    ★ 넘치는 오행이 일간 기질을 왜곡/강화하는 효과도 반영하여 교차분석과 모순 방지
      {
        const _ilOh = sajuResult.day.cheonganOhaeng;
        const _wkOh2 = sajuResult.weakestOhaeng as Ohaeng;
        const _wkBal2 = sajuResult.ohaengBalance[_wkOh2];
        // 일간 오행의 타고난 기질
        const ILGAN_TEMPERAMENT: Record<string, string> = {
          '목': '위로 뻗어나가려는 성장·도전의 기질',
          '화': '밝고 열정적인 표현·소통의 기질',
          '토': '듬직하고 안정적인 포용·중재의 기질',
          '금': '날카롭고 원칙적인 판단·결단의 기질',
          '수': '유연하고 깊이 있는 지혜·적응의 기질',
        };
        // ★ 넘치는 오행이 일간 기질에 미치는 왜곡 효과 (교차분석과 일관성 유지)
        const DOMINANT_MODIFIES_TEMPERAMENT: Record<string, Record<string, string>> = {
          // dominantOhaeng → ilganOhaeng → 기질 수정 설명
          '목': {
            '목': '성장·도전의 기질이 극대화되어 자기 방식을 관철하려는 추진력은 강하지만, 고집과 타협 부족이 약점인',
            '화': '밝은 소통의 기질에 목(나무)의 강한 성장 에너지가 연료가 되어 불꽃처럼 타오르지만, 때로는 과열되기 쉬운',
            '토': '원래 포용적인 기질이지만, 넘치는 목(나무) 기운에 눌려(목극토) 자기 페이스를 잃기 쉽고 스트레스를 안으로 삼키는',
            '금': '결단력 있는 기질에 목(나무) 기운이 충돌하여(금극목↔목극금) 내면의 갈등이 잦고, 판단이 흔들리기 쉬운',
            '수': '유연한 지혜의 기질이 목(나무) 성장 에너지와 만나 아이디어가 풍부하지만, 실행보다 구상에 치우치기 쉬운',
          },
          '화': {
            '목': '도전의 기질에 화(불)의 열정이 더해져 폭발적 추진력을 갖지만, 급하고 충동적인 면이 강해지는',
            '화': '열정·표현의 기질이 극대화되어 어디서든 주목받지만, 감정 기복과 번아웃에 취약한',
            '토': '포용적인 기질에 화(불)의 열기가 더해져 따뜻한 리더십이 있지만, 때때로 과하게 감정적이 되는',
            '금': '원칙적 결단력에 화(불) 기운이 충돌하여(화극금) 내적 긴장이 크고, 쉽게 예민해지는',
            '수': '깊은 지혜의 기질과 화(불)의 열정이 수화(水火) 충돌을 일으켜 감정과 이성 사이에서 갈등하는',
          },
          '토': {
            '목': '성장 기질을 토(흙)가 억누르는 구조라 하고 싶은 건 많지만 현실 안정에 끌려 결단이 느린',
            '화': '열정적 기질에 토(흙)의 묵직함이 더해져 꾸준한 실행력이 있지만, 변화에 둔감할 수 있는',
            '토': '안정·포용의 기질이 극대화되어 신뢰감 있지만, 변화를 지나치게 두려워하고 현상유지에 매달리는',
            '금': '결단의 기질에 토(흙)의 안정감이 더해져 실용적이고 착실하지만, 유연성이 부족한',
            '수': '유연한 기질을 토(흙)가 막아서(토극수) 자유로움이 억제되고, 걱정이 많아지기 쉬운',
          },
          '금': {
            '목': '성장 기질을 금(쇠)이 억누르는 구조라(금극목) 내면에 좌절감이 쌓이기 쉽고 자기표현이 서투른',
            '화': '열정적 기질에 금(쇠)의 날카로움이 더해져 비판적 통찰력은 뛰어나지만, 인간관계에서 날이 서기 쉬운',
            '토': '포용적 기질에 금(쇠)의 원칙이 더해져 공정하고 신뢰받지만, 유연한 배려가 부족해질 수 있는',
            '금': '원칙과 결단의 기질이 극대화되어 완벽주의가 강하지만, 자타에게 과도하게 엄격해지는',
            '수': '유연한 기질에 금(쇠)의 명석함이 더해져 분석력이 뛰어나지만, 냉정하다는 인상을 주기 쉬운',
          },
          '수': {
            '목': '성장 기질에 수(물)의 지혜가 양분이 되어 학습·성장 속도가 빠르지만, 생각이 많아 행동이 느린',
            '화': '열정적 기질을 수(물)가 식히는 구조라(수극화) 열정이 제어되어 신중하지만, 추진력이 약해질 수 있는',
            '토': '포용적 기질에 수(물)가 충돌하여(토극수) 안정과 변화 사이에서 갈등이 큰',
            '금': '결단의 기질에 수(물)의 지혜가 더해져 전략적 판단이 뛰어나지만, 지나친 계산으로 기회를 놓치기 쉬운',
            '수': '지혜·적응의 기질이 극대화되어 세상 읽는 눈이 탁월하지만, 우유부단하고 걱정이 과도한',
          },
        };

        const baseTemperament = ILGAN_TEMPERAMENT[_ilOh];
        // 넘치는 오행이 일간 기질에 미치는 실질적 영향을 반영
        const dominantModifier = (_dVal >= 5 && DOMINANT_MODIFIES_TEMPERAMENT[_dOh]?.[_ilOh])
          ? DOMINANT_MODIFIES_TEMPERAMENT[_dOh][_ilOh]
          : null;

        let temperamentNote = '';
        const effectiveTemperament = dominantModifier
          ? `본래 ${baseTemperament}을 타고났지만, ${OHAENG_KR[_dOh as Ohaeng]} 기운이 과다(${_dVal}점)하여 ${dominantModifier} 기질이 되었습니다`
          : baseTemperament;

        if (_mSip === '비견' || _mSip === '겁재') {
          temperamentNote = `${effectiveTemperament}. 여기에 비견/겁재가 더해져 독립심·자기주장이 매우 강한 타입이에요.`;
        } else if (_mSip === '식신' || _mSip === '상관') {
          temperamentNote = `${effectiveTemperament}. 여기에 식상의 표현력이 더해져 창의적·전문적 능력이 뛰어난 타입이에요.`;
        } else if (_mSip === '편재' || _mSip === '정재') {
          temperamentNote = `${effectiveTemperament}. 여기에 재성의 현실 감각이 더해져 실용적이고 돈 감각이 좋은 타입이에요.`;
        } else if (_mSip === '편관' || _mSip === '정관') {
          temperamentNote = `${effectiveTemperament}. 여기에 관성의 통솔력이 더해져 조직에서 리더 역할에 적합한 타입이에요.`;
        } else {
          temperamentNote = `${effectiveTemperament}. 여기에 인성의 학문적 깊이가 더해져 지식·연구 분야에서 빛나는 타입이에요.`;
        }
        // 기질 vs 건강의 충돌 분석
        if (_wkBal2 <= 1.5) {
          const TEMPERAMENT_HEALTH_CLASH: Record<string, Record<string, string>> = {
            '목': { '화': '목(나무)의 도전·성장 기질은 화(불)의 열정으로 표현되어야 하는데, 화가 극도로 부족하여 "하고 싶은 건 많지만 행동으로 옮기지 못하는" 답답함을 느낄 수 있습니다. 이것이 스트레스 → 건강 악화의 악순환을 만듭니다.' },
            '화': { '수': '화(불)의 열정·표현 기질은 수(물)의 지혜로 조절되어야 하는데, 수가 부족하면 감정 통제가 안 되어 대인관계 마찰 → 스트레스 → 건강 악화의 패턴이 생길 수 있습니다.' },
            '토': { '목': '토(흙)의 안정·포용 기질이 목(나무)의 성장을 억누르고 있어, 변화를 두려워하며 현상유지에 머무르는 패턴이 생길 수 있습니다. 이것이 우울감 → 건강 관리 소홀로 이어질 수 있어요.' },
            '금': { '화': '금(쇠)의 원칙·결단 기질이 화(불)의 유연함 없이 너무 날카로워져, 대인관계에서 상처를 주고받기 쉽습니다. 이 스트레스가 호흡기·피부 질환을 악화시킬 수 있어요.' },
            '수': { '토': '수(물)의 유연·지혜 기질이 토(흙)의 안정감 없이 흔들려, 결정을 못 내리는 불안 → 위장 장애로 이어질 수 있습니다.' },
          };
          const clashNote = TEMPERAMENT_HEALTH_CLASH[_ilOh]?.[_wkOh2];
          if (clashNote) {
            answer += `\n\n🧬 기질↔건강 연계: ${temperamentNote} 그러나 ${clashNote}`;
          } else {
            answer += `\n\n🧬 기질 분석: ${temperamentNote}`;
          }
        }
      }

      // (5) 12운성 현재 상태 → 행동 전략 교차 조언
      if (currentDaeun && currentStage) {
        const lowEnergyStages = ['사', '병', '묘', '절'];
        const highEnergyStages = ['건록', '관대', '장생', '제왕'];
        if (lowEnergyStages.includes(currentStage) && !isHealthQ) {
          answer += `\n\n⚡ 현재 대운 "${currentStage}"운(에너지 ${currentStageEnergy}/10)입니다. 에너지 하락기이므로 공격적인 확장(이직, 창업, 큰 투자)보다 현 상태를 유지·보수하는 전략이 안전합니다. 건강 관리를 최우선으로 하세요.`;
        } else if (highEnergyStages.includes(currentStage) && currentStageEnergy >= 8) {
          answer += `\n\n⚡ 현재 대운 "${currentStage}"운(에너지 ${currentStageEnergy}/10)입니다. 에너지가 높은 시기이니 도전적인 행동(이직, 투자, 새로운 관계)이 좋은 결과를 낼 가능성이 높습니다. 기회를 잡으세요!`;
        }
      }

      // (6) 신살↔건강/성격 교차분석
      if (sinsalList.length > 0 && _wVal <= 1.5) {
        const sinsalCross: string[] = [];
        const sinsalNames = sinsalList.map(s => s.name);
        if (sinsalNames.includes('도화살') || sinsalNames.includes('홍염살')) {
          if (_wOh === '화') {
            sinsalCross.push('도화살/홍염살이 있어 매력과 인기가 타고났지만, 화(火) 부족으로 불안·공황 증상이 있어 사교 활동에서 에너지가 빨리 소진됩니다. 온라인·SNS에서 매력을 발산하는 것이 더 적합합니다.');
          } else if (_wOh === '금') {
            sinsalCross.push('도화살/홍염살의 매력이 있지만, 금(金) 부족으로 면역력이 약해 밤문화나 불규칙한 생활이 건강을 크게 해칩니다. 매력은 건강한 방식으로 활용하세요.');
          } else {
            sinsalCross.push(`도화살/홍염살이 있어 대인관계에서 매력적이지만, ${OHAENG_KR[_wOh]} 부족으로 체력이 약해 많은 사람을 만나는 것이 부담될 수 있습니다. 소수의 깊은 관계가 건강에도 좋습니다.`);
          }
        }
        if (sinsalNames.includes('역마살')) {
          if (_wOh === '화') {
            sinsalCross.push('역마살이 있어 이동·변화를 좋아하는 기질이지만, 화(火) 부족으로 공황장애가 있으면 장거리 이동·비행기·출장이 큰 부담입니다. 가까운 거리의 변화(동네 이사, 단거리 여행)로 역마살을 풀어주세요.');
          } else if (_wOh === '수') {
            sinsalCross.push('역마살의 활동적 기질이 있지만, 수(水) 부족으로 허리·신장이 약해 장시간 이동이 고통스러울 수 있습니다. 이동 시 허리 보호 장비를 꼭 챙기세요.');
          } else {
            sinsalCross.push(`역마살이 있어 이동·변화가 잦지만, ${OHAENG_KR[_wOh]} 부족으로 체력이 따라주지 않을 수 있습니다. 무리한 이동 일정은 피하세요.`);
          }
        }
        if (sinsalNames.includes('양인살') || sinsalNames.includes('겁살')) {
          if (_wOh === '화') {
            sinsalCross.push('양인살/겁살의 강한 추진력이 있지만, 화(火) 부족으로 막상 행동에 옮기면 불안이 엄습할 수 있습니다. "할 수 있다"는 마음과 "몸이 안 따라준다"는 현실 사이의 괴리가 스트레스를 만듭니다. 작은 단위로 나누어 실행하세요.');
          } else {
            sinsalCross.push(`양인살/겁살의 날카로운 추진력이 있지만, ${OHAENG_KR[_wOh]} 부족으로 무리하면 건강이 급격히 악화될 수 있습니다. 전진과 휴식의 밸런스가 핵심입니다.`);
          }
        }
        if (sinsalNames.includes('화개살')) {
          sinsalCross.push(`화개살의 예술적·영적 감수성이 있으며, ${OHAENG_KR[_wOh]} 부족 체질과 결합하면 현실보다 내면세계에 빠지기 쉽습니다. 창작이나 명상은 도움이 되지만, 현실 도피 수단이 되지 않도록 주의하세요.`);
        }
        if (sinsalNames.includes('괴강살')) {
          sinsalCross.push(`괴강살의 극단적 성향이 ${OHAENG_KR[_wOh]} 부족과 만나면 건강 관리에서도 "전부 or 전무" 패턴이 나타날 수 있습니다. 완벽하게 하거나 아예 안 하거나가 아닌, 매일 조금씩 꾸준히 하는 습관이 핵심입니다.`);
        }
        if (sinsalCross.length > 0) {
          answer += `\n\n🔮 신살↔건강 교차분석:\n${sinsalCross.map(s => `• ${s}`).join('\n')}`;
        }
      }

      // (7) 합충↔건강 교차분석
      if (hapChungResult && hapChungResult.items && _wVal <= 2) {
        const chungCross: string[] = [];
        const JIJI_ORGAN: Record<string, string> = {
          '인': '간/담(목)', '묘': '간/담(목)', '진': '위장(토)',
          '사': '심장/소장(화)', '오': '심장/소장(화)', '미': '위장(토)',
          '신': '폐/대장(금)', '유': '폐/대장(금)', '술': '위장(토)',
          '해': '신장/방광(수)', '자': '신장/방광(수)', '축': '위장(토)',
        };
        // 충(沖)이 있으면 해당 장기에 타격
        const chungItems = hapChungResult.items.filter((it: { type: string }) => it.type === '지지충');
        for (const ch of chungItems) {
          const chItem = ch as { ji1: string; ji2: string; type: string };
          const organ1 = JIJI_ORGAN[chItem.ji1] || '';
          const organ2 = JIJI_ORGAN[chItem.ji2] || '';
          if (organ1 || organ2) {
            chungCross.push(`${chItem.ji1}↔${chItem.ji2} 충(沖): ${organ1 && organ2 ? `${organ1}과 ${organ2}` : organ1 || organ2} 계통에 충격이 가해지는 구조입니다. 해당 장기의 정기 검진이 중요합니다.`);
          }
        }
        // 합(合)이 부족한 오행을 보충하는지
        const hapItems = hapChungResult.items.filter((it: { type: string }) => it.type === '천간합');
        for (const h of hapItems) {
          const hItem = h as { gan1: string; gan2: string; resultOhaeng: string; type: string };
          if (hItem.resultOhaeng === _wOh) {
            chungCross.push(`${hItem.gan1}${hItem.gan2} 합(合)으로 ${OHAENG_KR[_wOh]} 기운이 생성됩니다! 부족한 오행이 합으로 보충되는 좋은 구조로, 건강에 도움이 됩니다.`);
          }
        }
        // 충이 많으면 건강 불안정 경고
        if (hapChungResult.chungCount >= 2) {
          chungCross.push(`원국에 충(沖)이 ${hapChungResult.chungCount}개나 있어 신체적 변동이 잦을 수 있습니다. 특히 ${OHAENG_KR[_wOh]} 관련 장기의 만성 질환에 주의하세요.`);
        }
        if (chungCross.length > 0) {
          answer += `\n\n⚔️ 합충↔건강 교차분석:\n${chungCross.map(s => `• ${s}`).join('\n')}`;
        }
      }

      // (8) 대운↔세운 복합 효과 분석
      if (currentDaeun && thisYearSeun) {
        const daeunGanOh = currentDaeun.cheonganOhaeng;
        const daeunJiOh = currentDaeun.jijiOhaeng;
        const seunGanOh = CHEONGAN_OHAENG[thisYearSeun.cheongan];
        const seunJiOh = JIJI_OHAENG[thisYearSeun.jiji];
        const doubleNotes: string[] = [];

        // 대운+세운이 동시에 같은 오행을 극할 때
        const SANGGEUK_MAP: Record<Ohaeng, Ohaeng> = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };
        if (_wVal <= 2) {
          const daeunSuppresses = SANGGEUK_MAP[daeunGanOh] === (_wOh as Ohaeng) || SANGGEUK_MAP[daeunJiOh] === (_wOh as Ohaeng);
          const seunSuppresses = SANGGEUK_MAP[seunGanOh] === (_wOh as Ohaeng) || SANGGEUK_MAP[seunJiOh] === (_wOh as Ohaeng);
          if (daeunSuppresses && seunSuppresses) {
            doubleNotes.push(`🔴 위험! 대운(${currentDaeun.cheongan}${currentDaeun.jiji})과 올해 세운(${thisYearSeun.cheongan}${thisYearSeun.jiji})이 동시에 ${OHAENG_KR[_wOh]} 기운을 극하고 있습니다. 이미 약한 ${OHAENG_KR[_wOh]}이 이중 타격을 받는 구조로, 올해 건강 관리가 특히 중요합니다!`);
          }
        }

        // 대운+세운이 동시에 부족한 오행을 보충할 때
        const daeunSupplies = daeunGanOh === (_wOh as Ohaeng) || daeunJiOh === (_wOh as Ohaeng);
        const seunSupplies = seunGanOh === (_wOh as Ohaeng) || seunJiOh === (_wOh as Ohaeng);
        if (daeunSupplies && seunSupplies && _wVal <= 2) {
          doubleNotes.push(`🟢 좋은 시기! 대운과 세운이 동시에 ${OHAENG_KR[_wOh]} 기운을 보충해줍니다. 건강 회복의 골든타임이니, 적극적으로 치료·관리하세요!`);
        }

        // 대운과 세운의 오행이 충돌할 때 (방향이 반대)
        if (SANGGEUK_MAP[daeunGanOh] === seunGanOh || SANGGEUK_MAP[seunGanOh] === daeunGanOh) {
          doubleNotes.push(`⚡ 대운(${OHAENG_KR[daeunGanOh]})과 세운(${OHAENG_KR[seunGanOh]})이 상극 관계입니다. 올해는 큰 흐름(대운)과 올해 기운(세운)이 충돌하여 예상치 못한 변화가 생기기 쉽습니다. 중요한 결정은 신중하게 하세요.`);
        }

        if (doubleNotes.length > 0) {
          answer += `\n\n🌀 대운↔세운 복합 분석:\n${doubleNotes.join('\n')}`;
        }
      }

      // (9) 용신 활용법↔건강 교차분석
      if (_wVal <= 1.5) {
        const yongsin = sajuResult.yongsin;
        const yongsinAdvice: Record<Ohaeng, Record<string, string>> = {
          '목': {
            '화': '용신이 목(木)이라 자연·성장 활동이 개운법이지만, 화(火) 부족으로 과도한 야외 활동은 체력을 소진시킵니다. 실내에서 초록 식물 키우기, 가벼운 실내 스트레칭으로 대체하세요.',
            '토': '용신이 목(木)이라 새로운 시작·도전이 개운법이지만, 토(土) 부족으로 위장이 약해 불규칙한 생활은 금물입니다. 도전하되 식사 시간은 사수하세요.',
            _default: `용신 목(木) 활용 시 ${OHAENG_KR[_wOh]} 부족 체질을 고려하여 체력 범위 내에서 실천하세요.`,
          },
          '화': {
            '화': '용신도 화(火)이고 부족한 것도 화(火)입니다. 용신 보충이 곧 건강 회복! 따뜻한 환경, 붉은색, 남쪽 방향, 유산소 운동이 운과 건강 모두를 챙기는 최고의 전략입니다.',
            '금': '용신이 화(火)라 열정·표현 활동이 개운법이지만, 금(金) 부족으로 과도한 말하기(발표, 강의)는 호흡기에 부담됩니다. 글쓰기·영상 제작 등 비언어적 표현으로 대체하세요.',
            _default: `용신 화(火) 활용 시 ${OHAENG_KR[_wOh]} 부족 체질을 고려하여 몸에 열이 나면 쉬어가세요.`,
          },
          '토': {
            '토': '용신도 토(土)이고 부족한 것도 토(土)입니다. 규칙적 생활, 따뜻한 식사, 안정적 루틴이 운과 건강 모두의 핵심입니다.',
            '목': '용신이 토(土)라 안정·루틴이 개운법이지만, 목(木) 부족으로 변화 없는 생활은 우울감을 키웁니다. 루틴 안에 작은 변화(산책 코스 바꾸기)를 넣으세요.',
            _default: `용신 토(土) 활용 시 ${OHAENG_KR[_wOh]} 부족 체질을 고려하여 과도한 안정 추구는 피하세요.`,
          },
          '금': {
            '금': '용신도 금(金)이고 부족한 것도 금(金)입니다. 깊은 호흡, 명상, 정리정돈이 운과 건강 모두를 챙기는 핵심입니다.',
            '화': '용신이 금(金)이라 결단·정리가 개운법이지만, 화(火) 부족으로 차갑고 날카로운 성향이 강해져 관계가 위축될 수 있습니다. 따뜻한 말투를 의식적으로 연습하세요.',
            _default: `용신 금(金) 활용 시 ${OHAENG_KR[_wOh]} 부족 체질을 고려하여 과도한 긴장·완벽주의는 피하세요.`,
          },
          '수': {
            '수': '용신도 수(水)이고 부족한 것도 수(水)입니다. 수영·족욕·충분한 수분 섭취가 운과 건강 모두의 핵심입니다.',
            '화': '용신이 수(水)라 지적 활동·사색이 개운법이지만, 화(火) 부족인 당신에게 수 기운 과다는 불안을 키울 수 있습니다. 지적 활동은 하되 따뜻한 환경에서, 그리고 사색 후에는 가벼운 운동으로 전환하세요.',
            _default: `용신 수(水) 활용 시 ${OHAENG_KR[_wOh]} 부족 체질을 고려하여 과도한 고립·사색은 피하세요.`,
          },
        };
        const yAdvice = yongsinAdvice[yongsin]?.[_wOh] || yongsinAdvice[yongsin]?._default || '';
        if (yAdvice) {
          answer += `\n\n🎯 용신↔건강 교차분석: ${yAdvice}`;
        }
      }
    }

    
  return answer;
}
