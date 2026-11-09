import { describe, it, expect, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import RouteErrorBoundary from '../RouteErrorBoundary.vue'

/**
 * SPEC-UI-9 H1-1：渲染异常不许白屏——兜底块要说清「这块没加载出来」，
 * 并给一个明确动作「刷新本页」。
 */
const BUTTON = {
  name: 'AButton',
  emits: ['click'],
  template: '<button class="btn-stub" @click="$emit(\'click\')"><slot /></button>',
}

afterEach(() => {
  vi.restoreAllMocks()
})

interface BoomState {
  boom: boolean
}

/** 用外部开关控制这一块是否抛错，便于验证「换页后兜底收回」 */
function boomComponent(state: BoomState) {
  return defineComponent({
    name: 'BoomBlock',
    render() {
      if (state.boom) throw new Error('render exploded')
      return h('div', { class: 'normal-block' }, '正常内容')
    }
  })
}

describe('RouteErrorBoundary', () => {
  it('子树渲染抛错时摆兜底块与「刷新本页」，不白屏', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const state: BoomState = reactive({ boom: true })
    const w = mount(RouteErrorBoundary, {
      props: { resetKey: '/workspace/a' },
      slots: { default: boomComponent(state) },
      global: { stubs: { 'a-button': BUTTON } }
    })
    // onErrorCaptured 在首屏渲染中把 failed 置真，兜底块等这一轮 flush 后才出现
    await nextTick()

    const fallback = w.find('.route-error-boundary__fallback')
    expect(fallback.exists()).toBe(true)
    expect(fallback.text()).toContain('这块没加载出来')
    expect(fallback.find('.route-error-boundary__refresh').text()).toBe('刷新本页')
    // 兜底本身也留痕，控制台之外仍有记录
    expect(console.error).toHaveBeenCalledWith('[ui-error] app/render-error', expect.any(Error))
  })

  it('换页（resetKey 变化）后兜底收回，新页面正常渲染', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const state: BoomState = reactive({ boom: true })
    const w = mount(RouteErrorBoundary, {
      props: { resetKey: '/workspace/a' },
      slots: { default: boomComponent(state) },
      global: { stubs: { 'a-button': BUTTON } }
    })
    await nextTick()
    expect(w.find('.route-error-boundary__fallback').exists()).toBe(true)

    state.boom = false
    await w.setProps({ resetKey: '/workspace/b' })
    await nextTick()

    expect(w.find('.route-error-boundary__fallback').exists()).toBe(false)
    expect(w.text()).toContain('正常内容')
  })

  it('没有异常时原样渲染插槽（兜底不干扰正常页面）', () => {
    const w = mount(RouteErrorBoundary, {
      props: { resetKey: '/workspace/a' },
      slots: { default: '<div class="content">页面内容</div>' }
    })
    expect(w.find('.content').text()).toBe('页面内容')
    expect(w.find('.route-error-boundary__fallback').exists()).toBe(false)
  })
})
