/**
 * 신살 (神煞) 시스템
 * 사주에 나타나는 특수한 기운을 판별
 * 길신(좋은 기운)과 흉신(나쁜 기운)으로 나뉨
 */

export interface SinsalInfo {
  name: string;
  hanja: string;
  type: 'good' | 'bad' | 'neutral';
  emoji: string;
  shortDesc: string;
  fullDesc: string;
  effect: {
    personality: string;
    fortune: string;
    love: string;
    career: string;
    advice: string;
  };
}

// ========== 길신 (吉神) - 좋은 신살 ==========

const SINSAL_DATA: Record<string, SinsalInfo> = {
  // ===== 길신 =====
  '천을귀인': {
    name: '천을귀인', hanja: '天乙貴人', type: 'good', emoji: '⭐',
    shortDesc: '최고의 귀인운, 어려울 때 반드시 도움을 받음',
    fullDesc: '천을귀인은 모든 신살 중 가장 귀한 길신입니다. 이 신살이 있으면 어떤 어려운 상황에서도 누군가가 나타나 도와줍니다. 총명하고 품위가 있으며, 사회적으로 존경받는 위치에 오를 수 있습니다.',
    effect: {
      personality: '품위 있고 지적이며 사교성이 뛰어납니다. 사람들에게 존경을 받고, 자연스러운 카리스마가 있습니다.',
      fortune: '평생 귀인의 도움을 받습니다. 큰 위기에서도 극적으로 벗어나며, 사회적 지위가 높아질 운명입니다.',
      love: '좋은 배우자를 만날 운이 강합니다. 상대방이 귀인이 되어줄 수 있습니다.',
      career: '관직, 교육, 법률, 의료 등 전문직에서 크게 성공합니다.',
      advice: '받은 도움에 감사하고, 당신도 다른 사람의 귀인이 되어주세요.'
    }
  },
  '천덕귀인': {
    name: '천덕귀인', hanja: '天德貴人', type: 'good', emoji: '🌟',
    shortDesc: '하늘의 덕으로 재앙을 피하는 복덕',
    fullDesc: '천덕귀인은 하늘이 내린 덕(德)을 의미합니다. 이 신살이 있으면 재앙이 와도 자연스럽게 피해가고, 주변에 덕을 베풀어 복이 돌아옵니다.',
    effect: {
      personality: '자비롭고 너그러우며 도덕적 품성이 높습니다. 어디서든 환영받습니다.',
      fortune: '큰 재앙을 피하고 자연스럽게 복이 찾아옵니다. 베푸는 만큼 돌아옵니다.',
      love: '따뜻하고 헌신적인 관계를 맺습니다.',
      career: '사회복지, 종교, 의료, 교육 분야에서 성공합니다.',
      advice: '덕을 쌓는 삶을 계속하세요. 그것이 최고의 보험입니다.'
    }
  },
  '월덕귀인': {
    name: '월덕귀인', hanja: '月德貴人', type: 'good', emoji: '🌙',
    shortDesc: '달의 은혜로운 기운, 모성적 보호',
    fullDesc: '월덕귀인은 달의 온화한 기운을 받은 신살입니다. 어머니처럼 따뜻한 보호를 받으며, 가정에서의 행복이 보장됩니다.',
    effect: {
      personality: '온화하고 포용력이 있으며, 가정적입니다.',
      fortune: '가정운이 좋고, 특히 어머니나 여성 어른의 도움을 받습니다.',
      love: '안정적이고 따뜻한 가정을 이룹니다.',
      career: '가정과 관련된 사업이나 서비스업에서 성공합니다.',
      advice: '가정의 화목이 모든 행운의 근본입니다.'
    }
  },
  '문창귀인': {
    name: '문창귀인', hanja: '文昌貴人', type: 'good', emoji: '📚',
    shortDesc: '학문과 문서에 탁월한 재능',
    fullDesc: '문창귀인은 학문과 글에 관한 최고의 길신입니다. 이 신살이 있으면 공부를 잘하고, 시험에 강하며, 문서 관련 일에서 행운이 따릅니다.',
    effect: {
      personality: '총명하고 학구적이며, 언어 능력이 뛰어납니다. 글쓰기에 재능이 있습니다.',
      fortune: '시험운이 매우 좋습니다. 자격증, 합격, 학위 취득에 유리합니다.',
      love: '지적인 대화가 통하는 인연을 만납니다.',
      career: '작가, 교사, 학자, 언론, 법조계에서 빛을 발합니다.',
      advice: '끊임없이 배우고 기록하세요. 지식이 당신의 최고 자산입니다.'
    }
  },
  '학당귀인': {
    name: '학당귀인', hanja: '學堂貴人', type: 'good', emoji: '🎓',
    shortDesc: '배움의 전당, 학업과 교육의 행운',
    fullDesc: '학당귀인은 학문의 전당에 앉아있는 것과 같은 길신입니다. 평생 배움이 끊이지 않고, 가르치는 일에서도 성공합니다.',
    effect: {
      personality: '지적 호기심이 강하고 연구하는 것을 좋아합니다.',
      fortune: '학업과 관련된 모든 일에서 행운이 따릅니다.',
      love: '같이 성장하고 배우는 관계를 원합니다.',
      career: '교육, 연구, 학술 분야에서 크게 성공합니다.',
      advice: '배움에 끝은 없습니다. 평생학습이 당신의 길입니다.'
    }
  },
  '천관귀인': {
    name: '천관귀인', hanja: '天官貴人', type: 'good', emoji: '🏛️',
    shortDesc: '관직운이 강하고 리더의 자질',
    fullDesc: '천관귀인은 관직(공직)에서의 성공을 뜻합니다. 조직에서 높은 자리에 오르고, 권한을 부여받는 길신입니다.',
    effect: {
      personality: '리더십이 있고 공정하며 조직 관리 능력이 뛰어납니다.',
      fortune: '승진운이 좋고, 공직이나 대기업에서 높은 지위에 오릅니다.',
      love: '사회적 지위가 높은 상대를 만날 수 있습니다.',
      career: '공무원, 군인, 대기업 임원 등 관직에서 성공합니다.',
      advice: '권력에는 책임이 따릅니다. 공정하게 행사하세요.'
    }
  },
  '금여록': {
    name: '금여록', hanja: '金輿祿', type: 'good', emoji: '🚗',
    shortDesc: '황금 수레를 타는 부귀의 상징',
    fullDesc: '금여록은 황금 수레를 타고 다니는 것처럼 부귀를 누리는 길신입니다. 물질적 풍요와 사회적 지위를 함께 누립니다.',
    effect: {
      personality: '품위 있고 넉넉하며, 타인에게 베풀기를 좋아합니다.',
      fortune: '재물운과 관운이 모두 좋습니다. 사치스럽지 않으면 부를 유지할 수 있습니다.',
      love: '경제적으로 풍요로운 결혼 생활을 할 수 있습니다.',
      career: '금융, 부동산, 고급 서비스업에서 성공합니다.',
      advice: '풍요를 나누면 더 큰 복이 돌아옵니다.'
    }
  },
  '복성귀인': {
    name: '복성귀인', hanja: '福星貴人', type: 'good', emoji: '🍀',
    shortDesc: '행운의 별, 타고난 복',
    fullDesc: '복성귀인은 말 그대로 복의 별입니다. 타고난 행운이 있어 큰 노력 없이도 좋은 결과를 얻는 경우가 많습니다.',
    effect: {
      personality: '낙천적이고 행운을 끌어당기는 체질입니다.',
      fortune: '예상치 못한 곳에서 행운이 찾아옵니다. 횡재수가 있습니다.',
      love: '자연스럽게 좋은 인연이 찾아옵니다.',
      career: '어떤 분야에서든 운 좋게 기회를 잡습니다.',
      advice: '행운에 안주하지 말고 노력을 더하면 더 큰 성공을 거둡니다.'
    }
  },
  '천의성': {
    name: '천의성', hanja: '天醫星', type: 'good', emoji: '🏥',
    shortDesc: '의료와 치유의 재능',
    fullDesc: '천의성은 치유와 의료에 관한 재능을 나타내는 길신입니다. 남을 치유하는 능력이 있으며, 의료계에서 성공할 운명입니다.',
    effect: {
      personality: '타인의 고통에 공감하고 돕고 싶어하는 성향입니다.',
      fortune: '의료, 건강 관련 분야에서 행운이 따릅니다.',
      love: '돌봄과 치유가 있는 관계를 맺습니다.',
      career: '의사, 간호사, 약사, 한의사, 심리상담사 등에서 크게 성공합니다.',
      advice: '치유하는 것이 당신의 사명입니다. 이 길을 따르세요.'
    }
  },

  // ===== 흉신 =====
  '역마살': {
    name: '역마살', hanja: '驛馬殺', type: 'neutral', emoji: '🐴',
    shortDesc: '끊임없이 움직이는 이동의 기운',
    fullDesc: '역마살은 말을 타고 쉬지 않고 달리는 기운입니다. 한곳에 정착하지 못하고 이동이 많지만, 현대 사회에서는 해외 진출, 무역, 여행업 등에서 큰 강점이 됩니다.',
    effect: {
      personality: '활동적이고 한곳에 가만히 있지 못합니다. 새로운 곳, 새로운 경험을 추구합니다.',
      fortune: '이동이 많을수록 운이 좋아집니다. 해외운이 강합니다.',
      love: '원거리 연애나 외국인과의 인연이 있을 수 있습니다.',
      career: '무역, 항공, 관광, 운송, 해외영업에서 크게 성공합니다.',
      advice: '움직이는 것이 당신의 행운입니다. 가만히 있으면 오히려 불운합니다.'
    }
  },
  '도화살': {
    name: '도화살', hanja: '桃花殺', type: 'neutral', emoji: '🌸',
    shortDesc: '이성을 끌어당기는 매력의 기운',
    fullDesc: '도화살은 복숭아꽃처럼 아름답고 매혹적인 기운입니다. 이성에게 인기가 많고 매력적이지만, 잘못 관리하면 이성 문제가 생길 수 있습니다. 연예인이나 서비스업에서는 최고의 신살입니다.',
    effect: {
      personality: '외모가 매력적이고 이성에게 인기가 많습니다. 감성적이고 예술적 감각이 뛰어납니다.',
      fortune: '인기운이 최고입니다. 대중을 상대하는 일에서 성공합니다. 하지만 이성 문제에 주의해야 합니다.',
      love: '연애 기회가 많지만, 바람이나 유혹에 주의해야 합니다. 진정한 사랑을 찾는 눈이 필요합니다.',
      career: '연예인, 모델, 서비스업, 뷰티, 접객업에서 빛을 발합니다.',
      advice: '매력은 축복이자 시험입니다. 현명하게 활용하세요.'
    }
  },
  '화개살': {
    name: '화개살', hanja: '華蓋殺', type: 'neutral', emoji: '🎭',
    shortDesc: '예술과 종교적 감성, 고독한 천재',
    fullDesc: '화개살은 화려한 덮개를 뜻하며, 예술적 재능과 종교적 감수성을 나타냅니다. 천재적 능력이 있지만 고독할 수 있습니다.',
    effect: {
      personality: '예술적 재능이 뛰어나고 독특한 세계관을 가지고 있습니다. 고독을 즐기며 깊은 사색을 합니다.',
      fortune: '예술이나 종교 분야에서 크게 성공할 수 있습니다. 속세의 성공보다 정신적 성취가 중요합니다.',
      love: '평범한 연애보다 영혼의 교감을 원합니다. 고독을 함께할 수 있는 사람이 필요합니다.',
      career: '예술가, 종교인, 철학자, 작가로서 빛을 발합니다.',
      advice: '외로움은 창조의 원천입니다. 고독을 두려워하지 마세요.'
    }
  },
  '겁살': {
    name: '겁살', hanja: '劫殺', type: 'bad', emoji: '⚡',
    shortDesc: '급격한 변화와 위험, 사고 주의',
    fullDesc: '겁살은 급작스러운 사고나 재난의 기운입니다. 하지만 이 에너지를 잘 활용하면 위기를 기회로 바꿀 수 있습니다.',
    effect: {
      personality: '대담하고 모험적이지만 충동적일 수 있습니다.',
      fortune: '갑작스러운 사건에 주의해야 합니다. 하지만 위기 속에서 기회를 잡는 능력도 있습니다.',
      love: '격렬하고 드라마틱한 연애를 경험할 수 있습니다.',
      career: '위험을 감수하는 직업(군인, 경찰, 소방관, 투자)에서 성공할 수 있습니다.',
      advice: '충동을 조절하면 위기를 기회로 바꿀 수 있습니다.'
    }
  },
  '원진살': {
    name: '원진살', hanja: '怨嗔殺', type: 'bad', emoji: '😤',
    shortDesc: '원망과 갈등의 기운',
    fullDesc: '원진살은 서로 원망하고 미워하는 기운입니다. 가까운 사람과의 갈등이 생기기 쉽지만, 이를 극복하면 더 깊은 관계를 맺을 수 있습니다.',
    effect: {
      personality: '예민하고 감정적 갈등이 많을 수 있습니다.',
      fortune: '대인관계에서 마찰이 생길 수 있습니다. 인내와 이해가 필요합니다.',
      love: '사랑과 미움이 교차하는 관계를 경험할 수 있습니다.',
      career: '갈등 해결 능력을 키우면 오히려 협상이나 중재 분야에서 성공합니다.',
      advice: '원망을 이해로 바꾸세요. 그것이 성장의 열쇠입니다.'
    }
  },
  '귀문관살': {
    name: '귀문관살', hanja: '鬼門關殺', type: 'bad', emoji: '👻',
    shortDesc: '영적 감수성이 강하고 정신 세계에 민감',
    fullDesc: '귀문관살은 귀신의 문을 관장하는 기운입니다. 영적 감수성이 매우 높아 보이지 않는 세계를 느끼며, 심리적으로 예민합니다. 종교나 심리, 예술 분야에서 특별한 능력을 발휘합니다.',
    effect: {
      personality: '영적 감수성이 높고 직감이 뛰어납니다. 예민하고 불안해할 수 있지만, 깊은 통찰력이 있습니다.',
      fortune: '정신적 분야에서의 성취가 물질적 성취보다 중요합니다.',
      love: '영적 교감이 있는 깊은 관계를 원합니다.',
      career: '심리상담사, 종교인, 영적 지도자, 예술가로서 빛을 발합니다.',
      advice: '두려움을 지혜로 바꾸세요. 당신의 감수성은 특별한 재능입니다.'
    }
  },
  '양인살': {
    name: '양인살', hanja: '羊刃殺', type: 'bad', emoji: '🗡️',
    shortDesc: '날카롭고 강한 에너지, 승부욕',
    fullDesc: '양인살은 양의 뿔처럼 날카로운 기운입니다. 성격이 강하고 승부욕이 세며, 칼날 같은 결단력이 있습니다. 잘 쓰면 최고의 실력자가 되지만, 잘못 쓰면 사고를 당합니다.',
    effect: {
      personality: '결단력이 강하고 승부욕이 세며, 타협하지 않습니다.',
      fortune: '큰 성공과 큰 실패가 교차합니다. 승부사의 운명입니다.',
      love: '강렬하고 소유욕 강한 연애를 합니다.',
      career: '외과의사, 군인, 운동선수, 변호사 등 승부가 필요한 직업에서 성공합니다.',
      advice: '날카로움을 정의를 위해 쓰세요. 그것이 양인의 올바른 사용법입니다.'
    }
  },
  '백호살': {
    name: '백호살', hanja: '白虎殺', type: 'bad', emoji: '🐯',
    shortDesc: '혈광과 사고의 기운, 강한 액운',
    fullDesc: '백호살은 백호(흰 호랑이)의 사나운 기운입니다. 수술, 교통사고, 출혈 등 혈광(血光)에 주의해야 합니다. 하지만 의료계나 군사 분야에서는 오히려 좋은 기운이 됩니다.',
    effect: {
      personality: '용맹하고 강인하지만 거친 면이 있습니다.',
      fortune: '사고나 수술에 주의해야 합니다. 보험 가입이 필수입니다.',
      love: '다툼이나 갈등이 있을 수 있습니다.',
      career: '외과의사, 군인, 정육업, 요리사 등 칼과 관련된 직업에서 성공합니다.',
      advice: '안전에 항상 주의하세요. 위험을 인지하면 피할 수 있습니다.'
    }
  },
  '공망': {
    name: '공망', hanja: '空亡', type: 'bad', emoji: '🕳️',
    shortDesc: '비어있는 기운, 허무와 무상',
    fullDesc: '공망은 기운이 비어있는 상태입니다. 노력해도 결과가 잘 안 나타나는 듯하지만, 물질을 초월한 정신적 분야에서는 오히려 큰 성취가 가능합니다.',
    effect: {
      personality: '초탈한 면이 있고, 세속적 욕심이 적습니다.',
      fortune: '세속적 성공이 어려울 수 있지만, 정신적 깨달음은 깊어집니다.',
      love: '집착 없는 자유로운 관계를 원합니다.',
      career: '종교, 철학, 예술, 봉사 분야에서 성취를 이룹니다.',
      advice: '비어있기에 채울 수 있습니다. 공망은 무한한 가능성입니다.'
    }
  },
};

// ========== 신살 판별 로직 ==========

const JIJI_IDX: Record<string, number> = {
  '자': 0, '축': 1, '인': 2, '묘': 3, '진': 4, '사': 5,
  '오': 6, '미': 7, '신': 8, '유': 9, '술': 10, '해': 11,
};

const CHEONGAN_IDX: Record<string, number> = {
  '갑': 0, '을': 1, '병': 2, '정': 3, '무': 4,
  '기': 5, '경': 6, '신': 7, '임': 8, '계': 9,
};

/**
 * 천을귀인 판별
 * 일간별 천을귀인이 되는 지지
 */
const CHEONEUL_GWIIN: Record<string, string[]> = {
  '갑': ['축', '미'], '무': ['축', '미'],
  '을': ['자', '신'], '기': ['자', '신'],
  '병': ['해', '유'], '정': ['해', '유'],
  '경': ['축', '미'], '신': ['인', '오'],
  '임': ['묘', '사'], '계': ['묘', '사'],
};

/**
 * 문창귀인 판별
 */
const MUNCHANG_GWIIN: Record<string, string> = {
  '갑': '사', '을': '오', '병': '신', '정': '유', '무': '신',
  '기': '유', '경': '해', '신': '자', '임': '인', '계': '묘',
};

/**
 * 도화살 판별 (일지 또는 년지 기준)
 */
const DOHWA_SAL: Record<string, string> = {
  '자': '유', '축': '오', '인': '묘', '묘': '자',
  '진': '유', '사': '오', '오': '묘', '미': '자',
  '신': '유', '유': '오', '술': '묘', '해': '자',
};

/**
 * 역마살 판별 (일지 또는 년지 기준)
 */
const YEOKMA_SAL: Record<string, string> = {
  '자': '인', '축': '해', '인': '신', '묘': '사',
  '진': '인', '사': '해', '오': '신', '미': '사',
  '신': '인', '유': '해', '술': '신', '해': '사',
};

/**
 * 화개살 판별 (일지 또는 년지 기준)
 */
const HWAGAE_SAL: Record<string, string> = {
  '자': '진', '축': '축', '인': '술', '묘': '미',
  '진': '진', '사': '축', '오': '술', '미': '미',
  '신': '진', '유': '축', '술': '술', '해': '미',
};

/**
 * 양인살 판별 (일간 기준)
 */
const YANGIN_SAL: Record<string, string> = {
  '갑': '묘', '병': '오', '무': '오', '경': '유', '임': '자',
  // 음간은 양인이 없음 (일부 학설에서는 있지만 정통에서는 양간만)
};

/**
 * 사주에서 모든 신살을 판별
 */
export function detectAllSinsal(
  ilgan: string,
  yearJiji: string,
  monthJiji: string,
  dayJiji: string,
  hourJiji: string
): SinsalInfo[] {
  const found: SinsalInfo[] = [];
  const allJiji = [yearJiji, monthJiji, dayJiji, hourJiji];

  // 1. 천을귀인
  const cheoneulTargets = CHEONEUL_GWIIN[ilgan] || [];
  for (const jj of allJiji) {
    if (cheoneulTargets.includes(jj)) {
      found.push(SINSAL_DATA['천을귀인']);
      break;
    }
  }

  // 2. 문창귀인
  const munchangTarget = MUNCHANG_GWIIN[ilgan];
  if (munchangTarget && allJiji.includes(munchangTarget)) {
    found.push(SINSAL_DATA['문창귀인']);
  }

  // 3. 도화살 (년지, 일지 기준)
  const dohwaFromYear = DOHWA_SAL[yearJiji];
  const dohwaFromDay = DOHWA_SAL[dayJiji];
  if ((dohwaFromYear && allJiji.includes(dohwaFromYear)) ||
      (dohwaFromDay && allJiji.includes(dohwaFromDay))) {
    found.push(SINSAL_DATA['도화살']);
  }

  // 4. 역마살 (년지, 일지 기준)
  const yeokmaFromYear = YEOKMA_SAL[yearJiji];
  const yeokmaFromDay = YEOKMA_SAL[dayJiji];
  if ((yeokmaFromYear && allJiji.includes(yeokmaFromYear)) ||
      (yeokmaFromDay && allJiji.includes(yeokmaFromDay))) {
    found.push(SINSAL_DATA['역마살']);
  }

  // 5. 화개살 (년지, 일지 기준)
  const hwagaeFromYear = HWAGAE_SAL[yearJiji];
  const hwagaeFromDay = HWAGAE_SAL[dayJiji];
  if ((hwagaeFromYear && allJiji.includes(hwagaeFromYear)) ||
      (hwagaeFromDay && allJiji.includes(hwagaeFromDay))) {
    found.push(SINSAL_DATA['화개살']);
  }

  // 6. 양인살 (일간 기준, 양간만)
  const yangInTarget = YANGIN_SAL[ilgan];
  if (yangInTarget && allJiji.includes(yangInTarget)) {
    found.push(SINSAL_DATA['양인살']);
  }

  // 7. 귀문관살 (인+묘, 사+오 조합 등)
  // 간단 판별: 지지 중 인(寅)과 축(丑), 또는 술(戌)과 해(亥) 조합
  const jijiSet = new Set(allJiji);
  if ((jijiSet.has('인') && jijiSet.has('묘')) || (jijiSet.has('술') && jijiSet.has('해'))) {
    found.push(SINSAL_DATA['귀문관살']);
  }

  // 8. 백호살 판별 (일지 기준 간략화)
  // 인(寅), 신(申)이 충돌하는 경우 등
  if ((jijiSet.has('인') && jijiSet.has('신')) || (jijiSet.has('사') && jijiSet.has('해'))) {
    found.push(SINSAL_DATA['백호살']);
  }

  // 9. 천덕귀인 (월지 기준 간략)
  const CHEONDUK: Record<string, string> = {
    '인': '정', '묘': '신', '진': '임', '사': '신',
    '오': '갑', '미': '계', '신': '임', '유': '을',
    '술': '병', '해': '을', '자': '기', '축': '경',
  };
  if (CHEONDUK[monthJiji] === ilgan) {
    found.push(SINSAL_DATA['천덕귀인']);
  }

  // 10. 천의성 (일간 기준)
  const CHEONUI: Record<string, string> = {
    '갑': '을', '을': '병', '병': '정', '정': '무', '무': '기',
    '기': '경', '경': '신', '신': '임', '임': '계', '계': '갑',
  };
  // 천의성은 일간의 다음 천간이 다른 기둥의 천간에 있을 때 (간략화)

  // 11. 복성귀인 (일간 기준 간략화)
  const BOKSEONG: Record<string, string[]> = {
    '갑': ['인', '자'], '을': ['축', '해'], '병': ['묘', '축'],
    '정': ['인', '자'], '무': ['묘', '축'], '기': ['인', '자'],
    '경': ['사', '묘'], '신': ['진', '인'], '임': ['사', '묘'], '계': ['진', '인'],
  };
  const bokTargets = BOKSEONG[ilgan] || [];
  if (bokTargets.some(t => allJiji.includes(t))) {
    found.push(SINSAL_DATA['복성귀인']);
  }

  // 12. 학당귀인 (일간 기준)
  const HAKDANG: Record<string, string> = {
    '갑': '해', '을': '오', '병': '인', '정': '유', '무': '인',
    '기': '유', '경': '사', '신': '자', '임': '신', '계': '묘',
  };
  if (HAKDANG[ilgan] && allJiji.includes(HAKDANG[ilgan])) {
    found.push(SINSAL_DATA['학당귀인']);
  }

  // 13. 금여록 (일간 기준)
  const GEUMYEO: Record<string, string> = {
    '갑': '진', '을': '사', '병': '미', '정': '신', '무': '미',
    '기': '신', '경': '술', '신': '해', '임': '축', '계': '인',
  };
  if (GEUMYEO[ilgan] && allJiji.includes(GEUMYEO[ilgan])) {
    found.push(SINSAL_DATA['금여록']);
  }

  // 14. 공망 판별 (일주 기준 간략)
  // 갑자순 공망=술해, 갑술순 공망=신유, 등
  const GONGMANG_MAP: Record<string, string[]> = {
    '갑자': ['술', '해'], '갑술': ['신', '유'], '갑신': ['오', '미'],
    '갑오': ['진', '사'], '갑진': ['인', '묘'], '갑인': ['자', '축'],
  };
  // 일간+일지로 어떤 순(旬)에 속하는지 판별
  const dayGanIdx = CHEONGAN_IDX[ilgan];
  const dayJiIdx = JIJI_IDX[dayJiji];
  const offset = ((dayJiIdx - dayGanIdx) % 12 + 12) % 12;
  const sunStart = ((dayGanIdx - offset + 120) % 10); // 순의 시작 천간 인덱스
  const CHEONGAN_LIST = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const JIJI_LIST2 = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const sunGan = CHEONGAN_LIST[sunStart];
  const sunJiIdx = (dayJiIdx - (dayGanIdx - sunStart) + 12) % 12;
  const sunKey = sunGan + JIJI_LIST2[sunJiIdx];

  if (GONGMANG_MAP[sunKey]) {
    const gongmangJijis = GONGMANG_MAP[sunKey];
    for (const jj of [yearJiji, monthJiji, hourJiji]) {
      if (gongmangJijis.includes(jj)) {
        found.push(SINSAL_DATA['공망']);
        break;
      }
    }
  }

  // 15. 원진살 (일지 기준)
  const WONJIN: Record<string, string> = {
    '자': '미', '축': '오', '인': '사', '묘': '진',
    '진': '묘', '사': '인', '오': '축', '미': '자',
    '신': '해', '유': '술', '술': '유', '해': '신',
  };
  if (WONJIN[dayJiji] && allJiji.includes(WONJIN[dayJiji])) {
    found.push(SINSAL_DATA['원진살']);
  }

  // 16. 천관귀인
  const CHEONGWAN: Record<string, string> = {
    '갑': '미', '을': '진', '병': '사', '정': '인',
    '무': '사', '기': '인', '경': '해', '신': '신',
    '임': '인', '계': '해',
  };
  if (CHEONGWAN[ilgan] && allJiji.includes(CHEONGWAN[ilgan])) {
    found.push(SINSAL_DATA['천관귀인']);
  }

  // 중복 제거
  const uniqueNames = new Set<string>();
  return found.filter(s => {
    if (uniqueNames.has(s.name)) return false;
    uniqueNames.add(s.name);
    return true;
  });
}

export { SINSAL_DATA };

// ========== 삼재 (三災) 시스템 ==========

/**
 * 삼재(三災) 판별
 *
 * 삼재는 12년 주기로 3년간 이어지는 재난 기운
 * 연지(띠)를 기준으로 해당 연도의 지지와 비교하여 판별
 *
 * 삼합(三合) 기준:
 * - 인오술(寅午戌) 그룹: 신(申)년에 들삼재 시작 → 유(酉) 눌삼재 → 술(戌) 날삼재
 * - 해묘미(亥卯未) 그룹: 사(巳)년에 들삼재 시작 → 오(午) 눌삼재 → 미(未) 날삼재
 * - 사유축(巳酉丑) 그룹: 해(亥)년에 들삼재 시작 → 자(子) 눌삼재 → 축(丑) 날삼재
 * - 신자진(申子辰) 그룹: 인(寅)년에 들삼재 시작 → 묘(卯) 눌삼재 → 진(辰) 날삼재
 */

export type SamjaeType = '들삼재' | '눌삼재' | '날삼재';

export interface SamjaeInfo {
  active: boolean;          // 현재 삼재 해당 여부
  type: SamjaeType | null;  // 삼재 종류
  year: number;             // 해당 연도
  yearJiji: string;         // 해당 연도 지지
  emoji: string;
  title: string;
  description: string;
  advice: string;
}

export interface SamjaeResult {
  /** 현재 연도 삼재 정보 */
  current: SamjaeInfo;
  /** 향후 12년간 삼재 기간 목록 */
  upcoming: SamjaeInfo[];
  /** 삼재 그룹 이름 (인오술/해묘미/사유축/신자진) */
  groupName: string;
  /** 삼재가 시작되는 지지 3개 */
  samjaeJiji: [string, string, string];
}

// 연지(띠) → 삼재 해당 지지 [들삼재, 눌삼재, 날삼재]
const SAMJAE_MAP: Record<string, [string, string, string]> = {
  // 인오술(寅午戌) 화국 → 신유술
  '인': ['신', '유', '술'],
  '오': ['신', '유', '술'],
  '술': ['신', '유', '술'],
  // 해묘미(亥卯未) 목국 → 사오미
  '해': ['사', '오', '미'],
  '묘': ['사', '오', '미'],
  '미': ['사', '오', '미'],
  // 사유축(巳酉丑) 금국 → 해자축
  '사': ['해', '자', '축'],
  '유': ['해', '자', '축'],
  '축': ['해', '자', '축'],
  // 신자진(申子辰) 수국 → 인묘진
  '신': ['인', '묘', '진'],
  '자': ['인', '묘', '진'],
  '진': ['인', '묘', '진'],
};

// 삼합 그룹 이름
const SAMJAE_GROUP: Record<string, string> = {
  '인': '인오술(寅午戌)', '오': '인오술(寅午戌)', '술': '인오술(寅午戌)',
  '해': '해묘미(亥卯未)', '묘': '해묘미(亥卯未)', '미': '해묘미(亥卯未)',
  '사': '사유축(巳酉丑)', '유': '사유축(巳酉丑)', '축': '사유축(巳酉丑)',
  '신': '신자진(申子辰)', '자': '신자진(申子辰)', '진': '신자진(申子辰)',
};

// 연도 → 지지 변환 (1924=갑자년 기준)
const JIJI_LIST = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
function yearToJiji(year: number): string {
  return JIJI_LIST[(year - 4) % 12];
}

// 삼재 유형별 상세 설명
const SAMJAE_DETAIL: Record<SamjaeType, { emoji: string; title: string; description: string; advice: string }> = {
  '들삼재': {
    emoji: '🔥',
    title: '들삼재 (入三災)',
    description: '삼재가 시작되는 해입니다. 새로운 일을 시작하거나 큰 변화를 시도하기보다는 현상 유지에 집중하는 것이 좋습니다. 예상치 못한 사고, 질병, 대인관계 갈등이 생기기 쉬운 시기입니다.',
    advice: '큰 투자, 이사, 이직, 창업 등 중대한 결정은 신중하게 하세요. 건강검진을 받고, 무리한 여행이나 모험은 피하는 것이 좋습니다. 부적이나 기도로 마음의 안정을 찾는 것도 방법입니다.',
  },
  '눌삼재': {
    emoji: '⚡',
    title: '눌삼재 (留三災)',
    description: '삼재의 절정기입니다. 3년 중 가장 주의가 필요한 해로, 재물 손실, 건강 악화, 관재수 등이 집중될 수 있습니다. 수세적으로 대응하되 포기하지 않는 자세가 중요합니다.',
    advice: '보증, 대출, 투기성 투자는 절대 피하세요. 건강이 최우선이며 무리한 일정을 잡지 마세요. 주변 사람과의 갈등을 최소화하고, 법적 분쟁에 휘말리지 않도록 조심하세요.',
  },
  '날삼재': {
    emoji: '🌅',
    title: '날삼재 (出三災)',
    description: '삼재가 물러나는 마지막 해입니다. 전반기까지는 아직 삼재의 영향이 남아있지만, 하반기부터 서서히 운이 풀리기 시작합니다. 마무리에 집중하면 다음 9년의 좋은 운을 맞이할 수 있습니다.',
    advice: '상반기에는 아직 조심하되, 하반기부터 새로운 계획을 세우기 시작해도 좋습니다. 삼재 기간 동안 쌓인 스트레스를 해소하고, 건강 회복에 힘쓰세요. 새 출발의 준비 시기입니다.',
  },
};

/**
 * 삼재 판별 및 분석
 * @param yearJiji 태어난 해의 지지 (띠)
 * @param currentYear 현재 연도 (양력)
 */
export function analyzeSamjae(yearJiji: string, currentYear: number): SamjaeResult {
  const samjaeJiji = SAMJAE_MAP[yearJiji];
  const groupName = SAMJAE_GROUP[yearJiji] || '';

  if (!samjaeJiji) {
    return {
      current: {
        active: false, type: null, year: currentYear,
        yearJiji: yearToJiji(currentYear), emoji: '✅',
        title: '삼재 아님', description: '올해는 삼재에 해당하지 않습니다.',
        advice: '',
      },
      upcoming: [],
      groupName: '',
      samjaeJiji: ['', '', ''],
    };
  }

  // 현재 연도 삼재 판별
  const curJiji = yearToJiji(currentYear);
  let curType: SamjaeType | null = null;
  if (curJiji === samjaeJiji[0]) curType = '들삼재';
  else if (curJiji === samjaeJiji[1]) curType = '눌삼재';
  else if (curJiji === samjaeJiji[2]) curType = '날삼재';

  const current: SamjaeInfo = curType
    ? {
        active: true, type: curType, year: currentYear, yearJiji: curJiji,
        ...SAMJAE_DETAIL[curType],
      }
    : {
        active: false, type: null, year: currentYear, yearJiji: curJiji,
        emoji: '✅', title: '삼재 아님',
        description: '올해는 삼재에 해당하지 않는 해입니다. 평소처럼 생활하시면 됩니다.',
        advice: '',
      };

  // 향후 12년간 삼재 기간 탐색
  const upcoming: SamjaeInfo[] = [];
  for (let y = currentYear; y <= currentYear + 12; y++) {
    const jj = yearToJiji(y);
    let type: SamjaeType | null = null;
    if (jj === samjaeJiji[0]) type = '들삼재';
    else if (jj === samjaeJiji[1]) type = '눌삼재';
    else if (jj === samjaeJiji[2]) type = '날삼재';

    if (type) {
      upcoming.push({
        active: y === currentYear,
        type,
        year: y,
        yearJiji: jj,
        ...SAMJAE_DETAIL[type],
      });
    }
  }

  return { current, upcoming, groupName, samjaeJiji };
}
