/**
 * 诊断包（SPEC-UI-8 G2）：报障时要么复制单条（ErrorHelpActions），要么一键导出整包。
 *
 * 只收排查材料：错误人话、原文（含 requestId）、页面、时间、会话内度量。
 * 不收 token、cookie、请求体——诊断包会被贴进工单或聊天窗口。
 */
import { listRawDetails, type RawDetailEntry } from './errorRaw'
import { getErrorMetrics, type ErrorMetricsSnapshot } from './errorMetrics'

export interface DiagnosticPackage {
  app: 'china-guide-backend-ui'
  /** ISO 时间串 */
  generatedAt: string
  /** 导出时所在页面（只取 pathname） */
  page: string
  /** 浏览器 UA：只用来判断「哪一版浏览器出的问题」 */
  browser: string
  metrics: ErrorMetricsSnapshot
  /** 最近错误原文，最近优先（已脱敏、已截断） */
  errors: RawDetailEntry[]
}

/** 单条原文上限 4KB（SPEC-UI-9 H3）：HTTP 回体 JSON 动辄上万字，整包贴进工单会超长 */
export const RAW_TEXT_LIMIT = 4096

/** 敏感键：命中就只留键名，值换成 *** */
const SENSITIVE_KEY = /(token|cookie|authorization|password|secret|api[_-]?key|credential|session)/i

/**
 * 原文脱敏 + 截断（SPEC-UI-9 H3）。
 *
 * 诊断包会被贴进工单或聊天窗口：`token / cookie / authorization / password / secret`
 * 这类键的值一律换成 `***`；超过 4KB 的原文按字符截断并标注原长。
 * 宽进严出：键名认不出来就保留，宁可多留排查材料，也不把整段回体抹掉。
 */
export function sanitizeRawText(raw: string): string {
  if (!raw) return raw
  // 1) 头部行：`Authorization: Bearer xxx` 里 Bearer 后还有一段值，普通键值规则会漏
  let text = raw.replace(
    /(^|\n)(authorization|cookie|set-cookie|proxy-authorization)\s*:\s*[^\n]*/gi,
    (_match, lead: string, name: string) => `${lead}${name}: ***`
  )
  // 2) JSON 键值：`"password": "abc"` / `"access_token": "xyz"`
  text = text.replace(
    /("[A-Za-z0-9_.-]+"\s*:\s*)("[^"]*"|'[^']*')/g,
    (match, prefix: string) => (SENSITIVE_KEY.test(prefix) ? `${prefix}"***"` : match)
  )
  // 3) 查询串 / 表单：`?access_token=abc&x=1`
  text = text.replace(
    /([A-Za-z0-9_.-]+\s*=\s*)([^&\s,;)]+)/g,
    (match, prefix: string) => (SENSITIVE_KEY.test(prefix) ? `${prefix}***` : match)
  )
  // 4) 头 / 对象简写：`password: abc`（键名不含引号）
  text = text.replace(
    /([A-Za-z0-9_.-]+\s*:\s*)([^\s,;}{]+)/g,
    (match, prefix: string) => (SENSITIVE_KEY.test(prefix) ? `${prefix}***` : match)
  )
  if (text.length > RAW_TEXT_LIMIT) {
    text = `${text.slice(0, RAW_TEXT_LIMIT)}\n…（已截断，原长 ${raw.length} 字）`
  }
  return text
}

function pagePath(): string {
  return typeof window !== 'undefined' ? window.location.pathname : ''
}

function browserOf(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : '（未知）'
}

export function buildDiagnosticPackage(now: Date = new Date()): DiagnosticPackage {
  return {
    app: 'china-guide-backend-ui',
    generatedAt: now.toISOString(),
    page: pagePath(),
    browser: browserOf(),
    metrics: getErrorMetrics(),
    errors: listRawDetails().map((entry) => ({ ...entry, rawText: sanitizeRawText(entry.rawText) }))
  }
}

/** 人能直接贴进工单的纯文本；与 JSON 同源，只是换了排版 */
export function diagnosticPackageText(pkg: DiagnosticPackage = buildDiagnosticPackage()): string {
  const m = pkg.metrics
  const percent = (value: number) => `${Math.round(value * 100)}%`
  const lines = [
    '诊断包（China Guide 管理端）',
    `生成时间：${new Date(pkg.generatedAt).toLocaleString('zh-CN', { hour12: false })}`,
    `页面：${pkg.page || '（未知）'}`,
    `浏览器：${pkg.browser}`,
    '',
    `错误曝光：${m.exposures} 次（涉及 ${m.exposedPageViews}/${m.pageViews} 次页面浏览，曝光率 ${percent(m.exposureRate)}）`,
    `其中「错误 + 0 行」：${m.errorZeroRowCases} 次；误判空态：${m.falseEmptyShown} 次`,
    `重试：${m.retryAttempts} 次，成功 ${m.retrySuccesses} 次（成功率 ${percent(m.retrySuccessRate)}）`,
    `恢复：${m.recoveryCount} 次，平均 ${m.avgRecoveryMs}ms`,
  ]
  if (pkg.errors.length === 0) {
    lines.push('', '最近错误：无')
  } else {
    lines.push('', `最近错误（${pkg.errors.length} 条，最近优先）：`)
    pkg.errors.forEach((entry, index) => {
      lines.push(
        `[${index + 1}] ${new Date(entry.at).toLocaleString('zh-CN', { hour12: false })} ${entry.page || '（未知页面）'}`,
        `人话：${entry.humanText}`,
        `原文：${entry.rawText}`
      )
    })
  }
  return lines.join('\n')
}

/** 复制整包；失败返回 false，由调用方决定是否提示手动选择 */
export async function copyDiagnosticPackage(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(diagnosticPackageText())
    return true
  } catch {
    return false
  }
}

/** 文件名形如 诊断包-20261109-014500.json（本地时间，便于人工对时） */
function packageFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `诊断包-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`
}

/** 下载为 JSON：一键拿到整包，不需要用户复现或手抄 */
export function downloadDiagnosticPackage(): void {
  const now = new Date()
  const pkg = buildDiagnosticPackage(now)
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = packageFileName(now)
  anchor.click()
  URL.revokeObjectURL(url)
}
