<template>
  <PortalPageShell>
    <div v-if="loading" class="portal-article__state">内容加载中…</div>
    <div v-else-if="errorMessage" class="portal-article__state">
      <h1>{{ errorMessage }}</h1>
      <router-link to="/">返回网站首页</router-link>
    </div>
    <article v-else-if="article" class="portal-article">
      <header class="portal-article__header">
        <h1>{{ article.title }}</h1>
        <p v-if="article.summary" class="portal-article__summary">{{ article.summary }}</p>
        <ul class="portal-article__meta">
          <li v-if="article.publishedAt">{{ formatDate(article.publishedAt) }}</li>
          <li v-if="article.authorName">{{ article.authorName }}</li>
          <li v-if="article.categoryName">
            <router-link :to="categoryLink">{{ article.categoryName }}</router-link>
          </li>
          <li v-if="article.source">来源：{{ article.source }}</li>
        </ul>
      </header>

      <img v-if="article.coverImage" :src="article.coverImage" :alt="article.title || ''" class="portal-article__cover" />

      <section v-if="citationPoints.length" class="portal-article__keypoints">
        <h2>本文要点</h2>
        <ul>
          <li v-for="point in citationPoints" :key="point">{{ point }}</li>
        </ul>
      </section>

      <div v-if="bodyHtml" class="portal-article__body" v-html="bodyHtml" />
      <p v-else class="portal-article__state">这篇内容还没有可显示的正文。</p>

      <ul v-if="article.tags?.length" class="portal-article__tags">
        <li v-for="tag in article.tags" :key="tag">{{ tag }}</li>
      </ul>

      <nav class="portal-article__neighbours">
        <router-link v-if="article.prev" :to="article.prev.link">上一篇：{{ article.prev.title }}</router-link>
        <span v-else />
        <router-link v-if="article.next" :to="article.next.link">下一篇：{{ article.next.title }}</router-link>
      </nav>
    </article>
  </PortalPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import PortalPageShell from './PortalPageShell.vue'
import { fetchArticle, PortalApiError, type PortalArticleDetail } from './api/portalPublic'
import { renderMarkdown } from './portalMarkdown'
import { formatDate } from '../utils/format'

/**
 * 门户文章详情页。路由 /news/:idOrSlug 与 sitemap、llms.txt 里的链接同源（PortalUrls），
 * 爬虫按 sitemap 抓过来必须能看到正文，而不是一个 200 的空壳首页。
 */
const route = useRoute()
const article = ref<PortalArticleDetail | null>(null)
const loading = ref(true)
const errorMessage = ref<string | null>(null)

const bodyHtml = computed(() => {
  if (!article.value) {
    return ''
  }
  // 后端有渲染好的 HTML 就用，没有才把 Markdown 过一遍白名单再渲染
  return article.value.contentHtml || renderMarkdown(article.value.contentMd)
})

const categoryLink = computed(() => `/news?category=${encodeURIComponent(article.value?.categorySlug || '')}`)

/** geo_citation_summary 是一行式要点，拆成列表更好读；一条都拆不出来就不显示这块 */
const citationPoints = computed<string[]>(() => {
  const raw = article.value?.citationSummary?.trim()
  if (!raw) {
    return []
  }
  return raw
    .split(/[；;\n]/)
    .map((item) => item.replace(/[。.]\s*$/, '').trim())
    .filter(Boolean)
})

/** 结构化数据配坏了就不进 head，宁可少一份 JSON-LD，也不要给爬虫一段解析不了的脚本 */
function isJsonDocument(raw: string | null | undefined): raw is string {
  if (!raw) {
    return false
  }
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

useHead({
  title: computed(() => article.value?.seo?.seoTitle || article.value?.title || '文章'),
  meta: computed(() => {
    const seo = article.value?.seo
    const items: Record<string, string>[] = []
    if (seo?.seoDescription) items.push({ name: 'description', content: seo.seoDescription })
    if (seo?.seoKeywords) items.push({ name: 'keywords', content: seo.seoKeywords })
    // 后端回 404 的内容必须告诉爬虫别收录，否则等于把软 404 又养回来
    items.push({ name: 'robots', content: article.value ? (seo?.robotsMeta || 'index,follow') : 'noindex,follow' })
    if (seo?.ogTitle) items.push({ property: 'og:title', content: seo.ogTitle })
    if (seo?.ogDescription) items.push({ property: 'og:description', content: seo.ogDescription })
    if (seo?.ogImage) items.push({ property: 'og:image', content: seo.ogImage })
    return items
  }),
  link: computed(() => (article.value?.seo?.canonicalUrl
      ? [{ rel: 'canonical', href: article.value.seo.canonicalUrl }]
      : [])),
  script: computed(() => {
    // Article 与 FAQPage 是两份独立的 schema，合并成一段会让爬虫读到混合类型，所以各出一个 ld+json
    const docs = [article.value?.seo?.schemaJson, article.value?.seo?.faqJson]
    return docs.filter(isJsonDocument).map((raw) => ({
      type: 'application/ld+json',
      // JSON 字符串里的 </ 会提前闭合这段脚本，转义成 <\/ 之后 JSON 依然合法
      innerHTML: raw.replace(/<\//g, '<\\/'),
    }))
  })
})

async function load(idOrSlug: string) {
  loading.value = true
  errorMessage.value = null
  try {
    article.value = await fetchArticle(idOrSlug)
  } catch (error) {
    article.value = null
    errorMessage.value = error instanceof PortalApiError && error.status === 404
        ? '这篇文章不存在或已下架'
        : (error as Error).message || '内容加载失败'
  } finally {
    loading.value = false
    window.scrollTo({ top: 0 })
  }
}

onMounted(() => load(String(route.params.idOrSlug || '')))
watch(() => route.params.idOrSlug, value => {
  if (route.name === 'portal-article-detail') {
    load(String(value || ''))
  }
})
</script>

<style scoped lang="less">
.portal-article {
  background: #fff;
  border-radius: 8px;
  padding: 40px;
  color: #1f2937;

  &__state {
    background: #fff;
    border-radius: 8px;
    padding: 48px;
    text-align: center;
    color: #6b7280;
  }

  &__header h1 {
    font-size: 30px;
    line-height: 1.35;
    margin: 0 0 12px;
  }

  &__summary {
    font-size: 16px;
    color: #4b5563;
    margin: 0 0 16px;
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

    a {
      color: #2563eb;
      text-decoration: none;
    }
  }

  &__cover {
    width: 100%;
    height: auto;
    border-radius: 6px;
    margin-bottom: 24px;
  }

  &__keypoints {
    margin-bottom: 28px;
    padding: 16px 20px;
    border-left: 3px solid #2563eb;
    background: #f8fafc;
    border-radius: 0 6px 6px 0;

    h2 {
      font-size: 15px;
      margin: 0 0 8px;
      color: #1f2937;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 15px;
      line-height: 1.8;
      color: #374151;
    }
  }

  &__body {
    font-size: 16px;
    line-height: 1.9;

    :deep(h2) {
      font-size: 22px;
      margin: 32px 0 12px;
    }

    :deep(h3) {
      font-size: 18px;
      margin: 28px 0 10px;
    }

    :deep(p), :deep(li) {
      margin: 0 0 14px;
    }

    :deep(img) {
      max-width: 100%;
      height: auto;
    }

    :deep(pre) {
      background: #f3f4f6;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }

    :deep(blockquote) {
      margin: 0 0 16px;
      padding-left: 16px;
      border-left: 3px solid #e5e7eb;
      color: #6b7280;
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

  &__neighbours {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 36px;
    padding-top: 20px;
    border-top: 1px solid #eef0f3;
    font-size: 14px;

    a {
      color: #2563eb;
      text-decoration: none;
      max-width: 45%;
    }
  }
}
</style>
