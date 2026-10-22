<template>
  <div class="portal-shell">
    <!--
      页头页脚用的是区块页那一族的组件本体，不是照它再写一份。理由很硬：
      同一套站的任何一页，访客看到的导航必须是同一条列表、同一个站点标志——
      这一族详情页过去自带一套 `<nav>` 并把 nav 截成 6 条（`.slice(0, 6)`），
      首页 8 条、详情页 6 条就是当场摆出来的那条不一致（611 那套站实测到的）。
      「导航只有一份真相」只有当渲染出口也唯一时才成立，所以这里连类名（pb-header / pb-footer）
      与取数次序（blockProps 槽位优先、其次壳）都跟着区块页走，不再各留一套。
    -->
    <SiteHeaderBlock :block-props="EMPTY_BLOCK_PROPS" :shell="shell" />

    <main class="portal-shell__main">
      <slot :shell="shell" />
    </main>

    <SiteFooterBlock :block-props="EMPTY_BLOCK_PROPS" :shell="shell" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SiteHeaderBlock from './blocks/SiteHeaderBlock.vue'
import SiteFooterBlock from './blocks/SiteFooterBlock.vue'
import type { BlockProps } from './blocks/types'
import { fetchSiteShell, type PortalSiteShell } from './api/portalPublic'
// 区块的排版类（.pb-container 这类）与运行时变量必须全局生效：入口与 PortalDynamicPage.vue 是同一条，
// 而这一族详情页按路由懒加载，不保证同一个 chunk 里已经有人导入过那两份表
import '@/styles/portal-preview.less'

/**
 * 详情页共用的门户壳：页头页脚只放后端真的有的信息。
 *
 * 访客从搜索结果直链进来时（不经过首页），这一份壳就是他对这套站的第一屏，
 * 所以它必须和区块页渲染出的页头页脚是同一个东西——复用组件而不是复制逻辑，
 * 是为了下次改导航形状时只有一个地方要改。
 *
 * 槽位传的是模块级那一个空对象（不是模板里的字面量）：这一族页面没有区块配置可读，
 * 空槽位即「什么都不覆盖」，页头取壳里的站点标志、页脚退回壳里的导航，
 * 两头的链接列表因此天然同源——不需要在这里再写一遍取数分支。
 */
const EMPTY_BLOCK_PROPS: BlockProps = {}

const shell = ref<PortalSiteShell | null>(null)

onMounted(async () => {
  try {
    shell.value = await fetchSiteShell()
  } catch {
    // 壳取不到时导航就是一条都不渲（组件读的就是 shell.nav），正文照常渲染：
    // 那种状态下访客看到的是「这一站没报出导航」，而不是前端自己补的一份假链接
  }
})
</script>

<style scoped lang="less">
.portal-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
  /* 这一族详情页目前没有主题来源（公开壳接口不回 theme），所以这里只会取到 portal-tokens.less 的默认栈；
     但栈不再抄第二份，站点主题接进壳的时候不用再改这里 */
  font-family: var(--portal-font-body);

  /**
   * 这一行是把详情页接进「区块的断点体系」里：pb-header 的窄屏折叠（导航收起来、露出汉堡）
   * 写的容器查询是 `@container portal-viewport (max-width: 900px)`，基准是容器宽度而不是浏览器窗口，
   * 而那个容器在访客侧由 PortalViewportPreview 的 .pbv__frame 声明（区块页那条路）。
   * 这一族页不走那个渲染框，所以容器声明补在壳的根上：不补的话这里挂了同一个页头组件，
   * 整条导航却永远不会折叠——共享了代码、没共享观感，等于把缺陷换了个形状。
   * 仓库里 src/portal 下只有 ReviewToolbar 与 PortalDynamicPage 那两处用 position: fixed，
   * 都不在这份壳的子树里，所以容器声明带来的「含定位后代」副作用不会碰到这一族页面。
   */
  container-type: inline-size;
  container-name: portal-viewport;

  /* 正文列宽是阅读宽度（文章正文按 960 排版），与页头页脚的栅格宽度是两件事：
     那两个类（.pb-container）取的是 --portal-section-max-width，跟着站点主题走，
     这里不跟——把正文也拉到 1200 只是让一行字排满整屏，读起来更差 */
  &__main {
    flex: 1;
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 24px 56px;
  }
}
</style>
