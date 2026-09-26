<template>
  <section v-if="showSection" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>

      <!-- 分类标签：真站上名单来自 /categories（后端栏目树摊平），画廊里从绑定条目的分类字段数出来。
           两条路都不写死分类名；不足两个分类时整条不摆。 -->
      <div v-if="chips.length > 1" class="pb-filter" role="group" aria-label="按分类筛选">
        <button type="button" class="pb-filter__chip" :class="{ 'is-active': selected === '' }" @click="pick('')">
          全部
        </button>
        <button v-for="chip in chips" :key="chip.value" type="button" class="pb-filter__chip"
          :class="{ 'is-active': selected === chip.value }" @click="pick(chip.value)">
          {{ chip.name }}
        </button>
      </div>

      <!-- 加载中 / 失败 / 空 三种状态分开说：接口挂了不能演「暂无新闻」 -->
      <p v-if="status === 'loading'" class="pb-block-state">新闻加载中…</p>
      <p v-else-if="status === 'error'" class="pb-block-state pb-block-state--error" role="alert">
        新闻加载失败：{{ errorMessage }}
      </p>
      <template v-else>
        <div v-if="visibleRows.length" class="pb-grid pb-grid--3">
          <PortalBlockLink v-for="(item, index) in visibleRows" :key="index" :url="field(item, 'link')"
            class="pb-card pb-news">
            <img v-if="field(item, 'coverImage')" :src="field(item, 'coverImage')" :alt="field(item, 'title')"
              class="pb-cover" />
            <div class="pb-news__meta">
              <time v-if="field(item, 'publishedAt')" :datetime="field(item, 'publishedAt')">
                {{ formatDate(field(item, 'publishedAt')) }}
              </time>
              <span v-if="categoryName(item)" class="pb-news__category">{{ categoryName(item) }}</span>
            </div>
            <h3 class="pb-card-title">{{ field(item, 'title') }}</h3>
            <p v-if="showSummary && field(item, 'summary')" class="pb-card-text">{{ field(item, 'summary') }}</p>
          </PortalBlockLink>
        </div>
        <p v-else class="pb-block-state pb-block-state--empty">
          {{ selected ? '这个分类还没有新闻' : '还没有发布新闻' }}
        </p>

        <!-- 只有一页就不摆翻页控件：摆一对点了不动的箭头是谎报「还有更多」 -->
        <div v-if="totalPages > 1" class="pb-pager">
          <button type="button" class="pb-pager__btn" :disabled="page <= 1" @click="go(page - 1)">
            上一页
          </button>
          <span class="pb-pager__position">第 {{ page }} / {{ totalPages }} 页</span>
          <button type="button" class="pb-pager__btn" :disabled="page >= totalPages" @click="go(page + 1)">
            下一页
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { BlockContext, Item } from './types'
import { field, flag, isDemoContext, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'
import { fetchArticles, fetchCategories } from '../api/portalPublic'
import { formatDate } from '../../utils/format'

/**
 * 新闻列表：真分页 + 分类筛选（需求单点名的两件，后端 /articles 早就备好了口子）。
 *
 * <p>真站上取数走 /articles 的 category/page/size（与 PortalContentService.articles 同一契约，
 * size 被后端收在 50），前端每页只取 NEWS_PAGE_SIZE 条、绝不无界拉全量；
 * 画廊/搭建器预览拿的是演示壳或 null 壳，没有租户可查，就在 $data 绑定的条目里就地筛选分页——
 * 客户在候选站画廊里看到的分页行为与真站一致，取的却全是他自己的数据。</p>
 */
const props = defineProps<BlockContext>()

/** 两行三列；再大就该去列表页翻页而不是堆满这一屏 */
const NEWS_PAGE_SIZE = 6

const heading = computed(() => text(props.blockProps, 'heading'))
const boundItems = computed(() => list(props.blockProps, 'items'))
/** 摘要默认显示：旧模板的新闻卡片一直带摘要，区块配置没写 showSummary 时不该突然变样 */
const showSummary = computed(() => flag(props.blockProps, 'showSummary', true))

const demo = isDemoContext(props.shell)

interface Chip {
  name: string
  /** /articles 的 category 认 id、slug、code 三种键（requireCategoryId），这里统一用 slug 或 id */
  value: string
}

const chips = ref<Chip[]>([])
const selected = ref('')
const page = ref(1)
const total = ref(0)
const status = ref<'ready' | 'loading' | 'error'>(demo ? 'ready' : 'loading')
const errorMessage = ref('')
const fetchedRows = ref<Item[]>([])

/** 演示模式的分页切片：页码语义与真站一致，只是数据源在本地 */
const visibleRows = computed<Item[]>(() => {
  if (!demo) {
    return fetchedRows.value
  }
  const filtered = selected.value
    ? boundItems.value.filter(item => categoryName(item) === selected.value || field(item, 'categorySlug') === selected.value)
    : boundItems.value
  const start = (page.value - 1) * NEWS_PAGE_SIZE
  return filtered.slice(start, start + NEWS_PAGE_SIZE)
})

const totalPages = computed(() => {
  if (!demo) {
    return Math.ceil(total.value / NEWS_PAGE_SIZE)
  }
  return Math.max(1, Math.ceil(demoFilteredCount.value / NEWS_PAGE_SIZE))
})

const demoFilteredCount = computed(() => {
  if (!selected.value) {
    return boundItems.value.length
  }
  return boundItems.value
    .filter(item => categoryName(item) === selected.value || field(item, 'categorySlug') === selected.value)
    .length
})

const showSection = computed(() => !demo || boundItems.value.length > 0)

/** 卡片上的分类名：/articles 回 categoryName，$data 绑定里这个词一直是 category */
function categoryName(item: Item) {
  return field(item, 'categoryName') || field(item, 'category')
}

let requestSeq = 0

async function loadArticles(category: string, targetPage: number) {
  const token = ++requestSeq
  status.value = 'loading'
  try {
    const params = { page: targetPage, size: NEWS_PAGE_SIZE, ...(category ? { category } : {}) }
    const result = await fetchArticles(params)
    if (token !== requestSeq) {
      return
    }
    fetchedRows.value = result.records as unknown as Item[]
    total.value = result.total
    errorMessage.value = ''
    status.value = 'ready'
  } catch (error) {
    if (token !== requestSeq) {
      return
    }
    errorMessage.value = error instanceof Error ? error.message : '未知错误'
    status.value = 'error'
  }
}

function pick(value: string) {
  if (selected.value === value) {
    return
  }
  selected.value = value
  page.value = 1
  if (!demo) {
    loadArticles(value, 1)
  }
}

function go(targetPage: number) {
  if (targetPage < 1 || targetPage > totalPages.value || targetPage === page.value) {
    return
  }
  page.value = targetPage
  if (!demo) {
    loadArticles(selected.value, targetPage)
  }
}

onMounted(() => {
  if (demo) {
    const seen: Chip[] = []
    for (const item of boundItems.value) {
      const name = categoryName(item)
      if (name && !seen.some(chip => chip.value === name)) {
        seen.push({ name, value: name })
      }
    }
    chips.value = seen
    return
  }
  // 分类标签与首屏新闻各自取：栏目口挂了只丢标签条，不该把整块新闻报成加载失败
  fetchCategories()
    .then(nodes => {
      // 栏目是两层的（父栏目 + 子栏目），筛选要都能点：摊平而不是只取顶层
      const flatten = (list: { name: string; slug: string | null; id: number; children: unknown[] }[]): Chip[] =>
        list.flatMap(node => {
          const chip = { name: node.name, value: node.slug || String(node.id) }
          const children = node.children as Parameters<typeof flatten>[0]
          return children.length ? [chip, ...flatten(children)] : [chip]
        })
      chips.value = flatten(nodes as Parameters<typeof flatten>[0])
    })
    .catch(() => {
      chips.value = []
    })
  loadArticles('', 1)
})
</script>

<style scoped lang="less">
.pb-news {
  &__meta {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__category {
    color: var(--portal-color-primary);
  }
}

.pb-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: calc(24px * var(--portal-spacing-scale));

  &__chip {
    padding: 6px 16px;
    border: 1px solid var(--portal-color-border);
    border-radius: 20px;
    background: transparent;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-text);
    cursor: pointer;

    &.is-active {
      border-color: var(--portal-color-primary);
      background: color-mix(in srgb, var(--portal-color-primary) 12%, transparent);
      color: var(--portal-color-primary);
    }
  }
}

.pb-pager {
  display: flex;
  gap: 14px;
  align-items: center;
  justify-content: center;
  margin-top: calc(24px * var(--portal-spacing-scale));

  &__btn {
    padding: 6px 16px;
    border: 1px solid var(--portal-color-border);
    border-radius: calc(var(--portal-radius) - 4px);
    background: transparent;
    font-size: calc(13px * var(--portal-font-scale));
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  &__position {
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }
}

.pb-block-state {
  margin: 0;
  padding: calc(24px * var(--portal-spacing-scale)) 0;
  font-size: calc(14px * var(--portal-font-scale));
  color: var(--portal-color-muted);

  &--error {
    color: #b42318;
  }
}
</style>
