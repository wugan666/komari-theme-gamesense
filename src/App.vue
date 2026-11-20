<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toaster } from '@/components/ui/sonner'
import { useSenseConfig } from '@/sense/config'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesPerSecondWithConfig } from '@/utils/helper'
import { destroyInitManager, initApp } from '@/utils/init'
import ConnectionBanner from './components/ConnectionBanner.vue'
import LoadingCover from './components/LoadingCover.vue'
import Provider from './components/Provider.vue'

const appStore = useAppStore()
const nodesStore = useNodesStore()
const config = useSenseConfig()
const route = useRoute()
const router = useRouter()
const now = useNow({ interval: 1000 })
const buildVersion = __BUILD_VERSION__

const sitename = computed(() => appStore.publicSettings?.sitename || 'Komari Monitor')
const online = computed(() => nodesStore.nodes.filter(node => node.online))
const speeds = computed(() => {
  let up = 0
  let down = 0
  for (const node of online.value) {
    up += node.net_out || 0
    down += node.net_in || 0
  }
  return `↑ ${formatBytesPerSecondWithConfig(up, appStore.byteDecimals)} ↓ ${formatBytesPerSecondWithConfig(down, appStore.byteDecimals)}`
})
const clock = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }))
const showAdmin = computed(() => appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut)
const isHome = computed(() => route.name === 'home')

// 菜单选项落到根元素上，样式都在 main.css 里读取
watchEffect(() => {
  const root = document.documentElement
  root.dataset.color = config.get<string>('color')
  root.dataset.rainbow = String(config.get<boolean>('rainbow'))
  root.dataset.animations = String(config.get<boolean>('animations'))
  root.dataset.pattern = String(config.get<boolean>('pattern'))
  root.style.fontSize = `${config.get<number>('scale') / 100 * 16}px`
})
watchEffect(() => {
  const total = nodesStore.nodes.length
  document.title = total > 0 ? `${sitename.value} · ${online.value.length}/${total} 在线` : sitename.value
})
function openAdmin() {
  location.href = appStore.isLoggedIn ? '/admin/dashboard' : '/admin/login'
}

onMounted(async () => {
  try {
    await initApp()
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
  }
})
onUnmounted(() => destroyInitManager())
</script>

<template>
  <Provider>
    <div class="sk-backdrop" aria-hidden="true" />
    <LoadingCover v-if="appStore.loading" />
    <header class="sk-topbar">
      <button v-if="!isHome" type="button" class="sk-button sk-button-inline" @click="router.push('/')">
        ← Back to menu
      </button>
      <span class="flex-1" />
      <!-- 水印：站点名 | 在线 | 网速 | 时间 -->
      <div v-if="config.get('watermark')" class="sk-watermark" aria-label="状态水印">
        <div class="sk-rainbow" />
        <span><b class="text-white">game</b><b class="sk-accent">sense</b></span>
        <span class="hidden sm:inline">{{ sitename }}</span>
        <span>{{ online.length }}/{{ nodesStore.nodes.length }} online</span>
        <span v-if="config.get('watermarkSpeed')" class="hidden md:inline">{{ speeds }}</span>
        <span class="tabular-nums">{{ clock }}</span>
      </div>
      <button v-if="showAdmin" type="button" class="sk-button sk-button-inline" @click="openAdmin">
        {{ appStore.isLoggedIn ? 'Admin' : 'Login' }}
      </button>
    </header>
    <ConnectionBanner />
    <main v-if="!appStore.loading" class="relative z-10">
      <RouterView v-slot="{ Component }">
        <KeepAlive :include="['HomeView']">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
    <footer v-if="!appStore.loading" class="sk-footer">
      Powered by <a href="https://github.com/komari-monitor/komari" target="_blank" rel="noopener">Komari</a>
      · <a href="https://github.com/wugan666/komari-theme-gamesense" target="_blank" rel="noopener">GameSense theme</a> v{{ buildVersion }} · unofficial
    </footer>
    <Toaster rich-colors close-button position="top-center" theme="dark" />
  </Provider>
</template>
