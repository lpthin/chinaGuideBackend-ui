<template>
  <div class="case-manage-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                < TrophyOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalCases }}</div>
                <div class="stat-title">案例总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalViews }}</div>
                <div class="stat-title">总浏览量</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)">
                <StarOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalStars }}</div>
                <div class="stat-title">总收藏</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                <TagOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalIndustries }}</div>
                <div class="stat-title">行业数</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space>
            <a-select
              v-model:value="queryParams.industry"
              style="width: 150px"
              placeholder="选择行业"
              allowClear
            >
              <a-select-option value="finance">金融科技</a-select-option>
              <a-select-option value="ecommerce">电子商务</a-select-option>
              <a-select-option value="education">在线教育</a-select-option>
              <a-select-option value="health">医疗健康</a-select-option>
              <a-select-option value="manufacture">智能制造</a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.status"
              style="width: 120px"
              placeholder="状态"
              allowClear
            >
              <a-select-option value="published">已发布</a-select-option>
              <a-select-option value="draft">草稿</a-select-option>
              <a-select-option value="offline">已下线</a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索案例名称/客户名称"
              style="width: 280px"
              enter-button
            />
            <a-button type="primary" @click="showAddModal">
              <template #icon><PlusOutlined /></template>
              新建案例
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="caseList"
          :pagination="paginationConfig"
          :row-key="record => record.id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="case-name">
                <img v-if="record.logo" :src="record.logo" class="case-logo" />
                <div class="case-logo-placeholder" v-else>{{ record.clientName.charAt(0) }}</div>
                <div style="flex: 1; margin-left: 12px">
                  <div class="case-title">{{ record.caseName }}</div>
                  <div class="case-client">{{ record.clientName }}</div>
                </div>
              </div>
            </template>
            <template v-if="column.key === 'industry'">
              <a-tag color="blue">{{ getIndustryName(record.industry) }}</a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusName(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-button type="link" size="small" @click="viewDetail(record)">查看</a-button>
                <a-button type="link" size="small" @click="editCase(record)">编辑</a-button>
                <a-popconfirm
                  title="确定要删除这个案例吗？"
                  @confirm="handleDelete(record.id)"
                >
                  <a-button type="link" size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  TrophyOutlined,
  EyeOutlined,
  StarOutlined,
  TagOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'

const loading = ref(false)

const stats = reactive({
  totalCases: 48,
  totalViews: 125680,
  totalStars: 3256,
  totalIndustries: 12,
})

const queryParams = reactive({
  industry: undefined as string | undefined,
  status: undefined as string | undefined,
  keyword: '',
})

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSize: number) => {
    paginationConfig.current = page
    paginationConfig.pageSize = pageSize
  },
})

const columns = [
  { title: '案例信息', key: 'name', width: 280 },
  { title: '行业', key: 'industry', width: 120 },
  { title: '服务内容', dataIndex: 'services', key: 'services', width: 200 },
  { title: '浏览量', dataIndex: 'viewCount', key: 'viewCount', width: 100, align: 'center' as const },
  { title: '收藏数', dataIndex: 'starCount', key: 'starCount', width: 100, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '发布时间', dataIndex: 'publishTime', key: 'publishTime', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 },
]

const caseList = ref([
  {
    id: 1,
    caseName: '某大型银行数字化转型解决方案',
    clientName: '中国工商银行',
    logo: '',
    industry: 'finance',
    services: '核心系统重构,移动银行,数据中台',
    viewCount: 15680,
    starCount: 428,
    status: 'published',
    publishTime: '2024-03-10',
  },
  {
    id: 2,
    caseName: '电商平台双11高并发架构升级',
    clientName: '阿里巴巴集团',
    logo: '',
    industry: 'ecommerce',
    services: '高并发架构,分布式缓存,CDN加速',
    viewCount: 23450,
    starCount: 685,
    status: 'published',
    publishTime: '2024-03-08',
  },
  {
    id: 3,
    caseName: '在线教育平台智慧课堂系统',
    clientName: '新东方在线',
    logo: '',
    industry: 'education',
    services: '直播系统,AI互动,学习分析',
    viewCount: 18920,
    starCount: 512,
    status: 'published',
    publishTime: '2024-03-05',
  },
  {
    id: 4,
    caseName: '互联网医院全流程解决方案',
    clientName: '微医集团',
    logo: '',
    industry: 'health',
    services: '在线问诊,电子处方,药品配送',
    viewCount: 12350,
    starCount: 356,
    status: 'draft',
    publishTime: '-',
  },
  {
    id: 5,
    caseName: '智能制造数字孪生工厂',
    clientName: '海尔集团',
    logo: '',
    industry: 'manufacture',
    services: '数字孪生,IoT平台,智能调度',
    viewCount: 8960,
    starCount: 285,
    status: 'published',
    publishTime: '2024-02-28',
  },
  {
    id: 6,
    caseName: '券商量化交易系统建设',
    clientName: '华泰证券',
    logo: '',
    industry: 'finance',
    services: '量化引擎,风控系统,行情对接',
    viewCount: 7650,
    starCount: 218,
    status: 'published',
    publishTime: '2024-02-25',
  },
])

paginationConfig.total = caseList.value.length

function getIndustryName(industry: string): string {
  const nameMap: Record<string, string> = {
    finance: '金融科技',
    ecommerce: '电子商务',
    education: '在线教育',
    health: '医疗健康',
    manufacture: '智能制造',
  }
  return nameMap[industry] || industry
}

function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    published: 'green',
    draft: 'default',
    offline: 'red',
  }
  return colorMap[status] || 'default'
}

function getStatusName(status: string): string {
  const nameMap: Record<string, string> = {
    published: '已发布',
    draft: '草稿',
    offline: '已下线',
  }
  return nameMap[status] || status
}

function showAddModal() {
  message.info('新建案例功能')
}

function editCase(record: any) {
  message.info(`编辑案例：${record.caseName}`)
}

function viewDetail(record: any) {
  message.info(`查看案例详情：${record.caseName}`)
}

function handleDelete(id: number) {
  const index = caseList.value.findIndex(c => c.id === id)
  if (index > -1) {
    const item = caseList.value[index]
    stats.totalCases -= 1
    stats.totalViews -= item.viewCount
    stats.totalStars -= item.starCount
    caseList.value.splice(index, 1)
    paginationConfig.total -= 1
    message.success('删除成功')
  }
}

onMounted(() => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 300)
})
</script>

<style scoped lang="less">
.case-manage-page {
  width: 100%;
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

.case-name {
  display: flex;
  align-items: center;
}

.case-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid #e8e8e8;
}

.case-logo-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.case-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.case-client {
  font-size: 12px;
  color: #8c8c8c;
}
</style>
