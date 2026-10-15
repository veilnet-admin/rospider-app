import Storage from 'expo-sqlite/kv-store'

import { ARM } from './robot'

export type JointPose = [number, number][]

const KEY = 'arm.restPose'

// the rest pose the user saved, else the robot's own stowed pose
export function loadRestPose(): JointPose {
  try {
    const raw = Storage.getItemSync(KEY)
    if (!raw) return ARM.home
    const pose = JSON.parse(raw) as JointPose
    const valid =
      Array.isArray(pose) &&
      pose.length === ARM.joints.length &&
      pose.every(([id, p]) => Number.isFinite(id) && Number.isFinite(p))
    return valid ? pose : ARM.home
  } catch {
    return ARM.home
  }
}

export function saveRestPose(pose: JointPose) {
  Storage.setItemSync(KEY, JSON.stringify(pose))
}
