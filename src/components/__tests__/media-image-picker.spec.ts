import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, message } from 'ant-design-vue'
import MediaImageLibraryModal from '../MediaImageLibraryModal.vue'
import MediaImagePicker from '../MediaImagePicker.vue'

/**
 * 图片字段的取值入口（Spec §12 D3）。
 *
 * 钉住三条纪律：
 * 1. 列媒体库**必须**带 tenantId——不带就是让超管在所有客户的素材里挑，给客户搭站挑到别人的 logo；
 * 2. 读失败要说读失败，不能显示成「这个客户还没图」；
 * 3. 手填地址这条路不能被选择器堵死（外链与临时图还要用）。
 */

const http = { get: vi.fn(), post: vi.fn() }
const auth = { selectedTenantId: null as number | null, tenantId: 1 as number | null }

vi.mock('@/api/http', () => ({
  default: {
    get: (...args: unknown[]) => http.get(...args),
    post: (...args: unknown[]) => http.post(...args)
  },
  describeHttpError: (e: unknown) => String((e as any)?.message ?? e)
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))

const MODAL_STUB = {
  name: 'AModal',
  props: ['open', 'title'],
  emits: ['update:open', 'pick'],
  template: '<div v-if="open" class="modal-stub"><slot /></div>'
}
const PASS_THROUGH = (name: string) => ({
  name,
  props: ['description', 'spinning'],
  template: `<div class="${name}-stub">{{ description }}<slot /></div>`
})

const GLOBALS = {
  components: { 'a-input': Input, 'a-button': Button },
  stubs: {
    'a-modal': MODAL_STUB,
    'a-spin': PASS_THROUGH('ASpin'),
    'a-empty': PASS_THROUGH('AEmpty'),
    'a-input-search': true,
    'a-pagination': true,
    'a-upload': true,
    // setup.ts 全局把 a-button 桩成空壳，桩件不渲染 slot 也不 emit，点开弹窗这条路径就测不到真控件
    'a-button': false
  }
}

function page(rows: unknown[]) {
  return { records: rows, total: rows.length, page: 1, size: 12 }
}

function lastArgs(wrapper: { emitted: (event: string) => unknown[][] | undefined }, event: string) {
  const calls = wrapper.emitted(event)
  return calls ? calls[calls.length - 1] : undefined
}

async function mountModal() {
  const wrapper = mount(MediaImageLibraryModal, {
    props: { open: true },
    global: GLOBALS
  })
  await flushPromises()
  return wrapper
}

describe('媒体库挑图弹窗', () => {
  beforeEach(() => {
    http.get.mockReset()
    http.post.mockReset()
    auth.selectedTenantId = 7
    auth.tenantId = 1
  })

  it('打开就带 tenantId 查图片，不带路径级的全库列举', async () => {
    http.get.mockResolvedValue(page([]))
    await mountModal()
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get.mock.calls[0]![1]).toMatchObject({
      params: { tenantId: 7, fileType: 'image', page: 1, size: 12 }
    })
  })

  it('超管没选定客户时不发请求，也不给一墙别人的素材', async () => {
    auth.selectedTenantId = null
    auth.tenantId = null
    const warn = vi.spyOn(message, 'warning').mockImplementation(() => ({}) as any)
    const wrapper = await mountModal()
    expect(http.get).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    expect(wrapper.findAll('.media-library__cell')).toHaveLength(0)
    warn.mockRestore()
  })

  it('读失败说读失败，不显示成「这个客户还没图」', async () => {
    http.get.mockRejectedValue(new Error('媒体库服务没起来'))
    const error = vi.spyOn(message, 'error').mockImplementation(() => ({}) as any)
    const wrapper = await mountModal()
    expect(error).toHaveBeenCalledWith('媒体库服务没起来')
    expect(wrapper.text()).not.toContain('还没有图片')
    error.mockRestore()
  })

  it('挑中一张：交回地址与文件名，并收起弹窗', async () => {
    http.get.mockResolvedValue(page([{ id: 3, name: '诊所门面.jpg', url: '/uploads/clinic.jpg', width: 800, height: 600, fileSize: 20480 }]))
    const wrapper = await mountModal()
    expect(wrapper.findAll('.media-library__cell')).toHaveLength(1)
    const cell = wrapper.findAll('.media-library__cell')[0]!
    expect(cell.text()).toContain('诊所门面.jpg')
    expect(cell.text()).toContain('800×600')
    await cell.trigger('click')
    expect(wrapper.emitted('pick')).toEqual([['/uploads/clinic.jpg', '诊所门面.jpg']])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})

describe('字段级图片选择器', () => {
  beforeEach(() => {
    http.get.mockReset()
    auth.selectedTenantId = 7
    auth.tenantId = 1
  })

  function mountPicker(modelValue = '') {
    return mount(MediaImagePicker, {
      props: { modelValue },
      global: {
        ...GLOBALS,
        stubs: { ...GLOBALS.stubs, MediaImageLibraryModal: MODAL_STUB }
      }
    })
  }

  it('手填地址照样能写：这是选择器不是替代品', async () => {
    const wrapper = mountPicker('')
    await wrapper.find('input').setValue('/uploads/hand-typed.jpg')
    expect(lastArgs(wrapper, 'update:modelValue')).toEqual(['/uploads/hand-typed.jpg'])
  })

  it('已有值时显示缩略预览，没值时直说访客看到的是什么', () => {
    expect(mountPicker('/uploads/a.jpg').find('.media-field__preview').exists()).toBe(true)
    expect(mountPicker('').text()).toContain('一块空白')
  })

  it('点「从媒体库选」才挂载挑图弹窗，挑中即写入字段', async () => {
    const wrapper = mountPicker('')
    expect(wrapper.findComponent(MODAL_STUB).exists()).toBe(false)
    const openButton = wrapper.findAll('button').find(b => b.text().includes('从媒体库选'))
    expect(openButton, '「从媒体库选」按钮得是真控件').toBeTruthy()
    await openButton!.trigger('click')
    await nextTick()
    const modal = wrapper.findComponent(MODAL_STUB)
    expect(modal.exists()).toBe(true)
    modal.vm.$emit('pick', '/uploads/picked.jpg', 'picked.jpg')
    expect(lastArgs(wrapper, 'update:modelValue')).toEqual(['/uploads/picked.jpg'])
  })
})
