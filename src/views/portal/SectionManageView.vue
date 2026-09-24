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
      </template>
    </a-alert>

    <a-alert v-if="loadError" type="error" show-icon class="section-admin-page__notice" :message="loadError" />

    <a-table
      :data-source="rows"
      :columns="columns"
      :loading="loading"
      row-key="key"
      size="middle"
      :pagination="false"
      :scroll="{ x: 1080 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'displayName'">
          <a-input v-model:value="draft(record.key).displayName" :placeholder="record.displayName"
                   style="width: 160px" />
        </template>
        <template v-else-if="column.key === 'publicPath'">
          <a :href="record.publicPath" target="_blank" rel="noopener">{{ record.publicPath }}</a>
        </template>
        <template v-else-if="column.key === 'enabled'">
          <a-switch :checked="draft(record.key).enabled" @change="(v: boolean) => onEnabledChange(record.key, v)" />
        </template>
        <template v-else-if="column.key === 'navVisible'">
          <a-switch :checked="draft(record.key).navVisible"
                    :disabled="!draft(record.key).enabled"
                    @change="(v: boolean) => draft(record.key).navVisible = v" />
        </template>
        <template v-else-if="column.key === 'navSort'">
          <a-input-number v-model:value="draft(record.key).navSort" :min="1" style="width: 90px" />
        </template>
        <template v-else-if="column.key === 'landing'">
          <a-tag v-if="record.landingPageId" color="green">有已发布页</a-tag>
          <a-tag v-else color="orange">没有落地页</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="primary" size="small" :disabled="!dirty(record.key)" :loading="savingKey === record.key"
                      @click="save(record)">保存</a-button>
            <a-button size="small" :disabled="!dirty(record.key)" @click="reset(record)">还原</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { portalSectionsApi, type SectionForm, type SectionState } from '../../api/portalSections'
import { siteApi } from '../../api/workspace'

/**
 * 超管栏目开关（Spec §5.2 / §7.2，N5：栏目归超管）。
 *
 * 三处刻意：
 * 1. 行集合、显示名占位、对外地址全来自 `GET /api/admin/sites/{id}/sections`，这一页没有第二份栏目清单；
 * 2. 「上导航」那个开关在栏目关掉时置灰——栏目都关了还谈导航可见性是假选项，
 *    两个开关的数据仍是分开落库的（开着但不上导航是合法态）；
 * 3. 保存只发改动的那几项（后端 null 表示不动），所以「还原」就是把草稿改回接口回显的值，
 *    不需要额外一个撤销端点。
 */

const columns = [
  { title: '栏目', dataIndex: 'displayName', key: 'displayName' },
  { title: '对外地址', dataIndex: 'publicPath', key: 'publicPath' },
  { title: '开通', dataIndex: 'enabled', key: 'enabled' },
  { title: '上导航', dataIndex: 'navVisible', key: 'navVisible' },
  { title: '导航顺序', dataIndex: 'navSort', key: 'navSort' },
  { title: '落地页', dataIndex: 'landing', key: 'landing' },
  { title: '操作', dataIndex: 'action', key: 'action' }
]

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
const savingKey = ref('')
const loadError = ref('')

const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

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

async function load() {
  if (siteId.value === null) {
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const states = await portalSectionsApi.adminList(siteId.value)
    rows.value = states
    states.forEach(state => {
      drafts[state.key] = {
        displayName: state.displayName,
        enabled: state.enabled,
        navVisible: state.navVisible,
        navSort: state.navSort
      }
    })
  } catch (error: any) {
    loadError.value = error?.message || '栏目读取失败'
  } finally {
    loading.value = false
  }
}

async function save(record: SectionState) {
  if (siteId.value === null) {
    return
  }
  const current = draft(record.key)
  const form: SectionForm = {
    displayName: current.displayName === record.displayName ? null : current.displayName,
    enabled: current.enabled === record.enabled ? null : current.enabled,
    navVisible: current.navVisible === record.navVisible ? null : current.navVisible,
    navSort: current.navSort === record.navSort ? null : current.navSort
  }
  savingKey.value = record.key
  try {
    const updated = await portalSectionsApi.adminUpdate(siteId.value, record.key, form)
    rows.value = rows.value.map(row => (row.key === record.key ? updated : row))
    // 显示名清空时后端会回落到词表默认名，草稿得跟着这次回显走，否则输入框里留着空白
    drafts[record.key] = {
      displayName: updated.displayName,
      enabled: updated.enabled,
      navVisible: updated.navVisible,
      navSort: updated.navSort
    }
    message.success(`「${updated.displayName}」已更新`)
  } catch (error: any) {
    message.error(error?.message || '栏目保存失败')
  } finally {
    savingKey.value = ''
  }
}

function reset(record: SectionState) {
  drafts[record.key] = {
    displayName: record.displayName,
    enabled: record.enabled,
    navVisible: record.navVisible,
    navSort: record.navSort
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
}
</style>
