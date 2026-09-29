<script setup lang="ts">
/**
 * 品牌档案的新建/编辑表单（档案页与向导第 ① 步共用这份字段）。
 * form 是父组件持有的 reactive 对象：这里只绑字段、只发「保存/取消」，不在两处各存一份草稿。
 */
import DictTag from '../../components/DictTag.vue'
import type { GeoBrandProfileForm } from '../../api/geoBrand'
import { BRAND_WORDS_GUIDE } from './geoBrandWizard'

defineProps<{
  /** 父组件的 reactive 对象；字段就地双向绑定（同一份草稿只存在一处） */
  form: GeoBrandProfileForm
  siteOptions?: Array<{ value: number; label: string }>
  saving?: boolean
}>()

const emit = defineEmits<{ (e: 'save'): void; (e: 'cancel'): void }>()
</script>

<template>
  <div class="geobrand-profile-form">
    <div class="geobrand-profile-form__row">
      <span class="geobrand-profile-form__label">站点</span>
      <a-select
        v-model:value="form.siteId"
        :options="siteOptions || []"
        placeholder="选择站点"
        style="min-width: 240px"
      />
    </div>
    <div class="geobrand-profile-form__row">
      <span class="geobrand-profile-form__label">品牌名 *</span>
      <a-input v-model:value="form.brandName" placeholder="品牌名" style="width: 240px" />
    </div>
    <div class="geobrand-profile-form__row geobrand-profile-form__row--top">
      <span class="geobrand-profile-form__label">品牌词</span>
      <div class="geobrand-profile-form__words">
        <a-select
          v-model:value="form.brandWords"
          mode="tags"
          placeholder="回车或逗号分隔，只放品牌自己的叫法"
          style="width: 100%"
        />
        <div class="geobrand-profile-form__guide">
          <p v-for="line in BRAND_WORDS_GUIDE" :key="line" class="geobrand-profile-form__guide-line">{{ line }}</p>
        </div>
        <div v-if="form.brandWords.length" class="geobrand-profile-form__tags">
          <DictTag v-for="word in form.brandWords" :key="word" kind="brand" :value="word" />
        </div>
      </div>
    </div>
    <div class="geobrand-profile-form__row geobrand-profile-form__row--top">
      <span class="geobrand-profile-form__label">官网地址</span>
      <div class="geobrand-profile-form__urls">
        <div v-for="(url, index) in form.officialUrls" :key="index" class="geobrand-profile-form__url-row">
          <a-input v-model:value="form.officialUrls[index]" placeholder="https://…" />
          <a-button size="small" @click="form.officialUrls.splice(index, 1)">删除</a-button>
        </div>
        <a-button size="small" @click="form.officialUrls.push('')">添加一个官网地址</a-button>
      </div>
    </div>
    <div class="geobrand-profile-form__row geobrand-profile-form__row--top">
      <span class="geobrand-profile-form__label">品牌介绍</span>
      <a-textarea v-model:value="form.brandIntro" :rows="3" placeholder="一两句就够：AI 引用你时最该带上的身份" />
    </div>
    <div class="geobrand-profile-form__actions">
      <a-button type="primary" :loading="saving" @click="emit('save')">保存</a-button>
      <a-button @click="emit('cancel')">取消</a-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.geobrand-profile-form {
  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__row--top {
    align-items: flex-start;
  }

  &__label {
    width: 88px;
    flex-shrink: 0;
    color: #595959;
    font-size: 13px;
  }

  &__words,
  &__urls {
    flex: 1;
  }

  &__guide {
    margin-top: 8px;
    color: #8c8c8c;
    font-size: 12px;
  }

  &__guide-line {
    margin: 0 0 8px;
  }

  &__tags {
    margin-top: 8px;
  }

  &__url-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }
}
</style>
