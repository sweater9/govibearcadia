# Indian Rummy

13-card Indian Rummy against 1 to 3 computer players, on this device. Pure rules in `src/games/rummy/rules.ts`; the computer in `bot.ts` is deterministic, so a saved game (seed + action list) replays exactly.

Rules as built: two 52-card decks plus two printed jokers (106 cards); 13 cards each; one card is turned up as the wild joker rank (a turned-up printed joker makes aces wild) and the next starts the discard pile. Draw from the stock or the top discard, then discard (you cannot throw back the card you just took from the discard pile). Declare with a pure sequence, at least one more sequence, and every other card in a sequence or set; the declaring discard is not counted. An invalid declaration is refused (the button explains why), so there is no wrong-show penalty. Rivals score loose cards (A, K, Q, J = 10, other cards face value, jokers and wild-rank cards 0), capped at 80; with no pure sequence plus a second sequence every card counts. The stock is reshuffled from the discards when it runs out. A game ends by turn limit (45 turns per player) with the lowest score winning.

Not built: points-rummy tables with money, deals/pool rummy, drop/first-drop, online play. No real-money features, ever.

## Pool play

The game is a pool: deals are played one after another and each player's points add up. The winner of a deal scores 0; everyone else scores their loose cards (A, K, Q, J = 10, jokers 0, capped at 80, or every card when there is no pure sequence plus a second sequence). A player whose total reaches the pool limit (300 by default; 100 and 200 are offered for shorter games) is out of the pool and no longer dealt in. The pool ends when one player is left under the limit or when you are out, and the player with the fewest points wins it. The player to move rotates each deal. Pure rules in `rummy/pool.ts`; a save stores every deal's actions and replays them, and an older single-deal save loads as the first deal. The result is reported once, when the pool ends. Your own drawn card is named in the status line and marked NEW in the hand until you discard.
