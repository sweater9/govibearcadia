import { Link } from 'react-router-dom'
import type { GameMeta } from '../types'
import { Thumbnail } from './Thumbnail'

/** A horizontally scrolling shelf of compact game tiles. */
export function GameRow({ title, blurb, games }: { title: string; blurb: string; games: readonly GameMeta[] }) {
  if (!games.length) return null
  return (
    <section className="row" aria-label={title}>
      <header className="row-head">
        <h2>{title}</h2>
        <p>{blurb}</p>
      </header>
      <ul className="row-track">
        {games.map((g) => (
          <li key={g.id}>
            <Link className="row-tile" to={`/play/${g.id}`} data-category={g.category}>
              <span className="row-art"><Thumbnail id={g.id} /></span>
              <strong>{g.title}</strong>
              <small>{g.category} · {g.estimated}</small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
