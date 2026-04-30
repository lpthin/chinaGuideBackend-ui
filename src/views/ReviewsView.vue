<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listArticlesApi } from '@/api/articles'
import { aiReviewApi, humanReviewApi, reviewPendingBeforeNineApi } from '@/api/reviews'
import { useSiteStore } from '@/stores/site'
import type { Article } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const articles = ref<Article[]>([])
const opinion = ref('内容可发布')
const onlyPending = ref(true)
const rows = computed(() => onlyPending.value ? articles.value.filter((item) => item.status === 'pending_human_review') : articles.value)

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { articles.value = await listArticlesApi(currentSiteId.value) } finally { loading.value = false }
}

async function humanReview(article: Article, approved: boolean) {
  if (!article.id) return
  try {
    await humanReviewApi(article.id, approved, opinion.value || (approved ? '通过' : '驳回'))
    ElMessage.success(approved ? '已通过' : '已驳回')
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '审核失败') }
}

async function aiReview(article: Article) {
  if (!article.id) return
  try {
    await aiReviewApi(article.id)
    ElMessage.success('AI 审核完成')
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : 'AI 审核失败') }
}

async function reviewBeforeNine() {
  if (!currentSiteId.value) return
  try {
    const result = await reviewPendingBeforeNineApi(currentSiteId.value)
    ElMessage.success(`已处理 ${result.length} 篇文章`)
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '处理失败') }
}

async function confirmReject(article: Article) {
  await ElMessageBox.confirm('确认驳回这篇文章？', '审核确认', { type: 'warning' })
  await humanReview(article, false)
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>审核中心</h2><p>人工审核或触发 AI 审核员。</p></div>
      <div class="actions"><el-switch v-model="onlyPending" active-text="只看待审" /><el-button @click="reviewBeforeNine">9点前待审处理</el-button></div>
    </div>
    <el-card class="opinion-card"><span>审核意见：</span><el-input v-model="opinion" style="width:420px" /></el-card>
    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="slug" label="Slug" />
      <el-table-column label="状态" width="130"><template #default="{ row }"><el-tag v-if="row.status === 'pending_human_review'" type="warning">待审核</el-tag><el-tag v-else-if="row.status === 'approved'" type="success">已通过</el-tag><el-tag v-else-if="row.status === 'published'" type="primary">已发布</el-tag><el-tag v-else type="info">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="260"><template #default="{ row }"><el-button size="small" type="success" @click="humanReview(row, true)">通过</el-button><el-button size="small" type="danger" @click="confirmReject(row)">驳回</el-button><el-button size="small" @click="aiReview(row)">AI审核</el-button></template></el-table-column>
    </el-table>
  </div>
</template>

<style scoped>.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:12px;align-items:center}.opinion-card{margin-bottom:16px}</style>
