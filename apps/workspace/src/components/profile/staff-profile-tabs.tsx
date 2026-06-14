import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, FileText, Link2, Loader2, Receipt, ShieldAlert, User } from 'lucide-react'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@ella/ui'
import type { AppRole, OrgSettings, ProfileResponse } from '../../lib/api-client'
import { ProfileForm } from './profile-form'
import { AssignedClientsList } from './assigned-clients-list'
import { StaffFormLinkCard } from './staff-form-link-card'
import { StaffDocumentsTab } from './staff-documents-tab'
import { StaffInvoicesTab } from './staff-invoices-tab'

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
  isOwnProfile: boolean
  canArchive: boolean
  isArchived: boolean
  orgSettings?: OrgSettings
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
  isOwnProfile,
  canArchive,
  isArchived,
  orgSettings,
  onRoleChange,
  isRoleChangePending,
  onArchive,
  isArchivePending,
}: StaffProfileTabsProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview')
  const canShowAdminTab = canArchive && !isArchived
  const canAccessStaffFiles = isOwnProfile || canManageTeam
  const activeTabAvailable =
    activeTab === 'overview' ||
    activeTab === 'form-link' ||
    (activeTab === 'admin' && canShowAdminTab) ||
    ((activeTab === 'documents' || activeTab === 'invoices') && canAccessStaffFiles)
  const visibleActiveTab = activeTabAvailable ? activeTab : 'overview'

  useEffect(() => {
    if (activeTab === 'admin' && !canShowAdminTab) setActiveTab('overview')
    if ((activeTab === 'documents' || activeTab === 'invoices') && !canAccessStaffFiles) {
      setActiveTab('overview')
    }
  }, [activeTab, canAccessStaffFiles, canShowAdminTab])

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
          <TabsTrigger value="form-link" className="gap-2">
            <Link2 className="w-4 h-4" />
            {t('profile.tabs.formLink')}
          </TabsTrigger>
          {canShowAdminTab && (
            <TabsTrigger value="admin" className="gap-2">
              <ShieldAlert className="w-4 h-4" />
              {t('profile.tabs.admin')}
            </TabsTrigger>
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
              canChangeRole={canChangeRole}
              onRoleChange={onRoleChange}
              isRoleChangePending={isRoleChangePending}
              canManageContractorAgent={canManageTeam}
              canViewContractorAgreement={isOwnProfile || canManageTeam}
              hideNotifications
            />
          </div>

          <div className="lg:col-span-1">
            <AssignedClientsList clients={managedClients} totalCount={managedCount} />
          </div>
        </div>
      </TabsContent>

      {canAccessStaffFiles && (
        <>
          <TabsContent value="documents">
            <StaffDocumentsTab staffId={staffId} />
          </TabsContent>

          <TabsContent value="invoices">
            <StaffInvoicesTab
              staffId={staffId}
              canManageInvoiceStatus={canManageTeam}
              isOwnProfile={isOwnProfile}
            />
          </TabsContent>
        </>
      )}

      <TabsContent value="form-link">
        <StaffFormLinkCard
          staffId={staffId}
          formSlug={staff.formSlug}
          orgSlug={orgSettings?.slug || null}
          canEdit={canEdit}
          canEditAutoSend={isOwnProfile}
          autoSendUploadLink={staff.autoSendUploadLink ?? false}
          defaultUploadLinkTemplateId={staff.defaultUploadLinkTemplateId}
          templateLanguage={orgSettings?.smsLanguage ?? 'VI'}
        />
      </TabsContent>

      {canShowAdminTab && (
        <TabsContent value="admin">
          <div className="bg-card rounded-xl shadow-sm p-6">
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
        </TabsContent>
      )}
    </Tabs>
  )
}
