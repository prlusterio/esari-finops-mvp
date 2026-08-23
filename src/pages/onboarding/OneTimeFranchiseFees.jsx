import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  DEFAULT_ONBOARDING_ONE_TIME_FEES,
  formatPlainPhp,
  generateId,
  parseAmount,
} from '@/lib/onboardingSetup'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

function FeeEditorRow({ draft, onChange, onSave, onCancel, autoFocus = false }) {
  return (
    <TableRow>
      <TableCell>
        <Input
          autoFocus={autoFocus}
          placeholder="Fee name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          className="ml-auto w-40 text-right tabular-nums"
          type="number"
          min={0}
          step="0.01"
          value={draft.amount}
          onChange={(event) =>
            onChange({ ...draft, amount: event.target.value })
          }
        />
      </TableCell>
      <TableCell className="text-center">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={draft.enabled}
          onChange={(event) =>
            onChange({ ...draft, enabled: event.target.checked })
          }
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPlainPhp(draft.enabled ? parseAmount(draft.amount) : 0)}
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

export function OneTimeFranchiseFees({
  initialFees,
  onSummaryChange,
} = {}) {
  const [fees, setFees] = useState(() =>
    Array.isArray(initialFees) && initialFees.length > 0
      ? initialFees
      : DEFAULT_ONBOARDING_ONE_TIME_FEES.map((item) => ({ ...item })),
  )
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const isEditing = editingId !== null
  const total = useMemo(
    () => fees.reduce((sum, fee) => sum + (fee.enabled ? fee.amount : 0), 0),
    [fees],
  )
  const enabledCount = useMemo(
    () => fees.filter((fee) => fee.enabled).length,
    [fees],
  )

  useEffect(() => {
    onSummaryChange?.({
      totalEnabled: total,
      enabledCount,
      totalCount: fees.length,
      fees,
    })
  }, [onSummaryChange, total, enabledCount, fees])

  const startAdd = () => {
    setEditingId(NEW_ID)
    setDraft({ name: '', amount: '0', enabled: true })
  }

  const startEdit = (fee) => {
    setEditingId(fee.id)
    setDraft({
      name: fee.name,
      amount: String(fee.amount),
      enabled: fee.enabled,
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
          id: generateId('fee'),
          name: trimmedName,
          amount: amountNumber,
          enabled: draft.enabled,
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
              amount: amountNumber,
              enabled: draft.enabled,
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
          <CardTitle className="text-base">One-Time Franchise Fees</CardTitle>
          <CardDescription>
            Included fees are added to the upfront amount due.
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fee Name</TableHead>
              <TableHead className="text-right">Amount (₱)</TableHead>
              <TableHead className="w-24 text-center">Include</TableHead>
              <TableHead className="text-right">Total (₱)</TableHead>
              <TableHead className="w-28 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editingId === NEW_ID && draft ? (
              <FeeEditorRow
                draft={draft}
                autoFocus
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
                    autoFocus
                    onChange={setDraft}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                  />
                )
              }
              return (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPlainPhp(fee.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={fee.enabled}
                      onChange={(event) =>
                        setFees((prev) =>
                          prev.map((item) =>
                            item.id === fee.id
                              ? { ...item, enabled: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPlainPhp(fee.enabled ? fee.amount : 0)}
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
                Total (Included)
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatPlainPhp(total)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
        <div className="grid gap-4 border-t border-border bg-muted/30 p-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="contract-term">Contract Term</Label>
            <NativeSelect id="contract-term" defaultValue="5 Years (Standard)">
              <option>5 Years (Standard)</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renewal-notification">Renewal Notification</Label>
            <NativeSelect
              id="renewal-notification"
              defaultValue="180 Days Before Expiry"
            >
              <option>180 Days Before Expiry</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Contract Status</Label>
            <div className="flex h-10 items-center font-semibold text-primary">
              Pending Activation
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
