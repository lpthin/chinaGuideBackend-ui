<template>
  <a-drawer
    :open="open"
    title="这一家的互动总账"
    :width="560"
    placement="right"
    @update:open="emit('update:open', $event)"
  >
    <template #extra>
      <a-button size="small" :loading="loading" :disabled="loading" @click="emit('reload')">刷新</a-button>
    </template>
    <a-spin :spinning="loading">
      <a-alert v-if="error" type="error" show-icon message="总账没读到" :description="error" />
      <div v-else class="stat-grid">
        <div v-for="cell in cells" :key="cell.key" class="stat-cell">
          <div class="stat-cell__value">{{ cell.value }}</div>
          <div class="stat-cell__label">{{ cell.label }}</div>
          <div class="stat-cell__note">{{ cell.note }}</div>
        </div>
      </div>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 「这一家的互动总账」十格（Spec-R R1）：原来在首屏占 297px、手机那一档 10 格排成 10 行占 1021px。
 * 现在收进抽屉，页面上只留「等我处理的读者评论」那一格。
 *
 * 每格下面那句「数的是谁」照后端口径写：`countComments(tenant, source, null)` 会把 removed 排除掉，
 * 所以「读者评论总数」「系统补写的评论」两格都不含已摘除的；点赞两格没有状态这一维。
 */
import { computed } from 'vue'
import type { InteractionStats } from '../../../api/interaction'

const props = defineProps<{
  open: boolean
  loading: boolean
  error: string
  platformMode: boolean
  stats: InteractionStats | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean], reload: [] }>()

const CELLS: Array<{ key: keyof InteractionStats, label: string, note: string }> = [
  { key: 'pendingReaderComments', label: '等我处理的读者评论', note: '只数读者写的、还在待审的；页面上留的就是这一格' },
  { key: 'approvedReaderComments', label: '已对外的读者评论', note: '只数读者写的、已经放行的' },
  { key: 'readerComments', label: '读者评论总数', note: '读者写的，不含已摘除的' },
  { key: 'seededComments', label: '系统补写的评论', note: '系统按开关补的，不含已摘除的' },
  { key: 'readerLikes', label: '真人点的赞', note: '访客在文章下面点的' },
  { key: 'virtualLikes', label: '系统补写的赞', note: '发布那一刻按区间补的' },
  { key: 'seedPending', label: '还在等时刻的补写计划', note: '排产计划里还没到点的' },
  { key: 'seedDone', label: '已补写完成', note: '到点真补进去了的' },
  { key: 'seedSkipped', label: '到点没补（已说明原因）', note: '原因在「排产计划」那张表里逐条写着' },
  { key: 'seedFailed', label: '补写失败', note: '到点补写时报错的' }
]

const cells = computed(() => CELLS.map(cell => ({
  ...cell,
  // 平台档没有「这一家」：十格一起摆 —，与「读回来是 0」分开
  value: props.platformMode ? '—' : (props.stats ? Number(props.stats[cell.key] ?? 0) : 0)
})))
</script>

<style scoped lang="less">
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.stat-cell {
  background: var(--admin-fill-hover);
  border-radius: 6px;
  padding: 12px var(--admin-space-2);

  &__value {
    font-size: 22px;
    font-weight: 600;
    color: var(--admin-text-primary);
    font-variant-numeric: var(--admin-font-nums);
  }

  &__label {
    margin-top: 2px;
    font-size: 13px;
    color: var(--admin-text-primary);
  }

  &__note {
    margin-top: 2px;
    font-size: 12px;
    color: var(--admin-text-secondary);
  }
}
</style>