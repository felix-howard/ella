/**
 * Client Linked Entity Card - Shows linked business or owner info on overview tab
 * For individual clients: shows their linked business
 * For business clients: shows the owner (individual client)
 */
import { Link } from '@tanstack/react-router'
import { Building2, User, Phone, Mail, FileText, ArrowRight } from 'lucide-react'
import { cn } from '@ella/ui'
import { type ClientPreview, type ClientType } from '../../../lib/api-client'
import { formatPhone } from '../../../lib/formatters'
import { getInitials, getAvatarColor } from '../../../lib/formatters'

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  SOLE_PROPRIETORSHIP: 'Sole Prop',
  LLC: 'LLC',
  PARTNERSHIP: 'Partnership',
  S_CORP: 'S-Corp',
  C_CORP: 'C-Corp',
}

interface ClientLinkedEntityCardProps {
  currentClientType: ClientType
  linkedClients: ClientPreview[]
}

export function ClientLinkedEntityCard({ currentClientType, linkedClients }: ClientLinkedEntityCardProps) {
  if (!linkedClients || linkedClients.length === 0) return null

  const isBusiness = currentClientType === 'BUSINESS'
  const title = isBusiness ? 'Business Owner' : 'Linked Business'
  const Icon = isBusiness ? User : Building2

  return (
    <div className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4.5 h-4.5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      <div className="space-y-3">
        {linkedClients.map((linked) => {
          const avatarColor = getAvatarColor(linked.name)
          const isLinkedBusiness = linked.clientType === 'BUSINESS'

          return (
            <Link
              key={linked.id}
              to="/clients/$clientId"
              params={{ clientId: linked.id }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all group"
            >
              {/* Avatar */}
              <div className={cn(
                'w-12 h-12 flex items-center justify-center flex-shrink-0 ring-1 ring-background shadow-sm',
                isLinkedBusiness ? 'rounded-lg' : 'rounded-full',
                avatarColor.bg,
                avatarColor.text
              )}>
                <span className="font-bold text-sm">
                  {getInitials(linked.name)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {linked.name}
                  </span>
                  {isLinkedBusiness && linked.businessType && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                      {BUSINESS_TYPE_LABELS[linked.businessType] || linked.businessType}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {formatPhone(linked.phone)}
                  </span>
                  {linked.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {linked.email}
                    </span>
                  )}
                  {isLinkedBusiness && linked.einMasked && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      EIN: ***-**-{linked.einMasked}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
