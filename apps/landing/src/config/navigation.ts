/**
 * Shared navigation link definitions used by Navbar and Footer.
 * Single source of truth — update here to change site navigation everywhere.
 */

export interface NavLink {
  href: string;
  label: string;
}

export const navLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/why-ella", label: "Why Ella" },
  { href: "/about", label: "About" },
];

export const legalLinks: NavLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];
