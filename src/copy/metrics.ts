/**
 * 指标口径文案唯一出处（Spec-F §5；UI 只许引用、不许另写，§9.7：集中的是出处不是改写）。
 * StatCard 的 tooltip、TrendNote 的横幅只从这里取文本。
 */
export type MetricCopy = { name: string; tip: string }

export const METRIC_COPY = {
  mention_rate: {
    name: '提及率',
    tip: '该平台、该轮里，提到品牌的成功回答数 ÷ 该平台成功回答总数。分母只算成功调用；失败/超时单独计数显示「N 次未取到」。',
  },
  recommend_rate: {
    name: '推荐率',
    tip: '在推荐位（prominence=RECOMMENDED）的成功回答数 ÷ 该平台成功回答总数。「提到」和「在推荐位」两个数必须同时出现，不许合并。',
  },
  citation_rate: {
    name: '引用链接率',
    tip: '答案里带出本站链接（cited_url_present=1）的成功回答数 ÷ 成功回答数。与提及率永远分列，不是一回事。',
  },
  ai_sov: {
    name: 'AI SOV',
    tip: '本品牌提及次数 ÷（本品牌 + 全部启用竞品提及次数之和）。分母必须在界面上可见；竞品未勾选进分母时，这里给的是开放分母口径。',
  },
  prompt_coverage: {
    name: '问题覆盖率',
    tip: '已覆盖（本站有页面对得上该题）题数 ÷ 追踪题数。「覆盖」= 页面存在；「被引用」是另一条指标，两者不许混。',
  },
  opportunity: {
    name: '机会问题',
    tip: '未被覆盖的题 + 覆盖但未被引用的题。每类标 gap_type，对应动作不同：前者补页面，后者改内容。',
  },
  sentiment: {
    name: '情感三档',
    tip: 'POS / NEU / NEG 占比，分母 = 提及该品牌的回答数。每档必须带判定理由与原文引句，点不开就不许出这个数。',
  },
  confidence: {
    name: '置信区间',
    tip: '每题每平台至少 3 次重复，Wilson 区间。界面上任何率都带 ±。口径提示：同日两轮引用池重合仅 32–43%，别把单轮波动当趋势。',
  },
  prominence: {
    name: '露出档位',
    tip: 'RECOMMENDED（在推荐位）/ MENTIONED（顺带提及）/ PASSED（未提及）三档，另有答案里的位置序号。AI 答案没有名次，只有档位。',
  },
} as const satisfies Record<string, MetricCopy>

export type MetricKey = keyof typeof METRIC_COPY

/**
 * 三条硬禁令，以数据形式存在并被测试钉住（§5）：
 * 1. 不做跨平台合并总分；2. AI 答案措辞禁用「排名」，只用推荐位/顺带提及；3. 任何率必须露出分母。
 * 注意：禁令文本本身带「排名」二字是禁令说明，不是界面措辞——测试扫的是 METRIC_COPY 各 tip。
 */
export const METRIC_HARD_RULES = {
  noCombinedScore: '禁止把多平台加权成一个跨平台总分；替代物是「分平台 × 分指标」矩阵，不是一个数。',
  noRankingWording: 'AI 答案无名次：界面措辞禁用「排名」，一律 prominence 三档（推荐位/顺带提及/未提及）。',
  denominatorVisible: '界面上每一个率都必须能点开看到分母与原始回答；点不开的数字不许出现在报告里。',
} as const

/** TrendNote 组件的固定横幅文本（§9.2-9、§5 禁令 2 的口径说明） */
export const TREND_NOTE =
  '本报告为 API 口径：模型接口返回的答案，不等于你在豆包等 App 里看到的答案。同一品牌同日两轮的引用池重合仅 32–43%，看趋势请对比不同日期的轮次。'
