/**
 * Messages Index - Empty state when no conversation is selected
 * Auto-redirects to first conversation if available
 */

import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { api } from '../../lib/api-client'

export const Route = createFileRoute('/messages/')({
  component: MessagesIndex,
})

function MessagesIndex() {
  const navigate = useNavigate()

  // Fetch conversations to auto-redirect to first one
  const { data } = useSuspenseQuery({
    queryKey: ['conversations', { limit: 1 }],
    queryFn: () => api.messages.listConversations({ limit: 1 }),
  })

  // Auto-redirect to first conversation if available
  useEffect(() => {
    if (data?.conversations?.length > 0) {
      navigate({
        to: '/messages/$caseId',
        params: { caseId: data.conversations[0].caseId },
        replace: true,
      })
    }
  }, [data, navigate])

  // Show empty state while redirecting or if no conversations
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          Chọn cuộc hội thoại
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Chọn một cuộc hội thoại từ danh sách bên trái để bắt đầu nhắn tin
        </p>
      </div>
    </div>
  )
}
