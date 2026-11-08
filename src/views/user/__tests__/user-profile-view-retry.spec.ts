import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UserProfileView from '../UserProfileView.vue'
import { profileApi } from '../../../api/auth'

/**
 * SPEC-UI-6 M4：个人信息页的登录日志一栏（此前没有 spec）。
 *
 * 这一栏的读失败只落在表格错误块里，页面本身还会照常显示资料卡——
 * 所以单测钉的是「失败时看得见原因与重试」「点下去重读的是登录日志那一口」「读到就恢复行」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/auth', () => ({
  profileApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    getLoginLogs: vi.fn(),
    uploadAvatar: vi.fn()
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ updateUserInfo: vi.fn() })
}))

const SLOT_RENDER = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /></div>`
})

/** 页面把这几件交给 DataTable：错误原因、重试函数、行。这里只验页面这一侧的接线 */
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
      <div v-else-if="dataSource.length" class="dt-rows">{{ dataSource.length }} 行</div>
      <div v-else class="dt-empty">这一栏还没有内容。</div>
    </div>
  `
}

const STUBS = {
  PageTitle: SLOT_RENDER('PageTitle'),
  DataTable: DataTableStub,
  // 真实 a-tabs 只渲活跃那一栏，这里要把「登录日志」那一栏一起渲出来
  'a-tabs': SLOT_RENDER('ATabs'),
  'a-tab-pane': SLOT_RENDER('ATabPane'),
  'a-card': SLOT_RENDER('ACard'),
  'a-row': SLOT_RENDER('ARow'),
  'a-col': SLOT_RENDER('ACol'),
  'a-form': SLOT_RENDER('AForm'),
  'a-form-item': SLOT_RENDER('AFormItem'),
  'a-upload': SLOT_RENDER('AUpload'),
  'a-avatar': { template: '<div class="avatar-stub" />' },
  'a-button': { template: '<button class="btn-stub"><slot /></button>' },
  'a-input': { template: '<input class="input-stub" />' },
  'a-input-password': { template: '<input class="password-stub" />' },
  'a-divider': { template: '<div class="divider-stub" />' }
}

async function mountView() {
  const wrapper = mount(UserProfileView, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

describe('UserProfileView 的登录日志读失败重试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(profileApi.getProfile).mockResolvedValue({
      id: 1,
      username: 'admin',
      nickname: '管理员',
      email: '',
      phone: '',
      avatar: '',
      tenantId: 2,
      lastLoginAt: '2026-11-01T10:00:00'
    } as any)
  })

  it('读失败时看得见原因与重试，点了重读登录日志那一口，读到就恢复行', async () => {
    vi.mocked(profileApi.getLoginLogs)
      .mockRejectedValueOnce(new Error('登录日志读口断了'))
      .mockResolvedValueOnce({ records: [{ id: 5, username: 'admin', createTime: '2026-11-01T10:00:00' }], total: 1 } as any)

    const wrapper = await mountView()

    expect(wrapper.find('.dt-error').text()).toContain('登录日志读口断了')
    expect(profileApi.getLoginLogs).toHaveBeenCalledTimes(1)

    await wrapper.find('.dt-retry').trigger('click')
    await flushPromises()

    expect(profileApi.getLoginLogs).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.dt-error').exists()).toBe(false)
    expect(wrapper.find('.dt-rows').text()).toContain('1 行')
  })

  it('读成功时直接摆行，不出现错误块', async () => {
    vi.mocked(profileApi.getLoginLogs).mockResolvedValue({
      records: [{ id: 6, username: 'admin', createTime: '2026-11-02T10:00:00' }],
      total: 1
    } as any)

    const wrapper = await mountView()

    expect(wrapper.find('.dt-error').exists()).toBe(false)
    expect(wrapper.find('.dt-rows').text()).toContain('1 行')
  })
})
