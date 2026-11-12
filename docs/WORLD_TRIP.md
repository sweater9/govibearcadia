# World Trip

An original offline property-trading game for 2 to 4 players on one device. Its turn flow, seeded dice, trade offers and replay save started from an earlier prototype (Bazaar), which has since been removed.

## Board

40 spaces on an 11x11 outline, clockwise from the bottom-right corner: bottom edge right to left (1 to 10), left edge bottom to top (11 to 20), top edge left to right (21 to 30), right edge top to bottom (31 to 40). Data and layout: `src/games/worldtrip/board.ts`.

22 cities, 4 airports, 2 travel services (Rail Pass, Ferry Pass), 6 Travel Card spaces, 2 fee spaces (Ticket Fee 100, Luggage Fee 80) and 4 corners. Cities form 8 colour groups of 2 or 3 along each edge (2+3, 3+3, 3+3, 2+3). Each city has an original landmark illustration (`Landmark.tsx`); Copenhagen is a Nyhavn-style waterfront and Vancouver a mountain-backed waterfront skyline.

## Rules

- Everyone starts on the Departure Gate with 1500 credits and takes 12 turns (12, 20 or 30 selectable). Highest net worth wins; ties share the win.
- Roll two dice, move clockwise. Passing or landing on the Departure Gate pays a 150 credit travel allowance. Roll doubles and you roll again (three doubles in a row sends you to the Hotel Stopover). Landing on the Scenic Stopover ("missed flight") or drawing the cancelled-flight Fortune Card sends you to the Hotel Stopover; the World Festival is a free stop.
- Hotel Stopover: a stranded player rolls for doubles each turn to leave; pays 50 cr to leave early; or uses a priority boarding pass (a Fortune Card). After three failed rolls the 50 cr is paid automatically and they move on that roll. Just visiting is free.
- Claim an unowned city, airport or service when you land. Pass on it (or be unable to afford it) and it goes to auction: every traveller still in the trip bids in turn (steps of 10), starting with the next player, and the last bidder left pays their bid and takes it. If nobody bids it stays unclaimed.
- Landing on another player's stop pays its visitor fee. Cities: a tenth of the price, doubled when the owner holds the whole colour group. Airports 50 and services 35, multiplied by how many of that kind the owner holds.
- Owning every city in a colour group lets you build a visitor centre on each (50, 100, 150 or 200 credits by group), which doubles that city's fee again (four times the base with a full group and a centre). Not on airports or services.
- Two decks of 10 seeded cards with immediate effects: Travel Cards (small events) and Fortune Cards (bigger swings: pay each player, pay per visitor centre, go to the Hotel Stopover, keep a boarding pass). Three card spaces draw from each deck.
- Mortgage a stop for half its price: no visitor fee until it is redeemed for 10% more, it blocks centres on its colour group, and net worth does not change. Not allowed while any city in the group has a centre.
- A player who cannot pay a fee or card sells stops back to the bank at half value (cheapest first). If that is still not enough they are out of the trip: they take no more turns, their remaining credits go to the creditor, and the trip ends early when one traveller is left.
- One trade offer per turn: swap any stops (up to 8 either way, none with a visitor centre) plus credits in either direction; the buyer accepts or declines on the same device.
- Net worth = credits + printed price of owned stops + printed cost of visitor centres.

## Engine, save and tests

Pure rules in `rules.ts` (no React), seeded dice (`seed:turn`). The save (`govibearcadia.world-trip.v1`) stores the seed, settings and action list and replays them on load, so a damaged save is rejected. Tests: `rules.test.ts` (40-space count, order, clockwise cell layout, wraparound and lap bonus, group eligibility, trade transfer, auctions, growing fees, selling to the bank and bankruptcy, replay reload, whole matches at 12/20/30 turns), `WorldTrip.test.tsx`, `e2e/world-trip.spec.ts`.

## Not final

The allowance, prices, fees and centre costs are starting values and have not been playtested on the larger board. At about 7 spaces per roll a player lands on roughly 12 of the 40 spaces in 12 turns, so complete groups are rare: that is why 20 and 30 turns are offered.

## Computer players

At setup, "Computers" sets how many seats the computer plays (0 to one fewer than the player count; the default is one). Human seats come first, so with 3 players and 1 computer you are Player 1, Player 2 and Computer 1. A computer takes its turn on a short timer (about 0.8 s per action) so you can follow it.

The computer (`worldtrip/bot.ts`) is deterministic and uses no randomness, so a saved match still replays exactly from its action list. It bids in auctions up to 80% of a stop's printed value (130% if it completes a group, never leaving less than 100 cr) and otherwise drops out. It claims a stop while it keeps a 150 cr reserve (or when the stop completes a colour group), builds the best visitor centre it can afford above the reserve, and accepts an offer only at a fair price (up to 90% of the printed value, 140% if it completes a group, and never leaving less than 100 cr). It values a trade by what it receives (more if it completes a colour group), what it gives up (more if it breaks one) and the credits, and it never proposes trades or mortgages. It uses a boarding pass at once, and pays to leave the Hotel Stopover only when it keeps at least 400 cr. Tests play whole 2, 3 and 4 seat matches between computers and check every action is legal.

Online rooms for World Trip are not built.
