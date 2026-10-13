import { describe, it, expect } from 'vitest'

/**
 * 生成任务到终态之后，这一屏不许再停在半路（M-P13 E2E-BUGFIX 第 2、3 处）。
 *
 * 现场读数（`scratch/m-p13-e2e-p11b/`，任务 #11，状态 CONTENT_REJECTED）：
 * - 任务状态格原样念英文码 `CONTENT_REJECTED`，同一行「当前阶段」却已经是中文「内容审核不通过」；
 * - 进度卡停在 80% 并且一直摆着「取消」把手，而任务早就到终态了；
 * - 稿子已经存成草稿（文章 17），「文章状态」格却念「-」；
 * - 四张统计卡是进页面时取的一次（15 篇 / 5 草稿），跑完不回读，库里同一时刻是 16 / 6。
 *
 * 四条是同一个根：前端那份终态名单只认 COMPLETED / FAILED / CANCELLED，
 * 后端实际写过 8 个码（ArticleGenerationService），漏网的 CONTENT_REJECTED 与 TIMEOUT
 * 既不被认成终态（于是轮询与进度卡永远不收），也没有中文标签（于是英文码直接上台面）。
 *
 * 10-13 复跑又钉出对岸那半边：SSE 关流那一处（WorkspaceController）自己列了第三份终态清单，
 * 同样漏了 CONTENT_REJECTED，于是判拒那一趟连 complete 事件都不会发——只修前端名单还不够，
 * 后端已经改成只问一个出处（GenerationTaskStatuses.isTerminal），界面这半则改成不赌事件名。
 *
 * 手法沿用 article-quality-notes-ui.spec.ts：断言钉在源码形状上，改回旧形状当场翻红。
 */

const panel = import.meta.glob('../ArticleGeneratePanel.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const view = String(Object.values(panel)[0] ?? '')

const BACKEND_STATUS_CODES = [
  'PENDING', 'PROCESSING', 'RETRYING', 'COMPLETED',
  'FAILED', 'CANCELLED', 'TIMEOUT', 'CONTENT_REJECTED',
]

describe('E2E-BUGFIX：任务终态词表与到终态后的回读', () => {
  it('扫到了面板文件本身（glob 写错会让这一整份用例静默通过）', () => {
    expect(view).not.toBe('')
  })

  it('后端写过的每一个状态码都有中文标签，不再有英文码原样上台面', () => {
    const meta = view.slice(view.indexOf('const TASK_STATUS_META'), view.indexOf('function taskStatusMeta'))
    for (const code of BACKEND_STATUS_CODES) {
      expect(meta, code).toContain(`${code}: { label: '`)
    }
    // 认不出来的码退成「未识别状态」，而不是把英文码本身念出来
    expect(view).toMatch(/\?\?\s*\{\s*label:\s*'未识别状态'/)
    expect(view).not.toMatch(/\?\?\s*\{\s*label:\s*status/)
  })

  it('终态名单认全 CONTENT_REJECTED 与 TIMEOUT，但 RETRYING 仍算没跑完', () => {
    const line = view.match(/const TERMINAL_STATUSES = \[[^\]]*\]/)?.[0] ?? ''
    expect(line).toContain("'CONTENT_REJECTED'")
    expect(line).toContain("'TIMEOUT'")
    expect(line).not.toContain("'RETRYING'")
  })

  it('到终态就回读统计卡与文章状态：不再挂在 COMPLETED 那一个分支里', () => {
    const complete = view.slice(
      view.indexOf('async function handleTaskComplete'),
      view.indexOf('function pollTaskStatus'),
    )
    const failedBranch = complete.indexOf(`} else if (status === 'FAILED')`)
    expect(failedBranch).toBeGreaterThan(-1)
    expect(complete).toContain('await refreshArticleStatus(task)')
    // 两处回读都在 if/else 链之后：判拒、超时那一趟同样动过文章
    expect(complete.indexOf('await refreshArticleStatus(task)')).toBeGreaterThan(failedBranch)
    expect(complete.indexOf('await loadStats()')).toBeGreaterThan(failedBranch)
    expect(complete.match(/await loadStats\(\)/g)?.length).toBe(1)
  })

  it('进度卡连同「取消」把手只在 generating 期间挂，到终态整块撤下', () => {
    const block = view.indexOf('v-if="generating"')
    const cancel = view.indexOf('cancelGeneration')
    expect(block).toBeGreaterThan(-1)
    expect(cancel).toBeGreaterThan(block)
    // 这一块的收尾是 </div>，取消把手必须在块内、块外不再留第二个取消入口
    expect(view.slice(block, view.indexOf('</div>', cancel))).toContain('取消')
    expect(view.match(/@click="cancelGeneration"/g)?.length).toBe(1)
  })

  it('SSE 那一路自己认终态，不赌对岸发的是 complete 还是 progress', () => {
    // 10-13 现场：判拒那一趟后端只发了 progress（ContentSafetyStep 之后 complete 从未发出，
    // 因为 SSE 关流那处自己列的终态清单漏了 CONTENT_REJECTED）。于是这一屏停在 80% 挂了一辈子。
    // 后端正那一处已修（GenerationTaskStatuses），但界面这一格不再依赖事件名字。
    const sse = view.slice(view.indexOf("source.addEventListener('progress'"),
      view.indexOf("source.addEventListener('complete'"))
    expect(sse).not.toBe('')
    expect(sse).toMatch(/if \(isTerminal\(data\.status\) && !resolved\)/)
    expect(sse).toMatch(/clearSSE\(\)/)
    expect(sse).toMatch(/handleTaskComplete\(taskId, data\)/)
    // 轮询那一路同样要认（两条路共用一个 isTerminal，不许只有一条有）
    const poll = view.slice(view.indexOf('function pollTaskStatus'), view.indexOf('async function trySSE'))
    expect(poll).toMatch(/if \(isTerminal\(res\.status\)\) await handleTaskComplete/)
  })
})
