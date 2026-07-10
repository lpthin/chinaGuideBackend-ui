<template>
  <div class="article-generate-page">
    <a-spin :spinning="loading">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="page-header__left">
          <div class="page-header__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.8"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="page-header__text">
            <h1 class="page-header__title">AI文章生成</h1>
            <p class="page-header__subtitle">智能驱动，一键生成高质量内容</p>
          </div>
        </div>
        <div class="page-header__right">
          <a-button size="large" @click="showTemplateEditor = true">
            <template #icon><EditOutlined /></template>
            模板管理
          </a-button>
        </div>
      </div>

      <!-- 顶部数据概览区 -->
      <div class="stat-cards">
        <div
          class="stat-card"
          v-for="(item, index) in statItems"
          :key="item.key"
          :class="`stat-card--${item.color}`"
          :style="{ animationDelay: `${index * 0.08}s` }"
          @click="navigateTo(item.path)"
          tabindex="0"
          @keyup.enter="navigateTo(item.path)"
        >
          <div class="stat-card__glow" aria-hidden="true"></div>
          <div class="stat-card__pattern" aria-hidden="true">
            <svg viewBox="0 0 100 100" fill="none">
              <circle cx="85" cy="15" r="35" stroke="currentColor" stroke-width="0.5" opacity="0.25"/>
              <circle cx="95" cy="5" r="25" stroke="currentColor" stroke-width="0.5" opacity="0.15"/>
            </svg>
          </div>
          <div class="stat-card__content">
            <div class="stat-card__top">
              <div class="stat-card__icon">
                <component :is="item.icon" />
              </div>
              <div class="stat-card__trend" :class="`trend-${item.trendType}`">
                <span class="trend-arrow">{{ getTrendArrow(item.trendType) }}</span>
                <span class="trend-value">{{ item.trendValue }}</span>
              </div>
            </div>
            <div class="stat-card__value">
              <span class="value-number">{{ item.value }}</span>
              <span class="value-unit">{{ item.unit }}</span>
            </div>
            <div class="stat-card__bottom">
              <span class="stat-card__label">{{ item.label }}</span>
              <span class="stat-card__period">较上周</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 生成方式选择区 -->
      <div class="generate-card" :style="{ animationDelay: '0.32s' }">
        <div class="card-header">
          <div class="card-header__left">
            <div class="card-header__icon">
              <ThunderboltOutlined />
            </div>
            <div class="card-header__text">
              <h2 class="card-header__title">生成方式选择</h2>
              <p class="card-header__desc">选择适合您的内容生成方式</p>
            </div>
          </div>
        </div>

        <a-tabs v-model:activeKey="activeTab" class="generate-tabs" size="large">
          <!-- 热词驱动生成 -->
          <a-tab-pane key="keyword">
            <template #tab>
              <span class="tab-label">
                <FireOutlined />
                热词驱动生成
              </span>
            </template>
            <a-row :gutter="24">
              <a-col :xs="24" :lg="12">
                <div class="form-section">
                  <h4 class="section-title">
                    <SelectOutlined />
                    关键词配置
                  </h4>
                  <a-form layout="vertical">
                    <a-form-item label="今日精选关键词">
                      <a-select v-model:value="selectedKeyword" style="width: 100%" placeholder="请选择关键词" size="large">
                        <a-select-option v-for="kw in keywordsList" :key="kw.id" :value="kw.name">
                          <span class="keyword-option">
                            <span>{{ kw.name }}</span>
                            <a-tag :color="getPriorityColor(kw.priority)">
                              热度 {{ kw.priority }}
                            </a-tag>
                          </span>
                        </a-select-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="文章模板">
                      <div class="template-select-wrapper">
                        <a-select v-model:value="selectedTemplate" style="width: 100%" size="large">
                          <a-select-option value="default">默认模板</a-select-option>
                          <a-select-option value="guide">指南型模板</a-select-option>
                          <a-select-option value="review">评测型模板</a-select-option>
                          <a-select-option value="news">新闻型模板</a-select-option>
                        </a-select>
                        <a-button class="preview-btn" @click="showTemplatePreview = true">
                          <EyeOutlined />
                          预览
                        </a-button>
                      </div>
                    </a-form-item>
                    <a-row :gutter="16">
                      <a-col :span="12">
                        <a-form-item label="文章字数">
                          <a-slider v-model:value="articleLength" :min="500" :max="3000" :step="100" />
                          <div class="param-label">{{ articleLength }} 字</div>
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item label="文章风格">
                          <a-select v-model:value="articleStyle" size="large" style="width: 100%">
                            <a-select-option value="professional">专业严谨</a-select-option>
                            <a-select-option value="friendly">亲和易懂</a-select-option>
                            <a-select-option value="creative">创意活泼</a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-form-item label="语气">
                      <a-radio-group v-model:value="articleTone" button-style="solid">
                        <a-radio-button value="neutral">中性客观</a-radio-button>
                        <a-radio-button value="positive">积极正向</a-radio-button>
                        <a-radio-button value="critical">批判性</a-radio-button>
                      </a-radio-group>
                    </a-form-item>
                  </a-form>
                </div>
              </a-col>
              <a-col :xs="24" :lg="12">
                <div class="preview-section">
                  <h4 class="section-title">
                    <EyeOutlined />
                    模板预览
                  </h4>
                  <div class="template-preview-card">
                    <div class="preview-header">
                      <FileTextOutlined />
                      <span>{{ getTemplateName(selectedTemplate) }}</span>
                    </div>
                    <div class="preview-content">
                      <p class="preview-title">【标题】{{ selectedKeyword || '关键词' }}的完整指南</p>
                      <p class="preview-paragraph">【引言】介绍{{ selectedKeyword || '关键词' }}的背景和重要性，为读者建立初步认知...</p>
                      <p class="preview-paragraph">【正文一】详细阐述{{ selectedKeyword || '关键词' }}的核心概念与关键特征...</p>
                      <p class="preview-paragraph">【正文二】深入分析{{ selectedKeyword || '关键词' }}的实际应用场景与案例...</p>
                      <p class="preview-paragraph">【结论】总结核心要点，展望未来发展趋势...</p>
                    </div>
                  </div>
                </div>
                <a-collapse v-model:activeKey="knowledgePanelKey" class="knowledge-collapse">
                  <a-collapse-panel key="1">
                    <template #header>
                      <span class="collapse-header">
                        <BookOutlined />
                        知识库相似度检索
                      </span>
                    </template>
                    <div class="knowledge-panel">
                      <a-input-search v-model:value="knowledgeSearch" placeholder="搜索知识库内容" enter-button />
                      <div class="knowledge-list">
                        <div v-for="(item, index) in knowledgeList" :key="index" class="knowledge-item">
                          <div class="knowledge-item-header">
                            <span class="knowledge-title">{{ item.title }}</span>
                            <a-tag color="blue">{{ item.similarity }}%</a-tag>
                          </div>
                          <div class="knowledge-summary">{{ item.summary }}</div>
                        </div>
                      </div>
                    </div>
                  </a-collapse-panel>
                </a-collapse>
              </a-col>
            </a-row>
          </a-tab-pane>

          <!-- 案例驱动生成 -->
          <a-tab-pane key="case">
            <template #tab>
              <span class="tab-label">
                <TrophyOutlined />
                案例驱动生成
              </span>
            </template>
            <a-row :gutter="24">
              <a-col :xs="24" :lg="12">
                <div class="form-section">
                  <h4 class="section-title">
                    <FolderOpenOutlined />
                    案例选择
                  </h4>
                  <a-form layout="vertical">
                    <a-form-item label="案例库搜索">
                      <a-input-search v-model:value="caseSearch" placeholder="搜索案例标题或标签" enter-button size="large" />
                    </a-form-item>
                    <a-form-item label="选择案例">
                      <a-select v-model:value="selectedCase" style="width: 100%" placeholder="请选择案例" size="large" show-search>
                        <a-select-option v-for="c in filteredCases" :key="c.id" :value="c.id">
                          {{ c.title }}
                        </a-select-option>
                      </a-select>
                    </a-form-item>
                    <a-form-item label="案例模板">
                      <div class="template-select-wrapper">
                        <a-select v-model:value="selectedCaseTemplate" style="width: 100%" size="large">
                          <a-select-option value="success">成功案例模板</a-select-option>
                          <a-select-option value="story">故事型模板</a-select-option>
                          <a-select-option value="data">数据驱动模板</a-select-option>
                        </a-select>
                        <a-button class="preview-btn" @click="showCasePreview = true">
                          <EyeOutlined />
                          预览
                        </a-button>
                      </div>
                    </a-form-item>
                    <a-form-item label="亮点提取配置">
                      <a-checkbox-group v-model:value="highlightOptions">
                        <a-checkbox value="data">数据亮点</a-checkbox>
                        <a-checkbox value="method">方法论</a-checkbox>
                        <a-checkbox value="result">成果展示</a-checkbox>
                        <a-checkbox value="challenge">挑战与克服</a-checkbox>
                      </a-checkbox-group>
                    </a-form-item>
                  </a-form>
                </div>
              </a-col>
              <a-col :xs="24" :lg="12">
                <div class="preview-section">
                  <h4 class="section-title">
                    <BulbOutlined />
                    案例拆解预览
                  </h4>
                  <div v-if="selectedCaseData" class="case-preview-card">
                    <div class="case-preview-header">
                      <TrophyOutlined />
                      <span>{{ selectedCaseData.title }}</span>
                    </div>
                    <div class="case-highlights">
                      <div class="highlights-title">核心亮点</div>
                      <div class="highlight-list">
                        <div v-for="(p, i) in selectedCaseData.highlights" :key="i" class="highlight-item">
                          <StarOutlined class="highlight-icon" />
                          <span>{{ p }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <a-empty v-else description="请选择一个案例查看拆解" class="empty-preview" />
                </div>
              </a-col>
            </a-row>
          </a-tab-pane>

          <!-- 文档驱动生成 -->
          <a-tab-pane key="document">
            <template #tab>
              <span class="tab-label">
                <FileTextOutlined />
                文档驱动生成
              </span>
            </template>
            <a-row :gutter="24">
              <a-col :xs="24" :lg="12">
                <div class="form-section">
                  <h4 class="section-title">
                    <UploadOutlined />
                    文档上传
                  </h4>
                  <a-form layout="vertical">
                    <a-form-item label="上传文档">
                      <a-upload-dragger
                        v-model:file-list="uploadedDocuments"
                        name="file"
                        :accept="'.docx,.pdf,.txt'"
                        :before-upload="beforeDocumentUpload"
                        @remove="handleDocumentRemove"
                        @change="handleDocumentChange"
                        :max-count="5"
                      >
                        <p class="ant-upload-drag-icon">
                          <InboxOutlined />
                        </p>
                        <p class="ant-upload-text">点击或拖拽文件到此处上传</p>
                        <p class="ant-upload-hint">支持 .docx、.pdf、.txt 格式，单个文件不超过 10MB</p>
                      </a-upload-dragger>
                    </a-form-item>
                    <a-form-item label="已上传文档">
                      <div class="document-list">
                        <div
                          v-for="(doc, index) in uploadedDocuments"
                          :key="index"
                          class="document-item"
                          :class="{ active: selectedDocument?.uid === doc.uid }"
                          @click="selectDocument(doc)"
                          tabindex="0"
                          @keyup.enter="selectDocument(doc)"
                        >
                          <FileTextOutlined class="doc-icon" />
                          <span class="doc-name">{{ doc.name }}</span>
                        </div>
                        <a-empty v-if="uploadedDocuments.length === 0" description="暂无文档" />
                      </div>
                    </a-form-item>
                  </a-form>
                </div>
              </a-col>
              <a-col :xs="24" :lg="12">
                <div class="preview-section">
                  <h4 class="section-title">
                    <EyeOutlined />
                    文档内容预览
                  </h4>
                  <div v-if="documentPreviewContent" class="document-preview-card">
                    <div class="preview-header">
                      <FileTextOutlined />
                      <span>{{ selectedDocument?.name || '文档预览' }}</span>
                    </div>
                    <div class="preview-content">
                      <p class="preview-paragraph">{{ documentPreviewContent }}</p>
                    </div>
                  </div>
                  <a-empty v-else description="请选择文档查看内容" class="empty-preview" />
                </div>
                <div class="form-section document-settings">
                  <h4 class="section-title">
                    <SettingOutlined />
                    生成设置
                  </h4>
                  <a-form layout="vertical">
                    <a-form-item label="文章模板">
                      <div class="template-select-wrapper">
                        <a-select v-model:value="selectedDocumentTemplate" style="width: 100%" size="large">
                          <a-select-option value="default">默认模板</a-select-option>
                          <a-select-option value="guide">指南型模板</a-select-option>
                          <a-select-option value="review">评测型模板</a-select-option>
                          <a-select-option value="news">新闻型模板</a-select-option>
                        </a-select>
                        <a-button class="preview-btn" @click="showDocumentPreview = true">
                          <EyeOutlined />
                          预览
                        </a-button>
                      </div>
                    </a-form-item>
                    <a-row :gutter="16">
                      <a-col :span="12">
                        <a-form-item label="文章字数">
                          <a-slider v-model:value="documentArticleLength" :min="500" :max="3000" :step="100" />
                          <div class="param-label">{{ documentArticleLength }} 字</div>
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item label="文章风格">
                          <a-select v-model:value="documentArticleStyle" size="large" style="width: 100%">
                            <a-select-option value="professional">专业严谨</a-select-option>
                            <a-select-option value="friendly">亲和易懂</a-select-option>
                            <a-select-option value="creative">创意活泼</a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-form-item label="语气">
                      <a-radio-group v-model:value="documentArticleTone" button-style="solid">
                        <a-radio-button value="neutral">中性客观</a-radio-button>
                        <a-radio-button value="positive">积极正向</a-radio-button>
                        <a-radio-button value="critical">批判性</a-radio-button>
                      </a-radio-group>
                    </a-form-item>
                  </a-form>
                </div>
              </a-col>
            </a-row>
          </a-tab-pane>

          <!-- 自定义主题生成 -->
          <a-tab-pane key="custom">
            <template #tab>
              <span class="tab-label">
                <EditOutlined />
                自定义主题生成
              </span>
            </template>
            <a-row :gutter="24">
              <a-col :xs="24" :lg="12">
                <div class="form-section">
                  <h4 class="section-title">
                    <EditOutlined />
                    主题配置
                  </h4>
                  <a-form layout="vertical">
                    <a-form-item label="文章主题">
                      <a-textarea
                        v-model:value="customTopic"
                        :rows="3"
                        placeholder="请输入您想要生成的文章主题，例如：数字化转型对中小企业的影响..."
                        size="large"
                      />
                    </a-form-item>
                    <a-form-item label="关键词">
                      <a-select
                        v-model:value="customKeywords"
                        mode="tags"
                        style="width: 100%"
                        placeholder="输入关键词后按回车添加"
                        size="large"
                      >
                      </a-select>
                    </a-form-item>
                    <a-form-item label="目标受众">
                      <a-select v-model:value="targetAudience" style="width: 100%" size="large">
                        <a-select-option value="general">普通读者</a-select-option>
                        <a-select-option value="professional">专业人士</a-select-option>
                        <a-select-option value="business">企业决策者</a-select-option>
                        <a-select-option value="student">学生群体</a-select-option>
                        <a-select-option value="technical">技术人员</a-select-option>
                      </a-select>
                    </a-form-item>
                  </a-form>
                </div>
              </a-col>
              <a-col :xs="24" :lg="12">
                <div class="form-section">
                  <h4 class="section-title">
                    <SettingOutlined />
                    生成设置
                  </h4>
                  <a-form layout="vertical">
                    <a-form-item label="文章模板">
                      <div class="template-select-wrapper">
                        <a-select v-model:value="selectedCustomTemplate" style="width: 100%" size="large">
                          <a-select-option value="default">默认模板</a-select-option>
                          <a-select-option value="guide">指南型模板</a-select-option>
                          <a-select-option value="review">评测型模板</a-select-option>
                          <a-select-option value="news">新闻型模板</a-select-option>
                        </a-select>
                        <a-button class="preview-btn" @click="showCustomPreview = true">
                          <EyeOutlined />
                          预览
                        </a-button>
                      </div>
                    </a-form-item>
                    <a-row :gutter="16">
                      <a-col :span="12">
                        <a-form-item label="文章字数">
                          <a-slider v-model:value="customArticleLength" :min="500" :max="3000" :step="100" />
                          <div class="param-label">{{ customArticleLength }} 字</div>
                        </a-form-item>
                      </a-col>
                      <a-col :span="12">
                        <a-form-item label="文章风格">
                          <a-select v-model:value="customArticleStyle" size="large" style="width: 100%">
                            <a-select-option value="professional">专业严谨</a-select-option>
                            <a-select-option value="friendly">亲和易懂</a-select-option>
                            <a-select-option value="creative">创意活泼</a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                    </a-row>
                    <a-form-item label="语气">
                      <a-radio-group v-model:value="customArticleTone" button-style="solid">
                        <a-radio-button value="neutral">中性客观</a-radio-button>
                        <a-radio-button value="positive">积极正向</a-radio-button>
                        <a-radio-button value="critical">批判性</a-radio-button>
                      </a-radio-group>
                    </a-form-item>
                  </a-form>
                </div>
                <div class="preview-section">
                  <h4 class="section-title">
                    <EyeOutlined />
                    主题预览
                  </h4>
                  <div v-if="customTopic" class="template-preview-card">
                    <div class="preview-header">
                      <EditOutlined />
                      <span>自定义主题</span>
                    </div>
                    <div class="preview-content">
                      <p class="preview-title">【标题】{{ customTopic }}</p>
                      <p class="preview-paragraph">【关键词】{{ customKeywords.length > 0 ? customKeywords.join('、') : '暂无关键词' }}</p>
                      <p class="preview-paragraph">【目标受众】{{ getAudienceName(targetAudience) }}</p>
                      <p class="preview-paragraph">【预期字数】{{ customArticleLength }} 字</p>
                    </div>
                  </div>
                  <a-empty v-else description="请输入主题查看预览" class="empty-preview" />
                </div>
              </a-col>
            </a-row>
          </a-tab-pane>
        </a-tabs>

        <!-- 生成操作区 -->
        <div class="generate-actions">
          <div class="actions-left">
            <a-space size="middle">
              <div class="switch-wrapper">
                <a-switch v-model:checked="useKnowledge" checked-children="知识库引用" un-checked-children="知识库引用" />
              </div>
              <a-button size="large" @click="showBatchConfig = true" class="action-btn">
                <template #icon><AppstoreOutlined /></template>
                批量生成
              </a-button>
            </a-space>
          </div>
          <div class="actions-right">
            <a-button type="primary" size="large" :loading="generating" @click="generateArticle" class="generate-btn">
              <template #icon><RocketOutlined /></template>
              {{ generating ? '生成中...' : '开始生成文章' }}
            </a-button>
          </div>
        </div>

        <!-- 生成进度 -->
        <div v-if="generating" class="generating-progress">
          <div class="progress-header">
            <div class="progress-icon">
              <RocketOutlined />
            </div>
            <div class="progress-info">
              <div class="progress-title">正在生成文章</div>
              <div class="progress-text">{{ progressText }}</div>
            </div>
            <div class="progress-percent">{{ Math.floor(generateProgress) }}%</div>
          </div>
          <a-progress :percent="generateProgress" status="active" :show-info="false" />
        </div>
      </div>

      <!-- 文章列表区 -->
      <div class="list-card" :style="{ animationDelay: '0.4s' }">
        <div class="card-header">
          <div class="card-header__left">
            <div class="card-header__icon">
              <UnorderedListOutlined />
            </div>
            <div class="card-header__text">
              <h2 class="card-header__title">文章列表</h2>
              <p class="card-header__desc">查看和管理已生成的文章</p>
            </div>
          </div>
          <div class="card-header__right">
            <a-space size="middle">
              <a-select v-model:value="statusFilter" style="width: 120px" placeholder="状态筛选" allowClear size="middle">
                <a-select-option value="all">全部状态</a-select-option>
                <a-select-option value="draft">草稿</a-select-option>
                <a-select-option value="reviewing">待审核</a-select-option>
                <a-select-option value="published">已发布</a-select-option>
              </a-select>
              <a-select v-model:value="generateTypeFilter" style="width: 120px" placeholder="生成方式" allowClear size="middle">
                <a-select-option value="all">全部方式</a-select-option>
                <a-select-option value="keyword">热词驱动</a-select-option>
                <a-select-option value="case">案例驱动</a-select-option>
                <a-select-option value="document">文档驱动</a-select-option>
                <a-select-option value="custom">自定义主题</a-select-option>
              </a-select>
              <a-radio-group v-model:value="viewMode" button-style="solid" size="middle">
                <a-radio-button value="list">
                  <TableOutlined />
                </a-radio-button>
                <a-radio-button value="card">
                  <AppstoreOutlined />
                </a-radio-button>
              </a-radio-group>
            </a-space>
          </div>
        </div>

        <div v-if="viewMode === 'list'" class="list-view">
          <div class="batch-operations" v-if="selectedRowKeys.length > 0">
            <span class="selected-count">已选择 {{ selectedRowKeys.length }} 项</span>
            <a-space>
              <a-button size="small" type="primary" @click="batchReview">
                <template #icon><CheckOutlined /></template>
                批量审核
              </a-button>
              <a-button size="small" @click="batchPublish">
                <template #icon><SendOutlined /></template>
                批量发布
              </a-button>
              <a-button size="small" danger @click="batchDelete">
                <template #icon><DeleteOutlined /></template>
                批量删除
              </a-button>
            </a-space>
          </div>
          <a-table 
            :data-source="articles" 
            :columns="articleColumns" 
            row-key="id" 
            :loading="loading"
            :row-selection="{ selectedRowKeys: selectedRowKeys, onChange: onSelectChange }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">{{ getStatusText(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'generateType'">
                <a-tag :color="getGenerateTypeColor(record.generateType)">{{ getGenerateTypeText(record.generateType) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'score'">
                <span class="score-cell">
                  <StarOutlined class="score-icon" />
                  {{ record.score || '-' }}
                </span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button type="link" size="small" @click="handleView(record)">查看</a-button>
                <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
                <a-button type="link" size="small" danger @click="handleDelete(record)">删除</a-button>
              </template>
            </template>
          </a-table>
        </div>
        <div v-else class="card-view">
          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :sm="12" :md="8" :lg="6" v-for="(article, index) in articles" :key="article.id" :style="{ animationDelay: `${index * 0.05}s` }">
              <div class="article-card" tabindex="0">
                <div class="article-card-header">
                  <a-tag :color="getStatusColor(article.status)">{{ getStatusText(article.status) }}</a-tag>
                  <div class="quality-score">
                    <StarOutlined class="score-icon" />
                    <span>{{ article.score || '-' }}分</span>
                  </div>
                </div>
                <div class="article-card-title">{{ article.title }}</div>
                <div class="article-card-meta">
                  <span class="meta-item"><FileTextOutlined /> {{ article.wordCount || 0 }}字</span>
                  <span class="meta-item"><CalendarOutlined /> {{ formatDate(article.createdAt) }}</span>
                </div>
                <div class="article-card-tags">
                  <a-tag v-if="article.generateType === 'keyword'" color="blue">热词驱动</a-tag>
                  <a-tag v-else-if="article.generateType === 'case'" color="purple">案例驱动</a-tag>
                  <a-tag v-else-if="article.generateType === 'document'" color="green">文档驱动</a-tag>
                  <a-tag v-else-if="article.generateType === 'custom'" color="orange">自定义主题</a-tag>
                </div>
                <div class="article-card-actions">
                  <a-button type="link" size="small" @click="handleView(article)">查看</a-button>
                  <a-button type="link" size="small" @click="handleEdit(article)">编辑</a-button>
                  <a-button type="link" size="small" danger @click="handleDelete(article)">删除</a-button>
                </div>
              </div>
            </a-col>
          </a-row>
        </div>
      </div>

      <!-- 生成记录与质量分析区 -->
      <div class="analysis-section" :style="{ animationDelay: '0.48s' }">
        <div class="analysis-header" @click="toggleAnalysisPanel" tabindex="0" @keyup.enter="toggleAnalysisPanel">
          <div class="analysis-header__left">
            <div class="analysis-header__icon">
              <PieChartOutlined />
            </div>
            <div class="analysis-header__text">
              <h2 class="analysis-header__title">生成记录与质量分析</h2>
              <p class="analysis-header__desc">查看生成数据趋势和质量分布</p>
            </div>
          </div>
          <div class="analysis-header__arrow" :class="{ expanded: analysisExpanded }">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div v-show="analysisExpanded" class="analysis-content">
          <a-row :gutter="16">
            <a-col :xs="24" :lg="10">
              <div class="chart-card">
                <div class="chart-card__header">
                  <h3 class="chart-card__title">生成成功率趋势</h3>
                </div>
                <div ref="trendChartRef" class="chart-container"></div>
              </div>
            </a-col>
            <a-col :xs="24" :lg="7">
              <div class="chart-card">
                <div class="chart-card__header">
                  <h3 class="chart-card__title">模板使用统计</h3>
                </div>
                <div ref="templateChartRef" class="chart-container"></div>
              </div>
            </a-col>
            <a-col :xs="24" :lg="7">
              <div class="chart-card">
                <div class="chart-card__header">
                  <h3 class="chart-card__title">质量分布分析</h3>
                </div>
                <div ref="qualityChartRef" class="chart-container"></div>
              </div>
            </a-col>
          </a-row>
        </div>
      </div>

      <!-- 模板编辑器弹窗 -->
      <a-modal v-model:open="showTemplateEditor" title="自定义模板编辑" width="900px" @ok="saveTemplate">
        <a-form layout="vertical">
          <a-form-item label="模板名称">
            <a-input v-model:value="editingTemplate.name" />
          </a-form-item>
          <a-form-item label="模板内容">
            <a-textarea v-model:value="editingTemplate.content" :rows="12" placeholder="使用 {keyword} 作为关键词占位符..." />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 模板预览弹窗 -->
      <a-modal v-model:open="showTemplatePreview" title="模板预览" width="600px" :footer="null">
        <div class="modal-preview-content">
          <div class="preview-content">
            <p class="preview-title">【标题】{{ selectedKeyword || '关键词' }}的完整指南</p>
            <p class="preview-paragraph">【引言】介绍{{ selectedKeyword || '关键词' }}的背景和重要性，为读者建立初步认知...</p>
            <p class="preview-paragraph">【正文一】详细阐述{{ selectedKeyword || '关键词' }}的核心概念与关键特征...</p>
            <p class="preview-paragraph">【正文二】深入分析{{ selectedKeyword || '关键词' }}的实际应用场景与案例...</p>
            <p class="preview-paragraph">【结论】总结核心要点，展望未来发展趋势...</p>
          </div>
        </div>
      </a-modal>

      <!-- 案例预览弹窗 -->
      <a-modal v-model:open="showCasePreview" title="案例模板预览" width="600px" :footer="null">
        <div class="modal-preview-content">
          <div v-if="selectedCaseData" class="case-preview-content">
            <h3>{{ selectedCaseData.title }}</h3>
            <div class="case-highlights">
              <div class="highlights-title">核心亮点</div>
              <div class="highlight-list">
                <div v-for="(p, i) in selectedCaseData.highlights" :key="i" class="highlight-item">
                  <StarOutlined class="highlight-icon" />
                  <span>{{ p }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-modal>

      <!-- 文档模板预览弹窗 -->
      <a-modal v-model:open="showDocumentPreview" title="文档生成模板预览" width="600px" :footer="null">
        <div class="modal-preview-content">
          <div class="preview-content">
            <p class="preview-title">【标题】基于文档内容的深度分析</p>
            <p class="preview-paragraph">【引言】根据上传文档的核心内容，提炼关键信息和背景介绍...</p>
            <p class="preview-paragraph">【正文一】深入分析文档中的核心观点和主要论述...</p>
            <p class="preview-paragraph">【正文二】结合文档数据和案例，展开详细论证...</p>
            <p class="preview-paragraph">【结论】总结文档要点，提出见解和展望...</p>
          </div>
        </div>
      </a-modal>

      <!-- 自定义主题预览弹窗 -->
      <a-modal v-model:open="showCustomPreview" title="自定义主题模板预览" width="600px" :footer="null">
        <div class="modal-preview-content">
          <div class="preview-content">
            <p class="preview-title">【标题】{{ customTopic || '自定义主题' }}</p>
            <p class="preview-paragraph">【引言】介绍主题背景和重要性，引出文章核心内容...</p>
            <p class="preview-paragraph">【正文一】围绕主题展开第一维度的深入分析...</p>
            <p class="preview-paragraph">【正文二】结合关键词和目标受众，进行第二维度的论述...</p>
            <p class="preview-paragraph">【结论】总结核心观点，给出针对性建议...</p>
          </div>
        </div>
      </a-modal>

      <!-- 批量生成配置弹窗 -->
      <a-modal v-model:open="showBatchConfig" title="批量生成配置" @ok="confirmBatchGenerate">
        <a-form layout="vertical">
          <a-form-item label="生成数量">
            <a-input-number v-model:value="batchCount" :min="1" :max="50" style="width: 100%" />
          </a-form-item>
          <a-form-item label="生成间隔（秒）">
            <a-input-number v-model:value="batchInterval" :min="1" :max="60" style="width: 100%" />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, nextTick, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import * as echarts from 'echarts'
import {
  FileTextOutlined,
  EditOutlined,
  SendOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  StarOutlined,
  PieChartOutlined,
  FireOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  SelectOutlined,
  EyeOutlined,
  BookOutlined,
  FolderOpenOutlined,
  BulbOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  TableOutlined,
  CheckOutlined,
  DeleteOutlined,
  CalendarOutlined,
  UploadOutlined,
  InboxOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { articleApi, suggestionApi, dashboardApi } from '../../api'
import http from '../../api/http'

const router = useRouter()

const loading = ref(false)
const generating = ref(false)
const activeTab = ref('keyword')
const viewMode = ref('list')
const statusFilter = ref('all')
const generateTypeFilter = ref('all')
const showTemplateEditor = ref(false)
const showTemplatePreview = ref(false)
const showCasePreview = ref(false)
const showBatchConfig = ref(false)
const showDocumentPreview = ref(false)
const showCustomPreview = ref(false)
const knowledgePanelKey = ref<string | string[]>([])
const useKnowledge = ref(true)
const articleStyle = ref('professional')
const articleTone = ref('neutral')
const caseSearch = ref('')
const knowledgeSearch = ref('')
const generateProgress = ref(0)
const progressText = ref('准备生成...')
const batchCount = ref(5)
const batchInterval = ref(3)
const selectedRowKeys = ref<number[]>([])
const highlightOptions = ref<string[]>(['data', 'result'])
const analysisExpanded = ref(true)

const trendChartRef = ref<HTMLElement>()
const templateChartRef = ref<HTMLElement>()
const qualityChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let templateChart: echarts.ECharts | null = null
let qualityChart: echarts.ECharts | null = null

const knowledgeList = ref<any[]>([])

const stats = reactive({
  totalArticles: 0,
  draftCount: 0,
  publishedCount: 0,
  pendingCount: 0,
  avgScore: 0,
})

const statItems = computed(() => [
  {
    key: 'total',
    label: '文章总数',
    value: stats.totalArticles,
    unit: '篇',
    icon: FileTextOutlined,
    color: 'blue',
    trendType: 'up',
    trendValue: '12%',
    path: '/workspace/articles',
  },
  {
    key: 'draft',
    label: '草稿数',
    value: stats.draftCount,
    unit: '篇',
    icon: EditOutlined,
    color: 'purple',
    trendType: 'up',
    trendValue: '8%',
    path: '/workspace/articles?status=draft',
  },
  {
    key: 'published',
    label: '已发布',
    value: stats.publishedCount,
    unit: '篇',
    icon: SendOutlined,
    color: 'green',
    trendType: 'up',
    trendValue: '15%',
    path: '/workspace/articles?status=published',
  },
  {
    key: 'pending',
    label: '待审核',
    value: stats.pendingCount || 0,
    unit: '篇',
    icon: ClockCircleOutlined,
    color: 'orange',
    trendType: 'down',
    trendValue: '5%',
    path: '/workspace/articles?status=reviewing',
  },
])

function getTrendArrow(type: string) {
  return type === 'up' ? '↗' : '↘'
}

function navigateTo(path: string) {
  router.push(path)
}

function toggleAnalysisPanel() {
  analysisExpanded.value = !analysisExpanded.value
  if (analysisExpanded.value) {
    nextTick(() => {
      initCharts()
    })
  }
}

function initCharts() {
  initTrendChart()
  initTemplateChart()
  initQualityChart()
}

const selectedKeyword = ref('')
const selectedTemplate = ref('default')
const articleLength = ref(1500)
const selectedCase = ref<number>()
const selectedCaseTemplate = ref('success')

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

const editingTemplate = reactive({
  name: '',
  content: '',
})

const keywordsList = ref([
  { id: 1, name: '数字化转型', priority: 92 },
  { id: 2, name: '人工智能应用', priority: 88 },
  { id: 3, name: '企业上云', priority: 85 },
])

const casesList = ref([
  { id: 1, title: '某大型银行数字化转型案例', highlights: ['降低成本30%', '效率提升50%', '客户满意度提升25%'] },
  { id: 2, title: '智能制造工厂案例', highlights: ['产能提升40%', '缺陷率下降60%'] },
])

const filteredCases = computed(() => {
  if (!caseSearch.value) return casesList.value
  return casesList.value.filter(c => c.title.includes(caseSearch.value))
})

const selectedCaseData = computed(() => {
  if (!selectedCase.value) return null
  return casesList.value.find(c => c.id === selectedCase.value)
})

const articles = ref<any[]>([])

const articleColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '文章标题', dataIndex: 'title', key: 'title', width: 300 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '质量分', dataIndex: 'score', key: 'score', width: 100 },
  { title: '生成方式', dataIndex: 'generateType', key: 'generateType', width: 100 },
  { title: '字数', dataIndex: 'wordCount', key: 'wordCount', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const },
]

function getPriorityColor(priority?: number) {
  const p = priority || 0
  if (p >= 80) return 'red'
  if (p >= 60) return 'orange'
  return 'green'
}

function getStatusColor(status?: string) {
  switch (status) {
    case 'published': return 'success'
    case 'reviewing': return 'processing'
    case 'draft': return 'default'
    default: return 'default'
  }
}

function getStatusText(status?: string) {
  switch (status) {
    case 'published': return '已发布'
    case 'reviewing': return '待审核'
    case 'draft': return '草稿'
    default: return '未知'
  }
}

function getGenerateTypeColor(type?: string) {
  switch (type) {
    case 'keyword': return 'blue'
    case 'case': return 'purple'
    case 'document': return 'green'
    case 'custom': return 'orange'
    default: return 'default'
  }
}

function getGenerateTypeText(type?: string) {
  switch (type) {
    case 'keyword': return '热词驱动'
    case 'case': return '案例驱动'
    case 'document': return '文档驱动'
    case 'custom': return '自定义主题'
    default: return '未知'
  }
}

function getTemplateName(template: string) {
  const map: Record<string, string> = {
    default: '默认模板',
    guide: '指南型模板',
    review: '评测型模板',
    news: '新闻型模板',
  }
  return map[template] || '默认模板'
}

function getAudienceName(audience: string) {
  const map: Record<string, string> = {
    general: '普通读者',
    professional: '专业人士',
    business: '企业决策者',
    student: '学生群体',
    technical: '技术人员',
  }
  return map[audience] || '普通读者'
}

function beforeDocumentUpload(file: any) {
  const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
  const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt')
  const isValid = isDocx || isPdf || isTxt
  if (!isValid) {
    message.error('只能上传 .docx、.pdf、.txt 格式的文件!')
    return false
  }
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error('文件大小不能超过 10MB!')
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
  if (info.file.status === 'done') {
    message.success(`${info.file.name} 上传成功`)
  } else if (info.file.status === 'error') {
    message.error(`${info.file.name} 上传失败`)
  }
}

function selectDocument(doc: any) {
  selectedDocument.value = doc
  documentPreviewContent.value = `这是文档「${doc.name}」的内容预览区域。\n\n在实际应用中，这里会显示从文档中提取的文本内容，用于生成文章时的参考。\n\n文档解析功能会提取文档的核心要点、关键数据和主要观点，AI 将基于这些内容生成高质量的文章。`
}

function formatDate(date?: string) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

function simulateProgress(targetPercent: number): Promise<void> {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (generateProgress.value >= targetPercent) {
        generateProgress.value = targetPercent
        clearInterval(interval)
        resolve()
      } else {
        generateProgress.value += Math.min(5, targetPercent - generateProgress.value)
      }
    }, 100)
  })
}

function onSelectChange(selectedKeys: number[]) {
  selectedRowKeys.value = selectedKeys
}

async function loadData() {
  loading.value = true
  try {
    const [articlesRes, statsData] = await Promise.all([
      articleApi.list({}),
      dashboardApi.getStats(),
    ]) as any
    
    articles.value = articlesRes?.records || articlesRes || []
    stats.totalArticles = statsData?.totalArticles || statsData?.total || 0
    stats.draftCount = statsData?.draftCount || 0
    stats.publishedCount = statsData?.publishedCount || 0
    stats.pendingCount = statsData?.pendingReview || statsData?.pendingReviewCount || 0
    stats.avgScore = statsData?.avgScore || 0
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function generateArticle() {
  generating.value = true
  generateProgress.value = 0

  let initialText = '正在分析关键词...'
  if (activeTab.value === 'case') {
    initialText = '正在分析案例...'
  } else if (activeTab.value === 'document') {
    initialText = '正在解析文档...'
  } else if (activeTab.value === 'custom') {
    initialText = '正在分析主题...'
  }
  progressText.value = initialText

  try {
    let params: any = {
      useKnowledge: useKnowledge.value,
    }

    if (activeTab.value === 'keyword') {
      params.type = 'keyword'
      params.keyword = selectedKeyword.value
      params.template = selectedTemplate.value
      params.length = articleLength.value
      params.style = articleStyle.value
      params.tone = articleTone.value
      
      const suggestionsRes = await suggestionApi.list({ page: 1, size: 1 })
      const suggestions = suggestionsRes.records
      if (suggestions.length > 0) {
        await articleApi.generateFromSuggestion(suggestions[0].id, selectedTemplate.value)
      }
    } else if (activeTab.value === 'case') {
      if (!selectedCase.value) {
        message.warning('请先选择一个案例')
        generating.value = false
        return
      }
      params.type = 'case'
      params.caseId = selectedCase.value
      params.template = selectedCaseTemplate.value
      params.highlights = highlightOptions.value
      
      progressText.value = '正在提取案例亮点...'
      await simulateProgress(30)
      progressText.value = '正在构建文章结构...'
      await simulateProgress(60)
      progressText.value = '正在生成文章内容...'
      await simulateProgress(100)
      
      const newArticle = {
        id: Date.now(),
        title: `${selectedCaseData.value?.title}深度分析报告`,
        status: 'draft',
        score: Math.floor(Math.random() * 20) + 80,
        generateType: 'case',
        wordCount: 1500,
        createdAt: new Date().toISOString(),
      }
      articles.value.unshift(newArticle)
      message.success('案例驱动生成文章成功！')
    } else if (activeTab.value === 'document') {
      if (!selectedDocument.value) {
        message.warning('请先选择一个文档')
        generating.value = false
        return
      }
      params.type = 'document'
      params.documentId = selectedDocument.value.uid
      params.template = selectedDocumentTemplate.value
      params.length = documentArticleLength.value
      params.style = documentArticleStyle.value
      params.tone = documentArticleTone.value
      
      progressText.value = '正在解析文档内容...'
      await simulateProgress(40)
      progressText.value = '正在提取核心观点...'
      await simulateProgress(70)
      progressText.value = '正在生成文章...'
      await simulateProgress(100)
      
      const newArticle = {
        id: Date.now(),
        title: `基于《${selectedDocument.value.name}》的分析报告`,
        status: 'draft',
        score: Math.floor(Math.random() * 20) + 78,
        generateType: 'document',
        wordCount: documentArticleLength.value,
        createdAt: new Date().toISOString(),
      }
      articles.value.unshift(newArticle)
      message.success('文档驱动生成文章成功！')
    } else if (activeTab.value === 'custom') {
      if (!customTopic.value.trim()) {
        message.warning('请输入文章主题')
        generating.value = false
        return
      }
      params.type = 'custom'
      params.topic = customTopic.value
      params.keywords = customKeywords.value
      params.audience = targetAudience.value
      params.template = selectedCustomTemplate.value
      params.length = customArticleLength.value
      params.style = customArticleStyle.value
      params.tone = customArticleTone.value
      
      progressText.value = '正在分析主题需求...'
      await simulateProgress(30)
      progressText.value = '正在搜索相关素材...'
      await simulateProgress(60)
      progressText.value = '正在撰写文章...'
      await simulateProgress(100)
      
      const newArticle = {
        id: Date.now(),
        title: customTopic.value,
        status: 'draft',
        score: Math.floor(Math.random() * 20) + 75,
        generateType: 'custom',
        wordCount: customArticleLength.value,
        createdAt: new Date().toISOString(),
      }
      articles.value.unshift(newArticle)
      message.success('自定义主题生成文章成功！')
    }
    
    generateProgress.value = 100
    progressText.value = '生成完成！'
    
    message.success('文章生成成功！')
    await loadData()
  } catch (error) {
    message.error('生成失败')
    console.error(error)
  } finally {
    generating.value = false
    generateProgress.value = 0
  }
}

function saveTemplate() {
  message.success('模板已保存')
  showTemplateEditor.value = false
}

function handleView(record: any) {
  router.push(`/workspace/articles/${record.id}`)
}

function handleEdit(record: any) {
  router.push({ name: 'workspace-article-edit', params: { id: record.id } })
}

function handleDelete(record: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除文章「${record.title}」吗？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await articleApi.delete(record.id)
        message.success('删除成功')
        await loadData()
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

async function batchReview() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请选择要审核的文章')
    return
  }
  try {
    let successCount = 0
    for (const id of selectedRowKeys.value) {
      try {
        await articleApi.submitReview(id)
        successCount++
      } catch (e) {
        // 单篇失败继续处理
      }
    }
    message.success(`已提交 ${successCount} 篇文章审核`)
    selectedRowKeys.value = []
    await loadData()
  } catch (error) {
    message.error('提交审核失败')
  }
}

async function batchPublish() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请选择要发布的文章')
    return
  }
  try {
    await articleApi.batchPublish(selectedRowKeys.value)
    message.success(`已发布 ${selectedRowKeys.value.length} 篇文章`)
    selectedRowKeys.value = []
    await loadData()
  } catch (error) {
    message.error('批量发布失败')
  }
}

function batchDelete() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请选择要删除的文章')
    return
  }
  Modal.confirm({
    title: '确认批量删除',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 篇文章吗？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        let successCount = 0
        for (const id of selectedRowKeys.value) {
          try {
            await articleApi.delete(id)
            successCount++
          } catch (e) {
            // 单篇失败继续处理
          }
        }
        message.success(`已删除 ${successCount} 篇文章`)
        selectedRowKeys.value = []
        await loadData()
      } catch (error) {
        message.error('批量删除失败')
      }
    }
  })
}

function confirmBatchGenerate() {
  message.success(`已配置批量生成 ${batchCount.value} 篇文章`)
  showBatchConfig.value = false
}

const initTrendChart = () => {
  if (!trendChartRef.value) return
  
  if (trendChart) {
    trendChart.dispose()
  }
  trendChart = echarts.init(trendChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c}%',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#1e293b',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
      axisLine: {
        lineStyle: {
          color: '#e2e8f0',
        },
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      min: 70,
      max: 100,
      axisLabel: {
        formatter: '{value}%',
        color: '#64748b',
        fontSize: 11,
      },
      splitLine: {
        lineStyle: {
          color: '#f1f5f9',
        },
      },
    },
    series: [
      {
        name: '成功率',
        type: 'line',
        smooth: true,
        data: [],
        lineStyle: {
          color: '#1890ff',
          width: 3,
        },
        itemStyle: {
          color: '#1890ff',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.25)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }
  
  trendChart.setOption(option)
}

const initTemplateChart = () => {
  if (!templateChartRef.value) return
  
  if (templateChart) {
    templateChart.dispose()
  }
  templateChart = echarts.init(templateChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#1e293b',
      },
    },
    legend: {
      orient: 'vertical',
      right: 5,
      top: 'center',
      textStyle: {
        fontSize: 11,
        color: '#64748b',
      },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#1e293b',
          },
        },
        labelLine: {
          show: false,
        },
        data: [],
      },
    ],
  }
  
  templateChart.setOption(option)
}

const initQualityChart = () => {
  if (!qualityChartRef.value) return
  
  if (qualityChart) {
    qualityChart.dispose()
  }
  qualityChart = echarts.init(qualityChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: {
        color: '#1e293b',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLine: {
        lineStyle: {
          color: '#e2e8f0',
        },
      },
      axisLabel: {
        fontSize: 10,
        interval: 0,
        rotate: 25,
        color: '#64748b',
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
      },
      splitLine: {
        lineStyle: {
          color: '#f1f5f9',
        },
      },
    },
    series: [
      {
        type: 'bar',
        data: [],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#1890ff' },
            { offset: 1, color: '#91d5ff' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '55%',
      },
    ],
  }
  
  qualityChart.setOption(option)
}

const handleResize = () => {
  trendChart?.resize()
  templateChart?.resize()
  qualityChart?.resize()
}

onMounted(() => {
  loadData()
  setTimeout(() => {
    initCharts()
    window.addEventListener('resize', handleResize)
  }, 200)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  templateChart?.dispose()
  qualityChart?.dispose()
})

watch(analysisExpanded, (newVal) => {
  if (newVal) {
    nextTick(() => {
      handleResize()
    })
  }
})
</script>

<style scoped lang="less">
@blue-50: #e6f7ff;
@blue-100: #bae7ff;
@blue-200: #91d5ff;
@blue-500: #1890ff;
@blue-600: #096dd9;
@blue-700: #0050b3;

@purple-50: #f9f0ff;
@purple-100: #efdbff;
@purple-200: #d3adf7;
@purple-500: #722ed1;
@purple-600: #531dab;

@green-50: #f6ffed;
@green-100: #d9f7be;
@green-200: #b7eb8f;
@green-500: #52c41a;
@green-600: #389e0d;

@orange-50: #fff7e6;
@orange-100: #ffe7ba;
@orange-200: #ffd591;
@orange-500: #fa8c16;
@orange-600: #d46b08;

@red-50: #fff1f0;
@red-500: #ff4d4f;

@slate-50: #f8fafc;
@slate-100: #f1f5f9;
@slate-200: #e2e8f0;
@slate-300: #cbd5e1;
@slate-400: #94a3b8;
@slate-500: #64748b;
@slate-600: #475569;
@slate-700: #334155;
@slate-800: #1e293b;
@slate-900: #0f172a;

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

.article-generate-page {
  width: 100%;
  padding: 8px 0;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  border: 1px solid @slate-200;
  animation: fadeInDown 0.6s ease-out;

  &__left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, @blue-500 0%, @purple-500 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 28px;
    box-shadow: 0 8px 24px rgba(24, 144, 255, 0.3);

    svg {
      width: 32px;
      height: 32px;
    }
  }

  &__text {
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: @slate-900;
      line-height: 1.3;
    }

    p {
      margin: 4px 0 0 0;
      font-size: 14px;
      color: @slate-500;
    }
  }
}

/* 统计卡片 */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  position: relative;
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  overflow: hidden;
  background: #fff;
  border: 1px solid @slate-200;
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  }

  &:focus-visible {
    outline: 2px solid @blue-500;
    outline-offset: 2px;
  }

  &--blue {
    color: @blue-500;

    .stat-card__icon {
      background: linear-gradient(135deg, @blue-500 0%, #36cfc9 100%);
      box-shadow: 0 8px 20px rgba(24, 144, 255, 0.35);
    }

    .stat-card__glow {
      background: radial-gradient(circle at 80% 20%, rgba(24, 144, 255, 0.15) 0%, transparent 60%);
    }

    .trend-up {
      color: @blue-500;
      background: @blue-50;
    }
  }

  &--purple {
    color: @purple-500;

    .stat-card__icon {
      background: linear-gradient(135deg, @purple-500 0%, #b37feb 100%);
      box-shadow: 0 8px 20px rgba(114, 46, 209, 0.35);
    }

    .stat-card__glow {
      background: radial-gradient(circle at 80% 20%, rgba(114, 46, 209, 0.15) 0%, transparent 60%);
    }

    .trend-up {
      color: @purple-500;
      background: @purple-50;
    }
  }

  &--green {
    color: @green-500;

    .stat-card__icon {
      background: linear-gradient(135deg, @green-500 0%, #95de64 100%);
      box-shadow: 0 8px 20px rgba(82, 196, 26, 0.35);
    }

    .stat-card__glow {
      background: radial-gradient(circle at 80% 20%, rgba(82, 196, 26, 0.15) 0%, transparent 60%);
    }

    .trend-up {
      color: @green-500;
      background: @green-50;
    }
  }

  &--orange {
    color: @orange-500;

    .stat-card__icon {
      background: linear-gradient(135deg, @orange-500 0%, #ffc53d 100%);
      box-shadow: 0 8px 20px rgba(250, 140, 22, 0.35);
    }

    .stat-card__glow {
      background: radial-gradient(circle at 80% 20%, rgba(250, 140, 22, 0.15) 0%, transparent 60%);
    }

    .trend-down {
      color: @orange-500;
      background: @orange-50;
    }
  }

  &__glow {
    position: absolute;
    top: 0;
    right: 0;
    width: 200px;
    height: 200px;
    pointer-events: none;
  }

  &__pattern {
    position: absolute;
    top: 0;
    right: 0;
    width: 120px;
    height: 120px;
    opacity: 0.8;
    pointer-events: none;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &__content {
    position: relative;
    z-index: 1;
  }

  &__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  &__icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 22px;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover &__icon {
    transform: scale(1.1) rotate(-5deg);
  }

  &__trend {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;

    .trend-arrow {
      font-size: 14px;
    }
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 8px;

    .value-number {
      font-size: 32px;
      font-weight: 700;
      color: @slate-900;
      line-height: 1.2;
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .value-unit {
      font-size: 14px;
      color: @slate-500;
      font-weight: 500;
    }
  }

  &__bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .stat-card__label {
      font-size: 14px;
      color: @slate-600;
      font-weight: 500;
    }

    .stat-card__period {
      font-size: 12px;
      color: @slate-400;
    }
  }
}

/* 卡片通用样式 */
.generate-card,
.list-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid @slate-200;
  margin-bottom: 20px;
  overflow: hidden;
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0;

  &__left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  &__icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, @blue-500 0%, @purple-500 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20px;
  }

  &__text {
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: @slate-900;
      line-height: 1.3;
    }

    p {
      margin: 2px 0 0 0;
      font-size: 13px;
      color: @slate-500;
    }
  }
}

.generate-card {
  :deep(.ant-tabs) {
    padding: 20px 24px 24px;
  }

  :deep(.ant-tabs-nav) {
    margin-bottom: 24px;
    background: @slate-50;
    border-radius: 12px;
    padding: 6px;

    &::before {
      display: none;
    }
  }

  :deep(.ant-tabs-tab) {
    padding: 10px 20px;
    margin: 0 !important;
    border-radius: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      color: @blue-500;
    }

    &.ant-tabs-tab-active {
      background: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }

  :deep(.ant-tabs-ink-bar) {
    display: none;
  }
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  font-size: 14px;

  :deep(.anticon) {
    font-size: 16px;
  }
}

.form-section,
.preview-section {
  h4.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    font-size: 15px;
    font-weight: 600;
    color: @slate-800;

    :deep(.anticon) {
      color: @blue-500;
      font-size: 18px;
    }
  }
}

.template-select-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;

  .preview-btn {
    flex-shrink: 0;
  }
}

.param-label {
  text-align: right;
  color: @slate-500;
  font-size: 13px;
  margin-top: 4px;
  font-weight: 500;
}

/* 预览卡片 */
.template-preview-card,
.case-preview-card,
.document-preview-card {
  background: linear-gradient(135deg, @slate-50 0%, #fff 100%);
  border-radius: 12px;
  border: 1px solid @slate-200;
  overflow: hidden;
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  }
}

.preview-header,
.case-preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid @slate-200;
  font-weight: 600;
  color: @slate-800;

  :deep(.anticon) {
    font-size: 18px;
    color: @blue-500;
  }
}

.preview-content {
  padding: 20px;
  line-height: 1.8;
  font-size: 13px;
  color: @slate-600;
}

.preview-title {
  font-size: 15px;
  font-weight: 600;
  color: @slate-800;
  margin-bottom: 12px;
}

.preview-paragraph {
  margin-bottom: 10px;
  padding-left: 12px;
  border-left: 3px solid @slate-300;
}

/* 知识库折叠面板 */
.knowledge-collapse {
  margin-top: 16px;
  border-radius: 12px;
  overflow: hidden;
  background: @slate-50;
  border: 1px solid @slate-200;

  :deep(.ant-collapse) {
    background: transparent;
    border: none;

    > .ant-collapse-item {
      border-bottom: none;

      &:last-child {
        border-bottom: none;
      }
    }
  }

  :deep(.ant-collapse-header) {
    padding: 14px 16px !important;
    font-weight: 500;
    color: @slate-700;
  }

  :deep(.ant-collapse-content-box) {
    padding: 0 16px 16px !important;
  }
}

.collapse-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;

  :deep(.anticon) {
    font-size: 16px;
    color: @blue-500;
  }
}

.knowledge-panel {
  .knowledge-list {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .knowledge-item {
    padding: 12px 14px;
    background: #fff;
    border-radius: 8px;
    border: 1px solid @slate-200;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: @blue-200;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.08);
    }

    &-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
  }

  .knowledge-title {
    font-weight: 500;
    color: @slate-800;
    font-size: 13px;
  }

  .knowledge-summary {
    font-size: 12px;
    color: @slate-500;
    line-height: 1.6;
  }
}

/* 案例亮点 */
.case-highlights {
  padding: 20px;

  .highlights-title {
    font-size: 14px;
    font-weight: 600;
    color: @slate-800;
    margin-bottom: 12px;
  }
}

.highlight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(250, 173, 20, 0.08);
  border-radius: 8px;
  font-size: 13px;
  color: @slate-600;
  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(250, 173, 20, 0.15);
  }

  .highlight-icon {
    color: @orange-500;
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.empty-preview {
  padding: 40px 0;
}

/* 生成操作区 */
.generate-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid @slate-200;
  flex-wrap: wrap;
  gap: 16px;
}

.actions-left {
  display: flex;
  align-items: center;
}

.switch-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: @slate-50;
  border-radius: 8px;
  border: 1px solid @slate-200;
}

.action-btn {
  border-radius: 10px;
  height: 40px;
}

.generate-btn {
  min-width: 200px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, @blue-500 0%, @purple-500 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(24, 144, 255, 0.3);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: linear-gradient(135deg, @blue-600 0%, @purple-600 100%);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(24, 144, 255, 0.4);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid @blue-500;
    outline-offset: 2px;
  }
}

/* 生成进度 */
.generating-progress {
  margin-top: 20px;
  padding: 20px 24px;
  background: linear-gradient(135deg, @green-50 0%, #fff 100%);
  border: 1px solid #b7eb8f;
  border-radius: 12px;

  .progress-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .progress-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, @green-500 0%, #95de64 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20px;
    animation: pulse 2s ease-in-out infinite;
  }

  .progress-info {
    flex: 1;

    .progress-title {
      font-size: 15px;
      font-weight: 600;
      color: @slate-800;
      margin-bottom: 2px;
    }

    .progress-text {
      font-size: 13px;
      color: @green-600;
    }
  }

  .progress-percent {
    font-size: 24px;
    font-weight: 700;
    color: @green-600;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  :deep(.ant-progress-bg) {
    background: linear-gradient(90deg, @green-500 0%, #95de64 100%) !important;
  }
}

/* 列表卡片 */
.list-card {
  .list-view,
  .card-view {
    padding: 0 24px 24px;
  }
}

/* 批量操作 */
.batch-operations {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, @blue-50 0%, #fff 100%);
  border-radius: 10px;
  border: 1px solid @blue-100;

  .selected-count {
    font-size: 13px;
    color: @blue-700;
    font-weight: 500;
  }
}

.score-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: @orange-500;
  font-weight: 500;

  .score-icon {
    font-size: 14px;
  }
}

/* 卡片视图 */
.card-view {
  .article-card {
    position: relative;
    background: #fff;
    border-radius: 12px;
    border: 1px solid @slate-200;
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    opacity: 0;
    animation: fadeInUp 0.5s ease-out forwards;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
      border-color: @blue-200;
    }

    &:focus-visible {
      outline: 2px solid @blue-500;
      outline-offset: 2px;
    }
  }
}

.article-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.quality-score {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: @orange-500;
  font-weight: 500;

  .score-icon {
    font-size: 14px;
  }
}

.article-card-title {
  font-weight: 600;
  font-size: 14px;
  color: @slate-800;
  margin-bottom: 10px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  flex: 1;
}

.article-card-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;

  .meta-item {
    font-size: 12px;
    color: @slate-500;
    display: flex;
    align-items: center;
    gap: 4px;

    :deep(.anticon) {
      font-size: 12px;
    }
  }
}

.article-card-tags {
  margin-bottom: 12px;
}

.article-card-actions {
  display: flex;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid @slate-200;
  margin-top: auto;
}

/* 分析区域 */
.analysis-section {
  background: #fff;
  border-radius: 16px;
  border: 1px solid @slate-200;
  margin-bottom: 20px;
  overflow: hidden;
  opacity: 0;
  animation: fadeInUp 0.6s ease-out forwards;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  cursor: pointer;
  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: @slate-50;
  }

  &:focus-visible {
    outline: 2px solid @blue-500;
    outline-offset: -2px;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  &__icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, @purple-500 0%, @blue-500 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20px;
  }

  &__text {
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: @slate-900;
      line-height: 1.3;
    }

    p {
      margin: 2px 0 0 0;
      font-size: 13px;
      color: @slate-500;
    }
  }

  &__arrow {
    color: @slate-400;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.analysis-content {
  padding: 0 24px 24px;
}

.chart-card {
  background: @slate-50;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid @slate-200;
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  }

  &__header {
    margin-bottom: 12px;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: @slate-800;
    }
  }
}

.chart-container {
  height: 220px;
  width: 100%;
}

/* 关键词选项 */
.keyword-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* 文档列表 */
.document-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .document-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: @slate-50;
    border: 1px solid @slate-200;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: @blue-50;
      border-color: @blue-200;
    }

    &:focus-visible {
      outline: 2px solid @blue-500;
      outline-offset: 2px;
    }

    &.active {
      background: @blue-50;
      border-color: @blue-500;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
    }

    .doc-icon {
      color: @blue-500;
      font-size: 18px;
      flex-shrink: 0;
    }

    .doc-name {
      font-size: 13px;
      color: @slate-800;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.document-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid @slate-200;
}

.document-preview-card {
  max-height: 300px;
  overflow-y: auto;
}

/* 弹窗内容 */
.modal-preview-content {
  .preview-content {
    padding: 20px;
    background: @slate-50;
    border-radius: 10px;
  }

  .case-preview-content {
    h3 {
      margin-bottom: 16px;
      font-size: 18px;
      color: @slate-800;
    }
  }
}

/* 动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

/* 响应式 */
@media (max-width: 992px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .generate-actions {
    flex-direction: column;
    align-items: stretch;

    .actions-left,
    .actions-right {
      width: 100%;
    }

    .generate-btn {
      width: 100%;
    }
  }

  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .card-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .stat-cards {
    grid-template-columns: 1fr;
  }
}
</style>
