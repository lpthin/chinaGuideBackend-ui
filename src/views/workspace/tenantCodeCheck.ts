/**
 * 租户代码「失焦就地查重」那一格的状态形状（M-P44 拍板①）。
 *
 * 抽成纯函数只有一个理由：这一格要说出口的三档（占用 / 可用 / 查不到）是整个功能的判据，
 * 挂在 `.vue` 里就只剩源码对账测得着，而它对「读不到时不许念成可用」这一条恰恰测不动。
 *
 * 两档故意不提示：
 * - `available`：一栏没出错不需要表扬，摆个绿勾反而让人以为这栏还会拦人；
 * - `idle`：还没查（或刚把内容改了回去）。
 *
 * `unreachable` 走 warning 而不是成功——查重口挂了、后端没回话、网络断了，界面唯一能诚实说的是
 * 「这一发没查到答复」，把结论留给保存时后端那一发真校验（它拒的那句话与本档同源，见 `CODE_EXISTS_MESSAGE`）。
 */
export type TenantCodeCheckState = 'idle' | 'checking' | 'available' | 'taken' | 'unreachable' | 'invalid'

export interface TenantCodeCheckView {
  validateStatus?: 'validating' | 'error' | 'warning'
  help?: string
}

/** 后端没回话时兜底的那一句：不说「代码已存在」，因为这一发根本没问到答案 */
export const TAKEN_FALLBACK = '这个租户代码已经被用过（含已注销的历史租户），请换一个'

/**
 * 代码形状的尺（M-P45 拍板③「小写字母/数字/连字符，2~50 位」）。
 *
 * 后端 `TenantService.CODE_FORMAT_PATTERN` 是 `[a-z0-9][a-z0-9-]{0,48}[a-z0-9]`，Java 用 `matches()`
 * 整串比对；JS 的 `test()` 是不锚定的子串比对，所以这里<em>必须</em>带 `^` `$` 才是同一把尺——
 * 少了锚，`tenant_15` 会因为里头藏着 `tenant` 而被判合格。
 */
export const CODE_FORMAT_PATTERN = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/

/** 与后端 `CODE_FORMAT_MESSAGE` 同一句话（跨仓没有编译期耦合，靠现场那一趟逐字对账） */
export const CODE_FORMAT_MESSAGE = '租户代码只能用小写字母、数字和连字符，2~50 位，首尾不能是连字符'

export function describeTenantCodeCheck(
  state: TenantCodeCheckState,
  message = '',
): TenantCodeCheckView {
  switch (state) {
    case 'checking':
      return { validateStatus: 'validating', help: '正在查这个代码有没有被用过…' }
    case 'invalid':
      // 形状就不对的代码不必去问占用：那一发问出来的答案只会把两句人话挤成一句
      return { validateStatus: 'error', help: message.trim() || CODE_FORMAT_MESSAGE }
    case 'taken':
      return { validateStatus: 'error', help: message.trim() || TAKEN_FALLBACK }
    case 'unreachable':
      return {
        validateStatus: 'warning',
        help: `这一发没查到答复，先照常填：点保存时仍会校验${message.trim() ? `（${message.trim()}）` : ''}`,
      }
    default:
      return {}
  }
}
