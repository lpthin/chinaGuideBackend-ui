import type { PageResult } from '../types/article'

/**
 * 给分页读口的桩现拼一份真形状（M-P74）。
 *
 * 为什么要有这一份：这些屏的接口回包从「一根数组」换成 `PagedRead` 那一形之后，
 * 桩若还按旧的写（或只补 `records` 一格），界面读 `records` 拿到 undefined，
 * 而 `as any` 会把这一眼看不见的不匹配糊过去——测照样绿，屏上是空的。
 * 成因那两格在这里给 null，意思是「这一发后端答了：有行，不需要解释空」。
 */
export function pagedResult<T>(records: T[]): PageResult<T> {
  return {
    records,
    total: records.length,
    page: 1,
    size: Math.max(records.length, 1),
    pages: 1,
    emptyReason: null,
    emptyLine: null,
  }
}
