<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'

import { formatTime } from '@/utils/format'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Check, Edit } from '@element-plus/icons-vue'
import { generateArticleApi, generateDailyArticlesApi, listArticlesApi, listArticleVersionsApi, updateArticleVersionApi, rollbackArticleVersionApi } from '@/api/articles'
import { listMediaApi } from '@/api/media'
import { listKeywordClustersApi } from '@/api/keywords'
import { useSiteStore } from '@/stores/site'
import type { Article, ArticleVersion, KeywordCluster } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const loading = ref(false)
const generating = ref(false)
const articles = ref<Article[]>([])
const clusters = ref<KeywordCluster[]>([])
const versions = ref<ArticleVersion[]>([])
const selectedVersion = ref<ArticleVersion | null>(null)
const drawerVisible = ref(false)
const editDialogVisible = ref(false)
const saving = ref(false)
const rollingBack = ref(false)

async function handleDrawerClose(done: () => void) {
  try {
    await ElMessageBox.confirm('确定要关闭版本详情吗？', '确认关闭', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' })
    done()
  } catch {
    // 用户取消
  }
}
const editForm = reactive<ArticleVersion>({ title: '', summary: '', contentMd: '', seoTitle: '', seoDescription: '', keywords: '', faqJson: '', schemaJson: '', llmsSummary: '', geoCitationSummary: '', featuredMediaId: undefined })
const mediaList = ref<any[]>([])
const mediaDialogVisible = ref(false)
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


async function rollbackVersion(version: ArticleVersion) {
  if (!version.id) return
  rollingBack.value = true
  try {
    const saved = await rollbackArticleVersionApi(version.id)
    ElMessage.success('已回滚为新版本')
    versions.value = [saved, ...versions.value]
    selectedVersion.value = saved
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '回滚失败') }
  finally { rollingBack.value = false }
}

function previewVersion(version: ArticleVersion) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${version.seoTitle || version.title}</title><meta name="description" content="${version.seoDescription || ''}"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;margin:40px auto;line-height:1.8;color:#0f172a;padding:0 20px}pre{white-space:pre-wrap;background:#f8fafc;padding:16px;border-radius:8px}h1{line-height:1.3}</style></head><body><h1>${version.title}</h1><p>${version.summary || ''}</p><pre>${version.contentMd || ''}</pre></body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  window.open(URL.createObjectURL(blob), '_blank')
}


async function openMediaPicker() {
  if (!currentSiteId.value) return
  mediaList.value = await listMediaApi(currentSiteId.value)
  mediaDialogVisible.value = true
}

function selectMedia(media: any) {
  editForm.featuredMediaId = media.id
  mediaDialogVisible.value = false
}

function clearFeaturedMedia() {
  editForm.featuredMediaId = undefined
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
  <div class="articles-page">
    <div class="page-header-wrapper">
      <div class="page-header-left">
        <div class="header-icon">
          <Document class="icon" />
        </div>
        <div>
          <h2 class="page-title">内容草稿</h2>
          <p class="page-subtitle">根据关键词聚类生成文章，查看中文版本和 GEO 字段</p>
        </div>
      </div>
      <div class="page-header-right">
        <div class="stats-card">
          <span class="stats-value">{{ articles.length }}</span>
          <span class="stats-label">总文章数</span>
        </div>
        <div class="actions">
          <el-button 
            size="small" 
            class="action-btn secondary"
            @click="generateDialogVisible = true"
          >
            <Edit class="btn-icon" />
            按聚类生成
          </el-button>
          <el-button 
            type="primary" 
            size="small" 
            class="action-btn primary"
            :loading="generating" 
            @click="generateDaily"
          >
            <Check class="btn-icon" />
            每日生成
          </el-button>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        <span class="table-title">文章列表</span>
      </div>
      <el-table 
        v-loading="loading" 
        :data="articles" 
        class="article-table"
      >
        <el-table-column prop="id" label="ID" width="80">
          <template #default="{ row }">
            <span class="id-badge">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="slug" label="Slug" min-width="180" show-overflow-tooltip />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <span class="type-badge">{{ row.articleType === 'guide' ? '指南' : row.articleType }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sourceLocale" label="源语言" width="110">
          <template #default="{ row }">
            <span class="locale-badge">{{ row.sourceLocale }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <span :class="['status-badge', `status-${row.status}`]">
              {{ row.status === 'pending_human_review' ? '待审核' : row.status === 'approved' ? '已通过' : row.status === 'published' ? '已发布' : row.status === 'draft' ? '草稿' : row.status }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button 
              size="small" 
              class="action-btn"
              @click="openVersions(row)"
            >
              <Edit class="btn-icon" />
              <span>查看版本</span>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="articles.length === 0 && !loading" class="empty-state">
        <div class="empty-icon">
          <Document class="icon" />
        </div>
        <p class="empty-text">暂无文章数据</p>
        <el-button type="primary" @click="generateDaily">生成第一篇文章</el-button>
      </div>
    </div>

    <el-dialog 
      v-model="generateDialogVisible" 
      title="生成文章草稿" 
      width="520px"
      class="generate-dialog"
    >
      <div class="dialog-content">
        <p class="dialog-desc">选择一个关键词聚类来生成文章草稿</p>
        <el-form label-width="120px" class="form">
          <el-form-item label="关键词聚类">
            <el-select 
              v-model="keywordClusterId" 
              filterable 
              placeholder="选择聚类" 
              style="width: 100%"
              class="cluster-select"
            >
              <el-option 
                v-for="cluster in clusters" 
                :key="cluster.id" 
                :label="`${cluster.name}`" 
                :value="cluster.id" 
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="generateDialogVisible = false" class="cancel-btn">取消</el-button>
          <el-button type="primary" :loading="generating" @click="generate" class="save-btn">生成</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer 
      v-model="drawerVisible" 
      title="文章版本详情" 
      size="70%"
      class="versions-drawer"
      :close-on-click-modal="false"
      @before-close="handleDrawerClose"
    >
      <div class="drawer-content">
        <el-select 
          v-model="selectedVersion" 
          value-key="id" 
          placeholder="选择版本" 
          class="version-select"
        >
          <el-option 
            v-for="version in versions" 
            :key="version.id" 
            :label="`${version.locale || 'zh-CN'} - ${version.title}`" 
            :value="version" 
          />
        </el-select>

        <template v-if="selectedVersion">
          <div class="version-actions">
            <el-button type="primary" @click="openEdit(selectedVersion)" class="action-btn primary">
              <Edit class="btn-icon" />
              编辑版本
            </el-button>
            <el-button @click="previewVersion(selectedVersion)" class="action-btn secondary">
              <Document class="btn-icon" />
              预览
            </el-button>
            <el-button 
              type="warning" 
              :loading="rollingBack" 
              @click="rollbackVersion(selectedVersion)"
              class="action-btn warning"
            >
              <Check class="btn-icon" />
              回滚为新版本
            </el-button>
          </div>

          <div class="version-details">
            <div class="detail-section">
              <h3 class="section-title">基本信息</h3>
              <el-descriptions :column="2" class="descriptions">
                <el-descriptions-item label="标题">
                  <span class="description-value">{{ selectedVersion.title }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="摘要">
                  <span class="description-value">{{ selectedVersion.summary }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="SEO Title">
                  <span class="description-value">{{ selectedVersion.seoTitle }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="SEO Description">
                  <span class="description-value">{{ selectedVersion.seoDescription }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="关键词">
                  <span class="description-value">{{ selectedVersion.keywords }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="LLMS 摘要">
                  <span class="description-value">{{ selectedVersion.llmsSummary }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="GEO 引用摘要">
                  <span class="description-value">{{ selectedVersion.geoCitationSummary }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <div class="detail-section">
              <h3 class="section-title">正文 Markdown</h3>
              <pre class="content-box">{{ selectedVersion.contentMd }}</pre>
            </div>

            <div class="detail-section">
              <h3 class="section-title">FAQ JSON</h3>
              <pre class="content-box">{{ selectedVersion.faqJson }}</pre>
            </div>

            <div class="detail-section">
              <h3 class="section-title">Schema JSON</h3>
              <pre class="content-box">{{ selectedVersion.schemaJson }}</pre>
            </div>
          </div>
        </template>

        <div v-else class="empty-version">
          <p>暂无版本数据</p>
        </div>
      </div>
    </el-drawer>

    <el-dialog 
      v-model="editDialogVisible" 
      title="编辑文章版本" 
      width="900px"
      class="edit-dialog"
    >
      <div class="dialog-content">
        <el-form label-width="110px" class="edit-form">
          <el-form-item label="标题">
            <el-input v-model="editForm.title" class="form-input" />
          </el-form-item>
          <el-form-item label="摘要">
            <el-input v-model="editForm.summary" type="textarea" :rows="2" class="form-textarea" />
          </el-form-item>
          <el-form-item label="正文 Markdown">
            <el-input v-model="editForm.contentMd" type="textarea" :rows="6" class="form-textarea-lg" />
          </el-form-item>
          <el-form-item label="SEO Title">
            <el-input v-model="editForm.seoTitle" class="form-input" />
          </el-form-item>
          <el-form-item label="SEO描述">
            <el-input v-model="editForm.seoDescription" type="textarea" :rows="2" class="form-textarea" />
          </el-form-item>
          <el-form-item label="关键词">
            <el-input v-model="editForm.keywords" class="form-input" />
          </el-form-item>
          <el-form-item label="LLMS摘要">
            <el-input v-model="editForm.llmsSummary" type="textarea" :rows="2" class="form-textarea" />
          </el-form-item>
          <el-form-item label="GEO引用">
            <el-input v-model="editForm.geoCitationSummary" type="textarea" :rows="2" class="form-textarea" />
          </el-form-item>
          <el-form-item label="特色图片">
            <div class="media-picker">
              <div v-if="editForm.featuredMediaId" class="selected-media">
                <span>已选媒体 ID: {{ editForm.featuredMediaId }}</span>
                <el-button size="small" type="danger" @click="clearFeaturedMedia" class="clear-btn">
                  <Check class="btn-icon" />
                </el-button>
              </div>
              <el-button size="small" @click="openMediaPicker" class="pick-btn">
                <Document class="btn-icon" />
                选择图片
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="FAQ JSON">
            <el-input v-model="editForm.faqJson" type="textarea" :rows="3" class="form-textarea" />
          </el-form-item>
          <el-form-item label="Schema JSON">
            <el-input v-model="editForm.schemaJson" type="textarea" :rows="3" class="form-textarea" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editDialogVisible = false" class="cancel-btn">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveVersion" class="save-btn">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog 
      v-model="mediaDialogVisible" 
      title="选择媒体文件" 
      width="720px"
      class="media-dialog"
    >
      <el-table :data="mediaList" @row-click="selectMedia" class="media-table">
        <el-table-column label="预览" width="80">
          <template #default="{ row }">
            <el-image 
              v-if="row.mimeType?.startsWith('image/')" 
              :src="`/uploads/${currentSiteId}/${row.fileName}`" 
              fit="cover" 
              class="media-preview"
            />
            <div v-else class="media-icon">
              <Document class="icon" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="originalName" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="mimeType" label="类型" width="120" />
        <el-table-column label="选择" width="80">
          <template #default="{ row }">
            <Check class="check-icon" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.articles-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(249, 115, 22, 0.3);
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon .icon {
  font-size: 28px;
  color: #ffffff;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 6px;
}

.page-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.page-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stats-card {
  background: rgba(255, 255, 255, 0.2);
  padding: 12px 24px;
  border-radius: 12px;
  text-align: center;
}

.stats-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
}

.stats-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.action-btn.primary {
  background: #ffffff;
  color: #f97316;
}

.action-btn.primary:hover {
  background: #fef3c7;
}

.btn-icon {
  font-size: 14px;
}

.table-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.table-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  background: #f8fafc;
}

.table-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.article-table {
  width: 100%;
}

.article-table::deep .el-table__header {
  background: #f8fafc;
}

.article-table::deep .el-table__header th {
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  padding: 16px 12px;
  border-bottom: 2px solid #e2e8f0;
}

.article-table::deep .el-table__body tr:hover {
  background: #f8fafc;
}

.article-table::deep .el-table__body td {
  padding: 16px 12px;
  color: #334155;
}

.id-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.locale-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending_human_review {
  background: rgba(234, 179, 8, 0.1);
  color: #eab308;
}

.status-approved {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-published {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-draft {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.empty-icon .icon {
  font-size: 40px;
  color: #94a3b8;
}

.empty-text {
  font-size: 14px;
  color: #94a3b8;
  margin: 0 0 16px;
}

.generate-dialog::deep .el-dialog__header {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  padding: 20px 24px;
}

.generate-dialog::deep .el-dialog__title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.generate-dialog::deep .el-dialog__body {
  padding: 24px;
}

.dialog-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.dialog-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 20px;
}

.form {
  max-width: 400px;
}

.cluster-select {
  border-radius: 10px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 500;
}

.save-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 500;
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border: none;
}

.save-btn:hover {
  background: linear-gradient(135deg, #337ecc 0%, #409eff 100%);
}

.versions-drawer::deep .el-drawer__header {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  padding: 20px 24px;
}

.versions-drawer::deep .el-drawer__title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.drawer-content {
  padding: 20px;
}

.version-select {
  width: 100%;
  margin-bottom: 20px;
  border-radius: 10px;
}

.version-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.version-actions .action-btn {
  padding: 10px 16px;
}

.version-actions .action-btn.warning {
  background: rgba(234, 179, 8, 0.1);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.version-actions .action-btn.warning:hover {
  background: rgba(234, 179, 8, 0.2);
}

.version-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  background: #f8fafc;
  padding: 16px 20px;
  border-radius: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 12px;
}

.descriptions {
  border-radius: 8px;
}

.descriptions::deep .el-descriptions-item__label {
  background: rgba(0, 0, 0, 0.02);
  color: #64748b;
  font-weight: 500;
}

.description-value {
  color: #1a1a2e;
}

.content-box {
  white-space: pre-wrap;
  background: #0f172a;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 10px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
  font-size: 13px;
}

.empty-version {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
}

.edit-dialog::deep .el-dialog__header {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  padding: 20px 24px;
}

.edit-dialog::deep .el-dialog__title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.edit-form {
  max-width: 100%;
}

.form-input {
  border-radius: 10px;
}

.form-textarea {
  border-radius: 10px;
}

.form-textarea-lg {
  border-radius: 10px;
  max-height: 200px;
}

.media-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.selected-media {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 8px;
  font-size: 13px;
  color: #334155;
}

.clear-btn {
  padding: 4px 8px;
}

.pick-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.media-dialog::deep .el-dialog__header {
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  padding: 20px 24px;
}

.media-dialog::deep .el-dialog__title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.media-table {
  width: 100%;
}

.media-table::deep .el-table__header th {
  color: #64748b;
  font-weight: 600;
}

.media-table::deep .el-table__body tr:hover {
  background: #f8fafc;
  cursor: pointer;
}

.media-preview {
  width: 48px;
  height: 48px;
  border-radius: 8px;
}

.media-icon {
  width: 48px;
  height: 48px;
  background: #f1f5f9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-icon .icon {
  font-size: 24px;
  color: #94a3b8;
}

.check-icon {
  font-size: 20px;
  color: #10b981;
  opacity: 0.5;
}

.media-table::deep .el-table__body tr:hover .check-icon {
  opacity: 1;
}

@media (max-width: 768px) {
  .page-header-wrapper {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .page-header-left {
    flex-direction: column;
  }
  
  .page-header-right {
    flex-direction: column;
  }
}
</style>
