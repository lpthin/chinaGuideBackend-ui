import { describe, it, expect, beforeEach } from 'vitest'
import { routes } from '../../router'
import {
  OPEN_GROUPS_STORAGE_KEY,
  SIDER_COLLAPSED_STORAGE_KEY,
  applyOpenKeysChange,
  domainOfGroup,
  flattenMenuEntries,
  initialOpenGroups,
  normalizeMenuQuery,
  normalizeOpenGroups,
  openKeysForDomain,
  readStoredOpenGroups,
  readStoredSiderCollapsed,
  searchMenuHits,
  withGroupOpen,
  writeStoredOpenGroups,
  writeStoredSiderCollapsed
} from '../navState'
import {
  MENU_GROUPS,
  MENU_TOP_ROUTE,
  bottomMenuLeaf,
  buildMenuSections,
  collectMenuLeaves,
  findLeaf,
  type MenuVisibility
} from '../workspaceMenu'

/**
 * 导航开合状态与菜单搜索（Spec-H H-1b / H-1c / H-2 / Q3-a）。
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

/**
 * 菜单搜索（Spec-H H-2 / Q10-a）。
 *
 * 这里喂的是**真路由表摊出来的条目**，不是手写的假数据：H-2 的判据是「输入「引用」→ 只剩含"引用"的项 + 其组名」，
 * 这句话只有拿真实菜单量才算数（假数据能造出任何想过的结果）。
 * 视图那一侧的用例只钉「真打字 → 界面换成命中列表 → 点了跳得过去 → 开合表没被动过」。
 */
const EVERYONE: MenuVisibility = { isSuperAdmin: true, hasPermission: () => true, openContentEntries: null }

function realEntries() {
  const leaves = collectMenuLeaves(routes)
  const sections = buildMenuSections(leaves, EVERYONE)
  return flattenMenuEntries(
    sections,
    findLeaf(MENU_TOP_ROUTE, leaves),
    // H-6 之后下方那颗不是固定一条路由，而是「这个人该看到的那颗」：
    // EVERYONE 是超管 ⇒ 队列。搜索列表里出现的下方那一条，就是界面上那一条。
    bottomMenuLeaf(leaves, EVERYONE)
  )
}

describe('navState 菜单搜索', () => {
  it('摊平后的条目 = 分组里的每一项 + 上下两个固定项，一条不多一条不少', () => {
    const leaves = collectMenuLeaves(routes)
    const sections = buildMenuSections(leaves, EVERYONE)
    const grouped = sections.reduce((sum, section) => sum + section.groups.reduce((s, g) => s + g.items.length, 0), 0)
    const entries = realEntries()
    expect(entries).toHaveLength(grouped + 2)
    // 键不许撞：撞了就是「同一个地址在搜索结果里出现两次」，与「菜单不手抄第二份」同一条病
    expect(new Set(entries.map(entry => entry.key)).size).toBe(entries.length)
    // 每一项都带着自己的组名（界面上「命中项 + 其组名」靠这一列）
    // H-6：超管下方那颗现在是「平台工单队列」，队列也不在组表里了 ⇒ 它和工作台一样没有组名
    expect(entries.filter(entry => !entry.groupLabel).map(entry => entry.label)).toEqual(['工作台', '平台工单队列'])
    // 摊平顺序 = 界面顺序：组表顺序在前，固定项一头一尾
    expect(entries[0].key).toBe('dashboard')
    expect(entries[entries.length - 1].key).toBe('portal/support-queue')
    const groupOrder = Array.from(new Set(entries.map(entry => entry.groupKey).filter(Boolean)))
    expect(groupOrder).toEqual(MENU_GROUPS.map(group => group.key))
  })

  it('H-6：搜索列表里的下方那一条跟着角色走，不是写死的那颗', () => {
    // 同一个函数、同一个夹具，换成租户视图（只有 submit 码）时尾部那条就该是「联系平台」：
    // 命中集合来自界面渲染的那几项，视图换了它就跟着换。
    const leaves = collectMenuLeaves(routes)
    const tenant: MenuVisibility = {
      isSuperAdmin: false,
      hasPermission: code => code === 'portal:ticket:submit',
      openContentEntries: null
    }
    const entries = flattenMenuEntries(
      buildMenuSections(leaves, tenant),
      findLeaf(MENU_TOP_ROUTE, leaves),
      bottomMenuLeaf(leaves, tenant)
    )
    expect(entries[entries.length - 1].key).toBe('portal/support')
    // 租户那一项在菜单上叫「联系平台」，页面自己的词是「提交工单」——搜「工单」得找得到它，
    // 靠的就是 H-6 补进 meta.desc 的那句（命中面 = 项名 + 说明，§4.2 规则 4）
    expect(searchMenuHits(entries, '工单').map(hit => hit.key)).toEqual(['portal/support'])
    // 超管视角下「工单」这个词命中的是队列 + 改版工单，租户一颗都看不到队列
    expect(searchMenuHits(realEntries(), '工单').map(hit => hit.key))
      .toEqual(['portal/tickets', 'portal/support-queue'])
  })

  it('判据那一档：输入「引用」只剩含「引用」的项，且带得出它属于哪一组', () => {
    const hits = searchMenuHits(realEntries(), '引用')
    expect(hits.length).toBeGreaterThan(0)
    // 「只剩含引用的项」：命中的每一条，项名里都得真有这两个字（组说明不参与命中，见 searchMenuHits 的注释）
    hits.forEach(hit => expect(hit.label).toContain('引用'))
    expect(hits.map(hit => hit.key)).toEqual(['portal/citations', 'portal/citation-probes'])
    expect(hits.map(hit => hit.reason)).toEqual(['item', 'item'])
    // 组名跟着出来，用户才知道这两条各在哪一组（一个租户看、一个超管看）
    expect(hits.map(hit => hit.groupLabel)).toEqual(['效果与经营', '平台质量'])
    expect(hits.map(hit => hit.domain)).toEqual(['tenant', 'platform'])
  })

  it('输入组名 = 找到这一组：带出它的全部项，`reason` 记的是组命中', () => {
    const hits = searchMenuHits(realEntries(), '计费')
    expect(hits.length).toBeGreaterThan(1)
    expect(hits.every(hit => hit.groupLabel === '计费')).toBe(true)
    expect(hits.every(hit => hit.reason === 'group')).toBe(true)
    // 顺序仍是界面顺序（组表 + 组内路由定义顺序），不是 Map 的插入顺序
    const entries = realEntries()
    const indexes = hits.map(hit => entries.findIndex(entry => entry.key === hit.key))
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right))
  })

  it('被砍进 tooltip 的那半句还能搜到（Q5-a：说明换了地方，没从检索路径上消失）', () => {
    // 「热词库（搜索联想）」在 Q5-a 之后项名只剩「热词库」，括号那半句进了 meta.desc。
    // 搜索只认项名的话，「搜索联想」这个词就等于再也没人能找到这一项。
    const hits = searchMenuHits(realEntries(), '搜索联想')
    expect(hits.map(hit => hit.label)).toEqual(['热词库'])
    expect(hits[0].tip).toContain('搜索联想')
  })

  it('空输入与只有空格 = 没在搜；对大小写与首尾空格不敏感', () => {
    expect(normalizeMenuQuery('')).toBe('')
    expect(normalizeMenuQuery('   ')).toBe('')
    expect(searchMenuHits(realEntries(), '')).toEqual([])
    expect(searchMenuHits(realEntries(), '   ')).toEqual([])
    expect(searchMenuHits(realEntries(), '  引用 ')).toEqual(searchMenuHits(realEntries(), '引用'))
    // 英文那档同样不看大小写（「站点设置」的说明里写着 SEO/GEO）
    const upper = searchMenuHits(realEntries(), 'SEO')
    expect(upper.map(hit => hit.label)).toEqual(['站点设置'])
    expect(searchMenuHits(realEntries(), 'seo')).toEqual(upper)
  })

  it('搜不到就是搜不到，返回空表交给界面明说（不许拿相近的项凑数）', () => {
    expect(searchMenuHits(realEntries(), '一定不存在的栏目名字')).toEqual([])
  })
})
