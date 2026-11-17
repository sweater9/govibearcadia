import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareButton } from './ShareButton'

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
})

describe('ShareButton', () => {
  it('without a share sheet it copies and links to WhatsApp, Telegram, X and Facebook', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ShareButton text="I scored 5 https://x.test/play/a" />)
    const wa = screen.getByRole('link', { name: 'WhatsApp' })
    expect(wa.getAttribute('href')).toBe('https://wa.me/?text=' + encodeURIComponent('I scored 5 https://x.test/play/a'))
    expect(wa.getAttribute('rel')).toContain('noopener')
    for (const n of ['Telegram', 'X', 'Facebook']) expect(screen.getByRole('link', { name: n })).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('button').textContent).toContain('Copied'))
    expect(writeText).toHaveBeenCalledWith('I scored 5 https://x.test/play/a')
  })

  it('with a share sheet it opens that and shows no link list', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { share })
    render(<ShareButton text="hello" />)
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(share).toHaveBeenCalledWith({ text: 'hello' }))
  })
})
