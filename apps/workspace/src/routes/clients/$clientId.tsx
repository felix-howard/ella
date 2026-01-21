/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Documents | Messages accessible via header button
 */

import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
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
  AlertCircle,
  RefreshCw,
  Loader2,
  Link2,
  Trash2,
} from 'lucide-react'
import { toast } from '../../stores/toast-store'
import { cn, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Button } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { StatusSelector, TieredChecklist, AddChecklistItemModal } from '../../components/cases'
import {
  ManualClassificationModal,
  UploadProgress,
  VerificationModal,
  UnclassifiedDocsCard,
  DataEntryTab,
} from '../../components/documents'
import { ClientOverviewSections } from '../../components/clients/client-overview-sections'
import { useClassificationUpdates } from '../../hooks/use-classification-updates'
import {
  UI_TEXT,
} from '../../lib/constants'
import { formatPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { api, type TaxCaseStatus, type RawImage, type DigitalDoc } from '../../lib/api-client'

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
})

type TabType = 'overview' | 'documents'

function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [classifyImage, setClassifyImage] = useState<RawImage | null>(null)
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [verifyDoc, setVerifyDoc] = useState<DigitalDoc | null>(null)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)

  // Mutation for adding checklist item
  const addChecklistItemMutation = useMutation({
    mutationFn: (data: { docType: string; reason?: string; expectedCount?: number }) =>
      api.cases.addChecklistItem(latestCaseId!, data),
    onSuccess: () => {
      toast.success('Đã thêm mục mới vào checklist')
      queryClient.invalidateQueries({ queryKey: ['checklist', latestCaseId] })
      setIsAddItemModalOpen(false)
    },
    onError: () => {
      toast.error('Lỗi khi thêm mục')
    },
  })

  // Mutation for skipping checklist item
  const skipChecklistItemMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      api.cases.skipChecklistItem(latestCaseId!, itemId, reason),
    onSuccess: () => {
      toast.success('Đã bỏ qua mục')
      queryClient.invalidateQueries({ queryKey: ['checklist', latestCaseId] })
    },
    onError: () => {
      toast.error('Lỗi khi bỏ qua mục')
    },
  })

  // Mutation for unskipping checklist item
  const unskipChecklistItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.cases.unskipChecklistItem(latestCaseId!, itemId),
    onSuccess: () => {
      toast.success('Đã khôi phục mục')
      queryClient.invalidateQueries({ queryKey: ['checklist', latestCaseId] })
    },
    onError: () => {
      toast.error('Lỗi khi khôi phục mục')
    },
  })

  // Mutation for deleting client
  const deleteClientMutation = useMutation({
    mutationFn: () => api.clients.delete(clientId),
    onSuccess: () => {
      toast.success('Đã xóa khách hàng thành công')
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate({ to: '/clients' })
    },
    onError: () => {
      toast.error('Lỗi khi xóa khách hàng')
      setIsDeleteModalOpen(false)
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
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
              aria-label="Xóa khách hàng"
              title="Xóa khách hàng"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
        <ClientOverviewSections client={client} />
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Card A: Unclassified Docs - shows when unclassified images exist */}
          <UnclassifiedDocsCard
            rawImages={rawImages}
            onClassify={handleManualClassify}
          />

          {/* Card B: Category-based Checklist */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-primary">
                Danh sách tài liệu cần thu thập
              </h2>
            </div>
            <TieredChecklist
              items={checklistItems}
              digitalDocs={digitalDocs}
              isStaffView={true}
              onAddItem={() => setIsAddItemModalOpen(true)}
              onSkip={(itemId, reason) => skipChecklistItemMutation.mutate({ itemId, reason })}
              onUnskip={(itemId) => unskipChecklistItemMutation.mutate(itemId)}
              onDocVerify={handleVerifyDoc}
            />
          </div>

          {/* Add Checklist Item Modal */}
          <AddChecklistItemModal
            isOpen={isAddItemModalOpen}
            onClose={() => setIsAddItemModalOpen(false)}
            onSubmit={(data) => addChecklistItemMutation.mutate(data)}
            existingDocTypes={checklistItems.map(item => item.template?.docType).filter(Boolean) as string[]}
            isSubmitting={addChecklistItemMutation.isPending}
          />

          {/* Data Entry Section - shows verified docs for copying to OltPro */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h2 className="text-base font-semibold text-primary mb-3">
              Nhập liệu
            </h2>
            <DataEntryTab
              docs={digitalDocs}
              caseId={latestCaseId || ''}
            />
          </div>

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

          {/* Upload Progress - shows when images are processing */}
          <UploadProgress processingCount={processingCount} extractingCount={extractingCount} />
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>Xóa khách hàng</ModalTitle>
          <ModalDescription>
            Bạn có chắc chắn muốn xóa khách hàng <strong>{client.name}</strong>?
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button
            variant="outline"
            className="px-6"
            onClick={() => setIsDeleteModalOpen(false)}
            disabled={deleteClientMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            className="px-6"
            onClick={() => deleteClientMutation.mutate()}
            disabled={deleteClientMutation.isPending}
          >
            {deleteClientMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang xóa...
              </>
            ) : (
              'Xóa khách hàng'
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </PageContainer>
  )
}


