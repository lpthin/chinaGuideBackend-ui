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

    <a-alert v-if="staticOptionsNote" type="warning" show-icon class="reference-site-page__notice">
      <template #message>{{ staticOptionsNote }}</template>
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
          <a-input-number v-model:value="createForm.maxPages" :min="1" :max="maxPagesLimit" />
          <span class="reference-site-page__muted">
            个页面（1–{{ maxPagesLimit }}，超出后端会直接按 {{ maxPagesLimit }} 收）。
            模板站常有 9~11 条路由，卡在 6 页的表现是「清单列了十条、抓完只剩六页」，看不出是漏了还是没有
          </span>
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
            <!-- 重跑一趟时后端不会清掉上一趟的结束时间（那一列只在终态写）：还在跑就别显示它，
                 否则界面拿着上一次的结束时刻说这一趟「已经结束了」 -->
            <a-descriptions-item v-if="!referenceIsRunning(task.status)" label="结束时间">
              {{ formatDateTime(task.finishedAt) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="task.errorMessage" label="最近一次结果" :span="3">
              <span class="reference-site-page__error">{{ task.errorMessage }}</span>
            </a-descriptions-item>
          </a-descriptions>

          <a-space style="margin-top: 16px" wrap>
            <a-button v-if="canAddRoute" @click="openRouteModal">补录一条路由</a-button>
            <a-button v-if="canDiscover" :loading="discovering" @click="runDiscover">只列路由清单</a-button>
            <a-button v-if="canCrawl" :loading="crawling" type="primary" @click="startCrawl">
              {{ selectedPageIds.length ? `抓取勾中的 ${selectedPageIds.length} 页` : '开始抓取' }}
            </a-button>
            <a-button :loading="estimating" @click="runEstimate">先估算消耗</a-button>
            <a-button type="primary" :disabled="!estimate" :loading="analyzing" @click="openAnalyzeModal">
              开始 AI 摄取
            </a-button>
            <a-button :disabled="task.status !== 'done'" @click="openApplyModal">生成草稿页</a-button>
            <a-button :loading="detailLoading" @click="refreshDetail">刷新进度</a-button>
          </a-space>
          <p class="reference-site-page__muted">
            抓取分两步：<b>只列路由清单</b>不抓页面、只读一次首页，把这一站有哪几条路由列出来（不花钱、不改状态）；
            勾完再<b>开始抓取</b>。一条都不勾就是老行为——从首页顺着链接自己找，抓满上面那个页数上限。
            <b>补录一条路由</b>给「页面上没有入口、只能靠代码跳过去」的那些页用，它只往清单里加一行，不发请求。
          </p>
          <p class="reference-site-page__muted">
            「先估算消耗」只算不调用模型；「开始 AI 摄取」会真的产生两次 AI 调用，但这一族<b>不进租户的
            token 账单</b>（参考站拆解是平台自己的研发动作，V142 起由平台承担），所以预估数字只是给我们看成本，
            不是向客户收钱的报价。必须先看过预估再勾选确认这条规矩照旧。
            抓取与 AI 摄取都在后台排队执行，这里的进度是靠刷新看出来的，不是按了就算完成的。
          </p>
          <p class="reference-site-page__muted">
            停在「失败」或「需人工处理」的任务<b>不用新建一个重做</b>：已抓到的页面与已上传的截图都还在这个任务里，
            按「最近一次结果」那一栏说的补好料（起截图服务、去掉打不开的路由、或改地址），再点一次上面那两个按钮就行。
            而「结构归纳中」「区块映射中」迟迟不动时，先确认后端有没有重启过——那一趟的执行者跟着进程一起没了，
            界面只能等下一次启动把它收尾。
          </p>

          <!-- 后端给了 notice 就是「这一轮跑不了 / 不该跑」，用 warning 而不是 info：
               它念的是拒绝理由，用信息色等于把闸说成提示 -->
          <a-alert
            v-if="estimate"
            :type="estimate.notice ? 'warning' : 'info'"
            show-icon
            style="margin-top: 8px"
            :message="estimateMessage"
          />
          <a-alert
            v-if="referenceIsRunning(task.status)"
            type="warning"
            show-icon
            style="margin-top: 8px"
            message="任务正在后台执行，这里每 5 秒自动刷新一次；关闭抽屉不影响它继续跑"
          />

          <a-tabs v-model:activeKey="tab" style="margin-top: 16px">
            <a-tab-pane key="pages" :tab="`路由清单（${crawledCount} / ${pages.length}）`">
              <a-alert
                v-if="vocabError"
                type="warning"
                show-icon
                style="margin-bottom: 12px"
                :message="`路由清单的词表没读到，下面几列显示的是后端原值而不是中文标签（${vocabError}）。`
                  + `清单本身照样能看，重试请点页面顶部的「刷新」`"
              />
              <a-alert
                v-if="hydratedRoutes"
                type="info"
                show-icon
                style="margin-bottom: 12px"
                :message="`${hydratedRoutes} 条路由的版面是 JS 渲染出来的：HTTP 原文只是一具壳，链接与分区都取自浏览器渲染后的版面。`
                  + `本地截图服务不可用时这一路会退化成「一条都没发现」，那种情况下结论写在上面的「最近一次结果」里`"
              />
              <a-alert
                v-if="deadRoutes.length"
                type="warning"
                show-icon
                style="margin-bottom: 12px"
                :message="`${deadRoutes.length} 条路由在清单里但抓不开，它们的抓取状态那一格写着为什么。`
                  + `死链仍然留在清单里（那是这一站的真实结构），但不会被当成页入库、也不进摘要与草稿`"
              />
              <a-table
                class="reference-site-page__routes"
                :data-source="pages"
                :columns="pageColumns"
                :loading="pagesLoading"
                :pagination="false"
                :row-selection="pageSelection"
                row-key="id"
                size="small"
                :scroll="{ x: 1420 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'route'">
                    <div class="reference-site-page__route">{{ record.routePath || record.url || '—' }}</div>
                    <div v-if="record.pageName" class="reference-site-page__muted">{{ record.pageName }}</div>
                    <div v-else-if="record.url" class="reference-site-page__muted">{{ record.url }}</div>
                  </template>
                  <template v-else-if="column.key === 'provenance'">
                    <div>{{ vocabLabel('renderMode', record.renderMode) }}</div>
                    <div class="reference-site-page__muted">{{ vocabLabel('linkSource', record.linkSource) }}</div>
                  </template>
                  <template v-else-if="column.key === 'crawlState'">
                    <a-tag :color="crawlStateColor(record.crawlState)">
                      {{ vocabLabel('crawlState', record.crawlState) }}
                    </a-tag>
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
                    <a-tag v-else-if="record.fetchedAt" color="green">允许</a-tag>
                    <span v-else class="reference-site-page__muted">还没抓，没判过</span>
                  </template>
                  <template v-else-if="column.key === 'sections'">
                    <a-tooltip v-if="rolesOf(record)" :title="rolesOf(record)">
                      <span>{{ rolesOf(record) }}</span>
                    </a-tooltip>
                    <span v-else class="reference-site-page__muted">还没归纳</span>
                  </template>
                </template>
                <template #emptyText>
                  <a-empty description="清单还是空的：网址任务点「只列路由清单」或直接「开始抓取」，截图任务在下面上传" />
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

            <a-tab-pane key="unmatched" :tab="`暂未对上现有区块（${unmatchedTrueGapCount}）`">
              <a-alert
                type="info"
                show-icon
                style="margin-bottom: 12px"
                :message="`对不上的观察区块归并后 ${unmatchedGroups.length} 类，其中 ${unmatchedTrueGapCount} 类这一趟没对上任何区块（其余 ${unmatchedGroups.length - unmatchedTrueGapCount} 类我们有这个能力，只是这一趟没再映射）`"
                :description="unmatchedExplainText"
              />
              <a-table
                :data-source="unmatchedGroups"
                :columns="unmatchedColumns"
                :loading="unmatchedLoading"
                :pagination="false"
                row-key="observedBlock"
                size="small"
                :scroll="{ x: 900 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'kind'">
                    <a-tag v-if="record.capabilityKnown" color="orange">已有能力，这一趟重复声明</a-tag>
                    <a-tag v-else color="red">这一趟没有区块对上</a-tag>
                  </template>
                  <template v-else-if="column.key === 'paths'">
                    {{ record.paths.join('、') || '—' }}（{{ record.paths.length }} 页 / {{ record.rowCount }} 条）
                  </template>
                  <template v-else-if="column.key === 'note'">{{ record.note || '—' }}</template>
                </template>
                <template #emptyText>
                  <a-empty description="没有对不上的区块" />
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="package" :tab="`拆出来的模板证据${packageTabSuffix}`">
              <a-space style="margin-bottom: 12px" wrap>
                <a-button :loading="packageLoading" @click="loadPackage">
                  {{ templatePackage ? '重新载入模板包' : '载入模板包' }}
                </a-button>
                <span class="reference-site-page__muted">
                  这一份就是「出方案时喂给模型」的那份东西，界面上显示它不是为了好看：
                  这里看得见、模型读不到，那才是最难发现的一种能力浪费。它只读，不花钱，也不含对方的文案与图片地址。
                </span>
              </a-space>

              <template v-if="templatePackage">
                <a-descriptions :column="3" size="small" bordered>
                  <a-descriptions-item label="认出的家族">{{ packageFamilyText }}</a-descriptions-item>
                  <a-descriptions-item label="清单里的路由">{{ templatePackage.routeCount }} 条</a-descriptions-item>
                  <a-descriptions-item label="有版面的路由">{{ templatePackage.crawledCount }} 条</a-descriptions-item>
                  <a-descriptions-item label="站级 token" :span="2">
                    {{ siteTokenText }}
                  </a-descriptions-item>
                  <a-descriptions-item label="段级取值不一致">{{ variedTokenText }}</a-descriptions-item>
                </a-descriptions>

                <a-alert
                  type="info"
                  show-icon
                  style="margin-top: 12px"
                  message="段级那一半只是证据，不会变成站点样式：能被搬进真的样式变量的只有浏览器量出来的站级取值"
                  description="「这一格里出现过 12px」和「这一站的圆角是 12px」可信度差一个量级，所以它们分列在两处显示。"
                />

                <a-divider orientation="left">每一格装得下什么（槽位形状）</a-divider>
                <a-table
                  :data-source="slotShapeRows"
                  :columns="slotShapeColumns"
                  :pagination="false"
                  row-key="rowKey"
                  size="small"
                  :scroll="{ x: 900 }"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'slots'">
                      <div v-for="(slot, index) in record.slots" :key="index" class="reference-site-page__slot">
                        <span class="reference-site-page__slot-key">{{ slot.key }}</span>
                        {{ vocabLabel('slotKind', slot.kind) }}
                        <span v-if="slot.isArray">· 按数组给</span>
                        <span v-if="slot.imageSpec?.w || slot.imageSpec?.h">
                          · 图位约 {{ slot.imageSpec.w }}×{{ slot.imageSpec.h }}
                        </span>
                        <span v-if="slot.imageSpec?.prompt">· 需求单描述：{{ slot.imageSpec.prompt }}</span>
                        <span v-if="slot.requiredSignal" class="reference-site-page__muted">
                          · {{ vocabLabel('requiredSignal', slot.requiredSignal) }}
                        </span>
                      </div>
                      <div v-if="record.slotNote" class="reference-site-page__error">{{ record.slotNote }}</div>
                    </template>
                  </template>
                  <template #emptyText>
                    <a-empty description="还没有槽位形状：抓取那一步（T4 之后）才会产出" />
                  </template>
                </a-table>
                <p class="reference-site-page__muted">
                  「必填」那一行说的是<b>必填是从哪一路看出来的</b>，不是「这个字段必须填」：
                  我们的表单必填归服务端写死，区块侧没有必填开关槽。它最终的去处是前采里问客户的一道题。
                </p>

                <a-divider orientation="left">这一站用过的枚举组（栏目候选的原料）</a-divider>
                <a-table
                  :data-source="vocabularyRows"
                  :columns="vocabularyColumns"
                  :pagination="false"
                  row-key="rowKey"
                  size="small"
                  :scroll="{ x: 900 }"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'items'">
                      <a-tag v-for="item in record.items" :key="item.slug || item.label">{{ item.label || item.slug }}</a-tag>
                    </template>
                    <template v-else-if="column.key === 'seenOn'">
                      <span class="reference-site-page__muted">{{ (record.seenOn || []).join('、') }}</span>
                    </template>
                  </template>
                  <template #emptyText>
                    <a-empty description="没有认出成组的枚举（下拉 / 单选复选 / 筛选 tabs / 卡片栅格标题）" />
                  </template>
                </a-table>
                <p class="reference-site-page__muted">
                  同一组枚举常在三处复用，所以带「出现在哪几条路由」。<b>它们是候选，不是栏目</b>：
                  真正建栏目要过内容完整度与词表闸，这里只是把原料递过去。
                </p>

                <a-divider orientation="left">看得见的交互形状</a-divider>
                <div v-if="templatePackage.interactionHints.length" class="reference-site-page__hints">
                  <a-tag v-for="hint in templatePackage.interactionHints" :key="hint.kind" color="blue">
                    {{ vocabLabel('interaction', hint.kind) }}（{{ hint.seenOn.length }} 条路由）
                  </a-tag>
                </div>
                <p v-else class="reference-site-page__muted">
                  没有记到任何交互形状。这一栏是「有就记、没有就不记」，空白不代表对方站点没有动效，
                  只代表这一次抓取没看见——它不是待办清单。
                </p>
              </template>

              <a-empty v-else description="还没载入：这一栏是只读的取证快照，载入它不改变任务状态" />
            </a-tab-pane>
          </a-tabs>
        </template>
      </a-spin>
    </a-drawer>

    <!-- ---------------- 人工补录一条路由 ---------------- -->
    <a-modal
      v-model:open="routeOpen"
      title="补录一条路由"
      ok-text="加进清单"
      :confirm-loading="addingRoute"
      @ok="submitRoute"
    >
      <a-form layout="vertical">
        <a-form-item label="站内路径">
          <a-input v-model:value="routeForm.path" :maxlength="200" placeholder="/appointment" />
          <p class="reference-site-page__muted">
            只填路径，以 <b>/</b> 开头。地址由后端按参考站本站的 origin 拼：贴完整 URL 就意味着这里要再判一次
            SSRF 与跨站，而那一判在出站闸那里已经有一份了，不该抄第二份。
          </p>
        </a-form-item>
        <a-form-item label="这一页叫什么（可选，只用于清单上认行）">
          <a-input v-model:value="routeForm.pageName" :maxlength="100" placeholder="例如：预约表单" />
        </a-form-item>
      </a-form>
      <p class="reference-site-page__muted">
        补录只往清单里加一行（来源写「人工补录」），不发请求；要抓它还得回列表勾上再按「开始抓取」，
        那一趟同样要过 robots 与限流，不会因为是人写的就开后门。
      </p>
    </a-modal>

    <!-- ---------------- AI 摄取确认：烧钱动作必须显式确认 ---------------- -->
    <a-modal
      v-model:open="analyzeOpen"
      title="确认让 AI 读这个参考站？"
      :ok-text="estimate?.notice ? '这一轮不会受理' : confirmChecked ? '确认并开始摄取' : '请先勾选确认'"
      :ok-button-props="{ disabled: !confirmChecked || !!estimate?.notice, loading: analyzing }"
      @ok="runAnalyze"
    >
      <p v-if="estimate">
        预计消耗 <b>{{ estimate.estimatedTokens }}</b> token（结构归纳 + 区块映射两步加起来），
        这一族由平台承担、<b>不计入该租户的额度</b>。
      </p>
      <p v-else class="reference-site-page__error">还没有取到预估，请先点「先估算消耗」。</p>
      <p v-if="estimate && estimate.notice" class="reference-site-page__error">
        {{ estimate.notice }}
      </p>
      <p class="reference-site-page__muted">
        这一步产出的是「观察到的结构 + 映射建议」，还要你逐条确认，最后按「生成草稿页」才会出现一份草稿；
        草稿不发布，访客看不到。
      </p>
      <a-checkbox v-model:checked="confirmChecked">我已看过预估，确认这次调用会产生平台的 token 消耗</a-checkbox>
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
          「不认」会把这条打回「暂未对上现有区块」那张清单，不是删掉——删了以后就没人知道模型这次错了多少。
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
  referenceLabel,
  referenceModeLabel,
  observedSectionsOf,
  propsSuggestionOf,
  sectionCountOf,
  tokenLayersOf,
  REFERENCE_MAX_PAGES_LIMIT,
  REFERENCE_VIEWPORTS,
  type ApplyForm,
  type ReferenceEstimate,
  type ReferenceMapping,
  type ReferencePage,
  type ReferenceSite,
  type ReferenceVocabularies,
  type TemplatePackage,
  type UnmatchedGroup
} from '../../api/referenceSites'
import { portalPagesApi, type PortalBlockMeta } from '../../api/portalPages'
import { siteApi } from '../../api/workspace'
import { formatDateTime } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'

/**
 * 参考站摄取任务视图（Spec §7）。
 *
 * 界面上刻意做到的四件事：
 * 1. 状态与词表标签全部来自 GET /portal/reference-sites/{statuses,vocabularies}，一个字都不抄；
 *    认不出的取值原样显示——显示空白会让人以为「这格没值」，而它其实是「有值，只是这份词表旧了」；
 * 2. 异步受理的动作用轮询跟到落定为止——按完按钮就弹「已完成」是最像成功的假通；
 * 3. 花钱的动作一律先预估再确认，包括「只有截图时让视觉模型看图」这一路（见 Spec §7.9）；
 *    能不能看图不是这里猜的，后端在预估里给中文原因，界面只负责把它显示出来。
 * 4. 抓取拆成「只列路由清单」与「勾完再抓」两步（Spec-E T2）：SPA 模板站的原文里根本没有导航，
 *    让工具自己决定抓哪几页，结果就是「清单明明十条、抓完只剩六页」而没人知道差在哪。
 *
 * 唯一能写进线上的动作是「生成草稿页」，而它出的是 draft，发布仍归租户自己按。
 */

const EMPTY_STATUS_LABELS: Record<string, string> = {}

const auth = useAuthStore()
const canBuild = computed(() => auth.hasPermission('portal:build:manage'))

/** 页数上限的真源在后端 clamp；这里只是把输入框的上限对齐，免得填 20 存成 12 而没人知道 */
const maxPagesLimit = REFERENCE_MAX_PAGES_LIMIT

const statusLabels = ref<Record<string, string>>({ ...EMPTY_STATUS_LABELS })
const vocabularies = ref<ReferenceVocabularies | null>(null)
/** 词表读不到时界面仍然照跑（标签退回后端原值），但要把「这份词表旧了/没读到」说在明处 */
const vocabError = ref<string | null>(null)
const tasks = ref<ReferenceSite[]>([])
const loading = ref(false)
const statusFilter = ref<string | undefined>(undefined)

const blocks = ref<PortalBlockMeta[]>([])
const sites = ref<Array<{ id: number; name: string }>>([])
const staticOptionsNote = ref('')

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

/**
 * 路由清单：一条路由一行，从「只列清单」到「抓完了」都写在这一行上。
 *
 * <p>刻意不给「未抓」的页算失败：清单里有 10 条、抓开 6 条是这一站的真实结构（页脚那条 /contact
 * 常常就是死的），差别必须落在「抓取状态」那一格里，而不是变成一次红色报错。</p>
 */
const pageColumns = [
  { title: '路由', key: 'route', width: 220 },
  { title: '版面与来源', key: 'provenance', width: 240 },
  { title: '抓取状态', key: 'crawlState', width: 200 },
  { title: '三视口截图', key: 'shots', width: 260 },
  { title: '结构与 token', key: 'structure', width: 220 },
  { title: 'robots', key: 'robots', width: 130 },
  { title: '归纳出的分区', key: 'sections', width: 200 }
]

const slotShapeColumns = [
  { title: '在哪条路由', dataIndex: 'route', key: 'route', width: 180 },
  { title: '第几格', dataIndex: 'order', key: 'order', width: 80 },
  { title: '元素', dataIndex: 'tag', key: 'tag', width: 90 },
  { title: '这一格装得下什么', key: 'slots', width: 520 }
]

const vocabularyColumns = [
  { title: '组名', dataIndex: 'key', key: 'key', width: 160 },
  { title: '从哪种形状读出来的', dataIndex: 'source', key: 'source', width: 160 },
  { title: '取值', key: 'items', width: 380 },
  { title: '出现在哪几条路由', key: 'seenOn', width: 220 }
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
  { title: '定性', key: 'kind', width: 200 },
  { title: '出现在哪几页', key: 'paths', width: 260 },
  { title: '为什么对不上', key: 'note', width: 320 }
]

// ---------------- 详情 ----------------
const detailOpen = ref(false)
const detailLoading = ref(false)
const task = ref<ReferenceSite | null>(null)
const tab = ref('pages')
const pages = ref<ReferencePage[]>([])
const pagesLoading = ref(false)
/** 素材 id → 后端现签的可显示地址；截图列的 <img> 只能用这个，不能拿 id 拼 */
const shotUrls = ref<Record<number, string>>({})
const mappings = ref<ReferenceMapping[]>([])
const mappingsLoading = ref(false)
const unmatchedGroups = ref<UnmatchedGroup[]>([])
const unmatchedLoading = ref(false)
/**
 * 真缺口类数：这一趟没对上任何区块的那些。标签页上的数字只用它，不用行数也不用归并后的总类数。
 *
 * <p>这一栏原来叫「需要新区块」。2026-09-28 第三家参考站（任务 49，vue3 模板）把它喊错了：
 * 清单里只剩一类「全站菜单导航列表」，而导航在我们这边是 site-header / utility-bar /
 * breadcrumb / site-footer 四块加栏目派生页面的能力——模型只是对不到「整页菜单」这一形，
 * 不等于要新增一块。标签写着「需要新区块」就等于替读的人做完了决定，那是界面不许的谎报。
 * 但清单本身必须留着：#100 补的那四类（辅助条、面包屑、参考文献、相关推荐）正是从这里长出来的，
 * 只是「要不要新增」由人判，界面上只说「模型没对上」这一件事实。</p>
 */
const unmatchedTrueGapCount = computed(
  () => unmatchedGroups.value.filter(group => !group.capabilityKnown).length
)
/** 归并前的行数，只用来把「按条数会夸大多少」说给人听，不上任何标题 */
const unmatchedRowCount = computed(() =>
  unmatchedGroups.value.reduce((sum, group) => sum + group.rowCount, 0)
)
const unmatchedExplainText = computed(
  () =>
    `为什么按类不按条：这一趟有 ${unmatchedRowCount.value} 条对不上，归并成 ${unmatchedGroups.value.length} 类——` +
    '页头页脚这类站级公共格子几乎每页都会被重新看一遍，按条报数就会把「缺 ' +
    `${unmatchedTrueGapCount.value} 类」说成「缺 ${unmatchedRowCount.value} 类」，那是决定要不要新增区块时最贵的一种误判。` +
    '逐条改映射在「区块映射」那一栏，那里每条都在。'
)

const crawling = ref(false)
const discovering = ref(false)
const addingRoute = ref(false)
const routeOpen = ref(false)
const routeForm = reactive<{ path: string; pageName: string }>({ path: '', pageName: '' })
/** 勾选要抓的那几条路由。只在还能开始抓取的任务上有意义，见 pageSelection 的注释 */
const selectedPageIds = ref<number[]>([])
const estimating = ref(false)
const analyzing = ref(false)
const applying = ref(false)
const uploading = ref(false)
const estimate = ref<ReferenceEstimate | null>(null)

/**
 * 模板包：不随任务自动载入，是这一栏里一个显式的只读快照。
 *
 * <p>为什么不在打开抽屉时顺手拉：一份包里带着每页的槽位形状，抽屉每次轮询都重取一遍毫无意义；
 * 更重要的是「载入模板包」不该给人「它在推进什么」的错觉——它什么都不推进。</p>
 */
const templatePackage = ref<TemplatePackage | null>(null)
const packageLoading = ref(false)

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
    label: page.routePath || page.url || `第 ${page.id} 号页面（截图）`
  }))
)
const viewportOptions = computed(() => viewports.map(item => ({ value: item.value, label: item.label })))
const blockOptions = computed(() =>
  blocks.value.map(block => ({ value: block.blockKey, label: `${block.name}（${block.blockKey}）` }))
)
const siteOptions = computed(() => sites.value.map(site => ({ value: site.id, label: site.name })))

const detailTitle = computed(() => (task.value ? `摄取任务 #${task.value.id}` : '摄取任务'))

/** 后端只有两个模式常量，且认不出家族时直接不写这一格：所以「没写」要说成没认出，不能说成某一种 */
const packageFamilyText = computed(() => {
  const family = templatePackage.value?.family
  return family ? family : '没认出固定家族（按通用判据处理，这一路同样能出结构）'
})

const siteTokenText = computed(() => {
  const tokens = templatePackage.value?.tokens
  const keys = tokens ? Object.keys(tokens) : []
  return keys.length ? `${keys.length} 项（只有这一层会上身成站点样式）` : '没有站级取值：sidecar 没在线，或这一页没被渲染采样'
})

const variedTokenText = computed(() => {
  const keys = templatePackage.value?.tokenVariedKeys || []
  return keys.length ? `${keys.length} 项各格不一致：${keys.join('、')}` : '各格一致'
})

const packageTabSuffix = computed(() => {
  if (!templatePackage.value) return ''
  return `（${templatePackage.value.crawledCount} 页有版面）`
})

/** 段级证据摊平成一行一格。缺这一段（T4 之前的老行）就是空表，界面显「还没有」 */
const slotShapeRows = computed(() => {
  const rows: Array<{
    rowKey: string
    route: string
    order: number | string
    tag: string
    slots: TemplatePackage['pages'][number]['slotShapes'][number]['slots']
    slotNote?: string
  }> = []
  for (const page of templatePackage.value?.pages || []) {
    for (const shape of page.slotShapes || []) {
      rows.push({
        rowKey: `${page.path}-${shape.order}`,
        route: page.path || '—',
        order: shape.order ?? '—',
        tag: shape.tag || '—',
        slots: shape.slots || [],
        slotNote: shape.slotNote
      })
    }
  }
  return rows
})

/** 词表行没有天然主键：同一组可能在多条路由上都出现过，用「组名 + 来源 + 首项」拼一个够稳的 */
const vocabularyRows = computed(() =>
  (templatePackage.value?.vocabulary || []).map((group, index) => ({
    ...group,
    rowKey: `${group.key}-${group.source}-${index}`
  }))
)

/**
 * 三个动作各自能按的时机，判据全部跟后端同源：
 * requestCrawl 认 pending 与 failed 两个来路（后者是商用 #108：截图服务没起这类失败修好之后该能原地重跑），
 * requestDiscover 只拒绝「正在抓」，addRoute 只要有个本站地址就能补。
 * 界面自己放宽一次，就是让用户点下去才知道被拒。
 */
const canCrawl = computed(
  () => task.value?.mode === 'url' && ['pending', 'failed'].includes(task.value?.status || '')
)
const canDiscover = computed(
  () => task.value?.mode === 'url' && !!task.value?.sourceUrl && task.value?.status !== 'crawling'
)
const canAddRoute = computed(() => task.value?.mode === 'url' && !!task.value?.sourceUrl)

const crawledCount = computed(
  () => pages.value.filter(page => !page.crawlState || page.crawlState === 'ok').length
)
const hydratedRoutes = computed(
  () => pages.value.filter(page => page.renderMode === 'hydrated').length
)
/** 死链与被挡：清单里留着它们，但它们不是「抓到的页」 */
const deadRoutes = computed(() =>
  pages.value.filter(page => page.crawlState === 'not_found' || page.crawlState === 'blocked')
)

/**
 * 路由清单的勾选框只在还能开始抓取时给。
 *
 * <p>任务一旦跑过，后端就不再接受 pending → crawling，这时候给一排勾得动、按下去报红的勾选框，
 * 等于界面自己造一个假入口。要重跑某一页，仍然可以走「不勾选、整站按上限重抓」那一路。</p>
 */
const pageSelection = computed(() =>
  canCrawl.value
    ? {
        selectedRowKeys: selectedPageIds.value,
        onChange: (keys: Array<string | number>) => {
          selectedPageIds.value = keys.map(Number)
        }
      }
    : undefined
)

const estimateMessage = computed(() => {
  if (!estimate.value) return ''
  // 「本站剩余配额」这一句 V142 起撤掉：这一族压根不落租户账单，念一个不会被扣的数字等于让人以为在花钱
  const base = `预计 ${estimate.value.estimatedTokens} token，平台承担、不计入该租户额度`
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

/** 认不出的取值原样显示，理由见 api/referenceSites.ts 里 referenceLabel 的注释 */
function vocabLabel(group: keyof ReferenceVocabularies, value: string | null | undefined) {
  return referenceLabel(vocabularies.value, group, value)
}

/** 颜色的判据用后端字面量，标签用词表：词表会跟着变，颜色不会（这是表现层，不是第二份词表） */
function crawlStateColor(state: string | null | undefined) {
  if (state === 'ok') return 'green'
  if (state === 'not_found' || state === 'blocked') return 'red'
  if (state === 'discovered') return 'blue'
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
  const layers = tokenLayersOf(page)
  if (!layers) return '无 token 采样'
  const siteKeys = layers.site ? Object.keys(layers.site).length : 0
  const hintCount = layers.sectionHints.length
  // 老行是扁平的一份，当时还没有「站级 / 段级」这层区分，别把它说成两层都采过
  if (layers.legacy) return `token 采样：${siteKeys} 项（分层之前的老行，按站级看）`
  const parts = [siteKeys ? `站级 ${siteKeys} 项` : '站级无（sidecar 没采样到）']
  if (hintCount) parts.push(`段级提示 ${hintCount} 格（只作取证，不上身）`)
  return parts.join(' · ')
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
  await Promise.all([loadVocabularies(), loadTasks(), loadStaticOptions()])
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

/** 词表只有一份，在后端。读不到时标签退回原值，并把这件事写在路由清单顶上 */
async function loadVocabularies() {
  try {
    vocabularies.value = await portalReferenceApi.vocabularies()
    vocabError.value = null
  } catch (error) {
    vocabError.value = (error as Error).message || '接口没有响应'
  }
}

async function loadStaticOptions() {
  // 区块元数据与站点下拉都是 portal:build:manage 的口，这一页按 portal:build:reference 放行。
  // 缺码就不发：摄取任务本身照常列得出来，两个下拉如实为空，而不是各报一次「加载失败」。
  if (!canBuild.value) {
    blocks.value = []
    sites.value = []
    staticOptionsNote.value = '这个账号没有 portal:build:manage，读不到区块元数据与站点清单：映射时的区块下拉和「生成草稿页」的站点下拉会空着，摄取与分析照常'
    return
  }
  try {
    const [blockList, siteList] = await Promise.all([portalPagesApi.blocks(), siteApi.list()])
    blocks.value = blockList || []
    // 站点列表由后端按登录态过滤（TenantGuard）：超管看到全部，租户只看到自己的
    sites.value = (siteList || []).map(site => ({ id: site.id, name: site.name }))
    staticOptionsNote.value = ''
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
  unmatchedGroups.value = []
  shotUrls.value = {}
  selectedPageIds.value = []
  templatePackage.value = null
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
    // 清单会重排甚至少几行，勾中一个已经不存在的号会让后端整次抓取被拒（它逐条核对归属）
    selectedPageIds.value = selectedPageIds.value.filter(id => pages.value.some(page => page.id === id))
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
    unmatchedGroups.value = await portalReferenceApi.unmatchedGroups(currentId)
  } catch {
    unmatchedGroups.value = []
  } finally {
    unmatchedLoading.value = false
  }
}

async function startCrawl() {
  if (!currentId) return
  crawling.value = true
  try {
    // 一条都不勾 = 不带 pageIds = 后端按老行为从首页顺链接抓；勾了 = 只跑勾的那几条
    task.value = await portalReferenceApi.crawl(currentId, selectedPageIds.value)
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

/**
 * 第一步：只列路由。它<b>不改状态</b>，所以按完之后不能靠状态轮询看结果——
 * 唯一诚实的做法是等后端把结论写进「最近一次结果」那一格，然后重读清单。
 *
 * <p>这里复用同一个 {@code pollTimer}：结论落地就是 signature 变了（后端 report 写的就是那一格）。
 * 到点还没变就说「没有新进展」而不是弹一个「发现完成」——后者是假通。</p>
 */
async function runDiscover() {
  if (!currentId) return
  discovering.value = true
  try {
    const accepted = await portalReferenceApi.discoverRoutes(currentId)
    task.value = accepted
    message.success('路由发现已受理：这一趟不抓页面、不花钱，跑完清单会自己变长')
    // 任务本身还在跑（比如结构归纳中）时不抢那个轮询：那一头的进度更重要，清单靠「刷新进度」看
    if (referenceIsRunning(accepted.status)) startPollIfNeeded()
    else startDiscoverPoll(signatureOf(accepted))
  } catch (error) {
    message.error((error as Error).message || '路由清单启动失败')
  } finally {
    discovering.value = false
  }
}

function startDiscoverPoll(baseline: string) {
  stopPoll()
  pollLeft = 24
  pollTimer = setInterval(async () => {
    pollLeft -= 1
    if (pollLeft <= 0) {
      stopPoll()
      message.warning('路由清单还没有新结果。如果上面「最近一次结果」那一格已经写了原因，那是它在等你决定，不是还在跑')
      return
    }
    try {
      const latest = await portalReferenceApi.get(currentId)
      task.value = latest
      if (signatureOf(latest) !== baseline) {
        stopPoll()
        await loadPages()
        loadTasks()
      }
    } catch (error) {
      stopPoll()
      message.error((error as Error).message || '路由清单刷新失败')
    }
  }, 2500)
}

function openRouteModal() {
  routeForm.path = ''
  routeForm.pageName = ''
  routeOpen.value = true
}

async function submitRoute() {
  if (!currentId) return
  const path = routeForm.path.trim()
  if (!path.startsWith('/')) {
    message.warning('路由要写成站内路径，比如 /services')
    return
  }
  addingRoute.value = true
  try {
    const row = await portalReferenceApi.addRoute(currentId, {
      path,
      pageName: routeForm.pageName.trim() || null
    })
    routeOpen.value = false
    message.success(`已加进清单：${row.routePath || path}。勾上它再按「开始抓取」才会真的发请求`)
    await loadPages()
  } catch (error) {
    message.error((error as Error).message || '补录失败')
  } finally {
    addingRoute.value = false
  }
}

/** 只读取证快照：失败就显式说失败，别让上一份包的旧数据留在屏幕上被当成新结果 */
async function loadPackage() {
  if (!currentId) return
  packageLoading.value = true
  try {
    templatePackage.value = await portalReferenceApi.templatePackage(currentId)
  } catch (error) {
    templatePackage.value = null
    message.error((error as Error).message || '模板包载入失败')
  } finally {
    packageLoading.value = false
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
    message.success(verifyAccept.value ? '这条映射已确认' : '已打回「暂未对上现有区块」')
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
  await loadVocabularies()
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

  &__route {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 600;
  }

  &__slot {
    line-height: 1.7;
  }

  &__slot-key {
    display: inline-block;
    min-width: 62px;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 600;
  }

  &__hints {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
