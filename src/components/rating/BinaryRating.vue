<script setup lang="ts">
interface Props {
  modelValue: number
  type: 'thumbs' | 'checkbox' | 'emoji'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function toggle() {
  if (props.disabled) return
  // Toggle between 0 and 100
  emit('update:modelValue', props.modelValue === 100 ? 0 : 100)
}

function isActive(): boolean {
  return props.modelValue === 100
}

function getLabel(): string {
  const labels = {
    thumbs: isActive() ? 'Thumbs Up' : 'Thumbs Down',
    checkbox: isActive() ? 'Checked' : 'Unchecked',
    emoji: isActive() ? 'Happy' : 'Sad',
  }
  return labels[props.type]
}
</script>

<template>
  <div class="binary-rating">
    <button
      type="button"
      class="binary-btn"
      :class="[`binary-${type}`, { active: isActive() }]"
      :disabled="disabled"
      :aria-label="getLabel()"
      :aria-pressed="isActive()"
      @click="toggle"
    >
      <!-- Thumbs -->
      <template v-if="type === 'thumbs'">
        <svg v-if="isActive()" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
        </svg>
        <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
        </svg>
      </template>

      <!-- Checkbox -->
      <template v-if="type === 'checkbox'">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <path v-if="isActive()" d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </template>

      <!-- Emoji -->
      <template v-if="type === 'emoji'">
        <svg v-if="isActive()" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <path fill="#fff" d="M8 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
          <path fill="#fff" d="M12 18c2.5 0 4.5-1.5 5.5-3.5H6.5c1 2 3 3.5 5.5 3.5z"/>
        </svg>
        <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <path fill="#fff" d="M8 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
          <path fill="#fff" d="M12 14c-2.5 0-4.5 1.5-5.5 3.5h11c-1-2-3-3.5-5.5-3.5z"/>
        </svg>
      </template>
    </button>
    
    <span class="binary-label">{{ getLabel() }}</span>
  </div>
</template>

<style scoped>
.binary-rating {
  display: flex;
  align-items: center;
  gap: 12px;
}

.binary-btn {
  background: none;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.binary-btn:hover:not(:disabled) {
  border-color: #bbb;
  transform: scale(1.05);
}

.binary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Thumbs styling */
.binary-thumbs.active {
  color: #4caf50;
  border-color: #4caf50;
  background: #e8f5e9;
}

.binary-thumbs:not(.active) {
  color: #f44336;
  border-color: #f44336;
  background: #ffebee;
}

/* Checkbox styling */
.binary-checkbox.active {
  color: #2196f3;
  border-color: #2196f3;
  background: #e3f2fd;
}

.binary-checkbox:not(.active) {
  color: #999;
  border-color: #ddd;
  background: #f5f5f5;
}

/* Emoji styling */
.binary-emoji.active {
  color: #ffc107;
  border-color: #ffc107;
  background: #fff8e1;
}

.binary-emoji:not(.active) {
  color: #9e9e9e;
  border-color: #9e9e9e;
  background: #f5f5f5;
}

.binary-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
  min-width: 80px;
}
</style>
