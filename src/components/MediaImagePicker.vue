<script setup lang="ts">
import { computed, ref } from 'vue'
import MediaImageLibraryModal from './MediaImageLibraryModal.vue'

/**
 * 图片字段的统一入口：手填地址仍然可以（外链与刚上传还没入库的图要用），
 * 但多给两条真路——从媒体库挑一张，或在挑图弹窗里就地上传。
 *
 * <p>为什么必须有「挑」这条路：区块/Banner/案例封面的图槽此前只有一个 URL 输入框，
 * 运营要么手抄地址（抄错就是一张碎图），要么先跑去别的页面上传再回来粘。</p>
 */
const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  /** 不传则按当前登录态推断（超管取右上角选定的客户，租户取自己） */
  tenantId?: number | null
  size?: 'small' | 'middle'
}>(), {
  modelValue: '',
  placeholder: '图片地址，可从媒体库挑或就地上传',
  tenantId: null,
  size: 'middle'
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const visible = ref(false)
const preview = computed(() => (props.modelValue || '').trim())

function write(url: string) {
  emit('update:modelValue', url)
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="media-field">
    <a-input :value="modelValue" :size="size" :placeholder="placeholder" @update:value="write($event)">
      <template #addonAfter>
        <a-button type="link" size="small" @click="visible = true">从媒体库选</a-button>
      </template>
    </a-input>
    <div v-if="preview" class="media-field__preview">
      <img :src="preview" alt="" @error="(event:any) => (event.target.style.opacity = 0.25)">
      <div class="media-field__preview-meta">
        <span class="media-field__url">{{ preview }}</span>
        <a-button type="link" size="small" @click="clear">清空</a-button>
      </div>
    </div>
    <p v-else class="media-field__empty">还没配图：没图的图位在访客那里就是一块空白。</p>

    <!-- v-if：不打开就不挂载——挑图弹窗一挂载就会去列媒体库 -->
    <MediaImageLibraryModal
      v-if="visible"
      v-model:open="visible"
      :tenant-id="tenantId"
      @pick="write"
    />
  </div>
</template>

<style scoped>
.media-field__preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.media-field__preview img {
  width: 96px;
  height: 54px;
  object-fit: cover;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: 4px;
  background: #fafafa;
}
.media-field__preview-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.media-field__url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.media-field__empty {
  margin: 6px 0 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
