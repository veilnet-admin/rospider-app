import { Text, View } from 'tamagui'

type Props = {
  label: string
  onPress: () => void
  flex?: boolean
  size?: 'md' | 'lg'
  disabled?: boolean
}

export function PrimaryButton({ label, onPress, flex, size = 'lg', disabled }: Props) {
  return (
    <View
      theme="accent"
      flex={flex ? 1 : undefined}
      h={size === 'lg' ? 56 : 48}
      px="6"
      items="center"
      justify="center"
      rounded={size === 'lg' ? '2xl' : 'xl'}
      bg="background"
      opacity={disabled ? 0.5 : 1}
      scale="press:0.98"
      role="button"
      aria-disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <Text fontSize={size === 'lg' ? 'lg' : 'base'} fontWeight="600" color="color">
        {label}
      </Text>
    </View>
  )
}

export function SecondaryButton({ label, onPress, flex, size = 'lg', disabled }: Props) {
  return (
    <View
      flex={flex ? 1 : undefined}
      h={size === 'lg' ? 56 : 48}
      px={size === 'lg' ? '5' : '3'}
      items="center"
      justify="center"
      rounded={size === 'lg' ? '2xl' : 'xl'}
      bg="color-1"
      borderWidth={1}
      borderColor="border-color"
      opacity={disabled ? 0.5 : 1}
      scale="press:0.98"
      role="button"
      aria-disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <Text fontSize={size === 'lg' ? 'base' : 'sm'} fontWeight="500" color="color">
        {label}
      </Text>
    </View>
  )
}
