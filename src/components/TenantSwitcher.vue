<template>
  <a-select
    v-model:value="selectedValue"
    placeholder="切换租户"
    show-search
    :options="options"
    :filter-option="filterOption"
    class="tenant-switcher"
    size="small"
    @change="handleChange"
  />
  <!--
    Spec-F §13-13 / P6-B 拍板 A 的界面那一半：超管点了个后端认不出来的租户时，读口回的是空结果，
    而空列表与「这家真的没有数据」在界面上长得一模一样——客户会据此得出「我们门户没人引用」这种假结论。
    所以这里必须把「这一批空是怎么来的」念出来，并且给一条出路（看全部租户 = 清空选择）。
  -->
  <div v-if="warningText" class="tenant-unresolved" data-test="tenant-unresolved">
    <ExclamationCircleFilled class="tenant-unresolved__icon" />
    <span class="tenant-unresolved__text">{{ warningText }}</span>
    <a-button
      type="link"
      size="small"
      class="tenant-unresolved__action"
      data-test="tenant-unresolved-clear"
      @click="clearSelection"
    >
      看全部租户
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { ExclamationCircleFilled } from '@ant-design/icons-vue'
import { tenantApi } from '../api/workspace'
import { useAuthStore } from '../stores/auth'
import type { Tenant } from '../types/workspace'

const authStore = useAuthStore()

const tenants = ref<Tenant[]>([])
// 初始就是 true：列表是 onMounted 才去读的，把「还没读回来」当成「读回来了、里面没有这一位」
// 会念出一句假话（（不在列表里）），而客户在那一瞬间看到的正是这一瞬。
const loading = ref(true)
/**
 * 「列表这次没读回来」和「列表读回来了、里面没有这一位」是两件事，得分开记。
 * 原来 catch 里只 console.error，tenants 保持空数组，于是 missingFromList 永远为 false（判据要求
 * `tenants.length > 0`），警告不念——可同时 options 也是空的，a-select 找不到 label 就把**租户号原样**
 * 打在顶栏上（现场截图上那个孤零零的「15」就是这么来的：一个裸数字，客户不知道它是谁）。
 */
const listFailed = ref(false)
const selectedValue = ref<number | null>(authStore.selectedTenantId)

/** 选中项在列表里找不到 label 时兜一条，顶栏至少念得出「租户 15」，不念一个裸数字 */
const options = computed(() => {
  const base = tenants.value.map((tenant) => ({
    label: tenant.name,
    value: tenant.id,
  }))
  if (selectedValue.value === null) return base
  if (base.some((o) => o.value === selectedValue.value)) return base
  const id = selectedValue.value
  const suffix = loading.value ? '' : listFailed.value ? '（列表没读到）' : '（不在列表里）'
  return [{ label: `租户 ${id}${suffix}`, value: id }, ...base]
})

const filterOption: SelectProps['filterOption'] = (input, option) => {
  return (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
}

/**
 * 两处判据，谁先知道算谁：
 * 1. 后端在响应头里点了名（X-Tenant-Unresolved）——那是库里的唯一真相，连「号存在但已被软删」都认得；
 * 2. 本地列表里翻不到这个号——列表已经拿到手了却找不到，说明这一位是旧的，不必等一次空结果才知道。
 *
 * 第 2 条要等列表真的取回来才敢判：`tenants.length` 为 0 时可能是这次读失败（下面 fetchTenants 里
 * 会另有一句「读不到租户列表」），把读失败念成「租户不存在」是第二种谎。
 */
const declaredByBackend = computed(() => authStore.tenantUnresolvedDeclaration ?? '')
const missingFromList = computed(() =>
  selectedValue.value !== null
  && !loading.value
  && !listFailed.value
  && tenants.value.length > 0
  && !tenants.value.some((t) => t.id === selectedValue.value)
)
const warningText = computed(() => {
  if (declaredByBackend.value) {
    return `租户「${declaredByBackend.value}」不存在或已被删除，现在是按空结果展示，不代表这家真的没有数据`
  }
  if (missingFromList.value) {
    return `选中的租户（${selectedValue.value}）已不在租户列表里，可能是已被删除或重名改号；现在是按空结果展示，不代表这家真的没有数据`
  }
  return ''
})

const fetchTenants = async () => {
  loading.value = true
  listFailed.value = false
  try {
    const result = await tenantApi.list()
    tenants.value = result || []
    listFailed.value = false
  } catch (error) {
    // 读失败要记账：不记就只能把「列表是空的」当成「这家不存在」，而兜底 label 也分不清该念哪一句
    listFailed.value = true
    console.error('获取租户列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleChange = (value: number) => {
  const tenant = tenants.value.find((t) => t.id === value)
  authStore.switchTenant(value, tenant?.code || null)
  window.location.reload()
}

/** 出路就是「清空选择」：回到超管的全租户视角，与右上角「返回管理员端」同一动作 */
const clearSelection = () => {
  authStore.switchTenant(null)
  selectedValue.value = null
  window.location.reload()
}

watch(
  () => authStore.selectedTenantId,
  (val) => {
    selectedValue.value = val
  }
)

onMounted(() => {
  fetchTenants()
})
</script>

<style scoped>
.tenant-switcher {
  width: 160px;
}

.tenant-switcher :deep(.ant-select-selector) {
  background-color: transparent !important;
  border: none !important;
  color: rgba(255, 255, 255, 0.85);
}

.tenant-switcher :deep(.ant-select-arrow) {
  color: rgba(255, 255, 255, 0.65);
}

.tenant-switcher :deep(.ant-select-selection-placeholder) {
  color: rgba(255, 255, 255, 0.45);
}

.tenant-switcher :deep(.ant-select-selection-item) {
  color: rgba(255, 255, 255, 0.85);
}

.tenant-switcher:hover :deep(.ant-select-selector) {
  background-color: rgba(255, 255, 255, 0.08) !important;
}

/* 顶栏是深色条，警告用暖色描边而不是默认的浅底卡片，宽度收着走免得挤掉右侧操作 */
.tenant-unresolved {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 420px;
  padding: 2px 10px;
  border: 1px solid rgba(250, 173, 20, 0.45);
  border-radius: var(--cg-radius, 6px);
  background-color: rgba(250, 173, 20, 0.12);
  color: var(--cg-warning, #faad14);
  font-size: 12px;
  line-height: 20px;
}

.tenant-unresolved__icon {
  flex: none;
}

.tenant-unresolved__text {
  flex: 1 1 auto;
}

.tenant-unresolved__action {
  flex: none;
  padding: 0 2px;
  height: auto;
  font-size: 12px;
  color: var(--cg-warning, #faad14);
}
</style>
