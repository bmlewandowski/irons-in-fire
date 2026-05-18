<script setup lang="ts">
import { computed } from 'vue'
import type { ScaleConfig } from '@/models/RatingScale'
import SliderScale from './SliderScale.vue'
import StarRating from './StarRating.vue'
import BinaryRating from './BinaryRating.vue'
import LikertScale from './LikertScale.vue'

interface Props {
  modelValue: number
  config: ScaleConfig
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const scaleType = computed(() => props.config.type)

const sliderIncrement = computed(() => {
  if (scaleType.value === 'slider-1') return 1
  if (scaleType.value === 'slider-10') return 10
  if (scaleType.value === 'slider-25') return 25
  return 1
})

const starCount = computed(() => {
  if (scaleType.value === 'stars-3') return 3
  if (scaleType.value === 'stars-4') return 4
  if (scaleType.value === 'stars-5') return 5
  if (scaleType.value === 'stars-10') return 10
  return 5
})

const binaryType = computed(() => {
  if (scaleType.value === 'thumbs') return 'thumbs'
  if (scaleType.value === 'checkbox') return 'checkbox'
  if (scaleType.value === 'emoji') return 'emoji'
  return 'thumbs'
})

const likertPoints = computed(() => {
  if (scaleType.value === 'likert-3') return 3
  if (scaleType.value === 'likert-5') return 5
  if (scaleType.value === 'likert-7') return 7
  return 5
})

const isSlider = computed(() => 
  scaleType.value.startsWith('slider-')
)

const isStars = computed(() => 
  scaleType.value.startsWith('stars-')
)

const isBinary = computed(() => 
  ['thumbs', 'checkbox', 'emoji'].includes(scaleType.value)
)

const isLikert = computed(() => 
  scaleType.value.startsWith('likert-')
)

function updateValue(value: number) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="rating-scale">
    <SliderScale
      v-if="isSlider"
      :model-value="modelValue"
      :increment="sliderIncrement"
      :show-input="config.showPercentage !== false"
      :disabled="disabled"
      @update:model-value="updateValue"
    />
    
    <StarRating
      v-else-if="isStars"
      :model-value="modelValue"
      :stars="starCount"
      :disabled="disabled"
      @update:model-value="updateValue"
    />
    
    <BinaryRating
      v-else-if="isBinary"
      :model-value="modelValue"
      :type="binaryType"
      :disabled="disabled"
      @update:model-value="updateValue"
    />
    
    <LikertScale
      v-else-if="isLikert"
      :model-value="modelValue"
      :points="likertPoints"
      :labels="config.labels"
      :disabled="disabled"
      @update:model-value="updateValue"
    />
    
    <div v-else class="unsupported-scale">
      Unsupported scale type: {{ config.type }}
    </div>
    
    <div v-if="config.showPercentage && !isSlider" class="percentage-display">
      {{ Math.round(modelValue) }}%
    </div>
  </div>
</template>

<style scoped>
.rating-scale {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.unsupported-scale {
  padding: 12px;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.percentage-display {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-align: center;
  padding: 4px 0;
}
</style>
