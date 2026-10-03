import { defineConfig } from '@playwright/test';

/**
 * Spec-K 的系统测试 runner（Q-3=3b）。
 * 与 `vitest.config.ts` 是两套：vitest 只管 `src` 下的组件级测试，这里跑真 HTTP + 真库 + 真浏览器。
 * API 旅程与浏览器旅程分两个 project，testMatch 不重叠，所以一把跑完，
 * 也不会被 vitest 的默认 spec 匹配捡到。
 */
export default defineConfig({
  testDir: './specs',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'out/results.json' }],
  ],
  outputDir: './out/artifacts',
  use: {
    ignoreHTTPSErrors: true,
    video: 'off',
    screenshot: 'only-on-failure',
    // 定位不到要当场失败，不许拿整条用例的预算等一个永远不出现的控件
    // （10-03 那一轮 10 分钟全烧在一个已改名的顶栏下拉上）。
    // 这两个必须写在 use 里：它们是 per-test 选项，放顶层 Playwright 认不出来、
    // 也不报错，直接当没配 —— 第一次把它放顶层时整条用例照样跑完，配置却是空的。
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'api', testMatch: /journey-.*\.spec\.ts/ },
    { name: 'browser', testMatch: /screen-.*\.spec\.ts/ },
  ],
});
