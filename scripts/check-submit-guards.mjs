// SPEC-UI-9 H2 静态防线：写入按钮的「在途」两道闸必须同时挂。
//
// 只挂 :loading 挡不住同一拍第二次点击——Vue 的更新要等下一个 microtask 才落到 DOM，
// 第二次点击照样进函数。规则：带 @click 的按钮只要 :loading 绑了变量（不论叫什么名字），
// 同一标签必须有 :disabled。早期只看 saving/submitting/pending，自定义名字一律漏过去
// （SPEC-UI-10 G-3），改成「绑了变量就算」。
//
// 运行时还有 submitGuard 兜底（src/utils/submitGuard.ts）：这里只是让新页面漏不下。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')
const BUTTON_OPEN = /<(a-button|el-button)\b/g
const PENDING_LOADING = /:loading\s*=\s*["']([^"']*)["']/
/** 字面量 true/false 不是「在途状态」，交给渲染本身 */
const LITERAL = /^\s*(true|false)\s*$/i

/** 已知例外：登记后必须写清为什么这里不需要 :disabled */
const EXEMPT = new Map([])

function vueFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return vueFiles(full)
    return full.endsWith('.vue') ? [full] : []
  })
}

/** 开标签的收尾 `>`：跳过属性值里的箭头函数（`v => v.id`）和字符串里的 `>` */
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

const violations = []

for (const file of vueFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(BUTTON_OPEN)) {
    const openEnd = openTagEnd(source, match.index)
    if (openEnd < 0) continue
    const tag = source.slice(match.index, openEnd)
    if (!tag.includes('@click')) continue

    const loading = tag.match(PENDING_LOADING)?.[1] ?? ''
    if (!loading || LITERAL.test(loading)) continue

    const hasDisabled = /:disabled\s*=|\sdisabled(?:\s|=|>)/.test(tag)
    if (!hasDisabled) {
      const line = source.slice(0, match.index).split('\n').length
      violations.push(`提交按钮只挂 :loading 没挂 :disabled：${rel}:${line}（:loading="${loading}"）`)
    }
  }
}

void EXEMPT

if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}
console.log('提交防重规则通过：所有在途提交按钮都同时挂了 :loading 与 :disabled（运行时另有 submitGuard 兜底）。')
