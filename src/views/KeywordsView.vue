<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { collectHotwordsApi, deleteKeywordApi, deleteKeywordClusterApi, deleteKeywordsBatchApi, deleteKeywordClustersBatchApi, distillKeywordsApi, importKeywordsApi, listKeywordClustersApi, listKeywordCollectionJobsApi, listKeywordsApi } from '@/api/keywords'
import { useSiteStore } from '@/stores/site'
import type { Keyword, KeywordCluster, KeywordCollectionJob } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const loading = ref(false)
const kwSelection = ref<Keyword[]>([])
const clusterSelection = ref<KeywordCluster[]>([])
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
const importDialogVisible = ref(false)
const importText = ref('')
const keywords = ref<Keyword[]>([])
const clusters = ref<KeywordCluster[]>([])
const collectionJobs = ref<KeywordCollectionJob[]>([])

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

async function deleteCluster(row: KeywordCluster) {
  if (!currentSiteId.value || !row.id) return
  await ElMessageBox.confirm(`确认删除聚类「${row.name}」？`, '删除确认', { type: 'warning' })
  await deleteKeywordClusterApi(currentSiteId.value, row.id)
  ElMessage.success('已删除')
  await load()
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>关键词库</h2><p>从站点画像采集行业热词，导入关键词，触发 AI 蒸馏并查看聚类。</p></div>
      <div class="actions">
        <el-select v-model="selectedSources" multiple collapse-tags collapse-tags-tooltip style="width: 280px" placeholder="选择信源">
          <el-option v-for="item in sourceOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button :loading="collecting" @click="collectHotwords">采集行业热词</el-button>
        <el-button @click="importDialogVisible = true">导入关键词</el-button>
        <el-button type="primary" :loading="distilling" @click="distill">AI 蒸馏</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card>
          <template #header>关键词 <el-button size="small" type="danger" plain :disabled="!kwSelection.length" @click="deleteKeywordsBatch">批量删除</el-button></template>
          <el-table v-loading="loading" :data="keywords" border height="560" @selection-change="kwSelection = $event">
            <el-table-column type="selection" width="40" />
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="rawKeyword" label="原始关键词" />
            <el-table-column prop="normalizedKeyword" label="归一化" />
            <el-table-column prop="sourceCodes" label="信源" min-width="150" show-overflow-tooltip />
            <el-table-column prop="sourceScore" label="来源评分" width="100" />
            <el-table-column prop="collectionBatchNo" label="批次" min-width="145" show-overflow-tooltip />
            <el-table-column prop="priority" label="优先级" width="90" />
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag v-if="row.status === 'pending'" type="warning">待处理</el-tag><el-tag v-else-if="row.status === 'distilled'" type="success">已蒸馏</el-tag><el-tag v-else-if="row.status === 'completed'" type="success">已完成</el-tag><el-tag v-else type="info">{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column label="操作" width="80"><template #default="{ row }"><el-button size="small" type="danger" @click="deleteKeyword(row)">删除</el-button></template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header>关键词聚类 <el-button size="small" type="danger" plain :disabled="!clusterSelection.length" @click="deleteClustersBatch">批量删除</el-button></template>
          <el-table v-loading="loading" :data="clusters" border height="560" @selection-change="clusterSelection = $event">
            <el-table-column type="selection" width="40" />
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="searchIntent" label="意图" />
            <el-table-column prop="priority" label="优先级" width="90" />
            <el-table-column label="操作" width="80"><template #default="{ row }"><el-button size="small" type="danger" @click="deleteCluster(row)">删除</el-button></template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="jobs-card">
      <template #header>热词采集记录</template>
      <el-table :data="collectionJobs" border>
        <el-table-column prop="batchNo" label="批次" min-width="160" />
        <el-table-column prop="sourceCodes" label="信源" min-width="180" show-overflow-tooltip />
        <el-table-column prop="candidateCount" label="候选数" width="90" />
        <el-table-column prop="savedCount" label="入库/更新" width="100" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column prop="createdAt" label="时间" min-width="160" />
      </el-table>
    </el-card>

    <el-dialog v-model="importDialogVisible" title="批量导入关键词" width="680px">
      <el-input v-model="importText" type="textarea" :rows="12" placeholder="每行一个关键词，也支持英文逗号分隔" />
      <template #footer><el-button @click="importDialogVisible = false">取消</el-button><el-button type="primary" @click="importKeywords">导入</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:8px}.jobs-card{margin-top:16px}
</style>
