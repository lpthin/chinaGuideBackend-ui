import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FoldedText from '../FoldedText.vue'
import { SENTENCE_MAX_CHARS, firstSentence, hasFoldableRaw, jsonMessageSentence } from '../foldedTextModel'

/**
 * 「人话一句话 + 原文折进展开」这一族钉四件事（他拍板的那条排版口径，正档 Spec-M §10.16）：
 *
 * 1. 取句只截不造：截出来那句必须是原文的前半段，不许出现后端没说的意思；
 * 2. 接口原样回的 JSON 体不能当人话摆：那一支走错误字段取句；
 * 3. 原文一个字都不丢，且只在真有多余内容时才多那一下点击；
 * 4. 空读数念「没填」，不许念成「无 / 已完成 / 成功」。
 *
 * 判据集中在 `foldedTextModel.ts` 一处：三处文字墙与向导四步都从这里取，
 * 所以这一份用例钉的是那一个函数，不是某一页的排版。
 */

const PASS = (name: string) => ({
  name,
  props: ['header'],
  template: `<div class="${name}-stub"><span class="hdr">{{ header }}</span><slot /></div>`
})

function render(props: Record<string, any>) {
  return mount(FoldedText, {
    props,
    global: { stubs: { 'a-collapse': PASS('a-collapse'), 'a-collapse-panel': PASS('a-collapse-panel') } }
  })
}

function line(wrapper: ReturnType<typeof render>) {
  return wrapper.find('.folded-text__line').text()
}

/** 2037 字那面墙的原型：画廊那张卡上挂着的就是接口回的一条 JSON 体 */
const GALLERY_ERROR_BODY = JSON.stringify({
  code: 401,
  message: '预览令牌没签：这一套还没有可发给客户的地址',
  data: null,
  traceId: 'a'.repeat(32)
})

describe('foldedTextModel.firstSentence', () => {
  it('第一个非空行里在第一个句读处收口，后面的段落一个字都不进那一行', () => {
    const raw = '这一段的结论：三家样本里只有第二家把导航写全了。\n第二段是 480 字的分析过程。\n第三段还有表格。'
    expect(firstSentence(raw)).toBe('这一段的结论：三家样本里只有第二家把导航写全了')
  })

  it('整行没有句读时按 60 字截并补省略号，截出来那句仍是原文的前缀', () => {
    const raw = '字'.repeat(SENTENCE_MAX_CHARS + 20)
    const cut = firstSentence(raw)
    expect(cut.length).toBe(SENTENCE_MAX_CHARS + 1)
    expect(cut.endsWith('…')).toBe(true)
    expect(raw.startsWith(cut.slice(0, SENTENCE_MAX_CHARS))).toBe(true)
  })

  it('空读数回空串：由调用方去说「没填」，这里不造那一句', () => {
    expect(firstSentence(null)).toBe('')
    expect(firstSentence(undefined)).toBe('')
    expect(firstSentence('   \n  \n')).toBe('')
    expect(firstSentence('\n  第一句在这里。')).toBe('第一句在这里')
  })

  it('句读取的是最早那一个，中英文标点都算', () => {
    expect(firstSentence('先说这个；再说那个。')).toBe('先说这个')
    expect(firstSentence('Done! Next step')).toBe('Done')
  })
})

describe('foldedTextModel.jsonMessageSentence', () => {
  it('JSON 体按 message 取那一句人话，不把 {"code":401… 摆到屏上', () => {
    expect(jsonMessageSentence(GALLERY_ERROR_BODY)).toBe('预览令牌没签：这一套还没有可发给客户的地址')
  })

  it('嵌套里才有的 message 也认；数组里任一项有就取那一项', () => {
    expect(jsonMessageSentence(JSON.stringify({ errors: [{ detail: '这一发的凭据过期了' }] }))).toBe('这一发的凭据过期了')
  })

  it('不是 JSON、解析坏了、或那些键一个都没有 ⇒ 回 null，调用方退回按行取句', () => {
    expect(jsonMessageSentence('这不是 JSON')).toBeNull()
    expect(jsonMessageSentence('{坏掉的 JSON')).toBeNull()
    expect(jsonMessageSentence(JSON.stringify({ code: 500, data: null }))).toBeNull()
  })
})

describe('foldedTextModel.hasFoldableRaw', () => {
  it('一句短话不摆展开：多余的那一下点击是给界面自己加戏', () => {
    expect(hasFoldableRaw('就差签字这一发。', '就差签字这一发')).toBe(false)
  })

  it('多行、比那句长、或看着像机器话 ⇒ 摆展开（原文不许丢）', () => {
    expect(hasFoldableRaw('第一句。\n第二句还长着呢', '第一句')).toBe(true)
    expect(hasFoldableRaw('一'.repeat(200), '一')).toBe(true)
    expect(hasFoldableRaw(GALLERY_ERROR_BODY, '预览令牌没签：这一套还没有可发给客户的地址')).toBe(true)
  })

  it('空原文不摆展开', () => {
    expect(hasFoldableRaw('', 'x')).toBe(false)
    expect(hasFoldableRaw(null, 'x')).toBe(false)
  })

  it('拼好的那句里一个后端的字都没有 ⇒ 必须摆展开：按长度比会判成「没什么可折」，后端原话就此从界面上消失', () => {
    // 这是需求单详情那条降级说明的真形状：16 字的原话，配上 17 字的人话标题
    expect(hasFoldableRaw('演示内容是 AI 生成的，交付后可替换', '这一套有 1 条降级说明要对你说的话')).toBe(true)
  })

  it('拼好的那句已经把整份原话逐字含在里面 ⇒ 不摆展开：展开里没有一个新字', () => {
    expect(hasFoldableRaw('这一单还没有客户选定的答复。', '转正被后端拒了：这一单还没有客户选定的答复')).toBe(false)
  })

  it('被截过的那一句不算「已经念完」：省略号后面的字还留在展开里', () => {
    const long = `${'一'.repeat(SENTENCE_MAX_CHARS)}还有后半截没念出来`
    expect(hasFoldableRaw(long, `${'一'.repeat(SENTENCE_MAX_CHARS)}…`)).toBe(true)
  })
})

describe('FoldedText 组件', () => {
  it('默认只那一句人话，原文在展开里逐字带着', () => {
    const w = render({ raw: '这一套的结论是案例优先。\n理由是第二家样本的导航里只有一个入口。', rawLabel: '后端原话（逐字）' })
    expect(line(w)).toBe('这一套的结论是案例优先')
    expect(w.find('.a-collapse-panel-stub').text()).toContain('理由是第二家样本的导航里只有一个入口')
    expect(w.find('.a-collapse-panel-stub .hdr').text()).toBe('后端原话（逐字）')
  })

  it('接口回的 JSON 体：那一行念人话，机器话整份折在下面', () => {
    const w = render({ raw: GALLERY_ERROR_BODY })
    expect(line(w)).toBe('预览令牌没签：这一套还没有可发给客户的地址')
    expect(w.find('.folded-text__raw').text()).toContain('"traceId"')
  })

  it('调用方拼好的那句优先于取句', () => {
    const w = render({ raw: 'SPEC_NOT_CONFIRMED：先签字', summary: '这一版还没签字，生成会被拦下' })
    expect(line(w)).toBe('这一版还没签字，生成会被拦下')
  })

  it('没读数时念「没填」，不念成「无 / 已完成」', () => {
    const w = render({ raw: null })
    expect(line(w)).toBe('没填')
    expect(w.find('.folded-text__fold').exists()).toBe(false)
  })

  it('那一句永远走插值：接口原话里带标签也不许被当 HTML 渲', () => {
    const w = render({ raw: '<img src=x onerror=alert(1)> 这一句是后端原话', summary: '后端回了一句带标签的原话' })
    expect(line(w)).toBe('后端回了一句带标签的原话')
    const raw = w.find('.folded-text__raw')
    expect(raw.text()).toContain('<img src=x')
    expect(raw.element.querySelector('img')).toBeNull()
    expect(w.html()).not.toContain('<img')
  })

  it('error 那一档只改颜色不改字：失败原因要一眼看见，内容还是那一份', () => {
    const w = render({ raw: '配图那一步失败了', tone: 'error' })
    expect(w.find('.folded-text').classes()).toContain('folded-text--error')
    expect(line(w)).toBe('配图那一步失败了')
  })
})
