# Visual design: pixel-art dark medieval

The game's art (battlefield, wizards, victory GIFs) is pixel art set in dusk ruins. The interface matches it: dark stone, torchlight, chunky 8-bit controls.

## Tokens

Defined in `tailwind.config.js` and as CSS variables in `src/app/globals.css`.

| Token | Value | Use |
|---|---|---|
| Background | `#0d0a08` + dimmed `public/images/bg-ruins.webp` (10 KB), torch glow, vignette | Every page (`body::before`) |
| Stone (`gray-*` remapped to warm stone, `stone`, `stone-dark`, `stone-light`) | `#2c2721` / `#16120e` / `#4a4238` | Panels, inputs, secondary buttons, secondary text |
| Torch (`torch`, Tailwind `amber-*`) | `#e8891c` | Primary buttons, highlights, focus outlines |
| Blue wizard | Tailwind `blue-400/500` | Everything tied to the blue player |
| Red wizard | Tailwind `red-400/500` | Everything tied to the red player |
| Bone (text) | `#f4efe6` | Body text |
| Pixel unit | `--pixel: 4px` | Thickness of stepped borders and shadows |

- **Corners are square.** All `rounded-*` sizes are 0 except `rounded-full` (status dots).
- **Fonts** (self-hosted by `next/font`, no runtime request):
  - **Pixelify Sans** (`font-pixel`): titles, buttons, labels and big numbers. `h1`–`h3`, `button` and `.font-black` use it automatically.
  - **Alegreya Sans** (`font-sans`): body text.
  - **Spells** stay in the readable serif (Georgia) so the Latin is easy to type.

## Components (`globals.css`, `@layer components`)

| Class | When to use |
|---|---|
| `btn-pixel` | The main action on a screen (Start Fight, Enter Battle, Let's Fight, Cast Spell, Next round, Fight again). Torch orange, dark text, stepped border, hard shadow; it pushes down when pressed. |
| `btn-pixel-secondary` | Other actions (Exit, Stop training, Start alone). Same shape in stone. |
| `panel-stone` | A carved stone tablet: cards, score tables, the spell display, intro and status banners. |
| `input-pixel` | Text inputs: a sunken stone well with a torch outline on focus. |

Leave about 20 px (`gap-5`) between pixel buttons and panels: the stepped border draws 4 px outside the box.

## Rules

- Prefer hard pixel shadows (`shadow-[6px_6px_0_0_rgba(0,0,0,0.65)]`) to soft blurred glows. Keep glows only for the spell text and the victory headline.
- Keep text contrast at 4.5:1 or more. Use `gray-400` or lighter for small text on stone; `gray-500`/`600` are for large or decorative text only.
- Everything keeps a visible keyboard focus (torch outline) and touch targets of at least 44 px.
- With `prefers-reduced-motion` on, decorative loops stop and the countdown shows without its zoom (see the media query in `globals.css`).
