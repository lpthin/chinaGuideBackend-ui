/**
 * 分页读口回包里的「这一页为什么是空的」那两格（M-P50 起头，M-P74 收进一处）。
 *
 * 为什么单开一份：`PageResult` 在 `types/` 下有七份同形定义（article / billing / case /
 * knowledge / operation / portal / workspace 各自一份），这两格若逐份抄写，
 * 注释与可选性就会在某一份上漂掉——界面上表现为「这一屏永远读到 undefined」而类型照样全绿。
 */
export interface EmptyCauseFields {
  /** 这一页没行时是哪一种空（`NONE` / `NOT_VISIBLE` / `OUT_OF_RANGE`，唯一出处在后端 `EmptyResultReasons`） */
  emptyReason?: string | null
  /** 与 `emptyReason` 同源的整句中文（界面逐字念，不自己编） */
  emptyLine?: string | null
}
