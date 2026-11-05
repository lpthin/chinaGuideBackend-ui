<template>
  <PortalPageShell v-slot="{ shell }">
    <div v-if="loading" class="portal-case__state">内容加载中…</div>
    <div v-else-if="errorMessage" class="portal-case__state">
      <h1>{{ errorMessage }}</h1>
      <router-link to="/">返回站点首页</router-link>
    </div>
    <article v-else-if="detail" class="portal-case">
      <!-- 与 PortalArticleDetail 同一套预览横幅：候选站预览翻到案例详情，身份线索不能断 -->
      <p v-if="reviewActive" class="portal-case__identity">
        你现在看的是：{{ shell?.siteName || '（这一站没有站点名）' }}<template v-if="shell?.siteCode"> · 站码 {{ shell.siteCode }}</template>
      </p>
      <p v-if="reviewActive" class="portal-case__notice">{{ readonlyNotice }}</p>
      <header class="portal-case__header">
        <h1>{{ detail.title }}</h1>
        <ul class="portal-case__meta">
          <li v-if="detail.customerName">{{ detail.customerName }}</li>
          <li v-if="detail.industry">{{ detail.industry }}</li>
          <li v-if="detail.publishedAt">{{ formatDate(detail.publishedAt) }}</li>
        </ul>
      </header>

      <img v-if="detail.coverImage" :src="detail.coverImage" :alt="detail.title || ''" class="portal-case__cover" />

      <p v-if="detail.summary" class="portal-case__summary">{{ detail.summary }}</p>

      <div v-if="bodyHtml" class="portal-case__body" v-html="bodyHtml" />
      <p v-else class="portal-case__state">这个案例还没有可显示的详情。</p>

      <ul v-if="detail.tags?.length" class="portal-case__tags">
        <li v-for="tag in detail.tags" :key="tag">{{ tag }}</li>
      </ul>
    </article>
  </PortalPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import PortalPageShell from './PortalPageShell.vue'
import { fetchCase, PortalApiError, type PortalCaseDetail } from './api/portalPublic'
import { renderMarkdown } from './portalMarkdown'
import { formatDate } from '../utils/format'
import { SITE_PREVIEW_NOTICE, reviewTokenOf, useReviewMode } from './useReviewMode'

/** 门户案例详情页：路由 /cases/:id 与门户列表、sitemap 同源，链接点进来必须看得到内容 */
const route = useRoute()
const detail = ref<PortalCaseDetail | null>(null)
const loading = ref(true)
const errorMessage = ref<string | null>(null)

// 预览态与文章详情页同一套：激活记住令牌（守卫靠它续地址），横幅在详情页也不缺席
const { activate, enabled: reviewEnabled, sitePreview } = useReviewMode()
const reviewActive = computed(() => reviewEnabled.value && !!detail.value)
const readonlyNotice = computed(() => (sitePreview.value
  ? SITE_PREVIEW_NOTICE
  : '这条预览链接是只读的：页面上能翻，但修改意见不能在这里提交。'))

const bodyHtml = computed(() => renderMarkdown(detail.value?.content))

useHead({
  title: computed(() => detail.value?.seo?.seoTitle || detail.value?.title || '案例'),
  meta: computed(() => {
    const seo = detail.value?.seo
    const items: Record<string, string>[] = []
    if (seo?.seoDescription) items.push({ name: 'description', content: seo.seoDescription })
    if (seo?.seoKeywords) items.push({ name: 'keywords', content: seo.seoKeywords })
    items.push({ name: 'robots', content: detail.value ? (seo?.robotsMeta || 'index,follow') : 'noindex,follow' })
    if (seo?.ogTitle) items.push({ property: 'og:title', content: seo.ogTitle })
    if (seo?.ogImage) items.push({ property: 'og:image', content: seo.ogImage })
    return items
  }),
  link: computed(() => (detail.value?.seo?.canonicalUrl
      ? [{ rel: 'canonical', href: detail.value.seo.canonicalUrl }]
      : []))
})

async function load(id: string) {
  loading.value = true
  errorMessage.value = null
  try {
    detail.value = await fetchCase(id)
  } catch (error) {
    detail.value = null
    errorMessage.value = error instanceof PortalApiError && error.status === 404
        ? '这个案例不存在或已下架'
        : (error as Error).message || '内容加载失败'
  } finally {
    loading.value = false
    window.scrollTo({ top: 0 })
  }
}

onMounted(() => load(String(route.params.id || '')))
watch(() => route.params.id, value => {
  if (route.name === 'portal-case-detail') {
    load(String(value || ''))
  }
})
// 与 PortalDynamicPage 同一套口径：令牌只认地址栏，进来就激活、地址上没了就整体退出。
// 离开门户的清场在路由层 afterEach（不能放在 onUnmounted：切页时新页先挂、旧页后卸）。
const reviewToken = computed(() => reviewTokenOf(route.query))
watch(reviewToken, token => activate(token), { immediate: true })
</script>

<style scoped lang="less">
.portal-case {
  background: #fff;
  border-radius: 8px;
  padding: 40px;
  color: #1f2937;

  &__identity {
    margin: 0 0 16px;
    padding: 8px 16px;
    background: rgba(22, 119, 255, 0.08);
    border: 1px solid rgba(22, 119, 255, 0.25);
    border-radius: 6px;
    color: #0958d9;
    font-size: 13px;
    font-weight: 600;
  }

  &__notice {
    margin: 0 0 24px;
    padding: 10px 14px;
    border: 1px dashed #d9d9d9;
    border-radius: 10px;
    background: #fffef7;
    font-size: 13px;
    color: #4b5563;
  }

  &__state {
    background: #fff;
    border-radius: 8px;
    padding: 48px;
    text-align: center;
    color: #6b7280;
  }

  &__header h1 {
    font-size: 28px;
    line-height: 1.35;
    margin: 0 0 12px;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    list-style: none;
    margin: 0 0 24px;
    padding: 0;
    font-size: 13px;
    color: #9ca3af;
  }

  &__cover {
    width: 100%;
    height: auto;
    border-radius: 6px;
    margin-bottom: 24px;
  }

  &__summary {
    font-size: 16px;
    color: #4b5563;
    background: #f7f8fa;
    border-radius: 6px;
    padding: 16px;
  }

  &__body {
    font-size: 16px;
    line-height: 1.9;

    :deep(img) {
      max-width: 100%;
      height: auto;
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    list-style: none;
    padding: 0;
    margin: 28px 0 0;

    li {
      background: #f3f4f6;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 13px;
      color: #4b5563;
    }
  }
}
</style>
