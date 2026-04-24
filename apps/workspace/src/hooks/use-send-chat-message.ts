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
}

export interface UseSendChatMessageOptions {
  /** Called after the server confirms the send (useful for refetching unread counts). */
  onSent?: () => void
}

interface MessagesPage {
  messages: Message[]
  [key: string]: unknown
}

export function useSendChatMessage(context: ChatContext, options: UseSendChatMessageOptions = {}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ['messages', context.type, chatContextId(context)] as const
  const { onSent } = options

  return useMutation({
    mutationFn: (vars: SendChatMessageVariables) => {
      if (context.type === 'case') {
        return api.messages.send({ caseId: context.caseId, ...vars })
      }
      // Lead SMS is always SMS channel; API enforces but pass explicit for clarity.
      return api.leads.messages.send(context.leadId, { content: vars.content, channel: 'SMS' })
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<MessagesPage>(queryKey)

      const tempMessage: Message & { _optimistic: 'sending' } = {
        id: `temp-${Date.now()}`,
        conversationId: context.type === 'case' ? context.caseId : null,
        leadId: context.type === 'lead' ? context.leadId : null,
        channel: vars.channel,
        direction: 'OUTBOUND',
        content: vars.content,
        createdAt: new Date().toISOString(),
        _optimistic: 'sending',
      }

      queryClient.setQueryData<MessagesPage>(queryKey, (old) => ({
        ...(old ?? { messages: [] }),
        messages: [...(old?.messages ?? []), tempMessage],
      }))

      return { previous }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      onSent?.()
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous)
      }
      toast.error(t('chat.sendError'))
    },
  })
}
