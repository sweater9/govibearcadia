# Hangman

Status (2026-11-21): **built, draft PR, not deployed.** Tested with unit, component and browser tests; not yet played by a person.

## How it plays

Guess a hidden word one letter at a time. A wrong letter costs an attempt and adds a part to the gallows (ten parts in all, drawn so the last part appears exactly on the last attempt). Attempts allowed: **8 on Easy, 7 on Medium, 6 on Hard**. Rules and scoring are in `src/games/hangman/rules.ts` (pure TypeScript).

- **Modes:** one player (random words), **two players on one device** (one types a secret word, hidden as it is typed, and an optional clue, then passes the device; roles swap each round), and the **daily word**.
- **Categories:** Animals, Countries, Food, Technology, Science, Movies, Sports, General knowledge, Nature, History, or any.
- **Difficulty:** Easy (3 to 6 letters, familiar), Medium (6 to 9 letters, less familiar), Hard (8 to 14 letters, long or tricky to spell).
- **Hints (optional, can be turned off):** the first shows the word's clue, the second reveals one unguessed letter (never the last one). Each costs 40 points and never costs an attempt. At most two a word.
- **Scoring:** 100 / 200 / 300 for an Easy / Medium / Hard word, plus 15 for every attempt left, minus 40 per hint (never below 10), plus a streak bonus of 10 per win in a row after the first (capped at 100). A loss scores 0 and resets the streak. In two-player rounds the guesser earns the word's score for a win; the person who set the word earns 100 if the guesser fails.
- **Daily word:** the same word for everyone on a given UTC date (Medium, any category), chosen from the date alone. Your result for today is remembered on this device; playing it again does not count a second time.
- **Local record:** best streak, words solved and today's daily result are kept in this browser only (`localStorage`, key `govibearcadia.hangman`); nothing is sent anywhere.

## Word list

`src/games/hangman/words.ts`: 10 categories x 3 difficulties x 10 words = **300 hand-picked words**, each a single lowercase word with a short clue that does not contain the word. Stored in the app and cached for offline play; never fetched. The tests check the shape and size of the list, that there are no duplicates, that no clue gives its word away, and that nothing matches a small blocklist of unsuitable terms. **Suitability was checked by me reading the list, not by an independent reviewer; please skim it.** The list is small, so words repeat in long sessions (a word is not repeated until the others in the chosen pool have been used).

## Controls and accessibility

Press the letter keys or tap the on-screen keyboard; Enter starts the next word. Used letters are marked on the keyboard with a check or a cross as well as colour, and their button names say "in the word" or "not in the word". Each guess is announced ("E is in the word 2 times", "No T. 5 attempts left") and the gallows image has a text description of the attempts used. Sounds use the arcade's optional sound setting (a soft tone for a right letter, a lower one for a wrong letter, and win and lose jingles). The reveal animation is turned off for reduced motion.

## Verified

- `src/games/hangman/rules.test.ts` (20 tests): the word list, guessing, losing and winning on each difficulty, hints, scoring, the gallows drawing, choosing words and the daily word.
- `src/games/Hangman.test.tsx` (9 tests, StrictMode): a word is reported exactly once; keyboard and taps; used-letter tracking; hints; settings; two players; the daily word.
- `e2e/hangman.spec.ts` (4 tests, desktop and phone): a word played with the real keyboard and saved once; tapping letters and hints; two players; the daily word survives a reload. The game is in the layout test (laptop heights and phone) and the accessibility scan passes.

## Not verified

- Not played by a person; difficulty is a guess (for example whether Hard is hard enough).
- Sounds not checked by ear on a real device; screen readers not tested with a real one (only the automated accessibility scan).
- Two-player mode is for one shared device; there is no online version.
