import { NetInfoStateType, useNetInfo } from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { Text, XStack } from 'tamagui'

import { usePalette } from '@/hooks/usePalette'
import { useBridgeStatus, useRos } from '@/ros/RosProvider'

import { HexapodIcon } from './icons'
import { Mono } from './Panel'

const PING_MS = 3000

const toInt = (ip: string) => {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function sameSubnet(a: string, b: string, mask: string) {
  const [ia, ib, im] = [toInt(a), toInt(b), toInt(mask)]
  if (ia === null || ib === null || im === null) return null
  return (ia & im) === (ib & im)
}

function useRoundTrip() {
  const { robot } = useRos()
  const status = useBridgeStatus()
  const [rtt, setRtt] = useState<number | null>(null)

  useEffect(() => {
    if (status !== 'connected') {
      setRtt(null)
      return
    }
    let cancelled = false
    const measure = () => {
      const started = Date.now()
      robot
        .ping()
        .then(() => !cancelled && setRtt(Date.now() - started))
        .catch(() => !cancelled && setRtt(null))
    }
    measure()
    const timer = setInterval(measure, PING_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [status, robot])

  return rtt
}

export function NetworkPath() {
  const { ink, accent } = usePalette()
  const net = useNetInfo()
  const status = useBridgeStatus()
  const { connection } = useRos()
  const rtt = useRoundTrip()

  const details = net.type === NetInfoStateType.wifi || net.type === NetInfoStateType.ethernet ? net.details : null
  const tabletIp = details?.ipAddress ?? null
  const local = tabletIp && details?.subnet ? sameSubnet(tabletIp, connection.host, details.subnet) : null

  let link = 'No network'
  if (net.type === NetInfoStateType.wifi && net.details) {
    const { frequency, strength } = net.details
    const band = frequency ? `${(frequency / 1000).toFixed(1)} GHz` : null
    link = ['Wi-Fi', band, strength !== null ? `${strength}%` : null].filter(Boolean).join(' · ')
  } else if (net.type === NetInfoStateType.ethernet) link = 'Ethernet'
  else if (net.type === NetInfoStateType.vpn) link = 'VPN'
  else if (net.type === NetInfoStateType.cellular) link = 'Cellular'

  const route =
    status !== 'connected'
      ? 'Robot not reachable'
      : net.type === NetInfoStateType.vpn
        ? 'Through a VPN'
        : local === false
          ? 'Routed outside this network'
          : 'Direct on local network'

  return (
    <XStack
      h={40}
      items="center"
      gap="3"
      px="5"
      bg="background"
      borderTopWidth={1}
      borderColor="border-color"
      role="status"
      aria-label="Network path"
    >
      <Text fontSize="xs" fontWeight="600" letterSpacing={1} textTransform="uppercase" opacity={0.68}>
        Network path
      </Text>

      <XStack items="center" gap="2">
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={ink} strokeOpacity={0.7} strokeWidth={1.5}>
          <Rect x={1.5} y={3} width={13} height={10} rx={1.5} />
        </Svg>
        <Text fontSize="sm" opacity={0.85}>
          This tablet
        </Text>
        <Mono fontSize="sm">{tabletIp ?? '—'}</Mono>
      </XStack>

      <Arrow color={ink} />

      <XStack items="center" gap="2">
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={ink} strokeOpacity={0.7} strokeWidth={1.5} strokeLinecap="round">
          <Path d="M1.5 6 A9.5 9.5 0 0 1 14.5 6 M4 8.8 A6 6 0 0 1 12 8.8 M6.4 11.4 A2.6 2.6 0 0 1 9.6 11.4" />
          <Circle cx={8} cy={13.5} r={0.8} fill={ink} />
        </Svg>
        <Text fontSize="sm" opacity={0.85}>
          {link}
        </Text>
      </XStack>

      <Arrow color={ink} dim={status !== 'connected'} />

      <XStack items="center" gap="2" opacity={status === 'connected' ? 1 : 0.5}>
        <HexapodIcon size={16} color={accent} />
        <Text fontSize="sm" opacity={0.85}>
          ROSpider
        </Text>
        <Mono fontSize="sm">{connection.host}</Mono>
      </XStack>

      <XStack flex={1} />

      <Text fontSize="sm" color={status === 'connected' ? 'color' : 'stop-text'} opacity={status === 'connected' ? 0.85 : 1}>
        {route}
      </Text>
      <Mono fontSize="sm" opacity={0.6}>
        ws :{connection.bridgePort} · http :{connection.videoPort}
      </Mono>
      <XStack items="center" gap="1.5">
        <Text fontSize="sm" opacity={0.85}>
          Round trip
        </Text>
        <Mono fontSize="sm">{rtt !== null ? `${rtt} ms` : '—'}</Mono>
      </XStack>
    </XStack>
  )
}

function Arrow({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <Svg width={18} height={10} viewBox="0 0 18 10" fill="none" stroke={color} strokeOpacity={dim ? 0.2 : 0.45} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 5 H16 M12 1 L16 5 L12 9" />
    </Svg>
  )
}
