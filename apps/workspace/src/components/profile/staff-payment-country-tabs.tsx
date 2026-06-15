import { TabsList, TabsTrigger } from '@ella/ui'
import type { StaffPaymentCountry } from '../../lib/api-client'
import { PAYMENT_COUNTRIES } from './staff-payment-info-utils'

interface StaffPaymentCountryTabsProps {
  activeCountry: StaffPaymentCountry
}

export function StaffPaymentCountryTabs({ activeCountry }: StaffPaymentCountryTabsProps) {
  return (
    <TabsList className="grid w-full grid-cols-3 rounded-lg bg-muted p-1 sm:w-auto sm:min-w-80">
      {PAYMENT_COUNTRIES.map((country) => (
        <TabsTrigger
          key={country}
          value={country}
          className="h-9 rounded-md px-3 text-xs sm:text-sm"
          aria-label={`${country} payment info`}
          data-active={activeCountry === country}
        >
          {country}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
