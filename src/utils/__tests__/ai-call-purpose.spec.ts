import { describe, it, expect } from 'vitest'
import {
  AI_CALL_PURPOSE_GROUPS,
  AI_CALL_PURPOSE_LABEL,
  UNGROUPED_PURPOSE_TITLE,
  aiCallPurposeLabel,
  matchesPurposeOption,
} from '../aiCallPurpose'

/**
 * 「调用日志」类型那一列的词表（M-P84 第 7 条拍板）。
 *
 * <p>这一列取的是 `ai_call_log.purpose`＝「这一发调用花在哪件事上」。旧界面拿「模型类型」
 * 那四个词（聊天/视觉/向量/图像）当筛选项，两边零交集，选任何一档都念「没有匹配的行」。</p>
 */

const ALL_VALUES = AI_CALL_PURPOSE_GROUPS.flatMap((group) => group.options.map((o) => o.value))
const ALL_LABELS = AI_CALL_PURPOSE_GROUPS.flatMap((group) => group.options.map((o) => o.label))

/** 2026-10-28 现读 `SELECT purpose, count(*) FROM ai_call_log GROUP BY purpose` 的那 15 个真值 */
const PURPOSES_IN_DB_TODAY = [
  'admin_image_probe',
  'knowledge_image_ocr',
  'portal_assembly_copy',
  'portal_assembly_plan',
  'reference_block_mapping',
  'reference_structure_induction',
  'site_brief_copy_fix_v1',
  'site_brief_copy_v1',
  'site_brief_image',
  'site_brief_plan_fix_v1',
  'site_brief_plan_v1',
  'site_brief_seo_v1',
  'site_brief_showcase_v1',
  'site_brief_unify_v1',
  'site_spec_draft_v1',
]

describe('类型词表：库里翻出来的每一个值都要有人话名', () => {
  it('现读到的 15 个用途全部在词表里，一个都不许漏（漏一个就又是一档永远筛不到）', () => {
    const missing = PURPOSES_IN_DB_TODAY.filter((value) => !AI_CALL_PURPOSE_LABEL[value])
    expect(missing).toEqual([])
  })

  it('每一个值都有一个中文名，名字与组标题都不重复、不为空', () => {
    ALL_VALUES.forEach((value) => {
      const label = AI_CALL_PURPOSE_LABEL[value]
      expect(label, value).toBeTruthy()
      // 名字里必须带中文，纯英文码对看报表的人等于没解释
      expect(label, value).toMatch(/[\u4e00-\u9fa5]/)
    })
    expect(new Set(ALL_VALUES).size).toBe(ALL_VALUES.length)
    expect(new Set(ALL_LABELS).size).toBe(ALL_LABELS.length)
    const titles = AI_CALL_PURPOSE_GROUPS.map((group) => group.title)
    expect(new Set(titles).size).toBe(titles.length)
    expect(titles).not.toContain(UNGROUPED_PURPOSE_TITLE)
  })

  it('「模型类型」那三个裸词不再当筛选项（它们与这一列零交集，是这次要修的那一形）', () => {
    for (const modelType of ['chat', 'vision', 'image']) {
      expect(ALL_VALUES).not.toContain(modelType)
    }
  })

  it('出图那一发用的是 site_brief_image，提示词模板名 site_brief_image_v1 不进下拉', () => {
    expect(ALL_VALUES).toContain('site_brief_image')
    // 现网实测：库里 site_brief_image 有 28 行，site_brief_image_v1 一行都没有。
    // 摆进下拉就是一颗永远筛不到行的选项。
    expect(ALL_VALUES).not.toContain('site_brief_image_v1')
  })
})

describe('没登记的值：宁可念原码，也不替它编名字', () => {
  it('登记过的念人话名', () => {
    expect(aiCallPurposeLabel('site_brief_copy_v1')).toBe('网站页面文案')
  })

  it('没登记的原样念码，空值念空而不是念 undefined', () => {
    expect(aiCallPurposeLabel('some_future_purpose')).toBe('some_future_purpose')
    expect(aiCallPurposeLabel('')).toBe('')
    expect(aiCallPurposeLabel(null)).toBe('')
    expect(aiCallPurposeLabel(undefined)).toBe('')
  })
})

describe('下拉里打字能按人话名也能按原码找到', () => {
  it('按中文名的一部分命中', () => {
    expect(matchesPurposeOption('文案', { label: '网站页面文案', value: 'site_brief_copy_v1' })).toBe(true)
  })

  it('按原码的一部分命中', () => {
    expect(matchesPurposeOption('SHOWCASE', { label: '网站展示内容', value: 'site_brief_showcase_v1' })).toBe(true)
  })

  it('都对不上就不显示这一档', () => {
    expect(matchesPurposeOption('zzz', { label: '网站展示内容', value: 'site_brief_showcase_v1' })).toBe(false)
  })

  it('没打字时全部留着', () => {
    expect(matchesPurposeOption('  ', { label: '任何一档', value: 'anything' })).toBe(true)
  })
})
