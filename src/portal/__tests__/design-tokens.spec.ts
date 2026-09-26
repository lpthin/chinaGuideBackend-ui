import { describe, it, expect } from 'vitest'
import { designTokenLabel, designTokenPlaceholder } from '../designTokens'
import { themeVars } from '../blocks/portalTheme'
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
