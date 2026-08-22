# Blue AI Portal — UI Redesign Spec (source of truth)

Direction: dark glassmorphism/SaaS-template → light, classic, professional,
"technical publication" feel. Blue AI is a coding agent, so the signature
device is restrained monospace labels (like code comments) and thin ruled
dividers — not gradients or glass.

## Color palette

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#161B22` | Primary text, headings |
| `--ink-muted` | `#57606F` | Secondary/body text |
| `--ink-faint` | `#8A93A3` | Tertiary text, placeholders |
| `--paper` | `#FFFFFF` | Page background |
| `--paper-alt` | `#F6F7F9` | Section/alt background |
| `--paper-sunken` | `#EEF0F3` | Inset panels, code blocks |
| `--line` | `#E3E6EB` | Default borders |
| `--line-strong` | `#CBD1DA` | Emphasized borders |
| `--brand` | `#1E3A6E` | Primary brand navy (buttons, links, active states) |
| `--brand-hover` | `#16294F` | Brand hover/pressed |
| `--accent` | `#B5651D` | Copper accent — sparingly, for highlights/badges only |
| `--success` | `#1E7A4C` | Success states |
| `--danger` | `#B3261E` | Errors, destructive actions |
| `--warning` | `#946200` | Warnings |

No gradients on text or large surfaces. `--brand` may be used as a solid
button fill; gradients are removed entirely except one subtle radial tint
(≤6% opacity) permitted in hero sections only.

## Typography

- Headings: **IBM Plex Sans** (600/700) — set with `tracking-tight`.
- Body/UI: **Inter** (400/500).
- Labels, eyebrows, code, badges: **IBM Plex Mono** (500), uppercase,
  letter-spaced, small size — this is the one recognizable signature (e.g.
  `// pricing`, `01 · agents`).
- Scale: `text-sm` body (14px), `text-base` (16px) for longer copy,
  headings step `text-2xl → text-5xl` across page/section/card levels.
  Never exceed `text-6xl`.

## Spacing

- Section vertical rhythm: `py-16` md, `py-24` lg.
- Container: `max-w-7xl mx-auto px-6`.
- Card padding: `p-6` default, `p-8` for feature/pricing cards.
- Consistent `gap-6`/`gap-8` in grids, never ad-hoc pixel gaps.

## Radius & borders

- Buttons/inputs: `rounded-md` (6px).
- Cards/panels: `rounded-lg` (8px) max. No `rounded-2xl`/`rounded-3xl`.
- `rounded-full` reserved for avatars, dots, and icon badges only — not
  buttons or pills-as-navigation.
- Borders are `1px solid var(--line)`; never rely on shadow alone to
  define a surface.

## Shadows

- Default surfaces: **no shadow**, border only.
- Elevated (dropdowns, modals, popovers): `shadow-sm` (`0 1px 2px
  rgba(16,20,30,.06)`) or `shadow-md` at most. No colored/glow shadows
  (`shadow-blue-500/20` etc. are removed).

## Buttons

- Primary: solid `--brand` fill, white text, `rounded-md`, `px-5 py-2.5`,
  hover → `--brand-hover`. No gradient fill.
- Secondary: white fill, `1px solid var(--line-strong)`, `--ink` text,
  hover → `--paper-alt` background.
- Ghost/text: no border, `--ink-muted` text, hover → `--ink`.
- Never use `rounded-full` or drop shadows on buttons.

## Inputs

- White fill, `1px solid var(--line)`, `rounded-md`, `px-3.5 py-2.5`.
- Focus: border → `--brand`, plus a 2px `--brand` outline at 20% opacity
  (`focus:ring-2 focus:ring-brand/20`). No glow/blur effects.

## Cards / panels

- White fill, `1px solid var(--line)`, `rounded-lg`, no backdrop-blur,
  no translucency. `.glass` utility is retired.
- Hover (only where the card is interactive): border → `--line-strong`,
  optional `shadow-sm`. No scale/translate transforms.

## Tables

- Header row: `--paper-alt` background, `--ink-muted` text, `text-xs`
  uppercase mono label style, bottom `1px solid var(--line-strong)`.
- Body rows: `1px solid var(--line)` between rows, no zebra striping,
  hover → `--paper-alt`.

## Navigation / sidebar

- Navbar: white, `1px solid var(--line)` bottom border, no blur, sticky.
- Active link: `--ink` text + `--brand` underline (2px). Inactive:
  `--ink-muted`, hover → `--ink`.
- Footer: `--paper-alt` background, same border/typography rules as body.

## Hover / focus behavior

- Links/nav: color transition only, `transition-colors duration-150`.
- Buttons: background-color transition only.
- Expandable rows/accordions/dropdowns: chevron rotates `→` (closed,
  rendered as a right-facing chevron) to `↓`/rotated-90° (open) via
  `transition-transform duration-150`. No bounce/elastic easing.
- Focus-visible: every interactive element gets a visible `--brand`
  outline; never remove focus rings without replacing them.

## Transitions

- Durations: `duration-150` for hover, `duration-200` for
  open/close (dropdown, modal, accordion). Nothing above `duration-300`.
- No animated gradients, no floating/pulsing decorative elements, no
  scroll-triggered parallax. `AnimatedBackground3D`/`PageBackground3D`
  are reduced to a static, near-invisible texture (see components).

## Responsive principles

- Mobile-first stacking; nav collapses to existing mobile menu pattern.
- Tables scroll horizontally on small screens rather than reflowing into
  cards, unless a page already had a card fallback.
- Maintain the same spacing scale at all breakpoints, just fewer columns.

## Do / Don't

**Do:** solid brand navy, thin borders, mono labels for structure, white
space, one accent color used sparingly, consistent button/input styling
site-wide.

**Don't:** gradients on buttons/text/backgrounds, glassmorphism/blur,
neon or saturated multi-color gradients (purple→pink→cyan etc.), heavy
colored shadows, `rounded-full` buttons, decorative animation, more than
one accent color per view.
