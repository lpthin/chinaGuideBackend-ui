<template>
  <div class="reference-site-page__pages">
    <a-alert
      v-if="vocabError"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`路由清单的词表没读到，下面几列显示的是后端原值而不是中文标签（${vocabError}）。`
        + `清单本身照样能看，重试请点页面顶部的「刷新」`"
    />
    <a-alert
      v-if="hydratedRoutes"
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="`${hydratedRoutes} 条路由的版面是 JS 渲染出来的：HTTP 原文只是一具壳，链接与分区都取自浏览器渲染后的版面。`
        + `本地截图服务不可用时这一路会退化成「一条都没发现」，那种情况下结论写在上面的「最近一次结果」里`"
    />
    <a-alert
      v-if="deadRoutes"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="`${deadRoutes} 条路由在清单里但抓不开，它们的抓取状态那一格写着为什么。`
        + `死链仍然留在清单里（那是这一站的真实结构），但不会被当成页入库、也不进摘要与草稿`"
    />
    <a-table
      class="reference-site-page__routes"
      :data-source="pages"
      :columns="pageColumns"
      :loading="loading"
      :pagination="false"
      :row-selection="pageSelection"
      row-key="id"
      size="small"
      :scroll="{ x: 1420 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'route'">
          <div class="reference-site-page__route">{{ record.routePath || record.url || '—' }}</div>
          <div v-if="record.pageName" class="reference-site-page__muted">{{ record.pageName }}</div>
          <div v-else-if="record.url" class="reference-site-page__muted">{{ record.url }}</div>
        </template>
        <template v-else-if="column.key === 'provenance'">
          <div>{{ label('renderMode', record.renderMode) }}</div>
          <div class="reference-site-page__muted">{{ label('linkSource', record.linkSource) }}</div>
        </template>
        <template v-else-if="column.key === 'crawlState'">
          <a-tag :color="referenceCrawlStateColor(record.crawlState)">
            {{ label('crawlState', record.crawlState) }}
          </a-tag>
          <div v-if="record.fetchedAt" class="reference-site-page__muted">
            抓取于 {{ formatDateTime(record.fetchedAt) }}
          </div>
        </template>
        <template v-else-if="column.key === 'shots'">
          <div class="reference-site-page__shots">
            <div v-for="viewport in viewports" :key="viewport.value" class="reference-site-page__shot">
              <span class="reference-site-page__muted">{{ viewport.label }}</span>
              <a-image
                v-if="record[viewport.mediaField]"
                :src="shotUrlOf(record, viewport.mediaField)"
                :width="64"
                :alt="`${viewport.label}截图`"
              />
              <span v-else class="reference-site-page__muted">缺</span>
            </div>
          </div>
        </template>
        <template v-else-if="column.key === 'structure'">
          <div>{{ sectionText(record) }}</div>
          <div class="reference-site-page__muted">{{ tokensText(record) }}</div>
        </template>
        <template v-else-if="column.key === 'robots'">
          <a-tag v-if="record.robotsAllowed === false" color="red">被对方限制</a-tag>
          <a-tag v-else-if="record.fetchedAt" color="green">允许</a-tag>
          <span v-else class="reference-site-page__muted">还没抓，没判过</span>
        </template>
        <template v-else-if="column.key === 'sections'">
          <a-tooltip v-if="rolesOf(record)" :title="rolesOf(record)">
            <span>{{ rolesOf(record) }}</span>
          </a-tooltip>
          <span v-else class="reference-site-page__muted">还没归纳</span>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="清单还是空的：网址任务点「只列路由清单」或直接「开始抓取」，截图任务在下面上传" />
      </template>
    </a-table>

    <a-divider orientation="left">补传一张截图</a-divider>
    <a-form layout="inline">
      <a-form-item label="挂到哪一页">
        <a-select v-model:value="shotForm.referencePageId" style="width: 300px" :options="pageOptions">
        </a-select>
      </a-form-item>
      <a-form-item label="视口">
        <a-select v-model:value="shotForm.viewport" style="width: 110px" :options="viewportOptions" />
      </a-form-item>
      <a-form-item>
        <a-upload :before-upload="pickShot" :show-upload-list="false" accept="image/*">
          <a-button :loading="uploading">选择图片并上传</a-button>
        </a-upload>
      </a-form-item>
    </a-form>
    <p class="reference-site-page__muted">
      上传这一步不花钱：不 OCR、不调模型。但一个任务里<b>只有截图、没有抓取摘要</b>时，
      「开始 AI 摄取」会把截图交给视觉模型看版面（每页一张、桌面优先，一次最多 6 页），
      这一步要花 token，点之前会先给预估。两种材料都有时走抓取摘要那条路——它不需要图片，更便宜。
      本租户没配视觉模型时会借用平台的（平台也没有就直接被拒），原因写在预估弹窗里；届时也可以照截图在页面搭建器里手搭。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  portalReferenceApi,
  observedSectionsOf,
  referenceCrawlStateColor,
  referenceLabel,
  sectionCountOf,
  tokenLayersOf,
  REFERENCE_VIEWPORTS,
  type ReferencePage,
  type ReferenceVocabularies
} from '../../../api/referenceSites'
import { formatDateTime } from '../../../utils/format'

/**
 * 路由清单那一栏：一条路由一行，从「只列清单」到「抓完了」都写在这一行上。
 *
 * <p>刻意不给「未抓」的页算失败：清单里有 10 条、抓开 6 条是这一站的真实结构（页脚那条 /contact
 * 常常就是死的），差别必须落在「抓取状态」那一格里，而不是变成一次红色报错。</p>
 *
 * <p>勾选框只在还能开始抓取的任务上给（`selectable` 由上层按后端那三条判据算）：任务一旦跑过，
 * 后端就不再接受 pending → crawling，这时候给一排勾得动、按下去报红的勾选框，
 * 等于界面自己造一个假入口。要重跑某一页，仍然可以走「不勾选、整站按上限重抓」那一路。</p>
 */

const props = defineProps<{
  referenceId: number
  pages: ReferencePage[]
  loading: boolean
  /** 这一趟还能不能再发起抓取：决定那一排勾选框摆不摆 */
  selectable: boolean
  selectedPageIds: number[]
  vocabularies: ReferenceVocabularies | null
  /** 词表没读到时那句「下面念的是后端原值」要写在清单顶上，不能悄悄退回原值 */
  vocabError: string | null
  /** 素材 id → 后端现签的可显示地址；截图列的 <img> 只能用这个，不能拿 id 拼 */
  shotUrls: Record<number, string>
}>()

const emit = defineEmits<{
  (e: 'update:selectedPageIds', ids: number[]): void
  (e: 'uploaded'): void
}>()

const pageColumns = [
  { title: '路由', key: 'route', width: 220 },
  { title: '版面与来源', key: 'provenance', width: 240 },
  { title: '抓取状态', key: 'crawlState', width: 200 },
  { title: '三视口截图', key: 'shots', width: 260 },
  { title: '结构与 token', key: 'structure', width: 220 },
  { title: 'robots', key: 'robots', width: 130 },
  { title: '归纳出的分区', key: 'sections', width: 200 }
]

const viewports = REFERENCE_VIEWPORTS
const shotForm = reactive<{ referencePageId: number | null; viewport: string }>({
  referencePageId: null,
  viewport: 'desktop'
})
const uploading = ref(false)

const pageOptions = computed(() =>
  props.pages.map(page => ({
    value: page.id,
    label: page.routePath || page.url || `第 ${page.id} 号页面（截图）`
  }))
)
const viewportOptions = computed(() => viewports.map(item => ({ value: item.value, label: item.label })))

const hydratedRoutes = computed(() => props.pages.filter(page => page.renderMode === 'hydrated').length)
/** 死链与被挡：清单里留着它们，但它们不是「抓到的页」 */
const deadRoutes = computed(
  () => props.pages.filter(page => page.crawlState === 'not_found' || page.crawlState === 'blocked').length
)

const pageSelection = computed(() =>
  props.selectable
    ? {
        selectedRowKeys: props.selectedPageIds,
        onChange: (keys: Array<string | number>) => {
          emit('update:selectedPageIds', keys.map(Number))
        }
      }
    : undefined
)

// 清单第一次有行时把「挂到哪一页」落在第一条上：一进来就空着一个必填下拉，上传会先吃一次「请先选」
watch(
  () => props.pages,
  rows => {
    if (shotForm.referencePageId === null && rows.length) shotForm.referencePageId = rows[0].id
  },
  { immediate: true }
)

/** 认不出的取值原样显示，理由见 api/referenceSites.ts 里 referenceLabel 的注释 */
function label(group: keyof ReferenceVocabularies, value: string | null | undefined) {
  return referenceLabel(props.vocabularies, group, value)
}

function shotUrlOf(page: ReferencePage, field: 'shotDesktopId' | 'shotTabletId' | 'shotMobileId') {
  // 页行里只有素材 id，可显示的公开路径要按 id 去 /media 查回来的那张表里找。
  // 查不到就返回空串：a-image 会显占位错误，比硬拼一个打不开的链接诚实。
  const mediaId = page[field]
  return mediaId ? props.shotUrls[mediaId] || '' : ''
}

function sectionText(page: ReferencePage) {
  const count = sectionCountOf(page)
  if (count === null) return '暂无结构摘要（这张页没有被抓取过）'
  return `结构摘要：${count} 格`
}

function tokensText(page: ReferencePage) {
  const layers = tokenLayersOf(page)
  if (!layers) return '无 token 采样'
  const siteKeys = layers.site ? Object.keys(layers.site).length : 0
  const hintCount = layers.sectionHints.length
  // 老行是扁平的一份，当时还没有「站级 / 段级」这层区分，别把它说成两层都采过
  if (layers.legacy) return `token 采样：${siteKeys} 项（分层之前的老行，按站级看）`
  const parts = [siteKeys ? `站级 ${siteKeys} 项` : '站级无（sidecar 没采样到）']
  if (hintCount) parts.push(`段级提示 ${hintCount} 格（只作取证，不上身）`)
  return parts.join(' · ')
}

function rolesOf(page: ReferencePage) {
  const sections = observedSectionsOf(page)
  if (!sections.length) return ''
  return sections
    .map(section => String(section.role ?? ''))
    .filter(Boolean)
    .join('、')
}

/** 交给 a-upload 的 beforeUpload：返回 false 表示不走它自带的上传，改由我们带 viewport 参数发出去 */
function pickShot(file: File) {
  uploadShot(file)
  return false
}

async function uploadShot(file: File) {
  if (!props.referenceId) return
  if (!shotForm.viewport) {
    message.warning('请先选这张截图是哪个视口的')
    return
  }
  uploading.value = true
  try {
    const result = await portalReferenceApi.uploadShot(
      props.referenceId,
      shotForm.viewport,
      file,
      shotForm.referencePageId
    )
    message.success(`已上传${labelOfViewport(result.viewport)}截图`)
    emit('uploaded')
  } catch (error) {
    message.error((error as Error).message || '截图上传失败')
  } finally {
    uploading.value = false
  }
}

function labelOfViewport(viewport: string) {
  return viewports.find(item => item.value === viewport)?.label || viewport
}
</script>

<style scoped lang="less">
.reference-site-page {
  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__shots {
    display: flex;
    gap: 12px;
  }

  &__shot {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  &__route {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 600;
  }
}
</style>
