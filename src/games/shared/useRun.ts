import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../../lib/rng'
import type { GameResult } from '../../types'

export type Phase = 'ready' | 'playing' | 'over'

export type RunOptions<S> = {
  seed?: string
  onFinish: (result: GameResult) => void
  /** A fresh game for a seed. */
  create(seed: string): S
  /** Advance by `dtMs` while playing. */
  step(s: S, dtMs: number): S
  phase(s: S): Phase
  /** What a finished run reports (the hook adds `durationMs`, not counting time spent paused). */
  result(s: S): Pick<GameResult, 'score' | 'won' | 'stats'>
}

/**
 * The shared life of a score-attack game: a requestAnimationFrame loop, every change funnelled through one place, a finished run
 * reported exactly once (never from a state updater, so StrictMode cannot double-report), a seeded restart, a session best,
 * and pause (P or Escape, the Pause button, or the tab being hidden). Input goes through `dispatch`, which is ignored while paused.
 */
export function useRun<S>(options: RunOptions<S>) {
  const [base] = useState(() => options.seed ?? String(createRandom()()))
  const [run, setRun] = useState(0)
  const [game, setGameState] = useState<S>(() => options.create(base))
  const [best, setBest] = useState(0)
  const [paused, setPausedState] = useState(false)
  const current = useRef(game)
  const opts = useRef(options)
  opts.current = options
  const startedAt = useRef(0)
  const pausedMs = useRef(0)
  const pausedAt = useRef(0)
  const isPaused = useRef(false)
  const reported = useRef(false)

  const apply = useCallback((next: S) => {
    const before = current.current
    if (next === before) return
    const { phase, result, onFinish } = opts.current
    current.current = next
    setGameState(next)
    if (phase(before) === 'ready' && phase(next) === 'playing') {
      startedAt.current = Date.now()
      pausedMs.current = 0
    }
    if (phase(next) === 'over' && !reported.current) {
      reported.current = true
      const r = result(next)
      setBest((b) => Math.max(b, r.score))
      onFinish({ ...r, durationMs: Math.max(0, Date.now() - startedAt.current - pausedMs.current) })
    }
  }, [])

  /** Player input: ignored while the run is paused. */
  const dispatch = useCallback((fn: (s: S) => S) => {
    if (!isPaused.current) apply(fn(current.current))
  }, [apply])

  const setPaused = useCallback((on: boolean) => {
    if (on === isPaused.current) return
    if (on && opts.current.phase(current.current) !== 'playing') return
    isPaused.current = on
    if (on) pausedAt.current = Date.now()
    else pausedMs.current += Date.now() - pausedAt.current
    setPausedState(on)
  }, [])

  const restart = useCallback(() => {
    reported.current = false
    isPaused.current = false
    setPausedState(false)
    const fresh = opts.current.create(`${base}-${run + 1}`)
    current.current = fresh
    setGameState(fresh)
    setRun(run + 1)
  }, [base, run])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      const s = current.current
      if (!isPaused.current && opts.current.phase(s) === 'playing') apply(opts.current.step(s, dt))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [apply])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
        if (opts.current.phase(current.current) !== 'playing') return
        setPaused(!isPaused.current)
        e.preventDefault()
      }
    }
    const onHidden = () => {
      if (document.hidden) setPaused(true)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [setPaused])

  return { game, phase: options.phase(game), dispatch, best, paused, setPaused, restart }
}

/** Keyboard input for a game: `handle` gets the lower-cased key and returns true when it used it (the page is then kept from scrolling). */
export function useKeys(handle: (key: string, e: KeyboardEvent) => boolean) {
  const latest = useRef(handle)
  latest.current = handle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (latest.current(e.key.toLowerCase(), e)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
