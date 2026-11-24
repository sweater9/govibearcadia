import { useEffect, useRef, useState } from 'react'
import { CircleHelp, X } from 'lucide-react'
import { GAME_INFO } from '../games/info'
import type { GameMeta } from '../types'

const KEY = 'govibearcadia.help-seen'
const read = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
const remember = (id: string) => {
  try {
    const seen = read()
    if (!seen.includes(id)) localStorage.setItem(KEY, JSON.stringify([...seen, id]))
  } catch {
    /* private mode: the dot simply shows again next time */
  }
}

/**
 * A "How to play" button for the game page header. It opens the game's rules and controls over the game. A small dot
 * marks the button until you have opened it once for that game. It never opens on its own, so it cannot get in the way
 * of a timed game or of testing.
 */
export function HowToPlay({ meta }: { meta: GameMeta }) {
  const info = GAME_INFO[meta.id]
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => read().includes(meta.id))
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setSeen(read().includes(meta.id))
    setOpen(false)
  }, [meta.id])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        openerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const show = () => {
    remember(meta.id)
    setSeen(true)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    openerRef.current?.focus()
  }

  return (
    <>
      <button ref={openerRef} type="button" className="icon-btn how-btn" aria-label={seen ? 'How to play' : 'How to play (new)'} aria-haspopup="dialog" onClick={show}>
        <CircleHelp />
        {!seen ? <span className="how-dot" aria-hidden /> : null}
      </button>
      {open ? (
        <div className="how-backdrop" onClick={close}>
          <div className="how-dialog" role="dialog" aria-modal="true" aria-label={`How to play ${meta.title}`} onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="icon-btn how-close" aria-label="Close" onClick={close}>
              <X />
            </button>
            <h2>How to play {meta.title}</h2>
            <p>{info?.how ?? meta.description}</p>
            {info?.controls ? (
              <p>
                <strong>Controls:</strong> {info.controls}
              </p>
            ) : null}
            <p className="muted">About {meta.estimated}. A controller works too: D-pad to move, A to select, B to go back, Start to pause.</p>
            <button type="button" className="primary-btn" onClick={close}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
