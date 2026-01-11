# Ella Design System & UI Guidelines

## 1. Overview & Philosophy

**Ella** utilizes a "Soft Modern Fintech" aesthetic inspired by _Vnecs Wallet_. The design philosophy focuses on approachability, clarity, and trust. It balances professional financial operations with a friendly, airy, and clean user interface suitable for non-technical users in the Nail Salon industry.

**Key Visual Keywords:**

- Clean & Airy (High whitespace)
- Rounded & Soft (High border-radius)
- Pastel & Vibrant accents
- Flat structure with subtle elevation

---

## 2. Color Palette

The color system relies on a vibrant primary Teal/Mint for actions and branding, set against a very clean greyscale background.

### Primary Brand Colors

- **Ella Mint (Primary):** `#10B981` (Approx. Tailwind `emerald-500` or `teal-500`) - Used for primary buttons, active states, key icons.
- **Ella Mint Light (Backgrounds):** `#D1FAE5` (Tailwind `emerald-100`) - Used for active navigational items background or light badges.
- **Ella Mint Dark (Hover/Text):** `#047857` (Tailwind `emerald-700`).

### Functional Colors (Status)

- **Danger/Expense:** `#EF4444` (Red) - Used for negative values, errors, "Expense" buttons. Background: `#FEE2E2`.
- **Success/Income:** `#10B981` (Green) - Used for positive values, success toasts.
- **Warning/Pro:** `#F59E0B` (Orange) - Used for alerts or "Pro/Premium" features. Background: `#FEF3C7`.
- **Info/Analysis:** `#8B5CF6` (Purple) - Used for analytics graphs or insights. Background: `#EDE9FE`.

### Neutral Colors

- **Background (App Canvas):** `#F3F4F6` (Cool Gray 100) or `#F9FAFB`. _Crucial: The app background is NOT white, it is off-white._
- **Surface (Cards/Modals):** `#FFFFFF` (Pure White).
- **Text Primary:** `#1F2937` (Gray 800) - Headings, main values.
- **Text Secondary:** `#6B7280` (Gray 500) - Subtitles, captions, placeholders.
- **Borders:** `#E5E7EB` (Gray 200) - Subtle dividers.

---

## 3. Typography

- **Font Family:** System UI Stack (San Francisco, Inter, Roboto, Segoe UI). A clean, sans-serif font is required.
- **Weights:**
  - **Regular (400):** Body text.
  - **Medium (500):** Button text, navigation links, table headers.
  - **Bold (600/700):** Page titles, "Total Balance" numbers, Section headers.

---

## 4. UI Components & Elements

### 4.1. Buttons

- **Primary Button:**
  - Background: Solid **Ella Mint**.
  - Text: White.
  - Radius: Full rounded (Pill shape) or slightly rounded rect (`rounded-xl`).
  - Shadow: Subtle colored shadow (`shadow-md` or `shadow-emerald-500/20`).
- **Secondary/Ghost Button:**
  - Background: Transparent or very light gray.
  - Text: Gray 600 or Mint.
  - Hover: Light Gray background.
- **Floating Action Button (FAB):**
  - Location: Bottom Left or Right (Context dependent).
  - Style: Circular, Primary Color, White Icon (`+`), large shadow.

### 4.2. Cards & Containers (The "Vnecs" Look)

- **Style:** Pure white background on the gray canvas.
- **Border Radius:** Highly rounded corners. Use `16px` to `24px` (`rounded-2xl` or `rounded-3xl` in Tailwind).
- **Shadow:** Very soft, diffuse shadow. Example: `box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05)`.
- **Padding:** Generous internal padding (`p-6` or `24px`).

### 4.3. Inputs & Forms

- **Field:** White background, borders `#E5E7EB` (Gray 200).
- **Radius:** Rounded corners (`12px` or `rounded-xl`).
- **Focus State:** Border color changes to **Ella Mint** with a subtle ring.
- **Labels:** Top aligned, Gray 700, Medium weight.

### 4.4. Navigation (Sidebar)

- **Position:** Fixed Left Sidebar.
- **Background:** White (`#FFFFFF`).
- **Item State (Inactive):** Icon + Text in Gray 500.
- **Item State (Active):**
  - Text: **Ella Mint**.
  - Icon: **Ella Mint**.
  - Background indicator: Light Mint wash (`#ECFDF5`) with a rounded shape (`rounded-r-full` or `rounded-lg`).

### 4.5. Modals / Dialogs

- **Overlay:** Dark backdrop with blur (`backdrop-blur-sm bg-black/30`).
- **Content:** Centered, White background, Large border radius (`rounded-3xl`).
- **Header:** Title left-aligned or centered with a "Close" (X) icon on the right.
- **Footer:** Large, full-width buttons or side-by-side "Cancel" (Gray) and "Confirm" (Primary) buttons.

---

## 5. Layout Patterns

### Dashboard Structure

1.  **Sidebar:** Left, width ~260px. Contains Logo, Nav Menu, and "Upgrade" CTA.
2.  **Top Bar (Header):**
    - Greeting ("Good evening, [Name]").
    - Profile Avatar (Circle).
    - Action buttons (Notifications, Export Report).
3.  **Main Content Area:**
    - Grid-based layout.
    - **Widget 1 (Hero):** Financial Health/Overview (Often with a gradient or progress circle).
    - **Widget 2:** Quick Actions (Row of icon buttons).
    - **Widget 3:** Recent Transactions or Charts.

### Special Visual Details (The "Vnecs" Vibe)

- **Gradients:** Use subtle pastel gradients for premium features (e.g., A card with `bg-gradient-to-br from-orange-100 to-pink-100`).
- **Icons:** Use rounded line-icons (like Heroicons Outline or Tabler Icons).
- **Empty States:** Use centered illustrations with soft colors when no data is available.

---

## 6. CSS / Tailwind Implementation Hints

If using Tailwind CSS, follow these presets to match Vnecs:

```js
// tailwind.config.js snippet
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#10B981", // Emerald 500
          50: "#ECFDF5",
          100: "#D1FAE5",
          600: "#059669",
        },
        background: "#F9FAFB", // Gray 50
      },
      borderRadius: {
        card: "1.5rem", // 24px for main cards
        btn: "0.75rem", // 12px for buttons/inputs
      },
      boxShadow: {
        soft: "0 10px 40px -10px rgba(0,0,0,0.05)",
      },
    },
  },
};
```
