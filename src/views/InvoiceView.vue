<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Download, Plus, Delete } from '@element-plus/icons-vue'
import { getInvoicesApi, createInvoiceApi, downloadInvoiceApi, deleteInvoiceApi, type Invoice, type InvoiceRequest } from '@/api/tenants'

const loading = ref(false)
const invoices = ref<Invoice[]>([])
const dialogVisible = ref(false)
const downloadLoading = ref<number | null>(null)

const invoiceForm = ref<InvoiceRequest>({
  title: '',
  taxNumber: '',
  bankName: '',
  bankAccount: '',
  address: '',
  phone: '',
  email: '',
  amount: 0,
  type: 'normal',
  content: ''
})

onMounted(async () => {
  await loadInvoices()
})

async function loadInvoices() {
  loading.value = true
  try {
    invoices.value = await getInvoicesApi()
  } catch (error) {
    ElMessage.error('加载发票列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  invoiceForm.value = {
    title: '',
    taxNumber: '',
    bankName: '',
    bankAccount: '',
    address: '',
    phone: '',
    email: '',
    amount: 0,
    type: 'normal',
    content: 'SaaS服务费'
  }
  dialogVisible.value = true
}

async function createInvoice() {
  if (!invoiceForm.value.title) {
    ElMessage.warning('请填写发票抬头')
    return
  }
  if (!invoiceForm.value.amount || invoiceForm.value.amount <= 0) {
    ElMessage.warning('请填写正确的金额')
    return
  }

  loading.value = true
  try {
    await createInvoiceApi(invoiceForm.value)
    ElMessage.success('发票申请成功')
    dialogVisible.value = false
    await loadInvoices()
  } catch (error) {
    ElMessage.error('申请失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function downloadInvoice(invoice: Invoice) {
  if (!invoice.id) return

  downloadLoading.value = invoice.id
  try {
    const path = await downloadInvoiceApi(invoice.id)
    ElMessage.success(`发票文件路径: ${path}`)
  } catch (error) {
    ElMessage.error('下载失败')
    console.error(error)
  } finally {
    downloadLoading.value = null
  }
}

async function deleteInvoice(invoice: Invoice) {
  if (!invoice.id) return

  try {
    await ElMessageBox.confirm('确定要删除此发票申请吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deleteInvoiceApi(invoice.id)
    ElMessage.success('删除成功')
    await loadInvoices()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
      console.error(error)
    }
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function formatAmount(amount?: number): string {
  if (amount == null) return '¥0.00'
  return `¥${amount.toFixed(2)}`
}

function getStatusType(status?: string): string {
  const map: Record<string, string> = {
    pending: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status || ''] || 'info'
}

function getStatusText(status?: string): string {
  const map: Record<string, string> = {
    pending: '处理中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status || ''] || status || '-'
}

function getTypeText(type?: string): string {
  return type === 'vat' ? '增值税专用发票' : '普通发票'
}
</script>

<template>
  <div class="invoice-page" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <span class="page-title">发票管理</span>
      </template>
    </el-page-header>

    <div class="page-header">
      <h2>发票申请</h2>
      <p>申请和管理您的发票</p>
    </div>

    <el-card class="action-card">
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        申请发票
      </el-button>
    </el-card>

    <el-card class="invoice-list-card">
      <template #header>
        <span>发票列表</span>
      </template>

      <el-table :data="invoices" style="width: 100%">
        <el-table-column prop="invoiceNumber" label="发票号码" width="200" />
        <el-table-column prop="title" label="发票抬头" min-width="150" />
        <el-table-column prop="type" label="类型" width="140">
          <template #default="{ row }">{{ getTypeText(row.type) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">
            <span class="amount-text">{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="申请时间" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              link 
              size="small" 
              :loading="downloadLoading === row.id"
              @click="downloadInvoice(row)"
            >
              <el-icon><Download /></el-icon>
              下载
            </el-button>
            <el-button type="danger" link size="small" @click="deleteInvoice(row)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="invoices.length === 0" description="暂无发票记录" />
    </el-card>

    <el-dialog v-model="dialogVisible" title="申请发票" width="600px" destroy-on-close>
      <el-form :model="invoiceForm" label-width="120px">
        <el-form-item label="发票抬头" required>
          <el-input v-model="invoiceForm.title" placeholder="请输入发票抬头" />
        </el-form-item>

        <el-form-item label="发票类型">
          <el-radio-group v-model="invoiceForm.type">
            <el-radio label="normal">普通发票</el-radio>
            <el-radio label="vat">增值税专用发票</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="纳税人识别号">
          <el-input v-model="invoiceForm.taxNumber" placeholder="请输入纳税人识别号" />
        </el-form-item>

        <el-form-item label="发票金额" required>
          <el-input-number 
            v-model="invoiceForm.amount" 
            :min="0" 
            :precision="2" 
            :step="100"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="发票内容">
          <el-input v-model="invoiceForm.content" placeholder="如：SaaS服务费" />
        </el-form-item>

        <template v-if="invoiceForm.type === 'vat'">
          <el-divider>开票信息</el-divider>

          <el-form-item label="注册地址">
            <el-input v-model="invoiceForm.address" placeholder="请输入注册地址" />
          </el-form-item>

          <el-form-item label="电话号码">
            <el-input v-model="invoiceForm.phone" placeholder="请输入电话号码" />
          </el-form-item>

          <el-form-item label="开户银行">
            <el-input v-model="invoiceForm.bankName" placeholder="请输入开户银行" />
          </el-form-item>

          <el-form-item label="银行账号">
            <el-input v-model="invoiceForm.bankAccount" placeholder="请输入银行账号" />
          </el-form-item>
        </template>

        <el-form-item label="接收邮箱">
          <el-input v-model="invoiceForm.email" placeholder="发票将发送到此邮箱" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createInvoice" :loading="loading">
          提交申请
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.invoice-page {
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

.action-card {
  margin-bottom: 24px;
}

.invoice-list-card {
  margin-bottom: 24px;
}

.amount-text {
  font-weight: 600;
  color: #409eff;
  font-size: 16px;
}
</style>
