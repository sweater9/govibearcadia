# DESIGN.md: GoVibeArcadia

Direction: midnight arcade, editorial. Near-black blue ground, one electric cyan for actions, one warm amber used sparingly, a muted color per game category, and a grotesque display face with no gradient text. Dark only. Source of truth for the canvas "GoVibeArcadia Redesign".

Note: not based on real-site references. Choices follow the brief and what exists on the live site.

## Color

| Token | Value | Role |
|---|---|---|
| --bg | #0B0D14 | Page background |
| --surface | #141826 | Cards, panels |
| --surface-inset | #0F1220 | Board wells, stat boxes, inputs, footer |
| --border | #232A3D | Dividers, card and input borders |
| --text | #EEF1F8 | Headings, body |
| --text-muted | #9AA3B8 | Secondary text, captions, placeholders |
| --primary | #3DD9F5 | Primary buttons, links, active chips, focus ring |
| --primary-hover | #8AE8FA | Link hover |
| --on-primary | #06222A | Text on primary |
| --accent | #FFB547 | Section labels, key figures, highlights, "Original" badge |
| --on-accent | #1F1300 | Text on accent |
| --success | #5BD08A | Online status dot |

### Category colors (labels and thumbnail line color)

| Category | Label / line | Thumbnail background |
|---|---|---|
| Puzzle | #8FA8FF | #1A2142 |
| Focus | #FFD27A | #2B2414 |
| Arcade | #FF8FA3 | #2B1620 |
| Logic | #7EE0B0 | #12281F |
| Retro | #C9A6FF | #241B3B |
| Strategy | #6FD3E8 | #102530 |
| Word | #FFB38A | #2B1D14 |

Rules: one primary and one accent per screen area. Amber never fills a large surface except the Original badge. Category color is for the mono label and the thumbnail only. Every text pair above is at least 4.5:1 on its background.

## Typography

- Display: Space Grotesk 500, 700. Headlines, game names, numbers.
- Text: Inter 400, 500, 600. Body, buttons.
- Mono: JetBrains Mono 500. Labels, tags, ranks, scores in tables.

| Step | Size / line height | Use |
|---|---|---|
| display | clamp(44px, 7vw, 76px) / 1.02, -0.03em | Hero headline |
| h1 | 40px / 1.1, -0.02em | Page titles (32px on phone) |
| h2 | 40px / 1.1 (30px on phone) | Section titles |
| h3 | 22–36px | Game names on cards |
| lead | 20px / 1.5 | Intro paragraphs |
| body | 17px / 1.6 (16px on phone) | Default |
| small | 13–15px | Captions, dates |
| label | 12–13px mono, 0.1em tracking, uppercase | Section eyebrows, category tags |

Measure: paragraphs max 34em. Headline max 12ch in the hero.

## Spacing and layout

- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 88, 96.
- Content width 1200px, side gutter 24px desktop, 16px phone.
- Section top padding 72–88px desktop, 40px phone.
- Grids: game grid `repeat(auto-fill, minmax(260px, 1fr))` with 16px gap. Start-here cards flex-wrap with 20px gap.
- Phone artboard width 390px, single column, chips scroll horizontally.

## Shape and depth

- Radius: 6px (chips, badges, inputs, thumbnails on cards), 10px (buttons, small cards, tiles), 16px (large cards, panels, boards).
- No shadows. Depth comes from surface color and 1px borders.

## Components

- Primary button: --primary fill, --on-primary text, 10px radius, 14px 24px padding, 600 weight, min height 44px.
- Secondary button: transparent, 1px --border, --text.
- Accent button: --accent fill, --on-accent text. Reserved for a single promoted action, if any.
- Filter chip: 44px high, 10px radius, 1px --border. Active: --primary fill, --on-primary text. Show the count after the label.
- Game card: --surface, 1px --border, 10px radius, 20px padding. Order: thumbnail (16:9, 6px radius), mono meta row (category · time, Online chip on the right), name, one-line description.
- Featured card: same, 16px radius, 32px padding, thumbnail 10px radius, larger name (36px).
- Badges: "Online" cyan fill with --on-primary, "Original" amber fill with --on-accent. 12px, 600, 6px radius, 2px 8px padding.
- Stat box: --surface-inset, 1px --border, 10px radius, mono 12px label above a 28px display number. Best score in amber.
- Board well: --surface-inset, 1px --border, 16px radius, 12px padding.
- Leaderboard: top three as cards (rank 1 has an amber border), ranks 4+ as rows with rank, nickname, date and score. Filter by game with chips.
- Inputs: --surface-inset, 1px --border, 6px radius, 44px high, placeholder --text-muted.
- Navigation: wordmark left (GoVibe in --text, Arcadia in --primary), links in --text-muted, current page underlined in --primary, Online status chip, one primary button on the home page.
- Footer: --surface-inset, one line of reassurance copy, a few links.
- Focus: 2px --primary outline, 2px offset, on every interactive element.

## Thumbnails

Each game has a 160×90 inline SVG, drawn with `currentColor` for the category color, #FFB547 for one highlight, #EEF1F8 for neutrals, on the category background. Decorative: `aria-hidden="true"`. They stand in until real screenshots replace them. Keep new ones to a handful of shapes and no gradients.

## Imagery and icons

- Icons: inline stroke SVG, 1.5px, 20px, in --primary. No emoji.
- Real game screenshots, when added, go in the same 16:9 frame with the same radius, on the category background.

## Copy

Short and plain. Trust line near the top: "No tracking, no account, works offline once loaded, progress stays on your device." Leaderboards use nicknames, no accounts. Sample data is labelled as such.

## Avoid

Gradient text, glow shadows, glassmorphism, purple-to-blue washes, three identical feature cards, emoji icons, centering every section.
