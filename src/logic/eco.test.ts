import { describe, it, expect } from 'vitest'
import { ecoStageFor } from './eco'
import { getTimePeriod } from '../render/iso'

describe('连胜微生态阶段（积木植被生长）', () => {
  it('maps streak thresholds to stages 0-4', () => {
    expect(ecoStageFor(0)).toBe(0)
    expect(ecoStageFor(1)).toBe(1)
    expect(ecoStageFor(6)).toBe(1)
    expect(ecoStageFor(7)).toBe(2)
    expect(ecoStageFor(20)).toBe(2)
    expect(ecoStageFor(21)).toBe(3)
    expect(ecoStageFor(99)).toBe(3)
    expect(ecoStageFor(100)).toBe(4)
    expect(ecoStageFor(365)).toBe(4)
  })

  it('getTimePeriod maps hours to ambient periods', () => {
    expect(getTimePeriod(7)).toBe('dawn')
    expect(getTimePeriod(12)).toBe('noon')
    expect(getTimePeriod(17)).toBe('dusk')
    expect(getTimePeriod(23)).toBe('night')
    expect(getTimePeriod(3)).toBe('night')
  })
})
