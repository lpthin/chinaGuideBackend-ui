// 钱包状态那一格的唯一出处。后端 BillingWalletController.WALLET_STATE_NONE / _ACTIVE
// 回的就是这两个字面串，界面靠它把「这家还没开过钱包」与「这一发没读到」分开念。

export const WALLET_STATE_NONE = 'NONE'
export const WALLET_STATE_ACTIVE = 'ACTIVE'

export type WalletState = typeof WALLET_STATE_NONE | typeof WALLET_STATE_ACTIVE

/** 有钱包行才有余额可念；NONE 与读不到都摆 —，但下面那句话不一样 */
export function walletIsActive(info?: { walletState?: string } | null): boolean {
  return info?.walletState === WALLET_STATE_ACTIVE
}

/** 念给客户的解释。读不到（null）与「这家还没钱包」是两件事，不许混成一句 */
export function walletEmptyReason(info?: { walletState?: string } | null): string {
  if (!info) return '没取到钱包信息，请刷新或重试'
  if (info.walletState === WALLET_STATE_NONE) return '这家还没有钱包，充值后这里会显示余额'
  return ''
}
