// Minimal rosbridge v2 client over the platform WebSocket.
// Protocol: https://github.com/RobotWebTools/rosbridge_suite/blob/ros2/ROSBRIDGE_PROTOCOL.md

export type BridgeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

type Handler = (msg: any) => void

type Subscription = {
  type: string
  throttleMs: number
  handlers: Set<Handler>
}

type PendingCall = {
  resolve: (values: any) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const RECONNECT_DELAY_MS = 1500

export class RosBridge {
  private ws: WebSocket | null = null
  private url = ''
  private status: BridgeStatus = 'idle'
  private statusListeners = new Set<(status: BridgeStatus) => void>()
  private subscriptions = new Map<string, Subscription>()
  private advertised = new Map<string, string>()
  private pending = new Map<string, PendingCall>()
  private nextId = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  autoReconnect = true

  getStatus() {
    return this.status
  }

  getUrl() {
    return this.url
  }

  onStatus(listener: (status: BridgeStatus) => void) {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  connect(url: string) {
    this.url = url
    this.clearReconnect()
    this.closeSocket()
    this.open()
  }

  // drop a socket that has gone silent and dial again; a dead Wi-Fi link can
  // leave a WebSocket looking open until the OS times it out
  reconnect() {
    if (!this.url) return
    this.clearReconnect()
    this.closeSocket()
    this.setStatus('disconnected')
    this.open()
  }

  disconnect() {
    this.url = ''
    this.clearReconnect()
    this.closeSocket()
    this.advertised.clear()
    this.setStatus('idle')
  }

  publish(topic: string, type: string, msg: object) {
    if (this.advertised.get(topic) !== type) {
      this.advertised.set(topic, type)
      this.send({ op: 'advertise', id: this.id('advertise'), topic, type })
    }
    return this.send({ op: 'publish', topic, msg })
  }

  subscribe(topic: string, type: string, handler: Handler, throttleMs = 0) {
    let sub = this.subscriptions.get(topic)
    if (!sub) {
      sub = { type, throttleMs, handlers: new Set() }
      this.subscriptions.set(topic, sub)
      this.sendSubscribe(topic, sub)
    }
    sub.handlers.add(handler)
    return () => {
      const current = this.subscriptions.get(topic)
      if (!current) return
      current.handlers.delete(handler)
      if (current.handlers.size === 0) {
        this.subscriptions.delete(topic)
        this.send({ op: 'unsubscribe', id: `sub:${topic}`, topic })
      }
    }
  }

  callService<T = any>(service: string, args: object = {}, timeoutMs = 5000): Promise<T> {
    const id = this.id('call')
    return new Promise<T>((resolve, reject) => {
      if (this.status !== 'connected') {
        reject(new Error(`Not connected, cannot call ${service}`))
        return
      }
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${service} timed out`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.send({ op: 'call_service', id, service, args })
    })
  }

  private open() {
    if (!this.url) return
    this.setStatus('connecting')
    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws) return
      this.setStatus('connected')
      // a new socket has no server-side state: restore advertisements and subscriptions
      const topics = [...this.advertised.entries()]
      this.advertised.clear()
      for (const [topic, type] of topics) {
        this.advertised.set(topic, type)
        this.send({ op: 'advertise', id: this.id('advertise'), topic, type })
      }
      for (const [topic, sub] of this.subscriptions) this.sendSubscribe(topic, sub)
    }

    ws.onmessage = (event) => {
      if (this.ws !== ws) return
      this.handleMessage(event.data)
    }

    ws.onerror = () => {
      // onclose follows; reconnect is handled there
    }

    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.failPending('Connection closed')
      this.setStatus('disconnected')
      if (this.autoReconnect && this.url) {
        this.reconnectTimer = setTimeout(() => this.open(), RECONNECT_DELAY_MS)
      }
    }
  }

  private handleMessage(data: unknown) {
    if (typeof data !== 'string') return
    let message: any
    try {
      message = JSON.parse(data)
    } catch {
      return
    }
    if (message.op === 'publish') {
      const sub = this.subscriptions.get(message.topic)
      if (sub) for (const handler of sub.handlers) handler(message.msg)
    } else if (message.op === 'service_response') {
      const call = this.pending.get(message.id)
      if (!call) return
      this.pending.delete(message.id)
      clearTimeout(call.timer)
      if (message.result === false) {
        call.reject(new Error(typeof message.values === 'string' ? message.values : `${message.service} failed`))
      } else {
        call.resolve(message.values)
      }
    }
  }

  private sendSubscribe(topic: string, sub: Subscription) {
    this.send({
      op: 'subscribe',
      id: `sub:${topic}`,
      topic,
      type: sub.type,
      throttle_rate: sub.throttleMs,
      queue_length: 1,
    })
  }

  private send(message: object) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(message))
    return true
  }

  private id(prefix: string) {
    this.nextId += 1
    return `${prefix}:${this.nextId}`
  }

  private setStatus(status: BridgeStatus) {
    if (this.status === status) return
    this.status = status
    for (const listener of this.statusListeners) listener(status)
  }

  private failPending(reason: string) {
    for (const [, call] of this.pending) {
      clearTimeout(call.timer)
      call.reject(new Error(reason))
    }
    this.pending.clear()
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private closeSocket() {
    const ws = this.ws
    this.ws = null
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
      ws.close()
    }
    this.failPending('Connection closed')
  }
}
