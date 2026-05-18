<script setup lang="ts">
import { computed } from 'vue'
import { getScaleValues, getLikertLabel } from '@/models/RatingScale'

interface Props {
  modelValue: number
  points: 3 | 5 | 7
  labels?: string[]
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const scaleType = computed(() => {
  return `likert-${props.points}` as 'likert-3' | 'likert-5' | 'likert-7'
})

const values = computed(() => getScaleValues(scaleType.value))

const selectedIndex = computed(() => {
  return values.value.indexOf(Math.round(props.modelValue))
})

function selectValue(index: number) {
  if (props.disabled) return
  emit('update:modelValue', values.value[index])
}

function getLabel(value: number): string {
  return getLikertLabel(scaleType.value, value, props.labels)
}
</script>

<template>
  <div class="likert-scale">
    <div class="likert-options">
      <button
        v-for="(value, index) in values"
        :key="value"
        type="button"
        class="likert-btn"
        :class="{ active: selectedIndex === index }"
        :disabled="disabled"
        :aria-label="getLabel(value)"
        :aria-pressed="selectedIndex === index"
        @click="selectValue(index)"
      >
        <span class="likert-radio">
          <span v-if="selectedIndex === index" class="likert-dot"></span>
        </span>
        <span class="likert-label">{{ getLabel(value) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.likert-scale {
  width: 100%;
}

.likert-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.likert-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: white;
  border: 2px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.likert-btn:hover:not(:disabled) {
  border-color: #2196f3;
  background: #f5f9ff;
}

.likert-btn.active {
  border-color: #2196f3;
  background: #e3f2fd;
}

.likert-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.likert-radio {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 2px solid #999;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
}

.likert-btn:hover:not(:disabled) .likert-radio {
  border-color: #2196f3;
}

.likert-btn.active .likert-radio {
  border-color: #2196f3;
}

.likert-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2196f3;
}

.likert-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.likert-btn:disabled .likert-label {
  color: #999;
}
</style>
