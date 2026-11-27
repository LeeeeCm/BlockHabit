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
  dragHint: 'Drag to arrange · Right-click a building to rotate or tuck it away',
  emptyHint:
    'No completed buildings yet. Complete daily habits to finish models, and they will be exhibited here.',
  fullHint: 'Showcase is full — some buildings could not be rearranged',
  sandboxTab: 'Islands',
  sandboxName: (n) => `Island ${n}`,
  buildingCount: (n) => `${n} placed`,
  addSandbox: 'New Island',
  addSandboxFull: 'Up to 4 islands',
  removeSandbox: 'Delete island',
  removeSandboxConfirmTitle: 'Delete this island?',
  removeSandboxConfirmMsg: (name) =>
    `Buildings on "${name}" will return to the block yard. The buildings themselves are kept.`,
  yardTab: 'Block Yard',
  yardEmpty: 'Every completed building is already on this island.',
  yardElsewhere: 'On another island',
  yardPlace: 'Place',
  yardFull: 'This island is full — tuck one building first.',
  yardPlaced: (name) => `"${name}" placed`,
  designLabel: 'Island color',
  designs: {
    moss: 'Sage',
    stone: 'Stone',
    bloom: 'Sand',
    bare: 'Bare'
  },
  contextRotate: 'Rotate 90°',
  contextTuck: 'Tuck into the block yard',
  tucked: 'Tucked into the block yard',
  rotateBlocked: 'Rotation would overlap another model — reverted',
  expandPanel: (name) => `Expand ${name}`,
  collapsePanel: (name) => `Collapse ${name}`
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
  watertower: 'Water Tower',
  station: 'Train Station',
  theater: 'Theater',
  museum: 'Museum',
  hospital: 'Hospital',
  school: 'School',
  chapel: 'Chapel',
  temple: 'Temple',
  carousel: 'Carousel',
  pier: 'Pier',
  fountain: 'Fountain',
  market: 'Market',
  stadium: 'Stadium'
}
