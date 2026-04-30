<template>
  <div>
    <div class="page-header">
      <div>
        <h2>仪表盘</h2>
        <p>China Guide 内容生产闭环概览</p>
      </div>
    </div>
    <el-row :gutter="16" class="metrics">
      <el-col :span="6"><el-card><div class="metric"><span>关键词</span><b>--</b></div></el-card></el-col>
      <el-col :span="6"><el-card><div class="metric"><span>聚类</span><b>--</b></div></el-card></el-col>
      <el-col :span="6"><el-card><div class="metric"><span>待审核</span><b>--</b></div></el-card></el-col>
      <el-col :span="6"><el-card><div class="metric"><span>可发布</span><b>--</b></div></el-card></el-col>
    </el-row>
    <el-card class="flow-card">
      <template #header>Phase 1 内容流程</template>
      <el-steps :active="1" finish-status="success">
        <el-step title="导入关键词" description="录入旅游主题关键词" />
        <el-step title="AI 蒸馏" description="生成关键词聚类" />
        <el-step title="生成草稿" description="创建中文文章" />
        <el-step title="审核发布" description="人工审核后 dry-run / 发布" />
      </el-steps>
    </el-card>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0 0 6px;
}
.page-header p {
  margin: 0;
  color: #64748b;
}
.metrics {
  margin-bottom: 16px;
}
.metric {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.metric span {
  color: #64748b;
}
.metric b {
  font-size: 28px;
  color: #1d4ed8;
}
.flow-card {
  margin-top: 16px;
}
</style>
