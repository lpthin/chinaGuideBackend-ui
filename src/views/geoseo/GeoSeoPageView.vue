<template>
  <div class="geoseo-page-view">
    <a-card title="页面SEO配置" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          新增页面SEO配置
        </a-button>
      </template>

      <div class="filter-bar">
        <a-space>
          <span class="filter-label">页面类型：</span>
          <a-select
            v-model:value="filterType"
            style="width: 180px"
            placeholder="全部页面类型"
            allowClear
            @change="loadData"
          >
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="home">首页</a-select-option>
            <a-select-option value="category">分类页</a-select-option>
            <a-select-option value="article">文章页</a-select-option>
            <a-select-option value="case">案例页</a-select-option>
            <a-select-option value="custom">自定义</a-select-option>
          </a-select>
        </a-space>
      </div>

      <a-table
        :columns="columns"
        :data-source="pageList"
        :loading="loading"
        :row-key="(record: any) => record.id"
        :pagination="pagination"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'pageType'">
            <a-tag :color="getPageTypeColor(record.pageType)">
              {{ getPageTypeName(record.pageType) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确定要删除此页面SEO配置吗？"
                ok-text="确定"
                cancel-text="取消"
                @confirm="handleDelete(record.id)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑页面SEO配置' : '新增页面SEO配置'"
      width="720px"
      :confirm-loading="saving"
      :mask-closable="false"
      :destroy-on-close="true"
      @ok="handleSave"
    >
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="页面类型" required>
              <a-select v-model:value="form.pageType" placeholder="选择页面类型">
                <a-select-option value="home">首页</a-select-option>
                <a-select-option value="category">分类页</a-select-option>
                <a-select-option value="article">文章页</a-select-option>
                <a-select-option value="case">案例页</a-select-option>
                <a-select-option value="custom">自定义</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="页面标识" required>
              <a-input
                v-model:value="form.pageKey"
                placeholder="如: home, category-tech, article-list"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="SEO标题">
          <a-input
            v-model:value="form.seoTitle"
            :maxlength="60"
            show-count
            placeholder="请输入SEO标题"
          />
        </a-form-item>

        <a-form-item label="SEO描述">
          <a-textarea
            v-model:value="form.seoDescription"
            :maxlength="160"
            show-count
            :rows="2"
            placeholder="请输入SEO描述"
          />
        </a-form-item>

        <a-form-item label="SEO关键词">
          <a-input v-model:value="form.seoKeywords" placeholder="关键词1,关键词2" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Canonical URL">
              <a-input v-model:value="form.canonicalUrl" placeholder="https://example.com/page" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="robots meta">
              <a-select v-model:value="form.robotsMeta" placeholder="选择robots meta">
                <a-select-option value="index,follow">index,follow</a-select-option>
                <a-select-option value="noindex,follow">noindex,follow</a-select-option>
                <a-select-option value="index,nofollow">index,nofollow</a-select-option>
                <a-select-option value="noindex,nofollow">noindex,nofollow</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-collapse :bordered="false" style="margin-top: 8px">
          <a-collapse-panel key="og" header="Open Graph 配置">
            <a-form-item label="OG 标题">
              <a-input v-model:value="form.ogTitle" placeholder="Open Graph 标题" />
            </a-form-item>
            <a-form-item label="OG 描述">
              <a-textarea
                v-model:value="form.ogDescription"
                :rows="2"
                placeholder="Open Graph 描述"
              />
            </a-form-item>
            <a-form-item label="OG 图片">
              <a-input v-model:value="form.ogImage" placeholder="https://example.com/image.jpg" />
            </a-form-item>
          </a-collapse-panel>

          <a-collapse-panel key="twitter" header="Twitter Card 配置">
            <a-form-item label="Twitter Card 类型">
              <a-select v-model:value="form.twitterCardType" placeholder="选择卡片类型">
                <a-select-option value="summary">summary</a-select-option>
                <a-select-option value="summary_large_image">summary_large_image</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="Twitter 标题">
              <a-input v-model:value="form.twitterTitle" placeholder="Twitter 卡片标题" />
            </a-form-item>
            <a-form-item label="Twitter 描述">
              <a-textarea
                v-model:value="form.twitterDescription"
                :rows="2"
                placeholder="Twitter 卡片描述"
              />
            </a-form-item>
            <a-form-item label="Twitter 图片">
              <a-input
                v-model:value="form.twitterImage"
                placeholder="https://example.com/twitter-image.jpg"
              />
            </a-form-item>
          </a-collapse-panel>
        </a-collapse>

        <a-form-item label="结构化数据 (JSON-LD)" style="margin-top: 16px">
          <a-textarea
            v-model:value="form.structuredData"
            :rows="6"
            placeholder='{"@context":"https://schema.org",...}'
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { geoPageApi } from '../../api/geoseo'
import type { GeoSeoPage } from '../../types/geoseo'

const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const editingId = ref<number | null>(null)
const filterType = ref<string>('')
const pageList = ref<GeoSeoPage[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const columns = [
  { title: '页面类型', key: 'pageType', width: 120 },
  { title: '页面标识', dataIndex: 'pageKey', key: 'pageKey', width: 180 },
  { title: 'SEO标题', dataIndex: 'seoTitle', key: 'seoTitle', ellipsis: true },
  { title: 'Canonical URL', dataIndex: 'canonicalUrl', key: 'canonicalUrl', width: 300, ellipsis: true },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 160 },
]

function createEmptyForm(): GeoSeoPage {
  return {
    pageType: 'home',
    pageKey: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    canonicalUrl: '',
    robotsMeta: 'index,follow',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    twitterCardType: 'summary',
    twitterTitle: '',
    twitterDescription: '',
    twitterImage: '',
    structuredData: '',
  }
}

const form = reactive<GeoSeoPage>(createEmptyForm())

function getPageTypeName(type: string): string {
  const map: Record<string, string> = {
    home: '首页',
    category: '分类页',
    article: '文章页',
    case: '案例页',
    custom: '自定义',
  }
  return map[type] || type
}

function getPageTypeColor(type: string): string {
  const map: Record<string, string> = {
    home: 'blue',
    category: 'green',
    article: 'orange',
    case: 'purple',
    custom: 'default',
  }
  return map[type] || 'default'
}

async function loadData() {
  loading.value = true
  try {
    const params = filterType.value ? { pageType: filterType.value } : undefined
    const result = await geoPageApi.list(params)
    pageList.value = result || []
    pagination.total = pageList.value.length
  } catch (error) {
    console.error('加载页面SEO配置失败:', error)
    message.error('加载页面SEO配置失败')
    pageList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  editingId.value = null
  Object.assign(form, createEmptyForm())
  modalVisible.value = true
}

async function handleEdit(record: GeoSeoPage) {
  if (!record.id) return
  editingId.value = record.id
  try {
    const detail = await geoPageApi.get(record.id)
    Object.assign(form, detail)
  } catch (error) {
    console.error('加载页面SEO配置详情失败:', error)
    Object.assign(form, record)
  }
  modalVisible.value = true
}

async function handleSave() {
  if (!form.pageType) {
    message.warning('请选择页面类型')
    return
  }
  if (!form.pageKey.trim()) {
    message.warning('请输入页面标识')
    return
  }
  saving.value = true
  try {
    const payload: GeoSeoPage = { ...form }
    if (editingId.value) {
      await geoPageApi.update(editingId.value, payload)
      message.success('更新成功')
    } else {
      await geoPageApi.create(payload)
      message.success('创建成功')
    }
    modalVisible.value = false
    await loadData()
  } catch (error) {
    console.error('保存页面SEO配置失败:', error)
    message.error('操作失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await geoPageApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    console.error('删除页面SEO配置失败:', error)
    message.error('删除失败')
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.geoseo-page-view {
  width: 100%;
}

.filter-bar {
  margin-bottom: 16px;
}

.filter-label {
  color: #595959;
}
</style>
