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
    weekdays: string[]
    weekdaysShort: string[]
    weekdaysSingle: string[]
    dateHeader: (year: number, month: number, date: number, weekday: string) => string
    timeMinutes: (minutes: number) => string
    dismiss: string
  }
  /** 无障碍朗读文案 */
  a11y: {
    unfinishedHabits: string
    bottomNav: string
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
    earlyConfirmMsg: (mins: number) => string
    checkInTooltip: string
    undoTooltip: string
    timingTooltip: string
    completedPill: string
    readyToFinish: string
    fullCard: {
      title: string
      subtitlePlaced: string
      subtitlePending: string
      claimToast: string
      bonusHabitName: string
      /** 打卡存在但习惯已被删除时的气泡名 */
      deletedHabitName: string
      claimBtn: string
      claimed: string
    }
    view3dModel: string
    filterAll: string
    startJourney: string
    inRestPeriod: string
    unpinHabit: string
    pinHabit: string
    addReflectionPlaceholder: string
    focusedMinutes: (mins: number) => string
    timerDoneNotify: (name: string) => string
  }
  blockDrop: {
    plusOne: string
    completedHabit: (name: string) => string
    skip: string
    progress: (placed: number, total: number, pct: number) => string
    completedBlueprint: (name: string) => string
  }
  build: {
    blocksCount: (placed: number, total: number) => string
    polaroidBtn: string
    galleryBtn: string
    rotCcw: string
    rotCw: string
    nextTargetPrompt: (name: string) => string
    startBuildBtn: string
    ceremonyTitle: (name: string) => string
    ceremonySubtitle: (total: number) => string
    dedication: string
    dedicate: string
    xray: {
      toggleTooltip: string
      btn: string
    }
    foundationGuide: (name: string) => string
  }
  showcase: {
    title: string
    countDisplay: (count: number) => string
    autoArrange: string
    dragHint: string
    emptyHint: string
    fullHint: string
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
    repairDialogTitle: string
    repairDialogMsg: (habitName: string, date: string, count: number) => string
    repairSuccessToast: (name: string) => string
    repairAlreadyToast: string
    repairNoHabitToast: string
    repairArchivedToast: string
    repairFutureToast: string
    repairFailToast: string
    repairLimitToast: string
    repairNoBricksToast: string
    heatmapDone: string
    heatmapRepair: string
    exportTitle: string
    exportDate: string
    exportCount: (n: number) => string
    exportFocus: string
    exportMood: string
    exportFeatured: string
    exportReflection: string
    posterTooltip: string
    posterBtn: string
    tabMetrics: string
    tabChronicle: string
    metric: {
      focusTime: string
      currentStreak: string
      bestStreak: string
      totalCheckIns: string
      hours: (h: string) => string
      minutes: (m: number) => string
    }
    recentReflections: string
    exportMd: string
    allMoods: string
    loadMoreReflections: (cur: number, total: number) => string
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
    completePreviousFirst: string
  }
  polaroid: {
    modalTitle: string
    cardTitle: (name: string) => string
    cardDetails: (blocks: number, date: string) => string
    savePng: string
    copyImage: string
    copiedToast: string
    copyFailedToast: string
    builderChronicle: string
    foundationInscription: string
    defaultDedication: string
    emptyNotesHint: string
    modalTitleBack: string
    flipTooltip: string
    viewFront: string
    viewBack: string
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
    groupPreferences: string
    groupSystem: string
    groupData: string
    webdav: {
      groupTitle: string
      serverUrl: string
      username: string
      password: string
      passwordPlaceholder: string
      syncing: string
      lastSync: string
      notSynced: string
      syncingBtn: string
      syncNowBtn: string
      syncSuccess: string
      syncFailed: string
    }
    shortcutsTitle: string
    shortcutsDetail: string
    soundLabel: string
    volumeLabel: string
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
    importConfirmTitle: string
    importConfirmMsg: (habits: number, checkIns: number) => string
    saveFailedToast: string
    needsUpgradeToast: string
    syncErrors: {
      noEndpoint: string
      auth: string
      parse: string
      incompatible: string
      network: string
      conflict: string
      noCollection: string
      http: string
    }
    assetSummaryTitle: string
    assetSummaryDetail: (habits: number, buildings: number) => string
    repairInventory: string
    slogan: string
    ambienceTitle: string
    ambientLightingLabel: string
    ambientLightingOn: string
    ambientLightingOff: string
    ambientLightingHint: string
    gentleDecayLabel: string
    gentleDecayOn: string
    gentleDecayOff: string
    gentleDecayHint: string
    ecoPropsLabel: string
    ecoPropsOn: string
    ecoPropsOff: string
    ecoPropsHint: string
    soundMaterialLabel: string
    soundMatClassic: string
    soundMatWalnut: string
    soundMatCrystal: string
    soundMatMetal: string
    gyroscopeLabel: string
    gyroscopeOn: string
    gyroscopeOff: string
    gyroscopeHint: string
    miniWidgetLabel: string
    miniWidgetOn: string
    miniWidgetOff: string
    miniWidgetHint: string
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
    pickFromReflections: string
    clickToUseDedication: string
    echoFromHabit: (name: string) => string
  }
  poster: {
    modalTitle: string
    ratioCard45: string
    ratioStory916: string
    ratioSquare11: string
    cycleQuoteTooltip: string
    cycleQuote: (cur: number, total: number) => string
    saveImage: string
    copyImage: string
    copySuccess: string
    copyFail: string
    disciplineChronicle: string
    completedTotal: (total: number) => string
    foundationReady: (total: number) => string
    buildingProgress: (cur: number, total: number, pct: number) => string
    matrixTitle: string
    metricCheckIns: string
    metricFocusTime: string
    metricBlocksAdded: string
    metricStreak: string
    defaultQuote: string
    builderRecord: (date: string) => string
  }
}
