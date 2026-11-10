/**
 * 提示条闸门（SPEC-UI-11 R-9）。
 *
 * 规则只有一条：**页面首屏常驻的「口径说明」不许再写 `<a-alert type="info|warning">`**。
 * 这类说明是机器人的活（页面卡 + 页头问号），留在页面上就又变回「每页一块大色块」。
 *
 * 不算违规的三类（本就不该搬）：
 * 1. 有条件的（`v-if` / `v-else` / `v-show` / `v-for`）：读失败、权限、前置条件、动态回执；
 * 2. `type="error"`：错误原样保留（C 类）；
 * 3. 与业务数据绑定的 `:type="..."`：由数据决定，静态脚本不猜。
 *
 * 豁免清单带「复核到期日」（复用 SPEC-UI-10 G-1）：
 * - 闸门先在观察期内只警告，`STRICT_FROM` 之后未登记的一律失败；
 * - 豁免到期后先警告，再过 `EXEMPT_GRACE_DAYS` 天仍没人处理就一并失败。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')
const STRICT_FROM = '2026-11-24'
const EXEMPT_GRACE_DAYS = 14

/** 存量豁免：`文件#该文件里的第几条`，逐条登记理由与复核日期 */
const EXEMPT = new Map([
  // 例：['src/views/xxx/SomeView.vue#1', { reason: '……', reviewBy: '2027-03-31' }]
])

function vueFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...vueFiles(full))
    else if (name.endsWith('.vue')) out.push(full)
  }
  return out
}

/** 容器里的说明（抽屉、弹窗、卡片、折叠面板）是贴着内容讲的，不算「页面首屏大色块」 */
const CONTAINER_TAGS = new Set([
  'a-drawer',
  'a-modal',
  'a-popover',
  'a-card',
  'a-collapse',
  'a-tabs',
  'a-tab-pane',
  'a-form',
  'a-descriptions',
  'a-table'
])
const TAG = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g
const violations = []

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  const source = readFileSync(file, 'utf8')
  const stack = []
  let index = 0

  for (const match of source.matchAll(TAG)) {
    if (source.startsWith('<!--', match.index)) continue
    const [, closing, tag, attrs] = match
    const name = tag.toLowerCase()

    if (closing) {
      // 容错：只回退到最近的同名标签，模板里出现注释掉的半截 HTML 时不至于把栈弄乱
      const at = stack.map(item => item.tag).lastIndexOf(name)
      if (at >= 0) stack.length = at
      continue
    }
    if (name !== 'a-alert') {
      if (!attrs.trimEnd().endsWith('/')) stack.push({ tag: name, attrs })
      continue
    }

    const conditional = /\sv-(if|else|else-if|show|for)\b/.test(attrs)
    const staticType = /\stype="(info|warning)"/.test(attrs)
    if (conditional || !staticType) continue

    const inConditionalParent = stack.some(item => /\sv-(if|else|else-if|show|for)\b/.test(item.attrs))
    const inContainer = stack.some(item => CONTAINER_TAGS.has(item.tag))
    if (inConditionalParent || inContainer) continue

    index += 1
    violations.push({
      key: `${rel}#${index}`,
      line: source.slice(0, match.index).split('\n').length,
      rel
    })
  }
}

const today = new Date().toISOString().slice(0, 10)
const strict = today >= STRICT_FROM
const unregistered = violations.filter(item => !EXEMPT.has(item.key))
const expired = []
const dueSoon = []
const soonLine = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)

for (const [key, entry] of EXEMPT) {
  const exists = violations.some(item => item.key === key)
  if (!exists) continue
  const graceEnd = new Date(new Date(`${entry.reviewBy}T00:00:00Z`).getTime() + EXEMPT_GRACE_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  if (entry.reviewBy < today) expired.push(`${key}（${entry.reviewBy} 到期，${graceEnd} 起计入失败）：${entry.reason}`)
  else if (entry.reviewBy <= soonLine) dueSoon.push(`${key}（${entry.reviewBy} 到期）`)
}

const hardFailed = expired.filter(item => {
  const key = item.split('（')[0]
  const entry = EXEMPT.get(key)
  const graceEnd = new Date(new Date(`${entry.reviewBy}T00:00:00Z`).getTime() + EXEMPT_GRACE_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  return today >= graceEnd
})

if (expired.length) {
  console.warn(`提示条豁免已到期 ${expired.length} 条，请搬进机器人或续期：\n${expired.join('\n')}`)
}
if (dueSoon.length) {
  console.warn(`提示条豁免 60 天内到期 ${dueSoon.length} 条：\n${dueSoon.join('\n')}`)
}

const problems = unregistered.map(item => `${item.key}（第 ${item.line} 行）：首屏常驻口径说明还没搬走`)
if (hardFailed.length) problems.push(...hardFailed.map(item => `豁免过期：${item}`))

if (problems.length) {
  const body = problems.join('\n')
  if (strict) {
    console.error(`提示条规则失败（观察期已于 ${STRICT_FROM} 结束）：\n${body}`)
    process.exit(1)
  }
  console.warn(`提示条规则观察期（${STRICT_FROM} 起转失败）：\n${body}`)
}

console.log(
  `提示条规则通过：首屏不再有常驻 info/warning 说明（已登记豁免 ${EXEMPT.size} 条，命中 ${violations.length} 处）。`
)
