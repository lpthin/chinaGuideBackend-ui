import { config } from '@vue/test-utils'
import { vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createHead } from '@vueuse/head'

setActivePinia(createPinia())

const router = createRouter({
  history: createMemoryHistory(),
  routes: [],
})

// 门户组件里用了 useHead（页面标题/meta），不装插件的话每个用例都会喷 injection 警告
config.global.plugins = [router, createHead()]
config.global.stubs = {
  'router-link': true,
  'router-view': true,
  'a-space': true,
  'a-card': true,
  'a-button': true,
  'a-checkbox': true,
  'a-checkbox-group': true,
  'a-tag': true,
  'a-progress': true,
  'a-select': true,
  'a-select-option': true,
  'a-input-search': true,
  'a-popconfirm': true,
  'a-table': true,
  'a-alert': true,
  'a-textarea': true,
  'a-modal': true,
  'a-slider': true,
  'a-form-item': true,
  'a-form': true,
  'a-spin': true,
  'a-row': true,
  'a-col': true,
  'a-switch': true,
  'a-tabs': true,
  'a-tab-pane': true,
  'a-collapse': true,
  'a-collapse-panel': true,
  'a-statistic': true,
  'a-tooltip': true,
  'a-empty': true,
  'a-divider': true,
}

// Mock ResizeObserver
;(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
;(globalThis as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
