/**
 * Types of rating scale controls available for goal progress measurement
 */
export type ScaleType =
  | 'slider-1'      // Range slider with 1% increments
  | 'slider-10'     // Range slider with 10% increments
  | 'slider-25'     // Range slider with 25% increments
  | 'stars-3'       // 3-star rating (0, 33, 67, 100)
  | 'stars-4'       // 4-star rating (0, 25, 50, 75, 100)
  | 'stars-5'       // 5-star rating (0, 20, 40, 60, 80, 100)
  | 'stars-10'      // 10-star rating (0, 10, 20, ..., 100)
  | 'thumbs'        // Thumbs up (100) or down (0)
  | 'checkbox'      // Checked (100) or unchecked (0)
  | 'emoji'         // Happy (100) or sad (0)
  | 'likert-3'      // 3-point Likert: Disagree, Neutral, Agree
  | 'likert-5'      // 5-point Likert: Strongly Disagree to Strongly Agree
  | 'likert-7'      // 7-point Likert

/**
 * Configuration for a rating scale
 */
export interface ScaleConfig {
  /** The type of scale control to display */
  type: ScaleType
  /** Optional custom labels for Likert scales */
  labels?: string[]
  /** Whether to show numeric percentage alongside the control */
  showPercentage?: boolean
}

/**
 * Default scale configuration (backward compatible with existing goals)
 */
export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  type: 'slider-1',
  showPercentage: true,
}

/**
 * Get the increment step for a given scale type
 */
export function getScaleIncrement(type: ScaleType): number {
  switch (type) {
    case 'slider-1':
      return 1
    case 'slider-10':
      return 10
    case 'slider-25':
      return 25
    case 'stars-3':
      return 100 / 3
    case 'stars-4':
      return 25
    case 'stars-5':
      return 20
    case 'stars-10':
      return 10
    case 'thumbs':
    case 'checkbox':
    case 'emoji':
      return 100
    case 'likert-3':
      return 50
    case 'likert-5':
      return 25
    case 'likert-7':
      return 100 / 6
    default:
      return 1
  }
}

/**
 * Get valid values for a given scale type
 */
export function getScaleValues(type: ScaleType): number[] {
  const increment = getScaleIncrement(type)
  const values: number[] = []
  
  for (let i = 0; i <= 100; i += increment) {
    values.push(Math.round(i))
  }
  
  // Ensure 100 is always included
  if (values[values.length - 1] !== 100) {
    values.push(100)
  }
  
  return values
}

/**
 * Snap a value to the nearest valid value for a scale type
 */
export function snapToScale(value: number, type: ScaleType): number {
  const values = getScaleValues(type)
  let closest = values[0]
  let minDiff = Math.abs(value - closest)
  
  for (const v of values) {
    const diff = Math.abs(value - v)
    if (diff < minDiff) {
      minDiff = diff
      closest = v
    }
  }
  
  return closest
}

/**
 * Get display label for a Likert scale point
 */
export function getLikertLabel(type: ScaleType, value: number, customLabels?: string[]): string {
  const values = getScaleValues(type)
  const index = values.indexOf(value)
  
  if (index === -1) return ''
  
  if (customLabels && customLabels[index]) {
    return customLabels[index]
  }
  
  // Default Likert labels
  switch (type) {
    case 'likert-3':
      return ['Disagree', 'Neutral', 'Agree'][index]
    case 'likert-5':
      return ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'][index]
    case 'likert-7':
      return ['Strongly Disagree', 'Disagree', 'Somewhat Disagree', 'Neutral', 'Somewhat Agree', 'Agree', 'Strongly Agree'][index]
    default:
      return ''
  }
}

/**
 * Get a human-readable name for a scale type
 */
export function getScaleTypeName(type: ScaleType): string {
  const names: Record<ScaleType, string> = {
    'slider-1': 'Slider (1% increments)',
    'slider-10': 'Slider (10% increments)',
    'slider-25': 'Slider (25% increments)',
    'stars-3': '3-Star Rating',
    'stars-4': '4-Star Rating',
    'stars-5': '5-Star Rating',
    'stars-10': '10-Star Rating',
    'thumbs': 'Thumbs Up/Down',
    'checkbox': 'Checkbox',
    'emoji': 'Happy/Sad Face',
    'likert-3': '3-Point Likert Scale',
    'likert-5': '5-Point Likert Scale',
    'likert-7': '7-Point Likert Scale',
  }
  return names[type]
}
