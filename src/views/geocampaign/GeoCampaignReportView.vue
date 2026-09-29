<script setup lang="ts">
/**
 * 诊断报告（Spec-F §10-4 四卡 + §11.4 的语义判定那一半）。
 *
 * 这一屏守的规矩，逐条都在页面上看得见：
 * 1. <b>没有跨平台总分</b>（§5 禁令 1）——每个率只有分平台那几行，页面上不会出现合并的一格；
 * 2. <b>每个率都点得到分母</b>（§11.3）——分子/分母与口径句子同行显示，句子来自接口那一行本身；
 * 3. <b>「没测到」有出口</b>（§9.6）——未取到的调用次数、判不了的对象、判不了的题、判不成的那几条各说各的；
 * 4. <b>SOV 的分母跟着【当前勾选】走</b>（§11.3）——那一发只重数一遍库里已有的回答，一次模型都不调；
 * 5. <b>「提到」与「在推荐位」两个数各占一格、永不相加</b>（§11.4 第三条）——它们共用同一个分母，
 *    相加就是把包含关系读成了两笔观测；
 * 6. <b>情感三档点得开</b>（§11.4 第四条）——三档加起来不到 100% 时，缺的那一段在条上看得见，
 *    每一档都能顺着判定明细抽屉点开那条回答的原文；点不开的数不许摆在这里。
 *
 * 提问与判定是<b>两段各花的钱</b>：`run.status` 说提问，`run.judgeState` 说判定（未判定 / 判定中 /
 * 已判定 / 判定失败），两份词表谁也不覆盖谁。所以这一屏既有「判定这一轮」那一发（要点头、要花钱），
 * 也有判定停着不动时那句原样念出来的出路。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { notification } from 'ant-design-vue'
import PageShell from '../../components/PageShell.vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import TrendNote from '../../components/TrendNote.vue'
import GeoJudgmentDrawer from './GeoJudgmentDrawer.vue'
import GeoOpportunityPanel from './GeoOpportunityPanel.vue'
import {
  geoCampaignApi,
  geoJudgeIsInFlight,
  geoRunIsInFlight,
  type GeoMetricRow,
  type GeoReport,
  type GeoRun,
  type GeoVocabulary,
} from '../../api/geoCampaign'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { formatDateTime } from '../../utils/format'
import { PH_DASH, PH_NOT_COVERED, PH_NOT_MEASURED } from '../../utils/display'
import {
  MENTION_VS_RECOMMEND_NOTE,
  formatInterval,
  formatRate,
  fractionText,
  gapLines,
  judgeCostText,
  judgeGate,
  judgeHint,
  runPercent,
  sentimentBar,
  sentimentSegmentClass as segmentClass,
} from './geoCampaignModel'

const props = defineProps<{ runId?: number | string | null }>()
const route = useRoute()

const id = computed(() => Number(props.runId ?? route.query.runId))
const valid = computed(() => Number.isFinite(id.value) && id.value > 0)

const report = ref<GeoReport | null>(null)
const vocabulary = ref<GeoVocabulary | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const recalculating = ref(false)
const judging = ref(false)
const confirmChecked = ref(false)
const drawerOpen = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const run = computed(() => report.value?.run ?? null)
const mentionRows = computed(() => report.value?.mentionRate ?? [])
const recommendRows = computed(() => report.value?.recommendRate ?? [])
const sovRows = computed(() => report.value?.sovShare ?? [])
const sentimentRows = computed(() => report.value?.sentimentShare ?? [])
const coverage = computed(() => report.value?.promptCoverage ?? null)
const gaps = computed(() =>
  report.value
    ? gapLines({
        failedCallCount: report.value.failedCallCount,
        unmeasuredSubjects: report.value.unmeasuredSubjects,
        unmeasuredQuestions: report.value.unmeasuredQuestions,
      })
    : [],
)
const uncoveredCount = computed(() => {
  const row = coverage.value
  if (!row) return null
  return Math.max(row.denominator - row.numerator, 0)
})

/** 情感那一根条按平台分组：一个平台一根，绝不合并按钮（§5 禁令 1） */
const sentimentGroups = computed(() => {
  const groups = new Map<string, GeoMetricRow[]>()
  for (const row of sentimentRows.value) {
    const key = row.modelLabel || (row.modelConfigId === null ? PH_DASH : String(row.modelConfigId))
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  return [...groups.entries()].map(([platform, rows]) => ({ platform, rows, bar: sentimentBar(rows) }))
})

const gate = computed(() => judgeGate({
  run: run.value,
  confirmChecked: confirmChecked.value,
  submitting: judging.value,
}))

async function load(quiet = false) {
  if (!valid.value) return
  if (!quiet) loading.value = true
  if (!quiet) error.value = null
  try {
    const [data, vocab] = await Promise.all([
      geoCampaignApi.getReport(id.value),
      vocabulary.value ? Promise.resolve(vocabulary.value) : geoCampaignApi.vocabulary(),
    ])
    report.value = data
    vocabulary.value = vocab
    armPolling(data.run)
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geocampaign/报告', e)
  } finally {
    loading.value = false
  }
}

/**
 * 判定那一段在跑 ⇒ 每 5 秒回读一次；落定即停手。
 * 判据看的是 `judgeState` 而不是 `status`：提问早就跑完了的那一轮，判定照样能跑十分钟。
 */
function armPolling(next: GeoRun) {
  if (geoJudgeIsInFlight(next.judgeState) && !next.judgeStalledReason) startPolling()
  else stopPolling()
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => void load(true), 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const recalculationDisabled = computed(() =>
  !report.value || geoRunIsInFlight(report.value.run.status) || recalculating.value)

/** 按钮旁边的这一句跟着轮次状态走：还在跑时说「跑完才能重算」，别说成现在就能按 */
const sovHint = computed(() => {
  if (!report.value) return ''
  if (geoRunIsInFlight(report.value.run.status)) {
    return '这一轮还在跑，跑完才能重算——半轮的回答算出来的份额不是任何一批题的份额。'
  }
  return '改过竞品勾选就按这一发：它只重数一遍这一轮已经落库的回答，一次模型都不调用，也不会新增轮次。'
})

async function recalculateSov() {
  if (!valid.value || recalculationDisabled.value) return
  recalculating.value = true
  try {
    report.value = await geoCampaignApi.recalculateSov(id.value)
    notification.success({
      message: 'SOV 已按当前勾选重算',
      description: '只重数了这一轮已有的回答，一次模型都没有调用；提及率与问题覆盖率一个字没动。',
    })
  } catch (e) {
    // 后端那句原因是数据（「这一轮一次成功回答都没取到」之类），原样念，不改写成「操作失败」
    notification.error({ message: 'SOV 重算未受理', description: describeHttpError(e) })
    logError('geocampaign/SOV 重算', e)
  } finally {
    recalculating.value = false
  }
}

async function judgeRun() {
  if (!valid.value || gate.value.disabled) return
  judging.value = true
  try {
    const next = await geoCampaignApi.judge(id.value, true)
    confirmChecked.value = false
    notification.success({
      message: '判定已排队',
      description: '后台正把这一轮已落库的成功回答逐条送进默认对话模型；提问那一段一次都不会重跑。',
    })
    // 队列受理之后要看得见进度，不然这一屏就停在「按完没反应」
    report.value = report.value ? { ...report.value, run: next } : report.value
    armPolling(next)
  } catch (e) {
    notification.error({ message: '判定未受理', description: describeHttpError(e) })
    logError('geocampaign/判定', e)
  } finally {
    judging.value = false
  }
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return PH_DASH
  return vocabulary.value?.runStatuses?.[status] || status
}

function judgeStateLabel(state: string | null | undefined): string | null {
  if (!state) return null
  return vocabulary.value?.judgeStates?.[state] || null
}

onMounted(load)
onBeforeUnmount(stopPolling)
// 包一层再换轮次：`watch(id, load)` 会把新的 runId 当成 `quiet` 传进去，
// 结果是切到另一轮时既不显 loading 也不清上一次的错误——读不到的账会被说成旧那一轮的错
watch(id, () => void load())
</script>

<template>
  <PageShell title="GEO 诊断报告" subtitle="一轮诊断 = 一批题 × 一排平台 × 每题若干次，报告只报这一轮的账">
    <StateBlock v-if="!valid" state="error" title="报告地址不完整" detail="URL 里没带上轮次 id。"
      next="回工作台或向导第⑤步，从轮次那一排点「看报告」进来" />
    <StateBlock v-else-if="loading && !report" state="not-measured" title="正在读这一轮的账" />
    <StateBlock v-else-if="error" state="error" :detail="error" />

    <template v-else-if="report">
      <section class="geo-report__head">
        <div class="geo-report__head-line">
          <StatusTag domain="geoRun" :status="report.run.status" :label="statusLabel(report.run.status)" />
          <span class="geo-report__head-sep">提问</span>
          <StatusTag domain="geoJudgeState" :status="report.run.judgeState"
            :label="report.run.judgeStateLabel || judgeStateLabel(report.run.judgeState)" />
          <span class="geo-report__head-title">轮次 {{ report.run.id }}</span>
          <span class="geo-report__head-meta">
            起于 {{ formatDateTime(report.run.startedAt) }} · 止于 {{ formatDateTime(report.run.finishedAt) }}
          </span>
        </div>
        <div v-if="geoRunIsInFlight(report.run.status)" class="geo-report__progress">
          <a-progress :percent="runPercent(report.run)" size="small" />
          <p class="geo-report__head-note">
            {{ report.run.stageText || '正在提问' }}——这一轮还没跑完，下面这些数字是已经落库的部分。
          </p>
          <p v-if="report.run.stalledReason" class="geo-report__head-stalled">{{ report.run.stalledReason }}</p>
        </div>
        <div class="geo-report__head-line">
          <span class="geo-report__head-meta">
            提问：本轮平台 {{ report.platforms.length ? report.platforms.join('、') : PH_DASH }} ·
            取到 {{ report.callCount }} 次回答 · 未取到 {{ report.failedCallCount }} 次 ·
            token {{ report.run.promptTokens ?? 0 }} + {{ report.run.completionTokens ?? 0 }}
          </span>
        </div>
        <div class="geo-report__head-line">
          <span class="geo-report__head-meta">
            判定：{{ judgeCostText(report.run) }} · 判定模型
            {{ report.judgeModelLabel || '（这一轮还没判过，界面上不猜当前的默认模型）' }}
          </span>
        </div>
        <p v-if="report.judgePromptVersion" class="geo-report__head-meta">
          推荐率与情感三档出自提示词版本 {{ report.judgePromptVersion }}；
          换一版判据请新建一轮，两版各留各的行，旧那几个率不会被覆盖。
        </p>
        <p v-if="report.run.judgeStalledReason" class="geo-report__head-stalled">{{ report.run.judgeStalledReason }}</p>
        <p v-if="report.notMeasuredJudgments > 0" class="geo-report__head-unmeasured">
          另有 {{ report.notMeasuredJudgments }} 条判定没过四道校验（档位与情感都留空），
          它们不进任何分子，但照样在分母里——点下面的「判定明细与原文」逐条看得见是哪几条。
        </p>

        <div class="geo-report__judge">
          <div v-if="report.run.judgeState !== 'DONE'" class="geo-report__judge-confirm">
            <!-- 勾选框自己绝不能跟着按钮一起禁用：闸是「没勾 ⇒ 按不动」，
                 把勾这一步也锁掉就等于永远过不了第二道闸（CampaignRunPanel 同一条形状） -->
            <a-checkbox v-model:checked="confirmChecked">
              我已看清「判定」那一段是第二次花钱：这一轮最多
              {{ report.run.callCount ?? 0 }} 条回答会送进默认对话模型
            </a-checkbox>
          </div>
          <div class="geo-report__judge-actions">
            <a-button danger :disabled="gate.disabled" :loading="judging" @click="judgeRun">{{ gate.text }}</a-button>
            <a-button size="small" @click="drawerOpen = true">判定明细与原文</a-button>
          </div>
          <p class="geo-report__judge-hint">{{ judgeHint(report.run) }}</p>
          <p v-if="report.run.judgeErrorMessage" class="geo-report__judge-error">{{ report.run.judgeErrorMessage }}</p>
        </div>

        <p class="geo-report__scope">
          这一屏出的是<b>提及率、推荐率、问题覆盖、竞品 SOV、情感三档</b>，加下面那一卡<b>机会问题</b>；
          引用链接率还没有观测口径，所以这里既没有它的数字也没有它的空格。
        </p>
      </section>

      <TrendNote :text="report.accessChannelNote" />

      <section class="geo-report__card" data-card="mention">
        <h3 class="geo-report__card-title">AI 品牌提及（分平台）</h3>
        <p class="geo-report__card-note">
          这里刻意没有一个「总分」格：把不同模型的脾气加权成一个数，等于把三个答案压成一个假答案。
        </p>
        <StateBlock v-if="!mentionRows.length" state="not-measured" title="这一轮没有提及率行"
          next="品牌词短到认不出来门槛，或这一轮一次回答都没取到——先看上面那排「未取到」，再回品牌档案补词" />
        <table v-else class="geo-report__table">
          <thead>
            <tr>
              <th>平台</th>
              <th>提及率</th>
              <th>分子 / 分母</th>
              <th>95% 区间</th>
              <th>分母口径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in mentionRows" :key="row.id">
              <td>{{ row.modelLabel || row.subject }}</td>
              <td class="geo-report__value">{{ formatRate(row.value) }}</td>
              <td>{{ fractionText(row.numerator, row.denominator) }}</td>
              <td>{{ formatInterval(row.ciLow, row.ciHigh) || PH_DASH }}</td>
              <td class="geo-report__definition">{{ row.definition || PH_DASH }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="geo-report__card" data-card="recommend">
        <h3 class="geo-report__card-title">AI 推荐（分平台）</h3>
        <StateBlock v-if="!recommendRows.length" state="not-measured" title="这一轮还没有推荐率行"
          next="推荐率是语义判定的产物，一次模型都不调的 SOV 重算产不出它：按上面那一发「判定这一轮」，它只把已有的回答送进模型，不重跑提问" />
        <table v-else class="geo-report__table">
          <thead>
            <tr>
              <th>平台</th>
              <th>推荐率</th>
              <th>分子 / 分母</th>
              <th>判不成</th>
              <th>分母口径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in recommendRows" :key="row.id" :data-scope="row.scope">
              <td>{{ row.modelLabel || PH_DASH }}</td>
              <td class="geo-report__value">{{ formatRate(row.value) }}</td>
              <td>{{ fractionText(row.numerator, row.denominator) }}</td>
              <td>{{ row.notMeasuredCount ?? 0 }} 条</td>
              <td class="geo-report__definition">{{ row.definition || PH_DASH }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="recommendRows.length" class="geo-report__card-note">{{ MENTION_VS_RECOMMEND_NOTE }}</p>
      </section>

      <section class="geo-report__card" data-card="sentiment">
        <h3 class="geo-report__card-title">情感三档（本品牌，分平台）</h3>
        <StateBlock v-if="!sentimentRows.length" state="not-measured" title="这一轮还没有情感行"
          next="情感三档出自语义判定：先按上面那一发「判定这一轮」；判过之后这里每档一行，每档都点得开到那条回答的原文" />
        <template v-else>
          <div v-for="group in sentimentGroups" :key="group.platform" class="geo-report__bar-block">
            <div class="geo-report__bar-title">
              {{ group.platform }}
              <span class="geo-report__bar-meta">分母 {{ group.bar?.denominator ?? 0 }} 条（提到本品牌的回答数）</span>
            </div>
            <div v-if="group.bar" class="geo-report__bar">
              <span v-for="segment in group.bar.segments" :key="segment.key"
                class="geo-report__seg" :class="`geo-report__seg--${segmentClass(segment.key)}`"
                :style="{ width: segment.percent + '%' }" :data-sentiment="segment.key"
                :title="`${segment.label} ${segment.numerator} / ${group.bar.denominator}`">
                {{ segment.label }} {{ segment.percent }}%
              </span>
              <span v-if="group.bar.unmeasured" class="geo-report__seg geo-report__seg--unmeasured"
                :style="{ width: group.bar.unmeasured.percent + '%' }"
                :title="`判不成 ${group.bar.unmeasured.count} / ${group.bar.denominator}`">
                {{ PH_NOT_MEASURED }} {{ group.bar.unmeasured.count }} 条
              </span>
            </div>
            <p v-if="group.bar?.unmeasured" class="geo-report__bar-note">
              三档加起来是 {{ group.bar.measuredPercent }}%，缺的那 {{ group.bar.unmeasured.count }} 条不是「中立」：
              它们是四道校验没过的那些（档位与情感都留空），点「判定明细与原文」逐条看得见原因。
            </p>
            <table class="geo-report__table">
              <tbody>
                <tr v-for="row in group.rows" :key="row.id">
                  <td>{{ row.sentimentLabel || row.sentiment || PH_DASH }}</td>
                  <td class="geo-report__value">{{ formatRate(row.value) }}</td>
                  <td>{{ fractionText(row.numerator, row.denominator) }}</td>
                  <td class="geo-report__definition">{{ row.definition || PH_DASH }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="geo-report__card-note">
            这里没有「净情感」（正面减负面）那一格：两个都是模型判出来的档位，相减得到的数没有任何人问过它是什么。
          </p>
        </template>
      </section>

      <section class="geo-report__card" data-card="coverage">
        <h3 class="geo-report__card-title">推荐问题覆盖</h3>
        <StateBlock v-if="!coverage" state="not-measured" title="这一轮没有可判的题"
          next="所有题的核心词都短到门槛以下或落在通用词里：先在题池里补核心词，再来跑一轮" />
        <table v-else class="geo-report__table">
          <thead>
            <tr>
              <th>覆盖率</th>
              <th>分子 / 分母</th>
              <th>95% 区间</th>
              <th>{{ PH_NOT_COVERED }}</th>
              <th>分母口径</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="geo-report__value">{{ formatRate(coverage.value) }}</td>
              <td>{{ fractionText(coverage.numerator, coverage.denominator) }}</td>
              <td>{{ formatInterval(coverage.ciLow, coverage.ciHigh) || PH_DASH }}</td>
              <td>{{ uncoveredCount ?? PH_DASH }} 道</td>
              <td class="geo-report__definition">{{ coverage.definition || PH_DASH }}</td>
            </tr>
          </tbody>
        </table>
        <p class="geo-report__card-note">
          「覆盖」= 站内有内容对得上这道题，与「被 AI 引用」是两条指标；
          差在哪、补哪一页，逐条列在下面那一卡「机会问题」里。
        </p>
      </section>

      <section class="geo-report__card" data-card="sov">
        <h3 class="geo-report__card-title">竞品对比（AI SOV，分平台）</h3>
        <StateBlock v-if="!sovRows.length" state="not-measured" title="这一轮没有 SOV 行"
          next="只有自家一家的「份额」恒等于 100%，那不是一个观测值：去竞品组勾选至少一家可判定的竞品，然后按下面那一发「按当前勾选重算份额」，不用重跑一轮" />
        <table v-else class="geo-report__table">
          <thead>
            <tr>
              <th>平台</th>
              <th>对象</th>
              <th>SOV</th>
              <th>分子 / 分母</th>
              <th>分母口径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sovRows" :key="row.id" :data-scope="row.scope">
              <td>{{ row.modelLabel || PH_DASH }}</td>
              <td>{{ row.subject }}</td>
              <td class="geo-report__value">{{ formatRate(row.value) }}</td>
              <td>{{ fractionText(row.numerator, row.denominator) }}</td>
              <td class="geo-report__definition">{{ row.definition || PH_DASH }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="sovRows.length" class="geo-report__card-note">
          同一平台的每一行共用同一个分母：本品牌 + 勾选参与对比的竞品被提及次数之和。
          没勾进来的竞品不在这个分母里，所以这一串数字加起来是 100%，而不是「市场上有多少」。
        </p>
        <div class="geo-report__sov-action">
          <a-button size="small" :disabled="recalculationDisabled" :loading="recalculating" @click="recalculateSov">
            按当前勾选重算份额
          </a-button>
          <span class="geo-report__sov-hint">{{ sovHint }}</span>
        </div>
        <p class="geo-report__card-note">
          这一发改的只有 SOV：重算读的是这一轮已经落库的成功回答，所以它不花钱，也不碰提及率与覆盖率。
          情感与推荐率不走这条路——那是语义判定，要重新过一遍模型，按上面那一发「判定这一轮」。
        </p>
      </section>

      <section v-if="gaps.length" class="geo-report__card">
        <h3 class="geo-report__card-title">没测到的部分</h3>
        <div v-for="gap in gaps" :key="gap.title" class="geo-report__gap">
          <div class="geo-report__gap-title">{{ gap.title }}</div>
          <div class="geo-report__gap-text">{{ gap.text }}</div>
        </div>
      </section>

      <!-- 机会问题（§11.5 / 10-6）：看见缺口之后能直接补缺口，这是本 Spec 唯一拉开差距的一条。
           它排在五个数与「没测到的部分」后面，是因为读的人要先认了这些数，再决定花不花下一笔钱；
           而清单本身跟着【计划】跨轮存活，不是本轮新增（那句话由面板自己念出来）。 -->
      <GeoOpportunityPanel :run-id="id" :vocabulary="vocabulary" />

      <p v-if="report.run.errorMessage" class="geo-report__error">{{ report.run.errorMessage }}</p>
      <p class="geo-report__computed">
        报告生成于 {{ formatDateTime(report.generatedAt) }}；上面每一个数都取自
        <code>geo_metric_snapshot</code> 那一行的分子与分母，不是这一页现算的。
      </p>

      <GeoJudgmentDrawer v-model:open="drawerOpen" :run-id="id" :vocabulary="vocabulary" />
    </template>
  </PageShell>
</template>

<style scoped lang="less">
.geo-report {
  &__head {
    margin-bottom: 16px;
  }

  &__head-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__head-title {
    font-size: 14px;
    font-weight: 600;
  }

  &__head-sep {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__head-meta,
  &__head-note {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__head-note {
    margin: 4px 0 0;
  }

  // 「停着不动」是警告，不是失败：这一轮的状态词一个字没改（#108），这里只补一句出路
  &__head-stalled {
    margin: 4px 0 0;
    color: #d46b08;
    font-size: 12px;
  }

  &__head-unmeasured {
    margin: 4px 0 0;
    color: #595959;
    font-size: 12px;
  }

  &__judge {
    margin-top: 12px;
    padding: 12px;
    border: 1px dashed #f0f0f0;
    border-radius: var(--admin-radius-card, 12px);
  }

  &__judge-confirm {
    margin-bottom: 8px;
  }

  &__judge-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__judge-hint {
    margin: 8px 0 0;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__judge-error {
    margin: 6px 0 0;
    color: #ff4d4f;
    font-size: 12px;
  }

  &__bar-block {
    margin-bottom: 16px;
  }

  &__bar-title {
    font-size: 13px;
    font-weight: 600;
  }

  &__bar-meta {
    margin-left: 8px;
    color: #8c8c8c;
    font-size: 12px;
    font-weight: 400;
  }

  &__bar {
    display: flex;
    overflow: hidden;
    height: 22px;
    margin: 6px 0;
    border-radius: 6px;
    background: #fafafa;
  }

  &__seg {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    color: #fff;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
  }

  &__seg--pos {
    background: #52c41a;
  }

  &__seg--neu {
    background: #bfbfbf;
    color: #333;
  }

  &__seg--neg {
    background: #ff4d4f;
  }

  // 判不成那一段用斜纹：它不是「又一档」，是这一条没被判成，视觉上也不能像一档
  &__seg--unmeasured {
    background: repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 4px, #e3e3e3 4px, #e3e3e3 8px);
    color: #595959;
  }

  // 词表里认不出来的档位：画成中性灰，不借正面/负面那两色把没定义的码说成有态度
  &__seg--other {
    background: #8c8c8c;
  }

  &__bar-note {
    margin: 4px 0 8px;
    color: #d46b08;
    font-size: 12px;
  }

  &__sov-action {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  &__sov-hint {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__scope {
    margin: 8px 0 0;
    color: #595959;
    font-size: 12px;
  }

  &__card {
    margin-bottom: 20px;
    padding: 16px;
    border: 1px solid #f0f0f0;
    border-radius: var(--admin-radius-card, 12px);
  }

  &__card-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
  }

  &__card-note {
    margin: 12px 0 0;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th {
      padding: 6px 8px;
      color: #8c8c8c;
      font-weight: 400;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
    }

    td {
      padding: 8px;
      border-bottom: 1px solid #fafafa;
      vertical-align: top;
    }
  }

  &__value {
    font-weight: 600;
  }

  &__definition {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__gap {
    margin-top: 8px;
  }

  &__gap-title {
    font-size: 13px;
    font-weight: 600;
  }

  &__gap-text {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__error {
    color: #ff4d4f;
    font-size: 12px;
  }

  &__computed {
    color: #8c8c8c;
    font-size: 12px;
  }
}
</style>
