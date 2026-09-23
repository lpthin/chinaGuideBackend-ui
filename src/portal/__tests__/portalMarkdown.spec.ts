import { describe, expect, it } from 'vitest'
import { renderMarkdown, sanitizeHtml } from '../portalMarkdown'

/**
 * 门户详情页是免鉴权公开页，正文由租户录入 → 半可信输入。
 * 这三类攻击必须被白名单丢掉，否则就是存储型 XSS。
 */
describe('portalMarkdown 白名单净化', () => {
  it('丢掉 script 标签，但保留里面的文字', () => {
    const html = sanitizeHtml('<p>正常段落</p><script>alert(1)</script>')
    expect(html).toContain('正常段落')
    expect(html).not.toContain('<script')
  })

  it('丢掉事件属性与非白名单属性', () => {
    const html = sanitizeHtml('<img src="/uploads/a.png" onerror="alert(1)" alt="封面" style="x" />')
    expect(html).toContain('/uploads/a.png')
    expect(html).toContain('封面')
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toMatch(/style/i)
  })

  it('丢掉 javascript: 与 data: 协议，保留 http/https/mailto 与站内相对路径', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">点我</a>')).not.toMatch(/javascript:/i)
    expect(sanitizeHtml('<a href="data:text/html,<script>1</script>">点我</a>')).not.toMatch(/data:/i)
    expect(sanitizeHtml('<a href="https://example.com">外部</a>')).toContain('https://example.com')
    expect(sanitizeHtml('<a href="/news/hello">站内</a>')).toContain('/news/hello')
  })

  it('外链自动补 rel，避免给爬虫留下反向引用泄漏', () => {
    expect(sanitizeHtml('<a href="https://example.com">外部</a>')).toContain('noopener')
  })

  it('renderMarkdown 走同一道净化，且非法/空输入只出空串', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(null)).toBe('')
    const rendered = renderMarkdown('# 标题\n\n正文 <img src=x onerror=alert(1)> 结束')
    expect(rendered).toContain('<h1>标题</h1>')
    expect(rendered).not.toMatch(/onerror/i)
  })

  it('排版标签不被误伤', () => {
    const html = sanitizeHtml('<blockquote><p>引用</p></blockquote><ul><li><strong>加粗</strong></li></ul><table><tr><td>格</td></tr></table>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<td>格</td>')
  })
})
