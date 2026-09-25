<template>
  <div class="banner-manage-page">
    <a-page-header title="Banner管理" sub-title="管理门户首页轮播与横幅">
    </a-page-header>

    <div class="content-wrapper">
      <a-spin :spinning="loading">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="8">
            <a-card class="stat-card">
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <PictureOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ formatNumber(stats.totalBanners) }}</div>
                  <div class="stat-title">Banner 总数</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="stat-card">
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                  <CheckCircleOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ formatNumber(stats.enabledCount) }}</div>
                  <div class="stat-title">展示中（门户可见）</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card class="stat-card">
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)">
                  <StopOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ formatNumber(stats.disabledCount) }}</div>
                  <div class="stat-title">已停用</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <template #title>
            <a-space class="toolbar-fill" wrap>
              <a-select
                v-model:value="queryParams.status"
                style="width: 140px"
                placeholder="选择状态"
                allowClear
                @change="loadData"
              >
                <a-select-option value="ENABLED">展示中</a-select-option>
                <a-select-option value="DISABLED">已停用</a-select-option>
              </a-select>
              <a-button type="primary" @click="openCreate">
                <template #icon><PlusOutlined /></template>
                新建 Banner
              </a-button>
            </a-space>
          </template>

          <a-table
            :scroll="{ x: 'max-content' }"
            :columns="columns"
            :data-source="bannerList"
            :pagination="false"
            :row-key="(record: any) => record.id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'image'">
                <img
                  v-if="record.imageUrl"
                  :src="record.imageUrl"
                  class="banner-thumbnail"
                  @error="handleImageError"
                />
                <span v-else class="banner-missing">未配图</span>
              </template>
              <template v-if="column.key === 'title'">
                <div class="banner-title">{{ record.title }} <DemoFlag :is-demo="record.isDemo" /></div>
                <div class="banner-subtitle" v-if="record.subtitle">{{ record.subtitle }}</div>
                <div class="banner-subtitle" v-if="record.linkUrl">跳转到 {{ record.linkUrl }}</div>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-if="column.key === 'createdAt'">
                {{ formatDateTime(record.createdAt) }}
              </template>
              <template v-if="column.key === 'updatedAt'">
                {{ formatDateTime(record.updatedAt) }}
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="handlePreview(record)">预览</a-button>
                  <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
                  <a-button v-if="record.status !== 'ENABLED'" type="link" size="small" @click="toggleStatus(record, true)">上架</a-button>
                  <a-button v-else type="link" size="small" @click="toggleStatus(record, false)">下架</a-button>
                  <a-popconfirm
                    title="确定要删除这个 Banner 吗？"
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

    <a-modal v-model:open="previewVisible" title="预览 Banner" width="800px" :footer="null">
      <div v-if="previewBanner" class="banner-preview">
        <img v-if="previewBanner.imageUrl" :src="previewBanner.imageUrl" style="width: 100%" />
        <p v-else class="banner-missing">这条 Banner 还没有配图，门户上不会显示出来。</p>
        <div style="margin-top: 16px">
          <h3>{{ previewBanner.title }}</h3>
          <p v-if="previewBanner.subtitle">{{ previewBanner.subtitle }}</p>
          <p>跳转链接: <a v-if="previewBanner.linkUrl" :href="previewBanner.linkUrl" target="_blank">{{ previewBanner.linkUrl }}</a><span v-else>不跳转</span></p>
          <p>排序: {{ previewBanner.sort }}</p>
          <p>状态: {{ getStatusText(previewBanner.status) }}</p>
        </div>
      </div>
    </a-modal>

    <a-modal
      v-model:open="formVisible"
      :title="editingId ? '编辑 Banner' : '新建 Banner'"
      width="640px"
      :confirm-loading="saving"
      @ok="handleSave"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="主标题" required>
          <a-input v-model:value="form.title" placeholder="一句话说清这条横幅想表达什么" />
        </a-form-item>
        <a-form-item label="副标题">
          <a-input v-model:value="form.subtitle" placeholder="可选，补充一句具体信息" />
        </a-form-item>
        <a-form-item label="图片地址" required>
          <MediaImagePicker v-model="form.imageUrl" placeholder="从媒体库挑一张，或粘贴已有图片地址" />
        </a-form-item>
        <a-form-item label="跳转链接">
          <a-input v-model:value="form.linkUrl" placeholder="留空表示这张 Banner 不跳转" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="排序">
              <a-input-number v-model:value="form.sortOrder" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注说明">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="给自己看的投放说明，不会出现在门户上" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PictureOutlined,
  CheckCircleOutlined,
  StopOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { bannerApi } from '../../api/portal'
import type { Banner, BannerForm, BannerQuery } from '../../types/portal'
import { formatDateTime, formatNumber } from '../../utils/format'
import DemoFlag from '../../components/DemoFlag.vue'
import MediaImagePicker from '../../components/MediaImagePicker.vue'

const loading = ref(false)
const saving = ref(false)
const bannerList = ref<Banner[]>([])
const previewVisible = ref(false)
const previewBanner = ref<Banner | null>(null)
const formVisible = ref(false)
const editingId = ref<number | null>(null)

// 后端 portal_banner 只有 ENABLED / DISABLED 两态，门户聚合查询只取 ENABLED
function getStatusColor(status: string): string {
  return status === 'ENABLED' ? 'green' : 'default'
}

function getStatusText(status: string): string {
  if (status === 'ENABLED') return '展示中'
  if (status === 'DISABLED') return '已停用'
  return status
}

const stats = reactive({
  totalBanners: 0,
  enabledCount: 0,
  disabledCount: 0,
})

const queryParams = reactive({
  status: undefined as string | undefined,
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const columns = [
  { title: '图片', key: 'image', width: 140 },
  { title: '标题', key: 'title', width: 320 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 240 },
]

const emptyForm = (): BannerForm => ({
  title: '',
  subtitle: '',
  imageUrl: '',
  linkUrl: '',
  sortOrder: 0,
  description: '',
})

const form = reactive<BannerForm>(emptyForm())

function handleImageError(event: Event) {
  (event.target as HTMLImageElement).style.display = 'none'
}

function handlePreview(record: Banner) {
  previewBanner.value = record
  previewVisible.value = true
}

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formVisible.value = true
}

function openEdit(record: Banner) {
  editingId.value = record.id
  Object.assign(form, {
    title: record.title ?? '',
    subtitle: record.subtitle ?? '',
    imageUrl: record.imageUrl ?? '',
    linkUrl: record.linkUrl ?? '',
    sortOrder: record.sort ?? 0,
    description: record.description ?? '',
  })
  formVisible.value = true
}

async function handleSave() {
  if (!form.title?.trim()) {
    message.warning('请填写主标题')
    return
  }
  if (!form.imageUrl?.trim()) {
    message.warning('Banner 必须有图片，否则门户上是一片空白')
    return
  }
  saving.value = true
  try {
    const payload: BannerForm = { ...form, linkType: form.linkUrl?.trim() ? 'URL' : 'NONE' }
    if (editingId.value) {
      await bannerApi.update(editingId.value, payload)
      message.success('Banner 已更新')
    } else {
      await bannerApi.create(payload)
      message.success('Banner 已保存，点「上架」后门户才会展示')
    }
    formVisible.value = false
    await loadData()
  } catch (error: any) {
    message.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(record: Banner, toEnabled: boolean) {
  try {
    await (toEnabled ? bannerApi.enable(record.id) : bannerApi.disable(record.id))
    record.status = toEnabled ? 'ENABLED' : 'DISABLED'
    message.success(toEnabled ? '已上架，门户现在会展示它' : '已下架')
    loadStats()
  } catch (error: any) {
    message.error(error?.message || '操作失败')
  }
}

async function handleDelete(id: number) {
  try {
    await bannerApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error: any) {
    message.error(error?.message || '删除失败')
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: BannerQuery = {
      page: pagination.page,
      size: pagination.size,
      status: queryParams.status || undefined,
    }
    const result = await bannerApi.list(params)
    bannerList.value = result.records || []
    pagination.total = result.total || 0
    loadStats()
  } catch (error: any) {
    message.error(error?.message || '加载 Banner 列表失败')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const [all, enabled, disabled] = await Promise.all([
      bannerApi.list({ page: 1, size: 1 }),
      bannerApi.list({ page: 1, size: 1, status: 'ENABLED' }),
      bannerApi.list({ page: 1, size: 1, status: 'DISABLED' }),
    ])
    stats.totalBanners = all.total || 0
    stats.enabledCount = enabled.total || 0
    stats.disabledCount = disabled.total || 0
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

function handleSizeChange(_current: number, size: number) {
  pagination.page = 1
  pagination.size = size
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.banner-manage-page {
  width: 100%;
  padding: 0;
}

.stat-card {
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

.banner-thumbnail {
  width: 110px;
  height: 55px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.banner-title {
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.banner-subtitle {
  font-size: 12px;
  color: #8c8c8c;
}

.banner-missing {
  font-size: 12px;
  color: #faad14;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.banner-preview {
  text-align: center;
}
</style>
