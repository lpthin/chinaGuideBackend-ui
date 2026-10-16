import { describe, it, expect } from 'vitest'

/**
 * 「重置密码」这一条链在界面上的形状（W14，10-16 走查现场）。
 *
 * 起因：登录页一直念「请联系管理员重置密码」，而全仓没有任何重置口——那句话指着一条不存在的链路。
 * 后端补了 `PUT /api/admin/users/{id}/password`（只给平台超管），界面这一格要钉四件事：
 * 1. 把手真的接在处理函数上，处理函数打的是那个新端点（`adminApi.users.resetPassword`）；
 * 2. 「改自己」那一行不摆可点的把手（后端对自改回的是「请去用户中心带当前密码修改」）；
 * 3. 弹窗里如实写明「不会把对方已登录的会话踢下线」——令牌是无状态 JWT，后端没法比「密码变更时刻」，
 *    界面不写这句就等于让人以为重置完对方立刻被挡住；
 * 4. 两次输入不一致要在校验里拒，不靠后端。
 *
 * 手法照 generate-double-submit-ui.spec.ts：断言落在源码形状上，改回旧形状会当场翻红。
 * 点真把手、看真回包那一趟在现场验收里跑（见 §10.40 那条），这里不拿源码断言冒充现场。
 */

const panelSource = String(Object.values(import.meta.glob('../UsersPanel.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] ?? '')

const apiSource = String(Object.values(import.meta.glob('../../../api/workspace.ts',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] ?? '')

const loginSource = String(Object.values(import.meta.glob('../../../views/LoginView.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] ?? '')

describe('W14：用户管理的「重置密码」把手接在新端点上', () => {
  it('扫到了三个文件本身（glob 写错会让这一整份用例静默通过）', () => {
    expect(panelSource).not.toBe('')
    expect(apiSource).not.toBe('')
    expect(loginSource).not.toBe('')
  })

  it('api 层打的是 PUT /admin/users/{id}/password，报文里只有 newPassword', () => {
    expect(apiSource).toMatch(
      /resetPassword:\s*\(id:\s*number,\s*newPassword:\s*string\)\s*=>[\s\S]{0,120}?http\.put<void>\(`\/admin\/users\/\$\{id\}\/password`,\s*\{\s*newPassword\s*\}\)/,
    )
    // 这条口不接受「当前密码」——报文中出现 oldPassword 就是在演「这里能验旧密码」
    expect(apiSource.slice(apiSource.indexOf('resetPassword:'), apiSource.indexOf('resetPassword:') + 260))
      .not.toContain('oldPassword')
  })

  it('表格里摆「重置密码」把手，且直接挂具名处理函数（不是 handler 工厂，那种写法在本仓静默失效过）', () => {
    const cell = panelSource.slice(panelSource.indexOf("column.key === 'actions'"),
      panelSource.indexOf('</a-table>'))
    expect(cell).toMatch(/@click="handleResetPassword\(record\)"/)
    expect(cell).toContain('重置密码')
  })

  it('自己那一行的把手置灰，并给出去用户中心那条路', () => {
    const cell = panelSource.slice(panelSource.indexOf("column.key === 'actions'"),
      panelSource.indexOf('</a-table>'))
    expect(cell).toMatch(/:disabled="isSelf\(record\)"/)
    expect(cell).toContain('这是你自己的账号')
  })

  it('处理函数把输入的新密码原样交给 api，成功后关窗', () => {
    const fn = panelSource.slice(panelSource.indexOf('async function handlePwdSubmit()'))
    expect(fn).toMatch(/await adminApi\.users\.resetPassword\(pwdForm\.id,\s*pwdForm\.newPassword\)/)
    expect(fn).toMatch(/pwdModalVisible\.value = false/)
    // 校验没过就不许打口
    expect(fn.slice(0, 200)).toMatch(/await pwdFormRef\.value\?\.validate\(\)/)
  })

  it('弹窗如实写明「不会把已登录的会话踢下线」', () => {
    const modal = panelSource.slice(panelSource.indexOf('v-model:open="pwdModalVisible"'),
      panelSource.indexOf('</a-modal>', panelSource.indexOf('v-model:open="pwdModalVisible"')))
    expect(modal).toContain('不会把对方已经登录的会话踢下线')
    expect(modal).toContain('无状态')
  })

  it('两次输入不一致在前端校验里拒', () => {
    expect(panelSource).toMatch(/两次输入的新密码不一致/)
  })

  it('登录页那句话不再指着一条不存在的链路：点名「平台管理员」与「用户管理」', () => {
    expect(loginSource).toMatch(/请联系平台管理员在「用户管理」里重置/)
  })
})
