# Carrom

Status: playable on `feature/carrom` (draft PR). Not deployed.

## What is built
- **Rules engine** (`src/games/carrom/rules.ts`, pure, unit tested): turns, fouls, queen cover, scoring, boards, the match, 2 players or 4 (doubles, partners opposite, clockwise).
- **Physics and drawing** (`src/games/carrom/board.ts`): Phaser 3.90 with the Matter engine, canvas renderer. Loaded only when a match starts, so no other page downloads it. The chunk is about 1.5 MB (about 360 KB gzip) and is precached for offline play.
- **Computer opponents** (`ai.ts`): geometric "ghost ball" planning (no simulation), Easy / Medium / Hard differ by aim and power error.
- **Controls:** drag back from the striker and release (touch or mouse), drag along the baseline to slide it, or use the Position / Angle / Power sliders and the Strike button (keyboard friendly).
- Saved progress is kept in this browser (`govibearcadia.carrom`); the result is reported once when a match ends or is finished early.

## Rules chosen (standard, UK Carrom association style)
| Topic | Choice |
|---|---|
| Colours | White seats 0 and 2, black seats 1 and 3. 9 coins each, 1 queen |
| Turn | Pocketing your own colour (or the queen, validly) keeps the turn; otherwise it passes |
| Opponent coin pocketed | Stays down, counts for the opponent, turn is lost (switch `opponentCoin: 'returns'`) |
| Striker pocketed | Foul: coins pocketed in that shot return, plus one penalty coin of yours (owed if you have none down) |
| Queen | Must be covered by pocketing one of your coins in the same or the next shot, else it returns to the centre |
| Last coin | Cannot be pocketed before the queen is covered (foul, coin returns with a penalty) |
| Board won | Clear all your coins after the queen is covered; points = opponent coins left + 3 for a covered queen |
| Queen points | Not scored once the winner already has 22 |
| Match | First to 25 points, or after 8 boards (higher score wins) |

Sources disagree on targets and bonuses (another set of laws uses 29 points and a 5-point queen). The values live in `DEFAULT_CONFIG`, so changing them is one line.

## Known limits (verified honestly)
- Matter physics is not bit-identical across browsers, so a shot can end slightly differently on different devices. The rules and the computer's plans are deterministic; the physics is not.
- Hard mode plans one shot at a time; it does not look ahead or play defence.
- No online play. No sound.
- Board is small on short laptop screens (about 205 px at 650 px high) because the play page must fit without scrolling.
