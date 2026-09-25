<template>
  <div class="block-showcase">
    <a-alert type="info" show-icon class="block-showcase__notice">
      <template #message>
        这里是平台侧的区块画廊：每一格用的都是<strong>访客端同一套渲染器</strong>，
        演示内容是按区块自己的 props 结构（dataSchema）推出来的，不落库、也不动任何站点。
        清单与显示名全部来自服务端元数据，新增区块时这一页会自动多出一格。
      </template>
    </a-alert>

    <a-alert v-if="loadError" type="error" show-icon class="block-showcase__notice" :message="loadError">
      <template #description>
        区块元数据读不出来时这一页什么都渲不了（画廊的清单只有一个来源）。
        {{ loadError.includes('权限') ? '这一页属于建设域，账号没有 portal:build:manage 就是取不到元数据。' : '稍后可以点旁边的刷新再试。' }}
      </template>
    </a-alert>

    <a-form layout="inline" class="block-showcase__toolbar">
      <a-form-item label="关键字">
        <a-input v-model:value="keyword" allow-clear placeholder="按显示名、区块 key 或分类过滤" style="width: 240px" />
      </a-form-item>
      <a-form-item label="取景宽度">
        <a-select v-model:value="frameWidth" style="width: 160px" :options="FRAME_OPTIONS" />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="load">刷新</a-button>
          <a-button @click="showProps = !showProps">{{ showProps ? '收起演示数据' : '看演示数据' }}</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !loadError && blocks.length === 0"
               description="服务端没有返回任何区块元数据：区块白名单只在后端一处，这里不做兜底清单">
        <template #image><span /></template>
      </a-empty>
      <a-empty v-else-if="!loading && !loadError && visibleBlocks.length === 0"
               description="没有区块匹配这个关键字：清单只有一个来源，所以这里也只能少显示、不能多显示">
        <template #image><span /></template>
      </a-empty>

      <div class="block-showcase__grid">
        <a-card v-for="(item, index) in visibleBlocks" :key="item.meta.blockKey" size="small"
                class="block-showcase__card">
          <template #title>
            <a-space size="6" wrap>
              <span class="block-showcase__name">{{ item.meta.name }}</span>
              <a-tag>{{ item.meta.blockKey }}</a-tag>
              <a-tag v-if="item.meta.category" color="blue">{{ item.meta.category }}</a-tag>
              <a-tag v-if="item.meta.maxInstances" color="default">单页最多 {{ item.meta.maxInstances }} 个</a-tag>
            </a-space>
          </template>
          <template #extra>
            <span class="block-showcase__muted">#{{ index + 1 }}</span>
          </template>

          <a-alert
            v-if="!item.renderable"
            type="warning"
            show-icon
            :message="`渲染器「${item.meta.rendererKey}」没在前端登记，这一格只能看到名字与字段结构`"
            description="访客端遇到同样的区块也会整块不渲染：这是发版要补组件的信号，不是画廊的问题。"
          />
          <div v-else class="block-showcase__frame" :style="frameStyle">
            <PortalViewportPreview :blocks="[item.block]" :theme="null" :shell="shell" />
          </div>

          <pre v-if="showProps" class="block-showcase__props">{{ item.propsText }}</pre>
        </a-card>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { portalPagesApi, type PortalBlockMeta } from '../../api/portalPages'
import { demoPropsFor, demoShell } from '../../portal/blocks/blockDemo'
import { resolveRenderer } from '../../portal/blocks/registry'
import type { RenderedBlock } from '../../portal/api/portalPublic'
import PortalViewportPreview from '../../portal/blocks/PortalViewportPreview.vue'

/**
 * 区块画廊（Spec §7.2 演示形态第一层，Q2）。
 *
 * 三条纪律：
 * 1. 清单、显示名、分类、上限全部来自 `GET /api/portal/blocks`，这一页没有任何一份区块常量；
 * 2. 演示 props 由每个区块的 dataSchema 推导（见 blockDemo.ts），不是一张 blockKey → props 的对照表；
 * 3. 渲染走 `PortalViewportPreview` + 注册表里的真组件，和访客端、搭建器预览同一条路，
 *    所以「画廊里的样子」不会和「客户站点上的样子」长成两套。
 */

interface ShowcaseItem {
  meta: PortalBlockMeta
  block: RenderedBlock
  renderable: boolean
  propsText: string
}

/** 取景宽度只是框宽：区块内部断点走容器查询，改框宽就会真的换布局（见 PortalViewportPreview 的说明） */
const FRAME_OPTIONS = [
  { value: null, label: '自适应宽度' },
  { value: 768, label: '平板 768' },
  { value: 375, label: '手机 375' }
]

const metas = ref<PortalBlockMeta[]>([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const frameWidth = ref<number | null>(null)
const showProps = ref(false)
const shell = demoShell()

const blocks = computed<ShowcaseItem[]>(() => metas.value.map((meta, index) => {
  const props = demoPropsFor(meta, index)
  const block: RenderedBlock = {
    instanceId: `demo-${index}`,
    blockKey: meta.blockKey,
    rendererKey: meta.rendererKey,
    props
  }
  return {
    meta,
    block,
    renderable: !!resolveRenderer(meta.rendererKey),
    propsText: JSON.stringify(props, null, 2)
  }
}))

const visibleBlocks = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  if (!needle) {
    return blocks.value
  }
  return blocks.value.filter(item => [item.meta.name, item.meta.blockKey, item.meta.category]
    .some(field => String(field || '').toLowerCase().includes(needle)))
})

const frameStyle = computed<Record<string, string>>(() =>
  (frameWidth.value ? { width: `${frameWidth.value}px` } : {} as Record<string, string>))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    metas.value = (await portalPagesApi.blocks()) || []
  } catch (error: any) {
    loadError.value = error?.message || '区块元数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="less">
// 区块组件的样式跟着访客端那份走（与 PortalDynamicPage 同一对文件）：不重新设计一套画廊专属外观，
// 否则「画廊里好看」和「客户站点上好看」迟早变成两件事。
@import '../../styles/portal-tokens.less';
@import '../../portal/blocks/portal-blocks.less';
</style>

<style scoped lang="less">
.block-showcase {
  padding: 16px;

  &__notice {
    margin-bottom: 12px;
  }

  &__toolbar {
    margin-bottom: 12px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
    gap: 16px;
  }

  &__card {
    align-self: start;
  }

  &__name {
    font-weight: 600;
  }

  &__frame {
    max-height: 420px;
    overflow: auto;
    background: #fafafa;
    padding: 8px;
    border-radius: 8px;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__props {
    margin: 12px 0 0;
    max-height: 200px;
    overflow: auto;
    background: #fafafa;
    padding: 8px;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
