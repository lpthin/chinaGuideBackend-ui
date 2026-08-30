import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceView from '../WorkspaceView.vue'

describe('WorkspaceView', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(WorkspaceView, {
      global: {
        stubs: {
          'a-layout': true,
          'a-layout-header': true,
          'a-layout-content': true,
          'a-layout-sider': true,
          'a-menu': true,
          'a-menu-item': true,
          'a-sub-menu': true,
          'a-button': true,
          'a-dropdown': true,
          'a-divider': true,
          'a-tooltip': true,
          'a-breadcrumb': true,
          'a-breadcrumb-item': true,
          'router-view': true,
          'router-link': true,
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
