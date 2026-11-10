import { describe, expect, it } from 'vitest'

/**
 * 试点三页的静态约定（SPEC-UI-11 §14 R-5）。
 *
 * 验收的那条「三页顶部说明清零、问号可复看」靠两只手才守得住：页面删干净、
 * 正文进 `copy/robot.ts`。这里直接读源文件，避免以后有人把说明条又贴回页面顶部。
 */
const sources = import.meta.glob(
  [
    '../../../views/analytics/PortalAnalyticsView.vue',
    '../../../views/workspace/MediaStorageView.vue',
    '../../../views/portal/SkeletonLibraryView.vue',
    '../../../copy/robot.ts'
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

function source(suffix: string): string {
  const path = Object.keys(sources).find(key => key.endsWith(suffix))
  if (!path) throw new Error(`没找到视图源码：${suffix}`)
  return sources[path]
}

const PILOTS = [
  {
    name: '访问统计',
    file: 'analytics/PortalAnalyticsView.vue',
    card: 'analytics.scope',
    removed: '本页两块数字口径不同，不能相加'
  },
  {
    name: '媒体存储',
    file: 'workspace/MediaStorageView.vue',
    card: 'media.storage.intro',
    removed: '这一屏管三件事：<strong>'
  },
  {
    name: '骨架库',
    file: 'portal/SkeletonLibraryView.vue',
    card: 'portal.skeleton.intro',
    removed: '出生证明'
  }
]

describe('试点页的说明条已交给引导机器人', () => {
  for (const pilot of PILOTS) {
    it(`${pilot.name}：顶部不再留说明条，登记的是同一个卡片 key`, () => {
      const text = source(pilot.file)

      expect(text).toContain('useRobotNotices')
      expect(text).toContain(`ROBOT_PAGE_CARDS['${pilot.card}']`)
      expect(text).not.toContain(pilot.removed)
    })
  }

  it('三张卡片的正文都集中在 copy/robot.ts', () => {
    const copy = source('copy/robot.ts')
    for (const pilot of PILOTS) {
      expect(copy).toContain(`'${pilot.card}'`)
    }
    expect(copy).toContain('ROBOT_PAGE_CARDS')
  })
})
