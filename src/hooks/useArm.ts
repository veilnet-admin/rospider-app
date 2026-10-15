import { useEffect, useRef, useState } from 'react'

import { loadRestPose, saveRestPose, type JointPose } from '@/ros/armRest'
import { ARM, pitchDegrees, type ServoStateList } from '@/ros/robot'
import { useRos, useTopic } from '@/ros/RosProvider'

export type ArmStatus = 'unknown' | 'out' | 'moving' | 'rest'

const AT_REST_TOLERANCE = 25 // servo pulses
const REST_DURATION_S = 1.5
const MOVE_TIMEOUT_MS = 3500
const AIM_TICK_MS = 120
const AIM_DEADZONE = 0.15
const LIFT_PER_TICK_M = 0.008
const TURN_PER_TICK = 10 // joint-1 pulses

const clampPulse = (v: number) => Math.round(Math.max(0, Math.min(1000, v)))

export function useArm(enabled: boolean) {
  const { robot } = useRos()
  const servos = useTopic<ServoStateList>('/controller_manager/servo_states', 'servo_controller_msgs/msg/ServoStateList', 250)
  const [restPose, setRestPose] = useState<JointPose>(loadRestPose)
  const [movingSince, setMovingSince] = useState<number | null>(null)
  const [grip, setGrip] = useState<'open' | 'closed' | null>(null)
  const aim = useRef({ x: 0, y: 0 })
  const busy = useRef(false)
  const joint1 = useRef<number | null>(null)
  const latestJoint1 = useRef<number | undefined>(undefined)

  const positions = new Map((servos?.servo_state ?? []).map((s) => [s.id, s.position]))
  const current: JointPose | null = ARM.joints.every((j) => positions.has(j.id))
    ? ARM.joints.map((j) => [j.id, positions.get(j.id) ?? 0])
    : null

  const atRest = current !== null && restPose.every(([id, p]) => Math.abs((positions.get(id) ?? -999) - p) <= AT_REST_TOLERANCE)

  // a rest command is "moving" until the servos arrive or it times out
  useEffect(() => {
    if (movingSince === null) return
    if (atRest) {
      setMovingSince(null)
      return
    }
    const timer = setTimeout(() => setMovingSince(null), MOVE_TIMEOUT_MS - (Date.now() - movingSince))
    return () => clearTimeout(timer)
  }, [movingSince, atRest])

  const status: ArmStatus = movingSince !== null ? 'moving' : current === null ? 'unknown' : atRest ? 'rest' : 'out'

  const rest = () => {
    if (!enabled) return
    aim.current = { x: 0, y: 0 }
    robot.setServos(restPose, REST_DURATION_S)
    setMovingSince(Date.now())
  }

  const saveCurrentAsRest = () => {
    if (!current) return
    saveRestPose(current)
    setRestPose(current)
  }

  const setGripper = (state: 'open' | 'closed') => {
    if (!enabled) return
    setGrip(state)
    robot.setServos([[ARM.gripperId, state === 'open' ? ARM.gripperOpen : ARM.gripperClosed]], 0.5)
  }

  const reportedJoint1 = positions.get(ARM.joints[0].id)
  useEffect(() => {
    latestJoint1.current = reportedJoint1
  }, [reportedJoint1])

  // aim pad: rate control while the pad is held
  useEffect(() => {
    if (!enabled) return
    const tick = async () => {
      const { x, y } = aim.current
      const turning = Math.abs(x) > AIM_DEADZONE
      const lifting = Math.abs(y) > AIM_DEADZONE
      if (busy.current || (!turning && !lifting)) {
        if (!turning && !lifting) joint1.current = null
        return
      }
      busy.current = true
      try {
        // right on the pad turns the arm right
        const turnStep = turning ? (ARM.leftIsHigherPulse ? -x : x) * TURN_PER_TICK : 0
        if (lifting) {
          const { pose } = await robot.getArmPose()
          const { x: px, y: py, z } = pose.position
          const solution = await robot.solveArmPose([px, py, z + y * LIFT_PER_TICK_M], pitchDegrees(pose.orientation))
          if (solution.success && solution.pulse.length >= 4) {
            const [p1, p2, p3, p4] = solution.pulse
            const j1 = clampPulse(p1 + turnStep)
            joint1.current = j1
            robot.setServos([[19, j1], [20, clampPulse(p2)], [21, clampPulse(p3)], [22, clampPulse(p4)]], AIM_TICK_MS / 1000)
          }
        } else {
          const base = joint1.current ?? latestJoint1.current ?? 500
          const j1 = clampPulse(base + turnStep)
          joint1.current = j1
          robot.setServos([[19, j1]], AIM_TICK_MS / 1000)
        }
      } catch {
        // an unreachable target or a dropped call just skips this tick
      } finally {
        busy.current = false
      }
    }
    const timer = setInterval(tick, AIM_TICK_MS)
    return () => clearInterval(timer)
  }, [enabled, robot])

  const setAim = (x: number, y: number) => {
    aim.current = { x, y }
    if (x !== 0 || y !== 0) setMovingSince(null)
  }

  return { status, restPose, current, grip, rest, saveCurrentAsRest, setGripper, setAim }
}
