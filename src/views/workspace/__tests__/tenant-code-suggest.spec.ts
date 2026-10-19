import { describe, expect, it } from 'vitest'
import { normalizeCodeTokens, suggestTenantCodeFromName } from '../tenantCodeSuggest'
import { CODE_FORMAT_PATTERN } from '../tenantCodeCheck'

/**
 * 从租户名称推一个建议代码（M-P45 拍板①「只加本地拼音库，不外呼」）。
 *
 * <p>判据分两层，因为这两层会各自以不同方式坏掉：
 * - 归一化（纯函数、吃现成的 token 数组）坏掉的形状是「产出一根不合法的串」——那会当场把这一格刷红，
 *   人以为是自己打错了；所以这里钉的不是「结果好不好看」，而是一条不变量：<em>要么空串，要么过格式闸</em>。
 * - 词典那一层坏掉的形状是「悄悄换成一把尺」：`v: true` 没写就会产出 `lǚ`、声调没关就会产出 `zǒu`，
 *   两形都过不了闸，于是建议功能静默失效。所以这里用真依赖跑（不 mock），把带撇的汉字钉成 ASCII。</p>
 *
 * <p>「有限公司」那一段钉的是<em>不</em>做的事：没拍板剥后缀，就不替超管决定他的公司叫什么。</p>
 */

describe('M-P45 归一化：要么空串，要么一根合格的 DNS 标签', () => {
  it('全拼音按音节连字符相接', () => {
    expect(normalizeCodeTokens(['zou', 'cha', 'shi', 'liu', 'ke', 'ji'])).toBe('zou-cha-shi-liu-ke-ji')
  })

  it('数字原样留着，全角括号当作分隔符丢掉', () => {
    expect(normalizeCodeTokens(['zu', 'hu', '15（', 'chong', 'jian', '）'])).toBe('zu-hu-15-chong-jian')
  })

  it('非中文段保留，中间的符号串一律换成一个连字符', () => {
    expect(normalizeCodeTokens(['walkthrough ', 'zou', 'cha', '·', 'na', 'xin', 'ke', 'ji']))
      .toBe('walkthrough-zou-cha-na-xin-ke-ji')
  })

  it('首尾不许留连字符，全符号的名字推不出东西（返回空串，不返回一根注定被拒的串）', () => {
    expect(normalizeCodeTokens(['-tenant-'])).toBe('tenant')
    expect(normalizeCodeTokens(['—', '·', '  '])).toBe('')
    expect(normalizeCodeTokens([])).toBe('')
  })

  it('两个长度边界：2 位留，1 位丢；超过 50 位截到 50 且收尾不留连字符', () => {
    expect(normalizeCodeTokens(['ab'])).toBe('ab')
    expect(normalizeCodeTokens(['a'])).toBe('')
    const long = normalizeCodeTokens(['na', 'xin', 'a'.repeat(60)])
    expect(long.length).toBeLessThanOrEqual(50)
    expect(CODE_FORMAT_PATTERN.test(long)).toBe(true)
    expect(normalizeCodeTokens([`${'a'.repeat(49)}-`])).toBe('a'.repeat(49))
  })

  it('大写进不来：词典给什么形状都不改变产出是小写', () => {
    expect(normalizeCodeTokens(['Te', 'St'])).toBe('te-st')
  })
})

describe('M-P45 词典那一腿用真依赖跑（不外呼，但也不许 mock 成一把假尺）', () => {
  it('中文名字 → 无声调 ASCII 拼音', async () => {
    expect(await suggestTenantCodeFromName('走查十六科技')).toBe('zou-cha-shi-liu-ke-ji')
    expect(await suggestTenantCodeFromName('北京纳欣科技')).toBe('bei-jing-na-xin-ke-ji')
  })

  it('带撇的韵脚走 v 而不是 ü——ü 过不了域名那一关', async () => {
    expect(await suggestTenantCodeFromName('绿女科技')).toBe('lv-nv-ke-ji')
  })

  it('中英混排与编号都留着', async () => {
    expect(await suggestTenantCodeFromName('租户15（重建）')).toBe('zu-hu-15-chong-jian')
    expect(await suggestTenantCodeFromName('walkthrough 走查·纳欣科技'))
      .toBe('walkthrough-zou-cha-na-xin-ke-ji')
  })

  it('不剥「有限公司」这类后缀：没拍板的意见不替人做主', async () => {
    expect(await suggestTenantCodeFromName('纳欣科技有限公司')).toBe('na-xin-ke-ji-you-xian-gong-si')
  })

  it('空名字、纯符号名字都推不出东西', async () => {
    expect(await suggestTenantCodeFromName('')).toBe('')
    expect(await suggestTenantCodeFromName('   ')).toBe('')
    expect(await suggestTenantCodeFromName('——')).toBe('')
  })

  it('不变量：任意名字产出的要么空串，要么过格式闸', async () => {
    const names = ['A', '1', '走查十六科技', '租户15（重建）', '納欣', 'M&P Co.', '😀🙂',
      '中华人民共和国统一社会信用代码注册地址北京市海淀区', 'a'.repeat(80)]
    for (const name of names) {
      const suggested = await suggestTenantCodeFromName(name)
      if (suggested === '') continue
      expect(CODE_FORMAT_PATTERN.test(suggested), `${name} => ${suggested}`).toBe(true)
    }
  })
})

describe('M-P45 建议这一发是纯本地的（零外呼、零流水）', () => {
  const suggestSource = String(Object.values(import.meta.glob('../tenantCodeSuggest.ts',
    { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] ?? '')

  it('扫到了源文件本身（glob 写错会让这一整段静默通过）', () => {
    expect(suggestSource).not.toBe('')
  })

  it('没有任何 http / fetch：这一发不发请求，也就没什么可记的', () => {
    expect(suggestSource).not.toContain('fetch(')
    expect(suggestSource).not.toContain('http.')
    expect(suggestSource).not.toContain("@/api/http")
    expect(suggestSource).not.toContain('axios')
  })

  it('词典走动态 import：只有真按失焦那一下才加载，不进后台主包', () => {
    expect(suggestSource).toContain("await import('pinyin-pro')")
  })
})
