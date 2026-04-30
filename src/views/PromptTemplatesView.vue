<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { createPromptTemplateApi, listPromptTemplatesApi, updatePromptTemplateApi } from '@/api/prompts'
import { getAiCallStatsApi, listAiCallLogsApi } from '@/api/aiLogs'
import { useSiteStore } from '@/stores/site'
import type { AiCallLog, AiCallStats, PromptTemplate } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id)
const loading = ref(false)
const saving = ref(false)
const templates = ref<PromptTemplate[]>([])
const logs = ref<AiCallLog[]>([])
const stats = ref<AiCallStats | null>(null)
const selectedId = ref<number | 'new' | null>(null)
const form = reactive<PromptTemplate>({ purpose: 'article_draft', version: 'v1', name: '', templateText: '', enabled: true })
const selectedTemplate = computed(() => templates.value.find((item) => item.id === selectedId.value))
const isGlobalTemplate = computed(() => selectedTemplate.value?.siteId == null && selectedId.value !== 'new')

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try {
    const [templateRows, logRows, statRows] = await Promise.all([
      listPromptTemplatesApi(currentSiteId.value),
      listAiCallLogsApi(currentSiteId.value),
      getAiCallStatsApi(currentSiteId.value)
    ])
    templates.value = templateRows
    logs.value = logRows
    stats.value = statRows
    if (!selectedId.value && templates.value[0]?.id) selectTemplate(templates.value[0])
  } finally { loading.value = false }
}

function selectTemplate(template: PromptTemplate) {
  selectedId.value = template.id || null
  Object.assign(form, { ...template })
}

function newTemplate() {
  selectedId.value = 'new'
  Object.assign(form, { purpose: 'article_draft', version: 'v1', name: '', templateText: '', enabled: true })
}

function cloneGlobal(template: PromptTemplate) {
  selectedId.value = 'new'
  Object.assign(form, {
    purpose: template.purpose,
    version: template.version || 'v1',
    name: `${template.name}（站点覆盖）`,
    templateText: template.templateText,
    enabled: true
  })
}

async function save() {
  if (!currentSiteId.value) return
  if (!form.purpose || !form.name || !form.templateText) {
    ElMessage.warning('请填写 purpose、名称和模板内容')
    return
  }
  saving.value = true
  try {
    if (selectedId.value === 'new' || !form.id) {
      const saved = await createPromptTemplateApi(currentSiteId.value, form)
      ElMessage.success('Prompt 模板已创建')
      await load()
      selectTemplate(saved)
    } else {
      const saved = await updatePromptTemplateApi(currentSiteId.value, form.id, form)
      ElMessage.success('Prompt 模板已保存')
      await load()
      selectTemplate(saved)
    }
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '保存失败') }
  finally { saving.value = false }
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header">
      <div><h2>Prompt 模板</h2><p>管理关键词蒸馏、文章生成和 AI 审核使用的提示词模板。</p></div>
      <el-button type="primary" @click="newTemplate">新建站点模板</el-button>
    </div>
    <el-row :gutter="16">
      <el-col :span="9">
        <el-card>
          <template #header>模板列表</template>
          <el-table v-loading="loading" :data="templates" border height="620" @row-click="selectTemplate">
            <el-table-column prop="purpose" label="Purpose" width="150" />
            <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="范围" width="80"><template #default="{ row }"><el-tag :type="row.siteId ? 'success' : 'info'">{{ row.siteId ? '站点' : '全局' }}</el-tag></template></el-table-column>
            <el-table-column label="启用" width="70"><template #default="{ row }">{{ row.enabled ? '是' : '否' }}</template></el-table-column>
            <el-table-column label="操作" width="90"><template #default="{ row }"><el-button v-if="!row.siteId" size="small" @click.stop="cloneGlobal(row)">复制</el-button></template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="15">
        <el-card>
          <template #header>模板编辑</template>
          <el-alert v-if="isGlobalTemplate" title="全局默认模板不可直接编辑，可点击左侧复制为当前站点模板后修改。" type="info" show-icon class="mb" />
          <el-form label-width="90px">
            <el-form-item label="Purpose"><el-input v-model="form.purpose" :disabled="isGlobalTemplate" placeholder="article_draft" /></el-form-item>
            <el-form-item label="版本"><el-input v-model="form.version" :disabled="isGlobalTemplate" /></el-form-item>
            <el-form-item label="名称"><el-input v-model="form.name" :disabled="isGlobalTemplate" /></el-form-item>
            <el-form-item label="启用"><el-switch v-model="form.enabled" :disabled="isGlobalTemplate" /></el-form-item>
            <el-form-item label="模板内容"><el-input v-model="form.templateText" :disabled="isGlobalTemplate" type="textarea" :rows="18" /></el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" :disabled="isGlobalTemplate" @click="save">保存</el-button>
            </el-form-item>
          </el-form>
          <el-alert title="可用变量：keyword_distill 使用 {{keywords}}；article_draft 使用 {{clusterName}}、{{searchIntent}}、{{articleDirection}}；article_review 使用 {{title}}、{{summary}}、{{contentMd}}。" type="warning" show-icon />
        </el-card>
      </el-col>
    </el-row>
    <el-card class="log-card">
      <template #header>AI 调用统计</template>
      <el-row :gutter="12" class="stat-row">
        <el-col :span="6"><el-statistic title="总调用" :value="stats?.totalCalls || 0" /></el-col>
        <el-col :span="6"><el-statistic title="成功" :value="stats?.successCalls || 0" /></el-col>
        <el-col :span="6"><el-statistic title="失败" :value="stats?.failedCalls || 0" /></el-col>
        <el-col :span="6"><el-statistic title="估算 Token" :value="stats?.totalTokens || 0" /></el-col>
      </el-row>
      <el-table :data="logs" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="purpose" label="Purpose" width="150" />
        <el-table-column prop="provider" label="Provider" width="110" />
        <el-table-column prop="model" label="模型" width="130" />
        <el-table-column label="结果" width="90"><template #default="{ row }"><el-tag :type="row.success ? 'success' : 'danger'">{{ row.success ? '成功' : '失败' }}</el-tag></template></el-table-column>
        <el-table-column prop="tokenEstimate" label="Token" width="100" />
        <el-table-column prop="outputSummary" label="输出摘要" min-width="220" show-overflow-tooltip />
        <el-table-column prop="errorMessage" label="错误" min-width="180" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}.mb{margin-bottom:16px}.log-card{margin-top:16px}.stat-row{margin-bottom:16px}
</style>
