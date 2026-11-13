<template>
  <div class="portal-workbench">
    <!-- 「这里只维护内容」的口径已搬进引导机器人（SPEC-UI-11 R-9）：首访说一句，全文在页头问号里 -->
    <PageTitle>
      <template #extra>
        <a-space :size="8">
          <a-tooltip placement="left">
            <template #title>
              <p>缺图那一格：几条内容没配图，门户上摆图的位置就是空的。</p>
              <p>栏目本身开不开、叫什么名字、排在第几位，由平台侧决定（拍板 N2/N5），这里改不了，要改走「联系平台」。</p>
              <p>这一页按「最该补」排序，和访客导航里的栏目顺序不是一回事。</p>
            </template>
            <a-button class="portal-workbench__why"><InfoCircleOutlined /><span>口径说明</span></a-button>
          </a-tooltip>
          <a-button @click="router.push({ name: 'workspace-portal-support' })">联系平台</a-button>
        </a-space>
      </template>
    </PageTitle>

    <a-alert v-if="loadError" type="error" show-icon class="portal-workbench__error" :message="loadError" />

    <!--
      上线完成度带（Spec-Q §4.4 / Q7）：租户原来要进「门户上线」才能看到「还差什么才能上线」，
      而那一屏对租户只剩读、且后端那几个口是超管专用（进去只拿到一串 403）。
      这一条带用的判定与门户上线那一屏是同一份（useLaunchReadings + launchChecklist），
      两处不许各写一套「读不到算什么」。
    -->
    <div class="portal-workbench__launch" data-launch-band>
      <p class="portal-workbench__launch-head">
        <span class="portal-workbench__launch-label">上线自检</span>
        <b class="portal-workbench__launch-num" data-launch-progress>{{ launchProgressText }}</b>
        <span v-if="launchPendingText" class="portal-workbench__launch-gap" data-launch-pending>{{ launchPendingText }}</span>
        <span v-if="launchUnknownText" class="portal-workbench__launch-unknown" data-launch-unknown>{{ launchUnknownText }}</span>
        <a-button
          class="portal-workbench__launch-refresh"
          size="small"
          :loading="launchLoading" :disabled="launchLoading"
          data-launch-refresh
          @click="reloadLaunch"
        >重新读取</a-button>
      </p>
      <ul class="portal-workbench__launch-steps">
        <li
          v-for="(step, index) in launchSteps"
          :key="step.key"
          class="portal-workbench__launch-step"
          :data-launch-step="step.key"
        >
          <span class="portal-workbench__launch-index">{{ index + 1 }}</span>
          <span class="portal-workbench__launch-title">{{ step.title }}</span>
          <a-tag :color="launchLevelColor(step.level)" class="portal-workbench__launch-state">{{ step.stateText }}</a-tag>
          <template v-for="link in step.links" :key="link.label">
            <router-link v-if="link.to" :to="link.to" class="portal-workbench__launch-link">{{ link.label }}</router-link>
            <a v-else-if="link.href" :href="link.href" target="_blank" rel="noopener" class="portal-workbench__launch-link">{{ link.label }}</a>
            <span v-else class="portal-workbench__launch-link-plain">{{ link.label }}</span>
          </template>
        </li>
      </ul>
    </div>

    <!-- 首次加载摆三行骨架占位，而不是让整页空白转圈：这一页最多六行，跳一下比转圈更难看 -->
    <div v-if="loading && rows.length === 0" class="portal-workbench__skeletons">
      <div v-for="n in 3" :key="n" class="portal-workbench__skeleton" />
    </div>

    <template v-else-if="rows.length">
      <div class="portal-workbench__band">
        <div class="portal-workbench__cell">
          <span class="portal-workbench__cell-label">内容齐了的栏目</span>
          <b class="portal-workbench__cell-num">{{ readyText }}</b>
          <span class="portal-workbench__cell-note">{{ readyNote }}</span>
        </div>
        <div class="portal-workbench__cell">
          <span class="portal-workbench__cell-label">还差配图的条数</span>
          <b class="portal-workbench__cell-num" :class="{ 'portal-workbench__cell-num--warn': (imageGapTotal ?? 0) > 0 }">{{ imageGapText }}</b>
          <span class="portal-workbench__cell-note">{{ imageGapNote }}</span>
        </div>
        <div class="portal-workbench__cell">
          <span class="portal-workbench__cell-label">最该先补</span>
          <b class="portal-workbench__cell-name">{{ urgentName }}</b>
          <span class="portal-workbench__cell-note">{{ urgentNote }}</span>
        </div>
      </div>

      <div class="portal-workbench__rows">
        <div
          v-for="(row, index) in rows"
          :key="row.state.key"
          class="portal-workbench__row"
          :class="{ 'portal-workbench__row--unknown': !row.summary }"
          :style="{ '--row-color': rowColor(row), animationDelay: `${0.04 * index}s` }"
        >
          <div class="portal-workbench__main">
            <p class="portal-workbench__head">
              <span class="portal-workbench__badge"><component :is="entryIcon(row)" /></span>
              <span class="portal-workbench__name">{{ row.state.displayName }}</span>
              <a-tag v-if="row.summary?.completeness" :color="completenessColor(row)">{{ completenessLabel(row) }}</a-tag>
            </p>
            <p class="portal-workbench__meta">
              <span>{{ row.state.publicPath }}</span>
              <template v-if="row.state.navVisible">
                <span class="portal-workbench__dot">·</span>
                <span>导航第 {{ row.state.navSort }} 位</span>
              </template>
              <span class="portal-workbench__dot">·</span>
              <span>{{ landingText(row) }}</span>
            </p>
            <p class="portal-workbench__hint">{{ hintText(row) }}</p>
          </div>

          <div class="portal-workbench__count">
            <b>{{ countText(row) }}</b>
            <i v-if="showUnit(row)">条</i>
          </div>

          <div class="portal-workbench__acts">
            <a v-if="maintainRoute(row)" class="portal-workbench__maintain" @click="goMaintain(row)">去维护</a>
            <span v-if="maintainLabel(row)" class="portal-workbench__go">→ {{ maintainLabel(row) }}</span>
            <a :href="previewHref(row)" target="_blank" rel="noopener" class="portal-workbench__open">打开访客页</a>
          </div>
        </div>
      </div>
    </template>

    <!-- 「联系平台」只在页头摆一次：这一屏再摆一个同名按钮，等于让人确认两遍点的是不是同一个地方 -->
    <a-empty v-else-if="!loadError" description="还没有为这个站点开通任何栏目，可在页头的「联系平台」提工单">
      <template #image><span /></template>
    </a-empty>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  FileTextOutlined,
  IdcardOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { portalSectionsApi, type SectionState, type SectionSummary } from '../../api/portalSections'
import { portalPagesApi } from '../../api/portalPages'
import { useAuthStore } from '../../stores/auth'
import { collectMenuLeaves, findLeaf } from '../../navigation/workspaceMenu'
import PageTitle from '../../components/PageTitle.vue'
import { ROBOT_PAGE_CARDS } from '../../copy/robot'
import { useRobotNotices } from '../../composables/useRobotNotices'
import {
  CHECKLIST_LEVEL_COLOR,
  checklistNotMeasuredText,
  checklistPendingText,
  checklistProgress,
  checklistProgressText,
  type ChecklistLevel
} from '../../components/checklistPageModel'
import { useLaunchReadings } from '../onboarding/useLaunchReadings'

// 首访那一句与页头问号读的是 copy/robot.ts 里的同一张卡（SPEC-UI-11 R-9）
const robot = useRobotNotices()

/**
 * 租户「门户内容工作台」（Spec §7.1，2026-11-06 整页重做，方案见 docs/内容工作台页面重构_方案.md）。
 *
 * 这一页只回答三件事：齐了几块、最该补哪块、点哪里补。三条纪律没变：
 * 1. 行集合与所有中文（栏目名、档位话、状态词）都来自后端词表，前端不抄第二份（I-1）；
 * 2. 整页没有任何开关、发布、搭建入口（N1/N2），要改栏目只能走「联系平台」；
 * 3. 「没读到」和「没有」是两件事——统计未就绪的行不进概览带的分母、不演成 0（I-8 点名的假绿）。
 */

const router = useRouter()
const authStore = useAuthStore()

/** 读状态词表要的那一码：与这一页路由的 `portal:siteinfo:manage` 不是同一条线 */
const STATUS_LABELS_PERMISSION = 'portal:page:manage'

interface Row {
  state: SectionState;
  summary: SectionSummary | null;
}

const rows = ref<Row[]>([])
const statusLabels = ref<Record<string, string>>({})
const loading = ref(false)
const loadError = ref('')

/**
 * 上线自检那一条带（Spec-Q §4.4 / Q7）。
 *
 * 判定与取数全在 useLaunchReadings / launchChecklist 那一处，这一页只负责摆成一条带；
 * 传进去的那句「怎么重新读取」是这一页自己的按钮，因为这一屏页头没有「刷新」那颗——
 * 指一个这一页没有的按钮，比不指更容易把人带偏。
 */
const {
  loading: launchLoading,
  steps: launchSteps,
  reload: reloadLaunch
} = useLaunchReadings('点这一条右边的「重新读取」')

const launchProgress = computed(() => checklistProgress(launchSteps.value))
const launchProgressText = computed(() => checklistProgressText(launchProgress.value))
const launchPendingText = computed(() => checklistPendingText(launchProgress.value))
const launchUnknownText = computed(() => checklistNotMeasuredText(launchProgress.value))

function launchLevelColor(level: ChecklistLevel): string {
  return CHECKLIST_LEVEL_COLOR[level]
}

/** contentEntry → 维护这一栏目内容的页面。值是后端词表给的，不是我们自己数栏目 */
const MAINTAIN_ROUTES: Record<string, string> = {
  article: 'workspace-articles',
  case: 'workspace-case-list',
  job: 'workspace-portal-jobs',
  company: 'workspace-portal-company'
}

/** 「去维护」旁边那句去向，读的是左侧菜单自己那份名字（同一字符串，不再抄第二份） */
const menuLeaves = collectMenuLeaves(router.options.routes)

/** contentEntry → 行首图标。按内容类型给形，与中文无关，后端加一档时这里只多一个陌生 key（落到默认形） */
const ENTRY_ICONS: Record<string, Component> = {
  article: FileTextOutlined,
  case: PictureOutlined,
  job: IdcardOutlined,
  company: TeamOutlined
}

/**
 * 档位代码 → 排序权重与配色。这里只认代码：那两句中文照后端 `SectionCompleteness` 原样渲染。
 * 后端新加一档时这一映射落到「陌生档」那一组（排在已判完的之后、齐了的之前），
 * 界面上仍是后端那句话，不会把新档演成我们认识的某一句（I-1）。
 */
const URGENCY: Record<string, number> = {
  empty: 0,
  missingImage: 1,
  noCoverSlot: 2,
  complete: 3,
  notList: 4
}
const UNKNOWN_URGENCY = 2.5

const COMPLETENESS_COLORS: Record<string, string> = {
  complete: 'green',
  missingImage: 'orange',
  empty: 'red',
  noCoverSlot: 'blue',
  notList: 'default'
}

/** 行左边的色条：档位代码 → 一个色值，只用来上色，不承载文案 */
const ROW_COLORS: Record<string, string> = {
  empty: '#ef4444',
  missingImage: '#f59e0b',
  noCoverSlot: '#0ea5e9',
  complete: '#10b981',
  notList: '#cbd5e1'
}

function levelOf(row: Row): string {
  return row.summary?.completeness?.level ?? ''
}

function urgencyOf(row: Row): number {
  if (!row.summary) return UNKNOWN_URGENCY
  return URGENCY[levelOf(row)] ?? UNKNOWN_URGENCY
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const states = await portalSectionsApi.list()
    const open = states.filter(state => state.enabled)
    const summaries = await Promise.all(open.map(state =>
      portalSectionsApi.summary(state.key).catch(() => null)))
    rows.value = open
      .map((state, index) => ({ state, summary: summaries[index] }))
      .sort((a, b) => urgencyOf(a) - urgencyOf(b) || a.state.navSort - b.state.navSort)
  } catch (error: any) {
    loadError.value = error?.message || '栏目读取失败'
  } finally {
    loading.value = false
  }
  // 状态词表是另一码管的口（见 loadStatusLabels），它读不到只影响「栏目页」那一行的用词，
  // 不许把已经加载好的整页一起说成「读取失败」
  await loadStatusLabels()
}

/**
 * `/portal/pages/statuses` 挂 `portal:page:manage`，而这一页的路由只要 `portal:siteinfo:manage`——
 * 只有编辑码的账号（CONTENT_EDITOR）打过来必吃 403。所以先按码决定发不发：不发就没有控制台那条红字，
 * 「栏目页」那一行退化成露状态原码，而不是整页报「缺少权限」。
 */
async function loadStatusLabels() {
  if (!authStore.hasPermission(STATUS_LABELS_PERMISSION) || Object.keys(statusLabels.value).length > 0) {
    return
  }
  try {
    statusLabels.value = await portalPagesApi.statusLabels()
  } catch {
    // 留着空表：那一行露原码，不谎称读到过
  }
}

/** 统计回来的行才进概览带的账 */
const scoredRows = computed(() => rows.value.filter(row => row.summary))
const pendingRows = computed(() => rows.value.length - scoredRows.value.length)

const readyCount = computed(() =>
  scoredRows.value.filter(row => levelOf(row) === 'complete').length
)

const readyText = computed(() =>
  scoredRows.value.length ? `${readyCount.value} / ${scoredRows.value.length}` : '—'
)

const readyNote = computed(() => {
  if (!rows.value.length) return ''
  if (!scoredRows.value.length) return '统计还没回来'
  return pendingRows.value > 0 ? `另有 ${pendingRows.value} 栏统计未就绪` : `这一站开了 ${scoredRows.value.length} 个栏目`
})

/** 只有后端真给了 `missingImageCount` 的行才求和：null 是「这一类内容没有图位」，不是 0 */
const imageGapTotal = computed<number | null>(() => {
  const judged = scoredRows.value.filter(row => row.summary!.completeness.missingImageCount !== null)
  if (!judged.length) return null
  return judged.reduce((sum, row) => sum + (row.summary!.completeness.missingImageCount || 0), 0)
})

const imageGapText = computed(() => (imageGapTotal.value === null ? '—' : String(imageGapTotal.value)))

const imageGapNote = computed(() => {
  if (imageGapTotal.value === null) return '这一站的内容里没有判缺图的栏目'
  if (imageGapTotal.value === 0) return '没有内容缺配图'
  return pendingRows.value > 0 ? `统计未就绪的 ${pendingRows.value} 栏没算进来` : '门户上摆图的位置还空着'
})

const urgentRow = computed(() => (scoredRows.value.length ? scoredRows.value[0] : null))

const urgentName = computed(() => urgentRow.value?.state.displayName ?? '—')

const urgentNote = computed(() => {
  if (!urgentRow.value) {
    return scoredRows.value.length ? '' : '统计还没回来，说不了该补哪块'
  }
  return urgentRow.value.summary!.completeness.hint || ''
})

function rowColor(row: Row): string {
  return ROW_COLORS[levelOf(row)] || '#cbd5e1'
}

function entryIcon(row: Row) {
  return ENTRY_ICONS[row.state.contentEntry] ?? ApartmentOutlined
}

function countText(row: Row): string {
  if (!row.summary) {
    return '—'
  }
  // null 是「这一栏目不是列表」（关于我们/联系我们读标量），报 0 会被读成内容丢了
  return row.summary.contentCount === null ? '—' : String(row.summary.contentCount)
}

function showUnit(row: Row): boolean {
  return !!row.summary && row.summary.contentCount !== null
}

function completenessColor(row: Row): string {
  return COMPLETENESS_COLORS[levelOf(row)] || 'default'
}

function completenessLabel(row: Row): string {
  return row.summary?.completeness?.label ?? ''
}

/** 「统计没回来」与「统计说这一栏空着」是两件事，后者才有档位话 */
function hintText(row: Row): string {
  return row.summary?.completeness?.hint ?? '完整度统计未就绪'
}

function landingText(row: Row): string {
  const summary = row.summary
  if (!summary) {
    return '状态未知'
  }
  if (summary.landingPageStatus === null) {
    return '平台还没为这一栏目建页'
  }
  // 词表没读到（没有那一码，或那次读失败）就露状态原码并说清楚，不编一个中文
  const label = statusLabels.value[summary.landingPageStatus]
    || `${summary.landingPageStatus}（状态原码，中文词表未取到）`
  if (summary.landingPageId) {
    return `栏目页已发布：${summary.landingPageTitle || '未命名'}`
  }
  return `栏目页有但未发布（${label}）`
}

function maintainRoute(row: Row): string | undefined {
  return MAINTAIN_ROUTES[row.state.contentEntry]
}

/** 那句去向用的是菜单自己那份标签：改菜单名时这里跟着变，不会两处不一致 */
function maintainLabel(row: Row): string {
  const name = maintainRoute(row)
  if (!name) return ''
  return findLeaf(name, menuLeaves)?.label ?? ''
}

function goMaintain(row: Row) {
  const name = maintainRoute(row)
  if (name) {
    router.push({ name })
  }
}

function previewHref(row: Row): string {
  const url = row.summary?.previewUrl || row.state.publicPath
  return url.startsWith('http') ? url : `${window.location.origin}${url}`
}

onMounted(() => {
  // 这一页做什么与这一屏的数据无关，挂载说一句；同会话只说一次
  const card = ROBOT_PAGE_CARDS['page.portal-content.intro']
  robot.announce(
    { key: 'page.portal-content.intro', category: 'scope', text: card.text, detail: card.detail, once: 'session' },
    { ready: true }
  )
  load()
  // 两组读数各读各的口：上线自检那几发挂了不影响栏目行，栏目读失败也不影响这一条带
  reloadLaunch()
})
</script>

<style scoped lang="less">
.portal-workbench {
  --wb-radius: 12px;

  &__why {
    color: rgba(0, 0, 0, .45);
  }

  &__error {
    margin-bottom: var(--admin-space-2, 16px);
  }

  /**
   * 上线自检那一条带：一条读数 + 每步一小段（步骤名 · 后端那句话 · 去哪儿补）。
   * 这里不复用门户上线那一屏的 ChecklistPage——那一屏是一步一张卡的整页形状，
   * 这一页只需要一行读数带；两份共用的是 checklistPageModel 那几个算读数的函数与同一份步骤清单。
   */
  &__launch {
    background: #fff;
    border: 1px solid var(--admin-border-soft, #f0f0f0);
    border-radius: var(--wb-radius);
    padding: var(--admin-space-2, 16px) 20px;
    margin-bottom: var(--admin-space-2, 16px);
  }

  &__launch-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--admin-space-1, 8px);
    margin: 0;
  }

  &__launch-label {
    font-size: 12px;
    color: var(--admin-text-secondary, #8c8c8c);
  }

  &__launch-num {
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: var(--admin-font-nums, tabular-nums);
    color: var(--admin-text-primary, #1a1a1a);
  }

  &__launch-gap {
    font-size: 13px;
    color: var(--admin-text-primary, #1a1a1a);
  }

  &__launch-unknown {
    font-size: 13px;
    color: var(--admin-warning-text, #faad14);
  }

  &__launch-refresh {
    margin-left: auto;
  }

  &__launch-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px var(--admin-space-2, 16px);
    margin: var(--admin-space-1, 8px) 0 0;
    padding: 0;
    list-style: none;
  }

  &__launch-step {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--admin-text-primary, #1a1a1a);
  }

  &__launch-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--admin-fill-hover, #fafafa);
    color: var(--admin-text-secondary, #8c8c8c);
    font-size: 11px;
    font-variant-numeric: var(--admin-font-nums, tabular-nums);
  }

  &__launch-title {
    white-space: nowrap;
  }

  &__launch-state {
    margin-inline-end: 0;
  }

  &__launch-link {
    font-size: 12px;
  }

  &__launch-link-plain {
    font-size: 12px;
    color: var(--admin-text-secondary, #8c8c8c);
  }

  &__band {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--admin-space-2, 16px);
    margin-bottom: var(--admin-space-2, 16px);
  }

  &__cell {
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: var(--wb-radius);
    padding: var(--admin-space-2, 16px) 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__cell-label {
    font-size: 12px;
    color: rgba(0, 0, 0, .45);
  }

  &__cell-num {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    color: #1a1f36;

    &--warn {
      color: #f59e0b;
    }
  }

  &__cell-name {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.4;
    color: #1a1f36;
  }

  &__cell-note {
    font-size: 12px;
    color: rgba(0, 0, 0, .45);
  }

  &__rows {
    display: flex;
    flex-direction: column;
    gap: var(--admin-space-1, 8px);
  }

  &__row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 20px;
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: var(--wb-radius);
    padding: 14px 20px 14px 24px;
    overflow: hidden;
    animation: wbIn .45s ease both;
    transition: box-shadow .2s ease, transform .2s ease, border-color .2s ease;

    // 档位色条：整行唯一的强调，hover 时加粗
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: var(--row-color, #e2e8f0);
      transition: width .2s ease;
    }

    &:hover {
      transform: translateY(-2px);
      border-color: var(--row-color, #e2e8f0);
      box-shadow: 0 6px 18px rgba(15, 23, 42, .08);

      &::before {
        width: 6px;
      }
    }

    &--unknown {
      background: #fafbfc;
    }
  }

  &__main {
    min-width: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
  }

  &__badge {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 15px;
    background: var(--row-color, #6366f1);
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
    color: #1a1f36;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 6px 0 0;
    font-size: 12px;
    color: rgba(0, 0, 0, .45);
  }

  &__dot {
    color: rgba(0, 0, 0, .25);
  }

  &__hint {
    margin: 4px 0 0;
    font-size: 13px;
    color: rgba(0, 0, 0, .65);
  }

  &__count {
    text-align: right;
    width: 88px;
    flex: none;

    b {
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #1a1f36;
    }

    i {
      font-style: normal;
      font-size: 12px;
      font-weight: 400;
      color: rgba(0, 0, 0, .35);
      margin-left: 2px;
    }
  }

  &__acts {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex: none;
  }

  &__maintain {
    height: 32px;
    padding: 0 14px;
    border-radius: 6px;
    background: #1890ff;
    color: #fff;
    font-size: 14px;
    display: inline-flex;
    align-items: center;

    &:hover {
      background: #40a9ff;
      color: #fff;
    }
  }

  &__go {
    font-size: 12px;
    color: rgba(0, 0, 0, .45);
    white-space: nowrap;
  }

  &__open {
    font-size: 13px;
    color: #1890ff;

    &:hover {
      text-decoration: underline;
    }
  }

  &__skeletons {
    display: flex;
    flex-direction: column;
    gap: var(--admin-space-1, 8px);
  }

  &__skeleton {
    height: 84px;
    border-radius: var(--wb-radius);
    background: linear-gradient(90deg, #f2f4f7 25%, #e9edf2 37%, #f2f4f7 63%);
    background-size: 400% 100%;
    animation: wbShimmer 1.2s ease-in-out infinite;
  }
}

@keyframes wbIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes wbShimmer {
  from {
    background-position: 100% 50%;
  }
  to {
    background-position: 0 50%;
  }
}

@media (max-width: 1200px) {
  .portal-workbench__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .portal-workbench__acts {
    grid-column: 2;
    grid-row: 1;
  }

  .portal-workbench__count {
    grid-column: 1;
    grid-row: 2;
    text-align: left;
    width: auto;
  }
}

@media (max-width: 768px) {
  .portal-workbench__band {
    grid-template-columns: minmax(0, 1fr);
  }

  .portal-workbench__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .portal-workbench__acts,
  .portal-workbench__count {
    grid-column: 1;
    grid-row: auto;
    justify-content: flex-start;
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .portal-workbench__row,
  .portal-workbench__skeleton {
    animation: none;
  }

  .portal-workbench__row {
    transition: none;

    &:hover {
      transform: none;
    }
  }
}
</style>
