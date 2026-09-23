<template>
  <div class="reference-site-page">
    <a-form layout="inline" class="reference-site-page__filter">
      <a-form-item label="状态">
        <a-select
          v-model:value="statusFilter"
          style="width: 160px"
          allow-clear
          placeholder="全部状态"
          :options="statusOptions"
          @change="loadTasks"
        />
      </a-form-item>
      <a-form-item class="toolbar-actions">
        <a-space>
          <a-button :loading="loading" @click="reload">刷新</a-button>
          <a-button type="primary" @click="openCreateModal">新建摄取任务</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-alert type="info" show-icon class="reference-site-page__notice">
      <template #message>
        这里摄取的是别人的站点「长什么样的结构」，不是把别人的网页搬进来：落库的只有版式结构、样式取值与映射建议，
        生成出来的是一份草稿页，用的是我们自己的区块和你们自己的内容。
      </template>
    </a-alert>

    <a-table
      :data-source="tasks"
      :columns="columns"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      size="middle"
      :scroll="{ x: 1160 }"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'source'">
          <a v-if="record.sourceUrl" :href="record.sourceUrl" target="_blank" rel="noopener noreferrer">
            {{ record.sourceUrl }}
          </a>
          <span v-else class="reference-site-page__muted">（截图任务，没有网址）</span>
        </template>
        <template v-else-if="column.key === 'mode'">
          {{ referenceModeLabel(record.mode) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          <loading-outlined v-if="referenceIsRunning(record.status)" spin class="reference-site-page__muted" />
        </template>
        <template v-else-if="column.key === 'error'">
          <a-tooltip v-if="record.errorMessage" :title="record.errorMessage">
            <span class="reference-site-page__error">{{ record.errorMessage }}</span>
          </a-tooltip>
          <span v-else class="reference-site-page__muted">—</span>
        </template>
        <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
        <template v-else-if="column.key === 'op'">
          <a-button size="small" type="link" @click="openTask(record.id)">审阅</a-button>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="还没有参考站摄取任务：新建一个任务，填参考站网址或者直接上传截图" />
      </template>
    </a-table>

    <!-- ---------------- 新建任务 ---------------- -->
    <a-modal
      v-model:open="createOpen"
      title="新建参考站摄取任务"
      :ok-text="createLoading ? '创建中' : '创建任务'"
      :confirm-loading="createLoading"
      @ok="createTask"
    >
      <a-form layout="vertical">
        <a-form-item label="怎么提供参考站">
          <a-radio-group v-model:value="createForm.mode">
            <a-radio value="screenshot_upload">上传截图（不向外网发请求）</a-radio>
            <a-radio value="url">按网址抓取（需要截图服务在线）</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="createForm.mode === 'url'" label="参考站地址">
          <a-input v-model:value="createForm.sourceUrl" placeholder="https://example.com" :maxlength="500" />
          <p class="reference-site-page__muted">
            只抓你有权抓的站点。抓取前会过一遍 SSRF 检查与对方的 robots.txt，被限制就是被限制，我们不会绕。
          </p>
        </a-form-item>
        <a-form-item label="最多抓几页">
          <a-input-number v-model:value="createForm.maxPages" :min="1" :max="6" />
          <span class="reference-site-page__muted"> 个页面（1–6，超出后端会直接按 6 收）</span>
        </a-form-item>
        <a-form-item v-if="createForm.mode === 'url'" label="遵守对方 robots.txt">
          <a-switch v-model:checked="createForm.obeyRobots" />
        </a-form-item>
      </a-form>
      <p class="reference-site-page__muted">
        截图任务创建后停在「结构归纳中」等进料；网址任务要再点一次「开始抓取」才真的发请求——
        这中间没有任何自动往下走的动作。
      </p>
    </a-modal>

    <!-- ---------------- 任务详情 ---------------- -->
    <a-drawer v-model:open="detailOpen" :title="detailTitle" width="1080" placement="right">
      <a-spin :spinning="detailLoading">
        <template v-if="task">
          <a-descriptions :column="3" size="small" bordered>
            <a-descriptions-item label="状态">
              <a-tag :color="statusColor(task.status)">{{ statusLabel(task.status) }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="方式">{{ referenceModeLabel(task.mode) }}</a-descriptions-item>
            <a-descriptions-item label="已抓页数">{{ task.pagesCrawled ?? 0 }} / {{ task.maxPages ?? '—' }}</a-descriptions-item>
            <a-descriptions-item label="来源网址" :span="2">{{ task.sourceUrl || '—' }}</a-descriptions-item>
            <a-descriptions-item label="robots.txt">{{ task.obeyRobots === false ? '不遵守' : '遵守' }}</a-descriptions-item>
            <a-descriptions-item label="创建人">{{ task.createdBy || '—' }}</a-descriptions-item>
            <a-descriptions-item label="创建时间">{{ formatDateTime(task.createdAt) }}</a-descriptions-item>
            <a-descriptions-item label="结束时间">{{ formatDateTime(task.finishedAt) }}</a-descriptions-item>
            <a-descriptions-item v-if="task.errorMessage" label="最近一次结果" :span="3">
              <span class="reference-site-page__error">{{ task.errorMessage }}</span>
            </a-descriptions-item>
          </a-descriptions>

          <a-space style="margin-top: 16px" wrap>
            <a-button
              v-if="task.mode === 'url' && task.status === 'pending'"
              :loading="crawling"
              @click="startCrawl"
            >
              开始抓取
            </a-button>
            <a-button :loading="estimating" @click="runEstimate">先估算消耗</a-button>
            <a-button type="primary" :disabled="!estimate" :loading="analyzing" @click="openAnalyzeModal">
              开始 AI 摄取
            </a-button>
            <a-button :disabled="task.status !== 'done'" @click="openApplyModal">生成草稿页</a-button>
            <a-button :loading="detailLoading" @click="refreshDetail">刷新进度</a-button>
          </a-space>
          <p class="reference-site-page__muted">
            「先估算消耗」只算不调用模型；「开始 AI 摄取」会真的产生两次 AI 调用并扣租户配额，所以必须先看过预估再勾选确认。
            抓取与 AI 摄取都在后台排队执行，这里的进度是靠刷新看出来的，不是按了就算完成的。
          </p>

          <a-alert v-if="estimate" type="info" show-icon style="margin-top: 8px" :message="estimateMessage" />
          <a-alert
            v-if="referenceIsRunning(task.status)"
            type="warning"
            show-icon
            style="margin-top: 8px"
            message="任务正在后台执行，这里每 5 秒自动刷新一次；关闭抽屉不影响它继续跑"
          />

          <a-tabs v-model:activeKey="tab" style="margin-top: 16px">
            <a-tab-pane key="pages" :tab="`抓到的页面（${pages.length}）`">
              <a-table
                :data-source="pages"
                :columns="pageColumns"
                :loading="pagesLoading"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ x: 980 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'url'">
                    <span v-if="record.url">{{ record.url }}</span>
                    <span v-else class="reference-site-page__muted">（只传了截图，没抓过页面）</span>
                    <div v-if="record.fetchedAt" class="reference-site-page__muted">
                      抓取于 {{ formatDateTime(record.fetchedAt) }}
                    </div>
                  </template>
                  <template v-else-if="column.key === 'shots'">
                    <div class="reference-site-page__shots">
                      <div v-for="viewport in viewports" :key="viewport.value" class="reference-site-page__shot">
                        <span class="reference-site-page__muted">{{ viewport.label }}</span>
                        <a-image
                          v-if="record[viewport.mediaField]"
                          :src="shotUrlOf(record, viewport.mediaField)"
                          :width="64"
                          :alt="`${viewport.label}截图`"
                        />
                        <span v-else class="reference-site-page__muted">缺</span>
                      </div>
                    </div>
                  </template>
                  <template v-else-if="column.key === 'structure'">
                    <div>{{ sectionText(record) }}</div>
                    <div class="reference-site-page__muted">{{ tokensText(record) }}</div>
                  </template>
                  <template v-else-if="column.key === 'robots'">
                    <a-tag v-if="record.robotsAllowed === false" color="red">被对方限制</a-tag>
                    <a-tag v-else color="green">允许</a-tag>
                  </template>
                  <template v-else-if="column.key === 'sections'">
                    <a-tooltip v-if="record.observedSectionsJson" :title="rolesOf(record)">
                      <span>{{ rolesOf(record) }}</span>
                    </a-tooltip>
                    <span v-else class="reference-site-page__muted">还没归纳</span>
                  </template>
                </template>
                <template #emptyText>
                  <a-empty description="还没有页面：网址任务点「开始抓取」，截图任务在下面上传" />
                </template>
              </a-table>

              <a-divider orientation="left">补传一张截图</a-divider>
              <a-form layout="inline">
                <a-form-item label="挂到哪一页">
                  <a-select v-model:value="shotForm.referencePageId" style="width: 300px" :options="pageOptions">
                  </a-select>
                </a-form-item>
                <a-form-item label="视口">
                  <a-select v-model:value="shotForm.viewport" style="width: 110px" :options="viewportOptions" />
                </a-form-item>
                <a-form-item>
                  <a-upload :before-upload="pickShot" :show-upload-list="false" accept="image/*">
                    <a-button :loading="uploading">选择图片并上传</a-button>
                  </a-upload>
                </a-form-item>
              </a-form>
              <p class="reference-site-page__muted">
                上传这一步不花钱：不 OCR、不调模型。但一个任务里<b>只有截图、没有抓取摘要</b>时，
                「开始 AI 摄取」会把截图交给视觉模型看版面（每页一张、桌面优先，一次最多 6 页），
                这一步要花 token，点之前会先给预估。两种材料都有时走抓取摘要那条路——它不需要图片，更便宜。
                本租户没配视觉模型时会借用平台的（平台也没有就直接被拒），原因写在预估弹窗里；届时也可以照截图在页面搭建器里手搭。
              </p>
            </a-tab-pane>

            <a-tab-pane key="mappings" :tab="`区块映射（${mappings.length}）`">
              <a-alert
                type="warning"
                show-icon
                style="margin-bottom: 12px"
                message="模型给的置信度只是排序依据，没人点过「确认」的映射不会进草稿页"
              />
              <a-table
                :data-source="mappings"
                :columns="mappingColumns"
                :loading="mappingsLoading"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ x: 980 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'mappedBlockKey'">
                    <span>{{ blockName(record.mappedBlockKey) }}</span>
                    <div class="reference-site-page__muted">{{ record.mappedBlockKey || '未映射' }}</div>
                  </template>
                  <template v-else-if="column.key === 'confidence'">
                    <a-progress
                      v-if="record.confidence !== null"
                      :percent="Math.round(Number(record.confidence) * 100)"
                      size="small"
                      :show-info="true"
                    />
                    <span v-else class="reference-site-page__muted">—</span>
                  </template>
                  <template v-else-if="column.key === 'props'">
                    <a-tooltip :title="propsText(record)">
                      <span class="reference-site-page__text">{{ propsText(record) }}</span>
                    </a-tooltip>
                  </template>
                  <template v-else-if="column.key === 'verified'">
                    <a-tag v-if="record.humanVerified" color="green">已确认</a-tag>
                    <a-tag v-else color="default">待确认</a-tag>
                    <div v-if="record.verifiedBy" class="reference-site-page__muted">
                      {{ record.verifiedBy }} · {{ formatDateTime(record.verifiedAt) }}
                    </div>
                  </template>
                  <template v-else-if="column.key === 'note'">
                    <span class="reference-site-page__text">{{ record.note || '—' }}</span>
                  </template>
                  <template v-else-if="column.key === 'op'">
                    <a-space>
                      <a-button size="small" type="link" @click="openVerifyModal(record, true)">确认</a-button>
                      <a-button size="small" type="link" @click="openVerifyModal(record, false)">不认</a-button>
                    </a-space>
                  </template>
                </template>
                <template #emptyText>
                  <a-empty description="还没有映射：等任务跑到「映射已就绪」或「需人工处理」再看这里" />
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="unmatched" :tab="`需要新区块（${unmatched.length}）`">
              <a-alert
                type="info"
                show-icon
                style="margin-bottom: 12px"
                message="这些是白名单里对不上的观察区块。我们不会为了凑数把它塞进一个万能容器——那样区块库三个月就变成垃圾桶"
                description="留着它们就是积压清单：哪一类反复出现，就该由人开发一个真区块补进白名单，而不是让模型即兴发挥。"
              />
              <a-table
                :data-source="unmatched"
                :columns="unmatchedColumns"
                :loading="unmatchedLoading"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ x: 720 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'note'">{{ record.note || '—' }}</template>
                  <template v-else-if="column.key === 'op'">
                    <a-button size="small" type="link" @click="openVerifyModal(record, true)">改成映射到…</a-button>
                  </template>
                </template>
                <template #emptyText>
                  <a-empty description="没有对不上的区块" />
                </template>
              </a-table>
            </a-tab-pane>
          </a-tabs>
        </template>
      </a-spin>
    </a-drawer>

    <!-- ---------------- AI 摄取确认：烧钱动作必须显式确认 ---------------- -->
    <a-modal
      v-model:open="analyzeOpen"
      title="确认让 AI 读这个参考站？"
      :ok-text="confirmChecked ? '确认并开始摄取' : '请先勾选确认'"
      :ok-button-props="{ disabled: !confirmChecked, loading: analyzing }"
      @ok="runAnalyze"
    >
      <p v-if="estimate">
        预计消耗 <b>{{ estimate.estimatedTokens }}</b> token（结构归纳 + 区块映射两步加起来），
        本站剩余配额 <b>{{ estimate.remainingTokens }}</b> token。
      </p>
      <p v-else class="reference-site-page__error">还没有取到预估，请先点「先估算消耗」。</p>
      <p v-if="estimate && !estimate.aiEnabled" class="reference-site-page__error">
        {{ estimate.notice || '参考站 AI 摄取当前未开启，确认也不会调用模型' }}
      </p>
      <p class="reference-site-page__muted">
        这一步产出的是「观察到的结构 + 映射建议」，还要你逐条确认，最后按「生成草稿页」才会出现一份草稿；
        草稿不发布，访客看不到。
      </p>
      <a-checkbox v-model:checked="confirmChecked">我已看过预估，确认这次调用会消耗租户配额</a-checkbox>
    </a-modal>

    <!-- ---------------- 人工确认一条映射 ---------------- -->
    <a-modal
      v-model:open="verifyOpen"
      :title="verifyAccept ? '确认这条映射' : '判定这条映射不成立'"
      :confirm-loading="verifying"
      @ok="submitVerify"
    >
      <p class="reference-site-page__muted">
        观察到：{{ verifyTarget?.observedBlock || '—' }}
        <template v-if="verifyTarget?.note">（模型理由：{{ verifyTarget.note }}）</template>
      </p>
      <template v-if="verifyAccept">
        <a-form layout="vertical">
          <a-form-item label="映射到哪个区块（只能选白名单里的）">
            <a-select
              v-model:value="verifyForm.mappedBlockKey"
              style="width: 100%"
              show-search
              option-filter-prop="label"
              placeholder="选择区块类型"
              :options="blockOptions"
            />
          </a-form-item>
          <a-form-item label="建议填进槽位的内容（JSON，可留空）">
            <a-textarea v-model:value="verifyForm.propsSuggestionJson" :rows="6" />
            <p class="reference-site-page__muted">
              只允许字面文本，或者 {"$data":"某路径"} 这种门户数据绑定；后端会按这个区块的槽位表校验，
              写错了这里就会直接把中文原因报回来。
            </p>
            <p v-if="allowedSourcesOf(verifyForm.mappedBlockKey).length" class="reference-site-page__muted">
              「{{ blockName(verifyForm.mappedBlockKey) }}」可绑定的数据路径：
              {{ allowedSourcesOf(verifyForm.mappedBlockKey).join('、') }}
            </p>
            <p v-else-if="verifyForm.mappedBlockKey" class="reference-site-page__muted">
              「{{ blockName(verifyForm.mappedBlockKey) }}」没有可绑定的数据源，只能写字面文本。
            </p>
          </a-form-item>
        </a-form>
      </template>
      <a-form v-else layout="vertical">
        <a-form-item label="为什么不认（会留在这条记录上）">
          <a-input v-model:value="verifyForm.note" :maxlength="500" placeholder="例如：这一格其实是导航，白名单里的导航区块不该用它当首页主视觉" />
        </a-form-item>
        <p class="reference-site-page__muted">
          「不认」会把这条打回「需要新区块」那张清单，不是删掉——删了以后就没人知道模型这次错了多少。
        </p>
      </a-form>
    </a-modal>

    <!-- ---------------- 生成草稿页 ---------------- -->
    <a-modal
      v-model:open="applyOpen"
      title="把这些映射装成一份草稿页"
      :confirm-loading="applying"
      ok-text="生成草稿页"
      @ok="submitApply"
    >
      <a-form layout="vertical">
        <a-form-item label="用哪一页的结构">
          <a-select v-model:value="applyForm.referencePageId" style="width: 100%" :options="pageOptions" />
        </a-form-item>
        <a-form-item label="放到哪个站点">
          <a-select v-model:value="applyForm.siteId" style="width: 100%" :options="siteOptions" />
        </a-form-item>
        <a-form-item label="页面标题">
          <a-input v-model:value="applyForm.title" :maxlength="120" placeholder="例如：首页（参考站结构）" />
        </a-form-item>
        <a-form-item label="访问路径 slug">
          <a-input v-model:value="applyForm.slug" :maxlength="120" placeholder="留空由后端起一个" />
        </a-form-item>
      </a-form>
      <p class="reference-site-page__muted">
        生成的是 status=draft 的页面，发布仍然要你去「页面搭建」里自己按；没确认过的映射不会进来。
      </p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import {
  portalReferenceApi,
  referenceIsRunning,
  referenceModeLabel,
  designTokensOf,
  domSummaryOf,
  observedSectionsOf,
  propsSuggestionOf,
  sectionCountOf,
  REFERENCE_VIEWPORTS,
  type ApplyForm,
  type ReferenceEstimate,
  type ReferenceMapping,
  type ReferencePage,
  type ReferenceSite
} from '../../api/referenceSites'
import { portalPagesApi, type PortalBlockMeta } from '../../api/portalPages'
import { siteApi } from '../../api/workspace'
import { formatDateTime } from '../../utils/format'

/**
 * 参考站摄取任务视图（Spec §7）。
 *
 * 界面上刻意做到的三件事：
 * 1. 状态标签全部来自 GET /portal/reference-sites/statuses，一个字都不抄；
 * 2. 异步受理的动作用轮询跟到落定为止——按完按钮就弹「已完成」是最像成功的假通；
 * 3. 花钱的动作一律先预估再确认，包括「只有截图时让视觉模型看图」这一路（见 Spec §7.9）；
 *    能不能看图不是这里猜的，后端在预估里给中文原因，界面只负责把它显示出来。
 *
 * 唯一能写进线上的动作是「生成草稿页」，而它出的是 draft，发布仍归租户自己按。
 */

const EMPTY_STATUS_LABELS: Record<string, string> = {}

const statusLabels = ref<Record<string, string>>({ ...EMPTY_STATUS_LABELS })
const tasks = ref<ReferenceSite[]>([])
const loading = ref(false)
const statusFilter = ref<string | undefined>(undefined)

const blocks = ref<PortalBlockMeta[]>([])
const sites = ref<Array<{ id: number; name: string }>>([])

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`
})

const columns = [
  { title: '编号', dataIndex: 'id', key: 'id', width: 72 },
  { title: '来源网址', key: 'source', width: 260 },
  { title: '方式', key: 'mode', width: 120 },
  { title: '状态', key: 'status', width: 130 },
  { title: '已抓页数', dataIndex: 'pagesCrawled', key: 'pagesCrawled', width: 90 },
  { title: '最近一次结果', key: 'error', width: 260 },
  { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 110 },
  { title: '创建时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'op', width: 90, fixed: 'right' as const }
]

const pageColumns = [
  { title: '页面', key: 'url', width: 260 },
  { title: '三视口截图', key: 'shots', width: 260 },
  { title: '结构与 token', key: 'structure', width: 220 },
  { title: 'robots', key: 'robots', width: 110 },
  { title: '归纳出的分区', key: 'sections', width: 220 }
]

const mappingColumns = [
  { title: '观察到的区块', dataIndex: 'observedBlock', key: 'observedBlock', width: 180 },
  { title: '映射到', key: 'mappedBlockKey', width: 170 },
  { title: '模型置信度', key: 'confidence', width: 140 },
  { title: '建议内容', key: 'props', width: 220 },
  { title: '人工确认', key: 'verified', width: 140 },
  { title: '备注', key: 'note', width: 180 },
  { title: '操作', key: 'op', width: 130, fixed: 'right' as const }
]

const unmatchedColumns = [
  { title: '观察到的区块', dataIndex: 'observedBlock', key: 'observedBlock', width: 200 },
  { title: '为什么对不上', key: 'note', width: 380 },
  { title: '操作', key: 'op', width: 140 }
]

// ---------------- 详情 ----------------
const detailOpen = ref(false)
const detailLoading = ref(false)
const task = ref<ReferenceSite | null>(null)
const tab = ref('pages')
const pages = ref<ReferencePage[]>([])
const pagesLoading = ref(false)
/** 素材 id → /uploads/... 公开地址；截图列的 <img> 只能用这个，不能拿 id 拼 */
const shotUrls = ref<Record<number, string>>({})
const mappings = ref<ReferenceMapping[]>([])
const mappingsLoading = ref(false)
const unmatched = ref<ReferenceMapping[]>([])
const unmatchedLoading = ref(false)

const crawling = ref(false)
const estimating = ref(false)
const analyzing = ref(false)
const applying = ref(false)
const uploading = ref(false)
const estimate = ref<ReferenceEstimate | null>(null)

const analyzeOpen = ref(false)
const confirmChecked = ref(false)
const applyOpen = ref(false)

const viewports = REFERENCE_VIEWPORTS
const shotForm = reactive<{ referencePageId: number | null; viewport: string }>({
  referencePageId: null,
  viewport: 'desktop'
})
const applyForm = reactive<ApplyForm>({
  referencePageId: null,
  siteId: null,
  slug: '',
  title: ''
})

/** 任务在跑时的轮询：5 秒一次，最多跟 4 分钟。到点还没落定就如实说「还在跑」，不猜结果 */
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollLeft = 0

const statusOptions = computed(() =>
  Object.entries(statusLabels.value).map(([value, label]) => ({ value, label }))
)
const pageOptions = computed(() =>
  pages.value.map(page => ({
    value: page.id,
    label: page.url || `第 ${page.id} 号页面（截图）`
  }))
)
const viewportOptions = computed(() => viewports.map(item => ({ value: item.value, label: item.label })))
const blockOptions = computed(() =>
  blocks.value.map(block => ({ value: block.blockKey, label: `${block.name}（${block.blockKey}）` }))
)
const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

const detailTitle = computed(() => (task.value ? `摄取任务 #${task.value.id}` : '摄取任务'))

const estimateMessage = computed(() => {
  if (!estimate.value) return ''
  const base = `预计 ${estimate.value.estimatedTokens} token，本站剩余配额 ${estimate.value.remainingTokens} token`
  return estimate.value.notice ? `${base}。${estimate.value.notice}` : base
})

function statusLabel(status: string | null | undefined) {
  if (!status) return '未知'
  return statusLabels.value[status] || status
}

function statusColor(status: string) {
  if (status === 'done') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'needs_human') return 'orange'
  if (referenceIsRunning(status)) return 'blue'
  return 'default'
}

function blockName(blockKey: string | null | undefined) {
  if (!blockKey) return '未映射'
  const block = blocks.value.find(item => item.blockKey === blockKey)
  return block ? block.name : blockKey
}

/**
 * 某个区块可绑定的门户数据路径，取自 /portal/blocks 的 bindingSchema。
 *
 * 之所以在界面上列出来：后端拒「引用了不存在的数据源」时会把整张可用清单回在错误里，
 * 但那要等用户按一次确定才知道；提前列出来省一次往返，也免得照着示例猜路径名。
 */
function allowedSourcesOf(blockKey: string | null | undefined): string[] {
  if (!blockKey) return []
  const block = blocks.value.find(item => item.blockKey === blockKey)
  const allowed = block?.bindingSchema?.allowedSources
  return Array.isArray(allowed) ? allowed : []
}

function shotUrlOf(page: ReferencePage, field: 'shotDesktopId' | 'shotTabletId' | 'shotMobileId') {
  // 页行里只有素材 id，可显示的公开路径要按 id 去 /media 查回来的那张表里找。
  // 查不到就返回空串：a-image 会显占位错误，比硬拼一个打不开的链接诚实。
  const mediaId = page[field]
  return mediaId ? shotUrls.value[mediaId] || '' : ''
}

function sectionText(page: ReferencePage) {
  const count = sectionCountOf(page)
  if (count === null) return '暂无结构摘要（这张页没有被抓取过）'
  return `结构摘要：${count} 格`
}

function tokensText(page: ReferencePage) {
  const tokens = designTokensOf(page)
  if (!tokens) return '无 token 采样'
  const keys = Object.keys(tokens)
  return keys.length ? `token 采样：${keys.length} 组` : '无 token 采样'
}

function rolesOf(page: ReferencePage) {
  const sections = observedSectionsOf(page)
  if (!sections.length) return ''
  return sections
    .map(section => String(section.role ?? ''))
    .filter(Boolean)
    .join('、')
}

function propsText(mapping: ReferenceMapping) {
  const props = propsSuggestionOf(mapping)
  const keys = Object.keys(props)
  if (!keys.length) return '（无建议内容）'
  return keys.map(key => `${key}=${displayValue(props[key])}`).join('，')
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '（空）'
  if (typeof value === 'object') {
    const bound = (value as { $data?: string }).$data
    return bound ? `绑定门户数据：${bound}` : JSON.stringify(value)
  }
  return String(value)
}

function onTableChange(pagination: { current?: number; pageSize?: number }) {
  paginationConfig.current = pagination.current || 1
  paginationConfig.pageSize = pagination.pageSize || 10
}

async function reload() {
  await Promise.all([loadTasks(), loadStaticOptions()])
}

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = await portalReferenceApi.list(statusFilter.value)
    paginationConfig.total = tasks.value.length
  } catch (error) {
    tasks.value = []
    message.error((error as Error).message || '任务列表加载失败')
  } finally {
    loading.value = false
  }
}

async function loadStaticOptions() {
  try {
    const [blockList, siteList] = await Promise.all([portalPagesApi.blocks(), siteApi.list()])
    blocks.value = blockList || []
    // 站点列表由后端按登录态过滤（TenantGuard）：超管看到全部，租户只看到自己的
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
  } catch (error) {
    // 区块表与站点表只影响下拉可选值；拿不到就报错，但不把已经加载的列表变成空表
    message.error((error as Error).message || '区块/站点列表加载失败')
  }
}

// ---------------- 新建 ----------------
const createOpen = ref(false)
const createLoading = ref(false)
const createForm = reactive<{ mode: string; sourceUrl: string; maxPages: number; obeyRobots: boolean }>({
  mode: 'screenshot_upload',
  sourceUrl: '',
  maxPages: 3,
  obeyRobots: true
})

function openCreateModal() {
  createForm.mode = 'screenshot_upload'
  createForm.sourceUrl = ''
  createForm.maxPages = 3
  createForm.obeyRobots = true
  createOpen.value = true
}

async function createTask() {
  if (createForm.mode === 'url' && !createForm.sourceUrl.trim()) {
    message.warning('按网址抓取必须填参考站地址')
    return
  }
  createLoading.value = true
  try {
    const created = await portalReferenceApi.create({
      mode: createForm.mode,
      sourceUrl: createForm.sourceUrl.trim() || null,
      maxPages: createForm.maxPages,
      obeyRobots: createForm.obeyRobots
    })
    createOpen.value = false
    message.success(
      created.mode === 'url' ? '任务已创建，点「审阅」后再按「开始抓取」才会发请求' : '任务已创建，请上传参考站截图'
    )
    await loadTasks()
    openTask(created.id)
  } catch (error) {
    message.error((error as Error).message || '创建失败')
  } finally {
    createLoading.value = false
  }
}

// ---------------- 详情 ----------------
/** refreshDetail 既要能按 id 拉，也要能在轮询里沿用当前 id，所以把 id 单独存一份 */
let currentId = 0

async function openTask(id: number) {
  detailOpen.value = true
  tab.value = 'pages'
  estimate.value = null
  currentId = id
  task.value = null
  pages.value = []
  mappings.value = []
  unmatched.value = []
  shotUrls.value = {}
  await refreshDetail()
  startPollIfNeeded()
}

async function refreshDetail() {
  if (!currentId) return
  detailLoading.value = true
  try {
    task.value = await portalReferenceApi.get(currentId)
    await Promise.all([loadPages(), loadMappings()])
  } catch (error) {
    message.error((error as Error).message || '任务加载失败')
  } finally {
    detailLoading.value = false
  }
}

function startPollIfNeeded() {
  stopPoll()
  if (!task.value || !referenceIsRunning(task.value.status)) return
  pollLeft = 48
  let previous = signatureOf(task.value)
  let stalledFor = 0
  pollTimer = setInterval(async () => {
    pollLeft -= 1
    if (pollLeft <= 0) {
      stopPoll()
      message.warning('任务还在后台执行，暂时没有新进展；稍后再点「刷新进度」看看')
      return
    }
    try {
      const latest = await portalReferenceApi.get(currentId)
      task.value = latest
      if (!referenceIsRunning(latest.status)) {
        stopPoll()
        await Promise.all([loadPages(), loadMappings()])
        loadTasks()
        return
      }
      // 截图服务没起时后端会「降级不失败」：状态停在结构归纳中、原因写在 error_message 里，
      // 之后不会再变。连着 6 次（30 秒）一模一样就别继续问了，把用户引去看那条原因。
      if (signatureOf(latest) === previous) {
        stalledFor += 1
        if (stalledFor >= 6) {
          stopPoll()
          message.warning('这段时间任务没有推进。如果它停在「结构归纳中」并带着「截图服务…」这类说明，'
            + '那是它在等你补料或等服务上线，不是还在跑')
        }
      } else {
        previous = signatureOf(latest)
        stalledFor = 0
      }
    } catch (error) {
      stopPoll()
      message.error((error as Error).message || '进度刷新失败')
    }
  }, 5000)
}

/** 判断「有没有进展」看的三个字段：状态、已抓页数、后端写下的原因 */
function signatureOf(task: ReferenceSite) {
  return `${task.status}|${task.pagesCrawled ?? 0}|${task.errorMessage ?? ''}`
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function loadPages() {
  if (!currentId) return
  pagesLoading.value = true
  try {
    pages.value = await portalReferenceApi.pages(currentId)
    if (shotForm.referencePageId === null && pages.value.length) {
      shotForm.referencePageId = pages.value[0].id
    }
    loadShotUrls()
  } catch (error) {
    pages.value = []
    message.error((error as Error).message || '页面列表加载失败')
  } finally {
    pagesLoading.value = false
  }
}

/**
 * 把截图素材的公开地址一次性取回来。
 *
 * 这一路失败不清空页面列表：截图显不出来只是少一格预览，结构/映射/生成草稿仍然可操作，
 * 让一个次要的图床查询把整个抽屉变成错误页是不对的。
 */
async function loadShotUrls() {
  if (!pages.value.some(page => page.shotDesktopId || page.shotTabletId || page.shotMobileId)) return
  try {
    const result = await portalReferenceApi.shotMedia()
    const map: Record<number, string> = {}
    for (const item of result?.records || []) {
      if (item && item.id && item.url) map[item.id] = item.url
    }
    shotUrls.value = map
  } catch (error) {
    shotUrls.value = {}
  }
}

async function loadMappings() {
  if (!currentId) return
  mappingsLoading.value = true
  unmatchedLoading.value = true
  try {
    mappings.value = await portalReferenceApi.mappings(currentId)
  } catch (error) {
    mappings.value = []
    message.error((error as Error).message || '映射列表加载失败')
  } finally {
    mappingsLoading.value = false
  }
  try {
    unmatched.value = await portalReferenceApi.unmatched(currentId)
  } catch (error) {
    unmatched.value = []
  } finally {
    unmatchedLoading.value = false
  }
}

async function startCrawl() {
  if (!currentId) return
  crawling.value = true
  try {
    task.value = await portalReferenceApi.crawl(currentId)
    message.success('抓取已受理，正在后台执行；进度看这里')
    await Promise.all([loadPages(), loadMappings()])
    startPollIfNeeded()
    loadTasks()
  } catch (error) {
    message.error((error as Error).message || '抓取启动失败')
  } finally {
    crawling.value = false
  }
}

async function runEstimate() {
  if (!currentId) return
  estimating.value = true
  try {
    estimate.value = await portalReferenceApi.analyzeEstimate(currentId)
  } catch (error) {
    estimate.value = null
    message.error((error as Error).message || '预估失败')
  } finally {
    estimating.value = false
  }
}

function openAnalyzeModal() {
  if (!estimate.value) {
    // 决策 D4 的界面落点：没有预估就不给确认框，别让运营闭着眼睛点掉两次付费调用
    message.warning('请先点「先估算消耗」，看过预估 token 再摄取')
    return
  }
  confirmChecked.value = false
  analyzeOpen.value = true
}

async function runAnalyze() {
  if (!currentId || !confirmChecked.value) return
  analyzing.value = true
  try {
    task.value = await portalReferenceApi.analyze(currentId, true)
    analyzeOpen.value = false
    message.success('AI 摄取已受理，正在后台跑两步模型')
    startPollIfNeeded()
    loadTasks()
  } catch (error) {
    message.error((error as Error).message || 'AI 摄取启动失败')
  } finally {
    analyzing.value = false
  }
}

// ---------------- 上传截图 ----------------
/** 交给 a-upload 的 beforeUpload：返回 false 表示不走它自带的上传，改由我们带 viewport 参数发出去 */
function pickShot(file: File) {
  uploadShot(file)
  return false
}

async function uploadShot(file: File) {
  if (!currentId) return
  if (!shotForm.viewport) {
    message.warning('请先选这张截图是哪个视口的')
    return
  }
  uploading.value = true
  try {
    const result = await portalReferenceApi.uploadShot(currentId, shotForm.viewport, file, shotForm.referencePageId)
    message.success(`已上传${labelOfViewport(result.viewport)}截图`)
    await loadPages()
  } catch (error) {
    message.error((error as Error).message || '截图上传失败')
  } finally {
    uploading.value = false
  }
}

function labelOfViewport(viewport: string) {
  return viewports.find(item => item.value === viewport)?.label || viewport
}

// ---------------- 人工确认映射 ----------------
const verifyOpen = ref(false)
const verifying = ref(false)
const verifyAccept = ref(true)
const verifyTarget = ref<ReferenceMapping | null>(null)
const verifyForm = reactive<{ mappedBlockKey: string | null; propsSuggestionJson: string; note: string }>({
  mappedBlockKey: null,
  propsSuggestionJson: '',
  note: ''
})

function openVerifyModal(mapping: ReferenceMapping, accept: boolean) {
  verifyTarget.value = mapping
  verifyAccept.value = accept
  verifyForm.mappedBlockKey = mapping.mappedBlockKey || null
  verifyForm.propsSuggestionJson = mapping.propsSuggestionJson || ''
  verifyForm.note = mapping.note || ''
  verifyOpen.value = true
}

async function submitVerify() {
  if (!currentId || !verifyTarget.value) return
  if (verifyAccept.value && !verifyForm.mappedBlockKey) {
    message.warning('请选择映射到哪个区块')
    return
  }
  verifying.value = true
  try {
    await portalReferenceApi.verify(currentId, verifyTarget.value.id, {
      mappedBlockKey: verifyAccept.value ? verifyForm.mappedBlockKey : null,
      propsSuggestionJson: verifyAccept.value ? verifyForm.propsSuggestionJson || null : null,
      humanVerified: verifyAccept.value,
      note: verifyForm.note || null
    })
    verifyOpen.value = false
    message.success(verifyAccept.value ? '这条映射已确认' : '已打回「需要新区块」')
    await Promise.all([loadMappings(), loadTasks()])
    task.value = await portalReferenceApi.get(currentId)
  } catch (error) {
    message.error((error as Error).message || '确认失败')
  } finally {
    verifying.value = false
  }
}

// ---------------- 生成草稿页 ----------------
function openApplyModal() {
  applyForm.referencePageId = pages.value[0]?.id ?? null
  applyForm.siteId = sites.value.length === 1 ? sites.value[0].id : null
  applyForm.slug = ''
  applyForm.title = task.value?.sourceUrl ? `参考 ${task.value.sourceUrl}` : '参考站结构页'
  applyOpen.value = true
}

async function submitApply() {
  if (!currentId) return
  applying.value = true
  try {
    const result = await portalReferenceApi.apply(currentId, { ...applyForm })
    applyOpen.value = false
    message.success(
      `草稿页已生成：${result.blocks} 个区块进来，${result.skippedUnverified} 条没确认的映射被跳过。` +
        '请到「页面搭建」核对内容后再发布'
    )
    await Promise.all([loadTasks(), refreshDetail()])
  } catch (error) {
    message.error((error as Error).message || '生成草稿页失败')
  } finally {
    applying.value = false
  }
}

onMounted(async () => {
  try {
    const labels = await portalReferenceApi.statusLabels()
    statusLabels.value = { ...EMPTY_STATUS_LABELS, ...labels }
  } catch (error) {
    message.error((error as Error).message || '状态词表加载失败')
  }
  await Promise.all([loadTasks(), loadStaticOptions()])
})

onUnmounted(stopPoll)
</script>

<style scoped lang="less">
.reference-site-page {
  padding: 16px;

  &__filter {
    margin-bottom: 12px;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
  }

  &__notice {
    margin-bottom: 12px;
  }

  &__muted {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  &__text {
    display: inline-block;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }

  &__error {
    color: #cf1322;
    display: inline-block;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }

  &__shots {
    display: flex;
    gap: 12px;
  }

  &__shot {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
}
</style>
