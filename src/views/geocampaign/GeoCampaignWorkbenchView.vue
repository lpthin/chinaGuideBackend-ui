<script setup lang="ts">
/**
 * GEO 诊断工作台（Spec-F §10-1，P2）。
 *
 * 这一页只回答三个问题：这个档案有没有计划、最近几轮跑成什么样、下一轮去哪儿开。
 * 两件事它刻意不做：
 * - <b>没有总分格</b>：GEO 总分在 P0 就已经下线（那一格今天的真话是「这里没有观测值可显示」），
 *   P2 有了观测值也不合并成一个数（§5 禁令 1）——要看率就去看分平台那几行；
 * - <b>不在这里起跑</b>：起跑的按钮在第⑤步的预估面板上，它前面必须先看过价（§6.2 两段式）。
 *   这一页的「跑新一轮」是跳转，不是执行。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { notification } from 'ant-design-vue'
import PageShell from '../../components/PageShell.vue'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import StateBlock from '../../components/StateBlock.vue'
import StatusTag from '../../components/StatusTag.vue'
import MeasuredCount from '../geobrand/MeasuredCount.vue'
import { geoCampaignApi, geoRunIsInFlight, type GeoCampaign, type GeoVocabulary } from '../../api/geoCampaign'
import { geoBrandApi, type GeoBrandProfile } from '../../api/geoBrand'
import { siteApi } from '../../api/workspace'
import { describeHttpError } from '../../api/http'
import { logError } from '../../utils/errorLog'
import { PH_DASH } from '../../utils/display'
import { campaignRunSummary, judgeCostText, runPhaseText, runPercent } from './geoCampaignModel'

const router = useRouter()

const sites = ref<Array<{ id: number; name: string }>>([])
const siteId = ref<number | null>(null)
const profiles = ref<GeoBrandProfile[]>([])
const profileId = ref<number | null>(null)
const vocabulary = ref<GeoVocabulary | null>(null)

const campaigns = ref<GeoCampaign[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const loading = ref(false)
const error = ref<string | null>(null)

const siteOptions = computed(() => sites.value.map((site) => ({ value: site.id, label: site.name })))
const profileOptions = computed(() => profiles.value.map((profile) => ({ value: profile.id, label: profile.brandName })))
const selectedProfile = computed(() => profiles.value.find((item) => item.id === profileId.value) ?? null)

/** 最近 3 轮：每个计划只报它自己那一条最近的，界面上说清是哪一轮（§9.6 不拿局部当整体） */
const recentRuns = computed(() =>
  campaigns.value
    .filter((campaign) => campaign.latestRun)
    .map((campaign) => ({ campaign, run: campaign.latestRun as NonNullable<GeoCampaign['latestRun']> }))
    .sort((a, b) => b.run.id - a.run.id)
    .slice(0, 3),
)

const columns = computed(() => [
  { title: '计划', dataIndex: 'name', key: 'name', width: 200 },
  { title: '这一轮问什么', key: 'shape', width: 220 },
  { title: '确认态', dataIndex: 'confirmState', key: 'confirmState', width: 100 },
  { title: '最近一轮', key: 'latestRun' },
  { title: '操作', key: 'actions', width: 200 },
])

function statusLabel(status: string | null | undefined): string {
  if (!status) return PH_DASH
  return vocabulary.value?.runStatuses?.[status] || status
}

async function loadSites() {
  try {
    const list = await siteApi.list()
    sites.value = (list || []).map((site: any) => ({ id: site.id, name: site.name }))
    siteId.value = sites.value[0]?.id ?? null
  } catch (e) {
    logError('geocampaign/工作台', e)
  }
}

async function loadProfiles() {
  if (!siteId.value) {
    profiles.value = []
    profileId.value = null
    return
  }
  try {
    const data = await geoBrandApi.listProfiles({ siteId: siteId.value, page: 1, size: 100 })
    profiles.value = data.records || []
    profileId.value = profiles.value[0]?.id ?? null
  } catch (e) {
    notification.error({ message: '品牌档案清单读取失败', description: describeHttpError(e) })
    logError('geocampaign/工作台', e)
  }
}

async function loadCampaigns() {
  if (!profileId.value) {
    campaigns.value = []
    total.value = 0
    return
  }
  loading.value = true
  error.value = null
  try {
    const data = await geoCampaignApi.listCampaigns({ brandProfileId: profileId.value, page: page.value, size: size.value })
    campaigns.value = data.records || []
    total.value = data.total || 0
  } catch (e) {
    error.value = describeHttpError(e)
    logError('geocampaign/工作台', e)
  } finally {
    loading.value = false
  }
}

function onTableChange(pagination: { current?: number; pageSize?: number }) {
  page.value = pagination.current || 1
  size.value = pagination.pageSize || 20
  loadCampaigns()
}

/** 「跑新一轮」= 去第⑤步看价，不是在这儿直接起跑（两段式的第二段必须有预估在前） */
function goRunNew(campaignId?: number) {
  router.push({
    name: 'workspace-geo-brand-wizard',
    query: { profileId: String(profileId.value), step: 'platform', ...(campaignId ? { campaignId: String(campaignId) } : {}) },
  })
}

function goReport(runId: number) {
  router.push({ name: 'workspace-geo-campaign-report', params: { runId: String(runId) } })
}

function goWizard() {
  router.push({ name: 'workspace-geo-brand-wizard', query: profileId.value ? { profileId: String(profileId.value) } : {} })
}

watch([siteId], async () => {
  await loadProfiles()
  page.value = 1
  await loadCampaigns()
})
watch(profileId, async () => {
  page.value = 1
  await loadCampaigns()
})

onMounted(async () => {
  try {
    vocabulary.value = await geoCampaignApi.vocabulary()
  } catch (e) {
    // 词表读不到只是标签变回原样字符串，账还是那一本账，不值得拦整页
    logError('geocampaign/词表', e)
  }
  await loadSites()
  await loadProfiles()
  await loadCampaigns()
})
</script>

<template>
  <PageShell
    title="GEO 诊断工作台"
    subtitle="一个品牌一轮一轮地问：这里看计划与最近几轮的账，跑新一轮去向导第⑤步看价"
  >
    <template #actions>
      <a-button type="primary" @click="goWizard()">进入诊断向导</a-button>
    </template>

    <StateBlock
      v-if="!profiles.length"
      state="empty"
      title="这一步还没有品牌档案，所以也没有诊断计划"
      detail="诊断问的是「AI 怎么看你这一家」，它需要知道你是谁：品牌名、品牌词、跟谁比、问哪两类题。"
      next="按下面的按钮进向导，第①步存好档案就能往下走"
    >
      <a-button type="primary" @click="goWizard()">从第①步开始</a-button>
    </StateBlock>

    <template v-else>
      <FilterBar>
        <a-select v-model:value="siteId" :options="siteOptions" placeholder="站点" style="width: 220px" />
        <a-select v-model:value="profileId" :options="profileOptions" placeholder="品牌档案" style="width: 200px" />
        <template #actions>
          <a-button @click="loadCampaigns">刷新</a-button>
        </template>
      </FilterBar>

      <section v-if="recentRuns.length" class="geo-workbench__recent">
        <h4 class="geo-workbench__recent-title">最近 3 轮（各计划的最新一轮）</h4>
        <div class="geo-workbench__recent-cards">
          <div v-for="item in recentRuns" :key="item.run.id" class="geo-workbench__recent-card">
            <div class="geo-workbench__recent-head">
              <StatusTag domain="geoRun" :status="item.run.status" :label="statusLabel(item.run.status)" />
              <StatusTag domain="geoJudgeState" :status="item.run.judgeState" :label="item.run.judgeStateLabel" />
              <span class="geo-workbench__recent-name">{{ item.campaign.name }} · 轮次 {{ item.run.id }}</span>
            </div>
            <p class="geo-workbench__recent-meta">
              {{ item.run.questionCount ?? PH_DASH }} 题 × {{ item.run.platformCount ?? PH_DASH }} 平台 ×
              {{ item.run.repeatTimes ?? PH_DASH }} 次 · 取到 <MeasuredCount :value="item.run.callCount" /> 次 ·
              未取到 <MeasuredCount :value="item.run.failedCallCount" /> 次 · {{ runPhaseText(item.run) }}
            </p>
            <p class="geo-workbench__recent-meta">{{ judgeCostText(item.run) }}</p>
            <p v-if="item.run.stageText" class="geo-workbench__recent-stage">{{ item.run.stageText }}</p>
            <a-progress v-if="geoRunIsInFlight(item.run.status)" :percent="runPercent(item.run)" size="small" />
            <p v-if="item.run.stalledReason" class="geo-workbench__recent-stalled">{{ item.run.stalledReason }}</p>
            <p v-if="item.run.judgeStalledReason" class="geo-workbench__recent-stalled">
              {{ item.run.judgeStalledReason }}
            </p>
            <p v-if="item.run.errorMessage" class="geo-workbench__recent-error">{{ item.run.errorMessage }}</p>
            <p v-if="item.run.judgeErrorMessage" class="geo-workbench__recent-error">
              {{ item.run.judgeErrorMessage }}
            </p>
            <a-button
              v-if="item.run.status === 'SUCCEEDED' || item.run.status === 'PARTIAL'"
              size="small"
              type="link"
              @click="goReport(item.run.id)"
            >看报告</a-button>
          </div>
        </div>
      </section>

      <DataTable
        :data-source="campaigns"
        :loading="loading"
        :error="error"
        :columns="columns"
        :pagination="{ current: page, pageSize: size, total }"
        row-key="id"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'shape'">
            <span class="geo-workbench__shape">
              {{ (record as GeoCampaign).questionCount }} 题 × {{ (record as GeoCampaign).platformCount }} 平台 ×
              {{ (record as GeoCampaign).repeatTimes }} 次
              <span class="geo-workbench__shape-estimate">
                预估提问 {{ (record as GeoCampaign).costEstimateCalls }} 次 /
                {{ (record as GeoCampaign).costEstimateTokens }} token（判定另算，进第⑤步看两段）
              </span>
            </span>
          </template>
          <template v-else-if="column.key === 'confirmState'">
            <StatusTag
              domain="geoConfirmState"
              :status="(record as GeoCampaign).confirmState"
              :label="(record as GeoCampaign).confirmStateLabel"
            />
          </template>
          <template v-else-if="column.key === 'latestRun'">
            <span class="geo-workbench__run">{{ campaignRunSummary(record as GeoCampaign) }}</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-button size="small" @click="goRunNew((record as GeoCampaign).id)">跑新一轮</a-button>
            <a-button
              v-if="(record as GeoCampaign).latestRun"
              size="small"
              type="link"
              @click="goReport((record as GeoCampaign).latestRun!.id)"
            >最近一轮报告</a-button>
          </template>
        </template>
      </DataTable>

      <p class="geo-workbench__note">
        这里没有「GEO 总分」那一格：多个模型的答案加权成一个数，就是把三种脾气压成一个假答案。
        要看的是分平台的提及率与覆盖率，它们在每一轮报告里，每个数旁边都带着自己的分母。
      </p>
    </template>
  </PageShell>
</template>

<style scoped lang="less">
.geo-workbench {
  &__recent {
    margin-bottom: 20px;
  }

  &__recent-title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  &__recent-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  &__recent-card {
    padding: 12px;
    border: 1px solid #f0f0f0;
    border-radius: var(--admin-radius-card, 12px);
  }

  &__recent-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__recent-name {
    font-size: 13px;
    font-weight: 600;
  }

  &__recent-meta,
  &__recent-stage {
    margin: 8px 0 0;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__recent-error {
    margin: 8px 0 0;
    color: #ff4d4f;
    font-size: 12px;
  }

  // 「停着不动」是警告不是失败：状态词一个字没改（#108），这里只补那句出路
  &__recent-stalled {
    margin: 8px 0 0;
    color: #d46b08;
    font-size: 12px;
  }

  &__shape {
    font-size: 13px;
  }

  &__shape-estimate {
    display: block;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__run {
    font-size: 12px;
    color: #595959;
  }

  &__note {
    margin: 16px 0 0;
    color: #8c8c8c;
    font-size: 12px;
  }
}
</style>
