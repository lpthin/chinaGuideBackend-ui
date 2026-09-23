/**
 * 区块组件的取数约定。
 *
 * 后端 PortalPageResolver 已把 {"$data":"services"} 解析成真实数据，取不到就是 null，
 * 所以这里不需要再判断绑定语法，只要处理「这个槽位没数据」这一种情况：
 * 组件返回空、整块不渲染，绝不显示占位文案或假数字。
 */
import type { PortalSiteShell } from '../api/portalPublic'

export type BlockProps = Record<string, unknown>

/** 门户区块的公共入参：区块自身 props + 站点壳（页头页脚联系方式这类全站信息只有壳里有） */
export interface BlockContext {
  blockProps: BlockProps
  shell: PortalSiteShell | null
}

export type Item = Record<string, unknown>

export function text(blockProps: BlockProps | undefined | null, key: string): string {
  const value = blockProps?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function flag(blockProps: BlockProps | undefined | null, key: string, fallback = false): boolean {
  const value = blockProps?.[key]
  return typeof value === 'boolean' ? value : fallback
}

export function list(blockProps: BlockProps | undefined | null, key: string): Item[] {
  const value = blockProps?.[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is Item => entry !== null && typeof entry === 'object')
}

/** 列表项字段名各区块不同（title/name、summary/description），按顺序取第一个非空字符串 */
export function field(item: Item | undefined | null, ...keys: string[]): string {
  if (!item) return ''
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (typeof value === 'number') {
      return String(value)
    }
  }
  return ''
}

/** 有封面/图标时才渲染图片，缺图不留灰块 */
export function image(item: Item | undefined | null, ...keys: string[]): string {
  return field(item, ...keys)
}

/** 列数用类名而不是行内 style：行内样式会盖掉窄屏的响应式规则，等于把移动端锁死在配置的列数上 */
export function columnsClassOf(blockProps: BlockProps | undefined | null): string {
  const value = blockProps?.columns
  const columns = typeof value === 'number' && [2, 3, 4].includes(value) ? value : 3
  return `pb-grid--${columns}`
}
