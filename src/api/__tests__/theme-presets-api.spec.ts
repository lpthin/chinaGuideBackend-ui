import { describe, it, expect, vi, beforeEach } from 'vitest'
import { themePresetsApi } from '../themePresets'

/**
 * 沉淀接口的形状测试（Spec §8.1）。
 *
 * 锁三件事：
 * 1. 路径不重复带 /api 前缀（http 实例已经有 baseURL）；
 * 2. 应用皮肤必须带 baseVersion：这是唯一的乐观锁，漏了就是后写覆盖前写；
 * 3. promote 走的是 /admin/... 那另一个控制器、另一个权限码——租户侧不存在这个口，
 *    前端如果把路径写回 /portal/... 就等于给自己造了一个能沉淀平台资产的入口。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  }
}))

async function httpMock() {
  return (await import('../http')).default as any
}

/** import.meta.glob 的参数必须是字面量，所以每个文件各写一次，不封装成函数 */
function readRaw(records: Record<string, string>) {
  return Object.values(records).join('')
}

describe('themePresetsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里没有带 /api 前缀的路径', () => {
    const source = readRaw(import.meta.glob('../themePresets.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)
    expect([...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
  })

  it('样式变量清单取自后端，视图里不再抄第二份白名单', async () => {
    const http = await httpMock()
    await themePresetsApi.tokens()
    expect(http.get).toHaveBeenCalledWith('/portal/theme-presets/tokens')

    // 键名一份都不许出现在视图里：谁往模板或脚本里塞 colorPrimary / fontScale 就会被这条抓到
    const views = readRaw(
      import.meta.glob('../../views/portal/*.vue', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    )
    expect(views).not.toMatch(/colorPrimary|colorBg|colorText|colorMuted|sectionMaxWidth|fontScale|spacingScale/)
    // 而搭建器确实去问服务端要清单——「接口有了」和「前端取了」是两件事，历史上只有前者成立过
    const builder = readRaw(
      import.meta.glob('../../views/portal/PageBuilderView.vue', { eager: true, query: '?raw', import: 'default' }) as Record<
        string,
        string
      >
    )
    expect(builder).toMatch(/themePresetsApi\.tokens\(\)/)
    // 中文标签那份词表只在这里，且只剩标签：种类与区间由接口回传，前端不再声明
    const tokens = readRaw(
      import.meta.glob('../../portal/designTokens.ts', { eager: true, query: '?raw', import: 'default' }) as Record<
        string,
        string
      >
    )
    expect(tokens).toMatch(/colorPrimary/)
    expect(tokens).not.toMatch(/kind:\s*'(text|number)'/)
    expect(tokens).not.toMatch(/\bmin:\s*0\.8|\bmax:\s*1\.4/)
  })

  it('沉淀皮肤与平台沉淀走两个不同的前缀', async () => {
    const http = await httpMock()
    await themePresetsApi.saveSkin({ pageId: 38, name: '诊所蓝' })
    expect(http.post).toHaveBeenLastCalledWith('/portal/theme-presets', { pageId: 38, name: '诊所蓝' })

    await themePresetsApi.promote({
      pageId: 38,
      name: '口腔门诊 · 标准首页',
      provenanceUrl: 'https://example.com',
      provenanceNote: null,
      provenanceReviewed: true
    })
    expect(http.post).toHaveBeenLastCalledWith('/admin/portal/theme-presets/promote', {
      pageId: 38,
      name: '口腔门诊 · 标准首页',
      provenanceUrl: 'https://example.com',
      provenanceNote: null,
      provenanceReviewed: true
    })
  })

  it('应用皮肤带乐观锁基线，建页带站点与 slug', async () => {
    const http = await httpMock()
    await themePresetsApi.apply(4, { pageId: 38, baseVersion: 7 })
    expect(http.post).toHaveBeenLastCalledWith('/portal/theme-presets/4/apply', { pageId: 38, baseVersion: 7 })

    await themePresetsApi.instantiate(4, { siteId: 3, slug: 'teshu', title: '特色门诊' })
    expect(http.post).toHaveBeenLastCalledWith('/portal/theme-presets/4/instantiate', {
      siteId: 3,
      slug: 'teshu',
      title: '特色门诊'
    })

    await themePresetsApi.remove(4)
    expect(http.delete).toHaveBeenLastCalledWith('/portal/theme-presets/4')
  })
})
