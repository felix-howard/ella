import type { ResolvedRegistrationHeader } from '../../lib/registration-header'

interface RegistrationPageHeaderProps {
  header: ResolvedRegistrationHeader
}

export function RegistrationPageHeader({ header }: RegistrationPageHeaderProps) {
  if (!header.visible) return null

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-5 pt-4 text-center sm:px-6 sm:pb-6">
      {header.title && (
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {header.title}
        </h2>
      )}
      {header.subtitle && (
        <p className="mx-auto mt-2 max-w-xl text-base leading-6 text-muted-foreground">
          {header.subtitle}
        </p>
      )}
    </section>
  )
}
