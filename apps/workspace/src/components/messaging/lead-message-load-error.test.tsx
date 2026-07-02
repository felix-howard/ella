import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LeadMessageLoadError } from './lead-message-load-error'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    className,
    children,
    'aria-label': ariaLabel,
  }: {
    to: string
    className?: string
    children: React.ReactNode
    'aria-label'?: string
  }) => (
    <a href={to} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

describe('LeadMessageLoadError', () => {
  it('renders a back link and explanatory error copy', () => {
    const markup = renderToStaticMarkup(
      <LeadMessageLoadError
        backLabel="Back to Lead Messages"
        title="Unable to load lead conversation"
        description="The lead may no longer exist or you may not have access."
      />
    )

    expect(markup).toContain('aria-label="Back to Lead Messages"')
    expect(markup).toContain('href="/lead-messages"')
    expect(markup).toContain('Unable to load lead conversation')
    expect(markup).toContain('may no longer exist')
  })
})
