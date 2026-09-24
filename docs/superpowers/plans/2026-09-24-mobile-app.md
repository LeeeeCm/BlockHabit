# BlockHabit 移动端 (iOS & Android) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 BlockHabit 打造同时支持 iOS 与 Android 的高品质极简移动端版本，复用现有 React 19 + 2.5D Canvas 架构，实现多点触控手势、底部导航栏、底部抽屉、原生触觉反馈以及 WebDAV 多端双向数据同步。

**Architecture:** 采用单代码库平台自适应方案，通过 `src/platform/` 抽象层统一感知平台环境与能力。布局层面适配移动端无边框全屏与 Safe Area，引入包豪斯毛玻璃底部导航（Bottom TabBar）与全场景底部抽屉（BottomSheet）。画布层面增加单指平移惯性、双指捏合缩放与旋转触控引擎。数据层面接入 Local-First + WebDAV CRDT 并集同步。

**Tech Stack:** Tauri v2 Mobile, React 19, TypeScript, Zustand, HTML5 Canvas 2D, Vitest, WebDAV API

---

### Task 1: 平台环境抽象层 (Platform Detection & Capabilities)

**Files:**
- Create: `src/platform/index.ts`
- Create: `src/platform/usePlatform.ts`
- Create: `src/platform/haptics.ts`
- Test: `src/platform/platform.test.ts`

- [ ] **Step 1: 编写平台检测与触觉反馈单元测试**

```ts
// src/platform/platform.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectPlatform, triggerHaptic } from './index'

describe('Platform detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detects desktop environment by default when window width is large', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    expect(detectPlatform()).toBe('desktop')
  })

  it('detects mobile when userAgent indicates mobile device or narrow viewport with touch', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
    Object.defineProperty(navigator, 'maxTouchPoints', { writable: true, configurable: true, value: 5 })
    expect(detectPlatform()).toBe('mobile')
  })
})

describe('Haptics trigger', () => {
  it('calls navigator.vibrate when available', () => {
    const vibrateSpy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { writable: true, configurable: true, value: vibrateSpy })
    triggerHaptic('light')
    expect(vibrateSpy).toHaveBeenCalledWith(10)
    triggerHaptic('medium')
    expect(vibrateSpy).toHaveBeenCalledWith(25)
    triggerHaptic('heavy')
    expect(vibrateSpy).toHaveBeenCalledWith(45)
    triggerHaptic('success')
    expect(vibrateSpy).toHaveBeenCalledWith([15, 50, 20])
  })

  it('safely handles missing navigator.vibrate gracefully without throwing', () => {
    Object.defineProperty(navigator, 'vibrate', { writable: true, configurable: true, value: undefined })
    expect(() => triggerHaptic('light')).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/platform/platform.test.ts`  
Expected: FAIL with "Cannot find module './index'"

- [ ] **Step 3: 实现平台检测与触觉反馈核心逻辑**

```ts
// src/platform/haptics.ts
export type HapticType = 'light' | 'medium' | 'heavy' | 'success'

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return
  }
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10)
        break
      case 'medium':
        navigator.vibrate(25)
        break
      case 'heavy':
        navigator.vibrate(45)
        break
      case 'success':
        navigator.vibrate([15, 50, 20])
        break
    }
  } catch {
    // 忽略特定平台对 vibrate 调用的安全限制
  }
}

// src/platform/index.ts
import { HapticType, triggerHaptic } from './haptics'

export type PlatformType = 'mobile' | 'desktop'

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'desktop'

  const inTauriMobile =
    '__TAURI_INTERNALS__' in window &&
    /iphone|ipad|ipod|android/i.test(navigator.userAgent)

  const isNarrowTouch =
    window.innerWidth <= 768 &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)

  return inTauriMobile || isNarrowTouch ? 'mobile' : 'desktop'
}

export { triggerHaptic, type HapticType }
```

```ts
// src/platform/usePlatform.ts
import { useState, useEffect } from 'react'
import { detectPlatform, triggerHaptic, type PlatformType, type HapticType } from './index'

export function usePlatform() {
  const [platform, setPlatform] = useState<PlatformType>(() => detectPlatform())

  useEffect(() => {
    function handleResize() {
      setPlatform(detectPlatform())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    platform,
    isMobile: platform === 'mobile',
    isDesktop: platform === 'desktop',
    haptic: (type: HapticType = 'light') => triggerHaptic(type),
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/platform/platform.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交更改**

```bash
git add src/platform/
git commit -m "feat: add platform abstraction and haptics module with tests"
```

---

### Task 2: 移动端 CSS 规范、安全区与视口重塑

**Files:**
- Modify: `src/theme.css`
- Create: `src/mobile.css`
- Modify: `index.html`

- [ ] **Step 1: 检查 index.html 视口 meta 标签**

确保 `index.html` 的 `viewport` meta 标签支持 `viewport-fit=cover`，使得应用能够延伸至 iOS 状态栏与底边安全区。

```html
<!-- index.html: 修改 viewport -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

- [ ] **Step 2: 编写移动端专用样式 `src/mobile.css`**

```css
/* src/mobile.css */
/* 移动端安全区变量与响应式辅助类 */
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --tabbar-height: 56px;
}

/* 消除移动端原生高亮与橡皮筋反弹 */
html, body {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  touch-action: pan-x pan-y;
  overscroll-behavior: none;
}

/* 移动端全屏视口固定容器 */
.mobile-app-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  position: relative;
  background: var(--bg);
}

.mobile-content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-top: max(16px, var(--sat));
  padding-bottom: calc(var(--tabbar-height) + max(12px, var(--sab)));
}
```

- [ ] **Step 3: 在 `src/theme.css` 中引入并在 `src/main.tsx` 中导入**

在 `src/main.tsx` 中加入 `import './mobile.css'`。

- [ ] **Step 4: 运行应用编译并运行现有测试确认无样式冲突**

Run: `npm run build && npm test`  
Expected: PASS

- [ ] **Step 5: 提交更改**

```bash
git add index.html src/mobile.css src/theme.css src/main.tsx
git commit -m "style: configure mobile viewport-fit and safe area CSS variables"
```

---

### Task 3: 包豪斯微透底部导航栏 (Bottom TabBar)

**Files:**
- Create: `src/components/BottomTabBar.tsx`
- Create: `src/components/BottomTabBar.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 编写 BottomTabBar 单元测试**

```tsx
// src/components/BottomTabBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomTabBar } from './BottomTabBar'

describe('BottomTabBar component', () => {
  it('renders all 4 navigation tabs', () => {
    const onChange = vi.fn()
    render(<BottomTabBar currentTab="today" onChange={onChange} />)
    expect(screen.getByTestId('tab-today')).toBeDefined()
    expect(screen.getByTestId('tab-build')).toBeDefined()
    expect(screen.getByTestId('tab-showcase')).toBeDefined()
    expect(screen.getByTestId('tab-stats')).toBeDefined()
  })

  it('triggers onChange and haptic feedback when tab clicked', () => {
    const onChange = vi.fn()
    render(<BottomTabBar currentTab="today" onChange={onChange} />)
    fireEvent.click(screen.getByTestId('tab-build'))
    expect(onChange).toHaveBeenCalledWith('build')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/components/BottomTabBar.test.tsx`  
Expected: FAIL with "Cannot find module './BottomTabBar'"

- [ ] **Step 3: 实现 BottomTabBar 组件**

```tsx
// src/components/BottomTabBar.tsx
import React from 'react'
import { triggerHaptic } from '../platform'
import { IconToday, IconBuild, IconShowcase, IconStats } from './Icons'
import { useI18n } from '../i18n'

export type MobileTab = 'today' | 'build' | 'showcase' | 'stats'

interface Props {
  currentTab: MobileTab
  onChange: (tab: MobileTab) => void
  hasUnfinishedToday?: boolean
  buildProgressPercent?: number
}

export function BottomTabBar({
  currentTab,
  onChange,
  hasUnfinishedToday,
  buildProgressPercent,
}: Props) {
  const { t } = useI18n()

  const tabs: Array<{ id: MobileTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'today',
      label: t.nav?.today ?? '今日',
      icon: (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconToday />
          {hasUnfinishedToday && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
            />
          )}
        </span>
      ),
    },
    {
      id: 'build',
      label: t.nav?.build ?? '建造',
      icon: (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconBuild />
          {typeof buildProgressPercent === 'number' && buildProgressPercent > 0 && (
            <span
              style={{
                position: 'absolute',
                bottom: -2,
                right: -4,
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              {buildProgressPercent}%
            </span>
          )}
        </span>
      ),
    },
    { id: 'showcase', label: t.nav?.showcase ?? '展台', icon: <IconShowcase /> },
    { id: 'stats', label: t.nav?.stats ?? '统计', icon: <IconStats /> },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--tabbar-height, 56px) + max(12px, env(safe-area-inset-bottom, 0px)))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90,
      }}
    >
      {tabs.map((tab) => {
        const active = currentTab === tab.id
        return (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => {
              if (!active) {
                triggerHaptic('light')
                onChange(tab.id)
              }
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 0',
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              transition: 'color 0.15s ease',
            }}
          >
            <span style={{ transform: active ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s ease' }}>
              {tab.icon}
            </span>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/components/BottomTabBar.test.tsx`  
Expected: PASS

- [ ] **Step 5: 在 `src/App.tsx` 中集成平台自适应条件渲染**

在 `src/App.tsx` 中引入 `usePlatform`，当 `isMobile` 为 true 时：
- 隐藏桌面端自定义标题栏 `TitleBar`；
- 显示顶部超轻量移动 Header（带 Logo、标题与设置图标）；
- 页面底部渲染 `BottomTabBar`。

- [ ] **Step 6: 提交更改**

```bash
git add src/components/BottomTabBar.tsx src/components/BottomTabBar.test.tsx src/App.tsx
git commit -m "feat: implement mobile BottomTabBar with tests and adapt App.tsx"
```

---

### Task 4: 2.5D 画布触控手势引擎 (Touch Gestures for Iso Canvas)

**Files:**
- Create: `src/render/touchGesture.ts`
- Create: `src/render/touchGesture.test.ts`
- Modify: `src/render/BuildScene.tsx`
- Modify: `src/render/ShowcaseScene.tsx`

- [ ] **Step 1: 编写触控手势数学逻辑测试**

```ts
// src/render/touchGesture.test.ts
import { describe, it, expect } from 'vitest'
import { calculatePinchDistance, calculateTouchCenter, clampZoom } from './touchGesture'

describe('touchGesture math helpers', () => {
  it('calculates distance between two touch points correctly', () => {
    const p1 = { clientX: 0, clientY: 0 }
    const p2 = { clientX: 30, clientY: 40 }
    expect(calculatePinchDistance(p1, p2)).toBe(50)
  })

  it('calculates midpoint between two touch points', () => {
    const p1 = { clientX: 10, clientY: 20 }
    const p2 = { clientX: 30, clientY: 40 }
    const center = calculateTouchCenter(p1, p2)
    expect(center.x).toBe(20)
    expect(center.y).toBe(30)
  })

  it('clamps zoom scale to boundaries', () => {
    expect(clampZoom(0.2, 0.5, 3.0)).toBe(0.5)
    expect(clampZoom(4.0, 0.5, 3.0)).toBe(3.0)
    expect(clampZoom(1.5, 0.5, 3.0)).toBe(1.5)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/render/touchGesture.test.ts`  
Expected: FAIL with "Cannot find module './touchGesture'"

- [ ] **Step 3: 实现触控手势引擎 `src/render/touchGesture.ts`**

```ts
// src/render/touchGesture.ts
export interface TouchPoint {
  clientX: number
  clientY: number
}

export function calculatePinchDistance(p1: TouchPoint, p2: TouchPoint): number {
  const dx = p1.clientX - p2.clientX
  const dy = p1.clientY - p2.clientY
  return Math.hypot(dx, dy)
}

export function calculateTouchCenter(p1: TouchPoint, p2: TouchPoint): { x: number; y: number } {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  }
}

export function clampZoom(scale: number, minScale = 0.5, maxScale = 3.0): number {
  return Math.min(maxScale, Math.max(minScale, scale))
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/render/touchGesture.test.ts`  
Expected: PASS

- [ ] **Step 5: 将触控监听挂载到 `BuildScene.tsx` 与 `ShowcaseScene.tsx`**

在 `BuildScene.tsx` 的 Canvas 元素上绑定 `onTouchStart`, `onTouchMove`, `onTouchEnd`：
- 单指触摸：执行视口平移（Pan）；
- 双指触摸：调用 `calculatePinchDistance` 执行连续缩放（Pinch Zoom）；
- 轻触判定：当触摸移动距离小于 8px 且触摸时间小于 250ms 时，视为积木拾取点击，调用 `isPointInsideCube`，触发 `triggerHaptic('light')`。

- [ ] **Step 6: 提交更改**

```bash
git add src/render/touchGesture.ts src/render/touchGesture.test.ts src/render/BuildScene.tsx src/render/ShowcaseScene.tsx
git commit -m "feat: integrate mobile multi-touch gestures to 2.5D Canvas scenes"
```

---

### Task 5: 全场景底部抽屉 (Bottom Sheet) 与弹窗演进

**Files:**
- Create: `src/components/BottomSheet.tsx`
- Create: `src/components/BottomSheet.test.tsx`
- Modify: `src/components/HabitDialog.tsx`
- Modify: `src/components/SettingsDialog.tsx`

- [ ] **Step 1: 编写 BottomSheet 组件测试**

```tsx
// src/components/BottomSheet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'

describe('BottomSheet component', () => {
  it('renders children and title when open', () => {
    render(
      <BottomSheet open={true} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>,
    )
    expect(screen.getByText('测试抽屉')).toBeDefined()
    expect(screen.getByText('抽屉内容')).toBeDefined()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open={true} onClose={onClose} title="测试抽屉">
        <div>内容</div>
      </BottomSheet>,
    )
    fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/components/BottomSheet.test.tsx`  
Expected: FAIL with "Cannot find module './BottomSheet'"

- [ ] **Step 3: 实现 BottomSheet 组件**

```tsx
// src/components/BottomSheet.tsx
import React, { useEffect } from 'react'
import { triggerHaptic } from '../platform'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxHeight?: string | number
}

export function BottomSheet({ open, onClose, title, children, maxHeight = '85vh' }: Props) {
  useEffect(() => {
    if (open) {
      triggerHaptic('light')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* 半透明遮罩 */}
      <div
        data-testid="bottom-sheet-backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* 抽屉面板 */}
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderTopLeftRadius: 'var(--r-lg, 20px)',
          borderTopRightRadius: 'var(--r-lg, 20px)',
          borderTop: '1px solid var(--line)',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 顶部手势拖拽把手 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'var(--line)',
            }}
          />
        </div>

        {/* 标题栏 */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px 12px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-2)',
                fontSize: 14,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              关闭
            </button>
          </div>
        )}

        {/* 内容区 */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/components/BottomSheet.test.tsx`  
Expected: PASS

- [ ] **Step 5: 在 `HabitDialog.tsx` 与 `SettingsDialog.tsx` 中使用 `usePlatform` 自适应**

在移动端模式下使用 `BottomSheet` 渲染表单，桌面端继续使用原居中浮层。

- [ ] **Step 6: 提交更改**

```bash
git add src/components/BottomSheet.tsx src/components/BottomSheet.test.tsx src/components/HabitDialog.tsx src/components/SettingsDialog.tsx
git commit -m "feat: implement BottomSheet and integrate into mobile dialogs"
```

---

### Task 6: 移动端打卡行 (HabitRow Mobile) 与触觉微交互

**Files:**
- Modify: `src/components/HabitRow.tsx`
- Create: `src/components/HabitRowMobile.test.tsx`

- [ ] **Step 1: 编写 HabitRow 移动端触觉与大尺寸点击区测试**

```tsx
// src/components/HabitRowMobile.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HabitRow } from './HabitRow'
import type { Habit } from '../types'

describe('HabitRow mobile interaction', () => {
  const dummyHabit: Habit = {
    id: 'h1',
    name: '晨间饮水',
    frequency: { type: 'daily' },
    createdAt: '2026-09-01T00:00:00Z',
  }

  it('triggers haptic and checkin on button click', () => {
    const onCheck = vi.fn()
    render(
      <HabitRow
        habit={dummyHabit}
        todayMet={false}
        checkIns={[]}
        onCheck={onCheck}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
      />,
    )
    const btn = screen.getByRole('button', { name: /打卡/i })
    fireEvent.click(btn)
    expect(onCheck).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试验证**

Run: `npx vitest run src/components/HabitRowMobile.test.tsx`  
Expected: PASS 或微调后 PASS

- [ ] **Step 3: 优化 HabitRow 在移动端的按压动画与触控热区**

在 `HabitRow.tsx` 中：
- 保证按钮最小触控尺寸 ≥ 44×44px；
- 添加 `:active { transform: scale(0.98); }` 按压物理微动效；
- 在打卡成功时调用 `triggerHaptic('medium')`。

- [ ] **Step 4: 运行全部单测确保无回归**

Run: `npm test`  
Expected: PASS

- [ ] **Step 5: 提交更改**

```bash
git add src/components/HabitRow.tsx src/components/HabitRowMobile.test.tsx
git commit -m "feat: enhance HabitRow with touch haptics and mobile-sized target hit areas"
```

---

### Task 7: WebDAV 数据同步引擎与 CRDT 冲突合并算法

**Files:**
- Create: `src/sync/types.ts`
- Create: `src/sync/merge.ts`
- Create: `src/sync/merge.test.ts`
- Create: `src/sync/webdav.ts`
- Modify: `src/components/SettingsDialog.tsx`

- [ ] **Step 1: 编写 CRDT 数据合并单元测试**

```ts
// src/sync/merge.test.ts
import { describe, it, expect } from 'vitest'
import { mergeAppState } from './merge'
import type { AppState } from '../types'

describe('mergeAppState CRDT logic', () => {
  const baseState: AppState = {
    schemaVersion: 1,
    habits: [
      { id: 'h1', name: '读书', frequency: { type: 'daily' }, createdAt: '2026-09-01T00:00:00Z' },
    ],
    checkIns: [
      { id: 'c1', habitId: 'h1', date: '2026-09-20', at: '2026-09-20T08:00:00Z' },
    ],
    builds: [],
    activeBlueprintId: 'castle',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    repairBricks: 1,
    showcasePlacements: [],
    foundationNotes: {},
  }

  it('unions checkIns from both devices without losing any check-in record', () => {
    const localState: AppState = {
      ...baseState,
      checkIns: [
        ...baseState.checkIns,
        { id: 'c2', habitId: 'h1', date: '2026-09-21', at: '2026-09-21T08:00:00Z' },
      ],
    }

    const remoteState: AppState = {
      ...baseState,
      checkIns: [
        ...baseState.checkIns,
        { id: 'c3', habitId: 'h1', date: '2026-09-22', at: '2026-09-22T08:00:00Z' },
      ],
    }

    const merged = mergeAppState(localState, remoteState)
    expect(merged.checkIns).toHaveLength(3)
    expect(merged.checkIns.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3'])
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/sync/merge.test.ts`  
Expected: FAIL with "Cannot find module './merge'"

- [ ] **Step 3: 实现 CRDT 合并算法与 WebDAV 客户端**

```ts
// src/sync/merge.ts
import type { AppState, CheckIn, Habit } from '../types'

export function mergeAppState(local: AppState, remote: AppState): AppState {
  // 1. 打卡记录：并集去重（以 id 为主，或 habitId+date 判定）
  const checkInMap = new Map<string, CheckIn>()
  for (const c of [...local.checkIns, ...remote.checkIns]) {
    const key = c.id || `${c.habitId}_${c.date}`
    checkInMap.set(key, c)
  }
  const mergedCheckIns = Array.from(checkInMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  // 2. 习惯列表：以 id 合并
  const habitMap = new Map<string, Habit>()
  for (const h of [...remote.habits, ...local.habits]) {
    habitMap.set(h.id, h)
  }

  // 3. 蓝图建造进度：取积木并集
  const buildKeySet = new Set<string>()
  const mergedBuilds = []
  for (const b of [...local.builds, ...remote.builds]) {
    const k = `${b.blueprintId}_${b.index}`
    if (!buildKeySet.has(k)) {
      buildKeySet.add(k)
      mergedBuilds.push(b)
    }
  }

  return {
    ...local,
    habits: Array.from(habitMap.values()),
    checkIns: mergedCheckIns,
    builds: mergedBuilds,
    completedBlueprintIds: Array.from(
      new Set([...local.completedBlueprintIds, ...remote.completedBlueprintIds]),
    ),
    repairBricks: Math.max(local.repairBricks ?? 0, remote.repairBricks ?? 0),
    dayClaims: Array.from(new Set([...(local.dayClaims ?? []), ...(remote.dayClaims ?? [])])),
  }
}
```

```ts
// src/sync/webdav.ts
export interface WebDavConfig {
  endpoint: string
  username: string
  password: string
}

export async function fetchRemoteState(config: WebDavConfig): Promise<string | null> {
  const url = `${config.endpoint.replace(/\/$/, '')}/blockhabit-state.json`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
    },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`WebDAV HTTP ${res.status}`)
  return await res.text()
}

export async function pushRemoteState(config: WebDavConfig, json: string): Promise<void> {
  const url = `${config.endpoint.replace(/\/$/, '')}/blockhabit-state.json`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: json,
  })
  if (!res.ok) throw new Error(`WebDAV PUT failed: HTTP ${res.status}`)
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/sync/merge.test.ts`  
Expected: PASS

- [ ] **Step 5: 在 `SettingsDialog.tsx` 中添加 WebDAV 配置面板**

- [ ] **Step 6: 提交更改**

```bash
git add src/sync/ src/components/SettingsDialog.tsx
git commit -m "feat: add WebDAV synchronization and CRDT union merge algorithm with tests"
```

---

### Task 8: 全面回归测试与打包验证

**Files:**
- Test: All tests (`npm test`)
- Build: `npm run build`

- [ ] **Step 1: 运行全量单元测试套件**

Run: `npm test`  
Expected: All test suites PASS with 0 failures

- [ ] **Step 2: 运行 Vite 生产环境构建**

Run: `npm run build`  
Expected: `dist/` 构建成功，无 TypeScript 类型错误与缺失模块错误

- [ ] **Step 3: 提交并标记实施里程碑就绪**

```bash
git add .
git commit -m "chore: complete mobile adaptation implementation and verify clean build"
```
