<template>
  <div class="geoseo-competitor-view">
    <a-card title="竞品追踪" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          添加竞品
        </a-button>
      </template>

      <a-alert type="info" show-icon style="margin-bottom: 16px">
        <template #message>
          <div class="alert-content">
            <p>添加竞品后，系统会追踪竞品域名在搜索引擎中的关键词排名变化。</p>
            <p>在关键词排名页面可以查看您和竞品的排名对比。</p>
            <p>建议添加3-5个主要竞品进行持续追踪。</p>
          </div>
        </template>
      </a-alert>

      <a-table
        v-if="competitors.length"
        :data-source="competitors"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span class="competitor-name">{{ record.name }}</span>
          </template>
          <template v-if="column.key === 'domain'">
            <a :href="'https://' + record.domain" target="_blank" rel="noopener noreferrer">
              {{ record.domain }}
            </a>
          </template>
          <template v-if="column.key === 'trackingKeywords'">
            <template v-if="parseKeywords(record.trackingKeywords).length">
              <a-tag
                v-for="(kw, idx) in parseKeywords(record.trackingKeywords)"
                :key="idx"
                color="blue"
              >
                {{ kw }}
              </a-tag>
            </template>
            <span v-else class="empty-text">-</span>
          </template>
          <template v-if="column.key === 'notes'">
            <span v-if="record.notes" class="notes-text">{{ record.notes }}</span>
            <span v-else class="empty-text">-</span>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确定要删除这个竞品吗？"
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
        v-else-if="!loading"
        description="暂无竞品数据，请添加您的第一个竞品开始追踪"
      >
        <a-button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          添加第一个竞品
        </a-button>
      </a-empty>
    </a-card>

    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑竞品' : '添加竞品'"
      :confirm-loading="saving"
      :mask-closable="false"
      :destroy-on-close="true"
      width="560px"
      @ok="handleSave"
    >
      <a-form layout="vertical" :model="formData">
        <a-form-item label="竞品名称" required>
          <a-input
            v-model:value="formData.name"
            placeholder="请输入竞品名称"
            :maxlength="100"
          />
        </a-form-item>
        <a-form-item label="竞品域名" required>
          <a-input
            v-model:value="formData.domain"
            placeholder="example.com (不含https://)"
            :maxlength="200"
          />
        </a-form-item>
        <a-form-item label="追踪关键词">
          <a-textarea
            v-model:value="formData.trackingKeywords"
            :rows="3"
            placeholder="每行一个关键词，或用逗号分隔"
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea
            v-model:value="formData.notes"
            :rows="3"
            placeholder="可填写竞品的优势、定位等信息"
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
import { geoCompetitorApi } from '../../api/geoseo'
import type { GeoSeoCompetitor } from '../../types/geoseo'

const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const editingId = ref<number | null>(null)
const competitors = ref<GeoSeoCompetitor[]>([])

const formData = reactive<GeoSeoCompetitor>({
  name: '',
  domain: '',
  trackingKeywords: '',
  notes: '',
})

const columns = [
  { title: '竞品名称', key: 'name', dataIndex: 'name', width: 180 },
  { title: '域名', key: 'domain', dataIndex: 'domain', width: 200 },
  { title: '追踪关键词', key: 'trackingKeywords', dataIndex: 'trackingKeywords' },
  { title: '备注', key: 'notes', dataIndex: 'notes', width: 220 },
  { title: '操作', key: 'actions', width: 140, fixed: 'right' as const },
]

function parseKeywords(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function resetForm() {
  editingId.value = null
  formData.name = ''
  formData.domain = ''
  formData.trackingKeywords = ''
  formData.notes = ''
}

function handleAdd() {
  resetForm()
  modalVisible.value = true
}

function handleEdit(record: GeoSeoCompetitor) {
  editingId.value = record.id ?? null
  formData.name = record.name || ''
  formData.domain = record.domain || ''
  formData.trackingKeywords = record.trackingKeywords || ''
  formData.notes = record.notes || ''
  modalVisible.value = true
}

async function handleSave() {
  if (!formData.name?.trim()) {
    message.error('请输入竞品名称')
    return
  }
  if (!formData.domain?.trim()) {
    message.error('请输入竞品域名')
    return
  }

  saving.value = true
  try {
    const payload: GeoSeoCompetitor = {
      name: formData.name.trim(),
      domain: formData.domain.trim(),
      trackingKeywords: formData.trackingKeywords || '',
      notes: formData.notes || '',
    }
    if (editingId.value != null) {
      await geoCompetitorApi.update(editingId.value, payload)
      message.success('更新成功')
    } else {
      await geoCompetitorApi.create(payload)
      message.success('添加成功')
    }
    modalVisible.value = false
    await loadData()
  } catch (error) {
    message.error(editingId.value != null ? '更新失败' : '添加失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await geoCompetitorApi.delete(id)
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
    const result = await geoCompetitorApi.list()
    competitors.value = Array.isArray(result) ? result : []
  } catch (error) {
    console.error(error)
    message.error('加载竞品列表失败')
    competitors.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.geoseo-competitor-view {
  width: 100%;
}

.alert-content {
  p {
    margin: 0;
    line-height: 1.8;
  }
}

.competitor-name {
  font-weight: 500;
  color: #1a1a1a;
}

.notes-text {
  color: #595959;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-text {
  color: #bfbfbf;
}
</style>
