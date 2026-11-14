/**
 * 提示条 / 首屏说明闸门（SPEC-UI-11 R-9）。
 *
 * 规则：**页面首屏常驻的「口径说明」不许写在页面里**。这类说明是机器人的活
 * （页面卡 + 页头问号），留在页面上就又变回「每页一块大色块」。
 *
 * 命中面两类（2026-11-12 起扩面；此前只查第一类，纯 <p> 与 description 槽全漏）：
 * 1. `<a-alert type="info|warning">`；
 * 2. 页面级说明段落：`<p class="...__intro | ...__lead | ...__sub | page-subtitle">`
 *    且正文是静态文案（不含 `{{ }}`），以及 PageTitle/SettingsPage/RecordListPage/
 *    ChecklistPage/PageShell 上静态且超过 20 个汉字的 `description="..."`。
 *
 * 不算违规的三类（本就不该搬）：
 * 1. 有条件的（`v-if` / `v-else` / `v-show` / `v-for`）：读失败、权限、前置条件、动态回执；
 * 2. `type="error"`：错误原样保留（C 类）；
 * 3. 与业务数据绑定的 `:type` / `{{ }}` 插值：由数据决定，静态脚本不猜。
 *    容器里的说明（抽屉、弹窗、卡片、折叠面板）贴着内容讲，也不算「首屏大色块」。
 *
 * 豁免清单带「复核到期日」（复用 SPEC-UI-10 G-1）：
 * - 2026-11-12 起转为硬门：未登记的一律失败（观察期到此为止，存量已清零）；
 * - 豁免到期后先警告，再过 `EXEMPT_GRACE_DAYS` 天仍没人处理就一并失败。
 *
 * `NOTICE_SCAN_DIR` 可覆盖扫描根（默认 `src`），只给闸门自测夹具用。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = process.env.NOTICE_SCAN_DIR ? resolve(process.env.NOTICE_SCAN_DIR) : join(process.cwd(), 'src')
const STRICT_FROM = '2026-11-12'
const EXEMPT_GRACE_DAYS = 14

/** 存量豁免：`文件#该文件里的第几条`，逐条登记理由与复核日期 */
const EXEMPT = new Map([
  [
    'src/views/portal/ClientDecisionView.vue#1',
    {
      reason:
        '客户分享页（凭令牌直开）不在工作台路由内，没有机器人宿主；这段是给客户的唯一开场说明，搬走就没人说了',
      reviewBy: '2027-03-31'
    }
  ],
  [
    'src/views/dev/ListStateDemoView.vue#1',
    {
      reason:
        '开发用的列表三态示例页（hidden 路由、不进菜单），description 是演示契约本身的标签，不是给业务用户的口径说明',
      reviewBy: '2027-03-31'
    }
  ]
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
/** 页面壳组件：它们身上的静态 description 就是「标题下那一大段」 */
const PAGE_SHELL_TAGS = new Set(['pagetitle', 'settingspage', 'recordlistpage', 'checklistpage', 'pageshell'])
/** 页面级说明段落的类名约定（与 robot.ts 的页面卡一一对应） */
const PAGE_INTRO_CLASS = /class="[^"]*(?:__intro|__lead|__sub)\b|class="[^"]*\bpage-subtitle\b/
/** 静态文案：没有 {{ }} 插值，不随数据变 */
const isStatic = (text) => !text.includes('{{')
const chineseCount = (text) => (text.match(/[\u4e00-\u9fa5]/g) || []).length
/** 用户可见文案里不许出现的内部编号：Spec-C、§5、M-P40、Q-1、N-2 这类评审用语 */
const JARGON = /Spec-[A-Z]|§|M-P\d+|Q-\d+|N-\d/g
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

    const conditional = /\sv-(if|else|else-if|show|for)\b/.test(attrs)
    const inConditionalParent = stack.some(item => /\sv-(if|else|else-if|show|for)\b/.test(item.attrs))
    const inContainer = stack.some(item => CONTAINER_TAGS.has(item.tag))
    const blocked = conditional || inConditionalParent || inContainer

    // 第二类命中面之一：页面级说明段落（<p class="...__intro/__lead/__sub"> 或 page-subtitle）
    if (name === 'p' && PAGE_INTRO_CLASS.test(attrs)) {
      const end = source.indexOf('</p>', match.index)
      const inner = end >= 0 ? source.slice(match.index + match[0].length, end) : ''
      if (!blocked && isStatic(inner) && chineseCount(inner) >= 20) {
        index += 1
        violations.push({
          kind: 'paragraph',
          key: `${rel}#${index}`,
          line: source.slice(0, match.index).split('\n').length,
          rel
        })
      }
    }

    // 第二类命中面之二：页面壳组件上的静态 description（标题下那一大段）
    if (PAGE_SHELL_TAGS.has(name)) {
      const desc = attrs.match(/\sdescription="([^"]*)"/)
      if (desc && !blocked && isStatic(desc[1]) && chineseCount(desc[1]) >= 20) {
        index += 1
        violations.push({
          kind: 'description',
          key: `${rel}#${index}`,
          line: source.slice(0, match.index).split('\n').length,
          rel
        })
      }
    }

    if (name !== 'a-alert') {
      if (!attrs.trimEnd().endsWith('/')) stack.push({ tag: name, attrs })
      continue
    }

    const staticType = /\stype="(info|warning)"/.test(attrs)
    if (blocked || !staticType) continue

    index += 1
    violations.push({
      kind: 'alert',
      key: `${rel}#${index}`,
      line: source.slice(0, match.index).split('\n').length,
      rel
    })
  }

  // 第三类命中面：模板与脚本里的用户可见文案（注释除外）出现内部 spec 编号
  const templateStart = source.indexOf('<template>')
  const templateEnd = source.lastIndexOf('</template>')
  if (templateStart >= 0 && templateEnd > templateStart) {
    const raw = source.slice(templateStart, templateEnd)
    const offset = source.slice(0, templateStart).split('\n').length - 1
    // 注释整体替换成等长空白：行号不跑，且注释里的 Spec 引用不算违规
    const visible = raw.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '))
    for (const hit of visible.matchAll(JARGON)) {
      index += 1
      violations.push({
        kind: 'jargon',
        key: `${rel}#${index}`,
        line: offset + visible.slice(0, hit.index).split('\n').length,
        rel
      })
    }
  }

  // 常量里的标题/说明也是用户可见的（StateBlock 的 next、菜单提示、抽屉注记都从脚本里来）
  const scriptStart = source.indexOf('<script')
  const scriptEnd = source.lastIndexOf('</script>')
  if (scriptStart >= 0 && scriptEnd > scriptStart) {
    const raw = source.slice(scriptStart, scriptEnd)
    const offset = source.slice(0, scriptStart).split('\n').length - 1
    const visible = stripJsComments(raw)
    for (const hit of visible.matchAll(JARGON)) {
      index += 1
      violations.push({
        kind: 'jargon',
        key: `${rel}#${index}`,
        line: offset + visible.slice(0, hit.index).split('\n').length,
        rel
      })
    }
  }
}

/** 文案模块（src/copy/*.ts）与 api 层里的字符串也是用户可见的：去掉注释后同样查内部编号 */
function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*(?:\/\/|\*).*$/gm, (line) => line.replace(/[^\n]/g, ' '))
}

function tsFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      // 测试与测试夹具不是用户文案，跳过；其余目录继续走
      if (name !== '__tests__' && name !== 'tests') out.push(...tsFiles(full))
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

for (const file of tsFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  const visible = stripJsComments(readFileSync(file, 'utf8'))
  let index = 0
  for (const hit of visible.matchAll(JARGON)) {
    index += 1
    violations.push({
      kind: 'jargon',
      key: `${rel}#${index}`,
      line: visible.slice(0, hit.index).split('\n').length,
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

const KIND_TEXT = {
  alert: '首屏常驻提示条还没搬走',
  paragraph: '首屏说明段落还没搬走',
  description: '页头 description 说明还没搬走',
  jargon: '用户文案里出现了内部 spec 编号（Spec-/§/M-P/Q-/N-）'
}
const problems = unregistered.map(
  item => `${item.key}（第 ${item.line} 行）：${KIND_TEXT[item.kind] ?? '首屏常驻说明还没搬走'}`
)
if (hardFailed.length) problems.push(...hardFailed.map(item => `豁免过期：${item}`))

if (problems.length) {
  const body = problems.join('\n')
  if (strict) {
    console.error(`提示条规则失败（硬门：首屏说明必须进机器人）：\n${body}`)
    process.exit(1)
  }
  console.warn(`提示条规则观察期（${STRICT_FROM} 起转失败）：\n${body}`)
}

console.log(
  `提示条规则通过：首屏没有常驻说明（已登记豁免 ${EXEMPT.size} 条，命中 ${violations.length} 处）。`
)
