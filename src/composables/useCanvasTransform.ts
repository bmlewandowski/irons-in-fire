import { ref, computed } from 'vue'
import { useUiStore } from '@/stores/uiStore'

/**
 * Manages the SVG canvas pan/zoom transform.
 * The parent component is responsible for calling applyPanMove/stopPan from
 * its global mousemove/mouseup handlers (which also handle resize and node
 * movement, so they cannot live solely inside this composable).
 */
export function useCanvasTransform(svgRef: Readonly<{ value: SVGSVGElement | null }>) {
  const uiStore = useUiStore()

  const transform = ref<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  })

  const isPanning = ref(false)
  const panStart = ref<{ x: number; y: number; tx: number; ty: number }>({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
  })

  const transformString = computed(
    () => `translate(${transform.value.x},${transform.value.y}) scale(${transform.value.scale})`,
  )

  function updateViewport() {
    if (!svgRef.value) return
    const rect = svgRef.value.getBoundingClientRect()
    const { x, y, scale } = transform.value
    uiStore.updateViewport({
      x: -x / scale,
      y: -y / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    })
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.min(Math.max(transform.value.scale * scaleFactor, 0.1), 5)

    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const dx = mouseX - transform.value.x
    const dy = mouseY - transform.value.y

    transform.value = {
      x: transform.value.x + dx - (dx * newScale) / transform.value.scale,
      y: transform.value.y + dy - (dy * newScale) / transform.value.scale,
      scale: newScale,
    }

    updateViewport()
  }

  /** Called from the SVG @mousedown handler — starts a pan if the click is
   *  on the canvas background (not on a node). */
  function onMouseDown(event: MouseEvent) {
    if (event.button !== 0) return
    if ((event.target as Element).closest('.node-foreign-object')) return

    isPanning.value = true
    panStart.value = {
      x: event.clientX,
      y: event.clientY,
      tx: transform.value.x,
      ty: transform.value.y,
    }
  }

  /** Call from the global mousemove handler (after resize/move checks) to
   *  apply panning when active. Returns true if a pan was applied. */
  function applyPanMove(event: MouseEvent): boolean {
    if (!isPanning.value) return false
    transform.value = {
      ...transform.value,
      x: panStart.value.tx + (event.clientX - panStart.value.x),
      y: panStart.value.ty + (event.clientY - panStart.value.y),
    }
    updateViewport()
    return true
  }

  /** Call from the global mouseup handler to end panning. */
  function stopPan() {
    isPanning.value = false
  }

  /** Zoom by a factor toward the centre of the SVG viewport. */
  function zoomBy(factor: number) {
    if (!svgRef.value) return
    const rect = svgRef.value.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const newScale = Math.min(Math.max(transform.value.scale * factor, 0.1), 5)
    const dx = cx - transform.value.x
    const dy = cy - transform.value.y
    transform.value = {
      x: transform.value.x + dx - (dx * newScale) / transform.value.scale,
      y: transform.value.y + dy - (dy * newScale) / transform.value.scale,
      scale: newScale,
    }
    updateViewport()
  }

  return {
    transform,
    isPanning,
    transformString,
    onWheel,
    onMouseDown,
    applyPanMove,
    stopPan,
    updateViewport,
    zoomBy,
  }
}
