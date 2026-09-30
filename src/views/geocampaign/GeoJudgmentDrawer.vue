<script setup lang="ts">
/**
 * 判定明细与溯源抽屉（Spec-F §11.4 第四条在这一屏的落点）。
 *
 * 这一屏存在的理由只有一句：<b>报告上每一个「在推荐位 / 正面」都必须点得开，点开必须看得见原文那一句</b>。
 * 点不开的语义判定就是一个假数——所以未测量那些行也一起发回来、一起列在这里，
 * 并把后端那句 `notMeasuredReason` 原样念出来。宁可让人看见「这一条判不了，原因是……」，
 * 也不许把三档加起来不到 100% 的那几个洞画成一次成功观测。
 *
 * 三条纪律：
 * 1. 原文是第三方模型产出的内容 ⇒ <b>不用 v-html</b>，高亮走 `highlightParts` 切段渲染；
 * 2. 抽屉里没有任何模型凭据（后端的 `AnswerVo` 本来也不带，界面这里也不去猜）；
 * 3. 「第几项」那一列念的是词表给的 `positionLabel`（「在推荐清单里的第几项」），
 *    §5 明令禁的那个「排名」字样不许在这台机器上出现。
 */
import { computed, ref, watch } from 'vue'
import StateBlock from '../../components/StateBlock.vue'
import {
  geoCampaignApi,
  type GeoAnswerTrace,
  type GeoJudgment,
  type GeoVocabulary,
} from '../../api/geoCampaign'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { formatDateTimeWithZone } from '../../utils/format'
import { PH_DASH, PH_NOT_MEASURED } from '../../utils/display'
import { highlightParts } from './geoCampaignModel'

const props = defineProps<{
  open: boolean
  runId: number | null
  vocabulary: GeoVocabulary | null
}>()

const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const judgments = ref<GeoJudgment[] | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const trace = ref<GeoAnswerTrace | null>(null)
const traceJudgment = ref<GeoJudgment | null>(null)
const traceLoading = ref(false)
const traceError = ref<string | null>(null)

const unmeasured = computed(() => (judgments.value ?? []).filter((row) => row.notMeasuredReason))
const judged = computed(() => (judgments.value ?? []).filter((row) => !row.notMeasuredReason))
const mode = computed(() => (trace.value ? 'trace' : 'list'))

const parts = computed(() => highlightParts(trace.value?.answerText, traceJudgment.value?.matchedText))

async function load() {
  if (!props.runId) return
  loading.value = true
  error.value = null
  try {
    judgments.value = await geoCampaignApi.judgments(props.runId)
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geocampaign/判定明细', e)
  } finally {
    loading.value = false
  }
}

async function openTrace(row: GeoJudgment) {
  traceLoading.value = true
  traceError.value = null
  try {
    trace.value = await geoCampaignApi.answer(row.callId)
    traceJudgment.value = row
  } catch (e) {
    traceError.value = describeHttpError(e)
    logError('geocampaign/回答溯源', e)
  } finally {
    traceLoading.value = false
  }
}

function backToList() {
  trace.value = null
  traceJudgment.value = null
  traceError.value = null
}

function close() {
  emit('update:open', false)
}

// `immediate` 是给「挂载时就是开着的」那一种用法留的：少了它，外层一进来就带着 open=true 挂它，
// 抽屉会永远停在「还没有读到判定行」——开关在自己的 watch 上，界面上看着像后端没数据。
watch(() => props.open, (value) => {
  if (value && !judgments.value && !loading.value) void load()
}, { immediate: true })

function prominenceLabel(row: GeoJudgment): string {
  return row.prominenceLabel || props.vocabulary?.prominences?.[row.prominence ?? ''] || row.prominence || PH_NOT_MEASURED
}

function sentimentLabel(row: GeoJudgment): string {
  return row.sentimentLabel || props.vocabulary?.sentiments?.[row.sentiment ?? ''] || row.sentiment || PH_DASH
}
</script>

<template>
  <a-drawer :open="open" placement="right" :width="720" title="这一轮的判定明细与原文溯源" @close="close">
    <StateBlock v-if="loading" state="not-measured" title="正在读这一轮的判定行" />
    <StateBlock v-else-if="error" state="error" :detail="error" />

    <template v-else-if="mode === 'trace' && trace">
      <a-button size="small" class="geo-trace__back" @click="backToList">← 回到判定明细</a-button>
      <div class="geo-trace__head">
        <div class="geo-trace__question">{{ trace.questionText || PH_DASH }}</div>
        <div class="geo-trace__meta">
          回答来自 {{ trace.modelName || PH_DASH }}{{ trace.provider ? `（${trace.provider}）` : '' }} ·
          第 {{ trace.sampleSeq ?? '?' }} 次采样 · {{ formatDateTimeWithZone(trace.createdAt) }} ·
          判定版本 {{ traceJudgment?.judgePromptVersion || PH_DASH }}
        </div>
        <p v-if="traceJudgment" class="geo-trace__verdict">
          这一格点进来的是「{{ traceJudgment.subject }}」：{{ prominenceLabel(traceJudgment) }} ·
          {{ sentimentLabel(traceJudgment) }}
          <span v-if="traceJudgment.positionRank">
            · {{ traceJudgment.positionLabel }}：{{ traceJudgment.positionRank }}
          </span>
        </p>
        <p v-if="traceJudgment?.evidenceQuote" class="geo-trace__quote">模型给的引句：{{ traceJudgment.evidenceQuote }}</p>
        <p v-if="traceJudgment?.sentimentReason" class="geo-trace__reason">判定理由：{{ traceJudgment.sentimentReason }}</p>
        <p v-if="traceJudgment?.notMeasuredReason" class="geo-trace__unmeasured">
          这一条是未测量：{{ traceJudgment.notMeasuredReason }}
        </p>
      </div>

      <div class="geo-trace__answer">
        <div class="geo-trace__answer-title">回答原文（高亮的那段是我们据以认出这一家的字）</div>
        <pre class="geo-trace__answer-body"><template v-for="(part, index) in parts" :key="index"><span
          :class="part.hit ? 'geo-trace__hit' : ''">{{ part.text }}</span></template></pre>
        <p v-if="!parts.length" class="geo-trace__empty">这一条回答没有可读的原文。</p>
      </div>

      <div v-if="trace.judgments.length > 1" class="geo-trace__others">
        <div class="geo-trace__answer-title">这一条回答同时判出的其它行</div>
        <table class="geo-trace__table">
          <tbody>
            <tr v-for="row in trace.judgments" :key="row.id">
              <td>{{ row.subject }}</td>
              <td>{{ prominenceLabel(row) }}</td>
              <td>{{ sentimentLabel(row) }}</td>
              <td class="geo-trace__cell-note">{{ row.notMeasuredReason || row.evidenceQuote || PH_DASH }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="judgments">
      <p class="geo-trace__summary">
        这一轮共 {{ judgments.length }} 行判定：判成 {{ judged.length }} 行、
        <b>未测量 {{ unmeasured.length }} 行</b>。未测量那些也列在这里——三档加起来不到 100% 的话，
        就是这几个数解释的，不是模型漏报。
      </p>
      <StateBlock v-if="!judgments.length" state="not-measured" title="这一轮一行判定都没有"
        next="判定那一段还没跑过：回报告按「判定这一轮」，它只把已有的回答送进默认对话模型一次，不会重跑提问" />
      <table v-else class="geo-trace__table">
        <thead>
          <tr>
            <th>对象</th>
            <th>档位</th>
            <th>情感</th>
            <th>依据 / 判不成的原因</th>
            <th>原文</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in judgments" :key="row.id" :data-unmeasured="row.notMeasuredReason ? '1' : '0'">
            <td>{{ row.subject }}</td>
            <td>{{ row.notMeasuredReason ? PH_NOT_MEASURED : prominenceLabel(row) }}</td>
            <td>{{ row.notMeasuredReason ? PH_NOT_MEASURED : sentimentLabel(row) }}</td>
            <td class="geo-trace__cell-note">
              {{ row.notMeasuredReason || row.sentimentReason || row.evidenceQuote || PH_DASH }}
            </td>
            <td>
              <a-button size="small" type="link" @click="openTrace(row)">看原文</a-button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <StateBlock v-else state="empty" title="还没有读到判定行" next="关掉重开，或回报告页按一次刷新" />

    <!-- 取原文失败那句摆在链条后面：摆在中间会把下面那个 `v-else-if` 接过来，
         结果是「读一次原文失败」把已经拿到的那一排判定行整个变没 -->
    <StateBlock v-if="traceError" state="error" :detail="traceError" />
  </a-drawer>
</template>

<style scoped lang="less">
.geo-trace {
  &__back {
    margin-bottom: 12px;
  }

  &__question {
    font-size: 14px;
    font-weight: 600;
  }

  &__meta,
  &__summary {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__meta {
    margin-top: 4px;
  }

  &__verdict {
    margin: 12px 0 0;
    font-size: 13px;
    font-weight: 600;
  }

  &__quote,
  &__reason {
    margin: 6px 0 0;
    color: #595959;
    font-size: 12px;
  }

  &__unmeasured {
    margin: 6px 0 0;
    color: #d46b08;
    font-size: 12px;
  }

  &__answer {
    margin-top: 16px;
  }

  &__answer-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  &__answer-body {
    margin: 0;
    padding: 12px;
    max-height: 320px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.7;
  }

  &__hit {
    background: #ffe58f;
    border-radius: 3px;
    padding: 0 2px;
  }

  &__empty {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__others {
    margin-top: 16px;
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

  &__cell-note {
    color: #8c8c8c;
    font-size: 12px;
  }
}
</style>
