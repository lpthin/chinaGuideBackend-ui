/**
 * 区块渲染器注册表：rendererKey → Vue 组件。
 *
 * rendererKey 由后端 PortalBlockCatalogue 下发（代码是唯一真相源，DB 只是它的镜像），
 * 这里必须与那份声明的渲染器键一一对应——多出来的组件没人能引用，缺了的组件访客会看到空白。
 * 所以 block-registry.spec.ts 用一份显式清单把两边钉住，改一边就会红。
 *
 * 未登记的 rendererKey 一律不渲染并 console.error：宁缺不滥，绝不退化成「把未知内容当 HTML 打出来」。
 */
import { defineAsyncComponent, type Component } from 'vue'

const RENDERERS: Record<string, () => Promise<Component>> = {
  siteHeader: () => import('./SiteHeaderBlock.vue'),
  hero: () => import('./HeroBlock.vue'),
  bannerCarousel: () => import('./BannerCarouselBlock.vue'),
  serviceCards: () => import('./ServiceCardsBlock.vue'),
  caseGrid: () => import('./CaseGridBlock.vue'),
  caseList: () => import('./CaseListBlock.vue'),
  newsList: () => import('./NewsListBlock.vue'),
  jobList: () => import('./JobListBlock.vue'),
  aboutRich: () => import('./AboutRichBlock.vue'),
  textBand: () => import('./TextBandBlock.vue'),
  teamGrid: () => import('./TeamGridBlock.vue'),
  statsBand: () => import('./StatsBandBlock.vue'),
  logoWall: () => import('./LogoWallBlock.vue'),
  ctaBand: () => import('./CtaBandBlock.vue'),
  contactBlock: () => import('./ContactBlock.vue'),
  siteFooter: () => import('./SiteFooterBlock.vue')
}

const CACHE = new Map<string, Component>()
const warned = new Set<string>()

export function registeredRendererKeys(): string[] {
  return Object.keys(RENDERERS)
}

export function resolveRenderer(rendererKey: string | null | undefined): Component | null {
  if (!rendererKey || !Object.prototype.hasOwnProperty.call(RENDERERS, rendererKey)) {
    if (rendererKey && !warned.has(rendererKey)) {
      warned.add(rendererKey)
      console.error(`[portal] 区块渲染器「${rendererKey}」未注册，已跳过渲染（不要靠降级兜住，去补组件或改区块）`)
    }
    return null
  }
  const cached = CACHE.get(rendererKey)
  if (cached) {
    return cached
  }
  const created = defineAsyncComponent(RENDERERS[rendererKey])
  CACHE.set(rendererKey, created)
  return created
}
