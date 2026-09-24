import { describe, it, expect } from 'vitest'
import router from '../../router'
import * as portalData from '../api/portalData'

/**
 * 访客端只许存在一条渲染路径（Spec D3 / 风险 R8「双渲染路径长期化」）。
 *
 * <p>断言全部落在「跑得起来的东西」上：路由真身、模块导出、构建图里的文件清单。
 * 前一组用路由是因为改坏了路由（又给某个路径挂回一个壳组件）这里就会红；
 * 后一组用 glob 是因为那些文件已经删了，没有可运行的对象可断言，但它们一旦回到构建图，
 * glob 就会多出键来。</p>
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

/** 当灰度闸门用的那个壳组件不该再回到构建图里 */
const portalHomeShell = import.meta.glob('../PortalHome.vue')
const legacyTemplates = import.meta.glob('../templates/**/*.vue')

async function mountedRecord(path: string) {
  const resolved = router.resolve(path)
  const record = resolved.matched[resolved.matched.length - 1]
  expect(record, `${path} 应该命中一条路由`).toBeTruthy()
  const loader = record.components?.default as () => Promise<{ default: { __name?: string } }>
  const mounted = await loader()
  return { resolved, record, name: mounted.default.__name }
}

describe('门户访客端只剩页面模型一条路', () => {
  it.each(BUILT_IN_PATHS)('%s 由 PortalDynamicPage 按 slug %s 渲染', async (path, slug) => {
    const { resolved, record, name } = await mountedRecord(path)
    expect(name).toBe('PortalDynamicPage')
    const props = record.props as { default: (route: typeof resolved) => { slug: string } }
    expect(props.default(resolved).slug).toBe(slug)
  })

  it('带旧的 ?template= 参数访问也不会分到第二条路', async () => {
    const { resolved, record, name } = await mountedRecord('/about?template=simple')
    expect(name).toBe('PortalDynamicPage')
    // slug 只由路径换算，查询参数不参与
    const props = record.props as { default: (route: typeof resolved) => { slug: string } }
    expect(props.default(resolved).slug).toBe('about')
  })

  it('三套旧模板与当灰度闸门的那个壳组件都不在构建图里', () => {
    expect(Object.keys(legacyTemplates)).toEqual([])
    expect(Object.keys(portalHomeShell)).toEqual([])
  })

  it('旧模板的取数口已随模板删除，只留站点代码解析', () => {
    expect((portalData as Record<string, unknown>).getPortalData).toBeUndefined()
    expect(typeof portalData.resolveSiteCode).toBe('function')
  })
})
