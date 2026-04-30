<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { distillKeywordsApi, importKeywordsApi, listKeywordClustersApi, listKeywordsApi } from '@/api/keywords'
import { useSiteStore } from '@/stores/site'
import type { Keyword, KeywordCluster } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const distilling = ref(false)
const importDialogVisible = ref(false)
const importText = ref('')
const keywords = ref<Keyword[]>([])
const clusters = ref<KeywordCluster[]>([])

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try {
    const [keywordRows, clusterRows] = await Promise.all([
      listKeywordsApi(currentSiteId.value),
      listKeywordClustersApi(currentSiteId.value)
    ])
    keywords.value = keywordRows
    clusters.value = clusterRows
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

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>关键词库</h2><p>导入关键词，触发 AI 蒸馏并查看聚类。</p></div>
      <div class="actions">
        <el-button @click="importDialogVisible = true">导入关键词</el-button>
        <el-button type="primary" :loading="distilling" @click="distill">AI 蒸馏</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card>
          <template #header>关键词</template>
          <el-table v-loading="loading" :data="keywords" border height="560">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="rawKeyword" label="原始关键词" />
            <el-table-column prop="normalizedKeyword" label="归一化" />
            <el-table-column prop="priority" label="优先级" width="90" />
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag v-if="row.status === 'pending'" type="warning">待处理</el-tag><el-tag v-else-if="row.status === 'distilled'" type="success">已蒸馏</el-tag><el-tag v-else-if="row.status === 'completed'" type="success">已完成</el-tag><el-tag v-else type="info">{{ row.status }}</el-tag></template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header>关键词聚类</template>
          <el-table v-loading="loading" :data="clusters" border height="560">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="searchIntent" label="意图" />
            <el-table-column prop="priority" label="优先级" width="90" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="importDialogVisible" title="批量导入关键词" width="680px">
      <el-input v-model="importText" type="textarea" :rows="12" placeholder="每行一个关键词，也支持英文逗号分隔" />
      <template #footer><el-button @click="importDialogVisible = false">取消</el-button><el-button type="primary" @click="importKeywords">导入</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:8px}
</style>
