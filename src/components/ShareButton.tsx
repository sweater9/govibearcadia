import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'

/** Copies a plain-text result. If the clipboard is unavailable, the text is shown so it can be copied by hand. */
export function ShareButton({ text, label = 'Share result' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('manual')
    }
  }
  return (
    <span className="share">
      <button className="secondary-btn" onClick={copy}>
        {state === 'copied' ? <Check size={16} /> : <Share2 size={16} />} {state === 'copied' ? 'Copied' : label}
      </button>
      {state === 'manual' ? <input readOnly aria-label="Result text" value={text} onFocus={(e) => e.currentTarget.select()} /> : null}
    </span>
  )
}
