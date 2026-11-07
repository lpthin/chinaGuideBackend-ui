import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { companyInfoApi } from '../../../api/portal'
import { vocabularyApi } from '../../../api/siteBriefs'
import { useAuthStore } from '../../../stores/auth'
import { COMPANY_FORM_DEFAULT, COMPANY_GROUPS } from '../companyInfoFields'

/**
 * 企业信息那一屏的「完成度读数」与「词表单源」（Spec-Q P3，Q6 拍的锚点分组 + 读数）。
 *
 * 立这一档的理由是改之前实测到的两件事：
 * 1. 那一屏 8 张卡、整页高 2648px，没有一个地方说「填到哪儿了、还差哪几格」；
 *    读数一旦是手抄的（抄成「共 33 项」那种好看数），加一格就永久对不上，
 *    所以这里拿 `COMPANY_FORM_DEFAULT` 的键逐一对账：多一格、少一格、重复一格都红。
 * 2. 省份那一格在模板里只列了 8 个，河南 / 福建 / 天津的客户选不到自己那一省；
 *    现在清单唯一出处是后端 `GET /company/provinces`，视图里一个省名都不许再出现。
 *
 * 缺项清单里点的那一格，和跳过去看到的标题，必须是同一句话——所以 37 个字段名逐个要求在视图里逐字出现，
 * 而 8 个组名反过来要求**只在** companyInfoFields.ts 里出现一份（视图再抄一遍就是下一次改组名漏改的那一处）。
 */

vi.mock('../../../api/portal', () => ({
  companyInfoApi: { get: vi.fn(), update: vi.fn(), uploadImage: vi.fn(), provinces: vi.fn() }
}))

vi.mock('../../../api/siteBriefs', () => ({
  PROFILE_QUESTION_KEYS: {
    industry: 'industry',
    targetRegions: 'regions',
    targetAudience: 'audiences',
    businessModel: 'business_models',
    languages: 'languages'
  },
  findProfileQuestion: () => null,
  vocabularyApi: { portalVocabulary: vi.fn() }
}))

const VIEW_SOURCE = readFileSync(join(process.cwd(), 'src/views/portal/CompanyInfoView.vue'), 'utf8')

const CARD_STUB = {
  name: 'ACard',
  props: ['title', 'bordered'],
  template: '<div class="a-card-stub"><slot name="title" /><slot /></div>'
}
const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'type'],
  template: '<div class="alert-stub">{{ message }}</div>'
}
const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="extra" /></div>`
})
/** 把「下拉到底收到了哪几项」读成可断言的字符串：省份清单只能从后端那一发进来 */
const SELECT_STUB = {
  name: 'ASelect',
  props: ['options'],
  template: '<div class="select-stub" :data-options="(options || []).map(o => o.value).join(\',\')"></div>'
}

const GLOBALS = {
  stubs: {
    'a-card': CARD_STUB,
    'a-alert': ALERT_STUB,
    'a-select': SELECT_STUB,
    'a-spin': PASS_THROUGH('a-spin'),
    'a-row': PASS_THROUGH('a-row'),
    'a-col': PASS_THROUGH('a-col'),
    'a-space': PASS_THROUGH('a-space'),
    'a-form': PASS_THROUGH('a-form'),
    'a-form-item': PASS_THROUGH('a-form-item'),
    'a-input': PASS_THROUGH('a-input'),
    'a-textarea': PASS_THROUGH('a-textarea'),
    'a-date-picker': PASS_THROUGH('a-date-picker'),
    'a-cascader': PASS_THROUGH('a-cascader'),
    'a-upload': PASS_THROUGH('a-upload')
  }
}

async function mountView(data: Record<string, unknown> | null = null) {
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'tester', tenantId: 15, roles: ['SITE_ADMIN'], permissions: [] } as any
  auth.selectedTenantId = null
  ;(companyInfoApi.get as any).mockResolvedValue(data)
  ;(companyInfoApi.provinces as any).mockResolvedValue(['北京市', '河南省', '福建省'])
  ;(vocabularyApi.portalVocabulary as any).mockResolvedValue(null)
  const View = (await import('../CompanyInfoView.vue')).default
  const wrapper = mount(View, { global: GLOBALS })
  await flushPromises()
  return wrapper
}

function progressText(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('.settings-page__progress-num').text()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('读数的分母是真的那一串格子，不是抄来的好看数', () => {
  it('8 组共 37 格，键与 COMPANY_FORM_DEFAULT 一一对应（多一格、少一格、重复一格都红）', () => {
    const declaredKeys = COMPANY_GROUPS.flatMap(group => group.fields.map(field => field.key))
    const formKeys = Object.keys(COMPANY_FORM_DEFAULT)
    expect(declaredKeys).toHaveLength(37)
    expect(new Set(declaredKeys).size, '字段清单里有重复的 key').toBe(declaredKeys.length)
    expect([...declaredKeys].sort()).toEqual([...formKeys].sort())
    expect(COMPANY_GROUPS.map(group => group.key)).toEqual([
      'basic', 'contact', 'intro', 'profile', 'keywords', 'brand', 'social', 'qualification'
    ])
  })

  it('只有公司名称一格算必填（保存闸真会拒的就是这一句），其余 36 格算「还差」不算「必填没填」', () => {
    const required = COMPANY_GROUPS.flatMap(group => group.fields).filter(field => field.required)
    expect(required.map(field => field.key)).toEqual(['companyName'])
    expect(VIEW_SOURCE).toMatch(/if \(!form\.companyName\?\.trim\(\)\)/)
  })

  it('8 张卡的名字逐个来自字段清单，视图不再自己摆卡', async () => {
    const wrapper = await mountView(null)
    const titles = wrapper.findAll('.settings-page__card-title').map(node => node.text())
    expect([...titles].sort()).toEqual(COMPANY_GROUPS.map(group => group.label).sort())
    // 卡这一层整个交给模板了：页面再写 a-card 就会长出第二种「一组卡怎么摆」
    expect(VIEW_SOURCE).not.toMatch(/<a-card/)
  })

  it('37 个字段名在视图里逐字出现（缺项清单点的那格 = 跳过去看到的标题）', () => {
    for (const group of COMPANY_GROUPS) {
      for (const field of group.fields) {
        expect(VIEW_SOURCE, `视图里没有「${field.label}」这句，读数点了它却找不到那一格`).toContain(field.label)
      }
    }
  })

  it('空表单时读数报「已填 0 / 共 37」，必填那一格单独点名', async () => {
    const wrapper = await mountView(null)
    expect(progressText(wrapper)).toBe('已填 0 / 共 37 项')
    expect(wrapper.find('.settings-page__required').text()).toContain('必填还没填')
    expect(wrapper.findAll('.settings-page__jump').map(node => node.text())).toContain('公司名称')
  })

  it('填了 5 格就说 5 格（多值那一格按后端那一列的字符串判，不看控件行数）', async () => {
    const wrapper = await mountView({
      companyName: '澜山国际旅行社',
      phone: '0571-88888888',
      email: 'hi@example.com',
      introduction: '做地接十五年',
      targetRegions: '北美,西欧'
    })
    expect(progressText(wrapper)).toBe('已填 5 / 共 37 项')
  })

  it('只有一串分隔符的那一格不算填过（逐行编辑器会留一个空行占位）', async () => {
    const wrapper = await mountView({
      companyName: '澜山国际旅行社',
      seedKeywords: ',，',
      excludedKeywords: '，'
    })
    expect(progressText(wrapper)).toBe('已填 1 / 共 37 项')
  })

  it('级联那一格选了主行业就算行业分类有值，细分行业仍是缺项', async () => {
    const wrapper = await mountView({ companyName: '澜山国际旅行社', industry: 'travel', subIndustry: '' })
    expect(progressText(wrapper)).toBe('已填 2 / 共 37 项')
    expect(wrapper.find('[data-missing-toggle]').text()).toBe('还差 35 项，点这里看')
  })
})

describe('省份与城市：清单唯一出处是后端，城市不再列白名单', () => {
  it('视图里一个省名都不再出现（改之前这里写死了 8 个）', () => {
    for (const province of ['北京市', '上海市', '广东省', '浙江省', '江苏省', '四川省', '湖北省', '山东省']) {
      expect(VIEW_SOURCE, `视图还写死了${province}`).not.toContain(province)
    }
    expect(VIEW_SOURCE).toMatch(/:options="provinceOptions"/)
    expect(VIEW_SOURCE).toMatch(/companyInfoApi\.provinces\(\)/)
  })

  it('下拉里的省份逐项来自读口，一条都不自己补', async () => {
    const wrapper = await mountView({ companyName: '澜山国际旅行社' })
    expect(companyInfoApi.provinces).toHaveBeenCalled()
    const provinceSelect = wrapper
      .findAll('.select-stub')
      .find(node => node.attributes('data-options') === '北京市,河南省,福建省')
    expect(provinceSelect, '省份下拉没有逐项吃到后端那一份清单').toBeTruthy()
  })

  it('读失败时那一格说的是「没取到」，不是「没有省份」', () => {
    expect(VIEW_SOURCE).toMatch(/省份清单没取到，刷新重试/)
    expect(VIEW_SOURCE).toMatch(/后端这份省份清单是空的/)
    // 城市那一格明说不列清单的理由，界面上留的是自由文本输入
    expect(VIEW_SOURCE).toMatch(/所在城市/)
    expect(VIEW_SOURCE).toMatch(/<a-input[\s\S]{0,120}form\.cityName/)
  })
})

describe('读失败这一档在屏上有落点（改之前只弹一个 toast）', () => {
  it('读失败：整组卡退场，只剩失败与重试', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, username: 'tester', tenantId: 15, roles: ['SITE_ADMIN'], permissions: [] } as any
    ;(companyInfoApi.get as any).mockRejectedValue(new Error('502 Bad Gateway'))
    ;(companyInfoApi.provinces as any).mockResolvedValue([])
    ;(vocabularyApi.portalVocabulary as any).mockResolvedValue(null)
    const View = (await import('../CompanyInfoView.vue')).default
    const wrapper = mount(View, { global: GLOBALS })
    await flushPromises()

    const block = wrapper.find('.admin-state-block')
    expect(block.attributes('data-state')).toBe('error')
    expect(block.text()).toContain('企业信息没读回来')
    expect(wrapper.findAll('.a-card-stub')).toHaveLength(0)
  })
})
