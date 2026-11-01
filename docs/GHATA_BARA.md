# Ghata Bara

A faithful, local-first adaptation of the traditional four-player board game. Pure rules live in `src/games/ghata/rules.ts` (no React, no randomness: dice values are passed in), the computer player in `bot.ts`, the interface in `src/games/GhataBara.tsx`. Tests: `rules.test.ts` (engine, including seeded full games checked after every action) and `GhataBara.test.tsx` and `e2e/ghata-bara.spec.ts` (interface).

## Built

The 5x5 game for four seats, as specified: 25 squares (16 outer counterclockwise, 8 inner clockwise, Home in the centre), five safe squares, six pawns each, two long dice (1, 2, 3, blank = 6; totals 2 to 9 and 12), Chowka and Baara bonus rolls, the three-strike bust, whole indivisible movement chunks with free allocation and combination, mandatory use (no pass while a chunk has a legal use), outer-ring captures (one or two pawns), capture credit before entering the inner ring, automatic Juga formation, half-speed Juga movement, blockades, pinning with delayed capture, rescue, Juga-versus-Juga capture, Twin-Capture, chain pin-and-capture, exactly one capture bonus per allocation sequence, chained bonus sequences, capture checkpoints, exact Home entry and immediate victory.

Seats are Violet (top), Cyan (left), Amber (bottom), Rose (right). One to four people can play; the computer plays the other seats. A game in progress is saved in this browser only.

## Not built

- The 10x10 variant (the plan says to start with 5x5; its rules are still unconfirmed).
- Online play, spectators, tournaments.
- Choosing which seats are people (two players sit opposite each other; three sit top, left and bottom).

A game is long: computer-only games take about 900 to 1,600 actions. That is the traditional pace of the game; a "short game" option could be added if wanted.

## Answers the owner gave to the open questions (section 20 of the brief)

| Question | Answer |
|---|---|
| Routes and the outer-to-inner transition | Each player starts on the safe square in the middle of their own edge. After a full outer lap (16 steps) a pawn with capture credit steps onto the inner square just inside its own start, then follows the inner ring clockwise through all 8 inner squares, and Home is the next step (24 steps from the start). A pawn without credit keeps circulating. |
| Releasing with several qualifying rolls | One pawn per qualifying roll: each 6 or 12 in the queue can release one pawn. |
| Does Juga formation need credit for both pawns? | No separate check. Only pawns with capture credit can reach the inner ring, so any two same-player pawns meeting there qualify. |
| Is the three-strike counter reset between rolling sequences? | Yes. Every rolling sequence, including a capture-bonus one, counts its own strikes from zero. |

## Choices made where the brief is silent (please confirm or correct)

These are the places where the rules did not say, listed so nothing is silently invented. Each is one small, isolated change if you want it different.

1. **A captured pawn loses its capture credit** and must capture again to reach the inner ring (`RULES.creditSurvivesCapture` in `rules.ts` switches this).
2. **"Once at least one opponent has entered the inner ring"** means: some other player has entered the inner ring at any time in this game. Pairs already waiting on an inner square become Jugas the moment that happens.
3. **A combined movement lands only on its final square.** The squares in between are passed over, and blockades apply to the whole path.
4. **The two-pawn limit also applies on start squares**, so a start square already holding two of your pawns cannot take a released pawn.
5. **A Juga may not land on a square holding one of its own single pawns.** (Friendly individual pawns cannot land on a friendly Juga, and the reverse is treated the same way.)
6. **A rescuing Juga and the pawn it frees share the square**; the rescuer does not repin it (as written), and if the rescuer later moves away nothing is captured.
7. **A capture credits both pawns of a Juga**, including a delayed capture on leaving a pin and a captured Juga.
8. **A Juga needs an exact, even total to enter Home**, and any even total that does not overshoot is a legal movement.
9. **Pinning needs exactly one enemy single pawn** on the square. (A square cannot hold two opposing singles on the inner ring once Jugas exist, so this never arises.)
10. **Scores:** a finished game is reported as won if a person won; the score is 100 per Violet pawn home plus 400 for a win.

## Safe squares

`o0 o4 o8 o12` (the four edge centres, also the four start squares) and the Home square. Captures, pins and blockades do not apply on them. Jugas only ever stand on the inner ring, so in practice the safe-square exceptions matter for individual pawns and for Home.
