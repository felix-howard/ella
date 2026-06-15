/**
 * Setup-required card shown by the wizard pre-flight gate when the current
 * staff or their organization is missing data needed to send a v2 NDA.
 *
 * Each missing item links into the relevant setup surface (signature/title →
 * own Team profile, address/governing law → Settings general). Non-admins cannot fix org-level
 * gaps so they get a "contact your admin" message instead of an action button.
 */
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react'
import { Button } from '@ella/ui'
import { useOrgRole } from '../../hooks/use-org-role'

type Missing = 'signature' | 'title' | 'orgAddress' | 'orgGoverningLaw' | 'orgContact'

interface Props {
  missing: Missing[]
  isRefreshing: boolean
  /** True when the readiness query failed — render an error variant so the user
   *  isn't silently fail-opened past the gate. */
  hasError?: boolean
  onClose: () => void
}

type StaffFocus = 'signature' | 'title'
type OrgFocus = 'firm-info'

interface BaseItemConfig {
  key: Missing
  labelKey: string
  helperKey: string
}

type ItemConfig =
  | (BaseItemConfig & { scope: 'staff'; focus: StaffFocus })
  | (BaseItemConfig & { scope: 'org'; focus: OrgFocus })

const ITEMS: ItemConfig[] = [
  { key: 'signature',       scope: 'staff', focus: 'signature',  labelKey: 'agreements.setup.signature.label',       helperKey: 'agreements.setup.signature.helper' },
  { key: 'title',           scope: 'staff', focus: 'title',      labelKey: 'agreements.setup.title.label',           helperKey: 'agreements.setup.title.helper' },
  { key: 'orgAddress',      scope: 'org',   focus: 'firm-info',  labelKey: 'agreements.setup.orgAddress.label',      helperKey: 'agreements.setup.orgAddress.helper' },
  { key: 'orgGoverningLaw', scope: 'org',   focus: 'firm-info',  labelKey: 'agreements.setup.orgGoverningLaw.label', helperKey: 'agreements.setup.orgGoverningLaw.helper' },
  { key: 'orgContact',      scope: 'org',   focus: 'firm-info',  labelKey: 'agreements.setup.orgContact.label',      helperKey: 'agreements.setup.orgContact.helper' },
]

export function NdaSetupRequiredCard({ missing, isRefreshing, hasError, onClose }: Props) {
  const { t } = useTranslation()
  const { canManageClients } = useOrgRole()
  const qc = useQueryClient()

  const refresh = () => qc.invalidateQueries({ queryKey: ['nda-readiness'] })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {hasError ? t('agreements.setup.error.title') : t('agreements.setup.title')}
          </h4>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasError ? t('agreements.setup.error.subtitle') : t('agreements.setup.subtitle')}
          </p>
        </div>
      </div>

      {!hasError && <ul className="space-y-2">
        {ITEMS.map((item) => {
          const isMissing = missing.includes(item.key)
          const canFix = isMissing && (item.scope === 'staff' || canManageClients)

          return (
            <li
              key={item.key}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <span
                className={
                  'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ' +
                  (isMissing ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40')
                }
              >
                {isMissing ? (
                  <X className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                ) : (
                  <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {t(item.labelKey)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(item.helperKey)}
                </p>
              </div>
              {isMissing && (
                canFix ? (
                  item.scope === 'staff' ? (
                    <RouterLink
                      to="/team/profile/$staffId"
                      params={{ staffId: 'me' }}
                      search={{ focus: item.focus }}
                      className="text-sm font-medium text-primary hover:underline flex-shrink-0"
                      onClick={onClose}
                    >
                      {t('agreements.setup.action.setUp')}
                    </RouterLink>
                  ) : (
                    <RouterLink
                      to="/settings"
                      search={{ tab: 'general', focus: item.focus }}
                      className="text-sm font-medium text-primary hover:underline flex-shrink-0"
                      onClick={onClose}
                    >
                      {t('agreements.setup.action.setUp')}
                    </RouterLink>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {t('agreements.setup.action.contactAdmin')}
                  </span>
                )
              )}
            </li>
          )
        })}
      </ul>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          <RefreshCw className={'w-4 h-4 mr-2 ' + (isRefreshing ? 'animate-spin' : '')} />
          {t('agreements.setup.action.refresh')}
        </Button>
      </div>
    </div>
  )
}
