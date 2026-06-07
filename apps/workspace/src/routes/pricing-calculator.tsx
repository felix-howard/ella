import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageContainer } from '../components/layout'
import { PricingCalculatorShell } from '../components/pricing'
import { useOrgRole } from '../hooks/use-org-role'

export const Route = createFileRoute('/pricing-calculator')({
  component: PricingCalculatorPage,
})

function PricingCalculatorPage() {
  const navigate = useNavigate()
  const { canManageClients, isLoading, isError } = useOrgRole()

  return (
    <PageContainer>
      <PricingCalculatorShell
        canAccess={canManageClients}
        isLoading={isLoading}
        hasRoleError={isError}
        onBackToDashboard={() => navigate({ to: '/' })}
      />
    </PageContainer>
  )
}
