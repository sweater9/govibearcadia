import { DurableObject } from 'cloudflare:workers'
import { MAX_WINS_PER_PAIR_PER_DAY, TOP_N, isNick, isRankedGame, nickName, type BoardRow, type Nick } from '../src/lib/leaderboard'

type Env = object
const HASH = /^[0-9a-f]{64}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

export type WinInput = { game: string; week: string; day: string; winner: string; loser: string; nick: Nick }
export type WinResult = 'counted' | 'capped' | 'invalid'

/**
 * The leaderboard store: one global instance holding win counts in its own SQLite database.
 * It only ever sees SHA-256 hashes of player tokens plus three word-list indices as a nickname, never the token
 * itself and never free text. See docs/PHASE3_PLAN.md, slice 3.6.
 */
export class Leaderboard extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const sql = ctx.storage.sql
      sql.exec(`CREATE TABLE IF NOT EXISTS wins (
        player TEXT NOT NULL, game TEXT NOT NULL, week TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (player, game, week)
      )`)
      sql.exec(`CREATE TABLE IF NOT EXISTS players (
        player TEXT PRIMARY KEY, adjective INTEGER NOT NULL, noun INTEGER NOT NULL, number INTEGER NOT NULL
      )`)
      sql.exec(`CREATE TABLE IF NOT EXISTS pairs (
        winner TEXT NOT NULL, loser TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (winner, loser, day)
      )`)
    })
  }

  /** How much is stored. Used by `/api/leaderboard/status`. */
  status(): { ok: true; players: number; rows: number } {
    const one = (q: string) => (this.ctx.storage.sql.exec(q).one() as { n: number }).n
    return { ok: true, players: one('SELECT COUNT(*) AS n FROM players'), rows: one('SELECT COUNT(*) AS n FROM wins') }
  }

  /** Counts one online win, unless the same pair has already played too many counted games today. */
  recordWin(input: WinInput): WinResult {
    const { game, week, day, winner, loser, nick } = input
    if (!isRankedGame(game) || !isNick(nick) || !HASH.test(winner) || !HASH.test(loser) || winner === loser || !DAY.test(week) || !DAY.test(day)) return 'invalid'
    const sql = this.ctx.storage.sql
    return this.ctx.storage.transactionSync((): WinResult => {
      const seen = sql.exec('SELECT count FROM pairs WHERE winner = ? AND loser = ? AND day = ?', winner, loser, day).toArray() as { count: number }[]
      if ((seen[0]?.count ?? 0) >= MAX_WINS_PER_PAIR_PER_DAY) return 'capped'
      sql.exec('DELETE FROM pairs WHERE day < ?', day) // only today's counts matter
      sql.exec('INSERT INTO pairs (winner, loser, day, count) VALUES (?, ?, ?, 1) ON CONFLICT (winner, loser, day) DO UPDATE SET count = count + 1', winner, loser, day)
      sql.exec('INSERT INTO players (player, adjective, noun, number) VALUES (?, ?, ?, ?) ON CONFLICT (player) DO UPDATE SET adjective = excluded.adjective, noun = excluded.noun, number = excluded.number', winner, nick.a, nick.n, nick.k)
      sql.exec('INSERT INTO wins (player, game, week, count) VALUES (?, ?, ?, 1) ON CONFLICT (player, game, week) DO UPDATE SET count = count + 1', winner, game, week)
      return 'counted'
    })
  }

  /** The top players for one game (or all), this week or all time. */
  top(game: string, period: 'week' | 'all', week: string): BoardRow[] {
    if (game !== 'all' && !isRankedGame(game)) return []
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT p.adjective AS a, p.noun AS n, p.number AS k, SUM(w.count) AS wins
           FROM wins w JOIN players p ON p.player = w.player
          WHERE (? = 'all' OR w.game = ?) AND (? = 'all' OR w.week = ?)
          GROUP BY w.player ORDER BY wins DESC, w.player ASC LIMIT ?`,
        game, game, period, week, TOP_N,
      )
      .toArray() as { a: number; n: number; k: number; wins: number }[]
    return rows.map((r, i) => ({ rank: i + 1, name: nickName({ a: r.a, n: r.n, k: r.k }), wins: r.wins }))
  }

  /** Deletes everything stored about one player. */
  forget(player: string): number {
    if (!HASH.test(player)) return 0
    const sql = this.ctx.storage.sql
    return this.ctx.storage.transactionSync(() => {
      const w = sql.exec('DELETE FROM wins WHERE player = ?', player).rowsWritten
      const p = sql.exec('DELETE FROM players WHERE player = ?', player).rowsWritten
      const q = sql.exec('DELETE FROM pairs WHERE winner = ? OR loser = ?', player, player).rowsWritten
      return w + p + q
    })
  }
}
