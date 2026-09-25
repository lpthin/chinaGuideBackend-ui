<template>
  <div class="skeleton-library">
    <a-alert type="info" show-icon class="skeleton-library__notice">
      <template #message>
        骨架是站点的「出生证明」：一套骨架 = 一组页面 + 导航顺序 + 默认皮肤，
        存在平台数据里，<strong>不是写在代码里的清单</strong>。
        这里的预览用的是访客端同一套渲染器加演示数据，不落库；把骨架实例化到站点才会真的补页面。
      </template>
    </a-alert>

    <a-alert v-if="loadError" type="error" show-icon class="skeleton-library__notice" :message="loadError">
      <template #description>
        骨架库读不出来时这一页没有兜底清单（骨架 key 只有一处来源），点右侧刷新重试；
        如果提示的是权限，说明这个账号没有建设域的读口。
      </template>
    </a-alert>

    <a-form layout="inline" class="skeleton-library__toolbar">
      <a-form-item label="关键字">
        <a-input v-model:value="keyword" allow-clear placeholder="按骨架名称或 key 过滤" style="width: 220px" />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table
      :data-source="visibleSkeletons"
      :columns="columns"
      :loading="loading"
      row-key="skeletonKey"
      size="middle"
      :pagination="false"
      :scroll="{ x: 960 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div>{{ record.name }}</div>
          <span class="skeleton-library__muted">{{ record.skeletonKey }}</span>
        </template>
        <template v-else-if="column.key === 'pageCount'">
          {{ pageCountOf(record) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag>{{ statusText(record.status) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'preview'">
          <a-button size="small" :loading="pagesLoadingKey === record.skeletonKey" @click="togglePreview(record)">
            {{ previewKey === record.skeletonKey ? '收起逐页预览' : '逐页预览' }}
          </a-button>
        </template>
      </template>
    </a-table>

    <a-spin :spinning="pagesLoadingKey !== ''">
      <section v-if="previewSkeleton" class="skeleton-library__preview">
        <h3 class="skeleton-library__section-title">
          「{{ previewSkeleton.name }}」逐页预览（演示数据，不代表任何客户的站点）
        </h3>
        <a-alert v-if="pagesError" type="error" show-icon :message="pagesError" class="skeleton-library__page-alert" />
        <a-empty v-else-if="!previewPages.length"
                 description="这套骨架里一页都没有：去骨架库补页或换一套，空骨架不该被拿去建站">
          <template #image><span /></template>
        </a-empty>
        <a-card v-for="page in previewPages" :key="page.pageKey" size="small" class="skeleton-library__page">
          <template #title>
            <a-space size="6" wrap>
              <span>{{ page.title || page.slug || page.pageKey }}</span>
              <a-tag>{{ page.pageKey }}</a-tag>
              <a-tag v-if="page.pageType" color="blue">{{ page.pageType }}</a-tag>
              <a-tag v-if="!page.navVisible" color="default">不上导航</a-tag>
              <a-tag v-if="page.sectionKey" color="purple">栏目 {{ page.sectionKey }}</a-tag>
            </a-space>
          </template>
          <template #extra>
            <span class="skeleton-library__muted">导航顺序 {{ page.navSort }}</span>
          </template>

          <a-alert v-if="pageLayoutError(page)" type="error" show-icon :message="pageLayoutError(page)"
                   class="skeleton-library__page-alert" />
          <template v-else>
            <p v-if="skippedOf(page).length" class="skeleton-library__muted">
              这一页有 {{ skippedOf(page).length }} 个区块渲不出来（元数据里没有这个区块，或它的渲染器没登记）：
              {{ skippedOf(page).join('、') }}
            </p>
            <p v-if="bindingNote(page)" class="skeleton-library__muted">{{ bindingNote(page) }}</p>
            <PortalViewportPreview :blocks="renderedOf(page)" :theme="previewTheme" :shell="shell" />
          </template>
        </a-card>
      </section>
    </a-spin>

    <a-card size="small" title="应用到站点" class="skeleton-library__apply">
      <a-alert v-if="!canManage" type="warning" show-icon class="skeleton-library__notice"
               message="这个账号没有 portal:build:manage，能看骨架但不能补页面"
               description="按骨架建页会真的写 portal_page，属于建设域动作，找有权限的同事或在超管工作台执行。" />
      <template v-else>
        <a-form layout="inline">
          <a-form-item label="站点">
            <a-select v-model:value="siteId" style="width: 220px" :options="siteOptions"
                      placeholder="选一个要建站的站点" />
          </a-form-item>
          <a-form-item label="骨架">
            <a-select v-model:value="applyKey" style="width: 260px" :options="applyOptions"
                      placeholder="选一套有页可建的骨架" />
          </a-form-item>
          <a-form-item class="toolbar-actions">
            <a-space>
              <a-button :loading="planning" :disabled="!siteId || !applyKey" @click="planApply">
                先看新增计划（不写库）
              </a-button>
              <a-button type="primary" :loading="executing" :disabled="!canExecute" @click="executeApply">
                确认执行
              </a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <a-alert v-if="applyError" type="error" show-icon class="skeleton-library__notice" :message="applyError" />

        <a-alert v-if="!plan && !applyError" type="info" show-icon class="skeleton-library__notice"
                 message="确认执行之前必须先取一次计划"
                 description="后端把 dry-run 与执行分成两次请求：左边那个按钮只会回一份「哪些页会新建、哪些为什么跳过」，一行都不写；看完计划再点「确认执行」才会真的补页。已存在的页永远不动，换骨架不是改版。" />

        <template v-if="plan">
          <p class="skeleton-library__plan-title">
            站点「{{ siteNameOf(planSiteId) }}」按骨架「{{ planSkeletonName }}」v{{ planSkeletonVersion }}
            补页，共 {{ plan.items.length }} 页，其中会新建 {{ willCreateCount }} 页。
          </p>
          <a-table
            :data-source="plan.items"
            :columns="planColumns"
            row-key="pageKey"
            size="small"
            :pagination="false"
            :scroll="{ x: 900 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'willCreate'">
                <a-tag :color="record.willCreate ? 'green' : 'default'">
                  {{ record.willCreate ? '会新建' : '跳过' }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'reason'">
                {{ record.reason || '后端没给原因' }}
              </template>
            </template>
          </a-table>
          <a-space class="skeleton-library__confirm-row">
            <a-button type="primary" :loading="executing" :disabled="!canExecute" @click="executeApply">
              确认执行（新建 {{ willCreateCount }} 页）
            </a-button>
            <span class="skeleton-library__muted">执行后这一轮要重新取一次计划才允许再执行</span>
          </a-space>
        </template>

        <a-alert v-if="receipt" type="success" show-icon class="skeleton-library__receipt" :message="receiptText" />
      </template>
    </a-card>

    <!-- 参考站 → 骨架沉淀：洗出来的东西要能当场看到，才谈得上审 -->
    <a-card size="small" title="参考站 → 骨架沉淀" class="skeleton-library__distill">
      <a-alert v-if="!canPreset" type="warning" show-icon class="skeleton-library__notice"
               message="这个账号没有 portal:build:preset，沉淀与审核都做不了"
               description="沉淀会往平台骨架库里加一套新骨架，读口与写口挂的是同一个码；找有权限的同事在超管工作台执行。" />
      <template v-else>
        <a-form layout="inline">
          <a-form-item label="参考站任务 ID">
            <a-input v-model:value="distillTaskIdInput" style="width: 140px" placeholder="任务 ID" />
          </a-form-item>
          <a-form-item label="骨架 key">
            <a-input v-model:value="distillKey" style="width: 200px" placeholder="可空，后端按任务号兜一个" />
          </a-form-item>
          <a-form-item label="名称">
            <a-input v-model:value="distillName" style="width: 180px" placeholder="可空" />
          </a-form-item>
          <a-form-item label="说明">
            <a-input v-model:value="distillDescription" style="width: 220px" placeholder="可空" />
          </a-form-item>
          <a-form-item class="toolbar-actions">
            <a-space>
              <a-button :loading="distilling" :disabled="referenceTaskId === null" @click="runDistill">
                洗成待审骨架
              </a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <a-alert v-if="distillError" type="error" show-icon class="skeleton-library__notice" :message="distillError"
                 description="原因来自后端那一发请求（任务没摄到位、key 撞了、一页都带不进来），这里不替它换一种说法。任务 ID 在「参考站摄取」那页的列表里。" />

        <a-alert v-else-if="!distillReceipt" type="info" show-icon class="skeleton-library__notice"
                 message="这一发只会多出一套待审骨架，不会发布"
                 description="只有人工确认过的映射才带得进来，客户文案与指向客户站点的链接由后端洗掉；洗掉了什么、哪几页没带进来，见下面这块证据，看完再去下面的待审清单点发布。" />

        <div v-if="distillReceipt" class="skeleton-library__evidence">
          <p class="skeleton-library__evidence-title">
            刚洗出来的是「{{ distillReceipt.name || distillReceipt.skeletonKey }}」
            （key {{ distillReceipt.skeletonKey }}）：{{ distillReceipt.pageCount }} 页 /
            {{ distillReceipt.blockCount }} 块。
          </p>
          <p class="skeleton-library__evidence-sub">
            洗掉的客户内容 {{ distillReceipt.stripped.length }} 处
            {{ distillReceipt.stripped.length ? '（后端逐条写的，原样列出）：' : '：后端一条都没报，也就是它没说自己洗过什么。' }}
          </p>
          <ul v-if="distillReceipt.stripped.length" class="skeleton-library__evidence-list">
            <li v-for="(line, index) in distillReceipt.stripped" :key="`stripped-${index}`">{{ line }}</li>
          </ul>
          <p class="skeleton-library__evidence-sub">
            没带进来的页 {{ distillReceipt.skippedPages.length }} 条
            {{ distillReceipt.skippedPages.length ? '（连原因一起）：' : '：后端没报跳过的页。' }}
          </p>
          <ul v-if="distillReceipt.skippedPages.length" class="skeleton-library__evidence-list">
            <li v-for="(line, index) in distillReceipt.skippedPages" :key="`skipped-${index}`">{{ line }}</li>
          </ul>
        </div>
      </template>
    </a-card>

    <!-- 待审的沉淀骨架：发布/退役都是写动作，各要一次当场确认 -->
    <a-card size="small" title="待审核的沉淀骨架" class="skeleton-library__pending">
      <a-alert v-if="!canPreset" type="warning" show-icon class="skeleton-library__notice"
               message="没有 preset 权限，这份待审清单取不到" />
      <template v-else>
        <a-alert v-if="pendingError" type="error" show-icon class="skeleton-library__notice" :message="pendingError"
                 description="清单没取到就是没取到：这里不拿骨架库那份列表凑一份「看起来一样」的待审名单，也不许在这一格点发布。" />
        <template v-else>
          <a-spin :spinning="pendingLoading">
            <p v-if="!pendingSkeletons.length" class="skeleton-library__muted">
              现在没有待审的沉淀骨架。沉淀一套要去上面那格填参考站任务 ID。
            </p>
            <div v-for="row in pendingSkeletons" :key="row.skeletonKey" class="skeleton-library__pending-row">
              <a-space size="6" wrap>
                <strong>{{ row.name }}</strong>
                <span class="skeleton-library__muted">{{ row.skeletonKey }}</span>
                <a-tag>{{ statusText(row.status) }}</a-tag>
                <a-tag color="blue">v{{ row.version }}</a-tag>
                <a-tag>{{ pageCountOf(row) }} 页</a-tag>
                <a-tag v-if="row.origin">{{ row.origin }}</a-tag>
              </a-space>
              <p class="skeleton-library__muted">{{ row.description || '这套骨架没写说明' }}</p>
              <a-space size="6">
                <template v-if="confirming?.skeletonKey === row.skeletonKey">
                  <span class="skeleton-library__confirm-tip">{{ confirmingPrompt }}</span>
                  <a-button size="small" type="primary" :loading="reviewing" @click="confirmReview(row)">
                    {{ confirmingLabel }}
                  </a-button>
                  <a-button size="small" :disabled="reviewing" @click="cancelReview">取消</a-button>
                </template>
                <template v-else>
                  <a-button size="small" type="primary" :disabled="reviewing" @click="askReview(row, 'publish')">
                    发布
                  </a-button>
                  <a-button size="small" :disabled="reviewing" @click="askReview(row, 'retire')">退役</a-button>
                </template>
              </a-space>
            </div>
            <a-alert v-if="reviewReceipt" type="success" show-icon class="skeleton-library__notice"
                     :message="reviewReceiptText" />
            <a-alert v-if="reviewError" type="error" show-icon class="skeleton-library__notice" :message="reviewError" />
          </a-spin>
        </template>
      </template>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { portalPagesApi, type PortalBlockMeta } from '../../api/portalPages'
import {
  portalSkeletonsApi,
  type DistilledSkeleton,
  type SkeletonApplyResult,
  type SkeletonPage,
  type SkeletonRecord,
  type SkeletonView
} from '../../api/portalSkeletons'
import { siteApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import {
  blockMetaMap,
  demoShell,
  parseLayoutBlocks,
  parseTheme,
  resolveDemoBlocks
} from '../../portal/blocks/blockDemo'
import type { RenderedBlock } from '../../portal/api/portalPublic'
import type { SkeletonPlanItem } from '../../api/portalSkeletons'
import PortalViewportPreview from '../../portal/blocks/PortalViewportPreview.vue'

/**
 * 骨架库（Spec §7.2 / §5.2，Q2）。
 *
 * 三条要紧的：
 * 1. 骨架清单、页数、状态中文名一个都不在前端写死——列表来自 `/admin/portal/skeletons`，
 *    状态说法来自 `/admin/portal/skeletons/statuses`（后端那份词表是唯一的，N3/I-1）；
 * 2. 逐页预览读 `/admin/portal/skeletons/{key}/pages`，layout 里的 `{"$data":...}` 用本地演示数据
 *    提供器解析后交给<strong>真渲染器</strong>，所以看到的结构和访客端是同一种东西，但一行库都不碰；
 * 3. 「应用到站点」是两步：先 dry-run 出计划表（含后端给的中文跳过原因），页面上再有一次明确的
 *    「确认执行」才发 confirm=true。选完站点或换完骨架计划会作废重取，避免拿着旧计划确认到新组合上。
 *
 * 沉淀与审核这一半（Spec §6.4）守着另外三条：
 * 4. 「待审」这件事只有 `/admin/portal/skeletons/pending` 说了算，前端一处状态字符串都不比对；
 * 5. 沉淀的回执（洗掉了什么、哪几页没带进来）原样列出来给人看证据，不归纳成「已清洗」三个字；
 * 6. 发布与退役各要一次当场确认，点了第一颗只把这一行的问题摆出来，第二颗才发那一发请求，
 *    发完也不会自动接一步（发布之后再退役仍然是另一次确认）。
 */

const columns = [
  { title: '骨架', dataIndex: 'name', key: 'name' },
  { title: '说明', dataIndex: 'description', key: 'description' },
  { title: '来路', dataIndex: 'origin', key: 'origin' },
  { title: '版本', dataIndex: 'version', key: 'version' },
  { title: '页数', key: 'pageCount' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '预览', key: 'preview' }
]

const planColumns = [
  { title: '页面 key', dataIndex: 'pageKey', key: 'pageKey' },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '地址', dataIndex: 'slug', key: 'slug' },
  { title: '页型', dataIndex: 'pageType', key: 'pageType' },
  { title: '导航顺序', dataIndex: 'navSort', key: 'navSort' },
  { title: '结果', dataIndex: 'willCreate', key: 'willCreate' },
  { title: '原因（后端原文）', dataIndex: 'reason', key: 'reason' }
]

const auth = useAuthStore()
const skeletons = ref<SkeletonView[]>([])
const statusLabels = ref<Record<string, string>>({})
const metas = ref<PortalBlockMeta[]>([])
const sites = ref<Array<{ id: number; name: string }>>([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')

const previewKey = ref('')
const previewPages = ref<SkeletonPage[]>([])
const pagesLoadingKey = ref('')
const pagesError = ref('')

const siteId = ref<number | null>(null)
const applyKey = ref<string | undefined>(undefined)
const planning = ref(false)
const executing = ref(false)
const applyError = ref('')
const plan = ref<{
  items: SkeletonPlanItem[]
  siteId: number
  skeletonKey: string
  skeletonName: string | null
  skeletonVersion: number
} | null>(null)
const receipt = ref<SkeletonApplyResult | null>(null)

const shell = demoShell()

const canManage = computed(() => auth.hasPermission('portal:build:manage'))

/** 沉淀与审核（读待审清单、发布、退役）在后端挂的是同一个码，界面按它决定给不给这两格 */
const canPreset = computed(() => auth.hasPermission('portal:build:preset'))

const visibleSkeletons = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  if (!needle) {
    return skeletons.value
  }
  return skeletons.value.filter(item => [item.name, item.skeletonKey, item.description]
    .some(field => String(field || '').toLowerCase().includes(needle)))
})

const previewSkeleton = computed(() => skeletons.value.find(item => item.skeletonKey === previewKey.value) || null)

const previewTheme = computed(() => parseTheme(previewSkeleton.value?.tokensJson))

const metaMap = computed<Map<string, PortalBlockMeta>>(() => blockMetaMap(metas.value))

const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

/** 下拉里只出「有页可建」的骨架：空骨架点下去只会得到一个「补齐 0 页」的成功，那不如不给这个选项 */
const applyOptions = computed(() => skeletons.value
  .filter(item => pageCountOf(item) > 0)
  .map(item => ({ value: item.skeletonKey, label: `${item.name}（${pageCountOf(item)} 页）` })))

const willCreateCount = computed(() => (plan.value?.items || []).filter(item => item.willCreate).length)

const planSkeletonName = computed(() => plan.value?.skeletonName || applyKey.value || '')
const planSkeletonVersion = computed(() => plan.value?.skeletonVersion ?? 0)
const planSiteId = computed(() => plan.value?.siteId ?? null)

/** 计划必须和当前选中的（站点, 骨架）一对得上才允许点「确认执行」；取计划或执行在途时一律不许再点 */
const canExecute = computed(() => {
  const current = plan.value
  return !!current && !planning.value && !executing.value
    && current.siteId === siteId.value && current.skeletonKey === applyKey.value
})

const receiptText = computed(() => {
  const done = receipt.value
  if (!done) {
    return ''
  }
  return `骨架「${done.skeletonName || done.skeletonKey}」v${done.skeletonVersion} 已执行：本站新建 ${done.created} 个页面。`
    + '已有的页面一行都没动（换骨架不是改版）；新页面是什么状态、访客能不能看到，以「页面搭建」里显示为准，'
    + '这一页不替后端猜它把新页标成了什么。'
})

function pageCountOf(skeleton: SkeletonView): number {
  // 页数自己按 pages.length 算：后端那个 pageCount 不是 record 分量，不保证序列化出来
  return skeleton.pages?.length ?? 0
}

function statusText(status: string): string {
  return statusLabels.value[status] || status
}

function siteNameOf(id: number | null): string {
  return sites.value.find(site => site.id === id)?.name || `站点 ${id ?? '未选'}`
}

function blocksOf(page: SkeletonPage) {
  return parseLayoutBlocks(page.layoutJson)
}

function pageLayoutError(page: SkeletonPage): string {
  return blocksOf(page) === null
    ? `这一页（${page.pageKey}）的结构不是合法 JSON，预览停止：骨架种子坏了要在后端修数据，这里不猜内容`
    : ''
}

function renderedOf(page: SkeletonPage): RenderedBlock[] {
  const blocks = blocksOf(page)
  if (!blocks) {
    return []
  }
  return resolveDemoBlocks(blocks, metaMap.value).blocks
}

function skippedOf(page: SkeletonPage): string[] {
  const blocks = blocksOf(page)
  if (!blocks) {
    return []
  }
  return resolveDemoBlocks(blocks, metaMap.value).skipped
}

/** 把「这一页哪些槽位是演示数据」说清楚：绑定的槽位在预览里全是演示值，正式内容要租户自己填 */
function bindingNote(page: SkeletonPage): string {
  const blocks = blocksOf(page) || []
  const bound = blocks.reduce((total, block) => total + Object.values(block.props || {})
    .filter(value => !!value && typeof value === 'object' && '$data' in value).length, 0)
  return bound ? `这一页有 ${bound} 个内容槽绑定门户数据，预览里显示的是演示值。` : ''
}

async function togglePreview(skeleton: SkeletonView) {
  if (previewKey.value === skeleton.skeletonKey) {
    previewKey.value = ''
    previewPages.value = []
    pagesError.value = ''
    return
  }
  previewKey.value = skeleton.skeletonKey
  previewPages.value = []
  pagesError.value = ''
  pagesLoadingKey.value = skeleton.skeletonKey
  try {
    previewPages.value = (await portalSkeletonsApi.pages(skeleton.skeletonKey)) || []
  } catch (error: any) {
    pagesError.value = error?.message || '骨架页清单读取失败'
  } finally {
    pagesLoadingKey.value = ''
  }
}

/** 换站点或换骨架：旧计划立刻作废，确认执行不能作用在一份对不上的计划上 */
function invalidate() {
  plan.value = null
  receipt.value = null
  applyError.value = ''
}

// 监听这两个值而不是挂 @change：清空、键盘选值、代码里改值都算变了，一条都漏不掉
watch([siteId, applyKey], invalidate)

async function planApply() {
  if (!siteId.value || !applyKey.value || planning.value || executing.value) {
    applyError.value = '先选一个站点和一套骨架'
    return
  }
  const { siteId: plannedSite, skeletonKey: plannedKey } = { siteId: siteId.value, skeletonKey: applyKey.value }
  planning.value = true
  applyError.value = ''
  receipt.value = null
  plan.value = null
  try {
    const result = await portalSkeletonsApi.apply(plannedSite, plannedKey, false)
    plan.value = {
      items: result.items || [],
      siteId: plannedSite,
      skeletonKey: plannedKey,
      skeletonName: result.skeletonName,
      skeletonVersion: result.skeletonVersion
    }
  } catch (error: any) {
    plan.value = null
    applyError.value = error?.message || '取计划失败'
  } finally {
    planning.value = false
  }
}

async function executeApply() {
  const current = plan.value
  // 只认 canExecute：计划还挂在实例上、但这一轮已经在跑（或计划已对不上）时，第二次点必须原地弹开
  if (!current || !canExecute.value) {
    return
  }
  executing.value = true
  applyError.value = ''
  try {
    const result = await portalSkeletonsApi.apply(current.siteId, current.skeletonKey, true)
    receipt.value = result
    plan.value = null
    message.success(`已新建 ${result.created} 个页面`)
  } catch (error: any) {
    applyError.value = error?.message || '骨架执行失败'
  } finally {
    executing.value = false
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [list, labels, blocks, siteList] = await Promise.all([
      portalSkeletonsApi.list(),
      portalSkeletonsApi.statusLabels(),
      // 区块元数据：把 layout 里的 blockKey 换成 rendererKey、按 dataSchema 解析演示绑定都靠它
      portalPagesApi.blocks(),
      siteApi.list()
    ])
    skeletons.value = list || []
    statusLabels.value = labels || {}
    metas.value = blocks || []
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
  } catch (error: any) {
    loadError.value = error?.message || '骨架库加载失败'
  } finally {
    loading.value = false
  }
}

/**
 * 参考站 → 骨架沉淀（Spec §6.4）。
 *
 * 任务 ID 是一个数字而不是一份任务下拉：这里要引的那一句「任务摄到哪一步了」属于参考站那个域的
 * 状态词表，抄一份到这一页就会漂移；所以让调用方把 ID 填进来，够不够格沉淀由后端判、由它说原因。
 */
const distillTaskIdInput = ref('')
const distillKey = ref('')
const distillName = ref('')
const distillDescription = ref('')
const distilling = ref(false)
const distillError = ref('')
const distillReceipt = ref<DistilledSkeleton | null>(null)

/** 只认「一串数字」：空着、带字母、负数都不给点，免得拿一个明显不存在的 ID 去撞后端 */
const referenceTaskId = computed(() => {
  const raw = distillTaskIdInput.value.trim()
  if (!/^\d+$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return id > 0 ? id : null
})

async function runDistill() {
  const referenceId = referenceTaskId.value
  if (referenceId === null || distilling.value) {
    return
  }
  distilling.value = true
  distillError.value = ''
  distillReceipt.value = null
  try {
    distillReceipt.value = await portalSkeletonsApi.distill(referenceId, {
      skeletonKey: distillKey.value.trim() || null,
      name: distillName.value.trim() || null,
      description: distillDescription.value.trim() || null
    })
    await Promise.all([load(), loadPending()])
  } catch (error: any) {
    distillError.value = error?.message || '沉淀失败'
  } finally {
    distilling.value = false
  }
}

/** 待审清单与审核动作 */
const pendingSkeletons = ref<SkeletonView[]>([])
const pendingLoading = ref(false)
const pendingError = ref('')
const confirming = ref<{ skeletonKey: string; action: 'publish' | 'retire' } | null>(null)
const reviewing = ref(false)
const reviewError = ref('')
const reviewReceipt = ref<SkeletonRecord | null>(null)

const confirmingLabel = computed(() => {
  const target = confirming.value
  if (!target) {
    return ''
  }
  return target.action === 'publish' ? '确认发布这一套' : '确认退役这一套'
})

/** 第二颗按钮上那句话就是这一步的后果：说清它改的是「新站点选不选得到」，不是删数据 */
const confirmingPrompt = computed(() => {
  const target = confirming.value
  if (!target) {
    return ''
  }
  return target.action === 'publish'
    ? '发布之后新站点才选得到这一套，后端还会把每一页与皮肤重校验一遍。再点一次才真的发这一发。'
    : '退役只让新站点选不到它，已经按它建出来的页面一行都不动。再点一次才真的发这一发。'
})

const reviewReceiptText = computed(() => {
  const row = reviewReceipt.value
  if (!row) {
    return ''
  }
  // 状态读的是后端回来的那一行，不是「刚才点了哪颗按钮」
  const status = row.status ? `现在回的状态是「${statusText(row.status)}」` : '这一发后端没把状态带回来'
  const approver = row.approvedBy ? `，审核人 ${row.approvedBy}` : ''
  return `骨架「${row.name || row.skeletonKey}」${status}${approver}。清单与上面的骨架库列表都按接口重取过一遍。`
})

async function loadPending() {
  // 没权限就不去撞那一发：这一格自己会写「取不到」，不需要一个 403 来告诉用户
  if (!canPreset.value) {
    return
  }
  pendingLoading.value = true
  pendingError.value = ''
  try {
    pendingSkeletons.value = (await portalSkeletonsApi.pending()) || []
  } catch (error: any) {
    pendingSkeletons.value = []
    pendingError.value = error?.message || '待审骨架清单加载失败'
  } finally {
    pendingLoading.value = false
  }
}

/** 第一颗按钮只把「要发布/要退役的是这一套」问出来，一次请求都不发 */
function askReview(skeleton: SkeletonView, action: 'publish' | 'retire') {
  if (reviewing.value) {
    return
  }
  reviewError.value = ''
  confirming.value = { skeletonKey: skeleton.skeletonKey, action }
}

function cancelReview() {
  confirming.value = null
}

async function confirmReview(skeleton: SkeletonView) {
  const target = confirming.value
  // 确认框对着的必须还是这一行这一件事：换行确认、重复点都在这一步弹开
  if (!target || target.skeletonKey !== skeleton.skeletonKey || reviewing.value) {
    return
  }
  reviewing.value = true
  reviewError.value = ''
  try {
    const record = target.action === 'publish'
      ? await portalSkeletonsApi.publish(skeleton.skeletonKey)
      : await portalSkeletonsApi.retire(skeleton.skeletonKey)
    reviewReceipt.value = record
    confirming.value = null
    await Promise.all([load(), loadPending()])
  } catch (error: any) {
    reviewError.value = error?.message || '审核这一发没成'
  } finally {
    reviewing.value = false
  }
}

onMounted(async () => {
  await Promise.all([load(), loadPending()])
})
</script>

<style lang="less">
// 与访客端同一套区块样式：预览框里的版式必须和真站点一致，否则「看着像」是假的
@import '../../styles/portal-tokens.less';
@import '../../portal/blocks/portal-blocks.less';
</style>

<style scoped lang="less">
.skeleton-library {
  padding: 16px;

  &__notice {
    margin-bottom: 12px;
  }

  &__toolbar {
    margin-bottom: 12px;
  }

  &__preview {
    margin-top: 16px;
  }

  &__section-title {
    font-size: 15px;
    margin: 0 0 12px;
  }

  &__page {
    margin-bottom: 12px;
  }

  &__page-alert {
    margin-bottom: 12px;
  }

  &__apply {
    margin-top: 16px;
  }

  &__plan-title {
    margin: 12px 0;
    font-weight: 600;
  }

  &__confirm-row {
    margin-top: 12px;
  }

  &__receipt {
    margin-top: 12px;
  }

  &__distill {
    margin-top: 16px;
  }

  &__pending {
    margin-top: 12px;
  }

  &__evidence {
    margin-top: 12px;
    padding: 12px;
    background: #fafafa;
  }

  &__evidence-title {
    margin: 0 0 8px;
    font-weight: 600;
  }

  &__evidence-sub {
    margin: 8px 0 4px;
  }

  &__evidence-list {
    margin: 0 0 8px;
    padding-left: 20px;
    color: rgba(0, 0, 0, 0.65);
  }

  &__pending-row {
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
  }

  &__confirm-tip {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }
}
</style>
