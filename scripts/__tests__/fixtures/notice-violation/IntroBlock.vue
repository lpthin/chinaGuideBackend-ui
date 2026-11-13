<template>
  <div>
    <!-- 自测夹具：这段应被闸门抓住（静态、非容器、超过 20 个汉字） -->
    <p class="demo-page__intro">
      这是一段首屏常驻的说明文字，用来证明闸门会抓住页面级说明段落，而不是只抓提示条。
    </p>

    <RecordListPage
      description="这是一段写在页头 description 上的静态说明，超过二十个汉字，同样应该被抓到。"
    />
  </div>
</template>
