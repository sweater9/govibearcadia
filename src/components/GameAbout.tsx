import { GAME_INFO } from '../games/info'
import type { GameMeta } from '../types'

/** The part of a game page that explains the game: how to play and the controls. (Similar games are the page's existing "More like this" row.) */
export function GameAbout({ meta }: { meta: GameMeta }) {
  const info = GAME_INFO[meta.id]
  return (
    <section className="game-about" aria-label={`About ${meta.title}`}>
      <h2>How to play {meta.title}</h2>
      {info ? <p>{info.how}</p> : <p>{meta.description}</p>}
      {info?.controls ? (
        <p>
          <strong>Controls:</strong> {info.controls}
        </p>
      ) : null}
      <p className="muted">
        {meta.category} · about {meta.estimated} · free, no ads, no sign-up, and it works offline.
      </p>
    </section>
  )
}
