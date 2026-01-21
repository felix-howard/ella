/**
 * Zustand store for UI state management
 * Handles sidebar, view modes, and other UI preferences
 * Uses selectors to prevent unnecessary re-renders
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

// View mode types
export type ClientViewMode = 'kanban' | 'list'
export type Theme = 'light' | 'dark'

// Helper to apply theme class to document
const applyThemeClass = (theme: Theme) => {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
}

interface UIState {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // Client list view
  clientViewMode: ClientViewMode
  setClientViewMode: (mode: ClientViewMode) => void

  // Search
  globalSearch: string
  setGlobalSearch: (search: string) => void

  // Mobile menu
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Theme - default light
      theme: 'light' as Theme,
      setTheme: (theme) => {
        applyThemeClass(theme)
        set({ theme })
      },
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light'
        applyThemeClass(newTheme)
        return { theme: newTheme }
      }),

      // Sidebar - default expanded
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Client view - default kanban
      clientViewMode: 'kanban',
      setClientViewMode: (mode) => set({ clientViewMode: mode }),

      // Search
      globalSearch: '',
      setGlobalSearch: (search) => set({ globalSearch: search }),

      // Mobile menu
      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
    }),
    {
      name: 'ella-ui-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        clientViewMode: state.clientViewMode,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration (page load)
        if (state?.theme) {
          applyThemeClass(state.theme)
        }
      },
    }
  )
)

// Optimized selectors to prevent re-renders
// Use these hooks instead of accessing store directly

export const useSidebarState = () =>
  useUIStore(useShallow((state) => ({
    collapsed: state.sidebarCollapsed,
    toggle: state.toggleSidebar,
    setCollapsed: state.setSidebarCollapsed,
  })))

export const useClientViewState = () =>
  useUIStore(useShallow((state) => ({
    viewMode: state.clientViewMode,
    setViewMode: state.setClientViewMode,
  })))

export const useGlobalSearch = () =>
  useUIStore(useShallow((state) => ({
    search: state.globalSearch,
    setSearch: state.setGlobalSearch,
  })))

export const useMobileMenu = () =>
  useUIStore(useShallow((state) => ({
    open: state.mobileMenuOpen,
    setOpen: state.setMobileMenuOpen,
    toggle: state.toggleMobileMenu,
  })))

export const useTheme = () =>
  useUIStore(useShallow((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
    toggleTheme: state.toggleTheme,
  })))
