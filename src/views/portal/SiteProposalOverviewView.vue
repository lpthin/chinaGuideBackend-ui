<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { briefGenerationApi, formatWaitMs, showcaseBatchLineOf, type BriefOverviewRound, type BriefWorkbenchOverview } from '@/api/siteBriefs'
import FoldedText from '@/components/FoldedText.vue'
import PageTitle from '@/components/PageTitle.vue'

/**
 * 超管侧「建站任务总览」（Spec-M §10.44 拍板 ⑩，M-P33 批 D）。
 *
 * 这一页回答的是向导那一侧回答不了的问题：向导说的是<b>一单</b>跑到哪一步，而手上同时有几单在跑、
 * 谁在等池子、各家已经烧了多少，只有站在全平台那一格才看得见。
 *
 * 三条排版口径（都是从这条链上的既有纪律抄的，不是这里新立的）：
 * 1. **一个字都不写**。这里没有任何能启动、取消、补跑任何东西的把手——那三样各有各的写口，
 *    给一条付费流水线开第二个入口就是第二套真相。
 * 2. **同一趟只许一份读数**（M-P16 #248）。每一单里那几套候选直接摊后端 `progress` 那一份数组
 *    （总览口内部调的就是它），等待、历史实测区间那五格都是它算好的原话，这里不另算、不另拼句子。
 * 3. **读不到就露空**。数字为空一律念「后端这一发没回」而不是 0；`tenantName` 读不到就露 `#id`，
 *    不编一个「未知租户」顶着（M-P18「等待不许谎报成在跑」同一条刀口）。
 *
 * 为什么这一页没有 SSE：一单内部的实时跟随已经有 `progress/stream` 那条流了（批 C），
 * 而这一页看的是 N 单 × 全平台。给每一单各挂一条 20 分钟的推送，代价是 N 条工作线程，
 * 换来的信息量与 10 秒读一次没有区别——所以这里只在<b>真有东西在跑</b>时按时读一眼，全停就停表。
 */

const OVERVIEW_POLL_MS = 10000

const router = useRouter()

const loading = ref(false)
const readError = ref('')
const overview = ref<BriefWorkbenchOverview | null>(null)
const lastReadAt = ref('')

let timer: ReturnType<typeof setInterval> | null = null

const rounds = computed<BriefOverviewRound[]>(() => overview.value?.rounds ?? [])
const drafts = computed(() => overview.value?.drafts ?? [])
const pools = computed(() => overview.value?.pools ?? [])

/**
 * 空态的成因只认后端那一格（M-P37 拍板 ⑤）：
 * `NONE` 才许说「查过了，真没有」；`NOT_VISIBLE` 那一句是后端拼好的，逐字念；
 * 后端没回成因时界面不替它猜一个，只报「这一发没有行」这个自己看得见的事实。
 */
const emptyReason = computed(() => overview.value?.emptyReason ?? '')
const emptyLine = computed(() => overview.value?.emptyLine ?? '')

/** 还有没有值得继续读的东西：一单在跑或一份初稿在跑才续表，全空就停（不许挂一条永远在打的读） */
const anythingInFlight = computed(() => rounds.value.length > 0 || drafts.value.length > 0)

const headerLine = computed(() => {
  if (readError.value) return `总览没读到：${readError.value}`
  if (!overview.value) return loading.value ? '正在读全平台这一格…' : ''
  return `现在同时在跑 ${overview.value.runningRounds ?? 0} 单出方案、${overview.value.runningDrafts ?? 0} 份说明书初稿`
})

async function readOverview() {
  loading.value = true
  try {
    // 不传 tenantId：后端按 TenantGuard 那一条既有口径决定——顶栏选进了哪一家就只看那一家，没选就是全平台。
    // 这一页自己再摆一个租户下拉等于给「我在看哪家」留两处真相。
    overview.value = await briefGenerationApi.overview()
    readError.value = ''
    lastReadAt.value = new Date().toLocaleTimeString('zh-CN')
  } catch (ex: any) {
    readError.value = ex?.response?.data?.message || ex?.message || String(ex)
  } finally {
    loading.value = false
    // 全平台都空了就停表：续表只在有东西在跑的时候才有意义
    if (!anythingInFlight.value) stopTimer()
  }
}

function startTimer() {
  if (timer) return
  timer = setInterval(readOverview, OVERVIEW_POLL_MS)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function reload() {
  readOverview().then(() => {
    if (anythingInFlight.value) startTimer()
  })
}

/** 整套的等待那一格：直接复用 progress 那一份读数与那句终态就不念的规矩 */
function waitOf(row: { stageWaitMs?: number | null; status?: string | null }): string {
  if (row.status === 'succeeded' || row.status === 'failed') {
    return '这一套已进终态，不再念等了'
  }
  return formatWaitMs(row.stageWaitMs)
}

function burnedOf(row: BriefOverviewRound): string {
  return row.burnedTokens == null ? '后端这一发没回实烧数' : `${row.burnedTokens} token（这一轮的候选行实报合计）`
}

function elapsedOf(row: BriefOverviewRound): string {
  if (row.roundElapsedMs == null) {
    return row.roundStartedAt ? '这一单已经没有在跑的那一步了，所以不念已跑多久' : '后端这一发没回开始时刻'
  }
  return formatWaitMs(row.roundElapsedMs)
}

function goWizard(row: BriefOverviewRound) {
  router.push({ path: '/workspace/portal/wizard', query: { step: 'generate', briefId: String(row.briefId) } })
}

onMounted(() => {
  readOverview().then(() => {
    if (anythingInFlight.value) startTimer()
  })
})

onBeforeUnmount(stopTimer)
</script>

<template>
  <div class="proposal-overview">
    <PageTitle />
    <div class="proposal-overview__head">
      <div>
        <p class="proposal-overview__lead">{{ headerLine }}</p>
        <p v-if="lastReadAt" class="proposal-overview__muted">
          上次读数 {{ lastReadAt }}
          <template v-if="anythingInFlight">；有东西在跑，这一页每 10 秒自己读一次（全停下来就不读了）。</template>
          <template v-else>；今天没有东西在跑，这一页不再自己读，要看就点刷新。</template>
        </p>
      </div>
      <a-space>
        <a-button :loading="loading" @click="reload">刷新</a-button>
      </a-space>
    </div>

    <a-alert v-if="readError" type="error" show-icon class="proposal-overview__alert">
      <template #message>
        总览没读到：{{ readError }}
        <a-button size="small" type="link" @click="reload">重试</a-button>
      </template>
    </a-alert>

    <a-card v-if="pools.length" size="small" title="线程池（本进程瞬时快照）" class="proposal-overview__card">
      <p v-for="pool in pools" :key="pool.name" class="proposal-overview__line">{{ pool.line }}</p>
      <p class="proposal-overview__muted">
        这两句里的「队列里还有几个」是池子真数出来的任务数，它没有名字——任务体里没带需求单号，
        所以谁在等只能从下面每一单那一格看（「已受理、还没开始」那一格就是它）。
      </p>
    </a-card>

    <a-card size="small" title="在跑的出方案单" class="proposal-overview__card">
      <p v-if="!loading && overview && !rounds.length" class="proposal-overview__muted">
        <template v-if="emptyReason === 'NONE'">
          今天没有任何一单处在「方案生成中」。这不是坏了，是没人点——一家租户同时只许一单，
          第二单在受理那一步就被中文拒绝，所以这里最多每家一条。
        </template>
        <template v-else-if="emptyLine">{{ emptyLine }}</template>
        <template v-else>这一格这一发没有行（成因后端没回，界面不替它猜）。</template>
      </p>
      <div v-for="round in rounds" :key="round.briefId" class="proposal-overview__round">
        <a-divider v-if="round.briefId !== rounds[0]?.briefId" style="margin: 12px 0" />
        <div class="proposal-overview__round-head">
          <b>需求单 #{{ round.briefId }}</b>
          <span>· 归属：{{ round.tenantName || (round.tenantId == null ? '这一单没有归属租户' : `#${round.tenantId}`) }}</span>
          <a-tag color="processing">{{ round.briefStatusLabel || round.briefStatus || '状态原码没回' }}</a-tag>
          <span v-if="round.attempt != null">· 第 {{ round.attempt }} 轮</span>
          <a-button size="small" type="link" @click="goWizard(round)">进这一单的向导</a-button>
        </div>
        <p class="proposal-overview__line">
          <b>整单：</b>{{ elapsedOf(round) }} · <b>这一轮已烧：</b>{{ burnedOf(round) }}
          <template v-if="round.estimatedTokens != null"> · <b>本轮预估：</b>{{ round.estimatedTokens }}</template>
          <template v-if="round.candidateTotal != null">
            · <b>套数：</b>{{ round.terminalCount ?? 0 }}/{{ round.candidateTotal }} 已进终态，{{ round.runningCount ?? 0 }} 套在跑
          </template>
        </p>
        <p v-if="round.waitingLine" class="proposal-overview__waiting">{{ round.waitingLine }}</p>

        <table class="proposal-overview__table">
          <thead>
            <tr>
              <th>第几套</th>
              <th>阶段</th>
              <th>状态</th>
              <th>这一步已经等了</th>
              <th>以往实测（一发）</th>
              <th>这一套已烧</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in round.candidates ?? []" :key="`${round.briefId}-${row.candidateNo}`">
              <td>{{ row.candidateNo ?? '?' }}</td>
              <td>{{ row.stageLabel || row.stage || '-' }}</td>
              <td>{{ row.statusLabel || row.status }}</td>
              <td>
                {{ waitOf(row) }}
                <!-- 分批那一格的话也只有一份出处（`showcaseBatchLineOf`），这一页不另拼一句；
                     后端没回批号就整行不摆，不许摆成「第 ? 批」 -->
                <div v-if="showcaseBatchLineOf(row)" class="proposal-overview__batch">{{ showcaseBatchLineOf(row) }}</div>
              </td>
              <td class="proposal-overview__muted">{{ row.stageLatencyNote || '后端这一发没回区间' }}</td>
              <td>{{ (row.promptTokens ?? 0) + (row.completionTokens ?? 0) }}</td>
            </tr>
            <tr v-if="!(round.candidates ?? []).length">
              <td colspan="6" class="proposal-overview__muted">
                进度那一口这一发没回行（读不到不等于没在跑，刷新重试才有）。
              </td>
            </tr>
          </tbody>
        </table>

        <FoldedText
          v-if="round.tenantBurn?.lines?.length"
          :raw="round.tenantBurn.lines.join('\n')"
          summary="这一家名下这条链历史上已经烧掉的那一份账"
          raw-label="已烧的账（后端原话逐字）"
        />
      </div>
    </a-card>

    <a-card size="small" title="在跑的说明书初稿" class="proposal-overview__card">
      <p v-if="!loading && overview && !drafts.length" class="proposal-overview__muted">
        <template v-if="emptyReason === 'NONE'">
          没有一份初稿在跑。这一族跑一次是模型写七段那一发，跑完就把状态落进说明书那一页。
        </template>
        <template v-else-if="emptyLine">{{ emptyLine }}</template>
        <template v-else>这一格这一发没有行（成因后端没回，界面不替它猜）。</template>
      </p>
      <p v-for="draft in drafts" :key="draft.briefId" class="proposal-overview__line">
        <b>需求单 #{{ draft.briefId }}</b>
        · 归属：{{ draft.tenantName || (draft.tenantId == null ? '没有归属租户' : `#${draft.tenantId}`) }}
        · {{ draft.draftStatusLabel || draft.draftStatus || '状态原码没回' }}
        · 已等：{{ formatWaitMs(draft.waitMs) }}
        <template v-if="draft.errorMessage">· 失败原因：{{ draft.errorMessage }}</template>
      </p>
    </a-card>

    <p v-if="overview?.note" class="proposal-overview__note">{{ overview.note }}</p>
  </div>
</template>

<style scoped>
.proposal-overview {
  padding: 16px;
}
.proposal-overview__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.proposal-overview__lead {
  margin: 0;
}
.proposal-overview__muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.proposal-overview__alert,
.proposal-overview__card {
  margin-top: 12px;
}
.proposal-overview__line {
  margin: 4px 0;
  font-size: 13px;
}
.proposal-overview__waiting {
  margin: 4px 0;
  color: #ad6800;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  padding: 4px 8px;
  font-size: 12px;
}
.proposal-overview__round-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.proposal-overview__table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 12px;
}
.proposal-overview__table th,
.proposal-overview__table td {
  border: 1px solid #f0f0f0;
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
.proposal-overview__note {
  margin-top: 12px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.proposal-overview__batch {
  margin-top: 2px;
  color: #08979c;
  font-size: 11px;
}
</style>
