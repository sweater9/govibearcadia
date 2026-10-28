import { Flame, Lock, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { games } from '../data/games'
import { db } from '../lib/db'
import { ACHIEVEMENTS, dailyChallenge, levelFor, recordsByGame, summarise, today } from '../lib/passport'
import type { PlayRecord } from '../types'

const title = (id: string) => games.find((g) => g.id === id)?.title ?? id
const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`

export function Passport() {
  const [history, setHistory] = useState<PlayRecord[] | null>(null)
  useEffect(() => {
    void db.history.toArray().then(setHistory)
  }, [])

  if (!history) return <main className="passport"><p className="game-help">Loading your passport…</p></main>

  const day = today()
  const s = summarise(history, day)
  const lvl = levelFor(s.xp)
  const records = recordsByGame(history)
  const challenge = dailyChallenge(day, games.filter((g) => g.daily).map((g) => g.id))
  const doneToday = history.some((r) => r.won && r.daily === day)

  return (
    <main className="passport">
      <p className="eyebrow">Arcadia Passport</p>
      <h1>Level {lvl.level}</h1>
      <div className="xp-bar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={lvl.span} aria-valuenow={lvl.into}>
        <span style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
      </div>
      <p className="xp-text">
        {lvl.into} / {lvl.span} XP to level {lvl.level + 1} · {s.xp} XP total
      </p>

      <section className="pp-stats" aria-label="Stats">
        <div><strong>{s.plays}</strong><small>Runs</small></div>
        <div><strong>{s.wins}</strong><small>Wins</small></div>
        <div><strong>{s.gamesPlayed}</strong><small>Games tried</small></div>
        <div><strong><Flame size={16} /> {s.streak.current}</strong><small>Day streak (best {s.streak.best})</small></div>
      </section>

      <section className="daily-card pp-daily" aria-label="Today's challenge">
        <div>
          <p className="eyebrow">Today's challenge</p>
          <h2>{title(challenge.gameId)}</h2>
          <p>{doneToday ? 'Done. Come back tomorrow to keep your streak.' : 'Win it to extend your streak and earn +50 XP.'}</p>
        </div>
        {doneToday ? null : (
          <Link className="primary-btn" to={`/play/${challenge.gameId}?seed=${challenge.seed}&daily=${challenge.day}`}>
            Play
          </Link>
        )}
      </section>

      <h2>Achievements</h2>
      <ul className="pp-ach">
        {ACHIEVEMENTS.map((a) => {
          const got = a.earned(s)
          return (
            <li key={a.id} className={got ? 'got' : ''} data-id={a.id}>
              {got ? <Trophy size={18} /> : <Lock size={18} />}
              <div>
                <strong>{a.title}</strong>
                <small>{a.description}</small>
              </div>
              <span className="sr-only">{got ? 'Earned' : 'Locked'}</span>
            </li>
          )
        })}
      </ul>

      <h2>Personal records</h2>
      {records.length ? (
        <table className="pp-records">
          <thead>
            <tr><th>Game</th><th>Runs</th><th>Wins</th><th>Best score</th><th>Fastest win</th></tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.gameId}>
                <td>{title(r.gameId)}</td>
                <td>{r.plays}</td>
                <td>{r.wins}</td>
                <td>{r.bestScore.toLocaleString()}</td>
                <td>{r.bestTimeMs ? seconds(r.bestTimeMs) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-white/55">Play a game and your records will show up here. Everything stays on this device.</p>
      )}
    </main>
  )
}
