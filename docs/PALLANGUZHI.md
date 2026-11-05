# Pallanguzhi / Ali Guli Mane

The Karnataka ruleset of the traditional seed-sowing game: 14 pits, five seeds in each, sowing always counterclockwise. The rules are in `src/games/pallanguzhi/rules.ts` (pure, deterministic, no randomness); the interface is `src/games/Pallanguzhi.tsx`.

## Sources checked

Rules for this game are written down in several places and they do not fully agree. Read for this implementation:

- [Ali Guli Mane, Wikipedia](https://en.wikipedia.org/wiki/Ali_Guli_Mane): board, 70 seeds, relay sowing, Saada, capture of the pit beyond the empty one and the pit opposite it, a second sowing after a capture (two Saadas at most), series of handicapped games with refilling, marked "protected" holes.
- [Ali Guli Mane, Mancala Wiki](https://mancala.fandom.com/wiki/Ali_Guli_Mane): five seeds a pit, anticlockwise, "you must move if you have any pieces to play", capture of the succeeding pit and the pit opposite, extra sowing after a capture, at most two Saadas a turn, the round ends when all pieces have been taken, refill with five per hole, unfillable holes are marked and not used, the match goes on until a player cannot fill even one hole.
- [Pallanguzhi, Wikipedia](https://en.wikipedia.org/wiki/Pallanguzhi): the Tamil Nadu relative; unfillable "rubbish holes" are excluded from play, return to play when the player can pay for them again, the first player of the previous round goes second, the game ends when a player cannot fill any cup.
- [Karnataka pellets page (Pegga)](https://rollthedice.in/pages/how-to-play-channe-mane-or-aliguli-mane): 70 pellets, 5 a pit in Mysore and the coast (4 in north Karnataka, 6 in Tamil Nadu and Andhra), leftover pellets that cannot fill a pit are kept by the player ("Pegga").

Where the sources are silent or disagree, the choice made is below, and each one is a switch in `Config` (`rules.ts`), so a regional version can change it without touching the engine.

## The rules as built

- 14 pits in two rows; Player 1 owns the bottom row, Player 2 the top. Five seeds in each: 70 in all.
- Sowing runs in one fixed direction, counterclockwise (bottom row left to right, top row right to left).
- A turn: lift every seed from one of your non-empty pits and drop them one by one into the following pits, through both rows.
- Relay: after the last seed, if the next pit has seeds, lift them all and carry on in the same way. A pit of 14 or more seeds goes round the board more than once.
- Saada: when the next pit is empty, skip it, take the seeds of the pit just beyond it and of the pit directly opposite that pit. An empty capture pit adds zero.
- A capture earns one more sowing, from any non-empty pit of yours. A turn has at most two sowings. With no capture the turn ends.
- Seeds are never created or lost: seeds in pits plus the two captured-seed trays always equal 70 (`invariantErrors`).

## Choices made where the sources disagree or are silent

| Question | Choice | Switch |
| --- | --- | --- |
| Direction | Counterclockwise, fixed (one source says the player may choose; the brief fixes it) | none |
| Which pit is "opposite"? | The pit opposite the one captured beyond the Saada, as in the Wikipedia example (A3 and B3) and the Mancala Wiki wording | none |
| Does a capture of zero seeds earn the second sowing? | No: a capture must take at least one seed | `zeroCaptureGrantsSecond` |
| Does the first pit lifted get a seed on a later lap of a very long sowing? | Yes, it stays part of the route | none |
| Are inactive (piggy) pits skipped by sowing? | Yes: not part of the route; they hold no seeds | none |
| When does a round end? | When the player to move has no seeds in their row (a sowing never empties the whole board, so this is how "all seeds taken" is reached). Seeds still on the board go to the owner of the row they sit in | `stranded: 'owner-keeps' \| 'pass'` |
| Leftover seeds that cannot fill a pit | Stay in the player's tray and count towards later refills | none |
| Which pits are refilled | Pits that were active first, then previously inactive pits, lowest first; a pit that was piggy returns when the player can pay for it | none |
| Who starts the next round | The player who started the previous round now goes second | none |
| Match end | A player who cannot refill even one pit loses; the other wins. If neither can, the larger tray wins | `match: 'match' \| 'single'` |
| Single-round mode | One round; the larger tray wins (a draw if equal) | `match: 'single'` |
| Seeds per pit | 5 (Mysore, coast); 4 and 6 are the other regional counts | `seedsPerPit` |
| Undo | Interface only (history is not part of the engine); against the computer it goes back to your last move | none |
| Endless relay | A sowing that relays 2000 times stops without a capture (the rules allow it in theory) | `MAX_RELAYS` |

Open: whether traditional players choose which pits to refill (the build chooses by a fixed order), and whether the sources' "ties" differ regionally. Neither could be confirmed from the sources above; they are kept configurable rather than invented.

## Choosing the rules

The **Rules** button (not shown in the tutorial) lets a player choose, before a match: seeds per pit (4, 5 or 6), sowings per turn (1, 2 or 3), whether a Saada that captures nothing still earns the next sowing, what happens when a player has no seeds to sow (round ends and the seeds go to the row's owner, or the player passes), and a full match or a single round. Defaults are the choices in the table above. Changing a rule starts a new match; the rules are locked once a move is made, saved with a match in progress, and remembered for the next one. A match with non-default rules shows "custom rules" beside the round number.

One safeguard: a round with no capture for 100 sowings in a row ends (leftover seeds go to the owners of their rows). Under the "pass" variant a single seed could otherwise circle the board for ever.

## Modes and interface

- Play the computer (Easy, Medium, Hard), two players on one device, and an eight-lesson tutorial played on the real engine.
- Easy chooses any legal pit. Medium takes the biggest immediate capture, counting an earned second sowing. Hard runs a deterministic alpha-beta search five sowings deep, valuing captured seeds, seeds in each row and the match result. All run locally.
- Seeds move a step at a time (Slow, Normal, Fast, Instant); the pit being sowed, the Saada pit and captured pits are highlighted, and captured seeds go to the tray.
- Keys 1 to 7 choose a pit in your row; arrow keys move between pits. High contrast, reduced motion and optional sound are in "Accessibility and sound". Every pit states its count as a number as well as a picture.
- A match in progress is kept in this browser (`govibearcadia.pallanguzhi`) and resumes after a reload. Nothing is sent anywhere.

## Not built

Online play, regional variants beyond the switches above, a choice of which pits to refill, and sound beyond simple tones.
