import { describe, it, expect } from 'vitest'
import {
  validateNodeTitle,
  validateOwnerName,
  validateCustomRoleLabel,
  validateGoalDescription,
  validateGoalWeight,
  validateGoalStatus,
  validateGoalType,
  validateCreateNodeInput,
  validateUpdateNodeInput,
  validateCreateGoalInput,
  validateUpdateGoalInput,
} from './ValidationService'
import type {
  CreateNodeInput,
  CreateGoalInput,
} from './ValidationService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Repeat a character n times. */
function repeat(char: string, n: number): string {
  return char.repeat(n)
}

// ---------------------------------------------------------------------------
// validateNodeTitle — Req 1.4, 10.3
// ---------------------------------------------------------------------------

describe('validateNodeTitle', () => {
  it('returns null for a valid title', () => {
    expect(validateNodeTitle('Engineering')).toBeNull()
  })

  it('returns null for a single character title', () => {
    expect(validateNodeTitle('A')).toBeNull()
  })

  it('returns null for a title at exactly 100 chars', () => {
    expect(validateNodeTitle(repeat('a', 100))).toBeNull()
  })

  it('returns VALIDATION_ERROR for an empty string', () => {
    const err = validateNodeTitle('')
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('title')
    expect(err!.constraint).toContain('non_empty')
  })

  it('returns VALIDATION_ERROR for a whitespace-only string', () => {
    const err = validateNodeTitle('   ')
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('title')
  })

  it('returns VALIDATION_ERROR for a title of 101 chars (max+1)', () => {
    const err = validateNodeTitle(repeat('a', 101))
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('title')
    expect(err!.constraint).toContain('max_length:100')
  })

  it('error includes field and constraint (Req 10.5, 10.7)', () => {
    const err = validateNodeTitle(repeat('x', 200))
    expect(err!.field).toBeDefined()
    expect(err!.constraint).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// validateOwnerName — Req 1.4
// ---------------------------------------------------------------------------

describe('validateOwnerName', () => {
  it('returns null for a valid owner name', () => {
    expect(validateOwnerName('Alice Smith')).toBeNull()
  })

  it('returns null for a name at exactly 100 chars', () => {
    expect(validateOwnerName(repeat('b', 100))).toBeNull()
  })

  it('returns VALIDATION_ERROR for an empty string', () => {
    const err = validateOwnerName('')
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('ownerName')
    expect(err!.constraint).toContain('non_empty')
  })

  it('returns VALIDATION_ERROR for a whitespace-only string', () => {
    const err = validateOwnerName('  ')
    expect(err).not.toBeNull()
    expect(err!.field).toBe('ownerName')
  })

  it('returns VALIDATION_ERROR for a name of 101 chars (max+1)', () => {
    const err = validateOwnerName(repeat('c', 101))
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('ownerName')
    expect(err!.constraint).toContain('max_length:100')
  })
})

// ---------------------------------------------------------------------------
// validateCustomRoleLabel — Req 1.7, 1.8
// ---------------------------------------------------------------------------

describe('validateCustomRoleLabel', () => {
  it('returns null for a valid label', () => {
    expect(validateCustomRoleLabel('Team Lead')).toBeNull()
  })

  it('returns null for a label at exactly 50 chars', () => {
    expect(validateCustomRoleLabel(repeat('d', 50))).toBeNull()
  })

  it('returns VALIDATION_ERROR for an empty string', () => {
    const err = validateCustomRoleLabel('')
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('customRoleLabel')
    expect(err!.constraint).toContain('non_empty')
  })

  it('returns VALIDATION_ERROR for a whitespace-only string', () => {
    const err = validateCustomRoleLabel('   ')
    expect(err).not.toBeNull()
    expect(err!.field).toBe('customRoleLabel')
  })

  it('returns VALIDATION_ERROR for a label of 51 chars (max+1)', () => {
    const err = validateCustomRoleLabel(repeat('e', 51))
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('customRoleLabel')
    expect(err!.constraint).toContain('max_length:50')
  })
})

// ---------------------------------------------------------------------------
// validateGoalDescription — Req 4.1, 10.4
// ---------------------------------------------------------------------------

describe('validateGoalDescription', () => {
  it('returns null for a valid description', () => {
    expect(validateGoalDescription('Increase revenue by 10%')).toBeNull()
  })

  it('returns null for a description at exactly 500 chars', () => {
    expect(validateGoalDescription(repeat('f', 500))).toBeNull()
  })

  it('returns VALIDATION_ERROR for an empty string', () => {
    const err = validateGoalDescription('')
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('description')
    expect(err!.constraint).toContain('non_empty')
  })

  it('returns VALIDATION_ERROR for a whitespace-only string', () => {
    const err = validateGoalDescription('   ')
    expect(err).not.toBeNull()
    expect(err!.field).toBe('description')
  })

  it('returns VALIDATION_ERROR for a description of 501 chars (pre-sanitization max+1)', () => {
    const err = validateGoalDescription(repeat('g', 501))
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('description')
    expect(err!.constraint).toContain('max_length:500')
  })

  it('returns VALIDATION_ERROR when post-sanitization length exceeds 1000 chars (Req 10.4)', () => {
    // Each '&' expands to '&amp;' (5 chars), so 200 '&' chars → 1000 chars post-sanitization.
    // 201 '&' chars → 1005 chars post-sanitization, which exceeds 1000.
    // But we also need to stay under the 500 pre-sanitization limit.
    // 200 '&' chars is exactly 200 pre-sanitization chars (under 500), and 1000 post-sanitization.
    // 201 '&' chars is 201 pre-sanitization (under 500), and 1005 post-sanitization (over 1000).
    const input = repeat('&', 201)
    const err = validateGoalDescription(input)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('description')
    expect(err!.constraint).toContain('max_length_post_sanitization:1000')
  })

  it('returns null for 200 & chars (exactly 1000 post-sanitization)', () => {
    // 200 '&' → 200 pre-sanitization (≤500), 1000 post-sanitization (≤1000)
    expect(validateGoalDescription(repeat('&', 200))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// validateGoalWeight — Req 4.1, 4.5, 10.1
// ---------------------------------------------------------------------------

describe('validateGoalWeight', () => {
  it('returns null for weight 1 (valid)', () => {
    expect(validateGoalWeight(1)).toBeNull()
  })

  it('returns null for weight at minimum boundary 0.01', () => {
    expect(validateGoalWeight(0.01)).toBeNull()
  })

  it('returns null for weight at maximum boundary 1000', () => {
    expect(validateGoalWeight(1000)).toBeNull()
  })

  it('returns null for weight 500 (mid-range)', () => {
    expect(validateGoalWeight(500)).toBeNull()
  })

  it('returns VALIDATION_ERROR for weight 0 (below minimum)', () => {
    const err = validateGoalWeight(0)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('weight')
    expect(err!.constraint).toContain('range:')
  })

  it('returns VALIDATION_ERROR for negative weight', () => {
    const err = validateGoalWeight(-1)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('weight')
  })

  it('returns VALIDATION_ERROR for weight 1001 (above maximum)', () => {
    const err = validateGoalWeight(1001)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('weight')
    expect(err!.constraint).toContain('range:')
  })

  it('returns VALIDATION_ERROR for Infinity', () => {
    const err = validateGoalWeight(Infinity)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('weight')
  })

  it('returns VALIDATION_ERROR for -Infinity', () => {
    const err = validateGoalWeight(-Infinity)
    expect(err).not.toBeNull()
    expect(err!.field).toBe('weight')
  })

  it('returns VALIDATION_ERROR for NaN', () => {
    const err = validateGoalWeight(NaN)
    expect(err).not.toBeNull()
    expect(err!.field).toBe('weight')
  })

  it('error includes field and constraint (Req 10.5, 10.7)', () => {
    const err = validateGoalWeight(-5)
    expect(err!.field).toBeDefined()
    expect(err!.constraint).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// validateGoalStatus — Req 4.1
// ---------------------------------------------------------------------------

describe('validateGoalStatus', () => {
  it('returns null for Active', () => {
    expect(validateGoalStatus('Active')).toBeNull()
  })

  it('returns null for Refined', () => {
    expect(validateGoalStatus('Refined')).toBeNull()
  })

  it('returns null for Complete', () => {
    expect(validateGoalStatus('Complete')).toBeNull()
  })

  it('returns VALIDATION_ERROR for an invalid status', () => {
    const err = validateGoalStatus('Pending' as any)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('status')
    expect(err!.constraint).toContain('enum:')
  })

  it('returns VALIDATION_ERROR for empty string', () => {
    const err = validateGoalStatus('' as any)
    expect(err).not.toBeNull()
    expect(err!.field).toBe('status')
  })
})

// ---------------------------------------------------------------------------
// validateGoalType — Req 4.1
// ---------------------------------------------------------------------------

describe('validateGoalType', () => {
  it('returns null for Root', () => {
    expect(validateGoalType('Root')).toBeNull()
  })

  it('returns null for Refined', () => {
    expect(validateGoalType('Refined')).toBeNull()
  })

  it('returns null for Sub_Task', () => {
    expect(validateGoalType('Sub_Task')).toBeNull()
  })

  it('returns VALIDATION_ERROR for an invalid type', () => {
    const err = validateGoalType('Leaf' as any)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('VALIDATION_ERROR')
    expect(err!.field).toBe('type')
    expect(err!.constraint).toContain('enum:')
  })

  it('returns VALIDATION_ERROR for empty string', () => {
    const err = validateGoalType('' as any)
    expect(err).not.toBeNull()
    expect(err!.field).toBe('type')
  })
})

// ---------------------------------------------------------------------------
// validateCreateNodeInput — Req 1.4, 1.7, 1.8, 10.5, 10.6, 10.7
// ---------------------------------------------------------------------------

describe('validateCreateNodeInput', () => {
  const validInput: CreateNodeInput = {
    title: 'Engineering',
    ownerName: 'Alice',
    roleLevel: 'Vice President',
  }

  it('returns empty array for fully valid input', () => {
    expect(validateCreateNodeInput(validInput)).toEqual([])
  })

  it('returns empty array for valid Custom role with label', () => {
    const input: CreateNodeInput = {
      title: 'Engineering',
      ownerName: 'Alice',
      roleLevel: 'Custom',
      customRoleLabel: 'Tech Lead',
    }
    expect(validateCreateNodeInput(input)).toEqual([])
  })

  it('returns error when title is empty', () => {
    const errors = validateCreateNodeInput({ ...validInput, title: '' })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'title')).toBe(true)
  })

  it('returns error when ownerName is empty', () => {
    const errors = validateCreateNodeInput({ ...validInput, ownerName: '' })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'ownerName')).toBe(true)
  })

  it('returns error when roleLevel is Custom but customRoleLabel is missing', () => {
    const errors = validateCreateNodeInput({
      title: 'Engineering',
      ownerName: 'Alice',
      roleLevel: 'Custom',
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'customRoleLabel')).toBe(true)
  })

  it('returns error when roleLevel is Custom and customRoleLabel is empty', () => {
    const errors = validateCreateNodeInput({
      title: 'Engineering',
      ownerName: 'Alice',
      roleLevel: 'Custom',
      customRoleLabel: '',
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'customRoleLabel')).toBe(true)
  })

  it('returns error when roleLevel is Custom and customRoleLabel exceeds 50 chars', () => {
    const errors = validateCreateNodeInput({
      title: 'Engineering',
      ownerName: 'Alice',
      roleLevel: 'Custom',
      customRoleLabel: repeat('x', 51),
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'customRoleLabel')).toBe(true)
  })

  it('collects multiple errors for multiple invalid fields', () => {
    const errors = validateCreateNodeInput({
      title: '',
      ownerName: '',
      roleLevel: 'Custom',
    })
    // title, ownerName, and customRoleLabel should all fail
    expect(errors.length).toBeGreaterThanOrEqual(3)
    expect(errors.some((e) => e.field === 'title')).toBe(true)
    expect(errors.some((e) => e.field === 'ownerName')).toBe(true)
    expect(errors.some((e) => e.field === 'customRoleLabel')).toBe(true)
  })

  it('all errors have code VALIDATION_ERROR, field, and constraint (Req 10.5, 10.7)', () => {
    const errors = validateCreateNodeInput({ title: '', ownerName: '', roleLevel: 'Vice President' })
    for (const err of errors) {
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.field).toBeDefined()
      expect(err.constraint).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// validateUpdateNodeInput — Req 1.4, 1.7, 1.8, 10.5, 10.6, 10.7
// ---------------------------------------------------------------------------

describe('validateUpdateNodeInput', () => {
  it('returns empty array for empty update (no fields)', () => {
    expect(validateUpdateNodeInput({})).toEqual([])
  })

  it('returns empty array for valid partial update (title only)', () => {
    expect(validateUpdateNodeInput({ title: 'New Title' })).toEqual([])
  })

  it('returns empty array for valid partial update (ownerName only)', () => {
    expect(validateUpdateNodeInput({ ownerName: 'Bob' })).toEqual([])
  })

  it('returns error when provided title is empty', () => {
    const errors = validateUpdateNodeInput({ title: '' })
    expect(errors.some((e) => e.field === 'title')).toBe(true)
  })

  it('returns error when provided ownerName is empty', () => {
    const errors = validateUpdateNodeInput({ ownerName: '' })
    expect(errors.some((e) => e.field === 'ownerName')).toBe(true)
  })

  it('returns error when roleLevel is Custom but customRoleLabel is missing', () => {
    const errors = validateUpdateNodeInput({ roleLevel: 'Custom' })
    expect(errors.some((e) => e.field === 'customRoleLabel')).toBe(true)
  })

  it('returns empty array when roleLevel is Custom and customRoleLabel is valid', () => {
    const errors = validateUpdateNodeInput({ roleLevel: 'Custom', customRoleLabel: 'Architect' })
    expect(errors).toEqual([])
  })

  it('does not validate title when title is not in the update', () => {
    // Only ownerName is provided; title is absent — should not produce title error
    const errors = validateUpdateNodeInput({ ownerName: 'Carol' })
    expect(errors.some((e) => e.field === 'title')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateCreateGoalInput — Req 4.1, 4.5, 10.1, 10.5, 10.6, 10.7
// ---------------------------------------------------------------------------

describe('validateCreateGoalInput', () => {
  const validInput: CreateGoalInput = {
    nodeId: 'node-1',
    type: 'Root',
    description: 'Increase revenue',
    weight: 1,
    status: 'Active',
  }

  it('returns empty array for fully valid input', () => {
    expect(validateCreateGoalInput(validInput)).toEqual([])
  })

  it('returns error when description is empty', () => {
    const errors = validateCreateGoalInput({ ...validInput, description: '' })
    expect(errors.some((e) => e.field === 'description')).toBe(true)
  })

  it('returns error when weight is 0', () => {
    const errors = validateCreateGoalInput({ ...validInput, weight: 0 })
    expect(errors.some((e) => e.field === 'weight')).toBe(true)
  })

  it('returns error when weight is negative', () => {
    const errors = validateCreateGoalInput({ ...validInput, weight: -5 })
    expect(errors.some((e) => e.field === 'weight')).toBe(true)
  })

  it('returns error when weight exceeds 1000', () => {
    const errors = validateCreateGoalInput({ ...validInput, weight: 1001 })
    expect(errors.some((e) => e.field === 'weight')).toBe(true)
  })

  it('returns error when status is invalid', () => {
    const errors = validateCreateGoalInput({ ...validInput, status: 'Pending' as any })
    expect(errors.some((e) => e.field === 'status')).toBe(true)
  })

  it('returns error when type is invalid', () => {
    const errors = validateCreateGoalInput({ ...validInput, type: 'Leaf' as any })
    expect(errors.some((e) => e.field === 'type')).toBe(true)
  })

  it('collects multiple errors for multiple invalid fields', () => {
    const errors = validateCreateGoalInput({
      nodeId: 'node-1',
      type: 'Leaf' as any,
      description: '',
      weight: -1,
      status: 'Pending' as any,
    })
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })

  it('all errors have code VALIDATION_ERROR, field, and constraint (Req 10.5, 10.7)', () => {
    const errors = validateCreateGoalInput({
      ...validInput,
      description: '',
      weight: -1,
    })
    for (const err of errors) {
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.field).toBeDefined()
      expect(err.constraint).toBeDefined()
    }
  })

  it('accepts weight at minimum boundary 0.01', () => {
    expect(validateCreateGoalInput({ ...validInput, weight: 0.01 })).toEqual([])
  })

  it('accepts weight at maximum boundary 1000', () => {
    expect(validateCreateGoalInput({ ...validInput, weight: 1000 })).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// validateUpdateGoalInput — Req 4.1, 4.5, 10.1, 10.5, 10.6, 10.7
// ---------------------------------------------------------------------------

describe('validateUpdateGoalInput', () => {
  it('returns empty array for empty update (no fields)', () => {
    expect(validateUpdateGoalInput({})).toEqual([])
  })

  it('returns empty array for valid partial update (description only)', () => {
    expect(validateUpdateGoalInput({ description: 'Updated description' })).toEqual([])
  })

  it('returns empty array for valid partial update (weight only)', () => {
    expect(validateUpdateGoalInput({ weight: 5 })).toEqual([])
  })

  it('returns empty array for valid partial update (status only)', () => {
    expect(validateUpdateGoalInput({ status: 'Complete' })).toEqual([])
  })

  it('returns error when provided description is empty', () => {
    const errors = validateUpdateGoalInput({ description: '' })
    expect(errors.some((e) => e.field === 'description')).toBe(true)
  })

  it('returns error when provided weight is 0', () => {
    const errors = validateUpdateGoalInput({ weight: 0 })
    expect(errors.some((e) => e.field === 'weight')).toBe(true)
  })

  it('returns error when provided weight is above 1000', () => {
    const errors = validateUpdateGoalInput({ weight: 1001 })
    expect(errors.some((e) => e.field === 'weight')).toBe(true)
  })

  it('returns error when provided status is invalid', () => {
    const errors = validateUpdateGoalInput({ status: 'Archived' as any })
    expect(errors.some((e) => e.field === 'status')).toBe(true)
  })

  it('returns error when provided type is invalid', () => {
    const errors = validateUpdateGoalInput({ type: 'Unknown' as any })
    expect(errors.some((e) => e.field === 'type')).toBe(true)
  })

  it('does not validate description when description is not in the update', () => {
    const errors = validateUpdateGoalInput({ weight: 5 })
    expect(errors.some((e) => e.field === 'description')).toBe(false)
  })

  it('does not validate weight when weight is not in the update', () => {
    const errors = validateUpdateGoalInput({ status: 'Active' })
    expect(errors.some((e) => e.field === 'weight')).toBe(false)
  })

  it('collects errors for multiple invalid fields', () => {
    const errors = validateUpdateGoalInput({
      description: '',
      weight: -1,
      status: 'Archived' as any,
    })
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })

  it('all errors have code VALIDATION_ERROR, field, and constraint (Req 10.5, 10.7)', () => {
    const errors = validateUpdateGoalInput({ description: '', weight: -1 })
    for (const err of errors) {
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.field).toBeDefined()
      expect(err.constraint).toBeDefined()
    }
  })
})
