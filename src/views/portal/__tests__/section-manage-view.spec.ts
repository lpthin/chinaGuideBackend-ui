import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, Switch, message } from 'ant-design-vue'
import SectionManageView from '../SectionManageView.vue'
import { portalSectionsApi } from '../../../api/portalSections'
import { siteApi } from '../../../api/workspace'

/**
 * 超管栏目开关（Spec §5.2 / §7.2，N5）。
 *
 * 两条要紧的：
 * 1. 行的来源与显示名只能是接口——前端抄一份栏目清单，超管改名字就不再生效；
 * 2. 保存只发改动的那几项：后端把 null 当「这一项不动」，全量回传会把没动过的覆盖成默认值。
 *    「关掉栏目顺带收掉导航」也在这里验：那是四处一致最容易被一个漏勾打破的地方。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/portalSections', () => ({
  portalSectionsApi: { adminList: vi.fn(), adminUpdate: vi.fn(), list: vi.fn(), summary: vi.fn() }
}))
vi.mock('../../../api/workspace', () => ({ siteApi: { list: vi.fn() } }))

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  template: `
    <div class="table-stub">
      <div v-for="record in dataSource" :key="record.key" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label'],
  template: `<div class="${name}-stub"><slot /><slot name="message" /></div>`
})

function state(key: string, displayName: string, enabled = true, navVisible = true) {
  return {
    key,
    displayName,
    pageKind: key,
    dataSource: null,
    contentEntry: 'article',
    publicPath: `/${key}`,
    enabled,
    navVisible,
    navSort: 3,
    landingPageId: null
  }
}

async function mountView(
    states = [state('news', '资讯'), state('jobs', '招聘')],
    sites: Array<{ id: number; name: string }> = [{ id: 3, name: '演示站' }]
  ) {
  vi.mocked(siteApi.list).mockResolvedValue(sites as any)
  vi.mocked(portalSectionsApi.adminList).mockResolvedValue(states as any)
  vi.mocked(portalSectionsApi.adminUpdate).mockImplementation(async (_siteId: number, key: string) =>
    ({ ...states.find(row => row.key === key), ...lastForm() }) as any)
  const wrapper = mount(SectionManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-table': TABLE_STUB,
        'a-select': { name: 'ASelect', props: ['value', 'options'], template: '<select />' },
        'a-alert': PASS_THROUGH('a-alert'),
        'a-form': PASS_THROUGH('a-form'),
        'a-form-item': PASS_THROUGH('a-form-item'),
        'a-space': PASS_THROUGH('a-space'),
        'a-tag': PASS_THROUGH('a-tag'),
        'a-button': Button,
        'a-input': Input,
        'a-input-number': InputNumber,
        'a-switch': Switch
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** adminUpdate 最后一次调用的表单体，用来看「只发改动项」这条 */
function lastForm() {
  const calls = vi.mocked(portalSectionsApi.adminUpdate).mock.calls as any[]
  return calls.length ? calls[calls.length - 1][2] : {}
}

/** 每行的第一个 input 是显示名，第二个是导航顺序（数字框） */
function rowInputs(index: number): HTMLInputElement {
  return rowOf(index).querySelectorAll('input')[0] as HTMLInputElement
}

function rowOf(index: number) {
  return document.querySelectorAll('.row')[index]
}

function buttonsIn(scope: ParentNode) {
  return [...scope.querySelectorAll('button')] as HTMLButtonElement[]
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('行集合与默认值只来自接口', () => {
  it('每行显示的栏目名就是接口回的那个字', async () => {
    await mountView([state('news', '平台改过的名字'), state('jobs', '另一个名字')])
    expect(rowInputs(0).value).toBe('平台改过的名字')
    expect(rowInputs(1).value).toBe('另一个名字')
    expect(vi.mocked(portalSectionsApi.adminList)).toHaveBeenCalledWith(3)
  })

  it('没有站点上下文时不去查栏目表', async () => {
    await mountView([state('news', '资讯')], [])
    expect(vi.mocked(portalSectionsApi.adminList)).not.toHaveBeenCalled()
  })
})

describe('保存的体', () => {
  it('没动过的行保存按钮是灰的', async () => {
    await mountView()
    const save = buttonsIn(rowOf(0)).find(node => (node.textContent || '').trim() === '保 存')
    expect(save).toBeTruthy()
    expect(save!.disabled).toBe(true)
  })

  it('只发改动的那一项，其余留 null', async () => {
    const wrapper = await mountView()
    const input = rowOf(0).querySelector('input')!
    input.value = '新闻中心'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    const save = buttonsIn(rowOf(0)).find(node => (node.textContent || '').trim() === '保 存')
    expect(save!.disabled).toBe(false)
    save!.click()
    await flushPromises()

    expect(portalSectionsApi.adminUpdate).toHaveBeenCalledWith(3, 'news', {
      displayName: '新闻中心',
      enabled: null,
      navVisible: null,
      navSort: null
    })
    // 保存后草稿跟着接口回显走：显示名清空时后端回落成词表名，输入框不该留着空白
    expect(rowInputs(0).value).toBe('新闻中心')
  })

  it('关掉栏目时导航一起收，两项分开落库', async () => {
    await mountView()
    const switches = rowOf(0).querySelectorAll('.ant-switch')
    expect(switches.length).toBe(2)
    ;(switches[0] as HTMLButtonElement).click()
    await flushPromises()

    // 第二格（上导航）此刻既显示为关，也确实提交 false
    const save = buttonsIn(rowOf(0)).find(node => (node.textContent || '').trim() === '保 存')
    save!.click()
    await flushPromises()

    expect(portalSectionsApi.adminUpdate).toHaveBeenCalledWith(3, 'news', {
      displayName: null,
      enabled: false,
      navVisible: false,
      navSort: null
    })
  })

  it('栏目关着时「上导航」那个开关是灰的，不给一个点了没用的控件', async () => {
    await mountView([state('news', '资讯', false, true)])
    const switches = rowOf(0).querySelectorAll('.ant-switch')
    expect((switches[1] as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('写口只在建设域', () => {
  it('保存走的是 /admin 那条路径，不是租户侧的只读口', async () => {
    await mountView()
    const switches = rowOf(0).querySelectorAll('.ant-switch')
    ;(switches[0] as HTMLButtonElement).click()
    await flushPromises()
    buttonsIn(rowOf(0)).find(node => (node.textContent || '').trim() === '保 存')!.click()
    await flushPromises()

    expect(vi.mocked(portalSectionsApi.adminUpdate).mock.calls.length).toBe(1)
    expect(vi.mocked(portalSectionsApi.list)).not.toHaveBeenCalled()
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('已更新'))
  })
})
