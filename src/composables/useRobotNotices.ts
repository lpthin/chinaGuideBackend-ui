/**
 * 页面使用机器人的唯一入口（SPEC-UI-11 §4.1）。
 *
 * 页面只调这一个 composable：它把消息交给中枢，不认识 `RobotHost`、不认识气泡。
 * 挂载与卸载由 `RobotHost` 统一管（它跟着路由走），这里只管「说什么」与「现在能不能说」。
 *
 * 用法：
 * ```ts
 * const robot = useRobotNotices()
 * robot.announce({ key: 'analytics.scope', category: 'scope', priority: 'p2', text: '…' })
 * robot.setReady(true)   // 数据到了再说（否则消息先压住，避免抢在「没有数据」之前说话）
 * ```
 */
import { onUnmounted } from 'vue'
import { robotCenter, type RobotCenter } from '../components/robot/robotCenter'
import type { RobotNoticeInput } from '../components/robot/robotRegistry'

export interface RobotNoticeApi {
  /** 投一条消息；同一 key 在去重口径内只出现一次 */
  announce(input: RobotNoticeInput, options?: { ready?: boolean }): void
  /** 页面数据是否就绪：false 时消息先压住，true 时放出来（§5.3 第 7 条） */
  setReady(ready: boolean): void
  /** 页面自报忙碌（加载 / 提交在途），与输入框聚焦、弹窗并列进闭嘴规则 */
  setBusy(busy: boolean, reason?: string): void
  /** 直接取中枢：设置面板、页头问号这类复看入口用 */
  center: RobotCenter
}

export function useRobotNotices(): RobotNoticeApi {
  const busyReason = 'page'

  onUnmounted(() => {
    // 离开这一页时撤掉本页的忙碌声明，别把「这一页在提交」带到下一页去
    robotCenter.setBusy(busyReason, false)
  })

  return {
    announce: (input, options) => robotCenter.announce(input, options),
    setReady: ready => robotCenter.setReady(ready),
    setBusy: (busy, reason = busyReason) => robotCenter.setBusy(reason, busy),
    center: robotCenter
  }
}
