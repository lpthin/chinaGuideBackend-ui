import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, Col, Form, FormItem, Input, Row } from 'ant-design-vue'
import UsersPanel from '../UsersPanel.vue'
import { adminApi } from '../../../api/workspace'

/**
 * 用户管理屏的「新增账号必须选客户」（M-P106 第 4 批）。
 *
 * 改前这一栏不存在，后端按「右上角选中的客户」兜底、没选就悄悄落到 1 号客户；
 * 现在三件事：表单里有客户下拉、平台档没选客户就交不上去、平铺列表里写清每一行是谁家的。
 */

const authState = vi.hoisted(() => ({
  selectedTenantId: null as number | null,
  user: { id: 1 }
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  adminApi: {
    users: {
      list: vi.fn(),
      getRoles: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      resetPassword: vi.fn(),
      assignRoles: vi.fn()
    },
    roles: {
      all: vi.fn()
    }
  },
  tenantApi: {
    list: vi.fn()
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    get selectedTenantId() {
      return authState.selectedTenantId
    },
    user: authState.user,
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

/** 表格替身：行照后端真字段摆，「客户」那一栏走真实的 bodyCell 插槽 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) }
  },
  setup(props: any, { slots }: any) {
    return () =>
      h(
        'div',
        { class: 'table-stub' },
        (props.dataSource as any[]).map((record) =>
          h(
            'div',
            { class: 'row', 'data-row': record.id },
            (props.columns as any[])
              .filter((column) => column.key === 'tenant')
              .map((column) => slots.bodyCell?.({ column, record }))
          )
        )
      )
  }
}

/** 弹窗替身：把底栏那颗「确定」做成真按钮，走的是组件挂在 @ok 上的那个处理函数 */
const MODAL_STUB = {
  name: 'AModal',
  props: {
    open: { type: Boolean, default: false },
    onOk: { type: Function, default: undefined }
  },
  setup(props: any, { slots }: any) {
    return () =>
      props.open
        ? h('div', { class: 'modal-stub' }, [
            slots.default?.(),
            h('button', { class: 'modal-ok', onClick: () => props.onOk?.() }, '确定')
          ])
        : null
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag}><slot /><slot name="overlay" /></${tag}>`
})

const ROW = {
  id: 41,
  tenantId: 558,
  tenantName: '蓝山科技',
  username: 'someone',
  nickname: '某人',
  status: 'enabled',
  roleNames: [],
  createdAt: '2026-11-04T00:10:00'
}

async function mountPanel(rows: any[] = []) {
  vi.mocked(adminApi.users.list).mockResolvedValue({ records: rows, total: rows.length } as any)
  vi.mocked(adminApi.users.create).mockResolvedValue({} as any)
  vi.mocked(adminApi.roles.all).mockResolvedValue([] as any)

  const wrapper = mount(UsersPanel, {
    attachTo: document.body,
    global: {
      stubs: {
        'filter-bar': {
          name: 'FilterBar',
          template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>'
        },
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-table': TABLE_STUB,
        'a-modal': MODAL_STUB,
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-input': Input,
        'a-input-password': Input.Password,
        'a-select': PASS_THROUGH('ASelect'),
        'a-select-option': PASS_THROUGH('ASelectOption'),
        'a-button': Button,
        'a-tag': { name: 'ATag', template: '<span><slot /></span>' },
        'a-avatar': { name: 'AAvatar', template: '<span><slot /></span>' },
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-form': Form,
        'a-form-item': FormItem,
        'a-row': Row,
        'a-col': Col,
        'a-radio-group': PASS_THROUGH('ARadioGroup'),
        'a-radio': PASS_THROUGH('ARadio'),
        'a-checkbox-group': PASS_THROUGH('ACheckboxGroup'),
        'a-checkbox': PASS_THROUGH('ACheckbox'),
        'a-alert': PASS_THROUGH('AAlert')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function findButton(wrapper: any, text: string) {
  const button = wrapper.findAll('button').find((b: any) => b.text().includes(text))
  if (!button) throw new Error(`没找到按钮：${text}`)
  return button
}

async function openCreateForm(wrapper: any) {
  await findButton(wrapper, '新增用户').trigger('click')
  await flushPromises()
  await wrapper.find('input[placeholder="请输入用户名"]').setValue('newstaff')
  await wrapper.find('input[placeholder="请输入昵称"]').setValue('新同事')
  await wrapper.find('input[placeholder="请输入密码"]').setValue('Passw0rd')
}

describe('UsersPanel：新增账号必须挂在一家客户名下', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.selectedTenantId = null
  })

  it('平台档没选客户时表单拦住，一个账号都不建', async () => {
    const wrapper = await mountPanel()
    await openCreateForm(wrapper)
    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(adminApi.users.create).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请选择账号所属客户')
  })

  it('站着某一家时表单预填这一家，提交的报文里带着它', async () => {
    authState.selectedTenantId = 558
    const wrapper = await mountPanel()
    await openCreateForm(wrapper)
    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(adminApi.users.create).toHaveBeenCalledTimes(1)
    expect(adminApi.users.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 558, username: 'newstaff', password: 'Passw0rd' })
    )
  })

  it('列表里写清每一行是谁家的账号', async () => {
    const wrapper = await mountPanel([ROW, { ...ROW, id: 42, tenantId: 0, tenantName: '' }])

    const table = wrapper.findComponent({ name: 'ATable' })
    expect(table.props('columns')).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: '客户', key: 'tenant' })])
    )
    expect(wrapper.text()).toContain('蓝山科技')
    expect(wrapper.text()).toContain('未绑定客户')
  })
})
