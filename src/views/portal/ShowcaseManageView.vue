<template>
  <div class="showcase-manage-page">
    <a-page-header title="展示内容" sub-title="团队 / 历程 / 客户标志 / 经营指标 / 客户评价 / 资质荣誉 / 常见问题——门户上这些展示条目的维护口">
    </a-page-header>

    <a-alert type="info" show-icon class="showcase-manage-page__notice">
      <template #message>
        带「示意」徽标的条目是 AI 生成的占位资料：它会在门户上占位，但不进真实统计。
        请把每一处示意换成你们自己的资料后徽标自然消失（关掉「示意内容」开关即去掉）。
        分类页签、中文名与归属栏目都来自平台词表，这里只是读它。
      </template>
    </a-alert>

    <a-alert v-if="siteError" type="error" show-icon class="showcase-manage-page__notice" :message="siteError" />

    <div class="content-wrapper">
      <a-card :bordered="false">
        <!-- 工具条原先塞在卡片 #title 槽：那是 overflow:hidden 的卡头，窄时会被裁切；改用 FilterBar -->
        <filter-bar>
          <a-select
            v-model:value="siteId"
            style="width: 220px"
            placeholder="选择站点"
            :options="siteOptions"
            @change="loadRows"
          />
          <template #actions>
            <a-space>
              <a-button :loading="loading" @click="loadRows">刷新</a-button>
              <a-button type="primary" :disabled="!activeKind" @click="openCreate">
                <template #icon><PlusOutlined /></template>
                新增条目
              </a-button>
            </a-space>
          </template>
        </filter-bar>

        <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="showcase-manage-page__notice" />

        <p v-if="orphanNotice" class="showcase-manage-page__orphan">{{ orphanNotice }}</p>

        <!-- destroy 非活跃页签：七个 kind 的列表只留当前一份 DOM，切换就是换数据而不是叠层 -->
        <!-- 页签条本身就是真实控件（role=tab 的按钮），列表只渲染当前 kind 一份：
             切页签 = 换数据，而不是把七张表叠在同一屏上 -->
        <div v-if="kinds.length" class="kind-tabs" role="tablist">
          <button
            v-for="kind in kinds"
            :key="kind.key"
            type="button"
            role="tab"
            class="kind-tab"
            :class="{ 'kind-tab--active': kind.key === activeKind }"
            :aria-selected="kind.key === activeKind"
            @click="activeKind = kind.key"
          >{{ kind.label }}</button>
        </div>
        <template v-if="activeKindRow">
          <p class="kind-meta">
            共 {{ rowsOf(activeKind).length }} 条{{ activeKindRow.sectionKey ? `；随平台栏目「${activeKindRow.sectionKey}」的开关联动` : '；全站性内容，不随单个栏目下线' }}
          </p>
          <!-- 读失败时整张表退场：失败提示与「还没有内容」的空态绝不同时出现，二者只说一件事 -->
          <a-spin v-if="!loadError" :spinning="loading">
            <a-table
              :scroll="{ x: 'max-content' }"
              :columns="columns"
              :data-source="rowsOf(activeKind)"
              :pagination="false"
              :row-key="(record: any) => record.id"
            >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'media'">
                    <img v-if="mediaThumb(record.mediaId)" :src="mediaThumb(record.mediaId) as string" class="showcase-thumb" />
                    <span v-else-if="record.mediaId && mediaUrls[record.mediaId] === FAILED" class="media-none">图读不到</span>
                    <span v-else-if="record.mediaId" class="media-none">读取中…</span>
                    <span v-else class="media-none">未配图</span>
                  </template>
                  <template v-if="column.key === 'content'">
                    <div class="showcase-title">
                      {{ record.title }}
                      <!-- 本期核心动机：示意内容必须让客户看得见它是示意的 -->
                      <a-tag v-if="record.isDemo" color="orange">示意</a-tag>
                    </div>
                    <div v-if="record.isDemo" class="demo-hint">请替换为真实资料</div>
                    <div v-if="record.subtitle" class="showcase-subtitle">{{ record.subtitle }}</div>
                    <div v-if="valueText(record)" class="showcase-subtitle">{{ valueText(record) }}</div>
                    <div v-if="record.body" class="showcase-body">{{ record.body }}</div>
                    <div v-if="record.url" class="showcase-subtitle">跳转到 {{ record.url }}</div>
                  </template>
                  <template v-if="column.key === 'industry'">{{ record.industry || '—' }}</template>
                  <template v-if="column.key === 'sort'">{{ record.sortOrder }}</template>
                  <template v-if="column.key === 'status'">
                    <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '展示中' : '已停用' }}</a-tag>
                  </template>
                  <template v-if="column.key === 'actions'">
                    <a-space>
                      <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
                      <a-button type="link" size="small" @click="toggleEnabled(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
                      <a-popconfirm title="确定删除这条展示内容吗？" @confirm="handleDelete(record)">
                        <a-button type="link" size="small" danger>删除</a-button>
                      </a-popconfirm>
                    </a-space>
                  </template>
                </template>
                <template #emptyText>
                  <!-- 空列表与「加载失败」是两件事：失败走上面那条红色 alert，这里只说「还没有内容」 -->
                  <a-empty :description="`「${activeKindRow.label}」这一类还没有内容：点「新增条目」填第一条真实资料`">
                    <template #image><span /></template>
                  </a-empty>
                </template>
              </a-table>
            </a-spin>
        </template>
      </a-card>
    </div>

    <a-modal
      v-model:open="formVisible"
      :title="editingId ? '编辑展示条目' : `新增「${activeKindLabel}」条目`"
      width="640px"
      :confirm-loading="saving"
      ok-text="保存"
      @ok="submitForm"
    >
      <!-- 后端的中文拒绝原因（如 kind 不认识、字段超长）原样渲染在这一条里，不翻译、不吞掉 -->
      <a-alert v-if="formError" type="error" show-icon :message="formError" style="margin-bottom: 12px" />
      <p v-for="hint in slotHints" :key="hint" class="slot-hint">{{ hint }}</p>
      <a-form :model="form" layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="form.title" placeholder="这条展示内容叫什么（团队成员填姓名）" />
        </a-form-item>
        <a-form-item label="副标题 / 时间">
          <a-input v-model:value="form.subtitle" placeholder="可选；发展历程这类按时间排的条目建议填时间" />
        </a-form-item>
        <a-form-item v-if="activeKind === 'metric'" label="数值">
          <a-input v-model:value="form.valueNumber" placeholder="如 12.50：按原样保存，尾零是有意义的" />
          <a-input v-model:value="form.valueSuffix" placeholder="后缀，如 %、年、+" class="suffix-input" />
        </a-form-item>
        <a-form-item label="正文">
          <a-textarea v-model:value="form.body" :rows="3" placeholder="客户评价的评价内容、常见问题的答案等" />
        </a-form-item>
        <a-form-item label="图片">
          <div class="media-slot">
            <img v-if="formMediaPreview" :src="formMediaPreview" class="showcase-thumb" />
            <a-space>
              <a-button :loading="mediaPicking" @click="mediaModalOpen = true">从素材库选图</a-button>
              <a-button v-if="form.mediaId" type="link" @click="clearMedia">清除图片</a-button>
            </a-space>
            <p v-if="mediaNote" class="media-note">{{ mediaNote }}</p>
            <p v-else-if="!form.mediaId" class="media-note">还没配图：没图的图位在访客那里就是一块空白。</p>
          </div>
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="跳转链接">
              <a-input v-model:value="form.url" placeholder="可选，如客户官网" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="行业">
              <a-input v-model:value="form.industry" placeholder="可选" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="排序">
              <a-input v-model:value="form.sortOrder" placeholder="0" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="在门户上展示">
          <a-switch v-model:checked="form.enabled" />
        </a-form-item>
        <a-form-item label="示意内容">
          <a-switch v-model:checked="form.isDemo" />
          <span class="demo-explain">人填的真实资料不要开这个：开关一开，这条在门户上就挂着「示意」徽标</span>
        </a-form-item>
      </a-form>
      <!-- v-if：不打开就不挂载——挑图弹窗一挂载就会去列媒体库 -->
      <MediaImageLibraryModal
        v-if="mediaModalOpen"
        v-model:open="mediaModalOpen"
        @pick="onPickMedia"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import MediaImageLibraryModal from '../../components/MediaImageLibraryModal.vue'
import FilterBar from '../../components/FilterBar.vue'
import { siteApi } from '../../api/workspace'
import { useAuthStore } from '../../stores/auth'
import {
  portalShowcaseApi,
  resolveMediaIdByUrl,
  fetchMediaUrl,
  type ShowcaseForm,
  type ShowcaseItem,
  type ShowcaseKind
} from '../../api/portalShowcase'

/**
 * 租户侧「展示内容」维护页（Spec-D D2）。
 *
 * 三件事是刻意的：
 * 1. 七个页签一个都不写死：标签、顺序、「随哪个栏目联动」全部来自 `GET /portal/showcase/kinds`
 *    （后端 `ShowcaseKinds` 词表的唯一出口）。前端抄一份，后端加一档就会把它演成
 *    它认识的那句话（I-1）；「栏目」与「页签（kind）」在文案里也各指各的，不混叫。
 * 2. `is_demo` 的行一律挂「示意」徽标 +「请替换为真实资料」：本期做这一页的动机就是
 *    AI 产的占位内容必须让客户一眼看出是占位，徽标不靠 DemoFlag 那句「演示内容包」的
 *    旧词，因为这一页要的是行动指引（去替换），不是解释机制。
 * 3. 图位只认媒体库：弹窗复用现成的 `MediaImageLibraryModal`（挑图与就地上传都在它里面），
 *    界面没有给图片留任何手填地址的口子——`portal_showcase_item` 存的是 `mediaId`，
 *    地址填得再漂亮也存不进去，摆个输入框就是骗人。
 *
 * 必填槽：后端硬校验的只有站点 / kind / 标题（`ShowcaseForm.validate`），其余按这一类在门户上
 * 的图位需求做即时提示（缺什么当场说），最终判据仍是服务端——被拒时它那句中文原样上屏。
 */

const auth = useAuthStore()
// D5-3 交棒链接带着 ?siteId=（后端 workspaceUrl 的拼法）：这一页要落回它指的那个站
const route = useRoute()

const kinds = ref<ShowcaseKind[]>([])
const activeKind = ref('')
const rows = ref<ShowcaseItem[]>([])
const loading = ref(false)
const loadError = ref('')

const sites = ref<Array<{ id: number; name: string }>>([])
const siteId = ref<number | undefined>(undefined)
const siteError = ref('')
const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

/** 缩略图：库里只有 mediaId，地址按 id 现取；FAILED 是「取失败了」，与「没配图」分开显示 */
const FAILED = '__failed__'
const mediaUrls = reactive<Record<number, string>>({})

const columns = [
  { title: '图片', key: 'media', width: 120 },
  { title: '内容', key: 'content', width: 360 },
  { title: '行业', key: 'industry', width: 120 },
  { title: '排序', key: 'sort', width: 80, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 200 }
]

const activeKindLabel = computed(() => kinds.value.find(kind => kind.key === activeKind.value)?.label || '')

/** 当前页签那一类的词表行：页签条之外的文案（联动提示、空列表那句话）都读它 */
const activeKindRow = computed(() => kinds.value.find(kind => kind.key === activeKind.value) || null)

/**
 * 每一类在门户上不成空洞的最小槽位：这里是本页自己的一份「体验判据」，不是第二份词表——
 * kind 的中文名与归属永远来自 `/kinds`，这份表只回答「光有标题这一格还是空的」。
 * 服务端怎么裁决仍以它的报错为准（保存失败会把原句贴上屏）。
 */
const REQUIRED_SLOTS: Record<string, string[]> = {
  team: ['mediaId'],
  milestone: ['subtitle'],
  client_logo: ['mediaId'],
  metric: ['valueNumber'],
  testimonial: ['body'],
  award: ['mediaId'],
  faq: ['body']
}
const SLOT_LABELS: Record<string, string> = {
  title: '标题',
  subtitle: '副标题 / 时间',
  body: '正文',
  valueNumber: '数值',
  mediaId: '图片'
}

function rowsOf(kindKey: string): ShowcaseItem[] {
  return rows.value.filter(row => row.kind === kindKey)
}

/** 库里有、词表里没有的 kind（后端加一档而本页还没刷新时会出现）：如实报数，不静默丢行 */
const orphanNotice = computed(() => {
  const known = new Set(kinds.value.map(kind => kind.key))
  const orphans = rows.value.filter(row => !known.has(row.kind))
  if (!orphans.length) return ''
  const keys = [...new Set(orphans.map(row => row.kind))].join('、')
  return `另有 ${orphans.length} 条内容属于词表里没有的类别（${keys}），界面上没有它的页签，未对其做任何处理`
})

function valueText(record: ShowcaseItem): string {
  if (record.valueNumber === null || record.valueNumber === undefined || record.valueNumber === '') {
    return ''
  }
  return `数值：${record.valueNumber}${record.valueSuffix || ''}`
}

function mediaThumb(mediaId: number | null): string | undefined {
  if (!mediaId) return undefined
  const url = mediaUrls[mediaId]
  return url && url !== FAILED ? url : undefined
}

/** 缩略图惰性取：列表回来后才按 id 补地址，一条读失败只糊它自己那一格 */
watch(rows, list => {
  const ids = [...new Set(list.map(row => row.mediaId).filter((id): id is number => !!id))]
  ids.forEach(id => {
    if (mediaUrls[id] !== undefined) return
    mediaUrls[id] = ''
    fetchMediaUrl(id)
      .then(url => { mediaUrls[id] = url })
      .catch(() => { mediaUrls[id] = FAILED })
  })
})

async function loadKinds() {
  try {
    kinds.value = await portalShowcaseApi.kinds()
    if (!activeKind.value && kinds.value.length) {
      activeKind.value = kinds.value[0].key
    }
  } catch (error: any) {
    // 词表读不到就不摆页签：摆七个写死的标签假装一切正常，是这一页最不该犯的病
    loadError.value = error?.message || '类别词表读取失败'
  }
}

async function loadSites() {
  try {
    const list = await siteApi.list()
    sites.value = (list || []).map((site: any) => ({ id: site.id, name: site.name }))
    // 交棒链接（D5-3）带着 ?siteId= 指到这一页：只有这个号真的在可选清单里才采用——
    // 不在就回落原有默认（单站自动选中），绝不选中一个列表里没有的站（那等于往拿不到的 id 上写数据）
    const wanted = Number(route.query.siteId)
    if (Number.isInteger(wanted) && sites.value.some(site => site.id === wanted)) {
      siteId.value = wanted
    } else if (sites.value.length === 1) {
      siteId.value = sites.value[0].id
    }
  } catch (error: any) {
    siteError.value = error?.message || '站点列表读取失败'
  }
}

async function loadRows() {
  loading.value = true
  loadError.value = ''
  try {
    rows.value = await portalShowcaseApi.list(siteId.value ?? null)
  } catch (error: any) {
    // 读失败只说读失败；空列表走表格里那句「还没有内容」，两者不许互相冒充
    loadError.value = error?.message || '展示内容读取失败'
    rows.value = []
  } finally {
    loading.value = false
  }
}

// ---------- 表单 ----------
const formVisible = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formError = ref('')
const slotHints = ref<string[]>([])
const mediaModalOpen = ref(false)
const mediaPicking = ref(false)
const mediaNote = ref('')

// 表单里的数值与排序按字符串收集：数值要保尾零、排序允许 momentarily 为空，提交时再换算
const emptyForm = (): Omit<ShowcaseForm, 'valueNumber' | 'sortOrder'> & { valueNumber: string; sortOrder: string } => ({
  siteId: 0,
  kind: activeKind.value,
  title: '',
  subtitle: '',
  body: '',
  valueNumber: '',
  valueSuffix: '',
  mediaId: null,
  url: '',
  industry: '',
  sortOrder: '',
  enabled: true,
  isDemo: false
})
const form = reactive(emptyForm())

const formMediaPreview = computed(() => {
  if (!form.mediaId) return ''
  const url = mediaUrls[form.mediaId]
  return url && url !== FAILED ? url : ''
})

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formError.value = ''
  slotHints.value = []
  mediaNote.value = ''
  formVisible.value = true
}

function openEdit(record: ShowcaseItem) {
  editingId.value = record.id
  Object.assign(form, {
    siteId: record.siteId,
    kind: record.kind,
    title: record.title ?? '',
    subtitle: record.subtitle ?? '',
    body: record.body ?? '',
    valueNumber: record.valueNumber === null || record.valueNumber === undefined ? '' : String(record.valueNumber),
    valueSuffix: record.valueSuffix ?? '',
    mediaId: record.mediaId,
    url: record.url ?? '',
    industry: record.industry ?? '',
    sortOrder: record.sortOrder === 0 ? '' : String(record.sortOrder),
    enabled: record.enabled,
    isDemo: record.isDemo
  })
  formError.value = ''
  slotHints.value = []
  mediaNote.value = ''
  formVisible.value = true
}

/** 即时提示用真实 DOM 摆出来（不弹完就消失的 toast）：缺哪一格、这一格是干什么的 */
function missingSlots(): string[] {
  const required = ['title', ...(REQUIRED_SLOTS[form.kind] || [])]
  const missing: string[] = []
  required.forEach(slot => {
    const value = (form as any)[slot]
    if (value === null || value === undefined || String(value).trim() === '') {
      missing.push(`还差「${SLOT_LABELS[slot] || slot}」：这一类在门户上的那一格不能空（最终以服务端校验为准）`)
    }
  })
  return missing
}

async function submitForm() {
  formError.value = ''
  if (!siteId.value) {
    formError.value = '请先选定站点再维护展示内容（后端原话：一个租户多个站是常态，不猜默认站）'
    return
  }
  slotHints.value = missingSlots()
  if (slotHints.value.length) return
  saving.value = true
  try {
    const payload: ShowcaseForm = {
      siteId: siteId.value,
      kind: form.kind,
      title: form.title.trim(),
      subtitle: form.subtitle?.trim() || null,
      body: form.body?.trim() || null,
      // 数值按字符串交回去：后端刻意从字符串解析 BigDecimal，尾零在界面上有意义
      valueNumber: form.valueNumber?.trim() || null,
      valueSuffix: form.valueSuffix?.trim() || null,
      mediaId: form.mediaId ?? null,
      url: form.url?.trim() || null,
      industry: form.industry?.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      enabled: form.enabled,
      isDemo: form.isDemo
    }
    if (editingId.value) {
      await portalShowcaseApi.update(editingId.value, payload)
      message.success('已更新')
    } else {
      await portalShowcaseApi.create(payload)
      message.success('已保存')
    }
    formVisible.value = false
    await loadRows()
  } catch (error: any) {
    // 认不出的 kind、超长字段……后端那句中文原因原样上屏，不吞、不改写
    formError.value = error?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

/** 挑图弹窗交回的是地址：拿它回查媒体库换成 mediaId，查不到就如实说，绝不硬存地址 */
async function onPickMedia(url: string) {
  mediaPicking.value = true
  mediaNote.value = ''
  try {
    const tenantId = auth.selectedTenantId ?? auth.tenantId ?? null
    const mediaId = await resolveMediaIdByUrl(url, tenantId)
    if (!mediaId) {
      mediaNote.value = '在媒体库里没定位到这张图的素材编号，请重新挑一张（图片只能来自媒体库，地址存不进去）'
      return
    }
    form.mediaId = mediaId
    mediaUrls[mediaId] = url
    message.success('图片已选定')
  } catch (error: any) {
    mediaNote.value = error?.message || '素材编号查询失败'
  } finally {
    mediaPicking.value = false
  }
}

function clearMedia() {
  form.mediaId = null
  mediaNote.value = ''
}

/** 启停走整条 PUT：后端只有这一个写口，这里把原行原样带回去只翻 enabled */
async function toggleEnabled(record: ShowcaseItem) {
  try {
    await portalShowcaseApi.update(record.id, {
      siteId: record.siteId,
      kind: record.kind,
      title: record.title,
      subtitle: record.subtitle,
      body: record.body,
      valueNumber: record.valueNumber,
      valueSuffix: record.valueSuffix,
      mediaId: record.mediaId,
      url: record.url,
      industry: record.industry,
      sortOrder: record.sortOrder,
      enabled: !record.enabled,
      isDemo: record.isDemo
    })
    message.success(record.enabled ? '已停用' : '已启用，门户现在会展示它')
    await loadRows()
  } catch (error: any) {
    message.error(error?.message || '操作失败')
  }
}

async function handleDelete(record: ShowcaseItem) {
  try {
    await portalShowcaseApi.remove(record.id)
    message.success('删除成功')
    await loadRows()
  } catch (error: any) {
    message.error(error?.message || '删除失败')
  }
}

onMounted(async () => {
  await loadKinds()
  await loadSites()
  await loadRows()
})
</script>

<style scoped lang="less">
.showcase-manage-page {
  width: 100%;

  &__notice {
    margin-bottom: 16px;
  }

  &__orphan {
    color: #faad14;
    margin-bottom: 8px;
  }
}

.kind-meta {
  color: #8c8c8c;
  font-size: 12px;
}

.showcase-thumb {
  width: 72px;
  height: 44px;
  object-fit: contain;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #fafafa;
}

.media-none {
  font-size: 12px;
  color: #faad14;
}

.showcase-title {
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.demo-hint {
  font-size: 12px;
  color: #fa8c16;
}

.showcase-subtitle {
  font-size: 12px;
  color: #8c8c8c;
}

.showcase-body {
  font-size: 12px;
  color: #595959;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.media-slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.media-note {
  font-size: 12px;
  color: #faad14;
  margin: 0;
}

.slot-hint {
  color: #ff4d4f;
  font-size: 12px;
  margin: 0 0 4px;
}

.suffix-input {
  margin-top: 8px;
}

.demo-explain {
  margin-left: 8px;
  font-size: 12px;
  color: #8c8c8c;
}
</style>
