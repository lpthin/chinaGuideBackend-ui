<script setup lang="ts">
/**
 * 一条机会的状态留痕抽屉（Spec-F §11.5 第一条的现场那一半）。
 *
 * 摆这一屏的理由只有一句：<b>「这条机会为什么在这里」必须能被追问到</b>。
 * 四格状态里 `PUBLISHED` 是系统读出来的（`actor=system`），`DRAFTED` 与 `DISMISSED` 是人点出来的，
 * 谁搬的、依据什么，全在这条时间线上——放弃了却没人知道是谁放弃的、按了动作却不知道扣没扣钱，
 * 都是这一屏要消灭的东西。
 *
 * 两条纪律：
 * 1. 中文状态名与动作名一律念接口给的 label（`fromStateLabel` / `actionLabel`），这里不抄词表；
 * 2. 「未验证」那一句话原样念 `verificationNote`——它是一句话，不是第五个状态词（§11.5 第四条）。
 */
import { computed, ref, watch } from 'vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import { geoCampaignApi, type GeoOpportunity, type GeoOpportunityStateLog, type GeoVocabulary } from '../../api/geoCampaign'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { formatDateTimeWithZone } from '../../utils/format'
import { PH_DASH } from '../../utils/display'
import { evidenceText, stateLabel } from './geoOpportunityModel'
import { statusMeta } from '../../utils/statusTokens'

const props = defineProps<{
  open: boolean
  opportunity: GeoOpportunity | null
  vocabulary: GeoVocabulary | null
}>()

const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const logs = ref<GeoOpportunityStateLog[] | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const systemMoved = computed(() => (logs.value ?? []).filter((entry) => entry.actor === 'system').length)

async function load() {
  const row = props.opportunity
  if (!row) return
  loading.value = true
  error.value = null
  logs.value = null
  try {
    logs.value = await geoCampaignApi.opportunityStateLog(row.id)
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geocampaign/机会留痕', e)
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:open', false)
}

// 每次换一个对象都要重读：留痕是这一条自己的账，复用上一条的结果等于把别人的决定挂在你身上
// （`immediate` 不能省：以「打开」这一形挂上来时没有变更事件，少了它就一次都不读，
// 屏幕上留下的「还没有读到留痕」不是这一条的账，是我们没去读）
watch(() => [props.open, props.opportunity?.id], ([open]) => {
  if (open) void load()
}, { immediate: true })

/**
 * 时间线那一个点的颜色：色值仍取自 `statusTokens`，只是把状态域的两个灰档落到组件认识的
 * `gray`（`a-timeline-item` 不吃 `default`）。
 */
function dotColor(state: string | null | undefined): string {
  const color = statusMeta('geoOpportunityState', state).color
  return color === 'default' ? 'gray' : color
}

function moveText(entry: GeoOpportunityStateLog): string {
  const from = entry.fromStateLabel || entry.fromState
  const to = entry.toStateLabel || stateLabel(props.vocabulary, entry.toState)
  return from ? `${from} → ${to}` : `算成「${to}」`
}
</script>

<template>
  <a-drawer :open="open" placement="right" :width="640" title="这一条机会的来龙去脉" @close="close">
    <template v-if="opportunity">
      <div class="geo-opp-trace__head">
        <div class="geo-opp-trace__question">{{ opportunity.questionText }}</div>
        <div class="geo-opp-trace__meta">
          核心词 {{ opportunity.coreWord || PH_DASH }} · 本轮依据 {{ evidenceText(opportunity) }} ·
          第 {{ opportunity.runId }} 轮算出
        </div>
        <div class="geo-opp-trace__tags">
          <StatusTag domain="geoGapType" :status="opportunity.gapType" :label="opportunity.gapTypeLabel" />
          <StatusTag domain="geoOpportunityState" :status="opportunity.state" :label="opportunity.stateLabel" />
          <span v-if="opportunity.actionLabel" class="geo-opp-trace__action">
            建议动作：{{ opportunity.actionLabel }}
          </span>
        </div>
        <p class="geo-opp-trace__definition">{{ opportunity.gapDefinition || PH_DASH }}</p>
        <p v-if="opportunity.verificationNote" class="geo-opp-trace__unverified">
          {{ opportunity.verificationNote }}
        </p>
        <p v-if="opportunity.dismissedReason" class="geo-opp-trace__dismissed">
          放弃理由：{{ opportunity.dismissedReason }}
        </p>
        <p v-if="opportunity.draftRef" class="geo-opp-trace__meta">
          产出对象：{{ opportunity.draftRef }}（{{ opportunity.actionLabel || opportunity.actionType }}）
        </p>
      </div>
    </template>

    <h4 class="geo-opp-trace__section">状态搬迁留痕</h4>
    <StateBlock v-if="loading" state="not-measured" title="正在读这一条的留痕" />
    <StateBlock v-else-if="error" state="error" :detail="error" />
    <template v-else-if="logs">
      <StateBlock v-if="!logs.length" state="empty" title="这一条还没有一次搬迁"
        next="刚被算出来、没人点过动作的机会就是这一形：按一次动作或等下一轮验证，这里才会有行" />
      <template v-else>
        <p class="geo-opp-trace__summary">
          共 {{ logs.length }} 条留痕，其中 {{ systemMoved }} 条是系统读出来的（内容自己发布了、
          或下一轮重算盖掉了旧观测），其余是人点出来的。
        </p>
        <a-timeline>
          <a-timeline-item v-for="entry in logs" :key="entry.id" :color="dotColor(entry.toState)">
            <div class="geo-opp-trace__move">
              {{ moveText(entry) }}
              <span v-if="entry.actionLabel || entry.actionType" class="geo-opp-trace__who">
                动作：{{ entry.actionLabel || entry.actionType }}
              </span>
            </div>
            <div class="geo-opp-trace__who">
              {{ formatDateTimeWithZone(entry.createdAt) }} ·
              {{ entry.actor === 'system' ? '系统读出' : `人：${entry.actor || PH_DASH}` }}
              <span v-if="entry.draftRef"> · 挂在 {{ entry.draftRef }}</span>
            </div>
            <div v-if="entry.reason" class="geo-opp-trace__reason">{{ entry.reason }}</div>
          </a-timeline-item>
        </a-timeline>
      </template>
    </template>
    <StateBlock v-else state="empty" title="还没有读到留痕" next="这一条的账要在抽屉打开时读：关掉再打开一次就会重读" />
  </a-drawer>
</template>

<style scoped lang="less">
.geo-opp-trace {
  &__head {
    margin-bottom: 16px;
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

  &__tags {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  &__action {
    font-size: 12px;
    color: #595959;
  }

  &__definition {
    margin: 8px 0 0;
    color: #8c8c8c;
    font-size: 12px;
  }

  // 「未验证」与「放弃理由」都是橙色：它们是「这事还没完」，不是「出了错」
  &__unverified,
  &__dismissed {
    margin: 6px 0 0;
    color: #d46b08;
    font-size: 12px;
  }

  &__section {
    margin: 16px 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  &__move {
    font-size: 13px;
    font-weight: 600;
  }

  &__who {
    color: #8c8c8c;
    font-size: 12px;
    font-weight: 400;
  }

  &__reason {
    margin-top: 2px;
    color: #595959;
    font-size: 12px;
  }
}
</style>
