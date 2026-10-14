import { describe, it, expect } from 'vitest'

/**
 * 判拒那一档的「判了哪一类」与「用了哪几份资料」要在生成页行内念出来（M-P15，#230 同族①）。
 *
 * 背景：改造前状态口只在 `status=COMPLETED` 时合并 result_json，于是安全闸判拒那一发——
 * 库里 task 12/13/16 的 result_json 现读各 4 键——界面一概读不到，编辑只看得到任务上那一句中文；
 * 而引用清单（#232 那串）当时压根没写进判拒那一路。
 *
 * 手法照 article-quality-notes-ui.spec.ts：断言落在源码上，改回旧形状会当场翻红。
 */

const files = import.meta.glob(['../ArticleGeneratePanel.vue', '../../../api/workspace.ts'],
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

function pick(keyword: string): string {
  const hit = Object.entries(files).find(([path]) => path.includes(keyword))
  return hit ? String(hit[1]) : ''
}

const panel = pick('ArticleGeneratePanel.vue')
const api = pick('api/workspace.ts')

describe('判拒那一档的读数在前端有一个接得住的形状', () => {
  it('扫到了面板与 api 两份文件（glob 写错会让这一整份用例静默通过）', () => {
    expect(panel).not.toBe('')
    expect(api).not.toBe('')
  })

  it('状态口类型把两键接住，键名与后端 resultJson 那两个字面量逐字相同', () => {
    expect(api).toMatch(/safetyCategories\?:\s*string\[\]/)
    expect(api).toMatch(/knowledgeReferences\?:\s*ArticleKnowledgeSource\[\]/)
  })

  it('面板的任务类型、增量清单与 applyTaskUpdate 三处都带着这两键', () => {
    expect(panel).toMatch(/safetyCategories\?:\s*string\[\]/)
    expect(panel).toMatch(/knowledgeReferences\?:\s*ArticleKnowledgeSource\[\]/)
    expect(panel).toMatch(/'safetyCategories'\s*\|\s*'knowledgeReferences'/)
    expect(panel).toMatch(/if \(patch\.safetyCategories !== undefined\) task\.safetyCategories = patch\.safetyCategories/)
    expect(panel).toMatch(/if \(patch\.knowledgeReferences !== undefined\) task\.knowledgeReferences = patch\.knowledgeReferences/)
  })

  it('两键印在任务行上，而不是只留在库里或后端日志里', () => {
    expect(panel).toMatch(/record\.safetyCategories\.join\('、'\)/)
    expect(panel).toMatch(/用了 \{\{ record\.knowledgeReferences\.length \}\} 份资料/)
    expect(panel).toMatch(/第\$\{r\.quoteIndex\}份/)
  })

  it('SSE 那一路只带进度，判拒到终态要补一次状态口回读', () => {
    expect(panel).toMatch(/status === 'CONTENT_REJECTED' && !res\.knowledgeReferences/)
    expect(panel).toMatch(/applyTaskUpdate\(taskId, await articleApi\.getGenerationStatus\(taskId\)\)/)
  })
})
