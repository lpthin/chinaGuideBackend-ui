import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ReviewToolbar from '../review/ReviewToolbar.vue'
import { useReviewMode } from '../useReviewMode'

/**
 * 工具条的渲染位置测试。
 *
 * 采集器最容易出的问题是「客户点了提交，屏幕上什么都没发生」：提交成功会清空 selection，
 * 表单那一整块随之卸载，所以提示只要写在表单里面就等于没写。
 */

vi.mock('../api/portalPublic', () => ({
  fetchReviewIntentOptions: vi.fn().mockResolvedValue({}),
  submitReviewTicket: vi.fn().mockResolvedValue(undefined)
}))

describe('ReviewToolbar', () => {
  it('提交成功后表单已收起，但确认文案仍然看得见', async () => {
    const mode = useReviewMode()
    mode.activate('token-x')
    mode.selection.value = null
    mode.feedback.value = { kind: 'ok', text: '已收到，这条反馈会进入改版工单列表' }

    const wrapper = mount(ReviewToolbar)
    await nextTick()

    expect(wrapper.find('.review-toolbar__form').exists()).toBe(false)
    expect(wrapper.find('.review-toolbar__feedback').text()).toContain('已收到')

    mode.deactivate()
  })

  it('选中区块后才出现填写区，并提示这是第几块', async () => {
    const mode = useReviewMode()
    mode.activate('token-x')
    mode.feedback.value = null
    mode.selection.value = { instanceId: 'b3', blockKey: 'service-cards', path: '/', index: 3 }

    const wrapper = mount(ReviewToolbar)
    await nextTick()

    expect(wrapper.find('.review-toolbar__picked').text()).toContain('第 3 个区块')
    expect(wrapper.find('.review-toolbar__form').exists()).toBe(true)

    mode.deactivate()
  })
})
