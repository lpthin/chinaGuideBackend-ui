<template>
  <div class="seo-config-page">
    <a-page-header title="SEO配置" sub-title="管理门户网站的SEO优化配置">
    </a-page-header>

    <div class="content-wrapper">
      <a-spin :spinning="loading">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <FileSearchOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.totalPages }}</div>
                  <div class="stat-title">配置页面数</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <template #title>
            <a-space>
              <a-select
                v-model:value="queryParams.pageType"
                style="width: 150px"
                placeholder="页面类型"
                allowClear
                @change="loadData"
              >
                <a-select-option value="home">首页</a-select-option>
                <a-select-option value="category">分类页</a-select-option>
                <a-select-option value="article">文章页</a-select-option>
                <a-select-option value="case">案例页</a-select-option>
                <a-select-option value="custom">自定义页</a-select-option>
              </a-select>
              <a-input-search
                v-model:value="queryParams.keyword"
                placeholder="搜索页面标题/URL"
                style="width: 280px"
                enter-button
                @search="handleSearch"
              />
              <a-button type="primary" @click="showAddModal">
                <template #icon><PlusOutlined /></template>
                新增配置
              </a-button>
            </a-space>
          </template>

          <a-table
            :scroll="{ x: 'max-content' }"
            :columns="columns"
            :data-source="pagedList"
            :pagination="false"
            :row-key="(record: any) => record.id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'page'">
                <div class="page-title">{{ record.seoTitle }}</div>
                <div class="page-url">{{ record.pageKey }}</div>
              </template>
              <template v-if="column.key === 'keywordCount'">
                {{ getKeywordCount(record) }}
              </template>
              <template v-if="column.key === 'pageType'">
                {{ pageTypeName(record.pageType) }}
              </template>
              <template v-if="column.key === 'updatedAt'">
                {{ formatDateTime(record.updatedAt) }}
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="editConfig(record)">编辑</a-button>
                  <a-popconfirm
                    title="确定要删除这个SEO配置吗？"
                    @confirm="handleDelete(record.id)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>

          <div class="pagination-wrapper">
            <a-pagination
              v-model:current="pagination.page"
              v-model:page-size="pagination.size"
              :total="pagination.total"
              :show-size-changer="true"
              :show-quick-jumper="true"
              :page-size-options="['10', '20', '50']"
              @change="loadData"
              @showSizeChange="handleSizeChange"
              :show-total="(total: number) => `共 ${total} 条`"
            />
          </div>
        </a-card>
      </a-spin>
    </div>

    <a-modal
      v-model:open="modalVisible"
      :title="editingRecord ? '编辑SEO配置' : '新增SEO配置'"
      @ok="handleModalOk"
      :confirmLoading="saving"
      width="800px"
    >
      <a-form layout="vertical" :model="formData">
        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="SEO标题" required>
              <a-input
                v-model:value="formData.seoTitle"
                placeholder="请输入页面标题"
                :maxlength="60"
                show-count
              />
              <div class="form-tip">建议长度：50-60个字符</div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="页面Key" required>
              <a-input
                v-model:value="formData.pageKey"
                placeholder="请输入页面唯一标识，如 home、about"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="页面类型" required>
          <a-select v-model:value="formData.pageType" placeholder="选择页面类型" style="width: 240px">
            <a-select-option value="home">首页</a-select-option>
            <a-select-option value="category">分类页</a-select-option>
            <a-select-option value="article">文章页</a-select-option>
            <a-select-option value="case">案例页</a-select-option>
            <a-select-option value="custom">自定义页</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="Meta描述">
          <a-textarea
            v-model:value="formData.seoDescription"
            :rows="3"
            placeholder="请输入页面Meta描述"
            :maxlength="160"
            show-count
          />
          <div class="form-tip">建议长度：150-160个字符</div>
        </a-form-item>

        <a-form-item label="Meta关键词">
          <a-select
            v-model:value="metaKeywordsList"
            mode="tags"
            style="width: 100%"
            placeholder="输入关键词后按回车添加"
          />
          <div class="form-tip">建议数量：5-10个关键词</div>
        </a-form-item>

        <a-divider orientation="left">社交媒体（Open Graph）</a-divider>

        <a-form-item label="OG标题">
          <a-input
            v-model:value="formData.ogTitle"
            placeholder="Open Graph标题，用于社交媒体分享"
            :maxlength="95"
            show-count
          />
        </a-form-item>

        <a-form-item label="OG描述">
          <a-textarea
            v-model:value="formData.ogDescription"
            :rows="2"
            placeholder="Open Graph描述，用于社交媒体分享"
            :maxlength="200"
            show-count
          />
        </a-form-item>

        <a-form-item label="OG图片">
          <a-input
            v-model:value="formData.ogImage"
            placeholder="Open Graph图片URL，用于社交媒体分享"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileSearchOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { seoConfigApi } from '../../api/portal'
import type { SeoConfig, SeoConfigForm } from '../../types/portal'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const editingRecord = ref<SeoConfig | null>(null)

const stats = reactive({
  totalPages: 0,
})

const queryParams = reactive({
  pageType: undefined as string | undefined,
  keyword: '',
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0,
})

const configList = ref<SeoConfig[]>([])

const metaKeywordsList = ref<string[]>([])

const formData = reactive<SeoConfigForm>({
  pageType: 'custom',
  pageKey: '',
  seoTitle: '',
  seoKeywords: '',
  seoDescription: '',
  ogImage: '',
  ogTitle: '',
  ogDescription: '',
})

const columns = [
  { title: '页面信息', key: 'page', width: 300 },
  { title: '页面类型', key: 'pageType', width: 120 },
  { title: '关键词数', key: 'keywordCount', width: 100, align: 'center' as const },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

const PAGE_TYPE_NAMES: Record<string, string> = {
  home: '首页',
  category: '分类页',
  article: '文章页',
  case: '案例页',
  custom: '自定义页',
}

function pageTypeName(pageType?: string) {
  return pageType ? PAGE_TYPE_NAMES[pageType] || pageType : '-'
}

const pagedList = computed(() => {
  const start = (pagination.page - 1) * pagination.size
  return configList.value.slice(start, start + pagination.size)
})

function getKeywordCount(config: SeoConfig): number {
  return config.seoKeywords ? config.seoKeywords.split(',').filter(Boolean).length : 0
}

function resetFormData() {
  Object.assign(formData, {
    pageType: 'custom',
    pageKey: '',
    seoTitle: '',
    seoKeywords: '',
    seoDescription: '',
    ogImage: '',
    ogTitle: '',
    ogDescription: '',
  })
}

function showAddModal() {
  editingRecord.value = null
  resetFormData()
  metaKeywordsList.value = []
  modalVisible.value = true
}

function editConfig(record: SeoConfig) {
  editingRecord.value = record
  Object.assign(formData, {
    pageType: record.pageType || 'custom',
    pageKey: record.pageKey,
    seoTitle: record.seoTitle,
    seoKeywords: record.seoKeywords,
    seoDescription: record.seoDescription,
    ogImage: record.ogImage,
    ogTitle: record.ogTitle,
    ogDescription: record.ogDescription,
  })
  metaKeywordsList.value = record.seoKeywords ? record.seoKeywords.split(',').filter(Boolean) : []
  modalVisible.value = true
}

async function handleModalOk() {
  if (!auth.selectedTenantId) {
    message.error('请先选择租户')
    return
  }
  if (!formData.seoTitle) {
    message.error('请输入SEO标题')
    return
  }
  if (!formData.pageKey) {
    message.error('请输入页面Key')
    return
  }

  saving.value = true
  try {
    const payload: SeoConfigForm = {
      ...formData,
      tenantId: auth.selectedTenantId,
      seoKeywords: metaKeywordsList.value.join(','),
    }

    if (editingRecord.value) {
      await seoConfigApi.update(editingRecord.value.id, payload)
      message.success('更新成功')
    } else {
      await seoConfigApi.create(payload)
      message.success('创建成功')
    }
    modalVisible.value = false
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await seoConfigApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

async function loadData() {
  if (!auth.selectedTenantId) {
    configList.value = []
    pagination.total = 0
    stats.totalPages = 0
    return
  }
  loading.value = true
  try {
    const result = await seoConfigApi.list({
      tenantId: auth.selectedTenantId,
      pageType: queryParams.pageType,
      keyword: queryParams.keyword || undefined,
    })
    configList.value = result || []
    pagination.total = configList.value.length
    stats.totalPages = configList.value.length
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载SEO配置失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadData()
}

function handleSizeChange(_current: number, size: number) {
  pagination.page = 1
  pagination.size = size
}

onMounted(() => {
  loadData()
})

watch(() => auth.selectedTenantId, loadData)
</script>

<style scoped lang="less">
.seo-config-page {
  width: 100%;
  padding: 0;
}

.content-wrapper {
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.page-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}

.page-url {
  font-size: 12px;
  color: #8c8c8c;
}

.form-tip {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
