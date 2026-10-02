import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TenantSelect from '../TenantSelect.vue'
import { tenantApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'

/**
 * 租户下拉的诚实态（全站普查 1a）。
 *
 * `/api/admin/tenants` 每个方法第一行都是 checkSuperAdmin()：租户档点进来必然被拒，
 * 而这一层以前把「被拒」和「请求失败」都吞成 console.error，界面只剩一个空下拉框，
 * 看起来像「平台上没有租户」。缺的是码，不是数据，界面就必须说缺的是码。
 */

const SELECT_STUB = {
  name: 'ASelect',
  props: ['placeholder', 'disabled', 'options', 'value', 'filterOption'],
  template: '<div class="select-stub" :data-placeholder="placeholder" :data-disabled="String(disabled)"></div>'
}

vi.mock('../../api/workspace', () => ({
  tenantApi: { list: vi.fn() }
}))

async function mountAs(roles: string[], permissions: string[]) {
  useAuthStore().user = { id: 1, username: 'tester', roles, permissions } as any
  const wrapper = mount(TenantSelect, {
    attachTo: document.body,
    global: { stubs: { 'a-select': SELECT_STUB } }
  })
  await flushPromises()
  return wrapper
}

function select(wrapper: any) {
  return wrapper.findComponent(SELECT_STUB)
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(tenantApi.list).mockResolvedValue([{ id: 15, code: 'jingtian', name: '萧山景天牙科医院' }] as any)
})

describe('TenantSelect 按码决定发不发那一条请求', () => {
  it('不是超管：一条都不发，占位语说清缺的是超管身份，下拉是灭的', async () => {
    const wrapper = await mountAs(['SITE_ADMIN'], ['portal:siteinfo:manage'])
    expect(tenantApi.list).not.toHaveBeenCalled()
    expect(select(wrapper).attributes('data-placeholder')).toBe('需要超级管理员权限，无法列出租户')
    expect(select(wrapper).attributes('data-disabled')).toBe('true')
    expect(select(wrapper).props('options')).toHaveLength(0)
    wrapper.unmount()
  })

  it('是超管：照常拉列表，占位语回到用户给的那句', async () => {
    const wrapper = await mountAs(['SUPER_ADMIN'], ['portal:admin:tenant'])
    expect(tenantApi.list).toHaveBeenCalledTimes(1)
    expect(select(wrapper).props('options')).toHaveLength(1)
    expect(select(wrapper).attributes('data-disabled')).toBe('false')
    wrapper.unmount()
  })

  it('超管但接口真的坏了：说的是「读取失败 + 后端原话」，不是「没有租户」', async () => {
    vi.mocked(tenantApi.list).mockRejectedValueOnce(new Error('数据库连接超时'))
    const wrapper = await mountAs(['SUPER_ADMIN'], [])
    expect(select(wrapper).attributes('data-placeholder')).toContain('租户列表读取失败：数据库连接超时')
    wrapper.unmount()
  })
})
