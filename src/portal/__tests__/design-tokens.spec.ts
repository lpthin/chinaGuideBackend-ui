import { describe, it, expect } from 'vitest'
import { designTokenLabel, designTokenPlaceholder } from '../designTokens'
import { FONT_STACKS, themeVars } from '../blocks/portalTheme'
import type { ThemeTokenField } from '../../api/themePresets'

/**
 * 样式变量的中文标签只是展示词表：键名与值域来自 /portal/theme-presets/tokens。
 * 这条用例钉的是「后端加了第 9 个旋钮而这里没补中文名」时的行为——
 * 必须显示成原始键名（看得见），而不是抛错或返回空串（等于那个框悄悄没了）。
 */
describe('designTokens 展示词表', () => {
  it('有中文名就用中文名', () => {
    expect(designTokenLabel('colorPrimary')).toBe('主色')
    expect(designTokenLabel('spacingScale')).toBe('间距比例')
  })

  it('后端新增而界面没配名字的键，退回显示原始键名', () => {
    // 例子不能再用 colorAccent：Spec-D D0/D3 之后它已经配了中文名，见上面那条。
    // 挑一个后端哪天可能加的第 9 个旋钮，行为要求不变：显示原始键名而不是抛错或返回空串。
    const brandNew: ThemeTokenField = { key: 'colorBrandDark', kind: 'COLOR', min: 0, max: 0 }
    expect(designTokenLabel(brandNew.key)).toBe('colorBrandDark')
    expect(designTokenPlaceholder(brandNew.key)).toBeUndefined()
  })

  it('品牌辅助色（前采需求单里那支 VI 辅助色）有中文名与示例值', () => {
    expect(designTokenLabel('colorAccent')).toBe('强调色')
    expect(designTokenPlaceholder('colorAccent')).toBe('#ff6b35')
  })
})

/**
 * theme_json → CSS 变量的映射只此一处（portalTheme.THEME_VARS），访客页与搭建器预览共用它。
 * 这里钉的是「辅助色真的落成了变量」：没这一条，超管在前采单里填的 #ff6b35 就会死在接口里。
 */
describe('theme_json 落到 CSS 变量', () => {
  it('colorAccent 映射成 --portal-color-accent', () => {
    expect(themeVars({ colorAccent: '#ff6b35' })).toEqual({ '--portal-color-accent': '#ff6b35' })
  })

  it('主色与辅助色同时下发时各走各的变量，不互相覆盖', () => {
    expect(themeVars({ colorPrimary: '#1677ff', colorAccent: '#ff6b35' })).toEqual({
      '--portal-color-primary': '#1677ff',
      '--portal-color-accent': '#ff6b35'
    })
  })

  it('没下发辅助色时不写内联变量——观感由 portal-tokens.less 里「accent = primary」那条别名兜住', () => {
    expect(themeVars({ colorPrimary: '#1677ff' })).toEqual({ '--portal-color-primary': '#1677ff' })
    expect(themeVars(undefined)).toEqual({})
  })
})

/**
 * 字体这两个旋钮（Spec-M D6）：后端认的是标识，栈只在这一份里翻译。
 *
 * 这条对账是跨仓的：`FONT_STACKS` 的键必须与后端 `LayoutValidator.FONT_OPTIONS` 的 value
 * 逐字相同。后端那份的值域在这里对不上时，两种坏法都静默——后端认得出而前端翻不出
 * （访客页回落到默认栈，界面却显示「已选宋体」），或者前端多出一档而校验器拒收
 * （存进去就报「不支持的值」）。所以两份都要列全，缺一即红。
 */
describe('字体标识落到 font-family', () => {
  const BACKEND_FONT_IDS = ['system-sans', 'source-han-sans', 'pingfang', 'system-serif', 'songti']

  it('前端这份栈的键与后端那份枚举逐字相同（对账见 LayoutValidator.FONT_OPTIONS）', () => {
    expect(Object.keys(FONT_STACKS).sort()).toEqual([...BACKEND_FONT_IDS].sort())
  })

  it('标识翻译成栈，标题与正文各走各的变量', () => {
    expect(themeVars({ fontHeading: 'songti', fontBody: 'source-han-sans' })).toEqual({
      '--portal-font-heading': FONT_STACKS.songti,
      '--portal-font-body': FONT_STACKS['source-han-sans']
    })
  })

  it('认不出的标识绝不下发：值会变成 CSS 里的 font-family，原样拼就等于放开任意样式', () => {
    expect(themeVars({ fontBody: '18px Evilel, url(http://x)' })).toEqual({})
  })

  it('标题字体与正文字体有中文名', () => {
    expect(designTokenLabel('fontHeading')).toBe('标题字体')
    expect(designTokenLabel('fontBody')).toBe('正文字体')
  })
})
