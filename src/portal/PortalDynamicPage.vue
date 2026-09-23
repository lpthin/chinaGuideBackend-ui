<template>
  <div class="portal-dynamic-page" :style="themeStyle">
    <p v-if="loading" class="portal-dynamic-page__state">页面加载中…</p>
    <p v-else-if="error" class="portal-dynamic-page__state">{{ error }}</p>
    <template v-else-if="page">
      <component
        :is="rendererFor(block)"
        v-for="block in visibleBlocks"
        :key="block.instanceId + block.blockKey"
        :block-props="block.props ?? {}"
        :shell="shell"
      />
      <!-- 区块序列里没有任何可渲染组件：这通常意味着站点页面引用了已下线区块，给管理端留线索，不给访客出白屏 -->
      <p v-if="!visibleBlocks.length" class="portal-dynamic-page__state">该页面暂无可显示的内容</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { fetchPublicPage, fetchSiteShell, type PortalSiteShell, type RenderedBlock, type RenderedPage } from './api/portalPublic'
import { resolveRenderer } from './blocks/registry'

/**
 * 页面模型的访客渲染器：把后端 RenderedPage 的区块序列逐块渲染出来。
 *
 * 这里是运行时换肤的唯一入口（决策 D4）：theme_json 允许的键在后端 LayoutValidator 已白名单化，
 * 前端只搬运到 CSS 变量上，不做任何解释。
 * 数据仍要站点壳：页头导航、页脚联系方式这类全站信息只在 /site 里有一份，避免第二处真相。
 */
const props = defineProps<{ slug: string }>()

const THEME_VARS: Record<string, string> = {
  colorPrimary: '--portal-color-primary',
  colorBg: '--portal-color-bg',
  colorText: '--portal-color-text',
  colorMuted: '--portal-color-muted',
  radius: '--portal-radius',
  sectionMaxWidth: '--portal-section-max-width',
  fontScale: '--portal-font-scale',
  spacingScale: '--portal-spacing-scale'
}

const page = ref<RenderedPage | null>(null)
const shell = ref<PortalSiteShell | null>(null)
const loading = ref(true)
const error = ref('')

const visibleBlocks = computed(() => (page.value?.blocks ?? []).filter(block => resolveRenderer(block.rendererKey)))

function rendererFor(block: RenderedBlock) {
  return resolveRenderer(block.rendererKey)
}

const themeStyle = computed<Record<string, string>>(() => {
  const theme = page.value?.theme
  if (!theme) {
    return {}
  }
  const style: Record<string, string> = {}
  Object.entries(THEME_VARS).forEach(([token, cssVar]) => {
    const value = theme[token]
    if (value !== undefined && value !== null && value !== '') {
      style[cssVar] = String(value)
    }
  })
  return style
})

useHead({
  title: computed(() => page.value?.seo?.title || page.value?.title || shell.value?.siteName || '企业门户'),
  meta: computed(() => {
    const seo = page.value?.seo
    if (!seo) {
      return []
    }
    return [
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
  try {
    const [rendered, siteShell] = await Promise.all([fetchPublicPage(props.slug), fetchSiteShell().catch(() => null)])
    page.value = rendered
    shell.value = siteShell
  } catch (err) {
    page.value = null
    // 后端给的是中文消息（如「页面不存在或未发布」「该域名未绑定站点」），原样展示，不编一条"加载失败"盖掉线索
    error.value = err instanceof Error && err.message ? err.message : '页面加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
// 从导航在同类页面间跳转时（/about → /services 都是本组件）不会重新挂载，必须跟着 slug 变化重取
watch(() => props.slug, load)
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
