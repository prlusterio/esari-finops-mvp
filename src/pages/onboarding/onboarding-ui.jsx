import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ONBOARDING_STEPS } from '@/lib/onboardingSetup'
import { cn } from '@/lib/utils'

export function OnboardingStepper({ currentStep }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-4">
        <div className="flex min-w-[720px] items-center justify-between">
          {ONBOARDING_STEPS.map((step, index) => {
            const status =
              step.n < currentStep
                ? 'done'
                : step.n === currentStep
                  ? 'current'
                  : 'upcoming'
            const inner = (
              <div
                className={cn(
                  'flex items-center gap-2 text-xs font-semibold uppercase tracking-wide',
                  status === 'done' && 'text-success',
                  status === 'current' && 'text-primary',
                  status === 'upcoming' && 'text-muted-foreground',
                )}
              >
                {status === 'done' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center border text-[10px]',
                      status === 'current'
                        ? 'border-2 border-primary'
                        : 'border-border',
                    )}
                  >
                    {step.n}
                  </div>
                )}
                <span>
                  {step.n}. {step.label}
                </span>
              </div>
            )

            return (
              <div key={step.n} className="flex flex-1 items-center">
                {step.path && status !== 'current' ? (
                  <Link to={step.path}>{inner}</Link>
                ) : (
                  inner
                )}
                {index < ONBOARDING_STEPS.length - 1 ? (
                  <div className="mx-3 h-px flex-1 bg-border" />
                ) : null}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function NativeSelect({ className, ...props }) {
  return (
    <select
      className={cn(
        'flex h-10 w-full border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function ShareCard({
  label,
  value,
  onChange,
  disabled = false,
  hint = '',
  highlight = false,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center border border-border bg-muted/30 p-4',
        highlight && 'border-primary/40 bg-primary/5',
        disabled && 'opacity-60',
      )}
    >
      <span
        className={cn(
          'mb-2 text-[11px] font-semibold uppercase tracking-wide',
          highlight ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      <div className="flex items-baseline justify-center gap-1">
        <Input
          className={cn(
            'h-12 w-20 text-center text-2xl font-semibold tabular-nums',
            highlight && 'text-primary',
          )}
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          aria-label={`${label} revenue share percentage`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          readOnly={disabled}
        />
        <span
          className={cn(
            'text-2xl font-semibold',
            highlight ? 'text-primary' : 'text-foreground',
            disabled && 'text-muted-foreground',
          )}
        >
          %
        </span>
      </div>
      {hint ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function ReviewField({ label, value, className }) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium">{value || '—'}</div>
    </div>
  )
}

export function SummaryRow({ label, value, emphasize = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          emphasize ? 'font-semibold' : 'font-medium',
        )}
      >
        {value}
      </span>
    </div>
  )
}
