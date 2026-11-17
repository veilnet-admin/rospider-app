import { Text, View, XStack, YStack, type YStackProps } from 'tamagui'

import { PanelTitle } from './Panel'

// controls that float over the camera stay dark and see-through in either theme
export const GLASS = 'rgba(8, 9, 12, 0.74)'
export const GLASS_LIGHT = 'rgba(8, 9, 12, 0.62)'
export const GLASS_BORDER = 'rgba(255, 255, 255, 0.10)'
export const OVERLAY_INK = '#E7E9ED'

export function Glass(props: YStackProps) {
  return <YStack theme="dark" bg={GLASS} borderWidth={1} borderColor={GLASS_BORDER} rounded="xl" {...props} />
}

type Option<T extends string> = { value: T; label: string }

type ChipGroupProps<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  // shown as a small caption in front of the options
  label?: string
  // read out instead of the caption when there is none
  a11yLabel?: string
  disabled?: boolean
}

// a compact segmented control for the camera overlay
export function ChipGroup<T extends string>({ options, value, onChange, label, a11yLabel, disabled }: ChipGroupProps<T>) {
  return (
    <XStack
      theme="dark"
      items="center"
      gap="0.5"
      p="1"
      rounded="xl"
      bg={GLASS}
      borderWidth={1}
      borderColor={GLASS_BORDER}
      opacity={disabled ? 0.5 : 1}
      role="radiogroup"
      aria-label={label ?? a11yLabel}
    >
      {label ? (
        <View pl="2.5" pr="2">
          <PanelTitle>{label}</PanelTitle>
        </View>
      ) : null}
      {options.map((option) => {
        const selected = option.value === value
        return (
          <View
            key={option.value}
            theme={selected ? 'accent' : undefined}
            h={44}
            minW={56}
            px="3"
            items="center"
            justify="center"
            rounded="lg"
            bg={selected ? 'background' : 'transparent'}
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled}
            onPress={disabled ? undefined : () => onChange(option.value)}
          >
            <Text fontSize="sm" fontWeight={selected ? '600' : '500'} color="color" opacity={selected ? 1 : 0.8}>
              {option.label}
            </Text>
          </View>
        )
      })}
    </XStack>
  )
}
