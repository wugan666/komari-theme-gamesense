<script setup lang="ts">
import type { OptionDef } from '@/sense/config'
import { computed } from 'vue'
import { useSenseConfig } from '@/sense/config'

// One editable menu option: checkbox, combo box (click cycles) or slider.
const props = defineProps<{ option: OptionDef }>()
const config = useSenseConfig()

const comboLabel = computed(() => {
  if (props.option.type !== 'combo')
    return ''
  const value = String(config.get(props.option.key))
  return props.option.options.find(item => item[0] === value)?.[1] ?? value
})
function cycle(step: 1 | -1) {
  if (props.option.type !== 'combo')
    return
  const list = props.option.options
  const index = list.findIndex(item => item[0] === String(config.get(props.option.key)))
  config.set(props.option.key, list[(index + step + list.length) % list.length]![0])
}
const percent = computed(() => props.option.type === 'slider' ? (config.get<number>(props.option.key) - props.option.min) / (props.option.max - props.option.min) * 100 : 0)
function drag(event: PointerEvent) {
  if (props.option.type !== 'slider')
    return
  const element = event.currentTarget as HTMLElement
  if (event.type === 'pointerdown')
    element.setPointerCapture(event.pointerId)
  else if (!element.hasPointerCapture(event.pointerId))
    return
  const rect = element.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const { min, max, step } = props.option
  config.set(props.option.key, Math.round((min + ratio * (max - min)) / step) * step)
}
function nudge(direction: 1 | -1) {
  if (props.option.type !== 'slider')
    return
  const { min, max, step } = props.option
  config.set(props.option.key, Math.min(max, Math.max(min, config.get<number>(props.option.key) + direction * step)))
}
</script>

<template>
  <button v-if="option.type === 'checkbox'" type="button" class="sk-check" role="checkbox" :aria-checked="config.get<boolean>(option.key)" @click="config.set(option.key, !config.get<boolean>(option.key))">
    <i :class="{ 'sk-box-on': config.get(option.key) }" class="sk-box" /><span>{{ option.label }}</span>
  </button>
  <div v-else-if="option.type === 'combo'" class="sk-field">
    <span class="sk-label">{{ option.label }}</span>
    <button type="button" class="sk-combo" title="左键下一个，右键上一个" @click="cycle(1)" @contextmenu.prevent="cycle(-1)">
      <span>{{ comboLabel }}</span><i class="sk-caret" />
    </button>
  </div>
  <div v-else class="sk-field">
    <span class="sk-label">{{ option.label }}</span>
    <div
      class="sk-slider sk-slider-live" role="slider" tabindex="0" :aria-label="option.label"
      :aria-valuemin="option.min" :aria-valuemax="option.max" :aria-valuenow="config.get<number>(option.key)"
      @pointerdown="drag" @pointermove="drag" @keydown.left.prevent="nudge(-1)" @keydown.right.prevent="nudge(1)"
    >
      <div class="sk-slider-fill" :style="{ width: `${percent}%` }" />
      <b :style="{ left: `${percent}%` }">{{ config.get(option.key) }}{{ option.unit }}</b>
    </div>
  </div>
</template>
