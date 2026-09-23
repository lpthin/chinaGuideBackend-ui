import { marked } from 'marked'

/**
 * 把后台存储的 Markdown 渲染成可安全塞进 v-html 的片段。
 *
 * 门户详情页是访客页面：文章正文由租户管理员录入，属于「半可信输入」，
 * 直接 v-html 等于给访客投存储型 XSS。marked v18 已不自带净化，所以这里
 * 用白名单过一遍——只保留排版需要的标签与属性，其余整节点丢弃。
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'EM', 'STRONG', 'DEL',
  'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'SPAN', 'SUP', 'SUB'
])

/** 仅 http/https/mailto 与站内绝对路径，javascript: 与 data: 一律丢弃 */
function isSafeUrl(value: string): boolean {
  const url = value.trim().toLowerCase()
  return url.startsWith('http://') || url.startsWith('https://')
      || url.startsWith('mailto:') || url.startsWith('/') || url.startsWith('#')
}

export function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown) {
    return ''
  }
  const html = marked.parse(markdown, { async: false }) as string
  return sanitizeHtml(html)
}

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined' || !window.DOMParser) {
    // 没有 DOM 的环境（理论上不会发生：门户只在浏览器里跑）不渲染富文本，宁可只出纯文本
    return ''
  }
  const document = new window.DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html')
  const root = document.getElementById('__root')
  if (!root) {
    return ''
  }
  scrub(root, document)
  return root.innerHTML
}

function scrub(node: Element, document: Document): void {
  Array.from(node.childNodes).forEach(child => {
    if (child.nodeType === 3) {
      return
    }
    if (child.nodeType !== 1) {
      child.remove()
      return
    }
    const element = child as Element
    if (!ALLOWED_TAGS.has(element.tagName)) {
      // 不安全的容器标签本身去掉，但保留里面的文字，避免正文凭空缺一块
      const text = document.createTextNode(element.textContent || '')
      element.replaceWith(text)
      return
    }
    Array.from(element.attributes).forEach(attribute => {
      const name = attribute.name.toLowerCase()
      const keep = (name === 'href' && element.tagName === 'A' && isSafeUrl(attribute.value))
          || (name === 'src' && element.tagName === 'IMG' && isSafeUrl(attribute.value))
          || (name === 'alt' && element.tagName === 'IMG')
      if (!keep) {
        element.removeAttribute(attribute.name)
      }
    })
    if (element.tagName === 'A') {
      element.setAttribute('rel', 'noopener noreferrer nofollow')
      element.setAttribute('target', '_blank')
    }
    scrub(element, document)
  })
}
