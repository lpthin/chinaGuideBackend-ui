<template>
  <div class="knowledge-card-edit-page">
    <a-spin :spinning="loading">
      <a-page-header
        :title="isEdit ? '编辑知识卡片' : '新建知识卡片'"
        @back="goBack"
      >
        <template #extra>
          <a-space>
            <a-button @click="goBack">取消</a-button>
            <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
          </a-space>
        </template>
      </a-page-header>

      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="18">
          <a-card :bordered="false">
            <a-form layout="vertical" :model="formData">
              <a-form-item label="卡片标题" required>
                <a-input
                  v-model:value="formData.title"
                  placeholder="请输入卡片标题"
                  size="large"
                />
              </a-form-item>

              <a-form-item label="摘要">
                <a-textarea
                  v-model:value="formData.summary"
                  placeholder="请输入卡片摘要（可选）"
                  :rows="3"
                  show-count
                  :maxlength="500"
                />
              </a-form-item>

              <a-form-item label="内容">
                <div class="editor-wrapper">
                  <textarea
                    v-model="formData.content"
                    class="rich-editor"
                    placeholder="请输入卡片内容（支持 HTML）"
                    rows="20"
                  ></textarea>
                </div>
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>

        <a-col :span="6">
          <a-card title="发布设置" :bordered="false">
            <a-form layout="vertical" :model="formData">
              <a-form-item label="分类" required>
                <a-select
                  v-model:value="formData.categoryId"
                  placeholder="选择分类"
                  style="width: 100%"
                >
                  <a-select-option
                    v-for="cat in categories"
                    :key="cat.id"
                    :value="cat.id"
                  >
                    {{ cat.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="关联文档">
                <a-select
                  v-model:value="formData.documentId"
                  placeholder="搜索并选择关联文档（可选）"
                  style="width: 100%"
                  show-search
                  allow-clear
                  :filter-option="false"
                  @search="handleDocumentSearch"
                  :not-found-content="docSearching ? undefined : '无匹配文档'"
                >
                  <a-select-option
                    v-for="doc in documentOptions"
                    :key="doc.id"
                    :value="doc.id"
                  >
                    {{ doc.title }}
                  </a-select-option>
                </a-select>
                <div v-if="selectedDocument" class="selected-doc-info">
                  <FileTextOutlined style="margin-right: 4px; color: #1890ff" />
                  <span>已关联: {{ selectedDocument.title }}</span>
                </div>
              </a-form-item>

              <a-form-item label="标签">
                <a-select
                  v-model:value="selectedTags"
                  mode="tags"
                  placeholder="输入标签，回车添加"
                  style="width: 100%"
                  @change="handleTagsChange"
                >
                  <a-select-option v-for="tag in tags" :key="tag.name" :value="tag.name">
                    {{ tag.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>

              <a-form-item label="封面图片">
                <a-upload
                  v-model:file-list="fileList"
                  :before-upload="beforeUpload"
                  list-type="picture-card"
                  :max-count="1"
                  accept="image/*"
                >
                  <div>
                    <PlusOutlined />
                    <div style="margin-top: 8px">上传</div>
                  </div>
                </a-upload>
              </a-form-item>

              <a-form-item label="排序">
                <a-input-number
                  v-model:value="formData.sort"
                  :min="0"
                  style="width: 100%"
                />
              </a-form-item>

              <a-form-item label="状态">
                <a-radio-group v-model:value="formData.status">
                  <a-radio value="active">启用</a-radio>
                  <a-radio value="disabled">停用</a-radio>
                </a-radio-group>
              </a-form-item>
            </a-form>

            <a-divider />

            <a-space direction="vertical" style="width: 100%">
              <a-button type="primary" block :loading="saving" @click="handleSave">
                <SaveOutlined /> 保存
              </a-button>
              <a-button block @click="handlePreview">
                <EyeOutlined /> 预览
              </a-button>
            </a-space>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-modal
      v-model:open="previewVisible"
      title="预览"
      width="1000px"
      :footer="null"
    >
      <div class="preview-content">
        <h1>{{ formData.title }}</h1>
        <div class="preview-meta">
          <a-tag color="blue">{{ getCategoryName(formData.categoryId) }}</a-tag>
          <a-tag v-for="tag in selectedTags" :key="tag" size="small">
            {{ tag }}
          </a-tag>
        </div>
        <div class="preview-body" v-html="formData.content"></div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  SaveOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue'
import { knowledgeCardApi, knowledgeCategoryApi, knowledgeTagApi, knowledgeDocumentApi } from '../../api/knowledge'
import type { KnowledgeCategory, KnowledgeCardForm, KnowledgeTag, KnowledgeDocument } from '../../types/knowledge'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const getTenantId = () => authStore.selectedTenantId || authStore.tenantId || 1

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const previewVisible = ref(false)
const categories = ref<KnowledgeCategory[]>([])
const tags = ref<KnowledgeTag[]>([])
const fileList = ref<any[]>([])
const selectedTags = ref<string[]>([])
const documentOptions = ref<KnowledgeDocument[]>([])
const docSearching = ref(false)
const docSearchTimer = ref<any>(null)

const isEdit = computed(() => !!route.params.id)
const cardId = computed(() => Number(route.params.id))

const formData = reactive<KnowledgeCardForm>({
  tenantId: getTenantId(),
  categoryId: null as any,
  title: '',
  summary: '',
  content: '',
  coverImage: '',
  tags: '',
  documentId: null,
  sort: 0,
  status: 'active',
})

const selectedDocument = computed(() => {
  if (!formData.documentId) return null
  return documentOptions.value.find(d => d.id === formData.documentId) || null
})

function handleTagsChange(value: string[]) {
  formData.tags = value.join(',')
}

async function handleDocumentSearch(keyword: string) {
  if (docSearchTimer.value) {
    clearTimeout(docSearchTimer.value)
  }
  if (!keyword || keyword.trim() === '') {
    documentOptions.value = []
    return
  }
  docSearchTimer.value = setTimeout(async () => {
    docSearching.value = true
    try {
      const result = await knowledgeDocumentApi.list({
        tenantId: getTenantId(),
        keyword: keyword.trim(),
        page: 1,
        size: 20,
      } as any)
      documentOptions.value = result.records || []
    } catch (error) {
      console.error('搜索文档失败:', error)
      documentOptions.value = []
    } finally {
      docSearching.value = false
    }
  }, 300)
}

function getCategoryName(categoryId: number): string {
  const category = categories.value.find(c => c.id === categoryId)
  return category?.name || '-'
}

function goBack() {
  router.back()
}

function beforeUpload(file: any) {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('只能上传图片文件')
    return false
  }
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB')
    return false
  }
  return false
}

function handlePreview() {
  previewVisible.value = true
}

async function handleSave() {
  if (!formData.title) {
    message.error('请输入卡片标题')
    return
  }
  if (!formData.categoryId) {
    message.error('请选择分类')
    return
  }

  saving.value = true
  try {
    if (isEdit.value) {
      await knowledgeCardApi.update(cardId.value, formData)
      message.success('更新成功')
    } else {
      await knowledgeCardApi.create(formData)
      message.success('创建成功')
    }
    router.push('/knowledge/cards')
  } catch (error) {
    message.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function loadCategories() {
  try {
    const result = await knowledgeCategoryApi.all(getTenantId())
    categories.value = result
  } catch (error) {
    console.error('加载分类失败:', error)
    message.error('加载分类失败')
    categories.value = []
  }
}

async function loadTags() {
  try {
    const result = await knowledgeTagApi.list({ tenantId: getTenantId() })
    tags.value = Array.isArray(result) ? result : (result as any).records || []
  } catch (error) {
    console.error(error)
    tags.value = []
  }
}

async function loadCard() {
  if (!isEdit.value) return

  loading.value = true
  try {
    const result = await knowledgeCardApi.get(cardId.value) as any
    Object.assign(formData, {
      categoryId: result.categoryId,
      title: result.title,
      summary: result.summary,
      content: result.content,
      coverImage: result.coverImage,
      tags: result.tags,
      documentId: result.documentId || null,
      sort: result.sort,
      status: result.status,
    })
    selectedTags.value = result.tags ? result.tags.split(',').filter((t: string) => t) : []
    if (result.documentId && result.document) {
      documentOptions.value = [result.document as any]
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await loadTags()
  await loadCard()
})
</script>

<style scoped lang="less">
.knowledge-card-edit-page {
  width: 100%;
}

.selected-doc-info {
  margin-top: 8px;
  font-size: 12px;
  color: #595959;
  padding: 8px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 4px;
}

.editor-wrapper {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;

  &:hover {
    border-color: #40a9ff;
  }

  &:focus-within {
    border-color: #40a9ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
}

.rich-editor {
  width: 100%;
  border: none;
  outline: none;
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  min-height: 300px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.preview-content {
  h1 {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .preview-meta {
    margin-bottom: 24px;
  }

  .preview-body {
    font-size: 15px;
    line-height: 1.8;
    color: #333;

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 24px 0 12px;
    }

    h3 {
      font-size: 17px;
      font-weight: 600;
      margin: 20px 0 10px;
    }

    p {
      margin: 12px 0;
    }

    pre {
      background: #f6f8fa;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
    }

    code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
    }
  }
}
</style>
