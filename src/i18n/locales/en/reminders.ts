import type { TranslationSchema } from '../../types'

export const reminder: TranslationSchema['reminder'] = {
  startBody: (name) => `Time to start "${name}"`,
  dueSoonBody: (name) => `"${name}" reminder window is closing — start now ⏳`,
  dialogTitle: 'Reminder',
  startLabel: (time) => `Start ${time}`,
  endLabel: (time) => `End ${time}`,
  minutesLeft: (n) => `${n} min left before the window closes`,
  dueSoonBadge: 'Due soon',
  startBtn: 'Start now',
  snoozeBtn: 'Snooze',
  snoozedToast: (n) => `Remind you again in ${n} minutes`,
  snoozeLimitToast: 'No snoozes left for today',
  skipBtn: 'Skip today',
  skippedToast: "Won't remind you about this habit today",
  bannerTitle: (count) => `${count} habit${count > 1 ? 's' : ''} waiting to start`,
  bannerHint: 'The bricks are waiting'
}

/** Evening wrap-up reminder (D-20261110-055) */
export const eveningNudge: TranslationSchema['eveningNudge'] = {
  settingsTitle: 'Evening wrap-up reminder',
  settingsDesc: 'One reminder a day when habits are still open.',
  settingsTime: 'Reminder time',
  settingsTimeNote: 'Works while the app is running',
  consentTitle: 'Want a daily wrap-up reminder?',
  consentBody: (time) =>
    `Defaults to ${time}. Only when habits are still open. You can turn it off anytime.`,
  consentEnable: 'Enable reminder',
  consentLater: 'Not now',
  enabledToast: 'Evening reminder enabled',
  notificationBody: (pending) =>
    `${pending} ${pending > 1 ? 'habits are' : 'habit is'} still open. Time to wrap up.`
}
