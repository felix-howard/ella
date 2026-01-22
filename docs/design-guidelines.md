# Ella Design Guidelines

Design system inspired by VNEC Wallet's clean, modern, and friendly aesthetic.

---

## 1. Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Mint Green** | `#10B981` | Primary buttons, active states, sidebar highlights, links, success indicators |
| **Mint Green Light** | `#D1FAE5` | Hover backgrounds, subtle highlights, active nav item bg |
| **Mint Green Dark** | `#059669` | Pressed states, darker accents |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Coral Orange** | `#F97316` | User name highlight, premium badges, attention-grabbing CTAs |
| **Coral Light** | `#FED7AA` | Light orange backgrounds, soft highlights |
| **Yellow** | `#FBBF24` | Warnings, pending states, star icons |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success Green** | `#10B981` | Positive values, completed states, income |
| **Error Red** | `#EF4444` | Negative values, errors, expenses, destructive actions |
| **Error Red Light** | `#FEE2E2` | Error backgrounds, expense card backgrounds |
| **Warning Yellow** | `#F59E0B` | Warning states, attention indicators |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Background** | `#EFF3F8` | Page background (enhanced contrast) |
| **Card White** | `#FFFFFF` | Card backgrounds, modals |
| **Border Light** | `#CBD5E1` | Card borders, dividers, inputs (darker for contrast) |
| **Muted** | `#E8F5EE` | Subtle backgrounds, mint tint |
| **Text Primary** | `#1E293B` | Headings, primary text |
| **Text Secondary** | `#64748B` | Descriptions, secondary info |
| **Text Muted** | `#94A3B8` | Placeholders, disabled text |

---

## 2. Typography

### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Type Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| **Page Title** | 24px | 600 (Semibold) | 1.3 |
| **Section Header** | 18px | 600 (Semibold) | 1.4 |
| **Card Title** | 16px | 600 (Semibold) | 1.4 |
| **Body Text** | 14px | 400 (Regular) | 1.5 |
| **Small Text** | 12px | 400 (Regular) | 1.5 |
| **Label** | 12px | 500 (Medium) | 1.4 |
| **Large Number** | 32px | 700 (Bold) | 1.2 |

### Text Colors by Context
- **Greeting username**: Coral Orange (`#F97316`)
- **Section titles**: Mint Green (`#10B981`)
- **Primary content**: Text Primary (`#1E293B`)
- **Descriptions**: Text Secondary (`#64748B`)
- **Positive values**: Success Green (`#10B981`)
- **Negative values**: Error Red (`#EF4444`)

---

## 3. Spacing System

Use 4px base unit with consistent multipliers:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps, icon padding |
| `sm` | 8px | Small gaps, compact spacing |
| `md` | 12px | Default component padding |
| `lg` | 16px | Card padding, section gaps |
| `xl` | 24px | Large section spacing |
| `2xl` | 32px | Page section gaps |
| `3xl` | 48px | Major layout divisions |

---

## 4. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 6px | Small buttons, inputs |
| `md` | 8px | Cards, list items |
| `lg` | 12px | Large cards, modals |
| `xl` | 16px | Feature cards, hero sections |
| `full` | 9999px | Pills, badges, avatars, FAB |

**Key principle**: Everything is rounded. No sharp corners.

---

## 5. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | `0 1px 3px rgba(0,0,0,0.08)` | Subtle elevation |
| `md` | `0 4px 6px -1px rgba(0,0,0,0.12), 0 2px 4px -1px rgba(16,185,129,0.04)` | Cards, dropdowns (with mint undertone) |
| `lg` | `0 10px 15px -3px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(16,185,129,0.05)` | Modals, popovers (with mint undertone) |
| `card` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(16,185,129,0.03)` | Card-specific shadow with subtle mint accent |

---

## 6. Components

### 6.1 Buttons

#### Primary Button
```css
background: #10B981;
color: white;
padding: 10px 20px;
border-radius: 9999px; /* pill shape */
font-weight: 500;
box-shadow: 0 1px 2px rgba(0,0,0,0.05);
```
- Hover: Slightly darker (`#059669`)
- Icon + text pattern: Icon left, text right

#### Secondary Button
```css
background: white;
color: #1E293B;
border: 1px solid #CBD5E1;
padding: 10px 20px;
border-radius: 9999px;
```

#### Ghost/Text Button
```css
background: transparent;
color: #10B981;
padding: 8px 16px;
```

#### Destructive Button
```css
background: #EF4444;
color: white;
border-radius: 9999px;
```

### 6.2 Cards

```css
background: white;
border-radius: 12px;
padding: 16px;
box-shadow: 0 1px 3px rgba(0,0,0,0.1);
```

#### Card Variants
- **Stats Card**: Light colored background (mint, yellow, pink tint) with icon, value, label
- **List Card**: White background with grouped list items
- **Feature Card**: Gradient or colored header section

### 6.3 Navigation

#### Sidebar
```css
width: 240px; /* expanded */
background: white;
padding: 16px;
```

**Nav Item (Default)**:
```css
padding: 10px 12px;
border-radius: 8px;
color: #64748B;
```

**Nav Item (Active)**:
```css
background: #D1FAE5;
color: #10B981;
font-weight: 500;
```

#### Floating Action Button (FAB)
```css
position: fixed;
bottom: 24px;
left: 24px;
width: 48px;
height: 48px;
background: #10B981;
color: white;
border-radius: 50%;
box-shadow: 0 4px 12px rgba(16,185,129,0.4);
```

### 6.4 Form Elements

#### Input Field
```css
background: white;
border: 1px solid #CBD5E1;
border-radius: 8px;
padding: 10px 14px;
font-size: 14px;
```
- Focus: Border color `#10B981`, subtle green shadow

#### Toggle Switch
```css
/* Track */
width: 44px;
height: 24px;
border-radius: 12px;
background: #CBD5E1; /* off */
background: #10B981; /* on */

/* Thumb */
width: 20px;
height: 20px;
border-radius: 50%;
background: white;
```

#### Checkbox
```css
width: 20px;
height: 20px;
border-radius: 50%; /* circular checkboxes */
border: 2px solid #10B981;
/* Checked: filled green with white checkmark */
```

### 6.5 Chips & Badges

#### Action Chip (Clickable)
```css
background: white;
border: 1px solid #CBD5E1;
border-radius: 9999px;
padding: 8px 16px;
font-size: 13px;
```
- With icon: Icon left in colored circle, text right

#### Category Chip (Colored)
```css
background: #FED7AA; /* or category color */
border-radius: 9999px;
padding: 6px 12px;
font-size: 12px;
```

#### Badge (Pro/AI)
```css
background: #F97316;
color: white;
border-radius: 4px;
padding: 2px 8px;
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
```

### 6.6 Tabs

#### Pill Tabs
```css
/* Container */
background: #E8F5EE;
border-radius: 9999px;
padding: 4px;

/* Tab (Default) */
padding: 8px 20px;
border-radius: 9999px;
color: #64748B;

/* Tab (Active) */
background: #10B981;
color: white;
```

#### Underline Tabs
```css
/* Tab (Active) */
color: #10B981;
border-bottom: 2px solid #10B981;
```

### 6.7 Modals & Dialogs

```css
background: white;
border-radius: 16px;
padding: 24px;
max-width: 480px;
box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
```

- Header: Title in green, close button top right
- Footer: Cancel (secondary) left, Confirm (primary) right

### 6.8 Progress Indicators

#### Circular Progress
```css
stroke: #10B981; /* progress */
stroke: #CBD5E1; /* track */
stroke-width: 8px;
```
- Center: Large number + small label

#### Linear Progress
```css
height: 8px;
border-radius: 4px;
background: #CBD5E1; /* track */
/* Fill: gradient or solid green */
```

### 6.9 Empty States

- Centered layout
- Muted illustration/icon (gray or light green)
- Heading text explaining the state
- Subtext with suggestion
- Primary CTA button

### 6.10 List Items

```css
padding: 12px 16px;
border-bottom: 1px solid #E8F5EE;
```
- Left: Icon in colored circle
- Center: Title + description
- Right: Value/action/chevron

---

## 7. Iconography

### Style
- **Type**: Outline/linear icons (not filled)
- **Stroke width**: 1.5-2px
- **Size**: 20px (default), 16px (small), 24px (large)
- **Source**: Lucide, Heroicons, or Phosphor (outline variants)

### Icon Colors
- Navigation: `#64748B` (inactive), `#10B981` (active)
- In buttons: Inherit button text color
- Decorative: Match semantic context

### Icon Containers
```css
/* Colored circle background */
width: 40px;
height: 40px;
border-radius: 50%;
background: #D1FAE5; /* or semantic color */
display: flex;
align-items: center;
justify-content: center;
```

---

## 8. Layout Patterns

### Page Structure
```
┌─────────────────────────────────────────────────────┐
│ Sidebar (240px)  │  Main Content                    │
│                  │  ┌────────────────────────────┐  │
│  Logo            │  │ Header (Greeting + Actions)│  │
│  Nav Items       │  ├────────────────────────────┤  │
│                  │  │ Stats Cards (Grid)         │  │
│                  │  ├────────────────────────────┤  │
│                  │  │ Content Cards              │  │
│  Upgrade CTA     │  │                            │  │
│  User/Logout     │  │                            │  │
│                  │  └────────────────────────────┘  │
│  FAB (absolute)  │                                  │
└─────────────────────────────────────────────────────┘
```

### Card Grid
- Stats cards: 2-4 columns, equal width
- Feature cards: 1-2 columns
- Gap: 16px

### Content Width
- Max content width: 1200px
- Sidebar: 240px (collapsible to 64px)
- Main padding: 24px

---

## 9. Animation & Transitions

### Default Transition
```css
transition: all 0.2s ease;
```

### Hover Effects
- Buttons: Slight color darken
- Cards: Subtle shadow increase
- List items: Light background tint

### Micro-interactions
- Toggle: Smooth slide (0.2s)
- Sidebar collapse: 0.3s ease
- Modal: Fade + scale up (0.2s)

---

## 10. Design Principles

### 1. Clean & Minimal
- Generous whitespace
- No visual clutter
- One primary action per section

### 2. Friendly & Approachable
- Rounded corners everywhere
- Soft shadows
- Warm accent colors (coral, yellow)

### 3. Clear Hierarchy
- Green for section titles and CTAs
- Personalized elements in coral
- Consistent typography scale

### 4. Informative at a Glance
- Stats cards with clear numbers
- Color-coded values (green=positive, red=negative)
- Progress indicators for goals

### 5. Consistent Patterns
- Same card styles throughout
- Predictable navigation
- Uniform component behavior

---

## 11. Dark Mode Considerations

When implementing dark mode:

| Light Mode | Dark Mode |
|------------|-----------|
| `#EFF3F8` (bg) | `#0F172A` |
| `#FFFFFF` (card) | `#1E293B` |
| `#1E293B` (text) | `#F1F5F9` |
| `#64748B` (secondary) | `#94A3B8` |
| `#CBD5E1` (border) | `#334155` |

Primary green (`#10B981`) remains consistent across modes.

---

## 12. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 640px | Single column, hidden sidebar, bottom nav |
| Tablet | 640-1024px | Collapsed sidebar, 2-column grid |
| Desktop | > 1024px | Full sidebar, multi-column layouts |

---

## 13. Accessibility

- Color contrast: Minimum 4.5:1 for text
- Focus states: Visible focus rings (green outline)
- Touch targets: Minimum 44x44px on mobile
- Semantic HTML: Proper heading hierarchy
- ARIA labels: For icon-only buttons

---

## Quick Reference: CSS Variables

```css
:root {
  /* Colors */
  --color-primary: #10B981;
  --color-primary-light: #D1FAE5;
  --color-primary-dark: #059669;
  --color-accent: #F97316;
  --color-accent-light: #FED7AA;
  --color-error: #EF4444;
  --color-error-light: #FEE2E2;
  --color-warning: #F59E0B;

  --color-bg: #EFF3F8;
  --color-card: #FFFFFF;
  --color-muted: #E8F5EE;
  --color-border: #CBD5E1;
  --color-text: #1E293B;
  --color-text-secondary: #64748B;
  --color-text-muted: #94A3B8;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.12), 0 2px 4px -1px rgba(16,185,129,0.04);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(16,185,129,0.05);
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(16,185,129,0.03);

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

---

*Last updated: January 2026*
