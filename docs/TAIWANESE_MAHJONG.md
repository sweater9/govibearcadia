# Taiwanese Mahjong

Status: playable on `feature/taiwanese-mahjong` (draft PR). Not deployed. You play three computers.

## Sources
Rules for Taiwanese (16-tile) Mahjong differ between tables, and no single source is complete. The tai table and payment shape follow the [MahJongo Taiwan rules](https://mahjongo.com/taiwan) page (144 tiles, 16-tile hands, flowers, counterclockwise play, chow only from the player before you, tai table, dealer and streak tai). Tile set, deal, claims and kongs were cross-checked against the [16-tile Taiwanese Mahjong guide](https://16tilestwmajiong.blogspot.com/2025/03/16-tile-taiwanese-mahjong-with-flower.html) and [Mahjong Time's Taiwanese rules](https://mahjongtime.com/mahjong-taiwanese-rules-5.html). Those pages disagree in places (an older table there gives different tai); where they do, this game follows MahJongo and the choices are written down below.

## What is built
- **Engine** (`src/games/mahjong/`, pure TypeScript): tiles and English names, splitting a hand into five sets and a pair, shanten, tai scoring, and the full hand state machine (wall, deal, flowers, draw, discard, claims, kongs, payments, dealer rotation). Whole matches played by computers in unit tests keep every tile accounted for and payments summing to zero.
- **Computers** (`ai.ts`): Easy, Medium and Hard. They choose discards by shanten and tiles that improve the hand, claim only what moves the hand forward, and always win when they can.
- **Screen** (`Mahjong.tsx`): tap a tile to pick it, tap again to discard; buttons for Win, Pung, Kong, Chow and Pass; a Scoring panel; saved between moves and resumable.

## Rules chosen
| Topic | Choice |
|---|---|
| Tiles | 144: 3 suits (Characters, Dots, Bamboo) × 36, 4 winds and 3 dragons × 4, 8 flowers |
| Hand | 16 tiles (dealer draws a 17th); five sets and a pair; flowers are shown and replaced from the back of the wall |
| Wall | The last 16 tiles are never drawn from the front; the hand is a draw when the live wall runs out |
| Turns | Counterclockwise. Chow only from the player before you |
| Claims | Win > pung/kong > chow. If several players win on one discard, the first in turn order after the discarder wins |
| Kongs | Claimed, concealed, or added to an exposed pung; each draws a replacement from the back |
| Payment | A win pays `30 + 10 × tai`. Discard win: the discarder pays. Self-draw: all three pay. Losers do not pay each other |
| Dealer | The dealer adds 1 tai, plus 2 per consecutive hand held, to every payment they make or receive |
| Dealer rotation | The deal stays after a dealer win or a draw (streak +1) and passes to the next seat after any other win |
| Match | East round: ends when the deal has passed four times. Or a single hand. Everyone starts on 1000 |

### Tai implemented
Self-draw 1 · concealed hand 1 · concealed self-draw 3 (in all, replacing the two) · win after a kong 1 · dragon pung 1 each · seat wind pung 1 · round wind pung 1 · seat flower 1 each · all chows 2 (no flowers at all, pair not honour) · melded hand 2 · three concealed pungs 2 · four 5 · five 8 · all pungs 4 · little three dragons 4 · big three dragons 8 · half flush 4 · full flush 8 · all honours 8 · little four winds 8 · big four winds 16 · all eight flowers 8 (wins at once).

### Not built (so not claimed)
- Tai that depend on the wait or the moment: ready/tenpai, edge/inside/single waits, last tile, robbing a kong, seven flowers, Blessings of Heaven/Earth/Man.
- Passing restrictions on a missed win, multiple winners on one discard, and insurance penalties.
- Winds count as a pung tai only for the seat wind and the round wind (East round, so East), the usual Taiwanese reading; the source table does not say.
- A tutorial and online play. A claimed win with no tai (zero tai) is allowed.

## Known limits
- Hard is a heuristic player, not a perfect one: it does not read opponents' hands or play defence beyond a small bias for tiles already discarded.
- The computers pause about half a second per move; there is no speed setting yet.
