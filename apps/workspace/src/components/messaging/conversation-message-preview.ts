import { sanitizeText } from '../../lib/formatters'
import { isOutboundTranslatedSms } from '../../lib/message-reply-translation'
import { parseTapbackReaction } from '../../lib/message-reactions'
import type { Conversation } from '../../lib/api-client'

export type PreviewTranslator = (
  key: string,
  options?: string | Record<string, unknown>
) => string

export function getConversationMessagePreview(
  lastMessage: Conversation['lastMessage'],
  t: PreviewTranslator
): string {
  if (!lastMessage) return t('messages.noMessages')

  const tapback = lastMessage.direction === 'INBOUND' && lastMessage.channel === 'SMS'
    ? parseTapbackReaction(lastMessage.content)
    : null
  if (tapback?.type === 'love') {
    return t('messages.lovedMessage', 'Loved a message')
  }
  if (lastMessage.channel === 'CALL') {
    // Translate call messages instead of showing hardcoded Vietnamese from DB.
    if (lastMessage.callStatus === 'completed' && lastMessage.recordingDuration) {
      const mins = Math.floor(lastMessage.recordingDuration / 60)
      const secs = lastMessage.recordingDuration % 60
      return t('call.preview', { duration: `${mins}:${secs.toString().padStart(2, '0')}` })
    }
    if (lastMessage.callStatus === 'busy') return t('call.previewBusy')
    if (lastMessage.callStatus === 'no-answer') return t('call.previewNoAnswer')
    if (lastMessage.callStatus === 'failed' || lastMessage.callStatus === 'canceled') return t('call.previewFailed')
    return t('call.previewDefault')
  }

  const contentText = sanitizeText(lastMessage.content)
  if (!contentText.trim() && lastMessage.attachmentUrls?.length) {
    return t('messages.imageAttachment', 'Sent a photo')
  }

  const previewSource = isOutboundTranslatedSms(lastMessage)
    ? lastMessage.staffAuthoredContent ?? ''
    : lastMessage.content
  const text = sanitizeText(previewSource)
  return text.slice(0, 60) + (text.length > 60 ? '...' : '')
}
