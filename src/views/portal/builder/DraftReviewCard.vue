<template>
  <div class="draft-card">
    <a-alert
      v-if="draft.validationError"
      type="error"
      show-icon
      message="这份草稿未通过门禁，不能应用"
      :description="draft.validationError"
    />
    <a-descriptions :column="2" size="small">
      <a-descriptions-item label="模型自述">{{ draft.reason || '（模型未给理由）' }}</a-descriptions-item>
      <a-descriptions-item label="基线版本">v{{ draft.baseVersion }}</a-descriptions-item>
      <a-descriptions-item label="token 消耗">
        {{ (draft.promptTokens ?? 0) + (draft.completionTokens ?? 0) }}
      </a-descriptions-item>
      <a-descriptions-item label="生成时间">{{ formatDateTime(draft.createdAt) }}</a-descriptions-item>
    </a-descriptions>

    <div v-if="warnings.length" class="draft-card__warnings">
      <p v-for="warning in warnings" :key="warning">{{ warning }}</p>
    </div>

    <a-table
      v-if="diffRows.length"
      :data-source="diffRows"
      :columns="columns"
      :pagination="false"
      row-key="rowKey"
      size="small"
      :scroll="{ x: 720 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'field'">
          <div>{{ record.blockName }}<span class="draft-card__muted">（{{ record.instanceId }}）</span></div>
          <div class="draft-card__mono">{{ record.fieldName }}</div>
        </template>
        <template v-else-if="column.key === 'before'">
          <span class="draft-card__del">{{ record.before }}</span>
        </template>
        <template v-else-if="column.key === 'after'">
          <span class="draft-card__ins">{{ record.after }}</span>
        </template>
      </template>
    </a-table>
    <p v-else-if="!draft.validationError" class="draft-card__muted">
      这份草稿没有字段级差异记录（可能只改了主题变量），应用前请确认页面现状。
    </p>

    <a-space style="margin-top: 8px">
      <a-popconfirm
        title="应用后页面结构立即对访客生效，确定吗？"
        :disabled="!canApply"
        @confirm="apply"
      >
        <a-button type="primary" :disabled="!canApply" :loading="applying">
          {{ draft.appliedAt ? '已应用' : '应用到页面' }}
        </a-button>
      </a-popconfirm>
      <a-popconfirm title="丢弃后这份草稿不再可用，确定吗？" @confirm="discard">
        <a-button :disabled="!!draft.appliedAt" :loading="discarding">丢弃</a-button>
      </a-popconfirm>
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { portalTicketsApi, type RevisionDraft } from '../../../api/portalTickets'
import { formatDateTime } from '../../../utils/format'

/**
 * AI 改版草稿的审阅卡：字段级 diff + 应用/丢弃。
 *
 * 收在一处是因为有两个入口需要看同一份草稿：改版工单（客户提的那条），以及页面巡检
 * 判出「内容过期」后 AI 出的那份（它不属于任何工单）。同一套「门禁没过就不许应用」的
 * 判断写两份，迟早有一份会漏掉 validationError——那是白名单被绕过的形状。
 *
 * 渲的仍然是后端 LayoutDiff 的字段级结果，不做整页视觉预览：候选 layout 里的
 * {"$data":"services"} 只有服务端能解析，在前端渲出来必然是假的。
 */

const props = defineProps<{ draft: RevisionDraft }>()
const emit = defineEmits<{ (event: 'changed'): void }>()

const applying = ref(false)
const discarding = ref(false)

const columns = [
  { title: '区块 / 槽位', key: 'field', width: 240 },
  { title: '改前', key: 'before', width: 240 },
  { title: '改后', key: 'after', width: 240 }
]

/** 门禁拦下的草稿只显原因，应用按钮必须是禁用态 */
const canApply = computed(() => !props.draft.validationError && !props.draft.appliedAt)

interface DiffRow {
  rowKey: string
  blockName: string
  instanceId: string
  fieldName: string
  before: string
  after: string
}

const ACTION_LABELS: Record<string, string> = {
  added: '新增区块',
  removed: '删除区块',
  modified: '改内容',
  replaced: '换区块类型',
  moved: '挪顺序'
}

/** change_summary_json 的形状是 {diff:[{instanceId,blockName,action,fields:[{name,before,after}]}],summary,warnings} */
const diffRows = computed<DiffRow[]>(() => {
  const raw = props.draft.changeSummaryJson
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as {
      diff?: Array<{
        instanceId?: string
        blockKey?: string
        blockName?: string
        action?: string
        fields?: Array<{ name?: string; before?: unknown; after?: unknown }>
      }>
    }
    const rows: DiffRow[] = []
    ;(parsed.diff || []).forEach(entry => {
      const action = entry.action || 'modified'
      const label = entry.blockName || entry.blockKey || entry.instanceId || '—'
      const fields = entry.fields || []
      if (!fields.length) {
        rows.push({
          rowKey: `${label}-${action}`,
          blockName: `${ACTION_LABELS[action] || action}：${label}`,
          instanceId: entry.instanceId || '',
          fieldName: '（整块顺序或结构变化）',
          before: '',
          after: ''
        })
        return
      }
      fields.forEach((field, index) => {
        rows.push({
          rowKey: `${entry.instanceId}-${field.name}-${index}`,
          blockName: label,
          instanceId: entry.instanceId || '',
          fieldName: field.name || '—',
          before: displayValue(field.before),
          after: displayValue(field.after)
        })
      })
    })
    return rows
  } catch {
    // 摘要坏了就什么都不显：宁可少一份参考，也不要在表格里渲半截 JSON
    return []
  }
})

const warnings = computed<string[]>(() => {
  const raw = props.draft.changeSummaryJson
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { warnings?: unknown }
    return Array.isArray(parsed.warnings) ? parsed.warnings.map(item => String(item)) : []
  } catch {
    return []
  }
})

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '（空）'
  if (typeof value === 'object') {
    const bound = (value as { $data?: string }).$data
    return bound ? `绑定门户数据：${bound}` : JSON.stringify(value)
  }
  return String(value)
}

async function apply() {
  applying.value = true
  try {
    const saved = await portalTicketsApi.apply(props.draft.id)
    // 结论是「页面到了第几版」，不是「成功」两个字：应用会立刻对访客生效，版本号才是可核对的事实
    message.success(`已应用，页面当前版本 v${saved.version}`)
    emit('changed')
  } catch (error) {
    message.error((error as Error).message || '应用失败')
  } finally {
    applying.value = false
  }
}

async function discard() {
  discarding.value = true
  try {
    await portalTicketsApi.discard(props.draft.id, '人工审阅后决定不用')
    message.success('这份草稿已丢弃')
    emit('changed')
  } catch (error) {
    message.error((error as Error).message || '丢弃失败')
  } finally {
    discarding.value = false
  }
}
</script>

<style scoped>
.draft-card__muted {
  color: rgba(0, 0, 0, 0.45);
}

.draft-card__mono {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.draft-card__warnings {
  margin: 8px 0;
  padding: 8px 12px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
}

.draft-card__del {
  color: #cf1322;
  text-decoration: line-through;
}

.draft-card__ins {
  color: #389e0d;
}
</style>
