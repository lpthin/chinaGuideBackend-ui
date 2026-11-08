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

if (missing.length || blocked.length || emptyLies.length) {
  console.error([...missing, ...blocked, ...emptyLies].join('\n'))
  process.exit(1)
}
console.log('表格状态规则通过：错误态都有重试、不会被 v-if 挡死、空态也不替读失败撒谎。')
