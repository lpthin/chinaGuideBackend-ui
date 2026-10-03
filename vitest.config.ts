import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    // 系统测试（Spec-K）走 @playwright/test：它要 E2E_RUN_ID、打真后端真库，
    // 被 vitest 的默认 include 捡到就是「两个 runner 抢同一批文件」—— 实测 2 档在 vitest 里直接收集失败。
    exclude: ['**/node_modules/**', '**/dist/**', 'systemtest/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
