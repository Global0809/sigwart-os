import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// SPECTER build config. PWA service worker is built for production only; the dev
// server keeps it disabled so the verification loop never fights a stale cache.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,jpg,png}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'BIOSPHERE // Environmental Lattice',
        short_name: 'BIOSPHERE',
        description: 'A living organism visualizing real local air quality, weather and pollen.',
        theme_color: '#02040a',
        background_color: '#02040a',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  worker: { format: 'es' },
  build: { target: 'esnext', chunkSizeWarningLimit: 1600 },
})
