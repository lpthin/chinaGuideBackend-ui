/**
 * 提交守卫（SPEC-UI-9 H2-1）。
 *
 * 写入伤害高于读失败：同一拍连点两次会造两笔真实数据（内容生成那一次是两篇都花了钱）。
 * 只挂 `:loading` 挡不住——Vue 的更新要等下一个 microtask 才落到 DOM，第二次点击照样进函数。
 * 这里在函数入口同步判定：在途就拒绝第二次调用，`finally` 复位。
 *
 * 约定（配合 `npm run check:submit-guards` 闸门）：
 * 提交按钮的 `:loading` 与 `:disabled` 必须同时挂，且 `:disabled` 要带上同一个在途变量。
 *
 * 它不是幂等键：后端接口幂等或去重仍列为依赖项，前端只保证「同一表单在途只发一次」。
 */
import { ref, type Ref } from 'vue'

export interface SubmitGuard {
  /** 是否有任务在途；模板里绑 `:loading` / `:disabled` 用 */
  readonly pending: Ref<boolean>
  /**
   * 在途时直接返回 `undefined`（第二次调用不执行 task）；
   * task 的异常原样抛给调用方，守卫只负责复位。
   */
  run<T>(task: () => Promise<T> | T): Promise<T | undefined>
}

export function createSubmitGuard(): SubmitGuard {
  const pending = ref(false)
  /** 同步标志：`pending` 的渲染时序不可靠，真正挡连点的是这个变量 */
  let running = false

  async function run<T>(task: () => Promise<T> | T): Promise<T | undefined> {
    if (running) return undefined
    running = true
    pending.value = true
    try {
      return await task()
    } finally {
      running = false
      pending.value = false
    }
  }

  return { pending, run }
}
