/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Files (primary doc view), Checklist, Data Entry | Messages via header
 * Status: Read-only computed status with action buttons for transitions
 */

import { useState, useCallback, useRef, useEffect, useTransition, lazy, Suspense } from 'react'
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
  Building2,
  ChevronDown,
  UserCircle,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { toast } from '../../stores/toast-store'
import { cn, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Button, buttonVariants, Input } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { TieredChecklist, AddChecklistItemModal } from '../../components/cases'
// SharedDocsTab is imported directly (not lazy) because its heavy deps
// (react-pdf) are already lazy-loaded one level deeper inside SharedDocCard.
// Lazy-loading this wrapper caused full-page Suspense fallbacks that hid
// the client header during tab switches.
import { SharedDocsTab } from '../../components/shared-docs'
const ScheduleCTab = lazy(() => import('../../components/cases/tabs/schedule-c-tab').then(m => ({ default: m.ScheduleCTab })))
const ScheduleETab = lazy(() => import('../../components/cases/tabs/schedule-e-tab').then(m => ({ default: m.ScheduleETab })))
const Form1099NECTab = lazy(() => import('../../components/cases/tabs/form-1099-nec-tab').then(m => ({ default: m.Form1099NECTab })))
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
  BusinessDeleteWithScheduleCModal,
} from '../../components/clients'
import { useDeleteBusinessWithScheduleC } from '../../hooks/use-delete-business-with-schedule-c'
import { countScheduleCExpenseLines } from '../../lib/schedule-c-expense-helpers'
import { FilesTab } from '../../components/files'
import { SendUploadLinkModal } from '../../components/shared/send-upload-link-modal'
import { FloatingChatbox } from '../../components/chatbox'
import { ErrorBoundary } from '../../components/error-boundary'
import { useScheduleC } from '../../hooks/use-schedule-c'
import { useScheduleE } from '../../hooks/use-schedule-e'
import { useClassificationUpdates } from '../../hooks/use-classification-updates'
import { useOrgRole } from '../../hooks/use-org-role'
import { useChatUnread } from '../../hooks/use-chat-unread'
import { UI_TEXT } from '../../lib/constants'
import { formatPhone, formatPhoneInput, maskPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { api, type TaxCaseStatus, type RawImage, type DigitalDoc, type ClientPreview } from '../../lib/api-client'
import { computeStatus } from '../../lib/computed-status'
import { isScheduleCEligibleBusiness, BUSINESS_TYPE_LABELS } from '../../lib/business-type-helpers'
import { ScheduleCBusinessSummaryList } from '../../components/cases/tabs/schedule-c-tab/schedule-c-business-summary-list'

type TabType = 'overview' | 'files' | 'checklist' | 'schedule-c' | 'schedule-e' | 'data-entry' | 'shared-docs' | 'contractors'

const VALID_TAB_PARAMS: TabType[] = [
  'overview', 'files', 'checklist', 'schedule-c', 'schedule-e',
  'data-entry', 'shared-docs', 'contractors',
]

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
  validateSearch: (search: Record<string, unknown>): { tab?: TabType } => {
    const tab = search.tab as string | undefined
    return {
      tab: tab && VALID_TAB_PARAMS.includes(tab as TabType) ? (tab as TabType) : undefined,
    }
  },
})

function ClientDetailPage() {
  const { t } = useTranslation()
  const { clientId } = Route.useParams()
  const { tab: initialTabFromSearch } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>(initialTabFromSearch ?? 'files')
  // Use transition so switching to lazy-loaded tabs (e.g. Shared Docs)
  // keeps the header card visible while the chunk loads instead of
  // flashing the Suspense fallback across the whole content area.
  const [, startTabTransition] = useTransition()
  const switchTab = useCallback((tab: TabType) => {
    startTabTransition(() => setActiveTab(tab))
  }, [])
  const [prevClientId, setPrevClientId] = useState(clientId)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isBusinessDeleteWithSCOpen, setIsBusinessDeleteWithSCOpen] = useState(false)
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
  // "More" dropdown state (must be before early returns for Rules of Hooks)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  // Edit client modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editData, setEditData] = useState<{
    firstName: string
    lastName: string
    phone: string
    email: string
  } | null>(null)

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

  // Update client profile mutation
  const updateClientMutation = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string | null; phone?: string; email?: string | null }) =>
      api.clients.update(clientId, data),
    onSuccess: () => {
      toast.success(t('clientOverview.profileUpdated'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      setIsEditModalOpen(false)
      setEditData(null)
    },
    onError: () => {
      toast.error(t('clientOverview.profileUpdateFailed'))
    },
  })

  // Send upload link mutation with optimistic update to chatbox
  const sendUploadLinkMutation = useMutation({
    mutationFn: (customMessage?: string) => api.clients.sendUploadLink(clientId, customMessage),
    onMutate: async (customMessage) => {
      // Close modal immediately for snappy UX
      setIsSendUploadLinkOpen(false)

      if (!activeCaseId) return

      // Query key aligned with useChatMessages hook — ['messages', 'case', caseId].
      const messagesKey = ['messages', 'case', activeCaseId] as const

      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: messagesKey })

      const previous = queryClient.getQueryData(messagesKey)

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

      queryClient.setQueryData(messagesKey, (old: { messages: unknown[] } | undefined) => ({
        ...old,
        messages: [...(old?.messages ?? []), tempMessage],
      }))

      return { previous }
    },
    onSuccess: () => {
      toast.success(t('clients.uploadLinkSent'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      if (activeCaseId) {
        queryClient.invalidateQueries({ queryKey: ['messages', 'case', activeCaseId] })
      }
    },
    onError: (err: Error, _data, context) => {
      // Rollback optimistic update on error
      if (context?.previous && activeCaseId) {
        queryClient.setQueryData(['messages', 'case', activeCaseId], context.previous)
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

  // Find individual owner for business clients in a group (for button redirects)
  const ownerIndividual = client?.clientType === 'BUSINESS' && client.clientGroup?.clients
    ? client.clientGroup.clients.find((c) => c.clientType === 'INDIVIDUAL') ?? null
    : null

  // Fetch checklist for the latest case
  const { data: checklistResponse } = useQuery({
    queryKey: ['checklist', activeCaseId],
    queryFn: () => api.cases.getChecklist(activeCaseId!),
    enabled: !!activeCaseId,
  })

  // Resolve portal URL: prefer individual owner's for business clients
  const portalUploadUrl = ownerIndividual?.portalUrl || selectedCase?.portalUrl || client?.portalUrl || null

  // Fetch unread count — use individual owner's caseId when redirecting.
  // Query key owned by useChatUnread: ['unread-count', 'case', caseId].
  const messageCaseId = ownerIndividual?.latestCaseId || activeCaseId
  const {
    unreadCount,
    isLoading: isUnreadLoading,
    isError: isUnreadError,
    refetch: refetchUnread,
  } = useChatUnread(
    messageCaseId
      ? { type: 'case', caseId: messageCaseId, clientId: ownerIndividual?.id || clientId }
      : { type: 'case', caseId: '', clientId: '' },
    !!messageCaseId,
  )

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

  // Fetch Schedule C/E existence to promote tabs from "More" to primary
  const { expense: scheduleCExpense, totals: scheduleCTotals } = useScheduleC({ caseId: activeCaseId, enabled: !!activeCaseId })
  const { expense: scheduleEExpense } = useScheduleE({ caseId: activeCaseId, enabled: !!activeCaseId })

  // Phase 8: business delete with owned Schedule C — explicit cascade modal
  const deleteBusinessWithSC = useDeleteBusinessWithScheduleC({
    businessId: clientId,
    groupId: client?.clientGroupId ?? null,
    parentIndividualId: ownerIndividual?.id ?? null,
    onSuccess: () => setIsBusinessDeleteWithSCOpen(false),
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

  // Reset active tab when navigating between clients (prevents stale tab like 'contractors' on INDIVIDUAL)
  if (prevClientId !== clientId) {
    setPrevClientId(clientId)
    setActiveTab('files')
  }

  // Close "More" dropdown on outside click or Escape
  useEffect(() => {
    if (!isMoreOpen) return
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMoreOpen])

  // Error state - only show when actual error or no data after loading complete
  if (isClientError || (!isClientLoading && !client)) {
    return (
      <PageContainer>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
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

  const handleOpenEditModal = () => {
    setEditData({
      firstName: client.firstName,
      lastName: client.lastName || '',
      phone: formatPhone(client.phone),
      email: client.email || '',
    })
    setIsEditModalOpen(true)
  }

  const handleSaveClientProfile = () => {
    if (!editData) return
    // Convert formatted phone (XXX) XXX-XXXX back to E.164 format +1XXXXXXXXXX
    const cleanedPhone = editData.phone.replace(/\D/g, '')
    const formattedPhone = cleanedPhone.length === 10 ? `+1${cleanedPhone}` : `+1${cleanedPhone.slice(-10)}`

    updateClientMutation.mutate({
      firstName: editData.firstName,
      lastName: editData.lastName || null,
      phone: formattedPhone,
      email: editData.email || null,
    })
  }

  const handleCancelEdit = () => {
    setIsEditModalOpen(false)
    setEditData(null)
  }

  const { clients: clientsText } = UI_TEXT
  const avatarColor = getAvatarColor(client.name)

  // Schedule C/E tabs: promote to primary tabs once a form has been sent
  const scheduleCTab = { id: 'schedule-c' as TabType, label: 'Schedule C', icon: Calculator }
  const scheduleETab = { id: 'schedule-e' as TabType, label: 'Schedule E', icon: Home }
  const isBusiness = client.clientType === 'BUSINESS'

  // Schedule C eligibility & cross-entity summary computation.
  // Business: only show Schedule C when the entity actually files it (sole prop / SMLLC).
  // Individual: also surface the tab when linked Schedule-C-eligible businesses already
  // have their own Schedule C — content becomes a read-only summary list.
  const businessIsScheduleCEligible = isBusiness && isScheduleCEligibleBusiness(client)
  const eligibleBusinessesWithScheduleC: ClientPreview[] = !isBusiness
    ? (client.clientGroup?.clients ?? []).filter(
        (sibling) =>
          isScheduleCEligibleBusiness(sibling) && sibling.scheduleCExpense != null
      )
    : []
  // Business: hide entirely when entity type doesn't file Schedule C.
  // Individual: always-visible (existing behavior); summary view used only when
  // no own SC exists AND ≥1 eligible business already has its own SC.
  const showBusinessScheduleCTab = businessIsScheduleCEligible
  const showIndividualBusinessSummary =
    !isBusiness && !scheduleCExpense && eligibleBusinessesWithScheduleC.length > 0
  // For individuals, the tab is always rendered (primary if SC sent, overflow otherwise);
  // for businesses, only when entity type is Schedule-C-eligible.
  const showScheduleCInPrimary = isBusiness ? showBusinessScheduleCTab && !!scheduleCExpense : !!scheduleCExpense
  const showScheduleCInOverflow = isBusiness ? showBusinessScheduleCTab && !scheduleCExpense : !scheduleCExpense

  const tabs: { id: TabType; label: string; icon: typeof User }[] = isBusiness
    ? [
        { id: 'overview', label: t('clientOverview.title'), icon: Building2 },
        { id: 'files', label: t('clientDetail.tabFiles'), icon: FolderOpen },
        { id: 'contractors', label: 'Contractors', icon: UserCircle },
        { id: 'data-entry', label: t('clientDetail.tabDataEntry'), icon: ClipboardList },
        { id: 'shared-docs', label: t('clientDetail.tabSharedDocs'), icon: FileText },
        ...(showScheduleCInPrimary ? [scheduleCTab] : []),
      ]
    : [
        { id: 'overview', label: t('clientOverview.title'), icon: User },
        { id: 'files', label: t('clientDetail.tabFiles'), icon: FolderOpen },
        { id: 'data-entry', label: t('clientDetail.tabDataEntry'), icon: ClipboardList },
        { id: 'shared-docs', label: t('clientDetail.tabSharedDocs'), icon: FileText },
        ...(showScheduleCInPrimary ? [scheduleCTab] : []),
        ...(scheduleEExpense ? [scheduleETab] : []),
      ]

  // Overflow tabs: only show tabs that haven't been promoted
  const overflowTabs: { id: TabType; label: string; icon: typeof User }[] = isBusiness
    ? [
        ...(showScheduleCInOverflow ? [scheduleCTab] : []),
      ]
    : [
        ...(showScheduleCInOverflow ? [scheduleCTab] : []),
        ...(!scheduleEExpense ? [scheduleETab] : []),
      ]

  const isOverflowActive = overflowTabs.some((t) => t.id === activeTab)
  const activeOverflowLabel = overflowTabs.find((t) => t.id === activeTab)?.label

  return (
    <PageContainer className="pb-28">
      {/* Back link */}
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{clientsText.backToList}</span>
      </Link>

      {/* Header Card */}
      <div className="bg-card border border-border/60 rounded-lg shadow-none mb-6">
        {/* Top section: identity + actions */}
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            {/* Left: Avatar + Identity */}
            <div className="flex items-start gap-3.5">
              {/* Avatar */}
              <div className={cn(
                'w-12 h-12 flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-sm',
                isBusiness ? 'rounded-lg' : 'rounded-full',
                avatarColor.bg,
                avatarColor.text
              )}>
                <span className="font-bold text-base">
                  {getInitials(client.name)}
                </span>
              </div>

              <div className="min-w-0">
                {/* Name row with badge + linked entities inline */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-foreground leading-tight">{client.name}</h1>
                  <button
                    onClick={handleOpenEditModal}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={t('clientOverview.editProfile')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {isBusiness && client.businessType && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                      {BUSINESS_TYPE_LABELS[client.businessType] || client.businessType}
                    </span>
                  )}
                  {/* Linked entity chips inline with name */}
                  {client.clientGroup && client.clientGroup.clients.length > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-xs text-muted-foreground">
                        {isBusiness ? t('clientDetail.linkedOwner', 'Owner') : t('clientDetail.linkedBusinesses', 'Businesses')}:
                      </span>
                      {client.clientGroup.clients.map(sibling => {
                        const siblingIsBusiness = sibling.clientType === 'BUSINESS'
                        const siblingInitials = sibling.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                        return (
                          <Link
                            key={sibling.id}
                            to="/clients/$clientId"
                            params={{ clientId: sibling.id }}
                            className="group inline-flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-muted/60 border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                          >
                            <span className={cn(
                              'w-5 h-5 flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                              siblingIsBusiness ? 'rounded-md bg-primary/10 text-primary' : 'rounded-full bg-accent text-accent-foreground',
                            )}>
                              {siblingIsBusiness ? <Building2 className="w-3 h-3" /> : siblingInitials}
                            </span>
                            <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                              {sibling.name}
                            </span>
                          </Link>
                        )
                      })}
                    </>
                  )}
                </div>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    {isAdmin ? formatPhone(client.phone) : maskPhone(client.phone)}
                  </span>
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                      {client.email}
                    </span>
                  )}
                  {isBusiness && client.einMasked && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                      EIN: ***-**-{client.einMasked}
                    </span>
                  )}
                  {engagements.length > 0 && (
                    <YearSwitcher
                      engagements={engagements}
                      selectedYear={selectedEngagement?.taxYear ?? activeCase?.taxYear ?? new Date().getFullYear()}
                      onYearChange={handleYearChange}
                      onCreateNew={() => setIsCreateEngagementOpen(true)}
                    />
                  )}
                  {engagements.length === 0 && activeCase && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      {UI_TEXT.form.taxYear} {activeCase.taxYear}
                    </span>
                  )}
                  {client.managedBy && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      {client.managedBy.name}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {client.tags && client.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {client.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
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

              {portalUploadUrl && (
                <a
                  href={portalUploadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('clientDetail.openUpload')}
                  className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload</span>
                  {ownerIndividual?.name && (
                    <span className="text-muted-foreground text-xs">(via {ownerIndividual.name.split(' ')[0]})</span>
                  )}
                </a>
              )}

              {messageCaseId && (
                <Link
                  to="/messages/$caseId"
                  params={{ caseId: messageCaseId }}
                  className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{t('clientDetail.messages')}</span>
                  {ownerIndividual?.name && (
                    <span className="text-muted-foreground text-xs">(via {ownerIndividual.name.split(' ')[0]})</span>
                  )}
                  {isUnreadLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  ) : !isUnreadError && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-destructive text-white rounded-full min-w-[1.25rem] text-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              )}

              {!portalUploadUrl && (
                <Button
                  onClick={() => setIsSendUploadLinkOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('clients.sendUploadLink')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs - attached to card bottom */}
        <div className="border-t border-border px-4 sm:px-5">
          <div className="flex gap-0.5 -mb-px">
            <nav className="flex gap-0.5 overflow-x-auto scrollbar-none" role="tablist">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => switchTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap flex-shrink-0',
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

            {overflowTabs.length > 0 && <div ref={moreRef} className="relative flex-shrink-0">
              <button
                role="tab"
                aria-selected={isOverflowActive}
                aria-expanded={isMoreOpen}
                aria-haspopup="true"
                onClick={() => setIsMoreOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap',
                  isOverflowActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <span>{isOverflowActive ? activeOverflowLabel : 'More'}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isMoreOpen && 'rotate-180')} aria-hidden="true" />
              </button>
              {isMoreOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-background border border-border rounded-lg shadow-lg py-1">
                  {overflowTabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        role="menuitem"
                        onClick={() => {
                          switchTab(tab.id)
                          setIsMoreOpen(false)
                        }}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'text-primary font-medium bg-muted/50'
                            : 'text-foreground hover:bg-muted/50'
                        )}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        <span>{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <ClientOverviewTab
          client={client}
          parentScheduleC={
            !isBusiness && scheduleCExpense && selectedEngagement
              ? { id: scheduleCExpense.id, taxYear: selectedEngagement.taxYear }
              : null
          }
          onDeleteClick={() => {
            // Phase 8: business clients owning a Schedule C use the explicit
            // confirmation modal that surfaces the data being destroyed.
            if (isBusiness && scheduleCExpense) {
              setIsBusinessDeleteWithSCOpen(true)
            } else {
              setIsDeleteModalOpen(true)
            }
          }}
        />
      )}

      {/* Files Tab - Primary document explorer view */}
      {activeTab === 'files' && activeCaseId && (
        <FilesTab
          caseId={activeCaseId}
          images={rawImages}
          docs={digitalDocs}
          clientGroupId={!isBusiness && client.clientGroupId ? client.clientGroupId : undefined}
          taxYear={selectedEngagement?.taxYear}
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

      {/* Schedule C Tab - Self-employment expense collection (lazy loaded).
          On individuals with no own SC but ≥1 linked Schedule-C-eligible business with SC,
          render a read-only summary list instead of the binary form view. */}
      {activeTab === 'schedule-c' && activeCaseId && showIndividualBusinessSummary && (
        <ScheduleCBusinessSummaryList businesses={eligibleBusinessesWithScheduleC} />
      )}
      {activeTab === 'schedule-c' && activeCaseId && !showIndividualBusinessSummary && (
        <ErrorBoundary fallback={<div className="p-6 text-center text-muted-foreground">{t('clientDetail.scheduleCError')}</div>}>
          <Suspense fallback={<div className="p-6 text-center text-muted-foreground">{t('common.loading')}</div>}>
            <ScheduleCTab
              caseId={activeCaseId}
              clientName={client.name}
              currentClientId={clientId}
              sourceTaxYear={selectedCase?.taxYear}
              clientGroup={client.clientGroup ?? null}
            />
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

      {/* Shared Docs Tab - Multi-section document sharing per case */}
      {/* Local Suspense boundary contains any suspending child (e.g. lazy PdfThumbnail) */}
      {/* so the fallback never bubbles up and replaces the page header/tabs. */}
      {activeTab === 'shared-docs' && activeCaseId && (
        <ErrorBoundary fallback={<div className="p-6 text-center text-muted-foreground">{t('clientDetail.sharedDocsError')}</div>}>
          <Suspense fallback={<div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <SharedDocsTab caseId={activeCaseId} clientName={client.name} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Contractors Tab - 1099-NEC management for BUSINESS clients (lazy loaded) */}
      {activeTab === 'contractors' && isBusiness && (
        <ErrorBoundary fallback={<div className="p-6 text-center text-muted-foreground">Failed to load Contractors tab</div>}>
          <Suspense fallback={<div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <Form1099NECTab clientId={clientId} clientName={client.name} />
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

      {/* Phase 8: Business Delete With Schedule C — explicit cascade modal */}
      <BusinessDeleteWithScheduleCModal
        open={isBusinessDeleteWithSCOpen}
        businessName={client.name}
        expenseCount={countScheduleCExpenseLines(scheduleCExpense)}
        totalDollars={scheduleCTotals?.totalExpenses ?? '0'}
        isPending={deleteBusinessWithSC.isPending}
        onConfirm={() => deleteBusinessWithSC.mutate()}
        onCancel={() => setIsBusinessDeleteWithSCOpen(false)}
      />

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

      {/* Edit Client Profile Modal */}
      <Modal open={isEditModalOpen} onClose={handleCancelEdit}>
        <ModalHeader>
          <ModalTitle>{t('clientOverview.editProfile')}</ModalTitle>
          <ModalDescription>{t('clientOverview.editProfileDesc', 'Update client contact information')}</ModalDescription>
        </ModalHeader>
        {editData && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('clientOverview.firstName')}
                </label>
                <Input
                  value={editData.firstName}
                  onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                  disabled={updateClientMutation.isPending}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('clientOverview.lastName')}
                </label>
                <Input
                  value={editData.lastName}
                  onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                  placeholder={t('clientOverview.lastNameOptional')}
                  disabled={updateClientMutation.isPending}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('clientOverview.phone')}
                </label>
                <Input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: formatPhoneInput(e.target.value) })}
                  disabled={updateClientMutation.isPending}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('clientOverview.email')}
                </label>
                <Input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  placeholder={t('clientOverview.emailOptional')}
                  disabled={updateClientMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={handleCancelEdit} disabled={updateClientMutation.isPending}>
            <X className="w-4 h-4 mr-1.5" />
            {t('clientOverview.cancelEdit')}
          </Button>
          <Button
            onClick={handleSaveClientProfile}
            disabled={updateClientMutation.isPending || !editData?.firstName || !editData?.phone}
          >
            {updateClientMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Check className="w-4 h-4 mr-1.5" />
            )}
            {t('clientOverview.saveProfile')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Floating Chatbox - Facebook Messenger-style with error boundary */}
      {/* For business clients, chat via individual owner (business phones are often landlines) */}
      {messageCaseId && !isUnreadError && (
        <ErrorBoundary
          fallback={
            <div className="fixed bottom-6 right-6 z-50 text-xs text-muted-foreground">
              {t('clientDetail.chatboxUnavailable')}
            </div>
          }
        >
          <FloatingChatbox
            context={{
              type: 'case',
              caseId: messageCaseId,
              clientId: ownerIndividual?.id || clientId,
            }}
            headerProps={{
              title: ownerIndividual?.name || client.name,
              phone: ownerIndividual?.phone || client.phone,
            }}
            unreadCount={isUnreadLoading ? 0 : unreadCount}
            onUnreadChange={handleUnreadChange}
          />
        </ErrorBoundary>
      )}
    </PageContainer>
  )
}

