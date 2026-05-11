import { describe, expect, it } from 'vitest'
import { buildWelcomeMessageFromTemplate } from '../message-sender'

describe('buildWelcomeMessageFromTemplate', () => {
  it('replaces the portal link placeholder when present', () => {
    const body = buildWelcomeMessageFromTemplate(
      'Hello {{client_name}}, upload for {{tax_year}} here: {{portal_link}}',
      'Phuoc Huynh',
      2025,
      'https://portal.test/upload/token'
    )

    expect(body).toBe('Hello Phuoc Huynh, upload for 2025 here: https://portal.test/upload/token')
  })

  it('appends the portal link when a custom message removed the placeholder', () => {
    const body = buildWelcomeMessageFromTemplate(
      'Xin chao {{client_name}}, vui long gui ho so thue nam {{tax_year}} qua link:',
      'Phuoc Huynh',
      2025,
      'https://portal.test/upload/token'
    )

    expect(body).toBe(
      'Xin chao Phuoc Huynh, vui long gui ho so thue nam 2025 qua link:\nhttps://portal.test/upload/token'
    )
  })
})
