<template>
  <div class="geoseo-config-view">
    <a-card :bordered="false">
      <a-tabs v-model:activeKey="activeTab">
        <!-- Tab 1: robots.txt 配置 -->
        <a-tab-pane key="robots" tab="robots.txt 配置">
          <a-alert type="info" show-icon style="margin-bottom: 16px">
            <template #message>关于 robots.txt</template>
            <template #description>
              <p>robots.txt 是网站根目录下的一个文本文件，用于告诉搜索引擎爬虫哪些页面可以抓取，哪些不能抓取。</p>
              <p>本系统已默认允许 AI 爬虫（GPTBot、ClaudeBot、PerplexityBot、Google-Extended）访问，这有助于你的网站内容被 ChatGPT、Perplexity 等 AI 搜索引擎收录。</p>
              <p>常见指令说明：User-agent 指定爬虫名称，Allow/Disallow 控制访问权限，Sitemap 声明站点地图位置。</p>
              <p>修改后请点击保存，配置立即生效。</p>
            </template>
          </a-alert>

          <a-textarea
            v-model:value="config.robotsTxt"
            :rows="15"
            placeholder="请输入 robots.txt 内容"
            style="font-family: 'Courier New', monospace;"
          />

          <div style="margin-top: 16px">
            <a-space>
              <a-button :loading="loadingPreview" @click="previewRobotsContent">预览</a-button>
              <a-button type="primary" :loading="saving" @click="saveConfig">保存</a-button>
            </a-space>
          </div>
        </a-tab-pane>

        <!-- Tab 2: llms.txt 预览 -->
        <a-tab-pane key="llms" tab="llms.txt 预览">
          <a-alert type="info" show-icon style="margin-bottom: 16px">
            <template #message>关于 llms.txt</template>
            <template #description>
              <p>llms.txt 是一个新兴的标准文件，类似 robots.txt，但专为 AI 大模型（如 ChatGPT、Claude）设计。</p>
              <p>它提供一个简洁的站点摘要，帮助 AI 模型快速理解你的网站内容和核心页面。</p>
              <p>llms.txt 自动从你的已发布文章摘要（llmsSummary 字段）和企业信息中生成，无需手动编辑。</p>
              <p>要更新 llms.txt 内容，请在文章编辑页中填写每篇文章的 AI搜索引擎摘要（llmsSummary）字段。</p>
            </template>
          </a-alert>

          <div style="margin-bottom: 12px">
            <a-button :loading="loadingPreview" @click="previewLlmsContent">刷新预览</a-button>
          </div>

          <pre class="preview-content">{{ llmsPreview }}</pre>
        </a-tab-pane>

        <!-- Tab 3: sitemap.xml 预览 -->
        <a-tab-pane key="sitemap" tab="sitemap.xml 预览">
          <a-alert type="info" show-icon style="margin-bottom: 16px">
            <template #message>关于 sitemap.xml</template>
            <template #description>
              <p>sitemap.xml 是站点地图文件，告诉搜索引擎你网站有哪些页面可以抓取。</p>
              <p>系统自动从已发布文章、案例和分类页面生成 sitemap，包含每个页面的 URL 和最后更新时间。</p>
              <p>搜索引擎（如 Google、百度）会定期抓取 sitemap.xml 来发现和索引你的页面。</p>
              <p>发布新文章后，sitemap 会自动更新，无需手动操作。</p>
            </template>
          </a-alert>

          <div style="margin-bottom: 12px">
            <a-button :loading="loadingPreview" @click="previewSitemapContent">刷新预览</a-button>
          </div>

          <pre class="preview-content">{{ sitemapPreview }}</pre>
        </a-tab-pane>

        <!-- Tab 4: 默认Meta标签配置 -->
        <a-tab-pane key="meta" tab="默认Meta标签">
          <a-form
            :model="config"
            :label-col="{ span: 4 }"
            :wrapper-col="{ span: 18 }"
            label-align="left"
          >
            <a-form-item label="默认SEO标题" name="defaultSeoTitle">
              <a-input
                v-model:value="config.defaultSeoTitle"
                :maxlength="60"
                show-count
                placeholder="请输入默认SEO标题"
              />
            </a-form-item>
            <a-form-item label="默认SEO描述" name="defaultSeoDescription">
              <a-textarea
                v-model:value="config.defaultSeoDescription"
                :maxlength="160"
                show-count
                :rows="3"
                placeholder="请输入默认SEO描述"
              />
            </a-form-item>
            <a-form-item label="默认SEO关键词" name="defaultSeoKeywords">
              <a-input
                v-model:value="config.defaultSeoKeywords"
                placeholder="关键词1,关键词2,关键词3"
              />
            </a-form-item>
            <a-form-item label="默认OG图片URL" name="defaultOgImage">
              <a-input
                v-model:value="config.defaultOgImage"
                placeholder="请输入默认OG图片URL"
              />
            </a-form-item>
            <a-form-item label="默认Twitter卡片类型" name="defaultTwitterCardType">
              <a-select
                v-model:value="config.defaultTwitterCardType"
                placeholder="请选择Twitter卡片类型"
              >
                <a-select-option value="summary">summary</a-select-option>
                <a-select-option value="summary_large_image">summary_large_image</a-select-option>
                <a-select-option value="app">app</a-select-option>
                <a-select-option value="player">player</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="站点摘要" name="llmsSummary">
              <a-textarea
                v-model:value="config.llmsSummary"
                :maxlength="200"
                show-count
                :rows="3"
                placeholder="站点级摘要，用于llms.txt头部"
              />
            </a-form-item>
            <a-form-item label="AI引用摘要" name="geoCitationSummary">
              <a-textarea
                v-model:value="config.geoCitationSummary"
                :maxlength="300"
                show-count
                :rows="4"
                placeholder="请输入AI引用摘要，用于提升AI搜索引擎的引用率"
              />
            </a-form-item>
            <a-form-item label="默认Schema.org JSON-LD" name="defaultSchemaJson">
              <a-textarea
                v-model:value="config.defaultSchemaJson"
                :rows="8"
                placeholder='{"@context":"https://schema.org","@type":"Organization",...}'
                style="font-family: 'Courier New', monospace;"
              />
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 4, span: 18 }">
              <a-button type="primary" :loading="saving" @click="saveConfig">保存配置</a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>

      <!-- 预览 Modal -->
      <a-modal
        v-model:open="previewModalVisible"
        title="robots.txt 预览"
        :footer="null"
        width="700px"
      >
        <pre class="preview-content">{{ previewModalContent }}</pre>
      </a-modal>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { geoConfigApi } from '../../api/geoseo'
import type { GeoSeoConfig } from '../../types/geoseo'

const activeTab = ref('robots')
const saving = ref(false)
const loadingPreview = ref(false)
const loading = ref(false)

const previewModalVisible = ref(false)
const previewModalContent = ref('')

const llmsPreview = ref('')
const sitemapPreview = ref('')

const config = reactive<GeoSeoConfig>({
  id: undefined,
  tenantId: undefined,
  siteId: undefined,
  robotsTxt: '',
  llmsTxtTemplate: '',
  defaultSeoTitle: '',
  defaultSeoDescription: '',
  defaultSeoKeywords: '',
  defaultOgImage: '',
  defaultTwitterCardType: 'summary',
  defaultSchemaJson: '',
  llmsSummary: '',
  geoCitationSummary: '',
})

const fetchConfig = async () => {
  loading.value = true
  try {
    const data = await geoConfigApi.get()
    if (data) {
      Object.assign(config, data)
    }
  } catch (error: any) {
    message.error(error.message || '获取站点配置失败')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    await geoConfigApi.update(config)
    message.success('配置保存成功')
  } catch (error: any) {
    message.error(error.message || '保存配置失败')
  } finally {
    saving.value = false
  }
}

const previewRobotsContent = async () => {
  loadingPreview.value = true
  try {
    const content = await geoConfigApi.previewRobots()
    previewModalContent.value = content || '(无内容)'
    previewModalVisible.value = true
  } catch (error: any) {
    message.error(error.message || '获取robots.txt预览失败')
  } finally {
    loadingPreview.value = false
  }
}

const previewLlmsContent = async () => {
  loadingPreview.value = true
  try {
    const content = await geoConfigApi.previewLlms()
    llmsPreview.value = content || '(无内容)'
  } catch (error: any) {
    message.error(error.message || '获取llms.txt预览失败')
  } finally {
    loadingPreview.value = false
  }
}

const previewSitemapContent = async () => {
  loadingPreview.value = true
  try {
    const content = await geoConfigApi.previewSitemap()
    sitemapPreview.value = content || '(无内容)'
  } catch (error: any) {
    message.error(error.message || '获取sitemap.xml预览失败')
  } finally {
    loadingPreview.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>

<style scoped lang="less">
.geoseo-config-view {
  padding: 24px;

  .preview-content {
    padding: 16px;
    background: #f5f5f5;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-family: 'Courier New', Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 500px;
    overflow-y: auto;
    margin: 0;
  }
}

:deep(.ant-tabs-content-holder) {
  padding-top: 16px;
}
</style>
