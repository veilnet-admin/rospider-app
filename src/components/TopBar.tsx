import { router, usePathname, type Href } from 'expo-router'
import { Text, View, XStack, YStack } from 'tamagui'

import { usePalette } from '@/hooks/usePalette'
import { useBridgeStatus, useRos, useTopic } from '@/ros/RosProvider'

import { BatteryIcon, HexapodIcon, StopIcon } from './icons'
import { Mono } from './Panel'

const TABS: { href: Href; label: string }[] = [
  { href: '/drive', label: 'Drive' },
  { href: '/pose', label: 'Body & arm' },
  { href: '/actions', label: 'Actions' },
  { href: '/modes', label: 'Modes' },
  { href: '/sensors', label: 'Sensors' },
]

const STATUS_LABEL = {
  idle: 'Not connected',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Reconnecting',
} as const

export function TopBar() {
  const { accent, ink } = usePalette()
  const pathname = usePathname()
  const status = useBridgeStatus()
  const { connection, emergencyStop } = useRos()
  const battery = useTopic<{ data: number }>('/ros_robot_controller/battery', 'std_msgs/msg/UInt16', 2000)
  const online = status === 'connected'

  return (
    <XStack h={72} items="center" gap="5" pl="5" pr="4" bg="background" borderBottomWidth={1} borderColor="border-color">
      <XStack items="center" gap="3" minW={180} role="button" aria-label="Connection settings" onPress={() => router.replace('/')}>
        <HexapodIcon color={accent} />
        <YStack gap="0.5">
          <Text fontSize="base" fontWeight="600">
            ROSpider
          </Text>
          <Mono fontSize="xs" opacity={0.68}>
            {connection.host}
          </Mono>
        </YStack>
      </XStack>

      <XStack gap="1" p="1" bg="color-1" borderWidth={1} borderColor="border-color" rounded="2xl" role="tablist">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <View
              key={tab.label}
              theme={active ? 'accent' : undefined}
              h={44}
              px="4"
              justify="center"
              rounded="xl"
              bg={active ? 'background' : 'transparent'}
              role="tab"
              aria-selected={active}
              onPress={() => router.replace(tab.href)}
            >
              <Text fontSize="sm" fontWeight={active ? '600' : '500'} color="color" opacity={active ? 1 : 0.78}>
                {tab.label}
              </Text>
            </View>
          )
        })}
      </XStack>

      <View flex={1} />

      <XStack
        theme={online ? 'accent' : undefined}
        items="center"
        gap="2"
        h={40}
        px="3.5"
        rounded="full"
        bg={online ? 'background' : 'color-1'}
        borderWidth={1}
        borderColor="border-color"
      >
        <View w={8} h={8} rounded="full" bg={online ? 'color' : 'stop-text'} />
        <Text fontSize="sm" fontWeight="500" color="color">
          {STATUS_LABEL[status]}
        </Text>
      </XStack>

      <XStack items="center" gap="2" h={40} px="3.5" rounded="full" borderWidth={1} borderColor="border-color">
        <BatteryIcon color={ink} />
        <Mono fontSize="sm">{battery ? `${battery.data} mV` : '—'}</Mono>
      </XStack>

      <XStack
        items="center"
        gap="2.5"
        h={52}
        px="5"
        rounded="xl"
        bg="stop"
        scale="press:0.97"
        role="button"
        aria-label="Stop all motion"
        onPress={emergencyStop}
      >
        <StopIcon color="#ffffff" />
        <Text fontSize="base" fontWeight="700" letterSpacing={1} color="white">
          STOP
        </Text>
      </XStack>
    </XStack>
  )
}
