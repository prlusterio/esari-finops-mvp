import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function ReportsPage() {
  return (
    <PlaceholderPage
      title="Reports"
      description="Generate operational and financial reports for the eSariSari platform."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Reports' },
      ]}
      details="Report filtering and export features will be implemented in a later phase."
    />
  )
}
