import { Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { getAvatar, DEFAULT_AVATAR, storedAvatar } from '../lib/avatars'
import { RANKED_GAMES, nickName, randomNick, type Board, type Nick } from '../lib/leaderboard'
import { ONLINE_GAME_LIST, fetchBoard, getNick, leaveLeaderboards, setNick } from '../lib/online'

type Period = 'week' | 'all'

export function Leaderboard() {
  const [period, setPeriod] = useState<Period>('week')
  const [game, setGame] = useState<string>('all')
  const [board, setBoard] = useState<Board | null | 'loading'>('loading')
  const [mine, setMine] = useState<Nick | null>(() => getNick())
  const [suggestion, setSuggestion] = useState<Nick>(() => randomNick())
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let current = true
    setBoard('loading')
    void fetchBoard(game, period).then((b) => current && setBoard(b))
    return () => {
      current = false
    }
  }, [game, period])

  const join = () => {
    setNick(suggestion)
    setMine(suggestion)
    setNotice(`You are on the leaderboards as ${nickName(suggestion)}. Win an online game to get ranked.`)
  }
  const leave = async () => {
    const ok = await leaveLeaderboards()
    if (ok) {
      setMine(null)
      setNotice('Done. Your nickname and every win recorded for it were deleted from the server.')
    } else setNotice('Could not reach the server, so nothing was deleted. Try again in a moment.')
  }
  const myName = mine ? nickName(mine) : null

  return (
    <main className="lb">
      <p className="eyebrow">Online wins</p>
      <h1>
        <Trophy size={30} /> Leaderboards
      </h1>
      <p className="text-white/70">
        Ranked by wins in online rooms. Only results the server itself saw count, so scores cannot be faked. Single-player scores are not ranked.
      </p>

      <div className="lb-controls">
        <div role="group" aria-label="Period" className="lb-tabs">
          <button type="button" aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>
            This week
          </button>
          <button type="button" aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>
            All time
          </button>
        </div>
        <label>
          Game
          <select aria-label="Game" value={game} onChange={(e) => setGame(e.target.value)}>
            <option value="all">All games</option>
            {ONLINE_GAME_LIST.filter((g) => (RANKED_GAMES as readonly string[]).includes(g.id)).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {board === 'loading' ? (
        <p role="status" className="text-white/55">
          Loading…
        </p>
      ) : board === null ? (
        <p role="status" className="text-white/70">
          The leaderboard is not available right now. Everything else still works.
        </p>
      ) : board.rows.length === 0 ? (
        <p role="status" className="text-white/70">
          No wins here yet. Join below, then win an online game with a friend to be the first.
        </p>
      ) : (
        <ol className="lb-list" aria-label="Top players">
          {board.rows.map((r) => (
            <li key={`${r.rank}-${r.name}`} data-me={r.name === myName ? 'true' : undefined}>
              <span className="lb-rank">{r.rank}</span>
              <span className="lb-name">
                {r.name}
                {r.name === myName ? ' (you)' : ''}
              </span>
              <strong>{r.wins}</strong>
            </li>
          ))}
        </ol>
      )}

      <section className="lb-join" aria-label="Your nickname">
        {mine ? (
          <>
            <div className="pp-head">
              <Avatar avatar={getAvatar(storedAvatar()) ?? getAvatar(DEFAULT_AVATAR)!} size={48} />
              <h2>You are {myName}</h2>
            </div>
            <p>Your online wins are ranked under this nickname.</p>
            <button type="button" className="secondary-btn" onClick={() => void leave()}>
              Leave the leaderboards
            </button>
          </>
        ) : (
          <>
            <h2>Join with a nickname</h2>
            <p>
              Nicknames come from a word list, so there is nothing to type and nothing to moderate. Until you join, none of your wins are recorded.
            </p>
            <p className="lb-suggest" aria-live="polite">
              <strong>{nickName(suggestion)}</strong>
            </p>
            <div className="lb-actions">
              <button type="button" className="secondary-btn" onClick={() => setSuggestion(randomNick())}>
                Another one
              </button>
              <button type="button" className="primary-btn" onClick={join}>
                Join the leaderboards
              </button>
            </div>
          </>
        )}
        <p role="status" className="lb-notice">
          {notice}
        </p>
        <p className="text-white/55">
          What the server keeps: a one-way hash of your anonymous player id (not the id itself), your three nickname words, and your win counts. Leaving deletes all of it. Two people sharing wins can still inflate each other, so treat this as a fun board, not a tournament. At most 3 wins a day count against the same opponent.
        </p>
        <p className="text-white/55">
          Want to play? <Link to="/online">Make an online room</Link>.
        </p>
      </section>
    </main>
  )
}
