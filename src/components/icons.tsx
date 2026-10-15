import Svg, { Path, Rect } from 'react-native-svg'

export function HexapodIcon({ size = 32, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={10} y={7} width={8} height={14} rx={4} />
      <Path d="M10 10 L5 7 L3 9 M10 14 L4 14 L2 16 M10 18 L5 21 L3 23 M18 10 L23 7 L25 9 M18 14 L24 14 L26 16 M18 18 L23 21 L25 23" />
    </Svg>
  )
}

export function StopIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Path d="M6.5 1.5 H13.5 L18.5 6.5 V13.5 L13.5 18.5 H6.5 L1.5 13.5 V6.5 Z" />
      <Path d="M6.5 10 H13.5" strokeLinecap="round" />
    </Svg>
  )
}

export function BatteryIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={14} viewBox="0 0 22 14" fill="none" stroke={color} strokeWidth={1.6}>
      <Rect x={1} y={1} width={17} height={12} rx={2.5} />
      <Path d="M20.5 5 L20.5 9" strokeLinecap="round" />
      <Rect x={3.5} y={3.5} width={9} height={7} rx={1} fill={color} stroke="none" />
    </Svg>
  )
}
