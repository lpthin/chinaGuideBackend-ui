<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listArticlesApi } from '@/api/articles'
import { dryRunPublishApi, publishArticleApi } from '@/api/publishing'
import { useSiteStore } from '@/stores/site'
import type { Article, PublishResult } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const articles = ref<Article[]>([])
const result = ref<PublishResult | null>(null)
const rows = computed(() => articles.value.filter((item) => ['approved', 'published'].includes(item.status || '')))

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { articles.value = await listArticlesApi(currentSiteId.value) } finally { loading.value = false }
}

async function dryRun(article: Article) {
  if (!article.id) return
  try {
    result.value = await dryRunPublishApi(article.id)
    ElMessage.success('Dry-run 成功')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : 'Dry-run 失败') }
}

async function publish(article: Article) {
  if (!article.id) return
  await ElMessageBox.confirm(`确认正式发布 ${article.slug}？该操作会写入前端静态文件。`, '发布确认', { type: 'warning' })
  try {
    result.value = await publishArticleApi(article.id)
    ElMessage.success('发布成功')
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '发布失败') }
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header"><div><h2>发布任务</h2><p>对审核通过文章执行 dry-run 或正式发布。</p></div></div>
    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="slug" label="Slug" />
      <el-table-column prop="status" label="状态" width="140" />
      <el-table-column prop="publishedAt" label="发布时间" width="180" />
      <el-table-column label="操作" width="220"><template #default="{ row }"><el-button size="small" @click="dryRun(row)">Dry-run</el-button><el-button size="small" type="primary" :disabled="row.status !== 'approved'" @click="publish(row)">正式发布</el-button></template></el-table-column>
    </el-table>
    <el-card v-if="result" class="result-card">
      <template #header>最近发布结果</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="任务ID">{{ result.publishJobId }}</el-descriptions-item>
        <el-descriptions-item label="Dry-run">{{ result.dryRun ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="输出路径">{{ result.outputPath }}</el-descriptions-item>
        <el-descriptions-item label="影响文件">{{ result.affectedFiles.join('\n') }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style scoped>.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.result-card{margin-top:16px}</style>
