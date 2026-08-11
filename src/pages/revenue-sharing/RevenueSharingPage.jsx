import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function RevenueSharingPage() {
  return (
    <PlaceholderPage
      title="Revenue Sharing"
      description="Configure commission percentages across the franchise hierarchy."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Revenue Sharing' },
      ]}
      details="Revenue sharing editing and version history will be implemented in a later phase."
    />
  )
}
