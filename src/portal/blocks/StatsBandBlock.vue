<template>
  <section v-if="entries.length" ref="rootEl" class="pb-stats">
    <div class="pb-container">
      <h2 v-if="heading" class="pb-section-title pb-stats__heading">{{ heading }}</h2>
      <div class="pb-stats__row">
        <div v-for="(entry, index) in entries" :key="index" class="pb-stats__item">
          <strong class="pb-stats__value">{{ displays[index] }}</strong>
          <span v-if="entry.label" class="pb-stats__label">{{ entry.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'

/**
 * 数字条：数字进视口才滚动（count-up），需求单点名要的动效。
 *
 * 三条硬规矩，都在这个组件里落地：
 * 1. 数字为 0 或没填 ⇒ 不摆这个数字。绝不拿 0 凑一排，也绝不硬编码「10+ 年经验」——
 *    那正是本次要消灭的假数据形态；整排都被筛空时 v-if 让整块不渲染。
 * 2. reduced-motion 下直接显示终值、不滚动，而且连观察器都不建：没有东西可滚时
 *    挂 observer 是白给的生命周期负担。
 * 3. 卸载必须 disconnect——画廊里切页会反复挂载，漏一次就是观察器列表越积越长。
 *
 * 环境里没有 IntersectionObserver（老浏览器 / SSR）时直接显示终值：
 * 数字条宁可不动，也不能因为动效实现缺失就把真数字吞掉。
 */
const props = defineProps<BlockContext>()

const heading = computed(() => text(props.blockProps, 'heading'))

interface StatEntry {
  /** 数值型条目的滚动目标；null = 纯文字条目，直接原样显示 */
  value: number | null
  prefix: string
  suffix: string
  decimals: number
  label: string
}

/**
 * 值里可能夹着单位（「3.2亿」「24小时」），按 [前缀][数字][后缀] 拆三段；
 * 拆不出数字的（走 title/name 兜底的那批）当纯文字。
 */
function parseEntry(raw: string): StatEntry | null {
  const matched = /^(\D*)(\d+(?:\.\d+)?)(\D*)$/.exec(raw)
  if (!matched) {
    return { value: null, prefix: '', suffix: raw, decimals: 0, label: '' }
  }
  const value = Number(matched[2])
  // 0 就是「没有这个数字」：后端没填、运营填了个 0，界面都该当空处理
  if (value === 0) {
    return null
  }
  const decimals = (matched[2].split('.')[1] || '').length
  return { value, prefix: matched[1], suffix: matched[3], decimals, label: '' }
}

const entries = computed<StatEntry[]>(() => list(props.blockProps, 'items')
  .map(item => {
    const raw = field(item, 'value', 'number', 'count', 'title', 'name')
    if (!raw) {
      return null
    }
    const entry = parseEntry(raw)
    if (!entry) {
      return null
    }
    entry.label = field(item, 'label', 'summary', 'description')
    return entry
  })
  .filter((entry): entry is StatEntry => entry !== null))

/** 当前显示文本：未进视口前是空串，滚动中是中间值，落定后是终值 */
const displays = ref<string[]>([])

const rootEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let timer: ReturnType<typeof setInterval> | null = null

const ROLL_DURATION = 900
const ROLL_STEP = 30

function finalText(entry: StatEntry): string {
  return entry.prefix + String(entry.value ?? entry.suffix) + entry.suffix
}

function textFor(entry: StatEntry, progress: number): string {
  if (entry.value === null || progress >= 1) {
    return finalText(entry)
  }
  const current = (entry.value * progress).toFixed(entry.decimals)
  return entry.prefix + current + entry.suffix
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function startRolling() {
  if (timer !== null) {
    return
  }
  const startedAt = Date.now()
  timer = setInterval(() => {
    const progress = Math.min((Date.now() - startedAt) / ROLL_DURATION, 1)
    displays.value = entries.value.map(entry => textFor(entry, progress))
    if (progress >= 1 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }, ROLL_STEP)
}

onMounted(() => {
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    displays.value = entries.value.map(entry => finalText(entry))
    return
  }
  displays.value = entries.value.map(() => '')
  observer = new IntersectionObserver(records => {
    if (records.some(record => record.isIntersecting)) {
      // 只滚一次：滚完就断开，回访视口不该再摇一次数字
      observer?.disconnect()
      observer = null
      startRolling()
    }
  }, { threshold: 0.35 })
  if (rootEl.value) {
    observer.observe(rootEl.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped lang="less">
.pb-stats {
  padding: calc(64px * var(--portal-spacing-scale)) 0;
  background: color-mix(in srgb, var(--portal-color-primary) 8%, var(--portal-color-bg));

  &__heading {
    text-align: center;
    margin-bottom: 28px;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: calc(32px * var(--portal-spacing-scale));
    justify-content: center;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 140px;
    text-align: center;
  }

  &__value {
    font-size: calc(34px * var(--portal-font-scale));
    font-weight: 700;
    color: var(--portal-color-primary);

    /* 滚动中数字位数在变，等宽数字位防止整行左右抽动 */
    font-variant-numeric: tabular-nums;
  }

  &__label {
    font-size: calc(14px * var(--portal-font-scale));
    color: var(--portal-color-muted);
  }
}
</style>
