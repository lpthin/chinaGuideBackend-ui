<template>
  <div class="portal-health-page">
    <a-form layout="inline" class="portal-health-page__filter">
      <a-form-item label="状态">
        <a-select
          v-model:value="filters.status"
          style="width: 130px"
          allow-clear
          :options="statusOptions"
          placeholder="待处理"
          @change="load"
        />
      </a-form-item>
      <a-form-item label="类型">
        <a-select
          v-model:value="filters.type"
          style="width: 160px"
          allow-clear
          :options="typeOptions"
          placeholder="全部类型"
          @change="load"
        />
      </a-form-item>
      <a-form-item v-if="siteOptions.length > 1" label="站点">
        <a-select v-model:value="filters.siteId" style="width: 180px" allow-clear :options="siteOptions" @change="load" />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
          <a-popconfirm title="扫描只读页面与内容表，不会改动任何内容，确认开始？" @confirm="runScan">
            <a-button type="primary" :loading="scanning">立即巡检</a-button>
          </a-popconfirm>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon class="portal-health-page__notice">
      <template #message>
        巡检只负责把问题列出来，<b>不会自动修改任何页面</b>。「让 AI 出手」产出的也只是一段 SEO 建议或一份待审阅草稿：
        建议要人贴回页面信息里保存，草稿要在页面搭建器里看过 diff 再点应用、然后自己发布。
      </template>
    </a-alert>

    <a-table
      :data-source="findings"
      :columns="columns"
      :loading="loading"
      row-key="id"
      size="middle"
      :scroll="{ x: 1320 }"
      v-model:expandedRowKeys="expandedKeys"
      :pagination="{ pageSize: 10, showTotal: (total: number) => `共 ${total} 条` }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag color="blue">{{ typeLabel(record.findingType) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'page'">
          <span v-if="record.pageId">{{ pageTitle(record.pageId) }}</span>
          <span v-else class="portal-health-page__muted">站点级（不针对单个页面）</span>
        </template>
        <template v-else-if="column.key === 'message'">
          <div class="portal-health-page__message">{{ record.message }}</div>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="healthStatusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'seen'">
          <div>{{ formatDateTime(record.firstSeenAt) }}</div>
          <div class="portal-health-page__muted">最近 {{ formatDateTime(record.lastSeenAt) }}</div>
        </template>
        <template v-else-if="column.key === 'output'">
          <!-- 用按钮不用裸 a：没有 href 的 a 键盘够不着，而展开行是唯一能看到建议正文的入口 -->
          <a-button v-if="record.draftId" size="small" type="link" @click="expand(record.id)">
            草稿 #{{ record.draftId }}
          </a-button>
          <a-button v-else-if="record.suggestionJson" size="small" type="link" @click="expand(record.id)">
            查看建议
          </a-button>
          <span v-else class="portal-health-page__muted">—</span>
        </template>
        <template v-else-if="column.key === 'op'">
          <a-space size="4">
            <a-button
              v-if="canAskAi(record)"
              size="small"
              type="link"
              :disabled="!aiFixEnabled"
              @click="openAiFix(record)"
            >
              {{ aiFixLabel(record.findingType) }}
            </a-button>
            <a-button
              v-if="record.status === 'open'"
              size="small"
              type="link"
              @click="openDismiss(record)"
            >
              忽略
            </a-button>
            <a-popconfirm v-else title="重新打开后这条会回到待处理，确认？" @confirm="reopen(record.id)">
              <a-button size="small" type="link">重新打开</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>

      <template #expandedRowRender="{ record }">
        <div class="portal-health-page__detail">
          <div>
            <span class="portal-health-page__muted">判重键：</span>{{ record.dedupKey }}
          </div>
          <div>
            <span class="portal-health-page__muted">这类问题怎么处理：</span>{{ typeHint(record.findingType) }}
          </div>
          <div v-if="record.dismissReason">
            <span class="portal-health-page__muted">忽略理由：</span>{{ record.dismissReason }}
          </div>
          <div v-if="record.resolvedAt">
            <span class="portal-health-page__muted">消失于：</span>{{ formatDateTime(record.resolvedAt) }}
          </div>
          <template v-if="record.draftId">
            <a-divider orientation="left" class="portal-health-page__divider">AI 出的改版草稿</a-divider>
            <DraftReviewCard
              v-if="draftsById[record.draftId]"
              :draft="draftsById[record.draftId]"
              @changed="onDraftChanged(record.draftId)"
            />
            <span v-else-if="!canReviewDrafts" class="portal-health-page__muted">
              草稿 #{{ record.draftId }} 已生成，但看它的内容需要 portal:review:manage 权限（当前账号没有）。
            </span>
            <a-spin v-else :spinning="true" size="small" />
          </template>
          <template v-if="record.suggestionJson">
            <a-divider orientation="left" class="portal-health-page__divider">AI 给出的 SEO 建议</a-divider>
            <div v-if="suggestionFailed(record)">
              <a-alert type="error" show-icon message="建议内容读取失败" :description="record.suggestionJson" />
            </div>
            <div v-else class="portal-health-page__suggestion">
              <div v-for="field in suggestionFields(record)" :key="field.label">
                <span class="portal-health-page__muted">{{ field.label }}：</span>{{ field.value || '（空）' }}
                <a-button
                  v-if="field.value"
                  size="small"
                  type="link"
                  @click="copyText(field.value, `${field.label}已复制`)"
                >
                  复制
                </a-button>
              </div>
              <div v-if="suggestionOf(record)?.reason">
                <span class="portal-health-page__muted">依据：</span>{{ suggestionOf(record)?.reason }}
              </div>
              <a-alert
                v-for="(warning, index) in suggestionOf(record)?.warnings || []"
                :key="index"
                type="warning"
                show-icon
                class="portal-health-page__warning"
                :message="warning"
              />
              <div class="portal-health-page__muted">
                这段只是建议：需要人工贴到页面搭建器的「页面信息」里保存并发布，才会对访客生效。
              </div>
            </div>
          </template>
        </div>
      </template>

      <template #emptyText>
        <a-empty description="没有待处理的巡检结果——还没扫过的话，点右上角「立即巡检」">
          <template #image><span /></template>
        </a-empty>
      </template>
    </a-table>

    <a-modal v-model:open="dismissOpen" title="忽略这条巡检结果" :confirm-loading="saving" @ok="submitDismiss">
      <a-form layout="vertical">
        <a-form-item label="忽略理由" required>
          <a-textarea v-model:value="dismissForm.reason" :rows="3" :maxlength="300" placeholder="为什么不处理它，例如：这条栏目页下周整体改版" />
          <template #extra>不写理由后端不会接受：忽略就是把问题藏起来，得留下是谁的决定。</template>
        </a-form-item>
        <a-form-item>
          <span class="portal-health-page__muted">忽略后这条不会再出现在待处理里；下次扫描若问题还在，也不会自动把它翻回待处理。</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="aiFixOpen"
      :title="aiFixLabel(activeFinding?.findingType)"
      :confirm-loading="saving"
      ok-text="确认并扣配额"
      @ok="submitAiFix"
    >
      <a-spin :spinning="estimating">
        <a-descriptions bordered size="small" :column="1">
          <a-descriptions-item label="这条问题">{{ activeFinding?.message }}</a-descriptions-item>
          <a-descriptions-item label="预计消耗">
            <span v-if="estimate">{{ estimate.estimatedTokens }} tokens（当前余额 {{ estimate.remainingTokens }}）</span>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="产出形态">{{ outputShape }}</a-descriptions-item>
        </a-descriptions>
        <a-alert v-if="estimate?.notice" type="warning" show-icon class="portal-health-page__warning" :message="estimate.notice" />
        <a-form layout="vertical" class="portal-health-page__confirm">
          <a-form-item>
            <a-checkbox v-model:checked="aiFixForm.confirmed">
              我确认这次调用会扣掉上面的配额，且不会自动改动页面
            </a-checkbox>
          </a-form-item>
        </a-form>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  HEALTH_AI_DRAFT,
  HEALTH_AI_NONE,
  healthStatusColor,
  portalHealthApi,
  seoSuggestionOf,
  type HealthEstimate,
  type HealthFinding,
  type HealthOptions
} from '../../api/portalHealth'
import { portalPagesApi } from '../../api/portalPages'
import { portalTicketsApi, type RevisionDraft } from '../../api/portalTickets'
import DraftReviewCard from './builder/DraftReviewCard.vue'
import { siteApi } from '../../api/workspace'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'

/**
 * 门户页面巡检视图（Spec §8.2）。
 *
 * 三条刻意：
 * 1. 类型名、状态名、「这条能不能让 AI 出手」全部来自 `/portal/health/options`。
 *    之前有过一次教训：前端按类型自己硬编码按钮，后端把某个类型改成不烧钱后，
 *    按钮还亮着，点下去只有一个中文错误——所以这里只认 aiFixMode 这一个依据；
 * 2. 页面上没有任何一个入口能改页面内容：这个视图只 import 巡检接口与页面列表接口，
 *    「已修复」这三个字也就无从出现，只有扫描返回的计数；
 * 3. 忽略必须写理由、AI 出手必须先 estimate 再勾确认，和后端判的是同一件事。
 */

const auth = useAuthStore()
const options = ref<HealthOptions | null>(null)
const findings = ref<HealthFinding[]>([])
const pages = ref<Array<{ id: number; title: string | null; slug: string | null }>>([])
const sites = ref<Array<{ id: number; name: string }>>([])
const loading = ref(false)
const scanning = ref(false)
const saving = ref(false)
const aiFixEnabled = ref(true)
const expandedKeys = ref<number[]>([])

/**
 * 草稿正文按展开惰性取（GET /portal/drafts/{id}），因为巡检接口本身只带 draftId。
 * 这份草稿不属于任何工单，而工单那条列表接口只按工单查草稿，所以这一页是它唯一的落脚点。
 */
const draftsById = reactive<Record<number, RevisionDraft>>({})
const canReviewDrafts = computed(() => auth.hasPermission('portal:review:manage'))

watch(expandedKeys, keys => {
  keys.forEach(key => {
    const finding = findings.value.find(item => item.id === key)
    if (!finding?.draftId || !canReviewDrafts.value || draftsById[finding.draftId]) return
    portalTicketsApi
      .draft(finding.draftId)
      .then(draft => (draftsById[draft.id] = draft))
      .catch(error => message.error((error as Error).message || '草稿内容加载失败'))
  })
})

/** 应用/丢弃之后必须把这份草稿重新取一遍：卡片上的「已应用」判的就是它的 appliedAt */
async function onDraftChanged(draftId: number) {
  delete draftsById[draftId]
  await load()
  expandedKeys.value = expandedKeys.value.length ? [...expandedKeys.value] : expandedKeys.value
}
const filters = reactive<{ status: string | undefined; type: string | undefined; siteId: number | null }>({
  status: undefined,
  type: undefined,
  siteId: null
})

const columns = [
  { title: '编号', dataIndex: 'id', key: 'id', width: 72 },
  { title: '类型', key: 'type', width: 130 },
  { title: '页面', key: 'page', width: 170 },
  { title: '问题', key: 'message', width: 360 },
  { title: '状态', key: 'status', width: 100 },
  { title: '发现时间', key: 'seen', width: 190 },
  { title: 'AI 产出', key: 'output', width: 120 },
  { title: '操作', key: 'op', width: 210, fixed: 'right' as const }
]

const statusOptions = computed(() =>
  Object.entries(options.value?.statuses || {}).map(([value, label]) => ({ value, label }))
)

const typeOptions = computed(() =>
  Object.entries(options.value?.types || {}).map(([value, info]) => ({ value, label: info.label }))
)

const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

function typeOf(findingType: string | null | undefined) {
  return findingType ? options.value?.types[findingType] : undefined
}

/** 不认识的类型（库里脏数据或后端加了新类型还没更新词表）原样显示键名，不替后端编中文名 */
function typeLabel(findingType: string | null | undefined): string {
  return typeOf(findingType)?.label || findingType || '未知类型'
}

function typeHint(findingType: string | null | undefined): string {
  return typeOf(findingType)?.hint || '后端未给出这一类的处理说明'
}

function statusLabel(status: string | null | undefined): string {
  return options.value?.statuses[status || ''] || status || '未知'
}

function aiFixModeOf(findingType: string | null | undefined): string {
  return typeOf(findingType)?.aiFixMode || HEALTH_AI_NONE
}

function aiFixLabel(findingType: string | null | undefined): string {
  return aiFixModeOf(findingType) === HEALTH_AI_DRAFT ? '让 AI 出改版草稿' : '让 AI 出 SEO 建议'
}

/**
 * 「让 AI 出手」这个按钮什么时候该存在。最后一句「已经出过产出就不再给入口」与服务端 aiFix 里的
 * 判定是同一条：SEO 建议按 findingId 判重扣费，再点一次会真烧 token 而账面不再扣；草稿再出一份
 * 会让上一份从这一行上脱落，变成看不见但仍然可应用的行。已有的产出在「AI 产出」那一列点得开。
 */
function canAskAi(record: HealthFinding): boolean {
  return aiFixModeOf(record.findingType) !== HEALTH_AI_NONE
    && record.status === 'open'
    && !record.draftId
    && !record.suggestionJson
}

function pageTitle(pageId: number): string {
  const page = pages.value.find(item => item.id === pageId)
  if (!page) return `页面 #${pageId}`
  return `${page.title || page.slug || '未命名页面'}（#${pageId}）`
}

function suggestionOf(finding: HealthFinding) {
  return seoSuggestionOf(finding)
}

/** 有建议却解析不出来：显式报错，不能当成「没有建议」静默藏起来 */
function suggestionFailed(finding: HealthFinding): boolean {
  return !!finding.suggestionJson && !seoSuggestionOf(finding)
}

function suggestionFields(finding: HealthFinding): Array<{ label: string; value: string }> {
  const suggestion = seoSuggestionOf(finding)
  if (!suggestion) return []
  return [
    { label: 'seoTitle', value: String(suggestion.seoTitle ?? '') },
    { label: 'seoDescription', value: String(suggestion.seoDescription ?? '') },
    { label: 'seoKeywords', value: String(suggestion.seoKeywords ?? '') }
  ]
}

function expand(id: number) {
  expandedKeys.value = expandedKeys.value.includes(id)
    ? expandedKeys.value.filter(key => key !== id)
    : [...expandedKeys.value, id]
}

async function copyText(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(okMessage)
  } catch {
    message.error('浏览器不允许写入剪贴板，请手动选中复制')
  }
}

async function load() {
  loading.value = true
  try {
    findings.value = await portalHealthApi.findings({
      siteId: filters.siteId,
      status: filters.status,
      type: filters.type
    })
  } catch (error) {
    message.error((error as Error).message || '巡检结果加载失败')
  } finally {
    loading.value = false
  }
}

async function runScan() {
  scanning.value = true
  try {
    const result = await portalHealthApi.scan(filters.siteId)
    // 结论只有这四个数，都是从后端响应里抄的：扫描不改内容，所以这里没有任何「已修复」的说法
    message.success(
      `巡检完成：扫了 ${result.pagesScanned} 个页面，新增 ${result.opened} 条、复现 ${result.reconfirmed} 条、` +
        `消失 ${result.resolved} 条（忽略中的 ${result.dismissed} 条）`
    )
    await load()
  } catch (error) {
    message.error((error as Error).message || '巡检失败')
  } finally {
    scanning.value = false
  }
}

// ---------------- 忽略 ----------------
const dismissOpen = ref(false)
const activeFinding = ref<HealthFinding | null>(null)
const dismissForm = reactive({ reason: '' })

function openDismiss(finding: HealthFinding) {
  activeFinding.value = finding
  dismissForm.reason = ''
  dismissOpen.value = true
}

async function submitDismiss() {
  const finding = activeFinding.value
  if (!finding) return
  if (!dismissForm.reason.trim()) {
    message.warning('请写清忽略理由')
    return
  }
  saving.value = true
  try {
    await portalHealthApi.dismiss(finding.id, dismissForm.reason.trim())
    dismissOpen.value = false
    message.success('已忽略')
    await load()
  } catch (error) {
    message.error((error as Error).message || '忽略失败')
  } finally {
    saving.value = false
  }
}

async function reopen(id: number) {
  try {
    await portalHealthApi.reopen(id)
    message.success('已重新打开')
    await load()
  } catch (error) {
    message.error((error as Error).message || '重新打开失败')
  }
}

// ---------------- AI 出手 ----------------
const aiFixOpen = ref(false)
const estimating = ref(false)
const estimate = ref<HealthEstimate | null>(null)
const aiFixForm = reactive({ confirmed: false })

const outputShape = computed(() => {
  if (!estimate.value) return '—'
  return estimate.value.aiFixMode === HEALTH_AI_DRAFT
    ? '页面改版草稿：产出后展开这一行看字段级 diff，确认无误再点「应用到页面」（这份草稿会立刻占掉页面新版本，可回滚）'
    : '一段 SEO 建议：写在这条巡检结果上，需要人贴到页面信息里'
})

async function openAiFix(finding: HealthFinding) {
  activeFinding.value = finding
  estimate.value = null
  aiFixForm.confirmed = false
  aiFixOpen.value = true
  estimating.value = true
  try {
    // 先估算：这一步一次模型都不调，只是把「大概花多少、开关开没开」摆出来
    estimate.value = await portalHealthApi.estimate(finding.id)
    aiFixEnabled.value = estimate.value.aiFixEnabled
  } catch (error) {
    message.error((error as Error).message || '预估失败')
  } finally {
    estimating.value = false
  }
}

async function submitAiFix() {
  const finding = activeFinding.value
  if (!finding) return
  if (!aiFixForm.confirmed) {
    message.warning('请先确认这次调用会扣配额')
    return
  }
  saving.value = true
  try {
    const updated = await portalHealthApi.aiFix(finding.id, true)
    aiFixOpen.value = false
    if (updated.draftId) {
      message.success(`草稿 #${updated.draftId} 已生成，这条仍是待处理——页面没有被动过`)
    } else if (updated.suggestionJson) {
      message.success('建议已写在这条结果上，展开可查看（页面没有被动过）')
    } else {
      message.warning('这次没有产出可用结果，原因见后端返回')
    }
    await load()
    // 结果就写在这条 finding 上，展开它才有下一步（应用/复制），不然人还得自己找那一行
    expandedKeys.value = Array.from(new Set([...expandedKeys.value, finding.id]))
  } catch (error) {
    // 被门禁拦下时后端给的是中文原因，且这一条不扣配额
    message.error((error as Error).message || 'AI 处理失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const [loadedOptions, pageList] = await Promise.all([portalHealthApi.options(), portalPagesApi.list()])
    options.value = loadedOptions
    pages.value = (pageList || []).map(page => ({ id: page.id, title: page.title, slug: page.slug }))
  } catch (error) {
    message.error((error as Error).message || '巡检词表加载失败')
  }
  try {
    const siteList = await siteApi.list()
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
  } catch {
    // 站点下拉只是给超管筛选用，拿不到就把这一格留空，不让它把整页变成错误态
  }
  await load()
})
</script>

<style scoped>
.portal-health-page__filter {
  margin-bottom: 12px;
}

.portal-health-page__notice {
  margin-bottom: 12px;
}

.portal-health-page__muted {
  color: rgba(0, 0, 0, 0.45);
}

.portal-health-page__message {
  white-space: pre-wrap;
}

.portal-health-page__detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.portal-health-page__suggestion {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.portal-health-page__divider {
  margin: 8px 0;
}

.portal-health-page__warning,
.portal-health-page__confirm {
  margin-top: 8px;
}
</style>
