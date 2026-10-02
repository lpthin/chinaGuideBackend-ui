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

/** 全局桩把 a-* 换成空 div，`:message=` 这种 prop 形式根本渲染不出来，所以这里显式渲染 #message 槽 */
const ALERT_STUB = {
  name: 'ALertStub',
  props: ['type', 'showIcon'],
  template: '<div class="alert-stub"><slot name="message" /></div>'
}

async function mountAs(roles: string[], permissions: string[]) {
  useAuthStore().user = { id: 1, username: 'tester', roles, permissions, tenantId: 15 } as any
  const wrapper = mount(MessageManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-alert': ALERT_STUB,
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

function statValues() {
  return [...document.querySelectorAll('.stat-value')].map(node => (node.textContent || '').trim())
}

function alertTexts() {
  return [...document.querySelectorAll('.alert-stub')].map(node => (node.textContent || '').trim())
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  // 这份返回值是后端 `MessageService.getStats` 的原样形状（total/unread/inbox/outbox），
  // 不是界面以前抄的那套 totalMessages/readCount/unreadCount/totalRecipients —— 那套键一个都对不上
  vi.mocked(portalMessageApi.stats).mockResolvedValue({
    total: 7,
    unread: 2,
    inbox: 7,
    outbox: 7
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

/**
 * 统计那一口的两条命（拍板 1a + 现场挖出的键名错配）。
 *
 * 一：读不到的时候不许说成 0。后端 `GET /messages/stats` 按「当前选中的租户」算，
 * 超管停在平台档时请求不带租户头，回的是 `TENANT_REQUIRED / 请先选择租户`；
 * 以前这条失败只进控制台，卡片照显示 0 —— 把「没读到」说成「真的没有」。
 *
 * 二：键名要照后端原样。这一页原本抄的是 `totalMessages / readCount / unreadCount / totalRecipients`，
 * 后端回的是 `total / unread / inbox / outbox`，`Object.assign` 一个都拷不进去 ⇒ 卡片恒为 0，
 * 而那家租户其实有 7 条（现场 `GET /api/messages/stats` 带 `X-Tenant-Id: 1` 亲测）。
 */
describe('站内信统计：键名照后端原样、读不到时不谎报成 0', () => {
  it('后端真回的 total/unread 要落到卡上，已读由总数减未读得到', async () => {
    const wrapper = await mountAs(['CONTENT_EDITOR'], ['portal:siteinfo:manage'])
    expect(alertTexts()).toHaveLength(0)
    expect(statValues()).toEqual(['7', '5', '2'])
    wrapper.unmount()
  })

  it('后端说「请先选择租户」：卡片露「—」并把去哪儿选写在明处', async () => {
    vi.mocked(portalMessageApi.stats).mockRejectedValue(new Error('请先选择租户'))
    const wrapper = await mountAs(['SUPER_ADMIN'], ['portal:admin:tenant'])
    expect(alertTexts().join(' ')).toContain('请先在右上角切到「租户」')
    expect(statValues()).toEqual(['—', '—', '—'])
    expect(document.body.textContent).not.toContain('统计数据读取失败')
    wrapper.unmount()
  })

  it('其它原因（比如库挂了）要说读失败，不能混成「没选租户」那句', async () => {
    vi.mocked(portalMessageApi.stats).mockRejectedValue(new Error('数据库连接超时'))
    const wrapper = await mountAs(['CONTENT_EDITOR'], ['portal:siteinfo:manage'])
    expect(alertTexts().join(' ')).toContain('统计数据读取失败：数据库连接超时')
    expect(statValues()).toEqual(['—', '—', '—'])
    wrapper.unmount()
  })
})
