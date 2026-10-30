/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sitePages } from './site/plugin'

/**
 * AdSense needs an ads.txt at the domain root naming the publisher. Emit it
 * at build time from VITE_ADSENSE_CLIENT so it cannot drift from the config.
 */
function adsTxt(client: string | undefined): Plugin {
  const pub = client?.replace(/^ca-/, '').trim()
  return {
    name: 'ads-txt',
    apply: 'build',
    generateBundle() {
      if (!pub) return
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` })
    },
  }
}

/**
 * Google verifies site ownership by reading the raw HTML, so the AdSense
 * account meta tag and loader script go into <head> at build time rather than
 * being injected by the app. Only when a client ID is configured.
 */
function adsenseHead(client: string | undefined): Plugin {
  const id = client?.trim()
  return {
    name: 'adsense-head',
    apply: 'build',
    transformIndexHtml(html) {
      if (!id) return html
      return {
        html,
        tags: [
          { tag: 'meta', attrs: { name: 'google-adsense-account', content: id }, injectTo: 'head' },
          {
            tag: 'script',
            attrs: { async: true, src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${id}`, crossorigin: 'anonymous' },
            injectTo: 'head',
          },
        ],
      }
    },
  }
}

// Served from https://pintsplit.com/ (GitHub Pages with a custom domain, see public/CNAME).
// Set VITE_BASE=/split-the-g/ to serve from a github.io project path instead.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    adsTxt(env.VITE_ADSENSE_CLIENT),
    adsenseHead(env.VITE_ADSENSE_CLIENT),
    sitePages(env.VITE_ADSENSE_CLIENT),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Split The G',
        short_name: 'Split The G',
        description: 'Score your sip. See how close you came to splitting the G.',
        theme_color: '#0d0906',
        background_color: '#0d0906',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app itself falls back to index.html; /blog, /privacy and the rest are real pages.
        navigateFallbackAllowlist: [/^\/$/, /^\/index\.html$/],
        // keep the display font available offline once it has been seen
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  }
})
