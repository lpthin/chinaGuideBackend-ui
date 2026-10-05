import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, RadioGroup, RadioButton, Switch, message } from 'ant-design-vue'
import DailyOutputView from '../DailyOutputView.vue'
import { dailyOutputApi, type DailyOutputConfig, type DailyOutputRun } from '../../../api/dailyOutput'

/**
 * 「每日自动产出」那张配置卡的形状（P9-B 拍板 Q7 的界面那一半）。
 *
 * 这里钉四件会静默变坏的事：
 * 1. 四项读的是后端那一份，没读过成功时**不回填一套默认值**——
 *    空表单与「这一家设成了 05:00 / 5 篇 / 人工审核」在界面上长得一样，后者是假配置；
 * 2. 保存那一半按 `content:output:manage` 摆（拍板原文是「租户管理员可以修改，也可以把这个权限分配给其他人」），
 *    缺码时按钮点不动并点名缺的是哪一码，而不是让人点一次收 403；
 * 3. 后端拒绝时念的是它那句中文，不说「已保存」；
 * 4. 留痕的「为什么没出」原样念后端 `skipReasonText`，前端不拼第二份中文；没见过的状态码显出它自己。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/dailyOutput', () => ({
  dailyOutputApi: { config: vi.fn(), save: vi.fn(), runs: vi.fn() }
}))

const authState = {
  permissions: [] as string[],
  selectedTenantId: null as number | null
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    get permissions() {
      return authState.permissions
    },
    get selectedTenantId() {
      return authState.selectedTenantId
    },
    isSuperAdmin: false,
    hasPermission: (code: string) => authState.permissions.includes(code)
  })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'description', 'type', 'showIcon', 'size', 'label', 'bordered', 'loading'],
  template: `<div class="${name}-stub"><span>{{ title }}{{ message }}{{ description }}</span><slot /><slot name="extra" /></div>`
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  template: `
    <div class="table-stub">
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
      <div v-for="record in dataSource" :key="record.runDate" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

const VIEW = 'content:output:view'
const MANAGE = 'content:output:manage'

function config(overrides: Partial<DailyOutputConfig> = {}): DailyOutputConfig {
  return {
    id: 1,
    tenantId: 15,
    enabled: 1,
    runTime: '03:15',
    dailyCount: 7,
    publishMode: 'auto_publish',
    updatedBy: 88,
    updatedAt: '2026-10-04T21:10:00',
    ...overrides
  }
}

function run(overrides: Partial<DailyOutputRun> = {}): DailyOutputRun {
  return {
    runDate: '2026-10-05',
    status: 'DONE',
    planned: 7,
    produced: 7,
    autoPublished: 0,
    skipReason: null,
    skipReasonText: null,
    note: null,
    updatedAt: '2026-10-05T03:22:00',
    ...overrides
  }
}

async function mountView(options: {
  permissions?: string[]
  cfg?: DailyOutputConfig | null
  configError?: string
  runs?: DailyOutputRun[]
  runsError?: string
} = {}) {
  authState.permissions = options.permissions ?? [VIEW, MANAGE]
  authState.selectedTenantId = null
  if (options.configError) {
    vi.mocked(dailyOutputApi.config).mockRejectedValue(new Error(options.configError))
  } else {
    vi.mocked(dailyOutputApi.config).mockResolvedValue((options.cfg ?? config()) as any)
  }
  if (options.runsError) {
    vi.mocked(dailyOutputApi.runs).mockRejectedValue(new Error(options.runsError))
  } else {
    vi.mocked(dailyOutputApi.runs).mockResolvedValue(options.runs ?? [] as any)
  }
  vi.mocked(dailyOutputApi.save).mockResolvedValue(config() as any)

  const wrapper = mount(DailyOutputView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-alert': PASS_THROUGH('AAlert'),
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-button': Button,
        'a-input': Input,
        'a-input-number': InputNumber,
        'a-switch': Switch,
        'a-radio-group': RadioGroup,
        'a-radio-button': RadioButton,
        'a-table': TABLE_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function byId(wrapper: any, selector: string): HTMLInputElement {
  return wrapper.find(selector).element as HTMLInputElement
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('读回来的是这一家那一份，读不到就不假装', () => {
  it('四项各归各的控件：时刻、篇数、开关与发布方式都取自接口', async () => {
    const wrapper = await mountView()

    expect(byId(wrapper, '#daily-output-run-time').value).toBe('03:15')
    expect(byId(wrapper, '#daily-output-daily-count').value).toBe('7')
    expect(wrapper.find('#daily-output-enabled').attributes('aria-checked')).toBe('true')
    expect(byId(wrapper, 'input[value="auto_publish"]').checked).toBe(true)
    expect(dailyOutputApi.config).toHaveBeenCalledTimes(1)
    expect(dailyOutputApi.runs).toHaveBeenCalledTimes(1)
  })

  it('配置读失败：表单整块不渲染，页面上说的是那句后端报错', async () => {
    const wrapper = await mountView({ configError: '这个租户没认出来' })

    expect(wrapper.text()).toContain('这个租户没认出来')
    expect(wrapper.find('#daily-output-save').exists()).toBe(false)
    // 关键反例：不许把「没读到」渲成一套看着像存过的默认值
    expect(wrapper.find('#daily-output-run-time').exists()).toBe(false)
  })

  it('留痕读失败不渲成一张空表', async () => {
    const wrapper = await mountView({ runsError: '留痕接口 500' })

    expect(wrapper.text()).toContain('留痕接口 500')
    expect(wrapper.find('.table-stub').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('还没有留痕')
  })

  it('留痕的「为什么没出」原样念后端那句话，没见过的状态码显出它自己', async () => {
    const wrapper = await mountView({
      runs: [
        run({ status: 'SKIPPED', produced: 0, skipReason: 'QUOTA_INSUFFICIENT', skipReasonText: '本月额度已用尽，今天没有排产。' }),
        run({ runDate: '2026-10-04', status: 'FUTURE_CODE' })
      ]
    })

    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('本月额度已用尽，今天没有排产。')
    expect(rows[0].text()).not.toContain('QUOTA_INSUFFICIENT')
    expect(rows[1].text()).toContain('FUTURE_CODE')
  })
})

describe('改得动的那一半按权限码摆', () => {
  it('只有查看码时保存点不动，缺的是哪一码写在明处', async () => {
    const wrapper = await mountView({ permissions: [VIEW] })

    const save = wrapper.find('#daily-output-save')
    expect(save.element.getAttribute('disabled')).not.toBeNull()
    expect(wrapper.text()).toContain(MANAGE)

    await save.trigger('click')
    await flushPromises()
    expect(dailyOutputApi.save).not.toHaveBeenCalled()
  })

  it('改完时刻再保存，提交的是界面上这一份', async () => {
    const wrapper = await mountView()

    await wrapper.find('#daily-output-run-time').setValue('04:30')
    await wrapper.find('#daily-output-save').trigger('click')
    await flushPromises()

    expect(dailyOutputApi.save).toHaveBeenCalledWith(
      { enabled: 1, runTime: '04:30', dailyCount: 7, publishMode: 'auto_publish' },
      undefined
    )
    expect(message.success).toHaveBeenCalled()
  })

  it('后端拒绝时念它那句中文，不说「已保存」', async () => {
    vi.mocked(dailyOutputApi.save).mockRejectedValueOnce(new Error('每天篇数只能是 1~20 之间的整数'))
    const wrapper = await mountView()

    await wrapper.find('#daily-output-save').trigger('click')
    await flushPromises()

    expect(message.error).toHaveBeenCalledWith('每天篇数只能是 1~20 之间的整数')
    expect(message.success).not.toHaveBeenCalled()
  })

  it('保存成功后拿接口那份回显，不自己数', async () => {
    vi.mocked(dailyOutputApi.save).mockResolvedValueOnce(
      config({ runTime: '02:00', dailyCount: 3, updatedAt: '2026-10-05T09:00:00' }) as any
    )
    const wrapper = await mountView()

    await wrapper.find('#daily-output-run-time').setValue('11:11')
    await wrapper.find('#daily-output-save').trigger('click')
    await flushPromises()

    // 后端补齐过的值（例如 3:00 → 03:00）必须以接口那份为准，否则界面显示的和库里跑的不是同一个时刻
    expect(byId(wrapper, '#daily-output-run-time').value).toBe('02:00')
    expect(byId(wrapper, '#daily-output-daily-count').value).toBe('3')
  })
})
