<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'

import { formatTime } from '@/utils/format'
import { ElMessage } from 'element-plus'
import { generateVirtualInteractionsApi, listCommentsApi, reviewCommentApi } from '@/api/comments'
import { listCategoriesApi } from '@/api/categories'
import { listArticlesApi } from '@/api/articles'
import { useSiteStore } from '@/stores/site'
import type { Article, ArticleComment, Category } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const loading = ref(false)
const generating = ref(false)
const comments = ref<ArticleComment[]>([])
const categories = ref<Category[]>([])
const articles = ref<Article[]>([])
const selectedCategoryId = ref<number>()
const selectedArticleId = ref<number>()
const generator = reactive({ commentCount: 5, likeCount: 20, status: 'approved' })

const filteredArticles = computed(() => {
  if (!selectedCategoryId.value) return articles.value
  return articles.value.filter((article) => article.categoryId === selectedCategoryId.value)
})

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try {
    const [commentList, categoryList, articleList] = await Promise.all([
      listCommentsApi(currentSiteId.value),
      listCategoriesApi(currentSiteId.value),
      listArticlesApi(currentSiteId.value)
    ])
    comments.value = commentList
    categories.value = categoryList
    articles.value = articleList
  } finally { loading.value = false }
}

function onCategoryChange() {
  selectedArticleId.value = undefined
}

async function review(comment: ArticleComment, status: string) {
  if (!comment.id) return
  try {
    await reviewCommentApi(comment.id, status)
    comment.status = status
    ElMessage.success(status === 'approved' ? '已通过' : '已驳回')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作失败') }
}

async function generateVirtualInteractions() {
  if (!currentSiteId.value) { ElMessage.warning('请先选择站点'); return }
  if (!selectedArticleId.value) { ElMessage.warning('请选择文章'); return }
  generating.value = true
  try {
    const result = await generateVirtualInteractionsApi(currentSiteId.value, {
      articleId: selectedArticleId.value,
      commentCount: generator.commentCount,
      likeCount: generator.likeCount,
      status: generator.status
    })
    ElMessage.success(`已生成 ${result.comments.length} 条评论、${result.likesCreated} 个点赞`)
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '生成失败') }
  finally { generating.value = false }
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header"><div><h2>评论管理</h2><p>审核评论，并可按栏目/文章生成虚拟评论点赞。</p></div></div>

    <el-card class="generator-card" shadow="never">
      <el-form :inline="true" label-width="90px">
        <el-form-item label="栏目">
          <el-select v-model="selectedCategoryId" clearable filterable placeholder="选择栏目" style="width: 190px" @change="onCategoryChange">
            <el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="文章">
          <el-select v-model="selectedArticleId" filterable placeholder="选择文章" style="width: 320px">
            <el-option v-for="article in filteredArticles" :key="article.id" :label="article.title || article.slug" :value="article.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="评论数">
          <el-input-number v-model="generator.commentCount" :min="0" :max="50" />
        </el-form-item>
        <el-form-item label="点赞数">
          <el-input-number v-model="generator.likeCount" :min="0" :max="500" />
        </el-form-item>
        <el-form-item label="评论状态">
          <el-select v-model="generator.status" style="width: 110px">
            <el-option label="已通过" value="approved" />
            <el-option label="待审核" value="pending" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="generating" @click="generateVirtualInteractions">AI生成虚拟互动</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table v-loading="loading" :data="comments" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="articleTitle" label="文章标题" min-width="220" show-overflow-tooltip />
      <el-table-column prop="authorName" label="作者" width="120" />
      <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip />
      <el-table-column label="状态" width="110"><template #default="{ row }">
        <el-tag v-if="row.status === 'approved'" type="success">已通过</el-tag>
        <el-tag v-else-if="row.status === 'rejected'" type="danger">已驳回</el-tag>
        <el-tag v-else type="warning">待审核</el-tag>
      </template></el-table-column>
      <el-table-column label="时间" width="180"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
      <el-table-column label="操作" width="180"><template #default="{ row }">
        <el-button v-if="row.status !== 'approved'" size="small" type="success" @click="review(row, 'approved')">通过</el-button>
        <el-button v-if="row.status !== 'rejected'" size="small" type="danger" @click="review(row, 'rejected')">驳回</el-button>
      </template></el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.generator-card{margin-bottom:16px}
</style>
