import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NdaSetupRequiredCard } from './nda-setup-required-card'

const mocks = vi.hoisted(() => ({
  canManageOrganizationSettings: false,
  invalidateQueries: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    search,
    to,
    ...props
  }: {
    children?: ReactNode
    params?: Record<string, string>
    search?: Record<string, string>
    to?: string
    className?: string
    onClick?: () => void
  }) => {
    const path = to?.replace('$staffId', params?.staffId ?? '') ?? '#'
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    return <a href={`${path}${query}`} {...props}>{children}</a>
  },
}))

vi.mock('../../hooks/use-org-role', () => ({
  useOrgRole: () => ({
    canManageOrganizationSettings: mocks.canManageOrganizationSettings,
  }),
}))

function renderCard(missing: Array<'signature' | 'title' | 'orgAddress' | 'orgGoverningLaw' | 'orgContact'>) {
  return renderToStaticMarkup(
    <NdaSetupRequiredCard
      missing={missing}
      isRefreshing={false}
      onClose={() => undefined}
    />
  )
}

describe('NdaSetupRequiredCard', () => {
  beforeEach(() => {
    mocks.canManageOrganizationSettings = false
    mocks.invalidateQueries.mockClear()
  })

  it('lets non-admin staff fix staff-scoped setup but not organization settings', () => {
    const markup = renderCard(['signature', 'orgAddress'])

    expect(markup).toContain('/team/profile/me?focus=signature')
    expect(markup).toContain('agreements.setup.action.setUp')
    expect(markup).toContain('agreements.setup.action.contactAdmin')
    expect(markup).not.toContain('/settings?tab=organization&amp;focus=firm-info')
  })

  it('lets admins fix organization-scoped setup in settings', () => {
    mocks.canManageOrganizationSettings = true

    const markup = renderCard(['orgAddress'])

    expect(markup).toContain('/settings?tab=organization&amp;focus=firm-info')
    expect(markup).toContain('agreements.setup.action.setUp')
    expect(markup).not.toContain('agreements.setup.action.contactAdmin')
  })
})
