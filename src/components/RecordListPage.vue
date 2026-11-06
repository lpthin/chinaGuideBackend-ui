<script setup lang="ts">
/**
 * 「一行读数 + 一张表」这类列表页的模板（Spec-Q §4.1 的 A/B 型，P1 第一次落地）。
 *
 * 立这个组件的唯一理由是实测：站点内容那一组 12 页里，同一件事各自抄了四份
 * （表格的 `:scroll`、`:pagination="false"`、空态那一句、读数那一行的字号与颜色），
 * 于是「空态摆成 726px 一大块」「窄屏把列碾成一字一行」这类毛病一次修不完。
 * 这里把六件事收在一处，页面只留它自己那份数据与列定义：
 *
 * 1. 表一律横向可滚（DataTable 的 `scroll` 兜底 = `max-content`），页面不再各自想起来写。
 * 2. 空 / 读失败 / 还没发出去 三态各说各的：读失败走 DataTable 的错误块，整张表退场，
 *    绝不让「读取失败」与「这一档没有」同屏；真·没行才走 EmptyListHint 那五份话。
 * 3. 读数那一行（`共 N 条` / `共 N 家`）的字号与底色只在这一份里。
 * 4. 筛选靠左、动作靠右由 FilterBar 保证，页面不再把工具条塞进卡头。
 * 5. 分页仍由页面自己摆在 `footer` 槽：这一组四个读口里两个是分页的、两个一次全回，
 *    把翻页方式写死进模板会替后端决定它没决定的事。
 * 6. `#bodyCell` 这类表格插槽原样透传给页面，页面不必为了套模板重写列渲染。
 *
 * 不做的：模板不猜「共多少条」该怎么算——那句中文由页面按后端口径拼好交进来（`countLine`），
 * 免得这里长出第二套「条 / 家 / 个」的量词。
 */
import { computed, useSlots } from 'vue'
import DataTable from './DataTable.vue'
import EmptyListHint from './EmptyListHint.vue'
import FilterBar from './FilterBar.vue'
import PageTitle from './PageTitle.vue'
import type { EmptyReason } from '../utils/emptyPage'

withDefaults(
  defineProps<{
    /** 副标题：这一页是干什么的，只这一句，不再往卡头里塞说明 */
    description?: string
    loading?: boolean
    rows?: readonly unknown[]
    columns?: readonly unknown[]
    /** 读数那一整句（含量词），空着就不摆这一行 */
    countLine?: string
    /** 读失败那句后端原文：非空时整张表退场，只说失败 */
    readFailed?: string
    /** 后端答了成因时那句原文，界面不改写 */
    emptyLine?: string
    emptyReason?: EmptyReason
    /** 后端不回成因的读口，页面自己那句更具体的空话（门店的「还没有录过门店」就是其一） */
    ownLine?: string
    notSent?: string
    canCreate?: boolean
    createLabel?: string
  }>(),
  {
    description: '',
    loading: false,
    rows: () => [],
    columns: () => [],
    countLine: '',
    readFailed: '',
    emptyLine: '',
    emptyReason: null,
    ownLine: '',
    notSent: '',
    canCreate: false,
    createLabel: '新建',
  }
)

const emit = defineEmits<{ create: [] }>()

const slots = useSlots()
/** 模板自己消费掉的插槽名，剩下的才是表格的（bodyCell、expandedRowRender 这一类），原样往下传 */
const TEMPLATE_SLOTS = ['extra', 'notice', 'above', 'filters', 'actions', 'footer'] as const
const tableSlotNames = computed(() =>
  Object.keys(slots).filter(name => !(TEMPLATE_SLOTS as readonly string[]).includes(name))
)
</script>

<template>
  <div class="record-list-page">
    <PageTitle :description="description">
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
    </PageTitle>

    <div v-if="$slots.notice" class="record-list-page__notice">
      <slot name="notice" />
    </div>

    <a-card :bordered="false">
      <div v-if="$slots.above" class="record-list-page__above">
        <slot name="above" />
      </div>

      <FilterBar>
        <slot name="filters" />
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
      </FilterBar>

      <p v-if="countLine" class="record-list-page__count">{{ countLine }}</p>

      <DataTable
        :data-source="rows"
        :loading="loading"
        :error="readFailed"
        :pagination="false"
        v-bind="{ columns }"
      >
        <template v-for="name in tableSlotNames" #[name]="slotData">
          <slot :name="name" v-bind="slotData ?? {}" />
        </template>
        <template #emptyText>
          <EmptyListHint
            :loading="loading"
            :empty-line="emptyLine"
            :empty-reason="emptyReason"
            :own-line="ownLine"
            :not-sent="notSent"
            :can-create="canCreate"
            :create-label="createLabel"
            @create="emit('create')"
          />
        </template>
      </DataTable>

      <div v-if="$slots.footer" class="record-list-page__footer">
        <slot name="footer" />
      </div>
    </a-card>
  </div>
</template>

<style scoped lang="less">
.record-list-page {
  width: 100%;

  &__notice {
    margin-bottom: var(--admin-space-2);
  }

  &__above {
    margin-bottom: var(--admin-space-2);
  }

  /* 读数那一行：原来四页各抄一份（13px/#8c8c8c 与 12px/#8c8c8c 混着用），这里定一处 */
  &__count {
    margin: 0 0 var(--admin-space-1);
    font-size: 13px;
    color: var(--admin-text-secondary);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--admin-space-2);
  }
}
</style>
