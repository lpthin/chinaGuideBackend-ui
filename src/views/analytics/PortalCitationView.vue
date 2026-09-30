<template>
  <div class="portal-citation-page">
    <a-form layout="inline" class="portal-citation-page__filter">
      <a-form-item label="站点">
        <a-select v-model:value="siteId" style="width: 220px" :options="siteOptions" @change="loadAll" />
      </a-form-item>
      <a-form-item label="区间">
        <a-range-picker v-model:value="dateRange" :allow-clear="false" @change="loadAll" />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-button :loading="loading" @click="loadAll">刷新</a-button>
      </a-form-item>
    </a-form>

    <a-alert
      v-if="summary && summary.probeCount === 0"
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="summary.lastProbeNotice || '这个区间还没有跑过品牌引用探测：引用数为 0 表示「没查过」，不是「没人提」。'"
    />

    <!-- 窄屏验收（Spec-F §9 移动 375）：这份汇总原来是写死的 4 列，375px 下整张表被撑到 456px、
         而 a-descriptions 外层没有滚动条 ⇒ 后面几格的数字在手机上根本看不见。
         这里改走 antd 自己的响应式列数（对象形），一屏一格，不新增组件、不改字段。 -->
    <a-descriptions
      v-if="summary"
      :column="{ xs: 1, sm: 1, md: 2, lg: 4, xl: 4, xxl: 4 }"
      size="small"
      bordered
      style="margin-bottom: 16px"
    >
      <a-descriptions-item label="探测轮数">{{ summary.probeCount }}</a-descriptions-item>
      <a-descriptions-item label="外呼 / 提到我们">{{ summary.callCount }} / {{ summary.citedCallCount }}</a-descriptions-item>
      <a-descriptions-item label="问过几家模型">{{ summary.distinctModels }}</a-descriptions-item>
      <a-descriptions-item label="最近一轮">
        {{ summary.lastProbedAt ? formatDateTime(summary.lastProbedAt) : PH_NOT_RUN }}
        <span v-if="summary.lastProbeStatus">（{{ statusLabel(summary.lastProbeStatus) }}）</span>
      </a-descriptions-item>
      <a-descriptions-item label="被引用的页面">{{ summary.citedPageCount }} / 已发布页 {{ typeCount('page') }}</a-descriptions-item>
      <a-descriptions-item label="被引用的文章">{{ summary.citedArticleCount }} / 已发布文 {{ typeCount('article') }}</a-descriptions-item>
      <a-descriptions-item label="被引用的案例">{{ summary.citedCaseCount }} / 已发布案例 {{ typeCount('case') }}</a-descriptions-item>
      <a-descriptions-item label="问过 / 应判定">
        {{ summary.coveredTargets }} / {{ summary.totalTargets }}
        <span class="portal-citation-page__muted">（差值是发布得比最后一轮晚、还没进过探测的对象）</span>
      </a-descriptions-item>
      <a-descriptions-item label="最近一轮说明">{{ summary.lastProbeNotice || PH_DASH }}</a-descriptions-item>
    </a-descriptions>

    <a-radio-group v-model:value="tab" button-style="solid" style="margin-bottom: 12px">
      <a-radio-button v-for="key in targetTabs" :key="key" :value="key">
        {{ typeLabel(key) }}（{{ typeCount(key) }}）
      </a-radio-button>
    </a-radio-group>

    <state-block v-if="loadError" state="error" :detail="loadError" />
    <state-block v-else-if="!loading && visibleTargets.length === 0" state="empty" :title="targetEmptyTitle" />
    <data-table
      v-else
      :data-source="visibleTargets"
      :columns="targetColumns"
      :loading="loading"
      :pagination="{ pageSize: 20 }"
      row-key="rowKey"
      size="middle"
      style="margin-bottom: 16px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'label'">
          <div>{{ record.label || PH_DASH }}</div>
          <div class="portal-citation-page__muted">{{ record.url || PH_DASH }}</div>
        </template>
        <template v-else-if="column.key === 'citeCount'">
          <a-tag v-if="record.citeCount > 0" color="green">{{ record.citeCount }} 次</a-tag>
          <a-tag v-else-if="record.probeCount > 0">查过，没提到</a-tag>
          <a-tag v-else>{{ PH_NOT_COVERED }}</a-tag>
        </template>
        <template v-else-if="column.key === 'strength'">
          <div>{{ record.lastMatchLabel || matchKindLabel(record.lastMatchKind) || PH_DASH }}</div>
          <div class="portal-citation-page__muted">
            {{ record.lastProbedAt ? formatDateTime(record.lastProbedAt) : '这个区间内没有查过它' }}
          </div>
        </template>
        <template v-else-if="column.key === 'op'">
          <a-button size="small" type="link" :disabled="!record.citeCount" @click="openEvidence(record)">
            看证据
          </a-button>
        </template>
      </template>
    </data-table>

    <a-card size="small" title="流量来源（人工浏览，与爬虫抓取不相加）">
      <data-table
        :data-source="traffic.buckets || []"
        :columns="trafficColumns"
        :loading="trafficLoading"
        :error="trafficError"
        row-key="key"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'domains'">
            <a-space wrap>
              <a-tag v-for="domain in record.topDomains" :key="domain">{{ domain }}</a-tag>
            </a-space>
          </template>
        </template>
      </data-table>
      <a-alert v-if="traffic.notice" type="warning" show-icon style="margin-top: 12px" :message="traffic.notice" />
      <div v-if="traffic.totalViews" class="portal-citation-page__muted" style="margin-top: 8px">
        {{ traffic.from }} ~ {{ traffic.to }} 合计 {{ traffic.totalViews }} 次浏览。
        「直接访问」里也包含从聊天工具里复制网址打开的那一类——那种访问没有 referer，界面如实合并显示。
      </div>
    </a-card>

    <a-drawer v-model:open="evidenceOpen" :title="evidenceTitle" width="820" placement="right">
      <a-spin :spinning="evidenceLoading">
        <state-block v-if="evidenceError" state="error" :detail="evidenceError" />
        <state-block
          v-else-if="!evidence.length"
          state="empty"
          title="这条对象当前没有可展示的命中记录"
        />
        <div v-for="item in evidence" :key="item.hitId" class="portal-citation-page__evidence">
          <div class="portal-citation-page__head">
            <a-tag color="green">{{ item.matchLabel || matchKindLabel(item.matchKind) }}</a-tag>
            <span>{{ item.provider }} / {{ item.modelName }}</span>
            <span class="portal-citation-page__muted">{{ item.probedAt ? formatDateTime(item.probedAt) : '' }}</span>
          </div>
          <div class="portal-citation-page__question">问：{{ item.questionText }}</div>
          <div class="portal-citation-page__snippet">
            答：……{{ item.snippet || '（没有可展示的上下文）' }}……
          </div>
          <div class="portal-citation-page__muted">命中的字面串：{{ item.matchedText }}</div>
        </div>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { siteApi } from '../../api/workspace'
import DataTable from '../../components/DataTable.vue'
import StateBlock from '../../components/StateBlock.vue'
import { formatDateTime } from '../../utils/format'
import { PH_DASH, PH_NOT_COVERED, PH_NOT_RUN } from '../../utils/display'
import { logError } from '../../utils/errorLog'
import {
  citationApi,
  type CitationEvidence,
  type CitationSummary,
  type CitationTargetStat,
  type CitationVocabulary,
  type TrafficSourceResult
} from '../../api/citation'

/**
 * 租户侧的「我被 AI 引用了几次、人是从哪来的」（问题三 + 问题七）。
 *
 * 三条刻意：
 * 1. 0 与「没查过」是两件事：分母用的是当前已发布清单，所以一条引用都没有的行照样在，
 *    只是显示「查过，没提到」；压根没探过才显示「未覆盖」——把两者混成一个 0，
 *    租户就会以为自己做错了什么；
 * 2. 所有中文词（状态、强度、来源桶名）都来自 `/portal/citations/labels` 与响应里的 label 字段，
 *    TS 里不翻译（I-1）；
 * 3. 这一页全是 GET：租户侧没有任何改内容、改探测的口子，能做的只有看和复核证据。
 */

const siteId = ref<number | null>(null)
const sites = ref<Array<{ id: number; name: string }>>([])
const dateRange = ref<[Dayjs, Dayjs]>([dayjs().subtract(89, 'day'), dayjs()])
const tab = ref('page')
const loading = ref(false)
const trafficLoading = ref(false)
// 这一页今天第一次有「读失败了」这一态：以前失败只弹一句 toast，屏幕留在上一轮的数上，
// 租户看不出自己看的是旧的还是空的（§9.2-4 三态）
const loadError = ref<string | null>(null)
const trafficError = ref<string | null>(null)
const evidenceError = ref<string | null>(null)
const targetEmptyTitle = '这个站点还没有已发布对象：探测的分母来自已发布、非演示的页面与文章'

const vocabulary = ref<CitationVocabulary | null>(null)
const summary = ref<CitationSummary | null>(null)
const targets = ref<Array<CitationTargetStat & { rowKey: string }>>([])
const evidence = ref<CitationEvidence[]>([])
const traffic = ref<TrafficSourceResult>({
  tenantId: 0, siteId: null, from: '', to: '', totalViews: 0, buckets: [], empty: true, notice: null
})

const evidenceOpen = ref(false)
const evidenceLoading = ref(false)
const evidenceTitle = ref('引用证据')

const targetColumns = [
  { title: '对象', key: 'label' },
  { title: '被引用', key: 'citeCount', width: 140 },
  { title: '最强判定', key: 'strength', width: 200 },
  { title: '操作', key: 'op', width: 100 }
]

const trafficColumns = [
  { title: '来源', dataIndex: 'label', key: 'label', width: 140 },
  { title: '浏览量', dataIndex: 'views', key: 'views', width: 100 },
  { title: '访客（来源内去重）', dataIndex: 'visitors', key: 'visitors', width: 150 },
  { title: '具体来路', key: 'domains' }
]

const siteOptions = computed(() => sites.value.map((site) => ({ value: site.id, label: site.name })))
// 有哪几类对象、叫什么，全随后端词表（I-1）：这里只按「这批行里真出现了哪些类型」出 tab
const targetTabs = computed(() => {
  const present = [...new Set(targets.value.map((row) => row.targetType))]
  const order = vocabulary.value ? Object.keys(vocabulary.value.targetTypes) : present
  return order.filter((key) => key !== 'site' && present.includes(key))
})

function typeLabel(key: string): string {
  return vocabulary.value?.targetTypes?.[key] || key
}

function typeCount(key: string): number {
  return targets.value.filter((row) => row.targetType === key).length
}
const visibleTargets = computed(() => {
  const active = targetTabs.value.includes(tab.value) ? tab.value : targetTabs.value[0]
  return targets.value.filter((row) => row.targetType === active)
})

function statusLabel(status: string): string {
  return vocabulary.value?.statuses?.[status] || status
}

function matchKindLabel(kind: string | null): string {
  if (!kind) return ''
  return vocabulary.value?.matchKinds?.[kind] || kind
}

function rangeParams(): { siteId: number; from?: string; to?: string } {
  return {
    siteId: siteId.value as number,
    from: dateRange.value[0]?.format('YYYY-MM-DD'),
    to: dateRange.value[1]?.format('YYYY-MM-DD')
  }
}

async function loadAll(): Promise<void> {
  if (!siteId.value) return
  loading.value = true
  loadError.value = null
  try {
    // 一次取全部对象（不传 targetType）：页面/文章/案例来自同一个 /targets 端点，
    // 分三次发请求只是把「有哪几类」抄在了前端（I-1）
    const [summaryResult, rows] = await Promise.all([
      citationApi.summary(rangeParams()),
      citationApi.targets(rangeParams())
    ])
    summary.value = summaryResult
    targets.value = rows.map((row) => ({
      ...row,
      rowKey: `${row.targetType}-${row.targetId ?? 'site'}`
    }))
  } catch (error) {
    loadError.value = (error as Error).message || '引用统计加载失败'
    message.error(loadError.value)
    logError('portal-citation-summary', error)
  } finally {
    loading.value = false
  }
  await loadTraffic()
}

async function loadTraffic(): Promise<void> {
  if (!siteId.value) return
  trafficLoading.value = true
  trafficError.value = null
  try {
    traffic.value = await citationApi.trafficSources(rangeParams())
  } catch (error) {
    trafficError.value = (error as Error).message || '流量来源加载失败'
    message.error(trafficError.value)
    logError('portal-citation-traffic', error)
  } finally {
    trafficLoading.value = false
  }
}

async function openEvidence(record: CitationTargetStat): Promise<void> {
  evidenceOpen.value = true
  evidenceLoading.value = true
  evidenceError.value = null
  evidenceTitle.value = `引用证据：${record.label || record.url || ''}`
  evidence.value = []
  try {
    evidence.value = await citationApi.evidence({
      siteId: siteId.value,
      targetType: record.targetType,
      targetId: record.targetId
    })
  } catch (error) {
    evidenceError.value = (error as Error).message || '证据加载失败'
    message.error(evidenceError.value)
    logError('portal-citation-evidence', error)
  } finally {
    evidenceLoading.value = false
  }
}

onMounted(async () => {
  try {
    const [labels, list] = await Promise.all([citationApi.labels(), siteApi.list()])
    vocabulary.value = labels
    sites.value = (list || []).map((site: any) => ({ id: site.id, name: site.name }))
    siteId.value = sites.value[0]?.id ?? null
  } catch (error) {
    loadError.value = (error as Error).message || '页面初始化失败'
    message.error(loadError.value)
    logError('portal-citation-init', error)
    return
  }
  await loadAll()
})
</script>

<style scoped>
.portal-citation-page__filter {
  margin-bottom: 12px;
}
.portal-citation-page__muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.portal-citation-page__evidence {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.portal-citation-page__head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.portal-citation-page__question {
  margin-bottom: 6px;
}
.portal-citation-page__snippet {
  margin-bottom: 6px;
  padding: 8px 10px;
  background: #fafafa;
  border-radius: 4px;
  line-height: 1.7;
}
.toolbar-actions {
  margin-left: auto;
}
</style>
