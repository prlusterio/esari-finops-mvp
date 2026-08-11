import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function SettlementsPage() {
  return (
    <PlaceholderPage
      title="Settlements"
      description="Monitor settlement cycles and payout status across the platform."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Settlements' },
      ]}
      details="Settlement processing workflows will be implemented in a later phase."
    />
  )
}
