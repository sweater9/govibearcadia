/**
 * Cosmetic game effects, drawn with short-lived DOM elements and CSS (no canvas, no files, no network).
 * `attachGameEffects` watches a game's container like `attachGameSound` does, so every game gets them without its own code:
 * a confetti burst when a win panel appears, a short shake when a game-over panel appears, and a "+N" pop when the score rises.
 * Nothing here touches game state or rules. Skipped entirely when the player prefers reduced motion.
 */
import { createRandom, type Random } from './rng'

export interface ConfettiPiece {
  x: number
  y: number
  rotate: number
  delay: number
  hue: number
}

/** Confetti landing positions as offsets in pixels from the burst origin; deterministic for a given seed. */
export function confettiPieces(count: number, random: Random): ConfettiPiece[] {
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2
    const dist = 80 + random() * 160
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.7 + 120, rotate: Math.round(random() * 720 - 360), delay: Math.round(random() * 120), hue: Math.round(random() * 360) }
  })
}

/** The rise between two score readings, or 0 when either is not a plain number or it did not go up. */
export function scoreGain(previous: string | null, next: string | null): number {
  if (previous === null || next === null) return 0
  if (!/^-?\d+$/.test(previous.trim()) || !/^-?\d+$/.test(next.trim())) return 0
  return Math.max(0, Number(next) - Number(previous))
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
let counter = 0

function spawn(root: HTMLElement, el: HTMLElement, ms: number) {
  root.appendChild(el)
  setTimeout(() => el.remove(), ms)
}

function confetti(root: HTMLElement) {
  const box = document.createElement('div')
  box.className = 'fx-confetti'
  box.setAttribute('aria-hidden', 'true')
  for (const p of confettiPieces(36, createRandom(`fx-${counter++}`))) {
    const bit = document.createElement('i')
    bit.style.cssText = `--x:${p.x.toFixed(0)}px;--y:${p.y.toFixed(0)}px;--r:${p.rotate}deg;animation-delay:${p.delay}ms;background:hsl(${p.hue} 85% 60%)`
    box.appendChild(bit)
  }
  spawn(root, box, 1600)
}

function pop(root: HTMLElement, anchor: HTMLElement, gain: number) {
  const a = anchor.getBoundingClientRect()
  const r = root.getBoundingClientRect()
  const el = document.createElement('span')
  el.className = 'fx-pop'
  el.setAttribute('aria-hidden', 'true')
  el.textContent = `+${gain}`
  el.style.left = `${a.left - r.left + a.width / 2}px`
  el.style.top = `${a.top - r.top}px`
  spawn(root, el, 900)
}

/** Returns a cleanup function. */
export function attachGameEffects(root: HTMLElement): () => void {
  if (reducedMotion()) return () => {}
  let announced = false
  let lastScore: string | null = null
  const scoreEl = () => {
    for (const small of root.querySelectorAll('.game-toolbar small')) {
      if (/^score$/i.test(small.textContent?.trim() ?? '')) return small.parentElement?.querySelector('strong') ?? null
    }
    return null
  }
  lastScore = scoreEl()?.textContent ?? null
  const observer = new MutationObserver(() => {
    const panel = root.querySelector('.game-over, .win-message')
    if (!panel) announced = false
    else if (!announced) {
      announced = true
      if (panel.matches('.win-message')) confetti(root)
      else {
        root.classList.add('fx-shake')
        setTimeout(() => root.classList.remove('fx-shake'), 450)
      }
    }
    const el = scoreEl()
    const now = el?.textContent ?? null
    const gain = scoreGain(lastScore, now)
    if (el && gain > 0) pop(root, el, gain)
    lastScore = now
  })
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}
