<template>
  <div class="geoseo-keyword-view">
    <a-card title="关键词排名追踪" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          添加关键词
        </a-button>
      </template>

      <a-alert type="info" show-icon style="margin-bottom: 16px">
        <template #message>
          <div class="alert-content">
            <p>关键词排名追踪帮助你了解网站在搜索引擎中的排名表现。</p>
            <p>添加追踪关键词后，点击"检查排名"按钮可以手动更新排名数据。</p>
            <p>排名数字越小表示排名越靠前（1 = 第一名）。</p>
            <p>竞品排名字段支持记录多个竞品的排名对比。</p>
          </div>
        </template>
      </a-alert>

      <a-alert type="warning" show-icon style="margin-bottom: 16px">
        <template #message>
          <span>提示：系统目前支持手动录入排名数据。自动排名追踪功能将在后续版本中推出。</span>
        </template>
      </a-alert>

      <div class="filter-bar">
        <a-space>
          <span class="filter-label">搜索引擎：</span>
          <a-select
            v-model:value="searchEngineFilter"
            style="width: 160px"
            placeholder="全部搜索引擎"
            @change="loadData"
          >
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="google">Google</a-select-option>
            <a-select-option value="baidu">百度</a-select-option>
          </a-select>
        </a-space>
      </div>

      <a-table
        v-if="keywords.length || loading"
        :data-source="keywords"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="pagination"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'keyword'">
            <span class="keyword-text">{{ record.keyword }}</span>
          </template>
          <template v-if="column.key === 'searchEngine'">
            <a-tag :color="getSearchEngineColor(record.searchEngine)">
              {{ getSearchEngineName(record.searchEngine) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'currentRank'">
            <span class="rank-text" :style="{ color: getRankColor(record.currentRank) }">
              {{ record.currentRank != null ? record.currentRank : '-' }}
            </span>
          </template>
          <template v-if="column.key === 'previousRank'">
            <span class="rank-change">
              <span class="prev-rank">{{ record.previousRank != null ? record.previousRank : '-' }}</span>
              <span
                v-if="getRankChange(record)"
                class="rank-change-tag"
                :class="getRankChange(record)?.cls"
              >
                <ArrowDownOutlined v-if="getRankChange(record)?.direction === 'down'" />
                <ArrowUpOutlined v-else-if="getRankChange(record)?.direction === 'up'" />
                {{ getRankChange(record)?.text }}
              </span>
            </span>
          </template>
          <template v-if="column.key === 'bestRank'">
            <span class="rank-text" :style="{ color: getRankColor(record.bestRank) }">
              {{ record.bestRank != null ? record.bestRank : '-' }}
            </span>
          </template>
          <template v-if="column.key === 'trackedUrl'">
            <a
              v-if="record.trackedUrl"
              :href="record.trackedUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="tracked-url"
            >
              {{ record.trackedUrl }}
            </a>
            <span v-else class="empty-text">-</span>
          </template>
          <template v-if="column.key === 'checkedAt'">
            <span v-if="record.checkedAt" class="checked-at">{{ formatDateTime(record.checkedAt) }}</span>
            <span v-else class="empty-text">-</span>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button
                type="link"
                size="small"
                :loading="checkingId === record.id"
                @click="handleCheck(record)"
              >
                检查排名
              </a-button>
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确定要删除这个关键词吗？"
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

      <a-empty
        v-else
        description="暂无关键词数据，请添加您的第一个关键词开始追踪排名"
      >
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          添加第一个关键词
        </a-button>
      </a-empty>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑关键词' : '添加关键词'"
      :confirm-loading="saving"
      :mask-closable="false"
      :destroy-on-close="true"
      width="560px"
      @ok="handleSave"
    >
      <a-form layout="vertical" :model="formData">
        <a-form-item label="关键词" required>
          <a-input
            v-model:value="formData.keyword"
            placeholder="请输入要追踪的关键词"
            :maxlength="200"
          />
        </a-form-item>
        <a-form-item label="搜索引擎" required>
          <a-select v-model:value="formData.searchEngine" placeholder="选择搜索引擎">
            <a-select-option value="google">Google</a-select-option>
            <a-select-option value="baidu">百度</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="追踪URL">
          <a-input
            v-model:value="formData.trackedUrl"
            placeholder="要追踪排名的页面URL"
          />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="当前排名">
              <a-input-number
                v-model:value="formData.currentRank"
                :min="1"
                style="width: 100%"
                placeholder="当前排名"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="最佳排名">
              <a-input-number
                v-model:value="formData.bestRank"
                :min="1"
                style="width: 100%"
                placeholder="历史最佳排名"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="竞品排名">
          <a-textarea
            v-model:value="formData.competitorRank"
            :rows="2"
            placeholder='JSON格式: {"competitor1": 5, "competitor2": 12}'
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons-vue'
import { geoKeywordApi } from '../../api/geoseo'
import type { GeoSeoKeywordRank } from '../../types/geoseo'

const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const editingId = ref<number | null>(null)
const checkingId = ref<number | null>(null)
const searchEngineFilter = ref<string>('')
const keywords = ref<GeoSeoKeywordRank[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const formData = reactive<GeoSeoKeywordRank>({
  keyword: '',
  searchEngine: 'google',
  currentRank: null,
  previousRank: null,
  bestRank: null,
  trackedUrl: '',
  competitorRank: '',
  checkedAt: null,
})

const columns = [
  { title: '关键词', key: 'keyword', dataIndex: 'keyword', width: 180, ellipsis: true },
  { title: '搜索引擎', key: 'searchEngine', dataIndex: 'searchEngine', width: 110 },
  { title: '当前排名', key: 'currentRank', dataIndex: 'currentRank', width: 100 },
  { title: '上次排名', key: 'previousRank', dataIndex: 'previousRank', width: 130 },
  { title: '最佳排名', key: 'bestRank', dataIndex: 'bestRank', width: 100 },
  { title: '追踪URL', key: 'trackedUrl', dataIndex: 'trackedUrl', width: 220, ellipsis: true },
  { title: '检查时间', key: 'checkedAt', dataIndex: 'checkedAt', width: 170 },
  { title: '操作', key: 'actions', width: 220, fixed: 'right' as const },
]

function getSearchEngineColor(engine: string): string {
  if (engine === 'google') return 'blue'
  if (engine === 'baidu') return 'red'
  return 'default'
}

function getSearchEngineName(engine: string): string {
  if (engine === 'google') return 'Google'
  if (engine === 'baidu') return '百度'
  return engine || '-'
}

function getRankColor(rank: number | null | undefined): string {
  if (rank == null) return '#bfbfbf'
  if (rank <= 3) return '#52c41a'
  if (rank <= 10) return '#1890ff'
  if (rank <= 30) return '#fa8c16'
  return '#f5222d'
}

interface RankChange {
  direction: 'up' | 'down' | 'same'
  text: string
  cls: string
}

function getRankChange(record: GeoSeoKeywordRank): RankChange | null {
  const cur = record.currentRank
  const prev = record.previousRank
  if (cur == null || prev == null) return null
  if (cur === prev) return { direction: 'same', text: '0', cls: 'change-same' }
  // 数字变小 = 排名上升 = 改善（绿色）
  if (cur < prev) {
    return { direction: 'down', text: String(prev - cur), cls: 'change-improved' }
  }
  // 数字变大 = 排名下降 = 退步（红色）
  return { direction: 'up', text: String(cur - prev), cls: 'change-declined' }
}

function formatDateTime(value: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function resetForm() {
  editingId.value = null
  formData.keyword = ''
  formData.searchEngine = 'google'
  formData.currentRank = null
  formData.previousRank = null
  formData.bestRank = null
  formData.trackedUrl = ''
  formData.competitorRank = ''
  formData.checkedAt = null
}

function handleAdd() {
  resetForm()
  modalVisible.value = true
}

function handleEdit(record: GeoSeoKeywordRank) {
  editingId.value = record.id ?? null
  formData.keyword = record.keyword || ''
  formData.searchEngine = record.searchEngine || 'google'
  formData.currentRank = record.currentRank ?? null
  formData.previousRank = record.previousRank ?? null
  formData.bestRank = record.bestRank ?? null
  formData.trackedUrl = record.trackedUrl || ''
  formData.competitorRank = record.competitorRank || ''
  formData.checkedAt = record.checkedAt ?? null
  modalVisible.value = true
}

async function handleSave() {
  if (!formData.keyword?.trim()) {
    message.warning('请输入关键词')
    return
  }
  if (!formData.searchEngine) {
    message.warning('请选择搜索引擎')
    return
  }

  saving.value = true
  try {
    const payload: GeoSeoKeywordRank = {
      keyword: formData.keyword.trim(),
      searchEngine: formData.searchEngine,
      currentRank: formData.currentRank,
      previousRank: formData.previousRank,
      bestRank: formData.bestRank,
      trackedUrl: formData.trackedUrl || '',
      competitorRank: formData.competitorRank || '',
      checkedAt: formData.checkedAt,
    }
    if (editingId.value != null) {
      await geoKeywordApi.update(editingId.value, payload)
      message.success('更新成功')
    } else {
      await geoKeywordApi.create(payload)
      message.success('添加成功')
    }
    modalVisible.value = false
    await loadData()
  } catch (error) {
    console.error(error)
    message.error(editingId.value != null ? '更新失败' : '添加失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await geoKeywordApi.delete(id)
    message.success('删除成功')
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('删除失败')
  }
}

async function handleCheck(record: GeoSeoKeywordRank) {
  if (!record.id) return
  checkingId.value = record.id
  try {
    await geoKeywordApi.check(record.id)
    message.success('排名检查已完成')
    await loadData()
  } catch (error) {
    console.error(error)
    message.error('排名检查失败')
  } finally {
    checkingId.value = null
  }
}

async function loadData() {
  loading.value = true
  try {
    const params = searchEngineFilter.value ? { searchEngine: searchEngineFilter.value } : undefined
    const result = await geoKeywordApi.list(params)
    keywords.value = Array.isArray(result) ? result : []
    pagination.total = keywords.value.length
  } catch (error) {
    console.error(error)
    message.error('加载关键词列表失败')
    keywords.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.geoseo-keyword-view {
  width: 100%;
}

.alert-content {
  p {
    margin: 0;
    line-height: 1.8;
  }
}

.filter-bar {
  margin-bottom: 16px;
}

.filter-label {
  color: #595959;
}

.keyword-text {
  font-weight: 500;
  color: #1a1a1a;
}

.rank-text {
  font-weight: 600;
  font-size: 14px;
}

.rank-change {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  .prev-rank {
    color: #595959;
  }

  .rank-change-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    line-height: 1;

    &.change-improved {
      color: #52c41a;
    }

    &.change-declined {
      color: #f5222d;
    }

    &.change-same {
      color: #bfbfbf;
    }
  }
}

.tracked-url {
  color: #1890ff;
  word-break: break-all;
}

.checked-at {
  color: #595959;
  font-size: 13px;
}

.empty-text {
  color: #bfbfbf;
}
</style>
