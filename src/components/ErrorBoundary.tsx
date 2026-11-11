import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { downloadDiagnostics, recordCrash } from '../platform/errorLog'

/** full = 主窗口整窗兜底；tray = 托盘迷你窗（240×172）紧凑兜底 */
export type ErrorBoundaryVariant = 'full' | 'tray'

interface ErrorBoundaryProps {
  children: ReactNode
  variant?: ErrorBoundaryVariant
}

interface ErrorBoundaryState {
  hasError: boolean
}

interface ErrorFallbackProps {
  variant: ErrorBoundaryVariant
}

/**
 * 崩溃兜底界面（A4 稳定性兜底）。
 *
 * 视觉纪律（AGENTS §3 硬约束 1 + design/README.md A1–A4）：
 * - 只用现有令牌 var(--bg/--surface/--ink/--ink-2/--line/--r-md/--r-lg/--r-pill)；
 * - 一块黑白卡片 + 1px 细线 + 胶囊按钮，不新增颜色 / 阴影 / 圆角档位 / 字体 / 动效；
 * - 文案全部走 i18n（useI18n 的 t.errorBoundary.*），zh/en 同步。
 */
function ErrorFallback({ variant }: ErrorFallbackProps) {
  const { t } = useI18n()
  const isTray = variant === 'tray'

  const handleReload = (): void => {
    // 整页重载即可让用户自愈；失败也不在兜底页里再抛
    try {
      window.location.reload()
    } catch {
      // 忽略：个别 WebView 在异常状态下禁止重载
    }
  }

  const handleExport = (): void => {
    downloadDiagnostics()
  }

  return (
    <div
      role="alert"
      data-testid="error-boundary"
      data-variant={variant}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: isTray ? 12 : 24,
        color: 'var(--ink)',
        // 托盘窗口是透明窗口：兜底卡片自己撑起 surface，不重复铺底色
        background: isTray ? 'transparent' : 'var(--bg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: isTray ? 5 : 12,
          width: '100%',
          height: isTray ? '100%' : undefined,
          maxWidth: isTray ? undefined : 420,
          padding: isTray ? '10px 12px' : '32px 28px',
          boxSizing: 'border-box',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: isTray ? 'var(--r-md)' : 'var(--r-lg)',
          overflow: 'hidden',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isTray ? 13 : 20,
            fontWeight: 700,
            lineHeight: 1.3,
            color: 'var(--ink)',
          }}
        >
          {t.errorBoundary.title}
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: isTray ? undefined : 320,
            fontSize: isTray ? 10.5 : 13,
            lineHeight: isTray ? 1.5 : 1.55,
            color: 'var(--ink-2)',
          }}
        >
          {t.errorBoundary.body}
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isTray ? 6 : 10,
            marginTop: isTray ? 1 : 6,
            width: '100%',
          }}
        >
          <button
            type="button"
            data-testid="error-boundary-reload"
            className="btn primary"
            style={{
              borderRadius: 'var(--r-pill)',
              fontSize: isTray ? 10.5 : 13.5,
              lineHeight: isTray ? 1.2 : undefined,
              padding: isTray ? '4px 9px' : undefined,
            }}
            onClick={handleReload}
          >
            {t.errorBoundary.reload}
          </button>
          <button
            type="button"
            data-testid="error-boundary-export"
            className="btn ghost"
            style={{
              borderRadius: 'var(--r-pill)',
              fontSize: isTray ? 10.5 : 13.5,
              lineHeight: isTray ? 1.2 : undefined,
              padding: isTray ? '4px 9px' : undefined,
            }}
            onClick={handleExport}
          >
            {t.errorBoundary.export}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 捕获子树渲染异常并渲染兜底界面。
 * class 本身不使用 hooks；只有挂载降级卡片时才用 useI18n 取词（文案必须走 i18n）。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      recordCrash('render', error, undefined, info.componentStack ?? undefined)
    } catch {
      // 日志写入失败不得让兜底界面再次崩溃
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback variant={this.props.variant ?? 'full'} />
    }
    return this.props.children
  }
}
