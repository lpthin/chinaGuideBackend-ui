/**
 * 区块渲染器注册表：rendererKey → Vue 组件。
 *
 * rendererKey 由后端下发，而「有哪些区块」从 Spec-M §8 第 2 步起有两族：代码声明那一族
 * （`PortalBlockCatalogue`）与界面手工新增那一族（`portal_block_def.source='manual'`）。
 * 这里必须与那份下发的渲染器键一一对应——多出来的组件没人能引用，缺了的组件访客会看到空白。
 * 所以 block-registry.spec.ts 用一份显式清单把两边钉住，改一边就会红。
 *
 * 最后一项 `genericCard` 是<em>人工那一族唯一可用的渲染器</em>，后端那道同名闸在
 * `portal/blocks/RendererKeys.java`：那边不认的渲染器键根本进不了这份清单（读取时按不存在处理），
 * 就是为了不出现「后台存得进去、前台一个字都没有」。加第二支通用渲染器时两处要一起改。
 *
 * 未登记的 rendererKey 一律不渲染并 console.error：宁缺不滥，绝不退化成「把未知内容当 HTML 打出来」。
 */
import { defineAsyncComponent, type Component } from 'vue'

const RENDERERS: Record<string, () => Promise<Component>> = {
  siteHeader: () => import('./SiteHeaderBlock.vue'),
  utilityBar: () => import('./UtilityBarBlock.vue'),
  breadcrumb: () => import('./BreadcrumbBlock.vue'),
  hero: () => import('./HeroBlock.vue'),
  pageHero: () => import('./PageHeroBlock.vue'),
  bannerCarousel: () => import('./BannerCarouselBlock.vue'),
  serviceCards: () => import('./ServiceCardsBlock.vue'),
  caseGrid: () => import('./CaseGridBlock.vue'),
  caseList: () => import('./CaseListBlock.vue'),
  newsList: () => import('./NewsListBlock.vue'),
  relatedContent: () => import('./RelatedContentBlock.vue'),
  jobList: () => import('./JobListBlock.vue'),
  aboutRich: () => import('./AboutRichBlock.vue'),
  textBand: () => import('./TextBandBlock.vue'),
  teamGrid: () => import('./TeamGridBlock.vue'),
  statsBand: () => import('./StatsBandBlock.vue'),
  logoWall: () => import('./LogoWallBlock.vue'),
  testimonialCards: () => import('./TestimonialCardsBlock.vue'),
  milestoneTimeline: () => import('./MilestoneTimelineBlock.vue'),
  awardGrid: () => import('./AwardGridBlock.vue'),
  faqAccordion: () => import('./FaqAccordionBlock.vue'),
  mapBlock: () => import('./MapBlock.vue'),
  ctaBand: () => import('./CtaBandBlock.vue'),
  contactBlock: () => import('./ContactBlock.vue'),
  inquiryForm: () => import('./InquiryFormBlock.vue'),
  siteFooter: () => import('./SiteFooterBlock.vue'),
  // 人工那一族的渲染器：不绑定栏目，按区块自带 schema 摆卡片
  genericCard: () => import('./GenericCardBlock.vue')
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
