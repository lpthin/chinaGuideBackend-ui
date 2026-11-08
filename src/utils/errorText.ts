/**
 * 读失败文案的唯一出处（SPEC-UI-7 U1）。
 *
 * 5 类：网络断 / 超时 / 权限不足 / 登录失效 / 服务异常（含数据异常）。
 * 每类固定三句：**发生了什么（happened）、可以做什么（canDo）、要不要找人（askHelp）**。
 *
 * 页面不再各写各的：`describeHttpError` 只从这里取「发生了什么」，
 * `StateBlock` / `EmptyListHint` / `DataTable` 也只从这里取「下一步」。
 * 后端 `message` 仍优先，但只顶替 happened 这一格——它说的是哪件事，
 * 不该把「下一步怎么办」也一起挤掉。
 */
export type ErrorKind = 'offline' | 'timeout' | 'forbidden' | 'unauthorized' | 'server'

export interface ErrorAdvice {
  happened: string
  canDo: string
  askHelp: string
}

export const ERROR_COPY: Record<ErrorKind, ErrorAdvice> = {
  offline: {
    happened: '无法连接服务器，请确认后端已启动',
    canDo: '确认网络可用后点重试；一直连不上就先别反复点。',
    askHelp: '一直连不上：把下面的诊断信息发给管理员。',
  },
  timeout: {
    happened: '请求超时，服务处理时间较长，请稍后重试',
    canDo: '稍等片刻再点重试；数据量大的操作可以缩小范围。',
    askHelp: '反复超时：把诊断信息发给管理员，请他看看服务处理时间。',
  },
  forbidden: {
    happened: '没有权限执行该操作',
    canDo: '换一个有权限的账号，或请管理员开通这项权限。',
    askHelp: '不确定该找谁：复制下面的诊断信息发给管理员。',
  },
  unauthorized: {
    happened: '登录状态已失效，请重新登录',
    canDo: '点「重新登录」，登录后会自动回到这一页。',
    askHelp: '登录后仍提示失效：把诊断信息发给管理员。',
  },
  server: {
    happened: '服务器处理失败，请稍后重试或联系管理员',
    canDo: '先点重试；只读列表会自动再试一次，写入操作不会自动重试。',
    askHelp: '重试两次仍失败：先别急，把下面的诊断信息发给管理员。',
  },
}

/** 读口连续失败 2 次后的那句话（U3）：比再点一次重试更有用 */
export const REPEAT_FAILURE_HINT = '先别急：已经连续失败 2 次了。把下面的诊断信息发给管理员，比反复点重试更快。'

/**
 * 按「人话文案」反向归类。
 *
 * 状态码在 `describeHttpError` 里已经丢掉了，错误块手里只有这一句；
 * 归类只认 5 类里那几句的特征词，认不出来就返回 null——宁可回落到通用句，
 * 也不要把「请先选择客户」这种业务提示说成「服务异常」。
 */
const KIND_PATTERNS: Array<{ kind: ErrorKind; pattern: RegExp }> = [
  { kind: 'forbidden', pattern: /没有权限|权限不足|无权/ },
  { kind: 'unauthorized', pattern: /登录状态已失效|重新登录|登录已过期|未登录/ },
  { kind: 'timeout', pattern: /超时|timeout/i },
  { kind: 'offline', pattern: /无法连接|连不上|网络|Network Error/i },
  { kind: 'server', pattern: /服务器处理失败|服务异常|服务暂时不可用|后端服务不可用|后端响应超时|请求失败（HTTP/ },
]

export function errorKindOfText(text: string | null | undefined): ErrorKind | null {
  if (!text) return null
  const hit = KIND_PATTERNS.find(({ pattern }) => pattern.test(text))
  return hit ? hit.kind : null
}

/** 这一句人话属于哪一类；认不出来返回 null，调用方自己决定回落 */
export function errorAdviceOfText(text: string | null | undefined): ErrorAdvice | null {
  const kind = errorKindOfText(text)
  return kind ? ERROR_COPY[kind] : null
}

/**
 * 403 的「复制诊断信息」（U2）：用户报障时能直接贴一段完整的，
 * 不需要复现、也不需要他描述自己点了什么。
 */
export function buildDiagnosticText(
  humanText: string,
  rawDetail?: string | null,
  options: { at?: Date; route?: string } = {}
): string {
  const route = options.route
    ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '')
  const at = options.at ?? new Date()
  return [
    `错误：${humanText || '（无）'}`,
    `页面：${route || '（未知）'}`,
    `时间：${at.toLocaleString('zh-CN', { hour12: false })}`,
    `原文：${rawDetail || '（无）'}`,
  ].join('\n')
}
