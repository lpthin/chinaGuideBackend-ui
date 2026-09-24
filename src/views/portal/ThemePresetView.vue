<template>
  <div class="theme-preset-page">
    <a-form layout="inline" class="theme-preset-page__filter">
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
          <a-button v-if="canManage" @click="openSaveSkin">把页面样式沉淀为皮肤</a-button>
          <a-button v-if="canPromote" type="primary" @click="openPromote">沉淀为平台模板</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon class="theme-preset-page__notice">
      <template #message>
        「皮肤」只是一组样式变量（主色/圆角/字号比例等），不含任何文字与内容，可以在自己的页面之间来回应用。
        「平台模板」是超管从某个页面沉淀出来的公共版式：客户文案已被换成演示文本，应用时填的是你们自己的数据。
      </template>
    </a-alert>

    <a-table
      :data-source="presets"
      :columns="columns"
      :loading="loading"
      row-key="id"
      size="middle"
      :scroll="{ x: 1240 }"
      :pagination="{ pageSize: 10, showTotal: (total: number) => `共 ${total} 条` }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'kind'">
          <a-tag :color="record.isPlatform ? 'purple' : 'blue'">
            {{ record.isPlatform ? '平台模板' : '皮肤' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'tokens'">
          <a-space size="4">
            <span
              v-for="color in colorSwatches(record.tokensJson)"
              :key="color.key"
              class="theme-preset-page__swatch"
              :title="`${color.key}: ${color.value}`"
              :style="{ background: color.value }"
            />
            <span class="theme-preset-page__muted">{{ tokenCount(record.tokensJson) }} 项样式变量</span>
          </a-space>
        </template>
        <template v-else-if="column.key === 'blocks'">
          <span v-if="record.layoutJson">{{ blockCount(record.layoutJson) }} 个区块</span>
          <span v-else class="theme-preset-page__muted">—（皮肤不含结构）</span>
        </template>
        <template v-else-if="column.key === 'source'">
          <a v-if="record.provenanceUrl" :href="record.provenanceUrl" target="_blank" rel="noopener noreferrer">
            查看来源
          </a>
          <span v-else-if="record.sourcePageId" class="theme-preset-page__muted">页面 #{{ record.sourcePageId }}</span>
          <span v-else class="theme-preset-page__muted">—</span>
        </template>
        <template v-else-if="column.key === 'approved'">
          <span v-if="record.approvedBy">
            {{ record.approvedBy }}
            <span class="theme-preset-page__muted">{{ formatDateTime(record.approvedAt) }}</span>
          </span>
          <span v-else class="theme-preset-page__muted">—</span>
        </template>
        <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
        <template v-else-if="column.key === 'op'">
          <a-space size="4">
            <a-button v-if="canManage" size="small" type="link" @click="openApply(record)">应用到页面</a-button>
            <a-button
              v-if="canManage && record.isPlatform"
              size="small"
              type="link"
              @click="openInstantiate(record)"
            >
              用此模板建页
            </a-button>
            <a-popconfirm
              v-if="canManage"
              :title="record.isPlatform ? '删除平台模板会影响所有租户，确认删除？' : '确认删除这份沉淀？'"
              @confirm="removePreset(record.id)"
            >
              <a-button size="small" type="link" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>

      <template #expandedRowRender="{ record }">
        <div class="theme-preset-page__detail">
          <div>
            <span class="theme-preset-page__muted">名称：</span>{{ record.name }}
            <span v-if="record.createdBy" class="theme-preset-page__muted">　由 {{ record.createdBy }} 创建</span>
          </div>
          <div>
            <span class="theme-preset-page__muted">样式变量：</span>
            <span v-if="!tokenEntries(record.tokensJson).length">（空）</span>
            <a-space v-else size="4" wrap>
              <a-tag v-for="entry in tokenEntries(record.tokensJson)" :key="entry.key">
                {{ designTokenLabel(entry.key) }}：{{ entry.value }}
              </a-tag>
            </a-space>
          </div>
          <div v-if="record.provenanceNote">
            <span class="theme-preset-page__muted">来源说明：</span>{{ record.provenanceNote }}
          </div>
          <div v-if="strippedItems(record.strippedJson).length">
            <span class="theme-preset-page__muted">沉淀时剥离/替换了：</span>
            <ul class="theme-preset-page__strip">
              <li v-for="(line, index) in strippedItems(record.strippedJson)" :key="index">{{ line }}</li>
            </ul>
          </div>
        </div>
      </template>

      <template #emptyText>
        <a-empty description="还没有沉淀记录：先在页面搭建器里调好样式变量，再回来点「沉淀为皮肤」">
          <template #image><span /></template>
        </a-empty>
      </template>
    </a-table>

    <a-modal v-model:open="saveSkinOpen" title="把页面样式沉淀为皮肤" :confirm-loading="saving" @ok="submitSaveSkin">
      <a-form layout="vertical">
        <a-form-item label="来源页面" required>
          <a-select
            v-model:value="saveSkinForm.pageId"
            :options="pageOptions"
            placeholder="取哪个页面当前保存的样式变量"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item label="皮肤名称" required>
          <a-input v-model:value="saveSkinForm.name" placeholder="例如：诊所蓝 · 大字号" :maxlength="100" />
        </a-form-item>
        <a-form-item>
          <a-alert type="warning" show-icon>
            <template #message>
              沉淀的是页面「已经保存」的样式：搭建器里还没保存的改动不会进来。
            </template>
          </a-alert>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="applyOpen" title="应用皮肤到页面" :confirm-loading="saving" @ok="submitApply">
      <a-form layout="vertical">
        <a-form-item label="皮肤">
          <a-input :value="activePreset?.name" disabled />
        </a-form-item>
        <a-form-item label="目标页面" required>
          <a-select
            v-model:value="applyForm.pageId"
            :options="pageOptions"
            placeholder="选择要换上这套样式的页面"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item>
          <span class="theme-preset-page__muted">
            只替换样式变量，页面结构与文案不动；这次改动会进版本历史（来源：手动），可随时回滚。
          </span>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="instantiateOpen" title="用平台模板新建页面" :confirm-loading="saving" @ok="submitInstantiate">
      <a-form layout="vertical">
        <a-form-item label="站点">
          <a-select v-model:value="instantiateForm.siteId" :options="siteOptions" placeholder="默认当前站点" allow-clear />
        </a-form-item>
        <a-form-item label="slug" required>
          <a-input v-model:value="instantiateForm.slug" placeholder="例如：teshuguanjia" />
        </a-form-item>
        <a-form-item label="页面标题">
          <a-input v-model:value="instantiateForm.title" :placeholder="activePreset?.name || '默认用模板名称'" />
        </a-form-item>
        <a-form-item>
          <a-alert type="warning" show-icon>
            <template #message>
              建出来的是草稿页，文案位置是演示文本；改完内容再自己发布。
            </template>
          </a-alert>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="promoteOpen"
      title="沉淀为平台模板"
      :confirm-loading="saving"
      ok-text="确认沉淀"
      @ok="submitPromote"
    >
      <a-form layout="vertical">
        <a-form-item label="来源页面" required>
          <a-select
            v-model:value="promoteForm.pageId"
            :options="pageOptions"
            placeholder="要沉淀哪个页面（演示页不允许）"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item label="模板名称" required>
          <a-input v-model:value="promoteForm.name" placeholder="例如：口腔门诊 · 标准首页" :maxlength="100" />
        </a-form-item>
        <a-form-item label="来源网址" required>
          <a-input v-model:value="promoteForm.provenanceUrl" placeholder="https://..." :maxlength="500" />
          <template #extra>平台资产必须可反查来源，没有来源不进公共库。</template>
        </a-form-item>
        <a-form-item label="来源说明">
          <a-textarea v-model:value="promoteForm.provenanceNote" :rows="2" placeholder="这套版式参考了什么，近似到什么程度" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="promoteForm.provenanceReviewed">
            我已人工确认版式来源与近似度，可接受它被所有租户复用
          </a-checkbox>
        </a-form-item>
        <a-form-item>
          <a-alert type="error" show-icon>
            <template #message>
              平台模板会被 N 个客户使用：一次侵权结构被复用 N 次，就是风险放大 N 倍。
              客户文案与链接会在服务端被剥离成演示文本，剥离清单记在这一行的审计字段里。
            </template>
          </a-alert>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { themePresetsApi, type ThemePreset } from '../../api/themePresets'
import { portalPagesApi, type PortalPage } from '../../api/portalPages'
import { siteApi } from '../../api/workspace'
import { designTokenLabel } from '../../portal/designTokens'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'

/**
 * 沉淀资产视图（Spec §8.1）。
 *
 * 三条刻意：
 * 1. 「沉淀为平台模板」只对持有 portal:template:promote 的超管显示，且来源网址与人工确认勾选
 *    少一个都提交不了——服务端同样判，界面不负责兜底，但也不能让人漏看；
 * 2. 样式变量的中文名走 portal/designTokens.ts 那一份声明，值域一律由后端判，
 *    界面上出现的是接口回传的中文原因；
 * 3. 应用皮肤不写「成功」两个字之外的结论：它走的是页面结构的正常写入口，会占一个新版本号，
 *    所以成功后顺带把页面列表的版本号刷出来。
 */

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('portal:page:manage'))
const canPromote = computed(() => auth.hasPermission('portal:template:promote'))

const presets = ref<ThemePreset[]>([])
const pages = ref<PortalPage[]>([])
const sites = ref<Array<{ id: number; name: string }>>([])
const loading = ref(false)
const saving = ref(false)

const columns = [
  { title: '编号', dataIndex: 'id', key: 'id', width: 72 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '种类', key: 'kind', width: 110 },
  { title: '样式变量', key: 'tokens', width: 200 },
  { title: '结构', key: 'blocks', width: 140 },
  { title: '来源', key: 'source', width: 140 },
  { title: '审核', key: 'approved', width: 170 },
  { title: '创建时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'op', width: 230, fixed: 'right' as const }
]

const pageOptions = computed(() =>
  pages.value.map(page => ({
    value: page.id,
    label: `${page.title || page.slug || '未命名页面'}（#${page.id} · v${page.version}）`
  }))
)

const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    // 库里的值是服务端校验过才落的，读到这里解析不了就是脏数据：原样让人看见，不当成「没有样式」
    return { 原始值: raw }
  }
}

function tokenEntries(raw: string | null): Array<{ key: string; value: string }> {
  return Object.entries(parseJsonObject(raw)).map(([key, value]) => ({ key, value: String(value) }))
}

function tokenCount(raw: string | null): number {
  return tokenEntries(raw).length
}

function colorSwatches(raw: string | null) {
  return tokenEntries(raw)
    .filter(entry => entry.key.startsWith('color') && entry.value.startsWith('#'))
    .slice(0, 4)
}

function blockCount(layoutJson: string | null): number {
  const blocks = parseJsonObject(layoutJson).blocks
  return Array.isArray(blocks) ? blocks.length : 0
}

function strippedItems(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(item => String(item)) : [String(parsed)]
  } catch {
    return [raw]
  }
}

async function load() {
  loading.value = true
  try {
    const [presetList, pageList] = await Promise.all([themePresetsApi.list(), portalPagesApi.list()])
    presets.value = presetList || []
    pages.value = pageList || []
  } catch (error) {
    message.error((error as Error).message || '沉淀记录加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  try {
    const siteList = await siteApi.list()
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
  } catch {
    // 站点只影响「用模板建页」的默认值，拿不到时该下拉为空，不让它把整页变成错误态
  }
})

function versionOf(pageId: number | null | undefined): number | null {
  if (pageId == null) return null
  return pages.value.find(page => page.id === pageId)?.version ?? null
}

const activePreset = ref<ThemePreset | null>(null)

// ---------------- 沉淀皮肤 ----------------
const saveSkinOpen = ref(false)
const saveSkinForm = reactive<{ pageId: number | null; name: string }>({ pageId: null, name: '' })

function openSaveSkin() {
  saveSkinForm.pageId = null
  saveSkinForm.name = ''
  saveSkinOpen.value = true
}

async function submitSaveSkin() {
  if (!saveSkinForm.pageId || !saveSkinForm.name.trim()) {
    message.warning('请选择页面并填写皮肤名称')
    return
  }
  saving.value = true
  try {
    await themePresetsApi.saveSkin({ pageId: saveSkinForm.pageId, name: saveSkinForm.name.trim() })
    saveSkinOpen.value = false
    message.success('已沉淀为皮肤')
    await load()
  } catch (error) {
    message.error((error as Error).message || '沉淀失败')
  } finally {
    saving.value = false
  }
}

// ---------------- 应用皮肤 ----------------
const applyOpen = ref(false)
const applyForm = reactive<{ pageId: number | null }>({ pageId: null })

function openApply(preset: ThemePreset) {
  activePreset.value = preset
  applyForm.pageId = null
  applyOpen.value = true
}

async function submitApply() {
  const preset = activePreset.value
  const baseVersion = versionOf(applyForm.pageId)
  if (!preset || !applyForm.pageId || baseVersion == null) {
    message.warning('请选择要应用皮肤的页面')
    return
  }
  saving.value = true
  try {
    const updated = await themePresetsApi.apply(preset.id, { pageId: applyForm.pageId, baseVersion })
    applyOpen.value = false
    message.success(`已应用到页面 #${applyForm.pageId}，现在版本为 v${updated.version}`)
    await load()
  } catch (error) {
    message.error((error as Error).message || '应用失败')
  } finally {
    saving.value = false
  }
}

// ---------------- 用模板建页 ----------------
const instantiateOpen = ref(false)
const instantiateForm = reactive<{ siteId: number | null; slug: string; title: string }>({
  siteId: null,
  slug: '',
  title: ''
})

function openInstantiate(preset: ThemePreset) {
  activePreset.value = preset
  instantiateForm.siteId = null
  instantiateForm.slug = ''
  instantiateForm.title = ''
  instantiateOpen.value = true
}

async function submitInstantiate() {
  const preset = activePreset.value
  if (!preset || !instantiateForm.slug.trim()) {
    message.warning('请填写页面 slug')
    return
  }
  saving.value = true
  try {
    const created = await themePresetsApi.instantiate(preset.id, {
      siteId: instantiateForm.siteId,
      slug: instantiateForm.slug.trim(),
      title: instantiateForm.title.trim() || null
    })
    instantiateOpen.value = false
    message.success(`草稿页已创建（#${created.id}），请在页面搭建器里改内容后发布`)
    await load()
  } catch (error) {
    message.error((error as Error).message || '建页失败')
  } finally {
    saving.value = false
  }
}

// ---------------- 平台级沉淀 ----------------
const promoteOpen = ref(false)
const promoteForm = reactive<{
  pageId: number | null
  name: string
  provenanceUrl: string
  provenanceNote: string
  provenanceReviewed: boolean
}>({ pageId: null, name: '', provenanceUrl: '', provenanceNote: '', provenanceReviewed: false })

function openPromote() {
  promoteForm.pageId = null
  promoteForm.name = ''
  promoteForm.provenanceUrl = ''
  promoteForm.provenanceNote = ''
  promoteForm.provenanceReviewed = false
  promoteOpen.value = true
}

async function submitPromote() {
  if (!promoteForm.pageId || !promoteForm.name.trim()) {
    message.warning('请选择页面并填写模板名称')
    return
  }
  if (!promoteForm.provenanceUrl.trim() || !promoteForm.provenanceReviewed) {
    message.warning('来源网址与「已人工确认」缺一不可：平台资产会被所有租户复用')
    return
  }
  saving.value = true
  try {
    const created = await themePresetsApi.promote({
      pageId: promoteForm.pageId,
      name: promoteForm.name.trim(),
      provenanceUrl: promoteForm.provenanceUrl.trim(),
      provenanceNote: promoteForm.provenanceNote.trim() || null,
      provenanceReviewed: true
    })
    promoteOpen.value = false
    message.success(`已沉淀为平台模板（#${created.id}），剥离项 ${strippedItems(created.strippedJson).length} 条`)
    await load()
  } catch (error) {
    message.error((error as Error).message || '沉淀失败')
  } finally {
    saving.value = false
  }
}

async function removePreset(id: number) {
  try {
    await themePresetsApi.remove(id)
    message.success('已删除')
    await load()
  } catch (error) {
    message.error((error as Error).message || '删除失败')
  }
}
</script>

<style scoped>
.theme-preset-page__filter {
  margin-bottom: 12px;
}

.theme-preset-page__notice {
  margin-bottom: 12px;
}

.theme-preset-page__muted {
  color: rgba(0, 0, 0, 0.45);
  margin-left: 4px;
}

.theme-preset-page__swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.theme-preset-page__detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-preset-page__strip {
  margin: 4px 0 0;
  padding-left: 20px;
}
</style>
