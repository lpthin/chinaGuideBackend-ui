import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReferenceMappingsTab from '../ReferenceMappingsTab.vue'
import ReferenceUnmatchedTab from '../ReferenceUnmatchedTab.vue'
import ReferencePagesTab from '../ReferencePagesTab.vue'
import ReferencePackageTab from '../ReferencePackageTab.vue'

/**
 * SPEC-UI-6 M4：参考站四个 Tab 的错误态「接对函数」（这四栏此前没有 spec）。
 *
 * 四栏都不自己发读请求，`:retry` 是抽屉传下来的那一发。所以单测只钉一件事：
 * 读失败时**看得见重试**、点下去**调的是传进来那一发**，而恢复后行能上桌、不再说读失败。
 * 「抽屉给的是不是对的函数」由抽屉那一侧保证（:retry 三条都指向 loadPages / loadMappings / loadPackage）。
 */

const ATableStub = {
  name: 'ATable',
  props: ['dataSource', 'loading', 'rowKey', 'pagination', 'scroll'],
  template: '<div class="table-stub"><slot /></div>'
}

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /></div>`
})

const BUTTON_STUB = {
  name: 'AButton',
  emits: ['click'],
  template: '<button class="btn-stub" @click="$emit(\'click\')"><slot /></button>'
}

const COMMON_STUBS = {
  'a-table': ATableStub,
  'a-button': BUTTON_STUB,
  'a-alert': { props: ['message', 'description'], template: '<div class="alert-stub">{{ message }}{{ description }}</div>' },
  'a-empty': { props: ['description'], template: '<div class="empty-stub">{{ description }}</div>' },
  'a-space': PASS_THROUGH('ASpace'),
  'a-tag': PASS_THROUGH('ATag'),
  'a-tooltip': PASS_THROUGH('ATooltip'),
  'a-progress': { template: '<div class="progress-stub" />' },
  'a-modal': PASS_THROUGH('AModal'),
  'a-form': PASS_THROUGH('AForm'),
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-input': { template: '<input class="input-stub" />' },
  'a-textarea': { template: '<textarea class="textarea-stub" />' },
  'a-select': { template: '<select class="select-stub" />' }
}

const ERROR_LINE = '映射列表加载失败'
const RETRY_LABEL = '重试'

const errorBlock = (wrapper: any) => wrapper.find('.admin-state-block[data-state="error"]')
const retryButton = (wrapper: any) =>
  wrapper.findAll('button').find((node: any) => node.text().includes(RETRY_LABEL))

describe('参考站四个 Tab 的读失败重试', () => {
  it('区块映射：读失败看得见原因与重试，点了走传进来的那一发，恢复后行上桌', async () => {
    const retry = vi.fn()
    const wrapper = mount(ReferenceMappingsTab, {
      props: {
        referenceId: 7,
        mappings: [],
        loading: false,
        error: ERROR_LINE,
        retry,
        blocks: []
      },
      global: { stubs: COMMON_STUBS }
    })

    expect(errorBlock(wrapper).text()).toContain(ERROR_LINE)
    // M1 的判据照旧：还失败着的时候不许让「还没有映射」抢戏
    expect(wrapper.find('.empty-stub').exists()).toBe(false)

    await retryButton(wrapper)!.trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      error: null,
      mappings: [{ id: 11, observedBlock: 'hero', mappedBlockKey: 'hero_banner', humanVerified: true } as any]
    })
    expect(errorBlock(wrapper).exists()).toBe(false)
    expect(wrapper.findComponent(ATableStub).props('dataSource')).toHaveLength(1)
  })

  it('暂未对上：读失败时不许用空表冒充「一条都没有」，重试与恢复同样接对', async () => {
    const retry = vi.fn()
    const wrapper = mount(ReferenceUnmatchedTab, {
      props: { referenceId: 7, groups: [], loading: false, error: ERROR_LINE, retry },
      global: { stubs: COMMON_STUBS }
    })

    expect(errorBlock(wrapper).text()).toContain(ERROR_LINE)
    expect(wrapper.find('.empty-stub').exists()).toBe(false)

    await retryButton(wrapper)!.trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      error: null,
      groups: [{
        observedBlock: 'footer-nav',
        capabilityKnown: false,
        paths: ['/a'],
        rowCount: 1,
        mappingId: 21,
        note: null,
        promotedBlockKey: null
      }]
    })
    expect(errorBlock(wrapper).exists()).toBe(false)
    expect(wrapper.findComponent(ATableStub).props('dataSource')).toHaveLength(1)
  })

  it('路由清单：读失败看得见重试，点后恢复、行能上桌', async () => {
    const retry = vi.fn()
    const wrapper = mount(ReferencePagesTab, {
      props: {
        referenceId: 7,
        pages: [],
        loading: false,
        error: '页面列表加载失败',
        retry,
        selectable: false,
        selectedPageIds: [],
        vocabularies: null,
        vocabError: null,
        shotUrls: {}
      },
      global: { stubs: COMMON_STUBS }
    })

    expect(errorBlock(wrapper).text()).toContain('页面列表加载失败')

    await retryButton(wrapper)!.trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ error: null, pages: [{ id: 3, routePath: '/home' } as any] })
    expect(errorBlock(wrapper).exists()).toBe(false)
    expect(wrapper.findComponent(ATableStub).props('dataSource')).toHaveLength(1)
  })

  it('模板证据：还没载入过就读失败时，也要摆出重试——不能只留一句「还没载入」', async () => {
    const retry = vi.fn()
    const wrapper = mount(ReferencePackageTab, {
      props: { pkg: null, vocabularies: null, loading: false, error: '模板包载入失败', retry },
      global: { stubs: COMMON_STUBS }
    })

    expect(errorBlock(wrapper).text()).toContain('模板包载入失败')

    await retryButton(wrapper)!.trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ error: null, pkg: { pages: [], vocabularies: [], interactionHints: [] } as any })
    expect(errorBlock(wrapper).exists()).toBe(false)
  })
})
