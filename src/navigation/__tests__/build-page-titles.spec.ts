import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { routes } from '../../router'
import { collectMenuLeaves } from '../workspaceMenu'

/**
 * 建站那一组的页标题（Spec-M UIB-3）。
 *
 * 现场病是这两种：菜单写着「参考站摄取」、点进去页面一行标题都没有（人不知道自己站在哪一步）；
 * 卡片自己写着「平台提示词」、菜单却叫「建站提示词」（同一条链路两个名字）。
 * 这一条用例从**菜单组表 + 路由表**反推，不写死清单：
 * 往 build 组里加一项，这里立刻红，逼着新页面回答「你的标题从哪来」。
 *
 * 合格的形状只有两种：页面渲 `<PageTitle />`（文字就是 meta.title 那一份），
 * 或者页面确实有一行 `<h3>meta.title</h3>` 写着**一模一样**的三个字。
 * 后者是存量页的手抄那份，改名时它挡不住漂移，但不算今天的缺陷；
 * 新页一律走前一种。
 */

const buildLeaves = collectMenuLeaves(routes).filter(leaf => leaf.group === 'build')

/** 路由名 → 视图文件：从 router/index.ts 的懒加载声明里取，测试不另抄一遍路径 */
const ROUTER_DIR = join(process.cwd(), 'src/router')
const routerSource = readFileSync(join(ROUTER_DIR, 'index.ts'), 'utf8')

function componentFileOf(routeName: string): string {
  const nameAt = routerSource.indexOf(`name: '${routeName}'`)
  expect(nameAt, `路由表里没有 ${routeName}`).toBeGreaterThan(-1)
  const chunk = routerSource.slice(nameAt, nameAt + 400)
  const varMatch = /component:\s*([A-Za-z0-9_]+)/.exec(chunk)
  expect(varMatch, `${routeName} 这一条没在 name 后面紧跟着 component`).toBeTruthy()
  const lazyMatch = new RegExp(`const ${varMatch![1]}\\s*=\\s*\\(\\)\\s*=>\\s*import\\('([^']+)'\\)`).exec(routerSource)
  expect(lazyMatch, `路由表里找不到 ${varMatch![1]} 的懒加载声明`).toBeTruthy()
  return join(ROUTER_DIR, lazyMatch![1])
}

describe('建站组的每一页都有一行标题，且标题就是菜单上那几个字', () => {
  it('组表里 build 那六项都真的对着一个视图文件（加页面就得进这一条用例）', () => {
    expect(buildLeaves.map(leaf => leaf.routeName).sort()).toEqual([
      'workspace-portal-blocks',
      'workspace-portal-presets',
      'workspace-portal-prompts',
      'workspace-portal-reference-sites',
      'workspace-portal-skeletons',
      'workspace-portal-wizard'
    ])
  })

  it('每一页要么用 <PageTitle />，要么有一行与 meta.title 逐字相同的标题', () => {
    const offenders = buildLeaves.filter(leaf => {
      const source = readFileSync(componentFileOf(leaf.routeName), 'utf8')
      const viaComponent = source.includes('<PageTitle')
      const literalHeading = new RegExp(`<h3[^>]*>\\s*${leaf.label}\\s*</h3>`).test(source) ||
        new RegExp(`#title>\\s*${leaf.label}\\s*</template>`).test(source)
      return !viaComponent && !literalHeading
    })
    expect(offenders.map(leaf => `${leaf.label}（${leaf.routeName}）`)).toEqual([])
  })

  it('标题走 <PageTitle /> 的那几页不许再把菜单名抄一遍（抄一份就是下一次改名漏改的那一处）', () => {
    const doubleTyped = buildLeaves.filter(leaf => {
      const source = readFileSync(componentFileOf(leaf.routeName), 'utf8')
      if (!source.includes('<PageTitle')) return false
      return new RegExp(`<h3[^>]*>\\s*${leaf.label}\\s*</h3>`).test(source) ||
        new RegExp(`#title>\\s*${leaf.label}\\s*</template>`).test(source)
    })
    expect(doubleTyped.map(leaf => `${leaf.label}（${leaf.routeName}）`)).toEqual([])
  })
})
