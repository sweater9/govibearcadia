import { DurableObject } from 'cloudflare:workers'

type Env = object

/**
 * The leaderboard store: one global instance holding win counts in its own SQLite database.
 * This first version only creates the schema and reports its status, so the Durable Object migration can be
 * deployed and checked on its own before any feature depends on it (see docs/PHASE3_PLAN.md, slice 3.6).
 */
export class Leaderboard extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS wins (
        player TEXT NOT NULL,
        game TEXT NOT NULL,
        week TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (player, game, week)
      )`)
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS players (
        player TEXT PRIMARY KEY,
        adjective INTEGER NOT NULL,
        noun INTEGER NOT NULL,
        number INTEGER NOT NULL
      )`)
    })
  }

  /** How much is stored. Used by `/api/leaderboard/status`. */
  status(): { ok: true; players: number; rows: number } {
    const one = (q: string) => (this.ctx.storage.sql.exec(q).one() as { n: number }).n
    return { ok: true, players: one('SELECT COUNT(*) AS n FROM players'), rows: one('SELECT COUNT(*) AS n FROM wins') }
  }
}
