/**
 * Represents the current visible viewport rectangle on the org-chart canvas.
 * Used by OrgChartContainer for lazy viewport rendering (Req 2.6):
 * nodes whose bounding box does not intersect this rect are omitted from the DOM.
 */
export interface ViewportRect {
  /** Left edge of the viewport in canvas coordinates */
  x: number
  /** Top edge of the viewport in canvas coordinates */
  y: number
  /** Width of the viewport in canvas coordinates */
  width: number
  /** Height of the viewport in canvas coordinates */
  height: number
}
