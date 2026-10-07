import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import {
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  InputPassword,
  Popconfirm,
  Row,
  Col,
  Switch,
  Tag,
  Textarea,
  message
} from 'ant-design-vue'
import AlertChannelView from '../AlertChannelView.vue'
import { alertApi } from '../../../api/workspace'
import type { AlertChannelConfig } from '../../../types/workspace'

/**
 * 通知渠道这一页（P11-10 拍板①③④的界面那一半）。
 *
 * 钉三件在这个页面上真出过事的地方：
 * 1. **载荷格式必须能选，而且默认不能是飞书**——历史渠道发的是平铺 JSON，
 *    默认值一改成 feishu，别人家的接收端第二天就收不到东西了。
 * 2. **掩码要能原样存回去**：读回来是 `****`，编辑时不改的那一格提交回去
 *    也得是这串 `****`，后端认出掩码才沿用库里真值；前端要是自作主张清空，
 *    等于一保存就把人家的地址抹了。
 * 3. **发不出去的配置不许存**：收件邮箱一格不填，报警只会默默躺在通知日志里
 *    记一条失败，人在界面上完全看不出这个渠道本来就没法用。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  alertApi: {
    channels: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}))

const authState = {
  selectedTenantId: null as number | null
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    get selectedTenantId() {
      return authState.selectedTenantId
    },
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'description', 'type', 'showIcon', 'bordered'],
  template: `<div class="${name}-stub"><span>{{ title }}{{ message }}</span><slot /><slot name="actions" /></div>`
})

/**
 * a-select 的下拉在 jsdom 里点开不可靠，这里把它换成原生 select：
 * 组件真实那条 v-model:value / @change 接线照旧走，只把弹层换成浏览器控件。
 * Ant 真控件在浏览器验收里点过。
 */
const SELECT_STUB = {
  name: 'ASelect',
  props: { value: { type: [String, Number], default: undefined } },
  emits: ['update:value'],
  setup(props: any, { slots, emit }: any) {
    return () =>
      h(
        'select',
        {
          class: 'select-stub',
          value: props.value,
          onChange: (event: Event) => emit('update:value', (event.target as HTMLSelectElement).value)
        },
        slots.default ? slots.default() : []
      )
  }
}

const OPTION_STUB = {
  name: 'ASelectOption',
  props: ['value'],
  template: '<option :value="value"><slot /></option>'
}

const MODAL_STUB = {
  name: 'AModal',
  props: ['open', 'title'],
  emits: ['ok', 'cancel', 'update:open'],
  template: `
    <div class="modal-stub">
      <span class="modal-title">{{ title }}</span>
      <slot />
      <button class="ok-stub" @click="$emit('ok')">确 定</button>
      <button class="cancel-stub" @click="$emit('cancel')">取 消</button>
    </div>`
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  template: `
    <div class="table-stub">
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

const WEBHOOK_ROW = {
  id: 1,
  tenantId: 1,
  channelType: 'webhook',
  name: '自建接收端',
  config: '{"url":"https://example.internal/****abcd","format":"generic","method":"POST","headers":{},"secret":""}',
  isDefault: true,
  createdAt: '2026-10-08T00:57:10',
  updatedAt: '2026-10-08T00:57:10'
} as unknown as AlertChannelConfig

const EMAIL_ROW = {
  id: 2,
  tenantId: 1,
  channelType: 'email',
  name: '报警邮箱',
  config:
    '{"smtpHost":"smtp.example.com","smtpPort":465,"useSsl":true,"username":"ops@example.com","password":"XyzA****BcDe","fromEmail":"ops@example.com","fromName":"报警","toEmails":"ops@example.com"}',
  isDefault: true,
  createdAt: '2026-10-08T00:57:11',
  updatedAt: '2026-10-08T00:57:11'
} as unknown as AlertChannelConfig

async function mountView(rows: AlertChannelConfig[] = [WEBHOOK_ROW, EMAIL_ROW]) {
  authState.selectedTenantId = null
  vi.mocked(alertApi.channels.list).mockResolvedValue({ records: rows, total: rows.length } as any)
  vi.mocked(alertApi.channels.create).mockResolvedValue({ id: 9 } as any)
  vi.mocked(alertApi.channels.update).mockResolvedValue({ id: 1 } as any)

  const wrapper = mount(AlertChannelView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-alert': PASS_THROUGH('AAlert'),
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-modal': MODAL_STUB,
        'a-select': SELECT_STUB,
        'a-select-option': OPTION_STUB,
        'a-table': TABLE_STUB,
        'a-pagination': { name: 'APagination', template: '<div class="pager-stub" />' },
        FilterBar: PASS_THROUGH('FilterBar'),
        'a-form': Form,
        'a-form-item': FormItem,
        'a-button': Button,
        'a-input': Input,
        'a-input-password': InputPassword,
        'a-input-number': InputNumber,
        'a-textarea': Textarea,
        'a-switch': Switch,
        'a-tag': Tag,
        'a-popconfirm': Popconfirm,
        // 全局档把 a-row/a-col 默认 stub 掉了，而 Ant 的 FormItem 把输入框装在 Row 的 slot 里：
        // 不在这里换回真组件，整个表单渲成一排空壳，find 全落空
        'a-row': Row,
        'a-col': Col
      }
    }
  })
  await flushPromises()
  return wrapper
}

const buttonByText = (wrapper: any, text: string) =>
  wrapper.findAll('button').find((node: any) => node.text().trim().includes(text))

const submittedConfig = () => JSON.parse(String(vi.mocked(alertApi.channels.create).mock.calls[0][0].config))
const updatedConfig = () => JSON.parse(String(vi.mocked(alertApi.channels.update).mock.calls[0][1].config))

const inputValue = (wrapper: any, selector: string) =>
  (wrapper.find(selector).element as HTMLInputElement).value
const textareaValue = (wrapper: any, selector: string) =>
  (wrapper.find(selector).element as HTMLTextAreaElement).value

const openAdd = async (wrapper: any) => {
  await buttonByText(wrapper, '新增渠道')!.trigger('click')
  await flushPromises()
}

const openEdit = async (wrapper: any, index: number) => {
  const edits = wrapper.findAll('button').filter((node: any) => node.text().trim() === '编辑')
  await edits[index].trigger('click')
  await flushPromises()
}

const clickOk = async (wrapper: any) => {
  await wrapper.find('.ok-stub').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('新增渠道', () => {
  it('默认载荷是通用 JSON：不能一觉把历史接收端改成飞书那一份', async () => {
    const wrapper = await mountView()

    await openAdd(wrapper)
    await wrapper.find('input[placeholder="请输入渠道名称"]').setValue('自建接收端二')
    await wrapper.find('input[placeholder="请输入Webhook地址"]').setValue('https://hook.example/new')
    await clickOk(wrapper)

    expect(alertApi.channels.create).toHaveBeenCalledTimes(1)
    expect(submittedConfig()).toMatchObject({ url: 'https://hook.example/new', format: 'generic' })
  })

  it('选了「飞书群机器人」才发那一份载荷', async () => {
    const wrapper = await mountView()

    await openAdd(wrapper)
    await wrapper.find('input[placeholder="请输入渠道名称"]').setValue('飞书群')
    await wrapper
      .find('input[placeholder="请输入Webhook地址"]')
      .setValue('https://open.feishu.cn/open-apis/bot/v2/hook/11112222-3333-4444-5555-666677778888')

    const formatSelect = wrapper
      .findAll('.select-stub')
      .find((node: any) => node.findAll('option').some((o: any) => o.text().includes('飞书')))
    await formatSelect!.setValue('feishu')
    await clickOk(wrapper)

    expect(submittedConfig().format).toBe('feishu')
  })

  it('Webhook 地址空着就当面拦下：不带着空地址去建一个发不出去的渠道', async () => {
    const wrapper = await mountView()

    await openAdd(wrapper)
    await wrapper.find('input[placeholder="请输入渠道名称"]').setValue('没地址的')
    await clickOk(wrapper)

    expect(message.warning).toHaveBeenCalledWith('请填写 Webhook 地址')
    expect(alertApi.channels.create).not.toHaveBeenCalled()
    expect(message.success).not.toHaveBeenCalled()
  })
})

describe('编辑渠道', () => {
  it('掩码原样回传：不改的那一格交给后端沿用库里的真值', async () => {
    const wrapper = await mountView()

    await openEdit(wrapper, 0)
    expect(wrapper.text()).toContain('地址与密钥读回来是掩码')

    await clickOk(wrapper)

    expect(alertApi.channels.update).toHaveBeenCalledTimes(1)
    expect(updatedConfig().url).toBe('https://example.internal/****abcd')
    expect(message.success).toHaveBeenCalledWith('更新成功')
  })

  it('邮件渠道：授权码读回来是掩码，收件邮箱读回来是真值', async () => {
    const wrapper = await mountView()

    await openEdit(wrapper, 1)

    expect(inputValue(wrapper, 'input[placeholder="请输入邮箱密码或授权码"]')).toBe('XyzA****BcDe')
    expect(textareaValue(wrapper, 'textarea[placeholder="ops@example.com, alert@example.com"]')).toBe(
      'ops@example.com'
    )
  })

  it('收件邮箱被清空：当面拦下，不留一个只会失败的渠道', async () => {
    const wrapper = await mountView()

    await openEdit(wrapper, 1)
    await wrapper.find('textarea[placeholder="ops@example.com, alert@example.com"]').setValue('   ')
    await clickOk(wrapper)

    expect(message.warning).toHaveBeenCalledWith('请填写至少一个收件邮箱')
    expect(alertApi.channels.update).not.toHaveBeenCalled()
    expect(message.success).not.toHaveBeenCalled()
  })

  it('编辑完再新增：上一格留下的真值不能跟着跑到新渠道上', async () => {
    const wrapper = await mountView()

    await openEdit(wrapper, 1)
    await openAdd(wrapper)

    expect(inputValue(wrapper, 'input[placeholder="请输入渠道名称"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="请输入Webhook地址"]')).toBe('')
    expect(buttonByText(wrapper, '确 定')).toBeTruthy()
    expect(wrapper.text()).not.toContain('地址与密钥读回来是掩码')
  })
})
