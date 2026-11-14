import type { TranslationSchema } from '../../types'

/** Yearbook (D-20261110-060) */
export const yearbook: TranslationSchema['yearbook'] = {
  title: 'Yearbook',
  entry: 'Yearbook',
  entryTooltip: 'Open the yearbook for this year',
  yearTitle: (year) => String(year),
  emptyTitle: 'Nothing completed this year',
  emptyBody: 'Keep building — the next brick will fill it in.',
  exportPng: 'Save image',
  copyPng: 'Copy image',
  exportMarkdown: 'Export Markdown',
  savedToast: 'Yearbook saved',
  copiedToast: 'Yearbook copied to clipboard',
  copyFail: 'Copy failed. Try Save image.',
  copyFallbackToast: 'Clipboard unavailable — PNG downloaded instead',
  sections: {
    overview: 'The year',
    months: 'Twelve months',
    buildings: 'Building timeline',
    shape: 'Shape of time',
    quote: 'One note from the year'
  },
  metrics: {
    checkIns: 'Check-ins',
    blocks: 'Blocks',
    buildings: 'Completed',
    allClear: 'All-clear days',
    longestStreak: 'Longest streak',
    focusHours: 'Focus hours',
    notes: 'Notes'
  },
  topHabits: 'Most checked-in',
  busiestPeriod: 'Most active period',
  busiestWeekday: 'Most active weekday',
  noData: 'No data',
  buildingDate: (date) => `Completed ${date}`,
  quoteFrom: (name) => `— ${name}`,
  coverTitle: 'BLOCKHABIT YEARBOOK',
  monthsLegendLow: 'Less',
  monthsLegendHigh: 'More',
  markdownHeading: (year) => `BlockHabit Yearbook · ${year}`,
  streakDays: (n) => `${n} days`,
  focusHoursValue: (n) => `${n} h`
}

/** Archive pack (D-20261110-062) */
export const archive: TranslationSchema['archive'] = {
  title: 'Complete archive',
  exportBtn: 'Export complete archive',
  exportHint:
    'Bundle data, a README and completed building images into a local folder; nothing is uploaded and no WebDAV credentials are included.',
  preparing: 'Preparing archive...',
  progress: (done, total) => `${done}/${total} generated`,
  success: 'Archive created',
  fail: 'Export failed; incomplete files were cleaned up',
  cancel: 'Cancel',
  cancelled: 'Cancelled; no partial files were left behind',
  partialRetry: 'Retry',
  openDir: 'Open archive',
  browserZipHint: 'Browser preview downloads a single ZIP file',
  contents: 'Includes README, manifest, state JSON, checksums and building images'
}

/** Building archive (D-20261110-065) */
export const buildingArchive: TranslationSchema['buildingArchive'] = {
  entry: 'Archive',
  title: 'Building archive',
  completedAt: (date) => `Completed ${date}`,
  unknownDate: 'Unknown',
  nth: (n) => `No. ${n}`,
  metrics: {
    blocks: 'Blocks',
    days: 'Days',
    topHabit: 'Top habit',
    perfectDays: 'All-clear days',
    bonusBlocks: 'Bonus blocks'
  },
  timeline: 'Timeline',
  firstBlock: 'First block',
  lastBlock: 'Last block',
  percent: (percent) => `${percent}%`,
  noteLabel: 'Foundation note',
  notePlaceholder: 'Write one line about this building...',
  saveNote: 'Save note',
  polaroid: 'Polaroid',
  savePng: 'Save card',
  empty: 'This building is not complete yet',
  close: 'Close',
  topHabitValue: (name, blocks) => `${name} · ${blocks} blocks`,
  daysValue: (days) => `${days} days`
}
