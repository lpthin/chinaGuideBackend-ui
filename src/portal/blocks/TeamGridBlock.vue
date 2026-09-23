<template>
  <section v-if="items.length" class="pb-section">
    <div class="pb-container">
      <div v-if="heading" class="pb-section-header">
        <h2 class="pb-section-title">{{ heading }}</h2>
      </div>
      <div class="pb-grid pb-grid--3">
        <div v-for="(item, index) in items" :key="index" class="pb-card pb-team">
          <img v-if="field(item, 'avatar')" :src="field(item, 'avatar')" :alt="field(item, 'name')" class="pb-team__avatar" />
          <h3 class="pb-card-title">{{ field(item, 'name') }}</h3>
          <p v-if="field(item, 'position')" class="pb-team__position">{{ field(item, 'position') }}</p>
          <p v-if="field(item, 'bio')" class="pb-card-text">{{ field(item, 'bio') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'

/** 团队网格：数据源 teamMembers，一个成员都没有就整块消失，不放占位头像 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))
const items = computed(() => list(props.blockProps, 'items'))
</script>

<style scoped lang="less">
.pb-team {
  text-align: center;

  &__avatar {
    width: 88px;
    height: 88px;
    margin: 0 auto 14px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  &__position {
    margin: -4px 0 10px;
    font-size: calc(13px * var(--portal-font-scale));
    color: var(--portal-color-primary);
  }
}
</style>
