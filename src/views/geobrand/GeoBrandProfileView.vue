<script setup lang="ts">
/**
 * GEO 品牌档案 + 追踪题池管理页（Spec-F §11.2 P1，List 型骨架）。
 *
 * 分工：本页管「档案行 / 竞品组 / 两类题池」这三批数据；
 * 「跑一轮诊断」不在这里——那是向导（GeoBrandDiagnosisWizardView）与 P2 的计划动作。
 * 「最近提及率」这一列在 P1 一律显示 PH_NOT_MEASURED：没有 campaign run 就没有观测值，
 * 显示 0 或 '—' 都等于谎报（§9.6）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, notification } from 'ant-design-vue'
import PageShell from '../../components/PageShell.vue'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import DictTag from '../../components/DictTag.vue'
import StatusTag from '../../components/StatusTag.vue'
import MeasuredCount from './MeasuredCount.vue'
import ProfileForm from './ProfileForm.vue'
import BrandCompetitorPanel from './BrandCompetitorPanel.vue'
import BrandQuestionPanel from './BrandQuestionPanel.vue'
import { geoBrandApi, type GeoBrandProfile, type GeoBrandProfileForm } from '../../api/geoBrand'
import { describeHttpError } from '../../api/http'
import { siteApi } from '../../api/workspace'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'
import { brandTokens, emptyProfileForm, emptyQuestionDraft, questionViolation } from './geoBrandWizard'

const router = useRouter()

const sites = ref<Array<{ id: number; name: string }>>([])
const siteId = ref<number | null>(null)
const siteOptions = computed(() => sites.value.map((site) => ({ value: site.id, label: site.name })))

const profiles = ref<GeoBrandProfile[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const loading = ref(false)
const error = ref<string | null>(null)

/** 表单区：null = 不在编辑；'create' = 新建；否则是档案 id */
const editing = ref<'create' | number | null>(null)
const form = reactive<GeoBrandProfileForm>(emptyProfileForm())
const saving = ref(false)

/** 打开的档案区块（抽屉的替代：详情就地展开，菜单两级面包屑不受影响） */
const selectedId = ref<number | null>(null)
const selectedProfile = computed(() => profiles.value.find((item) => item.id === selectedId.value) ?? null)

const mentionDraft = reactive(emptyQuestionDraft())
const reputationDraft = reactive(emptyQuestionDraft())
const mentionPanel = ref<InstanceType<typeof BrandQuestionPanel> | null>(null)
const reputationPanel = ref<InstanceType<typeof BrandQuestionPanel> | null>(null)

const columns = computed(() => [
  { title: '品牌名', dataIndex: 'brandName', key: 'brandName', width: 180 },
  { title: '品牌词', dataIndex: 'brandWords', key: 'brandWords' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '最近提及率', key: 'mentionRate', width: 120 },
  { title: '操作', key: 'actions', width: 220 },
])

function emptyForm(): GeoBrandProfileForm {
  return emptyProfileForm()
}

async function loadProfiles() {
  loading.value = true
  error.value = null
  try {
    const data = await geoBrandApi.listProfiles({ siteId: siteId.value, page: page.value, size: size.value })
    profiles.value = data.records || []
    total.value = data.total || 0
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geobrand/品牌档案', e)
  } finally {
    loading.value = false
  }
}

async function loadSites() {
  try {
    const list = await siteApi.list()
    sites.value = (list || []).map((site: any) => ({ id: site.id, name: site.name }))
    siteId.value = sites.value[0]?.id ?? null
  } catch (e) {
    // 站点清单读不到不影响档案列表本身，页面留一句可查的错而不是白屏
    logError('geobrand/品牌档案', e)
  }
}

function onTableChange(pagination: { current?: number; pageSize?: number }) {
  page.value = pagination.current || 1
  size.value = pagination.pageSize || 20
  loadProfiles()
}

function startCreate() {
  editing.value = 'create'
  Object.assign(form, emptyForm(), { siteId: siteId.value })
}

function startEdit(profile: GeoBrandProfile) {
  editing.value = profile.id
  Object.assign(form, {
    siteId: profile.siteId,
    brandName: profile.brandName,
    brandWords: [...profile.brandWords],
    officialUrls: [...profile.officialUrls],
    brandIntro: profile.brandIntro,
  })
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
    const payload: GeoBrandProfileForm = { ...form, brandName: form.brandName.trim() }
    if (editing.value === 'create') {
      const created = await geoBrandApi.createProfile(payload)
      message.success('品牌档案已创建')
      selectedId.value = created.id
    } else if (typeof editing.value === 'number') {
      await geoBrandApi.updateProfile(editing.value, payload)
      message.success('品牌档案已保存')
    }
    editing.value = null
    await loadProfiles()
  } catch (e) {
    notification.error({ message: '保存品牌档案失败', description: describeHttpError(e) })
    logError('geobrand/品牌档案', e)
  } finally {
    saving.value = false
  }
}

async function removeProfile(profile: GeoBrandProfile) {
  try {
    await geoBrandApi.deleteProfile(profile.id)
    if (selectedId.value === profile.id) selectedId.value = null
    message.success('品牌档案已删除')
    await loadProfiles()
  } catch (e) {
    notification.error({ message: '删除品牌档案失败', description: describeHttpError(e) })
    logError('geobrand/品牌档案', e)
  }
}

function enterWizard(profile: GeoBrandProfile) {
  router.push({ name: 'workspace-geo-brand-wizard', query: { profileId: String(profile.id) } })
}

async function submitQuestion(kind: 'MENTION' | 'REPUTATION', draft: { coreWord: string; questionText: string }, panel?: InstanceType<typeof BrandQuestionPanel> | null) {
  if (!selectedProfile.value) return
  const violation = questionViolation(kind, draft.questionText, tokensOfSelected())
  if (violation) {
    // 红字警告已由 QuestionDraftRow 摆在题面旁边；这里只做「不许提交」的那一半
    return
  }
  try {
    await geoBrandApi.addQuestion(selectedProfile.value.id, {
      kind,
      coreWord: draft.coreWord.trim(),
      questionText: draft.questionText.trim(),
    })
    draft.coreWord = ''
    draft.questionText = ''
    message.success('题目已加入问题池')
    panel?.reload()
  } catch (e) {
    notification.error({ message: '加入问题池失败', description: describeHttpError(e) })
    logError('geobrand/品牌档案', e)
  }
}

function tokensOfSelected(): string[] {
  return brandTokens(selectedProfile.value)
}

onMounted(async () => {
  await loadSites()
  await loadProfiles()
})
</script>

<template>
  <PageShell
    title="GEO 品牌档案"
    subtitle="品牌是谁、跟谁比、问哪两类题——诊断向导的四步在这页都有对应的账"
  >
    <template #actions>
      <a-button type="primary" @click="startCreate">新建品牌档案</a-button>
    </template>

    <FilterBar>
      <a-select v-model:value="siteId" :options="siteOptions" placeholder="站点" style="width: 240px" @change="page = 1; loadProfiles()" />
      <template #actions>
        <a-button @click="loadProfiles">刷新</a-button>
      </template>
    </FilterBar>

    <div v-if="editing !== null" class="geobrand-profile-page__form">
      <h4 class="geobrand-profile-page__form-title">{{ editing === 'create' ? '新建品牌档案' : '编辑品牌档案' }}</h4>
      <ProfileForm :form="form" :site-options="siteOptions" :saving="saving" @save="saveProfile" @cancel="editing = null" />
    </div>

    <DataTable
      :data-source="profiles"
      :loading="loading"
      :error="error"
      :columns="columns"
      :pagination="{ current: page, pageSize: size, total }"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'brandWords'">
          <DictTag v-for="word in (record as GeoBrandProfile).brandWords" :key="word" kind="brand" :value="word" />
        </template>
        <template v-else-if="column.key === 'status'">
          <StatusTag domain="geoBrandStatus" :status="(record as GeoBrandProfile).status" />
        </template>
        <template v-else-if="column.key === 'mentionRate'">
          <!-- P1 没有 campaign run，这一列永远没测过：显示「未取到」，不许显示 0（§9.6） -->
          <MeasuredCount :value="null" />
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-button size="small" @click="selectedId = (record as GeoBrandProfile).id">
            {{ selectedId === (record as GeoBrandProfile).id ? '收起' : '详情' }}
          </a-button>
          <a-button size="small" @click="startEdit(record as GeoBrandProfile)">编辑</a-button>
          <a-popconfirm title="删除该档案？其竞品与题目一并停用" @confirm="removeProfile(record as GeoBrandProfile)">
            <a-button size="small" danger>删除</a-button>
          </a-popconfirm>
          <a-button size="small" type="link" @click="enterWizard(record as GeoBrandProfile)">进入向导</a-button>
        </template>
      </template>
    </DataTable>

    <section v-if="selectedProfile" class="geobrand-profile-page__detail">
      <h3 class="geobrand-profile-page__detail-title">{{ selectedProfile.brandName }} 的诊断素材</h3>
      <p class="geobrand-profile-page__detail-meta">
        官网：
        <span v-if="!selectedProfile.officialUrls?.length">{{ PH_DASH }}</span>
        <span v-for="url in selectedProfile.officialUrls" :key="url" class="geobrand-profile-page__url">{{ url }}</span>
      </p>
      <BrandCompetitorPanel :profile-id="selectedProfile.id" />
      <BrandQuestionPanel
        ref="mentionPanel"
        :profile-id="selectedProfile.id"
        kind="MENTION"
        :tokens="tokensOfSelected()"
        v-model:core-word="mentionDraft.coreWord"
        v-model:question-text="mentionDraft.questionText"
        @submit="submitQuestion('MENTION', mentionDraft, mentionPanel)"
      />
      <BrandQuestionPanel
        ref="reputationPanel"
        :profile-id="selectedProfile.id"
        kind="REPUTATION"
        :tokens="tokensOfSelected()"
        v-model:core-word="reputationDraft.coreWord"
        v-model:question-text="reputationDraft.questionText"
        @submit="submitQuestion('REPUTATION', reputationDraft, reputationPanel)"
      />
    </section>
  </PageShell>
</template>

<style scoped lang="less">
.geobrand-profile-page {
  &__form {
    margin-bottom: 24px;
    padding: 16px;
    border: 1px solid #f0f0f0;
    border-radius: var(--admin-radius-card, 12px);
  }

  &__form-title {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
  }

  &__detail {
    margin-top: 24px;
    padding: 16px;
    border: 1px solid #f0f0f0;
    border-radius: var(--admin-radius-card, 12px);
  }

  &__detail-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
  }

  &__detail-meta {
    margin: 0 0 16px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__url {
    margin-right: 8px;
  }
}
</style>
