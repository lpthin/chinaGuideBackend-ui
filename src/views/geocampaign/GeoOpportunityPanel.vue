<script setup lang="ts">
/**
 * 机会问题清单 + 一键成内容（Spec-F §11.5 / §10-6，P4 前端）。
 *
 * 这一屏是整个 Spec 里唯一真正拉开差距的一条（§3「独有优势」）：观测到缺口之后，
 * 直接把它转成内容。但它也是最容易说谎的一屏，所以四条闸摆在明面上：
 * 1. <b>先看价再点头</b>：预估那一次模型都不调，主按钮在没有【当前这个动作】的预估之前按不动——
 *    换过动作必须重新预估，否则确认的是一个数、花的是另一个数（§12 花钱端点那条）；
 * 2. <b>四个动作都转交现有流水线</b>，界面不许承诺「已发布」：`PUBLISHED` 只能由后端读那条内容
 *    自己的状态得到，所以这一屏<b>没有</b>「标记已发布」那一发；
 * 3. <b>每个数都有出处</b>：缺口档位念行自带的判据句子，token 数、账走哪条、受理与否的 `notice`
 *    全部来自接口，这里一次算术都不做；
 * 4. <b>「未验证」是一句话不是第五个状态</b>：`verificationNote` 原样摆在状态旁边（§11.5 第四条）。
 *
 * `draftRef` 前缀与 `actionType` 是后端同一处写进去的，所以「产出对象」那一格念动作名不会错，
 * 前端不需要再抄一份前缀词表。
 */
import { computed, ref, watch } from 'vue'
import { notification } from 'ant-design-vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import GeoOpportunityDrawer from './GeoOpportunityDrawer.vue'
import {
  geoCampaignApi,
  type GeoOpportunity,
  type GeoOpportunityEstimate,
  type GeoOpportunityList,
  type GeoVocabulary,
} from '../../api/geoCampaign'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'
import {
  DISMISS_REASON_MAX,
  DRAFT_CONFIRM_TEXT,
  SCOPE_NOTE,
  UNMEASURED_NOTE,
  actionDefinition,
  actionKeys,
  actionLabel,
  draftGate,
  draftRefText,
  estimateLines,
  estimateNotice,
  evidenceText,
  isSettledState,
  summarySentence,
} from './geoOpportunityModel'

const props = defineProps<{
  runId: number
  vocabulary: GeoVocabulary | null
}>()

const list = ref<GeoOpportunityList | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const includeResolved = ref(false)

const activeId = ref<number | null>(null)
const selectedAction = ref<string | null>(null)
const estimate = ref<GeoOpportunityEstimate | null>(null)
/** 面板上这一份预估是针对【哪一个动作】算的：与 selectedAction 不一致就是过期价 */
const estimatedAction = ref<string | null>(null)
const estimating = ref(false)
const confirmChecked = ref(false)
const submitting = ref(false)

const dismissReason = ref('')
const dismissing = ref(false)

const drawerOpen = ref(false)
const drawerRow = ref<GeoOpportunity | null>(null)

const rows = computed(() => list.value?.items ?? [])
const active = computed(() => rows.value.find((row) => row.id === activeId.value) ?? null)
const keys = computed(() => actionKeys(props.vocabulary))
const lines = computed(() => (estimate.value ? estimateLines(estimate.value) : []))
const gate = computed(() => draftGate({
  estimate: estimate.value,
  estimatedAction: estimatedAction.value,
  selectedAction: selectedAction.value,
  confirmChecked: confirmChecked.value,
  submitting: submitting.value,
}))
/** 后端那句「这一发不会受理」：摆出来，不藏进 tooltip（§9.6 界面不许谎报） */
const notice = computed(() => estimateNotice(estimate.value))
const dismissBlocked = computed(() => {
  const reason = dismissReason.value.trim()
  return dismissing.value || !reason || reason.length > DISMISS_REASON_MAX
})

async function load() {
  if (!Number.isFinite(props.runId) || props.runId <= 0) return
  loading.value = true
  error.value = null
  try {
    list.value = await geoCampaignApi.opportunities(props.runId, includeResolved.value)
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geocampaign/机会清单', e)
  } finally {
    loading.value = false
  }
}

function selectRow(row: GeoOpportunity) {
  if (activeId.value === row.id) {
    activeId.value = null
    return
  }
  activeId.value = row.id
  // 动作跟着行上那一格走（OPEN 行是后端的建议动作，人换过就是他选的那一个）
  selectedAction.value = row.actionType
  resetQuote()
}

/** 换动作 ⇒ 旧价作废：这是「确认的是一个数、花的是另一个数」唯一的防线 */
function pickAction(key: string) {
  if (selectedAction.value === key) return
  selectedAction.value = key
  resetQuote()
}

function resetQuote() {
  estimate.value = null
  estimatedAction.value = null
  confirmChecked.value = false
  dismissReason.value = ''
}

async function loadEstimate() {
  const row = active.value
  const action = selectedAction.value
  if (!row || !action) return
  estimating.value = true
  try {
    const data = await geoCampaignApi.opportunityEstimate(row.id, action)
    // 等回来的这一份价可能已经属于别的行或别的动作了（人在途中点了别的行 / 换了动作）：
    // 只在这一份价仍然对应面板上当前的这一行这一个动作时才贴上去，否则丢掉——
    // 挂一份过期价在按钮旁边，用户确认的就是另一个数（§12 花钱端点）
    if (activeId.value !== row.id || selectedAction.value !== action) return
    estimate.value = data
    estimatedAction.value = action
  } catch (e) {
    notification.error({ message: '预估未取到', description: describeHttpError(e) })
    logError('geocampaign/机会预估', e)
  } finally {
    estimating.value = false
  }
}

async function submitDraft() {
  const row = active.value
  if (!row || gate.value.disabled) return
  submitting.value = true
  try {
    const result = await geoCampaignApi.opportunityDraft(row.id, selectedAction.value, true)
    // nextStep 必须念出来：草稿≠已发布，只说「成功」客户就以为内容上线了
    notification.success({
      message: '草稿已产出',
      description: result?.nextStep || '内容已经产出为草稿，还需要它自己的发布动作才对访客可见。',
    })
    resetQuote()
    await load()
  } catch (e) {
    // 后端拒绝的那句话就是原因（闸没过 / 状态走不通 / 队列满），原样递给用户
    notification.error({ message: '这一发没有受理', description: describeHttpError(e) })
    logError('geocampaign/一键成内容', e)
  } finally {
    submitting.value = false
  }
}

async function submitDismiss() {
  const row = active.value
  if (!row || dismissBlocked.value) return
  dismissing.value = true
  try {
    await geoCampaignApi.opportunityDismiss(row.id, dismissReason.value.trim())
    notification.success({
      message: '这一条不做了',
      description: '理由已经留在这一条的留痕里；这一行现在的状态以下一次读回来为准，界面上不自己盖章。',
    })
    dismissReason.value = ''
    await load()
  } catch (e) {
    notification.error({ message: '放弃未受理', description: describeHttpError(e) })
    logError('geocampaign/放弃机会', e)
  } finally {
    dismissing.value = false
  }
}

function openTrace(row: GeoOpportunity) {
  drawerRow.value = row
  drawerOpen.value = true
}

watch(() => props.runId, () => {
  activeId.value = null
  resetQuote()
  void load()
}, { immediate: true })
watch(includeResolved, () => void load())
</script>

<template>
  <section class="geo-opp" data-card="opportunity">
    <h3 class="geo-opp__title">机会问题（补哪一页）</h3>
    <p v-if="list" class="geo-opp__summary">{{ summarySentence(list) }}</p>
    <p class="geo-opp__scope">{{ SCOPE_NOTE }}</p>
    <p v-if="list && list.unmeasuredQuestions" class="geo-opp__unmeasured">{{ UNMEASURED_NOTE }}</p>

    <div class="geo-opp__toolbar">
      <a-switch v-model:checked="includeResolved" size="small" />
      <span class="geo-opp__toolbar-label">把「已达成」的那几行也列出来</span>
      <a-button size="small" :loading="loading" @click="load">刷新</a-button>
    </div>

    <StateBlock v-if="loading && !list" state="not-measured" title="正在读这一份机会清单" />
    <StateBlock v-else-if="error" state="error" :detail="error" />
    <StateBlock v-else-if="list && !rows.length" state="empty"
      title="这一份清单里没有还差着的题"
      next="要么这一轮的题全被覆盖并被引用了（那是好事），要么这一轮的机会那一段没算出来——回报告「没测到的部分」看轮次上留的那句原因，或重跑一轮" />

    <table v-else-if="list" class="geo-opp__table">
      <thead>
        <tr>
          <th>用户会这么问 AI 的原话</th>
          <th>差在哪一步</th>
          <th>这一轮的观测</th>
          <th>状态</th>
          <th>产出对象</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" :data-active="row.id === activeId ? '1' : '0'">
          <td>
            <div class="geo-opp__question">{{ row.questionText }}</div>
            <div class="geo-opp__meta">核心词 {{ row.coreWord || PH_DASH }} · 第 {{ row.runId }} 轮算出</div>
          </td>
          <td>
            <StatusTag domain="geoGapType" :status="row.gapType" :label="row.gapTypeLabel" />
            <div class="geo-opp__definition">{{ row.gapDefinition || PH_DASH }}</div>
          </td>
          <td class="geo-opp__meta">{{ evidenceText(row) }}</td>
          <td>
            <StatusTag domain="geoOpportunityState" :status="row.state" :label="row.stateLabel" />
            <!-- 「未验证」是一句话，不是第五个状态词：它说的不是「我们做到哪一步」，
                 而是「下一轮跑到这道题没有」（§11.5 第四条） -->
            <div v-if="row.verificationNote" class="geo-opp__unverified">{{ row.verificationNote }}</div>
            <div v-if="row.dismissedReason" class="geo-opp__meta">理由：{{ row.dismissedReason }}</div>
          </td>
          <td class="geo-opp__meta">{{ draftRefText(row) }}</td>
          <td>
            <div class="geo-opp__row-actions">
              <a-button size="small" @click="selectRow(row)">
                {{ row.id === activeId ? '收起' : '怎么办' }}
              </a-button>
              <a-button size="small" type="link" @click="openTrace(row)">留痕</a-button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 预估与确认面板：只对【当前选中的那一行】开，换行就整块重置，不留一份过期价在下面 -->
    <div v-if="active" class="geo-opp__panel" :data-opportunity="active.id">
      <div class="geo-opp__panel-title">{{ active.questionText }}</div>
      <p class="geo-opp__panel-note">
        这一条现在算「{{ active.gapTypeLabel || active.gapType }}」。四个动作都不自己写内容，
        各自转交给系统里已经在花钱的那条流水线，所以产出的是<b>草稿</b>，发布由内容自己的动作决定。
      </p>

      <div class="geo-opp__actions">
        <button v-for="key in keys" :key="key" type="button" class="geo-opp__action"
          :class="{ 'geo-opp__action--on': key === selectedAction }" :disabled="submitting"
          @click="pickAction(key)">
          <span class="geo-opp__action-label">
            {{ actionLabel(vocabulary, key, key === active.actionType ? active.actionLabel : null) }}
          </span>
          <span class="geo-opp__action-def">{{ actionDefinition(vocabulary, key) }}</span>
        </button>
      </div>
      <p v-if="!keys.length" class="geo-opp__meta">
        动作词表还没到手（后端的 vocabulary 里没有 opportunityActions 这一族），所以这里一个按钮都不摆。
      </p>

      <div class="geo-opp__quote">
        <a-button size="small" :loading="estimating" :disabled="!selectedAction || submitting"
          @click="loadEstimate">
          看这个动作的预估（一次模型都不调）
        </a-button>
        <span v-if="!estimate" class="geo-opp__meta">
          没看预估之前主按钮按不动：这一发真花钱，也真往站点里写内容。
        </span>
      </div>

      <table v-if="estimate" class="geo-opp__estimate">
        <tbody>
          <tr v-for="line in lines" :key="line.label">
            <th>{{ line.label }}</th>
            <td>{{ line.value }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="estimate && !estimate.notice" class="geo-opp__panel-note">
        预估与按下去真跑的是同一处算出来的：这一屏不自己乘 token，也不猜哪条流水线更贵。
      </p>
      <p v-if="notice" class="geo-opp__notice">{{ notice }}</p>

      <div class="geo-opp__confirm">
        <!-- 勾选框自己不能被禁用：闸是「没勾 ⇒ 按不动」，锁掉勾这一步等于永远过不了第二道闸。
             但主按钮一直摆着，由 gate.text 说清现在按不动是因为什么——
             藏起按钮用户就只知道「没有这一发」，不知道「差哪一步」。 -->
        <a-checkbox v-if="estimate && !notice" v-model:checked="confirmChecked">{{ DRAFT_CONFIRM_TEXT }}</a-checkbox>
        <div class="geo-opp__confirm-actions">
          <a-button danger type="primary" :disabled="gate.disabled" :loading="submitting" @click="submitDraft">
            {{ gate.text }}
          </a-button>
          <span class="geo-opp__meta">
            走完这一发只是把草稿产出来；它发布之后，下一轮跑到这道题才会把这一条验证掉。
          </span>
        </div>
      </div>

      <div v-if="!isSettledState(active.state)" class="geo-opp__dismiss">
        <div class="geo-opp__dismiss-title">不做这一条也要留下是谁的决定</div>
        <a-textarea v-model:value="dismissReason" :maxlength="DISMISS_REASON_MAX" :rows="2"
          placeholder="例如：这道题不是我们的客户会问的 / 内容已经在别的页面里" />
        <div class="geo-opp__confirm-actions">
          <a-button size="small" :disabled="dismissBlocked" :loading="dismissing" @click="submitDismiss">
            放弃这一条
          </a-button>
          <span class="geo-opp__meta">
            放弃是终态：要往回走只能等下一轮诊断按观测重算，界面上没有「撤销放弃」那一发。
          </span>
        </div>
      </div>
    </div>

    <GeoOpportunityDrawer v-model:open="drawerOpen" :opportunity="drawerRow" :vocabulary="vocabulary" />
  </section>
</template>

<style scoped lang="less">
.geo-opp {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: var(--admin-radius-card, 12px);

  &__title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
  }

  &__summary {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 600;
  }

  &__scope,
  &__meta {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__scope {
    margin: 0 0 4px;
  }

  &__unmeasured {
    margin: 0 0 4px;
    color: #d46b08;
    font-size: 12px;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 0;
  }

  &__toolbar-label {
    font-size: 12px;
    color: #595959;
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

  &__question {
    font-weight: 600;
  }

  &__definition {
    margin-top: 4px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__unverified {
    margin-top: 4px;
    color: #d46b08;
    font-size: 12px;
  }

  &__row-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  &__panel {
    margin-top: 16px;
    padding: 12px;
    border: 1px dashed #d9d9d9;
    border-radius: var(--admin-radius-card, 12px);
  }

  &__panel-title {
    font-size: 14px;
    font-weight: 600;
  }

  &__panel-note {
    margin: 6px 0 0;
    color: #595959;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 12px 0 0;
  }

  &__action {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 200px;
    padding: 8px 10px;
    text-align: left;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  &__action--on {
    background: #e6f4ff;
    border-color: #91caff;
  }

  &__action-label {
    font-size: 13px;
    font-weight: 600;
  }

  &__action-def {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__quote {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
  }

  &__estimate {
    margin-top: 12px;
    border-collapse: collapse;
    font-size: 13px;

    th {
      padding: 4px 12px 4px 0;
      color: #8c8c8c;
      font-weight: 400;
      text-align: left;
      white-space: nowrap;
      vertical-align: top;
    }

    td {
      padding: 4px 0;
      vertical-align: top;
    }
  }

  // 「这一发不会受理」是数据不是异常：橙色明写，不改写成「操作失败」
  &__notice {
    margin: 12px 0 0;
    padding: 8px 10px;
    color: #d46b08;
    font-size: 12px;
    background: #fff7e6;
    border: 1px solid #ffd591;
    border-radius: 8px;
  }

  &__confirm,
  &__dismiss {
    margin-top: 12px;
  }

  &__confirm-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  &__dismiss-title {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
  }
}
</style>
