<template>
  <div class="articles-panel-page">
    <a-spin :spinning="loading">
      <!-- 顶部数据概览区 -->
      <a-row :gutter="[16, 16]" style="margin-bottom: 20px">
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-blue" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <FileTextOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.totalArticles }}</div>
                <div class="stat-title">文章总数</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend">
                {{ statusCounts.published }}
              </span>
              <span class="stat-label">已发布</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-purple" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <PlusCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.todayCount }}</div>
                <div class="stat-title">今日新增</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend">
                {{ stats.weekCount }}
              </span>
              <span class="stat-label">近 7 天</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-green" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <CalendarOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.monthPublished }}</div>
                <div class="stat-title">本月发布</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend">
                {{ stats.yearPublished }}
              </span>
              <span class="stat-label">本年发布</span>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card class="stat-card stat-card-orange" hoverable>
            <div class="stat-content">
              <div class="stat-icon">
                <FireOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ stats.topViews }}</div>
                <div class="stat-title">热门Top1阅读量</div>
              </div>
            </div>
            <div class="stat-footer">
              <span class="stat-trend">
                {{ stats.viewsSum }}
              </span>
              <span class="stat-label">列表阅读合计</span>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 主内容区 -->
      <a-row :gutter="20">
        <!-- 左侧主内容 -->
        <a-col :xs="24" :xl="20">
          <a-card class="main-card" :bordered="false">
            <!-- 筛选与搜索区 -->
            <div class="filter-section">
              <div class="filter-header">
                <div class="filter-title">
                  <FilterOutlined class="title-icon" />
                  <span>筛选与搜索</span>
                </div>
                <a-space>
                  <a-button size="small" @click="showAdvancedFilter = !showAdvancedFilter">
                    <template #icon><DownOutlined v-if="!showAdvancedFilter" /><UpOutlined v-else /></template>
                    {{ showAdvancedFilter ? '收起筛选' : '高级筛选' }}
                  </a-button>
                  <a-button size="small" @click="resetFilter">
                    <template #icon><ReloadOutlined /></template>
                    重置
                  </a-button>
                </a-space>
              </div>

              <!-- 搜索框 -->
              <div class="search-row">
                <!-- 关键词命中即由 filteredArticles 响应式生效，无需再挂 @search 调空函数 -->
                <a-input-search
                  v-model:value="filterForm.keyword"
                  placeholder="搜索文章标题或内容..."
                  size="large"
                  enter-button
                >
                  <template #addonBefore>
                    <a-select v-model:value="searchType" style="width: 100px">
                      <a-select-option value="title">标题</a-select-option>
                      <a-select-option value="content">内容</a-select-option>
                      <a-select-option value="all">全部</a-select-option>
                    </a-select>
                  </template>
                </a-input-search>
              </div>

              <!-- 状态快速标签 -->
              <div class="status-tags">
                <span class="status-tags-label">状态：</span>
                <a-space wrap size="small">
                  <a-tag
                    :class="{ 'status-tag-active': !filterForm.status }"
                    class="status-tag"
                    @click="setQuickStatus('')"
                  >
                    全部
                  </a-tag>
                  <a-tag
                    :class="{ 'status-tag-active': filterForm.status === 'draft' }"
                    color="default"
                    class="status-tag"
                    @click="setQuickStatus('draft')"
                  >
                    <EditOutlined /> 草稿
                    <span class="status-count">{{ statusCounts.draft }}</span>
                  </a-tag>
                  <a-tag
                    :class="{ 'status-tag-active': filterForm.status === 'pending_review' }"
                    color="processing"
                    class="status-tag"
                    @click="setQuickStatus('pending_review')"
                  >
                    <ClockCircleOutlined /> 待审核
                    <span class="status-count">{{ statusCounts.pending_review }}</span>
                  </a-tag>
                  <a-tag
                    :class="{ 'status-tag-active': filterForm.status === 'published' }"
                    color="success"
                    class="status-tag"
                    @click="setQuickStatus('published')"
                  >
                    <CheckCircleOutlined /> 已发布
                    <span class="status-count">{{ statusCounts.published }}</span>
                  </a-tag>
                  <a-tag
                    :class="{ 'status-tag-active': filterForm.status === 'offline' }"
                    color="warning"
                    class="status-tag"
                    @click="setQuickStatus('offline')"
                  >
                    <CloudDownloadOutlined /> 已下架
                    <span class="status-count">{{ statusCounts.offline }}</span>
                  </a-tag>
                  <a-tag
                    :class="{ 'status-tag-active': filterForm.status === 'rejected' }"
                    color="error"
                    class="status-tag"
                    @click="setQuickStatus('rejected')"
                  >
                    <CloseCircleOutlined /> 已驳回
                    <span class="status-count">{{ statusCounts.rejected }}</span>
                  </a-tag>
                </a-space>
              </div>

              <!-- 高级筛选面板 -->
              <div v-show="showAdvancedFilter" class="advanced-filter">
                <a-form layout="horizontal" :label-col="{ span: 4 }" :wrapper-col="{ span: 20 }">
                  <a-row :gutter="24">
                    <a-col :xs="24" :md="12">
                      <a-form-item label="所属栏目">
                        <a-tree-select
                          v-model:value="filterForm.categoryId"
                          :tree-data="categoryTreeData"
                          placeholder="选择栏目"
                          style="width: 100%"
                          :tree-default-expand-all="true"
                          allow-clear
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item label="文章状态">
                        <a-select
                          v-model:value="filterForm.status"
                          style="width: 100%"
                          allow-clear
                          placeholder="选择状态"
                        >
                          <a-select-option value="draft">草稿</a-select-option>
                          <a-select-option value="pending_review">待审核</a-select-option>
                          <a-select-option value="approved">审核通过</a-select-option>
                          <a-select-option value="scheduled">已排期</a-select-option>
                          <a-select-option value="published">已发布</a-select-option>
                          <a-select-option value="offline">已下架</a-select-option>
                          <a-select-option value="rejected">已驳回</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item label="作者">
                        <a-select
                          v-model:value="filterForm.authorId"
                          style="width: 100%"
                          allow-clear
                          placeholder="选择作者"
                        >
                          <a-select-option v-for="a in authors" :key="a.id" :value="a.id">{{ a.name }}</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item label="时间范围">
                        <a-range-picker
                          v-model:value="filterForm.dateRange"
                          style="width: 100%"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item label="标签">
                        <a-select
                          v-model:value="filterForm.tags"
                          mode="multiple"
                          style="width: 100%"
                          placeholder="选择标签"
                          allow-clear
                        >
                          <a-select-option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                  </a-row>
                </a-form>
              </div>
            </div>

            <!-- 视图切换区 -->
            <div class="view-toolbar">
              <div class="view-info">
                <span class="view-count">共 <strong>{{ filteredArticles.length }}</strong> 篇文章</span>
              </div>
              <a-space>
                <a-segmented v-model:value="viewMode" @change="changeViewMode"
                  :options="[
                    { value: 'list', label: () => h('span', {}, [h(UnorderedListOutlined), ' 列表视图']) },
                    { value: 'card', label: () => h('span', {}, [h(AppstoreOutlined), ' 卡片视图']) },
                    { value: 'thumbnail', label: () => h('span', {}, [h(PictureOutlined), ' 缩略图']) },
                  ]"
                />
              </a-space>
            </div>

            <!-- 批量操作区 -->
            <div v-if="selectedRowKeys.length" class="batch-actions">
              <div class="batch-info">
                <CheckCircleOutlined />
                已选择 <strong>{{ selectedRowKeys.length }}</strong> 篇文章
              </div>
              <a-space>
                <a-button type="primary" size="small" @click="batchPublish">
                  <template #icon><SendOutlined /></template>
                  批量发布
                </a-button>
                <a-button size="small" @click="batchMove">
                  <template #icon><SwapOutlined /></template>
                  移动栏目
                </a-button>
                <a-button size="small" @click="batchSetTags">
                  <template #icon><TagsOutlined /></template>
                  设置标签
                </a-button>
                <a-button size="small" danger @click="batchDelete">
                  <template #icon><DeleteOutlined /></template>
                  批量删除
                </a-button>
                <a-button type="text" size="small" @click="clearSelection">取消选择</a-button>
              </a-space>
            </div>

            <!-- 列表视图 -->
            <div v-if="viewMode === 'list'" class="view-content">
              <a-table
                :scroll="{ x: 'max-content' }"
                :data-source="filteredArticles"
                :columns="tableColumns"
                :pagination="tablePagination"
                :loading="loading"
                row-key="id"
                :row-selection="{ selectedRowKeys, onChange: onSelectChange }"
                @change="handleTableChange"
                class="article-table"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'title'">
                    <div class="article-title-cell">
                      <div class="article-thumb">
                        <img v-if="record.coverImage" :src="record.coverImage" />
                        <div v-else class="default-thumb">
                          <FileTextOutlined />
                        </div>
                      </div>
                      <div class="article-title-info">
                        <div class="title">
                          {{ record.title }}
                          <DemoFlag :is-demo="record.isDemo" />
                        </div>
                        <div class="subtitle">{{ record.subtitle || '-' }}</div>
                      </div>
                    </div>
                  </template>
                  <template v-else-if="column.key === 'category'">
                    <a-tag v-if="categoryNameOf(record)" color="blue">{{ categoryNameOf(record) }}</a-tag>
                    <span v-else class="category-missing">-</span>
                  </template>
                  <template v-else-if="column.key === 'status'">
                    <a-tag :color="statusMeta(record.status).color">
                      <component :is="getStatusIcon(record.status)" />
                      {{ statusMeta(record.status).label }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.key === 'views'">
                    <span class="views-cell">
                      <EyeOutlined /> {{ record.viewCount || 0 }}
                    </span>
                  </template>
                  <template v-else-if="column.key === 'publishTime'">
                    {{ formatTime(record.publishedAt) }}
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <a-space size="small">
                      <a-tooltip title="预览">
                        <a-button type="link" size="small" @click="viewArticle(record)">
                          <EyeOutlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip title="编辑">
                        <a-button type="link" size="small" @click="editArticle(record)">
                          <EditOutlined />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip title="复制">
                        <a-button type="link" size="small" @click="copyArticle(record)">
                          <CopyOutlined />
                        </a-button>
                      </a-tooltip>
                      <a-dropdown>
                        <a-button type="link" size="small">
                          <MoreOutlined />
                        </a-button>
                        <template #overlay>
                          <a-menu>
                            <a-menu-item @click="publishArticle(record)">
                              <SendOutlined /> 发布
                            </a-menu-item>
                            <a-menu-item @click="offlineArticle(record)">
                              <CloudDownloadOutlined /> 下架
                            </a-menu-item>
                            <a-menu-item @click="setTop(record)">
                              <VerticalAlignTopOutlined /> 置顶
                            </a-menu-item>
                            <a-menu-item @click="setRecommend(record)">
                              <StarOutlined /> 推荐
                            </a-menu-item>
                            <a-menu-divider />
                            <a-menu-item danger @click="deleteArticle(record)">
                              <DeleteOutlined /> 删除
                            </a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </a-space>
                  </template>
                </template>
              </a-table>
            </div>

            <!-- 卡片视图 -->
            <div v-else-if="viewMode === 'card'" class="view-content card-view">
              <a-row :gutter="[16, 16]">
                <a-col :xs="24" :sm="12" :md="8" :xl="6" v-for="article in filteredArticles" :key="article.id">
                  <a-card class="article-card" hoverable>
                    <div class="card-cover" @click="viewArticle(article)">
                      <img v-if="article.coverImage" :src="article.coverImage" :alt="article.title" />
                      <div v-else class="default-cover">
                        <FileTextOutlined />
                      </div>
                      <div class="card-status">
                        <a-tag :color="statusMeta(article.status).color" size="small">
                          {{ statusMeta(article.status).label }}
                        </a-tag>
                      </div>
                      <div v-if="article.isTop" class="card-badge top">置顶</div>
                      <div v-if="article.isRecommend" class="card-badge recommend">推荐</div>
                    </div>
                    <div class="card-content">
                      <h4 class="card-title" @click="viewArticle(article)">{{ article.title }}</h4>
                      <p class="card-summary">{{ article.summary || '暂无摘要' }}</p>
                      <div class="card-meta">
                        <span>
                          <UserOutlined /> {{ article.authorName || '未知' }}
                        </span>
                        <span>
                          <CalendarOutlined /> {{ formatDate(article.createdAt) }}
                        </span>
                      </div>
                      <div class="card-stats">
                        <span><EyeOutlined /> {{ article.viewCount || 0 }}</span>
                        <span><LikeOutlined /> {{ article.likes || 0 }}</span>
                        <span><MessageOutlined /> {{ article.comments || 0 }}</span>
                      </div>
                      <div class="card-tags">
                        <a-tag v-for="tag in article.tags?.slice(0, 3)" :key="tag" size="small">{{ tag }}</a-tag>
                      </div>
                    </div>
                    <div class="card-actions">
                      <a-checkbox :checked="selectedRowKeys.includes(article.id)" @change="(e: any) => toggleSelect(article, e.target.checked)">
                        选择
                      </a-checkbox>
                      <a-space>
                        <a-button type="link" size="small" @click="editArticle(article)">
                          <EditOutlined /> 编辑
                        </a-button>
                        <a-button type="link" size="small" danger @click="deleteArticle(article)">
                          <DeleteOutlined /> 删除
                        </a-button>
                      </a-space>
                    </div>
                  </a-card>
                </a-col>
              </a-row>
            </div>

            <!-- 缩略图视图 -->
            <div v-else class="view-content thumbnail-view">
              <a-row :gutter="[8, 8]">
                <a-col :xs="12" :sm="8" :md="6" :lg="4" :xl="3" v-for="article in filteredArticles" :key="article.id">
                  <a-card class="thumbnail-card" hoverable>
                    <div class="thumbnail-cover" @click="viewArticle(article)">
                      <img v-if="article.coverImage" :src="article.coverImage" :alt="article.title" />
                      <div v-else class="default-thumbnail">
                        <FileTextOutlined />
                      </div>
                      <div class="thumbnail-overlay">
                        <a-tag :color="statusMeta(article.status).color" size="small">{{ statusMeta(article.status).label }}</a-tag>
                      </div>
                    </div>
                    <div class="thumbnail-info">
                      <div class="thumbnail-title" :title="article.title">{{ article.title }}</div>
                      <div class="thumbnail-meta">
                        <span><EyeOutlined /> {{ article.viewCount || 0 }}</span>
                      </div>
                    </div>
                    <div class="thumbnail-actions">
                      <a-checkbox :checked="selectedRowKeys.includes(article.id)" @change="(e: any) => toggleSelect(article, e.target.checked)">选择</a-checkbox>
                      <a-button type="link" size="small" @click="editArticle(article)">编辑</a-button>
                    </div>
                  </a-card>
                </a-col>
              </a-row>
            </div>
          </a-card>
        </a-col>

        <!-- 右侧快捷操作侧边栏 -->
        <a-col :xs="24" :xl="4">
          <div class="sidebar">
            <!-- 新建文章按钮 -->
            <a-button type="primary" size="large" block class="create-btn" @click="showArticleEditor = true">
              <template #icon><EditOutlined /></template>
              新建文章
            </a-button>

            <!-- 快捷入口 -->
            <a-card class="sidebar-card" :bordered="false">
              <template #title>
                <div class="sidebar-title">快捷入口</div>
              </template>
              <div class="quick-entries">
                <div class="quick-entry" @click="goToDrafts">
                  <div class="entry-icon draft">
                    <FileTextOutlined />
                  </div>
                  <div class="entry-info">
                    <div class="entry-name">草稿箱</div>
                    <div class="entry-count">{{ draftCount }} 篇</div>
                  </div>
                  <RightOutlined class="entry-arrow" />
                </div>
                <div class="quick-entry" @click="goToReview">
                  <div class="entry-icon review">
                    <AuditOutlined />
                  </div>
                  <div class="entry-info">
                    <div class="entry-name">待审核</div>
                    <div class="entry-count">{{ reviewCount }} 篇</div>
                  </div>
                  <RightOutlined class="entry-arrow" />
                </div>
              </div>
            </a-card>

            <!-- 最近编辑记录 -->
            <a-card class="sidebar-card" :bordered="false">
              <template #title>
                <div class="sidebar-title">最近编辑</div>
              </template>
              <div class="recent-list">
                <div v-for="item in recentEdits" :key="item.id" class="recent-item" @click="editArticle(item)">
                  <div class="recent-thumb">
                    <img v-if="item.coverImage" :src="item.coverImage" />
                    <div v-else class="recent-thumb-default">
                      <FileTextOutlined />
                    </div>
                  </div>
                  <div class="recent-info">
                    <div class="recent-title">{{ item.title }}</div>
                    <div class="recent-time">{{ formatDate(item.updatedAt) }}</div>
                  </div>
                </div>
                <a-empty v-if="!recentEdits.length" description="暂无编辑记录" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
              </div>
            </a-card>
          </div>
        </a-col>
      </a-row>

      <!-- 文章预览弹窗 -->
      <a-modal
        v-model:open="showArticlePreview"
        :title="previewArticle?.title || '文章预览'"
        width="80%"
        :footer="null"
        :destroy-on-close="true"
      >
        <div class="article-preview" v-if="previewArticle">
          <a-descriptions :column="2" bordered size="small" style="margin-bottom: 16px">
            <a-descriptions-item label="状态">
              <a-tag :color="statusMeta(previewArticle.status).color">{{ statusMeta(previewArticle.status).label }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="栏目">{{ categoryNameOf(previewArticle) || '-' }}</a-descriptions-item>
            <a-descriptions-item label="作者">{{ previewArticle.authorName || '-' }}</a-descriptions-item>
            <a-descriptions-item label="浏览量">{{ previewArticle.viewCount || 0 }}</a-descriptions-item>
            <a-descriptions-item label="创建时间">{{ formatTime(previewArticle.createdAt) }}</a-descriptions-item>
            <a-descriptions-item label="更新时间">{{ formatTime(previewArticle.updatedAt) }}</a-descriptions-item>
          </a-descriptions>
          <div v-if="previewArticle.summary" style="margin-bottom: 12px; color: #666; font-style: italic;">{{ previewArticle.summary }}</div>
          <a-divider />
          <div class="preview-content" v-html="previewHtml"></div>
        </div>
      </a-modal>

      <!-- 文章编辑器弹窗 -->
      <a-modal
        v-model:open="showArticleEditor"
        :title="editingArticle ? '编辑文章' : '新建文章'"
        width="90%"
        :footer="null"
        :destroy-on-close="true"
      >
        <div class="editor-container">
          <a-form layout="vertical" :model="articleForm">
            <a-row :gutter="24">
              <a-col :xs="24" :lg="17">
                <a-form-item label="文章标题" required>
                  <a-input v-model:value="articleForm.title" placeholder="请输入文章标题" size="large" />
                </a-form-item>
                <a-form-item label="副标题">
                  <a-input v-model:value="articleForm.subtitle" placeholder="请输入副标题" />
                </a-form-item>
                <a-form-item label="文章摘要">
                  <a-textarea v-model:value="articleForm.summary" :rows="3" placeholder="请输入文章摘要" show-count :maxlength="200" />
                </a-form-item>
                <a-form-item label="文章内容">
                  <div class="editor-wrapper">
                    <textarea
                      v-model="articleForm.content"
                      placeholder="在这里编写文章内容，支持富文本编辑..."
                      class="simple-editor"
                    />
                  </div>
                </a-form-item>
              </a-col>
              <a-col :xs="24" :lg="7">
                <a-form-item label="所属栏目" required>
                  <a-tree-select
                    v-model:value="articleForm.categoryId"
                    :tree-data="categoryTreeData"
                    placeholder="选择栏目"
                    style="width: 100%"
                    :tree-default-expand-all="true"
                  />
                </a-form-item>
                <a-form-item label="封面图片">
                  <a-upload list-type="picture-card" :max-count="1">
                    <PlusOutlined />
                    <div style="margin-top: 8px">上传</div>
                  </a-upload>
                </a-form-item>
                <a-form-item label="文章标签">
                  <a-select v-model:value="articleForm.tags" mode="tags" style="width: 100%" placeholder="输入标签回车添加">
                    <a-select-option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item label="作者">
                  <a-select v-model:value="articleForm.authorId" style="width: 100%" placeholder="选择作者">
                    <a-select-option v-for="a in authors" :key="a.id" :value="a.id">{{ a.name }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-row :gutter="12">
                  <a-col :span="12">
                    <a-form-item label="置顶">
                      <a-switch v-model:checked="articleForm.isTop" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="推荐">
                      <a-switch v-model:checked="articleForm.isRecommend" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-col>
            </a-row>
          </a-form>
          <div class="editor-actions">
            <a-space>
              <a-button @click="saveDraft">
                <template #icon><SaveOutlined /></template>
                保存草稿
              </a-button>
              <a-button type="primary" @click="submitReview">
                <template #icon><AuditOutlined /></template>
                提交审核
              </a-button>
            </a-space>
          </div>
        </div>
      </a-modal>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, h, watch } from 'vue'
import { message, Modal, Empty, Form as AForm, FormItem as AFormItem, TreeSelect as ATreeSelect, Select as ASelect, Space as ASpace, Button as AButton } from 'ant-design-vue'
import { marked } from 'marked'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  PlusCircleOutlined,
  CalendarOutlined,
  FireOutlined,
  ArrowUpOutlined,
  FilterOutlined,
  DownOutlined,
  UpOutlined,
  SaveOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  PictureOutlined,
  SendOutlined,
  SwapOutlined,
  TagsOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
  LikeOutlined,
  MessageOutlined,
  CopyOutlined,
  MoreOutlined,
  CloudDownloadOutlined,
  VerticalAlignTopOutlined,
  StarOutlined,
  PlusOutlined,
  RightOutlined,
  AuditOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons-vue'
import { adminApi, articleManageApi, categoryApi } from '../../api'
import { formatTime, formatDate } from '../../utils/format'
import DemoFlag from '../../components/DemoFlag.vue'
import { articleStatusMeta as statusMeta } from '../../utils/contentStatus'
import { describeHttpError } from '../../api/http'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()

const loading = ref(false)
const showArticleEditor = ref(false)
const showArticlePreview = ref(false)
const editingArticle = ref<any>(null)
const previewArticle = ref<any>(null)
const previewHtml = ref('')
const viewMode = ref<'list' | 'card' | 'thumbnail'>('list')
const showAdvancedFilter = ref(false)
const searchType = ref('all')

const stats = reactive({
  totalArticles: 0,
  todayCount: 0,
  weekCount: 0,
  monthPublished: 0,
  yearPublished: 0,
  topViews: 0,
  viewsSum: 0,
})

const filterForm = reactive({
  categoryId: undefined as number | undefined,
  status: '',
  authorId: undefined as number | undefined,
  dateRange: [] as any[],
  tags: [] as string[],
  keyword: '',
})

/** 快速标签的口径 = 后端状态词表原值，不再把 approved/scheduled 混进「已发布」虚增数量 */
const statusCounts = computed(() => {
  const counts: Record<string, number> = {
    draft: 0,
    pending_review: 0,
    published: 0,
    offline: 0,
    rejected: 0,
  }
  for (const article of articles.value) {
    const s = String(article.status ?? '').toLowerCase()
    if (s in counts) counts[s] += 1
  }
  return counts
})

const articles = ref<any[]>([])
const categories = ref<any[]>([])
const authors = ref<any[]>([])
const allTags = ref<string[]>([])

const selectedRowKeys = ref<number[]>([])
const selectedRows = ref<any[]>([])

const publishScheduledEnabled = ref(false)
const publishScheduledTime = ref<any>(null)

const articleForm = reactive({
  id: null as number | null,
  title: '',
  subtitle: '',
  summary: '',
  content: '',
  categoryId: undefined as number | undefined,
  coverImage: '',
  tags: [] as string[],
  authorId: undefined as number | undefined,
  isTop: false,
  isRecommend: false,
})

const recentEdits = ref<any[]>([])

const draftCount = computed(() => articles.value.filter(a => a.status?.toLowerCase() === 'draft').length)
const reviewCount = computed(() => articles.value.filter(a => a.status?.toLowerCase() === 'pending_review').length)

/** 创建时间戳，无 createdAt 时退到 updatedAt，都没有则返回 0（时间筛选会把它排除） */
function createdTimeOf(item: any): number {
  const raw = item?.createdAt || item?.updatedAt
  return raw ? new Date(raw).getTime() : 0
}

const filteredArticles = computed(() => {
  let list = [...articles.value]

  if (filterForm.categoryId) {
    list = list.filter(item => item.categoryId === filterForm.categoryId)
  }
  if (filterForm.status) {
    list = list.filter(item => item.status?.toLowerCase() === filterForm.status)
  }
  if (filterForm.authorId) {
    list = list.filter(item => item.authorId === filterForm.authorId)
  }
  // 时间范围按创建时间比较：后端列表接口不支持时间参数，只能在本页已加载的数据里筛
  const range = filterForm.dateRange
  if (range && range.length === 2 && range[0] && range[1]) {
    const from = new Date(String(range[0])).getTime()
    const endDay = new Date(String(range[1]))
    endDay.setHours(23, 59, 59, 999)
    const to = endDay.getTime()
    if (!Number.isNaN(from) && !Number.isNaN(to)) {
      list = list.filter(item => {
        const t = createdTimeOf(item)
        return t >= from && t <= to
      })
    }
  }
  if (filterForm.tags?.length) {
    list = list.filter(item => item.tags?.some((t: string) => filterForm.tags.includes(t)))
  }
  if (filterForm.keyword) {
    const kw = filterForm.keyword.toLowerCase()
    list = list.filter(item => {
      if (searchType.value === 'title') {
        return item.title?.toLowerCase().includes(kw)
      } else if (searchType.value === 'content') {
        return item.content?.toLowerCase().includes(kw)
      } else {
        return item.title?.toLowerCase().includes(kw) || item.content?.toLowerCase().includes(kw)
      }
    })
  }

  return list
})

/** 分页必须是有状态的：原来 current 写死在 computed 里、@change 是空函数，第 2 页永远点不动 */
const tableCurrentPage = ref(1)
const tablePageSize = ref(20)

const tablePagination = computed(() => ({
  current: tableCurrentPage.value,
  pageSize: tablePageSize.value,
  total: filteredArticles.value.length,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 篇文章`,
}))

// 筛选条件变了就回到第 1 页，否则可能停在一个已经空的页码上
watch(
  () => [filterForm.categoryId, filterForm.status, filterForm.authorId, filterForm.tags, filterForm.keyword, filterForm.dateRange, searchType.value],
  () => {
    tableCurrentPage.value = 1
  },
)

const categoryTreeData = computed(() => buildTree(categories.value, null))

/** 列表和详情接口都会带 categoryName；本页栏目表只用来兜住极少数只回 categoryId 的记录 */
const categoryNames = computed(() => new Map(categories.value.map((c: any) => [c.id, c.name])))

/** 返回空串表示真的没有栏目，界面显示 '-'，不能编一个「未分类」冒充接口数据 */
function categoryNameOf(record: any) {
  if (record?.categoryName) return record.categoryName
  return categoryNames.value.get(record?.categoryId) || ''
}

const tableColumns = [
  { title: '标题', dataIndex: 'title', key: 'title', width: 280, ellipsis: true },
  { title: '栏目', dataIndex: 'categoryName', key: 'category', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '作者', dataIndex: 'authorName', key: 'authorName', width: 90, ellipsis: true },
  { title: '浏览量', dataIndex: 'viewCount', key: 'views', width: 90 },
  { title: '发布时间', dataIndex: 'publishedAt', key: 'publishTime', width: 160 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' as const },
]

function buildTree(list: any[], parentId: number | null): any[] {
  return list
    .filter(item => item.parentId === parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(item => ({
      title: item.name,
      value: item.id,
      children: buildTree(list, item.id),
    }))
}

function getStatusIcon(status?: string) {
  switch (status?.toLowerCase()) {
    case 'published':
    case 'approved': return CheckCircleOutlined
    case 'pending_review': return AuditOutlined
    case 'scheduled': return CalendarOutlined
    case 'draft': return FileTextOutlined
    case 'offline': return CloudDownloadOutlined
    case 'rejected': return CloseCircleOutlined
    default: return FileTextOutlined
  }
}

function changeViewMode() {
}

function setQuickStatus(status: string) {
  filterForm.status = status
}

function resetFilter() {
  filterForm.categoryId = undefined
  filterForm.status = ''
  filterForm.authorId = undefined
  filterForm.dateRange = []
  filterForm.tags = []
  filterForm.keyword = ''
  searchType.value = 'all'
  message.success('已重置筛选条件')
}

function onSelectChange(keys: number[], rows: any[]) {
  selectedRowKeys.value = keys
  selectedRows.value = rows
}

function toggleSelect(article: any, checked: boolean) {
  if (checked) {
    selectedRowKeys.value = [...selectedRowKeys.value, article.id]
    selectedRows.value = [...selectedRows.value, article]
  } else {
    selectedRowKeys.value = selectedRowKeys.value.filter(k => k !== article.id)
    selectedRows.value = selectedRows.value.filter(r => r.id !== article.id)
  }
}

function clearSelection() {
  selectedRowKeys.value = []
  selectedRows.value = []
}

function handleTableChange(pagination: any) {
  tableCurrentPage.value = pagination?.current ?? 1
  if (pagination?.pageSize) tablePageSize.value = pagination.pageSize
}

function viewArticle(article: any) {
  previewArticle.value = article
  let content = article.contentMd || article.content || ''
  content = content.replace(/\\n/g, '\n')
  content = content.replace(/\\r/g, '\r')
  content = content.replace(/\\\\/g, '\\')
  previewHtml.value = marked(content) as string
  showArticlePreview.value = true
}

async function editArticle(article: any) {
  loading.value = true
  try {
    const detail = await articleManageApi.get(article.id)
    editingArticle.value = detail
    Object.assign(articleForm, {
      id: detail.id,
      title: detail.title,
      subtitle: detail.subtitle || '',
      summary: detail.summary || '',
      content: detail.contentMd || detail.content || '',
      categoryId: detail.categoryId,
      coverImage: detail.coverImage || '',
      tags: detail.tags || [],
      authorId: detail.authorId,
      isTop: !!detail.isTop,
      isRecommend: !!detail.isRecommend,
    })
    showArticleEditor.value = true
  } catch (error) {
    message.error('加载文章详情失败')
  } finally {
    loading.value = false
  }
}

function copyArticle(article: any) {
  Modal.confirm({
    title: '确认复制',
    content: `确定要复制文章"${article.title}"吗？`,
    onOk: async () => {
      try {
        const { id, ...rest } = article
        await articleManageApi.create({
          ...rest,
          title: `${article.title} (副本)`,
          status: 'draft'
        } as any)
        message.success('复制成功')
        loadData()
      } catch (e) {
        message.error(`复制失败：${describeHttpError(e)}`)
      }
    },
  })
}

async function publishArticle(article: any) {
  publishScheduledEnabled.value = false
  publishScheduledTime.value = null
  Modal.confirm({
    title: '发布文章',
    content: () => h('div', { style: { marginBottom: '16px' } }, [
      h('div', { style: { marginBottom: '8px' } }, `确定要发布文章"${article.title}"吗？`),
      h('a-switch', {
        checked: publishScheduledEnabled.value,
        'onUpdate:checked': (checked: boolean) => {
          publishScheduledEnabled.value = checked
        },
        'checked-children': '定时发布',
        'un-checked-children': '立即发布',
      }),
      publishScheduledEnabled.value ? h('a-date-picker', {
        style: { width: '100%', marginTop: '12px' },
        showTime: true,
        format: 'YYYY-MM-DD HH:mm',
        valueFormat: 'YYYY-MM-DDTHH:mm:ss',
        placeholder: '选择发布时间',
        value: publishScheduledTime.value,
        'onUpdate:value': (date: any) => {
          publishScheduledTime.value = date
        }
      }) : null
    ]),
    onOk: async () => {
      const scheduledTime = publishScheduledEnabled.value ? publishScheduledTime.value : null
      if (publishScheduledEnabled.value && !scheduledTime) {
        message.warning('请选择发布时间')
        return Promise.reject()
      }
      try {
        const result: any = await articleManageApi.publish(article.id, scheduledTime ? { scheduledTime } : undefined)
        // 后端按时间是否晚于当前决定入队还是立即发布，提示以返回结果为准
        if (result?.queueId) {
          message.success(`已加入队列，计划 ${formatTime(result.scheduledAt)} 发布`)
          article.status = 'scheduled'
        } else {
          message.success('发布成功')
          article.status = 'published'
        }
        publishScheduledEnabled.value = false
        publishScheduledTime.value = null
        loadData()
      } catch (e) {
        message.error(`发布失败：${describeHttpError(e)}`)
      }
    },
  })
}

async function offlineArticle(article: any) {
  Modal.confirm({
    title: '确认下架',
    content: `确定要下架文章"${article.title}"吗？下架后门户不再展示，重新发布需要先回到审核流程。`,
    onOk: async () => {
      try {
        await articleManageApi.unpublish(article.id)
        message.success('已撤回发布')
        loadData()
      } catch (e) {
        message.error(`撤回失败：${describeHttpError(e)}`)
      }
    },
  })
}

function setTop(article: any) {
  articleManageApi.update(article.id, { isTop: !article.isTop } as any).then(() => {
    message.success(!article.isTop ? '已设置置顶' : '已取消置顶')
    article.isTop = !article.isTop
  }).catch(() => message.error('操作失败'))
}

function setRecommend(article: any) {
  articleManageApi.update(article.id, { isRecommend: !article.isRecommend } as any).then(() => {
    message.success(!article.isRecommend ? '已设置推荐' : '已取消推荐')
    article.isRecommend = !article.isRecommend
  }).catch(() => message.error('操作失败'))
}

function deleteArticle(article: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除文章"${article.title}"吗？删除后无法恢复。`,
    okType: 'danger',
    onOk: async () => {
      try {
        await articleManageApi.delete(article.id)
        message.success('删除成功')
        loadData()
      } catch (e) {
        message.error(`删除失败：${describeHttpError(e)}`)
      }
    },
  })
}

function batchPublish() {
  Modal.confirm({
    title: '确认批量发布',
    content: `确定要发布选中的 ${selectedRowKeys.value.length} 篇文章吗？`,
    onOk: async () => {
      try {
        for (const id of selectedRowKeys.value) {
          await articleManageApi.publish(id)
        }
        message.success(`批量发布 ${selectedRowKeys.value.length} 篇文章成功`)
        selectedRowKeys.value = []
        selectedRows.value = []
        loadData()
      } catch (e) {
        message.error(`批量发布失败：${describeHttpError(e)}`)
      }
    },
  })
}

function batchMove() {
  Modal.confirm({
    title: '批量移动栏目',
    content: `确定要将选中的 ${selectedRowKeys.value.length} 篇文章移动到指定栏目吗？`,
    okText: '选择栏目',
    onOk: () => {
      Modal.info({
        title: '批量移动',
        content: () => {
          const targetCategoryId = ref<number | null>(null)
          return h('div', null, [
            h(AForm, null, {
              default: () => h(AFormItem, { label: '目标栏目' }, {
                default: () => h(ATreeSelect, {
                  'v-model:value': targetCategoryId,
                  'tree-data': categoryTreeData.value,
                  placeholder: '请选择栏目',
                  style: { width: '100%' },
                  'tree-default-expand-all': true,
                })
              })
            }),
            h(ASpace, { style: { marginTop: '16px', float: 'right' } }, [
              h(AButton, { onClick: () => Modal.destroyAll() }, '取消'),
              h(AButton, { type: 'primary', onClick: async () => {
                if (!targetCategoryId.value) {
                  message.error('请选择目标栏目')
                  return
                }
                try {
                  for (const id of selectedRowKeys.value) {
                    await articleManageApi.update(id, { categoryId: targetCategoryId.value } as any)
                  }
                  message.success(`批量移动 ${selectedRowKeys.value.length} 篇文章成功`)
                  selectedRowKeys.value = []
                  selectedRows.value = []
                  loadData()
                  Modal.destroyAll()
                } catch (e) {
                  message.error(`批量移动失败：${describeHttpError(e)}`)
                }
              }}, '确定移动')
            ])
          ])
        },
        footer: null,
      })
    },
  })
}

function batchSetTags() {
  Modal.confirm({
    title: '批量设置标签',
    content: `确定要为选中的 ${selectedRowKeys.value.length} 篇文章设置标签吗？`,
    okText: '设置标签',
    onOk: () => {
      Modal.info({
        title: '批量设置标签',
        content: () => {
          const newTags = ref<string[]>([])
          return h('div', null, [
            h(AForm, null, {
              default: () => h(AFormItem, { label: '标签' }, {
                default: () => h(ASelect, {
                  'v-model:value': newTags,
                  mode: 'tags',
                  placeholder: '输入标签回车添加',
                  style: { width: '100%' },
                })
              })
            }),
            h(ASpace, { style: { marginTop: '16px', float: 'right' } }, [
              h(AButton, { onClick: () => Modal.destroyAll() }, '取消'),
              h(AButton, { type: 'primary', onClick: async () => {
                if (!newTags.value.length) {
                  message.error('请至少添加一个标签')
                  return
                }
                try {
                  for (const id of selectedRowKeys.value) {
                    await articleManageApi.update(id, { tags: newTags.value } as any)
                  }
                  message.success(`批量设置标签成功`)
                  selectedRowKeys.value = []
                  selectedRows.value = []
                  loadData()
                  Modal.destroyAll()
                } catch (e) {
                  message.error(`批量设置标签失败：${describeHttpError(e)}`)
                }
              }}, '确定设置')
            ])
          ])
        },
        footer: null,
      })
    },
  })
}

function batchDelete() {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 篇文章吗？删除后无法恢复。`,
    okType: 'danger',
    onOk: async () => {
      try {
        await articleManageApi.batchDelete(selectedRowKeys.value)
        message.success('批量删除成功')
        selectedRowKeys.value = []
        selectedRows.value = []
        loadData()
      } catch (e) {
        message.error(`批量删除失败：${describeHttpError(e)}`)
      }
    },
  })
}

async function saveDraft() {
  try {
    const payload = { ...articleForm, status: 'draft' }
    if (articleForm.id) {
      await articleManageApi.update(articleForm.id, payload as any)
    } else {
      await articleManageApi.create(payload as any)
    }
    message.success('草稿已保存')
    showArticleEditor.value = false
    loadData()
  } catch (e) {
    message.error(`保存失败：${describeHttpError(e)}`)
  }
}

async function submitReview() {
  try {
    const payload = { ...articleForm, status: 'pending_review' }
    if (articleForm.id) {
      await articleManageApi.update(articleForm.id, payload as any)
    } else {
      await articleManageApi.create(payload as any)
    }
    message.success('已提交审核')
    showArticleEditor.value = false
    loadData()
  } catch (e) {
    message.error(`提交失败：${describeHttpError(e)}`)
  }
}

/** 快捷入口只是切换状态筛选（列表是响应式的），没有跳转动作，所以不再 toast */
function goToDrafts() {
  filterForm.status = 'draft'
}

function goToReview() {
  filterForm.status = 'pending_review'
}

async function loadData() {
  loading.value = true
  try {
    const [articlesData, categoriesData, authorsData] = await Promise.all([
      articleManageApi.list({ page: 1, size: 100 } as any),
      categoryApi.list({ all: true }) as any,
      adminApi.users.list({}).catch(() => []),
    ])

    const articleList = (articlesData as any)?.records || (articlesData as any) || []
    const categoryList = categoriesData?.records || categoriesData || []
    const authorList = (authorsData as any)?.records || (authorsData as any) || []

    articles.value = articleList
    categories.value = categoryList
    authors.value = authorList.map((u: any) => ({
      id: u.id,
      name: u.nickname || u.username || u.name,
    }))

    const tagSet = new Set<string>()
    articleList.forEach((a: any) => {
      if (a.tags && Array.isArray(a.tags)) {
        a.tags.forEach((t: string) => tagSet.add(t))
      }
      if (a.keywords) {
        String(a.keywords).split(/[,，]/).filter(Boolean).forEach((k: string) => tagSet.add(k.trim()))
      }
    })
    allTags.value = Array.from(tagSet)

    recentEdits.value = [...articleList]
      .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 5)

    // 总数取接口返回的 total，不能拿当前页条数冒充；
    // 「发布」口径按 publishedAt，创建口径按 createdAt
    stats.totalArticles = (articlesData as any)?.total ?? articleList.length
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfWeek = startOfToday - 6 * 24 * 3600 * 1000
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime()
    const created = (a: any) => new Date(a.createdAt || 0).getTime()
    const published = (a: any) => (a.publishedAt ? new Date(a.publishedAt).getTime() : 0)
    const inMonth = (t: number) => {
      if (!t) return false
      const d = new Date(t)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }
    stats.todayCount = articleList.filter((a: any) => created(a) >= startOfToday).length
    stats.weekCount = articleList.filter((a: any) => created(a) >= startOfWeek).length
    stats.monthPublished = articleList.filter((a: any) => inMonth(published(a))).length
    stats.yearPublished = articleList.filter((a: any) => {
      const t = published(a)
      return t >= startOfYear
    }).length
    stats.viewsSum = articleList.reduce((n: number, a: any) => n + (a.viewCount || 0), 0)
    const topArticle = articleList.reduce((max: any, a: any) => (a.viewCount || 0) > (max?.viewCount || 0) ? a : max, null)
    stats.topViews = topArticle?.viewCount || 0
  } catch (error) {
    message.error('数据加载失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

watch(
  () => auth.selectedTenantId,
  () => {
    loadData()
  }
)

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.articles-panel-page {
  width: 100%;
  padding: 8px 0;
}

.card-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;

  .title-icon {
    margin-right: 8px;
    color: #1890ff;
  }
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 12px;
  overflow: hidden;

  :deep(.ant-card-body) {
    padding: 20px;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &.stat-card-blue {
    .stat-icon {
      background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
    }
  }

  &.stat-card-purple {
    .stat-icon {
      background: linear-gradient(135deg, #722ed1 0%, #b37feb 100%);
    }
  }

  &.stat-card-green {
    .stat-icon {
      background: linear-gradient(135deg, #52c41a 0%, #95de64 100%);
    }
  }

  &.stat-card-orange {
    .stat-icon {
      background: linear-gradient(135deg, #fa8c16 0%, #ffec3d 100%);
    }
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
}

.stat-title {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 4px;
}

.stat-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.stat-trend {
  font-size: 12px;
  font-weight: 500;

  &.up {
    color: #52c41a;
  }

  &.down {
    color: #ff4d4f;
  }
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
}

.main-card {
  border-radius: 12px;

  :deep(.ant-card-body) {
    padding: 20px;
  }
}

.filter-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filter-title {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;

  .title-icon {
    margin-right: 8px;
    color: #1890ff;
  }
}

.search-row {
  margin-bottom: 16px;
}

.advanced-filter {
  padding-top: 16px;
  border-top: 1px dashed #e8e8e8;
}

.view-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.view-info {
  .view-count {
    font-size: 14px;
    color: #595959;

    strong {
      color: #1890ff;
      font-size: 16px;
    }
  }
}

.batch-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #1890ff;
    font-size: 14px;

    strong {
      font-size: 16px;
    }
  }
}

.view-content {
  min-height: 400px;
}

.article-table {
  :deep(.ant-table) {
    border-radius: 8px;
    overflow: hidden;
  }
}

.article-title-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.article-thumb {
  width: 56px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-thumb {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    font-size: 20px;
    color: #d9d9d9;
  }
}

.article-title-info {
  flex: 1;
  min-width: 0;

  .title {
    font-weight: 500;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle {
    font-size: 12px;
    color: #8c8c8c;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.views-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #595959;
}

.category-missing {
  color: #bfbfbf;
}

.card-view {
  .article-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s;

    :deep(.ant-card-body) {
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
  }

  .card-cover {
    position: relative;
    height: 160px;
    overflow: hidden;
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }

    &:hover img {
      transform: scale(1.05);
    }

    .default-cover {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
      font-size: 48px;
      color: #bfbfbf;
    }

    .card-status {
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .card-badge {
      position: absolute;
      top: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      color: #fff;

      &.top {
        left: 12px;
        background: #ff4d4f;
      }

      &.recommend {
        left: 60px;
        background: #fa8c16;
      }
    }
  }

  .card-content {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;

    .card-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      color: #1a1a1a;

      &:hover {
        color: #1890ff;
      }
    }

    .card-summary {
      font-size: 13px;
      color: #8c8c8c;
      margin-bottom: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.5;
    }

    .card-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #8c8c8c;
      margin-bottom: 8px;
    }

    .card-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #8c8c8c;
      margin-bottom: 8px;
    }

    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }

  .card-actions {
    padding: 12px 16px;
    border-top: 1px solid #f0f0f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.thumbnail-view {
  .thumbnail-card {
    border-radius: 8px;
    overflow: hidden;

    :deep(.ant-card-body) {
      padding: 0;
    }

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }

  .thumbnail-cover {
    position: relative;
    height: 120px;
    overflow: hidden;
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-thumbnail {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      font-size: 32px;
      color: #d9d9d9;
    }

    .thumbnail-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
    }
  }

  .thumbnail-info {
    padding: 8px 12px;
  }

  .thumbnail-title {
    font-size: 13px;
    font-weight: 500;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 4px;
  }

  .thumbnail-meta {
    font-size: 12px;
    color: #8c8c8c;
  }

  .thumbnail-actions {
    padding: 8px 12px;
    border-top: 1px solid #f0f0f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-btn {
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 10px;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  border: none;

  &:hover {
    background: linear-gradient(135deg, #40a9ff 0%, #5cdbd3 100%);
  }
}

.sidebar-card {
  border-radius: 12px;

  :deep(.ant-card-head) {
    border-bottom: 1px solid #f0f0f0;
    min-height: 48px;
  }

  :deep(.ant-card-head-title) {
    padding: 12px 0;
  }
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.quick-entries {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: #f5f5f5;
  }

  .entry-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #fff;
    flex-shrink: 0;

    &.draft {
      background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
    }

    &.review {
      background: linear-gradient(135deg, #fa8c16 0%, #ffc53d 100%);
    }
  }

  .entry-info {
    flex: 1;
    min-width: 0;
  }

  .entry-name {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 2px;
  }

  .entry-count {
    font-size: 12px;
    color: #8c8c8c;
  }

  .entry-arrow {
    color: #bfbfbf;
    font-size: 12px;
  }
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recent-item {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: #f5f5f5;
  }
}

.recent-thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .recent-thumb-default {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f0f0;
    font-size: 16px;
    color: #bfbfbf;
  }
}

.recent-info {
  flex: 1;
  min-width: 0;
}

.recent-title {
  font-size: 13px;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.recent-time {
  font-size: 12px;
  color: #8c8c8c;
}

.editor-container {
  padding: 8px;
}

.preview-content {
  line-height: 1.8;
  font-size: 14px;
  color: #333;

  :deep(h1), :deep(h2), :deep(h3) {
    margin-top: 16px;
    margin-bottom: 8px;
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(p) {
    margin-bottom: 12px;
  }
}

.editor-wrapper {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 12px;
  min-height: 300px;
  background: #fafafa;

  .simple-editor {
    width: 100%;
    min-height: 280px;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    font-size: 14px;
    line-height: 1.8;
  }
}

.editor-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

@media (max-width: 1200px) {
  .filter-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .articles-panel-page {
    padding: 4px 0;
  }

  .view-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .batch-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
}
</style>
