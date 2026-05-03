<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { listLeadsApi, updateLeadStatusApi } from '@/api/forms'
import { useSiteStore } from '@/stores/site'
import type { LeadSubmission } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const loading = ref(false)
const leads = ref<LeadSubmission[]>([])

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { leads.value = await listLeadsApi(currentSiteId.value) }
  finally { loading.value = false }
}

async function updateStatus(row: LeadSubmission, status: string) {
  if (!row.id) return
  try {
    const updated = await updateLeadStatusApi(row.id, status)
    Object.assign(row, updated)
    ElMessage.success('状态已更新')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作失败') }
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header"><div><h2>线索管理</h2><p>查看前台表单提交，跟进咨询状态。</p></div></div>
    <el-table v-loading="loading" :data="leads" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="formId" label="表单ID" width="90" />
      <el-table-column prop="contactName" label="姓名" width="120" />
      <el-table-column prop="contactEmail" label="邮箱" width="200" />
      <el-table-column prop="contactPhone" label="电话" width="150" />
      <el-table-column prop="sourcePage" label="来源页" width="200" show-overflow-tooltip />
      <el-table-column prop="payloadJson" label="提交内容" min-width="260" show-overflow-tooltip />
      <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'done' ? 'success' : row.status === 'invalid' ? 'danger' : 'warning'">{{ row.status || 'new' }}</el-tag></template></el-table-column>
      <el-table-column prop="createdAt" label="提交时间" width="180" />
      <el-table-column label="操作" width="220"><template #default="{ row }"><el-button size="small" @click="updateStatus(row, 'processing')">跟进中</el-button><el-button size="small" type="success" @click="updateStatus(row, 'done')">完成</el-button><el-button size="small" type="danger" @click="updateStatus(row, 'invalid')">无效</el-button></template></el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}
</style>
