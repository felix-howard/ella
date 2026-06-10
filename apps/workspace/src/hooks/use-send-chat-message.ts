/**
 * useSendChatMessage - Send an outbound message from the chatbox.
 * Performs optimistic insertion + rollback on error, routes to the
 * correct API endpoint based on ChatContext discriminator.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api-client'
import { toast } from '../stores/toast-store'
import type { ChatContext } from '../types/chat-context'
import { chatContextId } from '../types/chat-context'
import type { Message } from '../lib/api-client'

export interface SendChatMessageVariables {
  content: string
  channel: 'SMS' | 'PORTAL'
  attachments?: File[]
}

export interface UseSendChatMessageOptions {
  /** Called after the server confirms the send (useful for refetching unread counts). */
  onSent?: () => void
}

interface MessagesPage {
  messages: Message[]
  [key: string]: unknown
}

type LocalMessage = Message & { _optimistic: 'sending' }

export function useSendChatMessage(context: ChatContext, options: UseSendChatMessageOptions = {}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ['messages', context.type, chatContextId(context)] as const
  const { onSent } = options

  return useMutation({
    mutationFn: (vars: SendChatMessageVariables) => {
      if (context.type === 'case') {
        if (vars.attachments && vars.attachments.length > 0) {
          return api.messages.sendWithAttachments({
            caseId: context.caseId,
            content: vars.content,
            images: vars.attachments,
          })
        }
        return api.messages.send({ caseId: context.caseId, content: vars.content, channel: vars.channel })
      }
      if (vars.attachments && vars.attachments.length > 0) {
        throw new Error('Lead message attachments are not supported')
      }
      // Lead SMS is always SMS channel; API enforces but pass explicit for clarity.
      return api.leads.messages.send(context.leadId, { content: vars.content, channel: 'SMS' })
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<MessagesPage>(queryKey)

      const tempId = `temp-${Date.now()}`
      const previewUrls = context.type === 'case'
        ? (vars.attachments ?? []).map((file) => URL.createObjectURL(file))
        : []

      const tempMessage: LocalMessage = {
        id: tempId,
        conversationId: context.type === 'case' ? context.caseId : null,
        leadId: context.type === 'lead' ? context.leadId : null,
        channel: vars.channel,
        direction: 'OUTBOUND',
        content: vars.content,
        attachmentUrls: previewUrls,
        createdAt: new Date().toISOString(),
        _optimistic: 'sending',
      }

      queryClient.setQueryData<MessagesPage>(queryKey, (old) => ({
        ...(old ?? { messages: [] }),
        messages: [...(old?.messages ?? []), tempMessage],
      }))

      return { previous, tempId, previewUrls }
    },
    onSuccess: (data, _vars, ctx) => {
      if (ctx?.tempId) {
        queryClient.setQueryData<MessagesPage>(queryKey, (old) => ({
          ...(old ?? { messages: [] }),
          messages: [
            ...(old?.messages ?? []).filter((message) =>
              message.id !== ctx.tempId && message.id !== data.message.id
            ),
            data.message,
          ],
        }))
      }
      ctx?.previewUrls.forEach((url) => URL.revokeObjectURL(url))
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      onSent?.()
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous)
      }
      ctx?.previewUrls.forEach((url) => URL.revokeObjectURL(url))
      toast.error(t('chat.sendError'))
    },
  })
}
