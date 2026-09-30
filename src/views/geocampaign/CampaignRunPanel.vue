<script setup lang="ts">
/**
 * 预估与确认（Spec-F §10-3、§6.2 两段式）：一轮诊断唯一的花钱出口。
 *
 * 四道规矩钉在这里，一条都不能省：
 * 1. 先看预估——`estimate` 为 null 时主按钮禁用，「先跑起来再看价」在这一步做不到；
 * 2. `notice` 非空 ⇒ 这一轮不会受理：按钮文字直接念「这一轮不会受理」，理由原样显示（不改写成「参数错误」）；
 * 3. 必须勾确认才发 `confirm: true`——后端 GEO_CAMPAIGN_CONFIRM_REQUIRED 判的就是这一个布尔值；
 * 4. 这个计划已经有一轮在跑 ⇒ 按钮按不动并说清在等谁（#125）：让它点下去就是同一批题付两遍钱，
 *    而那第二笔账不在用户刚看过的预估里——被判定为「停着」的那一轮不算在飞，理由见 liveRunOf。
 *
 * 预估走的是 GET，一次模型都不调（§11.3 的验收点），所以它可以反复按。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { notification } from 'ant-design-vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import {
  geoCampaignApi,
  geoRunIsInFlight,
  type GeoEstimate,
  type GeoRun,
} from '../../api/geoCampaign'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { formatDateTimeWithZone } from '../../utils/format'
import {
  UNMEASURABLE_HINT,
  UNMEASURABLE_TITLE,
  billingLine,
  estimateLines,
  liveRunOf,
  runGate,
  runPercent,
  unmeasurableNoticeOf,
} from './geoCampaignModel'

const props = defineProps<{
  campaignId: number | null
  /** 平台/配额那两格词表由外层一次取回，轮次状态标签也从这里读 */
  runStatusLabels?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'started', run: GeoRun): void
  (e: 'view-report', runId: number): void
}>()

const estimate = ref<GeoEstimate | null>(null)
const estimating = ref(false)
const confirmChecked = ref(false)
const starting = ref(false)
const runs = ref<GeoRun[]>([])
const runsLoading = ref(false)
const runsError = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const lines = computed(() => (estimate.value ? estimateLines(estimate.value) : []))
/** 判不了覆盖率那几道题（#142）：null 时整块不出现，界面不许自己编一句警告 */
const unmeasurableNotice = computed(() => unmeasurableNoticeOf(estimate.value))
// 在飞的那一轮从轮次列表里读（#125）：判据跟后端 liveRunOf 同一份，被判定为停着的那一轮不算在飞，
// 否则一条带死的行会把这个计划永久锁死，出路只剩删计划重建。
const liveRun = computed(() => liveRunOf(runs.value))
const gate = computed(() => runGate({
  estimate: estimate.value,
  confirmChecked: confirmChecked.value,
  starting: starting.value,
  liveRun: liveRun.value,
}))

function statusLabel(run: GeoRun): string {
  return props.runStatusLabels?.[run.status] || run.statusLabel || run.status
}

function reset() {
  estimate.value = null
  confirmChecked.value = false
  runs.value = []
  stopPolling()
}

async function loadEstimate() {
  if (!props.campaignId) return
  estimating.value = true
  try {
    estimate.value = await geoCampaignApi.estimate(props.campaignId)
    // 价变了就要重新点头：勾留着等于替一个没看过的数字签字
    confirmChecked.value = false
  } catch (e) {
    notification.error({ message: '预估失败', description: describeHttpError(e) })
    logError('geocampaign/预估', e)
  } finally {
    estimating.value = false
  }
}

async function loadRuns() {
  if (!props.campaignId) return
  runsLoading.value = true
  runsError.value = null
  try {
    runs.value = await geoCampaignApi.runs(props.campaignId)
    armPolling()
  } catch (e) {
    runsError.value = describeHttpError(e)
    logError('geocampaign/轮次', e)
  } finally {
    runsLoading.value = false
  }
}

/** 有轮次在跑就每 5 秒回读一次；全部落定即停手，不留下一个空转的定时器 */
function armPolling() {
  // 判据用 liveRunOf 而不是状态词：被判定为「停着」的那一条再敲也敲不出新进度，
  // 让它一直轮着等于替一条死行空转网络（#125）
  if (liveRunOf(runs.value)) {
    startPolling()
  } else {
    stopPolling()
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (!props.campaignId) return stopPolling()
    try {
      runs.value = await geoCampaignApi.runs(props.campaignId)
    } catch (e) {
      // 轮询失败只停表并报一句：轮次本身在后端照样跑完，别把「我读不到」说成「它停了」
      logError('geocampaign/进度轮询', e)
      stopPolling()
      runsError.value = '进度自动刷新已停止，可点「刷新轮次」继续看；后台那一轮照样在跑。'
    }
    armPolling()
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function startRun() {
  if (!props.campaignId || gate.value.disabled) return
  starting.value = true
  try {
    const run = await geoCampaignApi.run(props.campaignId, true)
    notification.success({
      message: '这一轮已排队',
      description: '后台正在按题 × 平台 × 重复次数逐个提问，进度看下面那一排。',
    })
    emit('started', run)
    await loadRuns()
  } catch (e) {
    notification.error({ message: '起跑失败', description: describeHttpError(e) })
    logError('geocampaign/起跑', e)
  } finally {
    starting.value = false
  }
}

watch(() => props.campaignId, () => {
  // 切计划就重取轮次：换一个已有轮次的计划进来还停在「还没跑过一轮」，是把有账说成没账（§9.6）
  reset()
  void loadRuns()
}, { immediate: true })
onBeforeUnmount(stopPolling)

defineExpose({ loadEstimate, loadRuns, reset })
</script>

<template>
  <div class="geo-run-panel">
    <div class="geo-run-panel__head">
      <h4 class="geo-run-panel__title">预估与确认</h4>
      <div class="geo-run-panel__head-actions">
        <a-button size="small" :loading="estimating" :disabled="!campaignId" @click="loadEstimate">
          先估算这一轮
        </a-button>
        <a-button size="small" :loading="runsLoading" :disabled="!campaignId" @click="loadRuns">刷新轮次</a-button>
      </div>
    </div>

    <p class="geo-run-panel__note">
      「先估算这一轮」一次模型都不调用，它只把「题数 × 平台数 × 重复次数」与判定那一段的条数算出来给你看；
      按「确认并开始诊断」才会真的向第三方模型逐个发问并消耗 token 配额。
      表里那六行分成两段：提问与判定（推荐位、情感三档）各花各的钱，这一屏只放行提问那一段。
    </p>

    <StateBlock v-if="!campaignId" state="empty" title="还没有诊断计划"
      next="回到本步往上填好平台与重复次数并保存计划，这里才有可预估的对象" />

    <template v-else>
      <table v-if="estimate" class="geo-run-panel__estimate">
        <tbody>
          <tr v-for="line in lines" :key="line.label">
            <th>{{ line.label }}</th>
            <td class="geo-run-panel__estimate-value">{{ line.value }}</td>
            <td class="geo-run-panel__estimate-note">{{ line.note }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="geo-run-panel__empty-estimate">还没有取到预估：按上面那个按钮先看价。</p>

      <p v-if="estimate" class="geo-run-panel__billing">{{ billingLine(estimate) }}</p>

      <!-- G9：钱怎么走的那三条（部分成功按实际 token 扣 / 重跑按新一轮 / 被拒不收钱）。
           文案出自服务端，与交付说明同一份口径；这里只负责摆出来，不替它改写。 -->
      <p v-if="estimate?.billingNotice" class="geo-run-panel__billing geo-run-panel__terms">
        {{ estimate.billingNotice }}
      </p>

      <a-alert
        v-if="estimate?.notice"
        type="warning"
        show-icon
        :message="estimate.notice"
        class="geo-run-panel__notice"
      />

      <div
        v-if="unmeasurableNotice"
        class="geo-run-panel__unmeasurable"
        data-unmeasurable="true"
      >
        <div class="geo-run-panel__unmeasurable-title">{{ UNMEASURABLE_TITLE }}</div>
        <p class="geo-run-panel__unmeasurable-body">{{ unmeasurableNotice }}</p>
        <p class="geo-run-panel__unmeasurable-hint">{{ UNMEASURABLE_HINT }}</p>
      </div>

      <div v-if="estimate && !estimate.notice" class="geo-run-panel__confirm">
        <a-checkbox v-model:checked="confirmChecked">
          我已看过上面那几行，确认这一轮会真的调用模型提问 {{ estimate.callCount }} 次并消耗 token 配额
        </a-checkbox>
        <p class="geo-run-panel__confirm-note">
          这一发只花「提问」那一段的钱。判定（推荐位与情感三档）是第二段、另一次点头，
          报告那一屏才按得到——它不会跟着这一轮偷偷扣。
        </p>
      </div>

      <div class="geo-run-panel__actions">
        <a-button
          type="primary"
          danger
          :disabled="gate.disabled"
          :loading="starting"
          @click="startRun"
        >{{ gate.text }}</a-button>
        <span v-if="liveRun" class="geo-run-panel__waiting">
          <template v-if="liveRun?.queuedReason">
            轮次 {{ liveRun?.id }} 还在排队（还没开始提问、一分钱没花）：
          </template>
          <template v-else>
            轮次 {{ liveRun?.id }} 还在跑（{{ liveRun?.stageText || '正在提问' }}，进度 {{ runPercent(liveRun) }}%）：
          </template>
          两轮一起点等于同一批题问两遍、付两遍钱，而后起那一轮的账不在你刚看过的预估里。
          真想同时问多个品牌，请给每个品牌各建一个计划。
        </span>
        <span v-else-if="estimate?.notice" class="geo-run-panel__denied">
          上面的理由没消掉之前，这个按钮按不下去——它不是坏了。
        </span>
      </div>

      <div class="geo-run-panel__runs">
        <h5 class="geo-run-panel__runs-title">这个计划的轮次</h5>
        <StateBlock v-if="runsError" state="error" :detail="runsError" />
        <StateBlock v-else-if="!runs.length" state="empty" title="还没跑过一轮"
          next="看过预估并勾选确认后，按上面的按钮起第一轮" />
        <ul v-else class="geo-run-panel__run-list">
          <li v-for="run in runs" :key="run.id" class="geo-run-panel__run">
            <div class="geo-run-panel__run-head">
              <StatusTag domain="geoRun" :status="run.status" :label="statusLabel(run)" />
              <StatusTag domain="geoJudgeState" :status="run.judgeState" :label="run.judgeStateLabel" />
              <span class="geo-run-panel__run-meta">
                第 {{ run.id }} 轮 · {{ formatDateTimeWithZone(run.createdAt) }} ·
                取到 {{ run.callCount ?? 0 }} 次、未取到 {{ run.failedCallCount ?? 0 }} 次 ·
                提问 {{ run.promptTokens ?? 0 }} + {{ run.completionTokens ?? 0 }} token ·
                判定 {{ run.judgeCallCount ?? 0 }} 条 {{ (run.judgePromptTokens ?? 0) + (run.judgeCompletionTokens ?? 0) }} token
              </span>
              <a-button
                v-if="run.status === 'SUCCEEDED' || run.status === 'PARTIAL'"
                size="small"
                type="link"
                @click="emit('view-report', run.id)"
              >看报告</a-button>
            </div>
            <div v-if="run.stageText" class="geo-run-panel__run-stage">{{ run.stageText }}</div>
            <a-progress
              v-if="geoRunIsInFlight(run.status)"
              :percent="runPercent(run)"
              size="small"
              :show-info="false"
            />
            <div v-if="run.queuedReason" class="geo-run-panel__run-queued">{{ run.queuedReason }}</div>
            <div v-if="run.stalledReason" class="geo-run-panel__run-stalled">{{ run.stalledReason }}</div>
            <div v-if="run.judgeStalledReason" class="geo-run-panel__run-stalled">{{ run.judgeStalledReason }}</div>
            <div v-if="run.errorMessage" class="geo-run-panel__run-error">{{ run.errorMessage }}</div>
            <div v-if="run.judgeErrorMessage" class="geo-run-panel__run-error">{{ run.judgeErrorMessage }}</div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped lang="less">
.geo-run-panel {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: var(--admin-radius-card, 12px);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  &__head-actions {
    display: flex;
    gap: 8px;
  }

  &__note {
    margin: 8px 0 16px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__estimate {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th {
      width: 96px;
      padding: 6px 8px 6px 0;
      color: #8c8c8c;
      font-weight: 400;
      text-align: left;
      vertical-align: top;
    }

    td {
      padding: 6px 8px;
      vertical-align: top;
    }
  }

  &__estimate-value {
    width: 132px;
    font-weight: 600;
  }

  &__estimate-note {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__empty-estimate {
    margin: 0 0 12px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__billing {
    margin: 8px 0 0;
    font-size: 12px;
    color: #595959;
  }

  &__notice {
    margin-top: 12px;
  }

  /* 与上面那条 notice 分得开：那一条是「不受理」，这一条是「受理，但有一段拿不到数」 */
  &__unmeasurable {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #ffe58f;
    border-left: 3px solid #faad14;
    background: #fffbe6;
  }

  &__unmeasurable-title {
    font-size: 13px;
    font-weight: 600;
    color: #595959;
  }

  &__unmeasurable-body {
    margin: 6px 0 0;
    font-size: 12px;
    color: #595959;
  }

  &__unmeasurable-hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: #8c8c8c;
  }

  &__confirm {
    margin-top: 12px;
  }

  &__confirm-note {
    margin: 6px 0 0;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }

  &__denied {
    color: #ff4d4f;
    font-size: 12px;
  }

  &__runs {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px dashed #f0f0f0;
  }

  &__runs-title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
  }

  &__run-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__run {
    padding: 8px 0;
    border-bottom: 1px solid #fafafa;
  }

  &__run-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__run-meta,
  &__run-stage {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__run-error {
    margin-top: 4px;
    color: #ff4d4f;
    font-size: 12px;
  }

  &__waiting {
    color: #d46b08;
    font-size: 12px;
  }

  // 「停着不动」是警告不是失败：这一轮的状态词一个字没改（#108），界面只补一句出路
  &__run-stalled {
    margin-top: 4px;
    color: #d46b08;
    font-size: 12px;
  }

  /*
   * 排队（#143）不是坏事，所以它不能用 stalled 那套橙色：橙色说的是「线程没了、要人决定重跑」，
   * 而这一句说的是「还没轮到它，等就行」。两种颜色各指一件事，操作的人一眼能分清该等还是该动手。
   */
  &__run-queued {
    margin-top: 4px;
    color: #595959;
    font-size: 12px;
  }
}
</style>
