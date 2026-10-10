<template>
  <div class="reference-site-page__unmatched">
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      :message="`对不上的观察区块归并后 ${groups.length} 类，其中 ${trueGapCount} 类这一趟没对上任何区块（其余 ${groups.length - trueGapCount} 类我们有这个能力，只是这一趟没再映射）`"
      :description="explainText"
    />
    <a-table
      :data-source="groups"
      :columns="unmatchedColumns"
      :loading="loading"
      :pagination="false"
      row-key="observedBlock"
      size="small"
      :scroll="{ x: 1280 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'kind'">
          <a-tag v-if="record.capabilityKnown" color="orange">已有能力，这一趟重复声明</a-tag>
          <a-tag v-else color="red">这一趟没有区块对上</a-tag>
        </template>
        <template v-else-if="column.key === 'paths'">
          {{ record.paths.join('、') || '—' }}（{{ record.paths.length }} 页 / {{ record.rowCount }} 条）
        </template>
        <template v-else-if="column.key === 'note'">{{ record.note || '—' }}</template>
        <template v-else-if="column.key === 'promote'">
          <a-space>
            <!-- 已沉淀的那一行给的是回指，不是又一个按钮（Spec-M 判据⑤）。
                 按钮留着、只是按不下去：这一族已经有一个组件了，去组件库看它，别再建一个同形的。 -->
            <a-tooltip
              v-if="record.promotedBlockKey"
              title="这一族已经沉淀成组件库里的草稿了，去「组件库」那一页看它、改它、启用它；沉淀这一口对同一族只会成功一次"
            >
              <span>
                <a-tag color="green">已沉淀成 {{ record.promotedBlockKey }}</a-tag>
              </span>
            </a-tooltip>
            <a-tooltip :title="promoteHintOf(record)">
              <!-- disabled 的按钮不派发悬停事件，所以外面垫一层 span 让那句「为什么按不动」还能看见 -->
              <span>
                <a-button
                  size="small"
                  type="link"
                  :disabled="!record.mappingId || !!record.promotedBlockKey"
                  :loading="isPromoting(record.mappingId)"
                  @click="promote(record)"
                >
                  沉淀为组件
                </a-button>
              </span>
            </a-tooltip>
          </a-space>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="没有对不上的区块" />
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  portalReferenceApi,
  unmatchedTrueGapCountOf,
  type UnmatchedGroup
} from '../../../api/referenceSites'

/**
 * 「暂未对上现有区块」那一栏（Spec-M §8 第 4 步给它挂了「沉淀为组件」）。
 *
 * 这一栏过去只读，看完就完了；现在看到的那一形能一键变成组件库的一条草稿。
 * 但界面仍然不替人做「要不要新增区块」那个决定——它只说「模型这次没对上」这件事实。
 */

const props = defineProps<{
  referenceId: number
  groups: UnmatchedGroup[]
  loading: boolean
}>()

const emit = defineEmits<{ (e: 'promoted'): void }>()

/**
 * 正在沉淀的那几行 mappingId。
 *
 * <p>按行而不是整张表一个 loading：这一栏一行一次点击、一次往返，全局 loading 会让旁边几行
 * 看起来也能按（其实后端会拒），也会让已经按下去的那一行失去「我点的是哪一个」的对应关系。</p>
 */
const promotingIds = ref<Set<number>>(new Set())

const unmatchedColumns = [
  { title: '观察到的区块', dataIndex: 'observedBlock', key: 'observedBlock', width: 200 },
  { title: '定性', key: 'kind', width: 200 },
  { title: '出现在哪几页', key: 'paths', width: 260 },
  { title: '为什么对不上', key: 'note', width: 320 },
  { title: '沉淀', key: 'promote', width: 300, fixed: 'right' as const }
]

const trueGapCount = computed(() => unmatchedTrueGapCountOf(props.groups))
/** 归并前的行数，只用来把「按条数会夸大多少」说给人听，不上任何标题 */
const rowCount = computed(() => props.groups.reduce((sum, group) => sum + group.rowCount, 0))
const explainText = computed(
  () =>
    `为什么按类不按条：这一趟有 ${rowCount.value} 条对不上，归并成 ${props.groups.length} 类——` +
    '页头页脚这类站级公共格子几乎每页都会被重新看一遍，按条报数就会把「缺 ' +
    `${trueGapCount.value} 类」说成「缺 ${rowCount.value} 类」，那是决定要不要新增区块时最贵的一种误判。` +
    '逐条改映射在「区块映射」那一栏，那里每条都在。'
)

function isPromoting(mappingId: number | null | undefined): boolean {
  return mappingId != null && promotingIds.value.has(mappingId)
}

/**
 * 按钮旁边那句「为什么是这样的」。三种情形分开写，界面不许把没做的事说成做了：
 * 没有 mappingId 时按钮根本没有去处；已沉淀时那一族已经有一个组件了，这里再说「沉淀」就是骗人；
 * 只有按得动的时候，那句要提前说清落点是个<em>草稿</em>——不然人会以为搭页面时它已经能用了。
 */
function promoteHintOf(group: UnmatchedGroup): string {
  if (group.promotedBlockKey) {
    return `已经沉淀成组件「${group.promotedBlockKey}」了，重复沉淀后端会直接拒；去组件库看它`
  }
  if (!group.mappingId) {
    return '这一行没有可沉淀的映射记录：沉淀那一口按映射行走，归并行里没有可点开的 id'
  }
  return '把这一形存成组件库里的一条草稿组件（通用卡片渲染，专属设计待补）；启用要再去组件库按一次'
}

/**
 * 一键沉淀（Spec-M §8 第 4 步，判据⑤）。
 *
 * <p>成功那句话刻意不写成「已可用于搭建」：沉淀出来的是未启用的草稿，
 * 启用是组件库里的第二个动作，而这一口什么也没替人启用。</p>
 *
 * <p>失败时后端那四句中文原样念（已沉淀过 / 没有板块名 / 已经映射到现有组件 / 同名 key 已被覆盖），
 * 界面不另编一句——那四句就是判据⑤要看得见的内容。</p>
 */
async function promote(group: UnmatchedGroup) {
  const mappingId = group.mappingId
  if (!props.referenceId || !mappingId || isPromoting(mappingId)) return
  promotingIds.value = new Set(promotingIds.value).add(mappingId)
  try {
    const promoted = await portalReferenceApi.promote(props.referenceId, mappingId)
    // 后端没给 key 时不拿区块名冒充 key：那句「去组件库认它」就会指着一个不存在的东西
    message.success(promoted?.blockKey
      ? `已存为组件库草稿 ${promoted.blockKey}，启用后才会进搭建器面板与提示词`
      : '已存为组件库的一条草稿，启用要再去「组件库」按一次')
    // 回指来自后端那一列，不在这里自己记一笔：交回上层重读清单，让那一行自己变成「已沉淀成 X」
    emit('promoted')
  } catch (error) {
    message.error((error as Error).message || '沉淀失败')
  } finally {
    const left = new Set(promotingIds.value)
    left.delete(mappingId)
    promotingIds.value = left
  }
}
</script>
