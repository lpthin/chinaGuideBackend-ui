import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 提示条硬门自身的回归（SPEC-UI-11 R-9）。
 *
 * 门能咬人还不够，门本身也得有人看着：把 `STRICT_FROM` 往后一改，闸门会悄悄退回「只警告」，
 * 违规照样进主干；只写脚本不接流水线，等于没有门。这两条钉的就是这两个退化口子。
 */
const repoRoot = process.cwd()

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), 'utf8')
}

describe('提示条硬门', () => {
  it('观察期已经结束：STRICT_FROM 不晚于今天，新违规当场失败', () => {
    const source = read('scripts/check-notices.mjs')
    const found = source.match(/const STRICT_FROM = '(\d{4}-\d{2}-\d{2})'/)
    expect(found, 'STRICT_FROM 常量不见了——硬门失去判据').toBeTruthy()

    const today = new Date().toISOString().slice(0, 10)
    expect(
      found![1] <= today,
      `STRICT_FROM=${found![1]} 还是未来日期，闸门会退回只警告`
    ).toBe(true)
  })

  it('CI 回归里真的跑了这一步：只写脚本不接流水线等于没门', () => {
    const workflow = read('.github/workflows/regression.yml')
    expect(workflow).toContain('npm run check:notices')
  })
})
