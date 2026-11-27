/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

import fs from 'node:fs'
import path from 'node:path'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

/**
 * 更新通道是否已在配置里就绪（D-20261126-120）。
 *
 * 改前：前端只看构建期环境变量 `VITE_UPDATER_ENABLED=1`，而本机 `npm run tauri build`
 * 从不设置它 —— 于是公钥与 latest.json 端点其实都配好了，设置页却一直显示「更新未启用」。
 * 改后：直接读 `src-tauri/tauri.conf.json` 的 `plugins.updater`，公钥与端点都非空即视为就绪，
 * 环境变量仍然可用作显式开关（CI 里设 1 也照旧工作）。
 */
function updaterConfigured(): boolean {
  try {
    // @ts-expect-error node:path / node:fs 在构建期可用
    const conf = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')
    )
    const updater = conf?.plugins?.updater
    const pubkey = typeof updater?.pubkey === 'string' ? updater.pubkey.trim() : ''
    const endpoints = Array.isArray(updater?.endpoints) ? updater.endpoints : []
    return pubkey.length > 0 && endpoints.length > 0
  } catch {
    return false
  }
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  define: {
    __BH_UPDATER_CONFIGURED__: JSON.stringify(updaterConfigured())
  },

  test: {
    environment: 'jsdom',
    // 历轮验证脚本放在本地 .tmp-* 证据目录（已被 .gitignore 忽略），不是源码测试。
    // Vitest 默认 include 会把它们扫进来（曾使 npm test 混入 2 个非源码文件），
    // 这里在默认 exclude 之外整体排除本地临时目录，保证 npm test 只跑源码测试。
    // .claude/worktrees 同理：它是本地并行 worktree（.gitignore 忽略），各自带一份
    // node_modules；被扫进来时会出现两份 React 实例，整批组件测试假失败。
    exclude: [...configDefaults.exclude, '**/.tmp-*/**', '**/.claude/**']
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
