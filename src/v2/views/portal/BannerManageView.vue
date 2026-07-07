<template>
  <div class="banner-manage-page">
    <a-page-header title="Banner管理" sub-title="管理门户网站的轮播图和横幅广告">
    </a-page-header>

    <div class="content-wrapper">
      <a-spin :spinning="loading">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                  <PictureOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.totalBanners }}</div>
                  <div class="stat-title">Banner 总数</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                  <EyeOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.totalViews }}</div>
                  <div class="stat-title">总点击</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                  <PushpinOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.activeCount }}</div>
                  <div class="stat-title">展示中</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card class="stat-card" hoverable>
              <div class="stat-content">
                <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%)">
                  <ClockCircleOutlined />
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ stats.scheduledCount }}</div>
                  <div class="stat-title">待发布</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-card :bordered="false">
          <template #title>
            <a-space>
              <a-select
                v-model:value="queryParams.status"
                style="width: 120px"
                placeholder="选择状态"
                @change="loadData"
                allowClear
              >
                <a-select-option value="active">展示中</a-select-option>
                <a-select-option value="scheduled">待发布</a-select-option>
                <a-select-option value="disabled">已下架</a-select-option>
              </a-select>
              <a-input-search
                v-model:value="queryParams.keyword"
                placeholder="搜索标题"
                style="width: 280px"
                @search="loadData"
                enter-button
              />
              <a-button type="primary" @click="showAddModal">
                <template #icon><PlusOutlined /></template>
                新建 Banner
              </a-button>
            </a-space>
          </template>

          <a-table
            :columns="columns"
            :data-source="bannerList"
            :pagination="false"
            :row-key="record => record.id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'image'">
                <img 
                  v-if="record.imageUrl" 
                  :src="record.imageUrl" 
                  class="banner-thumbnail" 
                  @error="handleImageError"
                />
              </template>
              <template v-if="column.key === 'title'">
                <div class="banner-title">{{ record.title }}</div>
                <div class="banner-subtitle" v-if="record.subtitle">{{ record.subtitle }}</div>
              </template>
              <template v-if="column.key === 'position'">
                <a-tag :color="getPositionColor(record.position)">
                  {{ getPositionText(record.position) }}
                </a-tag>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="handlePreview(record)">预览</a-button>
                  <a-button type="link" size="small" @click="goToEdit(record.id)">编辑</a-button>
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
              :show-total="(total) => `共 ${total} 条`"
            />
          </div>
        </a-card>
      </a-spin>
    </div>

    <a-modal
      v-model:open="previewVisible"
      title="预览 Banner"
      width="800px"
      :footer="null"
    >
      <div v-if="previewBanner" class="banner-preview">
        <img :src="previewBanner.imageUrl" style="width: 100%" />
        <div style="margin-top: 16px">
          <h3>{{ previewBanner.title }}</h3>
          <p v-if="previewBanner.subtitle">{{ previewBanner.subtitle }}</p>
          <p>跳转链接: <a :href="previewBanner.linkUrl" target="_blank">{{ previewBanner.linkUrl || '无' }}</a></p>
          <p>位置: {{ getPositionText(previewBanner.position) }}</p>
          <p>排序: {{ previewBanner.sort }}</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  PictureOutlined,
  EyeOutlined,
  PushpinOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { bannerApi } from '../../api/portal'
import type { Banner } from '../../types/portal'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const bannerList = ref<Banner[]>([])
const previewVisible = ref(false)
const previewBanner = ref<Banner | null>(null)

const stats = reactive({
  totalBanners: 0,
  totalViews: 0,
  activeCount: 0,
  scheduledCount: 0,
})

const queryParams = reactive({
  status: undefined as string | undefined,
  keyword: '',
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const columns = [
  { title: '图片', key: 'image', width: 120 },
  { title: '标题', key: 'title', width: 250 },
  { title: '位置', key: 'position', width: 120 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80, align: 'center' as const },
  { title: '点击量', dataIndex: 'clickCount', key: 'clickCount', width: 100, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

function getPositionColor(position: string): string {
  const colorMap: Record<string, string> = {
    home: 'blue',
    top: 'green',
    middle: 'orange',
    bottom: 'purple',
    sidebar: 'cyan',
  }
  return colorMap[position] || 'default'
}

function getPositionText(position: string): string {
  const textMap: Record<string, string> = {
    home: '首页轮播',
    top: '顶部横幅',
    middle: '中部横幅',
    bottom: '底部横幅',
    sidebar: '侧边栏',
  }
  return textMap[position] || position
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    active: 'green',
    scheduled: 'orange',
    disabled: 'default',
  }
  return colorMap[status] || 'default'
}

function getStatusText(status: string): string {
  const textMap: Record<string, string> = {
    active: '展示中',
    scheduled: '待发布',
    disabled: '已下架',
  }
  return textMap[status] || status
}

function handlePreview(record: Banner) {
  previewBanner.value = record
  previewVisible.value = true
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
}

function showAddModal() {
  router.push('/portal/banner/new')
}

function goToEdit(id: number) {
  router.push(`/portal/banner/${id}/edit`)
}

async function handleDelete(id: number) {
  try {
    await bannerApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    message.error('删除失败')
    console.error(error)
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: pagination.page,
      size: pagination.size,
    }
    if (queryParams.status) {
      params.status = queryParams.status
    }
    if (queryParams.keyword) {
      params.keyword = queryParams.keyword
    }
    const result = await bannerApi.list(params)
    bannerList.value = result.records || []
    pagination.total = result.total || 0
    stats.totalBanners = result.total || 0
    stats.totalViews = bannerList.value.reduce((sum, b) => sum + (b.clickCount || 0), 0)
    stats.activeCount = bannerList.value.filter(b => b.status === 'active').length
    stats.scheduledCount = bannerList.value.filter(b => b.status === 'scheduled').length
  } catch (error) {
    message.error('加载Banner列表失败')
    console.error(error)
  } finally {
    loading.value = false
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

.content-wrapper {
  padding: 24px;
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

.banner-thumbnail {
  width: 100px;
  height: 50px;
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

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.banner-preview {
  text-align: center;
}
</style>
