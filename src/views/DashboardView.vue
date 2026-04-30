<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { getDashboardStatsApi } from '@/api/dashboard'
import { useSiteStore } from '@/stores/site'
import type { DashboardStats } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const stats = ref<DashboardStats>({ keywords: 0, clusters: 0, articles: 0, pendingReviews: 0, approvedArticles: 0, pageViews: 0, todayPageViews: 0 })

async function loadStats() {
  if (!currentSiteId.value) return
  loading.value = true
  try {
    stats.value = await getDashboardStatsApi(currentSiteId.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载统计失败')
  } finally {
    loading.value = false
  }
}

watchEffect(() => { if (currentSiteId.value) loadStats() })
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h2>仪表盘</h2>
        <p>China Guide 内容生产闭环概览</p>
      </div>
      <el-button :loading="loading" @click="loadStats">刷新</el-button>
    </div>
    <el-row :gutter="16" class="metrics">
      <el-col :span="4"><el-card><div class="metric"><span>关键词</span><b>{{ stats.keywords }}</b></div></el-card></el-col>
      <el-col :span="4"><el-card><div class="metric"><span>聚类</span><b>{{ stats.clusters }}</b></div></el-card></el-col>
      <el-col :span="4"><el-card><div class="metric"><span>文章</span><b>{{ stats.articles }}</b></div></el-card></el-col>
      <el-col :span="4"><el-card><div class="metric"><span>待审核</span><b>{{ stats.pendingReviews }}</b></div></el-card></el-col>
      <el-col :span="4"><el-card><div class="metric"><span>可发布</span><b>{{ stats.approvedArticles }}</b></div></el-card></el-col>
      <el-col :span="4"><el-card><div class="metric"><span>今日浏览</span><b>{{ stats.todayPageViews }}</b></div></el-card></el-col>
    </el-row>
    <el-card class="flow-card">
      <template #header>Phase 1 内容流程</template>
      <el-steps :active="2" finish-status="success">
        <el-step title="导入关键词" description="录入旅游主题关键词" />
        <el-step title="AI 蒸馏" description="生成关键词聚类" />
        <el-step title="生成草稿" description="创建中文文章" />
        <el-step title="审核发布" description="人工审核后 dry-run / 发布" />
      </el-steps>
    </el-card>
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { margin: 0 0 6px; }
.page-header p { margin: 0; color: #64748b; }
.metrics { margin-bottom: 16px; }
.metric { display: flex; justify-content: space-between; align-items: baseline; }
.metric span { color: #64748b; }
.metric b { font-size: 28px; color: #1d4ed8; }
.flow-card { margin-top: 16px; }
</style>
