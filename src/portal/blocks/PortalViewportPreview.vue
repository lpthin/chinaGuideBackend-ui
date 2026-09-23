<template>
  <div class="pbv">
    <div v-if="device !== null" class="pbv__toolbar">
      <a-button-group size="small">
        <a-button
          v-for="item in DEVICES"
          :key="item.value"
          :type="device === item.value ? 'primary' : 'default'"
          @click="emit('update:device', item.value)"
        >{{ item.label }}</a-button>
      </a-button-group>
      <span class="pbv__hint">断点按框宽（{{ frameWidth }}）生效，不是按浏览器窗口</span>
    </div>

    <div class="pbv__scroll" :class="device && device !== 'desktop' ? `pbv__scroll--${device}` : null">
      <div class="pbv__frame" :style="frameStyle">
        <!-- 区块序列里没有任何可渲染组件：通常是页面引用了已下线区块，留一句线索而不是白屏 -->
        <p v-if="!renderedBlocks.length" class="pbv__empty">该页面暂无可显示的内容</p>
        <template v-for="(block, index) in renderedBlocks" :key="block.instanceId + block.blockKey">
          <!-- 圈选壳只在批注模式下存在，访客正常浏览的 DOM 与不用本组件时一致 -->
          <div
            v-if="review"
            class="portal-review-target"
            :class="{ 'portal-review-target--picked': selection?.instanceId === block.instanceId }"
            :data-review-instance-id="block.instanceId"
            :data-review-block-key="block.blockKey"
            :data-review-path="pagePath || ''"
            :data-review-index="index + 1"
          >
            <component :is="rendererFor(block)" :block-props="block.props ?? {}" :shell="shell" />
          </div>
          <component
            v-else
            :is="rendererFor(block)"
            :block-props="block.props ?? {}"
            :shell="shell"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PortalSiteShell, RenderedBlock } from '../api/portalPublic'
import { resolveRenderer } from '../blocks/registry'
import { themeVars } from '../blocks/portalTheme'
import { useReviewMode } from '../useReviewMode'

/**
 * 门户区块的共用渲染框：访客页、搭建器预览、AI 草稿的改前/改后比对都渲染在它上面，
 * 「搭建器里看到的」和「客户在预览链接里看到的」才有可能是同一个东西——分成两套迟早一套先过期。
 *
 * 断点为什么用容器查询而不是 @media：手机框只有 375px 宽，而 @media 看的是浏览器窗口，
 * 在 1600px 的后台窗口里渲 375px 框仍会出桌面布局，那种「手机预览」是假的。
 * 所以 .pbv__frame 声明为 portal-viewport 容器，区块里的断点一律按框宽生效；
 * device=null（访客正常浏览）时框宽就是内容宽，容器查询与原来的窗口断点等价。
 */
const props = withDefaults(defineProps<{
  blocks: RenderedBlock[] | null
  device?: 'desktop' | 'tablet' | 'mobile' | null
  theme?: Record<string, string | number> | null
  shell?: PortalSiteShell | null
  /** 只有预览链接那条路为真：给区块套上可圈选的壳 */
  review?: boolean
  pagePath?: string | null
}>(), {
  device: null,
  theme: null,
  shell: null,
  review: false,
  pagePath: null
})

const emit = defineEmits<{ (e: 'update:device', value: 'desktop' | 'tablet' | 'mobile'): void }>()

/** 定宽值与访客侧真实断点无关，只是取景框宽度；desktop 用自适应，不设假宽度 */
const DEVICES: Array<{ value: 'desktop' | 'tablet' | 'mobile'; label: string; width: number | null }> = [
  { value: 'desktop', label: '桌面', width: null },
  { value: 'tablet', label: '平板 768', width: 768 },
  { value: 'mobile', label: '手机 375', width: 375 }
]

const { selection } = useReviewMode()

const renderedBlocks = computed(() => (props.blocks ?? []).filter(block => resolveRenderer(block.rendererKey)))

function rendererFor(block: RenderedBlock) {
  return resolveRenderer(block.rendererKey)
}

const frameWidth = computed(() => {
  const matched = DEVICES.find(item => item.value === props.device)
  return matched?.width ? `${matched.width}px` : '自适应宽度'
})

const frameStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = { ...themeVars(props.theme) }
  const matched = DEVICES.find(item => item.value === props.device)
  if (matched?.width) {
    style.width = `${matched.width}px`
  }
  return style
})
</script>

<style scoped lang="less">
.pbv {
  &__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 0 12px;
  }

  &__hint {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__scroll {
    display: flex;
    justify-content: center;
  }

  // 只有切到平板/手机档位才套后台取景框的灰底与圆角：
  // 访客正常浏览（device=null）时必须一点装饰都不加，否则门户页面会多出后台才该有的边框和留白。
  &__scroll--tablet,
  &__scroll--mobile {
    padding: 16px;
    background: #f5f5f5;
    max-height: 70vh;
    overflow: auto;
  }

  &__frame {
    width: 100%;
    min-height: 400px;
    background: var(--portal-color-bg, #fff);
    color: var(--portal-color-text, inherit);
    // 容器声明：区块内部所有 @container portal-viewport 断点以此为基准
    container-type: inline-size;
    container-name: portal-viewport;
  }

  &__scroll--tablet &__frame,
  &__scroll--mobile &__frame {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  &__empty {
    padding: 80px 24px;
    text-align: center;
    color: var(--portal-color-muted, rgba(0, 0, 0, 0.45));
  }
}

.portal-review-target {
  outline: 1px dashed rgba(22, 119, 255, 0.35);
  outline-offset: -1px;

  &:hover {
    outline-color: #1677ff;
    cursor: crosshair;
  }

  &--picked {
    outline: 2px solid #1677ff;
  }
}
</style>
