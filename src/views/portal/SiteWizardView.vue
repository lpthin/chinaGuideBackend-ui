<script setup lang="ts">
/**
 * 新建网站向导（Spec-M §3 那五步 / §7.1，D3：入口仍只给超管）。
 *
 * 这一页回答的是他那句「我不知道怎么给用户建一个新网站，没找到入口」：
 * 左侧「建站」组的第一项就是这里，五步一条线，每一步只摆**今天真存在**的那一个动作。
 *
 * 两条纪律写死在这里：
 * 1. **它不是第二个流水线**。估价、出初稿、签字、发预览、选定转正这些动作一个都不在这一页重做——
 *    它们各自有闸（估价的凭据两样、签字的空段点名、生成的配额与确认闸），复制一份就等于再造一份会漂移的真相。
 *    这一页读的是那些页面读的同几个只读口，然后把人送去按那一个按钮。
 * 2. **每一步「完成了没有」只由后端读数判**（说明书的 status、候选行的 siteId、预览令牌发没发过、
 *    需求单名下的站点），界面不许给任何一格手动打勾，也不许把「读失败」念成「还没有」。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  briefStatusLabel,
  briefGenerationApi,
  siteBriefsApi,
  vocabularyApi,
  type BriefCandidateSite,
  type SiteBrief,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import { siteSpecApi, type SpecDocumentView } from '@/api/siteSpec'
import BriefIntakeForm from '@/views/portal/BriefIntakeForm.vue'
import WizardSteps from '@/components/WizardSteps.vue'
import { createWizardState, type WizardState, type WizardStepDef } from '@/components/wizardModel'

const route = useRoute()
const router = useRouter()

const STEP_KEYS = ['intake', 'spec', 'generate', 'candidates', 'deliver'] as const

const briefs = ref<SiteBrief[]>([])
const briefsError = ref('')
const vocabulary = ref<SiteBriefVocabulary | null>(null)
const briefId = ref<number | null>(readBriefIdFromQuery())

const spec = ref<SpecDocumentView | null>(null)
const specError = ref('')
const candidates = ref<BriefCandidateSite[]>([])
const candidatesError = ref('')

const wizard = ref<WizardState>(createWizardStateWithStep(readStepKeyFromQuery()))

function readBriefIdFromQuery(): number | null {
  const raw = route.query.briefId
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readStepKeyFromQuery(): string | undefined {
  const raw = route.query.step
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && STEP_KEYS.includes(value as (typeof STEP_KEYS)[number]) ? value : undefined
}

/** 步号写进地址：刷新、收藏夹、从别的页面退回来都还在原来那一步（Spec-F §9.2-4 那条持久化口径） */
function createWizardStateWithStep(stepKey?: string): WizardState {
  const index = stepKey ? STEP_KEYS.indexOf(stepKey as (typeof STEP_KEYS)[number]) : 0
  return { current: index < 0 ? 0 : index, maxReached: index < 0 ? 0 : index }
}

const currentBrief = computed(() => briefs.value.find(brief => brief.id === briefId.value) || null)

/** 地址里带了 briefId、但列表还没读到（或那一单被筛掉了）：这一格要能说出单号，不许念成「没选单」 */
const briefLabel = computed(() => {
  if (!briefId.value) return ''
  const found = currentBrief.value
  return found ? `#${found.id} ${found.brandName || found.industry || '（没填品牌名）'}` : `#${briefId.value}`
})

function briefOption(brief: SiteBrief) {
  return {
    value: brief.id,
    label: `#${brief.id} ${brief.brandName || brief.industry || '（没填品牌名）'} · ${tenantLabel(brief)}`
  }
}

function tenantLabel(brief: SiteBrief): string {
  return brief.tenantId ? `租户 #${brief.tenantId}` : '未绑定租户'
}

/** 说明书七段里还空着几段：只数后端 `blank` 那一格，界面不猜段数也不抄段名 */
const blankSections = computed(() => (spec.value?.sections || []).filter(section => section.blank).length)

const deliveredCandidates = computed(() => candidates.value.filter(candidate => candidate.siteId !== null))
const previewIssuedCount = computed(() => candidates.value.filter(candidate => candidate.previewIssued).length)
const needsHumanCount = computed(() => deliveredCandidates.value.filter(candidate => candidate.needsHuman).length)

/**
 * 五步的状态全部从读数推出来：wait/process/finish/error 不是人点的，是那一格的后端事实。
 * 判据挑的是最保守的那一个：例如「出方案」这一步要**建出了站**才算走完，
 * 只看候选行数会把「一行失败记录」也念成完成。
 */
const stepDefs = computed<WizardStepDef[]>(() => [
  {
    key: 'intake',
    title: '需求单',
    status: briefId.value ? 'finish' : 'process'
  },
  {
    key: 'spec',
    title: '建站说明书',
    status: !briefId.value ? 'wait'
      : specError.value ? 'error'
      : spec.value?.status === 'CONFIRMED' ? 'finish'
      : spec.value?.exists ? 'process'
      : 'wait'
  },
  {
    key: 'generate',
    title: '估价与出方案',
    status: !briefId.value ? 'wait'
      : candidatesError.value ? 'error'
      : deliveredCandidates.value.length ? 'finish'
      : candidates.value.length ? 'process'
      : 'wait'
  },
  {
    key: 'candidates',
    title: '候选站比较',
    status: !deliveredCandidates.value.length ? 'wait'
      : previewIssuedCount.value ? 'finish'
      : 'process'
  },
  {
    key: 'deliver',
    title: '选定并转正',
    status: currentBrief.value?.siteId ? 'finish' : deliveredCandidates.value.length ? 'process' : 'wait'
  }
])

/** 每一步还差什么，说人话。这里没有任何一句是「界面替后端判的」，全部对着上面那些读数 */
const stepNotice = computed<Record<string, string>>(() => ({
  intake: briefId.value ? `正在做这一单：${briefLabel.value}` : '还没有选定需求单：先挑一张已有的，或录一份新的。',
  spec: !briefId.value ? '要先有需求单。'
    : specError.value ? `说明书没读到：${specError.value}`
    : !spec.value?.exists ? '这一单还没有说明书（AI 出初稿与逐段修改都在那一页）。'
    : spec.value.status === 'CONFIRMED'
      ? `已确认的第 ${spec.value.specVersion} 版，${spec.value.sections.length} 段全文就是生成的输入。`
      : `现在的状态是「${spec.value.statusLabel}」：${blankSections.value ? `还有 ${blankSections.value} 段空着，` : ''}签字才能放行生成。`,
  generate: !briefId.value ? '要先有需求单。'
    : candidatesError.value ? `候选站没读到：${candidatesError.value}`
    : !candidates.value.length ? '这一单还没有候选站：估价与「开始出方案」都在需求单详情里，那一发要人亲手勾确认。'
    : `候选 ${candidates.value.length} 套，建出站 ${deliveredCandidates.value.length} 套。`,
  candidates: !deliveredCandidates.value.length ? '还没有可比较的候选站。'
    : `已发放预览地址 ${previewIssuedCount.value} / ${deliveredCandidates.value.length} 套`
      + (needsHumanCount.value ? `，其中 ${needsHumanCount.value} 套带「待人工」措辞` : '') + '。',
  deliver: currentBrief.value?.siteId ? `这一单已绑定站点 #${currentBrief.value.siteId}。`
    : '客户还没选定（或还没转正）：选定动作在候选画廊与需求单详情里。'
}))

/** 下一步能不能走：只拦「连需求单都还没有」这一种，其余一律放行——步序不是权限，拦人没意义 */
function beforeNext(to: number) {
  const key = STEP_KEYS[to]
  if (key !== 'intake' && !briefId.value) return '先回到第一步选一份需求单（或录一份新的）。'
  return true
}

function onWizardStateChange(value: WizardState) {
  wizard.value = value
  syncQuery(value.current, briefId.value)
}

function selectBrief(value: unknown) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  briefId.value = Number.isFinite(parsed) && parsed > 0 ? parsed : null
  syncQuery(wizard.value.current, briefId.value)
}

function syncQuery(stepIndex: number, id: number | null) {
  const query: Record<string, string> = { step: STEP_KEYS[stepIndex] ?? STEP_KEYS[0] }
  if (id) query.briefId = String(id)
  router.replace({ query })
}

async function loadBriefs() {
  try {
    briefs.value = (await siteBriefsApi.list()) || []
    briefsError.value = ''
    if (!briefId.value && briefs.value.length) {
      briefId.value = briefs.value[0].id
      syncQuery(wizard.value.current, briefId.value)
    }
  } catch (error) {
    briefs.value = []
    briefsError.value = error instanceof Error ? error.message : String(error)
  }
}

async function loadSpec() {
  spec.value = null
  specError.value = ''
  if (!briefId.value) return
  try {
    spec.value = await siteSpecApi.read(briefId.value)
  } catch (error) {
    specError.value = error instanceof Error ? error.message : String(error)
  }
}

async function loadCandidates() {
  candidates.value = []
  candidatesError.value = ''
  if (!briefId.value) return
  try {
    candidates.value = (await briefGenerationApi.candidates(briefId.value)) || []
  } catch (error) {
    candidatesError.value = error instanceof Error ? error.message : String(error)
  }
}

function reloadStepData() {
  loadSpec()
  loadCandidates()
}

function statusText(brief: SiteBrief): string {
  return briefStatusLabel(vocabulary.value, brief.status)
}

/** 「录一份新的」：把第一步那张空表单摊开就地录，不再跳去独立页（独立页还在，只是不再是必经之路） */
function startNewBrief() {
  briefId.value = null
  syncQuery(wizard.value.current, null)
}

/** 表单真存下一单之后向导才认这个号：后面四步读的都是它，列表里先补上这一行免得下拉里查无此单 */
function onIntakeSaved(saved: SiteBrief) {
  if (!saved?.id) return
  if (!briefs.value.some(brief => brief.id === saved.id)) briefs.value = [saved, ...briefs.value]
  briefId.value = saved.id
  syncQuery(wizard.value.current, saved.id)
}

function goBriefDetail() {
  if (!briefId.value) return
  router.push({ name: 'workspace-portal-brief-detail', params: { id: String(briefId.value) } })
}

function goSpec() {
  if (!briefId.value) return
  router.push({ name: 'workspace-portal-brief-spec', params: { brief: String(briefId.value) } })
}

function goCandidates() {
  if (!briefId.value) return
  router.push({ name: 'workspace-portal-brief-candidates', params: { id: String(briefId.value) } })
}

function goSites() {
  router.push({ name: 'workspace-sites', query: briefId.value ? { briefId: String(briefId.value) } : {} })
}

watch(briefId, reloadStepData)

onMounted(async () => {
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
  } catch {
    // 词表只影响状态那一格中文：取不到就露原码，不让它把整页拖成报错
    vocabulary.value = null
  }
  await loadBriefs()
  reloadStepData()
})
</script>

<template>
  <div class="site-wizard">
    <div class="page-header">
      <div>
        <h3>新建网站</h3>
        <p>
          五步一条线：录前采需求单 → AI 出说明书、超管逐段改并签字 → 估价并出 1~3 套候选 → 比较与发预览 → 客户选定后转正。
          每一步下面只摆今天真能做的动作。
        </p>
      </div>
    </div>

    <WizardSteps
      :steps="stepDefs"
      :model-value="wizard"
      :before-next="beforeNext"
      @update:model-value="onWizardStateChange"
    >
      <template #step-intake>
        <a-alert v-if="briefsError" type="error" show-icon>
          <template #message>需求单列表没取到：{{ briefsError }}（不是「一单都没有」，是这一发失败了）</template>
        </a-alert>
        <a-form layout="inline" class="site-wizard__row">
          <a-form-item label="选一张需求单">
            <a-select
              :value="briefId"
              :options="briefs.map(briefOption)"
              :placeholder="briefsError ? '列表读取失败' : (briefs.length ? '选一份已有的需求单' : '一份需求单都还没有')"
              style="width: 360px"
              @update:value="selectBrief"
            />
          </a-form-item>
          <a-form-item>
            <span class="site-wizard__hint">
              {{ currentBrief ? `状态：${statusText(currentBrief)}；这一单要出几套：${currentBrief.candidateCount ?? '-'}（意图，不是已经建出来的套数）` : stepNotice.intake }}
            </span>
          </a-form-item>
        </a-form>
        <a-space class="site-wizard__row">
          <a-button @click="startNewBrief">录一份新需求单</a-button>
          <a-button :disabled="!briefId" @click="goBriefDetail">看这一单的详情（喂模型的那句话在这里）</a-button>
        </a-space>
        <p v-if="!briefsError && !briefs.length" class="site-wizard__hint">
          一份需求单都还没有：第一步就是录它（题目与分段都来自后端前采词表），后面四步都要靠它这一个号。
        </p>
        <!-- 前采本体就地录：这一份和独立页 `BriefIntakeView` 用的是同一个组件，不存在第二套提交形状 -->
        <BriefIntakeForm :brief-id="briefId" embedded @saved="onIntakeSaved" />
      </template>

      <template #step-spec>
        <a-alert v-if="specError" type="error" show-icon>
          <template #message>{{ stepNotice.spec }}</template>
        </a-alert>
        <p class="site-wizard__hint">{{ stepNotice.spec }}</p>
        <ul v-if="spec && spec.status !== 'CONFIRMED' && spec.blockers.length" class="site-wizard__list">
          <li v-for="blocker in spec.blockers" :key="blocker">{{ blocker }}</li>
        </ul>
        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goSpec">去写这一份说明书</a-button>
        </a-space>
        <p class="site-wizard__hint">
          出初稿会真调模型、真花配额，而且整份覆盖改过的字；签字是一次显式动作。这两发都在那一页按，这里不代按。
        </p>
      </template>

      <template #step-generate>
        <a-alert v-if="candidatesError" type="error" show-icon>
          <template #message>{{ stepNotice.generate }}</template>
        </a-alert>
        <p class="site-wizard__hint">{{ stepNotice.generate }}</p>
        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goBriefDetail">去需求单详情估价、开始出方案</a-button>
        </a-space>
        <p class="site-wizard__hint">
          只有已签字那一版说明书会被拿去生成；没签字时后端原话是「SPEC_NOT_CONFIRMED」，界面上照它那句话念。
        </p>
      </template>

      <template #step-candidates>
        <p class="site-wizard__hint">{{ stepNotice.candidates }}</p>
        <a-table
          v-if="deliveredCandidates.length"
          :data-source="deliveredCandidates"
          :columns="[
            { title: '第几套', dataIndex: 'candidateNo', key: 'candidateNo', width: 90 },
            { title: '站点', key: 'site', width: 200 },
            { title: '这套侧重什么', dataIndex: 'focus', key: 'focus' },
            { title: '状态', key: 'status', width: 160 },
            { title: '预览地址', key: 'preview', width: 140 }
          ]"
          :pagination="false"
          row-key="candidateId"
          size="small"
          bordered
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'site'">
              {{ record.siteId ? `${record.siteName || record.siteCode || '（没有名字）'} #${record.siteId}` : '站还没建起来' }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.needsHuman ? 'orange' : 'blue'">
                {{ record.stage || record.status || '状态未知' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'preview'">
              {{ record.previewIssued ? '已发放' : '还没发放' }}
            </template>
            <template v-else>{{ record[column.dataIndex as string] ?? '-' }}</template>
          </template>
        </a-table>
        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goCandidates">打开候选画廊（三套并排比）</a-button>
        </a-space>
        <p class="site-wizard__hint">
          预览令牌绑站不绑页，而且明文只在签发那一刻存在过：所以发放要在画廊里按套亲手点，这一页不自动签。
        </p>
      </template>

      <template #step-deliver>
        <p class="site-wizard__hint">{{ stepNotice.deliver }}</p>
        <a-space class="site-wizard__row">
          <a-button type="primary" :disabled="!briefId" @click="goBriefDetail">回需求单详情做选定与转正</a-button>
          <a-button @click="goSites">到站点清单只看这一单的站</a-button>
        </a-space>
        <p class="site-wizard__hint">
          转正之后这一单才交棒给租户（交付态、计费口径都跟着那一步变），所以这一发必须是人点的，向导不代签。
        </p>
      </template>
    </WizardSteps>
  </div>
</template>

<style scoped>
.site-wizard .page-header {
  margin-bottom: 16px;
}
.site-wizard .page-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}
.site-wizard__row {
  margin-top: 16px;
}
.site-wizard__hint {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 13px;
}
.site-wizard__list {
  margin: 8px 0 0;
  padding-left: 20px;
  color: #6b7280;
  font-size: 13px;
}
</style>
