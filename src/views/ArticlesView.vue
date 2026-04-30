<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { generateArticleApi, generateDailyArticlesApi, listArticlesApi, listArticleVersionsApi, updateArticleVersionApi } from '@/api/articles'
import { listKeywordClustersApi } from '@/api/keywords'
import { useSiteStore } from '@/stores/site'
import type { Article, ArticleVersion, KeywordCluster } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const generating = ref(false)
const articles = ref<Article[]>([])
const clusters = ref<KeywordCluster[]>([])
const versions = ref<ArticleVersion[]>([])
const selectedVersion = ref<ArticleVersion | null>(null)
const drawerVisible = ref(false)
const editDialogVisible = ref(false)
const saving = ref(false)
const editForm = reactive<ArticleVersion>({ title: '', summary: '', contentMd: '', seoTitle: '', seoDescription: '', keywords: '', faqJson: '', schemaJson: '', llmsSummary: '', geoCitationSummary: '' })
const generateDialogVisible = ref(false)
const keywordClusterId = ref<number>()

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try {
    const [articleRows, clusterRows] = await Promise.all([listArticlesApi(currentSiteId.value), listKeywordClustersApi(currentSiteId.value)])
    articles.value = articleRows
    clusters.value = clusterRows
  } finally { loading.value = false }
}

async function generate() {
  if (!currentSiteId.value) return ElMessage.warning('请先选择站点')
  if (!keywordClusterId.value) return ElMessage.warning('请选择关键词聚类')
  generating.value = true
  try {
    await generateArticleApi(currentSiteId.value, keywordClusterId.value)
    ElMessage.success('文章草稿已生成')
    generateDialogVisible.value = false
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '生成失败') }
  finally { generating.value = false }
}

async function generateDaily() {
  if (!currentSiteId.value) return ElMessage.warning('请先选择站点')
  generating.value = true
  try {
    const rows = await generateDailyArticlesApi(currentSiteId.value)
    ElMessage.success(`已生成 ${rows.length} 篇文章`)
    await load()
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '生成失败') }
  finally { generating.value = false }
}

function openEdit(version: ArticleVersion) {
  Object.assign(editForm, { ...version })
  editDialogVisible.value = true
}

async function saveVersion() {
  if (!editForm.id) return
  saving.value = true
  try {
    const saved = await updateArticleVersionApi(editForm.id, editForm)
    ElMessage.success('文章版本已保存')
    selectedVersion.value = saved
    versions.value = versions.value.map((item) => item.id === saved.id ? saved : item)
    editDialogVisible.value = false
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '保存失败') }
  finally { saving.value = false }
}

function previewVersion(version: ArticleVersion) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${version.seoTitle || version.title}</title><meta name="description" content="${version.seoDescription || ''}"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;margin:40px auto;line-height:1.8;color:#0f172a;padding:0 20px}pre{white-space:pre-wrap;background:#f8fafc;padding:16px;border-radius:8px}h1{line-height:1.3}</style></head><body><h1>${version.title}</h1><p>${version.summary || ''}</p><pre>${version.contentMd || ''}</pre></body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  window.open(URL.createObjectURL(blob), '_blank')
}

async function openVersions(article: Article) {
  if (!article.id) return
  versions.value = await listArticleVersionsApi(article.id)
  selectedVersion.value = versions.value[0] || null
  drawerVisible.value = true
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>内容草稿</h2><p>根据关键词聚类生成文章，查看中文版本和 GEO 字段。</p></div>
      <div class="actions"><el-button @click="generateDialogVisible = true">按聚类生成</el-button><el-button type="primary" :loading="generating" @click="generateDaily">每日生成</el-button></div>
    </div>
    <el-table v-loading="loading" :data="articles" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="slug" label="Slug" />
      <el-table-column prop="articleType" label="类型" width="120" />
      <el-table-column prop="sourceLocale" label="源语言" width="110" />
      <el-table-column prop="status" label="状态" width="160" />
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="160"><template #default="{ row }"><el-button size="small" @click="openVersions(row)">查看版本</el-button></template></el-table-column>
    </el-table>

    <el-dialog v-model="generateDialogVisible" title="生成文章草稿" width="520px">
      <el-form label-width="120px"><el-form-item label="关键词聚类"><el-select v-model="keywordClusterId" filterable placeholder="选择聚类" style="width: 320px"><el-option v-for="cluster in clusters" :key="cluster.id" :label="`${cluster.id} - ${cluster.name}`" :value="cluster.id" /></el-select></el-form-item></el-form>
      <template #footer><el-button @click="generateDialogVisible = false">取消</el-button><el-button type="primary" :loading="generating" @click="generate">生成</el-button></template>
    </el-dialog>

    <el-drawer v-model="drawerVisible" title="文章版本详情" size="60%">
      <el-select v-model="selectedVersion" value-key="id" placeholder="选择版本" class="version-select"><el-option v-for="version in versions" :key="version.id" :label="`${version.locale || 'zh-CN'} - ${version.title}`" :value="version" /></el-select>
      <template v-if="selectedVersion">
        <div class="version-actions"><el-button type="primary" @click="openEdit(selectedVersion)">编辑版本</el-button><el-button @click="previewVersion(selectedVersion)">预览</el-button></div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="标题">{{ selectedVersion.title }}</el-descriptions-item>
          <el-descriptions-item label="摘要">{{ selectedVersion.summary }}</el-descriptions-item>
          <el-descriptions-item label="SEO Title">{{ selectedVersion.seoTitle }}</el-descriptions-item>
          <el-descriptions-item label="SEO Description">{{ selectedVersion.seoDescription }}</el-descriptions-item>
          <el-descriptions-item label="关键词">{{ selectedVersion.keywords }}</el-descriptions-item>
          <el-descriptions-item label="llms 摘要">{{ selectedVersion.llmsSummary }}</el-descriptions-item>
          <el-descriptions-item label="GEO 引用摘要">{{ selectedVersion.geoCitationSummary }}</el-descriptions-item>
        </el-descriptions>
        <h3>正文 Markdown</h3><pre class="content-box">{{ selectedVersion.contentMd }}</pre>
        <h3>FAQ JSON</h3><pre class="content-box">{{ selectedVersion.faqJson }}</pre>
        <h3>Schema JSON</h3><pre class="content-box">{{ selectedVersion.schemaJson }}</pre>
      </template>
    </el-drawer>

    <el-dialog v-model="editDialogVisible" title="编辑文章版本" width="900px">
      <el-form label-width="110px">
        <el-form-item label="标题"><el-input v-model="editForm.title" /></el-form-item>
        <el-form-item label="摘要"><el-input v-model="editForm.summary" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="正文 Markdown"><el-input v-model="editForm.contentMd" type="textarea" :rows="10" /></el-form-item>
        <el-form-item label="SEO Title"><el-input v-model="editForm.seoTitle" /></el-form-item>
        <el-form-item label="SEO描述"><el-input v-model="editForm.seoDescription" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="关键词"><el-input v-model="editForm.keywords" /></el-form-item>
        <el-form-item label="LLMS摘要"><el-input v-model="editForm.llmsSummary" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="GEO引用"><el-input v-model="editForm.geoCitationSummary" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="FAQ JSON"><el-input v-model="editForm.faqJson" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="Schema JSON"><el-input v-model="editForm.schemaJson" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="editDialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveVersion">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.actions{display:flex;gap:8px}.version-select{width:100%;margin-bottom:16px}.content-box{white-space:pre-wrap;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;line-height:1.6;max-height:260px;overflow:auto}.version-actions{display:flex;gap:8px;margin-bottom:16px}
</style>
