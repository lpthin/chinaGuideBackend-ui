<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Clock, Search, Refresh } from '@element-plus/icons-vue'
import { getAuditLogsApi, type AuditLog } from '@/api/tenants'

const loading = ref(false)
const auditLogs = ref<AuditLog[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const filters = ref({
  action: '',
  resource: ''
})

onMounted(async () => {
  await loadLogs()
})

async function loadLogs() {
  loading.value = true
  try {
    const result = await getAuditLogsApi({
      page: currentPage.value,
      size: pageSize.value
    })
    auditLogs.value = result.records || []
    total.value = result.total || 0
  } catch (error) {
    ElMessage.error('加载审计日志失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadLogs()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadLogs()
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function getMethodType(method?: string): string {
  const map: Record<string, string> = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'danger'
  }
  return map[method || ''] || 'info'
}
</script>

<template>
  <div class="audit-logs-page" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <span class="page-title">审计日志</span>
      </template>
    </el-page-header>

    <div class="page-header">
      <h2>操作审计日志</h2>
      <p>查看系统操作记录</p>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="操作类型">
          <el-select v-model="filters.action" placeholder="全部" clearable style="width: 150px">
            <el-option label="创建" value="create" />
            <el-option label="更新" value="update" />
            <el-option label="删除" value="delete" />
            <el-option label="查询" value="get" />
          </el-select>
        </el-form-item>
        <el-form-item label="资源">
          <el-select v-model="filters.resource" placeholder="全部" clearable style="width: 150px">
            <el-option label="文章" value="Article" />
            <el-option label="关键词" value="Keyword" />
            <el-option label="用户" value="User" />
            <el-option label="租户" value="Tenant" />
            <el-option label="套餐" value="Plan" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadLogs">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="filters = { action: '', resource: '' }; loadLogs()">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="logs-card">
      <template #header>
        <div class="card-header">
          <span>日志列表</span>
          <span class="total-count">共 {{ total }} 条</span>
        </div>
      </template>

      <el-table :data="auditLogs" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="action" label="操作" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="resource" label="资源" width="120" />
        <el-table-column prop="method" label="方法" width="100">
          <template #default="{ row }">
            <el-tag :type="getMethodType(row.method)" size="small">
              {{ row.method }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ipAddress" label="IP地址" width="140" />
        <el-table-column prop="duration" label="耗时(ms)" width="100" />
        <el-table-column prop="responseStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.responseStatus === '200' ? 'success' : 'danger'" size="small">
              {{ row.responseStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
        class="pagination"
      />

      <el-empty v-if="auditLogs.length === 0" description="暂无审计日志" />
    </el-card>
  </div>
</template>

<style scoped>
.audit-logs-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 0;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.page-header {
  text-align: center;
  margin: 30px 0;
}

.page-header h2 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 8px;
}

.page-header p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.filter-card {
  margin-bottom: 24px;
}

.filter-form {
  margin-bottom: 0;
}

.logs-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total-count {
  color: #909399;
  font-size: 14px;
}

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
</style>
