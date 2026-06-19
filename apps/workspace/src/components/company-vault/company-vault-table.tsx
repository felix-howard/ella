import { useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import { copyToClipboard } from '../../lib/clipboard'
import type { CompanyVaultCredential } from '../../lib/api-client'

interface CompanyVaultTableProps {
  credentials: CompanyVaultCredential[]
  onEdit: (credential: CompanyVaultCredential) => void
  onDelete: (credential: CompanyVaultCredential) => void
}

function displayValue(value: string | null): string {
  return value === null || value === '' ? '-' : value
}

function hasValue(value: string | null): value is string {
  return value !== null && value !== ''
}

export function CompanyVaultTable({ credentials, onEdit, onDelete }: CompanyVaultTableProps) {
  const { t } = useTranslation()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async (
    key: string,
    value: string,
    successMsg: string
  ) => {
    const copied = await copyToClipboard(value, { successMsg })
    if (!copied) return

    setCopiedKey(key)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => {
      setCopiedKey(null)
      copiedTimerRef.current = null
    }, 1500)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed">
          <thead className="border-b border-border/50 bg-muted/40">
            <tr>
              <th className="w-[22%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {t('companyVault.toolName')}
              </th>
              <th className="w-[21%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {t('companyVault.username')}
              </th>
              <th className="w-[21%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {t('companyVault.password')}
              </th>
              <th className="w-[24%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {t('companyVault.note')}
              </th>
              <th className="w-[12%] px-4 py-3 text-right text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {t('companyVault.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {credentials.map((credential) => (
              <tr key={credential.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light">
                      <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <span className="truncate text-sm font-medium text-foreground">
                      {credential.toolName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="block min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                      {displayValue(credential.username)}
                    </span>
                    {hasValue(credential.username) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 flex-shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary"
                        aria-label={t('companyVault.copyUsername')}
                        title={t('companyVault.copyUsername')}
                        onClick={() => void handleCopy(
                          `${credential.id}:username`,
                          credential.username!,
                          t('companyVault.usernameCopied')
                        )}
                      >
                        {copiedKey === `${credential.id}:username` ? (
                          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="block min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                      {displayValue(credential.password)}
                    </span>
                    {hasValue(credential.password) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 flex-shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary"
                        aria-label={t('companyVault.copyPassword')}
                        title={t('companyVault.copyPassword')}
                        onClick={() => void handleCopy(
                          `${credential.id}:password`,
                          credential.password!,
                          t('companyVault.passwordCopied')
                        )}
                      >
                        {copiedKey === `${credential.id}:password` ? (
                          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="block truncate text-sm text-muted-foreground">
                    {displayValue(credential.note)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label={t('companyVault.editCredential', { toolName: credential.toolName })}
                      title={t('common.edit')}
                      onClick={() => onEdit(credential)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('companyVault.deleteCredential', { toolName: credential.toolName })}
                      title={t('common.delete')}
                      onClick={() => onDelete(credential)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
