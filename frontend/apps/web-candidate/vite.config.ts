import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

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

// https://vite.dev/config/
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
      // Workspace packages live outside this app's root; add them to the watcher
      // so HMR fires after `git merge` modifies files in packages/
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
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: '../../test/setup.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: '../../coverage/web-candidate',
        include: ['src/store/**/*.ts', 'src/routes/**/*.tsx', 'src/components/layouts/**/*.tsx'],
      },
    },
    server: {
      port: Number(env.VITE_WEB_CANDIDATE_PORT) || 3000,
      // proxy: {
      //   '^.*$': {
      //     target: 'http://localhost:8080',
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (path) => path.replace(/^.*$/, (path) => path.replace(/\\\//g, '/')), // Fix backslashes
      //     configure: (proxy) => {
      //       proxy.on('error', (err) => {
      //         console.log('Proxy error:', err);
      //       });
      //     }
      //   },
      // },
    },
  }
})
