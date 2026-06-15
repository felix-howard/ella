import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent } from '@ella/ui'
import { api, type StaffPaymentCountry, type StaffPaymentInfoSummary, type UpdateStaffPaymentInfoInput } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { StaffPaymentCountryTabs } from './staff-payment-country-tabs'
import { StaffPaymentInfoForm } from './staff-payment-info-form'
import {
  findPaymentInfo,
  getDefaultPaymentCountry,
  PAYMENT_COUNTRIES,
  PAYMENT_COUNTRY_LABELS,
} from './staff-payment-info-utils'

interface StaffPaymentInfoCardProps {
  staffId: string
  paymentInfos: StaffPaymentInfoSummary[]
  canEdit: boolean
}

export function StaffPaymentInfoCard({ staffId, paymentInfos, canEdit }: StaffPaymentInfoCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [localInfos, setLocalInfos] = useState(paymentInfos)
  const [activeCountry, setActiveCountry] = useState<StaffPaymentCountry>(() => getDefaultPaymentCountry(paymentInfos))
  const [pendingCountry, setPendingCountry] = useState<StaffPaymentCountry | null>(null)

  useEffect(() => {
    setLocalInfos(paymentInfos)
    setActiveCountry(getDefaultPaymentCountry(paymentInfos))
  }, [paymentInfos])

  const invalidatePaymentInfo = () => {
    queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
    queryClient.invalidateQueries({ queryKey: ['staff-payment-info', staffId] })
  }

  const upsertMutation = useMutation({
    mutationFn: ({ country, data }: { country: StaffPaymentCountry; data: UpdateStaffPaymentInfoInput }) =>
      api.team.upsertPaymentInfo(staffId, country, data),
    onMutate: ({ country }) => setPendingCountry(country),
    onSuccess: ({ paymentInfo }) => {
      setLocalInfos((current) => [
        ...current.filter((info) => info.country !== paymentInfo.country),
        paymentInfo,
      ])
      setActiveCountry(paymentInfo.country)
      toast.success(t('profile.paymentInfo.saveSuccess'))
      invalidatePaymentInfo()
    },
    onError: (error: Error) => toast.error(error.message || t('profile.paymentInfo.saveFailed')),
    onSettled: () => setPendingCountry(null),
  })

  const clearMutation = useMutation({
    mutationFn: (country: StaffPaymentCountry) => api.team.clearPaymentInfo(staffId, country),
    onMutate: (country) => setPendingCountry(country),
    onSuccess: ({ country }) => {
      setLocalInfos((current) => current.filter((info) => info.country !== country))
      toast.success(t('profile.paymentInfo.clearSuccess'))
      invalidatePaymentInfo()
    },
    onError: (error: Error) => toast.error(error.message || t('profile.paymentInfo.clearFailed')),
    onSettled: () => setPendingCountry(null),
  })

  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-sm">
      <div className="border-b border-border bg-primary-light/40 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('profile.paymentInfo.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('profile.paymentInfo.description')}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeCountry} defaultValue={activeCountry} onValueChange={(value) => setActiveCountry(value as StaffPaymentCountry)} className="p-5">
        <StaffPaymentCountryTabs activeCountry={activeCountry} />
        {PAYMENT_COUNTRIES.map((country) => {
          const paymentInfo = findPaymentInfo(localInfos, country)

          return (
            <TabsContent key={country} value={country} className="mt-5">
              <div className="mb-4 text-sm font-medium text-foreground">
                {t('profile.paymentInfo.countryAccount', { country: PAYMENT_COUNTRY_LABELS[country] })}
              </div>
              <StaffPaymentInfoForm
                key={`${country}-${paymentInfo?.updatedAt ?? 'empty'}-${canEdit}`}
                country={country}
                paymentInfo={paymentInfo}
                canEdit={canEdit}
                isSaving={upsertMutation.isPending && pendingCountry === country}
                isClearing={clearMutation.isPending && pendingCountry === country}
                onSave={(nextCountry, data) => upsertMutation.mutate({ country: nextCountry, data })}
                onClear={(nextCountry) => clearMutation.mutate(nextCountry)}
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </section>
  )
}
