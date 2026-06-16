import { useState } from 'react'
import { Loader2, Type } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '@ella/ui'
import { api } from '../../lib/api-client'
import type { RegistrationHeaderMode } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useOrgRole } from '../../hooks/use-org-role'
import { RegistrationHeaderFields } from '../leads/registration-header-fields'

function headerPayload(mode: RegistrationHeaderMode, title: string, subtitle: string) {
  return {
    registrationHeaderMode: mode,
    registrationTitle: mode === 'CUSTOM' ? title.trim() || null : null,
    registrationSubtitle: mode === 'CUSTOM' ? subtitle.trim() || null : null,
  }
}

export function RegistrationHeaderSettingsCard() {
  const { canManageClients } = useOrgRole()
  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  if (isLoading || !canManageClients || !data) return null

  const headerKey = [
    data.registrationHeaderMode,
    data.registrationTitle ?? '',
    data.registrationSubtitle ?? '',
  ].join(':')

  return (
    <RegistrationHeaderSettingsForm
      key={headerKey}
      initialMode={data.registrationHeaderMode}
      initialTitle={data.registrationTitle ?? ''}
      initialSubtitle={data.registrationSubtitle ?? ''}
    />
  )
}

interface RegistrationHeaderSettingsFormProps {
  initialMode: RegistrationHeaderMode
  initialTitle: string
  initialSubtitle: string
}

function RegistrationHeaderSettingsForm({
  initialMode,
  initialTitle,
  initialSubtitle,
}: RegistrationHeaderSettingsFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<RegistrationHeaderMode>(initialMode)
  const [title, setTitle] = useState(initialTitle)
  const [subtitle, setSubtitle] = useState(initialSubtitle)
  const mutation = useMutation({
    mutationFn: () => api.orgSettings.update(headerPayload(mode, title, subtitle)),
    onSuccess: (result) => {
      queryClient.setQueryData(['org-settings'], result)
      toast.success(t('settings.saved'))
    },
    onError: () => toast.error(t('settings.saveFailed')),
  })

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Type className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {t('settings.registrationHeaderTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('settings.registrationHeaderDescription')}
          </p>
        </div>
      </div>

      <RegistrationHeaderFields
        mode={mode}
        title={title}
        subtitle={subtitle}
        onModeChange={setMode}
        onTitleChange={setTitle}
        onSubtitleChange={setSubtitle}
        legend={t('settings.registrationHeaderMode')}
        description={t('settings.registrationHeaderModeDescription')}
        defaultLabel={t('registrationHeader.default')}
        customLabel={t('registrationHeader.custom')}
        hiddenLabel={t('registrationHeader.hidden')}
        defaultHelper={t('settings.registrationHeaderDefaultHelper')}
        customHelper={t('registrationHeader.customHelper')}
        hiddenHelper={t('registrationHeader.hiddenHelper')}
        titleLabel={t('registrationHeader.titleLabel')}
        subtitleLabel={t('registrationHeader.subtitleLabel')}
        titlePlaceholder={t('registrationHeader.titlePlaceholder')}
        subtitlePlaceholder={t('registrationHeader.subtitlePlaceholder')}
        disabled={mutation.isPending}
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
        </Button>
      </div>
    </Card>
  )
}
