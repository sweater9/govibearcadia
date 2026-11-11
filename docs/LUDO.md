# Ludo

Classic race-and-capture game for 2 to 4 players on one device, with 0 to 3 computer players. Pure rules in `src/games/ludo/rules.ts`; the computer in `bot.ts` is deterministic, so saved matches (seed + settings + action list) replay exactly.

Rules as built: 52-square ring, four tokens each; a six brings a token out; exact roll to finish; safe squares are each start square and the starred squares; landing on a lone opposing token on an unsafe square sends it back to the yard; an extra roll for a six, a capture or a token home; three sixes in a row lose the turn; the first player with all four tokens home wins. Two players sit in opposite corners.

Not built: online play, house-rule options (e.g. blockades), playtested balance numbers.
