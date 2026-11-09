// SPEC-UI-6 静态防线：读失败状态的两条硬规则，靠人记会漂，这里钉死。
// 1. 绑了 :error 的表必须给 :retry（除非失败原因不是「再读一次就能好」）。
// 2. 绑了 :error 的表不能又被只认「有数据」的 v-if 挡在门外，否则错误态永远看不见。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')
const TABLE_TAG = /<[Dd]ata-[Tt]able[\s\S]*?>/g

/** 失败原因不是网络读取、重试无意义的表（本地 JSON 解析） */
const RETRY_EXEMPT = new Set(['src/views/portal/builder/DraftReviewCard.vue'])

function vueFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return vueFiles(full)
    return full.endsWith('.vue') ? [full] : []
  })
}

const missing = []
const blocked = []
const emptyLies = []
const staleMisuse = []
const doubleToasts = []
const autoRetryMisuse = []
const contractViolations = []

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  const source = readFileSync(file, 'utf8')
  for (const tag of source.match(TABLE_TAG) ?? []) {
    if (!tag.includes(':error=')) continue
    if (!tag.includes(':retry=') && !RETRY_EXEMPT.has(rel)) {
      missing.push(`缺 :retry：${rel}`)
    }
    const guard = tag.match(/v-if="([^"]*)"/)?.[1] ?? ''
    if (guard.includes('.length') && !/Error/i.test(guard)) {
      blocked.push(`错误态被 v-if 挡死：${rel} :: ${guard}`)
    }
  }
}

/**
 * 3. 空态不能替读失败撒谎（M1）。
 * 绑了 #emptyText 的表只认两种写法：
 *   a) 表自己绑了 :error —— 读失败时整表退场，空态根本进不去；
 *   b) 空态自己认得读失败（EmptyListHint 的 :read-failed）—— 由空态块把两件事分开说。
 * 两样都没有时，一次 500 就会被渲染成「这一档没有」，并把「新建 / 调整筛选」摆出来。
 */
const EMPTY_STATE_EXEMPT = new Map([
  ['src/views/knowledge/KnowledgeGraphView.vue', '两张表读的是「从文档提取」的写操作产出，没有读失败这一态'],
  ['src/views/workspace/ClusterPanel.vue', '预览候选簇是本页蒸馏的结果，不是远程读口'],
  ['src/views/workspace/DailyOutputView.vue', '读失败时上方 alert 已把整表撤走，空态进不去'],
])
const TABLE_OPEN = /<(DataTable|data-table|a-table)\b/g

/** 开标签的收尾 `>`：要跳过属性值里的箭头函数（`(r) => r.id`），不能拿第一个 `>` 当结尾 */
function openTagEnd(source, start) {
  let quote = ''
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '>') {
      return i + 1
    }
  }
  return -1
}

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  if (EMPTY_STATE_EXEMPT.has(rel)) continue
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(TABLE_OPEN)) {
    const name = match[1]
    const openEnd = openTagEnd(source, match.index)
    if (openEnd < 0) continue
    const closeAt = source.indexOf(`</${name}`, openEnd)
    if (closeAt < 0) continue
    const block = source.slice(match.index, closeAt)
    if (!block.includes('emptyText')) continue
    const openTag = source.slice(match.index, openEnd)
    const wired = /:error\s*=|\serror\s*=/.test(openTag) || /read-failed|readFailed/.test(block)
    if (!wired) {
      const line = source.slice(0, match.index).split('\n').length
      emptyLies.push(`失败时仍渲染空态：${rel}:${line}`)
    }
  }
}

/**
 * 4. keep-stale-on-error 只给「同一上下文里反复刷新的只读重数据」用（M2）。
 * 跟随客户 / 站点 / 筛选切换的名单类一律不许开；开了还必须配 :stale-key，
 * 让上下文一变就把上一份行作废（切换客户后读失败不许显示上一家的行）。
 */
const STALE_WHITELIST = new Map([
  ['src/views/workspace/AuditLogView.vue', '审计日志：同一档内反复刷新，跨档由 stale-key 作废'],
  ['src/views/billing/OrdersView.vue', '订单：金额账，跨档由 stale-key 作废'],
  ['src/views/billing/BillingView.vue', '账单明细：金额账，跨档由 stale-key 作废'],
  ['src/views/portal/AssembleJobView.vue', '组装任务轮次：轮询进度，换站点由 stale-key 作废'],
])

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  if (!rel.startsWith('src/views/')) continue
  const source = readFileSync(file, 'utf8')
  if (!/keep-stale-on-error|keepStaleOnError/.test(source)) continue
  if (!STALE_WHITELIST.has(rel)) {
    staleMisuse.push(`旧数据保留未登记白名单：${rel}`)
    continue
  }
  for (const match of source.matchAll(TABLE_OPEN)) {
    const openEnd = openTagEnd(source, match.index)
    if (openEnd < 0) continue
    const openTag = source.slice(match.index, openEnd)
    if (!/keep-stale-on-error|keepStaleOnError/.test(openTag)) continue
    if (!/stale-key|staleKey/.test(openTag)) {
      staleMisuse.push(`开了旧数据保留却没给上下文键 :stale-key：${rel}`)
    }
  }
}

/**
 * 5. 一次故障只说一次（M3）。
 * 读失败已经有了「看得见」的出口（表内错误块 / 空态读失败 / 页面级错误态）时，
 * catch 里不许再弹 toast 把同一件事说第二遍。用户主动操作失败不在本规则射程内，
 * 所以只盯读路径函数（load / fetch / read / init / open / refresh / reload 开头）。
 */
const TOAST_EXEMPT = new Map([
  ['src/views/workspace/ArticleGeneratePanel.vue', '最近任务读失败时保留旧行、表内错误口被置空，轻提示是这一发唯一的出口'],
])

const READ_FN = /^(load|fetch|read|init|open|refresh|reload)/
const TOAST_CALL = /message\.(error|warning)\s*\(/

function templateOf(source) {
  const start = source.indexOf('<template')
  if (start < 0) return ''
  const end = source.lastIndexOf('</template>')
  return end > start ? source.slice(start, end) : ''
}

/** catch 块靠花括号配对取出来，跳过字符串里的括号（模板字符串里的 `${}` 也当字符串算） */
function catchBlocksOf(source) {
  const out = []
  const re = /\bcatch\s*(?:\(\s*\w+[^)]*\))?\s*\{/g
  for (const m of source.matchAll(re)) {
    let depth = 0
    let quote = ''
    let ended = -1
    for (let j = m.index + m[0].length - 1; j < source.length; j++) {
      const ch = source[j]
      if (quote) {
        if (ch === '\\') { j++; continue }
        if (ch === quote) quote = ''
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { ended = j + 1; break }
      }
    }
    if (ended > 0) out.push({ start: m.index, text: source.slice(m.index, ended) })
  }
  return out
}

function fnNameBefore(source, at) {
  const before = source.slice(0, at)
  const ms = [...before.matchAll(/\b(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*async\s*\(|(\w+)\s*=\s*async\s*\(/g)]
  if (!ms.length) return ''
  const last = ms[ms.length - 1]
  return last[1] || last[2] || last[3] || ''
}

/** 这个 ref 在模板里有没有一个看得见的错误出口（表内错误块 / 空态读失败 / 页面级错误态） */
function hasVisibleOutlet(template, name) {
  const tags = [...template.matchAll(/<(?:a-alert|state-block|DataTable)\b[\s\S]*?>/g)].map((m) => m[0])
  const words = new RegExp(`\\b${name}\\b`)
  return tags.some((tag) => words.test(tag))
}

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  if (TOAST_EXEMPT.has(rel)) continue
  const source = readFileSync(file, 'utf8')
  const template = templateOf(source)
  for (const block of catchBlocksOf(source)) {
    if (!TOAST_CALL.test(block.text)) continue
    if (!READ_FN.test(fnNameBefore(source, block.start))) continue
    const refs = new Set()
    for (const m of block.text.matchAll(/(\w+)(?:\.readFailed)?\s*\.value\s*=(?!=)|(\w+)\.readFailed\s*=(?!=)/g)) {
      const name = m[1] || m[2]
      if (name && /(error|fail)/i.test(name)) refs.add(name)
    }
    if (![...refs].some((name) => hasVisibleOutlet(template, name))) continue
    const line = source.slice(0, block.start).split('\n').length
    doubleToasts.push(`读失败又弹 toast（同一件事说了两遍）：${rel}:${line}`)
  }
}

/**
 * 6. 自动退避重读只给只读列表（SPEC-UI-7 U3）。
 * 写入型页面开了自动重试，可能把一次失败的写操作又发一遍；只放行登记过的只读页。
 * 页面内也只会对网络断 / 超时 / 服务异常排一次，403 / 401 不自动重试。
 */
const AUTO_RETRY_WHITELIST = new Map([
  ['src/views/portal/CitationProbeView.vue', '引用探针：只读结果列表，失败一次自动退避重读'],
])

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  if (!rel.startsWith('src/views/')) continue
  const source = readFileSync(file, 'utf8')
  if (!/auto-retry-read-only|autoRetryReadOnly/.test(source)) continue
  if (!AUTO_RETRY_WHITELIST.has(rel)) {
    autoRetryMisuse.push(`自动重试只许给只读白名单页：${rel}`)
  }
}

/**
 * 7. 列表契约不许绕过（SPEC-UI-9 H3-1）。
 * workspace / portal 下的视图若直接写 `<a-table>`，或直接用 `DataTable` 却没绑 `:error`，
 * 一次 500 就会退化成空表——新加一页漏错误口必须在提交前红。
 * 确属非列表场景（例如只读排版预览）逐条登记豁免理由。
 * 豁免带「复核到期日」，到期会被打出来（SPEC-UI-10 G-1）：豁免不该是永久的，
 * 写死在脚本里又没人看，三个月后就没人记得为什么放过它。
 */
const CONTRACT_EXEMPT = new Map([
  // 存量页：读失败已有独立错误面，只是没挂在 DataTable 的 :error 上。逐个登记，别再往这些文件里加新表
  ['src/views/portal/CitationProbeView.vue', { reason: '详情三张表是同一发读取的子表，读失败在页面 alert / message 收口', reviewBy: '2027-03-31' }],
  ['src/views/portal/PageBuilderView.vue', { reason: '版本历史抽屉读失败走 message.error；主页面列表已绑 :error', reviewBy: '2027-03-31' }],
  ['src/views/portal/SiteWizardView.vue', { reason: '向导内候选/进度表读失败各有独立 a-alert；表格只展示已读到的结果', reviewBy: '2027-03-31' }],
  ['src/views/portal/SkeletonLibraryView.vue', { reason: '主 DataTable 已绑 :error；另一张是方案预览（本地数据）', reviewBy: '2027-03-31' }],
  ['src/views/workspace/ClusterPanel.vue', { reason: '建议表读失败走 message.error 与空态 unreadable，不挂表内错误块', reviewBy: '2027-03-31' }],
  ['src/views/workspace/DailyOutputView.vue', { reason: '留痕表是 v-else 分支，读失败由上方 a-alert（runsError）承担', reviewBy: '2027-03-31' }],
  ['src/views/workspace/MediaStorageView.vue', { reason: '该表展示后端账目里的错误明细（本地数据），不是远端列表', reviewBy: '2027-03-31' }],
  ['src/views/workspace/ArticleGeneratePanel.vue', { reason: 'Token 统计弹窗里的模型明细（本地统计），不是远端列表', reviewBy: '2027-03-31' }],
])
const A_TABLE_OPEN = /<(a-table)(?=[\s/>])/g

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  if (!rel.startsWith('src/views/workspace/') && !rel.startsWith('src/views/portal/')) continue
  if (CONTRACT_EXEMPT.has(rel)) continue
  const source = readFileSync(file, 'utf8')

  for (const match of source.matchAll(A_TABLE_OPEN)) {
    const line = source.slice(0, match.index).split('\n').length
    contractViolations.push(`直接写 a-table 绕过了错误口：${rel}:${line}`)
  }

  for (const match of source.matchAll(TABLE_OPEN)) {
    if (match[1] === 'a-table') continue
    const openEnd = openTagEnd(source, match.index)
    if (openEnd < 0) continue
    const openTag = source.slice(match.index, openEnd)
    // 错误口两选一：DataTable 绑 :error；或 #emptyText 里挂 EmptyListHint（:read-failed）
    // 开闭标签大小写都可能变（`<data-table>` / `</data-table>`），按忽略大小写找收尾
    const rest = source.slice(openEnd)
    const closeRel = rest.toLowerCase().indexOf(`</${match[1].toLowerCase()}>`)
    const block = closeRel < 0 ? rest.slice(0, 4000) : rest.slice(0, closeRel)
    const hasErrorProp = /:error\s*=|\serror\s*=/.test(openTag)
    const hasEmptyHintError = /:read-failed\s*=|\sread-failed\s*=/.test(block)
    if (!hasErrorProp && !hasEmptyHintError) {
      const line = source.slice(0, match.index).split('\n').length
      contractViolations.push(`DataTable 没绑 :error（#emptyText 里也没有 :read-failed）：${rel}:${line}`)
    }
  }
}

if (missing.length || blocked.length || emptyLies.length || staleMisuse.length || doubleToasts.length || autoRetryMisuse.length || contractViolations.length) {
  console.error([...missing, ...blocked, ...emptyLies, ...staleMisuse, ...doubleToasts, ...autoRetryMisuse, ...contractViolations].join('\n'))
  process.exit(1)
}

// 存量豁免到期提醒（SPEC-UI-10 G-1）：只提醒不拦，到期当天必须有人重新判断留还是清
const today = new Date().toISOString().slice(0, 10)
const expired = []
const dueSoon = []
const soonLine = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)
for (const [file, entry] of CONTRACT_EXEMPT) {
  if (entry.reviewBy < today) expired.push(`${file}（到期 ${entry.reviewBy}）：${entry.reason}`)
  else if (entry.reviewBy <= soonLine) dueSoon.push(`${file}（${entry.reviewBy} 到期）`)
}
if (expired.length) {
  console.warn(`存量豁免已到期 ${expired.length} 条，请重新判断是补错误口还是续期：\n${expired.join('\n')}`)
}
if (dueSoon.length) {
  console.warn(`存量豁免 60 天内到期 ${dueSoon.length} 条：\n${dueSoon.join('\n')}`)
}

console.log('表格状态规则通过：错误态都有重试、不会被 v-if 挡死、空态不替读失败撒谎、旧数据保留只发生在白名单页、读失败不重复弹 toast、自动重试只发生在只读白名单页、workspace/portal 视图不绕过 DataTable 错误口。')
