import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEMES } from './themes'

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const token = (block: string, name: string) => new RegExp(`--${name}:(#[0-9A-Fa-f]{6})`).exec(block)?.[1] as string

describe('theme accent colours keep the design’s contrast', () => {
  const root = /:root\{--bg:[^}]*\}/.exec(css)![0]
  const bg = token(root, 'bg')
  const surface = token(root, 'surface')
  for (const t of THEMES) {
    it(`${t.name}: primary is at least 4.5:1 on the page and on cards, and its text colour is at least 4.5:1 on it`, () => {
      const block = t.id === 'neon' ? root : new RegExp(`:root\\[data-theme=${t.id}\\]\\{[^}]*\\}`).exec(css)?.[0]
      expect(block, `${t.id} has a theme block`).toBeTruthy()
      const [primary, hover, on] = [token(block!, 'primary'), t.id === 'neon' ? token(root, 'primary-hover') : token(block!, 'primary-hover'), token(block!, 'on-primary')]
      expect(ratio(primary, bg)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(primary, surface)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(hover, bg)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(on, primary)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
