import { describe, it, expect } from 'vitest'

/**
 * 生成页那张任务表不再只活在当前会话里（M-P16，#249）。
 *
 * 现场证据（2026-10-14 上午，§10.24 第三条新事实）：任务 18 跑完后导航去「文章管理」再回来，
 * 那一页念「共 0 个任务」——那一行连带判拒那两格读数与「查看文章」把手一起没了。
 * 根因：`generationTasks` 只在内存里 unshift，没有任何服务端回填。
 *
 * 手法照 article-rejected-references-ui.spec.ts：断言落在源码上，改回旧形状会当场翻红。
 */

const files = import.meta.glob(['../ArticleGeneratePanel.vue', '../../../api/workspace.ts'],
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

function pick(keyword: string): string {
  const hit = Object.entries(files).find(([path]) => path.includes(keyword))
  return hit ? String(hit[1]) : ''
}

const panel = pick('ArticleGeneratePanel.vue')
const api = pick('api/workspace.ts')

describe('任务列表口在前端有一个接得住的形状', () => {
  it('扫到了面板与 api 两份文件（glob 写错会让这一整份用例静默通过）', () => {
    expect(panel).not.toBe('')
    expect(api).not.toBe('')
  })

  it('api 层接的是后端那一支列表口，回体形状与单趟状态口同一份类型', () => {
    expect(api).toMatch(/getGenerationTasks:\s*\(query\?:/)
    expect(api).toMatch(/http\.get<GenerationTaskView\[\]>\('\/workspace\/articles\/generate\/tasks'/)
    // 单趟状态口与列表口共用同一个投影类型，键不许各写一份
    expect(api).toMatch(/getGenerationStatus:\s*\(taskId:\s*number\)\s*=>\s*http\.get<GenerationTaskView>/)
    expect(api).toMatch(/export type GenerationTaskView = \{/)
    expect(api).toMatch(/driver\?:\s*string/)
    expect(api).toMatch(/topic\?:\s*string/)
  })

  it('那句「后端无任务列表接口」的旧注释不许回潮', () => {
    expect(panel).not.toMatch(/后端无任务列表接口/)
  })
})

describe('进页面与切租户都回填，会话内那一趟为准', () => {
  it('onMounted 里读一次', () => {
    expect(panel).toMatch(/loadClusterList\(\)\s*[\s\S]{0,200}?loadRecentTasks\(\)/)
  })

  it('切租户先清空再按新家回读（清空与回读都在 watch 里）', () => {
    expect(panel).toMatch(/generationTasks\.value = \[\][\s\S]{0,120}loadRecentTasks\(\)/)
  })

  it('只补本地没有的 id，会话内正在跟踪的那几趟不许被服务端读数盖掉', () => {
    expect(panel).toMatch(/const tracked = new Set\(generationTasks\.value\.map\(t => t\.taskId\)\)/)
    expect(panel).toMatch(/\.filter\(r => !tracked\.has\(r\.taskId\)\)/)
    // 回填的行排在会话行后面：表头那一句念的是「最近 7 天」，新提交的那一趟仍排第一
    expect(panel).toMatch(/generationTasks\.value\.push\(\.\.\.hydrated\)/)
    expect(panel).toMatch(/最近 7 天的任务共 \{\{ generationTasks\.length \}\}/)
  })

  it('生成入口与主题从列表口那两键接住（标题要跑完才有，排队／失败那几行靠 topic）', () => {
    expect(panel).toMatch(/driver: r\.driver \|\| r\.mode \|\| ''/)
    expect(panel).toMatch(/topic: r\.topic \|\| ''/)
  })

  it('回填那一路的失败只落日志，不 toast 刷屏', () => {
    expect(panel).toMatch(/async function refreshArticleStatus\(task: GenerationTask, quiet = false\)/)
    expect(panel).toMatch(/if \(!quiet\) message\.error\('获取文章状态失败'\)/)
    expect(panel).toMatch(/refreshArticleStatus\(t, true\)/)
  })
})

describe('回填里还在跑的那一趟自己往下走，而且不无界轮询', () => {
  it('跑动中的行按趟回读，到终态就停', () => {
    expect(panel).toMatch(/followRunningTasks\(pushed\.filter\(t => !isTerminal\(t\.status\)\)\)/)
    expect(panel).toMatch(/if \(isTerminal\(res\.status\)\) await refreshArticleStatus\(task, true\)/)
    expect(panel).toMatch(/const alive = running\.filter\(t => !isTerminal\(t\.status\)\)/)
    expect(panel).toMatch(/if \(alive\.length === 0\) \{\s*clearFollowUp\(\)/)
  })

  it('有趟数上限，切租户与卸载都清定时器', () => {
    expect(panel).toMatch(/if \(\+\+followUpRounds > FOLLOW_UP_MAX_ROUNDS\) \{[\s\S]{0,60}clearFollowUp\(\)/)
    expect(panel).toMatch(/clearFollowUp\(\)[\s\S]{0,120}generationTasks\.value = \[\]/)
    expect(panel).toMatch(/clearPolling\(\)\s*clearFollowUp\(\)\s*\}\)/)
  })

  it('这一路只更新自己那一行，不碰进度条与取消把手', () => {
    const followUp = panel.slice(panel.indexOf('function followRunningTasks'),
      panel.indexOf('function clearFollowUp'))
    expect(followUp).not.toMatch(/generating\.value =/)
    expect(followUp).not.toMatch(/currentTaskId\.value =/)
    expect(followUp).not.toMatch(/progressText\.value =/)
  })
})

/**
 * 2026-10-14 下午现场抓到的缺陷，只有真浏览器跑回填能撞见：
 * 十几发 `GET /api/workspace/articles/{id}` 全回 200 且带着 `status:"draft"`、`wordCount:1660`，
 * 表格上「文章状态」「字数」两格却一字不填，全摆 '-'。
 *
 * 根因不在网络，在 Vue：`push(...hydrated)` 塞进去的是裸对象，模板读的是数组里那份响应式代理；
 * 我改的是裸对象，界面凭什么知道。修法只有从数组里把行取回来再改。
 */
describe('回填的行要经数组取回代理再改（改裸对象界面不认）', () => {
  const hydration = panel.slice(panel.indexOf('async function loadRecentTasks'),
    panel.indexOf('function followRunningTasks'))

  it('先照旧 push 数组，再从数组里把同一批行取回来', () => {
    expect(hydration).toMatch(/generationTasks\.value\.push\(\.\.\.hydrated\)/)
    expect(hydration).toMatch(/const pushed = hydrated\.map\(h => findTask\(h\.taskId\) \?\? h\)/)
  })

  it('会改行的那两支拿的是取回来的那份，不是裸的 hydrated', () => {
    expect(hydration).toMatch(/Promise\.all\(pushed\.map\(t => refreshArticleStatus\(t, true\)\)\)/)
    expect(hydration).not.toMatch(/hydrated\.map\(t => refreshArticleStatus/)
    expect(hydration).not.toMatch(/hydrated\.filter\(t => !isTerminal/)
  })
})
