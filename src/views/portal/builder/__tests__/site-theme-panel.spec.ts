import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Alert, Button, Divider, Input, Select, Space, Spin } from 'ant-design-vue'
import SiteThemePanel from '../SiteThemePanel.vue'
import { siteThemeApi } from '../../../../api/siteTheme'
import { themePresetsApi, type ThemeTokenField } from '../../../../api/themePresets'

vi.mock('../../../../api/siteTheme', () => ({
  siteThemeApi: { get: vi.fn(), update: vi.fn(), saveSkin: vi.fn(), applySkin: vi.fn() }
}))
vi.mock('../../../../api/themePresets', () => ({
  themePresetsApi: { list: vi.fn(), tokens: vi.fn() }
}))

/**
 * 站级主题面板（Spec-M §9.1 / 判据②④）。
 *
 * 这里钉的全是「点了到底发出去什么」：
 * 1. **清空发的是空串，不是 null**——null 在那道口是「这一列不动」，
 *    界面点了「清空站级主题」而库里旧颜色还在，就是又一次「改了但没生效」；
 * 2. 保存是整份替换，所以没设的键不许凭空出现；
 * 3. 存皮肤/套皮肤用的是站级那一份，不是逐页；
 * 4. 没有站点（「全部站点」那一档）时一个请求都不发，并且说清为什么不能改。
 *
 * 输入框本体用桩（ThemeTokenForm 自己的渲法由 design-tokens 那组用例与搭建器用例钉），
 * 按钮要真的：桩件不 emit，点了没反应也测不出载荷。
 */
const TOKEN_FORM_STUB = {
  name: 'ThemeTokenForm',
  props: ['fields', 'model', 'emptyHint'],
  emits: ['update', 'clear'],
  template: '<div class="token-form-stub">{{ emptyHint }}'
    + '<button class="write" @click="$emit(\'update\', \'colorPrimary\', \'#123456\')">写一个键</button>'
    + '<button class="unset" @click="$emit(\'update\', \'colorPrimary\', null)">清一个键</button>'
    + '</div>'
}

const stubs = {
  'a-button': Button,
  'a-card': { name: 'ACard', props: ['title'], template: '<div class="card-stub">{{ title }}<slot /><slot name="extra" /></div>' },
  'a-alert': Alert,
  'a-space': Space,
  'a-spin': Spin,
  'a-divider': Divider,
  'a-input': Input,
  'a-select': Select,
  ThemeTokenForm: TOKEN_FORM_STUB
}

const TOKENS = [
  { key: 'colorPrimary', kind: 'COLOR', min: 0, max: 0 },
  { key: 'fontHeading', kind: 'FONT', min: 0, max: 0, options: [{ value: 'songti', label: '宋体' }] }
] as const as unknown as ThemeTokenField[]

function buttonOf(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find(item => item.text() === label)
}

async function mountPanel(siteId: number | null) {
  const wrapper = mount(SiteThemePanel, {
    props: { siteId, fields: TOKENS },
    global: { stubs }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(siteThemeApi.get).mockResolvedValue({
    id: 9, name: '演示站', themeJson: '{"colorPrimary":"#1B6EF3"}', themePresetId: null, themeUpdatedAt: '2026-10-08 10:00:00'
  } as never)
  vi.mocked(siteThemeApi.update).mockResolvedValue({ id: 9, themeJson: null } as never)
  vi.mocked(siteThemeApi.saveSkin).mockResolvedValue({ id: 4 } as never)
  vi.mocked(siteThemeApi.applySkin).mockResolvedValue({ id: 9 } as never)
  vi.mocked(themePresetsApi.list).mockResolvedValue([
    { id: 4, name: '蓝白', tokensJson: '{"colorPrimary":"#1B6EF3"}' },
    { id: 5, name: '空的', tokensJson: null }
  ] as never)
})

describe('站点主题面板', () => {
  it('没选站点时一个请求都不发，并把「为什么不能改」写在明处', async () => {
    const wrapper = await mountPanel(null)
    expect(siteThemeApi.get).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('先在上方选一个站点')
  })

  it('取的是站点那一份，并写明这是全站打底的样式源', async () => {
    const wrapper = await mountPanel(9)
    expect(siteThemeApi.get).toHaveBeenCalledWith(9)
    expect(wrapper.text()).toContain('改一次，全站生效')
    expect(wrapper.text()).toContain('2026-10-08 10:00:00')
  })

  it('保存是整份替换：只把界面上真有的键发出去', async () => {
    const wrapper = await mountPanel(9)
    await wrapper.find('.token-form-stub .write').trigger('click')
    await buttonOf(wrapper, '保存（整份替换）')!.trigger('click')
    await flushPromises()
    expect(siteThemeApi.update).toHaveBeenCalledWith(9, '{"colorPrimary":"#123456"}')
  })

  it('最后一个键清掉以后，保存发的是空串（那才是「这一站没有站级主题」）', async () => {
    const wrapper = await mountPanel(9)
    await wrapper.find('.token-form-stub .unset').trigger('click')
    await buttonOf(wrapper, '保存（整份替换）')!.trigger('click')
    await flushPromises()
    expect(siteThemeApi.update).toHaveBeenCalledWith(9, '')
  })

  it('「清空站级主题」直接打那一个口，不靠先把每个键清一遍', async () => {
    const wrapper = await mountPanel(9)
    await buttonOf(wrapper, '清空站级主题')!.trigger('click')
    await flushPromises()
    expect(siteThemeApi.update).toHaveBeenCalledWith(9, '')
  })

  it('套皮肤写的是站级主题这一份，下拉里只摆真有样式变量的沉淀', async () => {
    const wrapper = await mountPanel(9)
    // 选项要读 Select 的那份 props：下拉节点只在展开后挂到 body 上，wrapper 里找不到 option
    const select = wrapper.findComponent(Select)
    // tokensJson 为空的那份不许摆进来：套进去等于把整站样式清空，那不是一份「皮肤」
    expect(select.props('options') as unknown[]).toEqual([{ value: 4, label: '蓝白' }])
    await select.vm.$emit('update:value', 4)
    const applyButton = buttonOf(wrapper, '套到整站')!
    expect(applyButton.attributes('disabled')).toBeUndefined()
    await applyButton.trigger('click')
    await flushPromises()
    expect(siteThemeApi.applySkin).toHaveBeenCalledWith(9, 4)
  })

  it('皮肤名字没填就不摆出「存为皮肤」的可点态', async () => {
    const wrapper = await mountPanel(9)
    expect(buttonOf(wrapper, '存为皮肤')!.attributes('disabled')).toBeDefined()
  })

  it('存完皮肤要重取清单：否则刚存的那一份在下拉里看不到', async () => {
    // 现场点出来的缺陷：清单命中缓存就直接返回，「已存成皮肤」的提示念完了，
    // 「选一份已有皮肤」里还是没有那一份，得刷新整页才出现。
    const wrapper = await mountPanel(9)
    expect(themePresetsApi.list).toHaveBeenCalledTimes(1)
    await wrapper.find('input[placeholder*=皮肤]').setValue('新皮肤')
    await buttonOf(wrapper, '存为皮肤')!.trigger('click')
    await flushPromises()
    expect(siteThemeApi.saveSkin).toHaveBeenCalledWith(9, '新皮肤')
    expect(themePresetsApi.list).toHaveBeenCalledTimes(2)
  })
})
