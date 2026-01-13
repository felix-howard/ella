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

interface UIState {
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
        sidebarCollapsed: state.sidebarCollapsed,
        clientViewMode: state.clientViewMode,
      }),
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
