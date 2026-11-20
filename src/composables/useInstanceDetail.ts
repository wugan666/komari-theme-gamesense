import type { CurrencyCode } from '@/utils/financeHelper'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatRelativeTime, formatUptimeWithFormat } from '@/utils/helper'
import { applyOfflineLast, applyPinnedFirst } from '@/utils/nodeSortHelper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { getBillingCycleText, getExpireStatus, getExpireText } from '@/utils/tagHelper'

// 节点详情页的数据：当前节点、上一台 / 下一台、费用、硬件与系统信息、实时占用。
// 各主题的详情页版式不同，但都从这里取数。
const EXPIRES_IN_SUFFIX_REGEX = /^(\d+)\s*(天|days?)$/i
const CURRENCY_SUFFIX_REGEX = /^(\S.*\S)\s+([A-Z]{3})$/

export interface InfoItem {
  label: string
  value: string | undefined
  icon?: string
}
export interface MetricCard {
  label: string
  value: string
  unit?: string
  icon: string
  valueClass?: string
}

export function useInstanceDetail() {


  const route = useRoute()
  const router = useRouter()

  const appStore = useAppStore()
  const nodesStore = useNodesStore()
  const exchangeRates = ref(financeHelper.DEFAULT_EXCHANGE_RATES)
  const financeBaseCurrency = ref<CurrencyCode>('CNY')

  onMounted(async () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    financeBaseCurrency.value = financeHelper.getStoredFinanceCurrency()

    const { rates } = await financeHelper.getDailyExchangeRates()
    exchangeRates.value = rates
  })

  const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
  const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
  const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'minute')

  const data = computed(() => nodesStore.nodes.find(node => node.uuid === route.params.id))

  // 上一台/下一台：顺序与首页默认一致（置顶在前、离线垫底）
  const orderedNodes = computed(() => applyOfflineLast(applyPinnedFirst([...nodesStore.nodes], appStore.pinnedNodes)))
  const currentIndex = computed(() => orderedNodes.value.findIndex(node => node.uuid === route.params.id))
  const prevNode = computed(() => currentIndex.value > 0 ? orderedNodes.value[currentIndex.value - 1] : null)
  const nextNode = computed(() => currentIndex.value > -1 && currentIndex.value < orderedNodes.value.length - 1
    ? orderedNodes.value[currentIndex.value + 1]
    : null)

  function switchNode(node: { uuid: string } | null | undefined) {
    if (node)
      router.replace({ name: 'instance-detail', params: { id: node.uuid } })
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
      return
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
      return
    if (e.key === 'ArrowLeft')
      switchNode(prevNode.value)
    else if (e.key === 'ArrowRight')
      switchNode(nextNode.value)
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

  // 组件在同路由不同参数间复用，切换节点时回到顶部
  watch(() => route.params.id, () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  })




  function formatFinanceMetricValue(amountCNY: number, currency: CurrencyCode): string {
    const targetRate = exchangeRates.value[currency] || 1
    const formattedValue = financeHelper.formatFinanceAmount(amountCNY * targetRate, currency)
    return `${formattedValue.symbol}${formattedValue.value} ${formattedValue.currency}`
  }

  function splitMetricValue(value: string): { value: string, unit?: string } {
    const cycleIndex = value.indexOf(' / ')
    if (cycleIndex > -1) {
      return {
        value: value.slice(0, cycleIndex),
        unit: value.slice(cycleIndex),
      }
    }

    const expiresInMatch = value.match(EXPIRES_IN_SUFFIX_REGEX)
    if (expiresInMatch) {
      return {
        value: expiresInMatch[1] ?? value,
        unit: expiresInMatch[2] ?? undefined,
      }
    }

    const currencyMatch = value.match(CURRENCY_SUFFIX_REGEX)
    if (currencyMatch) {
      return {
        value: currencyMatch[1] ?? value,
        unit: currencyMatch[2] ?? undefined,
      }
    }

    return { value }
  }

  const nodePriceText = computed(() => {
    if (!data.value)
      return '-'

    const priceCNY = financeHelper.calculateValueCNY(data.value, exchangeRates.value)
    if (priceCNY <= 0)
      return formatFinanceMetricValue(0, financeBaseCurrency.value)

    return `${formatFinanceMetricValue(priceCNY, financeBaseCurrency.value)} / ${getBillingCycleText(data.value.billing_cycle, appStore.lang)}`
  })

  const monthlyAverageCostText = computed(() => {
    if (!data.value)
      return '-'

    if (Number(data.value.billing_cycle) <= 0)
      return appStore.lang === 'zh-CN' ? '不适用' : 'N/A'

    const monthlyAverageCost = financeHelper.calculateMonthlyAverageCostCNY(data.value, exchangeRates.value)
    return `${formatFinanceMetricValue(monthlyAverageCost, financeBaseCurrency.value)} / 月`
  })

  const remainingTimeText = computed(() => {
    if (!data.value?.expired_at)
      return '-'

    return getExpireText(data.value.expired_at, appStore.lang)
  })

  const remainingValueText = computed(() => {
    if (!data.value)
      return '-'

    const remainingValueCNY = financeHelper.calculateRemainingValueCNY(data.value, exchangeRates.value)
    return formatFinanceMetricValue(remainingValueCNY, financeBaseCurrency.value)
  })

  const remainingTimeValueClass = computed(() => {
    if (!data.value?.expired_at)
      return ''

    const status = getExpireStatus(data.value.expired_at)
    if (status === 'expired' || status === 'critical')
      return 'text-destructive'
    if (status === 'warning')
      return 'text-orange-600 dark:text-orange-400'
    if (status === 'long_term')
      return 'text-muted-foreground'
    return 'text-emerald-600 dark:text-emerald-400'
  })

  const metricCards = computed<MetricCard[]>(() => {
    if (!data.value)
      return []

    const nodePrice = splitMetricValue(nodePriceText.value)
    const monthlyAverageCost = splitMetricValue(monthlyAverageCostText.value)
    const remainingTime = splitMetricValue(remainingTimeText.value)
    const remainingValue = splitMetricValue(remainingValueText.value)

    return [
      {
        label: '节点价格',
        value: nodePrice.value,
        unit: nodePrice.unit,
        icon: 'tabler:cash',
      },
      {
        label: '月均支出',
        value: monthlyAverageCost.value,
        unit: monthlyAverageCost.unit,
        icon: 'tabler:receipt-2',
      },
      {
        label: '剩余时间',
        value: remainingTime.value,
        unit: remainingTime.unit,
        icon: 'tabler:calendar-dollar',
        valueClass: remainingTimeValueClass.value,
      },
      {
        label: '剩余价值',
        value: remainingValue.value,
        unit: remainingValue.unit,
        icon: 'tabler:coins',
      },
    ]
  })

  const hardwareInfo = computed<InfoItem[]>(() => [
    { label: 'CPU', value: data.value ? `${data.value.cpu_name} (x${data.value.cpu_cores})` : '-', icon: 'icon-park-outline:cpu' },
    { label: '架构', value: data.value?.arch ?? '-', icon: 'icon-park-outline:application-two' },
    { label: '虚拟化', value: data.value?.virtualization ?? '-', icon: 'icon-park-outline:server' },
    { label: 'GPU', value: data.value?.gpu_name || '-', icon: 'icon-park-outline:video-one' },
  ])

  const systemInfo = computed<InfoItem[]>(() => [
    { label: '操作系统', value: data.value?.os ?? '-', icon: 'icon-park-outline:computer' },
    { label: '内核版本', value: data.value?.kernel_version ?? '-', icon: 'icon-park-outline:code' },
    { label: '运行时间', value: formatUptime(data.value?.uptime ?? 0), icon: 'icon-park-outline:timer' },
    { label: data.value?.online ? '最后上报' : '最后在线', value: `${formatDateTime(data.value?.time)} · ${formatRelativeTime(data.value?.time, nodesStore.now)}`, icon: 'icon-park-outline:time' },
  ])

  const storageInfo = computed<InfoItem[]>(() => [
    { label: '内存', value: formatBytes(data.value?.mem_total ?? 0), icon: 'icon-park-outline:memory' },
    { label: '内存交换', value: formatBytes(data.value?.swap_total ?? 0), icon: 'icon-park-outline:switch' },
    { label: '硬盘', value: formatBytes(data.value?.disk_total ?? 0), icon: 'icon-park-outline:hard-disk' },
  ])

  const trafficUsed = computed(() => {
    const node = data.value
    if (!node)
      return 0

    const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
    switch (traffic_limit_type) {
      case 'up':
        return net_total_up
      case 'down':
        return net_total_down
      case 'min':
        return Math.min(net_total_up, net_total_down)
      case 'max':
        return Math.max(net_total_up, net_total_down)
      case 'sum':
      default:
        return net_total_up + net_total_down
    }
  })

  const hasTrafficLimit = computed(() => (data.value?.traffic_limit ?? 0) > 0)

  const trafficUsedPercentage = computed(() => {
    const trafficLimit = data.value?.traffic_limit ?? 0
    if (trafficLimit <= 0)
      return 0

    return Math.min((trafficUsed.value / trafficLimit) * 100, 100)
  })

  const trafficUsageText = computed(() => {
    if (!hasTrafficLimit.value)
      return '无限流量'

    return `${formatBytes(trafficUsed.value)} / ${formatBytes(data.value?.traffic_limit ?? 0)}`
  })

  const trafficProgressStyle = computed(() => ({
    width: `${trafficUsedPercentage.value}%`,
  }))

  // ----- 实时占用，供各主题用自己的方式画（滑条 / 细条 / 血条） -----
  const ratio = (used: number, total: number) => total > 0 ? Math.min(100, used / total * 100) : 0
  const gauges = computed(() => {
    const node = data.value
    if (!node)
      return []
    const list = [
      { key: 'cpu', label: 'CPU', percent: node.cpu ?? 0, text: `${(node.cpu ?? 0).toFixed(1)}%` },
      { key: 'ram', label: '内存', percent: ratio(node.ram ?? 0, node.mem_total), text: `${formatBytes(node.ram ?? 0)} / ${formatBytes(node.mem_total ?? 0)}` },
      { key: 'disk', label: '硬盘', percent: ratio(node.disk ?? 0, node.disk_total), text: `${formatBytes(node.disk ?? 0)} / ${formatBytes(node.disk_total ?? 0)}` },
    ]
    if ((node.swap_total ?? 0) > 0)
      list.splice(2, 0, { key: 'swap', label: '交换', percent: ratio(node.swap ?? 0, node.swap_total), text: `${formatBytes(node.swap ?? 0)} / ${formatBytes(node.swap_total ?? 0)}` })
    if (hasTrafficLimit.value)
      list.push({ key: 'traffic', label: '流量', percent: trafficUsedPercentage.value, text: trafficUsageText.value })
    return list
  })
  const liveInfo = computed<InfoItem[]>(() => {
    const node = data.value
    if (!node)
      return []
    return [
      { label: '上行', value: `${formatBytesPerSecond(node.net_out ?? 0)} · 累计 ${formatBytes(node.net_total_up ?? 0)}` },
      { label: '下行', value: `${formatBytesPerSecond(node.net_in ?? 0)} · 累计 ${formatBytes(node.net_total_down ?? 0)}` },
      { label: '负载', value: `${(node.load ?? 0).toFixed(2)} / ${(node.load5 ?? 0).toFixed(2)} / ${(node.load15 ?? 0).toFixed(2)}` },
      { label: '连接', value: `TCP ${node.connections ?? 0} · UDP ${node.connections_udp ?? 0}` },
      { label: '进程', value: String(node.process ?? 0) },
    ]
  })
  const regionName = computed(() => getRegionDisplayName(data.value?.region ?? ''))
  const regionCode = computed(() => data.value?.region?.trim() ? getRegionCode(data.value.region) : '')
  const osName = computed(() => getOSName(data.value?.os ?? ''))
  const osImage = computed(() => getOSImage(data.value?.os ?? ''))

  return {
    data, orderedNodes, currentIndex, prevNode, nextNode, switchNode,
    metricCards, hardwareInfo, systemInfo, storageInfo,
    hasTrafficLimit, trafficUsedPercentage, trafficUsageText,
    gauges, liveInfo, regionName, regionCode, osName, osImage,
    formatBytes, formatBytesPerSecond,
  }
}
