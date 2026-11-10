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
  }
}
