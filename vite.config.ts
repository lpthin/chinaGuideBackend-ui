import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { APP_NAME } from './src/copy/brand'

/**
 * 浏览器标题的产品名只有一个出处（src/copy/brand.ts）。index.html 读不到 TS，
 * 所以这里在构建期把占位符换掉——别在 html 里再写一遍字面量，否则又是「两处要人工对齐」。
 */
const injectAppName = () => ({
  name: 'inject-app-name',
  transformIndexHtml: (html: string) => html.replaceAll('%APP_NAME%', APP_NAME)
})

export default defineConfig({
  plugins: [vue(), injectAppName()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 5190,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
