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
  buildProgressPercent
}: BottomTabBarProps) {
  const { t } = useI18n()

  const tabs: Array<{ id: MobileTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'today',
      label: t.nav.today,
      icon: (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconToday size={22} />
          {hasUnfinishedToday && (
            <span
              data-testid="badge-unfinished-today"
              aria-label={t.a11y.unfinishedHabits}
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)'
              }}
            />
          )}
        </span>
      )
    },
    {
      id: 'build',
      label: t.nav.build,
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
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                color: 'var(--accent)',
                lineHeight: 1
              }}
            >
              {buildProgressPercent}%
            </span>
          )}
        </span>
      )
    },
    {
      id: 'showcase',
      label: t.nav.showcase,
      icon: <IconShowcase size={22} />
    },
    {
      id: 'stats',
      label: t.nav.stats,
      icon: <IconStats size={22} />
    }
  ]

  return (
    <nav
      className="bottom-tabbar"
      aria-label={t.a11y.bottomNav}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--tabbar-height, 56px) + max(12px, env(safe-area-inset-bottom, 0px)))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
        background: 'color-mix(in srgb, var(--surface) 82%, transparent)',
        borderTop: '0.5px solid color-mix(in srgb, var(--line) 80%, transparent)',
        backdropFilter: 'blur(25px) saturate(190%)',
        WebkitBackdropFilter: 'blur(25px) saturate(190%)',
        boxShadow: '0 -2px 16px color-mix(in srgb, var(--ink) 3%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90
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
              background: active
                ? 'color-mix(in srgb, var(--ink) 4.5%, transparent)'
                : 'transparent',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              padding: '6px 4px 7px',
              margin: '0 4px',
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              transition:
                'background var(--dur-md) var(--ease-out), color var(--dur-sm) var(--ease-default), transform var(--dur-xs) var(--ease-default)',
              position: 'relative',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <span
              style={{
                transform: active ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform var(--dur-xs) var(--ease-default)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {tab.icon}
            </span>
            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: active ? 600 : 500 }}>
              {tab.label}
            </span>
            {active && (
              <span
                data-testid={`indicator-${tab.id}`}
                style={{
                  position: 'absolute',
                  bottom: 2,
                  width: 14,
                  height: 2.5,
                  borderRadius: 999,
                  background: 'var(--accent)',
                  transition: 'width var(--dur-md) var(--ease-default)'
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
