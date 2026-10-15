import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { View } from 'tamagui'

import { usePalette } from '@/hooks/usePalette'

type Props = {
  width: number
  height: number
  knob: number
  // 'x' locks the knob to a horizontal track
  axis: 'both' | 'x'
  // 'square' clamps each axis on its own, for a rectangular pad
  shape?: 'round' | 'square'
  label: string
  disabled?: boolean
  // x right-positive, y up-positive, each in [-1, 1]
  onMove: (x: number, y: number) => void
}

export function Joystick({ width, height, knob, axis, shape = 'round', label, disabled, onMove }: Props) {
  const { ink } = usePalette()
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const reach = (width - knob) / 2
  const reachY = axis === 'x' ? 0 : (height - knob) / 2

  const move = (px: number, py: number) => {
    let dx = px - width / 2
    let dy = axis === 'x' ? 0 : py - height / 2
    if (axis === 'both' && shape === 'square') {
      dx = Math.max(-reach, Math.min(reach, dx))
      dy = Math.max(-reachY, Math.min(reachY, dy))
    } else if (axis === 'both') {
      const distance = Math.hypot(dx, dy)
      if (distance > reach) {
        dx = (dx / distance) * reach
        dy = (dy / distance) * reach
      }
    } else {
      dx = Math.max(-reach, Math.min(reach, dx))
    }
    tx.set(dx)
    ty.set(dy)
    onMove(dx / reach, reachY ? -dy / reachY : 0)
  }

  const release = () => {
    tx.set(withSpring(0))
    ty.set(withSpring(0))
    onMove(0, 0)
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(!disabled)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => move(e.x, e.y))
    .onUpdate((e) => move(e.x, e.y))
    .onFinalize(release)

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }],
  }))

  return (
    <GestureDetector gesture={pan}>
      <View
        w={width}
        h={height}
        rounded={shape === 'square' ? '2xl' : 'full'}
        bg="color-1"
        borderWidth={2}
        borderColor="border-color"
        items="center"
        justify="center"
        opacity={disabled ? 0.4 : 1}
        role="slider"
        aria-label={label}
      >
        {shape === 'square' ? (
          <>
            <View position="absolute" w={1} h={height - 24} bg="border-color" />
            <View position="absolute" h={1} w={width - 24} bg="border-color" />
            <Svg style={{ position: 'absolute' }} width={width} height={height} pointerEvents="none">
              <Path
                d={`M${width / 2 - 8} 22 L${width / 2} 14 L${width / 2 + 8} 22 M${width / 2 - 8} ${height - 22} L${width / 2} ${height - 14} L${width / 2 + 8} ${height - 22} M22 ${height / 2 - 8} L14 ${height / 2} L22 ${height / 2 + 8} M${width - 22} ${height / 2 - 8} L${width - 14} ${height / 2} L${width - 22} ${height / 2 + 8}`}
                stroke={ink}
                strokeOpacity={0.55}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </>
        ) : axis === 'both' ? (
          <>
            <View position="absolute" w={1} h={height - 24} bg="border-color" />
            <View position="absolute" h={1} w={width - 24} bg="border-color" />
            <View position="absolute" w={reach * 1.3} h={reach * 1.3} rounded="full" borderWidth={1} borderColor="border-color" />
          </>
        ) : (
          <View position="absolute" w={1} h={height - 20} bg="border-color" />
        )}
        <Animated.View style={[{ width: knob, height: knob }, knobStyle]}>
          <View theme="accent" flex={1} rounded="full" bg="background" borderWidth={3} borderColor="accent-background" items="center" justify="center">
            <View w={knob * 0.36} h={knob * 0.36} rounded="full" borderWidth={2} borderColor="color" opacity={0.5} />
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}
