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
  },
  projects: [
    { name: 'api', testMatch: /journey-.*\.spec\.ts/ },
    { name: 'browser', testMatch: /screen-.*\.spec\.ts/ },
  ],
});
