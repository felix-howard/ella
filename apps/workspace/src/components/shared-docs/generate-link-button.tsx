/**
 * GenerateLinkButton - Small action button rendered in the no-link state.
 * Disables itself while mutation is pending to prevent concurrent LINK_EXISTS errors.
 */
import { useTranslation } from 'react-i18next'
import { Link2, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'

interface GenerateLinkButtonProps {
  onClick: () => void
  isLoading?: boolean
}

export function GenerateLinkButton({ onClick, isLoading = false }: GenerateLinkButtonProps) {
  const { t } = useTranslation()
  return (
    <Button
      variant="default"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
      className="gap-1.5 h-8"
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Link2 className="w-3.5 h-3.5" />
      )}
      {t('sharedDocs.actions.generate')}
    </Button>
  )
}
