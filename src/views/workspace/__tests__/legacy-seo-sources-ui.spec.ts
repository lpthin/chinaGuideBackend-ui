import { describe, it, expect } from 'vitest'
import { MENU_EXCLUDED, MENU_GROUP_BY_ROUTE } from '../../../navigation/workspaceMenu'

/**
 * 旧的两处「全站级 SEO 配置面」在管理端必须彻底没有读法（Spec §13.5 的 ③，I-6 / I-8）。
 *
 * 为什么扫源码而不是测组件：要断言的性质是「这个后台再没有第二个地方能改 SEO」，
 * 而后端已经把这四张来源删到只剩 portal_page.seo_* 与 article_version.seo_*
 * （见 SeoWritePathGuardTest 的「三处旧SEO真相源零命中」）。界面只要还留着一份 api 声明、
 * 一条路由或一个 `default_seo_*` 输入框，下一个接手的人就会以为写进去有用——那正是这次要消灭的
 * glob 的排除项要写成 './x' 那种形式，vite 才认；这里干脆在 JS 里剔掉所有 __tests__，
 * 免得别份用例的字符串（它们正是「断言某个词不存在」，非要有引子）把自己扫进去。
 * 多一层 ../ 才扫得到 src/api、src/router、src/types——旧的 api 声明与路由就住在那儿。
 */
const scanned = import.meta.glob(
  ['../../../**/*.{vue,ts}'],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const files = Object.entries(scanned).filter(([path]) => !path.includes('/__tests__/'))
const raw = files.map(([, source]) => source).join('\n')

function hitsOf(pattern: RegExp): string[] {
  return files.filter(([, source]) => pattern.test(source)).map(([path]) => path)
}

/** 路由表源码里有没有这一条具名路由——P5 合并后用来钉「旧的两条 SEO 页面路由确实绝迹」 */
const routerSource = String(files.find(([path]) => path.endsWith('router/index.ts'))?.[1] ?? '')
function routerHasRouteNamed(name: string): boolean {
  return routerSource.includes(`name: '${name}'`)
}

describe('I-6：界面上没有任何一处还在读那三处旧 SEO 来源', () => {
  it('扫到了源码本身（glob 写错会让这条用例静默通过）', () => {
    expect(files.length).toBeGreaterThan(150)
    // 光看数量不够：真要扫到 api 层与路由层，这几份文件得在名单里（键是相对本文件的路径，只验结尾）
    for (const probe of ['api/portal.ts', 'api/geoseo.ts', 'router/index.ts', 'types/geoseo.ts']) {
      expect(files.some(([path]) => path.endsWith(probe)), `没扫到 ${probe}`).toBe(true)
    }
  })

  /** 拿旧写法本身验一遍正则：写歪了的「零命中」断言会和真删干净长得一模一样 */
  it('扫描器认得出旧的写法', () => {
    const legacy = "import { seoConfigApi, geoPageApi } from '@/api/portal'\n"
      + "router.push('/portal/seo')\n"
      + "export interface SeoConfigForm { defaultOgImage: string }\n"
      + "const view = () => import('../views/geoseo/GeoSeoPageView.vue')"
    expect(/portal\/seo|geoseo\/pages/.test(legacy)).toBe(true)
    expect(/\bseoConfigApi\b|\bgeoPageApi\b|\bSeoConfigView|\bGeoSeoPageView|\bGeoSeoPage\b|\bSeoConfigForm\b/.test(legacy)).toBe(true)
    expect(/default(?:Seo|Og|Twitter|Schema)\w*|default_(?:seo|og|twitter|schema)\w*/.test(legacy)).toBe(true)
    // 反向：GEO 站点配置里留下的那几项，不能被「全站默认」那条误伤
    expect(/default(?:Seo|Og|Twitter|Schema)\w*|default_(?:seo|og|twitter|schema)\w*/.test('robotsTxt: "", llmsSummary: ""')).toBe(false)
    // 反向：GeoSeoConfigView 这个名字本身不算 SeoConfigView
    expect(/\bSeoConfigView/.test('GeoSeoConfigView.vue')).toBe(false)
  })

  it('两个旧 CRUD 端点在前端一次都不出现', () => {
    expect(hitsOf(/portal\/seo|geoseo\/pages/)).toEqual([])
  })

  it('旧的 api / 视图 / 类型形状都删干净了', () => {
    // \b 是必要的：GeoSeoConfigView 里含着 "SeoConfigView" 这四个词，不锚定就把自己人判成鬼
    expect(hitsOf(/\bseoConfigApi\b|\bgeoPageApi\b|\bSeoConfigView|\bGeoSeoPageView|\bGeoSeoPage\b|\bSeoConfigForm\b/)).toEqual([])
  })

  it('「全站默认」那几个开关不再是表单字段（一份默认文案盖住所有页面）', () => {
    expect(hitsOf(/default(?:Seo|Og|Twitter|Schema)\w*|default_(?:seo|og|twitter|schema)\w*/)).toEqual([])
  })

  it('逐页 SEO 的唯一入口还在：路由有 portal/pages「页面搭建」，菜单表认它这一条', () => {
    const routerSource = String(files.find(([path]) => path.endsWith('router/index.ts'))?.[1] ?? '')
    // 侧边菜单改成从路由单源生成（Spec-C §3.2 P0）后，「菜单里有没有」问的是分组表与排除表，
    // 不再是 WorkspaceView 里手写的 key——所以这里查真模块的导出，而不是查模板字符串。
    expect(MENU_GROUP_BY_ROUTE['workspace-portal-pages']).toBeTruthy()
    expect(MENU_EXCLUDED['workspace-portal-pages']).toBeUndefined()
    expect(routerSource).toMatch(/name: 'workspace-portal-pages'[\s\S]{0,200}title: '页面搭建'/)
  })

  it('站点级 SEO/GEO 那几项只有一处入口，且留下的确实是库里真有对应列的项', () => {
    // P5 合并后：GeoSeoConfigView/GeoSeoCompanyView 已删路由与视图，读写只剩 /api/portal/site-info 一处。
    // 「留下的确实是库里真有对应列」这条行为没变——变的是它现在由 site-info 适配层兑现，不是那个已删除的旧视图。
    const siteInfoApi = String(files.find(([path]) => path.endsWith('api/portalSiteInfo.ts'))?.[1] ?? '')
    expect(siteInfoApi, '网站信息适配层没扫到（P5 合并的读口跑丢了）').not.toBe('')
    for (const column of ['robots', 'llms_summary', 'geo_citation_summary', 'llms_txt_template']) {
      expect(siteInfoApi, `site-info 少了库里真有的那一列 ${column}`).toContain(column)
    }
    // 旧的整实体写口与那两页视图彻底绝迹：菜单/路由里再没有第二个「站点配置 / geoseo 企业信息」
    expect(files.some(([path]) => path.endsWith('GeoSeoConfigView.vue')), 'GeoSeoConfigView 视图应已随合并删除').toBe(false)
    expect(files.some(([path]) => path.endsWith('GeoSeoCompanyView.vue')), 'GeoSeoCompanyView 视图应已随合并删除').toBe(false)
    expect(routerHasRouteNamed('workspace-geoseo-config')).toBe(false)
    expect(routerHasRouteNamed('workspace-geoseo-company')).toBe(false)
    expect(routerHasRouteNamed('workspace-portal-site-info')).toBe(true)
    // 「全站默认」那一屏仍然是假的，一句都不许复现
    expect(raw).not.toMatch(/默认Meta标签/)
  })
})
