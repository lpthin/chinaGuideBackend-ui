import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTenantReadGuard } from '../latestRead'

/**
 * 「只认最后一发」的判据出处（M-P108：超管切客户时旧请求晚到）。
 *
 * 钉四件：
 * 1. 后发的顶掉先发的——先发那一发哪怕晚回来，也不算数；
 * 2. 客户号变了就不算数——切到平台档时界面不再发新的读（没有 begin），只靠号码拦不住；
 * 3. 换走再换回来，旧的那一发依旧不算数——客户号回到旧值也不能复活它；
 * 4. 一屏两路读（配置与留痕）各数各的——后一路不许把前一路上还没回来的那一发顶掉。
 */
describe('useTenantReadGuard', () => {
  it('后发的顶掉先发的', () => {
    const tenant = ref<number | null>(15)
    const guard = useTenantReadGuard(tenant)

    const first = guard.begin()
    const second = guard.begin()

    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)
  })

  it('客户号变了，号码再新也不算数', () => {
    const tenant = ref<number | null>(15)
    const guard = useTenantReadGuard(tenant)

    const ticket = guard.begin()
    tenant.value = null

    expect(guard.isCurrent(ticket)).toBe(false)
  })

  it('换走再换回来，旧那一发不复活', () => {
    const tenant = ref<number | null>(15)
    const guard = useTenantReadGuard(tenant)

    const ticket = guard.begin()
    tenant.value = 16
    tenant.value = 15

    expect(guard.isCurrent(ticket)).toBe(false)
  })

  it('一屏两路读各数各的：配置那一发还在路上，留痕那一发不算顶掉它', () => {
    const tenant = ref<number | null>(15)
    const guard = useTenantReadGuard(tenant)

    const config = guard.begin('config')
    const runs = guard.begin('runs')
    expect(guard.isCurrent(config)).toBe(true)
    expect(guard.isCurrent(runs)).toBe(true)

    const configAgain = guard.begin('config')
    expect(guard.isCurrent(config)).toBe(false)
    expect(guard.isCurrent(runs)).toBe(true)
    expect(guard.isCurrent(configAgain)).toBe(true)
  })
})
