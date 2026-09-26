<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { siteBriefsApi, vocabularyApi, type SiteBrief, type SiteBriefVocabulary } from '@/api/siteBriefs'
import { tenantApi } from '@/api/workspace'
import type { Tenant } from '@/types/workspace'

/**
 * 前采需求单列表（平台段 · 建站交付，Spec §3.2 / 任务 P1）。
 *
 * 状态列的中文只读后端词表的 `statusLabels`（唯一真相，I-1）：取不到就显示
 * 「状态未知（原码 draft）」把码原样带出来，绝不自己写第二份 draft→草稿 的映射去猜。
 * 演示内容档位的中文同理，只取自词表 `demoContentModes.label`，取不到就露码。
 * 列表为空时那句说明只承诺今天真存在的一步（录前采）；出方案/预览是 P3/P4，
 * 今天点不了，就不摆按钮。
 */

const router = useRouter()

const loading = ref(false)
const briefs = ref<SiteBrief[]>([])
const listError = ref('')

const tenants = ref<Tenant[]>([])
const tenantsFailed = ref(false)

const vocabulary = ref<SiteBriefVocabulary | null>(null)

const filterTenantId = ref<number | undefined>(undefined)
const filterStatus = ref('')

const tenantNames = computed(() => {
  const map: Record<number, string> = {}
  tenants.value.forEach(tenant => {
    if (tenant?.id != null) map[tenant.id] = tenant.name || tenant.code || `#${tenant.id}`
  })
  return map
})

const tenantFilterOptions = computed(() =>
  tenants.value.map(tenant => ({ value: tenant.id, label: tenant.name || tenant.code || `#${tenant.id}` }))
)

function tenantLabel(brief: SiteBrief): string {
  if (!brief.tenantId) return '未绑定租户'
  return tenantNames.value[brief.tenantId] || `租户 #${brief.tenantId}`
}

function demoModeLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const mode = vocabulary.value?.demoContentModes?.find(entry => entry.value === value)
  return mode ? mode.label : value
}

/**
 * 状态中文只读后端词表的 statusLabels（唯一真相）：命中就用，取不到把原码带出来，
 * 绝不在前端写第二份 draft→草稿 的映射去猜一个中文。
 */
function statusLabel(code: string | null | undefined): string {
  if (!code) return '状态未知（原码 ?）'
  const label = vocabulary.value?.statusLabels?.[code]
  return label || `状态未知（原码 ${code}）`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  loading.value = true
  listError.value = ''
  try {
    briefs.value = (await siteBriefsApi.list({
      tenantId: filterTenantId.value ?? null,
      status: filterStatus.value || null
    })) || []
  } catch (error) {
    briefs.value = []
    listError.value = error instanceof Error ? error.message : String(error)
    message.error(listError.value)
  } finally {
    loading.value = false
  }
}

async function loadAux() {
  try {
    tenants.value = (await tenantApi.list()) || []
    tenantsFailed.value = false
  } catch (error) {
    tenantsFailed.value = true
  }
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
  } catch (error) {
    // 词表只影响演示档位的中文显示：取不到就露码，不在这页弹错（列表本身更重要）
    vocabulary.value = null
  }
}

function onTenantFilterChange(value: unknown) {
  filterTenantId.value = value === null || value === undefined || value === '' ? undefined : Number(value)
  load()
}

function onStatusFilterChange(value: unknown) {
  filterStatus.value = value === null || value === undefined ? '' : String(value)
}

function createBrief() {
  router.push({ name: 'workspace-portal-brief-new' })
}

function editBrief(brief: SiteBrief) {
  router.push({ name: 'workspace-portal-brief-intake', params: { id: String(brief.id) } })
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '租户', key: 'tenant', width: 180 },
  { title: '状态', key: 'status', width: 140 },
  { title: '候选套数', dataIndex: 'candidateCount', key: 'candidateCount', width: 100 },
  { title: '演示内容', key: 'demoMode', width: 140 },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'op', width: 120 }
]

onMounted(() => {
  loadAux()
  load()
})
</script>

<template>
  <div class="site-briefs">
    <div class="page-header">
      <div>
        <h3>前采需求单</h3>
        <p>超管录一份 13 题的前采需求单（以勾选为主），AI 按这份需求出 1~3 套候选站给客户选。</p>
      </div>
    </div>

    <a-form layout="inline" class="site-briefs__toolbar">
      <a-form-item label="租户">
        <a-select
          :value="filterTenantId"
          :options="tenantFilterOptions"
          :placeholder="tenantsFailed ? '租户没取到，刷新重试' : '全部租户'"
          allow-clear
          show-search
          option-filter-prop="label"
          style="width: 200px"
          @update:value="onTenantFilterChange"
        />
      </a-form-item>
      <a-form-item label="状态">
        <a-input
          :value="filterStatus"
          placeholder="按状态代码过滤，如 draft / ready"
          allow-clear
          style="width: 220px"
          @update:value="onStatusFilterChange"
          @press-enter="load"
        />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button @click="load">查询</a-button>
          <a-button :loading="loading" @click="load">刷新</a-button>
          <a-button type="primary" @click="createBrief">
            <template #icon><PlusOutlined /></template>
            新建需求单
          </a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert v-if="listError" type="error" show-icon class="site-briefs__error">
      <template #message>{{ listError }}</template>
    </a-alert>

    <a-table
      :data-source="briefs"
      :columns="columns"
      :loading="loading"
      :pagination="{ pageSize: 10, showTotal: (total: number) => `共 ${total} 条` }"
      row-key="id"
      bordered
      size="middle"
      :scroll="{ x: 960 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'tenant'">{{ tenantLabel(record) }}</template>
        <template v-else-if="column.key === 'status'">
          <a-tag>{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'candidateCount'">{{ record.candidateCount ?? '-' }}</template>
        <template v-else-if="column.key === 'demoMode'">{{ demoModeLabel(record.demoContentMode) }}</template>
        <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
        <template v-else-if="column.key === 'op'">
          <a-button size="small" type="link" @click="editBrief(record)">录入/编辑</a-button>
        </template>
      </template>

      <template #emptyText>
        <!-- 读失败不冒充「一单都没有」：空态那句话只留给真的没有单 -->
        <p v-if="listError" class="site-briefs__empty-error">
          列表没取到：不是「还没有需求单」，是上面那条原因。修好后点「刷新」重拉。
        </p>
        <a-empty v-else>
          <template #description>
            还没有需求单。下一步是录一份前采需求单（13 题，以勾选为主）——这份需求就是 AI 出候选站的输入。<br />
            出方案、预览这些要等生成链路接通后才有，那时它们有自己的入口；今天这里不摆点了没反应的按钮。
          </template>
          <a-button type="primary" @click="createBrief">现在就去录一份</a-button>
        </a-empty>
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.site-briefs .page-header {
  margin-bottom: 16px;
}
.site-briefs .page-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}
.site-briefs__toolbar {
  margin-bottom: 16px;
}
.site-briefs__error {
  margin-bottom: 16px;
}
.site-briefs__empty-error {
  margin: 24px 0;
  color: #6b7280;
  text-align: center;
}
</style>
