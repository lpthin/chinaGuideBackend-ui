// M-P34 浏览器 DOM 验收（侧栏那一项 + 补跑这一族的屏幕原话 + 真的点下去）。
// 判据只认浏览器 DOM 的 innerText，不认 jsdom。产物落盘到 p7-evidence/。
//
// 这一版的范围（都是「直连 URL 能出数」不等于「人在界面上走得到」那一类）：
//  (a) 侧栏的「建站任务总览」必须在**平台档**（超管没选租户）的真实 DOM 里数得到，且点得进去——
//      WorkspaceView.vue:300 那段 isPlatformMode 说清楚了：一选租户，整个「平台管理」段就不摆了，
//      所以这一格只能在平台档判，在租户档判必红（上一版就在这里误判成「菜单没做」）。
//  (b) 回收那句里被「」引起来的按钮名，必须在同一份 DOM 里数到同名按钮；同时把旧的单数形态
//      当反空检验读数打出来（这一格必须是 0，否则这条判据是空的）。
//  (c) 补跑那一趟真的按：先估算 → 勾确认 → 开始跑，回执要在界面上念出「补跑已受理：」。
//  (d) 切进租户档（真实外壳把手，不是往 localStorage 塞值）后，同一张详情页仍要渲染出这一族把手。
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const UI = 'http://localhost:5190';
const OUT = 'E:/qoder/scratch/mp34-live/p7-evidence';
fs.mkdirSync(OUT, { recursive: true });
const clickEstimate = process.env.P7_CLICK_ESTIMATE === '1';
const clickRun = process.env.P7_CLICK_RUN === '1';
const BRIEF = process.env.P7_MIXED_BRIEF || '537';
const WIZ_BRIEF = process.env.P7_WIZ_BRIEF || BRIEF;
const TENANT_NAME = process.env.P7_TENANT_NAME || '走查十六科技';
const lines = [];
const say = s => { lines.push(s); console.log(s); };
const dump = (name, text) => fs.writeFileSync(`${OUT}/${name}`, text);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('console', m => { if (m.type() === 'error') say('CONSOLE.ERROR ' + m.text().slice(0, 200)); });

await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('用户名').fill('admin');
await page.getByPlaceholder('密码').fill('admin123');
await page.locator('.login-button').click();
await page.waitForURL(/\/workspace/, { timeout: 30000 });
say('LOGIN url=' + page.url());
say('VIEWPORT ' + JSON.stringify(await page.evaluate(() => ({ w: innerWidth, narrow: matchMedia('(max-width: 768px)').matches }))));

// ---- 外壳把手：a-segmented 选中的那一段就是当前档；要哪一档就点哪一段
async function scopeChip() {
  const seg = page.locator('[data-test="scope-mode"]');
  if (!(await seg.count())) return '<no segmented>';
  return (await seg.locator('.ant-segmented-item-selected').innerText().catch(() => '<none>')).trim();
}
async function setScope(mode) {           // mode: '平台' | '租户'
  await page.goto(`${UI}/workspace/portal/briefs`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const seg = page.locator('[data-test="scope-mode"]');
  say(`SCOPE segmented_found=${await seg.count()} now=${JSON.stringify(await scopeChip())} want=${mode}`);
  if ((await scopeChip()) !== mode) {
    await seg.locator('.ant-segmented-item', { hasText: mode }).first().click();
    await page.waitForTimeout(3000);       // handleModeChange 里那一句 window.location.reload()
  }
  const after = await scopeChip();
  say(`CHECK scope_is[${mode}]=` + (after === mode) + ` (chip=${JSON.stringify(after)})`);
  return after;
}

async function menuReadings(tag) {
  const collapsed = await page.evaluate(() => !!document.querySelector('.ant-menu-inline-collapsed'));
  const items = (await page.locator('.ant-menu-item').allInnerTexts())
    .map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const groups = (await page.locator('.ant-menu-submenu-title').allInnerTexts())
    .map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean);
  say(`[${tag}] SIDER_COLLAPSED=${collapsed} groups=${JSON.stringify(groups)} items=${items.length}`);
  return { collapsed, groups, items };
}

// ---- 1) 平台档：侧栏「建站」组要能展开，「建站任务总览」要在真实 DOM 里，且点得进去
await setScope('平台');
await page.goto(`${UI}/workspace/portal/briefs`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => undefined);
let m = await menuReadings('platform');
const buildTitle = page.locator('.ant-menu-submenu-title', { hasText: '建站' }).first();
say('BUILD_GROUP found=' + await buildTitle.count() + ' aria-expanded=' + await buildTitle.getAttribute('aria-expanded'));
if (await buildTitle.count() && (await buildTitle.getAttribute('aria-expanded')) !== 'true') {
  await buildTitle.click();
  await page.waitForTimeout(900);
  m = await menuReadings('platform-after-expand');
}
dump('menu-platform.json', JSON.stringify(m, null, 1));
say('MENU_ITEMS ' + JSON.stringify(m.items));
const overviewLeaf = page.locator('.ant-menu-item', { hasText: '建站任务总览' }).first();
say('CHECK sidebar_has_overview_item=' + ((await overviewLeaf.count()) > 0));
say('CHECK sidebar_no_brief_leaf_in_tenant_scope_see_below');

// ---- 2) 从菜单点进去（不是直连 URL）
if (await overviewLeaf.count()) {
  await overviewLeaf.click();
  await page.waitForURL(/proposal-overview/, { timeout: 20000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1500);
  const ovText = await page.locator('body').innerText();
  dump('overview.txt', ovText);
  say('OVERVIEW url=' + page.url());
  say('CHECK overview_url=' + /proposal-overview/.test(page.url()));
  say('CHECK overview_rendered=' + ovText.includes('建站任务总览'));
  say('OVERVIEW_HEAD ' + JSON.stringify(ovText.slice(0, 260)));
}

// ---- 3) 平台档下的需求单详情页：补跑把手 + 回收那句的按钮名同源自检
async function briefPage(id, tag, opts) {
  opts = opts || {};
  await page.goto(`${UI}/workspace/portal/brief/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(2500);
  let txt = await page.locator('body').innerText();
  dump(`brief-${id}-${tag}.txt`, txt);
  say(`[${tag}] brief=${id} url=${page.url()} scope=${JSON.stringify(await scopeChip())}`);

  const estBtn = page.locator('button', { hasText: '只补失败的那几套：先估算' }).first();
  const runBtn = page.locator('button', { hasText: '只补失败的那几套：开始跑' }).first();
  const checkbox = page.locator('label', { hasText: '我已看过补跑这一趟的预估' }).first();
  const estCount = await estBtn.count();
  const runCount = await runBtn.count();
  say(`[${tag}] estBtn=${estCount} disabled=${estCount ? await estBtn.isDisabled() : 'n/a'} ` +
      `runBtn=${runCount} disabled=${runCount ? await runBtn.isDisabled() : 'n/a'} ` +
      `checkbox=${await checkbox.count()}`);
  const blockLine = txt.split('\n').find(l => l.includes('只补这一轮里失败的那几套（成功的那几套一个字不动）'));
  say(`[${tag}] CHECK block_title=` + (blockLine !== undefined));
  // 补跑那一族的闸门句子只出自 rerunBlockedLine（BriefDetailView.vue:985）。
  // 上一版在这里 find('这一单现在是') 抓到的是「没有编辑按钮」那一句，判据挂错了格子。
  const rerunLines = txt.split('\n').filter(l => l.includes('补跑'));
  say(`[${tag}] RERUN_LINES ` + JSON.stringify(rerunLines.map(l => l.trim().slice(0, 190))));

  // 回收/失败原话：FoldedText 的那几折必须全部展开才看得到逐字原话。
  // 上一版只点了 .first()，结果点开的是「需求摘要」那一折，QUOTED 于是读到了空数组——
  // 那不是「句子里没引按钮名」，是我没展开对的那一折。这里按 header 文字逐折点。
  const folds = page.locator('.folded-text__fold .ant-collapse-header', { hasText: '逐字' });
  const foldCount = await folds.count();
  say(`[${tag}] FOLD_HEADERS 原话（逐字）=${foldCount}`);
  for (let i = 0; i < foldCount; i++) {
    const h = folds.nth(i);
    if ((await h.getAttribute('aria-expanded')) !== 'true') await h.click();
    await page.waitForTimeout(300);
  }
  if (foldCount) {
    txt = await page.locator('body').innerText();
    dump(`brief-${id}-${tag}-expanded.txt`, txt);
    const raw = await page.locator('.folded-text__raw').allInnerTexts();
    const sentence = raw.join('\n---\n');
    dump(`brief-${id}-${tag}-raw.txt`, sentence);
    say(`[${tag}] RAW_COUNT=${raw.length}`);
    say(`[${tag}] RAW ` + JSON.stringify(sentence.slice(0, 400)));
    // 只收「点「X」/按「X」」这一形：句子里的「」还会包住页名（「成功案例」）和简称（「重新发放」），
    // 那些不是按钮名，同页数不到属正常，混进来只会造出假红。
    const quoted = [...sentence.matchAll(/(?:点|按)「([^」]+)」/g)].map(m2 => m2[1]);
    say(`[${tag}] QUOTED ` + JSON.stringify(quoted));
    for (const nm of new Set(quoted)) {
      const n = await page.locator('button', { hasText: nm }).count();
      say(`[${tag}] CHECK button_named[${nm}]=${n > 0} (count=${n})`);
    }
    const singular = await page.locator('button', { hasText: '只补失败的那一套' }).count();
    say(`[${tag}] ANTI_VACUITY button_named[只补失败的那一套]=${singular}（这一格必须是 0，否则这条判据是空的）`);
    say(`[${tag}] ANTI_VACUITY button_named[只补失败的那几套]=` +
        await page.locator('button', { hasText: '只补失败的那几套' }).count());
    // M-P34 的核心语义要在界面上念出来：原地补那一套，不开新一轮
    const rerunNotice = txt.split('\n').find(l => l.includes('本次补跑') || l.includes('原地'));
    say(`[${tag}] CHECK rerun_notice_inplace=` + JSON.stringify((rerunNotice || '<none>').slice(0, 200)));
  } else {
    say(`[${tag}] CHECK folded_raw=FAIL 进度那一格里没有任何原话可展开`);
  }

  if (opts.click && estCount && clickEstimate && !(await estBtn.isDisabled())) {
    await estBtn.click();
    await page.waitForTimeout(6000);
    const after = await page.locator('body').innerText();
    dump(`brief-${id}-after-estimate.txt`, after);
    const tag2 = after.split('\n').find(l => l.includes('这张价签只算补跑这一趟'));
    say(`[${tag}] CHECK price_tag_alert=` + JSON.stringify((tag2 || '<none>').slice(0, 320)));
    const num = (tag2 || '').match(/[\d,]{5,}/g);
    say(`[${tag}] PRICE_TAG_NUMBERS ` + JSON.stringify(num));
    if (runCount && clickRun) {
      const rb = page.locator('button', { hasText: '只补失败的那几套：开始跑' }).first();
      say(`[${tag}] run_disabled_after_estimate=` + await rb.isDisabled());
      if (await checkbox.count()) await checkbox.click();
      await page.waitForTimeout(500);
      const rb2 = page.locator('button', { hasText: '只补失败的那几套：开始跑' }).first();
      if (!(await rb2.isDisabled())) {
        await rb2.click();
        await page.waitForTimeout(6000);
        const after2 = await page.locator('body').innerText();
        dump(`brief-${id}-after-run.txt`, after2);
        const rec = after2.split('\n').find(l => l.includes('补跑已受理'));
        say(`[${tag}] CHECK receipt=` + JSON.stringify((rec || '<none>').slice(0, 240)));
        const fail = after2.split('\n').find(l => l.includes('系统异常') || l.includes('失败：'));
        say(`[${tag}] RUN_ERROR_LINE ` + JSON.stringify((fail || '<none>').slice(0, 200)));
      } else say(`[${tag}] RUN_BUTTON_STILL_DISABLED`);
    }
  } else if (opts.click) {
    say(`[${tag}] CLICK_SKIPPED estBtn=${estCount} P7_CLICK_ESTIMATE=${clickEstimate}`);
  }
  return txt;
}

await briefPage(BRIEF, 'platform', { click: true });

// ---- 3b) 画廊腿：进度那一格的原话写的是「就在画廊点「重新发放」」，那颗按钮不在详情页在这一页
// （CandidateGalleryView.vue:327 的动词跟现状走：从没发过才是「发放预览地址」，发过才是「重新发放预览地址」）。
// 判据要分清两种「数不到」：这一套本来就还没发过（状态使然，不是缺陷）与这页根本没有这颗把手（缺陷）。
async function galleryLeg(id) {
  await page.goto(`${UI}/workspace/portal/brief/${id}/candidates`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(2500);
  const txt = await page.locator('body').innerText();
  dump(`gallery-${id}.txt`, txt);
  const texts = await page.locator('button').allInnerTexts();
  const preview = texts.map(t => t.trim().replace(/\s+/g, ' ')).filter(t => t.includes('发放'));
  say(`[gallery] brief=${id} url=${page.url()} buttons_total=${texts.length} preview_like=${JSON.stringify(preview)}`);
  const reissue = await page.locator('button', { hasText: '重新发放' }).count();
  const anyIssue = await page.locator('button', { hasText: '发放预览地址' }).count();
  say(`[gallery] CHECK button_named[重新发放]=${reissue > 0} (count=${reissue}) ` +
      `发放预览地址(count=${anyIssue})`);
  say(`[gallery] VERDICT ` + (reissue > 0 ? '原话点名的那颗按钮在真 DOM 里'
      : (anyIssue > 0 ? '这一套还没发过链接 ⇒ 按钮是「发放预览地址」那一形；原话的「重新发放」是它的重发态，不是缺把手'
          : 'FAIL 画廊里既没有发放也没有重新发放，这句原话指到了没有把手的页面')));
}
await galleryLeg(BRIEF);

// ---- 4) 向导里那句「去需求单详情页按只补失败的那几套」
await page.goto(`${UI}/workspace/portal/wizard?step=generate&briefId=${WIZ_BRIEF}`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => undefined);
await page.waitForTimeout(1500);
const wizText = await page.locator('body').innerText();
dump(`wizard-${WIZ_BRIEF}.txt`, wizText);
say('CHECK wizard_says_rerun_path=' + wizText.includes('只补这一轮里失败的那几套'));
say('CHECK wizard_no_old_false_claim=' + !wizText.includes('重跑只补失败的那一套'));
const wizHit = wizText.split('\n').find(l => l.includes('只补这一轮里失败的那几套'));
say('WIZARD_LINE ' + JSON.stringify((wizHit || '<none>').slice(0, 200)));

// ---- 5) 切进租户档（真实外壳把手：segmented + a-select），同一张详情页仍要摆出这一族把手
await setScope('租户');
{
  const dd = page.locator('.tenant-switcher');
  say('SWITCH select_found=' + await dd.count());
  await dd.click();
  await page.waitForTimeout(900);
  const opt = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
    { hasText: TENANT_NAME }).first();
  say('SWITCH option_found=' + await opt.count());
  if (await opt.count()) {
    await opt.click();
    await page.waitForTimeout(3000);
  }
  const chip = await page.locator('.tenant-switcher').innerText().catch(() => '<no text>');
  say('SWITCH chip=' + JSON.stringify(chip.trim().slice(0, 60)));
  say('CHECK switch_landed_on_name=' + chip.includes(TENANT_NAME));
}
const tm = await menuReadings('tenant');
dump('menu-tenant.json', JSON.stringify(tm, null, 1));
say('CHECK tenant_scope_hides_platform_section=' + !tm.items.includes('建站任务总览') +
    ' （机制=WorkspaceView.vue:300 isPlatformMode，不是权限判错；/auth/me 两档都回 SUPER_ADMIN）');
await briefPage(BRIEF, 'tenant', { click: false });

await browser.close();
dump('run.log', lines.join('\n') + '\n');
say('WROTE ' + OUT);
