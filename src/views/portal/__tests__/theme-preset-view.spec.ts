import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { Button, Checkbox, Input, message, Select, Tag } from 'ant-design-vue'
import ThemePresetView from '../ThemePresetView.vue'
import { themePresetsApi } from '../../../api/themePresets'
import { portalPagesApi } from '../../../api/portalPages'
import { siteApi } from '../../../api/workspace'
import { useAuthStore } from '../../../stores/auth'

/**
 * message 走的是全局浮层：happy-dom 里它要靠 rAF 才挂得出来（本仓库的已知环境限制），
 * 所以换成假的，直接看调用参数——「成功了」这句话里的版本号必须来自服务端回读，不能是界面自己 +1。
 */
vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/themePresets', () => ({
  themePresetsApi: {
    tokens: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    saveSkin: vi.fn(),
    apply: vi.fn(),
    instantiate: vi.fn(),
    remove: vi.fn(),
    promote: vi.fn()
  }
}))
vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { list: vi.fn(), get: vi.fn(), save: vi.fn() }
}))
vi.mock('../../../api/workspace', () => ({
  siteApi: { list: vi.fn() }
}))

/**
 * 沉淀视图的交互契约（Spec §8.1）。
 *
 * setup.ts 把所有 a-* 桩成空壳，而桩件不会 emit，用它测出来的「点了没反应」是假的，
 * 所以这里把用到的控件换成真组件。只有 a-modal 换成一个「open=false 就不渲染」的壳：
 * 真 Modal 走 teleport + rAF 动画，测的是弹层本身；这里要钉住的是
 * 「点按钮 → 表单挂出来 → 提交带的是什么」，这条链路全部保持真实。
 */
const MODAL_STUB = {
  name: 'AModal',
  props: ['open', 'title', 'confirmLoading', 'okText'],
  emits: ['update:open', 'ok'],
  template:
    '<div v-if="open" class="modal-stub" :data-title="title"><slot /><button class="modal-ok" @click="$emit(\'ok\')">确 定</button></div>'
}

const PASS_THROUGH = (name: string, extra = '') => ({
  name,
  props: ['title', 'message', 'type', 'description'],
  template: `<div class="${name}-stub">${extra}<slot /><slot name="message" /></div>`
})

/**
 * setup.ts 把 a-* 全桩成「什么都不渲染」，而按钮恰好都长在 a-space / a-form-item / a-popconfirm 里面，
 * 沿用那套桩件等于把要测的控件全删了，所以外壳一律换成「渲染默认插槽」的壳。
 */
const POPCONFIRM_STUB = {
  name: 'APopconfirm',
  props: ['title'],
  emits: ['confirm'],
  template: '<span class="popconfirm-stub"><slot /><button class="popconfirm-ok" @click="$emit(\'confirm\')">确定</button></span>'
}

/**
 * 真 a-table 在这个环境里渲不出表体（它内部还要 Spin 与测量那一层），
 * 而这里要钉的是「行内按钮 → 提交载荷」，所以换成按 dataSource 逐行走 bodyCell 插槽的壳：
 * bodyCell 里的判断与按钮仍然是视图自己的代码。
 */
const TABLE_STUB = defineComponent({
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  setup(props: any, { slots }: any) {
    return () =>
      h(
        'div',
        { class: 'table-stub' },
        props.dataSource.flatMap((record: any) =>
          props.columns.map((column: any) =>
            column.key === 'op' && slots.bodyCell ? slots.bodyCell({ column, record }) : null
          )
        )
      )
  }
})

const PAGE = {
  id: 43,
  tenantId: 15,
  siteId: 1,
  slug: 'contact',
  title: '联系我们',
  pageKind: 'contact',
  status: 'published',
  version: 3,
  navVisible: true,
  navSort: 5,
  isDemo: false,
  layoutJson: '{"blocks":[]}',
  themeJson: '{"colorPrimary":"#1B6EF3"}'
}

const SKIN = {
  id: 7,
  tenantId: 15,
  name: '诊所蓝',
  tokensJson: '{"colorPrimary":"#1B6EF3","radius":"14px"}',
  layoutJson: null,
  sourcePageId: 43,
  strippedJson: null,
  createdBy: 'jingtian_admin',
  provenanceUrl: null,
  provenanceNote: null,
  isPlatform: false,
  approvedBy: null,
  approvedAt: null,
  createdAt: '2026-09-24T10:00:00',
  updatedAt: '2026-09-24T10:00:00'
}

const TEMPLATE = { ...SKIN, id: 8, tenantId: 0, name: '口腔门诊·标准首页', isPlatform: true, layoutJson: '{"blocks":[]}' }

function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(node => (node.textContent || '').trim() === text)
}

async function mountView(permissionCodes: string[]) {
  const auth = useAuthStore()
  auth.user = {
    id: 1,
    username: 'tester',
    roles: ['SITE_ADMIN'],
    permissions: permissionCodes
  } as any
  const wrapper = mount(ThemePresetView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-input': Input,
        'a-select': Select,
        'a-checkbox': Checkbox,
        'a-table': TABLE_STUB,
        'a-tag': Tag,
        'a-modal': MODAL_STUB,
        'a-popconfirm': POPCONFIRM_STUB,
        'a-space': PASS_THROUGH('ASpace'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-empty': PASS_THROUGH('AEmpty')
      }
    }
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

function pickSelect(wrapper: any, index: number, value: number) {
  const select = wrapper.findAllComponents(Select)[index]
  expect(select, '页面上应有第 ' + (index + 1) + ' 个下拉').toBeTruthy()
  select.vm.$emit('update:value', value)
  return select
}

describe('ThemePresetView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(themePresetsApi.list).mockResolvedValue([SKIN, TEMPLATE] as any)
    vi.mocked(themePresetsApi.tokens).mockResolvedValue([
      { key: 'colorPrimary', kind: 'COLOR', min: 0, max: 0 },
      { key: 'radius', kind: 'LENGTH', min: 0, max: 0 }
    ] as any)
    vi.mocked(portalPagesApi.list).mockResolvedValue([PAGE] as any)
    vi.mocked(siteApi.list).mockResolvedValue([{ id: 1, name: '小山口腔' }] as any)
  })

  it('「沉淀为平台模板」只发给有 promote 权限的人', async () => {
    const tenantWrapper = await mountView(['portal:build:preset'])
    expect(byText('沉淀为平台模板').length).toBe(0)
    expect(byText('把页面样式沉淀为皮肤').length).toBe(1)
    tenantWrapper.unmount()

    const adminWrapper = await mountView(['portal:build:preset', 'portal:template:promote'])
    expect(byText('沉淀为平台模板').length).toBe(1)
    adminWrapper.unmount()
  })

  it('皮肤行给「应用到页面」，平台模板行才给「用此模板建页」', async () => {
    const wrapper = await mountView(['portal:build:preset'])
    const labels = [...document.querySelectorAll('button')].map(node => (node.textContent || '').trim())
    expect(labels.filter(l => l === '应用到页面').length).toBe(2)
    expect(labels.filter(l => l === '用此模板建页').length).toBe(1)
    wrapper.unmount()
  })

  it('点「把页面样式沉淀为皮肤」才挂出表单，选好页面后提交的是 trim 过的名称', async () => {
    vi.mocked(themePresetsApi.saveSkin).mockResolvedValue(SKIN as any)
    const wrapper = await mountView(['portal:build:preset'])
    expect(document.querySelector('.modal-stub')).toBeFalsy()

    byText('把页面样式沉淀为皮肤')[0].click()
    await nextTick()
    const modal = document.querySelector('.modal-stub') as HTMLElement
    expect(modal.dataset.title).toBe('把页面样式沉淀为皮肤')

    // 没选页面就确定：一次请求都不该发出去（服务端也会拒，但界面不该把人送去撞）
    vi.mocked(themePresetsApi.saveSkin).mockClear()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(themePresetsApi.saveSkin).not.toHaveBeenCalled()

    pickSelect(wrapper, 0, PAGE.id)
    const nameInput = wrapper.findAllComponents(Input).find(node => node.props('placeholder') === '例如：诊所蓝 · 大字号')
    expect(nameInput, '皮肤名称输入框应挂在真实 a-input 上').toBeTruthy()
    nameInput!.vm.$emit('update:value', '  诊所蓝·大字号  ')
    await nextTick()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(themePresetsApi.saveSkin).toHaveBeenCalledWith({ pageId: PAGE.id, name: '诊所蓝·大字号' })
    wrapper.unmount()
  })

  it('应用皮肤带的是页面列表里那一份 version，成功后提示用服务端回读的版本号', async () => {
    vi.mocked(themePresetsApi.apply).mockResolvedValue({ ...PAGE, version: 4 } as any)
    const wrapper = await mountView(['portal:build:preset'])

    byText('应用到页面')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    const modal = document.querySelector('.modal-stub') as HTMLElement
    expect(modal.dataset.title).toBe('应用皮肤到页面')

    pickSelect(wrapper, 0, PAGE.id)
    await nextTick()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    // baseVersion 取自 portalPagesApi.list 回来的 version=3，不是界面自己猜的
    expect(themePresetsApi.apply).toHaveBeenCalledWith(SKIN.id, { pageId: PAGE.id, baseVersion: 3 })
    const successLines = vi.mocked(message.success).mock.calls.map(call => String(call[0]))
    expect(successLines.some(line => line.includes('现在版本为 v4'))).toBe(true)
    wrapper.unmount()
  })

  it('不勾「已人工确认来源与近似度」就提交不了平台模板', async () => {
    const wrapper = await mountView(['portal:build:preset', 'portal:template:promote'])
    byText('沉淀为平台模板')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    const modal = document.querySelector('.modal-stub') as HTMLElement
    expect(modal.dataset.title).toBe('沉淀为平台模板')

    pickSelect(wrapper, 0, PAGE.id)
    const inputs = wrapper.findAllComponents(Input)
    inputs.find(node => node.props('placeholder') === '例如：口腔门诊 · 标准首页')!.vm.$emit('update:value', '口腔门诊·标准首页')
    inputs.find(node => node.props('placeholder') === 'https://...')!.vm.$emit('update:value', 'https://example.com/ref')
    await nextTick()
    vi.mocked(themePresetsApi.promote).mockClear()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(themePresetsApi.promote).not.toHaveBeenCalled()

    wrapper.findAllComponents(Checkbox)[0].vm.$emit('update:checked', true)
    await nextTick()
    modal.querySelector('.modal-ok')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(themePresetsApi.promote).toHaveBeenCalledWith({
      pageId: PAGE.id,
      name: '口腔门诊·标准首页',
      provenanceUrl: 'https://example.com/ref',
      provenanceNote: null,
      provenanceReviewed: true
    })
    wrapper.unmount()
  })
})
