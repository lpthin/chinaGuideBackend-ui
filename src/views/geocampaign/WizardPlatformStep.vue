<script setup lang="ts">
/**
 * 向导第 ⑤ 步「平台与预算」（Spec-F §10-2 ⑤ + §10-3，P2 接上）。
 *
 * P1 这里是一块「下一期接入」的牌子；P2 起它是整条链路上第一次真花钱的地方，所以顺序钉死：
 * 选平台（卡片只来自 `GET /geo/campaign/platforms`，界面不列「支持哪几家」）→ 存成计划 →
 * 看预估 → 勾确认 → 起跑。平台少于 3 家只提示不拦（§10-2 ⑤ 的建议式），
 * 而「没看预估」「没勾确认」「notice 非空」三种情况一律按不动按钮。
 *
 * 题的范围这一步不重挑：后端在建计划时把「该档案下当前启用的题」拍成快照（含平台通用题），
 * 要改问什么回第 ③④ 步的开关，这一屏只说清本轮会问几道。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { notification } from 'ant-design-vue'
import CampaignRunPanel from './CampaignRunPanel.vue'
import StateBlock from '../../components/StateBlock.vue'
import { geoCampaignApi, type GeoCampaign, type GeoPlatformOption } from '../../api/geoCampaign'
import { geoBrandApi, type GeoBrandQuestion, type GeoQuestionKind } from '../../api/geoBrand'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'
import {
  REPEAT_MAX,
  REPEAT_MIN,
  emptyCampaignDraft,
  platformHint,
  wizardStateJson,
} from './geoCampaignModel'
import type { WizardState } from '../../components/wizardModel'

const props = defineProps<{
  profileId: number | null
  siteId: number | null
  brandName: string
  wizardState: WizardState
  runStatusLabels?: Record<string, string>
  /** 从工作台的「跑新一轮」带过来的计划 id：直接接着它预估，不必再挑一次 */
  initialCampaignId?: number | null
}>()

const emit = defineEmits<{ (e: 'view-report', runId: number): void }>()

const platforms = ref<GeoPlatformOption[]>([])
const platformsLoading = ref(false)
const platformsError = ref<string | null>(null)

const questions = ref<GeoBrandQuestion[]>([])
const campaigns = ref<GeoCampaign[]>([])

const draft = ref(emptyCampaignDraft())
const campaignId = ref<number | null>(null)
const saving = ref(false)
const panel = ref<InstanceType<typeof CampaignRunPanel> | null>(null)

const pickedCount = computed(() => draft.value.platformIds.length)
const availableCount = computed(() => platforms.value.length)
const hint = computed(() => platformHint(pickedCount.value, availableCount.value))

const questionCounts = computed(() => {
  const enabled = questions.value.filter((question) => question.enabled)
  const byKind = (kind: GeoQuestionKind) => enabled.filter((question) => question.kind === kind).length
  return { total: enabled.length, mention: byKind('MENTION'), reputation: byKind('REPUTATION') }
})

async function loadPlatforms() {
  if (!props.siteId) {
    platforms.value = []
    platformsError.value = null
    return
  }
  platformsLoading.value = true
  platformsError.value = null
  try {
    platforms.value = await geoCampaignApi.platforms(props.siteId)
    // 卡片变了就把不在清单里的勾选抹掉：留着它，后端会直接报「平台不在可选清单里」
    const ids = platforms.value.map((item) => item.id)
    draft.value.platformIds = draft.value.platformIds.filter((id) => ids.includes(id))
  } catch (e) {
    platformsError.value = describeHttpError(e)
    logError('geocampaign/平台清单', e)
  } finally {
    platformsLoading.value = false
  }
}

async function loadQuestions() {
  if (!props.profileId) {
    questions.value = []
    return
  }
  try {
    const data = await geoBrandApi.questions(props.profileId)
    questions.value = [...(data.tenant || []), ...(data.platform || [])]
  } catch (e) {
    // 题数读不到不影响存计划（服务端自己拍快照），这里只留一句可查的错
    logError('geocampaign/题池计数', e)
  }
}

async function loadCampaigns() {
  if (!props.profileId) {
    campaigns.value = []
    return
  }
  try {
    const data = await geoCampaignApi.listCampaigns({ brandProfileId: props.profileId, page: 1, size: 20 })
    campaigns.value = data.records || []
  } catch (e) {
    logError('geocampaign/计划清单', e)
  }
}

/** 存这一屏的勾选：没有计划就建一个（题与平台在后端拍成快照），有了就改下一轮问什么 */
async function savePlan() {
  if (!props.profileId) return
  saving.value = true
  try {
    const wizardState = wizardStateJson(props.wizardState)
    if (campaignId.value) {
      await geoCampaignApi.updateCampaign(campaignId.value, {
        // 空串原样发过去：后端的语义是「null = 这列不动」，写成 || null 就成了「改回去了但没改」
        name: draft.value.name.trim(),
        platformIds: draft.value.platformIds,
        repeatTimes: draft.value.repeatTimes,
        note: draft.value.note.trim(),
        wizardState,
      })
      notification.success({ message: '计划已更新', description: '下一轮按新的勾选跑；已经在跑的那一轮不受影响。' })
    } else {
      const created = await geoCampaignApi.createCampaign({
        siteId: props.siteId,
        brandProfileId: props.profileId,
        name: draft.value.name.trim(),
        platformIds: draft.value.platformIds,
        questionIds: [],
        repeatTimes: draft.value.repeatTimes,
        wizardState,
        note: draft.value.note.trim(),
      })
      campaignId.value = created.id
      notification.success({ message: '诊断计划已建好', description: '现在可以看预估了——那一步一次模型都不调。' })
    }
    await loadCampaigns()
    panel.value?.loadEstimate()
  } catch (e) {
    notification.error({ message: '保存诊断计划失败', description: describeHttpError(e) })
    logError('geocampaign/存计划', e)
  } finally {
    saving.value = false
  }
}

function useCampaign(campaign: GeoCampaign) {
  campaignId.value = campaign.id
  draft.value = {
    name: campaign.name,
    repeatTimes: campaign.repeatTimes,
    note: campaign.note || '',
    platformIds: [...campaign.platformIds],
  }
}

function startNewPlan() {
  campaignId.value = null
  draft.value = emptyCampaignDraft()
}

watch(() => props.siteId, loadPlatforms)
watch(() => props.profileId, async () => {
  campaignId.value = null
  await Promise.all([loadQuestions(), loadCampaigns()])
})

onMounted(async () => {
  await Promise.all([loadPlatforms(), loadQuestions(), loadCampaigns()])
  const wanted = campaigns.value.find((item) => item.id === Number(props.initialCampaignId))
  if (wanted) useCampaign(wanted)
})
</script>

<template>
  <div class="geo-step-platform">
    <StateBlock
      v-if="!profileId"
      state="empty"
      title="还没有品牌档案"
      detail="第 ⑤ 步要建的是挂在某个档案上的诊断计划，没有档案就没有主体。"
      next="回到第 ① 步保存品牌档案"
    />

    <template v-else>
      <section class="geo-step-platform__block">
        <h4 class="geo-step-platform__title">检测平台（{{ pickedCount }} / {{ availableCount }} 已勾）</h4>
        <p class="geo-step-platform__note">
          清单只有一个出处：库里启用的聊天模型配置行。向量模型与出图模型收不到这个问题——
          它们不会报错，只会返回一段没用的东西，而那段照样花钱。
        </p>
        <p v-if="platformsLoading" class="geo-step-platform__loading">正在读平台清单…</p>
        <StateBlock v-else-if="platformsError" state="error" :detail="platformsError" />
        <StateBlock
          v-else-if="!platforms.length"
          state="empty"
          title="一个可选平台都没有"
          next="先在「大模型配置」里为本租户或平台启用一个聊天模型，再回来刷新这一屏"
        />
        <a-checkbox-group v-else v-model:value="draft.platformIds" class="geo-step-platform__cards">
          <a-checkbox v-for="item in platforms" :key="item.id" :value="item.id" class="geo-step-platform__card">
            {{ item.name }}<span class="geo-step-platform__card-model">（{{ item.modelName || PH_DASH }}）</span>
          </a-checkbox>
        </a-checkbox-group>
        <p v-if="hint" class="geo-step-platform__hint">{{ hint }}</p>
      </section>

      <section class="geo-step-platform__block">
        <h4 class="geo-step-platform__title">这一轮问什么</h4>
        <p class="geo-step-platform__note">
          默认问该档案下<b>当前启用</b>的题：可见度 {{ questionCounts.mention }} 道、口碑 {{ questionCounts.reputation }} 道，
          合计 {{ questionCounts.total }} 道（含平台通用题）。要改问哪些，回第 ③④ 步的启用开关；
          存成计划之后，这一批题就拍成快照了，后来改题池不影响已经跑过的那一轮。
        </p>
        <div class="geo-step-platform__fields">
          <a-form-item label="计划名称">
            <a-input v-model:value="draft.name" :maxlength="100" :placeholder="`${brandName || '本品牌'} 诊断 <今天>`" />
          </a-form-item>
          <a-form-item :label="`每题重复次数（${REPEAT_MIN}~${REPEAT_MAX}）`">
            <a-input-number v-model:value="draft.repeatTimes" :min="REPEAT_MIN" :max="REPEAT_MAX" />
            <span class="geo-step-platform__field-note">
              默认 3 次是置信区间的最低要求；填 1 就没有 ± 可谈，报告上那一格会显示「未取到」。
            </span>
          </a-form-item>
          <a-form-item label="备注（给自己看）">
            <a-input v-model:value="draft.note" :maxlength="200" placeholder="例如：这轮先看牙科三家在 deepseek 上的样子" />
          </a-form-item>
        </div>
        <a-button type="primary" :loading="saving" @click="savePlan">
          {{ campaignId ? '保存这一屏的勾选' : '存为诊断计划' }}
        </a-button>
      </section>

      <section v-if="campaigns.length" class="geo-step-platform__block">
        <h4 class="geo-step-platform__title">这个档案已有的计划</h4>
        <ul class="geo-step-platform__plans">
          <li v-for="item in campaigns" :key="item.id">
            <span class="geo-step-platform__plan-name">{{ item.name }}</span>
            <span class="geo-step-platform__plan-meta">
              {{ item.questionCount }} 题 × {{ item.platformCount }} 平台 × {{ item.repeatTimes }} 次 ·
              {{ item.confirmStateLabel }} · 预估提问 {{ item.costEstimateCalls }} 次 / {{ item.costEstimateTokens }} token（判定另算）
            </span>
            <a-button size="small" type="link" @click="useCampaign(item)">用它</a-button>
            <a-button v-if="item.latestRun" size="small" type="link" @click="emit('view-report', item.latestRun.id)">
              最近一轮报告
            </a-button>
          </li>
        </ul>
        <a-button size="small" @click="startNewPlan">另建一个计划</a-button>
      </section>

      <CampaignRunPanel
        ref="panel"
        :campaign-id="campaignId"
        :run-status-labels="runStatusLabels"
        @view-report="(runId: number) => emit('view-report', runId)"
      />
    </template>
  </div>
</template>

<style scoped lang="less">
.geo-step-platform {
  &__block {
    margin-bottom: 20px;
    padding: 16px;
    border: 1px solid #f0f0f0;
    border-radius: var(--admin-radius-card, 12px);
  }

  &__title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  &__note {
    margin: 0 0 12px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__loading {
    margin: 0 0 12px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  &__card {
    display: flex;
    align-items: flex-start;
    margin-left: 0;
    padding: 12px;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
  }

  &__card-model {
    color: #8c8c8c;
    font-size: 12px;
  }

  &__hint {
    margin: 12px 0 0;
    color: #faad14;
    font-size: 12px;
  }

  &__fields {
    margin-bottom: 12px;
  }

  &__field-note {
    margin-left: 8px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__plans {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid #fafafa;
    }
  }

  &__plan-name {
    font-size: 13px;
    font-weight: 600;
  }

  &__plan-meta {
    color: #8c8c8c;
    font-size: 12px;
  }
}
</style>
