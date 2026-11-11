export type Language = 'zh' | 'en'

export interface TranslationSchema {
  common: {
    cancel: string
    save: string
    delete: string
    restore: string
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
    /** 今日页标题的「月 日」部分（zh: 11 月 10 日 / en: Nov 10） */
    monthDay: (month: number, date: number) => string
    /** 今日页标题的星期部分（zh: 周一 / en: Mon） */
    weekdayLabel: (weekday: string) => string
    timeMinutes: (minutes: number) => string
    dismiss: string
    /** 快捷键提示：把标签与键位拼成可读文案（D-20261110-054） */
    shortcut: (label: string, key: string) => string
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
    streakBonusToast: (days: number) => string
    periods: {
      any: string
      morning: string
      afternoon: string
      evening: string
    }
    restDay: string
    resilienceContinuation: string
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
    undoConfirmTitle: string
    undoConfirmBody: string
    undoConfirmAction: string
    timingTooltip: string
    completedPill: string
    readyToFinish: string
    fullCard: {
      title: string
      subtitlePlaced: string
      subtitlePending: string
      claimToast: string
      /** B4：领取失败的三种原因，各给一句话 */
      claimFailIncomplete: string
      claimFailAlready: string
      claimFailNoHabits: string
      /** B4：连击里程碑让这块全勤积木变成点缀色奖励块时的补充说明 */
      claimBonusToast: string
      bonusHabitName: string
      /** 打卡存在但习惯已被删除时的气泡名 */
      deletedHabitName: string
      claimBtn: string
      claimed: string
    }
    view3dModel: string
    filterAll: string
    startJourney: string
    /** F2：当前蓝图已落成但还有下一座时的提示 */
    activeCompleteNoBlock: string
    /** F2：全部蓝图落成后，打卡不再产块时的提示 */
    allBlueprintsDone: string
    /** F1 首启三步引导 */
    onboardingStep1Title: string
    onboardingStep1Body: string
    onboardingStep2Title: string
    onboardingStep2Body: string
    onboardingStep3Title: string
    onboardingStep3Body: string
    onboardingSeeBuild: string
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
    /** F1：第一块积木落下的专属说明 */
    firstBlockHint: string
  }
  build: {
    blocksCount: (placed: number, total: number) => string
    polaroidBtn: string
    galleryBtn: string
    rotCcw: string
    rotCw: string
    nextTargetPrompt: (name: string) => string
    /** F2：全部蓝图落成后的显式完成态 */
    allDoneBadge: string
    allDoneHint: (total: number) => string
    startBuildBtn: string
    ceremonyTitle: (name: string) => string
    ceremonySubtitle: (total: number) => string
    dedication: string
    dedicate: string
    ambientDawn: string
    ambientNoon: string
    ambientDusk: string
    ambientNight: string
    ambientHint: string
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
    /** D-068 自由装饰模式（全落成后解锁；旋转/植被重排仅本次会话有效） */
    decoration: string
    decorationHint: string
    exitDecoration: string
    rotateLeft: string
    rotateRight: string
    rotateBlocked: string
    ecoReshuffle: string
    ecoReshuffled: string
  }
  stats: {
    title: string
    subtitle: string
    filterByHabit: string
    focusHours: (hours: string) => string
    repairBricksBadge: (count: number, max: number) => string
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
    repairBeforeCreationToast: string
    repairFailToast: string
    repairLimitToast: string
    repairNoBricksToast: string
    heatmapDone: string
    heatmapLabel: string
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
    discardTitle: string
    discardMsg: string
    discardAction: string
    periodLabel: string
    reminderLabel: string
    reminderOff: string
    reminderOn: string
    reminderStart: string
    reminderEnd: string
    reminderHint: string
    reminderEndInvalid: string
    durationLabel: string
    durationUnit: string
    /** F1 下半：选填项折叠开关 */
    moreSettings: string
    fewerSettings: string
    noteLabel: string
    notePlaceholder: string
    archiveBtn: string
  }
  gallery: {
    title: string
    completed: string
    inProgress: string
    locked: string
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
      autoSync: string
      autoSyncOn: string
      autoSyncOff: string
      autoSyncHintOn: string
      autoSyncHintOff: string
      interval15m: string
      interval30m: string
      interval1h: string
      interval3h: string
      /** D-20261110-061：服务商预设与分步自检 */
      providerLabel: string
      providerNextcloud: string
      providerJianguoyun: string
      providerSynology: string
      providerGeneric: string
      appPasswordHint: string
      testButton: string
      testing: string
      testSuccess: string
      testFail: string
      clearCredentials: string
      stageAddress: string
      stageConnection: string
      stageAuth: string
      stageReadWrite: string
      stageCleanup: string
      diagnoseAuthHint: string
      diagnoseTlsHint: string
      diagnoseDirHint: string
      diagnoseHttpHint: string
      browserTestHint: string
      copyError: string
      copiedToast: string
      /** B1：诊断取消与 rememberPassword */
      cancelTest: string
      testCancelled: string
      testCancelledCleanupFail: string
      rememberPassword: string
      rememberPasswordOn: string
      rememberPasswordOff: string
      rememberPasswordHintOn: string
      rememberPasswordHintOff: string
      passwordStoredPlaceholder: string
      passwordKeepHint: string
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
    /** F3 备份与恢复 */
    backupsTitle: string
    backupNow: string
    openDataDir: string
    restoreLabel: string
    backupsEmpty: string
    backupKindAuto: string
    backupKindManual: string
    backupKindCorrupt: string
    backupRestore: string
    backupCreated: string
    backupCreateFail: string
    backupReadFail: string
    openDirFail: string
    importSuccess: string
    importFail: string
    importConfirmTitle: string
    importConfirmMsg: (habits: number, checkIns: number) => string
    saveFailedToast: string
    needsUpgradeToast: string
    loadFailedToast: string
    corruptRecoveredToast: string
    syncErrors: {
      noEndpoint: string
      auth: string
      parse: string
      incompatible: string
      network: string
      /** fetch 被跨域策略拦截（标准 WebDAV 服务器默认不带 CORS 头） */
      cors: string
      conflict: string
      noCollection: string
      http: string
    }
    assetSummaryTitle: string
    assetSummaryDetail: (habits: number, buildings: number) => string
    repairInventory: string
    slogan: string
    /** C2 内容路线/关于（D-20261110-063 §3.5.5 approved 范围） */
    aboutTitle: string
    aboutContent: (blueprints: number, blocks: number, contentVersion: number) => string
    aboutPaceTitle: string
    aboutPaceBody: string
    aboutUpgradeTitle: string
    aboutUpgradeBody: string
    aboutLocalTitle: string
    aboutLocalBody: string
    /** D-069 手动检查更新（发布链路未配置时诚实禁用） */
    updateTitle: string
    updateCurrent: (version: string) => string
    updateCheck: string
    updateChecking: string
    updateCancel: string
    updateLatest: string
    updateAvailable: (version: string) => string
    updateDownload: string
    updateDisabled: string
    updateError: string
    updateCheckedAt: (time: string) => string
    updateCopyDetail: string
    updateCopied: string
    updateCopyFailed: string
    /** D4：实验性开关组（默认折叠） */
    labTitle: string
    /** D4：声音分组（音效开关 + 音量） */
    soundGroupTitle: string
    /** F9 本地诊断包 */
    diagnosticsLabel: string
    diagnosticsHint: string
    diagnosticsExport: string
    diagnosticsToast: string
    diagnosticsFailToast: string
    /** F7 提醒链路自检 */
    reminderAutostartHint: string
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
    /** D-20261110-059：摆件尺寸与置顶 */
    miniSizeLabel: string
    miniSizePocket: string
    miniSizeStandard: string
    miniSizeDisplay: string
    miniSizeHint: string
    miniAlwaysOnTopLabel: string
    miniAlwaysOnTopOn: string
    miniAlwaysOnTopOff: string
    miniAlwaysOnTopHint: string
    xrayDefaultLabel: string
    xrayDefaultOn: string
    xrayDefaultOff: string
    xrayDefaultHint: string
    reminderToggleLabel: string
    reminderToggleOn: string
    reminderToggleOff: string
    reminderToggleHint: string
  }
  mini: {
    expandTooltip: string
    closeTooltip: string
    toastQuickCheckIn: (name: string) => string
    toastComplete: (name: string) => string
    allDone: string
    habitCheckInTip: (name: string) => string
    /** D-20261110-059：三档摆件共用文案 */
    todayLabel: string
    nextMilestone: (blueprint: string, remaining: number) => string
    doubleClickHint: string
  }
  /** 习惯到点提醒 */
  reminder: {
    /** 系统通知正文：首次提醒 */
    startBody: (name: string) => string
    /** 系统通知正文：截止临近催促 */
    dueSoonBody: (name: string) => string
    dialogTitle: string
    /** 条目时间行："开始 21:30" */
    startLabel: (time: string) => string
    /** 条目时间行："截止 23:00" */
    endLabel: (time: string) => string
    minutesLeft: (n: number) => string
    dueSoonBadge: string
    startBtn: string
    snoozeBtn: string
    snoozedToast: (n: number) => string
    snoozeLimitToast: string
    skipBtn: string
    skippedToast: string
    /** Today 页横幅标题 */
    bannerTitle: (count: number) => string
    bannerHint: string
  }
  blueprints: Record<string, string>
  tray: {
    tooltipDone: string
    tooltipProgress: (done: number, total: number) => string
    openMain: string
    quit: string
  }
  /** 崩溃兜底界面（ErrorBoundary） */
  errorBoundary: {
    title: string
    body: string
    reload: string
    export: string
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
  /** 今日简报（D-20261110-052） */
  todayBrief: {
    greetings: {
      night: string
      morning: string
      noon: string
      afternoon: string
      evening: string
    }
    idle: (total: number) => string
    inProgress: (done: number, total: number, pending: number) => string
    milestone: (blueprint: string, remaining: number) => string
    nextReady: (blueprint: string) => string
    startFirst: string
    viewBuild: string
  }
  /** 习惯模板（D-20261110-053） */
  templates: {
    title: string
    hint: string
    water: string
    read: string
    walk: string
    sleep: string
    ledger: string
    created: (name: string) => string
  }
  /** 页面提示（D-20261110-054） */
  guide: {
    buildTitle: string
    buildBody: string
    showcaseTitle: string
    showcaseBody: string
    statsTitle: string
    statsBody: string
    gotIt: string
    replayTitle: string
    replay: string
    replayToast: string
  }
  /** 晚间收尾提醒（D-20261110-055） */
  eveningNudge: {
    settingsTitle: string
    settingsDesc: string
    settingsTime: string
    settingsTimeNote: string
    consentTitle: string
    consentBody: (time: string) => string
    consentEnable: string
    consentLater: string
    enabledToast: string
    notificationBody: (pending: number) => string
  }
  /** 落成年鉴（D-20261110-060） */
  yearbook: {
    title: string
    entry: string
    entryTooltip: string
    yearTitle: (year: number) => string
    emptyTitle: string
    emptyBody: string
    exportPng: string
    copyPng: string
    exportMarkdown: string
    savedToast: string
    copiedToast: string
    copyFail: string
    /** B2：剪贴板不可用时自动降级下载的提示 */
    copyFallbackToast: string
    sections: {
      overview: string
      months: string
      buildings: string
      shape: string
      quote: string
    }
    metrics: {
      checkIns: string
      blocks: string
      buildings: string
      allClear: string
      longestStreak: string
      focusHours: string
      notes: string
    }
    topHabits: string
    busiestPeriod: string
    busiestWeekday: string
    noData: string
    buildingDate: (date: string) => string
    quoteFrom: (name: string) => string
    coverTitle: string
    monthsLegendLow: string
    monthsLegendHigh: string
    markdownHeading: (year: number) => string
    streakDays: (n: number) => string
    focusHoursValue: (n: number) => string
  }
  /** 一键档案包（D-20261110-062） */
  archive: {
    title: string
    exportBtn: string
    exportHint: string
    preparing: string
    progress: (done: number, total: number) => string
    success: string
    fail: string
    cancel: string
    cancelled: string
    partialRetry: string
    openDir: string
    browserZipHint: string
    contents: string
  }
  /** 建筑档案卡（D-20261110-065） */
  buildingArchive: {
    entry: string
    title: string
    completedAt: (date: string) => string
    /** B5：落成日不可考（缺 placedAt 的旧档） */
    unknownDate: string
    nth: (n: number) => string
    metrics: {
      blocks: string
      days: string
      topHabit: string
      perfectDays: string
      bonusBlocks: string
    }
    timeline: string
    firstBlock: string
    lastBlock: string
    percent: (percent: number) => string
    noteLabel: string
    notePlaceholder: string
    saveNote: string
    polaroid: string
    savePng: string
    empty: string
    close: string
    topHabitValue: (name: string, blocks: number) => string
    daysValue: (days: number) => string
  }
  /** 桌面专注陪伴（D-20261110-064） */
  focusCompanion: {
    start: string
    startHint: string
    focusing: string
    ready: string
    remaining: (text: string) => string
    confirmCheckIn: string
    extendFive: string
    giveUp: string
    giveUpConfirm: string
    gaveUp: string
    persistedHint: string
    notificationBody: (name: string) => string
    /** B4：多会话展示副行 */
    moreSessions: (n: number) => string
  }
}