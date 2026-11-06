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

/**
 * 「站点内容」这一组里已经收进令牌的页面不许再抄的十六进制。
 * 这份清单不是色板：每一支都是在这些页的 style 块里真出现过、且已经有令牌对应的那几支
 * （正文 → --admin-text-*，语义 → --admin-warning-text / --admin-danger-text，主色 → --admin-primary）。
 */
const BANNED_HEXES = ['#8c8c8c', '#1a1a1a', '#595959', '#faad14', '#ff4d4f', '#1890ff', '#52c41a', '#36cfc9', '#95de64', '#bfbfbf']

/** 注释里出现这些字面是允许的（注释讲的正是「原来抄的是哪一支」），判的是生效的那几行 */
function withoutComments(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
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

  it('语义色的令牌自己得指着 theme.ts，且站点内容那四页不再抄十六进制（Spec-Q P1）', () => {
    const less = sourceOf('src/styles/admin-tokens.less').replace(/\/\*[\s\S]*?\*\//g, '')
    const tokenValue = (name: string) =>
      (less.match(new RegExp(`${name}:\\s*([^;]+);`)) || [])[1]?.trim()
    // 令牌若指向另一支抄来的色，「单源」只是把抄写挪了个地方
    expect(tokenValue('--admin-warning-text')).toBe(ADMIN_THEME_TOKEN.colorWarning)
    expect(tokenValue('--admin-danger-text')).toBe(ADMIN_THEME_TOKEN.colorError)

    for (const file of [
      'src/views/portal/BannerManageView.vue',
      'src/views/portal/JobManageView.vue',
      'src/views/portal/StoreManageView.vue',
      'src/views/portal/ShowcaseManageView.vue'
    ]) {
      const raw = sourceOf(file)
      // P1 之后连模板里那三张统计卡的渐变底色一起没了（§4.1 收成一条读数），
      // 所以这一条从「只看 style 块」升级成「整页都不许再抄色」——升级的另一半理由是
      // 旧范围放过的那一批恰好就是被点名要拆掉的那三张卡。
      const body = withoutComments(raw)
      for (const banned of BANNED_HEXES) {
        expect(body, `${file} 里不该再出现 ${banned}：正文色只剩 --admin-text-*，语义色只剩 --admin-warning-text / --admin-danger-text`).not.toContain(banned)
      }
      expect(body, `${file} 里不该再有 linear-gradient 的装饰底：读数卡已收成一条 countLine`).not.toContain('linear-gradient')
      expect(body, `${file} 里不该再有 stat-* 那套卡片类`).not.toMatch(/class="stat-/)
    }
  })

  /**
   * P2 的三页。
   *
   * 留言与站内信是「一页一表 / 一表为主」，P1 那三条禁令整条套用（它们原来也是三张渐变统计卡）。
   * 读者互动只套前两条：那一屏的「互动总账」是十格读数，跟被拆掉的三张渐变卡是两件事——
   * 它不在那条禁令的射程里，硬套等于把有用的十格换成一行字。
   * 这一屏真正清掉的是四支抄来的色（#8c8c8c 五处 / #fafafa / #1f2937 / 无渐变）。
   */
  it('Spec-Q P2：留言与站内信套全套禁令，读者互动套色那一半', () => {
    for (const file of [
      'src/views/portal/GuestbookManageView.vue',
      'src/views/portal/MessageManageView.vue'
    ]) {
      const body = withoutComments(sourceOf(file))
      for (const banned of BANNED_HEXES) {
        expect(body, `${file} 里不该再出现 ${banned}`).not.toContain(banned)
      }
      expect(body, `${file} 里不该再有 linear-gradient 的装饰底：读数卡已收成一条 countLine`).not.toContain('linear-gradient')
      expect(body, `${file} 里不该再有 stat-* 那套卡片类`).not.toMatch(/class="stat-/)
    }

    const interaction = withoutComments(sourceOf('src/views/workspace/InteractionView.vue'))
    for (const banned of BANNED_HEXES) {
      expect(interaction, `读者互动那一屏不该再出现 ${banned}`).not.toContain(banned)
    }
    // 这一屏本来就没有渐变底，留着这一条是防「以后又加一张渐变卡」
    expect(interaction).not.toContain('linear-gradient')
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

  it('中文字体栈：antd 与 less 两份必须同值，而且真的带中文字体（Spec-Q P0）', () => {
    // 病灶：全站没设过字体，body 的计算值就是浏览器默认的 sans-serif；
    // 而 antd 4 的 CSS-in-JS 按组件元素各写一条 font-family，所以只挂 `body{...}` 那一层
    // 对表格头 / 按钮 / 表单标签根本不生效（2026-11-06 在门店页 7 个采样点实量，全部仍是 antd 那支）。
    const less = sourceOf('src/styles/admin-tokens.less').replace(/\/\*[\s\S]*?\*\//g, '')
    const fromLess = (less.match(/--admin-font-family:\s*([\s\S]*?);/) || [])[1] ?? ''
    const fromToken = ADMIN_THEME_TOKEN.fontFamily
    // 两份都得真含中文字体：只写 -apple-system / Arial 那一套，中文照样落到 sans-serif 兜底，
    // 名字写错一档（比如少一个 'SC'）不会报错，只会静默退回默认字面。
    for (const stack of [fromLess, fromToken]) {
      expect(stack).toMatch(/PingFang SC/)
      expect(stack).toMatch(/Microsoft YaHei/)
    }
    // 同值，不是「都在」：这两处一份喂 antd、一份喂页面自己写的裸元素，漂开就是下一个「两支蓝」
    const names = (s: string) =>
      s
        .replace(/\s+/g, ' ')
        .split(',')
        .map(x => x.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    expect(names(fromToken)).toEqual(names(fromLess))
  })
})
