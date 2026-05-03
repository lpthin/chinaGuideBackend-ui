<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'

import { formatTime } from '@/utils/format'
import { ElMessage } from 'element-plus'
import { listNotificationsApi, markNotificationReadApi } from '@/api/notifications'
import { useSiteStore } from '@/stores/site'
import type { Notification } from '@/types/api'

const siteStore = useSiteStore()
const currentSiteId = computed(() => siteStore.currentSite?.id || siteStore.currentSiteId)
const loading = ref(false)
const notifications = ref<Notification[]>([])

async function load() {
  if (!currentSiteId.value) return
  loading.value = true
  try { notifications.value = await listNotificationsApi(currentSiteId.value) }
  finally { loading.value = false }
}

async function markRead(row: Notification) {
  if (!currentSiteId.value || !row.id) return
  try {
    const updated = await markNotificationReadApi(currentSiteId.value, row.id)
    Object.assign(row, updated)
    ElMessage.success('已标记已读')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作失败') }
}

watchEffect(() => { if (currentSiteId.value) load() })
</script>

<template>
  <div>
    <div class="page-header"><div><h2>站内提醒</h2><p>查看线索等系统事件通知。</p></div><el-button @click="load">刷新</el-button></div>
    <el-table v-loading="loading" :data="notifications" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="标题" width="220" />
      <el-table-column prop="content" label="内容" min-width="320" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="120" />
      <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'read' ? 'info' : 'warning'">{{ row.status === 'read' ? '已读' : '未读' }}</el-tag></template></el-table-column>
      <el-table-column prop="createdAt" label="时间" width="180" />
      <el-table-column label="操作" width="120"><template #default="{ row }"><el-button v-if="row.status !== 'read'" size="small" @click="markRead(row)">标记已读</el-button></template></el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.page-header h2{margin:0 0 6px}.page-header p{margin:0;color:#64748b}
</style>
