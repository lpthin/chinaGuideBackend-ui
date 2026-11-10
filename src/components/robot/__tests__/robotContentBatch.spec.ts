import { describe, expect, it } from 'vitest'

/**
 * P4 第一批（内容与文章 · 1a：AI 写稿 + 文章与案例）的静态约定（SPEC-UI-11 R-6）。
 *
 * 与 `robotPilotPages.spec.ts` 同一路数：直接读源文件，钉住两件事——
 * 1) B 类的「选客户」前置条件不许再以常驻 `a-alert` 出现，只能是一行内联小字；
 * 2) A 类迁走的排产口径不许留在页面里，正文只许在 `copy/robot.ts` 写一份。
 */
const sources = import.meta.glob(
  [
    '../../../views/workspace/KeywordLibraryView.vue',
    '../../../views/workspace/ArticlesPanel.vue',
    '../../../views/workspace/ArticleGeneratePanel.vue',
    '../../../views/workspace/ReviewPanel.vue',
    '../../../views/workspace/PublishCenterView.vue',
    '../../../views/workspace/PublishConfigView.vue',
    '../../../views/workspace/DailyOutputView.vue',
    '../../../views/article/ImageLibraryView.vue',
    '../../../views/article/ArticleEditView.vue',
    '../../../views/article/ArticleDetailView.vue',
    '../../../views/case/CaseListView.vue',
    '../../../views/case/CaseDetailDrawer.vue',
    '../../../views/knowledge/KnowledgeCardListView.vue',
    '../../../views/knowledge/KnowledgeCardEditView.vue',
    '../../../views/knowledge/KnowledgeCardDetailView.vue',
    '../../../views/knowledge/KnowledgeCategoryView.vue',
    '../../../views/knowledge/KnowledgeDashboardView.vue',
    '../../../views/knowledge/KnowledgeDocumentView.vue',
    '../../../views/knowledge/KnowledgeGraphView.vue',
    '../../../views/knowledge/KnowledgeSearchView.vue',
    '../../../views/knowledge/KnowledgeTagView.vue',
    '../../../views/portal/AssembleJobView.vue',
    '../../../views/portal/BlockShowcaseView.vue',
    '../../../views/portal/SectionManageView.vue',
    '../../../views/portal/ShowcaseManageView.vue',
    '../../../views/portal/ReferenceSiteView.vue',
    '../../../views/portal/ThemePresetView.vue',
    '../../../views/portal/StoreManageView.vue',
    '../../../views/portal/PortalSiteInfoView.vue',
    '../../../views/portal/RevisionTicketView.vue',
    '../../../views/portal/BriefIntakeForm.vue',
    '../../../views/portal/reference/ReferencePackageTab.vue',
    '../../../views/portal/reference/ReferenceMappingsTab.vue',
    '../../../views/portal/reference/ReferenceUnmatchedTab.vue',
    '@/components/SiteDomainWizard.vue',
    '../../../views/portal/GuestbookManageView.vue',
    '../../../views/workspace/InteractionView.vue',
    '../../../views/operation/CaseManageView.vue',
    '../../../views/operation/DataReportView.vue',
    '../../../views/analytics/PortalCitationView.vue',
    '../../../copy/robot.ts'
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

function source(suffix: string): string {
  const path = Object.keys(sources).find(key => key.endsWith(suffix))
  if (!path) throw new Error(`没找到视图源码：${suffix}`)
  return sources[path]
}

/** 第一批里把「选客户」前置条件改成内联小字的页面 */
const INLINE_PAGES = [
  'workspace/KeywordLibraryView.vue',
  'workspace/ArticlesPanel.vue',
  'workspace/ArticleGeneratePanel.vue',
  'workspace/ReviewPanel.vue',
  'workspace/PublishCenterView.vue',
  'workspace/PublishConfigView.vue',
  'workspace/DailyOutputView.vue',
  'article/ImageLibraryView.vue',
  'article/ArticleEditView.vue',
  'article/ArticleDetailView.vue',
  'case/CaseListView.vue',
  'case/CaseDetailDrawer.vue'
]

/** 1b：知识库里同一个「选客户」形状的页面 */
const KNOWLEDGE_PAGES = [
  'knowledge/KnowledgeCardListView.vue',
  'knowledge/KnowledgeCardEditView.vue',
  'knowledge/KnowledgeCardDetailView.vue',
  'knowledge/KnowledgeCategoryView.vue',
  'knowledge/KnowledgeDashboardView.vue',
  'knowledge/KnowledgeDocumentView.vue',
  'knowledge/KnowledgeGraphView.vue',
  'knowledge/KnowledgeSearchView.vue',
  'knowledge/KnowledgeTagView.vue'
]

/** 这些页还留着 C 类错误条（读失败 / 统计没读回来），`scope-alert` 是它该有的名字 */
const KEEP_ERROR_ALERT = [
  'article/ArticleDetailView.vue',
  'knowledge/KnowledgeCardDetailView.vue',
  'knowledge/KnowledgeCategoryView.vue',
  'knowledge/KnowledgeDashboardView.vue',
  'knowledge/KnowledgeGraphView.vue'
]

describe('第一批 A/B 类提示条已处置', () => {
  for (const file of [...INLINE_PAGES, ...KNOWLEDGE_PAGES]) {
    it(`${file}：选客户说明是内联小字，不再是常驻 a-alert`, () => {
      const text = source(file)

      // ArticleDetailView 用的是页面自己的 BEM 名字，DailyOutputView 沿用 lead-hint，其余统一 scope-hint
      const inlineClass = file.includes('ArticleDetailView')
        ? 'article-detail-page__hint'
        : file.includes('DailyOutputView')
          ? 'lead-hint'
          : 'scope-hint'
      expect(text).toContain(inlineClass)
      // 原说明条一并撤掉，避免以后有人把 a-alert 又贴回来。
      // 留着错误态的页面只钉旧文案，不能连 C 类的 class 一起禁。
      if (file.includes('ArticleDetailView')) {
        expect(text).not.toContain('message="当前没有选定客户，这一屏只读"')
      } else if (!KEEP_ERROR_ALERT.includes(file)) {
        expect(text).not.toContain('class="scope-alert"')
      }
    })
  }

  it('每日自动产出：排产口径已交给机器人，页面里不再留原文', () => {
    const text = source('workspace/DailyOutputView.vue')

    expect(text).toContain('useRobotNotices')
    expect(text).toContain(`ROBOT_PAGE_CARDS['daily-output.pipeline']`)
    expect(text).not.toContain('到点自动从热词库选题、产出草稿；要不要直接发到站上')
  })

  it('排产口径卡只写在 copy/robot.ts 一处', () => {
    const copy = source('copy/robot.ts')

    expect(copy).toContain("'daily-output.pipeline'")
    expect(copy).toContain('到点选题出稿，过质检才发')
  })
})

/** 第二批：口径讲解迁进机器人（页面只登记 key，正文只在 copy/robot.ts） */
const ROBOT_PAGES: Array<{ file: string; key: string; oldText: string }> = [
  { file: 'portal/AssembleJobView.vue', key: 'portal.assemble.intro', oldText: 'AI 整站组装要跑两步模型' },
  { file: 'portal/BlockShowcaseView.vue', key: 'portal.blocks.intro', oldText: '这里是平台侧的组件库' },
  { file: 'portal/SectionManageView.vue', key: 'portal.sections.intro', oldText: '这里只翻栏目的开关' },
  { file: 'portal/ShowcaseManageView.vue', key: 'portal.showcase.intro', oldText: '带「示意」徽标的条目是 AI 生成的占位资料' },
  { file: 'portal/ReferenceSiteView.vue', key: 'portal.reference.intro', oldText: '这里摄取的是别人的站点' },
  { file: 'portal/ThemePresetView.vue', key: 'portal.theme.intro', oldText: '「皮肤」只是一组样式变量' },
  { file: 'portal/StoreManageView.vue', key: 'portal.stores.intro', oldText: '门店是按' },
  { file: 'portal/reference/ReferencePackageTab.vue', key: 'portal.reference.package', oldText: '段级那一半只是证据' },
  { file: 'portal/PortalSiteInfoView.vue', key: 'portal.site-info.seo', oldText: '这里是各页面 SEO 的只读镜像' }
]

/** 第二批：改成一行内联小字的页面（同一页可能既有 A 也有 B） */
const INLINE_PAGES_2 = [
  'portal/BriefIntakeForm.vue',
  'portal/PortalSiteInfoView.vue',
  'portal/ReferenceSiteView.vue',
  'portal/RevisionTicketView.vue',
  'portal/SectionManageView.vue',
  'portal/ThemePresetView.vue',
  'portal/reference/ReferenceMappingsTab.vue',
  'portal/reference/ReferenceUnmatchedTab.vue',
  'components/SiteDomainWizard.vue'
]

describe('第二批「站点与建设」A/B 类提示条已处置', () => {
  for (const { file, key, oldText } of ROBOT_PAGES) {
    it(`${file}：口径已交给机器人，页面里不再留原文`, () => {
      const text = source(file)

      expect(text).toContain('useRobotNotices')
      expect(text).toContain(`ROBOT_PAGE_CARDS['${key}']`)
      expect(text).not.toContain(oldText)
    })
  }

  it('第二批的卡片都写在 copy/robot.ts 一处', () => {
    const copy = source('copy/robot.ts')

    for (const { key } of ROBOT_PAGES) expect(copy).toContain(`'${key}'`)
  })

  for (const file of INLINE_PAGES_2) {
    it(`${file}：前置条件/清单说明是内联小字`, () => {
      const text = source(file)

      expect(text).toContain('scope-hint')
    })
  }
})

/** 第三批：运营与互动的「先选客户」类前置条件 */
const INLINE_PAGES_3 = [
  'portal/GuestbookManageView.vue',
  'workspace/InteractionView.vue',
  'operation/CaseManageView.vue',
  'operation/DataReportView.vue',
  'analytics/PortalCitationView.vue'
]

describe('第三批「运营与互动」B 类提示条已处置', () => {
  for (const file of INLINE_PAGES_3) {
    it(`${file}：前置条件与空区间口径是内联小字`, () => {
      const text = source(file)

      expect(text).toContain('class="scope-hint"')
      expect(text).not.toContain('class="scope-alert" type="info"')
    })
  }

  it('互动页的 AI 补评论披露仍留在首屏（合规那句话不搬走）', () => {
    expect(source('workspace/InteractionView.vue')).toContain('interaction-disclosure')
  })
})
