import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceView from '../WorkspaceView.vue'

describe('WorkspaceView', () => {
  let wrapper: any

  // 布局类 stub 必须渲染默认插槽并带上组件名，否则嵌套的 header/sider/content/breadcrumb 既不会出现在 wrapper 里，也无法按名称查找到
  const layoutStub = (name: string) => ({
    name,
    template: '<div><slot /></div>',
  })

  beforeEach(() => {
    wrapper = mount(WorkspaceView, {
      global: {
        stubs: {
          'a-layout': layoutStub('ALayout'),
          'a-layout-header': layoutStub('ALayoutHeader'),
          'a-layout-content': layoutStub('ALayoutContent'),
          'a-layout-sider': layoutStub('ALayoutSider'),
          'a-breadcrumb': layoutStub('ABreadcrumb'),
          'a-menu': true,
          'a-menu-item': true,
          'a-sub-menu': true,
          'a-button': true,
          'a-dropdown': true,
          'a-divider': true,
          'a-tooltip': true,
          'a-breadcrumb-item': true,
          'router-view': true,
          'router-link': true,
          TenantSwitcher: true,
        },
      },
    })
  })

  it('renders correctly', () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('has the main layout structure', () => {
    expect(wrapper.findComponent({ name: 'ALayout' }).exists()).toBe(true)
  })

  it('has header section', () => {
    expect(wrapper.findComponent({ name: 'ALayoutHeader' }).exists()).toBe(true)
  })

  it('has sidebar section', () => {
    expect(wrapper.findComponent({ name: 'ALayoutSider' }).exists()).toBe(true)
  })

  it('has content section', () => {
    expect(wrapper.findComponent({ name: 'ALayoutContent' }).exists()).toBe(true)
  })

  it('has breadcrumb navigation', () => {
    expect(wrapper.findComponent({ name: 'ABreadcrumb' }).exists()).toBe(true)
  })
})
