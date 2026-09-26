<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  briefAnswerRows,
  briefDemoModeText,
  briefIsEditable,
  briefStatusLabel,
  briefStatusLabelOrCode,
  EDITABLE_BRIEF_STATUSES,
  siteStatusColor,
  siteStatusText,
  siteBriefsApi,
  vocabularyApi,
  type SiteBrief,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import { siteApi, tenantApi } from '@/api/workspace'
import { formatDateTime } from '@/utils/format'
import type { Site } from '@/types'
import type { Tenant } from '@/types/workspace'

/**
 * 需求单详情（Spec-C §3.2「需求单详情 = 后链路的落点」，任务 P2 第 1 件）。
 *
 * 这一页是列表里那一行的落点：以前点「录入/编辑」直接掉进表单，看不出这单走到哪一步了。
 * 三条口径：
 * 1. **13 题的答案按词表读回**——题目名与选项中文全部经 `GET /admin/site-briefs/vocabulary`
 *    翻成人话（`briefAnswerRows` 是唯一实现点），页面不写题名、不写选项名，也不认「库里存过什么」；
 *    词表取不到就明说「没有答案可读回」，不退回一份本地清单（I-1）。
 * 2. **`requirements_summary` 原话照抄**：那是后端按上面的选择确定性渲染、并且真的喂给模型的那句，
 *    界面一个字都不改、也不另拼一份。
 * 3. **能不能改由后端的状态机说了算**：只有 `EDITABLE_STATUSES`（draft/ready）给编辑入口，
 *    其余状态这里只写一句中文说明为什么不给——摆一个保存必然被拒的表单是骗人填一遍。
 *
 * 候选站这一格只在单子上确实绑过站时出现。「出方案 / 预览 / 转正」今天都还没有后端口（P3/P4），
 * 所以这一页没有任何那样的按钮，只有文字说明缺的是哪一段。
 */

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const brief = ref<SiteBrief | null>(null)

const vocabulary = ref<SiteBriefVocabulary | null>(null)
const vocabularyFailed = ref(false)

const tenants = ref<Tenant[]>([])
const tenantsFailed = ref(false)
const sites = ref<Site[]>([])
const sitesFailed = ref(false)

function errText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}

function routeBriefId(): number | null {
  const parsed = Number(route.params.id)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const briefId = computed(() => routeBriefId())

const statusText = computed(() =>
  briefStatusLabel(vocabulary.value, brief.value?.status, brief.value?.statusLabel)
)
const editable = computed(() => briefIsEditable(brief.value?.status))

/** 锁单说明里的两个可改状态名也取自词表：这一句除了连接词之外没有一个字是抄的 */
const editableStatusNames = computed(() =>
  EDITABLE_BRIEF_STATUSES.map(code => briefStatusLabelOrCode(vocabulary.value, code)).join('、')
)

const tenantText = computed(() => {
  const id = brief.value?.tenantId
  if (!id) return '未绑定租户'
  const found = tenants.value.find(tenant => tenant.id === id)
  if (found) return found.name || found.code || `租户 #${id}`
  return tenantsFailed.value
    ? `租户 #${id}（租户列表没取到，名字刷新后才有）`
    : `租户 #${id}`
})

const demoModeText = computed(() => briefDemoModeText(vocabulary.value, brief.value?.demoContentMode))

const answerRows = computed(() => (brief.value ? briefAnswerRows(vocabulary.value, brief.value) : []))
const answeredCount = computed(() => answerRows.value.filter(row => row.value).length)

function siteLabel(site: Site): string {
  return site.name || site.code || `站点 #${site.id ?? '?'}`
}

function tenantNameOf(site: Site): string {
  if (!site.tenantId) return '未绑定租户'
  return tenants.value.find(tenant => tenant.id === site.tenantId)?.name || `租户 #${site.tenantId}`
}

/**
 * 这一单名下的站：候选站靠 V115 的 `build_brief_id` 认亲，转正站靠需求单回填的 `site_id`。
 * 两个来源可能指同一行，按 id 去重；`build_brief_id` 这一列后端还没上时这里就是空的，
 * 页面据此写「没有绑站」，不会把「列还没上」说成「一单没建过站」。
 */
const linkedSites = computed<Site[]>(() => {
  const id = briefId.value
  const current = brief.value
  const out: Site[] = []
  const seen = new Set<number>()
  if (id !== null) {
    sites.value
      .filter(site => site.buildBriefId === id)
      .sort((left, right) => (left.candidateNo ?? 0) - (right.candidateNo ?? 0))
      .forEach(site => {
        if (typeof site.id === 'number' && !seen.has(site.id)) {
          seen.add(site.id)
          out.push(site)
        }
      })
  }
  const promotedId = current?.siteId
  if (typeof promotedId === 'number' && !seen.has(promotedId)) {
    const promoted = sites.value.find(site => site.id === promotedId)
    if (promoted) out.push(promoted)
    else out.push({ id: promotedId, code: '', name: '', domain: '', status: '', tenantId: current?.tenantId ?? undefined } as Site)
  }
  return out
})

/** 转正回填了 site_id，但站点列表里查不到这一行（列表分页没 cover 到 / 站被删）时说的实话 */
const promotedSiteMissing = computed(() => {
  const promotedId = brief.value?.siteId
  if (typeof promotedId !== 'number') return false
  return !sites.value.some(site => site.id === promotedId)
})

const boundSiteText = computed(() => {
  const promotedId = brief.value?.siteId
  if (typeof promotedId !== 'number') return '还没有绑定站点：转正才会回填'
  const found = sites.value.find(site => site.id === promotedId)
  return found ? `${siteLabel(found)}（#${promotedId}）` : `站点 #${promotedId}（站点列表里没这一行）`
})

const sitesUnavailable = computed(() => sitesFailed.value && !sites.value.length)

const columns = [
  { title: '题目', key: 'question', width: 260 },
  { title: '当时勾的 / 填的', key: 'answer' },
  { title: '兑现依据（后端词表带的）', key: 'evidence', width: 280 }
]

const siteColumns = [
  { title: '站点', key: 'site', width: 260 },
  { title: '归属租户', key: 'siteTenant', width: 160 },
  { title: '候选号', key: 'candidateNo', width: 120 },
  { title: '状态', key: 'siteStatus', width: 130 },
  { title: '操作', key: 'siteOp', width: 190 }
]

/** 能改时按钮写「去录入」还是「继续编辑」，看的是后端有没有渲染过摘要——不是前端猜的 */
const intakeLabel = computed(() => (brief.value?.requirementsSummary ? '继续编辑这 13 题' : '去录入这 13 题'))

async function loadVocabulary() {
  vocabularyFailed.value = false
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
  } catch (error) {
    vocabulary.value = null
    vocabularyFailed.value = true
    message.error(errText(error))
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
    sites.value = (await siteApi.list()) || []
    sitesFailed.value = false
  } catch (error) {
    sitesFailed.value = true
  }
}

async function load() {
  const id = routeBriefId()
  if (id === null) {
    loadError.value = '地址里的需求单号不是一个正整数，这一单读不出来'
    brief.value = null
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    brief.value = await siteBriefsApi.get(id)
  } catch (error) {
    brief.value = null
    loadError.value = errText(error)
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function goIntake() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-portal-brief-intake', params: { id: String(id) } })
}

function goList() {
  router.push({ name: 'workspace-portal-briefs' })
}

/** 「从需求单进入」的另一头：站点管理带着本单号过去，只列这一单名下的站 */
function goSites() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-sites', query: { briefId: String(id) } })
}

/** 组装任务是既有的真页面：`?siteId=` 过去它就替这个站把任务列表拉出来（不是新能力） */
function goAssemble(site: Site) {
  if (typeof site.id !== 'number') return
  router.push({ name: 'workspace-portal-assemble-jobs', query: { siteId: String(site.id) } })
}

onMounted(async () => {
  await Promise.all([load(), loadAux()])
  await loadVocabulary()
})
</script>

<template>
  <div class="brief-detail">
    <div class="page-header brief-detail__head">
      <div>
        <h3>需求单 #{{ briefId ?? '?' }}</h3>
        <p class="brief-detail__sub">
          这一页是一条交付单现在走到哪一步的落点：前采答了什么、后端喂给模型的是哪句话、名下列出了哪些站。
        </p>
      </div>
      <div class="brief-detail__head-actions">
        <a-space wrap>
          <a-tag>{{ statusText }}</a-tag>
          <a-button @click="goList">返回列表</a-button>
          <!-- 后端状态机允许改才给编辑入口：不许摆一张填完保存必然被拒的表单（那等于骗人填一遍） -->
          <a-button v-if="editable" type="primary" @click="goIntake">{{ intakeLabel }}</a-button>
        </a-space>
        <p v-if="brief && !editable" class="brief-detail__locked">
          这一单现在是「{{ statusText }}」，已经不在可编辑状态里（后端只收 {{ editableStatusNames }} 两种状态的修改），
          所以上面没有编辑按钮：把 13 题改一遍保存会被整单拒掉，这里不摆那种入口。要看答了什么就在下面两格里看。
        </p>
      </div>
    </div>

    <a-alert v-if="loadError" type="error" show-icon class="brief-detail__alert">
      <template #message>
        需求单没读到：{{ loadError }}
        <a-button size="small" type="link" @click="load">重试</a-button>
      </template>
    </a-alert>

    <a-alert v-if="vocabularyFailed" type="error" show-icon class="brief-detail__alert">
      <template #message>
        前采词表没取到：下面「13 题答了什么」那一格读不出来——题目名与选项中文只有一份，在后端的词表里，
        这一页不抄第二份本地清单来凑。
        <a-button size="small" type="link" @click="loadVocabulary">重新取词表</a-button>
      </template>
    </a-alert>

    <template v-if="brief">
      <a-card size="small" title="这一单的抬头三件事" class="brief-detail__panel">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="租户">{{ tenantText }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ statusText }}</a-descriptions-item>
          <a-descriptions-item label="候选套数">{{ brief.candidateCount ?? '-' }}</a-descriptions-item>
          <a-descriptions-item label="演示内容档位">{{ demoModeText }}</a-descriptions-item>
          <a-descriptions-item label="绑定站点">{{ boundSiteText }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ brief.createdBy || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDateTime(brief.createdAt) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatDateTime(brief.updatedAt) }}</a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-card size="small" class="brief-detail__panel">
        <template #title>AI 将理解的这段话（后端渲染、落库留痕的那一份）</template>
        <p v-if="brief.requirementsSummary" class="brief-detail__summary">{{ brief.requirementsSummary }}</p>
        <p v-else class="brief-detail__muted">
          库里还没有这段话：它由后端按 13 题的选择确定性渲染，必填题没答完时后端不会渲染摘要。
        </p>
        <p class="brief-detail__muted">
          模型拿到的就是上面这一句原话——界面不改写、不另拼一份（这一页也没有第二段话可拼）。
          要换这段话只能改上面的选择再保存，由后端重新渲染。
        </p>
      </a-card>

      <a-card size="small" class="brief-detail__panel">
        <template #title>前采 13 题答了什么（按词表读回）</template>
        <p v-if="vocabularyFailed" class="brief-detail__muted">词表没取到，这一格现在是空的：上面那条「重新取词表」修好它就回来了。</p>
        <template v-else>
          <p class="brief-detail__muted">
            共 {{ answerRows.length }} 题，其中 {{ answeredCount }} 题有答案。空着的那一格就是当时没勾/没填，不是这里没显示出来。
          </p>
          <a-table
            :data-source="answerRows"
            :columns="columns"
            :loading="loading"
            :pagination="false"
            row-key="key"
            size="small"
            bordered
            :scroll="{ x: 900 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'question'">
                <div>{{ record.label }}</div>
                <div v-if="record.required" class="brief-detail__muted">必填题</div>
              </template>
              <template v-else-if="column.key === 'answer'">
                <span v-if="record.value" class="brief-detail__answer">
                  {{ record.value }}<span v-if="record.unknown" class="brief-detail__unknown">（词表里已经没有这个码了）</span>
                </span>
                <span v-else class="brief-detail__muted">没答</span>
              </template>
              <template v-else-if="column.key === 'evidence'">
                <span class="brief-detail__muted">{{ record.evidence || '词表没给这一题的兑现依据' }}</span>
              </template>
            </template>
            <template #emptyText>
              <a-empty description="词表里一道题都没有：那不是「这单没答题」，是词表回包空了，刷新重试" />
            </template>
          </a-table>
        </template>
      </a-card>

      <a-card size="small" class="brief-detail__panel">
        <template #title>这一单名下的站点</template>
        <template v-if="linkedSites.length">
          <p class="brief-detail__muted">
            候选与转正的站都在这儿；「第几套」是建它时记的候选号，归档的也照样列出来（客户否掉了什么是要留证的）。
          </p>
          <p v-if="sitesUnavailable" class="brief-detail__muted">
            站点列表这次没取到：下面这一格只能按需求单自己回填的那个站号显示，候选清单要刷新重试才有。
          </p>
          <a-table
            :data-source="linkedSites"
            :columns="siteColumns"
            :pagination="false"
            row-key="id"
            size="small"
            bordered
            :scroll="{ x: 860 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'site'">
                <div>{{ siteLabel(record) }}</div>
                <div class="brief-detail__muted">#{{ record.id ?? '-' }} · {{ record.domain || '没有域名' }}</div>
              </template>
              <template v-else-if="column.key === 'siteTenant'">{{ tenantNameOf(record) }}</template>
              <template v-else-if="column.key === 'candidateNo'">
                {{ record.candidateNo == null ? '没记候选号' : `第 ${record.candidateNo} 套` }}
              </template>
              <template v-else-if="column.key === 'siteStatus'">
                <a-tag :color="siteStatusColor(record.status)">{{ siteStatusText(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'siteOp'">
                <a-button size="small" type="link" @click="goAssemble(record)">这一站的组装任务</a-button>
              </template>
            </template>
          </a-table>
          <a-space wrap class="brief-detail__actions">
            <a-button @click="goSites">到站点管理只看这一单的站</a-button>
          </a-space>
          <p v-if="promotedSiteMissing" class="brief-detail__muted">
            上面有一行是需求单回填的转正站号，但站点列表里查不到它：可能是列表没取全，也可能这个站已经不在了。
          </p>
        </template>
        <p v-else class="brief-detail__muted">
          这一单名下现在没有站点。候选站是「出方案」之后由生成链路建出来并把 `build_brief_id` 回填到站上的，
          那一段还没接通（Spec-C 的 P3/P4），所以这里既没有候选可列，也不摆一个点了没反应的出方案按钮。
          <template v-if="sitesUnavailable">（另外：站点列表这次没取到，即使有绑站也显示不出来，请刷新重试。）</template>
        </p>
      </a-card>
    </template>

    <a-card v-else-if="!loadError" size="small" class="brief-detail__panel">
      <p class="brief-detail__muted">正在读这一单…</p>
    </a-card>
  </div>
</template>

<style scoped>
.brief-detail .page-header {
  margin-bottom: 16px;
}
.brief-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.brief-detail__head h3 {
  margin: 0 0 4px;
}
.brief-detail__head-actions {
  text-align: right;
  max-width: 460px;
}
.brief-detail__sub,
.brief-detail__muted {
  color: #6b7280;
  font-size: 13px;
}
.brief-detail__locked {
  margin: 8px 0 0;
  color: #d46b08;
  font-size: 12px;
}
.brief-detail__alert {
  margin-bottom: 16px;
}
.brief-detail__panel {
  margin-bottom: 16px;
}
.brief-detail__summary {
  margin: 0 0 8px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
}
.brief-detail__answer {
  word-break: break-word;
}
.brief-detail__unknown {
  color: #d46b08;
  font-size: 12px;
}
.brief-detail__actions {
  margin-top: 12px;
}
</style>
