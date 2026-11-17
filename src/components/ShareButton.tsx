import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'

/** The first web address in the text, or the site itself, for services that want a separate link. */
const linkIn = (text: string) => text.match(/https?:\/\/\S+/)?.[0] ?? location.origin

/** Share links open in a new tab only when a player clicks them; the app itself makes no request to these sites. */
const shareLinks = (text: string) => {
  const t = encodeURIComponent(text)
  const u = encodeURIComponent(linkIn(text))
  return [
    { name: 'WhatsApp', href: `https://wa.me/?text=${t}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${t}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ]
}

/**
 * Where the phone or browser has a share sheet (which lists WhatsApp, Instagram and the rest), one button opens it.
 * Elsewhere the button copies the text, with links for WhatsApp, Telegram, X and Facebook beside it.
 * If the clipboard is unavailable, the text is shown so it can be copied by hand.
 */
export function ShareButton({ text, label = 'Share result' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const native = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('manual')
    }
  }
  const press = async () => {
    if (!native) return copy()
    try {
      await navigator.share({ text })
    } catch (e) {
      // Closing the share sheet is not an error; anything else falls back to copying.
      if ((e as DOMException)?.name !== 'AbortError') await copy()
    }
  }
  return (
    <span className="share">
      <button className="secondary-btn" onClick={press}>
        {state === 'copied' ? <Check size={16} /> : <Share2 size={16} />} {state === 'copied' ? 'Copied' : label}
      </button>
      {native ? null : (
        <span className="share-links" role="group" aria-label="Share on">
          {shareLinks(text).map((l) => (
            <a key={l.name} className="share-link" href={l.href} target="_blank" rel="noopener noreferrer">
              {l.name}
            </a>
          ))}
          <small className="share-hint">For Instagram, copy this and paste it into a story or message.</small>
        </span>
      )}
      {state === 'manual' ? <input readOnly aria-label="Result text" value={text} onFocus={(e) => e.currentTarget.select()} /> : null}
    </span>
  )
}
