<template>
  <div class="block-library">
    <a-alert type="info" show-icon class="block-library__notice">
      <template #message>
        这里是平台侧的组件库。每一格用的都是<strong>访客端同一套渲染器</strong>，演示槽位是按区块自己的
        字段结构（dataSchema）推出来的，不落库、也不动任何站点。
        清单、分类、可选渲染器与默认字段结构全部来自服务端，这一页没有第二份常量。
        <strong>代码声明的那一族在这里只读</strong>——要改它得发版；界面添加的那一族可以在这一页新建、
        改字段结构、启用与删除。
      </template>
    </a-alert>

    <a-alert v-if="loadError" type="error" show-icon class="block-library__notice" :message="loadError">
      <template #description>
        组件元数据读不出来时这一页什么都渲不了（清单的唯一来源就是这一个接口）。
        {{ loadError.includes('权限') ? '这一页属于建设域，账号没有 portal:block:manage 就是取不到元数据。' : '稍后可以点右边的刷新再试。' }}
      </template>
    </a-alert>

    <p v-if="unwiredCount" class="block-library__muted block-library__unwired">
      这份清单里有 {{ unwiredCount }} 格带着「未接线 · 需要数据源」：拖进页面渲得出结构，里面却永远是空的。
      这个数是按服务端回的每一格现算的，这一页不列区块 key。
    </p>

    <FilterBar>
      <a-input v-model:value="keyword" allow-clear placeholder="按显示名、区块 key、分类或渲染器过滤" style="width: 240px" />
      <a-select v-model:value="sourceFilter" style="width: 150px" :options="SOURCE_OPTIONS" />
      <a-select v-model:value="frameWidth" style="width: 160px" :options="FRAME_OPTIONS" />
      <template #actions>
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
          <a-button @click="showProps = !showProps">{{ showProps ? '收起字段结构' : '看字段结构' }}</a-button>
          <a-button type="primary" :disabled="!canWrite" @click="openCreate">新建组件</a-button>
        </a-space>
      </template>
    </FilterBar>

    <a-alert v-if="metaError" type="warning" show-icon class="block-library__notice" :message="metaError"
             description="分类词表、可选渲染器与默认字段结构各自有一个读口；哪一个没读到，新建抽屉里对应的那一格就不给填——这一页不兜底一份「大概是哪几个」。" />

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !loadError && rows.length === 0"
               description="服务端没有返回任何组件元数据：区块白名单只在后端一处，这里不做兜底清单">
        <template #image><span /></template>
      </a-empty>
      <a-empty v-else-if="!loading && !loadError && visibleItems.length === 0"
               description="没有组件匹配这些条件：清单只有一个来源，所以这里也只能少显示、不能多显示">
        <template #image><span /></template>
      </a-empty>

      <div class="block-library__grid">
        <a-card v-for="item in visibleItems" :key="item.row.blockKey" size="small" class="block-library__card">
          <template #title>
            <a-space size="6" wrap>
              <span class="block-library__name">{{ item.row.name }}</span>
              <a-tag>{{ item.row.blockKey }}</a-tag>
              <a-tag v-if="item.row.category" color="blue">{{ item.row.category }}</a-tag>
              <a-tag v-if="item.row.maxInstances" color="default">单页最多 {{ item.row.maxInstances }} 个</a-tag>
              <!-- 来源与启用状态各认接口回的那一格：前端一份「哪些算代码族」的清单迟早成假话 -->
              <a-tag :color="item.manual ? 'purple' : 'geekblue'">{{ item.manual ? '界面添加' : '代码声明' }}</a-tag>
              <a-tooltip v-if="item.manual" :title="ENABLE_TIP">
                <a-tag :color="item.row.enabled ? 'green' : 'orange'">{{ item.row.enabled ? '已启用' : '未启用' }}</a-tag>
              </a-tooltip>
              <!-- 「未接线」这条事实只活在后端 PortalBlockCatalogue.UNWIRED_BLOCKS 那一份里，
                   这里读接口回的那一格：前端一抄清单，Java 改了这边就说假话。 -->
              <a-tooltip v-if="item.row.notWired" :title="UNWIRED_TIP">
                <a-tag color="orange">未接线 · 需要数据源</a-tag>
              </a-tooltip>
            </a-space>
          </template>
          <template #extra>
            <a-space size="4" wrap>
              <template v-if="item.manual">
                <a-button size="small" :loading="busyId === item.row.id" @click="toggleEnabled(item)">
                  {{ item.row.enabled ? '停用' : '启用' }}
                </a-button>
                <a-button size="small" @click="openEdit(item)">改字段结构</a-button>
                <a-popconfirm :title="DELETE_TIP" ok-text="删除" cancel-text="先不删" @confirm="remove(item)">
                  <a-button size="small" danger>删除</a-button>
                </a-popconfirm>
              </template>
              <a-tooltip v-else :title="CODE_READ_ONLY_TIP">
                <a-tag>只读</a-tag>
              </a-tooltip>
            </a-space>
          </template>

          <p v-if="item.provenance" class="block-library__muted">{{ item.provenance }}</p>

          <a-alert
            v-if="!item.renderable"
            type="warning"
            show-icon
            :message="`渲染器「${item.row.rendererKey}」没在前端登记，这一格只能看到名字与字段结构`"
            description="访客端遇到同样的区块也会整块不渲染：这是发版要补组件的信号，不是这一页的问题。"
          />
          <div v-else class="block-library__frame" :style="frameStyle">
            <PortalViewportPreview :blocks="[item.block]" :theme="null" :shell="shell" />
          </div>

          <div v-if="item.manual" class="block-library__trial">
            <a-space size="4" wrap>
              <a-button size="small" @click="toggleTrial(item)">
                {{ trialOpen[item.row.id] ? '收起试填' : '试填这几格' }}
              </a-button>
              <span class="block-library__muted">改完点「按这份重渲」：这一格只改眼前的预览，不写库。</span>
            </a-space>
            <template v-if="trialOpen[item.row.id]">
              <a-textarea v-model:value="trialText[item.row.id]" :rows="8"
                          placeholder="这几格按你自己的值填（只改眼前这一格的预览，不写库）"
                          class="block-library__trial-text" />
              <a-space size="4">
                <a-button size="small" type="primary" @click="applyTrial(item)">按这份重渲</a-button>
                <a-button size="small" @click="resetTrial(item)">退回推出来的演示值</a-button>
              </a-space>
              <p v-if="trialError[item.row.id]" class="block-library__error">{{ trialError[item.row.id] }}</p>
            </template>
          </div>

          <pre v-if="showProps" class="block-library__props">{{ item.schemaText }}</pre>
        </a-card>
      </div>
    </a-spin>

    <a-drawer v-model:open="drawerOpen" :title="drawerTitle" width="620" :body-style="{ paddingBottom: '64px' }">
      <a-alert type="info" show-icon class="block-library__notice" :message="rendererNote" />
      <a-alert type="warning" show-icon class="block-library__notice" :message="LIST_SLOT_WARNING" />
      <a-alert v-if="saveError" type="error" show-icon class="block-library__notice" :message="saveError" />

      <a-form layout="vertical">
        <a-form-item label="区块 key">
          <a-input v-model:value="form.blockKey" :disabled="editingId !== null" placeholder="小写字母开头，只许小写字母、数字与连字符，长 2~64" />
          <span class="block-library__muted">
            {{ editingId === null ? '建好之后就改不了了：改 key 等于换一个组件，老页面上那一格会变成未知区块。' : '建好之后不许改（要换 key 就新建一个组件）。' }}
          </span>
        </a-form-item>
        <a-form-item label="显示名">
          <a-input v-model:value="form.name" placeholder="给人看的那句话，最长 500 字" />
        </a-form-item>
        <a-form-item label="分类">
          <a-select v-model:value="form.category" :options="categoryOptions" placeholder="读服务端那份分类词表" />
          <span class="block-library__muted">下拉里的每一个分类都是 {{ CATEGORY_SOURCE_HINT }}。</span>
        </a-form-item>
        <a-form-item label="单页最多几个">
          <a-input-number v-model:value="form.maxInstances" :min="1" :max="MAX_INSTANCES_LIMIT" />
          <span class="block-library__muted">上限 {{ MAX_INSTANCES_LIMIT }}，与后端写口同一个数。</span>
        </a-form-item>
        <a-form-item label="渲染器">
          <a-select v-model:value="form.rendererKey" :options="rendererSelectOptions" :disabled="editingId !== null" />
          <span class="block-library__muted">{{ rendererNote }}</span>
        </a-form-item>
        <a-form-item label="字段结构（props 的 JSON Schema）">
          <a-textarea v-model:value="form.dataSchemaJson" :rows="12" placeholder="这一格的字段清单，新建时预填服务端给的那一份" />
          <span class="block-library__muted">{{ LIST_SLOT_WARNING }}</span>
        </a-form-item>
        <a-form-item label="来源地址（可空）">
          <a-input v-model:value="form.provenanceUrl" placeholder="这一格的样式是从哪儿看来的，填地址" />
        </a-form-item>
        <a-form-item label="来源说明（可空）">
          <a-textarea v-model:value="form.provenanceNote" :rows="2" placeholder="例如「参考站某板块，字段是自动拟的、待补」" />
          <span class="block-library__muted">留空就是不改这两格（库里那一格本来也不会被擦掉）。</span>
        </a-form-item>
      </a-form>

      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" :disabled="!canWrite" @click="save">
            {{ editingId === null ? '存为未启用' : '保存' }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
// 与访客端同一套区块样式，全局入口收敛到 styles/portal-preview.less
import '@/styles/portal-preview.less'
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import FilterBar from '../../components/FilterBar.vue'
import { blockDefsApi, type BlockDefRow } from '../../api/blockDefs'
import type { PortalBlockMeta } from '../../api/portalPages'
import { demoPropsFor, demoShell } from '../../portal/blocks/blockDemo'
import { resolveRenderer } from '../../portal/blocks/registry'
import type { RenderedBlock } from '../../portal/api/portalPublic'
import PortalViewportPreview from '../../portal/blocks/PortalViewportPreview.vue'

/**
 * 组件库（Spec-M §7 的「区块画廊升级为可写」+ §8 第 4 步，D4/D5）。
 *
 * 四条纪律：
 * 1. 清单、显示名、分类、上限、「这一格数据接不通」那一格、还有两族之分（`source`）与启用状态
 *    全部来自 `GET /api/admin/portal-blocks`（含停用行——只出启用那一半的话，人就永远看不到
 *    「我昨天建的那个组件去哪了」），这一页没有任何一份区块常量；
 * 2. 演示 props 由每一格自带的字段结构推导（见 blockDemo.ts），不是 blockKey → props 的对照表；
 * 3. 渲染走 `PortalViewportPreview` + 注册表里的真组件，和访客端、搭建器预览同一条路；
 * 4. 写口只认服务端那一套闸：新建落成未启用，<b>启用是第二个动作</b>（启用即进入可挑清单与
 *    给模型的词表，垃圾组件会污染后续所有生成），被拒时把后端原话念出来，不自己改写。
 */

interface LibraryItem {
  row: BlockDefRow
  manual: boolean
  block: RenderedBlock
  renderable: boolean
  schemaText: string
  provenance: string
}

/** 取景宽度只是框宽：区块内部断点走容器查询，改框宽就会真的换布局（见 PortalViewportPreview 的说明） */
const FRAME_OPTIONS = [
  { value: null, label: '自适应宽度' },
  { value: 768, label: '平板 768' },
  { value: 375, label: '手机 375' }
]

/**
 * 来源这一格只是「少显示」的筛法，判据仍然读接口回的那一格：
 * 值取自 `BlockDefRow.source`，这一页不另存一份「哪些 key 算代码族」。
 */
const SOURCE_OPTIONS = [
  { value: 'all', label: '两族都看' },
  { value: 'manual', label: '只看界面添加' },
  { value: 'code', label: '只看代码声明' }
]

/**
 * 「未接线」那句话为什么说出口：渲染器真的在、区块也能拖进页面，缺的是数据源——
 * 所以访客端渲出来是一个空壳。判据本身不在这里（见模板里那段注释），这里只有给人看的那句解释。
 */
const UNWIRED_TIP = '渲染器在、区块能拖，但后端没有任何数据源接得上它：放进页面渲出来就是空的。'
  + '要么补数据源，要么把这个区块下线——这条判据来自服务端的区块元数据，不是前端抄的一份清单。'

const ENABLE_TIP = '未启用 = 这一格不在搭建器的可挑清单里，也进不了给模型的词表；'
  + '它还在库里，点「启用」就回去。新建一律落成未启用，因为启用这一步会让它影响所有后续生成。'

const CODE_READ_ONLY_TIP = '代码声明那一族的字段结构与渲染器由 Java 里的区块白名单说了算，'
  + '界面上改不动（改了也会被下次启动同步回来）：要动它得发版。'

/** 删除说的是两件人最容易误会的事：这一行没有真消失，而它的 key 也没有腾出来 */
const DELETE_TIP = '要删掉这一格？这是软删：它不再参与校验与生成，但也不会从库里消失，'
  + '而且它用过的 key 不会被释放——同一个 key 再建会被后端拒。页面上已经在用这一格的版式会变成整块不渲染。'

/** 列表槽那条硬闸是人最容易踩的一脚，界面上先说明白（判据在 `ManualBlockDefService#admitsLiteral`） */
const LIST_SLOT_WARNING = '字段结构里凡是只收 `{"$data":…}` 绑定的那一格，后端会直接拒：'
  + '人工组件没有专属数据源，那种格子建出来永远填不出内容。'
  + '要往这一格里放东西，就把它声明成收手填数组。'

/** 与后端 `ManualBlockDefService.MAX_INSTANCES_LIMIT` 同数的界面上限；超出后端一样会拒 */
const MAX_INSTANCES_LIMIT = 6

const CATEGORY_SOURCE_HINT = '后端那个分类词表读口回过来的，不是这一页列的'

const rows = ref<BlockDefRow[]>([])
const categories = ref<string[]>([])
const rendererOptions = ref<string[]>([])
const schemaPrefill = ref('')
const metaError = ref('')
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const sourceFilter = ref('all')
const frameWidth = ref<number | null>(null)
const showProps = ref(false)
const busyId = ref<number | null>(null)
const shell = demoShell()

/** 试填：每一格自己的文本、解析错误与「已经生效的那一份」，都按行 id 存着 */
const trialOpen = reactive<Record<number, boolean>>({})
const trialText = reactive<Record<number, string>>({})
const trialError = reactive<Record<number, string>>({})
const trialApplied = reactive<Record<number, Record<string, unknown>>>({})

const drawerOpen = ref(false)
const drawerTitle = ref('新建组件')
const editingId = ref<number | null>(null)
const saving = ref(false)
const saveError = ref('')

/** 抽屉里那一份：来源两格在界面上永远是个字符串（空串 = 不改这两格），交出去时才折成 null */
interface DrawerForm {
  blockKey: string
  name: string
  category: string
  maxInstances: number | null
  rendererKey: string
  dataSchemaJson: string
  provenanceUrl: string
  provenanceNote: string
}

const form = reactive<DrawerForm>({
  blockKey: '',
  name: '',
  category: '',
  maxInstances: 1,
  rendererKey: '',
  dataSchemaJson: '',
  provenanceUrl: '',
  provenanceNote: ''
})

/** 三样读口任一没读到就不给提交：新建抽屉里那些下拉与预填全来自接口，兜一份就等于写第二份真相 */
const canWrite = computed(() => categories.value.length > 0
  && rendererOptions.value.length > 0
  && schemaPrefill.value.trim() !== '')

const rendererNote = computed(() => {
  if (rendererOptions.value.length === 0) {
    return '可选渲染器读不到：读不到就不给提交，这一页不猜一支「大概能用」。'
  }
  return `人工组件能挑的渲染器只有服务端回的那几支（现在只有 ${rendererOptions.value.join('、')} 一支）：`
    + '它不绑定栏目，只按你定义的字段结构摆通用卡片——排版正确、内容如实，专属设计待补。'
})

const categoryOptions = computed(() => categories.value.map(value => ({ value, label: value })))
const rendererSelectOptions = computed(() => rendererOptions.value.map(value => ({ value, label: value })))

function isManual(row: BlockDefRow): boolean {
  return row.source === 'manual'
}

function demoPropsOf(row: BlockDefRow, index: number): Record<string, unknown> {
  return demoPropsFor(row as PortalBlockMeta, index)
}

/** 预览吃的那一份：试填生效过就用它，否则用按字段结构推出来的演示值 */
function propsFor(row: BlockDefRow, index: number): Record<string, unknown> {
  const applied = trialApplied[row.id]
  return applied || demoPropsOf(row, index)
}

const items = computed<LibraryItem[]>(() => rows.value.map((row, index) => {
  const manual = isManual(row)
  const block: RenderedBlock = {
    instanceId: `library-${row.blockKey}`,
    blockKey: row.blockKey,
    rendererKey: row.rendererKey,
    props: propsFor(row, index)
  }
  const parts: string[] = []
  if (row.provenanceUrl) {
    parts.push(`来源：${row.provenanceUrl}`)
  }
  if (row.provenanceNote) {
    parts.push(row.provenanceNote)
  }
  return {
    row,
    manual,
    block,
    renderable: !!resolveRenderer(row.rendererKey),
    schemaText: JSON.stringify(row.dataSchema ?? null, null, 2),
    provenance: parts.join(' · ')
  }
}))

/** 有几格被后端标成空壳：这个数从接口回的那一格现算，前端没有一份区块清单可数 */
const unwiredCount = computed(() => rows.value.filter(row => row.notWired).length)

const visibleItems = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return items.value.filter(item => {
    if (sourceFilter.value !== 'all' && item.row.source !== sourceFilter.value) {
      return false
    }
    if (!needle) {
      return true
    }
    return [item.row.name, item.row.blockKey, item.row.category, item.row.rendererKey]
      .some(field => String(field || '').toLowerCase().includes(needle))
  })
})

const frameStyle = computed<Record<string, string>>(() =>
  (frameWidth.value ? { width: `${frameWidth.value}px` } : {} as Record<string, string>))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    rows.value = (await blockDefsApi.list()) || []
    // 试填的那一份是眼前这一屏的状态：重新取数之后就退回推出来的演示值，不带着旧行去渲新行
    Object.keys(trialApplied).forEach(id => delete trialApplied[Number(id)])
    Object.keys(trialText).forEach(id => delete trialText[Number(id)])
    Object.keys(trialError).forEach(id => delete trialError[Number(id)])
  } catch (error: any) {
    loadError.value = error?.message || '组件元数据加载失败'
  } finally {
    loading.value = false
  }
}

/** 三样词表读口：哪一个坏了只影响新建抽屉，不影响这一页读清单（读到多少摆多少） */
async function loadWriteMeta() {
  const failures: string[] = []
  try {
    categories.value = (await blockDefsApi.categories()) || []
  } catch (error: any) {
    failures.push(`分类词表：${error?.message || '读不到'}`)
  }
  try {
    rendererOptions.value = (await blockDefsApi.rendererOptions()) || []
  } catch (error: any) {
    failures.push(`可选渲染器：${error?.message || '读不到'}`)
  }
  try {
    schemaPrefill.value = String((await blockDefsApi.schemaPrefill()) || '')
  } catch (error: any) {
    failures.push(`默认字段结构：${error?.message || '读不到'}`)
  }
  metaError.value = failures.length ? `新建要用到的读口有一个或多个没取到——${failures.join('；')}` : ''
}

function toggleTrial(item: LibraryItem) {
  const id = item.row.id
  if (!trialOpen[id]) {
    if (trialText[id] === undefined) {
      trialText[id] = JSON.stringify(propsFor(item.row, rows.value.indexOf(item.row)), null, 2)
    }
    if (trialError[id] === undefined) {
      trialError[id] = ''
    }
  }
  trialOpen[id] = !trialOpen[id]
}

/** 试填只在眼前这一格生效：它不写库，所以后端那套校验在这里不会替这一份兜底 */
function applyTrial(item: LibraryItem) {
  const id = item.row.id
  const raw = trialText[id] ?? ''
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error: any) {
    trialError[id] = `这份 JSON 读不出来：${error?.message || '格式不对'}`
    return
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    trialError[id] = '这里要的是一个对象（每一格的名字 → 值），不是数组或一个字符串。'
    return
  }
  trialApplied[id] = parsed as Record<string, unknown>
  trialError[id] = ''
}

function resetTrial(item: LibraryItem) {
  const id = item.row.id
  delete trialApplied[id]
  trialText[id] = JSON.stringify(demoPropsOf(item.row, rows.value.indexOf(item.row)), null, 2)
  trialError[id] = ''
}

async function toggleEnabled(item: LibraryItem) {
  const target = !item.row.enabled
  busyId.value = item.row.id
  try {
    const saved = await blockDefsApi.setEnabled(item.row.id, target)
    replaceRow(saved)
    message.success(target
      ? '已启用：这一格现在进搭建器的可挑清单，也在给模型的词表里'
      : '已停用：这一格从可挑清单与词表里退出，页面上已有的那一格会整块不渲染')
  } catch (error: any) {
    // 启用被拒的理由只有后端知道（渲染器没登记、撞代码族那一族的名字），原话念出来
    message.error(error?.message || '启用/停用失败')
  } finally {
    busyId.value = null
  }
}

async function remove(item: LibraryItem) {
  busyId.value = item.row.id
  try {
    await blockDefsApi.remove(item.row.id)
    rows.value = rows.value.filter(row => row.id !== item.row.id)
    message.success('已删除：软删这一行，它不再参与校验与生成；key 不会被释放，同名重建会被拒')
  } catch (error: any) {
    message.error(error?.message || '删除失败')
  } finally {
    busyId.value = null
  }
}

function replaceRow(row: BlockDefRow) {
  rows.value = rows.value.map(existing => (existing.id === row.id ? row : existing))
}

function openCreate() {
  editingId.value = null
  drawerTitle.value = '新建组件'
  saveError.value = ''
  form.blockKey = ''
  form.name = ''
  form.category = categories.value[0] || ''
  form.maxInstances = 1
  form.rendererKey = rendererOptions.value[0] || ''
  form.dataSchemaJson = schemaPrefill.value
  form.provenanceUrl = ''
  form.provenanceNote = ''
  drawerOpen.value = true
}

function openEdit(item: LibraryItem) {
  editingId.value = item.row.id
  drawerTitle.value = `改字段结构：${item.row.name}`
  saveError.value = ''
  form.blockKey = item.row.blockKey
  form.name = item.row.name
  form.category = item.row.category
  form.maxInstances = item.row.maxInstances
  // 渲染器这一格在编辑态是禁用的：接口形状上就没有这一格（改渲染器归启用那道闸管）
  form.rendererKey = item.row.rendererKey
  form.dataSchemaJson = JSON.stringify(item.row.dataSchema ?? null, null, 2)
  form.provenanceUrl = item.row.provenanceUrl || ''
  form.provenanceNote = item.row.provenanceNote || ''
  drawerOpen.value = true
}

async function save() {
  if (!canWrite.value) {
    saveError.value = '新建要用的读口没取全（分类、可选渲染器、默认字段结构）：补齐后再提交，这一页不自己兜一份。'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    if (editingId.value === null) {
      const created = await blockDefsApi.create({
        blockKey: form.blockKey.trim(),
        name: form.name,
        category: form.category,
        maxInstances: form.maxInstances,
        rendererKey: form.rendererKey,
        dataSchemaJson: form.dataSchemaJson,
        provenanceUrl: form.provenanceUrl || null,
        provenanceNote: form.provenanceNote || null
      })
      rows.value = [...rows.value, created]
      message.success('已存为未启用：确认这几格填得出内容，再点这一格上的「启用」')
    } else {
      const saved = await blockDefsApi.update(editingId.value, {
        name: form.name,
        category: form.category,
        maxInstances: form.maxInstances,
        dataSchemaJson: form.dataSchemaJson,
        provenanceUrl: form.provenanceUrl || null,
        provenanceNote: form.provenanceNote || null
      })
      replaceRow(saved)
      message.success('已保存：这一份改的是字段结构，已在用它的页面不会被回扫，保存前请自己确认版面')
    }
    drawerOpen.value = false
  } catch (error: any) {
    // 五道闸（key 形状、撞两族的名字、渲染器不在那一族、schema 不合法、列表槽只认绑定）都在后端，
    // 它们已经说了是哪一格、为什么；这里原样念，不重写成一句「保存失败」。
    saveError.value = error?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await load()
  await loadWriteMeta()
})
</script>

<style scoped lang="less">
.block-library {
  padding: 16px;

  &__notice {
    margin-bottom: 12px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
    gap: 16px;
  }

  &__card {
    align-self: start;
  }

  &__name {
    font-weight: 600;
  }

  &__frame {
    max-height: 420px;
    overflow: auto;
    background: #fafafa;
    padding: 8px;
    border-radius: 8px;
  }

  &__trial {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__trial-text {
    font-family: monospace;
    font-size: 12px;
  }

  &__error {
    color: #d4380d;
    font-size: 12px;
    margin: 0;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__props {
    margin: 12px 0 0;
    max-height: 200px;
    overflow: auto;
    background: #fafafa;
    padding: 8px;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
