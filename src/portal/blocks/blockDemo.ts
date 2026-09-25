import type { PortalBlockMeta } from '../../api/portalPages'
import type { PortalSiteShell, RenderedBlock } from '../api/portalPublic'
import { resolveRenderer } from './registry'

/**
 * 管理端演示数据：由区块 dataSchema 推导出来的 props + 一份本地 demo 数据提供器（Spec §4.4 / §7.2）。
 *
 * 为什么是「推导」而不是一张 `blockKey → props` 的表：区块白名单的唯一真相在服务端
 * （PortalBlockCatalogue → /api/portal/blocks），前端只要写死一张表，新增区块就会在画廊里
 * 少一格、改字段就会显示成过时的样子，而且这种错不会报错，只会「看着没问题」（I-1 同一条纪律）。
 *
 * 推导规则（只看槽位自己的 schema 形状，不看它属于哪个区块）：
 * 1. `oneOf[字符串, {$data}]`（字面内容或绑定二选一）→ 给字面样例，样例的**种类按字符串分支的 maxLength 分档**：
 *    ≤200 是短文案档（标题/按钮一类）、500 是链接档（其中名字长得像图片位的给一个内联占位图，
 *    免得画廊里出现裂图）、≥10000 是段落档；同档内按槽位序号轮换，所以一页里不会出现两句一样的话。
 * 2. 只接受 `{$data}` 的槽位（列表槽 items/links）→ 给演示集合，条目字段是一份**通用并集**
 *    （标题/摘要/职位/薪资…各区块读自己认得的那几个键），因此任何列表区块拿它都能渲出样子。
 * 3. `enum` / `integer` / `boolean` → 取白名单内的合法值（列数取 3、条数取区间中段的 3、开关给 true）。
 * 4. 认不出的形状一律不填：宁可这一格空着显示「没有可显示的内容」，也不要在前端凭空造一个后端不认的槽位值。
 *
 * 骨架预览走的 `resolveDemoBlocks` 用的是同一套规则，只是把「字面样例」换成「按槽位形状取演示标量/集合」，
 * 于是 layout_json 里那些真实绑定（`{"$data":"..."}`）在管理端也有东西可渲，而不用去碰客户的库。
 */

/** layout_json 里的一个区块声明（未解析绑定） */
export interface LayoutBlock {
  instanceId?: string
  blockKey: string
  props?: Record<string, unknown> | null
}

interface PropertySchema {
  oneOf?: unknown[]
  type?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  maxLength?: number
  properties?: Record<string, unknown>
}

/** 演示集合的条目数：够看出网格/换行/滚动条，又不至于把一屏塞满 */
const DEMO_LIST_SIZE = 3

const SHORT_SAMPLES = [
  '演示标题文案',
  '演示副标题文案',
  '演示说明文字',
  '演示按钮文案',
  '演示小标题'
]

const PARAGRAPH_SAMPLES = [
  '这是一段演示文案，用来看清正文字号、行高与留白在真实页面里的样子。区块本身的渲染器与访客端完全是同一套组件，'
  + '所以这里的观感就是上线后的观感。',
  '这一段是第二个演示文案槽：正式内容里，这段文字会来自企业信息或某个栏目页的字面内容，'
  + '由租户在自己的后台维护，骨架只负责把它放在这里。'
]

/** 一份通用并集：每个列表区块按自己的字段名取它认得的那几个键，取不到就不渲染那一行 */
const DEMO_ITEMS: Array<Record<string, unknown>> = [1, 2, 3, 4, 5, 6].map(index => ({
  id: index,
  title: `演示条目 ${index}`,
  name: `演示条目 ${index}`,
  subtitle: `演示条目的第二行 ${index}`,
  summary: `这是第 ${index} 条演示摘要，用来看列表区块的排版密度。`,
  description: `这是第 ${index} 条演示正文，正式内容里它来自门户数据，而不是写在这里的第二份真相。`,
  category: '演示分类',
  categoryName: '演示分类',
  customerName: `演示客户 ${index}`,
  industry: '演示行业',
  position: `演示职位 ${index}`,
  bio: '演示简介：这一行由区块自己决定要不要显示。',
  department: '演示部门',
  jobType: '全职',
  location: '演示市',
  // 薪资一律按「元」写全：k / 万这类自创单位是后端词表里没有的口径
  salaryText: `${10000 * index}-${15000 * index} 元/月`,
  experienceReq: `${index} 年经验`,
  educationReq: '演示学历',
  requirements: '演示要求：这一格演示的是折叠区里的内容。',
  benefits: '演示福利：这一格同样只在有值时出现。',
  publishedAt: '2026-01-0%d'.replace('%d', String(index)),
  publishAt: '2026-01-0%d'.replace('%d', String(index)),
  value: `${index}00`,
  label: `演示指标 ${index}`,
  link: `/demo-page-${index}`,
  url: `/demo-page-${index}`,
  linkUrl: `/demo-page-${index}`
}))

/** 名字长得像图片位的链接槽：给一个内联占位图，免得画廊里出现裂图 */
const IMAGE_SLOT_NAME = /(logo|icon|avatar|cover|image|photo|picture|favicon|banner)/i

/** 一个不必联网、也不会裂掉的 1×1 占位图 */
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;utf8,'
  + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">'
    + '<rect width="640" height="360" fill="#e8edf5"/>'
    + '<text x="50%" y="50%" font-size="28" fill="#6b7280" text-anchor="middle">演示图片位</text></svg>')

function propertiesOf(schema: Record<string, unknown> | null): Record<string, PropertySchema> {
  const raw = schema?.properties as Record<string, PropertySchema> | undefined
  return raw || {}
}

/** 与搭建器表单 BlockPropsForm 同一条判读规则：认形状，不认字段名 */
function shapeOf(property: PropertySchema): 'literal' | 'binding' | 'enum' | 'integer' | 'boolean' | 'unknown' {
  if (Array.isArray(property.oneOf)) {
    const items = property.oneOf as PropertySchema[]
    const hasString = items.some(item => item?.type === 'string')
    const hasBinding = items.some(item => JSON.stringify(item || {}).includes('$data'))
    return hasString && hasBinding ? 'literal' : 'unknown'
  }
  if (property.properties && '$data' in property.properties) return 'binding'
  if (Array.isArray(property.enum)) return 'enum'
  if (property.type === 'integer' || property.type === 'number') return 'integer'
  if (property.type === 'boolean') return 'boolean'
  return 'unknown'
}

function stringBranchOf(property: PropertySchema): PropertySchema | null {
  const matched = (property.oneOf as PropertySchema[] | undefined)?.find(item => item?.type === 'string')
  return matched ?? null
}

function pickSample<T>(pool: T[], seed: number): T {
  return pool[Math.abs(seed) % pool.length]
}

/** 字面槽的样例值：分档只看 maxLength，因为白名单里 SHORT/URL/TEXT 三档的长度就是它们的身份 */
function literalSample(property: PropertySchema, slotName: string, seed: number): string {
  const branch = stringBranchOf(property)
  const maxLength = branch?.maxLength ?? 200
  if (maxLength >= 10000) {
    return pickSample(PARAGRAPH_SAMPLES, seed)
  }
  if (maxLength > 200) {
    return IMAGE_SLOT_NAME.test(slotName) ? PLACEHOLDER_IMAGE : `/demo-page-${Math.abs(seed) % 6 + 1}`
  }
  return pickSample(SHORT_SAMPLES, seed)
}

function integerSample(property: PropertySchema): number {
  if (Array.isArray(property.enum)) {
    const values = property.enum.filter(value => typeof value === 'number') as number[]
    return values.length ? values[Math.floor(values.length / 2)] : 1
  }
  const min = property.minimum ?? 1
  const max = property.maximum ?? min
  return Math.min(Math.max(min, 3), max)
}

/** 枚举槽：全是数字（列数那种）取中间一档，看着最像默认排版；否则照第一个合法值给 */
function enumSample(property: PropertySchema): unknown {
  const values = property.enum || []
  const numbers = values.filter(value => typeof value === 'number') as number[]
  return numbers.length === values.length ? integerSample(property) : values[0]
}

/** 一个区块的演示 props（已解析成渲染器能直接吃的值），完全由 dataSchema 推出来 */
export function demoPropsFor(meta: PortalBlockMeta, seed = 0): Record<string, unknown> {
  const properties = propertiesOf(meta.dataSchema ?? null)
  const props: Record<string, unknown> = {}
  Object.entries(properties).forEach(([name, property], index) => {
    const shape = shapeOf(property)
    if (shape === 'literal') {
      props[name] = literalSample(property, name, seed + index)
      return
    }
    if (shape === 'binding') {
      props[name] = demoList(seed + index)
      return
    }
    if (shape === 'enum') {
      props[name] = enumSample(property)
      return
    }
    if (shape === 'integer') {
      props[name] = integerSample(property)
      return
    }
    if (shape === 'boolean') {
      props[name] = true
      return
    }
    // unknown：什么都不填。猜出来的值后端校验一定不认，填了反而把「这一格没数据」这种真实状态遮掉
  })
  return props
}

/** 演示集合：从第 offset 条开始取若干条，让不同区块的画廊不至于全是同一批条目 */
export function demoList(offset = 0): Array<Record<string, unknown>> {
  const start = Math.abs(offset) % DEMO_ITEMS.length
  const list: Array<Record<string, unknown>> = []
  for (let index = 0; index < DEMO_LIST_SIZE; index += 1) {
    list.push(DEMO_ITEMS[(start + index) % DEMO_ITEMS.length])
  }
  return list
}

/** 演示标量：绑定槽位里的 companyInfo.name / heroData.title 这类，一律给一句说明这是演示数据 */
export function demoScalar(path: string): string {
  const tail = path.split('.').pop() || path
  return IMAGE_SLOT_NAME.test(tail) ? PLACEHOLDER_IMAGE : `演示内容（来自 ${tail} 的绑定）`
}

/** 值是不是绑定写法 `{"$data":"路径"}` */
function bindingPathOf(value: unknown): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && '$data' in value) {
    const path = (value as { $data?: unknown }).$data
    return typeof path === 'string' ? path : null
  }
  return null
}

/**
 * 把 layout_json 里那一页的区块序列解析成可渲染块。
 *
 * 返回 skipped 而不是把区块悄悄丢掉：超管看到的页面少了一格，必须知道是哪一格、为什么少
 * （区块没登记、渲染器不在白名单里、props 形状认不出，是三种不同的问题）。
 */
export function resolveDemoBlocks(
  blocks: LayoutBlock[],
  metas: Map<string, PortalBlockMeta>
): { blocks: RenderedBlock[]; skipped: string[] } {
  const rendered: RenderedBlock[] = []
  const skipped: string[] = []
  blocks.forEach((block, index) => {
    const meta = metas.get(block.blockKey) || null
    const rendererKey = meta?.rendererKey || block.blockKey
    if (!meta || !resolveRenderer(rendererKey)) {
      skipped.push(block.blockKey)
      return
    }
    const properties = propertiesOf(meta.dataSchema ?? null)
    const props: Record<string, unknown> = {}
    Object.entries(block.props || {}).forEach(([name, value]) => {
      const path = bindingPathOf(value)
      if (path === null) {
        props[name] = value
        return
      }
      const shape = properties[name] ? shapeOf(properties[name]) : 'unknown'
      // 形状认不出来时按路径猜：带点的是标量绑定，不带点的是集合，这一条只兜底、不是第二份真相
      if (shape === 'binding') props[name] = demoList(index)
      else if (shape === 'literal') props[name] = demoScalar(path)
      else props[name] = path.includes('.') ? demoScalar(path) : demoList(index)
    })
    rendered.push({
      instanceId: block.instanceId || `${block.blockKey}-${index}`,
      blockKey: block.blockKey,
      rendererKey,
      props
    })
  })
  return { blocks: rendered, skipped }
}

/** 解析 layout_json。坏 JSON 返回 null 并由调用方说明「这一页的结构读不出来」，不静默当空页 */
export function parseLayoutBlocks(layoutJson: string | null | undefined): LayoutBlock[] | null {
  if (!layoutJson) {
    return []
  }
  try {
    const parsed = JSON.parse(layoutJson) as { blocks?: unknown }
    const blocks = parsed?.blocks
    if (!Array.isArray(blocks)) {
      return []
    }
    return blocks.filter(block => block && typeof block === 'object') as LayoutBlock[]
  } catch {
    return null
  }
}

/** 骨架的 tokens_json → 预览用的主题对象；读不出来就当没有皮肤，不影响结构预览 */
export function parseTheme(tokensJson: string | null | undefined): Record<string, string | number> | null {
  if (!tokensJson) {
    return null
  }
  try {
    const parsed = JSON.parse(tokensJson) as Record<string, unknown>
    const theme: Record<string, string | number> = {}
    Object.entries(parsed || {}).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        theme[key] = value
      }
    })
    return Object.keys(theme).length ? theme : null
  } catch {
    return null
  }
}

/**
 * 页头/页脚/联系方式这几个区块全站只有壳里有值，画廊与骨架预览共用这一份演示壳。
 *
 * siteId 0 / siteCode 'demo' 是被 types.ts 的 isDemoContext 认出来的哨兵值：
 * 会写库的区块（留资表单）据此把提交置灰，别把它换成一个看着更真的 id，那样画廊里就会真发出请求了。
 */
export function demoShell(): PortalSiteShell {
  return {
    siteId: 0,
    siteName: '演示站点',
    siteCode: 'demo',
    baseUrl: null,
    company: {
      name: '演示科技有限公司',
      logo: null,
      description: PARAGRAPH_SAMPLES[0],
      copyright: '© 演示科技有限公司（演示数据）',
      phone: '400-000-0000',
      email: 'demo@example.com',
      address: '演示省演示市演示区演示路 1 号'
    },
    seo: null,
    nav: [
      { title: '示例栏目一', url: '/demo-page-1', articleCount: null },
      { title: '示例栏目二', url: '/demo-page-2', articleCount: null },
      { title: '示例栏目三', url: '/demo-page-3', articleCount: null }
    ]
  }
}

export function blockMetaMap(metas: PortalBlockMeta[]): Map<string, PortalBlockMeta> {
  return new Map(metas.map(meta => [meta.blockKey, meta]))
}
