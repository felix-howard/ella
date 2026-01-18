/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Documents | Messages accessible via header button
 */

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  User,
  Pencil,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Loader2,
  Link2,
} from 'lucide-react'
import { toast } from '../../stores/toast-store'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { DocumentChecklistTree, StatusSelector, calculateChecklistProgress, ProgressDots } from '../../components/cases'
import { DocumentWorkflowTabs, ClassificationReviewModal, ManualClassificationModal, UploadProgress, VerificationModal, DataEntryModal, ReUploadRequestModal } from '../../components/documents'
import { useClassificationUpdates } from '../../hooks/use-classification-updates'
import {
  TAX_TYPE_LABELS,
  FILING_STATUS_LABELS,
  LANGUAGE_LABELS,
  UI_TEXT,
} from '../../lib/constants'
import { formatPhone, getInitials, copyToClipboard, getAvatarColor } from '../../lib/formatters'
import { api, type TaxCaseStatus, type RawImage, type DigitalDoc } from '../../lib/api-client'

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
})

type TabType = 'overview' | 'documents'

function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [reviewImage, setReviewImage] = useState<RawImage | null>(null)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [classifyImage, setClassifyImage] = useState<RawImage | null>(null)
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [verifyDoc, setVerifyDoc] = useState<DigitalDoc | null>(null)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [dataEntryDoc, setDataEntryDoc] = useState<DigitalDoc | null>(null)
  const [isDataEntryModalOpen, setIsDataEntryModalOpen] = useState(false)
  const [reuploadImage, setReuploadImage] = useState<RawImage | null>(null)
  const [reuploadFields, setReuploadFields] = useState<string[]>([])
  const [isReuploadModalOpen, setIsReuploadModalOpen] = useState(false)

  // Mutation for moving image to different checklist item (drag & drop)
  const moveImageMutation = useMutation({
    mutationFn: async ({ imageId, targetChecklistItemId }: { imageId: string; targetChecklistItemId: string }) => {
      const response = await fetch(`/api/images/${imageId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetChecklistItemId }),
      })
      if (!response.ok) throw new Error('Move failed')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Đã di chuyển ảnh thành công')
      queryClient.invalidateQueries({ queryKey: ['checklist', latestCaseId] })
      queryClient.invalidateQueries({ queryKey: ['images', latestCaseId] })
    },
    onError: () => {
      toast.error('Lỗi khi di chuyển ảnh')
    },
  })

  // Fetch client detail from API
  const {
    data: client,
    isLoading: isClientLoading,
    isError: isClientError,
    error: clientError,
    refetch: refetchClient,
  } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.clients.get(clientId),
  })

  // Get the latest case ID for fetching case-related data
  const latestCaseId = client?.taxCases?.[0]?.id

  // Fetch checklist for the latest case
  const { data: checklistResponse } = useQuery({
    queryKey: ['checklist', latestCaseId],
    queryFn: () => api.cases.getChecklist(latestCaseId!),
    enabled: !!latestCaseId,
  })

  // Fetch unread count for the specific case
  const { data: unreadData, isLoading: isUnreadLoading, isError: isUnreadError } = useQuery({
    queryKey: ['unread-count', latestCaseId],
    queryFn: () => api.messages.getUnreadCount(latestCaseId!),
    enabled: !!latestCaseId,
    staleTime: 30000, // Cache for 30s
  })
  const unreadCount = unreadData?.unreadCount ?? 0

  // Fetch raw images for the latest case
  const { data: imagesResponse } = useQuery({
    queryKey: ['images', latestCaseId],
    queryFn: () => api.cases.getImages(latestCaseId!),
    enabled: !!latestCaseId,
  })

  // Fetch digital docs for the latest case
  const { data: docsResponse } = useQuery({
    queryKey: ['docs', latestCaseId],
    queryFn: () => api.cases.getDocs(latestCaseId!),
    enabled: !!latestCaseId,
  })

  // Enable polling for real-time classification updates when on documents tab
  const isDocumentsTab = activeTab === 'documents'
  const { images: polledImages, docs: polledDocs, processingCount, extractingCount } = useClassificationUpdates({
    caseId: latestCaseId,
    enabled: isDocumentsTab,
    refetchInterval: 5000,
  })

  // Loading state
  if (isClientLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Đang tải thông tin khách hàng...</p>
        </div>
      </PageContainer>
    )
  }

  // Error state
  if (isClientError || !client) {
    return (
      <PageContainer>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Quay lại danh sách</span>
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Không tìm thấy khách hàng</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {clientError instanceof Error ? clientError.message : 'Khách hàng này không tồn tại hoặc đã bị xóa'}
          </p>
          <button
            onClick={() => refetchClient()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      </PageContainer>
    )
  }

  const checklistItems = checklistResponse?.items ?? []
  // Use polled images when on documents tab for real-time updates
  const rawImages = isDocumentsTab && polledImages.length > 0
    ? polledImages
    : (imagesResponse?.images ?? [])
  // Use polled docs when on documents tab for real-time updates
  const digitalDocs = isDocumentsTab
    ? polledDocs
    : (docsResponse?.docs ?? [])

  const latestCase = client.taxCases[0]
  const caseStatus = latestCase?.status as TaxCaseStatus

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  // Handler for opening classification review modal
  const handleReviewClassification = (image: RawImage) => {
    setReviewImage(image)
    setIsReviewModalOpen(true)
  }

  const handleCloseReviewModal = () => {
    setIsReviewModalOpen(false)
    // Small delay before clearing to avoid flash
    setTimeout(() => setReviewImage(null), 200)
  }

  // Handler for opening manual classification modal
  const handleManualClassify = (image: RawImage) => {
    setClassifyImage(image)
    setIsClassifyModalOpen(true)
  }

  const handleCloseClassifyModal = () => {
    setIsClassifyModalOpen(false)
    // Small delay before clearing to avoid flash
    setTimeout(() => setClassifyImage(null), 200)
  }

  // Handler for opening verification modal
  const handleVerifyDoc = (doc: DigitalDoc) => {
    setVerifyDoc(doc)
    setIsVerifyModalOpen(true)
  }

  const handleCloseVerifyModal = () => {
    setIsVerifyModalOpen(false)
    // Small delay before clearing to avoid flash
    setTimeout(() => setVerifyDoc(null), 200)
  }

  // Handler for re-upload request from verification modal
  const handleRequestReupload = (doc: DigitalDoc, unreadableFields: string[]) => {
    // Find the raw image associated with this doc
    const rawImage = rawImages.find(img => img.id === doc.rawImageId)
    if (rawImage) {
      setReuploadImage(rawImage)
      setReuploadFields(unreadableFields)
      setIsReuploadModalOpen(true)
    }
  }

  const handleCloseReuploadModal = () => {
    setIsReuploadModalOpen(false)
    setTimeout(() => {
      setReuploadImage(null)
      setReuploadFields([])
    }, 200)
  }

  // Handler for data entry modal
  const handleDataEntry = (doc: DigitalDoc) => {
    setDataEntryDoc(doc)
    setIsDataEntryModalOpen(true)
  }

  const handleCloseDataEntryModal = () => {
    setIsDataEntryModalOpen(false)
    setTimeout(() => setDataEntryDoc(null), 200)
  }

  const { clients: clientsText } = UI_TEXT
  const avatarColor = getAvatarColor(client.name)
  const tabs: { id: TabType; label: string; icon: typeof User }[] = [
    { id: 'overview', label: clientsText.tabs.overview, icon: User },
    { id: 'documents', label: clientsText.tabs.documents, icon: FileText },
  ]

  return (
    <PageContainer>
      {/* Back Button & Header */}
      <div className="mb-6">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{clientsText.backToList}</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0',
              avatarColor.bg,
              avatarColor.text
            )}>
              <span className="font-bold text-xl">
                {getInitials(client.name)}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-foreground">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" aria-hidden="true" />
                  {formatPhone(client.phone)}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {client.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  {UI_TEXT.form.taxYear} {latestCase?.taxYear || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-2">
            {/* Case Status Selector */}
            {latestCase && (
              <StatusSelector
                caseId={latestCase.id}
                currentStatus={caseStatus}
                onStatusChange={() => {
                  // Refetch client data to update UI
                  queryClient.invalidateQueries({ queryKey: ['client', clientId] })
                }}
              />
            )}

            {/* Portal Link - Open button only */}
            {client.portalUrl && (
              <a
                href={client.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                title="Mở link portal"
              >
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Portal</span>
              </a>
            )}

            {/* Message Button with Unread Badge */}
            {latestCaseId && (
              <Link
                to="/messages/$caseId"
                params={{ caseId: latestCaseId }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tin nhắn</span>
                {isUnreadLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                ) : !isUnreadError && unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-destructive text-white rounded-full min-w-[1.25rem] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <button
              className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label={UI_TEXT.edit}
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-1" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Profile Info Card */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">{clientsText.personalInfo}</h2>
            <div className="space-y-3">
              <InfoRow
                label={UI_TEXT.form.clientName}
                value={client.name}
                onCopy={() => handleCopy(client.name, 'name')}
                copied={copiedField === 'name'}
              />
              <InfoRow
                label={UI_TEXT.form.phone}
                value={formatPhone(client.phone)}
                onCopy={() => handleCopy(client.phone, 'phone')}
                copied={copiedField === 'phone'}
              />
              {client.email && (
                <InfoRow
                  label={UI_TEXT.form.email}
                  value={client.email}
                  onCopy={() => handleCopy(client.email!, 'email')}
                  copied={copiedField === 'email'}
                />
              )}
              <InfoRow
                label={UI_TEXT.form.language}
                value={LANGUAGE_LABELS[client.language]}
              />
              {client.profile?.filingStatus && (
                <InfoRow
                  label={UI_TEXT.form.filingStatus}
                  value={FILING_STATUS_LABELS[client.profile.filingStatus] || client.profile.filingStatus}
                />
              )}
            </div>
          </div>

          {/* Tax Profile Card */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">{clientsText.taxProfile}</h2>
            <div className="space-y-3">
              <InfoRow
                label={UI_TEXT.form.taxYear}
                value={latestCase?.taxYear?.toString() || '—'}
              />
              <InfoRow
                label={UI_TEXT.form.taxTypes}
                value={latestCase?.taxTypes.map((t) => TAX_TYPE_LABELS[t]).join(', ') || '—'}
              />
              <InfoRow label="Có W2" value={client.profile?.hasW2 ? 'Có' : 'Không'} />
              <InfoRow
                label="Con dưới 17 tuổi"
                value={client.profile?.hasKidsUnder17 ? `Có (${client.profile.numKidsUnder17})` : 'Không'}
              />
              <InfoRow
                label="Trả tiền Daycare"
                value={client.profile?.paysDaycare ? 'Có' : 'Không'}
              />
              <InfoRow
                label="Tự kinh doanh"
                value={client.profile?.hasSelfEmployment ? 'Có' : 'Không'}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Document Checklist Tree */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-primary">
                Danh sách tài liệu cần thu thập
              </h2>
              <div className="flex items-center gap-3">
                {/* Progress circle */}
                <div className="relative w-8 h-8">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${calculateChecklistProgress(checklistItems) * 0.88} 100`} className="text-primary" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-foreground">{calculateChecklistProgress(checklistItems)}%</span>
                  </div>
                </div>
                <ProgressDots items={checklistItems} />
              </div>
            </div>
            <DocumentChecklistTree
              items={checklistItems}
              onVerify={(item) => console.log('Verify item:', item.id)}
              enableDragDrop={true}
              showHeader={false}
              onImageDrop={(imageId, targetChecklistItemId) => {
                moveImageMutation.mutate({ imageId, targetChecklistItemId })
              }}
            />
          </div>

          {/* Document Workflow Tabs - New 3-tab layout */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Quy trình xử lý tài liệu
            </h2>
            <DocumentWorkflowTabs
              caseId={latestCaseId || ''}
              rawImages={rawImages}
              digitalDocs={digitalDocs}
              onClassifyImage={handleManualClassify}
              onReviewClassification={handleReviewClassification}
              onVerifyDoc={handleVerifyDoc}
              onDataEntry={handleDataEntry}
            />
          </div>

          {/* Classification Review Modal */}
          {latestCaseId && (
            <ClassificationReviewModal
              image={reviewImage}
              isOpen={isReviewModalOpen}
              onClose={handleCloseReviewModal}
              caseId={latestCaseId}
            />
          )}

          {/* Manual Classification Modal */}
          {latestCaseId && (
            <ManualClassificationModal
              image={classifyImage}
              isOpen={isClassifyModalOpen}
              onClose={handleCloseClassifyModal}
              caseId={latestCaseId}
            />
          )}

          {/* Verification Modal (Phase 05) */}
          {latestCaseId && verifyDoc && (
            <VerificationModal
              doc={verifyDoc}
              isOpen={isVerifyModalOpen}
              onClose={handleCloseVerifyModal}
              caseId={latestCaseId}
            />
          )}

          {/* Data Entry Modal (Phase 06) */}
          {latestCaseId && dataEntryDoc && (
            <DataEntryModal
              doc={dataEntryDoc}
              isOpen={isDataEntryModalOpen}
              onClose={handleCloseDataEntryModal}
              caseId={latestCaseId}
            />
          )}

          {/* Re-upload Request Modal (Phase 06) */}
          {latestCaseId && reuploadImage && (
            <ReUploadRequestModal
              image={reuploadImage}
              unreadableFields={reuploadFields}
              isOpen={isReuploadModalOpen}
              onClose={handleCloseReuploadModal}
              caseId={latestCaseId}
            />
          )}

          {/* Upload Progress - shows when images are processing */}
          <UploadProgress processingCount={processingCount} extractingCount={extractingCount} />
        </div>
      )}
    </PageContainer>
  )
}

// Info row component with optional copy button
interface InfoRowProps {
  label: string
  value: string
  onCopy?: () => void
  copied?: boolean
}

function InfoRow({ label, value, onCopy, copied }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

