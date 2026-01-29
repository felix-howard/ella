/**
 * ReturningClientSection - Shows when an existing client is found during new client creation
 * Displays previous engagement history and offers copy-from-previous option
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserCheck, Copy, Eye, Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalDescription, Button } from '@ella/ui'
import { api, type EngagementCopyPreview } from '../../lib/api-client'

interface ReturningClientSectionProps {
  client: {
    id: string
    name: string
    phone: string
  }
  selectedTaxYear: number
  onCopyFromPrevious: (engagementId: string | null, shouldCopy: boolean) => void
}

// Status display config
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang xử lý',
  COMPLETE: 'Hoàn thành',
  ARCHIVED: 'Lưu trữ',
}

export function ReturningClientSection({
  client,
  selectedTaxYear,
  onCopyFromPrevious,
}: ReturningClientSectionProps) {
  const [copyFromPrevious, setCopyFromPrevious] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null)

  // Fetch client's engagements
  const { data, isLoading } = useQuery({
    queryKey: ['engagements', client.id],
    queryFn: () => api.engagements.list({ clientId: client.id, limit: 10 }),
  })

  const engagements = data?.data ?? []
  const latestEngagement = engagements[0]

  // Check if engagement already exists for selected year
  const existingEngagement = engagements.find((e) => e.taxYear === selectedTaxYear)

  if (isLoading) {
    return (
      <div className="p-4 bg-primary-light rounded-lg border border-primary/30">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Đang kiểm tra lịch sử...</span>
        </div>
      </div>
    )
  }

  // Show warning if engagement already exists for this year
  if (existingEngagement) {
    return (
      <div className="p-4 bg-warning-light rounded-lg border border-warning/30">
        <div className="flex items-center gap-2 text-warning-dark">
          <UserCheck className="w-5 h-5" />
          <span className="font-medium">Khách hàng đã có hồ sơ năm {selectedTaxYear}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {client.name} đã có engagement cho năm thuế {selectedTaxYear}.
          Vui lòng chọn năm khác hoặc mở hồ sơ hiện có.
        </p>
      </div>
    )
  }

  const handleCopyChange = (checked: boolean) => {
    setCopyFromPrevious(checked)
    if (checked && latestEngagement) {
      setSelectedEngagementId(latestEngagement.id)
      onCopyFromPrevious(latestEngagement.id, true)
    } else {
      setSelectedEngagementId(null)
      onCopyFromPrevious(null, false)
    }
  }

  return (
    <div className="p-4 bg-primary-light rounded-lg border border-primary/30">
      <div className="flex items-center gap-2 text-primary mb-3">
        <UserCheck className="w-5 h-5" />
        <span className="font-medium">Khách hàng cũ</span>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        <strong>{client.name}</strong> đã sử dụng dịch vụ trước đó.
        {engagements.length > 0 && (
          <span> Có {engagements.length} năm thuế trong hệ thống.</span>
        )}
      </p>

      {/* Previous engagements list */}
      {engagements.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Lịch sử khai thuế:</p>
          <div className="space-y-1">
            {engagements.slice(0, 3).map((eng) => (
              <div
                key={eng.id}
                className="flex items-center justify-between px-3 py-2 bg-background rounded border border-border text-sm"
              >
                <span className="font-medium">{eng.taxYear}</span>
                <span className="text-muted-foreground">
                  {eng.filingStatus || 'Chưa có thông tin'} • {STATUS_LABELS[eng.status] || eng.status}
                </span>
              </div>
            ))}
            {engagements.length > 3 && (
              <p className="text-xs text-muted-foreground text-center py-1">
                +{engagements.length - 3} năm khác
              </p>
            )}
          </div>
        </div>
      )}

      {/* Copy from previous option */}
      {latestEngagement && (
        <div className="border-t border-primary/20 pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={copyFromPrevious}
              onChange={(e) => handleCopyChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Sao chép thông tin từ năm {latestEngagement.taxYear}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                Tự động điền thông tin thu nhập, khấu trừ từ năm trước
              </p>
            </div>
          </label>

          {copyFromPrevious && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Eye className="w-4 h-4" />
              Xem trước thông tin sẽ được sao chép
            </button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedEngagementId && (
        <CopyPreviewModal
          engagementId={selectedEngagementId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

// Copy preview modal
interface CopyPreviewModalProps {
  engagementId: string
  onClose: () => void
}

function CopyPreviewModal({ engagementId, onClose }: CopyPreviewModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['engagement-copy-preview', engagementId],
    queryFn: () => api.engagements.copyPreview(engagementId),
  })

  const preview = data?.data

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>
        <ModalTitle>Xem trước thông tin sao chép</ModalTitle>
        <ModalDescription>
          Các thông tin sau sẽ được sao chép sang năm thuế mới
        </ModalDescription>
      </ModalHeader>

      <div className="p-4 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : preview ? (
          <PreviewContent preview={preview} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Không có dữ liệu để hiển thị
          </p>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <Button onClick={onClose} className="w-full">
          Đóng
        </Button>
      </div>
    </Modal>
  )
}

function PreviewContent({ preview }: { preview: EngagementCopyPreview }) {
  const fields = [
    { key: 'filingStatus', label: 'Tình trạng hôn nhân', value: preview.filingStatus },
    { key: 'hasW2', label: 'Có W2', value: preview.hasW2 ? 'Có' : 'Không' },
    { key: 'hasSelfEmployment', label: 'Tự kinh doanh', value: preview.hasSelfEmployment ? 'Có' : 'Không' },
    { key: 'hasRentalProperty', label: 'Bất động sản cho thuê', value: preview.hasRentalProperty ? 'Có' : 'Không' },
    { key: 'hasInvestments', label: 'Có đầu tư', value: preview.hasInvestments ? 'Có' : 'Không' },
    { key: 'hasKidsUnder17', label: 'Con dưới 17', value: preview.hasKidsUnder17 ? 'Có' : 'Không' },
    { key: 'numKidsUnder17', label: 'Số con dưới 17', value: preview.numKidsUnder17?.toString() ?? '0' },
    { key: 'businessName', label: 'Tên doanh nghiệp', value: preview.businessName },
    { key: 'ein', label: 'EIN', value: preview.ein },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '0' && f.value !== 'Không')

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Không có thông tin để sao chép
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div
          key={field.key}
          className="flex items-center justify-between py-2 border-b border-border last:border-0"
        >
          <span className="text-sm text-muted-foreground">{field.label}</span>
          <span className="text-sm font-medium text-foreground">{field.value}</span>
        </div>
      ))}
    </div>
  )
}
