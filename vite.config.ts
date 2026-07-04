import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(),
    // 让 /v2 开头的路由使用 index-v2.html 作为入口（v2后台）
    {
      name: 'v2-history-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || ''
          // /v2 开头的路由（非 /api、非静态资源）回退到 index-v2.html
          if (url.startsWith('/v2') && !url.includes('.') && !url.startsWith('/api/')) {
            req.url = '/index-v2.html'
          }
          next()
        })
      }
    }
  ],
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
