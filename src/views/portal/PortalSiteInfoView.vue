<template>
  <SettingsPage
    :groups="groups"
    progress-word="AI 已填"
    :loading="loading"
    :read-failed="readFailed"
    :not-read="notReadNotice"
  >
    <template #retry>
      <a-button type="primary" @click="load">重新读取</a-button>
    </template>

    <template #siteFields>
      <a-alert type="info" show-icon :message="SITE_INFO_AI_FIRST_TEXT" style="margin-bottom: 16px" />

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

          <!-- 保存闸会拒的那一类：闸只拦新的贴入、不动历史行，所以库里可能躺着一份今天存不回去的原文 -->
          <!-- 说明句和点名的行必须一起走 #description 槽：a-alert 的 description **prop** 会把槽挤掉
               （2026-10-04 现场：错误档只回了那句解释，「按下面点名的那一行」下面什么都没有）。 -->
          <a-alert
            v-if="robotsBlocking.length"
            type="error"
            show-icon
            :message="`这份覆写原文里有 ${robotsBlocking.length} 处是保存闸会当场拒的`"
            style="margin-bottom: 12px"
          >
            <template #description>
              <p class="robots-block-note">这一份是在闸之前存进来的，闸只拦新的贴入、不改已经躺在库里的行 —— 所以你打开这一页看到的就是逐字对外的那一份，但在这一栏里点「保存覆写原文」会被拒。要么按下面点名的这一处改掉（或写 {sitemap} 让系统换成本站地址），要么勾爬虫改走「保存爬虫勾选」。</p>
              <ul class="robots-warnings">
                <li v-for="(issue, index) in robotsBlocking" :key="index">{{ issue }}</li>
              </ul>
            </template>
          </a-alert>

          <!-- 缺口提示：只点名不拦人（客户有权屏蔽某一家），但必须看得见，否则「贴了原文却没人告诉我省了哪段」 -->
          <a-alert
            v-if="robotsWarnings.length"
            type="info"
            show-icon
            :message="`这份覆写原文里有 ${robotsWarnings.length} 处要留意的地方（${robotsSaveBlocked ? '这一份现在点保存会先被上面那条拒掉' : '不影响保存'}）`"
            style="margin-bottom: 12px"
          >
            <template #description>
              <ul class="robots-warnings">
                <li v-for="(warning, index) in robotsWarnings" :key="index">{{ warning }}</li>
              </ul>
            </template>
          </a-alert>

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
              <a-button type="primary" :loading="savingKey === ROBOTS_KEY" :disabled="savingKey === ROBOTS_KEY" @click="saveRobotsChecks(field)">
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
              placeholder="逐字对外生效的 robots.txt 原文。Sitemap 那行请写 https:// 开头的完整地址，或写 {sitemap} 由系统换成本站的地址；相对地址（如 /sitemap.xml）搜索引擎收不到，保存会被拒。"
              style="font-family: 'Courier New', monospace"
            />
            <div class="toolbar-actions" style="margin-top: 8px">
              <a-button type="primary" :loading="savingKey === ROBOTS_KEY" :disabled="savingKey === ROBOTS_KEY" @click="saveRobotsOverride(field)">
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
                <a-button type="primary" :loading="savingKey === field.key" :disabled="savingKey === field.key" @click="saveTextField(field)">保存</a-button>
                <a-button @click="editingKey = ''">取消</a-button>
              </template>
            </a-space>
          </div>
        </template>

        <!-- 不可改的项（模板类字段）：只读 + 来源 -->
        <template v-else>
          <pre class="field-text">{{ field.text || '（AI 还没填过这一项）' }}</pre>
          <div class="readonly-hint">这一项由 AI 维护，这一页只读。</div>
        </template>
      </div>

      <!-- Spec-F Q4-A：「让 AI 重写」这一整块（勾选项 + 附加要求 + 登记按钮 + 回显）已从界面撤下。
           重写链路没有接模型，页面上留着任何能按的按钮都会让人以为它会产出新内容；
           后端的 POST /portal/site-info/ai-rewrite 仍在，但这一页不再调它。 -->
    </template>

    <!-- 逐页 SEO 的租户侧只读镜像：租户看得到自己每页的 SEO；改它仍要经超管的「页面搭建」。
         Spec-Q P3：这一块原来只是卡里的一条分隔线，现在提成一组——页顶那一排锚点能一步跳到这里；
         它那一发读失败也不再只弹 toast（改之前这一屏有一类失败在页面上没有落点）。 -->
    <template #pageSeo>
      <a-alert
        type="info"
        show-icon
        message="这里是各页面 SEO 的只读镜像。写入这一层的口在超级管理员侧「页面搭建」，客户侧暂不可改。"
        style="margin-bottom: 12px"
      />
      <StateBlock v-if="pagesFailed" state="error" :detail="pagesFailed">
        <a-button @click="loadPages">重新读取这一发</a-button>
      </StateBlock>
      <DataTable
        v-else
        :data-source="pageSeoRows"
        :columns="pageSeoColumns"
        :error="pagesError"
        :retry="loadPages"
        empty-line="这一栏还没有内容。"
        :loading="loadingPages"
        row-key="pageId"
        size="small"
        :pagination="false"
        :scroll="{ x: 'max-content' }"
      />
    </template>
  </SettingsPage>
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
  type SiteInfoFieldView,
  type SiteInfoView
} from '../../api/portalSiteInfo';
import SettingsPage from '../../components/SettingsPage.vue'
import DataTable from '../../components/DataTable.vue'
import StateBlock from '../../components/StateBlock.vue'
import type { SettingsGroup } from '../../components/settingsPageModel'

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
/** 站点信息那一发读失败的后端原话。非空时整组卡退场：一份没读回来的空表摆在屏上，
 *  逐格保存就成了「拿空白去覆盖 AI 已经填过的内容」。 */
const readFailed = ref('');
/** 逐页 SEO 是另一发请求，失败只让它那一块退场，不牵连站点信息。 */
const pagesFailed = ref('');
/** 逐页 SEO 那一发读失败的后端原话：交给表格的错误态，别再当成「这一栏没有内容」。 */
const pagesError = ref<string | null>(null);

const fieldRows = computed(() => siteInfoFieldRows(view.value));

const robotsStructured = computed(() => {
  const robots = view.value?.fields?.[ROBOTS_KEY];
  return robots?.structured ?? null;
});
const robotsMode = computed(() => robotsStructured.value?.mode ?? '');
const robotsCrawlers = computed(() => robotsStructured.value?.crawlers ?? []);
const robotsExportedText = computed(() => robotsStructured.value?.exportedText ?? '');
const robotsWarnings = computed(() => robotsStructured.value?.warnings ?? []);
const robotsBlocking = computed(() => robotsStructured.value?.blocking ?? []);
const robotsSaveBlocked = computed(() => robotsBlocking.value.length > 0);

// 勾选袋：id -> checked，初值来自后端 structured.crawlers[].allowed（真相不猜）
const crawlerChecked = reactive<Record<string, boolean>>({});

const savingKey = ref('');
const editingKey = ref('');
const textDraft = ref('');

const overrideEditing = ref(false);
const overrideDraft = ref('');

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

/**
 * 分组与完成度都只从后端回包里数（I-1）：字段名、来源角标、站点状态中文一律是后端那份，
 * 这里一个都不抄。robots 那一格认 structured（勾选集合），文本那一档只有逐字覆写原文时 structured 才为空。
 */
const groups = computed<SettingsGroup[]>(() => [
  {
    key: 'siteFields',
    label: view.value?.siteName || '站点信息',
    note: view.value?.siteStatus ? siteStatusText(view.value.siteStatus) : '',
    fields: fieldRows.value.map(field => ({
      key: field.key,
      label: field.label,
      done: field.key === ROBOTS_KEY ? !!field.structured : !!(field.text ?? '').trim()
    }))
  },
  { key: 'pageSeo', label: '逐页 SEO（只读）' }
]);

/** 后端答了这一发但里面没有站点信息 —— 和「这个站点什么都没填」是两件事 */
const notReadNotice = computed(() => {
  if (loading.value || readFailed.value || view.value) return '';
  return '这一发请求回来了，但里面没有站点信息——这不是「这个站点什么都没填」，是这一屏还没取到内容。请刷新重试。';
});

async function load() {
  loading.value = true;
  readFailed.value = '';
  try {
    view.value = await siteInfoApi.read(siteId.value);
    editingKey.value = '';
    overrideEditing.value = false;
    seedCrawlerChecks();
  } catch (error) {
    const reason = describeHttpError(error);
    view.value = null;
    readFailed.value = `站点信息没读回来：${reason}`;
  } finally {
    loading.value = false;
  }
}

async function loadPages() {
  loadingPages.value = true;
  pagesFailed.value = '';
  pagesError.value = null;
  try {
    pageSeoRows.value = await siteInfoApi.pagesSeo(siteId.value);
  } catch (error) {
    const reason = describeHttpError(error);
    pageSeoRows.value = [];
    pagesError.value = (error as { message?: string })?.message || '逐页 SEO 加载失败';
    pagesFailed.value = `逐页 SEO 没读回来：${reason}`;
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

onMounted(() => {
  load();
  loadPages();
});
</script>

<style scoped lang="less">
.field-block {
  margin-bottom: 8px;
}

.field-label {
  font-weight: 600;
}

/* 375 视口实测：字段名 + 来源角标这一条分隔线内文被顶出卡片 16px，角标落到屏外。
   让内文允许折行——长字段名换到第二行，不许把角标挤出可视区。 */
:deep(.ant-divider-inner-text) {
  white-space: normal;
  word-break: break-word;
}

.field-text,
.preview-text {
  padding: 12px;
  background: var(--admin-table-header-bg);
  border: 1px solid var(--admin-border-soft);
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
  color: var(--admin-text-secondary);
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.readonly-hint {
  color: var(--admin-text-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.robots-warnings {
  margin: 0;
  padding-left: 18px;
}

.robots-warnings li {
  margin-bottom: 4px;
}

.robots-block-note {
  margin: 0 0 8px;
}

.toolbar-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
