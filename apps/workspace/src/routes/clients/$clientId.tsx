/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Documents, Messages
 */

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
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
} from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { ChecklistGrid } from '../../components/cases'
import { RawImageGallery } from '../../components/cases'
import { DigitalDocTable } from '../../components/cases'
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_COLORS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_COLORS,
  TAX_TYPE_LABELS,
  FILING_STATUS_LABELS,
  LANGUAGE_LABELS,
  UI_TEXT,
} from '../../lib/constants'
import { formatPhone, getInitials, copyToClipboard } from '../../lib/formatters'
import { api, type ClientDetail, type TaxCaseStatus, type ChecklistItemStatus, type ChecklistItem, type RawImage, type DigitalDoc } from '../../lib/api-client'

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
})

type TabType = 'overview' | 'documents' | 'messages'

function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [copiedField, setCopiedField] = useState<string | null>(null)

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
  const rawImages = imagesResponse?.images ?? []
  const digitalDocs = docsResponse?.docs ?? []

  const latestCase = client.taxCases[0]
  const caseStatus = latestCase?.status as TaxCaseStatus
  const statusColors = CASE_STATUS_COLORS[caseStatus]

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const { clients: clientsText } = UI_TEXT
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
            <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-xl">
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

          {/* Status Badge & Edit */}
          <div className="flex items-center gap-3">
            {statusColors && (
              <span
                className={cn(
                  'text-sm font-medium px-3 py-1.5 rounded-full',
                  statusColors.bg,
                  statusColors.text
                )}
              >
                {CASE_STATUS_LABELS[caseStatus]}
              </span>
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
            />
          </div>

          {/* Raw Images Gallery */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Ảnh đã tải lên ({rawImages.length})
            </h2>
            <RawImageGallery
              images={rawImages}
              onImageClick={(img) => console.log('Clicked image:', img.id)}
              onClassify={(img) => console.log('Classify image:', img.id)}
            />
          </div>

          {/* Digital Docs Table */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Tài liệu đã trích xuất ({digitalDocs.length})
            </h2>
            <DigitalDocTable
              docs={digitalDocs}
              onDocClick={(doc) => console.log('Clicked doc:', doc.id)}
              onVerify={(doc) => console.log('Verify doc:', doc.id)}
            />
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
            <h3 className="font-medium text-foreground mb-1">Tin nhắn với khách hàng</h3>
            <p className="text-sm text-muted-foreground">
              Chức năng này sẽ được triển khai trong các nhiệm vụ tiếp theo (1.3.28-1.3.32)
            </p>
          </div>
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

