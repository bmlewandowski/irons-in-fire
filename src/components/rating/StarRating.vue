<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: number
  stars: 3 | 4 | 5 | 10
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const increment = computed(() => 100 / props.stars)

const currentStars = computed(() => {
  return Math.round(props.modelValue / increment.value)
})

function setRating(starIndex: number) {
  if (props.disabled) return
  const value = starIndex * increment.value
  emit('update:modelValue', Math.round(value))
}

function getStarClass(index: number): string {
  return index < currentStars.value ? 'filled' : 'empty'
}
</script>

<template>
  <div class="star-rating">
    <button
      v-for="i in stars"
      :key="i"
      type="button"
      class="star-btn"
      :class="getStarClass(i)"
      :disabled="disabled"
      :aria-label="`Rate ${i} out of ${stars} stars`"
      @click="setRating(i)"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      </svg>
    </button>
    <span class="star-count" aria-live="polite">
      {{ currentStars }} / {{ stars }}
    </span>
  </div>
</template>

<style scoped>
.star-rating {
  display: flex;
  align-items: center;
  gap: 6px;
}

.star-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  transition: transform 0.15s, color 0.15s;
  color: #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}

.star-btn:hover:not(:disabled) {
  transform: scale(1.15);
}

.star-btn.filled {
  color: #ffa726;
}

.star-btn.filled:hover:not(:disabled) {
  color: #ff9800;
}

.star-btn.empty:hover:not(:disabled) {
  color: #ffb74d;
}

.star-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.star-btn svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.star-count {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  min-width: 45px;
  text-align: center;
}
</style>
