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
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/why-ella", label: "Why Ella" },
];

export const legalLinks: NavLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];
