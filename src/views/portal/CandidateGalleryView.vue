<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  briefDemoModeText,
  briefStatusLabel,
  briefGenerationApi,
  siteBriefsApi,
  vocabularyApi,
  CANDIDATE_SHOT_UNAVAILABLE_TEXT,
  DEMO_CONTENT_DISCLAIMER_TEXT,
  PREVIEW_LINK_PENDING_TEXT,
  siteStatusColor,
  siteStatusText,
  type BriefCandidateProgress,
  type BriefProgress,
  type SiteBrief,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import { siteApi } from '@/api/workspace'
import type { Site as SiteEntity } from '@/types'

/**
 * 候选画廊（Spec-C §7 新增页 / §3.2「三套候选并排成三列卡」）。
 *
 * 每套一张卡，卡里六格，一格都不许含糊：
 * 1. 骨架：来自进度接口那一套的 skeletonName/skeletonKey（后端给的），没生成到那步就明说没有；
 * 2. 「这套侧重什么」：plan 落库的 differentiation 原话（§6.1），一个字都不改写、不概括；
 * 3. 预览链接：带 reviewToken 的地址由生成链路签发（§6.2 末尾一步）随进度下发，可复制；
 *    没有就是没有——令牌的手动补发口属 P4，这里摆按钮就是「谎报到哪一步」；
 * 4. 演示内容：需求单上的档位与数量原话（词表 demoContentModes）+ §9-4 那句防纠纷标注；
 * 5. 子任务状态与失败原因：按套各一条（§6.2 任一步失败只影响该套），没有总百分比；
 * 6. 截图位：今天必须空着并原话解释（§6.7：sidecar 的内网 host 闸拒收预览域，不为截图放宽 SSRF 闸），
 *    不放假缩略图——「拿不相干的图填」是把没有演成完成。
 *
 * 数据来源三条：需求单（套数/档位）、站点列表（V115 build_brief_id 认亲）、进度接口（P3 契约）。
 * 进度读不到时页面照常用站点列表渲染骨架卡，并把错误原文挂在顶上：不静默、不把没取到演成没在跑。
 */

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const brief = ref<SiteBrief | null>(null)
const vocabulary = ref<SiteBriefVocabulary | null>(null)
const vocabularyFailed = ref(false)
const sites = ref<SiteEntity[]>([])
const sitesError = ref('')
const progress = ref<BriefProgress | null>(null)
const progressError = ref('')

function errText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}

function routeBriefId(): number | null {
  const parsed = Number(route.params.id)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const briefId = computed(() => routeBriefId())

/**
 * 卡面数组：按需求单的 candidateCount 排出第 1..N 套的槽，再把三种来源拼进来。
 * 槽一定排满——「出 3 套」是单子上写死的，一排在跑/一失败/一没建出来是三种不同的实话，
 * 只列已经存在的那几行会把「还没建出来」演成「当初就只有两套」。
 */
interface CandidateSlot {
  candidateNo: number
  site: SiteEntity | null
  row: BriefCandidateProgress | null
}

const slots = computed<CandidateSlot[]>(() => {
  // 套数就是单子上写死的那个值：candidate.max-count 的闸在后端（拍板 4），这里不再自设上限
  const count = Math.max(0, brief.value?.candidateCount ?? 0)
  const briefSites = sites.value.filter(site => site.buildBriefId === briefId.value)
  const rows = progress.value?.candidates ?? []
  const out: CandidateSlot[] = []
  for (let no = 1; no <= count; no += 1) {
    out.push({
      candidateNo: no,
      site: briefSites.find(site => site.candidateNo === no) ?? null,
      row: rows.find(item => item.candidateNo === no) ?? null
    })
  }
  // 进度回里编号超出 1..N（异常数据）或没编号的行也要露出来，不能被槽位吞掉
  rows
    .filter(item => item.candidateNo == null || item.candidateNo < 1 || item.candidateNo > count)
    .forEach(item => out.push({ candidateNo: item.candidateNo ?? 0, site: null, row: item }))
  briefSites
    .filter(site => site.candidateNo == null || site.candidateNo < 1 || site.candidateNo > count)
    .forEach(site => out.push({ candidateNo: site.candidateNo ?? 0, site, row: null }))
  return out
})

const demoModeText = computed(() => briefDemoModeText(vocabulary.value, brief.value?.demoContentMode))
const briefStatusText = computed(() =>
  briefStatusLabel(vocabulary.value, brief.value?.status, brief.value?.statusLabel)
)

/** 卡上的站名：站点行优先，其次进度行报的 siteId，都没有就是还没建出来 */
function slotSiteLabel(slot: CandidateSlot): string {
  if (slot.site) return slot.site.name || slot.site.code || `站点 #${slot.site.id ?? '?'}`
  if (slot.row?.siteId) return `站点 #${slot.row.siteId}（站点列表里没这行）`
  return '还没建出来'
}

function slotStatusText(slot: CandidateSlot): string {
  const status = slot.site?.status ?? slot.row?.siteStatus
  if (!status && !slot.row) return '没建出来'
  if (!status) return '没有站点状态（子任务在跑，站还没落库）'
  return siteStatusText(status)
}

function slotStatusColor(slot: CandidateSlot): string {
  return siteStatusColor(slot.site?.status ?? slot.row?.siteStatus ?? '')
}

function skeletonText(slot: CandidateSlot): string {
  const row = slot.row
  if (!row?.skeletonKey && !row?.skeletonName) return '后端还没给这一套的骨架（生成链路没跑到那一步，或进度口还没上线）'
  return row.skeletonName || row.skeletonKey || ''
}

/** 中文名只认后端带的 label；取不到露原码（I-1：不抄第二份阶段词表） */
function subtaskText(slot: CandidateSlot): string {
  const row = slot.row
  if (!row) return '没有子任务记录（进度接口没回这一套）'
  return row.statusLabel || row.status
}

function stageText(slot: CandidateSlot): string {
  const row = slot.row
  if (!row) return '—'
  return row.stageLabel || row.stage || '还没进入阶段'
}

async function copyPreview(slot: CandidateSlot) {
  const url = slot.row?.previewUrl
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    message.success('预览地址已复制：带 reviewToken，别把它当正式域名发（转正才填客户域名）')
  } catch {
    message.warning(`浏览器不肯给剪贴板权限：手动复制下面的地址 → ${url}`)
  }
}

function goDetail() {
  const id = briefId.value
  if (id === null) return
  router.push({ name: 'workspace-portal-brief-detail', params: { id: String(id) } })
}

async function loadAll() {
  const id = briefId.value
  if (id === null) {
    loadError.value = '地址里的需求单号不是一个正整数，候选读不出来'
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
  }
  vocabularyFailed.value = false
  try {
    vocabulary.value = await vocabularyApi.adminVocabulary()
  } catch {
    vocabulary.value = null
    vocabularyFailed.value = true
  }
  sitesError.value = ''
  try {
    const list = await siteApi.list()
    sites.value = list || []
  } catch (error) {
    sites.value = []
    sitesError.value = errText(error)
  }
  progressError.value = ''
  try {
    progress.value = await briefGenerationApi.progress(id)
  } catch (error) {
    // 进度口（P3 契约）没上线时这一句原文挂顶；卡面退回站点列表那份真相，不演
    progress.value = null
    progressError.value = errText(error)
  }
  loading.value = false
}

onMounted(loadAll)
</script>

<template>
  <div class="candidate-gallery">
    <div class="page-header candidate-gallery__head">
      <div>
        <h3>候选画廊 · 需求单 #{{ briefId ?? '?' }}</h3>
        <p class="candidate-gallery__sub">
          并排比较每一套：骨架、「这套侧重什么」、预览链接、演示内容口径、子任务进度各一列。
          候选是按套各一条子任务的——哪套在跑、哪套失败、失败缺什么，都在各自的卡上，这里没有假装同步的总百分比。
        </p>
      </div>
      <a-space wrap>
        <a-tag>{{ briefStatusText }}</a-tag>
        <a-button @click="loadAll">刷新</a-button>
        <a-button @click="goDetail">回需求单详情</a-button>
      </a-space>
    </div>

    <a-alert v-if="loadError" type="error" show-icon class="candidate-gallery__alert">
      <template #message>
        需求单没读到：{{ loadError }}
        <a-button size="small" type="link" @click="loadAll">重试</a-button>
      </template>
    </a-alert>
    <a-alert v-if="progressError" type="warning" show-icon class="candidate-gallery__alert">
      <template #message>
        进度没读到（这一发走的是 Spec-C §5 的 P3 契约口；后端没上线时就是下面这句原文，不是「没在跑」）：
        {{ progressError }}
      </template>
    </a-alert>
    <a-alert v-if="sitesError" type="warning" show-icon class="candidate-gallery__alert">
      <template #message>站点列表没取到（{{ sitesError }}）：卡上「有没有这一站」那一格刷新重试才有。</template>
    </a-alert>
    <p v-if="vocabularyFailed" class="candidate-gallery__muted">
      词表没取到：演示内容那一格只能露档位原码，中文刷新重试才有（这里不抄第二份）。
    </p>

    <p v-if="!loading && !loadError && !slots.length" class="candidate-gallery__muted">
      这一单还没出过套数（抬头里的候选套数读不出来或为 0）：回详情页走完②的门禁再来看。
    </p>

    <div class="candidate-gallery__grid">
      <a-card
        v-for="slot in slots"
        :key="`${slot.candidateNo}-${slot.site?.id ?? 'nosite'}`"
        size="small"
        class="candidate-gallery__card"
      >
        <template #title>
          第 {{ slot.candidateNo || '?' }} 套 · {{ slotSiteLabel(slot) }}
        </template>
        <div class="candidate-gallery__row">
          <a-tag :color="slotStatusColor(slot)">{{ slotStatusText(slot) }}</a-tag>
          <span class="candidate-gallery__muted">子任务：{{ subtaskText(slot) }} · 阶段：{{ stageText(slot) }}</span>
        </div>
        <p v-if="slot.row?.errorMessage" class="candidate-gallery__error">
          失败原因（后端原话）：{{ slot.row.errorMessage }}
        </p>

        <!-- 截图位：今天必须空着并原话解释（§6.7 / N-4），不许放假缩略图 -->
        <div class="candidate-gallery__shot">
          <p class="candidate-gallery__shot-note">{{ CANDIDATE_SHOT_UNAVAILABLE_TEXT }}</p>
        </div>

        <p class="candidate-gallery__line"><b>骨架：</b>{{ skeletonText(slot) }}</p>
        <p class="candidate-gallery__line">
          <b>这套侧重什么：</b>
          <template v-if="slot.row?.differentiation">{{ slot.row.differentiation }}</template>
          <span v-else class="candidate-gallery__muted">
            后端还没落这句原话（plan 步骤没跑到、或进度口还没上线）——「三套的侧重」由 plan 产出并落库，界面只转述
          </span>
        </p>
        <p class="candidate-gallery__line">
          <b>演示内容：</b>{{ demoModeText }}
          <span class="candidate-gallery__disclaimer">{{ DEMO_CONTENT_DISCLAIMER_TEXT }}</span>
        </p>
        <p class="candidate-gallery__line">
          <b>预览链接：</b>
          <template v-if="slot.row?.previewUrl">
            <span class="candidate-gallery__url">{{ slot.row.previewUrl }}</span>
            <a-button size="small" @click="copyPreview(slot)">复制</a-button>
          </template>
          <span v-else class="candidate-gallery__muted">{{ PREVIEW_LINK_PENDING_TEXT }}</span>
        </p>
      </a-card>
    </div>

    <p class="candidate-gallery__muted">
      客户在预览里看到的就是这一套站本身（页面 + 演示内容）；选择页与「就这套」属 P4，今天不在这里。
    </p>
  </div>
</template>

<style scoped>
.candidate-gallery .page-header {
  margin-bottom: 16px;
}
.candidate-gallery__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.candidate-gallery__head h3 {
  margin: 0 0 4px;
}
.candidate-gallery__sub,
.candidate-gallery__muted {
  color: #6b7280;
  font-size: 13px;
}
.candidate-gallery__alert {
  margin-bottom: 12px;
}
.candidate-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}
.candidate-gallery__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.candidate-gallery__shot {
  min-height: 96px;
  margin-bottom: 8px;
  padding: 12px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
}
.candidate-gallery__shot-note {
  margin: 0;
  color: #8c8c8c;
  font-size: 12px;
  text-align: center;
}
.candidate-gallery__line {
  margin: 6px 0;
  font-size: 13px;
  word-break: break-word;
}
.candidate-gallery__error {
  margin: 6px 0;
  color: #cf1322;
  font-size: 12px;
}
.candidate-gallery__disclaimer {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  color: #d46b08;
  border: 1px solid #ffd591;
  border-radius: 4px;
  font-size: 12px;
}
.candidate-gallery__url {
  display: inline-block;
  max-width: 220px;
  overflow-wrap: anywhere;
  font-family: monospace;
  font-size: 12px;
  vertical-align: middle;
}
</style>
