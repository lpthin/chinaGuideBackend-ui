import { describe, it, expect } from 'vitest'

/**
 * 「未归类」这一档在界面上有路走（M-P15，2026-10-13 走查缺口 (x)）。
 *
 * <p>现场：租户 180 的 doc 8 落库时 `category_id=NULL`。项目列表按 categoryId 滤、
 * 项目详情也按 categoryId 滤，这一行在任何一处都读不到——没有列表就没有
 * 「重新向量化」和「挪进项目」两根把手，它只能停在库里的 `FAILED 2/0`。
 * 这不是数据问题（行本来就在库里），是界面上没有出口。</p>
 *
 * <p>这里钉的是形状：项目网格上那张卡、点进去之后发给后端的那一个参数、
 * 以及「两头都传时不许退回按项目滤」。后端那一侧的谓词由
 * `KnowledgeDocumentUnclassifiedFilterTest` 钉。</p>
 *
 * 手法照 article-quality-notes-ui.spec.ts：断言落在源码上，改回旧形状会当场翻红。
 */

const viewModules = import.meta.glob('../KnowledgeDocumentView.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const view = String(Object.values(viewModules)[0] ?? '')

const queryTypes = import.meta.glob('../../../types/knowledge.ts',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const types = String(Object.values(queryTypes)[0] ?? '')

describe('M-P15：没归到任何项目的资料在界面上有出口', () => {
  it('扫到了页面本身（glob 写错会让这一整份用例静默通过）', () => {
    expect(view).not.toBe('')
    expect(types).not.toBe('')
  })

  it('查询参数类型里有 unclassified，注释说清它是干什么的', () => {
    expect(types).toMatch(/interface KnowledgeDocumentQuery[\s\S]{0,400}unclassified\?: boolean/)
  })

  it('项目网格上摆一张「未归类」的卡，点它进那一档', () => {
    expect(view).toMatch(/@click="enterUnclassified"/)
    expect(view).toMatch(/<a-card-meta title="未归类">/)
  })

  /** 空卡不摆：读数为 0 就撤下，读不到数（null）照摆——别把唯一的出口藏起来 */
  it('卡只在读得到数或读不到数时摆，真读了且没有才撤', () => {
    expect(view).toMatch(/v-if="unclassifiedCount !== 0"/)
  })

  it('进这一档时把 currentCategoryId 清空，不留在项目语境里', () => {
    const enter = view.slice(view.indexOf('function enterUnclassified()'),
      view.indexOf('function backToCategories()'))
    expect(enter).toMatch(/currentCategoryId\.value = null[\s\S]*unclassifiedMode\.value = true[\s\S]*loadDocuments\(\)/)
  })

  /** 这一条是缺口本体的反面：列表以前永远带 categoryId，NULL 的行永远滤不到 */
  it('这一档发的是 unclassified=true，并且不带 categoryId', () => {
    const loader = view.slice(view.indexOf('async function loadDocuments()'),
      view.indexOf('function enterCategory'))
    expect(loader).toMatch(/if \(unclassifiedMode\.value\) \{\s*params\.unclassified = true\s*\} else \{\s*params\.categoryId = currentCategoryId\.value\s*\}/)
    // 守卫也得同时认这一档，否则点进去直接 return，界面就是一片空白
    expect(loader).toMatch(/if \(!currentCategoryId\.value && !unclassifiedMode\.value\) return/)
  })

  it('返回项目列表和换租户时退出这一档', () => {
    const back = view.slice(view.indexOf('function backToCategories()'),
      view.indexOf('async function createCategory'))
    expect(back).toMatch(/unclassifiedMode\.value = false/)
    const watchTenant = view.slice(view.indexOf('watch(\n  () => auth.selectedTenantId'))
    expect(watchTenant).toMatch(/unclassifiedMode\.value = false/)
  })

  /** 新行必须有项目可落：这一档的上传点了也是没反应，摆着就是根假把手 */
  it('这一档不摆「批量上传」', () => {
    const upload = view.slice(view.indexOf('<a-upload'), view.indexOf('</a-upload>'))
    expect(upload).toMatch(/v-if="!unclassifiedMode"/)
  })

  /** 「设置项目」就是这一档的归宿把手，标题不许还念项目名（那时 currentCategoryId 是 null） */
  it('详情区标题在这一档念「未归类」，不是「-」', () => {
    expect(view).toMatch(/\{\{ unclassifiedMode \? '未归类' : getCategoryName\(currentCategoryId\) \}\}/)
  })
})
