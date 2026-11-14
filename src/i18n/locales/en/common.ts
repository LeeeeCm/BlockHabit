import type { TranslationSchema } from '../../types'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

export const common: TranslationSchema['common'] = {
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  restore: 'Restore',
  edit: 'Edit',
  confirm: 'Confirm',
  complete: 'Done',
  skip: 'Skip',
  close: 'Close',
  optional: 'Optional',
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weekdaysSingle: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  dateHeader: (_y, m, d, w) => `${MONTH_NAMES[m - 1]} ${d}, ${w}`,
  monthDay: (m, d) => `${MONTH_NAMES[m - 1]} ${d}`,
  weekdayLabel: (w) => w,
  timeMinutes: (m) => `${m} min`,
  dismiss: 'Dismiss sheet',
  shortcut: (label, key) => `${label} (${key})`
}

export const a11y: TranslationSchema['a11y'] = {
  unfinishedHabits: 'Unfinished habits',
  bottomNav: 'Bottom navigation'
}

export const nav: TranslationSchema['nav'] = {
  today: 'Today',
  build: 'Build',
  showcase: 'Showcase',
  stats: 'Stats'
}

export const titlebar: TranslationSchema['titlebar'] = {
  settings: 'Settings',
  miniMode: 'Mini Desk Toy',
  minimize: 'Minimize',
  maximize: 'Maximize',
  restore: 'Restore',
  close: 'Close'
}

export const mini: TranslationSchema['mini'] = {
  expandTooltip: 'Expand Window',
  closeTooltip: 'Minimize',
  toastQuickCheckIn: (name) => `+1 Block · ${name}`,
  toastComplete: (name) => `"${name}" Completed!`,
  allDone: 'All tasks completed for today',
  habitCheckInTip: (name) => `Click to complete "${name}"`,
  todayLabel: 'Today',
  nextMilestone: (blueprint, remaining) => `${remaining} blocks to finish "${blueprint}"`,
  doubleClickHint: 'Double-click the title to expand'
}

export const tray: TranslationSchema['tray'] = {
  tooltipDone: 'All check-ins completed today',
  tooltipProgress: (done, total) => `Today's progress ${done}/${total}`,
  openMain: 'Open Main Window',
  quit: 'Quit'
}

export const errorBoundary: TranslationSchema['errorBoundary'] = {
  title: 'Something went wrong',
  body: 'The interface hit an unexpected error. Your data is stored locally and is safe — reload to continue.',
  reload: 'Reload',
  export: 'Export diagnostics'
}

export const microMood: TranslationSchema['microMood'] = {
  energetic: 'Energy',
  hard: 'Grit',
  spark: 'Spark',
  calm: 'Calm'
}
