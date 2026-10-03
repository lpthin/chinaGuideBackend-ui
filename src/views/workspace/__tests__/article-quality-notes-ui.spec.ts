import { describe, it, expect } from 'vitest'

/**
 * 质检降级放行必须在界面上看得见（Spec-K §3E 第 2 节缺陷 C，Q-P4d 拍板 a）。
 *
 * 背景：一篇稿子在生成与翻译都已经花过钱之后，只因为模型那一发少吐了 `geoCitationSummary`
 * 就整篇作废（task 63 实测 `FAILED` / `progress=70` / `article_id=NULL`）。现在改成降级：
 * 稿子照常存为草稿，缺口作为 `qualityNotes` 随任务状态回吐。
 *
 * 这一格要钉的是「降级不等于瞒着」：
 * 1. 前端确实把后端那个键接住了，而不是在类型里另起一个名字（两仓之间只有一个字符串能对上）；
 * 2. 有缺口时不许再报一句光秃秃的「文章生成成功」——那是把「缺了一项」谎报成「全好」；
 * 3. 缺口要印在任务行上，让人不去翻后端日志也知道去哪儿补。
 *
 * 手法照 fake-keyword-metrics-ui.spec.ts：断言落在源码上，改回旧形状会当场翻红。
 */

const panel = import.meta.glob('../ArticleGeneratePanel.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const view = String(Object.values(panel)[0] ?? '')

describe('Q-P4d：降级放行的缺口在前端有一个接得住的形状', () => {
  it('扫到了面板文件本身（glob 写错会让这一整份用例静默通过）', () => {
    expect(view).not.toBe('')
  })

  it('任务类型与增量更新都带 qualityNotes，键名与后端 resultJson 那个字面量逐字相同', () => {
    expect(view).toMatch(/qualityNotes\?:\s*string\[\]/)
    expect(view).toMatch(/'errorMessage'\s*\|\s*'qualityNotes'/)
    expect(view).toMatch(/if \(patch\.qualityNotes !== undefined\) task\.qualityNotes = patch\.qualityNotes/)
  })

  it('缺口印在任务行上，而不是只出现在后端日志里', () => {
    expect(view).toMatch(/v-for="\(note, noteIndex\) in record\.qualityNotes \|\| \[\]"/)
    expect(view).toMatch(/class="task-note"/)
    expect(view).toMatch(/\.task-note\s*\{[\s\S]*color:\s*#d48806/)
  })

  it('有缺口时那句回话是警示而不是「生成成功」；没有缺口时仍然照原样报成功', () => {
    const complete = view.slice(view.indexOf('async function handleTaskComplete'))
    expect(complete).toMatch(/if \(notes\.length > 0\) \{[\s\S]*message\.warning\(/)
    expect(complete).toMatch(/} else \{\s*message\.success\('文章生成成功'\)/)
    // 谎报的旧形状：无条件先报成功，再去看有没有缺口
    expect(complete).not.toMatch(/message\.success\('文章生成成功'\)\s*\n\s*const task = findTask/)
  })
})
