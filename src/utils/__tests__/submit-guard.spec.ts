import { describe, it, expect, vi } from 'vitest'
import { createSubmitGuard } from '../submitGuard'

/**
 * SPEC-UI-9 H2-1：同一拍连点两次只执行一次；任务抛错后 pending 复位。
 */
describe('createSubmitGuard', () => {
  it('同一拍连点两次只执行一次', async () => {
    const guard = createSubmitGuard()
    let calls = 0
    let release!: () => void
    const task = vi.fn(() => {
      calls += 1
      return new Promise<void>((resolve) => { release = resolve })
    })

    const first = guard.run(task)
    // 第二拍在同一帧到达：不执行 task，直接返回 undefined
    const second = guard.run(task)
    expect(await second).toBeUndefined()
    expect(task).toHaveBeenCalledTimes(1)
    expect(guard.pending.value).toBe(true)

    release()
    await first
    expect(calls).toBe(1)
    expect(guard.pending.value).toBe(false)
  })

  it('任务抛错后 pending 复位，下一次仍可提交', async () => {
    const guard = createSubmitGuard()
    await expect(guard.run(async () => { throw new Error('保存失败') })).rejects.toThrow('保存失败')
    expect(guard.pending.value).toBe(false)

    const result = await guard.run(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('同步任务也能拿到返回值', async () => {
    const guard = createSubmitGuard()
    expect(await guard.run(() => 42)).toBe(42)
    expect(guard.pending.value).toBe(false)
  })

  it('前一发结束后，第二次点击正常执行（守卫不是永久锁）', async () => {
    const guard = createSubmitGuard()
    const task = vi.fn(async () => 'done')
    await guard.run(task)
    await guard.run(task)
    expect(task).toHaveBeenCalledTimes(2)
  })
})
