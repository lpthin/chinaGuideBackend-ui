<template>
  <div class="prompt-page">
    <a-card size="small" class="prompt-page__head">
      <template #title>平台提示词</template>

      <p class="prompt-page__lead">
        这一页改的是<em>平台默认</em>那一份：保存之后，所有租户后面每一单的这一步读到的都是改后的措辞。
        某一站自己盖过的行不跟着变——右栏下面那一栏就是「现在谁还盖着」。
      </p>

      <template v-if="denied">
        <a-alert type="warning" show-icon>
          <template #message>{{ denied }}</template>
        </a-alert>
      </template>

      <template v-else>
        <a-row :gutter="12">
          <a-col :xs="24" :md="9" :lg="7">
            <a-spin :spinning="listLoading">
              <div class="prompt-page__list">
                <button
                  v-for="row in rows"
                  :key="row.purpose"
                  type="button"
                  class="prompt-page__item"
                  :class="{ 'prompt-page__item--active': row.purpose === activePurpose }"
                  @click="select(row.purpose)"
                >
                  <span class="prompt-page__item-title">{{ row.title }}</span>
                  <span class="prompt-page__item-stage">{{ row.stage }}</span>
                  <span class="prompt-page__item-badges">
                    <a-tag v-if="row.id === null" color="orange">库里没有这一行</a-tag>
                    <a-tag v-else-if="!row.enabled" color="red">停用</a-tag>
                    <a-tag v-else color="green">生效中</a-tag>
                    <a-tag v-if="row.unknownPlaceholders.length" color="red">
                      {{ row.unknownPlaceholders.length }} 个位填不上
                    </a-tag>
                    <span class="prompt-page__count">{{ row.charCount }} 字</span>
                  </span>
                </button>
              </div>
            </a-spin>
            <a-button size="small" class="prompt-page__reload" :loading="listLoading" @click="loadList">
              重新读取
            </a-button>
          </a-col>

          <a-col :xs="24" :md="15" :lg="17">
            <a-alert v-if="!activePurpose" type="info" show-icon>
              <template #message>左栏点一份，右边才去读它那份的正文（进这一页只发列表那一条 GET）。</template>
            </a-alert>

            <a-spin v-else :spinning="detailLoading">
              <a-alert v-if="detailError" type="error" show-icon>
                <template #message>正文没读到（后端原话：{{ detailError }}）</template>
              </a-alert>

              <template v-else-if="detail">
                <div class="prompt-page__detail">
                  <a-descriptions :column="2" size="small" bordered>
                    <a-descriptions-item label="purpose">
                      <code>{{ detail.summary.purpose }}</code>
                    </a-descriptions-item>
                    <a-descriptions-item label="活在哪一步">{{ detail.summary.stage }}</a-descriptions-item>
                    <a-descriptions-item label="名称">
                      <a-input v-model:value="form.name" size="small" :disabled="!canWrite" />
                    </a-descriptions-item>
                    <a-descriptions-item label="版本">
                      <a-input v-model:value="form.version" size="small" :disabled="!canWrite" />
                    </a-descriptions-item>
                    <a-descriptions-item label="状态">
                      <a-switch
                        :checked="form.enabled"
                        :disabled="!canWrite || saving"
                        checked-children="启用"
                        un-checked-children="停用"
                        @change="toggleEnabled"
                      />
                    </a-descriptions-item>
                    <a-descriptions-item label="上次更新">{{ detail.summary.updatedAt || '—' }}</a-descriptions-item>
                  </a-descriptions>

                  <p class="prompt-page__note">{{ detail.note }}</p>

                  <a-alert
                    v-for="notice in detail.notices"
                    :key="notice"
                    type="warning"
                    show-icon
                    class="prompt-page__notice"
                  >
                    <template #message>{{ notice }}</template>
                  </a-alert>

                  <a-textarea
                    v-model:value="form.templateText"
                    :rows="18"
                    :disabled="!canWrite"
                    placeholder="这份提示词的正文"
                  />

                  <div class="prompt-page__actions">
                    <span :class="{ 'prompt-page__over': detail.summary.unknownPlaceholders.length > 0 }">
                      {{ (form.templateText || '').length }} 字
                    </span>
                    <a-button
                      type="primary"
                      size="small"
                      :disabled="!canWrite || !dirty || saving"
                      :loading="saving"
                      @click="askSave"
                    >
                      保存这一份
                    </a-button>
                    <a-button size="small" :disabled="saving" @click="loadDetail(activePurpose)">放弃改动</a-button>
                  </div>

                  <p v-if="!canWrite" class="prompt-page__muted">{{ writeHint }}</p>

                  <h4 class="prompt-page__sub">这份能占的位（后端回的那一份，不是前端抄的）</h4>
                  <a-table
                    :data-source="variableRows"
                    :columns="variableColumns"
                    size="small"
                    row-key="name"
                    :pagination="false"
                  >
                    <template #bodyCell="{ column, record }">
                      <code v-if="column.key === 'name'">{{ placeholderText(record.name) }}</code>
                      <span v-else>{{ record.note }}</span>
                    </template>
                  </a-table>

                  <h4 class="prompt-page__sub">这一份里现在占着的位</h4>
                  <p v-if="!detail.summary.placeholders.length" class="prompt-page__muted">
                    一个都没占：这一份是纯措辞，模型看不到任何现场变量。
                  </p>
                  <p v-else>
                    <a-tag
                      v-for="name in detail.summary.placeholders"
                      :key="name"
                      :color="isUnknown(name) ? 'red' : 'blue'"
                    >
                      {{ name }}
                    </a-tag>
                  </p>

                  <h4 class="prompt-page__sub">各站盖着这一份的行（只读）</h4>
                  <a-spin :spinning="overridesLoading">
                    <p v-if="overrideError" class="prompt-page__muted">覆盖行没读到（后端原话：{{ overrideError }}）</p>
                    <p v-else-if="!overrides.length" class="prompt-page__muted">
                      还没有任何站点覆盖这一份：现在每一家读的都是左栏这一份全局正文。
                    </p>
                    <a-table
                      v-else
                      :data-source="overrides"
                      :columns="overrideColumns"
                      size="small"
                      row-key="id"
                      :pagination="false"
                    >
                      <template #bodyCell="{ column, record }">
                        <span v-if="column.key === 'site'">
                          {{ record.siteName || `站点 #${record.siteId}（站点行读不到）` }}
                        </span>
                        <span v-else-if="column.key === 'name'">{{ record.name || '（没起名）' }}</span>
                        <span v-else-if="column.key === 'version'">{{ record.version || '—' }}</span>
                        <span v-else-if="column.key === 'charCount'">{{ record.charCount }}</span>
                        <template v-else-if="column.key === 'unknown'">
                          <a-tag v-if="record.unknownPlaceholders.length" color="red">
                            {{ record.unknownPlaceholders.join('、') }}
                          </a-tag>
                          <span v-else>—</span>
                        </template>
                      </template>
                    </a-table>
                    <p v-if="overrides.length" class="prompt-page__muted">
                      一站一行，摆的是生成真会拿的那一条。要改它们得进那一站自己的提示词页，这里只给看。
                    </p>
                  </a-spin>
                </div>
              </template>
            </a-spin>
          </a-col>
        </a-row>
      </template>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  platformPromptApi,
  type PlatformPromptDetail,
  type PlatformPromptOverride,
  type PlatformPromptSummary
} from '../../api/platformPrompts'
import { useAuthStore } from '../../stores/auth'

/**
 * 平台默认提示词页（Spec-M D2 / §7，P1）。
 *
 * 四条刻意：
 * 1. 清单、变量表、拦下的理由全部来自后端回包：这一页不认识「建站那一族有八份」这件事本身；
 * 2. 进页面只发列表那一条 GET，正文与覆盖行都等人选了那一份才读——八份正文一起拉没意义；
 * 3. 保存前必问一次：全局行一改就改到所有租户后面每一单，这一下的爆炸半径不是一站；
 * 4. 后端原话一个字都不改写：拦下的四种理由（空正文 / 填不上的位 / 最后一条启用行 / 不归本页管）
 *    下一步动作完全不同，归纳成「保存失败」就没人知道该改哪里。
 */

const auth = useAuthStore()

const rows = ref<PlatformPromptSummary[]>([])
const listLoading = ref(false)
const detailLoading = ref(false)
const overridesLoading = ref(false)
const saving = ref(false)
const denied = ref('')
const detailError = ref('')
const overrideError = ref('')
const activePurpose = ref('')
const detail = ref<PlatformPromptDetail | null>(null)
const overrides = ref<PlatformPromptOverride[]>([])
/** 读回来的那一份快照：dirty 与「放弃改动」都只跟它比，不跟上一个草稿比 */
const snapshot = reactive<{ name: string; version: string; templateText: string; enabled: boolean }>({
  name: '',
  version: '',
  templateText: '',
  enabled: true
})

const form = reactive<{ name: string; version: string; templateText: string; enabled: boolean }>({
  name: '',
  version: '',
  templateText: '',
  enabled: true
})

const canRead = computed(() => auth.hasPermission('prompt:template:manage'))
// 写比读多一道：全局行影响所有租户，service 里那道角色码兜底在这儿同步摆，不让人点了才知道
const canWrite = computed(() => canRead.value && auth.isSuperAdmin)
const writeHint = computed(() =>
  canRead.value
    ? '这个账号能读，但不是超级管理员：全局正文一改就改到所有租户后面每一单，写口只认超管。'
    : ''
)

const dirty = computed(() =>
  form.name !== snapshot.name ||
  form.version !== snapshot.version ||
  form.templateText !== snapshot.templateText ||
  form.enabled !== snapshot.enabled
)

const variableColumns = [
  { title: '变量', key: 'name', dataIndex: 'name', width: 190 },
  { title: '系统会往里填什么', key: 'note', dataIndex: 'note' }
]
const overrideColumns = [
  { title: '站点', key: 'site', dataIndex: 'siteId' },
  { title: '名称', key: 'name', dataIndex: 'name' },
  { title: '版本', key: 'version', dataIndex: 'version' },
  { title: '字数', key: 'charCount', dataIndex: 'charCount', width: 70 },
  { title: '填不上的位', key: 'unknown', dataIndex: 'unknownPlaceholders' }
]
const variableRows = computed(() =>
  Object.entries(detail.value?.variables ?? {}).map(([name, note]) => ({ name, note }))
)

function isUnknown(name: string) {
  return (detail.value?.summary.unknownPlaceholders ?? []).includes(name)
}

/** 成对花括号在这里拼出来：写在模板文本里会被 Vue 的插值语法吃掉（这一族的正文本来就全是 {{x}}） */
function placeholderText(name: string) {
  return '{' + '{' + name + '}' + '}'
}

function toggleEnabled(checked: boolean) {
  form.enabled = checked
}

async function loadList() {
  if (!canRead.value) {
    rows.value = []
    denied.value = '这个账号没有 prompt:template:manage：平台默认提示词连读都不给读，'
      + '这里不演任何内容，既不是「读失败」也不是「一份都没有」。'
    return
  }
  denied.value = ''
  listLoading.value = true
  try {
    rows.value = await platformPromptApi.list()
  } catch (error: any) {
    rows.value = []
    message.error(`清单没读到（后端原话：${error?.message || '未知原因'}）`)
  } finally {
    listLoading.value = false
  }
}

async function select(purpose: string) {
  activePurpose.value = purpose
  detail.value = null
  overrides.value = []
  detailError.value = ''
  overrideError.value = ''
  await Promise.all([loadDetail(purpose), loadOverrides(purpose)])
}

async function loadDetail(purpose: string) {
  detailLoading.value = true
  detailError.value = ''
  try {
    applyDetail(await platformPromptApi.detail(purpose))
  } catch (error: any) {
    // 库里缺这一行（那一支迁移还没跑）时后端就是这么说的：原文摆出来，不换成「暂无数据」
    detailError.value = error?.message || '未知原因'
  } finally {
    detailLoading.value = false
  }
}

function applyDetail(next: PlatformPromptDetail) {
  detail.value = next
  form.name = next.summary.name ?? ''
  form.version = next.summary.version ?? ''
  form.templateText = next.templateText ?? ''
  form.enabled = next.summary.enabled !== false
  Object.assign(snapshot, form)
}

async function loadOverrides(purpose: string) {
  overridesLoading.value = true
  try {
    overrides.value = await platformPromptApi.overrides(purpose)
  } catch (error: any) {
    overrides.value = []
    overrideError.value = error?.message || '未知原因'
  } finally {
    overridesLoading.value = false
  }
}

/** 保存前问一次：这一发的代价是所有租户后面的每一单，不是眼前这一页 */
function askSave() {
  const title = detail.value?.summary.title ?? activePurpose.value
  Modal.confirm({
    title: `改的是全局默认：${title}`,
    content: '保存之后，每一个租户后面每一单的这一步都改读这一份措辞（下一轮生成立即生效，不用重启）。'
      + '已经自己盖过这一份的站点不受影响，名单见右栏「各站盖着这一份的行」。',
    okText: '确认改动全局',
    cancelText: '先不改',
    onOk: runSave
  })
}

async function runSave() {
  saving.value = true
  try {
    applyDetail(await platformPromptApi.save(activePurpose.value, {
      name: form.name,
      version: form.version,
      templateText: form.templateText,
      enabled: form.enabled
    }))
    message.success('已存下：下一轮生成读的就是这一份')
    await loadList()
    await loadOverrides(activePurpose.value)
  } catch (error: any) {
    // 四道闸的原话（空正文 / 填不上的位 / 最后一条启用行 / 不是超管）都带下一步动作，原样念
    message.error(`没存进去（后端原话：${error?.message || '未知原因'}）：正文还在你眼前，没丢`, 8)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadList()
})
</script>

<style scoped>
.prompt-page__lead {
  margin-bottom: 12px;
}
.prompt-page__muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.prompt-page__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.prompt-page__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  cursor: pointer;
}
.prompt-page__item--active {
  border-color: #1677ff;
  background: #e6f4ff;
}
.prompt-page__item-title {
  font-weight: 600;
}
.prompt-page__item-stage {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.prompt-page__item-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.prompt-page__count {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.prompt-page__reload {
  margin-top: 8px;
}
.prompt-page__detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prompt-page__note {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
}
.prompt-page__notice {
  margin-bottom: 0;
}
.prompt-page__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.prompt-page__over {
  color: #cf1322;
  font-weight: 600;
}
.prompt-page__sub {
  margin: 12px 0 4px;
  font-size: 13px;
}
</style>
