import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

// Menu options a visitor can change on the "Visuals" tab. They are kept in the
// visitor's browser; untouched options follow the theme settings.

export type OptionDef
  = | { key: string, label: string, type: 'checkbox' }
    | { key: string, label: string, type: 'combo', options: [value: string, label: string][] }
    | { key: string, label: string, type: 'slider', min: number, max: number, step: number, unit: string }

export const OPTION_GROUPS: { title: string, options: OptionDef[] }[] = [
  {
    title: 'Menu',
    options: [
      { key: 'color', label: 'Menu color', type: 'combo', options: [['green', 'Green'], ['blue', 'Blue'], ['purple', 'Purple'], ['red', 'Red'], ['orange', 'Orange']] },
      { key: 'scale', label: 'DPI scale', type: 'slider', min: 90, max: 130, step: 5, unit: '%' },
      { key: 'rainbow', label: 'Rainbow line', type: 'checkbox' },
      { key: 'animations', label: 'Animations', type: 'checkbox' },
      { key: 'pattern', label: 'Background pattern', type: 'checkbox' },
    ],
  },
  {
    title: 'Overlay',
    options: [
      { key: 'watermark', label: 'Watermark', type: 'checkbox' },
      { key: 'watermarkSpeed', label: 'Watermark net speed', type: 'checkbox' },
      { key: 'offlineList', label: 'Offline list', type: 'checkbox' },
    ],
  },
  {
    title: 'Nodes',
    options: [
      { key: 'columns', label: 'Columns', type: 'combo', options: [['2', 'Two'], ['3', 'Three'], ['1', 'One']] },
      { key: 'sort', label: 'Sort by', type: 'combo', options: [['default', 'Default'], ['name', 'Name'], ['load', 'Load']] },
      { key: 'hideOffline', label: 'Hide offline', type: 'checkbox' },
      { key: 'compact', label: 'Compact boxes', type: 'checkbox' },
    ],
  },
]

type Value = boolean | string | number
const overrides = useStorage<Record<string, Value>>('gamesense:options', {})

export function useSenseConfig() {
  const appStore = useAppStore()
  const defaults = computed<Record<string, Value>>(() => ({
    color: appStore.menuColor,
    scale: 100,
    rainbow: true,
    animations: true,
    pattern: true,
    watermark: appStore.showWatermark,
    watermarkSpeed: true,
    offlineList: appStore.showOfflineList,
    columns: '2',
    sort: 'default',
    hideOffline: false,
    compact: false,
  }))
  function get<T extends Value>(key: string): T {
    return (overrides.value[key] ?? defaults.value[key]) as T
  }
  function set(key: string, value: Value) {
    overrides.value = { ...overrides.value, [key]: value }
  }
  function reset() {
    overrides.value = {}
  }
  const changed = computed(() => Object.keys(overrides.value).length > 0)
  return { get, set, reset, changed }
}
