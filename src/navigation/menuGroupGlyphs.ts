/**
 * 栏目（菜单组）的彩色图标（2026-11-11）。
 *
 * 为什么要自己画：antd 的 outlined 图标是单色 currentColor，一排看下来全是灰线，
 * 用户嫌素。彩色有现成方案（iconify flat-color 等）但要么加运行时依赖、要么整包图标
 * 风格不齐，都不如手绘 13 颗 24×24 双色/三色小图——每个栏目 2~4 个元素，扁平风、
 * 圆角、同一档饱和度，一眼是一个家族的。
 *
 * 形态约束：
 * - 只存 `<svg>` 的内部标记（v-html 注入），内容全部是本文件的编译期常量，无注入面；
 * - 不写 `<svg>` 外壳与尺寸，尺寸/无障碍由视图统一给；
 * - 颜色写死在标记里（图标本身就有颜色），视图不要再给它染底色。
 *
 * key 与 workspaceMenu.ts 的 MenuGroupDef.key 一一对应；漏了视图会回落到单色 antd 图标，
 * 用例会揪出来。
 */
export const MENU_GROUP_GLYPHS: Record<string, string> = {
  // AI 写稿：钢笔 + 琥珀星光
  content:
    '<path d="M4.8 19.2l2.3-6.6 7.3-7.3a2 2 0 012.9 2.9l-7.3 7.3-6.6 2.3z" fill="#7c3aed"/>' +
    '<path d="M13.2 6.5l3 3" stroke="#c4b5fd" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M18.3 13.2l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" fill="#f59e0b"/>' +
    '<circle cx="5.6" cy="5.8" r="1.2" fill="#fbbf24"/>',
  // 文章与案例：蓝文档 + 浅蓝折角
  article:
    '<path d="M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#2563eb"/>' +
    '<path d="M15 3l4 4h-4V3z" fill="#93c5fd"/>' +
    '<path d="M8.5 12.2h7M8.5 15.6h5" stroke="#dbeafe" stroke-width="1.6" stroke-linecap="round"/>',
  // 知识库：摊开的双色书页
  knowledge:
    '<path d="M4 5.6A1.6 1.6 0 015.6 4H11v15H5.6A1.6 1.6 0 014 17.4V5.6z" fill="#0d9488"/>' +
    '<path d="M20 5.6A1.6 1.6 0 0018.4 4H13v15h5.4a1.6 1.6 0 001.6-1.6V5.6z" fill="#2dd4bf"/>' +
    '<path d="M6.6 8.2h2.4M15 8.2h2.4M6.6 11.4h2.4M15 11.4h2.4" stroke="#ccfbf1" stroke-width="1.4" stroke-linecap="round"/>',
  // 站点内容：浏览器窗口 + 红绿窗口点
  'site-content':
    '<path d="M3.5 7a2 2 0 012-2h13a2 2 0 012 2v2.2h-17V7z" fill="#c2410c"/>' +
    '<path d="M3.5 9.2h17V17a2 2 0 01-2 2h-13a2 2 0 01-2-2V9.2z" fill="#ea580c"/>' +
    '<circle cx="6.2" cy="7.1" r="0.9" fill="#fde68a"/>' +
    '<circle cx="8.8" cy="7.1" r="0.9" fill="#a7f3d0"/>' +
    '<path d="M6.2 12.6h6M6.2 15.4h8.6" stroke="#ffedd5" stroke-width="1.5" stroke-linecap="round"/>',
  // 访客互动：玫红对话泡
  'visitor-interaction':
    '<path d="M4.5 7a2.5 2.5 0 012.5-2.5h10A2.5 2.5 0 0119.5 7v6a2.5 2.5 0 01-2.5 2.5h-6.6l-3.9 3.1a.8.8 0 01-1.3-.6v-2.7A2.5 2.5 0 014.5 13V7z" fill="#db2777"/>' +
    '<circle cx="9" cy="10" r="1.1" fill="#ffffff"/>' +
    '<circle cx="12" cy="10" r="1.1" fill="#fce7f3"/>' +
    '<circle cx="15" cy="10" r="1.1" fill="#ffffff"/>',
  // 搭建与设置：靛蓝面板 + 橙色滑钮
  'site-setup':
    '<rect x="4" y="4.5" width="16" height="15" rx="2" fill="#4f46e5"/>' +
    '<rect x="6.5" y="7" width="5" height="4" rx="1" fill="#a5b4fc"/>' +
    '<path d="M6.5 15h6" stroke="#c7d2fe" stroke-width="1.6" stroke-linecap="round"/>' +
    '<circle cx="15" cy="15" r="1.7" fill="#f59e0b"/>' +
    '<circle cx="16" cy="9" r="1.7" fill="#f472b6"/>',
  // 效果与经营：双色柱 + 琥珀趋势线
  'site-effect':
    '<rect x="4.5" y="12.5" width="3.6" height="7" rx="1" fill="#86efac"/>' +
    '<rect x="10.2" y="8.5" width="3.6" height="11" rx="1" fill="#16a34a"/>' +
    '<rect x="15.9" y="10.5" width="3.6" height="9" rx="1" fill="#4ade80"/>' +
    '<path d="M5 8l4.8-3.4 4.4 1.9L18.6 3.4" stroke="#f59e0b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  // 站点与客户：三层青色数据桶
  'build-assets':
    '<ellipse cx="12" cy="5.8" rx="7.4" ry="2.6" fill="#22d3ee"/>' +
    '<path d="M4.6 5.8v5.4c0 1.5 3.3 2.7 7.4 2.7s7.4-1.2 7.4-2.7V5.8c0 1.5-3.3 2.7-7.4 2.7S4.6 7.3 4.6 5.8z" fill="#0891b2"/>' +
    '<path d="M4.6 11.2v5.4c0 1.5 3.3 2.7 7.4 2.7s7.4-1.2 7.4-2.7v-5.4c0 1.5-3.3 2.7-7.4 2.7s-7.4-1.2-7.4-2.7z" fill="#0e7490"/>',
  // 建站：火箭（琥珀头锥 + 天蓝舷窗 + 橙焰）
  build:
    '<path d="M12 2.8c2.9 1.7 4.4 4.6 4.4 7.9 0 1.6-.3 3.1-.9 4.6H8.5a12 12 0 01-.9-4.6c0-3.3 1.5-6.2 4.4-7.9z" fill="#f1f5f9"/>' +
    '<path d="M12 2.8c1.6.9 2.8 2.2 3.6 3.8H8.4c.8-1.6 2-2.9 3.6-3.8z" fill="#f59e0b"/>' +
    '<circle cx="12" cy="9.8" r="1.7" fill="#38bdf8"/>' +
    '<path d="M8.5 15.3l-1.7 2.7a.5.5 0 00.5.8l2.6-.9M15.5 15.3l1.7 2.7a.5.5 0 01-.5.8l-2.6-.9" fill="#94a3b8"/>' +
    '<path d="M10.7 17.3c-.1 1.5.4 2.8 1.3 3.7.9-.9 1.4-2.2 1.3-3.7a5.2 5.2 0 00-2.6 0z" fill="#fb923c"/>',
  // 平台质量：红盾 + 白勾
  'build-quality':
    '<path d="M12 2.8l7 2.6v5.3c0 4.4-2.9 8-7 9.3-4.1-1.3-7-4.9-7-9.3V5.4l7-2.6z" fill="#dc2626"/>' +
    '<path d="M12 2.8l7 2.6v5.3c0 4.4-2.9 8-7 9.3V2.8z" fill="#b91c1c"/>' +
    '<path d="M8.6 11.7l2.4 2.4 4.4-4.4" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  // 计费：绿账本 + 金币
  billing:
    '<rect x="5" y="3.5" width="14" height="17" rx="2" fill="#059669"/>' +
    '<rect x="7.6" y="3.5" width="2" height="17" fill="#065f46"/>' +
    '<circle cx="14.6" cy="12" r="3.1" fill="#fbbf24"/>' +
    '<circle cx="14.6" cy="12" r="1.7" fill="#fde68a"/>',
  // AI 配置：品红机器人 + 青色眼睛
  ai:
    '<rect x="5" y="7.6" width="14" height="10.4" rx="3" fill="#c026d3"/>' +
    '<circle cx="9.6" cy="12.4" r="1.5" fill="#22d3ee"/>' +
    '<circle cx="14.4" cy="12.4" r="1.5" fill="#22d3ee"/>' +
    '<path d="M12 7.6V5" stroke="#c026d3" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="12" cy="4.3" r="1.2" fill="#f0abfc"/>' +
    '<path d="M9.8 15.9c1.4.9 3 .9 4.4 0" stroke="#f5d0fe" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
  // 系统与告警：石墨齿轮 + 天蓝轴心
  system:
    '<path d="M10.7 3.5h2.6l.4 2.1c.6.2 1.2.5 1.7.9l2-.8 1.3 2.2-1.6 1.4c.1.6.1 1.2 0 1.8l1.6 1.4-1.3 2.2-2-.8c-.5.4-1.1.7-1.7.9l-.4 2.1h-2.6l-.4-2.1a6 6 0 01-1.7-.9l-2 .8-1.3-2.2 1.6-1.4a6 6 0 010-1.8L4.3 7.9l1.3-2.2 2 .8c.5-.4 1.1-.7 1.7-.9l.4-2.1z" fill="#64748b"/>' +
    '<circle cx="12" cy="12" r="2.6" fill="#93c5fd"/>'
}

/** 取栏目彩色图标；没注册返回 null，视图回落到单色 antd 图标 */
export function menuGroupGlyph(key: string): string | null {
  return MENU_GROUP_GLYPHS[key] ?? null
}
