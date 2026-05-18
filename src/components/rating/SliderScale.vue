<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  modelValue: number
  increment: 1 | 10 | 25
  showInput?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showInput: true,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const inputValue = ref(String(Math.round(props.modelValue)))

function onSliderChange(event: Event) {
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  emit('update:modelValue', value)
  inputValue.value = String(value)
}

function onInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  let value = Number(target.value)
  
  // Clamp to 0-100
  value = Math.max(0, Math.min(100, value))
  
  // Snap to nearest increment
  value = Math.round(value / props.increment) * props.increment
  
  inputValue.value = String(value)
  emit('update:modelValue', value)
}

function incrementValue() {
  const current = Math.round(props.modelValue)
  const next = Math.min(100, current + props.increment)
  emit('update:modelValue', next)
  inputValue.value = String(next)
}

function decrementValue() {
  const current = Math.round(props.modelValue)
  const prev = Math.max(0, current - props.increment)
  emit('update:modelValue', prev)
  inputValue.value = String(prev)
}
</script>

<template>
  <div class="slider-scale">
    <input
      type="range"
      class="slider"
      min="0"
      max="100"
      :step="increment"
      :value="Math.round(modelValue)"
      :disabled="disabled"
      :aria-label="`Progress slider with ${increment}% increments`"
      @change="onSliderChange"
    />
    
    <div v-if="showInput" class="input-group">
      <button
        class="btn-adjust"
        :disabled="disabled || modelValue <= 0"
        aria-label="Decrease"
        @click="decrementValue"
      >−</button>
      
      <input
        type="number"
        class="input-number"
        min="0"
        max="100"
        :step="increment"
        :value="inputValue"
        :disabled="disabled"
        aria-label="Progress percentage"
        @blur="onInputChange"
        @keyup.enter="onInputChange"
      />
      
      <button
        class="btn-adjust"
        :disabled="disabled || modelValue >= 100"
        aria-label="Increase"
        @click="incrementValue"
      >+</button>
    </div>
  </div>
</template>

<style scoped>
.slider-scale {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #e0e0e0;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2196f3;
  cursor: pointer;
  transition: background 0.15s;
}

.slider::-webkit-slider-thumb:hover {
  background: #1976d2;
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2196f3;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.slider::-moz-range-thumb:hover {
  background: #1976d2;
}

.slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  background: #f5f5f5;
  border-radius: 4px;
}

.btn-adjust {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-adjust:hover:not(:disabled) {
  background: #e0e0e0;
  color: #333;
}

.btn-adjust:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.input-number {
  width: 50px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 3px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  padding: 0 4px;
  background: white;
}

.input-number:focus {
  outline: none;
  border-color: #2196f3;
}

.input-number:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
}

/* Remove spinner buttons from number input */
.input-number::-webkit-inner-spin-button,
.input-number::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.input-number[type=number] {
  -moz-appearance: textfield;
}
</style>
