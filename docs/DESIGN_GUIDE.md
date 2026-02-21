# Crisp Design Guide

This guide documents the design system used on the Crisp landing page and should be applied consistently across all pages and components. Reference: `src/app/globals.css`, landing components in `src/components/`.

---

## 1. Design tokens

All tokens live in `src/app/globals.css` (`:root`). Use CSS variables; avoid hard-coded hex values for backgrounds and text.

### Colors

| Token | Use |
|-------|-----|
| `--bg` | Default page background (pure white). |
| `--bg-warm` | Subtle warm background (e.g. footer, alternate sections). |
| `--ink` | Primary text, darkest black. |
| `--ink-light` | Secondary text, dark grey. |
| `--muted-1` | Light grey (blobs, subtle fills). |
| `--muted-2` | Borders, dividers, muted UI. |
| `--intent-decisive` | Amber (e.g. manifesto label). |
| `--intent-natural` | Sky blue. |
| `--intent-calm` | Sage/green. |
| `--intent-persuasive` | Violet (primary CTAs, accents). |
| `--intent-empathetic` | Coral. |
| `--bright-purple` | Alias for persuasive violet (labels, chips). |
| `--ok` | Success/positive (e.g. improvement delta). |
| `--warn` | Warning. |
| `--bad` | Error/negative. |

Prefer `text-[var(--ink)]`, `text-[var(--ink-light)]`, `border-[var(--muted-2)]`, etc. Do not use raw `gray-*` or hex for UI; use tokens.

### Radius & spacing

| Token | Value | Use |
|-------|--------|-----|
| `--radius-lg` | 12px | Cards, panels, dropdowns. |
| `--radius-full` | 9999px | Pills, round buttons. |

Section vertical rhythm: `py-24 sm:py-32` (or `py-32 sm:py-48` for hero-style closing sections). Horizontal: `px-6`, max-width `max-w-4xl` or `max-w-5xl` centered.

### Motion

| Token | Value | Use |
|-------|--------|-----|
| `--motion-duration` | 300ms | Transitions. |
| `--motion-ease` | cubic-bezier(0.16, 1, 0.3, 1) | All animations. |

In Framer Motion use `ease: [0.16, 1, 0.3, 1]` to match.

### Fonts

| Token | Source | Use |
|-------|--------|-----|
| `--font-display` | Inter | Headlines, section titles, wordmark. |
| `--font-body` | Inter | Body text. |
| `--font-serif` | Playfair Display | Taglines, quotes, footer line. |

---

## 2. Typography

### When to use which font

- **Display (Inter):** Hero headline, section titles (How it Works, Vision), page titles (e.g. Your Progress, Privacy & Terms). Use `style={{ fontFamily: 'var(--font-display)' }}` or class `.display-headline` / `.display-wordmark`.
- **Body (Inter):** All body copy, descriptions, form labels.
- **Serif (Playfair):** One-line taglines (e.g. “Human clarity in an AI world.”), quotes, editorial emphasis. Use `style={{ fontFamily: 'var(--font-serif)' }}`.

### Scale

| Context | Tailwind | Notes |
|---------|----------|--------|
| Hero headline | `text-5xl sm:text-7xl md:text-8xl` | `tracking-tighter`, `font-bold` |
| Section title (large) | `text-4xl sm:text-5xl md:text-6xl` | e.g. Vision block |
| Section title | `text-3xl sm:text-4xl` | e.g. How it Works |
| Page title | `text-2xl sm:text-3xl` | App pages (Dashboard, Results, etc.) |
| Subcopy / lead | `text-lg sm:text-xl md:text-2xl` | `text-[var(--ink-light)]` |
| Body | `text-base` or `text-sm` | `text-[var(--ink)]` or `--ink-light` |
| Small / labels | `text-sm`, `text-xs` | Uppercase labels: `tracking-wide` or `tracking-wider` |

Use `text-[var(--ink)]` for primary text and `text-[var(--ink-light)]` for secondary. Avoid `text-gray-*`.

---

## 3. Backgrounds & sections

### Default page

- `bg-[var(--bg)]` or `bg-[var(--bg-warm)]` for the main canvas.
- Do not use hard-coded gradients like `from-[#F9F9FB] to-white`; use tokens.

### Hero-style (optional)

For pages that should feel like the landing hero (e.g. signup, dashboard, record):

- Main background: `bg-[var(--bg)]` or `bg-[var(--bg-warm)]`.
- Optional ambient blob: a single gradient blob, top-centered, e.g.  
  `absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[var(--muted-1)]/50 to-transparent rounded-full blur-3xl opacity-60`  
  (see `HeroSection.tsx`). Use `/40` or `/50` for subtlety.

### Dark block

- Background: `bg-[var(--ink)]`.
- Text: white and `text-[var(--muted-2)]` for secondary; accent e.g. `text-[var(--intent-decisive)]` for labels.

### Section layout

- Container: `max-w-4xl` or `max-w-5xl mx-auto px-6`.
- Section padding: `py-24 sm:py-32` (or `py-32 sm:py-48` for closing hero-style sections).
- Dividers between sections: `border-t border-[var(--muted-2)]`.

---

## 4. Motion

- **Easing:** Always `[0.16, 1, 0.3, 1]` (or `var(--motion-ease)` in CSS). Do not use generic `easeOut` for page-level transitions.
- **Page transition:** Light fade + slight vertical slide (e.g. opacity 0→1, y 6→0). Duration ~0.3s.
- **Scroll-triggered:** Staggered fade-up or blur-in (see ManifestoBlock, PhilosophyBlock, VisionBlock). Use `whileInView`, `viewport={{ once: true }}`, and staggered `delay` (e.g. `index * 0.1` or `index * 0.2`).
- **Reduced motion:** `prefers-reduced-motion` is handled in `globals.css`; animations are disabled when the user prefers reduced motion.

---

## 5. Components

### Nav / header pill

Used for the landing Navbar and the app AppHeader:

- Container: `bg-white/80 backdrop-blur-md border border-[var(--muted-2)] shadow-lg shadow-black/5 rounded-full`.
- Padding: `px-6 py-3` (or equivalent for header height).
- Links: `text-[var(--ink)]` or `text-[var(--ink-light)]` with `hover:text-[var(--ink)]`.

### Primary CTA

Two variants:

1. **Solid ink:** `bg-[var(--ink)] text-white` with `shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all`, `rounded-full`, padding e.g. `px-8 py-4`. Good for footer “Sign Up for Free”.
2. **Purple gradient:** Use class `.cta-bottom-purple` (defined in globals.css). Use for prominent actions (e.g. Start Recording, Sign up in header).

### Secondary button / pill

- `rounded-full border border-[var(--muted-2)] bg-white` (or transparent), `text-[var(--ink)]`, hover: darken border or background slightly.

### Cards / panels

- Border: `border border-[var(--muted-2)]`.
- Radius: `rounded-[var(--radius-lg)]` (12px) — i.e. `rounded-xl` or explicit 12px. Avoid arbitrary `rounded-[20px]` unless the guide is updated.
- Background: `bg-white` or glass-style `.feature-card` (blur + light border) for landing-style cards.
- Shadow: Prefer a soft, consistent shadow; e.g. `shadow-[0_4px_20px_rgba(11,11,12,0.08)]` or similar token-aligned value.

### Form inputs

- Radius: `rounded-2xl` for large inputs (e.g. scenario input).
- Border: `border-2 border-[var(--muted-2)]`, focus with `border-[var(--ink)]` or intent color.
- Use tokens for placeholder and text colors.

---

## 6. Accessibility

- **Reduced motion:** All motion respects `prefers-reduced-motion: reduce` via `globals.css` (animations and transitions disabled).
- **Focus:** Primary CTAs use `focus-visible` outline (e.g. `.cta-bottom-purple`).
- **Color:** Ensure sufficient contrast for `--ink` on `--bg` and for `--ink-light`; status colors `--ok` / `--bad` used for deltas and messages.

---

## Summary checklist for new or updated pages

- [ ] Page background uses `--bg` or `--bg-warm` (no hard-coded hex gradients).
- [ ] Optional hero-style blob uses `from-[var(--muted-1)]/40` or `/50`.
- [ ] All text uses `--ink` / `--ink-light` (no `gray-*`).
- [ ] Headings use `--font-display` (or `.display-headline`).
- [ ] Taglines or quotes use `--font-serif` where appropriate.
- [ ] Section spacing: `py-24 sm:py-32`, `max-w-4xl`/`max-w-5xl`, `px-6`.
- [ ] Cards/panels use `--radius-lg`, `border-[var(--muted-2)]`.
- [ ] CTAs use solid ink or `.cta-bottom-purple`; secondary use pill + border.
- [ ] Motion uses ease `[0.16, 1, 0.3, 1]` and ~0.3s for page transitions.
- [ ] Status/feedback use `--ok` / `--bad` (not `green-600` / `red-600`).
