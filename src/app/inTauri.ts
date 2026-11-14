/** 是否运行在 Tauri 壳内（浏览器预览为 false）：App 与 app/ 下组件共用。 */
export const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
