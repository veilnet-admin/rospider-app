import type { RosBridge } from './rosbridge'

// Interfaces exposed by the ROSpider's ROS 2 graph (checked against the robot).

export const LIMITS = {
  // move_controller clamps cmd_vel to these
  vx: 0.12,
  vy: 0.1,
  wz: 0.6,
  // move_controller caps body rotation (rad)
  roll: 0.2,
  pitch: 0.2,
  yaw: 0.4,
} as const

export type Gait = 'tripod' | 'ripple'
export type Stance = 'low' | 'middle' | 'high'

const GAIT_ID: Record<Gait, number> = { ripple: 1, tripod: 2 }
const STANCE_POSE: Record<Stance, string> = {
  low: 'DEFAULT_POSE',
  middle: 'DEFAULT_POSE_M',
  high: 'SLAM_POSE',
}

export const ARM = {
  joints: [
    { id: 19, label: 'Joint 1' },
    { id: 20, label: 'Joint 2' },
    { id: 21, label: 'Joint 3' },
    { id: 22, label: 'Joint 4' },
    { id: 23, label: 'Joint 5' },
  ],
  gripperId: 24,
  gripperOpen: 700,
  gripperClosed: 450,
  // a higher joint-1 pulse turns the arm to the robot's left (checked against the IK solver)
  leftIsHigherPulse: true,
  // stowed pose used by the robot's own pick-and-place routines
  home: [
    [19, 500],
    [20, 700],
    [21, 155],
    [22, 70],
    [23, 500],
  ] as [number, number][],
} as const

export type ModeId = 'line' | 'kick' | 'lidar' | 'balance' | 'gesture' | 'trajectory'

// service namespace of each app mode
export const MODE_NS: Record<ModeId, string> = {
  line: '/line_following',
  kick: '/intelligent_kick',
  lidar: '/lidar_app',
  balance: '/self_balancing',
  gesture: '/hand_gesture',
  trajectory: '/hand_trajectory',
}

export type LidarBehavior = 1 | 2 | 3

export type Twist = {
  linear: { x: number; y: number; z: number }
  angular: { x: number; y: number; z: number }
}

export type LaserScan = {
  angle_min: number
  angle_increment: number
  range_min: number
  range_max: number
  ranges: (number | null)[]
}

export type Quaternion = { x: number; y: number; z: number; w: number }
export type Imu = { orientation: Quaternion }
export type Odometry = { pose: { pose: { position: { x: number; y: number }; orientation: Quaternion } } }
export type ServoState = { id: number; goal: number; position: number; error: number; voltage: number }
export type ServoStateList = { servo_state: ServoState[] }
export type ArmPose = {
  success: boolean
  solution: boolean
  pose: { position: { x: number; y: number; z: number }; orientation: Quaternion }
}
export type ArmSolution = { success: boolean; pulse: number[] }

export function createRobot(bridge: RosBridge) {
  const call = <T = any>(service: string, args: object = {}) => bridge.callService<T>(service, args)

  const drive = (vx: number, vy: number, wz: number) =>
    bridge.publish('/controller/cmd_vel', 'geometry_msgs/msg/Twist', {
      linear: { x: vx, y: vy, z: 0 },
      angular: { x: 0, y: 0, z: wz },
    } satisfies Twist)

  const runAction = (name: string) =>
    bridge.publish('/controller/run_actionset', 'interfaces/msg/RunActionSet', {
      action_path: name,
      interrupt: true,
    })

  return {
    drive,
    runAction,

    setGaitAndStance(gait: Gait, stance: Stance) {
      // step height (mm) and period (s) match the robot's own joystick defaults
      return bridge.publish('/step_controller/cmd_param', 'interfaces/msg/CmdParam', {
        pose: STANCE_POSE[stance],
        gait: GAIT_ID[gait],
        height: 20,
        period: 1.0,
      })
    },

    setBuiltInPose(pose: 'DEFAULT_POSE' | 'SLAM_POSE') {
      return call('/controller/set_pose_1', { pose, duration: 1.0, interrupt: true })
    },

    setBodyRotation(roll: number, pitch: number, yaw: number) {
      return bridge.publish('/controller/set_pose_euler', 'kinematics_msgs/msg/Pose', {
        position: { x: 0, y: 0, z: 0 },
        orientation: { roll, pitch, yaw },
      })
    },

    setServos(positions: [number, number][], duration: number) {
      return bridge.publish('/servo_controller', 'servo_controller_msgs/msg/ServosPosition', {
        duration,
        position_unit: 'pulse',
        position: positions.map(([id, position]) => ({ id, position })),
      })
    },

    // stop walking and any running action group; the robot settles into its init pose
    stopAll() {
      drive(0, 0, 0)
      runAction('stop')
    },

    enterMode: (mode: ModeId) => call(`${MODE_NS[mode]}/enter`),
    exitMode: (mode: ModeId) => call(`${MODE_NS[mode]}/exit`),
    heartbeat: (mode: ModeId) => call(`${MODE_NS[mode]}/heartbeat`, { data: true }),
    setModeRunning: (mode: ModeId, running: boolean) => call(`${MODE_NS[mode]}/set_running`, { data: running }),
    setLidarBehavior: (behavior: LidarBehavior | 0) => call('/lidar_app/set_running', { data: behavior }),
    setTargetPoint: (mode: 'line' | 'kick', x: number, y: number) =>
      call(`${MODE_NS[mode]}/set_target_color`, { data: { x, y, z: 0 } }),
    getTargetColor: (mode: 'line' | 'kick') =>
      call<{ success: boolean; message: string }>(`${MODE_NS[mode]}/get_target_color`),
    setColorThreshold: (mode: 'line' | 'kick', value: number) => call(`${MODE_NS[mode]}/set_threshold`, { data: value }),
    startTrajectory: () => call('/hand_trajectory/start'),
    stopTrajectory: () => call('/hand_trajectory/stop'),

    rosVersion: () => call<{ version: number; distro: string }>('/rosapi/get_ros_version'),
    // cheapest round trip through rosbridge, for latency
    ping: () => call('/rosapi/get_time'),

    // the arm's IK only computes joint pulses; the caller drives the servos
    getArmPose: () => call<ArmPose>('/arm_kinematics/get_current_pose'),
    solveArmPose: (position: [number, number, number], pitchDeg: number) =>
      call<ArmSolution>('/arm_kinematics/set_pose_target', {
        position,
        pitch: pitchDeg,
        pitch_range: [-50, 50],
        resolution: 1,
        duration: 1,
      }),
  }
}

export type Robot = ReturnType<typeof createRobot>

export function pitchDegrees(q: Quaternion) {
  const sinp = Math.max(-1, Math.min(1, 2 * (q.w * q.y - q.z * q.x)))
  return (Math.asin(sinp) * 180) / Math.PI
}

export function yawFromQuaternion(q: Quaternion) {
  return Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
}

export function rollPitchYaw(q: Quaternion) {
  const roll = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y))
  const sinp = 2 * (q.w * q.y - q.z * q.x)
  const pitch = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp)
  return { roll, pitch, yaw: yawFromQuaternion(q) }
}
