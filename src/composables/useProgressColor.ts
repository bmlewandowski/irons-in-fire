/**
 * Shared progress-colour and weighted-average utilities used across
 * NodeComponent, GoalCard, DrillDownPanel, ExecutiveDashboard, and
 * ProgressService.
 */

/**
 * Returns a colour string for a progress percentage:
 *   ≥ 80 % → dark green  (#2e7d32)
 *   ≥ 50 % → dark blue   (#1565c0)
 *   ≥ 25 % → dark orange (#e65100)
 *    < 25 % → dark red    (#b71c1c)
 */
export function progressColor(pct: number): string {
  if (pct >= 80) return '#2e7d32'
  if (pct >= 50) return '#1565c0'
  if (pct >= 25) return '#e65100'
  return '#b71c1c'
}

/**
 * Weighted average of progress values.
 * Accepts any array whose elements have `weight` and `progress` number fields.
 * Non-finite weights are treated as 0.  Returns 0 when Σweights === 0.
 * Result is clamped to [0, 100].
 */
export function computeWeightedProgress(
  items: ReadonlyArray<{ weight: number; progress: number }>,
): number {
  let weightedSum = 0
  let totalWeight = 0
  for (const item of items) {
    const w = typeof item.weight === 'number' && isFinite(item.weight) ? item.weight : 0
    weightedSum += w * item.progress
    totalWeight += w
  }
  if (totalWeight === 0) return 0
  return Math.min(100, Math.max(0, weightedSum / totalWeight))
}
