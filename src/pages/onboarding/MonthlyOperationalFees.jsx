import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  DEFAULT_ONBOARDING_MONTHLY_FEES,
  formatPlainPhp,
  generateId,
  parseAmount,
} from '@/lib/onboardingSetup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { NativeSelect } from './onboarding-ui'

const NEW_ID = '__new__'
const TREATMENT_GUIDE = [
  {
    treatment: 'BillingOnly',
    label: 'Billing only',
    description:
      'Charged to the client monthly, but not deducted before revenue sharing.',
  },
  {
    treatment: 'CostDeduction',
    label: 'Cost deduction',
    description:
      'Deducted from gross sales before stakeholder split, but not billed monthly.',
  },
  {
    treatment: 'Both',
    label: 'Billing + cost',
    description:
      'Included in monthly billing and deducted before revenue sharing.',
  },
]

function billingTypeLabel(type) {
  return type === 'PercentGrossSales' ? '% Gross Sales' : 'Fixed / Monthly'
}

function treatmentLabel(treatment) {
  if (treatment === 'CostDeduction') return 'Cost deduction'
  if (treatment === 'Both') return 'Billing + cost'
  return 'Billing only'
}

function treatmentVariant(treatment) {
  if (treatment === 'CostDeduction') return 'warning'
  if (treatment === 'Both') return 'wallet'
  return 'secondary'
}

function isBillableFee(fee) {
  return fee.treatment !== 'CostDeduction'
}

function isCostDeductionFee(fee) {
  return fee.treatment === 'CostDeduction' || fee.treatment === 'Both'
}

function formatAmount(type, amount) {
  if (type === 'PercentGrossSales') {
    return `${new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount)}%`
  }
  return `₱${formatPlainPhp(amount)}`
}

function FeeEditorRow({ draft, onChange, onSave, onCancel }) {
  const amountStep = draft.billingType === 'PercentGrossSales' ? 0.1 : 0.01
  return (
    <TableRow>
      <TableCell>
        <Input
          autoFocus
          placeholder="Expense item"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </TableCell>
      <TableCell>
        <NativeSelect
          value={draft.billingType}
          onChange={(event) =>
            onChange({ ...draft, billingType: event.target.value })
          }
        >
          <option value="FixedMonthly">Fixed / Monthly</option>
          <option value="PercentGrossSales">% Gross Sales</option>
        </NativeSelect>
      </TableCell>
      <TableCell>
        <NativeSelect
          value={draft.treatment}
          onChange={(event) =>
            onChange({ ...draft, treatment: event.target.value })
          }
        >
          <option value="BillingOnly">Billing only</option>
          <option value="CostDeduction">Cost deduction</option>
          <option value="Both">Billing + cost deduction</option>
        </NativeSelect>
      </TableCell>
      <TableCell className="text-right">
        <Input
          className="ml-auto w-40 text-right tabular-nums"
          type="number"
          min={0}
          step={amountStep}
          value={draft.amount}
          onChange={(event) =>
            onChange({ ...draft, amount: event.target.value })
          }
        />
      </TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="icon" onClick={onSave}>
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function MonthlyOperationalFees({
  initialFees,
  onSummaryChange,
} = {}) {
  const [fees, setFees] = useState(() =>
    Array.isArray(initialFees) && initialFees.length > 0
      ? initialFees
      : DEFAULT_ONBOARDING_MONTHLY_FEES.map((item) => ({ ...item })),
  )
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const isEditing = editingId !== null

  const fixedMonthlySubtotal = useMemo(
    () =>
      fees.reduce(
        (sum, fee) =>
          sum +
          (fee.billingType === 'FixedMonthly' && isBillableFee(fee)
            ? fee.amount
            : 0),
        0,
      ),
    [fees],
  )
  const fixedMonthlyCount = useMemo(
    () =>
      fees.filter(
        (fee) => fee.billingType === 'FixedMonthly' && isBillableFee(fee),
      ).length,
    [fees],
  )
  const percentGrossCount = useMemo(
    () => fees.filter((fee) => fee.billingType === 'PercentGrossSales').length,
    [fees],
  )
  const costDeductionSubtotal = useMemo(
    () =>
      fees.reduce(
        (sum, fee) =>
          sum +
          (fee.billingType === 'FixedMonthly' && isCostDeductionFee(fee)
            ? fee.amount
            : 0),
        0,
      ),
    [fees],
  )
  const costDeductionCount = useMemo(
    () => fees.filter((fee) => isCostDeductionFee(fee)).length,
    [fees],
  )

  useEffect(() => {
    onSummaryChange?.({
      fixedMonthlySubtotal,
      fixedMonthlyCount,
      percentGrossCount,
      costDeductionSubtotal,
      costDeductionCount,
      fees,
    })
  }, [
    onSummaryChange,
    fixedMonthlySubtotal,
    fixedMonthlyCount,
    percentGrossCount,
    costDeductionSubtotal,
    costDeductionCount,
    fees,
  ])

  const startAdd = () => {
    setEditingId(NEW_ID)
    setDraft({
      name: '',
      billingType: 'FixedMonthly',
      amount: '0',
      treatment: 'BillingOnly',
    })
  }

  const startEdit = (fee) => {
    setEditingId(fee.id)
    setDraft({
      name: fee.name,
      billingType: fee.billingType,
      amount: String(fee.amount),
      treatment: fee.treatment,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
  }

  const saveEdit = () => {
    if (!editingId || !draft) return
    const trimmedName = draft.name.trim()
    if (!trimmedName) return
    const amountNumber = parseAmount(draft.amount)
    if (editingId === NEW_ID) {
      setFees((prev) => [
        ...prev,
        {
          id: generateId('op'),
          name: trimmedName,
          billingType: draft.billingType,
          amount: amountNumber,
          treatment: draft.treatment,
        },
      ])
      cancelEdit()
      return
    }
    setFees((prev) =>
      prev.map((fee) =>
        fee.id === editingId
          ? {
              ...fee,
              name: trimmedName,
              billingType: draft.billingType,
              amount: amountNumber,
              treatment: draft.treatment,
            }
          : fee,
      ),
    )
    cancelEdit()
  }

  const deleteFee = (id) => {
    const fee = fees.find((item) => item.id === id)
    if (!fee) return
    if (!window.confirm(`Delete "${fee.name}"?`)) return
    setFees((prev) => prev.filter((item) => item.id !== id))
    if (editingId === id) cancelEdit()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border px-4 py-3">
        <div>
          <CardTitle className="text-base">Monthly & Operational Fees</CardTitle>
          <CardDescription>
            Billable fixed monthly fees are collected on the dashboard. Cost
            deductions are excluded.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startAdd}
          disabled={isEditing}
        >
          <Plus className="h-4 w-4" />
          Add Fee
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b border-border p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Treatment Guide
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {TREATMENT_GUIDE.map((item) => (
              <div key={item.treatment} className="border border-border bg-muted/30 p-3">
                <Badge
                  variant={treatmentVariant(item.treatment)}
                  className="rounded-full"
                >
                  {item.label}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense Item</TableHead>
              <TableHead>Billing Type</TableHead>
              <TableHead>Treatment</TableHead>
              <TableHead className="text-right">Amount / Rate</TableHead>
              <TableHead className="w-28 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editingId === NEW_ID && draft ? (
              <FeeEditorRow
                draft={draft}
                onChange={setDraft}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
            ) : null}
            {fees.map((fee) => {
              if (editingId === fee.id && draft) {
                return (
                  <FeeEditorRow
                    key={fee.id}
                    draft={draft}
                    onChange={setDraft}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                  />
                )
              }
              return (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-full">
                      {billingTypeLabel(fee.billingType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={treatmentVariant(fee.treatment)}
                      className="rounded-full"
                    >
                      {treatmentLabel(fee.treatment)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(fee.billingType, fee.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(fee)}
                      disabled={isEditing}
                      aria-label={`Edit ${fee.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFee(fee.id)}
                      disabled={isEditing}
                      aria-label={`Delete ${fee.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="uppercase">
                Billable fixed monthly subtotal (excludes % gross and cost-only)
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                ₱{formatPlainPhp(fixedMonthlySubtotal)}
              </TableCell>
              <TableCell />
            </TableRow>
            <TableRow>
              <TableCell colSpan={3} className="uppercase">
                Standard cost deduction subtotal
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                ₱{formatPlainPhp(costDeductionSubtotal)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
