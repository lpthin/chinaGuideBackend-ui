<template>
  <div class="knowledge-category-page">
    <PageTitle />
    <a-spin :spinning="loading">
      <!-- 平台档前置条件：未选客户就读不了、也存不进去。轻量内联，不交给机器人（SPEC-UI-11 B 类）。
           下面那条「卡片数没读回来」是错误态（C 类），保留原 a-alert。 -->
      <p class="scope-hint">{{ scopeNotice }}</p>
      <a-alert
        v-if="statsFailed"
        class="scope-alert"
        type="warning"
        show-icon
        :message="`下面那张「知识卡片」没从后端读回来：${statsFailed}。这一格摆的是 —，不是 0。`"
      />
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <ApartmentOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statText(stats.totalCategories) }}</div>
                <div class="stat-title">分类总数</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%)">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statText(stats.totalCards) }}</div>
                <div class="stat-title">知识卡片</div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%)">
                <ArrowUpOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statText(stats.maxLevel) }}</div>
                <div class="stat-title">最大层级</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="24">
        <a-col :span="6">
          <a-card title="分类结构" :bordered="false">
            <!-- 搜索在正文、三个按钮挂在 #extra，一行被拆成两处：合并成 FilterBar（搜索靠左、按钮靠右） -->
            <filter-bar>
              <a-input-search
                v-model:value="searchText"
                placeholder="搜索分类"
                size="small"
                @search="onSearch"
              />
              <template #actions>
                <a-space>
                  <!-- 文案跟「文章分类」那张卡对齐（展开/收起/新增）：这条筛选栏只有 ~260px，
                       四个字的名字在窄容器里会把按钮挤到折行 -->
                  <a-button size="small" @click="expandAll">
                    <template #icon><DownOutlined /></template>
                    展开
                  </a-button>
                  <a-button size="small" @click="collapseAll">
                    <template #icon><UpOutlined /></template>
                    收起
                  </a-button>
                  <a-button v-if="requestedTenantId !== null" type="primary" size="small" @click="showAddModal">
                    <template #icon><PlusOutlined /></template>
                    新增
                  </a-button>
                </a-space>
              </template>
            </filter-bar>
            <a-tree
              v-if="filteredTreeData.length"
              v-model:selectedKeys="selectedKeys"
              v-model:expandedKeys="expandedKeys"
              :tree-data="filteredTreeData"
              :show-icon="true"
              :draggable="true"
              @drop="onDrop"
              @select="onSelect"
            >
              <template #icon="{ isLeaf }">
                <FolderOutlined v-if="!isLeaf" />
                <FileOutlined v-else />
              </template>
              <template #title="{ key, title, status, icon, documentCount, cardCount, totalCount }">
                <div class="tree-node">
                  <span class="node-title">{{ title }}</span>
                  <a-tag v-if="status === 'disabled'" color="default" size="small">停用</a-tag>
                  <span class="node-count">
                    <a-tooltip :title="`文档: ${documentCount || 0}, 卡片: ${cardCount || 0}`">
                      {{ totalCount || 0 }}篇
                    </a-tooltip>
                  </span>
                  <div class="node-actions">
                    <a-button type="link" size="small" @click.stop="editCategory(key)">编辑</a-button>
                    <a-button type="link" size="small" danger @click.stop="deleteCategory(key)">删除</a-button>
                  </div>
                </div>
              </template>
            </a-tree>
            <a-empty
              v-else-if="searchText"
              :description="`没找到名字里带「${searchText}」的分类（是在这一屏已读到的 ${categories.length} 个分类里找的）`"
            />
            <!-- 「暂无分类」在这一屏会被读成「这家还没建分类」，而它也可能是没发请求或读失败 -->
            <empty-list-hint
              v-else
              :loading="loading"
              :not-sent="notSentLine"
              :read-failed="readFailed"
              :retry="loadData"
              :empty-line="emptyLine"
              :empty-reason="emptyReason"
              :can-create="canCreateHere"
              create-label="新增分类"
              @create="showAddModal"
            />
          </a-card>
        </a-col>

        <a-col :span="18">
          <a-card title="分类详情" :bordered="false" v-if="currentCategory">
            <a-form layout="vertical">
              <a-row :gutter="24">
                <a-col :span="12">
                  <a-form-item label="分类名称">
                    <a-input v-model:value="currentCategory.name" placeholder="请输入分类名称" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="上级分类">
                    <a-tree-select
                      v-model:value="currentCategory.parentId"
                      :tree-data="treeSelectData"
                      placeholder="选择上级分类（不选则为顶级）"
                      :tree-default-expand-all="true"
                      style="width: 100%"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="分类图标">
                    <a-select v-model:value="currentCategory.icon" style="width: 100%" placeholder="选择图标">
                      <a-select-option value="folder"><FolderOutlined /> 文件夹</a-select-option>
                      <a-select-option value="file"><FileOutlined /> 文件</a-select-option>
                      <a-select-option value="book"><BookOutlined /> 书籍</a-select-option>
                      <a-select-option value="star"><StarOutlined /> 星标</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="排序号">
                    <a-input-number v-model:value="currentCategory.sort" :min="0" style="width: 100%" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="状态">
                    <a-radio-group v-model:value="currentCategory.status">
                      <a-radio value="active">启用</a-radio>
                      <a-radio value="disabled">停用</a-radio>
                    </a-radio-group>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-divider orientation="left">描述信息</a-divider>

              <a-row :gutter="24">
                <a-col :span="24">
                  <a-form-item label="分类描述">
                    <a-textarea
                      v-model:value="currentCategory.description"
                      :rows="3"
                      placeholder="请输入分类描述"
                      :maxlength="500"
                      show-count
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>

            <template #extra>
              <a-space>
                <a-button @click="resetForm">重置</a-button>
                <a-button type="primary" :loading="saving" :disabled="saving" @click="saveCategory">保存</a-button>
              </a-space>
            </template>
          </a-card>
          <a-empty v-else :description="rightColumnHint">
            <a-button v-if="canCreateHere" type="primary" @click="showAddModal">
              <template #icon><PlusOutlined /></template>
              新增分类
            </a-button>
          </a-empty>
        </a-col>
      </a-row>

      <a-modal
        v-model:open="showModal"
        :title="editingCategory ? '编辑分类' : '新增分类'"
        @ok="handleModalOk"
        :confirmLoading="saving"
        width="600px"
      >
        <a-form layout="vertical">
          <a-form-item label="分类名称" required>
            <a-input v-model:value="modalForm.name" placeholder="请输入分类名称" />
          </a-form-item>
          <a-form-item label="上级分类">
            <a-tree-select
              v-model:value="modalForm.parentId"
              :tree-data="treeSelectData"
              placeholder="选择上级分类（不选则为顶级）"
              :tree-default-expand-all="true"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item label="分类图标">
            <a-select v-model:value="modalForm.icon" style="width: 100%" placeholder="选择图标">
              <a-select-option value="folder"><FolderOutlined /> 文件夹</a-select-option>
              <a-select-option value="file"><FileOutlined /> 文件</a-select-option>
              <a-select-option value="book"><BookOutlined /> 书籍</a-select-option>
              <a-select-option value="star"><StarOutlined /> 星标</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="排序号">
            <a-input-number v-model:value="modalForm.sort" :min="0" style="width: 100%" />
          </a-form-item>
          <a-form-item label="分类描述">
            <a-textarea
              v-model:value="modalForm.description"
              :rows="3"
              placeholder="请输入分类描述"
            />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ApartmentOutlined,
  FileTextOutlined,
  ArrowUpOutlined,
  PlusOutlined,
  DownOutlined,
  UpOutlined,
  FolderOutlined,
  FileOutlined,
  BookOutlined,
  StarOutlined,
} from '@ant-design/icons-vue'
import { knowledgeCategoryApi, flattenCategories } from '../../api/knowledge'
import { describeHttpError } from '../../api/http'
import type { KnowledgeCategoryStats } from '../../api/knowledge'
import type { KnowledgeCategory, KnowledgeCategoryForm } from '../../types/knowledge'
import { useAuthStore } from '../../stores/auth'
import FilterBar from '../../components/FilterBar.vue'
import EmptyListHint from '../../components/EmptyListHint.vue'
import { asEmptyReason, offersCreateOnEmpty, type EmptyReason } from '../../utils/emptyPage'
import { logError } from '../../utils/errorLog'
import { createSubmitGuard } from '../../utils/submitGuard'
import PageTitle from '../../components/PageTitle.vue'

const authStore = useAuthStore()

/**
 * 这一屏的数属于谁。
 *
 * 改前这里是 `selectedTenantId || tenantId || 1`：`tenantId` 那个 getter 在没人选客户时回的是
 * 登录账号名下那一家，最后那个 `|| 1` 更会把人指到第一家去。超管打开这一屏、还没点租户切换时，
 * 树上摆的其实是 admin 名下那一家的分类，而界面一个字不提。
 * 现在没选定客户就是 null：两发请求都不发，屏上只说「还没有选定客户」。
 */
const requestedTenantId = computed<number | null>(() => {
  if (authStore.isSuperAdmin) return authStore.selectedTenantId ?? null
  return authStore.user?.tenantId ?? null
})

const scopeNotice = computed(() => {
  const id = requestedTenantId.value
  if (id === null) {
    return authStore.isSuperAdmin
      ? '当前没有选定客户，这一屏不发请求、也不摆任何一家的分类。请在右上角选一家客户。'
      : '登录信息里没有客户编号，这一屏不发请求、也不摆数。'
  }
  const code = authStore.selectedTenantCode
  const who = authStore.isSuperAdmin
    ? `当前看的是${code ? `客户「${code}」` : '选中的那一家客户'}（编号 #${id}）`
    : `当前看的是你所在客户（编号 #${id}）`
  return `${who}的资料库项目。`
})

const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editingCategory = ref<KnowledgeCategory | null>(null)

// 空态与三张卡的话只认后端与这一次读没读回来（N-05）：没发出去 / 读失败 / 后端答了成因 / 后端没答，四件事分开说
const notSentLine = ref('')
const readFailed = ref('')
const emptyLine = ref('')
const emptyReason = ref<EmptyReason>(null)
/** 「知识卡片」那一格只从 `/categories/stats` 读，它断了不该把树上已经读到的数一起抹掉 */
const statsFailed = ref('')

/** 三张卡：null 表示「没读到」，界面摆 `—`；摆 0 会被读成「这一家一个分类都没建」 */
const stats = reactive({
  totalCategories: null as number | null,
  totalCards: null as number | null,
  maxLevel: null as number | null,
})

function statText(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString()
}

/** 该不该摆「新增分类」：选定客户了、这一发读回来了、且后端答的是「真的没有」 */
const canCreateHere = computed(
  () =>
    requestedTenantId.value !== null &&
    !notSentLine.value &&
    !readFailed.value &&
    offersCreateOnEmpty(emptyReason.value)
)

const rightColumnHint = computed(() => {
  if (notSentLine.value) return '还没选定客户，左边那一列还没有分类可读。'
  if (readFailed.value) return `左边那一列没读上来（${readFailed.value}），这里没有可编辑的分类。`
  // 正在读的时候 categories 还是上一家那份（多半是空的）。这一格不许抢答「这一家还没有分类」：
  // 1 号那一家有 5 个分类，加载中那一眼读成「一个都没建」就是在撒谎
  if (loading.value) return '正在读这一家的分类，读回来之前这里不放分类。'
  if (categories.value.length === 0) return '这一家还没有分类，先在左侧新增一个。'
  return '请选择左侧分类进行编辑'
})

const searchText = ref('')
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const categories = ref<KnowledgeCategory[]>([])
const categoryStats = ref<KnowledgeCategoryStats[]>([])
const currentCategory = ref<KnowledgeCategory | null>(null)

const modalForm = reactive<KnowledgeCategoryForm>({
  // 归属在每次打开新建时按「这一屏选定的那一家」填（见 showAddModal）。
  // 这里留 0 只是类型占位：0 不是任何一家的编号，真发出去后端的写闸会当面拒（「指定的租户 0 不存在」）。
  tenantId: 0,
  name: '',
  parentId: null,
  icon: 'folder',
  description: '',
  sort: 0,
  status: 'active',
})

const treeData = computed(() => buildTree(categories.value, null))
const treeSelectData = computed(() => buildSelectTree(categories.value, null))
const filteredTreeData = computed(() => {
  if (!searchText.value) return treeData.value
  return filterTree(treeData.value, searchText.value)
})

function filterTree(nodes: any[], keyword: string): any[] {
  const lowerKeyword = keyword.toLowerCase()
  const result: any[] = []
  nodes.forEach(node => {
    const matches = String(node.title).toLowerCase().includes(lowerKeyword)
    const filteredChildren = node.children && node.children.length
      ? filterTree(node.children, keyword)
      : []
    if (matches || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      })
    }
  })
  return result
}

function getCategoryStats(id: number): KnowledgeCategoryStats | undefined {
  return categoryStats.value.find(s => s.id === id)
}

function buildTree(list: KnowledgeCategory[], parentId: number | null): any[] {
  return list
    .filter(item => (item.parentId || 0) === (parentId || 0))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .map(item => {
      const stats = getCategoryStats(item.id)
      const docCount = stats?.documentCount || 0
      const cardCount = stats?.cardCount || 0
      const totalCount = (stats?.totalCount) ?? (docCount + cardCount)
      return {
        title: item.name,
        key: String(item.id),
        status: item.status,
        icon: item.icon,
        documentCount: docCount,
        cardCount: cardCount,
        totalCount: totalCount,
        children: buildTree(list, item.id),
      }
    })
}

function buildSelectTree(list: KnowledgeCategory[], parentId: number | null): any[] {
  return list
    .filter(item => (item.parentId || 0) === (parentId || 0))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
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

function findNodeKeys(list: KnowledgeCategory[], matchFn: (item: KnowledgeCategory) => boolean): string[] {
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

function onSelect(keys: string[]) {
  if (keys.length) {
    const id = Number(keys[0])
    const category = categories.value.find(c => c.id === id)
    if (category) {
      currentCategory.value = { ...category }
    }
  }
}

async function onDrop(info: any) {
  const dragKey = info.dragNode.key
  const dropKey = info.node.key
  const dropPos = info.node.pos.split('-')
  const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1])

  const dragItem = categories.value.find(item => String(item.id) === dragKey)
  const dropItem = categories.value.find(item => String(item.id) === dropKey)

  if (!dragItem || !dropItem) return

  const oldParentId = dragItem.parentId
  let newParentId: number | null

  if (dropPosition === 0) {
    newParentId = dropItem.id
  } else {
    newParentId = dropItem.parentId
  }

  // 不允许移动到自身下
  if (newParentId === dragItem.id) {
    message.error('不能将分类移动到自身下')
    return
  }

  // 乐观更新本地数据
  dragItem.parentId = newParentId

  try {
    await knowledgeCategoryApi.update(dragItem.id, {
      tenantId: dragItem.tenantId,
      name: dragItem.name,
      parentId: newParentId,
      icon: dragItem.icon,
      description: dragItem.description,
      sort: dragItem.sort,
      status: dragItem.status,
    })
    message.success(dropPosition === 0 ? '已移动为子分类' : '已移动到同一级别')
  } catch (error) {
    // 回滚拖拽操作
    dragItem.parentId = oldParentId
    message.error(`移动分类失败，已回滚：${describeHttpError(error)}`)
  }
}

function showAddModal() {
  editingCategory.value = null
  // 新建的行归到哪家只认这一屏选定的那一家（后端的写闸按同一份判，两边不一致会当面拒）
  modalForm.tenantId = requestedTenantId.value ?? 0
  modalForm.name = ''
  modalForm.parentId = selectedKeys.value.length ? Number(selectedKeys.value[0]) : null
  modalForm.icon = 'folder'
  modalForm.description = ''
  modalForm.sort = 0
  modalForm.status = 'active'
  showModal.value = true
}

function editCategory(key: string) {
  const id = Number(key)
  const category = categories.value.find(c => c.id === id)
  if (category) {
    editingCategory.value = category
    modalForm.name = category.name
    modalForm.parentId = category.parentId
    modalForm.icon = category.icon
    modalForm.description = category.description
    modalForm.sort = category.sort
    modalForm.status = category.status
    showModal.value = true
  }
}

// 删除是不可逆写入（SPEC-UI-10 G-2）：同一拍连点两次只发一次请求（也不会叠出两个确认框）
const deleteGuard = createSubmitGuard()

async function deleteCategory(key: string) {
  if (deleteGuard.pending.value) return
  void deleteGuard.run(async () => {
    Modal.confirm({
      title: '确认删除',
      content: '删除此分类将同时删除其所有子分类，确定要删除吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await knowledgeCategoryApi.delete(Number(key))
          message.success('删除成功')
          await loadData()
        } catch (error) {
          message.error(`删除失败：${describeHttpError(error)}`)
        }
      },
    })
  })
}

async function handleModalOk() {
  if (!modalForm.name) {
    message.error('请输入分类名称')
    return
  }
  saving.value = true
  try {
    if (editingCategory.value) {
      await knowledgeCategoryApi.update(editingCategory.value.id, modalForm)
      message.success('更新成功')
    } else {
      await knowledgeCategoryApi.create(modalForm)
      message.success('创建成功')
    }
    showModal.value = false
    await loadData()
  } catch (error) {
    message.error(`操作失败：${describeHttpError(error)}`)
  } finally {
    saving.value = false
  }
}

async function saveCategory() {
  if (!currentCategory.value?.name) {
    message.error('请输入分类名称')
    return
  }
  saving.value = true
  try {
    await knowledgeCategoryApi.update(currentCategory.value.id, currentCategory.value)
    message.success('保存成功')
    await loadData()
  } catch (error) {
    message.error(`保存失败：${describeHttpError(error)}`)
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

async function loadData() {
  const tenantId = requestedTenantId.value
  if (tenantId === null) {
    // 没选定客户就一发都不发。改前这里发的是 `selectedTenantId || tenantId || 1`：
    // 超管没选客户时树上摆的其实是 1 号那一家的分类，而界面一个字不提
    loading.value = false
    notSentLine.value = '当前没有选定客户，这一发没发出去，所以左侧一棵分类都不是（这不是「这一家没有分类」）。'
    readFailed.value = ''
    statsFailed.value = ''
    emptyLine.value = ''
    emptyReason.value = null
    clearRead()
    stats.totalCategories = null
    stats.totalCards = null
    stats.maxLevel = null
    return
  }
  loading.value = true
  notSentLine.value = ''
  readFailed.value = ''
  statsFailed.value = ''
  emptyLine.value = ''
  emptyReason.value = null
  // 三张卡跟着这一发一起归零：换客户时页首已经先写上新一家的名字，卡里还是上一家的数就是认错人
  stats.totalCategories = null
  stats.totalCards = null
  stats.maxLevel = null
  // 树与统计各读各的：统计那一口断了，不把树上已经读到的数抹成空；树断了也不会假装卡片读回来了
  const [allResult, statsResult] = await Promise.allSettled([
    knowledgeCategoryApi.all(tenantId),
    knowledgeCategoryApi.stats(tenantId),
  ])

  if (allResult.status === 'fulfilled') {
    // /categories/all 返回树形结构，本地按 parentId 组树需要平铺列表
    const list = flattenCategories(allResult.value.records || [])
    categories.value = list
    stats.totalCategories = list.length
    stats.maxLevel = getMaxLevel(list)
    emptyLine.value = allResult.value.emptyLine || ''
    emptyReason.value = asEmptyReason(allResult.value.emptyReason)
    if (list.length && !list.some(item => String(item.id) === selectedKeys.value[0])) {
      // 换了一家客户：勾选要跟着落到这一家的第一个分类上，不能留着上一家的编号
      selectedKeys.value = [String(list[0].id)]
      currentCategory.value = { ...list[0] }
    }
    if (!list.length) {
      selectedKeys.value = []
      currentCategory.value = null
    }
  } else {
    const reason = describeHttpError(allResult.reason)
    readFailed.value = reason
    categories.value = []
    stats.totalCategories = null
    stats.maxLevel = null
    selectedKeys.value = []
    currentCategory.value = null
    message.error(`加载分类数据失败：${reason}`)
    logError('knowledge/category-view', '加载分类失败:', allResult.reason)
  }

  if (statsResult.status === 'fulfilled') {
    categoryStats.value = statsResult.value || []
    stats.totalCards = categoryStats.value.reduce((sum, s) => sum + (s.cardCount || 0), 0)
  } else {
    statsFailed.value = describeHttpError(statsResult.reason)
    categoryStats.value = []
    stats.totalCards = null
    logError('knowledge/category-view', '加载分类统计失败:', statsResult.reason)
  }

  loading.value = false
}

/** 读回来的行清干净（切客户与读失败都走这里），三张卡的数由调用处按「读没读到」分别定 */
function clearRead() {
  categories.value = []
  categoryStats.value = []
  currentCategory.value = null
  selectedKeys.value = []
}

function getMaxLevel(list: KnowledgeCategory[]): number {
  if (!list.length) return 0
  let max = 1
  list.forEach(item => {
    let level = 1
    let parentId = item.parentId
    while (parentId) {
      level++
      const parent = list.find(p => p.id === parentId)
      parentId = parent?.parentId || null
    }
    max = Math.max(max, level)
  })
  return max
}

onMounted(() => {
  loadData()
})

// 右上角换了一家客户就得重取：这一屏的树、三张卡、新建归到哪家，按的都是那一家
watch(requestedTenantId, () => {
  clearRead()
  searchText.value = ''
  loadData()
})
</script>

<style scoped lang="less">
.scope-hint {
  margin-bottom: 16px;
  color: #8c8c8c;
  font-size: 13px;
  line-height: 20px;
}

.knowledge-category-page {
  width: 100%;
  padding: 8px 0;
}

.scope-alert {
  margin-bottom: 12px;
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

.tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  padding-right: 8px;
}

.node-title {
  flex: 1;
}

.node-count {
  font-size: 12px;
  color: #8c8c8c;
  margin-left: 8px;
}

.node-actions {
  opacity: 0.5;
  transition: opacity 0.3s;
  margin-left: auto;
}

:deep(.ant-tree-treenode):hover .node-actions {
  opacity: 1;
}
</style>
