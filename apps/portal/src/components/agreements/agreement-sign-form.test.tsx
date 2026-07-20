import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AgreementSignForm } from './agreement-sign-form'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('AgreementSignForm', () => {
  it('applies containment styles to a wide firm signature and long signer metadata', () => {
    const markup = renderToStaticMarkup(
      <AgreementSignForm
        canSubmit={false}
        submitting={false}
        onSubmit={vi.fn()}
        firmSnapshot={{
          name: 'Ella Tax',
          address: '123 Main Street',
          contact: null,
          signerName: 'Felix-Huynh-With-A-Very-Long-Unbroken-Name',
          signerTitle: 'Senior-Developer-With-A-Very-Long-Unbroken-Title',
          signaturePresignedUrl: 'https://portal.test/very-wide-firm-signature.png',
          signedAt: 'July 20, 2026',
        }}
      />
    )

    expect(markup).toContain('Felix-Huynh-With-A-Very-Long-Unbroken-Name')
    expect(markup).toContain('Senior-Developer-With-A-Very-Long-Unbroken-Title')
    expect(markup).toContain('July 20, 2026')
    expect(markup).toContain('flex flex-wrap items-end gap-3')
    expect(markup).toContain(
      'class="h-16 w-auto max-w-full rounded-md border border-border bg-white object-contain object-left"'
    )
    expect(markup).toContain(
      'class="min-w-0 max-w-full pb-1 text-xs leading-snug text-foreground/80 [overflow-wrap:anywhere]"'
    )
  })
})
