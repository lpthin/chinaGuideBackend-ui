<template>
  <a-drawer
    :open="open"
    title="案例详情"
    placement="right"
    :width="900"
    @update:open="emit('update:open', $event)"
    @close="handleClose"
  >
    <template #extra>
      <a-space>
        <a-button @click="handleClose">取消</a-button>
        <a-button type="primary" @click="handleSave">保存</a-button>
      </a-space>
    </template>

    <a-spin :spinning="loading">
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
      >
        <a-row :gutter="24">
          <a-col :span="18">
            <a-form-item label="案例标题" name="title">
              <a-input
                v-model:value="formState.title"
                placeholder="请输入案例标题"
                :disabled="isReadonly"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="分类" name="categoryId">
              <a-select
                v-model:value="formState.categoryId"
                placeholder="请选择分类"
                :disabled="isReadonly"
              >
                <a-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="24">
          <a-col :span="8">
            <a-form-item label="案例类型" name="type">
              <a-select
                v-model:value="formState.type"
                placeholder="请选择类型"
                :disabled="isReadonly"
              >
                <a-select-option :value="CaseType.CUSTOMER_SUCCESS">客户成功</a-select-option>
                <a-select-option :value="CaseType.TECHNICAL_IMPLEMENTATION">技术实施</a-select-option>
                <a-select-option :value="CaseType.BEST_PRACTICE">最佳实践</a-select-option>
                <a-select-option :value="CaseType.INDUSTRY_SOLUTION">行业方案</a-select-option>
                <a-select-option :value="CaseType.PRODUCT_DEMO">产品演示</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="优先级" name="priority">
              <a-select
                v-model:value="formState.priority"
                placeholder="请选择优先级"
                :disabled="isReadonly"
              >
                <a-select-option :value="CasePriority.LOW">低</a-select-option>
                <a-select-option :value="CasePriority.MEDIUM">中</a-select-option>
                <a-select-option :value="CasePriority.HIGH">高</a-select-option>
                <a-select-option :value="CasePriority.URGENT">紧急</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态" name="status">
              <a-select
                v-model:value="formState.status"
                placeholder="请选择状态"
                :disabled="isReadonly"
              >
                <a-select-option :value="CaseStatus.DRAFT">草稿</a-select-option>
                <a-select-option :value="CaseStatus.REVIEWING">审核中</a-select-option>
                <a-select-option :value="CaseStatus.APPROVED">已通过</a-select-option>
                <a-select-option :value="CaseStatus.PUBLISHED">已发布</a-select-option>
                <a-select-option :value="CaseStatus.ARCHIVED">已归档</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="案例摘要" name="summary">
          <a-textarea
            v-model:value="formState.summary"
            placeholder="请输入案例摘要"
            :rows="3"
            :disabled="isReadonly"
          />
        </a-form-item>

        <a-divider>客户信息</a-divider>

        <a-row :gutter="24">
          <a-col :span="8">
            <a-form-item label="客户名称" name="customerName">
              <a-input
                v-model:value="formState.customerName"
                placeholder="请输入客户名称"
                :disabled="isReadonly"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="所属行业" name="customerIndustry">
              <a-select
                v-model:value="formState.customerIndustry"
                placeholder="请选择行业"
                allowClear
                :disabled="isReadonly"
              >
                <a-select-option value="金融">金融</a-select-option>
                <a-select-option value="电商">电商</a-select-option>
                <a-select-option value="教育">教育</a-select-option>
                <a-select-option value="医疗">医疗</a-select-option>
                <a-select-option value="制造">制造</a-select-option>
                <a-select-option value="零售">零售</a-select-option>
                <a-select-option value="其他">其他</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="企业规模" name="customerScale">
              <a-select
                v-model:value="formState.customerScale"
                placeholder="请选择规模"
                allowClear
                :disabled="isReadonly"
              >
                <a-select-option value="小型企业">小型企业</a-select-option>
                <a-select-option value="中型企业">中型企业</a-select-option>
                <a-select-option value="大型企业">大型企业</a-select-option>
                <a-select-option value="超大型企业">超大型企业</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider>案例内容</a-divider>

        <a-form-item label="案例内容" name="content">
          <div v-if="isReadonly" class="content-preview" v-html="formState.content"></div>
          <div v-else class="editor-container">
            <a-textarea
              v-model:value="formState.content"
              placeholder="请输入案例内容"
              :rows="15"
            />
          </div>
        </a-form-item>

        <a-form-item label="标签">
          <a-select
            v-model:value="selectedTags"
            mode="tags"
            placeholder="请输入标签"
            :disabled="isReadonly"
            style="width: 100%"
          >
            <a-select-option v-for="tag in hotTags" :key="tag" :value="tag">
              {{ tag }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="封面图片">
          <a-upload
            list-type="picture-card"
            :max-count="1"
            :disabled="isReadonly"
            @preview="handlePreview"
          >
            <div v-if="!formState.coverImage">
              <plus-outlined />
              <div style="margin-top: 8px">上传封面</div>
            </div>
          </a-upload>
        </a-form-item>

        <a-divider v-if="caseData">统计信息</a-divider>

        <a-row v-if="caseData" :gutter="24">
          <a-col :span="6">
            <a-statistic title="浏览量" :value="caseData.viewCount" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="点赞数" :value="caseData.likeCount" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="分享数" :value="caseData.shareCount" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="下载数" :value="caseData.downloadCount" />
          </a-col>
        </a-row>
      </a-form>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { CaseStatus, CasePriority, CaseType } from '../../types/case'
import type { Case, CaseCategory } from '../../types/case'

const props = defineProps<{
  open: boolean
  caseId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'success'): void
}>()

const loading = ref(false)
const formRef = ref()
const caseData = ref<Case | null>(null)

const selectedTags = ref<string[]>([])

const hotTags = [
  '数字化转型',
  'AI应用',
  '最佳实践',
  '客户成功',
  '技术创新',
  '效率提升',
  '降本增效',
  '解决方案',
]

const categories = ref<CaseCategory[]>([
  { id: 1, tenantId: 1, name: '金融科技', icon: '', description: '', sort: 1, status: 'active', caseCount: 15, createdAt: '', updatedAt: '' },
  { id: 2, tenantId: 1, name: '电子商务', icon: '', description: '', sort: 2, status: 'active', caseCount: 12, createdAt: '', updatedAt: '' },
  { id: 3, tenantId: 1, name: '在线教育', icon: '', description: '', sort: 3, status: 'active', caseCount: 8, createdAt: '', updatedAt: '' },
  { id: 4, tenantId: 1, name: '医疗健康', icon: '', description: '', sort: 4, status: 'active', caseCount: 10, createdAt: '', updatedAt: '' },
])

const formState = reactive({
  tenantId: 1,
  categoryId: 1,
  title: '',
  summary: '',
  content: '',
  type: CaseType.CUSTOMER_SUCCESS,
  priority: CasePriority.MEDIUM,
  status: CaseStatus.DRAFT,
  customerName: '',
  customerIndustry: '',
  customerScale: '',
  coverImage: '',
  tags: '',
})

const rules = {
  title: [{ required: true, message: '请输入案例标题', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  summary: [{ required: true, message: '请输入案例摘要', trigger: 'blur' }],
  content: [{ required: true, message: '请输入案例内容', trigger: 'blur' }],
}

const isReadonly = computed(() => {
  return !!props.caseId
})

watch(() => props.open, (newVal) => {
  if (newVal) {
    if (props.caseId) {
      loadCaseData(props.caseId)
    } else {
      resetForm()
    }
  }
})

function resetForm() {
  caseData.value = null
  formState.tenantId = 1
  formState.categoryId = 1
  formState.title = ''
  formState.summary = ''
  formState.content = ''
  formState.type = CaseType.CUSTOMER_SUCCESS
  formState.priority = CasePriority.MEDIUM
  formState.status = CaseStatus.DRAFT
  formState.customerName = ''
  formState.customerIndustry = ''
  formState.customerScale = ''
  formState.coverImage = ''
  formState.tags = ''
  selectedTags.value = []
}

function loadCaseData(id: number) {
  loading.value = true
  setTimeout(() => {
    const mockCase: Case = {
      id,
      tenantId: 1,
      categoryId: 1,
      categoryName: '金融科技',
      title: '某大型银行数字化转型解决方案',
      summary: '帮助银行实现核心系统重构和数字化转型，提升业务效率，降低运营成本。',
      content: `
        <h3>项目背景</h3>
        <p>该银行作为国内领先的商业银行，面临着数字化转型的迫切需求。随着金融科技的快速发展，传统的核心系统已经无法满足业务发展的需要。</p>
        
        <h3>解决方案</h3>
        <p>我们提供了一套完整的数字化转型解决方案，包括：</p>
        <ul>
          <li>核心系统重构：采用微服务架构，实现系统的高可用和弹性扩展</li>
          <li>移动银行升级：打造全新的移动银行APP，提供丰富的金融服务</li>
          <li>数据中台建设：建立统一的数据平台，支持大数据分析和AI应用</li>
          <li>智能客服系统：引入AI客服，提升客户服务效率</li>
        </ul>
        
        <h3>实施成果</h3>
        <p>项目上线后，取得了显著的成果：</p>
        <ul>
          <li>系统响应时间缩短60%</li>
          <li>业务处理效率提升80%</li>
          <li>运营成本降低40%</li>
          <li>客户满意度提升35%</li>
        </ul>
      `,
      tags: '数字化转型,核心系统,金融科技',
      tagList: ['数字化转型', '核心系统', '金融科技'],
      viewCount: 15680,
      likeCount: 428,
      shareCount: 89,
      downloadCount: 156,
      authorId: 1,
      authorName: '张三',
      createdAt: '2024-03-10 10:30:00',
      updatedAt: '2024-03-15 14:20:00',
    }
    caseData.value = mockCase
    formState.categoryId = mockCase.categoryId
    formState.title = mockCase.title
    formState.summary = mockCase.summary
    formState.content = mockCase.content
    formState.type = mockCase.type
    formState.priority = mockCase.priority
    formState.status = mockCase.status
    formState.customerName = mockCase.customerName || '中国工商银行'
    formState.customerIndustry = mockCase.customerIndustry || '金融'
    formState.customerScale = mockCase.customerScale || '大型企业'
    selectedTags.value = mockCase.tagList || []
    loading.value = false
  }, 500)
}

function handleClose() {
  emit('update:open', false)
}

function handleSave() {
  formRef.value?.validate().then(() => {
    message.success(props.caseId ? '更新成功' : '创建成功')
    emit('success')
    emit('update:open', false)
  })
}

function handlePreview(file: any) {
  console.log('preview', file)
}
</script>

<style scoped lang="less">
.content-preview {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  min-height: 200px;

  h3 {
    margin: 16px 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
  }

  p {
    margin: 8px 0;
    line-height: 1.6;
    color: #595959;
  }

  ul {
    margin: 8px 0;
    padding-left: 24px;

    li {
      margin: 4px 0;
      line-height: 1.6;
      color: #595959;
    }
  }
}

.editor-container {
  :deep(.ant-input) {
    font-family: 'Monaco', 'Menlo', monospace;
  }
}
</style>
