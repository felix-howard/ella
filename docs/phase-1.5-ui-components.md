# Phase 1.5: Shared UI Components - Detailed Reference

**Last Updated:** 2026-01-13
**Status:** Completed (First Half + Second Half)

## Overview

Comprehensive shared UI component library for the Ella platform. All components follow the Ella design system (mint green primary, coral accent, rounded corners) and use Tailwind CSS + class-variance-authority.

## Component Inventory

### First Half Components

#### 1. Card Component (`packages/ui/src/components/card.tsx`)

**Purpose:** Container component for grouping content sections

**Variants:**
- `default` - Light background with border
- `elevated` - Lifted shadow effect
- `flat` - Minimal styling
- `feature` - Prominent display variant

**Padding Options:** none, sm, default, lg

**Sub-components:**
- `CardHeader` - Top section for titles
- `CardTitle` - Semantic heading
- `CardDescription` - Subtitle/secondary text
- `CardContent` - Main content area
- `CardFooter` - Bottom section for actions

**Usage:**
```tsx
<Card variant="elevated" padding="default">
  <CardHeader>
    <CardTitle>Client Information</CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
  <CardFooter>
    {/* actions */}
  </CardFooter>
</Card>
```

#### 2. Input Component (`packages/ui/src/components/input.tsx`)

**Purpose:** Form input field with validation support

**Variants:** default, error, ghost
**Sizes:** sm (h-8), default (h-10), lg (h-12)

**Features:**
- Focus ring with focus:ring-2
- Error variant with red border
- Ghost variant for borderless display
- All standard HTML input attributes

**InputField Wrapper:**
- Label with htmlFor linking
- Error message display (red text)
- Hint text (muted foreground)
- Auto-variant switching based on error state

**Usage:**
```tsx
<InputField
  label="Email"
  type="email"
  placeholder="user@example.com"
  error={errors.email}
  hint="We'll use this to send updates"
/>
```

#### 3. Select Component (`packages/ui/src/components/select.tsx`)

**Purpose:** Dropdown selector for form fields

**Variants:** default, error
**Sizes:** sm (h-8), default (h-10), lg (h-12)

**Features:**
- Native HTML select element
- ChevronDown icon indicator
- Option array or children rendering
- Placeholder support

**SelectField Wrapper:**
- Label, error, hint support
- Auto-variant on error

**Usage:**
```tsx
<SelectField
  label="Tax Type"
  options={[
    { value: '1040', label: 'Form 1040' },
    { value: '1120s', label: 'Form 1120-S' }
  ]}
  error={errors.taxType}
/>
```

#### 4. Badge Component (`packages/ui/src/components/badge.tsx`)

**Purpose:** Status/tag display component

**Variants:** default, secondary, outline, success, error, warning, accent
**Sizes:** sm (text-[10px]), default (text-xs), lg (text-sm)
**Shapes:** rounded-full (default), rounded-md

**StatusBadge Sub-component:**

Maps 13 status types to automatic variants:
- **Data States:** missing, has_raw, has_digital, verified
- **Process States:** uploaded, classified, linked, extracted
- **Error/Quality:** blurry, partial, failed
- **Progress:** pending, in_progress, complete

**Status Mapping:**
| Status | Variant |
|--------|---------|
| verified, complete | success (green) |
| missing, blurry, failed | error (red) |
| partial, has_raw, in_progress | warning (orange) |
| Others | secondary (gray) |

**Usage:**
```tsx
<StatusBadge status="verified" />
<Badge variant="success" size="lg">Active</Badge>
```

### Second Half Components

#### 5. Modal Component (`packages/ui/src/components/modal.tsx`)

**Purpose:** Dialog modal for content overlay

**Features:**
- Native HTML dialog element
- Backdrop blur effect
- ARIA attributes (role, aria-modal, aria-labelledby)
- Escape key handler for dismiss
- Focus trap
- Full-screen centered layout

**Sub-components:**
- `ModalHeader` - Title area
- `ModalTitle` - Heading text
- `ModalDescription` - Optional subtitle
- `ModalContent` - Main content
- `ModalFooter` - Action buttons

**Usage:**
```tsx
<Modal isOpen={isOpen} onClose={handleClose}>
  <ModalHeader>
    <ModalTitle>Confirm Action</ModalTitle>
  </ModalHeader>
  <ModalContent>Are you sure?</ModalContent>
  <ModalFooter>
    <Button onClick={handleClose}>Cancel</Button>
    <Button variant="destructive">Delete</Button>
  </ModalFooter>
</Modal>
```

#### 6. Tabs Component (`packages/ui/src/components/tabs.tsx`)

**Purpose:** Tabbed content interface

**Variants:** pill (rounded buttons), underline (border-bottom)
**Sizes:** default, compact

**Features:**
- Keyboard navigation: Left/Right arrow keys switch tabs
- aria-selected for accessibility
- Tab focus management
- Disabled tab support
- ID-based content panel linking

**Usage:**
```tsx
<TabsContainer activeTab="overview" onTabChange={setActiveTab}>
  <TabsList>
    <Tab id="overview">Overview</Tab>
    <Tab id="documents">Documents</Tab>
  </TabsList>
  <TabPanel id="overview">
    {/* content */}
  </TabPanel>
  <TabPanel id="documents">
    {/* content */}
  </TabPanel>
</TabsContainer>
```

#### 7. Avatar Component (`packages/ui/src/components/avatar.tsx`)

**Purpose:** User profile picture display

**Features:**
- Image support with fallback to initials
- Auto-generated initials from name (first + last letter)
- Size variants: xs (20px), sm (32px), default (40px), lg (48px), xl (64px)
- Circular display (rounded-full)
- Color-assigned backgrounds for initials

**AvatarGroup Sub-component:**
- Stacked/overlapping avatar display
- Ring border for separation
- Max display count with "+N" indicator

**Usage:**
```tsx
<Avatar name="John Doe" src={imageUrl} size="lg" />
<AvatarGroup>
  <Avatar name="John Doe" />
  <Avatar name="Jane Smith" />
  <Avatar name="+2 more" />
</AvatarGroup>
```

#### 8. Progress Component (`packages/ui/src/components/progress.tsx`)

**Purpose:** Visual progress indication

**ProgressBar (Linear):**
- Variants: default (pill), flat (minimal), striped (animated)
- Sizes: sm, default, lg
- Percentage-based fill animation
- Optional label + percentage text
- Background + foreground colors

**CircularProgress (Radial):**
- Variants: default, outlined, fill
- Sizes: sm (48px), default (64px), lg (96px)
- Center text label/percentage
- SVG-based smooth animation
- Color variant support

**Usage:**
```tsx
<ProgressBar value={65} label="Upload Progress" />
<CircularProgress value={75} label="75%" size="lg" />
```

#### 9. Tooltip Component (`packages/ui/src/components/tooltip.tsx`)

**Purpose:** Context help floating label

**Features:**
- Position options: top, right, bottom, left
- Auto-position to prevent viewport overflow
- Delay control (openDelay, closeDelay)
- Arrow pointer indicator
- Dark background with white text
- Portal-based rendering (z-index management)
- Escape key to close

**Usage:**
```tsx
<Tooltip content="Click to upload" position="top" delay={500}>
  <button>Upload</button>
</Tooltip>
```

#### 10. Icons Component (`packages/ui/src/components/icons/index.tsx`)

**Purpose:** Centralized Lucide icon exports

**Icon Categories:**

| Category | Icons |
|----------|-------|
| **Navigation** | Menu, Home, Settings, LogOut, User |
| **Common** | ChevronDown, ChevronUp, ChevronLeft, ChevronRight |
| **Actions** | Plus, Minus, X, Check, Edit, Copy, Trash |
| **Status** | AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2 |
| **Files** | FileText, Image, Camera, Upload, Download, Folder |
| **Business** | DollarSign, TrendingUp, Calendar, Bell, MessageSquare |
| **Utility** | HelpCircle, Eye, EyeOff, Search, Grid, List |

**Total:** ~50 commonly used icons

**Usage:**
```tsx
import { ChevronDown, Upload, AlertCircle } from '@ella/ui'

<ChevronDown size={20} />
<Upload className="text-primary" />
<AlertCircle className="text-error" />
```

## Architecture Patterns

### Component Design

Each component family follows:

1. **Base Component** - Unstyled/minimal styling for flexibility
2. **CVA Variants** - Via class-variance-authority for type safety
3. **Field Wrapper** (optional) - InputField, SelectField, StatusBadge
4. **ForwardRef** - Proper DOM element access
5. **TypeScript Types** - Extending HTML attributes

### Accessibility

- Semantic HTML (Input, Select use native elements)
- ARIA attributes (aria-selected, aria-modal, role)
- Focus states with visible rings (focus:ring-2)
- Label htmlFor linking for form controls
- Keyboard navigation support (Tab, Arrow keys, Escape)

### Design System Integration

- **Colors:** Primary (mint), Accent (coral), Success (green), Error (red), Warning (orange)
- **Spacing:** Consistent px-1 to px-8 scale
- **Corners:** Rounded-md to rounded-full (mint aesthetic)
- **Typography:** -sm to -lg size variants
- **Transitions:** Smooth duration-200 transitions
- **Dark Mode:** Full support via Tailwind dark: prefix

## Integration Guide

### Import Patterns

```tsx
// Individual imports
import { Button, Card, Input, Modal } from '@ella/ui'
import { Upload, AlertCircle } from '@ella/ui'

// With variants
import { Input, inputVariants } from '@ella/ui'
import { Badge, badgeVariants } from '@ella/ui'
```

### Usage Locations

| App/Package | Primary Use |
|-------------|-------------|
| **@ella/portal** | Card, Badge, Button, Input, Icons |
| **@ella/workspace** | All components (modal, tabs, avatar for UI) |
| **@ella/shared** | Form components (Input/Select/Button) |

### Common Patterns

**Form Group:**
```tsx
<div className="space-y-4">
  <InputField label="Name" />
  <SelectField label="Status" />
  <Button>Submit</Button>
</div>
```

**Status Display:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Document Status</CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    <StatusBadge status="verified" />
    <StatusBadge status="pending" />
  </CardContent>
</Card>
```

**Modal Dialog:**
```tsx
<Modal isOpen={open} onClose={setOpen}>
  <ModalHeader>
    <ModalTitle>Confirm Deletion</ModalTitle>
  </ModalHeader>
  <ModalContent>This action cannot be undone.</ModalContent>
  <ModalFooter>
    <Button onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="destructive">Delete</Button>
  </ModalFooter>
</Modal>
```

## Component Statistics

| Metric | Count |
|--------|-------|
| Total Components | 11 |
| Base Components | 10 |
| Field Wrappers | 3 |
| Total Variants | 80+ |
| Icon Exports | ~50 |
| Lines of Code | ~1,200 |

## Dependencies

- **tailwindcss:** ^4.0.0 - CSS styling
- **class-variance-authority** - Variant management
- **clsx + tailwind-merge** - Class utilities
- **lucide-react** - Icon library
- **@radix-ui/react-primitive** - Accessible primitives

## Next Steps

### Phase 1.6 (Planned)

- Dropdown menu component (searchable)
- Accordion component (collapsible sections)
- Breadcrumb component (navigation path)
- Pagination component (list navigation)
- Skeleton loaders (loading states)

### Integration Areas

- **Forms:** Input/Select field validation UI
- **Modals:** Confirmation dialogs, data entry
- **Navigation:** Tab switching, breadcrumbs
- **Feedback:** Progress indicators, tooltips
- **Lists:** Avatar groups, status badges

---

**Maintained By:** Documentation Manager
**Last Review:** 2026-01-13
**Next Review:** 2026-01-20
