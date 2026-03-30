/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Files (primary doc view), Checklist, Data Entry | Messages via header
 * Status: Read-only computed status with action buttons for transitions
 */

import { useState, useCallback, useRef, lazy, Suspense } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation, Trans } from 'react-i18next'
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
  Upload,
  Send,
  ClipboardList,
  FolderOpen,
  Calculator,
  Home,
} from 'lucide-react'
import { toast } from '../../stores/toast-store'
import { cn, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Button, Input } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { TieredChecklist, AddChecklistItemModal } from '../../components/cases'
const ScheduleCTab = lazy(() => import('../../components/cases/tabs/schedule-c-tab').then(m => ({ default: m.ScheduleCTab })))
const ScheduleETab = lazy(() => import('../../components/cases/tabs/schedule-e-tab').then(m => ({ default: m.ScheduleETab })))
const DraftReturnTab = lazy(() => import('../../components/draft-return').then(m => ({ default: m.DraftReturnTab })))
import {
  ManualClassificationModal,
  UploadProgress,
  VerificationModal,
  UnclassifiedDocsCard,
  DuplicateDocsCard,
  DataEntryTab,
} from '../../components/documents'
import {
  YearSwitcher,
  CreateEngagementModal,
  ClientOverviewTab,
} from '../../components/clients'
import { FilesTab } from '../../components/files'
import { SendUploadLinkModal } from '../../components/shared/send-upload-link-modal'
import { FloatingChatbox } from '../../components/chatbox'
import { ErrorBoundary } from '../../components/error-boundary'
import { useClassificationUpdates } from '../../hooks/use-classification-updates'
import { useOrgRole } from '../../hooks/use-org-role'
import { useScheduleC } from '../../hooks/use-schedule-c'
import { UI_TEXT } from '../../lib/constants'
import { formatPhone, maskPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { api, type TaxCaseStatus, type RawImage, type DigitalDoc } from '../../lib/api-client'
import { computeStatus } from '../../lib/computed-status'

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
})

type TabType = 'overview' | 'files' | 'checklist' | 'schedule-c' | 'schedule-e' | 'data-entry' | 'draft-return'

function ClientDetailPage() {
  const { t } = useTranslation()
  const { clientId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('files')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [classifyImage, setClassifyImage] = useState<RawImage | null>(null)
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [verifyDoc, setVerifyDoc] = useState<DigitalDoc | null>(null)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const { isAdmin } = useOrgRole()
  // Multi-year engagement state
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null)
  const [isCreateEngagementOpen, setIsCreateEngagementOpen] = useState(false)
  const [isSendUploadLinkOpen, setIsSendUploadLinkOpen] = useState(false)
  const tempIdCounterRef = useRef(0)

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

  // Send upload link mutation with optimistic update to chatbox
  const sendUploadLinkMutation = useMutation({
    mutationFn: (customMessage?: string) => api.clients.sendUploadLink(clientId, customMessage),
    onMutate: async (customMessage) => {
      // Close modal immediately for snappy UX
      setIsSendUploadLinkOpen(false)

      if (!activeCaseId) return

      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages', activeCaseId] })

      const previous = queryClient.getQueryData(['messages', activeCaseId])

      // Build preview content from the template message
      const previewContent = (customMessage || '')
        .replace(/\{\{client_name\}\}/g, client?.name || '')
        .replace(/\{\{tax_year\}\}/g, String(activeCase?.taxYear || ''))
        .replace(/\{\{portal_link\}\}/g, '(link)')

      const tempMessage = {
        id: `temp-upload-link-${++tempIdCounterRef.current}`,
        conversationId: activeCaseId,
        channel: 'SMS' as const,
        direction: 'OUTBOUND' as const,
        content: previewContent,
        createdAt: new Date().toISOString(),
        _optimistic: 'sending' as const,
      }

      queryClient.setQueryData(['messages', activeCaseId], (old: { messages: unknown[] } | undefined) => ({
        ...old,
        messages: [...(old?.messages ?? []), tempMessage],
      }))

      return { previous }
    },
    onSuccess: () => {
      toast.success(t('clients.uploadLinkSent'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      if (activeCaseId) {
        queryClient.invalidateQueries({ queryKey: ['messages', activeCaseId] })
      }
    },
    onError: (err: Error, _data, context) => {
      // Rollback optimistic update on error
      if (context?.previous && activeCaseId) {
        queryClient.setQueryData(['messages', activeCaseId], context.previous)
      }
      toast.error(err.message || t('clients.uploadLinkFailed'))
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

  // Handler for year change from YearSwitcher
  // IMPORTANT: Must be before early returns to maintain consistent hook order
  const handleYearChange = (year: number, engagementId: string) => {
    setSelectedEngagementId(engagementId)
    // Invalidate queries for the new case to ensure fresh data
    const newCase = client?.taxCases?.find((tc) => tc.taxYear === year)
    if (newCase?.id) {
      queryClient.invalidateQueries({ queryKey: ['checklist', newCase.id] })
      queryClient.invalidateQueries({ queryKey: ['images', newCase.id] })
      queryClient.invalidateQueries({ queryKey: ['docs', newCase.id] })
    }
  }

  // Handler for new engagement created
  // IMPORTANT: Must be before early returns to maintain consistent hook order
  const handleEngagementCreated = (newYear: number, engagementId: string) => {
    // Select the newly created engagement
    setSelectedEngagementId(engagementId)
    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['engagements', clientId] })
    queryClient.invalidateQueries({ queryKey: ['client', clientId] })
  }

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
        <div className="mb-6">
          <div className="flex gap-1 p-1 bg-muted/40 rounded-xl">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-24 bg-muted rounded-lg" />
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
    { id: 'overview', label: t('clientOverview.title'), icon: User },
    { id: 'files', label: t('clientDetail.tabFiles'), icon: FolderOpen },
    // TODO: Temporarily hidden - re-enable when needed
    // { id: 'checklist', label: t('clientDetail.tabChecklist'), icon: FileText },
    // Schedule C tab: Show if 1099-NEC detected OR Schedule C already exists
    ...(showScheduleCTab ? [{ id: 'schedule-c' as TabType, label: 'Schedule C', icon: Calculator }] : []),
    // Schedule E tab: Always visible (no trigger condition like Schedule C)
    { id: 'schedule-e', label: 'Schedule E', icon: Home },
    { id: 'data-entry', label: t('clientDetail.tabDataEntry'), icon: ClipboardList },
    // Draft Return tab: For sharing draft tax returns with clients
    { id: 'draft-return', label: t('clientDetail.tabDraftReturn'), icon: FileText },
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
              'w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-md',
              avatarColor.bg,
              avatarColor.text
            )}>
              <span className="font-bold text-lg">
                {getInitials(client.name)}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" aria-hidden="true" />
                  {isAdmin ? formatPhone(client.phone) : maskPhone(client.phone)}
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
                {/* Managed by display */}
                {client.managedBy && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" aria-hidden="true" />
                    {client.managedBy.name}
                  </span>
                )}
              </div>
              {/* Tags */}
              {client.tags && client.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {client.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
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

            {/* Upload Link - scoped to selected engagement's tax case */}
            {(selectedCase?.portalUrl || client.portalUrl) && (
              <a
                href={selectedCase?.portalUrl || client.portalUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground bg-muted border border-border shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-muted/80 hover:shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-all duration-200"
                title={t('clientDetail.openUpload')}
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload</span>
              </a>
            )}

            {/* Message Button with Unread Badge */}
            {activeCaseId && (
              <Link
                to="/messages/$caseId"
                params={{ caseId: activeCaseId }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground bg-muted border border-border shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-muted/80 hover:shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-all duration-200"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('clientDetail.messages')}</span>
                {isUnreadLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                ) : !isUnreadError && unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-destructive text-white rounded-full min-w-[1.25rem] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            {/* Show Send Upload Link only when client has no active magic link */}
            {!(selectedCase?.portalUrl || client.portalUrl) && (
              <button
                onClick={() => setIsSendUploadLinkOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground bg-muted border border-border shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-muted/80 hover:shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-all duration-200"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('clients.sendUploadLink')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs - Pill style */}
      <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="flex gap-1 p-1 bg-muted/40 rounded-xl overflow-x-auto scrollbar-none" role="tablist">
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
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0',
                  isActive
                    ? 'bg-background text-primary shadow-md ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
        <ClientOverviewTab client={client} onDeleteClick={() => setIsDeleteModalOpen(true)} />
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
            <ScheduleCTab caseId={activeCaseId} clientName={client.name} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Schedule E Tab - Rental property income/expense collection (lazy loaded) */}
      {activeTab === 'schedule-e' && activeCaseId && (
        <ErrorBoundary fallback={<div className="p-6 text-center text-muted-foreground">{t('clientDetail.scheduleEError')}</div>}>
          <Suspense fallback={<div className="p-6 text-center text-muted-foreground">{t('common.loading')}</div>}>
            <ScheduleETab caseId={activeCaseId} clientName={client.name} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === 'data-entry' && (
        <DataEntryTab
          docs={digitalDocs}
          caseId={activeCaseId || ''}
        />
      )}

      {/* Draft Return Tab - For sharing draft tax returns with clients */}
      {activeTab === 'draft-return' && activeCaseId && (
        <ErrorBoundary fallback={<div className="p-6 text-center text-muted-foreground">{t('clientDetail.draftReturnError')}</div>}>
          <Suspense fallback={<div className="p-6 text-center text-muted-foreground">{t('common.loading')}</div>}>
            <DraftReturnTab caseId={activeCaseId} clientName={client.name} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Delete Client Confirmation Modal */}
      <Modal open={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setDeleteConfirmText('') }}>
        <ModalHeader>
          <ModalTitle>{t('clientDetail.deleteModalTitle')}</ModalTitle>
          <ModalDescription>
            <Trans
              i18nKey="clientDetail.deleteModalDesc"
              values={{ name: client.name }}
              components={{ red: <span className="text-destructive font-semibold" /> }}
            />
          </ModalDescription>
        </ModalHeader>
        <div className="px-6 pb-2">
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={t('clientDetail.deleteConfirmPlaceholder')}
            className="w-full"
            autoFocus
          />
        </div>
        <ModalFooter>
          <Button
            variant="outline"
            className="px-6"
            onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText('') }}
            disabled={deleteClientMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            className="px-6"
            onClick={() => deleteClientMutation.mutate()}
            disabled={deleteConfirmText !== t('clientDetail.deleteConfirmWord', 'Delete') || deleteClientMutation.isPending}
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

      {/* Send Upload Link Modal */}
      {activeCase && (
        <SendUploadLinkModal
          isOpen={isSendUploadLinkOpen}
          onClose={() => setIsSendUploadLinkOpen(false)}
          onSend={(message) => sendUploadLinkMutation.mutate(message)}
          isSending={sendUploadLinkMutation.isPending}
          clientName={client.name}
          taxYear={activeCase.taxYear}
        />
      )}

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

