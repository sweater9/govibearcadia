import { describe, expect, it } from 'vitest'
import { BANKROLL_START, SHOP, balance, canBuy, coinsEarned, coinsFor, spentOn, stakeFor } from './wallet'

describe('wallet', () => {
  it('pays for playing, winning and winning the daily', () => {
    expect(coinsFor({})).toBe(5)
    expect(coinsFor({ won: true })).toBe(20)
    expect(coinsFor({ won: true, daily: '2026-11-11' })).toBe(70)
    expect(coinsFor({ won: false, daily: '2026-11-11' })).toBe(5)
    expect(coinsEarned([{ won: true }, {}, {}])).toBe(30)
  })
  it('balance is earnings minus what was bought and never negative', () => {
    const history = Array.from({ length: 40 }, () => ({ won: true })) // 800 coins
    expect(balance(history, [])).toBe(800)
    expect(balance(history, ['slate', 'rose'])).toBe(800 - 400)
    expect(balance([], ['gold'])).toBe(0)
    expect(spentOn(['royal', 'unknown'])).toBe(400)
  })
  it('can only buy an unowned item you can afford', () => {
    expect(canBuy('slate', 150, [])).toBe(true)
    expect(canBuy('slate', 149, [])).toBe(false)
    expect(canBuy('slate', 999, ['slate'])).toBe(false)
    expect(canBuy('nope', 999, [])).toBe(false)
    expect(SHOP.every((i) => i.price > 0)).toBe(true)
  })
  it('the blackjack stake carries over and restakes a broke player', () => {
    expect(stakeFor(undefined)).toBe(BANKROLL_START)
    expect(stakeFor(2400)).toBe(2400)
    expect(stakeFor(40)).toBe(BANKROLL_START)
    expect(stakeFor(Number.NaN)).toBe(BANKROLL_START)
    expect(stakeFor(5_000_000)).toBe(1_000_000)
  })
})
