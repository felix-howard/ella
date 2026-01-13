/**
 * Messaging Page - Client communication interface
 * Shows conversation history and allows sending messages via SMS or Portal
 */

import { useState, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { cn } from '@ella/ui'
import { ArrowLeft, User, Phone, Globe, RefreshCw } from 'lucide-react'
import { MessageThread, QuickActionsBar } from '../../../components/messaging'
import { formatPhone, getInitials } from '../../../lib/formatters'
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS } from '../../../lib/constants'
import type { Message, TaxCaseStatus, Language } from '../../../lib/api-client'

export const Route = createFileRoute('/cases/$caseId/messages')({
  component: MessagingPage,
  parseParams: (params) => ({ caseId: params.caseId }),
})

function MessagingPage() {
  const { caseId } = Route.useParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES)

  // TODO: Replace with API call using useSuspenseQuery
  // Mock data
  const taxCase = {
    id: caseId,
    clientId: 'client-1',
    taxYear: 2025,
    status: 'WAITING_DOCS' as TaxCaseStatus,
    client: {
      id: 'client-1',
      name: 'Nguyễn Văn An',
      phone: '8182223333',
      email: 'an.nguyen@email.com',
      language: 'VI' as Language,
    },
  }

  // Handle message send
  const handleSend = useCallback(
    async (content: string, channel: 'SMS' | 'PORTAL') => {
      setIsSending(true)
      try {
        // TODO: Replace with actual API call
        // await api.messages.send({ caseId, content, channel })

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 800))

        // Add new message to list (optimistic update)
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          conversationId: `conv-${caseId}`,
          channel,
          direction: 'OUTBOUND',
          content,
          createdAt: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, newMessage])
      } catch (error) {
        console.error('Failed to send message:', error)
        // TODO: Show error toast
      } finally {
        setIsSending(false)
      }
    },
    [caseId]
  )

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      // const response = await api.messages.list(caseId)
      // setMessages(response.messages)
      await new Promise((resolve) => setTimeout(resolve, 500))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const statusColors = CASE_STATUS_COLORS[taxCase.status]

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <Link
                to="/clients/$clientId"
                params={{ clientId: taxCase.clientId }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </Link>

              <div className="h-6 w-px bg-border" />

              {/* Client Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {getInitials(taxCase.client.name)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-semibold text-foreground">
                      {taxCase.client.name}
                    </h1>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        statusColors?.bg,
                        statusColors?.text
                      )}
                    >
                      {CASE_STATUS_LABELS[taxCase.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {formatPhone(taxCase.client.phone)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {taxCase.client.language === 'VI' ? 'Tiếng Việt' : 'English'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isLoading && 'animate-spin'
                )}
                aria-label="Làm mới"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link
                to="/clients/$clientId"
                params={{ clientId: taxCase.clientId }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Hồ sơ khách</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
        {/* Message Thread */}
        <MessageThread
          messages={messages}
          isLoading={isLoading}
          className="flex-1 bg-background"
        />

        {/* Quick Actions Bar */}
        <QuickActionsBar
          onSend={handleSend}
          isSending={isSending}
          clientName={taxCase.client.name}
          clientPhone={taxCase.client.phone}
          defaultChannel="SMS"
        />
      </div>
    </div>
  )
}

// Mock messages for development
const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    channel: 'SMS',
    direction: 'OUTBOUND',
    content:
      'Chào anh An, chúng tôi đã nhận được hồ sơ của anh. Vui lòng gửi thêm form W2 và bằng lái xe để hoàn thành hồ sơ thuế.',
    createdAt: '2026-01-12T09:30:00Z',
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    channel: 'SMS',
    direction: 'INBOUND',
    content: 'Dạ em gửi luôn được không ạ?',
    createdAt: '2026-01-12T10:15:00Z',
  },
  {
    id: 'msg-3',
    conversationId: 'conv-1',
    channel: 'SMS',
    direction: 'OUTBOUND',
    content:
      'Được ạ! Anh có thể chụp ảnh và gửi qua link này: https://ella.app/u/abc123. Cảm ơn anh!',
    createdAt: '2026-01-12T10:20:00Z',
  },
  {
    id: 'msg-4',
    conversationId: 'conv-1',
    channel: 'SYSTEM',
    direction: 'OUTBOUND',
    content: 'Khách hàng đã gửi 2 ảnh tài liệu qua Portal',
    createdAt: '2026-01-12T14:30:00Z',
  },
  {
    id: 'msg-5',
    conversationId: 'conv-1',
    channel: 'PORTAL',
    direction: 'INBOUND',
    content: 'Em gửi W2 và bằng lái rồi ạ',
    createdAt: '2026-01-12T14:32:00Z',
  },
  {
    id: 'msg-6',
    conversationId: 'conv-1',
    channel: 'SMS',
    direction: 'OUTBOUND',
    content:
      'Cảm ơn anh! Chúng tôi đã nhận được. Ảnh W2 hơi mờ, anh có thể chụp lại rõ hơn được không ạ?',
    createdAt: '2026-01-12T15:00:00Z',
  },
  {
    id: 'msg-7',
    conversationId: 'conv-1',
    channel: 'SMS',
    direction: 'INBOUND',
    content: 'Dạ em chụp lại nha',
    createdAt: '2026-01-13T08:00:00Z',
  },
]
