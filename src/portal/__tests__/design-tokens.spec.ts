import { describe, it, expect } from 'vitest'
import { designTokenLabel, designTokenPlaceholder } from '../designTokens'
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
    const brandNew: ThemeTokenField = { key: 'colorAccent', kind: 'COLOR', min: 0, max: 0 }
    expect(designTokenLabel(brandNew.key)).toBe('colorAccent')
    expect(designTokenPlaceholder(brandNew.key)).toBeUndefined()
  })
})
