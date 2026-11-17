import { router, usePathname, type Href } from 'expo-router'
import { Text, View, XStack, YStack } from 'tamagui'

import { usePalette } from '@/hooks/usePalette'
import { useBridgeStatus, useRos, useTopic } from '@/ros/RosProvider'

import { BatteryIcon, StopIcon } from './icons'
import { Mono } from './Panel'

const TABS: { href: Href; label: string }[] = [
  { href: '/drive', label: 'Drive' },
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
  const openSettings = () => router.replace('/')

  return (
    <XStack h={64} items="center" gap="4" pl="2.5" pr="3" bg="background" borderBottomWidth={1} borderColor="border-color">
      <YStack
        h={48}
        justify="center"
        gap="0.5"
        px="3"
        rounded="lg"
        role="button"
        aria-label={`Robot at ${connection.host}, connection settings`}
        onPress={openSettings}
      >
        <Text fontSize="xs" color="color" opacity={0.68}>
          Robot
        </Text>
        <Mono fontSize="base" fontWeight="500">
          {connection.host}
        </Mono>
      </YStack>

      <XStack gap="1" p="1" bg="color-1" borderWidth={1} borderColor="border-color" rounded="xl" role="tablist">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <View
              key={tab.label}
              theme={active ? 'accent' : undefined}
              h={44}
              minW={76}
              px="4"
              items="center"
              justify="center"
              rounded="lg"
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
        items="center"
        gap="2.5"
        h={44}
        px="4"
        rounded="full"
        borderWidth={1}
        borderColor={online ? accent : 'border-color'}
        role="button"
        aria-label={`${STATUS_LABEL[status]}. Connection settings`}
        onPress={openSettings}
      >
        <View w={8} h={8} rounded="full" bg={online ? accent : 'stop-text'} />
        <Text fontSize="sm" fontWeight="500" color="color">
          {STATUS_LABEL[status]}
        </Text>
      </XStack>

      <XStack items="center" gap="2.5" h={44} px="4" rounded="full" borderWidth={1} borderColor="border-color">
        <BatteryIcon color={ink} />
        <Mono fontSize="sm">{battery ? `${battery.data} mV` : '—'}</Mono>
      </XStack>

      <XStack
        items="center"
        gap="2.5"
        h={48}
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
