import { Flame, Lock, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { games } from '../data/games'
import { ShareButton } from '../components/ShareButton'
import { parseBackup } from '../lib/backup'
import { db, exportAll, importBackup } from '../lib/db'
import { THEMES, applyTheme, isUnlocked, resolveTheme, storedTheme, type ThemeId } from '../lib/themes'
import { ACHIEVEMENTS, dailyChallenge, levelFor, recordsByGame, sharePassport, summarise, today, weeklyGoals, WEEKLY_BONUS_XP } from '../lib/passport'
import type { PlayRecord } from '../types'

const title = (id: string) => games.find((g) => g.id === id)?.title ?? id
const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`

export function Passport() {
  const [history, setHistory] = useState<PlayRecord[] | null>(null)
  const [message, setMessage] = useState('')
  const [theme, setTheme] = useState<ThemeId>(() => storedTheme() ?? 'neon')
  const fileInput = useRef<HTMLInputElement>(null)
  const load = () => db.history.toArray().then(setHistory)
  useEffect(() => {
    void load()
  }, [])

  const download = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `govibearcadia-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Backup saved. Keep it somewhere safe; it contains your scores and history only.')
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) return setMessage(`Import failed: ${parsed.error} Nothing was changed.`)
    const added = await importBackup(parsed.backup)
    await load()
    setMessage(added ? `Imported ${added} new ${added === 1 ? 'run' : 'runs'}. Your existing progress was kept.` : 'Nothing new to import: everything in that file is already here.')
  }

  if (!history) return <main className="passport"><p className="game-help">Loading your passport…</p></main>

  const day = today()
  const s = summarise(history, day)
  const lvl = levelFor(s.xp)
  const records = recordsByGame(history)
  const challenge = dailyChallenge(day, games.filter((g) => g.daily).map((g) => g.id))
  const weekly = weeklyGoals(history, day)
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

      <section className="pp-weekly" aria-label="Weekly goals">
        <h2>This week</h2>
        <p className="text-white/55">
          {weekly.complete ? `All goals done. +${WEEKLY_BONUS_XP} XP earned this week.` : `Finish all three for +${WEEKLY_BONUS_XP} XP. Weeks run Monday to Sunday (UTC).`}
        </p>
        <ul>
          {weekly.goals.map((g) => (
            <li key={g.id} data-id={g.id} className={g.done ? 'done' : ''}>
              <span>
                {g.title}
                <small>
                  {g.progress} / {g.target}
                </small>
              </span>
              <div className="xp-bar" role="progressbar" aria-label={g.title} aria-valuemin={0} aria-valuemax={g.target} aria-valuenow={g.progress}>
                <span style={{ width: `${(g.progress / g.target) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
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

      <ShareButton text={sharePassport(s)} label="Share my passport" />

      <h2>Themes</h2>
      <div className="pp-themes" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const open = isUnlocked(t.id, lvl.level)
          const active = resolveTheme(theme, lvl.level) === t.id
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={active}
              disabled={!open}
              data-theme-option={t.id}
              className={active ? 'on' : ''}
              onClick={() => {
                applyTheme(t.id)
                setTheme(t.id)
              }}
            >
              <strong>{t.name}</strong>
              <small>{open ? t.blurb : `Unlocks at level ${t.level}`}</small>
            </button>
          )
        })}
      </div>

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
    
      <h2>Back up your progress</h2>
      <p className="text-white/55">Everything lives on this device. Save a backup file to keep it safe or move it to another device. Importing merges; it never overwrites.</p>
      <div className="pp-backup">
        <button className="secondary-btn" onClick={() => void download()}>
          Export progress
        </button>
        <button className="secondary-btn" onClick={() => fileInput.current?.click()}>
          Import progress
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" aria-label="Import file" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <p role="status" className="pp-msg">{message}</p>
    </main>
  )
}
