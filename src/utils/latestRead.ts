import { watch, type Ref } from 'vue'

export interface TenantReadTicket {
  readonly channel: string
  readonly seq: number
  readonly epoch: number
}

/**
 * 「只认最后一发」闸：超管切客户时，旧客户那几发请求可能晚到，
 * 晚到的回包落到界面上就是「B 家的标题、A 家的行」。
 *
 * 用法：发请求前 `const ticket = guard.begin()`，回包落地前 `if (!guard.isCurrent(ticket)) return`。
 *
 * 两道数一起比：
 * - `seq` 按读口分开数（同一屏可能同时读配置与留痕，两路不能互相顶掉），只有同一读口的后发才顶掉先发；
 * - `epoch` 管客户切换本身——切到平台档时界面不再发新的读（没有 begin），只靠 seq 拦不住那一发；
 *   换走再换回来时客户号会回到旧值，只比客户号同样拦不住，所以这里记的是「换过几次」。
 */
export function useTenantReadGuard(tenant: Ref<number | null | undefined>) {
  let epoch = 0
  const seqs = new Map<string, number>()
  watch(tenant, () => { epoch += 1 }, { flush: 'sync' })

  return {
    begin(channel = ''): TenantReadTicket {
      const seq = (seqs.get(channel) ?? 0) + 1
      seqs.set(channel, seq)
      return { channel, seq, epoch }
    },
    isCurrent(ticket: TenantReadTicket): boolean {
      return (seqs.get(ticket.channel) ?? 0) === ticket.seq && ticket.epoch === epoch
    }
  }
}
