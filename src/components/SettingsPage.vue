<script setup lang="ts">
/**
 * C 型「设置表单」页模板（Spec-Q §4.1 C 型，P3 第一次落地；用它的是企业信息和站点设置两页）。
 *
 * 立这个组件的理由是实测：企业信息那一屏 8 张卡、37 格要填，整页高 2648px，
 * 没有一个地方告诉你「填到哪儿了、还差哪几格」，也定位不了——想改一个邮编得从头滚到底；
 * 站点设置那一屏读失败只弹一个 toast，页面上照样摆着一份空表（Q3 拍的「三态各说各的」正是拦这个）。
 * 这里把四件事收在一处：
 *
 * 1. 页头一次：标题 + 一句说明 + 右上那组动作（保存 / 重置）只摆一回，不在每张卡里重复。
 * 2. 分组锚点一排 + 完成度读数（已填 X / 共 Y 项）：分母来自页面声明的字段清单，
 *    数字由 settingsPageModel.ts 那三个纯函数算，模板不猜、页面也不许自己写一个数。
 * 3. 限宽 + 窄屏折单栏：原来右列写死 `:span="8"`，526px 视口下直接压扁（§1.2）。
 * 4. 三态各说各的：没发出去 / 读失败 / 还没取到，读失败时整组卡退场——
 *    一份没读回来的空表摆在那儿还能点保存，那就是拿空表单去覆盖客户填过的东西。
 *
 * 不做两件事：
 * - 不替页面决定「怎么保存」。站点设置那一屏的写口天生是一格一 save
 *   （后端 PUT 只认 `{ fields: { key: patch } }`），硬套「页头一颗保存按钮」会改接口，
 *   §10 明确不许动接口；所以 `#actions` 是可省的，卡里的动作条由页面自己摆。
 * - 不做粘性吸顶。这一屏的滚动容器在布局壳里，吸顶要不要加取决于壳的 overflow，
 *   留给实测；跳转靠锚点这一排已经成立。
 */
import { computed, ref } from 'vue'
import PageTitle from './PageTitle.vue'
import StateBlock from './StateBlock.vue'
import {
  groupProgress,
  settingsAnchorId,
  settingsProgress,
  settingsProgressText,
  type SettingsGroup
} from './settingsPageModel'

const props = withDefaults(
  defineProps<{
    /** 这一屏是干什么的，只这一句（同一屏不许在卡头再解释一遍） */
    description?: string
    loading?: boolean
    /** 两栏形：主列 + 右侧窄列。窄屏（<992px）折回一栏，两组仍按数组顺序 */
    twoColumn?: boolean
    /** 连请求都没发出去（超管没选定客户就是这一档）：它既不是读失败也不是没填 */
    notSent?: string
    /** 读失败的后端原话：非空时整组卡退场，只说失败 */
    readFailed?: string
    /** 后端答了但这一屏还没有内容（未取到）：和「读失败」是两件事 */
    notRead?: string
    groups?: readonly SettingsGroup[]
    /** 读数前面那个词。默认「已填」；AI 先填好的那一屏传「AI 已填」，不让人以为是自己没填 */
    progressWord?: string
  }>(),
  {
    description: '',
    loading: false,
    twoColumn: false,
    notSent: '',
    readFailed: '',
    notRead: '',
    groups: () => [],
    progressWord: '已填',
  }
)

const progress = computed(() => settingsProgress(props.groups))
/** 一格的字段都没声明（只读表那种）就不摆读数——摆一个「已填 0 / 共 0 项」是谎报 */
const hasFields = computed(() => progress.value.total > 0)
const progressText = computed(() => settingsProgressText(progress.value, props.progressWord))
const missingOpen = ref(false)

/**
 * `side` 只在两栏形里生效。单栏页里带 `side` 的组必须仍留在主列——
 * 按「非 side」硬筛会让那一组凭空消失（页面没开两栏时，它连卡都不该少一张）。
 */
const mainGroups = computed(() =>
  props.twoColumn ? props.groups.filter(group => !group.side) : [...props.groups]
)
const sideGroups = computed(() =>
  props.twoColumn ? props.groups.filter(group => group.side) : []
)
/** 锚点那一排：把「这一组齐了几项」先算好，模板里不做非空断言 */
const anchorRows = computed(() =>
  props.groups.map(group => ({ ...group, progress: groupProgress(group) }))
)

function jump(groupKey: string) {
  const target = document.getElementById(settingsAnchorId(groupKey))
  if (!target || typeof target.scrollIntoView !== 'function') return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  missingOpen.value = false
}
</script>

<template>
  <div class="settings-page" :class="{ 'settings-page--two': twoColumn }">
    <PageTitle :description="description">
      <template v-if="$slots.actions" #extra>
        <slot name="actions" />
      </template>
    </PageTitle>

    <a-alert v-if="notSent" class="settings-page__notice" type="info" show-icon :message="notSent" />

    <div v-if="readFailed" class="settings-page__state">
      <StateBlock state="error" :detail="readFailed">
        <slot name="retry" />
      </StateBlock>
    </div>

    <div v-else-if="notRead" class="settings-page__state">
      <StateBlock state="not-measured" :detail="notRead">
        <slot name="retry" />
      </StateBlock>
    </div>

    <template v-else>
      <div v-if="hasFields" class="settings-page__bar">
        <nav class="settings-page__anchors" aria-label="分组跳转">
          <a
            v-for="group in anchorRows"
            :key="group.key"
            class="settings-page__anchor"
            :href="`#${settingsAnchorId(group.key)}`"
            data-anchor-group
            @click.prevent="jump(group.key)"
          >
            {{ group.label }}
            <span v-if="group.progress" class="settings-page__anchor-count">
              {{ group.progress.filled }}/{{ group.progress.total }}
            </span>
          </a>
        </nav>

        <p class="settings-page__progress">
          <span class="settings-page__progress-num">{{ progressText }}</span>
          <span v-if="progress.requiredMissing.length" class="settings-page__required">
            必填还没填：
            <a
              v-for="item in progress.requiredMissing"
              :key="`${item.groupKey}-${item.label}`"
              class="settings-page__jump"
              href="#"
              data-jump-group
              @click.prevent="jump(item.groupKey)"
            >{{ item.label }}</a>
          </span>
          <a
            v-else-if="progress.missing.length"
            class="settings-page__jump"
            href="#"
            data-missing-toggle
            @click.prevent="missingOpen = !missingOpen"
          >还差 {{ progress.missing.length }} 项，点这里看</a>
        </p>

        <p v-if="missingOpen" class="settings-page__missing">
          <a
            v-for="item in progress.missing"
            :key="`${item.groupKey}-${item.label}`"
            class="settings-page__jump"
            href="#"
            data-jump-group
            @click.prevent="jump(item.groupKey)"
          >{{ item.label }}</a>
        </p>
      </div>

      <a-spin :spinning="loading">
        <div class="settings-page__body">
          <div class="settings-page__main">
            <a-card
              v-for="group in mainGroups"
              :id="settingsAnchorId(group.key)"
              :key="group.key"
              :bordered="false"
              class="settings-page__card"
            >
              <template #title>
                <span class="settings-page__card-title">{{ group.label }}</span>
                <span v-if="group.note" class="settings-page__card-note">{{ group.note }}</span>
              </template>
              <slot :name="group.key" />
            </a-card>
          </div>
          <div v-if="twoColumn" class="settings-page__side">
            <a-card
              v-for="group in sideGroups"
              :id="settingsAnchorId(group.key)"
              :key="group.key"
              :bordered="false"
              class="settings-page__card"
            >
              <template #title>
                <span class="settings-page__card-title">{{ group.label }}</span>
                <span v-if="group.note" class="settings-page__card-note">{{ group.note }}</span>
              </template>
              <slot :name="group.key" />
            </a-card>
          </div>
        </div>
      </a-spin>
    </template>
  </div>
</template>

<style scoped lang="less">
.settings-page {
  /* 限宽：单栏 1000px、两栏 1240px（16:8 分下去是 827 / 413）。
     原来这一组不限宽，超宽屏上一行输入框拉到 1900px，label 和格子隔半屏。 */
  width: 100%;
  max-width: 1000px;

  &--two {
    max-width: 1240px;
  }

  &__notice {
    margin-bottom: var(--admin-space-2);
  }

  &__state {
    background: var(--admin-fill-hover);
    border-radius: var(--admin-radius-card);
  }

  &__bar {
    margin-bottom: var(--admin-space-2);
  }

  &__anchors {
    display: flex;
    flex-wrap: wrap;
    gap: var(--admin-space-1) var(--admin-space-2);
  }

  &__anchor {
    font-size: 13px;
    color: var(--admin-primary);
  }

  &__anchor-count {
    margin-left: 4px;
    color: var(--admin-text-secondary);
    font-variant-numeric: var(--admin-font-nums);
  }

  &__progress {
    margin: var(--admin-space-1) 0 0;
    font-size: 13px;
    color: var(--admin-text-secondary);
  }

  &__progress-num {
    /* 读数是数字，要能上下对齐；这一族数字原来各抄各的字号，同一屏两种「小灰字」 */
    font-variant-numeric: var(--admin-font-nums);
    color: var(--admin-text-primary);
  }

  &__required {
    margin-left: var(--admin-space-2);
    color: var(--admin-danger-text);
  }

  &__missing {
    margin: var(--admin-space-1) 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--admin-space-1) var(--admin-space-2);
    font-size: 13px;
  }

  &__jump {
    color: var(--admin-primary);
  }

  &__body {
    display: flex;
    align-items: flex-start;
    gap: var(--admin-space-3);
  }

  &__main {
    flex: 1 1 0;
    min-width: 0;
  }

  &__side {
    flex: 0 0 320px;
    min-width: 0;
  }

  &__card {
    margin-bottom: var(--admin-space-2);
    border-radius: var(--admin-radius-card);
    /* 浏览器实测这一组卡「圆角 8px、边框宽度 0」；圆角走令牌，边框仍不给——
       无边框 + 圆角 + 白底就是这一组卡片的样子，加边框等于把 12 页一起改样式。 */
    scroll-margin-top: var(--admin-space-4);
  }

  &__card-note {
    margin-left: var(--admin-space-1);
    font-size: 13px;
    font-weight: 400;
    color: var(--admin-text-secondary);
  }

  /* antd 的卡标题默认 nowrap + 截断。站点设置那一屏的卡名是后端回的站点名，
     后面还跟着状态那一格（375 视口实测整条被顶到 388px，状态那三个字压根读不到），
     这里让标题允许折行：名字长就换行，状态那一句不许被裁掉。 */
  :deep(.ant-card-head-title) {
    white-space: normal;
    word-break: break-word;
  }
}

/* 窄屏折一栏：右列那三张卡回到主列后面，不再压扁（原来写死 :span="8"）。
   align-items 必须一起改回 stretch：`.settings-page__body` 是 flex，
   行方向时 align-items:flex-start 只管交叉轴高度，折成列方向后同一句管的是宽度——
   浏览器实测 375 视口下主列被撑成 306 / 386px（按内容收缩），页面横向溢出。 */
@media (max-width: 991px) {
  .settings-page__body {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-page__main {
    width: 100%;
    min-width: 0;
  }

  .settings-page__side {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
  }
}
</style>
