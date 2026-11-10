import { afterEach, describe, expect, it } from 'vitest'
import {
  ROBOT_BLOCK_ERROR,
  ROBOT_BLOCK_INPUT,
  ROBOT_BLOCK_LOADING,
  ROBOT_BLOCK_MODAL,
  isEditingSomewhere,
  robotBlockingReason
} from '../robotBusy'

/**
 * 闭嘴规则（SPEC-UI-11 §5.3 第 1~4 条）：只认看得见的现场。
 * 这里用真实 document，让 `getClientRects` / `getComputedStyle` 走 happy-dom 的真实路径。
 */
function stage(html: string): Document {
  document.body.innerHTML = html
  return document
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('现场判定', () => {
  it('输入框聚焦时不说话', () => {
    const doc = stage('<input id="name" />')
    ;(doc.getElementById('name') as HTMLInputElement).focus()
    expect(isEditingSomewhere(doc)).toBe(true)
    expect(robotBlockingReason(doc)).toBe(ROBOT_BLOCK_INPUT)
  })

  it('Modal / Drawer 打开时不说话', () => {
    expect(robotBlockingReason(stage('<div class="ant-modal-wrap"></div>'))).toBe(ROBOT_BLOCK_MODAL)
    expect(robotBlockingReason(stage('<div class="ant-drawer-content-wrapper"></div>'))).toBe(ROBOT_BLOCK_MODAL)
    expect(robotBlockingReason(stage('<div class="ant-popover ant-popover-hidden"></div>'))).toBeNull()
  })

  it('加载中或提交中不说话（表格转圈、按钮 loading）', () => {
    expect(robotBlockingReason(stage('<span class="ant-spin-spinning"></span>'))).toBe(ROBOT_BLOCK_LOADING)
    expect(robotBlockingReason(stage('<button class="ant-btn-loading"></button>'))).toBe(ROBOT_BLOCK_LOADING)
    expect(robotBlockingReason(stage('<div data-state="loading"></div>'))).toBe(ROBOT_BLOCK_LOADING)
  })

  it('页面错误块可见时不叠加解释', () => {
    expect(robotBlockingReason(stage('<div data-state="error"></div>'))).toBe(ROBOT_BLOCK_ERROR)
  })

  it('什么都不挡时返回 null', () => {
    expect(robotBlockingReason(stage('<div class="page"></div>'))).toBeNull()
    expect(robotBlockingReason(null)).toBeNull()
  })
})
