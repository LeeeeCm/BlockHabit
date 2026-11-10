/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  test: {
    environment: 'jsdom',
    // 历轮验证脚本放在本地 .tmp-* 证据目录（已被 .gitignore 忽略），不是源码测试。
    // Vitest 默认 include 会把它们扫进来（曾使 npm test 混入 2 个非源码文件），
    // 这里在默认 exclude 之外整体排除本地临时目录，保证 npm test 只跑源码测试。
    exclude: [...configDefaults.exclude, '**/.tmp-*/**']
  },

  // 生产构建的分包策略（D-20261110-040）：
  // 主 chunk 曾达 497 kB，逼近 Vite 的 500 kB 告警线。桌面端虽从本地读文件，
  // 但把「框架 / 平台桥 / 状态库」拆成稳定 chunk 后，升级应用代码不会让用户重下整包。
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler'))
            return 'react'
          if (id.includes('@tauri-apps')) return 'tauri'
          if (id.includes('zustand')) return 'state'
          return undefined
        }
      }
    }
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**']
    }
  }
}))
