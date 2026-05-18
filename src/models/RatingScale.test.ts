import { describe, it, expect } from 'vitest'
import {
  getScaleIncrement,
  getScaleValues,
  snapToScale,
  getLikertLabel,
  getScaleTypeName,
  DEFAULT_SCALE_CONFIG,
} from './RatingScale'

describe('RatingScale', () => {
  describe('DEFAULT_SCALE_CONFIG', () => {
    it('defaults to slider-1 with percentage display', () => {
      expect(DEFAULT_SCALE_CONFIG).toEqual({
        type: 'slider-1',
        showPercentage: true,
      })
    })
  })

  describe('getScaleIncrement', () => {
    it('returns 1 for slider-1', () => {
      expect(getScaleIncrement('slider-1')).toBe(1)
    })

    it('returns 10 for slider-10', () => {
      expect(getScaleIncrement('slider-10')).toBe(10)
    })

    it('returns 25 for slider-25', () => {
      expect(getScaleIncrement('slider-25')).toBe(25)
    })

    it('returns 33.33... for stars-3', () => {
      expect(getScaleIncrement('stars-3')).toBeCloseTo(33.33, 2)
    })

    it('returns 25 for stars-4', () => {
      expect(getScaleIncrement('stars-4')).toBe(25)
    })

    it('returns 20 for stars-5', () => {
      expect(getScaleIncrement('stars-5')).toBe(20)
    })

    it('returns 10 for stars-10', () => {
      expect(getScaleIncrement('stars-10')).toBe(10)
    })

    it('returns 100 for binary types', () => {
      expect(getScaleIncrement('thumbs')).toBe(100)
      expect(getScaleIncrement('checkbox')).toBe(100)
      expect(getScaleIncrement('emoji')).toBe(100)
    })

    it('returns 50 for likert-3', () => {
      expect(getScaleIncrement('likert-3')).toBe(50)
    })

    it('returns 25 for likert-5', () => {
      expect(getScaleIncrement('likert-5')).toBe(25)
    })

    it('returns ~16.67 for likert-7', () => {
      expect(getScaleIncrement('likert-7')).toBeCloseTo(16.67, 2)
    })
  })

  describe('getScaleValues', () => {
    it('returns 0-100 in steps of 1 for slider-1', () => {
      const values = getScaleValues('slider-1')
      expect(values).toHaveLength(101)
      expect(values[0]).toBe(0)
      expect(values[1]).toBe(1)
      expect(values[100]).toBe(100)
    })

    it('returns 0-100 in steps of 10 for slider-10', () => {
      const values = getScaleValues('slider-10')
      expect(values).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    })

    it('returns 0-100 in steps of 25 for slider-25', () => {
      const values = getScaleValues('slider-25')
      expect(values).toEqual([0, 25, 50, 75, 100])
    })

    it('returns 4 values for stars-3 (0, 33, 67, 100)', () => {
      const values = getScaleValues('stars-3')
      expect(values).toHaveLength(4)
      expect(values[0]).toBe(0)
      expect(values[3]).toBe(100)
    })

    it('returns 5 values for stars-4', () => {
      const values = getScaleValues('stars-4')
      expect(values).toEqual([0, 25, 50, 75, 100])
    })

    it('returns 6 values for stars-5', () => {
      const values = getScaleValues('stars-5')
      expect(values).toEqual([0, 20, 40, 60, 80, 100])
    })

    it('returns 11 values for stars-10', () => {
      const values = getScaleValues('stars-10')
      expect(values).toHaveLength(11)
      expect(values).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    })

    it('returns only 0 and 100 for binary types', () => {
      expect(getScaleValues('thumbs')).toEqual([0, 100])
      expect(getScaleValues('checkbox')).toEqual([0, 100])
      expect(getScaleValues('emoji')).toEqual([0, 100])
    })

    it('returns 3 values for likert-3', () => {
      const values = getScaleValues('likert-3')
      expect(values).toEqual([0, 50, 100])
    })

    it('returns 5 values for likert-5', () => {
      const values = getScaleValues('likert-5')
      expect(values).toEqual([0, 25, 50, 75, 100])
    })

    it('returns 7 values for likert-7', () => {
      const values = getScaleValues('likert-7')
      expect(values).toHaveLength(7)
      expect(values[0]).toBe(0)
      expect(values[6]).toBe(100)
    })

    it('always includes 100 as the last value', () => {
      const types: Array<any> = [
        'slider-1', 'slider-10', 'slider-25',
        'stars-3', 'stars-4', 'stars-5', 'stars-10',
        'thumbs', 'checkbox', 'emoji',
        'likert-3', 'likert-5', 'likert-7'
      ]
      types.forEach(type => {
        const values = getScaleValues(type)
        expect(values[values.length - 1]).toBe(100)
      })
    })
  })

  describe('snapToScale', () => {
    it('snaps to nearest value for slider-10', () => {
      expect(snapToScale(0, 'slider-10')).toBe(0)
      expect(snapToScale(4, 'slider-10')).toBe(0)
      expect(snapToScale(6, 'slider-10')).toBe(10)  // Closer to 10 than 0
      expect(snapToScale(14, 'slider-10')).toBe(10)
      expect(snapToScale(16, 'slider-10')).toBe(20) // Closer to 20 than 10
      expect(snapToScale(46, 'slider-10')).toBe(50)
      expect(snapToScale(100, 'slider-10')).toBe(100)
    })

    it('snaps to nearest value for slider-25', () => {
      expect(snapToScale(0, 'slider-25')).toBe(0)
      expect(snapToScale(12, 'slider-25')).toBe(0)  // Closer to 0
      expect(snapToScale(13, 'slider-25')).toBe(25) // Closer to 25
      expect(snapToScale(37, 'slider-25')).toBe(25)
      expect(snapToScale(38, 'slider-25')).toBe(50)
      expect(snapToScale(100, 'slider-25')).toBe(100)
    })

    it('snaps to 0 or 100 for binary types', () => {
      expect(snapToScale(0, 'thumbs')).toBe(0)
      expect(snapToScale(49, 'thumbs')).toBe(0)   // Closer to 0
      expect(snapToScale(51, 'thumbs')).toBe(100) // Closer to 100
      expect(snapToScale(100, 'thumbs')).toBe(100)

      expect(snapToScale(30, 'checkbox')).toBe(0)
      expect(snapToScale(70, 'emoji')).toBe(100)
    })

    it('snaps to nearest star value for stars-5', () => {
      expect(snapToScale(0, 'stars-5')).toBe(0)   // 0 stars
      expect(snapToScale(11, 'stars-5')).toBe(20) // Closer to 1 star (20)
      expect(snapToScale(30, 'stars-5')).toBe(20) // Closer to 1 star
      expect(snapToScale(31, 'stars-5')).toBe(40) // Closer to 2 stars
      expect(snapToScale(50, 'stars-5')).toBe(40) // Closer to 2 stars
      expect(snapToScale(70, 'stars-5')).toBe(60) // Closer to 3 stars
      expect(snapToScale(90, 'stars-5')).toBe(80) // Closer to 4 stars
      expect(snapToScale(100, 'stars-5')).toBe(100) // 5 stars
    })

    it('snaps to nearest Likert value for likert-5', () => {
      expect(snapToScale(0, 'likert-5')).toBe(0)
      expect(snapToScale(12, 'likert-5')).toBe(0)  // Closer to 0
      expect(snapToScale(13, 'likert-5')).toBe(25) // Closer to 25
      expect(snapToScale(37, 'likert-5')).toBe(25)
      expect(snapToScale(38, 'likert-5')).toBe(50)
      expect(snapToScale(62, 'likert-5')).toBe(50)
      expect(snapToScale(63, 'likert-5')).toBe(75)
      expect(snapToScale(87, 'likert-5')).toBe(75)
      expect(snapToScale(88, 'likert-5')).toBe(100)
    })

    it('handles edge cases (negative, > 100)', () => {
      // Values outside 0-100 should snap to nearest valid value
      expect(snapToScale(-10, 'slider-10')).toBe(0)
      expect(snapToScale(110, 'slider-10')).toBe(100)
    })
  })

  describe('getLikertLabel', () => {
    it('returns correct labels for likert-3', () => {
      expect(getLikertLabel('likert-3', 0)).toBe('Disagree')
      expect(getLikertLabel('likert-3', 50)).toBe('Neutral')
      expect(getLikertLabel('likert-3', 100)).toBe('Agree')
    })

    it('returns correct labels for likert-5', () => {
      expect(getLikertLabel('likert-5', 0)).toBe('Strongly Disagree')
      expect(getLikertLabel('likert-5', 25)).toBe('Disagree')
      expect(getLikertLabel('likert-5', 50)).toBe('Neutral')
      expect(getLikertLabel('likert-5', 75)).toBe('Agree')
      expect(getLikertLabel('likert-5', 100)).toBe('Strongly Agree')
    })

    it('returns correct labels for likert-7', () => {
      const values = getScaleValues('likert-7')
      expect(getLikertLabel('likert-7', values[0])).toBe('Strongly Disagree')
      expect(getLikertLabel('likert-7', values[1])).toBe('Disagree')
      expect(getLikertLabel('likert-7', values[2])).toBe('Somewhat Disagree')
      expect(getLikertLabel('likert-7', values[3])).toBe('Neutral')
      expect(getLikertLabel('likert-7', values[4])).toBe('Somewhat Agree')
      expect(getLikertLabel('likert-7', values[5])).toBe('Agree')
      expect(getLikertLabel('likert-7', values[6])).toBe('Strongly Agree')
    })

    it('uses custom labels when provided', () => {
      const custom = ['Bad', 'Okay', 'Good']
      expect(getLikertLabel('likert-3', 0, custom)).toBe('Bad')
      expect(getLikertLabel('likert-3', 50, custom)).toBe('Okay')
      expect(getLikertLabel('likert-3', 100, custom)).toBe('Good')
    })

    it('returns empty string for non-likert types', () => {
      expect(getLikertLabel('slider-1', 50)).toBe('')
      expect(getLikertLabel('stars-5', 60)).toBe('')
      expect(getLikertLabel('thumbs', 100)).toBe('')
    })

    it('returns empty string for invalid values', () => {
      expect(getLikertLabel('likert-5', 13)).toBe('') // Not a valid point
    })
  })

  describe('getScaleTypeName', () => {
    it('returns correct names for slider types', () => {
      expect(getScaleTypeName('slider-1')).toBe('Slider (1% increments)')
      expect(getScaleTypeName('slider-10')).toBe('Slider (10% increments)')
      expect(getScaleTypeName('slider-25')).toBe('Slider (25% increments)')
    })

    it('returns correct names for star types', () => {
      expect(getScaleTypeName('stars-3')).toBe('3-Star Rating')
      expect(getScaleTypeName('stars-4')).toBe('4-Star Rating')
      expect(getScaleTypeName('stars-5')).toBe('5-Star Rating')
      expect(getScaleTypeName('stars-10')).toBe('10-Star Rating')
    })

    it('returns correct names for binary types', () => {
      expect(getScaleTypeName('thumbs')).toBe('Thumbs Up/Down')
      expect(getScaleTypeName('checkbox')).toBe('Checkbox')
      expect(getScaleTypeName('emoji')).toBe('Happy/Sad Face')
    })

    it('returns correct names for Likert types', () => {
      expect(getScaleTypeName('likert-3')).toBe('3-Point Likert Scale')
      expect(getScaleTypeName('likert-5')).toBe('5-Point Likert Scale')
      expect(getScaleTypeName('likert-7')).toBe('7-Point Likert Scale')
    })
  })
})
