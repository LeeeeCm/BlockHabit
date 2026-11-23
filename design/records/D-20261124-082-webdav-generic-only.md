---
id: D-20261124-082
date: 2026-11-24
title: WebDAV 同步只保留通用模式：移除 Nextcloud / 坚果云 / 群晖预设
status: proposed
owner: lead
surface: [settings]
axioms: [A1, A4]
files: [src/components/WebdavPanel.tsx, src/sync/providers.ts, src/components/SettingsPanels.test.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/webdav.ts]
supersedes: [D-20261110-061]
reviewer: pending
---

## 背景与问题

设置页 WebDAV 区提供 Nextcloud / 坚果云 / 群晖 / 通用四个预设，并自动拼接各家的
`/remote.php/dav/files/<user>/BlockHabit/`、固定 `dav.jianguoyun.com`、`/home/BlockHabit/` 路径。
用户反馈「不要有那么多默认供应商，统一用通用模式」：

- 多数用户只需要填一个完整的 WebDAV 集合地址；预设反而要求先选服务商、再理解路径拼接规则；
- 坚果云固定端点让地址框变为只读，切换服务商还会清空/重建地址，行为不直观；
- 预设识别依赖 endpoint 字符串/ host 推断（D-20261115-079 曾为 CodeQL 修正 host 解析），
  维护成本与攻击面都高于收益。

## 设计决定

1. **移除服务商选择 UI**：不再渲染四个预设按钮、`providerLabel` 与 2FA 专用密码提示。
2. **地址框始终可编辑**：用户直接填写完整 WebDAV 集合 URL（如
   `https://cloud.example.com/remote.php/dav/files/alice/BlockHabit/`）；协议补全、尾斜杠与文件名
   拼接仍由 `getSyncUrl` / 诊断的 `normalizeCollectionUrl` 负责，行为不变。
3. **删除 `src/sync/providers.ts`**：`ProviderId` / `PROVIDER_PRESETS` / `buildEndpoint` /
   `switchProvider` / 预设路径常量与 `normalizeServerBase` 一并移除；`WebdavPanel` 内的
   `endpointHost` / `isJianguoyunEndpoint` / `detectProvider` / `baseFromEndpoint` 同步删除。
   D-20261115-079 的 host 解析修复随功能移除而失效（问题不存在了，不是回退安全修复）。
4. **不迁移、不清空已有配置**：endpoint 一直以完整 URL 存档；老用户的 Nextcloud/坚果云/群晖地址
   继续原样同步。设置页打开时直接显示该地址，用户可自行修改。
5. **保留分步自检、自动同步、凭据保管、记住密码等全部能力**；仅去掉「服务商」这一层抽象。

## 取舍与被否方案

- 否决「保留一个只读的通用预设」：当前通用预设的 `buildEndpoint` 只是补斜杠，而 `getSyncUrl`
  已经处理；再留一个按钮没有信息量。
- 否决「保留 2FA 专用密码提示」：它只对 Nextcloud/坚果云成立，通用模式无法判断服务商；
  若需要，用户可在密码框旁自行使用应用专用密码。去掉提示符合「能删就删」。
- 否决「迁移旧 endpoint 到通用 base 并重新拼接」：会改写用户已保存的完整 URL，且可能改变
  实际同步目录；保持原值最安全。
- 保留 `serverUrl` 标签与占位 `https://dav.example.com/sync/`：地址仍是唯一必填项。

## 影响面

- 代码：`WebdavPanel` 删状态/分支约 40 行；`src/sync/providers.ts` 及其两个测试文件删除；
  i18n 删除 6 个键（三处对齐）。
- 数据：无 schema/存储键变化；已有 endpoint 不变。
- 文档：SURFACES §9.4 追加说明；CHANGELOG Unreleased；完成文档追加「WebDAV 通用模式」。
- 需要人工走查：设置页 WebDAV 组的视觉密度、地址框可编辑、测试连接/同步路径。

## 验收标准

- `npx tsc --noEmit`、`npm test`、`npm run format:check`、`npm run design:check`、`npm run build` 全绿。
- 设置页只显示「WebDAV 地址 / 用户名 / 密码」，无服务商按钮、无「服务商」标签、地址框非只读。
- 输入完整 URL 能写入配置并被 `测试连接` / `立即同步` 使用；旧配置的 endpoint 原样显示。

## 变更履历

- 2026-11-24 created (lead)
