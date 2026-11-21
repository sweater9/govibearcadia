# Crazy Eights

Status (2026-11-21): **built, draft PR, not deployed.** Tested with unit, component and browser tests; not yet played by a person.

## Rules as implemented

Standard 52-card deck, two to four players. Rules live in `src/games/crazyeights/rules.ts` (pure TypeScript, no React or browser APIs), so a server could reuse them later to validate moves; **online play is not built.**

- Seven cards each for two players, five each for three or four. The next card of the stock starts the discard pile. If it is an eight it is buried at the bottom of the stock and another is turned up.
- Play a card that matches the top card by **suit or rank**. An **eight is wild**: it can always be played, and you name the suit the next player must match.
- If you cannot play you **must draw**, and you may not draw when you can play. When the stock runs out, the discard pile except its top card is shuffled to make a new stock. If nothing is left to draw and you cannot play, you pass; if every player passes in turn the round is **blocked** and goes to the player with the fewest points in hand.
- The first player to empty their hand wins the round and scores the points left in the other hands. A match is played over rounds to **50, 100 or 200** points. The first player rotates each round.
- Card points: eight 50; king, queen, jack, ten 10; ace 1; every other card its face value.

**No UNO rules.** There are no skip, reverse, draw-two or wild-draw-four cards; the base game has none.

### Optional house rules (chosen when you start a game, off by default)

| Rule | Effect |
|---|---|
| Draw one card, then pass if stuck | Instead of drawing until you can play, you draw a single card; if it cannot be played your turn ends. |
| You cannot go out with an eight | An eight that is your last card cannot be played; you must draw instead. |

## Play modes

- **Against the computer:** you are seat 1; the other seats are the computer players (Ada, Zara, Mei, Sophia, Ananya), always labelled "(computer)".
- **Pass and play:** choose how many humans share the device. Each turn the hand is hidden behind a "Show Player N's hand" button so the next player does not see it. Matches with more than one human are not scored for the arcade (no personal best or history row).
- The match result (your points, whether you won, rounds won) is reported once at the end of a one-human match.

## Computer levels

- **Beginner:** a random legal move; names a random suit with an eight.
- **Normal:** plays its highest-point legal ordinary card; plays an eight only when nothing else is legal, naming the suit it holds most of.
- **Advanced:** scores every legal play. It dumps heavy cards, builds towards a suit it is long in, prefers a suit the next player seems to lack (it remembers who drew while a suit was wanted, which is public), keeps eights in reserve, and uses one to go out or when an opponent is about to.

## Controls and features

Click or tap a card, or press 1 to 9 (0 for the tenth). **D** draws, **P** or Escape pauses, and when you play an eight you pick a suit with the buttons or **S, H, D, C**. New game (choose players, humans, level, target, house rules), Restart and Pause are always in the toolbar. The scoreboard shows every player, with the current turn highlighted, and "Rounds" opens the match history. Cards deal in with a short animation and the played card drops onto the pile; the **Animations** switch (remembered on the device, and off by default when the device asks for reduced motion) turns that off. Sound effects use the arcade's optional sound setting.

## Verified

- `src/games/crazyeights/rules.test.ts`: dealing, legal plays, eights, both house rules, drawing, reshuffling, a blocked round, scoring, matches, and simulated whole rounds for every computer level with two to four players and both draw rules (every move legal, no card ever lost, every round ends). The Advanced computer beats the Beginner over 120 seeded two-player rounds.
- `src/games/CrazyEights.test.tsx`: StrictMode; a whole match reports exactly once; pause stops the computer; pass and play hides the hand.
- `e2e/crazy-eights.spec.ts` (desktop and phone): a whole match with real clicks saved once to history; the keys; four players with two humans. The game is in the layout test, so its table fits on screen at laptop heights and on a phone.

## Not verified

- Not played by a person; the computer levels have not been tuned by hand.
- Sound effects and animations have not been checked by eye or ear on real devices.
- Pass and play was checked for hiding the hand, not on a real shared screen.
- Online play is not built; no server code exists for this game.
