/**
 * Client Notes Editor - Rich text editor with Tiptap and auto-save
 * Features: bold, italic, lists, links, debounced auto-save
 */
import { useState, useCallback, useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebouncedCallback } from 'use-debounce'
import { useTranslation } from 'react-i18next'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  RemoveFormatting,
  Loader2,
  Check,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'

interface ClientNotesEditorProps {
  clientId: string
  initialContent: string | null
  canEdit?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export function ClientNotesEditor({
  clientId,
  initialContent,
  canEdit = true,
}: ClientNotesEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const saveMutation = useMutation({
    mutationFn: (notes: string) => api.clients.updateNotes(clientId, notes),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved')
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
    onError: () => {
      toast.error(t('clientNotes.saveFailed'))
      setSaveStatus('idle')
    },
  })

  const debouncedSave = useDebouncedCallback((html: string) => {
    saveMutation.mutate(html)
  }, 1500)

  const handleUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      if (canEdit) {
        debouncedSave(editor.getHTML())
      }
    },
    [canEdit, debouncedSave]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Disable headings for notes
      }),
      Placeholder.configure({
        placeholder: t('clientNotes.placeholder'),
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
    ],
    content: initialContent || '',
    editable: canEdit,
    onUpdate: handleUpdate,
  })

  // Cleanup debounced save on unmount to prevent pending saves after component is gone
  useEffect(() => {
    return () => {
      debouncedSave.cancel()
    }
  }, [debouncedSave])

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">
          {t('clientNotes.title')}
        </h3>
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Toolbar */}
      {canEdit && <NotesToolbar editor={editor} />}

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] text-foreground [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[168px]"
      />
    </div>
  )
}

/**
 * Save status indicator showing saving/saved state
 */
function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const { t } = useTranslation()

  if (status === 'idle') return null

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-xs',
        status === 'saving' && 'text-muted-foreground',
        status === 'saved' && 'text-success'
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('clientNotes.saving')}
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="w-3 h-3" />
          {t('clientNotes.saved')}
        </>
      )}
    </span>
  )
}

/**
 * Toolbar with formatting buttons for the Tiptap editor
 */
function NotesToolbar({ editor }: { editor: Editor | null }) {
  const { t } = useTranslation()

  if (!editor) return null

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt(t('clientNotes.enterUrl'), previousUrl)

    if (url === null) return // Cancelled

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // Security: Only allow http/https protocols to prevent javascript: XSS
    const trimmedUrl = url.trim()
    let formattedUrl: string

    if (/^https?:\/\//i.test(trimmedUrl)) {
      // Valid http/https URL
      formattedUrl = trimmedUrl
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl)) {
      // Other protocol (javascript:, data:, etc.) - block and add https://
      formattedUrl = `https://${trimmedUrl.replace(/^[a-z][a-z0-9+.-]*:/i, '')}`
    } else {
      // No protocol - add https://
      formattedUrl = `https://${trimmedUrl}`
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: formattedUrl }).run()
  }

  return (
    <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title={t('clientNotes.bold')}
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title={t('clientNotes.italic')}
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title={t('clientNotes.bulletList')}
      >
        <List className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title={t('clientNotes.numberedList')}
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive('link')}
        title={t('clientNotes.link')}
      >
        <LinkIcon className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title={t('clientNotes.clearFormatting')}
      >
        <RemoveFormatting className="w-4 h-4" />
      </ToolbarButton>
    </div>
  )
}

/**
 * Individual toolbar button with accessibility support
 */
function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        'p-1.5 rounded hover:bg-muted transition-colors',
        isActive && 'bg-muted text-foreground'
      )}
    >
      {children}
    </button>
  )
}

/**
 * Vertical divider for toolbar sections
 */
function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />
}
