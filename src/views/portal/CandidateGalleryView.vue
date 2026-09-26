<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  briefDemoModeText,
  briefStatusLabel,
  briefGenerationApi,
  isArchivedSite,
  siteBriefsApi,
  vocabularyApi,
  CANDIDATE_SHOT_UNAVAILABLE_TEXT,
  DEMO_CONTENT_DISCLAIMER_TEXT,
  PREVIEW_LINK_PENDING_TEXT,
  siteStatusColor,
  siteStatusText,
  type BriefCandidateProgress,
  type BriefPreviewLink,
  type SiteBrief,
  type SiteBriefVocabulary
} from '@/api/siteBriefs'
import { resolvePreviewUrl } from '@/api/siteBriefDelivery'
import { portalSkeletonsApi, type SkeletonView } from '@/api/portalSkeletons'
import { siteApi } from '@/api/workspace'
import type { Site as SiteEntity } from '@/types'

/**
 * 候选画廊（Spec-C §7 新增页 / §3.2「三套候选并排成三列卡」）。
 *
 * 每套一张卡，卡里七格，一格都不许含糊：
 * 1. 骨架：进度口只回 `skeletonKey`，中文名去**骨架库**那一份列表里查（key→name 的唯一出处）；
 *    查不到就露 key 并说明查不到，绝不在这里写一份「site-brief-a → 商务风」的映射；
 * 2. 「这套侧重什么」：plan 落库的 `focus` 原话（§6.1），一个字都不改写、不概括；
 * 3. 预览链接：点了「签发预览地址」才调适配层那一个手动签发口（§5 第四行）。
 *    令牌是准入，不在一次页面加载里给三套各签一枚；后端回的是相对路径时按当前 origin 拼（唯一的拼法
 *    在 `siteBriefDelivery.resolvePreviewUrl`，这里不写第二份）。转正/归档之后后端明令拒签（拍板 3A），
 *    那一发的中文原话照挂，不摆一个永远点不出的假按钮；
 * 4. 演示内容：需求单档位原话 + 这一套真落库的篇数/条数（进度口带的）+ §9-4 那句防纠纷标注；
 * 5. 子任务状态与失败原因：按套各一条（§6.2 任一步失败只影响该套），没有总百分比；
 * 6. 配图的三本账：成功几张 / 失败几张 / 跳过几张——跳过不等于失败（拍板 8B），
 *    把 skipped 混进 failed 就是「没出图」与「按设计先不花这钱」两件事说成一件；
 * 7. 截图位：今天必须空着并原话解释（§6.7：sidecar 的内网 host 闸拒收预览域，不为截图放宽 SSRF 闸），
 *    不放假缩略图——「拿不相干的图填」是把没有演成完成。
 *
 * 数据来源四条：需求单（套数/档位）、进度口（每套一行，含 focus 与三本账）、站点列表（V115
 * `build_brief_id` 认亲）、骨架库（key→中文名）。进度读不到时页面照常用站点列表渲染骨架卡，
 * 并把错误原文挂在顶上：不静默、不把没取到演成没在跑。
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
/** 进度口的形状就是**一个数组**（每套一行）：以前按 `{candidates:[…]}` 读，这一页永远显示空清单 */
const progress = ref<BriefCandidateProgress[] | null>(null)
const progressError = ref('')
/** 骨架库：进度口只给 key，中文名只有这一处出处（I-4：骨架是数据资产，不写进代码） */
const skeletons = ref<SkeletonView[]>([])
const skeletonsError = ref('')
/** 已签发的预览地址：按站点 id 存，签一次留一次，刷新页面不会凭空多签几枚令牌 */
const previewLinks = ref<Record<number, BriefPreviewLink>>({})
const previewErrors = ref<Record<number, string>>({})
const issuingSiteId = ref<number | null>(null)
const revokingSiteId = ref<number | null>(null)

function errText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}

function routeBriefId(): number | null {
  const parsed = Number(route.params.id)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const briefId = computed(() => routeBriefId())

/**
 * 卡面数组：按需求单的 candidateCount 排出第 1..N 套的槽，再把四种来源拼进来。
 * 槽一定排满——「出 3 套」是单子上写死的，一排在跑/一失败/一没建出来是三种不同的实话，
 * 只列已经存在的那几行会把「还没建出来」演成「当初就只有两套」。
 */
interface CandidateSlot {
  candidateNo: number
  site: SiteEntity | null
  row: BriefCandidateProgress | null
}

/**
 * 本单名下的站，按套号认槽。
 *
 * <p>匹配次序是「进度行报的 siteId 优先，其次在**没归档**的行里按套号找」：
 * 重跑一轮会再建一套同号的候选站，上一轮那套转成 archived 留在库里备查（拍板 3A 不删）。
 * 以前只按 `candidateNo` 找，找到哪一轮全看列表顺序——于是画廊把上一轮的归档站当成本轮那一套，
 * 站名、状态、链接三格说的都是别人的事。</p>
 */
const briefSites = computed<SiteEntity[]>(() =>
  sites.value.filter(site => site.buildBriefId === briefId.value)
)

function siteOfSlot(row: BriefCandidateProgress | null, candidateNo: number): SiteEntity | null {
  if (row?.siteId != null) {
    const exact = briefSites.value.find(site => site.id === row.siteId)
    // 进度行报了 siteId 但站点列表里没有（分页没 cover 到 / 被删）：不退回按套号乱配一行
    return exact ?? null
  }
  return briefSites.value.find(site => site.candidateNo === candidateNo && !isArchivedSite(site)) ?? null
}

const slots = computed<CandidateSlot[]>(() => {
  // 套数就是单子上写死的那个值：candidate.max-count 的闸在后端（拍板 4），这里不再自设上限
  const count = Math.max(0, brief.value?.candidateCount ?? 0)
  const rows = progress.value ?? []
  const out: CandidateSlot[] = []
  for (let no = 1; no <= count; no += 1) {
    const row = rows.find(item => item.candidateNo === no) ?? null
    out.push({ candidateNo: no, site: siteOfSlot(row, no), row })
  }
  // 进度回里编号超出 1..N（异常数据）或没编号的行也要露出来，不能被槽位吞掉
  rows
    .filter(item => item.candidateNo == null || item.candidateNo < 1 || item.candidateNo > count)
    .forEach(item => out.push({ candidateNo: item.candidateNo ?? 0, site: siteOfSlot(item, item.candidateNo ?? 0), row: item }))
  briefSites.value
    .filter(site => !rows.some(item => item.siteId === site.id)
      && (site.candidateNo == null || site.candidateNo < 1 || site.candidateNo > count))
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

/** 站点状态只有站点行有：进度口回的是**子任务**状态码，拿它当站点状态就是两件事混一件 */
function slotStatusText(slot: CandidateSlot): string {
  const status = slot.site?.status
  if (status) return siteStatusText(status)
  if (slot.row?.siteId) return '站点行没取到（列表分页没 cover 到，或这一行已被删）'
  if (slot.row) return '没有站点状态（子任务在跑，站还没落库）'
  return '没建出来'
}

function slotStatusColor(slot: CandidateSlot): string {
  return siteStatusColor(slot.site?.status ?? '')
}

/** 中文名只认骨架库那一份（key→name）；查不到就露 key 并说清查不到，不自己起一个名 */
function skeletonText(slot: CandidateSlot): string {
  const key = slot.row?.skeletonKey
  if (!key) return '后端还没给这一套的骨架（plan 那一步没跑到，或进度口没回这一行）'
  const found = skeletons.value.find(skeleton => skeleton.skeletonKey === key)
  if (found?.name) return `${found.name}（key：${key}）`
  const why = skeletonsError.value ? `骨架库没取到（${skeletonsError.value}）` : '骨架库里没有这个 key'
  return `${key}（${why}，这里只有 key 这一份真相，不另起一个名字）`
}

/** 「这套侧重什么」：plan 落库的 focus 原话，一个字不改写 */
function focusText(slot: CandidateSlot): string {
  const focus = slot.row?.focus
  if (focus && focus.trim()) return focus
  if (!slot.row) return '进度口没回这一套，所以没有侧重可显示'
  return '后端还没落这句原话（plan 步骤没跑到）——「三套的侧重」由 plan 产出并落库，界面只转述'
}

/** 演示内容的实际落库数：进度口回了就以它为准，没回才只说需求单上的档位 */
function demoActualText(slot: CandidateSlot): string {
  const row = slot.row
  if (!row || (row.demoArticles == null && row.demoCases == null)) return ''
  return `实际落了文章 ${row.demoArticles ?? 0} 篇 / 案例 ${row.demoCases ?? 0} 条`
}

/** 配图三本账：只在进度口真回了数字时才说，跳过与失败分开讲（拍板 8B） */
function imageText(slot: CandidateSlot): string {
  const row = slot.row
  if (!row || (row.imageDone == null && row.imageFailed == null && row.imageSkipped == null)) return ''
  const done = row.imageDone ?? 0
  const failed = row.imageFailed ?? 0
  const skipped = row.imageSkipped ?? 0
  const parts = [`成功 ${done} 张`]
  if (failed) parts.push(`失败 ${failed} 张`)
  if (skipped) parts.push(`跳过 ${skipped} 张（没图不影响这一套，交付后由人上传）`)
  return parts.join(' / ')
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

function siteIdOf(slot: CandidateSlot): number | null {
  const id = slot.site?.id ?? slot.row?.siteId
  return typeof id === 'number' ? id : null
}

function previewOf(slot: CandidateSlot): BriefPreviewLink | null {
  const id = siteIdOf(slot)
  return id === null ? null : previewLinks.value[id] ?? null
}

function previewHref(slot: CandidateSlot): string {
  return resolvePreviewUrl(previewOf(slot)?.previewUrl)
}

/**
 * 手动签发这一套的预览地址（§5）。
 *
 * <p>它是**写动作**（给这一站新开一条 14 天的 review 会话），所以只在人点上时发一次，
 * 不在 loadAll 里替三套各签一枚。后端对非候选身份（已转正/已归档）回一句中文拒，
 * 那句话原样挂在卡上——这一格从此就是「为什么这里点不出链接」的答案。</p>
 */
async function issuePreview(slot: CandidateSlot) {
  const id = siteIdOf(slot)
  if (id === null) return
  issuingSiteId.value = id
  try {
    const link = await briefGenerationApi.previewLink(id, `画廊手动签发：第 ${slot.candidateNo} 套`)
    if (link) previewLinks.value = { ...previewLinks.value, [id]: link }
    const next = { ...previewErrors.value }
    delete next[id]
    previewErrors.value = next
    message.success('已签发一条预览地址：带 reviewToken，别把它当正式域名发（转正才填客户域名）')
  } catch (error) {
    previewErrors.value = { ...previewErrors.value, [id]: errText(error) }
    message.error(errText(error))
  } finally {
    issuingSiteId.value = null
  }
}

async function copyPreview(slot: CandidateSlot) {
  const url = previewHref(slot)
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    message.success('预览地址已复制：带 reviewToken，别把它当正式域名发（转正才填客户域名）')
  } catch {
    message.warning(`浏览器不肯给剪贴板权限：手动复制下面的地址 → ${url}`)
  }
}

/** 撤销这一套发出去的全部令牌（拍板 11：可撤销可重发；站与内容都留着，只是不再可见） */
async function revokePreview(slot: CandidateSlot) {
  const id = siteIdOf(slot)
  if (id === null) return
  revokingSiteId.value = id
  try {
    const count = await briefGenerationApi.revokePreviewLinks(id)
    const links = { ...previewLinks.value }
    delete links[id]
    previewLinks.value = links
    message.success(`已撤销 ${count ?? 0} 条预览令牌：站与内容都还在，旧链接从此打不开`)
  } catch (error) {
    message.error(errText(error))
  } finally {
    revokingSiteId.value = null
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
  skeletonsError.value = ''
  try {
    skeletons.value = (await portalSkeletonsApi.list()) || []
  } catch (error) {
    skeletons.value = []
    skeletonsError.value = errText(error)
  }
  progressError.value = ''
  try {
    const rows = await briefGenerationApi.progress(id)
    progress.value = rows ?? []
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
          并排比较每一套：骨架、「这套侧重什么」（plan 落库的 focus 原话）、预览链接、演示内容口径、配图三本账、子任务进度各一列。
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
    <a-alert v-if="skeletonsError" type="warning" show-icon class="candidate-gallery__alert">
      <template #message>
        骨架库没取到（{{ skeletonsError }}）：卡上「骨架」那一格只能露 key——骨架的中文名只有骨架库那一份，
        这里不另起一个名字。
      </template>
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
        <p v-if="slot.row?.notices?.length" class="candidate-gallery__line">
          <b>这一套的降级说明（后端原话）：</b>{{ slot.row.notices.join('；') }}
        </p>

        <!-- 截图位：今天必须空着并原话解释（§6.7 / N-4），不许放假缩略图 -->
        <div class="candidate-gallery__shot">
          <p class="candidate-gallery__shot-note">{{ CANDIDATE_SHOT_UNAVAILABLE_TEXT }}</p>
        </div>

        <p class="candidate-gallery__line"><b>骨架：</b>{{ skeletonText(slot) }}</p>
        <p class="candidate-gallery__line">
          <b>这套侧重什么：</b>{{ focusText(slot) }}
        </p>
        <p class="candidate-gallery__line">
          <b>演示内容：</b>{{ demoModeText }}
          <span v-if="demoActualText(slot)"> · {{ demoActualText(slot) }}</span>
          <span class="candidate-gallery__disclaimer">{{ DEMO_CONTENT_DISCLAIMER_TEXT }}</span>
        </p>
        <p v-if="imageText(slot)" class="candidate-gallery__line"><b>配图：</b>{{ imageText(slot) }}</p>
        <p class="candidate-gallery__line">
          <b>预览链接：</b>
          <template v-if="previewOf(slot)">
            <a
              class="candidate-gallery__url"
              :href="previewHref(slot)"
              target="_blank"
              rel="noopener"
            >{{ previewHref(slot) }}</a>
            <a-space size="small" wrap>
              <a-button size="small" @click="copyPreview(slot)">复制</a-button>
              <a-popconfirm
                title="撤销会把这一套发出去的全部预览令牌作废：站与内容都留着，客户手里的旧链接当场打不开。确认？"
                ok-text="撤销"
                cancel-text="先不"
                @confirm="revokePreview(slot)"
              >
                <a-button size="small" :loading="revokingSiteId === siteIdOf(slot)">撤销这一套全部令牌</a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <template v-else-if="siteIdOf(slot) !== null">
            <a-button
              size="small"
              :loading="issuingSiteId === siteIdOf(slot)"
              @click="issuePreview(slot)"
            >签发预览地址</a-button>
            <span class="candidate-gallery__muted">这一格今天还没有地址：令牌要点一下才签，页面加载不替三套各签一枚。</span>
          </template>
          <span v-else class="candidate-gallery__muted">{{ PREVIEW_LINK_PENDING_TEXT }}</span>
          <span v-if="siteIdOf(slot) !== null && previewErrors[siteIdOf(slot) as number]" class="candidate-gallery__error">
            签发被后端拒了（原话）：{{ previewErrors[siteIdOf(slot) as number] }}
          </span>
        </p>
      </a-card>
    </div>

    <p class="candidate-gallery__muted">
      客户在预览里看到的就是这一套站本身（页面 + 演示内容）；客户在自己那条链接上看到选择页、回一句「就这套」，超管回这一页转正交棒。
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
