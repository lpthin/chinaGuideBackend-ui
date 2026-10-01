import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADMIN_THEME_TOKEN } from '../theme'

/**
 * 主题单源的守卫（Spec-F §9.2-1，浏览器 UI 验收 P6-J 之后补的）。
 *
 * 为什么要有这一档：2026-09-30 那轮逐页逐分辨率验收在真浏览器里量到**同一屏两支蓝**——
 * 主按钮与链接是 rgb(24, 144, 255)（= 本文件 colorPrimary #1890ff），
 * 而 a-alert / a-step / a-radio 这类跟着 info 语义走的控件算出来是 rgb(22, 119, 255)。
 * 根因不在我们身上：antd 的 seed 里 `colorInfo` 是**独立写死的一支 #1677ff**，不跟 colorPrimary 走
 * （`es/theme/themes/seed.js` 定 seed，`shared/genColorMapToken.js` 再按它单独生成色板）。
 * 所以「挂上 config-provider 就等于全站一支蓝」是错的直觉——必须显式把 colorInfo 也钉上。
 * 这一条断言钉的就是那个显式动作：以后谁把 colorInfo 删了或改成别支，这里先红。
 */

function sourceOf(relative: string): string {
  try {
    return readFileSync(join(process.cwd(), relative), 'utf8')
  } catch {
    throw new Error(`源文件读不到（${relative}）：这一档是照源码断言的，文件挪了就把这里一起改掉`)
  }
}

describe('后台主题单源（styles/theme.ts）', () => {
  it('info 语义必须并到主色上：两支蓝等于同一屏两个主色', () => {
    expect(ADMIN_THEME_TOKEN.colorInfo).toBe(ADMIN_THEME_TOKEN.colorPrimary)
  })

  it('控件尺寸跟 antd v4 默认一致，挂 token 那天不许让控件跳动', () => {
    expect(ADMIN_THEME_TOKEN.borderRadius).toBe(6)
    expect(ADMIN_THEME_TOKEN.fontSize).toBe(14)
    expect(ADMIN_THEME_TOKEN.controlHeight).toBe(32)
  })

  it('main.ts 得真的把这份 token 挂进 ConfigProvider', () => {
    const main = sourceOf('src/main.ts')
    expect(main).toContain('ADMIN_THEME_TOKEN')
    expect(main).toMatch(/theme\s*:\s*\{[\s\S]{0,80}token\s*:\s*\{\s*\.\.\.ADMIN_THEME_TOKEN\s*\}/)
  })

  it('机会面板选中态那两格走主色的色板，不再抄 antd 默认那支蓝', () => {
    // 验收量到的第二形：这一格的底色与边框是硬编码的 #e6f4ff / #91caff
    // （= #1677ff 的 blue-1 / blue-3），而全站主色是 #1890ff ⇒ 选中态跟其它地方差一档。
    const panel = sourceOf('src/views/geocampaign/GeoOpportunityPanel.vue')
    const from = panel.indexOf('&__action--on')
    expect(from).toBeGreaterThan(-1)
    // 先把注释摘掉再断言：这一段里就写着「原来抄的是 #e6f4ff / #91caff」，
    // 留着注释等于自己打自己——这条要钉的是**生效的那两行样式**，不是解释它的说明。
    const block = panel
      .slice(from, panel.indexOf('}', from))
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(block).not.toMatch(/#e6f4ff|#91caff|#1677ff/)
    expect(block).toMatch(/#e6f7ff/)
  })

  it('折叠轨靠 SubMenu 自己收，不再给分组标题打 height:0 的补丁', () => {
    // Spec-H H-1d：这条以前钉的是「那条 CSS 补丁还在」（病灶 = antd 折叠态只藏菜单项文字、不藏组标题，
    // 于是 55px 轨道上浮着一列没有归属的组名，375 档实测 16 个标题 h=0 才勉强能看）。
    // 组换成 `<a-sub-menu>` 之后那个 DOM 节点整体不存在了，补丁连同病灶一起删；
    // 这条改成钉「别退回 ItemGroup、别把 openKeys 的受控写掉」——退回去就等于把折叠轨重新弄坏。
    //
    // 只能在源码上断言：jsdom 没有布局引擎。真浏览器那侧的判据是折叠态滚动 = 0 屏、轨道 11 颗图标。
    const raw = sourceOf('src/views/workspace/WorkspaceView.vue')
    // 先把注释摘掉：这一段里到处写着「原来那条 height:0 补丁」「原来用 a-menu-item-group」，
    // 留着注释判等于自己打自己——要钉的是生效的那几行，不是解释它的说明。
    const view = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(view).not.toMatch(/ant-menu-item-group-title/)
    expect(view).not.toMatch(/a-menu-item-group/)
    expect(view).toMatch(/<a-sub-menu/)
    // 受控开合：没有 :open-keys 的话，localStorage 里那份偏好就只是写进去好看，刷新照样回到默认
    expect(view).toMatch(/:open-keys=/)
    expect(view).toMatch(/@update:open-keys=/)
  })
})
