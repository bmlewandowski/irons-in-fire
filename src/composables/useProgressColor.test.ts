import { describe, it, expect } from 'vitest'
import { progressColor, computeWeightedProgress } from './useProgressColor'

describe('progressColor', () => {
  it('returns #2e7d32 (dark green) at exactly 80', () => {
    expect(progressColor(80)).toBe('#2e7d32')
  })
  it('returns #2e7d32 above 80', () => {
    expect(progressColor(100)).toBe('#2e7d32')
  })
  it('returns #1565c0 (dark blue) at exactly 50', () => {
    expect(progressColor(50)).toBe('#1565c0')
  })
  it('returns #1565c0 below 80', () => {
    expect(progressColor(79)).toBe('#1565c0')
  })
  it('returns #e65100 (dark orange) at exactly 25', () => {
    expect(progressColor(25)).toBe('#e65100')
  })
  it('returns #e65100 below 50', () => {
    expect(progressColor(49)).toBe('#e65100')
  })
  it('returns #b71c1c (dark red) at 0', () => {
    expect(progressColor(0)).toBe('#b71c1c')
  })
  it('returns #b71c1c just below 25', () => {
    expect(progressColor(24)).toBe('#b71c1c')
  })
})

describe('computeWeightedProgress', () => {
  it('returns 0 for an empty array', () => {
    expect(computeWeightedProgress([])).toBe(0)
  })
  it('returns 0 when all weights are 0', () => {
    expect(computeWeightedProgress([
      { weight: 0, progress: 80 },
      { weight: 0, progress: 50 },
    ])).toBe(0)
  })
  it('returns a single item\'s progress unchanged', () => {
    expect(computeWeightedProgress([{ weight: 5, progress: 60 }])).toBe(60)
  })
  it('computes a simple average for equal weights', () => {
    expect(computeWeightedProgress([
      { weight: 1, progress: 40 },
      { weight: 1, progress: 60 },
    ])).toBe(50)
  })
  it('weights items proportionally', () => {
    expect(computeWeightedProgress([
      { weight: 1, progress: 0 },
      { weight: 3, progress: 100 },
    ])).toBe(75)
  })
  it('clamps result to 100 when progress exceeds 100', () => {
    expect(computeWeightedProgress([{ weight: 1, progress: 150 }])).toBe(100)
  })
  it('clamps result to 0 when progress is negative', () => {
    expect(computeWeightedProgress([{ weight: 1, progress: -50 }])).toBe(0)
  })
  it('treats Infinity weight as 0', () => {
    expect(computeWeightedProgress([{ weight: Infinity, progress: 100 }])).toBe(0)
  })
  it('treats NaN weight as 0', () => {
    expect(computeWeightedProgress([{ weight: NaN, progress: 50 }])).toBe(0)
  })
  it('ignores non-finite weights when finite weights are present', () => {
    expect(computeWeightedProgress([
      { weight: 1, progress: 60 },
      { weight: Infinity, progress: 100 },
    ])).toBe(60)
  })
})
