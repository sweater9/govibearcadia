import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/pageMeta'
import { SITE_NAME } from '../site'

/** About and privacy: states plainly what the arcade stores and what it sends. */
export function About() {
  usePageMeta(`About and privacy | ${SITE_NAME}`, 'What GoVibeArcadia stores on your device, what it sends to a server, and what it never collects.', '/about')
  return (
    <main className="info-page">
      <p className="eyebrow">About</p>
      <h1>About and privacy</h1>
      <p>{SITE_NAME} is a free, independent browser arcade. There are no ads, no accounts and no analytics or trackers.</p>

      <h2>Kept on your device</h2>
      <p>Scores, play history, favorites, saved games, your theme and avatar live in your browser (IndexedDB and local storage). They never leave your device unless you download a backup from the Passport page. Clearing your browser data removes them.</p>

      <h2>Sent to a server</h2>
      <p>Only the online features use a server: private rooms, and the optional leaderboard. A room shares moves between the two players. The leaderboard stores a word-list nickname you choose and a hash of an anonymous token, never free text, and only when you opt in. Single-player games and pass-the-device play never contact a server, and every font and asset is served from this site.</p>

      <h2>Play money</h2>
      <p>Blackjack and Poker use play chips with no cash value. There is no real-money play, no purchases and no prizes.</p>

      <p><Link to="/">Back to all games</Link></p>
    </main>
  )
}
