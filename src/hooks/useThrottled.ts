import { useEffect, useRef } from 'react'

// calls fn at most once per interval, always delivering the latest arguments last
export function useThrottled<A extends unknown[]>(fn: (...args: A) => void, intervalMs: number) {
  const fnRef = useRef(fn)
  const lastAt = useRef(0)
  const pending = useRef<A | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return (...args: A) => {
    const wait = intervalMs - (Date.now() - lastAt.current)
    if (wait <= 0) {
      lastAt.current = Date.now()
      fnRef.current(...args)
      return
    }
    pending.current = args
    if (timer.current) return
    timer.current = setTimeout(() => {
      timer.current = null
      lastAt.current = Date.now()
      if (pending.current) fnRef.current(...pending.current)
      pending.current = null
    }, wait)
  }
}
