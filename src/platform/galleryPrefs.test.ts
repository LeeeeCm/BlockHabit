import { beforeEach, describe, expect, it } from 'vitest'
import {
  GALLERY_PET_FIRST_KEY,
  loadPetBlueprintsFirst,
  savePetBlueprintsFirst
} from './galleryPrefs'

describe('galleryPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to buildings first when nothing is stored', () => {
    expect(loadPetBlueprintsFirst()).toBe(false)
  })

  it('round-trips an explicit pin / unpin choice', () => {
    savePetBlueprintsFirst(true)
    expect(loadPetBlueprintsFirst()).toBe(true)
    savePetBlueprintsFirst(false)
    expect(loadPetBlueprintsFirst()).toBe(false)
  })

  it('treats unknown or corrupted values as the default', () => {
    localStorage.setItem(GALLERY_PET_FIRST_KEY, 'yes')
    expect(loadPetBlueprintsFirst()).toBe(false)
    localStorage.setItem(GALLERY_PET_FIRST_KEY, '{not-json')
    expect(loadPetBlueprintsFirst()).toBe(false)
  })
})
