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

if (missing.length || blocked.length) {
  console.error([...missing, ...blocked].join('\n'))
  process.exit(1)
}
console.log('表格状态规则通过：错误态都有重试，且不会被 v-if 挡死。')
