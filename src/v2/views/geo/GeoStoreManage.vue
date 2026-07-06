<template>
  <div class="geo-store-manage-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <ShopOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalStores }}</div>
                <div class="stat-title">总门店</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.openStores }}</div>
                <div class="stat-title">营业中</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)">
                <CloseCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.closedStores }}</div>
                <div class="stat-title">已关闭</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%)">
                <ToolOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.maintenanceStores }}</div>
                <div class="stat-title">维护中</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-card :bordered="false">
        <template #title>
          <a-space wrap>
            <a-select
              v-model:value="queryParams.provinceId"
              style="width: 140px"
              placeholder="选择省份"
              allow-clear
              @change="onProvinceChange"
            >
              <a-select-option v-for="p in provinceList" :key="p.id" :value="p.id">
                {{ p.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.cityId"
              style="width: 140px"
              placeholder="选择城市"
              allow-clear
              :disabled="!queryParams.provinceId"
              @change="onCityChange"
            >
              <a-select-option v-for="c in cityList" :key="c.id" :value="c.id">
                {{ c.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.districtId"
              style="width: 140px"
              placeholder="选择区县"
              allow-clear
              :disabled="!queryParams.cityId"
              @change="loadStores"
            >
              <a-select-option v-for="d in districtList" :key="d.id" :value="d.id">
                {{ d.name }}
              </a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.status"
              style="width: 120px"
              placeholder="状态"
              allow-clear
              @change="loadStores"
            >
              <a-select-option :value="GeoStoreStatus.OPEN">营业中</a-select-option>
              <a-select-option :value="GeoStoreStatus.CLOSED">已关闭</a-select-option>
              <a-select-option :value="GeoStoreStatus.MAINTENANCE">维护中</a-select-option>
            </a-select>
            <a-select
              v-model:value="queryParams.type"
              style="width: 120px"
              placeholder="门店类型"
              allow-clear
              @change="loadStores"
            >
              <a-select-option :value="StoreType.DIRECT">直营店</a-select-option>
              <a-select-option :value="StoreType.FRANCHISE">加盟店</a-select-option>
              <a-select-option :value="StoreType.BRANCH">分店</a-select-option>
            </a-select>
            <a-input-search
              v-model:value="queryParams.keyword"
              placeholder="搜索门店名称/地址"
              style="width: 280px"
              enter-button
              @search="loadStores"
            />
            <a-button type="primary" @click="handleAdd">
              <template #icon><PlusOutlined /></template>
              新增门店
            </a-button>
          </a-space>
        </template>

        <template #extra>
          <a-space>
            <a-button @click="handleBatchDelete" :disabled="selectedRowKeys.length === 0" danger>
              <template #icon><DeleteOutlined /></template>
              批量删除
            </a-button>
            <a-button @click="exportData">
              <template #icon><DownloadOutlined /></template>
              导出
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="storeList"
          :pagination="pagination"
          :row-selection="rowSelection"
          :row-key="getRowKey"
          :loading="tableLoading"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'storeInfo'">
              <div class="store-info-cell">
                <div class="store-cover-placeholder">
                  <ShopOutlined />
                </div>
                <div class="store-detail">
                  <div class="store-name">{{ record.name }}</div>
                  <div class="store-no">编号: {{ record.storeNo }}</div>
                </div>
              </div>
            </template>
            <template v-if="column.key === 'type'">
              <a-tag :color="getTypeColor(record.type)">
                {{ getTypeName(record.type) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusName(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'address'">
              <div class="address-cell">
                <div>{{ record.fullAddress }}</div>
                <div class="address-detail" v-if="record.phone">电话: {{ record.phone }}</div>
              </div>
            </template>
            <template v-if="column.key === 'manager'">
              <div>
                <div>{{ record.managerName }}</div>
                <div class="manager-phone">{{ record.managerPhone }}</div>
              </div>
            </template>
            <template v-if="column.key === 'actions'">
              <a-space>
                <a-dropdown :trigger="['click']">
                  <a-button type="link" size="small">
                    操作 <DownOutlined />
                  </a-button>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item @click="handleView(record)">
                        <EyeOutlined /> 查看
                      </a-menu-item>
                      <a-menu-item @click="handleEdit(record)">
                        <EditOutlined /> 编辑
                      </a-menu-item>
                      <a-menu-item v-if="record.status === GeoStoreStatus.OPEN" @click="handleToggleStatus(record, GeoStoreStatus.CLOSED)">
                        <CloseCircleOutlined /> 关闭
                      </a-menu-item>
                      <a-menu-item v-if="record.status !== GeoStoreStatus.OPEN" @click="handleToggleStatus(record, GeoStoreStatus.OPEN)">
                        <CheckCircleOutlined /> 启用
                      </a-menu-item>
                      <a-menu-item @click="handleToggleStatus(record, GeoStoreStatus.MAINTENANCE)">
                        <ToolOutlined /> 设为维护
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item danger @click="handleDelete(record)">
                        <DeleteOutlined /> 删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>

    <a-modal
      v-model:open="modalVisible"
      :title="modalTitle"
      width="800px"
      :confirm-loading="modalLoading"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :mask-closable="false"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="门店名称" name="name">
              <a-input v-model:value="formData.name" placeholder="请输入门店名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="门店编号" name="storeNo">
              <a-input v-model:value="formData.storeNo" placeholder="请输入门店编号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="门店类型" name="type">
              <a-select v-model:value="formData.type" placeholder="请选择门店类型">
                <a-select-option :value="StoreType.DIRECT">直营店</a-select-option>
                <a-select-option :value="StoreType.FRANCHISE">加盟店</a-select-option>
                <a-select-option :value="StoreType.BRANCH">分店</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态" name="status">
              <a-select v-model:value="formData.status" placeholder="请选择状态">
                <a-select-option :value="GeoStoreStatus.OPEN">营业中</a-select-option>
                <a-select-option :value="GeoStoreStatus.CLOSED">已关闭</a-select-option>
                <a-select-option :value="GeoStoreStatus.MAINTENANCE">维护中</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="排序" name="sortOrder">
              <a-input-number v-model:value="formData.sortOrder" style="width: 100%" placeholder="排序号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="省份" name="provinceId">
              <a-select v-model:value="formData.provinceId" placeholder="请选择省份" @change="onFormProvinceChange">
                <a-select-option v-for="p in provinceList" :key="p.id" :value="p.id">
                  {{ p.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="城市" name="cityId">
              <a-select v-model:value="formData.cityId" placeholder="请选择城市" :disabled="!formData.provinceId" @change="onFormCityChange">
                <a-select-option v-for="c in formCityList" :key="c.id" :value="c.id">
                  {{ c.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="区县" name="districtId">
              <a-select v-model:value="formData.districtId" placeholder="请选择区县" :disabled="!formData.cityId">
                <a-select-option v-for="d in formDistrictList" :key="d.id" :value="d.id">
                  {{ d.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="详细地址" name="address">
          <a-input v-model:value="formData.address" placeholder="请输入详细地址" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="经度" name="lng">
              <a-input-number v-model:value="formData.lng" style="width: 100%" :precision="6" placeholder="经度" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="纬度" name="lat">
              <a-input-number v-model:value="formData.lat" style="width: 100%" :precision="6" placeholder="纬度" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="联系电话" name="phone">
              <a-input v-model:value="formData.phone" placeholder="请输入联系电话" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="电子邮箱" name="email">
              <a-input v-model:value="formData.email" placeholder="请输入电子邮箱" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="营业时间" name="businessHours">
          <a-input v-model:value="formData.businessHours" placeholder="例如: 周一至周日 09:00-22:00" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="负责人" name="managerName">
              <a-input v-model:value="formData.managerName" placeholder="请输入负责人姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="负责人电话" name="managerPhone">
              <a-input v-model:value="formData.managerPhone" placeholder="请输入负责人电话" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="标签" name="tags">
          <a-input v-model:value="formData.tags" placeholder="多个标签用逗号分隔" />
        </a-form-item>
        <a-form-item label="门店描述" name="description">
          <a-textarea v-model:value="formData.description" :rows="3" placeholder="请输入门店描述" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, type Ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import {
  ShopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ToolOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons-vue'
import { GeoStoreStatus, StoreType } from '../../types/geo'
import type { GeoStore, GeoStoreQuery, GeoStoreForm, GeoRegion } from '../../types/geo'
import { geoStoreApi, geoRegionApi } from '../../api/geo'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const tableLoading = ref(false)
const modalVisible = ref(false)
const modalLoading = ref(false)
const isEdit = ref(false)
const selectedRowKeys = ref<number[]>([])
const formRef = ref<FormInstance>()

const stats = reactive({
  totalStores: 0,
  openStores: 0,
  closedStores: 0,
  maintenanceStores: 0,
})

const queryParams = reactive<GeoStoreQuery>({
  provinceId: undefined,
  cityId: undefined,
  districtId: undefined,
  status: undefined,
  type: undefined,
  keyword: '',
  page: 1,
  size: 10,
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, pageSize: number) => {
    pagination.current = page
    pagination.pageSize = pageSize
    queryParams.page = page
    queryParams.size = pageSize
    loadStores()
  },
})

const storeList = ref<GeoStore[]>([])
const provinceList = ref<GeoRegion[]>([])
const cityList = ref<GeoRegion[]>([])
const districtList = ref<GeoRegion[]>([])
const formCityList = ref<GeoRegion[]>([])
const formDistrictList = ref<GeoRegion[]>([])

const formData = reactive<GeoStoreForm>({
  name: '',
  storeNo: '',
  type: StoreType.DIRECT,
  address: '',
  provinceId: 0,
  cityId: 0,
  districtId: 0,
  lng: 0,
  lat: 0,
  phone: '',
  email: '',
  businessHours: '',
  description: '',
  tags: '',
  sortOrder: 0,
  status: GeoStoreStatus.OPEN,
  managerName: '',
  managerPhone: '',
})

const formRules = {
  name: [{ required: true, message: '请输入门店名称', trigger: 'blur' }],
  storeNo: [{ required: true, message: '请输入门店编号', trigger: 'blur' }],
  type: [{ required: true, message: '请选择门店类型', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
  provinceId: [{ required: true, message: '请选择省份', trigger: 'change' }],
  cityId: [{ required: true, message: '请选择城市', trigger: 'change' }],
  districtId: [{ required: true, message: '请选择区县', trigger: 'change' }],
  address: [{ required: true, message: '请输入详细地址', trigger: 'blur' }],
  managerName: [{ required: true, message: '请输入负责人姓名', trigger: 'blur' }],
  managerPhone: [{ required: true, message: '请输入负责人电话', trigger: 'blur' }],
}

const modalTitle = computed(() => isEdit.value ? '编辑门店' : '新增门店')

const columns = [
  { title: '门店信息', key: 'storeInfo', width: 240 },
  { title: '类型', key: 'type', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '地址', key: 'address', width: 280 },
  { title: '负责人', key: 'manager', width: 140 },
  { title: '营业时间', dataIndex: 'businessHours', key: 'businessHours', width: 180 },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'center' as const },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 100 },
]

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: number[]) => {
    selectedRowKeys.value = keys
  },
}))

function getRowKey(record: GeoStore): number {
  return record.id
}

function getTypeName(type: StoreType): string {
  const nameMap: Record<StoreType, string> = {
    [StoreType.DIRECT]: '直营店',
    [StoreType.FRANCHISE]: '加盟店',
    [StoreType.BRANCH]: '分店',
  }
  return nameMap[type] || type
}

function getTypeColor(type: StoreType): string {
  const colorMap: Record<StoreType, string> = {
    [StoreType.DIRECT]: 'blue',
    [StoreType.FRANCHISE]: 'purple',
    [StoreType.BRANCH]: 'cyan',
  }
  return colorMap[type] || 'default'
}

function getStatusName(status: GeoStoreStatus): string {
  const nameMap: Record<GeoStoreStatus, string> = {
    [GeoStoreStatus.OPEN]: '营业中',
    [GeoStoreStatus.CLOSED]: '已关闭',
    [GeoStoreStatus.MAINTENANCE]: '维护中',
  }
  return nameMap[status] || status
}

function getStatusColor(status: GeoStoreStatus): string {
  const colorMap: Record<GeoStoreStatus, string> = {
    [GeoStoreStatus.OPEN]: 'green',
    [GeoStoreStatus.CLOSED]: 'red',
    [GeoStoreStatus.MAINTENANCE]: 'orange',
  }
  return colorMap[status] || 'default'
}

function onProvinceChange() {
  queryParams.cityId = undefined
  queryParams.districtId = undefined
  cityList.value = []
  districtList.value = []
  if (queryParams.provinceId) {
    loadCities(queryParams.provinceId, cityList)
  }
  loadStores()
}

function onCityChange() {
  queryParams.districtId = undefined
  districtList.value = []
  if (queryParams.cityId) {
    loadDistricts(queryParams.cityId, districtList)
  }
  loadStores()
}

function onFormProvinceChange() {
  formData.cityId = 0
  formData.districtId = 0
  formCityList.value = []
  formDistrictList.value = []
  if (formData.provinceId) {
    loadCities(formData.provinceId, formCityList)
  }
}

function onFormCityChange() {
  formData.districtId = 0
  formDistrictList.value = []
  if (formData.cityId) {
    loadDistricts(formData.cityId, formDistrictList)
  }
}

async function loadCities(provinceId: number, target: Ref<GeoRegion[]>) {
  try {
    const res = await geoRegionApi.cities(provinceId)
    target.value = res
  } catch (error) {
    message.error('加载城市列表失败')
    console.error(error)
  }
}

async function loadDistricts(cityId: number, target: Ref<GeoRegion[]>) {
  try {
    const res = await geoRegionApi.districts(cityId)
    target.value = res
  } catch (error) {
    message.error('加载区县列表失败')
    console.error(error)
  }
}

function handleAdd() {
  isEdit.value = false
  resetForm()
  modalVisible.value = true
}

function handleView(record: GeoStore) {
  message.info(`查看门店: ${record.name}`)
}

function handleEdit(record: GeoStore) {
  isEdit.value = true
  formData.id = record.id
  formData.name = record.name
  formData.storeNo = record.storeNo
  formData.type = record.type
  formData.status = record.status
  formData.provinceId = record.provinceId
  formData.cityId = record.cityId
  formData.districtId = record.districtId
  formData.address = record.address
  formData.lng = record.lng
  formData.lat = record.lat
  formData.phone = record.phone
  formData.email = record.email
  formData.businessHours = record.businessHours
  formData.description = record.description
  formData.tags = record.tags
  formData.sortOrder = record.sortOrder
  formData.managerName = record.managerName
  formData.managerPhone = record.managerPhone
  
  if (formData.provinceId) {
    loadCities(formData.provinceId, formCityList)
  }
  if (formData.cityId) {
    loadDistricts(formData.cityId, formDistrictList)
  }
  
  modalVisible.value = true
}

async function handleToggleStatus(record: GeoStore, status: GeoStoreStatus) {
  try {
    await geoStoreApi.update(record.id, { ...record, status })
    message.success(`已${getStatusName(status)}: ${record.name}`)
    loadStores()
    loadStatistics()
  } catch (error) {
    message.error('状态更新失败')
    console.error(error)
  }
}

function handleDelete(record: GeoStore) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除门店「${record.name}」吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await geoStoreApi.delete(record.id)
        message.success('删除成功')
        loadStores()
        loadStatistics()
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      }
    },
  })
}

function handleBatchDelete() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请选择要删除的门店')
    return
  }
  Modal.confirm({
    title: '批量删除',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 个门店吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await geoStoreApi.batchDelete(selectedRowKeys.value)
        message.success(`已删除 ${selectedRowKeys.value.length} 个门店`)
        selectedRowKeys.value = []
        loadStores()
        loadStatistics()
      } catch (error) {
        message.error('批量删除失败')
        console.error(error)
      }
    },
  })
}

function exportData() {
  message.info('导出功能')
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    if (isEdit.value && formData.id) {
      await geoStoreApi.update(formData.id, formData)
      message.success('更新成功')
    } else {
      await geoStoreApi.create(formData)
      message.success('创建成功')
    }
    modalVisible.value = false
    loadStores()
    loadStatistics()
  } catch (error) {
    message.error(isEdit.value ? '更新失败' : '创建失败')
    console.error(error)
  } finally {
    modalLoading.value = false
  }
}

function handleCancel() {
  modalVisible.value = false
}

function resetForm() {
  formData.id = undefined
  formData.name = ''
  formData.storeNo = ''
  formData.type = StoreType.DIRECT
  formData.status = GeoStoreStatus.OPEN
  formData.provinceId = 0
  formData.cityId = 0
  formData.districtId = 0
  formData.address = ''
  formData.lng = 0
  formData.lat = 0
  formData.phone = ''
  formData.email = ''
  formData.businessHours = ''
  formData.description = ''
  formData.tags = ''
  formData.sortOrder = 0
  formData.managerName = ''
  formData.managerPhone = ''
  formCityList.value = []
  formDistrictList.value = []
}

async function loadStatistics() {
  try {
    const res = await geoStoreApi.statistics()
    stats.totalStores = res.totalStores
    stats.openStores = res.openStores
    stats.closedStores = res.closedStores
    stats.maintenanceStores = res.maintenanceStores
  } catch (error) {
    message.error('加载统计数据失败')
    console.error(error)
  }
}

async function loadProvinces() {
  try {
    const res = await geoRegionApi.provinces()
    provinceList.value = res
  } catch (error) {
    message.error('加载省份列表失败')
    console.error(error)
  }
}

async function loadStores() {
  tableLoading.value = true
  try {
    const params = {
      ...queryParams,
      tenantId: authStore.selectedTenantId || authStore.tenantId,
    }
    const res = await geoStoreApi.list(params)
    storeList.value = res.records
    pagination.total = res.total
    pagination.current = res.page
    pagination.pageSize = res.size
  } catch (error) {
    message.error('加载门店列表失败')
    console.error(error)
  } finally {
    tableLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    await Promise.all([
      loadProvinces(),
      loadStores(),
      loadStatistics(),
    ])
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadData()
})

watch(() => authStore.selectedTenantId, () => {
  loadData()
})
</script>

<style scoped lang="less">
.geo-store-manage-page {
  width: 100%;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.store-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.store-cover-placeholder {
  width: 56px;
  height: 48px;
  border-radius: 6px;
  background: linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #1890ff;
  flex-shrink: 0;
}

.store-detail {
  flex: 1;
  min-width: 0;
}

.store-name {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-no {
  font-size: 12px;
  color: #8c8c8c;
}

.address-cell {
  font-size: 13px;
  color: #1a1a1a;
}

.address-detail {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
}

.manager-phone {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 2px;
}
</style>
