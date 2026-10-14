import { describe, it, expect } from 'vitest'

/**
 * 「开始生成」连点两次会真花两笔钱（M-P15，10-13 走查现场）。
 *
 * 取证脚本一次提交造出 task 9/10 两笔逐字相同的单，两篇都走了完整的出网链——
 * 手上那个 `:loading` 要等下一个 microtask 才落到 DOM，同一拍里的第二次点击照样打进去。
 * 这一格钉两道闸都在：按钮上挂 `:disabled`，处理函数第一行有一句同步的return。
 *
 * 说清楚：这里钉的是**源码形状**，不是「人连点两次已经复现过」。
 * 真人在浏览器里连点没复现过，也不打算拿它当验收证据。
 *
 * 手法照 article-quality-notes-ui.spec.ts：断言落在源码上，改回旧形状会当场翻红。
 */

const panel = import.meta.glob('../ArticleGeneratePanel.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const view = String(Object.values(panel)[0] ?? '')

describe('M-P15：「开始生成」的重复提交有两道闸', () => {
  it('扫到了面板文件本身（glob 写错会让这一整份用例静默通过）', () => {
    expect(view).not.toBe('')
  })

  it('处理函数第一行就是同步闸，不是等 loading 落到 DOM 再挡', () => {
    const handler = view.slice(view.indexOf('async function generateArticle()'))
    expect(handler).toMatch(/async function generateArticle\(\)\s*\{[\s\S]{0,200}?if \(generating\.value\) return\n\s*generating\.value = true/)
  })

  it('按钮上 loading 与 disabled 同时挂（只有 loading 挡不住同一拍的第二次点击）', () => {
    expect(view).toMatch(/:loading="generating"\s+:disabled="generating"\s+@click="generateArticle"/)
  })

  it('闸能放开：终态那条路一定会把 generating 归位', () => {
    expect(view).toMatch(/function resetGenerationState\(\)\s*\{\s*generating\.value = false/)
  })
})
