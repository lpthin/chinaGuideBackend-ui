<template>
  <div class="model-usage-page">
    <a-spin :spinning="loading">
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-row :gutter="16" align="middle">
          <a-col :span="18">
            <a-space size="middle">
              <span class="filter-label">日期范围：</span>
              <a-range-picker
                v-model:value="dateRange"
                :presets="dateRanges"
                style="width: 380px"
                @change="handleDateChange"
              />
              <a-space>
                <a-button
                  :type="quickDate === 'today' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('today')"
                >
                  今日
                </a-button>
                <a-button
                  :type="quickDate === 'week' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('week')"
                >
                  本周
                </a-button>
                <a-button
                  :type="quickDate === 'month' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('month')"
                >
                  本月
                </a-button>
                <a-button
                  :type="quickDate === '7d' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('7d')"
                >
                  近7天
                </a-button>
                <a-button
                  :type="quickDate === '30d' ? 'primary' : 'default'"
                  size="small"
                  @click="setQuickDate('30d')"
                >
                  近30天
                </a-button>
              </a-space>
            </a-space>
          </a-col>
          <a-col :span="6" style="text-align: right">
            <a-space>
              <a-button @click="resetFilter">
                <template #icon><ReloadOutlined /></template>
                重置
              </a-button>
              <a-button type="primary" @click="handleSearch">
                <template #icon><SearchOutlined /></template>
                查询
              </a-button>
            </a-space>
          </a-col>
        </a-row>
        <!-- 这一屏所有「总数」取的是哪一段，由后端随响应说回来，界面照念（不写死「本月」） -->
        <div v-if="windowText" class="usage-window">{{ windowText }}</div>
      </a-card>

      <!-- 统计口读失败时整排退化成一句「读取失败」：四格 ¥0.00 / 0 / 0 / 0.0% 读起来像「这个月一次都没调用」，
           而真相是那一次请求没回来。三态语义不许互换，所以这里走 StateBlock 的 error 态。 -->
      <a-row v-if="!statsError" :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card class="stat-card main-stat" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #722ed1 0%, #eb2f96 100%)">
                <DollarOutlined />
              </div>
              <div class="stat-info">
                <!--
                  Q-P7-6a 起这一格不再恒念「¥0.00」；P9-A 起它有真来源：ModelPricing 按
                  「这一笔当时那台模型的单价」把 cost_estimate 算死再落库。
                  于是这里的三态是准的：数字 = 窗口里定价模型的钱；¥0.00 = 那些模型真免费；
                  「未统计」= 窗口里全是没定价的模型（一行 NULL 都没有），不是「花费为 0」。
                  0 是一个数，而真相是「没有这个数」，两者不许互换（§9.6 同一条纪律）。
                -->
                <div class="stat-value" :class="{ 'stat-value--none': !hasStat('totalCost') }">
                  {{ hasStat('totalCost') ? formatYuan(totalCost) : '未统计' }}
                </div>
                <div class="stat-title">{{ rangeLabel }}总费用</div>
                <div v-if="hasStat('costGrowth')" class="stat-trend up">
                  <ArrowUpOutlined /> {{ costGrowth }}% 较上月
                </div>
                <p v-if="!hasStat('totalCost')" class="stat-note">
                  这一段窗口里的调用全落在没定价的模型上，所以费用不念 ¥0。
                  去「模型配置」那一页给这些模型填每 1000 token 的单价，之后的调用就开始计钱
                  （已经落库的那些不回填——单价改一次，历史账就跟着变一次）。
                  额度与扣费流水在下方那块，按 token 记，要在右上角选定租户才读得到。
                </p>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)">
                <BlockOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ totalTokens.toLocaleString() }}</div>
                <div class="stat-title">{{ rangeLabel }} Token 消耗</div>
                <div v-if="hasStat('tokenGrowth')" class="stat-trend up">
                  <ArrowUpOutlined /> {{ tokenGrowth }}% 较上月
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #52c41a 0%, #95de64 100%)">
                <ApiOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ totalCalls.toLocaleString() }}</div>
                <div class="stat-title">{{ rangeLabel }}调用次数</div>
                <div v-if="hasStat('callGrowth')" class="stat-trend up">
                  <ArrowUpOutlined /> {{ callGrowth }}% 较上月
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stat-card" hoverable>
            <div class="stat-content">
              <div class="stat-icon" style="background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%)">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ successRate.toFixed(1) }}%</div>
                <div class="stat-title">{{ rangeLabel }}调用成功率</div>
                <div v-if="hasStat('successRateGrowth')" class="stat-trend" :class="successRateGrowth >= 0 ? 'up' : 'down'">
                  <ArrowUpOutlined v-if="successRateGrowth >= 0" />
                  <ArrowDownOutlined v-else />
                  {{ Math.abs(successRateGrowth).toFixed(1) }}% 较昨日
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>
      <a-row v-else style="margin-bottom: 16px">
        <a-col :span="24">
          <a-card :bordered="false">
            <StateBlock
              state="error"
              title="这屏的统计没读到"
              detail="总费用、Token、调用次数、成功率这四格要的是 /ai/model/stats 那一条聚合，它这一次没回来。"
              next="点右上角「查询」重试；持续失败把本页右下角的 traceId 连同时间点提交工单。"
            />
          </a-card>
        </a-col>
      </a-row>

      <a-row v-if="!statsError" :gutter="16" style="margin-bottom: 16px">
        <a-col :span="12">
          <a-card title="今日用量" :bordered="false">
            <!--
              接口没给「今日」这一档（它给的是所选区间的合计），所以这里不许再拿初始值 0 顶上去。
              同一个卡片的三个数一起退化成一块说明，比三格「0 / 0 / ¥0.00」诚实。
            -->
            <a-row v-if="hasStat('todayTokens')" :gutter="16">
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">{{ todayStats.tokens.toLocaleString() }}</div>
                  <div class="mini-label">今日 Token</div>
                  <div class="mini-diff" :class="todayStats.tokenGrowth >= 0 ? 'up' : 'down'">
                    {{ todayStats.tokenGrowth >= 0 ? '+' : '' }}{{ todayStats.tokenGrowth.toFixed(1) }}%
                  </div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">{{ todayStats.calls.toLocaleString() }}</div>
                  <div class="mini-label">今日调用</div>
                  <div class="mini-diff" :class="todayStats.callGrowth >= 0 ? 'up' : 'down'">
                    {{ todayStats.callGrowth >= 0 ? '+' : '' }}{{ todayStats.callGrowth.toFixed(1) }}%
                  </div>
                </div>
              </a-col>
              <a-col :span="8">
                <div class="mini-stat">
                  <div class="mini-value">{{ formatYuan(todayStats.cost) }}</div>
                  <div class="mini-label">今日费用</div>
                  <div class="mini-diff" :class="todayStats.costGrowth >= 0 ? 'up' : 'down'">
                    {{ todayStats.costGrowth >= 0 ? '+' : '' }}{{ todayStats.costGrowth.toFixed(1) }}%
                  </div>
                </div>
              </a-col>
            </a-row>
            <StateBlock
              v-else
              state="not-measured"
              title="今日这一档没有数据源"
              detail="接口给的是所选区间的合计，没有单独按「今天」切的一组数，也不含环比。"
              next="把上面的日期切到「今日」，这一屏的数就是今天的；要一格常驻的今日数，得后端补一条按日聚合的口径。"
            />
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card :title="pools.length ? '本月额度（两池分账）' : `${rangeLabel}预算`" :bordered="false">
            <!--
              两条路各有各的出处，界面不许把它们混成一句：
              1. 下面这块「本月额度」读的是 /billing/stats/overview 的 pools（G4 拆池之后两池各有一个
                 月度水位、各有一本已用账），它是 token，不是钱；没选租户时后端不回填这两格，
                 于是这块根本不存在（宁可不念，也不许拿全租户的流水除以一个不知道是谁的额度）。
              2. 原来那格 ¥预算：budgetUsed / budgetTotal 由 /ai/model/stats 回，回不来就走
                 StateBlock（那一格以前稳定显示「已使用 ¥0.00 / ¥0」「剩余 ¥0.00」「可使用 NaN 天」——
                 三个假数加一次 NaN，0 是一个数而真相是「没有这个数」）。
            -->
            <div v-if="pools.length" class="pool-list">
              <div v-for="pool in pools" :key="pool.usageType" class="pool-row">
                <div class="pool-head">
                  <span class="pool-name">{{ pool.poolLabel }}</span>
                  <!-- 三态各有各的念法（V158 / N2）：有上限念数，没上限念「不限制」，接口没回才念占位符 -->
                  <span v-if="poolIsUnlimited(pool)" class="pool-nums">
                    未设月度上限，不限制 · 本月已用
                    {{ pool.usedTokens?.toLocaleString() ?? PH_DASH }} token
                  </span>
                  <span v-else class="pool-nums">
                    剩余 {{ pool.remainingTokens?.toLocaleString() ?? PH_DASH }} / 本月已用
                    {{ pool.usedTokens?.toLocaleString() ?? PH_DASH }} · 月度额度
                    {{ pool.monthlyQuota?.toLocaleString() ?? PH_DASH }} token
                  </span>
                </div>
                <!-- 没有上限就没有「用了百分之几」这个数：那根条子的分母不存在。
                     画一条 0% 的条子读起来是「一分钱都没花」，而这一行的真相常常是已经花掉了几十万 -->
                <a-progress
                  v-if="!poolIsUnlimited(pool)"
                  :percent="poolUsedPercent(pool)"
                  :stroke-color="poolUsedPercent(pool) >= 90 ? '#d4380d' : '#1677ff'"
                  :show-info="false"
                />
                <div v-else class="pool-unlimited">
                  这一池没有上限可除，所以不算已用占比——不是 0%，是「没人设过上限」。
                </div>
                <div class="pool-ledger">
                  本月这一池的扣费流水 {{ pool.monthCount?.toLocaleString() ?? PH_DASH }} 笔、合计
                  {{ pool.monthTokenAmount?.toLocaleString() ?? PH_DASH }} token<span
                    v-if="pool.usageType === 'AI_TOKEN'"
                  >（含拆池之前那几笔——它们没记池子，按当时的口径算进通用池）</span>。
                </div>
              </div>
              <div class="pool-note">
                两池分账：GEO 诊断花的钱不挤文章生成的额度，反过来也一样。
                通用池的水位跟着本租户的计费套餐；GEO 那一池由超级管理员在本页设，
                <b>没设 = 不限制</b>（不是「额度为 0」，也不会去跟套餐的数）。
              </div>

              <!--
                超管写入口（V158 / N2 拍板：「留给后端（超级管理员）设置」）。
                这句话要成立，必须有一处界面能写——水位只住在 application.yml 里，
                就等于留给一个既不持有 YAML、也无法重启服务的人设置。
                判据一条都不在这里重复实现：能不能存、留空算什么，以接口回的那句 note 为准。
              -->
              <div v-if="authStore.isSuperAdmin" class="geo-quota-setter">
                <div class="geo-quota-setter__title">设置 GEO 诊断池的月度上限（仅超级管理员）</div>
                <a-space>
                  <a-input-number
                    v-model:value="geoQuotaInput"
                    :min="1"
                    :step="10000"
                    :controls="false"
                    placeholder="留空 = 不限制"
                    style="width: 180px"
                  />
                  <a-button :loading="geoQuotaSaving" @click="saveGeoQuota">保存</a-button>
                  <a-button :loading="geoQuotaSaving" @click="clearGeoQuota">清空（改为不限制）</a-button>
                </a-space>
                <div v-if="geoQuota" class="geo-quota-setter__now">{{ geoQuotaNowText }}</div>
                <!-- 「为什么现在是这个数」与「去哪儿设」都由后端发原文，界面不拼第二份规则 -->
                <div v-if="geoQuota?.note" class="geo-quota-setter__note">{{ geoQuota.note }}</div>
                <div v-if="geoQuota" class="geo-quota-setter__who">{{ geoQuotaWhoText }}</div>
              </div>
            </div>
            <div v-else-if="hasStat('budgetTotal')" class="budget-container">
              <div class="budget-info">
                <span class="budget-label">已使用</span>
                <span class="budget-value">¥{{ budgetUsed.toFixed(2) }}</span>
                <span class="budget-label">/ ¥{{ budgetTotal }}</span>
              </div>
              <a-progress
                :percent="Math.round((budgetUsed / budgetTotal) * 100)"
                :stroke-color="getBudgetColor()"
                :show-info="false"
                style="margin-top: 12px"
              />
              <div class="budget-remaining">
                剩余 ¥{{ (budgetTotal - budgetUsed).toFixed(2) }}
                <!-- 一次都没花的时候「可用天数」是除以 0，会念成 Infinity 天；没有消耗就不算这一句 -->
                <span v-if="budgetUsed > 0" class="budget-days">预计可使用 {{ Math.ceil((budgetTotal - budgetUsed) / (budgetUsed / (new Date().getDate()))) }} 天</span>
                <span v-else class="budget-days">这一段还没有消耗，不算可用天数</span>
              </div>
            </div>
            <StateBlock
              v-else
              state="not-measured"
              title="预算那一格还没有接上额度口径"
              detail="这一格要的是钱（¥），而 /ai/model/stats 从来没回 budgetTotal；以前显示的 ¥0 是初始值，不是「没花钱」。token 那一口径现在有了：选了租户就由上面那块念两池的数。"
              next="右上角选一个租户 ⇒ 这一屏变成「本月额度（两池分账）」，读的是 /billing/stats/overview 的 pools（G4）；¥那一格仍等 budgetTotal 回来。"
            />
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="16">
          <a-card title="用量趋势" :bordered="false">
            <template #extra>
              <a-radio-group v-model:value="timeRange" button-style size="small">
                <a-radio-button value="7d">近7天</a-radio-button>
                <a-radio-button value="30d">近30天</a-radio-button>
                <a-radio-button value="90d">近90天</a-radio-button>
              </a-radio-group>
            </template>
            <div class="chart-container">
              <div class="chart-legend">
                <span class="legend-item">
                  <span class="legend-dot token-dot"></span>
                  Token 消耗
                </span>
                <span class="legend-item">
                  <span class="legend-dot cost-dot"></span>
                  费用
                </span>
              </div>
              <div class="chart-area">
                <div class="chart-bars">
                  <div
                    v-for="(item, index) in usageChartData"
                    :key="index"
                    class="bar-group"
                  >
                    <div
                      class="bar bar-token"
                      :style="{ height: `${(item.tokens / maxToken) * 100}%` }"
                    >
                      <span class="bar-tooltip">{{ item.tokens.toLocaleString() }}</span>
                    </div>
                  </div>
                </div>
                <div class="chart-labels">
                  <span v-for="(item, index) in usageChartData" :key="index" class="chart-label">
                    {{ item.date }}
                  </span>
                </div>
              </div>
            </div>
          </a-card>
        </a-col>

        <a-col :span="8">
          <a-card title="模型用量分布" :bordered="false">
            <div class="pie-chart-placeholder">
              <div class="pie-visual">
                <div class="pie-ring" :style="{ background: getPieGradient() }"></div>
                <div class="pie-center">
                  <div class="pie-total">{{ pieTotalTokens.toLocaleString() }}</div>
                  <div class="pie-label">总 Token</div>
                </div>
              </div>
              <div class="pie-legend">
                <div
                  v-for="(model, index) in modelUsageList"
                  :key="index"
                  class="legend-row"
                >
                  <span
                    class="legend-color-block"
                    :style="{ background: modelColors[index] }"
                  ></span>
                  <span class="legend-model-name">{{ model.name }}</span>
                  <span class="legend-percent">{{ Number(model.percent ?? 0).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </a-card>

          <a-card title="性能指标" :bordered="false" style="margin-top: 16px">
            <div class="performance-list">
              <div class="performance-item">
                <span class="perf-label">平均响应时间</span>
                <span v-if="hasStat('avgResponseTime')" class="perf-value">{{ Math.round(avgResponseTime) }}ms</span>
                <span v-else class="perf-value perf-value--none">未统计</span>
              </div>
              <div class="performance-item">
                <span class="perf-label">P50 响应时间</span>
                <span v-if="hasStat('p50ResponseTime')" class="perf-value">{{ Math.round(p50ResponseTime) }}ms</span>
                <span v-else class="perf-value perf-value--none">未统计</span>
              </div>
              <div class="performance-item">
                <span class="perf-label">P90 响应时间</span>
                <span v-if="hasStat('p90ResponseTime')" class="perf-value">{{ Math.round(p90ResponseTime) }}ms</span>
                <span v-else class="perf-value perf-value--none">未统计</span>
              </div>
              <!-- 这两率后端没有统计口径（GEO 那段还明确「一次超时即计入失败、不自动重试」），
                   所以不许念 0%：0% 读起来像「一次都没重试」，而真相是「没数」。 -->
              <div class="performance-item">
                <span class="perf-label">失败重试率</span>
                <span v-if="hasStat('retryRate')" class="perf-value">{{ retryRate }}%</span>
                <span v-else class="perf-value perf-value--none">未统计</span>
              </div>
              <div class="performance-item">
                <span class="perf-label">限流触发率</span>
                <span v-if="hasStat('limitRate')" class="perf-value">{{ limitRate }}%</span>
                <span v-else class="perf-value perf-value--none">未统计</span>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <a-row style="margin-top: 16px">
        <a-col :span="24">
          <a-card title="调用日志" :bordered="false">
            <!-- 日志表的筛选/导出从卡片 #extra 移入 FilterBar，与全站一行式工具条对齐 -->
            <filter-bar>
              <a-select
                v-model:value="logFilter.type"
                style="width: 140px"
                placeholder="按类型筛选"
                allowClear
              >
                <a-select-option value="chat">聊天模型</a-select-option>
                <a-select-option value="vision">视觉模型</a-select-option>
                <a-select-option value="embedding">向量模型</a-select-option>
                <a-select-option value="image">图像模型</a-select-option>
              </a-select>
              <a-input-search
                v-model:value="logFilter.keyword"
                placeholder="搜索日志内容"
                style="width: 240px"
                enter-button
              />
              <template #actions>
                <a-space>
                  <a-button type="primary" :disabled="!paginatedLogs.length" @click="exportLogs">
                    <template #icon><DownloadOutlined /></template>
                    导出本页
                  </a-button>
                </a-space>
              </template>
            </filter-bar>

            <a-table
              :scroll="{ x: 'max-content' }"
              :columns="logColumns"
              :data-source="paginatedLogs"
              :pagination="false"
              :row-key="(record: any) => record.id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'status'">
                  <a-tag :color="record.status === 'success' ? 'green' : 'red'">
                    {{ record.status === 'success' ? '成功' : '失败' }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'tokens'">
                  <div class="tokens-badge">{{ record.tokens ? record.tokens.toLocaleString() : '-' }}</div>
                </template>
                <template v-if="column.key === 'cost'">
                  <!-- 0 与 null 是两个答案：「真免费」和「这一台模型没定价、没统计」。`record.cost ? …` 会把它们并成一个「-」 -->
                  <span class="cost-value">{{ formatYuan(record.cost) }}</span>
                </template>
                <template v-if="column.key === 'duration'">
                  {{ record.duration }}ms
                </template>
              </template>
            </a-table>

            <div class="pagination-wrapper">
              <a-pagination
                v-model:current="logPagination.current"
                v-model:pageSize="logPagination.pageSize"
                :total="logTotal"
                show-size-changer
                :page-size-options="['20', '50', '100']"
                show-quick-jumper
                :show-total="(total: number) => localFilterActive ? `本页匹配 ${total} 条` : `共 ${total} 条`"
              />
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, h } from 'vue'
import { message } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import {
  DollarOutlined,
  BlockOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { aiModelApi } from '../../api/ai-model'
import FilterBar from '../../components/FilterBar.vue'
import { statsApi } from '../../api/billing'
import { geoQuotaApi, type GeoQuotaStatus } from '../../api/geoQuota'
import StateBlock from '../../components/StateBlock.vue'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime } from '../../utils/format'
import { PH_DASH } from '../../utils/display'
import { logError } from '../../utils/errorLog'

const authStore = useAuthStore()

const loading = ref(false)
const quickDate = ref<string>('month')
const dateRange = ref<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')])

const dateRanges = {
  '今日': [dayjs(), dayjs()],
  '本周': [dayjs().startOf('week'), dayjs().endOf('week')],
  '本月': [dayjs().startOf('month'), dayjs().endOf('month')],
  '近7天': [dayjs().subtract(6, 'day'), dayjs()],
  '近30天': [dayjs().subtract(29, 'day'), dayjs()],
  '近90天': [dayjs().subtract(89, 'day'), dayjs()],
}

const totalCost = ref(0)
const totalTokens = ref(0)
const totalCalls = ref(0)
const successRate = ref(0)
const successRateGrowth = ref(0)
const costGrowth = ref(0)
const tokenGrowth = ref(0)
const callGrowth = ref(0)

const todayStats = reactive({
  tokens: 0,
  calls: 0,
  cost: 0,
  tokenGrowth: 0,
  callGrowth: 0,
  costGrowth: 0,
})

const budgetUsed = ref(0)
const budgetTotal = ref(0)

/**
 * 两池的本月额度（Spec-G G4 / P5）。
 *
 * <p>这一份是 <b>token</b>，不是钱：{@code /billing/stats/overview} 的 {@code pools} 给的是
 * 「通用 AI 额度池」与「GEO 诊断专用池」各自的水位、已用、剩余，加上本月流水笔数与合计。
 * 界面拿它做一件事——把「本月剩余额度」这个词指实：拆池之前那一句在两个产品线上是同一个数，
 * 于是「文章写多了能不能跑诊断」这种问题根本没有答案（缺口 F2）。</p>
 *
 * <p>只有点名了租户才读得到：全租户视角下「月度额度」没有归属，把各家的水位相加是个假上限。
 * 所以 {@link loadPools} 没选租户时直接清空这块，由那块说明文字解释为什么没有数。</p>
 *
 * <p>V158（N2 拍板）之后多了一格 {@code quotaUnlimited}：GEO 那一池可以<b>压根没设上限</b>，
 * 那时 {@code monthlyQuota} 与 {@code remainingTokens} 是 null。这一格必须由后端说，界面不许自己
 * 拿「额度是 0」去推断——0 是「钱花光了」，null 是「没人设过上限」，两个相反的意思共用一个数
 * 就是下一句谎。</p>
 */
interface PoolStat {
  usageType: string
  poolLabel: string
  monthTokenAmount?: number
  monthCount?: number
  monthlyQuota?: number | null
  usedTokens?: number
  remainingTokens?: number | null
  /** 后端直说「这一池没设上限」；通用池那一路恒为 false */
  quotaUnlimited?: boolean
}
const pools = ref<PoolStat[]>([])

/** 这一池是不是「没人设过上限」：只认后端那一格，不拿 monthlyQuota 是否为 0/null 去猜 */
function poolIsUnlimited(pool: PoolStat): boolean {
  return pool.quotaUnlimited === true
}

/** 已用占比：没有水位就不算百分比（除以 0 会念成 Infinity%，那一类假数这次已经清过一遍） */
function poolUsedPercent(pool: PoolStat): number {
  const quota = pool.monthlyQuota ?? 0
  const used = pool.usedTokens ?? 0
  if (quota <= 0) {
    return 0
  }
  return Math.min(100, Math.round((used / quota) * 100))
}

const loadPools = async () => {
  const tenantId = authStore.selectedTenantId ?? undefined
  if (!tenantId) {
    pools.value = []
    geoQuota.value = null
    return
  }
  try {
    const result = await statsApi.overview(tenantId)
    pools.value = Array.isArray(result?.pools) ? result.pools : []
  } catch (error) {
    logError('ai/model-usage-view', 'Failed to load token pools:', error)
    pools.value = []
  }
  await loadGeoQuota(tenantId)
}

/**
 * 超管写 GEO 池水位那一块（V158 / N2 拍板唯一能「留给超级管理员设置」的入口）。
 *
 * <p>界面在这里只做两件事：把后端回的那句「为什么现在是这个数」原样念出来，和把人填的数交出去。
 * 「留空 = 不限制」「填 0 会被拒」这两条判据都在 `GeoQuotaService.setTenantQuota`，
 * 这里不复制一份（复制一次就是下一次两边对不上的来源）。</p>
 */
const geoQuota = ref<GeoQuotaStatus | null>(null)
const geoQuotaInput = ref<number | null>(null)
const geoQuotaSaving = ref(false)

async function loadGeoQuota(tenantId: number): Promise<void> {
  if (!authStore.isSuperAdmin) {
    geoQuota.value = null
    return
  }
  try {
    const status = await geoQuotaApi.status(tenantId)
    geoQuota.value = status ?? null
    // 回填的是「这个租户单独设的那个数」，不是生效值：生效值可能是平台兜底，
    // 把它当租户级设置回填，下一次保存就会把平台值抄成租户值（来源悄悄变了，数没变，最难查）
    geoQuotaInput.value = status?.tenantQuota ?? null
  } catch (error) {
    logError('ai/model-usage-view', 'Failed to load GEO quota:', error)
    geoQuota.value = null
  }
}

/** 提交这一池的水位。{@code quota} 为 null 就是「清空 = 不限制」，与填 0 是两件事 */
async function submitGeoQuota(quota: number | null): Promise<void> {
  const tenantId = authStore.selectedTenantId
  if (!tenantId) {
    message.warning('请先在右上角选择一个租户：这一池是按租户分账的，没有租户号就没有「设给谁」')
    return
  }
  geoQuotaSaving.value = true
  try {
    const status = await geoQuotaApi.set({ tenantId, monthlyTokenQuota: quota })
    geoQuota.value = status ?? null
    geoQuotaInput.value = status?.tenantQuota ?? null
    message.success(status?.note || '已保存')
    // 两池那块读的是另一条口（/billing/stats/overview），改完必须一起刷新，否则同一屏两个数各说一套
    await loadPools()
  } catch (error: any) {
    message.error(error?.message || '保存失败')
    logError('ai/model-usage-view', 'Failed to save GEO quota:', error)
  } finally {
    geoQuotaSaving.value = false
  }
}

const saveGeoQuota = () => submitGeoQuota(geoQuotaInput.value ?? null)

const clearGeoQuota = async () => {
  geoQuotaInput.value = null
  await submitGeoQuota(null)
}

const geoQuotaNowText = computed(() => {
  const status = geoQuota.value
  if (!status) return ''
  const quota = status.monthlyQuota
  const effective = quota === null || quota === undefined ? '不限制（没设过上限）' : `${quota.toLocaleString()} token`
  const source = QUOTA_SOURCE_TEXT[status.quotaSource] || status.quotaSource
  return `现在生效的是 ${effective}，来源：${source}；本月已用 ${status.usedTokens.toLocaleString()} token。`
})

const geoQuotaWhoText = computed(() => {
  const status = geoQuota.value
  if (!status) return ''
  const at = status.updatedAt ? formatDateTime(status.updatedAt) : '这个租户还没单独设过'
  const by = status.updatedBy === null || status.updatedBy === undefined ? '没记到改动人' : `管理员 id ${status.updatedBy}`
  return `最后一次单独设置：${at} · ${by}（要核对是谁，按这个 id 在「用户管理」里查）`
})

/** 生效水位来自哪一路：词表在这一份文件里只有一份，跟后端三个常量一一对应 */
const QUOTA_SOURCE_TEXT: Record<string, string> = {
  TENANT: '本租户单独设置',
  PLATFORM: '平台兜底（app.ai.quota.geo-monthly-quota）',
  UNLIMITED: '两处都没设',
}

// 统计那一次请求到底回没回。没回就不许把四格初始值当数念（见上面那排卡的注释）
const statsError = ref(false)

const timeRange = ref('7d')
const avgResponseTime = ref(0)
const p50ResponseTime = ref(0)
const p90ResponseTime = ref(0)
// null = 接口没给这一项（界面上念「未统计」），0 = 真的测出来是 0%。这两个不能都写 0
const retryRate = ref<number | null>(null)
const limitRate = ref<number | null>(null)

const modelColors = ['#722ed1', '#1890ff', '#52c41a', '#fa8c16', '#eb2f96']

const modelUsageList = ref<any[]>([])

const usageChartData = ref<any[]>([])

/**
 * 环中心那个数与它下面那串图例同源（Spec-G P2）。
 * 以前中心念的是统计口的 totalTokens，图例来自另一个接口的模型清单，两边一不相等就是「总数对不上」。
 */
const pieTotalTokens = computed(() =>
  modelUsageList.value.reduce((sum, row: any) => sum + (Number(row.tokens) || 0), 0)
)

// 一条数据都没有时 Math.max() 给 -Infinity，柱高会变成 NaN%；全 0 同理。兜成 1 让所有柱子站平
const maxToken = computed(() => {
  return Math.max(1, ...usageChartData.value.map(d => Number(d.tokens) || 0))
})

const getBudgetColor = () => {
  const percent = (budgetUsed.value / budgetTotal.value) * 100
  if (percent < 60) return '#52c41a'
  if (percent < 85) return '#fa8c16'
  return '#f5222d'
}

const getPieGradient = () => {
  if (modelUsageList.value.length === 0) {
    return '#e5e7eb'
  }
  const colors = modelColors.slice(0, modelUsageList.value.length)
  let gradient = ''
  let currentPercent = 0
  for (let i = 0; i < colors.length; i++) {
    const nextPercent = currentPercent + modelUsageList.value[i].percent
    gradient += `${colors[i]} ${currentPercent}% ${nextPercent}%,`
    currentPercent = nextPercent
  }
  if (currentPercent < 100) {
    gradient += `#e5e7eb ${currentPercent}% 100%`
  } else {
    gradient = gradient.slice(0, -1)
  }
  return `conic-gradient(${gradient})`
}

const logFilter = reactive({
  type: undefined as string | undefined,
  keyword: '',
})

const logPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
})

const logList = ref<any[]>([])

/** 后端 GET /ai/model/logs 只接受 tenantId/page/size，类型与关键词只能在已加载的本页数据里筛 */
const localFilterActive = computed(() => Boolean(logFilter.type || logFilter.keyword.trim()))

const paginatedLogs = computed(() => {
  const kw = logFilter.keyword.trim().toLowerCase()
  return logList.value.filter((row: any) => {
    if (logFilter.type && String(row.type ?? '').toLowerCase() !== logFilter.type) return false
    if (kw) {
      const haystack = `${row.prompt ?? ''} ${row.model ?? ''}`.toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  })
})

/** 本地筛选生效时不能继续显示接口返回的未筛选总数，否则「共 N 条」与表格对不上 */
const logTotal = computed(() => (localFilterActive.value ? paginatedLogs.value.length : logPagination.total))

const logColumns = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    customRender: ({ text }: { text: string }) => formatDateTime(text, true),
  },
  {
    title: '模型',
    dataIndex: 'model',
    key: 'model',
    width: 120,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    customRender: ({ record }: { record: any }) => {
      const typeMap: Record<string, string> = {
        chat: '聊天',
        embedding: '向量',
        image: '图像',
      }
      return typeMap[record.type] || record.type
    },
  },
  {
    title: '提示词',
    dataIndex: 'prompt',
    key: 'prompt',
    ellipsis: true,
  },
  {
    title: 'Token',
    key: 'tokens',
    width: 100,
  },
  {
    title: '费用',
    key: 'cost',
    width: 100,
  },
  {
    title: '耗时',
    key: 'duration',
    width: 80,
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
  },
]

function setQuickDate(type: string) {
  quickDate.value = type
  const now = dayjs()
  switch (type) {
    case 'today':
      dateRange.value = [now, now]
      break
    case 'week':
      dateRange.value = [now.startOf('week'), now.endOf('week')]
      break
    case 'month':
      dateRange.value = [now.startOf('month'), now.endOf('month')]
      break
    case '7d':
      dateRange.value = [now.subtract(6, 'day'), now]
      break
    case '30d':
      dateRange.value = [now.subtract(29, 'day'), now]
      break
  }
  handleSearch()
}

function handleDateChange(dates: any) {
  quickDate.value = ''
  if (dates && dates.length === 2) {
    dateRange.value = dates
  }
}

function resetFilter() {
  quickDate.value = 'month'
  dateRange.value = [dayjs().startOf('month'), dayjs().endOf('month')]
  handleSearch()
}

function handleSearch() {
  fetchData()
}

const getCommonParams = () => {
  return {
    tenantId: authStore.selectedTenantId ?? undefined,
    startDate: dateRange.value?.[0]?.format('YYYY-MM-DD'),
    endDate: dateRange.value?.[1]?.format('YYYY-MM-DD'),
  }
}

/**
 * 接口回来的是什么，界面就只念什么（Spec-G P2 现场挖出的那条，同 §9.6 的纪律）。
 *
 * <p>以前这里是一串 `result.xxx ?? 0`：后端从来没回过 todayTokens / costGrowth / budgetTotal /
 * retryRate 这几组键，于是它们被 ?? 兜成 0 之后，屏幕上稳定出现「今日 Token 0」「较上月 0%」
 * 「剩余 ¥0.00」「预计可使用 NaN 天」。0 是一个数，而真相是「没有这个数」，两者不能互换。</p>
 */
const statsPayload = ref<Record<string, unknown>>({})

function hasStat(key: string): boolean {
  const value = statsPayload.value?.[key]
  return value !== undefined && value !== null
}

/**
 * 费用的念法。三位一体：null = 「未统计」（这一台没定价），0 = 「¥0.00」（真免费），有数就报数。
 *
 * <p>为什么要专门写这个而不是 `toFixed(2)`：真跑 P9-A2 时接口回的是 totalCost=0.001742，
 * 卡片按两位小数一舍就成了「¥0.00」——那一眼看上去正是「真免费」，把 P9-A 立起来要区分的
 * 三态又并回了一个。所以非零的数一律不许被舍成零：不到一分的按有效位展开，不到百万分之一的
 * 直接换成科学计数法，宁可念得难看，也不许念成一个看起来像读数的 0。</p>
 */
function formatYuan(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '未统计'
  if (value === 0) return '¥0.00'
  const abs = Math.abs(value)
  if (abs >= 0.01) return `¥${value.toFixed(2)}`
  if (abs < 0.000001) return `¥${value.toExponential(2)}`
  return `¥${value.toFixed(6).replace(/0+$/, '')}`
}

const QUICK_DATE_LABELS: Record<string, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  '7d': '近 7 天',
  '30d': '近 30 天',
}

/** 卡片标题上那个时间限定词跟着真正生效的选择器走，不再写死「本月」 */
const rangeLabel = computed(() => QUICK_DATE_LABELS[quickDate.value] ?? '所选区间')

/** 后端把这一屏取的是哪一段说了回来，界面就把它摆在筛选栏里（左闭右开，末日整天在内） */
const windowText = computed(() => {
  const from = statsPayload.value?.windowFrom
  const to = statsPayload.value?.windowTo
  if (typeof from !== 'string' || typeof to !== 'string') {
    return ''
  }
  return `取数区间 ${from.slice(0, 10)} 至 ${to.slice(0, 10)}（含末日整天）`
})

const loadStats = async () => {
  try {
    const params = getCommonParams()
    const result = await aiModelApi.getStats(params)
    statsPayload.value = result ?? {}
    statsError.value = false
    totalCost.value = result.totalCost ?? 0
    totalTokens.value = result.totalTokens ?? 0
    totalCalls.value = result.totalCalls ?? 0
    successRate.value = result.successRate ?? 0
    successRateGrowth.value = result.successRateGrowth ?? 0
    costGrowth.value = result.costGrowth ?? 0
    tokenGrowth.value = result.tokenGrowth ?? 0
    callGrowth.value = result.callGrowth ?? 0
    todayStats.tokens = result.todayTokens ?? 0
    todayStats.calls = result.todayCalls ?? 0
    todayStats.cost = result.todayCost ?? 0
    todayStats.tokenGrowth = result.todayTokenGrowth ?? 0
    todayStats.callGrowth = result.todayCallGrowth ?? 0
    todayStats.costGrowth = result.todayCostGrowth ?? 0
    budgetUsed.value = result.budgetUsed ?? 0
    budgetTotal.value = result.budgetTotal ?? 0
    avgResponseTime.value = result.avgResponseTime ?? 0
    p50ResponseTime.value = result.p50ResponseTime ?? 0
    p90ResponseTime.value = result.p90ResponseTime ?? 0
    retryRate.value = result.retryRate ?? null
    limitRate.value = result.limitRate ?? null
  } catch (error) {
    message.error('加载统计数据失败')
    logError('ai/model-usage-view', 'Failed to load stats:', error)
    statsError.value = true
  }
}

const loadUsageByModel = async () => {
  try {
    const params = getCommonParams()
    const result = await aiModelApi.getUsageByModel(params)
    modelUsageList.value = result ?? []
  } catch (error) {
    message.error('加载模型用量数据失败')
    logError('ai/model-usage-view', 'Failed to load usage by model:', error)
    modelUsageList.value = []
  }
}

/** 趋势图自己那排按钮（近7天/30天/90天）→ 天数。它以前只是长得像控件：改了不重新取数，图永远是那 7 天 */
const TREND_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

const loadUsageTrend = async () => {
  try {
    const days = TREND_DAYS[timeRange.value] ?? 7
    const end = dayjs()
    const result = await aiModelApi.getUsageTrend({
      tenantId: authStore.selectedTenantId ?? undefined,
      startDate: end.subtract(days - 1, 'day').format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    })
    usageChartData.value = result ?? []
  } catch (error) {
    message.error('加载用量趋势数据失败')
    logError('ai/model-usage-view', 'Failed to load usage trend:', error)
    usageChartData.value = []
  }
}

watch(timeRange, () => {
  loadUsageTrend()
})

const loadLogs = async () => {
  try {
    const params = {
      ...getCommonParams(),
      page: logPagination.current,
      // 后端分页参数名是 size，之前传 pageSize 会被忽略、每页固定返回 10 条
      size: logPagination.pageSize,
    }
    const result = await aiModelApi.getLogs(params)
    logList.value = result.records ?? []
    logPagination.total = result.total ?? 0
  } catch (error) {
    message.error('加载调用日志失败')
    logError('ai/model-usage-view', 'Failed to load logs:', error)
    logList.value = []
    logPagination.total = 0
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadStats(),
      loadPools(),
      loadUsageByModel(),
      loadUsageTrend(),
      loadLogs(),
    ])
  } catch (error) {
    message.error('数据加载失败')
    logError('ai/model-usage-view', 'Failed to fetch usage data:', error)
  } finally {
    loading.value = false
  }
}

const TYPE_LABELS: Record<string, string> = {
  chat: '聊天',
  embedding: '向量',
  image: '图像',
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * AI 接口没有导出端点，这里导出的是「本页已加载且经过类型/关键词筛选的行」，
 * 不是全量日志，所以按钮叫「导出本页」、提示也带条数。
 */
function exportLogs() {
  const rows = paginatedLogs.value
  if (!rows.length) {
    message.warning('本页没有可导出的日志')
    return
  }
  const header = ['时间', '模型', '类型', '提示词', 'Token', '费用(元)', '耗时(ms)', '状态']
  const lines = [header.map(csvCell).join(',')]
  for (const row of rows) {
    const type = String(row.type ?? '').toLowerCase()
    lines.push([
      row.createdAt ?? '',
      row.model ?? '',
      TYPE_LABELS[type] || row.type || '',
      row.prompt ?? '',
      row.tokens ?? '',
      row.cost ?? '',
      row.duration ?? '',
      row.status === 'success' ? '成功' : '失败',
    ].map(csvCell).join(','))
  }
  // \uFEFF BOM：没有它 Excel 会按本地编码解析，中文全成乱码
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `ai_call_logs_${dayjs().format('YYYYMMDD')}_p${logPagination.current}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  message.success(`已导出本页 ${rows.length} 条日志`)
}

// 翻页要真的重新取数：原来只有 v-model 改 current，表格一直停在首次加载的那页
watch(
  () => [logPagination.current, logPagination.pageSize],
  () => {
    loadLogs()
  },
)

// 本地筛选回看第 1 页，避免停在深页时匹配结果为空
watch(
  () => [logFilter.type, logFilter.keyword],
  () => {
    logPagination.current = 1
  },
)

watch(
  () => authStore.selectedTenantId,
  () => {
    fetchData()
  },
)

onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="less">
.model-usage-page {
  width: 100%;
}

.filter-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

/* 取数区间那一行：数本身没说错，说的是「这是哪一段的数」 */
.usage-window {
  margin-top: 8px;
  font-size: 12px;
  color: #8c8c8c;
}

.perf-value--none {
  color: #8c8c8c;
  font-weight: 400;
}

.stat-card {
  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #fff;
  }

  .stat-info {
    flex: 1;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.2;
  }

  // 「未统计」不是一个数，不许长得像读数：褪成灰、不加重，免得这一眼扫过去仍当成 ¥ 的额度
  .stat-value--none {
    color: #8c8c8c;
    font-weight: 400;
  }

  .stat-note {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #8c8c8c;
  }

  .stat-title {
    font-size: 13px;
    color: #6b7280;
    margin-top: 4px;
  }

  .stat-trend {
    font-size: 12px;
    margin-top: 8px;

    &.up {
      color: #52c41a;
    }

    &.down {
      color: #f5222d;
    }
  }
}

.mini-stat {
  text-align: center;
  padding: 8px 0;

  .mini-value {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
  }

  .mini-label {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }

  .mini-diff {
    font-size: 11px;
    margin-top: 4px;

    &.up {
      color: #52c41a;
    }

    &.down {
      color: #f5222d;
    }
  }
}

.budget-container {
  .budget-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .budget-label {
    font-size: 13px;
    color: #6b7280;
  }

  .budget-value {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
  }

  .budget-remaining {
    font-size: 13px;
    color: #6b7280;
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .budget-days {
    color: #722ed1;
    font-weight: 500;
  }
}

/*
 * 本月额度那块（G4 两池分账）。字号与配色沿用这一页既有的写法：数字 20px 强调、
 * 说明 12px 次要色，间距只用 8 的倍数（§9.5 的约定）。
 */
.pool-list {
  .pool-row + .pool-row {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }

  .pool-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pool-name {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }

  .pool-nums {
    font-size: 12px;
    color: #6b7280;
  }

  .pool-ledger {
    margin-top: 8px;
    font-size: 12px;
    color: #6b7280;
  }

  .pool-note {
    margin-top: 16px;
    font-size: 12px;
    color: #6b7280;
  }

  /* 「不限制」那一行替代进度条的位置：没有分母就没有百分比，这里留一句解释而不是画一条 0% 的条子 */
  .pool-unlimited {
    margin-top: 8px;
    font-size: 12px;
    color: #389e0d;
  }

  /*
   * 超管设 GEO 池水位那一块（V158 / N2）。放在两池列表下面、同一张卡里：
   * 它改的就是上面那一行的数，分开两处就会「改了不知道改的是哪一行」。
   */
  .geo-quota-setter {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px dashed #d9d9d9;

    .geo-quota-setter__title {
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1f2937;
    }

    .geo-quota-setter__now {
      margin-top: 8px;
      font-size: 12px;
      color: #1f2937;
    }

    .geo-quota-setter__note {
      margin-top: 4px;
      font-size: 12px;
      color: #6b7280;
    }

    .geo-quota-setter__who {
      margin-top: 4px;
      font-size: 12px;
      color: #8c8c8c;
    }
  }
}

.chart-container {
  height: 280px;
  padding: 16px 0;

  .chart-legend {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 0 16px;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #6b7280;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;

      &.token-dot {
        background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
      }

      &.cost-dot {
        background: linear-gradient(135deg, #722ed1 0%, #eb2f96 100%);
      }
    }
  }

  .chart-area {
    height: 200px;
    display: flex;
    flex-direction: column;
  }

  .chart-bars {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 0 16px;
  }

  .bar-group {
    flex: 1;
    display: flex;
    justify-content: center;
    height: 100%;
    align-items: flex-end;
  }

  .bar {
    width: 100%;
    max-width: 40px;
    border-radius: 4px 4px 0 0;
    position: relative;
    transition: height 0.3s ease;

    &.bar-token {
      background: linear-gradient(180deg, #1890ff 0%, #36cfc9 100%);
    }

    .bar-tooltip {
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      color: #6b7280;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s;
    }

    &:hover .bar-tooltip {
      opacity: 1;
    }
  }

  .chart-labels {
    display: flex;
    padding: 8px 16px 0;

    .chart-label {
      flex: 1;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
  }
}

.pie-chart-placeholder {
  .pie-visual {
    position: relative;
    width: 160px;
    height: 160px;
    margin: 0 auto;
  }

  .pie-ring {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    mask: radial-gradient(transparent 55%, #000 55%);
  }

  .pie-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;

    .pie-total {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .pie-label {
      font-size: 11px;
      color: #6b7280;
    }
  }

  .pie-legend {
    margin-top: 20px;
    padding: 0 8px;

    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .legend-color-block {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }

    .legend-model-name {
      flex: 1;
      color: #374151;
    }

    .legend-percent {
      color: #722ed1;
      font-weight: 500;
    }
  }
}

.performance-list {
  .performance-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #f3f4f6;

    &:last-child {
      border-bottom: none;
    }

    .perf-label {
      font-size: 13px;
      color: #6b7280;
    }

    .perf-value {
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
    }
  }
}

.tokens-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #f0f5ff;
  color: #1890ff;
  border-radius: 4px;
  font-size: 12px;
}

.cost-value {
  color: #722ed1;
  font-weight: 500;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
