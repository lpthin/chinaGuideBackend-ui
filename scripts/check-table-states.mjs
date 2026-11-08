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

if (missing.length || blocked.length || emptyLies.length || staleMisuse.length || doubleToasts.length) {
  console.error([...missing, ...blocked, ...emptyLies, ...staleMisuse, ...doubleToasts].join('\n'))
  process.exit(1)
}
console.log('表格状态规则通过：错误态都有重试、不会被 v-if 挡死、空态不替读失败撒谎、旧数据保留只发生在白名单页、读失败不重复弹 toast。')
