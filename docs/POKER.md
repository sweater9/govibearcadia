# Poker

Texas Hold'em tournament (sit-and-go) against 1 to 4 computer players on this device, with **play-money chips that have no real value**. Pure rules in `src/games/poker/rules.ts` (hand ranking, betting rounds, side pots); the computer in `bot.ts` is deterministic, seeded from the hand and action count, so a saved tournament (seed + action list) replays exactly.

Rules as built: everyone starts with 1,000 chips; blinds 10/20 and rise every 8 hands (up to 300/600); no-limit betting with a minimum raise equal to the last raise; short all-ins and side pots; ties split with the odd chip going to the first seat after the button; heads-up, the button posts the small blind and acts first. You are out when you have no chips; the last player with chips wins. Score is 1,000 for winning the tournament, otherwise 20 per hand survived (up to 500).

Known simplifications: a short all-in raise lets players who already acted raise again; no antes, straddles, rebuys or time bank. The computer is a simple strength-and-pot-odds player, not a solver.

Not built: online multiplayer, cash games. No real money, deposits, prizes or purchases, ever.
