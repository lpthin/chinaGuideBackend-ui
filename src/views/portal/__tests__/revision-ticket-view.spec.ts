import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { message } from 'ant-design-vue'
import RevisionTicketView from '../RevisionTicketView.vue'
import { portalTicketsApi } from '../../../api/portalTickets'
import { portalPagesApi } from '../../../api/portalPages'
import { useAuthStore } from '../../../stores/auth'

/**
 * 改版工单审阅页的「按码取底数据」（问卷 3a）。
 *
 * 这一页的路由门是 portal:build:review，但页面清单走的是 portal:page:manage 的口（Q-P7-3 拆档后）：
 * 只有审阅码的账号发那一条请求，只会得到一条「页面列表加载失败」的红字——那是谎报，
 * 缺的是码，不是接口坏了。所以缺码就不发，并把空下拉的原因写在明处。
 */

vi.mock('../../../api/portalTickets', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/portalTickets')>()
  return {
    ...actual,
    portalTicketsApi: {
      options: vi.fn(),
      list: vi.fn(),
      createSession: vi.fn(),
      sessions: vi.fn(),
      revokeSession: vi.fn()
    }
  }
})

vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { list: vi.fn(), blocks: vi.fn(), save: vi.fn(), preview: vi.fn() }
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

async function mountView(permissionCodes: string[]) {
  useAuthStore().user = {
    id: 1,
    username: 'tester',
    roles: ['SITE_ADMIN'],
    permissions: permissionCodes
  } as any
  const wrapper = mount(RevisionTicketView, {
    attachTo: document.body,
    global: {
      stubs: {
        DraftReviewCard: true,
        // 全局桩把 a-alert 换成空壳（插槽一个字都不渲），那句话就永远测不到；这里换一个透传的壳
        'a-alert': {
          name: 'AAlert',
          props: ['type', 'message', 'description', 'showIcon'],
          template: '<div class="a-alert-stub"><slot /><slot name="message" /></div>'
        }
      }
    }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  vi.mocked(portalTicketsApi.options).mockResolvedValue({
    statuses: { open: '待处理' },
    viewports: { desktop: '桌面' },
    intents: { copy: '改文案' }
  } as any)
  vi.mocked(portalTicketsApi.list).mockResolvedValue([] as any)
  vi.mocked(portalPagesApi.list).mockResolvedValue([{ id: 43, title: '联系我们', slug: 'contact' }] as any)
})

describe('改版工单：底数据按码取', () => {
  it('只有审阅码时不发页面清单那一条，缺码那句写在明处，工单照常拉', async () => {
    const wrapper = await mountView(['portal:build:review'])
    expect(portalPagesApi.list).not.toHaveBeenCalled()
    expect(portalTicketsApi.list).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('这个账号没有 portal:page:manage')
    // 缺的是码，不是接口坏了：那条「页面列表加载失败」的红字不许在这里出现
    expect(message.error).not.toHaveBeenCalled()
    expect(text).not.toContain('页面列表加载失败')
    wrapper.unmount()
  })

  it('给了 manage 码就照旧去取页面清单，那句话收回去', async () => {
    const wrapper = await mountView(['portal:build:review', 'portal:page:manage'])
    expect(portalPagesApi.list).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('这个账号没有 portal:page:manage')
    wrapper.unmount()
  })
})
