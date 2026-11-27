import type { TranslationSchema } from '../../types'

export const build: TranslationSchema['build'] = {
  blocksCount: (p, t) => `${p} / ${t} blocks`,
  polaroidBtn: 'Memorial Polaroid',
  galleryBtn: 'Gallery',
  rotCcw: 'Rotate 90° CCW',
  rotCw: 'Rotate 90° CW',
  nextTargetPrompt: (name) => `Next building target: ${name}`,
  allDoneBadge: 'All complete',
  allDoneHint: (total) =>
    `All ${total} blueprints are complete. Check-ins are still recorded, but there are no new bricks to drop; you can revisit any blueprint or rearrange models on the Showcase page.`,
  startBuildBtn: 'Start Building',
  ceremonyTitle: (name) => `"${name}" Completed!`,
  ceremonySubtitle: (total) => `Built with ${total} discipline blocks`,
  dedication: 'Dedication',
  dedicate: 'Dedicate',
  ambientDawn: 'Dawn',
  ambientNoon: 'Noon',
  ambientDusk: 'Dusk',
  ambientNight: 'Night Light',
  ambientHint: 'Time-aware ambient lighting: blocks shift with dawn and dusk',
  xray: {
    toggleTooltip: 'Toggle X-Ray Inspection',
    btn: 'X-Ray'
  },
  foundationGuide: (name) =>
    `The dashed border marks the foundation for "${name}".\nComplete check-ins in "Today" to drop blocks layer by layer.`
}

export const showcase: TranslationSchema['showcase'] = {
  title: 'Showcase Island',
  countDisplay: (c) => `${c} Buildings Displayed`,
  autoArrange: 'Auto Arrange',
  dragHint: 'Drag buildings to place freely · Click to view Polaroid memorial card',
  emptyHint:
    'No completed buildings yet. Complete daily habits to finish models, and they will be exhibited here.',
  fullHint: 'Showcase is full — some buildings could not be rearranged',
  decoration: 'Decorate',
  decorationHint: 'Drag to arrange, rotate models; this session only — resets on reopen',
  exitDecoration: 'Exit decor',
  rotateLeft: 'Rotate left 90°',
  rotateRight: 'Rotate right 90°',
  rotateBlocked: 'Rotation would overlap another model — reverted',
  ecoReshuffle: 'Reshuffle greenery',
  ecoReshuffled: 'Greenery reshuffled (this session only)'
}

export const gallery: TranslationSchema['gallery'] = {
  title: 'Blueprint Gallery',
  completed: 'Completed',
  inProgress: 'In Progress',
  locked: 'Locked',
  completePreviousFirst: 'Please complete the previous building first',
  totalBlocks: (total) => `${total} blocks`
}

export const polaroid: TranslationSchema['polaroid'] = {
  modalTitle: 'Building Memorial Polaroid',
  cardTitle: (name) => `"${name}"`,
  cardDetails: (blocks, date) => `Built with ${blocks} blocks · Completion Memorial · ${date}`,
  savePng: 'Save PNG',
  copyImage: 'Copy Image',
  copiedToast: 'Copied Polaroid card to clipboard!',
  copyFailedToast: 'Failed to copy. Please click Save PNG.',
  builderChronicle: 'BUILDER CHRONICLE',
  foundationInscription: 'FOUNDATION INSCRIPTION',
  defaultDedication: 'Every brick clicked builds something lasting.',
  emptyNotesHint: 'Silently crafted with focus and persistence.',
  modalTitleBack: 'Builder Journal (Back)',
  flipTooltip: 'Flip Card',
  viewFront: 'View Front',
  viewBack: 'View Back (Journal)'
}

export const blueprints: TranslationSchema['blueprints'] = {
  plant: 'Potted Plant',
  coffee: 'Morning Coffee',
  camera: 'Vintage Camera',
  windmill: 'Dutch Windmill',
  cabin: 'Alpine Cabin',
  rocket: 'Retro Rocket',
  lighthouse: 'Ocean Lighthouse',
  factory: 'Brick Workshop',
  monument: 'Era Obelisk',
  pyramid: 'Sand Pyramid',
  robot: 'Retro Robot',
  castle: 'Limestone Castle',
  treehouse: 'Forest Treehouse',
  greenhouse: 'Glass Greenhouse',
  clocktower: 'Clock Tower',
  bridge: 'Stone Bridge',
  observatory: 'Hilltop Observatory',
  library: 'Old Library',
  bakery: 'Corner Bakery',
  bookshop: 'Old Bookshop',
  postoffice: 'Post Office',
  firestation: 'Fire Station',
  watertower: 'Water Tower'
}
