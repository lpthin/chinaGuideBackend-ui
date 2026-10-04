import { describe, it, expect } from 'vitest'

/**
 * Q-P3 定稿 (a)：租户花钱生成的译稿要在后台看得见、改得动。
 *
 * 背景（报告 §3D 第 5 节）：`targetLocales:['en-US']` 那一篇在 `article_version` 里确实有两行
 * （`zh-CN` 源 + `en-US` 译，两边正文都 >200 字、都带 `ai_model`），但全站没有任何读者入口或后台入口
 * 摆得出英文版——`GET /api/articles/{id}/versions` 读得到，界面上一个字都没有，
 * 而 `api/workspace.ts` 那个 `compareVersions` 至今无人调用。这一格要钉的是「看得见 + 改得动 + 不谎报」：
 *
 * 1. 详情页真的调后端那两条口，键名与路径只有一个说法；
 * 2. 默认只读展示译稿本身，点「改」才变输入框（改的是产物，不是空白格）；
 * 3. 源语言那一档不许再摆一遍冒充译文；
 * 4. 页面必须明说「发布仍按整篇走、公开口只出源语言」——不能让人以为改完英文就上线了。
 *
 * 手法照 site-info.spec.ts：断言落在源码上，改回旧形状会当场翻红。
 */

const viewSource = import.meta.glob('../ArticleDetailView.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const apiSource = import.meta.glob('../../../api/article.ts',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const view = String(Object.values(viewSource)[0] ?? '')
const api = String(Object.values(apiSource)[0] ?? '')

describe('Q-P3a：译稿在文章详情页有一档自己的位置', () => {
  it('扫到了视图与接口文件本身（glob 写错会让这一整份用例静默通过）', () => {
    expect(view).not.toBe('')
    expect(api).not.toBe('')
  })

  it('接的是后端真存在的那两条口：/articles/{id}/versions 与 /articles/{id}/versions/{versionId}', () => {
    expect(api).toMatch(/versions:\s*\(id: number\)\s*=>\s*http\.get<ArticleLocaleVersion\[\]>\(`\/articles\/\$\{id\}\/versions`\)/)
    expect(api).toMatch(/updateVersion:\s*\(id: number, versionId: number, data/)
    expect(api).toMatch(/http\.put<ArticleLocaleVersion>\(`\/articles\/\$\{id\}\/versions\/\$\{versionId\}`/)
  })

  it('详情页加载时就把语言档读回来，保存走那条写口（不是只画个样子）', () => {
    expect(view).toMatch(/articleManageApi\.versions\(/)
    expect(view).toMatch(/loadVersions\(Number\(id\)\)/)
    expect(view).toMatch(/articleManageApi\.updateVersion\(article\.value\.id, version\.id, localeDraft\.value\)/)
  })

  it('默认只读摆出译稿本身，点「改」才变输入框', () => {
    expect(view).toMatch(/v-for="v in localeVersions"/)
    expect(view).toMatch(/<pre class="locale-body">\{\{ v\.contentMd \}\}<\/pre>/)
    expect(view).toMatch(/v-if="editingLocaleId !== v\.id" size="small" @click="startEditLocale\(v\)">改</)
    expect(view).toMatch(/v-model:value="localeDraft\.contentMd"/)
  })

  it('源语言那一档不冒充译文（后端 SaveStep 把它记成 source）', () => {
    expect(view).toMatch(/translationStatus === 'source'/)
    expect(view).toMatch(/v\.id !== sourceVersion\.value\.id/)
  })

  it('明说改这里不等于英文上线：发布按整篇、公开口只出源语言', () => {
    expect(view).toMatch(/发布仍然按整篇走/)
    expect(view).toMatch(/也只出源语言/)
    expect(view).toMatch(/多语言 URL/)
  })

  it('读不到 / 保存不了都讲人话，不静默也不谎报成功', () => {
    expect(view).toMatch(/语言档读取失败：\$\{describeHttpError\(error\)\}/)
    expect(view).toMatch(/保存失败：\$\{describeHttpError\(error\)\}/)
    // 只有接口真回成功才报成功，报的是「这一档已保存」而不是「已发布」
    expect(view).toMatch(/这一档已保存/)
    expect(view).not.toMatch(/message\.success\([^\n]*已发布/)
  })
})
