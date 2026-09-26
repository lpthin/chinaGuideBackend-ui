<template>
  <section v-if="entries.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-map">
        <!-- 静态示意块：门户是免鉴权公开页，这里不引任何第三方地图 SDK、不写 key、不发网络请求。
             真正的「看地图」交给点出去的那条外链（uri.amap.com 是公开 https 端点，外链规则由 linkPolicy 把关）。 -->
        <div class="pb-map__canvas" aria-hidden="true">
          <svg class="pb-map__pin" viewBox="0 0 24 24" width="34" height="34" focusable="false">
            <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 9.5A2.5 2.5 0 1 0 12 6.5a2.5 2.5 0 0 0 0 5z" fill="currentColor" />
          </svg>
          <span class="pb-map__canvas-note">门店位置示意</span>
        </div>
        <ul class="pb-map__list">
          <li v-for="(entry, index) in entries" :key="index" class="pb-map__item">
            <h3 v-if="entry.name" class="pb-map__name">{{ entry.name }}</h3>
            <p v-if="entry.address" class="pb-map__address">{{ entry.address }}</p>
            <p v-if="entry.phone" class="pb-map__phone">{{ entry.phone }}</p>
            <PortalBlockLink v-if="entry.mapUrl" :url="entry.mapUrl" class="pb-map__link">在地图中查看</PortalBlockLink>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext, Item } from './types'
import { field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 门店区块（数据源 stores：{name,address,latitude,longitude,phone}）。
 *
 * 经纬度只是「能不能落点」的判据，不是显示内容：缺经纬度的门店照样把地址与电话摆出来，
 * 此时跳转退化成按地址搜索；名称、地址、电话全空的条目丢掉，不留空条目。
 * 电话是纯文本而不是 tel: 链接——linkPolicy 只放行 http(s)，在这里自造协议等于绕过统一出口。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    name: field(item, 'name'),
    address: field(item, 'address'),
    phone: field(item, 'phone'),
    mapUrl: mapUrlOf(item)
  }))
  .filter(entry => entry.name || entry.address || entry.phone))

/** 数值口径照后端 DTO（Double），但演示/人工录入可能给字符串，两头都认、认不出的当「没有坐标」 */
function coordOf(item: Item, key: 'latitude' | 'longitude'): number | null {
  const raw = item[key]
  const value = typeof raw === 'number' ? raw
    : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(value)) return null
  const bound = key === 'latitude' ? 90 : 180
  return Math.abs(value) <= bound ? value : null
}

function mapUrlOf(item: Item): string {
  const name = field(item, 'name')
  const address = field(item, 'address')
  const latitude = coordOf(item, 'latitude')
  const longitude = coordOf(item, 'longitude')
  if (latitude !== null && longitude !== null) {
    const label = encodeURIComponent(name || address)
    return `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${label}`
  }
  if (address) {
    return `https://uri.amap.com/search?keyword=${encodeURIComponent(address)}`
  }
  return ''
}
</script>

<style scoped lang="less">
.pb-map {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: calc(28px * var(--portal-spacing-scale));
  align-items: start;

  &__canvas {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 260px;
    border-radius: 12px;
    border: 1px dashed var(--portal-color-border);
    background: color-mix(in srgb, var(--portal-color-primary) 5%, var(--portal-color-bg));
    color: var(--portal-color-primary);
  }

  &__canvas-note {
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: calc(18px * var(--portal-spacing-scale));
  }

  &__item {
    padding-bottom: calc(18px * var(--portal-spacing-scale));
    border-bottom: 1px solid var(--portal-color-border);

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  &__name {
    margin: 0;
    font-size: calc(16px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }

  &__address,
  &__phone {
    margin: 6px 0 0;
    font-size: calc(14px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }

  &__link {
    display: inline-block;
    margin-top: 8px;
    font-size: calc(14px * var(--portal-font-scale));
    color: var(--portal-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

@container portal-viewport (max-width: 1024px) {
  .pb-map {
    gap: calc(20px * var(--portal-spacing-scale));
  }

  .pb-map__canvas {
    min-height: 200px;
  }
}

@container portal-viewport (max-width: 640px) {
  // 375 宽放不下左右两栏：示意块收到列表上方，条目改单列流式，杜绝横向滚动
  .pb-map {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
