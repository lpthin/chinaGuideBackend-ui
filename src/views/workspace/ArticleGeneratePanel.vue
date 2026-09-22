<template>
  <div class="article-generate-page">
    <a-spin :spinning="loading">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="page-header__left">
          <h1 class="page-header__title">AI 文章生成</h1>
          <span class="page-header__subtitle">智能驱动，一键生成高质量内容</span>
        </div>
        <a-button @click="showTemplateEditor = true">
          <template #icon><EditOutlined /></template>
          模板管理
        </a-button>
      </div>

      <!-- 统计卡片 -->
      <a-row :gutter="16" class="stat-row">
        <a-col :xs="12" :sm="6" v-for="item in statItems" :key="item.key">
          <div class="stat-card" :class="`stat-card--${item.color}`" @click="navigateTo(item.path)">
            <div class="stat-card__icon"><component :is="item.icon" /></div>
            <div class="stat-card__body">
              <div class="stat-card__value">{{ item.value }}<span class="stat-card__unit">{{ item.unit }}</span></div>
              <div class="stat-card__label">{{ item.label }}</div>
            </div>
          </div>
        </a-col>
      </a-row>

      <!-- 生成方式 -->
      <div class="generate-card">
        <a-tabs v-model:activeKey="activeTab" size="default">
          <!-- 热词驱动 -->
          <a-tab-pane key="keyword">
            <template #tab><FireOutlined /> 热词驱动</template>
            <a-form layout="vertical">
              <a-row :gutter="16">
                <a-col :span="8">
                  <a-form-item label="精选关键词">
                    <a-select v-model:value="selectedKeyword" placeholder="请选择" show-search option-label-prop="label">
                      <a-select-option v-for="kw in keywordsList" :key="kw.id" :value="kw.name" :label="kw.name">
                        <span style="display:inline-flex;align-items:center;gap:6px;width:100%;justify-content:space-between">
                          <span>{{ kw.name }}</span>
                          <span style="display:inline-flex;align-items:center;gap:4px;flex-shrink:0">
                            <a-tag v-if="kw.category" color="blue">{{ kw.category }}</a-tag>
                            <a-tag v-if="(kw.articleCount || 0) > 0" color="green">已生成文章</a-tag>
                            <a-tag v-else-if="(kw.suggestionCount || 0) > 0" color="orange">已有内容建议</a-tag>
                            <a-tag v-else color="default">未生产</a-tag>
                          </span>
                        </span>
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="文章模板">
                    <a-select v-model:value="selectedTemplate">
                      <a-select-option value="default">默认模板</a-select-option>
                      <a-select-option value="guide">指南型</a-select-option>
                      <a-select-option value="review">评测型</a-select-option>
                      <a-select-option value="news">新闻型</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="5">
                  <a-form-item label="字数">
                    <a-slider v-model:value="articleLength" :min="500" :max="3000" :step="100" />
                  </a-form-item>
                </a-col>
                <a-col :span="5">
                  <a-form-item label="风格">
                    <a-select v-model:value="articleStyle">
                      <a-select-option value="professional">专业严谨</a-select-option>
                      <a-select-option value="friendly">亲和易懂</a-select-option>
                      <a-select-option value="creative">创意活泼</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="语气">
                    <a-radio-group v-model:value="articleTone" button-style="solid">
                      <a-radio-button value="neutral">中性客观</a-radio-button>
                      <a-radio-button value="positive">积极正向</a-radio-button>
                      <a-radio-button value="critical">批判性</a-radio-button>
                    </a-radio-group>
                  </a-form-item>
                </a-col>
                <a-col :span="12" style="text-align: right">
                  <a-button @click="showTemplatePreview = true"><EyeOutlined /> 预览模板</a-button>
                </a-col>
              </a-row>
            </a-form>
          </a-tab-pane>

          <!-- 案例驱动 -->
          <a-tab-pane key="case">
            <template #tab><TrophyOutlined /> 案例驱动</template>
            <a-form layout="vertical">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="选择案例">
                    <a-select v-model:value="selectedCase" placeholder="请选择案例" show-search
                      :filter-option="(input: string, option: any) => option?.children?.[0]?.children?.toLowerCase().includes(input.toLowerCase())">
                      <a-select-option v-for="c in casesList" :key="c.id" :value="c.id">{{ c.title }}</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="案例模板">
                    <a-select v-model:value="selectedCaseTemplate">
                      <a-select-option value="success">成功案例</a-select-option>
                      <a-select-option value="story">故事型</a-select-option>
                      <a-select-option value="data">数据驱动</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-form-item label="亮点提取">
                <a-checkbox-group v-model:value="highlightOptions">
                  <a-checkbox value="data">数据亮点</a-checkbox>
                  <a-checkbox value="method">方法论</a-checkbox>
                  <a-checkbox value="result">成果展示</a-checkbox>
                  <a-checkbox value="challenge">挑战与克服</a-checkbox>
                </a-checkbox-group>
              </a-form-item>
              <div v-if="selectedCaseData" style="margin-top: 8px">
                <a-button @click="showCasePreview = true"><EyeOutlined /> 预览案例</a-button>
              </div>
            </a-form>
          </a-tab-pane>

          <!-- 文档驱动 -->
          <a-tab-pane key="document">
            <template #tab><FileTextOutlined /> 文档驱动</template>
            <a-form layout="vertical">
              <a-form-item label="上传文档">
                <a-upload-dragger v-model:file-list="uploadedDocuments" name="file"
                  accept=".docx,.pdf,.txt" :before-upload="beforeDocumentUpload"
                  @remove="handleDocumentRemove" @change="handleDocumentChange" :max-count="5">
                  <p class="ant-upload-text"><InboxOutlined /> 点击或拖拽上传</p>
                  <p class="ant-upload-hint">支持 .docx / .pdf / .txt，单个 ≤ 10MB</p>
                </a-upload-dragger>
              </a-form-item>
              <a-row :gutter="16">
                <a-col :span="6">
                  <a-form-item label="模板">
                    <a-select v-model:value="selectedDocumentTemplate">
                      <a-select-option value="default">默认</a-select-option>
                      <a-select-option value="guide">指南型</a-select-option>
                      <a-select-option value="review">评测型</a-select-option>
                      <a-select-option value="news">新闻型</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="字数">
                    <a-slider v-model:value="documentArticleLength" :min="500" :max="3000" :step="100" />
                  </a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="风格">
                    <a-select v-model:value="documentArticleStyle">
                      <a-select-option value="professional">专业严谨</a-select-option>
                      <a-select-option value="friendly">亲和易懂</a-select-option>
                      <a-select-option value="creative">创意活泼</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="语气">
                    <a-radio-group v-model:value="documentArticleTone" button-style="solid">
                      <a-radio-button value="neutral">中性</a-radio-button>
                      <a-radio-button value="positive">积极</a-radio-button>
                      <a-radio-button value="critical">批判</a-radio-button>
                    </a-radio-group>
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-tab-pane>

          <!-- 自定义主题 -->
          <a-tab-pane key="custom">
            <template #tab><EditOutlined /> 自定义主题</template>
            <a-form layout="vertical">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="文章主题">
                    <a-textarea v-model:value="customTopic" :rows="3"
                      placeholder="输入文章主题，例如：数字化转型对中小企业的影响..." />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="关键词">
                    <a-select v-model:value="customKeywords" mode="tags" placeholder="输入关键词后回车" />
                  </a-form-item>
                  <a-form-item label="目标受众">
                    <a-select v-model:value="targetAudience">
                      <a-select-option value="general">普通读者</a-select-option>
                      <a-select-option value="professional">专业人士</a-select-option>
                      <a-select-option value="business">企业决策者</a-select-option>
                      <a-select-option value="student">学生群体</a-select-option>
                      <a-select-option value="technical">技术人员</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>
              <a-row :gutter="16">
                <a-col :span="6">
                  <a-form-item label="模板">
                    <a-select v-model:value="selectedCustomTemplate">
                      <a-select-option value="default">默认</a-select-option>
                      <a-select-option value="guide">指南型</a-select-option>
                      <a-select-option value="review">评测型</a-select-option>
                      <a-select-option value="news">新闻型</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="字数">
                    <a-slider v-model:value="customArticleLength" :min="500" :max="3000" :step="100" />
                  </a-form-item>
                </a-col>
                <a-col :span="6">
                  <a-form-item label="风格">
                    <a-select v-model:value="customArticleStyle">
                      <a-select-option value="professional">专业严谨</a-select-option>
                      <a-select-option value="friendly">亲和易懂</a-select-option>
                      <a-select-option value="creative">创意活泼</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="6" style="display: flex; align-items: flex-end; justify-content: flex-end">
                  <a-button @click="showCustomPreview = true"><EyeOutlined /> 预览</a-button>
                </a-col>
              </a-row>
            </a-form>
          </a-tab-pane>
          <!-- 聚类建议驱动 -->
          <a-tab-pane key="cluster">
            <template #tab><AppstoreOutlined /> 聚类建议</template>

            <!-- 聚类选择器 -->
            <a-form layout="vertical">
              <a-row :gutter="16">
                <a-col :span="16">
                  <a-form-item label="选择聚类">
                    <a-select
                      v-model:value="selectedClusterId"
                      placeholder="请选择聚类"
                      show-search
                      :filter-option="(input: string, option: any) => option?.children?.[0]?.children?.toLowerCase().includes(input.toLowerCase())"
                      @change="onClusterSelect"
                    >
                      <a-select-option v-for="c in clusterList" :key="c.id" :value="c.id">
                        {{ c.name }} · 优先级{{ c.priority ?? '-' }}
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="8" style="text-align: right; padding-top: 32px">
                  <a-button @click="loadClusterList">刷新聚类</a-button>
                  <a-button type="link" @click="router.push({ name: 'workspace-cluster' })">去聚类蒸馏</a-button>
                </a-col>
              </a-row>
            </a-form>

            <div v-if="clusterInfo" class="cluster-info-bar">
              <div class="cluster-info-bar__name">{{ clusterInfo.name }}</div>
              <div class="cluster-info-bar__meta">
                <a-tag v-if="clusterInfo.category" color="blue">{{ clusterInfo.category }}</a-tag>
                <a-tag v-if="clusterInfo.searchIntent" color="green">{{ clusterInfo.searchIntent }}</a-tag>
                <span v-if="clusterInfo.articleDirection" class="cluster-info-bar__dir">{{ clusterInfo.articleDirection }}</span>
              </div>
            </div>

            <div v-if="clusterInfo && clusterSuggestions.length === 0" class="empty-cluster-suggestions">
              <a-empty description="该聚类暂无内容建议">
                <a-button type="primary" @click="generateSuggestionsForCluster">重新生成建议</a-button>
              </a-empty>
            </div>

            <a-row v-if="clusterSuggestions.length > 0" :gutter="[12, 12]">
              <a-col :xs="24" :sm="12" :lg="8" v-for="(sug, idx) in clusterSuggestions" :key="sug.id">
                <div
                  class="suggestion-pick-card"
                  :class="{ 'suggestion-pick-card--active': selectedSuggestionId === sug.id }"
                  @click="selectedSuggestionId = sug.id"
                >
                  <div class="suggestion-pick-card__head">
                    <span class="suggestion-pick-card__index">{{ idx + 1 }}</span>
                    <span class="suggestion-pick-card__title">{{ sug.title }}</span>
                    <CheckOutlined v-if="selectedSuggestionId === sug.id" class="suggestion-pick-card__check" />
                  </div>
                  <div class="suggestion-pick-card__prompt">{{ sug.contentPrompt || sug.reason || '—' }}</div>
                  <div class="suggestion-pick-card__footer">
                    <span v-if="sug.score" class="suggestion-pick-card__score">分数 {{ sug.score }}</span>
                    <span v-if="sug.status" class="suggestion-pick-card__status">{{ sug.status }}</span>
                  </div>
                </div>
              </a-col>
            </a-row>

            <a-row v-if="clusterSuggestions.length > 0" :gutter="16" style="margin-top: 16px">
              <a-col :span="6">
                <a-form-item label="文章模板">
                  <a-select v-model:value="selectedTemplate">
                    <a-select-option value="default">默认模板</a-select-option>
                    <a-select-option value="guide">指南型</a-select-option>
                    <a-select-option value="review">评测型</a-select-option>
                    <a-select-option value="news">新闻型</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="5">
                <a-form-item label="字数">
                  <a-slider v-model:value="articleLength" :min="500" :max="3000" :step="100" />
                </a-form-item>
              </a-col>
              <a-col :span="5">
                <a-form-item label="风格">
                  <a-select v-model:value="articleStyle">
                    <a-select-option value="professional">专业严谨</a-select-option>
                    <a-select-option value="friendly">亲和易懂</a-select-option>
                    <a-select-option value="creative">创意活泼</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="语气">
                  <a-radio-group v-model:value="articleTone" button-style="solid">
                    <a-radio-button value="neutral">中性客观</a-radio-button>
                    <a-radio-button value="positive">积极正向</a-radio-button>
                    <a-radio-button value="critical">批判性</a-radio-button>
                  </a-radio-group>
                </a-form-item>
              </a-col>
            </a-row>
          </a-tab-pane>
        </a-tabs>

        <!-- 操作条 -->
        <div class="action-bar">
          <a-space size="middle">
            <a-switch v-model:checked="useKnowledge" checked-children="知识库引用" un-checked-children="知识库引用" />
            <a-button @click="loadTokenStats">Token 统计</a-button>
            <a-button @click="openAnalysisDrawer">质量分析</a-button>
          </a-space>
          <a-button type="primary" size="large" :loading="generating" @click="generateArticle">
            <template #icon><RocketOutlined /></template>
            {{ generating ? '生成中...' : '开始生成' }}
          </a-button>
        </div>

        <!-- 生成进度 -->
        <div v-if="generating" class="generating-progress">
          <div class="progress-info">
            <span>{{ progressText }}</span>
            <span>{{ Math.floor(generateProgress) }}%</span>
            <a-button type="text" danger size="small" @click="cancelGeneration" :loading="isCanceling">取消</a-button>
          </div>
          <a-progress :percent="Math.floor(generateProgress)" status="active" :show-info="false" />
        </div>
      </div>

      <!-- 本次生成任务 -->
      <div class="list-card">
        <div class="toolbar">
          <a-space wrap size="middle" class="toolbar-fill">
            <span class="list-hint">
              本页只负责生成：共 {{ generationTasks.length }} 个任务，已生成 {{ generatedArticleCount }} 篇。
              审核请在「审核管理」处理，发布与删除请在「发布中心 / 文章管理」处理。
            </span>
            <a-space>
              <span v-if="selectedRowKeys.length > 0" class="selected-count">已选 {{ selectedRowKeys.length }} 项</span>
              <a-button v-if="selectedRowKeys.length > 0" size="small" type="primary" @click="batchSubmitReview">
                <template #icon><SendOutlined /></template>
                批量送审
              </a-button>
              <a-button size="small" @click="router.push({ name: 'workspace-articles' })">
                <template #icon><FileTextOutlined /></template>
                前往文章管理
              </a-button>
            </a-space>
          </a-space>
        </div>
        <a-table :scroll="{ x: 'max-content' }" :data-source="generationTasks" :columns="taskColumns"
          row-key="taskId" :pagination="false" size="middle" :row-selection="taskRowSelection">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'driver'">
              <a-tag>{{ driverLabel(record.driver) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'title'">
              <span>{{ record.title || record.topic || '-' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="taskStatusMeta(record.status).color">{{ taskStatusMeta(record.status).label }}</a-tag>
              <div v-if="record.errorMessage" class="task-error">{{ record.errorMessage }}</div>
            </template>
            <template v-else-if="column.key === 'progress'">
              <a-progress :percent="Math.floor(record.progress || 0)" size="small" :show-info="false"
                style="width: 100px" />
            </template>
            <template v-else-if="column.key === 'stage'">
              <span>{{ record.stage || '-' }}</span>
            </template>
            <template v-else-if="column.key === 'articleStatus'">
              <a-tag v-if="record.articleStatus" :color="articleStatusMeta(record.articleStatus).color">
                {{ articleStatusMeta(record.articleStatus).label }}
              </a-tag>
              <span v-else>-</span>
            </template>
            <template v-else-if="column.key === 'wordCount'">
              <span>{{ record.wordCount ?? '-' }}</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              <span>{{ formatDate(record.createdAt) }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" :disabled="!record.articleId" @click="viewArticle(record)">
                查看文章
              </a-button>
              <a-button type="link" size="small" :disabled="!canSubmitReview(record)" @click="submitForReview(record)">
                送审
              </a-button>
            </template>
          </template>
        </a-table>
      </div>

      <!-- 质量分析抽屉 -->
      <a-drawer title="生成记录与质量分析" v-model:open="showAnalysisDrawer" width="90%"
        @after-open="handleDrawerOpen">
        <a-row :gutter="16">
          <a-col :xs="24" :lg="10">
            <div class="chart-card">
              <h3>生成成功率趋势</h3>
              <div ref="trendChartRef" class="chart-container"></div>
            </div>
          </a-col>
          <a-col :xs="24" :lg="7">
            <div class="chart-card">
              <h3>模板使用统计</h3>
              <div ref="templateChartRef" class="chart-container"></div>
            </div>
          </a-col>
          <a-col :xs="24" :lg="7">
            <div class="chart-card">
              <h3>质量分布分析</h3>
              <div ref="qualityChartRef" class="chart-container"></div>
            </div>
          </a-col>
        </a-row>
      </a-drawer>

      <!-- 模板编辑弹窗 -->
      <a-modal v-model:open="showTemplateEditor" title="自定义模板编辑" width="700px"
        :confirm-loading="templateSaving" @ok="saveTemplate">
        <a-form layout="vertical">
          <a-form-item label="模板名称">
            <a-input v-model:value="editingTemplate.name" />
          </a-form-item>
          <a-form-item label="模板内容">
            <a-textarea v-model:value="editingTemplate.content" :rows="10"
              placeholder="使用 {keyword} 作为关键词占位符..." />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 模板预览弹窗 -->
      <a-modal v-model:open="showTemplatePreview" title="模板预览" width="600px" :footer="null">
        <div class="preview-content">
          <p class="preview-title">【标题】{{ selectedKeyword || '关键词' }}的完整指南</p>
          <p class="preview-paragraph">【引言】介绍{{ selectedKeyword || '关键词' }}的背景和重要性...</p>
          <p class="preview-paragraph">【正文一】详细阐述{{ selectedKeyword || '关键词' }}的核心概念...</p>
          <p class="preview-paragraph">【正文二】深入分析{{ selectedKeyword || '关键词' }}的应用场景...</p>
          <p class="preview-paragraph">【结论】总结核心要点，展望未来...</p>
        </div>
      </a-modal>

      <!-- 案例预览弹窗 -->
      <a-modal v-model:open="showCasePreview" title="案例预览" width="600px" :footer="null">
        <div v-if="selectedCaseData">
          <h3>{{ selectedCaseData.title }}</h3>
          <div class="case-highlights">
            <div class="highlights-title">核心亮点</div>
            <div v-for="(p, i) in selectedCaseData.highlights" :key="i" class="highlight-item">
              <StarOutlined class="highlight-icon" /> {{ p }}
            </div>
          </div>
        </div>
      </a-modal>

      <!-- 文档预览弹窗 -->
      <a-modal v-model:open="showDocumentPreview" title="文档生成模板预览" width="600px" :footer="null">
        <div class="preview-content">
          <p class="preview-title">【标题】基于文档内容的深度分析</p>
          <p class="preview-paragraph">【引言】根据上传文档的核心内容，提炼关键信息...</p>
          <p class="preview-paragraph">【正文一】深入分析文档中的核心观点...</p>
          <p class="preview-paragraph">【正文二】结合文档数据和案例，展开论证...</p>
          <p class="preview-paragraph">【结论】总结文档要点，提出见解...</p>
        </div>
      </a-modal>

      <!-- 自定义预览弹窗 -->
      <a-modal v-model:open="showCustomPreview" title="自定义主题预览" width="600px" :footer="null">
        <div class="preview-content">
          <p class="preview-title">【标题】{{ customTopic || '自定义主题' }}</p>
          <p class="preview-paragraph">【关键词】{{ customKeywords.length > 0 ? customKeywords.join('、') : '暂无' }}</p>
          <p class="preview-paragraph">【目标受众】{{ getAudienceName(targetAudience) }}</p>
          <p class="preview-paragraph">【预期字数】{{ customArticleLength }} 字</p>
        </div>
      </a-modal>

      <!-- Token 统计弹窗 -->
      <a-modal v-model:open="showTokenStats" title="Token 消耗统计" width="720px" :footer="null">
        <div v-if="tokenStats" class="token-stats-content">
          <a-row :gutter="[16, 16]" style="margin-bottom: 16px">
            <a-col :span="6"><a-card size="small"><a-statistic title="总任务" :value="tokenStats.totalTasks" /></a-card></a-col>
            <a-col :span="6"><a-card size="small"><a-statistic title="成功" :value="tokenStats.completedTasks" :value-style="{ color: '#52c41a' }" /></a-card></a-col>
            <a-col :span="6"><a-card size="small"><a-statistic title="失败" :value="tokenStats.failedTasks" :value-style="{ color: '#ff4d4f' }" /></a-card></a-col>
            <a-col :span="6"><a-card size="small"><a-statistic title="总Token" :value="tokenStats.totalTokens" :value-style="{ color: '#1890ff' }" /></a-card></a-col>
          </a-row>
          <a-row :gutter="[16, 16]" style="margin-bottom: 16px">
            <a-col :span="12"><a-card size="small"><a-statistic title="输入Token" :value="tokenStats.totalPromptTokens" /></a-card></a-col>
            <a-col :span="12"><a-card size="small"><a-statistic title="输出Token" :value="tokenStats.totalCompletionTokens" /></a-card></a-col>
          </a-row>
          <a-table :scroll="{ x: 'max-content' }" v-if="tokenStats.modelStats?.length > 0" :columns="tokenStatColumns"
            :data-source="tokenStats.modelStats" row-key="modelName" size="small" :pagination="false" />
          <a-empty v-else description="暂无数据" />
        </div>
        <a-spin v-else />
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, nextTick, watch } from 'vue'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import {
  FileTextOutlined, EditOutlined, SendOutlined, ClockCircleOutlined,
  RocketOutlined, StarOutlined, FireOutlined, TrophyOutlined,
  EyeOutlined, AppstoreOutlined, CheckOutlined,
  InboxOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import { articleApi, dashboardApi, keywordApi, clusterApi } from '../../api'
import { caseApi } from '../../api/case'
import { articleTemplateApi } from '../../api/articleTemplate'
import { describeHttpError } from '../../api/http'
import { formatDate } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { articleStatusMeta, ARTICLE_STATUS } from '../../utils/contentStatus'
import type { ArticleStatus } from '../../utils/contentStatus'
import type { KeywordCluster, KeywordContentSuggestion } from '../../types/workspace'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

/** 接口参数是 number | undefined，而 selectedTenantId 是 number | null，统一在此收敛 */
const tenantId = computed<number | undefined>(() => authStore.selectedTenantId ?? undefined)

const loading = ref(false)
const generating = ref(false)
const activeTab = ref('keyword')

// 聚类驱动模式
const clusterMode = ref(false)
const clusterInfo = ref<any>(null)
const clusterSuggestions = ref<KeywordContentSuggestion[]>([])
const selectedSuggestionId = ref<number | null>(null)
const clusterList = ref<KeywordCluster[]>([])
const selectedClusterId = ref<number | null>(null)
const showTemplateEditor = ref(false)
const showTemplatePreview = ref(false)
const showCasePreview = ref(false)
const showDocumentPreview = ref(false)
const showCustomPreview = ref(false)
const useKnowledge = ref(true)
const generateProgress = ref(0)
const progressText = ref('准备生成...')
const currentTaskId = ref<number | null>(null)
let pollTimer: any = null
let sseSource: EventSource | null = null
const isCanceling = ref(false)
const selectedRowKeys = ref<number[]>([])
const highlightOptions = ref<string[]>(['data', 'result'])
const showAnalysisDrawer = ref(false)

// Token 统计
const showTokenStats = ref(false)
const tokenStats = ref<any>(null)
const tokenStatColumns = [
  { title: '模型名称', dataIndex: 'modelName', key: 'modelName' },
  { title: '任务数', dataIndex: 'taskCount', key: 'taskCount', width: 80 },
  { title: '输入Token', dataIndex: 'promptTokens', key: 'promptTokens' },
  { title: '输出Token', dataIndex: 'completionTokens', key: 'completionTokens' },
  { title: '总Token', dataIndex: 'totalTokens', key: 'totalTokens' },
]

// 本次生成任务（后端无任务列表接口，任务记录仅存在于当前会话）
type GenerationTask = {
  taskId: number
  driver: string
  topic: string
  status: string
  progress: number
  stage: string
  createdAt: string
  articleId?: number
  title?: string
  wordCount?: number
  errorMessage?: string
  articleStatus?: ArticleStatus
}

/** 生成任务状态来自 getGenerationStatus / SSE，取值是大写字符串，不属于文章状态词表 */
const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: '排队中', color: 'default' },
  PROCESSING: { label: '生成中', color: 'processing' },
  RETRYING: { label: '重试中', color: 'warning' },
  COMPLETED: { label: '已完成', color: 'success' },
  FAILED: { label: '失败', color: 'error' },
  CANCELLED: { label: '已取消', color: 'default' },
}

function taskStatusMeta(status?: string) {
  if (!status) return { label: '-', color: 'default' }
  return TASK_STATUS_META[status.toUpperCase()] ?? { label: status, color: 'default' }
}

const DRIVER_LABELS: Record<string, string> = {
  keyword: '热词驱动',
  cluster: '聚类建议',
  case: '案例驱动',
  document: '文档驱动',
  custom: '自定义主题',
}

function driverLabel(driver?: string) {
  return (driver && DRIVER_LABELS[driver]) || '-'
}

const generationTasks = ref<GenerationTask[]>([])

const generatedArticleCount = computed(
  () => generationTasks.value.filter(t => !!t.articleId).length,
)

const taskColumns = [
  { title: '任务', dataIndex: 'taskId', key: 'taskId', width: 70 },
  { title: '生成入口', dataIndex: 'driver', key: 'driver', width: 100 },
  { title: '标题 / 主题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '任务状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '进度', dataIndex: 'progress', key: 'progress', width: 130 },
  { title: '当前阶段', dataIndex: 'stage', key: 'stage', width: 140 },
  { title: '文章状态', dataIndex: 'articleStatus', key: 'articleStatus', width: 100 },
  { title: '字数', dataIndex: 'wordCount', key: 'wordCount', width: 80 },
  { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
  { title: '操作', key: 'action', width: 160, fixed: 'right' as const },
]

const taskRowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Array<string | number>) => {
    selectedRowKeys.value = keys.filter((k): k is number => typeof k === 'number')
  },
  // 只有已生成、且仍是草稿（未送审）的任务可勾选，避免重复送审
  getCheckboxProps: (record: GenerationTask) => ({ disabled: !canSubmitReview(record) }),
}))

// 图表
const trendChartRef = ref<HTMLElement>()
const templateChartRef = ref<HTMLElement>()
const qualityChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let templateChart: echarts.ECharts | null = null
let qualityChart: echarts.ECharts | null = null

const stats = reactive({
  totalArticles: 0,
  draftCount: 0,
  publishedCount: 0,
  pendingCount: 0,
})

const statItems = computed(() => [
  { key: 'total', label: '文章总数', value: stats.totalArticles, unit: '篇', icon: FileTextOutlined, color: 'blue', path: '/workspace/articles' },
  { key: 'draft', label: `${ARTICLE_STATUS.draft.label}数`, value: stats.draftCount, unit: '篇', icon: EditOutlined, color: 'purple', path: '/workspace/articles?status=draft' },
  { key: 'published', label: ARTICLE_STATUS.published.label, value: stats.publishedCount, unit: '篇', icon: SendOutlined, color: 'green', path: '/workspace/articles?status=published' },
  { key: 'pending', label: ARTICLE_STATUS.pending_review.label, value: stats.pendingCount, unit: '篇', icon: ClockCircleOutlined, color: 'orange', path: '/workspace/articles?status=pending_review' },
])

function navigateTo(path: string) {
  router.push(path)
}

// 表单状态
const selectedKeyword = ref('')
const selectedTemplate = ref('default')
const articleLength = ref(1500)
const articleStyle = ref('professional')
const articleTone = ref('neutral')

const selectedCase = ref<number>()
const selectedCaseTemplate = ref('success')
const caseSearch = ref('')

const uploadedDocuments = ref<any[]>([])
const selectedDocument = ref<any>(null)
const documentPreviewContent = ref('')
const selectedDocumentTemplate = ref('default')
const documentArticleLength = ref(1500)
const documentArticleStyle = ref('professional')
const documentArticleTone = ref('neutral')

const customTopic = ref('')
const customKeywords = ref<string[]>([])
const targetAudience = ref('general')
const selectedCustomTemplate = ref('default')
const customArticleLength = ref(1500)
const customArticleStyle = ref('professional')
const customArticleTone = ref('neutral')

const editingTemplate = reactive({ name: '', content: '' })
const templateSaving = ref(false)

type KeywordOption = {
  id: number
  name: string
  category?: string
  intentValue: number
  searchVolume: number
  suggestionCount: number
  articleCount: number
  status?: string
}

const keywordsList = ref<KeywordOption[]>([])
const casesList = ref<{ id: number; title: string; highlights: string[] }[]>([])

const filteredCases = computed(() => {
  if (!caseSearch.value) return casesList.value
  return casesList.value.filter(c => c.title.includes(caseSearch.value))
})

const selectedCaseData = computed(() => {
  if (!selectedCase.value) return null
  return casesList.value.find(c => c.id === selectedCase.value)
})

function getAudienceName(audience: string) {
  const map: Record<string, string> = {
    general: '普通读者', professional: '专业人士',
    business: '企业决策者', student: '学生群体', technical: '技术人员',
  }
  return map[audience] || '-'
}

function beforeDocumentUpload(file: any) {
  const isDocx = file.name?.endsWith('.docx')
  const isPdf = file.name?.endsWith('.pdf')
  const isTxt = file.name?.endsWith('.txt')
  if (!isDocx && !isPdf && !isTxt) {
    message.error('只能上传 .docx、.pdf、.txt 格式')
    return false
  }
  if (file.size / 1024 / 1024 > 10) {
    message.error('文件不能超过 10MB')
    return false
  }
  return true
}

function handleDocumentRemove(file: any) {
  if (selectedDocument.value?.uid === file.uid) {
    selectedDocument.value = null
    documentPreviewContent.value = ''
  }
}

function handleDocumentChange(info: any) {
  if (info.file.status === 'done') message.success(`${info.file.name} 上传成功`)
  else if (info.file.status === 'error') message.error(`${info.file.name} 上传失败`)
}

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED']

function isTerminal(status?: string) {
  return !!status && TERMINAL_STATUSES.includes(status.toUpperCase())
}

function addTask(taskId: number, driver: string, topic: string) {
  generationTasks.value.unshift({
    taskId,
    driver,
    topic,
    status: 'PENDING',
    progress: 0,
    stage: '任务已提交',
    createdAt: new Date().toISOString(),
  })
}

type TaskUpdate = Partial<Pick<GenerationTask,
  'status' | 'progress' | 'stage' | 'articleId' | 'title' | 'wordCount' | 'errorMessage'
>>

function applyTaskUpdate(taskId: number, patch: TaskUpdate) {
  const task = generationTasks.value.find(t => t.taskId === taskId)
  if (!task) return
  if (patch.status !== undefined) task.status = patch.status
  if (patch.progress !== undefined) task.progress = patch.progress
  if (patch.stage !== undefined) task.stage = patch.stage
  if (patch.articleId !== undefined) task.articleId = patch.articleId
  if (patch.title !== undefined) task.title = patch.title
  if (patch.wordCount !== undefined) task.wordCount = patch.wordCount
  if (patch.errorMessage !== undefined) task.errorMessage = patch.errorMessage
}

function findTask(taskId: number) {
  return generationTasks.value.find(t => t.taskId === taskId)
}

/** 文章状态只有后端知道，生成完成后回读一次，缺失就显示 '-' */
async function refreshArticleStatus(task: GenerationTask) {
  if (!task.articleId) {
    // SSE 的 complete 负载不一定带 articleId，回读任务状态补齐
    try {
      applyTaskUpdate(task.taskId, await articleApi.getGenerationStatus(task.taskId))
    } catch (error) {
      console.error(error)
      message.error('回读生成任务失败')
    }
  }
  if (!task.articleId) return
  try {
    const article = await articleApi.get(task.articleId, tenantId.value)
    task.articleStatus = article?.status
  } catch (error) {
    console.error(error)
    message.error('获取文章状态失败')
  }
}

async function loadStats() {
  loading.value = true
  try {
    const statsData = await dashboardApi.getStats(tenantId.value)
    stats.totalArticles = statsData?.totalArticles ?? 0
    stats.draftCount = statsData?.draftCount ?? 0
    stats.publishedCount = statsData?.publishedCount ?? 0
    stats.pendingCount = statsData?.pendingReview ?? 0
  } catch (error) {
    console.error(error)
    message.error('加载统计数据失败')
  } finally {
    loading.value = false
  }
}

async function cancelGeneration() {
  const taskId = currentTaskId.value
  if (!taskId) return
  isCanceling.value = true
  try {
    await articleApi.cancelGeneration(taskId)
    applyTaskUpdate(taskId, { status: 'CANCELLED', stage: '已取消' })
    message.info('已取消生成任务')
  } catch (error) {
    console.error(error)
    message.error('取消生成任务失败')
  } finally {
    isCanceling.value = false
    clearPolling()
    resetGenerationState()
  }
}

function clearPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  clearSSE()
}

function clearSSE() {
  if (sseSource) { sseSource.close(); sseSource = null }
}

function resetGenerationState() {
  generating.value = false
  generateProgress.value = 0
  progressText.value = '准备生成...'
  currentTaskId.value = null
}

async function handleTaskComplete(taskId: number, res: TaskUpdate) {
  clearPolling()
  applyTaskUpdate(taskId, res)
  resetGenerationState()
  const status = (res.status || '').toUpperCase()
  if (status === 'COMPLETED') {
    message.success('文章生成成功')
    const task = findTask(taskId)
    if (task) await refreshArticleStatus(task)
    await loadStats()
  } else if (status === 'FAILED') {
    message.error(res.errorMessage || '生成失败')
  } else if (status === 'CANCELLED') {
    message.info('已取消生成任务')
  }
}

function pollTaskStatus(taskId: number) {
  pollTimer = setInterval(async () => {
    try {
      const res = await articleApi.getGenerationStatus(taskId)
      generateProgress.value = res.progress ?? 0
      progressText.value = res.stage || '处理中...'
      applyTaskUpdate(taskId, res)
      if (isTerminal(res.status)) await handleTaskComplete(taskId, res)
    } catch (error) {
      console.error(error)
      clearPolling()
      resetGenerationState()
      message.error('查询生成进度失败，请到文章管理确认生成结果')
    }
  }, 2000)
}

async function trySSE(taskId: number): Promise<boolean> {
  if (typeof EventSource === 'undefined') return false
  return new Promise<boolean>((resolve) => {
    let resolved = false
    let fallbackTimer: any = null
    try {
      const source = articleApi.streamGenerationStatus(taskId)
      sseSource = source
      fallbackTimer = setTimeout(() => {
        if (!resolved) { resolved = true; clearSSE(); resolve(false) }
      }, 3000)
      source.addEventListener('connected', () => {
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null }
      })
      source.addEventListener('progress', (event: Event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          generateProgress.value = data.progress ?? 0
          progressText.value = data.stage || '处理中...'
          applyTaskUpdate(taskId, data)
        } catch (e) { console.error('解析 SSE progress 失败', e) }
      })
      source.addEventListener('complete', (event: Event) => {
        if (resolved) return
        resolved = true
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null }
        try {
          const data = JSON.parse((event as MessageEvent).data)
          handleTaskComplete(taskId, data)
          resolve(true)
        } catch (e) {
          clearSSE(); resolve(false)
        }
      })
      source.addEventListener('error', () => {
        if (resolved) return
        resolved = true
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null }
        clearSSE(); resolve(false)
      })
    } catch (e) {
      if (fallbackTimer) clearTimeout(fallbackTimer)
      clearSSE(); resolve(false)
    }
  })
}

async function generateArticle() {
  generating.value = true
  generateProgress.value = 0
  isCanceling.value = false

  const initialTextMap: Record<string, string> = {
    keyword: '正在分析关键词...',
    cluster: '正在分析聚类建议...',
    case: '正在分析案例...',
    document: '正在解析文档...',
    custom: '正在分析主题...',
  }
  progressText.value = initialTextMap[activeTab.value] || '处理中...'

  try {
    let params: any = { useKnowledge: useKnowledge.value }
    let topic = ''

    if (activeTab.value === 'cluster') {
      if (!selectedSuggestionId.value) { message.warning('请先选择一条内容建议'); generating.value = false; return }
      const suggestion = clusterSuggestions.value.find(s => s.id === selectedSuggestionId.value)
      topic = suggestion?.title || clusterInfo.value?.name || `建议 #${selectedSuggestionId.value}`
      params.type = 'keyword'
      params.suggestionId = selectedSuggestionId.value
      params.templateType = selectedTemplate.value
      params.articleLength = articleLength.value
      params.articleStyle = articleStyle.value
      params.articleTone = articleTone.value
    } else if (activeTab.value === 'keyword') {
      if (!selectedKeyword.value) { message.warning('请先选择关键词'); generating.value = false; return }
      topic = selectedKeyword.value
      params.type = 'keyword'
      params.keyword = selectedKeyword.value
      params.templateType = selectedTemplate.value
      params.articleLength = articleLength.value
      params.articleStyle = articleStyle.value
      params.articleTone = articleTone.value
    } else if (activeTab.value === 'case') {
      if (!selectedCase.value) { message.warning('请先选择案例'); generating.value = false; return }
      topic = selectedCaseData.value?.title || `案例 #${selectedCase.value}`
      params.type = 'case'
      params.caseId = selectedCase.value
      params.templateType = selectedCaseTemplate.value
      params.highlights = highlightOptions.value
    } else if (activeTab.value === 'document') {
      if (!selectedDocument.value) { message.warning('请先选择文档'); generating.value = false; return }
      topic = selectedDocument.value.name || '-'
      params.type = 'document'
      params.docContent = selectedDocument.value.name
      params.templateType = selectedDocumentTemplate.value
      params.articleLength = documentArticleLength.value
      params.articleStyle = documentArticleStyle.value
      params.articleTone = documentArticleTone.value
    } else if (activeTab.value === 'custom') {
      if (!customTopic.value.trim()) { message.warning('请输入主题'); generating.value = false; return }
      topic = customTopic.value
      params.type = 'custom'
      params.customTopic = customTopic.value
      params.keywords = customKeywords.value
      params.audience = targetAudience.value
      params.templateType = selectedCustomTemplate.value
      params.articleLength = customArticleLength.value
      params.articleStyle = customArticleStyle.value
      params.articleTone = customArticleTone.value
    }

    const res = await articleApi.generateAsync(params, { tenantId: tenantId.value })
    currentTaskId.value = res.taskId
    addTask(res.taskId, activeTab.value, topic)
    generateProgress.value = 5
    progressText.value = '任务已提交'

    const sseOk = await trySSE(res.taskId)
    if (!sseOk) pollTaskStatus(res.taskId)
  } catch (error) {
    console.error(error)
    message.error('生成失败')
    resetGenerationState()
  }
}

async function saveTemplate() {
  if (!editingTemplate.name.trim() || !editingTemplate.content.trim()) {
    message.warning('请填写模板名称和内容')
    return
  }
  templateSaving.value = true
  try {
    await articleTemplateApi.create({
      name: editingTemplate.name.trim(),
      type: 'custom',
      category: 'general',
      description: '',
      content: editingTemplate.content,
      variables: [],
      status: 'active',
    })
    message.success('模板已保存')
    showTemplateEditor.value = false
  } catch (e) {
    message.error(`保存失败：${describeHttpError(e)}`)
  } finally {
    templateSaving.value = false
  }
}

/** 查看 / 编辑文章归 文章管理，这里只做跳转 */
function viewArticle(task: GenerationTask) {
  if (!task.articleId) { message.warning('该任务尚未产出文章'); return }
  router.push({ name: 'workspace-article-edit', params: { id: task.articleId } })
}

/** 送审是本页唯一保留的下游动作（审核/发布/删除归审核管理与发布中心） */
function canSubmitReview(task?: GenerationTask) {
  return !!task?.articleId && (!task.articleStatus || task.articleStatus === 'draft')
}

async function submitForReview(task: GenerationTask) {
  if (!task.articleId) { message.warning('该任务尚未产出文章'); return }
  try {
    await articleApi.submitReview(task.articleId, tenantId.value)
    message.success('已提交审核')
    await refreshArticleStatus(task)
    await loadStats()
  } catch (error) {
    console.error(error)
    message.error('提交审核失败')
  }
}

async function batchSubmitReview() {
  const targets = generationTasks.value.filter(t => selectedRowKeys.value.includes(t.taskId) && canSubmitReview(t))
  if (!targets.length) { message.warning('请选择已生成且仍为草稿的文章'); return }
  const failed: string[] = []
  for (const task of targets) {
    try {
      await articleApi.submitReview(task.articleId as number, tenantId.value)
      await refreshArticleStatus(task)
    } catch (error) {
      console.error(error)
      failed.push(task.title || task.topic || `任务 #${task.taskId}`)
    }
  }
  if (failed.length) message.error(`${failed.length} 篇提交审核失败：${failed.join('、')}`)
  else message.success(`已提交 ${targets.length} 篇进入审核`)
  selectedRowKeys.value = []
  await loadStats()
}

async function loadTokenStats() {
  showTokenStats.value = true
  tokenStats.value = null
  try {
    tokenStats.value = await articleApi.getTokenStats(7, tenantId.value)
  } catch (error) {
    console.error(error)
    message.error('加载 Token 统计失败')
  }
}

// 图表初始化
function initTrendChart() {
  if (!trendChartRef.value) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(trendChartRef.value)
  trendChart.setOption({
    tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: [] },
    yAxis: { type: 'value', min: 70, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{ name: '成功率', type: 'line', smooth: true, data: [],
      lineStyle: { color: '#1890ff', width: 3 }, itemStyle: { color: '#1890ff' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(24,144,255,0.25)' }, { offset: 1, color: 'rgba(24,144,255,0.02)' },
      ]) },
      symbol: 'circle', symbolSize: 6,
    }],
  })
}

function initTemplateChart() {
  if (!templateChartRef.value) return
  if (templateChart) templateChart.dispose()
  templateChart = echarts.init(templateChartRef.value)
  templateChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 5, top: 'center', textStyle: { fontSize: 11 } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['35%', '50%'], data: [],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false }, labelLine: { show: false },
    }],
  })
}

function initQualityChart() {
  if (!qualityChartRef.value) return
  if (qualityChart) qualityChart.dispose()
  qualityChart = echarts.init(qualityChartRef.value)
  qualityChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: [], axisLabel: { fontSize: 10, interval: 0, rotate: 25 } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [],
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: '#1890ff' }, { offset: 1, color: '#91d5ff' },
      ]), borderRadius: [4, 4, 0, 0] },
      barWidth: '55%',
    }],
  })
}

function initCharts() {
  initTrendChart()
  initTemplateChart()
  initQualityChart()
}

function handleDrawerOpen() {
  nextTick(() => {
    initCharts()
    setTimeout(() => handleResize(), 100)
  })
}

function openAnalysisDrawer() {
  showAnalysisDrawer.value = true
}

function handleResize() {
  trendChart?.resize()
  templateChart?.resize()
  qualityChart?.resize()
}

async function loadKeywords() {
  try {
    const tid: number = authStore.selectedTenantId ?? authStore.tenantId
    // 企业关键词库 SOT：按意图价值倒序 + 搜索量 取前 100（比 size:50 扩大 1 倍），
    // 优先展示高转化意图词（价格/选择/效果/本地服务）。
    const res = await keywordApi.list({
      page: 1,
      size: 100,
      tenantId: tid,
    }) as any
    const records: KeywordOption[] = (res?.records || []).map((k: any) => ({
      id: k.id,
      name: k.rawKeyword || k.normalizedKeyword || '',
      category: k.category,
      intentValue: Number(k.intentValue || 0),
      searchVolume: Number(k.searchVolume || 0),
      suggestionCount: Number(k.suggestionCount || 0),
      articleCount: Number(k.articleCount || 0),
      status: k.status,
    }))
    // 高意图值倒序 → 搜索量倒序 → 未生成内容优先（没文章优先于有文章）
    records.sort((a, b) => {
      if (b.intentValue !== a.intentValue) return b.intentValue - a.intentValue
      if (b.searchVolume !== a.searchVolume) return b.searchVolume - a.searchVolume
      return (a.articleCount > 0 ? 1 : 0) - (b.articleCount > 0 ? 1 : 0)
    })
    keywordsList.value = records
  } catch (e) { console.error('加载关键词失败', e) }
}

async function loadClusterData(clusterId: number) {
  try {
    loading.value = true
    const res = await clusterApi.get(clusterId, { tenantId: tenantId.value })
    clusterInfo.value = res
    clusterSuggestions.value = res?.contentSuggestions || []
    if (clusterSuggestions.value.length > 0) {
      selectedSuggestionId.value = clusterSuggestions.value[0].id
    }
    clusterMode.value = true
    activeTab.value = 'cluster'
  } catch (e) {
    console.error('加载聚类数据失败', e)
    message.error('加载聚类数据失败')
  } finally {
    loading.value = false
  }
}

async function loadClusterList() {
  try {
    const res = await clusterApi.list({ tenantId: tenantId.value, page: 1, size: 100 })
    clusterList.value = res?.records || []
  } catch (e) {
    console.error('加载聚类列表失败', e)
    message.error('加载聚类列表失败')
  }
}

async function onClusterSelect(clusterId: number) {
  if (!clusterId) {
    clusterInfo.value = null
    clusterSuggestions.value = []
    selectedSuggestionId.value = null
    return
  }
  await loadClusterData(clusterId)
}

async function generateSuggestionsForCluster() {
  if (!selectedClusterId.value) return
  try {
    loading.value = true
    const res = await clusterApi.generateSuggestions(selectedClusterId.value, { tenantId: tenantId.value })
    clusterSuggestions.value = res || []
    if (clusterSuggestions.value.length > 0) {
      selectedSuggestionId.value = clusterSuggestions.value[0].id
    }
    message.success(`已生成 ${clusterSuggestions.value.length} 条内容建议`)
  } catch (e) {
    console.error('生成内容建议失败', e)
    message.error('生成内容建议失败')
  } finally {
    loading.value = false
  }
}

async function loadCases() {
  try {
    const res = await caseApi.list({ page: 1, size: 10 } as any) as any
    const records = res?.records || res?.data?.records || []
    casesList.value = records.map((c: any) => ({
      id: c.id, title: c.title || c.customerName || '',
      highlights: c.tags ? (Array.isArray(c.tags) ? c.tags : c.tags.split(',').map((t: string) => t.trim()).filter(Boolean)) : [],
    }))
  } catch (e) { console.error('加载案例失败', e) }
}

onMounted(() => {
  loadStats()
  loadKeywords()
  loadCases()
  loadClusterList()
  const cid = route.query.clusterId
  if (cid) {
    selectedClusterId.value = Number(cid)
    loadClusterData(Number(cid))
  }
  window.addEventListener('resize', handleResize)
})

// 租户切换时重新加载数据；生成任务与租户绑定，切换后必须清空
watch(() => authStore.selectedTenantId, () => {
  loadStats()
  loadKeywords()
  loadClusterList()
  selectedSuggestionId.value = null
  clusterInfo.value = null
  clusterSuggestions.value = []
  selectedClusterId.value = null
  generationTasks.value = []
  selectedRowKeys.value = []
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  templateChart?.dispose()
  qualityChart?.dispose()
  clearPolling()
})
</script>

<style scoped lang="less">
@blue-500: #1890ff;
@slate-50: #f8fafc;
@slate-100: #f1f5f9;
@slate-200: #e2e8f0;
@slate-300: #cbd5e1;
@slate-400: #94a3b8;
@slate-500: #64748b;
@slate-600: #475569;
@slate-700: #334155;
@slate-800: #1e293b;

.article-generate-page {
  width: 100%;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #ffffff 0%, @slate-50 100%);
  border-radius: 12px;
  border: 1px solid @slate-200;

  &__left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  &__title {
    font-size: 22px;
    font-weight: 700;
    color: @slate-800;
    margin: 0;
  }

  &__subtitle {
    font-size: 13px;
    color: @slate-500;
  }
}

/* 统计卡片 */
.stat-row {
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid @slate-200;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: @blue-500;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.12);
  }

  &--blue { border-left: 4px solid #1890ff; }
  &--purple { border-left: 4px solid #722ed1; }
  &--green { border-left: 4px solid #52c41a; }
  &--orange { border-left: 4px solid #fa8c16; }

  &__icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: #fff;
    flex-shrink: 0;
  }

  &--blue &__icon { background: #1890ff; }
  &--purple &__icon { background: #722ed1; }
  &--green &__icon { background: #52c41a; }
  &--orange &__icon { background: #fa8c16; }

  &__value {
    font-size: 24px;
    font-weight: 700;
    color: @slate-800;
    line-height: 1.2;
  }

  &__unit {
    font-size: 13px;
    color: @slate-400;
    margin-left: 2px;
  }

  &__label {
    font-size: 13px;
    color: @slate-500;
  }
}

/* 生成区 */
.generate-card {
  background: #fff;
  border: 1px solid @slate-200;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.ant-upload-text {
  font-size: 14px;
  color: @slate-600;
}

.ant-upload-hint {
  font-size: 12px;
  color: @slate-400;
}

/* 操作条 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid @slate-100;
  margin-top: 8px;
}

/* 生成进度 */
.generating-progress {
  margin-top: 16px;
  padding: 12px 16px;
  background: @slate-50;
  border-radius: 8px;

  .progress-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 13px;
    color: @slate-600;
  }
}

/* 文章列表 */
.list-card {
  background: #fff;
  border: 1px solid @slate-200;
  border-radius: 12px;
  padding: 20px 24px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;

  .toolbar-fill {
    align-items: center;
  }

  .list-hint {
    font-size: 12px;
    color: @slate-400;
  }

  .selected-count {
    font-size: 13px;
    color: @blue-500;
    font-weight: 500;
  }
}

.task-error {
  font-size: 12px;
  color: #ff4d4f;
  margin-top: 2px;
}

/* 图表 */
.chart-card {
  background: #fff;
  border: 1px solid @slate-200;
  border-radius: 8px;
  padding: 16px;

  h3 {
    font-size: 14px;
    font-weight: 600;
    color: @slate-700;
    margin: 0 0 12px 0;
  }
}

.chart-container {
  width: 100%;
  height: 320px;
}

/* 预览内容 */
.preview-content {
  padding: 16px;

  .preview-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    color: @slate-800;
  }

  .preview-paragraph {
    font-size: 13px;
    color: @slate-600;
    line-height: 1.8;
    margin-bottom: 8px;
  }
}

/* 案例亮点 */
.case-highlights {
  margin-top: 12px;

  .highlights-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: @slate-700;
  }

  .highlight-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 13px;
    color: @slate-600;

    .highlight-icon {
      color: #fa8c16;
    }
  }
}

/* 聚类建议选择卡片 */
.cluster-info-bar {
  background: #f0f5ff;
  border: 1px solid #d6e4ff;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.cluster-info-bar__name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}
.cluster-info-bar__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cluster-info-bar__dir {
  font-size: 13px;
  color: #475569;
}

.empty-cluster-suggestions {
  padding: 48px 0;
  text-align: center;
}

.suggestion-pick-card {
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  height: 100%;
}
.suggestion-pick-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 12px rgba(22, 119, 255, 0.15);
}
.suggestion-pick-card--active {
  border-color: #1677ff;
  background: #f0f5ff;
  box-shadow: 0 2px 12px rgba(22, 119, 255, 0.25);
}
.suggestion-pick-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.suggestion-pick-card__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.suggestion-pick-card__title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggestion-pick-card__check {
  color: #1677ff;
  font-size: 16px;
}
.suggestion-pick-card__prompt {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.suggestion-pick-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.suggestion-pick-card__score {
  color: #f59e0b;
  font-weight: 600;
}
.suggestion-pick-card__status {
  color: #94a3b8;
}
</style>
