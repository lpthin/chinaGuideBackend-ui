<template>
  <div class="portal-workbench-page">
    <a-form layout="inline" class="portal-workbench-page__filter">
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
          <a-button @click="router.push({ name: 'workspace-portal-support' })">联系平台</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon class="portal-workbench-page__notice">
      <template #message>
        一张卡对应平台为你们开通的一个栏目。这里只维护内容：卡片上的数字是访客在门户上能看到的条数，
        「完整度」那一格说的是这些内容还差什么（比如几条没配图，门户上那一格就是空的）；
        栏目本身开不开、叫什么名字、排在第几位，由平台侧决定（拍板 N2/N5）。
      </template>
    </a-alert>

    <a-alert v-if="loadError" type="error" show-icon class="portal-workbench-page__notice" :message="loadError" />

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !loadError && cards.length === 0"
               description="还没有为这个站点开通任何栏目，可在「联系平台」提工单">
        <template #image><span /></template>
      </a-empty>
      <div class="portal-workbench-page__grid">
        <a-card v-for="card in cards" :key="card.state.key" size="small" class="portal-workbench-page__card">
          <template #title>
            <a-space>
              <span>{{ card.state.displayName }}</span>
              <a-tag v-if="card.summary?.completeness" :color="completenessColor(card)">
                {{ completenessLabel(card) }}
              </a-tag>
            </a-space>
          </template>
          <a-descriptions :column="1" size="small" class="portal-workbench-page__desc">
            <a-descriptions-item label="门户可见内容">
              <span class="portal-workbench-page__count">{{ countText(card) }}</span>
              <span v-if="card.summary?.contentCount" class="portal-workbench-page__muted">条</span>
            </a-descriptions-item>
            <a-descriptions-item label="内容完整度">
              <span :class="{ 'portal-workbench-page__muted': !card.summary?.completeness }">
                {{ completenessHint(card) }}
              </span>
            </a-descriptions-item>
            <a-descriptions-item label="访客地址">
              <a :href="previewHref(card)" target="_blank" rel="noopener">{{ card.state.publicPath }}</a>
            </a-descriptions-item>
            <a-descriptions-item label="栏目页">
              <span :class="{ 'portal-workbench-page__muted': !card.summary?.landingPageId }">
                {{ landingText(card) }}
              </span>
            </a-descriptions-item>
          </a-descriptions>
          <template #actions>
            <a @click="goMaintain(card)">
              <a-space size="4"><EditOutlined /><span>去维护</span></a-space>
            </a>
          </template>
        </a-card>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { EditOutlined } from '@ant-design/icons-vue'
import { portalSectionsApi, type SectionState, type SectionSummary } from '../../api/portalSections'
import { portalPagesApi } from '../../api/portalPages'

/**
 * 租户「门户内容工作台」（Spec §7.1）。
 *
 * 三件事是刻意的：
 * 1. 卡片列表完全来自 `GET /api/portal/sections`——栏目名、顺序、对外地址一个都不在这份文件里，
 *    平台改了显示名，这里下一次打开就是新字（I-1）；
 * 2. 整页没有任何开关、搭建按钮或跳转进搭建器的入口（N1/N2）。要改栏目只能提工单，
 *    右上角那个「联系平台」就是唯一的出口；
 * 3. 「栏目页」那一行报的是落地页的<strong>状态</strong>，状态中文名取自 `/portal/pages/statuses`，
 *    这样「有一页但是草稿」与「压根没有页」在界面上分得开——租户看到「0 条」时该点的是维护，
 *    看到「未发布」时该提的是工单。
 *
 * 问题十加的那一半：「内容完整度」那一行（连卡上那个标签）说的是后端 `SectionCompleteness`
 * 数出来的话——缺几条图、这一类内容压根没有图位，都由后端说，这里只按档位代码配色。
 * 页面上不写第二份中文：前端一抄，后端加一档就是「界面安静地少一句话」那种事故（I-1），
 * 而「没有图位」被前端演成「内容完整」更是 I-8 点名的假绿。
 */

const router = useRouter()

interface Card {
  state: SectionState;
  summary: SectionSummary | null;
}

const cards = ref<Card[]>([])
const statusLabels = ref<Record<string, string>>({})
const loading = ref(false)
const loadError = ref('')

/** contentEntry → 维护这一栏目内容的页面。值是后端词表给的，不是我们自己数栏目 */
const MAINTAIN_ROUTES: Record<string, string> = {
  article: 'workspace-articles',
  case: 'workspace-case-list',
  job: 'workspace-portal-jobs',
  company: 'workspace-portal-company'
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const states = await portalSectionsApi.list()
    const open = states.filter(state => state.enabled)
    const summaries = await Promise.all(open.map(state =>
      portalSectionsApi.summary(state.key).catch(() => null)))
    cards.value = open.map((state, index) => ({ state, summary: summaries[index] }))
    if (Object.keys(statusLabels.value).length === 0) {
      statusLabels.value = await portalPagesApi.statusLabels()
    }
  } catch (error: any) {
    loadError.value = error?.message || '栏目读取失败'
  } finally {
    loading.value = false
  }
}

function countText(card: Card): string {
  if (!card.summary) {
    return '统计未就绪'
  }
  // null 是「这一栏目不是列表」（关于我们/联系我们读标量），报 0 会被读成内容丢了
  return card.summary.contentCount === null ? '—' : String(card.summary.contentCount)
}

/**
 * 档位代码 → 颜色。这里只认代码：那两句中文（`label` / `hint`）照后端 `SectionCompleteness`
 * 原样渲染，前端不写第二份（I-1）。「这一类内容没有图位」也不能被这映射演成绿色——
 * 后端就不给那一档发「完整」的说法。
 */
const COMPLETENESS_COLORS: Record<string, string> = {
  complete: 'green',
  missingImage: 'orange',
  empty: 'red',
  noCoverSlot: 'blue',
  notList: 'default'
}

function completenessColor(card: Card): string {
  return COMPLETENESS_COLORS[card.summary?.completeness?.level ?? ''] || 'default'
}

function completenessLabel(card: Card): string {
  return card.summary?.completeness?.label ?? ''
}

/** 「统计没回来」与「统计说这一栏空着」是两件事，后者才有档位词 */
function completenessHint(card: Card): string {
  return card.summary?.completeness?.hint ?? '完整度统计未就绪'
}

function landingText(card: Card): string {
  const summary = card.summary
  if (!summary) {
    return '状态未知'
  }
  if (summary.landingPageStatus === null) {
    return '平台还没为这一栏目建页'
  }
  const label = statusLabels.value[summary.landingPageStatus] || summary.landingPageStatus
  if (summary.landingPageId) {
    return `已发布${summary.landingPageTitle ? '：' + summary.landingPageTitle : ''}`
  }
  return `有页面但未发布（${label}）`
}

function goMaintain(card: Card) {
  const name = MAINTAIN_ROUTES[card.state.contentEntry]
  if (name) {
    router.push({ name })
  }
}

function previewHref(card: Card): string {
  const url = card.summary?.previewUrl || card.state.publicPath
  return url.startsWith('http') ? url : `${window.location.origin}${url}`
}

onMounted(load)
</script>

<style scoped lang="less">
.portal-workbench-page {
  &__filter {
    margin-bottom: 12px;
  }

  &__notice {
    margin-bottom: 16px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  &__count {
    font-size: 20px;
    font-weight: 600;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
  }
}
</style>
