/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Documents, Messages
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
  ChevronRight,
  Pencil,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Loader2,
  Send,
  Link2,
  ExternalLink,
} from 'lucide-react'
import { toast } from '../../stores/toast-store'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { ChecklistGrid, StatusSelector } from '../../components/cases'
import { DocumentWorkflowTabs, ClassificationReviewModal, ManualClassificationModal, UploadProgress, VerificationModal, DataEntryModal, ReUploadRequestModal } from '../../components/documents'
import { ClientMessagesTab } from '../../components/client-detail'
import { useClassificationUpdates } from '../../hooks/use-classification-updates'
import {
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_COLORS,
  TAX_TYPE_LABELS,
  FILING_STATUS_LABELS,
  LANGUAGE_LABELS,
  UI_TEXT,
} from '../../lib/constants'
import { formatPhone, getInitials, copyToClipboard, getAvatarColor } from '../../lib/formatters'
import { api, type TaxCaseStatus, type ChecklistItemStatus, type RawImage, type DigitalDoc } from '../../lib/api-client'

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
})

type TabType = 'overview' | 'documents' | 'messages'

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

  // Error code to Vietnamese message mapping
  const SMS_ERROR_MESSAGES: Record<string, string> = {
    NO_MAGIC_LINK: 'Không có magic link khả dụng',
    SMS_NOT_CONFIGURED: 'Twilio chưa được cấu hình',
    PORTAL_URL_NOT_CONFIGURED: 'PORTAL_URL chưa được cấu hình',
    SMS_SEND_FAILED: 'Không thể gửi SMS',
    SMS_SEND_ERROR: 'Lỗi khi gửi SMS',
  }

  // Mutation for resending SMS
  const resendSmsMutation = useMutation({
    mutationFn: () => api.clients.resendSms(clientId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Đã gửi lại SMS thành công')
      } else {
        const errorMessage = result.error
          ? SMS_ERROR_MESSAGES[result.error] || result.error
          : 'Không thể gửi SMS'
        toast.error(errorMessage)
      }
    },
    onError: () => {
      toast.error('Lỗi kết nối, vui lòng thử lại')
    },
  })

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
  const { images: polledImages, processingCount } = useClassificationUpdates({
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
  const digitalDocs = docsResponse?.docs ?? []

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
    { id: 'messages', label: clientsText.tabs.messages, icon: MessageSquare },
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

          {/* Status Badges & Edit */}
          <div className="flex items-center gap-3">
            {/* SMS Status Badge */}
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full',
                client.smsEnabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}
            >
              {client.smsEnabled ? 'SMS Bật' : 'SMS Tắt'}
            </span>
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
            <button
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label={UI_TEXT.edit}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
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

          {/* Portal Link Card */}
          <div className="bg-card rounded-xl border border-border p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
              <Link2 className="w-5 h-5" aria-hidden="true" />
              Link Portal
            </h2>
            {client.portalUrl ? (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Link cho khách hàng tải tài liệu
                    </p>
                    <p className="text-sm font-mono text-foreground truncate">
                      {client.portalUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleCopy(client.portalUrl!, 'portalUrl')}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                        copiedField === 'portalUrl'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                          : 'bg-background text-foreground border-border hover:bg-muted'
                      )}
                    >
                      {copiedField === 'portalUrl' ? (
                        <>
                          <Check className="w-4 h-4" aria-hidden="true" />
                          Đã copy
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" aria-hidden="true" />
                          Copy Link
                        </>
                      )}
                    </button>
                    <a
                      href={client.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      Mở
                    </a>
                    <button
                      onClick={() => resendSmsMutation.mutate()}
                      disabled={resendSmsMutation.isPending || !client.smsEnabled}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                        client.smsEnabled
                          ? 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      )}
                      title={!client.smsEnabled ? 'Twilio chưa được cấu hình' : undefined}
                    >
                      {resendSmsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" aria-hidden="true" />
                          Gửi lại SMS
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Không có magic link khả dụng</p>
              </div>
            )}
          </div>

          {/* Checklist Summary */}
          <div className="bg-card rounded-xl border border-border p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">{clientsText.checklistTitle}</h2>
              <button
                onClick={() => {
                  // TODO: Navigate to /cases/:id/verify when route is created
                  alert('Chức năng xem chi tiết sẽ được triển khai ở task 1.3.16-1.3.18')
                }}
                className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
              >
                <span>{UI_TEXT.actions.viewDetail}</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {checklistItems.map((item) => {
                const status = item.status as ChecklistItemStatus
                const colors = CHECKLIST_STATUS_COLORS[status]
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                  >
                    <span className="text-sm text-foreground">{item.template?.labelVi || 'Tài liệu'}</span>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        colors?.bg || 'bg-muted',
                        colors?.text || 'text-muted-foreground'
                      )}
                    >
                      {CHECKLIST_STATUS_LABELS[status]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Checklist Grid */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Danh sách tài liệu cần thu thập
            </h2>
            <ChecklistGrid
              items={checklistItems}
              onItemClick={(item) => console.log('Clicked checklist item:', item.id)}
              onVerify={(item) => console.log('Verify item:', item.id)}
              enableDragDrop={true}
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
              onRequestReupload={handleRequestReupload}
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
          <UploadProgress processingCount={processingCount} />
        </div>
      )}

      {activeTab === 'messages' && (
        <ClientMessagesTab
          clientId={clientId}
          caseId={latestCaseId}
          clientName={client.name}
          clientPhone={client.phone}
          isActive={activeTab === 'messages'}
        />
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

