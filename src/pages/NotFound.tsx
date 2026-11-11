import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/pageMeta'

/** Shown for any address the arcade does not have. Tells search engines not to index it. */
export function NotFound() {
  usePageMeta('Page not found | GoVibeArcadia', 'This page does not exist.', '/')
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
  return (
    <main className="info-page">
      <p className="eyebrow">Error 404</p>
      <h1>That page is not in the arcade</h1>
      <p>The address may be mistyped, or the game may have moved. Your scores and progress are safe on this device.</p>
      <p>
        <Link className="primary-btn" to="/">Back to all games</Link>
      </p>
    </main>
  )
}
