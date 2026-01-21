/**
 * Document Type Library Configuration Tab
 * Staff-facing document recognition library management
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, Button, Input } from '@ella/ui'
import { cn } from '@ella/ui'
import { api, type DocTypeLibraryItem } from '../../lib/api-client'
import { DocTypeModal } from './doc-type-modal'

const CATEGORY_LABELS: Record<string, string> = {
  personal: 'Cá nhân',
  income: 'Thu nhập',
  health: 'Sức khỏe',
  education: 'Giáo dục',
  deductions: 'Khấu trừ',
  business: 'Kinh doanh',
  prior_year: 'Năm trước',
  crypto: 'Crypto',
  foreign: 'Nước ngoài',
  other: 'Khác',
}

export function DocLibraryConfigTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDocType, setEditingDocType] = useState<DocTypeLibraryItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'doc-type-library', filterCategory, searchTerm],
    queryFn: () =>
      api.admin.docTypeLibrary.list({
        category: filterCategory !== 'all' ? filterCategory : undefined,
        search: searchTerm || undefined,
      }),
  })

  const docTypes = data?.data || []

  // Get unique categories
  const categories = [...new Set(docTypes.map((d) => d.category))].sort()

  const handleAdd = () => {
    setEditingDocType(null)
    setIsModalOpen(true)
  }

  const handleEdit = (docType: DocTypeLibraryItem) => {
    setEditingDocType(docType)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingDocType(null)
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo code, tên, alias..."
            className="pl-10"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-foreground"
        >
          <option value="all">Tất cả danh mục</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat] || cat}
            </option>
          ))}
        </select>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{docTypes.length} loại tài liệu</p>
        <Button size="sm" className="gap-1.5" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
          Thêm loại mới
        </Button>
      </div>

      {/* Doc Types List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : docTypes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Không tìm thấy loại tài liệu nào
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docTypes.map((docType) => (
            <DocTypeCard key={docType.id} docType={docType} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <DocTypeModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        docType={editingDocType}
      />
    </div>
  )
}

interface DocTypeCardProps {
  docType: DocTypeLibraryItem
  onEdit: (docType: DocTypeLibraryItem) => void
}

function DocTypeCard({ docType, onEdit }: DocTypeCardProps) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () =>
      api.admin.docTypeLibrary.update(docType.id, { isActive: !docType.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'doc-type-library'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.admin.docTypeLibrary.delete(docType.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'doc-type-library'] })
    },
  })

  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        !docType.isActive && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{docType.labelVi}</span>
            {!docType.isActive && (
              <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                Tắt
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{docType.labelEn}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleMutation.mutate()}
            className="p-1 rounded hover:bg-muted transition-colors"
            title={docType.isActive ? 'Tắt' : 'Bật'}
            disabled={toggleMutation.isPending}
          >
            {docType.isActive ? (
              <ToggleRight className="w-4 h-4 text-primary" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => onEdit(docType)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Chỉnh sửa"
          >
            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => {
              if (confirm('Bạn có chắc muốn xóa loại tài liệu này?')) {
                deleteMutation.mutate()
              }
            }}
            className="p-1 rounded hover:bg-error/10 transition-colors"
            title="Xóa"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-3.5 h-3.5 text-error" />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded font-mono">
            {docType.code}
          </span>
          <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
            {CATEGORY_LABELS[docType.category] || docType.category}
          </span>
        </div>

        {docType.aliases.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {docType.aliases.slice(0, 3).map((alias, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-xs bg-muted/50 text-muted-foreground rounded"
              >
                {alias}
              </span>
            ))}
            {docType.aliases.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{docType.aliases.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
