import { describe, it, expect } from 'vitest'

/**
 * 「这一行的状态会自己往下走」这句话得真的有人去兑现（M-P15，(x) 收口时现场撞出来的）。
 *
 * <p>现场：给 doc 8 排队重新向量化，提示语写的是「这一行的状态会自己往下走」，
 * 而页面上没有任何一处会再读它一遍——库里 7 秒后就翻成 `COMPLETED 2/2`
 * （`knowledge_task` 28 SUCCESS，11:01:48；那一行 `updated_at` 11:01:55），
 * 界面上一直停在「向量化中 / 向量 0/2」，非整页刷新不可。
 * 全仓 grep 过：当时这个页面里 `setInterval` / `poll` 只有那两句提示语。</p>
 *
 * <p>提示语把预期立在这儿，页面就得履行它；不然就是把「去刷新一下」这句话
 * 换成一句更客气的话，运营照样不知道什么时候该刷新。
 * 所以这一格钉的是回读循环的形状：有、会停、且不会在换租户或离开页面后继续抢读。</p>
 *
 * 手法照 knowledge-unclassified-entry.spec.ts：断言落在源码上，改回旧形状会当场翻红。
 */

const viewModules = import.meta.glob('../KnowledgeDocumentView.vue',
  { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const view = String(Object.values(viewModules)[0] ?? '')

describe('M-P15：排队向量化后界面自己把状态读回终态', () => {
  it('扫到了页面本身（glob 写错会让这一整份用例静默通过）', () => {
    expect(view).not.toBe('')
  })

  /** 缺口本体：以前 reVectorize 刷一次就走，读到的一定是刚写下的「向量化中」 */
  it('排队成功后交给回读循环，不是刷一次就完', () => {
    const reVectorize = view.slice(view.indexOf('async function reVectorize('),
      view.indexOf('function stopVectorFollow()'))
    expect(reVectorize).toMatch(/await followVectorization\(id\)/)
    expect(reVectorize).not.toMatch(/await loadDocuments\(\)\s*\}\s*catch/)
  })

  it('回读循环：先读一次，只有还在跑才续下一趟，跑到终态或读不到这一行就停', () => {
    const follow = view.slice(view.indexOf('async function followVectorization('))
    expect(follow).toMatch(/await loadDocuments\(\)/)
    expect(follow).toMatch(/documents\.value\.find\(\(d: any\) => d\.id === id\)/)
    expect(follow).toMatch(/if \(!doc \|\| doc\.vectorStatus !== 'PENDING' && doc\.vectorStatus !== 'PROCESSING'\) return/)
  })

  /** 无上限的回读等于给页面上了一只停不下来的表：两分钟是这里的天花板 */
  it('有次数上限，并且续读只走 setTimeout（不留下并行的第二条链）', () => {
    const follow = view.slice(view.indexOf('async function followVectorization('))
    expect(follow).toMatch(/if \(attempt >= 24\) return/)
    expect(follow).toMatch(/vectorFollowTimer = setTimeout\(\(\) => followVectorization\(id, attempt \+ 1\), 5000\)/)
    expect(view).not.toMatch(/setInterval/)
  })

  /** 回读按 tenantId 读，换租户后那一趟读的是另一家的列表；卸载后还在跑就是无主定时器 */
  it('换租户与离开页面都停表', () => {
    expect(view).toMatch(/onBeforeUnmount\(stopVectorFollow\)/)
    const watchTenant = view.slice(view.indexOf('watch(\n  () => auth.selectedTenantId'))
    expect(watchTenant).toMatch(/stopVectorFollow\(\)/)
  })

  it('每次续读前先停掉上一趟，同一时刻只有一条链在跑', () => {
    const follow = view.slice(view.indexOf('async function followVectorization('))
    expect(follow).toMatch(/^async function followVectorization\(id: number, attempt = 0\) \{\s*stopVectorFollow\(\)/)
  })

  /** 提示语是那一句预期的原文：改预期就得同时改这一格，不许只动嘴 */
  it('提示语仍然念「会自己往下走」（这一格的存在理由就是这句话）', () => {
    expect(view).toMatch(/这一行的状态会自己往下走/)
  })
})
