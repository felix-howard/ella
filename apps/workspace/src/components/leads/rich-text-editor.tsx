/**
 * Rich Text Editor - Controlled Tiptap editor for campaign form intro content.
 * Toolbar: bold, italic, H2, H3, bullet list, ordered list, link, optional image.
 * Controlled via value/onChange; enforces maxLength guard on text length.
 */
import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useTranslation } from 'react-i18next'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@ella/ui'

const DEFAULT_MAX_LENGTH = 10_000
// Allowed URL schemes for link inserts. Anything else is rejected.
const ALLOWED_URL_SCHEMES = /^(https?:\/\/|mailto:|tel:)/i

interface RichTextEditorProps {
  value: string | null | undefined
  onChange: (html: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
  enableImages?: boolean
  onImageUpload?: (file: File) => Promise<{ src: string; alt?: string }>
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  maxLength = DEFAULT_MAX_LENGTH,
  className,
  enableImages = false,
  onImageUpload,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          class: 'text-primary underline cursor-pointer',
        },
      }),
      ...(enableImages
        ? [
            Image.configure({
              allowBase64: false,
              HTMLAttributes: {
                class: 'rounded-lg border border-border max-w-full',
              },
            }),
          ]
        : []),
    ],
    content: value ?? '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Guard: revert if text length exceeds max. Paste and typing both hit this.
      if (editor.getText().length > maxLength || html.length > maxLength) {
        editor.commands.setContent(value ?? '', { emitUpdate: false })
        return
      }
      // Tiptap emits "<p></p>" for empty docs; normalize to empty string.
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  // Sync external value → editor (e.g. dialog opened with different campaign).
  // Skip when editor already matches to avoid cursor jumps during typing.
  useEffect(() => {
    if (!editor) return
    const incoming = value ?? ''
    const current = editor.getHTML()
    const currentNormalized = current === '<p></p>' ? '' : current
    if (incoming !== currentNormalized) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <div
      className={cn(
        'rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
    >
      <Toolbar editor={editor} enableImages={enableImages} onImageUpload={onImageUpload} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 min-h-[140px] text-foreground [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror_img]:my-3 [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg"
      />
    </div>
  )
}

function Toolbar({
  editor,
  enableImages,
  onImageUpload,
}: {
  editor: Editor | null
  enableImages: boolean
  onImageUpload?: (file: File) => Promise<{ src: string; alt?: string }>
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href ?? ''
    const input = window.prompt(t('leads.rte.enterUrl'), previous)
    if (input === null) return // cancelled

    const url = input.trim()
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // Only allow safe schemes; reject javascript:, data:, etc.
    if (!ALLOWED_URL_SCHEMES.test(url)) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertImage = () => {
    fileInputRef.current?.click()
  }

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !onImageUpload) return

    setIsUploadingImage(true)
    try {
      const uploaded = await onImageUpload(file)
      editor
        .chain()
        .focus()
        .setImage({ src: uploaded.src, alt: uploaded.alt ?? file.name, title: uploaded.alt ?? file.name })
        .run()
    } finally {
      setIsUploadingImage(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30 rounded-t-lg">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title={t('leads.rte.bold')}
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title={t('leads.rte.italic')}
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title={t('leads.rte.heading2')}
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title={t('leads.rte.heading3')}
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title={t('leads.rte.bulletList')}
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title={t('leads.rte.orderedList')}
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive('link')}
        title={t('leads.rte.link')}
      >
        <LinkIcon className="w-4 h-4" />
      </ToolbarButton>
      {enableImages && (
        <>
          <ToolbarButton
            onClick={insertImage}
            isActive={editor.isActive('image')}
            title={isUploadingImage ? t('common.loading') : t('leads.rte.image')}
            disabled={isUploadingImage || !onImageUpload}
          >
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageFileChange}
          />
        </>
      )}
    </div>
  )
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  disabled,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded-md hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        isActive && 'bg-muted text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />
}
