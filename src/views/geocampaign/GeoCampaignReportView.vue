<script setup lang="ts">
/**
 * 诊断报告（Spec-F §10-4 的 P2 范围：AI 品牌提及 + 问题覆盖 + 竞品 SOV 那一排）。
 *
 * 三条规矩在这一屏是看得见的：
 * 1. <b>没有跨平台总分</b>（§5 禁令 1）——提及率只有分平台那几行，页面上不会出现合并的一格；
 * 2. <b>每个率都点得到分母</b>（§11.3）——分子/分母与口径句子同行显示，句子来自接口那一行本身；
 * 3. <b>「没测到」有三个出口</b>（§9.6）——未取到的调用次数、判不了的对象、判不了的题各说各的，
 *    只报率不报缺口就是把「我们没测」说成「没人提」；
 * 4. <b>SOV 的分母跟着【当前勾选】走</b>（§11.3）——卡底那一发「按当前勾选重算份额」只重数一遍
 *    库里已有的回答，一次模型都不调、不花钱、不新增轮次；情感判定不在这一条路上（§11.4 要重新过模型）。
 *
 * 推荐率与情感三档本期不产出行（后端 `producedInPhase` 是 3），所以这里也不摆空壳。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { notification } from 'ant-design-vue'
import PageShell from '../../components/PageShell.vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import TrendNote from '../../components/TrendNote.vue'
import {
  geoCampaignApi,
  geoRunIsInFlight,
  type GeoReport,
  type GeoVocabulary,
} from '../../api/geoCampaign'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { formatDateTime } from '../../utils/format'
import { PH_DASH, PH_NOT_COVERED } from '../../utils/display'
import { formatInterval, formatRate, fractionText, gapLines, runPercent } from './geoCampaignModel'

const props = defineProps<{ runId?: number | string | null }>()
const route = useRoute()

const id = computed(() => Number(props.runId ?? route.query.runId))
const valid = computed(() => Number.isFinite(id.value) && id.value > 0)

const report = ref<GeoReport | null>(null)
const vocabulary = ref<GeoVocabulary | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const recalculating = ref(false)

const mentionRows = computed(() => report.value?.mentionRate ?? [])
const sovRows = computed(() => report.value?.sovShare ?? [])
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

async function load() {
  if (!valid.value) return
  loading.value = true
  error.value = null
  try {
    const [data, vocab] = await Promise.all([
      geoCampaignApi.getReport(id.value),
      vocabulary.value ? Promise.resolve(vocabulary.value) : geoCampaignApi.vocabulary(),
    ])
    report.value = data
    vocabulary.value = vocab
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geocampaign/报告', e)
  } finally {
    loading.value = false
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

function statusLabel(status: string | null | undefined): string {
  if (!status) return PH_DASH
  return vocabulary.value?.runStatuses?.[status] || status
}

onMounted(load)
watch(id, load)
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
            本轮平台：{{ report.platforms.length ? report.platforms.join('、') : PH_DASH }} ·
            取到 {{ report.callCount }} 次回答 · 未取到 {{ report.failedCallCount }} 次 ·
            token {{ report.run.promptTokens ?? 0 }} + {{ report.run.completionTokens ?? 0 }}
          </span>
        </div>
        <p class="geo-report__scope">
          本期这一屏出的是<b>提及率与问题覆盖率</b>两卡（加竞品 SOV 那一排）；
          推荐率与情感三档要的是语义判定，排在下一期，所以这里既没有它们的数字也没有它们的空格。
        </p>
      </section>

      <TrendNote :text="report.accessChannelNote" />

      <section class="geo-report__card">
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

      <section class="geo-report__card">
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
          「覆盖」= 站内有内容对得上这道题，与「被 AI 引用」是两条指标；机会问题（补哪一页）排在下一期接内容闭环。
        </p>
      </section>

      <section class="geo-report__card">
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
          情感判定不走这条路——那要重新过一遍模型（§11.4）。
        </p>
      </section>

      <section v-if="gaps.length" class="geo-report__card">
        <h3 class="geo-report__card-title">没测到的部分</h3>
        <div v-for="gap in gaps" :key="gap.title" class="geo-report__gap">
          <div class="geo-report__gap-title">{{ gap.title }}</div>
          <div class="geo-report__gap-text">{{ gap.text }}</div>
        </div>
      </section>

      <p v-if="report.run.errorMessage" class="geo-report__error">{{ report.run.errorMessage }}</p>
      <p class="geo-report__computed">
        报告生成于 {{ formatDateTime(report.generatedAt) }}；上面每一个数都取自
        <code>geo_metric_snapshot</code> 那一行的分子与分母，不是这一页现算的。
      </p>
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
