import type { CampaignHeaderInfo, RegistrationHeaderMode } from './form-api'

export interface ResolvedRegistrationHeader {
  visible: boolean
  title: string
  subtitle: string
}

interface HeaderConfig {
  mode?: RegistrationHeaderMode | null
  title?: string | null
  subtitle?: string | null
}

interface ResolveRegistrationHeaderInput {
  campaign?: CampaignHeaderInfo | null
  fallbackTitle: string
  fallbackSubtitle: string
}

function normalizeMode(mode?: RegistrationHeaderMode | null): RegistrationHeaderMode {
  return mode ?? 'DEFAULT'
}

function resolveConfig(
  config: HeaderConfig,
  fallbackTitle: string,
  fallbackSubtitle: string
): ResolvedRegistrationHeader {
  const mode = normalizeMode(config.mode)

  if (mode === 'HIDDEN') {
    return { visible: false, title: '', subtitle: '' }
  }

  if (mode === 'CUSTOM') {
    const title = config.title?.trim() ?? ''
    const subtitle = config.subtitle?.trim() ?? ''

    return {
      visible: Boolean(title || subtitle),
      title,
      subtitle,
    }
  }

  return {
    visible: Boolean(fallbackTitle || fallbackSubtitle),
    title: fallbackTitle,
    subtitle: fallbackSubtitle,
  }
}

export function resolveRegistrationHeader({
  campaign,
  fallbackTitle,
  fallbackSubtitle,
}: ResolveRegistrationHeaderInput): ResolvedRegistrationHeader {
  return resolveConfig(campaign ?? { mode: 'DEFAULT' }, fallbackTitle, fallbackSubtitle)
}
