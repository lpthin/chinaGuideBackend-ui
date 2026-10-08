<template>
  <div class="spec-page">
    <a-card size="small" class="spec-page__head">
      <template #title>建站说明书</template>

      <p class="spec-page__lead">
        这份文档是后面 AI 出方案时读的那一份：七段由超管逐段写或先让 AI 出一版，
        <strong>点了「确认」之后才会被拿去生成</strong>。需求单上的勾选怎么改都不动这里已经写下的字。
      </p>

      <p v-if="briefId === null" class="spec-page__muted">
        没有需求单编号：说明书是按需求单开的，没有单号就没有可读写的对象，所以这一页一颗按钮都不给。
      </p>

      <template v-else-if="denied">
        <a-alert type="warning" show-icon>
          <template #message>{{ denied }}</template>
        </a-alert>
      </template>

      <template v-else-if="loadError">
        <a-alert type="error" show-icon>
          <template #message>说明书没读到（后端原话：{{ loadError }}）：读不到就当没读过，下面不演任何内容。</template>
        </a-alert>
      </template>

      <template v-else>
        <a-spin :spinning="loading">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="状态">
              <a-tag :color="statusColor">{{ doc?.statusLabel || '读不出来' }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="已确认版本">
              {{ doc?.exists ? `第 ${doc?.specVersion} 版` : '还没有确认过版本' }}
            </a-descriptions-item>
            <a-descriptions-item label="签字人">
              {{ doc?.confirmedBy || '没人签过' }}
            </a-descriptions-item>
            <a-descriptions-item label="签字时间">
              {{ doc?.confirmedAt || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="AI 初稿出处">
              {{ draftSource || '这一份没有用过 AI 初稿' }}
            </a-descriptions-item>
            <a-descriptions-item label="初稿时间">{{ doc?.aiDraftAt || '—' }}</a-descriptions-item>
          </a-descriptions>

          <a-alert v-if="doc && !doc.exists" type="info" show-icon class="spec-page__notice">
            <template #message>
              这一单还没有说明书。可以先点「AI 出初稿」，也可以七段直接自己写——
              两段路都要人逐段看过再确认。
            </template>
          </a-alert>

          <a-alert v-if="blockers.length" type="warning" show-icon class="spec-page__notice">
            <template #message>
              <div>现在还不能确认、也不能拿去生成：</div>
              <ul class="spec-page__blockers">
                <li v-for="line in blockers" :key="line">{{ line }}</li>
              </ul>
            </template>
          </a-alert>

          <ul v-if="notices.length" class="spec-page__notices">
            <li v-for="line in notices" :key="line">{{ line }}</li>
          </ul>

          <div class="spec-page__actions">
            <a-button @click="load">重新读取</a-button>
            <a-tooltip :title="draftTip">
              <a-button :disabled="!canWrite || busy" :loading="drafting" @click="askDraft">
                AI 出初稿
              </a-button>
            </a-tooltip>
            <a-button
              type="primary"
              :disabled="!canWrite || !doc || blockers.length > 0 || busy"
              :loading="confirming"
              @click="askConfirm"
            >
              确认这一版
            </a-button>
          </div>
          <p v-if="!canWrite" class="spec-page__muted">
            这个账号没有 site_spec:edit：这一页只给看，三个动作一个都不摆出去按。
          </p>
        </a-spin>

        <div v-for="section in sections" :key="section.key" class="spec-page__section">
          <a-card size="small">
            <template #title>
              <span class="spec-page__section-title">{{ section.title }}</span>
              <a-tag v-if="section.blank" color="orange">空的</a-tag>
              <a-tag v-else-if="section.overLimit" color="red">超上限</a-tag>
              <a-tag v-if="isDirty(section.key)" color="blue">未保存</a-tag>
            </template>

            <a-textarea
              v-model:value="drafts[section.key]"
              :rows="6"
              :placeholder="placeholderFor(section)"
              @blur="touch(section.key)"
            />
            <div class="spec-page__section-foot">
              <span :class="{ 'spec-page__over': section.overLimit }">
                {{ (drafts[section.key] || '').length }} / {{ doc?.maxSectionChars }} 字
              </span>
              <a-button
                size="small"
                type="primary"
                :disabled="!canWrite || !isDirty(section.key) || savingKey !== ''"
                :loading="savingKey === section.key"
                @click="save(section.key)"
              >
                保存本段
              </a-button>
            </div>
            <p class="spec-page__muted">
              这一段存进去多少字，模型将来读到的就是多少字：系统不替你截断，超上限只会在确认与生成时拦下并点名这一段。
            </p>
          </a-card>
        </div>
      </template>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { siteSpecApi, type SpecDocumentView, type SpecSection } from '../../api/siteSpec'
import { useAuthStore } from '../../stores/auth'

/**
 * 建站说明书编辑页（Spec-M D1/D7 的 P0 第一版）。
 *
 * 五条刻意：
 * 1. 段名、顺序、上限全部来自后端回包：这一页不认识「七段」这件事本身，抄一份清单就会有两份真相；
 * 2. 进页面只发那一条 GET。出初稿（真花钱 + 整份覆盖）与确认（让它成为生成输入）都只在人明确点按钮时发；
 * 3. 「确认」按不动的理由永远摆在页面上（blockers 那一列），不让人猜为什么点了没反应；
 * 4. 字数只报数不裁剪：超限照样能存，红着提示，拦住的是确认与生成；
 * 5. 每次写回来的 doc 都要重新对齐本地草稿，否则「已确认」被落回草稿时，界面还拿着旧签字那一份在编辑。
 */

const route = useRoute()
const auth = useAuthStore()

const doc = ref<SpecDocumentView | null>(null)
const loading = ref(false)
const drafting = ref(false)
const confirming = ref(false)
const savingKey = ref('')
const loadError = ref('')
const denied = ref('')
/** 人动过但还没存的段：按 key 记，保存成功后由后端回包清掉 */
const touched = ref<string[]>([])
const drafts = reactive<Record<string, string>>({})

/** 需求单号：路由参数（详情页跳过来带的就是它），地址里可独立打开，也兼容按 query 传 */
const briefId = computed<number | null>(() => {
  const raw = route.params.brief ?? route.params.id ?? route.query.brief
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
})

const canWrite = computed(() => auth.hasPermission('site_spec:edit'))
const sections = computed<SpecSection[]>(() => doc.value?.sections ?? [])
const blockers = computed<string[]>(() => doc.value?.blockers ?? [])
const notices = computed<string[]>(() => doc.value?.notices ?? [])
const busy = computed(() => loading.value || drafting.value || confirming.value || savingKey.value !== '')
const draftSource = computed(() => {
  if (!doc.value?.aiDraftModel && !doc.value?.aiDraftProvider) {
    return ''
  }
  return `${doc.value?.aiDraftProvider || '未知提供方'} / ${doc.value?.aiDraftModel || '未知模型'}`
})
const statusColor = computed(() => {
  if (doc.value?.status === 'CONFIRMED') return 'green'
  if (doc.value?.status === 'AI_DRAFTED') return 'gold'
  return 'default'
})
const hasAnyContent = computed(() => sections.value.some(section => !section.blank))
const draftTip = computed(() =>
  hasAnyContent.value
    ? '七段里已经有内容：初稿是整份覆盖的，点下去会先问你一次要不要覆盖'
    : '按这张需求单的前采内容出七段初稿（会调用模型、消耗配额）'
)

function placeholderFor(section: SpecSection) {
  return section.blank ? `这一段还没有内容：确认时会被点名（第 ${section.order} 段）` : ''
}

function isDirty(key: string) {
  return touched.value.includes(key)
}

function touch(key: string) {
  const original = sections.value.find(section => section.key === key)?.content ?? ''
  const current = drafts[key] ?? ''
  const dirty = isDirty(key)
  if (current === original) {
    touched.value = touched.value.filter(item => item !== key)
  } else if (!dirty) {
    touched.value = [...touched.value, key]
  }
}

/** 后端回包 → 本地草稿：一个字都不加工，也不在这里比「人改过没改过」以外的任何事 */
function sync(next: SpecDocumentView) {
  doc.value = next
  for (const section of next.sections) {
    drafts[section.key] = section.content ?? ''
  }
  // 写口回来的那一包就是最新真相：未保存标记随之清零（确认状态被落回草稿那句在 notices 里，不靠这里演）
  touched.value = []
}

async function load() {
  if (briefId.value === null) {
    return
  }
  if (!auth.hasPermission('site_spec:edit')) {
    doc.value = null
    denied.value = '这个账号没有 site_spec:edit：说明书连读都不给读，这里不演任何内容，'
      + '既不是「读失败」也不是「这份说明书是空的」。'
    loadError.value = ''
    return
  }
  denied.value = ''
  loading.value = true
  loadError.value = ''
  try {
    sync(await siteSpecApi.read(briefId.value))
  } catch (error: any) {
    doc.value = null
    loadError.value = error?.message || '未知原因'
  } finally {
    loading.value = false
  }
}

async function save(key: string) {
  if (briefId.value === null) {
    return
  }
  savingKey.value = key
  try {
    sync(await siteSpecApi.saveSection(briefId.value, key, drafts[key] ?? ''))
    message.success('这一段已经逐字存下')
  } catch (error: any) {
    message.error(`没存进去（后端原话：${error?.message || '未知原因'}）：这一段的内容还留在输入框里`)
  } finally {
    savingKey.value = ''
  }
}

/** 覆盖人写过的字必须先问一次：初稿是整份覆盖的，这一发的代价是钱 + 别人的编辑 */
function askDraft() {
  if (briefId.value === null) {
    return
  }
  if (!hasAnyContent.value) {
    void runDraft(false)
    return
  }
  Modal.confirm({
    title: 'AI 出初稿会覆盖七段现有的内容',
    content: '这一发会调用模型、消耗这个租户的配额，而且七段是整份替换的：'
      + '超管改过的字会被初稿盖掉，确认状态也会落回草稿。确定要覆盖就点「覆盖并重出」。',
    okText: '覆盖并重出',
    cancelText: '先不覆盖',
    onOk: () => runDraft(true)
  })
}

async function runDraft(overwrite: boolean) {
  if (briefId.value === null) {
    return
  }
  drafting.value = true
  try {
    sync(await siteSpecApi.draft(briefId.value, overwrite))
    message.success('初稿已经写进七段：逐段看过再确认，AI 出的那一版不是签字版')
  } catch (error: any) {
    // 后端被拦下的那几种（开关没开 / 余额不够 / 模型没跑成 / 门禁整单拒）都带着中文原话，
    // 这里一个字都不改写：四种含义对应的下一步完全不同，归纳成「生成失败」就没人知道该做什么
    message.error(`初稿没有生成（后端原话：${error?.message || '未知原因'}）`, 8)
    await load()
  } finally {
    drafting.value = false
  }
}

function askConfirm() {
  if (briefId.value === null) {
    return
  }
  Modal.confirm({
    title: `确认第 ${(doc.value?.specVersion ?? 0) + 1} 版说明书`,
    content: '确认之后，下一轮出方案读的就是这一版七段全文（不截断）。'
      + '之后再改任何一段，确认状态都会落回草稿、要重新签一次。',
    okText: '确认并放行生成',
    cancelText: '再看看',
    onOk: () => runConfirm()
  })
}

async function runConfirm() {
  if (briefId.value === null) {
    return
  }
  confirming.value = true
  try {
    sync(await siteSpecApi.confirm(briefId.value))
    message.success('已确认：下一轮生成以这一版为准')
  } catch (error: any) {
    message.error(`没签下来（后端原话：${error?.message || '未知原因'}）`, 8)
    await load()
  } finally {
    confirming.value = false
  }
}

watch(briefId, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<style scoped>
.spec-page__lead {
  margin-bottom: 12px;
}
.spec-page__muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.spec-page__notice {
  margin-top: 12px;
}
.spec-page__blockers,
.spec-page__notices {
  margin: 6px 0 0;
  padding-left: 18px;
}
.spec-page__notices {
  margin-top: 12px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}
.spec-page__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.spec-page__section {
  margin-top: 12px;
}
.spec-page__section-title {
  margin-right: 8px;
}
.spec-page__section-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
.spec-page__over {
  color: #cf1322;
  font-weight: 600;
}
</style>
