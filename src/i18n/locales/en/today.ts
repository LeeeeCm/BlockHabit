import type { TranslationSchema } from '../../types'

export const today: TranslationSchema['today'] = {
  newHabit: 'New Habit',
  archivedCount: (c) => `Archived · ${c}`,
  collapse: 'Collapse ▴',
  expand: 'Expand ▾',
  deleteConfirmTitle: 'Delete Habit',
  deleteConfirmMsg: (name) =>
    `Are you sure you want to permanently delete "${name}"? All related check-in history will be removed.`,
  checkedInToast: (name) => `Checked in "${name}"`,
  streakBonusToast: (days) => `${days}-day streak! This block is a bonus block`,
  periods: {
    any: 'Any Time',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening'
  },
  restDay: 'Rest Day',
  resilienceContinuation: 'Streak protected · resumed after rest',
  weekMissed: 'Quota Missed',
  freqDaily: 'Daily',
  freqWeekdays: 'Weekdays',
  freqWeekends: 'Weekends',
  freqCustom: (days) => `${days.join(', ')}`,
  freqWeekly: (times) => `${times}x / week`,
  weekProgress: (done, times) => `${done}/${times} this week`,
  weekProgressToday: (done, times) => `Checked in · ${done}/${times} this week`,
  weekDoneTooltip: 'Week complete',
  alreadyCheckedIn: 'Already checked in today',
  weekQuotaDone: (done, times) => `Week complete · ${done}/${times}`,
  targetMinutes: (min) => `${min} min`,
  focus: 'Focus',
  cancelTimer: 'Cancel',
  earlyFinish: 'Finish Early',
  earlyConfirmMsg: (mins) =>
    `You've completed over 20% of your target (${mins} min elapsed). Complete check-in early?`,
  checkInTooltip: 'Click to check in',
  undoTooltip: 'Completed. Click to undo',
  undoConfirmTitle: 'Undo Check-in',
  undoConfirmBody:
    "Undoing removes today's check-in, recycles its block, and recalculates streaks & perfect-day rewards. Continue?",
  undoConfirmAction: 'Undo Check-in',
  timingTooltip: 'Timer in progress',
  completedPill: 'Done',
  readyToFinish: 'Over 80% — click again to check in',
  fullCard: {
    title: 'Daily All-Clear Achieved!',
    subtitlePlaced: 'Daily bonus milestone block has been placed',
    subtitlePending: 'All habits completed. Claim your +1 daily bonus block',
    claimToast: 'Claimed daily milestone block!',
    claimFailIncomplete: 'Some habits are not done yet — finish them first',
    claimFailAlready: 'Today’s attendance block was already claimed',
    claimFailNoHabits: 'No habits to count yet',
    claimBonusToast: 'Streak milestone: this one is an accent bonus block',
    bonusHabitName: 'Daily All-Clear',
    deletedHabitName: 'Deleted habit',
    claimBtn: 'Claim Bonus',
    claimed: 'Claimed'
  },
  view3dModel: 'View 3D Model in Build page',
  viewBuild: 'View Build',
  filterAll: 'All',
  activeCompleteNoBlock: 'This blueprint is complete — head to Build to start the next one',
  allBlueprintsDone:
    'All blueprints are complete — check-ins are still recorded, but no new bricks drop',
  inRestPeriod: 'Weathering (Check in to resume)',
  unpinHabit: 'Unpin',
  pinHabit: 'Pin to top',
  addReflectionPlaceholder: 'Add reflection note...',
  focusedMinutes: (min) => `Focused ${min} min`,
  timerDoneNotify: (name) => `"${name}" focus completed! Click card to check in`
}

export const blockDrop: TranslationSchema['blockDrop'] = {
  plusOne: '+1 Block',
  completedHabit: (name) => `Completed "${name}"`,
  skip: 'Skip (Esc)',
  progress: (p, t, pct) => `Progress ${p} / ${t} blocks (${pct}%)`,
  completedBlueprint: (name) => `"${name}" Completed!`
}

/** Habit templates (D-20261110-053) */
export const templates: TranslationSchema['templates'] = {
  water: 'Drink water',
  read: 'Read',
  walk: 'Walk',
  sleep: 'Sleep early',
  ledger: 'Log expense',
  created: (name) => `Created "${name}". Tap the card to check in.`
}
