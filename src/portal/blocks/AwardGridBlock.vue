<template>
  <section v-if="entries.length" class="pb-section pb-section--tight">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-grid" :class="gridClass">
        <PortalBlockLink v-for="(entry, index) in entries" :key="index" :url="entry.url" class="pb-card pb-award">
          <!-- 证书图走 image 槽取到的地址；缺图就一行都不留，不给访客摆灰块 -->
          <img v-if="entry.image" :src="entry.image" :alt="entry.name" class="pb-award__image" />
          <h3 v-if="entry.name" class="pb-card-title pb-award__name">{{ entry.name }}</h3>
          <p v-if="entry.issuer" class="pb-award__issuer">{{ entry.issuer }}</p>
          <p v-if="entry.description" class="pb-card-text pb-award__text">{{ entry.description }}</p>
        </PortalBlockLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { columnsClassOf, field, image, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 资质荣誉墙（数据源 awards，kind=award：title→名称、subtitle→颁发方、body→说明、media_id→证书图）。
 *
 * 名称与证书图都没有的条目丢掉——一张既没名字也没图的格子只会让人怀疑墙是空的；
 * url 有值时整卡走 PortalBlockLink（外链规则由 linkPolicy 统一把关，这里不自造 a 标签）。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const gridClass = computed(() => columnsClassOf(props.blockProps))

const entries = computed(() => list(props.blockProps, 'items')
  .map(item => ({
    name: field(item, 'name'),
    issuer: field(item, 'issuer'),
    description: field(item, 'description'),
    image: image(item, 'image'),
    url: field(item, 'url')
  }))
  .filter(entry => entry.name || entry.image))
</script>

<style scoped lang="less">
.pb-award {
  display: flex;
  flex-direction: column;
  gap: calc(10px * var(--portal-spacing-scale));

  &__image {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 8px;
  }

  &__name {
    margin: 0;
  }

  &__issuer {
    margin: 0;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-primary);
  }

  &__text {
    margin: 0;
  }
}
</style>
