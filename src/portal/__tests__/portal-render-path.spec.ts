import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import router from '../../router'

/**
 * 访客端只许存在一条渲染路径（Spec D3 / 风险 R8「双渲染路径长期化」）。
 *
 * <p>前六条断言用的是路由真身而不是源码文本：改坏了路由（比如又给某个路径挂回一个壳组件）就会红。
 * 后面两条只能扫源码——文件已经被删掉，没有可运行的对象可断言。</p>
 */
const BUILT_IN_PATHS: Array<[string, string]> = [
  ['/', 'home'],
  ['/about', 'about'],
  ['/services', 'services'],
  ['/cases', 'cases'],
  ['/news', 'news'],
  ['/contact', 'contact'],
  ['/p/renovation-case', 'renovation-case']
]

describe('门户访客端只剩页面模型一条路', () => {
  it.each(BUILT_IN_PATHS)('%s 由 PortalDynamicPage 按 slug %s 渲染', async (path, slug) => {
    const resolved = router.resolve(path)
    const record = resolved.matched[resolved.matched.length - 1]
    expect(record).toBeTruthy()
    const loader = (record.components?.default ?? record.component) as () => Promise<{ default: { __name?: string } }>
    expect((await loader()).default.__name).toBe('PortalDynamicPage')
    const props = record.props as { default: (route: typeof resolved) => { slug: string } }
    expect(props.default(resolved).slug).toBe(slug)
  })

  it('旧的 ?template= 回退分支与 render_key 消费都不在了', () => {
    const offenders = ['src/router/index.ts', 'src/portal/PortalDynamicPage.vue', 'src/portal/api/portalPublic.ts']
      .map(file => [file, read(file)] as const)
      .filter(([, source]) => /\?template=|applyRenderKey/.test(source))
      .map(([file]) => file)
    expect(offenders).toEqual([])
    // 带旧参数访问也不再改变渲染：它落到同一条路上
    expect(router.resolve('/about?template=simple').matched.length).toBeGreaterThan(0)
  })

  it('三套旧模板文件与只服务它们的取数口都不在了', () => {
    for (const name of ['TechTemplate', 'ServiceTemplate', 'SimpleTemplate']) {
      expect(existsSync(portalFile(`templates/${name}.vue`)), `${name}.vue 应该已删除`).toBe(false)
    }
    const portalData = read('src/portal/api/portalData.ts')
    // 断言的是代码而不是文本：文件里那段「这里原本还有 getPortalData」的注释要留着说清历史
    expect(portalData).not.toMatch(/export (async )?function getPortalData/)
    expect(portalData).not.toMatch(/from 'axios'/)
    expect(portalData).toMatch(/export function resolveSiteCode/)
    expect(existsSync(rootFile('src/portal/PortalHome.vue')), 'PortalHome 这个壳组件应该已删除').toBe(false)
  })
})

function read(relativePath: string): string {
  return readFileSync(rootFile(relativePath), 'utf8')
}

function rootFile(relativePath: string): string {
  return resolve(process.cwd(), relativePath)
}

function portalFile(relativePath: string): string {
  return rootFile(join('src', 'portal', relativePath))
}
