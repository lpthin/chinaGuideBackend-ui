<template>
  <div class="site-info-view">
    <a-card :bordered="false">
      <template #title>
        <span>{{ view?.siteName || '网站信息' }}</span>
        <a-tag v-if="view?.siteStatus" style="margin-left: 8px">{{ siteStatusText(view.siteStatus) }}</a-tag>
      </template>

      <a-alert type="info" show-icon :message="SITE_INFO_AI_FIRST_TEXT" style="margin-bottom: 16px" />

      <a-spin :spinning="loading">
        <a-empty v-if="!view" description="还没取到网站信息，请刷新重试" />

        <template v-else>
          <!-- 一屏可见：每个字段带来源角标（后端 changeSourceLabel），可改的给「改」，不可改的原样展示 -->
          <div v-for="field in fieldRows" :key="field.key" class="field-block">
            <a-divider orientation="left" style="margin: 12px 0">
              <span class="field-label">{{ field.label }}</span>
              <a-tag :color="changeSourceColor(field.changeSource)" style="margin-left: 8px">
                {{ field.changeSourceLabel }}
              </a-tag>
            </a-divider>

            <!-- robots：勾选哪些 AI 爬虫（真相是集合，文本由后端推导）+ 折叠的原文预览 + 高级覆写 -->
            <template v-if="field.key === ROBOTS_KEY">
              <a-alert
                v-if="robotsMode === ROBOTS_MODE_RAW_OVERRIDE"
                type="warning"
                show-icon
                message="当前生效的是「手工覆写原文」这一档"
                description="下面这份原文逐字对外。想改回按爬虫勾选，请勾选后点「保存爬虫勾选」——它会同时清掉这份覆写原文。"
                style="margin-bottom: 12px"
              />

              <div class="robots-checks">
                <div v-for="c in robotsCrawlers" :key="c.id" class="crawler-row">
                  <a-checkbox v-model:checked="crawlerChecked[c.id]">
                    {{ c.label }}
                  </a-checkbox>
                  <span class="ua-token">{{ c.userAgent }}</span>
                </div>
              </div>

              <a-collapse style="margin: 8px 0">
                <a-collapse-panel key="preview" header="查看这份配置实际对外吐出的 robots.txt 原文">
                  <pre class="preview-text">{{ robotsExportedText }}</pre>
                </a-collapse-panel>
              </a-collapse>

              <div class="toolbar-actions">
                <a-space>
                  <a-button type="primary" :loading="savingKey === ROBOTS_KEY" @click="saveRobotsChecks(field)">
                    保存爬虫勾选
                  </a-button>
                  <a-button @click="toggleOverride(field)">
                    {{ overrideEditing ? '取消覆写' : '直接覆写原文' }}
                  </a-button>
                </a-space>
              </div>

              <div v-if="overrideEditing" style="margin-top: 12px">
                <a-textarea
                  v-model:value="overrideDraft"
                  :rows="10"
                  placeholder="逐字对外生效的 robots.txt 原文（可用 {sitemap} 占位）"
                  style="font-family: 'Courier New', monospace"
                />
                <div class="toolbar-actions" style="margin-top: 8px">
                  <a-button type="primary" :loading="savingKey === ROBOTS_KEY" @click="saveRobotsOverride(field)">
                    保存覆写原文
                  </a-button>
                </div>
              </div>
            </template>

            <!-- 可改的文本项：AI 已填，点「改」才变输入框 -->
            <template v-else-if="field.editable">
              <pre v-if="editingKey !== field.key" class="field-text">{{ field.text || '（AI 还没填过这一项）' }}</pre>
              <a-textarea v-else v-model:value="textDraft" :rows="5" :maxlength="2000" show-count />
              <div class="toolbar-actions" style="margin-top: 8px">
                <a-space>
                  <template v-if="editingKey !== field.key">
                    <a-button @click="startEdit(field)">改</a-button>
                  </template>
                  <template v-else>
                    <a-button type="primary" :loading="savingKey === field.key" @click="saveTextField(field)">保存</a-button>
                    <a-button @click="editingKey = ''">取消</a-button>
                  </template>
                </a-space>
              </div>
            </template>

            <!-- 不可改的项（模板类字段）：只读 + 来源，将来由 AI 那条线重写 -->
            <template v-else>
              <pre class="field-text">{{ field.text || '（AI 还没填过这一项）' }}</pre>
              <div class="readonly-hint">这一项由 AI 维护，这一页只读。</div>
            </template>
          </div>

          <!-- 让 AI 重写：真实登记口，本期不接模型 ⇒ 结果只如实回显后端那句 message，绝不 message.success -->
          <a-divider orientation="left">让 AI 重写</a-divider>
          <a-alert
            type="info"
            show-icon
            message="勾选要让 AI 重写的项，可附一句要求。提交只是「登记请求」——重写链路接入前不会产生任何新内容，也不会改动上面的现值。"
            style="margin-bottom: 12px"
          />
          <a-checkbox-group v-model:value="rewriteSelection" style="margin-bottom: 8px">
            <a-checkbox v-for="field in fieldRows" :key="field.key" :value="field.key">{{ field.label }}</a-checkbox>
          </a-checkbox-group>
          <div>
            <a-input v-model:value="rewriteInstruction" placeholder="（可选）给 AI 的一句话，例如「语气再专业一些」" style="max-width: 520px" />
          </div>
          <div class="toolbar-actions" style="margin-top: 8px">
            <a-button :loading="rewriting" @click="submitRewrite">登记重写请求</a-button>
          </div>
          <a-alert
            v-if="rewriteResult"
            :type="rewriteResult.generated ? 'success' : 'warning'"
            show-icon
            :message="rewriteResult.message"
            style="margin-top: 12px"
          />

          <!-- 逐页 SEO 的租户侧只读镜像：租户看得到自己每页的 SEO；改它仍要经超管的「页面搭建」 -->
          <a-divider orientation="left">逐页 SEO（只读）</a-divider>
          <a-alert
            type="info"
            show-icon
            message="这里是各页面 SEO 的只读镜像。写入这一层的口在超管侧「页面搭建」，租户侧暂不可改。"
            style="margin-bottom: 12px"
          />
          <a-table
            :data-source="pageSeoRows"
            :columns="pageSeoColumns"
            :loading="loadingPages"
            row-key="pageId"
            size="small"
            :pagination="false"
          />
        </template>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import { describeHttpError } from '../../api/http';
import { siteStatusText } from '../../api/siteBriefs';
import {
  ROBOTS_MODE_RAW_OVERRIDE,
  changeSourceColor,
  siteInfoApi,
  siteInfoFieldRows,
  SITE_INFO_AI_FIRST_TEXT,
  type PageSeoRow,
  type RewriteResult,
  type SiteInfoFieldView,
  type SiteInfoView
} from '../../api/portalSiteInfo';

const ROBOTS_KEY = 'robots';

const route = useRoute();
const siteId = computed(() => {
  const raw = route.query.site;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : null;
});

const loading = ref(false);
const loadingPages = ref(false);
const view = ref<SiteInfoView | null>(null);
const pageSeoRows = ref<PageSeoRow[]>([]);

const fieldRows = computed(() => siteInfoFieldRows(view.value));

const robotsStructured = computed(() => {
  const robots = view.value?.fields?.[ROBOTS_KEY];
  return robots?.structured ?? null;
});
const robotsMode = computed(() => robotsStructured.value?.mode ?? '');
const robotsCrawlers = computed(() => robotsStructured.value?.crawlers ?? []);
const robotsExportedText = computed(() => robotsStructured.value?.exportedText ?? '');

// 勾选袋：id -> checked，初值来自后端 structured.crawlers[].allowed（真相不猜）
const crawlerChecked = reactive<Record<string, boolean>>({});

const savingKey = ref('');
const editingKey = ref('');
const textDraft = ref('');

const overrideEditing = ref(false);
const overrideDraft = ref('');

const rewriting = ref(false);
const rewriteSelection = ref<string[]>([]);
const rewriteInstruction = ref('');
const rewriteResult = ref<RewriteResult | null>(null);

const pageSeoColumns = [
  { title: '页面', dataIndex: 'title', key: 'title' },
  { title: '路径', dataIndex: 'slug', key: 'slug' },
  { title: 'SEO 标题', dataIndex: 'seoTitle', key: 'seoTitle', customRender: ({ text }: { text: string | null }) => text || '—' },
  { title: 'SEO 描述', dataIndex: 'seoDescription', key: 'seoDescription', customRender: ({ text }: { text: string | null }) => text || '—' }
];

function seedCrawlerChecks() {
  Object.keys(crawlerChecked).forEach(key => delete crawlerChecked[key]);
  robotsCrawlers.value.forEach(c => { crawlerChecked[c.id] = c.allowed === true; });
}

async function load() {
  loading.value = true;
  try {
    view.value = await siteInfoApi.read(siteId.value);
    editingKey.value = '';
    overrideEditing.value = false;
    seedCrawlerChecks();
  } catch (error) {
    message.error(`加载网站信息失败：${describeHttpError(error)}`);
  } finally {
    loading.value = false;
  }
}

async function loadPages() {
  loadingPages.value = true;
  try {
    pageSeoRows.value = await siteInfoApi.pagesSeo(siteId.value);
  } catch (error) {
    message.error(`加载逐页 SEO 失败：${describeHttpError(error)}`);
  } finally {
    loadingPages.value = false;
  }
}

function startEdit(field: SiteInfoFieldView) {
  editingKey.value = field.key;
  textDraft.value = field.text ?? '';
}

async function saveTextField(field: SiteInfoFieldView) {
  savingKey.value = field.key;
  try {
    view.value = await siteInfoApi.update({
      siteId: siteId.value,
      fields: { [field.key]: { text: textDraft.value } }
    });
    editingKey.value = '';
    message.success('已保存你的修改');
  } catch (error) {
    message.error(`保存失败：${describeHttpError(error)}`);
  } finally {
    savingKey.value = '';
  }
}

async function saveRobotsChecks(field: SiteInfoFieldView) {
  // 只提交勾选集合这一档（后端会清空覆写原文，两档互斥）
  const crawlers = robotsCrawlers.value.filter(c => crawlerChecked[c.id]).map(c => c.id);
  savingKey.value = field.key;
  try {
    view.value = await siteInfoApi.update({
      siteId: siteId.value,
      fields: { [field.key]: { crawlers } }
    });
    overrideEditing.value = false;
    seedCrawlerChecks();
    message.success('已保存爬虫勾选');
  } catch (error) {
    message.error(`保存失败：${describeHttpError(error)}`);
  } finally {
    savingKey.value = '';
  }
}

function toggleOverride(field: SiteInfoFieldView) {
  overrideEditing.value = !overrideEditing.value;
  if (overrideEditing.value) {
    overrideDraft.value = field.structured?.overrideText ?? robotsExportedText.value ?? '';
  }
}

async function saveRobotsOverride(field: SiteInfoFieldView) {
  savingKey.value = field.key;
  try {
    view.value = await siteInfoApi.update({
      siteId: siteId.value,
      fields: { [field.key]: { overrideText: overrideDraft.value } }
    });
    overrideEditing.value = false;
    seedCrawlerChecks();
    message.success('已保存覆写原文');
  } catch (error) {
    message.error(`保存失败：${describeHttpError(error)}`);
  } finally {
    savingKey.value = '';
  }
}

async function submitRewrite() {
  if (!rewriteSelection.value.length) {
    message.warning('请先勾选要让 AI 重写哪几项');
    return;
  }
  rewriting.value = true;
  try {
    // 结果一律以服务端回包为准：generated=false 时如实回显 message，不改成 success 文案、不假装已重写
    rewriteResult.value = await siteInfoApi.aiRewrite({
      siteId: siteId.value,
      fields: rewriteSelection.value,
      instruction: rewriteInstruction.value.trim() || null
    });
  } catch (error) {
    message.error(`登记失败：${describeHttpError(error)}`);
  } finally {
    rewriting.value = false;
  }
}

onMounted(() => {
  load();
  loadPages();
});
</script>

<style scoped lang="less">
.site-info-view {
  .field-block {
    margin-bottom: 8px;
  }

  .field-label {
    font-weight: 600;
  }

  .field-text,
  .preview-text {
    padding: 12px;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'Courier New', Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
    max-height: 420px;
    overflow-y: auto;
  }

  .robots-checks {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .crawler-row .ua-token {
    margin-left: 8px;
    color: #8c8c8c;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }

  .readonly-hint {
    color: #8c8c8c;
    font-size: 12px;
    margin-top: 4px;
  }

  .toolbar-actions {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
