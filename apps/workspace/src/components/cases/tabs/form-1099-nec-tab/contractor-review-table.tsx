/**
 * Editable review table for parsed Excel contractor data
 * CPA can fix parsing errors, add emails, then bulk save
 */
import { useState } from 'react'
import { Loader2, AlertTriangle, Check, X, Trash2 } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import type { ParsedContractor } from '../../../../lib/api-client'

interface ContractorReviewTableProps {
  contractors: ParsedContractor[]
  taxYear: number
  businessName: string
  onSave: (contractors: ParsedContractor[]) => void
  onCancel: () => void
  isSaving: boolean
}

export function ContractorReviewTable({
  contractors: initialContractors,
  taxYear,
  businessName,
  onSave,
  onCancel,
  isSaving,
}: ContractorReviewTableProps) {
  const [contractors, setContractors] = useState(initialContractors)

  const updateField = (index: number, field: keyof ParsedContractor, value: string | number) => {
    setContractors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  const removeContractor = (index: number) => {
    setContractors((prev) => prev.filter((_, i) => i !== index))
  }

  const warningCount = contractors.reduce(
    (sum, c) => sum + c.parseWarnings.length, 0
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Review Imported Contractors ({contractors.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {businessName} — Tax Year {taxYear}
            {warningCount > 0 && (
              <span className="text-yellow-600 ml-2">
                • {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(contractors)}
            disabled={isSaving || contractors.length === 0}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Save All ({contractors.length})
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-8">#</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">First Name</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Last Name</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">SSN</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Address</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">City</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-16">State</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-20">ZIP</th>
              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Email</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground w-24">Amount</th>
              <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contractors.map((c, i) => {
              const hasWarnings = c.parseWarnings.length > 0
              return (
                <tr
                  key={`${c.rowIndex}-${c.ssn}`}
                  className={hasWarnings ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                  title={hasWarnings ? c.parseWarnings.join('\n') : undefined}
                >
                  <td className="py-1.5 px-2 text-xs text-muted-foreground">
                    {hasWarnings && (
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 inline" />
                    )}
                    {!hasWarnings && <span>{i + 1}</span>}
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      value={c.firstName}
                      onChange={(e) => updateField(i, 'firstName', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      value={c.lastName}
                      onChange={(e) => updateField(i, 'lastName', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.ssnMasked}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      value={c.address}
                      onChange={(e) => updateField(i, 'address', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      value={c.city}
                      onChange={(e) => updateField(i, 'city', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      value={c.state}
                      onChange={(e) => updateField(i, 'state', e.target.value.toUpperCase())}
                      className="h-7 text-xs"
                      maxLength={2}
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      value={c.zip}
                      onChange={(e) => updateField(i, 'zip', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      value={c.email || ''}
                      onChange={(e) => updateField(i, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className="h-7 text-xs"
                      type="email"
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <span className="font-mono text-xs">
                      ${c.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContractor(i)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Warnings summary */}
      {warningCount > 0 && (
        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
            Parse Warnings
          </p>
          <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-0.5">
            {contractors
              .filter((c) => c.parseWarnings.length > 0)
              .map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.firstName} {c.lastName}:</span>{' '}
                  {c.parseWarnings.join(', ')}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
