import { describe, expect, it } from 'vitest'
import {
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
    const fn = panelSource.slice(panelSource.indexOf('const checkTenantCode = async () =>'))
    expect(fn).toContain("http.get<{ available?: boolean; message?: string }>(")
    expect(fn).toContain("'/admin/tenants/code-available'")
    expect(fn).toMatch(/const code = formData\.code\b/)
    // 编辑态那一栏禁用且改不动，白打一发的读要撤掉
    expect(fn).toContain('if (isEdit.value) return')
  })

  it('后端没回 available 时落 unreachable，不当成可用', () => {
    const fn = panelSource.slice(panelSource.indexOf('const checkTenantCode = async () =>'))
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
    const fn = panelSource.slice(panelSource.indexOf('const checkTenantCode = async () =>'))
    expect(fn).toContain('const seq = ++codeCheckSeq')
    expect(fn).toContain('if (seq !== codeCheckSeq) return')
  })
})
