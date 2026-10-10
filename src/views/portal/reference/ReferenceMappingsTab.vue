<template>
  <div class="reference-site-page__mappings">
    <a-alert
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      message="模型给的置信度只是排序依据，没人点过「确认」的映射不会进草稿页"
    />
    <a-table
      :data-source="mappings"
      :columns="mappingColumns"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="small"
      :scroll="{ x: 980 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'mappedBlockKey'">
          <span>{{ blockName(record.mappedBlockKey) }}</span>
          <div class="reference-site-page__muted">{{ record.mappedBlockKey || '未映射' }}</div>
        </template>
        <template v-else-if="column.key === 'confidence'">
          <a-progress
            v-if="record.confidence !== null"
            :percent="Math.round(Number(record.confidence) * 100)"
            size="small"
            :show-info="true"
          />
          <span v-else class="reference-site-page__muted">—</span>
        </template>
        <template v-else-if="column.key === 'props'">
          <a-tooltip :title="propsText(record)">
            <span class="reference-site-page__text">{{ propsText(record) }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.key === 'verified'">
          <a-tag v-if="record.humanVerified" color="green">已确认</a-tag>
          <a-tag v-else color="default">待确认</a-tag>
          <div v-if="record.verifiedBy" class="reference-site-page__muted">
            {{ record.verifiedBy }} · {{ formatDateTime(record.verifiedAt) }}
          </div>
        </template>
        <template v-else-if="column.key === 'note'">
          <span class="reference-site-page__text">{{ record.note || '—' }}</span>
        </template>
        <template v-else-if="column.key === 'op'">
          <a-space>
            <a-button size="small" type="link" @click="openVerifyModal(record, true)">确认</a-button>
            <a-button size="small" type="link" @click="openVerifyModal(record, false)">不认</a-button>
          </a-space>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="还没有映射：等任务跑到「映射已就绪」或「需人工处理」再看这里" />
      </template>
    </a-table>

    <!-- ---------------- 人工确认一条映射 ---------------- -->
    <a-modal
      v-model:open="verifyOpen"
      :title="verifyAccept ? '确认这条映射' : '判定这条映射不成立'"
      :confirm-loading="verifying"
      @ok="submitVerify"
    >
      <p class="reference-site-page__muted">
        观察到：{{ verifyTarget?.observedBlock || '—' }}
        <template v-if="verifyTarget?.note">（模型理由：{{ verifyTarget.note }}）</template>
      </p>
      <template v-if="verifyAccept">
        <a-form layout="vertical">
          <a-form-item label="映射到哪个区块（只能选白名单里的）">
            <a-select
              v-model:value="verifyForm.mappedBlockKey"
              style="width: 100%"
              show-search
              option-filter-prop="label"
              placeholder="选择区块类型"
              :options="blockOptions"
            />
          </a-form-item>
          <a-form-item label="建议填进槽位的内容（JSON，可留空）">
            <a-textarea v-model:value="verifyForm.propsSuggestionJson" :rows="6" />
            <p class="reference-site-page__muted">
              只允许字面文本，或者 {"$data":"某路径"} 这种门户数据绑定；后端会按这个区块的槽位表校验，
              写错了这里就会直接把中文原因报回来。
            </p>
            <p v-if="allowedSourcesOf(verifyForm.mappedBlockKey).length" class="reference-site-page__muted">
              「{{ blockName(verifyForm.mappedBlockKey) }}」可绑定的数据路径：
              {{ allowedSourcesOf(verifyForm.mappedBlockKey).join('、') }}
            </p>
            <p v-else-if="verifyForm.mappedBlockKey" class="reference-site-page__muted">
              「{{ blockName(verifyForm.mappedBlockKey) }}」没有可绑定的数据源，只能写字面文本。
            </p>
          </a-form-item>
        </a-form>
      </template>
      <a-form v-else layout="vertical">
        <a-form-item label="为什么不认（会留在这条记录上）">
          <a-input v-model:value="verifyForm.note" :maxlength="500" placeholder="例如：这一格其实是导航，白名单里的导航区块不该用它当首页主视觉" />
        </a-form-item>
        <p class="reference-site-page__muted">
          「不认」会把这条打回「暂未对上现有区块」那张清单，不是删掉——删了以后就没人知道模型这次错了多少。
        </p>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { portalReferenceApi, propsSuggestionOf, type ReferenceMapping } from '../../../api/referenceSites'
import { formatDateTime } from '../../../utils/format'
import type { PortalBlockMeta } from '../../../api/portalPages'

/**
 * 区块映射那一栏：每条映射都在，逐条由人确认。
 *
 * 决定权在人这一头（humanVerified），模型置信度只用来排序；所以「确认」与「不认」两个动作
 * 都留痕，而「不认」不是删掉——删了就没人知道模型这次错了多少。
 *
 * 这一栏自己发那一笔确认：它按行操作、成功后要立刻把这一行的状态读回来，
 * 而「读回来」之后要重拉什么（映射、列表、任务本身）交回上层，那里才有那份状态。
 */

const props = defineProps<{
  referenceId: number
  mappings: ReferenceMapping[]
  loading: boolean
  /** /portal/blocks 那一份：区块显示名与可绑定的数据路径都从它读，界面不自己声明 */
  blocks: PortalBlockMeta[]
}>()

const emit = defineEmits<{ (e: 'verified'): void }>()

const mappingColumns = [
  { title: '观察到的区块', dataIndex: 'observedBlock', key: 'observedBlock', width: 180 },
  { title: '映射到', key: 'mappedBlockKey', width: 170 },
  { title: '模型置信度', key: 'confidence', width: 140 },
  { title: '建议内容', key: 'props', width: 220 },
  { title: '人工确认', key: 'verified', width: 140 },
  { title: '备注', key: 'note', width: 180 },
  { title: '操作', key: 'op', width: 130, fixed: 'right' as const }
]

const verifyOpen = ref(false)
const verifying = ref(false)
const verifyAccept = ref(true)
const verifyTarget = ref<ReferenceMapping | null>(null)
const verifyForm = reactive<{ mappedBlockKey: string | null; propsSuggestionJson: string; note: string }>({
  mappedBlockKey: null,
  propsSuggestionJson: '',
  note: ''
})

const blockOptions = computed(() =>
  props.blocks.map(block => ({ value: block.blockKey, label: `${block.name}（${block.blockKey}）` }))
)

function blockName(blockKey: string | null | undefined) {
  if (!blockKey) return '未映射'
  const block = props.blocks.find(item => item.blockKey === blockKey)
  return block ? block.name : blockKey
}

/**
 * 某个区块可绑定的门户数据路径，取自 /portal/blocks 的 bindingSchema。
 *
 * 之所以在界面上列出来：后端拒「引用了不存在的数据源」时会把整张可用清单回在错误里，
 * 但那要等用户按一次确定才知道；提前列出来省一次往返，也免得照着示例猜路径名。
 */
function allowedSourcesOf(blockKey: string | null | undefined): string[] {
  if (!blockKey) return []
  const block = props.blocks.find(item => item.blockKey === blockKey)
  const allowed = block?.bindingSchema?.allowedSources
  return Array.isArray(allowed) ? allowed : []
}

function propsText(mapping: ReferenceMapping) {
  const suggestion = propsSuggestionOf(mapping)
  const keys = Object.keys(suggestion)
  if (!keys.length) return '（无建议内容）'
  return keys.map(key => `${key}=${displayValue(suggestion[key])}`).join('，')
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '（空）'
  if (typeof value === 'object') {
    const bound = (value as { $data?: string }).$data
    return bound ? `绑定门户数据：${bound}` : JSON.stringify(value)
  }
  return String(value)
}

function openVerifyModal(mapping: ReferenceMapping, accept: boolean) {
  verifyTarget.value = mapping
  verifyAccept.value = accept
  verifyForm.mappedBlockKey = mapping.mappedBlockKey || null
  verifyForm.propsSuggestionJson = mapping.propsSuggestionJson || ''
  verifyForm.note = mapping.note || ''
  verifyOpen.value = true
}

async function submitVerify() {
  const target = verifyTarget.value
  if (!props.referenceId || !target) return
  if (verifyAccept.value && !verifyForm.mappedBlockKey) {
    message.warning('请选择映射到哪个区块')
    return
  }
  verifying.value = true
  try {
    await portalReferenceApi.verify(props.referenceId, target.id, {
      mappedBlockKey: verifyAccept.value ? verifyForm.mappedBlockKey : null,
      propsSuggestionJson: verifyAccept.value ? verifyForm.propsSuggestionJson || null : null,
      humanVerified: verifyAccept.value,
      note: verifyForm.note || null
    })
    verifyOpen.value = false
    message.success(verifyAccept.value ? '这条映射已确认' : '已打回「暂未对上现有区块」')
    emit('verified')
  } catch (error) {
    message.error((error as Error).message || '确认失败')
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped lang="less">
.reference-site-page {
  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__text {
    display: inline-block;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
}
</style>
