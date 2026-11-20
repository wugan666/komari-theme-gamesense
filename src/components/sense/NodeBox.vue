<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatRelativeTime, formatUptimeWithFormat } from '@/utils/helper'
import { nodeTrafficUsed } from '@/utils/nodeHealth'
import { getOSName } from '@/utils/osImageHelper'
import { getRegionCode } from '@/utils/regionHelper'

// A node drawn as a menu group box: an "Online" checkbox, read-only sliders
// for each resource, a combo-style network readout and a button to the details.
const props = defineProps<{ node: NodeData, compact: boolean }>()
defineEmits<{ open: [] }>()

const appStore = useAppStore()
const nodesStore = useNodesStore()
const bytes = (value: number) => formatBytesWithConfig(value, appStore.byteDecimals)
const speed = (value: number) => formatBytesPerSecondWithConfig(value, appStore.byteDecimals)
const ratio = (used: number, total: number) => total > 0 ? Math.min(100, used / total * 100) : 0

const sliders = computed(() => {
  const node = props.node
  const list = [
    { label: 'CPU', percent: node.cpu ?? 0, text: `${(node.cpu ?? 0).toFixed(0)}%` },
    { label: 'Memory', percent: ratio(node.ram ?? 0, node.mem_total), text: `${ratio(node.ram ?? 0, node.mem_total).toFixed(0)}%` },
    { label: 'Disk', percent: ratio(node.disk ?? 0, node.disk_total), text: `${ratio(node.disk ?? 0, node.disk_total).toFixed(0)}%` },
  ]
  if (node.traffic_limit > 0) {
    const used = ratio(nodeTrafficUsed(node), node.traffic_limit)
    list.push({ label: 'Traffic', percent: used, text: `${used.toFixed(0)}%` })
  }
  return list
})
const details = computed(() => {
  const node = props.node
  return [
    ['Memory', `${bytes(node.ram ?? 0)} / ${bytes(node.mem_total ?? 0)}`],
    ['Disk', `${bytes(node.disk ?? 0)} / ${bytes(node.disk_total ?? 0)}`],
    ['Load', `${(node.load ?? 0).toFixed(2)} ${(node.load5 ?? 0).toFixed(2)} ${(node.load15 ?? 0).toFixed(2)}`],
    ['Total', `↑ ${bytes(node.net_total_up ?? 0)} ↓ ${bytes(node.net_total_down ?? 0)}`],
    ['Conns', `TCP ${node.connections ?? 0} / UDP ${node.connections_udp ?? 0}`],
  ]
})
const lastSeen = computed(() => formatRelativeTime(props.node.time, nodesStore.now))
</script>

<template>
  <fieldset class="sk-group" :class="{ 'sk-group-off': !node.online }">
    <legend>
      <img v-if="node.region?.trim()" :src="`/images/flags/${getRegionCode(node.region)}.svg`" alt="">{{ node.name }}
    </legend>
    <div class="sk-row">
      <span class="sk-check sk-static"><i class="sk-box" :class="{ 'sk-box-on': node.online }" /><span>Online</span></span>
      <span class="sk-bind">[{{ node.online ? formatUptimeWithFormat(node.uptime ?? 0, 'day') : (lastSeen !== '-' ? lastSeen : 'never') }}]</span>
    </div>
    <template v-if="node.online">
      <div v-for="slider in sliders" :key="slider.label" class="sk-field">
        <span class="sk-label">{{ slider.label }}</span>
        <div class="sk-slider" :class="slider.percent >= 90 ? 'sk-slider-danger' : slider.percent >= 75 ? 'sk-slider-warn' : ''">
          <div class="sk-slider-fill" :style="{ width: `${slider.percent}%` }" />
          <b :style="{ left: `${slider.percent}%` }">{{ slider.text }}</b>
        </div>
      </div>
      <div class="sk-field">
        <span class="sk-label">Network</span>
        <div class="sk-combo sk-static">
          <span>↑ {{ speed(node.net_out ?? 0) }}&nbsp;&nbsp;↓ {{ speed(node.net_in ?? 0) }}</span>
        </div>
      </div>
      <dl v-if="!compact" class="sk-list">
        <template v-for="item in details" :key="item[0]">
          <dt>{{ item[0] }}</dt><dd>{{ item[1] }}</dd>
        </template>
      </dl>
    </template>
    <div class="sk-row sk-muted">
      <span class="truncate">{{ getOSName(node.os) }} · {{ node.cpu_cores }}C · {{ node.arch }}</span>
    </div>
    <button type="button" class="sk-button" @click="$emit('open')">
      Open details
    </button>
  </fieldset>
</template>
