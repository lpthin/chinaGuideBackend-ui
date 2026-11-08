import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import { rememberRawDetail } from '../../utils/errorRaw'

/**
 * SPEC-UI-7 U2：403 的求助入口、401 的重新登录。
 * 这两条路的落点要用真的「按了什么」来钉，不能只断言按钮存在。
 */
const mocks = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('../../router', () => ({ router: { push: mocks.push } }))

import ErrorHelpActions from '../ErrorHelpActions.vue'

const BUTTON = {
  name: 'AButton',
  emits: ['click'],
  template: '<button class="btn-stub" @click="$emit(\'click\')"><slot /></button>',
}

const mountActions = (text: string) =>
  mount(ErrorHelpActions, { props: { text }, global: { stubs: { 'a-button': BUTTON } } })

beforeEach(() => {
  mocks.push.mockReset()
  setActivePinia(createPinia())
})

function loginWith(permissions: string[] = [], roles: string[] = []): void {
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'u', roles, permissions } as any
}

describe('ErrorHelpActions', () => {
  it('403 且账号有工单权限：摆出工单入口与复制诊断', () => {
    loginWith(['portal:ticket:submit'])
    const w = mountActions('没有权限执行该操作')
    expect(w.find('.error-help-actions__ticket').exists()).toBe(true)
    expect(w.find('.error-help-actions__copy').exists()).toBe(true)
    expect(w.text()).toContain('提交工单')
  })

  it('403 但账号没有工单权限：不摆一个点进去就 403 的按钮，只给复制诊断', () => {
    loginWith([])
    const w = mountActions('没有权限执行该操作')
    expect(w.find('.error-help-actions__ticket').exists()).toBe(false)
    expect(w.find('.error-help-actions__copy').exists()).toBe(true)
  })

  it('超管视为有工单入口', () => {
    loginWith([], ['SUPER_ADMIN'])
    const w = mountActions('没有权限执行该操作')
    expect(w.find('.error-help-actions__ticket').exists()).toBe(true)
  })

  it('点工单入口去站内「联系平台」，不外跳', async () => {
    loginWith(['portal:ticket:submit'])
    const w = mountActions('没有权限执行该操作')
    await w.find('.error-help-actions__ticket').trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/workspace/portal/support')
  })

  it('点复制诊断：拿到的是一段能直接贴给管理员的完整信息', async () => {
    loginWith(['portal:ticket:submit'])
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mountActions('没有权限执行该操作')
    await w.find('.error-help-actions__copy').trigger('click')
    await Promise.resolve()
    const copied = writeText.mock.calls[0][0] as string
    expect(copied).toContain('错误：没有权限执行该操作')
    expect(copied).toContain('页面：')
    expect(copied).toContain('时间：')
    expect(copied).toContain('原文：')
    await w.vm.$nextTick()
    expect(w.text()).toContain('已复制诊断信息')
  })

  it('G2：复制诊断带上原文里的 requestId，后端能按 id 定位那一次请求', async () => {
    loginWith(['portal:ticket:submit'])
    rememberRawDetail('没有权限执行该操作-G2', 'GET /api/audit-logs → HTTP 403\nrequestId: req-abc')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mountActions('没有权限执行该操作-G2')
    await w.find('.error-help-actions__copy').trigger('click')
    await Promise.resolve()
    expect(writeText.mock.calls[0][0]).toContain('requestId: req-abc')
  })

  it('401 只摆「重新登录」，点后带当前路径去登录页', async () => {
    loginWith([])
    const w = mountActions('登录状态已失效，请重新登录')
    expect(w.find('.error-help-actions__relogin').exists()).toBe(true)
    expect(w.find('.error-help-actions__copy').exists()).toBe(false)
    await w.find('.error-help-actions__relogin').trigger('click')
    const target = mocks.push.mock.calls[0][0] as { path: string; query: Record<string, string> }
    expect(target.path).toBe('/login')
    expect(target.query.redirect).toMatch(/^\//)
  })

  it('认不出来的业务提示不摆任何求助按钮', () => {
    loginWith([])
    const w = mountActions('请先选择客户')
    expect(w.find('.error-help-actions').exists()).toBe(false)
  })
})
