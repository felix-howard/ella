/**
 * FileActionDropdown - Context menu for file actions in Files Tab
 * Actions: Rename, Download, Move to Category
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MoreVertical,
  Pencil,
  Download,
  FolderInput,
  Loader2,
  Check,
  X,
  Trash2,
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
}

/**
 * Dropdown menu with file actions: rename, download, move to category
 */
export function FileActionDropdown({
  image,
  caseId,
  currentCategory,
}: FileActionDropdownProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newFilename, setNewFilename] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Calculate dropdown position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const dropdownWidth = 288 // w-72 = 18rem = 288px
    const dropdownHeight = 400 // Approximate max height
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

  // Update position on open and scroll
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen, updatePosition])

  // Update position when scrolling
  useEffect(() => {
    if (!isOpen) return

    const handleScroll = () => {
      requestAnimationFrame(updatePosition)
    }

    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isOpen, updatePosition])

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

      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false)
        setIsRenaming(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus input when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: (filename: string) => api.images.rename(image.id, filename),
    onSuccess: () => {
      toast.success('Đã đổi tên tệp')
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      setIsRenaming(false)
      setIsOpen(false)
    },
    onError: () => {
      toast.error('Lỗi đổi tên tệp')
    },
  })

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
      toast.success(`Đã chuyển sang "${categoryConfig.labelVi}"`)
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      setIsOpen(false)
    },
    onError: (_error, _category, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error('Lỗi chuyển danh mục')
    },
  })

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
    setIsRenaming(false)
  }

  const handleRename = () => {
    setNewFilename(image.displayName || image.filename)
    setIsRenaming(true)
  }

  const handleSaveRename = () => {
    const trimmed = newFilename.trim()
    if (!trimmed || trimmed === (image.displayName || image.filename)) {
      setIsRenaming(false)
      return
    }
    renameMutation.mutate(trimmed)
  }

  const handleDownload = () => {
    if (!signedUrlData?.url) {
      toast.error('Không thể tải tệp')
      return
    }

    // Create a temporary link and trigger download
    const link = document.createElement('a')
    link.href = signedUrlData.url
    link.download = image.displayName || image.filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setIsOpen(false)
  }

  const handleCategoryChange = (category: DocCategoryKey) => {
    if (category === currentCategory) {
      setIsOpen(false)
      return
    }
    changeCategoryMutation.mutate(category)
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
      toast.success('Đã xóa tệp')
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
      setIsOpen(false)
    },
    onError: (_error, _vars, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error('Lỗi xóa tệp')
    },
  })

  const handleDelete = () => {
    setShowDeleteConfirm(true)
    setIsOpen(false)
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
      className="w-72 max-h-[calc(100vh-16px)] overflow-y-auto bg-card border border-border rounded-lg shadow-lg"
    >
      {/* Rename Section */}
      {isRenaming ? (
        <div className="p-3 border-b border-border">
          <label className="text-xs text-muted-foreground mb-1.5 block">Tên tệp mới</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename()
                if (e.key === 'Escape') setIsRenaming(false)
              }}
              disabled={renameMutation.isPending}
              className={cn(
                'flex-1 min-w-0 px-3 py-2 text-sm',
                'border border-border rounded-md bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                'disabled:opacity-50'
              )}
              placeholder="Nhập tên tệp..."
            />
            <button
              onClick={handleSaveRename}
              disabled={renameMutation.isPending}
              className="px-3 py-2 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
            >
              {renameMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsRenaming(false)}
              disabled={renameMutation.isPending}
              className="px-3 py-2 rounded-md border border-border hover:bg-muted disabled:opacity-50 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleRename}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
        >
          <Pencil className="w-4 h-4 text-muted-foreground" />
          Đổi tên
        </button>
      )}

      {/* Download */}
      <button
        onClick={handleDownload}
        disabled={!signedUrlData?.url}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4 text-muted-foreground" />
        Tải xuống
      </button>

      {/* Move to Category - inline list instead of submenu */}
      <div className="border-t border-border">
        <div className="px-3 py-2 text-xs text-muted-foreground font-medium flex items-center gap-2">
          <FolderInput className="w-3.5 h-3.5" />
          Chuyển danh mục
        </div>
        <div className="pb-1">
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
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                  isCurrentCategory
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted',
                  changeCategoryMutation.isPending && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className={cn('w-4 h-4', config.textColor)} />
                <span className={isCurrentCategory ? 'font-medium' : ''}>
                  {config.labelVi}
                </span>
                {isCurrentCategory && (
                  <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                )}
              </button>
            )
          })}
        </div>
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
          Xóa tệp
        </button>
      </div>
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
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-destructive/10">
            <Trash2 className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              Xóa tệp?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Bạn có chắc muốn xóa "{image.displayName || image.filename}"? Hành động này không thể hoàn tác.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Xóa
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
        aria-label="Tùy chọn tệp"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Dropdown Menu rendered in portal */}
      {dropdownContent}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal}
    </div>
  )
}
