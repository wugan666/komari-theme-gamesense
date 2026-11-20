<script setup lang="ts">
import { useStorage, useWindowSize } from '@vueuse/core'
import { computed, ref } from 'vue'

// The layered menu frame with the rainbow line on top. On wide screens it can
// be dragged by its edge strip; the position is remembered per window id.
const props = defineProps<{ id: string, x: number, y: number, title?: string, fixedLayout?: boolean }>()
const { width } = useWindowSize()
const stored = useStorage<Record<string, [number, number]>>('gamesense:windows', {})
const floating = computed(() => !props.fixedLayout && width.value >= 900)
const position = computed<[number, number]>(() => stored.value[props.id] ?? [props.x, props.y])
const dragging = ref(false)
let start: [number, number, number, number] = [0, 0, 0, 0]

function down(event: PointerEvent) {
  if (!floating.value || event.button !== 0)
    return
  dragging.value = true
  start = [event.clientX, event.clientY, position.value[0], position.value[1]]
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (dragging.value)
    stored.value = { ...stored.value, [props.id]: [start[2] + event.clientX - start[0], Math.max(0, start[3] + event.clientY - start[1])] }
}
</script>

<template>
  <section class="sk-window" :class="{ 'sk-window-floating': floating, 'sk-window-dragging': dragging }" :style="floating ? { transform: `translate(${position[0]}px, ${position[1]}px)` } : undefined">
    <div class="sk-handle" :class="floating ? 'cursor-move' : ''" @pointerdown="down" @pointermove="move" @pointerup="dragging = false" @pointercancel="dragging = false">
      <div class="sk-rainbow" />
      <span v-if="title" class="sk-window-title">{{ title }}</span>
    </div>
    <div class="sk-window-inner">
      <slot />
    </div>
  </section>
</template>
