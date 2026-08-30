<template>
  <div class="categories-panel-page">
    <a-spin :spinning="loading">
      <!-- 顶部数据概览区 -->
      <a-row :gutter="[16, 16]" style="margin-bottom: 20px">
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-blue" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <ApartmentOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalCategories }}</div>
                <div class="stat-title">栏目总数</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend up">
                <ArrowUpOutlined /> 3
              </span>
              <span class="stat-label">本月新增</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-purple" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalArticles }}</div>
                <div class="stat-title">文章总数</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend up">
                <ArrowUpOutlined /> 12%
              </span>
              <span class="stat-label">较上月</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-green" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <EyeOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalViews }}</div>
                <div class="stat-title">总浏览量</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend up">
                <ArrowUpOutlined /> 25%
              </span>
              <span class="stat-label">较上月</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-orange" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <ArrowUpOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.maxLevel }}</div>
                <div class="stat-title">最大层级</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-label">共 {{ stats.totalCategories }} 个栏目</span>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 主内容区 - 左右分栏 -->
      <a-row :gutter="20" style="margin-bottom: 20px">
        <!-- 左侧栏目树 -->
        <a-col :xs="24" :lg="6">
          <a-card class="tree-card" :bordered="false">
            <template #title>
              <div class="card-title">
                <ApartmentOutlined class="title-icon" />
                <span>栏目结构</span>
              </div>
            </template>
            <template #extra>
              <a-button type="primary" size="small" @click="showAddModal">
                <template #icon><PlusOutlined /></template>
                新增
              </a-button>
            </template>

            <div class="tree-toolbar">
              <a-input-search
                v-model:value="searchText"
                placeholder="搜索栏目"
                size="small"
                @search="onSearch"
              />
              <div class="tree-actions">
                <a-button size="small" @click="expandAll">
                  <template #icon><DownOutlined /></template>
                  展开
                </a-button>
                <a-button size="small" @click="collapseAll">
                  <template #icon><UpOutlined /></template>
                  收起
                </a-button>
              </div>
            </div>

            <div class="tree-container">
              <a-tree
                v-if="treeData.length"
                v-model:selectedKeys="selectedKeys"
                v-model:expandedKeys="expandedKeys"
                :tree-data="treeData"
                :show-icon="true"
                :draggable="true"
                block-node
                @drop="onDrop"
                @select="onSelect"
              >
                <template #icon="{ isLeaf }">
                  <FolderOpenOutlined v-if="!isLeaf" />
                  <FileOutlined v-else />
                </template>
                <template #title="{ key, title, status, icon, articleCount }">
                  <div class="tree-node">
                    <span class="node-title">{{ title }}</span>
                    <a-tag v-if="status === 'disabled'" color="default">停用</a-tag>
                    <span class="node-count">{{ articleCount || 0 }}篇</span>
                    <div class="node-actions">
                      <a-button type="link" size="small" @click.stop="editCategory(key)">
                        <EditOutlined />
                      </a-button>
                      <a-button type="link" size="small" danger @click.stop="deleteCategory(key)">
                        <DeleteOutlined />
                      </a-button>
                    </div>
                  </div>
                </template>
              </a-tree>
              <a-empty v-else description="暂无栏目" class="tree-empty" />
            </div>
          </a-card>
        </a-col>

        <!-- 右侧详情 -->
        <a-col :xs="24" :lg="18">
          <a-card v-if="currentCategory" class="detail-card" :bordered="false">
            <template #title>
              <div class="card-title">
                <SettingOutlined class="title-icon" />
                <span>栏目详情</span>
                <a-tag color="blue" style="margin-left: 8px">{{ currentCategory.name }}</a-tag>
              </div>
            </template>
            <template #extra>
              <a-space>
                <a-button @click="resetForm">重置</a-button>
                <a-button type="primary" :loading="saving" @click="saveCategory">
                  <template #icon><SaveOutlined /></template>
                  保存
                </a-button>
              </a-space>
            </template>

            <a-tabs v-model:activeKey="activeTab" class="detail-tabs">
              <!-- Tab 1: 基础信息 -->
              <a-tab-pane key="basic">
                <template #tab>
                  <span>
                    <ProfileOutlined />
                    基础信息
                  </span>
                </template>
                <div class="tab-content">
                  <a-form layout="vertical">
                    <a-row :gutter="24">
                      <a-col :xs="24" :md="12">
                        <a-form-item label="栏目名称" required>
                          <a-input v-model:value="currentCategory.name" placeholder="请输入栏目名称" size="large" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="栏目别名">
                          <a-input v-model:value="currentCategory.slug" placeholder="请输入栏目别名，用于URL" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="上级栏目">
                          <a-tree-select
                            v-model:value="currentCategory.parentId"
                            :tree-data="treeSelectData"
                            placeholder="选择上级栏目（不选则为顶级）"
                            :tree-default-expand-all="true"
                            style="width: 100%"
                            allow-clear
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="排序号">
                          <a-input-number v-model:value="currentCategory.sortOrder" :min="0" style="width: 100%" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="栏目图标">
                          <a-select v-model:value="currentCategory.icon" style="width: 100%" placeholder="选择图标">
                            <a-select-option value="folder">
                              <FolderOutlined /> 文件夹
                            </a-select-option>
                            <a-select-option value="file">
                              <FileOutlined /> 文件
                            </a-select-option>
                            <a-select-option value="book">
                              <BookOutlined /> 书籍
                            </a-select-option>
                            <a-select-option value="news">
                              <NotificationOutlined /> 新闻
                            </a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="状态">
                          <a-switch
                            :checked="currentCategory.status === 'enabled'"
                            checked-children="启用"
                            un-checked-children="停用"
                            @change="onStatusChange"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>

                    <a-divider orientation="left">
                      <span class="divider-title">
                        <GlobalOutlined /> SEO 配置
                      </span>
                    </a-divider>

                    <a-row :gutter="24">
                      <a-col :span="24">
                        <a-form-item label="SEO标题">
                          <a-input v-model:value="currentCategory.seoTitle" placeholder="请输入SEO标题，建议不超过60字" :maxlength="100" show-count />
                        </a-form-item>
                      </a-col>
                      <a-col :span="24">
                        <a-form-item label="SEO关键词">
                          <a-select
                            v-model:value="currentCategory.seoKeywords"
                            mode="tags"
                            placeholder="请输入SEO关键词，回车添加"
                            style="width: 100%"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="24">
                        <a-form-item label="SEO描述">
                          <a-textarea
                            v-model:value="currentCategory.seoDescription"
                            :rows="3"
                            placeholder="请输入SEO描述，建议不超过200字"
                            :maxlength="300"
                            show-count
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </a-form>
                </div>
              </a-tab-pane>

              <!-- Tab 2: SEO配置 -->
              <a-tab-pane key="seo">
                <template #tab>
                  <span>
                    <GlobalOutlined />
                    SEO配置
                  </span>
                </template>
                <div class="tab-content">
                  <a-form layout="vertical">
                    <a-row :gutter="24">
                      <a-col :span="24">
                        <a-form-item label="SEO标题">
                          <a-input v-model:value="currentCategory.seoTitle" placeholder="请输入SEO标题，建议60字以内" :maxlength="60" show-count />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="24">
                        <a-form-item label="SEO关键词">
                          <a-input v-model:value="currentCategory.seoKeywords" placeholder="请输入SEO关键词，用逗号分隔" />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :span="24">
                        <a-form-item label="SEO描述">
                          <a-textarea v-model:value="currentCategory.seoDescription" :rows="3" placeholder="请输入SEO描述，建议160字以内" :maxlength="160" show-count />
                        </a-form-item>
                      </a-col>
                    </a-row>

                    <a-divider orientation="left">
                      <span class="divider-title">搜索引擎优化</span>
                    </a-divider>

                    <a-row :gutter="24">
                      <a-col :xs="24" :md="12">
                        <a-form-item label="自定义URL别名">
                          <a-input v-model:value="currentCategory.urlAlias" placeholder="如: tech-news" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="Canonical链接">
                          <a-input v-model:value="currentCategory.canonicalUrl" placeholder="https://..." />
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-row :gutter="24">
                      <a-col :xs="24" :md="12">
                        <a-form-item label="Robots规则">
                          <a-select v-model:value="currentCategory.robotsRule" style="width: 100%">
                            <a-select-option value="index,follow">索引并追踪 (index,follow)</a-select-option>
                            <a-select-option value="noindex,follow">不索引但追踪 (noindex,follow)</a-select-option>
                            <a-select-option value="index,nofollow">索引但不追踪 (index,nofollow)</a-select-option>
                            <a-select-option value="noindex,nofollow">不索引不追踪 (noindex,nofollow)</a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="Sitemap优先级">
                          <a-slider v-model:value="currentCategory.sitemapPriority" :min="0" :max="1" :step="0.1" />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </a-form>
                </div>
              </a-tab-pane>

              <!-- Tab 3: 权限配置 -->
              <a-tab-pane key="permission">
                <template #tab>
                  <span>
                    <SafetyOutlined />
                    权限配置
                  </span>
                </template>
                <div class="tab-content">
                  <a-form layout="vertical">
                    <a-row :gutter="24">
                      <a-col :span="24">
                        <a-form-item label="可见角色">
                          <a-checkbox-group v-model:value="permissionForm.visibleRoles">
                            <a-row>
                              <a-col :span="6" v-for="role in roleList" :key="role.value">
                                <a-checkbox :value="role.value">{{ role.label }}</a-checkbox>
                              </a-col>
                            </a-row>
                          </a-checkbox-group>
                        </a-form-item>
                      </a-col>
                    </a-row>

                    <a-divider orientation="left">
                      <span class="divider-title">发布权限</span>
                    </a-divider>

                    <a-row :gutter="24">
                      <a-col :span="24">
                        <a-form-item label="可发布角色">
                          <a-checkbox-group v-model:value="permissionForm.publishRoles">
                            <a-row>
                              <a-col :span="6" v-for="role in roleList" :key="role.value">
                                <a-checkbox :value="role.value">{{ role.label }}</a-checkbox>
                              </a-col>
                            </a-row>
                          </a-checkbox-group>
                        </a-form-item>
                      </a-col>
                    </a-row>

                    <a-row :gutter="24">
                      <a-col :xs="24" :md="12">
                        <a-form-item label="是否需要审核">
                          <a-switch v-model:checked="permissionForm.needReview" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="审核角色">
                          <a-select
                            v-model:value="permissionForm.reviewRole"
                            style="width: 100%"
                            placeholder="选择审核角色"
                            :disabled="!permissionForm.needReview"
                          >
                            <a-select-option v-for="role in roleList" :key="role.value" :value="role.value">
                              {{ role.label }}
                            </a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </a-form>
                </div>
              </a-tab-pane>

              <!-- Tab 4: 扩展字段 -->
              <a-tab-pane key="extend">
                <template #tab>
                  <span>
                    <AppstoreOutlined />
                    扩展字段
                  </span>
                </template>
                <div class="tab-content">
                  <div class="extend-header">
                    <div class="extend-title">自定义字段列表</div>
                    <a-button type="primary" size="small" @click="addExtendField">
                      <template #icon><PlusOutlined /></template>
                      添加字段
                    </a-button>
                  </div>

                  <a-table
                    :data-source="extendFields"
                    :columns="extendTableColumns"
                    :pagination="false"
                    size="middle"
                    class="extend-table"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'type'">
                        <a-tag color="blue">{{ record.type }}</a-tag>
                      </template>
                      <template v-else-if="column.key === 'required'">
                        <a-tag :color="record.required ? 'error' : 'default'">{{ record.required ? '是' : '否' }}</a-tag>
                      </template>
                      <template v-else-if="column.key === 'action'">
                        <a-button type="link" size="small" @click="editExtendField(record)">编辑</a-button>
                        <a-button type="link" size="small" danger @click="deleteExtendField(record)">删除</a-button>
                      </template>
                    </template>
                  </a-table>
                </div>
              </a-tab-pane>
            </a-tabs>
          </a-card>
          <a-empty v-else description="请选择左侧栏目进行编辑" class="detail-empty" />
        </a-col>
      </a-row>

      <!-- 底部统计区（可折叠） -->
      <a-card class="stats-card" :bordered="false">
        <template #title>
          <div class="card-title" @click="statsCollapsed = !statsCollapsed" style="cursor: pointer">
            <BarChartOutlined class="title-icon" />
            <span>数据统计</span>
            <CaretUpOutlined v-if="!statsCollapsed" style="margin-left: 8px; transition: transform 0.3s" />
            <CaretDownOutlined v-else style="margin-left: 8px; transition: transform 0.3s" />
          </div>
        </template>

        <a-collapse :activeKey="statsCollapsed ? [] : ['stats']" :bordered="false">
          <a-collapse-panel key="stats" :show-arrow="false">
            <a-row :gutter="24">
              <!-- 柱状图 -->
              <a-col :xs="24" :md="14">
                <div class="chart-section">
                  <div class="section-title">各栏目文章数量统计</div>
                  <div ref="categoryChartRef" style="height: 300px; width: 100%"></div>
                </div>
              </a-col>

              <!-- 访问量排行 -->
              <a-col :xs="24" :md="10">
                <div class="chart-section">
                  <div class="section-title">栏目访问量排行</div>
                  <div class="rank-list">
                    <div v-for="(item, index) in viewRankList" :key="index" class="rank-item">
                      <div class="rank-no" :class="'rank-' + (index + 1)">{{ index + 1 }}</div>
                      <div class="rank-info">
                        <div class="rank-name">{{ item.name }}</div>
                        <div class="rank-progress">
                          <div
                            class="rank-bar"
                            :style="{
                              width: (item.views / maxViewCount * 100) + '%',
                              background: barColors[index % barColors.length]
                            }"
                          ></div>
                        </div>
                      </div>
                      <div class="rank-views">{{ item.views }}</div>
                    </div>
                  </div>
                </div>
              </a-col>
            </a-row>
          </a-collapse-panel>
        </a-collapse>
      </a-card>

      <!-- 新增/编辑弹窗 -->
      <a-modal
        v-model:open="showModal"
        :title="editingCategory ? '编辑栏目' : '新增栏目'"
        @ok="handleModalOk"
        :confirmLoading="saving"
        width="600px"
      >
        <a-form layout="vertical">
          <a-form-item label="栏目名称" required>
            <a-input v-model:value="modalForm.name" placeholder="请输入栏目名称" />
          </a-form-item>
          <a-form-item label="栏目别名">
            <a-input v-model:value="modalForm.slug" placeholder="请输入栏目别名" />
          </a-form-item>
          <a-form-item label="上级栏目">
            <a-tree-select
              v-model:value="modalForm.parentId"
              :tree-data="treeSelectData"
              placeholder="选择上级栏目（不选则为顶级）"
              :tree-default-expand-all="true"
              style="width: 100%"
              allow-clear
            />
          </a-form-item>
          <a-form-item label="排序号">
            <a-input-number v-model:value="modalForm.sortOrder" :min="0" style="width: 100%" />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, nextTick, h } from 'vue'
import * as echarts from 'echarts'
import { message, Modal } from 'ant-design-vue'
import {
  ApartmentOutlined,
  FileTextOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  PlusOutlined,
  DownOutlined,
  UpOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileOutlined,
  BookOutlined,
  NotificationOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  SaveOutlined,
  ProfileOutlined,
  GlobalOutlined,
  SafetyOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
} from '@ant-design/icons-vue'
import { categoryApi } from '../../api'

const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editingCategory = ref<any>(null)
const activeTab = ref('basic')
const statsCollapsed = ref(false)
const categoryChartRef = ref<HTMLDivElement>()
let categoryChart: echarts.ECharts | null = null

const stats = reactive({
  totalCategories: 0,
  totalArticles: 0,
  totalViews: 0,
  maxLevel: 3,
})

const searchText = ref('')
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const categories = ref<any[]>([])
const currentCategory = ref<any>(null)

const modalForm = reactive({
  name: '',
  slug: '',
  parentId: null as number | null,
  sortOrder: 0,
})

const permissionForm = reactive({
  visibleRoles: ['admin', 'editor', 'viewer'],
  publishRoles: ['admin', 'editor'],
  needReview: true,
  reviewRole: 'admin',
})

const roleList = [
  { value: 'admin', label: '超级管理员' },
  { value: 'editor', label: '编辑' },
  { value: 'viewer', label: '访客' },
  { value: 'contributor', label: '投稿者' },
]

const extendFields = ref([
  { id: 1, name: '副标题', key: 'subtitle', type: '文本', required: false, sort: 1 },
  { id: 2, name: '来源', key: 'source', type: '文本', required: false, sort: 2 },
  { id: 3, name: '作者简介', key: 'authorIntro', type: '富文本', required: false, sort: 3 },
  { id: 4, name: '相关推荐', key: 'related', type: '关联文章', required: false, sort: 4 },
])

const extendTableColumns = [
  { title: '字段名称', dataIndex: 'name', key: 'name' },
  { title: '字段标识', dataIndex: 'key', key: 'key' },
  { title: '字段类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '是否必填', dataIndex: 'required', key: 'required', width: 100 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80 },
  { title: '操作', key: 'action', width: 150 },
]

const barColors = [
  'linear-gradient(90deg, #1890ff 0%, #36cfc9 100%)',
  'linear-gradient(90deg, #722ed1 0%, #b37feb 100%)',
  'linear-gradient(90deg, #52c41a 0%, #95de64 100%)',
  'linear-gradient(90deg, #fa8c16 0%, #ffec3d 100%)',
  'linear-gradient(90deg, #eb2f96 0%, #ff85c0 100%)',
]

const categoryStats = [
  { name: '技术文章', count: 128 },
  { name: '行业资讯', count: 96 },
  { name: '产品评测', count: 72 },
  { name: '用户指南', count: 58 },
  { name: '案例分析', count: 45 },
  { name: '公司动态', count: 32 },
]

const viewRankList = [
  { name: '技术文章', views: 12580 },
  { name: '行业资讯', views: 9860 },
  { name: '产品评测', views: 7520 },
  { name: '案例分析', views: 5680 },
  { name: '用户指南', views: 4320 },
]

const maxArticleCount = computed(() => Math.max(...categoryStats.map(s => s.count)))
const maxViewCount = computed(() => Math.max(...viewRankList.map(s => s.views)))

const treeData = computed(() => buildTree(categories.value, null))
const treeSelectData = computed(() => buildSelectTree(categories.value, null))

function buildTree(list: any[], parentId: number | null): any[] {
  return list
    .filter(item => item.parentId === parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(item => ({
      title: item.name,
      key: String(item.id),
      status: item.status,
      icon: item.icon,
      articleCount: item.articleCount || 0,
      children: buildTree(list, item.id),
    }))
}

function buildSelectTree(list: any[], parentId: number | null): any[] {
  return list
    .filter(item => item.parentId === parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(item => ({
      title: item.name,
      value: item.id,
      children: buildSelectTree(list, item.id),
    }))
}

function onSearch(value: string) {
  if (value) {
    const keys = findNodeKeys(categories.value, item => item.name.includes(value))
    expandedKeys.value = keys
  }
}

function findNodeKeys(list: any[], matchFn: (item: any) => boolean): string[] {
  const keys: string[] = []
  list.forEach(item => {
    if (matchFn(item)) {
      keys.push(String(item.id))
      let parent = list.find(p => p.id === item.parentId)
      while (parent) {
        keys.push(String(parent.id))
        parent = list.find(p => p.id === parent!.parentId)
      }
    }
  })
  return [...new Set(keys)]
}

function expandAll() {
  const allKeys = categories.value.map(c => String(c.id))
  expandedKeys.value = allKeys
}

function collapseAll() {
  expandedKeys.value = []
}

function onSelect(keys: string[], info: any) {
  if (keys.length) {
    const id = Number(keys[0])
    const category = categories.value.find(c => c.id === id)
    if (category) {
      currentCategory.value = { ...category }
    }
  }
}

function onDrop(info: any) {
  const dragKey = info.dragNode.key
  const dropKey = info.node.key
  const dropPos = info.node.pos.split('-')
  const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1])

  const data = [...categories.value]
  const dragItem = data.find(item => String(item.id) === dragKey)
  const dropItem = data.find(item => String(item.id) === dropKey)

  if (!dragItem || !dropItem) return

  if (dropPosition === 0) {
    dragItem.parentId = dropItem.id
    message.success('已移动为子栏目')
  } else {
    dragItem.parentId = dropItem.parentId
    message.success('已移动到同一级别')
  }
}

function onStatusChange(checked: boolean) {
  if (currentCategory.value) {
    currentCategory.value.status = checked ? 'enabled' : 'disabled'
  }
}

function showAddModal() {
  editingCategory.value = null
  modalForm.name = ''
  modalForm.slug = ''
  modalForm.parentId = selectedKeys.value.length ? Number(selectedKeys.value[0]) : null
  modalForm.sortOrder = 0
  showModal.value = true
}

function editCategory(key: string) {
  const id = Number(key)
  const category = categories.value.find(c => c.id === id)
  if (category) {
    editingCategory.value = category
    modalForm.name = category.name
    modalForm.slug = category.slug
    modalForm.parentId = category.parentId
    modalForm.sortOrder = category.sortOrder
    showModal.value = true
  }
}

async function deleteCategory(key: string) {
  Modal.confirm({
    title: '确认删除',
    content: '删除此栏目将同时删除其所有子栏目，确定要删除吗？',
    okText: '确定',
    cancelText: '取消',
    okType: 'danger',
    onOk: async () => {
      try {
        await categoryApi.delete(Number(key))
        message.success('删除成功')
        await loadData()
      } catch (error) {
        message.error('删除失败')
        console.error(error)
      }
    },
  })
}

async function handleModalOk() {
  if (!modalForm.name) {
    message.error('请输入栏目名称')
    return
  }
  saving.value = true
  try {
    if (editingCategory.value) {
      await categoryApi.update(editingCategory.value.id, modalForm)
      message.success('更新成功')
    } else {
      await categoryApi.create(modalForm)
      message.success('创建成功')
    }
    showModal.value = false
    await loadData()
  } catch (error) {
    message.error('操作失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function saveCategory() {
  if (!currentCategory.value?.name) {
    message.error('请输入栏目名称')
    return
  }
  saving.value = true
  try {
    await categoryApi.update(currentCategory.value.id, currentCategory.value)
    message.success('保存成功')
    await loadData()
  } catch (error) {
    message.error('保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

function resetForm() {
  if (selectedKeys.value.length) {
    const id = Number(selectedKeys.value[0])
    const category = categories.value.find(c => c.id === id)
    if (category) {
      currentCategory.value = { ...category }
    }
  }
}

function previewTemplate(type: string) {
  message.info(`预览${type === 'list' ? '列表页' : '详情页'}模板`)
}

function addExtendField() {
  message.info('添加扩展字段')
}

function editExtendField(field: any) {
  message.info(`编辑字段: ${field.name}`)
}

function deleteExtendField(field: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除字段"${field.name}"吗？`,
    okType: 'danger',
    onOk: () => {
      extendFields.value = extendFields.value.filter(f => f.id !== field.id)
      message.success('删除成功')
    },
  })
}

async function loadData() {
  loading.value = true
  try {
    const data = await categoryApi.list({ all: true }) as any
    const list = data?.records || data || []
    categories.value = list
    stats.totalCategories = list.length
    stats.totalArticles = list.reduce((sum: number, c: any) => sum + (c.articleCount || 0), 0)
    stats.totalViews = list.reduce((sum: number, c: any) => sum + (c.viewCount || 0), 0)
    if (list.length && !selectedKeys.value.length) {
      selectedKeys.value = [String(list[0].id)]
      currentCategory.value = { ...list[0] }
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

function initCategoryChart() {
  if (!categoryChartRef.value) return
  categoryChart = echarts.init(categoryChartRef.value)
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categoryStats.map(item => item.name),
      axisLabel: {
        interval: 0,
        rotate: 30
      }
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '文章数量',
        type: 'bar',
        barWidth: '50%',
        data: categoryStats.map((item, index) => ({
          value: item.count,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#ff4d4f', '#13c2c2', '#eb2f96'][index % 7] },
              { offset: 1, color: ['#69c0ff', '#b37feb', '#95de64', '#ffd666', '#ff7875', '#87e8de', '#f759ab'][index % 7] }
            ])
          }
        }))
      }
    ]
  }
  categoryChart.setOption(option)
}

onMounted(() => {
  loadData()
  nextTick(() => {
    initCategoryChart()
  })
})
</script>

<style scoped lang="less">
.categories-panel-page {
  width: 100%;
  padding: 8px 0;
}

.card-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;

  .title-icon {
    margin-right: 8px;
    color: #1890ff;
  }
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 12px;
  overflow: hidden;

  :deep(.ant-card-body) {
    padding: 20px;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &.stat-card-blue {
    .stat-icon {
      background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
    }
  }

  &.stat-card-purple {
    .stat-icon {
      background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%);
    }
  }

  &.stat-card-green {
    .stat-icon {
      background: linear-gradient(135deg, #52c41a 0%, #95de64 100%);
    }
  }

  &.stat-card-orange {
    .stat-icon {
      background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%);
    }
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.stat-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.stat-trend {
  font-size: 12px;
  font-weight: 500;

  &.up {
    color: #52c41a;
  }

  &.down {
    color: #ff4d4f;
  }
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
}

.tree-card,
.detail-card,
.stats-card {
  border-radius: 12px;

  :deep(.ant-card-head) {
    border-bottom: 1px solid #f0f0f0;
  }
}

.tree-toolbar {
  margin-bottom: 16px;

  .tree-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    justify-content: flex-end;
  }
}

.tree-container {
  max-height: 600px;
  overflow-y: auto;
}

.tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  padding-right: 8px;
}

.node-title {
  flex: 1;
  font-size: 14px;
}

.node-count {
  font-size: 12px;
  color: #8c8c8c;
  margin-left: 8px;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 10px;
}

.node-actions {
  opacity: 0;
  transition: opacity 0.3s;
  margin-left: auto;
  display: flex;
  gap: 4px;
}

:deep(.ant-tree-treenode:hover) .node-actions {
  opacity: 1;
}

.tree-empty {
  padding: 40px 0;
}

.detail-empty {
  padding: 100px 0;
}

.detail-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 24px;
  }

  :deep(.ant-tabs-tab) {
    font-size: 14px;
  }
}

.tab-content {
  padding: 8px 0;
}

.divider-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 6px;
}

.template-preview {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;

  .preview-header {
    padding: 12px 16px;
    background: #fafafa;
    border-bottom: 1px solid #e8e8e8;
    font-size: 14px;
    font-weight: 500;
  }

  .preview-content {
    padding: 16px;
    background: #fff;
  }
}

.preview-mock {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .mock-item {
    height: 16px;
    background: linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%);
    border-radius: 4px;

    &:nth-child(1) { width: 100%; }
    &:nth-child(2) { width: 80%; }
    &:nth-child(3) { width: 90%; }
    &:nth-child(4) { width: 70%; }
  }
}

.preview-mock-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .mock-title {
    height: 20px;
    background: linear-gradient(90deg, #e0e0e0 0%, #d0d0d0 50%, #e0e0e0 100%);
    border-radius: 4px;
    width: 60%;
    margin-bottom: 8px;
  }

  .mock-line {
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 0%, #e8e8e8 50%, #f0f0f0 100%);
    border-radius: 4px;

    &.short {
      width: 40%;
    }
  }
}

.extend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .extend-title {
    font-size: 15px;
    font-weight: 500;
    color: #1a1a1a;
  }
}

.extend-table {
  :deep(.ant-table) {
    border-radius: 8px;
    overflow: hidden;
  }
}

.chart-section {
  .section-title {
    font-size: 15px;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 20px;
  }
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 100px;
  font-size: 13px;
  color: #595959;
  flex-shrink: 0;
  text-align: right;
}

.bar-track {
  flex: 1;
  height: 28px;
  background: #f5f5f5;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.bar-fill {
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  min-width: 40px;
  transition: width 0.6s ease;
}

.bar-value {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rank-no {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  background: #f0f0f0;
  color: #8c8c8c;

  &.rank-1 {
    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
    color: #fff;
  }

  &.rank-2 {
    background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
    color: #fff;
  }

  &.rank-3 {
    background: linear-gradient(135deg, #cd7f32 0%, #e8a87c 100%);
    color: #fff;
  }
}

.rank-info {
  flex: 1;
  min-width: 0;
}

.rank-name {
  font-size: 13px;
  color: #1a1a1a;
  margin-bottom: 6px;
}

.rank-progress {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}

.rank-views {
  font-size: 14px;
  font-weight: 600;
  color: #1890ff;
  flex-shrink: 0;
}

:deep(.ant-collapse) {
  background: transparent;
  border: none;

  .ant-collapse-header {
    padding: 0 !important;
  }

  .ant-collapse-content {
    border-top: none;
    padding-top: 16px;
  }
}
</style>
