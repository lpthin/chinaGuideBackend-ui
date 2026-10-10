<template>
  <div class="spec-diff">
    <a-spin :spinning="loadingVersions">
      <a-descriptions :column="2" size="small" bordered>
        <a-descriptions-item label="主表现状">
          {{ versions?.statusLabel || '读不出来' }}（第 {{ versions?.currentVersion ?? 0 }} 版）
        </a-descriptions-item>
        <a-descriptions-item label="存档份数">
          {{ versions ? versions.versions.length : '没读到' }} 份
        </a-descriptions-item>
      </a-descriptions>

      <ul v-if="versionNotices.length" class="spec-diff__notices">
        <li v-for="line in versionNotices" :key="line">{{ line }}</li>
      </ul>

      <a-table
        v-if="versions && versions.versions.length"
        size="small"
        row-key="specVersion"
        :columns="columns"
        :data-source="versions.versions"
        :pagination="false"
        class="spec-diff__table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'specVersion'">
            第 {{ record.specVersion }} 版
            <a-tag v-if="record.current" color="green">就是现在</a-tag>
          </template>
          <template v-else-if="column.key === 'confirmedAt'">
            {{ formatDateTime(record.confirmedAt) }}
          </template>
        </template>
      </a-table>
    </a-spin>

    <a-alert v-if="versions && !versions.versions.length" type="info" show-icon class="spec-diff__notice">
      <template #message>
        存档里一份都没有，就没有可比对的「旧版」：这一屏下面不演任何差异。
        确认一次会存一份，存下第二份之后这里就能两版对着看了。
      </template>
    </a-alert>

    <template v-if="versions && versions.versions.length">
      <div class="spec-diff__pick">
        <a-select
          v-model:value="fromVersion"
          :options="archiveOptions"
          style="width: 200px"
          placeholder="从第几版起"
        />
        <span class="spec-diff__arrow">→</span>
        <a-select
          v-model:value="toVersion"
          :options="targetOptions"
          style="width: 200px"
          placeholder="到哪一版"
        />
        <a-button type="primary" :loading="loadingDiff" :disabled="fromVersion === null" @click="runDiff">
          比对
        </a-button>
      </div>

      <a-alert v-if="diffError" type="error" show-icon class="spec-diff__notice">
        <template #message>没比对出来（后端原话：{{ diffError }}）</template>
      </a-alert>

      <a-spin :spinning="loadingDiff">
        <template v-if="diff">
          <ul v-if="diff.notices.length" class="spec-diff__notices">
            <li v-for="line in diff.notices" :key="line">{{ line }}</li>
          </ul>

          <div v-for="section in diff.sections" :key="section.key" class="spec-diff__section">
            <div class="spec-diff__section-head">
              <span class="spec-diff__section-title">{{ section.title }}</span>
              <a-tag v-if="section.changed" color="blue">改了</a-tag>
              <a-tag v-else>未变</a-tag>
              <span class="spec-diff__delta">{{ deltaOf(section) }}</span>
            </div>
            <div class="spec-diff__columns">
              <div class="spec-diff__col">
                <div class="spec-diff__col-label">{{ diff.fromLabel }} · {{ section.charCountFrom }} 字</div>
                <pre class="spec-diff__body">{{ section.contentFrom || '（这一版这一段是空的）' }}</pre>
              </div>
              <div class="spec-diff__col">
                <div class="spec-diff__col-label">{{ diff.toLabel }} · {{ section.charCountTo }} 字</div>
                <pre class="spec-diff__body">{{ section.contentTo || '（现在这一段是空的）' }}</pre>
              </div>
            </div>
          </div>
        </template>
      </a-spin>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { siteSpecApi, type SpecDiffView, type SpecSectionDiff, type SpecVersionsView } from '../../api/siteSpec'
import { formatDateTime } from '../../utils/format'

/**
 * 说明书版本对比（Spec-M P5 缺口 B 的前端那一半，V178 存档的读取口）。
 *
 * 三条刻意：
 * 1. 段名、顺序、哪一段变了、两侧各多少字，全部来自后端那一份 diff 回包：这里不抄段清单，也不自己数字；
 * 2. 「现在这一版」是一个不带 to 的请求，读的是主表全文（含还没签字的改动）——
 *    界面上明说这一点，不然人会以为右边那一栏是签过字的；
 * 3. 存档为空时整屏下面不演：差异判定要有两份原文，一份都没有就是没有，不拿空表糊出「七段逐字一致」。
 */

const props = defineProps<{ briefId: number }>()

const versions = ref<SpecVersionsView | null>(null)
const diff = ref<SpecDiffView | null>(null)
const loadingVersions = ref(false)
const loadingDiff = ref(false)
const versionsError = ref('')
const diffError = ref('')
const fromVersion = ref<number | null>(null)
const toVersion = ref<number | null>(null)

const columns = [
  { title: '版本', key: 'specVersion', dataIndex: 'specVersion' },
  { title: '签字人', key: 'confirmedBy', dataIndex: 'confirmedBy' },
  { title: '签字时间', key: 'confirmedAt', dataIndex: 'confirmedAt' },
  { title: '写了几段', key: 'filledSections', dataIndex: 'filledSections' },
  { title: '一共多少字', key: 'totalChars', dataIndex: 'totalChars' }
]

const archiveOptions = computed(() =>
  (versions.value?.versions ?? []).map(row => ({
    label: `第 ${row.specVersion} 版（${row.totalChars} 字）`,
    value: row.specVersion
  }))
)

const targetOptions = computed(() => [
  { label: '现在这一版（主表全文，含没签字的改动）', value: null as number | null },
  ...archiveOptions.value
])

const versionNotices = computed<string[]>(() => {
  const lines = [...(versions.value?.notices ?? [])]
  if (versionsError.value) {
    lines.unshift(`版本目录没读到（后端原话：${versionsError.value}）`)
  }
  return lines
})

function deltaOf(section: SpecSectionDiff) {
  const delta = section.charCountTo - section.charCountFrom
  if (delta === 0) {
    return section.changed ? '字数没变，但内容变了' : '字数没变'
  }
  return `${delta > 0 ? '+' : ''}${delta} 字`
}

async function loadVersions() {
  loadingVersions.value = true
  versionsError.value = ''
  try {
    const next = await siteSpecApi.versions(props.briefId)
    versions.value = next
    const archived = next.versions
    if (archived.length) {
      // 默认就看最近一版与现在这一版：这是「我上次签完之后改了什么」那一问。
      // 点开这一屏本身就是人的明确动作，所以顺带把差异也读出来，不再多要一次点击。
      fromVersion.value = archived[archived.length - 1].specVersion
      toVersion.value = null
      await runDiff()
    }
  } catch (error: any) {
    versions.value = null
    versionsError.value = error?.message || '未知原因'
  } finally {
    loadingVersions.value = false
  }
}

async function runDiff() {
  if (fromVersion.value === null) {
    return
  }
  loadingDiff.value = true
  diffError.value = ''
  try {
    diff.value = await siteSpecApi.diff(props.briefId, fromVersion.value, toVersion.value)
  } catch (error: any) {
    diff.value = null
    diffError.value = error?.message || '未知原因'
  } finally {
    loadingDiff.value = false
  }
}

onMounted(() => {
  void loadVersions()
})
</script>

<style scoped>
.spec-diff__table,
.spec-diff__notice {
  margin-top: 12px;
}
.spec-diff__notices {
  margin: 8px 0 0;
  padding-left: 18px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}
.spec-diff__pick {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
.spec-diff__arrow {
  color: rgba(0, 0, 0, 0.45);
}
.spec-diff__section {
  margin-top: 16px;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}
.spec-diff__section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.spec-diff__section-title {
  font-weight: 600;
}
.spec-diff__delta {
  margin-left: auto;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.spec-diff__columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.spec-diff__col-label {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  margin-bottom: 4px;
}
.spec-diff__body {
  margin: 0;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  max-height: 320px;
  overflow: auto;
}
</style>
