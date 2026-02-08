/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Files (primary doc view), Checklist, Data Entry | Messages via header
 * Status: Read-only computed status with action buttons for transitions
 */

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  User,
  Users,
  AlertCircle,
  RefreshCw,
  Loader2,
  Link2,
  Trash2,
  ClipboardList,
  FolderOpen,
  Calculator,
  Home,
  X,
  Plus,
} from 'lucide-react'
import { toast } from '../../stores/toast-store'
import { cn, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Button } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { TieredChecklist, AddChecklistItemModal } from '../../components/cases'
const ScheduleCTab = lazy(() => import('../../components/cases/tabs/schedule-c-tab').then(m => ({ default: m.ScheduleCTab })))
const ScheduleETab = lazy(() => import('../../components/cases/tabs/schedule-e-tab').then(m => ({ default: m.ScheduleETab })))
import {
  ManualClassificationModal,
  UploadProgress,
  VerificationModal,
  UnclassifiedDocsCard,
  DuplicateDocsCard,
  DataEntryTab,
} from '../../components/documents'
import {
  ClientOverviewSections,
  YearSwitcher,
  CreateEngagementModal,
} from '../../components/clients'
import { FilesTab } from '../../components/files'
import { FloatingChatbox } from '../../components/chatbox'
import { ErrorBoundary } from '../../components/error-boundary'
import { useClassificationUpdates } from '../../hooks/use-classification-updates'
import { useOrgRole } from '../../hooks/use-org-role'
import { useScheduleC } from '../../hooks/use-schedule-c'
import { UI_TEXT } from '../../lib/constants'
import { formatPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { api, type TaxCaseStatus, type RawImage, type DigitalDoc } from '../../lib/api-client'
import { computeStatus } from '../../lib/computed-status'

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
})

type TabType = 'overview' | 'files' | 'checklist' | 'schedule-c' | 'schedule-e' | 'data-entry'

function ClientDetailPage() {
  const { t } = useTranslation()
  const { clientId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('files')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [classifyImage, setClassifyImage] = useState<RawImage | null>(null)
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [verifyDoc, setVerifyDoc] = useState<DigitalDoc | null>(null)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const { isAdmin } = useOrgRole()
  // Multi-year engagement state
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null)
  const [isCreateEngagementOpen, setIsCreateEngagementOpen] = useState(false)

  // Mutation for adding checklist item
  const addChecklistItemMutation = useMutation({
    mutationFn: (data: { docType: string; reason?: string; expectedCount?: number }) =>
      api.cases.addChecklistItem(activeCaseId!, data),
    onSuccess: () => {
      toast.success(t('clientDetail.checklistAddSuccess'))
      queryClient.invalidateQueries({ queryKey: ['checklist', activeCaseId] })
      setIsAddItemModalOpen(false)
    },
    onError: () => {
      toast.error(t('clientDetail.checklistAddError'))
    },
  })

  // Mutation for skipping checklist item
  const skipChecklistItemMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      api.cases.skipChecklistItem(activeCaseId!, itemId, reason),
    onSuccess: () => {
      toast.success(t('clientDetail.checklistSkipSuccess'))
      queryClient.invalidateQueries({ queryKey: ['checklist', activeCaseId] })
    },
    onError: () => {
      toast.error(t('clientDetail.checklistSkipError'))
    },
  })

  // Mutation for unskipping checklist item
  const unskipChecklistItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.cases.unskipChecklistItem(activeCaseId!, itemId),
    onSuccess: () => {
      toast.success(t('clientDetail.checklistUnskipSuccess'))
      queryClient.invalidateQueries({ queryKey: ['checklist', activeCaseId] })
    },
    onError: () => {
      toast.error(t('clientDetail.checklistUnskipError'))
    },
  })

  // Mutation for deleting client
  const deleteClientMutation = useMutation({
    mutationFn: () => api.clients.delete(clientId),
    onSuccess: () => {
      toast.success(t('clientDetail.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate({ to: '/clients' })
    },
    onError: () => {
      toast.error(t('clientDetail.deleteError'))
      setIsDeleteModalOpen(false)
    },
  })

  // Status action mutations
  const sendToReviewMutation = useMutation({
    mutationFn: () => api.cases.sendToReview(activeCaseId!),
    onSuccess: () => {
      toast.success(t('clientDetail.sendToReviewSuccess'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    },
    onError: () => {
      toast.error(t('clientDetail.sendToReviewError'))
    },
  })

  const markFiledMutation = useMutation({
    mutationFn: () => api.cases.markFiled(activeCaseId!),
    onSuccess: () => {
      toast.success(t('clientDetail.markFiledSuccess'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    },
    onError: () => {
      toast.error(t('clientDetail.markFiledError'))
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => api.cases.reopen(activeCaseId!),
    onSuccess: () => {
      toast.success(t('clientDetail.reopenSuccess'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    },
    onError: () => {
      toast.error(t('clientDetail.reopenError'))
    },
  })

  // Fetch client detail from API
  // Use isPending (not isLoading) - only true when NO cached data exists
  const {
    data: client,
    isPending: isClientLoading,
    isError: isClientError,
    error: clientError,
    refetch: refetchClient,
  } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.clients.get(clientId),
  })

  // Fetch engagements for this client (multi-year support)
  const { data: engagementsData } = useQuery({
    queryKey: ['engagements', clientId],
    queryFn: () => api.engagements.list({ clientId, limit: 10 }),
    enabled: !!client,
  })
  const engagements = engagementsData?.data ?? []

  // Determine which engagement is selected (default to most recent)
  const selectedEngagement = selectedEngagementId
    ? engagements.find((e) => e.id === selectedEngagementId)
    : engagements[0]

  // Find the tax case that matches the selected engagement's year
  const selectedCase = selectedEngagement
    ? client?.taxCases?.find((tc) => tc.taxYear === selectedEngagement.taxYear)
    : client?.taxCases?.[0]

  // Get the active case ID based on selected engagement
  const activeCaseId = selectedCase?.id

  // Fetch checklist for the latest case
  const { data: checklistResponse } = useQuery({
    queryKey: ['checklist', activeCaseId],
    queryFn: () => api.cases.getChecklist(activeCaseId!),
    enabled: !!activeCaseId,
  })

  // Fetch unread count for the specific case
  const { data: unreadData, isLoading: isUnreadLoading, isError: isUnreadError, refetch: refetchUnread } = useQuery({
    queryKey: ['unread-count', activeCaseId],
    queryFn: () => api.messages.getUnreadCount(activeCaseId!),
    enabled: !!activeCaseId,
    staleTime: 30000, // Cache for 30s
  })
  const unreadCount = unreadData?.unreadCount ?? 0

  // Callback to refetch unread count when chatbox sends/receives messages
  // Memoized and debounced to prevent race conditions
  const handleUnreadChange = useCallback(() => {
    // Small debounce to allow server to update before refetching
    setTimeout(() => refetchUnread(), 500)
  }, [refetchUnread])

  // Fetch raw images for the latest case
  const { data: imagesResponse } = useQuery({
    queryKey: ['images', activeCaseId],
    queryFn: () => api.cases.getImages(activeCaseId!),
    enabled: !!activeCaseId,
  })

  // Fetch digital docs for the latest case
  const { data: docsResponse } = useQuery({
    queryKey: ['docs', activeCaseId],
    queryFn: () => api.cases.getDocs(activeCaseId!),
    enabled: !!activeCaseId,
  })

  // Enable polling for real-time classification updates when on files or checklist tab
  const isDocumentsTab = activeTab === 'files' || activeTab === 'checklist'
  const { images: polledImages, docs: polledDocs, processingCount, extractingCount } = useClassificationUpdates({
    caseId: activeCaseId,
    enabled: isDocumentsTab,
    refetchInterval: 5000,
  })

  // Schedule C data for tab visibility
  const { showScheduleCTab } = useScheduleC({
    caseId: activeCaseId,
    enabled: !!activeCaseId,
  })

  // Error state - only show when actual error or no data after loading complete
  if (isClientError || (!isClientLoading && !client)) {
    return (
      <PageContainer>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t('clientDetail.backToList')}</span>
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('clientDetail.notFound')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {clientError instanceof Error ? clientError.message : t('clientDetail.notFoundDesc')}
          </p>
          <button
            onClick={() => refetchClient()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.retry')}
          </button>
        </div>
      </PageContainer>
    )
  }

  // Loading skeleton - shows header/tabs structure while loading
  // This ensures no full-page flash when switching tabs
  if (!client) {
    return (
      <PageContainer>
        <div className="mb-6 animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-7 w-48 bg-muted rounded" />
              <div className="flex gap-4">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
        <div className="border-b border-border mb-6">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-24 bg-muted rounded" />
            ))}
          </div>
        </div>
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
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

  // Use selectedCase for current view (defaults to most recent if not selected)
  const activeCase = selectedCase ?? client.taxCases[0]

  // Compute status based on case data
  const intakeAnswers = client.profile?.intakeAnswers as Record<string, unknown> || {}
  const hasIntakeAnswers = Object.keys(intakeAnswers).length > 0
  const missingDocsCount = checklistItems.filter(i => i.status === 'MISSING').length
  const extractedDocsCount = digitalDocs.filter(d => d.status === 'EXTRACTED').length
  const unverifiedDocsCount = digitalDocs.filter(d => d.status !== 'VERIFIED').length
  const pendingEntryCount = digitalDocs.filter(d => d.status === 'VERIFIED' && !d.entryCompleted).length

  // Get isInReview and isFiled from activeCase (type-safe via TaxCaseSummary)
  const isInReview = activeCase?.isInReview ?? false
  const isFiled = activeCase?.isFiled ?? false

  const computedStatus: TaxCaseStatus | null = activeCase
    ? computeStatus({
        hasIntakeAnswers,
        missingDocsCount,
        extractedDocsCount,
        unverifiedDocsCount,
        pendingEntryCount,
        isInReview,
        isFiled,
      })
    : null

  // Handler for year change from YearSwitcher
  const handleYearChange = useCallback((year: number, engagementId: string) => {
    setSelectedEngagementId(engagementId)
    // Invalidate queries for the new case to ensure fresh data
    const newCase = client?.taxCases?.find((tc) => tc.taxYear === year)
    if (newCase?.id) {
      queryClient.invalidateQueries({ queryKey: ['checklist', newCase.id] })
      queryClient.invalidateQueries({ queryKey: ['images', newCase.id] })
      queryClient.invalidateQueries({ queryKey: ['docs', newCase.id] })
    }
  }, [client?.taxCases, queryClient])

  // Handler for new engagement created
  const handleEngagementCreated = useCallback((newYear: number, engagementId: string) => {
    // Select the newly created engagement
    setSelectedEngagementId(engagementId)
    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['engagements', clientId] })
    queryClient.invalidateQueries({ queryKey: ['client', clientId] })
  }, [clientId, queryClient])

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
    { id: 'files', label: t('clientDetail.tabFiles'), icon: FolderOpen },
    // TODO: Temporarily hidden - re-enable when needed
    // { id: 'checklist', label: t('clientDetail.tabChecklist'), icon: FileText },
    // Schedule C tab: Show if 1099-NEC detected OR Schedule C already exists
    ...(showScheduleCTab ? [{ id: 'schedule-c' as TabType, label: 'Schedule C', icon: Calculator }] : []),
    // Schedule E tab: Always visible (no trigger condition like Schedule C)
    { id: 'schedule-e', label: 'Schedule E', icon: Home },
    { id: 'data-entry', label: t('clientDetail.tabDataEntry'), icon: ClipboardList },
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
                {/* Year Switcher - replaces static tax year display */}
                {engagements.length > 0 && (
                  <YearSwitcher
                    engagements={engagements}
                    selectedYear={selectedEngagement?.taxYear ?? activeCase?.taxYear ?? new Date().getFullYear()}
                    onYearChange={handleYearChange}
                    onCreateNew={() => setIsCreateEngagementOpen(true)}
                  />
                )}
                {engagements.length === 0 && activeCase && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                    {UI_TEXT.form.taxYear} {activeCase.taxYear}
                  </span>
                )}
                {/* Inline assignment display - admin only */}
                {isAdmin && (
                  <InlineAssignment clientId={clientId} />
                )}
              </div>
            </div>
          </div>

          {/* Status & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Action buttons based on state */}
            {activeCase && computedStatus === 'ENTRY_COMPLETE' && !isInReview && (
              <Button
                onClick={() => sendToReviewMutation.mutate()}
                disabled={sendToReviewMutation.isPending}
                size="sm"
                variant="outline"
              >
                {sendToReviewMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                {t('clientDetail.sendToReview')}
              </Button>
            )}

            {isInReview && !isFiled && (
              <Button
                onClick={() => markFiledMutation.mutate()}
                disabled={markFiledMutation.isPending}
                size="sm"
              >
                {markFiledMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                {t('clientDetail.markFiled')}
              </Button>
            )}

            {isFiled && (
              <Button
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
                size="sm"
                variant="outline"
              >
                {reopenMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                {t('clientDetail.reopen')}
              </Button>
            )}

            {/* Portal Link - scoped to selected engagement's tax case */}
            {(selectedCase?.portalUrl || client.portalUrl) && (
              <a
                href={selectedCase?.portalUrl || client.portalUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                title={t('clientDetail.openPortal')}
              >
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Portal</span>
              </a>
            )}

            {/* Message Button with Unread Badge */}
            {activeCaseId && (
              <Link
                to="/messages/$caseId"
                params={{ caseId: activeCaseId }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('clientDetail.messages')}</span>
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
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
              aria-label={t('clientDetail.deleteClient')}
              title={t('clientDetail.deleteClient')}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="flex gap-1 overflow-x-auto scrollbar-none" role="tablist">
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
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
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
        <div className="space-y-6">
          {/* Client Profile Overview */}
          <ClientOverviewSections client={client} />
        </div>
      )}

      {/* Files Tab - Primary document explorer view */}
      {activeTab === 'files' && activeCaseId && (
        <FilesTab
          caseId={activeCaseId}
          images={rawImages}
          docs={digitalDocs}
        />
      )}

      {/* Checklist Tab - Requirement-based document view (renamed from Documents) */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          {/* Card A: Duplicate Docs - shows when duplicates exist */}
          <DuplicateDocsCard
            rawImages={rawImages}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['images', activeCaseId] })
            }}
          />

          {/* Card B: Unclassified Docs - shows when unclassified images exist */}
          <UnclassifiedDocsCard
            rawImages={rawImages}
            onClassify={handleManualClassify}
          />

          {/* Category-based Checklist */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-primary">
                {t('clientDetail.checklistTitle')}
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

          {/* Manual Classification Modal */}
          {activeCaseId && (
            <ManualClassificationModal
              image={classifyImage}
              isOpen={isClassifyModalOpen}
              onClose={handleCloseClassifyModal}
              caseId={activeCaseId}
            />
          )}

          {/* Verification Modal */}
          {activeCaseId && verifyDoc && (
            <VerificationModal
              doc={verifyDoc}
              isOpen={isVerifyModalOpen}
              onClose={handleCloseVerifyModal}
              caseId={activeCaseId}
            />
          )}

          {/* Upload Progress - shows when images are processing */}
          <UploadProgress processingCount={processingCount} extractingCount={extractingCount} />
        </div>
      )}

      {/* Schedule C Tab - Self-employment expense collection (lazy loaded) */}
      {activeTab === 'schedule-c' && activeCaseId && (
        <ErrorBoundary fallback={<div className="p-6 text-center text-muted-foreground">{t('clientDetail.scheduleCError')}</div>}>
          <Suspense fallback={<div className="p-6 text-center text-muted-foreground">{t('common.loading')}</div>}>
            <ScheduleCTab caseId={activeCaseId} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Schedule E Tab - Rental property income/expense collection (lazy loaded) */}
      {activeTab === 'schedule-e' && activeCaseId && (
        <ErrorBoundary fallback={<div className="p-6 text-center text-muted-foreground">{t('clientDetail.scheduleEError')}</div>}>
          <Suspense fallback={<div className="p-6 text-center text-muted-foreground">{t('common.loading')}</div>}>
            <ScheduleETab caseId={activeCaseId} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === 'data-entry' && (
        <DataEntryTab
          docs={digitalDocs}
          caseId={activeCaseId || ''}
        />
      )}

      {/* Delete Client Confirmation Modal */}
      <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>{t('clientDetail.deleteModalTitle')}</ModalTitle>
          <ModalDescription>
            {t('clientDetail.deleteModalDesc', { name: client.name })}
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button
            variant="outline"
            className="px-6"
            onClick={() => setIsDeleteModalOpen(false)}
            disabled={deleteClientMutation.isPending}
          >
            {t('common.cancel')}
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
                {t('clientDetail.deleting')}
              </>
            ) : (
              t('clientDetail.deleteClient')
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Create Engagement Modal - for adding new tax year */}
      <CreateEngagementModal
        isOpen={isCreateEngagementOpen}
        onClose={() => setIsCreateEngagementOpen(false)}
        clientId={clientId}
        existingEngagements={engagements}
        onSuccess={handleEngagementCreated}
      />

      {/* Floating Chatbox - Facebook Messenger-style with error boundary */}
      {activeCaseId && !isUnreadError && (
        <ErrorBoundary
          fallback={
            <div className="fixed bottom-6 right-6 z-50 text-xs text-muted-foreground">
              {t('clientDetail.chatboxUnavailable')}
            </div>
          }
        >
          <FloatingChatbox
            caseId={activeCaseId}
            clientName={client.name}
            clientPhone={client.phone}
            clientId={clientId}
            unreadCount={isUnreadLoading ? 0 : unreadCount}
            onUnreadChange={handleUnreadChange}
          />
        </ErrorBoundary>
      )}
    </PageContainer>
  )
}

/**
 * Compact inline assignment display for client header.
 * Shows assigned staff names as pills with a + button to assign via CustomSelect dropdown.
 */
function InlineAssignment({ clientId }: { clientId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['client-assignments', clientId],
    queryFn: () => api.clientAssignments.list({ clientId }),
  })

  const { data: membersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: isOpen,
  })

  const assignments = assignmentsData?.data ?? []
  const members = membersData?.data ?? []
  const assignedStaffIds = new Set(assignments.map((a) => a.staffId))
  const availableMembers = members.filter((m) => !assignedStaffIds.has(m.id) && m.role !== 'ADMIN')

  const assignMutation = useMutation({
    mutationFn: (staffId: string) => api.clientAssignments.create({ clientId, staffId }),
    onSuccess: () => {
      setIsOpen(false)
      queryClient.invalidateQueries({ queryKey: ['client-assignments', clientId] })
    },
  })

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => api.clientAssignments.remove(assignmentId),
    onSuccess: () => {
      toast.success(t('team.unassign'))
      queryClient.invalidateQueries({ queryKey: ['client-assignments', clientId] })
    },
  })

  if (isLoading) {
    return (
      <span className="flex items-center gap-1.5">
        <Users className="w-4 h-4" aria-hidden="true" />
        <Loader2 className="w-3 h-3 animate-spin" />
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 relative">
      <Users className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      {assignments.length > 0 ? (
        <span className="flex flex-wrap items-center gap-1">
          {assignments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-muted text-xs text-foreground">
              {a.staff?.name ?? 'Unknown'}
              <button
                onClick={() => unassignMutation.mutate(a.id)}
                disabled={unassignMutation.isPending}
                className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={t('team.unassign')}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">{t('team.assignedTo')}</span>
      )}
      {/* Plus button to open assign dropdown */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
        aria-label={t('team.assignClients')}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {/* Assign dropdown popover */}
      {isOpen && (
        <AssignDropdown
          members={availableMembers}
          onSelect={(staffId) => assignMutation.mutate(staffId)}
          onClose={() => setIsOpen(false)}
          placeholder={t('team.assignClients') + '...'}
        />
      )}
    </span>
  )
}

/**
 * Dropdown popover for assigning staff to a client.
 * Renders as an absolute-positioned panel with click-outside-to-close.
 */
function AssignDropdown({ members, onSelect, onClose, placeholder }: {
  members: { id: string; name: string }[]
  onSelect: (staffId: string) => void
  onClose: () => void
  placeholder: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-56 py-1 rounded-lg border border-border bg-card shadow-lg z-[9999] max-h-60 overflow-auto"
    >
      <div className="px-3 py-1.5 text-xs text-muted-foreground">{placeholder}</div>
      {members.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">No available staff</div>
      ) : (
        members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
          >
            {m.name}
          </button>
        ))
      )}
    </div>
  )
}
