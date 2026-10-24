import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { message } from 'ant-design-vue'
import ImageLibraryView from '../ImageLibraryView.vue'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * Spec-J（J1/J3）在租户侧的两条落点：
 * 1. 筛选项必须来自 /media/categories 的真实类别——旧版这里硬编码六个假类别，
 *    与库里一个都对不上，选任何一项都筛不出东西；
 * 2. 列表请求不再需要前端自己躲系统素材组——服务端默认排除（反例钉在 BE 侧 MediaControllerTest）。
 */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  categories: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  uploadBatch: vi.fn(),
  delete: vi.fn(),
  batchDelete: vi.fn(),
}))
const auth = vi.hoisted(() => ({ selectedTenantId: 15 as number | null, tenantId: 1 as number | null }))

vi.mock('../../../api/article', () => ({ imageLibraryApi: api }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))

const PASS = (cls: string) => ({
  name: cls,
  template: `<div class="${cls}-stub"><slot name="title" /><slot /></div>`,
})

const GLOBALS = {
  stubs: {
    'a-space': PASS('ASpace'),
    'a-card': PASS('ACard'),
    'a-row': PASS('ARow'),
    'a-col': PASS('ACol'),
    'a-spin': PASS('ASpin'),
    'a-select': PASS('ASelect'),
    'a-select-option': { name: 'ASelectOption', template: '<span class="opt"><slot /></span>' },
  },
}

async function mountView() {
  const wrapper = mount(ImageLibraryView, { global: GLOBALS as any })
  await flushPromises()
  return wrapper
}

describe('素材库（原图片库）的类别口径', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.list.mockResolvedValue({
      records: [
        { id: 1, name: 'clinic.jpg', category: '企业基础资料', url: '/uploads/a.jpg', mimeType: 'image/jpeg', fileSize: 10, useCount: 1, createdAt: '2026-10-01T00:00:00' },
      ],
      total: 1,
      page: 1,
      size: 24,
    })
    api.categories.mockResolvedValue([
      { category: '企业基础资料', count: 9 },
      { category: '诊疗项目库', count: 9 },
    ])
  })

  it('筛选项来自真实类别接口，旧的六个假类别一个都不在', async () => {
    const wrapper = await mountView()
    expect(api.categories).toHaveBeenCalledTimes(1)
    const options = wrapper.findAll('.opt').map(o => o.text())
    expect(options).toContain('企业基础资料（9）')
    expect(options).toContain('诊疗项目库（9）')
    for (const fake of ['产品图片', '文章配图', '用户头像', '活动海报', '公司相册', '其他']) {
      expect(options.join('|'), `假类别 ${fake} 不许回潮`).not.toContain(fake)
    }
  })

  it('分类数统计读真实类别数，不再是当前页里去重出来的近似值', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('分类数')
    const statValues = wrapper.findAll('.stat-value').map(n => n.text())
    expect(statValues).toContain('2')
  })

  it('类别接口失败不弹一墙空筛选项之外的谎：列表照常，类别选项就是空', async () => {
    api.categories.mockRejectedValue(new Error('接口没起来'))
    const wrapper = await mountView()
    const categoryOptions = wrapper.findAll('.opt').map(o => o.text()).filter(t => t.includes('（'))
    expect(categoryOptions).toHaveLength(0)
    expect(wrapper.findAll('.grid-item')).toHaveLength(1)
  })
})

/**
 * 全站普查（pass A2）在素材库现场抓到的那条：库自 Spec-J 起列的是全部类别，
 * 但缩略图一律 <img src>，于是一份 .docx 也在往 /uploads 要图 —— 界面上是一个碎图图标，
 * 控制台里是一串 onerror。非图片要有非图片的样子，图片读不出来也要有话可说。
 */
describe('素材库的缩略图：非图片不许当图片渲染', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.categories.mockResolvedValue([])
    api.list.mockResolvedValue({
      records: [
        { id: 1, name: 'clinic.jpg', category: '企业基础资料', url: '/uploads/a.jpg', fileType: 'image/jpeg', mimeType: 'image/jpeg', fileSize: 10 },
        { id: 2, name: '12_口腔常见问题FAQ.docx', category: '诊疗项目库', url: '/uploads/b.docx', fileType: 'application/octet-stream', mimeType: 'application/octet-stream', fileSize: 20 },
        { id: 3, name: 'faq.txt', category: '诊疗项目库', url: '/uploads/c.txt', fileType: 'text/plain', mimeType: 'text/plain', fileSize: 30 },
      ],
      total: 3,
      page: 1,
      size: 24,
    })
  })

  it('只有图片行发 <img>，docx/txt 行走类别块，一个多余的图请求都不发', async () => {
    const wrapper = await mountView()
    const imgs = wrapper.findAll('.image-thumbnail img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].attributes('src')).toBe('/uploads/a.jpg')
    const tiles = wrapper.findAll('.file-tile')
    expect(tiles).toHaveLength(2)
    expect(tiles.map(t => t.text()).join('|')).toContain('DOCX')
    expect(tiles.map(t => t.text()).join('|')).toContain('TXT')
  })

  it('图片在服务器上读不出来时换成占位，而不是留一个浏览器碎图', async () => {
    const wrapper = await mountView()
    const img = wrapper.find('.image-thumbnail img')
    expect(img.exists()).toBe(true)
    await img.trigger('error')
    expect(wrapper.find('.image-thumbnail img').exists()).toBe(false)
    const failedTile = wrapper.findAll('.file-tile').find(t => t.text().includes('文件读不出来'))
    expect(failedTile, '读不出来的图要写成「文件读不出来」').toBeTruthy()
  })
})

/**
 * 素材库的空态（M-P71）：这一屏的空会被读成「这一家的素材没了」，
 * 而 Spec-J 起系统素材组本来就不在这一档里——所以「读不到」与「真的没有」必须念后端那一句。
 *
 * 钉五件：三种空逐字念、后端没答不替它猜、读失败说读失败、
 * 翻过头自动翻回第一页、「真的没有」才摆上传按钮；网格与列表两种形态念同一句。
 */
const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '素材库：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '素材库：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '素材库：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。'],
]

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { default: false }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, rows.length === 0
        ? h('div', { class: 'table-empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
        : rows.map(record => h('div', { class: 'table-row' }, String(record.name))))
    }
  }
}

const PAGINATION_STUB = {
  name: 'APagination',
  emits: ['change', 'update:current', 'update:pageSize'],
  setup(_: any, { emit }: any) {
    return () => h('button', { class: 'go-page-3', onClick: () => emit('change', 3, 24) }, '到第 3 页')
  }
}

const RADIO_GROUP_STUB = {
  name: 'ARadioGroup',
  emits: ['update:value'],
  setup(_: any, { slots, emit }: any) {
    return () => h('div', { class: 'radio-stub' }, [
      h('button', { class: 'to-list-view', onClick: () => emit('update:value', 'list') }, '列表视图'),
      slots.default ? slots.default() : null
    ])
  }
}

const PASS_SLOT = (cls: string) => ({
  name: cls,
  template: `<div class="${cls}-stub"><slot /><slot name="actions" /></div>`
})

type PageShape = { records: any[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountEmpty(
  rows: any[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  const list = vi.mocked(api.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  const wrapper = mount(ImageLibraryView, {
    attachTo: document.body,
    global: {
      stubs: {
        'filter-bar': PASS_SLOT('FilterBar'),
        'a-card': PASS_SLOT('ACard'),
        'a-row': PASS_SLOT('ARow'),
        'a-col': PASS_SLOT('ACol'),
        'a-spin': PASS_SLOT('ASpin'),
        'a-select': PASS_SLOT('ASelect'),
        'a-select-option': PASS_SLOT('ASelectOption'),
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-radio-group': RADIO_GROUP_STUB,
        'a-radio-button': { name: 'ARadioButton', template: '<span><slot /></span>' },
        'a-table': TABLE_STUB,
        'a-pagination': PAGINATION_STUB,
        'a-tag': PASS_SLOT('ATag')
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 后端那一句（「真的没有」那一档下面还会多摆一颗上传按钮，比那一句时把它摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

describe('素材库的空态成因', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.categories.mockResolvedValue([])
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountEmpty([], { emptyReason: reason, emptyLine: line })

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('网格形态与列表形态念的是同一句', async () => {
    const wrapper = await mountEmpty([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])

    await wrapper.find('.to-list-view').trigger('click')
    await flushPromises()
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountEmpty([], { emptyReason: null, emptyLine: null })

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountEmpty([], {}, new Error('读口断了'))

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const row = { id: 1, name: 'clinic.jpg', category: '企业基础资料', fileSize: 10 }
    const wrapper = await mountEmpty([row])

    const list = vi.mocked(api.list)
    list.mockReset()
    list
      .mockResolvedValueOnce({ records: [], total: 25, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] } as any)
    const info = vi.spyOn(message, 'info').mockImplementation((() => undefined) as any)

    await wrapper.find('.go-page-3').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
    info.mockRestore()
  })

  it('「真的没有」才摆上传按钮，读不到不摆', async () => {
    const none = await mountEmpty([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })
    expect(none.find('.create-on-empty').exists()).toBe(true)

    const invisible = await mountEmpty([], { emptyReason: 'NOT_VISIBLE', emptyLine: THREE_EMPTIES[1][1] })
    expect(invisible.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountEmpty([{ id: 1, name: 'clinic.jpg', category: '企业基础资料', fileSize: 10 }])

    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
