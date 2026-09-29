import { describe, it, expect } from 'vitest'

/**
 * 假指标不许在界面上回潮（Spec §13.4 的 I-8、决议 N10 的「止血」那一半）。
 *
 * 为什么扫源码而不是挂组件测：这里要断言的性质是「这一屏再也不会凭空显示一个数」，
 * 而那个数原本就是后端 new Random(42) 造出来的——后端已经停写（见仓库里的
 * FakeKeywordMetricsGuardTest），但界面只要还留着 `record.searchVolume` 这种读法，
 * 将来谁把列接回别的接口就又是一条假数据通道。判据落在源码上更难绕过，也更便宜。
 *
 * 只扫这三份文件：它们正是当年那三个数的落脚点。
 * 两张排名表的旧页（GeoSeoCompetitorView / GeoSeoKeywordView）已随 Spec-F Q6/Q7-A 整体删除，
 * 那部分断言改成在路由表与 geoseo 视图目录上对账（见下面两条）。
 */

const scanned = import.meta.glob(
  ['../KeywordLibraryView.vue', '../ArticleGeneratePanel.vue', '../WorkspaceView.vue'],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const raw = Object.values(scanned).join('\n')

/** 接口那一层也扫：响应已经不带这三个字段了，类型里留着就是留着一个谎（V100 把列删了） */
const apiSources = import.meta.glob(['../../../api/workspace.ts', '../../../api/index.ts'],
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

/** 路由表与 geoseo 视图目录：Q6/Q7-A 删掉那两页之后，证据改在这儿对账 */
const routerSources = import.meta.glob(['../../../router/index.ts'],
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const routerSource = Object.values(routerSources).join('\n')
const geoseoViews = Object.keys(import.meta.glob('../../../views/geoseo/*.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)

function textOf(path: string): string {
  const found = Object.entries(scanned).find(([key]) => key.endsWith(path))
  return found ? String(found[1]) : ''
}

describe('I-8：搜索量/竞争度/意图价值在界面上没有任何读法', () => {
  it('扫到了文件本身（路径写错会让这条用例静默通过）', () => {
    expect(Object.keys(scanned).length).toBe(3)
  })

  it('关键词列表不再读这三个字段，也不留下能读回来的形状', () => {
    const view = textOf('KeywordLibraryView.vue')
    expect(view).not.toMatch(/\bsearchVolume\b|\bcompetition\b|\bintentValue\b/)
    // 「暂无真实数据源」是这三列现在的唯一内容——列留着是为了让人知道该有什么、为什么没有
    expect((view.match(/暂无真实数据源/g) || []).length).toBe(3)
  })

  it('排序项里也没有这两个（全 0 的字段排不出任何顺序，却会让人以为排过）', () => {
    expect(textOf('KeywordLibraryView.vue')).not.toMatch(/按搜索量|按意图价值/)
  })

  it('接口类型里也不声明这三个字段', () => {
    // 落到两份 api 文件上：/workspace/keywords 与 /keywords 两条读口的响应形状都不该再长出假指标
    expect(Object.keys(apiSources).length).toBe(2)
    expect(Object.values(apiSources).join('\n'))
      .not.toMatch(/\bsearchVolume\b|\bcompetition\b|\bintentValue\b/)
  })

  it('选词那条链路也不再按这两个字段排序', () => {
    // 文章生成面板从前把「高意图值」摆在第一位，而这一列从来没有真数据源
    expect(textOf('ArticleGeneratePanel.vue')).not.toMatch(/\bsearchVolume\b|\bintentValue\b/)
  })

  it('竞品页不再承诺系统会去抓排名，而且这一页整个绝迹（Q6-A）', () => {
    // 以前这条只断言「那句话没出现」，页面还留着；现在连页面带路由一起删了，
    // 断言从「不承诺」升级成「没有可以承诺的地方」。
    expect(geoseoViews.some(path => path.endsWith('GeoSeoCompetitorView.vue'))).toBe(false)
    expect(raw + routerSource).not.toMatch(/系统会追踪|可以查看您和竞品的排名对比/)
  })

  it('关键词排名页同样绝迹，接口也不留可调用的形状（Q7-A）', () => {
    expect(geoseoViews.some(path => path.endsWith('GeoSeoKeywordView.vue'))).toBe(false)
    expect(routerSource).not.toMatch(/name: 'workspace-geoseo-keywords'/)
    expect(routerSource).not.toMatch(/name: 'workspace-geoseo-competitors'/)
    // 后端 `/api/geoseo/keywords/{id}/check` 现在是 501 NOT_IMPLEMENTED：前端不该再有一条能打过去的路
    expect(routerSource).not.toMatch(/path: 'geoseo\/(keywords|competitors)'/)
    expect([...geoseoViews].map(path => path.split('/').pop()).sort()).toEqual(['GeoSeoDashboardView.vue'])
  })

  it('两张排名表从菜单里摘了（N10：这一期不做引用/排名监控）', () => {
    const menu = textOf('WorkspaceView.vue')
    expect(menu).not.toMatch(/key="geoseo\/competitors"/)
    expect(menu).not.toMatch(/key="geoseo\/keywords"/)
  })

  it('那两页当年如实写着自己是人工抄录，这句实话现在写在路由与菜单的注释里', () => {
    // 页面删了不等于理由删了：下一个碰 geoseo 的人要能在原址读到「为什么这儿曾经有过两页假数」。
    expect(routerSource).toMatch(/人工抄录/)
  })
})
