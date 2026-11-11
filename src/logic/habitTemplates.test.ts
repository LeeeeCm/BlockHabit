import { describe, expect, it } from 'vitest'
import { habitTemplates, templateFrequency } from './habitTemplates'

describe('habitTemplates', () => {
  it('has five unique templates with valid periods', () => {
    expect(habitTemplates).toHaveLength(5)
    expect(new Set(habitTemplates.map((t) => t.id)).size).toBe(5)
    for (const t of habitTemplates) {
      expect(['any', 'morning', 'afternoon', 'evening']).toContain(t.period)
    }
  })

  it('creates daily habits (the least surprising default)', () => {
    expect(templateFrequency()).toEqual({ type: 'daily' })
  })
})
