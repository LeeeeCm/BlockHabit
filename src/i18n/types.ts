export type Language = 'zh' | 'en'

export interface TranslationSchema {
  common: {
    cancel: string
    save: string
    delete: string
    restore: string
    archive: string
    edit: string
    confirm: string
    complete: string
    skip: string
    close: string
    optional: string
    required: string
    weekdays: string[]
    weekdaysShort: string[]
    weekdaysSingle: string[]
    dateHeader: (year: number, month: number, date: number, weekday: string) => string
    timeMinutes: (minutes: number) => string
  }
  nav: {
    today: string
    build: string
    showcase: string
    stats: string
  }
  titlebar: {
    settings: string
    miniMode: string
    minimize: string
    maximize: string
    restore: string
    close: string
  }
  today: {
    emptyHint: (blueprintName: string) => string
    newHabit: string
    archivedCount: (count: number) => string
    collapse: string
    expand: string
    deleteConfirmTitle: string
    deleteConfirmMsg: (name: string) => string
    checkedInToast: (name: string) => string
    periods: {
      any: string
      morning: string
      afternoon: string
      evening: string
    }
    restDay: string
    weekMissed: string
    freqDaily: string
    freqWeekdays: string
    freqWeekends: string
    freqCustom: (days: string[]) => string
    freqWeekly: (times: number) => string
    instantCheckIn: string
    targetMinutes: (min: number) => string
    focus: string
    cancelTimer: string
    earlyFinish: string
    earlyConfirmTitle: string
    earlyConfirmMsg: (mins: number) => string
    checkInTooltip: string
    undoTooltip: string
    timingTooltip: string
    completedPill: string
  }
  blockDrop: {
    plusOne: string
    completedHabit: (name: string) => string
    skip: string
    progress: (placed: number, total: number, pct: number) => string
    completedBlueprint: (name: string) => string
    nextTargetUnlocked: (name: string) => string
  }
  build: {
    blocksCount: (placed: number, total: number) => string
    polaroidBtn: string
    galleryBtn: string
    rotCcw: string
    rotCw: string
    nextTargetPrompt: string
    startBuildBtn: string
    ceremonyTitle: (name: string) => string
    ceremonySubtitle: (total: number) => string
    exploreShowcase: string
  }
  showcase: {
    title: string
    countDisplay: (count: number) => string
    autoArrange: string
    dragHint: string
    emptyHint: string
  }
  stats: {
    title: string
    subtitle: string
    focusHours: (hours: string) => string
    repairBricksBadge: (count: number) => string
    repairBricksTooltip: string
    empty: string
    currentStreak: (days: number) => string
    bestStreak: (days: number) => string
    totalCount: (times: number) => string
    totalFocusTime: (hours: string) => string
    repairDialogTitle: string
    repairDialogMsg: (habitName: string, date: string, count: number) => string
    repairSuccessToast: (name: string) => string
    repairLimitToast: string
    repairNoBricksToast: string
    heatmapDone: string
    heatmapRepair: string
  }
  habitDialog: {
    newTitle: string
    editTitle: string
    typeLabel: string
    instant: string
    focus: string
    counter: string
    nameLabel: string
    placeholderInstant: string
    placeholderFocus: string
    placeholderCounter: string
    counterTarget: string
    counterStep: string
    counterUnit: string
    categoryLabel: string
    categoryPlaceholder: string
    freqLabel: string
    freqDaily: string
    freqCustom: string
    freqWeekly: string
    selectWorkdays: string
    selectWeekends: string
    selectAll: string
    selectAtLeastOne: string
    timesPerWeek: (times: number) => string
    periodLabel: string
    durationLabel: string
    durationUnit: string
    noteLabel: string
    notePlaceholder: string
    archiveBtn: string
  }
  gallery: {
    title: string
    completed: string
    inProgress: string
    locked: string
    blocks: (placed: number, total: number) => string
    switchTarget: string
    currentTarget: string
  }
  polaroid: {
    modalTitle: string
    cardTitle: (name: string) => string
    cardDetails: (blocks: number, date: string) => string
    savePng: string
    copyImage: string
    copiedToast: string
    copyFailedToast: string
  }
  settings: {
    title: string
    languageLabel: string
    langZh: string
    langEn: string
    themeLabel: string
    themeLight: string
    themeDark: string
    themeOat: string
    themeFog: string
    shortcutsTitle: string
    shortcutsDetail: string
    soundLabel: string
    soundOn: string
    soundOff: string
    autostartLabel: string
    autostartOn: string
    autostartOff: string
    dataLabel: string
    exportJson: string
    importJson: string
    importSuccess: string
    importFail: string
    assetSummaryTitle: string
    assetSummaryDetail: (habits: number, buildings: number) => string
    repairInventory: string
    slogan: string
  }
  mini: {
    expandTooltip: string
    closeTooltip: string
    toastQuickCheckIn: (name: string) => string
    toastComplete: (name: string) => string
    allDone: string
    habitCheckInTip: (name: string) => string
  }
  blueprints: Record<string, string>
  tray: {
    tooltipDone: string
    tooltipProgress: (done: number, total: number) => string
    pendingLabel: (count: number) => string
    allDoneLabel: string
    openMain: string
    quit: string
  }
  microMood: {
    energetic: string
    hard: string
    spark: string
    calm: string
  }
  reflections: {
    engravePlaceholder: string
    engraveAction: string
    engravedToast: string
    starTooltip: string
    unstarTooltip: string
    foundationModalTitle: string
    foundationPrompt: string
    foundationPlaceholder: string
    foundationSave: string
    foundationSavedToast: string
    brickInspectTitle: (index: number) => string
    brickInspectFrom: (name: string, date: string) => string
    brickInspectNoNote: string
    brickInspectEditHint: string
    chronicleTitle: string
    chronicleSubtitle: string
    searchPlaceholder: string
    filterAll: string
    onlyStarred: string
    emptyChronicle: string
    echoTitle: string
    echoDaysAgo: (days: number) => string
    exportMarkdown: string
    exportSuccessToast: string
  }
}
