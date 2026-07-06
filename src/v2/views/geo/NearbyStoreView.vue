<template>
  <div class="nearby-store-page">
    <a-spin :spinning="loading">
      <a-row :gutter="16">
        <a-col :span="16">
          <a-card :bordered="false" title="附近门店">
            <template #extra>
              <a-space>
                <a-select
                  v-model:value="radius"
                  style="width: 120px"
                  @change="loadNearbyStores"
                >
                  <a-select-option :value="1000">1公里内</a-select-option>
                  <a-select-option :value="3000">3公里内</a-select-option>
                  <a-select-option :value="5000">5公里内</a-select-option>
                  <a-select-option :value="10000">10公里内</a-select-option>
                </a-select>
                <a-button @click="refreshLocation">
                  <template #icon><EnvironmentOutlined /></template>
                  重新定位
                </a-button>
              </a-space>
            </template>

            <div v-if="currentLocation" class="location-info">
              <EnvironmentOutlined /> 当前位置: {{ currentLocation.address || '未知位置' }}
              <span class="location-coord">({{ currentLocation.lng.toFixed(6) }}, {{ currentLocation.lat.toFixed(6) }})</span>
            </div>

            <a-list
              :data-source="nearbyStores"
              :pagination="false"
              item-layout="vertical"
              size="large"
            >
              <template #renderItem="{ item }">
                <a-list-item class="store-card-item">
                  <a-card hoverable class="store-card">
                    <div class="store-card-content">
                      <div class="store-card-left">
                        <div class="store-cover">
                          <ShopOutlined />
                        </div>
                      </div>
                      <div class="store-card-right">
                        <div class="store-header">
                          <h3 class="store-name">{{ item.name }}</h3>
                          <a-tag :color="getStatusColor(item.status)" class="store-status">
                            {{ getStatusName(item.status) }}
                          </a-tag>
                        </div>
                        <div class="store-tags">
                          <a-tag v-for="tag in item.tagList?.slice(0, 3)" :key="tag" color="blue" size="small">
                            {{ tag }}
                          </a-tag>
                        </div>
                        <div class="store-info-row">
                          <span class="info-item">
                            <EnvironmentOutlined /> {{ item.fullAddress }}
                          </span>
                        </div>
                        <div class="store-info-row">
                          <span class="info-item">
                            <PhoneOutlined /> {{ item.phone }}
                          </span>
                          <span class="info-item">
                            <ClockCircleOutlined /> {{ item.businessHours }}
                          </span>
                        </div>
                        <div class="store-footer">
                          <div class="distance-badge">
                            <EnvironmentOutlined /> {{ formatDistance(item.distance || 0) }}
                          </div>
                          <a-space>
                            <a-button size="small">查看详情</a-button>
                            <a-button type="primary" size="small">
                              <template #icon><ArrowRightOutlined /></template>
                              导航
                            </a-button>
                          </a-space>
                        </div>
                      </div>
                    </div>
                  </a-card>
                </a-list-item>
              </template>
            </a-list>

            <a-empty v-if="nearbyStores.length === 0 && !loading" description="附近暂无门店" />
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card :bordered="false" title="地图位置" class="map-card">
            <div class="map-placeholder">
              <div class="map-icon">
                <GlobalOutlined />
              </div>
              <div class="map-text">地图占位区域</div>
              <div class="map-hint">接入地图服务后将显示真实地图</div>
              <div class="map-stores-count">
                共 {{ nearbyStores.length }} 家门店在范围内
              </div>
            </div>
          </a-card>

          <a-card :bordered="false" title="筛选" style="margin-top: 16px">
            <a-form layout="vertical">
              <a-form-item label="门店类型">
                <a-checkbox-group v-model:value="typeFilter" @change="loadNearbyStores">
                  <a-checkbox value="direct">直营店</a-checkbox>
                  <a-checkbox value="franchise">加盟店</a-checkbox>
                  <a-checkbox value="branch">分店</a-checkbox>
                </a-checkbox-group>
              </a-form-item>
              <a-form-item label="门店状态">
                <a-checkbox-group v-model:value="statusFilter" @change="loadNearbyStores">
                  <a-checkbox value="open">营业中</a-checkbox>
                  <a-checkbox value="closed">已关闭</a-checkbox>
                  <a-checkbox value="maintenance">维护中</a-checkbox>
                </a-checkbox-group>
              </a-form-item>
              <a-form-item label="关键词">
                <a-input-search
                  v-model:value="keyword"
                  placeholder="搜索门店名称"
                  @search="loadNearbyStores"
                />
              </a-form-item>
            </a-form>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  EnvironmentOutlined,
  ShopOutlined,
  PhoneOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  GlobalOutlined,
} from '@ant-design/icons-vue'
import { GeoStoreStatus, StoreType } from '../../types/geo'
import type { GeoStore } from '../../types/geo'
import { geoLocationApi } from '../../api/geo'

const loading = ref(false)
const radius = ref(5000)
const keyword = ref('')
const typeFilter = ref<string[]>(['direct', 'franchise', 'branch'])
const statusFilter = ref<string[]>(['open'])
const nearbyStores = ref<GeoStore[]>([])

const currentLocation = reactive({
  lng: 116.4074,
  lat: 39.9042,
  address: '北京市东城区',
})

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

function formatDistance(distance: number): string {
  if (distance < 1000) {
    return `${distance.toFixed(0)}米`
  }
  return `${(distance / 1000).toFixed(2)}公里`
}

async function refreshLocation() {
  message.loading({ content: '正在获取位置...', key: 'location' })
  try {
    const res = await geoLocationApi.getCurrent()
    if (res.lng && res.lat) {
      currentLocation.lng = res.lng
      currentLocation.lat = res.lat
      currentLocation.address = `${res.province || ''}${res.city || ''}${res.district || ''}`
    }
    message.success({ content: '定位成功', key: 'location' })
    loadNearbyStores()
  } catch (error) {
    console.error('Failed to get location:', error)
    message.error({ content: '定位失败，使用默认位置', key: 'location' })
    loadNearbyStores()
  }
}

async function loadNearbyStores() {
  loading.value = true
  try {
    const mockData = generateMockNearbyStores()
    let filtered = mockData

    if (typeFilter.value.length > 0) {
      filtered = filtered.filter(s => typeFilter.value.includes(s.type))
    }
    if (statusFilter.value.length > 0) {
      filtered = filtered.filter(s => statusFilter.value.includes(s.status))
    }
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(kw) || 
        s.address.toLowerCase().includes(kw)
      )
    }

    filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0))
    nearbyStores.value = filtered
  } catch (error) {
    console.error(error)
    message.error('加载附近门店失败')
  } finally {
    loading.value = false
  }
}

function generateMockNearbyStores(): GeoStore[] {
  const stores: GeoStore[] = []
  const names = ['国贸旗舰店', '朝阳大悦城店', '三里屯店', '王府井店', '西单店', '望京店', '五道口店']
  const types = [StoreType.DIRECT, StoreType.FRANCHISE, StoreType.BRANCH]
  const statuses = [GeoStoreStatus.OPEN, GeoStoreStatus.OPEN, GeoStoreStatus.OPEN, GeoStoreStatus.MAINTENANCE]
  const addresses = [
    '建国门外大街1号国贸商城',
    '朝阳北路101号朝阳大悦城',
    '三里屯路19号三里屯太古里',
    '王府井大街138号新东安市场',
    '西单北大街110号西单大悦城',
    '望京街9号望京SOHO',
    '成府路28号五道口购物中心',
  ]
  const managers = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九']
  const phones = ['13800138001', '13800138002', '13800138003', '13800138004', '13800138005', '13800138006', '13800138007']

  for (let i = 0; i < 7; i++) {
    const distance = Math.floor(Math.random() * 8000) + 200
    stores.push({
      id: i + 1,
      name: names[i],
      storeNo: `STORE${String(i + 1).padStart(4, '0')}`,
      type: types[i % types.length],
      address: addresses[i],
      provinceId: 1,
      cityId: 101,
      districtId: 201 + (i % 4),
      provinceName: '北京市',
      cityName: '北京市',
      districtName: ['东城区', '西城区', '朝阳区', '海淀区'][i % 4],
      fullAddress: `北京市${['东城区', '西城区', '朝阳区', '海淀区'][i % 4]}${addresses[i]}`,
      lng: 116.4 + (i * 0.02),
      lat: 39.9 + (i * 0.01),
      phone: phones[i],
      email: `store${i + 1}@example.com`,
      businessHours: '周一至周日 09:00-22:00',
      coverImage: '',
      images: '',
      description: `这是${names[i]}的详细描述，提供优质的产品和服务。`,
      tags: '优质服务,品牌授权,新品上市',
      tagList: ['优质服务', '品牌授权', '新品上市'],
      sortOrder: i + 1,
      status: statuses[i % statuses.length],
      managerName: managers[i],
      managerPhone: phones[i],
      distance: distance,
      createdAt: new Date(Date.now() - i * 86400000).toISOString().slice(0, 19).replace('T', ' '),
      updatedAt: new Date(Date.now() - i * 43200000).toISOString().slice(0, 19).replace('T', ' '),
    })
  }
  return stores
}

onMounted(() => {
  loadNearbyStores()
})
</script>

<style scoped lang="less">
.nearby-store-page {
  width: 100%;
}

.location-info {
  padding: 12px 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #389e0d;
  display: flex;
  align-items: center;
  gap: 8px;
}

.location-coord {
  color: #8c8c8c;
  margin-left: auto;
  font-size: 12px;
}

.store-card-item {
  padding: 0 !important;
  margin-bottom: 12px;
}

.store-card {
  width: 100%;
  
  :deep(.ant-card-body) {
    padding: 16px;
  }
}

.store-card-content {
  display: flex;
  gap: 16px;
}

.store-card-left {
  flex-shrink: 0;
}

.store-cover {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: #1890ff;
}

.store-card-right {
  flex: 1;
  min-width: 0;
}

.store-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.store-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.store-status {
  margin: 0;
}

.store-tags {
  margin-bottom: 8px;
}

.store-info-row {
  display: flex;
  gap: 24px;
  margin-bottom: 6px;
  font-size: 13px;
  color: #595959;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.store-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.distance-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #e6f7ff;
  color: #1890ff;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.map-card {
  height: 400px;
  
  :deep(.ant-card-body) {
    height: calc(100% - 57px);
    padding: 0;
  }
}

.map-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.map-icon {
  font-size: 64px;
  color: #1890ff;
}

.map-text {
  font-size: 16px;
  font-weight: 500;
  color: #595959;
}

.map-hint {
  font-size: 12px;
  color: #8c8c8c;
}

.map-stores-count {
  margin-top: 16px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  font-size: 13px;
  color: #1890ff;
  font-weight: 500;
}
</style>
