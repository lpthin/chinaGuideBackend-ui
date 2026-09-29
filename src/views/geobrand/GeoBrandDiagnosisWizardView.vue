<script setup lang="ts">
/**
 * 品牌诊断向导（Spec-F §10-2 的五步形状，P1 落地 ①~④，⑤ 只挂面板）。
 *
 * 步骤状态 {current, maxReached} 按档案 id 落 localStorage——刷新/进来回原步；
 * 落库（geo_campaign）排在 P2，这里一律不写后端步骤状态（§9.6：没做的事不假装做了）。
 * profileId 可以来自路由 query（档案页「进入向导」），也可以由第①步现场新建。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message, notification } from 'ant-design-vue'
import PageShell from '../../components/PageShell.vue'
import StateBlock from '../../components/StateBlock.vue'
import WizardSteps from '../../components/WizardSteps.vue'
import type { WizardState } from '../../components/wizardModel'
import ProfileForm from './ProfileForm.vue'
import BrandCompetitorPanel from './BrandCompetitorPanel.vue'
import BrandQuestionPanel from './BrandQuestionPanel.vue'
import WizardCompetitorStep from './WizardCompetitorStep.vue'
import WizardPlatformStep from './WizardPlatformStep.vue'
import { geoBrandApi, type GeoAutoDiscoverResult, type GeoBrandProfileForm } from '../../api/geoBrand'
import { describeHttpError } from '../../api/http'
import { siteApi } from '../../api/workspace'
import { logError } from '../../utils/errorLog'
import {
  GEO_WIZARD_STEPS,
  brandTokens,
  emptyProfileForm,
  emptyQuestionDraft,
  loadWizardState,
  questionViolation,
  saveWizardState,
  validateStepAdvance,
} from './geoBrandWizard'

const props = defineProps<{ profileId?: number | null }>()
const route = useRoute()

const createdId = ref<number | null>(null)
const activeProfileId = computed<number | null>(() => {
  const candidate = createdId.value ?? props.profileId ?? (route.query.profileId as string | undefined)
  const n = Number(candidate)
  return Number.isFinite(n) && n > 0 ? n : null
})

const wizardState = ref<WizardState>(loadWizardState(activeProfileId.value))
watch(wizardState, (state) => saveWizardState(activeProfileId.value, state))

const sites = ref<Array<{ id: number; name: string }>>([])
const siteOptions = computed(() => sites.value.map((site) => ({ value: site.id, label: site.name })))

const form = reactive<GeoBrandProfileForm>(emptyProfileForm())
const saving = ref(false)

const autoResult = ref<GeoAutoDiscoverResult | null>(null)
const discovering = ref(false)
const competitorPanel = ref<InstanceType<typeof BrandCompetitorPanel> | null>(null)

const mentionDraft = reactive(emptyQuestionDraft())
const reputationDraft = reactive(emptyQuestionDraft())
const questionSaving = ref(false)
const mentionPanel = ref<InstanceType<typeof BrandQuestionPanel> | null>(null)
const reputationPanel = ref<InstanceType<typeof BrandQuestionPanel> | null>(null)

const tokens = computed(() => brandTokens(form))

async function loadWizardData() {
  if (!activeProfileId.value) return
  try {
    const profile = await geoBrandApi.getProfile(activeProfileId.value)
    Object.assign(form, {
      siteId: profile.siteId,
      brandName: profile.brandName,
      brandWords: [...profile.brandWords],
      officialUrls: [...profile.officialUrls],
      brandIntro: profile.brandIntro,
    })
  } catch (e) {
    notification.error({ message: '品牌档案读取失败', description: describeHttpError(e) })
    logError('geobrand/诊断向导', e)
  }
}

async function saveProfile() {
  if (!form.brandName.trim()) {
    message.warning('请填写品牌名')
    return
  }
  if (!form.siteId) {
    message.warning('请选择站点')
    return
  }
  saving.value = true
  try {
    if (activeProfileId.value) {
      await geoBrandApi.updateProfile(activeProfileId.value, { ...form })
      message.success('品牌档案已保存')
    } else {
      const created = await geoBrandApi.createProfile({ ...form })
      createdId.value = created.id
      message.success('品牌档案已创建')
    }
  } catch (e) {
    notification.error({ message: '保存品牌档案失败', description: describeHttpError(e) })
    logError('geobrand/诊断向导', e)
  } finally {
    saving.value = false
  }
}

/** 第①步的「取消」＝丢掉本地草稿：有档案就回读服务端那一份，没档案就清空（不留一个点了没反应的按钮） */
function cancelProfileEdit() {
  if (activeProfileId.value) {
    loadWizardData()
    return
  }
  Object.assign(form, emptyProfileForm())
}

async function discoverCompetitors() {
  if (!activeProfileId.value) return
  discovering.value = true
  try {
    autoResult.value = await geoBrandApi.autoDiscoverCompetitors(activeProfileId.value)
    competitorPanel.value?.reload()
  } catch (e) {
    notification.error({ message: '自动发现竞品失败', description: describeHttpError(e) })
    logError('geobrand/诊断向导', e)
  } finally {
    discovering.value = false
  }
}

async function submitQuestion(kind: 'MENTION' | 'REPUTATION', draft: { coreWord: string; questionText: string }) {
  if (!activeProfileId.value) return
  if (questionViolation(kind, draft.questionText, tokens.value)) {
    // 拦下这一步的「下一步」与「加入问题池」都靠同一份判据；警告文案已在题面旁边红字显示
    return
  }
  questionSaving.value = true
  try {
    await geoBrandApi.addQuestion(activeProfileId.value, {
      kind,
      coreWord: draft.coreWord.trim(),
      questionText: draft.questionText.trim(),
    })
    draft.coreWord = ''
    draft.questionText = ''
    message.success('题目已加入问题池')
    ;(kind === 'MENTION' ? mentionPanel : reputationPanel).value?.reload()
  } catch (e) {
    notification.error({ message: '加入问题池失败', description: describeHttpError(e) })
    logError('geobrand/诊断向导', e)
  } finally {
    questionSaving.value = false
  }
}

/** WizardSteps 的校验钩子：判据本体在 geoBrandWizard.validateStepAdvance（用例认同一份） */
function beforeNext(to: number) {
  if (!activeProfileId.value && wizardState.value.current === 0) {
    return '请先点「保存」建好品牌档案，再进入下一步'
  }
  return validateStepAdvance({
    from: wizardState.value.current,
    brandName: form.brandName,
    mentionDraft,
    reputationDraft,
    tokens: tokens.value,
  })
}

onMounted(async () => {
  try {
    const list = await siteApi.list()
    sites.value = (list || []).map((site: any) => ({ id: site.id, name: site.name }))
  } catch (e) {
    logError('geobrand/诊断向导', e)
  }
  await loadWizardData()
})
</script>

<template>
  <PageShell
    title="GEO 品牌诊断向导"
    subtitle="五步定一轮诊断的素材：品牌 → 竞品 → 两类题 → 平台与预算（第⑤步下一期接入）"
  >
    <WizardSteps v-model="wizardState" :steps="GEO_WIZARD_STEPS" :before-next="beforeNext">
      <template #step-brand>
        <ProfileForm
          :form="form"
          :site-options="siteOptions"
          :saving="saving"
          @save="saveProfile"
          @cancel="cancelProfileEdit"
        />
        <p class="geobrand-wizard__step-note">
          第①步只写品牌档案这张表；步骤走到哪一步存在本机浏览器里，刷新不丢。
        </p>
      </template>

      <template #step-competitors>
        <StateBlock
          v-if="!activeProfileId"
          state="empty"
          title="还没有品牌档案"
          next="回到第①步保存品牌档案，这里才有可挂竞品的主体"
        />
        <template v-else>
          <BrandCompetitorPanel ref="competitorPanel" :profile-id="activeProfileId" />
          <WizardCompetitorStep
            :profile-id="activeProfileId"
            :auto-result="autoResult"
            :discovering="discovering"
            @discover="discoverCompetitors"
          />
        </template>
      </template>

      <template #step-mention>
        <BrandQuestionPanel
          v-if="activeProfileId"
          ref="mentionPanel"
          :profile-id="activeProfileId"
          kind="MENTION"
          :tokens="tokens"
          :saving="questionSaving"
          v-model:core-word="mentionDraft.coreWord"
          v-model:question-text="mentionDraft.questionText"
          @submit="submitQuestion('MENTION', mentionDraft)"
        />
        <StateBlock v-else state="empty" title="还没有品牌档案" next="回到第①步保存品牌档案" />
      </template>

      <template #step-reputation>
        <BrandQuestionPanel
          v-if="activeProfileId"
          ref="reputationPanel"
          :profile-id="activeProfileId"
          kind="REPUTATION"
          :tokens="tokens"
          :saving="questionSaving"
          v-model:core-word="reputationDraft.coreWord"
          v-model:question-text="reputationDraft.questionText"
          @submit="submitQuestion('REPUTATION', reputationDraft)"
        />
        <StateBlock v-else state="empty" title="还没有品牌档案" next="回到第①步保存品牌档案" />
      </template>

      <template #step-platform>
        <WizardPlatformStep />
      </template>
    </WizardSteps>
  </PageShell>
</template>

<style scoped lang="less">
.geobrand-wizard {
  &__step-note {
    margin: 16px 0 0;
    color: #8c8c8c;
    font-size: 12px;
  }
}
</style>
