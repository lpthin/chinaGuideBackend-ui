import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  buildDiagnosticPackage,
  diagnosticPackageText,
  copyDiagnosticPackage,
  downloadDiagnosticPackage,
  sanitizeRawText,
  RAW_TEXT_LIMIT,
} from '../diagnostic'
import { rememberRawDetail } from '../errorRaw'

/**
 * SPEC-UI-8 G2：诊断包是「不复现也能报障」的那条路。
 * 这里钉四件事：整包内容同源、纯文本能直接贴、复制失败不炸、下载文件名带时间。
 */
const FIXED_AT = new Date('2026-11-09T01:45:00.000Z')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('诊断包', () => {
  it('整包带生成时间、页面、浏览器、度量与最近错误（含原文里的 requestId）', () => {
    rememberRawDetail('读口断了', 'GET /api/audit-logs → HTTP 500\nrequestId: req-9')
    const pkg = buildDiagnosticPackage(FIXED_AT)

    expect(pkg.app).toBe('china-guide-backend-ui')
    expect(pkg.generatedAt).toBe(FIXED_AT.toISOString())
    expect(pkg.page).toBe(typeof window !== 'undefined' ? window.location.pathname : '')
    expect(pkg.browser).toBe(typeof navigator !== 'undefined' ? navigator.userAgent : '（未知）')
    expect(pkg.metrics.pageViews).toBeGreaterThanOrEqual(0)

    const entry = pkg.errors.find((item) => item.humanText === '读口断了')
    expect(entry?.rawText).toContain('requestId: req-9')
    expect(entry?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('纯文本与 JSON 同源：四个数、错误人话与原文都在，能直接贴进工单', () => {
    rememberRawDetail('读口断了-文本', 'requestId: req-10')
    const text = diagnosticPackageText(buildDiagnosticPackage(FIXED_AT))

    expect(text).toContain('诊断包')
    expect(text).toContain('错误曝光')
    expect(text).toContain('重试')
    expect(text).toContain('恢复')
    expect(text).toContain('读口断了-文本')
    expect(text).toContain('requestId: req-10')
  })

  it('复制成功返回 true；剪贴板不可用时返回 false，不抛错', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    await expect(copyDiagnosticPackage()).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('诊断包'))
    vi.unstubAllGlobals()
  })

  it('复制失败不炸：返回 false，由调用方提示手动选择', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    await expect(copyDiagnosticPackage()).resolves.toBe(false)
    vi.unstubAllGlobals()
  })

  // ===== SPEC-UI-9 H3：导出前脱敏 + 4KB 截断 =====
  it('敏感键的值换成 ***；requestId 与路径保留供排查', () => {
    rememberRawDetail(
      '带敏感值',
      'GET /api/x?access_token=tok-1&page=2\nAuthorization: Bearer abc.def\n"password":"p@ss"\nrequestId: req-11'
    )
    const pkg = buildDiagnosticPackage(FIXED_AT)
    const entry = pkg.errors.find((item) => item.humanText === '带敏感值')

    expect(entry?.rawText).not.toContain('tok-1')
    expect(entry?.rawText).not.toContain('abc.def')
    expect(entry?.rawText).not.toContain('p@ss')
    expect(entry?.rawText).toContain('***')
    expect(entry?.rawText).toContain('requestId: req-11')
    expect(entry?.rawText).toContain('/api/x')
    expect(entry?.rawText).toContain('page=2')
  })

  it('超过 4KB 的原文截断并标注原长，不把整段回体塞进工单', () => {
    rememberRawDetail('超长回体', 'A'.repeat(RAW_TEXT_LIMIT + 100))
    const pkg = buildDiagnosticPackage(FIXED_AT)
    const entry = pkg.errors.find((item) => item.humanText === '超长回体')

    expect(entry?.rawText.length).toBeLessThanOrEqual(RAW_TEXT_LIMIT + 40)
    expect(entry?.rawText).toContain('已截断')
    expect(entry?.rawText).toContain('原长')
  })

  it('脱敏函数单独可用：普通排查字段原样保留', () => {
    const raw = 'GET /api/admin/audit-logs → HTTP 500\nrequestId: req-12\ntraceId: tr-1'
    expect(sanitizeRawText(raw)).toBe(raw)
  })

  it('下载为 JSON，文件名带本地时间；用完即释放 blob 地址', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      downloadDiagnosticPackage()
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
      const anchor = click.mock.contexts[0] as HTMLAnchorElement
      expect(anchor.href).toContain('blob:mock')
      expect(anchor.download).toMatch(/^诊断包-\d{8}-\d{6}\.json$/)
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })
})
