import { describe, it, expect } from 'vitest'
import {
  PAYMENT_METHOD_ORDER,
  normalizePaymentMethod,
  paymentMethodLabel,
  paymentMethodOptions,
} from '../paymentMethod'
import {
  ORDER_STATUS_ORDER,
  foldOrderStatus,
  orderStatusMeta,
  orderStatusLabel,
  orderStatusColor,
  countByStatus,
} from '../orderStatus'
import {
  WALLET_STATE_ACTIVE,
  WALLET_STATE_NONE,
  walletIsActive,
  walletEmptyReason,
} from '../walletState'

/**
 * 计费那一族三张词表（M-P91 拍板 4）。
 *
 * 改前的形状是：库里那一列存大写代码（ALIPAY / PAID），界面拿小写去比（'alipay' / 'pending'），
 * 于是订单屏那四张统计卡恒为 0、状态标签念英文、支付方式那一格摆 '-'；
 * 同一句中文在三个文件里各抄了一份副本，改一处漏两处。
 * 用例钉三件事：认库里那种大写、历史小写行照认、认不出来的原样带出而不是归成某个已知状态。
 */

describe('支付方式词表', () => {
  it('摆的顺序与五种中文念法', () => {
    expect(PAYMENT_METHOD_ORDER).toEqual(['WECHAT', 'ALIPAY', 'BANK_TRANSFER', 'CREDIT_CARD', 'BALANCE'])
    expect(paymentMethodOptions().map(item => item.label))
      .toEqual(['微信支付', '支付宝', '银行转账', '信用卡', '余额支付'])
  })

  it('库里那种大写代码认得，历史小写行也认得（同一格不许有两种方言）', () => {
    expect(normalizePaymentMethod('ALIPAY')).toBe('ALIPAY')
    expect(normalizePaymentMethod('alipay')).toBe('ALIPAY')
    expect(normalizePaymentMethod(' balance ')).toBe('BALANCE')
  })

  it('认不出来的不编名字：原样摆出来，让看的人知道词表里没有这一档', () => {
    expect(normalizePaymentMethod('paypal')).toBeNull()
    expect(paymentMethodLabel('paypal')).toBe('paypal')
    expect(paymentMethodLabel('')).toBe('-')
    expect(paymentMethodLabel(undefined)).toBe('-')
  })

  it('界面念的是中文，发给后端的仍是那一格原始代码（词表只翻念法，不改数据）', () => {
    const option = paymentMethodOptions().find(item => item.value === 'BALANCE')!
    expect(option.label).toBe('余额支付')
    expect(option.value).toBe('BALANCE')
  })
})

describe('充值订单状态词表', () => {
  it('四档各有中文与颜色，顺序与后端一致', () => {
    expect(ORDER_STATUS_ORDER).toEqual(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'])
    expect(ORDER_STATUS_ORDER.map(orderStatusLabel)).toEqual(['待支付', '已支付', '已取消', '已退款'])
    expect(ORDER_STATUS_ORDER.map(orderStatusColor)).toEqual(['orange', 'green', 'default', 'blue'])
  })

  it('库里那一行不论大小写都折成大写再比（上一版拿小写比，四张卡就恒为 0）', () => {
    expect(foldOrderStatus('pending')).toBe('PENDING')
    expect(foldOrderStatus(' Paid ')).toBe('PAID')
    expect(orderStatusLabel('paid')).toBe('已支付')
    expect(foldOrderStatus('')).toBeNull()
    expect(foldOrderStatus(null)).toBeNull()
    expect(foldOrderStatus(undefined)).toBeNull()
  })

  it('认不出的状态原样显示且不给已知颜色：不把脏数据静默归成「待支付」', () => {
    expect(orderStatusMeta('CHARGEBACK')).toEqual({ label: 'CHARGEBACK', color: 'default' })
    expect(orderStatusMeta('')).toEqual({ label: '-', color: 'default' })
  })

  it('统计卡按这一份词表数：小写行照数，认不出的一格不数', () => {
    const counts = countByStatus([
      { status: 'PENDING' }, { status: 'pending' }, { status: 'PAID' }, { status: 'CHARGEBACK' }, {}, null,
    ])
    expect(counts).toEqual({ PENDING: 2, PAID: 1, CANCELLED: 0, REFUNDED: 0 })
  })
})

describe('钱包状态那一格', () => {
  it('只有后端回 ACTIVE 才算这家有钱包', () => {
    expect(walletIsActive({ walletState: WALLET_STATE_ACTIVE })).toBe(true)
    expect(walletIsActive({ walletState: WALLET_STATE_NONE })).toBe(false)
    expect(walletIsActive({})).toBe(false)
    expect(walletIsActive(null)).toBe(false)
  })

  it('「这家还没有钱包」与「这一发没读到」分两句说，不许糊成一句', () => {
    expect(walletEmptyReason(null)).toBe('没取到钱包信息，请刷新或重试')
    expect(walletEmptyReason({ walletState: WALLET_STATE_NONE })).toBe('这家还没有钱包，充值后这里会显示余额')
    expect(walletEmptyReason({ walletState: WALLET_STATE_ACTIVE })).toBe('')
  })
})
