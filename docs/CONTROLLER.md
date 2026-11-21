# Controller support

Status (2026-11-21): **built, tested only with a simulated controller.** Not yet tried on a real gamepad or a TV browser.

## What it does

One layer (`src/components/GamepadBridge.tsx`, pure logic in `src/lib/gamepad.ts`) lets a game controller drive the whole arcade. It polls the browser Gamepad API only while a controller is connected, and everything it does is either a **keyboard press** or a **focus move**, so each game's own keyboard controls stay the single source of truth. No game was changed and nothing leaves the device.

| Controller | Does |
|---|---|
| D-pad or left stick | Sends the arrow key to the focused element or page. If nothing claims it (the game did not call `preventDefault`), the focus ring moves to the nearest control in that direction. Held directions repeat after 400 ms, then every 120 ms. |
| A | Clicks the focused button or link; otherwise sends Space (the action key in most games). |
| X | Same, but sends Enter. |
| B | Sends Escape; on an ordinary page, if nothing claims it, goes back. |
| Y or Start | Sends `p` (pause). |
| LB / RB | Previous / next control, a way to reach the buttons around a game. |

- From nothing focused, the first D-pad press focuses the control nearest the middle of the screen, which is the board in most games.
- A focused dropdown (the level or game picker) changes value with the stick, because a script cannot open it.
- While a controller is in use the page shows a thick focus ring (`html[data-input="pad"]`); a real mouse, touch or key press resets it.
- A screen-reader announcement says when a controller connects or disconnects.

## What it does not do (yet)

- No analog or continuous control: a stick is treated as four directions, so games that read held arrow keys work, but there is no fine steering.
- No button remapping and no on-screen hint for controller users.
- No gyro, rumble or multiple controllers (the first connected pad is used).
- No "TV mode" layout (larger type and buttons for a 10-foot screen).
- Games that need Tab-only focus quirks or text entry (Daily Word's keyboard is on-screen buttons, so it works by focus) have not been checked one by one. Only the checks below were run.

## Verified

Unit tests of the mapping and focus choice (`src/lib/gamepad.test.ts`), and e2e with a mocked `navigator.getGamepads` (`e2e/gamepad.spec.ts`, desktop and phone): the D-pad moves focus on the home page and A opens a game; arrow, Space and `p` presses reach a page listener and a claimed arrow does not move focus; B goes back; Connect Four is played with the controller alone; a dropdown changes with the stick; nothing changes without a controller.

**Not verified:** a real controller, a TV or console browser (Xbox, PlayStation, Smart TV), or each of the 52 games with a controller.
