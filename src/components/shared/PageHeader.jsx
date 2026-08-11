import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb'

/**
 * Consistent page header for module/placeholder pages.
 */
export function PageHeader({ title, description, breadcrumbs = [] }) {
  return (
    <div className="mb-6 space-y-3">
      {breadcrumbs.length > 0 && <PageBreadcrumb items={breadcrumbs} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}
