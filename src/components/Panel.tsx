import type { ReactNode } from 'react'
import { Text, YStack, type TextProps, type YStackProps } from 'tamagui'

// a raised surface: one level above whatever it sits on
export function Panel(props: YStackProps) {
  return (
    <YStack
      theme="level2"
      bg="background"
      borderWidth={1}
      borderColor="border-color"
      rounded="2xl"
      p="4"
      gap="3"
      {...props}
    />
  )
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="xs" fontWeight="600" letterSpacing={1} textTransform="uppercase" color="color" opacity={0.68}>
      {children}
    </Text>
  )
}

export function Muted(props: TextProps) {
  return <Text fontSize="sm" lineHeight={1.45} color="color" opacity={0.68} {...props} />
}

export function Mono(props: TextProps) {
  return <Text fontFamily="mono" color="color" {...props} />
}
