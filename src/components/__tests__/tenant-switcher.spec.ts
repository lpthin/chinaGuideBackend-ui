import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import TenantSwitcher from '../TenantSwitcher.vue'
import { useAuthStore } from '@/stores/auth'

/**
 * Spec-F §13-13 / P6-B 拍板 A 的界面那一半：超管点了个后端认不出来的租户时，
 * 顶栏必须念出「这一批空列表是没认出租户导致的」，并且给一条出路。
 *
 * 钉住四条：
 * 1. 后端点名（响应头那一位）时念的是**原串**，不是替它编的名字；
 * 2. 后端还没回话、但本地租户列表里翻不到这个号时也要说——不必等客户先看一眼空列表；
 * 3. 列表**读失败**不等于「租户不存在」，那种情况下不许念这句（那是第二种谎）；
 * 4. 「看全部租户」是真清掉选择（走 store + localStorage），不是只把话藏起来。
 */
const { list } = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('@/api/workspace', () => ({
  tenantApi: { list: () => list() }
}))

/** a-select 只留下「当前选中的号」这一个可读形状，警告文案才是这里的被测对象 */
const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'options', 'placeholder', 'filterOption', 'showSearch', 'size'],
  emits: ['update:value', 'change'],
  template: '<div class="select-stub">{{ value }}</div>'
}

const SEGMENTED_STUB = {
  name: 'ASegmented',
  props: ['value', 'options', 'size'],
  emits: ['change'],
  template: '<div class="segmented-stub">{{ options.map(o => o.label).join("/") }}</div>'
}

const TENANT_15 = { id: 15, name: '纳欣口腔', code: 'dental' }

function mountSwitcher() {
  return mount(TenantSwitcher, {
    global: {
      // setup.ts 把 a-button 全局 stub 掉了；这里要用真实按钮，否则「点出路」那一条测的是 stub
      components: { 'a-button': Button },
      stubs: { 'a-select': SELECT_STUB, 'a-segmented': SEGMENTED_STUB, 'a-button': false }
    }
  })
}

describe('TenantSwitcher 的「认不出租户」提示', () => {
  const auth = useAuthStore()

  beforeEach(() => {
    list.mockReset()
    auth.markTenantUnresolved(null)
    auth.switchTenant(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('后端点名时把原串念出来，并说清空列表不是没有数据', async () => {
    list.mockResolvedValue([TENANT_15])
    auth.switchTenant(99001, null)
    auth.markTenantUnresolved('99001')

    const wrapper = mountSwitcher()
    await flushPromises()

    const warning = wrapper.find('[data-test="tenant-unresolved"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('99001')
    expect(warning.text()).toContain('不存在或已被删除')
    expect(warning.text()).toContain('不代表这家真的没有数据')
  })

  it('后端还没回话、本地列表翻不到这个号时也要说', async () => {
    list.mockResolvedValue([TENANT_15])
    auth.switchTenant(99001, null)

    const wrapper = mountSwitcher()
    await flushPromises()

    const warning = wrapper.find('[data-test="tenant-unresolved"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('99001')
    expect(warning.text()).toContain('已不在租户列表里')
  })

  it('认得出的正常租户不该出现这一句', async () => {
    list.mockResolvedValue([TENANT_15])
    auth.switchTenant(15, 'dental')

    const wrapper = mountSwitcher()
    await flushPromises()

    expect(wrapper.find('[data-test="tenant-unresolved"]').exists()).toBe(false)
  })

  it('列表读失败时说不出「租户不存在」这句谎', async () => {
    list.mockRejectedValue(new Error('无法连接服务器，请确认后端已启动'))
    auth.switchTenant(15, 'dental')

    const wrapper = mountSwitcher()
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-test="tenant-unresolved"]').exists()).toBe(false)
  })

  it('出路那条按钮切换到第一个租户（含 localStorage），不是只把选择藏起来', async () => {
    list.mockResolvedValue([TENANT_15])
    auth.switchTenant(99001, null)
    auth.markTenantUnresolved('99001')
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...(window as any).location, pathname: '/workspace', reload },
      writable: true,
      configurable: true
    })

    const wrapper = mountSwitcher()
    await flushPromises()

    const clear = wrapper.find('[data-test="tenant-unresolved-clear"]')
    expect(clear.exists()).toBe(true)
    // happy-dom 里 a11y 那一层的 click 会静默失效，这里按真实控件直接触发
    ;(clear.element as HTMLElement).click()
    await nextTick()

    // 现在出路是切换到第一个租户，不是清空选择
    expect(auth.selectedTenantId).toBe(15)
    expect(localStorage.getItem('selected_tenant_id')).toBe('15')
    expect(auth.tenantUnresolvedDeclaration).toBeNull()
    expect(reload).toHaveBeenCalled()
  })
})

/**
 * 顶栏这一格念的是**名字**，不是号：现场截图上出现过孤零零的「15」——
 * a-select 的 label 来自 options，而 options 要等 /admin/tenants 回来才有内容，
 * 于是「列表还没回」与「列表里没这一位」两种情况下，组件把 value 原样打在顶栏上。
 * 这里钉三种念法，防止再退回裸数字。
 */
function currentOptions(wrapper: ReturnType<typeof mountSwitcher>) {
  return (wrapper.findComponent({ name: 'ASelect' }).props('options') || []) as Array<{
    label: string
    value: number
  }>
}

describe('TenantSwitcher 顶栏那一格念得出名字', () => {
  const auth = useAuthStore()

  beforeEach(() => {
    list.mockReset()
    auth.markTenantUnresolved(null)
    auth.switchTenant(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('列表里有这一位时只念名字，不兜底', async () => {
    list.mockResolvedValue([TENANT_15])
    auth.switchTenant(15, 'dental')

    const wrapper = mountSwitcher()
    await flushPromises()

    // 下拉里只有租户，「平台」已经挪到框外与它平级
    expect(currentOptions(wrapper)).toEqual([
      { label: '纳欣口腔', value: 15 }
    ])
  })

  it('列表读回来了却没这一位：兜底 label 说清「不在列表里」，值仍是那一位', async () => {
    list.mockResolvedValue([TENANT_15])
    auth.switchTenant(99001, null)

    const wrapper = mountSwitcher()
    await flushPromises()

    const opts = currentOptions(wrapper)
    expect(opts[0].value).toBe(99001)
    expect(opts[0].label).toContain('99001')
    expect(opts[0].label).toContain('不在列表里')
  })

  it('列表读失败时念「列表没读到」，不许念成「这家不存在」', async () => {
    list.mockRejectedValue(new Error('无法连接服务器'))
    auth.switchTenant(15, 'dental')

    const wrapper = mountSwitcher()
    await flushPromises()
    await nextTick()

    const opts = currentOptions(wrapper)
    expect(opts[0].label).toContain('列表没读到')
    expect(opts[0].label).not.toContain('不在列表里')
  })

  it('列表还在路上时先念「租户 15」，不抢答「不在列表里」', async () => {
    list.mockReturnValue(new Promise(() => {}))
    auth.switchTenant(15, 'dental')

    const wrapper = mountSwitcher()
    await nextTick()

    const opts = currentOptions(wrapper)
    expect(opts[0].label).toBe('租户 15')
  })
})

/**
 * 「平台」与「租户」是两种查看范围，平级放在下拉框外面：
 * 平台档时下拉根本不出现；切回租户档默认落在列表第一家。
 */
describe('TenantSwitcher 的平台/租户平级切换', () => {
  const auth = useAuthStore()

  beforeEach(() => {
    list.mockReset()
    auth.markTenantUnresolved(null)
    auth.switchTenant(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(window, 'location', {
      value: { ...(window as any).location, pathname: '/workspace', reload: vi.fn() },
      writable: true,
      configurable: true
    })
  })

  it('平台档（未选租户）时只有切换器，没有租户下拉', async () => {
    list.mockResolvedValue([TENANT_15])

    const wrapper = mountSwitcher()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ASegmented' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ASelect' }).exists()).toBe(false)
  })

  it('从平台切到租户：落在列表第一家并 reload，选择真写进 store 和 localStorage', async () => {
    list.mockResolvedValue([TENANT_15])

    const wrapper = mountSwitcher()
    await flushPromises()

    wrapper.findComponent({ name: 'ASegmented' }).vm.$emit('change', 'tenant')
    await nextTick()

    expect(auth.selectedTenantId).toBe(15)
    expect(localStorage.getItem('selected_tenant_id')).toBe('15')
    expect((window as any).location.reload).toHaveBeenCalled()
  })

  it('从租户切回平台：清掉租户选择（含 localStorage）并 reload', async () => {
    list.mockResolvedValue([TENANT_15])
    auth.switchTenant(15, 'dental')

    const wrapper = mountSwitcher()
    await flushPromises()

    wrapper.findComponent({ name: 'ASegmented' }).vm.$emit('change', 'platform')
    await nextTick()

    expect(auth.selectedTenantId).toBeNull()
    expect(localStorage.getItem('selected_tenant_id')).toBeNull()
    expect((window as any).location.reload).toHaveBeenCalled()
  })
})
