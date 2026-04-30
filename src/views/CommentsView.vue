<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listCommentsApi, reviewCommentApi } from '@/api/comments'
import { useSiteStore } from '@/stores/site'
import type { ArticleComment } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const comments = ref<ArticleComment[]>([])

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { comments.value = await listCommentsApi(currentSiteId.value) }
  finally { loading.value = false }
}

async function review(comment: ArticleComment, status: string) {
  if (!comment.id) return
  try {
    await reviewCommentApi(comment.id, status)
    comment.status = status
    ElMessage.success(status === 'approved' ? '已通过' : '已驳回')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作失败') }
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header"><div><h2>评论管理</h2><p>审核和管理读者评论。</p></div></div>
    <el-table v-loading="loading" :data="comments" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="articleId" label="文章ID" width="90" />
      <el-table-column prop="authorName" label="作者" width="120" />
      <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip />
      <el-table-column label="状态" width="110"><template #default="{ row }">
        <el-tag v-if="row.status === 'approved'" type="success">已通过</el-tag>
        <el-tag v-else-if="row.status === 'rejected'" type="danger">已驳回</el-tag>
        <el-tag v-else type="warning">待审核</el-tag>
      </template></el-table-column>
      <el-table-column prop="createdAt" label="时间" width="180" />
      <el-table-column label="操作" width="180"><template #default="{ row }">
        <el-button v-if="row.status !== 'approved'" size="small" type="success" @click="review(row, 'approved')">通过</el-button>
        <el-button v-if="row.status !== 'rejected'" size="small" type="danger" @click="review(row, 'rejected')">驳回</el-button>
      </template></el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}
</style>
