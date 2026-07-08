<template>
  <div class="geo-region-manage-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <EnvironmentOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.provinceCount }}</div>
                <div class="stat-title">省份数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <ApartmentOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.cityCount }}</div>
                <div class="stat-title">城市数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <BankOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.districtCount }}</div>
                <div class="stat-title">区县数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%)">
                <GlobalOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalCount }}</div>
                <div class="stat-title">总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="6">
          <a-card :bordered="false" title="行政区划" :loading="treeLoading">
            <template #extra>
              <a-button type="link" size="small" @click="loadTreeData">
                <ReloadOutlined /> 刷新
              </a-button>
            </template>
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索区域"
              style="margin-bottom: 12px"
              allow-clear
              @search="handleSearch"
            />
            <a-tree
              :tree-data="treeData"
              :field-names="{ title: 'name', key: 'id', children: 'children' }"
              :expanded-keys="expandedKeys"
              :selected-keys="selectedKeys"
              @expand="onExpand"
              @select="onSelect"
              draggable
              @drop="onDrop"
            >
              <template #title="record">
                <span>
                  <span>{{ record.name }}</span>
                  <span style="color: #999; margin-left: 8px; font-size: 12px">{{ record.code }}</span>
                </span>
              </template>
            </a-tree>
          </a-card>
        </a-col>
        <a-col :span="18">
          <a-card :bordered="false">
            <template #title>
              <a-space>
                <span v-if="currentRegion">{{ currentRegion.fullName || currentRegion.name }} - 下级区域</span>
                <span v-else>全部区域</span>
              </a-space>
            </template>
            <template #extra>
              <a-space>
                <a-button @click="handleAddRoot" v-if="!currentRegion || currentRegion.level < 3">
                  <template #icon><PlusOutlined /></template>
                  新增{{ currentRegion ? getChildLevelText(currentRegion.level) : '省份' }}
                </a-button>
                <a-button @click="handleEdit" :disabled="!currentRegion">
                  <template #icon><EditOutlined /></template>
                  编辑
                </a-button>
                <a-popconfirm
                  title="确定要删除这个区域吗？"
                  :disabled="!currentRegion"
                  @confirm="handleDelete"
                >
                  <a-button danger :disabled="!currentRegion">
                    <template #icon><DeleteOutlined /></template>
                    删除
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>

            <a-table
              :columns="columns"
              :data-source="regionList"
              :pagination="pagination"
              :row-key="getRowKey"
              :loading="tableLoading"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'level'">
                  <a-tag :color="getLevelColor(record.level)">
                    {{ getLevelText(record.level) }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'status'">
                  <a-tag :color="record.status === 'active' ? 'green' : 'default'">
                    {{ record.status === 'active' ? '启用' : '禁用' }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'actions'">
                  <a-space>
                    <a-button type="link" size="small" @click="handleView(record)">查看</a-button>
                    <a-button type="link" size="small" @click="handleEditRecord(record)">编辑</a-button>
                    <a-popconfirm
                      title="确定要删除这个区域吗？"
                      @confirm="handleDeleteRecord(record)"
                    >
                      <a-button type="link" size="small" danger>删除</a-button>
                    </a-popconfirm>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-modal
      v-model:open="modalVisible"
      :title="modalTitle"
      width="600px"
      :confirm-loading="modalLoading"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="区域名称" name="name">
              <a-input v-model:value="formData.name" placeholder="请输入区域名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="区域编码" name="code">
              <a-input v-model:value="formData.code" placeholder="请输入区域编码" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="全称" name="fullName">
              <a-input v-model:value="formData.fullName" placeholder="请输入全称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="拼音" name="pinyin">
              <a-input v-model:value="formData.pinyin" placeholder="请输入拼音" />
            </a-form-item>
          </a-col>
        </a-row>
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
            <a-form-item label="排序" name="sortOrder">
              <a-input-number v-model:value="formData.sortOrder" style="width: 100%" placeholder="排序号" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态" name="status">
              <a-select v-model:value="formData.status" placeholder="请选择状态">
                <a-select-option value="active">启用</a-select-option>
                <a-select-option value="inactive">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import {
  EnvironmentOutlined,
  ApartmentOutlined,
  BankOutlined,
  GlobalOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/v2/stores/auth'
import type { GeoRegion, GeoRegionForm, GeoRegionQuery } from '../../types/geo'
import { geoRegionApi } from '../../api/geo'

const authStore = useAuthStore()

const loading = ref(false)
const treeLoading = ref(false)
const tableLoading = ref(false)
const modalVisible = ref(false)
const modalLoading = ref(false)
const isEdit = ref(false)
const searchKeyword = ref('')
const expandedKeys = ref<number[]>([])
const selectedKeys = ref<number[]>([])
const currentRegion = ref<GeoRegion | null>(null)
const formRef = ref<FormInstance>()

const stats = reactive({
  provinceCount: 0,
  cityCount: 0,
  districtCount: 0,
  totalCount: 0,
})

const queryParams = reactive<GeoRegionQuery>({
  parentId: null,
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
    loadRegionList()
  },
})

const treeData = ref<GeoRegion[]>([])
const regionList = ref<GeoRegion[]>([])

const formData = reactive<GeoRegionForm>({
  parentId: null,
  level: 1,
  name: '',
  code: '',
  fullName: '',
  pinyin: '',
  lng: 0,
  lat: 0,
  sortOrder: 0,
  status: 'active',
})

const formRules = {
  name: [{ required: true, message: '请输入区域名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入区域编码', trigger: 'blur' }],
  fullName: [{ required: true, message: '请输入全称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

const modalTitle = computed(() => isEdit.value ? '编辑区域' : '新增区域')

const columns = [
  { title: '区域名称', dataIndex: 'name', key: 'name', width: 150 },
  { title: '区域编码', dataIndex: 'code', key: 'code', width: 120 },
  { title: '全称', dataIndex: 'fullName', key: 'fullName', width: 200 },
  { title: '级别', key: 'level', width: 100 },
  { title: '拼音', dataIndex: 'pinyin', key: 'pinyin', width: 150 },
  { title: '经纬度', key: 'location', width: 180,
    customRender: ({ record }: { record: GeoRegion }) => `${record.lng}, ${record.lat}`
  },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'actions', fixed: 'right' as const, width: 180 },
]

function getRowKey(record: GeoRegion): number {
  return record.id
}

function getLevelText(level: number): string {
  const textMap: Record<number, string> = {
    1: '省份',
    2: '城市',
    3: '区县',
  }
  return textMap[level] || `Level ${level}`
}

function getLevelColor(level: number): string {
  const colorMap: Record<number, string> = {
    1: 'blue',
    2: 'purple',
    3: 'green',
  }
  return colorMap[level] || 'default'
}

function getChildLevelText(parentLevel: number): string {
  const childLevel = parentLevel + 1
  return getLevelText(childLevel)
}

function onExpand(keys: number[]) {
  expandedKeys.value = keys
}

function onSelect(keys: number[]) {
  selectedKeys.value = keys
  if (keys.length > 0) {
    const region = findRegionInTree(treeData.value, keys[0])
    currentRegion.value = region
    queryParams.parentId = keys[0]
  } else {
    currentRegion.value = null
    queryParams.parentId = null
  }
  queryParams.page = 1
  pagination.current = 1
  loadRegionList()
}

function findRegionInTree(list: GeoRegion[], id: number): GeoRegion | null {
  for (const item of list) {
    if (item.id === id) return item
    if (item.children && item.children.length > 0) {
      const found = findRegionInTree(item.children, id)
      if (found) return found
    }
  }
  return null
}

function onDrop(info: any) {
  message.info('拖拽排序功能')
}

function handleSearch() {
  queryParams.keyword = searchKeyword.value
  queryParams.page = 1
  pagination.current = 1
  loadRegionList()
}

function handleAddRoot() {
  isEdit.value = false
  if (currentRegion.value) {
    formData.parentId = currentRegion.value.id
    formData.level = currentRegion.value.level + 1
  } else {
    formData.parentId = null
    formData.level = 1
  }
  formData.name = ''
  formData.code = ''
  formData.fullName = ''
  formData.pinyin = ''
  formData.lng = 0
  formData.lat = 0
  formData.sortOrder = 0
  formData.status = 'active'
  modalVisible.value = true
}

function handleEdit() {
  if (!currentRegion.value) return
  isEdit.value = true
  formData.id = currentRegion.value.id
  formData.parentId = currentRegion.value.parentId
  formData.level = currentRegion.value.level
  formData.name = currentRegion.value.name
  formData.code = currentRegion.value.code
  formData.fullName = currentRegion.value.fullName
  formData.pinyin = currentRegion.value.pinyin
  formData.lng = currentRegion.value.lng
  formData.lat = currentRegion.value.lat
  formData.sortOrder = currentRegion.value.sortOrder
  formData.status = currentRegion.value.status
  modalVisible.value = true
}

function handleEditRecord(record: GeoRegion) {
  isEdit.value = true
  formData.id = record.id
  formData.parentId = record.parentId
  formData.level = record.level
  formData.name = record.name
  formData.code = record.code
  formData.fullName = record.fullName
  formData.pinyin = record.pinyin
  formData.lng = record.lng
  formData.lat = record.lat
  formData.sortOrder = record.sortOrder
  formData.status = record.status
  modalVisible.value = true
}

function handleView(record: GeoRegion) {
  currentRegion.value = record
  selectedKeys.value = [record.id]
  queryParams.parentId = record.id
  queryParams.page = 1
  pagination.current = 1
  loadRegionList()
}

async function handleDelete() {
  if (!currentRegion.value) return
  try {
    await geoRegionApi.delete(currentRegion.value.id)
    message.success('删除成功')
    loadTreeData()
    currentRegion.value = null
    selectedKeys.value = []
    queryParams.parentId = null
    loadRegionList()
  } catch (error) {
    message.error('删除失败')
    console.error(error)
  }
}

async function handleDeleteRecord(record: GeoRegion) {
  try {
    await geoRegionApi.delete(record.id)
    message.success('删除成功')
    loadTreeData()
    loadRegionList()
  } catch (error) {
    message.error('删除失败')
    console.error(error)
  }
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    modalLoading.value = true
    if (isEdit.value && formData.id) {
      await geoRegionApi.update(formData.id, formData)
      message.success('更新成功')
    } else {
      await geoRegionApi.create(formData)
      message.success('创建成功')
    }
    modalVisible.value = false
    loadTreeData()
    loadRegionList()
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

async function loadTreeData() {
  treeLoading.value = true
  try {
    const res = await geoRegionApi.tree()
    treeData.value = res
    countRegions(res)
  } catch (error) {
    message.error('区域树数据加载失败')
    console.error(error)
  } finally {
    treeLoading.value = false
  }
}

function countRegions(list: GeoRegion[]) {
  let provinceCount = 0
  let cityCount = 0
  let districtCount = 0
  
  function traverse(items: GeoRegion[]) {
    for (const item of items) {
      if (item.level === 1) provinceCount++
      else if (item.level === 2) cityCount++
      else if (item.level === 3) districtCount++
      if (item.children && item.children.length > 0) {
        traverse(item.children)
      }
    }
  }
  
  traverse(list)
  stats.provinceCount = provinceCount
  stats.cityCount = cityCount
  stats.districtCount = districtCount
  stats.totalCount = provinceCount + cityCount + districtCount
}

async function loadRegionList() {
  tableLoading.value = true
  try {
    const res = await geoRegionApi.list(queryParams)
    regionList.value = res.list
    pagination.total = res.total
  } catch (error) {
    message.error('区域列表加载失败')
    console.error(error)
  } finally {
    tableLoading.value = false
  }
}

onMounted(async () => {
  await loadTreeData()
  await loadRegionList()
})

watch(() => authStore.selectedTenantId, () => {
  currentRegion.value = null
  selectedKeys.value = []
  expandedKeys.value = []
  queryParams.parentId = null
  queryParams.page = 1
  pagination.current = 1
  loadTreeData()
  loadRegionList()
})
</script>

<style scoped lang="less">
.geo-region-manage-page {
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
</style>
