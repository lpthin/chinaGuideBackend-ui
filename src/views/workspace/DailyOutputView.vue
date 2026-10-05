<template>
  <div class="daily-output-page">
    <a-alert
      class="lead-alert"
      type="info"
      show-icon
      message="到点自动从热词库选题、产出草稿；要不要直接发到站上，由下面这一档决定。"
      description="「过质检后自动发布」不是无人值守直通站点：质检没过或调用没跑成的稿子仍退回人工待审，留痕里会写明是哪一种。"
    />

    <a-card title="每日自动产出" :bordered="false" :loading="loading">
      <a-alert
        v-if="configError"
        type="error"
        show-icon
        message="这一家的配置没读到"
        :description="configError"
      />
      <a-form v-else :model="form" layout="vertical" class="config-form">
        <a-form-item label="开关">
          <a-switch
            id="daily-output-enabled"
            :checked="form.enabled === 1"
            :disabled="!canManage"
            @update:checked="(v: boolean) => (form.enabled = v ? 1 : 0)"
          />
          <span class="field-hint">关掉之后不再每天排产，已经产出的稿子不受影响。</span>
        </a-form-item>

        <a-form-item label="每天几点起跑">
          <a-input
            id="daily-output-run-time"
            v-model:value="form.runTime"
            :disabled="!canManage"
            style="width: 160px"
            placeholder="HH:mm"
          />
          <span class="field-hint">24 小时制 HH:mm。开通时按租户排在 02:00~05:45 的错峰格里，之后可以自己改。</span>
        </a-form-item>

        <a-form-item label="每天产出几篇">
          <a-input-number
            id="daily-output-daily-count"
            v-model:value="form.dailyCount"
            :min="1"
            :max="20"
            :disabled="!canManage"
          />
          <span class="field-hint">1~20 篇。这是「排产」的篇数，实际成稿要看额度与选题池还剩多少。</span>
        </a-form-item>

        <a-form-item label="产出之后">
          <a-radio-group id="daily-output-publish-mode" v-model:value="form.publishMode" :disabled="!canManage">
            <a-radio-button value="review">进人工审核队列</a-radio-button>
            <a-radio-button value="auto_publish">过质检后自动发布</a-radio-button>
          </a-radio-group>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button :disabled="loading" @click="load">重新读取</a-button>
            <a-button
              id="daily-output-save"
              type="primary"
              :loading="saving"
              :disabled="!canManage"
              @click="save"
            >保存配置</a-button>
          </a-space>
          <div v-if="!canManage" class="permission-hint">
            改这几项要「每日自动产出」的修改权限（content:output:manage）——租户管理员默认有这一码，
            也可以在角色页把它分配给别的角色。
          </div>
          <div v-else-if="lastEditedAt" class="updated-hint">上次修改：{{ formatDateTime(lastEditedAt) }}</div>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card title="最近留痕" :bordered="false">
      <template #extra>
        <a-button size="small" :loading="runsLoading" @click="loadRuns">刷新</a-button>
      </template>
      <a-alert
        v-if="runsError"
        type="error"
        show-icon
        message="留痕没读到"
        :description="runsError"
      />
      <a-table
        v-else
        :columns="runColumns"
        :data-source="runs"
        :loading="runsLoading"
        :pagination="false"
        row-key="runDate"
        size="small"
      >
        <template #emptyText>
          <div class="empty-runs">还没有留痕：这一家到点跑过一次之后才会有记录。</div>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'count'">
            {{ record.produced ?? 0 }} / {{ record.planned ?? 0 }} 篇
            <span v-if="record.autoPublished" class="published-hint">（自动发布 {{ record.autoPublished }} 篇）</span>
          </template>
          <template v-else-if="column.key === 'detail'">
            <span v-if="record.skipReasonText" class="skip-reason">{{ record.skipReasonText }}</span>
            <span v-if="record.note" class="note-text">{{ record.note }}</span>
            <span v-if="!record.skipReasonText && !record.note" class="muted">—</span>
          </template>
          <!-- 后端回的是 ISO 原文（2026-10-05T13:39:20），直接摆给客户看等于念机器话 -->
          <template v-else-if="column.key === 'updatedAt'">
            {{ formatDateTime(record.updatedAt, true) }}
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  dailyOutputApi,
  type DailyOutputConfig,
  type DailyOutputRun
} from '../../api/dailyOutput'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime } from '../../utils/format'

/**
 * 「每天自动产出」那张配置卡（P9-B 拍板 Q7：租户管理员改得动，也分配得出去）。
 *
 * 界面这一侧只有一条硬规矩：不许把「没取到」显示成「没有」。所以配置读失败时表单停在空态并说
 * 那句后端报错，而不是回填一套默认值让人以为已经保存了；留痕读失败也不摆空表。
 */

const authStore = useAuthStore()

const MANAGE_CODE = 'content:output:manage'

const loading = ref(false)
const saving = ref(false)
const runsLoading = ref(false)

const form = reactive({
  enabled: 0,
  runTime: '',
  dailyCount: 5,
  publishMode: 'review'
})

const runs = ref<DailyOutputRun[]>([])
const runsError = ref('')
const configError = ref('')
const lastEditedAt = ref<string | null>(null)

const tenantId = computed(() => authStore.selectedTenantId ?? undefined)
const canManage = computed(() => authStore.hasPermission(MANAGE_CODE))

const runColumns = [
  { title: '日期', dataIndex: 'runDate', key: 'runDate', width: 120 },
  { title: '状态', key: 'status', width: 110 },
  { title: '成稿 / 计划', key: 'count', width: 180 },
  { title: '说明', key: 'detail' },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 }
]

/**
 * 状态码的中文只在这一处映射，且没见过的码原样显示它自己。
 * 留痕的「为什么没出」不走这里——那一句的出处是后端的 `skipReasonText`，界面不再拼第二份。
 */
const STATUS_LABELS: Record<string, string> = {
  RUNNING: '进行中',
  DONE: '已完成',
  PARTIAL: '部分完成',
  SKIPPED: '当天跳过'
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusColor(status: string) {
  if (status === 'DONE') return 'green'
  if (status === 'PARTIAL') return 'orange'
  if (status === 'SKIPPED') return 'red'
  return 'blue'
}

function applyConfig(cfg: DailyOutputConfig) {
  form.enabled = cfg.enabled ?? 0
  form.runTime = cfg.runTime ?? ''
  form.dailyCount = cfg.dailyCount ?? 5
  form.publishMode = cfg.publishMode ?? 'review'
  lastEditedAt.value = cfg.updatedAt ?? null
}

async function load() {
  loading.value = true
  try {
    const cfg = await dailyOutputApi.config(tenantId.value)
    if (cfg) applyConfig(cfg)
    configError.value = ''
  } catch (error: any) {
    // 读失败就老实地说读失败：表单不回填一套默认值，那形状读起来像「这一家已经存过了」
    configError.value = error?.message || '配置读取失败'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const saved = await dailyOutputApi.save({ ...form }, tenantId.value)
    if (saved) applyConfig(saved)
    message.success('配置已保存')
    await loadRuns()
  } catch (error: any) {
    // 校验话术的出处在后端（那里也是自动链自己判同一套取值的地方），这里原样念，不抄第二份
    message.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function loadRuns() {
  runsLoading.value = true
  try {
    const data = await dailyOutputApi.runs(tenantId.value)
    runs.value = Array.isArray(data) ? data : []
    runsError.value = ''
  } catch (error: any) {
    // 这一张表最坏的形状是「读失败渲成一张空表」——空表读起来像「这一家一天都没跑过」
    runs.value = []
    runsError.value = error?.message || '留痕读取失败'
  } finally {
    runsLoading.value = false
  }
}

onMounted(() => {
  // 进这一页要 content:output:view（路由 meta 与后端注解读同一个码），所以这里不再判一次读权限：
  // 没有码的人根本到不了这一页，在这里补一层判断只会造出一个「没人看得见的空壳表单」。
  load()
  loadRuns()
})
</script>

<style scoped lang="less">
.daily-output-page {
  width: 100%;
  padding: 8px 0;
}

.lead-alert {
  margin-bottom: 16px;
}

.config-form {
  max-width: 720px;
}

.field-hint {
  margin-left: 12px;
  color: #8c8c8c;
  font-size: 13px;
}

.permission-hint {
  margin-top: 8px;
  color: #8c8c8c;
  font-size: 13px;
}

.updated-hint {
  margin-top: 8px;
  color: #8c8c8c;
  font-size: 13px;
}

.published-hint,
.skip-reason,
.muted {
  color: #8c8c8c;
  font-size: 13px;
}

.skip-reason {
  color: #d46b08;
}

.note-text {
  display: block;
  margin-top: 2px;
  font-size: 13px;
}

.empty-runs {
  padding: 16px 0;
  color: #8c8c8c;
}
</style>
