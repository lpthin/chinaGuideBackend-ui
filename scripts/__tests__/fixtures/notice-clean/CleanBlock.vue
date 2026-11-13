<template>
  <div>
    <!-- 自测夹具：以下三类都属「不算违规」，闸门必须放过 -->
    <p class="demo-page__intro">{{ dynamicLine }}</p>

    <p v-if="flag" class="demo-page__intro">条件渲染的提示不算首屏常驻说明。</p>

    <a-card>
      <p class="demo-page__lead">卡片里的说明贴着内容讲，不算首屏大色块。</p>
    </a-card>

    <RecordListPage description="列表三态示例" />
  </div>
</template>
