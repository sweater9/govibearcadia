import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import {
  COLS, DROP, EDGE, ENEMY_H, ENEMY_W, FIRE_EVERY, FORM_TOP, INVULN, LIVES, MAX_BULLETS, ROW_POINTS,
  SHIP_W, SHIP_Y, TOTAL, W, WAVES, aliveCount, enemyPos, formSpeed, moveShip, newGame, start, step, type DefenderState,
} from './rules'

const play = (o: Partial<DefenderState> = {}): DefenderState => ({ ...newGame(), status: 'playing', ...o })
const run = (s: DefenderState, seconds: number, dir: -1 | 0 | 1 = 0, seed = 'run') => {
  const random = createRandom(seed)
  for (let t = 0; t < seconds * 120 && s.status === 'playing'; t++) s = step(s, 1 / 120, dir, random)
  return s
}
const noEnemies = () => Array<boolean>(TOTAL).fill(false)

describe('Space Defender rules', () => {
  it('starts ready with a full formation, three lives, wave 1', () => {
    const s = newGame()
    expect(s).toMatchObject({ status: 'ready', wave: 1, lives: LIVES, score: 0 })
    expect(aliveCount(s)).toBe(TOTAL)
    expect(start(s).status).toBe('playing')
    expect(start(start(s)).status).toBe('playing')
    expect(step(s, 1)).toBe(s) // nothing happens until it starts
  })

  it('moves the ship and clamps it to the field, also before the fight starts', () => {
    expect(moveShip(newGame(), -9).shipX).toBe(SHIP_W / 2)
    expect(moveShip(newGame(), 999).shipX).toBe(W - SHIP_W / 2)
    expect(step(newGame(), 0.1, 1).shipX).toBeCloseTo(W / 2 + 26, 5)
  })

  it('the formation marches sideways, then turns and drops at the wall', () => {
    let s = play({ enemyCd: 99 })
    const x0 = s.formX
    s = run(s, 0.5)
    expect(s.formX).toBeGreaterThan(x0)
    expect(s.formDir).toBe(1)
    s = run(s, 4, 0, 'march')
    // After a few seconds it has hit the right wall at least once and come back.
    expect(s.formY).toBeGreaterThanOrEqual(FORM_TOP + DROP)
    const rightmost = enemyPos(s, COLS - 1).x + ENEMY_W
    expect(rightmost).toBeLessThanOrEqual(W - EDGE + 0.001)
  })

  it('turns at the edge of the invaders that are still alive, not the original edge', () => {
    const enemies = noEnemies()
    enemies[0] = true // only the leftmost column is left
    let s = play({ enemies, enemyCd: 99, fireCd: 99 })
    s = run(s, 3, 0, 'edge')
    expect(s.formDir === -1 || s.formY > FORM_TOP).toBe(true)
    expect(enemyPos(s, 0).x).toBeGreaterThanOrEqual(EDGE - 0.001)
    expect(enemyPos(s, 0).x + ENEMY_W).toBeLessThanOrEqual(W - EDGE + 0.001)
  })

  it('speeds up with the wave and as invaders fall', () => {
    expect(formSpeed(1, TOTAL)).toBe(34)
    expect(formSpeed(3, TOTAL)).toBe(50)
    expect(formSpeed(1, 4)).toBeGreaterThan(formSpeed(1, TOTAL))
  })

  it('the ship fires on its own at a steady rate and never has more than the cap in flight', () => {
    let s = play({ enemyCd: 99, formX: 9999 })
    s = step(s, 1 / 60)
    expect(s.bullets).toHaveLength(1)
    s = step(s, 1 / 60)
    expect(s.bullets).toHaveLength(1) // not again until the cooldown passes
    s = run({ ...s, enemies: noEnemies().fill(true, 0, 1), formX: 9999 }, 0.4)
    expect(s.bullets.length).toBeGreaterThanOrEqual(1)
    s = run({ ...s, fireCd: 0 }, FIRE_EVERY * 8)
    expect(s.bullets.length).toBeLessThanOrEqual(MAX_BULLETS)
  })

  it('a bullet destroys the invader it hits, scores that row, and is used up', () => {
    const enemies = noEnemies().fill(true, 0, 2) // two in the top row
    const p = enemyPos(newGame(), 0)
    let s = play({ enemies, enemyCd: 99, fireCd: 99, shipX: 0, bullets: [{ x: p.x + 8, y: p.y + ENEMY_H }] })
    s = step(s, 1 / 60)
    expect(s.enemies[0]).toBe(false)
    expect(s.enemies[1]).toBe(true)
    expect(s.score).toBe(ROW_POINTS[0])
    expect(s.bullets).toHaveLength(0)
  })

  it('lower rows are worth less', () => {
    const enemies = noEnemies().fill(true, 3 * COLS, 3 * COLS + 2)
    enemies[0] = true
    const p = enemyPos(newGame(), 3 * COLS)
    const s = step(play({ enemies, enemyCd: 99, fireCd: 99, bullets: [{ x: p.x + 8, y: p.y + ENEMY_H }] }), 1 / 60)
    expect(s.score).toBe(ROW_POINTS[3])
  })

  it('an invader shot that reaches the ship costs a life and starts a protected window', () => {
    let s = play({ enemyCd: 99, fireCd: 99, shots: [{ x: W / 2 - 2, y: SHIP_Y - 4 }] })
    s = step(s, 1 / 60)
    expect(s.lives).toBe(LIVES - 1)
    expect(s.invuln).toBeGreaterThan(INVULN - 0.05)
    // Another shot during protection does nothing.
    s = step({ ...s, shots: [{ x: W / 2 - 2, y: SHIP_Y - 4 }] }, 1 / 60)
    expect(s.lives).toBe(LIVES - 1)
    // Protection wears off.
    s = step({ ...s, shots: [] }, INVULN + 0.1)
    expect(s.invuln).toBe(0)
  })

  it('a shot that misses the ship falls off the bottom', () => {
    let s = play({ enemyCd: 99, fireCd: 99, shipX: 30, shots: [{ x: 280, y: SHIP_Y }] })
    s = run(s, 1)
    expect(s.shots).toHaveLength(0)
    expect(s.lives).toBe(LIVES)
  })

  it('losing the last life ends the game', () => {
    const s = step(play({ lives: 1, enemyCd: 99, fireCd: 99, shots: [{ x: W / 2 - 2, y: SHIP_Y - 4 }] }), 1 / 60)
    expect(s.status).toBe('lost')
    expect(s.lives).toBe(0)
    expect(step(s, 1)).toBe(s)
  })

  it('invaders reaching the ship line end the game at once', () => {
    const enemies = noEnemies()
    enemies[0] = true
    // Just above the ship's line, at the right wall: the next turn drops the formation onto it.
    const s = step(play({ enemies, formX: W - EDGE - ENEMY_W - 0.1, formY: SHIP_Y - ENEMY_H - 4, enemyCd: 99, fireCd: 99 }), 1 / 30)
    expect(s.status).toBe('lost')
  })

  it('clearing a wave brings a faster one and a bonus; clearing the last wave wins', () => {
    const last = noEnemies()
    last[0] = true
    const p = enemyPos(newGame(), 0)
    const killShot = [{ x: p.x + 8, y: p.y + ENEMY_H }]
    const next = step(play({ enemies: last, enemyCd: 99, fireCd: 99, wave: 1, bullets: killShot }), 1 / 60)
    expect(next.status).toBe('playing')
    expect(next.wave).toBe(2)
    expect(aliveCount(next)).toBe(TOTAL)
    expect(next.score).toBe(ROW_POINTS[0] + 100)
    expect(next.formY).toBe(FORM_TOP)

    const won = step(play({ enemies: last, enemyCd: 99, fireCd: 99, wave: WAVES, lives: 2, bullets: killShot }), 1 / 60)
    expect(won.status).toBe('won')
    expect(won.score).toBe(ROW_POINTS[0] + 100 * WAVES + 200 * 2)
  })

  it('is deterministic for the same seed and input', () => {
    const a = run(play(), 6, 0, 'same')
    const b = run(play(), 6, 0, 'same')
    expect(a).toEqual(b)
    expect(run(play(), 6, 0, 'other').shots).not.toEqual(a.shots)
  })

  it('a ship that never moves is eventually killed (so the game can be lost)', () => {
    const s = run(play(), 400)
    expect(s.status).toBe('lost')
  })

  it('a tracking bot that dodges can clear waves (so winning is reachable)', () => {
    let reached = 0
    for (const seed of ['bot-1', 'bot-2', 'bot-3']) {
      const random = createRandom(seed)
      let s = play()
      for (let t = 0; t < 120 * 400 && s.status === 'playing'; t++) {
        // Aim under the lowest live invader; step aside from the nearest shot coming down.
        let target = s.shipX
        for (let i = TOTAL - 1; i >= 0; i--) {
          if (s.enemies[i]) {
            target = enemyPos(s, i).x + ENEMY_W / 2
            break
          }
        }
        const threat = s.shots.find((b) => Math.abs(b.x - s.shipX) < SHIP_W && b.y > SHIP_Y - 120)
        if (threat) target = threat.x < s.shipX ? s.shipX + 40 : s.shipX - 40
        s = moveShip(s, s.shipX + Math.max(-2.2, Math.min(2.2, target - s.shipX)))
        s = step(s, 1 / 120, 0, random)
      }
      reached = Math.max(reached, s.status === 'won' ? WAVES + 1 : s.wave)
    }
    expect(reached).toBeGreaterThanOrEqual(2)
  })
})
