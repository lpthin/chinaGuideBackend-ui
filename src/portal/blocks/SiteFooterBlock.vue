<template>
  <footer class="pb-footer">
    <div class="pb-container">
      <nav v-if="links.length" class="pb-footer__links">
        <PortalBlockLink v-for="(link, index) in links" :key="index" :url="link.url">{{ link.title }}</PortalBlockLink>
      </nav>
      <div v-if="contactLine.length" class="pb-footer__contact">
        <a v-if="company?.phone" :href="'tel:' + company.phone">{{ company.phone }}</a>
        <a v-if="company?.email" :href="'mailto:' + company.email">{{ company.email }}</a>
        <span v-if="company?.address">{{ company.address }}</span>
      </div>
      <p v-if="copyright" class="pb-footer__copy">{{ copyright }}</p>
      <!-- 备案号是法定展示项，单独一个元素：它不属于版权句，拼在一起会让人以为版权行没渲染就是没备案 -->
      <p v-if="icpNumber" class="pb-footer__icp">{{ icpNumber }}</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlockContext } from './types'
import { field, list, text } from './types'
import PortalBlockLink from './PortalBlockLink.vue'

/**
 * 页脚。
 *
 * 链接优先用区块绑定的 footerLinks，没绑定就退回站点导航（同一个 portal_page 真相源）；
 * 版权行与备案号行都只在后端真给了才显示，不用 © 2024 之类的写死年份，也不摆「暂无备案号」。
 *
 * <p>两行的取数次序各说一次，因为它们是两件不同的事：</p>
 * <ul>
 *   <li>版权句：区块槽位上那条字面/绑定的 `copyright` 优先，其次才是壳里那份。
 *       「租户填的文案赢过机械拼法」这半条在后端就做完了（V132 起 `PortalAggregationService`
 *       把 `copyright_text` 折进 `companyInfo.copyright` 那一格，空了才回退「© 年份 + 公司名」），
 *       浏览器从来收到的就不是一个叫 `copyrightText` 的字段——这里要是再判一次，就是第二份真相；</li>
 *   <li>备案号（D0 第 4 项）：后端那份真源是 `companyInfo.icpNumber`，区块经
 *       `{"$data":"companyInfo.icpNumber"}` 由服务端解析成槽位值，所以这边读的是解析后的 props；
 *       壳（`PortalContentDTO.CompanyBrief`）哪天带上同一格，也走这一条链路自动生效。
 *       两处都没有就是没有：一个节点都不留。</li>
 * </ul>
 */
const props = defineProps<BlockContext>()

const company = computed(() => props.shell?.company ?? null)
const copyright = computed(() => text(props.blockProps, 'copyright') || company.value?.copyright || '')
const icpNumber = computed(() => text(props.blockProps, 'icpNumber') || (company.value?.icpNumber || '').trim())

const links = computed(() => {
  const bound = list(props.blockProps, 'links')
    .map(item => ({ title: field(item, 'title', 'name'), url: field(item, 'url', 'link') }))
    .filter(link => link.title && link.url)
  if (bound.length) {
    return bound
  }
  return (props.shell?.nav ?? []).map(item => ({ title: item.title, url: item.url }))
})

const contactLine = computed(() => {
  const value = company.value
  return [value?.phone, value?.email, value?.address].filter(Boolean)
})
</script>

<style scoped lang="less">
.pb-footer {
  padding: calc(40px * var(--portal-spacing-scale)) 0;
  background: #1f2937;
  color: #9ca3af;
  font-size: calc(13px * var(--portal-font-scale));

  &__links {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 18px;

    a {
      color: #cbd5e1;
      text-decoration: none;

      &:hover {
        color: #fff;
      }
    }
  }

  &__contact {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-bottom: 18px;

    a {
      color: #cbd5e1;
      text-decoration: none;
    }
  }

  &__copy {
    margin: 0;
  }

  // 备案号紧跟版权行，字号压一档：它是法定展示项，但不是这一屏的主角
  &__icp {
    margin: 6px 0 0;
    font-size: calc(12px * var(--portal-font-scale));
  }
}
</style>
