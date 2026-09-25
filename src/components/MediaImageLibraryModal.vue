<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import http from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import type { PageResult } from '@/types/article'

/**
 * 媒体库挑图弹窗：「从已入库的图里挑一张」这件事的唯一实现。
 *
 * <p>为什么单独一个组件而不是把弹窗写在调用方里：挑图这件事有两个入口——字段级的
 * {@link MediaImagePicker}（Banner 图、案例封面、Logo 这类 URL 字段）和文章正文的
 * 「插入图片」（要的是一条 Markdown 图片语法，不是一个字段值）。两处各写一遍列表，
 * 租户收口与「读失败要说读失败」这两条纪律就会只在一处生效。</p>
 */
interface MediaRow {
  id: number
  name?: string
  url: string
  width?: number
  height?: number
  fileSize?: number
}

const props = withDefaults(defineProps<{
  open?: boolean
  /** 不传则按当前登录态推断（超管取右上角选定的客户，租户取自己） */
  tenantId?: number | null
  title?: string
}>(), {
  open: false,
  tenantId: null,
  title: '从媒体库挑一张图'
})

const emit = defineEmits<{
  'update:open': [boolean]
  /** 挑中一张：地址（外加原文件名，够调用方填一句 alt 之类的人类描述）交回调用方 */
  pick: [string, string | undefined]
}>()

const auth = useAuthStore()
const loading = ref(false)
const uploading = ref(false)
const rows = ref<MediaRow[]>([])
const total = ref(0)
const loadFailed = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = 12

const effectiveTenantId = computed(() => props.tenantId ?? auth.selectedTenantId ?? auth.tenantId ?? null)

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return ''
  }
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

async function load() {
  if (!effectiveTenantId.value) {
    rows.value = []
    total.value = 0
    loadFailed.value = false
    message.warning('还没选定客户，先在右上角选一个再挑图')
    return
  }
  loading.value = true
  loadFailed.value = false
  try {
    const data = await http.get<PageResult<MediaRow>>('/media', {
      params: {
        tenantId: effectiveTenantId.value,
        fileType: 'image',
        keyword: keyword.value || undefined,
        page: page.value,
        size: pageSize
      }
    })
    rows.value = data.records ?? []
    total.value = data.total ?? 0
  } catch (error: any) {
    // 空库与「读不到」是两件事：静默吞掉失败会让界面看起来像「媒体库是空的」
    message.error(error?.message || '媒体库读取失败')
    rows.value = []
    total.value = 0
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

async function handleUpload(options: any) {
  if (!effectiveTenantId.value) {
    message.warning('还没选定客户，先选一个再传，否则这张图不知道该记到谁名下')
    return
  }
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('tenantId', String(effectiveTenantId.value))
  uploading.value = true
  try {
    const result: any = await http.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    const url = result?.url ?? result?.data?.url
    if (!url) {
      message.error('上传成功了但返回里没有地址，先刷新媒体库看看这张在不在')
      return
    }
    emit('pick', String(url), result?.name ?? options.file?.name)
    emit('update:open', false)
    message.success('图片已入库并使用')
  } catch (error: any) {
    message.error(error?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function changePage(next: number) {
  page.value = next
  load()
}

function choose(row: MediaRow) {
  emit('pick', row.url, row.name || undefined)
  emit('update:open', false)
}

function close() {
  emit('update:open', false)
}

watch(() => props.open, (opened) => {
  if (opened) {
    keyword.value = ''
    page.value = 1
    load()
  }
}, { immediate: true })
</script>

<template>
  <a-modal :open="open" :title="title" width="860px" :footer="null" @update:open="close">
    <div class="media-library__bar">
      <a-input-search
        v-model:value="keyword"
        placeholder="按原文件名搜"
        style="max-width: 320px"
        allow-clear
        @search="search"
      />
      <a-button @click="load">刷新</a-button>
      <a-upload :show-upload-list="false" accept="image/*" :custom-request="handleUpload">
        <a-button type="primary" :loading="uploading">传一张新的</a-button>
      </a-upload>
      <span class="media-library__count">共 {{ total }} 张 · 当前第 {{ page }} 页</span>
    </div>
    <a-spin :spinning="loading">
      <!-- 读失败与真的空库是两件事：把失败说成「还没有图片」，运营就会去传一个本来就在库里的图 -->
      <a-empty v-if="loadFailed" description="媒体库没读到，点刷新再试一次；一直失败就把这条报错发给平台">
        <a-button @click="load">刷新</a-button>
      </a-empty>
      <a-empty v-else-if="!rows.length && !loading" description="这个客户的媒体库里还没有图片，先传一张">
        <a-upload :show-upload-list="false" accept="image/*" :custom-request="handleUpload">
          <a-button type="primary" :loading="uploading">上传第一张</a-button>
        </a-upload>
      </a-empty>
      <div class="media-library__grid">
        <button v-for="row in rows" :key="row.id" type="button" class="media-library__cell" @click="choose(row)">
          <img :src="row.url" :alt="row.name || ''" loading="lazy">
          <span class="media-library__name">{{ row.name || `#${row.id}` }}</span>
          <span class="media-library__meta">
            {{ row.width && row.height ? `${row.width}×${row.height}` : '' }} {{ formatSize(row.fileSize) }}
          </span>
        </button>
      </div>
    </a-spin>
    <a-pagination
      v-if="total > pageSize"
      style="margin-top: 12px; float: right"
      :current="page"
      :page-size="pageSize"
      :total="total"
      @change="changePage"
    />
  </a-modal>
</template>

<style scoped>
.media-library__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.media-library__count {
  margin-left: auto;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.media-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  min-height: 120px;
}
.media-library__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}
.media-library__cell:hover {
  border-color: var(--ant-color-primary, #1677ff);
}
.media-library__cell img {
  width: 100%;
  height: 92px;
  object-fit: cover;
  border-radius: 4px;
  background: #fafafa;
}
.media-library__name,
.media-library__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.media-library__meta {
  color: rgba(0, 0, 0, 0.45);
}
</style>
