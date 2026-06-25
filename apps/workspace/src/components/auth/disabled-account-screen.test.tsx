import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DisabledAccountScreen } from './disabled-account-screen'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

describe('DisabledAccountScreen', () => {
  it('renders disabled-account guidance and sign-out action', () => {
    const markup = renderToStaticMarkup(<DisabledAccountScreen onSignOut={() => undefined} />)

    expect(markup).toContain('Your account has been disabled.')
    expect(markup).toContain('Contact admin if you need access to Ella Workspace.')
    expect(markup).toContain('Sign out')
  })
})
