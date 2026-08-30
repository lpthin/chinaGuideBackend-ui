<template>
  <a-select
    v-model:value="selectedValue"
    :placeholder="placeholder"
    :disabled="disabled"
    show-search
    :options="options"
    :filter-option="filterOption"
    @change="handleChange"
    class="tenant-select"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { tenantApi } from '../api/workspace'
import type { Tenant } from '../types/workspace'

interface Props {
  modelValue?: number
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: '请选择租户',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | undefined): void
  (e: 'change', tenant: Tenant | null): void
}>()

const tenants = ref<Tenant[]>([])
const loading = ref(false)
const selectedValue = ref<number | undefined>(props.modelValue)

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

const getCurrentTenant = (id: number): Tenant | undefined => {
  return tenants.value.find((t) => t.id === id)
}

const handleChange = (value: number) => {
  const tenant = getCurrentTenant(value)
  if (tenant) {
    localStorage.setItem('geocms_tenant_id', String(tenant.id))
    localStorage.setItem('geocms_tenant_code', tenant.code)
  }
  emit('update:modelValue', value)
  emit('change', tenant || null)
}

watch(
  () => props.modelValue,
  (val) => {
    selectedValue.value = val
  }
)

onMounted(() => {
  fetchTenants().then(() => {
    if (selectedValue.value === undefined) {
      const storedTenantId = localStorage.getItem('geocms_tenant_id')
      if (storedTenantId) {
        const id = Number(storedTenantId)
        const tenant = getCurrentTenant(id)
        if (tenant) {
          selectedValue.value = id
        }
      }
    }
  })
})
</script>

<style scoped>
.tenant-select {
  width: 100%;
}
</style>
