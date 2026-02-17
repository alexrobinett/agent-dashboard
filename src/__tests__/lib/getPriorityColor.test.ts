import { describe, it, expect } from 'vitest'
import { getPriorityColor } from '../../lib/utils'

describe('getPriorityColor', () => {
  it('should return #EF4444 (red) for high priority', () => {
    expect(getPriorityColor('high')).toBe('#EF4444')
  })

  it('should return #F59E0B (amber) for normal priority', () => {
    expect(getPriorityColor('normal')).toBe('#F59E0B')
  })

  it('should return #F59E0B (amber) for medium priority', () => {
    expect(getPriorityColor('medium')).toBe('#F59E0B')
  })

  it('should return #3B82F6 (blue) for low priority', () => {
    expect(getPriorityColor('low')).toBe('#3B82F6')
  })

  it('should return #6B7280 (gray) for undefined priority', () => {
    expect(getPriorityColor(undefined)).toBe('#6B7280')
  })

  it('should return #6B7280 (gray) for unknown priority values', () => {
    expect(getPriorityColor('critical')).toBe('#6B7280')
    expect(getPriorityColor('urgent')).toBe('#6B7280')
  })

  it('should be case-insensitive', () => {
    expect(getPriorityColor('HIGH')).toBe('#EF4444')
    expect(getPriorityColor('High')).toBe('#EF4444')
    expect(getPriorityColor('NORMAL')).toBe('#F59E0B')
    expect(getPriorityColor('Low')).toBe('#3B82F6')
  })
})
