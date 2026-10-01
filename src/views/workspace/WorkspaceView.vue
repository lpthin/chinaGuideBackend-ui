<template>
  <a-layout class="workspace-layout">
    
    <!-- 顶部导航栏 -->
    <a-layout-header class="header">
      <div class="header-left">
        <a-button type="text" @click="toggleCollapse" class="collapse-btn">
          <component :is="siderCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
        </a-button>
        <div class="logo">
          <span class="logo-icon">📝</span>
          <span class="logo-text">内容管理系统</span>
        </div>
      </div>
      <div class="header-right">
        <a-space>
          <!-- Spec-H Q11：段过滤（只看租户 / 只看平台 / 全看） -->
          <a-segmented
            v-if="auth.isSuperAdmin"
            v-model:value="domainFilter"
            :options="[
              { label: '全部', value: 'all' },
              { label: '租户', value: 'tenant' },
              { label: '平台', value: 'platform' }
            ]"
            size="small"
            style="margin-right: 8px"
          />
          <TenantSwitcher v-if="auth.isSuperAdmin" />
          <a-button
            v-if="auth.isSuperAdmin"
            type="primary"
            size="small"
            @click="handleReturnToAdmin"
          >
            返回管理员端
          </a-button>
          <a-tooltip title="统计面板">
            <a-button type="text" @click="openDashboard">
              <BarChartOutlined />
            </a-button>
          </a-tooltip>
          <a-divider type="vertical" />
          <a @click="openPortalHome" style="margin-right: 12px; color: #1890ff; font-weight: 500; cursor: pointer;">
            查看前端
          </a>
          <a-dropdown>
            <a-button type="text" class="user-dropdown-btn">
              <a-avatar
                :size="28"
                :src="auth.user?.avatar"
                :icon="!auth.user?.avatar ? h(UserOutlined) : undefined"
                class="header-avatar"
              />
              <span class="username-text">{{ auth.nickname || auth.username || '管理员' }}</span>
              <DownOutlined />
            </a-button>
            <template #overlay>
              <a-menu @click="handleUserMenuClick">
                <a-menu-item key="profile">个人中心</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout">退出登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </div>
    </a-layout-header>

    <!-- 主体内容区 -->
    <a-layout class="main-layout">
      <!--
        左侧侧边栏：整棵菜单由 `src/navigation/workspaceMenu.ts` 从路由表生成（Spec「建站重构」§3.1）。
        这一层只渲染，不再抄标签、图标、权限码——以前这里手写 19 个 portal 菜单项，外加 menuLabels 与
        currentParentMenu 两张表：路由改了这里不改，于是「文章分类」在菜单里仍叫「栏目管理」；
        区块画廊这里判 preset 码而路由要 manage 码，看得见、点进去 403。
      -->
      <a-layout-sider width="240" :collapsed-width="narrow ? 56 : 80" class="side-menu"
        :collapsed="siderCollapsed" collapsible :trigger="null">
        <nav class="sidebar-nav">
          <!--
            Spec-H H-2（Q10-a）：菜单搜索框。
            P1 现场量到最大那组展开后整栏要滚 1.57 屏，「知道要找什么但不想一屏屏翻」得有解法。
            折叠成图标轨（80 / 窄屏 56 宽）时整块搜索 UI 都不出现：那个宽度放不下输入框，
            而折叠态的找法本来就是 hover 弹层，不是过滤。
          -->
          <div v-if="showMenuSearch" class="menu-search">
            <a-input
              v-model:value="menuQuery"
              class="menu-search__input"
              placeholder="搜索栏目"
              allow-clear
              data-testid="menu-search"
            >
              <template #prefix><SearchOutlined /></template>
            </a-input>
          </div>

          <template v-if="isSearching">
            <a-menu
              v-if="menuHits.length"
              mode="inline"
              :selected-keys="selectedKeys"
              class="sidebar-menu sidebar-menu--hits"
              @click="handleMenuClick"
            >
              <a-menu-item v-for="hit in menuHits" :key="hit.key">
                <template #icon><component :is="hit.icon" /></template>
                <span class="menu-leaf__label">{{ hit.label }}</span>
                <span class="menu-hit__group">{{ hit.groupLabel || '固定入口' }}</span>
              </a-menu-item>
            </a-menu>
            <!-- H-2 判据的后半句：没有命中要明说，不许留一片空白让人以为菜单坏了 -->
            <div v-else class="menu-search__empty" data-testid="menu-search-empty">
              没有「{{ menuQuery.trim() }}」这一项
            </div>
          </template>

          <template v-else>
          <a-menu
            v-if="topLeaf"
            mode="inline"
            :selected-keys="selectedKeys"
            :inline-collapsed="siderCollapsed"
            class="sidebar-menu sidebar-menu--single"
            @click="handleMenuClick"
          >
            <a-menu-item :key="topLeaf.key">
              <template #icon><component :is="topLeaf.icon" /></template>
              {{ topLeaf.label }}
            </a-menu-item>
          </a-menu>

          <section v-for="section in filteredMenuSections" :key="section.domain" class="menu-domain">
            <!-- Spec-H Q7-a：段标题一行说完，第二行说明进 tooltip（Q6-a 同一条纪律：说明不许消失，只许换地方） -->
            <a-tooltip v-if="!siderCollapsed" :title="section.hint" placement="right">
              <div class="menu-domain__label">{{ section.label }}</div>
            </a-tooltip>
            <div v-else class="menu-domain__rule" aria-hidden="true"></div>

            <a-menu
              mode="inline"
              :data-domain="section.domain"
              :selected-keys="selectedKeys"
              :open-keys="openKeysFor(section.domain)"
              :inline-collapsed="siderCollapsed"
              class="sidebar-menu"
              @update:open-keys="(keys: (string | number)[]) => onOpenKeysChange(section.domain, keys)"
              @click="handleMenuClick"
            >
              <!--
                Spec-H H-1a：组从 `<a-menu-item-group>`（静态标题，收不了）换成 `<a-sub-menu>`。
                换完这三件事一起成立：标题带箭头可点收（H-1a）、折叠轨收成 11 颗分类图标 + hover 弹层
                （H-1d，那条给组标题打的 height:0 补丁随之删掉）、开合能被记住（H-1b，见 navState.ts）。
                组图标取 `MENU_GROUPS[].icon`，与项图标同一个注册表，视图里不写死第二份。
              -->
              <a-sub-menu v-for="group in section.groups" :key="group.def.key">
                <template #icon><component :is="menuIcon(group.def.icon)" /></template>
                <template #title>
                  <a-tooltip v-if="!siderCollapsed" :title="group.def.hint" placement="right">
                    <span class="menu-group__label">{{ group.def.label }}</span>
                  </a-tooltip>
                  <span v-else class="menu-group__label">{{ group.def.label }}</span>
                </template>
                <a-menu-item v-for="leaf in group.items" :key="leaf.key">
                  <template #icon><component :is="leaf.icon" /></template>
                  <a-tooltip v-if="leaf.tip" :title="leaf.tip" placement="right">
                    <span class="menu-leaf__label">{{ leaf.label }}</span>
                  </a-tooltip>
                  <span v-else>{{ leaf.label }}</span>
                </a-menu-item>
              </a-sub-menu>
            </a-menu>
          </section>

          <a-menu
            v-if="bottomLeaf"
            mode="inline"
            :selected-keys="selectedKeys"
            :inline-collapsed="siderCollapsed"
            class="sidebar-menu sidebar-menu--bottom"
            @click="handleMenuClick"
          >
            <a-menu-item :key="bottomLeaf.key">
              <template #icon><component :is="bottomLeaf.icon" /></template>
              <a-tooltip v-if="bottomLeaf.tip" :title="bottomLeaf.tip" placement="right">
                <span class="menu-leaf__label">{{ bottomLeaf.label }}</span>
              </a-tooltip>
              <span v-else>{{ bottomLeaf.label }}</span>
            </a-menu-item>
          </a-menu>
          </template>
        </nav>
      </a-layout-sider>

      <!-- 主要工作区 -->
      <a-layout-content class="workspace-content">
        <!-- 工作区 -->
        <div class="workspace-area">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" :key="pageKey" />
            </transition>
          </router-view>
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide, watch, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import TenantSwitcher from '../../components/TenantSwitcher.vue'
import {
  BarChartOutlined,
  DashboardOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { routes } from '../../router'
import {
  MENU_TOP_ROUTE,
  bottomMenuLeaf,
  buildMenuSections,
  collectMenuLeaves,
  findLeaf,
  leafVisible,
  menuCrumb,
  menuIcon,
  selectedMenuKey,
  type MenuDomain
} from '../../navigation/workspaceMenu'
import {
  applyOpenKeysChange,
  filterMenuSections,
  flattenMenuEntries,
  initialOpenGroups,
  normalizeMenuQuery,
  openKeysForDomain,
  readStoredDomainFilter,
  readStoredOpenGroups,
  readStoredSiderCollapsed,
  searchMenuHits,
  type DomainFilter,
  withGroupOpen,
  writeStoredDomainFilter,
  writeStoredOpenGroups,
  writeStoredSiderCollapsed
} from '../../navigation/navState'
import { portalSectionsApi } from '../../api/portalSections'
import { message } from 'ant-design-vue'
import { describeHttpError } from '../../api/http'
import { logError, logWarn } from '../../utils/errorLog'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

/**
 * 内容类菜单项按栏目开通态显隐（Spec §7.1）。判据是后端词表里每个栏目的 contentEntry 字段，
 * 不是在前端再抄一份栏目清单（I-1）。拉取失败就全显示（null = 不知道）：这一处挡的是
 * 「点进去只有一片空白」，权限从来不由这里判，三个只读端点各自挂着 @RequirePermission。
 */
const openContentEntries = ref<Set<string> | null>(null)

async function loadSectionEntries() {
  try {
    const states = await portalSectionsApi.list()
    openContentEntries.value = new Set(
      states.filter(state => state.enabled).map(state => state.contentEntry))
  } catch {
    openContentEntries.value = null
  }
}

/** 路由定义顺序 = 界面上的上下顺序；`router.getRoutes()` 按路径权重排过序，不能用它 */
const menuLeaves = computed(() => collectMenuLeaves(routes))

const visibility = computed(() => ({
  isSuperAdmin: auth.isSuperAdmin,
  hasPermission: (code: string) => auth.hasPermission(code),
  openContentEntries: openContentEntries.value
}))

const menuSections = computed(() => buildMenuSections(menuLeaves.value, visibility.value))

/**
 * 段过滤（Spec-H Q11）：超管视角下可以只看租户 / 只看平台 / 全看。
 * 这一位是「人按了那一下」的偏好，所以进 localStorage。
 * 非超管（租户视角）永远看全部（他们本来就只有租户段，过滤没意义）。
 */
const domainFilter = ref<DomainFilter>(auth.isSuperAdmin ? readStoredDomainFilter() : 'all')
watch(domainFilter, value => {
  if (auth.isSuperAdmin) writeStoredDomainFilter(value)
})
const filteredMenuSections = computed(() => filterMenuSections(menuSections.value, domainFilter.value))

/** 菜单最上方那颗固定项（工作台）：标签与图标同样来自那条路由，视图里不写死中文 */
function visibleFixedLeaf(routeName: string) {
  const leaf = findLeaf(routeName, menuLeaves.value)
  return leaf && leafVisible(leaf, visibility.value) ? leaf : null
}

const topLeaf = computed(() => visibleFixedLeaf(MENU_TOP_ROUTE))
// 下方那一颗按角色取（Spec-H H-6）：超管 = 平台工单队列，租户 = 联系平台，同一个位置只留一颗
const bottomLeaf = computed(() => bottomMenuLeaf(menuLeaves.value, visibility.value))

/**
 * 选中态用最长前缀匹配。旧实现取「路径首段」+ 手抄一份前缀白名单，于是 `media/library`（图片库）
 * 与 `media-storage`（素材存储）抢同一个 key，图片库的高亮跑到素材存储上；
 * 详情页（`articles/12`、`knowledge/cards/3`）也不用再抄映射，自动归到它的列表项。
 */
const currentMenuKey = computed(() => selectedMenuKey(route.path, menuLeaves.value))

const selectedKeys = computed(() => (currentMenuKey.value ? [currentMenuKey.value] : []))

/** 面包屑两级来自组与项本身：那张 60 行的 currentParentMenu 手抄表删掉了 */
const crumb = computed(() => menuCrumb(currentMenuKey.value, menuLeaves.value))

/**
 * 组的开合表（Spec-H H-1b/H-1c）。规则只有一条：**用户的手比默认值大**。
 * - 第一次进来（localStorage 没记过）→ 只展开当前路由所在那一组，其余收起；
 * - 记过 → 原样还给他，连「当前这一组也被他收过」都不例外（判据：收起三组刷新仍是收起态）；
 * - 换到一个收起的组里的页面 → 那一组自动开，不然会出现「菜单选中了但那一行看不见」。
 * 合并、顺序、旧键清洗这些都在 `navigation/navState.ts`，用例直接钉那几支纯函数。
 */
const currentGroupKey = computed(() => {
  const leaf = menuLeaves.value.find(item => item.key === currentMenuKey.value)
  return leaf?.group ?? ''
})

const openGroups = ref<string[]>(initialOpenGroups(readStoredOpenGroups(), currentGroupKey.value))

watch(openGroups, keys => writeStoredOpenGroups(keys))
watch(currentGroupKey, key => {
  if (key) openGroups.value = withGroupOpen(openGroups.value, key)
})

/** 两段各一个 `<a-menu>`，antd 每次只吐自己那段的键 ⇒ 这里按段取、按段并回去 */
function openKeysFor(domain: MenuDomain) {
  return openKeysForDomain(openGroups.value, domain)
}

function onOpenKeysChange(domain: MenuDomain, keys: Array<string | number>) {
  openGroups.value = applyOpenKeysChange(openGroups.value, domain, keys.map(String))
}

/**
 * 整栏折叠（Q3-a）：这一位是「人按了那下折叠键」的偏好，所以进 localStorage。
 * 窄屏那位（`narrow`）不进——那是窗口宽度决定的，记下来等于替用户做了他没做过的选择。
 */
const collapsed = ref(readStoredSiderCollapsed())
const pageKey = ref(0)
const refreshing = ref(false)
const importCallback = ref<(() => void) | null>(null)

/**
 * 窄屏（手机那一档）另算一位，不跟 `collapsed` 混在一起。
 *
 * 为什么不能直接改 `collapsed`：那是「人按了那下折叠键」的偏好，窗口一宽就该还回来。
 * 混用会变成「手机上展开过菜单，回到电脑前菜单还是折叠的」——用户没做过这个选择。
 * 判据只有 768 这一道，跟 antd 自己的 `breakpoint="md"` 同口径；这里没用组件的
 * breakpoint 属性，是因为菜单标签那一排 `v-if="!collapsed"` 也要跟着同一位走。
 */
const NARROW_QUERY = '(max-width: 768px)'
const narrow = ref(typeof window !== 'undefined' && !!window.matchMedia?.(NARROW_QUERY).matches)
let narrowListener: ((e: MediaQueryListEvent) => void) | null = null

onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  const mq = window.matchMedia(NARROW_QUERY)
  narrowListener = (e: MediaQueryListEvent) => {
    narrow.value = e.matches
  }
  mq.addEventListener('change', narrowListener)
})

onUnmounted(() => {
  if (narrowListener && typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia(NARROW_QUERY).removeEventListener('change', narrowListener)
    narrowListener = null
  }
})

/** 侧栏实际给不给宽度：窄屏一律收成图标那一列，否则 240 的菜单会把内容挤成一列一个字 */
const siderCollapsed = computed(() => collapsed.value || narrow.value)

/**
 * 菜单搜索（Spec-H H-2 / Q10-a）：输入即过滤，命中项不必先展开组就看得见。
 *
 * 判据与实现的一处有意偏离，写清楚（拍板原话是「命中项展开」）：
 * 这里**不去改树里的开合表**。展开要把那一组写进 `openGroups`，而 `openGroups` 是要落盘的
 * 用户偏好（H-1b）——一次搜索就改掉这个人记住的那份开合，清空搜索框之后那些组还收不回去，
 * 「我搜了个东西」变成了「程序替我改了菜单偏好」。
 * 换成扁平命中列表之后，「看得见命中项 + 它属于哪一组」这个效果一样达到，偏好一个字不动。
 * 命中面（项名 / 项说明 / 组名）与「组说明为什么不参与命中」写在 `navState.searchMenuHits` 上，
 * 用例直接钉那支纯函数。
 */
const menuQuery = ref('')
const showMenuSearch = computed(() => !siderCollapsed.value)
const menuEntries = computed(() => flattenMenuEntries(filteredMenuSections.value, topLeaf.value, bottomLeaf.value))
const isSearching = computed(() => showMenuSearch.value && normalizeMenuQuery(menuQuery.value).length > 0)
const menuHits = computed(() => (isSearching.value ? searchMenuHits(menuEntries.value, menuQuery.value) : []))

/** 点了命中项就回到正常的树：选中的那一组由上面 `watch(currentGroupKey)` 负责开，不留搜索态 */
watch(currentMenuKey, () => {
  menuQuery.value = ''
})

const showImportBtn = computed(() => currentMenuKey.value === 'keywords')

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
  writeStoredSiderCollapsed(collapsed.value)
}

const handleMenuClick = ({ key }: { key: string }) => {
  router.push(`/workspace/${key}`)
}

const openDashboard = () => {
  router.push('/workspace/dashboard')
}

/**
 * 刷新要能报错：以前只是 router.replace(同一路径) 再无条件弹「已刷新」，
 * 后端整体 502 时用户看到的仍是成功提示。现在先探活，再重挂载当前页让子组件重新拉数据。
 */
const refresh = async () => {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await auth.fetchCurrentUser()
  } catch (e) {
    message.error(`刷新失败：${describeHttpError(e)}`)
    refreshing.value = false
    return
  }
  // 栏目开通态一并重取：超管刚开的栏目不该等用户换入口才发现菜单里多了那一项
  loadSectionEntries()
  pageKey.value += 1
  message.success('已刷新')
  refreshing.value = false
}

const handleImport = () => {
  if (importCallback.value) {
    importCallback.value()
  }
}

const handleUserMenuClick = ({ key }: { key: string }) => {
  if (key === 'profile') {
    router.push('/workspace/user/profile')
  } else if (key === 'logout') {
    handleLogout()
  }
}

const handleReturnToAdmin = () => {
  auth.switchTenant(null)
  message.success('已切换到管理员视角')
}

const openPortalHome = () => {
  window.open('/', '_blank')
}

const handleLogout = async () => {
  try {
    await auth.logout()
    message.success('已退出登录')
    router.push('/login')
  } catch (error) {
    logError('workspace/workspace-view', '退出登录失败:', error)
    message.error('退出登录失败')
  }
}

// 提供给子组件的方法
provide('setImportCallback', (callback: () => void) => {
  importCallback.value = callback
})

// 监听租户切换，刷新当前页面
watch(
  () => auth.selectedTenantId,
  () => {
    refresh()
  }
)

// 清除回调，避免内存泄漏
onMounted(() => {
  // 路由变化时清除回调
  router.afterEach(() => {
    importCallback.value = null
  })

  // 拉取一次最新的当前用户信息，确保头像/角色是最新的
  if (auth.accessToken) {
    auth.fetchCurrentUser().catch((e) => {
      logWarn('workspace/workspace-view', '刷新当前用户信息失败:', e)
    })
  }
  loadSectionEntries()
})

// 超管切换站点上下文之后，栏目开通态是另一个站点的，菜单得跟着重算
watch(() => [auth.selectedTenantId, auth.selectedTenantCode].join(':'), loadSectionEntries)
</script>

<style scoped>
.workspace-layout {
  height: 100vh;
  background: #f5f7fa;
  overflow: hidden;
}

.welcome-alert {
  margin: 16px 16px 0;
}

.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  height: 64px;
  line-height: 64px;
  border-bottom: 1px solid #e8e8e8;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 16px;
  /* 现场量出来这一颗是 38 高，而后台所有按钮是 32：padding 8 + 16 号图标把方形撑大了。
     钉成 32 之后顶栏那一排才是同一条基线（Spec-F §9.2 控件高度一处口径） */
  height: 32px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.header-right {
  display: flex;
  align-items: center;
}

.main-layout {
  display: flex;
  /* 顶栏在窄屏会换成两行，64 那个写死的高度就把这一列顶歪了；父级已经是 100vh 的纵向 flex，
     这里改成「占满剩下的、并且允许被压」，两种宽度都不用再抄一个 64 出来 */
  flex: 1;
  min-height: 0;
}

.side-menu {
  background: #fff;
  border-right: 1px solid #e8e8e8;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  position: sticky;
  top: 0;
  left: 0;
}

.sidebar-nav {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 8px;
}

/* 侧边栏面包屑：放在搜索框上面，不占页面内容空间 */
.sidebar-breadcrumb {
  flex: none;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 4px;
}

.sidebar-breadcrumb :deep(.ant-breadcrumb) {
  font-size: 12px;
}

.sidebar-breadcrumb :deep(.ant-breadcrumb-separator) {
  margin: 0 4px;
}

.sidebar-breadcrumb :deep(.ant-breadcrumb-link) {
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.sidebar-breadcrumb :deep(.ant-breadcrumb-link:hover) {
  color: #1890ff;
}

.sidebar-breadcrumb :deep(.ant-breadcrumb-last) {
  color: rgba(0, 0, 0, 0.88);
  cursor: default;
}

.sidebar-menu {
  border-right: none;
}

/*
 * 菜单搜索框（Spec-H H-2）：贴在菜单最上方、固定项「工作台」之上。
 * 下边框跟段分隔线同一个色，视觉上属于同一条竖排层级，不是一块浮在菜单上的卡片。
 */
.menu-search {
  flex: none;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 4px;
}

/* 命中项右侧那 little 组名：让用户知道这一项从哪一组来（H-2 判据「只剩含"引用"的项 + 其组名」） */
.menu-hit__group {
  margin-left: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 无结果那一行是明说的，不是留白 */
.menu-search__empty {
  padding: 16px;
  font-size: 13px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.45);
}

.sidebar-menu--single {
  flex: none;
}

/* 菜单最下方那一颗（租户 = 联系平台，超管 = 平台工单队列）：压在最后，不该混在内容项中间 */
.sidebar-menu--bottom {
  margin-top: auto;
  border-top: 1px solid #f0f0f0;
}

.menu-domain {
  flex: none;
}

.menu-domain + .menu-domain {
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
  padding-top: 4px;
}

/*
 * 两段标题把「租户日常」与「平台建站动作」分家（Spec「建站重构」R-1 的第一半：先分开）。
 * Spec-H Q7-a：段标题只有一行（「日常：填内容…」那句挪进 tooltip，见模板上的 a-tooltip）；
 * 折叠成窄栏时连这一行也收掉，只留一条分隔线——窄栏里塞说明会把菜单挤成一团。
 */
.menu-domain__label {
  padding: 10px 16px 2px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.45);
  line-height: 18px;
}

.menu-domain__rule {
  margin: 10px 12px 4px;
  border-top: 1px solid #f0f0f0;
}

/*
 * 组标题（Spec-H Q6-a）：一行、不带第二行小字。
 * 小字以前摊在这里（11 条 180 字 = 组头 803px 里的一大半），现在只作为 tooltip 存在。
 *
 * H-1a 之后组是 `SubMenu`：这一行落在 `.ant-menu-submenu-title` 里，比菜单项重一点，
 * 让「一组」与「一项」在视觉上还分得开（以前靠字号小、颜色浅的 ItemGroup 标题区分，
 * 换成可收合的行之后只能靠字重，不然 11 个组名跟 73 个项名混成一片）。
 */
.menu-group__label {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.ant-menu-submenu-title .menu-group__label) {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.75);
}

/*
 * H-1d：折叠轨不再需要给分组标题打 `height:0` 的补丁。
 * 那条补丁针对的病灶（antd 折叠时只藏菜单项文字、不藏组标题，于是 55px 的轨道上浮着一列
 * 没有归属的组名）随 `<a-menu-item-group>` 一起消失了——`SubMenu` 在折叠态原生收成
 * 一颗图标 + hover 弹层，弹层里才是组名与子项。
 */

.workspace-content {
  flex: 1;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  overflow-x: visible;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  background: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.page-actions {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.workspace-area {
  background: #fff;
  border-radius: 8px;
  padding: 20px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  overflow: visible;
  box-sizing: border-box;
}

/* TenantSwitcher 样式适配白色导航栏 */
:deep(.tenant-switcher) {
  width: 160px;
}

:deep(.tenant-switcher .ant-select-selector) {
  background-color: #f5f7fa !important;
  border: 1px solid #e8e8e8 !important;
  color: #1a1a1a !important;
  border-radius: 4px;
  height: 32px !important;
}

:deep(.tenant-switcher .ant-select-arrow) {
  color: #666 !important;
}

:deep(.tenant-switcher .ant-select-selection-placeholder) {
  color: #999 !important;
}

:deep(.tenant-switcher .ant-select-selection-item) {
  color: #1a1a1a !important;
  line-height: 32px !important;
}

:deep(.tenant-switcher:hover .ant-select-selector) {
  background-color: #e8f0fe !important;
  border-color: #1890ff !important;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 用户下拉按钮 */
.user-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  height: auto;
}

.user-dropdown-btn :deep(.ant-btn-icon) {
  margin-inline-end: 0 !important;
}

.header-avatar {
  flex-shrink: 0;
  border: 1px solid #e8e8e8;
}

.username-text {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 窄屏那一档（≤768，与侧栏收成图标列同一个判据）────────────────────────
   现场病（截图 p6o-shots/01-dashboard-m.png，375 宽）：顶栏右侧那排动作一路排到
   x=455，被 header 裁在屏幕外——「返回管理员端 / 统计 / 查看前端」在手机上点不到；
   同时侧栏还占着 240，内容列被挤成 23 宽，一行一个字。菜单收成图标列解决内容那一半，
   这一段解决顶栏那一半：文字让位、允许换行，按钮一颗都不许藏。 */
@media (max-width: 768px) {
  .header {
    padding: 4px 8px;
    height: auto;
    min-height: 56px;
    line-height: 1.5;
    flex-wrap: wrap;
    row-gap: 2px;
  }

  .header-left {
    gap: 6px;
  }

  .header-right {
    margin-left: auto;
    min-width: 0;
  }

  .header-right :deep(.ant-space) {
    flex-wrap: wrap;
    column-gap: 4px;
  }

  .logo-text,
  .username-text {
    display: none;
  }

  :deep(.tenant-switcher) {
    width: 112px;
  }

  .workspace-content {
    padding: 8px;
  }
}
</style>
