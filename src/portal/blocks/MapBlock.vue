<template>
  <section v-if="entries.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-map">
        <!-- 门户是免鉴权公开页：这里不引任何第三方地图 SDK、不写 key、不发地图网络请求。
             左栏摆的是租户自己的门店/公司照片，没传照片就落一张随组件打包的装饰图；
             真正的「看地图」交给点出去的那条外链（uri.amap.com 是公开 https 端点，外链规则由 linkPolicy 把关）。 -->
        <img class="pb-map__visual" :src="visualSrc" :alt="visualAlt" loading="lazy" />
        <ul class="pb-map__list">
          <li v-for="(entry, index) in entries" :key="index" class="pb-map__item">
            <p v-if="entry.companyAddress" class="pb-map__kind">公司上门地址</p>
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
import mapFallbackImage from '@/portal/assets/map-fallback.jpg'
import type { BlockContext, Item } from './types'
import { field, flag, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 门店区块（数据源 stores：{name,address,latitude,longitude,phone,coverImage,companyAddress}）。
 *
 * 左栏是照片不是地图：租户传了门店照片就放照片，没传就落随组件打包的装饰图（2026-11-05 拍板，
 * 假地图示意块看着像出了问题，撤掉）。经纬度只是「能不能落点」的判据，不是显示内容：
 * 缺经纬度的门店照样把地址与电话摆出来，此时跳转退化成按地址搜索；名称、地址、电话全空的条目丢掉。
 * 电话是纯文本而不是 tel: 链接——linkPolicy 只放行 http(s)，在这里自造协议等于绕过统一出口。
 *
 * companyAddress 为真的那一条不是门店，是 store 表一行都没有时退回的公司地址（拍板 2026-09-27，
 * 判据在 PortalAggregationService.stores），条目上会写「公司上门地址」而不是门店。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    name: field(item, 'name'),
    address: field(item, 'address'),
    phone: field(item, 'phone'),
    coverImage: field(item, 'coverImage'),
    companyAddress: flag(item, 'companyAddress'),
    mapUrl: mapUrlOf(item)
  }))
  .filter(entry => entry.name || entry.address || entry.phone))

const visualSrc = computed(() => entries.value.find(entry => entry.coverImage)?.coverImage || mapFallbackImage)

const visualAlt = computed(() => {
  const entry = entries.value.find(item => item.coverImage)
  return entry ? `${entry.name || entry.address} 照片` : ''
})

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

  &__visual {
    display: block;
    width: 100%;
    min-height: 260px;
    object-fit: cover;
    border-radius: 12px;
    background: color-mix(in srgb, var(--portal-color-primary) 5%, var(--portal-color-bg));
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

  &__kind {
    margin: 0 0 6px;
    font-size: calc(12px * var(--portal-font-scale));
    letter-spacing: .04em;
    color: var(--portal-color-muted);
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

  .pb-map__visual {
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
