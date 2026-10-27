/**
 * 「调用日志」那张表里「类型」这一列的唯一一份词表（M-P84 第 7 条拍板）。
 *
 * <p>这一列取的是后端 `ai_call_log.purpose`，含义是「这一发 AI 调用花在哪件事上」，
 * 与「模型类型」（聊天/视觉/向量/图像，见 `AiModelTypes`）是两套完全不同的词。
 * 旧词表拿后者去筛前者，界面上选任何一档都永远筛不到行。</p>
 *
 * <p>名单来源：后端唯一写手 `AiCallLogService#insertLog` 的全部调用方，
 * 逐处 grep 出真正会落进 `purpose` 的字面量与常量。`site_brief_image_v1` 刻意不在这里——
 * 那只是配图<em>措辞</em>的提示词模板名，出图那一发落库的是 `site_brief_image`。</p>
 *
 * <p>库里以后新增一种用途时要在这一处补一行；没补的行不会变成筛不到，
 * 界面会原样念出那个码，并把这一页见到过的没登记值也摆进下拉。</p>
 */

export interface AiCallPurposeOption {
  value: string
  label: string
}

export interface AiCallPurposeGroup {
  title: string
  options: AiCallPurposeOption[]
}

/** 下拉里没登记到的值归这一组，与登记过的分开摆，免得看着像同一族 */
export const UNGROUPED_PURPOSE_TITLE = '其他（界面还没登记这个名字）'

export const AI_CALL_PURPOSE_GROUPS: AiCallPurposeGroup[] = [
  {
    title: '建站方案',
    options: [
      { value: 'site_spec_draft_v1', label: '建站说明书初稿' },
      { value: 'site_brief_section_advice_v1', label: '建站栏目建议' },
      { value: 'site_brief_plan_v1', label: '网站方案（结构）' },
      { value: 'site_brief_plan_fix_v1', label: '网站方案被拦后重问' },
      { value: 'site_brief_copy_v1', label: '网站页面文案' },
      { value: 'site_brief_copy_fix_v1', label: '文案改违禁词' },
      { value: 'site_brief_seo_v1', label: '网站页面 SEO' },
      { value: 'site_brief_showcase_v1', label: '网站展示内容' },
      { value: 'site_brief_unify_v1', label: '全站页眉页脚统一' },
      { value: 'site_brief_image', label: '网站配图生成' },
    ],
  },
  {
    title: '参考站拆解',
    options: [
      { value: 'reference_structure_induction', label: '参考站结构归纳' },
      { value: 'reference_structure_from_shots', label: '参考站截图看结构' },
      { value: 'reference_block_mapping', label: '参考站板块对应' },
    ],
  },
  {
    title: '门户运营',
    options: [
      { value: 'portal_assembly_plan', label: '整站组装（选页排布）' },
      { value: 'portal_assembly_copy', label: '整站组装（页面文案）' },
      { value: 'portal_revision_draft', label: '工单改页草稿' },
      { value: 'page_health_review', label: '页面巡检整改建议' },
    ],
  },
  {
    title: '内容生产',
    options: [
      { value: 'article_generate', label: '文章生成' },
      { value: 'article_review', label: '文章质检' },
      { value: 'content_safety', label: '内容安全判定' },
      { value: 'translation', label: '文章翻译' },
      { value: 'seo_generation', label: 'SEO 文案生成' },
      { value: 'case_ai_draft', label: '客户案例起草' },
    ],
  },
  {
    title: 'GEO / SEO 诊断',
    options: [
      { value: 'geo_campaign_ask', label: 'GEO 诊断（问模型）' },
      { value: 'geo_campaign_ask_judge', label: 'GEO 诊断（判回答）' },
      { value: 'geo_opportunity_faq_draft', label: 'GEO 机会问题写答复' },
      { value: 'citation_probe_ask', label: '品牌引用探测' },
    ],
  },
  {
    title: '知识库',
    options: [
      { value: 'knowledge_qa', label: '知识库问答' },
      { value: 'knowledge_qa_stream', label: '知识库问答（流式）' },
      { value: 'knowledge_card_generation', label: '知识卡片生成' },
      { value: 'knowledge_entity_extraction', label: '知识实体抽取' },
      { value: 'knowledge_image_ocr', label: '图片文字识别' },
    ],
  },
  {
    title: '关键词',
    options: [
      { value: 'keyword_distill', label: '关键词提炼' },
      { value: 'keyword_suggestions', label: '关键词建议' },
    ],
  },
  {
    title: '读者互动',
    options: [
      { value: 'comment_moderation', label: '评论审核' },
      { value: 'comment_seed', label: 'AI 种子评论' },
    ],
  },
  {
    title: '模型与向量',
    options: [
      { value: 'embedding', label: '向量化' },
      { value: 'admin_image_probe', label: '生图模型测试' },
    ],
  },
]

/** 码 → 人话名的摊平表，只给「查一个」用；下拉的分组顺序仍以 AI_CALL_PURPOSE_GROUPS 为准 */
export const AI_CALL_PURPOSE_LABEL: Record<string, string> = Object.fromEntries(
  AI_CALL_PURPOSE_GROUPS.flatMap((group) => group.options.map((o) => [o.value, o.label])),
)

/**
 * 那一格念什么：登记过的人话名，没登记的原样念码。
 *
 * <p>回落成原码是故意的——这一列宁可看着生涩，也不能替它编一个名字，
 * 也不能像旧词表那样把没命中的值显示成空。</p>
 */
export function aiCallPurposeLabel(raw: unknown): string {
  const value = String(raw ?? '')
  if (!value) return ''
  return AI_CALL_PURPOSE_LABEL[value] ?? value
}

/** 下拉的匹配：人打「文案」也能找到「网站页面文案」，打原码同样命中 */
export function matchesPurposeOption(input: string, option: { label?: unknown; value?: unknown }): boolean {
  const kw = (input || '').trim().toLowerCase()
  if (!kw) return true
  return String(option?.label ?? '').toLowerCase().includes(kw)
    || String(option?.value ?? '').toLowerCase().includes(kw)
}
