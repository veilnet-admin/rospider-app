import { Slider, Text, XStack, YStack } from 'tamagui'

import { Mono } from './Panel'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
  disabled?: boolean
  rangeLabels?: [string, string]
}

export function ValueSlider({ label, value, min, max, step, display, onChange, disabled, rangeLabels }: Props) {
  return (
    <YStack gap="2" opacity={disabled ? 0.5 : 1}>
      <XStack items="baseline" justify="space-between">
        <Text fontSize="base" fontWeight="500">
          {label}
        </Text>
        <Mono fontSize="sm" opacity={0.85}>
          {display}
        </Mono>
      </XStack>
      <Slider
        size="lg"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
      >
        <Slider.Track bg="color-3">
          <Slider.TrackActive theme="accent" bg="accent-background" />
        </Slider.Track>
        <Slider.Thumb circular index={0} aria-label={label} />
      </Slider>
      {rangeLabels ? (
        <XStack justify="space-between">
          <Mono fontSize="xs" opacity={0.6}>
            {rangeLabels[0]}
          </Mono>
          <Mono fontSize="xs" opacity={0.6}>
            {rangeLabels[1]}
          </Mono>
        </XStack>
      ) : null}
    </YStack>
  )
}
