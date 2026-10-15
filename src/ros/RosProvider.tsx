import { createContext, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AppState } from 'react-native'

import { createRobot, type ModeId, type Robot } from './robot'
import { RosBridge, type BridgeStatus } from './rosbridge'

export type Connection = { host: string; bridgePort: string; videoPort: string }

export const DEFAULT_CONNECTION: Connection = { host: '192.168.4.9', bridgePort: '9090', videoPort: '8080' }

// app modes exit on their own when they miss heartbeats for 5 s
const HEARTBEAT_MS = 2000
// round-trip probe; two misses in a row means the link is dead
const PING_MS = 3000
const PING_TIMEOUT_MS = 2500
const MISSES_BEFORE_RECONNECT = 2

type RosContextValue = {
  bridge: RosBridge
  robot: Robot
  connection: Connection
  connect: (connection: Connection, autoReconnect: boolean) => void
  disconnect: () => void
  videoUrl: (topic: string) => string
  activeMode: ModeId | null
  enterMode: (mode: ModeId) => Promise<void>
  exitMode: () => Promise<void>
  stopped: boolean
  emergencyStop: () => void
  resume: () => void
  // last rosbridge round trip in ms, null while unknown or unreachable
  rtt: number | null
}

const RosContext = createContext<RosContextValue | null>(null)

export function RosProvider({ children }: { children: ReactNode }) {
  const [bridge] = useState(() => new RosBridge())
  const robot = useMemo(() => createRobot(bridge), [bridge])
  const [connection, setConnection] = useState(DEFAULT_CONNECTION)
  const [activeMode, setActiveMode] = useState<ModeId | null>(null)
  const [stopped, setStopped] = useState(false)
  const [rtt, setRtt] = useState<number | null>(null)
  const status = useSyncExternalStore(
    (listener) => bridge.onStatus(listener),
    () => bridge.getStatus()
  )

  const connect = useCallback(
    (next: Connection, autoReconnect: boolean) => {
      setConnection(next)
      bridge.autoReconnect = autoReconnect
      bridge.connect(`ws://${next.host}:${next.bridgePort}`)
    },
    [bridge]
  )

  const disconnect = useCallback(() => {
    if (bridge.getStatus() === 'connected') robot.stopWalking()
    setActiveMode(null)
    bridge.disconnect()
  }, [bridge, robot])

  const videoUrl = useCallback(
    (topic: string) => `http://${connection.host}:${connection.videoPort}/stream?topic=${topic}`,
    [connection]
  )

  const exitMode = useCallback(async () => {
    const mode = activeMode
    setActiveMode(null)
    if (mode) await robot.exitMode(mode).catch(() => {})
  }, [activeMode, robot])

  const enterMode = useCallback(
    async (mode: ModeId) => {
      if (activeMode && activeMode !== mode) await robot.exitMode(activeMode).catch(() => {})
      robot.stopWalking()
      await robot.enterMode(mode)
      setActiveMode(mode)
    },
    [activeMode, robot]
  )

  const emergencyStop = useCallback(() => {
    robot.stopAll()
    if (activeMode) robot.exitMode(activeMode).catch(() => {})
    setActiveMode(null)
    setStopped(true)
  }, [activeMode, robot])

  const resume = useCallback(() => setStopped(false), [])

  // measure the round trip, and reconnect when the robot stops answering
  useEffect(() => {
    if (status !== 'connected') {
      setRtt(null)
      return
    }
    let cancelled = false
    let misses = 0
    const probe = () => {
      const started = Date.now()
      bridge
        .callService('/rosapi/get_time', {}, PING_TIMEOUT_MS)
        .then(() => {
          if (cancelled) return
          misses = 0
          setRtt(Date.now() - started)
        })
        .catch(() => {
          if (cancelled) return
          misses += 1
          setRtt(null)
          if (misses >= MISSES_BEFORE_RECONNECT) bridge.reconnect()
        })
    }
    probe()
    const timer = setInterval(probe, PING_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [status, bridge])

  // keep the active mode alive
  useEffect(() => {
    if (!activeMode || status !== 'connected') return
    const tick = () => robot.heartbeat(activeMode).catch(() => {})
    tick()
    const timer = setInterval(tick, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [activeMode, status, robot])

  // walking persists on the robot, so never leave it walking when the app is backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && bridge.getStatus() === 'connected') robot.stopWalking()
    })
    return () => sub.remove()
  }, [bridge, robot])

  const value = useMemo<RosContextValue>(
    () => ({
      bridge,
      robot,
      connection,
      connect,
      disconnect,
      videoUrl,
      activeMode,
      enterMode,
      exitMode,
      stopped,
      emergencyStop,
      resume,
      rtt,
    }),
    [bridge, robot, connection, connect, disconnect, videoUrl, activeMode, enterMode, exitMode, stopped, emergencyStop, resume, rtt]
  )

  return <RosContext value={value}>{children}</RosContext>
}

export function useRos() {
  const ctx = use(RosContext)
  if (!ctx) throw new Error('useRos must be used inside RosProvider')
  return ctx
}

export function useBridgeStatus(): BridgeStatus {
  const { bridge } = useRos()
  return useSyncExternalStore(
    (listener) => bridge.onStatus(listener),
    () => bridge.getStatus()
  )
}

// latest message on a topic, throttled on the robot side
export function useTopic<T>(topic: string, type: string, throttleMs = 0): T | null {
  const { bridge } = useRos()
  const [message, setMessage] = useState<T | null>(null)
  useEffect(() => bridge.subscribe(topic, type, (msg) => setMessage(msg as T), throttleMs), [bridge, topic, type, throttleMs])
  return message
}
