<template>
  <a-select
    v-model:value="selectedValue"
    placeholder="切换租户"
    show-search
    :options="options"
    :filter-option="filterOption"
    @change="handleChange"
    class="tenant-switcher"
    size="small"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { tenantApi } from '../api/workspace'
import { useAuthStore } from '../stores/auth'
import type { Tenant } from '../types/workspace'

const authStore = useAuthStore()

const tenants = ref<Tenant[]>([])
const loading = ref(false)
const selectedValue = ref<number | null>(authStore.selectedTenantId)

const options = computed(() => {
  return tenants.value.map((tenant) => ({
    label: tenant.name,
    value: tenant.id,
  }))
})

const filterOption: SelectProps['filterOption'] = (input, option) => {
  return (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
}

const fetchTenants = async () => {
  loading.value = true
  try {
    const result = await tenantApi.list()
    tenants.value = result || []
  } catch (error) {
    console.error('获取租户列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleChange = (value: number) => {
  const tenant = tenants.value.find((t) => t.id === value)
  authStore.switchTenant(value, tenant?.code || null)
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
</style>
