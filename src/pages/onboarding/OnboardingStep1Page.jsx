import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  EMPTY_ONBOARDING_CLIENT_INFO,
  ONBOARDING_STEP_PATHS,
  parseOnboardingClientInfo,
  validateOnboardingClientInfo,
} from '@/lib/onboardingSetup'
import { getHomePathForRole } from '@/lib/permissions'
import {
  getOnboardingClientInfo,
  saveOnboardingClientInfo,
} from '@/services/storage'
import { PageHeader } from '@/components/shared/PageHeader'
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
import { cn } from '@/lib/utils'
import { OnboardingStepper, SummaryRow } from './onboarding-ui'

function Field({ id, label, error, className, children }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function textValue(form, key) {
  return form[key] ?? ''
}

export default function OnboardingStep1Page() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_ONBOARDING_CLIENT_INFO)
  const [errors, setErrors] = useState({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setForm(getOnboardingClientInfo())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    saveOnboardingClientInfo(form)
  }, [form, loaded])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleContinue(event) {
    event.preventDefault()
    const nextErrors = validateOnboardingClientInfo(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    saveOnboardingClientInfo(form)
    navigate(ONBOARDING_STEP_PATHS[2])
  }

  const parsed = parseOnboardingClientInfo(form) ?? EMPTY_ONBOARDING_CLIENT_INFO
  const locationLine = [parsed.city_municipality, parsed.state_province_region]
    .filter(Boolean)
    .join(', ')

  return (
    <div>
      <PageHeader
        title="Client Info"
        description="Enter the admin login, company profile, and contact person for this franchise client."
        breadcrumbs={[
          { label: 'Home', href: getHomePathForRole(user?.role) },
          { label: 'Clients', href: '/franchise-setup/clients' },
          { label: 'Client Info' },
        ]}
      />

      <form onSubmit={handleContinue}>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 space-y-4 pb-8 lg:col-span-8">
            <OnboardingStepper currentStep={1} />

            <Card>
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-base">Admin Profile</CardTitle>
                <CardDescription>
                  Login credentials for the client admin.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <Field
                  id="admin-first-name"
                  label="First Name"
                  error={errors.admin_first_name}
                >
                  <Input
                    id="admin-first-name"
                    value={textValue(form, 'admin_first_name')}
                    onChange={(event) =>
                      updateField('admin_first_name', event.target.value)
                    }
                    aria-invalid={Boolean(errors.admin_first_name)}
                  />
                </Field>
                <Field
                  id="admin-last-name"
                  label="Last Name"
                  error={errors.admin_last_name}
                >
                  <Input
                    id="admin-last-name"
                    value={textValue(form, 'admin_last_name')}
                    onChange={(event) =>
                      updateField('admin_last_name', event.target.value)
                    }
                    aria-invalid={Boolean(errors.admin_last_name)}
                  />
                </Field>
                <Field
                  id="admin-email"
                  label="Email"
                  error={errors.admin_email}
                  className="sm:col-span-2"
                >
                  <Input
                    id="admin-email"
                    type="email"
                    value={textValue(form, 'admin_email')}
                    onChange={(event) =>
                      updateField('admin_email', event.target.value)
                    }
                    aria-invalid={Boolean(errors.admin_email)}
                  />
                </Field>
                <Field
                  id="admin-password"
                  label="Password"
                  error={errors.admin_password}
                >
                  <Input
                    id="admin-password"
                    type="password"
                    autoComplete="new-password"
                    value={textValue(form, 'admin_password')}
                    onChange={(event) =>
                      updateField('admin_password', event.target.value)
                    }
                    aria-invalid={Boolean(errors.admin_password)}
                  />
                </Field>
                <Field
                  id="admin-password-confirm"
                  label="Confirm Password"
                  error={errors.admin_password_confirmation}
                >
                  <Input
                    id="admin-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={textValue(form, 'admin_password_confirmation')}
                    onChange={(event) =>
                      updateField(
                        'admin_password_confirmation',
                        event.target.value,
                      )
                    }
                    aria-invalid={Boolean(errors.admin_password_confirmation)}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-base">Company Profile</CardTitle>
                <CardDescription>
                  Legal and address details for the franchise entity.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <Field
                  id="company-name"
                  label="Name"
                  error={errors.company_name}
                  className="sm:col-span-2"
                >
                  <Input
                    id="company-name"
                    value={textValue(form, 'company_name')}
                    onChange={(event) =>
                      updateField('company_name', event.target.value)
                    }
                    aria-invalid={Boolean(errors.company_name)}
                  />
                </Field>
                <Field
                  id="registration-number"
                  label="Registration Number"
                  error={errors.registration_number}
                >
                  <Input
                    id="registration-number"
                    value={textValue(form, 'registration_number')}
                    onChange={(event) =>
                      updateField('registration_number', event.target.value)
                    }
                    aria-invalid={Boolean(errors.registration_number)}
                  />
                </Field>
                <Field id="tax-id" label="Tax ID" error={errors.tax_id}>
                  <Input
                    id="tax-id"
                    value={textValue(form, 'tax_id')}
                    onChange={(event) =>
                      updateField('tax_id', event.target.value)
                    }
                    aria-invalid={Boolean(errors.tax_id)}
                  />
                </Field>
                <Field
                  id="corp-email"
                  label="Corporate Email"
                  error={errors.company_email}
                >
                  <Input
                    id="corp-email"
                    type="email"
                    value={textValue(form, 'company_email')}
                    onChange={(event) =>
                      updateField('company_email', event.target.value)
                    }
                    aria-invalid={Boolean(errors.company_email)}
                  />
                </Field>
                <Field
                  id="corp-phone"
                  label="Phone"
                  error={errors.company_phone}
                >
                  <Input
                    id="corp-phone"
                    type="tel"
                    value={textValue(form, 'company_phone')}
                    onChange={(event) =>
                      updateField('company_phone', event.target.value)
                    }
                    aria-invalid={Boolean(errors.company_phone)}
                  />
                </Field>
                <Field
                  id="address-one"
                  label="Address 1"
                  error={errors.address_line_1}
                  className="sm:col-span-2"
                >
                  <Input
                    id="address-one"
                    value={textValue(form, 'address_line_1')}
                    onChange={(event) =>
                      updateField('address_line_1', event.target.value)
                    }
                    aria-invalid={Boolean(errors.address_line_1)}
                  />
                </Field>
                <Field
                  id="address-two"
                  label="Address 2"
                  error={errors.address_line_2}
                  className="sm:col-span-2"
                >
                  <Input
                    id="address-two"
                    value={textValue(form, 'address_line_2')}
                    onChange={(event) =>
                      updateField('address_line_2', event.target.value)
                    }
                    aria-invalid={Boolean(errors.address_line_2)}
                  />
                </Field>
                <Field
                  id="city-municipality"
                  label="City/Municipality"
                  error={errors.city_municipality}
                >
                  <Input
                    id="city-municipality"
                    value={textValue(form, 'city_municipality')}
                    onChange={(event) =>
                      updateField('city_municipality', event.target.value)
                    }
                    aria-invalid={Boolean(errors.city_municipality)}
                  />
                </Field>
                <Field
                  id="state-province-region"
                  label="State/Province/Region"
                  error={errors.state_province_region}
                >
                  <Input
                    id="state-province-region"
                    value={textValue(form, 'state_province_region')}
                    onChange={(event) =>
                      updateField('state_province_region', event.target.value)
                    }
                    aria-invalid={Boolean(errors.state_province_region)}
                  />
                </Field>
                <Field
                  id="postal-zip"
                  label="Postal/ZIP"
                  error={errors.postal}
                >
                  <Input
                    id="postal-zip"
                    inputMode="numeric"
                    value={textValue(form, 'postal')}
                    onChange={(event) =>
                      updateField('postal', event.target.value)
                    }
                    aria-invalid={Boolean(errors.postal)}
                  />
                </Field>
                <Field id="country" label="Country" error={errors.country}>
                  <Input
                    id="country"
                    value={textValue(form, 'country')}
                    onChange={(event) =>
                      updateField('country', event.target.value)
                    }
                    aria-invalid={Boolean(errors.country)}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-base">Contact Person</CardTitle>
                <CardDescription>
                  Optional operations contact for this client.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <Field
                  id="contact-full-name"
                  label="Full Name"
                  error={errors.contact_person}
                  className="sm:col-span-2"
                >
                  <Input
                    id="contact-full-name"
                    value={textValue(form, 'contact_person')}
                    onChange={(event) =>
                      updateField('contact_person', event.target.value)
                    }
                    aria-invalid={Boolean(errors.contact_person)}
                  />
                </Field>
                <Field
                  id="contact-email"
                  label="Email"
                  error={errors.contact_email}
                >
                  <Input
                    id="contact-email"
                    type="email"
                    value={textValue(form, 'contact_email')}
                    onChange={(event) =>
                      updateField('contact_email', event.target.value)
                    }
                    aria-invalid={Boolean(errors.contact_email)}
                  />
                </Field>
                <Field
                  id="contact-phone"
                  label="Phone"
                  error={errors.contact_phone}
                >
                  <Input
                    id="contact-phone"
                    type="tel"
                    value={textValue(form, 'contact_phone')}
                    onChange={(event) =>
                      updateField('contact_phone', event.target.value)
                    }
                    aria-invalid={Boolean(errors.contact_phone)}
                  />
                </Field>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 h-fit lg:sticky lg:top-6 lg:col-span-4">
            <Card className="overflow-hidden">
              <div className="bg-primary px-4 py-3 text-primary-foreground">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide">
                  Step 1 Summary
                </h2>
              </div>
              <CardContent className="space-y-4 p-4">
                <div className="space-y-2">
                  <SummaryRow
                    label="Admin"
                    value={
                      [parsed.admin_first_name, parsed.admin_last_name]
                        .filter(Boolean)
                        .join(' ') || '—'
                    }
                  />
                  <SummaryRow
                    label="Admin email"
                    value={parsed.admin_email || '—'}
                  />
                </div>
                <hr className="border-border" />
                <div className="space-y-2">
                  <SummaryRow
                    label="Company"
                    value={parsed.company_name || '—'}
                    emphasize
                  />
                  <SummaryRow
                    label="Registration"
                    value={parsed.registration_number || '—'}
                  />
                  <SummaryRow
                    label="Location"
                    value={locationLine || '—'}
                  />
                </div>
                <div className="pt-1">
                  <Button type="submit" className="w-full">
                    Continue to Step 2
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
