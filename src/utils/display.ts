/**
 * 占位符常量（Spec-F §9.2-5）。这六个词各自语义唯一、不许互换（延续「一个词只指一个东西」）：
 * - PH_DASH        单元格没有值（数字/文本列的空占位，现有界面里 '—' 用了 259 处）
 * - PH_NONE        列表/集合为空，界面上确实「没有东西」
 * - PH_NOT_SET     该填的字段人没填（配置项）
 * - PH_NOT_MEASURED 系统本应测但没测到（§9.6：没测过的指标显示「未取到」并说明为什么）
 * - PH_NOT_RUN     任务一次都没跑过（区别于跑过但失败）
 * - PH_NOT_COVERED 追踪题里本站没有页面对得上的题（§5 问题覆盖率的反面）
 */
export const PH_DASH = '—'
export const PH_NONE = '暂无'
export const PH_NOT_SET = '未填写'
export const PH_NOT_MEASURED = '未取到'
export const PH_NOT_RUN = '未跑过'
export const PH_NOT_COVERED = '未覆盖'
