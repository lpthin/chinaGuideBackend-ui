import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { Button, Input, Select, message } from 'ant-design-vue'
import SitesView from '../SitesView.vue'
import { siteApi, tenantApi } from '../../../api'
import { vocabularyApi } from '../../../api/siteBriefs'

/**
 * 建站向导第一跳（Spec：超管建站 9 步压 4 步）在站点表单上的三条契约：
 * 1. **新建带租户**：后端 `SiteService.create` 要求请求里带 tenantId（超管上下文没有默认租户），
 *    不选就必须被中文拦住，不能静默建出无主站；
 * 2. **编辑不带租户**：后端 `update` 强制沿用库里那份归属，编辑分支的 payload 里出现 tenantId
 *    就是界面在演「这里能改归属」——payload 与控件（disabled + 如实回显）两头都要钉住；
 * 3. **建完直接进前采**：新建成功后 router.push 到录入页并把租户号挂 query（与 TenantPanel
 *    「去录前采」同一种交棒走法）。
 *
 * 挂载方式沿用本仓 brief-intake/theme-preset 的惯例：真实 Button/Input/Select，
 * a-modal 换成 open=false 就不渲染的壳（真组件走 teleport），a-table 换成按
 * dataSource 第一行喂 record 给 bodyCell 的壳（真表在这环境里渲不出表体）。
 */

const { pushSpy, routeQuery } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  routeQuery: { current: {} as Record<string, string> }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy }),
  useRoute: () => ({ params: {}, query: routeQuery.current })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

// SitesView 只用 api/index 重导出的 siteApi/tenantApi 两口；整口换成 vi.fn，
// 免得 index 把无关模块的 http 依赖链一起拖进测试图。
vi.mock('../../../api', () => ({
  siteApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  tenantApi: { list: vi.fn() }
}))

// 词表纯函数（findProfileQuestion/siteStatusText）走真实现，只换掉网络口
vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

vi.mock('../../../api/siteBriefs', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    vocabularyApi: { adminVocabulary: vi.fn(), portalVocabulary: vi.fn() }
  }
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ isSuperAdmin: true })
}))

const loadSitesSpy = vi.fn()
vi.mock('../../../stores/site', () => ({
  useSiteStore: () => ({ loadSites: loadSitesSpy })
}))

// a-modal 换成 open=false 就不渲染的壳：真组件走 teleport + rAF，这里要钉的是「提交带什么」
const MODAL = {
  name: 'AModal',
  props: ['open', 'title'],
  emits: ['update:open', 'ok'],
  template:
    '<div v-if="open" class="modal-stub" :data-title="title"><slot /><button class="modal-ok" @click="$emit(\'ok\')">确 定</button></div>'
}

/** 表体按 dataSource 第一行把 record 喂给各列的 #default：编辑入口就在「操作」列里 */
const tableRow = { current: {} as Record<string, unknown> }
const TABLE_STUB = {
  name: 'ATable',
  props: ['dataSource', 'loading'],
  setup(props: any, { slots }: any) {
    return () => {
      tableRow.current = (props.dataSource || [])[0] || {}
      return h('div', { class: 'table-stub' }, slots.default ? slots.default() : null)
    }
  }
}
const TABLE_COLUMN_STUB = {
  name: 'ATableColumn',
  props: ['title', 'dataIndex'],
  setup(props: any, { slots }: any) {
    return () =>
      h('div', { class: 'column-stub' }, slots.default
        ? slots.default({ record: tableRow.current, text: tableRow.current[props.dataIndex || ''] })
        : null)
  }
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description'],
  template: `<div class="${name}-stub"><slot /><slot name="message" /><slot name="description" /></div>`
})

const TENANT = { id: 15, code: 't-a', name: '甲租户' }

const BASE_SITE = {
  id: 7,
  code: 'old-site',
  name: '旧站',
  domain: 'old.example.com',
  description: '',
  brandName: '',
  industry: '',
  subIndustry: '',
  targetRegions: '',
  targetAudience: '',
  businessModel: '',
  coreProducts: '',
  competitorDomains: '',
  seedKeywords: '',
  excludedKeywords: '',
  searchLocales: 'en',
  siteType: 'content_site',
  defaultLocale: 'zh-CN',
  enabledLocales: 'zh-CN',
  status: 'enabled',
  tenantId: 15
}

async function mountView(sites: Record<string, unknown>[] = []) {
  vi.mocked(tenantApi.list).mockResolvedValue([TENANT] as any)
  vi.mocked(siteApi.list).mockResolvedValue(sites as any)
  vi.mocked(siteApi.create).mockResolvedValue({} as any)
  vi.mocked(siteApi.update).mockResolvedValue({} as any)
  vi.mocked(vocabularyApi.portalVocabulary).mockResolvedValue({ questions: [] } as any)
  const wrapper = mount(SitesView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-modal': MODAL,
        'a-table': TABLE_STUB,
        'a-table-column': TABLE_COLUMN_STUB,
        'a-button': Button,
        'a-select': Select,
        'a-input': Input,
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-empty': PASS_THROUGH('AEmpty'),
        // popconfirm 换成把默认槽渲出来、能由测试发 confirm 的壳（真组件走 teleport + rAF）
        'a-popconfirm': {
          name: 'APopconfirm',
          template: '<div class="popconfirm-stub"><slot /></div>'
        }
      }
    }
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function tenantSelect(wrapper: any) {
  return wrapper.findAllComponents(Select).find(
    (node: any) => ((node.props('options') ?? []) as { value: unknown }[]).some(option => option.value === 15)
  )
}

async function fillRequiredInputs(wrapper: any) {
  wrapper
    .findAllComponents(Input)
    .find((node: any) => node.props('placeholder') === 'china-guide')!
    .vm.$emit('update:value', 'new-site')
  wrapper
    .findAllComponents(Input)
    .find((node: any) => node.props('placeholder') === 'China Survival Guide')!
    .vm.$emit('update:value', '新站')
  await flushPromises()
}

async function clickModalOk() {
  const ok = document.querySelector('.modal-ok')
  expect(ok, '弹窗打开后应有确定按钮').toBeTruthy()
  click(ok!)
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  routeQuery.current = {}
  vi.clearAllMocks()
})

describe('建站向导第一跳：归属租户与建后进前采', () => {
  it('新建：选了租户才放行，payload 真的带 tenantId，成功后带租户号跳到前采录入页', async () => {
    const wrapper = await mountView()
    click(byText('新建站点')[0])
    await flushPromises()

    await fillRequiredInputs(wrapper)
    const select = tenantSelect(wrapper)
    expect(select, '新建弹窗里应有归属租户下拉').toBeTruthy()
    expect(select!.props('disabled')).toBeFalsy()
    // 下拉的清单来自 tenantApi.list() 那一份：label 用后端给的租户名，前端不编词表
    expect(((select!.props('options') ?? []) as { label: string }[])[0].label).toBe('甲租户')
    select!.vm.$emit('update:value', 15)
    await flushPromises()

    await clickModalOk()
    expect(siteApi.create).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(siteApi.create).mock.calls[0][0]
    expect(payload.tenantId).toBe(15)
    // 交棒落点是五步向导的第一步（不是那张 hidden 的独立录入页）：租户号照样挂 query 带过去
    expect(pushSpy).toHaveBeenCalledWith({
      name: 'workspace-portal-wizard', query: { step: 'intake', tenantId: '15' }
    })
    wrapper.unmount()
  })

  it('新建：没选租户就被中文话术拦住，一个请求都不发（后端会拒，别静默建无主站）', async () => {
    const wrapper = await mountView()
    click(byText('新建站点')[0])
    await flushPromises()
    await fillRequiredInputs(wrapper)
    await clickModalOk()
    expect(siteApi.create).not.toHaveBeenCalled()
    expect(vi.mocked(message.warning).mock.calls.flat().join()).toContain('归属租户')
    wrapper.unmount()
  })

  it('编辑：归属下拉禁用并如实回显当前租户，payload 里没有 tenantId，也不跳前采', async () => {
    const wrapper = await mountView([BASE_SITE])
    click(byText('编辑')[0])
    await flushPromises()

    const select = tenantSelect(wrapper)
    expect(select, '编辑弹窗里也应看到归属租户这一格').toBeTruthy()
    expect(select!.props('disabled')).toBe(true)
    expect(select!.props('value')).toBe(15)

    await clickModalOk()
    expect(siteApi.update).toHaveBeenCalledTimes(1)
    const [id, payload] = vi.mocked(siteApi.update).mock.calls[0]
    expect(id).toBe(7)
    expect(payload).not.toHaveProperty('tenantId')
    expect(siteApi.create).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

/**
 * M-P40 拍板②：新建的站先落候选，要对外得在行上点「启用」。
 *
 * 这里钉三件：默认值真的是 candidate（不是界面写着候选、发出去是 enabled）、
 * 手建的候选行摆得出那颗按钮、流水线建的候选行<em>不</em>摆（同一颗按钮在那一行上等于替客户点头）。
 */
describe('新建落候选与「启用」把手（M-P40）', () => {
  it('新建：payload 带的状态是 candidate，界面写的与发出去的是同一个', async () => {
    const wrapper = await mountView()
    click(byText('新建站点')[0])
    await flushPromises()

    await fillRequiredInputs(wrapper)
    tenantSelect(wrapper)!.vm.$emit('update:value', 15)
    // 新建那一屏：状态这一格不给下拉，摆出来的是「候选」这个既成事实
    expect(document.body.textContent).toContain('新建的站一律先落这一态')
    await clickModalOk()

    const payload = vi.mocked(siteApi.create).mock.calls[0][0]
    expect(payload.status).toBe('candidate')
    wrapper.unmount()
  })

  it('手建的候选行摆「启用」，点它就发一发只带状态的 PUT', async () => {
    const wrapper = await mountView([{ ...BASE_SITE, status: 'candidate' }])

    const enable = byText('启用')
    expect(enable).toHaveLength(1)
    expect(document.body.textContent).toContain('手建的站，点这一行的「启用」才对外')
    click(enable[0])
    await flushPromises()

    expect(siteApi.update).toHaveBeenCalledTimes(1)
    const [id, payload] = vi.mocked(siteApi.update).mock.calls[0]
    expect(id).toBe(7)
    // 只发被点的那一格：把整行发回去会让别的列再写一遍，界面上看不出来的那种覆盖
    expect(payload).toEqual({ status: 'enabled' })
    expect(vi.mocked(message.success).mock.calls.flat().join()).toContain('已上线')
    wrapper.unmount()
  })

  it('流水线建的候选行不摆「启用」：那一套要客户在候选对比里选中才转正', async () => {
    const wrapper = await mountView([{ ...BASE_SITE, status: 'candidate', buildBriefId: 555, candidateNo: 2 }])

    expect(byText('启用')).toHaveLength(0)
    expect(document.body.textContent).toContain('等客户选中，选中才转正')
    wrapper.unmount()
  })

  it('已上线的行不摆「启用」，也不念候选那句', async () => {
    const wrapper = await mountView([BASE_SITE])

    expect(byText('启用')).toHaveLength(0)
    expect(document.body.textContent).not.toContain('手建的站，点这一行的「启用」才对外')
    wrapper.unmount()
  })
})

/**
 * M-P58 拍板③（2026-10-21 流程评审）：转正后租户后台那两座站——空壳占位站不自动动，
 * 界面上给超管一颗「归档」。判据钉的是摆谁、不摆谁：
 * 带转正时刻的交付站永远不摆（一键藏掉在线正式站是事故），归档的占位行给收回口。
 */
describe('占位站归档把手（M-P58）', () => {
  const POPCONFIRMS = () => ({ name: 'APopconfirm' })

  /** 把「归档候选」这一格从默认的不列切到全量：默认视图根本渲不出归档行，按钮判据会空跑 */
  async function showAllArchived(wrapper: any) {
    const scope = wrapper.findAllComponents(Select).find(
      (node: any) => ((node.props('options') ?? []) as { value: unknown }[]).some(option => option.value === 'only')
    )
    expect(scope, '工具栏上该有那颗「归档候选」范围选择').toBeTruthy()
    scope!.vm.$emit('update:value', 'all')
    await flushPromises()
    await nextTick()
  }

  it('没交付过的停用行摆「归档」，点确认只发一发带状态 PUT', async () => {
    const wrapper = await mountView([{ ...BASE_SITE, status: 'disabled' }])

    expect(byText('归档')).toHaveLength(1)
    const pop = wrapper.findAllComponents(POPCONFIRMS())[0]
    pop.vm.$emit('confirm')
    await flushPromises()

    expect(siteApi.update).toHaveBeenCalledTimes(1)
    const [id, payload] = vi.mocked(siteApi.update).mock.calls[0]
    expect(id).toBe(7)
    expect(payload).toEqual({ status: 'archived' })
    expect(vi.mocked(message.success).mock.calls.flat().join()).toContain('已归档')
    wrapper.unmount()
  })

  it('交付过的停用行（带转正时刻）不摆「归档」：那是客户的正式站，只能走「禁用」', async () => {
    const wrapper = await mountView([
      { ...BASE_SITE, status: 'disabled', promotedAt: '2026-10-20T10:00:00' }
    ])

    expect(byText('归档')).toHaveLength(0)
    wrapper.unmount()
  })

  it('流水线产的候选/归档行不摆这一口：候选归交付链两步走', async () => {
    const wrapper = await mountView([
      { ...BASE_SITE, status: 'archived', buildBriefId: 555, candidateNo: 2 }
    ])
    // 归档行默认被「归档候选=不列」收起来：不切到全量，这一行压根没渲出来，两条 0 都是白测
    await showAllArchived(wrapper)

    expect(byText('归档')).toHaveLength(0)
    expect(byText('放回已停用')).toHaveLength(0)
    wrapper.unmount()
  })

  it('归档错的占位行摆「放回已停用」，点确认发 disabled 那一转', async () => {
    const wrapper = await mountView([{ ...BASE_SITE, status: 'archived' }])
    await showAllArchived(wrapper)

    const restore = byText('放回已停用')
    expect(restore).toHaveLength(1)
    wrapper.findAllComponents(POPCONFIRMS())[0].vm.$emit('confirm')
    await flushPromises()

    expect(siteApi.update).toHaveBeenCalledTimes(1)
    const [, payload] = vi.mocked(siteApi.update).mock.calls[0]
    expect(payload).toEqual({ status: 'disabled' })
    wrapper.unmount()
  })
})
