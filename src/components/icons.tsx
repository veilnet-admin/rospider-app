import Svg, { Circle, Path, Rect } from 'react-native-svg'

type IconProps = { size?: number; color: string }

export function StopIcon({ size = 20, color }: IconProps) {
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

// a generic controller board, for the robot end of the network path
export function RobotIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Rect x={6} y={6} width={12} height={12} rx={2} />
      <Path d="M9 2.5 V6 M15 2.5 V6 M9 18 V21.5 M15 18 V21.5 M2.5 9 H6 M2.5 15 H6 M18 9 H21.5 M18 15 H21.5" />
    </Svg>
  )
}

export function PlayIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5 L19 12 L7 19.5 Z" fill={color} />
    </Svg>
  )
}

export function PauseIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6} y={5} width={4} height={14} rx={1} fill={color} />
      <Rect x={14} y={5} width={4} height={14} rx={1} fill={color} />
    </Svg>
  )
}

export function SquareStopIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6} y={6} width={12} height={12} rx={2} fill={color} />
    </Svg>
  )
}

export function InfoIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11 V16.5 M12 7.6 V7.5" />
    </Svg>
  )
}

export function ArmIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3.5 20.5 H13 M8.5 20.5 V15 L14.5 9 L19 11.5 M19 11.5 L20.5 9.2 M19 11.5 L21.5 12.6" />
      <Circle cx={8.5} cy={15} r={1.6} />
      <Circle cx={14.5} cy={9} r={1.6} />
    </Svg>
  )
}

export function ChevronIcon({ size = 18, color, up }: IconProps & { up?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={up ? 'M6 15 L12 9 L18 15' : 'M6 9 L12 15 L18 9'} />
    </Svg>
  )
}

export function TargetIcon({ size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={7} />
      <Path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22" />
    </Svg>
  )
}

export type ModeIconKind = 'line' | 'kick' | 'lidar' | 'balance' | 'gesture' | 'trajectory'

const MODE_PATHS: Record<ModeIconKind, string> = {
  line: 'M3 19 C8 19 8 12 12 12 S16 5 21 5 M17.5 3.6 L21 5 L19.4 8.4',
  kick: 'M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M12 8.2 L15.3 10.6 L14 14.5 H10 L8.7 10.6 Z',
  lidar:
    'M12 10.2 A1.8 1.8 0 1 1 11.99 10.2 Z M7.8 7.8 A6 6 0 0 0 7.8 16.2 M16.2 7.8 A6 6 0 0 1 16.2 16.2 M4.9 4.9 A10 10 0 0 0 4.9 19.1 M19.1 4.9 A10 10 0 0 1 19.1 19.1',
  balance: 'M6 8.5 H18 A3.5 3.5 0 0 1 18 15.5 H6 A3.5 3.5 0 0 1 6 8.5 Z M9.5 8.5 V15.5 M14.5 8.5 V15.5 M12 10.8 A1.2 1.2 0 1 1 11.99 10.8 Z',
  gesture:
    'M8 12.5 V5.5 A1.5 1.5 0 0 1 11 5.5 V11 M11 10.5 V4 A1.5 1.5 0 0 1 14 4 V11 M14 10.5 V5.5 A1.5 1.5 0 0 1 17 5.5 V12 M17 9.5 A1.5 1.5 0 0 1 20 9.5 V15 A7 7 0 0 1 13 22 H12 A6 6 0 0 1 7 19.3 L4.3 15.6 A1.6 1.6 0 0 1 6.9 13.8 L8 15.5',
  trajectory: 'M4 19 C6 12 10 17 12 11 S17 6 20 5',
}

export function ModeIcon({ kind, size = 26, color }: IconProps & { kind: ModeIconKind }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={MODE_PATHS[kind]} strokeDasharray={kind === 'trajectory' ? '2 3' : undefined} />
      {kind === 'trajectory' ? (
        <>
          <Circle cx={4} cy={19} r={1.6} />
          <Circle cx={20} cy={5} r={1.6} />
        </>
      ) : null}
    </Svg>
  )
}
