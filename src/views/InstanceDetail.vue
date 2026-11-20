<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import SenseWindow from '@/components/sense/SenseWindow.vue'
import { useInstanceDetail } from '@/composables/useInstanceDetail'

// GameSense 的节点详情：和首页同一种菜单窗口。左侧标签切换概览 / 负载 / 延迟 / 回程，
// 每次只显示一个部分，信息用分组框、复选框和细滑条表达。
const LoadChart = defineAsyncComponent(() => import('@/components/LoadChart.vue'))
const PingChart = defineAsyncComponent(() => import('@/components/PingChart.vue'))
const ReturnRoutePanel = defineAsyncComponent(() => import('@/components/ReturnRoutePanel.vue'))

const router = useRouter()
const { data, orderedNodes, currentIndex, prevNode, nextNode, switchNode, metricCards, hardwareInfo, systemInfo, storageInfo, gauges, liveInfo, regionName, regionCode } = useInstanceDetail()

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'tabler:layout-dashboard' },
  { id: 'load', label: 'Load', icon: 'tabler:chart-area-line' },
  { id: 'latency', label: 'Latency', icon: 'tabler:activity' },
  { id: 'route', label: 'Route', icon: 'tabler:route' },
] as const
const tab = ref<typeof TABS[number]['id']>('overview')
</script>

<template>
  <div class="sk-desktop sk-detail">
    <SenseWindow id="detail" :x="0" :y="0" fixed-layout class="sk-detail-window">
      <div class="sk-layout">
        <nav class="sk-tabs" aria-label="节点详情分区">
          <button type="button" class="sk-tab" title="返回菜单" @click="router.push('/')">
            <Icon icon="tabler:arrow-back-up" width="22" /><small>Back</small>
          </button>
          <button v-for="item in TABS" :key="item.id" type="button" class="sk-tab" :class="{ 'sk-tab-active': tab === item.id }" :aria-pressed="tab === item.id" @click="tab = item.id">
            <Icon :icon="item.icon" width="22" /><small>{{ item.label }}</small>
          </button>
        </nav>

        <div class="sk-content">
          <div v-if="!data" class="sk-empty">
            节点不存在或已被删除
          </div>
          <template v-else>
            <!-- 节点选择：像菜单里的下拉框 -->
            <div class="sk-node-bar">
              <img v-if="regionCode" :src="`/images/flags/${regionCode}.svg`" :alt="regionName">
              <h1 class="truncate">
                {{ data.name }}
              </h1>
              <span class="sk-check sk-static"><i class="sk-box" :class="{ 'sk-box-on': data.online }" /><span>{{ data.online ? 'Online' : 'Offline' }}</span></span>
              <span class="flex-1" />
              <button type="button" class="sk-button" :disabled="!prevNode" :title="prevNode?.name" @click="switchNode(prevNode)">
                ◂ Prev
              </button>
              <span class="sk-muted tabular-nums">{{ currentIndex + 1 }}/{{ orderedNodes.length }}</span>
              <button type="button" class="sk-button" :disabled="!nextNode" :title="nextNode?.name" @click="switchNode(nextNode)">
                Next ▸
              </button>
            </div>

            <div v-if="tab === 'overview'" class="sk-columns sk-columns-2">
              <fieldset class="sk-group">
                <legend>Status</legend>
                <template v-if="data.online">
                  <div v-for="gauge in gauges" :key="gauge.key" class="sk-field">
                    <span class="sk-label">{{ gauge.label }} <span class="sk-muted">{{ gauge.text }}</span></span>
                    <div class="sk-slider" :class="gauge.percent >= 90 ? 'sk-slider-danger' : gauge.percent >= 75 ? 'sk-slider-warn' : ''">
                      <div class="sk-slider-fill" :style="{ width: `${gauge.percent}%` }" />
                      <b :style="{ left: `${gauge.percent}%` }">{{ gauge.percent.toFixed(0) }}%</b>
                    </div>
                  </div>
                </template>
                <div v-else class="sk-row sk-muted">
                  节点离线；Load / Latency 标签里可以查看历史数据
                </div>
              </fieldset>
              <fieldset v-if="data.online" class="sk-group">
                <legend>Network</legend>
                <dl class="sk-list">
                  <template v-for="item in liveInfo" :key="item.label">
                    <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
                  </template>
                </dl>
              </fieldset>
              <fieldset class="sk-group">
                <legend>System</legend>
                <dl class="sk-list">
                  <dt>地区</dt><dd>{{ regionName || '—' }}</dd>
                  <template v-for="item in systemInfo" :key="item.label">
                    <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
                  </template>
                </dl>
              </fieldset>
              <fieldset class="sk-group">
                <legend>Hardware</legend>
                <dl class="sk-list">
                  <template v-for="item in [...hardwareInfo, ...storageInfo]" :key="item.label">
                    <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
                  </template>
                </dl>
              </fieldset>
              <fieldset class="sk-group">
                <legend>Billing</legend>
                <dl class="sk-list">
                  <template v-for="card in metricCards" :key="card.label">
                    <dt>{{ card.label }}</dt><dd :class="card.valueClass">{{ card.value }}<span v-if="card.unit" class="sk-muted"> {{ card.unit }}</span></dd>
                  </template>
                </dl>
              </fieldset>
            </div>

            <fieldset v-else-if="tab === 'load'" class="sk-group sk-group-wide">
              <legend>Load history</legend>
              <LoadChart :key="data.uuid" :uuid="data.uuid" />
            </fieldset>
            <fieldset v-else-if="tab === 'latency'" class="sk-group sk-group-wide">
              <legend>Latency</legend>
              <PingChart :key="data.uuid" :uuid="data.uuid" :online="data.online" :last-seen="data.time" />
            </fieldset>
            <fieldset v-else class="sk-group sk-group-wide">
              <legend>Return route</legend>
              <ReturnRoutePanel :key="data.uuid" :uuid="data.uuid" :online="data.online" />
            </fieldset>
          </template>
        </div>
      </div>
    </SenseWindow>
  </div>
</template>
