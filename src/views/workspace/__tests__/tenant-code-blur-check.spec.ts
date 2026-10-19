import { describe, expect, it } from 'vitest'
import {
  CODE_FORMAT_MESSAGE,
  CODE_FORMAT_PATTERN,
  describeTenantCodeCheck,
  TAKEN_FALLBACK,
  type TenantCodeCheckState,
} from '../tenantCodeCheck'

/**
 * 租户代码「失焦就地查重」那一格（M-P44 拍板①）。
 *
 * 拍板选的是「加失焦就地查重」，界面上要说出口的只有三档，而这三档各有一条形同虚设的错法：
 * - 占用 → 必须<em>当场</em>红，且那句要念出「含已注销的历史租户」——不念这一层，人只会以为自己打错字；
 * - 可用 → 什么都不摆。上一版在这里放过一个绿勾，于是这一栏看起来像「有校验、已通过」，
 *   而它其实只查了占用一件（名称、邮箱照样是提交时才拒）；
 * - 查不到 → 不许念成可用。这一档是本格唯一会骗人的地方：读口挂了、后端没回、网络断了，
 *   界面一旦沉默，人得到的结论就是「没人占用」。
 *
 * 前两段的形状由纯函数钉；后一段（真把手、真端点、真撤结论）钉的是 `.vue` 的源码形状，
 * 手法照 `user-password-reset-ui.spec.ts`——`a-form-item` 在测试环境里是全局 stub，
 * 挂载测拿不到 help 文本，所以这里比文本，现场点真把手那一趟在浏览器验收里跑。
 */

const panelSource = String(Object.values(import.meta.glob('../TenantPanel.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] ?? '')

/**
 * `checkTenantCode` 那一段的窗口。右界必须钉死：不封右界时切片一路读到文件末尾，
 * `suggestCodeFromName` 里那一句一模一样的 `if (isEdit.value) return` 会把「这一支函数有编辑态早退」
 * 这条断言满足掉——变异检验 FD 把 351 行那道撤掉后 24 例照样全绿，现场抓到的就是这一条。
 */
const checkTenantCodeWindow = () => {
  const start = panelSource.indexOf('const checkTenantCode = async () =>')
  const end = panelSource.indexOf('const codeSuggestedOnce')
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('窗口两端没夹住 checkTenantCode 那一段（源码改名了，这条断言此刻无钉）')
  }
  return panelSource.slice(start, end)
}

describe('M-P44 拍板①：三档各说各的话', () => {
  it('占用：当场红，并把后端那句原样念出来', () => {
    const view = describeTenantCodeCheck('taken', '后端那句话')
    expect(view.validateStatus).toBe('error')
    expect(view.help).toBe('后端那句话')
  })

  it('占用但后端没给句子：兜底那句也要说清「含已注销」，不能只说「已存在」', () => {
    const view = describeTenantCodeCheck('taken', '   ')
    expect(view.validateStatus).toBe('error')
    expect(view.help).toBe(TAKEN_FALLBACK)
    expect(view.help).toContain('已注销')
  })

  it('可用：一栏没出错就不许再摆东西（绿勾也算谎报——这一栏只查了占用一件）', () => {
    for (const state of ['available', 'idle'] as TenantCodeCheckState[]) {
      expect(describeTenantCodeCheck(state)).toEqual({})
    }
  })

  it('查不到：念 warning，且整句话里不许出现「可用」二字', () => {
    const view = describeTenantCodeCheck('unreachable', '无法连接服务器，请确认后端已启动')
    expect(view.validateStatus).toBe('warning')
    expect(view.help).toContain('没查到答复')
    expect(view.help).toContain('无法连接服务器')
    expect(view.help ?? '').not.toContain('可用')
  })

  it('正在查：给 validating 形状，别让空白的等待被读成「查过了、没问题」', () => {
    const view = describeTenantCodeCheck('checking')
    expect(view.validateStatus).toBe('validating')
    expect(view.help).toContain('正在查')
  })
})

describe('M-P45 拍板③：形状不合格时代码格自己先红，不必去问占用', () => {
  it('invalid 走 error，且默认念的就是后端那一句（逐字写在这儿，跨仓没有编译期耦合）', () => {
    const view = describeTenantCodeCheck('invalid')
    expect(view.validateStatus).toBe('error')
    expect(view.help).toBe('租户代码只能用小写字母、数字和连字符，2~50 位，首尾不能是连字符')
    expect(view.help).toBe(CODE_FORMAT_MESSAGE)
  })

  it('invalid 后端给了句子时念后端那句，不念兜底', () => {
    expect(describeTenantCodeCheck('invalid', '后端那句话').help).toBe('后端那句话')
  })

  it('这一档不摆绿勾也不摆 warning：非法形状与「查不到」是两件事', () => {
    expect(describeTenantCodeCheck('invalid').validateStatus).toBe('error')
    expect(describeTenantCodeCheck('unreachable').validateStatus).toBe('warning')
  })

  it('JS 那把尺带锚：不锚定就会把 tenant_15 因为藏着 tenant 而判合格', () => {
    expect(CODE_FORMAT_PATTERN.test('tenant-15')).toBe(true)
    expect(CODE_FORMAT_PATTERN.test('ab')).toBe(true)
    expect(CODE_FORMAT_PATTERN.test('a'.repeat(50))).toBe(true)
    expect(CODE_FORMAT_PATTERN.test('a'.repeat(51))).toBe(false)
    expect(CODE_FORMAT_PATTERN.test('Tenant15')).toBe(false)
    expect(CODE_FORMAT_PATTERN.test('tenant_15')).toBe(false)
    expect(CODE_FORMAT_PATTERN.test('-tenant')).toBe(false)
    expect(CODE_FORMAT_PATTERN.test('tenant-')).toBe(false)
    expect(CODE_FORMAT_PATTERN.test('x tenant-15 y')).toBe(false)
    expect(CODE_FORMAT_PATTERN.test('a')).toBe(false)
  })

  it('TAKEN_FALLBACK 与格式那句是两句话，别混成一句（占用与非法是两种病）', () => {
    expect(TAKEN_FALLBACK).not.toBe(CODE_FORMAT_MESSAGE)
  })
})

describe('M-P45 拍板②：名称失焦那一发只在「新建 + 代码格为空」时打，且一次弹窗只打一次', () => {
  it('名称框挂的是具名处理函数 @blur="suggestCodeFromName"', () => {
    const nameItem = panelSource.slice(panelSource.indexOf('label="租户名称"'),
      panelSource.indexOf('</a-form-item>', panelSource.indexOf('label="租户名称"')))
    expect(nameItem).toContain('@blur="suggestCodeFromName"')
  })

  it('三道前置闸逐字钉住：编辑态不碰、格子有任何字符不覆盖、打过一次不再打', () => {
    const fn = panelSource.slice(panelSource.indexOf('const suggestCodeFromName = async () =>'),
      panelSource.indexOf('const getStatusColor'))
    expect(fn).toContain('if (isEdit.value) return')
    // 比的是 !== ''，不是 trim 后非空：一个空格也是人打的字
    expect(fn).toContain("if (formData.code !== '') return")
    expect(fn).toContain('if (codeSuggestedOnce.value) return')
  })

  it('填完先让 watch 落地再查重，否则刚填的值会被自己的作废判据抹平', () => {
    const fn = panelSource.slice(panelSource.indexOf('const suggestCodeFromName = async () =>'),
      panelSource.indexOf('const getStatusColor'))
    expect(fn).toContain('formData.code = suggested')
    expect(fn.indexOf('await nextTick()')).toBeLessThan(fn.indexOf('await checkTenantCode()'))
    expect(fn.indexOf('await checkTenantCode()')).toBeLessThan(fn.length)
  })

  it('开弹窗那一发把「只打一次」的记号清零', () => {
    const open = panelSource.slice(panelSource.indexOf('const showCreateModal = () =>'),
      panelSource.indexOf('const editTenant'))
    expect(open).toContain('codeSuggestedOnce.value = false')
  })

  it('代码框失焦那一发先过本地格式闸，非法形不打查重口', () => {
    const fn = checkTenantCodeWindow()
    expect(fn).toContain('if (!CODE_FORMAT_PATTERN.test(code))')
    expect(fn.slice(fn.indexOf('if (!CODE_FORMAT_PATTERN.test(code))')))
      .toMatch(/codeCheckState\.value = 'invalid'/)
    // 且这一发在 http.get 之前
    expect(fn.indexOf('if (!CODE_FORMAT_PATTERN.test(code))'))
      .toBeLessThan(fn.indexOf("'\/admin\/tenants\/code-available'"))
  })
})

describe('M-P44 拍板①：TenantPanel 那一格真的接在这份形状上', () => {
  it('扫到了面板本身（glob 写错会让这一整段静默通过）', () => {
    expect(panelSource).not.toBe('')
  })

  it('代码框挂的是具名处理函数 @blur="checkTenantCode"（handler 工厂那种写法在本仓静默失效过）', () => {
    const codeItem = panelSource.slice(panelSource.indexOf('label="租户代码"'),
      panelSource.indexOf('</a-form-item>', panelSource.indexOf('label="租户代码"')))
    expect(codeItem).toContain('@blur="checkTenantCode"')
    expect(codeItem).toContain(':validate-status="codeCheck.validateStatus"')
    expect(codeItem).toContain(':help="codeCheck.help"')
  })

  it('处理函数打的是查重读口，且查的就是要提交的那一串字', () => {
    const fn = checkTenantCodeWindow()
    expect(fn).toContain("http.get<{ available?: boolean; message?: string }>(")
    expect(fn).toContain("'/admin/tenants/code-available'")
    expect(fn).toMatch(/const code = formData\.code\b/)
    // 编辑态那一栏禁用且改不动，白打一发的读要撤掉
    expect(fn).toContain('if (isEdit.value) return')
  })

  it('后端没回 available 时落 unreachable，不当成可用', () => {
    const fn = checkTenantCodeWindow()
    expect(fn).toContain('if (typeof reading?.available !== \'boolean\')')
    expect(fn.slice(fn.indexOf('if (typeof reading?.available !== \'boolean\')')))
      .toMatch(/codeCheckState\.value = 'unreachable'/)
    // 成功分支只许有两个去处：available / taken
    expect(fn).toMatch(/codeCheckState\.value = reading\.available \? 'available' : 'taken'/)
  })

  it('改了代码就把上一发的结论撤掉，并让在途那一发作废（seq 比对）', () => {
    const watcher = panelSource.slice(panelSource.indexOf('watch(() => formData.code'),
      panelSource.indexOf('const checkTenantCode'))
    expect(watcher).toContain("codeCheckState.value = 'idle'")
    expect(watcher).toContain('codeCheckSeq++')
    const fn = checkTenantCodeWindow()
    expect(fn).toContain('const seq = ++codeCheckSeq')
    expect(fn).toContain('if (seq !== codeCheckSeq) return')
  })
})

describe('M-P45 现场浏览器验收抓到的一处：只敲空格不许显成「这栏过了」', () => {
  // 16:4x 现场：代码格填 '   ' 失焦，查重不发（正确），但那格被 antd 自带规则判成 success 描绿——
  // 界面把一串后端空闸必拒的值摆成了「已校验、可通过」。这条把尺对齐后端 `!code.trim()`。
  it('代码那条 required 规则带 whitespace，空格串当场就不合格', () => {
    const rules = panelSource.slice(panelSource.indexOf('const formRules = {'),
      panelSource.indexOf('/**', panelSource.indexOf('const formRules = {')))
    expect(rules).toMatch(/code:\s*\[\{[^}]*whitespace:\s*true/)
  })

  it('处理函数里那把空尺也是 trim 的，与规则同一把（不是 `!code`）', () => {
    const fn = checkTenantCodeWindow()
    expect(fn).toContain('if (!code.trim())')
  })
})

describe('M-P45 现场浏览器验收抓到的第二处：上一次弹窗的红字不许跟着下一次一起来', () => {
  // a-modal 默认不销毁内容，两个开弹窗的口子只换 formData 不撤校验状态，
  // 于是「新建」里红掉的那一栏会带着上一家的红字出现在「编辑」里。
  const openerWindow = panelSource.slice(panelSource.indexOf('const showCreateModal'),
    panelSource.indexOf('const showProvisionResult'))

  it('表单挂了 ref，两个开弹窗的口子各自 clearValidate', () => {
    expect(panelSource).toContain('ref="formRef"')
    expect(panelSource).toContain('const formRef = ref<FormInstance>()')
    expect(openerWindow.match(/formRef\.value\?\.clearValidate\(\)/g)).toHaveLength(2)
  })

  it('clearValidate 排在 modalVisible 之后、同一个函数体内（写在函数外等于没写）', () => {
    for (const opener of ['showCreateModal', 'editTenant']) {
      const body = openerWindow.slice(openerWindow.indexOf(opener))
      const visible = body.indexOf('modalVisible.value = true')
      const cleared = body.indexOf('formRef.value?.clearValidate()')
      const fnEnd = body.indexOf('\n}')
      expect(visible).toBeGreaterThan(-1)
      expect(cleared).toBeGreaterThan(visible)
      expect(cleared).toBeLessThan(fnEnd)
    }
  })
})

describe('M-P45 变异检验 FD 抓到的第三处：读源码的窗口本身要有钉', () => {
  // FD 变异把 checkTenantCode 里那道编辑态早退删掉，24 例全绿——因为那几条断言的切片没封右界，
  // 下一支函数里一模一样的一行替它作了证。窗口不钉住自己，里面所有断言都是在读整份文件。
  it('窗口左端是 checkTenantCode，右端停在下一支顶层函数之前', () => {
    const fn = checkTenantCodeWindow()
    expect(fn.startsWith('const checkTenantCode = async () =>')).toBe(true)
    expect(fn).not.toContain('const suggestCodeFromName')
    expect(fn).not.toContain('const codeSuggestedOnce')
    // 夹住的这一支函数体里，编辑态那道早退只许出现一次
    expect(fn.match(/if \(isEdit\.value\) return/g)).toHaveLength(1)
  })

  it('夹住的这一段一直读到函数体最后一行，没被截在半截', () => {
    const fn = checkTenantCodeWindow()
    // 窗口右界是「下一支顶层函数之前」，不是「函数体之后」：中间那道 javadoc 属于窗口，随注释改写会动，
    // 所以这一条不钉尾字节，钉的是函数体最末那一行必须在里面——截短了它就不在。
    expect(fn).toContain("codeCheckMessage.value = (e as Error)?.message ?? ''")
    expect(fn).toContain('codeCheckMessage.value = reading.message')
  })
})
