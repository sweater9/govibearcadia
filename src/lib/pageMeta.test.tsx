import { render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { usePageMeta } from './pageMeta'

function Probe({ title, path }: { title: string | null; path: string }) {
  usePageMeta(title, 'Desc here', path)
  return null
}

it('sets title, description and canonical', () => {
  document.head.innerHTML = '<meta name="description" content=""><meta property="og:title" content=""><meta property="og:description" content=""><meta property="og:url" content=""><link rel="canonical" href="">'
  render(<Probe title="Game | X" path="/play/x" />)
  expect(document.title).toBe('Game | X')
  expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Desc here')
  expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/play\/x$/)
})
afterEach(() => { document.head.innerHTML = '' })
