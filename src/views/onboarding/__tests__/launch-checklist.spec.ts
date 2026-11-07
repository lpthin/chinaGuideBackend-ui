import { describe, it, expect } from 'vitest'
import { routes } from '../../../router'
import type { CompanyInfo } from '../../../types'
import type { DemoStatusResult } from '../../../api/onboarding'
import {
  LAUNCH_LINK_ROUTES,
  buildLaunchSteps,
  contactText,
  portalPreviewUrl,
  siteFieldValue,
  siteNameText,
  type LaunchReadings,
} from '../launchChecklist'

/**
 * 「能不能上线」这五步的唯一算法（Spec-Q §4.1 D 型 + §4.4，P4）。
 *
 * 这一档钉的是**口径**，不是排版（排版在 checklist-page.spec.ts，两屏接线在 portal-launch-view.spec.ts）：
 *
 * 1. 没取到数（没选客户 / 没权限 / 读挂了）统一是 unknown，且每一处都带下一步——
 *    改前那一屏的两个统计数停在「未取到」上，屏上只有一个 24px 大字（§1.4）。
 * 2. unknown 不许演成「确实缺」，也不许演成「未绑定」：那会让人去找一个根本不存在的域名问题。
 * 3. 演示内容不是上线的必要条件，没有它只能说「还差一套演示包」，不能说「挡住上线了」。
 * 4. 第 5 步只确认出口链接给不给得出，不替 robots 与 sitemap 的内容担保。
 * 5. 「去哪儿补」的路由名只有一个出处（LAUNCH_LINK_ROUTES），页面不许再抄一遍。
 */

const EMPTY_DEMO_COUNTS = { categories: 0, articles: 0, cases: 0, banners: 0, jobs: 0 }

function readings(overrides: Partial<LaunchReadings> = {}): LaunchReadings {
  return {
    tenantNotSelected: false,
    // 这一句由调用方给：门户上线那一屏的页头有「刷新」，内容工作台那条带没有，
    // 用例默认按前者，另一条见下面「refreshHint」那一档
    refreshHint: '点页头的「刷新」重来一次',
    site: { id: 9, code: 'xiaoshansdental', name: '萧山竟天口腔', domain: 'xiaoshansdental.com' },
    siteIssue: null,
    company: { companyName: '萧山竟天口腔', introduction: '一家诊所', phone: '0571-1' } as CompanyInfo,
    demoReadable: true,
    demo: { tenantId: 15, siteCount: 1, demo: { categories: 12, articles: 60, cases: 18, banners: 0, jobs: 0 } } as DemoStatusResult,
    visibility: { articles: 3, cases: 1 },
    ...overrides,
  }
}

function stepByKey(key: string, overrides: Partial<LaunchReadings> = {}) {
  return buildLaunchSteps(readings(overrides)).find(step => step.key === key)
}

describe('五步的形状', () => {
  it('顺序与 key 固定：站点 → 企业信息 → 演示内容 → 访客能看到 → 出口', () => {
    const steps = buildLaunchSteps(readings())
    expect(steps.map(step => step.key)).toEqual(['site', 'company', 'demo', 'readers', 'seo'])
    expect(steps.map(step => step.title)).toEqual([
      '站点与访问域名',
      '企业信息',
      '演示内容',
      '访客实际能看到的内容',
      '门户预览与 SEO / GEO 出口',
    ])
  })

  it('凡是 unknown 的步骤都带「下一步」：未取到不许只留一个大字', () => {
    const cases: Partial<LaunchReadings>[] = [
      { tenantNotSelected: true, site: null },
      { site: null, siteIssue: 'denied' },
      { site: null, siteIssue: 'failed', siteError: '缺少权限: portal:build:manage' },
      { company: null, companyError: '企业信息读取失败' },
      { demoReadable: false, demo: null },
      { demo: null, demoError: '演示包读取失败' },
      { visibility: { articles: null, cases: null } },
      { visibility: { articles: null, cases: null }, visibilityError: '门户列表口挂了' },
      { site: { id: 9, code: '', name: '萧山竟天口腔', domain: '' } },
    ]
    for (const partial of cases) {
      for (const step of buildLaunchSteps(readings(partial))) {
        if (step.level !== 'unknown') {
          continue
        }
        expect(step.links?.length, `${JSON.stringify(partial)} 里 ${step.key} 是 unknown，必须带下一步`).toBeGreaterThan(0)
      }
    }
  })

  it('「怎么重新读取」由用这一份算法的那一屏说：完成度带没有页头按钮，就不许指它', () => {
    // 门户上线那一屏页头有「刷新」；内容工作台那条带没有，它传自己那颗按钮的说法
    const band = readings({ refreshHint: '点这一条右边的「重新读取」', visibility: { articles: null, cases: null } })
    const readers = buildLaunchSteps(band).find(step => step.key === 'readers')
    expect(readers?.links?.[0].label).toBe('点这一条右边的「重新读取」')
    expect(JSON.stringify(readers?.links)).not.toContain('页头')
    // 同一份算法在门户上线那一屏仍念页头那颗
    const page = buildLaunchSteps(readings({ visibility: { articles: null, cases: null } })).find(step => step.key === 'readers')
    expect(page?.links?.[0].label).toBe('点页头的「刷新」重来一次')
  })

  it('「去哪儿补」那五条站内路在真路由表里都存在：清单不许长出点不开的死链', () => {
    const names = new Set<string>()
    const walk = (list: Array<{ name?: string; children?: unknown[] }>) => {
      for (const route of list) {
        if (route.name) names.add(String(route.name))
        if (route.children) walk(route.children as Array<{ name?: string; children?: unknown[] }>)
      }
    }
    walk(routes as unknown as Array<{ name?: string; children?: unknown[] }>)
    for (const [key, name] of Object.entries(LAUNCH_LINK_ROUTES)) {
      expect(names.has(name), `${key} 指向的路由名 ${name} 在路由表里找不到`).toBe(true)
    }
  })
})

describe('第 1 步 · 站点', () => {
  it('齐了才算 ready：域名一空就降到 todo，且说的是 sitemap 这件事', () => {
    expect(stepByKey('site')?.level).toBe('ready')
    const noDomain = stepByKey('site', { site: { id: 9, code: 'c', name: '萧山竟天口腔', domain: '' } })
    expect(noDomain?.level).toBe('todo')
    expect(noDomain?.stateText).toBe('未绑定域名')
    expect(noDomain?.gap).toContain('sitemap.xml 不输出任何 URL')
  })

  it('没选客户 = 一个字都没取：unknown「未取数」，不许冒出「未绑定」或「该客户还没有站点」', () => {
    const step = stepByKey('site', { tenantNotSelected: true, site: null })
    expect(step?.level).toBe('unknown')
    expect(step?.stateText).toBe('未取数')
    expect(step?.gap).toBe('还没选客户，这一格一个字都没取。')
    expect(`${step?.stateText}${step?.gap}`).not.toContain('未绑定')
    expect(`${step?.stateText}${step?.gap}`).not.toContain('该客户还没有站点')
    expect(siteNameText(readings({ tenantNotSelected: true, site: null }))).toBe('未选客户，未取数')
  })

  it('读不到分两种：这个账号本来就读不到 ≠ 读了但失败，两种都不是「没有站点」', () => {
    const denied = stepByKey('site', { site: null, siteIssue: 'denied' })
    expect(denied?.level).toBe('unknown')
    expect(denied?.stateText).toBe('无查看权限')
    expect(siteNameText(readings({ site: null, siteIssue: 'denied' }))).toContain('没有站点信息的查看权限')

    const failed = stepByKey('site', { site: null, siteIssue: 'failed', siteError: '缺少权限: portal:build:manage' })
    expect(failed?.stateText).toBe('读取失败')
    expect(failed?.gap).toContain('缺少权限: portal:build:manage')

    const none = stepByKey('site', { site: null })
    expect(none?.level).toBe('blocked')
    expect(none?.stateText).toBe('缺少站点')
  })

  it('字段值那一头也一样：没读到说「未取到」，读过且真空才说「未绑定」', () => {
    const base = readings({ site: { id: 9, code: 'c', name: 'N', domain: '' } })
    expect(siteFieldValue(base, '', '未绑定')).toBe('未绑定')
    expect(siteFieldValue(readings({ site: null, siteIssue: 'failed' }), '', '未绑定')).toBe('未取到')
    expect(siteFieldValue(readings({ tenantNotSelected: true, site: null }), '', '未绑定')).toBe('—')
  })

  it('站点那一格的大字带 ID：一个租户多套站点时只有编号认得出是哪一套', () => {
    expect(siteNameText(readings())).toBe('萧山竟天口腔（ID 9）')
  })
})

describe('第 2 步 · 企业信息', () => {
  it('名称没有 = 挡住上线；名称有了但缺简介或联系方式 = 还差；齐了 = ready', () => {
    expect(stepByKey('company', { company: null })?.stateText).toBe('未填写')
    expect(stepByKey('company', { company: null })?.level).toBe('blocked')
    const partial = stepByKey('company', { company: { companyName: '萧山竟天口腔' } as CompanyInfo })
    expect(partial?.level).toBe('todo')
    expect(partial?.stateText).toBe('信息不完整')
    expect(stepByKey('company')?.level).toBe('ready')
  })

  it('每一档都带「去填写企业信息」，走的是菜单里那一条路由', () => {
    for (const partial of [{}, { company: null }, { company: { companyName: 'N' } as CompanyInfo }]) {
      const step = stepByKey('company', partial)
      expect(step?.links?.some(link => String((link.to as { name?: string })?.name) === 'workspace-portal-company')).toBe(true)
    }
  })

  it('联系方式那一句只在真有的时候念，三个口子全空才说未填写', () => {
    expect(contactText({ phone: '1', email: 'e@x.cn', serviceHotline: '4' } as CompanyInfo)).toBe('1 / e@x.cn / 4')
    expect(contactText({ email: 'e@x.cn' } as CompanyInfo)).toBe('e@x.cn')
    expect(contactText({} as CompanyInfo)).toBe('未填写')
    expect(contactText(null)).toBe('未填写')
  })
})

describe('第 3 步 · 演示内容', () => {
  it('租户读不到这一格：unknown 说的是「超级管理员功能」，并给一条「联系平台」', () => {
    const step = stepByKey('demo', { demoReadable: false, demo: null })
    expect(step?.level).toBe('unknown')
    expect(step?.stateText).toBe('超级管理员功能')
    expect(step?.links?.some(link => String((link.to as { name?: string })?.name) === 'workspace-portal-support')).toBe(true)
    // 这一格对租户不是「还没做」，屏上不许出现「还差演示内容」那种话
    expect(`${step?.stateText}${step?.gap}`).not.toContain('还差')
  })

  it('超管读到 0 条只是 todo：不灌演示包也能上线，第 4 步齐了就行', () => {
    const step = stepByKey('demo', { demo: { tenantId: 15, siteCount: 1, demo: EMPTY_DEMO_COUNTS } as DemoStatusResult })
    expect(step?.level).toBe('todo')
    expect(step?.stateText).toBe('尚无演示内容')
    expect(step?.gap).toContain('不灌也可以')
    expect(step?.gap).not.toContain('挡住')
  })

  it('有演示行时补一句「演示行访客读不到」：这一步齐了不等于第 4 步齐了', () => {
    const step = stepByKey('demo')
    expect(step?.level).toBe('ready')
    expect(step?.gap).toContain('访客')
  })
})

describe('第 4 步 · 访客实际能看到的内容', () => {
  it('两个数各说各的：articles 没回来才是 unknown，0 是挡住上线，>0 才算 ready', () => {
    expect(stepByKey('readers', { visibility: { articles: null, cases: 3 } })?.level).toBe('unknown')
    const zero = stepByKey('readers', { visibility: { articles: 0, cases: 0 } })
    expect(zero?.level).toBe('blocked')
    expect(zero?.stateText).toBe('门户上还没有已发布内容')
    const ready = stepByKey('readers', { visibility: { articles: 5, cases: 2 } })
    expect(ready?.level).toBe('ready')
    expect(ready?.gap).toContain('文章 5 条、案例 2 条')
  })

  it('cases 单独没回来时念「未取到」，不许蒙成 0', () => {
    const step = stepByKey('readers', { visibility: { articles: 5, cases: null } })
    expect(step?.gap).toContain('案例 未取到')
  })

  it('挂了那一句带后端原话，且仍然给去文章与案例两条路', () => {
    const step = stepByKey('readers', { visibility: { articles: null, cases: null }, visibilityError: '门户列表口挂了' })
    expect(step?.gap).toContain('门户列表口挂了')
    const names = step?.links?.map(link => String((link.to as { name?: string })?.name))
    expect(names).toEqual(expect.arrayContaining(['workspace-articles', 'workspace-case-list']))
  })
})

describe('第 5 步 · 出口那一格只说自己看得见的事', () => {
  it('没有站点编码时给不出预览地址：unknown 并指回第 1 步', () => {
    const step = stepByKey('seo', { site: { id: 9, code: '', name: 'N', domain: '' } })
    expect(step?.level).toBe('unknown')
    expect(step?.stateText).toBe('没有站点编码，无法预览')
    expect(step?.gap).toContain('第 1 步')
  })

  it('有编码时念「四个出口已列出」，并明说这一格不替 robots 与 sitemap 的内容担保', () => {
    const step = stepByKey('seo')
    expect(step?.stateText).toBe('四个出口已列出')
    expect(step?.gap).toContain('不替你判断 robots 与 sitemap 的内容对不对')
  })

  it('预览地址按站点编码定位（门户 dev 认的是 ?site=编码，不是数字 id）', () => {
    const url = portalPreviewUrl(readings())
    expect(url).toContain('/?site=xiaoshansdental')
    expect(url).not.toContain('ID 9')
    expect(portalPreviewUrl(readings({ site: null }))).toBe('')
  })
})
