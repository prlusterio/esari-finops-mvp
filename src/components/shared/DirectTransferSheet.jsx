import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, FileImage, Info, Send, Wallet, X } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
]
const ACCEPTED_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.pdf']
const MAX_FILE_BYTES = 5 * 1024 * 1024

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isAcceptedFile(file) {
  if (!file) return false
  if (ACCEPTED_TYPES.includes(file.type)) return true
  const lowerName = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read the selected file.'))
    reader.readAsDataURL(file)
  })
}

export function DirectTransferSheet({
  open,
  onOpenChange,
  user,
  recipients = [],
  recipientLabel = 'Recipient Franchisee',
  availableBalance = 0,
  initialRecipientId = '',
  onConfirmIntent,
}) {
  const fileInputRef = useRef(null)
  const [recipientId, setRecipientId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreviewUrl, setProofPreviewUrl] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const sortedRecipients = useMemo(
    () =>
      [...recipients].sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      ),
    [recipients],
  )

  useEffect(() => {
    if (!open) return
    const preset =
      initialRecipientId &&
      recipients.some((item) => item.id === initialRecipientId)
        ? initialRecipientId
        : ''
    setRecipientId(preset)
    setAmount('')
    setNotes('')
    setProofFile(null)
    setProofPreviewUrl('')
    setError('')
    setSubmitting(false)
    setDragActive(false)
  }, [open, initialRecipientId, recipients])

  useEffect(() => {
    return () => {
      if (proofPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(proofPreviewUrl)
      }
    }
  }, [proofPreviewUrl])

  const clearProof = () => {
    if (proofPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(proofPreviewUrl)
    }
    setProofFile(null)
    setProofPreviewUrl('')
  }

  const assignProof = (file) => {
    if (!file) return

    if (!isAcceptedFile(file)) {
      setError('Proof of payment must be SVG, PNG, JPG, or PDF.')
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setError('Proof of payment must be 5MB or smaller.')
      return
    }

    if (proofPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(proofPreviewUrl)
    }

    setError('')
    setProofFile(file)
    setProofPreviewUrl(URL.createObjectURL(file))
  }

  const handleAmountChange = (event) => {
    const raw = event.target.value.replace(/[^\d.]/g, '')
    const parts = raw.split('.')
    const normalized =
      parts.length > 1
        ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
        : parts[0]
    setAmount(normalized)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragActive(false)
    assignProof(event.dataTransfer.files?.[0])
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const numericAmount = Number(amount)

    if (!recipientId) {
      setError(`Select a ${recipientLabel.toLowerCase()}.`)
      return
    }

    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }

    if (numericAmount > Number(availableBalance)) {
      setError('Amount exceeds available wallet balance.')
      return
    }

    setSubmitting(true)

    try {
      const recipient = recipients.find((item) => item.id === recipientId)
      let proofOfPayment = null
      if (proofFile) {
        const dataUrl = await readFileAsDataUrl(proofFile)
        proofOfPayment = {
          fileName: proofFile.name,
          fileSize: formatFileSize(proofFile.size),
          url: dataUrl,
        }
      }
      onConfirmIntent?.({
        fromOrganizationId: user.organizationId,
        toOrganizationId: recipientId,
        amount: numericAmount,
        notes: notes.trim(),
        proofOfPayment,
        recipientName: recipient?.name || 'Recipient',
        recipientLabel,
        balanceAfter: Number(availableBalance) - numericAmount,
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError.message || 'Unable to prepare the transfer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[28rem]">
        <SheetHeader className="border-b border-slate-200 px-6 py-5 pr-12">
          <SheetTitle className="text-xl font-semibold text-slate-900">
            Direct Transfer
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-4">
              <div>
                <div className="text-xs text-slate-500">Available Balance</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {formatCurrency(availableBalance)}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Wallet className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-slate-700">
                {recipientLabel} <span className="text-red-500">*</span>
              </Label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a recipient..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedRecipients.map((recipient) => (
                    <SelectItem key={recipient.id} value={recipient.id}>
                      {recipient.name}
                      {recipient.code ? ` (${recipient.code})` : ''}
                      {recipient.type
                        ? ` · ${
                            recipient.type === 'subfranchisee'
                              ? 'Sub-Franchisee'
                              : recipient.type === 'franchisee'
                                ? 'Franchisee'
                                : recipient.type === 'retailer'
                                  ? 'Retailer'
                                  : recipient.type
                          }`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-amount" className="text-sm text-slate-700">
                Amount (PHP) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  ₱
                </span>
                <Input
                  id="transfer-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-slate-700">
                Proof of Payment / Receipt{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <p className="flex gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                <span>
                  You can skip uploading for now. Proof of payment will be
                  required in the live app.
                </span>
              </p>

              {!proofFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    setDragActive(false)
                  }}
                  onDrop={handleDrop}
                  className={cn(
                    'flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40',
                    dragActive && 'border-blue-400 bg-blue-50',
                  )}
                >
                  <FileUp className="mb-3 h-8 w-8 text-slate-400" />
                  <div className="text-sm font-semibold text-slate-800">
                    Upload transfer document
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    SVG, PNG, JPG, or PDF · up to 5MB
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <FileImage className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {proofFile.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatFileSize(proofFile.size)}
                      </div>
                      {proofFile.type.startsWith('image/') && proofPreviewUrl ? (
                        <img
                          src={proofPreviewUrl}
                          alt="Transfer document preview"
                          className="mt-3 h-36 w-full rounded-lg border border-slate-200 object-cover"
                        />
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-slate-700"
                      onClick={clearProof}
                      aria-label="Remove transfer document"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-blue-600 hover:underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace file
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".svg,.png,.jpg,.jpeg,.pdf,image/svg+xml,image/png,image/jpeg,application/pdf"
                onChange={(event) => {
                  assignProof(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-notes" className="text-sm text-slate-700">
                Reference Notes
              </Label>
              <Textarea
                id="transfer-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="E.g., Emergency restock fund..."
                className="min-h-[96px] resize-none"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={submitting}
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Preparing...' : 'Continue'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
