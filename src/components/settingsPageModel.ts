/**
 * C 型「设置表单」页的判定（Spec-Q §4.1 C 型，P3 落地；与 SettingsPage.vue 同一份契约）。
 *
 * 收在这里的原因和 RecordListPage 那份不一样：这里不是排版，是「这一屏到底要人填几项」这件事。
 * 完成度读数最容易被写歪——把分母抄成一个好看的数字（33）、把「没填」和「这条不适用」混成一格，
 * 读数就变成谎报。所以分母、分子、缺的哪几项、跳到哪一格，全部由这三个纯函数从**页面声明的字段清单**算出来，
 * 页面不许另写一个数。
 */

/** 一格里要人填的一项。`done` 由页面按当前值给布尔，模板不做「看着像填了」的猜测 */
export interface SettingsField {
  /** 表单里那一列的名字（页面用它取值，也用它和表单结构对账） */
  key: string
  /** 界面上那句话，缺项清单里念的就是它，必须和表单项的 label 同一句 */
  label: string
  done: boolean
  /** 真必填才给 true（后端/保存闸会拒的那些）。可选的格子算「还差」，但不算「必填没填」 */
  required?: boolean
}

/** 一张卡 = 一组。`side` 那一列在宽屏挂右边，窄屏折回同一列（顺序按数组顺序） */
export interface SettingsGroup {
  key: string
  label: string
  fields?: SettingsField[]
  side?: boolean
  /**
   * 卡标题后面那点补充说明。为什么给它而不是让页面自己写卡头：
   * 站点设置那一屏的卡名是后端回的站点名，后面原来还跟着一个状态角标——
   * 换模板时这颗角标差点掉了，`note` 就是给它留的位置（那句中文仍来自后端词表）。
   */
  note?: string
}

export interface SettingsProgress {
  /** 声明要人填的总项数（分母） */
  total: number
  /** 其中填了的（分子） */
  filled: number
  /** 没填的，带组名，点了跳过去 */
  missing: { groupKey: string; label: string }[]
  /** 没填的必填项 */
  requiredMissing: { groupKey: string; label: string }[]
}

/** 一组里填了几项 / 共几项。没声明字段的组（只读表那种）返回 null，界面就不摆「齐几项」 */
export function groupProgress(group: SettingsGroup): { filled: number; total: number } | null {
  if (!group.fields?.length) return null
  return {
    filled: group.fields.filter(field => field.done).length,
    total: group.fields.length,
  }
}

/** 整页读数：只统计声明过的字段，一个都不猜 */
export function settingsProgress(groups: readonly SettingsGroup[]): SettingsProgress {
  const missing: { groupKey: string; label: string }[] = []
  const requiredMissing: { groupKey: string; label: string }[] = []
  let total = 0
  let filled = 0
  for (const group of groups) {
    for (const field of group.fields ?? []) {
      total += 1
      if (field.done) {
        filled += 1
        continue
      }
      missing.push({ groupKey: group.key, label: field.label })
      if (field.required) requiredMissing.push({ groupKey: group.key, label: field.label })
    }
  }
  return { total, filled, missing, requiredMissing }
}

/** 锚点 id：模板里那一排的 href 和卡片的 id 都从这一个函数来，改一处不会两边对不上 */
export function settingsAnchorId(groupKey: string): string {
  return `settings-group-${groupKey}`
}

/**
 * 读数那句话（中文只在这一处拼，页面不再抄一句）。
 *
 * `word` 只有一处要用别的说法：站点设置那一屏的格子是 AI 先填好的，
 * 页面自己写着「这一页没有任何一项是必须你来填的」——那里念「已填」会把人指向「谁没填」，
 * 念「AI 已填」才是那一屏的真事。除这一处以外都不必传。
 */
export function settingsProgressText(progress: SettingsProgress, word = '已填'): string {
  return `${word} ${progress.filled} / 共 ${progress.total} 项`
}
