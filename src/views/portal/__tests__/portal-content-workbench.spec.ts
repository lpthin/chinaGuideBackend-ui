import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import PortalContentWorkbenchView from '../PortalContentWorkbenchView.vue'
import { portalSectionsApi } from '../../../api/portalSections'
import { portalPagesApi } from '../../../api/portalPages'

/**
 * 租户「内容工作台」（Spec §7.1）。
 *
 * 这一页要守的是两件事，都是以前踩过的那类：
 * 1. 卡集合与名字**只能**来自 `/api/portal/sections`——前端一旦抄一份，超管改完显示名这里还写着老字；
 * 2. 页面上不许长出任何开关（N1/N2）。租户能做的只有「去看这一栏的访客视角」和「去填内容」。
 */

const pushSpy = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy })
}))

vi.mock('../../../api/portalSections', () => ({
  portalSectionsApi: { list: vi.fn(), summary: vi.fn() }
}))
vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { statusLabels: vi.fn(), list: vi.fn() }
}))

const PASS_THROUGH = (name: string, extraSlots: string[] = []) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'column', 'checked', 'disabled'],
  template: `<div class="${name.toLowerCase()}-stub"><span>${'{{ description }}'}</span><slot name="title" />${extraSlots
    .map(slot => `<slot name="${slot}" />`)
    .join('')}<slot /></div>`
})

function state(key: string, displayName: string, contentEntry: string, enabled = true) {
  return {
    key,
    displayName,
    pageKind: key,
    dataSource: null,
    contentEntry,
    publicPath: `/${key}`,
    enabled,
    navVisible: enabled,
    navSort: 1,
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

async function mountView(states: ReturnType<typeof state>[], summaries: Record<string, any> = {},
                        failedKeys: string[] = []) {
  vi.mocked(portalSectionsApi.list).mockResolvedValue(states as any)
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
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-card': PASS_THROUGH('ACard', ['actions'])
      }
    }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('栏目卡集合只来自接口', () => {
  it('卡上的名字就是接口回的那几个字', async () => {
    const wrapper = await mountView([state('news', '平台改过的名字', 'article')])
    expect(wrapper.text()).toContain('平台改过的名字')
    expect(wrapper.findAll('.acard-stub')).toHaveLength(1)
  })

  it('关掉的栏目不出卡，也不为它发统计请求', async () => {
    const wrapper = await mountView([
      state('news', '资讯栏', 'article'),
      state('jobs', '招聘栏', 'job', false)
    ])
    expect(wrapper.text()).toContain('资讯栏')
    expect(wrapper.text()).not.toContain('招聘栏')
    const asked = vi.mocked(portalSectionsApi.summary).mock.calls.map(call => call[0])
    expect(asked).toEqual(['news'])
  })

  it('一个栏目都没开时说明白，而不是留一片空白', async () => {
    const wrapper = await mountView([])
    expect(wrapper.find('.aempty-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('还没有为这个站点开通任何栏目')
  })
})

describe('三个数字的口径', () => {
  it('零条时说「还没有内容」，不是冷冰冰的 0', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {
      news: summary('news', {
        contentCount: 0,
        landingPageId: null,
        landingPageStatus: null,
        completeness: completeness({ level: 'empty', label: '还没有内容', hint: '访客在这一栏目里看不到任何内容，从「去维护」里发一条就有', missingImageCount: 0 })
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
  /** 只看卡上那几个档位标签的文字：行标签是界面自己的字段名，不参与「中文谁说的」这场判断 */
  const tagTexts = (wrapper: Awaited<ReturnType<typeof mountView>>) =>
    wrapper.findAll('.atag-stub').map(node => node.text())

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

  it('卡上的档位与说明都来自接口：后端换成什么字，界面就照说什么', async () => {
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

  it('统计没回来的那一卡不许亮出「内容完整」，也不补一个默认档', async () => {
    const wrapper = await mountView([state('news', '资讯栏', 'article')], {}, ['news'])
    expect(wrapper.text()).toContain('统计未就绪')
    expect(wrapper.text()).toContain('完整度统计未就绪')
    // 档位标签整个不渲染，而不是渲染一个界面自己猜的档
    expect(wrapper.findAll('.atag-stub')).toHaveLength(0)
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

  it('访客地址那一格链到的是后端给的对外地址', async () => {
    await mountView([state('news', '资讯栏', 'article')])
    const link = [...document.querySelectorAll('a')].find(node => (node.textContent || '').trim() === '/news')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('https://acme.example/news')
  })
})
