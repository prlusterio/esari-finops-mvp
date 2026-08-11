import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export default function OrganizationsPage() {
  return (
    <PlaceholderPage
      title="Organizations"
      description="Manage the platform hierarchy of sub-franchisees, franchisees, and retailers."
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Organizations' },
      ]}
      details="Organization creation, hierarchy editing, and status management will be added in a later phase."
    />
  )
}
