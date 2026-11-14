import type { TranslationSchema } from '../../types'

export const today: TranslationSchema['today'] = {
  emptyHint: (bp) =>
    `No habits yet. Click + in top-right to create your first one.\nEach completion drops a block to build "${bp}".`,
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
  instantCheckIn: 'Instant',
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
  filterAll: 'All',
  activeCompleteNoBlock: 'This blueprint is complete — head to Build to start the next one',
  allBlueprintsDone:
    'All blueprints are complete — check-ins are still recorded, but no new bricks drop',
  startJourney: 'Begin Your Voxel Journey',
  onboardingStep1Title: 'Create your first habit',
  onboardingStep1Body:
    'Start with something that takes 30 seconds: a glass of water, a page of a book.',
  onboardingStep2Title: 'Check in once',
  onboardingStep2Body: 'Your first brick drops onto the desk, at the place that day belongs to.',
  onboardingStep3Title: 'Watch it grow',
  onboardingStep3Body:
    'One more day, one more brick. When the desk is full, the next piece begins.',
  onboardingSeeBuild: 'See the build page',
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
  completedBlueprint: (name) => `"${name}" Completed!`,
  firstBlockHint:
    'Your first brick — it now sits on the desk in the Build page, and every brick after it will stack up beside it.'
}

/** Daily brief (D-20261110-052) */
export const todayBrief: TranslationSchema['todayBrief'] = {
  greetings: {
    night: 'Late night',
    morning: 'Good morning',
    noon: 'Midday',
    afternoon: 'Good afternoon',
    evening: 'Good evening'
  },
  idle: (total) => `${total} ${total > 1 ? 'things' : 'thing'} today. One at a time.`,
  inProgress: (done, total, pending) => `Done ${done}/${total} · ${pending} to go.`,
  milestone: (blueprint, remaining) => `${remaining} blocks to finish "${blueprint}"`,
  nextReady: (blueprint) => `Next up: "${blueprint}"`,
  startFirst: 'Start with one',
  viewBuild: 'View the build'
}

/** Habit templates (D-20261110-053) */
export const templates: TranslationSchema['templates'] = {
  title: 'Or start with one of these',
  hint: 'One tap to create. You can edit it later.',
  water: 'Drink water',
  read: 'Read',
  walk: 'Walk',
  sleep: 'Sleep early',
  ledger: 'Log expense',
  created: (name) => `Created "${name}". Tap the card to check in.`
}

/** Page tips (D-20261110-054) */
export const guide: TranslationSchema['guide'] = {
  buildTitle: 'Your construction site',
  buildBody: 'Scroll to zoom, drag to pan. Each block snaps into the blueprint.',
  showcaseTitle: 'Showcase island',
  showcaseBody: 'Drag buildings to rearrange. Click one to open its completion polaroid.',
  statsTitle: 'The shape of your time',
  statsBody: 'Darker squares mean more done that day. Click a square to inspect it.',
  gotIt: 'Got it',
  replayTitle: 'Page tips',
  replay: 'Show page tips again',
  replayToast: 'Page tips will appear again next time'
}
