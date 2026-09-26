<template>
  <section v-if="entries.length" class="pb-section pb-section--tight">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-grid" :class="gridClass">
        <figure v-for="(entry, index) in entries" :key="index" class="pb-card pb-testimonial">
          <blockquote v-if="entry.quote" class="pb-testimonial__quote">{{ entry.quote }}</blockquote>
          <figcaption v-if="entry.avatar || entry.name || entry.role" class="pb-testimonial__who">
            <img v-if="entry.avatar" :src="entry.avatar" :alt="entry.name" class="pb-testimonial__avatar" />
            <span v-if="entry.name" class="pb-testimonial__name">{{ entry.name }}</span>
            <span v-if="entry.role" class="pb-testimonial__role">{{ entry.role }}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { columnsClassOf, field, list, text } from './types'

/**
 * 客户评价卡（数据源 testimonials，kind=testimonial）。
 *
 * 一条评价引用、姓名、身份全都没填就整条丢掉——卡片是访客读「真人怎么说」的地方，
 * 留一张空气泡比少一张卡伤害大得多（同 StatsBandBlock 那条「绝不用硬编码凑数」的纪律）。
 * limit 是白名单里的 1..24 整数槽：后端只把聚合原样送过来，条数截断由渲染器执行。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const gridClass = computed(() => columnsClassOf(props.blockProps))

const entries = computed(() => {
  const mapped = list(props.blockProps, 'items')
    .map(item => ({
      quote: field(item, 'quote'),
      name: field(item, 'name'),
      role: field(item, 'role'),
      avatar: field(item, 'avatar')
    }))
    .filter(entry => entry.quote || entry.name || entry.role)
  const raw = props.blockProps?.limit
  const limit = typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : 0
  return limit ? mapped.slice(0, limit) : mapped
})
</script>

<style scoped lang="less">
.pb-testimonial {
  display: flex;
  flex-direction: column;
  gap: calc(14px * var(--portal-spacing-scale));
  margin: 0;

  &__quote {
    margin: 0;
    font-size: calc(15px * var(--portal-font-scale));
    line-height: 1.8;
    color: var(--portal-color-text);
  }

  &__who {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
  }

  &__name {
    font-size: calc(14px * var(--portal-font-scale));
    font-weight: 600;
    color: var(--portal-color-text);
  }

  &__role {
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }
}

@container portal-viewport (max-width: 640px) {
  .pb-testimonial__quote {
    font-size: calc(14px * var(--portal-font-scale));
  }
}
</style>
