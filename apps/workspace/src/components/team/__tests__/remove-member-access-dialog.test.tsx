import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RemoveMemberAccessDialog } from '../remove-member-access-dialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> | string) => {
      if (typeof options === 'string') return options
      if (key === 'team.removeAccessDescription') return `Remove access for ${options?.name}?`
      if (key === 'team.removeAccessWarningManagedClients') {
        return `${options?.count} managed clients may need reassignment.`
      }
      return typeof options?.defaultValue === 'string' ? options.defaultValue : key
    },
  }),
}))

describe('RemoveMemberAccessDialog', () => {
  it('renders Clerk access and managed client warnings before confirmation', () => {
    const markup = renderToStaticMarkup(
      <RemoveMemberAccessDialog
        open
        staffName="Ada Admin"
        managedClientCount={3}
        membershipStatus="ACTIVE_MATCH"
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(markup).toContain('Remove access for Ada Admin?')
    expect(markup).toContain('They will lose Clerk organization access.')
    expect(markup).toContain('Their Clerk seat will be freed.')
    expect(markup).toContain('The Staff record and historical assignments remain.')
    expect(markup).toContain('3 managed clients may need reassignment.')
  })

  it('uses missing-Clerk copy for active staff without Clerk membership', () => {
    const markup = renderToStaticMarkup(
      <RemoveMemberAccessDialog
        open
        staffName="Missing Clerk"
        managedClientCount={0}
        membershipStatus="ACTIVE_MISSING_CLERK"
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(markup).toContain('No Clerk membership was found; the Staff access record will be archived.')
    expect(markup).not.toContain('Their Clerk seat will be freed.')
  })
})
