import { ExternalLink, HardDrive, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, buttonVariants } from '@ella/ui'
import { cn } from '@ella/ui'
import type { ClientDriveFolderDto } from '@ella/shared'

interface DriveStructureStatusProps { folder: ClientDriveFolderDto | null; isLoading: boolean; isError: boolean; onCreate: () => void; canManageClients: boolean; isConnected: boolean; isAdmin: boolean }

export function DriveStructureStatus({ folder, isLoading, isError, onCreate, canManageClients, isConnected, isAdmin }: DriveStructureStatusProps) {
  const { t } = useTranslation()
  if (!canManageClients) return null
  if (isLoading) return <Button size="sm" variant="outline" disabled><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t('googleDrive.loading')}</Button>
  if (folder?.status === 'READY') return <div className="flex flex-wrap items-center gap-2" aria-live="polite">{[
    [folder.rootFolderWebUrl, 'root'], [folder.amWorkFolderWebUrl, 'amWork'], [folder.corpAdminFolderWebUrl, 'corpAdmin'], [folder.sharedFolderWebUrl, 'shared'],
  ].filter((entry): entry is [string, string] => Boolean(entry[0])).map(([url, name]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}><ExternalLink className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{t(`googleDrive.open.${name}`)}</a>)}</div>
  const label = !isConnected ? t(isAdmin ? 'googleDrive.configureInSettings' : 'googleDrive.notConnected') : folder?.status === 'FAILED' ? t('googleDrive.retryStructure') : t('googleDrive.createStructure')
  return <Button size="sm" variant="outline" onClick={onCreate} disabled={!isConnected || isError || folder?.status === 'CREATING'}>{folder?.status === 'CREATING' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <HardDrive className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}{folder?.status === 'CREATING' ? t('googleDrive.creating') : label}</Button>
}
