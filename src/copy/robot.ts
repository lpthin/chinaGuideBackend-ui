/**
 * 引导机器人的全部文案（SPEC-UI-11 §10：单一来源）。
 *
 * 纪律：
 * - 一段话一个 key，与 `RobotNotice.key` 一一对应；
 * - 气泡首句 ≤ 30 字、正文 ≤ 60 字，原因与字段清单进 `detail`；
 * - 页面里不许再各写一份口径说明——要复看就点页头问号，机器人只留一句。
 *
 * 模块卡按 `navigation/workspaceMenu.ts` 的组 key 分组，一模块一张，评审时逐条对照，
 * 不用翻 86 个视图。13 个模块与菜单组一一对应，少一个就有页面「首访没有开场白」。
 */
import type { RobotCategory, RobotFrequency } from '../components/robot/robotTypes'

/** 一条模块知识卡：一句话讲清「这里能做什么、前提是什么」 */
export interface RobotModuleCard {
  title: string
  /** 气泡首句，≤ 30 字 */
  text: string
  /** 展开才看的解释：前提、边界、容易误会的地方 */
  detail: string
}

export const ROBOT_MODULE_CARDS: Record<string, RobotModuleCard> = {
  content: {
    title: 'AI 写稿',
    text: '这里把热点变成能发布的稿子',
    detail:
      '一条流水线：选题（热词与聚类）→ 生成 → 审核 → 发布。前提是先选客户与站点，' +
      '并确认 AI 配置里模型可用；生成会消耗额度，每次都由你手动点。'
  },
  article: {
    title: '文章与案例',
    text: '文章、分类、模板、素材与案例都在这一组',
    detail:
      '「文章」是已发布与草稿的正文；分类决定门户栏目归属；模板是生成时的骨架；' +
      '素材库管图片；案例是给客户看的成品展示。改分类后门户要重新生成才会变。'
  },
  knowledge: {
    title: '知识库',
    text: '这里是 AI 写作与答疑的资料来源',
    detail:
      '文档与知识卡进入向量库之后，生成与门户问答才会引用它们。' +
      '刚上传不等于马上可用，要等向量化完成；向量化失败会在卡片上标出原因。'
  },
  'site-content': {
    title: '站点内容',
    text: '这里管访客在门户上看得见的东西',
    detail:
      '横幅、展示内容、门店、招聘——都是直接摆到访客页上的素材。' +
      '保存只改后台，还要到「搭建与设置」里生成或发布，门户上才会变。'
  },
  'visitor-interaction': {
    title: '访客互动',
    text: '访客写进来的话都收在这一组',
    detail:
      '留言与线索、评论点赞、站内信。未读数是真实的待处理量；' +
      '标记已读不会删除内容，删除才不可恢复。'
  },
  'site-setup': {
    title: '搭建与设置',
    text: '这里决定站点长什么样、能不能上线',
    detail:
      '页面搭建、企业信息、站点设置。门户上线只有平台侧进得来；' +
      '改了栏目或页面之后要重新生成，访客才会看到新版本。'
  },
  'site-effect': {
    title: '效果与经营',
    text: '这里看流量、引用与 GEO 体检',
    detail:
      '访问统计、引用情况、体检结果与客户经营。不同卡片的统计口径可能不同，' +
      '看数字前先读卡片下方的口径说明，不同口径的数不要相加。'
  },
  'build-assets': {
    title: '站点与客户',
    text: '先开客户，再建站点，最后给站点开栏目',
    detail:
      '顺序是真实依赖：没有客户就建不了站，没有站点就开不了栏目。' +
      '删客户会连带它的站点与内容，属于不可恢复动作。'
  },
  build: {
    title: '建站',
    text: '这里从需求单一路做到可发布的站点',
    detail:
      '流程是：需求单 → 说明书 → 出方案 → 候选 → 转正。' +
      'AI 出方案会消耗额度；候选不转正不会影响线上站点。'
  },
  'build-quality': {
    title: '平台质量',
    text: '这里检查页面、引用与整站组装',
    detail:
      '页面巡检、引用探测、整站组装与改版工单。巡检发现问题只给建议，' +
      '不会自动改线上内容；采纳之后才进入改版流程。'
  },
  billing: {
    title: '计费',
    text: '账单、订单、钱包与发票都在这一组',
    detail:
      '账单是按用量结算的结果，订单是支付凭证，钱包是余额与流水，发票按订单开。' +
      '金额以账单为准；对不上时先看账单周期，再看订单时间。'
  },
  ai: {
    title: 'AI 配置',
    text: '模型、向量化、用量与生成模板的开关',
    detail:
      '改模型或密钥会影响全站生成，属于高影响操作；' +
      '用量按调用记账，排查费用先看这里的明细。'
  },
  system: {
    title: '系统与告警',
    text: '账号权限、系统设置、报警与待办',
    detail:
      '这里改的是全平台生效的规则：角色权限、告警阈值、待办派发。' +
      '给账号加权限前先确认它属于哪家客户，权限码改动立即生效。'
  }
}

/** 一条模块卡的 key 是否登记过（闸门与首访引导共用这一份） */
export function hasModuleCard(moduleKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(ROBOT_MODULE_CARDS, moduleKey)
}

/** 频率四档在设置面板里的名字与一句解释 */
export const ROBOT_FREQUENCY_COPY: Record<RobotFrequency, { label: string; hint: string }> = {
  off: { label: '关闭', hint: '只在有任务结果时冒角标，不主动说话' },
  quiet: { label: '安静', hint: '只说任务结果与系统提醒，每天最多 3 条' },
  standard: { label: '标准', hint: '每页首次访问最多说 1 条，每天最多 8 条' },
  active: { label: '积极', hint: '口径、引导、公告都主动说，每页最多 2 条' }
}

/** 五个内容开关的名字（顺序与 ROBOT_CATEGORIES 一致） */
export const ROBOT_CATEGORY_COPY: Record<RobotCategory, { label: string; hint: string }> = {
  scope: { label: '口径说明', hint: '这块数字怎么算、能不能相加' },
  guide: { label: '操作引导', hint: '这一页能做什么、前提是什么' },
  task: { label: '任务结果', hint: '生成、导入、发布跑完了没有' },
  system: { label: '系统提醒', hint: '待办、体检异常、站点问题' },
  announce: { label: '公告', hint: '版本更新与功能变化' }
}

/** 设置面板与气泡的固定文案 */
export const ROBOT_COPY = {
  /** 每个账号第一次见到时只说一次（§9） */
  intro: {
    text: '我只讲这一页的说明，右下角可以调频率或关掉',
    detail:
      '不会弹窗、不会抢焦点，正在填表或打开弹窗时我不说话。' +
      '嫌吵可以在设置里换成「安静」或「关闭」，也可以按类别单独关。'
  },
  avatarAria: '打开引导机器人设置',
  bubbleAria: '引导提示',
  badgeAria: '有新提示',
  close: '关闭这条提示',
  detailToggle: '看详细说明',
  detailCollapse: '收起说明',
  actionDismiss: '知道了',
  actionLater: '这条不再提示',
  actionMutePage: '本页不再提示',
  actionMuteCategory: '这类不再提示',
  quietHour: '安静 1 小时',
  quietToday: '今天不再打扰',
  quietResumed: '已恢复提醒',
  settings: {
    title: '引导设置',
    tabs: { rate: '频率', content: '内容', layout: '位置' },
    frequency: '多久说一次',
    quiet: '临时安静',
    content: '说哪些内容',
    muted: '已静音',
    mutedEmpty: '还没有静音任何一条',
    restoreAll: '全部恢复',
    restore: '恢复',
    position: '出现在哪一侧',
    positionRight: '右下',
    positionLeft: '左下',
    avatar: '显示机器人',
    avatarHint: '关掉之后不再出现形象，页头的问号仍可查看说明',
    mutedKeyLabel: '这一条',
    mutedPageLabel: '这一页'
  },
  /** 页头问号（R-5）：手动复看被搬走的说明，不受频率与静音影响 */
  help: {
    title: '这一页的说明',
    aria: '查看这一页的说明',
    close: '关闭说明'
  }
}

/**
 * 试点页的页面说明卡（R-5）。
 *
 * 页面只登记 key，正文只在这里写一份：机器人说的首句与问号里的全文读的是同一处，
 * 改口径不用再去三个 `.vue` 里各找一遍（§10 单一来源）。
 * `text` 是首句（先给结论），`detail` 是点开才看的全文。
 */
export const ROBOT_PAGE_CARDS: Record<string, { text: string; detail: string }> = {
  'analytics.scope': {
    text: '两块数字口径不同，不能相加',
    detail:
      '人工浏览来自门户前端埋点：只有真浏览器会执行那段脚本，所以它不会把爬虫算进来。' +
      '抓取由服务端按 User-Agent 识别，只能看到 /robots.txt、/sitemap.xml、/llms.txt、/llms-full.txt 和门户公开接口' +
      '——门户页面本身由前端服务器返回，后端看不到抓页面的请求，' +
      '所以它表示「抓了 SEO 文件 / 调了门户接口」，不是页面浏览量。'
  },
  'media.storage.intro': {
    text: '这一屏管三件事：写到哪儿、差多少、这次搬不搬',
    detail:
      '新素材写到哪儿看下面那份配置（全站只有一个人能改）；老素材还有多少行没跟上，看「现在的状态」；' +
      '这次要不要搬一批，是最后那一次动手。迁移只复制、不删本地文件——' +
      '内容表里存的仍是原来的 /uploads/... 地址，所以「搬完了」不等于「磁盘上的可以清了」。' +
      '它会改所有客户的 media 行，也只有超级管理员能进，且没有自动跑的定时任务：一次点一批。'
  },
  'portal.skeleton.intro': {
    text: '骨架是站点的「出生证明」：页面 + 导航 + 皮肤',
    detail:
      '一套骨架 = 一组页面 + 导航顺序 + 默认皮肤，存在平台数据里，不是写在代码里的清单。' +
      '这里的预览用的是访客端同一套渲染器加演示数据，不落库；把骨架实例化到站点才会真的补页面。'
  },
  'daily-output.pipeline': {
    text: '到点选题出稿，过质检才发',
    detail:
      '到点自动从热词库选题、产出草稿；要不要直接发到站上，由这一页下面那一档决定。' +
      '「过质检后自动发布」不是无人值守直通站点：质检没过或调用没跑成的稿子仍退回人工待审，' +
      '留痕里会写明是哪一种。'
  },
  'portal.assemble.intro': {
    text: '整站组装跑两步模型，没有一键上线',
    detail:
      '先估算、看过预估再亲手勾确认才调用模型；调用之后拿到的仍然只是逐页草稿，' +
      '访客能看到什么，只由「应用这一页」这一个一个的点击决定。' +
      '这条路只有平台侧走得通（N4：组件搭建与组装归超级管理员），客户侧没有它。'
  },
  'portal.blocks.intro': {
    text: '平台组件库，每格都由访客端同一渲染器渲',
    detail:
      '演示槽位按区块自己的字段结构（dataSchema）推出来，不落库、也不动任何站点。' +
      '清单、分类、可选渲染器与默认字段结构全部来自服务端，这一页没有第二份常量。' +
      '代码声明的那一族在这里只读——要改它得发版；界面添加的那一族可以新建、改字段结构、启用与删除。'
  },
  'portal.sections.intro': {
    text: '关掉栏目不等于把页面下线',
    detail:
      '栏目关掉后，导航不再出现这一项、访客页面上绑这一数据源的区块不再渲染、巡检也不再催这一栏，' +
      '但页面本身与里面的内容一条都不动（N5：骨架与栏目归超级管理员，内容归客户）。' +
      '每张卡改的都是草稿，顶上那条导航预览不点保存也是这个样子；' +
      '一次保存只发一条整批请求，后端要么全写、要么一条都不写。'
  },
  'portal.showcase.intro': {
    text: '带「示意」徽标的条目只是占位资料',
    detail:
      'AI 生成的示意条目会在门户上占位，但不进真实统计；' +
      '把每一处换成自己的资料后徽标自然消失（关掉「示意内容」开关即去掉）。' +
      '分类页签、中文名与归属栏目都来自平台词表，这里只是读它。'
  },
  'portal.reference.intro': {
    text: '摄取的是别人的结构，不是搬别人的网页',
    detail:
      '落库的只有版式结构、样式取值与映射建议；' +
      '生成出来的是一份草稿页，用的是我们自己的区块和你们自己的内容。'
  },
  'portal.theme.intro': {
    text: '皮肤只是一组样式变量，不含内容',
    detail:
      '主色、圆角、字号比例等，可以在自己的页面之间来回应用。' +
      '「平台模板」是超级管理员从某个页面沉淀出来的公共版式：客户文案已被换成演示文本，应用时填的是你们自己的数据。'
  },
  'portal.stores.intro': {
    text: '门店按公司归属，不按站点',
    detail:
      '同一家公司名下几个站看到的都是这一批门店。地图上只摆「营业中」的点位，' +
      '一次最多摆平台配置的上限个（按排序取靠前的）；每一家要么填地址、要么填经纬度，' +
      '两边都没有的那一家在地图上指不出位置。'
  },
  'portal.reference.package': {
    text: '段级只是证据，不会变成站点样式',
    detail:
      '能被搬进真的样式变量的只有浏览器量出来的站级取值。' +
      '「这一格里出现过 12px」和「这一站的圆角是 12px」可信度差一个量级，所以它们分列在两处显示。'
  },
  'portal.site-info.seo': {
    text: '页面 SEO 只是只读镜像',
    detail: '写入这一层的口在超级管理员侧「页面搭建」，客户侧暂不可改。'
  }
}
