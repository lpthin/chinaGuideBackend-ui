import { describe, it, expect, beforeEach } from 'vitest'
import {
  OPEN_GROUPS_STORAGE_KEY,
  SIDER_COLLAPSED_STORAGE_KEY,
  applyOpenKeysChange,
  domainOfGroup,
  initialOpenGroups,
  normalizeOpenGroups,
  openKeysForDomain,
  readStoredOpenGroups,
  readStoredSiderCollapsed,
  withGroupOpen,
  writeStoredOpenGroups,
  writeStoredSiderCollapsed
} from '../navState'
import { MENU_GROUPS } from '../workspaceMenu'

/**
 * 导航开合状态（Spec-H H-1b / H-1c / Q3-a）。
 *
 * 这一层单独成文件、单独成档用例的原因：视图里有两个 `<a-menu>`（租户段、平台段），
 * antd 每次 `update:openKeys` 只吐自己那一段的键。这个坑在 jsdom 里靠 stub 量不出来
 * （stub 不会自己发事件），所以把合并规则写成纯函数在这里钉死，真浏览器那侧只复核一次点击。
 */

describe('navState 组开合表', () => {
  beforeEach(() => localStorage.clear())

  it('任何来源的开合表都按 MENU_GROUPS 的顺序回写，旧键与重复键一并洗掉', () => {
    expect(normalizeOpenGroups(['billing', 'content', 'content', 'alert', 'no-such-group']))
      .toEqual(['content', 'billing'])
    // 顺序不来自点击先后：同一批键换个体进来写，落盘仍是组表顺序
    expect(normalizeOpenGroups(['system', 'knowledge', 'build']))
      .toEqual(['knowledge', 'build', 'system'])
  })

  it('每一组都认得自己属于哪一段，段里一颗不漏', () => {
    MENU_GROUPS.forEach(group => {
      expect(domainOfGroup(group.key)).toBe(group.domain)
    })
    expect(domainOfGroup('alert')).toBeNull()
    expect(openKeysForDomain(['content', 'article', 'billing', 'system'], 'tenant'))
      .toEqual(['content', 'article'])
    expect(openKeysForDomain(['content', 'article', 'billing', 'system'], 'platform'))
      .toEqual(['billing', 'system'])
  })

  it('一段的事件只覆盖那一段：另一段已开的组原样留着', () => {
    const before = ['article', 'billing']
    // 租户段用户点开「AI 写稿」，antd 吐回来的只有租户段的键（这里连 billing 都不认识）
    expect(applyOpenKeysChange(before, 'tenant', ['content'])).toEqual(['content', 'billing'])
    // 租户段把最后一组也收起 → 空数组，但不能顺手关掉平台段
    expect(applyOpenKeysChange(before, 'tenant', [])).toEqual(['billing'])
    // 平台段同理
    expect(applyOpenKeysChange(before, 'platform', ['build', 'billing'])).toEqual(['article', 'build', 'billing'])
  })

  it('打开某一组是幂等的，不认识的组键不会凭空冒出来', () => {
    expect(withGroupOpen(['content'], 'content')).toEqual(['content'])
    expect(withGroupOpen([], 'site-effect')).toEqual(['site-effect'])
    expect(withGroupOpen(['billing'], 'alert')).toEqual(['billing'])
    expect(withGroupOpen(['billing'], '')).toEqual(['billing'])
  })

  it('默认策略：没存过只开当前那一组；存过就原样还给用户，连「全收起」也算数', () => {
    expect(initialOpenGroups(null, 'knowledge')).toEqual(['knowledge'])
    expect(initialOpenGroups(null, '')).toEqual([])
    expect(initialOpenGroups(['system', 'content'], 'knowledge')).toEqual(['content', 'system'])
    // 判据「手动收起 3 个组 → 刷新仍是收起态」：当前组在那 3 个里时也不许被默认策略拽开
    expect(initialOpenGroups([], 'knowledge')).toEqual([])
  })

  it('localStorage 往返：脏数据、旧键、空表三种形状都不许把导航弄坏', () => {
    expect(readStoredOpenGroups()).toBeNull()
    writeStoredOpenGroups(['build', 'content'])
    expect(JSON.parse(localStorage.getItem(OPEN_GROUPS_STORAGE_KEY) as string)).toEqual(['content', 'build'])
    expect(readStoredOpenGroups()).toEqual(['content', 'build'])

    localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, '{这不是 JSON')
    expect(readStoredOpenGroups()).toBeNull()
    localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, '"content"')
    expect(readStoredOpenGroups()).toBeNull()
    // 整串都是上一版组表的旧键 ⇒ 当没存过，让默认策略重新接管
    localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(['alert', 'operation']))
    expect(readStoredOpenGroups()).toBeNull()
    // 空表是「用户把所有组都收起了」，不是「没存过」
    localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify([]))
    expect(readStoredOpenGroups()).toEqual([])
  })

  it('整栏折叠那位只记「人按了那下」，存的是 1/0', () => {
    expect(readStoredSiderCollapsed()).toBe(false)
    writeStoredSiderCollapsed(true)
    expect(localStorage.getItem(SIDER_COLLAPSED_STORAGE_KEY)).toBe('1')
    expect(readStoredSiderCollapsed()).toBe(true)
    writeStoredSiderCollapsed(false)
    expect(readStoredSiderCollapsed()).toBe(false)
  })
})
