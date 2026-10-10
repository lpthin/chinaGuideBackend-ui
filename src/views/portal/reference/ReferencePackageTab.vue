<template>
  <div class="reference-site-page__package">
    <a-space style="margin-bottom: 12px" wrap>
      <a-button :loading="loading" @click="emit('load')">
        {{ pkg ? '重新载入模板包' : '载入模板包' }}
      </a-button>
      <span class="reference-site-page__muted">
        这一份就是「出方案时喂给模型」的那份东西，界面上显示它不是为了好看：
        这里看得见、模型读不到，那才是最难发现的一种能力浪费。它只读，不花钱，也不含对方的文案与图片地址。
      </span>
    </a-space>

    <template v-if="pkg">
      <a-descriptions :column="3" size="small" bordered>
        <a-descriptions-item label="认出的家族">{{ packageFamilyText }}</a-descriptions-item>
        <a-descriptions-item label="清单里的路由">{{ pkg.routeCount }} 条</a-descriptions-item>
        <a-descriptions-item label="有版面的路由">{{ pkg.crawledCount }} 条</a-descriptions-item>
        <a-descriptions-item label="站级 token" :span="2">
          {{ siteTokenText }}
        </a-descriptions-item>
        <a-descriptions-item label="段级取值不一致">{{ variedTokenText }}</a-descriptions-item>
      </a-descriptions>

      <a-alert
        type="info"
        show-icon
        style="margin-top: 12px"
        message="段级那一半只是证据，不会变成站点样式：能被搬进真的样式变量的只有浏览器量出来的站级取值"
        description="「这一格里出现过 12px」和「这一站的圆角是 12px」可信度差一个量级，所以它们分列在两处显示。"
      />

      <a-divider orientation="left">每一格装得下什么（槽位形状）</a-divider>
      <a-table
        :data-source="slotShapeRows"
        :columns="slotShapeColumns"
        :pagination="false"
        row-key="rowKey"
        size="small"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'slots'">
            <div v-for="(slot, index) in record.slots" :key="index" class="reference-site-page__slot">
              <span class="reference-site-page__slot-key">{{ slot.key }}</span>
              {{ label('slotKind', slot.kind) }}
              <span v-if="slot.isArray">· 按数组给</span>
              <span v-if="slot.imageSpec?.w || slot.imageSpec?.h">
                · 图位约 {{ slot.imageSpec.w }}×{{ slot.imageSpec.h }}
              </span>
              <span v-if="slot.imageSpec?.prompt">· 需求单描述：{{ slot.imageSpec.prompt }}</span>
              <span v-if="slot.requiredSignal" class="reference-site-page__muted">
                · {{ label('requiredSignal', slot.requiredSignal) }}
              </span>
            </div>
            <div v-if="record.slotNote" class="reference-site-page__error">{{ record.slotNote }}</div>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="还没有槽位形状：抓取那一步（T4 之后）才会产出" />
        </template>
      </a-table>
      <p class="reference-site-page__muted">
        「必填」那一行说的是<b>必填是从哪一路看出来的</b>，不是「这个字段必须填」：
        我们的表单必填归服务端写死，区块侧没有必填开关槽。它最终的去处是前采里问客户的一道题。
      </p>

      <a-divider orientation="left">这一站用过的枚举组（栏目候选的原料）</a-divider>
      <a-table
        :data-source="vocabularyRows"
        :columns="vocabularyColumns"
        :pagination="false"
        row-key="rowKey"
        size="small"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'items'">
            <a-tag v-for="item in record.items" :key="item.slug || item.label">{{ item.label || item.slug }}</a-tag>
          </template>
          <template v-else-if="column.key === 'seenOn'">
            <span class="reference-site-page__muted">{{ (record.seenOn || []).join('、') }}</span>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="没有认出成组的枚举（下拉 / 单选复选 / 筛选 tabs / 卡片栅格标题）" />
        </template>
      </a-table>
      <p class="reference-site-page__muted">
        同一组枚举常在三处复用，所以带「出现在哪几条路由」。<b>它们是候选，不是栏目</b>：
        真正建栏目要过内容完整度与词表闸，这里只是把原料递过去。
      </p>

      <a-divider orientation="left">看得见的交互形状</a-divider>
      <div v-if="pkg.interactionHints.length" class="reference-site-page__hints">
        <a-tag v-for="hint in pkg.interactionHints" :key="hint.kind" color="blue">
          {{ label('interaction', hint.kind) }}（{{ hint.seenOn.length }} 条路由）
        </a-tag>
      </div>
      <p v-else class="reference-site-page__muted">
        没有记到任何交互形状。这一栏是「有就记、没有就不记」，空白不代表对方站点没有动效，
        只代表这一次抓取没看见——它不是待办清单。
      </p>
    </template>

    <a-empty v-else description="还没载入：这一栏是只读的取证快照，载入它不改变任务状态" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { referenceLabel, type ReferenceVocabularies, type TemplatePackage } from '../../../api/referenceSites'

/**
 * 拆出来的模板证据（Spec-E T5 的界面那一半）：一份只读取证快照。
 *
 * 词表那几套显示名全部来自 GET /vocabularies，认不出的取值原样显示——
 * 显示空白会被读成「这一格没值」，而它其实是「有值，只是这份词表旧了」。
 */

const props = defineProps<{
  pkg: TemplatePackage | null
  vocabularies: ReferenceVocabularies | null
  loading: boolean
}>()

const emit = defineEmits<{ (e: 'load'): void }>()

const slotShapeColumns = [
  { title: '在哪条路由', dataIndex: 'route', key: 'route', width: 180 },
  { title: '第几格', dataIndex: 'order', key: 'order', width: 80 },
  { title: '元素', dataIndex: 'tag', key: 'tag', width: 90 },
  { title: '这一格装得下什么', key: 'slots', width: 520 }
]

const vocabularyColumns = [
  { title: '组名', dataIndex: 'key', key: 'key', width: 160 },
  { title: '从哪种形状读出来的', dataIndex: 'source', key: 'source', width: 160 },
  { title: '取值', key: 'items', width: 380 },
  { title: '出现在哪几条路由', key: 'seenOn', width: 220 }
]

function label(group: keyof ReferenceVocabularies, value: string | null | undefined) {
  return referenceLabel(props.vocabularies, group, value)
}

/** 后端只有两个模式常量，且认不出家族时直接不写这一格：所以「没写」要说成没认出，不能说成某一种 */
const packageFamilyText = computed(() => {
  const family = props.pkg?.family
  return family ? family : '没认出固定家族（按通用判据处理，这一路同样能出结构）'
})

const siteTokenText = computed(() => {
  const tokens = props.pkg?.tokens
  const keys = tokens ? Object.keys(tokens) : []
  return keys.length ? `${keys.length} 项（只有这一层会上身成站点样式）` : '没有站级取值：sidecar 没在线，或这一页没被渲染采样'
})

const variedTokenText = computed(() => {
  const keys = props.pkg?.tokenVariedKeys || []
  return keys.length ? `${keys.length} 项各格不一致：${keys.join('、')}` : '各格一致'
})

/** 段级证据摊平成一行一格。缺这一段（T4 之前的老行）就是空表，界面显「还没有」 */
const slotShapeRows = computed(() => {
  const rows: Array<{
    rowKey: string
    route: string
    order: number | string
    tag: string
    slots: TemplatePackage['pages'][number]['slotShapes'][number]['slots']
    slotNote?: string
  }> = []
  for (const page of props.pkg?.pages || []) {
    for (const shape of page.slotShapes || []) {
      rows.push({
        rowKey: `${page.path}-${shape.order}`,
        route: page.path || '—',
        order: shape.order ?? '—',
        tag: shape.tag || '—',
        slots: shape.slots || [],
        slotNote: shape.slotNote
      })
    }
  }
  return rows
})

/** 词表行没有天然主键：同一组可能在多条路由上都出现过，用「组名 + 来源 + 首项」拼一个够稳的 */
const vocabularyRows = computed(() =>
  (props.pkg?.vocabulary || []).map((group, index) => ({
    ...group,
    rowKey: `${group.key}-${group.source}-${index}`
  }))
)
</script>

<style scoped lang="less">
.reference-site-page {
  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__error {
    color: #cf1322;
    display: inline-block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }

  &__slot {
    line-height: 1.7;
  }

  &__slot-key {
    display: inline-block;
    min-width: 62px;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 600;
  }

  &__hints {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
