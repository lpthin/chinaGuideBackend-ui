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
import { ROBOT_SOURCES, type RobotNoticeInput } from '../components/robot/robotRegistry'

/** 任务回执只报结果与去处；失败仍走页内错误块，机器人不搬错误 */
export interface RobotTaskResult {
  key: string
  text: string
  detail?: string
  /** 站内路径；不传就只有「知道了」 */
  to?: string
  actionLabel?: string
}

export interface RobotNoticeApi {
  /** 投一条消息；同一 key 在去重口径内只出现一次 */
  announce(input: RobotNoticeInput, options?: { ready?: boolean }): void
  /**
   * 任务跑完的一句话回执（R-8）：归到「任务结果」这一类，走中枢的频率与静音，
   * 页面不必自己拼 sourceId 与优先级。
   */
  taskResult(result: RobotTaskResult): void
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
    taskResult: result =>
      robotCenter.announce(
        {
          key: result.key,
          category: 'task',
          priority: 'p1',
          text: result.text,
          detail: result.detail,
          actions: result.to
            ? [{ label: result.actionLabel ?? '去看', kind: 'navigate', to: result.to }]
            : undefined,
          // 一次会话里同一件跑完的事只回执一次；刷新页面不重复讲
          once: 'session',
          sourceId: ROBOT_SOURCES.task
        },
        { ready: true }
      ),
    setReady: ready => robotCenter.setReady(ready),
    setBusy: (busy, reason = busyReason) => robotCenter.setBusy(reason, busy),
    center: robotCenter
  }
}
