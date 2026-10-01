import type { Component } from 'vue'
import { MENU_GROUPS, type MenuDomain, type MenuLeaf, type MenuSection } from './workspaceMenu'

/**
 * 导航的「开合状态 + 搜索」——纯函数 + localStorage，单独一个文件是为了能被用例直接调（Spec-H H-1b/H-1c/H-2）。
 *
 * 为什么状态不写在 `WorkspaceView.vue` 里：那段模板有两个 `<a-menu>`（租户段一个、平台段一个），
 * antd 的 `update:openKeys` 每次只把**那一个菜单**自己认识的键吐回来。直接把它当成全局开合表，
 * 后果是「在租户段点开一组，平台段已开的组全被这次事件抹掉」——两个菜单互相覆盖。
 * 所以这里按段（domain）合并：本次事件覆盖该段的键，另一段的键原样保留。
 *
 * 顺序也在这里定死：一律按 `MENU_GROUPS` 的定义顺序回写，不靠点击先后，
 * 否则 localStorage 里那串会随用户操作顺序漂移，用例没法钉。
 */

export const OPEN_GROUPS_STORAGE_KEY = 'nav_open_groups'
export const SIDER_COLLAPSED_STORAGE_KEY = 'nav_sider_collapsed'

const GROUP_ORDER = MENU_GROUPS.map(group => group.key)

/** 这个组键属于哪一段；不认识 = null（组表改过、localStorage 里留着旧键都走这里） */
export function domainOfGroup(key: string): MenuDomain | null {
  return MENU_GROUPS.find(group => group.key === key)?.domain ?? null
}

/**
 * 把任意来源的开合表洗成「只留还存在的组、按组表顺序、去重」。
 *
 * 这一条是持久化的安全垫：删组、改组键之后，老用户 localStorage 里那串旧键不能把菜单弄坏，
 * 也不能因为「找不到这个组」而在两个段之间乱跳。
 */
export function normalizeOpenGroups(keys: readonly string[]): string[] {
  const seen = new Set(keys)
  return GROUP_ORDER.filter(key => seen.has(key))
}

/** 某一段该传给 `<a-menu :open-keys>` 的那几个键（antd 只认自己子树里的键，多给也没用，按段切干净） */
export function openKeysForDomain(keys: readonly string[], domain: MenuDomain): string[] {
  return normalizeOpenGroups(keys).filter(key => domainOfGroup(key) === domain)
}

/**
 * 一次 `update:openKeys` 事件 → 新的全局开合表。
 * `nextForDomain` 是那一段自己吐回来的全部已开键，本段以它为准，另一段保持不变。
 */
export function applyOpenKeysChange(
  all: readonly string[],
  domain: MenuDomain,
  nextForDomain: readonly string[]
): string[] {
  const others = normalizeOpenGroups(all).filter(key => domainOfGroup(key) !== domain)
  return normalizeOpenGroups([...others, ...nextForDomain])
}

/** 打开某一组（幂等）：路由换到一个收起的组里时用它，用户不会看到「选中了但看不见」 */
export function withGroupOpen(all: readonly string[], key: string): string[] {
  if (!key || domainOfGroup(key) === null) return normalizeOpenGroups(all)
  return normalizeOpenGroups([...all, key])
}

/**
 * 首屏默认（H-1c）：没存过 → 只展开当前路由所在那一组；存过 → **原样**用用户那份。
 *
 * 为什么存过就不补当前组：判据是「手动收起 3 个组 → 刷新 → 仍是收起态」，
 * 而那 3 个里完全可能就有当前这一组。刷新后强制展开等于把用户刚做的选择吃掉。
 */
export function initialOpenGroups(stored: readonly string[] | null, currentGroup: string): string[] {
  if (stored) return normalizeOpenGroups(stored)
  return currentGroup ? withGroupOpen([], currentGroup) : []
}

/** 存储读写都兜住：隐私模式 / SSR / 老浏览器里 localStorage 会直接抛，导航不许因此白屏 */
function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readStoredOpenGroups(): string[] | null {
  const raw = store()?.getItem(OPEN_GROUPS_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const keys = parsed.filter(key => typeof key === 'string') as string[]
    // 存的是「用户收起了全部组」= 空数组，那是有效状态，得原样还回去；
    // 但「一串都不认识」（组表大改之后的旧键）要按没存过处理，让默认策略重新接管。
    const anyKnown = keys.some(key => domainOfGroup(key) !== null)
    if (keys.length && !anyKnown) return null
    return normalizeOpenGroups(keys)
  } catch {
    return null
  }
}

export function writeStoredOpenGroups(keys: readonly string[]): void {
  try {
    store()?.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(normalizeOpenGroups(keys)))
  } catch {
    /* 存不下就算了：开合是偏好，不是功能 */
  }
}

/** 整栏折叠偏好（Q3-a）：只有「人按了那下折叠键」才落盘，窄屏那一档是窗口决定的，不记 */
export function readStoredSiderCollapsed(): boolean {
  return store()?.getItem(SIDER_COLLAPSED_STORAGE_KEY) === '1'
}

export function writeStoredSiderCollapsed(collapsed: boolean): void {
  try {
    store()?.setItem(SIDER_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* 同上 */
  }
}

/* ══════════════ 菜单搜索（Spec-H H-2 / Q10-a）══════════════ */

/**
 * 搜索用的扁平条目。
 *
 * 为什么要从 `MenuSection` 再摊平一次：树形渲染要靠「组开着」才看得见项，
 * 而搜索要的正是「不用管它开没开」。摊平之后命中判定只看文字，跟开合表彻底无关。
 * 固定项（工作台 / 联系平台）也进来，它们没有组，`groupLabel` 留空由视图显示成「固定入口」。
 */
export interface MenuNavEntry {
  key: string
  label: string
  /** 所属组键；固定项为 '' */
  groupKey: string
  /** 所属组名；固定项为 ''，视图把它显示成「固定入口」*/
  groupLabel: string
  /** 这一项自己的补充说明（`meta.desc` → `MenuLeaf.tip`），Q5-a 之后只作为 tooltip 存在 */
  tip: string
  domain: MenuDomain | null
  icon: Component | null
}

/** 这一条是项名/项说明直接命中的，还是因为它所在的组名被命中才带出来的 */
export type MenuHitReason = 'item' | 'group'

export interface MenuNavHit extends MenuNavEntry {
  reason: MenuHitReason
}

/**
 * 两段树 + 上下固定项 → 界面上的上下顺序一份。
 * 顺序就是渲染顺序（组表顺序 → 组内路由定义顺序），搜索结果不再排第二次，
 * 免得同一次输入在两处看到不同次序。
 */
export function flattenMenuEntries(
  sections: readonly MenuSection[],
  top?: MenuLeaf | null,
  bottom?: MenuLeaf | null
): MenuNavEntry[] {
  const fromLeaf = (leaf: MenuLeaf, groupLabel = '', groupKey = ''): MenuNavEntry => ({
    key: leaf.key,
    label: leaf.label,
    groupKey,
    groupLabel,
    tip: leaf.tip ?? '',
    domain: groupKey ? domainOfGroup(groupKey) : null,
    icon: leaf.icon
  })
  const entries: MenuNavEntry[] = []
  if (top) entries.push(fromLeaf(top))
  sections.forEach(section => {
    section.groups.forEach(group => {
      group.items.forEach(leaf => {
        entries.push(fromLeaf(leaf, group.def.label, group.def.key))
      })
    })
  })
  if (bottom) entries.push(fromLeaf(bottom))
  return entries
}

/** 输入框里的字 → 归一化后的查询串；空串 = 没在搜（视图据此决定渲不渲命中列表） */
export function normalizeMenuQuery(rawQuery: string): string {
  return (rawQuery || '').trim().toLowerCase()
}

function contains(haystack: string, needle: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needle)
}

/**
 * 输入即过滤（H-2 判据：「输入「引用」→ 只剩含"引用"的项 + 其组名」）。
 *
 * 命中面是三处文字：**项名、项的补充说明（tooltip 那句）、组名**。
 * 项说明要算，是因为 Spec-H Q5-a 把「（搜索联想）」那半句从项名挪进了 tooltip——
 * 只搜项名的话，「搜索联想」这个词在界面上就再也没人能搜到，等于那句话从检索路径上消失了。
 *
 * 组说明（Q6-a 那 11 句）故意**不进**命中面：它一句命中就得把整组（最多 11 项）全带出来，
 * 界面上会混进一批不含这个词的项，用户判不出「这条为什么出现」，
 * 而判据要的正是「只剩含这个词的项」。组名命中带出整组是另一回事——那一组的名字
 * 就是用户输入的那个词（「建站」「计费」），带着它服务的项才叫「找到了这一组」。
 *
 * 项名已经命中的不重复列，`reason` 记的是最终那次归因。
 */
export function searchMenuHits(
  entries: readonly MenuNavEntry[],
  rawQuery: string
): MenuNavHit[] {
  const query = normalizeMenuQuery(rawQuery)
  if (!query) return []
  const hits = new Map<string, MenuNavHit>()
  entries.forEach(entry => {
    if (contains(entry.label, query) || contains(entry.tip, query)) {
      hits.set(entry.key, { ...entry, reason: 'item' })
    }
  })
  entries.forEach(entry => {
    if (hits.has(entry.key)) return
    if (contains(entry.groupLabel, query)) {
      hits.set(entry.key, { ...entry, reason: 'group' })
    }
  })
  // 按 entries 的原顺序出，不按 Map 的插入顺序：组命中是第二遍才补进来的，
  // 插入顺序会把「建站」那一组的项甩到列表末尾。
  return entries.filter(entry => hits.has(entry.key)).map(entry => hits.get(entry.key)!)
}
