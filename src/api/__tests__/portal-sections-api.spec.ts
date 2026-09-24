import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 栏目接口的两条契约（Spec §5.1 / §5.2 / I-1）。
 *
 * 第二条是这个阶段真正要守的东西：api 层与视图里不许出现第二份栏目清单。前端一旦抄了
 * 「news: 资讯」这类映射，超管改显示名就不再生效，而界面上什么都不会报错——
 * 所以这里直接扫源码，而不是测「渲染出来对不对」。
 */

const httpMock = vi.hoisted(() => vi.fn())

vi.mock('../http', () => ({
  default: {
    get: (...args: unknown[]) => httpMock(...args),
    put: (...args: unknown[]) => httpMock(...args)
  }
}))

import { portalSectionsApi } from '../portalSections'

beforeEach(() => {
  httpMock.mockReset()
  httpMock.mockResolvedValue([])
})

describe('栏目接口路径', () => {
  it('租户侧只有两个读口，写口一律在 /admin 下', async () => {
    await portalSectionsApi.list(3)
    expect(httpMock).toHaveBeenLastCalledWith('/portal/sections', { params: { siteId: 3 } })

    await portalSectionsApi.summary('news')
    expect(httpMock).toHaveBeenLastCalledWith('/portal/sections/news/summary', { params: { siteId: undefined } })

    await portalSectionsApi.adminList(3)
    expect(httpMock).toHaveBeenLastCalledWith('/admin/sites/3/sections')

    await portalSectionsApi.adminUpdate(3, 'news', { enabled: false })
    expect(httpMock).toHaveBeenLastCalledWith('/admin/sites/3/sections/news', { enabled: false })
  })

  it('栏目 key 走 URL 编码，带空格或奇怪输入的不会拼出别的端点', async () => {
    await portalSectionsApi.summary('news /../admin', 1)
    expect(httpMock.mock.calls[0][0])
      .toBe('/portal/sections/' + encodeURIComponent('news /../admin') + '/summary')
  })
})

/** 新建的那三个文件：它们从头到尾只该读接口，一个栏目名都不该自己写 */
const sectionSources = {
  ...import.meta.glob('../portalSections.ts', { eager: true, query: '?raw', import: 'default' }),
  ...import.meta.glob('../../views/portal/PortalContentWorkbenchView.vue', { eager: true, query: '?raw', import: 'default' }),
  ...import.meta.glob('../../views/portal/SectionManageView.vue', { eager: true, query: '?raw', import: 'default' })
}

describe('I-1 前端不抄第二份栏目词表', () => {
  const raw = Object.values(sectionSources).join('\n')

  it('没有栏目 key 清单，也没有栏目中文名的第二处来源', () => {
    // 这些名字只该出现在后端 SectionCatalogue 与迁移脚本的注释里
    expect(raw).not.toMatch(/['"`]newsList['"`]/)
    expect(raw).not.toMatch(/['"`](about|services|cases|news|contact|jobs)['"`]\s*:/)
    expect(raw).not.toMatch(/['"`]资讯['"`]|['"`]客户案例['"`]|['"`]关于我们['"`]/)
  })

  it('内容菜单项按 contentEntry 取值过滤，而不是按栏目 key', () => {
    const menu = Object.values({
      ...import.meta.glob('../../views/workspace/WorkspaceView.vue', { eager: true, query: '?raw', import: 'default' })
    }).join('\n')
    expect(menu).toMatch(/entryOpen\('job'\)/)
    expect(menu).toMatch(/\.contentEntry/)
    // 菜单里出现栏目 key（而不是 contentEntry 取值）就等于抄了第二份清单
    expect(menu).not.toMatch(/state\.key\s*===\s*['"`]/)
  })
})
