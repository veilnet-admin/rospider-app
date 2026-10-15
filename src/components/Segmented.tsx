import { Text, View, XStack } from 'tamagui'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

export function Segmented<T extends string>({ options, value, onChange, disabled }: Props<T>) {
  return (
    <XStack gap="1" p="1" bg="color-1" borderWidth={1} borderColor="border-color" rounded="xl" opacity={disabled ? 0.5 : 1}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <View
            key={option.value}
            theme={selected ? 'accent' : undefined}
            flex={1}
            h={44}
            items="center"
            justify="center"
            rounded="lg"
            bg={selected ? 'background' : 'transparent'}
            role="button"
            aria-selected={selected}
            aria-disabled={disabled}
            onPress={disabled ? undefined : () => onChange(option.value)}
          >
            <Text fontSize="sm" fontWeight="600" color="color" opacity={selected ? 1 : 0.78}>
              {option.label}
            </Text>
          </View>
        )
      })}
    </XStack>
  )
}
