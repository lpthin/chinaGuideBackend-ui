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
      <component :is="ReviewToolbar" v-if="reviewActive" />
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
import { reviewTokenOf, useReviewMode } from './useReviewMode'

/**
 * 页面模型的访客入口：按 slug（或预览令牌）取 RenderedPage，交给共用的区块渲染框。
 *
 * 数据仍要站点壳：页头导航、页脚联系方式这类全站信息只在 /site 里有一份，避免第二处真相。
 *
 * 带 ?reviewToken= 时改为按令牌取页（草稿版本也能看到，这正是令牌存在的理由），
 * 并把工具条异步加载进来——访客首屏不下载它，圈选壳也不出现在它的 DOM 里。
 */
const props = defineProps<{ slug: string }>()

const ReviewToolbar = defineAsyncComponent(() => import('./review/ReviewToolbar.vue'))

const route = useRoute()
const { enabled: reviewEnabled, activate } = useReviewMode()

const page = ref<RenderedPage | null>(null)
const shell = ref<PortalSiteShell | null>(null)
const loading = ref(true)
const error = ref('')

const reviewToken = computed(() => reviewTokenOf(route.query))
const reviewActive = computed(() => reviewEnabled.value && !!page.value)

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
    const [rendered, siteShell] = await Promise.all([
      token ? fetchReviewPage(token) : fetchPublicPage(props.slug),
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
}
</style>
