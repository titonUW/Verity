# Verity Design Tokens

This document defines the design system tokens used throughout the Verity Dashboard.

## Colors

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--verity-blue-primary` | `#005CCE` | Primary brand color, buttons, links |
| `--verity-blue-secondary` | `#0088CF` | Secondary accent, gradients |
| `--verity-teal-accent` | `#05B8BC` | Accent highlights, active states |

### Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--verity-gray-50` | `#F8FAFC` | Primary foreground text |
| `--verity-gray-100` | `#F1F5F9` | Secondary text |
| `--verity-gray-200` | `#E2E8F0` | Borders (light mode) |
| `--verity-gray-300` | `#CBD5E1` | Disabled text |
| `--verity-gray-400` | `#94A3B8` | Muted/placeholder text |
| `--verity-gray-500` | `#64748B` | Icons |
| `--verity-gray-600` | `#475569` | Secondary icons |
| `--verity-gray-700` | `#334155` | Borders, elevated surfaces |
| `--verity-gray-800` | `#1E293B` | Card backgrounds |
| `--verity-gray-900` | `#0F172A` | Secondary background |
| `--verity-gray-950` | `#020617` | Primary background |

### Status Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--verity-success` | `#10B981` | Success states, ALLOW |
| `--verity-warning` | `#F59E0B` | Warning states, WARN |
| `--verity-error` | `#EF4444` | Error states, BLOCK |
| `--verity-info` | `#3B82F6` | Info states, REQUIRE |

### Decision Colors

| Decision | Color | Badge Class |
|----------|-------|-------------|
| ALLOW | Emerald `#10B981` | `badge-allow` |
| WARN | Yellow `#F59E0B` | `badge-warn` |
| REQUIRE_EXTRA_VERIFICATION | Blue `#3B82F6` | `badge-require` |
| BLOCK | Red `#EF4444` | `badge-block` |

### Grade Colors

| Grade | Color | Class |
|-------|-------|-------|
| A (90-100) | `#10B981` | `grade-a` |
| B (80-89) | `#22C55E` | `grade-b` |
| C (70-79) | `#F59E0B` | `grade-c` |
| D (60-69) | `#F97316` | `grade-d` |
| F (<60) | `#EF4444` | `grade-f` |

## Typography

### Font Family

```css
--font-sans: "Calibri", "Segoe UI", "Inter", system-ui, -apple-system, sans-serif;
--font-mono: "Consolas", "Monaco", "Courier New", monospace;
```

### Font Sizes

| Size | Value | Usage |
|------|-------|-------|
| xs | 12px | Small labels, metadata |
| sm | 14px | Body text, table cells |
| base | 14px | Default body text |
| lg | 18px | Subheadings |
| xl | 20px | Page titles |
| 2xl | 24px | Large headings |
| 3xl | 30px | Hero text |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| normal | 400 | Body text |
| medium | 500 | Labels, buttons |
| semibold | 600 | Headings |
| bold | 700 | Emphasis |

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-xs` | 0.25rem (4px) | Tight spacing |
| `--spacing-sm` | 0.5rem (8px) | Compact spacing |
| `--spacing-md` | 1rem (16px) | Default spacing |
| `--spacing-lg` | 1.5rem (24px) | Section spacing |
| `--spacing-xl` | 2rem (32px) | Large spacing |
| `--spacing-2xl` | 3rem (48px) | Page sections |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 0.375rem (6px) | Buttons, inputs |
| `--radius-md` | 0.5rem (8px) | Cards, modals |
| `--radius-lg` | 0.75rem (12px) | Large cards |
| `--radius-xl` | 1rem (16px) | Hero sections |
| `--radius-full` | 9999px | Avatars, badges |

## Shadows

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-glow: 0 0 20px rgba(5, 184, 188, 0.15);
```

## Components

### Buttons

| Variant | Description |
|---------|-------------|
| `default` | Primary gradient button |
| `secondary` | Dark background with border |
| `outline` | Transparent with teal border |
| `ghost` | Transparent, hover reveals background |
| `destructive` | Red for dangerous actions |

### Cards

| Class | Description |
|-------|-------------|
| `verity-card` | Standard card with border |
| `verity-card-elevated` | Card with gradient and shadow |

### Headings

Use the `.verity-heading` class to add the signature teal accent underline:

```html
<h2 class="verity-heading">Section Title</h2>
```

## Animations

### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Pulse Glow
```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(5, 184, 188, 0.4); }
  50% { box-shadow: 0 0 20px 5px rgba(5, 184, 188, 0.2); }
}
```

## Dark Theme

The Verity Dashboard uses a dark theme by default. All color tokens are optimized for dark backgrounds:

- Background: Near-black (`#020617`)
- Cards: Dark slate (`#1E293B`)
- Text: Light gray (`#F8FAFC`)
- Muted text: Medium gray (`#94A3B8`)
- Borders: Dark gray (`#334155`)

## Brand Guidelines

1. **Shield Icon**: Use the Verity shield as a brand marker. Do not recolor or distort.

2. **Accent Underline**: Use teal accent underline for major section headings.

3. **Gradients**: Primary to secondary blue for buttons and emphasis.

4. **Angular Overlays**: Subtle diagonal gradient overlays for hero sections.

5. **Glass Effect**: Cards should have subtle transparency and blur for depth.
