<script setup lang="ts">
/**
 * 列表三态契约的活例子（SPEC-UI-8 G3）。
 *
 * 这一页不进菜单（路由 `meta.hidden`），只能从地址 `/workspace/dev/list-states` 进。
 * 存在的理由：契约文档写在 docs 里，新页面抄的时候仍可能抄错——这里摆一份能跑的，
 * 「成功有行 / 成功 0 行 / 读失败 → 重试恢复」可手动切换，抄它即天然带 `:error` + `:retry`。
 *
 * 三种可切换状态演示的是同一条判据：读失败时整张表退场，绝不同屏念「这一档没有」。
 */
import { computed, ref } from 'vue'
import RecordListPage from '../../components/RecordListPage.vue'

type DemoState = 'rows' | 'empty' | 'failed'

const state = ref<DemoState>('rows')
const loading = ref(false)

const COLUMNS = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '状态', dataIndex: 'status', key: 'status' }
]

const SAMPLE_ROWS = [
  { id: 1, name: '示例记录一', status: '启用' },
  { id: 2, name: '示例记录二', status: '停用' }
]

const rows = computed(() => (state.value === 'rows' ? SAMPLE_ROWS : []))
const readFailed = computed(() => (state.value === 'failed' ? '服务器处理失败，请稍后重试或联系管理员' : ''))
const countLine = computed(() => (state.value === 'rows' ? `共 ${SAMPLE_ROWS.length} 条` : ''))

/** 演示「重试成功」：失败态点重试，1.2s 后回到有行那一档 */
async function retry(): Promise<void> {
  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 1200))
  loading.value = false
  state.value = 'rows'
}

function switchTo(next: DemoState): void {
  state.value = next
}

const OPTIONS: Array<{ value: DemoState; label: string }> = [
  { value: 'rows', label: '成功有行' },
  { value: 'empty', label: '成功 0 行' },
  { value: 'failed', label: '读失败' }
]
</script>

<template>
  <div class="list-state-demo">
    <div class="list-state-demo__bar">
      <span class="list-state-demo__hint">切换状态看三态块怎么换话；在读失败里点「重试」，1.2s 后回到有行（这一页不进菜单）</span>
      <a-button
        v-for="option in OPTIONS"
        :key="option.value"
        :type="state === option.value ? 'primary' : 'default'"
        size="small"
        @click="switchTo(option.value)"
      >
        {{ option.label }}
      </a-button>
    </div>

    <RecordListPage
      description="列表三态契约示例：读失败时整张表退场，只说失败那一句"
      :loading="loading"
      :rows="rows"
      :columns="COLUMNS"
      :count-line="countLine"
      :read-failed="readFailed"
      :retry="retry"
      empty-line="示例记录：这一档查过了，一条都没有。"
      empty-reason="NONE"
    />
  </div>
</template>

<style scoped lang="less">
.list-state-demo {
  &__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: var(--admin-space-2, 16px);
  }

  &__hint {
    margin-right: 8px;
    font-size: 12px;
    color: var(--admin-text-secondary);
  }
}
</style>
