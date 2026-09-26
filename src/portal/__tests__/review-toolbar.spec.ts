import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import ReviewToolbar from '../review/ReviewToolbar.vue'
import { SITE_PREVIEW_NOTICE, useReviewMode } from '../useReviewMode'
import { fetchReviewContext } from '../api/portalPublic'

/**
 * 工具条的渲染位置测试。
 *
 * 采集器最容易出的问题是「客户点了提交，屏幕上什么都没发生」：提交成功会清空 selection，
 * 表单那一整块随之卸载，所以提示只要写在表单里面就等于没写。
 *
 * 另一条是这一轮补上的：候选站那条整站预览链接没有工单写口，就算有人把工具条挂了上来，
 * 点「圈选区块」也只能得到那句实话，摆不出填写区——不让客户写完意见才被拒。
 */

const PAGE_CONTEXT = { scope: 'page', ticketWritable: true, label: '逐页批注', expiresAt: null }

vi.mock('../api/portalPublic', () => ({
  PREVIEW_TOKEN_PARAM: 'reviewToken',
  previewTokenOfUrl: vi.fn(() => ''),
  fetchReviewContext: vi.fn(),
  fetchReviewIntentOptions: vi.fn().mockResolvedValue({}),
  submitReviewTicket: vi.fn().mockResolvedValue(undefined)
}))

/** 挂真实控件：setup.ts 全局把 a-button 桩成空壳（不渲染 slot、不 emit），点不到就算没测 */
function mountToolbar() {
  return mount(ReviewToolbar, {
    global: {
      components: { 'a-button': Button },
      stubs: { 'a-button': false, 'a-textarea': true, 'a-select': true }
    }
  })
}

describe('ReviewToolbar', () => {
  beforeEach(() => {
    vi.mocked(fetchReviewContext).mockResolvedValue({ ...PAGE_CONTEXT })
    useReviewMode().deactivate()
  })

  it('提交成功后表单已收起，但确认文案仍然看得见', async () => {
    const mode = useReviewMode()
    mode.activate('token-x')
    await flushPromises()
    mode.selection.value = null
    mode.feedback.value = { kind: 'ok', text: '已收到，这条反馈会进入改版工单列表' }

    const wrapper = mountToolbar()
    await flushPromises()

    expect(wrapper.find('.review-toolbar__form').exists()).toBe(false)
    expect(wrapper.find('.review-toolbar__feedback').text()).toContain('已收到')

    mode.deactivate()
  })

  it('选中区块后才出现填写区，并提示这是第几块', async () => {
    const mode = useReviewMode()
    mode.activate('token-x')
    await flushPromises()
    mode.feedback.value = null
    mode.selection.value = { instanceId: 'b3', blockKey: 'service-cards', path: '/', index: 3 }

    const wrapper = mountToolbar()
    await flushPromises()

    expect(wrapper.find('.review-toolbar__picked').text()).toContain('第 3 个区块')
    expect(wrapper.find('.review-toolbar__form').exists()).toBe(true)

    mode.deactivate()
  })

  it('只读那条链接上点「圈选区块」只得到实话，摆不出填写区', async () => {
    vi.mocked(fetchReviewContext).mockResolvedValue({
      scope: 'site', ticketWritable: false, label: '候选站 A 方案', expiresAt: null
    })
    const mode = useReviewMode()
    mode.activate('token-site')
    await flushPromises()
    mode.feedback.value = null

    const wrapper = mountToolbar()
    await flushPromises()
    const pickButton = wrapper.findAll('button').find(node => node.text().includes('圈选区块'))
    expect(pickButton, '工具条上该有「圈选区块」那颗按钮').toBeTruthy()

    await pickButton!.trigger('click')
    await flushPromises()

    // 没进入圈选态、没表单，屏幕上只有那句「这里不能提交修改意见」
    expect(wrapper.find('.review-toolbar__form').exists()).toBe(false)
    expect(wrapper.find('.review-toolbar__tip').exists()).toBe(false)
    expect(wrapper.find('.review-toolbar__feedback').text()).toContain(SITE_PREVIEW_NOTICE)

    mode.deactivate()
  })
})

