import React from 'react'
import { triggerHaptic } from '../platform'
import { IconToday, IconBuild, IconShowcase, IconStats } from './Icons'
import { useI18n } from '../i18n'

export type MobileTab = 'today' | 'build' | 'showcase' | 'stats'

export interface BottomTabBarProps {
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
}: BottomTabBarProps) {
  const { t } = useI18n()

  const tabs: Array<{ id: MobileTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'today',
      label: t.nav?.today ?? '今日',
      icon: (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconToday size={22} />
          {hasUnfinishedToday && (
            <span
              data-testid="badge-unfinished-today"
              aria-label="unfinished habits"
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
          <IconBuild size={22} />
          {typeof buildProgressPercent === 'number' && buildProgressPercent > 0 && (
            <span
              data-testid="badge-build-progress"
              aria-label={`${buildProgressPercent}%`}
              style={{
                position: 'absolute',
                bottom: -2,
                right: -6,
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--accent)',
                lineHeight: 1,
              }}
            >
              {buildProgressPercent}%
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'showcase',
      label: t.nav?.showcase ?? '展台',
      icon: <IconShowcase size={22} />,
    },
    {
      id: 'stats',
      label: t.nav?.stats ?? '统计',
      icon: <IconStats size={22} />,
    },
  ]

  return (
    <nav
      className="bottom-tabbar"
      aria-label="Bottom Navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--tabbar-height, 56px) + max(12px, env(safe-area-inset-bottom, 0px)))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
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
            type="button"
            data-testid={`tab-${tab.id}`}
            data-active={active ? 'true' : 'false'}
            aria-current={active ? 'page' : undefined}
            className={active ? 'tab-item active' : 'tab-item'}
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
              position: 'relative',
            }}
          >
            <span
              style={{
                transform: active ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {tab.icon}
            </span>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>
              {tab.label}
            </span>
            {active && (
              <span
                data-testid={`indicator-${tab.id}`}
                style={{
                  position: 'absolute',
                  bottom: 2,
                  width: 12,
                  height: 2,
                  borderRadius: 1,
                  background: 'var(--accent)',
                }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
export default BottomTabBar
