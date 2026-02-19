/**
 * ConfirmStep - Final step in simplified client creation
 * Shows summary of client info and SMS preview before creating
 * Part of Phase 1: Simplify Client Workflow
 */

import { MessageSquare, Loader2, User, Phone, Calendar, Send } from 'lucide-react'
import { cn } from '@ella/ui'
import { formatPhone } from '../../lib/formatters'

interface ConfirmStepProps {
  clientName: string
  phone: string
  taxYear: number
  language: 'VI' | 'EN'
  onLanguageChange: (language: 'VI' | 'EN') => void
  onSubmit: () => void
  isSubmitting: boolean
}

// SMS message template (matches backend welcome message)
const SMS_TEMPLATE_VI = (name: string, year: number) =>
  `Xin chào ${name}, để chuẩn bị hồ sơ thuế năm ${year}, vui lòng gửi các tài liệu cần thiết qua link: [Portal Link]`

const SMS_TEMPLATE_EN = (name: string, year: number) =>
  `Hello ${name}, to prepare your ${year} tax documents, please send the required documents via the link: [Portal Link]`

export function ConfirmStep({
  clientName,
  phone,
  taxYear,
  language,
  onLanguageChange,
  onSubmit,
  isSubmitting,
}: ConfirmStepProps) {
  const smsMessage = language === 'VI'
    ? SMS_TEMPLATE_VI(clientName, taxYear)
    : SMS_TEMPLATE_EN(clientName, taxYear)

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Xác nhận thông tin</h3>
        <dl className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              Tên:
            </dt>
            <dd className="font-medium text-foreground">{clientName}</dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              Số điện thoại:
            </dt>
            <dd className="font-medium text-foreground">{formatPhone(phone)}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Năm thuế:
            </dt>
            <dd className="font-medium text-foreground">{taxYear}</dd>
          </div>
        </dl>
      </div>

      {/* SMS Preview */}
      <div className="bg-muted/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Tin nhắn sẽ được gửi:</span>
          </div>
          {/* Language Toggle */}
          <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
            <button
              type="button"
              onClick={() => onLanguageChange('VI')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                language === 'VI'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              VN
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('EN')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                language === 'EN'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              EN
            </button>
          </div>
        </div>
        <div className="bg-card rounded-lg p-3 text-sm text-muted-foreground border border-border shadow-sm">
          {smsMessage}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          * Link portal sẽ được tạo tự động
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium',
          'bg-primary text-white transition-colors',
          isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark'
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tạo...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Tạo khách hàng & Gửi tin nhắn
          </>
        )}
      </button>

      {/* Info note */}
      <p className="text-xs text-muted-foreground text-center">
        Sau khi tạo, khách hàng sẽ nhận được tin nhắn với link để gửi tài liệu.
        Bạn có thể cập nhật thông tin chi tiết sau trong tab Tổng quan.
      </p>
    </div>
  )
}
