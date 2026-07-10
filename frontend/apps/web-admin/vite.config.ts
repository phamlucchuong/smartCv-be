import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import path from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

function copyFirebaseCompatPlugin() {
  return {
    name: 'copy-firebase-compat',
    buildStart() {
      const firebaseDir = path.resolve(__dirname, 'node_modules/firebase')
      const destDir = path.resolve(__dirname, 'public/firebase')
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
      for (const file of ['firebase-app-compat.js', 'firebase-messaging-compat.js']) {
        copyFileSync(path.join(firebaseDir, file), path.join(destDir, file))
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '../../')
  const env = loadEnv(mode, envDir, '')
  const packagesDir = path.resolve(__dirname, '../../packages')

  return {
    envDir,
    plugins: [
      TanStackRouterVite(),
      react(),
      tailwindcss(),
      copyFirebaseCompatPlugin(),
      {
        name: 'watch-workspace-packages',
        configureServer(server) {
          server.watcher.add(packagesDir)
        },
      },
    ],
    define: {
      __SMART_CV_API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL || 'http://localhost:8080'),
    },
    optimizeDeps: {
      exclude: ['@smart-cv/api', '@smart-cv/ui', '@smart-cv/i18n'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: '../../test/setup.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: '../../coverage/web-admin',
        include: ['src/store/**/*.ts'],
      },
    },
    server: {
      port: Number(env.VITE_WEB_ADMIN_PORT) || 3002,
    },
  }
})
