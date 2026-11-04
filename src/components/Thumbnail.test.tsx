import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { registry } from '../games/registry'
import { THUMBNAIL_IDS, Thumbnail } from './Thumbnail'

describe('Thumbnail', () => {
  it('every game has its own thumbnail, and every thumbnail belongs to a game', () => {
    expect([...THUMBNAIL_IDS].sort()).toEqual(registry.map((g) => g.meta.id).sort())
  })
  it('is decorative: hidden from assistive technology, 16:9, and uses no gradients', () => {
    for (const id of THUMBNAIL_IDS) {
      const { container } = render(<Thumbnail id={id} />)
      const svg = container.querySelector('svg')!
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(svg.getAttribute('viewBox')).toBe('0 0 160 90')
      expect(container.querySelector('linearGradient,radialGradient')).toBeNull()
    }
  })
})
