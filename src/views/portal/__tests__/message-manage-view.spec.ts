import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import MessageManageView from '../MessageManageView.vue'
import { portalMessageApi } from '../../../api/portal'
import { useAuthStore } from '../../../stores/auth'

/**
 * 站内信页的入口按职能收（全站普查 1a，拍板「只收发送消息按钮」）。
 *
 * 两条都要钉住，缺一条这页就是坏的：
 * 1. 租户档仍然看得见自己的站内信——收件箱那一条请求照发；
 * 2. 「发送消息」不摆给没有超管身份的人：弹窗里那个租户下拉读的是 /api/admin/tenants，
 *    后端每个方法第一行 checkSuperAdmin()，摆出来只会让人点开一个空下拉框。
 */

vi.mock('../../../api/portal', () => ({
  portalMessageApi: {
    stats: vi.fn(),
    list: vi.fn(),
    outbox: vi.fn(),
    markRead: vi.fn(),
    delete: vi.fn(),
    broadcast: vi.fn()
  }
}))

vi.mock('../../../components/TenantSelect.vue', () => ({
  default: { name: 'TenantSelect', template: '<div class="tenant-select-stub" />' }
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['type', 'span', 'gutter', 'spinning', 'hoverable', 'title'],
  template: `<div class="${name}-stub"><slot /><slot name="actions" /></div>`
})

async function mountAs(roles: string[], permissions: string[]) {
  useAuthStore().user = { id: 1, username: 'tester', roles, permissions, tenantId: 15 } as any
  const wrapper = mount(MessageManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-space': PASS_THROUGH('a-space'),
        'a-spin': PASS_THROUGH('a-spin'),
        'a-card': PASS_THROUGH('a-card'),
        'a-row': PASS_THROUGH('a-row'),
        'a-col': PASS_THROUGH('a-col'),
        'a-tabs': PASS_THROUGH('a-tabs'),
        'a-tab-pane': PASS_THROUGH('a-tab-pane')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function buttonTexts() {
  return [...document.querySelectorAll('button')].map(node => (node.textContent || '').trim())
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  vi.mocked(portalMessageApi.stats).mockResolvedValue({
    totalMessages: 3,
    unreadMessages: 1,
    readMessages: 2,
    deletedMessages: 0
  } as any)
  vi.mocked(portalMessageApi.list).mockResolvedValue({
    records: [{ id: 1, title: '站点已通过审核', isRead: false }],
    total: 1
  } as any)
  vi.mocked(portalMessageApi.outbox).mockResolvedValue({ records: [], total: 0 } as any)
})

describe('站内信入口按职能收', () => {
  it('租户档：没有「发送消息」这颗按钮，但收件箱那一条请求照发、信照看', async () => {
    const wrapper = await mountAs(['CONTENT_EDITOR'], ['portal:siteinfo:manage'])
    expect(buttonTexts().some(text => text.includes('发送消息'))).toBe(false)
    expect(portalMessageApi.list).toHaveBeenCalledTimes(1)
    // 默认停在收件箱这一格：租户档进来的第一屏就是自己的信，而不是一个空壳页
    expect(portalMessageApi.outbox).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('超管档：入口照常摆出来', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN'], ['portal:admin:tenant'])
    expect(buttonTexts().some(text => text.includes('发送消息'))).toBe(true)
    wrapper.unmount()
  })
})
