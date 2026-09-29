<script setup lang="ts">
/**
 * 一类追踪题的题池（向导 ③④ 步与档案页共用这一块）。
 * 题面草稿由父组件持有（v-model）：向导的 beforeNext 要用同一份文本判「能不能走下一步」，
 * 状态放两处就会有两份真相。平台通用题（tenantId null）在这里只读——服务端也是这么拦的。
 */
import { computed, ref, watch } from 'vue'
import { message, notification } from 'ant-design-vue'
import DataTable from '../../components/DataTable.vue'
import StatusTag from '../../components/StatusTag.vue'
import QuestionDraftRow from './QuestionDraftRow.vue'
import { geoBrandApi, type GeoBrandQuestion, type GeoQuestionKind } from '../../api/geoBrand'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'
import { QUESTION_KIND_LABEL } from './geoBrandWizard'

const props = defineProps<{
  profileId: number
  kind: GeoQuestionKind
  /** 品牌名 + 品牌词，交给 QuestionDraftRow 判题面 */
  tokens: string[]
  coreWord: string
  questionText: string
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:coreWord', value: string): void
  (e: 'update:questionText', value: string): void
  (e: 'submit'): void
}>()

const tenantQuestions = ref<GeoBrandQuestion[]>([])
const platformQuestions = ref<GeoBrandQuestion[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const label = computed(() => QUESTION_KIND_LABEL[props.kind])

const poolColumns = computed(() => [
  { title: '核心词', dataIndex: 'coreWord', key: 'coreWord', width: 160 },
  { title: '题目', dataIndex: 'questionText', key: 'questionText' },
  { title: '来源', dataIndex: 'origin', key: 'origin', width: 110 },
  { title: '复核', dataIndex: 'reviewState', key: 'reviewState', width: 100 },
  { title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80 },
  { title: '操作', key: 'actions', width: 80 },
])

const platformColumns = computed(() => [
  { title: '核心词', dataIndex: 'coreWord', key: 'coreWord', width: 160 },
  { title: '题目', dataIndex: 'questionText', key: 'questionText' },
  { title: '复核', dataIndex: 'reviewState', key: 'reviewState', width: 100 },
])

async function reload() {
  loading.value = true
  error.value = null
  try {
    const data = await geoBrandApi.questions(props.profileId, props.kind)
    tenantQuestions.value = data.tenant || []
    platformQuestions.value = data.platform || []
  } catch (e) {
    const reason = describeHttpError(e)
    error.value = reason
    logError('geobrand/题池', e)
  } finally {
    loading.value = false
  }
}

async function toggleQuestion(record: GeoBrandQuestion, enabled: boolean) {
  try {
    await geoBrandApi.updateQuestion(record.id, {
      coreWord: record.coreWord,
      questionText: record.questionText,
      enabled,
      reviewState: record.reviewState,
    })
    record.enabled = enabled
    message.success(enabled ? '该题已启用' : '该题已停用')
  } catch (e) {
    notification.error({ message: '切换启用状态失败', description: describeHttpError(e) })
    logError('geobrand/题池', e)
  }
}

async function removeQuestion(record: GeoBrandQuestion) {
  try {
    await geoBrandApi.deleteQuestion(record.id)
    tenantQuestions.value = tenantQuestions.value.filter((item) => item.id !== record.id)
    message.success('该题已删除')
  } catch (e) {
    notification.error({ message: '删除题目失败', description: describeHttpError(e) })
    logError('geobrand/题池', e)
  }
}

watch(() => [props.profileId, props.kind], reload, { immediate: true })

defineExpose({ reload })
</script>

<template>
  <div class="geobrand-question-pool">
    <h4 class="geobrand-question-pool__title">{{ label }}</h4>
    <QuestionDraftRow
      :kind="kind"
      :tokens="tokens"
      :core-word="coreWord"
      :question-text="questionText"
      :saving="saving"
      @update:core-word="(v: string) => emit('update:coreWord', v)"
      @update:question-text="(v: string) => emit('update:questionText', v)"
      @submit="emit('submit')"
    />
    <div class="geobrand-question-pool__section">本租户题池</div>
    <DataTable
      :data-source="tenantQuestions"
      :loading="loading"
      :error="error"
      :columns="poolColumns"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'coreWord'">{{ (record as GeoBrandQuestion).coreWord || PH_DASH }}</template>
        <template v-else-if="column.key === 'origin'">
          <StatusTag domain="geoOrigin" :status="(record as GeoBrandQuestion).origin" />
        </template>
        <template v-else-if="column.key === 'reviewState'">
          <StatusTag domain="geoReviewState" :status="(record as GeoBrandQuestion).reviewState" />
        </template>
        <template v-else-if="column.key === 'enabled'">
          <a-switch
            :checked="(record as GeoBrandQuestion).enabled"
            @change="(v: boolean) => toggleQuestion(record as GeoBrandQuestion, v)"
          />
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-button size="small" danger @click="removeQuestion(record as GeoBrandQuestion)">删除</a-button>
        </template>
      </template>
    </DataTable>
    <div class="geobrand-question-pool__section">
      平台通用题
      <span class="geobrand-question-pool__readonly-mark">平台通用题只读：由平台维护，本租户不可增删改</span>
    </div>
    <DataTable
      :data-source="platformQuestions"
      :loading="loading"
      :columns="platformColumns"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'coreWord'">{{ (record as GeoBrandQuestion).coreWord || PH_DASH }}</template>
        <template v-else-if="column.key === 'reviewState'">
          <StatusTag domain="geoReviewState" :status="(record as GeoBrandQuestion).reviewState" />
        </template>
      </template>
    </DataTable>
  </div>
</template>

<style scoped lang="less">
.geobrand-question-pool {
  margin-bottom: 24px;

  &__title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  &__section {
    margin-bottom: 8px;
    color: #595959;
    font-size: 12px;
  }

  &__readonly-mark {
    margin-left: 8px;
    color: #8c8c8c;
  }
}
</style>
