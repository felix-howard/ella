import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, FileText, Loader2, Receipt, User } from 'lucide-react'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@ella/ui'
import type { AppRole, OrgSettings, ProfileResponse } from '../../lib/api-client'
import { ProfileForm } from './profile-form'
import { AssignedClientsList } from './assigned-clients-list'
import { StaffFormLinkCard } from './staff-form-link-card'
import { StaffDocumentsTab } from './staff-documents-tab'
import { StaffInvoicesTab } from './staff-invoices-tab'
import { SignaturePadCard } from './signature-pad-card'
import { StaffPaymentInfoCard } from './staff-payment-info-card'

type Staff = ProfileResponse['staff']
type ManagedClient = ProfileResponse['managedClients'][number]

interface StaffProfileTabsProps {
  staff: Staff
  staffId: string
  managedClients: ManagedClient[]
  managedCount: number
  canEdit: boolean
  canChangeRole: boolean
  canManageTeam: boolean
  canManageAnyIntakeLink: boolean
  isOwnProfile: boolean
  canArchive: boolean
  isArchived: boolean
  orgSettings?: OrgSettings
  isOrgSettingsLoading?: boolean
  onRoleChange: (role: AppRole) => Promise<void>
  isRoleChangePending: boolean
  onArchive: () => void
  isArchivePending: boolean
}

export function StaffProfileTabs({
  staff,
  staffId,
  managedClients,
  managedCount,
  canEdit,
  canChangeRole,
  canManageTeam,
  canManageAnyIntakeLink,
  isOwnProfile,
  canArchive,
  isArchived,
  orgSettings,
  isOrgSettingsLoading = false,
  onRoleChange,
  isRoleChangePending,
  onArchive,
  isArchivePending,
}: StaffProfileTabsProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview')
  const canShowDangerZone = canArchive && !isOwnProfile && !isArchived
  const canShowRoleControl = canChangeRole && !isOwnProfile
  const canShowContractorAgentControl = canManageTeam && !isOwnProfile
  const canAccessStaffFiles = canEdit
  const canManageProfileIntakeLink = isOwnProfile || canManageAnyIntakeLink
  const activeTabAvailable =
    activeTab === 'overview' ||
    ((activeTab === 'documents' || activeTab === 'invoices') && canAccessStaffFiles)
  const visibleActiveTab = activeTabAvailable ? activeTab : 'overview'

  return (
    <Tabs
      defaultValue="overview"
      value={visibleActiveTab}
      onValueChange={setActiveTab}
      variant="underline"
      className="mt-2"
    >
      <div className="overflow-x-auto">
        <TabsList className="min-w-max">
          <TabsTrigger value="overview" className="gap-2">
            <User className="w-4 h-4" />
            {t('profile.tabs.overview')}
          </TabsTrigger>
          {canAccessStaffFiles && (
            <>
              <TabsTrigger value="documents" className="gap-2">
                <FileText className="w-4 h-4" />
                {t('profile.tabs.documents')}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2">
                <Receipt className="w-4 h-4" />
                {t('profile.tabs.invoices')}
              </TabsTrigger>
            </>
          )}
        </TabsList>
      </div>

      <TabsContent value="overview">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProfileForm
              staff={staff}
              canEdit={canEdit}
              staffId={staffId}
              canChangeRole={canShowRoleControl}
              onRoleChange={onRoleChange}
              isRoleChangePending={isRoleChangePending}
              canManageContractorAgent={canShowContractorAgentControl}
              canViewContractorAgreement={isOwnProfile || canManageTeam}
              hideNotifications
              isOwnProfile={isOwnProfile}
            />
          </div>

          <div className="space-y-6 lg:col-span-1">
            <StaffFormLinkCard
              staffName={staff.name}
              formSlug={staff.formSlug}
              orgSlug={orgSettings?.slug || null}
              canManageIntakeLinks={canManageProfileIntakeLink}
              isOrgSettingsLoading={isOrgSettingsLoading}
            />
            <AssignedClientsList clients={managedClients} totalCount={managedCount} />
            {canAccessStaffFiles && (
              <StaffPaymentInfoCard
                staffId={staffId}
                paymentInfos={staff.paymentInfos}
                canEdit={canEdit}
              />
            )}
          </div>
        </div>

        {isOwnProfile && (
          <div className="mt-6">
            <SignaturePadCard />
          </div>
        )}

        {canShowDangerZone && (
          <div className="bg-card rounded-xl shadow-sm p-6 mt-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('team.dangerZone')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('team.archiveDescription')}</p>
            <Button
              variant="outline"
              onClick={onArchive}
              disabled={isArchivePending}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              {isArchivePending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Archive className="w-4 h-4 mr-2" />
              )}
              {t('team.archiveMember')}
            </Button>
          </div>
        )}
      </TabsContent>

      {canAccessStaffFiles && (
        <>
          <TabsContent value="documents">
            <StaffDocumentsTab staffId={staffId} />
          </TabsContent>

          <TabsContent value="invoices">
            <StaffInvoicesTab
              staffId={staffId}
              isOwnProfile={isOwnProfile}
            />
          </TabsContent>
        </>
      )}

    </Tabs>
  )
}
