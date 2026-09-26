<template>
  <section v-if="showSection" class="pb-section pb-section--tight">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>

      <!-- 与案例网格同一套行业筛选：名单来自数据本身（真站 /cases/facets，画廊从条目里数），
           两个区块的取数口径一致，访客在哪儿筛到的都是同一批案例。 -->
      <div v-if="industries.length > 1" class="pb-filter" role="group" aria-label="按行业筛选">
        <button type="button" class="pb-filter__chip" :class="{ 'is-active': selected === '' }" @click="pick('')">
          全部
        </button>
        <button v-for="industry in industries" :key="industry" type="button" class="pb-filter__chip"
          :class="{ 'is-active': selected === industry }" @click="pick(industry)">
          {{ industry }}
        </button>
      </div>

      <!-- 加载中 / 失败 / 空 三种状态分开说 -->
      <p v-if="status === 'loading'" class="pb-block-state">案例加载中…</p>
      <p v-else-if="status === 'error'" class="pb-block-state pb-block-state--error" role="alert">
        案例加载失败：{{ errorMessage }}
      </p>
      <ul v-else-if="visibleRows.length" class="pb-case-list">
        <li v-for="(item, index) in visibleRows" :key="index">
          <PortalBlockLink :url="field(item, 'link')" class="pb-case-list__row">
            <span class="pb-case-list__title">{{ field(item, 'title') }}</span>
            <span v-if="meta(item)" class="pb-case-list__meta">{{ meta(item) }}</span>
            <p v-if="field(item, 'summary')" class="pb-case-list__summary">{{ field(item, 'summary') }}</p>
          </PortalBlockLink>
        </li>
      </ul>
      <p v-else class="pb-block-state pb-block-state--empty">
        {{ selected ? '这个行业还没有案例' : '还没有发布案例' }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { BlockContext, Item } from './types'
import { field, isDemoContext, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'
import { fetchCaseFacets, fetchCases } from '../api/portalPublic'

/**
 * 案例列表页那一版排布（逐行而不是卡片）。
 *
 * <p>筛选逻辑与 CaseGridBlock 同形但不共享文件：区块层没有第五个可写的公共文件这一说
 * （registry/blockDemo/less 各有其主），把同一段两百行的取数塞进谁里都不对，
 * 于是两处各自实现、口径同源——industry 精确匹配、size 有界、facets 只从数据里数。</p>
 */
const props = defineProps<BlockContext>()

/** 列表行比卡片高，一屏放得下的量少一些；上限由后端 size 那一刀守住，这里不无界拉 */
const CASE_PAGE_SIZE = 10

const heading = computed(() => text(props.blockProps, 'heading'))
const boundItems = computed(() => list(props.blockProps, 'items'))

const demo = isDemoContext(props.shell)

const industries = ref<string[]>([])
const selected = ref('')
const status = ref<'ready' | 'loading' | 'error'>(demo ? 'ready' : 'loading')
const errorMessage = ref('')
const fetchedRows = ref<Item[]>([])

const visibleRows = computed<Item[]>(() => {
  if (!demo) {
    return fetchedRows.value
  }
  return selected.value
    ? boundItems.value.filter(item => field(item, 'industry') === selected.value)
    : boundItems.value
})

const showSection = computed(() => !demo || boundItems.value.length > 0)

let requestSeq = 0

async function loadCases(industry: string) {
  const token = ++requestSeq
  status.value = 'loading'
  try {
    const params = { page: 1, size: CASE_PAGE_SIZE, ...(industry ? { industry } : {}) }
    const page = await fetchCases(params)
    if (token !== requestSeq) {
      return
    }
    fetchedRows.value = page.records as unknown as Item[]
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

function pick(industry: string) {
  if (selected.value === industry) {
    return
  }
  selected.value = industry
  if (!demo) {
    loadCases(industry)
  }
}

onMounted(() => {
  if (demo) {
    const seen: string[] = []
    for (const item of boundItems.value) {
      const industry = field(item, 'industry')
      if (industry && !seen.includes(industry)) {
        seen.push(industry)
      }
    }
    industries.value = seen.sort()
    return
  }
  fetchCaseFacets()
    .then(facets => {
      industries.value = facets.industries || []
    })
    .catch(() => {
      industries.value = []
    })
  loadCases('')
})

function meta(item: Item) {
  return [field(item, 'customerName'), field(item, 'industry')].filter(Boolean).join(' · ')
}
</script>

<style scoped lang="less">
.pb-case-list {
  margin: 0;
  padding: 0;
  list-style: none;

  &__row {
    display: block;
    padding: calc(22px * var(--portal-spacing-scale)) 0;
    border-bottom: 1px solid var(--portal-color-border);
    text-decoration: none;
  }

  &__title {
    display: block;
    font-size: calc(18px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }

  &__meta {
    display: block;
    margin-top: 6px;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-primary);
  }

  &__summary {
    margin: 8px 0 0;
    font-size: calc(14px * var(--portal-font-scale));
    line-height: 1.7;
    color: var(--portal-color-muted);
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
