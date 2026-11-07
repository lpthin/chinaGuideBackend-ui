import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import PortalContentWorkbenchView from '../PortalContentWorkbenchView.vue'
import { portalSectionsApi } from '../../../api/portalSections'
import { portalPagesApi } from '../../../api/portalPages'
import { companyInfoApi } from '../../../api'
import { portalSitesApi } from '../../../api/portalSites'
import { demoSiteApi, portalVisibilityApi } from '../../../api/onboarding'
import {
  checklistNotMeasuredText,
  checklistPendingText,
  checklistProgress
} from '../../../components/checklistPageModel'

/**
 * 租户「内容工作台」（Spec §7.1；2026-11-06 整页重做，方案 docs/内容工作台页面重构_方案.md）。
 *
 * 这一页要守的还是那两件事，都是以前踩过的那类：
 * 1. 行集合与名字**只能**来自 `/api/portal/sections`——前端一旦抄一份，超管改完显示名这里还写着老字；
 * 2. 页面上不许长出任何开关（N1/N2）。租户能做的只有「去看这一栏的访客视角」和「去填内容」。
 *
 * 重做后新增的一层账：顶部那三格是**派生读数**，所以「统计没回来」的行既不进分母、
 * 也不许被算成 0（I-8 点名的假绿），这一档由下面的概览带用例钉住。
 */

const pushSpy = vi.fn()

/** 与真 store 同形状：只给 hasPermission 一个判据，用例改 permissions 数组就能换档 */
const authState = {
  isSuperAdmin: false,
  selectedTenantId: null as number | null,
  tenantId: 15,
  permissions: [] as string[],
  hasPermission(code: string) {
    return this.permissions.includes(code)
  },
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState,
}))

/**
 * 「去维护」旁边那句去向读的是左侧菜单自己那份标签，所以桩件要给一份真路由表：
 * 用例据此证明那句中文是从菜单来的，不是这一页又抄了一遍。
 */
const ROUTES_FIXTURE = [{
  name: 'workspace',
  path: '/workspace',
  children: [
    { path: 'articles', name: 'workspace-articles', meta: { title: '文章与案例' } },
    { path: 'case', name: 'workspace-case-list', meta: { title: '客户案例' } },
    { path: 'portal/jobs', name: 'workspace-portal-jobs', meta: { title: '招聘' } },
    { path: 'portal/company', name: 'workspace-portal-company', meta: { title: '企业信息' } },
  ],
}]

// PageTitle 读 route.meta.title 拿屏名，桩件不给这一口就是 TypeError
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, options: { routes: ROUTES_FIXTURE } }),
  useRoute: () => ({ params: {}, query: {}, meta: { title: '内容工作台' } })
}))

vi.mock('../../../api/portalSections', () => ({
  portalSectionsApi: { list: vi.fn(), summary: vi.fn() }
}))
vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { statusLabels: vi.fn(), list: vi.fn() }
}))

// 上线自检那一条带的三个口（Q7：租户在这一屏读「还差什么才能上线」，不再进门户上线那一屏）
vi.mock('../../../api', () => ({
  companyInfoApi: { get: vi.fn() }
}))
vi.mock('../../../api/portalSites', () => ({
  portalSitesApi: { listMine: vi.fn() }
}))
vi.mock('../../../api/onboarding', () => ({
  backendFileUrl: (path: string) => `https://backend.example${path}`,
  demoSiteApi: { status: vi.fn(), bootstrap: vi.fn(), publish: vi.fn() },
  portalVisibilityApi: { publishedArticles: vi.fn(), publishedCases: vi.fn() }
}))

const PASS_THROUGH = (name: string, extraSlots: string[] = []) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'column', 'checked', 'disabled', 'color', 'placement'],
  template: `<div class="${name.toLowerCase()}-stub"><span>${'{{ description }}'}</span><slot name="title" />${extraSlots
    .map(slot => `<slot name="${slot}" />`)
    .join('')}<slot /></div>`
})

function state(key: string, displayName: string, contentEntry: string, enabled = true, navSort = 1) {
  return {
    key,
    displayName,
    pageKind: key,
    dataSource: null,
    contentEntry,
    publicPath: `/${key}`,
    enabled,
    navVisible: enabled,
    navSort,
    landingPageId: null
  }
}

function summary(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    displayName: key,
    publicPath: `/${key}`,
    previewUrl: `https://acme.example/${key}`,
    contentEntry: 'article',
    contentCount: 5,
    landingPageId: 12,
    landingPageTitle: '栏目页',
    landingPageStatus: 'published',
    completeness: completeness(),
    ...overrides
  }
}

/**
 * 完整度那一句的桩：默认给一档「内容完整」。
 *
 * <p>label/hint 故意写成后端原话的形状而不由界面拼——用例要证的就是这里只照抄，
 * 数字与中文都是后端 `SectionCompleteness` 数出来、说出来的。</p>
 */
function completeness(overrides: Record<string, unknown> = {}) {
  return {
    level: 'complete',
    label: '内容完整',
    hint: '5 条内容都配了封面图',
    missingImageCount: 0,
    unlistedCount: null,
    ...overrides
  }
}

/** 一档「一条内容都没有」：重做后它必须排在整页第一行 */
function emptyCompleteness() {
  return completeness({ level: 'empty', label: '还没有内容', hint: '访客在这一栏目里看不到任何内容，从「去维护」里发一条就有', missingImageCount: 0 })
}

async function mountView(states: ReturnType<typeof state>[], summaries: Record<string, any> = {},
                        failedKeys: string[] = [], sectionsListError?: string) {
  // 传了 sectionsListError 就让那一发真挂：不能在调用方先 mockRejectedValue，这里会把桩覆盖掉
  if (sectionsListError) {
    vi.mocked(portalSectionsApi.list).mockRejectedValue(new Error(sectionsListError))
  } else {
    vi.mocked(portalSectionsApi.list).mockResolvedValue(states as any)
  }
  vi.mocked(portalSectionsApi.summary).mockImplementation(async (key: string) => {
    if (failedKeys.includes(key)) {
      throw new Error('统计接口挂了')
    }
    return summaries[key] ?? summary(key) as any
  })
  vi.mocked(portalPagesApi.statusLabels).mockResolvedValue({ draft: '草稿', published: '已发布', offline: '已下线' })
  const wrapper = mount(PortalContentWorkbenchView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-space': PASS_THROUGH('ASpace'),
        'a-tooltip': PASS_THROUGH('ATooltip', ['title']),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-tag': PASS_THROUGH('ATag'),
        // 键写成模板里那个标签名，写 'RouterLink' 覆盖不到 setup.ts 里那条 `'router-link': true`
        'router-link': {
          name: 'RouterLink',
          props: ['to'],
          template: '<a class="rl-stub" :data-route="to && to.name"><slot /></a>'
        }
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 行级断言用的读数：一行的文字、档位标签、左色条颜色 */
function rowTexts(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper.findAll('.portal-workbench__row').map(row => ({
    text: row.text(),
    color: row.attributes('style') || ''
  }))
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  // 身份每次重置：上一档用例把 authState 改成超管，下一档不重置就会带着「没选客户、未取数」跑
  authState.isSuperAdmin = false
  authState.selectedTenantId = null
  // 默认按「平台侧账号」测：它两个码都有，词表读得到。租户档那一档在下面单独摆
  authState.permissions = ['portal:siteinfo:manage', 'portal:page:manage']
  // 上线自检那条带的默认读数：站点已绑域名、企业信息齐了、门户公开口读得到内容
  vi.mocked(portalSitesApi.listMine).mockResolvedValue([
    { id: 611, code: 'acme-dental', name: '安米口腔', domain: 'acme.example' }
  ] as any)
  vi.mocked(companyInfoApi.get).mockResolvedValue({
    companyName: '安米口腔', introduction: '一家诊所', phone: '0571-8'
  } as any)
  vi.mocked(portalVisibilityApi.publishedArticles).mockResolvedValue({ total: 3 } as any)
  vi.mocked(portalVisibilityApi.publishedCases).mockResolvedValue({ total: 1 } as any)
  vi.mocked(demoSiteApi.status).mockResolvedValue({
    tenantId: 15, siteCount: 1, siteId: 611, siteCode: 'acme-dental', siteName: '安米口腔', domain: 'acme.example',
    demo: { categories: 12, articles: 60, cases: 18, banners: 3, jobs: 3 }, published: { articles: 3, cases: 1 }
  } as any)
})

describe('栏目行集合只来自接口', () => {
  it('行上的名字就是接口回的那几个字', async () => {
    const wrapper = await mountView([state('news', '平台改过的名字', 'article')])
    expect(wrapper.text()).toContain('平台改过的名字')
    expect(wrapper.findAll('.portal-workbench__row')).toHaveLength(1)
  })

  it('关掉的栏目不出行，也不为它发统计请求', async () => {
    const wrapper = await mountView([
      state('news', '资讯栏', 'article'),
      state('jobs', '招聘栏', 'job', false)
    ])
    expect(wrapper.text()).toContain('资讯栏')
    expect(wrapper.text()).not.toContain('招聘栏')
    const asked = vi.mocked(portalSectionsApi.summary).mock.calls.map(call => call[0])
    expect(asked).toEqual(['news'])
  })

  it('一个栏目都没开时说明白，「联系平台」全屏只有页头那一个', async () => {
    const wrapper = await mountView([])
    expect(wrapper.find('.aempty-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('还没有为这个站点开通任何栏目')
    const actions = [...document.querySelectorAll('a, button')].map(node => (node.textContent || '').trim())
    // 空态块里再摆一个同名按钮，等于让人确认两遍点的是不是同一个地方
    expect(actions.filter(text => text === '联系平台')).toHaveLength(1)
    // 空态时概览带不摆，免得出现一片「—」看着像坏了
    expect(wrapper.find('.portal-workbench__band').exists()).toBe(false)
  })
})

describe('三个数字的口径', () => {
  it('零条时说「还没有内容」，不是冷冰冰的 0', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {
      news: summary('news', {
        contentCount: 0,
        landingPageId: null,
        landingPageStatus: null,
        completeness: emptyCompleteness()
      })
    })
    expect(wrapper.text()).toContain('还没有内容')
    expect(wrapper.text()).toContain('平台还没为这一栏目建页')
  })

  it('标量栏目报「—」而不是 0（关于我们没有「几条」这件事）', async () => {
    const wrapper = await mountView([state('about', '关于我们页', 'company')], {
      about: summary('about', {
        contentCount: null,
        completeness: completeness({ level: 'notList', label: '不计条数', hint: '这一栏目读的是企业信息那一组字段，没有「几条」这件事', missingImageCount: null })
      })
    })
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).toContain('不计条数')
    expect(wrapper.text()).not.toContain('还没有内容')
  })

  it('有页面但没发布时报的是后端那份状态词表', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {
      news: summary('news', { landingPageId: null, landingPageStatus: 'draft' })
    })
    expect(wrapper.text()).toContain('草稿')
    expect(wrapper.text()).not.toContain('draft')
  })
})

describe('内容完整度那一格（问题十，含缺图）', () => {
  /**
   * 只看**栏目行**那几个档位标签的文字：行内其它字段名是界面自己的话，不参与「中文谁说的」这场判断。
   *
   * P4 往这一页加了上线自检那条带，带里也有 `a-tag`（那几句是后端 demo-status / 公开口的话，
   * 不是这一栏目完整度词表），所以定位收到 `.portal-workbench__row` 里面——
   * 判断的东西没变，只是不再把别处的标签算进来（Spec-Q Q5 允许改定位方式）。
   */
  const tagTexts = (wrapper: Awaited<ReturnType<typeof mountView>>) =>
    wrapper.findAll('.portal-workbench__row .atag-stub').map(node => node.text())

  it('缺几条图照后端那句话原样说，界面自己不再数一遍', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {
      news: summary('news', {
        contentCount: 8,
        completeness: completeness({ level: 'missingImage', label: '有内容缺图', hint: '8 条里 3 条没配封面图：门户上摆图的那一格是空的', missingImageCount: 3 })
      })
    })
    expect(tagTexts(wrapper)).toEqual(['有内容缺图'])
    expect(wrapper.text()).toContain('8 条里 3 条没配封面图')
  })

  it('行上的档位与说明都来自接口：后端换成什么字，界面就照说什么', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {
      news: summary('news', {
        completeness: completeness({ level: 'missingImage', label: '档位词表改过的字', hint: '后端说的完整度那句话' })
      })
    })
    expect(wrapper.text()).toContain('档位词表改过的字')
    expect(wrapper.text()).toContain('后端说的完整度那句话')
    // 界面没有把这一档硬编码成自己认识的那几种说法
    expect(tagTexts(wrapper)).not.toContain('内容完整')
  })

  it('没有封面图位的栏目（招聘）照后端说「不判缺图」，不被演成完整', async () => {
    const wrapper = await mountView([state('jobs', '招聘栏', 'job')], {
      jobs: summary('jobs', {
        contentEntry: 'job',
        contentCount: 11,
        completeness: completeness({ level: 'noCoverSlot', label: '已有内容', hint: '访客能看到 11 条；这一栏目在门户上没有封面图位，不判缺图', missingImageCount: null })
      })
    })
    expect(wrapper.text()).toContain('没有封面图位，不判缺图')
    expect(tagTexts(wrapper)).not.toContain('内容完整')
  })

  it('统计没回来的那一行不许亮出「内容完整」，也不补一个默认档', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {}, ['news'])
    expect(wrapper.text()).toContain('统计未就绪')
    expect(wrapper.text()).toContain('完整度统计未就绪')
    // 档位标签整个不渲染，而不是渲染一个界面自己猜的档（只看栏目行，自检带里那几个标签不算）
    expect(tagTexts(wrapper)).toHaveLength(0)
  })

  it('后端新加一档陌生代码时，行上仍是后端那两句原话，不被演成认识的那几种', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {
      news: summary('news', {
        completeness: completeness({ level: 'brandNewLevel', label: '后端新加的那一档', hint: '后端新加档位的说明原文', missingImageCount: null })
      })
    })
    expect(wrapper.text()).toContain('后端新加的那一档')
    expect(wrapper.text()).toContain('后端新加档位的说明原文')
    expect(tagTexts(wrapper)).toEqual(['后端新加的那一档'])
  })
})

describe('概览带那三格只算读回来的账', () => {
  it('齐了几栏按读回来的行数算，统计未就绪的那行不进分母', async () => {
    const wrapper = await mountView(
      [state('news', '资讯栏', 'article'), state('cases', '客户案例', 'case'), state('jobs', '招聘栏', 'job')],
      {
        news: summary('news'),
        cases: summary('cases', { completeness: emptyCompleteness() })
      },
      ['jobs']
    )
    const cells = wrapper.findAll('.portal-workbench__cell')
    expect(cells[0].text()).toContain('1 / 2')
    expect(cells[0].text()).toContain('另有 1 栏统计未就绪')
  })

  it('缺图条数只加后端给了数的那些行；全是「没有图位」时报「—」而不是 0', async () => {
    const wrapper = await mountView(
      [state('news', '资讯栏', 'article'), state('jobs', '招聘栏', 'job')],
      {
        news: summary('news', {
          contentCount: 8,
          completeness: completeness({ level: 'missingImage', label: '有内容缺图', hint: '3 条没配图', missingImageCount: 3 })
        }),
        jobs: summary('jobs', {
          contentEntry: 'job',
          completeness: completeness({ level: 'noCoverSlot', label: '已有内容', hint: '没有封面图位，不判缺图', missingImageCount: null })
        })
      }
    )
    expect(wrapper.findAll('.portal-workbench__cell')[1].text()).toContain('3')

    const onlyNoSlot = await mountView([state('jobs', '招聘栏', 'job')], {
      jobs: summary('jobs', {
        contentEntry: 'job',
        completeness: completeness({ level: 'noCoverSlot', label: '已有内容', hint: '没有封面图位，不判缺图', missingImageCount: null })
      })
    })
    const gapCell = onlyNoSlot.findAll('.portal-workbench__cell')[1]
    expect(gapCell.text()).toContain('—')
    expect(gapCell.text()).not.toContain('0')
  })

  it('「最该先补」报的是排在第一行那一栏，句子用后端 hint 原文', async () => {
    const wrapper = await mountView(
      [state('news', '资讯栏', 'article'), state('cases', '客户案例', 'case')],
      {
        news: summary('news'),
        cases: summary('cases', { completeness: emptyCompleteness() })
      }
    )
    const urgent = wrapper.findAll('.portal-workbench__cell')[2]
    expect(urgent.text()).toContain('客户案例')
    expect(urgent.text()).toContain('访客在这一栏目里看不到任何内容')
  })
})

describe('行按「最该补」排，不是按接口回来的顺序', () => {
  it('空栏目排在齐了的前面，同档再按平台给的导航顺序', async () => {
    const wrapper = await mountView(
      [
        state('news', '资讯栏', 'article', true, 5),
        state('services', '服务栏', 'article', true, 3),
        state('cases', '客户案例', 'case', true, 4)
      ],
      {
        news: summary('news'),
        services: summary('services', {
          completeness: completeness({ level: 'missingImage', label: '有内容缺图', hint: '2 条没配图', missingImageCount: 2 })
        }),
        cases: summary('cases', { contentCount: 0, completeness: emptyCompleteness() })
      }
    )
    const names = rowTexts(wrapper).map(row => row.text)
    expect(names[0]).toContain('客户案例')
    expect(names[1]).toContain('服务栏')
    expect(names[2]).toContain('资讯栏')
  })

  it('统计未就绪的行落到后面，且不亮出猜出来的档位色', async () => {
    const wrapper = await mountView(
      [state('news', '资讯栏', 'article', true, 1), state('cases', '客户案例', 'case', true, 2)],
      { cases: summary('cases', { contentCount: 0, completeness: emptyCompleteness() }) },
      ['news']
    )
    const rows = rowTexts(wrapper)
    expect(rows[0].text).toContain('客户案例')
    expect(rows[1].text).toContain('资讯栏')
    expect(rows[1].text).toContain('完整度统计未就绪')
  })
})

describe('租户在这一页没有任何写口', () => {
  it('没有开关，也没有进搭建器的入口', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article'), state('jobs', '招聘栏', 'job')])
    expect(wrapper.findAll('.ant-switch').length).toBe(0)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    const actions = [...document.querySelectorAll('a, button')].map(node => (node.textContent || '').trim())
    expect(actions.filter(text => /搭建|发布|下线|新增栏目|删除/.test(text))).toEqual([])
    expect(actions).toContain('去维护')
    expect(wrapper.text()).toContain('口径说明')
  })

  it('去维护跳到这一内容入口对应的模块，跳的不是栏目 key', async () => {
    const wrapper = await mountView([state('jobs', '招聘栏', 'job')])
    const link = [...document.querySelectorAll('a')].find(node => (node.textContent || '').includes('去维护'))
    expect(link).toBeTruthy()
    link!.click()
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-jobs' })
    expect(wrapper.text()).toContain('招聘栏')
  })

  it('「去维护」旁边那句去向用的是菜单自己那份标签，不是这一页抄的', async () => {
    const wrapper = await mountView([state('jobs', '招聘栏', 'job')])
    expect(wrapper.text()).toContain('→ 招聘')
  })

  it('访客页那条链到的是后端给的对外地址', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    const link = [...document.querySelectorAll('a')].find(node => (node.textContent || '').trim() === '打开访客页')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('https://acme.example/news')
    expect(link!.getAttribute('target')).toBe('_blank')
    // 对外路径这一行只是文字，不再是一条看不出区别的裸链接
    expect(wrapper.text()).toContain('/news')
  })
})

describe('租户档账号（只有 portal:siteinfo:manage，实测 CONTENT_EDITOR 就是这样）', () => {
  beforeEach(() => {
    authState.permissions = ['portal:siteinfo:manage']
  })

  it('没有读页那一码就不发词表请求，栏目行照旧出', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(portalPagesApi.statusLabels).not.toHaveBeenCalled()
    expect(wrapper.findAll('.portal-workbench__row')).toHaveLength(1)
    expect(wrapper.text()).toContain('资讯栏')
    expect(wrapper.text()).not.toContain('缺少权限')
  })

  it('词表没读时「栏目页」那一行露状态原码并说清没取到中文，不假装读到过', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {
      news: summary('news', { landingPageId: null, landingPageStatus: 'draft' })
    })
    expect(wrapper.text()).toContain('draft（状态原码，中文词表未取到）')
    expect(wrapper.text()).not.toContain('草稿')
  })

  it('词表这一个口挂了（有码但读失败）也只影响用词，整页行照旧在', async () => {
    authState.permissions = ['portal:siteinfo:manage', 'portal:page:manage']
    vi.mocked(portalPagesApi.statusLabels).mockRejectedValue(new Error('缺少权限: portal:page:manage'))
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(portalPagesApi.statusLabels).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.portal-workbench__row')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('栏目读取失败')
    expect(wrapper.text()).not.toContain('缺少权限')
  })
})

/**
 * 上线自检那条带（Spec-Q §4.4 / Q7，P4）。
 *
 * Q7 拍的是「租户不该进门户上线那一屏，但他真正要的『还差什么才能上线』得留在他自己那一侧」，
 * 读数因此搬进这一页。四件事要钉：
 *
 * 1. 那句「5 步里齐了几步」用的是门户上线那一屏同一份算法与同一份步骤清单——两处各写一个数，
 *    迟早一个说齐了、另一个说还差。
 * 2. 「还差」（取到了确实缺）和「还不知道」（没取到数）是两句话，不并成一格。
 * 3. 演示内容那一格对租户不发请求：后端那一口是 checkSuperAdmin，发一次就在控制台留一条红字，
 *    而这一格要说的是「这一屏没有这个动作」。
 * 4. 这一带自己的口挂了不许拖累栏目行（栏目那一发挂了也不拖累这一带）；
 *    「怎么重新读取」说的是这一条右边的按钮——这一页页头没有「刷新」那颗，指过去就是指一个不存在的东西。
 */
describe('上线自检那条带（Q7 并进内容工作台）', () => {
  function band(wrapper: Awaited<ReturnType<typeof mountView>>) {
    const node = wrapper.find('[data-launch-band]')
    if (!node.exists()) {
      throw new Error('内容工作台没摆出上线自检那条带')
    }
    return node
  }

  function stepText(wrapper: Awaited<ReturnType<typeof mountView>>, key: string): string {
    const node = wrapper.find(`[data-launch-step="${key}"]`)
    if (!node.exists()) {
      throw new Error(`带里找不到第「${key}」步`)
    }
    return node.text()
  }

  it('五步都在带里，读数那句和门户上线那一屏出自同一个函数', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(band(wrapper).findAll('[data-launch-step]')).toHaveLength(5)
    // 默认那一份读数：站点齐、企业齐、演示对租户读不到、门户有内容、出口齐
    expect(band(wrapper).find('[data-launch-progress]').text()).toBe('5 步里齐了 4 步')
    expect(band(wrapper).find('[data-launch-unknown]').text())
      .toContain(checklistNotMeasuredText(checklistProgress(
        [{ key: 'demo', title: '演示内容', level: 'unknown', stateText: '超级管理员功能' }]
      )))
    // 一步都不缺时不摆「还差：（空）」那种句子
    expect(band(wrapper).find('[data-launch-pending]').exists()).toBe(false)
  })

  it('还差哪一格，那一步就给一条跳到该去那页的链：说的是菜单里那一条路由', async () => {
    vi.mocked(companyInfoApi.get).mockResolvedValue({ companyName: '安米口腔' } as any)
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(band(wrapper).find('[data-launch-progress]').text()).toBe('5 步里齐了 3 步')
    expect(band(wrapper).find('[data-launch-pending]').text())
      .toBe(checklistPendingText(checklistProgress(
        [{ key: 'company', title: '企业信息', level: 'todo', stateText: '信息不完整' }]
      )))
    expect(stepText(wrapper, 'company')).toContain('去填写企业信息')
    const routes = wrapper.findAll('.rl-stub').map(node => node.attributes('data-route'))
    expect(routes).toContain('workspace-portal-company')
    // 「还差」只说真缺的那一步，演示内容那一格是没取到数，不许混进来
    expect(band(wrapper).find('[data-launch-pending]').text()).not.toContain('演示内容')
  })

  it('租户这一侧不发演示包那一发：带里说的是「超级管理员功能」，不是「还没灌」', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(demoSiteApi.status).not.toHaveBeenCalled()
    expect(stepText(wrapper, 'demo')).toContain('超级管理员功能')
    expect(stepText(wrapper, 'demo')).toContain('演示内容找平台')
    expect(wrapper.findAll('.rl-stub').map(node => node.attributes('data-route'))).toContain('workspace-portal-support')
    // 这一格对租户不是「还没做」，「还差」那句里不许出现它
    expect(band(wrapper).text()).not.toContain('还差：演示内容')
  })

  it('超管选了客户才读演示包，读到了就念「已有演示内容」', async () => {
    authState.isSuperAdmin = true
    authState.selectedTenantId = 15
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(demoSiteApi.status).toHaveBeenCalledTimes(1)
    expect(demoSiteApi.status).toHaveBeenCalledWith(15)
    expect(stepText(wrapper, 'demo')).toContain('已有演示内容')
    expect(band(wrapper).find('[data-launch-progress]').text()).toBe('5 步里齐了 5 步')
  })

  it('超管没选客户时五个口一个都不发，带里说「未取数」而不是凭空报一个缺', async () => {
    authState.isSuperAdmin = true
    authState.selectedTenantId = null
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(portalSitesApi.listMine).not.toHaveBeenCalled()
    expect(companyInfoApi.get).not.toHaveBeenCalled()
    expect(demoSiteApi.status).not.toHaveBeenCalled()
    expect(band(wrapper).find('[data-launch-unknown]').text()).toContain('还不知道')
    expect(band(wrapper).text()).not.toContain('该客户还没有站点')
  })

  it('没有站点那一码时不发那一发，带里那一行只说「无查看权限」并给出找平台那一个链接', async () => {
    authState.permissions = ['portal:page:manage']
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(portalSitesApi.listMine).not.toHaveBeenCalled()
    expect(stepText(wrapper, 'site')).toContain('无查看权限')
    expect(stepText(wrapper, 'site')).toContain('找平台确认')
    // 这一行没读到数，只进「还不知道」那句，不许混进「还差」（那是「取到了、确实缺」那一类）
    expect(band(wrapper).find('[data-launch-pending]').exists()).toBe(false)
    expect(band(wrapper).find('[data-launch-unknown]').text()).toContain('站点与访问域名')
  })

  it('带里的口挂了：栏目行照旧，那一步说读取失败并指这一条右边的「重新读取」', async () => {
    vi.mocked(portalSitesApi.listMine).mockRejectedValue(new Error('缺少权限: portal:build:manage'))
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(wrapper.findAll('.portal-workbench__row')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('栏目读取失败')
    expect(stepText(wrapper, 'site')).toContain('读取失败')
    expect(stepText(wrapper, 'site')).toContain('点这一条右边的「重新读取」')
    // 整页没有「刷新」那颗按钮，这一句不许指它
    expect(stepText(wrapper, 'site')).not.toContain('页头')
  })

  it('「重新读取」点一次，带里那几个口各再来一次', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')])
    expect(portalSitesApi.listMine).toHaveBeenCalledTimes(1)
    await band(wrapper).find('[data-launch-refresh]').trigger('click')
    await flushPromises()
    expect(portalSitesApi.listMine).toHaveBeenCalledTimes(2)
    expect(companyInfoApi.get).toHaveBeenCalledTimes(2)
    expect(portalVisibilityApi.publishedArticles).toHaveBeenCalledTimes(2)
  })

  it('栏目那一发挂了也不影响这一条带收尾（三态各说各的）', async () => {
    const wrapper = await mountView([], {}, [], '栏目接口挂了')
    // 那句失败走的是 a-alert 的 message 属性，这一页的桩件不把 message 渲进文本，只能按属性读
    const alerts = wrapper.findAllComponents({ name: 'AAlert' }).map(node => String(node.props('message')))
    expect(alerts.join(' ')).toContain('栏目接口挂了')
    expect(band(wrapper).find('[data-launch-progress]').text()).toBe('5 步里齐了 4 步')
  })
})
