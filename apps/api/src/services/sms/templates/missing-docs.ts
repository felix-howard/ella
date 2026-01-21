/**
 * Missing Documents Reminder Template
 * Sent when client has outstanding checklist items
 */

export interface MissingDocsTemplateParams {
  clientName: string
  magicLink: string
  missingDocs: string[]
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: MissingDocsTemplateParams) => {
    const docsList = params.missingDocs.slice(0, 5).join('\n- ')
    const moreCount = Math.max(0, params.missingDocs.length - 5)
    const moreText = moreCount > 0 ? `\n(và ${moreCount} tài liệu khác)` : ''

    return `Xin chào ${params.clientName},

Chúng tôi vẫn đang chờ các tài liệu sau từ bạn:
- ${docsList}${moreText}

Vui lòng gửi tại: ${params.magicLink}

Cảm ơn bạn!`
  },

  EN: (params: MissingDocsTemplateParams) => {
    const docsList = params.missingDocs.slice(0, 5).join('\n- ')
    const moreCount = Math.max(0, params.missingDocs.length - 5)
    const moreText = moreCount > 0 ? `\n(and ${moreCount} more)` : ''

    return `Hi ${params.clientName},

We're still waiting for the following documents:
- ${docsList}${moreText}

Please upload at: ${params.magicLink}

Thank you!`
  },
}

export function generateMissingDocsMessage(
  params: MissingDocsTemplateParams
): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const MISSING_DOCS_TEMPLATE_NAME = 'missing_docs' as const
