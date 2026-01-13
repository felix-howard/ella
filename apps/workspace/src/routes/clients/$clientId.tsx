/**
 * Client Detail Page - Shows client info with tabbed sections
 * Tabs: Overview, Documents, Messages
 */

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
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
} from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
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
import type { ClientDetail, TaxCaseStatus, ChecklistItemStatus } from '../../lib/api-client'

export const Route = createFileRoute('/clients/$clientId')({
  component: ClientDetailPage,
  parseParams: (params) => ({ clientId: params.clientId }),
})

type TabType = 'overview' | 'documents' | 'messages'

function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // TODO: Replace with API call using useSuspenseQuery
  // Mock data for demonstration
  const client: ClientDetail = {
    id: clientId,
    name: 'Nguyễn Văn An',
    phone: '8182223333',
    email: 'an.nguyen@email.com',
    language: 'VI',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-12T14:30:00Z',
    profile: {
      id: 'profile-1',
      filingStatus: 'MARRIED_FILING_JOINTLY',
      hasW2: true,
      hasBankAccount: true,
      hasInvestments: false,
      hasKidsUnder17: true,
      numKidsUnder17: 2,
      paysDaycare: true,
      hasKids17to24: false,
      hasSelfEmployment: false,
      hasRentalProperty: false,
      businessName: null,
      ein: null,
      hasEmployees: false,
      hasContractors: false,
      has1099K: false,
    },
    taxCases: [
      {
        id: 'case-1',
        taxYear: 2025,
        taxTypes: ['FORM_1040'],
        status: 'WAITING_DOCS',
        createdAt: '2026-01-10T10:00:00Z',
        updatedAt: '2026-01-12T14:30:00Z',
        _count: { rawImages: 5, digitalDocs: 3, checklistItems: 8 },
      },
    ],
  }

  // Mock checklist data
  const checklistItems = [
    { id: '1', status: 'VERIFIED', labelVi: 'Thẻ SSN', docType: 'SSN_CARD' },
    { id: '2', status: 'VERIFIED', labelVi: 'Bằng lái / ID', docType: 'DRIVER_LICENSE' },
    { id: '3', status: 'HAS_DIGITAL', labelVi: 'W2', docType: 'W2' },
    { id: '4', status: 'HAS_RAW', labelVi: '1099-INT', docType: 'FORM_1099_INT' },
    { id: '5', status: 'MISSING', labelVi: 'Giấy khai sinh con', docType: 'BIRTH_CERTIFICATE' },
    { id: '6', status: 'MISSING', labelVi: 'Hóa đơn Daycare', docType: 'DAYCARE_RECEIPT' },
  ]

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
                    <span className="text-sm text-foreground">{item.labelVi}</span>
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
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
            <h3 className="font-medium text-foreground mb-1">Quản lý tài liệu</h3>
            <p className="text-sm text-muted-foreground">
              Chức năng này sẽ được triển khai trong các nhiệm vụ tiếp theo (1.3.16-1.3.18)
            </p>
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

