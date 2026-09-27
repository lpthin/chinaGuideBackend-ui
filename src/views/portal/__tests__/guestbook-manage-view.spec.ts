import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import GuestbookManageView from '../GuestbookManageView.vue'
import { guestbookApi } from '../../../api/portal'

/**
 * 留言管理页上「留资线索」那个徽标的两条纪律（任务 #11 / N7）。
 *
 * 1. 类型中文名只有 GET /guestbook/types 一个来源：这里的桩故意回一个后端从没给过的标签，
 *    界面要显示的是它，不是任何写死在 .vue 里的「留资线索」；
 * 2. 类型筛选必须真的变成一个 query 参数发出去。这一页原来那个搜索框就是反面教材——
 *    框在、按钮在、点了没反应，因为参数压根没拼进请求。
 */

vi.mock('../../../api/portal', () => ({
  guestbookApi: {
    list: vi.fn(),
    types: vi.fn(),
    budgets: vi.fn(),
    reply: vi.fn(),
    delete: vi.fn()
  },
  companyInfoApi: {},
  bannerApi: {},
  siteApi: {}
}))

const PASS_THROUGH = (name: string, extraSlots: string[] = []) => ({
  name,
  props: ['title', 'subTitle', 'bordered', 'hoverable'],
  template: `<div class="${name}-stub">${
    extraSlots.includes('title') ? '<slot name="title" />' : ''
  }<slot /></div>`
})

const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'placeholder'],
  emits: ['update:value', 'change'],
  template: `<span class="select-stub" :data-placeholder="placeholder">
    <slot />
    <button class="select-pick" @click="$emit('update:value', 'inquiry'); $emit('change', 'inquiry')">选它</button>
  </span>`
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  template: `
    <div class="table-stub">
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

function row(id: number, type: string | null) {
  return {
    id,
    tenantId: 15,
    siteId: 12,
    userName: `访客 ${id}`,
    phone: '13800000000',
    content: '想问一下报价',
    status: 'pending',
    type,
    companyName: null,
    budgetCode: null,
    createTime: '2026-09-25T09:00:00',
    replyTime: null,
    replyContent: null
  }
}

async function mountView() {
  const wrapper = mount(GuestbookManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-page-header': PASS_THROUGH('APageHeader'),
        'a-card': PASS_THROUGH('ACard', ['title']),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-select': SELECT_STUB,
        'a-select-option': { name: 'ASelectOption', template: '<option><slot /></option>' },
        'a-input-search': PASS_THROUGH('AInputSearch'),
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-table': TABLE_STUB,
        'a-modal': PASS_THROUGH('AModal'),
        'a-textarea': PASS_THROUGH('ATextarea')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function tagsByText(text: string) {
  return [...document.querySelectorAll('.ATag-stub')].filter(node => (node.textContent || '').trim() === text)
}

describe('GuestbookManageView 的类型徽标', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(guestbookApi.types).mockResolvedValue({ other: '接口给的普通名', inquiry: '接口给的留资名' })
    vi.mocked(guestbookApi.budgets).mockResolvedValue({
      under_5w: '接口给的小档',
      from_10w_to_30w: '接口给的中档',
      not_sure: '接口给的还没定'
    })
    vi.mocked(guestbookApi.list).mockResolvedValue({
      records: [row(1, 'inquiry'), row(2, 'other'), row(3, 'mystery_type'), row(4, null)],
      total: 4
    } as any)
  })

  it('标签用接口回的那一份，代码没在词表里时原样显示', async () => {
    const wrapper = await mountView()
    expect(tagsByText('接口给的留资名').length).toBe(1)
    expect(tagsByText('接口给的普通名').length).toBe(1)
    // 脏数据/词表没更到：显原码而不是编一个「未知类型」，后者会让人以为系统认得它
    expect(tagsByText('mystery_type').length).toBe(1)
    expect(tagsByText('—').length).toBe(1)
    expect(document.body.textContent).not.toContain('留资线索')
    wrapper.unmount()
  })

  it('筛选下拉里的种类也来自同一份词表', async () => {
    const wrapper = await mountView()
    const filters = [...document.querySelectorAll('.select-stub')].filter(
      node => node.getAttribute('data-placeholder') === '类型筛选'
    )
    expect(filters.length).toBe(1)
    expect(filters[0].textContent).toContain('接口给的留资名')
    expect(filters[0].textContent).toContain('接口给的普通名')
    wrapper.unmount()
  })

  it('选一种类型后，list 真的带上 type 参数', async () => {
    const wrapper = await mountView()
    vi.mocked(guestbookApi.list).mockClear()
    const pick = [...document.querySelectorAll('.select-stub')]
      .find(node => node.getAttribute('data-placeholder') === '类型筛选')!
      .querySelector('.select-pick') as HTMLButtonElement
    pick.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    const sent = vi.mocked(guestbookApi.list).mock.calls.map(call => call[0] as any)
    expect(sent.some(params => params.type === 'inquiry')).toBe(true)
    wrapper.unmount()
  })
})

/**
 * 拍板 2026-09-27 补的两格（公司 / 预算范围）。
 *
 * 这两列读的是 portal_guestbook 的真列名（companyName / budgetCode）：这一页原来那份字段表
 * 抄的是库里没有的名字（name / createdAt / reply），所以「访客」与「留言时间」两列一直是空的——
 * 加了新列却还照着假字段表写，新线索照样看不见，那才是白做。
 */
describe('线索列表里的公司与预算两格', () => {
  it('公司名原样显示，预算档位念的是 GET /guestbook/budgets 给的那一份', async () => {
    const lead = { ...row(11, 'inquiry'), companyName: '上海纳欣精密机械', budgetCode: 'from_10w_to_30w' }
    vi.mocked(guestbookApi.list).mockResolvedValue({ records: [lead], total: 1 } as any)
    const wrapper = await mountView()

    const cells = [...document.querySelectorAll('.row')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(cells[0]).toContain('上海纳欣精密机械')
    expect(cells[0]).toContain('接口给的中档')
    // 中文说法不许出现在 .vue 里：这一句红了就说明有人在这边抄了第二份词表
    expect(document.body.textContent).not.toContain('10–30 万')
    wrapper.unmount()
  })

  it('没填的两格显示占位符，词表外的旧码原样回显', async () => {
    const legacy = { ...row(12, 'inquiry'), companyName: null, budgetCode: 'range_of_2024' }
    vi.mocked(guestbookApi.list).mockResolvedValue({ records: [legacy], total: 1 } as any)
    const wrapper = await mountView()

    const cells = [...document.querySelectorAll('.row')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(cells[0]).toContain('range_of_2024')
    expect(cells[0]).not.toContain('未知档位')
    // 公司没填就是没填：给个占位符，不猜一家「某公司」出来
    expect(cells[0]).toContain('—')
    wrapper.unmount()
  })
})
