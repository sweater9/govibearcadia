# Blackjack

Single-player blackjack against the dealer with **play-money chips that have no real value**. Pure rules in `src/games/blackjack/rules.ts`; a saved session is its seed plus action list, replayed on load.

Rules as built: six decks, reshuffled from a fresh seeded shoe when it runs low; dealer stands on all 17s and peeks for blackjack; blackjack pays 3:2; double on any first two cards; split a pair once (split aces take one card; 21 after a split is not blackjack); no insurance or surrender. Start with 1,000 chips, bets 10 to 500 in steps of 5. The session ends when you cash out or cannot cover the minimum bet; the final chip count is the score and ending above 1,000 counts as a win. A Hint button shows basic strategy.

Not built: insurance, surrender, side bets, multiple seats, online play. No real money, deposits or prizes, ever.
