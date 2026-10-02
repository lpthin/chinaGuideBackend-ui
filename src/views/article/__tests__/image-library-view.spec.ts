import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ImageLibraryView from '../ImageLibraryView.vue'

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
