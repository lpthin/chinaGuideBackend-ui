<template>
  <div class="system-prompt-panel">
    <div class="panel-header">
      <h3>系统Prompt模板管理</h3>
      <a-button type="primary" @click="openModal()">
        <template #icon><PlusOutlined /></template>
        新建模板
      </a-button>
    </div>
    <a-table
  :scroll="{ x: 'max-content' }"
  :data-source="templates"
  :loading="loading"
  :pagination="pagination"
  row-key="id"
  @change="handleTableChange"
>
      <!-- 这一屏的空会被读成「系统一条提示词模板都没有」，所以是哪一种空只认后端（M-P78）。
           新建的入口只在「真的没有」那一档摆：读失败与翻过头都不是「这一档还空着」。 -->
      <template #emptyText>
        <empty-list-hint
          :loading="loading"
          :read-failed="readFailed"
          :empty-line="emptyLine"
          :empty-reason="emptyReason"
          can-create
          create-label="新建模板"
          @create="openModal()"
        />
      </template>
  <a-table-column title="名称" data-index="name" width="200" />
  <a-table-column title="用途" width="150">
    <template #default="{ record }">{{ purposeName(record.purpose) }}</template>
  </a-table-column>
  <a-table-column title="版本" data-index="version" width="100" />
  <a-table-column title="启用状态" data-index="enabled" width="100">
    <template #default="{ record }">
      <a-tag :color="record.enabled ? 'green' : 'red'">
        {{ record.enabled ? '启用' : '禁用' }}
      </a-tag>
    </template>
  </a-table-column>
  <a-table-column title="更新时间" width="180">
    <template #default="{ record }">{{ formatDateTime(record.updatedAt) }}</template>
  </a-table-column>
  <a-table-column title="操作" width="200">
    <template #default="{ record }">
      <a-space>
        <a-button type="link" size="small" @click="openModal(record)">编辑</a-button>
        <a-popconfirm title="确认删除？" @confirm="deleteTemplate(record.id!)">
          <a-button type="link" size="small" danger>删除</a-button>
        </a-popconfirm>
      </a-space>
    </template>
  </a-table-column>
</a-table>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑模板' : '新建模板'"
      @ok="handleSave"
      @cancel="closeModal"
      :confirmLoading="saving"
      width="800px"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="名称" required>
          <a-input v-model:value="form.name" placeholder="请输入模板名称" />
        </a-form-item>
        <a-form-item label="用途" required>
          <a-select v-model:value="form.purpose" placeholder="请选择用途">
            <a-select-option value="keyword_distill">关键词蒸馏</a-select-option>
            <a-select-option value="article_draft">文章草稿</a-select-option>
            <a-select-option value="article_review">文章审核</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="版本" required>
          <a-input v-model:value="form.version" placeholder="例如 v1" />
        </a-form-item>
        <a-form-item label="Prompt内容" required>
          <a-textarea
            v-model:value="form.templateText"
            :rows="12"
            placeholder="请输入Prompt内容，可使用{{变量}}占位符"
          />
        </a-form-item>
        <a-form-item label="启用状态">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { systemPromptApi } from '../../api'
import { describeHttpError } from '../../api/http'
import { formatDateTime } from '../../utils/format'
import type { PromptTemplate } from '../../types'
import { logError } from '../../utils/errorLog'
import EmptyListHint from '../../components/EmptyListHint.vue'
import {
  JUMP_BACK_NOTICE,
  asEmptyReason,
  shouldJumpBackToFirstPage,
  type EmptyReason,
} from '../../utils/emptyPage'

const purposeNames: Record<string, string> = {
  keyword_distill: '关键词蒸馏',
  article_draft: '文章草稿',
  article_review: '文章审核'
}

function purposeName(purpose?: string) {
  if (!purpose) return '-'
  return purposeNames[purpose] || purpose
}

const templates = ref<PromptTemplate[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)
const readFailed = ref('')

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const form = ref<PromptTemplate>({
  name: '',
  purpose: '',
  version: 'v1',
  templateText: '',
  enabled: true
})

const fetchTemplates = async () => {
  loading.value = true
  emptyLine.value = ''
  emptyReason.value = null
  readFailed.value = ''
  try {
    const res = await systemPromptApi.list({
      page: pagination.current,
      size: pagination.pageSize,
    })
    templates.value = res.records || []
    pagination.total = res.total || 0
    emptyLine.value = res.emptyLine || ''
    emptyReason.value = asEmptyReason(res.emptyReason)
    // 「这一页翻过了头」不是一句解释就完事：翻回第一页再读一遍，最多多发一发
    if (shouldJumpBackToFirstPage(emptyReason.value, pagination.current)) {
      pagination.current = 1
      await fetchTemplates()
      message.info(JUMP_BACK_NOTICE)
    }
  } catch (e) {
    logError('workspace/system-prompt-panel', 'fetchTemplates error:', e)
    // 读失败与「这一档没有行」是两件事：旧行必须清掉，否则界面会把上一批行继续当成这一发的读数
    templates.value = []
    pagination.total = 0
    readFailed.value = describeHttpError(e)
    message.error(`获取模板列表失败：${describeHttpError(e)}`)
  } finally {
    loading.value = false
  }
}

const handleTableChange = (pag: any) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchTemplates()
}

const openModal = (record?: PromptTemplate) => {
  if (record) {
    editingId.value = record.id!
    form.value = { ...record }
  } else {
    editingId.value = null
    form.value = {
      name: '',
      purpose: '',
      version: 'v1',
      templateText: '',
      enabled: true
    }
  }
  modalOpen.value = true
}

const closeModal = () => {
  modalOpen.value = false
  editingId.value = null
}

const handleSave = async () => {
  if (!form.value.name || !form.value.purpose || !form.value.templateText) {
    message.warning('请填写完整信息')
    return
  }
  
  saving.value = true
  try {
    if (editingId.value) {
      await systemPromptApi.update(editingId.value, form.value)
      message.success('更新成功')
    } else {
      await systemPromptApi.create(form.value)
      message.success('创建成功')
    }
    closeModal()
    fetchTemplates()
  } catch (e) {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

const deleteTemplate = async (id: number) => {
  try {
    await systemPromptApi.delete(id)
    message.success('删除成功')
    fetchTemplates()
  } catch (e) {
    message.error('删除失败')
  }
}

onMounted(fetchTemplates)
</script>

<style scoped>
.system-prompt-panel {
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.panel-header h3 {
  margin: 0;
}
</style>
