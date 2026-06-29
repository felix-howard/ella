import type { Message } from './api-client'

type ReplyTranslationMessage = Pick<
  Message,
  'channel' | 'contentLanguage' | 'direction' | 'staffAuthoredContent' | 'staffAuthoredLanguage'
>

export function isOutboundTranslatedSms(message: ReplyTranslationMessage): boolean {
  return (
    message.direction === 'OUTBOUND'
    && message.channel === 'SMS'
    && message.contentLanguage === 'VI'
    && message.staffAuthoredLanguage === 'EN'
    && Boolean(message.staffAuthoredContent?.trim())
  )
}
