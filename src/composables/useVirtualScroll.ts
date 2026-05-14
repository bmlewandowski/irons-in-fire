/**
 * useVirtualScroll - renders only visible items in a scrollable container
 * 
 * Efficiently handles large lists by rendering only items in the viewport
 * plus a buffer zone. Ideal for 1000+ item lists.
 * 
 * Usage:
 *   const { virtualItems, containerProps, listProps } = useVirtualScroll({
 *     items: allItems,
 *     estimateSize: () => 200,
 *     overscan: 5
 *   })
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'

export interface VirtualScrollOptions<T> {
  /** All items to virtualize */
  items: Ref<T[]>
  /** Estimated height of each item in pixels */
  estimateSize: (index: number) => number
  /** Number of items to render outside viewport (buffer zone) */
  overscan?: number
  /** Minimum height for the scrollable container */
  minHeight?: string
}

export interface VirtualItem<T> {
  /** Original item data */
  item: T
  /** Index in full list */
  index: number
  /** Absolute offset from top in pixels */
  offsetTop: number
  /** Height of this item */
  size: number
}

export function useVirtualScroll<T>({
  items,
  estimateSize,
  overscan = 3,
  minHeight = '400px',
}: VirtualScrollOptions<T>) {
  const scrollElement = ref<HTMLElement | null>(null)
  const scrollTop = ref(0)
  const containerHeight = ref(600)

  // Measure actual item sizes (falls back to estimate if not measured)
  const measuredSizes = ref(new Map<number, number>())

  function getSize(index: number): number {
    return measuredSizes.value.get(index) ?? estimateSize(index)
  }

  // Calculate total height and item positions
  const virtualData = computed(() => {
    const itemCount = items.value.length
    const positions: number[] = []
    let totalHeight = 0

    for (let i = 0; i < itemCount; i++) {
      positions.push(totalHeight)
      totalHeight += getSize(i)
    }

    return { positions, totalHeight, itemCount }
  })

  // Calculate which items are visible
  const virtualItems = computed<VirtualItem<T>[]>(() => {
    const { positions, itemCount } = virtualData.value
    if (itemCount === 0) return []

    const scrollTop_ = scrollTop.value
    const viewportHeight = containerHeight.value

    // Binary search for first visible item
    let startIndex = 0
    let endIndex = itemCount - 1

    while (startIndex < endIndex) {
      const mid = Math.floor((startIndex + endIndex) / 2)
      const midTop = positions[mid]
      const midBottom = midTop + getSize(mid)

      if (midBottom < scrollTop_) {
        startIndex = mid + 1
      } else {
        endIndex = mid
      }
    }

    // Apply overscan
    startIndex = Math.max(0, startIndex - overscan)

    // Find last visible item
    let lastVisibleIndex = startIndex
    const viewportBottom = scrollTop_ + viewportHeight

    while (lastVisibleIndex < itemCount && positions[lastVisibleIndex] < viewportBottom) {
      lastVisibleIndex++
    }

    lastVisibleIndex = Math.min(itemCount - 1, lastVisibleIndex + overscan)

    // Build virtual items
    const result: VirtualItem<T>[] = []
    for (let i = startIndex; i <= lastVisibleIndex; i++) {
      result.push({
        item: items.value[i],
        index: i,
        offsetTop: positions[i],
        size: getSize(i),
      })
    }

    return result
  })

  // Scroll event handler
  function handleScroll() {
    if (!scrollElement.value) return
    scrollTop.value = scrollElement.value.scrollTop
  }

  // Resize observer for container
  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    if (scrollElement.value) {
      scrollElement.value.addEventListener('scroll', handleScroll, { passive: true })
      
      // ResizeObserver may not be available in test environments
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            containerHeight.value = entry.contentRect.height
          }
        })
        resizeObserver.observe(scrollElement.value)
      }

      // Initial measurement
      containerHeight.value = scrollElement.value.clientHeight
      handleScroll()
    }
  })

  onUnmounted(() => {
    if (scrollElement.value) {
      scrollElement.value.removeEventListener('scroll', handleScroll)
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })

  // Watch items change to reset scroll to top
  watch(() => items.value.length, () => {
    if (scrollElement.value) {
      scrollElement.value.scrollTop = 0
    }
    measuredSizes.value.clear()
  })

  // Props to bind to container element
  const containerProps = computed(() => ({
    ref: scrollElement,
    style: {
      overflow: 'auto',
      minHeight,
      position: 'relative' as const,
    },
  }))

  // Props to bind to inner list element
  const listProps = computed(() => ({
    style: {
      height: `${virtualData.value.totalHeight}px`,
      position: 'relative' as const,
    },
  }))

  // Function to measure an item after render
  function measureItem(index: number, size: number) {
    if (size > 0 && size !== measuredSizes.value.get(index)) {
      measuredSizes.value.set(index, size)
    }
  }

  return {
    virtualItems,
    containerProps,
    listProps,
    scrollElement,
    measureItem,
  }
}
