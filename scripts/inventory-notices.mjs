#!/usr/bin/env node
/**
 * R-0 提示条全量盘点（SPEC-UI-11 / P1）
 *
 * 只读扫描 src 下全部业务 .vue（排除 __tests__），把每个 <a-alert> 抽成一行。
 * 归宿：
 *   A 迁进机器人（首访说一次 + 页头问号）
 *   B 改轻量内联（控件旁小字/问号），不再用大色块
 *   C 错误型：原位保留错误块
 *   D 不可逆：原位保留确认弹窗
 *   E 原位保留（非首屏 / 表单弹窗内的上下文提示，不动）
 *   ? 文案是绑定变量，机器判不了，需人工看一眼
 *
 * 用法：node scripts/inventory-notices.mjs [输出路径]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '../src')
const OUT = path.resolve(
  process.argv[2] || path.join(__dirname, '../../docs/SPEC-UI-11-提示条盘点表.md')
)

/** 递归收集 .vue，排除测试目录 */
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      walk(full, acc)
    } else if (entry.name.endsWith('.vue')) {
      acc.push(full)
    }
  }
  return acc
}

/** 注释里的伪标签不算，但保留行号（换成等量换行） */
function stripComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, (s) => s.replace(/[^\n]/g, ''))
}

/**
 * 抽取所有 a-alert：自闭合与成对都要；开标签用引号感知扫描，避免属性里的 > 截断。
 * 返回的 inner 是已经切好的内容区，避免用绝对索引去切相对子串。
 */
function extractAlerts(content) {
  const out = []
  const openRe = /<a-alert\b/g
  let m
  let consumedTo = 0
  while ((m = openRe.exec(content)) !== null) {
    if (m.index < consumedTo) continue
    const start = m.index
    let i = start + '<a-alert'.length
    let quote = null
    let openEnd = -1
    for (; i < content.length; i += 1) {
      const ch = content[i]
      if (quote) {
        if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        continue
      }
      if (ch === '>') {
        openEnd = i
        break
      }
    }
    if (openEnd < 0) continue
    const selfClosing = content[openEnd - 1] === '/'
    let end = openEnd + 1
    if (!selfClosing) {
      const closeIdx = content.indexOf('</a-alert>', openEnd)
      if (closeIdx >= 0) end = closeIdx + '</a-alert>'.length
    }
    out.push({
      start,
      end,
      selfClosing,
      block: content.slice(start, end),
      inner: selfClosing ? '' : content.slice(openEnd + 1, end).replace(/<\/a-alert>\s*$/, ''),
    })
    consumedTo = end
    openRe.lastIndex = end
  }
  return out
}

/** 取属性字面量文案；绑定变量只留标记，交给人看（plain 用负向后视，避免把 :message 当成 message） */
function attrText(block, name) {
  const plain = new RegExp(`(?<![:\\w-])${name}="([^"]*)"`, 'g')
  const boundLit = new RegExp(`:${name}="'([^']*)'"`, 'g')
  const boundVar = new RegExp(`:${name}="([A-Za-z_$][\\w$.]*)"`, 'g')
  const parts = []
  let m
  while ((m = plain.exec(block)) !== null) parts.push(m[1])
  while ((m = boundLit.exec(block)) !== null) parts.push(m[1])
  while ((m = boundVar.exec(block)) !== null) parts.push(`[绑定 ${m[1]}]`)
  return parts.join(' ')
}

/** 去掉标签，保留可读文本 */
function plainText(item) {
  const attrs = ['title', 'message', 'description']
    .map((name) => attrText(item.block, name))
    .filter(Boolean)
    .join(' ')
  return `${attrs} ${item.inner}`
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, (s) => s.replace(/[{}]/g, ''))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 机器初筛。只有「首屏常驻」才值得动；表单、弹窗、表格里的上下文提示留在原地。
 */
function guessHome(type, text, isTop) {
  if (type === 'error') return 'C'
  if (/^\[绑定 [^\]]+\]$/.test(text)) return '?'
  const irreversible = /删除后|删除将|不可恢复|一旦|将无法|永久删除|会影响/.test(text)
  if (type === 'warning' && irreversible && !/不等于|不代表|不是/.test(text)) return 'D'
  if (!isTop) return 'E'
  if (type === 'success' || type === 'default') return 'E'
  if (type === 'warning') return 'B'
  const explain = /口径|来源|来自|说明|含义|区别|统计|计入|不计|规则|识别|定义|不能相加/.test(text)
  if (text.length >= 30 || explain) return 'A'
  return 'B'
}

/**
 * 人工复核覆盖（试点 3 页已过目）。键 = 文件#行号。
 * 初筛会被「含解释词」或「含请先」骗到，这两处按实际语义纠正。
 */
const OVERRIDES = {
  // 前置条件：没选客户就读不到，必须留在数据前，不是背景解释
  'src/views/analytics/PortalAnalyticsView.vue#4': 'B',
  // 运行时状态/权限提示（变量文案），不是常驻说明
  'src/views/portal/SkeletonLibraryView.vue#19': 'E',
}

function lineOf(content, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) if (content.charCodeAt(i) === 10) line += 1
  return line
}

const files = walk(SRC).sort()
const rows = []
let openCount = 0
let blockCount = 0
let selfClosingCount = 0

for (const file of files) {
  const content = stripComments(fs.readFileSync(file, 'utf8'))
  const rel = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/')

  openCount += (content.match(/<a-alert\b/g) || []).length

  const templateIdx = content.search(/<template>/)
  const dataMatch = /<a-card\b|<data-table\b|<a-table\b|<a-tabs\b/.exec(
    templateIdx >= 0 ? content.slice(templateIdx) : content
  )
  const dataLineIdx = dataMatch && templateIdx >= 0 ? content.indexOf(dataMatch[0], templateIdx) : -1
  const dataLine = dataLineIdx >= 0 ? lineOf(content, dataLineIdx) : Number.MAX_SAFE_INTEGER

  const blocks = extractAlerts(content)
  for (const item of blocks) {
    blockCount += 1
    if (item.selfClosing) selfClosingCount += 1
    const line = lineOf(content, item.start)
    const typeMatch = item.block.match(/type="([a-z]+)"/)
    const type = typeMatch ? typeMatch[1] : 'default'
    const text = plainText(item)
    const top = line < dataLine ? '是' : '否'
    const guessed = guessHome(type, text, top === '是')
    rows.push({
      file: rel,
      line,
      type,
      top,
      len: text.length,
      home: OVERRIDES[`${rel}#${line}`] || guessed,
      text,
    })
  }
}

function countBy(key) {
  const map = new Map()
  for (const r of rows) map.set(r[key], (map.get(r[key]) || 0) + 1)
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

const byType = countBy('type')
const byHome = countBy('home')
const byTop = countBy('top')

const perFile = new Map()
for (const r of rows) perFile.set(r.file, (perFile.get(r.file) || 0) + 1)
const topFiles = [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)

const md = []
md.push('# SPEC-UI-11 提示条盘点表（R-0）')
md.push('')
md.push(`> 生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`)
md.push('> 扫描范围：`chinaGuideBackend-ui/src` 下全部业务 `.vue`（排除 `__tests__`）')
md.push('> 方法：抽取 `<a-alert>` 开标签与内容，自闭合与成对都算；「首屏」= 出现在第一处数据区（卡片/表格/页签）之前')
md.push('> 归宿：A 迁机器人 / B 改轻量内联 / C 错误保留 / D 不可逆保留 / E 原位保留（不动）/ ? 绑定变量待人工判定')
md.push('> 提醒：A/B/? 是机器初筛，批量改之前必须逐条复核；试点 3 页已人工过目，见下方「试点页明细」。')
md.push('')
md.push('## 汇总')
md.push('')
md.push('| 维度 | 分布 |')
md.push('| --- | --- |')
md.push(`| 文件数 | ${files.length} |`)
md.push(`| a-alert 总数 | ${openCount} |`)
md.push(`| 其中自闭合写法 | ${selfClosingCount} |`)
md.push(`| type 分布 | ${byType.map(([k, v]) => `${k} ${v}`).join(' / ')} |`)
md.push(`| 建议归宿 | ${byHome.map(([k, v]) => `${k} ${v}`).join(' / ')} |`)
md.push(`| 首屏常驻 | ${byTop.map(([k, v]) => `${k} ${v}`).join(' / ')} |`)
md.push('')
md.push('### 命中最多的文件')
md.push('')
md.push('| 文件 | 条数 |')
md.push('| --- | --- |')
for (const [f, n] of topFiles) md.push(`| ${f} | ${n} |`)
md.push('')
md.push('## 试点页明细（P3 范围）')
md.push('')
const PILOTS = [
  'src/views/analytics/PortalAnalyticsView.vue',
  'src/views/workspace/MediaStorageView.vue',
  'src/views/portal/SkeletonLibraryView.vue',
]
md.push('| 文件 | 行 | type | 首屏 | 归宿 | 文案摘要 |')
md.push('| --- | --- | --- | --- | --- | --- |')
for (const pilot of PILOTS) {
  const list = rows.filter((r) => r.file === pilot)
  md.push(`| **${pilot}** | | | | ${list.length} 条 | |`)
  for (const r of list) {
    md.push(`| | ${r.line} | ${r.type} | ${r.top} | ${r.home} | ${r.text.replace(/\|/g, '\\|').slice(0, 90)} |`)
  }
}
md.push('')
md.push('## 清单')
md.push('')
md.push('| # | 文件 | 行 | type | 首屏 | 字数 | 归宿 | 文案摘要 |')
md.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
rows.forEach((r, i) => {
  const summary = r.text.replace(/\|/g, '\\|').slice(0, 100)
  md.push(`| ${i + 1} | ${r.file} | ${r.line} | ${r.type} | ${r.top} | ${r.len} | ${r.home} | ${summary} |`)
})
md.push('')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md.join('\n'), 'utf8')

// stdout 只用 ASCII，避免 PowerShell 控制台乱码
console.log('files scanned      :', files.length)
console.log('a-alert total      :', openCount, '(self-closing', selfClosingCount + ')')
console.log('by type            :', byType.map(([k, v]) => `${k}=${v}`).join(' '))
console.log('by suggested home  :', byHome.map(([k, v]) => `${k}=${v}`).join(' '))
console.log('first-screen       :', byTop.map(([k, v]) => `${k}=${v}`).join(' '))
console.log('report written to  :', OUT)
