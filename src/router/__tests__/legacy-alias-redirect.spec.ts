import { describe, it, expect } from 'vitest'
import { routes } from '../index'

/**
 * 六个老地址的 redirect 目标必须写成绝对路径（全站普查 pass A2 抓到的）。
 *
 * 这六条是 Spec-H 归组时留下的收藏夹兼容层，当时的注释写着「收藏夹与文档链接不断」，
 * 现场量出来是断的：`redirect: { path: 'alert/center' }` 这种不带前导斜杠的 path
 * 被解析成根级 `/alert/center`，那条路径上没有路由，兜底的 `/:pathMatch(.*)*`
 * 把它接住画成「页面未找到」（实测整页只有 41 个字符，容器页一个字都没进来）。
 * 目标路径写全 `/workspace/…` 才会落到本该落的那一页，`?tab=` 也由页内读取。
 */

const CHILDREN = routes.find(r => r.path === '/workspace')!.children ?? []

const ALIASES: Array<[string, string, string]> = [
  ['alert/rules', '/workspace/alert/center', 'rules'],
  ['alert/records', '/workspace/alert/center', 'records'],
  ['alert/channels', '/workspace/alert/center', 'channels'],
  ['geo/brand', '/workspace/geo/diagnostic', 'brand'],
  ['geo/diagnosis', '/workspace/geo/diagnostic', 'wizard'],
  ['geo/campaign', '/workspace/geo/diagnostic', 'campaign'],
]

function targetPaths(): string[] {
  const out: string[] = []
  for (const child of CHILDREN) {
    const redirect = (child as { redirect?: unknown }).redirect
    if (redirect && typeof redirect === 'object' && 'path' in redirect) {
      out.push(String((redirect as { path: string }).path))
    }
  }
  return out
}

describe('老地址 redirect 的形状', () => {
  it('六条都在，且目标全是 /workspace 打头的绝对路径', () => {
    const paths = targetPaths()
    for (const [alias, target] of ALIASES) {
      const record = CHILDREN.find(c => c.path === alias)
      expect(record, `老地址 ${alias} 不许被删掉`).toBeTruthy()
      const redirect = (record as { redirect?: { path?: string } }).redirect
      expect(redirect?.path, `${alias} 的目标得写全路径`).toBe(target)
    }
    for (const p of paths) {
      expect(p, `redirect 目标 ${p} 必须是绝对路径`).toMatch(/^\/workspace\//)
    }
  })

  it('目标那一页真的存在，且带着要落的那个 tab', () => {
    const realPaths = CHILDREN.map(c => c.path)
    for (const [alias, target, tab] of ALIASES) {
      expect(realPaths, `${target} 是 ${alias} 的目标，它得有路由`).toContain(target.replace('/workspace/', ''))
      const redirect = (CHILDREN.find(c => c.path === alias) as { redirect: { query?: Record<string, string> } }).redirect
      expect(redirect.query?.tab, `${alias} 得落到 ${tab} 这一格`).toBe(tab)
    }
  })
})
