import type { TranslationSchema } from '../../types'

/** Focus companion (D-20261110-064) */
export const focusCompanion: TranslationSchema['focusCompanion'] = {
  start: 'Start focus',
  startHint:
    'Start from Today or the desk toy; timing keeps running on real time even if the app is closed.',
  focusing: 'Focusing',
  ready: 'Time is up; confirm to place the block',
  remaining: (text) => `${text} left`,
  confirmCheckIn: 'Confirm and place',
  extendFive: 'Wait 5 more minutes',
  giveUp: 'Give up this session',
  giveUpConfirm: 'Give up? No check-in will be recorded.',
  gaveUp: 'Gave up; nothing was checked in',
  persistedHint: 'Timing uses real time; reopening the app shows the current state',
  notificationBody: (name) => `Focus time for "${name}" is up. Confirm to place the block.`,
  moreSessions: (n) => (n === 1 ? '1 more focus session' : `${n} more focus sessions`)
}
