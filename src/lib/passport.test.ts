import { describe, expect, it } from 'vitest'
import type { PlayRecord } from '../types'
import { ACHIEVEMENTS, completedWeeks, weekStart, weeklyGoals, WEEKLY_BONUS_XP, sharePassport, shareDaily, dailyChallenge, earnedAchievements, levelFor, recordsByGame, streaks, summarise, xpFor, xpToReach } from './passport'

const run = (gameId: string, extra: Partial<PlayRecord> = {}): PlayRecord => ({ gameId, score: 100, playedAt: '2026-10-28T10:00:00.000Z', ...extra })

describe('XP and levels', () => {
  it('awards 10 for playing, 25 for a win, 75 for a daily win', () => {
    expect(xpFor({})).toBe(10)
    expect(xpFor({ won: true })).toBe(25)
    expect(xpFor({ won: true, daily: '2026-10-28' })).toBe(75)
    expect(xpFor({ won: false, daily: '2026-10-28' })).toBe(10) // a lost daily earns no bonus
  })

  it('thresholds grow by 100 per level and levelFor inverts them', () => {
    expect([1, 2, 3, 4, 5].map(xpToReach)).toEqual([0, 100, 300, 600, 1000])
    expect(levelFor(0)).toMatchObject({ level: 1, into: 0, span: 100 })
    expect(levelFor(99).level).toBe(1)
    expect(levelFor(100)).toMatchObject({ level: 2, into: 0, span: 200 })
    expect(levelFor(1000).level).toBe(5)
    expect(levelFor(1234)).toMatchObject({ level: 5, into: 234, span: 500 })
  })
})

describe('daily challenge', () => {
  const ids = ['b-game', 'a-game', 'c-game', 'd-game']
  it('is the same for everyone on a day, independent of list order, and uses the date as seed', () => {
    const a = dailyChallenge('2026-10-28', ids)
    expect(a).toEqual(dailyChallenge('2026-10-28', [...ids].reverse()))
    expect(a.seed).toBe('2026-10-28')
    expect(ids).toContain(a.gameId)
  })

  it('rotates through the games over time', () => {
    const picks = new Set(Array.from({ length: 40 }, (_, i) => dailyChallenge(`2026-11-${String((i % 28) + 1).padStart(2, '0')}`, ids).gameId))
    expect(picks.size).toBe(ids.length)
  })
})

describe('streaks', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(streaks(['2026-10-26', '2026-10-27', '2026-10-28'], '2026-10-28')).toEqual({ current: 3, best: 3 })
    expect(streaks(['2026-10-26', '2026-10-27'], '2026-10-28')).toEqual({ current: 2, best: 2 }) // today not played yet
    expect(streaks(['2026-10-25', '2026-10-26'], '2026-10-28')).toEqual({ current: 0, best: 2 }) // a day was missed
  })

  it('remembers the best run and handles month and year boundaries', () => {
    expect(streaks(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-05'], '2027-01-05')).toEqual({ current: 1, best: 3 })
    expect(streaks([], '2026-10-28')).toEqual({ current: 0, best: 0 })
    expect(streaks(['2026-10-28', '2026-10-28'], '2026-10-28').current).toBe(1)
  })
})

describe('summary and achievements', () => {
  it('starts at zero with nothing earned', () => {
    const s = summarise([], '2026-10-28')
    expect(s).toMatchObject({ plays: 0, wins: 0, xp: 0, level: 1 })
    expect(earnedAchievements(s)).toEqual([])
  })

  it('adds up XP, wins, distinct games and daily wins', () => {
    const history = [run('a', { won: true, daily: '2026-10-27' }), run('b'), run('b', { won: true }), run('c', { won: true, daily: '2026-10-28' })]
    const s = summarise(history, '2026-10-28')
    expect(s).toMatchObject({ plays: 4, wins: 3, gamesPlayed: 3, dailyWins: 2, xp: 75 + 10 + 25 + 75, streak: { current: 2, best: 2 } })
    expect(earnedAchievements(s).map((a) => a.id)).toEqual(['first-play', 'first-win', 'daily-first'])
  })

  it('unlocks streak and volume achievements at their thresholds', () => {
    const days = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']
    const history = days.map((d, i) => run(`g${i}`, { won: true, daily: d }))
    const ids = earnedAchievements(summarise(history, '2026-10-28')).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['streak-3', 'streak-7', 'five-games']))
    expect(ids).not.toContain('ten-plays')
  })

  it('has unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
})

describe('personal records', () => {
  it('keeps the best score and the fastest win per game', () => {
    const rows = recordsByGame([
      run('x', { score: 50, won: true, durationMs: 9000 }),
      run('x', { score: 80, won: true, durationMs: 7000 }),
      run('x', { score: 999, won: false, durationMs: 1000 }), // a loss never sets the best time
      run('y', { score: 5 }),
    ])
    expect(rows).toEqual([
      { gameId: 'x', plays: 3, wins: 2, bestScore: 999, bestTimeMs: 7000 },
      { gameId: 'y', plays: 1, wins: 0, bestScore: 5 },
    ])
  })
})

describe('sharing', () => {
  it('daily text has only the game, day, score and time', () => {
    expect(shareDaily('Twofold', '2026-10-28', 1234, 41_400)).toBe('GoVibeArcadia daily 2026-10-28: Twofold, 1,234 points in 41s')
    expect(shareDaily('Carve', '2026-10-28', 90)).toBe('GoVibeArcadia daily 2026-10-28: Carve, 90 points')
  })
  it('passport text shows level, XP, streak and achievements', () => {
    const s = summarise([run('a', { won: true, daily: '2026-10-28' })], '2026-10-28')
    expect(sharePassport(s)).toBe('GoVibeArcadia passport: level 1 · 75 XP · 1-day streak · 3/12 achievements')
    expect(sharePassport(summarise([], '2026-10-28'))).toBe('GoVibeArcadia passport: level 1 · 0 XP · 0/12 achievements')
  })
})

describe('weekly goals', () => {
  // 2026-10-26 is a Monday.
  const at = (day: string, gameId: string, extra: Partial<PlayRecord> = {}): PlayRecord => ({ gameId, score: 1, playedAt: `${day}T09:00:00.000Z`, ...extra })

  it('weeks run Monday to Sunday', () => {
    expect(['2026-10-26', '2026-10-28', '2026-11-01'].map(weekStart)).toEqual(['2026-10-26', '2026-10-26', '2026-10-26'])
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
    expect(weekStart('2027-01-01')).toBe('2026-12-28') // across a year boundary
  })

  it('starts empty and counts only runs inside the week', () => {
    const w = weeklyGoals([at('2026-10-25', 'a', { won: true, daily: '2026-10-25' })], '2026-10-28') // Sunday before
    expect(w.goals.map((g) => g.progress)).toEqual([0, 0, 0])
    expect(w.complete).toBe(false)
  })

  it('tracks daily wins on distinct days, distinct games and run XP', () => {
    const history = [
      at('2026-10-26', 'a', { won: true, daily: '2026-10-26' }),
      at('2026-10-26', 'a', { won: true, daily: '2026-10-26' }), // same daily day counts once
      at('2026-10-27', 'b'),
    ]
    const w = weeklyGoals(history, '2026-10-30')
    expect(w.goals.map((g) => [g.id, g.progress, g.done])).toEqual([['daily', 1, false], ['games', 2, false], ['xp', 160, false]])
  })

  it('three daily wins on three games are not enough without the XP goal', () => {
    const week1 = [
      at('2026-10-26', 'a', { won: true, daily: '2026-10-26' }),
      at('2026-10-27', 'b', { won: true, daily: '2026-10-27' }),
      at('2026-10-28', 'c', { won: true, daily: '2026-10-28' }),
    ]
    const w = weeklyGoals(week1, '2026-10-28')
    expect(w.goals.map((g) => g.done)).toEqual([true, true, false])
    expect(w.goals[2].progress).toBe(225)
    expect(w.complete).toBe(false)
    expect(completedWeeks(week1)).toBe(0)
  })

  it('needs the XP goal too, then adds the bonus to total XP and unlocks achievements', () => {
    const week = [
      at('2026-10-26', 'a', { won: true, daily: '2026-10-26' }),
      at('2026-10-27', 'b', { won: true, daily: '2026-10-27' }),
      at('2026-10-28', 'c', { won: true, daily: '2026-10-28' }),
      at('2026-10-29', 'c'),
      at('2026-10-29', 'c'),
      at('2026-10-29', 'c'),
      at('2026-10-29', 'c'),
      at('2026-10-29', 'c'),
      at('2026-10-29', 'c'),
      at('2026-10-29', 'c'),
    ]
    const runXp = week.reduce((n, r) => n + xpFor(r), 0)
    expect(runXp).toBe(295)
    expect(weeklyGoals(week, '2026-10-29').complete).toBe(false)
    const done = [...week, at('2026-10-30', 'c')]
    expect(weeklyGoals(done, '2026-10-30').complete).toBe(true)
    expect(completedWeeks(done)).toBe(1)
    const s = summarise(done, '2026-10-30')
    expect(s.xp).toBe(305 + WEEKLY_BONUS_XP)
    expect(earnedAchievements(s).map((a) => a.id)).toContain('weekly-1')
    expect(earnedAchievements(s).map((a) => a.id)).not.toContain('weekly-3')
  })

  it('three completed weeks unlock Season Ticket', () => {
    const week = (monday: string) =>
      [0, 1, 2].map((i) => at(shiftDays(monday, i), `g${i}`, { won: true, daily: shiftDays(monday, i) })).concat(Array.from({ length: 8 }, () => at(shiftDays(monday, 3), 'g0')))
    const history = [...week('2026-10-05'), ...week('2026-10-12'), ...week('2026-10-19')]
    expect(completedWeeks(history)).toBe(3)
    expect(earnedAchievements(summarise(history, '2026-10-25')).map((a) => a.id)).toContain('weekly-3')
  })
})

const shiftDays = (day: string, by: number): string => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + by)
  return d.toISOString().slice(0, 10)
}
