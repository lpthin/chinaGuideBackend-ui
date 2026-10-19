import { CODE_FORMAT_PATTERN } from './tenantCodeCheck'

/** 代码上限 50 位——与后端 `TenantService.CODE_FORMAT_PATTERN` 的量词逐字一致 */
const MAX_CODE_LENGTH = 50

/**
 * 把逐字拼音（或非中文段）拼成一根能当 DNS 标签用的串：小写、任何非 `[a-z0-9]` 的连续串一律当分隔符、
 * 首尾不留连字符、超过 50 位就截到整段再收尾。
 *
 * 这一步<em>故意</em>不做任何"懂事"的清洗：不剥「有限公司 / 科技 / Co., Ltd」这类后缀，
 * 也不换同音字。那不是归一化，是替超管决定公司叫什么——建议值本来就是给人改的。
 */
export function normalizeCodeTokens(tokens: string[]): string {
  const joined = tokens.map(token => token.toLowerCase()).join('-')
  const squashed = joined.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const capped = squashed.length > MAX_CODE_LENGTH
    ? squashed.slice(0, MAX_CODE_LENGTH).replace(/-+$/g, '')
    : squashed
  return CODE_FORMAT_PATTERN.test(capped) ? capped : ''
}

/**
 * 从租户名称推一个建议代码（M-P45 拍板①「只加本地拼音库，不外呼」）。
 *
 * 唯一的依赖 `pinyin-pro` 走动态 import：装到盘上是 1 MB 量级（`node_modules/pinyin-pro` 实测 1049 KB），
 * 而只有超管在开通表单里名称框失焦那一下才用得上，不该挂进后台主包。
 *
 * 推不出合格代码（名字全是符号、或只剩一个字母）时返回空串，<em>不</em>返回一个注定被格式闸拒掉的串——
 * 界面拿这个返回值当"要不要往格子里填"的判据。
 */
export async function suggestTenantCodeFromName(name: string): Promise<string> {
  if (!name.trim()) return ''
  const { pinyin } = await import('pinyin-pro')
  return normalizeCodeTokens(
    pinyin(name, { toneType: 'none', type: 'array', v: true, nonZh: 'consecutive' }),
  )
}
