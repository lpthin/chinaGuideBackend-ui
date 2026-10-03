import { test, type Page, type Response } from '@playwright/test';
import { Api } from '../lib/api';
import { Journal } from '../lib/journal';
import { env } from '../lib/env';

/**
 * SYS-J13 六屏浏览器重放（判 N-04 后台可用性 / N-05 诚实态；Q-3=3b 定稿的那 6 屏）
 *
 * 身份：超管。六屏不是一次到位的：Spec-H H-3/Q9-a 把侧栏分成互斥的两档 ——
 * 「租户日常」与「平台管理」，选了租户档就看不见建站与计费（`workspaceMenu.ts:100-104` 的 domain，
 * `WorkspaceView.vue:291-298` 那段注释就是这条纪律）。所以这一条用例按人真走的路线分两档看屏：
 * 租户档三屏（工作台 / 内容工作台 / 站内信）+ 平台档三屏（GEO 总览 / 页面搭建 / 账单）。
 * 真实租户只读 —— 全程一句写接口都不调，动作只有点登录、点切换、点分组、点导航。
 *
 * 每屏判三件事：① 屏上确有那几句字面文案；② 屏上没有失败态字面文案；
 * ③ 这一屏没有 pageerror / console error / 任何 /api 的 4xx·5xx。
 * 文案摘自组件源码，不靠 class 猜；无论断言过没过，每屏都把屏上正文原样记进日志，
 * 报告里引用的必须是落盘的那一份。
 */

interface Screen {
  名字: string;
  /** 截图文件名用的短名。不能用 path 的最后一段：/workspace/geoseo/dashboard 与 /workspace/dashboard
   *  都叫 dashboard，10-03 那一轮 GEO 那张图就是这么被工作台覆盖掉的。 */
  短名: string;
  path: string;
  分组: string;
  入口: string;
  要有: string[];
  不许有: string[];
  说明: string;
}

/** 平台档那句「这一屏没有租户口径」的诚实提示（DashboardView 的空态，10-03 现场快照里读到原句） */
const PLATFORM_HINT = '请在顶栏切换到一家租户后再看。';

const TENANT_SCREENS: Screen[] = [
  {
    名字: 'GEO 看板',
    短名: 'geoseo',
    path: '/workspace/geoseo/dashboard',
    分组: '效果与经营',
    入口: '总览仪表盘',
    要有: ['GEO总览仪表盘', '文章总数', '禁止把多平台加权成一个跨平台总分',
      'GEO 总分已下线：这里没有真观测值可显示'],
    不许有: [],
    说明: '要 geo:overview:view（V143 起只发超管）；那句 METRIC_HARD_RULES 是屏上字面判据；'
      + '这一组挂在 domain=tenant 的「效果与经营」下，所以站在租户档点得到它。'
      + '「GEO 总分已下线」那句不是失败态而是 Spec-G Q2-A 定稿的诚实态（假总分已删，屏上必须说出来），'
      + '10-03 现场抓到它就印在卡上 —— 原来把它放进「不许有」是这条用例自己写反了',
  },
  {
    名字: '工作台',
    短名: 'dashboard',
    path: '/workspace/dashboard',
    分组: '',
    入口: '工作台',
    要有: ['被 AI 引用', '今日浏览', '访问趋势'],
    不许有: ['趋势读取失败', '当前账号没有访问趋势的查看权限', PLATFORM_HINT],
    说明: 'N-04 的「首屏能不能答被 AI 引用了多少次」就在这屏；站在租户档时那句平台档提示必须消失',
  },
  {
    名字: '门户内容',
    短名: 'content',
    path: '/workspace/portal/content',
    分组: '网站内容',
    入口: '内容工作台',
    要有: ['一张卡对应平台为你们开通的一个栏目', '内容完整度'],
    不许有: ['栏目读取失败'],
    说明: '卡集合来自 /portal/sections；读不到必须说「栏目读取失败」，不许摆一排空卡；'
      + '「内容完整度」是每张卡上那一格（a-descriptions-item 的 label），没卡就说明栏目没摆出来',
  },
  {
    名字: '站内信',
    短名: 'messages',
    path: '/workspace/portal/messages',
    分组: '网站内容',
    入口: '站内信',
    要有: ['我的收件箱', '未读'],
    不许有: ['统计数据读取失败：'],
    说明: '三个数按「你在这家租户里的信」算（BE-S1 起与列表同源），读失败必须念出来',
  },
];

const PLATFORM_SCREENS: Screen[] = [
  {
    名字: '页面装配',
    短名: 'pages',
    path: '/workspace/portal/pages',
    分组: '建站',
    入口: '页面搭建',
    要有: ['新建页面', '区块序列'],
    不许有: ['区块元数据加载失败', '页面列表加载失败'],
    说明: '搭建器要 portal:build:manage（V93 只发 SUPER_ADMIN），所以必须是超管 + 平台档这一眼',
  },
  {
    名字: '账单',
    短名: 'billing',
    path: '/workspace/billing/manage',
    分组: '计费',
    入口: '账单管理',
    要有: ['可用余额', '账单管理'],
    不许有: ['加载钱包信息失败', '加载消费统计失败'],
    说明: 'requiresSuperAdmin；非超管被弹回工作台那一条在 SYS-J12 已单判，这里不重做',
  },
];

async function bodyText(page: Page): Promise<string> {
  return page.locator('body').innerText().catch(() => '');
}

/** 一屏「稳下来」= 网络空闲 + 屏上所有 a-spin 转圈都停了（卡片还在 loading 时判文案，判的是转圈） */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.locator('.ant-spin-spinning').last()
    .waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => undefined);
  await page.waitForTimeout(600);
}

/**
 * 点完导航不等于屏上有内容：视图是按路由切出来的分片，屏上的数还要再异步填一轮。
 * 10-03 那一轮每屏之间只差 1 秒，读到的正文全是外壳菜单（492 字），于是六屏的文案断言
 * 全在判「分片还没到的那半秒」——那是这条用例自己的假阴性，不是系统的。
 * 所以这里等到这一屏自己的那句字面文案出现为止；等不到不放宽，照原样往下判、把屏上正文记进日志。
 */
async function waitScreen(page: Page, s: Screen): Promise<void> {
  await page.waitForFunction(
    (needles: string[]) => document.body.innerText && needles.every(n => document.body.innerText.includes(n)),
    s.要有,
    { timeout: 25_000, polling: 500 },
  ).catch(() => undefined);
  await settle(page);
}

/** 顶栏那颗「平台 / 租户」分段控件：点它 = 切档，而切档必然整页刷新（TenantSwitcher 里三处 window.location.reload） */
async function switchScope(page: Page, label: '平台' | '租户'): Promise<void> {
  await page.locator('[data-test="scope-mode"] .ant-segmented-item', { hasText: label }).first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_500);
}

/** 站在租户档时，租户下拉才出现（TenantSwitcher.vue:15-25 的 v-if） */
async function pickTenant(page: Page, tenantName: string): Promise<void> {
  await page.locator('.tenant-switcher').first().click();
  await page.locator('.ant-select-dropdown .ant-select-item-option', { hasText: tenantName }).first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_500);
}

/** 走一屏 = 展开它所在的分组、点它那一颗导航项（不是拼 URL：N-04 判的就是「人点得到吗」） */
async function openByMenu(page: Page, s: Screen): Promise<void> {
  if (s.分组) {
    const title = page.locator('.ant-menu-submenu-title', { hasText: s.分组 }).first();
    if (!(await title.isVisible().catch(() => false))) {
      throw new Error(`${s.名字}：侧栏里找不到分组「${s.分组}」（当前档摆的组变了，看 journal 里的菜单快照）`);
    }
    const leaf = page.locator('.ant-menu-item', { hasText: s.入口 }).first();
    if (!(await leaf.isVisible().catch(() => false))) {
      await title.click();
      await page.waitForTimeout(600);
    }
  }
  await page.locator('.ant-menu-item', { hasText: s.入口 }).first().click();
  await waitScreen(page, s);
  await settle(page);
}

async function shootScreen(page: Page, j: Journal, s: Screen): Promise<string> {
  const file = `${env.evidenceDir}/screen-${s.短名}.${env.runId}.png`;
  await page.screenshot({ path: file, fullPage: true });
  const text = await bodyText(page);
  j.record('screen-body', s.名字, { url: page.url(), chars: text.length, 正文: text.slice(0, 1_200) });
  j.record('screenshot', s.名字, { path: file });
  return text;
}

async function assertScreen(page: Page, j: Journal, s: Screen): Promise<void> {
  const text = await shootScreen(page, j, s);
  for (const needle of s.要有) {
    j.expect(`${s.名字}：屏上有「${needle}」`, text.includes(needle), true);
  }
  for (const needle of s.不许有) {
    j.expect(`${s.名字}：屏上没有失败态「${needle}」`, text.includes(needle) === false, true);
  }
  j.expect(`${s.名字}：点进去停在 ${s.path}`, page.url().includes(s.path), true);
}

test('SYS-J13 六屏浏览器重放（N-04 / N-05）', async ({ page }, testInfo) => {
  testInfo.setTimeout(600_000);
  const j = new Journal('SYS-J13');
  const noise: string[] = [];
  const failedApi: string[] = [];

  page.on('pageerror', (e) => noise.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') noise.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  page.on('response', (r: Response) => {
    const u = r.url();
    if (u.includes('/api/') && r.status() >= 400) {
      failedApi.push(`${r.status()} ${u.replace(env.uiBase, '').replace(env.apiBase, '')}`);
    }
  });

  // 选哪一家：从平台口现场查，不写死租户号（15 只是这一轮恰好选中的那一家，有 GEO 轮次与账单数据）
  const sa = await Api.login(env.apiBase, j, env.superAdmin.username, env.superAdmin.password);
  const principals = sa.api.principal(sa.res);
  j.check('浏览器这六屏用的身份确有 SUPER_ADMIN', principals.roles, principals.roles.includes('SUPER_ADMIN'));
  const tenants = await sa.api.get('/api/admin/tenants?page=1&size=200');
  const rows = (tenants.data as { records?: Array<{ id: number; name: string; code: string }> })?.records
    ?? (tenants.data as Array<{ id: number; name: string; code: string }>) ?? [];
  const wantedId = Number(process.env.E2E_SCREEN_TENANT_ID ?? 15);
  const tenant = rows.find(t => t.id === wantedId);
  if (!tenant) throw new Error(`第 ${wantedId} 号租户在 /api/admin/tenants 的返回里找不到（查到 ${rows.length} 行）`);
  j.note('这一轮浏览器站在哪家真实租户上看屏（只读，不写）', { id: tenant.id, name: tenant.name, code: tenant.code });

  j.card({
    用例号: 'SYS-J13-01',
    判据: 'N-04、N-05',
    层级: 'BROWSER',
    前置: `后端 ${env.apiBase}、前端 ${env.uiBase}（vite 代理 /api）；超管 ${env.superAdmin.username}；站在租户 ${tenant.id} 只读`,
    步骤: [
      '1 界面表单登录（不用 localStorage 塞 token）—— 落在平台档的工作台',
      '2 平台档那一句「请在顶栏切换到一家租户后再看。」必须在屏上（N-05：空结果要说清是怎么来的）',
      '3 点顶栏分段控件「租户」→ 在租户下拉里挑这一家（两次整页刷新，全走真实控件）',
      '4 切档后前端记下的租户号对得上，且那句平台档提示消失',
      '5 点 .collapse-btn 量侧栏宽度；点「网站内容」分组标题量子项可见性',
      ...TENANT_SCREENS.map((s, i) => `${i + 6} 租户档点导航进 ${s.名字}（${s.分组} → ${s.入口}）：断言 [${s.要有.join(' / ')}]，且没有 [${s.不许有.join(' / ')}]`),
      `${TENANT_SCREENS.length + 6} 点回分段控件「平台」，换平台档`,
      ...PLATFORM_SCREENS.map((s, i) => `${i + TENANT_SCREENS.length + 7} 平台档点导航进 ${s.名字}（${s.分组} → ${s.入口}）：断言 [${s.要有.join(' / ')}]，且没有 [${s.不许有.join(' / ')}]`),
      `${PLATFORM_SCREENS.length + TENANT_SCREENS.length + 8} 全程收集 pageerror / console.error / /api 的 4xx·5xx`,
      `每屏判之前先等屏上所有 a-spin 转圈停下（settle）：卡片还在 loading 时判文案，判的是转圈`,
    ],
    期望: [
      '六屏各自的「要有」文案都渲染出来（摘自组件源码的字面串）',
      '六屏各自的「不许有」失败态一个字都不出现',
      '平台档提示出现→切租户后消失；收合后侧栏变窄；分组标题点得动（前后子项可见性翻转）',
      'console/pageerror 为空、/api 无 4xx·5xx —— 有就原样列进报告',
    ],
    反例: ['「页面搭建」「账单管理」在租户档的侧栏里根本没有入口（它们挂在 domain=platform 的组上）——'
      + '换档后读到的分组清单就是这条反例的证据，journal 里的 menu 行',
      '反过来「效果与经营 / 网站内容」这些组在平台档也不该出现 —— 同一份清单判两头'],
    收尾: '不改任何数据；每屏一张整页截图 + 屏上正文前 1200 字进证据目录，runs.log 记一行总账',
  });

  // ── 1 登录必须走界面：这六屏的第一条判据是「人真进得去」 ──────────────────
  await page.goto(`${env.uiBase}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('用户名').fill(env.superAdmin.username);
  await page.getByPlaceholder('密码').fill(env.superAdmin.password);
  await page.locator('.login-button').click();
  await page.waitForURL(/\/workspace/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_000);
  j.expect('用登录表单进得去工作台（不是靠塞 localStorage 混进去的）', page.url().includes('/workspace'), true);

  // ── 2 平台档的诚实空态 ────────────────────────────────────────────────────
  j.expect(`平台档工作台念得出「${PLATFORM_HINT}」`, (await bodyText(page)).includes(PLATFORM_HINT), true);

  // ── 3~4 切到租户档并站到那一家 ────────────────────────────────────────────
  await switchScope(page, '租户');
  await pickTenant(page, tenant.name);
  const chosen = await page.evaluate(() => localStorage.getItem('selected_tenant_id'));
  j.expect('顶栏选了租户之后，前端记下的租户号就是那一家', Number(chosen), tenant.id);
  await page.waitForTimeout(800);

  // ── 5 N-04 之一：左侧导航可收合（真点 .collapse-btn，量宽度） ──────────────
  const aside = page.locator('.ant-layout-sider').first();
  const widthBefore = (await aside.boundingBox())?.width ?? 0;
  await page.locator('.collapse-btn').click();
  await page.waitForTimeout(700);
  const widthAfter = (await aside.boundingBox())?.width ?? 0;
  j.note('导航收合前后侧栏宽度', { widthBefore, widthAfter });
  j.expect('点收合按钮之后侧栏真的变窄了（N-04「可收合」）', widthAfter > 0 && widthAfter < widthBefore, true);
  await page.locator('.collapse-btn').click();
  await page.waitForTimeout(700);

  // ── 5之二 N-04：分组能折叠（Spec-H H-1a 把 item-group 换成了 a-sub-menu） ───
  const groupTitle = page.locator('.ant-menu-submenu-title', { hasText: '网站内容' }).first();
  j.expect('租户档侧栏里有「网站内容」这个分组（组名读自 MENU_GROUPS，不是猜的）', await groupTitle.count() > 0, true);
  const childInGroup = page.locator('.ant-menu-item', { hasText: '内容工作台' }).first();
  const openBefore = await childInGroup.isVisible().catch(() => false);
  await groupTitle.click();
  await page.waitForTimeout(700);
  const openAfter = await childInGroup.isVisible().catch(() => false);
  j.note('点分组标题前后「内容工作台」这一项的可见性', { openBefore, openAfter });
  j.expect('分组点一下能折叠/展开（openKeys 真的在动）', openBefore !== openAfter, true);
  if (!openAfter) {
    await groupTitle.click();
    await page.waitForTimeout(700);
  }

  // ── 6~8 租户档三屏 ────────────────────────────────────────────────────────
  for (const s of TENANT_SCREENS) {
    await openByMenu(page, s);
    await assertScreen(page, j, s);
  }

  // ── 9~12 平台档三屏 ───────────────────────────────────────────────────────
  await switchScope(page, '平台');
  const backToPlatform = await page.evaluate(() => localStorage.getItem('selected_tenant_id'));
  j.expect('点回「平台」之后前端不再记着任何租户', backToPlatform === null, true);
  const platformGroups = await page.locator('.ant-menu-submenu-title').allInnerTexts();
  j.record('menu', '平台档侧栏分组', platformGroups.map(g => g.trim()).filter(Boolean));
  for (const s of PLATFORM_SCREENS) {
    await openByMenu(page, s);
    await assertScreen(page, j, s);
  }

  // ── 全程噪声 ──────────────────────────────────────────────────────────────
  j.note('这一趟打过的接口里 4xx/5xx 的清单', failedApi);
  j.expect('/api 全程没有 4xx·5xx（有就逐条列进报告）', failedApi, []);
  j.note('控制台噪声清单', noise);
  j.expect('控制台全程没有 error / pageerror', noise, []);
  j.assertClean();
});
