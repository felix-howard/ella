/**
 * FileActionDropdown - Context menu for file actions in Files Tab
 * Actions: Rename, Open in New Tab, Download, Move to Category (submenu), Delete
 * Uses nested submenu pattern like Windows File Explorer
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  MoreVertical,
  Pencil,
  Download,
  ExternalLink,
  FolderInput,
  Loader2,
  Check,
  Trash2,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type RawImage, type DocCategory } from '../../lib/api-client'
import { DOC_CATEGORIES, CATEGORY_ORDER, type DocCategoryKey } from '../../lib/doc-categories'
import { toast } from '../../stores/toast-store'
import { useSignedUrl } from '../../hooks/use-signed-url'

export interface FileActionDropdownProps {
  image: RawImage
  caseId: string
  currentCategory?: DocCategoryKey | null
  /** Callback to trigger inline rename mode */
  onRenameClick?: () => void
}

/**
 * Dropdown menu with file actions: rename, open in new tab, download, move to category (submenu), delete
 */
export function FileActionDropdown({
  image,
  caseId,
  currentCategory,
  onRenameClick,
}: FileActionDropdownProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCategorySubmenu, setShowCategorySubmenu] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0, openLeft: false })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const submenuTriggerRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate dropdown position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const dropdownWidth = 220 // Narrower main dropdown
    const dropdownHeight = 200 // Shorter height without inline categories
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Position below the trigger, aligned to the right
    let left = rect.right - dropdownWidth
    // Ensure it doesn't go off-screen to the left
    if (left < 8) left = 8
    // Ensure it doesn't go off-screen to the right
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8
    }

    // Check if dropdown would overflow viewport bottom
    let top = rect.bottom + 4
    if (top + dropdownHeight > viewportHeight - 8) {
      // Position above the trigger instead
      top = rect.top - dropdownHeight - 4
      // If still overflowing top, just position at top of viewport
      if (top < 8) top = 8
    }

    setDropdownPosition({ top, left })
  }, [])

  // Calculate submenu position
  const updateSubmenuPosition = useCallback(() => {
    if (!submenuTriggerRef.current || !dropdownRef.current) return

    const triggerRect = submenuTriggerRef.current.getBoundingClientRect()
    const dropdownRect = dropdownRef.current.getBoundingClientRect()
    const submenuWidth = 200
    const submenuHeight = 280 // Approximate height of category list
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Try to position to the right of the trigger
    let left = dropdownRect.right - 4
    let openLeft = false

    // Check if submenu would overflow right side
    if (left + submenuWidth > viewportWidth - 8) {
      // Open to the left instead
      left = dropdownRect.left - submenuWidth + 4
      openLeft = true
    }

    // Vertical position aligned with the trigger item
    let top = triggerRect.top - 4

    // Check if submenu would overflow bottom
    if (top + submenuHeight > viewportHeight - 8) {
      top = viewportHeight - submenuHeight - 8
    }
    // Check if submenu would overflow top
    if (top < 8) top = 8

    setSubmenuPosition({ top, left, openLeft })
  }, [])

  // Update position on open and scroll
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen, updatePosition])

  // Update submenu position when shown
  useLayoutEffect(() => {
    if (showCategorySubmenu) {
      updateSubmenuPosition()
    }
  }, [showCategorySubmenu, updateSubmenuPosition])

  // Update position when scrolling
  useEffect(() => {
    if (!isOpen) return

    const handleScroll = () => {
      requestAnimationFrame(updatePosition)
      if (showCategorySubmenu) {
        requestAnimationFrame(updateSubmenuPosition)
      }
    }

    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isOpen, showCategorySubmenu, updatePosition, updateSubmenuPosition])

  // Fetch signed URL for download
  const { data: signedUrlData } = useSignedUrl(image.id, {
    enabled: isOpen,
    staleTime: 55 * 60 * 1000,
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as Node
      const clickedTrigger = triggerRef.current?.contains(target)
      const clickedDropdown = dropdownRef.current?.contains(target)
      const clickedSubmenu = submenuRef.current?.contains(target)

      if (!clickedTrigger && !clickedDropdown && !clickedSubmenu) {
        setIsOpen(false)
        setShowCategorySubmenu(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Clean up hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Change category mutation
  const changeCategoryMutation = useMutation({
    mutationFn: (category: DocCategory) => api.images.changeCategory(image.id, category),
    onMutate: async (category) => {
      await queryClient.cancelQueries({ queryKey: ['images', caseId] })
      const previousImages = queryClient.getQueryData(['images', caseId])

      // Optimistic update
      queryClient.setQueryData(
        ['images', caseId],
        (old: { images: RawImage[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            images: old.images.map((img) =>
              img.id === image.id ? { ...img, category } : img
            ),
          }
        }
      )

      return { previousImages }
    },
    onSuccess: (_data, category) => {
      const categoryConfig = DOC_CATEGORIES[category as DocCategoryKey]
      toast.success(t('fileActions.movedToCategory', { category: categoryConfig.label }))
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      setIsOpen(false)
      setShowCategorySubmenu(false)
    },
    onError: (_error, _category, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error(t('fileActions.moveCategoryError'))
    },
  })

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
    setShowCategorySubmenu(false)
  }

  const handleRename = () => {
    setIsOpen(false)
    setShowCategorySubmenu(false)
    onRenameClick?.()
  }

  const handleOpenInNewTab = () => {
    if (!signedUrlData?.url) {
      toast.error(t('fileActions.cannotOpenFile'))
      return
    }

    window.open(signedUrlData.url, '_blank')
    setIsOpen(false)
  }

  const handleDownload = async () => {
    try {
      // Use API proxy endpoint to bypass CORS issues with R2 signed URLs for images
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3002'
      const response = await fetch(`${apiBase}/cases/images/${image.id}/file`, { credentials: 'include' })
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = image.displayName || image.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error(t('fileActions.cannotDownloadFile'))
    }

    setIsOpen(false)
  }

  const handleCategoryChange = (category: DocCategoryKey) => {
    if (category === currentCategory) {
      setIsOpen(false)
      setShowCategorySubmenu(false)
      return
    }
    changeCategoryMutation.mutate(category)
  }

  // Hover handlers for submenu with delay
  const handleCategoryTriggerEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setShowCategorySubmenu(true)
    }, 100) // Small delay to prevent accidental triggers
  }

  const handleCategoryTriggerLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setShowCategorySubmenu(false)
    }, 150) // Delay before hiding to allow moving to submenu
  }

  const handleSubmenuEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
  }

  const handleSubmenuLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setShowCategorySubmenu(false)
    }, 100)
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.images.delete(image.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['images', caseId] })
      const previousImages = queryClient.getQueryData(['images', caseId])

      // Optimistic update - remove image from list
      queryClient.setQueryData(
        ['images', caseId],
        (old: { images: RawImage[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            images: old.images.filter((img) => img.id !== image.id),
          }
        }
      )

      return { previousImages }
    },
    onSuccess: () => {
      toast.success(t('fileActions.fileDeleted'))
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
      setIsOpen(false)
    },
    onError: (_error, _vars, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error(t('fileActions.deleteError'))
    },
  })

  const handleDelete = () => {
    setShowDeleteConfirm(true)
    setIsOpen(false)
    setShowCategorySubmenu(false)
  }

  const confirmDelete = () => {
    deleteMutation.mutate()
    setShowDeleteConfirm(false)
  }

  // Dropdown content rendered in portal
  const dropdownContent = isOpen && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999,
      }}
      className="w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
    >
      {/* Rename - triggers inline edit in row */}
      <button
        onClick={handleRename}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
      >
        <Pencil className="w-4 h-4 text-muted-foreground" />
        {t('fileActions.rename')}
      </button>

      {/* Open in new tab */}
      <button
        onClick={handleOpenInNewTab}
        disabled={!signedUrlData?.url}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
        {t('fileActions.openInNewTab')}
      </button>

      {/* Download */}
      <button
        onClick={handleDownload}
        disabled={!signedUrlData?.url}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4 text-muted-foreground" />
        {t('fileActions.download')}
      </button>

      {/* Move to Category - shows submenu on hover */}
      <div
        ref={submenuTriggerRef}
        onMouseEnter={handleCategoryTriggerEnter}
        onMouseLeave={handleCategoryTriggerLeave}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer transition-colors',
          showCategorySubmenu ? 'bg-muted' : 'hover:bg-muted'
        )}
      >
        <div className="flex items-center gap-2">
          <FolderInput className="w-4 h-4 text-muted-foreground" />
          {t('fileActions.moveToCategory')}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Delete */}
      <div className="border-t border-border">
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          {t('fileActions.deleteFile')}
        </button>
      </div>
    </div>,
    document.body
  )

  // Category submenu rendered in portal
  const categorySubmenu = isOpen && showCategorySubmenu && createPortal(
    <div
      ref={submenuRef}
      onMouseEnter={handleSubmenuEnter}
      onMouseLeave={handleSubmenuLeave}
      style={{
        position: 'fixed',
        top: submenuPosition.top,
        left: submenuPosition.left,
        zIndex: 10000,
      }}
      className="w-52 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
    >
      {CATEGORY_ORDER.map((categoryKey) => {
        const config = DOC_CATEGORIES[categoryKey]
        const Icon = config.icon
        const isCurrentCategory = categoryKey === currentCategory

        return (
          <button
            key={categoryKey}
            onClick={() => handleCategoryChange(categoryKey)}
            disabled={changeCategoryMutation.isPending}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors',
              isCurrentCategory
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted',
              changeCategoryMutation.isPending && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon className={cn('w-4 h-4', config.textColor)} />
            <span className={isCurrentCategory ? 'font-medium' : ''}>
              {config.label}
            </span>
            {isCurrentCategory && (
              <Check className="w-3.5 h-3.5 ml-auto text-primary" />
            )}
          </button>
        )
      })}
    </div>,
    document.body
  )

  // Delete confirmation modal
  const deleteConfirmModal = showDeleteConfirm && createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[10000]"
        onClick={() => setShowDeleteConfirm(false)}
      />
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-destructive/10">
            <Trash2 className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {t('fileActions.deleteConfirmTitle')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('fileActions.deleteConfirmMessage', { filename: image.displayName || image.filename })}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.delete')}
          </button>
        </div>
      </div>
    </>,
    document.body
  )

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50',
          isOpen && 'bg-muted'
        )}
        aria-label={t('fileActions.fileOptions')}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Dropdown Menu rendered in portal */}
      {dropdownContent}

      {/* Category Submenu rendered in portal */}
      {categorySubmenu}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal}
    </div>
  )
}
