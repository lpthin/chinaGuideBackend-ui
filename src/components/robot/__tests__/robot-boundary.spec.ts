import { describe, expect, it } from 'vitest'

/**
 * 单向依赖的守门测试（SPEC-UI-11 §4.1）。
 *
 * 这条边界不是洁癖：`components/robot/` 一旦能 import `views/`，就会被某个页面「顺手复用」，
 * 之后任何一个视图的改动都可能把机器人拖崩；反过来 `views/` 直接 import 气泡/形象，
 * 页面就会开始自己写位置、自己写收起，中枢的频率与静音立刻失效。
 *
 * 唯一的例外是 `WorkspaceView.vue`：它只挂一次 `<RobotHost />`，挂载点只能在这里。
 *
 * 源码用 `import.meta.glob(..., '?raw')` 取，不引 @types/node：
 * 这个仓库对「测试侧读盘」只开了最小的一个口子，不为一条扫描用例挂整棵依赖树。
 */
const ROBOT_SOURCES = import.meta.glob('../*.{ts,vue}', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>

const VIEW_SOURCES = import.meta.glob('../../../views/**/*.{ts,vue}', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>

const APP_SOURCE = (
  import.meta.glob('../../../App.vue', {
    eager: true,
    query: '?raw',
    import: 'default'
  }) as Record<string, string>
)['../../../App.vue']

const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g

function importsOf(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(IMPORT_RE)) found.push(match[1])
  return found
}

describe('机器人的依赖是单向的', () => {
  it('components/robot 不 import 任何 views/', () => {
    expect(Object.keys(ROBOT_SOURCES).length).toBeGreaterThan(5)
    const offenders = Object.entries(ROBOT_SOURCES)
      .filter(([, source]) => importsOf(source).some(spec => spec.includes('views/')))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('views/ 只有 WorkspaceView 能 import components/robot（挂载点唯一）', () => {
    expect(Object.keys(VIEW_SOURCES).length).toBeGreaterThan(50)
    const offenders = Object.entries(VIEW_SOURCES)
      .filter(([file]) => !file.endsWith('WorkspaceView.vue'))
      .filter(([, source]) => importsOf(source).some(spec => spec.includes('components/robot')))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('机器人不挂在 App.vue（登录页与门户访客页不能出现它）', () => {
    expect(APP_SOURCE).toBeTruthy()
    expect(APP_SOURCE).not.toContain('RobotHost')
    expect(APP_SOURCE).not.toContain('robot/')
  })
})
