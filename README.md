# BlockHabit

> **Turn consistency into a building you can see.** A minimal black-and-white desktop habit tracker: every valid check-in drops a 2.5D isometric brick, and the bricks assemble a blueprint piece by piece.

<p align="center">
  <img src="src/assets/logo.svg" width="88" alt="BlockHabit logo" />
</p>

<p align="center"><sub><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></sub></p>

<p align="center">
  <a href="https://github.com/LeeeeCm/BlockHabit/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/LeeeeCm/BlockHabit/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-111111" /></a>
  <img alt="Windows" src="https://img.shields.io/badge/platform-Windows%2010%2F11-111111" />
  <img alt="macOS" src="https://img.shields.io/badge/macOS-experimental-111111" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-111111" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-111111" />
</p>

BlockHabit is a **local-first, account-free, telemetry-free** desktop habit app for Windows, with an experimental macOS build. It does not turn consistency into a score or another to-do list; it turns each day into a brick: **check in → drop a brick → the building grows**. A transparent brick pet also lives on your desktop, keeping you company with short hops, idle animations, and check-in bubbles.

---

## Contents

- [Why BlockHabit](#why-blockhabit)
- [Features](#features)
  - [1. Habits & check-ins](#1-habits--check-ins)
  - [2. Bricks, blueprints & buildings](#2-bricks-blueprints--buildings)
  - [3. Desktop pet](#3-desktop-pet)
  - [4. Today / Build / Showcase / Stats](#4-today--build--showcase--stats)
  - [5. Reminders, focus & evening wrap-up](#5-reminders-focus--evening-wrap-up)
  - [6. Data, sync & backup](#6-data-sync--backup)
  - [7. Settings, themes & accessibility](#7-settings-themes--accessibility)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Common commands](#common-commands)
- [Quality gates & tests](#quality-gates--tests)
- [Build & release](#build--release)
- [Data location & version gate](#data-location--version-gate)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Design system & collaboration rules](#design-system--collaboration-rules)
- [FAQ](#faq)
- [Known limitations](#known-limitations)
- [License](#license)

---

## Why BlockHabit

- **Consistency you can see**: Beyond streaks and heatmaps, there is an isometric brick building that actually grows.
- **It never checks in for you**: Reminders, focus bubbles, and pet interactions only write after you confirm. No auto-completion, no fake progress.
- **Local-first**: Your data stays on your own machine. No account, no cloud dependency, no telemetry upload.
- **Restrained visuals**: Black, white, and gray as the bones; one theme accent as the soul. Rounded bricks, 1px lines, four themes.
- **Memories you can take with you**: JSON saves, monthly posters, completion yearbooks, building archives, polaroids, and full archive packages, all generated locally.

## Features

### 1. Habits & check-ins

- **Three habit kinds**
  - `instant`: one click to complete.
  - `focus`: a focus timer; when it ends, you confirm the brick. You can extend by 5 minutes (up to twice) or give up.
  - `counter`: accumulate a quantity, such as 250 ml of water or 20 pages read; each step records one configured increment.
- **Three frequencies**: daily, N times per week, or custom weekdays. Weekly cards show this week's completed/target count; today's check-in counts immediately. Rest days never create a false "missed" state.
- **Single source of truth**: whether a habit is met is decided only by `habitMetOnDay`. Weekly quotas, counter targets, and rest-day exemptions are covered by pure-logic unit tests.
- **Safe undo**: Undoing a check-in requires confirmation. Check-ins are tombstoned, so an old device cannot resurrect them during sync.
- **Repair bricks**: Missed dates can be repaired with repair bricks. Every 30 days of streak grants an extra repair brick; the monthly allowance and streak rewards are independent.
- **Categories, pinning, archive, notes & moods**: The Today page groups habits by time of day and supports category filters, check-in notes, micro-mood capsules, and starred inscriptions.
- **Templates**: The first-run empty state offers one-tap templates for water, reading, walking, early sleep, and expense logging; they create real habits.
- **Import**: Import a full save, or import habit definitions from CSV/JSON after a preview and validation step.

### 2. Bricks, blueprints & buildings

- **Valid check-in, one brick**: Every valid check-in drops a brick. Every 7 days of streak, the next brick carries a theme-accent outline.
- **35 isometric models**

  | Content pack | Count | Blocks |
  |---|---|---:|---:|
  | Base buildings (v1) | 12 | 1385 |
  | City & Life (v2) | 6 | 600 |
  | City & Life, continued (v3) | 5 | 500 |
  | City & Life III (v6) | 12 | 1196 |
  | **Total** | **35** | **3681** |

- **Main-line unlock order**: 35 buildings progress in order.
- **Build view**: Canvas 2D rounded bricks, top studs, three-face shading, contact shadows, and a dashed foundation. Zoom, pan, and reset the camera.
- **Drop animation**: Slow fall → squash on impact → rebound. A one-shot ceremony plays when a building is completed.
- **Gallery**: One building grid with real-time isometric thumbnails. Locked entries use silhouettes, while in-progress entries show only the currently placed bricks, centered, without an overlaid ghost or a white backing plate.
- **Showcase**: Place completed buildings on a 26×26 sandbox with drag, rotation, multiple sandboxes, a yard, and base color themes.
- **Long-term records**: Completion ceremonies, foundation inscriptions, building archives (key brick timeline / notes / moods), polaroids, monthly posters, and completion yearbooks.
- **Data honesty**: Deleting data cascades to bricks, streaks, and all-clear rewards. Undo never leaves a "visual completion" behind.

### 3. Desktop pet

The pet is a separate transparent, always-on-top window (**96×128**) tightened to the character's silhouette, with room for hops and bubbles, so it does not cover the apps below with a large transparent area:

- **Brick character**: A single rounded brick with one top stud and a simple face. Pet blueprints and the cat / robot forms were removed; old pet-blueprint bricks migrate into your current unfinished building.
- **DIY colors**: Follow the theme, or choose from 11 approved material colors drawn from the D-067 palette. Arbitrary hex values are not accepted, preserving theme discipline.
- **Free movement**: Mostly idle, with occasional looks around, stretches, and small hops. When roaming, it hops in its facing direction and turns at screen edges. The cadence is intentionally slow, so it does not pace back and forth constantly.
- **Size switching**: Small / medium / large scale only the character; the **feet stay anchored**.
- **Independent right-click panel**: Opens a separate transparent `pet-menu` window (236×252) beside the pet, preferring the right side and flipping to the left when out of bounds. The pet pauses while the panel is open and resumes when it closes. The panel and the settings page share the same size / roaming state.
- **Interaction**: Drag to move; double-click to open the main window; right-click for the panel. Clicks do not make it jump, avoiding accidental triggers.
- **Check-in sync**: The main window syncs today's completion count via `pet-config`. When the count increases, the pet hops once and shows a brief bubble; it never writes a check-in automatically.
- **Position**: Stored only on the local device and clamped to the current monitor's work area; never enters the synced save.

### 4. Today / Build / Showcase / Stats

All four pages share the same top-bar spec: 64px tall, 14×20 padding, 16px title, 12px description.

- **Today**: Date and weekday, current blueprint progress, today's completion count; greeting brief, focus entry, reminder banner, habit groups, category filters, check-in notes, and archive.
- **Build**: Model canvas, progress, gallery, X-ray archaeology, camera reset, foundation inscription, polaroid, and completion ceremony.
- **Showcase**: Multi-sandbox display with drag arrangement, rotation, a yard, base color themes, and display count; auto-arrange.
- **Stats**: Current / best streak, total check-ins, 13-week heatmap, check-in note journal, memorabilia center, repair bricks, monthly posters, and completion yearbook.

### 5. Reminders, focus & evening wrap-up

- **Habit reminders**: Reminders by start/end time; a due-soon reminder 30 minutes before the deadline; snooze for 10 minutes, up to 3 times; "skip today" silences it for the day.
- **Focus sessions**: Stored as absolute time, so hiding or reopening the app does not pause them. When time is up, the session enters "awaiting confirmation"; the brick drops only after you confirm. It never auto-completes.
- **Evening wrap-up**: After your first check-in, you can opt into a once-a-day wrap-up reminder. It only says how many items remain and does not judge you.
- **System notifications**: Native notifications while the app is running (including when the window is hidden or in the tray). No reminders after the app fully exits.

### 6. Data, sync & backup

- **Local storage**: The desktop app writes to Tauri's `appDataDir/blockhabit.json`; the browser falls back to localStorage. No account, no telemetry.
- **Full save import/export**: JSON, strictly validated before import; overwriting imports create an automatic backup first.
- **Habit definition import**: CSV/JSON preview, then confirm; existing habits are not overwritten directly.
- **Backups**: Automatic backup before overwriting imports (5 kept); manual snapshots kept separately (5 kept); the settings page can inspect, restore, and open the data folder.
- **WebDAV sync**: Optional, never the main path. Supports automatic and manual sync. Check-in tombstones prevent an old device from resurrecting undone check-ins.
- **Password security**: On desktop, "remember password" uses the OS credential manager (Windows Credential Manager); no plaintext is stored in settings or the save. Turning it off deletes the existing entry.
- **Content version gate**: `contentVersion = 6`. Older clients refuse to read newer data and suspend saving instead of silently cleaning unknown data.
- **Upgrade safety**: This build keeps `schemaVersion = 2` and `contentVersion = 6`, and keeps the `com.blockhabit.app` identifier. Installing the update preserves the local save in `appDataDir`; older saves (including 0.2.3 and pet-blueprint saves) load and migrate.

### 7. Settings, themes & accessibility

Settings use 5 collapsible groups to reduce noise:

1. **General**: theme, language, sound, reminders, system integration, shortcuts.
2. **Pet**: show/hide, size, material color, free roaming.
3. **Data & sync**: export/import, full archive package, backups, WebDAV.
4. **Content roadmap** (About): built-in content counts, version check, and update notes.
5. **Lab**: time-of-day lighting, gentle decay, X-ray archaeology, sound material, gyroscope, and other experimental switches.

- **Four themes**: Paper White, Ink Black, Oat Terracotta, Nordic Fog. Themes only change the neutral scale and the single theme accent.
- **Bilingual**: Full Chinese / English coverage; every user-visible string goes through `src/i18n/`.
- **Accessibility**: Keyboard focus, ARIA names, reduced motion, and touch targets (experimental mobile path) are implemented and tested.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript + Vite |
| State | zustand |
| Rendering | Hand-written Canvas 2D isometric renderer (no 3D engine) |
| Testing | Vitest + jsdom |
| Storage | StorageAdapter abstraction over Tauri fs / localStorage |
| Sync | WebDAV (optional) |
| Release | GitHub Actions + Tauri installers + minisign |

## Repository layout

```text
src/
├─ logic/            Pure logic: check-in rules, streaks, blueprints, repair bricks, focus state machine, import
│  └─ blueprints/    Procedural geometry and content-version manifest for 35 models
├─ render/           Isometric projection, three-face brick shading, build/showcase scenes, export canvases
├─ pet/              Separate transparent pet window and right-click panel
├─ platform/         Windows, notifications, shortcuts, storage adapters, pet positioning
├─ storage/          Save load/migration/version gate, backups, archive packages
├─ store/            zustand global state + debounced persistence + sync merge
├─ sync/             WebDAV sync controller and merge strategy
├─ pages/            Today / Build / Showcase / Stats (including subviews)
├─ components/       Icons, forms, gallery, dialogs, heatmap, memorabilia center
├─ i18n/             Chinese/English schema and strings
├─ theme.css         Four-theme design tokens
└─ assets/           Logo and local brand assets

src-tauri/           Rust desktop shell, tray, window commands, capability config
design/              Design hub: axioms, tokens, art, surfaces, voice, append-only design records
docs/superpowers/    Historical specs and implementation plans (read-only snapshots)
docs/release/        Release runbook, real-device acceptance, candidate reports
scripts/             design:check / check:versions / release:check
```

## Getting started

### Requirements

- **Windows 10 / 11** (the official desktop target)
- **macOS** (experimental unsigned universal build; no official support yet)
- **Node.js 22+** and npm
- **Rust stable** and **Visual Studio Build Tools (MSVC / Windows SDK)**
- WebView2 (usually included with Windows 11)

```powershell
git clone https://github.com/LeeeeCm/BlockHabit.git
cd BlockHabit
npm ci
```

### Browser preview

```powershell
npm run dev
# http://localhost:1420
```

The browser preview is good for UI and interaction work. WebDAV, native notifications, the tray, and the transparent pet window require the desktop build.

### Desktop development

```powershell
npm run tauri dev
```

The first Rust build takes about 3–10 minutes. On Git Bash, if `cargo` picks up coreutils' `link`, put the MSVC `link.exe` directory first in PATH:

```bash
export PATH="/c/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/<ver>/bin/Hostx64/x64:$HOME/.cargo/bin:$PATH"
```

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite browser preview (port 1420) |
| `npm run tauri dev` | Start the Tauri desktop window |
| `npm test` | Full Vitest unit / component suite |
| `npx tsc --noEmit` | TypeScript type check |
| `npm run build` | Type check + production frontend build |
| `npm run tauri build` | Build the Windows installer (`src-tauri/target/release/bundle/`) |
| `npm run design:check` | Design ledger consistency + unapproved deletion detection |
| `npm run check:versions` | Build version consistency across three files (CI gate) |
| `npm run format:check` | Prettier format check |
| `npm run release:check` | Release artifact and tag self-check |

## Quality gates & tests

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every PR:

1. `npm run check:versions`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run design:check`
5. `npm run format:check`
6. `npm run build`

Before committing locally, run at least:

```powershell
npx tsc --noEmit
npm test
npm run design:check
```

Pure logic (`src/logic/**`) must be covered by Vitest. For bug fixes, write a failing test first, then fix it; never make the pipeline green by changing tests.

## Build & release

```powershell
npm run tauri build
```

Outputs:

- Executable: `src-tauri/target/release/blockhabit.exe`
- Installers / portable bundles: `src-tauri/target/release/bundle/`
- Release flow: `.github/workflows/release.yml` (manual trigger; the version must match `package.json` / `tauri.conf.json` / `Cargo.toml`)
- macOS experimental build: `.github/workflows/release-macos.yml` builds an unsigned universal DMG and publishes it as a pre-release (`vX.Y.Z-macos`), so the Windows `latest.json` updater channel stays intact

The release pipeline uses GitHub Releases + minisign signatures. Update checks are **manual**: no automatic check on startup, no background polling, no silent download. The signing private key lives only in CI secrets and is never committed.

## Data location & version gate

- **Desktop**: `%APPDATA%\com.blockhabit.app\blockhabit.json`
- **macOS**: `~/Library/Application Support/com.blockhabit.app/blockhabit.json`
- **Browser preview**: localStorage
- **Backups**: automatic backups / manual snapshots in the same directory; the settings page can open the data folder
- **Archive package**: README + manifest + data JSON + checksums + transparent images of completed buildings; WebDAV credentials are never included
- **Sync conflicts**: check-in tombstones, completion recalculation, and field-level merge are authoritative; do not overwrite newer content from an old device
- **Upgrades keep your data**: this build keeps `schemaVersion = 2` and `contentVersion = 6`; installing over an existing app does not remove the local save in `appDataDir`, and older saves load and migrate
- **Content version**: `contentVersion = 6`. An older client refuses to load a newer version and suspends saving, preventing silent cleanup of unknown blueprints

## Keyboard shortcuts

- `1` / `2` / `3` / `4`: switch between Today / Build / Showcase / Stats (disabled while an input is focused or a dialog is open)
- `Ctrl/Cmd + N`: create a habit
- `Esc`: close the current dialog
- `Ctrl/Cmd + Enter`: confirm inside editing dialogs such as foundation inscriptions and building archives
- `Ctrl + Alt + H`: globally summon BlockHabit and return to Today (off by default; enable it in Settings; may conflict with other apps)

## Design system & collaboration rules

**The single design entry point is [`design/README.md`](design/README.md).** Before changing any user-visible color, font, radius, spacing, icon, layout, motion, copy, building data, or brand asset, read the design axioms and the relevant specification first.

- **Design axioms**: black/white/gray as the bones, one theme accent, everything is a rounded brick, 2.5D isometric, 1px lines, physical-feeling motion, data honesty, local-first.
- **Record before code**: create a design record in `design/records/` (`status: proposed`) before implementing; implement only after review.
- **Append-only records**: no file, section, or record under `design/` may be deleted. Retire with `deprecated` / `superseded`; physical deletion must go through `design/APPROVALS.md`.
- **Engineering rules**: see [`AGENTS.md`](AGENTS.md). Do not introduce UI component libraries, fake data, or bypass verification scripts.
- **Self-check**: `npm run design:check` validates ledger consistency, the status machine, and unapproved deletions.

### Historical specs (read-only snapshots)

- `docs/superpowers/specs/2026-08-22-blockhabit-design.md`
- `docs/superpowers/plans/2026-08-22-blockhabit.md`
- `docs/superpowers/specs/2026-09-30-blockhabit-optimization-design.md`
- `docs/superpowers/specs/2026-10-03-blockhabit-ux-review-fixes.md`
- `docs/superpowers/specs/2026-11-10-blockhabit-design-hub-design.md`
- `docs/release/release-runbook.md` / `docs/release/real-device-acceptance.md`

## FAQ

### WebDAV fails in the browser preview?

Browsers enforce cross-origin restrictions, and services such as Nextcloud usually do not return the required CORS headers. The settings page explicitly tells you to retry on desktop, where BlockHabit uses Tauri's native HTTP channel.

### Why are there no reminders after the app exits?

Reminders depend on the app process being alive; they do not wake a fully exited app. Enabling launch at startup can mitigate this.

### Why did no new brick drop after a check-in?

The content limit may be reached, the current blueprint may already be complete, or the check-in may be a duplicate / weekly quota full. The app gives explicit feedback instead of silently swallowing it.

### Why is the pet not visible?

The pet is enabled by default. If it was hidden, re-enable it in Settings → Pet. On first launch, if the window is not ready yet, the app automatically retries showing it.

### Where did the pet blueprints go?

Pet blueprints were removed so the gallery only contains buildings. Any bricks you had already placed in a pet blueprint are migrated into the building you were working on when the save is opened; the completion list and showcase no longer contain pet entries.

## Known limitations

- **Mobile is experimental**: Responsive layout and touch gestures are kept, but there is no official build target and no ongoing development.
- **macOS is experimental**: the unsigned universal build is published as a pre-release; it has no code signing / notarization and has not gone through the same real-device acceptance as Windows. The in-app updater is disabled there until a macOS update channel exists.
- **Windows shutdown / sign-out does not guarantee the last debounced settings write**: Critical actions (check-in / undo / claim / import) flush immediately; non-critical settings may lose the debounce window.
- **Reminders depend on a running process**: No reminders after the app exits.
- **No automatic updates**: Update checks are manual and require user confirmation.
- **Content limit**: 35 blueprints, 3681 blocks total; once everything is built, no new bricks drop. The app says so explicitly instead of failing silently.
- **Limited browser preview**: WebDAV, native notifications, the tray, the transparent pet window, and window dragging are fully available only on desktop.

## License

[MIT](LICENSE)
