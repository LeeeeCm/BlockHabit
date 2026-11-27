/// <reference types="vite/client" />

/**
 * 构建期注入：`tauri.conf.json` 的 `plugins.updater` 是否已配好公钥与端点（D-20261126-120）。
 * 由 vite.config.ts 的 `define` 提供，值为布尔字面量。
 */
declare const __BH_UPDATER_CONFIGURED__: boolean
