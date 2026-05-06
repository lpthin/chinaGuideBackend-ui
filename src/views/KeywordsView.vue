<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Aim, CollectionTag, Connection, Cpu, DataAnalysis, Document, MagicStick, Search, TrendCharts, Upload } from '@element-plus/icons-vue'
import { collectHotwordsApi, deleteKeywordApi, deleteKeywordClusterApi, deleteKeywordsBatchApi, deleteKeywordClustersBatchApi, distillKeywordsApi, generateClusterSuggestionsApi, importKeywordsApi, listKeywordClustersApi, listKeywordCollectionJobsApi, listKeywordsApi, updateKeywordContentSuggestionApi } from '@/api/keywords'
import { useSiteStore } from '@/stores/site'
import type { Keyword, KeywordCluster, KeywordCollectionJob, KeywordContentSuggestion } from '@/types/api'

type DistillCluster = KeywordCluster

type PromptSuggestionRow = KeywordContentSuggestion & {
  clusterName: string
  searchIntent?: string
  suggestedCategory?: string
  articleDirection?: string
  clusterPriority?: number
}

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const activeTab = ref('collect')
const loading = ref(false)
const generatingClusterId = ref<number | null>(null)
const kwSelection = ref<Keyword[]>([])
const clusterSelection = ref<DistillCluster[]>([])
const distilling = ref(false)
const collecting = ref(false)
const selectedSources = ref(['site_profile', 'rule_expand', 'baidu_suggest'])
const sourceOptions = [
  { label: '站点画像', value: 'site_profile' },
  { label: '规则扩展', value: 'rule_expand' },
  { label: '百度联想', value: 'baidu_suggest' },
  { label: '5118（待接入）', value: '5118' },
  { label: '百度指数（待接入）', value: 'baidu_index' },
  { label: '抖音指数（待接入）', value: 'douyin_index' }
]
const sourceLabelMap = Object.fromEntries(sourceOptions.map((item) => [item.value, item.label.replace('（待接入）', '')]))
const importDialogVisible = ref(false)
const importText = ref('')
const keywordStatusFilter = ref<'pending' | 'distilled' | 'all'>('pending')
const keywordSourceFilter = ref('all')
const keywordBatchFilter = ref('')
const suggestionDialogVisible = ref(false)
const editingSuggestion = ref<PromptSuggestionRow | null>(null)
const suggestionForm = reactive({ title: '', contentPrompt: '', score: 50, reason: '', status: 'candidate' })
const keywords = ref<Keyword[]>([])
const clusters = ref<DistillCluster[]>([])
const collectionJobs = ref<KeywordCollectionJob[]>([])

const pendingKeywords = computed(() => keywords.value.filter((item) => item.status !== 'distilled').length)
const distilledKeywords = computed(() => keywords.value.filter((item) => item.status === 'distilled').length)
const promptSuggestions = computed<PromptSuggestionRow[]>(() => clusters.value.flatMap((cluster) => {
  const suggestions = cluster.contentSuggestions?.length
    ? cluster.contentSuggestions
    : (cluster.contentPrompt || cluster.articleTitle ? [{
        id: undefined,
        siteId: cluster.siteId,
        clusterId: cluster.id,
        title: cluster.articleTitle || cluster.name,
        contentPrompt: cluster.contentPrompt || '待蒸馏生成内容 Prompt',
        score: cluster.priority,
        reason: '历史聚类字段',
        status: 'candidate'
      }] : [])
  return suggestions.map((suggestion) => ({
    ...suggestion,
    clusterName: cluster.name,
    searchIntent: cluster.searchIntent,
    suggestedCategory: cluster.suggestedCategory,
    articleDirection: cluster.articleDirection,
    clusterPriority: cluster.priority
  }))
}))
const promptReadyCount = computed(() => promptSuggestions.value.length)
const latestJob = computed(() => collectionJobs.value[0])

const workflowCards = computed(() => [
  { key: 'collect', title: '热词采集', desc: '从站点画像与外部信源补充候选词', metric: collectionJobs.value.length, unit: '批次', icon: Search },
  { key: 'pool', title: '关键词池', desc: '默认看未蒸馏词，可按状态/信源/批次过滤', metric: filteredKeywords.value.length, unit: '个', icon: CollectionTag },
  { key: 'cluster', title: '意图聚类', desc: '一个聚类可沉淀最多 5 条内容建议', metric: clusters.value.length, unit: '组', icon: DataAnalysis },
  { key: 'prompt', title: '内容 Prompt', desc: '多建议列表、评分和详情编辑', metric: promptReadyCount.value, unit: '条', icon: Document }
])

const keywordSourceOptions = computed(() => {
  const set = new Set<string>()
  keywords.value.forEach((item) => formatSources(item.sourceCodes).forEach((source) => set.add(source)))
  return Array.from(set)
})

const batchDisplayMap = computed(() => {
  const rows = [...collectionJobs.value].reverse()
  const dailyCount = new Map<string, number>()
  const result = new Map<string, string>()
  rows.forEach((job) => {
    const dateKey = extractBatchDateKey(job.batchNo, job.createdAt)
    const next = (dailyCount.get(dateKey) || 0) + 1
    dailyCount.set(dateKey, next)
    result.set(job.batchNo, `${dateKey.slice(0, 4)}年${dateKey.slice(4, 6)}月${dateKey.slice(6, 8)}日-${String(next).padStart(2, '0')}`)
  })
  return result
})

const filteredKeywords = computed(() => keywords.value.filter((item) => {
  const statusMatch = keywordStatusFilter.value === 'all'
    || (keywordStatusFilter.value === 'pending' ? item.status !== 'distilled' : item.status === keywordStatusFilter.value)
  const sourceMatch = keywordSourceFilter.value === 'all' || formatSources(item.sourceCodes).includes(keywordSourceFilter.value)
  const batchMatch = !keywordBatchFilter.value || item.collectionBatchNo === keywordBatchFilter.value
  return statusMatch && sourceMatch && batchMatch
}))

function formatSources(value?: string | string[]) {
  const rows = Array.isArray(value) ? value : String(value || '').split(',')
  return rows.map((item) => item.trim()).filter(Boolean).map((item) => sourceLabelMap[item] || item)
}

function extractBatchDateKey(batchNo?: string, createdAt?: string) {
  const match = String(batchNo || '').match(/(\d{8})/)
  if (match) return match[1]
  const d = createdAt ? new Date(createdAt) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function formatBatchNo(row: KeywordCollectionJob | string | undefined) {
  const batchNo = typeof row === 'string' ? row : row?.batchNo
  if (!batchNo) return '-'
  return batchDisplayMap.value.get(batchNo) || batchNo.replace(/^kw-?/, '')
}

function formatChineseTime(value?: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function keywordStatusType(status?: string) {
  if (status === 'pending') return 'warning'
  if (status === 'distilled') return 'success'
  return 'info'
}

function keywordStatusText(status?: string) {
  if (status === 'pending') return '待处理'
  if (status === 'distilled') return '已蒸馏'
  return status || '未知'
}

function priorityType(priority?: number) {
  if ((priority || 0) >= 80) return 'danger'
  if ((priority || 0) >= 50) return 'warning'
  return 'info'
}

function scoreType(score?: number) {
  if ((score || 0) >= 85) return 'success'
  if ((score || 0) >= 70) return 'warning'
  return 'info'
}

function openJobKeywords(row: KeywordCollectionJob) {
  keywordBatchFilter.value = row.batchNo
  keywordStatusFilter.value = 'all'
  keywordSourceFilter.value = 'all'
  activeTab.value = 'pool'
}

function clearBatchFilter() {
  keywordBatchFilter.value = ''
}

function openSuggestionDetail(row: PromptSuggestionRow) {
  editingSuggestion.value = row
  suggestionForm.title = row.title
  suggestionForm.contentPrompt = row.contentPrompt
  suggestionForm.score = row.score || 50
  suggestionForm.reason = row.reason || ''
  suggestionForm.status = row.status || 'candidate'
  suggestionDialogVisible.value = true
}

async function saveSuggestion() {
  if (!currentSiteId.value || !editingSuggestion.value?.id) {
    ElMessage.warning('历史数据暂无可编辑记录，请重新执行 AI 蒸馏生成内容建议')
    return
  }
  await updateKeywordContentSuggestionApi(currentSiteId.value, editingSuggestion.value.id, suggestionForm)
  ElMessage.success('内容建议已更新')
  suggestionDialogVisible.value = false
  await load()
}

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try {
    const [keywordRows, clusterRows, jobRows] = await Promise.all([
      listKeywordsApi(currentSiteId.value),
      listKeywordClustersApi(currentSiteId.value),
      listKeywordCollectionJobsApi(currentSiteId.value)
    ])
    keywords.value = keywordRows
    clusters.value = clusterRows
    collectionJobs.value = jobRows
  } finally {
    loading.value = false
  }
}

async function importKeywords() {
  if (!currentSiteId.value) return ElMessage.warning('请先选择站点')
  const rows = importText.value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
  if (!rows.length) return ElMessage.warning('请输入关键词')
  try {
    await importKeywordsApi(currentSiteId.value, rows)
    ElMessage.success(`已导入 ${rows.length} 个关键词`)
    importDialogVisible.value = false
    importText.value = ''
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  }
}

async function collectHotwords() {
  if (!currentSiteId.value) { ElMessage.warning('请先选择站点'); return }
  collecting.value = true
  try {
    const result = await collectHotwordsApi(currentSiteId.value, selectedSources.value)
    ElMessage.success(`采集完成：批次 ${result.batchNo}，候选 ${result.candidateCount} 个，入库 ${result.savedCount} 个`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '热词采集失败')
  } finally {
    collecting.value = false
  }
}

async function distill() {
  if (!currentSiteId.value) return ElMessage.warning('请先选择站点')
  distilling.value = true
  try {
    clusters.value = await distillKeywordsApi(currentSiteId.value)
    ElMessage.success('蒸馏完成')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '蒸馏失败')
  } finally {
    distilling.value = false
  }
}

async function deleteKeywordsBatch() {
  if (!currentSiteId.value) { ElMessage.warning('请先选择站点'); return }
  const ids = kwSelection.value.map((item) => item.id).filter((id): id is number => Boolean(id))
  if (!ids.length) { ElMessage.warning('请选择要删除的关键词'); return }
  await ElMessageBox.confirm(`确认删除选中的 ${ids.length} 个关键词？`, '批量删除确认', { type: 'warning' })
  const result = await deleteKeywordsBatchApi(currentSiteId.value, ids)
  ElMessage.success(`已删除 ${result.deleted} 个关键词`)
  kwSelection.value = []
  await load()
}

async function deleteClustersBatch() {
  if (!currentSiteId.value) { ElMessage.warning('请先选择站点'); return }
  const ids = clusterSelection.value.map((item) => item.id).filter((id): id is number => Boolean(id))
  if (!ids.length) { ElMessage.warning('请选择要删除的聚类'); return }
  await ElMessageBox.confirm(`确认删除选中的 ${ids.length} 个聚类？`, '批量删除确认', { type: 'warning' })
  const result = await deleteKeywordClustersBatchApi(currentSiteId.value, ids)
  ElMessage.success(`已删除 ${result.deleted} 个聚类`)
  clusterSelection.value = []
  await load()
}

async function deleteKeyword(row: Keyword) {
  if (!currentSiteId.value || !row.id) return
  await ElMessageBox.confirm(`确认删除关键词「${row.rawKeyword}」？`, '删除确认', { type: 'warning' })
  await deleteKeywordApi(currentSiteId.value, row.id)
  ElMessage.success('已删除')
  await load()
}


async function generateClusterSuggestions(clusterId: number) {
  if (!currentSiteId.value) return
  generatingClusterId.value = clusterId
  try {
    const suggestions = await generateClusterSuggestionsApi(currentSiteId.value, clusterId)
    ElMessage.success(`已生成 ${suggestions.length} 条内容建议`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成失败')
  } finally {
    generatingClusterId.value = null
  }
}

async function deleteCluster(row: DistillCluster) {
  if (!currentSiteId.value || !row.id) return
  await ElMessageBox.confirm(`确认删除聚类「${row.name}」？`, '删除确认', { type: 'warning' })
  await deleteKeywordClusterApi(currentSiteId.value, row.id)
  ElMessage.success('已删除')
  await load()
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div class="distill-page">


    <el-tabs v-model="activeTab" class="distill-tabs" type="border-card">
      <el-tab-pane name="collect">
        <template #label><span class="tab-label"><el-icon><Search /></el-icon>热词采集</span></template>
        <div class="panel-toolbar elevated">
          <div><h3>选择信源，生成候选关键词</h3><p>批次显示为「年月日-序号」，详情可直接跳转到该批次关键词。</p></div>
          <div class="toolbar-actions">
            <el-select v-model="selectedSources" multiple collapse-tags collapse-tags-tooltip class="source-select" placeholder="选择信源">
              <el-option v-for="item in sourceOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-button type="primary" :loading="collecting" @click="collectHotwords">采集行业热词</el-button>
          </div>
        </div>
        <el-table :data="collectionJobs" border class="soft-table">
          <el-table-column label="批次" min-width="170"><template #default="{ row }"><strong>{{ formatBatchNo(row) }}</strong></template></el-table-column>
          <el-table-column label="信源" min-width="240"><template #default="{ row }"><div class="tag-list"><el-tag v-for="source in formatSources(row.sourceCodes)" :key="source" round>{{ source }}</el-tag></div></template></el-table-column>
          <el-table-column prop="candidateCount" label="候选数" width="100" />
          <el-table-column prop="savedCount" label="入库/更新" width="110" />
          <el-table-column prop="status" label="状态" width="100"><template #default="{ row }"><el-tag type="success" effect="light">{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column label="时间" min-width="180"><template #default="{ row }">{{ formatChineseTime(row.createdAt) }}</template></el-table-column>
          <el-table-column label="操作" width="100"><template #default="{ row }"><el-button size="small" type="primary" plain @click="openJobKeywords(row)">详情</el-button></template></el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane name="pool">
        <template #label><span class="tab-label"><el-icon><CollectionTag /></el-icon>关键词池</span></template>
        <div class="panel-toolbar">
          <div><h3>关键词清单</h3><p>默认显示未被蒸馏关键词，可按状态、信源和批次过滤。</p></div>
          <div class="toolbar-actions keyword-filters">
            <el-segmented v-model="keywordStatusFilter" :options="[{ label: '未蒸馏', value: 'pending' }, { label: '已蒸馏', value: 'distilled' }, { label: '全部', value: 'all' }]" />
            <el-select v-model="keywordSourceFilter" class="small-select" placeholder="信源">
              <el-option label="全部信源" value="all" />
              <el-option v-for="source in keywordSourceOptions" :key="source" :label="source" :value="source" />
            </el-select>
            <el-tag v-if="keywordBatchFilter" closable type="primary" @close="clearBatchFilter">批次：{{ formatBatchNo(keywordBatchFilter) }}</el-tag>
            <el-button @click="importDialogVisible = true">导入关键词</el-button>
            <el-button type="danger" plain :disabled="!kwSelection.length" @click="deleteKeywordsBatch">批量删除</el-button>
          </div>
        </div>
        <el-table v-loading="loading" :data="filteredKeywords" border height="560" class="soft-table" @selection-change="kwSelection = $event">
          <el-table-column type="selection" width="46" />
          <el-table-column prop="rawKeyword" label="原始关键词" min-width="200"><template #default="{ row }"><strong class="keyword-name">{{ row.rawKeyword }}</strong></template></el-table-column>
          <el-table-column prop="normalizedKeyword" label="归一化" min-width="160" />
          <el-table-column label="信源" min-width="190"><template #default="{ row }"><div class="tag-list"><el-tag v-for="source in formatSources(row.sourceCodes)" :key="source" type="info" round>{{ source }}</el-tag></div></template></el-table-column>
          <el-table-column prop="sourceScore" label="来源评分" width="100" />
          <el-table-column label="批次" min-width="155"><template #default="{ row }">{{ formatBatchNo(row.collectionBatchNo) }}</template></el-table-column>
          <el-table-column label="优先级" width="100"><template #default="{ row }"><el-tag :type="priorityType(row.priority)" effect="light">{{ row.priority || 0 }}</el-tag></template></el-table-column>
          <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="keywordStatusType(row.status)">{{ keywordStatusText(row.status) }}</el-tag></template></el-table-column>
          <el-table-column label="时间" min-width="180"><template #default="{ row }">{{ formatChineseTime(row.createdAt) }}</template></el-table-column>
          <el-table-column label="操作" width="86"><template #default="{ row }"><el-button size="small" type="danger" plain @click="deleteKeyword(row)">删除</el-button></template></el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane name="cluster">
        <template #label><span class="tab-label"><el-icon><DataAnalysis /></el-icon>意图聚类</span></template>
        <div class="panel-toolbar elevated">
          <div><h3>搜索意图聚类</h3><p>每个聚类可输出最多 5 条内容建议，供内容 Prompt 列表评分和编辑。</p></div>
          <div class="toolbar-actions">
            <el-button type="primary" :loading="distilling" @click="distill"><el-icon><Connection /></el-icon>AI 蒸馏</el-button>
            <el-button type="danger" plain :disabled="!clusterSelection.length" @click="deleteClustersBatch">批量删除</el-button>
          </div>
        </div>
        <el-table v-loading="loading" :data="clusters" border height="560" class="soft-table" @selection-change="clusterSelection = $event">
          <el-table-column type="selection" width="46" />
          <el-table-column prop="name" label="聚类" min-width="170"><template #default="{ row }"><strong class="keyword-name">{{ row.name }}</strong></template></el-table-column>
          <el-table-column prop="searchIntent" label="搜索意图" min-width="220" show-overflow-tooltip />
          <el-table-column prop="suggestedCategory" label="建议栏目" min-width="140"><template #default="{ row }"><el-tag v-if="row.suggestedCategory" type="success" effect="light">{{ row.suggestedCategory }}</el-tag><span v-else class="muted">未分配</span></template></el-table-column>
          <el-table-column prop="articleDirection" label="文章方向" min-width="260" show-overflow-tooltip />
          <el-table-column label="内容建议" width="100"><template #default="{ row }"><el-tag type="primary">{{ row.contentSuggestions?.length || (row.contentPrompt ? 1 : 0) }}/5</el-tag></template></el-table-column>
          <el-table-column label="优先级" width="100"><template #default="{ row }"><el-tag :type="priorityType(row.priority)" effect="light">{{ row.priority || 0 }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="180"><template #default="{ row }">
            <el-button size="small" type="primary" plain :loading="generatingClusterId === row.id" @click="generateClusterSuggestions(row.id!)">生成Prompt</el-button>
            <el-button size="small" type="danger" plain @click="deleteCluster(row)">删除</el-button>
          </template></el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane name="prompt">
        <template #label><span class="tab-label"><el-icon><Document /></el-icon>内容 Prompt</span></template>
        <div class="prompt-list" v-loading="loading">
          <el-empty v-if="!promptSuggestions.length" description="暂无内容建议，先执行 AI 蒸馏" />
          <article v-for="row in promptSuggestions" :key="`${row.clusterId}-${row.id || row.title}`" class="prompt-card">
            <div class="prompt-card-main">
              <div class="prompt-card-head">
                <div>
                  <el-tag type="primary" effect="light"><el-icon><Aim /></el-icon>{{ row.suggestedCategory || '待分栏' }}</el-tag>
                  <h3>{{ row.title }}</h3>
                </div>
                <el-tag :type="scoreType(row.score)" round>评分 {{ row.score || 0 }}</el-tag>
              </div>
              <p class="prompt-intent">{{ row.clusterName }} · {{ row.searchIntent || '暂无搜索意图说明' }}</p>
              <div class="direction-box"><span>文章方向</span>{{ row.articleDirection || '待蒸馏生成' }}</div>
              <p v-if="row.reason" class="prompt-reason">推荐原因：{{ row.reason }}</p>
            </div>
            <div class="prompt-card-action">
              <el-button type="primary" plain @click="openSuggestionDetail(row)">详情 / 编辑</el-button>
            </div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="importDialogVisible" title="批量导入关键词" width="680px" class="import-dialog">
      <el-input v-model="importText" type="textarea" :rows="12" placeholder="每行一个关键词，也支持英文逗号分隔" />
      <template #footer><el-button @click="importDialogVisible = false">取消</el-button><el-button type="primary" @click="importKeywords">导入</el-button></template>
    </el-dialog>

    <el-dialog v-model="suggestionDialogVisible" title="内容建议详情" width="860px" class="suggestion-dialog">
      <el-form label-width="90px">
        <el-form-item label="标题"><el-input v-model="suggestionForm.title" /></el-form-item>
        <el-form-item label="评分"><el-input-number v-model="suggestionForm.score" :min="1" :max="100" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="suggestionForm.status"><el-option label="候选" value="candidate" /><el-option label="采用" value="selected" /><el-option label="搁置" value="archived" /></el-select></el-form-item>
        <el-form-item label="推荐原因"><el-input v-model="suggestionForm.reason" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="Prompt"><el-input v-model="suggestionForm.contentPrompt" type="textarea" :rows="12" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="suggestionDialogVisible = false">取消</el-button><el-button type="primary" @click="saveSuggestion">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.distill-page{display:flex;flex-direction:column;gap:18px;color:#0f172a}.hero-card{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:28px;padding:28px;border-radius:24px;background:radial-gradient(circle at 12% 18%,rgba(96,165,250,.34),transparent 28%),linear-gradient(135deg,#0f172a 0%,#1e3a8a 48%,#5b21b6 100%);box-shadow:0 24px 60px rgba(15,23,42,.18);color:#fff}.hero-card:after{content:"";position:absolute;right:-90px;top:-90px;width:260px;height:260px;border-radius:999px;background:rgba(255,255,255,.12)}.hero-copy,.hero-panel{position:relative;z-index:1}.hero-kicker{display:inline-flex;gap:6px;align-items:center;margin-bottom:14px;border:0;background:rgba(255,255,255,.18);backdrop-filter:blur(14px)}.hero-copy h2{margin:0 0 10px;font-size:34px;line-height:1.15;letter-spacing:.02em}.hero-copy p{max-width:720px;margin:0;color:#dbeafe;font-size:15px;line-height:1.8}.hero-actions{display:flex;gap:12px;margin-top:22px}.hero-panel{padding:18px;border:1px solid rgba(255,255,255,.2);border-radius:20px;background:rgba(15,23,42,.24);backdrop-filter:blur(18px)}.hero-panel-title{display:flex;gap:8px;align-items:center;margin-bottom:12px;color:#bfdbfe;font-weight:700}.funnel-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.12);color:#e2e8f0}.funnel-row strong{font-size:24px;color:#fff}.funnel-row.highlight strong{color:#86efac}.latest-job{margin:14px 0 0;color:#c4b5fd;font-size:13px}.workflow-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.workflow-card{position:relative;overflow:hidden;display:grid;grid-template-columns:48px 1fr;gap:12px;padding:18px;border:1px solid #e2e8f0;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 14px 35px rgba(15,23,42,.06)}.workflow-index{position:absolute;right:14px;top:10px;color:#e2e8f0;font-weight:900;font-size:26px}.workflow-icon{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:14px;background:#eff6ff;color:#2563eb;font-size:22px}.workflow-content h3{margin:0 0 6px;font-size:16px}.workflow-content p{margin:0;color:#64748b;font-size:13px;line-height:1.6}.workflow-metric{grid-column:1 / -1;display:flex;align-items:baseline;gap:6px;margin-top:4px}.workflow-metric strong{font-size:28px}.workflow-metric span{color:#64748b}.distill-tabs{border:0;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.08)}:deep(.distill-tabs > .el-tabs__header){background:#f8fafc;border:0;padding:12px 12px 0}:deep(.distill-tabs .el-tabs__item){height:42px;border-radius:14px 14px 0 0;font-weight:700}:deep(.distill-tabs > .el-tabs__content){padding:18px;background:#fff}.tab-label{display:inline-flex;align-items:center;gap:6px}.panel-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc}.panel-toolbar.elevated{background:linear-gradient(135deg,#f8fafc,#eef2ff)}.panel-toolbar h3{margin:0 0 4px;font-size:16px}.panel-toolbar p{margin:0;color:#64748b;font-size:13px}.toolbar-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}.keyword-filters{max-width:900px}.source-select{width:360px}.small-select{width:150px}.soft-table{border-radius:16px;overflow:hidden}:deep(.soft-table th.el-table__cell){background:#f8fafc;color:#334155;font-weight:800}:deep(.soft-table .el-table__row:hover > td.el-table__cell){background:#f8fbff}.tag-list{display:flex;flex-wrap:wrap;gap:6px}.keyword-name{color:#0f172a}.muted{color:#94a3b8}.prompt-list{display:flex;flex-direction:column;gap:14px;min-height:220px}.prompt-card{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:16px;padding:18px;border:1px solid #e2e8f0;border-radius:20px;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 14px 35px rgba(15,23,42,.06)}.prompt-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.prompt-card h3{margin:10px 0 0;font-size:18px;line-height:1.45}.prompt-intent{margin:12px 0;color:#475569;line-height:1.7}.direction-box{padding:12px 14px;border-radius:14px;background:#eef2ff;color:#1e293b;line-height:1.7}.direction-box span{display:block;margin-bottom:4px;color:#4f46e5;font-size:12px;font-weight:800}.prompt-reason{margin:10px 0 0;color:#64748b}.prompt-card-action{display:flex;align-items:center;justify-content:flex-end}.import-dialog :deep(.el-textarea__inner),.suggestion-dialog :deep(.el-textarea__inner),.suggestion-dialog :deep(.el-input__wrapper){border-radius:14px}
@media (max-width: 1280px){.workflow-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-card{grid-template-columns:1fr}.prompt-card{grid-template-columns:1fr}.prompt-card-action{justify-content:flex-start}}@media (max-width: 760px){.hero-card{padding:22px}.hero-copy h2{font-size:28px}.hero-actions,.panel-toolbar,.toolbar-actions{align-items:stretch;flex-direction:column}.source-select,.small-select{width:100%}.workflow-grid{grid-template-columns:1fr}}
</style>
