<template>
  <div class="portal-dynamic-page" :style="pageStyle">
    <p v-if="loading" class="portal-dynamic-page__state">页面加载中…</p>
    <p v-else-if="error" class="portal-dynamic-page__state">{{ error }}</p>
    <template v-else-if="page">
      <!-- skippedBlocks 按后端契约是管理端线索（区块已下线这类），不该在访客页面上冒出来；
           只在预览链接里说，因为看到它的正是需要去把它换掉的人。 -->
      <p v-if="reviewActive && page.skippedBlocks?.length" class="portal-dynamic-page__state">
        本页有 {{ page.skippedBlocks.length }} 个区块当前不可显示，需要在搭建器里替换掉
      </p>
      <!-- 渲染逻辑在 PortalViewportPreview 里和搭建器、AI 草稿比对视图共用：
           分两套写的话，「搭建器里看到的」和「客户在预览链接里看到的」迟早会不一致。 -->
      <PortalViewportPreview
        :blocks="page.blocks"
        :theme="page.theme"
        :shell="shell"
        :review="reviewActive"
        :page-path="page.path"
      />
      <component :is="ReviewToolbar" v-if="canComment" />
      <!-- 这条链接不能提工单时（候选站整站预览按拍板 1A/R-3 没有写口，或作用域没问到），
           只把工具条藏起来是不够的：客户会以为「点了没反应」。当场说一句实话，
           他才知道要回平台答复，而不是在这页上反复圈。 -->
      <p v-else-if="reviewActive" class="portal-dynamic-page__notice">{{ readonlyNotice }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import {
  fetchPublicPage,
  fetchReviewPage,
  fetchSiteShell,
  type PortalSiteShell,
  type RenderedPage
} from './api/portalPublic'
import PortalViewportPreview from './blocks/PortalViewportPreview.vue'
import { themeVars } from './blocks/portalTheme'
import { SITE_PREVIEW_NOTICE, reviewTokenOf, useReviewMode } from './useReviewMode'

/**
 * 页面模型的访客入口：按 slug（或预览令牌）取 RenderedPage，交给共用的区块渲染框。
 *
 * 数据仍要站点壳：页头导航、页脚联系方式这类全站信息只在 /site 里有一份，避免第二处真相。
 *
 * 带 ?reviewToken= 时先问一次 /context 拿这条令牌的作用域，再决定走哪条取数口——
 * 逐页令牌只能开它绑的那一页（/review/{token}/page），整站令牌开的是这一整套站，
 * 每一页都走公开取数口（后端已让令牌优先于域名，无域名的候选站也认得出自己）。
 * 工具条则跟着「能不能提工单」出现，候选站那条没有写口，摆出来就是演给客户看。
 */
const props = defineProps<{ slug: string }>()

const ReviewToolbar = defineAsyncComponent(() => import('./review/ReviewToolbar.vue'))

const route = useRoute()
const {
  activate,
  ensureContext,
  enabled: reviewEnabled,
  sitePreview,
  ticketWritable
} = useReviewMode()

const page = ref<RenderedPage | null>(null)
const shell = ref<PortalSiteShell | null>(null)
const loading = ref(true)
const error = ref('')

const reviewToken = computed(() => reviewTokenOf(route.query))
const reviewActive = computed(() => reviewEnabled.value && !!page.value)
const canComment = computed(() => reviewActive.value && ticketWritable.value)

/** 只读那句实话：整站预览有专门的一句，作用域没问到时也只说「这里提不了意见」，不编原因 */
const readonlyNotice = computed(() => {
  if (sitePreview.value) {
    return SITE_PREVIEW_NOTICE
  }
  return '这条预览链接是只读的：页面上能翻，但修改意见不能在这里提交。'
})

// 主题变量落在页面根上：整页背景要跟着换肤，写满视口，不能只有内容那么高
const pageStyle = computed<Record<string, string>>(() => themeVars(page.value?.theme))

useHead({
  title: computed(() => page.value?.seo?.title || page.value?.title || shell.value?.siteName || '企业门户'),
  meta: computed(() => {
    const seo = page.value?.seo
    if (!seo) {
      return []
    }
    return [
      // 预览链接不该被搜索引擎收：草稿一旦进索引，客户看到的就是「线上莫名多出半成品页」。
      // 令牌页面本身不在站点地图里，这里再补一层 noindex 是防御，不是替代。
      ...(reviewToken.value ? [{ name: 'robots', content: 'noindex,nofollow' }] : []),
      // 页面没单独填 SEO 描述时用站点企业介绍兜底：那是页面上已经真实存在的一段话，不是占位文案；
      // 描述位留空只会让搜索引擎自己编摘要，对租户没有好处。
      { name: 'description', content: seo.description || shell.value?.company?.description || '' },
      { name: 'keywords', content: seo.keywords || '' }
    ]
  })
})

async function load() {
  loading.value = true
  error.value = ''
  const token = reviewToken.value
  try {
    // 作用域问明白了再取数：拿「有没有令牌」当作用域，逐页令牌会被派去走公开取数口，
    // 客户看到的是「该域名未绑定站点」，而这条链接本来是有效的。
    const context = await ensureContext(token)
    const siteScoped = context?.scope === 'site'
    const [rendered, siteShell] = await Promise.all([
      token && !siteScoped ? fetchReviewPage(token) : fetchPublicPage(props.slug),
      fetchSiteShell().catch(() => null)
    ])
    page.value = rendered
    shell.value = siteShell
    if (token) {
      activate(token, rendered.reviewLabel)
    }
  } catch (err) {
    page.value = null
    // 后端给的是中文消息（如「页面不存在或未发布」「预览链接无效或已过期」「该域名未绑定站点」），
    // 原样展示，不编一条"加载失败"盖掉线索
    error.value = err instanceof Error && err.message ? err.message : '页面加载失败'
  } finally {
    loading.value = false
  }
}

// 令牌只在地址栏活着：跳到没有令牌的地址就整体退出批注模式（授权范围是「这一页」，不跨页续期）
watch(reviewToken, token => activate(token, page.value?.reviewLabel), { immediate: true })
onUnmounted(() => activate(null, null))
// 从导航在同类页面间跳转时（/about → /services 都是本组件）不会重新挂载，必须跟着 slug 或令牌变化重取
watch([() => props.slug, reviewToken], load, { immediate: true })
</script>

<style lang="less">
@import '../styles/portal-tokens.less';
@import './blocks/portal-blocks.less';
</style>

<style scoped lang="less">
.portal-dynamic-page {
  min-height: 100vh;
  background: var(--portal-color-bg);
  color: var(--portal-color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;

  &__state {
    padding: 120px 24px;
    text-align: center;
    color: var(--portal-color-muted);
  }

  // 只读预览那句实话要挂在页底显眼处，但不许长得像工具条：客户会以为那里能提意见
  &__notice {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 90;
    max-width: min(420px, calc(100vw - 32px));
    margin: 0;
    padding: 10px 14px;
    border: 1px dashed #d9d9d9;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.92);
    color: rgba(0, 0, 0, 0.55);
    font-size: 13px;
    line-height: 1.6;
  }
}
</style>
