import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PermissionsPanel from '../PermissionsPanel.vue'
import { adminApi } from '../../../api/workspace'

/**
 * SPEC-UI-6 M4：权限管理面板（此前没有 spec）。
 *
 * 这一屏是树表，读失败时最容易被读成「这个账号没有权限项」；单测钉住
 * 「失败看得见原因与重试 → 点后重读权限树 → 读到就摆出来」这三步。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  adminApi: {
    permissions: {
      tree: vi.fn()
    }
  }
}))

const SLOT_RENDER = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /></div>`
})

const DataTableStub = {
  name: 'DataTable',
  props: {
    dataSource: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    error: { type: String, default: null },
    retry: { type: Function, default: null },
    pagination: { default: null }
  },
  template: `
    <div class="dt-stub">
      <div v-if="error" class="dt-error">{{ error }}<button class="dt-retry" @click="retry && retry()">重试</button></div>
      <div v-else-if="loading" class="dt-loading">读着</div>
      <div v-else-if="dataSource.length" class="dt-rows">{{ dataSource.length }} 项</div>
      <div v-else class="dt-empty">这一栏还没有内容。</div>
    </div>
  `
}

const STUBS = {
  PageTitle: SLOT_RENDER('PageTitle'),
  'filter-bar': SLOT_RENDER('FilterBar'),
  DataTable: DataTableStub,
  'a-card': SLOT_RENDER('ACard'),
  'a-space': SLOT_RENDER('ASpace'),
  'a-form': SLOT_RENDER('AForm'),
  'a-form-item': SLOT_RENDER('AFormItem'),
  'a-row': SLOT_RENDER('ARow'),
  'a-col': SLOT_RENDER('ACol'),
  'a-modal': SLOT_RENDER('AModal'),
  'a-select': { template: '<select class="select-stub" />' },
  'a-select-option': { template: '<option />' },
  'a-button': { template: '<button class="btn-stub"><slot /></button>' },
  'a-input': { template: '<input class="input-stub" />' },
  'a-tag': { template: '<span class="tag-stub"><slot /></span>' }
}

async function mountPanel() {
  const wrapper = mount(PermissionsPanel, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

describe('PermissionsPanel 的读失败重试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('读失败时看得见原因与重试，点了重读权限树，读到就摆出来', async () => {
    vi.mocked(adminApi.permissions.tree)
      .mockRejectedValueOnce(new Error('加载权限列表失败'))
      .mockResolvedValueOnce([{ id: 1, name: '文章', code: 'article', type: 'menu' }] as any)

    const wrapper = await mountPanel()

    expect(wrapper.find('.dt-error').text()).toContain('加载权限列表失败')
    expect(adminApi.permissions.tree).toHaveBeenCalledTimes(1)

    await wrapper.find('.dt-retry').trigger('click')
    await flushPromises()

    expect(adminApi.permissions.tree).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.dt-error').exists()).toBe(false)
    expect(wrapper.find('.dt-rows').text()).toContain('1 项')
  })

  it('读成功时直接摆树，不出现错误块', async () => {
    vi.mocked(adminApi.permissions.tree).mockResolvedValue([
      { id: 2, name: '门户', code: 'portal', type: 'menu' }
    ] as any)

    const wrapper = await mountPanel()

    expect(wrapper.find('.dt-error').exists()).toBe(false)
    expect(wrapper.find('.dt-rows').text()).toContain('1 项')
  })
})
