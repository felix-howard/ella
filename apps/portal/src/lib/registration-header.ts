import type { CampaignHeaderInfo, OrgInfo, RegistrationHeaderMode } from './form-api'

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
  org: Pick<OrgInfo, 'registrationHeaderMode' | 'registrationTitle' | 'registrationSubtitle'>
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
  org,
  campaign,
  fallbackTitle,
  fallbackSubtitle,
}: ResolveRegistrationHeaderInput): ResolvedRegistrationHeader {
  const orgHeader = {
    mode: org.registrationHeaderMode,
    title: org.registrationTitle,
    subtitle: org.registrationSubtitle,
  }

  if (!campaign || normalizeMode(campaign.mode) === 'DEFAULT') {
    return resolveConfig(orgHeader, fallbackTitle, fallbackSubtitle)
  }

  return resolveConfig(campaign, fallbackTitle, fallbackSubtitle)
}
