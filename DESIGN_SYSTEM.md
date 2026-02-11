# OG Voice UI System

This document defines the shared visual utilities used across marketing and app pages.

## Core principles

- Keep the look premium, clean, and minimal.
- Use the cyan/fuchsia palette for primary emphasis.
- Reuse `og-*` utility classes instead of repeating long class strings.
- Keep interaction feedback consistent (lift, glow, hover timing).

## Layout utilities

- `og-container`: standard horizontal container (`max-w-6xl`, side padding).
- `og-app-main`: standard internal app page shell.
- `og-section-shell`: section wrapper with overflow + bottom border.
- `og-section-inner`: section vertical rhythm and width.
- `og-section-head`: centered section heading block.

## Glow/background utilities

- `og-glow-layer`: absolute non-interactive glow layer wrapper.
- `og-glow-top-sm` / `og-glow-top-md` / `og-glow-top-lg`: top radial glow presets.

## Motion utilities

- `og-lift`: shared transition and hover lift.
- `og-hover-cyan`: cyan hover border/glow.
- `og-hover-fuchsia`: fuchsia hover glow.

## Surface utilities

- `og-surface-glass`: light glass surface.
- `og-surface-panel`: subtle panel surface.
- `og-surface-dark`: dark premium card surface.
- `og-surface-auth-card`: auth form card surface.

## Button utilities

- `og-btn-gradient`: primary cyan->fuchsia CTA style.
- `og-btn-outline-soft`: soft outline button hover behavior.

## Form utility

- `og-input-premium`: dark premium input base style.

## Chip utilities

- `og-chip-soft`: shared chip base (inline-flex, spacing, radius).
- `og-chip-cyan`: cyan highlighted chip.
- `og-chip-muted`: subtle muted chip.
- `og-chip-gradient`: gradient highlight chip.

## Shared component

- `PageHeader` (`src/components/ui/page-header.tsx`)
  - Reuse for consistent page titles/subtitles/actions.
  - Props: `title`, `description`, `actions`, `size`, and class overrides.

## Usage guidance

- Prefer composition of `og-*` utilities over custom one-off class strings.
- When adding a new repeated style pattern, extract once into `globals.css` under `@layer components`.
- Keep hover timing and lift behavior aligned with existing utilities.
- For new premium CTAs, start with `og-btn-gradient` and only extend if required.
