// P9-E / N-P9d-3 现场真点：费用页（用量监控）那一块「本月额度」下面新加的口径说明，
// 要在浏览器里看得见，而不是只活在 vitest 的 stub 里。
// 判据：① 选中租户后 .pool-note 至少有两段，其中一段点名「不是同一本账」并带上那格「总费用」；
//       ② 这一段是在屏幕上的（innerText 非空、有高度），不是挂着但没渲染；
//       ③ 这一页控制台没有新报错（consoleErrors 原样打印）。
// 用法：node scratch/p9e-ui-poolnote.mjs   （需要 Vite 5190 与后端 8080 都在）
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const UI = 'http://localhost:5190';
const OUT_DIR = 'E:/qoder/docs/evidence/system-2026-10-06/p9e';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('用户名').fill('admin');
await page.getByPlaceholder('密码').fill('admin123');
await page.locator('.login-button').click();
await page.waitForURL(/\/workspace/, { timeout: 30_000 });

// 站进某一家：两池那块只在选择租户后出现（全租户视角把各家水位相加是假上限，产品刻意不念）
await page.locator('[data-test="scope-mode"] .ant-segmented-item', { hasText: '租户' }).first().click();
await page.waitForTimeout(2000);
await page.locator('.tenant-switcher .ant-select-selector').click();
await page.waitForTimeout(800);
await page.locator('.ant-select-dropdown .ant-select-item-option').first().click();
await page.waitForTimeout(2500);
const ls = await page.evaluate(() => ({
  id: localStorage.getItem('selected_tenant_id'), code: localStorage.getItem('selected_tenant_code'),
}));
console.log('选中的租户', JSON.stringify(ls));

await page.goto(`${UI}/workspace/ai/usage`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => undefined);
await page.waitForTimeout(2000);

const notes = await page.locator('.pool-note').evaluateAll(ns => ns.map(n => ({
  text: (n.innerText || '').replace(/\s+/g, ' ').trim(),
  visible: !!(n.offsetParent) && n.getBoundingClientRect().height > 0,
  height: Math.round(n.getBoundingClientRect().height),
})));
const cards = await page.locator('.ant-card-head-title').evaluateAll(cs => cs.map(c => c.textContent?.trim()));
const totalFee = await page.locator('.stat-title').evaluateAll(ts => ts.map(t => t.textContent?.trim()));
await page.screenshot({ path: `${OUT_DIR}/N-P9d3-pool-note.png`, fullPage: false });

const report = { 选中租户: ls, 卡片标题: cards, 统计格标题: totalFee, poolNotes: notes, consoleErrors };
fs.writeFileSync(`${OUT_DIR}/N-P9d3-ui-check.json`, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

const target = notes.find(n => n.text.includes('不是同一本账'));
console.log('判定：',
  '有这一段=' + !!target,
  '看得见=' + !!target?.visible,
  '点了总费用那格=' + !!target?.text.includes('总费用'),
  'consoleErrors=' + consoleErrors.length);
await browser.close();
