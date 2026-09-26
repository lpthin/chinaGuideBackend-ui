<template>
  <div class="section-admin-page">
    <a-form layout="inline" class="section-admin-page__filter">
      <a-form-item label="站点">
        <a-select v-model:value="siteId" style="width: 220px" :options="siteOptions" @change="load" />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon class="section-admin-page__notice">
      <template #message>
        这里只翻栏目的开关、显示名与导航顺序。<strong>关掉栏目不等于把页面下线</strong>：
        栏目关掉后，导航不再出现这一项、访客页面上绑这一数据源的区块不再渲染、巡检也不再催这一栏，
        但页面本身与里面的内容一条都不动（N5：骨架与栏目归超管，内容归租户）。
        租户侧读到的是同一份开通态，全程只读。
        <br />
        每张卡改的都是草稿：<strong>顶上那条导航预览不点保存也是这个样子</strong>，
        但库里要等下面那一条「保存到站点」——一次点它只发一条整批请求，
        后端要么全写、要么一条都不写。
      </template>
    </a-alert>

    <a-alert v-if="loadError" type="error" show-icon class="section-admin-page__notice" :message="loadError" />
    <a-alert v-if="saveError" type="error" show-icon class="section-admin-page__notice">
      <template #message>
        这一批没写进去（后端原话：{{ saveError }}）。
        整批是原子的，所以库里仍是保存前那一份，下面卡片上的草稿也还在，改了名字没丢。
      </template>
    </a-alert>

    <!-- 导航实时预览：动的就是页头那一排栏目名，草稿一改这里立刻跟着变。
         为什么不复用 SiteHeaderBlock：那个是访客端的页头，要吃 shell 与真栏目接口才能拼出地址与折叠态，
         这一条只要「人现在起的名字排在第几个」，套上来只会把没开通的东西也渲一遍（那是假预览）。 -->
    <div class="section-admin-page__nav">
      <span class="section-admin-page__nav-label">顶部导航预览</span>
      <template v-if="navPreview.length">
        <span v-for="row in navPreview" :key="row.key" class="section-admin-page__nav-item">
          {{ drafts[row.key].displayName || row.displayName }}
        </span>
      </template>
      <span v-else class="section-admin-page__nav-empty">
        导航上一个栏目都没有：访客看到的顶部导航就是空的。
      </span>
    </div>

    <div class="section-admin-page__toolbar">
      <a-space wrap>
        <a-button type="primary" :disabled="!dirtyCount" :loading="saving" @click="saveAll">
          保存到站点{{ dirtyCount ? `（${dirtyCount} 处改动）` : '' }}
        </a-button>
        <a-button :disabled="!dirtyCount" @click="resetAll">全部还原</a-button>
        <span v-if="!dirtyCount" class="section-admin-page__muted">
          草稿和库里一模一样，没有可保存的改动——这一句是状态，不是按钮坏了。
        </span>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <div class="section-admin-page__grid">
        <a-card v-for="(record, position) in orderedRows" :key="record.key" size="small"
                class="section-card" :class="{ 'section-card--off': !draft(record.key).enabled }">
          <template #title>
            <span class="section-card__title">
              {{ draft(record.key).displayName || record.displayName }}
              <a-tag v-if="dirty(record.key)" color="orange">未保存</a-tag>
              <a-tag v-if="!draft(record.key).enabled">已关掉</a-tag>
            </span>
          </template>

          <a-descriptions :column="1" size="small" class="section-card__meta">
            <a-descriptions-item label="对外地址">
              <a :href="record.publicPath" target="_blank" rel="noopener">{{ record.publicPath }}</a>
            </a-descriptions-item>
            <a-descriptions-item label="内容入口">{{ record.contentEntry }}</a-descriptions-item>
          </a-descriptions>

          <div class="section-card__row">
            <span class="section-card__field-label">中文名</span>
            <a-input v-model:value="draft(record.key).displayName" :placeholder="record.displayName"
                     style="width: 160px" />
          </div>
          <div class="section-card__row">
            <span class="section-card__field-label">开通</span>
            <a-switch :checked="draft(record.key).enabled"
                      @change="(v: boolean) => onEnabledChange(record.key, v)" />
          </div>
          <div class="section-card__row">
            <span class="section-card__field-label">进顶部导航</span>
            <!-- 栏目关掉时这一颗置灰：栏目都关了还谈导航可见性是假选项，两个开关的数据仍分开落库 -->
            <a-switch :checked="draft(record.key).navVisible" :disabled="!draft(record.key).enabled"
                      @change="(v: boolean) => draft(record.key).navVisible = v" />
          </div>
          <div class="section-card__row">
            <span class="section-card__field-label">导航顺序</span>
            <!-- 这里原来是一个 a-input-number：那个框要人先记住全场有几个 10、几个 20 才敢改数，
                 而超管真正想表达的只有「这一栏挪到邻栏前面/后面」。换成上下两个按钮，动的还是同一个
                 navSort 字段。也不用拖拽：那要多引一个依赖，而栏目一共六七张卡，点两下的成本比装一套 dnd 低。
                 改成整批保存之后换序顺带不再有两半：一次点「保存到站点」发的是全部栏目。 -->
            <a-space :size="4">
              <a-button size="small" :disabled="!canMove(record.key, -1)" @click="move(record.key, -1)">↑</a-button>
              <a-button size="small" :disabled="!canMove(record.key, 1)" @click="move(record.key, 1)">↓</a-button>
              <span class="section-card__sort">{{ draft(record.key).navSort }}</span>
            </a-space>
          </div>
          <div class="section-card__row">
            <span class="section-card__field-label">落地页</span>
            <a-tag v-if="record.landingPageId" color="green">有已发布页</a-tag>
            <a-tag v-else color="orange">没有落地页</a-tag>
          </div>

          <div class="section-card__preview">
            <a-button size="small" :disabled="!record.landingPageId" :loading="previewLoading === record.key"
                      @click="togglePreview(record)">
              {{ isOpen(record.key) ? '收起示例页' : '看示例页' }}
            </a-button>
            <span v-if="!record.landingPageId" class="section-card__preview-hint">
              这一栏还没有落地页：示例缩略要有真页面才渲得出来，这里不拿别的页凑一张。
            </span>
            <p v-else-if="previewErrors[record.key]" class="section-card__preview-hint">
              示例页没读到（后端原话：{{ previewErrors[record.key] }}）。
            </p>
            <!-- 渲染框就是访客端/搭建器共用的那一个，所以这里看到的结构和客户将来看到的同一种东西；
                 宽度靠 CSS 收成缩略，不放设备切换按钮：那三颗在这里点了也不会真换断点（假控件） -->
            <PortalViewportPreview v-if="isOpen(record.key) && previews[record.key]"
                                   :blocks="previews[record.key]?.blocks ?? null"
                                   :theme="previews[record.key]?.theme ?? null" />
          </div>
        </a-card>
      </div>
    </a-spin>

    <SectionAdviceCard v-if="adviceBriefId !== null" class="section-admin-page__advice" mode="apply"
                       :brief-id="adviceBriefId" :site-id="siteId" :local-edits-pending="dirtyCount > 0"
                       @apply="applyAdvice" />
    <p v-else class="section-admin-page__muted section-admin-page__advice-hint">
      这一页没有挂建议卡：栏目建议是按需求单出的，从需求单详情点进来（地址上带 briefId）才会看到那一张。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { portalSectionsApi, type SectionAdviceItem, type SectionBulkItem, type SectionState } from '../../api/portalSections'
import { portalPagesApi, type PreviewPage } from '../../api/portalPages'
import { siteApi } from '../../api/workspace'
import PortalViewportPreview from '../../portal/blocks/PortalViewportPreview.vue'
import SectionAdviceCard from './SectionAdviceCard.vue'

/**
 * 超管栏目卡片页（Spec §5.2 / §7.2 + Spec-D D4，N5：栏目归超管）。
 *
 * 客户原话是「栏目选择这一块太丑了 ui」，超管原话是「改栏目要点六次保存」，这一版就是冲这两条：
 * 1. 一张卡一个栏目，卡里放示例页缩略（渲染框沿用访客端那一个 PortalViewportPreview），
 *    顶上另有一条导航实时预览——草稿一改就看到，不用先把改动落库再刷新；
 * 2. 保存只有<strong>一条</strong>整批请求（`PUT .../sections/bulk`），后端整批原子，
 *    回的是改完后的全量生效态，界面直接拿它覆盖本地，不自己数「改了几条」；
 * 3. 卡片集合、显示名占位、对外地址、内容入口全来自 `GET /api/admin/sites/{id}/sections`，
 *    这一页没有第二份栏目清单（I-1）；
 * 4. 「进顶部导航」在栏目关掉时置灰——那是个假选项；但数据仍分两栏落库，
 *    关栏目时界面顺手把导航也收掉，免得库里留着「关着却上导航」那种要靠人记住的状态；
 * 5. 导航顺序是上下按钮，按一次换的是<strong>看得见的邻位</strong>：卡片顺序就按草稿的 navSort 排，
 *    所以点完按钮的位置变化和顶上那条预览同时看得见。
 */

const route = useRoute()

interface Draft {
  displayName: string;
  enabled: boolean;
  navVisible: boolean;
  navSort: number;
}

const sites = ref<Array<{ id: number; name: string }>>([])
const siteId = ref<number | null>(null)
const rows = ref<SectionState[]>([])
const drafts = reactive<Record<string, Draft>>({})
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
/** 建议卡只在这页从需求单详情跳进来（地址带 briefId）时出现：建议本来就是按需求单出的 */
const adviceBriefId = computed<number | null>(() => {
  const raw = route.query.briefId
  const text = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(text)
  return text && Number.isFinite(parsed) && parsed > 0 ? parsed : null
})

const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

/**
 * 卡片顺序 = 当前草稿的导航顺序（稳定排序：同值仍按接口回的那份词表序，
 * 后端 `SectionAccess.states` 本来就是按词表声明序回的）。
 *
 * <p>为什么界面得先按 navSort 排一遍：上下按钮的语义是「和看得见的那个邻位换」，
 * 而接口回的行序是词表序、和 navSort 不保证一致——不排的话点「↑」换到的可能是屏幕外那张卡，
 * 数字变了、卡却没动，等于让人对着看不见的东西操作。</p>
 */
const orderedRows = computed<SectionState[]>(() =>
  [...rows.value].sort((left, right) => sortOf(left.key) - sortOf(right.key))
)

/** 顶部那条预览：进导航的那几张卡、按当前草稿的名字与顺序排 */
const navPreview = computed<SectionState[]>(() =>
  orderedRows.value.filter(row => draft(row.key)?.enabled && draft(row.key)?.navVisible)
)

const dirtyCount = computed(() => rows.value.filter(row => dirty(row.key)).length)

function sortOf(key: string): number {
  return drafts[key]?.navSort ?? 0
}

/** 这张卡在导航里有没有邻位（头一张的「↑」、末一张的「↓」）：不给一颗点了没反应的按钮 */
function canMove(key: string, delta: number): boolean {
  const index = orderedRows.value.findIndex(row => row.key === key)
  const target = index + delta
  return index >= 0 && target >= 0 && target < orderedRows.value.length
}

/** 与看得见的那个邻位交换导航顺序：两张卡的草稿同时改，一次整批保存就把这一对写干净 */
function move(key: string, delta: number) {
  const list = orderedRows.value
  const index = list.findIndex(row => row.key === key)
  const target = index + delta
  if (index < 0 || target < 0 || target >= list.length) {
    return
  }
  const mine = draft(key)
  const neighbour = draft(list[target].key)
  if (!mine || !neighbour) {
    return
  }
  if (mine.navSort === neighbour.navSort) {
    // 同值是旧数字框留下的历史数据（两个栏目可以都填 3）：换值换不出任何差别，
    // 那就把这一格挪到邻位的上一名/下一名，让按钮在任何数据上都有看得见的反应
    mine.navSort = neighbour.navSort + delta
    return
  }
  const swap = mine.navSort
  mine.navSort = neighbour.navSort
  neighbour.navSort = swap
}

function draft(key: string): Draft {
  return drafts[key]
}

function dirty(key: string): boolean {
  const current = draft(key)
  const saved = rows.value.find(row => row.key === key)
  if (!current || !saved) {
    return false
  }
  return current.displayName !== saved.displayName
    || current.enabled !== saved.enabled
    || current.navVisible !== saved.navVisible
    || current.navSort !== saved.navSort
}

function onEnabledChange(key: string, enabled: boolean) {
  draft(key).enabled = enabled
  // 关掉栏目时把导航一起收掉：留着 nav_visible=1 会让「四处一致」变成一句要靠人记住的话
  if (!enabled) {
    draft(key).navVisible = false
  }
}

/** 后端回的全量生效态是唯一的一份真相：界面只覆盖，不自己拼「哪几条改了」 */
function applyStates(states: SectionState[]) {
  rows.value = states
  states.forEach(state => {
    drafts[state.key] = {
      displayName: state.displayName,
      enabled: state.enabled,
      navVisible: state.navVisible,
      navSort: state.navSort
    }
  })
  Object.keys(drafts).forEach(key => {
    if (!states.some(state => state.key === key)) {
      delete drafts[key]
    }
  })
  // 落地页可能已经换过：缩略那份缓存不作数了，下次点开重取
  Object.keys(previews).forEach(key => delete previews[key])
  Object.keys(open).forEach(key => delete open[key])
}

async function load() {
  if (siteId.value === null) {
    return
  }
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  try {
    applyStates(await portalSectionsApi.adminList(siteId.value))
  } catch (error: any) {
    loadError.value = error?.message || '栏目读取失败'
  } finally {
    loading.value = false
  }
}

async function saveAll() {
  if (siteId.value === null || !dirtyCount.value) {
    return
  }
  // 整批发的是全部栏目，不只发脏的那几张：换序本来就是两张卡一起动，少发一张就会留下一对相同的
  // navSort；后端整批原子，多发的栏目只是把同样的值再写一遍，代价比留一个半截状态小
  const items: SectionBulkItem[] = orderedRows.value.map(record => ({
    key: record.key,
    displayName: draft(record.key).displayName,
    enabled: draft(record.key).enabled,
    navVisible: draft(record.key).navVisible,
    navSort: draft(record.key).navSort
  }))
  const changed = dirtyCount.value
  saving.value = true
  saveError.value = ''
  try {
    const states = await portalSectionsApi.adminBulkUpdate(siteId.value, items)
    applyStates(states)
    message.success(`已保存到站点（${changed} 处改动）`)
  } catch (error: any) {
    // 后端那句中文原因就是「为什么一条都没写」（key 不认识/重复等），原样挂出来，不转成「保存失败」
    saveError.value = error?.message || '栏目保存失败'
  } finally {
    saving.value = false
  }
}

function resetAll() {
  rows.value.forEach(row => {
    drafts[row.key] = {
      displayName: row.displayName,
      enabled: row.enabled,
      navVisible: row.navVisible,
      navSort: row.navSort
    }
  })
}

/**
 * 采纳 = 把建议搬进草稿，写库那一下仍然是上面那条「保存到站点」（拍板 N2）。
 * 对不上这一页的 key 一个都不新建：栏目词表住在后端，界面不认识的东西就该说它不认识。
 */
function applyAdvice(items: SectionAdviceItem[]) {
  const unknown: string[] = []
  items.forEach(item => {
    const target = drafts[item.sectionKey]
    if (!target) {
      unknown.push(item.label || item.sectionKey)
      return
    }
    target.displayName = item.label
    target.enabled = item.enabled
    target.navVisible = item.enabled ? item.navVisible : false
    target.navSort = item.navSort
  })
  if (unknown.length) {
    saveError.value = `这几条建议对不上这一页的栏目，没有搬进来：${unknown.join('、')}。`
      + '词表住在后端那一份里，界面不替它凭空补一张卡。'
  } else {
    message.success('建议已填进草稿：点「保存到站点」才会写库')
  }
}

/* ---------------- 示例页缩略：点开那张卡才取那一页，六张卡不该在进页面时发六发请求 ---------------- */

const previews = reactive<Record<string, PreviewPage | null>>({})
const open = reactive<Record<string, boolean>>({})
const previewErrors = reactive<Record<string, string>>({})
const previewLoading = ref('')

function isOpen(key: string): boolean {
  return !!open[key]
}

async function togglePreview(record: SectionState) {
  const key = record.key
  open[key] = !open[key]
  if (!open[key] || previews[key] || !record.landingPageId) {
    return
  }
  previewLoading.value = key
  previewErrors[key] = ''
  try {
    previews[key] = await portalPagesApi.preview(record.landingPageId)
  } catch (error: any) {
    previewErrors[key] = error?.message || '示例页读取失败'
    open[key] = false
  } finally {
    previewLoading.value = ''
  }
}

onMounted(async () => {
  try {
    const siteList = await siteApi.list()
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
    siteId.value = sites.value.length > 0 ? sites.value[0].id : null
  } catch {
    // 站点列表拿不到就先空着，让「刷新」按钮保留一次重试的机会
  }
  await load()
})
</script>

<style scoped lang="less">
.section-admin-page {
  &__filter {
    margin-bottom: 12px;
  }

  &__notice {
    margin-bottom: 16px;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  // 页头那一排的名字是超管最想要的反馈，所以摆在卡上面，不是等保存完再刷新看
  &__nav {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
  }

  &__nav-label {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__nav-item {
    font-weight: 500;
  }

  &__nav-empty {
    color: rgba(0, 0, 0, 0.45);
  }

  &__toolbar {
    margin-bottom: 16px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  &__advice {
    margin-top: 24px;
  }

  &__advice-hint {
    margin-top: 24px;
  }
}

.section-card {
  &--off {
    background: #fafafa;
  }

  &__title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  &__meta {
    margin-bottom: 12px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__field-label {
    width: 84px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  // 换序后当前值要看得见：只有两个箭头的按钮，点完不知道自己在第几名
  &__sort {
    color: rgba(0, 0, 0, 0.45);
    font-variant-numeric: tabular-nums;
  }

  &__preview {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #f0f0f0;
  }

  &__preview-hint {
    margin: 8px 0 0;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  // 缩略靠这里收成访客端手机那一档的宽度：渲染框本身是访客端共用的，只有取景宽度是这一页定的
  .pbv {
    margin-top: 8px;
    max-width: 420px;
    max-height: 320px;
    overflow: auto;
    border: 1px solid #f0f0f0;
  }
}
</style>
