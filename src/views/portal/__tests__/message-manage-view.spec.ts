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
 * 3. 「删除」摆不摆跟后端同一条（拍板 1a + 1a 复核 2026-10-03）：`MessageController.deleteMessage`
 *    先问「这条的 receiver_id 是不是登录者」——是自己那一格就本人删，不看角色；
 *    不是自己的那一格（发件箱里那条 = 对方收件箱里的那一份）才要「角色有 SITE_ADMIN」+「人站在自己归属的那一家」。
 *    隐藏只是不让人撞墙，真正的拒绝在后端；反过来摆一颗后端会拒的按钮才是问题。
 */

vi.mock('../../../api/portal', () => ({
  portalMessageApi: {
    stats: vi.fn(),
    list: vi.fn(),
    outbox: vi.fn(),
    markRead: vi.fn(),
    delete: vi.fn(),
    broadcast: vi.fn(),
    broadcastSummary: vi.fn()
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
    <template v-for="record in dataSource" :key="record[rowKey] ?? record.id">
      <template v-for="column in columns" :key="column.key">
        <slot name="bodyCell" :column="column" :record="record" :text="record[column.dataIndex]" />
        <span :class="'a-table-stub__cell cell-' + column.key">{{ record[column.dataIndex] }}</span>
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

/** 全局桩把 a-tag 收成空壳（连文字都不渲染），「已读/未读」这一条就没法断言，所以这里画回内容 */
const TAG_STUB = {
  name: 'ATagStub',
  props: ['color'],
  template: '<span class="a-tag-stub"><slot /></span>'
}

/**
 * 状态筛子要能真点：上一版的 bug 正是「点了没反应」，用全局空壳桩测不出来。
 * 先发 update:value（v-model 落到 queryParams.status）再发 change（@change=handleSearch 才读得到新值）。
 */
const SELECT_STUB = {
  name: 'ASelectStub',
  props: ['value', 'placeholder'],
  emits: ['update:value', 'change'],
  template: `<select class="a-select-stub" :value="value" @change="pick($event.target.value)">
    <option value="unread">未读</option>
    <option value="read">已读</option>
  </select>`,
  methods: {
    pick(this: any, value: string) {
      this.$emit('update:value', value)
      this.$emit('change', value)
    }
  }
}

/** 收件箱/发件箱那格开关同样要真点得动 —— 发件箱那一档的表头、筛不筛得动都靠它切过去验 */
const RADIO_GROUP_STUB = {
  name: 'ARadioGroupStub',
  props: ['value'],
  emits: ['update:value', 'change'],
  template: `<div class="a-radio-group-stub">
    <button type="button" class="tab-inbox" @click="pick('inbox')">收件箱</button>
    <button type="button" class="tab-outbox" @click="pick('outbox')">发件箱</button>
    <slot />
  </div>`,
  methods: {
    pick(this: any, value: string) {
      this.$emit('update:value', value)
      this.$emit('change', value)
    }
  }
}

/**
 * 一份行 = 现场 `GET /api/messages` 真回的键（content/createTime/delFlag/id/isDeleted/readTime/
 * receiverId/receiverName/senderId/senderName/status/summary/tenantId/title/type）。
 * 别再抄 isRead/readAt/createdAt：库里没这几个名字，界面上那一列因此恒显示「未读」、时间列恒显示「-」。
 */
function inboxRecords() {
  return [
    {
      id: 21,
      tenantId: 15,
      senderId: 7,
      senderName: '王管理员',
      receiverId: 1,
      receiverName: '测试员',
      type: 'NOTICE',
      title: '站点已通过审核',
      content: '你的站点已经上线了',
      summary: '你的站点已经上线了',
      status: 'unread',
      isDeleted: 0,
      delFlag: '0',
      createTime: '2026-10-02T09:30:00',
      readTime: null,
    },
    {
      id: 13,
      tenantId: 15,
      // 系统告警这一类：现场实测 senderId 是 0，它背后没有「发件人的发件箱」那个人
      senderId: 0,
      senderName: '系统告警',
      receiverId: 1,
      receiverName: '测试员',
      // 库里这一类真是这么写的：`AlertNotificationService:162` 写的是小写 `alert`，
      // 而界面那颗下拉发出去的是大写 —— 查表不认小写就直接把原码印给人看
      type: 'alert',
      title: '抓取额度已用完',
      content: '今天的抓取额度用完了',
      summary: '今天的抓取额度用完了',
      status: 'read',
      isDeleted: 0,
      delFlag: '0',
      createTime: '2026-10-01T18:05:00',
      readTime: '2026-10-02T08:00:00',
    },
  ]
}

/**
 * 发件箱那一档读的是同一套键，只是视角反过来：第一行我发给「李编辑」，
 * 第二行是库里的历史形状 —— receiver_name 现场实测是 NULL（id 1、2 就是这种），
 * 那一格要画横杠，留白看着像页面坏了。
 */
function outboxRecords() {
  return [
    { ...inboxRecords()[0], id: 31, senderId: 1, senderName: '测试员', receiverId: 9, receiverName: '李编辑' },
    { ...inboxRecords()[0], id: 1, senderId: 1, senderName: '系统管理员', receiverId: 1, receiverName: null },
  ]
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
      // 筛子/开关/标签挂真控件桩：全局空壳桩点不动，「点了没反应」这一类 bug 就测不出来
      stubs: {
        'a-button': Button,
        'a-alert': ALERT_STUB,
        'a-table': TABLE_STUB,
        'a-popconfirm': POPCONFIRM_STUB,
        'a-tag': TAG_STUB,
        'a-select': SELECT_STUB,
        'a-radio-group': RADIO_GROUP_STUB,
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
  vi.mocked(portalMessageApi.list).mockResolvedValue({ records: inboxRecords(), total: 2 } as any)
  vi.mocked(portalMessageApi.outbox).mockResolvedValue({ records: outboxRecords(), total: 1 } as any)
  // 平台档那张跨租户的公告阅读表（后端 BroadcastReadRow 的原样形状）；默认空表，各例自己覆盖
  vi.mocked(portalMessageApi.broadcastSummary).mockResolvedValue([] as any)
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

describe('删除入口：自己那一格本人删，别人那一格要这一家的管理员（拍板 1a + 1a 复核），语义写在确认里（拍板 2a）', () => {
  function hasDeleteButton() {
    return buttonTexts().some(text => text.includes('删除'))
  }

  function deleteConfirmTitle() {
    const node = document.querySelector('.popconfirm-stub') as HTMLElement | null
    return node?.dataset.title ?? ''
  }

  /**
   * 发件箱只留「我发给别人」的那一行（receiverId 9 ≠ 登录者 1）。
   * 不这样切的话，默认那份数据里夹着一条自己发给自己的（库里 id 1、2 就是这种形状），
   * 「管理员才摆」这一条会被收件人判据蒙过去，测了等于没测。
   */
  function onlyForeignOutboxRow() {
    vi.mocked(portalMessageApi.outbox).mockResolvedValue({ records: [outboxRecords()[0]], total: 1 } as any)
  }

  async function switchToOutbox() {
    ;(document.querySelector('.tab-outbox') as HTMLElement).click()
    await flushPromises()
  }

  it('收件箱：那一条就是登录者自己眼前那一格，CONTENT_EDITOR 也摆', async () => {
    const wrapper = await mountAs(['CONTENT_EDITOR'], ['portal:siteinfo:manage'])
    expect(hasDeleteButton()).toBe(true)
    expect(buttonTexts().some(text => text.includes('查看'))).toBe(true)
    // 库里一行只挂一个 receiver_id（群发在发送时就摊成 N 行），
    // 所以不许再写「这家租户所有人都看不到」那种夸大的话——上一版就是错的
    expect(deleteConfirmTitle()).toContain('你的收件箱')
    expect(deleteConfirmTitle()).not.toContain('所有人都看不到')
    wrapper.unmount()
  })

  it('发件箱：那一条代表的是对方收件箱里的那一份，CONTENT_EDITOR 不摆', async () => {
    onlyForeignOutboxRow()
    const wrapper = await mountAs(['CONTENT_EDITOR'], ['portal:siteinfo:manage'])
    await switchToOutbox()
    expect(hasDeleteButton()).toBe(false)
    wrapper.unmount()
  })

  it('发件箱：SITE_ADMIN 站在自己归属的那一家（15）才摆', async () => {
    onlyForeignOutboxRow()
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'], { selectedTenantId: 15 })
    await switchToOutbox()
    expect(hasDeleteButton()).toBe(true)
    wrapper.unmount()
  })

  it('发件箱：超管切到别家，角色里挂着 SITE_ADMIN 也不摆（管辖范围按 admin_user.tenant_id 比）', async () => {
    onlyForeignOutboxRow()
    const wrapper = await mountAs(['SUPER_ADMIN', 'SITE_ADMIN'], ['portal:admin:tenant'], { selectedTenantId: 9 })
    await switchToOutbox()
    expect(hasDeleteButton()).toBe(false)
    wrapper.unmount()
  })

  it('超管停在平台档（没选租户）：那一枪根本不发，也不摆一张注定空着的表', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN', 'SITE_ADMIN'], ['portal:admin:tenant'])
    // 后端 resolveTenantId 没租户就回 TENANT_REQUIRED（现场实测），发出去只换来一句红 toast
    expect(portalMessageApi.list).not.toHaveBeenCalled()
    expect(hasDeleteButton()).toBe(false)
    expect(alertTexts().join(' ')).toContain('请在右上角切到「租户」')
    // 但「发送消息」不能跟着一起消失 —— 平台档的正活儿就是群发，那颗按钮在同一张卡的 #actions 里
    expect(buttonTexts().some(text => text.includes('发送消息'))).toBe(true)
    wrapper.unmount()
  })

  it('超管停在平台档（没选租户）：那一枪根本不发，也不摆一张注定空着的表', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN', 'SITE_ADMIN'], ['portal:admin:tenant'])
    // 后端 resolveTenantId 没租户就回 TENANT_REQUIRED（现场实测），发出去只换来一句红 toast
    expect(portalMessageApi.list).not.toHaveBeenCalled()
    expect(hasDeleteButton()).toBe(false)
    expect(alertTexts().join(' ')).toContain('请在右上角切到「租户」')
    // 但「发送消息」不能跟着一起消失 —— 平台档的正活儿就是群发，那颗按钮在同一张卡的 #actions 里
    expect(buttonTexts().some(text => text.includes('发送消息'))).toBe(true)
    wrapper.unmount()
  })

  // 拍板 4a：这一列勾选框从上线起没接任何动作（selectedRowKeys 收进来就没人读），摆着就是骗人点
  it('勾选列已经摘掉：表格收不到 row-selection', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(wrapper.findComponent({ name: 'ATableStub' }).props('rowSelection')).toBeUndefined()
    wrapper.unmount()
  })
})

/**
 * 平台档（超管没选租户）那一档原来只有三格「—」+ 一句去选租户。
 * 那三个数确实算不出来（它们按「你在这家租户里的信」算，后端没租户直接拒），
 * 但「我发的公告被读了多少」是跨租户的问题 —— 这一张表就是补那个视角，不是拿来填空的。
 */
describe('平台档：我发的公告在各家读成什么样', () => {
  function summaryRows() {
    return [...document.querySelectorAll('.broadcast-summary-card .a-table-stub')].length
  }

  function summaryText() {
    return (document.querySelector('.broadcast-summary-card')?.textContent || '').replace(/\s+/g, ' ')
  }

  it('摆：一行公告摊到几家、读了几家、被删了几份都在明处', async () => {
    vi.mocked(portalMessageApi.broadcastSummary).mockResolvedValue([
      {
        title: '系统维护通知',
        type: 'NOTICE',
        sentTime: '2026-10-02T09:30:00',
        delivered: 12,
        readCount: 8,
        unreadCount: 4,
        removedCount: 1,
        tenantCount: 3,
      },
    ] as any)

    const wrapper = await mountAs(['SUPER_ADMIN'], ['portal:admin:tenant'])
    expect(portalMessageApi.broadcastSummary).toHaveBeenCalledTimes(1)
    expect(summaryRows()).toBe(1)
    const text = summaryText()
    expect(text).toContain('系统维护通知')
    expect(text).toContain('3 家')
    expect(text).toContain('8 / 4')
    expect(text).toContain('12')
    wrapper.unmount()
  })

  it('读不到就说读不到：不许把失败画成一张空表（那等于说「你没过公告」）', async () => {
    vi.mocked(portalMessageApi.broadcastSummary).mockRejectedValue(new Error('数据库连接超时'))

    const wrapper = await mountAs(['SUPER_ADMIN'], ['portal:admin:tenant'])
    expect(summaryText()).toContain('公告阅读情况读取失败：数据库连接超时')
    wrapper.unmount()
  })

  it('站在某一家里：这一口不发 —— 那张表是跨租户的，选了租户还发它就是把两档混在一起', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN'], ['portal:admin:tenant'], { selectedTenantId: 15 })
    expect(portalMessageApi.broadcastSummary).not.toHaveBeenCalled()
    expect(summaryRows()).toBe(0)
    wrapper.unmount()
  })

  it('租户用户：同样不发，这张表只属于平台档（后端那个口也只放超管）', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(portalMessageApi.broadcastSummary).not.toHaveBeenCalled()
    expect(summaryRows()).toBe(0)
    wrapper.unmount()
  })
})

/** tsconfig 的 lib 没到 es2022，`.at(-1)` 用不了；取最后一次调用的入参 */
function lastCall(mock: { mock: { calls: any[][] } }): any {
  const calls = mock.mock.calls
  return calls[calls.length - 1]?.[0]
}

/**
 * 界面抄错字段名这一类（全站普查里同一形状的病至少两处：站内信、留言板）。
 *
 * 后端 `MessageController` 直接把 `Message` 实体丢回来，行里的键是
 * status / createTime / senderName / receiverName —— 库里没有 isRead / createdAt / readAt。
 * 而这一页原先读的全是那几个不存在的名字，于是现场画出来的是：
 * 每一行都贴「未读」（`!undefined` 恒真）、发送时间那一列一律「-」、
 * 发件箱那列表头写着「收件人」格子里却是自己的 id、状态筛子点了没反应（发的是后端不认的 isRead）。
 * 单测之前钉不住，因为夹具里也写着那几个假名字。
 */
describe('行字段跟着后端真回的键走', () => {
  function tableText() {
    return (document.querySelector('.a-table-stub')?.textContent || '').replace(/\s+/g, ' ')
  }

  /** 对方那一格画出来的文字（收件箱=发件人名、发件箱=收件人名） */
  function counterpartCells() {
    return [...document.querySelectorAll('.counterpart-cell')].map(node => (node.textContent || '').trim())
  }

  function tagTexts() {
    return [...document.querySelectorAll('.a-tag-stub')].map(node => (node.textContent || '').trim())
  }

  it('已读未读认的是 status：一行 unread 一行 read 就画一个未读一个已读', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(tagTexts()).toContain('未读')
    expect(tagTexts()).toContain('已读')
    wrapper.unmount()
  })

  it('发送时间取得到：列里是格式化后的时间，不再整列「-」', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(tableText()).toContain('2026-10-02 09:30')
    expect(tableText()).not.toContain('- -')
    wrapper.unmount()
  })

  it('类型码大小写不一律认：库里的小写 alert 要画成「系统报警」，不是把原码印出来', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(tagTexts()).toContain('系统报警')
    expect(tagTexts()).toContain('公告')
    expect(tagTexts().join(' ')).not.toContain('alert')
    wrapper.unmount()
  })

  it('收件箱那一格画发件人名，切到发件箱改画收件人名（表头会换词，取的字段也得跟着换）', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(counterpartCells()).toEqual(['王管理员', '系统告警'])
    expect(wrapper.findComponent({ name: 'ATableStub' }).props('columns')
      .find((column: any) => column.key === 'counterpart')?.dataIndex).toBe('senderName')

    await wrapper.find('.tab-outbox').trigger('click')
    await flushPromises()
    // 上一版写死 dataIndex: 'senderId'：表头换成「收件人」，格子里印的还是自己那个 id
    expect(wrapper.findComponent({ name: 'ATableStub' }).props('columns')
      .find((column: any) => column.key === 'counterpart')?.dataIndex).toBe('receiverName')
    // 库里历史行的 receiver_name 是 NULL（现场 id 1、2 就是），那一格画横杠而不是留白
    expect(counterpartCells()).toEqual(['李编辑', '-'])
    wrapper.unmount()
  })

  it('状态筛子发的是后端收的那个键（status），不是没人认的 isRead', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    await wrapper.find('.a-select-stub').setValue('unread')
    await flushPromises()
    const lastParams = lastCall(vi.mocked(portalMessageApi.list))
    expect(lastParams.status).toBe('unread')
    expect(lastParams.isRead).toBeUndefined()
    wrapper.unmount()
  })

  it('发件箱那一档：后端 getOutboxList 没有 status 形参，筛子不摆、也不发这个键', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    await wrapper.find('.tab-outbox').trigger('click')
    await flushPromises()
    expect(document.querySelector('.a-select-stub')).toBeNull()
    const params = lastCall(vi.mocked(portalMessageApi.outbox))
    expect('status' in params).toBe(false)
    wrapper.unmount()
  })

  it('系统告警那一行（senderId=0）：确认里不许说「发件人那份也没了」', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    const titles = [...document.querySelectorAll('.popconfirm-stub')].map(node => (node as HTMLElement).dataset.title ?? '')
    // 第一行是真人发的（senderId=7）：你们读的是同一行，这话要说全
    expect(titles[0]).toContain('发件人')
    // 第二行是系统告警（senderId=0），背后没有「发件人的发件箱」那个人
    expect(titles[1]).not.toContain('发件人')
    expect(titles[1]).toContain('系统提醒')
    wrapper.unmount()
  })
})
