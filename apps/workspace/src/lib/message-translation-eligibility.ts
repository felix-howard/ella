import type { Message } from './api-client'

type TranslationMessage = Pick<
  Message,
  'channel' | 'content' | 'attachmentUrls' | 'leadId'
> & {
  _optimistic?: 'sending' | 'failed'
}

export function isMessageTranslationEligible(message: TranslationMessage): boolean {
  const hasText = message.content.trim().length > 0
  const isImageOnly = Boolean(message.attachmentUrls?.length) && !hasText

  return (
    hasText &&
    !isImageOnly &&
    message.channel !== 'SYSTEM' &&
    message.channel !== 'CALL' &&
    !message.leadId &&
    !message._optimistic
  )
}
