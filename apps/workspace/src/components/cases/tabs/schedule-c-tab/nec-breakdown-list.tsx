/**
 * NEC Breakdown List - Shows per-payer 1099-NEC amounts under gross receipts
 * Displays payer name + compensation for each verified 1099-NEC
 */
import type { NecBreakdownItem } from '../../../../lib/api-client'
import { formatUSD } from './format-utils'
import { CopyableValue } from './copyable-value'

interface NecBreakdownListProps {
  items: NecBreakdownItem[]
}

export function NecBreakdownList({ items }: NecBreakdownListProps) {
  if (items.length === 0) return null

  return (
    <div className="ml-2 pl-3 border-l-2 border-muted space-y-1.5">
      {items.map((item) => (
        <div key={item.docId} className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground truncate mr-2">
            {item.payerName || 'Không rõ'}
          </span>
          <CopyableValue
            formatted={formatUSD(item.nonemployeeCompensation)}
            rawValue={item.nonemployeeCompensation}
            className="text-muted-foreground font-medium whitespace-nowrap"
          />
        </div>
      ))}
    </div>
  )
}
