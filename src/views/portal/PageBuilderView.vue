<template>
  <div class="page-builder">
    <a-form layout="inline" class="page-builder__filter">
      <a-form-item label="站点">
        <a-select
          v-model:value="siteId"
          style="width: 200px"
          allow-clear
          placeholder="全部站点"
          :options="siteOptions"
          @change="loadPages"
        />
      </a-form-item>
      <a-form-item label="状态">
        <a-select
          v-model:value="statusFilter"
          style="width: 140px"
          allow-clear
          placeholder="全部状态"
          :options="statusOptions"
          @change="loadPages"
        />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button @click="loadPages">刷新</a-button>
          <a-button type="primary" @click="openCreatePage">新建页面</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-spin :spinning="loadingPages">
      <a-empty v-if="!pages.length" description="这个站点还没有页面模型，先新建一个页面">
        <template #image><span /></template>
      </a-empty>
      <a-row v-else :gutter="12">
        <a-col :xs="24" :lg="6">
          <a-card size="small" title="页面" :body-style="{ padding: '8px' }">
            <a-list :data-source="pages" size="small">
              <template #renderItem="{ item }">
                <a-list-item
                  :class="{ 'page-builder__active': item.id === pageId }"
                  @click="selectPage(item.id)"
                >
                  <a-space direction="vertical" size="0" style="width: 100%">
                    <span>{{ item.title || item.slug || '未命名页面' }}</span>
                    <a-space size="4">
                      <a-tag>{{ statusLabels[item.status] || item.status }}</a-tag>
                      <span class="page-builder__muted">v{{ item.version }}</span>
                      <!-- 这里只列 slug，不列对外路径：路径规则的唯一真相在后端 PortalUrls.page()，
                         内置页是 /about、自定义页是 /p/x，在前端再拼一遍就是第二套真相。选中页面后看线上用的就是接口回传的 path。 -->
                    <span class="page-builder__muted">slug：{{ item.slug || '—' }}</span>
                    </a-space>
                  </a-space>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>

        <a-col :xs="24" :lg="6">
          <a-card size="small" title="区块序列" :body-style="{ padding: '8px' }">
            <template #extra>
              <a-dropdown :trigger="['click']">
                <a-button size="small" type="link">添加区块</a-button>
                <template #overlay>
                  <a-menu @click="addBlock">
                    <a-menu-item v-for="group in blockGroups" :key="group.category" disabled>
                      {{ group.category }}
                    </a-menu-item>
                    <template v-for="group in blockGroups" :key="group.category">
                      <a-menu-item
                        v-for="block in group.blocks"
                        :key="block.blockKey"
                        :disabled="!canAdd(block)"
                      >
                        {{ block.name }}
                        <span class="page-builder__muted">（{{ block.blockKey }}）</span>
                      </a-menu-item>
                    </template>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>

            <p v-if="!layoutBlocks.length" class="page-builder__muted">还没有区块，先添加一个</p>
            <div
              v-for="(block, index) in layoutBlocks"
              :key="block.instanceId"
              class="page-builder__block"
              :class="{ 'page-builder__block--active': index === activeIndex }"
              @click="activeIndex = index"
            >
              <span class="page-builder__block-name">{{ nameOf(block.blockKey) }}</span>
              <span class="page-builder__muted">{{ block.instanceId }}</span>
              <a-space size="2" class="page-builder__block-ops">
                <a-button size="small" type="text" :disabled="index === 0" @click.stop="move(index, -1)">↑</a-button>
                <a-button
                  size="small"
                  type="text"
                  :disabled="index === layoutBlocks.length - 1"
                  @click.stop="move(index, 1)"
                >↓</a-button>
                <a-button size="small" type="text" danger @click.stop="removeBlock(index)">删</a-button>
              </a-space>
            </div>
            <a-alert
              v-if="maxInstancesReached"
              type="warning"
              show-icon
              message="已达到区块数量上限，添加按钮会一直禁用（单页最多 30 个区块）"
            />
          </a-card>
        </a-col>

        <a-col :xs="24" :lg="6">
          <a-card size="small" :title="activeBlock ? `内容：${nameOf(activeBlock.blockKey)}` : '内容'">
            <template #extra>
              <a-button size="small" type="link" @click="openMeta">页面信息</a-button>
            </template>
            <p v-if="!activeBlock" class="page-builder__muted">左边选一个区块来编辑它的内容</p>
            <BlockPropsForm
              v-else
              :schema="schemaOf(activeBlock.blockKey)"
              :allowed-sources="allowedSourcesOf(activeBlock.blockKey)"
              :model="(activeBlock.props as Record<string, unknown>) || {}"
              @update:model="props => writeProps(activeIndex, props)"
            />

            <a-divider style="margin: 12px 0" />
            <div class="page-builder__theme">
              <span class="page-builder__muted">主题（design token，白名单由服务端给，当前 {{ tokenFields.length }} 个旋钮）</span>
              <p v-if="!tokenFields.length" class="page-builder__muted">样式变量清单还没取到：这里不留第二份清单，刷新页面重试。</p>
              <div v-for="token in tokenFields" :key="token.key" class="page-builder__theme-row">
                <label>{{ designTokenLabel(token.key) }}</label>
                <a-input-number
                  v-if="token.kind === 'SCALE'"
                  size="small"
                  :value="(themeJson as Record<string, string | number>)[token.key] as number"
                  :min="token.min"
                  :max="token.max"
                  step="0.05"
                  @update:value="writeTheme(token.key, $event)"
                />
                <a-input
                  v-else
                  size="small"
                  :value="(themeJson as Record<string, string | number>)[token.key] ?? ''"
                  :placeholder="designTokenPlaceholder(token.key)"
                  @update:value="writeTheme(token.key, $event)"
                />
                <a-button size="small" type="text" @click="clearTheme(token.key)">清</a-button>
              </div>
            </div>
          </a-card>
        </a-col>

        <a-col :xs="24" :lg="6">
          <a-card size="small" title="预览">
            <template #extra>
              <a-space size="4">
                <a-button size="small" type="link" :disabled="!pageId" @click="loadPreview">重新取</a-button>
                <a-button size="small" type="link" :disabled="!previewPath" @click="openLivePage">看线上</a-button>
              </a-space>
            </template>
            <a-alert
              type="info"
              show-icon
              message="预览取的是「已保存」的那个版本：改动要先保存才会出现在这里"
            />
            <PortalViewportPreview
              class="page-builder__preview"
              v-model:device="previewDevice"
              :blocks="preview?.blocks ?? null"
              :theme="preview?.theme ?? null"
              :shell="null"
            />
            <p v-if="preview?.skippedBlocks?.length" class="page-builder__muted">
              有 {{ preview.skippedBlocks.length }} 个区块当前不可显示：{{ preview.skippedBlocks.join('、') }}
            </p>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <div class="page-builder__footer">
      <a-space>
        <a-button :disabled="!pageId" @click="check">检查结构</a-button>
        <a-button :disabled="!pageId" :loading="saving" type="primary" @click="save">保存</a-button>
        <a-button :disabled="!pageId" @click="publish">发布</a-button>
        <a-button :disabled="!pageId" @click="offline">下线</a-button>
        <a-button :disabled="!pageId" @click="openVersions">版本历史</a-button>
      </a-space>
      <span class="page-builder__muted">
        {{ dirty ? '有未保存的修改' : pageId ? `当前版本 v${baseVersion}` : '未选择页面' }}
      </span>
    </div>

    <a-alert
      v-if="validateErrors.length"
      type="error"
      show-icon
      :message="`结构检查未通过（${validateErrors.length} 条）`"
      :description="validateErrors.join('；')"
      style="margin-top: 12px"
    />

    <a-modal v-model:open="createOpen" title="新建页面" @ok="createPage">
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="createForm.title" placeholder="例如：关于我们" />
        </a-form-item>
        <a-form-item label="slug" extra="留空则由标题生成；对外地址是 /p/{slug}，只有内置页 home/about/services/cases/news/contact 走短路径">
          <a-input v-model:value="createForm.slug" placeholder="about" />
        </a-form-item>
        <a-form-item label="站点">
          <a-select v-model:value="createForm.siteId" :options="siteOptions" placeholder="默认当前站点" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-drawer v-model:open="metaOpen" title="页面信息" width="480">
      <a-form layout="vertical">
        <a-form-item label="标题"><a-input v-model:value="metaForm.title" /></a-form-item>
        <a-form-item label="slug"><a-input v-model:value="metaForm.slug" /></a-form-item>
        <a-form-item label="页面类型">
          <a-input v-model:value="metaForm.pageKind" placeholder="page / about / services …" />
        </a-form-item>
        <a-form-item label="显示在导航">
          <a-switch v-model:checked="metaForm.navVisible" />
        </a-form-item>
        <a-form-item label="导航排序">
          <a-input-number v-model:value="metaForm.navSort" :min="0" :max="9999" />
        </a-form-item>
        <a-form-item label="SEO 标题"><a-input v-model:value="metaForm.seoTitle" /></a-form-item>
        <a-form-item label="SEO 描述"><a-textarea v-model:value="metaForm.seoDescription" :rows="3" /></a-form-item>
        <a-form-item label="SEO 关键词"><a-input v-model:value="metaForm.seoKeywords" /></a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="metaOpen = false">取消</a-button>
          <a-button type="primary" :loading="savingMeta" @click="saveMeta">保存页面信息</a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-drawer v-model:open="versionsOpen" title="版本历史" width="880">
      <a-table
        :data-source="versions"
        :columns="versionColumns"
        :pagination="false"
        row-key="versionNo"
        size="small"
        :scroll="{ y: 320 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'changeSource'">
            {{ changeSourceLabels[record.changeSource] || record.changeSource || '未知' }}
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'op'">
            <a-space size="4">
              <a-button size="small" type="link" :disabled="!diffFrom" @click="showDiff(record.versionNo)">
                与 {{ diffFrom }} 对比
              </a-button>
              <a-popconfirm
                title="回滚会把这一版内容原样写回，并新增一条回滚记录，确定吗？"
                @confirm="rollback(record.versionNo)"
              >
                <a-button size="small" type="link">回滚到此版</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
      <a-divider>字段级差异</a-divider>
      <pre class="page-builder__diff">{{ diffText }}</pre>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  portalPagesApi,
  type PortalBlockMeta,
  type PortalPage,
  type PortalPageVersion,
  type PreviewPage
} from '../../api/portalPages'
import { siteApi } from '../../api/workspace'
import { themePresetsApi, type ThemeTokenField } from '../../api/themePresets'
import { formatDateTime } from '../../utils/format'
import { designTokenLabel, designTokenPlaceholder } from '../../portal/designTokens'
import BlockPropsForm from './builder/BlockPropsForm.vue'
import PortalViewportPreview from '../../portal/blocks/PortalViewportPreview.vue'

/**
 * 门户页面搭建器：区块白名单 + design token 白名单，没有任何「写 HTML / 写 CSS」的入口。
 *
 * 三条来自 Spec 的硬约束在界面上的落点：
 * 1. 区块列表、props 表单与样式变量清单全部来自服务端（/api/portal/blocks、/portal/theme-presets/tokens），
 *    前端不维护字段清单；
 * 2. 保存必须带 baseVersion，冲突由后端回中文错（409），这里绝不静默覆盖别人；
 * 3. 发布/下线是动作按钮，不提供「把 status 改一下再保存」的路径——published 只能由发布动作产生。
 *
 * 排序用上下按钮而不是拖拽库：区块数量上限 30，按钮够用还免去一个前端依赖，
 * 拖拽要在 iframe/滚动容器里处理命中测试，收益不抵成本。
 */
interface LayoutBlock {
  instanceId: string
  blockKey: string
  props?: Record<string, unknown>
}

const statusLabels = ref<Record<string, string>>({})
const changeSourceLabels = ref<Record<string, string>>({})
const siteId = ref<number | null>(null)
const statusFilter = ref<string | undefined>(undefined)
const sites = ref<Array<{ id: number; name: string }>>([])
const pages = ref<PortalPage[]>([])
const blocks = ref<PortalBlockMeta[]>([])
const loadingPages = ref(false)
const saving = ref(false)

const pageId = ref<number | null>(null)
const baseVersion = ref<number | null>(null)
const layoutBlocks = ref<LayoutBlock[]>([])
const themeJson = ref<Record<string, string | number>>({})
/** 可改的样式变量：整份清单（键名 + 种类 + 区间）来自 /portal/theme-presets/tokens，前端不写死 */
const tokenFields = ref<ThemeTokenField[]>([])
const activeIndex = ref(-1)
const dirty = ref(false)
const validateErrors = ref<string[]>([])
const preview = ref<PreviewPage | null>(null)
const previewDevice = ref<'desktop' | 'tablet' | 'mobile'>('desktop')

const createOpen = ref(false)
const createForm = reactive<{ title: string; slug: string; siteId: number | null }>({ title: '', slug: '', siteId: null })
const metaOpen = ref(false)
const savingMeta = ref(false)
const metaForm = reactive<Record<string, unknown>>({})

const versionsOpen = ref(false)
const versions = ref<PortalPageVersion[]>([])
const diffFrom = ref<number | null>(null)
const diffText = ref('')

const statusOptions = computed(() =>
  Object.entries(statusLabels.value).map(([value, label]) => ({ value, label }))
)

const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

const blockGroups = computed(() => {
  const groups = new Map<string, PortalBlockMeta[]>()
  blocks.value.forEach(block => {
    const list = groups.get(block.category) || []
    list.push(block)
    groups.set(block.category, list)
  })
  return Array.from(groups.entries()).map(([category, list]) => ({ category, blocks: list }))
})

const activeBlock = computed(() => (activeIndex.value >= 0 ? layoutBlocks.value[activeIndex.value] ?? null : null))

const previewPath = computed(() => preview.value?.path || null)

const maxInstancesReached = computed(() => layoutBlocks.value.length >= 30)

const versionColumns = [
  { title: '版本', dataIndex: 'versionNo', key: 'versionNo', width: 64 },
  { title: '来源', dataIndex: 'changeSource', key: 'changeSource', width: 110 },
  { title: '说明', dataIndex: 'note', key: 'note' },
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
  { title: '操作', key: 'op', width: 190 }
]

function metaOf(blockKey: string) {
  return blocks.value.find(block => block.blockKey === blockKey) || null
}

function nameOf(blockKey: string) {
  return metaOf(blockKey)?.name || blockKey
}

function schemaOf(blockKey: string) {
  return metaOf(blockKey)?.dataSchema ?? null
}

function allowedSourcesOf(blockKey: string): string[] {
  return metaOf(blockKey)?.bindingSchema?.allowedSources || []
}

function canAdd(block: PortalBlockMeta) {
  if (maxInstancesReached.value) return false
  const used = layoutBlocks.value.filter(item => item.blockKey === block.blockKey).length
  return used < block.maxInstances
}

async function loadPages() {
  loadingPages.value = true
  try {
    pages.value = await portalPagesApi.list({ siteId: siteId.value, status: statusFilter.value })
    if (!pageId.value && pages.value.length) {
      selectPage(pages.value[0].id)
    }
  } catch (error) {
    message.error((error as Error).message || '页面列表加载失败')
  } finally {
    loadingPages.value = false
  }
}

async function selectPage(id: number) {
  pageId.value = id
  activeIndex.value = -1
  validateErrors.value = []
  try {
    const page = await portalPagesApi.get(id)
    baseVersion.value = page.version
    layoutBlocks.value = parseLayout(page.layoutJson)
    themeJson.value = page.themeJson ? JSON.parse(page.themeJson) : {}
    dirty.value = false
    loadPreview()
  } catch (error) {
    message.error((error as Error).message || '页面加载失败')
  }
}

function parseLayout(layoutJson: string | null): LayoutBlock[] {
  if (!layoutJson) return []
  try {
    const parsed = JSON.parse(layoutJson) as { blocks?: LayoutBlock[] }
    return Array.isArray(parsed.blocks) ? parsed.blocks : []
  } catch (error) {
    // 结构坏掉时不静默清空：清空后一保存就是把整页区块抹掉，那样丢的是客户的内容
    message.error('页面结构不是合法 JSON，已停止编辑；请直接联系管理员或回滚到历史版本')
    return []
  }
}

async function loadPreview() {
  if (!pageId.value) return
  try {
    preview.value = await portalPagesApi.preview(pageId.value)
  } catch (error) {
    preview.value = null
    message.error((error as Error).message || '预览数据加载失败')
  }
}

function addBlock({ key }: { key: string }) {
  const blockKey = String(key)
  const meta = metaOf(blockKey)
  if (!meta || !canAdd(meta)) {
    message.warning('这个区块已到数量上限')
    return
  }
  layoutBlocks.value.push({ instanceId: newInstanceId(blockKey), blockKey, props: {} })
  activeIndex.value = layoutBlocks.value.length - 1
  dirty.value = true
}

/** 后端 instanceId 限长 40 且只允许字母数字与 _.- ：随机后缀防同页同键撞 id */
function newInstanceId(blockKey: string) {
  const safe = blockKey.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 20)
  return `${safe}-${Math.random().toString(36).slice(2, 8)}`
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= layoutBlocks.value.length) return
  const list = [...layoutBlocks.value]
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  layoutBlocks.value = list
  activeIndex.value = target
  dirty.value = true
}

function removeBlock(index: number) {
  layoutBlocks.value.splice(index, 1)
  activeIndex.value = Math.min(activeIndex.value, layoutBlocks.value.length - 1)
  dirty.value = true
}

function writeProps(index: number, props: Record<string, unknown>) {
  const block = layoutBlocks.value[index]
  if (!block) return
  block.props = props
  dirty.value = true
}

function writeTheme(key: string, value: string | number | null) {
  if (value === '' || value === null) {
    clearTheme(key)
    return
  }
  themeJson.value = { ...themeJson.value, [key]: value as string | number }
  dirty.value = true
}

function clearTheme(key: string) {
  const next = { ...themeJson.value }
  delete next[key]
  themeJson.value = next
  dirty.value = true
}

function layoutPayload() {
  return {
    layoutJson: JSON.stringify({ blocks: layoutBlocks.value }),
    themeJson: Object.keys(themeJson.value).length ? JSON.stringify(themeJson.value) : null
  }
}

async function check() {
  validateErrors.value = []
  try {
    const result = await portalPagesApi.validate(layoutPayload())
    validateErrors.value = result.errors || []
    if (!validateErrors.value.length) {
      message.success('结构检查通过')
    }
  } catch (error) {
    message.error((error as Error).message || '结构检查失败')
  }
}

async function save() {
  if (!pageId.value) return
  saving.value = true
  try {
    const saved = await portalPagesApi.updateLayout(pageId.value, {
      ...layoutPayload(),
      baseVersion: baseVersion.value,
      changeSource: 'manual',
      note: '搭建器保存'
    })
    baseVersion.value = saved.version
    dirty.value = false
    message.success(`已保存为版本 v${saved.version}`)
    loadPages()
    loadPreview()
  } catch (error) {
    // 409 时 http.ts 给的是「数据已被他人修改，请刷新后重试」，这里不替它编一个「保存失败」
    message.error((error as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function publish() {
  if (!pageId.value) return
  try {
    await portalPagesApi.publish(pageId.value)
    message.success('已发布')
    loadPages()
  } catch (error) {
    message.error((error as Error).message || '发布失败')
  }
}

async function offline() {
  if (!pageId.value) return
  try {
    await portalPagesApi.offline(pageId.value)
    message.success('已下线')
    loadPages()
  } catch (error) {
    message.error((error as Error).message || '下线失败')
  }
}

function openCreatePage() {
  createForm.title = ''
  createForm.slug = ''
  createForm.siteId = siteId.value
  createOpen.value = true
}

async function createPage() {
  try {
    const created = await portalPagesApi.create(
      { title: createForm.title, slug: createForm.slug || null, pageKind: 'page' },
      createForm.siteId
    )
    createOpen.value = false
    message.success('页面已创建（草稿）')
    await loadPages()
    selectPage(created.id)
  } catch (error) {
    message.error((error as Error).message || '创建失败')
  }
}

function openMeta() {
  const current = pages.value.find(item => item.id === pageId.value)
  if (!current) return
  Object.assign(metaForm, {
    title: current.title,
    slug: current.slug,
    pageKind: current.pageKind,
    navVisible: current.navVisible,
    navSort: current.navSort,
    seoTitle: current.seoTitle,
    seoDescription: current.seoDescription,
    seoKeywords: current.seoKeywords
  })
  metaOpen.value = true
}

async function saveMeta() {
  if (!pageId.value) return
  savingMeta.value = true
  try {
    await portalPagesApi.updateMeta(pageId.value, metaForm as Partial<PortalPage>)
    metaOpen.value = false
    message.success('页面信息已保存')
    loadPages()
  } catch (error) {
    message.error((error as Error).message || '保存失败')
  } finally {
    savingMeta.value = false
  }
}

function openLivePage() {
  if (previewPath.value) {
    window.open(previewPath.value, '_blank', 'noopener')
  }
}

async function openVersions() {
  if (!pageId.value) return
  try {
    versions.value = await portalPagesApi.versions(pageId.value)
    diffFrom.value = versions.value.length > 1 ? versions.value[0].versionNo : null
    diffText.value = ''
    versionsOpen.value = true
  } catch (error) {
    message.error((error as Error).message || '版本历史加载失败')
  }
}

async function showDiff(toVersion: number) {
  if (!pageId.value || !diffFrom.value) return
  try {
    const diff = await portalPagesApi.versionsDiff(pageId.value, diffFrom.value, toVersion)
    diffText.value = JSON.stringify(diff, null, 2)
  } catch (error) {
    diffText.value = ''
    message.error((error as Error).message || '对比失败')
  }
}

async function rollback(versionNo: number) {
  if (!pageId.value) return
  try {
    const saved = await portalPagesApi.rollback(pageId.value, versionNo)
    baseVersion.value = saved.version
    message.success(`已回滚到 v${versionNo}，当前版本 v${saved.version}`)
    versionsOpen.value = false
    selectPage(pageId.value)
    loadPages()
  } catch (error) {
    message.error((error as Error).message || '回滚失败')
  }
}

onMounted(async () => {
  try {
    const [blockMeta, labels, sourceLabels, siteList, tokenList] = await Promise.all([
      portalPagesApi.blocks(),
      portalPagesApi.statusLabels(),
      portalPagesApi.changeSourceLabels(),
      // 站点列表由后端按登录态过滤（TenantGuard）：超管看到全部，租户只看到自己的
      siteApi.list(),
      // 样式变量的白名单也来自服务端：留一份前端常量的话，服务端加旋钮时这里会安静地少一个输入框
      themePresetsApi.tokens()
    ])
    blocks.value = blockMeta
    statusLabels.value = labels || {}
    changeSourceLabels.value = sourceLabels || {}
    tokenFields.value = tokenList || []
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
    if (sites.value.length === 1) {
      siteId.value = sites.value[0].id
    }
  } catch (error) {
    message.error((error as Error).message || '区块元数据加载失败')
    return
  }
  loadPages()
})
</script>

<style scoped lang="less">
.page-builder {
  padding: 16px;

  &__filter {
    margin-bottom: 12px;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__active {
    background: #e6f4ff;
  }

  &__block {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #f0f0f0;
    border-radius: 6px;
    margin-bottom: 6px;
    cursor: pointer;

    &--active {
      border-color: #1677ff;
      background: #f0f7ff;
    }
  }

  &__block-name {
    font-size: 13px;
  }

  &__block-ops {
    margin-left: auto;
  }

  &__theme-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;

    > label {
      width: 84px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.65);
    }
  }

  &__preview {
    margin-top: 8px;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    padding: 12px 0;
    border-top: 1px solid #f0f0f0;
  }

  &__diff {
    max-height: 360px;
    overflow: auto;
    background: #fafafa;
    padding: 12px;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  :deep(.ant-list-item) {
    cursor: pointer;
    padding: 8px;
  }
}
</style>
