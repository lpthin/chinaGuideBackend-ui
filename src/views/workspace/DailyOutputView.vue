<template>
  <div class="daily-output-page">
    <PageTitle />
    <!-- 超管没选客户时这一页按客户配置的东西读不到、也存不进去：先说清楚，别让人对着空表单猜。
         这是前置条件，按 B 类改内联（SPEC-UI-11）。 -->
    <p v-if="isPlatformMode" class="lead-hint">
      当前没有选定客户：每日自动产出是按客户单独配置的，先在右上角选一家客户，这一页才会读出并允许修改那一家的配置与留痕；平台档这里不发业务请求。
    </p>
    <!-- 「到点选题、过质检才发」的口径说明已搬进引导机器人（SPEC-UI-11 R-6）：首访讲一句，全文留在页头问号里。 -->

    <a-card title="每日自动产出" :bordered="false" :loading="loading">
      <div v-if="isPlatformMode" class="platform-empty">
        <span class="platform-dash">—</span>
        <span class="platform-hint">还没选定客户，这一家的配置读不到。</span>
      </div>
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
            :disabled="!canManage || isPlatformMode"
            @update:checked="(v: boolean) => (form.enabled = v ? 1 : 0)"
          />
          <span class="field-hint">关掉之后不再每天排产，已经产出的稿子不受影响。</span>
        </a-form-item>

        <a-form-item label="每天几点起跑">
          <a-input
            id="daily-output-run-time"
            v-model:value="form.runTime"
            :disabled="!canManage || isPlatformMode"
            style="width: 160px"
            placeholder="HH:mm"
          />
          <span class="field-hint">24 小时制 HH:mm。开通时按客户排在 02:00~05:45 的错峰格里，之后可以自己改。</span>
        </a-form-item>

        <a-form-item label="每天产出几篇">
          <a-input-number
            id="daily-output-daily-count"
            v-model:value="form.dailyCount"
            :min="1"
            :max="20"
            :disabled="!canManage || isPlatformMode"
          />
          <span class="field-hint">1~20 篇。这是「排产」的篇数，实际成稿要看额度与选题池还剩多少。</span>
        </a-form-item>

        <a-form-item label="产出之后">
          <a-radio-group id="daily-output-publish-mode" v-model:value="form.publishMode" :disabled="!canManage || isPlatformMode">
            <a-radio-button value="review">进人工审核队列</a-radio-button>
            <a-radio-button value="auto_publish">过质检后自动发布</a-radio-button>
          </a-radio-group>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button :disabled="loading || isPlatformMode" @click="load">重新读取</a-button>
            <a-button
              id="daily-output-save"
              type="primary"
              :loading="saving"
              :disabled="saving || !canManage || isPlatformMode"
              @click="save"
            >保存配置</a-button>
          </a-space>
          <div v-if="!canManage" class="permission-hint">
            改这几项要「每日自动产出」的修改权限（content:output:manage）——客户管理员默认有这一码，
            也可以在角色页把它分配给别的角色。
          </div>
          <div v-else-if="lastEditedAt" class="updated-hint">上次修改：{{ formatDateTime(lastEditedAt) }}</div>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card title="最近留痕" :bordered="false">
      <template #extra>
        <a-button size="small" :loading="runsLoading" :disabled="isPlatformMode" @click="loadRuns">刷新</a-button>
      </template>
      <div v-if="isPlatformMode" class="platform-empty">
        <span class="platform-dash">—</span>
        <span class="platform-hint">还没选定客户，这一家的留痕读不到。</span>
      </div>
      <a-alert
        v-else-if="runsError"
        type="error"
        show-icon
        message="留痕没读到"
        :description="runsError"
      />
      <DataTable
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
      </DataTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  dailyOutputApi,
  type DailyOutputConfig,
  type DailyOutputRun
} from '../../api/dailyOutput'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime } from '../../utils/format'
import { useTenantReadGuard } from '../../utils/latestRead'
import PageTitle from '../../components/PageTitle.vue'
import DataTable from '../../components/DataTable.vue'
import { ROBOT_PAGE_CARDS } from '../../copy/robot'
import { useRobotNotices } from '../../composables/useRobotNotices'

/**
 * 「每天自动产出」那张配置卡（P9-B 拍板 Q7：租户管理员改得动，也分配得出去）。
 *
 * 界面这一侧只有一条硬规矩：不许把「没取到」显示成「没有」。所以配置读失败时表单停在空态并说
 * 那句后端报错，而不是回填一套默认值让人以为已经保存了；留痕读失败也不摆空表。
 */

const authStore = useAuthStore()
const robot = useRobotNotices()

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
/** 超管没选客户：这一页按客户存的东西没有可读的那一家，读口不发请求、写口全灰 */
const isPlatformMode = computed(() => authStore.isSuperAdmin && authStore.selectedTenantId === null)
/** 切客户时只认最后一发：旧客户那几发晚到的回包不许落到界面上 */
const tenantScope = computed(() => (authStore.isSuperAdmin ? authStore.selectedTenantId : authStore.tenantId))
const latestRead = useTenantReadGuard(tenantScope)

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

/** 切到平台档或换一家时先把上一家的读数清掉，免得旧值和「还没读」混在一起 */
function clearReadState() {
  form.enabled = 0
  form.runTime = ''
  form.dailyCount = 5
  form.publishMode = 'review'
  lastEditedAt.value = null
  runs.value = []
  runsError.value = ''
  configError.value = ''
}

async function load() {
  if (isPlatformMode.value) {
    clearReadState()
    return
  }
  const ticket = latestRead.begin('config')
  loading.value = true
  try {
    const cfg = await dailyOutputApi.config(tenantId.value)
    if (!latestRead.isCurrent(ticket)) return
    if (cfg) applyConfig(cfg)
    configError.value = ''
  } catch (error: any) {
    if (!latestRead.isCurrent(ticket)) return
    // 读失败就老实地说读失败：表单不回填一套默认值，那形状读起来像「这一家已经存过了」
    configError.value = error?.message || '配置读取失败'
  } finally {
    if (latestRead.isCurrent(ticket)) loading.value = false
  }
}

async function save() {
  if (isPlatformMode.value) {
    message.warning('请先在右上角选择客户')
    return
  }
  // 保存这一发不占「只认最后一发」的号（那会把正在读的同客户请求顶掉），只记住动手时是哪一家
  const savingTenant = tenantScope.value
  saving.value = true
  try {
    const saved = await dailyOutputApi.save({ ...form }, tenantId.value)
    // 中途换了客户：这一发的回包属于上一家，不能拿它盖住新客户的表单
    if (tenantScope.value !== savingTenant) return
    if (saved) applyConfig(saved)
    message.success('配置已保存')
    await loadRuns()
  } catch (error: any) {
    if (tenantScope.value !== savingTenant) return
    // 校验话术的出处在后端（那里也是自动链自己判同一套取值的地方），这里原样念，不抄第二份
    message.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function loadRuns() {
  if (isPlatformMode.value) {
    clearReadState()
    return
  }
  const ticket = latestRead.begin('runs')
  runsLoading.value = true
  try {
    const data = await dailyOutputApi.runs(tenantId.value)
    if (!latestRead.isCurrent(ticket)) return
    runs.value = Array.isArray(data) ? data : []
    runsError.value = ''
  } catch (error: any) {
    if (!latestRead.isCurrent(ticket)) return
    // 这一张表最坏的形状是「读失败渲成一张空表」——空表读起来像「这一家一天都没跑过」
    runs.value = []
    runsError.value = error?.message || '留痕读取失败'
  } finally {
    if (latestRead.isCurrent(ticket)) runsLoading.value = false
  }
}

onMounted(() => {
  // 排产口径与数据无关，挂载就说一句；同会话只说一次，全文靠页头问号复看
  const card = ROBOT_PAGE_CARDS['daily-output.pipeline']
  robot.announce(
    { key: 'daily-output.pipeline', category: 'scope', text: card.text, detail: card.detail, once: 'session' },
    { ready: true }
  )
  // 进这一页要 content:output:view（路由 meta 与后端注解读同一个码），所以这里不再判一次读权限：
  // 没有码的人根本到不了这一页，在这里补一层判断只会造出一个「没人看得见的空壳表单」。
  load()
  loadRuns()
})

watch(
  () => authStore.selectedTenantId,
  () => {
    clearReadState()
    load()
    loadRuns()
  }
)
</script>

<style scoped lang="less">
.daily-output-page {
  width: 100%;
  padding: 8px 0;
}

.lead-hint {
  margin-bottom: 16px;
  color: #8c8c8c;
  font-size: 13px;
  line-height: 20px;
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

.platform-empty {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0 4px;
  color: #8c8c8c;
}

.platform-dash {
  font-size: 22px;
  line-height: 1;
  color: #bfbfbf;
}

.platform-hint {
  font-size: 13px;
}
</style>
