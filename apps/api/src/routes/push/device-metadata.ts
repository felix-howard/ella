const USER_AGENT_MAX_LENGTH = 500

export function summarizeUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null
  const browser = userAgent.includes('Edg/')
    ? 'Edge'
    : userAgent.includes('Firefox/')
      ? 'Firefox'
      : userAgent.includes('CriOS') || userAgent.includes('Chrome/')
        ? 'Chrome'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Browser'
  const platform = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : userAgent.includes('Android')
      ? 'Android'
      : userAgent.includes('Windows')
        ? 'Windows'
        : userAgent.includes('Mac OS X')
          ? 'macOS'
          : 'Device'

  return `${platform} ${browser}`.slice(0, USER_AGENT_MAX_LENGTH)
}

export function buildDeviceLabel(userAgentSummary: string | null): string {
  return `${userAgentSummary ?? 'Browser'} device`.slice(0, 120)
}
