import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt', injectRegister: false,
    devOptions: { enabled: false },
    manifest: {
      id: '/', name: '私人书架', short_name: '私人书架', description: '记录阅读，也收藏时间。',
      lang: 'zh-CN', start_url: '/', scope: '/', display: 'standalone',
      background_color: '#F4F0E8', theme_color: '#F4F0E8',
      icons: [
        { src: '/icons/reading-shelf-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/reading-shelf-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/reading-shelf-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/reading-shelf-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    includeAssets: ['icons/reading-shelf-{192,512}.png', 'icons/reading-shelf-maskable-{192,512}.png', 'icons/apple-touch-icon-180.png', 'icons/favicon-32.png', 'icons/favicon.ico'],
    workbox: {
      cacheId: 'reading-shelf', skipWaiting: false, clientsClaim: true,
      cleanupOutdatedCaches: true,
      globPatterns: ['index.html', 'assets/*.{js,css}', 'fonts/*.woff2'],
      navigateFallback: 'index.html', navigateFallbackAllowlist: [/^\/(?:index\.html)?$/],
      runtimeCaching: [],
      // Ignore no query parameters: private URLs cannot match an app-shell asset.
      ignoreURLParametersMatching: [],
    },
  })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
})
