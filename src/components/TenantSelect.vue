<template>
  <a-select
    v-model:value="selectedValue"
    :placeholder="shownPlaceholder"
    :disabled="disabled || blocked"
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
import { useAuthStore } from '../stores/auth'

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

const auth = useAuthStore()

/**
 * 这一栏为什么没数。`/api/admin/tenants` 每个方法第一行都是 `AdminAuthUtils.checkSuperAdmin()`
 * ——它是平台侧的跨租户列表，租户档拿不到。以前失败只 console.error，用户面对的是一个
 * 空下拉框且界面一句解释都没有；现在把「没权限」和「读失败」和「真的没有租户」分开写。
 */
const issue = ref<'denied' | 'failed' | null>(null)
const failureText = ref('')

const blocked = computed(() => issue.value === 'denied')

const shownPlaceholder = computed(() => {
  if (issue.value === 'denied') {
    return '需要超级管理员权限，无法列出租户'
  }
  if (issue.value === 'failed') {
    return `租户列表读取失败：${failureText.value || '未知原因'}`
  }
  return props.placeholder
})

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
  if (!auth.isSuperAdmin) {
    issue.value = 'denied'
    return
  }
  loading.value = true
  try {
    const result = await tenantApi.list()
    tenants.value = result || []
    issue.value = null
  } catch (error: any) {
    console.error('获取租户列表失败:', error)
    tenants.value = []
    issue.value = 'failed'
    failureText.value = error?.message || ''
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
    if (issue.value) {
      return
    }
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
