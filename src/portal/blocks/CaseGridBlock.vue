<template>
  <section v-if="showSection" class="pb-section pb-section--muted">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>

      <!-- 筛选条：行业名单来自数据本身（真站走 /cases/facets，画廊从绑定条目里数），
           这里不写死任何行业词；不足两个行业时整条不摆——只有一个可选项的筛选不是筛选。 -->
      <div v-if="industries.length > 1" class="pb-filter" role="group" aria-label="按行业筛选">
        <button type="button" class="pb-filter__chip" :class="{ 'is-active': selected === '' }" @click="pick('')">
          全部
        </button>
        <button v-for="industry in industries" :key="industry" type="button" class="pb-filter__chip"
          :class="{ 'is-active': selected === industry }" @click="pick(industry)">
          {{ industry }}
        </button>
      </div>

      <!-- 加载中 / 失败 / 空 三种状态分开说：一句「暂无数据」把接口挂了演成没内容，是谎报 -->
      <p v-if="status === 'loading'" class="pb-block-state">案例加载中…</p>
      <p v-else-if="status === 'error'" class="pb-block-state pb-block-state--error" role="alert">
        案例加载失败：{{ errorMessage }}
      </p>
      <div v-else-if="visibleRows.length" class="pb-grid" :class="gridClass">
        <PortalBlockLink v-for="(item, index) in visibleRows" :key="index" :url="field(item, 'link')"
          class="pb-card pb-case-card">
          <img v-if="field(item, 'coverImage')" :src="field(item, 'coverImage')" :alt="field(item, 'title')"
            class="pb-cover" />
          <h3 class="pb-card-title">{{ field(item, 'title') }}</h3>
          <p v-if="meta(item)" class="pb-card-meta">{{ meta(item) }}</p>
          <p v-if="field(item, 'summary')" class="pb-card-text">{{ field(item, 'summary') }}</p>
        </PortalBlockLink>
      </div>
      <p v-else class="pb-block-state pb-block-state--empty">
        {{ selected ? '这个行业还没有案例' : '还没有发布案例' }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { BlockContext, Item } from './types'
import { columnsClassOf, field, isDemoContext, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'
import { fetchCaseFacets, fetchCases } from '../api/portalPublic'

/**
 * 案例网格：卡片图片 hover/focus 缩放 + 按行业筛选（需求单点名的两件事）。
 *
 * <p>取数分两条路，判据是壳的真假（isDemoContext）：画廊/搭建器预览拿着演示壳或 null 壳，
 * 那儿没有租户可查，就老老实实渲染 $data 绑定给来的 items，行业名单从这批条目里数；
 * 真站上条目以公开口 /cases 为准——筛选是服务端语义（industry 精确匹配，见 PortalContentService.cases），
 * 前端只在已给出的有限条目里做假筛选的话，翻页后的案例永远筛不到。</p>
 */
const props = defineProps<BlockContext>()

/**
 * 一次摆满网格一屏半的量。后端把 size 收在 50（Math.min 那一刀），这儿取 12：
 * 前端不无界拉全量，要更多去案例列表页翻页。
 */
const CASE_PAGE_SIZE = 12

const heading = computed(() => text(props.blockProps, 'heading'))
const gridClass = computed(() => columnsClassOf(props.blockProps))
const boundItems = computed(() => list(props.blockProps, 'items'))

const demo = isDemoContext(props.shell)

const industries = ref<string[]>([])
const selected = ref('')
const status = ref<'ready' | 'loading' | 'error'>(demo ? 'ready' : 'loading')
const errorMessage = ref('')
const fetchedRows = ref<Item[]>([])

/** 真站读服务端来的那一页；画廊读绑定的 items，筛选在这批条目里就地做 */
const visibleRows = computed<Item[]>(() => {
  if (!demo) {
    return fetchedRows.value
  }
  return selected.value
    ? boundItems.value.filter(item => field(item, 'industry') === selected.value)
    : boundItems.value
})

/** 演示壳且没绑条目 ⇒ 整块不渲染（旧行为）；真站哪怕空态也要出那句话 */
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
    // 名单从数据本身数：空行业的条目不进名单（它们没得筛）
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
  // 筛选面与首屏条目各取各的：facets 挂了只丢筛选条，不该把整个案例区报成加载失败
  fetchCaseFacets()
    .then(facets => {
      industries.value = facets.industries || []
    })
    .catch(() => {
      industries.value = []
    })
  loadCases('')
})

/** 客户名与行业是案例的两个关键信息，缺一个就少一段，不补「未知行业」这类假值 */
function meta(item: Item) {
  return [field(item, 'customerName'), field(item, 'industry')].filter(Boolean).join(' · ')
}
</script>

<style scoped lang="less">
.pb-card-meta {
  margin: 0 0 8px;
  font-size: calc(13px * var(--portal-font-scale));
  color: var(--portal-color-primary);
}

.pb-case-card {
  .pb-cover {
    /* 缩放走 transform + transition：换 width/height 会把整排卡片挤动，那不是动效那是抖动 */
    transition: transform 0.45s ease;
    transform-origin: center;
    will-change: transform;
  }

  /* 只在「设备真有 hover 能力」时生效：触屏上没有 hover，:hover 会残留在
     上一次点过的卡片上（俗称「粘住的悬停」），窄屏/触屏访客看到的就是不明所以的放大图。 */
  @media (hover: hover) {
    &:hover .pb-cover {
      transform: scale(1.05);
    }
  }

  /* 键盘访客同样给缩放：卡片的可达态不该只有鼠标用户有 */
  &:focus-visible .pb-cover {
    transform: scale(1.05);
  }
}

/* 缩放也是动效：系统压制动效动画的访客只拿到静态卡片 */
@media (prefers-reduced-motion: reduce) {
  .pb-case-card .pb-cover {
    transition: none;
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
