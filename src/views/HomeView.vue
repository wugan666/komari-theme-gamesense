<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NodeBox from '@/components/sense/NodeBox.vue'
import SenseControl from '@/components/sense/SenseControl.vue'
import SenseWindow from '@/components/sense/SenseWindow.vue'
import { OPTION_GROUPS, useSenseConfig } from '@/sense/config'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatRelativeTime } from '@/utils/helper'
import { parseNodeGroups } from '@/utils/groupHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'

defineOptions({ name: 'HomeView' })

const appStore = useAppStore()
const nodesStore = useNodesStore()
const router = useRouter()
const config = useSenseConfig()

// ===== 左侧标签：全部 + 每个分组（或地区）+ Visuals =====
const useGroups = computed(() => appStore.panelGroupBy === 'group' && nodesStore.nodes.some(node => parseNodeGroups(node.group).length))
function categoriesOf(node: NodeData): string[] {
  if (useGroups.value) {
    const groups = parseNodeGroups(node.group)
    return groups.length ? groups : ['未分组']
  }
  return [getRegionDisplayName(node.region) || '其他']
}
const tabs = computed(() => {
  const map = new Map<string, { count: number, online: number, flag: string }>()
  for (const node of nodesStore.nodes) {
    for (const name of categoriesOf(node)) {
      const entry = map.get(name) ?? { count: 0, online: 0, flag: '' }
      entry.count++
      if (node.online)
        entry.online++
      if (!useGroups.value && !entry.flag && node.region?.trim())
        entry.flag = getRegionCode(node.region)
      map.set(name, entry)
    }
  }
  return [...map.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).map(([name, info]) => ({ name, ...info }))
})
const activeTab = ref('all')
watch(tabs, (list) => {
  if (activeTab.value !== 'all' && activeTab.value !== 'visuals' && !list.some(tab => tab.name === activeTab.value))
    activeTab.value = 'all'
})

const memory = (node: NodeData) => node.mem_total > 0 ? (node.ram ?? 0) / node.mem_total * 100 : 0
const nodes = computed(() => {
  const keyword = appStore.nodeSearchText.trim().toLowerCase()
  const list = nodesStore.nodes
    .filter(node => activeTab.value === 'all' || categoriesOf(node).includes(activeTab.value))
    .filter(node => !config.get<boolean>('hideOffline') || node.online)
    .filter(node => !keyword || [node.name, node.os, node.group, node.tags, getRegionDisplayName(node.region)].some(text => text?.toLowerCase().includes(keyword)))
  const sort = config.get<string>('sort')
  return [...list].sort((a, b) => Number(b.online) - Number(a.online)
    || (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'load' ? Math.max(b.cpu ?? 0, memory(b)) - Math.max(a.cpu ?? 0, memory(a)) : a.weight - b.weight)
    || a.name.localeCompare(b.name))
})
const offline = computed(() => nodesStore.nodes.filter(node => !node.online))

// ===== 总览（All 标签顶部的一个分组框）=====
const overview = computed(() => {
  let up = 0
  let down = 0
  let traffic = 0
  let memUsed = 0
  let memTotal = 0
  let diskUsed = 0
  let diskTotal = 0
  let cpu = 0
  let online = 0
  for (const node of nodesStore.nodes) {
    traffic += (node.net_total_up || 0) + (node.net_total_down || 0)
    memTotal += node.mem_total || 0
    diskTotal += node.disk_total || 0
    if (node.online) {
      online++
      up += node.net_out || 0
      down += node.net_in || 0
      memUsed += node.ram || 0
      diskUsed += node.disk || 0
      cpu += node.cpu || 0
    }
  }
  const total = nodesStore.nodes.length
  const bytes = (value: number) => formatBytesWithConfig(value, appStore.byteDecimals)
  const pct = (a: number, b: number) => b > 0 ? a / b * 100 : 0
  return {
    sliders: [
      { label: 'Nodes online', percent: pct(online, total), text: `${online}/${total}` },
      { label: 'Average CPU', percent: online ? cpu / online : 0, text: `${(online ? cpu / online : 0).toFixed(0)}%` },
      { label: 'Memory in use', percent: pct(memUsed, memTotal), text: `${bytes(memUsed)}` },
      { label: 'Disk in use', percent: pct(diskUsed, diskTotal), text: `${bytes(diskUsed)}` },
    ],
    network: `↑ ${formatBytesPerSecondWithConfig(up, appStore.byteDecimals)}  ↓ ${formatBytesPerSecondWithConfig(down, appStore.byteDecimals)}`,
    traffic: bytes(traffic),
  }
})
const columnsClass = computed(() => `sk-columns-${config.get<string>('columns')}`)
</script>

<template>
  <div class="sk-desktop">
    <SenseWindow id="menu" :x="24" :y="16" class="sk-menu">
      <div class="sk-layout">
        <nav class="sk-tabs" aria-label="分类">
          <button type="button" class="sk-tab" :class="{ 'sk-tab-active': activeTab === 'all' }" title="全部节点" @click="activeTab = 'all'">
            <Icon icon="tabler:server-2" width="22" /><small>All</small>
          </button>
          <button v-for="tab in tabs" :key="tab.name" type="button" class="sk-tab" :class="{ 'sk-tab-active': activeTab === tab.name }" :title="`${tab.name}（${tab.online}/${tab.count} 在线）`" @click="activeTab = tab.name">
            <img v-if="tab.flag" :src="`/images/flags/${tab.flag}.svg`" alt="">
            <b v-else>{{ tab.name.slice(0, 2) }}</b>
            <small>{{ tab.name }}</small>
          </button>
          <button type="button" class="sk-tab" :class="{ 'sk-tab-active': activeTab === 'visuals' }" title="菜单与显示设置" @click="activeTab = 'visuals'">
            <Icon icon="tabler:eye" width="22" /><small>Visuals</small>
          </button>
        </nav>

        <div class="sk-content">
          <template v-if="activeTab === 'visuals'">
            <div class="sk-columns sk-columns-2">
              <fieldset v-for="group in OPTION_GROUPS" :key="group.title" class="sk-group">
                <legend>{{ group.title }}</legend>
                <SenseControl v-for="option in group.options" :key="option.key" :option="option" />
              </fieldset>
              <fieldset class="sk-group">
                <legend>Config</legend>
                <div class="sk-row sk-muted">
                  这些选项只保存在你的浏览器里
                </div>
                <button type="button" class="sk-button" :disabled="!config.changed.value" @click="config.reset()">
                  Reset
                </button>
              </fieldset>
            </div>
          </template>
          <template v-else>
            <div class="sk-toolbar">
              <label class="sk-search">
                <input v-model="appStore.nodeSearchText" type="search" placeholder="Search" aria-label="搜索节点">
              </label>
              <span class="sk-muted">{{ nodes.length }} node{{ nodes.length === 1 ? '' : 's' }}</span>
            </div>
            <div class="sk-columns" :class="columnsClass">
              <fieldset v-if="activeTab === 'all' && !appStore.nodeSearchText" class="sk-group">
                <legend>Overview</legend>
                <div v-for="slider in overview.sliders" :key="slider.label" class="sk-field">
                  <span class="sk-label">{{ slider.label }}</span>
                  <div class="sk-slider">
                    <div class="sk-slider-fill" :style="{ width: `${Math.min(100, slider.percent)}%` }" />
                    <b :style="{ left: `${Math.min(100, slider.percent)}%` }">{{ slider.text }}</b>
                  </div>
                </div>
                <div class="sk-field">
                  <span class="sk-label">Network</span>
                  <div class="sk-combo sk-static">
                    <span>{{ overview.network }}</span>
                  </div>
                </div>
                <dl class="sk-list">
                  <dt>Total traffic</dt><dd>{{ overview.traffic }}</dd>
                </dl>
              </fieldset>
              <NodeBox v-for="node in nodes" :key="node.uuid" :node="node" :compact="config.get<boolean>('compact')" @open="router.push(`/instance/${node.uuid}`)" />
            </div>
            <div v-if="!nodes.length" class="sk-empty">
              {{ nodesStore.nodes.length ? 'No matching nodes' : 'No nodes' }}
            </div>
          </template>
        </div>
      </div>
    </SenseWindow>

    <!-- 离线列表：仿观战者列表的小窗口 -->
    <SenseWindow v-if="config.get('offlineList') && offline.length" id="offline" :x="980" :y="64" title="offline" class="sk-mini">
      <ul class="sk-mini-list">
        <li v-for="node in offline" :key="node.uuid">
          <button type="button" @click="router.push(`/instance/${node.uuid}`)">
            <span class="truncate">{{ node.name }}</span>
            <span class="sk-muted">{{ formatRelativeTime(node.time, nodesStore.now) !== '-' ? formatRelativeTime(node.time, nodesStore.now) : '—' }}</span>
          </button>
        </li>
      </ul>
    </SenseWindow>
  </div>
</template>
