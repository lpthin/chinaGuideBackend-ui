import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import MessageManageView from '../MessageManageView.vue'
import { portalMessageApi } from '../../../api/portal'
import { useAuthStore } from '../../../stores/auth'

/**
 * 站内信页的入口按职能收（全站普查 → 拍板 1a/2a/3c/4a）。
 *
 * 钉住的三件事，缺一条这页就是坏的：
 * 1. 租户档仍然看得见自己的站内信——收件箱那一条请求照发；
 * 2. 「发送消息」不摆给没有超管身份的人：弹窗里那个租户下拉读的是 /api/admin/tenants，
 *    后端每个方法第一行 checkSuperAdmin()，摆出来只会让人点开一个空下拉框；
 * 3. 「删除」只摆给这一家的管理员（拍板 1a）：后端 `MessageController.requireTenantAdminOf`
 *    判的是「角色有 SITE_ADMIN」+「人站在自己归属的那一家」，界面按同一条摆。
 *    隐藏只是不让人撞墙，真正的拒绝在后端；反过来摆一颗后端会拒的按钮才是问题。
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

/**
 * 表格必须自己渲染 #bodyCell，否则「删除摆不摆」这一条在测试里根本看不见。
 * rowSelection 也一并接成 prop：4a 拍板摘掉勾选列，这里就能断言它真的没传进来。
 */
const TABLE_STUB = {
  name: 'ATableStub',
  props: ['columns', 'dataSource', 'rowKey', 'rowSelection', 'pagination', 'scroll'],
  template: `<div class="a-table-stub">
    <template v-for="record in dataSource" :key="record.id">
      <template v-for="column in columns" :key="column.key">
        <slot name="bodyCell" :column="column" :record="record" :text="record[column.dataIndex]" />
      </template>
    </template>
  </div>`
}

/** 确认弹层在 happy-dom 里要点开才画得出文字，这里把「实际传进去的那句话」原样读出来断言 */
const POPCONFIRM_STUB = {
  name: 'APopconfirmStub',
  props: ['title', 'okText', 'cancelText'],
  template: '<div class="popconfirm-stub" :data-title="title"><slot /></div>'
}

interface AsOptions {
  selectedTenantId?: number | null
}

async function mountAs(roles: string[], permissions: string[], options: AsOptions = {}) {
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'tester', roles, permissions, tenantId: 15 } as any
  // 这个 store 在整个文件里是同一个实例，不清就会把上一档的租户带到下一档
  auth.selectedTenantId = options.selectedTenantId ?? null
  const wrapper = mount(MessageManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-alert': ALERT_STUB,
        'a-table': TABLE_STUB,
        'a-popconfirm': POPCONFIRM_STUB,
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
  // 这份返回值是后端 `MessageService.getStats(tenantId, userId)` 的原样形状（inbox/unread/outbox），
  // 三个数各按「我」算；它前面两版分别抄过 totalMessages/readCount/unreadCount/totalRecipients（键全错）
  // 和 total/inbox/outbox（后端那三句 SQL 一字不差，恒等）
  vi.mocked(portalMessageApi.stats).mockResolvedValue({
    inbox: 7,
    unread: 2,
    outbox: 3
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
 * 统计那一口的三条数（拍板 A：按登录用户算）。
 *
 * 一：读不到的时候不许说成 0。超管停在平台档时请求不带租户头，后端回 `TENANT_REQUIRED / 请先选择租户`；
 * 以前这条失败只进控制台，卡片照显示 0 —— 把「没读到」说成「真的没有」。
 *
 * 二：这一口原本回四个键、背后只有两句 SQL（total/inbox/outbox 都是 `tenant_id + is_deleted`），
 * 而下面的表按 `receiver_id` / `sender_id` 筛。现场实测租户 1：stats 报 outbox=7，`/outbox` 只有 2 行。
 * 现在三个键各按「我」算，卡片的名字就得是「我的收件箱 / 我的发件箱」，不能再叫「消息总数 / 已读」。
 */
describe('站内信统计：按我算、读不到时不谎报成 0', () => {
  function statTitles() {
    return [...document.querySelectorAll('.stat-title')].map(node => (node.textContent || '').trim())
  }

  it('三个数照后端原样落到卡上，标签认得出那是「我的」', async () => {
    const wrapper = await mountAs(['CONTENT_EDITOR'], ['portal:siteinfo:manage'])
    expect(alertTexts()).toHaveLength(0)
    expect(statValues()).toEqual(['7', '2', '3'])
    expect(statTitles()).toEqual(['我的收件箱', '未读', '我的发件箱'])
    // 「已读 = 总数 − 未读」那一格的前提是总数与未读同一个集合，按人算之后这个前提没了
    expect(statTitles().join(' ')).not.toContain('已读')
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

  it('后端只回三个键，界面不去读那个已经不存在的 total', async () => {
    vi.mocked(portalMessageApi.stats).mockResolvedValue({ inbox: 4, unread: 1, outbox: 9 } as any)
    const wrapper = await mountAs(['SUPER_ADMIN'], ['portal:admin:tenant'])
    expect(statValues()).toEqual(['4', '1', '9'])
    wrapper.unmount()
  })
})

describe('删除入口：只有这一家的管理员摆（拍板 1a），删的语义写在确认里（拍板 2a）', () => {
  function hasDeleteButton() {
    return buttonTexts().some(text => text.includes('删除'))
  }

  function deleteConfirmTitle() {
    const node = document.querySelector('.popconfirm-stub') as HTMLElement | null
    return node?.dataset.title ?? ''
  }

  it('SITE_ADMIN（站在自己那一家）：摆，且确认里说清删的是大家共用的那一份', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(hasDeleteButton()).toBe(true)
    // 库里只有一个 is_deleted：他删掉的是这一家租户里所有人都看不到的那一条
    expect(deleteConfirmTitle()).toContain('所有人都看不到')
    wrapper.unmount()
  })

  it('CONTENT_EDITOR：不摆删除，但「查看」照摆', async () => {
    const wrapper = await mountAs(['CONTENT_EDITOR'], ['portal:siteinfo:manage'])
    expect(hasDeleteButton()).toBe(false)
    expect(buttonTexts().some(text => text.includes('查看'))).toBe(true)
    wrapper.unmount()
  })

  it('超管切到别家：角色里挂着 SITE_ADMIN 也不摆（他自己那一家才是他的管辖范围）', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN', 'SITE_ADMIN'], ['portal:admin:tenant'], { selectedTenantId: 9 })
    expect(hasDeleteButton()).toBe(false)
    wrapper.unmount()
  })

  it('超管站在自己归属的那一家（15）：摆，与后端比 admin_user.tenant_id 同一条', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN', 'SITE_ADMIN'], ['portal:admin:tenant'], { selectedTenantId: 15 })
    expect(hasDeleteButton()).toBe(true)
    wrapper.unmount()
  })

  it('超管停在平台档（没选租户）：不摆 —— 那一口后端本来就回 TENANT_REQUIRED', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN', 'SITE_ADMIN'], ['portal:admin:tenant'])
    expect(hasDeleteButton()).toBe(false)
    wrapper.unmount()
  })

  // 拍板 4a：这一列勾选框从上线起没接任何动作（selectedRowKeys 收进来就没人读），摆着就是骗人点
  it('勾选列已经摘掉：表格收不到 row-selection', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(wrapper.findComponent({ name: 'ATableStub' }).props('rowSelection')).toBeUndefined()
    wrapper.unmount()
  })
})
