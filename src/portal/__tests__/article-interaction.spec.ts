import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PortalArticleInteraction from '../PortalArticleInteraction.vue'
import { fetchArticleComments, likeArticle, submitArticleComment } from '../api/portalPublic'

/**
 * 门户评论区与点赞（P9-C / G-08 访客侧）。
 *
 * 钉四条会被静默做坏的规矩，每一条都是「界面说的话与库里发生的事不一致」那种形状：
 * 1. 后端的错误与回执**原样念**，不换成一句通用的「提交失败」——对着输入框的人要的是知道哪一格不对；
 * 2. 提交成功**不把自己那条插进列表**：默认口径是先进人工待审，插进去就是谎报「已经发布了」；
 * 3. 点赞数以接口回的当前总数为准，绝不本地 +1；
 * 4. 蜜罐字段留在源码里但不初值、不占 Tab；评论正文按纯文本渲染，不 v-html。
 */

vi.mock('../api/portalPublic', () => ({
  fetchArticleComments: vi.fn(),
  likeArticle: vi.fn(),
  submitArticleComment: vi.fn()
}))

function comments(overrides: Partial<{ items: unknown[], total: number, likeCount: number }> = {}) {
  return {
    items: [
      { id: 1, authorName: '读者甲', content: '讲得很清楚', createdAt: '2026-10-01T09:00:00' },
      { id: 2, authorName: null, content: '<script>alert(1)</script> 这条里有尖括号', createdAt: null }
    ],
    total: 2,
    likeCount: 12,
    ...overrides
  }
}

async function mountBox() {
  const wrapper = mount(PortalArticleInteraction, { props: { idOrSlug: '42' } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchArticleComments).mockResolvedValue(comments() as any)
  vi.mocked(likeArticle).mockResolvedValue({ likeCount: 13, recorded: true })
  vi.mocked(submitArticleComment).mockResolvedValue({ accepted: true, needsReview: true, message: '已提交，站主审核通过后会显示在页面上' })
})

describe('读回来的列表', () => {
  it('点赞数与条数取自接口那一份，正文按纯文本渲染', async () => {
    const wrapper = await mountBox()

    expect(fetchArticleComments).toHaveBeenCalledWith('42', 1, 10)
    expect(wrapper.find('#portal-like-button').text()).toContain('12')
    const rows = wrapper.findAll('.portal-interaction__item')
    expect(rows).toHaveLength(2)
    // 后端不收带标签的内容，但历史行里可能就有：这里必须是文本节点而不是 v-html
    expect(rows[1].find('script').exists()).toBe(false)
    expect(rows[1].text()).toContain('<script>alert(1)</script>')
    expect(wrapper.text()).toContain('匿名读者')
  })

  it('列表读失败说的是那句后端报错，不渲成「还没有人评论过」', async () => {
    vi.mocked(fetchArticleComments).mockRejectedValue(new Error('门户数据获取失败'))

    const wrapper = await mountBox()

    expect(wrapper.text()).toContain('门户数据获取失败')
    expect(wrapper.text()).not.toContain('还没有评论')
  })
})

describe('点赞', () => {
  it('数字以接口回的总数为准，绝不本地加一', async () => {
    const wrapper = await mountBox()
    vi.mocked(likeArticle).mockResolvedValue({ likeCount: 13, recorded: false })

    await wrapper.find('#portal-like-button').trigger('click')
    await flushPromises()

    expect(likeArticle).toHaveBeenCalledWith('42')
    expect(wrapper.find('#portal-like-button').text()).toContain('13')
    expect(wrapper.find('#portal-like-button').text()).not.toContain('14')
  })

  it('同一个人重复点之后按钮就点不动了', async () => {
    const wrapper = await mountBox()

    await wrapper.find('#portal-like-button').trigger('click')
    await flushPromises()

    expect(wrapper.find('#portal-like-button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('你已经点过赞了')
    await wrapper.find('#portal-like-button').trigger('click')
    expect(likeArticle).toHaveBeenCalledTimes(1)
  })

  it('限流那句原样念出来', async () => {
    const wrapper = await mountBox()
    vi.mocked(likeArticle).mockRejectedValue(new Error('操作过于频繁，请稍后再试'))

    await wrapper.find('#portal-like-button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.portal-interaction__error').text()).toBe('操作过于频繁，请稍后再试')
  })
})

describe('写评论', () => {
  it('提交成功后念的是后端那句原话，并且把自己那条重读一遍而不是插进去', async () => {
    const wrapper = await mountBox()

    await wrapper.find('#portal-comment-name').setValue('  李四  ')
    await wrapper.find('#portal-comment-content').setValue('  这篇帮到我了  ')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(submitArticleComment).toHaveBeenCalledWith('42', { authorName: '李四', content: '这篇帮到我了', website: '' })
    expect(wrapper.find('#portal-comment-receipt').text()).toBe('已提交，站主审核通过后会显示在页面上')
    // 表单收走，访客不会再点第二次
    expect(wrapper.find('#portal-comment-submit').exists()).toBe(false)
    // 列表里仍然只有后端给的那两条：自己那条没被插进去谎报「已发布」
    expect(wrapper.findAll('.portal-interaction__item')).toHaveLength(2)
    expect(fetchArticleComments).toHaveBeenCalledTimes(2)
  })

  it('安全闸判过直接显示时念的也是后端那句，前端不按 needsReview 自造文案', async () => {
    vi.mocked(submitArticleComment).mockResolvedValue({ accepted: true, needsReview: false, message: '已发布，感谢留言' })
    const wrapper = await mountBox()

    await wrapper.find('#portal-comment-content').setValue('很实在的一篇')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('#portal-comment-receipt').text()).toBe('已发布，感谢留言')
  })

  it('后端的真错原样回给访客，不演一次成功', async () => {
    const wrapper = await mountBox()
    vi.mocked(submitArticleComment).mockRejectedValue(new Error('评论里不许带标签'))

    await wrapper.find('#portal-comment-content').setValue('<b>加粗</b>试试')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('.portal-interaction__error').text()).toBe('评论里不许带标签')
    // 表单还在：这条没成，人应该能改完再发
    expect(wrapper.find('#portal-comment-submit').exists()).toBe(true)
    expect(wrapper.find('#portal-comment-receipt').exists()).toBe(false)
  })

  it('两个字都不到就不发请求，当场说清是哪一格', async () => {
    const wrapper = await mountBox()

    await wrapper.find('#portal-comment-content').setValue('好')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(submitArticleComment).not.toHaveBeenCalled()
    expect(wrapper.find('.portal-interaction__error').text()).toBe('评论至少写 2 个字')
  })

  it('蜜罐留在源码里但不初值、不占 Tab，机器人填了就照它的回执演一次成功', async () => {
    const wrapper = await mountBox()
    vi.mocked(submitArticleComment).mockResolvedValue({ accepted: false, needsReview: false, message: '已提交，感谢留言' })

    const honeypot = wrapper.find('#portal-comment-website')
    expect(honeypot.exists()).toBe(true)
    expect((honeypot.element as HTMLInputElement).value).toBe('')
    expect(honeypot.attributes('tabindex')).toBe('-1')

    await honeypot.setValue('http://spam.example')
    await wrapper.find('#portal-comment-content').setValue('正常一句话')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(vi.mocked(submitArticleComment).mock.calls[0][1]).toMatchObject({ website: 'http://spam.example' })
    expect(wrapper.find('#portal-comment-receipt').text()).toBe('已提交，感谢留言')
  })
})

describe('翻页', () => {
  it('还有未读到的条数时才摆展开入口，点开带的是下一页', async () => {
    vi.mocked(fetchArticleComments).mockResolvedValue(comments({ total: 25 }) as any)
    const wrapper = await mountBox()

    const more = wrapper.find('.portal-interaction__link')
    expect(more.text()).toContain('还有 23 条')

    await more.trigger('click')
    await flushPromises()

    expect(fetchArticleComments).toHaveBeenLastCalledWith('42', 2, 10)
    expect(wrapper.findAll('.portal-interaction__item')).toHaveLength(4)
    expect(wrapper.find('.portal-interaction__link').text()).toContain('还有 21 条')
  })

  it('后端只回了这些条时不摆展开入口', async () => {
    const wrapper = await mountBox()

    expect(wrapper.find('.portal-interaction__link').exists()).toBe(false)
  })
})
