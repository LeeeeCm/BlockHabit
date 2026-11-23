import type { TranslationSchema } from '../types'
import { a11y, common, errorBoundary, microMood, mini, nav, titlebar, tray } from './en/common'
import { blockDrop, templates, today } from './en/today'
import { blueprints, build, gallery, polaroid, showcase } from './en/build'
import { poster, reflections, stats } from './en/stats'
import { habitDialog } from './en/habitDialog'
import { settings } from './en/settings'
import { eveningNudge, reminder } from './en/reminders'
import { archive, buildingArchive, yearbook } from './en/yearbook'
import { focusCompanion } from './en/focusCompanion'

export const en: TranslationSchema = {
  common,
  a11y,
  nav,
  titlebar,
  today,
  blockDrop,
  build,
  showcase,
  stats,
  habitDialog,
  gallery,
  polaroid,
  settings,
  reminder,
  mini,
  blueprints,
  tray,
  errorBoundary,
  microMood,
  reflections,
  poster,
  templates,
  eveningNudge,
  yearbook,
  archive,
  buildingArchive,
  focusCompanion
}
